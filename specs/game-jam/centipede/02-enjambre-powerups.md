# SPEC GJ-centipede-02 — Juego real: CENTIPEDE (variante: enjambre con power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-27
> **Variant:** 02 de 2 — Centipede moderno: cañón en un riel horizontal con ráfagas múltiples, ciempiés que llegan sin pausa y suben de nivel por tiempo, vidas que se pierden cuando un ciempiés escapa, avispas, cápsulas de power-up y multiplicador por combo.
> **Objective:** Crear un motor TypeScript de Centipede dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Centipede. Reinterpreta el arcade como **defensa de un jardín**: el cañón solo se mueve en horizontal por la fila inferior y dispara **ráfagas** (varias balas a la vez); los ciempiés no llegan por oleadas sino en un **enjambre continuo** (uno nuevo cada pocos segundos) y el **nivel sube cada 30 s**, acelerando todo. El peligro principal no es el contacto: cada ciempiés que llega a la **cerca** (3 filas sobre el riel) y sale por un lateral **escapa y cuesta una vida**; además, las **avispas** caen en picado contra el cañón. Matar en cadena sube un **multiplicador de combo** y las cabezas sueltan **cápsulas** (triple, ráfaga, bomba, escudo). Se distingue de la variante 01 (movimiento libre en 6 filas, un solo disparo, oleadas, pulga/araña/escorpión, hongos envenenados): aquí el reto es **priorizar objetivos y mantener el combo** bajo presión creciente.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con círculos, rectángulos y líneas (la letra de cada cápsula con `fillText`). No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` tiene reservado el 6 en sus specs de game jam), dificultad 3, tags `ENJAMBRE` y `POWER-UPS`, 1 jugador, teclado. Canvas **600×600**, rejilla de **25×25 celdas de 24 px**. **3 escudos = 3 vidas** (`initialLives: 3`, máximo 5), **nivel por tiempo** (`showLevel: true`), stat extra `COMBO` (multiplicador). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/rules.ts`: funciones puras y constantes (`COLS = 25`, `ROWS = 25`, `CELL = 24`, `FIELD_LAST = 20`, `FENCE_ROW = 23`, `levelConfig(L) → { chainLen, stepMs, spawnMs, waspMs }`, `multFor(combo)`, `stepHead(head, mushrooms)`).
- Módulo `lib/games/centipede/draw.ts`: `drawMushroom`, `drawFence`, `drawSegment`, `drawCannon`, `drawBullet`, `drawWasp`, `drawCapsule` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: fondo `linear-gradient(180deg,#14051a,#0a0a18)`, `::after` con una fila de 7 círculos magenta `#ff2bd6` (cabeza `#ffe600`) en curva (cadena de `radial-gradient`) y `::before` con una franja inferior `#ff3355` translúcida (cerca) y un cañón cyan.
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **600×600** (1:1).
- HUD de React: puntaje, **3 vidas** (escudos), **nivel** y stat extra `mult` ("COMBO", `int`, multiplicador; oculto cuando es ×1).
- Sin HUD nativo de texto en el canvas ni overlays (la barra del power-up activo es parte del cañón, no texto).
- Controles: `←`/`→` y `A`/`D` mueven el cañón; `Espacio` dispara (mantener = ráfaga con cadencia). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Pulga, araña, escorpión y hongos envenenados (son de la variante 01).
- Tienda/mejoras persistentes entre partidas, selector de dificultad.
- Animación interpolada de los segmentos entre celdas.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Frena al enjambre antes de que escape.',
       'Mueve el cañón con las flechas o A/D y mantén Espacio para disparar ráfagas. Los ciempiés llegan sin parar entre hongos y cada 30 segundos son más largos y rápidos: si uno alcanza la cerca y escapa por un lado, pierdes un escudo. Encadena bajas para subir el combo, esquiva las avispas y recoge cápsulas de triple disparo, ráfaga, bomba y escudo.',
       'SHOOTER', 'magenta', 'cover-centipede', 1, 1, '{keyboard}', '{ENJAMBRE,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "mult", label: "COMBO", color: "yellow", format: "int" }],
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `cannonX`, `keysDown: Set<string>`, `fireHeld`, `fireCd`, `bullets: { x, y, vx }[]`, `mushrooms: Map<number, number>` (clave `row * 25 + col` → PV 1..3), `regrowTimer`, `chains: { segs: { c, r }[], dir: 1 | -1 }[]` (cabeza en índice 0; segmentos con `r = −1` en cola fuera de pantalla), `stepAcc`, `spawnTimer`, `wasps: { x, y }[]`, `waspTimer`, `capsules: { x, y, type: "T" | "R" | "B" | "E" }[]`, `power: { type: "T" | "R", ms } | null`, `combo`, `mult`, `comboMs`, `invulnMs`, `level`, `levelMs`, `lives`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("mult", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("mult", null)`.
- `onStat("mult", null)` oculta el stat cuando el multiplicador es ×1 (contrato de `onStat`); con ×2–×5 se emite el número.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El movimiento usa `keysDown` y el disparo `fireHeld` (cadencia propia, no depende de `e.repeat`).
- Pausa/blur/destroy vacían `keysDown` y `fireHeld`; al reanudar se reinicia `lastTime` y `stepAcc = 0`; `dt` capado a **50 ms**. Los temporizadores (`levelMs`, `spawnTimer`, `comboMs`, `power.ms`, `invulnMs`) solo avanzan sin pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, subida de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 25×25 celdas de 24 px; fila 0 arriba. **Campo de hongos:** filas 1–20. **Cerca:** filas 21–23 (nunca tienen hongos; fondo tintado). **Riel del cañón:** fila 24.
- **Hongos:** 35 iniciales en celdas aleatorias distintas de las filas 1–20. **3 PV**; cada impacto resta 1 (se dibuja más bajo). Destruirlo: **1** punto (sin multiplicador). **Rebrote:** cada **5000 ms** aparece un hongo de 3 PV en una celda libre aleatoria de las filas 1–20 si hay menos de **80**.
- **Cañón:** rectángulo de 30×18 px centrado en `y = 588`; empieza en `x = 300`. Se mueve a **320 px/s** con `←`/`→` o `A`/`D`, limitado a `x ∈ [15, 585]`. `↑`/`↓`/`W`/`S` no hacen nada.
- **Disparo:** con `Espacio` mantenido se dispara cada **160 ms** (`fireCd`); bala de 3×12 px a **720 px/s** hacia arriba desde `y = 576`, avanzada en sub-pasos de ≤ 8 px. Máximo **12** balas en vuelo (las sobrantes no se disparan). Cada bala impacta lo primero que toca (segmento, avispa u hongo) y desaparece.
- **Nivel `L`** (`levelConfig`; empieza en 1 y sube cada **30000 ms** de juego, `onLevel(L)`):
  - Largo de cada ciempiés: `min(7 + L, 16)` segmentos.
  - Paso: `stepMs = max(55, 120 − 7 × (L − 1))` ms por celda (nivel 1: 120; desde el 11: 55). Se aplica a todas las cadenas, también a las ya en pantalla.
  - Llegada: un ciempiés nuevo cada `spawnMs = max(5000, 12000 − 800 × (L − 1))` ms; el primero al empezar la partida. Si no queda ninguna cadena en pantalla, `spawnTimer = min(spawnTimer, 1500)`.
  - Avispas: desde `L ≥ 2`, una cada `waspMs = max(3500, 8000 − 500 × (L − 2))` ms.
- **Entrada:** cada ciempiés entra en la fila 0 por una columna aleatoria 2–22 con `dir` aleatorio y todos sus segmentos en cola en `r = −1` (entran uno por paso siguiendo la estela). Las celdas con `r = −1` no se dibujan ni colisionan.
- **Paso del ciempiés** (cada `stepMs`, todas las cadenas a la vez): cada segmento del cuerpo ocupa la posición anterior del de delante; la cabeza intenta `(c + dir, r)`:
  - En filas 0–22: si está fuera del tablero o hay un hongo → baja a `(c, r + 1)` y `dir = −dir` (la bajada ignora hongos).
  - En la fila 23 (última de la cerca): no baja más; si `(c + dir)` está fuera del tablero, la cadena **escapa**.
  - Los segmentos no colisionan entre sí ni con el cañón (nunca entran en la fila 24).
- **Escape:** la cadena entera desaparece sin puntos, `lives − 1`, `onLives(lives)`, combo a 0 (`onStat("mult", null)` si cambia). Si `lives = 0` → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Abatir un segmento:** se elimina; si estaba en las filas 1–20 deja un hongo de 3 PV en su celda (si está libre); en la cerca no deja nada. La cadena se parte: `segs[0..i−1]` conserva cabeza y `dir`; `segs[i+1..]` forma una cadena nueva cuya cabeza es `segs[i+1]`, con `dir = sign(segs[i].c − segs[i+1].c)` (si es 0, el `dir` original). Puntos: cabeza **50 × mult**, cuerpo **10 × mult**.
- **Avispa:** aparece en `y = −12` con `x` = posición del cañón en ese instante, cae en vertical a **280 px/s**, hitbox 18×18; atraviesa hongos sin dañarlos. Un impacto la mata: **150 × mult**. Si toca el cañón sin invulnerabilidad: `lives − 1`, `onLives(lives)`, combo a 0, **1500 ms** de invulnerabilidad (el cañón parpadea; las avispas lo atraviesan) y la avispa desaparece; con `lives = 0` → game over (mismo orden). Sale por abajo sin efecto.
- **Combo:** cada baja (segmento o avispa) hace `combo + 1` si ocurre ≤ **1500 ms** después de la anterior, si no `combo = 1`; `comboMs` se reinicia a 1500 en cada baja y al llegar a 0 pone `combo = 0`. `mult = min(1 + Math.floor(combo / 6), 5)` (bajas 1–5 ×1, 6–11 ×2, 12–17 ×3, 18–23 ×4, 24+ ×5). El multiplicador se calcula **después** de sumar la baja actual. `onStat("mult", mult > 1 ? mult : null)` solo cuando `mult` cambia.
- **Cápsulas:** al abatir una **cabeza**, probabilidad **0,12** de soltar una cápsula (16×16) en su centro, con tipo uniforme entre `T`, `R`, `B`, `E`. Cae a **140 px/s**; se recoge al solapar el cañón (**+25** puntos, sin multiplicador); se pierde al salir por abajo. Las balas no la afectan.
  - `T` **Triple** (10000 ms): cada disparo lanza 3 balas con `vx` −180, 0, +180 px/s (cuentan para el máximo de 12).
  - `R` **Ráfaga** (8000 ms): cadencia de **70 ms**.
  - `B` **Bomba** (instantánea): elimina todos los segmentos en las filas 15–23 y todas las avispas en pantalla, puntuando cada baja normalmente (suman combo); los segmentos eliminados no dejan hongos; destruye sin puntos los hongos de las filas 15–20. Las cadenas se parten como si cada segmento se hubiera abatido.
  - `E` **Escudo**: `lives + 1` (máximo **5**), `onLives(lives)`; con 5 solo da los 25 puntos.
  - Solo un power-up temporal activo: recoger `T` o `R` sustituye al actual y reinicia su duración.
- **Dibujo:** fondo `#07040d`; cerca (filas 21–23) con relleno `#ff3355` al 10 % de opacidad y línea superior `#ff3355`. Hongos: sombrero `#ff2bd6` y tallo `#ffe600`. Segmentos: círculo de radio 10, cuerpo `#ff2bd6`, cabeza `#ffe600` con ojos `#000`. Cañón `#00f5ff` con cañoncito central; con power-up activo, barra de 30×3 px bajo el cañón proporcional al tiempo restante (`#39ff14` para `T`, `#ffe600` para `R`). Balas `#ffffff`. Avispa `#ffe600` con franjas `#000` y alas `#ffffff` translúcidas. Cápsulas: cuadrado redondeado con borde `#ffffff`, relleno `T #39ff14`, `R #ffe600`, `B #ff3355`, `E #00f5ff` y su letra en negro (`bold 12px monospace`).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/centipede/rules.ts`. Verificar: `npm run lint`; `levelConfig(1)` = `{ chainLen: 8, stepMs: 120, spawnMs: 12000, waspMs: 8000 }`, `levelConfig(10)` = `{ 16, 57, 5000, 4000 }`; `multFor(5) = 1`, `multFor(6) = 2`, `multFor(30) = 5`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover el cañón, ráfaga con `Espacio`, partir ciempiés (hongo en campo, nada en la cerca), dejar escapar uno (vida −1), subir combo a ×2 (stat visible) y perderlo, subir a nivel 2 a los 30 s (avispas), ser golpeado por una avispa (invulnerabilidad 1500 ms), recoger las 4 cápsulas (forzar probabilidad 1 temporalmente y revertir), perder los 3 escudos, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'` (registrar en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; ambas migraciones constan en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `ENJAMBRE`/`POWER-UPS`, dificultad 3, color magenta, categoría SHOOTER).
- [ ] `/games/centipede/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con 35 hongos en las filas 1–20, cañón en `x = 300` y un ciempiés de 8 segmentos entrando por arriba a 120 ms por celda.
- [ ] `←`/`→` y `A`/`D` mueven el cañón a 320 px/s solo en horizontal; flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara cada 160 ms (70 ms con Ráfaga) con varias balas en vuelo y nunca más de 12.
- [ ] Un hongo desaparece al 3.er impacto (+1 punto); cada 5000 ms rebrota uno en las filas 1–20 (hasta 80).
- [ ] Abatir una cabeza suma 50 × mult y un cuerpo 10 × mult; en el campo deja hongo, en la cerca no; la cadena se parte en dos.
- [ ] Un ciempiés que llega a la fila 23 y sale por un lateral desaparece y resta una vida en el HUD.
- [ ] Cada 30 s sube el nivel del HUD; en el nivel 2 los ciempiés tienen 9 segmentos, van a 113 ms por celda, llegan cada 11200 ms y aparecen avispas cada 8000 ms.
- [ ] La avispa cae hacia la posición del cañón, da 150 × mult y, si toca el cañón, resta una vida y da 1500 ms de invulnerabilidad.
- [ ] El combo sube con bajas separadas ≤ 1500 ms; COMBO aparece en el HUD al llegar a ×2 (6.ª baja), tope ×5, y se oculta al expirar el combo o al perder una vida.
- [ ] Las cápsulas (12 % por cabeza) dan +25; `T` dispara 3 balas en abanico 10 s, `R` sube la cadencia 8 s, `B` limpia segmentos de las filas 15–23 y avispas puntuando, `E` suma una vida hasta 5.
- [ ] Perder la última vida (por escape o avispa) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas, nivel y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela ciempiés, avispas, cápsulas, balas y todos los temporizadores (nivel, llegada, combo, power-up); reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, A/D, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, COMBO oculto, 35 hongos nuevos, sin avispas, cápsulas ni power-up).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites, imágenes ni audio (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** cañón en riel horizontal y ráfagas múltiples; **No:** movimiento libre ni disparo único (es la variante 01).
- **Sí:** vidas perdidas por escape a través de la cerca y por avispas; **No:** muerte por contacto con el ciempiés (nunca entra en el riel).
- **Sí:** enjambre continuo con nivel cada 30 s (`showLevel: true`); **No:** oleadas que hay que vaciar.
- **Sí:** combo con multiplicador ×1–×5 como stat `COMBO` oculto en ×1; da techo de puntaje para el leaderboard.
- **Sí:** 4 cápsulas con efectos y duraciones fijas; **No:** power-ups apilables ni persistentes.
- **Sí:** hongos de 3 PV con rebrote para que el campo no quede vacío en partidas largas; **No:** hongos envenenados, pulga, araña ni escorpión.
- **Sí:** valores de balance (velocidades, cadencias, probabilidades, temporizadores, puntos, tope de 5 vidas) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER, color magenta (el enjambre) y `sort_order` 7; **Sí:** `.cover-centipede` nueva.
- **Sí:** canvas 600×600 para rejilla exacta 25×25 de 24 px.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Muchas balas, segmentos y avispas en niveles altos bajan el rendimiento.             | Tope de 12 balas; colisiones por celda (lookup en `Map` de hongos) y no por pares; cadenas de máximo 16.       |
| Las balas a 720 px/s atraviesan una celda de 24 px en un frame de 50 ms.             | Sub-pasos de ≤ 8 px con comprobación de colisión en cada uno.                                                   |
| Partir cadenas (también con la Bomba) deja `dir` incoherente.                         | Regla fija `dir = sign(segs[i].c − segs[i+1].c)`; la Bomba reutiliza la misma función de abatir segmento.       |
| Emitir `onStat("mult")` o `onScore` por frame satura React.                           | Emitir solo en bajas, recogidas y cambios de `mult`; el temporizador del combo solo emite al expirar.          |
| Partida infinita si el jugador es muy bueno (puntaje sin techo razonable).           | `stepMs` baja hasta 55 y `spawnMs` hasta 5000: a nivel 10+ el enjambre satura; verificar en paso 6.             |
| `dt` grande tras pausar o cambiar de pestaña produce varios pasos o salto de nivel.  | `lastTime` y `stepAcc` se reinician al reanudar y tras blur; `dt` capado a 50 ms; máximo 1 paso por frame.      |
| Flechas, A/D o espacio interfieren con el input del modal.                            | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Tecla "pegada" tras perder foco (cañón que se desliza o ráfaga infinita).             | `blur` y `pause` vacían `keysDown` y `fireHeld`.                                                                |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                          |
| `sort_order` 7 choca si `missile-command` no se implementa o cambia de número.        | Dejar hueco en 6 es inocuo (solo ordena); verificar con `execute_sql` antes de migrar que 7 está libre.         |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                 |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Pulga, araña, escorpión y hongos envenenados.
- Mejoras persistentes, selector de dificultad o modos alternativos.
- Animación interpolada del ciempiés.
- HUD nativo de texto dentro del canvas y overlays de pausa/subida de nivel/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
