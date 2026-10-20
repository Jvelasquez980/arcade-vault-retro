# SPEC GJ-galaga-02 — Juego real: GALAGA (variante: asalto contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-20
> **Variant:** 02 de 2 — Galaga moderno contrarreloj: 120 s ampliables, nave con movimiento libre en la franja inferior y disparo continuo, escuadrones que cruzan la pantalla sin formación, combo multiplicador, power-ups y una nave nodriza con rayo tractor cada 5 oleadas.
> **Objective:** Crear un motor TypeScript de Galaga en modo contrarreloj dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Galaga. Reinterpreta Galaga como un "score attack" corto: la partida dura **120 s** (el reloj se amplía limpiando oleadas, con power-ups y derribando a la nodriza) o termina antes si pierdes los **3 escudos**. No hay formación fija: los enemigos entran en **escuadrones de 6** con trayectorias curvas al estilo Galaga, cruzan la pantalla y salen si no los derribas. La nave se mueve en **2D dentro de la franja inferior** y dispara **en continuo** manteniendo `Espacio`. El puntaje lo dispara el **combo** (×1 a ×8 por derribos encadenados). El rayo tractor se conserva como homenaje, pero no captura la nave: **roba 5 s de reloj** y el power-up activo. Se distingue de la variante 01 (clásico fiel: formación de 40, picados, 2 disparos en pantalla, captura y nave doble por rescate, etapas sin límite de tiempo): aquí el reto es **ritmo, gestión del reloj y mantener el combo**.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas, polígonos y gradientes. No existe `.cover-galaga` en `app/globals.css` (`.cover-invaders` es de los prototipos y no se reutiliza); se crea una clase nueva.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 y missile-command, propuesto, reserva 6), dificultad 4, tags `CONTRARRELOJ` y `NAVES`, 1 jugador, teclado. Canvas **480×640** (3:4 vertical). **3 escudos = vidas** (`initialLives: 3`, máximo 5), **nivel = oleada** (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/waves.ts`: funciones puras y constantes — `waveConfig(wave) → { isBoss, squadMs, enemySpeed, bulletSpeed, composition }`, los 4 patrones de escuadrón (`SWOOP_L`, `SWOOP_R`, `SINE`, `LOOP`) como funciones `pattern(i, s) → { x, y }` por distancia recorrida `s`, `comboMult(chain)` y `bossHp(wave)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawShip` (con parpadeo de invulnerabilidad), `drawDrone`, `drawWasp`, `drawEscort`, `drawMothership`, `drawBeam` (aviso y activo), `drawCapsule` (letra del power-up), `drawBullet`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg,#14002a,#0a0a18)` con `::before` de estelas diagonales (repeating-linear-gradient magenta muy tenue, sensación de velocidad) y `::after` con una curva de 6 puntos magenta/amarillo (radial-gradients) sobre una nave cyan abajo.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas** (= escudos), **nivel** (= oleada) y stats extra `time` ("TIEMPO", `seconds`) y `combo` ("COMBO", `int`, el multiplicador).
- Sin HUD nativo de texto en el canvas; el power-up activo se ve en la nave (cañones dobles / estela) y la barra de vida de la nodriza se dibuja sobre ella (parte del escenario). Sin rótulos de oleada (sin overlays).
- Controles: `←↑→↓` y `WASD` mueven la nave en 2D; mantener `Espacio` o `J` dispara en continuo. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Formación fija, captura de nave y nave doble por rescate (son de la variante 01).
- Bombas, armas cargadas, más de 4 power-ups, tienda o mejoras persistentes entre partidas.
- Selector de duración o dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Asalto alienígena contra el reloj.',
       'Tienes 120 segundos y tres escudos. Mueve tu nave con las flechas o WASD y mantén Espacio para disparar contra los escuadrones que cruzan la pantalla. Encadena derribos para subir el combo hasta ×8, recoge power-ups de disparo doble, ráfaga, escudo y tiempo, y derriba a la nave nodriza cada cinco oleadas antes de que su rayo tractor te robe segundos.',
       'ARCADE', 'magenta', 'cover-galaga', 1, 1, '{keyboard}', '{CONTRARRELOJ,NAVES}', 4, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "combo", label: "COMBO", color: "yellow", format: "int" },
      ],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ship { x, y, invulnMs }`, `keysDown: Set<string>`, `fireHeld`, `fireCd`, `bullets: { x, y }[]`, `enemyBullets: { x, y, vx, vy }[]`, `enemies: { type: "drone" | "wasp" | "escort", hp, pattern, idx, s, x, y, firedAt: Set<number> }[]`, `boss { x, y, hp, maxHp, t, fireMs, beamMs, beam: "idle" | "warn" | "active", beamX, lifeMs } | null`, `capsules: { x, y, kind: "D" | "R" | "S" | "T" }[]`, `powerDouble` (ms restantes), `powerRapid` (ms restantes), `explosions: { x, y, age }[]`, `stars: { x, y, v, c }[80]`, `wave`, `squadsLeft`, `squadTimer`, `spawnQueue`, `waveKills`, `waveSpawned`, `phase: "wave" | "boss" | "break"`, `phaseMs`, `timeLeft` (ms), `lastTimeSec`, `chain`, `chainMs`, `mult`, `shields`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives` (escudos), `onLevel` (oleada), `onStat("time", s)` con `s = Math.ceil(timeLeft / 1000)` solo cuando cambia ese entero (máx. 1 evento por segundo), `onStat("combo", mult)` solo cuando cambia el multiplicador. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("time", 120)`, `onStat("combo", 1)`.
- Game over por escudos: `onLives(0)` y luego `onGameOver(score)`. Game over por tiempo: `onStat("time", 0)`, bonus de escudos (`onScore`), luego `onGameOver(score)` **sin** cambiar vidas (como la victoria de Snake). En ambos casos el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Movimiento y disparo usan `keysDown`/`fireHeld` (continuos mientras se mantienen); `e.repeat` no genera disparos extra (la cadencia la marca `fireCd`). No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy vacían `keysDown` y `fireHeld = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El reloj de partida solo corre con el juego activo (se congela en pausa).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, rótulo de oleada ni game over dentro del canvas.

**Reglas del juego:**

- **Reloj:** `timeLeft` empieza en **120000 ms** y baja en tiempo real de juego; tope **180000 ms** (lo que exceda se pierde). Al llegar a 0 → fin por tiempo. Bonus final por tiempo: **1000** por escudo restante (sin multiplicador).
- **Nave:** hitbox 16×14 centrada en `(x, y)`; se dibuja de 28×24. Empieza en `(240, 580)`. Se mueve **280 px/s** en cada eje (diagonales sin normalizar), limitada a `x ∈ [20, 460]`, `y ∈ [440, 616]`.
- **Disparo:** con `Espacio`/`J` mantenido dispara cada `fireCd` = **160 ms** (**80 ms** con RÁPIDO). Proyectil 4×14 px a **720 px/s** hacia arriba desde `y − 14`. Sin límite de proyectiles en pantalla. Con DOBLE salen 2 proyectiles en `x − 10` y `x + 10`.
- **Enemigos:**
  - Dron (morado `#a855f7`, 20×16): **1** impacto, **30** puntos, no dispara.
  - Avispa (amarillo `#ffe600`, 20×16): **1** impacto, **50** puntos; al cruzar `y = 220` dispara con probabilidad **0.3**.
  - Escolta (verde `#00ff88`, 24×20): **2** impactos (parpadea blanco 80 ms al recibir el primero), **120** puntos; al cruzar `y = 200` y `y = 320` dispara con probabilidad **0.4** cada vez.
  - Las balas enemigas (4×8) apuntan a la nave en el momento del disparo con `|v| = bulletSpeed = min(220 + 8 × (wave − 1), 340)` px/s y `vy ≥ 100` (si el vector sale más horizontal, se fija `vy = 100` y se reescala `vx`). Máximo **12** en pantalla; si hay 12, no dispara.
- **Oleada normal `w`** (`waveConfig`, toda oleada con `w % 5 !== 0`): **4 escuadrones de 6** (24 enemigos). El primer escuadrón sale a los **600 ms** de empezar la oleada y los siguientes cada `squadMs = max(700, 1400 − 50 × (w − 1))` ms; dentro de un escuadrón, un enemigo cada **150 ms** por el mismo patrón. Velocidad sobre el patrón `enemySpeed = min(150 + 12 × (w − 1), 300)` px/s (constante por distancia).
  - Composición por escuadrón: oleadas 1–2: 4 drones + 2 avispas; 3–5: 3 drones + 2 avispas + 1 escolta; 6+: 2 drones + 2 avispas + 2 escoltas (orden de salida: drones, avispas, escoltas).
  - Patrones en orden cíclico por escuadrón (`SWOOP_L`, `SWOOP_R`, `SINE`, `LOOP`, empezando por el índice `(w − 1) % 4`):
    - `SWOOP_L`: bezier cúbica `(−20,60) (260,40) (420,360) (200,680)`.
    - `SWOOP_R`: espejo de `SWOOP_L` con `x' = 480 − x`.
    - `SINE`: `x0` aleatorio en `[140, 340]` por escuadrón; `y = −20 + s`, `x = x0 + 100 × sin(2π × (y + 20) / 320)`.
    - `LOOP`: recta de `(240,−20)` a `(240,200)`, una vuelta completa de círculo de radio **70** en sentido horario con centro `(310,200)`, y recta de `(240,200)` a `(240,680)`.
  - Un enemigo que sale del área (`y > 660`, o `x < −40` / `x > 520` tras haber entrado) desaparece sin penalización.
  - **Fin de oleada:** cuando se han lanzado los 24 y no queda ninguno en pantalla. Si se derribaron los 24 (**perfecta**): **+500 × w** puntos (sin multiplicador) y **+5 s**; si no: **+3 s**. Luego `phase = "break"` **1000 ms** (sin enemigos nuevos; balas enemigas en vuelo siguen), `wave + 1`, `onLevel(wave)`.
- **Oleada nodriza** (`w % 5 === 0`): un único enemigo, la nodriza (96×40, hitbox elíptica 44×18 de semiejes), con `bossHp(w) = 30 + 10 × (w / 5 − 1)` impactos. Entra desde `y = −40` hasta `y = 120` en 1000 ms (invulnerable mientras entra) y se mueve `x = 240 + 160 × sin(2π × t / 4000 ms)`.
  - Dispara un abanico de **3** balas (−20°, 0°, +20° respecto a la vertical hacia abajo) a `bulletSpeed` cada **1500 ms**.
  - **Rayo tractor:** cada **6000 ms** (el primero a los 3000 ms de estar en posición) fija `beamX = x` actual y se detiene: aviso (`warn`) **600 ms** (línea fina), luego rayo activo **1200 ms** de **64 px** de ancho desde `y = 140` hasta `y = 640`; después reanuda el movimiento. Si la hitbox de la nave toca el rayo activo: **−5 s** de reloj (una sola vez por rayo), se anulan DOBLE y RÁPIDO, el combo se reinicia; no quita escudo.
  - Derribarla: **3000 × (w / 5)** puntos × combo, **+10 s**, explosión grande (24 rayos, 800 ms) y suelta **2** cápsulas al azar. Si no se derriba en **25 s** desde que llega a su posición, sale hacia arriba a 200 px/s sin bonus. En ambos casos sigue el `break` de 1000 ms y `wave + 1`.
  - Mientras dura la oleada nodriza no hay escuadrones.
- **Combo:** cada derribo dentro de **1500 ms** del anterior suma 1 a `chain` (el primero tras un corte deja `chain = 1`); si pasan 1500 ms sin derribos o la nave recibe un impacto/rayo, `chain = 0`. `mult = comboMult(chain) = min(1 + Math.floor(chain / 5), 8)` (1–4 → ×1, 5–9 → ×2, … 35+ → ×8). Puntos por derribo = base × `mult` (el `mult` tras contar ese derribo). `onStat("combo", mult)` solo al cambiar.
- **Power-ups:** al derribar un dron o avispa cae una cápsula con probabilidad **0.08**; escolta **0.25**. Tipo uniforme entre:
  - `D` DOBLE: 2 cañones durante **12 s**.
  - `R` RÁPIDO: cadencia 80 ms durante **10 s**.
  - `S` ESCUDO: +1 escudo (máx. **5**), `onLives(shields)`; con 5 da **+250** puntos.
  - `T` RELOJ: **+8 s** de reloj.
  - Cápsula 20×20 que cae a **120 px/s** desde el punto de derribo; se recoge por solapamiento con la hitbox de la nave; sale por abajo y se pierde. Recoger DOBLE o RÁPIDO activos reinicia su duración; DOBLE y RÁPIDO se acumulan entre sí. Recoger cualquier cápsula da **+50** puntos (sin multiplicador).
- **Impacto en la nave:** bala enemiga o cuerpo de enemigo (no la nodriza) que toca la hitbox sin invulnerabilidad → `shields − 1`, `onLives(shields)`, invulnerabilidad **1500 ms** (parpadeo cada 100 ms), `chain = 0`, se anulan DOBLE y RÁPIDO. El enemigo que choca muere sin dar puntos. Si `shields = 0` → `onLives(0)` y `onGameOver(score)`.
- **Fondo:** 80 estrellas con `x` aleatoria, velocidad `v ∈ [60, 180]` px/s hacia abajo, alto 1–3 px (estela) y color de `[#ffffff, #ff2bd6, #00f5ff]`; al salir por abajo reaparecen arriba. Se congelan en pausa.
- **Dibujo:** fondo `#08000f`. Nave: polígono magenta `#ff2bd6` con cabina cyan `#00f5ff` y llama de motor que alterna 2 largos cada 80 ms; con DOBLE se dibujan 2 cañones, con RÁPIDO la llama es amarilla. Nodriza: cuerpo elíptico con gradiente radial `#ff3355` → `#4a0018`, 4 luces amarillas y barra de vida 96×4 sobre ella (verde → rojo según `hp/maxHp`). Rayo: aviso como línea de 2 px `rgba(0,245,255,0.6)`; activo como rectángulo con gradiente `rgba(0,245,255,0.5)` → `rgba(0,245,255,0.05)` y franjas cada 12 px. Cápsulas: círculo blanco con borde de color (`D` cyan, `R` amarillo, `S` verde, `T` magenta) y su letra. Balas del jugador `#00f5ff`; enemigas `#ff3355` con núcleo blanco. Explosión: 8 rayos radiales de 0 a 16 px en 400 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/galaga/waves.ts` (`waveConfig`, patrones, `comboMult`, `bossHp`). Verificar: `npm run lint`; `waveConfig(1)` da `squadMs` 1400, velocidad 150, bala 220, `isBoss` false; `waveConfig(5).isBoss` true; `waveConfig(16)` da 700, 300, 340; `comboMult(4) = 1`, `comboMult(5) = 2`, `comboMult(40) = 8`; `bossHp(5) = 30`, `bossHp(10) = 40`.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover en 2D dentro de la franja, disparo continuo, los 4 patrones, subir el combo a ×2, recibir un impacto (escudo baja, combo a ×1, invulnerabilidad), recoger los 4 power-ups, oleada perfecta (+5 s) y no perfecta (+3 s), nodriza en la oleada 5 (rayo roba 5 s, derribarla da +10 s), fin por tiempo (bonus de escudos, vidas sin cambiar) y fin por escudos, pausa (botón y `P`; el reloj se congela), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; registrar la migración en la tabla de `references/production/prod-setup.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`NAVES`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 vertical sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓`/`WASD` mueven la nave a 280 px/s dentro de `x ∈ [20, 460]`, `y ∈ [440, 616]`; las flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio`/`J` dispara cada 160 ms (80 ms con RÁPIDO); con DOBLE salen 2 proyectiles.
- [ ] TIEMPO empieza en 120 y baja 1 por segundo de juego (un evento por segundo); nunca supera 180.
- [ ] La oleada 1 trae 4 escuadrones de 6 (4 drones + 2 avispas) a 150 px/s, uno cada 1400 ms; desde la oleada 3 aparecen escoltas de 2 impactos.
- [ ] Dron 30, avispa 50, escolta 120 puntos, multiplicados por el combo vigente.
- [ ] COMBO sube a ×2 al 5.º derribo encadenado (≤ 1500 ms entre derribos), llega como máximo a ×8 y vuelve a ×1 tras 1500 ms sin derribos o al recibir un impacto.
- [ ] Oleada perfecta suma 500 × oleada y +5 s; no perfecta, +3 s; el nivel del HUD sube tras 1000 ms.
- [ ] Las cápsulas `D`, `R`, `S`, `T` caen a 120 px/s y aplican: doble 12 s, rápido 10 s, +1 escudo (máx. 5) y +8 s, más 50 puntos cada una.
- [ ] En la oleada 5 aparece solo la nodriza con 30 impactos y barra de vida; su rayo resta 5 s y anula los power-ups sin quitar escudo; derribarla da 3000 × combo y +10 s; si pasan 25 s se va sin bonus.
- [ ] Un impacto baja los escudos del HUD en 1 y da 1500 ms de invulnerabilidad (la nave parpadea y no recibe más daño).
- [ ] Perder el último escudo emite `onLives(0)` y luego `onGameOver`; agotar el tiempo suma 1000 por escudo restante y emite `onGameOver` sin cambiar vidas. Ambos abren el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, escudos (3, máx. 5), nivel (oleada), TIEMPO y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, balas, cápsulas, rayo, estrellas, power-ups y reloj; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, `J`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 escudos, oleada 1, TIEMPO 120, COMBO ×1, nave en `(240, 580)`, sin power-ups ni enemigos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** partida acotada por reloj (120 s, tope 180 s) además de escudos: partidas cortas y comparables en el leaderboard.
- **Sí:** fin por tiempo sin `onLives(0)` (como la victoria de Snake); **No:** forzar vidas a 0 cuando el jugador no murió.
- **Sí:** movimiento 2D en la franja inferior y disparo continuo; **No:** límite de 2 disparos (es de la variante 01).
- **Sí:** combo ×1–×8 como motor del puntaje y stat `COMBO`; **Sí:** stat `TIEMPO` emitido una vez por segundo.
- **Sí:** 4 power-ups simples (doble, rápido, escudo, reloj); **No:** bombas ni mejoras persistentes.
- **Sí:** rayo tractor de la nodriza que roba tiempo y power-ups; **No:** captura de nave ni nave doble por rescate (variante 01).
- **Sí:** escuadrones que cruzan y salen sin penalización; **No:** formación fija (el reloj ya castiga no derribarlos al no lograr la oleada perfecta).
- **Sí:** valores de balance (cadencias, velocidades, probabilidades de cápsula, combo, bonus de tiempo, vida de la nodriza) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE, color magenta y `.cover-galaga` nueva; **No:** reutilizar `.cover-invaders`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                 | Mitigation                                                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `onStat("time")` emitido por frame satura React.                                     | Emitir solo cuando cambia `Math.ceil(timeLeft / 1000)` (≤ 1 evento/s); criterio de aceptación.                 |
| El reloj sigue corriendo en pausa o tras cambiar de pestaña.                         | `timeLeft` solo baja dentro del update; pausa/blur cortan el loop y `lastTime` se reinicia al reanudar.        |
| Disparo continuo sin límite genera cientos de proyectiles.                           | Cadencia mínima 80 ms y borrado al salir por `y < −14` (máx. ~10 en pantalla).                                  |
| La oleada nunca termina por un contador mal llevado.                                 | Condición de fin: lanzados = 24 y array `enemies` vacío (o nodriza `null`), no contadores derivados.            |
| Balance: el combo ×8 dispara puntajes y vuelve irrelevante el resto.                 | Combo se corta con 1500 ms sin derribos o un impacto; bonus de oleada y escudos sin multiplicador.             |
| `dt` grande teletransporta balas a través de la nave.                                | `dt` capado a 50 ms (máx. 36 px por paso de bala, cerca de la hitbox; verificar en paso 6).                    |
| Flechas, `WASD`, `J` o espacio interfieren con el input del modal.                   | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Disparo "pegado" tras perder foco.                                                   | `blur` y `pause` vacían `keysDown` y ponen `fireHeld = false`.                                                  |
| Doble loop / listeners por StrictMode.                                               | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| Next 16 difiere del conocimiento previo.                                             | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Formación fija, captura de nave y nave doble por rescate.
- Bombas, armas cargadas, más power-ups y mejoras persistentes.
- HUD nativo de texto dentro del canvas y overlays de pausa/oleada/game over.
- Selector de duración o dificultad.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
