# SPEC 08 — Juego real: TETRIS (port a TS + canvas en React)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-13
> **Objective:** Portar `references/templates/started-games/03-tetris/` a un motor TypeScript registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/tetris` y `/salon`.

---

## Por qué existe este spec

El original es Tetris en JS vanilla (`game.js`, 332 líneas) con globals de módulo, acceso directo al DOM (`getElementById` de `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `restart-btn`, `theme-toggle`), `localStorage` (`tetris-theme`) y un panel lateral HTML con HUD, "SIGUIENTE" y controles. Hay que adaptarlo al patrón `createX(canvas, events) → GameController` de SPEC 05/07 sin cambiar reglas, balance ni look de las piezas. Incluye la pieza extra **N (tuerca)** (3×3 con hueco, color `#9e9e9e`): se conserva.

Decisiones del usuario (no se reabren): `id` `tetris`, título `TETRIS`, `cat` `PUZZLE`, color `magenta`, `sort_order` 2, dificultad 3, tags `CLÁSICO` y `LÍNEAS`, solo teclado, 1 jugador. El HUD de la plataforma muestra **vidas** con **una sola vida** (`initialLives: 1`) y **nivel** (`showLevel: true`). Se **conserva el HUD nativo del Tetris** (panel lateral con SCORE, LINES, LEVEL, NEXT y CONTROLS) dibujado dentro del canvas, además del HUD de la plataforma en React (doble HUD, como en SPEC 05). Se excluyen tema claro, overlays propios y botón Reiniciar.

---

## Scope

**In:**

- Motor `lib/games/tetris/engine.ts`: port de `game.js` sin globals de módulo; exporta `tetrisDef: GameEngineDef` con `createTetris(canvas, events) → GameController`.
- Entrada `tetris` en `lib/games/registry.ts`.
- Clase `.cover-tetris` en `app/globals.css`.
- Migración `add_game_tetris`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Sin assets (el original no tiene imágenes ni audio).
- Canvas lógico **480×600**: tablero 300×600 (10×20, `BLOCK = 30`) a la izquierda, hueco de 20 px y panel nativo de 160 px a la derecha (misma disposición que `.game-container` y `.panel` del original). Relación de aspecto 4:5.
- **HUD nativo del juego, dibujado en canvas** con el mismo orden y textos del original: `SCORE` (valor con `toLocaleString()`), `LINES`, `LEVEL`, `NEXT` (caja 120×120 con borde `#2a2a3a` y fondo `#1a1a25`, pieza en cuadrícula 4×4 de bloques de 30 px, como `next-canvas`) y `CONTROLS` (`← →` mover, `↑` rotar, `↓` bajar, `Space` caída, `P` pausa). Estilo del CSS original: labels 10 px `#555570` con espaciado 2 px; valores monospace 26 px bold `#7aa2f7`; controles 12 px `#888` con teclas sobre fondo `#22223a` y borde `#3a3a5a`.
- HUD de React (de la plataforma, adicional al nativo): puntaje, **vidas** (1; pasa a 0 al perder), **nivel** y stat extra `LÍNEAS` (`key: "lines"`, `format: "int"`).
- Controles: `←`/`→` mover, `↑` o `X` rotar (horario con wall kicks), `↓` soft drop, `Espacio` hard drop. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'tetris'`.
- Actualizar `CLAUDE.md` (lista de motores).

**Out of scope (para specs futuras):**

- Controles táctiles, HiDPI.
- Tema claro/oscuro (`tetris-theme` en `localStorage`) y su botón: el motor usa solo la paleta oscura.
- Panel como HTML/DOM fuera del canvas, título "TETRIS" del original, overlays de pausa/game over del original, botón "Reiniciar" propio.
- Cambios de reglas, balance o look (piezas, colores, puntuación, velocidades).
- Más de una vida, hold piece, 7-bag, SRS u otras mecánicas modernas.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('tetris', 'TETRIS', 'Encaja las piezas y completa líneas.',
       'Rota y encaja piezas que caen en un tablero de 10×20. Completa líneas para sumar puntos; cada 10 líneas sube el nivel y la caída se acelera. Incluye la pieza N (tuerca) y pieza fantasma.',
       'PUZZLE', 'magenta', 'cover-tetris', 1, 1, '{keyboard}', '{CLÁSICO,LÍNEAS}', 3, 2, false);

Definición del motor:

    export const tetrisDef: GameEngineDef = {
      width: 480, height: 600,
      initialLives: 1,
      showLevel: true,
      stats: [{ key: "lines", label: "LÍNEAS", format: "int" }],
      create: createTetris,
    };

Estado interno (dentro de `createTetris`): `board: number[][]` (20×10, `0` vacío, `1–8` índice de color), `current`/`next: { type, shape, x, y }`, `score`, `lines`, `level`, `dropInterval`, `dropAccum`, `lastTime`, `paused`, `gameOver`, mapa de teclas no necesario (el original reacciona a `keydown`, no a estado de teclas).

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("lines", n)` y `onLives`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("lines", 0)`.
- Game over (spawn que colisiona): `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. Reinicia React vía `restart()`.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en `ArrowLeft/Right/Up/Down` y `Space` solo con el juego activo y sin pausa.
- Pausa/blur/destroy: al pausar se detiene el rAF; al reanudar se reinicia `lastTime` (y `dropAccum` se conserva); `dt` capado (50 ms por frame de acumulación). `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners.
- Sin overlays de pausa ni game over dentro del canvas; se conserva el dibujo del tablero, cuadrícula, bloques, pieza fantasma y el panel nativo (SCORE, LINES, LEVEL, NEXT, CONTROLS).
- Doble HUD: el panel del canvas y el HUD de React salen del mismo estado del motor, así que no se desincronizan; el panel se repinta en cada frame y no emite eventos adicionales.
- Fondo: el canvas pinta `#1a1a25` (antes `--canvas-bg` por CSS) y la cuadrícula `#22222e` (antes `--grid-line`), grosor 0.5.
- Reglas del original a conservar literalmente:
  - `COLS = 10`, `ROWS = 20`, `BLOCK = 30`.
  - `COLORS` (I `#4dd0e1`, O `#ffd54f`, T `#ba68c8`, S `#81c784`, Z `#e57373`, J `#90caf9`, L `#ffb74d`, N `#9e9e9e`) y matrices `PIECES` (incluida la N).
  - Pieza aleatoria uniforme entre los 8 tipos (`Math.floor(Math.random()*8)+1`); aparece en `x = floor(COLS/2) - floor(ancho/2)`, `y = 0`.
  - `LINE_SCORES = [0, 100, 300, 500, 800]` × `level`.
  - Hard drop: +2 por celda; soft drop: +1 solo si la pieza baja (si no puede, fija); la caída automática no suma.
  - `level = floor(lines/10) + 1`; `dropInterval = max(100, 1000 - (level-1)*90)` ms, inicial 1000.
  - Wall kicks `[0, -1, 1, -2, 2]` en `tryRotate`.
  - Pieza fantasma con `globalAlpha = 0.2`; resaltado de bloque `rgba(255,255,255,0.12)` de 4 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/asteroids/engine.ts`. Añadir `.cover-tetris` y migración con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` muestra la fila; `npm run build`.
2. Crear `lib/games/tetris/engine.ts` (port) y exportar `tetrisDef`. Verificar: `npm run lint` y `npm run build`.
3. Registrar en `lib/games/registry.ts`. Verificar: `/games/tetris/jugar` carga el canvas (con `published=false` la ficha da 404; probar `/jugar`).
4. Verificación en navegador (Playwright o manual): partida hasta game over, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
5. `update games set published = true where id = 'tetris'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`.
6. Actualizar `CLAUDE.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `tetris` con `published = true` y los metadatos del spec; `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta, la ficha `/games/tetris` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`LÍNEAS`, dificultad 3).
- [ ] `/games/tetris/jugar` muestra el canvas a 4:5 (tablero + panel nativo) sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` mueven, `↑` y `X` rotan, `↓` baja una fila, `Espacio` hace caída instantánea; las flechas y el espacio no hacen scroll de la página.
- [ ] Hard drop suma 2 por celda recorrida; soft drop suma 1 por fila bajada; 1/2/3/4 líneas suman 100/300/500/800 × nivel.
- [ ] Cada 10 líneas sube el nivel y la caída se acelera según `max(100, 1000 - (level-1)*90)`.
- [ ] Aparecen las 8 piezas, incluida la N (tuerca gris), la pieza fantasma y la vista NEXT actualizada tras cada fijado.
- [ ] El panel nativo del canvas muestra SCORE, LINES, LEVEL, NEXT y CONTROLS, y sus valores coinciden en todo momento con el HUD de React.
- [ ] El HUD de React refleja puntaje, 1 vida (pasa a 0 en game over), nivel y `LÍNEAS`.
- [ ] Pausa (botón y `P`) congela caída y teclas; reanudar sin salto de la pieza.
- [ ] FIN y game over natural (pieza que no cabe al aparecer) abren el modal con el puntaje correcto; teclear en el input (incluido Espacio) no mueve el juego.
- [ ] Guardar inserta en `scores` con `game_id = 'tetris'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/tetris` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (tablero vacío, puntaje 0, nivel 1, líneas 0, 1 vida).
- [ ] Desmontar cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/tetris/jugar`.
- [ ] `CLAUDE.md` lista el nuevo motor.

---

## Decisions

- **Sí:** port fiel de reglas, puntuación, velocidades, colores y pieza N. **No:** retocar balance ni piezas modernas.
- **Sí:** `initialLives: 1`. Decisión del usuario: la plataforma muestra vidas en todos los juegos; Tetris tiene una sola. Game over natural emite `onLives(0)`.
- **Sí:** `showLevel: true` y stat `LÍNEAS`. El nivel y las líneas ya existían en el HUD original; `LÍNEAS` es mi interpretación de la respuesta ("nivel" y vidas); si no se quiere, quitar la entrada de `stats` y `onStat`.
- **Sí:** conservar el HUD nativo (SCORE, LINES, LEVEL, NEXT, CONTROLS) dibujado en canvas, además del HUD de React. Decisión del usuario; ancho lógico 480 (tablero 300 + hueco 20 + panel 160), panel lateral y no superpuesto para no tapar las piezas al aparecer. **No:** panel HTML fuera del canvas ni `next-canvas` separado (el contrato `GameEngineDef` solo entrega un canvas).
- **No:** tema claro, selector de tema, `localStorage` `tetris-theme`. Paleta oscura fija (colores del CSS original codificados en el motor).
- **No:** overlay de pausa/game over ni botón Reiniciar dentro del canvas; los muestra la plataforma. La pausa la gestiona React (botón y `P`).
- **Sí:** conservar el autorepeat nativo de `keydown` (el original no lo filtra).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** controles táctiles ni HiDPI (spec aparte).
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                   | Mitigation                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Autorepeat de `↓`/`Espacio` encadena hard drops no deseados.           | Comportamiento heredado del original; no se altera. Verificar en pruebas manuales.               |
| `P` y teclas del juego interfieren con el input del modal.             | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.             |
| `dt` enorme tras pausar o cambiar de pestaña provoca caídas múltiples. | Reiniciar `lastTime` al reanudar y tras blur; capar `dt`.                                        |
| Lint de React 19 rechaza el patrón de montaje.                         | Ya resuelto en `GameCanvas` (SPEC 07); el motor no toca estado de React.                         |
| Canvas 480×600 se ve pequeño/alto en móvil.                            | Escala CSS por `--game-ar`; criterio de aceptación a 375 px. Táctil y layout móvil, spec futuro. |
| Doble loop / listeners por StrictMode.                                 | `destroy` idempotente; criterio de aceptación.                                                   |
| Next 16 difiere del conocimiento previo.                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                  |

---

## What is **not** in this spec

- Controles táctiles y móvil; HiDPI.
- Tema claro y su persistencia.
- Más vidas, hold, 7-bag, SRS, nuevas mecánicas o rebalanceo.
- Sonido y música (el original no tiene).
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
