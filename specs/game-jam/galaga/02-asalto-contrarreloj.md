# SPEC GJ-galaga-02 — Juego real: GALAGA (variante: asalto contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-19
> **Variant:** 02 de 2 — Galaga contrarreloj moderno: 90 s de reloj, nave con movimiento libre en la zona baja y autodisparo, escuadrones que cruzan la pantalla sin formar, combo multiplicador y cápsulas de tiempo y doble disparo; los impactos restan tiempo en lugar de vidas.
> **Objective:** Crear un motor TypeScript de Galaga contrarreloj dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Galaga. Toma la estética de Galaga (abejas, mariposas, jefes de 2 colores, trayectorias curvas en grupo) pero cambia las reglas a un **ataque de puntuación contrarreloj**: la partida dura lo que dure el **reloj (90 s iniciales)**, la nave se mueve en **2D dentro de la franja baja** y **dispara sola** mientras se mantiene `Espacio`, los enemigos llegan en **escuadrones de 5 que cruzan la pantalla por curvas** (no hay formación ni picadas desde ella) y cada derribo encadenado sube un **combo ×1 a ×8**. Un impacto **no quita vidas: resta 5 s** y rompe el combo. Los jefes sueltan **cápsulas de +5 s**. Se distingue de la variante 01 (formación de 40, 2 disparos máximos, rayo tractor, 3 vidas por fases): aquí el reto es **mantener el combo y ganar tiempo**, en partidas de 1–3 minutos ideales para el leaderboard.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5, missile-command propuesto = 6), dificultad 3, tags `CONTRARRELOJ` y `NAVES`, 1 jugador, teclado. Canvas **480×640** (3:4). **Sin vidas** (sin `initialLives`; el recurso es el tiempo), **nivel = oleada de dificultad** que sube cada 15 s (`showLevel: true`), stats extra `TIEMPO` (segundos) y `COMBO`. Sin rayo tractor ni caza doble. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/squads.ts`: funciones puras (`bezier(p0, p1, p2, p3, t)`, `SQUAD_PATHS` con las 4 curvas de cruce, `squadFor(level, rnd) → { kinds, pathIdx, mirror }`, `levelConfig(level) → { spawnMs, enemySpeed, bulletSpeed, fireChance, bossEvery }`) y constantes (`ZONE`, `START_TIME`, `MAX_TIME`, `COMBO_WINDOW_MS`).
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawPlayer` (con parpadeo de invulnerabilidad y aura de doble disparo), `drawBee`, `drawButterfly`, `drawBoss` (3 estados de color), `drawCapsule`, `drawBullet`, `drawExplosion`, `drawPopup` (número de puntos flotante) con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `linear-gradient(180deg, #1a0026, #000)` con `::before` de estrellas (`radial-gradient` repetido) y `::after` de una nave magenta `#ff2bd6` con `clip-path` y una estela amarilla.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **nivel** y stats extra `time` ("TIEMPO", `seconds`, reloj restante) y `combo` ("COMBO", `int`, multiplicador actual; oculto con 0 y con ×1).
- Sin HUD nativo de texto en el canvas, salvo los números de puntos flotantes (`drawPopup`) que son parte de la escena. Sin overlays.
- Controles: flechas (también `WASD`) mueven la nave en 2D; mantener `Espacio` o `J` dispara en automático. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Formación, rayo tractor, caza doble, vidas y jefes finales.
- Selector de duración o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Encadena derribos antes de que se acabe el reloj.',
       'Tienes 90 segundos. Mueve tu nave con las flechas por la zona baja y mantén Espacio para disparar sin parar. Escuadrones de abejas, mariposas y jefes cruzan la pantalla en curva: derríbalos seguidos para subir el combo hasta x8. Cada impacto te quita 5 segundos y rompe el combo; los jefes sueltan cápsulas que suman tiempo. La partida termina cuando el reloj llega a cero.',
       'SHOOTER', 'magenta', 'cover-galaga', 1, 1, '{keyboard}', '{CONTRARRELOJ,NAVES}', 3, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 640,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `player { x, y, invulnMs, doubleMs, fireCd }`, `keysDown: Set<string>`, `firing: boolean`, `shots: { x, y }[]`, `enemies: { kind: "bee" | "butterfly" | "boss", x, y, hp, pathIdx, mirror, t, delayMs, fired: boolean, squadId }[]`, `squads: Map<number, { alive, total }>`, `enemyBullets: { x, y, vx, vy }[]`, `capsules: { x, y, type: "time" | "double" }[]`, `explosions: { x, y, age, big }[]`, `popups: { x, y, text, age }[]`, `stars: { x, y, v, c }[]` (90, generadas por instancia), `timeLeft` (ms), `elapsed` (ms), `level`, `spawnTimer`, `squadCount`, `combo`, `comboMs`, `kills`, `score`, `lastTimeTenths` (para emitir `time` solo al cambiar la décima), `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("time", s)` (solo cuando cambia `Math.ceil(timeLeft / 100) / 10`, es decir, una vez por décima), `onStat("combo", c)` (se emite `null` cuando el combo es ×1 o se rompe, y el valor cuando es ≥ 2). Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 90)`, `onStat("combo", null)`.
- Esta variante **no tiene vidas**: no declara `initialLives` y **no emite `onLives`**. Game over: `onStat("time", null)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas. (El orden `onLives(0)` → `onGameOver` de SPEC 05 no aplica al no haber vidas.)
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo es por tecla mantenida (`firing` en `keydown`/`keyup`, `e.repeat` se ignora); el movimiento usa `keysDown`.
- Pausa/blur/destroy vacían `keysDown` y ponen `firing = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El reloj de partida solo descuenta con el juego activo (no en pausa).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, cambio de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** fondo `#000008` con 90 estrellas (1–2 px) que bajan a velocidad aleatoria en `[30, 90]` px/s (×1.5 durante el doble disparo) y reaparecen arriba. Colores al azar entre `#ffffff`, `#00f5ff`, `#ff2bd6`, `#ffe600`.
- **Nave:** 28×26 px, empieza en (240, 580). Se mueve a **260 px/s** en cada eje (diagonal normalizada a 260 px/s). Zona `ZONE`: `x ∈ [20, 460]`, `y ∈ [420, 616]`. Hitbox círculo de **9 px** de radio en el centro (más pequeño que el dibujo, estilo moderno).
- **Disparo:** con `firing`, un disparo cada **160 ms** (`fireCd`): proyectil 3×12 px a **720 px/s** hacia arriba desde la punta. Con doble disparo activo: 2 proyectiles paralelos separados 12 px. Sin límite de proyectiles en pantalla; desaparecen al salir por `y < 0`.
- **Reloj:** `timeLeft` empieza en **90 000 ms**, máximo **99 000 ms**. Baja en tiempo real de juego. Al llegar a 0 → game over.
- **Nivel:** `level = 1 + Math.floor(elapsed / 15000)` (sube cada 15 s de juego, sin tope); `onLevel(level)` al cambiar. `elapsed` es tiempo jugado, independiente de `timeLeft`.
- **Escuadrones (`levelConfig(level)`):**
  - Un escuadrón nuevo cada `spawnMs = max(900, 2800 − 200 × (level − 1))` ms; el primero aparece 800 ms tras empezar.
  - Cada escuadrón tiene **5** enemigos que siguen la misma curva cúbica, uno cada **150 ms**, a `enemySpeed = min(180 + 15 × (level − 1), 330)` px/s; al terminar la curva (sale de pantalla) desaparecen sin penalizar.
  - Composición (`squadFor`): si `squadCount % bossEvery === bossEvery − 1` con `bossEvery = 4`, es escuadrón de jefe: 1 jefe en el centro (posición 3) y 4 mariposas. Si no: aleatorio 50 % abejas ×5, 30 % mariposas ×5, 20 % mezcla (abeja, mariposa, abeja, mariposa, abeja).
  - Curvas `SQUAD_PATHS` (cada una puede espejarse `x → 480 − x` al 50 %): **A** cruce en S de izquierda a derecha: P0 (−30, 120), P1 (300, 60), P2 (180, 380), P3 (510, 300). **B** caída en bucle: P0 (120, −30), P1 (120, 360), P2 (420, 360), P3 (360, −30). **C** barrido bajo: P0 (−30, 260), P1 (160, 470), P2 (320, 470), P3 (510, 260). **D** picada vertical: P0 (240, −30), P1 (60, 300), P2 (420, 300), P3 (240, 680). La curva se elige al azar entre las 4; desde el nivel 4 la **C** y la **D** tienen el doble de peso.
  - El avance de `t` es proporcional a la longitud aproximada de la curva (20 segmentos) para que `enemySpeed` sea la rapidez real.
- **Disparo enemigo:** cada mariposa y cada jefe, una vez por vida (`fired`), al cruzar `t = 0.4` dispara con probabilidad `fireChance = min(0.35 + 0.05 × (level − 1), 0.8)` un proyectil apuntado a la nave a `bulletSpeed = min(200 + 20 × (level − 1), 340)` px/s. Los jefes disparan **3** proyectiles en abanico (±15°). Las abejas no disparan. Proyectiles enemigos 4×8 px.
- **Enemigos:** abeja 1 impacto; mariposa 1 impacto; jefe **3** impactos (verde `#00ff88` → violeta `#a855f7` → rojo `#ff3355`).
- **Combo:** cada derribo dentro de **1500 ms** (`COMBO_WINDOW_MS`) del anterior sube `combo + 1` (máximo **8**); si pasan 1500 ms sin derribos, `combo = 1`. El primer derribo tras romperse deja `combo = 1`. Se emite `onStat("combo", combo ≥ 2 ? combo : null)` al cambiar.
- **Puntuación** (base × `combo` vigente tras sumar el derribo):
  - Abeja **100**, mariposa **150**, jefe **500**.
  - **Escuadrón completo:** derribar los 5 de un mismo escuadrón suma **1000** extra (sin multiplicar por combo) y crea un popup "+1000".
  - Cápsula de tiempo recogida: **200** (sin combo).
  - Bonus final: ninguno (el tiempo restante es 0 por definición).
- **Cápsulas:** el jefe derribado suelta **siempre** una cápsula de **+5 s** (cyan, "+5"); cada **15 derribos** (`kills % 15 === 0`) cae además una cápsula de **doble disparo** (amarilla, "x2") en la posición del enemigo. Caen a **120 px/s** y desaparecen al salir por abajo. Se recogen por solape (círculo de 12 px con la hitbox de la nave). Tiempo: `timeLeft = min(timeLeft + 5000, 99 000)`. Doble disparo: `doubleMs = 8000` (recoger otra reinicia a 8000, no acumula).
- **Impacto en la nave:** proyectil enemigo o choque con un enemigo (el enemigo muere sin dar puntos ni contar en el combo), solo si `invulnMs = 0`: `timeLeft − 5000` (mínimo 0), `combo = 1`, `doubleMs = 0`, `invulnMs = 2000` (la nave parpadea cada 100 ms), explosión pequeña y se borran los proyectiles enemigos a menos de 80 px. Si `timeLeft` llega a 0 por el impacto → game over inmediato.
- **Derribos:** `kills + 1` por enemigo derribado por el jugador (para las cápsulas de doble disparo; no se emite como stat).
- **Dibujo:** nave blanca `#ffffff` con alas magenta `#ff2bd6` (aura amarilla `#ffe600` con doble disparo); proyectil propio `#00f5ff`; abeja `#ffe600` con alas `#3b82f6` (alas alternan cada 200 ms); mariposa `#ff3355` con alas blancas; jefe según vida; proyectil enemigo `#ff2bd6`; cápsulas: círculo con gradiente radial y texto "+5" o "x2" de 10 px en monoespaciada; popups de puntos en `#ffe600`, 12 px, suben 30 px y se desvanecen en 600 ms; explosión: 8 rayos de 0 a 18 px en 400 ms (jefe: 30 px).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/squads.ts` (curvas, `squadFor`, `levelConfig`). Verificar: `npm run lint`; `levelConfig(1)` da `spawnMs` 2800, `enemySpeed` 180, `bulletSpeed` 200, `fireChance` 0.35; `levelConfig(11)` da 900, 330, 340, 0.8.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): movimiento 2D limitado a la zona baja, autodisparo al mantener `Espacio`, reloj bajando en el HUD, combo subiendo y rompiéndose, bonus de escuadrón completo, jefe de 3 impactos con cápsula +5 s, cápsula x2 al derribo 15, impacto que resta 5 s con 2 s de invulnerabilidad, nivel subiendo cada 15 s, game over a 0 s, pausa (botón y `P`) sin descontar reloj, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`NAVES`, dificultad 3, color magenta, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px; el HUD no muestra vidas.
- [ ] Flechas y `WASD` mueven la nave a 260 px/s (también en diagonal) sin salir de `x ∈ [20, 460]`, `y ∈ [420, 616]`; flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara un proyectil cada 160 ms (2 en paralelo con doble disparo); soltar detiene el fuego.
- [ ] TIEMPO empieza en 90.0 s, baja en tiempo real y nunca supera 99.0 s; el HUD se actualiza una vez por décima, no por frame.
- [ ] El nivel del HUD sube cada 15 s de juego; en nivel 1 aparece un escuadrón de 5 cada 2800 ms a 180 px/s.
- [ ] Cada 4.º escuadrón trae un jefe que aguanta 3 impactos (verde → violeta → rojo) y suelta una cápsula +5 s.
- [ ] Puntos: abeja 100, mariposa 150, jefe 500, multiplicados por el combo; escuadrón completo +1000; cápsula de tiempo +200.
- [ ] Derribos encadenados en menos de 1500 ms suben COMBO hasta 8; 1500 ms sin derribos lo ocultan (×1).
- [ ] El derribo número 15, 30, … suelta una cápsula x2 que activa doble disparo 8 s.
- [ ] Un impacto resta 5 s, rompe el combo, quita el doble disparo y deja la nave parpadeando 2 s sin recibir más daño.
- [ ] Con el reloj en 0 se emite `onGameOver` (sin `onLives`) y se abre el modal con el puntaje correcto.
- [ ] Pausa (botón y `P`) congela reloj, nave, enemigos, proyectiles, cápsulas, estrellas y temporizadores; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, `J`, espacio) no mueve la nave ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 90.0, COMBO oculto, nave en (240, 580), sin enemigos, proyectiles ni cápsulas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** el tiempo es el único recurso (sin `initialLives`, sin `onLives`); partidas acotadas y puntajes comparables. **No:** vidas (son de la variante 01).
- **Sí:** autodisparo por tecla mantenida y movimiento 2D en franja baja; ritmo moderno distinto al clásico. **No:** límite de 2 disparos.
- **Sí:** escuadrones que cruzan sin formar; **No:** formación, picadas desde formación ni rayo tractor (variante 01).
- **Sí:** combo ×1–×8 y bonus de escuadrón completo como eje competitivo.
- **Sí:** impacto = −5 s con 2 s de invulnerabilidad; evita perder varios segundos por una ráfaga.
- **Sí:** hitbox circular de 9 px más pequeña que el dibujo (convención de shmup moderno).
- **Sí:** stats `TIEMPO` (`seconds`) y `COMBO`; `onStat("time")` una vez por décima, no por frame.
- **Sí:** valores de balance (reloj, velocidades, intervalos, probabilidades, puntos, cápsulas) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 480×640 (3:4 vertical); **Sí:** `cat` SHOOTER y color magenta; `.cover-galaga` nueva.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                              | Mitigation                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onStat("time")` por frame satura React.                                          | Emitir solo cuando cambia la décima redondeada (`lastTimeTenths`); máx. 10 eventos/s.                                |
| El autodisparo sin límite genera muchos proyectiles y baja el rendimiento.        | Cadencia fija de 160 ms (máx. ~8 proyectiles propios en pantalla a 720 px/s); arrays filtrados al salir de pantalla. |
| Partidas infinitas si las cápsulas de tiempo compensan siempre.                   | Tope de 99 s, +5 s solo por jefe (1 de cada 4 escuadrones) y dificultad creciente sin tope de nivel.                |
| Impactos múltiples en el mismo frame restan más de 5 s.                           | `invulnMs = 2000` se fija en el primer impacto y se comprueba antes de cada colisión.                               |
| `dt` grande tras pausar o cambiar de pestaña descuenta reloj o teletransporta.   | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; reloj solo descuenta sin pausa.                |
| `Espacio` pegado tras perder foco deja el autodisparo activo.                     | `blur` y `pause` ponen `firing = false` y vacían `keysDown`.                                                         |
| Flechas, `WASD`, `J` o espacio interfieren con el input del modal.                | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                |
| HUD de React espera vidas y muestra "0" o rompe el orden de game over.            | Sin `initialLives` no se muestra HUD de vidas; game over solo emite `onGameOver` (contrato SPEC 07).                |
| Doble loop / listeners por StrictMode.                                            | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                              |
| Next 16 difiere del conocimiento previo.                                          | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                     |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Formación, rayo tractor, caza doble, vidas y jefes finales.
- HUD nativo de texto dentro del canvas (salvo popups de puntos) y overlays de pausa/nivel/game over.
- Selector de duración, dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
