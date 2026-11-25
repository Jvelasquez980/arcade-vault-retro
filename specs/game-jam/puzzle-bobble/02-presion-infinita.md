# SPEC GJ-puzzle-bobble-02 — Juego real: PUZZLE BOBBLE (variante: presión infinita) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-25
> **Variant:** 02 de 2 — Supervivencia moderna: sin rondas, una fila nueva empuja desde arriba cada pocos segundos (más rápido por nivel), 1 vida, multiplicador de combo, burbujas bomba/arcoíris e intercambio de burbuja.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble (variante presión infinita) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Puzzle Bobble. Reinterpreta el clásico como **supervivencia infinita**: no hay rondas que vaciar; el tablero **recibe una fila nueva desde arriba** por temporizador (y como castigo tras 3 fallos seguidos), empujando todas las burbujas hacia la línea de muerte. La puntuación premia la constancia con un **multiplicador de combo** por disparos consecutivos que revientan algo, y cada 15 burbujas aparece una **especial** (bomba o arcoíris). El jugador puede **intercambiar** la burbuja actual con la siguiente y ve la **trayectoria con un rebote**. Se distingue de la variante 01 (clásico por rondas con semilla fija, techo que baja cada 8 disparos, 3 vidas, bonus de ronda, sin especiales ni intercambio).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con círculos y gradientes radiales. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos de game jam), dificultad 4, tags `BURBUJAS` y `SUPERVIVENCIA`, 1 jugador, teclado. Canvas **480×640** (3:4). Rejilla hexagonal de **10/9 columnas**, radio de burbuja **20 px**, **14 filas** útiles. **1 vida** (`initialLives: 1`), **nivel** por burbujas eliminadas (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal con filas desplazables (`Row = { shifted: boolean, cells: (Bubble | null)[] }`, `cellCenter(rows, row, col)`, `neighbors(rows, row, col)`, `snapCell(rows, x, y, hit)`, `findMatch`, `findFloating`, `pushRow(rows, rand, colorCount)`, `cellsInRadius(rows, x, y, r)`) y constantes (`R`, `ROW_H`, `LEFT`, `TOP`, `ROWS`).
- Módulo `lib/games/puzzle-bobble/balance.ts`: funciones puras `levelFor(cleared)`, `pushMs(level)`, `colorCount(level)`, `dropPoints(k)`, `multiplier(streak)`, `specialAt(n)`.
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawPushGauge`, `drawBubble` (incluye bomba y arcoíris), `drawLauncher`, `drawTrajectory`, `drawDeathLine`, `drawFx` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `linear-gradient(180deg,#2a0030,#0a0a18)`; `::before` con tres filas escalonadas de círculos de 22 px (magenta `#ff2bd6`, yellow `#ffe600`, cyan `#00f5ff`) mediante `radial-gradient` múltiples, la superior con borde inferior magenta (barra de empuje); `::after` con el lanzador magenta abajo y una línea punteada en zigzag (trayectoria con rebote) blanca al 40 %.
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **1 vida** (baja a 0 al perder), **nivel**, stats extra `time` ("TIEMPO", `seconds`) y `combo` ("COMBO", `int`).
- Sin HUD nativo de texto en el canvas; la barra de empuje y la etiqueta efímera `×N` sobre un combo son elementos de juego, no overlays.
- Controles: `←`/`→` y `A`/`D` giran el lanzador; `Espacio`, `↑` o `W` disparan; `↓`, `S` o `C` intercambian burbuja actual y siguiente. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Rondas, techo que baja por disparos, vidas múltiples, semilla fija (son de la variante 01).
- Más tipos de especiales (hielo, piedra, rayo), modo versus.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Revienta burbujas antes de que te aplasten.',
       'Apunta con las flechas o A/D, dispara con Espacio y cambia de burbuja con la flecha abajo. Tres o más del mismo color revientan y lo que queda suelto cae. Cada pocos segundos baja una fila nueva, y más rápido cuanto más avanzas; encadena disparos certeros para multiplicar los puntos y aprovecha las bombas y las burbujas arcoíris. Si una burbuja cruza la línea, se acabó.',
       'ARCADE', 'magenta', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{BURBUJAS,SUPERVIVENCIA}', 4, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `rows: Row[]` (15 filas: 0–13 útiles y la 14 solo como desborde; `Bubble = { color: number, kind: "normal" | "bomb" | "rainbow" }`), `angle`, `turnLeft`, `turnRight`, `current`, `next` (`Bubble`), `queueCount` (burbujas generadas para la cola), `shot { x, y, vx, vy, bubble } | null`, `pushTimer`, `streak`, `misses`, `cleared` (burbujas eliminadas), `level`, `score`, `elapsedMs`, `lastSecondEmitted`, `fx: { x, y, vy, color, kind: "pop" | "fall" | "label", text?, ms }[]`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 0)`, `onStat("combo", 0)`.
- `onStat("time", s)` solo cuando cambia `Math.floor(elapsedMs / 1000)`. `onStat("combo", n)` solo cuando cambia el multiplicador. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio y tras un fallo.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Disparar e intercambiar ignoran `e.repeat`; el giro es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `turnLeft = turnRight = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** radio `R = 20`, `ROW_H = R × √3 ≈ 34.64`. Paredes de 40 px: área `x ∈ [40, 440]` (400 px = 10 burbujas). `TOP = 48` (encima, de `y = 8` a `32`, la barra de empuje). Centro: `y = TOP + R + row × ROW_H`; fila no desplazada (10 celdas) `x = 40 + R + col × 2R`, fila desplazada (9 celdas) `x = 40 + 2R + col × 2R`. Vecinos según el flag `shifted` de cada fila.
- **Línea de muerte:** `y = 540` (borde inferior de la fila 13). Cualquier burbuja en la fila 14 = game over.
- **Inicio:** 5 filas llenas; fila 0 `shifted = false` y se alterna hacia abajo. Colores por celda con la regla de racimo: si hay vecina izquierda y `Math.random() < 0.5` copia su color; si no, color al azar entre `colorCount(level)`.
- **Lanzador:** pivote en (240, 596); `next` en (160, 612) a radio 15. `angle` empieza en 0°; `←`/`A` resta y `→`/`D` suma a **150 °/s**, limitado a `[−80°, +80°]`.
- **Trayectoria:** línea de puntos (cada 12 px, radio 2) que simula el recorrido con **un rebote** de pared como máximo, hasta **360 px** o hasta la primera colisión con burbuja/techo, lo que ocurra antes.
- **Disparo** (`Espacio`, `↑`, `W`): solo si no hay `shot` en vuelo. Velocidad **1080 px/s**, integrada en subpasos de como máximo **10 px**. Rebota en `x = 40 + R` y `x = 440 − R`. `current = next`; nueva `next` generada (`queueCount += 1`).
- **Intercambio** (`↓`, `S`, `C`): intercambia `current` y `next`. Ilimitado, también con un disparo en vuelo.
- **Cola:** `next` normal con color uniforme entre los colores presentes en el tablero (si está vacío, entre `colorCount(level)`). La burbuja de cola número 15, 45, 75… (`queueCount % 30 === 15`) es **bomba**; la 30, 60, 90… (`queueCount % 30 === 0`) es **arcoíris**.
- **Colisión y encaje:** el disparo se detiene a distancia `< 1.6 × R` (32 px) del centro de una burbuja o al tocar el techo (`y ≤ TOP + R`). Encaja en la celda vacía más cercana entre los vecinos vacíos de la tocada (o la fila 0 si tocó el techo); fallback: la celda vacía más cercana de la rejilla.
- **Reventar (normal):** flood fill del mismo color; grupo **≥ 3** se elimina.
- **Bomba:** al encajar elimina la bomba y todas las burbujas con centro a **≤ 82 px** (dos anillos); cuenta como disparo que revienta aunque elimine 0.
- **Arcoíris:** al encajar toma el color de vecino que forme el grupo más grande (empate: índice de color menor); sin vecinos, el color 0. Luego aplica la regla normal.
- **Caída:** las burbujas no conectadas a la fila 0 caen (gravedad **1800 px/s²**, cosmético).
- **Puntos por disparo:** `base = 10 × reventadas + (k ≥ 1 ? 10 × 2^min(k, 10) : 0)` con `k` = caídas. Si el disparo reventó algo: `streak += 1`, `misses = 0` y se suma `base × min(streak, 5)`; si `streak ≥ 2` se muestra `×N` 700 ms sobre la celda encajada. Si no reventó nada: `streak = 0`, `misses += 1`. `onStat("combo", streak === 0 ? 0 : min(streak, 5))` al cambiar.
- **Empuje por tiempo:** `pushTimer` suma `dt`; al alcanzar `pushMs(level) = max(4000, 12000 − 800 × (level − 1))` ms se inserta una fila nueva en la posición 0 (`shifted = !rows[0].shifted`, colores con la regla de racimo), todas bajan una fila y `pushTimer = 0`. La barra superior muestra `pushTimer / pushMs` en `#ff2bd6` y parpadea (cada 150 ms) en el último 20 %.
- **Empuje por fallos:** al llegar a `misses = 3` se empuja una fila al instante y `misses = 0` (`pushTimer` no se reinicia).
- **Tablero vacío:** +**2000** puntos (sin multiplicador) y se empujan **3 filas** al instante con `pushTimer = 0`.
- **Nivel:** `cleared` suma reventadas + caídas (incluida la bomba). `level = 1 + floor(cleared / 50)` (sin tope). Al subir: `onLevel(level)` y +**100 × level** puntos. `colorCount(level) = min(4 + floor((level − 1) / 2), 6)`.
- **Game over:** tras un empuje o un encaje, si la fila 14 tiene alguna burbuja → `onLives(0)` y `onGameOver(score)`.
- **Tiempo:** `elapsedMs` suma `dt` solo en juego.
- **Dibujo:** fondo `#0a0014` con gradiente a `#1a0030` abajo; paredes `#1a0030` con borde `#ff2bd6`; techo `#ff2bd6` de 2 px en `y = TOP`; línea de muerte discontinua `rgba(255,51,85,0.6)`. Burbujas con gradiente radial (brillo blanco arriba-izquierda → color → color al 60 %) y contorno 1.5 px; `PALETTE.bubbles` = `#ff3355`, `#ffe600`, `#39ff14`, `#2b7bff`, `#b04dff`, `#00f5ff`. Bomba: círculo `#222` con contorno `#ff2bd6` y mecha `#ffe600`. Arcoíris: gradiente cónico con los 6 colores girando a 180 °/s. Lanzador: arco `#ff2bd6` de radio 30 con flecha blanca de 36 px; trayectoria `rgba(255,255,255,0.4)`. Etiqueta `×N`: blanco, 18 px monoespaciada, sube 24 px y se desvanece.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/balance.ts`. Verificar: `npm run lint`; `pushMs(1) = 12000`, `pushMs(11) = 4000`, `pushMs(20) = 4000`, `colorCount(1) = 4`, `colorCount(3) = 5`, `colorCount(9) = 6`, `dropPoints(3) = 80`, `dropPoints(12) = 10240`, `multiplier(7) = 5`, `levelFor(49) = 1`, `levelFor(50) = 2`.
3. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; una fila no desplazada tiene 10 celdas y una desplazada 9; tras `pushRow` los flags se alternan y los vecinos se calculan bien.
4. Crear `lib/games/puzzle-bobble/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/puzzle-bobble/engine.ts` y exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): trayectoria con rebote, intercambio, reventar 3, caída con bonus, combo ×2…×5 y reinicio al fallar, empuje a los 12 s con parpadeo, empuje tras 3 fallos, bomba (disparo 15) y arcoíris (disparo 30), subida de nivel a las 50 burbujas, vaciar tablero, game over al cruzar la línea, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `BURBUJAS`/`SUPERVIVENCIA`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` giran a 150 °/s entre −80° y +80°; flechas y `Espacio` no hacen scroll.
- [ ] La trayectoria punteada muestra como máximo un rebote y se corta en la primera burbuja o a 360 px.
- [ ] `Espacio`/`↑`/`W` disparan a 1080 px/s, un disparo a la vez, sin repetición al mantener; el disparo no atraviesa burbujas.
- [ ] `↓`/`S`/`C` intercambian la burbuja actual con la siguiente.
- [ ] La partida empieza con 5 filas de 4 colores, 1 vida y la barra de empuje vacía.
- [ ] 3 o más iguales revientan; puntos `(10 × reventadas + 10 × 2^k caídas) × min(racha, 5)`; COMBO muestra 2…5 y desaparece al fallar.
- [ ] Nivel 1: una fila nueva cada 12 s (barra parpadea en el último 20 %); cada nivel resta 800 ms, mínimo 4 s.
- [ ] Tres disparos seguidos sin reventar empujan una fila al instante.
- [ ] La burbuja 15 de la cola es bomba (elimina todo a ≤ 82 px) y la 30 arcoíris (toma el color del grupo vecino mayor).
- [ ] Cada 50 burbujas eliminadas sube el nivel sumando 100 × nivel; con nivel 3 aparece el 5.º color y con nivel 5 el 6.º.
- [ ] Vaciar el tablero suma 2000 y empuja 3 filas.
- [ ] Una burbuja bajo la línea emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela disparo, empuje, TIEMPO y efectos; reanudar sin salto de tiempo ni giro residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, `S`, `C`, espacio) no gira, dispara ni intercambia.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 1 vida, nivel 1, TIEMPO 0, COMBO oculto, 5 filas, barra vacía, cola reiniciada).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas y gradientes; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** modo infinito con empuje por tiempo; diferencia central con la variante 01. **No:** rondas ni techo que baja por disparos.
- **Sí:** 1 vida; la partida es una sola carrera de supervivencia, corta y clara para el leaderboard.
- **Sí:** `Math.random` para filas y cola; en modo infinito la habilidad se mide en el tiempo sobrevivido. **No:** semilla fija.
- **Sí:** multiplicador por racha (tope ×5) y empuje tras 3 fallos; premian precisión y castigan disparos al azar.
- **Sí:** bomba y arcoíris con frecuencia fija (cada 15 de la cola, alternas); predecibles y sin balance aleatorio. **No:** más tipos de especiales.
- **Sí:** intercambio ilimitado y trayectoria con un rebote; ayudas modernas que compensan la presión por tiempo.
- **Sí:** rejilla 10/9 con radio 20 y 14 filas (más tablero que la variante 01 para dar margen al empuje).
- **Sí:** stats `TIEMPO` y `COMBO`; **No:** HUD nativo.
- **Sí:** valores de balance (12 s → 4 s, 50 burbujas por nivel, 82 px de bomba, 2000 de tablero vacío) fijados aquí, ajustables solo editando el spec.
- **Sí:** `cat` ARCADE, color magenta, `.cover-puzzle-bobble` nueva, `sort_order` 7 (6 queda para `missile-command`).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                          | Mitigation                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Al empujar filas se rompe la paridad hexagonal (vecinos erróneos).            | Flag `shifted` por fila, alternado en `pushRow`; vecinos calculados desde ese flag, no desde el índice. |
| Un empuje mientras el disparo vuela provoca encaje en celda ocupada.          | La colisión usa la rejilla actualizada en cada subpaso; `snapCell` solo devuelve celdas vacías.          |
| Túnel del disparo a 1080 px/s.                                                | Subpasos de ≤ 10 px; `dt` capado a 50 ms.                                                               |
| Calcular la trayectoria cada frame cuesta CPU.                                | Simulación en pasos de 12 px con tope 360 px (≤ 30 comprobaciones por frame).                          |
| Emitir `onStat("time")` por frame satura React.                               | Emitir solo cuando cambia `Math.floor(elapsedMs / 1000)`.                                               |
| `dt` grande tras pausar o cambiar de pestaña dispara varios empujes de golpe. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado; `pushTimer` solo avanza en juego.          |
| Flechas o letras (`A`/`D`/`W`/`S`/`C`) interfieren con el input del modal.     | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                    |
| Doble loop / listeners por StrictMode.                                        | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                 |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.             | Clave `"puzzle-bobble"` entre comillas; carpeta `lib/games/puzzle-bobble/`; migración con `_`.         |
| Next 16 difiere del conocimiento previo.                                      | Paso 1 consulta `node_modules/next/dist/docs/`.                                                        |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Rondas, techo por disparos, vidas múltiples y tableros con semilla fija.
- Otros especiales (hielo, piedra, rayo) y modo versus.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
