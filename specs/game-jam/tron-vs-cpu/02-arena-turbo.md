# SPEC GJ-tron-vs-cpu-02 — Juego real: TRON VS CPU (variante: arena turbo) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Variant:** 02 de 2 — Supervivencia moderna sin rondas: arena con 1 a 3 CPUs simultáneas que reaparecen, turbo con energía, estelas de largo limitado, orbes y puntos por derribo.
> **Objective:** Crear un motor TypeScript de Tron vs CPU (variante arena turbo) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/tron-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Tron vs CPU (sugerencia de `references/game-suggestions-todo.md`: motos con estela en rejilla, 3 vidas). Reinterpreta el clásico como **arena de supervivencia continua**: no hay rondas que se ganan; el objetivo es **derribar** motos CPU haciéndolas chocar contra tu estela mientras sobrevives. Las CPUs **reaparecen** tras morir y su número crece de 1 a 3 con el nivel. Para que la arena no se sature, las estelas tienen **largo máximo** (la cola se apaga) y la de una moto derribada se **desvanece**. El jugador tiene **turbo** (`Espacio`, velocidad ×2) limitado por una barra de **energía**, que se recarga sola y con **orbes**. Se distingue de la variante 01 (duelo 1 contra 1 por rondas, estelas permanentes, sin turbo ni ítems, IA que mejora por ronda).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07; la referencia más cercana es `lib/games/snake/engine.ts` (movimiento por celda con acumulador y cola de giros), pero no se reutiliza su código ni sus sprites. Todo se dibuja con rectángulos y círculos. No existe clase cover para este juego en `app/globals.css` (`.cover-duelo` es del prototipo de Pong y no se toca); se crea `.cover-tron-vs-cpu`.

Decisiones fijadas por el agente (no se reabren): `id` `tron-vs-cpu`, título `TRON VS CPU`, `cat` `VERSUS`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, `missile-command` = 6 reservado en `specs/game-jam/missile-command/`), dificultad 4, tags `TURBO` y `SUPERVIVENCIA`, 1 jugador (contra la CPU), teclado. Canvas **600×600** (1:1), rejilla de **50×50 celdas de 12 px**. **3 vidas** (`initialLives: 3`), **nivel** por derribos (`showLevel: true`), stats extra `DERRIBOS` y `TURBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/tron-vs-cpu/engine.ts`: sin globals de módulo; exporta `tronVsCpuDef: GameEngineDef` con `createTronVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/tron-vs-cpu/balance.ts`: funciones puras y constantes: `levelFor(kills)`, `activeCpus(level)`, `baseStepMs(level)`, `killPoints(level)`, `errorProb(level)`, `SPAWNS` (3 puntos de aparición con dirección), `PLAYER_START`, `MAX_TRAIL_PLAYER`, `MAX_TRAIL_CPU`.
- Módulo `lib/games/tron-vs-cpu/ai.ts`: funciones puras sin estado de módulo: `floodArea(grid, x, y, cap, visited)`, `chooseCpuDir(grid, cpu, role, target, level, rand)`.
- Módulo `lib/games/tron-vs-cpu/draw.ts`: `drawBoard` (fondo + rejilla + borde, pintado una vez en un canvas offscreen por instancia), `drawTrail`, `drawHead`, `drawOrb`, `drawGhost` (estela desvaneciéndose), `drawCrash`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"tron-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-tron-vs-cpu` en `app/globals.css`: fondo `#07000d` con rejilla `repeating-linear-gradient` magenta al 8 % cada 12 px; `::after` con una estela `var(--cyan)` de 6 px que zigzaguea desde abajo y tres estelas cortas `var(--magenta)`, `var(--yellow)` y `var(--green)` desde arriba y los lados; `::before` con un orbe `radial-gradient(circle, #fff 0 4px, var(--yellow) 5px, transparent 9px)` en el centro; `drop-shadow(0 0 6px rgba(255,43,214,0.5))`.
- Migración `add_game_tron_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **3 vidas**, **nivel**, stats extra `kills` ("DERRIBOS", `int`) y `turbo` ("TURBO", `int`).
- Sin HUD nativo de texto en el canvas: solo arena, estelas, cabezas, orbe, estelas desvaneciéndose y anillos de choque.
- Controles: `←↑→↓` y `WASD` giran la moto; mantener `Espacio` activa el turbo. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'tron-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `tron-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Rondas, estelas permanentes, escudos, armas u otros ítems distintos del orbe, modo wrap.
- Turbo para las CPUs.
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
      ('tron-vs-cpu', 'TRON VS CPU', 'Derriba motos con tu estela y usa el turbo.',
       'Sobrevive en la arena de luz contra hasta tres motos CPU que no dejan de reaparecer. Gira con las flechas o WASD y mantén Espacio para el turbo mientras te dure la energía; recoge orbes para recargarla. Cada moto que choca contra tu estela es un derribo, y cada cuatro derribos sube el nivel. Tres vidas.',
       'VERSUS', 'magenta', 'cover-tron-vs-cpu', 1, 1, '{keyboard}', '{TURBO,SUPERVIVENCIA}', 4, 7, false);

Definición del motor:

    export const tronVsCpuDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "kills", label: "DERRIBOS", color: "yellow", format: "int" },
        { key: "turbo", label: "TURBO", color: "magenta", format: "int" },
      ],
      create: createTronVsCpu,
    };

Estado interno (dentro de `createTronVsCpu`): `grid: Uint8Array(50 × 50)` (0 libre, 1 jugador, 2–4 CPU índice 0–2), `visited: Uint8Array(2500)` reutilizado por la IA, `player { x, y, dir, trail: {x,y}[], acc }`, `dirQueue` (máx. 2 giros), `boostHeld`, `energy` (0–100, float), `cpus: { slot, alive, x, y, dir, trail: {x,y}[], acc, role, respawnMs }[3]`, `ghosts: { cells: {x,y}[], color, ms }[]`, `crashes: { x, y, color, ms }[]`, `orb { x, y } | null`, `orbTimerMs`, `phase: "ready" | "run" | "crash"`, `phaseMs`, `cellsTravelled`, `kills`, `level`, `lives`, `score`, `lastTurboEmitted`, `rand` (`Math.random`), `boardCanvas` (offscreen), `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("kills", n)`, `onStat("turbo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("kills", 0)`, `onStat("turbo", 100)`.
- `onStat("turbo", n)` se emite solo cuando cambia `n = Math.floor(energy / 5) × 5` (pasos de 5). Valor 0 oculta el stat (contrato de `onStat`); es esperado con la energía agotada. `onStat("kills", 0)` al inicio también lo oculta.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Los giros ignoran `e.repeat` duplicados por la cola; el turbo depende de `keydown`/`keyup` de `Espacio` (estado mantenido).
- Pausa/blur/destroy limpian `dirQueue` y ponen `boostHeld = false`; al reanudar se reinicia `lastTime` y los acumuladores (`acc = 0`); `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** 50×50 celdas de 12 px; el borde exterior es muro (salir de `[0, 49]` en cualquier eje es choque).
- **Inicio / reinicio de arena:** `grid` vacío, sin `ghosts`. Jugador en (25, 40) mirando arriba, `energy = 100`. Se colocan `activeCpus(level)` CPUs en los slots 0..n−1 de `SPAWNS`: slot 0 (25, 9) abajo, rol `hunter`; slot 1 (9, 25) derecha, rol `wanderer`; slot 2 (40, 25) izquierda, rol `orbiter`. Cada moto marca su celda inicial. Se coloca un orbe. `phase = "ready"` **1200 ms** (cabezas parpadeando 150/150 ms, se pueden encolar giros, la energía no cambia).
- **Nivel:** `level = 1 + Math.floor(kills / 4)` (sin tope). `activeCpus(level) = min(level, 3)`. Al subir: `onLevel(level)`; si sube `activeCpus`, el slot nuevo intenta aparecer de inmediato (regla de reaparición).
- **Velocidad:** `baseStepMs(level) = max(60, 100 − 5 × (level − 1))`. Cada moto tiene su propio acumulador y avanza una celda cada `stepMs`. CPUs: `stepMs = baseStepMs`. Jugador: `stepMs = baseStepMs / 2` si hay turbo activo, si no `baseStepMs`.
- **Turbo:** activo si `boostHeld`, `energy > 0` y `phase = "run"`. Activo: `energy −= 40 × dt/1000`; inactivo (en `run`): `energy += 12 × dt/1000`; límites [0, 100]. Con `energy = 0` el turbo se corta aunque se mantenga `Espacio`.
- **Giros del jugador:** `←↑→↓` / `WASD`. `dirQueue` de 2; se descarta un giro igual a la dirección actual (o a la última encolada) o su opuesta. Un giro por paso del jugador.
- **Orden de proceso por frame:** primero los pasos del jugador (hasta que `acc < stepMs`), luego los de cada CPU viva en orden de slot. En un choque de frente, el que entra segundo en la celda es el que choca (el jugador va primero).
- **Paso de una moto:** calcula la celda siguiente; si sale de la arena o `grid ≠ 0` → choque. Si no, marca la celda con su id y la añade al final de su `trail`; si `trail.length` supera su máximo (**`MAX_TRAIL_PLAYER = 250`**, **`MAX_TRAIL_CPU = 150`**) se libera la celda más antigua (`grid = 0`). El jugador suma `cellsTravelled += 1`; cada 10 celdas → `score += 10` y `onScore`.
- **Orbe:** uno a la vez, en una celda libre aleatoria con `x, y ∈ [2, 47]` y distancia Manhattan ≥ **8** a todas las cabezas. No es obstáculo. Si la cabeza del jugador entra en su celda: `score += 50`, `energy = min(100, energy + 35)`, el orbe desaparece y reaparece a los **3000 ms**. Las CPUs pasan por encima sin recogerlo.
- **Choque de una CPU:**
  - Si la celda de choque tiene `grid = 1` (estela o cabeza del jugador) → **derribo**: `score += killPoints(level)` con `killPoints(level) = 200 + 50 × level` (nivel antes de subir), `kills += 1` → `onStat("kills", kills)` y recálculo de nivel.
  - Si choca contra muro, su propia estela u otra CPU → `score += 50` (sin derribo).
  - En ambos casos: anillo de choque, sus celdas se liberan en `grid` en el acto y pasan a `ghosts` (se dibujan desvaneciéndose **400 ms**), `alive = false`, `respawnMs = 2500`.
- **Reaparición de CPU:** cuando `respawnMs ≤ 0` (o al abrirse un slot nuevo por nivel) se intenta aparecer en su propio slot de `SPAWNS` si el cuadrado 5×5 centrado está libre y la distancia Manhattan a la cabeza del jugador es ≥ **12**; si no, se prueban los otros slots libres de CPU viva en orden de distancia al jugador (mayor primero). Si ninguno cumple, se reintenta cada **500 ms**. Aparece con trail vacío más su celda, `acc = 0`, la dirección de ese spawn y el rol de su slot. Los temporizadores de reaparición solo avanzan en `run`.
- **Choque del jugador:** `lives −= 1` → `onLives(lives)`. Si `lives = 0`: `onGameOver(score)` en el mismo frame. Si no: `phase = "crash"` **900 ms** (todo quieto, anillo) y luego **reinicio de arena** (ver arriba); se conservan `score`, `kills`, `level` y `cellsTravelled`.
- **IA de la CPU** (`chooseCpuDir`, una vez por paso de cada CPU):
  - Candidatas: recto, izquierda, derecha (nunca reversa); segura = dentro de la arena y libre. Sin seguras → recto (choca).
  - `errorProb(level) = max(0.02, 0.15 − 0.03 × (level − 1))`: con esa probabilidad elige una segura al azar.
  - Cada segura se puntúa con `floodArea` (BFS 4 direcciones desde la celda siguiente, tope **300**). `maxA` = el mayor.
  - Rol `hunter`: objetivo = cabeza del jugador + 4 × su dirección (recortado a la arena); entre candidatas con área ≥ `0.85 × maxA`, minimiza distancia Manhattan al objetivo.
  - Rol `orbiter`: objetivo = celda del orbe (si no hay orbe, actúa como `wanderer`); mismo filtro 0.85 y criterio.
  - Rol `wanderer`: elige el área mayor; si recto empata con un giro, gira con probabilidad **0.06**.
  - Empates restantes → recto.
- **Puntaje de referencia:** 4 derribos en nivel 1 (4 × 250 = 1000) + 400 celdas recorridas (400) + 2 orbes (100) = 1500.
- **Dibujo:** fondo `#07000d`; rejilla cada 12 px `rgba(255,43,214,0.06)`; borde 2 px `#ff2bd6`. Estelas: cuadrado 8×8 centrado en la celda más puente de 8 px hacia la anterior; jugador `#00f5ff`, CPU slot 0 `#ff2bd6`, slot 1 `#ffe600`, slot 2 `#00ff88`. Cabezas 10×10 blancas con borde 2 px del color de su moto; con turbo activo, la del jugador lleva dos líneas de velocidad de 10 px `rgba(0,245,255,0.6)` detrás. Las 20 celdas más antiguas de cada estela se dibujan con alfa decreciente 1 → 0.2 (anticipa que se apagan). `ghosts`: alfa 1 → 0 en 400 ms. Orbe: círculo blanco que pulsa de radio 4 a 6 px (periodo 600 ms) con halo `#ffe600`. Choque: anillo del color de la moto, radio 0 → **32 px** en 500 ms, grosor 3 px. El fondo se pinta una vez en `boardCanvas`; cada frame compone `boardCanvas` y redibuja estelas con un `fillStyle` por moto (≤ 700 celdas).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente de rejilla y acumulador). Crear `.cover-tron-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_tron_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'tron-vs-cpu'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/tron-vs-cpu/balance.ts`. Verificar: `npm run lint`; `levelFor(0) = 1`, `levelFor(4) = 2`, `activeCpus(5) = 3`, `baseStepMs(1) = 100`, `baseStepMs(20) = 60`, `killPoints(1) = 250`, `errorProb(1) = 0.15`, `errorProb(10) = 0.02`.
3. Crear `lib/games/tron-vs-cpu/ai.ts`. Verificar: `npm run lint`; en arena vacía `floodArea` con tope 300 = 300; con todas las candidatas bloqueadas `chooseCpuDir` devuelve recto.
4. Crear `lib/games/tron-vs-cpu/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/tron-vs-cpu/engine.ts` y exportar `tronVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"tron-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/tron-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): fase `ready`, giros y rechazo de 180°, turbo (velocidad ×2, consumo, corte a 0, recarga), orbe (+50, +35 energía, reaparición a 3 s), estela del jugador que se apaga a los 250, derribo (+250 en nivel 1) y choque ajeno (+50), estela desvaneciéndose, reaparición a 2,5 s lejos del jugador, nivel 2 con 2 CPUs y nivel 3 con 3, muerte del jugador con reinicio de arena conservando puntaje, pérdida de las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'tron-vs-cpu'` (y anotarlo en `prod-setup.md`). Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `tron-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7, `cat` VERSUS); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-tron-vs-cpu`), la ficha `/games/tron-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `TURBO`/`SUPERVIVENCIA`, dificultad 4, color magenta); aparece al filtrar por VERSUS en `/games`.
- [ ] `/games/tron-vs-cpu/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con el jugador en (25, 40) hacia arriba, una sola CPU en (25, 9) hacia abajo, un orbe y 1200 ms de parpadeo sin movimiento.
- [ ] `←↑→↓` y `WASD` giran la moto; un giro de 180° no se aplica; las flechas y `Espacio` no hacen scroll.
- [ ] En nivel 1 las motos avanzan cada 100 ms; mantener `Espacio` hace que el jugador avance cada 50 ms mientras haya energía.
- [ ] El turbo gasta 40 de energía por segundo y se corta en 0; sin turbo se recargan 12 por segundo hasta 100; TURBO en el HUD cambia en pasos de 5.
- [ ] Recoger el orbe suma 50 puntos y 35 de energía (máx. 100); el siguiente aparece a los 3 s a ≥ 8 celdas de todas las cabezas.
- [ ] Cada 10 celdas recorridas por el jugador suman 10 puntos.
- [ ] La estela del jugador nunca supera 250 celdas y la de cada CPU 150; las celdas apagadas quedan libres y se puede pasar por ellas.
- [ ] Una CPU que choca contra la estela o la cabeza del jugador suma `200 + 50 × nivel` y sube DERRIBOS; si choca contra otra cosa suma 50 sin derribo.
- [ ] La estela de una CPU derribada se libera al instante y se desvanece en 400 ms; la CPU reaparece a los 2,5 s en un spawn libre a ≥ 12 celdas del jugador.
- [ ] Con 4 derribos se pasa a nivel 2 (2 CPUs, 95 ms por paso) y con 8 a nivel 3 (3 CPUs, 90 ms); nunca hay más de 3 CPUs.
- [ ] La CPU nunca hace reversa; el rol `hunter` intenta cortar al jugador y el `orbiter` ronda el orbe.
- [ ] Morir resta 1 vida, muestra el choque 900 ms y reinicia la arena conservando puntaje, derribos y nivel, con energía 100.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, DERRIBOS y TURBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela motos, energía, orbe, reapariciones y animaciones; reanudar sin salto, sin paso doble y sin turbo pegado.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, espacio) no mueve la moto ni activa el turbo.
- [ ] Guardar inserta en `scores` con `game_id = 'tron-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/tron-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, DERRIBOS 0, TURBO 100, una CPU, arena vacía).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/tron-vs-cpu/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` actualizados.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`) ni reutilizar el motor de Snake (solo se toma el patrón de rejilla + acumulador + cola de giros).
- **Sí:** supervivencia continua con CPUs que reaparecen; es la diferencia central con la variante 01. **No:** rondas ganables.
- **Sí:** de 1 a 3 CPUs según nivel (`min(level, 3)`); escala la presión sin saturar la arena. **No:** más de 3.
- **Sí:** estelas de largo limitado (250 jugador / 150 CPU) y desvanecimiento al morir; sin esto la arena se llena y la partida sin rondas se vuelve imposible.
- **Sí:** turbo ×2 con energía (−40/s, +12/s) y orbes (+35); añade una decisión de riesgo propia de la variante. **No:** turbo para las CPUs (sería injusto e ilegible).
- **Sí:** cada moto con su propio acumulador y el jugador procesado primero; necesario para que el turbo funcione con pasos de distinta duración, y resuelve choques de frente de forma determinista.
- **Sí:** derribo solo si la CPU choca contra el jugador (`200 + 50 × nivel`), +50 por choque ajeno, +10 cada 10 celdas, +50 por orbe; premia la caza activa sobre esperar.
- **Sí:** al morir el jugador se reinicia la arena conservando puntaje y nivel; evita reaparecer encerrado entre estelas. **No:** invulnerabilidad temporal.
- **Sí:** roles de IA por slot (`hunter`, `wanderer`, `orbiter`); dan comportamientos distinguibles con el mismo algoritmo de flood-fill (tope 300).
- **Sí:** `initialLives: 3`, `showLevel: true` y stats `DERRIBOS` y `TURBO` (0 oculta el stat, aceptado).
- **Sí:** canvas 600×600 con celdas de 12 px; arena grande para 4 motos.
- **Sí:** valores de balance (velocidades, energía, largos, puntos, tiempos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS y color magenta; **Sí:** `.cover-tron-vs-cpu` nueva; **No:** reutilizar `.cover-duelo` (es del prototipo de Pong).
- **No:** sonido, táctil, HiDPI, skins, modo 2 jugadores (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Tres flood-fill por paso de CPU (hasta ~50 pasos/s) cuestan demasiado en móviles.      | Tope 300 celdas y `visited` reutilizado por instancia (sin asignaciones por paso); verificar FPS con 3 CPUs.          |
| Una CPU reaparece encima o junto al jugador y lo mata sin opción.                      | Spawn exige 5×5 libre y ≥ 12 celdas de distancia; si no hay, reintenta cada 500 ms.                                  |
| Turbo con `dt` capado a 50 ms y `stepMs` de 30 ms provoca saltos de 2 celdas sin chequeo. | Bucle `while (acc ≥ stepMs)` con un paso (y su chequeo de choque) por iteración; nunca se avanzan 2 celdas de golpe. |
| Turbo "pegado" tras perder foco o abrir el modal.                                       | `blur`, `pause` y game over ponen `boostHeld = false`; el input del modal se ignora.                                 |
| Emitir `onStat("turbo")` por frame satura React.                                        | Emitir solo cuando cambia `Math.floor(energy / 5) × 5`.                                                               |
| La estela limitada permite "cerrar" la cola sobre sí mismo indefinidamente.             | Puntos por celda bajos (+10 cada 10) frente a derribos (≥ 250); la caza es lo rentable. Ajustable editando el spec.  |
| `dt` grande tras pausar o cambiar de pestaña provoca pasos o reapariciones múltiples.   | `lastTime` y acumuladores se reinician al reanudar y tras blur; `dt` capado a 50 ms; temporizadores solo en `run`.    |
| Flechas, `WASD` o espacio interfieren con el input del modal.                           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                 |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                               |
| El id con guiones requiere comillas en `ENGINES` y `_` en la migración.                  | Clave `"tron-vs-cpu"` entre comillas; carpeta `lib/games/tron-vs-cpu/`; migración `add_game_tron_vs_cpu`.             |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                      |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Rondas, estelas permanentes, escudos, armas e ítems distintos del orbe, modo wrap.
- Turbo para las CPUs.
- Modo local de 2 jugadores.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
