# SPEC GJ-pac-man-01 — Juego real: PAC-MAN (variante: clásico arcade) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Variant:** 01 de 2 — Pac-Man fiel al arcade de 1980: laberinto 28×31, cuatro fantasmas con personalidades propias (Blinky, Pinky, Inky, Clyde), ciclo dispersión/persecución, energizantes, frutas por nivel, 3 vidas y niveles infinitos.
> **Objective:** Crear un motor TypeScript de Pac-Man dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pac-man` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Pac-Man. Recrea el arcade clásico: limpiar el laberinto de 244 píldoras nivel a nivel con **3 vidas**, esquivando cuatro fantasmas cuya IA de objetivos (target tile) los hace comportarse distinto, y alternando entre **dispersión y persecución** según un horario por nivel. El reto es aprender patrones y gestionar los energizantes. Se distingue de la variante 02 (contrarreloj con laberinto compacto 19×21, sin vidas, tiempo como recurso, laberinto que se rellena por vueltas, combo multiplicador y fantasmas con IA probabilística idéntica): aquí la partida se mide en **niveles y vidas**, con IA determinista y personalidades.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con arcos, rectángulos y líneas. En `app/globals.css` existe `.cover-glot` (prototipo "GLOTÓN" de `references/templates/data.jsx`, no usado por la BD); se crea `.cover-pac-man` tomándola como base y `.cover-glot` no se toca.

Decisiones fijadas por el agente (no se reabren): `id` `pac-man`, título `PAC-MAN`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 3, tags `CLÁSICO` y `LABERINTO`, 1 jugador, teclado. Canvas **560×620**, rejilla **28 columnas × 31 filas de 20 px**. **3 vidas** (`initialLives: 3`), **niveles infinitos** (`showLevel: true`), sin stats extra. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pac-man/engine.ts`: sin globals de módulo; exporta `pacManDef: GameEngineDef` con `createPacMan(canvas, events) → GameController`.
- Módulo `lib/games/pac-man/maze.ts`: `MAZE` (las 31 filas literales de abajo), `COLS = 28`, `ROWS = 31`, `TILE = 20`, `parseMaze() → { walls, dots, energizers }` (copias nuevas por llamada, nunca estado compartido) y `isWall(col, row, forGhostDoor)`.
- Módulo `lib/games/pac-man/ghosts.ts`: funciones puras de IA (`targetTile(ghost, pac, blinky, mode)`, `chooseDir(tile, dir, target, walls)`), horario `modeSchedule(level)`, velocidades `speeds(level)`, duración de susto `frightMs(level)` y tabla de frutas `fruitFor(level)`.
- Módulo `lib/games/pac-man/draw.ts`: `drawMaze` (a un canvas offscreen creado por instancia, una vez por nivel), `drawDots`, `drawPac`, `drawGhost`, `drawFruit`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pac-man"` en `lib/games/registry.ts`.
- Clase `.cover-pac-man` en `app/globals.css`: copia de `.cover-glot` (fondo `radial-gradient(circle at 50% 50%, #1a002a, #0a0a18)`, Pac-Man amarillo con boca y puntos cyan) más un fantasma magenta en `::before` en lugar de los puntos de texto.
- Migración `add_game_pac_man`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **560×620** (28×31 celdas de 20 px).
- HUD de React: puntaje, **3 vidas** y **nivel**. Sin stats extra.
- Sin HUD nativo de texto en el canvas; la fruta del nivel se ve solo en el tablero.
- Controles: `←↑→↓` y `WASD` (dirección con buffer). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pac-man'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pac-man`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Intermedios animados ("cutscenes"), pantalla de atracción, zonas prohibidas de giro hacia arriba, "Elroy" (aceleración de Blinky con pocas píldoras), bug de desbordamiento de Pinky/Inky y nivel 256.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pac-man', 'PAC-MAN', 'Come todas las píldoras sin que te atrapen.',
       'Recorre el laberinto con las flechas o WASD y cómete las 244 píldoras para pasar de nivel. Blinky, Pinky, Inky y Clyde te persiguen cada uno a su manera; los energizantes los vuelven azules durante unos segundos y comerte varios seguidos dobla los puntos. Recoge la fruta, gana una vida extra a los 10000 puntos y sobrevive con tus 3 vidas.',
       'ARCADE', 'yellow', 'cover-pac-man', 1, 1, '{keyboard}', '{CLÁSICO,LABERINTO}', 3, 7, false);

Definición del motor:

    export const pacManDef: GameEngineDef = {
      width: 560, height: 620,
      initialLives: 3,
      showLevel: true,
      create: createPacMan,
    };

Laberinto (`MAZE`, 31 filas × 28 columnas; `#` muro, `.` píldora, `o` energizante, `_` pasillo vacío, `-` puerta de la casa; columnas 0–27, filas 0–30):

    ############################
    #............##............#
    #.####.#####.##.#####.####.#
    #o####.#####.##.#####.####o#
    #.####.#####.##.#####.####.#
    #..........................#
    #.####.##.########.##.####.#
    #.####.##.########.##.####.#
    #......##....##....##......#
    ######.#####_##_#####.######
    ######.#####_##_#####.######
    ######.##__________##.######
    ######.##_###--###_##.######
    ######.##_#______#_##.######
    ______.___#______#___.______
    ######.##_#______#_##.######
    ######.##_########_##.######
    ######.##__________##.######
    ######.##_########_##.######
    ######.##_########_##.######
    #............##............#
    #.####.#####.##.#####.####.#
    #.####.#####.##.#####.####.#
    #o..##.......__.......##..o#
    ###.##.##.########.##.##.###
    ###.##.##.########.##.##.###
    #......##....##....##......#
    #.##########.##.##########.#
    #.##########.##.##########.#
    #..........................#
    ############################

Contiene **240 píldoras + 4 energizantes = 244**; todo pasillo es alcanzable y no hay callejones sin salida. Fila 14 = túnel (envuelve horizontalmente). Casa de fantasmas: interior filas 13–15, columnas 11–16; puerta en (13,12) y (14,12).

Estado interno (dentro de `createPacMan`): `walls`, `dots: Uint8Array` (0 vacío, 1 píldora, 2 energizante), `dotsLeft`, `dotsEaten`, `pac { x, y, dir, nextDir, mouth }` (centro en px), `ghosts: { name, x, y, dir, state: "house" | "leaving" | "active" | "frightened" | "eyes" | "entering", releaseAt }[4]`, `modeIndex`, `modeMs`, `frightLeftMs`, `ghostCombo`, `fruit { kind, points, leftMs } | null`, `fruitsSpawned`, `phase: "ready" | "play" | "dying" | "clear"`, `phaseMs`, `level`, `lives`, `score`, `extraLifeGiven`, `paused`, `finished`, `lastTime`, `rafId`, `mazeCanvas` (offscreen por instancia), `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy limpian `nextDir`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` no emite eventos.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, "READY!", nivel superado ni game over dentro del canvas (el parpadeo de muros al limpiar el nivel es animación del tablero, no overlay).

**Reglas del juego:**

- **Coordenadas y movimiento:** cada entidad tiene su centro en px; su celda es `floor(x / 20), floor(y / 20)`. El movimiento se integra en subpasos de como máximo **4 px** por entidad (`n = ceil(maxVel × dt / 4)`); ninguna entidad cruza el centro de una celda sin evaluarlo. Al llegar a un centro se decide el giro; entre centros solo se avanza en línea recta.
- **Túnel:** en la fila 14, si `x < −10` pasa a `x = 570` y viceversa (las columnas fuera de rango cuentan como pasillo en la fila 14).
- **Pac-Man:** empieza en el centro de la celda (13,23) mirando a la izquierda, quieto hasta la primera tecla o al acabar `ready`. `←↑→↓`/`WASD` fijan `nextDir`; la reversa (dirección opuesta) se aplica al instante en cualquier punto; otros giros se aplican en el siguiente centro de celda si la celda vecina no es muro ni puerta; `nextDir` persiste hasta aplicarse o ser reemplazado. Si la celda siguiente en `dir` es muro, se detiene en el centro.
- **Velocidades (px/s)** según `speeds(level)`:

  | Nivel | Pac-Man | Fantasma | Fantasma asustado | Fantasma en túnel |
  | ----- | ------- | -------- | ----------------- | ----------------- |
  | 1     | 150     | 140      | 80                | 70                |
  | 2–4   | 165     | 155      | 90                | 80                |
  | 5+    | 180     | 170      | 100               | 90                |

  "En túnel" = fila 14 y columna ≤ 5 o ≥ 22. Ojos: **300 px/s**. Dentro de la casa (`house`/`leaving`/`entering`): **70 px/s**.
- **Píldoras:** píldora **10** puntos; energizante **50**. Se comen al entrar Pac-Man en la celda. Los energizantes parpadean (visibles 250 ms / ocultos 250 ms).
- **Fantasmas — inicio:** Blinky en el centro de (13,11) mirando a la izquierda, `active`. Pinky (13,14), Inky (11,14), Clyde (15,14) en `house`, oscilando arriba/abajo ±4 px.
- **Liberación desde la casa:** al empezar nivel, Pinky sale al instante; Inky cuando `dotsEaten ≥ 30` (nivel 1) o al instante (nivel 2+); Clyde cuando `dotsEaten ≥ 60` (nivel 1), `≥ 50` (nivel 2) o al instante (nivel 3+). Además, si pasan **4000 ms** sin comer píldora, sale el siguiente fantasma en casa (orden Pinky, Inky, Clyde) y el temporizador se reinicia. Tras perder una vida, los contadores se ignoran: Pinky sale a los 1000 ms, Inky a los 3000 ms y Clyde a los 5000 ms de empezar `play`. Salir (`leaving`): se mueve en horizontal hasta `x = 270` (centro de la columna 13), sube hasta el centro de (13,11) y pasa a `active` mirando a la izquierda.
- **Modo global dispersión/persecución** (`modeSchedule(level)`, ms; el último tramo es infinito):
  - Nivel 1: dispersión 7000, persecución 20000, dispersión 7000, persecución 20000, dispersión 5000, persecución 20000, dispersión 5000, persecución ∞.
  - Niveles 2–4: dispersión 7000, persecución 20000, dispersión 7000, persecución 20000, dispersión 5000, persecución ∞.
  - Nivel 5+: dispersión 5000, persecución 20000, dispersión 5000, persecución 20000, dispersión 5000, persecución ∞.
  - El temporizador de modo se congela mientras `frightLeftMs > 0`. Cada cambio de modo invierte la dirección de los fantasmas `active`.
- **Objetivos (target tile)** en persecución, siendo `P` la celda de Pac-Man y `d` su dirección:
  - Blinky (rojo): `P`.
  - Pinky (rosa): `P + 4·d`.
  - Inky (cian): `2·(P + 2·d) − celda de Blinky`.
  - Clyde (naranja): `P` si la distancia euclídea a `P` es > 8 celdas; si no, su esquina de dispersión.
  - Esquinas de dispersión: Blinky (25,−3), Pinky (2,−3), Inky (27,33), Clyde (0,33).
- **Decisión de giro (`chooseDir`):** en cada centro de celda, un fantasma `active` elige entre las direcciones no muro, no puerta y **no opuestas** a la actual la que minimiza la distancia euclídea al cuadrado del centro de la celda vecina al objetivo; empate por prioridad arriba, izquierda, abajo, derecha. Nunca invierte salvo por cambio de modo o inicio de susto.
- **Susto (energizante):** todos los fantasmas `active` pasan a `frightened` e invierten dirección; los que están en casa no se asustan. Duración `frightMs(level) = max(6000 − 1000 × (level − 1), 1000)` ms. En `frightened` eligen al azar (`Math.random`) entre las direcciones válidas no opuestas. Los últimos **2000 ms** (o todo el susto si dura menos) parpadean blanco/azul cada 200 ms. Comer otro energizante reinicia la duración y **no** reinicia `ghostCombo`. Al terminar, vuelven a `active` sin invertir.
- **Comer fantasmas:** Pac-Man y un fantasma colisionan si la distancia entre centros es < **12 px** (se comprueba en cada subpaso). Si está `frightened`: `ghostCombo + 1` y se suman **200 / 400 / 800 / 1600** (1.º a 4.º del mismo susto; `ghostCombo` vuelve a 0 al acabar el susto); el fantasma pasa a `eyes`, el juego se congela **500 ms** (solo se mueven los demás ojos). Los ojos van al centro de (13,11) con `chooseDir` (objetivo esa celda), bajan por la puerta (`entering`) hasta (13,14), y salen de nuevo (`leaving`) ya `active`. Si está `active`, Pac-Man muere.
- **Frutas:** aparece en el centro de la celda (13,17) cuando `dotsEaten` llega a **70** y a **170** (máx. 2 por nivel) y dura **9500 ms**. Comerla (distancia < 12 px) suma según `fruitFor(level)`: nivel 1 cereza **100**; 2 fresa **300**; 3–4 naranja **500**; 5–6 manzana **700**; 7–8 melón **1000**; 9–10 nave **2000**; 11–12 campana **3000**; 13+ llave **5000**.
- **Vida extra:** al cruzar **10000** puntos por primera vez, `lives + 1` y `onLives(lives)` (una sola vez por partida; máximo 5 vidas).
- **Fases:** `ready` de **2000 ms** al empezar cada nivel y tras cada muerte (todo quieto). `dying` de **1500 ms** (los fantasmas desaparecen; Pac-Man abre la boca de 0° a 360°); luego `lives − 1`, `onLives(lives)`; si `lives = 0` → `onGameOver(score)` (tras `onLives(0)`); si no, se resetean posiciones de Pac-Man y fantasmas, `modeIndex = 0`, fruta retirada, y `ready`. Las píldoras comidas no vuelven.
- **Nivel superado:** al comer la píldora 244, fase `clear` de **2000 ms** (muros parpadean blanco/azul cada 250 ms), luego `level + 1`, `onLevel(level)`, laberinto rellenado con `parseMaze()`, `dotsEaten = 0`, posiciones iniciales y `ready`.
- **Dibujo:** fondo `#000`. Muros: por cada celda `#` se trazan en `#2121ff` (2 px) los bordes que lindan con una celda no muro (el túnel y el exterior quedan cerrados); se dibujan una vez por nivel en `mazeCanvas` (offscreen por instancia). Puerta: línea `#ffb8ff` de 3 px. Píldora: cuadrado `#ffb897` de 4×4 centrado. Energizante: círculo `#ffb897` de radio 7. Pac-Man: círculo `#ffe600` de radio 9 con boca abierta 0°–45° oscilando a 10 Hz mientras se mueve, orientada a `dir`. Fantasmas: semicírculo superior de radio 9 + rectángulo + 3 picos inferiores, colores Blinky `#ff0000`, Pinky `#ffb8ff`, Inky `#00ffff`, Clyde `#ffb852`; ojos blancos con pupila `#2121ff` mirando a `dir`. Asustado: cuerpo `#2121ff` con boca y ojos `#ffb8ae` (parpadeo: cuerpo `#ffffff`, cara `#ff0000`). Ojos: solo los ojos. Frutas con 1–3 círculos y un trazo de tallo, colores: cereza `#ff0000`, fresa `#ff3355`, naranja `#ffa500`, manzana `#ff2020`, melón `#39ff14`, nave `#ffe600`, campana `#ffe600`, llave `#00f5ff`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pac-man` en `app/globals.css`. Aplicar migración `add_game_pac_man` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pac-man'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/pac-man/maze.ts`. Verificar: `npm run lint`; `parseMaze()` cuenta 240 píldoras y 4 energizantes; las 31 filas miden 28.
3. Crear `lib/games/pac-man/ghosts.ts`. Verificar: `npm run lint`; `frightMs(1) = 6000`, `frightMs(6) = 1000`; `modeSchedule(1)` tiene 8 tramos; `fruitFor(13).points = 5000`.
4. Crear `lib/games/pac-man/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/pac-man/engine.ts` y exportar `pacManDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"pac-man"` en `lib/games/registry.ts`. Verificar: `/games/pac-man/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): giro con buffer, reversa instantánea, túnel, salida escalonada de fantasmas, Blinky persigue y los demás se separan en dispersión, energizante (fantasmas azules, combo 200→1600, parpadeo final), fruta a las 70 píldoras, morir (vidas 3 → 2, píldoras conservadas), limpiar el nivel 1 (nivel 2, velocidades nuevas), vida extra a 10000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'pac-man'` (registrarla en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pac-man` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pac-man`), la ficha `/games/pac-man` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`LABERINTO`, dificultad 3, color amarillo, categoría ARCADE).
- [ ] `/games/pac-man/jugar` muestra el canvas 560×620 sin desborde a 375 px y 1280 px.
- [ ] El laberinto coincide con `MAZE` y empieza con 244 píldoras (240 + 4 energizantes).
- [ ] `←↑→↓` y `WASD` mueven a Pac-Man; un giro pulsado antes de la esquina se aplica en ella; la reversa es inmediata; las flechas no hacen scroll.
- [ ] Pac-Man nunca atraviesa muros ni la puerta de la casa; el túnel de la fila 14 lo lleva al otro lado (también a los fantasmas, que van a 70 px/s en nivel 1 dentro del túnel).
- [ ] Velocidades del nivel 1: Pac-Man 150 px/s, fantasmas 140 px/s, asustados 80 px/s.
- [ ] Píldora +10, energizante +50; Pinky sale al empezar, Inky a las 30 píldoras y Clyde a las 60 en el nivel 1.
- [ ] En dispersión cada fantasma va a su esquina; en persecución Blinky sigue la celda de Pac-Man; cada cambio de modo invierte su dirección.
- [ ] El energizante asusta a los fantasmas 6000 ms en nivel 1 (parpadeo los últimos 2000 ms); comerlos suma 200, 400, 800 y 1600; sus ojos vuelven a la casa y salen de nuevo.
- [ ] La fruta aparece en (13,17) a las 70 y 170 píldoras, dura 9500 ms y en nivel 1 vale 100.
- [ ] Tocar un fantasma activo inicia `dying` (1500 ms), baja las vidas del HUD y resetea posiciones conservando las píldoras comidas.
- [ ] Comer las 244 píldoras hace parpadear los muros 2000 ms, sube el nivel del HUD y rellena el laberinto.
- [ ] Al cruzar 10000 puntos se gana una vida (una vez por partida).
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0) y nivel; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela Pac-Man, fantasmas, modo, susto y fruta; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y WASD) no mueve a Pac-Man.
- [ ] Guardar inserta en `scores` con `game_id = 'pac-man'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pac-man` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, 244 píldoras, posiciones iniciales, vida extra disponible).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pac-man/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade; **No:** portar código externo (no existe en `references/`).
- **Sí:** laberinto clásico 28×31 literal en el spec; **No:** generarlo proceduralmente (rompe la fidelidad y los patrones).
- **Sí:** IA de objetivos por fantasma y horario dispersión/persecución (identidad del clásico); **No:** Elroy, zonas sin giro hacia arriba ni el bug de desbordamiento (complejidad sin valor para el leaderboard).
- **Sí:** subpasos de 4 px y decisión en centros de celda; **No:** movimiento libre con colisión AABB contra muros.
- **Sí:** `initialLives: 3`, `showLevel: true`, sin stats extra (el HUD clásico basta).
- **Sí:** liberación por contadores de píldoras y temporizador de 4000 ms; tras morir, liberación por tiempo fijo (simplificación del contador global del original).
- **Sí:** valores de balance (velocidades, horario, susto, frutas, vida extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** muros pintados una vez por nivel en un canvas offscreen por instancia (SPEC 13); **No:** recalcularlos por frame.
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por `missile-command`.
- **Sí:** `.cover-pac-man` nueva basada en `.cover-glot`; **No:** reutilizar `cover-glot` (la convención es `cover-<id>`).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pac-Man y un fantasma se cruzan entre frames sin colisionar.                          | Subpasos de ≤ 4 px y comprobación de distancia < 12 px en cada subpaso.                                         |
| Un fantasma se salta un centro de celda y atraviesa un muro.                          | Ningún subpaso cruza un centro sin detenerse en él y evaluar `chooseDir`.                                       |
| Fantasmas atascados en la casa o en la puerta.                                        | Estados `leaving`/`entering` con trayectoria fija (x = 270, luego vertical); la puerta solo es muro para `active`/`frightened` y Pac-Man. |
| Errores en el `MAZE` literal (fila con 27 o 29 columnas, píldora inalcanzable).      | Verificación del paso 2 (31 × 28, 240 + 4); el spec ya fue comprobado sin callejones ni zonas aisladas.         |
| `dt` grande tras pausar o cambiar de pestaña teletransporta entidades.               | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                            |
| Flechas o WASD interfieren con el input del modal.                                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Emitir `onScore` por cada píldora satura React.                                       | Es un cambio real de valor (máx. ~8/s); nunca se emite sin cambio ni por frame.                                 |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                          |
| El id con guion requiere comillas en `ENGINES` y nombres de migración.                | Clave `"pac-man"` entre comillas; carpeta `lib/games/pac-man/`; migración `add_game_pac_man`.                   |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                 |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Intermedios, pantalla de atracción, Elroy, zonas sin giro hacia arriba, bug de desbordamiento y nivel 256.
- HUD nativo de texto dentro del canvas y overlays de "READY!", pausa, nivel o game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
