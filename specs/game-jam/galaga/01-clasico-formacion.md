# SPEC GJ-galaga-01 — Juego real: GALAGA (variante: clásico de formación) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-30
> **Variant:** 01 de 2 — Galaga clásico fiel: fases de 40 enemigos que entran en grupos a una formación, picados con disparo, Boss Galaga de 2 impactos con rayo tractor que captura tu nave, rescate para la nave doble y fase de desafío cada 4 fases.
> **Objective:** Crear un motor TypeScript de Galaga dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Galaga. Recrea el arcade de 1981: la nave del jugador solo se mueve en horizontal en la base; cada **fase** trae **40 enemigos** (4 Boss, 16 mariposas, 20 abejas) que entran en **5 grupos** por trayectorias curvas hasta ocupar una **formación fija**; desde ahí bajan en **picados** disparando. El Boss puede lanzar un **rayo tractor** que **captura la nave**; destruir a ese Boss mientras pica la libera y el jugador pasa a **nave doble** (doble disparo, doble blanco). Cada 4 fases (3, 7, 11…) hay una **fase de desafío** sin disparos enemigos con bonus por precisión. Se distingue de la variante 02 (enjambre continuo sin formación, movimiento libre en 2D, disparo sostenido con sobrecalentamiento, power-ups y combo): aquí el reto es **leer la formación y los picados, y arriesgar la nave por la nave doble**, con ritmo por fases.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`) y se dibuja todo con formas, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5, `missile-command` = 6 reservado por su game jam), dificultad 4, tags `CLÁSICO` y `NAVES`, 1 jugador, teclado. Canvas **480×640** (3:4, vertical). **3 vidas** (`initialLives: 3`, cuenta las naves propias incluidas las activas), **nivel = fase** (`showLevel: true`), stat extra `RESTANTES`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/paths.ts`: waypoints literales de las 4 trayectorias de entrada (`A`, `B`, `C`, `D`), helper puro `followPath(points, dist) → { x, y, angle }` (Catmull-Rom a velocidad constante por longitud de arco precalculada) y slots de formación `slotPos(row, col, swayX) → { x, y }`.
- Módulo `lib/games/galaga/stages.ts`: funciones puras de balance (`stageConfig(stage) → { diveIntervalMs, maxDivers, diveSpeed, fireChance }`, `isChallenge(stage)`) y tablas de grupos de entrada (normal y desafío).
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawPlayer`, `drawBee`, `drawButterfly`, `drawBoss` (verde / dañado morado), `drawCapturedShip`, `drawBeam`, `drawBullet`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg,#14002a,#0a0a18)` con `::after` de 3 filas de círculos radiales (verde, magenta, amarillo) a modo de formación y `::before` con un triángulo/nave blanca abajo al centro (`conic-gradient` o `radial-gradient`), `drop-shadow` magenta.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= fase) y stat extra `left` ("RESTANTES", `int`, enemigos que quedan en la fase).
- Sin HUD nativo de texto en el canvas (ni "STAGE n", ni "PERFECT"); solo escenario, naves, balas y explosiones.
- Controles: `←`/`→` y `A`/`D` mueven la nave; `Espacio` dispara (uno por pulsación). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Nave capturada que se vuelve hostil y dispara, escoltas transformables (escorpiones/"transforms") y enemigos de fases altas del arcade.
- Estadística de precisión de fin de partida (`shots fired / hits`) y textos "STAGE n" / "PERFECT".
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Derriba la formación alienígena.',
       'Mueve tu nave con las flechas o A/D y dispara con Espacio. Cuarenta enemigos entran en formación y se lanzan en picado disparando. El Boss Galaga necesita dos impactos y puede capturar tu nave con su rayo tractor: derríbalo mientras pica para recuperarla y pelear con nave doble. Cada cuatro fases llega una fase de desafío sin disparos enemigos.',
       'SHOOTER', 'magenta', 'cover-galaga', 1, 1, '{keyboard}', '{CLÁSICO,NAVES}', 4, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "left", label: "RESTANTES", color: "yellow", format: "int" }],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ships: { x, alive }[]` (1 o 2 naves; con nave doble la segunda va a `x + 30`), `keysDown: Set<string>`, `playerBullets: { x, y }[]`, `enemyBullets: { x, y, vx, vy }[]`, `enemies: { id, type: "bee" | "butterfly" | "boss", hp, row, col, mode: "entering" | "formation" | "diving" | "returning" | "beaming" | "leaving", pathId, pathDist, x, y, angle, diveT, escorts: number[], escortsKilled, hasCapturedShip, firedAt: Set<number> }[]`, `captured: { x, y, mode: "rising" | "held" | "freed" } | null`, `beam: { bossId, x, t } | null`, `explosions: { x, y, age, color }[]`, `stars: { x, y, speed, color }[]` (80), `stage`, `challenge: boolean`, `spawnQueue` (grupos de entrada pendientes con su `startMs`), `swayT`, `diveTimer`, `phase: "entry" | "attack" | "clear" | "respawn" | "challenge"`, `phaseMs`, `respawnMs`, `invulnMs`, `challengeHits`, `lives`, `score`, `nextExtraAt`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (fase), `onStat("left", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("left", 40)`.
- `onStat("left", 0)` oculta el stat en el HUD (contrato de `onStat`); es el comportamiento esperado al limpiar la fase.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (un disparo por pulsación); el movimiento usa `keysDown` (continuo mientras se mantiene).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de fase ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** fondo `#000` con 80 estrellas de 1–2 px que bajan a 30–90 px/s (velocidad y color aleatorios entre cyan, magenta, amarillo y blanco) y parpadean (alfa 0.3–1, periodo 1–3 s).
- **Nave del jugador:** 28×28 px, centro en `y = 600`, `x` inicial 240. Se mueve a **260 px/s**, limitada a `x ∈ [20, 460]` (con nave doble, la segunda nave también debe quedar en ese rango: `x ∈ [20, 430]`). Hitbox: círculo de 11 px.
- **Disparo del jugador:** `Espacio` dispara una bala (3×12 px, **640 px/s** hacia arriba) desde cada nave viva. Máximo **2** balas propias en pantalla por nave (2 con nave simple, 4 con doble); si se alcanza el máximo, la pulsación se ignora. La bala muere al salir por `y < 0` o al impactar.
- **Formación:** 10 columnas × 5 filas, celda 36×32 px. Slot `(row, col)` en `x = 240 + (col − 4.5) × 36 + swayX`, `y = 80 + row × 32`. Fila 0: 4 Boss (col 3–6); filas 1–2: 8 mariposas (col 1–8); filas 3–4: 10 abejas (col 0–9). `swayX = 16 × sin(2π × swayT / 4000)` (balanceo continuo de ±16 px, periodo 4 s). Los enemigos en formación no disparan.
- **Trayectorias de entrada** (waypoints en `paths.ts`, recorridas a **220 px/s**; al terminar, vuelo recto a su slot a 220 px/s y pasan a `formation`):
  - `A` (arriba-izq): (220, −20) → (220, 140) → (120, 300) → (80, 380) → (160, 420) → (240, 340).
  - `B` (arriba-der): espejo de `A` (`x' = 480 − x`).
  - `C` (lado-izq): (−20, 520) → (120, 480) → (220, 380) → (200, 260) → (120, 220) → (100, 300).
  - `D` (lado-der): espejo de `C`.
- **Grupos de entrada (fase normal)**: 5 grupos de 8; el grupo `g` empieza `1600 × g` ms tras empezar la fase (g = 0…4) y dentro del grupo cada enemigo sale **120 ms** después del anterior:
  - G0: 4 mariposas por `A` + 4 abejas por `B` (en paralelo).
  - G1: 4 Boss + 4 mariposas por `C` (alternados).
  - G2: 8 mariposas por `D`.
  - G3: 8 abejas por `A`.
  - G4: 8 abejas por `B`.
  - Los enemigos en entrada no disparan, pero chocar con ellos mata.
- **Balance por fase** (`stageConfig(stage)`):
  - `diveIntervalMs = max(700, 2200 − 120 × (stage − 1))`.
  - `maxDivers = min(2 + floor((stage − 1) / 2), 6)`.
  - `diveSpeed = min(200 + 15 × (stage − 1), 340)` px/s.
  - `fireChance = min(0.4 + 0.06 × (stage − 1), 0.9)`.
- **Picados:** los picados empiezan cuando el último enemigo del G4 entra en formación. Cada `diveIntervalMs`, si hay menos de `maxDivers` enemigos fuera de formación, se elige al azar un enemigo en `formation`:
  - Abeja o mariposa: pica sola.
  - Boss: con probabilidad **0.35** hace picado de rayo (ver abajo) si el jugador tiene nave simple, no hay otra nave capturada y el Boss no lleva nave capturada; si no, pica con hasta **2 escoltas** (mariposas en `formation` de la fila 1 en columnas adyacentes `col ± 1`), que cuentan para `maxDivers`.
  - Trayectoria de picado: semicírculo de radio 40 px hacia el lado más cercano al borde (≈ 600 ms), luego descenso a `diveSpeed` con dirección horizontal hacia la `x` de la nave más cercana, limitada a **140 px/s**. Al pasar `y > 660` reaparece en `y = −20` en su misma `x` y vuelve a su slot a 220 px/s (`returning` → `formation`).
  - **Ataque final:** si quedan **5 o menos** enemigos en la fase normal, `maxDivers` = enemigos restantes y `diveIntervalMs` = 400.
- **Disparo enemigo:** cada enemigo en picado comprueba dos puntos de control, al cruzar `y = 220` y `y = 320`; en cada uno dispara con probabilidad `fireChance` (máximo 2 balas por picado). Bala: círculo de 3 px, `vy = 240` px/s, `vx` apuntada a la `x` de la nave más cercana y limitada a **±80 px/s**. Muere al salir del canvas.
- **Rayo tractor:** el Boss baja hasta `y = 380` en la `x` de la nave al empezar el picado (limitada a `[60, 420]`), se detiene y emite el rayo **3000 ms**: trapecio de `y = 400` a `y = 620` cuyo ancho inferior crece de 0 a **96 px** en los primeros 500 ms. Si el centro de la nave está dentro del ancho inferior del rayo con el rayo ya a ancho completo, la nave es **capturada**: desaparece, `lives − 1` y `onLives(lives)`, se crea `captured` en la nave que sube a 120 px/s hasta 28 px por encima del Boss; el Boss vuelve a su slot llevando la nave (`hasCapturedShip = true`) y ambos quedan en formación. Si `lives = 0` → `onLives(0)` y `onGameOver(score)`. Si no captura, al terminar el rayo el Boss sigue el descenso normal de picado. Disparar al Boss durante el rayo sí le hace daño.
- **Nave capturada:** sigue a su Boss (en formación y en picado, 28 px por encima). Si una bala propia la toca, se destruye (sin puntos) y desaparece para siempre. Si el Boss que la lleva es destruido **en formación**, la nave capturada se destruye con él. Si es destruido **en picado**, la nave queda libre (`freed`): `lives + 1`, `onLives(lives)`, desciende a 200 px/s hacia la posición de nave doble (`x + 30` de la nave actual; si no cabe, `x − 30` y la nave actual se desplaza) y al llegar se acopla (nave doble). Si en ese momento no hay nave activa, se convierte en la nave activa en (240, 600) y cancela la espera de reaparición.
- **Boss:** 2 impactos. El primero lo pasa de verde a morado (sin puntos); el segundo lo destruye. Con nave doble, ambas balas pueden impactar en el mismo frame (cada impacto cuenta).
- **Puntuación (fase normal):**
  - Abeja: **50** en formación o entrando, **100** en picado.
  - Mariposa: **80** en formación o entrando, **160** en picado.
  - Boss: **150** en formación o entrando; en picado **400 × 2^k**, con `k` = escoltas de ese picado ya destruidas (máximo 1600). Un Boss en picado de rayo vale 400.
- **Muerte del jugador:** bala enemiga o choque con un enemigo (círculo 11 px vs. círculo de 12 px del enemigo) destruye la nave tocada (el enemigo chocado también muere y suma sus puntos), explosión de 600 ms, `lives − 1` y `onLives(lives)`. Con nave doble solo se pierde la nave tocada y la otra sigue como simple. Si no quedan naves activas: si `lives = 0` → `onLives(0)` y `onGameOver(score)`; si no, `phase = "respawn"`: no empiezan picados nuevos y la nave reaparece en (240, 600) cuando no hay enemigos fuera de formación ni balas enemigas, o a los **4000 ms**, con **1500 ms** de invulnerabilidad (parpadeo cada 100 ms).
- **Vida extra:** a los **20000** puntos y luego cada **70000** (70000, 140000, …): `lives + 1`, `onLives(lives)`, máximo 9.
- **Fin de fase normal:** cuando no queda ningún enemigo de los 40 (`onStat("left", 0)`), se borran las balas enemigas y, tras **2000 ms** (`phase = "clear"`), `stage + 1`, `onLevel(stage)`, `onStat("left", 40)` y empieza la entrada. Una nave capturada que no se liberó se pierde al acabar la fase.
- **Fase de desafío** (`isChallenge(stage)` = `stage % 4 === 3`: fases 3, 7, 11…): 5 grupos de 8 (G0 abejas por `A`+`B`, G1 mariposas por `C`, G2 Boss por `D`, G3 mariposas por `A`, G4 abejas por `B`), cada grupo `1800 × g` ms tras empezar, 120 ms entre enemigos, a **260 px/s**. No van a formación: tras el último waypoint siguen en línea recta con su último rumbo hasta salir del canvas. No disparan ni hay picados ni rayo; chocar sigue matando. Boss de 1 impacto. Cada derribo suma **100** y `onStat("left", n − 1)`. Termina cuando los 40 se han derribado o salido: bonus `challengeHits × 100`, o **10000** si `challengeHits = 40`; luego 2000 ms de `clear` y siguiente fase normal.
- **Dibujo:** abeja: cuerpo amarillo `#ffe600` con alas azules `#2b6bff` (elipses), 24×20 px. Mariposa: cuerpo blanco con alas rojas `#ff3355`, 26×22 px. Boss: verde `#39ff14` con antenas, 30×26 px; dañado: morado `#a020f0`. Nave: blanca con alerones rojos `#ff3355` y cabina cyan `#00f5ff`; capturada: misma forma en rojo `#ff3355`. Rayo: trapecio con franjas horizontales azul/cyan semitransparentes (alfa 0.5) que se desplazan hacia abajo. Bala propia `#ffffff`, bala enemiga `#ff2bd6`. Explosión: 8 rayos radiales que crecen de 4 a 22 px en 400 ms, color del enemigo. Los enemigos en entrada y picado rotan según su `angle`; en formación aletean (escala Y 1 ↔ 0.85 cada 400 ms).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` / `lib/games/frogger/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/galaga/paths.ts` (waypoints, `followPath`, `slotPos`). Verificar: `npm run lint`; `followPath(A, 0)` devuelve (220, −20) y `slotPos(0, 3, 0)` devuelve (186, 80).
3. Crear `lib/games/galaga/stages.ts`. Verificar: `npm run lint`; `stageConfig(1)` da 2200 ms, 2 picadores, 200 px/s, 0.4; `stageConfig(20)` da 700 ms, 6, 340 px/s, 0.9; `isChallenge(3)` y `isChallenge(7)` son `true`, `isChallenge(4)` es `false`.
4. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): entrada de los 5 grupos a la formación, picados con disparo, Boss de 2 impactos, captura por rayo (vidas bajan), rescate (nave doble, vidas suben), perder una nave de la doble, limpiar fase 1 y 2, fase de desafío 3 (bonus), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'galaga'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`NAVES`, dificultad 4, color magenta, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven la nave a 260 px/s dentro de `x ∈ [20, 460]`; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio` dispara una bala por pulsación (mantenerlo no repite) y nunca hay más de 2 balas propias por nave.
- [ ] Cada fase normal trae 40 enemigos (4 Boss, 16 mariposas, 20 abejas) en 5 grupos de 8 por las trayectorias A/B/C/D y ocupan la formación 10×5 con balanceo de ±16 px.
- [ ] Los picados empiezan tras la entrada; en la fase 1 sale uno cada 2200 ms con máximo 2 a la vez y bajan a 200 px/s; con 5 o menos enemigos atacan todos.
- [ ] Los enemigos en picado disparan como máximo 2 balas; en formación y en entrada no disparan.
- [ ] Puntos exactos: abeja 50/100, mariposa 80/160, Boss 150 en formación y 400/800/1600 en picado según escoltas derribadas antes.
- [ ] El Boss necesita 2 impactos y cambia de verde a morado con el primero.
- [ ] El rayo tractor dura 3000 ms; si captura la nave, las vidas del HUD bajan en 1 y la nave roja queda sobre el Boss en formación.
- [ ] Derribar al Boss captor mientras pica libera la nave: vidas +1 y nave doble con 2 balas por disparo; derribarlo en formación destruye la nave capturada.
- [ ] Con nave doble, un impacto elimina solo la nave tocada y las vidas bajan en 1.
- [ ] Tras perder una nave con vidas restantes, la nueva aparece en (240, 600) tras despejarse los picados (o a los 4000 ms) con 1500 ms de invulnerabilidad.
- [ ] RESTANTES empieza en 40, baja con cada derribo y se oculta (0) al limpiar la fase; el nivel del HUD sube tras 2000 ms.
- [ ] La fase 3 es de desafío: sin disparos enemigos, cada derribo suma 100 y al final suma `aciertos × 100` o 10000 si derriba los 40.
- [ ] Hay vida extra a los 20000 y 70000 puntos.
- [ ] Perder la última vida (por impacto o por captura) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas, nivel (fase) y RESTANTES; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, balas, rayo, estrellas y temporizadores; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, espacio) no mueve la nave ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, fase 1, RESTANTES 40, nave simple en x 240, sin nave capturada, balas ni explosiones).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** formación fija con entrada por trayectorias y picados; es la identidad de Galaga y lo que separa esta variante de la 02.
- **Sí:** rayo tractor, captura y nave doble; **No:** nave capturada hostil que dispara (más IA; spec aparte).
- **Sí:** vidas = naves propias (la captura resta y el rescate suma) para respetar el orden `onLives(0)` → `onGameOver` también cuando la captura se lleva la última nave.
- **Sí:** fase como nivel (`showLevel: true`) y stat `RESTANTES`; **No:** stat de precisión (cambiaría con cada disparo).
- **Sí:** disparo por pulsación con máximo 2 balas por nave (fiel al original); **No:** autodisparo.
- **Sí:** fase de desafío cada 4 fases (3, 7, 11…) como el arcade, con bonus por aciertos.
- **Sí:** reaparición diferida hasta que no haya picados (o 4000 ms) e invulnerabilidad de 1500 ms; evita muertes encadenadas injustas.
- **Sí:** trayectorias como waypoints con Catmull-Rom a velocidad constante; **No:** curvas por fase distintas (más datos; spec aparte).
- **Sí:** valores de balance (velocidades, intervalos, probabilidades, puntos, vidas extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER y color magenta (distingue de Asteroids, cyan); **Sí:** `.cover-galaga` nueva.
- **Sí:** canvas 480×640 vertical (3:4, como el monitor rotado del arcade).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| La máquina de estados de captura/rescate deja naves huérfanas o vidas mal contadas.    | `captured` único con `mode` explícito; `lives` solo cambia en captura, rescate, impacto y vida extra; verificar en paso 7.     |
| Trayectorias Catmull-Rom con velocidad irregular o enemigos que no llegan a su slot.  | Longitud de arco precalculada por tramos en `paths.ts`; el tramo final al slot es lineal y termina al llegar (`dist ≤ step`). |
| La fase nunca termina por un enemigo fuera de pantalla o un contador mal llevado.      | Fin de fase basado en `enemies` vacío (desafío: derribado o salido), no en contadores derivados.                              |
| Muertes injustas al reaparecer bajo un picado.                                         | Reaparición diferida hasta que no haya picados ni balas (máx. 4000 ms) e invulnerabilidad de 1500 ms.                         |
| Emitir `onStat("left")` o `onLives` por frame satura React.                            | Emitir solo en derribo, captura, rescate, impacto, vida extra e inicio de fase.                                               |
| `dt` grande tras pausar o cambiar de pestaña teletransporta enemigos o balas.         | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                          |
| Flechas, `A`/`D` o espacio interfieren con el input del modal.                         | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                          |
| Tecla "pegada" tras perder foco.                                                       | `blur` y `pause` vacían `keysDown`.                                                                                           |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                        |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                               |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Nave capturada hostil, enemigos transformables y variantes de fases altas del arcade.
- HUD nativo de texto dentro del canvas ("STAGE n", "PERFECT", estadística de precisión) y overlays de pausa/transición/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
