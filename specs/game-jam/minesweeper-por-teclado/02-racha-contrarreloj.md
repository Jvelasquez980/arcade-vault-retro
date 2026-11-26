# SPEC GJ-minesweeper-por-teclado-02 — Juego real: MINESWEEPER (variante: racha contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-26
> **Variant:** 02 de 2 — Racha infinita de tableros 12×12 con minas crecientes bajo una cuenta atrás global que se recarga al limpiar cada tablero; cursor con wrap y saltos pensado para teclado.
> **Objective:** Crear un motor TypeScript de Minesweeper por teclado dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/minesweeper-por-teclado` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Minesweeper por teclado. Convierte el Buscaminas en un arcade de supervivencia: se juegan **tableros 12×12 encadenados** (nivel = tablero), cada uno con **más minas**, bajo una **cuenta atrás global** que empieza en 60 s y suma tiempo al limpiar cada tablero. Se pierde al pisar una mina o al llegar el reloj a 0 (1 vida). Para compensar el teclado, el cursor **da la vuelta** en los bordes y `Q`/`E` **saltan** a la casilla oculta anterior/siguiente. Se distingue de la variante 01 (un solo tablero 16×16 de 40 minas, cronómetro ascendente, bonus por rapidez y victoria final): aquí **no hay victoria**, el puntaje crece con el nivel y el reto es mantener el ritmo.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, círculos, líneas y texto de canvas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-minesweeper-por-teclado`.

Decisiones fijadas por el agente (no se reabren): `id` `minesweeper-por-teclado`, título `MINESWEEPER`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre: frogger = 5 implementado; 6 lo reservan las variantes propuestas de `missile-command`), dificultad 4, tags `MINAS` y `CONTRARRELOJ`, 1 jugador, teclado. Canvas **480×480** (1:1), rejilla **12×12 de 40 px**. **1 vida**, **nivel** = número de tablero (`showLevel: true`), stats extra `TIEMPO` (cuenta atrás) y `MINAS`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/minesweeper-por-teclado/engine.ts`: sin globals de módulo; exporta `minesweeperDef: GameEngineDef` con `createMinesweeper(canvas, events) → GameController`.
- Módulo `lib/games/minesweeper-por-teclado/board.ts`: funciones puras sin estado de módulo: `createBoard(cols, rows)`, `placeMines(board, count, safeX, safeY, rng)` (Fisher–Yates sobre las celdas permitidas), `computeAdjacent(board)`, `floodReveal(board, x, y) → number` (BFS; devuelve casillas seguras reveladas), `neighbors(x, y, cols, rows)`, `minesFor(level)` y `nextHidden(board, from, step)` (índice de la siguiente casilla oculta sin bandera en orden de lectura, con vuelta; `step` = +1 o −1).
- Módulo `lib/games/minesweeper-por-teclado/draw.ts`: `drawCell`, `drawNumber`, `drawFlag`, `drawMine`, `drawCursor` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"minesweeper-por-teclado"` en `lib/games/registry.ts`.
- Clase `.cover-minesweeper-por-teclado` en `app/globals.css`: fondo `radial-gradient(circle at 50% 40%,#2a2000,#0a0a18)` con `::after` de rejilla 3×3 de casillas amarillas (`repeating-linear-gradient`) y `::before` de un anillo de reloj (borde `#ffe600` con un sector `conic-gradient` `#ff3355`).
- Migración `add_game_minesweeper_por_teclado`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×480**.
- HUD de React: puntaje, **1 vida**, **nivel** (tablero actual) y stats extra `time` ("TIEMPO", `int`, segundos restantes) y `mines` ("MINAS", `int`, minas − banderas del tablero).
- Sin HUD nativo en el canvas: solo el tablero y el cursor (el aviso de poco tiempo es el tinte del tablero, no un texto).
- Controles: `←↑→↓` y `WASD` mueven el cursor (con vuelta); `Q` / `E` saltan a la casilla oculta anterior/siguiente; `Espacio` / `Enter` revelan (o hacen _chording_); `F` / `X` ponen o quitan bandera. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'minesweeper-por-teclado'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `minesweeper-por-teclado`).

**Out of scope (para specs futuras):**

- Mouse y controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Power-ups (radar, escudo, congelar reloj), vidas extra, tableros de tamaño creciente.
- Modo de un solo tablero (eso es la variante 01) y selector de dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('minesweeper-por-teclado', 'MINESWEEPER', 'Limpia tableros de minas contra el reloj.',
       'Mueve el cursor con las flechas o WASD (da la vuelta en los bordes), salta a la siguiente casilla oculta con Q y E, revela con Espacio o Enter y marca minas con F o X. Empiezas con 60 segundos: cada tablero limpio suma 20 segundos y el siguiente trae más minas. Pisar una mina o quedarte sin tiempo termina la partida; cuanto más alto el nivel, más vale cada casilla.',
       'ARCADE', 'yellow', 'cover-minesweeper-por-teclado', 1, 1, '{keyboard}', '{MINAS,CONTRARRELOJ}', 4, 7, false);

Definición del motor:

    export const minesweeperDef: GameEngineDef = {
      width: 480, height: 480,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "int" },
        { key: "mines", label: "MINAS", color: "magenta", format: "int" },
      ],
      create: createMinesweeper,
    };

Estado interno (dentro de `createMinesweeper`): `cells: { mine: boolean, adj: number, state: "hidden" | "flagged" | "revealed" }[]` (índice `y × 12 + x`), `cursor { x, y }`, `level`, `mineCount`, `minesPlaced: boolean`, `flags`, `revealedSafe`, `timeLeftMs`, `clockRunning: boolean`, `lastSecond`, `phase: "play" | "cleared"`, `phaseMs`, `score`, `exploded: number | null`, `paused`, `finished`, `pulseMs`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)` (solo cuando cambia `Math.ceil(timeLeftMs / 1000)`), `onStat("mines", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 60)`, `onStat("mines", 14)`.
- `onStat("mines", 0)` y `onStat("time", 0)` ocultan el stat (contrato de `onStat`); es lo esperado con todas las banderas puestas o al agotarse el reloj (que ya es game over).
- Game over (mina o reloj a 0): `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (minas destapadas) queda en el canvas. No hay victoria.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. Movimiento y saltos aceptan `e.repeat`; revelar y bandera ignoran `e.repeat`. No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy: al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. La cuenta atrás y `phaseMs` descuentan `dt` del loop (no `Date.now()`), así la pausa no consume tiempo.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de tablero ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 12 columnas × 12 filas (144 casillas), celda 40 px, origen (0,0) arriba a la izquierda.
- **Minas por nivel:** `minesFor(L) = min(14 + 3 × (L − 1), 40)` → L1 14, L2 17, L3 20, … L9 38, L10+ 40.
- **Cursor:** empieza en (5, 5). Flechas/WASD mueven 1 celda **con vuelta** (de x = 11 a x = 0 y viceversa; igual en y). `E` salta a la siguiente casilla oculta sin bandera en orden de lectura (izquierda→derecha, arriba→abajo, volviendo a (0,0) tras (11,11)); `Q` a la anterior. Si no hay ninguna, no se mueve. El cursor conserva su posición al pasar de tablero.
- **Primera revelación de cada tablero:** las minas (`minesFor(level)`) se colocan en ese momento, al azar uniforme (Fisher–Yates con `Math.random`) entre las celdas fuera del bloque 3×3 centrado en el cursor (recortado a los bordes; sin vuelta); luego `computeAdjacent`. Las banderas puestas antes no afectan la colocación.
- **Reloj global:** empieza en **60 s**. Arranca con la primera revelación del tablero 1; desde el tablero 2 corre en cuanto aparece el tablero. Se detiene durante la fase `cleared`. Al llegar a 0 → derrota.
- **Revelar (`Espacio`/`Enter`) sobre casilla oculta sin bandera:** si es mina → derrota. Si `adj > 0` se revela solo esa. Si `adj = 0` → `floodReveal` (BFS de 8 vecinos, sin vuelta, no revela banderas).
- **Chording (`Espacio`/`Enter`) sobre casilla revelada con `adj > 0`:** si las banderas vecinas son exactamente `adj`, revela todas las vecinas ocultas sin bandera; si alguna es mina → derrota. Si no coincide, no hace nada.
- **Bandera (`F`/`X`):** alterna en casillas ocultas; máximo `mineCount` banderas por tablero. `onStat("mines", mineCount − flags)` al cambiar.
- **Puntuación:**
  - Cada casilla segura revelada (directa, cascada o chording): **+5 × L**.
  - Tablero limpio (todas las `144 − mineCount` seguras reveladas): **+200 × L** + **10 × s** con `s = Math.ceil(timeLeftMs / 1000)` en ese instante.
  - Las banderas no dan ni quitan puntos. La derrota conserva los puntos acumulados.
- **Tablero limpio:** se suma el bonus (`onScore`), el reloj suma **+20 s** con tope **99 s** (`onStat("time")`), `phase = "cleared"` durante **800 ms** (las minas se muestran con bandera verde, la entrada se ignora, el reloj no corre). Luego `level + 1`, `onLevel(level)`, tablero nuevo todo oculto, `flags = 0`, `minesPlaced = false`, `onStat("mines", minesFor(level))`, `phase = "play"`.
- **Derrota:** se destapan todas las minas; la pisada (si la hay) sobre fondo rojo; banderas erróneas tachadas. `onLives(0)` → `onGameOver(score)`.
- **Aviso de tiempo:** con `timeLeftMs ≤ 10000` las casillas ocultas usan `#2a0a14` en lugar de `#1a1a2e` y el cursor pulsa a 4 Hz en vez de 2 Hz (escenario, no overlay).
- **Dibujo:** fondo `#05050f`. Casilla oculta 38×38 px (margen 1 px) `#1a1a2e` con bisel de 2 px (claro `#3a3200` arriba/izquierda, oscuro `#0c0c18` abajo/derecha). Revelada `#0a0a18` con borde `#1a1a10`. Números en `bold 24px monospace` centrados: 1 `#00f5ff`, 2 `#39ff14`, 3 `#ff2bd6`, 4 `#ffe600`, 5 `#ff8a00`, 6 `#00ffa3`, 7 `#ffffff`, 8 `#9a9aff`. Bandera: mástil `#ffffff` y triángulo `#ffe600` (verde `#39ff14` en fase `cleared`). Mina: círculo `#ffffff` de radio 10 con 8 púas de 5 px; pisada sobre `#ff3355`; bandera errónea con aspa `#ff3355`. Cursor: marco de 3 px `#ffe600` con alfa que pulsa entre 0.55 y 1 (`pulseMs`; sin eventos).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-minesweeper-por-teclado` en `app/globals.css`. Aplicar migración `add_game_minesweeper_por_teclado` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'minesweeper-por-teclado'` muestra la fila; `npm run build`.
2. Crear `lib/games/minesweeper-por-teclado/board.ts`. Verificar: `npm run lint`; `minesFor(1) = 14`, `minesFor(5) = 26`, `minesFor(12) = 40`; `placeMines` no coloca minas en el 3×3 seguro; `nextHidden` salta banderas y reveladas y da la vuelta.
3. Crear `lib/games/minesweeper-por-teclado/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/minesweeper-por-teclado/engine.ts` y exportar `minesweeperDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"minesweeper-por-teclado"` en `lib/games/registry.ts`. Verificar: `/games/minesweeper-por-teclado/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): vuelta del cursor en los 4 bordes, saltos `Q`/`E`, primera revelación segura, banderas y MINAS, chording, limpiar el tablero 1 (bonus, +20 s, pausa de 800 ms, nivel 2 con 17 minas), reloj corriendo desde el inicio del tablero 2, aviso a ≤ 10 s, derrota por mina y por tiempo, pausa (botón y `P`) que congela el reloj, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'minesweeper-por-teclado'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `minesweeper-por-teclado` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-minesweeper-por-teclado`), la ficha `/games/minesweeper-por-teclado` y el home muestran el juego desde la BD (título MINESWEEPER, 1 jugador, teclado, tags `MINAS`/`CONTRARRELOJ`, dificultad 4, color amarillo, categoría ARCADE).
- [ ] `/games/minesweeper-por-teclado/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] El cursor empieza en (5, 5), se mueve con flechas y WASD y da la vuelta en los cuatro bordes; las flechas, `Espacio` y `Enter` no hacen scroll.
- [ ] `E`/`Q` llevan el cursor a la siguiente/anterior casilla oculta sin bandera en orden de lectura, con vuelta; sin casillas ocultas no se mueve.
- [ ] La primera revelación de cada tablero nunca es mina ni tiene minas en su 3×3; el tablero L tiene exactamente `min(14 + 3 × (L − 1), 40)` minas.
- [ ] Cada casilla segura revelada suma 5 × nivel; limpiar un tablero suma 200 × nivel + 10 × segundos restantes.
- [ ] El reloj empieza en 60, arranca con la primera revelación del tablero 1, suma 20 s al limpiar (tope 99), se detiene 800 ms entre tableros y desde el tablero 2 corre en cuanto aparece.
- [ ] Al limpiar un tablero el nivel del HUD sube, MINAS muestra las minas del nuevo tablero y el cursor conserva su posición.
- [ ] Con ≤ 10 s restantes las casillas ocultas se tiñen de `#2a0a14` y el cursor pulsa más rápido.
- [ ] Pisar una mina o llegar a 0 s destapa las minas, emite `onLives(0)` y luego `onGameOver` con los puntos acumulados.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO y MINAS; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, fase de transición y entrada; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, `Q`, `E`, `F`, `X`, espacio, Enter) no mueve el cursor ni revela.
- [ ] Guardar inserta en `scores` con `game_id = 'minesweeper-por-teclado'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/minesweeper-por-teclado` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 60 detenido, MINAS 14, todo oculto, cursor en (5, 5)).
- [ ] Desmontar en juego o durante la fase `cleared` cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/minesweeper-por-teclado/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** racha infinita de tableros 12×12 sin victoria: el leaderboard siempre tiene margen para mejorar. **No:** tableros crecientes (cambiaría el tamaño de celda en cada nivel).
- **Sí:** cuenta atrás global 60 s, +20 s por tablero con tope 99 s: obliga a decidir rápido y acota la partida (~3–8 min). **No:** cronómetro ascendente (es la variante 01).
- **Sí:** reloj parado hasta la primera revelación del tablero 1 (leer el control no cuesta tiempo); desde el 2 corre al aparecer (el ritmo es la mecánica).
- **Sí:** cursor con vuelta y saltos `Q`/`E`: compensan la falta de mouse en un juego contrarreloj. **No:** `Tab` para saltar (mueve el foco del navegador).
- **Sí:** puntos escalados por nivel y bonus por segundos sobrantes; **No:** puntuar banderas.
- **Sí:** `initialLives: 1` y `showLevel: true` para reutilizar el HUD y respetar `onLives(0)` → `onGameOver`; el reloj a 0 también es pérdida de la vida.
- **Sí:** `cat` ARCADE, color amarillo (énfasis en tiempo; Tetris ocupa PUZZLE magenta) y `.cover-minesweeper-por-teclado` nueva.
- **Sí:** valores de balance (minas por nivel, 60/+20/99 s, 800 ms, puntos) fijados en este spec, ajustables solo editándolo.
- **No:** power-ups, mouse, táctil, HiDPI, sonido, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                     | Mitigation                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Con 40 minas en 144 casillas (nivel 10+) los tableros exigen adivinar.   | Aceptado como techo de dificultad; el bonus por nivel compensa el riesgo. Ajustable solo editando `minesFor`.  |
| El reloj se recarga sin límite y la partida no termina.                  | Tope de 99 s y minas crecientes; el tiempo por tablero sube con su dificultad.                                 |
| Bonus o nivel aplicados dos veces al limpiar.                            | Detectar "limpio" solo en `phase = "play"` y pasar a `cleared` en el mismo paso.                               |
| `onStat("time")` por frame satura React.                                 | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                      |
| `dt` grande tras pausar o cambiar de pestaña consume el reloj.           | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                           |
| Teclas de juego interfieren con el input del modal.                      | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Cascada recursiva o vuelta de bordes aplicada por error a vecinos.       | `floodReveal` iterativo (BFS) y `neighbors` sin vuelta; la vuelta solo afecta al cursor.                       |
| Doble loop / listeners por StrictMode.                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones requiere comillas en `ENGINES` y rutas de carpeta.     | Clave `"minesweeper-por-teclado"` entre comillas; carpeta homónima; migración con `_` en el nombre.            |
| Next 16 difiere del conocimiento previo.                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Mouse, controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Power-ups, vidas extra, tableros de tamaño creciente, modo de un solo tablero, selector de dificultad.
- HUD nativo dentro del canvas y overlays de pausa/transición/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
