# SPEC GJ-pong-vs-cpu-02 — Juego real: PONG VS CPU (variante: arena de power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-18
> **Variant:** 02 de 2 — Pong arcade moderno en vertical: supervivencia con 3 vidas, golpe cargado (smash), multiplicador de combo, power-ups en el campo y multibola contra una CPU que mejora cada 3 goles.
> **Objective:** Crear un motor TypeScript de Pong vs CPU (variante arena de power-ups) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Pong vs CPU. Reinterpreta Pong como arcade de puntuación: el campo es **vertical** (jugador abajo, CPU arriba, se juega con `←/→`), no hay partidos sino **supervivencia con 3 vidas** (cada gol de la CPU quita una), y el puntaje crece con un **multiplicador de combo** por devoluciones seguidas. Añade una acción: el **smash** (`Espacio`), que acelera la pelota y desestabiliza a la CPU si se pulsa justo antes del golpe. En el centro del campo aparecen **power-ups** que se activan al tocarlos con la pelota (pala larga, pelota lenta, multibola, escudo). Se distingue de la variante 01 (horizontal, fiel al original, partidos a 7 en escalera, perder un partido termina, solo moverse).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas, líneas y gradientes. En `app/globals.css` existe `.cover-duelo` (prototipo de Pong horizontal); no se toca: se crea `.cover-pong-vs-cpu` vertical.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `VERSUS`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs de game jam), dificultad 3, tags `DUELO` y `POWER-UPS`, 1 jugador (contra la CPU), teclado. Canvas **540×720** (3:4, vertical). **3 vidas** (`initialLives: 3`), **nivel** sube cada 3 goles del jugador (`showLevel: true`), stats extra `COMBO` y `GOLES`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/balance.ts`: funciones puras `cpuParams(level) → { speed, reactMs, errorPx, predict }`, `serveSpeed(level)`, `comboMult(hits)`, `levelFor(goals)`, `predictX(ballX, ballY, vx, vy, targetY, left, right) → number` (proyección con reflejo en las paredes laterales) y constantes (`FIELD`, `PADDLE`, `POWERUPS`).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawArena`, `drawPaddle`, `drawBall` (con estela), `drawPowerUp`, `drawShield`, `drawSmashFlash` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `linear-gradient(180deg,#1a002a,#0a0a18)`, `::after` con pala cyan horizontal arriba (50% 12%, 30% × 6px), pala magenta abajo (50% 86%), línea media discontinua horizontal (`repeating-linear-gradient(90deg, …)` blanco 10/10 px, 2 px de alto, en 50%) y dos pelotas amarillas de 10 px (multibola) en 40% 40% y 62% 58%, con `drop-shadow` magenta. `.cover-duelo` no se modifica.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **540×720**.
- HUD de React: puntaje, **3 vidas**, **nivel**, stats extra `combo` ("COMBO", `int`, multiplicador ×1–×5) y `goals` ("GOLES", `int`).
- Sin HUD nativo de texto en el canvas, salvo la letra dentro de cada power-up (parte del objeto de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` mueven la pala del jugador; `Espacio` (o `↑`/`W`) arma el smash. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores local u online.
- Power-ups negativos o para la CPU, tienda o mejoras persistentes.
- Partidos a puntos / escalera de rivales (variante 01).
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Smash, combos y power-ups contra la máquina.',
       'Duelo vertical contra la CPU. Mueve tu pala con las flechas o A/D y pulsa Espacio justo antes del golpe para un smash que acelera la pelota. Cada devolución seguida sube el multiplicador; toca los power-ups con la pelota para alargar tu pala, frenar el juego, sacar más pelotas o activar un escudo. Cada 3 goles la CPU mejora; con tres goles en contra se acaba la partida.',
       'VERSUS', 'magenta', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{DUELO,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 540, height: 720,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
        { key: "goals", label: "GOLES", color: "cyan", format: "int" },
      ],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { x, halfW }`, `cpu { x, targetX, reactTimer }`, `balls: { x, y, vx, vy, speed, smashed, trail: {x,y}[] }[]`, `serveTimer`, `left`, `right` (teclas mantenidas), `smashWindowMs`, `smashCooldownMs`, `powerUp { type, x, y, ttlMs } | null`, `powerSpawnMs`, `effects { longMs, slowMs, shieldMs }`, `hits`, `combo`, `goals`, `level`, `lives`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("combo", mult)`, `onStat("goals", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("combo", 1)`, `onStat("goals", 0)`. Valor 0 oculta el stat (contrato de `onStat`); GOLES queda oculto hasta el primer gol, COMBO siempre visible (mínimo 1).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio`/`↑`/`W` ignoran `e.repeat` (un smash por pulsación); el movimiento es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `left = right = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Todos los temporizadores (saque, smash, power-ups, efectos, CPU) solo avanzan en juego.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Campo:** paredes laterales de **8 px** (la pelota, radio 7, rebota con su centro en `x = 15` y `x = 525`). Línea media discontinua en `y = 360` (decorativa). Gol del jugador: una pelota sale por `y < 0`. Gol de la CPU: sale por `y > 720`.
- **Palas:** alto 12 px, ancho **96 px** (`halfW = 48`). Jugador con centro en `y = 680` (cara de golpe `y = 674`); CPU con centro en `y = 40` (cara de golpe `y = 46`). Ambas empiezan en `x = 270`; su centro se limita a `[8 + halfW, 532 − halfW]`.
- **Movimiento del jugador:** **480 px/s** mientras se mantiene `←`/`A` o `→`/`D`; ambas a la vez = quieto. Sin inercia.
- **Pelota:** círculo de radio **7**. Velocidad de saque `serveSpeed(level) = min(360 + 20 × (level − 1), 520)` px/s; **+15 px/s** por golpe de cualquier pala, máximo **760 px/s**. Movimiento en sub-pasos de **≤ 6 px** por frame. Estela de las últimas 6 posiciones.
- **Saque:** cuando no queda ninguna pelota en juego, aparece una en (270, 360) quieta **700 ms** y sale hacia el jugador con ángulo aleatorio en **[−25°, +25°]** respecto a la vertical.
- **Rebote en pala:** solo si la pelota se mueve hacia esa pala y su círculo toca la pala. `offset = clamp((ballX − palaX) / (halfW + 7), −1, 1)`, ángulo de salida `= offset × 60°` respecto a la vertical, sentido vertical invertido, la pelota se recoloca pegada a la cara de golpe y `smashed = false` salvo smash.
- **Smash:** pulsar `Espacio`/`↑`/`W` con `smashCooldownMs ≤ 0` abre una ventana de **180 ms** y pone `smashCooldownMs = 600`. Si una pelota rebota en la pala del jugador dentro de la ventana: su velocidad pasa a `min(speed × 1.35, 760)`, `smashed = true`, **+25** puntos y destello blanco de 120 ms en la pala; la ventana se cierra. Pulsar durante el cooldown se ignora.
- **CPU** (`cpuParams(level)`):
  - Velocidad máxima `min(300 + 35 × (level − 1), 560)` px/s.
  - Recalcula su objetivo cada `max(50, 200 − 20 × (level − 1))` ms (`reactMs`).
  - Error de puntería: desplazamiento aleatorio uniforme en `±max(6, 40 − 5 × (level − 1))` px (`errorPx`) al recalcular; **×2** si la pelota seguida tiene `smashed = true`.
  - Sigue a la pelota que viene hacia ella (`vy < 0`) con menor `y`; objetivo = su `x` actual en niveles 1–2 y, desde **nivel 3** (`predict = true`), `predictX` en `y = 46` con reflejo en paredes.
  - Sin pelotas hacia ella o durante el saque: vuelve hacia `x = 270` al **50 %** de su velocidad. Zona muerta de 4 px.
- **Combo:** `hits` = devoluciones del jugador seguidas desde la última vida perdida. `comboMult(hits) = min(5, 1 + Math.floor(hits / 5))` → `onStat("combo", mult)` solo al cambiar.
- **Puntuación:**
  - **10 × mult** por cada golpe de la pala del jugador (se calcula con el `mult` previo al golpe).
  - **+25** por smash conectado (sin multiplicador).
  - Gol del jugador: **200 × level × mult**.
  - Recoger power-up: **+50**.
- **Goles y nivel:** cada pelota que sale por arriba suma `goals += 1` → `onStat("goals", goals)` y se retira; `level = levelFor(goals) = 1 + Math.floor(goals / 3)` (sin tope) → `onLevel(level)` al subir. Si no quedan pelotas, nuevo saque.
- **Vidas:** una pelota que sale por abajo se retira; si **era la última en juego**, `lives −= 1` → `onLives(lives)`, `hits = 0` (combo vuelve a 1), se cancelan los efectos activos y el power-up del campo, y nuevo saque. Si quedan otras pelotas, no hay penalización.
- **Power-ups:**
  - Como máximo **1** en el campo. `powerSpawnMs` cuenta mientras no hay power-up ni saque en curso; a los **9000 ms** aparece uno en `x` aleatoria en `[80, 460]` e `y` aleatoria en `[240, 480]`, radio **14**, vida **7000 ms** (luego desaparece y `powerSpawnMs = 0`).
  - Tipo uniforme entre 4. Se recoge cuando el centro de cualquier pelota queda a `≤ 21 px` (14 + 7) de su centro; la pelota no rebota. Siempre beneficia al jugador.
  - `L` **LARGA** (`#00ff88`): pala del jugador a **144 px** (`halfW = 72`) durante **8000 ms**; recoger otra reinicia el tiempo.
  - `V` **LENTA** (`#00f5ff`): todas las pelotas se desplazan al **70 %** de su `speed` durante **6000 ms** (la `speed` guardada no cambia).
  - `M` **MULTI** (`#ffe600`): si hay menos de **3** pelotas, nace una en la posición del power-up hacia la CPU con ángulo aleatorio en ±25° y velocidad `serveSpeed(level)`; con 3 pelotas solo da los +50.
  - `E` **ESCUDO** (`#ffffff`): barrera horizontal en `y = 704` de pared a pared durante **10000 ms**; la primera pelota que la cruza hacia abajo rebota (invierte `vy`) y el escudo desaparece. No cuenta como golpe ni suma combo.
- **Game over:** `lives` llega a 0 → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Dibujo:** fondo `#07000f` con rejilla `rgba(255,43,214,0.08)` cada 40 px; paredes `#2a0030` con borde `#ff2bd6`; línea media `rgba(255,255,255,0.3)`. Pala del jugador `#ff2bd6` con `shadowBlur` 14 (verde `#00ff88` en el borde mientras dura LARGA); pala CPU `#00f5ff`. Pelotas `#ffffff` con estela de alfa decreciente (amarilla `#ffe600` si `smashed`; tinte cyan mientras dura LENTA). Power-up: círculo con gradiente radial de su color, aro que parpadea a 4 Hz en sus últimos 2000 ms y su letra en negro, monoespaciada bold 14 px, centrada. Escudo: línea `rgba(255,255,255,0.8)` de 3 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila y ningún otro juego tiene `sort_order = 7`; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/balance.ts`. Verificar: `npm run lint`; `cpuParams(1) = { speed: 300, reactMs: 200, errorPx: 40, predict: false }`, `cpuParams(3).predict = true`, `cpuParams(9) = { speed: 560, reactMs: 50, errorPx: 6, predict: true }`; `serveSpeed(1) = 360`, `serveSpeed(9) = 520`, `serveSpeed(20) = 520`; `comboMult(0) = 1`, `comboMult(9) = 2`, `comboMult(40) = 5`; `levelFor(2) = 1`, `levelFor(3) = 2`.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): saque de 700 ms hacia el jugador, rebote en paredes y zonas de la pala, smash dentro y fuera de la ventana y cooldown, combo ×1→×2 a las 5 devoluciones, gol propio y subida de nivel a los 3 goles, los 4 power-ups (LARGA, LENTA, MULTI con tope de 3 pelotas, ESCUDO), perder una pelota extra sin perder vida, perder la última y perder vida, perder las 3, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu` vertical), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `DUELO`/`POWER-UPS`, dificultad 3, color magenta, categoría VERSUS); aparece con el filtro VERSUS.
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas 3:4 vertical sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven la pala a 480 px/s sin salir del campo; flechas y `Espacio` no hacen scroll.
- [ ] Cada saque deja la pelota quieta 700 ms en el centro y la lanza hacia el jugador a `serveSpeed(level)` (360 px/s en nivel 1) con ángulo dentro de ±25°.
- [ ] Cada golpe de pala suma 15 px/s hasta 760 px/s; el ángulo depende del punto de impacto (máx. 60°); la pelota nunca atraviesa una pala a velocidad máxima.
- [ ] Pulsar `Espacio` menos de 180 ms antes del golpe hace smash (×1.35, +25 puntos, estela amarilla); pulsarlo antes de tiempo no tiene efecto y hay que esperar 600 ms para volver a armarlo; mantenerlo pulsado no repite.
- [ ] Cada devolución suma 10 × COMBO; COMBO sube a ×2 a las 5 devoluciones seguidas, ×3 a las 10 y no pasa de ×5; vuelve a ×1 al perder una vida.
- [ ] Un gol del jugador suma 200 × nivel × COMBO y sube GOLES; cada 3 goles sube el nivel (CPU más rápida; predicción desde nivel 3).
- [ ] Cada 9 s de juego aparece un power-up que dura 7 s; tocarlo con la pelota suma 50 y aplica su efecto: LARGA (pala 144 px, 8 s), LENTA (70 %, 6 s), MULTI (nueva pelota, máximo 3 en juego), ESCUDO (salva un gol, 10 s).
- [ ] Con varias pelotas, perder una que no es la última no quita vida; perder la última quita 1 vida, cancela efectos y vuelve a sacar.
- [ ] Al perder la 3.ª vida se emite `onLives(0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, COMBO y GOLES; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pelotas, palas, CPU, saque, smash, power-ups y efectos; reanudar sin salto de tiempo ni pala "pegada".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve la pala ni arma el smash.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, COMBO 1, GOLES 0, una pelota en saque, sin power-ups ni efectos, palas centradas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión; `.cover-duelo` sin cambios.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** campo vertical 540×720 con pala horizontal; encaja mejor en móvil y es la diferencia visual con la variante 01. **No:** campo horizontal.
- **Sí:** supervivencia con 3 vidas globales; **No:** partidos a puntos ni escalera de rivales (variante 01).
- **Sí:** multiplicador de combo ×1–×5 y goles multiplicados por nivel; amplía el rango del leaderboard y premia la constancia.
- **Sí:** smash con ventana de 180 ms y cooldown de 600 ms; añade timing sin ser spameable. Duplica el error de la CPU para que tenga recompensa táctica.
- **Sí:** 4 power-ups positivos, uno a la vez, activados por la pelota (no por la pala); obliga a apuntar. **No:** power-ups negativos o para la CPU.
- **Sí:** multibola con tope de 3 y sin penalización por pelotas extra perdidas; solo la última cuesta vida.
- **Sí:** CPU que mejora cada 3 goles del jugador con reacción, velocidad y error por nivel, predicción desde nivel 3; **No:** CPU perfecta.
- **Sí:** stats `COMBO` (siempre ≥ 1, visible) y `GOLES` (oculto en 0 por contrato de `onStat`, se acepta).
- **Sí:** sub-pasos de 6 px contra el tunneling a 760 px/s.
- **Sí:** valores de balance (velocidades, tiempos, radios, puntos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS (llena la categoría vacía) y color magenta; **Sí:** `.cover-pong-vs-cpu` nueva vertical; **No:** reutilizar o modificar `.cover-duelo`.
- **No:** sonido, táctil, mouse, HiDPI, skins, 2 jugadores (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| La pelota atraviesa una pala a 760 px/s con `dt` de 50 ms (38 px por frame).           | Sub-pasos de ≤ 6 px con chequeo de colisión en cada uno, también para pelotas extra; criterio de aceptación.               |
| Multibola en niveles altos vuelve el juego caótico o imposible para la CPU.            | Tope de 3 pelotas; la CPU sigue solo la más cercana que va hacia ella; verificar nivel 5+ en el paso 6 y ajustar el spec.   |
| Bucle infinito de rebotes casi horizontales entre paredes.                             | Ángulo máximo 60° respecto a la vertical y saque limitado a ±25°.                                                           |
| Efectos o power-ups que siguen corriendo en pausa o tras perder vida.                  | Todos los temporizadores avanzan solo en juego; perder vida cancela efectos y power-up del campo.                          |
| Smash spameable manteniendo `Espacio`.                                                  | Ignorar `e.repeat`, ventana de 180 ms y cooldown de 600 ms desde la pulsación.                                              |
| `dt` grande tras pausar o cambiar de pestaña provoca un gol injusto.                   | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                        |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                     | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                        |
| Pala "pegada" en movimiento tras perder foco.                                          | `blur` y `pause` ponen `left`/`right` a `false`.                                                                            |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                      |
| El id con guiones requiere comillas en `ENGINES` y un nombre de migración válido.      | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`.                   |
| `sort_order` 7 choca si cambia la reserva de `missile-command`.                        | Paso 1 comprueba por `execute_sql` que nadie usa 7; huecos en el orden son válidos.                                         |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores local u online.
- Power-ups negativos, para la CPU, tienda o mejoras persistentes.
- Partidos a puntos y escalera de rivales.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
