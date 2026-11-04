# SPEC GJ-2048-02 — Juego real: 2048 (variante: blitz contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-04
> **Variant:** 02 de 2 — 2048 contra el reloj: 60 s que se recargan con cada fusión, combos multiplicadores por movimientos seguidos con fusión, penalización por movimiento nulo y niveles por ficha máxima que aceleran el reloj.
> **Objective:** Crear un motor TypeScript de 2048 contrarreloj dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/2048` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de 2048. Conserva el tablero 4×4 y la regla de fusión del original, pero convierte la partida en un **sprint de 1–4 minutos**: una barra de tiempo se vacía sin parar, cada fusión la recarga, encadenar movimientos con fusión multiplica los puntos y los movimientos que no cambian el tablero cuestan tiempo. Al subir la ficha máxima sube el nivel y el reloj corre más rápido. Se distingue de la variante 01 (clásico sin reloj, puntaje = suma de fusiones, partida hasta quedarse sin movimientos): aquí el reto es **velocidad y ritmo**, y la partida casi siempre termina por tiempo.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos redondeados y texto de Canvas 2D. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-2048`.

Decisiones fijadas por el agente (no se reabren): `id` `2048`, título `2048`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5, missile-command reserva el 6 en su game jam), dificultad 4, tags `CONTRARRELOJ` y `COMBOS`, 1 jugador, teclado. Canvas **480×512** (barra de tiempo arriba + tablero 1:1). **1 vida** (`initialLives: 1`), **nivel** por ficha máxima (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Sin sonido, sin imágenes, sin deshacer.

Como el `id` empieza por dígito: clave `"2048"` entre comillas en `ENGINES`, export `game2048Def` y función `create2048` (un identificador TS no puede empezar por número), carpeta `lib/games/2048/`, migración `add_game_2048`.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/2048/engine.ts`: sin globals de módulo; exporta `game2048Def: GameEngineDef` con `create2048(canvas, events) → GameController`.
- Módulo `lib/games/2048/board.ts`: funciones puras sin estado de módulo: `emptyBoard()`, `slide(board, dir) → { board, moved, merges: {to, value}[], moves: {from, to}[] }`, `spawn(board, rnd) → { r, c, value } | null`, `canMove(board) → boolean`, `maxTile(board)`. El tablero es `number[16]` (fila mayor, 0 = vacío).
- Módulo `lib/games/2048/rules.ts`: funciones puras de balance: `levelFor(maxTile)`, `drainRate(level)`, `mergeBonus(value)`, `comboMult(combo)` y constantes (`START_TIME`, `MAX_TIME`, `NULL_PENALTY`).
- Módulo `lib/games/2048/draw.ts`: `drawTimeBar`, `drawBoard`, `drawTile(ctx, x, y, size, value, scale)` y `drawFloat` (texto flotante de puntos) con primitivas. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"2048"` en `lib/games/registry.ts`.
- Clase `.cover-2048` en `app/globals.css`: fondo `linear-gradient(135deg,#002a33,#0a0a18)` con `::before` de barra horizontal cyan→magenta arriba (reloj) y `::after` de una rejilla 2×2 de cuadros redondeados cyan/magenta (gradientes).
- Migración `add_game_2048`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×512**.
- HUD de React: puntaje, **1 vida**, **nivel** y stats extra `time` ("TIEMPO", `cyan`, `int`, segundos restantes redondeados hacia arriba) y `combo` ("COMBO", `magenta`, `int`, multiplicador activo).
- En el canvas, como parte del escenario: la **barra de tiempo** (no hay texto de HUD) y el texto flotante `+N` sobre la ficha que puntúa.
- Controles: `←↑→↓` y `WASD` deslizan las fichas. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = '2048'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `2048`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deshacer, fichas obstáculo, comodines, power-ups, otros tamaños de tablero.
- Modo sin reloj (es la variante 01) o selector de modo.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('2048', '2048', 'Fusiona números antes de que se acabe el reloj.',
       'Desliza las fichas del tablero 4×4 con las flechas o WASD y fusiona pares iguales. Empiezas con 60 segundos: cada fusión recarga el reloj y encadenar movimientos con fusión multiplica tus puntos hasta ×5. Mover sin cambiar el tablero cuesta un segundo, y cada nueva ficha récord desde 128 sube el nivel y acelera el reloj. La partida termina al llegar a cero o quedarte sin movimientos.',
       'PUZZLE', 'cyan', 'cover-2048', 1, 1, '{keyboard}', '{CONTRARRELOJ,COMBOS}', 4, 7, false);

Definición del motor:

    export const game2048Def: GameEngineDef = {
      width: 480, height: 512,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "int" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: create2048,
    };

Estado interno (dentro de `create2048`): `board: number[16]`, `score`, `timeLeft` (segundos, float), `shownTime` (último entero emitido), `combo`, `level`, `maxTile`, `anim { t, slides: {from, to, value}[], merged: number[], spawned: number | null } | null`, `floats: { x, y, text, age }[]`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", n)` (solo cuando cambia `Math.ceil(timeLeft)`, como mucho 1 por segundo más los saltos por bonus/penalización), `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 60)`, `onStat("combo", 0)`.
- `onStat("combo", 0)` oculta el stat (contrato de `onStat`): se emite `comboMult(combo)` solo si es ≥ 2, y `0` en caso contrario. Es el comportamiento esperado.
- Game over: `onStat("time", 0)` si fue por tiempo, luego `onLives(0)` y `onGameOver(score)`; el motor deja de actualizar el reloj y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Se ignora `e.repeat` (un movimiento por pulsación). Letras en minúscula o mayúscula (`e.key.toLowerCase()`).
- Pausa/blur/destroy: pausar congela el reloj, la animación y los textos flotantes e ignora teclas; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms** (el reloj nunca descuenta más de 50 ms por frame). `blur` sin pausa de React no detiene el reloj por sí solo, pero el cap de `dt` evita el salto al volver a la pestaña.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** barra de tiempo en `x ∈ [16, 464]`, `y ∈ [16, 32]` (16 px, radio 8). Tablero de fondo en `x ∈ [16, 464]`, `y ∈ [48, 496]` (448 px, radio 10). 4×4 celdas de **97 px** con huecos de **12 px**; la celda `(r, c)` empieza en `x = 28 + c × 109`, `y = 60 + r × 109`. Radio de ficha 8 px.
- **Inicio:** tablero vacío + 2 fichas aparecidas; `timeLeft = 60`, `combo = 0`, `level = 1`. El reloj empieza a correr en el primer movimiento válido (no antes), para no castigar la carga de la página.
- **Aparición:** en una celda vacía elegida al azar uniforme entre las vacías; valor **2** con probabilidad **0.85** y **4** con **0.15**.
- **Deslizar** (`slide`): idéntico al 2048 original. Se procesa cada fila/columna desde el borde hacia el que se mueve; dos fichas adyacentes iguales (tras compactar) se fusionan en una de valor doble; cada ficha se fusiona **como máximo una vez por movimiento**. Ejemplos hacia la izquierda: `[2,2,2,2] → [4,4,0,0]`, `[2,2,2,0] → [4,2,0,0]`, `[2,2,4,4] → [4,8,0,0]`.
- **Movimiento nulo** (el tablero no cambia): `timeLeft −= 1.0` (**`NULL_PENALTY`**), `combo = 0`; no suma, no hace aparecer ficha. Si deja `timeLeft ≤ 0` → game over por tiempo.
- **Movimiento válido sin fusión:** `combo = 0`; aparece 1 ficha.
- **Movimiento válido con fusión:** `combo + 1`; `mult = comboMult(combo) = min(combo, 5)`; puntos = `(suma de los valores resultantes de cada fusión) × mult`; `timeLeft += Σ mergeBonus(v)` con `mergeBonus(v) = 0.2 × log2(v)` s (fusión a 4 → +0.4 s, a 8 → +0.6 s, a 128 → +1.4 s, a 2048 → +2.2 s); `timeLeft` limitado a **`MAX_TIME` = 60**. Aparece 1 ficha. Se crea un texto flotante `+puntos` (y `×mult` si mult ≥ 2) sobre la celda de la fusión de mayor valor.
- **Ejemplo de combo:** tres movimientos seguidos con fusiones que suman 4, 8 y 16 dan 4×1 + 8×2 + 16×3 = **68** puntos; un movimiento sin fusión en medio reinicia el multiplicador a ×1.
- **Nivel:** `levelFor(maxTile) = max(1, log2(maxTile) − 5)` (hasta 64 → 1, 128 → 2, 256 → 3, 512 → 4, 1024 → 5, 2048 → 6, 4096 → 7). Al subir: `onLevel(level)` y bonus de **100 × level** puntos (sin multiplicador de combo).
- **Reloj:** se descuenta `dt × drainRate(level)` con `drainRate(level) = min(1 + 0.15 × (level − 1), 2.5)` (nivel 1 → 1.0 s/s, 2 → 1.15, 4 → 1.45, 6 → 1.75, 11+ → 2.5).
- **Game over:** `timeLeft ≤ 0` (por drenaje o penalización), o tras la aparición `canMove(board)` es falso → `onLives(0)` y `onGameOver(score)`. Llegar a 2048 no termina la partida.
- **Animación (solo visual; la lógica se aplica al instante en el `keydown`):** deslizamiento lineal de **80 ms**; pulso de fusión 1 → **1.15** → 1 en **100 ms**; aparición con escala 0 → 1 en **100 ms**. Una nueva tecla durante la animación la termina al instante y empieza la siguiente. El reloj corre durante la animación. Texto flotante: sube **40 px** y se desvanece en **600 ms**.
- **Barra de tiempo:** ancho proporcional a `timeLeft / 60`; color `#00f5ff` si `timeLeft > 20`, `#ffe600` entre 10 y 20, `#ff3355` bajo 10, y bajo **5 s** parpadea a **4 Hz** (alfa 1 ↔ 0.35). Fondo de la barra `#24243a`.
- **Dibujo:** fondo del canvas `#0a0a18`; tablero `#1a1a2e`; celdas vacías `#24243a`. Fichas (fondo / texto): 2 `#1b2e4a`/`#e0f7ff`, 4 `#20406a`/`#e0f7ff`, 8 `#0077ff`/`#ffffff`, 16 `#00a8ff`/`#0a0a18`, 32 `#00d5ff`/`#0a0a18`, 64 `#00f5ff`/`#0a0a18`, 128 `#b04dff`/`#ffffff`, 256 `#d43bff`/`#ffffff`, 512 `#ff2bd6`/`#ffffff`, 1024 `#ff5fa8`/`#0a0a18`, 2048 `#ffe600`/`#0a0a18`, ≥4096 `#39ff14`/`#0a0a18`. Desde 64 la ficha lleva `shadowBlur` 12 con su propio color. Con combo ≥ 2 el borde del tablero brilla en `#ff2bd6` (`shadowBlur` 6 × mult). Texto `bold` en `system-ui, sans-serif`, centrado: **44 px** para 1–2 dígitos, **38 px** para 3, **30 px** para 4, **24 px** para 5+. Texto flotante `bold 22px` `#ffffff`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-2048` en `app/globals.css`. Aplicar migración `add_game_2048` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = '2048'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/2048/board.ts` y `lib/games/2048/rules.ts`. Verificar: `npm run lint`; comprobar a mano (script temporal en el scratchpad) los 3 ejemplos de deslizamiento, `canMove` en tablero lleno sin pares, `levelFor(64) = 1`, `levelFor(128) = 2`, `levelFor(2048) = 6`, `drainRate(11) = 2.5`, `mergeBonus(8) = 0.6`, `comboMult(7) = 5`.
3. Crear `lib/games/2048/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/2048/engine.ts` y exportar `game2048Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"2048"` en `lib/games/registry.ts`. Verificar: `/games/2048/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): el reloj no corre hasta el primer movimiento; fusiones con combo (×2, ×3, reinicio), movimiento nulo resta 1 s, recarga por fusión con tope 60, colores y parpadeo de la barra, subida de nivel a 128 (bonus 200 y drenaje más rápido), game over por tiempo y por tablero bloqueado, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = '2048'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `2048` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-2048`), la ficha `/games/2048` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`COMBOS`, dificultad 4, color cyan, categoría PUZZLE).
- [ ] `/games/2048/jugar` muestra el canvas 480×512 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con 2 fichas, TIEMPO 60, nivel 1, COMBO oculto; el reloj no baja hasta el primer movimiento válido.
- [ ] `←↑→↓` y `WASD` deslizan las fichas; las flechas no hacen scroll; mantener la tecla no repite el movimiento.
- [ ] Las fusiones siguen la regla original (`[2,2,2,2]` → `[4,4,0,0]`, ninguna ficha se fusiona dos veces).
- [ ] Tres movimientos seguidos con fusiones de 4, 8 y 16 suman 68 puntos y COMBO muestra 2 y luego 3; un movimiento sin fusión oculta COMBO y vuelve a ×1; el multiplicador no pasa de ×5.
- [ ] Un movimiento nulo resta exactamente 1 s, oculta COMBO y no añade ficha.
- [ ] Cada fusión recarga `0.2 × log2(v)` s y el tiempo nunca supera 60.
- [ ] Al conseguir la primera ficha de 128 el nivel pasa a 2, se suman 200 puntos y el reloj drena a 1.15 s/s.
- [ ] La barra es cyan > 20 s, amarilla 10–20 s, roja < 10 s y parpadea a 4 Hz bajo 5 s.
- [ ] Al llegar el tiempo a 0 (o sin movimientos) se emiten `onStat("time", 0)` (si fue por tiempo), `onLives(0)` y `onGameOver`, y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO (como mucho un evento por segundo más bonus/penalizaciones) y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, barra, animaciones y textos flotantes; reanudar sin descuento de tiempo extra.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y letras WASD) no mueve fichas.
- [ ] Guardar inserta en `scores` con `game_id = '2048'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/2048` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 60 parado, nivel 1, COMBO oculto, 2 fichas nuevas, sin textos flotantes).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/2048/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; regla de fusión original, reloj y combos definidos por este spec; **No:** portar código externo (no existe en `references/`).
- **Sí:** reloj de 60 s recargable como eje de la variante (partidas cortas, ideales para leaderboard); **No:** partida sin límite (es la variante 01).
- **Sí:** el reloj arranca en el primer movimiento; **No:** arrancarlo en `create` (castigaría el tiempo de carga y de lectura).
- **Sí:** combo hasta ×5 por movimientos seguidos con fusión; **No:** combo por número de fusiones en un mismo movimiento (premia el azar, no el ritmo).
- **Sí:** penalización de 1 s por movimiento nulo (evita machacar teclas); **No:** penalizar movimientos válidos sin fusión.
- **Sí:** nivel por ficha máxima (`showLevel: true`) con bonus 100 × nivel y drenaje creciente hasta 2.5 s/s; **No:** niveles por tiempo jugado.
- **Sí:** `initialLives: 1` para mostrar el fin y respetar `onLives(0)` → `onGameOver`.
- **Sí:** stat TIEMPO entero (`ceil`) y la barra del canvas como indicador fino; **No:** `format: "seconds"` con décimas (10 eventos/s a React).
- **Sí:** barra de tiempo y texto flotante dibujados en el canvas como escenario; **No:** overlays de pausa ni game over.
- **Sí:** probabilidad de 4 subida a 0.15 (más fusiones rápidas); valores de balance fijados aquí, ajustables solo editando el spec.
- **No:** deshacer (falsearía el leaderboard).
- **Sí:** `cat` PUZZLE y color cyan (energía/velocidad; distingue de Tetris, magenta); **Sí:** `.cover-2048` nueva.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                    | Mitigation                                                                                                           |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Emitir TIEMPO por frame satura React.                                                   | Emitir solo cuando cambia `Math.ceil(timeLeft)`; la barra del canvas da el detalle visual.                           |
| Reloj que sigue corriendo en pausa o descuenta un salto tras cambiar de pestaña.        | El reloj solo avanza dentro del loop activo; `lastTime` se reinicia al reanudar; `dt` capado a 50 ms.                |
| Balance: las recargas superan al drenaje y la partida no termina.                       | Tope de 60 s, drenaje creciente por nivel hasta 2.5 s/s y game over por tablero bloqueado; probar en el paso 6.      |
| Fusiones dobles en un movimiento (`[2,2,4]` → `8`) por un algoritmo ingenuo.            | `slide` compacta, fusiona una vez por par y vuelve a compactar; verificar ejemplos en el paso 2.                     |
| Un `id` que empieza por dígito rompe identificadores TS o el objeto `ENGINES`.           | Clave `"2048"` entre comillas, export `game2048Def`, `create2048`; `hasEngine("2048")` usa `in` con string.          |
| Pulsaciones rápidas desincronizan animación y lógica.                                   | Lógica inmediata en `keydown`; una nueva tecla termina la animación previa al instante.                              |
| Flechas o letras WASD interfieren con el input del modal.                               | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                 |
| Parpadeo de la barra a 4 Hz molesto o problemático para fotosensibles.                  | Solo bajo 5 s, alfa mínima 0.35 (sin apagar del todo), frecuencia por debajo de 5 Hz.                                |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                               |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                      |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deshacer, fichas obstáculo, comodines, power-ups, otros tamaños de tablero.
- Modo clásico sin reloj o selector de modo.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
