# SPEC GJ-puzzle-bobble-01 — Juego real: PUZZLE BOBBLE (variante: clásico por niveles) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-10
> **Variant:** 01 de 2 — Puzzle Bobble clásico fiel: tablero fijo por nivel que hay que vaciar, techo que baja cada 8 disparos, 3 vidas, caída con bonus exponencial y disparo automático a los 10 s.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Puzzle Bobble. Recrea el arcade de 1994: un cañón fijo abajo dispara burbujas de colores contra un racimo colgado del techo; 3 o más del mismo color conectadas revientan y las que quedan sin unión al techo caen con bonus. Cada **nivel** es un tablero inicial que hay que **vaciar por completo**; el **techo baja una fila cada 8 disparos**, y si una burbuja cruza la línea límite se pierde una vida y el nivel se reinicia. Se distingue de la variante 02 (modo sin fin con filas que entran por arriba con temporizador, 1 vida, combos, burbujas especiales e intercambio de burbuja): aquí el reto es **limpiar tableros completos con disparos contados**, con ritmo por niveles.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con círculos, gradientes radiales y líneas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` ya reserva 6 en sus specs propuestos), dificultad 3, tags `CLÁSICO` y `BURBUJAS`, 1 jugador, teclado. Canvas **480×640** (3:4). Rejilla hexagonal de **8 columnas** (filas impares de 7, desplazadas medio diámetro) con burbujas de **48 px** de diámetro. **3 vidas**, **niveles infinitos** generados de forma determinista (mismo tablero para todos los jugadores), stat extra `TECHO EN`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal (`cellCenter(row, col, ceilingY)`, `rowLength(row)`, `neighbors(row, col)`, `snapCell(x, y, ceilingY, grid, hit)`, `findCluster(grid, row, col)`, `findFloating(grid)`), sin estado de módulo.
- Módulo `lib/games/puzzle-bobble/levels.ts`: PRNG `mulberry32(seed)` y `buildLevel(level) → { grid, colors }` determinista (ver reglas).
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawWalls`, `drawCeiling` (prensa), `drawDeadline`, `drawBubble` (gradiente radial con brillo), `drawCannon`, `drawAimGuide`, `drawQueue`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `radial-gradient(circle at 50% 0%, #00303a, #0a0a18)`; `::after` con 5 círculos `radial-gradient` (cyan, magenta, amarillo, verde, cyan) en racimo arriba y `::before` con un círculo magenta abajo al centro (burbuja del cañón).
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** y stat extra `drop` ("TECHO EN", `int`, disparos que faltan para que baje el techo).
- Sin HUD nativo de texto en el canvas; la cola de burbujas (actual y siguiente) se dibuja junto al cañón como parte del escenario. Sin texto de transición entre niveles.
- Controles: `←`/`→` o `A`/`D` giran el cañón; `Espacio`, `↑` o `W` disparan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Burbujas especiales (bomba, arcoíris, metal), intercambio de burbuja, combos.
- Niveles diseñados a mano, modo versus, editor de niveles.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Junta tres burbujas del mismo color.',
       'Gira el cañón con las flechas o A/D y dispara con Espacio. Une tres o más burbujas del mismo color para reventarlas; las que queden colgando caen y valen el doble por cada una. Vacía el tablero para pasar de nivel antes de que el techo, que baja cada 8 disparos, empuje las burbujas hasta la línea límite. Tienes 3 vidas.',
       'PUZZLE', 'cyan', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{CLÁSICO,BURBUJAS}', 3, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "drop", label: "TECHO EN", color: "yellow", format: "int" }],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `grid: (number | null)[][]` (12 filas; fila par 8 celdas, impar 7; valor = índice de color 0–5), `ceilingDrops` (filas que ha bajado el techo), `ceilingY`, `angle` (grados), `keysDown: Set<string>`, `current` y `next` (índices de color), `shot { x, y, vx, vy, color } | null`, `popping: { x, y, color, age }[]`, `falling: { x, y, vy, color }[]`, `shotsToDrop`, `idleMs` (tiempo sin disparar), `levelMs` (tiempo en el nivel), `level`, `lives`, `score`, `rngShots` (PRNG del nivel), `phase: "play" | "clear" | "dead"`, `phaseMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("drop", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("drop", 8)`.
- `drop` nunca vale 0 al emitirse (al llegar a 0 el techo baja y se reinicia a 8), así que el stat no se oculta.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Las teclas de disparo ignoran `e.repeat` (un disparo por pulsación); el giro usa `keysDown` (continuo mientras se mantiene).
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Pausa congela también `idleMs` y `levelMs`.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** diámetro `D = 48`, radio `R = 24`, alto de fila `ROW_H = 42`. Campo de juego `x ∈ [48, 432]` (384 px = 8 × D), paredes de 48 px a cada lado. Techo inicial `ceilingY = 32`; `ceilingY = 32 + 42 × ceilingDrops`. Centro de celda: `x = 48 + R + col × D + (row impar ? R : 0)`, `y = ceilingY + R + row × ROW_H`. Línea límite en `y = 548`. Cañón con pivote en (240, 600); burbuja actual centrada en el pivote; siguiente dibujada en (150, 616) a radio 18.
- **Cañón:** `angle` en grados medido desde la horizontal derecha (90 = vertical arriba). Empieza en 90 en cada nivel y tras perder vida. Gira a **100 °/s** con `←`/`A` (aumenta) y `→`/`D` (disminuye), limitado a `[10, 170]`. Guía de puntería: 6 puntos de 3 px separados 20 px desde la boca (no predice rebotes).
- **Disparo:** solo si `shot = null` y `phase = "play"`. La burbuja sale del pivote a **900 px/s** en la dirección del cañón; `current = next`, `next` = nuevo color (ver Colores). `idleMs = 0`, `shotsToDrop − 1`.
- **Disparo automático:** si `idleMs ≥ 10000` sin disparar (en `phase = "play"` y sin `shot` en vuelo) se dispara solo con el ángulo actual.
- **Vuelo:** se integra en subpasos de máximo **12 px**. Rebota en `x = 48 + R` y `x = 432 − R` invirtiendo `vx`. Se detiene (se pega) si `y − R ≤ ceilingY` o si la distancia a cualquier burbuja de la rejilla es `< 38` (0.8 × D).
- **Pegado (`snapCell`):** celda candidata = fila `round((y − ceilingY − R) / ROW_H)` y columna más cercana en esa fila; si está ocupada o fuera de rango, se elige la celda vacía vecina de la burbuja golpeada más cercana a la posición del disparo. Si la fila resultante es ≥ 12, se considera cruce de la línea límite (pierde vida).
- **Reventar:** tras pegar, `findCluster` (BFS por vecinos hexagonales del mismo color). Si el grupo tiene **≥ 3**, se eliminan y pasan a `popping` (encogen de R a 0 en 150 ms). Luego `findFloating` (BFS desde la fila 0) y las no conectadas al techo pasan a `falling` (gravedad **1800 px/s²**, `vy` inicial 0; se eliminan al pasar `y > 680`).
- **Puntuación:**
  - Burbuja reventada: **10** cada una.
  - Burbujas caídas (n > 0 en un mismo disparo): **20 × 2^(min(n, 10) − 1)** en total (1 → 20, 2 → 40, 3 → 80, …, 10 o más → 10240).
  - Nivel completado: **1000** + `max(0, 3000 − 30 × floor(levelMs / 1000))` (más rápido, más bonus).
- **Techo:** `shotsToDrop` empieza en **8** en cada nivel y tras perder vida; `onStat("drop", n)` tras cada disparo. Cuando un disparo termina de resolverse (pegado y reventado) con `shotsToDrop = 0`, el techo baja: `ceilingDrops + 1`, todas las burbujas bajan 42 px, `shotsToDrop = 8`, `onStat("drop", 8)`. Con `shotsToDrop ≤ 2` la prensa del techo tiembla ±2 px en x (aviso visual).
- **Línea límite / perder vida:** si tras pegar o tras bajar el techo alguna burbuja tiene `y + R > 548` (equivale a `row + ceilingDrops ≥ 12`), `phase = "dead"` durante **1200 ms** (las burbujas se dibujan en gris `#555`), `lives − 1`, `onLives(lives)`. Si `lives = 0` → `onLives(0)` y `onGameOver(score)` sin esperar. Si quedan vidas, se reconstruye el nivel actual desde `buildLevel(level)` (mismo tablero, techo en 32, `shotsToDrop = 8`, `levelMs = 0`, PRNG de disparos reiniciado); el puntaje se conserva.
- **Nivel completado:** cuando la rejilla queda vacía (no espera a que terminen `popping`/`falling`), se suma el bonus, `phase = "clear"` durante **1500 ms** (sin disparo; el cañón puede girar), luego `level + 1`, `onLevel(level)`, nuevo tablero, techo en 32, `shotsToDrop = 8`, `onStat("drop", 8)`, `angle = 90`.
- **Generación de niveles (`buildLevel(level)`):** PRNG `mulberry32(level × 7919)`. Colores del nivel `k = min(3 + ceil(level / 2), 6)` (nivel 1 → 4, 2 → 4, 3 → 5, 4 → 5, 5+ → 6), tomados en orden de la paleta. Filas llenas `rows = min(4 + floor((level − 1) / 2), 8)` (nivel 1 → 4, … 9+ → 8). Cada celda de las filas `0..rows−1` recibe un color: con probabilidad **0.5** el mismo color que su vecina izquierda (si existe), si no uno aleatorio entre los `k`. Desde el nivel 6, cada celda de las filas `rows−2..rows−1` queda vacía con probabilidad **0.25** (se eliminan después las flotantes con `findFloating`).
- **Colores de disparo:** el PRNG de disparos es `mulberry32(level × 7919 + 1)`. Cada nuevo color se elige al azar entre los **colores aún presentes en la rejilla** (orden de paleta); si la rejilla está vacía, entre los `k` del nivel. Al pegar un disparo, si `current` o `next` ya no están en la rejilla se re-sortean.
- **Paleta (`PALETTE`):** fondo `#0a0a18` con degradado a `#00202a` arriba; paredes `#1a1a3a` con borde `#00f5ff`; prensa del techo `#2a2a4a` con remaches `#00f5ff`; línea límite discontinua `#ff3355`. Burbujas (índice 0–5): rojo `#ff3355`, azul `#2b7bff`, amarillo `#ffe600`, verde `#39ff14`, magenta `#ff2bd6`, cyan `#00f5ff`; cada una con gradiente radial blanco (brillo en −R/3, −R/3) → color → color al 60 % de luminosidad en el borde. Cañón: base semicircular `#2a2a4a` y tubo `#00f5ff` de 14×56 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; `neighbors` de una celda de fila par interior devuelve 6 vecinos y respeta el desplazamiento de filas impares; `findCluster` y `findFloating` correctos en un tablero de prueba manual.
3. Crear `lib/games/puzzle-bobble/levels.ts`. Verificar: `npm run lint`; `buildLevel(1)` da 4 filas y 4 colores, `buildLevel(9)` da 8 filas y 6 colores; dos llamadas con el mismo nivel devuelven el mismo tablero.
4. Crear `lib/games/puzzle-bobble/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/puzzle-bobble/engine.ts` y exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): girar el cañón y llegar a los topes, disparar con rebote en pared, reventar un grupo de 3, provocar una caída de varias burbujas (bonus 20/40/80), dejar pasar 10 s (disparo automático), ver bajar el techo a los 8 disparos, cruzar la línea límite (vida −1 y nivel reiniciado), completar el nivel 1 (bonus y nivel 2), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`BURBUJAS`, dificultad 3, color cyan, categoría PUZZLE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` giran el cañón a 100 °/s entre 10° y 170°; flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`, `↑` o `W` disparan una burbuja a 900 px/s; mantener la tecla no repite; no se puede disparar con otra burbuja en vuelo.
- [ ] La burbuja rebota en ambas paredes y se pega al techo o al tocar otra burbuja, en una celda válida de la rejilla hexagonal (filas de 8 y 7 alternas).
- [ ] Un grupo de 3 o más del mismo color revienta sumando 10 por burbuja; un grupo de 2 no revienta.
- [ ] Las burbujas que quedan sin unión al techo caen y suman 20 × 2^(n−1) (1 → 20, 2 → 40, 3 → 80; tope 10240 desde 10).
- [ ] La nueva burbuja de la cola siempre es de un color presente en la rejilla.
- [ ] Sin disparar durante 10 s, el cañón dispara solo.
- [ ] TECHO EN empieza en 8, baja 1 por disparo y al llegar a 0 el techo baja una fila (42 px) y vuelve a 8; con 2 o menos la prensa tiembla.
- [ ] Si una burbuja cruza la línea límite (y = 548), se pierde una vida y el nivel se reinicia con el mismo tablero, techo arriba y TECHO EN 8, conservando el puntaje.
- [ ] Vaciar la rejilla suma 1000 + max(0, 3000 − 30 × segundos) y tras 1500 ms empieza el nivel siguiente; el nivel del HUD sube.
- [ ] El nivel 1 tiene 4 filas y 4 colores; el tablero de cada nivel es idéntico entre partidas.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y TECHO EN; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela el disparo en vuelo, caídas, temporizador de disparo automático y bonus de tiempo; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no gira ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, TECHO EN 8, cañón a 90°, tablero del nivel 1).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** niveles procedurales deterministas con PRNG sembrado por nivel; **No:** niveles aleatorios por partida (el leaderboard sería injusto) ni diseñados a mano (alcance).
- **Sí:** 3 vidas que reinician el nivel conservando puntaje; **No:** game over al primer cruce (castiga demasiado en un puzzle).
- **Sí:** techo cada 8 disparos y disparo automático a 10 s, fieles al original y garantizan partidas cortas.
- **Sí:** bonus exponencial por caída (fiel) con tope en n = 10 para evitar puntajes desbordados.
- **Sí:** stat `TECHO EN` porque es la información de decisión clave sin HUD nativo; **No:** dibujar el contador como texto en el canvas.
- **Sí:** cola actual + siguiente visible; **No:** intercambiar burbujas (es de la variante 02).
- **Sí:** colores de disparo solo entre los presentes en la rejilla (evita burbujas inútiles al final del nivel).
- **Sí:** `cat` PUZZLE y color cyan; `.cover-puzzle-bobble` nueva.
- **Sí:** canvas 480×640 (3:4 vertical, como el campo del arcade).
- **Sí:** valores de balance fijados en este spec, ajustables solo editándolo.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| El disparo atraviesa huecos entre burbujas a alta velocidad (efecto túnel).             | Subpasos de máximo 12 px (R/2) y umbral de colisión 0.8 × D.                                                          |
| `snapCell` elige una celda ocupada o fuera del hexágono en filas impares.               | Fallback a la celda vacía vecina de la burbuja golpeada; verificar contra paredes y filas de 7 en el paso 7.          |
| Desfase de filas impares mal calculado tras bajar el techo.                             | La paridad depende solo del índice de fila, no de `ceilingDrops` (el techo desplaza `y`, no las filas).               |
| Un nivel generado es imposible o trivial.                                               | Probar niveles 1, 5 y 9 en el paso 7; ajustar probabilidades solo editando este spec.                                 |
| Emitir `onStat`/`onScore` por frame satura React.                                       | Emitir solo en disparo, pegado, bajada de techo, cambio de nivel y de vidas.                                          |
| `dt` grande tras pausar o cambiar de pestaña teletransporta la burbuja a través del racimo. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; subpasos.                                     |
| Teclas `A`/`D`/`W`/espacio interfieren con el input del modal.                          | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                  |
| Tecla de giro "pegada" tras perder foco.                                                | `blur` y `pause` vacían `keysDown`.                                                                                   |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                      | Clave `"puzzle-bobble"` entre comillas; carpeta `lib/games/puzzle-bobble/`; migración `add_game_puzzle_bobble`.       |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                       |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Burbujas especiales, intercambio de burbuja, combos y modo sin fin.
- Niveles diseñados a mano, editor de niveles y modo versus.
- HUD nativo de texto dentro del canvas y overlays de pausa/transición/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
