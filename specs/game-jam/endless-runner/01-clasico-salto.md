# SPEC GJ-endless-runner-01 — Juego real: ENDLESS RUNNER (variante: clásico de salto) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-03
> **Variant:** 01 de 2 — Runner lateral de un botón: saltar (con altura variable) y agacharse para esquivar cactus y aves a velocidad creciente; 1 vida y el puntaje es la distancia.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante clásico de salto) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Endless Runner. Es la lectura **minimalista y fiel al género** (estilo "dino sin conexión"): vista lateral, el corredor está fijo en `x = 80` y el mundo se desplaza hacia la izquierda; solo hay dos acciones, **saltar** (más alto si se mantiene la tecla) y **agacharse** (también acelera la caída en el aire). **Una sola vida**, sin monedas ni power-ups: el puntaje es exclusivamente la **distancia en metros**. La dificultad sale de la velocidad continua y de la aparición de aves a distintas alturas. Se distingue de la variante 02 (vista cenital con 3 carriles, cambio de carril, monedas con combo, power-ups, 3 vidas y zonas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencias vigentes: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `6` queda reservado por las variantes propuestas de `missile-command`), dificultad 2, tags `CLÁSICO` y `CORRER`, 1 jugador, teclado. Canvas **800×320** (5:2). **1 vida** (`initialLives: 1`), sin nivel, stat extra `VELOCIDAD`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/physics.ts`: constantes (`GROUND_Y`, `PLAYER_X`, tamaños, gravedades, `PX_PER_M`) y funciones puras `speedAt(meters)`, `gapRange(speed)`, `rollObstacle(meters, rand)`, `stepPlayer(player, input, dtMs)` y `hit(a, b)` (AABB con márgenes).
- Módulo `lib/games/endless-runner/draw.ts`: `drawSky`, `drawParallax`, `drawGround`, `drawRunner` (corriendo / saltando / agachado), `drawCactus`, `drawBird` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: fondo `linear-gradient(180deg,#05000f 0 70%,#0a0a18 70% 100%)`, `::after` con línea de suelo cyan (`#00f5ff`, 2 px, al 70 %) y silueta rectangular del corredor, `::before` con dos cactus magenta (`#ff2bd6`) de alturas distintas.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **800×320**.
- HUD de React: puntaje (metros), **1 vida** (baja a 0 al morir) y stat extra `speed` ("VELOCIDAD", `int`). Sin nivel.
- Sin HUD nativo de texto en el canvas: solo cielo, suelo, corredor y obstáculos.
- Controles: `Espacio`, `↑` y `W` saltan (mantener = salto más alto); `↓` y `S` agachan en el suelo y aceleran la caída en el aire. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Monedas, power-ups, vidas extra, carriles, ciclo día/noche, niveles o zonas.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('endless-runner', 'ENDLESS RUNNER', 'Salta, agáchate y corre sin parar.',
       'Corre por un desierto neón infinito: salta con Espacio, las flechas o W (mantén para llegar más alto) y agáchate con abajo o S para esquivar cactus y aves. La velocidad no deja de subir y un solo choque termina la carrera; cada metro recorrido es un punto.',
       'ARCADE', 'cyan', 'cover-endless-runner', 1, 1, '{keyboard}', '{CLÁSICO,CORRER}', 2, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 800, height: 320,
      initialLives: 1,
      stats: [{ key: "speed", label: "VELOCIDAD", color: "cyan", format: "int" }],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `player { y, vy, onGround, ducking, holdMs }`, `jumpHeld`, `downHeld`, `obstacles: { kind: "small" | "big" | "group" | "bird", x, y, w, h, n?, birdHeight?, flapMs }[]`, `nextGap`, `distancePx`, `meters`, `speed`, `score`, `lastEmittedScore`, `scoreEmitMs`, `lastSpeedStat`, `parallaxX`, `groundX`, `runAnimMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("speed", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("speed", 36)`.
- `onScore` se emite solo si el puntaje cambió y como máximo una vez cada **100 ms** (`scoreEmitMs`); al morir se emite el valor final antes de `onLives(0)`. `onStat("speed")` solo cuando cambia `Math.round(speed / 10)`.
- Game over: `onScore(final)` (si difiere del último emitido), `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El salto ignora `e.repeat` (un salto por pulsación); `keyup` del salto corta el "mantener".
- Pausa/blur/destroy ponen `jumpHeld = downHeld = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** suelo en `GROUND_Y = 270` (pies del corredor). El corredor está fijo en `x = 80`. Escala: **1 m = 10 px** (`PX_PER_M = 10`).
- **Corredor:** de pie **40×50 px** (ocupa `y ∈ [220, 270]` en el suelo); agachado **58×30 px** (`y ∈ [240, 270]`). Solo puede agacharse en el suelo y mientras mantiene `↓`/`S`; al soltar vuelve a estar de pie.
- **Salto:** `Espacio`/`↑`/`W` en el suelo (y no agachado) fija `vy = −780 px/s`. Gravedad:
  - **1400 px/s²** mientras la tecla de salto se mantiene, `vy < 0` y `holdMs ≤ 220`.
  - **2600 px/s²** en cualquier otro caso.
  - **6000 px/s²** si se mantiene `↓`/`S` en el aire (caída rápida; tiene prioridad).
  - Resultado esperado: toque corto ≈ **117 px** de altura; mantenido ≈ **180 px**. Al tocar el suelo `y = 270`, `vy = 0`, `onGround = true`.
- **Velocidad:** `speed = min(900, 360 + 0.18 × meters)` px/s (360 al inicio, máximo 900 a los 3000 m). Stat VELOCIDAD = `Math.round(speed / 10)` (36 → 90).
- **Puntaje:** `score = Math.floor(meters)`, `meters = distancePx / 10`. No hay otra fuente de puntos.
- **Obstáculos:** se generan en `x = 800` (borde derecho). El primero aparece al llegar a **30 m**. El siguiente aparece cuando el borde derecho del último obstáculo está a `≤ 800 − nextGap`, con `nextGap` aleatorio en `[0.9 × speed, 1.6 × speed]` px (se sortea al generar cada obstáculo con la velocidad de ese momento).
  - `small`: cactus **22×44**, base en el suelo.
  - `big`: cactus **32×60**, base en el suelo.
  - `group`: `n` cactus pequeños juntos, ancho `22n + 6(n − 1)`, alto 44. `n = 2`; desde **300 m** `n = 3` con probabilidad 0.5.
  - `bird`: ave **44×28**, solo desde **600 m**; se mueve a `speed + 60` px/s. Altura (borde inferior del ave): baja `y = 260` (hay que saltar) con prob. 0.4, media `y = 234` (hay que agacharse o saltar alto) con prob. 0.4, alta `y = 190` (inofensiva de pie, peligrosa al saltar) con prob. 0.2. Aleteo cosmético cada 180 ms.
  - Sorteo de tipo: antes de 600 m → `small` 0.5, `big` 0.3, `group` 0.2. Desde 600 m → `small` 0.35, `big` 0.25, `group` 0.15, `bird` 0.25.
  - Los obstáculos se eliminan cuando `x + w < 0`.
- **Colisión:** AABB con margen interior de **4 px** por lado en el corredor y **3 px** en el obstáculo. Cualquier contacto mata (1 vida).
- **Game over:** al primer choque → `onLives(0)` y `onGameOver(score)`.
- **Animación:** piernas alternan cada **100 ms** al correr (fijas en el aire); parallax de montañas a `0.2 × speed` y estrellas a `0.05 × speed`; puntos del suelo a `speed`.
- **Dibujo:** cielo gradiente `#05000f` → `#120a2a`; montañas `#1a1040`; estrellas `rgba(255,255,255,0.5)`; línea de suelo `#00f5ff` de 2 px con puntos `#0a6a80`. Corredor `#00f5ff` con ojo `#05000f`; cactus `#ff2bd6` con brazos; aves `#ffe600`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` / `lib/games/frogger/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/endless-runner/physics.ts`. Verificar: `npm run lint`; `speedAt(0) = 360`, `speedAt(1500) = 630`, `speedAt(5000) = 900`, `gapRange(400) = [360, 640]`, `rollObstacle(100, …)` nunca devuelve `bird`.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): salto corto y largo, agacharse, caída rápida, primer obstáculo a 30 m, grupos de 3 tras 300 m, aves de 3 alturas tras 600 m, VELOCIDAD 36 → sube, choque y modal, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'` (y registrar el `update` en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`CORRER`, dificultad 2, color cyan, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas 5:2 sin desborde a 375 px y 1280 px.
- [ ] `Espacio`/`↑`/`W` saltan solo desde el suelo; mantener la tecla da un salto visiblemente más alto (≈180 px) que un toque (≈117 px); mantener pulsado no encadena saltos.
- [ ] `↓`/`S` en el suelo agachan (58×30) y en el aire aceleran la caída; las flechas y `Espacio` no hacen scroll.
- [ ] La partida empieza a 360 px/s (VELOCIDAD 36) y llega a 900 px/s (VELOCIDAD 90) a los 3000 m, sin superarla.
- [ ] El puntaje es exactamente `floor(metros)` (1 m = 10 px) y el HUD se actualiza como máximo cada 100 ms.
- [ ] El primer obstáculo aparece a los 30 m; no hay grupos de 3 antes de 300 m ni aves antes de 600 m.
- [ ] Ave media (`y = 234`) se esquiva agachado; ave baja (`y = 260`) se esquiva saltando; ave alta (`y = 190`) no toca al corredor de pie.
- [ ] Un choque emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0) y VELOCIDAD; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela corredor, obstáculos, parallax y distancia; reanudar sin salto de tiempo ni salto "mantenido" residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`, espacio) no salta ni agacha.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vida 1, VELOCIDAD 36, sin obstáculos, corredor en el suelo).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración figura en `prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista lateral con dos acciones (saltar/agacharse); es la diferencia central con la variante 02 (carriles cenitales). **No:** cambio de carril, monedas ni power-ups.
- **Sí:** salto de altura variable (gravedad reducida mientras se mantiene, máx. 220 ms) y caída rápida; dan profundidad sin añadir botones.
- **Sí:** 1 vida (`initialLives: 1`, como Snake/Tetris); el género es "un error y fuera". **No:** vidas extra ni invulnerabilidad.
- **Sí:** puntaje = metros; **No:** bonus por hito (inventaría balance y el leaderboard compara distancia pura).
- **Sí:** `onScore` limitado a 10 Hz; el puntaje cambia casi cada frame a alta velocidad y el contrato prohíbe eventos por frame.
- **Sí:** stat `VELOCIDAD`; **No:** `showLevel` (la dificultad es continua, no hay niveles).
- **Sí:** aves desde 600 m con tres alturas; obligan a elegir entre saltar y agacharse.
- **Sí:** valores de balance (gravedades, velocidades, huecos, probabilidades, tamaños) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color cyan; **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 800×320 (5:2): el género necesita ver lejos en horizontal.
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por `missile-command`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Combinaciones imposibles (obstáculo tras aterrizar sin tiempo de reacción a 900 px/s). | Hueco mínimo `0.9 × speed` (0,9 s); verificar a 3000 m+ en el paso 6 y ajustar solo editando el spec.                   |
| Colisiones injustas por cajas exactas.                                                 | Márgenes interiores de 4 px (corredor) y 3 px (obstáculo).                                                              |
| `onScore` por frame satura React.                                                      | Emitir solo si cambió y como máximo cada 100 ms; valor final forzado al morir.                                          |
| `dt` grande tras pausar o cambiar de pestaña teletransporta obstáculos.                | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                    |
| Salto "mantenido" o agachado pegados tras perder foco.                                 | `blur` y `pause` ponen `jumpHeld`/`downHeld` a `false`.                                                                 |
| Espacio, flechas o `W`/`S` interfieren con el input del modal.                         | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| Canvas 5:2 queda bajo en móvil (≈150 px a 375 px).                                     | Aceptado para este spec; el ajuste móvil lo hace `mobile-porter`. Verificar que no desborda a 375 px.                    |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| El id con guion requiere comillas en `ENGINES` y nombre de migración.                  | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración `add_game_endless_runner`.      |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Monedas, power-ups, vidas extra, carriles, ciclo día/noche, niveles o zonas.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
