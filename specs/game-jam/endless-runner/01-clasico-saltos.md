# SPEC GJ-endless-runner-01 — Juego real: ENDLESS RUNNER (variante: clásico de saltos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-23
> **Variant:** 01 de 2 — Runner clásico de vista lateral en un solo carril: saltar y agacharse para esquivar cactus y aves, velocidad creciente, una vida y puntaje por distancia.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante clásico de saltos) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Endless Runner. Es el runner minimalista de vista lateral: el corredor queda fijo en x y el mundo se desplaza hacia la izquierda cada vez más rápido. Solo hay dos acciones, **saltar** (con altura variable según cuánto se mantiene la tecla) y **agacharse** (o caída rápida en el aire). Hay **una sola vida**: el primer choque termina la partida. El puntaje es la distancia recorrida; no hay monedas, power-ups ni carriles. Se distingue de la variante 02 (vista cenital con 3 carriles, cambio de carril, monedas, power-ups y 3 vidas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 2, tags `CLÁSICO` y `SALTOS`, 1 jugador, teclado. Canvas **800×300** (8:3). **1 vida** (`initialLives: 1`), **nivel** derivado del puntaje (`showLevel: true`), stat extra `TIEMPO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/balance.ts`: funciones puras (`speedAt(elapsedMs)`, `levelFor(score)`, `gapRange(speed)`, `rollObstacle(level, rand)`) y constantes (`GROUND_Y`, `RUNNER_X`, `GRAVITY`, `JUMP_VY`, `JUMP_CUT_VY`, `OBSTACLES`).
- Módulo `lib/games/endless-runner/draw.ts`: `drawSky`, `drawClouds`, `drawGround`, `drawRunner` (de pie, corriendo con 2 poses de pierna, agachado, en el aire), `drawCactus`, `drawBird` (2 poses de ala) con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: fondo `linear-gradient(180deg,#0a0a18 0 72%,#06202a 72% 100%)` con `::after` que dibuja la línea de suelo cyan, una silueta de corredor cyan en el aire y dos cactus verdes, con `filter: drop-shadow(0 0 6px rgba(0,245,255,0.6))`.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **800×300**.
- HUD de React: puntaje, **1 vida**, **nivel**, stat extra `time` ("TIEMPO", `seconds`).
- Sin HUD nativo de texto en el canvas.
- Controles: `Espacio`, `↑` o `W` saltan (mantener = salto más alto); `↓` o `S` agachan en el suelo y aceleran la caída en el aire. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Monedas, power-ups, carriles, doble salto, vidas extra.
- Ciclo día/noche, selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('endless-runner', 'ENDLESS RUNNER', 'Salta, agáchate y corre sin parar.',
       'Corre por un desierto infinito que se acelera cada segundo. Salta con Espacio, flecha arriba o W (mantén pulsado para saltar más alto) y agáchate con flecha abajo o S para pasar bajo las aves. Un solo choque termina la carrera: cuanto más lejos llegues, más puntos.',
       'ARCADE', 'cyan', 'cover-endless-runner', 1, 1, '{keyboard}', '{CLÁSICO,SALTOS}', 2, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 800, height: 300,
      initialLives: 1,
      showLevel: true,
      stats: [{ key: "time", label: "TIEMPO", color: "cyan", format: "seconds" }],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `runner { y, vy, onGround, crouching, legPhaseMs }`, `jumpHeld`, `downHeld`, `jumpBufferMs`, `obstacles: { kind: "small" | "large" | "bird", x, y, w, h, count, flapMs }[]`, `nextGapPx`, `distancePx`, `speed`, `clouds: { x, y, w }[]`, `groundOffset`, `elapsedMs`, `score`, `level`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 0)`.
- `onScore` solo cuando cambia `score` (que sube a pasos de 1 cada 40 px, ver reglas); `onStat("time", s)` solo cuando cambia `Math.floor(elapsedMs / 1000)`. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en `Espacio`, `↑` y `↓` solo con el juego activo y sin pausa. El salto ignora `e.repeat` (un salto por pulsación); agacharse es continuo mientras se mantiene `↓`/`S`.
- Pausa/blur/destroy ponen `jumpHeld = downHeld = false` y `crouching = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** suelo en `GROUND_Y = 250` (línea de 2 px); franja de suelo de 250 a 300 con puntos de polvo que se desplazan a la velocidad del mundo. Nubes (3 a la vez, 60–110 px de ancho, `y` en 40–120) se desplazan a **0.2 × speed** y reaparecen por la derecha.
- **Corredor:** borde izquierdo fijo en `RUNNER_X = 100`. De pie / en el aire: **40×48 px**. Agachado (solo en el suelo): **56×28 px**. Su base es `y` (en el suelo, `y = 250`). Piernas alternan pose cada **100 ms** en el suelo.
- **Salto:** solo desde el suelo. `vy = JUMP_VY = −780 px/s`; gravedad `GRAVITY = 2400 px/s²` (altura máxima ≈ 127 px, tiempo de vuelo 650 ms). **Salto variable:** si se suelta la tecla de salto con `vy < −300`, `vy = JUMP_CUT_VY = −300`. **Buffer:** una pulsación en el aire a ≤ **100 ms** de aterrizar se ejecuta al tocar el suelo.
- **Agacharse / caída rápida:** con `↓`/`S` mantenido en el suelo el corredor queda agachado; en el aire la gravedad pasa a **3 × 2400 = 7200 px/s²** mientras se mantiene. Saltar estando agachado está permitido (se levanta y salta).
- **Velocidad del mundo:** `speed = min(360 + 8 × elapsedMs / 1000, 900)` px/s (tope a los 67,5 s).
- **Puntaje:** `score = Math.floor(distancePx / 40)` (9 pts/s al inicio, 22,5 pts/s al tope). No hay otras fuentes de puntos.
- **Nivel:** `level = 1 + Math.floor(score / 250)` (sin tope). Al subir: `onLevel(level)`. El nivel no cambia la velocidad (esta depende del tiempo); desbloquea aves.
- **Obstáculos** (todos con base apoyada según su tipo, entran por `x = 820`):
  - `small` (cactus pequeño): grupo de `count` 1–3 (equiprobable) de **20×40 px** separados 4 px; base en `y = 250`.
  - `large` (cactus grande): grupo de `count` 1–2 (equiprobable) de **30×60 px** separados 4 px; base en `y = 250`.
  - `bird` (ave, desde nivel 2): **46×30 px**, se mueve a `speed + 60` px/s, alas alternan cada 150 ms. Altura equiprobable por la base: **baja** `y = 246` (hay que saltar), **media** `y = 214` (hay que agacharse o saltar alto), **alta** `y = 170` (pasa sobre el corredor de pie; golpea si se salta).
  - Sorteo `rollObstacle`: nivel 1 → `small` 0.6, `large` 0.4. Nivel ≥ 2 → `small` 0.45, `large` 0.30, `bird` 0.25.
- **Separación:** tras crear un obstáculo se sortea `nextGapPx` uniforme en `gapRange(speed) = [0.75 × speed, 1.5 × speed]` px; el siguiente nace cuando el borde derecho del último ha avanzado `nextGapPx` desde `x = 820`. El primer obstáculo aparece tras **1500 ms** de juego.
- **Colisión:** AABB con las cajas del corredor y del obstáculo reducidas **4 px** por lado (cada cactus del grupo es una caja). Cualquier contacto → game over.
- **Game over:** `onLives(0)` y `onGameOver(score)` inmediatamente; el corredor se dibuja en pose de choque (ojos `×`).
- **Tiempo:** `elapsedMs` suma `dt` solo en juego (no en pausa ni tras game over). Los obstáculos que salen por `x + w < 0` se eliminan.
- **Dibujo:** cielo `#05050f` con gradiente a `#0a1a2a` en el horizonte; nubes `rgba(255,255,255,0.12)`. Suelo `#06202a` con línea `#00f5ff` y polvo `rgba(0,245,255,0.35)`. Corredor `#00f5ff` con ojo `#05050f`. Cactus `#00ff88` con borde `#008844`. Aves `#ff2bd6`. Todo desde `PALETTE`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/endless-runner/balance.ts`. Verificar: `npm run lint`; `speedAt(0) = 360`, `speedAt(30000) = 600`, `speedAt(120000) = 900`, `levelFor(249) = 1`, `levelFor(250) = 2`, `gapRange(400) = [300, 600]`, `rollObstacle(1, …)` nunca devuelve `bird`.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): salto corto y largo, buffer de salto, agacharse bajo el ave media, caída rápida, ave alta pasa de pie, aves solo desde 250 puntos, aceleración visible, choque → game over con 1 vida, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`SALTOS`, dificultad 2, color cyan, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas 8:3 sin desborde a 375 px y 1280 px.
- [ ] `Espacio`, `↑` y `W` saltan solo desde el suelo; mantener pulsado no repite el salto; `Espacio`, `↑` y `↓` no hacen scroll.
- [ ] Un toque breve da un salto bajo (corte a −300 px/s) y mantener da el salto completo (≈ 127 px, 650 ms).
- [ ] Pulsar salto ≤ 100 ms antes de aterrizar salta al tocar el suelo.
- [ ] `↓`/`S` en el suelo agacha al corredor (56×28) y permite pasar bajo el ave media; en el aire acelera la caída.
- [ ] La velocidad empieza en 360 px/s, sube 8 px/s por segundo y se fija en 900 px/s.
- [ ] El puntaje sube 1 punto cada 40 px recorridos; el nivel sube cada 250 puntos.
- [ ] En nivel 1 solo hay cactus; desde nivel 2 aparecen aves a tres alturas y el ave alta no golpea al corredor de pie.
- [ ] La separación entre obstáculos está entre 0,75 y 1,5 segundos de recorrido; el primero aparece a los 1,5 s.
- [ ] Un choque emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel y TIEMPO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela mundo, corredor y TIEMPO; reanudar sin salto de tiempo ni agachado residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`, espacio) no salta ni agacha.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vida 1, nivel 1, TIEMPO 0, velocidad 360, sin obstáculos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista lateral y un solo carril con dos acciones (saltar/agacharse); es la diferencia central con la variante 02. **No:** carriles ni cambio de carril.
- **Sí:** salto variable y buffer de 100 ms; dan control fino con teclado sin añadir acciones.
- **Sí:** 1 vida; partidas cortas y tensas. **No:** vidas extra, escudos ni invulnerabilidad.
- **Sí:** puntaje solo por distancia (1 punto cada 40 px); **No:** monedas ni multiplicadores.
- **Sí:** velocidad por tiempo y nivel por puntaje (desbloquea aves); **No:** pausas entre niveles.
- **Sí:** stat `TIEMPO`; es la métrica natural de supervivencia.
- **Sí:** valores de balance (gravedad, salto, velocidades, separación, tamaños) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color cyan; **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 800×300 (8:3); un runner lateral necesita ver lejos en horizontal.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Combinaciones imposibles (ave baja justo tras cactus grande a 900 px/s).               | Separación mínima 0,75 s de recorrido (> 650 ms de vuelo); verificar a velocidad tope en el paso 6.            |
| Canvas 8:3 queda muy bajo en móvil (≈ 140 px a 375 px).                                 | Formas grandes y contrastadas; táctil y ajuste móvil quedan para `mobile-porter`.                              |
| Colisiones injustas por cajas exactas.                                                 | Cajas reducidas 4 px por lado; verificar roces visuales en el paso 6.                                          |
| `onScore` demasiado frecuente satura React.                                            | Puntaje a pasos de 40 px (máx. 22,5 cambios/s) y emisión solo al cambiar.                                      |
| `dt` grande tras pausar o cambiar de pestaña atraviesa obstáculos o salta el tiempo.   | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `elapsedMs` solo avanza en juego.         |
| Agachado "pegado" tras perder foco.                                                    | `blur` y `pause` ponen `downHeld`, `jumpHeld` y `crouching` a `false`.                                         |
| Flechas, `W`/`S` o espacio interfieren con el input del modal.                          | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración con `_` en el nombre.  |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Monedas, power-ups, carriles, doble salto y vidas extra.
- Ciclo día/noche y escenarios alternativos.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
