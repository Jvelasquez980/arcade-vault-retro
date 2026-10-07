# Plantilla de spec de integración de juego

Referencia para `/integrar-juego`. Sustituye cada `<…>`; elimina las notas en cursiva. Mantén el idioma, estados y encabezados de los specs 05/06.

---

```markdown
# SPEC NN — Juego real: <TÍTULO> (port a TS + canvas en React)

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** <YYYY-MM-DD>
> **Objective:** Portar `references/templates/started-games/<carpeta>/` a un motor TypeScript registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/<id>` y `/salon`.

---

## Por qué existe este spec

<Qué es el juego original (archivos, líneas, globals/DOM) y qué hay que adaptar. Decisiones del usuario (no se reabren).>

---

## Scope

**In:**

- Motor `lib/games/<id>/engine.ts`: port de `<archivos>` sin globals de módulo; exporta `<id>Def: GameEngineDef` con `create<X>(canvas, events) → GameController`.
- Entrada `<id>` en `lib/games/registry.ts`.
- Clase `.cover-<id>` en `app/globals.css`.
- Migración `add_game_<id>`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- <Assets copiados a `public/games/<id>/` y cómo se cargan.>
- HUD: <puntaje + vidas? + nivel? + stats extra (`key`, `label`, formato)>.
- Controles: <teclas/mouse>.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = '<id>'`.
- Actualizar `CLAUDE.md` (lista de motores).

**Out of scope (para specs futuras):**

- Controles táctiles, HiDPI.
- <Features del original excluidas: …>
- Cambios de reglas, balance o look.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('<id>', '<TÍTULO>', '<short>', '<long>', '<CAT>', '<color>', 'cover-<id>', <min>, <max>, '{<controls>}', '{<tags>}', <1-5>, <n>, false);

Definición del motor:

    export const <id>Def: GameEngineDef = {
      width: <W>, height: <H>,
      initialLives: <n | omitir>,
      showLevel: <true|false>,
      stats: [<{ key, label, format }>],
      create: create<X>,
    };

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame.
- Al emitir `onGameOver` el motor deja de actualizar; reinicia React vía `restart()`.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` solo con el juego activo y sin pausa.
- Pausa/blur/destroy limpian el mapa de teclas; al reanudar se reinicia `lastTime`; `dt` capado.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF, listeners y audio.
- Sin overlays de pausa ni game over dentro del canvas; se conserva el HUD dibujado del original.
- Audio (si aplica): `new Audio("/games/<id>/…")`, silenciado/detenido al pausar y destruir.
- Reglas del original a conservar literalmente: <constantes, tabla de puntos, velocidades>.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/asteroids/engine.ts`. Añadir `.cover-<id>` y migración con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` muestra la fila; `npm run build`.
2. <Copiar assets a `public/games/<id>/`.> Verificar: se sirven por URL.
3. Crear `lib/games/<id>/engine.ts` (port) y exportar `<id>Def`. Verificar: `npm run lint` y `npm run build`.
4. Registrar en `lib/games/registry.ts`. Verificar: `/games/<id>/jugar` carga el canvas (con `published=false` la ficha da 404; probar `/jugar`).
5. Verificación en navegador (Playwright o manual): partida hasta game over, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
6. `update games set published = true where id = '<id>'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`.
7. Actualizar `CLAUDE.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `<id>` con `published = true` y los metadatos del spec; `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta, la ficha `/games/<id>` y el home muestran el juego desde la BD (jugadores, controles, tags, dificultad correctos).
- [ ] `/games/<id>/jugar` muestra el canvas a <relación de aspecto> sin desborde a 375 px y 1280 px.
- [ ] <Controles: cada tecla/acción hace lo descrito; las teclas del juego no hacen scroll.>
- [ ] <Reglas de puntuación verificables: …>
- [ ] HUD de React refleja <puntaje, vidas?, nivel?, stats extra>.
- [ ] Pausa (botón y `P`) congela todo, incluido el audio; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input no mueve el juego.
- [ ] Guardar inserta en `scores` con `game_id = '<id>'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/<id>` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio.
- [ ] Desmontar cancela rAF, listeners y audio; sin dos loops en StrictMode.
- [ ] Asteroids sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/<id>/jugar`.
- [ ] `CLAUDE.md` lista el nuevo motor.

---

## Decisions

- <Sí/No con justificación breve: qué del original se conserva, qué se excluye y por qué.>
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                         | Mitigation                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| <Riesgos específicos del juego: input, audio autoplay, assets, rendimiento…> | <…>                                             |
| Doble loop / listeners por StrictMode.                                       | `destroy` idempotente; criterio de aceptación.  |
| Next 16 difiere del conocimiento previo.                                     | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- <Lista de exclusiones>

Cada uno, si llega, va en su propio spec.
```
