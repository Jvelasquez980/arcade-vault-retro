# SPEC GJ-centipede-02 — Juego real: CENTIPEDE (variante: contrarreloj con combo) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-28
> **Variant:** 02 de 2 — Moderno contrarreloj: sin vidas, el reloj es el recurso; cañón en riel con ráfagas de hasta 3 disparos, multiplicador de combo por segmentos encadenados y cápsulas de power-up.
> **Objective:** Crear un motor TypeScript de Centipede (variante contrarreloj con combo) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Centipede. Convierte el clásico en un arcade de puntuación rápida: **no hay vidas**, la partida empieza con **60 s** y termina cuando el reloj llega a 0. Recibir un golpe **resta 10 s** y rompe el combo; limpiar una oleada **suma 15 s**. El cañón se mueve solo en horizontal sobre un riel y puede tener **hasta 3 disparos** en vuelo. Cada segmento destruido alimenta un **multiplicador ×1–×8** que se pierde al fallar un disparo; las cabezas pueden soltar **cápsulas** (disparo triple, fuego rápido, +5 s, bomba de hongos). Se distingue de la variante 01 (clásica: 3 vidas, un solo disparo, movimiento libre en la zona, pulga, restauración de hongos).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` reserva 6 en sus specs propuestos), dificultad 3, tags `CONTRARRELOJ` y `COMBO`, 1 jugador, teclado. Canvas **480×600**, rejilla de **24 columnas × 30 filas de 20 px**. **Sin vidas** (`initialLives` ausente), **nivel = oleada** (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Movimiento del ciempiés a saltos de celda. Sin pulga ni escorpión. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/rules.ts`: constantes (`COLS`, `ROWS`, `CELL`, `ZONE_TOP_ROW`, `RAIL_Y`) y funciones puras (`stepMs(wave)`, `chainLength(wave)`, `comboMult(streak)`, `rollPowerUp(rand)`, `nextHeadMove(seg, isBlocked)`).
- Módulo `lib/games/centipede/draw.ts`: `drawBackground`, `drawMushroom(hp)`, `drawSegment(isHead)`, `drawPlayer(blink)`, `drawShot`, `drawSpider`, `drawCapsule(kind)`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: fondo `linear-gradient(180deg,#1a0024,#0a0a18)`, `::after` con cinco círculos magenta en zigzag (ciempiés, `var(--magenta)`) y una barra amarilla horizontal arriba (reloj, `var(--yellow)`), `::before` con texto `×8` en `var(--cyan)`; `drop-shadow` magenta.
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×600**.
- HUD de React: puntaje, **nivel** (oleada), stats `time` ("TIEMPO", `int`) y `combo` ("COMBO", `int`). Sin vidas.
- Sin HUD nativo de texto en el canvas, salvo los popups efímeros de puntos y la letra de las cápsulas (efectos de juego, no overlays).
- Controles: `←`/`→` y `A`/`D` mueven el cañón; `Espacio` (o `↑`/`W`) dispara (mantener = ráfaga). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Vidas, pulga, escorpión, hongos envenenados, movimiento vertical del cañón.
- Animación interpolada entre celdas.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Contrarreloj: encadena aciertos al ciempiés.',
       'Desliza el cañón con las flechas o A/D y dispara ráfagas con Espacio. Empiezas con 60 segundos: cada golpe te quita 10 y cada oleada limpia te devuelve 15. Acierta segmentos seguidos para subir el combo hasta ×8, pero un disparo fallado lo reinicia. Atrapa las cápsulas que sueltan las cabezas: disparo triple, fuego rápido, tiempo extra o bomba de hongos.',
       'ARCADE', 'magenta', 'cover-centipede', 1, 1, '{keyboard}', '{CONTRARRELOJ,COMBO}', 3, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 480, height: 600,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "int" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `mushrooms: Map<cellKey, hp>` (`cellKey = row * 24 + col`), `segments: { col, row, dx, dy, isHead, nextId }[]`, `stepAcc`, `playerX`, `keys` (izq/der/fuego mantenidos), `shots: { x, y, vx, vy }[]`, `cooldownMs`, `triplMs`, `rapidMs`, `capsules: { x, y, kind: "triple" | "rapid" | "time" | "bomb" }[]`, `spider { x, y, vx, vy } | null`, `spiderTimer`, `popups: { text, x, y, ms }[]`, `remainingMs`, `invulnMs`, `streak`, `mult`, `wave`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("time", s)`, `onStat("combo", m)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 60)`, `onStat("combo", 1)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.ceil(remainingMs / 1000)`. `onStat("combo", m)` solo cuando cambia `mult`.
- Game over: esta variante **no declara vidas**, así que no se emite `onLives`; al agotarse el reloj se emite `onStat("time", 0)` (oculta el stat, comportamiento del contrato) y luego `onGameOver(score)`. El motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Movimiento y fuego continuos mientras se mantiene la tecla (`e.repeat` no añade nada).
- Pausa/blur/destroy limpian `keys`; al reanudar se reinicia `lastTime` y `stepAcc = 0`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 24 columnas × 30 filas de 20 px. Zona inferior: filas **25–29** (`y` 500–600). Riel del cañón en `y = 580` (fila 29).
- **Reloj:** `remainingMs` empieza en **60000**, tope **99000**. Baja con `dt` solo en juego (no en pausa ni tras game over). Al llegar a ≤ 0 → fin de partida.
- **Hongos:** al iniciar, **30** en celdas distintas al azar de las filas 2–22. Al empezar cada oleada `n ≥ 2` se añaden **6** más en celdas libres de las filas 2–22. Cada hongo tiene **3 HP**; destruido suma **2** puntos (sin multiplicador). Nunca hay hongos en la fila 29.
- **Cañón:** rect de 16×16 centrado en (`playerX`, 580); empieza en `playerX = 240`. Solo horizontal a **300 px/s**, limitado a `[10, 470]`. No le afectan los hongos.
- **Disparo:** proyectiles de 2×12 px a **960 px/s** desde (`playerX`, 568). Normal: máximo **3** en pantalla y `cooldownMs = 160` entre disparos. El avance se integra en subpasos de ≤ 10 px; colisión en orden segmento → araña → hongo; el proyectil se consume con el primer impacto.
- **Combo:** `streak` suma 1 por cada segmento o araña destruidos. `mult = min(8, 1 + Math.floor(streak / 5))`. Un proyectil que sale por `y < 0` sin impactar, o recibir un golpe, pone `streak = 0` y `mult = 1`. Impactar un hongo no suma ni resetea.
- **Puntos:** cuerpo **10 × mult**, cabeza **50 × mult**, araña **300 × mult** (se calcula con el `mult` previo al impacto). Cada impacto con puntos muestra un popup `+N` blanco de 12 px que sube 20 px en 600 ms.
- **Ciempiés por oleada:** una sola cadena de `chainLength(n) = min(10 + 2 × (n − 1), 24)` segmentos que entra con la cabeza en (col 12, fila 0), `dx = +1`, y el cuerpo en columnas 11, 10, … (las negativas no se dibujan). Paso `stepMs(n) = max(50, 110 − 6 × (n − 1))` ms por celda.
- **Movimiento:** cada cabeza intenta `col + dx`; si sale de 0–23 o hay un hongo, baja a `row + dy` e invierte `dx`. `dy` empieza en +1; si la fila destino supera 29 pasa a `dy = −1`; con `dy = −1`, si la fila destino es menor que 25 vuelve a `dy = +1`. El cuerpo ocupa la celda que dejó el segmento anterior en ese paso.
- **Impacto en segmento:** se elimina, deja un hongo de 3 HP en su celda (si está vacía y no es la fila 29) y el segmento siguiente pasa a ser cabeza heredando su último `dx` y el `dy` de la cadena.
- **Cápsulas:** al destruir una **cabeza**, con probabilidad **0.2** cae una cápsula de 14×14 desde su celda a **120 px/s**. Tipo equiprobable (0.25 c/u): `triple` (letra `T`), `rapid` (`R`), `time` (`+`), `bomb` (`B`). Se recoge al solapar el rect del cañón; si sale por `y > 600` se pierde.
  - `triple`: `tripleMs = 8000`; cada disparo lanza 3 proyectiles (vertical y ±15°); máximo **9** en pantalla.
  - `rapid`: `rapidMs = 8000`; `cooldownMs = 80` y máximo **6** en pantalla (con `triple` activo a la vez: máximo 9 y cooldown 80).
  - `time`: `remainingMs += 5000` (con tope 99000).
  - `bomb`: elimina todos los hongos de las filas 15–28 (+2 cada uno) y la araña si existe (sin puntos de araña).
  - Recoger un tipo ya activo reinicia su duración a 8000 ms.
- **Araña:** desde la oleada 2. Primera aparición a los 4000 ms de la oleada; tras salir o morir, la siguiente a los **7000** ms. Entra por izquierda o derecha (al azar), cuerpo 28×14, horizontal **120 px/s** hacia el lado opuesto y vertical **160 px/s** rebotando entre `y = 505` y `y = 585`. Elimina los hongos que toca su centro. Muere con 1 impacto.
- **Golpe al cañón:** si su rect toca un segmento (rect de celda con 3 px de margen) o la araña, y `invulnMs ≤ 0`: `remainingMs −= 10000`, combo a ×1, `invulnMs = 1500` (el cañón parpadea cada 100 ms). El segmento que golpea se elimina sin puntos ni hongo (su siguiente pasa a cabeza); la araña se retira. Si el reloj queda ≤ 0, fin de partida inmediato.
- **Fin de oleada:** sin segmentos vivos → `remainingMs += 15000` (tope 99000), +**250 × wave** puntos, `wave + 1`, `onLevel(wave)`, se añaden 6 hongos y entra la nueva cadena. Proyectiles, cápsulas y power-ups activos se conservan.
- **Dibujo:** fondo `#0a0014` con rejilla tenue `rgba(255,43,214,0.06)`. Hongos: semicírculo `#00f5ff` con tallo blanco; su alto baja con el HP (3/3, 2/3, 1/3). Segmentos: círculos de 18 px `#ff2bd6` con brillo; cabeza `#ffe600` con ojos. Cañón: triángulo `#ffffff` con base `#00f5ff`; con `triple` activo, contorno `#39ff14`; con `rapid`, contorno `#ff7a00`. Proyectiles `#ffffff`. Araña `#ff3355`. Cápsulas: cuadrado redondeado con borde del color del tipo (`T` `#39ff14`, `R` `#ff7a00`, `+` `#ffe600`, `B` `#ff3355`) y la letra centrada en 11 px monoespaciada. Riel: línea `#ff2bd6` al 40 % en `y = 590`. Últimos 10 s: el borde superior del canvas (franja de 4 px) parpadea en `#ffe600` cada 500 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila; `npm run build`.
2. Crear `lib/games/centipede/rules.ts`. Verificar: `npm run lint`; `stepMs(1) = 110`, `stepMs(11) = 50`, `chainLength(1) = 10`, `chainLength(8) = 24`, `chainLength(20) = 24`, `comboMult(0) = 1`, `comboMult(9) = 2`, `comboMult(50) = 8`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): ráfaga de 3 con cooldown, combo que sube cada 5 segmentos y se reinicia al fallar, puntos multiplicados, las 4 cápsulas (triple, rápido, +5 s, bomba), golpe que resta 10 s con parpadeo, fin de oleada (+15 s y bonus), araña desde la oleada 2, reloj a 0 → FIN, pausa (botón y `P`) congela el reloj, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas. Registrar la migración en la tabla de `references/production/prod-setup.md`.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`COMBO`, dificultad 3, color magenta, categoría ARCADE).
- [ ] `/games/centipede/jugar` muestra el canvas 480×600 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven el cañón a 300 px/s solo en horizontal; flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara cada 160 ms con máximo 3 proyectiles en pantalla.
- [ ] La partida empieza con TIEMPO 60, COMBO 1, nivel 1, 30 hongos de 3 HP y una cadena de 10 segmentos a 110 ms por celda; el HUD no muestra vidas.
- [ ] Cuerpo vale 10 × mult, cabeza 50 × mult, araña 300 × mult, hongo destruido 2; cada acierto con puntos muestra su popup.
- [ ] COMBO sube a 2 tras 5 segmentos seguidos, a 3 tras 10, …, máximo 8; un disparo que sale por arriba sin impactar o un golpe lo devuelve a 1.
- [ ] Las cápsulas caen de cabezas destruidas: `T` triple (3 proyectiles, máx. 9), `R` rápido (80 ms, máx. 6), `+` suma 5 s, `B` borra hongos de las filas 15–28; `T`/`R` duran 8 s.
- [ ] Un golpe resta 10 s, el cañón parpadea 1,5 s sin recibir más daño, y el segmento que golpea desaparece sin puntos.
- [ ] Limpiar una oleada suma 15 s (tope 99) y 250 × oleada puntos, sube el nivel, añade 6 hongos y la cadena crece 2 segmentos (tope 24) y acelera 6 ms (mínimo 50).
- [ ] Desde la oleada 2 aparece la araña (4 s y luego cada 7 s), come hongos de la zona inferior y muere de un impacto.
- [ ] TIEMPO baja 1 por segundo de juego; al llegar a 0 se emite `onGameOver` y se abre el modal con el puntaje correcto (sin `onLives`).
- [ ] El HUD de React refleja puntaje, nivel, TIEMPO y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela reloj, ciempiés, araña, cápsulas, proyectiles, power-ups e invulnerabilidad; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, TIEMPO 60, COMBO 1, nivel 1, 30 hongos nuevos, sin cápsulas, power-ups ni araña).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** reloj como único recurso (60 s, −10 por golpe, +15 por oleada, tope 99); **No:** vidas ni `initialLives` (el HUD no muestra corazones). Es la diferencia central con la variante 01.
- **Sí:** cañón en riel horizontal y hasta 3 disparos; el reto pasa de esquivar a apuntar con ritmo.
- **Sí:** combo ×1–×8 que se rompe al fallar; premia la precisión y amplía el rango del leaderboard.
- **Sí:** 4 cápsulas con duración y probabilidades fijas; **No:** más tipos ni tienda.
- **Sí:** araña desde la oleada 2; **No:** pulga ni escorpión (alcance de un motor).
- **Sí:** cadena que crece y acelera por oleada y 6 hongos extra por oleada como curva de dificultad.
- **Sí:** stat `TIEMPO` con formato `int` (segundos restantes enteros) y `COMBO`; valor 0 de TIEMPO al final oculta el stat, aceptado.
- **Sí:** valores de balance (tiempos, velocidades, puntos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta (estética neón de puntuación); **Sí:** `.cover-centipede` nueva.
- **Sí:** `sort_order` 7 para no chocar con `missile-command` (6, propuesto).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Sin `onLives`, `GamePlayer` no recibe la secuencia `onLives(0)` → `onGameOver` habitual. | El contrato no exige vidas: `initialLives` es opcional y `GamePlayer` solo muestra vidas si el def lo declara; se emite solo `onGameOver`. Verificar el modal en el paso 6. |
| Con `triple` + `rapid` hay hasta 9 proyectiles y muchas colisiones por frame. | Subpasos de ≤ 10 px y búsqueda de hongo por `Map` de celda (O(1)); segmentos ≤ 24. |
| Partidas infinitas si el +15 s por oleada supera el coste del tiempo. | Tope de 99 s, cadena de hasta 24 segmentos y paso mínimo 50 ms; verificar oleada 8+ y ajustar solo editando el spec. |
| Emitir `onStat("time")` por frame satura React. | Emitir solo cuando cambia `Math.ceil(remainingMs / 1000)`. |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o da pasos múltiples. | `lastTime` y `stepAcc` se reinician al reanudar y tras blur; `dt` capado a 50 ms; el reloj solo baja en juego. |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Movimiento o fuego "pegado" tras perder foco. | `blur` y `pause` limpian `keys`. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| Canvas vertical 480×600 queda bajo en escritorio o desborda en móvil. | `GamePlayer` fija `--game-ar`; verificar 375 px y 1280 px en el paso 6. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas, pulga, escorpión, hongos envenenados y movimiento vertical del cañón.
- Animación interpolada entre celdas.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
