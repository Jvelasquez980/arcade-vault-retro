# SPEC GJ-tron-vs-cpu-01 — Juego real: TRON VS CPU (variante: duelo clásico por rondas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-16
> **Variant:** 01 de 2 — Duelo 1 contra 1 fiel al light cycle clásico: una sola moto CPU, rondas cada vez más rápidas, 3 vidas y empates que repiten la ronda.
> **Objective:** Crear un motor TypeScript de Tron (moto con estela contra una CPU) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/tron-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Tron vs CPU. Es el duelo de motos de luz clásico: **el jugador contra una sola moto CPU** en una rejilla cerrada; cada moto avanza sin parar dejando una estela sólida y pierde quien choque primero con un muro o con cualquier estela. La dificultad sube **por velocidad**: cada ronda el paso es más corto. Se distingue de la variante 02 (arena con 3 CPU de personalidades distintas, turbo por cargas, derribos y estelas que se desvanecen): aquí no hay power-ups ni varios rivales; el reto es **leer a un único rival y sobrevivir a la velocidad creciente**.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` son frutas de Snake (no se usan). El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07, tomando como referencia `lib/games/snake/engine.ts` (paso por celda con acumulador y cola de giros), y se dibuja todo con rectángulos, líneas y `shadowBlur`. No existe clase cover para este juego en `app/globals.css` (`.cover-duelo` es del prototipo de Pong y no se reutiliza); se crea `.cover-tron-vs-cpu`.

Decisiones fijadas por el agente (no se reabren): `id` `tron-vs-cpu`, título `TRON VS CPU`, `cat` `VERSUS`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y 6 reservado por la game jam de `missile-command`), dificultad 2, tags `DUELO` y `ESTELA`, 1 jugador humano, teclado. Canvas **640×480** (4:3), rejilla **40×30 de 16 px**. **3 vidas**, **nivel = ronda** (`showLevel: true`), stat extra `VICTORIAS`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/tron-vs-cpu/engine.ts`: sin globals de módulo; exporta `tronVsCpuDef: GameEngineDef` con `createTronVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/tron-vs-cpu/ai.ts`: funciones puras sin estado de módulo — `floodFill(grid, cols, rows, start, cap) → number` (BFS sobre celdas libres) y `chooseCpuDir(grid, cols, rows, head, dir, round, rand) → Dir` (reglas de IA de abajo). `rand` se inyecta (`Math.random` en el motor) para poder razonar sobre la función.
- Constantes del motor (`COLS`, `ROWS`, `CELL`, `PALETTE`) en `engine.ts`; todos los colores salen de `PALETTE` (facilita el spec de skins posterior).
- Fondo con rejilla prerenderizado una vez por instancia en un canvas offscreen (técnica de SPEC 13) y copiado con `drawImage` cada frame.
- Entrada `"tron-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-tron-vs-cpu` en `app/globals.css`: fondo `#05050f` con rejilla `repeating-linear-gradient` cyan al 12 % (0° y 90°, cada 16 px) y `::after` con dos estelas en L (`linear-gradient` de 4 px): cyan desde la izquierda y magenta desde la derecha, con `filter: drop-shadow(0 0 6px rgba(0,245,255,0.5))`.
- Migración `add_game_tron_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **640×480**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= ronda) y stat extra `wins` ("VICTORIAS", `int`).
- Sin HUD nativo de texto en el canvas ni cuenta atrás escrita; la fase de preparación se indica con el parpadeo de las motos (parte del escenario).
- Controles: `←↑→↓` y `WASD` giran la moto. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'tron-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `tron-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Varias CPU, turbo, power-ups, obstáculos fijos, modo sin muros (wrap).
- Multijugador humano local u online.
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
       'Conduce tu moto de luz con las flechas o WASD: avanza sin parar y deja una estela sólida. Gana la ronda quien no choque contra el muro o una estela. Cada ronda ganada suma 100 puntos por ronda más uno por celda recorrida, y la siguiente es más rápida. Tienes 3 vidas; un choque simultáneo es empate y se repite la ronda.',
       'VERSUS', 'cyan', 'cover-tron-vs-cpu', 1, 1, '{keyboard}', '{DUELO,ESTELA}', 2, 7, false);

Definición del motor:

    export const tronVsCpuDef: GameEngineDef = {
      width: 640, height: 480,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "wins", label: "VICTORIAS", color: "cyan", format: "int" }],
      create: createTronVsCpu,
    };

Estado interno (dentro de `createTronVsCpu`): `grid: Uint8Array(40 × 30)` (0 libre, 1 estela del jugador, 2 estela de la CPU), `player { x, y, dir, alive }`, `cpu { x, y, dir, alive }`, `dirQueue` (máx. 2 giros pendientes del jugador), `round`, `lives`, `wins`, `score`, `cellsThisRound` (celdas avanzadas por el jugador en la ronda), `tickMs`, `acc`, `phase: "ready" | "play" | "end"`, `phaseMs`, `crashes: { x, y, age }[]` (anillos de choque), `pendingOutcome: "win" | "lose" | "draw" | null`, `paused`, `finished`, `lastTime`, `rafId`, `bgCanvas` (offscreen), `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (ronda), `onStat("wins", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("wins", 0)` (0 oculta el stat según el contrato; es lo esperado hasta la primera victoria).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (con el anillo de choque) queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa.
- Pausa/blur/destroy limpian `dirQueue`; al reanudar se reinicia `lastTime` y `acc = 0`; `dt` capado a **50 ms**. Las fases `ready` y `end` también se congelan en pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, cuenta atrás ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** rejilla 40×30 de 16 px; el borde exterior del canvas es el muro (salir de `x ∈ [0, 39]` o `y ∈ [0, 29]` es choque). Sin obstáculos internos.
- **Inicio de ronda:** rejilla vacía. Jugador en (8, 15) mirando a la derecha; CPU en (31, 15) mirando a la izquierda. La celda inicial de cada moto ya cuenta como estela propia. `dirQueue` vacía, `cellsThisRound = 0`.
- **Fase `ready`:** **1000 ms** sin movimiento; las motos parpadean a 4 Hz (visibles 125 ms, ocultas 125 ms). El jugador puede encolar **un** giro que se aplica en el primer paso.
- **Velocidad:** `tickMs = max(50, 110 − 8 × (round − 1))` (ronda 1: 110 ms, 2: 102, … 8: 54, 9+: 50). Ambas motos avanzan una celda en el mismo paso.
- **Giros del jugador:** `dirQueue` admite 2 giros; se descarta un giro igual a la dirección actual (o a la última encolada) o contrario a ella (sin reversa de 180°). Se aplica un giro por paso.
- **Resolución de un paso** (simultánea): (1) la CPU decide dirección con `chooseCpuDir` sobre la rejilla actual; (2) el jugador toma su siguiente giro de la cola; (3) se calculan ambas cabezas nuevas; (4) una moto choca si su cabeza nueva sale de la arena o cae en una celda no libre; (5) si ambas cabezas nuevas coinciden, chocan las dos; (6) las motos que no chocan marcan su celda en `grid` y el jugador suma `cellsThisRound + 1`. Un cruce frontal adyacente (cada una entra en la celda de la otra) es choque doble por la regla (4).
- **IA de la CPU** (`chooseCpuDir`): candidatas = recto, izquierda y derecha relativas. Se descartan las que chocan en el siguiente paso. Para cada candidata se calcula `floodFill` desde su celda nueva con tope **600** celdas. Se elige la de mayor espacio; si la de seguir recto tiene `≥ 0.9 × máximo`, se sigue recto. Con probabilidad `err = max(0.02, 0.2 − 0.03 × (round − 1))` (ronda 1: 0.20, 2: 0.17, … 7+: 0.02) se elige en su lugar una candidata segura al azar. Si no hay candidata segura, sigue recto (y choca).
- **Fin de ronda:** al terminar el paso, si alguna moto chocó se pasa a `phase = "end"` durante **1200 ms** (se dibuja un anillo en la celda de choque de cada moto caída: radio 0 → 24 px en 400 ms, luego se mantiene) y se resuelve el resultado:
  - **Gana el jugador** (solo choca la CPU): `+cellsThisRound` y `+100 × round` puntos (un único `onScore`), `wins + 1` (`onStat("wins")`), `round + 1` (`onLevel`).
  - **Pierde el jugador** (solo choca el jugador): `+cellsThisRound` puntos, `lives − 1` (`onLives`). Si `lives = 0` → `onLives(0)` y `onGameOver(score)` inmediatamente (sin esperar los 1200 ms). Si no, `round + 1` (`onLevel`).
  - **Empate** (chocan ambas en el mismo paso): `+cellsThisRound` puntos; no cambian vidas ni ronda (la ronda se repite a la misma velocidad).
  - Tras los 1200 ms se reinicia la rejilla y empieza la fase `ready` de la siguiente ronda.
- **Puntuación:** solo se emite `onScore` al resolver cada ronda (nunca por paso). Ejemplo: ganar la ronda 3 recorriendo 57 celdas suma 357.
- **Dibujo:** fondo `#05050f` con líneas de rejilla `rgba(0,245,255,0.08)` cada 16 px y borde de arena de 2 px `#00f5ff`. Estela del jugador `#00f5ff`, de la CPU `#ff2bd6`: celdas de 14×14 px con margen 1 px y `shadowBlur` 8 del mismo color (solo al dibujar estelas). Cabezas: cuadrado de 14 px `#ffffff` con borde de 2 px del color de la moto. Anillo de choque: trazo de 3 px `#ffe600`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente de rejilla, acumulador y cola de giros). Crear `.cover-tron-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_tron_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'tron-vs-cpu'` muestra la fila; `npm run build`.
2. Crear `lib/games/tron-vs-cpu/ai.ts` (`floodFill`, `chooseCpuDir`). Verificar: `npm run lint`; con rejilla vacía, `floodFill` desde (31, 15) devuelve 600 (tope); `chooseCpuDir` con `rand = () => 0.99` sigue recto en rejilla vacía y gira cuando la celda de delante está ocupada.
3. Crear `lib/games/tron-vs-cpu/engine.ts` (estado, fases, resolución de pasos, dibujo con fondo offscreen) y exportar `tronVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
4. Registrar `"tron-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/tron-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
5. Verificación en navegador (Playwright o manual): parpadeo de 1000 ms, girar con flechas y WASD, intentar reversa (no aplica), ganar una ronda (puntos, VICTORIAS, nivel 2, paso más rápido), perder una ronda (vida baja), forzar empate de frente (ronda repetida, vidas iguales), perder las 3 vidas, pausa (botón y `P`) en `ready`, `play` y `end`, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
6. `update games set published = true where id = 'tron-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
7. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `tron-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-tron-vs-cpu`), la ficha `/games/tron-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `DUELO`/`ESTELA`, dificultad 2, color cyan, categoría VERSUS; aparece con el filtro VERSUS).
- [ ] `/games/tron-vs-cpu/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] Cada ronda empieza con la rejilla vacía, jugador en (8, 15) a la derecha y CPU en (31, 15) a la izquierda, y 1000 ms de parpadeo sin movimiento.
- [ ] `←↑→↓` y `WASD` giran la moto; las flechas no hacen scroll; un giro de 180° no se aplica; dos giros rápidos se ejecutan en pasos consecutivos.
- [ ] El paso dura 110 ms en la ronda 1, 102 ms en la 2 y nunca baja de 50 ms.
- [ ] Chocar con el muro, con la estela propia o con la de la CPU hace perder la ronda; la CPU también muere por las mismas reglas.
- [ ] La CPU no se suicida si tiene una salida segura y tiende a elegir el lado con más espacio libre.
- [ ] Ganar la ronda `r` suma exactamente `100 × r` + celdas recorridas, sube VICTORIAS en 1 y el nivel en 1.
- [ ] Perder una ronda suma solo las celdas recorridas, baja una vida y sube el nivel en 1.
- [ ] Un choque simultáneo (misma celda o cruce frontal) suma solo las celdas, no cambia vidas ni nivel y repite la ronda.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (ronda) y VICTORIAS; `onScore` solo cambia al resolver rondas, sin eventos por frame.
- [ ] Pausa (botón y `P`) congela motos, fases `ready`/`end` y anillos; reanudar sin salto ni paso doble.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y letras WASD) no mueve la moto.
- [ ] Guardar inserta en `scores` con `game_id = 'tron-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/tron-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, ronda 1, VICTORIAS oculto, paso 110 ms, rejilla vacía).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/tron-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero inspirado en el patrón de Snake (rejilla, acumulador, cola de giros); **No:** reutilizar o modificar `lib/games/snake/` (se copian ideas, no se acopla código).
- **Sí:** un solo rival CPU (duelo puro); **No:** varias CPU ni turbo (son la variante 02).
- **Sí:** IA por flood fill con preferencia por seguir recto y error decreciente por ronda; **No:** búsqueda minimax (coste y complejidad innecesarios para 40×30).
- **Sí:** dificultad por velocidad (`110 − 8 × (r − 1)`, mínimo 50 ms) y por error de la IA; valores fijados aquí, ajustables solo editando el spec.
- **Sí:** 3 vidas y ronda como nivel para reutilizar el HUD; **Sí:** perder una ronda también avanza de nivel (la partida no se estanca).
- **Sí:** empate repite la ronda sin coste (justo y claro); **No:** contar el empate como derrota.
- **Sí:** puntuar en bloque al cerrar la ronda; **No:** `onScore` por paso (evita ~20 eventos/s).
- **Sí:** stat `VICTORIAS`, oculto con 0 por contrato de `onStat`.
- **Sí:** fase `ready` con parpadeo en lugar de texto (sin overlays en canvas).
- **Sí:** fondo offscreen por instancia (SPEC 13); **No:** sprites ni imágenes (sin carga asíncrona).
- **Sí:** `cat` VERSUS (primer juego de la categoría), color cyan y `.cover-tron-vs-cpu` nueva; **No:** reutilizar `.cover-duelo`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                      | Mitigation                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Resolver los movimientos en secuencia da ventaja a quien se mueve primero.                | Resolución simultánea en 6 pasos fijados en el spec; misma celda o cruce frontal = choque doble.                        |
| La IA es imbatible o trivial.                                                             | Error `0.2 → 0.02` por ronda y preferencia por recto; verificar en el paso 5 que la ronda 1 se gana con juego razonable. |
| `floodFill` en cada paso cuesta demasiado a 50 ms.                                        | Tope de 600 celdas por candidata, máx. 3 BFS por paso sobre `Uint8Array`; trivial a 20 pasos/s.                         |
| Rondas eternas si ambas motos quedan aisladas en regiones grandes.                        | Cada moto ocupa una celda por paso; la ronda dura como mucho 1200 pasos (~2 min a 110 ms).                              |
| `dt` grande tras pausar o cambiar de pestaña provoca varios pasos o salta la fase `ready`. | `lastTime` y `acc` se reinician al reanudar y tras blur; `dt` capado a 50 ms; `phaseMs` solo avanza sin pausa.          |
| Flechas o letras WASD interfieren con el input del modal.                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| `shadowBlur` por celda baja el rendimiento con la arena llena.                            | Fondo offscreen; `shadowBlur` solo en estelas y con `ctx.save/restore` por color (2 lotes por frame).                   |
| Doble loop / listeners por StrictMode.                                                    | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| El id con guiones requiere comillas en `ENGINES` y `_` en la migración.                   | Clave `"tron-vs-cpu"` entre comillas; carpeta `lib/games/tron-vs-cpu/`; migración `add_game_tron_vs_cpu`.               |
| Next 16 difiere del conocimiento previo.                                                  | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Varias CPU, turbo, power-ups, obstáculos y modo wrap.
- Multijugador humano local u online.
- HUD nativo de texto dentro del canvas y overlays de cuenta atrás/pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
