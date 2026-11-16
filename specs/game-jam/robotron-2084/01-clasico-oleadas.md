# SPEC GJ-robotron-2084-01 — Juego real: ROBOTRON 2084 (variante: clásico doble stick por oleadas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-16
> **Variant:** 01 de 2 — Robotron clásico fiel: doble stick (WASD mueve, flechas disparan en 8 direcciones), oleadas cerradas de Grunts, Hulks, Electrodes, Spheroids y Enforcers, rescate de humanos con bonus creciente y 3 vidas.
> **Objective:** Crear un motor TypeScript de Robotron 2084 dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/robotron-2084` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Robotron 2084. Recrea el arcade de 1982: arena cerrada, **movimiento y disparo independientes** (doble stick en teclado: `WASD` mueve, flechas disparan, combinables en 8 direcciones), **oleadas discretas** que terminan al eliminar a todos los robots destructibles, **humanos** que rescatar con bonus que crece dentro de la oleada (1000 → 5000) y **3 vidas** con vida extra por puntos. Se distingue de la variante 02 (supervivencia continua contrarreloj, un solo stick con bloqueo de dirección, sobrecalentamiento, multiplicador por racha y 1 vida): aquí el reto es **limpiar oleadas** priorizando amenazas y salvando humanos, con ritmo de arcade y muerte que no termina la partida.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events, skin?) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y círculos. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-robotron-2084`.

Decisiones fijadas por el agente (no se reabren): `id` `robotron-2084`, título `ROBOTRON 2084`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` reserva el 6 en sus specs propuestas), dificultad 4, tags `CLÁSICO` y `DOBLE STICK`, 1 jugador, teclado. Canvas **640×480** (4:3). **3 vidas** (`initialLives: 3`), **nivel = oleada** (`showLevel: true`), stat extra `FAMILIA` (humanos por rescatar). Sin Brains/Progs, Quarks/Tanks ni sonido. Sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/robotron-2084/engine.ts`: sin globals de módulo; exporta `robotron2084Def: GameEngineDef` con `createRobotron2084(canvas, events, skin?) → GameController` (acepta y por ahora ignora `skin`).
- Módulo `lib/games/robotron-2084/waves.ts`: funciones puras `waveConfig(w) → { grunts, electrodes, hulks, spheroids, humans, gruntStepMs }` y constantes de arena (`ARENA`, `PLAYER_START`, `SAFE_RADIUS`).
- Módulo `lib/games/robotron-2084/draw.ts`: `drawArena`, `drawPlayer`, `drawHuman`, `drawGrunt`, `drawHulk`, `drawElectrode`, `drawSpheroid`, `drawEnforcer`, `drawSpark`, `drawShot`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `"robotron-2084"` en `lib/games/registry.ts`.
- Clase `.cover-robotron-2084` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%, #2a0030, #0a0a18)`, `::before` con marco rectangular `#ff2bd6` de 2 px inset 12%, `::after` con un cuadrado blanco central (jugador) rodeado de 6 cuadrados `#ff3355` (grunts) vía `box-shadow`.
- Migración `add_game_robotron_2084`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **640×480**.
- HUD de React: puntaje, **3 vidas**, **nivel** (oleada) y stat extra `family` ("FAMILIA", `int`, color `cyan`).
- Sin HUD nativo de texto en el canvas salvo los popups de bonus de rescate (`+1000`… dibujados en el mundo, 800 ms).
- Controles: `W`/`A`/`S`/`D` mueven (8 direcciones combinando); `←↑→↓` disparan (8 direcciones combinando). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'robotron-2084'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `robotron-2084`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Brains (reprogramación de humanos en Progs), Quarks/Tanks, oleadas especiales y cambios de paleta por oleada del arcade.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('robotron-2084', 'ROBOTRON 2084', 'Sobrevive a la oleada de robots y salva a la familia.',
       'Muévete con WASD y dispara en ocho direcciones con las flechas, de forma independiente. Cada oleada llena la arena de Grunts que te persiguen, Electrodes fijos, Hulks indestructibles que aplastan humanos y Spheroids que fabrican Enforcers. Elimina a todos los robots destructibles para pasar de oleada y toca a los humanos para rescatarlos: cada rescate de la oleada vale más que el anterior. Tienes 3 vidas y una extra cada 25000 puntos.',
       'SHOOTER', 'magenta', 'cover-robotron-2084', 1, 1, '{keyboard}', '{CLÁSICO,DOBLE STICK}', 4, 7, false);

Definición del motor:

    export const robotron2084Def: GameEngineDef = {
      width: 640, height: 480,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "family", label: "FAMILIA", color: "cyan", format: "int" }],
      create: createRobotron2084,
    };

Estado interno (dentro de `createRobotron2084`): `player { x, y, alive }`, `moveKeys: Set<string>` (`KeyW/KeyA/KeyS/KeyD`), `fireKeys: Set<string>` (flechas), `fireCooldown`, `shots: { x, y, vx, vy }[]`, `humans: { x, y, vx, vy, turnMs }[]`, `grunts: { x, y }[]`, `gruntAcc`, `hulks: { x, y, dx, dy, turnMs }[]`, `electrodes: { x, y, phase }[]`, `spheroids: { x, y, vx, vy, spawnMs, made }[]`, `enforcers: { x, y, vx, vy, fireMs }[]`, `sparks: { x, y, vx, vy }[]`, `popups: { x, y, text, ageMs }[]`, `wave`, `rescuesInWave`, `phase: "grace" | "play" | "dying" | "intermission"`, `phaseMs`, `lives`, `score`, `nextLifeAt`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (oleada), `onStat("family", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("family", 5)`.
- `onStat("family", 0)` oculta el stat en el HUD (contrato de `onStat`); es lo esperado cuando no quedan humanos en la oleada.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `WASD` solo con el juego activo y sin pausa. Teclas leídas por `e.code` (`KeyW`, `ArrowUp`…; independiente del layout y compatible con eventos sintéticos de SPEC 11, sin filtrar `e.isTrusted`). Movimiento y disparo por `Set` de teclas mantenidas (se ignora `e.repeat`).
- Pausa/blur/destroy vacían `moveKeys` y `fireKeys`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de oleada ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** borde de 2 px en el rectángulo `x ∈ [8, 632]`, `y ∈ [8, 472]`. Zona jugable (centros de entidades) `x ∈ [16, 624]`, `y ∈ [16, 464]`. Todas las colisiones son círculo-círculo con los radios indicados.
- **Jugador:** radio **6**, empieza en (320, 240). Velocidad **150 px/s** en 8 direcciones (diagonal normalizada). Limitado a la zona jugable.
- **Disparo:** mientras haya flechas mantenidas, dispara en la dirección combinada (8 direcciones; flechas opuestas se anulan en ese eje; si el vector es nulo no dispara) cada **110 ms**. Máximo **6** disparos en vuelo (si hay 6, no dispara y el cooldown no se consume). Disparo: segmento de 10 px, velocidad **600 px/s**, radio de impacto **3**, desaparece al salir de la zona jugable o al impactar (un impacto por disparo).
- **Oleada `w`** (`waveConfig`):
  - Grunts: `min(15 + 5 × (w − 1), 60)`. Electrodes: `min(5 + (w − 1), 15)`. Hulks: `w ≥ 2 ? min(w − 1, 8) : 0`. Spheroids: `w ≥ 3 ? min(1 + Math.floor((w − 3) / 2), 4) : 0`. Humanos: `min(4 + w, 10)`.
  - Paso de Grunt: `gruntStepMs = max(120, 400 − 20 × (w − 1))`.
- **Colocación:** al empezar oleada, robots y electrodes en posiciones aleatorias de la zona jugable a distancia **≥ 120 px** del jugador (`SAFE_RADIUS`); humanos a **≥ 60 px**. Sin solapes entre electrodes (≥ 24 px entre centros); el resto puede solaparse.
- **Grunt:** radio **7**, **100** pts. Cada `gruntStepMs` todos los grunts avanzan **6 px** en cada eje hacia el jugador (`sign(dx) × 6`, `sign(dy) × 6`). Si un grunt toca un electrode, mueren los dos sin puntos.
- **Electrode:** radio **8**, estático, **25** pts al dispararle. Letal al tocarlo.
- **Hulk:** radio **10**, **indestructible**. Se mueve a **40 px/s** en una dirección cardinal; cada **1500 ms** elige nueva: con probabilidad 0.5 la cardinal que más lo acerca al humano más cercano (si no hay humanos, al jugador) y si no una cardinal al azar; rebota en el borde invirtiendo esa dirección. Cada disparo que lo toca lo empuja **6 px** en la dirección del disparo (sin salir de la zona). Tocar un humano lo mata (sin puntos; popup `✕` gris 800 ms). Letal al tocar al jugador.
- **Spheroid:** radio **9**, **1000** pts. Deriva a **90 px/s** en diagonal aleatoria y rebota en el borde. Cada **3000 ms** (primera a los 2000 ms de `play`) crea un Enforcer en su posición, máximo **3** por spheroid. Letal al tocar.
- **Enforcer:** radio **6**, **150** pts. Acelera **200 px/s²** hacia el jugador con velocidad máxima **120 px/s**. Cada **1500 ms** (primera a los 1000 ms de nacer) dispara una chispa hacia la posición actual del jugador. Letal al tocar.
- **Chispa:** radio **3**, **220 px/s** en línea recta, desaparece en el borde; disparable (**25** pts). Letal al tocar.
- **Humano:** radio **6**. Camina a **30 px/s** en dirección aleatoria; cada **1200 ms** elige otra; rebota en el borde. Los grunts y enforcers no lo dañan. Al tocarlo el jugador: rescate, `rescuesInWave + 1`, bonus `1000 × min(rescuesInWave, 5)` (1000, 2000, 3000, 4000, 5000, 5000…), popup con el bonus 800 ms, `onStat("family", restantes)`. `rescuesInWave` vuelve a 0 al empezar cada oleada (no al morir).
- **Fases:**
  - `grace` (**1000 ms**, al empezar oleada y tras reaparecer): robots, chispas y humanos quietos y dibujados al 50 % de opacidad; el jugador se mueve y dispara; el jugador es invulnerable y los robots no hacen daño.
  - `play`: todo activo.
  - `dying` (**1000 ms**): el jugador destella; nada se mueve.
  - `intermission` (**1500 ms**): arena vacía salvo jugador; no se dispara.
- **Fin de oleada:** en `play`, cuando no quedan grunts, spheroids ni enforcers (hulks y electrodes no cuentan). Se eliminan chispas, disparos, hulks, electrodes y humanos restantes (los no rescatados se pierden sin penalización), `intermission`, luego `wave + 1`, `onLevel(wave)`, jugador a (320, 240), nueva oleada, `onStat("family", humanos)` y `grace`.
- **Muerte:** colisión del jugador con grunt, electrode, hulk, spheroid, enforcer o chispa en `play`. `lives − 1`; si `lives = 0` → `onLives(0)` y `onGameOver(score)`. Si no, `onLives(lives)`, `dying`, luego jugador a (320, 240), se eliminan chispas y disparos, los robots vivos (excepto electrodes) se recolocan al azar a ≥ 120 px del centro, y `grace`. Humanos y electrodes se conservan.
- **Vida extra:** cada **25000** puntos (`nextLifeAt` 25000, 50000, …) `lives + 1` y `onLives(lives)`, sin máximo.
- **Dibujo:** fondo `#000`; borde de arena `#ff2bd6`. Jugador: figura de 10×14 px (cabeza `#ffffff`, cuerpo `#ffe600`). Grunt: cuadrado 12 px `#ff3355` con núcleo `#ffe600`. Hulk: rectángulo 18×20 `#39ff14` con visor `#000`. Electrode: estrella de 4 puntas de 16 px que rota 90°/s, color fijo por oleada ciclando `#00f5ff`, `#ffe600`, `#ff2bd6`. Spheroid: dos círculos concéntricos `#00f5ff` cuyo radio interior pulsa 4–9 px con periodo 600 ms. Enforcer: rombo 12 px `#ff2bd6`. Chispa: aspa blanca 6 px. Humano: figura 8×14 `#00f5ff` con cabeza `#ffffff`. Disparo: línea `#ffe600` de 2 px. Popups: texto `bold 12px monospace` `#ffffff` que sube 20 px y se desvanece en 800 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-robotron-2084` en `app/globals.css`. Aplicar migración `add_game_robotron_2084` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'robotron-2084'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/robotron-2084/waves.ts`. Verificar: `npm run lint`; `waveConfig(1)` da 15 grunts, 5 electrodes, 0 hulks, 0 spheroids, 5 humanos, paso 400 ms; `waveConfig(10)` da 60 grunts, 14 electrodes, 8 hulks, 4 spheroids, 10 humanos, paso 220 ms.
3. Crear `lib/games/robotron-2084/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/robotron-2084/engine.ts` y exportar `robotron2084Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"robotron-2084"` en `lib/games/registry.ts`. Verificar: `/games/robotron-2084/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover en 8 direcciones, disparar en 8 direcciones mientras se mueve en otra, matar grunts y electrodes, empujar un hulk, ver un hulk matar a un humano, rescatar 2 humanos (1000 y 2000), completar oleada 1 y pasar a la 2, ver spheroid y enforcers en la 3, morir (vidas bajan, recolocación y gracia), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'robotron-2084'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; registrar la migración en la tabla de `references/production/prod-setup.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `robotron-2084` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-robotron-2084`), la ficha `/games/robotron-2084` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`DOBLE STICK`, dificultad 4, color magenta, categoría SHOOTER).
- [ ] `/games/robotron-2084/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] `WASD` mueve al jugador a 150 px/s (diagonal normalizada) sin salir de la zona jugable; las flechas disparan en 8 direcciones de forma independiente; flechas y `WASD` no hacen scroll.
- [ ] Mantener una flecha dispara cada 110 ms a 600 px/s, con un máximo de 6 disparos en vuelo.
- [ ] La oleada 1 tiene 15 grunts, 5 electrodes, 5 humanos y ningún hulk ni spheroid; ningún robot aparece a menos de 120 px del jugador.
- [ ] Los grunts avanzan a saltos de 6 px cada 400 ms en la oleada 1; un grunt que toca un electrode muere con él sin sumar puntos.
- [ ] Puntos exactos: grunt 100, electrode 25, enforcer 150, chispa 25, spheroid 1000; los hulks no mueren y retroceden 6 px por disparo.
- [ ] Los rescates de una oleada valen 1000, 2000, 3000, 4000, 5000 y luego 5000; la serie se reinicia en cada oleada; FAMILIA baja en cada rescate o humano aplastado.
- [ ] Un hulk que toca a un humano lo elimina sin puntos.
- [ ] Desde la oleada 3 hay spheroids que crean hasta 3 enforcers cada uno; los enforcers disparan chispas cada 1500 ms.
- [ ] La oleada termina al no quedar grunts, spheroids ni enforcers; tras 1500 ms sube el nivel del HUD y empieza la siguiente con 1000 ms de gracia.
- [ ] Morir baja una vida, tras 1000 ms el jugador reaparece en el centro con los robots recolocados a ≥ 120 px y 1000 ms de invulnerabilidad.
- [ ] Al llegar a 25000 puntos las vidas del HUD suben en 1.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (oleada) y FAMILIA (5 al empezar); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela robots, disparos, chispas, humanos y temporizadores de fase; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'robotron-2084'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/robotron-2084` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, oleada 1, FAMILIA 5, jugador en (320, 240), sin disparos, chispas ni popups).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/robotron-2084/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración está registrada en `references/production/prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** doble stick en teclado (`WASD` + flechas) por ser la seña de identidad de Robotron; **No:** disparo automático ni apuntar con mouse.
- **Sí:** teclas por `e.code` para que `WASD` funcione con cualquier layout y con eventos sintéticos del gamepad virtual.
- **Sí:** oleadas discretas como nivel (`showLevel: true`) y 3 vidas con extra cada 25000 (fiel al original).
- **Sí:** stat `FAMILIA` (humanos restantes) porque el rescate es la segunda fuente de puntos; **No:** stat de robots restantes (se ve en pantalla).
- **Sí:** Grunts, Electrodes, Hulks, Spheroids y Enforcers; **No:** Brains/Progs ni Quarks/Tanks (más IA y estados; spec aparte).
- **Sí:** grunts a saltos de 6 px (movimiento entrecortado característico); **No:** movimiento continuo.
- **Sí:** gracia de 1000 ms al empezar oleada y al reaparecer, y recolocación de robots tras morir, para evitar muertes en cadena injustas.
- **Sí:** valores de balance (composición de oleadas, velocidades, cooldown, bonus, vida extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 640×480 (4:3 como el monitor del arcade); **Sí:** `cat` SHOOTER y color magenta (distingue de Asteroids, cyan).
- **Sí:** todo con primitivas Canvas 2D y `PALETTE` central; **No:** sprites, imágenes ni sonido.
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** táctil, mouse, HiDPI, skins (specs/subagentes aparte); **No:** tests automatizados.

---

## Risks

| Risk                                                                          | Mitigation                                                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Hasta 60 grunts + enforcers + chispas con colisiones O(n·m) por frame.         | Arrays pequeños (≤ ~100 entidades, 6 disparos); colisión círculo-círculo con distancia al cuadrado, sin `sqrt`.       |
| Algunos teclados no registran 3+ teclas simultáneas (ghosting WASD + flechas). | Las combinaciones usadas (2 de movimiento + 2 de disparo) suelen funcionar; documentar y verificar en el paso 6.     |
| La oleada no termina por enemigos residuales (enforcers fuera de vista).       | Condición de fin basada en arrays vacíos de grunts, spheroids y enforcers; los enforcers siempre en la zona jugable. |
| Muerte instantánea al empezar oleada o al reaparecer.                          | `SAFE_RADIUS` de 120 px y fase `grace` de 1000 ms con invulnerabilidad.                                              |
| Emitir `onStat`, `onScore` o `onLives` por frame satura React.                 | Emitir solo en muertes de enemigos, rescates, cambio de vidas y de oleada.                                           |
| `dt` grande tras pausar o cambiar de pestaña teletransporta entidades.         | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                 |
| `WASD` o flechas interfieren con el input del modal.                           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                 |
| Tecla "pegada" tras perder foco.                                               | `blur` y `pause` vacían `moveKeys` y `fireKeys`.                                                                     |
| Doble loop / listeners por StrictMode.                                         | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                               |
| El id con guion y dígitos requiere comillas y nombres válidos.                 | Clave `"robotron-2084"` en `ENGINES`, carpeta `lib/games/robotron-2084/`, export `robotron2084Def`, migración con `_`. |
| Next 16 difiere del conocimiento previo.                                       | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                      |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Brains, Progs, Quarks, Tanks, oleadas especiales y cambios de paleta por oleada.
- HUD nativo de texto dentro del canvas (más allá de los popups de rescate) y overlays de pausa/transición/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
