# SPEC GJ-puzzle-bobble-01 — Juego real: PUZZLE BOBBLE (variante: clásico por rondas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-19
> **Variant:** 01 de 2 — Puzzle Bobble clásico fiel: rondas con tablero fijo que hay que vaciar, techo que baja cada N disparos, 3 vidas y disparo automático por inactividad.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Puzzle Bobble. Recrea el arcade de 1994: un **cañón** en la base dispara burbujas de color que rebotan en las paredes laterales y se pegan a una rejilla hexagonal; **3 o más del mismo color conectadas explotan** y las que quedan colgando sin conexión al techo **caen** (con bonus exponencial). Cada ronda tiene un tablero inicial que hay que **vaciar**; el **techo baja una fila cada N disparos** y si una burbuja cruza la línea inferior se pierde una vida y se repite la ronda. Se distingue de la variante 02 (supervivencia infinita, un solo tablero que desciende de forma continua, comodines, bomba, intercambio y combos): aquí el reto es **puzle por rondas con presión por número de disparos**, sin power-ups.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events, skin?) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con círculos y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (5 = frogger; 6 queda reservado por la propuesta `specs/game-jam/missile-command/`), dificultad 3, tags `CLÁSICO` y `BURBUJAS`, 1 jugador, teclado. Canvas **480×640** (3:4). `initialLives: 3`, `showLevel: true` (nivel = ronda) y stat extra `TECHO` (disparos que faltan para que baje). Sin sonido, sin imágenes. El parámetro `skin` se acepta y se ignora (skins fuera de alcance).

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events, skin?) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal (`isLong(row)`, `cellCenter(row, col, ceilingY)`, `neighbors(row, col)`, `snapCell(grid, x, y, ceilingY, hit)`, `matchGroup(grid, row, col)`, `floating(grid)`) y constantes (`R`, `ROW_H`, `FIELD_L`, `FIELD_R`, `DEATH_Y`, `CANNON`).
- Módulo `lib/games/puzzle-bobble/levels.ts`: las 5 rondas literales de este spec y `proceduralLevel(n, rand)` para la ronda 6 en adelante.
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawWalls`, `drawCeiling`, `drawBubble`, `drawCannon`, `drawAimGuide`, `drawDeathLine` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `radial-gradient(circle at 50% 100%, #00283a, #0a0a18)`, `::after` con 6 círculos (`radial-gradient` rojo, amarillo, azul, verde, morado, naranja) agrupados arriba y `::before` con un triángulo cyan abajo (cañón).
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= ronda) y stat extra `drop` ("TECHO", `int`, color `yellow`).
- Sin HUD nativo de texto en el canvas; la burbuja "siguiente" y el aviso de disparo automático se dibujan como parte del escenario.
- Controles: `←`/`→` (y `A`/`D`) giran el cañón; `Espacio` o `↑` (y `W`) disparan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Power-ups, comodines, intercambio de burbuja, combos (son de la variante 02).
- Editor de niveles, modo 2 jugadores (VERSUS), continues.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Junta tres burbujas iguales y revienta el techo.',
       'Gira el cañón con las flechas y dispara con Espacio. Las burbujas rebotan en las paredes y se pegan al montón: junta tres o más del mismo color para reventarlas y haz caer las que queden colgando. Vacía el tablero para pasar de ronda antes de que el techo, que baja cada pocos disparos, empuje las burbujas hasta la línea. Tienes tres vidas.',
       'PUZZLE', 'cyan', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{CLÁSICO,BURBUJAS}', 3, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "drop", label: "TECHO", color: "yellow", format: "int" }],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `grid: (ColorId | null)[][]` (fila 0 pegada al techo), `drops` (filas que ha bajado el techo en la ronda), `shotsLeft` (disparos hasta la próxima bajada), `angle` (grados), `keysDown: Set<string>`, `current: ColorId`, `next: ColorId`, `flying { x, y, vx, vy, color } | null`, `popping: { x, y, color, ms }[]`, `falling: { x, y, vy, color }[]`, `level`, `lives`, `score`, `roundMs`, `idleMs`, `phase: "play" | "clear" | "dead"`, `phaseMs`, `rand` (función aleatoria de la instancia), `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("drop", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("drop", 8)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (un disparo por pulsación); el giro usa `keysDown` (continuo mientras se mantiene).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Los temporizadores (`roundMs`, `idleMs`, `phaseMs`) no avanzan en pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, cambio de ronda ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** burbuja de radio `R = 24` (diámetro 48). Campo entre paredes `x = 48` y `x = 432` (384 px = 8 burbujas). Altura de fila `ROW_H = 42`. Filas alternas: fila "larga" (8 celdas, centro `x = 72 + 48·c`, `c = 0..7`) y "corta" (7 celdas, centro `x = 96 + 48·c`, `c = 0..6`); la fila 0 es larga y la paridad no cambia en toda la ronda. Centro de la fila `r`: `y = ceilingY + 24 + 42·r`.
- **Vecinos:** misma fila `c ± 1`; desde fila larga, filas adyacentes en `c − 1` y `c`; desde fila corta, filas adyacentes en `c` y `c + 1` (solo índices válidos).
- **Techo:** `ceilingY = 32 + 42·drops`. Se dibuja como una placa sólida desde `y = 0` hasta `ceilingY`.
- **Línea de muerte:** `DEATH_Y = 560`. Si alguna burbuja de la rejilla tiene `centro.y + 24 > 560` → se pierde una vida.
- **Cañón:** pivote en (240, 600), cañón de 56 px. `angle` en grados desde la horizontal, empieza en **90** (vertical), limitado a **[15, 165]**, gira a **100 °/s** con las teclas mantenidas. La burbuja cargada se dibuja en el pivote; la siguiente, en (120, 612) a radio 18. Guía de puntería: línea punteada de 120 px en la dirección del cañón (sin calcular rebotes).
- **Disparo:** solo si `phase = "play"` y no hay burbuja en vuelo. La burbuja sale del pivote a **800 px/s** en la dirección del cañón. Se mueve en subpasos de ≤ 6 px. Rebota en las paredes (`x − 24 ≤ 48` o `x + 24 ≥ 432` invierte `vx`).
- **Contacto:** se detiene al quedar a distancia **< 40 px** de una burbuja de la rejilla, o cuando `y − 24 ≤ ceilingY`. Se ancla en la celda vacía más cercana: primero la celda que corresponde a su posición (`row = round((y − ceilingY − 24) / 42)`, mínimo 0, y la columna más cercana de esa fila); si está ocupada o fuera de rango, la vecina vacía de la burbuja tocada más cercana a su posición.
- **Explosión:** tras anclar, se busca el grupo conectado del mismo color (incluida la nueva). Si tiene **≥ 3**, todas explotan (animación de 150 ms, cosmética). Después, toda burbuja sin camino de vecinos hasta la fila 0 **cae** (gravedad 1800 px/s², cosmética; ya puntuadas y fuera de la rejilla).
- **Puntuación:**
  - Burbuja explotada: **10** cada una.
  - Caída de `n` burbujas en un mismo disparo: **10 × 2^min(n, 10)** en total (1 → 20, 2 → 40, 3 → 80 … 10 o más → 10240).
  - Ronda vaciada: bonus **max(1000, 20000 − 200 × s)**, con `s` = segundos completos de `roundMs`.
- **Techo que baja:** `shotsPerDrop = max(8 − floor((level − 1) / 3), 5)` (rondas 1–3: 8, 4–6: 7, 7–9: 6, 10+: 5). Cada disparo resuelto resta 1 a `shotsLeft` y emite `onStat("drop", shotsLeft)`; al llegar a 0, `drops + 1` (el techo y toda la rejilla bajan 42 px), `shotsLeft = shotsPerDrop`, `onStat("drop", shotsLeft)`. Con `shotsLeft ≤ 2` la rejilla tiembla ±2 px en `x` (aviso visual).
- **Colores:** 6 colores `R` rojo, `Y` amarillo, `B` azul, `G` verde, `P` morado, `O` naranja. `current` y `next` se eligen al azar entre los colores **presentes en la rejilla** al generarse. Tras resolver cada disparo, si `current` o `next` ya no existen en la rejilla (y no está vacía) se vuelven a sortear.
- **Disparo automático:** si pasan **10000 ms** de `phase = "play"` sin disparar (`idleMs`), se dispara solo con el ángulo actual. Con `idleMs ≥ 7000` el anillo del cañón parpadea (cada 250 ms). `idleMs` vuelve a 0 en cada disparo.
- **Orden de resolución de un disparo:** anclar → explotar → caer → sumar puntos → comprobar ronda vacía → descontar `shotsLeft` (y bajar techo si toca) → comprobar línea de muerte → resortear colores.
- **Ronda vaciada:** rejilla vacía → bonus, `phase = "clear"` **1500 ms** (sin disparos), luego `level + 1`, `onLevel(level)`, carga la ronda nueva con `drops = 0`, `shotsLeft = shotsPerDrop`, `onStat("drop", …)`, `roundMs = 0`, `idleMs = 0`, `angle = 90`.
- **Vida perdida:** `lives − 1`, `onLives(lives)`. Si `lives = 0` → `onLives(0)` y `onGameOver(score)`. Si no, `phase = "dead"` **1500 ms** (las burbujas se dibujan en gris `#555`), luego se recarga la **misma** ronda desde cero (misma disposición literal o nueva procedural), con `drops = 0`, `shotsLeft`, `roundMs`, `idleMs` y `angle` reiniciados.
- **Rondas 1–5** (`levels.ts`, una cadena por fila, `.` = vacío; filas pares 8 caracteres, impares 7):
  - Ronda 1: `RRYYBBRR`, `RYYBBRR`, `YYBBRRYY`, `YBBRRYY`.
  - Ronda 2: `GGRRYYBB`, `GRRYYBB`, `BBGGRRYY`, `BGGRRYY`, `..BBGG..`.
  - Ronda 3: `RRRRBBBB`, `YYYGGGG`, `BBBBRRRR`, `GGGYYYY`, `RRBBYYGG`, `.G.R.B.`.
  - Ronda 4: `PPRRYYBB`, `PRRGGBB`, `YYPPGGRR`, `YPPBBRR`, `GGYYRRPP`, `GYYRRPP`.
  - Ronda 5: `BBBBBBBB`, `RRRRRRR`, `YYGGPPYY`, `YGGPPYY`, `RRBBRRBB`, `PPGGYYR`, `..R..B..`.
- **Ronda 6 en adelante** (`proceduralLevel(n)`): filas `min(5 + floor((n − 6) / 2), 8)`; colores `R Y B G P` si `n < 8`, los 6 si `n ≥ 8`; todas las celdas llenas; cada celda copia el color de su vecina izquierda de la misma fila con probabilidad **0.5**, si no, color uniforme entre los de la ronda. Sin fin: no hay victoria final.
- **Dibujo:** fondo `#0a0a18` con rejilla tenue; paredes `#00f5ff` de 4 px a los lados del campo; placa del techo `#1a2a3a` con borde inferior `#00f5ff`; línea de muerte discontinua `#ff3355` en `y = 560`. Burbujas con gradiente radial (brillo blanco arriba-izquierda → color → color oscurecido 40 %) y contorno 1.5 px: `R #ff3355`, `Y #ffe600`, `B #2b7bff`, `G #39ff14`, `P #b04dff`, `O #ff8a00`. Cañón: triángulo/rectángulo `#00f5ff` sobre base semicircular `#1a2a3a`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; `neighbors(0, 0)` = `[(0,1), (1,0)]`; `neighbors(1, 0)` = `[(1,1), (0,0), (0,1), (2,0), (2,1)]`; `cellCenter(0, 0, 32)` = (72, 56).
3. Crear `lib/games/puzzle-bobble/levels.ts`. Verificar: `npm run lint`; las 5 rondas tienen filas de 8/7 caracteres alternos; `proceduralLevel(6)` da 5 filas con 5 colores y `proceduralLevel(12)` 8 filas con 6 colores.
4. Crear `lib/games/puzzle-bobble/draw.ts` y `engine.ts`; exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): girar y disparar, rebote en paredes, explotar un grupo de 3, provocar una caída (bonus 10 × 2^n), ver bajar el techo al 8.º disparo (TECHO 8 → 1 → 8), disparo automático a los 10 s, vaciar la ronda 1 (bonus y ronda 2), perder una vida por línea de muerte (ronda se repite), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`BURBUJAS`, dificultad 3, color cyan, categoría PUZZLE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` (y `A`/`D`) giran el cañón a 100 °/s entre 15° y 165°; `Espacio`/`↑`/`W` disparan una sola burbuja por pulsación; flechas y `Espacio` no hacen scroll.
- [ ] La burbuja viaja a 800 px/s, rebota en `x = 48` y `x = 432` y se ancla en la rejilla hexagonal sin solaparse ni atravesar burbujas.
- [ ] Un grupo de 3+ del mismo color explota y suma 10 por burbuja; un grupo de 2 no explota.
- [ ] Las burbujas que quedan sin conexión con la fila 0 caen y suman 10 × 2^n en total (2 caídas = 40, 3 = 80).
- [ ] TECHO empieza en 8 en la ronda 1, baja 1 por disparo y al llegar a 0 el techo y la rejilla bajan 42 px y TECHO vuelve a 8; en la ronda 4 vuelve a 7.
- [ ] Sin disparar durante 10 s, el cañón dispara solo; el anillo parpadea desde los 7 s.
- [ ] `current`/`next` siempre son colores presentes en la rejilla.
- [ ] Vaciar la ronda suma `max(1000, 20000 − 200 × s)`, pasa a la siguiente tras 1500 ms y el nivel del HUD sube; las rondas 1–5 coinciden con las disposiciones del spec.
- [ ] Una burbuja cuyo borde inferior pasa `y = 560` quita una vida y repite la ronda desde cero tras 1500 ms.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (ronda) y TECHO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela burbuja en vuelo, caídas, temporizador de disparo automático y bonus de tiempo; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no gira ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, ronda 1 con su disposición, TECHO 8, ángulo 90°, sin burbuja en vuelo).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** rondas que se vacían y techo que baja por número de disparos (fiel al original); **No:** descenso continuo (es la variante 02).
- **Sí:** 3 vidas con repetición de la ronda; **No:** continues ni créditos.
- **Sí:** 5 rondas literales + procedurales sin fin; **No:** las 100 rondas del original (copyright y alcance).
- **Sí:** colores sorteados solo entre los presentes (evita burbujas imposibles, como el original).
- **Sí:** disparo automático a los 10 s (presión del original y partida corta); **No:** temporizador visible en el HUD.
- **Sí:** stat `TECHO` porque es la decisión central de la variante; **No:** stat de burbujas restantes.
- **Sí:** bonus de caída exponencial con tope en n = 10 (evita puntajes desbordados).
- **Sí:** `cat` PUZZLE y color cyan (distingue de Tetris, magenta); `.cover-puzzle-bobble` nueva.
- **Sí:** `sort_order` 7 para no chocar con la propuesta de missile-command (6).
- **Sí:** guía de puntería corta sin rebotes; **No:** trayectoria completa (quitaría el reto).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| La burbuja atraviesa la rejilla a 800 px/s en un frame. | Subpasos de ≤ 6 px con chequeo de contacto en cada uno. |
| El anclaje elige una celda ocupada o fuera de rango y solapa burbujas. | `snapCell` prueba la celda por posición y, si falla, la vecina vacía más cercana de la burbuja tocada; verificado en el paso 6. |
| Errores de vecindad entre filas largas y cortas rompen grupos y caídas. | Funciones puras en `grid.ts` con casos de verificación en el paso 2. |
| Emitir `onStat("drop")` u `onScore` por frame satura React. | Emitir solo al resolver un disparo, bajar el techo o cambiar de ronda. |
| `dt` grande tras pausar o cambiar de pestaña dispara el automático o teletransporta la burbuja. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `idleMs` no avanza en pausa. |
| Flechas, `WASD` o espacio interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Tecla de giro "pegada" tras perder foco. | `blur` y `pause` vacían `keysDown`. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| El id con guion requiere comillas en `ENGINES` y rutas. | Clave `"puzzle-bobble"`; carpeta `lib/games/puzzle-bobble/`; migración con `_`. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Power-ups, comodines, intercambio de burbuja y combos.
- Modo 2 jugadores, editor de rondas y las rondas originales del arcade.
- HUD nativo de texto dentro del canvas y overlays de pausa/ronda/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
