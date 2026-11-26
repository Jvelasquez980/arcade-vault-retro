# SPEC GJ-minesweeper-por-teclado-01 — Juego real: MINESWEEPER (variante: clásico cronometrado) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-26
> **Variant:** 01 de 2 — Buscaminas clásico fiel de un solo tablero 16×16 con 40 minas, manejado con cursor de teclado; el puntaje premia despejar casillas y terminar rápido.
> **Objective:** Crear un motor TypeScript de Minesweeper por teclado dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/minesweeper-por-teclado` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Minesweeper por teclado. Recrea el Buscaminas clásico (nivel "intermedio" de Windows): **un único tablero 16×16 con 40 minas**, primera jugada siempre segura, despeje en cascada de los ceros, banderas y _chording_ (revelar vecinos de un número ya satisfecho). El mouse se sustituye por un **cursor de teclado**. La partida termina al pisar una mina (1 vida) o al despejar el tablero. Se distingue de la variante 02 (racha de tableros 12×12 con minas crecientes, cuenta atrás global, cursor con wrap y saltos): aquí hay **un solo tablero, cronómetro ascendente y bonus por tiempo**; el reto es precisión, no supervivencia.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, círculos, líneas y texto de canvas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-minesweeper-por-teclado`.

Decisiones fijadas por el agente (no se reabren): `id` `minesweeper-por-teclado`, título `MINESWEEPER`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado; 6 lo reservan las variantes propuestas de `missile-command`), dificultad 3, tags `CLÁSICO` y `MINAS`, 1 jugador, teclado. Canvas **512×512** (1:1), rejilla **16×16 de 32 px**, **40 minas**. **1 vida**, sin niveles, stats extra `MINAS` y `TIEMPO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/minesweeper-por-teclado/engine.ts`: sin globals de módulo; exporta `minesweeperDef: GameEngineDef` con `createMinesweeper(canvas, events) → GameController`.
- Módulo `lib/games/minesweeper-por-teclado/board.ts`: funciones puras sin estado de módulo: `createBoard(cols, rows)`, `placeMines(board, count, safeX, safeY, rng)` (Fisher–Yates sobre las celdas permitidas), `computeAdjacent(board)`, `floodReveal(board, x, y) → number` (BFS; devuelve casillas seguras reveladas), `neighbors(x, y, cols, rows)`.
- Módulo `lib/games/minesweeper-por-teclado/draw.ts`: `drawCell`, `drawNumber`, `drawFlag`, `drawMine`, `drawCursor` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"minesweeper-por-teclado"` en `lib/games/registry.ts`.
- Clase `.cover-minesweeper-por-teclado` en `app/globals.css`: fondo `linear-gradient(135deg,#002a3a,#0a0a18)` con `::after` de rejilla 4×4 de casillas cyan (`repeating-linear-gradient`) y `::before` de una mina (círculo radial blanco → `#ff3355`) desplazada a un lado.
- Migración `add_game_minesweeper_por_teclado`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **512×512**.
- HUD de React: puntaje, **1 vida** (baja a 0 al pisar mina) y stats extra `mines` ("MINAS", `int`, minas − banderas) y `time` ("TIEMPO", `int`, segundos). Sin nivel.
- Sin HUD nativo en el canvas: solo el tablero y el cursor.
- Controles: `←↑→↓` y `WASD` mueven el cursor; `Espacio` / `Enter` revelan (o hacen _chording_); `F` / `X` ponen o quitan bandera. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'minesweeper-por-teclado'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `minesweeper-por-teclado`).

**Out of scope (para specs futuras):**

- Mouse (clic izquierdo/derecho) y controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Tamaños de tablero seleccionables (principiante/experto), marcas de interrogación `?`, tablero sin adivinanzas garantizado.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('minesweeper-por-teclado', 'MINESWEEPER', 'Despeja el campo de minas sin mouse.',
       'Mueve el cursor con las flechas o WASD, revela casillas con Espacio o Enter y marca minas con F o X. Los números indican cuántas minas tocan cada casilla; tu primera jugada siempre es segura. Pisar una mina termina la partida: cada casilla despejada suma 10 puntos y limpiar las 40 minas del tablero suma un bonus mayor cuanto más rápido lo logres.',
       'PUZZLE', 'cyan', 'cover-minesweeper-por-teclado', 1, 1, '{keyboard}', '{CLÁSICO,MINAS}', 3, 7, false);

Definición del motor:

    export const minesweeperDef: GameEngineDef = {
      width: 512, height: 512,
      initialLives: 1,
      stats: [
        { key: "mines", label: "MINAS", color: "magenta", format: "int" },
        { key: "time", label: "TIEMPO", color: "yellow", format: "int" },
      ],
      create: createMinesweeper,
    };

Estado interno (dentro de `createMinesweeper`): `cells: { mine: boolean, adj: number, state: "hidden" | "flagged" | "revealed" }[]` (índice `y × 16 + x`), `cursor { x, y }`, `minesPlaced: boolean`, `flags`, `revealedSafe`, `elapsedMs`, `lastSecond`, `score`, `exploded: number | null` (índice de la mina pisada), `won`, `paused`, `finished`, `pulseMs`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("mines", n)`, `onStat("time", s)` (solo cuando cambia el segundo entero). Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("mines", 40)`, `onStat("time", 0)`.
- `onStat("time", 0)` y `onStat("mines", 0)` ocultan el stat (contrato de `onStat`); es el comportamiento esperado antes del primer segundo y con 40 banderas puestas.
- Game over por mina: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar el cronómetro y de reaccionar a teclas. El último frame (minas destapadas) queda en el canvas.
- Victoria (216 casillas seguras reveladas): `onGameOver(score)` sin cambiar vidas; mismo comportamiento de parada.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. El movimiento acepta `e.repeat` (mantener la flecha usa la autorrepetición del sistema); revelar y bandera ignoran `e.repeat` (una acción por pulsación). No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy: al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El cronómetro acumula `dt` del loop (no `Date.now()`), así la pausa no cuenta tiempo.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 16 columnas × 16 filas, celda 32 px, origen (0,0) arriba a la izquierda. 40 minas, 216 casillas seguras.
- **Cursor:** empieza en (7, 7). Flechas/WASD lo mueven 1 celda; en el borde **no** da la vuelta (se queda en 0 o 15).
- **Primera revelación:** las minas se colocan en ese momento, al azar uniforme (Fisher–Yates con `Math.random`) entre las celdas fuera del bloque 3×3 centrado en el cursor; luego `computeAdjacent`. El cronómetro empieza en ese mismo instante. Antes de la primera revelación se pueden poner banderas (no afectan la colocación: una bandera en el 3×3 simplemente queda en una casilla segura).
- **Revelar (`Espacio`/`Enter`) sobre casilla oculta sin bandera:** si es mina → derrota. Si `adj > 0` se revela solo esa. Si `adj = 0` → `floodReveal`: BFS que revela los ceros conectados y su borde numérico (8 vecinos); el BFS no revela casillas con bandera.
- **Chording (`Espacio`/`Enter`) sobre casilla revelada con `adj > 0`:** si el número de banderas vecinas es exactamente `adj`, revela todas las vecinas ocultas sin bandera (cada una como "revelar"); si alguna es mina → derrota. Si no coincide, no hace nada.
- **Revelar sobre bandera o sobre un 0 revelado:** no hace nada.
- **Bandera (`F`/`X`):** en casilla oculta la marca; en bandera la quita; sobre revelada no hace nada. Máximo **40** banderas (la 41.ª se ignora). `onStat("mines", 40 − flags)` al cambiar.
- **Puntuación:**
  - Cada casilla segura revelada (por revelación directa, cascada o chording): **+10** (máximo 2160 por tablero).
  - Victoria: **+1000** de tablero limpio + bonus de tiempo `max(0, 6000 − 20 × s)`, con `s` = segundos enteros transcurridos (en 300 s el bonus es 0). Puntaje máximo teórico 9160.
  - Las banderas no dan ni quitan puntos. La derrota conserva los puntos acumulados.
- **Cronómetro:** `s = Math.floor(elapsedMs / 1000)`, tope **999** (a partir de ahí se congela en 999 y la partida sigue).
- **Derrota:** se destapan todas las minas; la pisada se dibuja con fondo rojo; las banderas mal puestas se tachan. `onLives(0)` → `onGameOver(score)`.
- **Victoria:** las minas sin bandera se dibujan con bandera automáticamente (sin emitir `onStat("mines")`), se suman los bonus (`onScore`), luego `onGameOver(score)`.
- **Dibujo:** fondo `#05050f`. Casilla oculta 30×30 px (margen 1 px) `#1a1a2e` con bisel de 2 px (claro `#2e2e52` arriba/izquierda, oscuro `#0c0c18` abajo/derecha). Revelada `#0a0a18` con borde `#14142a`. Números en `bold 20px monospace` centrados: 1 `#00f5ff`, 2 `#39ff14`, 3 `#ff2bd6`, 4 `#ffe600`, 5 `#ff8a00`, 6 `#00ffa3`, 7 `#ffffff`, 8 `#9a9aff`. Bandera: mástil `#ffffff` y triángulo `#ff2bd6`. Mina: círculo `#ffffff` de radio 8 con 8 púas de 4 px; pisada sobre `#ff3355`; bandera errónea con aspa `#ff3355`. Cursor: marco de 3 px `#ffe600` con alfa que pulsa entre 0.55 y 1 a 2 Hz (`pulseMs`; sin eventos).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-minesweeper-por-teclado` en `app/globals.css`. Aplicar migración `add_game_minesweeper_por_teclado` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'minesweeper-por-teclado'` muestra la fila; `npm run build`.
2. Crear `lib/games/minesweeper-por-teclado/board.ts`. Verificar: `npm run lint`; con un `safeX/safeY` dado, `placeMines` coloca 40 minas y ninguna en el 3×3; `floodReveal` sobre un 0 no revela banderas.
3. Crear `lib/games/minesweeper-por-teclado/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/minesweeper-por-teclado/engine.ts` y exportar `minesweeperDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"minesweeper-por-teclado"` en `lib/games/registry.ts`. Verificar: `/games/minesweeper-por-teclado/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover el cursor con flechas y WASD, primera revelación segura con cascada, poner/quitar banderas (MINAS baja/sube, tope 40), chording correcto e incorrecto, pisar una mina (derrota), ganar un tablero (forzando minas en consola de desarrollo si hace falta), cronómetro congelado en pausa, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'minesweeper-por-teclado'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `minesweeper-por-teclado` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-minesweeper-por-teclado`), la ficha `/games/minesweeper-por-teclado` y el home muestran el juego desde la BD (título MINESWEEPER, 1 jugador, teclado, tags `CLÁSICO`/`MINAS`, dificultad 3, color cyan, categoría PUZZLE).
- [ ] `/games/minesweeper-por-teclado/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] El cursor empieza en (7, 7), se mueve 1 celda con flechas y WASD, no da la vuelta en los bordes y mantener la flecha lo desplaza de forma continua; las flechas, `Espacio` y `Enter` no hacen scroll.
- [ ] La primera revelación nunca es mina ni tiene minas en su 3×3; el tablero tiene exactamente 40 minas; revelar un 0 abre la cascada sin destapar banderas.
- [ ] `F`/`X` alternan bandera solo en casillas ocultas; MINAS empieza en 40, baja/sube con cada bandera y no se pueden poner más de 40.
- [ ] Chording sobre un número con tantas banderas vecinas como su valor revela las vecinas restantes; con otro número de banderas no hace nada.
- [ ] Cada casilla segura revelada suma exactamente 10 puntos (también en cascada y chording).
- [ ] Ganar suma 1000 + `max(0, 6000 − 20 × s)` y abre el modal sin cambiar la vida; pisar una mina destapa las minas, emite `onLives(0)` y luego `onGameOver` con los puntos acumulados.
- [ ] TIEMPO empieza en la primera revelación, avanza 1 por segundo, se congela en pausa y no pasa de 999.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), MINAS y TIEMPO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela cronómetro y entrada; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, `F`, `X`, espacio, Enter) no mueve el cursor ni revela.
- [ ] Guardar inserta en `scores` con `game_id = 'minesweeper-por-teclado'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/minesweeper-por-teclado` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, MINAS 40, TIEMPO 0, todo oculto, cursor en (7, 7), minas sin colocar).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/minesweeper-por-teclado/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del Buscaminas clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** tablero 16×16 con 40 minas (intermedio clásico): partida de 2–6 min; **No:** experto 30×16 (no cabe 1:1 y alarga la partida).
- **Sí:** primera jugada segura con 3×3 libre; evita derrotas sin información en el primer movimiento.
- **Sí:** puntos por casilla + bonus de tiempo solo al ganar: el leaderboard ordena por progreso y, entre ganadores, por rapidez. **No:** puntuar banderas (se podrían explotar sin riesgo).
- **Sí:** chording con la misma tecla de revelar; es lo que hace jugable el teclado sin clic doble.
- **Sí:** cursor sin wrap y con autorrepetición del sistema (fiel a la rejilla); **No:** saltos entre casillas (eso es de la variante 02).
- **Sí:** `initialLives: 1` para que el HUD muestre la vida y respetar `onLives(0)` → `onGameOver`; **No:** `showLevel` (un solo tablero).
- **Sí:** cronómetro con `dt` acumulado y tope 999; la pausa no cuenta.
- **Sí:** `cat` PUZZLE, color cyan (Tetris ya es PUZZLE magenta) y `.cover-minesweeper-por-teclado` nueva.
- **No:** mouse, táctil, HiDPI, sonido, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                    | Mitigation                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| El teclado es más lento que el mouse y frustra.                         | Autorrepetición en movimiento, chording con la misma tecla y bonus de tiempo que llega a 0 recién en 300 s.  |
| Cascada recursiva desborda la pila en tableros grandes.                 | `floodReveal` iterativo con cola (BFS) y marca de visitadas.                                                 |
| Puntos de cascada contados dos veces o banderas reveladas por el BFS.   | `floodReveal` devuelve las casillas nuevas reveladas; solo revela `state = "hidden"`.                        |
| Tableros que exigen adivinar al final.                                  | Aceptado (fiel al clásico); la garantía sin adivinanzas queda fuera de scope.                                |
| `onStat("time")` por frame satura React.                                | Emitir solo cuando cambia `Math.floor(elapsedMs / 1000)`.                                                    |
| `dt` grande tras pausar o cambiar de pestaña suma tiempo falso.         | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                         |
| `Espacio`/`Enter`/`F`/`X` interfieren con el input del modal o botones. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                         |
| Doble loop / listeners por StrictMode.                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                       |
| El id con guiones requiere comillas en `ENGINES` y rutas de carpeta.    | Clave `"minesweeper-por-teclado"` entre comillas; carpeta homónima; migración con `_` en el nombre.          |
| Next 16 difiere del conocimiento previo.                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                              |

---

## What is **not** in this spec

- Mouse, controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Tamaños de tablero o dificultades seleccionables, marcas `?`, tableros sin adivinanzas.
- HUD nativo dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
