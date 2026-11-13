# SPEC GJ-2048-01 — Juego real: 2048 (variante: clásico fiel) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-13
> **Variant:** 01 de 2 — 2048 clásico fiel: tablero 4×4, sin límite de tiempo, puntaje = suma de las fusiones, termina cuando no queda ningún movimiento.
> **Objective:** Crear un motor TypeScript de 2048 (variante clásica) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/2048` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de 2048. Es el juego tal como se conoce: deslizar todas las fichas en una de 4 direcciones, fusionar pares iguales y sobrevivir hasta que el tablero se bloquea. No hay reloj, ni combos, ni presión extra: el reto es puramente de planificación. Se distingue de la variante 02 (contrarreloj con combos, bonus de tiempo y aparición creciente de fichas, que acorta la partida y premia la velocidad).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos redondeados y texto de Canvas 2D. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-2048`.

Decisiones fijadas por el agente (no se reabren): `id` `2048`, título `2048`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus variantes propuestas), dificultad 2, tags `CLÁSICO` y `NÚMEROS`, 1 jugador, teclado. Canvas **500×500** (1:1), tablero **4×4**, celda **105 px** con separación **16 px**. **1 vida** (`initialLives: 1`), sin niveles, stats extra `FICHA MÁX` y `MOVIMIENTOS`. Llegar a 2048 **no** termina la partida (se sigue jugando). Sin sonido, sin imágenes.

Como el `id` empieza por dígito: la clave en `ENGINES` va entre comillas (`"2048"`), los identificadores TS llevan prefijo (`game2048Def`, `create2048`) y la carpeta es `lib/games/2048/`.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/2048/engine.ts`: sin globals de módulo; exporta `game2048Def: GameEngineDef` con `create2048(canvas, events) → GameController`.
- Módulo `lib/games/2048/board.ts`: funciones puras sin estado (`emptyBoard()`, `slide(board, dir) → { board, moved, gained, merges, moves }`, `canMove(board)`, `emptyCells(board)`, `spawnTile(board, rand)`, `maxTile(board)`). `board` es `number[16]` (0 = vacía), índice `fila × 4 + columna`.
- Módulo `lib/games/2048/draw.ts`: `drawBoard`, `drawTile(ctx, value, x, y, scale)` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"2048"` en `lib/games/registry.ts`.
- Clase `.cover-2048` en `app/globals.css`: fondo `linear-gradient(135deg,#001a2a,#0a0a18)` con `::after` que dibuja un mosaico 2×2 de fichas redondeadas (cyan `#00f5ff`, amarillo `#ffe600`, magenta `#ff2bd6`, blanco) mediante `linear-gradient` múltiples, centrado y con `box-shadow` cyan tenue.
- Migración `add_game_2048`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **500×500**.
- HUD de React: puntaje, **1 vida** (baja a 0 al bloquearse el tablero), stats extra `tile` ("FICHA MÁX", `int`) y `moves` ("MOVIMIENTOS", `int`). Sin nivel.
- Sin HUD nativo en el canvas: solo tablero y fichas.
- Controles: `←↑→↓` y `WASD` deslizan las fichas. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = '2048'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `2048`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deshacer, guardado de partida en curso, tamaños de tablero distintos de 4×4.
- Temporizador, combos, bonus de tiempo y aparición múltiple de fichas (son de la variante 02).
- Pantalla o mensaje de "has ganado" al llegar a 2048.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('2048', '2048', 'Desliza, fusiona y llega a 2048.',
       'Desliza todas las fichas con las flechas o WASD. Dos fichas iguales que chocan se fusionan en una del doble de valor y suman ese valor a tu puntaje. Tras cada movimiento aparece una ficha nueva; la partida termina cuando el tablero está lleno y no queda ninguna fusión posible. Llegar a 2048 es solo el comienzo.',
       'PUZZLE', 'cyan', 'cover-2048', 1, 1, '{keyboard}', '{CLÁSICO,NÚMEROS}', 2, 7, false);

Definición del motor:

    export const game2048Def: GameEngineDef = {
      width: 500, height: 500,
      initialLives: 1,
      stats: [
        { key: "tile", label: "FICHA MÁX", color: "yellow", format: "int" },
        { key: "moves", label: "MOVIMIENTOS", color: "cyan", format: "int" },
      ],
      create: create2048,
    };

Estado interno (dentro de `create2048`): `board: number[16]`, `score`, `moves`, `best` (ficha máxima), `anim { kind: "slide" | "pop", t, moves, merges, spawned } | null`, `pendingDir: Dir | null` (buffer de 1 movimiento), `paused`, `finished`, `overPending` (game over pendiente de fin de animación), `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("tile", n)`, `onStat("moves", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("tile", maxTile(board))` (2 o 4) y `onStat("moves", 0)` (valor 0 oculta el stat; esperado al inicio).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (tablero bloqueado) queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Se ignora `e.repeat` (un movimiento por pulsación).
- Pausa/blur/destroy limpian `pendingDir`; en pausa se cancela el rAF (SPEC 13) y al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 4×4. Origen del tablero en (0, 0); celda `(c, f)` en `x = 16 + c × 121`, `y = 16 + f × 121`, tamaño 105×105.
- **Inicio:** tablero vacío + 2 fichas generadas con `spawnTile`.
- **Generación (`spawnTile`):** celda vacía elegida al azar uniforme entre las libres; valor **2** con probabilidad **0.9**, **4** con **0.1**.
- **Movimiento:** `←/A`, `→/D`, `↑/W`, `↓/S`. Todas las fichas se desplazan hasta el borde en esa dirección. Cada línea se procesa desde el borde de destino: dos fichas iguales consecutivas (ignorando vacías) se fusionan en una de valor doble; **cada ficha participa como máximo en una fusión por movimiento**. Ejemplos con `←`: `[2,2,2,2] → [4,4,0,0]`; `[2,2,2,0] → [4,2,0,0]`; `[4,4,8,0] → [8,8,0,0]`; `[2,0,0,2] → [4,0,0,0]`; `[8,4,4,4] → [8,8,4,0]`.
- **Movimiento válido:** solo si cambia al menos una celda (`moved = true`). Un movimiento inválido no suma `moves`, no genera ficha ni anima.
- **Tras un movimiento válido:** `score += gained` (suma de los valores resultantes de todas las fusiones del movimiento), `moves += 1`, se genera **1** ficha nueva, se actualiza `best` y se emiten los eventos que hayan cambiado.
- **Puntos:** exactamente la suma de las fichas creadas por fusión (fusión de 2+2 = +4, de 1024+1024 = +2048). No hay otros puntos.
- **2048:** alcanzarla solo actualiza FICHA MÁX; la partida continúa sin mensaje.
- **Game over:** después de generar la ficha nueva, si `canMove(board)` es falso (sin celdas vacías y sin dos vecinas ortogonales iguales) → `overPending = true`; al terminar la animación en curso se emiten `onLives(0)` y `onGameOver(score)`.
- **Animación (solo visual, la lógica ya está aplicada):** deslizamiento lineal **90 ms** desde la celda origen a la destino; luego "pop" **120 ms**: fichas fusionadas escalan 1 → 1.15 → 1 y la ficha nueva 0 → 1. Total 210 ms.
- **Buffer de entrada:** una tecla pulsada durante la animación se guarda en `pendingDir` (sustituye a la anterior, máx. 1) y se aplica al terminar la animación.
- **Dibujo:** fondo del canvas `#0a0a18`; marco del tablero `#1f1f3a` (radio 12); celda vacía `#141428` (radio 8); fichas con radio 8 y número centrado en fuente monoespaciada bold (48 px para 1–2 cifras, 40 px para 3, 32 px para 4, 26 px para 5 o más). Paleta (`fondo / texto`): 2 `#12324a / #7fe9ff`; 4 `#123f5a / #a6f3ff`; 8 `#00a8c6 / #001018`; 16 `#00f5ff / #001018`; 32 `#39ff14 / #001a00`; 64 `#b6ff00 / #102000`; 128 `#ffe600 / #201a00`; 256 `#ffb000 / #201000`; 512 `#ff6a00 / #200800`; 1024 `#ff2bd6 / #ffffff`; 2048 `#ffffff / #ff2bd6`; mayores `#9b5cff / #ffffff`. Desde 128, `shadowBlur` 16 con el color de fondo de la ficha.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-2048` en `app/globals.css`. Aplicar migración `add_game_2048` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = '2048'` muestra la fila; `npm run build`.
2. Crear `lib/games/2048/board.ts`. Verificar: `npm run lint`; con `←`, `slide` da `[2,2,2,2] → [4,4,0,0]` (`gained` 8), `[2,2,2,0] → [4,2,0,0]` (`gained` 4), `[8,4,4,4] → [8,8,4,0]`, `[2,4,8,16]` sin cambio (`moved = false`); `canMove` es falso para un tablero lleno sin vecinos iguales.
3. Crear `lib/games/2048/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/2048/engine.ts` y exportar `game2048Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"2048"` en `lib/games/registry.ts`. Verificar: `/games/2048/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover en las 4 direcciones, fusiones correctas (incluido `[2,2,2,2]`), movimiento inválido sin ficha nueva, buffer durante la animación, MOVIMIENTOS y FICHA MÁX en el HUD, forzar bloqueo del tablero, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = '2048'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `2048` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-2048`), la ficha `/games/2048` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`NÚMEROS`, dificultad 2, color cyan, categoría PUZZLE).
- [ ] `/games/2048/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con exactamente 2 fichas (2 o 4) en celdas distintas.
- [ ] `←↑→↓` y `WASD` deslizan las fichas; las flechas no hacen scroll; mantener pulsada una tecla no repite el movimiento.
- [ ] `[2,2,2,2]` hacia `←` queda `[4,4,0,0]` y suma 8 puntos; ninguna ficha se fusiona dos veces en un movimiento.
- [ ] Cada fusión suma exactamente el valor de la ficha resultante; no hay otros puntos.
- [ ] Un movimiento que no cambia el tablero no genera ficha, no anima y no suma MOVIMIENTOS.
- [ ] Cada movimiento válido genera exactamente 1 ficha nueva (2 con 90 %, 4 con 10 %) en una celda vacía.
- [ ] La animación dura 210 ms (90 deslizamiento + 120 pop); una tecla durante ella se aplica al terminar (máx. 1 en buffer).
- [ ] Llegar a 2048 no detiene la partida; FICHA MÁX muestra 2048.
- [ ] Con el tablero lleno y sin fusiones posibles, al acabar la animación se emite `onLives(0)` y luego `onGameOver` y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), FICHA MÁX y MOVIMIENTOS; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela animación y entrada (rAF detenido); reanudar sin salto ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y `WASD`) no mueve fichas.
- [ ] Guardar inserta en `scores` con `game_id = '2048'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/2048` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 2 fichas, MOVIMIENTOS 0, sin buffer ni animación).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/2048/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con las reglas clásicas de 2048; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** lógica de tablero pura en `board.ts`; permite verificar las fusiones a mano sin canvas.
- **Sí:** `id` `2048` (nombre reconocible); **Sí:** prefijos `game2048Def`/`create2048` porque un identificador TS no puede empezar por dígito.
- **Sí:** `initialLives: 1` (como Tetris/Snake) para que el HUD muestre la vida; **No:** `showLevel`, no hay niveles.
- **Sí:** stats `FICHA MÁX` y `MOVIMIENTOS`; son las dos métricas naturales del juego y no hay HUD nativo.
- **Sí:** seguir jugando tras 2048; **No:** pantalla de victoria (sería overlay en canvas y cortaría el leaderboard).
- **Sí:** animación corta (210 ms) con buffer de 1 movimiento; **No:** animación bloqueante que pierda teclas.
- **Sí:** ignorar `e.repeat`; un movimiento por pulsación evita deslizamientos involuntarios.
- **Sí:** probabilidades 90/10 y 1 ficha por movimiento (valores clásicos, ajustables solo editando el spec).
- **Sí:** `cat` PUZZLE y color cyan (Tetris ya usa magenta); **Sí:** `.cover-2048` nueva.
- **No:** deshacer, guardado de partida, sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                              | Mitigation                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Fusión doble (`[2,2,4]` → `8`) por procesar mal la línea.                         | Procesar desde el borde de destino marcando fichas ya fusionadas; casos del paso 2 y criterio de aceptación.  |
| Partidas clásicas pueden alargarse (10+ min) frente al resto del catálogo.        | Es la variante fiel; la variante 02 resuelve la duración. Aceptado y documentado.                             |
| Teclas perdidas o movimientos dobles durante la animación.                        | Buffer de 1 `pendingDir` aplicado al terminar; `e.repeat` ignorado.                                           |
| El id numérico `2048` rompe identificadores o claves.                             | Clave `"2048"` entre comillas en `ENGINES`; prefijos TS; la clase `.cover-2048` es válida (empieza por letra). |
| Game over emitido antes de ver el último tablero.                                 | `overPending` y emisión al acabar la animación; último frame queda en el canvas.                              |
| Flechas o `WASD` interfieren con el input del modal.                              | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                          |
| `dt` grande tras pausa o cambio de pestaña salta la animación.                    | rAF cancelado en pausa, `lastTime` reiniciado al reanudar y tras blur; `dt` capado a 50 ms.                   |
| Doble loop / listeners por StrictMode.                                            | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                        |
| Next 16 difiere del conocimiento previo.                                          | Paso 1 consulta `node_modules/next/dist/docs/`.                                                               |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deshacer, guardado de partida, tableros distintos de 4×4.
- Temporizador, combos, bonus de tiempo y aparición múltiple de fichas.
- Pantalla de victoria, HUD nativo dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
