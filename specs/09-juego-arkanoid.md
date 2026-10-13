# SPEC 09 — Juego real: ARKANOID (port a TS + canvas en React)

> **Status:** Aprovado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-13
> **Objective:** Portar `references/started-games/04-arkanoid/` a un motor TypeScript registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/arkanoid` y `/salon`.

---

## Por qué existe este spec

El original es Arkanoid en JS vanilla con tres scripts globales: `game.js` (~250 líneas), `levels.js` (`LEVELS`, 5 niveles) y `assets/spritesheet.js` (`loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`). Usa globals de módulo, `document.getElementById('game')`, listeners en `document` y `canvas`, `new Audio('assets/sounds/…')` y `requestAnimationFrame` sin cancelación. Pausa (`P`/`Escape`), overlay de pausa con selector de nivel, overlay de game over y overlay de victoria están dentro del canvas. Hay que adaptarlo al patrón `createX(canvas, events) → GameController` de SPEC 05/07 sin cambiar reglas, balance ni look.

Decisiones del usuario (no se reabren): `id` `arkanoid`, título `ARKANOID`, `cat` `ARCADE`, color `yellow`, `sort_order` 3, dificultad 2, tags `CLÁSICO` y `ROMPEBLOQUES`, 1 jugador, teclado y mouse. El HUD de la plataforma muestra puntaje, **3 vidas** y **nivel**, sin stats extra. Se **conserva el HUD nativo** (`Score`, `Nivel`, bolas de vidas) dibujado en el canvas, además del HUD de React (doble HUD, como en SPEC 05/08). Se excluyen el selector de nivel de la pausa, `Escape` como pausa y los overlays propios. Se incluye el sonido.

---

## Scope

**In:**

- Motor `lib/games/arkanoid/engine.ts`: port de `game.js` sin globals de módulo; exporta `arkanoidDef: GameEngineDef` con `createArkanoid(canvas, events) → GameController`.
- Módulo `lib/games/arkanoid/levels.ts`: port literal de `levels.js` (`LEVELS`, 5 niveles con `speed` y `blocks`).
- Módulo `lib/games/arkanoid/sprites.ts`: port de `spritesheet.js` (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`) con carga de imagen por instancia (sin `ssImg`/`ssLoaded` globales) y helpers `drawSprite`/`drawFrame` que reciben el sprite cargado.
- Entrada `arkanoid` en `lib/games/registry.ts`.
- Clase `.cover-arkanoid` en `app/globals.css`.
- Migración `add_game_arkanoid`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Assets copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`, `ball-bounce.mp3`, `break-sound.mp3`. Se cargan con `new Image()` (`src = "/games/arkanoid/spritesheet-breakout.png"`) y `new Audio("/games/arkanoid/…")`.
- Canvas lógico **800×600** (relación 4:3).
- HUD de React: puntaje, **vidas** (3; baja al perder la bola), **nivel** (1–5). Sin stats extra.
- HUD nativo en canvas, como en el original: `Score: N` (izquierda), `Nivel: N` (centro), una bola por vida (derecha), todo mientras se juega.
- Controles: `←`/`→` mueven la paleta (400 px/s) y el mouse sobre el canvas la centra bajo el cursor. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'arkanoid'`.
- Actualizar `CLAUDE.md` (lista de motores).

**Out of scope (para specs futuras):**

- Controles táctiles, HiDPI.
- Selector de nivel en pausa (clics en botones 1–5): permitiría saltar niveles y falsear el leaderboard.
- `Escape` como tecla de pausa (la pausa la gestiona React con botón y `P`).
- Overlays propios de pausa, game over y victoria dentro del canvas.
- Cambios de reglas, balance o look (bloques, velocidades, puntuación, explosiones).
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('arkanoid', 'ARKANOID', 'Rompe todos los bloques con la pelota.',
       'Mueve la paleta con las flechas o el mouse para que la pelota no caiga y destruye todos los bloques. Cinco niveles con patrones distintos y una pelota cada vez más rápida; 10 puntos por bloque y 3 vidas.',
       'ARCADE', 'yellow', 'cover-arkanoid', 1, 1, '{keyboard}', '{CLÁSICO,ROMPEBLOQUES}', 2, 3, false);

`controls` solo admite `keyboard | touch | gamepad` (`games_controls_check`); el mouse se menciona en `long` y no se añade valor al CHECK (sin cambios de esquema).

Definición del motor:

    export const arkanoidDef: GameEngineDef = {
      width: 800, height: 600,
      initialLives: 3,
      showLevel: true,
      create: createArkanoid,
    };

Estado interno (dentro de `createArkanoid`): `paddle { x, y: 560, w: 81, h: 14 }`, `ball { x, y, w: 16, h: 16, vx, vy }`, `blocks: { x, y, w, h, color, alive }[]`, `explosions: { x, y, w, h, color, elapsed }[]`, `lives`, `score`, `currentLevel`, `keys { ArrowLeft, ArrowRight }`, `paused`, `finished`, `lastTime`, `rafId`, imagen de sprites y dos `HTMLAudioElement`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`.
- Game over (vidas llegan a 0): `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas y mouse. El último frame queda en el canvas.
- Victoria (se limpia el nivel 5): `onGameOver(score)` sin cambiar vidas; mismo comportamiento de parada. La plataforma lo trata como fin de partida con el puntaje conseguido (máximo teórico: 10 × bloques totales de los 5 niveles).
- Al pasar de nivel se emite `onLevel(n)` y se recarga el nivel como en `loadLevel` (bola sobre la paleta, velocidad del nivel, explosiones vaciadas). Puntaje y vidas se conservan.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en `ArrowLeft/Right` solo con el juego activo y sin pausa.
- El mouse (`mousemove` en el canvas) solo mueve la paleta con el juego activo y sin pausa; usa `getBoundingClientRect` y escala `canvas.width / rect.width`.
- Pausa/blur/destroy limpian el mapa de teclas; al reanudar se reinicia `lastTime`; `dt` capado (50 ms). Pausar detiene el rAF y los audios en curso.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF, listeners (`keydown`, `keyup`, `blur`, `mousemove`), detiene el audio y marca la carga de imagen como cancelada (`onload` tardío no arranca el loop).
- Sin overlays de pausa ni game over dentro del canvas; se conserva el HUD nativo (`Score`, `Nivel`, bolas de vida).
- Mientras el spritesheet no ha cargado, no se arranca el loop ni se emiten eventos; si falla la carga se registra `console.error` y el canvas queda en negro.
- Audio: `bounce.cloneNode().play()` / `break.cloneNode().play()` como en el original, con `catch` de la promesa (autoplay). Con la partida en pausa o terminada no se dispara sonido.
- Reglas del original a conservar literalmente:
  - Paleta 81×14 en `y = 560`, centrada al iniciar; `PADDLE_SPEED = 400` px/s.
  - Bola 16×16; `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, multiplicadas por `LEVELS[n-1].speed` (1.00, 1.10, 1.21, 1.33, 1.46).
  - Bloques 64×24 en rejilla 10 cols, origen `x = (800 - 10*64)/2`, `y = 80`.
  - `LEVELS` (patrones, colores por fila, huecos de nivel 4, marco+cruz de nivel 5) tal cual `levels.js`.
  - +10 puntos por bloque; un bloque por frame (`break`); invierte `vy` al golpear un bloque.
  - Rebote en paredes izquierda/derecha/techo; rebote en paleta si `vy > 0` y `ball.y + ball.h` entre `paddle.y` y `paddle.y + paddle.h + 8`, con `vy = -|vy|` (sin ángulo según el punto de impacto).
  - Bola perdida (`ball.y > canvas.height`): `lives--`; si quedan vidas, `initBall()` (bola sobre la paleta, lanzada de inmediato).
  - Explosión de 4 frames durante `EXPLOSION_DURATION = 150` ms, `frameIndex = min(floor(elapsed / 150 * 4), 3)`.
  - HUD nativo: `bold 18px monospace`, blanco, `Score:` en (10,10) a la izquierda, `Nivel:` centrado en y=10, bolas de 16 px con separación de 4 px alineadas a la derecha.
  - Fondo del canvas `#000`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/asteroids/engine.ts`. Añadir `.cover-arkanoid` y migración con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` muestra la fila; `npm run build`.
2. Copiar assets a `public/games/arkanoid/` (png y los dos mp3). Verificar: se sirven por URL (`/games/arkanoid/spritesheet-breakout.png`).
3. Crear `lib/games/arkanoid/levels.ts` y `lib/games/arkanoid/sprites.ts` (port literal, tipado). Verificar: `npm run lint`.
4. Crear `lib/games/arkanoid/engine.ts` (port) y exportar `arkanoidDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar en `lib/games/registry.ts`. Verificar: `/games/arkanoid/jugar` carga el canvas (con `published=false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): partida hasta game over, pasar al menos un nivel, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'arkanoid'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`.
8. Actualizar `CLAUDE.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `arkanoid` con `published = true` y los metadatos del spec; `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta, la ficha `/games/arkanoid` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`ROMPEBLOQUES`, dificultad 2).
- [ ] `/games/arkanoid/jugar` muestra el canvas a 4:3 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` mueven la paleta; el mouse sobre el canvas la centra bajo el cursor; las flechas no hacen scroll de la página.
- [ ] Cada bloque roto suma exactamente 10 puntos y dispara la explosión de 4 frames y el sonido de rotura.
- [ ] La bola rebota en paredes, techo y paleta con sonido de rebote; al caer resta una vida y reaparece sobre la paleta.
- [ ] Limpiar un nivel carga el siguiente con su patrón y velocidad (1.00 → 1.46); el HUD de React muestra el nivel 1–5.
- [ ] Limpiar el nivel 5 abre el modal de puntaje con el puntaje acumulado.
- [ ] Perder las 3 vidas abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0) y nivel, y coincide con el HUD nativo del canvas.
- [ ] Pausa (botón y `P`) congela bola, explosiones y teclas, y silencia el audio; reanudar sin salto de la bola; `Escape` no pausa.
- [ ] FIN abre el modal con el puntaje correcto; teclear en el input (incluidas las flechas) no mueve la paleta.
- [ ] Guardar inserta en `scores` con `game_id = 'arkanoid'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/arkanoid` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (nivel 1, puntaje 0, 3 vidas, bloques completos).
- [ ] Desmontar durante la carga del spritesheet o en juego cancela rAF, listeners y audio; sin dos loops en StrictMode.
- [ ] Asteroids y Tetris sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/arkanoid/jugar`.
- [ ] `CLAUDE.md` lista el nuevo motor.

---

## Decisions

- **Sí:** port fiel de reglas, puntuación, velocidades, patrones de nivel y sprites. **No:** ángulo de rebote según el impacto en la paleta ni otras mejoras de jugabilidad.
- **Sí:** `initialLives: 3` y `showLevel: true`, tal como el original (3 vidas, 5 niveles). **No:** stats extra; el usuario no los pidió.
- **Sí:** conservar el HUD nativo (`Score`, `Nivel`, bolas) además del HUD de React. Decisión del usuario; ambos salen del mismo estado del motor.
- **Sí:** victoria al limpiar el nivel 5 = `onGameOver(score)` sin tocar vidas. El contrato no tiene evento de "victoria"; reutilizar `onGameOver` evita ampliarlo.
- **No:** selector de nivel en pausa. Permite saltar niveles (trampa en el leaderboard) y exige UI de canvas sobre una pausa que ahora gestiona React.
- **No:** `Escape` pausa. La pausa de plataforma es botón y `P`.
- **No:** overlays de pausa, game over y victoria del original; los muestra la plataforma.
- **Sí:** incluir sonido con los dos mp3 en `public/games/arkanoid/`, conservando `cloneNode().play()`; **No:** música ni mute propio.
- **Sí:** `controls = {keyboard}`; el mouse se documenta en `long`. **No:** ampliar el CHECK `games_controls_check` (cambio de esquema fuera de alcance).
- **Sí:** carga del spritesheet por instancia dentro del motor; **No:** globals de módulo (`ssImg`, `ssLoaded`, `ssCallbacks`), ya que `destroy` y StrictMode los dejarían en estado inconsistente.
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** controles táctiles ni HiDPI (spec aparte).
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                            | Mitigation                                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Autoplay del navegador bloquea el audio antes de la primera interacción.        | `play()` con `catch`; el juego arranca tras interacción del usuario (botón/teclado) en la mayoría de casos. |
| `onload` del spritesheet llega tras `destroy` (StrictMode monta y desmonta).    | Bandera `destroyed`; el callback no arranca el loop si está activa.                                         |
| Sprites escalados se ven borrosos o con bordes.                                 | Desactivar `imageSmoothingEnabled` solo si el original lo hacía; por defecto, mantener el original.         |
| Bola atraviesa bloques o paleta a `dt` grande tras pausar o cambiar de pestaña. | Reiniciar `lastTime` al reanudar y tras blur; capar `dt` a 50 ms.                                           |
| Mouse sigue moviendo la paleta en pausa o game over.                            | El handler de `mousemove` comprueba `paused` y `finished`.                                                  |
| `P` y flechas interfieren con el input del modal.                               | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                        |
| Muchos `cloneNode().play()` simultáneos acumulan elementos de audio.            | Comportamiento heredado; sonidos cortos, el GC los libera. Detener audio en `destroy`.                      |
| Canvas 800×600 pequeño en móvil.                                                | Escala CSS por `--game-ar`; criterio de aceptación a 375 px. Táctil y layout móvil, spec futuro.            |
| Doble loop / listeners por StrictMode.                                          | `destroy` idempotente; criterio de aceptación.                                                              |
| Next 16 difiere del conocimiento previo.                                        | Paso 1 consulta `node_modules/next/dist/docs/`.                                                             |

---

## What is **not** in this spec

- Controles táctiles y móvil; HiDPI.
- Selector de nivel en pausa y `Escape` como pausa.
- Overlays de pausa, game over y victoria dentro del canvas.
- Ángulo de rebote variable, power-ups, nuevos niveles o rebalanceo.
- Stats extra en el HUD de React.
- Cambios de esquema Supabase (incluido el CHECK de `controls`) o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
