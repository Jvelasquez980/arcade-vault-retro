# SPEC GJ-galaga-01 — Juego real: GALAGA (variante: clásico de formación) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-20
> **Variant:** 01 de 2 — Galaga clásico fiel: formación de 40 enemigos que entra en grupos, ataques en picado, jefes con rayo tractor que capturan tu nave (rescate = nave doble) y etapas de desafío.
> **Objective:** Crear un motor TypeScript de Galaga dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Galaga. Recrea el arcade de 1981: la nave solo se mueve en horizontal en la base de la pantalla, con **máximo 2 disparos en pantalla**; 40 enemigos (abejas, mariposas y jefes Galaga) entran en grupos siguiendo trayectorias curvas hasta ocupar una **formación fija**, desde la que se lanzan **en picado**. Los jefes pueden usar el **rayo tractor** para capturar tu nave; si luego derribas a ese jefe mientras ataca, recuperas la nave y juegas con **nave doble**. Cada 4 etapas (3, 7, 11…) hay una **etapa de desafío** sin disparos enemigos. Se distingue de la variante 02 (contrarreloj de 120 s con movimiento libre en 2D, disparo continuo, combo multiplicador, power-ups y escuadrones que cruzan sin formación): aquí el reto es **la puntería con munición en pantalla limitada, la lectura de picados y el riesgo/recompensa de la captura**, con ritmo por etapas y sin límite de tiempo.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas, polígonos y gradientes. No existe `.cover-galaga` en `app/globals.css` (`.cover-invaders` es de los prototipos y no se reutiliza); se crea una clase nueva.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 y missile-command, propuesto, reserva 6), dificultad 3, tags `CLÁSICO` y `NAVES`, 1 jugador, teclado. Canvas **448×576** (7:9 vertical, el doble de la resolución del arcade 224×288). **3 vidas** (`initialLives: 3`), **nivel = etapa** (`showLevel: true`) y stat extra `ACIERTO %`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/paths.ts`: funciones puras y constantes — `slotPos(row, col, sway) → { x, y }`, las 4 trayectorias de entrada (`PATH_A`, `PATH_A_MIRROR`, `PATH_B`, `PATH_B_MIRROR`) como listas de beziers cúbicas, `samplePath(beziers, step) → {x,y}[]` (polilínea de 24 puntos por bezier) y `stageConfig(stage) → { diveMs, maxDivers, diveSpeed, enemyBulletSpeed, isChallenge }`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawFighter` (nave del jugador, también la capturada en rojo), `drawBee`, `drawButterfly`, `drawBoss` (dos colores según golpes), `drawBeam`, `drawBullet`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg,#000a1f,#0a0a18)` con `::before` de estrellas (radial-gradients de 1–2 px blancos/cyan) y `::after` con tres siluetas de enemigos en fila (radial-gradients magenta/amarillo/cyan) y la nave cyan abajo al centro.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **448×576**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= etapa) y stat extra `ratio` ("ACIERTO %", `int`).
- Sin HUD nativo de texto en el canvas; las vidas de reserva no se dibujan (las muestra React). Los rótulos "STAGE N" / "CHALLENGING STAGE" no se dibujan (sin overlays).
- Controles: `←`/`→` y `A`/`D` mueven la nave; `Espacio` o `Z` disparan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Transformación de abejas en escorpiones/libélulas, enemigos que se dividen en 3 y la "respiración" (expansión) de la formación del arcade.
- Nave capturada que se vuelve enemiga y ataca; puntos por destruirla.
- Selector de dificultad, modo 2 jugadores alternos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Derriba la formación alienígena.',
       'Mueve tu nave con las flechas o A/D y dispara con Espacio o Z. Cuarenta enemigos entran en formación y se lanzan en picado contra ti; los jefes Galaga pueden capturar tu nave con su rayo tractor, y si los derribas mientras atacan la recuperas para jugar con nave doble. Cada cuatro etapas llega una etapa de desafío para sumar puntos sin peligro.',
       'SHOOTER', 'cyan', 'cover-galaga', 1, 1, '{keyboard}', '{CLÁSICO,NAVES}', 3, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 448, height: 576,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "ratio", label: "ACIERTO %", color: "yellow", format: "int" }],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ship { x, alive, respawnMs, dual: boolean }`, `keysDown: Set<string>`, `bullets: { x, y }[]` (del jugador), `enemyBullets: { x, y, vx, vy }[]`, `enemies: { id, type: "bee" | "butterfly" | "boss", row, col, hp, mode: "entering" | "formation" | "diving" | "beam" | "returning" | "challenge", path: {x,y}[], pathIdx, x, y, vx, vy, t, escortOf?, carriesShip: boolean, firedAt: Set<number> }[]`, `beam { bossId, phase: "grow" | "hold" | "shrink", ms } | null`, `capturedShip { bossId } | null`, `rescue { x, y } | null` (nave liberada que baja a acoplarse), `explosions: { x, y, age }[]`, `stars: { x, y, v, c }[64]`, `sway`, `swayT`, `groupsSpawned`, `spawnTimer`, `diveTimer`, `stage`, `phase: "entry" | "battle" | "challenge" | "clear" | "respawn"`, `phaseMs`, `score`, `nextExtraAt`, `lives`, `shots`, `hits`, `lastRatio`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (etapa), `onStat("ratio", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("ratio", 0)`.
- `onStat("ratio", 0)` oculta el stat en el HUD (contrato de `onStat`); es lo esperado antes del primer acierto.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (un disparo por pulsación, como el arcade); el movimiento usa `keysDown` (continuo mientras se mantiene). No se filtra `e.isTrusted` (SPEC 11).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, rótulo de etapa ni game over dentro del canvas.

**Reglas del juego:**

- **Nave:** hitbox 22×18 px centrada en `(ship.x, 540)`; se dibuja de 26×24. Empieza en `x = 224`. Se mueve **240 px/s** con `←`/`→`/`A`/`D`, limitada a `x ∈ [16, 432]` (nave doble: `x ∈ [30, 418]`, las dos naves a `x − 14` y `x + 14`).
- **Disparo del jugador:** proyectil 3×12 px a **600 px/s** hacia arriba desde `y = 528`. Máximo **2 salvas** en pantalla: con nave simple, 2 proyectiles; con nave doble cada pulsación lanza 2 proyectiles (uno por nave) y el máximo es 4. Si se alcanza el máximo, la pulsación se ignora. Cada proyectil lanzado suma 1 a `shots`; cada impacto en enemigo suma 1 a `hits`. `ratio = shots > 0 ? Math.round(100 × hits / shots) : 0`, emitido solo si cambia.
- **Formación (40 enemigos):** fila 0: 4 jefes (columnas 3–6); filas 1–2: 8 mariposas cada una (columnas 1–8); filas 3–4: 10 abejas cada una (columnas 0–9). `slotPos(row, col, sway) = { x: 224 + (col − 4.5) × 32 + sway, y: 80 + row × 28 }`. `sway = 16 × sin(2π × t / 4000 ms)` (balanceo horizontal continuo).
- **Tamaños de hitbox:** abeja 20×16, mariposa 22×16, jefe 26×20 (se dibujan 2 px mayores).
- **Entrada (etapa normal):** 5 grupos de 8, el primero a los **1000 ms** de empezar la etapa y los siguientes cada **2600 ms**; dentro de un grupo, un miembro cada **120 ms**. Velocidad sobre la trayectoria **220 px/s** (constante sobre la polilínea). Al terminar la trayectoria, vuelan en línea recta a su `slotPos` a 220 px/s y pasan a `formation`.
  - G1: `PATH_A` con 4 abejas (fila 3, cols 3–6) alternando con `PATH_A_MIRROR` con 4 mariposas (fila 1, cols 3–6).
  - G2: `PATH_B` con 4 jefes (fila 0) alternando con 4 mariposas (fila 2, cols 3–6).
  - G3: `PATH_B_MIRROR` con 8 mariposas (filas 1 y 2, cols 1, 2, 7, 8).
  - G4: `PATH_A` con 8 abejas (fila 3 cols 0–2 y 7–9 + fila 4 cols 4–5).
  - G5: `PATH_A_MIRROR` con 8 abejas (fila 4, cols 0–3 y 6–9).
  - Trayectorias (beziers cúbicas `inicio, c1, c2, fin`): `PATH_A` = `(180,−20) (180,120) (40,160) (60,260)` + `(60,260) (80,340) (180,340) (200,300)`; `PATH_B` = `(−20,440) (120,440) (220,360) (200,240)` + `(200,240) (180,120) (120,120) (120,180)`. Las `_MIRROR` usan `x' = 448 − x`.
  - Durante la entrada los enemigos no disparan ni colisionan entre sí; sí pueden ser derribados y sí matan a la nave por contacto.
- **Picados (`phase = "battle"`):** empiezan cuando el último miembro de G5 llega a su slot (o muere). Cada `diveMs = max(900, 2500 − 150 × (stage − 1))` ms se lanza un picado si hay menos de `maxDivers = min(2 + Math.floor(stage / 2), 6)` grupos en picado:
  - Se elige un enemigo en `formation` al azar (jefe con probabilidad 0.2 si queda alguno; si no, abeja o mariposa al azar).
  - Un jefe se lleva como escolta hasta 2 mariposas en `formation` de la fila 1 con columna adyacente (`|col − boss.col| ≤ 1`); su `escortOf` apunta al jefe.
  - Movimiento: sale con un semicírculo de **36 px** de radio hacia arriba y hacia el lado más cercano (600 ms), luego baja con `vy = diveSpeed = min(160 + 10 × (stage − 1), 260)` px/s y `vx` que persigue `ship.x` con límite **±90 px/s**. Al pasar `y > 600` reaparece en `y = −24` sobre su slot y vuelve (`returning`) a 200 px/s.
  - **Disparo enemigo:** un enemigo en picado dispara al cruzar `y = 200` y `y = 320`, cada vez con probabilidad **0.5**; la bala (3×8 px) apunta a la posición de la nave en ese momento con `|v| = enemyBulletSpeed = min(240 + 10 × (stage − 1), 360)` px/s y `vy ≥ 120` (si el vector sale más horizontal, se fija `vy = 120` y se reescala `vx`). Máximo **8** balas enemigas; si hay 8, no dispara.
- **Jefe:** 2 impactos. El primero lo cambia de verde `#00ff88` a morado `#a855f7` (sin puntos); el segundo lo destruye.
- **Rayo tractor:** cuando se elige un jefe para picar, no hay `capturedShip`, la nave no es doble, la nave está viva y no hay otro `beam`, el picado es de rayo con probabilidad **0.35** (sin escolta). El jefe baja en línea recta a 200 px/s hasta `(ship.x en el momento de elegir, 300)` y se detiene. El rayo es un trapecio de **48 px** de ancho arriba (`y = 310`) a **96 px** abajo (`y = 560`): crece 1000 ms (`grow`, alto de 0 a 250 px), se mantiene 2000 ms (`hold`) y se retrae 1000 ms (`shrink`); luego el jefe vuelve a su slot.
  - Si durante `hold` el centro de la nave está dentro del ancho inferior del rayo → **captura**: la nave sube con el rayo (1000 ms, sin control), queda roja `#ff3355` 20 px sobre el jefe (`capturedShip = { bossId }`, `carriesShip = true`) y el jefe vuelve a su slot. Cuenta como vida perdida: `lives − 1` y `onLives(lives)`; si `lives = 0` → game over. Si quedan vidas, nueva nave en `x = 224` tras **1500 ms**.
  - Derribar al jefe durante el rayo cancela el rayo (sin captura).
  - Un jefe con `carriesShip` puede volver a picar (nunca con rayo); la nave capturada lo sigue 20 px por encima.
  - **Rescate:** si se destruye un jefe con `carriesShip` mientras está en picado (`diving`), la nave capturada pasa a `rescue`, baja a 150 px/s hasta `y = 540` y luego se desplaza a 120 px/s hasta acoplarse a la derecha de la nave (`ship.dual = true`). Mientras baja, la nave del jugador puede seguir moviéndose y disparando; si el jugador muere antes del acople, la muerte se resuelve normalmente (vida descontada) y la nave rescatada se pierde (`rescue = null`).
  - Si se destruye un jefe con `carriesShip` en `formation`, la nave capturada sube a 200 px/s y sale de la pantalla (perdida, 0 puntos).
- **Nave doble:** hitbox de dos naves de 22×18 a `x ± 14`. Si un impacto alcanza a una de las dos, esa mitad se pierde (`dual = false`, la nave restante se queda en su posición) sin perder vida. No puede ser capturada (los jefes no usan rayo).
- **Muerte:** bala enemiga o cuerpo de enemigo que toca la hitbox (y no hay nave doble) → explosión (500 ms), `lives − 1`, `onLives(lives)`. Si `lives = 0` → `onLives(0)` y `onGameOver(score)`. Si no: `phase = "respawn"` **2000 ms** (se borran las balas enemigas, los enemigos en picado pasan a `returning`, no se lanzan picados), luego nave en `x = 224`. El enemigo que choca con la nave muere y suma sus puntos.
- **Puntuación:**
  - Abeja: **50** en formación o entrando, **100** en picado.
  - Mariposa: **80** en formación o entrando, **160** en picado.
  - Jefe: **150** en formación o entrando; en picado **400** sin escolta (o con escoltas vivas), **800** si murió 1 escolta antes que él en ese picado, **1600** si murieron las 2.
  - Etapa de desafío: **100** por enemigo; derribar los 40 → **+10000** bonus.
- **Vida extra:** a los **20000** puntos y luego cada **70000** (20000, 90000, 160000…), máximo **5** vidas; `onLives(lives)`.
- **Fin de etapa:** cuando no quedan enemigos vivos (ni nave capturada en pantalla ni `rescue` pendiente), `phase = "clear"` durante **2000 ms** (sin enemigos, la nave se puede mover y disparar sin efecto), luego `stage + 1`, `onLevel(stage)` y formación nueva de 40 (si había `capturedShip`, se pierde).
- **Etapa de desafío:** cuando `stage % 4 === 3` (3, 7, 11…). 5 grupos de 8, un grupo cada **2200 ms** (el primero a los 1000 ms), un miembro cada **140 ms**, a **240 px/s**: G1 `PATH_A`, G2 `PATH_B`, G3 `PATH_B_MIRROR`, G4 `PATH_A_MIRROR`, G5 4 por `PATH_A` + 4 por `PATH_A_MIRROR`. Tipos visuales: G1–G2 abejas, G3–G4 mariposas, G5 jefes de 1 impacto. Al terminar la trayectoria siguen recto hacia abajo hasta `y > 600` y desaparecen. No disparan ni dañan por contacto. La etapa termina cuando todos han muerto o salido; sigue el `clear` de 2000 ms.
- **Fondo:** 64 estrellas con `x` aleatoria, velocidad `v ∈ [30, 90]` px/s hacia abajo, tamaño 1–2 px y color de `[#ffffff, #00f5ff, #ff2bd6, #ffe600]`; al salir por abajo reaparecen arriba. Se congelan en pausa.
- **Dibujo:** fondo `#000008`. Nave del jugador: polígono blanco con cabina cyan `#00f5ff` y alas rojas `#ff3355`. Abeja: cuerpo amarillo `#ffe600` con alas azules `#3b82f6`. Mariposa: cuerpo rojo `#ff3355` con alas blancas. Jefe: verde `#00ff88` (o morado tras un impacto) con antenas. Las alas aletean (alternan 2 formas cada 250 ms) en `formation`. Balas del jugador `#00f5ff`; balas enemigas `#ffe600` con núcleo blanco. Rayo: trapecio con gradiente lineal `rgba(0,245,255,0.6)` → `rgba(0,245,255,0.05)` y franjas horizontales cada 12 px. Explosión: 8 rayos radiales que crecen de 0 a 16 px en 400 ms (`#ffe600` → `#ff3355`).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/galaga/paths.ts` (`slotPos`, trayectorias, `samplePath`, `stageConfig`). Verificar: `npm run lint`; `stageConfig(1)` da `diveMs` 2500, `maxDivers` 2, `diveSpeed` 160, bala 240, `isChallenge` false; `stageConfig(3).isChallenge` true; `stageConfig(12)` da 900, 6, 260, 350.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): entrada de los 5 grupos hasta la formación, límite de 2 disparos, picados con disparo, jefe que necesita 2 impactos, captura por rayo (vida baja), rescate en picado (nave doble), perder una mitad de la nave doble sin perder vida, completar etapa 1 y 2, etapa de desafío 3 (sin disparos enemigos), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; registrar la migración en la tabla de `references/production/prod-setup.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`NAVES`, dificultad 3, color cyan, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 7:9 vertical sin desborde a 375 px y 1280 px.
- [ ] `←`/`→`/`A`/`D` mueven la nave a 240 px/s dentro de `x ∈ [16, 432]`; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`/`Z` disparan un proyectil por pulsación (mantener no repite); nunca hay más de 2 proyectiles del jugador en pantalla (4 con nave doble).
- [ ] La etapa normal trae exactamente 40 enemigos (4 jefes, 16 mariposas, 20 abejas) en 5 grupos de 8 que terminan en su slot de la formación, que se balancea ±16 px.
- [ ] Los picados empiezan tras la entrada; en la etapa 1 hay como mucho 2 a la vez y uno nuevo cada 2500 ms.
- [ ] Abeja 50/100, mariposa 80/160 (formación/picado); jefe 150 en formación, 400/800/1600 en picado según escoltas derribadas antes.
- [ ] El jefe necesita 2 impactos y cambia de verde a morado tras el primero.
- [ ] Quedar bajo el rayo tractor durante la fase de 2000 ms captura la nave: vidas del HUD bajan en 1 y la nave roja aparece sobre el jefe.
- [ ] Derribar en picado al jefe con la nave capturada devuelve la nave y activa la nave doble; un impacto en una mitad la quita sin perder vida.
- [ ] Derribar en formación al jefe con la nave capturada hace que la nave capturada se vaya y no da nave doble.
- [ ] La etapa 3 (y 7, 11…) es de desafío: 40 enemigos que no disparan ni dañan, 100 por enemigo y +10000 si caen los 40.
- [ ] Al vaciar la etapa, tras 2000 ms empieza la siguiente y el nivel del HUD sube.
- [ ] Vida extra a los 20000 y 90000 puntos (máximo 5).
- [ ] ACIERTO % refleja `round(100 × aciertos / disparos)` y solo se emite al cambiar.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel (etapa) y ACIERTO %; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, balas, rayo, estrellas y temporizadores; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `Z`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, etapa 1, nave simple en `x = 224`, sin nave capturada, ACIERTO oculto).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** canvas 448×576 vertical (doble del arcade); **No:** apaisado (cambia el tiempo de reacción de los picados).
- **Sí:** límite de 2 disparos en pantalla y un disparo por pulsación (rasgo central del clásico); **No:** auto-fire (es de la variante 02).
- **Sí:** rayo tractor, captura como vida perdida y rescate con nave doble (mecánica que define Galaga).
- **No:** nave capturada hostil ni transformaciones de enemigos (más IA y estados; spec aparte).
- **Sí:** etapa de desafío cada 4 etapas empezando en la 3 (como el arcade) con bonus perfecto de 10000.
- **Sí:** `initialLives: 3`, `showLevel: true` (etapa) y stat `ACIERTO %` (el arcade muestra el ratio al final; aquí vive en el HUD).
- **Sí:** formación con balanceo horizontal simple; **No:** la "respiración" expansiva del original.
- **Sí:** valores de balance (velocidades, picados, probabilidad de rayo 0.35, puntos, vidas extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER, color cyan y `.cover-galaga` nueva; **No:** reutilizar `.cover-invaders` (es otro juego del prototipo).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Máquina de estados de enemigos (entrada/formación/picado/rayo/regreso) con bugs.       | `mode` explícito por enemigo y una función de update por modo; verificar cada transición en el paso 6.                     |
| Captura y rescate dejan estados colgados (nave capturada sin jefe, `rescue` perdido).  | El fin de etapa exige `capturedShip`/`rescue` resueltos; al morir el jefe portador siempre se limpia `capturedShip`.        |
| Velocidad no constante en beziers (los enemigos aceleran en curvas).                   | `samplePath` genera polilínea y el avance se hace por distancia recorrida, no por parámetro `t`.                           |
| Emitir `onStat("ratio")` o `onScore` por frame satura React.                           | Emitir solo al disparar/acertar si el entero cambia, y al sumar puntos.                                                    |
| `dt` grande tras pausar o cambiar de pestaña teletransporta balas a través de la nave. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms (máx. 30 px por paso de bala, menor que la hitbox).     |
| Flechas, `A`/`D`/`Z` o espacio interfieren con el input del modal.                     | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                       |
| Tecla de movimiento "pegada" tras perder foco.                                         | `blur` y `pause` vacían `keysDown`.                                                                                        |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                     |
| Canvas vertical alto desborda en escritorio bajo o móvil.                              | `GamePlayer` fija `--game-ar` desde `width/height`; verificar a 375 y 1280 px.                                             |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                            |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Transformaciones de enemigos, nave capturada hostil y respiración de la formación.
- HUD nativo de texto dentro del canvas y overlays de pausa/etapa/game over (incluida la pantalla de resultados con ratio).
- Selector de dificultad, modo 2 jugadores.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
