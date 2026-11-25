# SPEC GJ-puzzle-bobble-01 — Juego real: PUZZLE BOBBLE (variante: clásico por rondas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-25
> **Variant:** 01 de 2 — Clásico fiel: rondas con tablero predefinido (semilla fija), techo que baja cada 8 disparos, 3 vidas y bonus por limpiar la ronda con pocos disparos.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble (variante clásico por rondas) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Puzzle Bobble. Es la lectura fiel del arcade: cada **ronda** empieza con un tablero de burbujas que hay que **vaciar por completo**; el lanzador dispara una burbuja a la vez, 3 o más del mismo color conectadas revientan y todo lo que queda desconectado del techo cae. El **techo baja una fila cada 8 disparos** y la presión viene del número de disparos, no del reloj. Los tableros se generan con una **semilla fija por ronda**, así que todos los jugadores juegan exactamente las mismas rondas y la misma secuencia de burbujas (leaderboard justo). Se distingue de la variante 02 (supervivencia infinita: filas que empujan por tiempo, 1 vida, combos, burbujas especiales e intercambio de burbuja).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con círculos y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos de game jam), dificultad 3, tags `CLÁSICO` y `BURBUJAS`, 1 jugador, teclado. Canvas **480×640** (3:4). Rejilla hexagonal de **8/7 columnas** (filas pares 8, impares 7), radio de burbuja **24 px**, **12 filas** útiles. **3 vidas** (`initialLives: 3`), **nivel = ronda** (`showLevel: true`), stat extra `BAJADA` (disparos que faltan para que baje el techo). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal (`cellCenter(row, col, drops)`, `colsInRow(row)`, `neighbors(row, col)`, `snapCell(grid, x, y, hitCell, drops)`, `findMatch(grid, row, col)`, `findFloating(grid)`) y constantes (`R`, `ROW_H`, `LEFT`, `TOP`, `ROWS`).
- Módulo `lib/games/puzzle-bobble/levels.ts`: `mulberry32(seed)` y `generateRound(round) → { grid, colorCount }` deterministas.
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawCeiling`, `drawBubble`, `drawLauncher` (con guía de apuntado), `drawDeathLine`, `drawFx` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `radial-gradient(circle at 50% 110%,#002a3a,#0a0a18)`; `::before` con 5 círculos de 28 px en fila superior (cyan `#00f5ff`, magenta `#ff2bd6`, yellow `#ffe600`, green `#39ff14`, cyan) mediante `radial-gradient` múltiples; `::after` con el lanzador: triángulo cyan centrado abajo y una burbuja magenta en la punta.
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (ronda) y stat extra `drop` ("BAJADA", `int`).
- Sin HUD nativo de texto en el canvas: el aviso de bajada es visual (temblor del techo) y el siguiente color se ve como burbuja junto al lanzador.
- Controles: `←`/`→` y `A`/`D` giran el lanzador; `Espacio`, `↑` o `W` disparan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Burbujas especiales, intercambio de burbuja, combos, filas que empujan por tiempo (son de la variante 02).
- Rondas diseñadas a mano, editor de niveles, modo 2 jugadores.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Junta tres burbujas iguales y vacía el tablero.',
       'Apunta el lanzador con las flechas o A/D y dispara con Espacio. Tres o más burbujas del mismo color conectadas revientan, y todo lo que queda suelto del techo cae y vale mucho más. Cada 8 disparos el techo baja una fila: vacía el tablero antes de que las burbujas crucen la línea para pasar de ronda. Tienes tres vidas.',
       'PUZZLE', 'cyan', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{CLÁSICO,BURBUJAS}', 3, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "drop", label: "BAJADA", color: "yellow", format: "int" }],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `grid: (number | null)[][]` (13 filas: 0–11 útiles y la 12 solo como desborde para detectar la muerte; fila par 8 celdas, impar 7; valor = índice de color 0–5), `drops` (filas que ha bajado el techo), `angle` (grados, 0 = vertical), `turnLeft`, `turnRight`, `current`, `next` (índices de color), `shot { x, y, vx, vy, color } | null`, `shotsSinceDrop`, `shotsThisRound`, `idleMs`, `queueRand` (PRNG de la ronda), `round`, `lives`, `score`, `freezeMs` (pausa tras perder vida), `fx: { x, y, vy, color, kind: "pop" | "fall", ms }[]`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("drop", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("drop", 8)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Disparar ignora `e.repeat` (un disparo por pulsación); el giro es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `turnLeft = turnRight = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** radio `R = 24`, `ROW_H = R × √3 ≈ 41.57`. Paredes de 48 px a cada lado: área de juego `x ∈ [48, 432]` (384 px = 8 burbujas). Techo base `TOP = 40`. Centro de celda: `y = TOP + drops × ROW_H + R + row × ROW_H`; `x = 48 + R + col × 2R` en filas pares y `x = 48 + 2R + col × 2R` en filas impares. Vecinos hexagonales según paridad de fila (6 como máximo).
- **Línea de muerte:** `y = 546` (borde inferior de la fila 11 sin bajadas). Una burbuja con `row + drops ≥ 12` está bajo la línea.
- **Lanzador:** pivote en (240, 600); la burbuja `current` se dibuja en el pivote; `next` en (150, 616) a radio 18. `angle` empieza en 0°; `←`/`A` resta y `→`/`D` suma a **120 °/s**, limitado a `[−80°, +80°]`. Guía punteada de **110 px** desde el pivote en la dirección de `angle`.
- **Disparo** (`Espacio`, `↑`, `W`): solo si no hay `shot` en vuelo y `freezeMs ≤ 0`. Velocidad **960 px/s**. El movimiento se integra en subpasos de como máximo **12 px**. Rebota en `x = 48 + R` y `x = 432 − R` invirtiendo `vx`. `current = next` y `next` se sortea con `queueRand`.
- **Colisión y encaje:** el disparo se detiene al quedar a distancia `< 1.6 × R` (38.4 px) del centro de una burbuja, o al tocar el techo (`y ≤ TOP + drops × ROW_H + R`). Se encaja en la celda vacía más cercana a su posición entre los vecinos vacíos de la burbuja tocada (o de la fila 0 si tocó el techo); si no hubiera ninguna, la celda vacía más cercana de toda la rejilla.
- **Reventar:** flood fill de mismo color desde la celda encajada; si el grupo tiene **≥ 3**, se eliminan y suman **10 puntos cada una** (efecto `pop`: encoge en 150 ms).
- **Caída:** tras reventar, toda burbuja no conectada (por vecindad) a la fila 0 cae. Si caen `k ≥ 1`, suman **`10 × 2^min(k, 10)`** puntos en total (1 → 20, 2 → 40, 3 → 80 … 10+ → 10240). Efecto `fall`: gravedad **1800 px/s²** hasta salir por abajo. Los efectos son cosméticos y no bloquean el siguiente disparo.
- **Techo:** cada disparo incrementa `shotsSinceDrop` y emite `onStat("drop", 8 − shotsSinceDrop)` cuando cambia (valores 8 → 1). Al llegar a **8** disparos, `drops += 1`, `shotsSinceDrop = 0`, `onStat("drop", 8)`. Con `shotsSinceDrop` 6 o 7 el bloque del techo tiembla ±2 px en x (aviso visual).
- **Prisa:** `idleMs` cuenta el tiempo sin disparar (sin `shot` en vuelo). A partir de **7000 ms** el lanzador parpadea (alterna color cada 200 ms); a los **10000 ms** dispara solo en el ángulo actual.
- **Siguiente color:** `current`/`next` se sortean uniformemente entre los colores presentes en la rejilla en ese momento (con `queueRand`). Si `next` ya no existe en el tablero tras un disparo, se re-sortea.
- **Rondas** (`levels.ts`, determinista): semilla de tablero `round × 7919`, semilla de cola `round × 7919 + 1` (`mulberry32`). Filas iniciales `min(4 + floor((round − 1) / 2), 8)`; colores `min(3 + floor((round − 1) / 3), 6)` (los primeros N de `PALETTE.bubbles`). Celda a celda, de izquierda a derecha y de arriba abajo: si hay vecina izquierda y `rand() < 0.5`, copia su color; si no, `floor(rand() × colores)`. Sin huecos.
- **Ronda superada:** al vaciar la rejilla se suman **`1000 + 50 × max(0, 30 − shotsThisRound)`** puntos, `round += 1`, `onLevel(round)`, se genera la nueva ronda con `drops = 0`, `shotsSinceDrop = 0`, `idleMs = 0`, `angle` conservado. Rondas infinitas (parámetros topados desde la ronda 10).
- **Perder vida:** tras encajar un disparo o bajar el techo, si alguna burbuja queda con `row + drops ≥ 12`: `lives −= 1`, `onLives(lives)`. Si `lives = 0`, game over inmediato. Si no, `freezeMs = 600` (tablero dibujado en `#555`, sin disparos ni giro) y luego se regenera **la misma ronda** (mismas semillas) con `drops = 0`, `shotsSinceDrop = 0`, `shotsThisRound = 0`. El puntaje se conserva.
- **Dibujo:** fondo `#050a18` con rejilla diagonal tenue; paredes `#0a2a3a` con borde `#00f5ff`; bloque de techo `#0a2a3a` de `y = 0` a `TOP + drops × ROW_H` con borde inferior `#00f5ff`; línea de muerte discontinua `rgba(255,51,85,0.6)`. Burbujas: gradiente radial (brillo blanco en el 30 % superior izquierdo → color → color al 60 % de luminosidad) con contorno de 1.5 px. `PALETTE.bubbles` = `#ff3355` rojo, `#ffe600` amarillo, `#39ff14` verde, `#2b7bff` azul, `#b04dff` violeta, `#00f5ff` cian. Lanzador: arco `#00f5ff` de radio 34 con flecha blanca de 40 px; guía `rgba(255,255,255,0.35)`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; `colsInRow(0) = 8`, `colsInRow(1) = 7`, `neighbors(0, 0)` tiene 3 celdas, `findFloating` devuelve las burbujas separadas de la fila 0 en un caso de prueba manual.
3. Crear `lib/games/puzzle-bobble/levels.ts`. Verificar: `npm run lint`; `generateRound(1)` da 4 filas y 3 colores, `generateRound(9)` 8 filas, `generateRound(10)` 6 colores; dos llamadas con la misma ronda dan rejillas idénticas.
4. Crear `lib/games/puzzle-bobble/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/puzzle-bobble/engine.ts` y exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): girar hasta los topes, rebote en paredes, encaje en hueco, reventar 3, caída con bonus, bajada del techo a los 8 disparos con aviso, autodisparo a los 10 s, limpiar ronda 1 y ver nivel 2, perder una vida y ver la misma ronda regenerada, perder las 3, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`BURBUJAS`, dificultad 3, color cyan, categoría PUZZLE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` giran el lanzador a 120 °/s entre −80° y +80°; flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`/`↑`/`W` disparan a 960 px/s; nunca hay dos disparos en vuelo; mantener pulsado no repite.
- [ ] El disparo rebota en las paredes, no atraviesa huecos entre burbujas a alta velocidad y encaja en una celda hexagonal válida.
- [ ] La ronda 1 empieza con 4 filas de 3 colores y es idéntica en cada partida (misma secuencia de burbujas del lanzador con los mismos disparos).
- [ ] 3 o más del mismo color revientan a 10 puntos cada una; las sueltas caen sumando 20/40/80… (`10 × 2^k`, tope 10240).
- [ ] BAJADA empieza en 8 y baja con cada disparo; al octavo el techo baja una fila y BAJADA vuelve a 8; con 2 y 1 restantes el techo tiembla.
- [ ] Sin disparar, el lanzador parpadea a los 7 s y dispara solo a los 10 s.
- [ ] Vaciar el tablero suma 1000 + 50 × (30 − disparos) (mínimo 1000), sube el nivel del HUD y genera la siguiente ronda.
- [ ] Cruzar la línea de muerte baja una vida, congela 600 ms y reinicia la misma ronda conservando el puntaje.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y BAJADA; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela disparo, efectos, temporizador de prisa y giro; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no gira ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, ronda 1, BAJADA 8, techo arriba, ángulo 0°, sin efectos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas y gradientes; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** rondas generadas con semilla fija; todos juegan las mismas rondas y la misma cola, el leaderboard compara habilidad. **No:** rondas a mano (alcance) ni aleatoriedad libre.
- **Sí:** techo que baja cada 8 disparos (presión por disparos, fiel al arcade). **No:** empuje por tiempo (es la variante 02).
- **Sí:** 3 vidas que reinician la ronda actual conservando el puntaje; **No:** continues ni volver a la ronda 1.
- **Sí:** puntuación 10 por reventada y `10 × 2^k` por caída; premia soltar racimos grandes como el original.
- **Sí:** bonus de ronda por pocos disparos; amplía el rango del leaderboard.
- **Sí:** autodisparo a los 10 s; evita partidas congeladas. **No:** límite de tiempo por ronda.
- **Sí:** stat `BAJADA`; es la información clave del clásico y no hay HUD nativo.
- **Sí:** subpasos de 12 px en el disparo; evita túneles con `dt` de hasta 50 ms.
- **No:** intercambio de burbuja, especiales ni combos (variante 02).
- **Sí:** `cat` PUZZLE, color cyan, `.cover-puzzle-bobble` nueva, `sort_order` 7 (6 queda para `missile-command`).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                             | Mitigation                                                                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| El disparo atraviesa burbujas o paredes con `dt` alto (túnel).                   | Subpasos de ≤ 12 px por frame; `dt` capado a 50 ms.                                                         |
| Encaje en celda incorrecta o fuera de la rejilla (filas de 7 vs 8).              | `snapCell` solo considera celdas válidas por paridad; fallback a la celda vacía más cercana de la rejilla. |
| La paridad hexagonal se rompe al bajar el techo.                                 | El techo desplaza toda la rejilla (`drops` solo cambia la `y`); la paridad depende del índice de fila.      |
| Cola sin colores válidos tras reventar (sale un color que ya no está).           | Re-sorteo de `next` entre colores presentes; con tablero vacío se pasa de ronda antes de sortear.           |
| Rondas distintas entre partidas por usar `Math.random`.                          | Solo `mulberry32` con semillas del spec en tablero y cola; criterio de aceptación de determinismo.          |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                         |
| Giro "pegado" tras perder foco.                                                  | `blur` y `pause` ponen `turnLeft`/`turnRight` a `false`.                                                    |
| Doble loop / listeners por StrictMode.                                           | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                      |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                | Clave `"puzzle-bobble"` entre comillas; carpeta `lib/games/puzzle-bobble/`; migración con `_`.              |
| Next 16 difiere del conocimiento previo.                                         | Paso 1 consulta `node_modules/next/dist/docs/`.                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Burbujas especiales, intercambio de burbuja, combos y filas que empujan por tiempo.
- Rondas diseñadas a mano, editor de niveles, modo versus.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
