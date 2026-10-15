# SPEC GJ-missile-command-01 — Juego real: MISSILE COMMAND (variante: clásico por oleadas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-15
> **Variant:** 01 de 2 — Missile Command clásico fiel: mira libre, 3 baterías con munición limitada por oleada, 6 ciudades, oleadas con bonus y multiplicador, misiles que se dividen y bombarderos.
> **Objective:** Crear un motor TypeScript de Missile Command dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/missile-command` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Missile Command. Recrea el arcade de 1980: el jugador mueve una **mira libre** y dispara contramisiles desde **3 baterías** (izquierda, centro, derecha) con **munición limitada por oleada**; las explosiones circulares destruyen los misiles enemigos que caen sobre **6 ciudades**. La partida se mide en oleadas, con bonus por ciudades y misiles sobrantes. Se distingue de la variante 02 (torreta única que apunta por ángulo, detonación manual, munición infinita y reacciones en cadena en tiempo continuo): aquí el reto es **gestionar munición y elegir batería**, con ritmo por oleadas.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas, líneas y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-missile-command`.

Decisiones fijadas por el agente (no se reabren): `id` `missile-command`, título `MISSILE COMMAND`, `cat` `SHOOTER`, color `yellow`, `sort_order` **6** (siguiente libre; frogger = 5), dificultad 3, tags `CLÁSICO` y `DEFENSA`, 1 jugador, teclado. Canvas **640×480** (4:3). Las **ciudades vivas son las vidas** (`initialLives: 6`), el **nivel es la oleada** (`showLevel: true`) y hay stat extra `MISILES`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/missile-command/engine.ts`: sin globals de módulo; exporta `missileCommandDef: GameEngineDef` con `createMissileCommand(canvas, events) → GameController`.
- Módulo `lib/games/missile-command/waves.ts`: funciones puras de balance (`waveConfig(wave) → { enemies, speed, salvoMs, splitChance, bombers, mult }`) y constantes de posiciones (`CITY_X`, `BATTERY_X`, `GROUND_Y`).
- Módulo `lib/games/missile-command/draw.ts`: `drawSky`, `drawGround`, `drawCity`, `drawBattery` (con pila de munición), `drawTrail`, `drawExplosion`, `drawBomber`, `drawCrosshair` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"missile-command"` en `lib/games/registry.ts`.
- Clase `.cover-missile-command` en `app/globals.css`: cielo `linear-gradient(180deg,#1a1400,#0a0a18)` con `::after` de suelo amarillo y `::before` de dos círculos radiales amarillos/blancos (explosiones).
- Migración `add_game_missile_command`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **640×480**.
- HUD de React: puntaje, **6 vidas** (= ciudades vivas), **nivel** (= oleada) y stat extra `ammo` ("MISILES", `int`, munición total restante).
- Sin HUD nativo de texto en el canvas; la munición se ve además como pila de misiles bajo cada batería (parte del escenario). El texto de transición entre oleadas no se dibuja (sin overlays).
- Controles: `←↑→↓` mueven la mira; `Z` / `X` / `C` disparan desde la batería izquierda / central / derecha; `Espacio` dispara desde la batería con munición más cercana en horizontal a la mira. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'missile-command'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `missile-command`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Satélites, bombas inteligentes que esquivan explosiones y cambios de paleta por oleada del arcade.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('missile-command', 'MISSILE COMMAND', 'Defiende tus ciudades del bombardeo.',
       'Mueve la mira con las flechas y dispara contramisiles desde tres baterías con Z, X y C (o Espacio desde la más cercana). Cada batería tiene 10 misiles por oleada: sus explosiones destruyen los misiles enemigos antes de que caigan sobre tus seis ciudades. Las oleadas aceleran, los misiles se dividen y aparecen bombarderos; la partida termina cuando cae la última ciudad.',
       'SHOOTER', 'yellow', 'cover-missile-command', 1, 1, '{keyboard}', '{CLÁSICO,DEFENSA}', 3, 6, false);

Definición del motor:

    export const missileCommandDef: GameEngineDef = {
      width: 640, height: 480,
      initialLives: 6,
      showLevel: true,
      stats: [{ key: "ammo", label: "MISILES", color: "cyan", format: "int" }],
      create: createMissileCommand,
    };

Estado interno (dentro de `createMissileCommand`): `cross { x, y }`, `keysDown: Set<string>` (flechas), `cities: boolean[6]`, `cityReserve` (ciudades bonus pendientes), `batteries: { ammo, alive }[3]`, `shots: { x0, y0, x, y, tx, ty, speed }[]` (contramisiles en vuelo), `explosions: { x, y, r, age, owner: "player" | "enemy" }[]`, `enemies: { x0, y0, x, y, tx, ty, vx, vy, split: boolean, splitY }[]`, `bomber { x, y, dir, dropMs } | null`, `wave`, `toSpawn` (enemigos de la oleada aún por lanzar), `bombersLeft`, `salvoTimer`, `phase: "play" | "intermission"`, `phaseMs`, `score`, `nextBonusAt`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives` (ciudades vivas), `onLevel` (oleada), `onStat("ammo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(6)`, `onLevel(1)`, `onStat("ammo", 30)`.
- `onStat("ammo", 0)` oculta el stat en el HUD (contrato de `onStat`); es el comportamiento esperado cuando no queda munición.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Las teclas de disparo ignoran `e.repeat` (un disparo por pulsación); las flechas usan `keysDown` (movimiento continuo mientras se mantienen).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` vacía `keysDown` (no emite eventos).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de oleada ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** suelo de `y = 440` a `480`. Baterías (montículos trapezoidales de 48 px de base y 20 px de alto) con boca en x = **40, 320, 600**, `y = 420`. Ciudades (36×20 px, base en `y = 440`) con centro en x = **112, 168, 224, 416, 472, 528**.
- **Mira:** empieza en (320, 240). Se mueve **420 px/s** en cada eje con las flechas mantenidas (diagonales permitidas, sin normalizar). Limitada a `x ∈ [8, 632]`, `y ∈ [16, 400]`.
- **Disparo:** `Z`/`X`/`C` disparan desde batería 0/1/2 si está viva y con munición; si no, la pulsación no hace nada. `Espacio` elige la batería viva con munición de menor `|BATTERY_X − cross.x|` (empate: la central). El objetivo es la posición de la mira en el momento del disparo (se marca con una X pequeña). Máximo **8** contramisiles en vuelo simultáneos; el 9.º disparo se ignora sin gastar munición.
- **Contramisil:** velocidad **640 px/s** desde la batería central y **400 px/s** desde las laterales, en línea recta; deja estela. Al llegar al objetivo crea una explosión del jugador ahí.
- **Explosión del jugador:** radio crece de 0 a **36 px** en 400 ms, se mantiene 300 ms, se encoge a 0 en 400 ms (1100 ms en total). Todo misil enemigo cuya cabeza esté a distancia `≤ r` muere y crea una nueva explosión del jugador en su posición (reacción en cadena clásica). Un bombardero dentro de `r` (hitbox círculo de 12 px de radio) también muere y explota.
- **Munición:** 10 misiles por batería al iniciar cada oleada (30 en total); `onStat("ammo", total)` al cambiar.
- **Oleada `w`** (`waveConfig`):
  - Misiles enemigos: `min(10 + 2 × (w − 1), 30)`.
  - Velocidad: `min(40 + 8 × (w − 1), 120)` px/s.
  - Salvas: cada `max(1200, 3000 − 150 × (w − 1))` ms se lanzan entre 2 y 4 misiles (aleatorio uniforme, sin exceder `toSpawn`); la primera salva sale 1000 ms tras empezar la oleada.
  - División: desde `w ≥ 2`, cada misil tiene probabilidad `min(0.1 + 0.05 × (w − 2), 0.35)` de ser divisor; al cruzar `splitY` (aleatorio en `[120, 240]`) se divide una vez en 3 (el original + 2 nuevos hacia otros objetivos al azar). Los nuevos no cuentan en `toSpawn` pero hay que destruirlos o dejarlos caer para acabar la oleada.
  - Bombarderos: desde `w ≥ 3`, **1** por oleada; aparece 4000 ms tras empezar, cruza en `y = 100` de un borde al otro a **60 px/s** y suelta un misil enemigo cada **2000 ms** (no cuentan en `toSpawn`).
  - Multiplicador: `mult = min(1 + Math.floor((w − 1) / 2), 6)` (oleadas 1–2 ×1, 3–4 ×2, … 11+ ×6).
- **Misil enemigo:** nace en `y = 0` con `x` aleatoria en `[20, 620]`; su objetivo es una ciudad viva o batería viva al azar (9 posibles). Avanza en línea recta con estela roja. Al llegar al objetivo crea una explosión enemiga (radio 0 → **24 px** en 300 ms y de vuelta a 0 en 300 ms; no destruye otros enemigos ni contramisiles) y destruye la ciudad o batería objetivo si sigue viva. Una batería destruida pierde su munición restante (`onStat("ammo")`) y no dispara hasta la siguiente oleada.
- **Puntuación** (siempre × `mult` de la oleada en curso):
  - Misil enemigo destruido: **25**. Bombardero destruido: **100**.
  - Fin de oleada: **5** por cada misil sin usar y **100** por cada ciudad viva.
- **Fin de oleada:** cuando `toSpawn = 0`, no hay enemigos, bombardero, contramisiles ni explosiones activas. Se suma el bonus, `phase = "intermission"` durante **2000 ms** (sin enemigos; la mira se puede mover pero no se dispara), luego `wave + 1`, `onLevel(wave)`, baterías reconstruidas con 10 misiles cada una, `onStat("ammo", 30)`.
- **Ciudad bonus:** cada **10000** puntos (`nextBonusAt` 10000, 20000, …) `cityReserve + 1`. Al empezar cada oleada, mientras `cityReserve > 0` y haya ciudades destruidas, se reconstruye la de menor índice, `cityReserve − 1`, `onLives(vivas)`.
- **Vidas = ciudades:** al destruirse una ciudad, `onLives(vivas)`. Si `vivas = 0` → `onLives(0)` y `onGameOver(score)` inmediatamente (la reserva no salva la partida).
- **Dibujo:** cielo `#05050f` con degradado a `#140a28` cerca del suelo; suelo amarillo oscuro `#4a3a00` con borde `#ffe600`. Ciudades: 3 edificios cyan `#00f5ff` con ventanas; destruidas: escombro gris `#333`. Baterías: montículo `#ffe600` y pila triangular de misiles `#ffffff` (uno por munición). Estelas enemigas `#ff3355` (línea de 1.5 px), cabeza blanca de 2 px. Contramisiles: estela `#00f5ff`. Explosiones del jugador: círculo con gradiente radial blanco → `#ffe600` → `#ff2bd6`. Bombardero: silueta de avión `#ff2bd6`. Mira: cruz `#ffffff` de 16 px con hueco central.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-missile-command` en `app/globals.css`. Aplicar migración `add_game_missile_command` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'missile-command'` muestra la fila; `npm run build`.
2. Crear `lib/games/missile-command/waves.ts` (`waveConfig` y constantes). Verificar: `npm run lint`; `waveConfig(1)` da 10 misiles, 40 px/s, salva 3000 ms, ×1; `waveConfig(12)` da 30 misiles, 120 px/s, salva 1350 ms, ×6.
3. Crear `lib/games/missile-command/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/missile-command/engine.ts` y exportar `missileCommandDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"missile-command"` en `lib/games/registry.ts`. Verificar: `/games/missile-command/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover la mira, disparar con `Z`/`X`/`C`/`Espacio`, agotar una batería, reacción en cadena, perder una ciudad (HUD de vidas baja), perder una batería, completar oleada 1 (bonus y paso a oleada 2), ver división de misiles (oleada 2+) y bombardero (oleada 3+), perder las 6 ciudades, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'missile-command'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `missile-command` con `published = true` y los metadatos del spec (`sort_order` 6); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-missile-command`), la ficha `/games/missile-command` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`DEFENSA`, dificultad 3, color amarillo, categoría SHOOTER).
- [ ] `/games/missile-command/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] Las flechas mueven la mira a 420 px/s mientras se mantienen, sin salir de `x ∈ [8, 632]`, `y ∈ [16, 400]`; las flechas y `Espacio` no hacen scroll.
- [ ] `Z`/`X`/`C` disparan desde la batería izquierda/central/derecha; `Espacio` desde la batería con munición más cercana a la mira; mantener la tecla no repite disparos.
- [ ] El contramisil central viaja a 640 px/s y los laterales a 400 px/s; nunca hay más de 8 en vuelo.
- [ ] La explosión del jugador crece hasta 36 px y dura 1100 ms; un misil enemigo destruido dentro de ella genera otra explosión (cadena).
- [ ] La oleada 1 lanza exactamente 10 misiles a 40 px/s; la oleada 2 lanza 12 a 48 px/s y puede tener divisores; desde la oleada 3 aparece un bombardero.
- [ ] Destruir un misil suma 25 × mult y un bombardero 100 × mult (mult ×1 en oleadas 1–2, ×2 en 3–4).
- [ ] Al acabar una oleada se suma 5 × mult por misil sin usar y 100 × mult por ciudad viva; tras 2000 ms empieza la siguiente con 30 misiles y el nivel del HUD sube.
- [ ] Un impacto en ciudad la convierte en escombro y baja las vidas del HUD; un impacto en batería la anula hasta la siguiente oleada y descuenta su munición de MISILES.
- [ ] Cada 10000 puntos se reconstruye una ciudad destruida al inicio de la siguiente oleada (vidas del HUD suben).
- [ ] Perder la 6.ª ciudad emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (6 → 0), nivel (oleada) y MISILES (30 al empezar cada oleada); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, contramisiles, explosiones, temporizadores y mira; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `Z`, `X`, `C`, espacio) no mueve la mira ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'missile-command'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/missile-command` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 6 ciudades, oleada 1, 30 misiles, mira en (320, 240), sin enemigos ni explosiones).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/missile-command/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** ciudades como vidas (`initialLives: 6`) para reutilizar el HUD y respetar el orden `onLives(0)` → `onGameOver`; **No:** un stat aparte de ciudades.
- **Sí:** oleada como nivel (`showLevel: true`) y stat `MISILES`; la munición es la decisión central de esta variante.
- **Sí:** tres teclas de batería (`Z`/`X`/`C`) como el original más `Espacio` de conveniencia; **No:** `WASD` para la mira (choca con `Z`/`X`/`C` y la pulsación cruzada en una mano).
- **Sí:** reacción en cadena de las explosiones del jugador (fiel al original, sin coste extra).
- **Sí:** divisores desde la oleada 2 y un bombardero desde la 3; **No:** satélites ni bombas inteligentes (más IA; spec aparte).
- **Sí:** game over inmediato al caer la última ciudad; **No:** esperar al final de la oleada (más simple y claro para el leaderboard).
- **Sí:** valores de balance (velocidades, salvas, multiplicador, bonus, ciudad cada 10000) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER y color amarillo (explosiones; distingue de Asteroids, cyan); **Sí:** `.cover-missile-command` nueva.
- **Sí:** canvas 640×480 (4:3, como el monitor del arcade).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reacciones en cadena generan muchas explosiones y bajan el rendimiento.               | Cada enemigo muere una sola vez (se elimina del array al detectar); explosiones con vida fija de 1100 ms.        |
| Mover la mira con teclado es lento frente al mouse del original.                      | 420 px/s cruza la pantalla en ~1.5 s; enemigos de oleada 1 a 40 px/s tardan ~11 s en caer. Verificar en paso 6.   |
| La oleada nunca termina por un contador mal llevado (divisores, bombardero).          | Condición de fin basada en arrays vacíos + `toSpawn = 0` + bombardero `null`, no en contadores derivados.         |
| Emitir `onStat("ammo")` o `onLives` por frame satura React.                           | Emitir solo en disparo, pérdida de batería, inicio de oleada y cambio de ciudades vivas.                          |
| `dt` grande tras pausar o cambiar de pestaña teletransporta misiles a sus objetivos. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                              |
| Flechas, `Z`/`X`/`C` o espacio interfieren con el input del modal.                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                              |
| Tecla de flecha "pegada" tras perder foco.                                            | `blur` y `pause` vacían `keysDown`.                                                                               |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                            |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                    | Clave `"missile-command"` entre comillas; carpeta `lib/games/missile-command/`; migración con `_` en el nombre.    |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                   |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Satélites, bombas inteligentes y cambios de paleta por oleada.
- HUD nativo de texto dentro del canvas y overlays de pausa/transición/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
