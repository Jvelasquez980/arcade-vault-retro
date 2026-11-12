# SPEC GJ-galaga-01 — Juego real: GALAGA (variante: clásico de formaciones) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-12
> **Variant:** 01 de 2 — Clásico fiel: formación de 40 enemigos que entra en grupos, picadas con escoltas, rayo tractor del jefe con rescate y caza doble, 3 vidas y fases infinitas.
> **Objective:** Crear un motor TypeScript de Galaga (variante clásico de formaciones) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Galaga. Reproduce el bucle del arcade original: cada fase empieza con **40 enemigos que entran en 5 grupos** siguiendo trayectorias curvas hasta ocupar su hueco en una **formación fija** que oscila; después, los enemigos se lanzan **en picada** contra el jugador (los jefes con hasta 2 escoltas) y vuelven a su hueco si no mueren. El **jefe Galaga** necesita 2 impactos y puede lanzar un **rayo tractor** que captura la nave; rescatarla derribando al jefe en picada da el **caza doble** (dos naves, dos disparos). La nave solo se mueve en horizontal y hay **máximo 2 disparos propios** en pantalla. Se distingue de la variante 02 (contrarreloj de 120 s sin formación, movimiento libre en la zona baja, auto-disparo, multiplicador de combo y power-ups).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts` y `lib/games/asteroids/engine.ts` para el disparo con `Space`) y se dibuja todo con formas y gradientes. `app/globals.css` tiene `.cover-invaders` (de otro juego del prototipo) pero no una clase de Galaga; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` reserva 6 en sus specs propuestos), dificultad 4, tags `CLÁSICO` y `FORMACIONES`, 1 jugador, teclado. Canvas **480×640** (3:4 vertical). **3 vidas** (`initialLives: 3`), **nivel = fase** (`showLevel: true`), stat extra `ACIERTO %`. Sin fases de desafío (challenging stages), sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/formation.ts`: datos y funciones puras: `SLOTS` (40 huecos con fila, columna, tipo), `slotPos(slot, tMs)` (con oscilación), `GROUPS` (5 grupos de entrada con trayectoria y huecos), `ENTRY_PATHS` (4 curvas Bézier cúbicas literales), `bezierAt(path, t)`, `diveIntervalMs(stage)`, `maxDivers(stage)`, `diveSpeed(stage)`, `enemyFireChance(stage)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawFighter` (simple o doble), `drawBee`, `drawButterfly`, `drawBoss` (verde / dañado), `drawBeam`, `drawShot`, `drawEnemyShot`, `drawExplosion`, `drawPointsLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg,#000820,#0a0a18)` con puntos de estrellas (`radial-gradient` repetido), `::after` con una nave cyan (triángulo con `clip-path`) abajo al centro y `::before` con tres siluetas de enemigos magenta/amarillo arriba en formación.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (fase) y stat extra `accuracy` ("ACIERTO %", `int`).
- Sin HUD nativo de texto en el canvas, salvo las etiquetas efímeras de puntos (`400`, `800`, `1600`) al derribar jefes en picada y el texto `FASE N` durante la transición entre fases (efecto de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` mueven la nave; `Espacio` (o `↑`/`W`) dispara. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Fases de desafío (challenging stages) y bonus de "perfect".
- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Enemigos transformables (scorpions, etc.) y caza capturado que se vuelve hostil en formación.
- Power-ups, movimiento vertical de la nave, auto-disparo.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Derriba la formación antes de que se lance en picada.',
       'Mueve tu nave con las flechas o A/D y dispara con Espacio. Cuarenta enemigos entran en formación y se lanzan en picada contra ti; los jefes aguantan dos disparos y pueden capturar tu nave con su rayo tractor. Derriba al jefe mientras baja para rescatarla y pilotar el caza doble. Tres vidas y fases infinitas, cada una más rápida.',
       'SHOOTER', 'cyan', 'cover-galaga', 1, 1, '{keyboard}', '{CLÁSICO,FORMACIONES}', 4, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "accuracy", label: "ACIERTO %", color: "yellow", format: "int" }],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `player { x, alive, dual, invulnMs, respawnMs }`, `moveLeft`, `moveRight` (teclas mantenidas), `shots: { x, y }[]`, `enemyShots: { x, y, vx, vy }[]`, `enemies: { id, type: "bee" | "butterfly" | "boss", slot, hp, state: "waiting" | "entering" | "formation" | "diving" | "returning" | "beaming", pathT, x, y, vx, vy, diveId, firedAtMid, captive }[]`, `dives: Map<diveId, { bossId, escortIds, escortsKilled }>`, `captured: { bossId } | null` (caza capturado sobre un jefe), `beam { bossId, ms, phase } | null`, `explosions`, `labels`, `stars`, `stage`, `stageState: "intro" | "entry" | "attack" | "clear"`, `stageTimerMs`, `entryTimerMs`, `diveTimerMs`, `formationT`, `score`, `lives`, `nextExtraAt`, `shotsFired`, `shotsHit`, `lastAccuracy`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("accuracy", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("accuracy", 0)`.
- `onStat("accuracy", n)` con `n = Math.round(100 × shotsHit / shotsFired)` solo cuando cambia respecto a `lastAccuracy`. Un disparo doble cuenta como 2 disparos. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (un disparo por pulsación); el movimiento es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `moveLeft = moveRight = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Nave:** centro en `y = 600`, cuerpo 26×24 px, hitbox círculo de radio **10**. Velocidad **240 px/s**, `x` limitada a `[20, 460]` (doble: `[33, 447]`). En modo doble hay dos naves con centros en `x − 13` y `x + 13`, cada una con su hitbox.
- **Disparo propio:** proyectil 3×12 px a **600 px/s** hacia arriba desde la punta (`y = 588`). Máximo **2 disparos** (simple) o **4** (doble, 2 por nave) en pantalla; una pulsación con el cupo lleno se ignora y no cuenta en `shotsFired`. En doble, cada pulsación lanza 2 proyectiles a la vez. Se retira al salir por `y < 0` o al impactar.
- **Formación:** 10 columnas, `x = 240 + (col − 4.5) × 36` (de 78 a 402). Filas: fila 0 `y = 90` jefes en columnas 3–6 (4); filas 1–2 `y = 122, 154` mariposas en columnas 1–8 (16); filas 3–4 `y = 186, 218` abejas en columnas 0–9 (20). Total **40**. La formación entera oscila en horizontal `±16 px` con periodo **4 s** (`dx = 16 × sin(2π × formationT / 4000)`).
- **Entrada (estado `entry`):** 5 grupos de 8, el primero a los 1500 ms del inicio de fase y luego uno cada **1800 ms**; dentro del grupo un enemigo cada **120 ms**. Cada uno recorre su curva a **240 px/s** (parámetro `t` avanzado por longitud aproximada) y luego vuela en línea recta a **240 px/s** hasta su hueco; al llegar pasa a `formation`. Durante la entrada no disparan. Curvas (Bézier cúbicas P0, P1, P2, P3):
  - `A`: (200, −20), (200, 220), (40, 340), (120, 400).
  - `B`: (280, −20), (280, 220), (440, 340), (360, 400).
  - `C`: (−20, 560), (180, 520), (220, 300), (120, 260).
  - `D`: (500, 560), (300, 520), (260, 300), (360, 260).
  - Grupos: G1 = 4 mariposas fila 1 col 3–6 por `A` + 4 abejas fila 3 col 3–6 por `B` (intercaladas); G2 = 4 jefes + 4 mariposas fila 1 col 1, 2, 7, 8 por `C`; G3 = 8 mariposas fila 2 col 1–8 por `D`; G4 = 6 abejas fila 3 col 0, 1, 2, 7, 8, 9 + 2 abejas fila 4 col 0 y 9 por `A`; G5 = 8 abejas fila 4 col 1–8 por `B`.
- **Ataque (estado `attack`):** empieza cuando no quedan enemigos en `waiting`/`entering`. Cada `diveIntervalMs(stage) = max(700, 2200 − 150 × (stage − 1))` ms se lanza una picada si hay menos de `maxDivers(stage) = min(2 + floor(stage / 2), 6)` enemigos en picada y la nave está viva. Se elige al azar un enemigo en `formation`: si es jefe, se le asignan como escoltas hasta 2 mariposas en `formation` de las columnas `col − 1`, `col`, `col + 1` de la fila 1 (cuentan dentro del cupo).
- **Picada:** el enemigo hace un medio giro de radio **36 px** hacia el lado más cercano al borde (600 ms) y luego baja hacia la `x` que tenía la nave al lanzarse, a `diveSpeed(stage) = min(160 + 10 × (stage − 1), 260)` px/s, con zigzag senoidal de amplitud **40 px** y periodo **1.2 s** (solo mariposas y escoltas). Al salir por `y > 660` reaparece en `y = −20` sobre su hueco y vuelve a él a **240 px/s** (`returning` → `formation`).
- **Disparo enemigo:** cada enemigo en picada, al cruzar `y = 300` una sola vez, dispara con probabilidad `enemyFireChance(stage) = min(0.3 + 0.05 × (stage − 1), 0.7)`: abejas 1 proyectil, mariposas y jefes 2 (separados 150 ms), apuntados a la nave, a **260 px/s**, 4×10 px. Máximo **8** proyectiles enemigos en pantalla.
- **Jefe:** 2 impactos. El primero lo vuelve azul/morado (`hp 1`) sin puntos; el segundo lo destruye.
- **Puntos:** abeja **50** en formación / **100** en picada o entrada; mariposa **80** / **160**; jefe **150** en formación; jefe en picada **400** sin escoltas derribadas, **800** si se derribó 1 escolta antes que él, **1600** si se derribaron las 2. Los valores de jefe en picada se muestran como etiqueta efímera (600 ms) en el punto del impacto.
- **Rayo tractor:** cuando se elige un jefe para picar, si `captured === null`, la nave no es doble, está viva y no hay otro rayo, con probabilidad **0.35** hace picada de rayo (sin escoltas): baja en vertical hasta `y = 360` sobre la `x` de la nave al lanzarse (a `diveSpeed`), se detiene y emite un rayo trapezoidal de `y = 372` a `y = 640` (ancho 24 px arriba → **96 px** abajo) durante **3000 ms** (300 ms abriéndose, 2400 ms activo, 300 ms cerrándose). Si durante la fase activa `|player.x − boss.x| ≤ 48`, la nave es capturada: sube hasta el jefe en 1500 ms, se pierde una vida (`onLives(lives)`), y queda como caza capturado (rojo) 24 px sobre el jefe, que vuelve a su hueco. Si `lives` llega a 0 por la captura → game over. Si no captura, tras el rayo el jefe vuelve a su hueco. Derribar al jefe durante el rayo cancela el rayo.
- **Rescate y caza doble:** el jefe con caza capturado pica normalmente (con escoltas). Si se le derriba **en picada o en rayo**, el caza capturado desciende en 1000 ms hasta acoplarse a la derecha de la nave → `player.dual = true`. Si se le derriba en `formation`, el caza capturado se destruye sin puntos. Un disparo propio que impacta al caza capturado lo destruye sin puntos (`captured = null`). En doble, un impacto en una de las dos naves elimina solo esa nave (vuelve a simple, sin perder vida); el otro superviviente queda centrado en la `x` actual.
- **Muerte:** colisión de la hitbox de la nave con un enemigo (radio **12**) o un proyectil enemigo → explosión, `lives − 1` → `onLives(lives)`; el enemigo que choca también muere y da sus puntos. Si `lives === 0` → `onLives(0)` y `onGameOver(score)`. Si no, durante **2000 ms** no se lanzan picadas nuevas; la nave reaparece en `x = 240` con **1500 ms** de invulnerabilidad (parpadeo a 8 Hz).
- **Fin de fase:** al morir el último de los 40 (incluidos los que pican) → estado `clear`, se borran proyectiles enemigos, 2000 ms con texto `FASE N+1` centrado (blanco, 24 px monoespaciado) y empieza la siguiente fase con la formación completa: `stage + 1` → `onLevel(stage)`. El caza capturado, si existía, se pierde al limpiar la fase.
- **Vida extra:** al alcanzar **20000** y luego cada **70000** (90000, 160000, …) → `lives + 1` (máximo **5**) → `onLives(lives)`.
- **Dibujo:** fondo `#000008` con 60 estrellas de 1–2 px que bajan a 30–90 px/s y parpadean. Nave blanca con cabina `#00f5ff` y alerones rojos `#ff3355`. Abeja amarilla `#ffe600` con alas azules `#2a6bff`; mariposa roja `#ff3355` con alas blancas; jefe verde `#00ff88` (dañado `#8a5cff`) con alas amarillas; aleteo de 2 frames alternando cada 300 ms. Rayo: bandas horizontales `#00f5ff`/`#2a6bff` con alpha 0.5 que se desplazan. Disparo propio blanco; disparo enemigo `#ff3355`. Explosiones: 6 líneas radiales que crecen 0 → 18 px en 300 ms. Caza capturado rojo `#ff3355`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md`, `lib/games/snake/engine.ts` (patrón vigente) y el manejo de `Space` de `lib/games/asteroids/engine.ts`. Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/formation.ts`. Verificar: `npm run lint`; `SLOTS.length = 40` (4 jefes, 16 mariposas, 20 abejas); los 5 grupos cubren los 40 huecos sin repetir; `diveIntervalMs(1) = 2200`, `diveIntervalMs(11) = 700`, `maxDivers(1) = 2`, `maxDivers(9) = 6`, `diveSpeed(1) = 160`, `diveSpeed(20) = 260`, `enemyFireChance(9) = 0.7`.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): entrada de los 5 grupos, oscilación, cupo de 2 disparos, jefe con 2 impactos, picada de jefe con escoltas (800/1600), rayo tractor con captura (pierde vida) y sin captura, rescate y caza doble (4 disparos, perder una nave sin perder vida), fin de fase y `FASE 2`, vida extra a 20000, ACIERTO % en el HUD, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`FORMACIONES`, dificultad 4, color cyan, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven la nave a 240 px/s solo en horizontal, entre `x = 20` y `x = 460`; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio` (o `↑`/`W`) dispara un proyectil a 600 px/s; nunca hay más de 2 propios en pantalla (4 en doble); mantener pulsado no repite.
- [ ] Cada fase empieza con 40 enemigos (4 jefes, 16 mariposas, 20 abejas) que entran en 5 grupos de 8 por las curvas A/B/C/D y ocupan su hueco; la formación oscila ±16 px cada 4 s.
- [ ] Puntos: abeja 50/100, mariposa 80/160, jefe 150 en formación y 400/800/1600 en picada según escoltas derribadas antes; las etiquetas 400/800/1600 aparecen 600 ms.
- [ ] El jefe necesita 2 impactos; el primero cambia su color y no da puntos.
- [ ] En fase 1 se lanza una picada cada 2200 ms con máximo 2 en picada a 160 px/s; los que salen por abajo vuelven a su hueco desde arriba.
- [ ] El rayo tractor dura 3000 ms; con la nave a ≤ 48 px del jefe en la fase activa la captura, resta 1 vida y el caza rojo queda sobre el jefe.
- [ ] Derribar al jefe con caza capturado en picada o rayo acopla el caza (modo doble); en formación lo destruye. En doble, un impacto elimina una sola nave sin restar vida.
- [ ] Morir resta 1 vida, la nave reaparece en `x = 240` tras 2000 ms sin picadas nuevas y es invulnerable 1500 ms.
- [ ] Al destruir los 40 aparece `FASE N` 2000 ms y el nivel del HUD sube; la fase siguiente es más rápida (intervalo −150 ms, +10 px/s).
- [ ] Se gana una vida a los 20000 puntos y cada 70000 después, con máximo 5.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y ACIERTO % (redondeado, solo al cambiar); sin eventos por frame.
- [ ] Perder la última vida (por choque, disparo o captura) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] Pausa (botón y `P`) congela enemigos, disparos, rayo, estrellas y temporizadores; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, fase 1, ACIERTO oculto, nave simple en `x = 240`, sin caza capturado ni proyectiles).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; `prod-setup.md` registra la migración.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade original; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** formación fija de 40 con entrada por grupos y picadas; es la identidad de Galaga y la diferencia central con la variante 02.
- **Sí:** rayo tractor, rescate y caza doble; **No:** caza capturado hostil en formación (complica la IA sin aportar al leaderboard).
- **Sí:** cupo de 2 disparos y movimiento solo horizontal (fiel al original); **No:** auto-disparo ni movimiento vertical.
- **Sí:** puntos clásicos (50/80/150 y 100/160/400/800/1600); **No:** inventar otra tabla.
- **Sí:** `initialLives: 3`, `showLevel: true` (fase) y stat `ACIERTO %` (métrica clásica del resumen de Galaga, emitida solo al cambiar).
- **No:** fases de desafío; aumentan mucho el alcance (otras trayectorias y bonus) y quedan para un spec propio.
- **Sí:** vida extra a 20000 y cada 70000 (máx. 5), como el ajuste de fábrica del arcade.
- **Sí:** valores de balance (velocidades, intervalos, probabilidades, radios) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 480×640 vertical, como el monitor girado del arcade.
- **Sí:** `cat` SHOOTER y color cyan; **Sí:** `.cover-galaga` nueva (`.cover-invaders` es de otro juego).
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por los specs de `missile-command`.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                | Mitigation                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| La máquina de estados por enemigo (entrada, formación, picada, rayo, vuelta) se enreda. | `state` explícito con una función de actualización por estado; trayectorias y balance puros en `formation.ts`.   |
| Avance por Bézier con `t` lineal da velocidades desiguales en la curva.            | Aproximar longitud con 20 segmentos precomputados por curva y avanzar `t` por distancia.                          |
| Captura con la última vida termina la partida de forma confusa.                    | Regla explícita: la captura resta vida y, si llega a 0, `onLives(0)` → `onGameOver`; criterio de aceptación.       |
| Estado del caza doble inconsistente al morir, rescatar o limpiar fase.              | `captured` y `player.dual` se resetean en un solo helper (`resetPlayer`/`clearStage`) usado por todos los caminos. |
| `dt` grande tras pausar o cambiar de pestaña lanza picadas o rayos de golpe.        | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; temporizadores solo avanzan en juego.         |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                  | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| Movimiento "pegado" tras perder foco.                                               | `blur` y `pause` ponen `moveLeft`/`moveRight` a `false`.                                                           |
| Doble loop / listeners por StrictMode.                                              | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| Next 16 difiere del conocimiento previo.                                            | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Fases de desafío y bonus de "perfect".
- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Caza capturado hostil, enemigos transformables, power-ups, auto-disparo y movimiento vertical.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
