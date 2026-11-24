# SPEC GJ-pong-vs-cpu-01 — Juego real: PONG VS CPU (variante: clásico por sets) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-24
> **Variant:** 01 de 2 — Pong horizontal fiel al de 1972: pala vertical a la izquierda contra una CPU que mejora set a set; 5 vidas (goles en contra) para toda la partida.
> **Objective:** Crear un motor TypeScript de Pong contra la CPU dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Pong vs CPU. Recrea el Pong clásico en horizontal: el jugador mueve una pala vertical en el borde izquierdo y la CPU defiende el derecho. La partida es una **escalera de sets**: cada set lo gana quien llegue antes a **7 goles**; al ganar uno, la CPU sube de nivel (más rápida, más precisa y, desde el nivel 4, anticipa los rebotes). Los goles en contra gastan **vidas compartidas por toda la partida**, y con 0 vidas termina la partida. Se distingue de la variante 02 (vertical, 90 s a contrarreloj, pala con movimiento en 2 ejes, remate, combo y power-ups): aquí no hay temporizador ni power-ups. Lo que cuenta es la **precisión del ángulo** y aguantar contra una CPU cada vez más fuerte.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con rectángulos. Existe `.cover-duelo` (prototipo) en `app/globals.css`, pero no se reutiliza: se crea `.cover-pong-vs-cpu` para respetar la convención `cover-<id>`.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `VERSUS`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 y el 6 lo reserva la propuesta `missile-command`), dificultad 2, tags `CLÁSICO` y `PALAS`, 1 jugador, teclado. Canvas **800×600** (4:3). **5 vidas** (`initialLives: 5`), **nivel = set/rival** (`showLevel: true`) y stat extra `GOLES`. Se dibuja un **marcador nativo del set** (dos dígitos grandes) dentro del canvas, como en el original. Sin sonido ni imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/ai.ts`: funciones puras `cpuConfig(level) → { speed, aimError, reactionMs, predicts }` y `predictY(x, y, vx, vy, targetX, top, bottom) → number` (y de llegada con rebotes en las paredes).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawCourt` (fondo, paredes y red discontinua), `drawPaddle`, `drawBall` y `drawScore` (dígitos de 7 segmentos con rectángulos). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `#0a0a18`, `::after` con red discontinua central blanca (2 px), pala cyan a la izquierda (6% / 35%, 6 px × 30%), pala magenta a la derecha (88% / 50%) y bola cuadrada amarilla de 10 px; `filter: drop-shadow` cyan suave.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **800×600**.
- HUD de React: puntaje, **5 vidas**, **nivel** (= set) y stat extra `goals` ("GOLES", `int`, goles del jugador en el set actual).
- HUD nativo: solo el marcador del set (goles jugador – goles CPU) en dígitos grandes, parte del escenario. Sin texto de pausa, de set ganado ni de game over.
- Controles: `↑`/`↓` y `W`/`S` mueven la pala. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores local u online, power-ups, temporizador, selector de dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Devuelve la bola y vence a la máquina.',
       'Mueve tu pala con las flechas o W/S y gana sets a 7 goles contra la CPU. El ángulo depende de dónde golpea la bola en la pala, y la bola se acelera con cada devolución. Cada set ganado sube de nivel al rival, que se mueve más rápido y falla menos; cada gol en contra te cuesta una de tus 5 vidas.',
       'VERSUS', 'cyan', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{CLÁSICO,PALAS}', 2, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 800, height: 600,
      initialLives: 5,
      showLevel: true,
      stats: [{ key: "goals", label: "GOLES", color: "cyan", format: "int" }],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { y }`, `cpu { y, targetY, reactAcc }`, `ball { x, y, vx, vy, speed }`, `keysDown: Set<string>`, `phase: "serve" | "play"`, `serveMs`, `serveDir: 1 | -1`, `playerGoals`, `cpuGoals`, `level`, `lives`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("goals", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(5)`, `onLevel(1)`, `onStat("goals", 0)`.
- `onStat("goals", 0)` oculta el stat en el HUD (contrato de `onStat`); es lo esperado al empezar cada set.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en `↑`/`↓` solo con el juego activo y sin pausa. Movimiento continuo con `keysDown` (no depende de `e.repeat`).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, set ganado ni game over dentro del canvas.

**Reglas del juego:**

- **Campo:** paredes de 12 px arriba (`y ∈ [0, 12]`) y abajo (`y ∈ [588, 600]`); zona jugable `y ∈ [12, 588]`. Red central discontinua en `x = 399..401` (segmentos de 16 px cada 32 px).
- **Palas:** 12×88 px. Jugador con cara izquierda en `x = 36` (ocupa `x ∈ [36, 48]`); CPU en `x ∈ [752, 764]`. Ambas empiezan centradas (`y` superior = 256) y se limitan a la zona jugable.
- **Pala del jugador:** **480 px/s** mientras se mantiene `↑`/`W` o `↓`/`S`; si se pulsan ambas, no se mueve.
- **Bola:** cuadrado de 10×10 px. Velocidad inicial **360 px/s**; **+24 px/s** por cada golpe de pala (jugador o CPU), máximo **780 px/s**. Se mueve en subpasos de como mucho **6 px** para no atravesar palas.
- **Rebote en pared:** invierte `vy` y recoloca la bola dentro de la zona jugable.
- **Rebote en pala:** solo si la bola se mueve hacia esa pala y sus AABB se solapan. `o = clamp((ballCenterY − paddleCenterY) / 44, −1, 1)`; ángulo = `o × 60°` respecto a la horizontal; `vx` cambia de sentido, `vy = speed × sin(ángulo)` y la bola se recoloca pegada a la cara de la pala.
- **Saque:** la bola espera **1000 ms** quieta en el centro (`phase = "serve"`) y sale hacia `serveDir` con ángulo aleatorio uniforme en `[−30°, 30°]` a 360 px/s. Al empezar la partida, `serveDir` apunta al jugador (−1); tras cada gol, la bola se saca hacia quien lo recibió. Las palas se pueden mover durante la espera.
- **CPU** (`cpuConfig(level)`, con `L = level`):
  - Velocidad máxima: `min(300 + 40 × (L − 1), 560)` px/s.
  - Reacción: recalcula `targetY` cada `max(160 − 20 × (L − 1), 40)` ms; entre recálculos se mueve hacia el último `targetY` con zona muerta de 4 px.
  - Con la bola viniendo hacia ella (`vx > 0`): `targetY = yBola + error` en niveles 1–3, o `predictY(...)` hasta `x = 752` + error desde el nivel 4 (`predicts = L ≥ 4`). `error` se sortea uniforme en `[−aimError, aimError]` cada vez que el jugador golpea la bola (y en cada saque), con `aimError = max(50 − 8 × (L − 1), 10)` px.
  - Con la bola alejándose (`vx ≤ 0`) o en el saque: vuelve hacia el centro (`targetY = 300`) a la mitad de su velocidad máxima.
- **Gol:** si la bola sale por `x < 0`, gol de la CPU: `cpuGoals + 1`, vidas − 1 (`onLives`). Si sale por `x > 800`, gol del jugador: `playerGoals + 1` (`onStat("goals", n)`). Tras cada gol se reinicia la velocidad y se pasa a saque.
- **Set:** cuando el jugador llega a **7** goles gana el set: bonus, `level + 1` (`onLevel`), recupera **1 vida** (máx. 5, `onLives`), marcador del set a 0–0 (`onStat("goals", 0)`) y saque hacia el jugador. Si la CPU llega a 7 en el set, el marcador vuelve a 0–0 y se mantiene el nivel (la partida sigue mientras queden vidas). Los niveles no tienen tope (la CPU satura en el nivel 7).
- **Puntuación:**
  - Devolución del jugador (golpe de pala): **10**.
  - Gol del jugador: **100 × level**.
  - Set ganado: **500 × level** (nivel del set que se gana) + **100 × vidas** que quedan antes de recuperar la vida.
- **Fin:** al llegar las vidas a 0 → `onLives(0)` y `onGameOver(score)` en el mismo frame del gol.
- **Dibujo:** fondo `#000`; paredes y red `#ffffff` al 70%; pala del jugador `#00f5ff`, pala de la CPU `#ff2bd6`, bola `#ffffff` con `shadowBlur` 8 cyan. Marcador del set en dígitos de 7 segmentos (segmento 6×28 px, dígito 36×64 px) centrados en `x = 320` (jugador) y `x = 480` (CPU), `y = 40`, color `#ffffff` al 35% para no tapar la bola.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/ai.ts`. Verificar: `npm run lint`; `cpuConfig(1)` da 300 px/s, error 50 px, reacción 160 ms, sin predicción; `cpuConfig(7)` da 540 px/s, error 10 px, reacción 40 ms, con predicción; `predictY` con un rebote devuelve la y reflejada correcta.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover la pala, devolver con distintos ángulos (centro y borde), ver la aceleración, marcar gol, recibir gol (vidas bajan), ganar un set (nivel sube, vida recuperada, marcador 0–0), perder las 5 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'` (y registrar el `update` en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu`), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`PALAS`, dificultad 2, color cyan, categoría VERSUS).
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] `↑`/`↓` y `W`/`S` mueven la pala a 480 px/s sin salir de la zona jugable; las flechas no hacen scroll.
- [ ] La bola sale tras 1000 ms de espera a 360 px/s, sube 24 px/s por golpe y no pasa de 780 px/s; vuelve a 360 tras cada gol.
- [ ] Golpear con el centro de la pala devuelve la bola casi horizontal y con el borde a ~60°; la bola nunca atraviesa una pala a velocidad máxima.
- [ ] Cada devolución del jugador suma 10; cada gol del jugador suma 100 × nivel y sube GOLES en 1.
- [ ] Cada gol de la CPU baja 1 vida; con 0 vidas se emite `onLives(0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] Al llegar a 7 goles se suma 500 × nivel + 100 × vidas, el nivel del HUD sube, se recupera 1 vida (máx. 5) y el marcador nativo y GOLES vuelven a 0.
- [ ] Si la CPU llega a 7 en el set, el marcador vuelve a 0–0 sin cambiar el nivel.
- [ ] En el nivel 1 la CPU es batible (máx. 300 px/s, falla por hasta 50 px); desde el nivel 4 anticipa rebotes en pared.
- [ ] El HUD de React refleja puntaje, vidas (5 → 0), nivel (set) y GOLES; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela bola, palas, saque y temporizador de reacción de la CPU; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`) no mueve la pala.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 5 vidas, nivel 1, marcador 0–0, palas centradas, saque hacia el jugador).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del Pong clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo con primitivas Canvas 2D; **No:** imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** escalera de sets con 5 vidas compartidas, para que el puntaje sea acumulativo y comparable en el leaderboard. **No:** partida única a 11 (el puntaje quedaría casi fijo).
- **Sí:** recuperar 1 vida por set ganado; premia ganar sin alargar demasiado la partida.
- **Sí:** ángulo según el punto de impacto (±60°) y aceleración por golpe. Es la habilidad central del juego.
- **Sí:** CPU con velocidad limitada, error de puntería y retardo de reacción, y predicción desde el nivel 4. **No:** CPU perfecta (sería imbatible).
- **Sí:** marcador nativo del set en el canvas (fiel al original, parte del escenario); **No:** overlays de texto.
- **Sí:** `cat` VERSUS (es un duelo) y color cyan; **Sí:** `.cover-pong-vs-cpu` nueva; **No:** reutilizar `.cover-duelo` (convención `cover-<id>`).
- **Sí:** canvas 800×600 (4:3, como el monitor del arcade).
- **Sí:** valores de balance (velocidades, error, reacción, puntos, 7 goles) fijados en este spec, ajustables solo editándolo.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                             | Mitigation                                                                                                     |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| La bola atraviesa la pala a 780 px/s (túnel).                                    | Subpasos de como mucho 6 px (la pala mide 12); criterio de aceptación a velocidad máxima.                      |
| Doble rebote: la bola queda dentro de la pala y rebota varias veces.             | Rebotar solo si se mueve hacia la pala y recolocarla pegada a la cara tras el rebote.                          |
| CPU imbatible o trivial y balance roto.                                          | Parámetros en `cpuConfig` con valores de este spec; validar niveles 1, 4 y 7 en el paso 6.                     |
| Rallies infinitos en horizontal pura (ángulo 0).                                 | La aceleración por golpe y el error de la CPU acaban rompiendo el rally; el máximo de 780 px/s exige precisión. |
| Emitir eventos por frame satura React.                                           | Emitir solo en golpe, gol, set y game over.                                                                    |
| `dt` grande tras pausar o cambiar de pestaña provoca saltos de la bola.          | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                           |
| Tecla "pegada" tras perder foco.                                                 | `blur` y `pause` vacían `keysDown`.                                                                            |
| Doble loop / listeners por StrictMode.                                           | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones requiere comillas en `ENGINES` y la migración usa `_`.         | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`.      |
| "Pong" es marca registrada.                                                      | Juego y dibujo propios, sin assets ni logos originales; el título describe el género.                          |
| Next 16 difiere del conocimiento previo.                                         | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores (local u online), power-ups, temporizador y selector de dificultad.
- Overlays de pausa, set ganado o game over dentro del canvas.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
