# SPEC 10 — Juego real: SNAKE (motor TS nuevo + canvas en React)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-13
> **Objective:** Crear un motor TypeScript de Snake con los sprites de fruta de `references/snake-assets/`, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/snake` y `/salon`.

---

## Por qué existe este spec

A diferencia de Asteroids, Tetris y Arkanoid, **no hay código original que portar**: `references/snake-assets/` solo trae `fruits.png` (3790×442, RGBA, fondo transparente) y `sprites.js` (`window.SPRITE_ATLAS` con 22 recortes `{ x, y, w, h }` de fruta en la fila `y = 136..295`). El motor se escribe desde cero siguiendo el patrón `createX(canvas, events) → GameController` de SPEC 05/07; las reglas de abajo las define este spec (Snake clásico) y no se inventan en implementación. `.cover-snake` ya existe en `app/globals.css` (de los prototipos), así que no se crea clase nueva.

Decisiones del usuario (no se reabren): `id` `snake`, título `SNAKE`, `cat` `ARCADE`, color `green`, `sort_order` 4, dificultad 2, tags `CLÁSICO` y `SERPIENTE`, 1 jugador, teclado. Canvas **600×600**, rejilla **20×20 de 30 px**. Reglas clásicas: **muro mortal, 1 vida, sin niveles**. Fruta **aleatoria** entre las 22, todas valen lo mismo. Sin sonido (no hay audio).

---

## Scope

**In:**

- Motor `lib/games/snake/engine.ts`: sin globals de módulo; exporta `snakeDef: GameEngineDef` con `createSnake(canvas, events) → GameController`.
- Módulo `lib/games/snake/sprites.ts`: port tipado de `sprites.js` (`FRUITS: Record<string, {x,y,w,h}>`, las 22 entradas literales) y helper `drawFruit(ctx, img, sprite, cellX, cellY, cell)` que dibuja el recorte contenido en la celda, centrado y sin deformar.
- Entrada `snake` en `lib/games/registry.ts`.
- Reutilizar `.cover-snake` existente en `app/globals.css`; verificar que se ve bien en tarjeta y ficha (retocar solo si no encaja).
- Migración `add_game_snake`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Asset `public/games/snake/fruits.png` (copia de `references/snake-assets/fruits.png`), cargado por instancia con `new Image()` (`src = "/games/snake/fruits.png"`).
- Canvas lógico **600×600** (1:1), rejilla 20×20, celda 30 px.
- HUD de React: puntaje, **1 vida** (baja a 0 al morir) y stat extra `length` ("LONGITUD", `int`). Sin nivel.
- Sin HUD nativo en el canvas (el original no existe): solo tablero, serpiente y fruta.
- Controles: `←↑→↓` y `WASD` giran la serpiente. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'snake'`.
- Actualizar `CLAUDE.md` (lista de motores).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe, HiDPI.
- Sonido y música.
- Frutas con puntos distintos, power-ups, obstáculos, modo sin muros (wrap), niveles o modos de dificultad.
- Selector de dificultad o velocidad.
- Animación suave entre celdas (la serpiente se mueve a saltos de celda).
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('snake', 'SNAKE', 'Come frutas y crece sin chocar.',
       'Guía a la serpiente con las flechas o WASD para comer frutas y crecer. Chocar con el muro o con tu propio cuerpo termina la partida; cada fruta suma 10 puntos y la serpiente se acelera a medida que comes.',
       'ARCADE', 'green', 'cover-snake', 1, 1, '{keyboard}', '{CLÁSICO,SERPIENTE}', 2, 4, false);

Definición del motor:

    export const snakeDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 1,
      stats: [{ key: "length", label: "LONGITUD", format: "int" }],
      create: createSnake,
    };

Estado interno (dentro de `createSnake`): `body: {x,y}[]` (cabeza en índice 0, coordenadas de celda 0–19), `dir`, `dirQueue` (máx. 2 giros pendientes), `fruit { x, y, sprite }`, `score`, `tickMs`, `acc`, `paused`, `finished`, `lastTime`, `rafId`, imagen de sprites, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("length", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("length", 3)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Victoria (la serpiente llena las 400 celdas): `onGameOver(score)` sin cambiar vidas; mismo comportamiento de parada.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa.
- Pausa/blur/destroy limpian la cola de giros; al reanudar se reinicia `lastTime` y `acc = 0`; `dt` capado (50 ms).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF, listeners (`keydown`, `blur`) y marca la carga de imagen como cancelada (`onload` tardío no arranca el loop).
- Sin overlays de pausa ni game over dentro del canvas.
- Mientras `fruits.png` no ha cargado, no se arranca el loop ni se emiten eventos; si falla la carga se registra `console.error` y el canvas queda en negro.
- Reglas definidas por este spec:
  - Inicio: serpiente de 3 segmentos, cabeza en (10,10), cuerpo hacia la izquierda, dirección derecha.
  - Paso por celda con acumulador: se avanza una celda cada `tickMs`. `tickMs` inicial **140**; baja **8 ms cada 5 frutas** comidas, mínimo **70**.
  - Giros: `dirQueue` admite 2 giros; se descarta un giro igual a la dirección actual o contraria a la última encolada (sin reversa de 180°).
  - Comer fruta: +**10** puntos, crece 1 segmento (la cola no se retira ese paso), `onStat("length", body.length)`, aparece nueva fruta con sprite aleatorio entre las 22 en una celda libre al azar.
  - Muerte: cabeza fuera de 0–19 en cualquier eje, o cabeza sobre un segmento del cuerpo (la celda que deja la cola en ese mismo paso cuenta como libre).
  - Dibujo: fondo `#000` con rejilla tenue; serpiente verde neón (`#39ff14` cabeza, `#1fae0c` cuerpo) con celdas de 28 px y margen 1 px; fruta con `drawFruit` contenida en la celda.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/arkanoid/engine.ts` / `sprites.ts` (patrón de carga de imagen por instancia). Añadir migración con `published = false` (`mcp__supabase__apply_migration`) y comprobar `.cover-snake`. Verificar: `execute_sql` muestra la fila; `npm run build`.
2. Copiar `fruits.png` a `public/games/snake/`. Verificar: se sirve en `/games/snake/fruits.png`.
3. Crear `lib/games/snake/sprites.ts` (atlas + `drawFruit`). Verificar: `npm run lint`.
4. Crear `lib/games/snake/engine.ts` y exportar `snakeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar en `lib/games/registry.ts`. Verificar: `/games/snake/jugar` carga el canvas (con `published=false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): comer varias frutas, morir por muro y por cuerpo, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'snake'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`.
8. Actualizar `CLAUDE.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `snake` con `published = true` y los metadatos del spec; `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta, la ficha `/games/snake` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`SERPIENTE`, dificultad 2, color verde).
- [ ] `/games/snake/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` giran la serpiente; las flechas no hacen scroll de la página.
- [ ] Un giro de 180° no se aplica; dos giros rápidos seguidos se ejecutan en pasos consecutivos.
- [ ] La partida empieza con 3 segmentos en (10,10) hacia la derecha, `tickMs` 140.
- [ ] Cada fruta comida suma exactamente 10 puntos, alarga la serpiente en 1 y genera una nueva fruta en una celda libre con sprite de las 22 del atlas.
- [ ] La velocidad sube cada 5 frutas (140 → 132 → …) y no baja de 70 ms por paso.
- [ ] Chocar con un muro o con el cuerpo abre el modal de puntaje; seguir la cola en el mismo paso no mata.
- [ ] El HUD de React refleja puntaje, vida (1 → 0) y LONGITUD (empieza en 3).
- [ ] Pausa (botón y `P`) congela serpiente y temporizador; reanudar sin salto ni paso doble.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (incluidas flechas y letras WASD) no mueve la serpiente.
- [ ] Guardar inserta en `scores` con `game_id = 'snake'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/snake` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, longitud 3, `tickMs` 140).
- [ ] Desmontar durante la carga de `fruits.png` o en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris y Arkanoid sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/snake/jugar`.
- [ ] `CLAUDE.md` lista el nuevo motor.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas de Snake clásico; **No:** buscar o portar código externo (el usuario solo aportó sprites).
- **Sí:** muro mortal, 1 vida, sin niveles (decisión del usuario). **No:** 3 vidas ni niveles.
- **Sí:** `initialLives: 1` (como Tetris) para que el HUD muestre la vida; **No:** `showLevel`, la velocidad es interna.
- **Sí:** stat extra `LONGITUD`. Es una derivación del estado (largo del cuerpo), útil como HUD pues no hay HUD nativo.
- **Sí:** fruta aleatoria cosmética, todas 10 puntos. **No:** puntos por fruta (inventaría balance).
- **Sí:** usar las 22 frutas del atlas literales; el recorte se dibuja contenido en la celda sin deformar (los sprites son 110–170×160, no cuadrados).
- **Sí:** aceleración 8 ms cada 5 frutas con mínimo 70 ms y cola de giros de 2 (valores de esta spec; ajustables solo editando el spec).
- **Sí:** dibujar serpiente con rectángulos neón; **No:** sprites de serpiente (no se proveyeron).
- **Sí:** `.cover-snake` existente; **No:** crear una clase nueva.
- **Sí:** `fruits.png` por instancia dentro del motor; **No:** globals de módulo (`window.SPRITE_ATLAS` desaparece).
- **No:** sonido, táctil/swipe, HiDPI (specs aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                   | Mitigation                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `fruits.png` pesa ~585 KB (3790×442) para dibujar 22 recortes.         | Se carga una vez por instancia; optimizarlo (recortar fila o WebP) queda para un spec posterior. |
| Recortes con `w`/`h` heredados de `sprites.js` pueden cortar la fruta. | Verificar visualmente las 22 en el paso 6; corregir coordenadas en `sprites.ts` si alguna falla. |
| Giros rápidos perdidos o reversa por doble tecla en un mismo tick.     | Cola de 2 giros y validación contra el último giro encolado.                                     |
| `onload` de la imagen llega tras `destroy` (StrictMode).               | Bandera `destroyed`; el callback no arranca el loop si está activa.                              |
| `dt` grande tras pausar o cambiar de pestaña provoca pasos múltiples.  | `lastTime` y `acc` se reinician al reanudar y tras blur; `dt` capado a 50 ms.                    |
| Letras WASD interfieren con el input del modal.                        | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.             |
| Colocar fruta con tablero casi lleno.                                  | Elegir al azar entre celdas libres (no reintentos); si no hay ninguna, es victoria.              |
| Doble loop / listeners por StrictMode.                                 | `destroy` idempotente; criterio de aceptación.                                                   |
| Next 16 difiere del conocimiento previo.                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                  |

---

## What is **not** in this spec

- Controles táctiles y móvil; HiDPI.
- Sonido y música.
- Puntos distintos por fruta, power-ups, obstáculos, modo wrap, niveles, selector de dificultad.
- Animación suave entre celdas y sprites de serpiente.
- HUD nativo dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
