# SPEC GJ-minesweeper-por-teclado-01 — Juego real: MINESWEEPER (variante: campaña clásica) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-06
> **Variant:** 01 de 2 — Buscaminas clásico fiel jugado con cursor de teclado: una sola vida, tableros encadenados que crecen (9×9 → 12×12 → 16×16 → densidad creciente) y bonus por resolver rápido.
> **Objective:** Crear un motor TypeScript de Minesweeper (variante campaña clásica) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/minesweeper-por-teclado` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Minesweeper por teclado. Es el Buscaminas de siempre (revelar, banderas, *chording*, primer clic seguro, una mina = fin) adaptado a teclado puro: un **cursor** recorre la rejilla con flechas/WASD y se revela con `Espacio`/`Enter` y se marca con `F`/`X`. Para que haya un puntaje competible en partidas cortas, la partida es una **campaña de tableros encadenados**: al despejar uno aparece el siguiente, más grande y denso, y se suma un bonus por tiempo. **Una sola vida**: pisar una mina termina la partida. Se distingue de la variante 02 (contrarreloj global con 3 vidas, combos y radar), que premia la velocidad sostenida; esta premia la lógica y la precisión.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, gradientes y trazos. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-minesweeper-por-teclado`.

Decisiones fijadas por el agente (no se reabren): `id` `minesweeper-por-teclado`, título `MINESWEEPER`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` tiene reservado el 6 en `specs/game-jam/missile-command/`), dificultad 3, tags `CLÁSICO` y `LÓGICA`, 1 jugador, teclado. Canvas **640×640** (1:1). **1 vida** (`initialLives: 1`), **nivel** = número de tablero (`showLevel: true`), stats extra `MINAS` y `TIEMPO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/minesweeper-por-teclado/engine.ts`: sin globals de módulo; exporta `minesweeperDef: GameEngineDef` con `createMinesweeper(canvas, events) → GameController`.
- Módulo `lib/games/minesweeper-por-teclado/board.ts`: funciones puras sin DOM — `boardFor(level) → { cols, rows, mines, parS }`, `placeMines(cols, rows, mines, safeX, safeY, rand) → Uint8Array`, `countAdjacent(mines, cols, rows) → Uint8Array`, `floodReveal(state, x, y) → number` (celdas reveladas), `neighbors(x, y, cols, rows)`.
- Módulo `lib/games/minesweeper-por-teclado/draw.ts`: `drawCellHidden`, `drawCellRevealed`, `drawNumber`, `drawFlag`, `drawMine`, `drawWrongFlag`, `drawCursor` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"minesweeper-por-teclado"` en `lib/games/registry.ts`.
- Clase `.cover-minesweeper-por-teclado` en `app/globals.css`: fondo `linear-gradient(135deg,#00303a,#0a0a18)` con rejilla `repeating-linear-gradient` cyan al 15 % (celdas de 18 px), `::after` con una bandera (triángulo `#ff2bd6` sobre mástil blanco) y `::before` con una mina (círculo `#ffffff` con halo cyan).
- Migración `add_game_minesweeper_por_teclado`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **640×640**.
- HUD de React: puntaje, **1 vida** (baja a 0 al pisar una mina), **nivel** (tablero actual), stats extra `mines` ("MINAS", `int`) y `time` ("TIEMPO", `seconds`).
- Sin HUD nativo de texto en el canvas: solo tablero, números, banderas, minas y cursor.
- Controles: `←↑→↓` y `WASD` mueven el cursor; `Espacio` o `Enter` revelan (o hacen *chording* sobre un número); `F` o `X` ponen/quitan bandera. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'minesweeper-por-teclado'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `minesweeper-por-teclado`).

**Out of scope (para specs futuras):**

- Mouse, controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Varias vidas, contrarreloj global, combos, radar o cualquier power-up.
- Tableros "sin adivinar" (generador con solver), marca `?`, selector de dificultad o tamaño personalizado.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('minesweeper-por-teclado', 'MINESWEEPER', 'Despeja el campo minado con el teclado.',
       'Mueve el cursor con las flechas o WASD, revela con Espacio o Enter y marca minas con F. Cada número indica cuántas minas tocan la casilla. Despeja el tablero para pasar al siguiente, más grande y con más minas; cuanto más rápido, más bonus. Una sola mina pisada termina la partida.',
       'PUZZLE', 'cyan', 'cover-minesweeper-por-teclado', 1, 1, '{keyboard}', '{CLÁSICO,LÓGICA}', 3, 7, false);

Definición del motor:

    export const minesweeperDef: GameEngineDef = {
      width: 640, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "mines", label: "MINAS", color: "magenta", format: "int" },
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
      ],
      create: createMinesweeper,
    };

Estado interno (dentro de `createMinesweeper`): `level`, `cols`, `rows`, `mineCount`, `parS`, `cell` (px), `originX`, `originY`, `mines: Uint8Array | null` (null hasta el primer revelado del tablero), `adj: Uint8Array`, `state: Uint8Array` (0 oculta, 1 revelada, 2 bandera), `revealedSafe`, `flags`, `cursorX`, `cursorY`, `boardMs`, `timerOn`, `lastSecondEmitted`, `phase: "play" | "clear" | "dead"`, `clearMs`, `explodedIdx`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("mines", n)`, `onStat("time", s)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("mines", 10)`, `onStat("time", 0)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.floor(boardMs / 1000)` (una vez por segundo; `format: "seconds"` lo muestra como `Ns` con un decimal). `onStat("mines", n)` solo cuando cambia `mineCount − flags` (puede ser negativo si hay más banderas que minas, como en el clásico). Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio de TIEMPO y con todas las banderas puestas.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (con las minas a la vista) queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. Revelar y bandera ignoran `e.repeat` (una acción por pulsación); el movimiento del cursor acepta `e.repeat` (autorrepetición del sistema).
- Pausa/blur/destroy: no hay teclas mantenidas que limpiar; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Con pausa el temporizador del tablero no avanza.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`. rAF detenido mientras está en pausa (patrón SPEC 13).
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tableros por nivel** (`boardFor(level)`):

  | Nivel | Columnas × filas | Minas | `parS` |
  | ----- | ---------------- | ----- | ------ |
  | 1     | 9 × 9            | 10    | 60     |
  | 2     | 12 × 12          | 24    | 120    |
  | 3     | 16 × 16          | 40    | 180    |
  | n ≥ 4 | 16 × 16          | `min(40 + 6 × (n − 3), 70)` | 180 |

- **Geometría:** área de tablero de **608 × 608 px** centrada en el canvas (margen 16 px). `cell = Math.floor(608 / cols)` (9 → 67, 12 → 50, 16 → 38); el tablero se centra con `originX = originY = Math.floor((640 − cell × cols) / 2)`.
- **Cursor:** empieza en la celda central (`Math.floor(cols / 2)`, `Math.floor(rows / 2)`) de cada tablero. Flechas/WASD mueven 1 celda; en los bordes se **detiene** (sin wrap).
- **Primer revelado seguro:** las minas se colocan al primer revelado de cada tablero, al azar (Fisher–Yates sobre las candidatas) excluyendo la celda del cursor y sus 8 vecinas; así el primer revelado siempre abre un hueco. El temporizador del tablero arranca en ese momento.
- **Revelar** (`Espacio`/`Enter`) sobre celda oculta sin bandera: si es mina → muerte. Si no, se revela; si su número es 0 se propaga (*flood fill* iterativo, sin recursión) a todas las vecinas ocultas sin bandera, en cadena. Sobre celda con bandera: se ignora.
- **Chording** (`Espacio`/`Enter`) sobre celda revelada con número `k ≥ 1`: si tiene exactamente `k` banderas vecinas, revela todas sus vecinas ocultas sin bandera como si se revelaran una a una (si alguna es mina → muerte). Si no coincide el número de banderas, no pasa nada.
- **Bandera** (`F`/`X`): alterna oculta ↔ bandera. Sobre celda revelada se ignora. Sin límite de banderas. Antes del primer revelado del tablero también se permiten.
- **Puntos:**
  - Cada celda segura revelada (incluidas las de *flood fill* y *chording*): **+1 × nivel**.
  - Tablero despejado (todas las celdas seguras reveladas, `revealedSafe = cols × rows − mineCount`): **+100 × nivel** + bonus de tiempo **5 × nivel × max(0, parS − segundos)** (`segundos = Math.floor(boardMs / 1000)`).
  - Ejemplo: tablero 1 en 25 s = 71 + 100 + 5 × 35 = **346**.
- **Fin de tablero:** al despejar, `phase = "clear"`, se detiene el temporizador, todas las minas restantes se muestran con bandera, se suman puntos y durante **1200 ms** se ignoran las teclas de juego. Luego `level += 1`, `onLevel(level)`, nuevo tablero vacío (sin minas hasta el primer revelado), `onStat("mines", mineCount)` y `onStat("time", 0)`.
- **Muerte:** `phase = "dead"`, se revelan todas las minas; la pisada se dibuja con fondo `#ff3355`; las banderas mal puestas muestran una `X` `#ff3355` sobre la bandera. Inmediatamente `onLives(0)` y `onGameOver(score)`. El puntaje acumulado se conserva.
- **Tiempo:** `boardMs` suma `dt` solo con `phase = "play"`, temporizador activo y sin pausa.
- **Dibujo:** fondo `#05060f`. Celda oculta: cuadrado `cell − 2` px con gradiente lineal `#1b2a4a` → `#0f1830` y borde superior/izquierdo `#2f4a7a` (bisel). Revelada: `#0a0d18` con borde `#141c30`. Números en fuente monoespaciada negrita a `0.6 × cell` px, centrados: 1 `#00f5ff`, 2 `#39ff14`, 3 `#ff3355`, 4 `#b026ff`, 5 `#ffe600`, 6 `#ff8c00`, 7 `#ffffff`, 8 `#8a8a8a`. Bandera: mástil blanco + triángulo `#ff2bd6`. Mina: círculo `#ffffff` de radio `0.28 × cell` con 8 púas. Cursor: contorno de 3 px `#00f5ff` con `shadowBlur` 12 y opacidad que pulsa entre 0.6 y 1 con periodo 900 ms (dibujado por frame, sin eventos).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente, rAF detenido en pausa). Crear `.cover-minesweeper-por-teclado` en `app/globals.css`. Aplicar migración `add_game_minesweeper_por_teclado` con `published = false` (`mcp__supabase__apply_migration`) y anotarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'minesweeper-por-teclado'` muestra la fila; `npm run build`.
2. Crear `lib/games/minesweeper-por-teclado/board.ts`. Verificar: `npm run lint`; `boardFor(1)` = 9×9/10/60, `boardFor(3)` = 16×16/40/180, `boardFor(5).mines = 52`, `boardFor(20).mines = 70`; `placeMines` nunca pone mina en la celda segura ni en sus vecinas y coloca exactamente `mines` minas.
3. Crear `lib/games/minesweeper-por-teclado/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/minesweeper-por-teclado/engine.ts` y exportar `minesweeperDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"minesweeper-por-teclado"` en `lib/games/registry.ts`. Verificar: `/games/minesweeper-por-teclado/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover el cursor hasta los bordes, primer revelado abre hueco, *flood fill*, banderas y MINAS en el HUD, *chording* correcto e incorrecto, despejar el tablero 1 (puntos y bonus exactos, pausa de 1200 ms, nivel 2 con 12×12), pisar una mina (minas visibles, banderas erróneas con X, modal), pausa (botón y `P`) congela TIEMPO, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'minesweeper-por-teclado'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `minesweeper-por-teclado` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-minesweeper-por-teclado`), la ficha `/games/minesweeper-por-teclado` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`LÓGICA`, dificultad 3, color cyan, categoría PUZZLE).
- [ ] `/games/minesweeper-por-teclado/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven el cursor una celda y se detiene en los bordes; mantener la tecla autorrepite; flechas, `Espacio` y `Enter` no hacen scroll.
- [ ] El tablero 1 es 9×9 con 10 minas; el primer revelado nunca es mina ni tiene minas vecinas (abre hueco) y arranca TIEMPO.
- [ ] Revelar un 0 propaga en cadena; revelar una celda con bandera no hace nada; mantener `Espacio` no repite.
- [ ] `F`/`X` alternan bandera; MINAS en el HUD = minas − banderas (10 al inicio, baja al marcar, puede ser negativo).
- [ ] *Chording* sobre un número con banderas exactas revela sus vecinas; con banderas distintas no hace nada; si una bandera era errónea, pisa la mina y termina.
- [ ] Cada celda segura revelada suma 1 × nivel; despejar suma 100 × nivel + 5 × nivel × max(0, par − s) (tablero 1 en 25 s con 71 celdas = 346 en total).
- [ ] Tras despejar: minas restantes con bandera, 1200 ms sin input, nivel 2 con 12×12/24 minas, nivel 3 con 16×16/40, nivel 4 con 46 minas; TIEMPO vuelve a 0.
- [ ] Pisar una mina muestra todas las minas, la pisada en rojo y las banderas erróneas con X; emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, MINAS y TIEMPO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela TIEMPO y el input; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`/`A`/`S`/`D`, `F`, `X`, espacio, Enter) no mueve el cursor ni revela.
- [ ] Guardar inserta en `scores` con `game_id = 'minesweeper-por-teclado'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/minesweeper-por-teclado` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, 9×9 sin minas colocadas, MINAS 10, TIEMPO 0, cursor centrado).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/minesweeper-por-teclado/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas clásicas de Buscaminas; **No:** portar código externo (no existe en `references/`).
- **Sí:** cursor de teclado con revelar/bandera/*chording*; es la premisa del juego elegido. **No:** mouse (spec aparte).
- **Sí:** 1 vida; una mina termina la partida, como el original. **No:** vidas extra (eso es la variante 02).
- **Sí:** campaña de tableros encadenados con nivel; da partidas cortas al principio y un techo de puntaje para el leaderboard. **No:** un solo tablero fijo (el puntaje sería solo tiempo).
- **Sí:** primer revelado seguro con 3×3 libre; evita derrotas sin información. **No:** generador "sin adivinar" (requiere solver; fuera de alcance).
- **Sí:** puntos por celda × nivel + bonus por tiempo contra `parS`; premia lógica y velocidad sin castigar a quien piensa.
- **Sí:** stats `MINAS` y `TIEMPO`; son los dos contadores del Buscaminas clásico. **No:** marca `?`.
- **Sí:** canvas 640×640 con celda calculada por tablero; los tres tamaños caben sin scroll. **No:** canvas que cambie de tamaño (rompería `--game-ar`).
- **Sí:** valores de balance (tamaños, minas, par, puntos, 1200 ms) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` PUZZLE y color cyan; **Sí:** `.cover-minesweeper-por-teclado` nueva.
- **Sí:** el `id` es `minesweeper-por-teclado` (fijado por quien encargó la jam); clave entre comillas en `ENGINES` y migración con `_`.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| *Flood fill* recursivo desborda la pila en 16×16 casi vacío.                          | Implementación iterativa con pila explícita; cada celda se marca revelada al apilarla.                         |
| Tableros que obligan a adivinar frustran con 1 vida.                                  | Primer revelado con 3×3 libre; densidad máxima limitada a 70/256; aceptado como parte del clásico.             |
| `Enter`/`Espacio` también activan el botón enfocado (pausa, FIN) y disparan doble acción. | `preventDefault` con juego activo; verificar en el paso 6 que el foco en botones de React no revela.         |
| Números poco legibles a 375 px con celda de 38 px lógicos (≈ 21 px reales).           | Fuente negrita a 0.6 × celda y colores de alto contraste; verificar a 375 px.                                  |
| Emitir `onStat("time")` por frame satura React.                                       | Emitir solo cuando cambia `Math.floor(boardMs / 1000)`.                                                        |
| `dt` grande tras pausar o cambiar de pestaña infla TIEMPO y reduce el bonus.          | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `boardMs` solo avanza en juego.           |
| Letras WASD/F/X interfieren con el input del modal.                                   | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones requiere comillas en `ENGINES` y nombres válidos de migración.      | Clave `"minesweeper-por-teclado"`; carpeta `lib/games/minesweeper-por-teclado/`; migración con `_`.            |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Mouse, controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas extra, contrarreloj global, combos, radar y power-ups.
- Generador "sin adivinar", marca `?`, selector de dificultad o tamaño personalizado.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
