# SPEC GJ-tron-vs-cpu-02 — Juego real: TRON VS CPU (variante: arena 1 contra 3 con turbo) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-16
> **Variant:** 02 de 2 — Arena todos contra todos: el jugador contra 3 motos CPU con personalidades distintas, turbo por cargas, derribos que puntúan y estelas que se desvanecen al caer una moto.
> **Objective:** Crear un motor TypeScript de Tron (arena contra tres motos CPU) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/tron-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Tron vs CPU. En vez del duelo 1 contra 1 de la variante 01 (un rival, velocidad creciente, empates que repiten ronda), aquí el jugador entra en una **arena con 3 motos CPU a la vez**, cada una con una **personalidad de IA** distinta (cazadora, superviviente, errática). El jugador dispone de **turbo por cargas** (doble velocidad durante 1,5 s) para cortar el paso, y puntúa sobre todo por **derribos**: una CPU que choca contra su estela. Cuando una moto cae, su estela **se desvanece** y libera espacio, así que la arena cambia durante la ronda. El reto es **táctico y de posicionamiento**, no solo de reflejos.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` son frutas de Snake (no se usan). El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07, tomando como referencia `lib/games/snake/engine.ts` (paso por celda con acumulador y cola de giros), y se dibuja todo con rectángulos, líneas y `shadowBlur`. No existe clase cover para este juego en `app/globals.css` (`.cover-duelo` es del prototipo de Pong y no se reutiliza); se crea `.cover-tron-vs-cpu`.

Decisiones fijadas por el agente (no se reabren): `id` `tron-vs-cpu`, título `TRON VS CPU`, `cat` `VERSUS`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y 6 reservado por la game jam de `missile-command`), dificultad 3, tags `ARENA` y `TURBO`, 1 jugador humano, teclado. Canvas **600×600** (1:1), rejilla **50×50 de 12 px**. **3 vidas**, **nivel = ronda** (`showLevel: true`), stats extra `DERRIBOS` y `TURBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/tron-vs-cpu/engine.ts`: sin globals de módulo; exporta `tronVsCpuDef: GameEngineDef` con `createTronVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/tron-vs-cpu/ai.ts`: funciones puras sin estado de módulo — `floodFill(grid, cols, rows, start, cap) → number`, `safeCandidates(grid, cols, rows, head, dir) → { dir, fill }[]` y `chooseCpuDir(personality, candidates, ctx, round, rand) → Dir`, con `personality: "hunter" | "survivor" | "erratic"` y `ctx` = cabeza/dirección propias y del jugador. `rand` se inyecta (`Math.random` en el motor).
- Módulo `lib/games/tron-vs-cpu/arena.ts`: constantes (`COLS`, `ROWS`, `CELL`, `SPAWNS` con posición, dirección, dueño y personalidad de las 4 motos) y funciones puras de balance (`stepMs(round)`, `cpuError(round)`).
- `PALETTE` en `engine.ts`; todos los colores salen de ahí (facilita el spec de skins posterior).
- Fondo con rejilla prerenderizado una vez por instancia en un canvas offscreen (técnica de SPEC 13) y copiado con `drawImage` cada frame.
- Entrada `"tron-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-tron-vs-cpu` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%, #1a0028, #05050f)` con rejilla `repeating-linear-gradient` magenta al 12 % (0° y 90°, cada 12 px) y `::after` con cuatro estelas en molinete (`linear-gradient` de 4 px) cyan, magenta, amarillo y verde convergiendo al centro, con `filter: drop-shadow(0 0 6px rgba(255,43,214,0.5))`.
- Migración `add_game_tron_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= ronda) y stats extra `kills` ("DERRIBOS", `int`) y `turbo` ("TURBO", `int`, cargas restantes en la ronda).
- Sin HUD nativo de texto en el canvas ni cuenta atrás escrita; la fase de preparación se indica con el parpadeo de las motos y el turbo activo con un halo blanco en la cabeza del jugador.
- Controles: `←↑→↓` y `WASD` giran la moto; `Espacio` activa el turbo. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'tron-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `tron-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Turbo para las CPU, power-ups recogibles, obstáculos fijos, arena que se encoge, modo wrap.
- Multijugador humano local u online.
- Selector de dificultad, número de CPU configurable o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('tron-vs-cpu', 'TRON VS CPU', 'Sobrevive en la arena contra tres motos CPU.',
       'Conduce tu moto de luz con las flechas o WASD contra tres motos CPU: una caza, otra sobrevive y otra es imprevisible. Cada CPU que choca contra tu estela es un derribo de 150 puntos; usa Espacio para el turbo (3 cargas por ronda) y córtales el paso. Ser el último en pie suma un bonus de ronda. Tienes 3 vidas y cada ronda las CPU son más rápidas y precisas.',
       'VERSUS', 'magenta', 'cover-tron-vs-cpu', 1, 1, '{keyboard}', '{ARENA,TURBO}', 3, 7, false);

Definición del motor:

    export const tronVsCpuDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "kills", label: "DERRIBOS", color: "magenta", format: "int" },
        { key: "turbo", label: "TURBO", color: "yellow", format: "int" },
      ],
      create: createTronVsCpu,
    };

Estado interno (dentro de `createTronVsCpu`): `grid: Uint8Array(50 × 50)` (0 libre, 1 jugador, 2 cazadora, 3 superviviente, 4 errática), `bikes: { id, x, y, dir, alive, personality?, fadeMs }[4]` (índice 0 = jugador), `dirQueue` (máx. 2 giros del jugador), `round`, `lives`, `kills`, `turboCharges`, `turboMs`, `score`, `cellsThisRound`, `subMs` (duración del subpaso), `subIndex` (contador de subpasos de la ronda), `acc`, `phase: "ready" | "play" | "end"`, `phaseMs`, `crashes: { x, y, age }[]`, `paused`, `finished`, `lastTime`, `rafId`, `bgCanvas` (offscreen), `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (ronda), `onStat("kills", n)`, `onStat("turbo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("kills", 0)` y `onStat("turbo", 3)`. `onStat(key, 0)` oculta el stat según el contrato; es lo esperado sin derribos o sin cargas.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (con el anillo de choque) queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio` ignora `e.repeat` (una activación por pulsación).
- Pausa/blur/destroy limpian `dirQueue`; al reanudar se reinicia `lastTime` y `acc = 0`; `dt` capado a **50 ms**. Las fases `ready`/`end`, `turboMs` y los desvanecimientos también se congelan en pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, cuenta atrás ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** rejilla 50×50 de 12 px; salir de `x, y ∈ [0, 49]` es choque. Sin obstáculos internos.
- **Inicio de ronda (molinete):** rejilla vacía. Jugador (cyan) en (8, 30) → derecha; cazadora (magenta) en (41, 19) → izquierda; superviviente (amarilla) en (19, 8) → abajo; errática (verde) en (30, 41) → arriba. La celda inicial de cada moto ya es estela propia. `turboCharges = 3` (`onStat("turbo", 3)` si cambió), `turboMs = 0`, `cellsThisRound = 0`, `dirQueue` vacía.
- **Fase `ready`:** **1000 ms** sin movimiento; las motos parpadean a 4 Hz. El jugador puede encolar **un** giro; el turbo no se puede activar en esta fase.
- **Tiempo:** `stepMs(round) = max(60, 90 − 4 × (round − 1))` (ronda 1: 90 ms, 2: 86, … 8: 62, 9+: 60). El motor avanza en **subpasos** de `stepMs / 2`. En cada subpaso con `subIndex` par se mueven todas las motos vivas; en los impares solo el jugador si tiene turbo activo.
- **Giros del jugador:** `dirQueue` admite 2 giros; se descarta un giro igual a la dirección actual (o a la última encolada) o contrario a ella. Se aplica un giro por movimiento del jugador.
- **Turbo:** `Espacio` en fase `play`, con `turboCharges > 0` y sin turbo activo → `turboMs = 1500`, `turboCharges − 1`, `onStat("turbo", n)`. Mientras `turboMs > 0` el jugador se mueve en todos los subpasos (doble velocidad). Pulsar con turbo activo o sin cargas no hace nada. Las cargas no se acumulan entre rondas.
- **Resolución de un subpaso** (simultánea entre las motos que se mueven en él): (1) cada CPU que se mueve decide dirección con `chooseCpuDir` sobre la rejilla actual; (2) el jugador toma su siguiente giro; (3) se calculan las cabezas nuevas; (4) una moto choca si su cabeza nueva sale de la arena o cae en una celda no libre; (5) si dos o más cabezas nuevas coinciden, chocan todas ellas; (6) las que no chocan marcan su celda en `grid`; el jugador suma `cellsThisRound + 1`.
- **IA de las CPU** (`ai.ts`): candidatas = recto, izquierda y derecha relativas que no chocan en el siguiente movimiento, cada una con `floodFill` desde su celda nueva (tope **400**). Si no hay ninguna, sigue recto (y choca). Con probabilidad `cpuError(round) = max(0.02, 0.15 − 0.02 × (round − 1))` cualquier CPU elige una candidata al azar. Si no:
  - **Cazadora:** entre candidatas con `fill ≥ min(150, máximo)`, la de menor distancia Manhattan a `objetivo = cabeza del jugador + 4 × dirección del jugador` (limitado a la arena); empate → recto.
  - **Superviviente:** la de mayor `fill`; si recto tiene `≥ 0.9 × máximo`, recto.
  - **Errática:** como superviviente, pero con probabilidad **0.25** por decisión elige al azar entre candidatas con `fill ≥ 0.5 × máximo`.
- **Caída de una CPU:** se dibuja un anillo de choque y su estela se **desvanece**: `fadeMs = 600`; durante ese tiempo sus celdas siguen bloqueando y se dibujan con alfa `fadeMs / 600`; al llegar a 0 sus celdas pasan a libres (0). La estela del jugador nunca se borra dentro de la ronda.
- **Puntuación** (cada evento emite `onScore` al ocurrir, nunca por subpaso):
  - **Derribo:** una CPU choca contra una celda con valor 1 (estela del jugador) o su cabeza coincide con la nueva cabeza del jugador → **+150**, `kills + 1` (`onStat("kills")`).
  - **CPU caída por otra causa** (muro, estela propia o de otra CPU, choque entre CPU) → **+50**.
  - **Fin de ronda:** `+cellsThisRound` (1 por celda avanzada por el jugador en la ronda).
  - **Último en pie:** si caen las 3 CPU y el jugador sigue vivo → bonus **+300 + 50 × round**.
- **Fin de ronda:** al terminar un subpaso, si el jugador chocó o no queda ninguna CPU viva, `phase = "end"` durante **1200 ms** (anillos de choque: radio 0 → 20 px en 400 ms, trazo 3 px `#ffffff`). En el mismo subpaso se aplican primero los puntos por CPU caídas y luego el resultado del jugador:
  - **Jugador vivo y 3 CPU caídas:** celdas + bonus de último en pie; `round + 1` (`onLevel`).
  - **Jugador caído** (aunque caigan CPU a la vez; sin bonus): celdas; `lives − 1` (`onLives`). Si `lives = 0` → `onLives(0)` y `onGameOver(score)` inmediatamente. Si no, `round + 1` (`onLevel`).
  - Tras los 1200 ms se reinicia la arena y empieza la fase `ready` de la siguiente ronda.
- **Dibujo:** fondo `#05050f` con líneas `rgba(255,43,214,0.07)` cada 12 px y borde de 2 px `#ff2bd6`. Estelas: jugador `#00f5ff`, cazadora `#ff2bd6`, superviviente `#ffe600`, errática `#39ff14`; celdas de 10×10 px con margen 1 px y `shadowBlur` 6 del mismo color. Cabezas: cuadrado de 10 px `#ffffff` con borde de 2 px del color de la moto. Turbo activo: halo `#ffffff` de radio 10 px con `shadowBlur` 14 sobre la cabeza del jugador.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente de rejilla, acumulador y cola de giros). Crear `.cover-tron-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_tron_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'tron-vs-cpu'` muestra la fila; `npm run build`.
2. Crear `lib/games/tron-vs-cpu/arena.ts` (`SPAWNS`, `stepMs`, `cpuError`). Verificar: `npm run lint`; `stepMs(1) = 90`, `stepMs(9) = 60`, `cpuError(1) = 0.15`, `cpuError(8) = 0.02`.
3. Crear `lib/games/tron-vs-cpu/ai.ts` (`floodFill`, `safeCandidates`, `chooseCpuDir`). Verificar: `npm run lint`; con rejilla vacía y `rand = () => 0.99`, la superviviente sigue recto y la cazadora gira hacia el objetivo cuando acercarse no reduce su espacio por debajo de 150.
4. Crear `lib/games/tron-vs-cpu/engine.ts` (subpasos, turbo, resolución, desvanecimiento, fases, dibujo con fondo offscreen) y exportar `tronVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"tron-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/tron-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): molinete inicial y parpadeo de 1000 ms, girar con flechas y WASD, turbo con `Espacio` (3 usos, doble velocidad 1,5 s, TURBO baja y se oculta en 0), derribar una CPU con la estela (+150, DERRIBOS), ver una CPU caer sola (+50) y su estela desvanecerse, ganar una ronda como último en pie (bonus, nivel 2, TURBO vuelve a 3), perder una vida, perder las 3, pausa (botón y `P`) con turbo activo y durante un desvanecimiento, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'tron-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `tron-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-tron-vs-cpu`), la ficha `/games/tron-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `ARENA`/`TURBO`, dificultad 3, color magenta, categoría VERSUS; aparece con el filtro VERSUS).
- [ ] `/games/tron-vs-cpu/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] Cada ronda empieza con la arena vacía, las 4 motos en las posiciones y direcciones del molinete y 1000 ms de parpadeo sin movimiento.
- [ ] `←↑→↓` y `WASD` giran la moto; flechas y `Espacio` no hacen scroll; un giro de 180° no se aplica.
- [ ] En la ronda 1 las motos avanzan una celda cada 90 ms; el paso baja 4 ms por ronda y nunca de 60 ms.
- [ ] `Espacio` activa el turbo 1500 ms al doble de velocidad, como máximo 3 veces por ronda; mantener la tecla no gasta más cargas; TURBO se reinicia a 3 en cada ronda.
- [ ] Una CPU que choca con la estela del jugador suma exactamente 150 y DERRIBOS +1; una CPU que cae por otra causa suma 50.
- [ ] La estela de una CPU caída se desvanece en 600 ms y luego sus celdas son transitables.
- [ ] Las tres CPU se comportan distinto: la cazadora se acerca al frente del jugador, la superviviente busca espacio y la errática cambia de rumbo de forma imprevisible; ninguna se suicida teniendo salida segura (salvo su error aleatorio).
- [ ] Ser el último en pie en la ronda `r` suma `300 + 50 × r` + celdas recorridas y sube el nivel en 1.
- [ ] Chocar (muro, cualquier estela o cabeza contra cabeza) baja una vida, suma solo celdas y CPU caídas, sin bonus, y sube el nivel en 1.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (ronda), DERRIBOS y TURBO; sin eventos por frame ni por subpaso.
- [ ] Pausa (botón y `P`) congela motos, turbo, desvanecimientos y fases; reanudar sin salto ni paso doble.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve la moto ni activa el turbo.
- [ ] Guardar inserta en `scores` con `game_id = 'tron-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/tron-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, ronda 1, DERRIBOS oculto, TURBO 3, paso 90 ms, arena vacía).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/tron-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero inspirado en el patrón de Snake; **No:** reutilizar o modificar `lib/games/snake/`.
- **Sí:** 3 CPU con personalidades (cazadora, superviviente, errática) en `ai.ts` puro; **No:** una sola CPU (es la variante 01) ni IA con búsqueda en árbol.
- **Sí:** turbo por cargas discretas (3 × 1500 ms por ronda) para que `onStat("turbo")` cambie solo al usarlo; **No:** barra continua (emitiría eventos por frame).
- **Sí:** subpasos de medio paso para mezclar velocidad normal y turbo con resolución simultánea; **No:** acumuladores independientes por moto (orden de movimiento ambiguo).
- **Sí:** derribos como fuente principal de puntos y bonus de último en pie; **Sí:** valores (150, 50, 300 + 50 × r, 1 por celda) fijados aquí, ajustables solo editando el spec.
- **Sí:** estela de CPU caída que se desvanece en 600 ms (abre la arena a mitad de ronda); **No:** borrar la estela del jugador.
- **Sí:** perder una vida termina la ronda al instante y avanza el nivel; **No:** seguir viendo a las CPU tras morir.
- **Sí:** dificultad por ronda vía `stepMs` y `cpuError`; **No:** añadir más CPU por ronda.
- **Sí:** fase `ready` con parpadeo y halo de turbo en lugar de texto (sin overlays en canvas).
- **Sí:** fondo offscreen por instancia (SPEC 13); **No:** sprites ni imágenes.
- **Sí:** `cat` VERSUS, color magenta y `.cover-tron-vs-cpu` nueva; **No:** reutilizar `.cover-duelo`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                       | Mitigation                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Con turbo, el orden de movimiento entre motos crea choques injustos o atravesar estelas.   | Subpasos fijos y resolución simultánea en 6 pasos; nunca se avanza más de una celda por moto y subpaso.            |
| Las CPU se eliminan entre sí demasiado rápido y la ronda se gana sin jugar.                | Molinete con rutas iniciales que no se cruzan antes de 11 movimientos; `floodFill` evita suicidios; verificar en paso 6. |
| La cazadora se vuelve imbatible o se suicida persiguiendo.                                 | Solo considera candidatas con `fill ≥ min(150, máximo)`; `cpuError` mínimo 0.02.                                    |
| 3 CPU × 3 `floodFill` por movimiento a 60 ms cuestan demasiado.                            | Tope de 400 celdas sobre `Uint8Array`; ≤ 9 BFS por paso, trivial a ~17 pasos/s.                                    |
| Borrar celdas de una estela desvanecida deja huecos en estelas de otras motos.             | Al vencer `fadeMs` solo se liberan celdas cuyo valor es el id de esa CPU.                                          |
| `dt` grande tras pausar o cambiar de pestaña provoca varios subpasos o agota el turbo.     | `lastTime` y `acc` se reinician al reanudar y tras blur; `dt` capado a 50 ms; timers solo avanzan sin pausa.       |
| Flechas, WASD o espacio interfieren con el input del modal.                                | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| `onStat` con 0 oculta DERRIBOS/TURBO y parece un fallo.                                    | Comportamiento del contrato documentado en este spec y en los criterios de aceptación.                             |
| Doble loop / listeners por StrictMode.                                                     | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| El id con guiones requiere comillas en `ENGINES` y `_` en la migración.                    | Clave `"tron-vs-cpu"` entre comillas; carpeta `lib/games/tron-vs-cpu/`; migración `add_game_tron_vs_cpu`.          |
| Next 16 difiere del conocimiento previo.                                                   | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Turbo para las CPU, power-ups recogibles, obstáculos, arena que se encoge y modo wrap.
- Multijugador humano local u online.
- HUD nativo de texto dentro del canvas y overlays de cuenta atrás/pausa/game over.
- Selector de dificultad, número de CPU configurable o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
