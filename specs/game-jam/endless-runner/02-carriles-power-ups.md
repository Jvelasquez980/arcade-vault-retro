# SPEC GJ-endless-runner-02 — Juego real: ENDLESS RUNNER (variante: carriles y power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-23
> **Variant:** 02 de 2 — Runner moderno en vista cenital con 3 carriles: cambiar de carril y saltar vallas, recoger monedas y power-ups (escudo, imán, ×2), 3 vidas y dificultad por tiempo.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante carriles y power-ups) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Endless Runner. Reinterpreta el género al estilo runner de carriles moderno pero en 2D cenital: la pista avanza hacia abajo y el corredor, fijo en la parte inferior, **cambia entre 3 carriles** y **salta vallas bajas**; los **muros** solo se esquivan cambiando de carril. El puntaje combina distancia y **monedas**, y hay **power-ups** temporales (escudo, imán, ×2). Con **3 vidas** e invulnerabilidad tras cada golpe, la partida admite errores pero penaliza la velocidad. Se distingue de la variante 01 (vista lateral, un solo carril, saltar/agacharse, 1 vida y puntaje solo por distancia).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, círculos y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 3, tags `CARRILES` y `POWER-UPS`, 1 jugador, teclado. Canvas **480×640** (3:4). **3 vidas** (`initialLives: 3`), **nivel** sube cada 20 s (`showLevel: true`), stats extra `MONEDAS` y `MULTI`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/balance.ts`: funciones puras (`speedAt(runSec)`, `levelAt(elapsedMs)`, `pTwo(level)`, `wallProb(level)`, `nextSafeLane(lane, rand)`, `buildRow(level, safeLane, rand)`) y constantes (`LANE_X`, `RUNNER_Y`, `ROW_SPACING`, `JUMP_MS`, `POWER_MS`).
- Módulo `lib/games/endless-runner/draw.ts`: `drawRoad` (bordes y líneas de carril discontinuas en movimiento), `drawRunner` (escala según salto, parpadeo en invulnerabilidad, anillo de escudo), `drawFence`, `drawWall`, `drawCoin`, `drawPowerUp` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: fondo `linear-gradient(180deg,#0a0a18,#1a1400)` con `::after` que dibuja una pista en perspectiva (dos bordes amarillos convergentes y líneas de carril discontinuas) y una moneda amarilla brillante, con `filter: drop-shadow(0 0 6px rgba(255,230,0,0.6))`.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel**, stats extra `coins` ("MONEDAS", `int`) y `mult` ("MULTI", `int`).
- Sin HUD nativo de texto en el canvas, salvo la etiqueta efímera `+25`/`+50` al recoger moneda y el anillo/aura del power-up activo (efectos de juego, no overlays).
- Controles: `←`/`→` y `A`/`D` cambian de carril (uno por pulsación); `Espacio`, `↑` o `W` saltan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Tienda, mejoras persistentes de power-ups, personajes desbloqueables, misiones.
- Deslizarse/agacharse, trenes, rampas o tejados (capas de altura).
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('endless-runner', 'ENDLESS RUNNER', 'Cambia de carril, salta y junta monedas.',
       'Corre por una pista de tres carriles que no se detiene. Cambia de carril con las flechas o A/D para esquivar los muros y salta las vallas con Espacio. Recoge monedas y power-ups: escudo, imán y puntos dobles. Tienes tres vidas, pero cada golpe te frena; la pista se acelera cada 20 segundos.',
       'ARCADE', 'yellow', 'cover-endless-runner', 1, 1, '{keyboard}', '{CARRILES,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "coins", label: "MONEDAS", color: "yellow", format: "int" },
        { key: "mult", label: "MULTI", color: "magenta", format: "int" },
      ],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `lane` (0–2, destino), `runnerX` (px, animado), `jumpMs` (0 = en el suelo), `invulnMs`, `rows` y entidades `entities: { kind: "fence" | "wall" | "coin" | "shield" | "magnet" | "double", lane, x, y, w, h, taken }[]`, `safeLane`, `scrollSinceRow`, `distancePx`, `distanceScored`, `runSec`, `speed`, `shieldMs`, `magnetMs`, `doubleMs`, `labels: { text, x, y, ms }[]`, `elapsedMs`, `score`, `lives`, `level`, `coins`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("coins", n)`, `onStat("mult", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("coins", 0)`, `onStat("mult", 0)`.
- `onStat("mult", 2)` al activarse ×2 y `onStat("mult", 0)` al expirar (0 oculta el stat, contrato de `onStat`). `onStat("coins", n)` solo al recoger moneda.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Cambio de carril y salto ignoran `e.repeat` (una acción por pulsación).
- Pausa/blur/destroy no dejan teclas mantenidas (no hay acciones continuas); al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Los temporizadores (`jumpMs`, `invulnMs`, power-ups, etiquetas) solo avanzan en juego.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Pista:** de `x = 60` a `x = 420`, 3 carriles de 120 px con centros `LANE_X = [120, 240, 360]`. Fuera de la pista, franjas laterales oscuras. Las líneas de carril son discontinuas (tramos de 40 px cada 80 px) y bajan a la velocidad del mundo.
- **Corredor:** caja de **44×44 px** centrada en `(runnerX, RUNNER_Y = 540)`. Empieza en el carril 1 (centro). Cada pulsación `←`/`A` o `→`/`D` cambia `lane` en ±1 (sin efecto en los bordes); `runnerX` se mueve hacia `LANE_X[lane]` a **1000 px/s** (120 px en 120 ms). Se puede encadenar otra pulsación durante el movimiento.
- **Salto:** `Espacio`/`↑`/`W` solo en el suelo; dura `JUMP_MS = 600` ms. En el aire el corredor pasa sobre `fence` pero no sobre `wall`; se dibuja con escala `1 + 0.3 × sin(π × t / 600)` y sombra en el suelo.
- **Velocidad del mundo:** `speed = speedAt(runSec) = min(300 + 6 × runSec, 720)` px/s. `runSec` suma `dt` en juego; cada golpe sin escudo le resta **10 s** (mínimo 0).
- **Nivel:** `level = levelAt(elapsedMs) = 1 + Math.floor(elapsedMs / 20000)` (sin tope). Al subir: `onLevel(level)` y +**100 × level** puntos (sin multiplicador).
- **Filas:** cada `ROW_SPACING = 200` px de desplazamiento nace una fila en `y = −60`; la primera tras 600 px. `safeLane = nextSafeLane(anterior)`: −1/0/+1 equiprobable; en un borde, 0 o hacia dentro al 50 %. El carril seguro nunca tiene obstáculo.
- **Obstáculos de la fila** (en los 2 carriles no seguros): cantidad 0 con prob. **0.25**, 2 con `pTwo(level) = min(0.3 + 0.05 × (level − 1), 0.7)` y 1 con el resto (`max(0, 1 − 0.25 − pTwo)`; si es negativo se recorta `pTwo`). Cada obstáculo es `wall` (**100×60 px**) con `wallProb(level) = min(0.4 + 0.05 × (level − 1), 0.7)` y si no `fence` (**100×24 px**), centrados en el carril.
- **Monedas:** en el carril seguro, con prob. **0.6**, una moneda (radio 10) en el centro de la fila. Sobre cada `fence`, con prob. **0.3**, una moneda que solo se recoge en el aire. Cada moneda vale **25** puntos (× multiplicador) y suma 1 a `coins`.
- **Power-ups:** con prob. **0.05** por fila sustituyen a la moneda del carril seguro; el tipo se sortea equiprobable entre los que no están activos (si los 3 lo están, se pone moneda). Dibujados como rombo de 28 px con letra (`E`, `I`, `×2`).
  - `shield` (escudo): dura **12 s** o hasta absorber un golpe.
  - `magnet` (imán): **8 s**; toda moneda con centro a ≤ **160 px** del corredor vuela hacia él a **900 px/s** y se recoge al tocarlo (también las de vallas, sin saltar).
  - `double` (×2): **10 s**; multiplica por 2 los puntos de distancia y de monedas; `onStat("mult", 2)` / `onStat("mult", 0)`.
- **Puntaje por distancia:** +**5** puntos (× multiplicador) por cada 100 px desplazados (`distanceScored` lleva la cuenta).
- **Colisión:** AABB con cajas reducidas **4 px** por lado. Golpe con `wall` siempre; con `fence` solo en el suelo. Durante `invulnMs > 0` no hay golpes.
  - Con escudo: se consume, el obstáculo desaparece, `invulnMs = 500`, sin perder vida.
  - Sin escudo: `lives −1` → `onLives(lives)`, el obstáculo desaparece, `invulnMs = 1500` (parpadeo cada 100 ms) y `runSec −= 10`.
- **Game over:** al llegar a 0 vidas → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Limpieza:** entidades con `y > 700` se eliminan. Etiquetas de moneda: `+25` (o `+50` con ×2), suben 30 px y se desvanecen en 600 ms.
- **Dibujo:** fondo `#0a0a18`; pista `#14141f` con bordes `#ffe600` y líneas de carril `rgba(255,255,255,0.3)`. Corredor `#00f5ff` con sombra `rgba(0,0,0,0.4)`. `fence` `#ff9900` con franjas `#05050f`; `wall` `#ff2bd6` con borde `#ffffff`. Monedas `#ffe600` con brillo radial. Power-ups: escudo `#00f5ff`, imán `#ff3355`, ×2 `#00ff88`. Anillo de escudo `rgba(0,245,255,0.6)`, aura del imán `rgba(255,51,85,0.25)`. Todo desde `PALETTE`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/endless-runner/balance.ts`. Verificar: `npm run lint`; `speedAt(0) = 300`, `speedAt(70) = 720`, `speedAt(200) = 720`, `levelAt(19999) = 1`, `levelAt(20000) = 2`, `pTwo(1) = 0.3`, `pTwo(20) = 0.7`, `wallProb(1) = 0.4`, `wallProb(20) = 0.7`; `buildRow` nunca pone obstáculo en `safeLane` y `nextSafeLane` nunca salta 2 carriles.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cambio de carril en bordes, saltar valla, muro no saltable, moneda sobre valla solo en el aire, cada power-up (escudo absorbe, imán atrae, ×2 duplica y muestra MULTI), golpe con pérdida de vida, invulnerabilidad y frenado, subida de nivel a los 20 s, perder 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CARRILES`/`POWER-UPS`, dificultad 3, color yellow, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` cambian un carril por pulsación en 120 ms; mantener pulsado no repite; en los bordes no hay efecto; flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`/`↑`/`W` saltan 600 ms solo desde el suelo; en el aire se pasa sobre vallas pero un muro golpea.
- [ ] Cada fila deja libre un carril seguro contiguo (o igual) al de la fila anterior; nunca hay 3 obstáculos en una fila.
- [ ] La velocidad empieza en 300 px/s, sube 6 px/s por segundo, se fija en 720 px/s; cada golpe sin escudo resta 10 s a `runSec` (hasta 60 px/s menos, según `speedAt`).
- [ ] Distancia: +5 por cada 100 px; moneda: +25; nivel: +100 × nivel cada 20 s; con ×2 activo distancia y monedas valen el doble y MULTI muestra 2 durante 10 s.
- [ ] Las monedas sobre vallas solo se recogen saltando (o con imán); MONEDAS en el HUD sube 1 por moneda.
- [ ] El escudo absorbe un golpe (o expira a los 12 s) sin perder vida; el imán atrae monedas a ≤ 160 px durante 8 s.
- [ ] Un golpe sin escudo baja una vida, elimina el obstáculo y da 1500 ms de invulnerabilidad con parpadeo.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, MONEDAS y MULTI; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pista, salto, invulnerabilidad y power-ups; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni salta.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, MONEDAS 0, MULTI oculto, carril central, velocidad 300, sin power-ups ni entidades).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista cenital con 3 carriles discretos; es la diferencia central con la variante 01 y encaja con teclado (una pulsación = un carril). **No:** vista lateral ni movimiento libre.
- **Sí:** dos tipos de obstáculo (valla saltable, muro solo esquivable); **No:** agacharse ni capas de altura.
- **Sí:** carril seguro garantizado y contiguo; evita filas imposibles a velocidad tope.
- **Sí:** monedas y tres power-ups temporales (escudo, imán, ×2); amplían el rango del leaderboard y premian el riesgo. **No:** tienda ni mejoras persistentes.
- **Sí:** 3 vidas con invulnerabilidad 1500 ms y frenado de 10 s de `runSec`; el golpe cuesta vida y ritmo de puntos. **No:** vidas extra.
- **Sí:** nivel por tiempo (cada 20 s) con bonus 100 × nivel y más obstáculos/muros; velocidad independiente del nivel.
- **Sí:** stats `MONEDAS` y `MULTI`; reflejan la economía propia de la variante.
- **Sí:** valores de balance (velocidades, probabilidades, duraciones, tamaños, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color yellow (monedas); **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 480×640 (3:4); la vista cenital necesita ver lejos en vertical.
- **No:** sonido, táctil/swipe, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                 | Mitigation                                                                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Filas imposibles a 720 px/s (200 px = 278 ms entre filas).                           | Carril seguro solo se mueve ±1 y el cambio tarda 120 ms; verificar a velocidad tope en el paso 6.               |
| Muchos power-ups seguidos rompen el balance del leaderboard.                         | Prob. 0.05 por fila, nunca uno ya activo, duraciones fijas; ajustar solo editando el spec.                      |
| Golpe doble con el mismo obstáculo o dos obstáculos en el mismo frame.               | El obstáculo se elimina al golpear y se activa `invulnMs` antes de seguir evaluando colisiones.                 |
| `onScore` demasiado frecuente satura React.                                          | Distancia a pasos de 100 px (máx. 7,2 cambios/s) y emisión solo al cambiar.                                     |
| `dt` grande tras pausar o cambiar de pestaña atraviesa obstáculos o salta temporizadores. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; temporizadores solo avanzan en juego.  |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Doble loop / listeners por StrictMode.                                               | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                          |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                   | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración con `_` en el nombre.   |
| Next 16 difiere del conocimiento previo.                                             | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                 |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Tienda, mejoras persistentes, personajes, misiones y récords locales.
- Deslizarse, trenes, rampas y capas de altura.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
