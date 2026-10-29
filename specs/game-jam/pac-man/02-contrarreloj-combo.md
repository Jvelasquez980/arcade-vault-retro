# SPEC GJ-pac-man-02 — Juego real: PAC-MAN (variante: contrarreloj con combo) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Variant:** 02 de 2 — Pac-Man contrarreloj de ritmo rápido: laberinto compacto 19×21 que se rellena por vueltas, el tiempo es el único recurso (sin vidas; morir resta segundos), multiplicador por cadena de píldoras y fantasmas con IA probabilística que se endurece cada vuelta.
> **Objective:** Crear un motor TypeScript de Pac-Man contrarreloj dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pac-man` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Pac-Man. Inspirada en las versiones "championship": la partida empieza con **120 s** en el reloj y termina cuando llega a 0. No hay vidas: tocar un fantasma **resta 10 s**. Al vaciar el laberinto se completa una **vuelta**: el laberinto se rellena, se ganan segundos y todo acelera. El puntaje premia comer píldoras **sin pausas** (cadena → multiplicador ×1 a ×5). Se distingue de la variante 01 (arcade fiel: laberinto 28×31, 3 vidas, niveles, IA determinista con personalidades y horario dispersión/persecución, frutas): aquí el reto es **velocidad y ruta**, con partidas de duración acotada y más comparables en el leaderboard.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con arcos, rectángulos y líneas. En `app/globals.css` existe `.cover-glot` (prototipo "GLOTÓN" de `references/templates/data.jsx`, no usado por la BD); se crea `.cover-pac-man` tomándola como base y `.cover-glot` no se toca.

Decisiones fijadas por el agente (no se reabren): `id` `pac-man`, título `PAC-MAN`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 4, tags `CONTRARRELOJ` y `LABERINTO`, 1 jugador, teclado. Canvas **532×588**, rejilla **19 columnas × 21 filas de 28 px**. **Sin vidas** (sin `initialLives`), **nivel = vuelta** (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pac-man/engine.ts`: sin globals de módulo; exporta `pacManDef: GameEngineDef` con `createPacMan(canvas, events) → GameController`.
- Módulo `lib/games/pac-man/maze.ts`: `MAZE` (las 21 filas literales de abajo), `COLS = 19`, `ROWS = 21`, `TILE = 28`, `parseMaze() → { walls, dots, energizers }` (copias nuevas por llamada, nunca estado compartido) e `isWall(col, row, throughDoor)`.
- Módulo `lib/games/pac-man/balance.ts`: funciones puras por vuelta `speeds(lap)`, `chaseChance(lap)`, `frightMs(lap)`, `multFor(chain)` y constantes de tiempo (`START_S`, `LAP_BONUS_S`, `CLOCK_BONUS_S`, `DEATH_PENALTY_S`, `MAX_S`, `CHAIN_GAP_MS`).
- Módulo `lib/games/pac-man/draw.ts`: `drawMaze` (a un canvas offscreen creado por instancia, una vez por partida), `drawDots`, `drawPac`, `drawGhost`, `drawClock`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pac-man"` en `lib/games/registry.ts`.
- Clase `.cover-pac-man` en `app/globals.css`: base de `.cover-glot` con fondo `radial-gradient(circle at 50% 50%, #2a0030, #0a0a18)`, Pac-Man amarillo con boca, fila de puntos cyan y un arco de reloj magenta (`conic-gradient` en `::before`).
- Migración `add_game_pac_man`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **532×588** (19×21 celdas de 28 px).
- HUD de React: puntaje, **nivel** (= vuelta) y stats extra `time` ("TIEMPO", `int`, segundos restantes) y `mult` ("COMBO", `int`, multiplicador). Sin vidas.
- Sin HUD nativo de texto en el canvas; el multiplicador se ve además como anillo alrededor de Pac-Man (parte del dibujo del jugador).
- Controles: `←↑→↓` y `WASD` (dirección con buffer). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pac-man'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pac-man`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Fantasmas dormidos en tren, bombas, frutas, varios laberintos o laberinto que cambia por mitades.
- Personalidades de fantasmas, horario dispersión/persecución y demás reglas del arcade (son de la variante 01).
- Selector de duración o dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pac-man', 'PAC-MAN', 'Come todo lo que puedas antes de que acabe el reloj.',
       'Tienes 120 segundos. Recorre el laberinto con las flechas o WASD y come píldoras sin detenerte: cada cadena de 20 sube el combo hasta ×5. Vacía el laberinto para completar una vuelta y ganar 10 segundos, pero cada vuelta es más rápida y los fantasmas te cazan mejor. Tocar un fantasma no te mata: te cuesta 10 segundos.',
       'ARCADE', 'magenta', 'cover-pac-man', 1, 1, '{keyboard}', '{CONTRARRELOJ,LABERINTO}', 4, 7, false);

Definición del motor:

    export const pacManDef: GameEngineDef = {
      width: 532, height: 588,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "int" },
        { key: "mult", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createPacMan,
    };

Laberinto (`MAZE`, 21 filas × 19 columnas; `#` muro, `.` píldora, `o` energizante, `_` pasillo vacío, `-` puerta de la casa; columnas 0–18, filas 0–20):

    ###################
    #........#........#
    #o##.###.#.###.##o#
    #.................#
    #.##.#.#####.#.##.#
    #....#...#...#....#
    ####.###_#_###.####
    ####.#_______#.####
    ####.#_##-##_#.####
    ____.__#___#__.____
    ####.#_#####_#.####
    ####.#_______#.####
    ####.#_#####_#.####
    #........#........#
    #.##.###.#.###.##.#
    #o.#....._.....#.o#
    ##.#.#.#####.#.#.##
    #....#...#...#....#
    #.######.#.######.#
    #.................#
    ###################

Contiene **146 píldoras + 4 energizantes = 150**; todo pasillo es alcanzable y no hay callejones sin salida. Fila 9 = túnel (envuelve horizontalmente). Casa de fantasmas: interior fila 9, columnas 8–10; puerta en (9,8); salida en (9,7).

Estado interno (dentro de `createPacMan`): `walls`, `dots: Uint8Array` (0 vacío, 1 píldora, 2 energizante), `dotsLeft`, `lapDotsEaten`, `pac { x, y, dir, nextDir, mouth }` (centro en px), `ghosts: { color, x, y, dir, state: "house" | "leaving" | "active" | "frightened" | "eyes" | "entering", releaseAt }[4]`, `frightLeftMs`, `ghostCombo`, `clock { leftMs } | null`, `clockSpawned`, `timeLeftMs`, `chain`, `sinceDotMs`, `mult`, `phase: "ready" | "play" | "hit" | "clear"`, `phaseMs`, `playMs` (desde el último `ready`), `lap`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `mazeCanvas` (offscreen por instancia), `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel` (vuelta), `onStat("time", s)` (solo cuando cambia `Math.ceil(timeLeftMs / 1000)`), `onStat("mult", m)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 120)`, `onStat("mult", 1)`. No se emite `onLives` (el def no declara vidas).
- Game over: el tiempo llega a 0 → `onStat("time", 0)` (oculta el stat, comportamiento esperado) y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. El orden `onLives(0)` → `onGameOver` de SPEC 05 no aplica porque no hay vidas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy limpian `nextDir`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` no emite eventos.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, "READY!", vuelta completada ni game over dentro del canvas (el parpadeo de muros al cerrar vuelta es animación del tablero, no overlay).

**Reglas del juego:**

- **Coordenadas y movimiento:** cada entidad tiene su centro en px; su celda es `floor(x / 28), floor(y / 28)`. El movimiento se integra en subpasos de como máximo **4 px** por entidad (`n = ceil(maxVel × dt / 4)`); ninguna entidad cruza el centro de una celda sin evaluarlo. Al llegar a un centro se decide el giro; entre centros solo se avanza en línea recta.
- **Túnel:** en la fila 9, si `x < −14` pasa a `x = 546` y viceversa (las columnas fuera de rango cuentan como pasillo en la fila 9).
- **Pac-Man:** empieza en el centro de la celda (9,15) mirando a la izquierda y arranca hacia la izquierda al terminar `ready`. `←↑→↓`/`WASD` fijan `nextDir`; la reversa se aplica al instante en cualquier punto; otros giros se aplican en el siguiente centro de celda si la vecina no es muro ni puerta; `nextDir` persiste hasta aplicarse o ser reemplazado. Si la celda siguiente es muro, se detiene en el centro.
- **Reloj:** `timeLeftMs` empieza en **120000** y solo baja en fase `play` (no en `ready`, `hit`, `clear` ni pausa). Máximo **300000** (los bonus no lo superan). Al llegar a 0 termina la partida.
- **Velocidades (px/s), `lap` = vuelta (1, 2, …)** según `speeds(lap)`:
  - Pac-Man: `min(196 + 14 × (lap − 1), 280)`.
  - Fantasma activo: `min(168 + 14 × (lap − 1), 252)`.
  - Fantasma asustado: **112**. En túnel (fila 9, columna ≤ 3 o ≥ 15): la mitad de su velocidad actual. Ojos: **392**. Dentro de la casa: **98**.
- **Fantasmas — inicio de cada `ready`:** rojo en el centro de (9,7) mirando a la izquierda, `active`; rosa (8,9), cian (9,9) y naranja (10,9) en `house`. Salen (`leaving`) a los **2000**, **4000** y **6000** ms de `playMs` respectivamente: se mueven en horizontal hasta `x = 266` (centro de la columna 9), suben por la puerta hasta el centro de (9,7) y pasan a `active` mirando a la izquierda.
- **IA (todos iguales):** en cada centro de celda, un fantasma `active` toma las direcciones válidas (no muro, no puerta, no opuesta a la actual). Con probabilidad `chaseChance(lap) = min(0.5 + 0.1 × (lap − 1), 0.9)` elige la que minimiza la distancia euclídea al cuadrado entre la celda vecina y la celda de Pac-Man (empate: arriba, izquierda, abajo, derecha); si no, una al azar. Un fantasma `frightened` elige siempre la que **maximiza** esa distancia (huye). Nunca invierten salvo al empezar un susto.
- **Píldoras y cadena:** al entrar Pac-Man en una celda con píldora suma `10 × mult`; con energizante `50 × mult`. Cada píldora o energizante hace `chain + 1` y `sinceDotMs = 0`. Si `sinceDotMs` supera **700 ms** en fase `play`, `chain = 0`. `mult = multFor(chain) = min(1 + floor(chain / 20), 5)` (×2 a la 20.ª seguida, ×5 a la 80.ª). La cadena se conserva entre vueltas (el contador `sinceDotMs` no avanza fuera de `play`).
- **Susto (energizante):** todos los fantasmas `active` pasan a `frightened` e invierten dirección. Duración `frightMs(lap) = max(6000 − 500 × (lap − 1), 2000)` ms; los últimos **1500 ms** parpadean blanco/azul cada 150 ms. Otro energizante reinicia la duración sin reiniciar `ghostCombo`. Al terminar vuelven a `active` y `ghostCombo = 0`.
- **Colisión con fantasma:** distancia entre centros < **16 px** (en cada subpaso). Si está `frightened`: `ghostCombo + 1`, suma **200 / 400 / 800 / 1600** (sin multiplicador de combo) y pasa a `eyes`, que van al centro de (9,7), bajan por la puerta (`entering`) a (9,9) y salen de nuevo (`leaving`) ya `active`; el juego no se congela. Si está `active`: fase `hit`.
- **Golpe (`hit`):** `timeLeftMs − 10000` (si queda ≤ 0 → game over inmediato), `chain = 0`, `onStat("mult", 1)` si cambió; Pac-Man parpadea **800 ms** con todo quieto; luego posiciones iniciales de Pac-Man y fantasmas, susto cancelado y `ready` de **1000 ms**. Las píldoras comidas no vuelven.
- **Reloj bonus:** cuando `lapDotsEaten` llega a **75** (mitad de la vuelta) aparece un reloj en el centro de (9,11) durante **8000 ms** (uno por vuelta). Comerlo (distancia < 16 px): **+5000 ms** al reloj y **500** puntos (sin multiplicador).
- **Vuelta completada:** al comer la pieza 150, fase `clear` de **1000 ms** (muros parpadean blanco/magenta cada 125 ms), luego `lap + 1`, `onLevel(lap)`, **+10000 ms** al reloj, laberinto rellenado con `parseMaze()`, `lapDotsEaten = 0`, reloj bonus disponible de nuevo, posiciones iniciales y `ready` de **1000 ms**.
- **Inicio:** `ready` de **1500 ms** al empezar o reiniciar la partida.
- **Dibujo:** fondo `#05000a`. Muros: por cada celda `#` se trazan los bordes que lindan con una celda no muro, primero en `#ff2bd6` con alfa 0.35 y 5 px y encima en `#ff2bd6` con 2 px (brillo sin `shadowBlur`); se dibujan una vez en `mazeCanvas` (offscreen por instancia). Puerta: línea `#00f5ff` de 3 px. Píldora: círculo `#00f5ff` de radio 3. Energizante: círculo `#00f5ff` de radio 8 que late (radio 6–9 a 4 Hz). Pac-Man: círculo `#ffe600` de radio 12 con boca 0°–45° a 12 Hz mientras se mueve; con `mult ≥ 2`, anillo `#ff2bd6` de radio 16 y grosor `mult − 1` px. Fantasmas: semicírculo superior de radio 12 + rectángulo + 3 picos, colores rojo `#ff3355`, rosa `#ffb8ff`, cian `#00ffff`, naranja `#ffb852`; ojos blancos con pupila `#1a1aff` mirando a `dir`. Asustado: cuerpo `#1a1aff` con cara `#ffb8ae` (parpadeo: cuerpo `#ffffff`). Ojos: solo los ojos. Reloj bonus: círculo blanco de radio 10 con borde `#ffe600` y dos manecillas `#05000a`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pac-man` en `app/globals.css`. Aplicar migración `add_game_pac_man` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pac-man'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/pac-man/maze.ts`. Verificar: `npm run lint`; `parseMaze()` cuenta 146 píldoras y 4 energizantes; las 21 filas miden 19.
3. Crear `lib/games/pac-man/balance.ts`. Verificar: `npm run lint`; `speeds(1)` = Pac-Man 196 / fantasma 168, `speeds(7)` = 280 / 252; `chaseChance(5) = 0.9`; `frightMs(9) = 2000`; `multFor(19) = 1`, `multFor(20) = 2`, `multFor(200) = 5`.
4. Crear `lib/games/pac-man/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/pac-man/engine.ts` y exportar `pacManDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"pac-man"` en `lib/games/registry.ts`. Verificar: `/games/pac-man/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): reloj bajando desde 120 en el HUD, giro con buffer, reversa, túnel, salida de fantasmas a 2/4/6 s, combo ×2 a las 20 píldoras seguidas y vuelta a ×1 tras 700 ms sin comer, energizante (huida, 200→1600), reloj bonus a las 75 piezas, golpe (−10 s, combo a ×1, píldoras conservadas), cerrar la vuelta 1 (+10 s, nivel 2, laberinto lleno), agotar el tiempo, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'pac-man'` (registrarla en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pac-man` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pac-man`), la ficha `/games/pac-man` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`LABERINTO`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/pac-man/jugar` muestra el canvas 532×588 sin desborde a 375 px y 1280 px.
- [ ] El laberinto coincide con `MAZE` y empieza con 150 piezas (146 píldoras + 4 energizantes).
- [ ] El HUD de React muestra puntaje, nivel (vuelta), TIEMPO (empieza en 120) y COMBO (empieza en 1); no muestra vidas; sin eventos por frame (TIEMPO cambia una vez por segundo).
- [ ] `←↑→↓` y `WASD` mueven a Pac-Man; un giro pulsado antes de la esquina se aplica en ella; la reversa es inmediata; las flechas no hacen scroll.
- [ ] Pac-Man nunca atraviesa muros ni la puerta; el túnel de la fila 9 lleva al otro lado.
- [ ] Vuelta 1: Pac-Man 196 px/s, fantasmas 168 px/s, asustados 112 px/s; los fantasmas de la casa salen a los 2, 4 y 6 s.
- [ ] Píldora = 10 × combo, energizante = 50 × combo; el combo pasa a 2 en la 20.ª pieza seguida, llega como máximo a 5 y vuelve a 1 tras 700 ms sin comer.
- [ ] El energizante asusta 6000 ms en la vuelta 1 (parpadeo los últimos 1500 ms); los asustados huyen; comerlos suma 200, 400, 800 y 1600 sin multiplicador y sus ojos vuelven a la casa.
- [ ] Tocar un fantasma activo resta 10 s, pone el combo en 1, congela 800 ms y resetea posiciones conservando las píldoras comidas.
- [ ] El reloj bonus aparece en (9,11) a las 75 piezas de la vuelta, dura 8000 ms y suma 5 s y 500 puntos.
- [ ] Comer las 150 piezas hace parpadear los muros 1000 ms, sube el nivel del HUD, suma 10 s (sin pasar de 300) y rellena el laberinto; la vuelta 2 es más rápida (210 / 182 px/s).
- [ ] El reloj no baja durante `ready`, `hit`, `clear` ni pausa.
- [ ] Al llegar el tiempo a 0 (por reloj o por golpe) se emite `onStat("time", 0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] Pausa (botón y `P`) congela Pac-Man, fantasmas, reloj, cadena, susto y reloj bonus; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y WASD) no mueve a Pac-Man.
- [ ] Guardar inserta en `scores` con `game_id = 'pac-man'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pac-man` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vuelta 1, TIEMPO 120, COMBO 1, 150 piezas, posiciones iniciales).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pac-man/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de contrarreloj; **No:** portar código externo (no existe en `references/`).
- **Sí:** laberinto compacto 19×21 literal en el spec (vueltas cortas, ~150 piezas); **No:** el laberinto arcade 28×31 (es de la variante 01) ni generación procedural.
- **Sí:** tiempo como único recurso y sin vidas (partidas acotadas y comparables); **No:** `initialLives` (el HUD no muestra vidas y no se emite `onLives`).
- **Sí:** golpe = −10 s en vez de muerte; **No:** game over por contacto.
- **Sí:** cadena con ventana de 700 ms y multiplicador hasta ×5 (premia rutas limpias); **No:** multiplicar los fantasmas ni el reloj bonus (evita explosiones de puntaje).
- **Sí:** IA única probabilística que se endurece por vuelta; asustados huyen; **No:** personalidades ni horario dispersión/persecución.
- **Sí:** reloj bonus como recompensa a mitad de vuelta; **No:** frutas.
- **Sí:** stats `TIEMPO` (`int`, una emisión por segundo) y `COMBO`; nivel = vuelta.
- **Sí:** subpasos de 4 px y decisión en centros de celda; **No:** movimiento libre con colisión AABB contra muros.
- **Sí:** valores de balance (reloj, bonus, velocidades, probabilidad de caza, susto, cadena) fijados en este spec, ajustables solo editándolo.
- **Sí:** muros pintados una vez en un canvas offscreen por instancia (SPEC 13); brillo con doble trazo, **No:** `shadowBlur` por frame.
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por `missile-command`.
- **Sí:** `.cover-pac-man` nueva basada en `.cover-glot`; **No:** reutilizar `cover-glot` (la convención es `cover-<id>`).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pac-Man y un fantasma se cruzan entre frames sin colisionar (velocidades hasta 280).  | Subpasos de ≤ 4 px y comprobación de distancia < 16 px en cada subpaso.                                            |
| Un fantasma se salta un centro de celda y atraviesa un muro.                          | Ningún subpaso cruza un centro sin detenerse en él y evaluar la IA.                                                |
| Golpes encadenados al reaparecer junto a un fantasma.                                 | Tras `hit` todos vuelven a posiciones iniciales y los de la casa salen escalonados desde 2 s.                     |
| Emitir `onStat("time")` por frame satura React.                                       | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)` (1 vez/s) y `mult` solo al cambiar.                       |
| El reloj sigue corriendo en pausa, blur o fases congeladas.                            | `timeLeftMs` y `sinceDotMs` solo avanzan en `play`; `lastTime` se reinicia al reanudar; `dt` capado a 50 ms.       |
| Huida de los asustados los deja oscilando en un pasillo.                              | No pueden invertir (solo eligen entre direcciones no opuestas), así que siempre avanzan.                           |
| Flechas o WASD interfieren con el input del modal.                                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| El id con guion requiere comillas en `ENGINES` y nombres de migración.                | Clave `"pac-man"` entre comillas; carpeta `lib/games/pac-man/`; migración `add_game_pac_man`.                      |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas, frutas, personalidades de fantasmas y horario dispersión/persecución.
- Fantasmas dormidos en tren, bombas, varios laberintos o rellenado por mitades.
- HUD nativo de texto dentro del canvas y overlays de "READY!", pausa, vuelta o game over.
- Selector de duración o dificultad.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
