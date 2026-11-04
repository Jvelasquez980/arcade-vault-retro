# SPEC GJ-2048-01 — Juego real: 2048 (variante: clásico fiel) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-04
> **Variant:** 01 de 2 — 2048 clásico de Gabriele Cirulli: tablero 4×4, sin reloj, la partida acaba solo cuando no quedan movimientos; llegar a 2048 no termina la partida.
> **Objective:** Crear un motor TypeScript de 2048 dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/2048` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de 2048. Recrea el juego original: deslizar todas las fichas de un tablero 4×4 en una dirección, fusionar pares iguales y sumar el valor de cada fusión al puntaje. No hay tiempo ni multiplicadores: el reto es **pura planificación** (mantener la ficha grande en una esquina). Se distingue de la variante 02 (contrarreloj con barra de tiempo que se recarga con fusiones, combos multiplicadores, penalización por movimiento nulo y niveles por ficha máxima): aquí no hay presión temporal y el puntaje depende solo de las fusiones.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos redondeados y texto de Canvas 2D. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-2048`.

Decisiones fijadas por el agente (no se reabren): `id` `2048`, título `2048`, `cat` `PUZZLE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5, missile-command reserva el 6 en su game jam), dificultad 2, tags `CLÁSICO` y `NÚMEROS`, 1 jugador, teclado. Canvas **480×480** (1:1). **1 vida** (`initialLives: 1`, baja a 0 en el game over), sin nivel, stats extra `FICHA MÁX` y `MOVIMIENTOS`. Sin sonido, sin imágenes, sin deshacer.

Como el `id` empieza por dígito: clave `"2048"` entre comillas en `ENGINES`, export `game2048Def` y función `create2048` (un identificador TS no puede empezar por número), carpeta `lib/games/2048/`, migración `add_game_2048`.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/2048/engine.ts`: sin globals de módulo; exporta `game2048Def: GameEngineDef` con `create2048(canvas, events) → GameController`.
- Módulo `lib/games/2048/board.ts`: funciones puras sin estado de módulo: `emptyBoard()`, `slide(board, dir) → { board, moved, gained, merges: {to, value}[], moves: {from, to}[] }`, `spawn(board, rnd) → { r, c, value } | null`, `canMove(board) → boolean`, `maxTile(board)`. El tablero es `number[16]` (fila mayor, 0 = vacío).
- Módulo `lib/games/2048/draw.ts`: `drawBoard`, `drawTile(ctx, x, y, size, value, scale)` con primitivas (rect redondeado + texto). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"2048"` en `lib/games/registry.ts`.
- Clase `.cover-2048` en `app/globals.css`: fondo `linear-gradient(135deg,#2a2000,#0a0a18)` con `::after` de una rejilla 2×2 de cuadros redondeados amarillos/naranjas (gradientes) que evoca fichas.
- Migración `add_game_2048`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×480**.
- HUD de React: puntaje, **1 vida** y stats extra `max` ("FICHA MÁX", `yellow`, `int`) y `moves` ("MOVIMIENTOS", `int`). Sin nivel.
- Sin HUD nativo de texto en el canvas: solo tablero y fichas con su número (el número es parte de la ficha, no HUD).
- Controles: `←↑→↓` y `WASD` deslizan las fichas. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = '2048'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `2048`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deshacer, guardar partida en `localStorage`, tableros de otros tamaños, modo "seguir tras ganar" con diálogo (aquí se sigue sin preguntar).
- Reloj, combos y niveles (son la variante 02).
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('2048', '2048', 'Desliza y fusiona números hasta 2048.',
       'Desliza todas las fichas del tablero 4×4 con las flechas o WASD. Dos fichas iguales que chocan se fusionan en una del doble de valor y suman ese valor a tu puntaje. Tras cada movimiento aparece un 2 o un 4. Llegar a 2048 no termina la partida: sigue hasta que no queden movimientos.',
       'PUZZLE', 'yellow', 'cover-2048', 1, 1, '{keyboard}', '{CLÁSICO,NÚMEROS}', 2, 7, false);

Definición del motor:

    export const game2048Def: GameEngineDef = {
      width: 480, height: 480,
      initialLives: 1,
      stats: [
        { key: "max", label: "FICHA MÁX", color: "yellow", format: "int" },
        { key: "moves", label: "MOVIMIENTOS", format: "int" },
      ],
      create: create2048,
    };

Estado interno (dentro de `create2048`): `board: number[16]`, `score`, `moves`, `maxTile`, `anim { t, slides: {from, to, value}[], merged: number[], spawned: number | null } | null`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("max", n)`, `onStat("moves", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("max", maxTile)` (2 o 4 según las fichas iniciales) y `onStat("moves", 0)` (0 oculta el stat hasta el primer movimiento, comportamiento esperado del contrato).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de reaccionar a teclas. El último frame (con la animación terminada) queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Se ignora `e.repeat` (un movimiento por pulsación). Letras en minúscula o mayúscula (`e.key.toLowerCase()`).
- Pausa/blur/destroy: pausar ignora teclas y congela la animación; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` no emite eventos.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, victoria ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** tablero de fondo en `x, y ∈ [16, 464]` (448 px, radio 10). 4×4 celdas de **97 px** con huecos de **12 px**; la celda `(r, c)` empieza en `x = 28 + c × 109`, `y = 28 + r × 109`. Radio de ficha 8 px.
- **Inicio:** tablero vacío + 2 fichas aparecidas con la regla de aparición.
- **Aparición:** en una celda vacía elegida al azar uniforme entre las vacías; valor **2** con probabilidad **0.9** y **4** con **0.1**.
- **Deslizar** (`slide`): todas las fichas se mueven en la dirección hasta el borde o la siguiente ficha. Se procesa cada fila/columna desde el borde hacia el que se mueve: dos fichas adyacentes iguales (tras compactar) se fusionan en una de valor doble; cada ficha se fusiona **como máximo una vez por movimiento**. Ejemplos hacia la izquierda: `[2,2,2,2] → [4,4,0,0]`, `[2,2,2,0] → [4,2,0,0]`, `[4,0,4,8] → [8,8,0,0]`, `[2,2,4,4] → [4,8,0,0]`.
- **Movimiento válido:** solo si el tablero cambia (`moved`). Un movimiento nulo no cuenta, no suma, no hace aparecer ficha ni anima.
- **Tras un movimiento válido:** `score += gained` (suma del valor de cada ficha resultante de fusión: `[2,2,4,4]` a la izquierda suma 4 + 8 = 12), `moves + 1`, aparece 1 ficha, se actualiza `maxTile`; se emite cada evento cuyo valor cambió.
- **Llegar a 2048:** no termina la partida ni se muestra nada; solo `FICHA MÁX` pasa a 2048. Se sigue jugando (4096, 8192…).
- **Game over:** tras la aparición, si `canMove(board)` es falso (sin celdas vacías y sin dos fichas iguales adyacentes en horizontal o vertical) → `onLives(0)` y `onGameOver(score)`.
- **Animación (solo visual; la lógica se aplica al instante en el `keydown`):** deslizamiento lineal de **100 ms** desde la celda de origen a la de destino; al terminar, la ficha fusionada hace un pulso de escala 1 → **1.12** → 1 en **120 ms** y la ficha nueva aparece con escala 0 → 1 en **120 ms**. Si llega otra tecla durante la animación, la animación en curso se termina al instante y empieza la nueva (el input nunca se bloquea ni se encola).
- **Dibujo:** fondo del canvas `#0a0a18`; tablero `#1a1a2e`; celdas vacías `#24243a`. Fichas (fondo / texto): 2 `#2b2b45`/`#e0e0ff`, 4 `#3a2f5c`/`#e0e0ff`, 8 `#ff8a00`/`#0a0a18`, 16 `#ff6a00`/`#0a0a18`, 32 `#ff3355`/`#ffffff`, 64 `#ff1f3d`/`#ffffff`, 128 `#ffe600`/`#0a0a18`, 256 `#ffd400`/`#0a0a18`, 512 `#ffc300`/`#0a0a18`, 1024 `#00f5ff`/`#0a0a18`, 2048 `#39ff14`/`#0a0a18`, ≥4096 `#ff2bd6`/`#ffffff`. Desde 128 la ficha lleva `shadowBlur` 12 con su propio color (brillo neón). Texto `bold` en `system-ui, sans-serif`, centrado: **44 px** para 1–2 dígitos, **38 px** para 3, **30 px** para 4, **24 px** para 5+.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-2048` en `app/globals.css`. Aplicar migración `add_game_2048` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = '2048'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/2048/board.ts`. Verificar: `npm run lint`; comprobar a mano (consola o script temporal en el scratchpad) los 4 ejemplos de deslizamiento del spec, que un movimiento nulo devuelve `moved = false` y que `canMove` es falso en un tablero lleno sin pares.
3. Crear `lib/games/2048/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/2048/engine.ts` y exportar `game2048Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"2048"` en `lib/games/registry.ts`. Verificar: `/games/2048/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover en las 4 direcciones con flechas y WASD, fusiones (puntaje exacto), movimiento nulo (sin ficha nueva ni cambio de MOVIMIENTOS), teclas rápidas durante la animación, forzar un game over (tablero lleno sin pares), pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = '2048'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `2048` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-2048`), la ficha `/games/2048` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`NÚMEROS`, dificultad 2, color amarillo, categoría PUZZLE).
- [ ] `/games/2048/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con exactamente 2 fichas (cada una 2 o 4), puntaje 0 y MOVIMIENTOS oculto.
- [ ] `←↑→↓` y `WASD` deslizan las fichas; las flechas no hacen scroll; mantener la tecla no repite el movimiento.
- [ ] `[2,2,2,2]` hacia la izquierda da `[4,4,0,0]` y suma 8; `[2,2,4,4]` da `[4,8,0,0]` y suma 12; ninguna ficha se fusiona dos veces en un movimiento.
- [ ] Un movimiento que no cambia el tablero no suma puntos, no añade ficha y no incrementa MOVIMIENTOS.
- [ ] Cada movimiento válido añade exactamente una ficha (2 o 4) en una celda vacía.
- [ ] El deslizamiento dura 100 ms y la aparición/pulso 120 ms; pulsar otra tecla durante la animación aplica el movimiento al instante sin perder input.
- [ ] Llegar a 2048 no detiene la partida; FICHA MÁX muestra 2048 y se puede seguir.
- [ ] Sin movimientos posibles se emite `onLives(0)` y luego `onGameOver` y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), FICHA MÁX y MOVIMIENTOS; sin eventos por frame.
- [ ] Pausa (botón y `P`) ignora teclas y congela la animación; reanudar sin salto.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas y letras WASD) no mueve fichas.
- [ ] Guardar inserta en `scores` con `game_id = '2048'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/2048` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 2 fichas nuevas, MOVIMIENTOS 0, vida 1).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/2048/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con las reglas originales; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D y texto del sistema; **No:** imágenes ni fuentes web en el canvas (`next/font` no se puede usar directamente en `ctx.font` sin esperar su carga).
- **Sí:** `initialLives: 1` para que el HUD muestre el fin y respetar `onLives(0)` → `onGameOver`; **No:** `showLevel` (el clásico no tiene niveles).
- **Sí:** stats `FICHA MÁX` y `MOVIMIENTOS`, derivados del estado y útiles sin HUD nativo.
- **Sí:** seguir jugando tras 2048 sin aviso; **No:** terminar en 2048 (cortaría el puntaje competitivo) ni overlay de victoria.
- **Sí:** lógica inmediata y animación solo visual, interrumpible; **No:** bloquear o encolar input durante la animación (sensación lenta).
- **Sí:** ignorar `e.repeat`; **No:** auto-repeat (provoca movimientos accidentales).
- **No:** deshacer (falsearía el leaderboard).
- **Sí:** probabilidades 0.9/0.1 y tiempos de animación fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` PUZZLE y color amarillo (distingue de Tetris, magenta); **Sí:** `.cover-2048` nueva.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fusiones dobles en un movimiento (`[2,2,4]` → `8`) por un algoritmo ingenuo.           | `slide` compacta, fusiona una vez por par y vuelve a compactar; verificar los 4 ejemplos del spec en el paso 2.    |
| Partidas largas (un buen jugador puede pasar de 10 min) alargan la sesión.             | Aceptado en esta variante (es el clásico); la variante 02 cubre partidas cortas.                                   |
| Un `id` que empieza por dígito rompe identificadores TS o el objeto `ENGINES`.          | Clave `"2048"` entre comillas, export `game2048Def`, `create2048`; `hasEngine("2048")` usa `in` con string.        |
| Animación y lógica se desincronizan al pulsar rápido.                                  | La lógica se aplica en el `keydown`; una nueva tecla termina la animación previa al instante.                      |
| `dt` grande tras pausar o cambiar de pestaña salta la animación.                       | `lastTime` se reinicia al reanudar; `dt` capado a 50 ms.                                                           |
| Flechas o letras WASD interfieren con el input del modal.                              | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| Texto de 5 dígitos desborda la ficha de 97 px.                                         | Tamaños de fuente por número de dígitos fijados en el spec (24 px para 5+).                                        |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deshacer, persistencia de partida, otros tamaños de tablero.
- Reloj, combos y niveles.
- HUD nativo de texto dentro del canvas y overlays de pausa/victoria/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
