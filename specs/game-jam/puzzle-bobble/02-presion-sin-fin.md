# SPEC GJ-puzzle-bobble-02 — Juego real: PUZZLE BOBBLE (variante: presión sin fin) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-10
> **Variant:** 02 de 2 — Modo sin fin con presión por tiempo: entran filas nuevas por arriba con temporizador que se acelera, 1 vida, multiplicador de combo, burbujas bomba y arcoíris, e intercambio de burbuja.
> **Objective:** Crear un motor TypeScript de Puzzle Bobble en modo sin fin dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/puzzle-bobble` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Puzzle Bobble. Toma la mecánica central (cañón, burbujas de colores, 3+ iguales revientan, las sueltas caen) y la convierte en un **modo de supervivencia sin fin**: no hay niveles que vaciar; **cada pocos segundos entra una fila nueva por arriba** y empuja todo hacia la línea límite. El temporizador se acelera con el **nivel de presión** (sube cada 45 s). Se premia el ritmo con un **multiplicador de combo** (disparos seguidos que revientan), hay **burbujas especiales** (bomba y arcoíris) en posiciones fijas de la secuencia, se puede **intercambiar** la burbuja actual con la siguiente y **adelantar** una fila a cambio de puntos. **1 vida**: cruzar la línea es game over. Se distingue de la variante 01 (tableros fijos por nivel, techo cada 8 disparos, 3 vidas, bonus exponencial por caída): aquí el reto es **velocidad de decisión y gestión del riesgo**.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con círculos, arcos, gradientes radiales y líneas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-puzzle-bobble`.

Decisiones fijadas por el agente (no se reabren): `id` `puzzle-bobble`, título `PUZZLE BOBBLE`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` ya reserva 6 en sus specs propuestos), dificultad 4, tags `BURBUJAS` y `SIN FIN`, 1 jugador, teclado. Canvas **480×640** (3:4). Rejilla hexagonal de **10 columnas** (filas cortas de 9, desplazadas medio diámetro) con burbujas de **40 px**. **1 vida** (`initialLives: 1`), **nivel = presión** (`showLevel: true`), stats extra `COMBO` y `TIEMPO`. Secuencias de filas y de disparos con PRNG de semilla fija (todas las partidas reciben la misma secuencia). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/puzzle-bobble/engine.ts`: sin globals de módulo; exporta `puzzleBobbleDef: GameEngineDef` con `createPuzzleBobble(canvas, events) → GameController`.
- Módulo `lib/games/puzzle-bobble/grid.ts`: funciones puras de la rejilla hexagonal con paridad variable (`rowLength(row, parity)`, `cellCenter(row, col, parity)`, `neighbors(row, col, parity)`, `snapCell(...)`, `findCluster`, `findFloating`, `cellsInRadius(x, y, r)`, `insertRow(grid, parity, colors, rng) → parity`), sin estado de módulo.
- Módulo `lib/games/puzzle-bobble/pressure.ts`: PRNG `mulberry32(seed)` y funciones puras de balance (`pressureConfig(level) → { rowMs, colors }`, `specialFor(shotIndex) → "bomb" | "rainbow" | null`).
- Módulo `lib/games/puzzle-bobble/draw.ts`: `drawBackground`, `drawWalls`, `drawDeadline`, `drawBubble`, `drawBomb`, `drawRainbow`, `drawCannon`, `drawAimGuide`, `drawQueue`, `drawRowTimer` (barra fina bajo el techo). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"puzzle-bobble"` en `lib/games/registry.ts`.
- Clase `.cover-puzzle-bobble` en `app/globals.css`: fondo `linear-gradient(180deg, #2a0030, #0a0a18)`; `::after` con varias filas de círculos `radial-gradient` (magenta, cyan, amarillo, verde) que llenan la mitad superior y `::before` con una burbuja negra con anillo amarillo (bomba) abajo al centro.
- Migración `add_game_puzzle_bobble`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **1 vida**, **nivel** (presión), stats extra `combo` ("COMBO", `int`, multiplicador actual) y `time` ("TIEMPO", `int`, segundos sobrevividos).
- Sin HUD nativo de texto en el canvas; la cola (actual y siguiente) y la barra de tiempo hasta la próxima fila se dibujan como parte del escenario.
- Controles: `←`/`→` o `A`/`D` giran el cañón; `Espacio`, `↑` o `W` disparan; `X` o `Shift` intercambian actual y siguiente; `↓` o `S` adelantan la próxima fila. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'puzzle-bobble'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `puzzle-bobble`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Niveles con tablero fijo, techo que baja por disparos, vidas múltiples (son de la variante 01).
- Otras burbujas especiales (metal, estrella, hielo), modo versus con envío de basura.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('puzzle-bobble', 'PUZZLE BOBBLE', 'Revienta burbujas antes de que te aplasten.',
       'Gira el cañón con las flechas o A/D y dispara con Espacio. Une tres o más burbujas del mismo color; las que queden sueltas caen. Cada pocos segundos entra una fila nueva por arriba y el ritmo se acelera: encadena disparos que revientan para subir el combo hasta x5, usa bombas y burbujas arcoíris, intercambia la siguiente con X y adelanta filas con ↓ para ganar puntos. Si una burbuja cruza la línea, se acaba.',
       'ARCADE', 'magenta', 'cover-puzzle-bobble', 1, 1, '{keyboard}', '{BURBUJAS,SIN FIN}', 4, 7, false);

Definición del motor:

    export const puzzleBobbleDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
        { key: "time", label: "TIEMPO", color: "cyan", format: "int" },
      ],
      create: createPuzzleBobble,
    };

Estado interno (dentro de `createPuzzleBobble`): `grid: (Cell | null)[][]` (hasta 15 filas; `Cell = { color: 0–5 }`), `parity` (0/1; fila `r` es larga, 10 celdas, si `(r + parity) % 2 === 0`, si no corta, 9 celdas), `angle`, `keysDown: Set<string>`, `current` y `next` (`{ kind: "color" | "bomb" | "rainbow", color }`), `shotIndex` (disparos generados), `shot { x, y, vx, vy, ball } | null`, `popping`, `falling`, `combo`, `level`, `playMs`, `rowTimer`, `score`, `rngRows`, `rngShots`, `lastSecond`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("combo", n | null)`, `onStat("time", s)` (una vez por segundo entero). Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("combo", null)`, `onStat("time", 0)`.
- `COMBO` se oculta (`null`) cuando el multiplicador es 1 y se muestra de 2 a 5; `TIEMPO` queda oculto en el segundo 0 (contrato de `onStat`) y aparece desde 1.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Disparo, intercambio y adelantar fila ignoran `e.repeat` (una acción por pulsación); el giro usa `keysDown`.
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Pausa congela `playMs` y `rowTimer`.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Geometría:** diámetro `D = 40`, radio `R = 20`, alto de fila `ROW_H = 35`. Campo `x ∈ [40, 440]` (400 px = 10 × D), paredes de 40 px. Techo fijo en `y = 24`. Centro de celda: `x = 40 + R + col × D + (fila corta ? R : 0)`, `y = 24 + R + row × ROW_H`. Línea límite en `y = 528` (la fila 13 cabe; una burbuja en la fila 14 la cruza). Cañón con pivote en (240, 592); siguiente en (160, 612) a radio 15. Barra de tiempo de fila: 400×4 px en `y = 18`, se llena de 0 a 100 % según `rowTimer / rowMs`.
- **Cañón:** `angle` en grados desde la horizontal derecha; empieza en 90. Gira a **140 °/s** con `←`/`A` (aumenta) y `→`/`D` (disminuye), limitado a `[8, 172]`. Guía: 8 puntos de 3 px separados 18 px desde la boca (sin predecir rebotes).
- **Disparo:** solo si `shot = null`. Sale del pivote a **1100 px/s**; `current = next`, `next` = siguiente de la secuencia. Sin disparo automático (la presión la pone el temporizador de filas).
- **Intercambio (`X`/`Shift`):** con `shot = null` intercambia `current` y `next`; sin coste ni límite.
- **Vuelo:** subpasos de máximo **10 px**; rebota en `x = 40 + R` y `x = 440 − R`; se pega si `y − R ≤ 24` o si la distancia a una burbuja de la rejilla es `< 32` (0.8 × D). Pegado con `snapCell` igual que el clásico (fila por `round`, columna más cercana, fallback a la vecina vacía de la burbuja golpeada), usando `parity`.
- **Presión (`pressureConfig(level)`):** `level` empieza en 1 y sube **1 cada 45 s** de `playMs` (`onLevel`). `rowMs = max(3500, 9000 − 700 × (level − 1))` (nivel 1 → 9000, 2 → 8300, …, 9+ → 3500). Colores activos: niveles 1–2 → **4**, 3–4 → **5**, 5+ → **6** (en orden de paleta).
- **Fila nueva:** cuando `rowTimer ≥ rowMs` se llama a `insertRow`: `parity ^= 1`, se inserta arriba una fila llena con la longitud que le toca; cada celda toma, con probabilidad **0.5**, el color de su vecina izquierda y si no uno aleatorio entre los activos (`rngRows`). Todas las burbujas de la rejilla bajan 35 px; la burbuja en vuelo no se desplaza y la inserción se aplica después de resolver el disparo de ese frame. `rowTimer = 0`, **+50** puntos. Durante los últimos **1000 ms** antes de insertar, la rejilla tiembla ±2 px en x.
- **Adelantar fila (`↓`/`S`):** inserta la fila de inmediato con las mismas reglas, `rowTimer = 0`, **+100** puntos (en lugar de +50). Solo con `shot = null`.
- **Inicio:** 5 filas llenas generadas con `insertRow` sucesivas desde rejilla vacía (sin sumar puntos), 4 colores. `rngRows = mulberry32(0xB0BB1E)`, `rngShots = mulberry32(0xB0BB1F)`; se reinician en "JUGAR DE NUEVO".
- **Secuencia de disparos:** `shotIndex` cuenta burbujas generadas (empieza en 1 para `current`). `specialFor(i)`: múltiplo de **12** → bomba; si no, múltiplo de **20** → arcoíris; si no, color normal elegido con `rngShots` entre los colores **presentes en la rejilla** (si está vacía, entre los activos). Las especiales no se re-sortean; los colores normales de `current`/`next` se re-sortean si su color desaparece de la rejilla.
- **Reventar:** tras pegar una burbuja normal, `findCluster`; con **≥ 3** se eliminan (`popping`, 150 ms). Luego `findFloating` desde la fila 0: las sueltas pasan a `falling` (gravedad **1800 px/s²**, se eliminan en `y > 680`).
- **Bomba:** al pegarse explota y elimina toda burbuja con centro a distancia **≤ 80 px** (2 × D) del punto de pegado (incluida la propia); después `findFloating`. Cuenta como disparo que revienta.
- **Arcoíris:** al pegarse adopta el color de la primera burbuja que tocó (si tocó el techo, un color activo de `rngShots`) y sigue la regla normal de grupo ≥ 3.
- **Combo:** `combo` empieza en 1. Un disparo que revienta (grupo ≥ 3 o bomba) puntúa con el `combo` actual y luego `combo = min(combo + 1, 5)`; un disparo que no revienta pone `combo = 1`. `onStat("combo", combo ≥ 2 ? combo : null)` al cambiar.
- **Puntuación** (× `combo` vigente al resolver el disparo, salvo filas y limpieza):
  - Burbuja reventada por grupo: **10** cada una.
  - Burbuja eliminada por bomba: **15** cada una.
  - Burbuja caída: **30** cada una (lineal).
  - Fila insertada por tiempo: **+50**; fila adelantada: **+100**.
  - Tablero limpio (rejilla vacía tras resolver un disparo): **+2000** e inserción inmediata de **3** filas (sin sumar sus +50).
- **Game over:** tras pegar un disparo o tras insertar una fila, si alguna burbuja está en la fila `≥ 14` (su borde inferior pasa de `y = 528`) → las burbujas se dibujan en gris `#555`, `onLives(0)` y `onGameOver(score)`.
- **Tiempo:** `playMs` acumula solo en juego activo sin pausa; `onStat("time", floor(playMs / 1000))` cuando cambia el segundo entero.
- **Paleta (`PALETTE`):** fondo `#0a0a18` con degradado a `#1a0024` arriba; paredes `#1a1a3a` con borde `#ff2bd6`; techo `#2a2a4a`; barra de tiempo `#ff2bd6` (en `#ff3355` durante el temblor); línea límite discontinua `#ff3355`. Burbujas 0–5: rojo `#ff3355`, azul `#2b7bff`, amarillo `#ffe600`, verde `#39ff14`, magenta `#ff2bd6`, cyan `#00f5ff`, con gradiente radial blanco (brillo en −R/3, −R/3) → color → color al 60 % de luminosidad. Bomba: círculo `#111` con anillo `#ffe600` de 3 px y chispa blanca arriba. Arcoíris: 6 sectores de arco con los 6 colores y brillo blanco. Cañón: base `#2a2a4a`, tubo `#ff2bd6` de 12×48 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-puzzle-bobble` en `app/globals.css`. Aplicar migración `add_game_puzzle_bobble` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'puzzle-bobble'` muestra la fila; `npm run build`.
2. Crear `lib/games/puzzle-bobble/grid.ts`. Verificar: `npm run lint`; con `parity` 0 y 1, `rowLength` alterna 10/9 y `neighbors` devuelve los 6 vecinos correctos; `insertRow` invierte `parity` y desplaza las filas.
3. Crear `lib/games/puzzle-bobble/pressure.ts`. Verificar: `npm run lint`; `pressureConfig(1)` → 9000 ms y 4 colores, `pressureConfig(9)` → 3500 ms y 6 colores; `specialFor(12)` bomba, `specialFor(20)` arcoíris, `specialFor(60)` bomba, `specialFor(7)` null.
4. Crear `lib/games/puzzle-bobble/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/puzzle-bobble/engine.ts` y exportar `puzzleBobbleDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"puzzle-bobble"` en `lib/games/registry.ts`. Verificar: `/games/puzzle-bobble/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): girar el cañón, rebotar en pared, reventar grupos seguidos (COMBO 2 → 5 y vuelta a oculto al fallar), intercambiar con `X`, adelantar fila con `↓` (+100), esperar una fila por tiempo (+50, temblor previo), usar bomba (disparo 12) y arcoíris (disparo 20), subir a nivel 2 a los 45 s (ritmo 8300 ms), cruzar la línea límite, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO" (misma secuencia inicial), consola limpia.
8. `update games set published = true where id = 'puzzle-bobble'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `puzzle-bobble` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-puzzle-bobble`), la ficha `/games/puzzle-bobble` y el home muestran el juego desde la BD (1 jugador, teclado, tags `BURBUJAS`/`SIN FIN`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/puzzle-bobble/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` giran el cañón a 140 °/s entre 8° y 172°; flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`, `↑` o `W` disparan a 1100 px/s; mantener la tecla no repite; no hay disparo automático.
- [ ] La partida empieza con 5 filas llenas (10/9 alternas) de 4 colores; "JUGAR DE NUEVO" reproduce exactamente el mismo tablero y la misma secuencia de burbujas.
- [ ] Un grupo de 3+ revienta sumando 10 × combo por burbuja; las sueltas caen sumando 30 × combo cada una.
- [ ] COMBO aparece en 2 tras el primer reventón, sube hasta 5 como máximo y se oculta al fallar un disparo.
- [ ] `X`/`Shift` intercambian la burbuja actual y la siguiente solo sin disparo en vuelo.
- [ ] Cada 9000 ms (nivel 1) entra una fila por arriba (+50), con temblor en el último segundo y la barra de tiempo llena; `↓`/`S` la adelantan (+100) y reinician la barra.
- [ ] El nivel del HUD sube cada 45 s; en nivel 2 la fila entra cada 8300 ms; desde nivel 3 hay 5 colores y desde nivel 5, 6; nunca baja de 3500 ms.
- [ ] El disparo 12 (y múltiplos) es una bomba que elimina las burbujas a ≤ 80 px (15 × combo cada una); el disparo 20 (no múltiplo de 12) es arcoíris y adopta el color de la burbuja que toca.
- [ ] Vaciar la rejilla suma 2000 e inserta 3 filas de inmediato.
- [ ] Una burbuja en la fila 14 (cruza y = 528) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, COMBO y TIEMPO (segundos enteros); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela disparo, caídas, temporizador de filas y TIEMPO; reanudar sin salto ni fila inmediata.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, `S`, `X`, espacio) no gira, dispara, intercambia ni adelanta filas.
- [ ] Guardar inserta en `scores` con `game_id = 'puzzle-bobble'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/puzzle-bobble` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vida 1, nivel 1, COMBO oculto, TIEMPO 0, barra vacía, cañón a 90°).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/puzzle-bobble/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (el loop arranca en `create`).
- **Sí:** modo sin fin con filas por tiempo y 1 vida; **No:** niveles con tablero fijo ni techo por disparos (variante 01).
- **Sí:** PRNG con semilla fija para filas y disparos (misma partida para todos, leaderboard justo); **No:** `Math.random`.
- **Sí:** nivel = presión (cada 45 s) mostrado en el HUD; acelera el ritmo hasta un mínimo de 3500 ms.
- **Sí:** combo hasta x5 y caída lineal (30 por burbuja); **No:** bonus exponencial (con combo se desbordaría).
- **Sí:** especiales en posiciones fijas de la secuencia (12 bomba, 20 arcoíris) para que sean predecibles; **No:** especiales aleatorias.
- **Sí:** intercambio libre y adelantar fila con recompensa: dan decisiones de riesgo sin añadir vidas.
- **Sí:** stats `COMBO` (oculto en x1) y `TIEMPO` en segundos enteros (un evento por segundo).
- **No:** disparo automático (el temporizador de filas ya fuerza el ritmo).
- **Sí:** `cat` ARCADE y color magenta (acción contrarreloj; distingue de Tetris en PUZZLE); `.cover-puzzle-bobble` nueva.
- **Sí:** canvas 480×640 con rejilla de 10 columnas y burbujas de 40 px (más burbujas en pantalla que la 01).
- **Sí:** valores de balance fijados en este spec, ajustables solo editándolo.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                           |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Insertar filas invierte la paridad y descoloca vecinos o el pegado.                     | Toda la geometría pasa por `grid.ts` con `parity` explícita; verificar vecinos con ambas paridades en el paso 2.     |
| Una fila entra mientras la burbuja está pegándose y la deja en celda inválida.          | Resolver primero el disparo del frame y luego aplicar la inserción; `snapCell` siempre usa la `parity` vigente.      |
| Efecto túnel entre burbujas a 1100 px/s.                                                | Subpasos de máximo 10 px (R/2) y umbral 0.8 × D.                                                                     |
| Re-sorteo de colores rompe el determinismo de la secuencia.                             | `rngShots` se usa siempre en el mismo orden (generar y re-sortear consumen del mismo stream); las especiales no consumen. |
| Emitir `onStat("time")` o `onScore` por frame satura React.                             | `time` solo al cambiar el segundo entero; resto en disparo, inserción y cambio de nivel.                             |
| `dt` grande tras pausar o cambiar de pestaña dispara varias filas de golpe.             | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; como mucho una inserción por frame.             |
| `Shift`/`X`/`S` interfieren con el input del modal.                                     | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                 |
| Tecla de giro "pegada" tras perder foco.                                                | `blur` y `pause` vacían `keysDown`.                                                                                  |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                               |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                      | Clave `"puzzle-bobble"` entre comillas; carpeta `lib/games/puzzle-bobble/`; migración `add_game_puzzle_bobble`.      |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                      |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Niveles con tablero fijo, techo por disparos y vidas múltiples.
- Otras burbujas especiales y modo versus con basura.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
