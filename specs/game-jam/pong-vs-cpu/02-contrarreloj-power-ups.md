# SPEC GJ-pong-vs-cpu-02 — Juego real: PONG VS CPU (variante: contrarreloj con power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-24
> **Variant:** 02 de 2 — Pong vertical arcade de 90 s: pala con movimiento en 2 ejes y remate, combo de goles, power-ups en el campo y una CPU que acelera con el reloj.
> **Objective:** Crear un motor TypeScript de Pong contra la CPU a contrarreloj dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Pong vs CPU. Reinterpreta Pong como un arcade de puntuación en **vertical**: el jugador defiende la parte inferior y la CPU la superior. La partida dura **90 segundos** y no hay vidas: cada gol en contra **resta 5 s** al reloj y reinicia el **combo**. La pala se mueve en **dos ejes** dentro de su zona y, si golpea mientras avanza hacia arriba, **remata** (la bola sale más rápida). En el centro aparecen **power-ups** que se activan al tocarlos con una bola golpeada por el jugador. La CPU se endurece con el tiempo transcurrido, no por sets. Se distingue de la variante 01 (horizontal, fiel a 1972, sets a 7, 5 vidas, sin reloj ni power-ups): aquí gana quien marque más rápido y encadene goles.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con formas y gradientes. Existe `.cover-duelo` (prototipo) en `app/globals.css`, pero no se reutiliza: se crea `.cover-pong-vs-cpu` para respetar la convención `cover-<id>`.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 y el 6 lo reserva la propuesta `missile-command`), dificultad 3, tags `CONTRARRELOJ` y `POWER-UPS`, 1 jugador, teclado. Canvas **480×640** (3:4, vertical). **Sin vidas** (sin `initialLives`) y **sin nivel** (`showLevel` false); stats extra `TIEMPO` y `COMBO`. Sin HUD nativo, sin sonido ni imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/ai.ts`: funciones puras `cpuConfig(elapsedS) → { speed, aimError }` y `predictX(x, y, vx, vy, targetY, left, right) → number` (x de llegada con rebotes en las paredes laterales).
- Módulo `lib/games/pong-vs-cpu/powerups.ts`: tipo `PowerUpKind = "grande" | "multibola" | "lento" | "tiempo"`, constantes de duración y `pickKind(rand) → PowerUpKind` (uniforme).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawCourt`, `drawPaddle`, `drawBall` (con estela de 4 posiciones), `drawPowerUp` (círculo con glifo de formas por tipo) y `drawEffectBar` (barras finas de duración de efectos activos junto a la pala, parte del escenario). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `linear-gradient(180deg,#2a0030,#0a0a18)`, `::after` con red horizontal discontinua al 50% de altura, pala magenta arriba (50% / 10%, 30% × 6 px), pala cyan abajo (40% / 88%) y bola circular blanca; `::before` con un círculo radial amarillo (power-up) a 70% / 40%.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje y stats extra `time` ("TIEMPO", `seconds`) y `combo` ("COMBO", `int`). Sin vidas ni nivel.
- Sin HUD nativo de texto en el canvas. Sin overlays.
- Controles: `←`/`→` y `A`/`D` mueven la pala en horizontal; `↑`/`↓` y `W`/`S` la avanzan o retroceden dentro de su zona. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Power-ups negativos o para la CPU, más de 2 bolas, modo 2 jugadores, selector de duración.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Marca todo lo que puedas en 90 segundos.',
       'Mueve tu pala con las flechas o WASD y marca goles a la CPU antes de que acabe el reloj. Golpea avanzando para rematar, encadena goles para subir el combo hasta ×5 y toca los power-ups con tu bola: pala grande, multibola, cámara lenta y tiempo extra. Cada gol en contra te quita 5 segundos y reinicia el combo; la CPU se vuelve más rápida a medida que pasa el tiempo.',
       'ARCADE', 'magenta', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{CONTRARRELOJ,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 480, height: 640,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { x, y, w, vx, vy }`, `cpu { x, targetX, reactAcc, aimErr }`, `balls: { x, y, vx, vy, speed, lastHit: "player" | "cpu" | null, trail }[]` (máx. 2), `powerUp { x, y, kind, ttlMs } | null`, `spawnMs`, `effects { grandeMs, lentoMs }`, `keysDown: Set<string>`, `phase: "serve" | "play"`, `serveMs`, `timeLeftMs`, `elapsedMs`, `combo`, `score`, `lastTimeTenths`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onStat("time", s)` solo cuando cambian las décimas mostradas (`Math.ceil(timeLeftMs / 100) / 10`), `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onStat("time", 90)`, `onStat("combo", 1)`.
- Sin vidas: no se emite `onLives`. Game over: `onStat("time", 0)` (oculta el stat, contrato de `onStat`) y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Movimiento continuo con `keysDown` (no depende de `e.repeat`).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El reloj, los efectos, el power-up y el saque solo avanzan con el juego activo.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Campo:** paredes laterales de 10 px (`x ∈ [0, 10]` y `[470, 480]`); zona jugable `x ∈ [10, 470]`. Portería de la CPU = borde superior (`y < 0`); del jugador = borde inferior (`y > 640`). Red horizontal discontinua en `y = 319..321`.
- **Pala del jugador:** 80×12 px (ancho base `w = 80`), empieza centrada con borde superior en `y = 580`. Velocidad **420 px/s** en cada eje (diagonales sin normalizar). Zona permitida: `x` dentro de la zona jugable y borde superior `y ∈ [520, 610]`. `vx`/`vy` son la velocidad real del frame (0 si no se mueve).
- **Pala de la CPU:** 80×12 px, borde superior en `y = 28`, solo se mueve en horizontal.
- **Bola:** círculo de radio **7 px**. Velocidad inicial **320 px/s**; **+18 px/s** por golpe de pala, máximo **720 px/s**. Subpasos de como mucho **5 px**.
- **Rebote en pala:** solo si la bola se mueve hacia esa pala y su círculo toca el rectángulo. `o = clamp((ballX − paddleCenterX) / (w / 2), −1, 1)`; ángulo = `o × 60°` respecto a la vertical; `vy` cambia de sentido; la bola se recoloca pegada a la cara. En golpes del jugador, además, `vx += 0.25 × player.vx` (efecto), luego se renormaliza a `speed` y el ángulo se limita a ±70°. `lastHit` se actualiza.
- **Remate:** si al golpear `player.vy < 0` (pala avanzando), la bola gana **+80 px/s** extra en ese golpe (respetando el máximo de 720) y se suman **15** puntos extra.
- **Saque:** cuando no queda ninguna bola en juego, aparece una en el centro (240, 320), espera **800 ms** (`phase = "serve"`) y sale hacia el jugador (abajo) con ángulo aleatorio uniforme en `[−25°, 25°]` a 320 px/s, con `lastHit = null`. El reloj sigue corriendo durante el saque.
- **CPU** (`cpuConfig(elapsedS)`, con `t = elapsedMs / 1000`):
  - Velocidad máxima: `260 + 3 × t` px/s (260 al empezar, 530 a los 90 s; el tiempo extra puede subirla más, sin tope).
  - Error de puntería: `aimError = max(40 − 0.3 × t, 12)` px; `aimErr` se sortea uniforme en `[−aimError, aimError]` en cada golpe del jugador y en cada saque.
  - Recalcula `targetX` cada **100 ms**: elige, entre las bolas que suben (`vy < 0`), la que llegará antes a `y = 40`, y usa `predictX(...) + aimErr`. Si ninguna sube, vuelve al centro (`targetX = 240`) a la mitad de su velocidad. Zona muerta de 4 px.
- **Goles:**
  - Bola sale por arriba: gol del jugador. `score += 100 × combo`, luego `combo = min(combo + 1, 5)` (`onStat("combo")`).
  - Bola sale por abajo: gol de la CPU. `timeLeftMs −= 5000` y `combo = 1`. Si `timeLeftMs ≤ 0`, termina la partida.
  - La bola que sale se elimina; si queda otra en juego, el juego sigue sin saque.
- **Puntuación extra:** golpe de pala del jugador **5**; remate **+15**; recoger power-up **25**.
- **Power-ups:**
  - Solo uno en el campo a la vez. El primero aparece a los **8 s** de juego; después, **10 s** después de que el anterior se recoja o caduque (`spawnMs`). Posición aleatoria con `x ∈ [60, 420]`, `y ∈ [200, 440]`. Círculo de radio **14 px**; caduca a los **8 s** (`ttlMs`) si nadie lo toca.
  - Se recoge cuando una bola con `lastHit = "player"` lo toca. Si lo toca una bola con `lastHit` `"cpu"` o `null`, la bola lo atraviesa sin efecto y el power-up sigue.
  - Tipo uniforme entre 4 (`pickKind`):
    - `grande`: pala del jugador de 80 a **120 px** de ancho durante **10 s** (recoger otro reinicia el tiempo); se mantiene centrada al crecer o encoger.
    - `multibola`: añade una 2.ª bola en la posición del power-up, hacia arriba con ángulo aleatorio en `[−20°, 20°]`, a la velocidad de la bola que lo tocó y con `lastHit = "player"`. Si ya hay 2 bolas, da **+100** puntos en su lugar.
    - `lento`: todas las bolas se mueven a **×0.6** de su velocidad durante **6 s** (no cambia `speed`, solo el desplazamiento por frame).
    - `tiempo`: **+5 s** al reloj (máximo 99 s).
- **Fin:** cuando `timeLeftMs` llega a 0 (por el reloj o por la penalización) → `onStat("time", 0)` y `onGameOver(score)` en ese frame.
- **Dibujo:** fondo `#0a0a18` con degradado a `#1a0024` en la mitad de la CPU; paredes `#ff2bd6`; red `#ffffff` al 30%. Pala del jugador `#00f5ff` con `shadowBlur` 12; pala de la CPU `#ff2bd6`. Bola `#ffffff` con estela de 4 círculos decrecientes al 40/30/20/10%. Power-ups con gradiente radial y anillo que parpadea (2 Hz) en sus últimos 2 s: `grande` `#00f5ff` (rectángulo ancho), `multibola` `#ffe600` (dos círculos), `lento` `#39ff14` (dos barras), `tiempo` `#ffffff` (arco de reloj). Barras de efecto de 3 px bajo la pala del jugador (cyan para `grande`, verde para `lento`) que se acortan con el tiempo restante.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/ai.ts` y `powerups.ts`. Verificar: `npm run lint`; `cpuConfig(0)` da 260 px/s y error 40 px; `cpuConfig(90)` da 530 px/s y error 13 px; `predictX` con un rebote lateral devuelve la x reflejada correcta.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover la pala en 2 ejes, devolver con ángulo y efecto, rematar, marcar goles seguidos (combo ×1 → ×5), recibir gol (−5 s y combo a 1), recoger los 4 power-ups, comprobar que una bola de la CPU no los recoge, multibola con gol de una sola bola, agotar el reloj, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'` (y registrar el `update` en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu`), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`POWER-UPS`, dificultad 3, color magenta, categoría ARCADE).
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas vertical 3:4 sin desborde a 375 px y 1280 px.
- [ ] Flechas y `WASD` mueven la pala a 420 px/s en ambos ejes, sin salir de la zona (`y` superior entre 520 y 610); las flechas no hacen scroll.
- [ ] La bola sale tras 800 ms hacia el jugador a 320 px/s, sube 18 px/s por golpe y no pasa de 720 px/s; nunca atraviesa una pala.
- [ ] Golpear mientras la pala avanza remata: +80 px/s en ese golpe y 5 + 15 puntos.
- [ ] Goles del jugador seguidos suman 100, 200, 300, 400, 500, 500… (combo ×1 a ×5) y COMBO lo refleja.
- [ ] Un gol de la CPU resta exactamente 5 s a TIEMPO y devuelve COMBO a 1.
- [ ] El primer power-up aparece a los 8 s, caduca a los 8 s si no se toca y el siguiente sale 10 s después; solo lo recoge una bola golpeada por el jugador (+25).
- [ ] `grande` deja la pala en 120 px durante 10 s; `multibola` añade una 2.ª bola (o +100 si ya hay 2); `lento` ralentiza las bolas a ×0.6 durante 6 s; `tiempo` suma 5 s sin pasar de 99.
- [ ] Con 2 bolas, perder una no provoca saque; el saque llega cuando no queda ninguna.
- [ ] La CPU empieza a 260 px/s y se acelera con el tiempo (≈530 px/s a los 90 s); sigue la bola que sube y llega antes.
- [ ] TIEMPO empieza en 90.0 y baja por décimas; al llegar a 0 se emite `onStat("time", 0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] El HUD de React muestra puntaje, TIEMPO y COMBO, sin vidas ni nivel; sin eventos por frame (TIEMPO como mucho 10 por segundo).
- [ ] Pausa (botón y `P`) congela bolas, palas, reloj, efectos, power-up y saque; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`) no mueve la pala.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 90.0, COMBO 1, una bola en saque, sin power-up ni efectos, pala de 80 px centrada).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de este spec; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo con primitivas y gradientes Canvas 2D; **No:** imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** contrarreloj de 90 s con penalización de 5 s por gol en contra. Da una partida corta y un fin claro. **No:** vidas (el HUD no las muestra y no se emite `onLives`).
- **Sí:** orientación vertical 480×640, que encaja mejor en móvil para el futuro port táctil. **No:** reutilizar el layout horizontal de la variante 01.
- **Sí:** movimiento en 2 ejes con remate y efecto, que dan profundidad mecánica. **No:** pala libre en todo el campo (rompería el duelo).
- **Sí:** combo ×1–×5 por goles seguidos; premia el ataque y separa puntajes en el leaderboard.
- **Sí:** 4 power-ups positivos que solo se recogen con una bola propia; **No:** power-ups para la CPU ni negativos (spec aparte).
- **Sí:** máximo 2 bolas; **No:** multibola ilimitada (la CPU solo defiende con una pala y el juego se volvería caótico).
- **Sí:** dificultad de la CPU ligada al tiempo transcurrido; **No:** niveles (`showLevel` false).
- **Sí:** `cat` ARCADE y color magenta; **Sí:** `.cover-pong-vs-cpu` nueva; **No:** reutilizar `.cover-duelo`.
- **Sí:** valores de balance (tiempos, velocidades, puntos, duración de efectos) fijados en este spec, ajustables solo editándolo.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                              | Mitigation                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| La bola atraviesa la pala a 720 px/s o cuando la pala avanza contra ella (túnel). | Subpasos de 5 px; colisión círculo-rectángulo con la posición de la pala ya actualizada en el frame.          |
| Ángulos casi horizontales por el efecto dejan la bola rebotando entre paredes.    | Ángulo limitado a ±70° respecto a la vertical tras aplicar el efecto.                                          |
| Emitir TIEMPO por frame satura React.                                             | Emitir solo cuando cambian las décimas mostradas (máx. 10/s); criterio de aceptación.                          |
| Multibola deja estados incoherentes (saque con bola viva, CPU indecisa).          | Saque solo con `balls` vacío; la CPU elige la bola que sube y llega antes.                                     |
| La penalización deja el reloj negativo sin cerrar la partida.                     | Comprobar `timeLeftMs ≤ 0` justo tras restar y terminar en ese frame.                                          |
| CPU imbatible al final o trivial al principio.                                    | Parámetros en `cpuConfig` con valores de este spec; validar a 0 s, 45 s y 90 s en el paso 6.                   |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o teletransporta bolas. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; reloj solo avanza con el juego activo.    |
| Teclas `WASD` o flechas interfieren con el input del modal / tecla "pegada".      | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo; `blur` y `pause` vacían `keysDown`.   |
| Doble loop / listeners por StrictMode.                                            | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones requiere comillas en `ENGINES` y la migración usa `_`.          | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`.      |
| Next 16 difiere del conocimiento previo.                                          | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Power-ups negativos o para la CPU, más de 2 bolas, selector de duración, modo 2 jugadores.
- HUD nativo de texto y overlays de pausa/game over dentro del canvas.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
