# SPEC GJ-tron-vs-cpu-01 — Juego real: TRON VS CPU (variante: duelo clásico por rondas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Variant:** 01 de 2 — Duelo fiel a las Light Cycles: una moto contra una CPU, estelas permanentes, rondas cortas y una CPU que se vuelve más lista cada ronda.
> **Objective:** Crear un motor TypeScript de Tron vs CPU (variante duelo clásico) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/tron-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Tron vs CPU (sugerencia de `references/game-suggestions-todo.md`: motos con estela en rejilla, 3 vidas, rondas). Es la versión **fiel al clásico**: **1 contra 1**, las estelas **no desaparecen** durante la ronda, no hay turbo, ni ítems, ni límite de estela. Cada ronda termina cuando una moto choca; el tablero se limpia y empieza la siguiente con una CPU más rápida y con mejor IA. Se distingue de la variante 02 (arena con 1–3 CPUs simultáneas, turbo con energía, estelas de largo limitado, orbes y supervivencia continua sin rondas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07; la referencia más cercana es `lib/games/snake/engine.ts` (movimiento por celda con acumulador y cola de giros), pero no se reutiliza su código ni sus sprites. Todo se dibuja con rectángulos y círculos. No existe clase cover para este juego en `app/globals.css` (`.cover-duelo` es del prototipo de Pong y no se toca); se crea `.cover-tron-vs-cpu`.

Decisiones fijadas por el agente (no se reabren): `id` `tron-vs-cpu`, título `TRON VS CPU`, `cat` `VERSUS`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, `missile-command` = 6 reservado en `specs/game-jam/missile-command/`), dificultad 3, tags `CLÁSICO` y `DUELO`, 1 jugador (contra la CPU), teclado. Canvas **640×480** (4:3), rejilla de **40 columnas × 30 filas de 16 px**. **3 vidas** (`initialLives: 3`), el **nivel es la ronda** (`showLevel: true`), stat extra `VICTORIAS`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/tron-vs-cpu/engine.ts`: sin globals de módulo; exporta `tronVsCpuDef: GameEngineDef` con `createTronVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/tron-vs-cpu/ai.ts`: funciones puras sin estado de módulo: `freeRun(grid, x, y, dir, cap)`, `floodArea(grid, x, y, cap)`, `chooseCpuDir(grid, cpu, player, round, rand)` y `cpuParams(round)` (devuelve `{ errorProb, mode, aggressive }`).
- Módulo `lib/games/tron-vs-cpu/draw.ts`: `drawBoard` (fondo + rejilla + borde, pintado una vez en un canvas offscreen por instancia), `drawTrailCell`, `drawHead`, `drawCrash`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"tron-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-tron-vs-cpu` en `app/globals.css`: fondo `#02040a` con rejilla `repeating-linear-gradient` cian al 8 % cada 16 px y `::after` con dos estelas en L (una `var(--cyan)` desde la izquierda y otra `var(--magenta)` desde la derecha, 6 px de grosor) que casi se cruzan en el centro, con `drop-shadow(0 0 6px rgba(0,245,255,0.5))`.
- Migración `add_game_tron_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **640×480**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= ronda actual) y stat extra `wins` ("VICTORIAS", `int`).
- Sin HUD nativo de texto en el canvas: solo tablero, estelas, cabezas y anillo de choque.
- Controles: `←↑→↓` y `WASD` giran la moto. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'tron-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `tron-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Varias CPUs, turbo, ítems, estelas de largo limitado o que desaparecen, modo wrap.
- Modo local de 2 jugadores humanos.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('tron-vs-cpu', 'TRON VS CPU', 'Encierra a la CPU con tu estela de luz.',
       'Conduce tu moto de luz con las flechas o WASD: deja una estela sólida tras de ti y obliga a la CPU a chocar contra ella, contra el muro o contra su propia estela. Cada ronda ganada vale más que la anterior, pero la CPU se vuelve más rápida y astuta. Tienes tres vidas; cada choque te cuesta una.',
       'VERSUS', 'cyan', 'cover-tron-vs-cpu', 1, 1, '{keyboard}', '{CLÁSICO,DUELO}', 3, 7, false);

Definición del motor:

    export const tronVsCpuDef: GameEngineDef = {
      width: 640, height: 480,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "wins", label: "VICTORIAS", color: "cyan", format: "int" }],
      create: createTronVsCpu,
    };

Estado interno (dentro de `createTronVsCpu`): `grid: Uint8Array(40 × 30)` (0 libre, 1 estela jugador, 2 estela CPU), `player { x, y, dir }`, `cpu { x, y, dir }`, `dirQueue` (máx. 2 giros pendientes del jugador), `phase: "ready" | "run" | "crash"`, `phaseMs`, `crash: { x, y, who: "player" | "cpu" | "both", ms }[]`, `round`, `wins`, `lives`, `score`, `tickMs`, `acc`, `trailLen` (celdas recorridas por el jugador en la ronda), `rand` (`Math.random`), `boardCanvas` (offscreen, fondo y rejilla), `trailCanvas` (offscreen, estelas pintadas de forma incremental), `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (ronda), `onStat("wins", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("wins", 0)` (0 oculta el stat, esperado al inicio).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (con el anillo de choque a medio dibujar) queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa.
- Pausa/blur/destroy limpian `dirQueue`; al reanudar se reinicia `lastTime` y `acc = 0`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 40×30 celdas de 16 px; el borde exterior es muro (salir de `x ∈ [0, 39]` o `y ∈ [0, 29]` es choque).
- **Inicio de ronda:** `grid` vacío. Jugador en (8, 15) mirando a la derecha; CPU en (31, 15) mirando a la izquierda. Ambas celdas iniciales se marcan como estela de su dueño. `trailLen = 1`, `acc = 0`, `dirQueue` vacío.
- **Fase `ready`:** **1200 ms** sin movimiento; las cabezas parpadean (visibles 150 ms / ocultas 150 ms). Durante `ready` el jugador puede encolar giros (se aplican en el primer paso). Luego `phase = "run"`.
- **Velocidad:** `tickMs = max(55, 95 − 5 × (round − 1))` (ronda 1: 95 ms; ronda 9+: 55 ms). Ambas motos avanzan una celda por tick, a la vez.
- **Giros del jugador:** `←↑→↓` / `WASD`. `dirQueue` admite 2 giros; se descarta un giro igual a la dirección actual (o a la última encolada) o su opuesta (sin reversa de 180°). En cada tick se consume como máximo uno.
- **Paso simultáneo** (en cada tick, en este orden):
  1. Se decide la dirección de la CPU (`chooseCpuDir`) y se aplica el giro encolado del jugador.
  2. Se calculan las dos cabezas nuevas.
  3. Una moto choca si su cabeza nueva sale del tablero o cae en una celda con `grid ≠ 0`. Si ambas cabezas nuevas son la **misma celda**, chocan las dos.
  4. Las motos que no chocan marcan su celda nueva en `grid` y en `trailCanvas`; el jugador suma `trailLen += 1`.
- **Resultado de la ronda** (al primer tick con choque):
  - **Solo choca la CPU → victoria:** `score += 100 × round + Math.floor(trailLen / 2)`, `wins += 1` → `onScore`, `onStat("wins", wins)`.
  - **Solo choca el jugador → derrota:** `lives −= 1` → `onLives(lives)`. Sin puntos.
  - **Chocan ambos → empate:** sin puntos ni pérdida de vida; la ronda **se repite** con el mismo número.
  - Tras victoria o derrota, `round += 1` → `onLevel(round)` (la ronda avanza aunque se pierda).
  - Se pasa a `phase = "crash"` durante **900 ms** (motos quietas, anillo de choque) y luego se inicia la ronda siguiente.
  - Si `lives` llega a 0: `onLives(0)` y `onGameOver(score)` en el mismo tick del choque (no se espera la fase `crash`; el último frame queda como está).
- **IA de la CPU** (`chooseCpuDir`, solo sobre `grid` y las posiciones actuales):
  - Candidatas: seguir recto, girar a la izquierda, girar a la derecha (nunca reversa). Una candidata es **segura** si su celda siguiente está dentro del tablero y libre. Si ninguna es segura, sigue recto (y choca).
  - `errorProb = max(0, 0.20 − 0.04 × (round − 1))` (ronda 1: 0.20; ronda 6+: 0). Con esa probabilidad, elige una candidata segura al azar y termina.
  - **Rondas 1–2 (`mode = "run"`):** puntúa cada candidata segura por `freeRun` (celdas libres en línea recta desde la celda siguiente, tope **10**). Elige la mayor; empate → prefiere recto. Si recto tiene 10 y existe un giro con 10, gira con probabilidad **0.04** por tick (evita líneas eternas).
  - **Rondas 3+ (`mode = "flood"`):** puntúa por `floodArea` (BFS en 4 direcciones desde la celda siguiente sobre celdas libres, tope **400**). Elige la mayor; empate → mayor `freeRun`; empate → recto.
  - **Rondas 5+ (`aggressive = true`):** entre las candidatas con `floodArea ≥ 0.9 × máximo`, elige la que minimiza la distancia Manhattan a la celda objetivo `jugador + 3 × dirJugador` (recortada al tablero). Empate → recto.
- **Puntaje de referencia:** ganar las rondas 1, 2 y 3 con estelas de 60 celdas = 130 + 230 + 330 = 690.
- **Dibujo:** fondo `#02040a`; rejilla cada 16 px `rgba(0,245,255,0.07)`; borde 2 px `#00f5ff`. Estela del jugador: rectángulo de 10×10 centrado en la celda más un puente de 10 px de ancho hacia la celda anterior (línea continua), `#00f5ff`. Estela de la CPU igual con `#ff2bd6`. Cabezas: cuadrado 14×14 blanco con borde 2 px del color de su moto. Choque: anillo del color de la moto que choca (blanco si `both`), radio 0 → **40 px** en 600 ms, grosor 3 px, alfa 1 → 0. El fondo se pinta una vez en `boardCanvas`; las estelas se pintan solo al añadirse celdas en `trailCanvas` (se limpia al empezar cada ronda); cada frame compone `boardCanvas` + `trailCanvas` + cabezas + anillos.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente de rejilla y acumulador). Crear `.cover-tron-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_tron_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'tron-vs-cpu'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/tron-vs-cpu/ai.ts`. Verificar: `npm run lint`; en un tablero vacío `freeRun` desde (38, 15) hacia la derecha = 1, `floodArea` desde (0, 0) con tope 400 = 400; `cpuParams(1).errorProb = 0.2`, `cpuParams(6).errorProb = 0`, `cpuParams(3).mode = "flood"`, `cpuParams(5).aggressive = true`.
3. Crear `lib/games/tron-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/tron-vs-cpu/engine.ts` y exportar `tronVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"tron-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/tron-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): fase `ready` con parpadeo y giro pre-encolado, giros y rechazo de 180°, choque con muro, con estela propia y con la de la CPU, victoria (puntos `100 × ronda + trailLen/2`), empate de frente (ronda repetida, sin perder vida), subida de ronda y de velocidad, IA de ronda 3+ que evita encerrarse, pérdida de las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'tron-vs-cpu'` (y anotarlo en `prod-setup.md`). Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `tron-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7, `cat` VERSUS); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-tron-vs-cpu`), la ficha `/games/tron-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`DUELO`, dificultad 3, color cian); aparece al filtrar por VERSUS en `/games`.
- [ ] `/games/tron-vs-cpu/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] Cada ronda empieza con el jugador en (8, 15) hacia la derecha, la CPU en (31, 15) hacia la izquierda y 1200 ms de parpadeo sin movimiento.
- [ ] `←↑→↓` y `WASD` giran la moto; un giro de 180° no se aplica; dos giros rápidos se ejecutan en ticks consecutivos; las flechas no hacen scroll.
- [ ] La velocidad es 95 ms por paso en la ronda 1, baja 5 ms por ronda y no baja de 55 ms.
- [ ] Salir del tablero o entrar en cualquier estela (propia o ajena) es choque; las estelas no desaparecen durante la ronda.
- [ ] Ganar la ronda R suma exactamente `100 × R + floor(trailLen / 2)` y sube VICTORIAS en 1.
- [ ] Perder una ronda resta 1 vida sin puntos; tras victoria o derrota el nivel (ronda) sube en 1.
- [ ] Choque simultáneo (o ambas cabezas en la misma celda) es empate: sin puntos, sin perder vida, se repite la misma ronda.
- [ ] La CPU nunca hace reversa; en ronda 1 comete errores ocasionales y desde la ronda 6 no elige al azar; desde la ronda 3 evita meterse en zonas cerradas pequeñas; desde la ronda 5 busca cortar el paso al jugador.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (ronda) y VICTORIAS; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela motos, fase `ready`/`crash` y anillos; reanudar sin salto ni paso doble.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (incluidas flechas y `WASD`) no mueve la moto.
- [ ] Guardar inserta en `scores` con `game_id = 'tron-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/tron-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, ronda 1, VICTORIAS 0, tablero vacío, 95 ms por paso).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/tron-vs-cpu/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` actualizados.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`) ni reutilizar el motor de Snake (solo se toma el patrón de rejilla + acumulador + cola de giros).
- **Sí:** 1 contra 1 con estelas permanentes; es el Tron clásico y la diferencia central con la variante 02. **No:** varias CPUs, turbo ni ítems.
- **Sí:** movimiento simultáneo por tick con resolución conjunta; **No:** mover primero una moto y luego la otra (daría ventaja injusta en choques de frente).
- **Sí:** empate repite la ronda sin coste; **No:** contar el empate como derrota (castigaría choques de frente inevitables).
- **Sí:** la ronda avanza también al perder; mantiene la partida corta y la dificultad creciente. **No:** repetir la ronda perdida.
- **Sí:** IA por niveles (línea libre → flood-fill → agresiva) con probabilidad de error decreciente; barata (≤ 3 BFS de 400 celdas por tick) y con progresión perceptible.
- **Sí:** puntos solo al ganar (`100 × ronda + trailLen/2`); premia ganar rondas altas y, en menor medida, partidas largas. **No:** puntos por tick sobrevivido (inflaría el puntaje sin ganar).
- **Sí:** `initialLives: 3`, `showLevel: true` (nivel = ronda) y stat `VICTORIAS`.
- **Sí:** canvas 640×480 con celdas de 16 px; espacio suficiente para maniobrar sin que la ronda se alargue.
- **Sí:** fondo y estelas en canvas offscreen por instancia (pintado incremental); evita redibujar hasta 1200 celdas por frame.
- **Sí:** valores de balance (velocidades, tiempos de fase, probabilidades, topes de IA, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS y color cian; **Sí:** `.cover-tron-vs-cpu` nueva; **No:** reutilizar `.cover-duelo` (es del prototipo de Pong).
- **No:** sonido, táctil, HiDPI, skins, modo 2 jugadores (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                 | Mitigation                                                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| La CPU de rondas altas resulta imbatible y el puntaje se estanca.                     | `aggressive` solo desde ronda 5 y con umbral 0.9 del área; verificar rondas 5–8 en el paso 6 y ajustar el spec. |
| La CPU de rondas 1–2 se suicida demasiado pronto y las rondas fáciles no tienen gracia. | `freeRun` con tope 10 + `errorProb` solo entre candidatas seguras (nunca elige una celda ocupada al azar).       |
| Flood-fill por tick cuesta demasiado en móviles.                                       | Tope de 400 celdas, máximo 3 BFS por tick con `Uint8Array` de visitados reutilizado por instancia.              |
| Giros rápidos perdidos o reversa por doble tecla en un mismo tick.                     | Cola de 2 giros validada contra el último giro encolado; un giro por tick.                                     |
| `dt` grande tras pausar o cambiar de pestaña provoca pasos múltiples.                  | `lastTime` y `acc` se reinician al reanudar y tras blur; `dt` capado a 50 ms.                                  |
| Flechas o `WASD` interfieren con el input del modal.                                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Fase `crash` sigue corriendo tras game over y emite eventos extra.                     | Game over se emite en el tick del choque y `finished = true` detiene `update` antes de la fase `crash`.         |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones requiere comillas en `ENGINES` y `_` en la migración.                 | Clave `"tron-vs-cpu"` entre comillas; carpeta `lib/games/tron-vs-cpu/`; migración `add_game_tron_vs_cpu`.       |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Varias CPUs, turbo, orbes/ítems, estelas limitadas o que se desvanecen, modo wrap.
- Modo local de 2 jugadores.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
