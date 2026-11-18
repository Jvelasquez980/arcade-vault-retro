# SPEC GJ-pong-vs-cpu-01 — Juego real: PONG VS CPU (variante: escalera clásica) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-18
> **Variant:** 01 de 2 — Pong clásico fiel en horizontal: partidos a 7 puntos contra una escalera infinita de rivales CPU cada vez más fuertes; perder un partido termina la carrera.
> **Objective:** Crear un motor TypeScript de Pong vs CPU dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Pong vs CPU. Es el Pong de 1972 tal cual: campo horizontal, dos palas verticales, pelota cuadrada, rebote cuyo ángulo depende del punto de impacto y aceleración por golpe. Lo que lo vuelve competible en leaderboard (la objeción de `references/game-suggestions-todo.md`) es la **escalera de rivales**: cada partido ganado sube de nivel (rival más rápido y preciso) y multiplica los puntos; la carrera termina al perder un partido. Se distingue de la variante 02 (vertical, 3 vidas globales, power-ups, multibola y golpe cargado): aquí no hay power-ups ni acciones extra, solo moverse y colocar la pelota.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos. En `app/globals.css` existe `.cover-duelo` (prototipo de Pong); no se toca ni se reutiliza por nombre: se crea `.cover-pong-vs-cpu` con el mismo diseño de base.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `VERSUS`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs de game jam), dificultad 2, tags `CLÁSICO` y `DUELO`, 1 jugador (contra la CPU), teclado. Canvas **800×600** (4:3). Las **vidas son los puntos que le faltan a la CPU para ganar el partido** (`initialLives: 7`, se rellenan a 7 en cada partido nuevo), el **nivel es el rival** (`showLevel: true`), stats extra `TUS PUNTOS` y `RALLY`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/ai.ts`: funciones puras `cpuParams(level) → { speed, reactMs, errorPx, predict }` y `predictY(ballX, ballY, vx, vy, targetX, top, bottom) → number` (proyección con reflejo en las paredes).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawCourt`, `drawPaddle`, `drawBall`, `drawScoreDigits` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `#0a0a18`, `::after` con red central discontinua (`repeating-linear-gradient` blanco 10 px / 10 px, 2 px de ancho), pala cyan a la izquierda (6% 35%, 6 px × 30%), pala magenta a la derecha (88% 35%) y pelota cuadrada amarilla de 10 px en 60% 60%, `drop-shadow` cyan. `.cover-duelo` no se modifica.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **800×600**.
- HUD de React: puntaje, **7 vidas** (= puntos que le faltan a la CPU), **nivel** (rival), stats extra `me` ("TUS PUNTOS", `int`) y `rally` ("RALLY", `int`).
- Marcador nativo del partido dibujado en el canvas (dos cifras grandes y tenues, parte del campo como en el original; no es overlay).
- Controles: `↑`/`↓` y `W`/`S` mueven la pala del jugador (izquierda). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores local u online.
- Power-ups, multibola, golpe cargado, efectos (spin).
- Selector de dificultad o de rival inicial.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Gana partidos a 7 y sube la escalera.',
       'El duelo clásico contra la máquina. Mueve tu pala con las flechas o W/S y devuelve la pelota: el ángulo depende de dónde la golpees y cada golpe la acelera. Gana un partido a 7 puntos para enfrentarte a un rival más rápido y preciso; pierde uno y se acaba la carrera.',
       'VERSUS', 'cyan', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{CLÁSICO,DUELO}', 2, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 800, height: 600,
      initialLives: 7,
      showLevel: true,
      stats: [
        { key: "me", label: "TUS PUNTOS", color: "cyan", format: "int" },
        { key: "rally", label: "RALLY", color: "yellow", format: "int" },
      ],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { y }`, `cpu { y, targetY, reactTimer }`, `ball { x, y, vx, vy, speed }`, `serveTimer`, `serveDir` (−1 hacia el jugador, +1 hacia la CPU), `up`, `down` (teclas mantenidas), `myPoints`, `cpuPoints`, `rally`, `level`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives` (`7 − cpuPoints`), `onLevel`, `onStat("me", myPoints)`, `onStat("rally", rally)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(7)`, `onLevel(1)`, `onStat("me", 0)`, `onStat("rally", 0)`. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio de cada partido y de cada punto.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa.
- Pausa/blur/destroy ponen `up = down = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Campo:** paredes superior e inferior de **8 px** (la pelota rebota en `y = 8` y `y = 592`). Red central discontinua en `x = 398..402`, segmentos de 16 px cada 32 px (decorativa, no colisiona).
- **Palas:** 12×90 px. Jugador con borde izquierdo en `x = 24` (cara de golpe en `x = 36`); CPU con borde izquierdo en `x = 764` (cara de golpe en `x = 764`). Ambas empiezan centradas (`y` centro = 300) y su centro se limita a `[53, 547]`.
- **Movimiento del jugador:** **420 px/s** mientras se mantiene `↑`/`W` (arriba) o `↓`/`S` (abajo); ambas a la vez = quieto. Sin inercia.
- **Pelota:** cuadrado de 10×10 px. Velocidad inicial de cada punto **320 px/s**; **+20 px/s** por golpe de pala, máximo **680 px/s**. Se mueve en sub-pasos de **≤ 6 px** por frame para no atravesar palas.
- **Saque:** la pelota espera **800 ms** quieta en el centro (395, 295) y sale hacia el lado que perdió el último punto (el primer saque de cada partido va hacia el jugador), con ángulo aleatorio en **[−30°, +30°]** respecto a la horizontal.
- **Rebote en pala:** solo si la pelota se mueve hacia esa pala y su caja se solapa con la pala. `offset = clamp((ballCentroY − palaCentroY) / 50, −1, 1)`, ángulo de salida `= offset × 60°`, sentido horizontal invertido, se reposiciona la pelota pegada a la cara de golpe. Cada golpe suma `rally += 1` → `onStat("rally", rally)`.
- **Rebote en pared:** invierte `vy` y recoloca la pelota dentro del campo.
- **Punto:** la pelota sale por `x < 0` → punto CPU; por `x > 800` → punto jugador. Tras cada punto `rally = 0` → `onStat("rally", 0)`, palas no se recolocan, nuevo saque.
- **CPU** (`cpuParams(level)`):
  - Velocidad máxima `min(260 + 30 × (level − 1), 480)` px/s.
  - Recalcula su objetivo cada `max(60, 220 − 20 × (level − 1))` ms (`reactMs`).
  - Error de puntería: al recalcular suma un desplazamiento aleatorio uniforme en `±max(8, 50 − 6 × (level − 1))` px (`errorPx`).
  - Con la pelota viniendo hacia ella (`vx > 0`): objetivo = `y` actual de la pelota en niveles 1–3; desde **nivel 4** (`predict = true`) objetivo = `predictY` en `x = 764` con reflejo en paredes.
  - Con la pelota alejándose (`vx ≤ 0`) o durante el saque: vuelve hacia `y = 300` al **50 %** de su velocidad máxima.
  - Se mueve hacia `targetY` sin superarlo (zona muerta de 4 px).
- **Partido:** a **7 puntos**, sin diferencia de 2. Vidas del HUD = `7 − cpuPoints`.
- **Puntuación:**
  - **+10** por cada golpe de la pala del jugador.
  - **+100 × level** por punto ganado.
  - Ganar el partido: **+500 × level**; si fue 7–0, **+1000 × level** adicional (partido perfecto).
- **Subida de nivel:** al ganar un partido, `level += 1` → `onLevel(level)`, `myPoints = cpuPoints = 0` → `onLives(7)`, `onStat("me", 0)`; nuevo partido tras el saque normal (hacia el jugador). Escalera sin tope de nivel (los parámetros de la CPU se saturan en nivel 9).
- **Game over:** la CPU llega a 7 puntos → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Dibujo:** fondo `#000000`; paredes y red `#1a1a3a`/`rgba(255,255,255,0.35)`. Pala del jugador `#00f5ff` con `shadowBlur` 12; pala CPU `#ff2bd6`; pelota `#ffffff`. Marcador nativo: `myPoints` en x = 340 y `cpuPoints` en x = 460, `y = 80`, fuente monoespaciada **56 px**, `rgba(255,255,255,0.25)`, centrado.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila y ningún otro juego tiene `sort_order = 7`; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/ai.ts`. Verificar: `npm run lint`; `cpuParams(1) = { speed: 260, reactMs: 220, errorPx: 50, predict: false }`, `cpuParams(4).predict = true`, `cpuParams(8) = { speed: 470, reactMs: 80, errorPx: 8, predict: true }`, `cpuParams(20).speed = 480`, `cpuParams(20).reactMs = 60`; `predictY` con un rebote devuelve el `y` reflejado.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): saque de 800 ms, rebote en bordes y en distintas zonas de la pala, aceleración por golpe hasta el tope, ganar un punto y perderlo, ganar un partido (sube nivel, vidas vuelven a 7), CPU con predicción en nivel 4, perder el partido, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu`), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`DUELO`, dificultad 2, color cyan, categoría VERSUS); aparece con el filtro VERSUS.
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] `↑`/`↓` y `W`/`S` mueven la pala del jugador a 420 px/s sin salirse del campo; las flechas no hacen scroll.
- [ ] Cada punto empieza con la pelota quieta 800 ms en el centro y sale a 320 px/s hacia quien perdió el punto anterior (hacia el jugador al inicio de cada partido), con ángulo dentro de ±30°.
- [ ] Golpear con el centro de la pala devuelve la pelota casi horizontal y con el borde a ~60°; cada golpe suma 20 px/s hasta 680 px/s; la pelota nunca atraviesa una pala a velocidad máxima.
- [ ] Cada golpe del jugador suma exactamente 10 puntos y sube RALLY; RALLY vuelve a 0 (oculto) tras cada punto.
- [ ] Un punto ganado suma 100 × nivel y sube TUS PUNTOS; un punto de la CPU baja las vidas del HUD en 1.
- [ ] Ganar el partido 7–x suma 500 × nivel (más 1000 × nivel si fue 7–0), sube el nivel en 1 y restablece vidas a 7 y TUS PUNTOS a 0.
- [ ] La CPU de nivel 1 mueve su pala a 260 px/s con fallos visibles; desde nivel 4 anticipa rebotes en pared; su velocidad no supera 480 px/s.
- [ ] Al llegar la CPU a 7 se emite `onLives(0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] El marcador nativo del canvas coincide con TUS PUNTOS y con `7 − vidas`.
- [ ] El HUD de React refleja puntaje, vidas (7 → 0), nivel, TUS PUNTOS y RALLY; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pelota, palas, saque y CPU; reanudar sin salto de tiempo ni pala "pegada".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`) no mueve la pala.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vidas 7, nivel 1, TUS PUNTOS 0, RALLY 0, palas centradas, saque hacia el jugador).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión; `.cover-duelo` sin cambios.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas de Pong clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con rectángulos Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** escalera infinita de rivales con multiplicador por nivel; es lo que hace el puntaje competible (sin ella, el máximo sería fijo). **No:** partido único.
- **Sí:** perder un partido termina la carrera; **No:** vidas globales entre partidos (eso es la variante 02).
- **Sí:** vidas = puntos que le faltan a la CPU (`initialLives: 7`); da un HUD de peligro claro y respeta el orden `onLives(0)` → `onGameOver`.
- **Sí:** partido a 7 sin diferencia de 2; partidas cortas (≈ 2–4 min por partido).
- **Sí:** CPU con velocidad máxima, tiempo de reacción y error de puntería por nivel, predicción desde nivel 4; **No:** CPU perfecta (sería imbatible) ni IA con aprendizaje.
- **Sí:** stats `TUS PUNTOS` y `RALLY`; el 0 los oculta por contrato de `onStat` y se acepta.
- **Sí:** marcador nativo tenue en el canvas por fidelidad al original; **No:** overlays de pausa/game over.
- **Sí:** sub-pasos de 6 px en el movimiento de la pelota contra el tunneling a 680 px/s.
- **Sí:** valores de balance (velocidades, ángulos, reacción, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS (llena la categoría vacía) y color cyan; **Sí:** `.cover-pong-vs-cpu` nueva basada en `.cover-duelo`, que no se toca.
- **No:** sonido, táctil, mouse, HiDPI, skins, 2 jugadores (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| La pelota atraviesa la pala a 680 px/s con `dt` de 50 ms (34 px por frame).           | Sub-pasos de ≤ 6 px con chequeo de colisión en cada uno; criterio de aceptación a velocidad máxima.            |
| CPU imbatible en niveles altos o demasiado tonta en los bajos.                        | Error de puntería mínimo 8 px y reacción mínima 60 ms; verificar niveles 1, 4 y 8 en el paso 6 y ajustar solo editando el spec. |
| Pelota atrapada rebotando casi vertical sin llegar a ninguna pala.                    | Ángulo de salida máximo 60° respecto a la horizontal; saque limitado a ±30°.                                   |
| Doble rebote o pelota "pegada" dentro de la pala.                                     | Rebote solo si la pelota va hacia la pala y se recoloca pegada a la cara de golpe.                            |
| `dt` grande tras pausar o cambiar de pestaña provoca un punto injusto.                | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                            |
| Flechas o `W`/`S` interfieren con el input del modal.                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Pala "pegada" en movimiento tras perder foco.                                         | `blur` y `pause` ponen `up`/`down` a `false`.                                                                   |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                          |
| El id con guiones requiere comillas en `ENGINES` y un nombre de migración válido.     | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`.       |
| `sort_order` 7 choca si cambia la reserva de `missile-command`.                       | Paso 1 comprueba por `execute_sql` que nadie usa 7; huecos en el orden son válidos.                             |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                 |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores local u online.
- Power-ups, multibola, golpe cargado y efectos de spin.
- Selector de dificultad o de rival inicial.
- Overlays de pausa/game over dentro del canvas.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
