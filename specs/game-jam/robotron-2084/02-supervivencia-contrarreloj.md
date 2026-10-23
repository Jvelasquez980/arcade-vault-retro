# SPEC GJ-robotron-2084-02 — Juego real: ROBOTRON: 2084 (variante: supervivencia contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-23
> **Variant:** 02 de 2 — Arena moderna contrarreloj: solo te mueves (el disparo apunta solo al enemigo más cercano), los robots aparecen sin parar, el reloj es tu vida (rescates suman tiempo, golpes lo restan) y el puntaje se dispara con multiplicador, bombas y power-ups.
> **Objective:** Crear un motor TypeScript de Robotron: 2084 (variante supervivencia contrarreloj) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/robotron-2084` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Robotron: 2084. Reinterpreta el arcade como una **arena de supervivencia de un minuto ampliable**: no hay vidas ni oleadas cerradas; los robots **aparecen continuamente** desde los bordes y la dificultad sube cada 20 s. El jugador **solo se mueve**: la nave dispara sola al robot destructible más cercano, y con `Espacio` lanza una **bomba** de área con cargas limitadas. El **reloj** empieza en 60 s: rescatar humanos suma tiempo, recibir un golpe lo resta y la partida termina cuando llega a 0. El puntaje premia no ser tocado con un **multiplicador ×1–×8**, y hay **power-ups** temporales. Se distingue de la variante 01 (clásica: twin-stick con 8 direcciones de disparo, oleadas cerradas, 3 vidas, electrodos, esferoides y cerebros, bonus de rescate 1000–5000).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con formas, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-robotron-2084`.

Decisiones fijadas por el agente (no se reabren): `id` `robotron-2084`, título `ROBOTRON: 2084`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, `missile-command` reserva 6 en su game jam), dificultad 3, tags `SUPERVIVENCIA` y `CONTRARRELOJ`, 1 jugador, teclado. Canvas **600×600** (1:1). **Sin vidas** (no se declara `initialLives`): el reloj es el recurso. **Nivel** sube cada 20 s (`showLevel: true`); stats extra `TIEMPO`, `MULTI` y `BOMBAS`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/robotron-2084/engine.ts`: sin globals de módulo; exporta `robotron2084Def: GameEngineDef` con `createRobotron2084(canvas, events) → GameController`.
- Módulo `lib/games/robotron-2084/balance.ts`: funciones puras `levelAt(elapsedMs)`, `spawnMs(level)`, `maxEnemies(level)`, `gruntSpeed(level)`, `multiplier(streak)`, `rollEnemyType(level, hulksAlive, rand)` y constantes (`ARENA`, `START_TIME_MS`, `MAX_TIME_MS`).
- Módulo `lib/games/robotron-2084/draw.ts`: `drawArena`, `drawPlayer` (parpadeo de invulnerabilidad), `drawTelegraph`, `drawGrunt`, `drawDasher`, `drawTank`, `drawHulk`, `drawEnforcer`, `drawSpark`, `drawHuman`, `drawPowerUp`, `drawBullet`, `drawBombWave`, `drawFloatText` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"robotron-2084"` en `lib/games/registry.ts`.
- Clase `.cover-robotron-2084` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%, #2a2000, #0a0a18)`, `::before` con anillo de onda de bomba (`border: 3px solid #ffe600`, círculo de 46% centrado, `opacity: .6`) y `::after` con jugador central (rombo blanco) y 8 puntos rojos `#ff3355` alrededor (`box-shadow` múltiple).
- Migración `add_game_robotron_2084`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **nivel**, stats extra `time` ("TIEMPO", `seconds`, `yellow`), `mult` ("MULTI", `int`, `magenta`) y `bombs` ("BOMBAS", `int`, `cyan`). Sin vidas.
- Sin HUD nativo de texto en el canvas, salvo números flotantes (`+3s`, `−8s`, puntos de rescate) como efecto de juego.
- Controles: `←↑→↓` y `WASD` mueven en 8 direcciones; `Espacio` lanza bomba. El disparo es automático. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'robotron-2084'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `robotron-2084`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, gamepad físico, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Disparo manual en 8 direcciones, oleadas cerradas, vidas, electrodos, esferoides y cerebros.
- Mejoras permanentes entre partidas, tienda o selección de armas.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('robotron-2084', 'ROBOTRON: 2084', 'Sobrevive al reloj en la arena robot.',
       'Muévete con las flechas o WASD: tu nave dispara sola al robot más cercano. Los robots no dejan de llegar y cada 20 segundos son más y más rápidos. Tienes 60 segundos: rescatar humanos te da tiempo extra y cada golpe te lo quita. Encadena bajas sin que te toquen para subir el multiplicador hasta ×8 y usa la bomba con Espacio cuando te rodeen.',
       'ARCADE', 'yellow', 'cover-robotron-2084', 1, 1, '{keyboard}', '{SUPERVIVENCIA,CONTRARRELOJ}', 3, 7, false);

Definición del motor:

    export const robotron2084Def: GameEngineDef = {
      width: 600, height: 600,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "mult", label: "MULTI", color: "magenta", format: "int" },
        { key: "bombs", label: "BOMBAS", color: "cyan", format: "int" },
      ],
      create: createRobotron2084,
    };

Estado interno (dentro de `createRobotron2084`): `player { x, y, faceX, faceY }`, `moveKeys { up, down, left, right }`, `fireCooldownMs`, `bullets: { x, y, vx, vy }[]`, `enemies: { id, type: "grunt" | "dasher" | "tank" | "hulk" | "enforcer", x, y, vx, vy, hp, telegraphMs, timerMs, dashMs, hitFlashMs }[]`, `sparks: { x, y, vx, vy, ms }[]`, `human: { x, y, vx, vy, ms, turnMs } | null`, `humanRespawnMs`, `powerUp: { x, y, kind: "rapid" | "spread" | "time", ms } | null`, `rapidMs`, `spreadMs`, `bombWave: { x, y, r, ms } | null`, `floatTexts: { text, x, y, ms }[]`, `timeLeftMs`, `elapsedMs`, `level`, `spawnTimer`, `streak`, `mult`, `bombs`, `nextBombAt`, `invulnMs`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("time", s)`, `onStat("mult", m)`, `onStat("bombs", b)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 60)`, `onStat("mult", 1)`, `onStat("bombs", 1)`.
- `onStat("time", s)` se emite solo cuando cambia `s = Math.ceil(timeLeftMs / 1000)`. `BOMBAS` en 0 se oculta (contrato de `onStat`: valor 0 oculta el stat); es el comportamiento esperado.
- Game over: esta variante **no declara `initialLives` ni emite `onLives`** (no hay vidas). Al llegar el reloj a 0 se emite `onStat("time", 0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. (El orden `onLives(0)` → `onGameOver` de SPEC 05 no aplica porque no hay vidas; el HUD de vidas no se muestra.)
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio` ignora `e.repeat` (una bomba por pulsación); el movimiento es continuo mientras se mantienen las teclas. Teclas por `e.code` (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `ArrowUp`…, `Space`).
- Pausa/blur/destroy ponen las banderas de `moveKeys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** rectángulo jugable de (10, 10) a (590, 590), borde `#ffe600` de 2 px. Todo se mantiene dentro (posición recortada al rectángulo menos el radio). El jugador empieza en (300, 300).
- **Colisiones:** círculo contra círculo con los radios indicados por tipo.
- **Jugador:** radio **8**, velocidad **170 px/s** en 8 direcciones (diagonal normalizada). `faceX/faceY` = última dirección de movimiento (solo para dibujar).
- **Auto-disparo:** cada **160 ms** (o **80 ms** con `rapid`), si existe un enemigo destructible activo (no en telegrafía; no hulk) a ≤ **300 px**, sale una bala hacia el más cercano; si no hay ninguno, no se dispara y el cooldown se queda en 0. Con `spread` salen 3 balas: centro y ±**15°**. Bala: radio 3, **520 px/s**, 1 de daño; desaparece al salir de la arena o al impactar (una bala, un impacto).
- **Tiempo:** `timeLeftMs` empieza en **60 000**, baja con `dt` solo en juego, tope **99 000**. A 0 → game over.
- **Nivel:** `levelAt(elapsedMs) = 1 + floor(elapsedMs / 20000)` (sin tope), con `elapsedMs` que sube con `dt` solo en juego. Al subir: `onLevel(level)`. Sin puntos por nivel.
- **Aparición:** el primer robot a los **1000 ms**; luego cada `spawnMs(level) = max(250, 1100 − 90 × (level − 1))` ms, siempre que haya menos de `maxEnemies(level) = min(30 + 5 × (level − 1), 70)` enemigos. Nace en un punto al azar del borde interior de la arena a ≥ **200 px** del jugador (hasta 10 intentos; si no, en la esquina más lejana). Pasa **500 ms** en telegrafía (anillo pulsante, no se mueve, no colisiona, no es blanco) y luego se activa.
- **Tipo de enemigo** `rollEnemyType(level, hulksAlive, rand)`: pesos de los tipos habilitados; `grunt` recibe el resto hasta 1.
  - `dasher` desde nivel **2**, peso **0.25**.
  - `tank` desde nivel **3**, peso **0.15**.
  - `hulk` desde nivel **4**, peso **0.08**; si ya hay **3** hulks vivos, sale `grunt`.
  - `enforcer` desde nivel **5**, peso **0.12**.
- **Grunt:** radio **9**, 1 HP, **10** pts. Persigue al jugador a `gruntSpeed(level) = min(55 + 6 × (level − 1), 130)` px/s.
- **Dasher:** radio **8**, 1 HP, **25** pts. Vaga a **40 px/s** (dirección al azar cada 1000 ms); cada **1800 ms** carga en línea recta hacia la posición que tenía el jugador al iniciar la carga, a **320 px/s** durante **600 ms**.
- **Tank:** radio **13**, 4 HP, **60** pts. Persigue a **35 px/s**; parpadea blanco 80 ms por impacto.
- **Hulk:** radio **14**, indestructible, **0** pts. Persigue a **45 px/s**. Cada bala lo empuja **8 px** en la dirección de la bala. El auto-disparo nunca lo apunta, pero las balas que lo cruzan sí lo golpean (y se consumen).
- **Enforcer:** radio **8**, 1 HP, **40** pts. Mantiene **180 px** del jugador: se acerca si está más lejos, se aleja si está más cerca (±10 px de margen, quieto dentro), a **90 px/s**. Dispara una chispa apuntada al jugador cada **2000 ms** (la primera a los 1000 ms de activarse).
- **Chispa:** radio **4**, **220 px/s**, sin rebote, dura **2500 ms** o hasta salir de la arena. Una bala la destruye (**0** pts, no cuenta como baja). El auto-disparo no la apunta.
- **Puntos por baja:** `puntos_del_tipo × mult`. Cada baja (por bala o bomba) suma `streak += 1` y `mult = multiplier(streak) = min(1 + floor(streak / 10), 8)`; `onStat("mult")` solo si cambia.
- **Golpe:** si no hay invulnerabilidad y el jugador toca un enemigo activo (incluido hulk) o una chispa: `timeLeftMs −= 8000` (texto `−8s` rojo), `streak = 0`, `mult = 1`, `invulnMs = 1500` (el jugador parpadea a 10 Hz), se eliminan todas las chispas y se destruyen sin puntos ni racha los enemigos destructibles a ≤ **120 px**. Si `timeLeftMs ≤ 0` tras el golpe → game over inmediato.
- **Humano:** hay como máximo **1**. Aparece a los **3000 ms** de empezar y a los 3000 ms de cada rescate o pérdida, en un punto al azar a ≥ **150 px** del jugador. Radio **7**, camina a **35 px/s**, cambia de dirección cada 1500 ms, rebota en los bordes. Desaparece a los **8000 ms** (parpadea los últimos 2000 ms) sin penalización. Si lo toca un grunt o un hulk muere (calavera 600 ms). Rescate (el jugador lo toca): `timeLeftMs += 3000` (tope 99 000; texto `+3s` verde) y `+100 × mult` puntos (no suma racha).
- **Power-ups:** cada baja tiene probabilidad **0.05** de soltar uno si no hay otro en el campo; tipo uniforme entre `rapid`, `spread` y `time`. Dura **6000 ms** en el suelo (parpadea los últimos 1500 ms). Al tocarlo: `rapid` → `rapidMs = 6000`; `spread` → `spreadMs = 6000`; `time` → `timeLeftMs += 5000` (tope 99 000; texto `+5s`). Recoger uno ya activo reinicia su duración; `rapid` y `spread` se combinan.
- **Bombas:** empiezan en **1**, máx. **3**. Con `bombs > 0`, `Espacio` resta 1 y lanza una onda desde el jugador que crece de 0 a **160 px** en **250 ms**: destruye todos los enemigos destructibles (activos o en telegrafía) y chispas dentro del radio final (puntos × mult, cuentan para la racha) y empuja los hulks hasta 160 px del jugador. Se gana 1 bomba cada **2500** puntos (`nextBombAt` 2500, 5000, …); si ya hay 3, el umbral se consume sin efecto.
- **Dibujo:** fondo `#080600` con rejilla tenue `rgba(255,230,0,0.06)` cada 40 px; borde `#ffe600`. Jugador: rombo blanco con punta `#00f5ff` hacia `face`. Telegrafía: anillo `#ff3355` pulsante. Grunt: cuadrado `#ff3355` 16 px. Dasher: flecha `#ff7a00` (estela durante la carga). Tank: hexágono `#ff2bd6` con 4 marcas de vida. Hulk: rectángulo `#39ff14` 26×28. Enforcer: triángulo `#00f5ff`. Chispa: cruz blanca 8 px. Humano: figura `#ff7ad9`. Power-ups: rombo `#ffe600` (rapid), triángulo `#00f5ff` (spread), círculo `#39ff14` con aguja (time). Bala: punto `#ffffff` radio 3. Onda de bomba: anillo `#ffe600` que se desvanece. Textos flotantes: 14 px monoespaciada, suben 24 px en 800 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-robotron-2084` en `app/globals.css`. Aplicar migración `add_game_robotron_2084` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'robotron-2084'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/robotron-2084/balance.ts`. Verificar: `npm run lint`; `levelAt(19999) = 1`, `levelAt(40000) = 3`; `spawnMs(1) = 1100`, `spawnMs(10) = 290`, `spawnMs(11) = 250`; `maxEnemies(1) = 30`, `maxEnemies(9) = 70`, `maxEnemies(20) = 70`; `gruntSpeed(1) = 55`, `gruntSpeed(20) = 130`; `multiplier(0) = 1`, `multiplier(10) = 2`, `multiplier(75) = 8`; `rollEnemyType(1, 0, r)` siempre `grunt`; `rollEnemyType(4, 3, r)` nunca `hulk`.
3. Crear `lib/games/robotron-2084/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/robotron-2084/engine.ts` y exportar `robotron2084Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"robotron-2084"` en `lib/games/registry.ts`. Verificar: `/games/robotron-2084/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): moverse en 8 direcciones, auto-disparo al más cercano y no a hulks, telegrafía de 500 ms, subir MULTI a ×2 con 10 bajas, recibir un golpe (−8 s, MULTI a 1, limpieza de 120 px, parpadeo), rescatar un humano (+3 s), recoger los 3 power-ups, bomba (y bomba extra a 2500 puntos, tope 3), subida de nivel a los 20 s con dashers (2), tanks (3), hulks (4) y enforcers (5), dejar que el reloj llegue a 0, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'robotron-2084'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `robotron-2084` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-robotron-2084`), la ficha `/games/robotron-2084` y el home muestran el juego desde la BD (1 jugador, teclado, tags `SUPERVIVENCIA`/`CONTRARRELOJ`, dificultad 3, color amarillo, categoría ARCADE).
- [ ] `/games/robotron-2084/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven a 170 px/s en 8 direcciones (diagonal sin ir más rápido); flechas y `Espacio` no hacen scroll.
- [ ] La nave dispara sola cada 160 ms al enemigo destructible más cercano a ≤ 300 px; no dispara si no hay ninguno y nunca apunta a hulks ni chispas.
- [ ] Los robots nacen en el borde a ≥ 200 px del jugador, con 500 ms de telegrafía inofensiva; nivel 1: uno cada 1100 ms, máx. 30 a la vez.
- [ ] Grunt 10, dasher 25, tank 60 (4 impactos), enforcer 40 puntos, multiplicados por MULTI; hulks indestructibles empujados 8 px por bala.
- [ ] MULTI sube ×1 → ×2 a las 10 bajas sin golpe, … hasta ×8 a las 70; un golpe lo devuelve a ×1.
- [ ] Un golpe resta 8 s, da 1500 ms de invulnerabilidad parpadeante, borra chispas y destruye sin puntos los robots a ≤ 120 px.
- [ ] Rescatar un humano suma 3 s y 100 × MULTI puntos; el humano desaparece a los 8 s si no se rescata y vuelve a aparecer 3 s después.
- [ ] Power-ups (5 % por baja, uno a la vez, 6 s en el suelo): `rapid` dispara cada 80 ms 6 s, `spread` 3 balas a ±15° 6 s, `time` +5 s; el reloj no supera 99 s.
- [ ] `Espacio` con bombas lanza una onda de 160 px que limpia robots y chispas (con puntos y racha) y aparta hulks; mantener pulsado no gasta más de una; se gana una bomba cada 2500 puntos, máx. 3.
- [ ] El nivel sube cada 20 s de juego; aparecen dashers desde nivel 2, tanks desde 3, hulks (máx. 3) desde 4 y enforcers desde 5.
- [ ] TIEMPO empieza en 60 y baja 1 por segundo de juego; al llegar a 0 se abre el modal con el puntaje correcto (sin HUD de vidas).
- [ ] El HUD de React refleja puntaje, nivel, TIEMPO, MULTI y BOMBAS (oculto en 0); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, robots, balas, power-ups y aparición; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`, espacio) no mueve ni lanza bombas.
- [ ] Guardar inserta en `scores` con `game_id = 'robotron-2084'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/robotron-2084` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 60, MULTI 1, BOMBAS 1, sin robots, balas, humano ni power-ups activos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/robotron-2084/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con las reglas de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** auto-disparo al más cercano y bomba con `Espacio`; es la diferencia central con la variante 01 y encaja después con el gamepad táctil (dpad + 1 acción). **No:** disparo manual en 8 direcciones.
- **Sí:** reloj como único recurso (60 s, +3 s por rescate, +5 s power-up, −8 s por golpe, tope 99 s); garantiza partidas cortas y comparables. **No:** vidas (`initialLives` sin declarar, sin `onLives`).
- **Sí:** aparición continua con nivel cada 20 s; **No:** oleadas cerradas.
- **Sí:** multiplicador por racha sin golpes (×1–×8) y puntos base bajos; amplía el rango del leaderboard y premia esquivar.
- **Sí:** limpieza de 120 px y 1500 ms de invulnerabilidad tras un golpe para evitar golpes en cadena.
- **Sí:** power-ups `rapid`, `spread` y `time` temporales; **No:** mejoras permanentes ni armas seleccionables.
- **Sí:** subconjunto de enemigos (grunt, dasher, tank, hulk, enforcer/chispa); **No:** electrodos, esferoides, cerebros ni progs (son de la variante clásica).
- **Sí:** un humano a la vez como fuente de tiempo; **No:** bonus de rescate escalonado 1000–5000.
- **Sí:** valores de balance (velocidades, intervalos, radios, puntos, tiempos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color amarillo; **Sí:** `.cover-robotron-2084` nueva.
- **Sí:** canvas 600×600 (1:1) para que la arena sea simétrica respecto al jugador.
- **Sí:** teclas por `e.code` para soportar cualquier distribución.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Con 70 enemigos y `spread` + `rapid` hay muchas balas y colisiones por frame.          | Tope de enemigos por nivel; balas se retiran al impactar o salir; búsqueda del más cercano una vez por disparo, no por frame.   |
| El reloj se vuelve infinito si los rescates y power-ups compensan siempre los golpes.  | Un humano a la vez cada ≥ 3 s, power-up al 5 % y tope de 99 s; la aparición acelera sin tope hasta 250 ms.                     |
| Partida demasiado corta para principiantes (golpes de −8 s).                            | 1500 ms de invulnerabilidad y limpieza de 120 px; verificar en el paso 6 y ajustar solo editando el spec.                      |
| El HUD sin vidas confunde o el contrato espera `onLives(0)` antes de `onGameOver`.     | Sin `initialLives` el HUD no muestra vidas; `onGameOver` tras `onStat("time", 0)`, como la victoria de Snake (sin vidas).       |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o sube de nivel de golpe.   | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; reloj y `elapsedMs` solo avanzan en juego.                |
| Emitir `onStat("time")` por frame satura React.                                         | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                                       |
| Flechas, `WASD` o espacio interfieren con el input del modal.                           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                           |
| Movimiento "pegado" tras perder foco.                                                   | `blur` y `pause` ponen las banderas a `false`.                                                                                 |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                         |
| El id con guion y dígitos requiere comillas en `ENGINES` y un nombre de export válido. | Clave `"robotron-2084"` entre comillas; export `robotron2084Def`; carpeta `lib/games/robotron-2084/`; migración con `_`.        |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse, gamepad físico y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Disparo manual en 8 direcciones, vidas, oleadas cerradas, electrodos, esferoides, cerebros y progs.
- Mejoras permanentes, tienda o selección de armas.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
