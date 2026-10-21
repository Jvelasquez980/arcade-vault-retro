# SPEC GJ-endless-runner-01 — Juego real: ENDLESS RUNNER (variante: clásico de saltos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-21
> **Variant:** 01 de 2 — Runner lateral minimalista: un corredor que solo salta y se agacha, 1 vida, obstáculos de suelo y aves, velocidad continua creciente y puntaje por distancia.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante clásico de saltos) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Endless Runner. Es el runner lateral de una sola tecla: vista de perfil, el corredor está fijo a la izquierda y el mundo se desplaza hacia él; solo puede **saltar** (con altura variable según cuánto mantengas la tecla) y **agacharse**. Un solo choque termina la partida. El puntaje es la distancia recorrida y la velocidad sube sin tope de nivel hasta un máximo. Se distingue de la variante 02 (vista cenital con 3 carriles, cambio de carril, monedas con multiplicador, power-ups, 3 vidas y niveles).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `green`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 2, tags `CLÁSICO` y `SALTOS`, 1 jugador, teclado. Canvas **800×300** (8:3). **1 vida** (`initialLives: 1`), sin nivel, stats extra `TIEMPO` y `VELOCIDAD`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/balance.ts`: funciones puras (`speedAt(elapsedMs)`, `minGap(speed)`, `rollObstacle(score, rand)`, `scoreFor(distance)`) y constantes (`GROUND_Y`, `PLAYER`, `OBSTACLES`, `GRAVITY`, `JUMP_V`).
- Módulo `lib/games/endless-runner/draw.ts`: `drawSky`, `drawGround`, `drawClouds`, `drawRunner` (de pie, corriendo, agachado, en el aire), `drawCactus`, `drawBird` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: cielo `linear-gradient(180deg,#04110a,#0d2a16)` con `::after` de línea de suelo verde neón `#39ff14` y `::before` de silueta de corredor y dos cactus verdes.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **800×300**.
- HUD de React: puntaje, **1 vida** (baja a 0 al chocar), stats extra `time` ("TIEMPO", `seconds`) y `speed` ("VELOCIDAD", `int`). Sin nivel.
- Sin HUD nativo de texto en el canvas.
- Controles: `Espacio`, `↑` o `W` saltan (mantener = salto más alto); `↓` o `S` agachan en el suelo y aceleran la caída en el aire. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Vidas extra, monedas, power-ups, niveles, ciclo día/noche, doble salto.
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
       'Corre sin fin por el desierto neón: salta los cactus con Espacio, ↑ o W (mantén la tecla para saltar más alto) y agáchate con ↓ o S para pasar bajo las aves. La velocidad no deja de subir y un solo choque termina la carrera; tu puntaje es la distancia recorrida.',
       'ARCADE', 'green', 'cover-endless-runner', 1, 1, '{keyboard}', '{CLÁSICO,SALTOS}', 2, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 800, height: 300,
      initialLives: 1,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "speed", label: "VELOCIDAD", color: "green", format: "int" },
      ],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `y` (base del corredor), `vy`, `onGround`, `ducking`, `jumpHeld`, `downHeld`, `jumpBufferMs`, `obstacles: { kind: "cactusS" | "cactusL" | "group2" | "group3" | "bird", x, y, w, h, vx, frame }[]`, `clouds: { x, y, w }[]`, `groundOffset`, `distance`, `nextGap`, `speed`, `elapsedMs`, `score`, `lastSecondEmitted`, `lastSpeedEmitted`, `runFrameMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("time", s)`, `onStat("speed", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("time", 0)`, `onStat("speed", 36)`.
- `onScore` solo cuando cambia `Math.floor(distance / 50)`; `onStat("time", s)` solo cuando cambia `Math.floor(elapsedMs / 1000)`; `onStat("speed", n)` solo cuando cambia `Math.round(speed / 10)`. Valor 0 oculta el stat (contrato de `onStat`); esperado en TIEMPO al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Las teclas de salto ignoran `e.repeat` (un salto por pulsación); `↓`/`S` es estado mantenido (`keydown`/`keyup`).
- Pausa/blur/destroy ponen `jumpHeld = downHeld = false`, `ducking = false` y `jumpBufferMs = 0`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** suelo en `GROUND_Y = 250` (línea de 2 px); debajo, franja de tierra hasta `y = 300`. El corredor está fijo en `x = 80` (borde izquierdo de su caja).
- **Corredor:** de pie/en el aire caja **40×50** (base en `y`); agachado caja **56×30**. Hitbox = caja reducida **4 px por lado**. Empieza en el suelo, de pie, corriendo.
- **Salto:** `Espacio`/`↑`/`W` con `onGround` → `vy = −760 px/s`. Gravedad **2400 px/s²** (altura máxima ≈ 120 px, ≈ 633 ms en el aire). Soltar la tecla mientras `vy < −300` fija `vy = −300` (salto corto). Si se pulsa en el aire y faltan ≤ **100 ms** para aterrizar (`jumpBufferMs`), salta al tocar suelo. No hay doble salto.
- **Agacharse / caída rápida:** con `↓`/`S` mantenido en el suelo → `ducking = true` (caja 56×30). En el aire, la gravedad pasa a **×3** (7200 px/s²) mientras se mantenga. Saltar cancela el agachado.
- **Velocidad:** `speed = min(360 + 8 × elapsedMs / 1000, 900)` px/s (llega al tope a los 67,5 s). VELOCIDAD en el HUD = `Math.round(speed / 10)` (36 → 90).
- **Puntaje:** `distance += speed × dt`; `score = Math.floor(distance / 50)` (≈ 7 pts/s al inicio, 18 pts/s al tope). No hay otras fuentes de puntos.
- **Obstáculos** (tamaño ancho×alto, base en el suelo salvo aves):
  - `cactusS` 20×40; `cactusL` 30×60; `group2` 46×40 (2 `cactusS` separados 6 px); `group3` 72×40 (3 `cactusS`).
  - `bird` 46×30, alas que alternan cada **150 ms**; base en `y = 250` (baja: hay que saltar), `y = 215` (media: hay que agacharse) o `y = 170` (alta: pasa por encima del corredor de pie; solo golpea si saltas). Altura equiprobable.
  - Los cactus se mueven a `speed`; las aves a `speed + 60` px/s.
- **Sorteo:** con `score < 300` solo cactus: `cactusS` 0.40, `cactusL` 0.30, `group2` 0.20, `group3` 0.10. Con `score ≥ 300`: `bird` 0.25 y el resto cactus con esas proporciones × 0.75.
- **Aparición:** el primer obstáculo aparece cuando `distance ≥ 600`. Cada obstáculo nace en `x = 810`. El siguiente nace cuando el borde derecho del último está a `≥ nextGap` px de `x = 810`, con `nextGap` aleatorio en `[minGap, minGap + 360]` y `minGap = 0.9 × speed + 120` (444 px a 360 px/s; 930 px a 900 px/s). Los obstáculos con `x + w < 0` se eliminan.
- **Colisión:** solapamiento AABB entre hitbox del corredor y hitbox del obstáculo (también reducida 4 px por lado) → game over inmediato (`onLives(0)`, `onGameOver(score)`).
- **Tiempo:** `elapsedMs` suma `dt` solo en juego (no en pausa ni tras game over).
- **Decorado:** 3 nubes que se desplazan a `0.2 × speed` y reaparecen por la derecha con `y` aleatoria en `[30, 120]`; guijarros del suelo (rayas de 2–8 px en `y = 255..290`) que se desplazan a `speed` con `groundOffset`. Piernas del corredor alternan cada **100 ms** en el suelo.
- **Dibujo:** cielo con gradiente vertical `#04110a` → `#0d2a16`; nubes `rgba(255,255,255,0.12)`; línea de suelo `#39ff14`; tierra `#06180c` con guijarros `#1fae0c`. Corredor `#39ff14` con ojo `#04110a`; cactus `#00c853` con borde `#39ff14`; aves `#ff2bd6`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila; `npm run build`.
2. Crear `lib/games/endless-runner/balance.ts`. Verificar: `npm run lint`; `speedAt(0) = 360`, `speedAt(30000) = 600`, `speedAt(120000) = 900`, `minGap(360) = 444`, `minGap(900) = 930`, `scoreFor(1049) = 20`.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): salto corto y largo, buffer de salto, agacharse bajo un ave media, caída rápida, aves desde 300 puntos (baja/media/alta), subida de VELOCIDAD hasta 90, chocar con un cactus, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`SALTOS`, dificultad 2, color verde, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas 8:3 sin desborde a 375 px y 1280 px.
- [ ] `Espacio`/`↑`/`W` saltan solo desde el suelo; mantener la tecla alcanza ≈ 120 px y soltarla pronto da un salto corto; mantener pulsado no repite el salto; las flechas y `Espacio` no hacen scroll.
- [ ] Pulsar salto ≤ 100 ms antes de aterrizar salta al tocar suelo; antes de eso se ignora.
- [ ] `↓`/`S` en el suelo agacha (caja 56×30) y permite pasar bajo un ave media (`y = 215`); de pie esa ave mata. En el aire acelera la caída.
- [ ] La velocidad empieza en 360 px/s (VELOCIDAD 36), sube 8 px/s por segundo y se detiene en 900 px/s (VELOCIDAD 90).
- [ ] El puntaje es `Math.floor(distancia / 50)` y no hay otras fuentes de puntos.
- [ ] Antes de 300 puntos solo salen cactus (S, L, grupos de 2 y 3); desde 300 salen aves en tres alturas, más rápidas que el suelo (+60 px/s).
- [ ] La separación entre obstáculos nunca baja de `0.9 × speed + 120` px; el primero aparece a los 600 px recorridos.
- [ ] Un choque emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto; el ave alta no mata al corredor de pie.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), TIEMPO (1 por segundo de juego) y VELOCIDAD; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela corredor, obstáculos, nubes, TIEMPO y velocidad; reanudar sin salto de tiempo ni agachado/salto residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`, espacio) no salta ni agacha.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vida 1, TIEMPO 0, VELOCIDAD 36, sin obstáculos, corredor en el suelo).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista lateral con solo saltar y agacharse; es la diferencia central con la variante 02. **No:** carriles, movimiento horizontal del corredor ni doble salto.
- **Sí:** salto de altura variable (corte a −300 px/s) y buffer de 100 ms; dan control fino con una sola tecla.
- **Sí:** 1 vida (`initialLives: 1`, como Snake) para que el HUD muestre la vida; **No:** vidas extra ni invulnerabilidad.
- **Sí:** puntaje solo por distancia; **No:** monedas ni bonus (la habilidad se mide en cuánto aguantas).
- **Sí:** velocidad continua con tope 900 px/s; **No:** `showLevel` (no hay niveles discretos).
- **Sí:** stats `TIEMPO` y `VELOCIDAD`; comunican el progreso sin HUD nativo.
- **Sí:** hitbox reducida 4 px por lado; evita muertes injustas por esquinas.
- **Sí:** separación mínima proporcional a la velocidad; garantiza que todo obstáculo sea saltable.
- **Sí:** valores de balance (gravedad, impulso, velocidades, separaciones, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color verde; **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 800×300 (8:3), formato natural de runner lateral.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A 900 px/s un `group3` (72 px) seguido de un ave es imposible.                         | `minGap` crece con la velocidad (930 px al tope); verificar a velocidad máxima en el paso 6 y ajustar solo editando el spec. |
| `dt` grande tras pausar o cambiar de pestaña atraviesa un obstáculo o lo mata de golpe. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `elapsedMs` solo avanza en juego.          |
| Emitir `onScore` por frame satura React (hasta 18 cambios/s).                          | Emitir solo cuando cambia `Math.floor(distance / 50)`; TIEMPO y VELOCIDAD solo al cambiar su valor redondeado.   |
| Agachado o salto "pegado" tras perder foco.                                            | `blur` y `pause` limpian `jumpHeld`, `downHeld`, `ducking` y `jumpBufferMs`.                                    |
| Canvas 8:3 queda muy bajo en móvil (375 px → ~140 px de alto).                         | Aceptado: el móvil queda fuera de scope; `mobile-porter` lo revisa en su spec.                                  |
| Flechas, `W`/`S` o espacio interfieren con el input del modal.                         | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración con `_` en el nombre.   |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas extra, monedas, power-ups, niveles, doble salto, ciclo día/noche.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
