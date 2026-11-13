# SPEC GJ-2048-02 — Juego real: 2048 (variante: contrarreloj con combos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-13
> **Variant:** 02 de 2 — 2048 contrarreloj: el reloj baja desde 60 s, las fusiones devuelven tiempo, varias fusiones en un mismo movimiento multiplican los puntos y la aparición de fichas se endurece cada 30 s.
> **Objective:** Crear un motor TypeScript de 2048 (variante contrarreloj con combos) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/2048` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de 2048. Convierte el puzzle pausado en una partida corta y tensa (2–4 min): hay un **reloj** que se agota, las fusiones de fichas grandes **devuelven segundos**, un movimiento que provoca varias fusiones a la vez aplica un **multiplicador de combo**, y el nivel sube cada 30 s haciendo que aparezcan más fichas y más cuatros. El leaderboard premia velocidad y lectura del tablero, no solo paciencia. Se distingue de la variante 01 (clásico fiel: sin reloj, sin combos, 1 ficha por movimiento, partida potencialmente larga).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos redondeados y texto de Canvas 2D. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-2048`.

Decisiones fijadas por el agente (no se reabren): `id` `2048`, título `2048`, `cat` `PUZZLE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus variantes propuestas), dificultad 3, tags `CONTRARRELOJ` y `NÚMEROS`, 1 jugador, teclado. Canvas **500×540**: franja superior de **40 px** con la barra de tiempo y tablero **4×4** de 500×500 debajo (celda **105 px**, separación **16 px**). **1 vida** (`initialLives: 1`), **nivel** cada 30 s (`showLevel: true`), stats extra `TIEMPO` y `MEJOR COMBO`. Sin sonido, sin imágenes.

Como el `id` empieza por dígito: la clave en `ENGINES` va entre comillas (`"2048"`), los identificadores TS llevan prefijo (`game2048Def`, `create2048`) y la carpeta es `lib/games/2048/`.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/2048/engine.ts`: sin globals de módulo; exporta `game2048Def: GameEngineDef` con `create2048(canvas, events) → GameController`.
- Módulo `lib/games/2048/board.ts`: funciones puras sin estado (`emptyBoard()`, `slide(board, dir) → { board, moved, gained, merges, moves }`, `canMove(board)`, `emptyCells(board)`, `spawnTile(board, rand, p4)`, `maxTile(board)`). `board` es `number[16]` (0 = vacía), índice `fila × 4 + columna`.
- Módulo `lib/games/2048/balance.ts`: funciones puras y constantes (`START_MS`, `MAX_MS`, `timeBonusMs(value)`, `comboMult(merges)`, `levelAt(elapsedMs)`, `spawnRule(level) → { count, p4 }`).
- Módulo `lib/games/2048/draw.ts`: `drawTimeBar`, `drawBoard`, `drawTile(ctx, value, x, y, scale)`, `drawLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"2048"` en `lib/games/registry.ts`.
- Clase `.cover-2048` en `app/globals.css`: fondo `radial-gradient(circle at 50% 100%,#2a2000,#0a0a18)` con `::after` que dibuja un mosaico 2×2 de fichas redondeadas (amarillo `#ffe600`, naranja `#ff6a00`, magenta `#ff2bd6`, cyan `#00f5ff`) mediante `linear-gradient` múltiples, y `::before` con una barra horizontal amarilla al 70 % sobre el mosaico (el reloj).
- Migración `add_game_2048`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **500×540**.
- HUD de React: puntaje, **1 vida**, **nivel**, stats extra `time` ("TIEMPO", `seconds`) y `combo` ("MEJOR COMBO", `int`).
- Sin HUD nativo de texto en el canvas; la barra de tiempo y las etiquetas efímeras `COMBO ×N` y `+N.Ns` son elementos de juego, no overlays.
- Controles: `←↑→↓` y `WASD` deslizan las fichas. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = '2048'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `2048`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deshacer, power-ups (bombas, comodines), obstáculos y tableros distintos de 4×4.
- Modo sin reloj (es la variante 01) y selector de duración o dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('2048', '2048', 'Fusiona fichas antes de que se acabe el tiempo.',
       'Desliza las fichas con las flechas o WASD y fusiona pares iguales contra el reloj. Empiezas con 60 segundos: las fusiones de 8 o más te devuelven tiempo y varias fusiones en un mismo movimiento multiplican los puntos. Cada 30 segundos sube el nivel y aparecen más fichas. La partida termina cuando el reloj llega a cero o el tablero se bloquea.',
       'PUZZLE', 'yellow', 'cover-2048', 1, 1, '{keyboard}', '{CONTRARRELOJ,NÚMEROS}', 3, 7, false);

Definición del motor:

    export const game2048Def: GameEngineDef = {
      width: 500, height: 540,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "combo", label: "MEJOR COMBO", color: "magenta", format: "int" },
      ],
      create: create2048,
    };

Estado interno (dentro de `create2048`): `board: number[16]`, `score`, `timeMs`, `elapsedMs`, `level`, `bestCombo`, `lastSecondEmitted`, `anim { t, moves, merges, spawned } | null`, `pendingDir: Dir | null` (buffer de 1 movimiento), `labels: { text, color, x, y, ms }[]`, `paused`, `finished`, `overPending`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 60)` y `onStat("combo", 0)` (valor 0 oculta el stat; esperado al inicio y al llegar a 0 s).
- `onStat("time", s)` se emite solo cuando cambia `s = Math.ceil(timeMs / 1000)` (como máximo una vez por segundo, más los saltos por bonus). `onStat("combo", n)` solo cuando `bestCombo` sube.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Se ignora `e.repeat` (un movimiento por pulsación).
- Pausa/blur/destroy limpian `pendingDir`; en pausa se cancela el rAF (SPEC 13) y al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Disposición:** franja de tiempo `y = 0..40`; tablero desde `y = 40`. Celda `(c, f)` en `x = 16 + c × 121`, `y = 40 + 16 + f × 121`, tamaño 105×105.
- **Inicio:** tablero vacío + 2 fichas (`spawnTile` con `p4 = 0.1`), `timeMs = 60000`, `elapsedMs = 0`, nivel 1.
- **Reloj:** `timeMs -= dt` y `elapsedMs += dt` en cada frame en juego (también durante la animación); no avanza en pausa ni tras game over. `timeMs` nunca supera **90000** (tope tras sumar bonus).
- **Movimiento y fusión:** `←/A`, `→/D`, `↑/W`, `↓/S`. Igual que el 2048 clásico: cada línea se procesa desde el borde de destino; dos fichas iguales consecutivas (ignorando vacías) se fusionan en una de valor doble; **cada ficha participa como máximo en una fusión por movimiento**. Con `←`: `[2,2,2,2] → [4,4,0,0]`; `[8,4,4,4] → [8,8,4,0]`. Un movimiento que no cambia el tablero no cuenta, no genera fichas ni anima.
- **Puntos por movimiento válido:** `m` = número de fusiones del movimiento, `gained` = suma de los valores resultantes. Puntos = `Math.floor(gained × comboMult(m))` con `comboMult(m) = min(1 + 0.5 × (m − 1), 4)` para `m ≥ 1` (1 → ×1, 2 → ×1.5, 3 → ×2, 4 → ×2.5, 7 o más → ×4). Sin fusiones, 0 puntos. Ej.: `[2,2,2,2]` en las 4 filas a la vez = 8 fusiones de 4, `gained` 32, ×4 = **128**.
- **Combo:** si `m ≥ 2` se muestra la etiqueta `COMBO ×<mult>` (p. ej. `COMBO ×1.5`) en el centro del tablero, 28 px, `#ff2bd6`, sube 20 px y se desvanece en **600 ms**. Si `m > bestCombo`, `bestCombo = m` y `onStat("combo", m)`.
- **Bonus de tiempo:** cada fusión suma según el valor resultante `v`: `v = 4` → 0; `8 ≤ v ≤ 32` → **+500 ms**; `64 ≤ v ≤ 256` → **+1000 ms**; `v ≥ 512` → **+3000 ms**. Se suman todas las del movimiento, se aplica el tope de 90000 ms y, si el total es > 0, se muestra `+N.Ns` (p. ej. `+1.5s`) a la derecha de la barra, 16 px, `#39ff14`, durante **500 ms**.
- **Nivel:** `level = 1 + Math.floor(elapsedMs / 30000)` (sin tope). Al cambiar → `onLevel(level)`. No da puntos.
- **Aparición tras cada movimiento válido (`spawnRule(level)`):** nivel 1: **1** ficha, `p4 = 0.1`; nivel 2: **1** ficha, `p4 = 0.25`; nivel 3: **2** fichas, `p4 = 0.25`; nivel 4 o más: **2** fichas, `p4 = 0.4`. Cada ficha va a una celda vacía al azar uniforme con valor 4 con probabilidad `p4` y 2 en otro caso; si hay menos celdas vacías que fichas a generar, se generan las que quepan.
- **Game over por tiempo:** cuando `timeMs ≤ 0` → `timeMs = 0`, `onStat("time", 0)`, se termina la animación en curso al instante (estado final dibujado), `onLives(0)` y `onGameOver(score)`.
- **Game over por bloqueo:** tras generar las fichas, si `canMove(board)` es falso → `overPending = true`; al terminar la animación se emiten `onLives(0)` y `onGameOver(score)`. El reloj sigue corriendo hasta entonces (si llega a 0 antes, aplica la regla anterior una sola vez).
- **Animación (solo visual, la lógica ya está aplicada):** deslizamiento lineal **70 ms**; luego "pop" **100 ms**: fusionadas 1 → 1.15 → 1, nuevas 0 → 1. Total 170 ms. Una tecla durante la animación se guarda en `pendingDir` (máx. 1, la última sustituye) y se aplica al terminar.
- **Barra de tiempo:** rectángulo redondeado (radio 6) de `x = 16` a `484`, `y = 14` a `26`; fondo `#141428`; relleno de ancho `468 × timeMs / 90000`; color `#39ff14` si `timeMs > 20000`, `#ffe600` si `10000 < timeMs ≤ 20000`, `#ff3355` si `≤ 10000`; por debajo de 5000 ms el relleno parpadea a 4 Hz (alfa 1 ↔ 0.4). Marca vertical blanca tenue en la posición de 60 s.
- **Dibujo:** fondo del canvas `#0a0a18`; marco del tablero `#1f1f3a` (radio 12); celda vacía `#141428` (radio 8); fichas con radio 8 y número centrado en fuente monoespaciada bold (48 px para 1–2 cifras, 40 px para 3, 32 px para 4, 26 px para 5 o más). Paleta (`fondo / texto`): 2 `#12324a / #7fe9ff`; 4 `#123f5a / #a6f3ff`; 8 `#00a8c6 / #001018`; 16 `#00f5ff / #001018`; 32 `#39ff14 / #001a00`; 64 `#b6ff00 / #102000`; 128 `#ffe600 / #201a00`; 256 `#ffb000 / #201000`; 512 `#ff6a00 / #200800`; 1024 `#ff2bd6 / #ffffff`; 2048 `#ffffff / #ff2bd6`; mayores `#9b5cff / #ffffff`. Desde 128, `shadowBlur` 16 con el color de fondo de la ficha.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-2048` en `app/globals.css`. Aplicar migración `add_game_2048` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = '2048'` muestra la fila; `npm run build`.
2. Crear `lib/games/2048/board.ts` y `lib/games/2048/balance.ts`. Verificar: `npm run lint`; con `←`, `slide` da `[2,2,2,2] → [4,4,0,0]` (2 fusiones, `gained` 8) y `[2,4,8,16]` sin cambio; `comboMult(1) = 1`, `comboMult(3) = 2`, `comboMult(8) = 4`; `timeBonusMs(4) = 0`, `timeBonusMs(32) = 500`, `timeBonusMs(64) = 1000`, `timeBonusMs(512) = 3000`; `levelAt(29999) = 1`, `levelAt(60000) = 3`; `spawnRule(4) = { count: 2, p4: 0.4 }`.
3. Crear `lib/games/2048/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/2048/engine.ts` y exportar `game2048Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"2048"` en `lib/games/registry.ts`. Verificar: `/games/2048/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): reloj bajando desde 60, bonus `+0.5s`/`+1.0s` y tope de 90 s, combo con etiqueta y MEJOR COMBO, colores y parpadeo de la barra, subida de nivel a los 30/60/90 s con 2 fichas por movimiento desde nivel 3, game over por tiempo y por bloqueo, pausa (botón y `P`) sin consumir tiempo, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = '2048'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `2048` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-2048`), la ficha `/games/2048` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`NÚMEROS`, dificultad 3, color amarillo, categoría PUZZLE).
- [ ] `/games/2048/jugar` muestra el canvas 500×540 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con 2 fichas, TIEMPO 60 y nivel 1.
- [ ] `←↑→↓` y `WASD` deslizan las fichas; las flechas no hacen scroll; mantener pulsada una tecla no repite.
- [ ] Ninguna ficha se fusiona dos veces en un movimiento; un movimiento que no cambia el tablero no genera fichas ni puntos.
- [ ] Una fusión simple suma su valor (×1); 2 fusiones en un movimiento aplican ×1.5, 3 aplican ×2 y el multiplicador nunca supera ×4.
- [ ] Con `m ≥ 2` aparece `COMBO ×<mult>` durante 600 ms; MEJOR COMBO sube solo al superar el récord de la partida.
- [ ] Fusionar en 8–32 suma 0.5 s, en 64–256 suma 1 s y en 512+ suma 3 s; fusionar en 4 no suma tiempo; el reloj nunca pasa de 90 s.
- [ ] TIEMPO baja 1 por segundo de juego (también durante la animación) y la barra cambia a amarillo bajo 20 s, a rojo bajo 10 s y parpadea bajo 5 s.
- [ ] El nivel sube a los 30, 60 y 90 s; en nivel 1–2 aparece 1 ficha por movimiento y desde nivel 3 aparecen 2 (si caben); la proporción de 4 sube a 25 % en nivel 2 y 40 % en nivel 4.
- [ ] Al llegar el reloj a 0 se emite `onLives(0)` y luego `onGameOver` una sola vez, y se abre el modal con el puntaje correcto.
- [ ] Con el tablero bloqueado, al terminar la animación se emite `onLives(0)` y luego `onGameOver` una sola vez.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO y MEJOR COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, animación y entrada (rAF detenido); reanudar sin pérdida de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y `WASD`) no mueve fichas.
- [ ] Guardar inserta en `scores` con `game_id = '2048'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/2048` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 2 fichas, TIEMPO 60, nivel 1, MEJOR COMBO 0, sin etiquetas, buffer ni animación).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/2048/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** reloj de 60 s con tope de 90 s y bonus por fusión ≥ 8; acota la partida a pocos minutos y es la diferencia central con la variante 01.
- **Sí:** multiplicador de combo por fusiones simultáneas (tope ×4); premia leer el tablero y amplía el rango del leaderboard.
- **Sí:** dificultad por tiempo (nivel cada 30 s: más fichas y más cuatros); **No:** obstáculos ni fichas bloqueadas.
- **Sí:** `initialLives: 1` y `showLevel: true`; **Sí:** stats `TIEMPO` y `MEJOR COMBO`, las dos métricas de esta variante.
- **Sí:** barra de tiempo en una franja propia del canvas (500×540) como elemento de juego; **No:** HUD de texto nativo ni overlays.
- **Sí:** el reloj corre durante la animación, que es más corta (170 ms) que en la variante 01; **No:** congelar el tiempo al animar (sería explotable pulsando sin parar).
- **Sí:** `id` `2048` con prefijos TS `game2048Def`/`create2048`; un identificador no puede empezar por dígito.
- **Sí:** valores de balance (60/90 s, bonus, multiplicador, reglas de aparición) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` PUZZLE y color amarillo (urgencia; Tetris ya usa magenta); **Sí:** `.cover-2048` nueva.
- **No:** deshacer, power-ups, sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                 | Mitigation                                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Game over emitido dos veces (reloj a 0 y bloqueo en el mismo frame).                 | Bandera `finished` comprobada antes de emitir; ambas rutas pasan por una única función `endGame()`.              |
| Bonus de tiempo demasiado generoso hace la partida infinita.                         | Tope de 90 s y 2 fichas por movimiento desde nivel 3; verificar en el paso 6 y ajustar solo editando el spec.     |
| Emitir `onStat("time")` por frame satura React.                                      | Emitir solo cuando cambia `Math.ceil(timeMs / 1000)`.                                                             |
| `dt` grande tras pausar o cambiar de pestaña consume segundos del reloj de golpe.    | rAF cancelado en pausa, `lastTime` reiniciado al reanudar y tras blur; `dt` capado a 50 ms.                       |
| El reloj sigue corriendo si el usuario cambia de ventana sin pausar.                 | Igual que el resto del catálogo: la pausa es explícita (botón o `P`); rAF se detiene solo en pestañas ocultas.    |
| Fusión doble (`[2,2,4]` → `8`) por procesar mal la línea.                            | Procesar desde el borde de destino marcando fichas fusionadas; casos del paso 2.                                  |
| El id numérico `2048` rompe identificadores o claves.                                | Clave `"2048"` entre comillas en `ENGINES`; prefijos TS; `.cover-2048` es válida (empieza por letra).              |
| Flechas o `WASD` interfieren con el input del modal.                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                              |
| Doble loop / listeners por StrictMode.                                               | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                            |
| Next 16 difiere del conocimiento previo.                                             | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                   |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deshacer, power-ups, obstáculos, tableros distintos de 4×4.
- Modo sin reloj, selector de duración o dificultad.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
