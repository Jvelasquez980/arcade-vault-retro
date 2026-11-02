# SPEC GJ-match-3-contrarreloj-02 — Juego real: MATCH-3 CONTRARRELOJ (variante: supervivencia con especiales) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-02
> **Variant:** 02 de 2 — Supervivencia moderna: barra de 30 s que se vacía cada vez más rápido y se recarga con cada gema eliminada, niveles por meta de gemas, gemas especiales (rayo, bomba, nova) y castigo por intercambio inválido, en tablero 9×9.
> **Objective:** Crear un motor TypeScript de Match-3 contrarreloj (variante supervivencia con especiales) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/match-3-contrarreloj` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Match-3 contrarreloj. Convierte el contrarreloj en **supervivencia**: no hay duración fija, sino una barra de tiempo (máx. 30 s) que **se recarga con cada gema eliminada** y se vacía **más rápido en cada nivel**. Los niveles suben al cumplir una **meta de gemas**. Las líneas de 4, 5 y las formas L/T crean **gemas especiales** (rayo, bomba, nova) que detonan en cadena, y un intercambio inválido **cuesta 2 s**. La partida dura lo que aguante el jugador, así que el leaderboard premia ritmo y planificación. Se distingue de la variante 01 (clásico: reloj fijo de 90 s sin recarga, sin especiales, sin niveles, sin castigos, tablero 8×8).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-match-3-contrarreloj`.

Decisiones fijadas por el agente (no se reabren): `id` `match-3-contrarreloj`, título `MATCH-3 CONTRARRELOJ`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 4, tags `SUPERVIVENCIA` y `ESPECIALES`, 1 jugador, teclado. Canvas **560×600**, tablero **9×9 de 56 px**. **1 vida** (`initialLives: 1`, baja a 0 al vaciarse la barra), **nivel** (`showLevel: true`), stats extra `TIEMPO` y `META`. Sin pista automática. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/match-3-contrarreloj/engine.ts`: sin globals de módulo; exporta `match3ContrarrelojDef: GameEngineDef` con `createMatch3Contrarreloj(canvas, events) → GameController`.
- Módulo `lib/games/match-3-contrarreloj/board.ts`: funciones puras sobre `Board = (Gem | null)[][]` (`[fila][col]`): `createBoard(rand, types)` (sin líneas y con jugada), `findGroups(board)` (líneas `{ cells, len, dir }` y cruces L/T), `hasValidMove(board)`, `applyGravity(board)` y `shuffleBoard(board, rand)`.
- Módulo `lib/games/match-3-contrarreloj/specials.ts`: `specialFor(group)` (qué especial crea un grupo y en qué celda) y `blastCells(board, r, c, partnerType?)` (celdas que elimina una detonación).
- Módulo `lib/games/match-3-contrarreloj/balance.ts`: funciones puras `drainRate(level)`, `goal(level)`, `typesFor(level)`, `gemPoints(cascade)`, `specialPoints(cascade)` y constantes (`MAX_TIME_MS`, `GEM_TIME_MS`, `INVALID_PENALTY_MS`, `LEVEL_TIME_MS`).
- Módulo `lib/games/match-3-contrarreloj/draw.ts`: `drawBackground`, `drawTimeBar`, `drawGem`, `drawSpecial` (rayo, bomba, nova), `drawCursor`, `drawSelection`, `drawFloatLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"match-3-contrarreloj"` en `lib/games/registry.ts`.
- Clase `.cover-match-3-contrarreloj` en `app/globals.css`: fondo `radial-gradient(circle at 50% 60%,#2a2400,#0a0a18)`; `::after` con rejilla 4×4 de rombos de colores y uno central blanco con halo (nova) hecho con `radial-gradient`/`conic-gradient`; `::before` con una barra de tiempo amarilla a medio vaciar en la parte superior.
- Migración `add_game_match_3_contrarreloj`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **560×600**.
- HUD de React: puntaje, **1 vida**, **nivel**, stats extra `time` ("TIEMPO", `seconds`) y `goal` ("META", `int`, gemas que faltan para subir de nivel).
- Sin HUD nativo de texto en el canvas, salvo la barra de tiempo (elemento de juego) y etiquetas efímeras (`+10 s`, `−2 s`, `NIVEL N`, `×N`).
- Controles: `←↑→↓` y `WASD` mueven el cursor; `Espacio` o `Enter` selecciona/deselecciona; con selección, una dirección intercambia con la vecina. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'match-3-contrarreloj'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `match-3-contrarreloj`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse/arrastre, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Pista automática, obstáculos (hielo, piedras, cadenas), combinaciones especial + especial distintas de las definidas aquí.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('match-3-contrarreloj', 'MATCH-3 CONTRARRELOJ', 'Alinea gemas para que no se vacíe el reloj.',
       'Mueve el cursor con las flechas o WASD, selecciona con Espacio e intercambia gemas vecinas para alinear tres o más. Cada gema eliminada recarga la barra de tiempo, que se vacía más rápido en cada nivel. Alinea cuatro para crear un rayo, cinco para una nova y forma una L o una T para una bomba. Un intercambio inútil cuesta 2 segundos.',
       'ARCADE', 'yellow', 'cover-match-3-contrarreloj', 1, 1, '{keyboard}', '{SUPERVIVENCIA,ESPECIALES}', 4, 7, false);

Definición del motor:

    export const match3ContrarrelojDef: GameEngineDef = {
      width: 560, height: 600,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "goal", label: "META", color: "cyan", format: "int" },
      ],
      create: createMatch3Contrarreloj,
    };

Estado interno (dentro de `createMatch3Contrarreloj`): `board: (Gem | null)[][]` (9×9) con `Gem = { type: number, special: "none" | "rayo-h" | "rayo-v" | "bomba" | "nova" }` (la nova tiene `type = -1`), `cursor { r, c }`, `selected { r, c } | null`, `phase: "idle" | "swapping" | "reverting" | "clearing" | "falling" | "shuffling"`, `phaseMs`, `swap { a, b } | null`, `clearing: Set<string>`, `pendingSpecials: { r, c, gem }[]`, `falls: { r, c, fromY }[]`, `cascade`, `timeMs`, `level`, `goalLeft`, `labels: { text, x, y, ms, color }[]`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`, `onStat("goal", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 30)`, `onStat("goal", 20)`.
- `onStat("time", s)` con `s = Math.ceil(timeMs / 1000)`, solo cuando cambia. `onStat("goal", n)` solo cuando cambia `goalLeft`. Valor 0 oculta el stat (contrato de `onStat`); `goalLeft` nunca queda en 0 porque se reinicia en el mismo paso al subir de nivel.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas, `Espacio` y `Enter` solo con el juego activo y sin pausa. `Espacio`/`Enter` ignoran `e.repeat`; las direcciones aceptan `e.repeat` solo para mover el cursor (nunca para intercambiar).
- Pausa/blur/destroy: `selected = null`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** tablero 9×9, celda **56 px**, origen en (28, 68). Barra de tiempo en `y = 24..44`, de `x = 28` a `532`.
- **Gemas normales:** tipos 0 rombo `#ff3355`, 1 círculo `#ff9f1c`, 2 estrella `#ffe600`, 3 cuadrado `#00ff88`, 4 triángulo `#00f5ff`, 5 hexágono `#ff2bd6` y, desde nivel 5, 6 cruz `#b388ff`. `typesFor(level) = level ≥ 5 ? 7 : 6` (solo afecta a gemas nuevas; las del tablero no cambian). Tamaño dibujado **42 px** centrado.
- **Tablero inicial:** aleatorio, sin líneas de 3 y con al menos una jugada. Cursor en (4, 4), sin selección.
- **Cursor y selección:** igual que el género: sin selección, una dirección mueve el cursor (sin salir del tablero); `Espacio`/`Enter` selecciona o cancela; con selección, una dirección intercambia con la vecina, `selected = null` y el cursor pasa al destino; hacia fuera del tablero cancela. Seleccionar e intercambiar solo en `phase = "idle"`; el cursor se mueve en cualquier fase.
- **Intercambio:** `swapping` **120 ms**. Es válido si forma alguna línea o si una de las dos gemas es nova. Si no es válido → `reverting` 120 ms, `timeMs −= 2000` (mínimo 0) y etiqueta `−2 s` roja sobre el cursor.
- **Grupos:** líneas horizontales o verticales de ≥ 3 gemas del mismo `type` (las especiales de color cuentan con su color; la nova no forma líneas). Una horizontal y una vertical del mismo tipo que comparten celda forman un cruce L/T.
- **Creación de especiales** (`specialFor`), prioridad nova > bomba > rayo, una por grupo:
  - línea de ≥ 5 → **nova** (`type = -1`);
  - cruce L/T → **bomba** del color del grupo, en la celda compartida;
  - línea de exactamente 4 → **rayo** del color del grupo: `rayo-h` si la línea es horizontal, `rayo-v` si es vertical.
  - Celda de la nova/rayo: la del intercambio si pertenece al grupo; si no (cascada), `cells[1]` de la línea ordenada de izquierda a derecha o de arriba abajo. La especial recién creada no se elimina en ese mismo paso.
- **Detonaciones** (`blastCells`): una especial de color que se elimina detona:
  - `rayo-h` elimina toda su fila; `rayo-v`, toda su columna;
  - `bomba` elimina el cuadrado 3×3 centrado en ella;
  - una especial alcanzada por otra detonación también detona (cadena resuelta en el mismo paso, cada celda una sola vez).
- **Nova:** al intercambiarla con una gema de tipo `t` elimina la nova y todas las gemas de tipo `t` del tablero (las especiales de tipo `t` detonan). Nova con nova elimina el tablero completo. La nova solo se activa por intercambio; si una detonación la alcanza, se elimina sin efecto.
- **Resolución:** `clearing` **180 ms** → gravedad y relleno desde arriba con `typesFor(level)` tipos → `falling` a **1000 px/s** → si hay grupos nuevos, `cascade += 1` y otra vez `clearing`; si no, `idle`. `cascade = 1` en el paso del intercambio. Al volver a `idle` con `cascade ≥ 2` se muestra `×cascade` 600 ms.
- **Puntos:** cada gema eliminada `gemPoints(c) = 10 × min(c, 6)`; cada especial detonada (incluida la nova) suma además `specialPoints(c) = 50 × min(c, 6)`, con `c = cascade` del paso.
- **Tiempo:** `timeMs` empieza en **30000** y su tope es **30000**. Solo se vacía en `phase = "idle"` (las animaciones de intercambio y cascada lo congelan), a `drainRate(level) = min(1 + 0.15 × (level − 1), 2.5)` ms por ms de juego (nivel 1: 1×; nivel 11+: 2.5×). Cada gema eliminada suma **250 ms** (tope 30000). La barra es `#ffe600` y pasa a `#ff3355` con ≤ 5 s.
- **Niveles:** `goal(level) = 20 + 10 × (level − 1)` gemas eliminadas (nivel 1: 20, nivel 2: 30…). Cada gema eliminada resta 1 a `goalLeft`; al llegar a 0: `level += 1`, `onLevel(level)`, +**100 × level** puntos (con el nivel nuevo), `timeMs += 10000` (tope 30000), etiqueta `NIVEL N` + `+10 s`, y `goalLeft = goal(level)` (el sobrante se descarta).
- **Sin jugadas:** al llegar a `idle`, si `hasValidMove = false` (una nova en el tablero siempre es jugada) → `shuffling` 400 ms: se reordenan las gemas existentes (especiales incluidas) hasta que no haya líneas y sí jugada, máximo 50 intentos; si fallan todos, tablero nuevo solo con gemas normales. Sin coste de tiempo.
- **Fin:** cuando `timeMs` llega a 0 en `idle` → `onLives(0)` y `onGameOver(score)`. Si llega a 0 por la penalización de un intercambio inválido, el fin ocurre al terminar el `reverting`.
- **Dibujo:** fondo `#0f0c00`; tablero `#1a1608` con celdas alternas `#211c0a`. Rayo: la gema con 3 franjas blancas en su orientación; bomba: la gema con anillo `#000000` de 3 px y halo `#ffffff` pulsante (periodo 800 ms); nova: esfera blanca con `conic-gradient` de los 6 colores girando a 180 °/s. Detonación de rayo: haz blanco de 12 px a lo largo de fila/columna durante el `clearing`; bomba: onda circular de 0 a 84 px. Cursor: marco `#ffffff` de 3 px; selección: marco `#ffe600` de 4 px pulsante. Etiquetas: 22 px fuente monoespaciada (`+10 s` y `NIVEL N` `#00ff88`, `−2 s` `#ff3355`, `×N` `#ffffff`), suben 30 px y se desvanecen en 700 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-match-3-contrarreloj` en `app/globals.css`. Aplicar migración `add_game_match_3_contrarreloj` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'match-3-contrarreloj'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/match-3-contrarreloj/balance.ts`. Verificar: `npm run lint`; `drainRate(1) = 1`, `drainRate(5) = 1.6`, `drainRate(20) = 2.5`, `goal(1) = 20`, `goal(4) = 50`, `typesFor(4) = 6`, `typesFor(5) = 7`, `gemPoints(9) = 60`, `specialPoints(2) = 100`.
3. Crear `lib/games/match-3-contrarreloj/board.ts` y `specials.ts`. Verificar: `npm run lint`; con tableros fijos en un script temporal del scratchpad: línea de 4 horizontal → `rayo-h`, línea de 5 → nova, L de 3+3 → bomba en la esquina; `rayo-v` elimina 9 celdas de su columna; bomba en el borde elimina solo las celdas dentro del tablero; `createBoard` sin líneas y con jugada en 1000 intentos.
4. Crear `lib/games/match-3-contrarreloj/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/match-3-contrarreloj/engine.ts` y exportar `match3ContrarrelojDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"match-3-contrarreloj"` en `lib/games/registry.ts`. Verificar: `/games/match-3-contrarreloj/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): intercambio inválido (−2 s), crear y detonar rayo, bomba y nova, nova con nova, especial alcanzada por otra, cascada `×N`, barra congelada durante cascadas, recarga por gema, subida de nivel (+10 s, META, bonus), séptima gema en nivel 5, barajado, vaciado de la barra, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'match-3-contrarreloj'` (registrada también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `match-3-contrarreloj` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-match-3-contrarreloj`), la ficha `/games/match-3-contrarreloj` y el home muestran el juego desde la BD (1 jugador, teclado, tags `SUPERVIVENCIA`/`ESPECIALES`, dificultad 4, color amarillo, categoría ARCADE).
- [ ] `/games/match-3-contrarreloj/jugar` muestra el canvas 560×600 sin desborde a 375 px y 1280 px.
- [ ] El tablero inicial es 9×9 con 6 tipos, sin líneas y con al menos una jugada; el cursor empieza en (4, 4).
- [ ] `←↑→↓`/`WASD` mueven el cursor; `Espacio`/`Enter` selecciona y cancela; con selección, una dirección intercambia en 120 ms; flechas, `Espacio` y `Enter` no hacen scroll; mantener una dirección no encadena intercambios.
- [ ] Un intercambio sin línea (y sin nova) vuelve atrás y resta exactamente 2 s mostrando `−2 s`.
- [ ] Cada gema eliminada suma 10 × cascada (tope ×6) y 250 ms de tiempo (tope 30 s); cada especial detonada suma además 50 × cascada.
- [ ] Una línea de 4 crea un rayo en su orientación que, al eliminarse, borra su fila o columna completa.
- [ ] Un cruce L/T crea una bomba en la celda compartida que borra el 3×3 a su alrededor.
- [ ] Una línea de 5+ crea una nova; intercambiarla con una gema borra todas las de ese tipo; nova con nova borra el tablero.
- [ ] Una especial alcanzada por otra detonación detona en el mismo paso; ninguna celda puntúa dos veces.
- [ ] La barra empieza en 30 s, solo baja en `idle` (congelada durante intercambios y cascadas), a 1× en nivel 1 y 1.6× en nivel 5, y se vuelve roja con ≤ 5 s.
- [ ] META empieza en 20; al llegar a 0 sube el nivel, suma 100 × nivel, recarga 10 s (tope 30) y META pasa a `20 + 10 × (nivel − 1)`.
- [ ] Desde nivel 5 caen gemas de un séptimo tipo (cruz violeta).
- [ ] Sin jugadas posibles el tablero se baraja en 400 ms sin coste de tiempo.
- [ ] Al vaciarse la barra se emite `onLives(0)` → `onGameOver` y se abre el modal con el puntaje correcto (también si el vaciado lo causa la penalización, tras el `reverting`).
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO y META; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela barra, animaciones y etiquetas; reanudar sin salto de tiempo y sin selección residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio, Enter) no mueve el cursor ni intercambia.
- [ ] Guardar inserta en `scores` con `game_id = 'match-3-contrarreloj'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/match-3-contrarreloj` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 30, META 20, 6 tipos, tablero nuevo sin especiales, cursor en (4, 4), sin etiquetas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/match-3-contrarreloj/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` actualizados.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** barra de supervivencia recargable (30 s máx., +250 ms por gema); es la diferencia central con la variante 01. **No:** duración fija.
- **Sí:** el tiempo solo baja en `idle`; las cascadas largas no castigan al jugador mientras no puede actuar.
- **Sí:** vaciado acelerado por nivel (+0.15× por nivel, tope 2.5×) y séptimo tipo desde nivel 5; dificultad progresiva que limita la duración de la partida.
- **Sí:** niveles por meta de gemas (`20 + 10 × (nivel − 1)`) con +10 s y bonus 100 × nivel. **No:** niveles por tiempo.
- **Sí:** tres especiales (rayo, bomba, nova) con prioridad nova > bomba > rayo y detonación en cadena. **No:** combinaciones especiales extra (rayo + bomba en cruz, etc.).
- **Sí:** penalización de 2 s por intercambio inválido; evita el intercambio a ciegas como estrategia.
- **No:** pista automática; la presión del tiempo es el reto.
- **Sí:** barajado gratuito conservando especiales (máx. 50 intentos) para no castigar la mala suerte.
- **Sí:** `initialLives: 1` y `showLevel: true`; stats `TIEMPO` y `META`.
- **Sí:** canvas 560×600 para alojar la barra sobre un tablero 9×9 de 56 px.
- **Sí:** valores de balance (30 s, 250 ms, −2 s, +10 s, metas, multiplicadores, tiempos de animación) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color yellow (ritmo de acción); **Sí:** `.cover-match-3-contrarreloj` nueva.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Detonaciones en cadena eliminan una celda o puntúan dos veces.                            | `clearing` como `Set` de `"r,c"`; BFS de especiales con visitados; puntos calculados sobre el set final del paso.                 |
| Ambigüedad al crear especiales (grupo de 5 en L, cascadas sin celda de intercambio).      | Prioridad nova > bomba > rayo y regla de celda fija (`cells[1]` o cruce); casos probados en el paso 3.                            |
| Partidas infinitas por recarga generosa con novas y cascadas.                             | Tope de 30 s, aceleración hasta 2.5× y 7 tipos desde nivel 5; verificar nivel 10+ en el paso 7 y ajustar solo editando el spec.   |
| Barajado sin solución tras 50 intentos bloquea el juego.                                  | Tras 50 intentos, tablero nuevo con `createBoard` (garantiza jugada).                                                             |
| Emitir `onStat("time")` por frame satura React.                                           | Emitir solo cuando cambia `Math.ceil(timeMs / 1000)`.                                                                             |
| `dt` grande tras pausar o cambiar de pestaña vacía la barra de golpe.                     | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                              |
| Flechas, WASD, espacio o Enter interfieren con el input del modal.                        | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                              |
| Mantener una flecha con selección dispara varios intercambios (y penalizaciones).         | El intercambio limpia `selected` y solo ocurre en `idle`; `e.repeat` solo mueve el cursor.                                        |
| Doble loop / listeners por StrictMode.                                                    | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                            |
| El id con guiones y dígito requiere comillas en `ENGINES` y nombres JS válidos.           | Clave `"match-3-contrarreloj"`; carpeta `lib/games/match-3-contrarreloj/`; símbolos `match3Contrarreloj*`; migración con `_`.     |
| Next 16 difiere del conocimiento previo.                                                  | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                                   |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse/arrastre y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Pista automática, obstáculos y combinaciones especial + especial adicionales.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
