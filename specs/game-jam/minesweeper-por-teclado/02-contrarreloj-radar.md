# SPEC GJ-minesweeper-por-teclado-02 — Juego real: MINESWEEPER (variante: contrarreloj con radar) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-06
> **Variant:** 02 de 2 — Buscaminas arcade contra un reloj global: tableros pequeños en serie, 3 vidas (una mina resta vida y tiempo, no termina la partida), combo por revelar rápido y cargas de radar para escapar de las adivinanzas.
> **Objective:** Crear un motor TypeScript de Minesweeper (variante contrarreloj con radar) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/minesweeper-por-teclado` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Minesweeper por teclado. Convierte el Buscaminas en un arcade de velocidad para teclado: un **reloj global** de 90 s que solo se recarga despejando tableros, tableros **pequeños** (8×8 a 12×12) que se resuelven en segundos, **3 vidas** (pisar una mina resta una vida y 10 s pero la partida sigue), un **combo** ×1–×5 que multiplica los puntos si se revela sin titubear y cargas de **RADAR** que revelan con seguridad el 3×3 del cursor (la salida a los 50/50 con prisa). La partida termina al agotarse el tiempo o las vidas. Se distingue de la variante 01 (campaña clásica: 1 vida, sin reloj global, tableros crecientes hasta 16×16, bonus por tiempo contra par), que premia la lógica pausada; esta premia el ritmo.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, gradientes y trazos. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-minesweeper-por-teclado`.

Decisiones fijadas por el agente (no se reabren): `id` `minesweeper-por-teclado`, título `MINESWEEPER`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` tiene reservado el 6 en `specs/game-jam/missile-command/`), dificultad 4, tags `CONTRARRELOJ` y `COMBOS`, 1 jugador, teclado. Canvas **600×600** (1:1). **3 vidas** (`initialLives: 3`), **nivel** = número de tablero (`showLevel: true`), stats extra `TIEMPO`, `COMBO` y `RADAR`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/minesweeper-por-teclado/engine.ts`: sin globals de módulo; exporta `minesweeperDef: GameEngineDef` con `createMinesweeper(canvas, events) → GameController`.
- Módulo `lib/games/minesweeper-por-teclado/board.ts`: funciones puras sin DOM — `boardFor(level) → { cols, rows, mines }`, `placeMines(cols, rows, mines, safeX, safeY, rand) → Uint8Array`, `countAdjacent(mines, cols, rows) → Uint8Array`, `floodReveal(state, x, y) → number` (celdas reveladas), `neighbors(x, y, cols, rows)`, `comboAfter(prevCombo, msSinceLast) → number`.
- Módulo `lib/games/minesweeper-por-teclado/draw.ts`: `drawCellHidden`, `drawCellRevealed`, `drawNumber`, `drawFlag`, `drawRadarMark`, `drawMine`, `drawExploded`, `drawCursor`, `drawRadarPulse`, `drawLowTimeFrame` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"minesweeper-por-teclado"` en `lib/games/registry.ts`.
- Clase `.cover-minesweeper-por-teclado` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%,#2a2400,#0a0a18)` con rejilla `repeating-linear-gradient` amarilla al 15 % (celdas de 22 px), `::before` con tres anillos concéntricos `#ffe600` (barrido de radar) y `::after` con una mina (círculo `#ffffff` con halo `#ff3355`).
- Migración `add_game_minesweeper_por_teclado`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **3 vidas**, **nivel** (tablero actual), stats extra `time` ("TIEMPO", `seconds`), `combo` ("COMBO", `int`) y `radar` ("RADAR", `int`).
- Sin HUD nativo de texto en el canvas: solo tablero, números, marcas, cursor y efectos (pulso de radar, marco rojo con poco tiempo).
- Controles: `←↑→↓` y `WASD` mueven el cursor; `Espacio` o `Enter` revelan (o hacen *chording* sobre un número); `F` o `X` ponen/quitan bandera; `Q` o `R` usan una carga de radar. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'minesweeper-por-teclado'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `minesweeper-por-teclado`).

**Out of scope (para specs futuras):**

- Mouse, controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Tableros grandes (16×16), modo sin reloj, una sola vida, bonus contra par (eso es la variante 01).
- Otros power-ups además del radar, recuperar vidas, tableros "sin adivinar", marca `?`, selector de dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('minesweeper-por-teclado', 'MINESWEEPER', 'Despeja tableros contra el reloj.',
       'Mueve el cursor con las flechas o WASD, revela con Espacio o Enter y marca minas con F. Tienes 90 segundos: cada tablero despejado suma tiempo y puntos, y revelar rápido sube el combo hasta ×5. Pisar una mina cuesta una vida y 10 segundos; si dudas, usa el radar con Q para despejar el 3×3 del cursor. Se acaba cuando se agota el reloj o tus tres vidas.',
       'ARCADE', 'yellow', 'cover-minesweeper-por-teclado', 1, 1, '{keyboard}', '{CONTRARRELOJ,COMBOS}', 4, 7, false);

Definición del motor:

    export const minesweeperDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
        { key: "radar", label: "RADAR", color: "cyan", format: "int" },
      ],
      create: createMinesweeper,
    };

Estado interno (dentro de `createMinesweeper`): `level`, `cols`, `rows`, `mineCount`, `cell` (px), `originX`, `originY`, `mines: Uint8Array | null` (null hasta el primer revelado del tablero), `adj: Uint8Array`, `state: Uint8Array` (0 oculta, 1 revelada, 2 bandera, 3 marca de radar, 4 mina explotada), `revealedSafe`, `cursorX`, `cursorY`, `timeLeftMs`, `clockOn`, `lastSecondEmitted`, `lives`, `combo`, `lastRevealAt` (ms de juego), `playMs`, `radar`, `pulses: { x, y, ms }[]`, `phase: "play" | "clear" | "over"`, `clearMs`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`, `onStat("combo", n)`, `onStat("radar", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("time", 90)`, `onStat("combo", 0)`, `onStat("radar", 2)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.ceil(timeLeftMs / 1000)` (una vez por segundo y al sumar/restar tiempo). Valor 0 oculta el stat (contrato de `onStat`); esperado en COMBO al inicio y tras pisar una mina, y en RADAR sin cargas.
- Game over por vidas: `onLives(0)` y luego `onGameOver(score)`. Game over por tiempo: `onStat("time", 0)` y `onGameOver(score)` sin cambiar vidas. En ambos casos el motor deja de actualizar y de reaccionar a teclas; el último frame (minas a la vista) queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. Revelar, bandera y radar ignoran `e.repeat` (una acción por pulsación); el movimiento del cursor acepta `e.repeat`.
- Pausa/blur/destroy: no hay teclas mantenidas que limpiar; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Con pausa el reloj y la ventana de combo no avanzan (`playMs` solo suma en juego).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`. rAF detenido mientras está en pausa (patrón SPEC 13).
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tableros por nivel** (`boardFor(level)`):

  | Nivel | Columnas × filas | Minas |
  | ----- | ---------------- | ----- |
  | 1–2   | 8 × 8            | 10    |
  | 3–4   | 10 × 10          | 18    |
  | ≥ 5   | 12 × 12          | 28    |

- **Geometría:** área de tablero de **576 × 576 px** centrada (margen 12 px). `cell = Math.floor(576 / cols)` (8 → 72, 10 → 57, 12 → 48); `originX = originY = Math.floor((600 − cell × cols) / 2)`.
- **Cursor:** empieza en la celda central (`Math.floor(cols / 2)`, `Math.floor(rows / 2)`) de cada tablero. Flechas/WASD mueven 1 celda y en los bordes **hacen wrap** al lado opuesto (recorrer rápido con prisa).
- **Reloj:** `timeLeftMs` empieza en **90 000**. Arranca con el primer revelado de la partida y desde entonces corre siempre en `phase = "play"` (también antes del primer revelado de los tableros siguientes); se congela durante la transición entre tableros y en pausa. Tope **180 000**.
- **Primer revelado seguro:** las minas se colocan al primer revelado de cada tablero, al azar (Fisher–Yates) excluyendo la celda del cursor y sus 8 vecinas.
- **Revelar** (`Espacio`/`Enter`) sobre celda oculta: si es mina → impacto. Si no, se revela con *flood fill* iterativo en los 0. Sobre bandera, marca de radar, mina explotada o celda revelada sin número, se ignora.
- **Chording** (`Espacio`/`Enter`) sobre número `k ≥ 1` con exactamente `k` vecinas entre banderas, marcas de radar y minas explotadas: revela las vecinas ocultas restantes como una sola acción. Si alguna es mina → **un** impacto por acción (todas las minas pisadas en ese *chording* pasan a explotadas).
- **Bandera** (`F`/`X`): alterna oculta ↔ bandera. Sobre otra cosa se ignora. Sin límite y sin penalización por bandera errónea.
- **Impacto:** la celda pasa a mina explotada (estado 4, ya no se puede revelar y cuenta como marcada para el *chording*), `lives −= 1` → `onLives(lives)`, `timeLeftMs −= 10 000` (mín. 0), `combo = 0` → `onStat("combo", 0)`. Si `lives = 0` → game over por vidas; si el reloj llega a 0 → game over por tiempo.
- **Combo** (`comboAfter`): cada acción de revelar o *chording* que destapa ≥ 1 celda segura: si `playMs − lastRevealAt ≤ 2000` → `combo = min(combo + 1, 5)`; si no (o es la primera) → `combo = 1`. Después `lastRevealAt = playMs`. Moverse o poner banderas no rompe el combo; solo el tiempo y las minas.
- **Radar** (`Q`/`R`): cargas iniciales **2**, máximo **3**, **+1** al despejar cada tablero. Con `radar > 0`, minas ya colocadas y al menos una celda oculta (estado 0 o bandera) en el 3×3 del cursor: consume 1 carga → `onStat("radar", n)`; cada mina del 3×3 pasa a marca de radar (estado 3, sustituye banderas) y cada celda segura oculta se revela (con *flood fill* si es 0), sumando **2** puntos por celda; no modifica `combo` ni `lastRevealAt`. Se dibuja un pulso circular de 400 ms. En cualquier otro caso la pulsación se ignora sin gastar carga (también antes del primer revelado del tablero).
- **Puntos:**
  - Celda segura revelada por acción de revelar/*chording*: **5 × combo** (combo ya actualizado por esa acción). Ej.: un *flood fill* de 12 celdas con combo 3 = 180.
  - Celda revelada por radar: **2**.
  - Tablero despejado (todas las seguras reveladas): **250 × nivel** + **10 × `Math.ceil(timeLeftMs / 1000)`** (antes de sumar el tiempo extra).
- **Fin de tablero:** `phase = "clear"`, minas restantes se muestran con bandera, se suman puntos, `timeLeftMs = min(timeLeftMs + 20 000, 180 000)`, `radar = min(radar + 1, 3)`; durante **800 ms** se ignoran las teclas de juego y el reloj no corre. Luego `level += 1`, `onLevel(level)`, tablero nuevo sin minas y cursor centrado. El combo **se conserva** entre tableros (la ventana de 2000 ms usa `playMs`, que no avanza en la transición).
- **Game over:** se revelan todas las minas (las explotadas con fondo `#ff3355`) y banderas erróneas con `X` `#ff3355`.
- **Dibujo:** fondo `#0a0900`. Celda oculta: cuadrado `cell − 2` px con gradiente `#2a2610` → `#17140a` y bisel superior/izquierdo `#4a4320`. Revelada: `#0c0c0c` con borde `#1c1a10`. Números en fuente monoespaciada negrita a `0.6 × cell` px: 1 `#00f5ff`, 2 `#39ff14`, 3 `#ff3355`, 4 `#b026ff`, 5 `#ffe600`, 6 `#ff8c00`, 7 `#ffffff`, 8 `#8a8a8a`. Bandera: mástil blanco + triángulo `#ff2bd6`. Marca de radar: rombo `#00f5ff` con halo. Mina: círculo `#ffffff` de radio `0.28 × cell` con 8 púas. Cursor: contorno de 3 px `#ffe600` con `shadowBlur` 12 y opacidad pulsante 0.6–1 (periodo 600 ms). Pulso de radar: anillo `#00f5ff` que crece de 0 a `1.8 × cell` en 400 ms y se desvanece. Con `timeLeftMs < 10 000`: marco de 4 px `#ff3355` alrededor del tablero que parpadea a 2 Hz.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente, rAF detenido en pausa). Crear `.cover-minesweeper-por-teclado` en `app/globals.css`. Aplicar migración `add_game_minesweeper_por_teclado` con `published = false` (`mcp__supabase__apply_migration`) y anotarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'minesweeper-por-teclado'` muestra la fila; `npm run build`.
2. Crear `lib/games/minesweeper-por-teclado/board.ts`. Verificar: `npm run lint`; `boardFor(2)` = 8×8/10, `boardFor(4)` = 10×10/18, `boardFor(9)` = 12×12/28; `comboAfter(0, 0) = 1`, `comboAfter(2, 1500) = 3`, `comboAfter(5, 1000) = 5`, `comboAfter(4, 2500) = 1`; `placeMines` respeta el 3×3 seguro y coloca exactamente `mines`.
3. Crear `lib/games/minesweeper-por-teclado/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/minesweeper-por-teclado/engine.ts` y exportar `minesweeperDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"minesweeper-por-teclado"` en `lib/games/registry.ts`. Verificar: `/games/minesweeper-por-teclado/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): wrap del cursor, reloj que arranca al primer revelado, combo subiendo hasta ×5 y reiniciándose tras 2 s, pisar una mina (vida −1, −10 s, combo 0, partida sigue), radar (marca minas, revela, +2 por celda, no gasta sin celdas ocultas), despejar un tablero (+250 × nivel + 10 × s, +20 s, +1 radar, 800 ms congelado), nivel 3 con 10×10, marco rojo bajo 10 s, game over por tiempo y por vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'minesweeper-por-teclado'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `minesweeper-por-teclado` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-minesweeper-por-teclado`), la ficha `/games/minesweeper-por-teclado` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`COMBOS`, dificultad 4, color amarillo, categoría ARCADE).
- [ ] `/games/minesweeper-por-teclado/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven el cursor con wrap en los bordes; flechas, `Espacio` y `Enter` no hacen scroll.
- [ ] El tablero 1 es 8×8 con 10 minas; el primer revelado abre un hueco seguro; TIEMPO muestra 90 y no baja hasta ese primer revelado.
- [ ] Revelar con menos de 2 s entre acciones sube COMBO 1 → 2 → … → 5 (tope); esperar más de 2 s lo devuelve a 1; cada celda vale 5 × combo.
- [ ] Pisar una mina resta 1 vida y 10 s, pone COMBO a 0 y la partida continúa; la mina queda explotada y no se puede volver a pisar; un *chording* con varias minas resta una sola vida.
- [ ] RADAR empieza en 2; `Q`/`R` revela las seguras del 3×3 (+2 cada una), marca sus minas y baja la carga; sin celdas ocultas en el 3×3 o antes del primer revelado no gasta carga.
- [ ] Despejar un tablero suma 250 × nivel + 10 × segundos restantes, añade 20 s (tope 180) y 1 carga de radar (tope 3); congela 800 ms y pasa al siguiente nivel con cursor centrado; el combo se conserva.
- [ ] Niveles 3–4 usan 10×10/18 minas y desde el 5 12×12/28.
- [ ] Bajo 10 s el tablero parpadea con marco rojo.
- [ ] Al llegar TIEMPO a 0 se emite `onGameOver` sin cambiar vidas; al perder la 3.ª vida se emite `onLives(0)` y luego `onGameOver`; ambos abren el modal con el puntaje correcto y muestran todas las minas.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, TIEMPO, COMBO y RADAR; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj y ventana de combo; reanudar sin salto de tiempo ni pérdida de combo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`/`A`/`S`/`D`, `F`, `X`, `Q`, `R`, espacio, Enter) no mueve el cursor ni revela.
- [ ] Guardar inserta en `scores` con `game_id = 'minesweeper-por-teclado'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/minesweeper-por-teclado` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, TIEMPO 90 detenido, COMBO 0, RADAR 2, 8×8 sin minas colocadas, cursor centrado).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/minesweeper-por-teclado/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** reloj global de 90 s recargable (+20 s por tablero, tope 180); es la diferencia central con la variante 01 y garantiza partidas cortas. **No:** temporizador por tablero ni bonus contra par.
- **Sí:** 3 vidas y mina = −1 vida y −10 s sin terminar la partida; con prisa, una sola mina sería demasiado castigo. **No:** recuperar vidas.
- **Sí:** combo ×1–×5 con ventana de 2000 ms de juego; premia el ritmo y amplía el rango del leaderboard. **No:** combo que se rompa por moverse o marcar.
- **Sí:** radar de 3×3 con cargas (2 iniciales, +1 por tablero, tope 3) y 2 puntos por celda; salida limitada a las adivinanzas forzadas sin regalar puntos. **No:** otros power-ups.
- **Sí:** tableros pequeños (8×8 a 12×12, densidad 15.6–19.4 %) que se resuelven en segundos. **No:** 16×16.
- **Sí:** cursor con wrap; con reloj, cruzar el tablero rápido importa más que el tope de borde.
- **Sí:** stats `TIEMPO`, `COMBO` y `RADAR`; son los tres recursos que el jugador gestiona. **No:** contador de minas restantes (la bandera es opcional aquí).
- **Sí:** canvas 600×600 con celda calculada por tablero. **No:** canvas que cambie de tamaño (rompería `--game-ar`).
- **Sí:** valores de balance (tiempos, combo, radar, puntos, tamaños, 800 ms) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color yellow; **Sí:** `.cover-minesweeper-por-teclado` nueva.
- **Sí:** el `id` es `minesweeper-por-teclado` (fijado por quien encargó la jam); clave entre comillas en `ENGINES` y migración con `_`.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                       |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Spamear revelados al azar con 3 vidas rinde más que pensar.                              | Cada mina cuesta 10 s y anula el combo; verificar en el paso 6 que jugar a ciegas puntúa menos y ajustar solo editando el spec. |
| Bonus de tablero o tiempo extra cobrados dos veces.                                      | `phase = "clear"` se fija una vez al detectar `revealedSafe` completo; el input se ignora 800 ms.                |
| *Flood fill* recursivo desborda la pila.                                                 | Implementación iterativa con pila explícita.                                                                     |
| El reloj o la ventana de combo avanzan en pausa o tras cambiar de pestaña.              | Ambos dependen de `playMs`/`timeLeftMs` que solo cambian en `update` con `dt` capado a 50 ms; `lastTime` se reinicia al reanudar y tras blur. |
| Emitir `onStat("time")` por frame satura React.                                          | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                        |
| `Enter`/`Espacio` también activan el botón enfocado de React.                            | `preventDefault` con juego activo; verificar en el paso 6.                                                       |
| Letras WASD/F/X/Q/R interfieren con el input del modal.                                   | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                             |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                           |
| El id con guiones requiere comillas en `ENGINES` y nombres válidos de migración.         | Clave `"minesweeper-por-teclado"`; carpeta `lib/games/minesweeper-por-teclado/`; migración con `_`.              |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                  |

---

## What is **not** in this spec

- Mouse, controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Tableros 16×16, modo sin reloj, una sola vida y bonus contra par.
- Otros power-ups, recuperación de vidas, generador "sin adivinar", marca `?`, selector de dificultad.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
