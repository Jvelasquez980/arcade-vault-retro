# SPEC GJ-missile-command-02 — Juego real: MISSILE COMMAND (variante: torreta de cadena) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-15
> **Variant:** 02 de 2 — Supervivencia moderna: una torreta central que apunta por ángulo, un solo misil en vuelo con detonación manual, munición infinita, reacciones en cadena que multiplican puntos y dificultad continua por tiempo.
> **Objective:** Crear un motor TypeScript de Missile Command (variante torreta de cadena) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/missile-command` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Missile Command. Reinterpreta el clásico para teclado puro: en lugar de mira libre y tres baterías, hay **una torreta central** que gira con `←/→` y lanza **un misil a la vez**; el jugador decide **cuándo detonarlo** pulsando de nuevo `Espacio`. No hay munición que gestionar; el reto es el **timing** y encadenar **reacciones en cadena**: cada enemigo destruido explota y puede destruir a otros, y cada eslabón vale más. No hay oleadas: el bombardeo es continuo y la dificultad sube cada 30 s. Se distingue de la variante 01 (clásica: mira libre, 3 baterías con munición por oleada, bonus por oleada, bombarderos).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas, líneas y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-missile-command`.

Decisiones fijadas por el agente (no se reabren): `id` `missile-command`, título `MISSILE COMMAND`, `cat` `ARCADE`, color `magenta`, `sort_order` **6** (siguiente libre; frogger = 5), dificultad 4, tags `DEFENSA` y `CADENAS`, 1 jugador, teclado. Canvas **600×600** (1:1). **4 ciudades = 4 vidas** (`initialLives: 4`), **nivel** sube cada 30 s (`showLevel: true`), stats extra `TIEMPO` y `MEJOR CADENA`. La torreta es indestructible. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/missile-command/engine.ts`: sin globals de módulo; exporta `missileCommandDef: GameEngineDef` con `createMissileCommand(canvas, events) → GameController`.
- Módulo `lib/games/missile-command/balance.ts`: funciones puras (`levelAt(elapsedMs)`, `spawnMs(level)`, `enemySpeed(level)`, `rollEnemyType(level, rand)`, `chainPoints(depth, factor)`) y constantes (`CITY_X`, `GROUND_Y`, `TURRET`).
- Módulo `lib/games/missile-command/draw.ts`: `drawSky`, `drawGround`, `drawCity`, `drawTurret` (con guía de apuntado), `drawTrail`, `drawExplosion`, `drawChainLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"missile-command"` en `lib/games/registry.ts`.
- Clase `.cover-missile-command` en `app/globals.css`: cielo `radial-gradient(circle at 50% 100%,#2a0030,#0a0a18)` con `::after` de torreta/suelo magenta y `::before` de tres círculos concéntricos encadenados (explosiones) magenta/blanco.
- Migración `add_game_missile_command`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **4 vidas** (= ciudades vivas), **nivel**, stats extra `time` ("TIEMPO", `seconds`) y `chain` ("MEJOR CADENA", `int`).
- Sin HUD nativo de texto en el canvas, salvo la etiqueta efímera `×N` sobre una cadena (efecto de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` giran la torreta; `Espacio` (o `↑`/`W`) lanza el misil o lo detona si ya está en vuelo. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'missile-command'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `missile-command`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Varias torretas, munición limitada, oleadas con bonus, bombarderos o power-ups.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('missile-command', 'MISSILE COMMAND', 'Detona a tiempo y encadena explosiones.',
       'Gira la torreta con las flechas o A/D y lanza un misil con Espacio; vuelve a pulsar para detonarlo donde quieras. Cada misil enemigo destruido explota y puede arrastrar a otros: cuanto más larga la cadena, más vale cada eslabón. El bombardeo no se detiene y se acelera cada 30 segundos; la partida termina cuando caen tus cuatro ciudades.',
       'ARCADE', 'magenta', 'cover-missile-command', 1, 1, '{keyboard}', '{DEFENSA,CADENAS}', 4, 6, false);

Definición del motor:

    export const missileCommandDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 4,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "chain", label: "MEJOR CADENA", color: "magenta", format: "int" },
      ],
      create: createMissileCommand,
    };

Estado interno (dentro de `createMissileCommand`): `angle` (grados, 0 = vertical), `turnLeft`, `turnRight` (teclas mantenidas), `shot { x, y, vx, vy, chainId } | null`, `cooldownMs`, `explosions: { x, y, r, age, maxR, growMs, holdMs, shrinkMs, depth, chainId, owner: "player" | "enemy" }[]`, `enemies: { x, y, vx, vy, type: "normal" | "fast" | "split", factor, splitDone }[]`, `chains: Map<chainId, { count, x, y }>`, `labels: { text, x, y, ms }[]`, `cities: boolean[4]`, `elapsedMs`, `level`, `spawnTimer`, `score`, `nextRebuildAt`, `bestChain`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives` (ciudades vivas), `onLevel`, `onStat("time", s)`, `onStat("chain", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(4)`, `onLevel(1)`, `onStat("time", 0)`, `onStat("chain", 0)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.floor(elapsedMs / 1000)` (una vez por segundo). `onStat("chain", n)` solo cuando `bestChain` sube. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio`/`↑`/`W` ignoran `e.repeat` (una acción por pulsación); el giro es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `turnLeft = turnRight = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** suelo de `y = 560` a `600`. Torreta: base semicircular de radio 22 centrada en (300, 560), pivote en (300, 545), cañón de **28 px**. Ciudades (56×22 px, base en `y = 560`) con centro en x = **80, 180, 420, 520**.
- **Apuntado:** `angle` empieza en 0° (vertical). `←`/`A` lo restan y `→`/`D` lo suman a **150 °/s**, limitado a `[−75°, +75°]`. Se dibuja una guía punteada de **120 px** desde la punta del cañón.
- **Lanzar / detonar** (`Espacio`, `↑`, `W`):
  - Si no hay `shot` y `cooldownMs ≤ 0`: lanza un misil desde la punta del cañón a **560 px/s** en la dirección de `angle`, con nuevo `chainId`.
  - Si hay `shot`: lo detona en su posición actual.
  - Si hay `cooldownMs > 0` y no hay `shot`: la pulsación se ignora.
  - El misil se autodetona si `y ≤ 20`, `x < 10` o `x > 590`.
  - Tras cada detonación, `cooldownMs = 200`.
- **Explosión del jugador (eslabón 1):** radio 0 → **56 px** en 250 ms, se mantiene 250 ms, 56 → 0 en 300 ms (800 ms). `depth = 1`.
- **Reacción en cadena:** todo enemigo cuya cabeza quede a distancia `≤ r` de una explosión del jugador con profundidad `d` muere y genera una explosión del jugador con `depth = d + 1`, mismo `chainId`, radio 0 → **34 px** en 150 ms, mantenida 150 ms, 34 → 0 en 200 ms (500 ms). Cada enemigo muere una sola vez.
- **Puntos por eslabón:** `10 × min(depth_de_la_explosión_que_lo_mata, 10) × factor` (normal y fragmento de divisor factor 1; rápido y divisor sin dividir factor 2). Ej.: un enemigo normal destruido por la explosión inicial vale 10; el que destruye su explosión vale 20; el siguiente 30.
- **Bonus de cadena:** cuando ya no quedan explosiones activas de un `chainId`, si destruyó `count ≥ 3` enemigos se suma **50 × (count − 2)** y se muestra la etiqueta `×count` en el punto de la detonación durante 800 ms. Si `count > bestChain`, `bestChain = count` y `onStat("chain", count)`.
- **Nivel:** `level = 1 + Math.floor(elapsedMs / 30000)` (sin tope). Al subir: `onLevel(level)` y +**100 × level** puntos.
- **Aparición de enemigos:** el primero a los 1000 ms; luego cada `max(450, 1800 − 150 × (level − 1))` ms. Cada aparición lanza 1 enemigo; desde `level ≥ 3` con probabilidad **0.25** lanza 2. Nacen en `y = 0`, `x` aleatoria en `[20, 580]`, con objetivo en una ciudad viva al azar (`x` aleatoria en `centro ± 20`, `y = 560`). La torreta nunca es objetivo.
- **Tipos de enemigo** (velocidad base `v = min(45 + 7 × (level − 1), 120)` px/s):
  - `normal`: velocidad `v`, factor 1, estela `#ff3355`.
  - `fast` (desde nivel 3, probabilidad **0.2**): velocidad `1.8 × v`, factor 2, estela `#ffe600`.
  - `split` (desde nivel 4, probabilidad **0.15**): velocidad `v`, factor 2, estela `#00ff88`; al cruzar `y = 220` se divide una vez en 3 `normal` (factor 1) hacia ciudades vivas al azar.
  - El tipo se sortea en orden `fast` → `split` → `normal`.
- **Impacto enemigo:** al llegar a `y = 560` crea una explosión enemiga (0 → **28 px** en 300 ms y de vuelta a 0 en 300 ms; no destruye enemigos ni encadena) y destruye la ciudad cuyo rango `[centro − 28, centro + 28]` contiene la `x` de impacto, si sigue viva → `onLives(vivas)`.
- **Reconstrucción:** cada **4000** puntos (`nextRebuildAt` 4000, 8000, …), si hay ciudades destruidas se reconstruye la de menor índice → `onLives(vivas)`. Si no hay ninguna destruida, ese umbral se consume sin efecto.
- **Game over:** al caer la 4.ª ciudad → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Tiempo:** `elapsedMs` suma `dt` solo en juego (no en pausa ni tras game over).
- **Dibujo:** cielo `#05000f` con gradiente a `#1a0030` en el horizonte; suelo `#2a0030` con borde `#ff2bd6`. Torreta `#ff2bd6` con cañón blanco; guía punteada `rgba(255,255,255,0.35)`. Ciudades: 3 edificios `#00f5ff` con ventanas; destruidas: escombro `#333`. Misil propio: punto blanco de 3 px con estela `#ff2bd6`. Explosiones del jugador: gradiente radial blanco → `#ff2bd6` → transparente; las de profundidad ≥ 2 viran a `#ffe600`. Explosiones enemigas: `#ff3355`. Etiqueta de cadena: texto `×N` `#ffffff`, 18 px, fuente monoespaciada, sube 30 px y se desvanece.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-missile-command` en `app/globals.css`. Aplicar migración `add_game_missile_command` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'missile-command'` muestra la fila; `npm run build`.
2. Crear `lib/games/missile-command/balance.ts`. Verificar: `npm run lint`; `spawnMs(1) = 1800`, `spawnMs(10) = 450`, `enemySpeed(1) = 45`, `enemySpeed(20) = 120`, `chainPoints(3, 2) = 60`, `chainPoints(12, 1) = 100`.
3. Crear `lib/games/missile-command/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/missile-command/engine.ts` y exportar `missileCommandDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"missile-command"` en `lib/games/registry.ts`. Verificar: `/games/missile-command/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): girar la torreta hasta los topes, lanzar y detonar a mano, autodetonación en el borde, cooldown, cadena de 3+ con bonus y etiqueta, MEJOR CADENA en el HUD, subida de nivel a los 30 s, enemigos rápidos (nivel 3) y divisores (nivel 4), perder una ciudad y reconstruirla a los 4000 puntos, perder las 4, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'missile-command'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `missile-command` con `published = true` y los metadatos del spec (`sort_order` 6); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-missile-command`), la ficha `/games/missile-command` y el home muestran el juego desde la BD (1 jugador, teclado, tags `DEFENSA`/`CADENAS`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/missile-command/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` giran la torreta a 150 °/s entre −75° y +75°; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio` (o `↑`/`W`) lanza un misil a 560 px/s; nunca hay dos misiles propios en vuelo; pulsar de nuevo lo detona en su posición; mantener pulsado no repite.
- [ ] El misil se autodetona al llegar a `y ≤ 20` o a los bordes laterales; tras detonar no se puede lanzar durante 200 ms.
- [ ] La explosión inicial crece hasta 56 px y dura 800 ms; cada enemigo que destruye genera una explosión de 34 px y 500 ms que puede destruir a otros.
- [ ] Puntos por eslabón: 10 / 20 / 30 … (× 2 para rápidos y divisores sin dividir), tope de profundidad 10.
- [ ] Una cadena de `N ≥ 3` enemigos suma 50 × (N − 2) al terminar y muestra `×N`; MEJOR CADENA en el HUD sube solo al superar el récord de la partida.
- [ ] TIEMPO sube 1 por segundo de juego; el nivel sube a los 30 s, 60 s, … sumando 100 × nivel.
- [ ] Nivel 1: un enemigo cada 1800 ms a 45 px/s; aparecen rápidos desde nivel 3 y divisores (se dividen en 3 en `y = 220`) desde nivel 4.
- [ ] Un impacto destruye la ciudad bajo el punto de caída y baja las vidas del HUD; la torreta nunca es destruida.
- [ ] Cada 4000 puntos se reconstruye una ciudad destruida (vidas del HUD suben).
- [ ] Perder la 4.ª ciudad emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (4 → 0), nivel, TIEMPO y MEJOR CADENA; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, misil, explosiones, TIEMPO y aparición; reanudar sin salto de tiempo ni giro residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no gira ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'missile-command'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/missile-command` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 4 ciudades, nivel 1, TIEMPO 0, MEJOR CADENA 0, ángulo 0°, sin enemigos ni explosiones).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/missile-command/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** torreta por ángulo + detonación manual; es el control natural con teclado y la diferencia central con la variante 01. **No:** mira libre ni tres baterías.
- **Sí:** un solo misil en vuelo y munición infinita; el límite lo pone el timing, no la gestión de recursos.
- **Sí:** puntos crecientes por profundidad de cadena (tope 10) y bonus 50 × (N − 2) desde 3 eslabones; premia la habilidad y amplía el rango del leaderboard.
- **Sí:** dificultad continua por tiempo (nivel cada 30 s); **No:** oleadas con pausa ni bonus de fin de oleada.
- **Sí:** ciudades como vidas (`initialLives: 4`) y torreta indestructible; **No:** baterías destruibles (con una sola torreta, perderla terminaría la partida de golpe).
- **Sí:** stats `TIEMPO` y `MEJOR CADENA`; reflejan las dos métricas de habilidad de la variante.
- **Sí:** enemigos rápidos (nivel 3+) y divisores (nivel 4+); **No:** bombarderos, satélites ni power-ups.
- **Sí:** valores de balance (velocidades, intervalos, radios, puntos, reconstrucción cada 4000) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta (estética neón de cadenas); **Sí:** `.cover-missile-command` nueva.
- **Sí:** canvas 600×600 (1:1) para que la torreta central cubra ambos flancos con el mismo alcance.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cadenas largas en niveles altos generan decenas de explosiones por frame.               | Cada enemigo muere una vez (se retira del array al detectarse); explosiones secundarias de vida fija 500 ms.            |
| Un solo misil en vuelo resulta injugable con aparición cada 450 ms.                      | Radio inicial 56 px + cadenas; verificar nivel 8+ en el paso 6 y ajustar solo editando el spec.                          |
| Bonus de cadena se cobra dos veces o nunca si se cuenta mal el fin de la cadena.         | `chains` por `chainId`; se cierra y elimina cuando no quedan explosiones de ese id, una sola vez.                        |
| Emitir `onStat("time")` por frame satura React.                                          | Emitir solo cuando cambia `Math.floor(elapsedMs / 1000)`.                                                                |
| `dt` grande tras pausar o cambiar de pestaña hace caer misiles o sube de nivel de golpe. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `elapsedMs` solo avanza en juego.                   |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                        | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                     |
| Giro "pegado" tras perder foco.                                                          | `blur` y `pause` ponen `turnLeft`/`turnRight` a `false`.                                                                 |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                   |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                       | Clave `"missile-command"` entre comillas; carpeta `lib/games/missile-command/`; migración con `_` en el nombre.           |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                          |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Varias torretas, munición limitada, oleadas con bonus, bombarderos, satélites y power-ups.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
