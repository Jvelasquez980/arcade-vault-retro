# SPEC GJ-galaga-02 — Juego real: GALAGA (variante: rush contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-12
> **Variant:** 02 de 2 — Contrarreloj moderno: 120 s de escuadrones que cruzan la pantalla sin formación, nave con movimiento libre en la zona baja y auto-disparo, multiplicador de combo, power-ups y cada impacto resta tiempo en lugar de vidas.
> **Objective:** Crear un motor TypeScript de Galaga (variante rush contrarreloj) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Galaga. Convierte el shooter de formaciones en una partida de **puntaje por tiempo**: no hay formación ni fases; llegan **escuadrones** con 5 patrones de vuelo (barrido, picada, bucle, pinza y pesado con escoltas) que cruzan la pantalla y se van si no los derribas. La partida dura **120 s**; no hay vidas: **cada impacto resta 10 s**, rompe el combo y quita los power-ups. La nave se mueve en **8 direcciones** dentro de una franja baja y **dispara sola** mientras se mantiene `Espacio`. Los derribos encadenados suben un **multiplicador ×1 a ×8**, derribar un escuadrón completo devuelve tiempo, y caen **power-ups** (TRIPLE, RÁFAGA, ESCUDO, +5s). Se distingue de la variante 01 (clásico: formación de 40, picadas, rayo tractor y caza doble, 3 vidas, cupo de 2 disparos, movimiento horizontal).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. `app/globals.css` no tiene clase de Galaga (`.cover-invaders` es de otro juego del prototipo); se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` reserva 6 en sus specs propuestos), dificultad 3, tags `CONTRARRELOJ` y `POWER-UPS`, 1 jugador, teclado. Canvas **600×600** (1:1). **Sin vidas** (no se declara `initialLives`), **nivel = intensidad** que sube cada 20 s (`showLevel: true`), stats extra `TIEMPO` (restante) y `MULT`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/squadrons.ts`: funciones puras y datos: `PATTERNS` (`barrido`, `picada`, `bucle`, `pinza`, `pesado`, con su nivel mínimo), `spawnSquadron(pattern, index, level, rand)` (devuelve los enemigos con su trayectoria paramétrica), `levelAt(elapsedMs)`, `spawnMs(level)`, `baseSpeed(level)`, `enemyFireRate(level)`, `multiplierFor(combo)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawFighter` (con escudo), `drawDrone`, `drawDart`, `drawHeavy` (con barra de 3 segmentos), `drawShot`, `drawEnemyShot`, `drawPowerUp`, `drawExplosion`, `drawLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `radial-gradient(circle at 50% 80%,#2a0030,#0a0a18)` con estrellas (`radial-gradient` repetido), `::after` con una nave magenta (`clip-path` triangular) abajo y `::before` con un arco punteado de enemigos cyan/amarillo cruzando en diagonal.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **nivel** (intensidad), stats extra `time` ("TIEMPO", `seconds`) y `mult` ("MULT", `int`). Sin vidas.
- Sin HUD nativo de texto en el canvas, salvo etiquetas efímeras (`+1.5s`, `-10s`, `ESCUDO`, `TRIPLE`, `RÁFAGA`, `+5s`, puntos de escuadrón) y una barra fina de 4 px en `y = 596` con el tiempo restante de los power-ups activos (efecto de juego, no overlay).
- Controles: `←↑→↓` y `WASD` mueven la nave; `Espacio` mantenido dispara en automático. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Formación fija, fases, rayo tractor y caza doble (son de la variante 01).
- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Jefes finales, bombas de pantalla, más tipos de power-up o mejoras permanentes.
- Selector de duración, dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', '120 segundos de escuadrones: encadena derribos.',
       'Pilota tu nave con las flechas o WASD y mantén Espacio para disparar sin parar. Los escuadrones cruzan la pantalla en barridos, picadas, bucles y pinzas; derriba seguido para subir el multiplicador hasta ×8 y acaba con escuadrones completos para ganar tiempo. Cada impacto te quita 10 segundos y el combo. Recoge TRIPLE, RÁFAGA, ESCUDO y +5s. Cuando el reloj llega a cero, termina la partida.',
       'ARCADE', 'magenta', 'cover-galaga', 1, 1, '{keyboard}', '{CONTRARRELOJ,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 600, height: 600,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "mult", label: "MULT", color: "magenta", format: "int" },
      ],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `player { x, y, invulnMs, shield }`, `keys { up, down, left, right, fire }` (teclas mantenidas), `fireCooldownMs`, `shots: { x, y, vx, vy }[]`, `enemyShots: { x, y, vx, vy }[]`, `enemies: { id, type: "drone" | "dart" | "heavy", hp, squadId, t, x, y, path, fireAccMs, strafeMs }[]`, `squads: Map<squadId, { size, killed, escaped, pattern }>`, `powerUps: { x, y, kind }[]`, `triplesMs`, `burstMs`, `explosions`, `labels`, `stars`, `timeLeftMs`, `elapsedMs`, `level`, `spawnTimerMs`, `squadIndex`, `combo`, `comboIdleMs`, `mult`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("time", s)`, `onStat("mult", m)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 120)`, `onStat("mult", 1)`. No se emite `onLives` (el juego no tiene vidas).
- `onStat("time", s)` con `s = Math.ceil(timeLeftMs / 1000)` solo cuando cambia (una vez por segundo y en cada salto de ±tiempo). Al llegar a 0 se emite `onStat("time", 0)` (oculta el stat, contrato de `onStat`).
- Game over: cuando `timeLeftMs ≤ 0` se emite `onStat("time", 0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. (Sin vidas no aplica `onLives(0)`; el orden equivalente es "tiempo a 0 → game over".)
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Movimiento y disparo son de tecla mantenida; `e.repeat` se ignora (el auto-disparo lo cronometra el motor).
- Pausa/blur/destroy ponen todas las `keys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Reloj:** `timeLeftMs` empieza en **120000**, baja con `dt` solo en juego y tiene tope **180000**. `elapsedMs` (tiempo real jugado) sube con `dt` y no se ve afectado por bonus ni penalizaciones.
- **Nave:** inicio en (300, 540), cuerpo 26×24 px, hitbox círculo de radio **10**. Velocidad **280 px/s** en 8 direcciones (diagonal normalizada), limitada a `x ∈ [20, 580]`, `y ∈ [420, 570]`.
- **Disparo automático:** mientras `Espacio` está pulsado se dispara al instante al pulsar y luego cada **200 ms** (con RÁFAGA, **100 ms**). Proyectil 3×12 px a **640 px/s** hacia arriba desde (`x`, `y − 12`); con TRIPLE salen 3 (0° y ±12°). Máximo **12** proyectiles propios en pantalla (si no caben, el disparo de ese tick se omite).
- **Nivel (intensidad):** `level = 1 + Math.floor(elapsedMs / 20000)` (sin tope) → `onLevel(level)` al subir.
- **Escuadrones:** el primero a los **1000 ms**; luego uno cada `spawnMs(level) = max(1400, 3400 − 300 × (level − 1))` ms, con máximo **3** escuadrones vivos a la vez (si hay 3, se espera). Patrón al azar entre los disponibles por nivel; velocidad base `baseSpeed(level) = min(150 + 15 × (level − 1), 270)` px/s. `squadIndex` par = entra por la izquierda/arriba-izquierda, impar = espejo.
  - `barrido` (nivel 1+): 8 drones separados 40 px entran por `x = −20` (o `620`) a `y = 110`; avanzan en horizontal a `baseSpeed` con `y = 110 + 60 × sin(2π × x / 300)`; salen por el lado contrario.
  - `picada` (nivel 1+): 6 darts en V con `x = 300 + (k − 2.5) × 70` y `y = −20 − |k − 2.5| × 30` (k = 0…5); bajan a `1.4 × baseSpeed` corrigiendo su `x` hacia la nave a **60 px/s**; salen por `y > 620`.
  - `bucle` (nivel 2+): 8 drones separados 160 ms entran por (150, −20) (o 450); bajan en vertical hasta `y = 250`, dan una vuelta completa de radio **90** alrededor de (300, 250) y salen en horizontal por el lado contrario al de entrada, todo a `baseSpeed`.
  - `pinza` (nivel 2+): 4 darts por la izquierda y 4 por la derecha a `y = 180`, separados 50 px; cruzan en diagonal hasta `y = 440` en el lado contrario a `1.4 × baseSpeed` y salen.
  - `pesado` (nivel 3+): 1 heavy que entra por (300, −30) y baja a `0.5 × baseSpeed` hasta `y = 140`; durante **6000 ms** se desplaza entre `x = 120` y `x = 480` a 90 px/s y dispara un abanico de 3 (0°, ±15° respecto a la nave) cada **1200 ms**; luego sale hacia arriba a `baseSpeed`. Lo escoltan 4 drones girando a su alrededor en radio **50** a 1 vuelta/2 s; si el heavy muere, los escoltas siguen su última dirección y salen.
  - Un enemigo que sale de la pantalla cuenta como `escaped` (sin penalización).
- **Enemigos:** drone (radio 12, 1 impacto, **100** pts), dart (radio 11, 1 impacto, **150** pts), heavy (radio 16, **3** impactos, **400** pts; parpadea blanco 80 ms al recibir daño).
- **Disparo enemigo:** drones y darts con `y ∈ [0, 400]` acumulan `fireAccMs` y cada **250 ms** disparan con probabilidad `enemyFireRate(level) / 4`, con `enemyFireRate(level) = min(0.12 + 0.04 × (level − 1), 0.4)` disparos/s; proyectil 4×10 apuntado a la nave a **230 px/s**. Máximo **14** proyectiles enemigos en pantalla.
- **Combo y multiplicador:** cada derribo suma `combo + 1` y reinicia `comboIdleMs = 0`; `mult = multiplierFor(combo) = min(1 + Math.floor(combo / 5), 8)`. Si pasan **2500 ms** sin derribos, `combo = 0` (`mult = 1`). `onStat("mult", mult)` solo al cambiar.
- **Puntos:** cada derribo da `base × mult`. **Escuadrón completo** (todos derribados, ninguno escapado): `+50 × size × mult` puntos y `timeLeftMs += 1500` (etiqueta `+1.5s`).
- **Power-ups:** cada derribo de drone o dart suelta cápsula con probabilidad **0.08**; el heavy suelta siempre una. Tipo uniforme entre `TRIPLE`, `RÁFAGA`, `ESCUDO` y `+5s`. La cápsula (rombo de 18 px con letra T/R/E/+) cae a **90 px/s**, se recoge si su centro está a ≤ **18 px** de la nave y desaparece al salir por abajo. Efectos: `TRIPLE` y `RÁFAGA` duran **8000 ms** (recoger el mismo renueva a 8000; se acumulan entre sí); `ESCUDO` absorbe el siguiente impacto (máximo 1, sin caducidad); `+5s` suma 5000 ms al reloj.
- **Impacto recibido** (proyectil enemigo o choque con un enemigo; ignorado durante `invulnMs`): si hay `ESCUDO`, se consume y la nave queda **1000 ms** invulnerable. Si no: `timeLeftMs −= 10000` (etiqueta `-10s`), `combo = 0` (`mult = 1`), se cancelan `TRIPLE`/`RÁFAGA` y la nave queda **1200 ms** invulnerable (parpadeo a 8 Hz) sin moverse de sitio. El enemigo que choca muere sin dar puntos ni sumar combo (y su escuadrón ya no puede completarse). Si `timeLeftMs ≤ 0` → game over.
- **Dibujo:** fondo `#05000f` con 80 estrellas de 1–2 px en dos capas (40 y 110 px/s). Nave blanca con cabina `#ff2bd6`; escudo: anillo `#00f5ff` de radio 18 con alpha pulsante. Drone amarillo `#ffe600` con alas azules `#2a6bff`; dart rojo `#ff3355` con alas blancas; heavy verde `#00ff88` con alas amarillas y barra de vida de 3 segmentos. Disparo propio `#ffffff` con halo `#ff2bd6`; disparo enemigo `#ff3355`. Cápsulas: TRIPLE `#00f5ff`, RÁFAGA `#ffe600`, ESCUDO `#00ff88`, +5s `#ff2bd6`. Explosiones: 8 líneas radiales 0 → 20 px en 300 ms. Etiquetas: 14 px monoespaciado, suben 24 px y se desvanecen en 700 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/squadrons.ts`. Verificar: `npm run lint`; `spawnMs(1) = 3400`, `spawnMs(8) = 1400`, `baseSpeed(1) = 150`, `baseSpeed(9) = 270`, `enemyFireRate(1) = 0.12`, `enemyFireRate(8) = 0.4`, `multiplierFor(4) = 1`, `multiplierFor(5) = 2`, `multiplierFor(50) = 8`, `levelAt(39999) = 2`.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): movimiento en 8 direcciones y límites de la franja, auto-disparo a 5/s, los 5 patrones (bucle y pinza a los 20 s, pesado a los 40 s), multiplicador hasta ×2 y reinicio a los 2,5 s sin derribos, escuadrón completo (+1.5 s), los 4 power-ups, impacto con y sin escudo (−10 s, MULT a 1), reloj a 0, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`POWER-UPS`, dificultad 3, color magenta, categoría ARCADE).
- [ ] `/games/galaga/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven la nave a 280 px/s (diagonal sin exceso de velocidad) dentro de `x ∈ [20, 580]`, `y ∈ [420, 570]`; las flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara al instante y luego cada 200 ms (100 ms con RÁFAGA; 3 proyectiles con TRIPLE); nunca hay más de 12 proyectiles propios.
- [ ] El HUD de React muestra TIEMPO 120 al empezar, baja 1 por segundo de juego y no muestra vidas.
- [ ] El nivel sube a los 20 s, 40 s, …; en nivel 1 solo aparecen `barrido` y `picada`, desde nivel 2 también `bucle` y `pinza`, y desde nivel 3 `pesado`.
- [ ] En nivel 1 llega un escuadrón cada 3400 ms (mínimo 1400 ms en niveles altos) y nunca hay más de 3 vivos.
- [ ] Puntos: drone 100, dart 150, heavy 400 (3 impactos), multiplicados por MULT; MULT sube a ×2 al 5.º derribo seguido, tope ×8, y vuelve a ×1 tras 2500 ms sin derribos.
- [ ] Derribar un escuadrón completo suma 50 × tamaño × MULT y 1,5 s al reloj, con etiqueta `+1.5s`; un escuadrón con un enemigo escapado o muerto por choque no da bonus.
- [ ] Los power-ups caen con probabilidad 0,08 (siempre del heavy) y aplican TRIPLE/RÁFAGA 8 s, ESCUDO de un uso y +5 s; el reloj nunca supera 180 s.
- [ ] Un impacto sin escudo resta 10 s, pone MULT a 1, cancela TRIPLE/RÁFAGA y da 1200 ms de invulnerabilidad; con escudo solo consume el escudo.
- [ ] Al llegar el reloj a 0 se emite `onStat("time", 0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] Sin eventos por frame: TIEMPO se emite una vez por segundo (y en cada salto), MULT y nivel solo al cambiar.
- [ ] Pausa (botón y `P`) congela reloj, enemigos, disparos, power-ups y temporizadores; reanudar sin salto de tiempo ni movimiento o disparo residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 120, MULT 1, nivel 1, nave en (300, 540), sin escudo, power-ups, enemigos ni proyectiles).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; `prod-setup.md` registra la migración.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** contrarreloj de 120 s con penalización de 10 s por impacto; **No:** vidas (no se declara `initialLives`, el HUD no las muestra). Es la diferencia central con la variante 01 y hace que todas las partidas duren parecido.
- **Sí:** escuadrones que cruzan y escapan; **No:** formación fija, fases, rayo tractor ni caza doble.
- **Sí:** movimiento en 8 direcciones en la franja baja y auto-disparo; favorece el ritmo rápido y esquivar en lugar del disparo medido del clásico.
- **Sí:** multiplicador ×1–×8 por combo y bonus de escuadrón completo (puntos + 1,5 s); abren mucho el rango del leaderboard y premian la precisión.
- **Sí:** 4 power-ups simples con duración fija; **No:** mejoras permanentes ni bombas.
- **Sí:** tope del reloj en 180 s para acotar la duración máxima de la partida.
- **Sí:** stats `TIEMPO` (restante) y `MULT`; `showLevel` como intensidad cada 20 s.
- **Sí:** valores de balance (velocidades, intervalos, probabilidades, puntos, duraciones) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 600×600 (1:1) para dar espacio lateral a barridos y pinzas.
- **Sí:** `cat` ARCADE y color magenta; **Sí:** `.cover-galaga` nueva.
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por los specs de `missile-command`.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                       |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Emitir `onStat("time")` por frame satura React.                                          | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                        |
| Bonus de escuadrón cobrado dos veces o nunca.                                            | `squads` por `squadId` con `killed`/`escaped`; se evalúa y elimina una sola vez cuando `killed + escaped = size`. |
| Partidas infinitas acumulando bonus de tiempo.                                           | Tope de 180 s en el reloj y aparición más rápida por nivel; verificar en el paso 6 y ajustar solo editando el spec. |
| Demasiados proyectiles/enemigos en niveles altos bajan el rendimiento.                   | Topes de 12 propios, 14 enemigos y 3 escuadrones vivos; arrays filtrados en sitio.                                |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o lanza escuadrones de golpe. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; reloj y temporizadores solo avanzan en juego. |
| Flechas, `WASD` o espacio interfieren con el input del modal.                            | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| Auto-disparo o movimiento "pegado" tras perder foco.                                     | `blur` y `pause` ponen todas las `keys` a `false`.                                                                 |
| HUD sin vidas confunde la convención `onLives(0)` → `onGameOver`.                        | Regla explícita: no se declara `initialLives` ni se emite `onLives`; el fin es `onStat("time", 0)` → `onGameOver`. |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Formación fija, fases, rayo tractor y caza doble.
- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Jefes finales, bombas, mejoras permanentes y más power-ups.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de duración, dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
