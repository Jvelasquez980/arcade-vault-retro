# SPEC GJ-galaga-02 — Juego real: GALAGA (variante: enjambre contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-20
> **Variant:** 02 de 2 — Contrarreloj moderno: 90 s de escuadrones continuos, nave con movimiento 2D y disparo automático, power-ups de arma y multiplicador de combo; sin vidas, cada impacto cuesta tiempo.
> **Objective:** Crear un motor TypeScript de Galaga (variante enjambre contrarreloj) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Galaga. Conserva la identidad visual (insectos alienígenas que vuelan en escuadrón por curvas y se lanzan en picada) pero cambia el bucle: **no hay formación ni fases**; los **escuadrones** entran de forma continua siguiendo 4 plantillas de trayectoria y salen de la pantalla si no se derriban. La partida dura un **reloj de 90 s**: no hay vidas, **cada impacto resta 5 s** y rompe el combo; derribar escuadrones completos suma tiempo. La nave se mueve en **2D** dentro de una franja inferior y **dispara sola** mientras se mantiene `Espacio`; las **cápsulas** de arma (doble, abanico, ráfaga) y de reloj cambian el ritmo. Un **multiplicador de combo** (×1 a ×5) concentra el reto en no fallar ni dejar pasar tiempo sin derribos. Se distingue de la variante 01 (clásico fiel: fases de 40 con formación, picadas, rayo tractor, nave doble, fases de desafío, 3 vidas y disparo por pulsación).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`); todo se dibuja con polígonos, arcos y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y missile-command = 6 reservado por sus specs propuestos), dificultad 3, tags `CONTRARRELOJ` y `COMBOS`, 1 jugador, teclado. Canvas **480×720** (2:3). **Sin vidas** (no se declara `initialLives`), **nivel** = oleada (`showLevel: true`), stats extra `TIEMPO` (restante) y `MULTIPLICADOR`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/waves.ts`: funciones puras y constantes: `PATHS` (4 plantillas `(t, side) → {x, y}`), `squadronFor(wave, rand)` (tipo, tamaño, plantilla, lado), `spawnIntervalMs(wave)`, `enemySpeed(wave)`, `enemyBulletSpeed(wave)`, `multiplier(combo)`, `rollDrop(kind, rand)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawShip` (con escudo de invulnerabilidad), `drawDrone`, `drawWing` (sano/dañado), `drawBoss` (barra de vida), `drawCapsule`, `drawBullet`, `drawExplosion`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg,#1a0030,#0a0a18)` con `::before` de una estela de 6 puntos magenta en curva (escuadrón) y `::after` de una nave cyan con dos líneas de disparo amarillas.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×720**.
- HUD de React: puntaje, **nivel** (oleada) y stats extra `time` ("TIEMPO", `seconds`) y `mult` ("MULTIPLICADOR", `int`). Sin vidas.
- Sin HUD nativo de texto en el canvas, salvo efectos de juego: barra de duración del arma activa (4 px bajo la nave), barra de vida del jefe y textos flotantes `+N`, `+3s`, `−5s`, `ESCUADRÓN` (800 ms).
- Controles: `←↑→↓` y `WASD` mueven la nave; mantener `Espacio` dispara de forma automática. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Formación fija, fases, rayo tractor, nave doble, fases de desafío y vidas.
- Bombas, escudos recogibles o armas distintas a las 3 del spec.
- Selector de duración o dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Noventa segundos contra el enjambre.',
       'Mueve tu nave en todas direcciones con las flechas o WASD y mantén Espacio para disparar sin parar. Los escuadrones alienígenas llegan sin descanso: derríbalos seguidos para subir el multiplicador hasta ×5 y acaba con escuadrones completos para ganar tiempo. Recoge cápsulas de doble disparo, abanico y ráfaga. Cada golpe te quita cinco segundos; la partida termina cuando el reloj llega a cero.',
       'ARCADE', 'magenta', 'cover-galaga', 1, 1, '{keyboard}', '{CONTRARRELOJ,COMBOS}', 3, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 720,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "mult", label: "MULTIPLICADOR", color: "magenta", format: "int" },
      ],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ship { x, y, invulnMs }`, `keys { up, down, left, right, fire }`, `fireCooldownMs`, `weapon: "single" | "double" | "spread" | "rapid"`, `weaponMs`, `bullets: { x, y, vx, vy }[]`, `enemyBullets: { x, y, vx, vy }[]`, `squadrons: Map<id, { size, killed, escaped, wave }>`, `enemies: { kind: "drone" | "wing" | "boss", hp, squadronId, path, side, t, delayMs, x, y, fireMs }[]`, `capsules: { kind: "double" | "spread" | "rapid" | "clock", x, y }[]`, `popups`, `explosions`, `stars`, `remainingMs`, `elapsedMs`, `wave`, `spawnTimer`, `combo`, `comboIdleMs`, `score`, `lastSecondEmitted`, `lastMultEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel` (oleada), `onStat("time", s)`, `onStat("mult", m)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 90)`, `onStat("mult", 1)`. No se emite `onLives` (no hay vidas).
- `onStat("time", s)` con `s = Math.ceil(remainingMs / 1000)` y solo cuando cambia ese entero (incluidos saltos por `+3s`/`−5s`). `onStat("mult", m)` solo cuando cambia `multiplier(combo)`.
- Game over: al llegar `remainingMs` a 0 se emite `onStat("time", 0)` (oculta el stat, esperado) y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. Como no hay vidas, no aplica `onLives(0)`; el orden `onLives(0)` → `onGameOver` del contrato no se rompe porque `onLives` nunca se emite.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Las teclas se tratan como mantenidas (`e.repeat` se ignora: no altera el estado).
- Pausa/blur/destroy ponen todas las `keys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Reloj:** `remainingMs` empieza en **90000** y baja con `dt` solo en juego (no en pausa). Tope **120000**.
- **Nave:** centro inicial (240, 640), cuerpo 26×24 px, hitbox 16×16 centrada. Movimiento 2D a **280 px/s** (diagonal normalizada), `x` limitada a `[20, 460]` e `y` a `[500, 696]`.
- **Disparo automático:** mientras `Espacio` está pulsado y `fireCooldownMs ≤ 0` se dispara y `fireCooldownMs` = cadencia del arma. Bala 3×10 px a **620 px/s**; se elimina al salir por arriba. Armas:
  - `single` (por defecto): 1 bala vertical, cadencia **160 ms**.
  - `double`: 2 balas verticales a `x ± 8`, cadencia 160 ms, dura **10 s**.
  - `spread`: 3 balas a −12°, 0° y +12°, cadencia 200 ms, dura **8 s**.
  - `rapid`: 1 bala vertical, cadencia **80 ms**, dura **8 s**.
  - Recoger un arma la sustituye y reinicia su duración; al agotarse vuelve a `single`.
- **Enemigos** (velocidad sobre la trayectoria `enemySpeed(wave) = min(160 + 8 × (wave − 1), 300)` px/s):
  - `drone`: 1 impacto, **20** puntos base, 20×16 px, no dispara.
  - `wing`: 2 impactos (al primero cambia a color dañado), **50** base, 24×20 px, dispara una bala apuntada a la nave cada `1800 ± 400` ms mientras `y < 480`.
  - `boss`: 6 impactos, **300** base, 34×28 px, dispara 3 balas en abanico (−15°, 0°, +15° respecto a la dirección a la nave) cada **1200 ms** mientras `y < 480`; siempre suelta una cápsula de arma al morir.
  - Bala enemiga 4×8 px a `enemyBulletSpeed(wave) = min(240 + 5 × (wave − 1), 340)` px/s. Máximo **12** simultáneas (las que excedan no se crean).
- **Trayectorias** (`PATHS`, parametrizadas por distancia recorrida; `side` = +1 izquierda→derecha, −1 en espejo):
  - `S`: entra por arriba en `x = 80` (o 400), desciende en zigzag sinusoidal de amplitud 140 px y período vertical 240 px hasta salir por abajo (`y > 740`).
  - `loop`: entra por el lateral en `y = 160`, cruza hasta el centro, describe un círculo completo de radio **90 px** con centro (240, 260) y sale por el lateral opuesto.
  - `dive`: entra por arriba en `x = 120` (o 360), baja hasta `y = 200`, y desde ahí va en línea recta hacia la posición que tenía la nave en ese instante, continuando hasta salir por abajo.
  - `zigzag`: entra por el lateral en `y = 100` y cruza la pantalla de lado a lado 3 veces bajando 120 px por cruce, luego sale por el lateral.
  - Dentro del escuadrón cada miembro sale con `delayMs = 180 × índice` sobre la misma trayectoria.
- **Escuadrones:** `squadronFor(wave)`: plantilla `PATHS[(wave − 1) % 4]`, lado alterno (impar izquierda, par derecha). Tamaño `min(6 + floor((wave − 1) / 2), 10)`. Composición: oleadas 1–2 solo `drone`; desde la 3, el 30 % (redondeado hacia abajo) son `wing` en posiciones finales; cada oleada múltiplo de **5** es un escuadrón de jefe: 1 `boss` en trayectoria `loop` (repite el círculo 2 veces) más 4 `wing` de escolta.
- **Oleada / aparición:** el primer escuadrón sale a los 1000 ms. Luego un escuadrón nuevo cada `spawnIntervalMs(wave) = max(1500, 4000 − 150 × (wave − 1))` ms, con máximo **3** escuadrones en pantalla (si hay 3, se espera a que uno termine). Cada escuadrón lanzado incrementa `wave` → `onLevel(wave)` (el escuadrón lleva el número de oleada con que se generó).
- **Combo y multiplicador:** cada derribo `combo += 1` y `comboIdleMs = 0`. `multiplier(combo) = min(1 + floor(combo / 8), 5)`. El combo vuelve a 0 si pasan **2500 ms** sin derribos o si la nave recibe un impacto.
- **Puntos:** derribo = `base × multiplier(combo)` calculado después de sumar el derribo al combo. Escuadrón completo (todos sus miembros derribados por el jugador, ninguno escapó): **+200 × multiplicador** y **+3 s** de reloj, texto `ESCUADRÓN`. Un miembro que sale de pantalla marca el escuadrón como incompleto (sin penalización de tiempo).
- **Cápsulas:** al morir un `drone` o `wing`, probabilidad **0.10** de soltar cápsula; el `boss` siempre suelta una de arma. Sorteo: `double` 35 %, `spread` 25 %, `rapid` 25 %, `clock` 15 % (`boss`: solo entre las 3 de arma, 1/3 cada una). Cápsula 18×18 px que cae a **120 px/s**; se recoge al tocar la hitbox de la nave; desaparece al salir por abajo. `clock` suma **+5 s**. Recoger cualquier cápsula da +**50** puntos (sin multiplicador).
- **Impacto en la nave:** bala enemiga o colisión con un enemigo (si la nave no es invulnerable) → `remainingMs −= 5000` (mínimo 0), combo a 0, texto `−5s`, se borran las balas enemigas y **1200 ms** de invulnerabilidad (escudo parpadeante cada 100 ms). La nave no desaparece. En una colisión el enemigo recibe 1 impacto (puede morir y puntúa normalmente).
- **Fin:** cuando `remainingMs` llega a 0 → `onStat("time", 0)` y `onGameOver(score)` en el mismo frame. No hay otra forma de perder.
- **Estrellas:** 80 estrellas de 1–2 px, velocidad vertical **40–140 px/s**, reaparecen arriba; no se mueven en pausa ni tras game over.
- **Dibujo:** fondo `#05000f` con gradiente a `#14002a` abajo; estrellas blancas/magenta con alfa 0.3–1. Nave `#ffffff` con cabina `#00f5ff` y propulsor `#ff2bd6` parpadeante; escudo: círculo `rgba(0,245,255,0.5)` de radio 20. Drone `#ffe600`, wing `#ff2bd6` (dañado `#b14cff`), boss `#00ff88` con barra de vida 34×3 px encima. Balas propias `#ffffff`, enemigas `#ff3355`. Cápsulas: círculo con letra `D`/`A`/`R`/`T` (doble/abanico/ráfaga/tiempo) en `#00f5ff`/`#ffe600`/`#ff2bd6`/`#00ff88`. Barra del arma activa bajo la nave, ancho proporcional a `weaponMs`. Explosión: 10 partículas que se alejan 0 → 22 px en 350 ms. Textos flotantes 14 px monoespaciado, suben 24 px y se desvanecen en 800 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/waves.ts`. Verificar: `npm run lint`; `spawnIntervalMs(1) = 4000`, `spawnIntervalMs(30) = 1500`; `enemySpeed(1) = 160`, `enemySpeed(30) = 300`; `enemyBulletSpeed(1) = 240`, `enemyBulletSpeed(40) = 340`; `multiplier(0) = 1`, `multiplier(8) = 2`, `multiplier(100) = 5`; `squadronFor(1)` = 6 drones en `S`; `squadronFor(5)` = 1 boss + 4 wing.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): movimiento 2D en la franja, disparo automático mantenido, las 4 trayectorias, escuadrón completo (+3 s y bonus), escuadrón incompleto, combo hasta ×2 y caída tras 2500 ms, las 4 cápsulas y su caducidad, jefe en la oleada 5, impacto (−5 s, escudo), reloj a 0 y modal, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`COMBOS`, dificultad 3, color magenta, categoría ARCADE).
- [ ] `/games/galaga/jugar` muestra el canvas 2:3 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven la nave a 280 px/s (diagonal normalizada) dentro de `x ∈ [20, 460]`, `y ∈ [500, 696]`; las flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara cada 160 ms con el arma básica; soltar detiene el fuego.
- [ ] Las cápsulas `D` (2 balas, 10 s), `A` (3 balas a ±12°, 8 s), `R` (cada 80 ms, 8 s) y `T` (+5 s) funcionan; al caducar el arma vuelve a la básica; cada cápsula suma 50.
- [ ] Los escuadrones siguen las plantillas `S`, `loop`, `dive` y `zigzag` en ese orden, alternando lado, con 6 miembros al inicio y hasta 10.
- [ ] Nunca hay más de 3 escuadrones en pantalla; el intervalo baja de 4000 ms a un mínimo de 1500 ms y la oleada del HUD sube con cada escuadrón lanzado.
- [ ] Drone 20, wing 50 (2 impactos), boss 300 (6 impactos, oleadas 5, 10…) × multiplicador; el boss siempre suelta un arma.
- [ ] El multiplicador del HUD sube a ×2 a los 8 derribos seguidos, ×3 a los 16… con tope ×5, y vuelve a ×1 tras 2500 ms sin derribos o al recibir un impacto.
- [ ] Derribar un escuadrón completo suma 200 × multiplicador y +3 s (texto `ESCUADRÓN`); si un miembro escapa no hay bonus.
- [ ] Un impacto resta 5 s, borra las balas enemigas y da 1200 ms de invulnerabilidad visible; la nave no desaparece.
- [ ] TIEMPO empieza en 90, baja 1 por segundo de juego, nunca supera 120 y se actualiza al instante con `+3s`/`+5s`/`−5s`.
- [ ] Al llegar el reloj a 0 se emite `onGameOver` y abre el modal con el puntaje correcto; nunca se emite `onLives`.
- [ ] El HUD de React refleja puntaje, nivel (oleada), TIEMPO y MULTIPLICADOR, sin bloque de vidas; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, nave, enemigos, balas, cápsulas, duración del arma, combo y estrellas; reanudar sin salto de tiempo ni teclas pegadas.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 90, oleada 1, ×1, arma básica, nave en (240, 640), sin enemigos, balas ni cápsulas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** reloj de 90 s como único fin de partida y sin vidas; partidas de duración acotada y puntajes comparables. **No:** `initialLives` (el HUD no muestra vidas).
- **Sí:** impacto = −5 s + combo a 0; castiga sin cortar la partida de golpe.
- **Sí:** escuadrones continuos con 4 plantillas de trayectoria; **No:** formación fija, fases ni rayo tractor (son de la variante 01).
- **Sí:** movimiento 2D en franja inferior y disparo automático; adaptan el juego a una sesión intensa de teclado. **No:** límite de balas en pantalla.
- **Sí:** 3 armas temporales + cápsula de reloj; **No:** bombas, escudos recogibles ni mejoras permanentes.
- **Sí:** multiplicador ×1–×5 por combo (cada 8 derribos) y bonus por escuadrón completo; amplían el rango del leaderboard y premian no fallar.
- **Sí:** `showLevel` con la oleada (escuadrones lanzados) como medida de progreso; stats `TIEMPO` y `MULTIPLICADOR`.
- **Sí:** valores de balance (90 s, −5 s, +3 s, tope 120 s, velocidades, intervalos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta; **Sí:** `.cover-galaga` nueva.
- **Sí:** canvas 480×720 (2:3) para dar recorrido vertical a escuadrones y a la franja de movimiento.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                        | Mitigation                                                                                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Disparo automático + `rapid` + `spread` generan muchas balas y colisiones por frame.        | Balas eliminadas al salir; como máximo ~3 escuadrones de 10; colisión AABB simple; verificar oleada 20+ en el paso 6.  |
| El jugador acumula tiempo indefinidamente con `+3s`/`+5s`.                                   | Tope de 120 s en el reloj; probabilidad de `clock` 15 % de un 10 %.                                                    |
| Emitir `onStat("time")` por frame satura React.                                             | Emitir solo cuando cambia `Math.ceil(remainingMs / 1000)`.                                                            |
| HUD sin vidas confunde a `GamePlayer` o rompe el orden de eventos de game over.             | No declarar `initialLives` ni emitir `onLives` (contrato opcional); `onGameOver` sigue siendo el único fin.           |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o salta trayectorias.            | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; el reloj solo avanza en juego.                    |
| Flechas, WASD o espacio interfieren con el input del modal.                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                  |
| Teclas "pegadas" (disparo o movimiento continuo) tras perder foco.                          | `blur` y `pause` ponen todas las `keys` a `false`.                                                                    |
| Doble loop / listeners por StrictMode.                                                      | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                |
| Next 16 difiere del conocimiento previo.                                                    | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                       |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Formación fija, fases, rayo tractor, nave doble, fases de desafío y vidas.
- Bombas, escudos recogibles, armas adicionales o mejoras permanentes.
- HUD nativo de texto dentro del canvas (salvo textos flotantes y barras de juego) y overlays de pausa/game over.
- Selector de duración, dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
