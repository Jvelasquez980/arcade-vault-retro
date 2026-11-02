# SPEC GJ-match-3-contrarreloj-01 — Juego real: MATCH-3 CONTRARRELOJ (variante: clásico 90 s) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-02
> **Variant:** 01 de 2 — Clásico puro: tablero 8×8 de 6 gemas, reloj fijo de 90 s que nunca se recarga, sin gemas especiales; el puntaje sale de líneas largas y cascadas con multiplicador.
> **Objective:** Crear un motor TypeScript de Match-3 contrarreloj (variante clásico 90 s) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/match-3-contrarreloj` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Match-3 contrarreloj. Es la versión **fiel al género**: intercambias dos gemas adyacentes, si forman una línea de 3 o más del mismo tipo desaparecen, caen las de arriba y las nuevas pueden encadenar **cascadas** que multiplican los puntos. El reloj es **fijo (90 s) y no se recarga**: todos los jugadores tienen exactamente el mismo tiempo, así que el leaderboard compara eficiencia pura. No hay gemas especiales, ni niveles, ni penalizaciones. Se distingue de la variante 02 (supervivencia: barra de tiempo que se vacía y se recarga con cada gema, niveles con meta, gemas especiales rayo/bomba/nova, castigo por intercambio inválido, tablero 9×9).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-match-3-contrarreloj`.

Decisiones fijadas por el agente (no se reabren): `id` `match-3-contrarreloj`, título `MATCH-3 CONTRARRELOJ`, `cat` `PUZZLE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 2, tags `CLÁSICO` y `GEMAS`, 1 jugador, teclado. Canvas **576×576** (1:1), tablero **8×8 de 64 px**. **1 vida** (`initialLives: 1`, baja a 0 al acabarse el tiempo), sin nivel, stats extra `TIEMPO` y `MEJOR COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/match-3-contrarreloj/engine.ts`: sin globals de módulo; exporta `match3ContrarrelojDef: GameEngineDef` con `createMatch3Contrarreloj(canvas, events) → GameController`.
- Módulo `lib/games/match-3-contrarreloj/board.ts`: funciones puras sobre `Board = (number | null)[][]` (`[fila][col]`, tipo 0–5): `createBoard(rand)` (sin líneas iniciales y con al menos una jugada), `findLines(board)` (devuelve líneas `{ cells, len }`), `hasValidMove(board)`, `findHint(board)` (primera jugada válida en orden fila/columna), `applyGravity(board)` (devuelve desplazamientos por columna) y `linePoints(len)`.
- Módulo `lib/games/match-3-contrarreloj/draw.ts`: `drawBackground`, `drawTimeBar`, `drawGem(ctx, type, x, y, size, alpha, scale)`, `drawCursor`, `drawSelection`, `drawHint`, `drawComboLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"match-3-contrarreloj"` en `lib/games/registry.ts`.
- Clase `.cover-match-3-contrarreloj` en `app/globals.css`: fondo `radial-gradient(circle at 50% 40%,#002a3a,#0a0a18)`; `::after` con una rejilla 4×4 de rombos de colores (rojo, amarillo, verde, cyan) hecha con `conic-gradient`/`repeating-linear-gradient` y `::before` con una barra de tiempo cyan horizontal en la parte superior.
- Migración `add_game_match_3_contrarreloj`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **576×576**.
- HUD de React: puntaje, **1 vida**, stats extra `time` ("TIEMPO", `seconds`) y `combo` ("MEJOR COMBO", `int`). Sin nivel.
- Sin HUD nativo de texto en el canvas, salvo la barra de tiempo (elemento de juego) y la etiqueta efímera `COMBO ×N` en cascadas.
- Controles: `←↑→↓` y `WASD` mueven el cursor; `Espacio` o `Enter` selecciona/deselecciona la gema bajo el cursor; con una gema seleccionada, una dirección la intercambia con su vecina. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'match-3-contrarreloj'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `match-3-contrarreloj`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse/arrastre, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Gemas especiales, obstáculos (hielo, piedras), recarga de tiempo, niveles o metas.
- Selector de duración o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('match-3-contrarreloj', 'MATCH-3 CONTRARRELOJ', 'Alinea gemas antes de que acabe el reloj.',
       'Mueve el cursor con las flechas o WASD, selecciona una gema con Espacio e intercámbiala con su vecina para alinear tres o más iguales. Las gemas que caen pueden encadenar cascadas que multiplican los puntos. Tienes 90 segundos exactos: el reloj no se recarga.',
       'PUZZLE', 'cyan', 'cover-match-3-contrarreloj', 1, 1, '{keyboard}', '{CLÁSICO,GEMAS}', 2, 7, false);

Definición del motor:

    export const match3ContrarrelojDef: GameEngineDef = {
      width: 576, height: 576,
      initialLives: 1,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "combo", label: "MEJOR COMBO", color: "magenta", format: "int" },
      ],
      create: createMatch3Contrarreloj,
    };

Estado interno (dentro de `createMatch3Contrarreloj`): `board: (number | null)[][]` (8×8), `cursor { r, c }`, `selected { r, c } | null`, `phase: "idle" | "swapping" | "reverting" | "clearing" | "falling" | "shuffling"`, `phaseMs`, `swap { a, b } | null`, `clearing: Set<string>`, `falls: { r, c, fromY }[]` (offset visual en px), `cascade` (1 = match del intercambio), `remainingMs`, `timeUp`, `idleMs` (para la pista), `hint { a, b } | null`, `bestCombo`, `labels: { text, x, y, ms }[]`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onStat("time", s)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onStat("time", 90)`, `onStat("combo", 0)`.
- `onStat("time", s)` con `s = Math.ceil(remainingMs / 1000)`, solo cuando cambia (una vez por segundo). `onStat("combo", n)` solo cuando `bestCombo` sube. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio para MEJOR COMBO y al final para TIEMPO.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. `Espacio`/`Enter` ignoran `e.repeat`; las direcciones aceptan `e.repeat` solo para mover el cursor (nunca para intercambiar).
- Pausa/blur/destroy: `selected = null`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** tablero 8×8, celda **64 px**, origen en (32, 32) (margen 32 px por lado). Barra de tiempo en `y = 10..22`, de `x = 32` a `544`.
- **Gemas:** 6 tipos con color y forma distintos (legibles sin color): 0 rombo `#ff3355`, 1 círculo `#ff9f1c`, 2 estrella de 5 puntas `#ffe600`, 3 cuadrado `#00ff88`, 4 triángulo `#00f5ff`, 5 hexágono `#ff2bd6`. Tamaño dibujado **48 px** centrado en la celda, con brillo radial blanco arriba a la izquierda.
- **Tablero inicial:** relleno aleatorio sin ninguna línea de 3 y con `hasValidMove = true` (se regenera hasta cumplirlo). Cursor en (fila 3, col 3), sin selección.
- **Cursor y selección:**
  - Sin selección: una dirección mueve el cursor una celda (sin salir del tablero).
  - `Espacio`/`Enter` selecciona la gema del cursor; pulsarlo con selección la cancela.
  - Con selección: una dirección intenta intercambiar la gema seleccionada con su vecina en esa dirección (si existe); `selected = null` y el cursor pasa a la celda destino. Una dirección hacia fuera del tablero cancela la selección.
  - Solo se puede seleccionar o intercambiar en `phase = "idle"` y con `timeUp = false`; el cursor se mueve en cualquier fase.
- **Intercambio:** `swapping` dura **150 ms** (las dos gemas se deslizan). Si tras el intercambio no hay líneas → `reverting` 150 ms (vuelven a su sitio), sin coste. Si hay líneas → `cascade = 1` y `clearing`.
- **Líneas:** horizontales o verticales de ≥ 3 gemas iguales consecutivas. Una gema en dos líneas (L/T) se elimina una vez, pero cada línea puntúa por separado.
- **Puntos por línea:** `linePoints(3) = 30`, `linePoints(4) = 60`, `linePoints(≥5) = 100`, multiplicados por `min(cascade, 8)`. Ej.: una línea de 3 en la segunda cascada vale 60.
- **Resolución:** `clearing` **200 ms** (las gemas encogen y se desvanecen) → se aplica gravedad y se rellenan los huecos con gemas aleatorias que entran desde encima del tablero → `falling` hasta que todas llegan, cayendo a **900 px/s** → si hay nuevas líneas, `cascade += 1` y otra vez `clearing`; si no, `idle`.
- **Combo:** al volver a `idle`, si `cascade ≥ 2` se muestra `COMBO ×cascade` centrado en el tablero durante 700 ms; si `cascade > bestCombo`, `bestCombo = cascade` y `onStat("combo", cascade)`.
- **Sin jugadas:** al llegar a `idle`, si `hasValidMove = false` → `shuffling` 400 ms (las gemas se desvanecen) y se genera un tablero nuevo con las mismas reglas que el inicial. Sin coste ni puntos.
- **Pista:** si pasan **5000 ms** en `idle` sin un intercambio, las dos gemas de `findHint` laten (escala 1 → 1.12 → 1, periodo 600 ms) hasta el siguiente intercambio.
- **Reloj:** `remainingMs` empieza en **90000** y baja con `dt` en todas las fases mientras se juega (no en pausa). Nunca se recarga. La barra pasa de `#00f5ff` a `#ff3355` cuando quedan ≤ 10 s.
- **Fin:** al llegar `remainingMs` a 0 → `timeUp = true`, `selected = null` y no se aceptan más intercambios. Si `phase = "idle"`, game over inmediato; si hay una resolución en curso, termina (sus cascadas sí puntúan) y al volver a `idle` → `onLives(0)` y `onGameOver(score)`. Un intercambio en `swapping` cuando llega a 0 se completa y resuelve normalmente.
- **Dibujo:** fondo `#05101a`; tablero `#0a1a2a` con celdas alternas `#0d2133`; cursor: marco `#ffffff` de 3 px con esquinas redondeadas; selección: marco `#ffe600` de 4 px pulsante; etiqueta de combo: texto `#ffffff` 28 px fuente monoespaciada con sombra `#00f5ff`, sube 30 px y se desvanece.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-match-3-contrarreloj` en `app/globals.css`. Aplicar migración `add_game_match_3_contrarreloj` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'match-3-contrarreloj'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/match-3-contrarreloj/board.ts`. Verificar: `npm run lint`; `linePoints(3) = 30`, `linePoints(4) = 60`, `linePoints(7) = 100`; `createBoard` nunca devuelve líneas y siempre tiene jugada (probar 1000 tableros en un script temporal del scratchpad).
3. Crear `lib/games/match-3-contrarreloj/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/match-3-contrarreloj/engine.ts` y exportar `match3ContrarrelojDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"match-3-contrarreloj"` en `lib/games/registry.ts`. Verificar: `/games/match-3-contrarreloj/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover cursor por bordes, seleccionar/cancelar, intercambio inválido que vuelve, línea de 3/4/5, L/T, cascada con `COMBO ×N` y MEJOR COMBO, pista a los 5 s, barra roja a los 10 s, fin con cascada en curso, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'match-3-contrarreloj'` (registrada también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `match-3-contrarreloj` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-match-3-contrarreloj`), la ficha `/games/match-3-contrarreloj` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`GEMAS`, dificultad 2, color cyan, categoría PUZZLE).
- [ ] `/games/match-3-contrarreloj/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] El tablero inicial es 8×8, sin líneas y con al menos una jugada; el cursor empieza en (3, 3).
- [ ] `←↑→↓`/`WASD` mueven el cursor sin salir del tablero; las flechas, `Espacio` y `Enter` no hacen scroll.
- [ ] `Espacio`/`Enter` selecciona y cancela; con selección, una dirección intercambia con la vecina en 150 ms; mantener una dirección pulsada nunca encadena intercambios.
- [ ] Un intercambio sin línea vuelve atrás en 150 ms sin coste de tiempo ni puntos.
- [ ] Líneas de 3/4/5+ suman 30/60/100 × cascada (tope ×8); en una L/T se elimina cada gema una vez y puntúa cada línea.
- [ ] Las gemas caen a 900 px/s, las nuevas entran desde arriba y las cascadas suben el multiplicador; `COMBO ×N` aparece con `N ≥ 2` y MEJOR COMBO sube solo al superar el récord de la partida.
- [ ] Sin jugadas posibles el tablero se baraja en 400 ms sin coste.
- [ ] Tras 5 s sin intercambio laten las dos gemas de una jugada válida.
- [ ] TIEMPO empieza en 90 y baja 1 por segundo sin recargarse nunca; la barra se vuelve roja con ≤ 10 s.
- [ ] Al llegar a 0 no se aceptan intercambios; la cascada en curso termina y puntúa; luego `onLives(0)` → `onGameOver` abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), TIEMPO y MEJOR COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, animaciones y pista; reanudar sin salto de tiempo y sin selección residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio, Enter) no mueve el cursor ni intercambia.
- [ ] Guardar inserta en `scores` con `game_id = 'match-3-contrarreloj'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/match-3-contrarreloj` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 90, MEJOR COMBO 0, tablero nuevo, cursor en (3, 3), sin selección ni etiquetas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/match-3-contrarreloj/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` actualizados.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** reloj fijo de 90 s sin recarga; todos compiten con el mismo tiempo y es la diferencia central con la variante 02. **No:** bonus de tiempo.
- **Sí:** sin gemas especiales; el techo de puntaje lo dan líneas largas y cascadas (×8). **No:** rayos, bombas ni comodines.
- **Sí:** intercambio inválido sin coste; el reloj ya castiga el tiempo perdido.
- **Sí:** la cascada en curso al acabar el tiempo se termina y puntúa; evita cortar una jugada ya hecha.
- **Sí:** cursor + selección con teclado (Espacio y dirección); **No:** mouse ni arrastre en este spec.
- **Sí:** 6 gemas con forma distinta además de color (accesibilidad para daltonismo).
- **Sí:** barajado automático gratuito sin jugadas; **Sí:** pista a los 5 s para no atascar a novatos.
- **Sí:** `initialLives: 1` (como Snake) para que el HUD muestre el fin; **No:** `showLevel`, no hay niveles.
- **Sí:** stats `TIEMPO` y `MEJOR COMBO`.
- **Sí:** valores de balance (90 s, 30/60/100, tope ×8, 900 px/s, tiempos de animación) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` PUZZLE y color cyan; **Sí:** `.cover-match-3-contrarreloj` nueva.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `createBoard` entra en bucle largo buscando un tablero válido.                          | Rellenar celda a celda evitando el tipo que formaría línea con las 2 previas; regenerar solo si no hay jugada. |
| Cascadas infinitas o fases encadenadas mal (gema eliminada dos veces).                  | Máquina de fases explícita; `clearing` como `Set` de `"r,c"`; gravedad en función pura testeada en el paso 2.  |
| Mantener una flecha con selección dispara varios intercambios.                          | El intercambio limpia `selected` y solo ocurre en `idle`; `e.repeat` solo mueve el cursor.                     |
| Emitir `onStat("time")` por frame satura React.                                         | Emitir solo cuando cambia `Math.ceil(remainingMs / 1000)`.                                                     |
| `dt` grande tras pausar o cambiar de pestaña consume segundos del reloj.                | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                           |
| Flechas, WASD, espacio o Enter interfieren con el input del modal.                      | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Game over doble si el tiempo acaba durante una resolución.                              | `timeUp` + `finished`; el fin se dispara una sola vez al volver a `idle`.                                      |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guiones y dígito requiere comillas en `ENGINES` y nombres JS válidos.         | Clave `"match-3-contrarreloj"`; carpeta `lib/games/match-3-contrarreloj/`; símbolos `match3Contrarreloj*`; migración con `_`. |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse/arrastre y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Gemas especiales, obstáculos, recarga de tiempo, niveles y metas.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de duración o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
