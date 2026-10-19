# SPEC GJ-puzzle-bobble-02 — Juego real: PUZZLE BOBBLE (variante: supervivencia continua) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-19
> **Variant:** 02 de 2 — Puzzle Bobble moderno sin fin: el techo baja de forma continua y empuja filas nuevas, con comodín arcoíris, bomba, intercambio de burbuja y multiplicador de combo; 1 vida.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble en modo supervivencia dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Puzzle Bobble. Mantiene el núcleo (cañón de burbujas, **3+ del mismo color explotan**, las desconectadas **caen**), pero cambia la estructura: **no hay rondas**. Un único muro de burbujas **baja de forma continua** empujado por el techo, y por arriba entran **filas nuevas sin fin**; la velocidad sube con el nivel (cada 45 s). La partida acaba cuando una burbuja cruza la línea inferior (**1 vida**). Añade decisiones de ritmo: **intercambiar** la burbuja cargada con la siguiente, **comodín arcoíris**, **bomba** y un **multiplicador de combo** por disparos consecutivos que revientan. Se distingue de la variante 01 (rondas fijas que se vacían, techo que baja cada N disparos, 3 vidas, disparo automático, sin power-ups): aquí el reto es **sobrevivir y encadenar**, en tiempo real.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events, skin?) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con círculos y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (5 = frogger; 6 queda reservado por la propuesta `specs/game-jam/missile-command/`), dificultad 4, tags `BURBUJAS` y `SUPERVIVENCIA`, 1 jugador, teclado. Canvas **480×640** (3:4). `initialLives: 1`, `showLevel: true` (nivel = tramo de velocidad) y stats extra `COMBO` y `TIEMPO`. Sin sonido, sin imágenes. El parámetro `skin` se acepta y se ignora (skins fuera de alcance).

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events, skin?) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal con paridad variable (`isLong(row, parity)`, `cellCenter(row, col, parity, scroll)`, `neighbors(row, col, parity)`, `snapCell(...)`, `matchGroup(grid, row, col, parity)`, `rainbowColor(grid, row, col, parity)`, `bombTargets(grid, x, y, parity, scroll)`, `floating(grid, parity)`) y constantes (`R`, `ROW_H`, `FIELD_L`, `FIELD_R`, `CEIL_Y`, `DEATH_Y`, `CANNON`).
- Módulo `lib/games/puzzle-bobble/rows.ts`: `speedFor(level)`, `colorsFor(level)`, `makeRow(long, colors, rand)` y `rollShot(colors, rand)` (color o power-up).
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawWalls`, `drawCeiling`, `drawBubble` (incluye arcoíris y bomba), `drawCannon`, `drawAimGuide`, `drawDeathLine` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor.
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `radial-gradient(circle at 50% 100%, #2a0030, #0a0a18)`, `::after` con 6 círculos (`radial-gradient` de colores) apilados en la mitad superior y `::before` con una franja magenta horizontal (el techo que baja).
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **1 vida**, **nivel**, stat `combo` ("COMBO", `int`, `magenta`) y stat `time` ("TIEMPO", `int`, `cyan`, segundos sobrevividos).
- Sin HUD nativo de texto en el canvas; la burbuja siguiente se dibuja como parte del escenario.
- Controles: `←`/`→` (y `A`/`D`) giran el cañón; `Espacio` o `↑` (y `W`) disparan; `↓` (y `S`) intercambian la burbuja cargada con la siguiente. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Rondas con tableros fijos, disparo automático por inactividad (son de la variante 01).
- Más power-ups (rayo, congelar techo), modo 2 jugadores (VERSUS).
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Revienta burbujas antes de que el techo te aplaste.',
       'Gira el cañón con las flechas, dispara con Espacio y cambia de burbuja con la flecha abajo. Junta tres o más del mismo color para reventarlas y haz caer las que queden colgando. El techo baja sin parar y empuja filas nuevas cada vez más rápido: encadena disparos para subir el combo, aprovecha el comodín arcoíris y la bomba, y no dejes que ninguna burbuja cruce la línea.',
       'ARCADE', 'magenta', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{BURBUJAS,SUPERVIVENCIA}', 4, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
        { key: "time", label: "TIEMPO", color: "cyan", format: "int" },
      ],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `grid: (Cell | null)[][]` (`Cell = ColorId`; fila 0 = fila que asoma bajo el techo), `parity` (0/1, alterna al insertar fila), `scroll` (px, 0–42), `angle`, `keysDown: Set<string>`, `current: Shot`, `next: Shot` (`Shot = ColorId | "rainbow" | "bomb"`), `flying { x, y, vx, vy, shot } | null`, `popping`, `falling`, `blasts` (anillos de bomba, cosméticos), `level`, `playMs`, `secs`, `combo`, `score`, `rand`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("combo", n | null)`, `onStat("time", s)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("combo", null)`, `onStat("time", null)`.
- `onStat("combo", null)` oculta el stat mientras el multiplicador sea ×1 o no haya racha; se emite el valor solo cuando es ≥ 2. `time` se emite una vez por segundo completo (1, 2, 3…).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Disparo e intercambio ignoran `e.repeat`; el giro usa `keysDown`.
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El descenso, `playMs` y el nivel no avanzan en pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, subida de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** burbuja de radio `R = 24`. Campo entre paredes `x = 48` y `x = 432` (8 burbujas). `ROW_H = 42`. Fila larga: 8 celdas, centro `x = 72 + 48·c`; fila corta: 7 celdas, centro `x = 96 + 48·c`. La fila `r` es larga si `(r + parity) % 2 = 0`. Centro de la fila `r`: `y = CEIL_Y − 18 + scroll + 42·r`, con `CEIL_Y = 32` (la fila 0 asoma bajo el techo; lo que queda por encima de `y = 32` se recorta con `clip`).
- **Vecinos:** misma fila `c ± 1`; desde fila larga, filas adyacentes en `c − 1` y `c`; desde fila corta, en `c` y `c + 1` (solo índices válidos).
- **Techo continuo:** placa `#2a0a2a` de `y = 0` a `32` con borde `#ff2bd6`. El muro baja `speedFor(level) = min(8 + 2 × (level − 1), 26)` px/s (`scroll += v·dt`). Al llegar `scroll ≥ 42`: `scroll −= 42`, `parity` alterna y se inserta en el índice 0 una fila **llena** nueva (`makeRow`). Así la rejilla nunca se acaba.
- **Generación de fila (`makeRow`):** cada celda copia el color de su vecina izquierda con probabilidad **0.5**; si no, color uniforme entre `colorsFor(level)`: niveles 1–2 `R Y B G`; 3–5 `R Y B G P`; 6+ los 6 (`O` incluido).
- **Inicio:** `parity = 0`, `scroll = 0`, 7 filas (fila 0 asomando + 6 visibles) generadas con `makeRow`, `angle = 90`.
- **Línea de muerte:** `DEATH_Y = 560`. Se comprueba **cada frame** y tras resolver cada disparo: si alguna burbuja tiene `centro.y + 24 > 560` → `onLives(0)` y `onGameOver(score)`.
- **Cañón:** pivote (240, 600), cañón de 56 px; `angle` en **[15, 165]**, empieza en 90, gira a **130 °/s**. Burbuja cargada en el pivote; siguiente en (120, 612) a radio 18. Guía punteada de 160 px en la dirección del cañón (sin rebotes).
- **Disparo:** solo sin burbuja en vuelo. Velocidad **960 px/s**, subpasos de ≤ 6 px, rebote en paredes (`x ± 24` contra 48/432). Contacto a distancia **< 40 px** de una burbuja de la rejilla o borde superior `y − 24 ≤ 32`. Se ancla en la celda vacía más cercana (celda por posición; si está ocupada o fuera de rango, la vecina vacía de la burbuja tocada más cercana). Mientras vuela, la rejilla sigue bajando.
- **Intercambio:** `↓`/`S` cambia `current` y `next` (sin límite, sin coste); no hace nada con una burbuja en vuelo.
- **Sorteo de burbuja (`rollShot`):** **6 %** arcoíris, **4 %** bomba, resto color uniforme entre los colores presentes en la rejilla (si está vacía, entre `colorsFor(level)`). Tras resolver cada disparo, un `current`/`next` de color que ya no exista en la rejilla se vuelve a sortear (los power-ups se conservan).
- **Explosión normal:** tras anclar, grupo conectado del mismo color con **≥ 3** explota (150 ms, cosmético). Después, toda burbuja sin camino hasta la fila 0 cae (gravedad 1800 px/s², cosmética).
- **Arcoíris:** al anclar, toma el color vecino que forme el grupo conectado más grande (empate: orden `R Y B G P O`) y se resuelve como burbuja de ese color. Si no tiene vecinos de color (solo techo), queda como `R`.
- **Bomba:** no se ancla. Al contacto destruye todas las burbujas de la rejilla con centro a **≤ 100 px** del punto de contacto, cuenta como explosión (puntos de explosión y combo) y luego se aplican caídas.
- **Combo:** `combo` cuenta los disparos seguidos que explotan algo (grupo ≥ 3 o bomba); empieza en 0 y un disparo que no explota nada lo vuelve a 0. El multiplicador del disparo es `min(combo, 5)` con el `combo` ya actualizado (el primer disparo que explota cuenta ×1, el segundo seguido ×2 … del quinto en adelante ×5). Las caídas de un disparo sin explosión no ocurren (sin explosión no hay desconexión). `onStat("combo", combo ≥ 2 ? min(combo, 5) : null)` al cambiar el valor mostrado.
- **Puntuación:**
  - Burbuja explotada (normal, arcoíris o bomba): **10 × combo** cada una.
  - Burbuja caída: **20 × combo** cada una.
  - Supervivencia: **+10** por cada segundo completo de `playMs` (a la vez que `onStat("time", s)`).
  - Rejilla vaciada por completo: **+5000** y se regenera como al inicio (7 filas, `scroll = 0`), sin cambiar nivel ni velocidad.
- **Nivel:** sube cada **45000 ms** de `playMs` (nivel `1 + floor(playMs / 45000)`), `onLevel(level)`; afecta `speedFor` y `colorsFor`. Sin tope de nivel (la velocidad se topa en 26 px/s desde el nivel 10).
- **Orden de resolución de un disparo:** anclar/detonar → explotar → caer → actualizar combo → sumar puntos → comprobar rejilla vacía → comprobar línea de muerte → resortear colores.
- **Dibujo:** fondo `#0a0a18` con rejilla tenue; paredes `#ff2bd6` de 4 px; línea de muerte discontinua `#ff3355` en `y = 560` que parpadea (cada 200 ms) cuando la burbuja más baja está a menos de 84 px. Burbujas con gradiente radial y contorno 1.5 px: `R #ff3355`, `Y #ffe600`, `B #2b7bff`, `G #39ff14`, `P #b04dff`, `O #ff8a00`. Arcoíris: gradiente cónico (`createConicGradient`) con los 6 colores girando a 180 °/s. Bomba: círculo `#222` con borde blanco y mecha `#ffe600`; su explosión es un anillo blanco → magenta que crece hasta 100 px en 250 ms. Cañón `#ff2bd6` sobre base `#2a0a2a`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; con `parity = 0`, `neighbors(0, 0)` = `[(0,1), (1,0)]` y `neighbors(1, 0)` = `[(1,1), (0,0), (0,1), (2,0), (2,1)]`; con `parity = 1` la fila 0 es corta.
3. Crear `lib/games/puzzle-bobble/rows.ts`. Verificar: `npm run lint`; `speedFor(1)` = 8, `speedFor(10)` = 26, `speedFor(20)` = 26; `colorsFor(3)` tiene 5 colores y `colorsFor(6)` 6.
4. Crear `draw.ts` y `engine.ts`; exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): descenso continuo y entrada de filas sin saltos, disparar y rebotar, explotar grupos, caídas, intercambio con `↓`, combo ×2…×5 y reinicio a ×1, arcoíris y bomba (forzar con un `rand` de prueba local que no se commitea), TIEMPO y +10/s, subida de nivel a los 45 s, game over por línea, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `BURBUJAS`/`SUPERVIVENCIA`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` (y `A`/`D`) giran el cañón a 130 °/s entre 15° y 165°; `Espacio`/`↑`/`W` disparan una burbuja por pulsación; `↓`/`S` intercambian cargada y siguiente; flechas y `Espacio` no hacen scroll.
- [ ] La partida empieza con 6 filas visibles + 1 asomando; el muro baja a 8 px/s en el nivel 1 y cada 42 px entra una fila llena nueva por arriba sin saltos visibles ni burbujas desalineadas (paridad correcta).
- [ ] La burbuja viaja a 960 px/s, rebota en las paredes y se ancla sin solaparse aunque la rejilla siga bajando.
- [ ] Un grupo de 3+ explota (10 × combo cada una); las desconectadas caen (20 × combo cada una).
- [ ] Disparos consecutivos que explotan suben COMBO a 2, 3, 4, 5 (tope; el primero vale ×1 y no se muestra); uno que no explota lo reinicia y oculta el stat.
- [ ] El arcoíris adopta el color vecino con el grupo más grande; la bomba destruye todo en 100 px sin anclarse y cuenta para el combo.
- [ ] TIEMPO sube 1 por segundo y suma 10 puntos por segundo; a los 45 s el nivel pasa a 2 y la velocidad a 10 px/s; en el nivel 3 aparece el color morado.
- [ ] Vaciar la rejilla suma 5000 y regenera 7 filas.
- [ ] Una burbuja que pasa `y = 560` (por descenso o por anclaje) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, COMBO y TIEMPO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela descenso, burbuja en vuelo, TIEMPO y nivel; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, espacio) no gira, dispara ni intercambia.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, 8 px/s, COMBO y TIEMPO ocultos, rejilla nueva, ángulo 90°).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D (incluido `createConicGradient` para el arcoíris); **No:** sprites ni imágenes.
- **Sí:** descenso continuo con filas infinitas (el techo baja siempre); **No:** techo por número de disparos ni rondas (variante 01).
- **Sí:** 1 vida, game over por línea; partida corta garantizada por la velocidad creciente.
- **Sí:** puntos por supervivencia (+10/s) para que aguantar cuente en el leaderboard aunque se falle.
- **Sí:** intercambio libre, arcoíris (6 %) y bomba (4 %); **No:** más power-ups (spec aparte).
- **Sí:** combo multiplicador con tope ×5 (evita puntajes desbordados); **No:** bonus exponencial de caídas (lineal × combo es más legible con combos).
- **Sí:** nivel por tiempo (45 s) en vez de por puntos (independiente de la habilidad para puntuar).
- **Sí:** stats `COMBO` y `TIEMPO`; `COMBO` oculto en ×1 vía `null`.
- **Sí:** `cat` ARCADE y color magenta (acción en tiempo real); `.cover-puzzle-bobble` nueva.
- **Sí:** `sort_order` 7 para no chocar con la propuesta de missile-command (6).
- **No:** disparo automático por inactividad (la presión ya la pone el descenso).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Al insertar una fila la paridad se invierte y las burbujas saltan media celda. | `parity` alterna en la misma operación que `scroll −= 42` e inserción; `isLong(row, parity)` centralizado en `grid.ts`; verificado en el paso 6. |
| La burbuja en vuelo se ancla mal porque la rejilla se movió durante el vuelo. | El contacto y `snapCell` usan el `scroll` actual en cada subpaso; una inserción durante el vuelo se aplica antes de chequear el contacto de ese frame. |
| La burbuja atraviesa la rejilla a 960 px/s. | Subpasos de ≤ 6 px con chequeo de contacto. |
| Emitir `onScore` u `onStat` por frame satura React. | `time`/supervivencia solo al cruzar un segundo entero; resto solo al resolver disparos. |
| `dt` grande tras pausar o cambiar de pestaña hace bajar el muro de golpe y mata. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms. |
| Power-ups difíciles de verificar por su probabilidad. | `rand` por instancia; en el paso 6 se fuerza localmente sin commitear. |
| `createConicGradient` no disponible en algún navegador. | Fallback a gradiente radial blanco-magenta si `ctx.createConicGradient` no existe. |
| Flechas, `WASD` o espacio interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| El id con guion requiere comillas en `ENGINES` y rutas. | Clave `"puzzle-bobble"`; carpeta `lib/games/puzzle-bobble/`; migración con `_`. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Rondas con tableros fijos, techo por disparos y disparo automático.
- Power-ups adicionales y modo 2 jugadores.
- HUD nativo de texto dentro del canvas y overlays de pausa/nivel/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
