# SPEC GJ-galaga-01 — Juego real: GALAGA (variante: clásico de formación) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-19
> **Variant:** 01 de 2 — Galaga clásico fiel: nave en el eje horizontal con máximo 2 disparos en pantalla, 40 enemigos que entran en grupos y forman, picadas con escolta, rayo tractor del jefe y caza doble al rescatar la nave capturada.
> **Objective:** Crear un motor TypeScript de Galaga dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Galaga. Recrea el arcade de 1981: la nave solo se mueve en horizontal en la base de la pantalla, dispara como mucho **2 proyectiles a la vez**, y cada fase trae **40 enemigos** (abejas, mariposas y jefes) que entran volando en **5 grupos** por trayectorias curvas, se colocan en una **formación** que oscila y desde ahí lanzan **picadas**. El jefe necesita 2 impactos, puede bajar con escolta y puede **capturar la nave con su rayo tractor**; derribarlo en picada libera la nave y da el **caza doble**. Se mide en fases (nivel) con **3 vidas**. Se distingue de la variante 02 (contrarreloj de 90 s, movimiento libre en 2D, autodisparo, escuadrones que cruzan sin formar, combo y cápsulas): aquí el reto es **leer la formación, gestionar 2 disparos y arriesgar la nave para conseguir el caza doble**.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css` (`.cover-invaders` es de un prototipo distinto); se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5, missile-command propuesto = 6), dificultad 4, tags `CLÁSICO` y `NAVES`, 1 jugador, teclado. Canvas **448×576** (7:9, el 224×288 del arcade ×2). **3 vidas** (`initialLives: 3`), **nivel = fase** (`showLevel: true`), stat extra `DERRIBOS`. Sin fases de desafío ("challenging stage"). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/paths.ts`: funciones puras (`bezier(p0, p1, p2, p3, t)`, `ENTRY_PATHS` con las curvas de entrada, `slotPos(col, row, swayX)`, `stageConfig(stage) → { diveMs, maxDivers, diveVy, fireChance, entryFire }`) y constantes (`COLS_X`, `ROWS_Y`, `PLAYER_Y`, `GROUPS`).
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawPlayer` (simple y doble), `drawBee`, `drawButterfly`, `drawBoss` (2 estados de color), `drawBeam`, `drawBullet`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `radial-gradient(circle at 50% 30%, #001a33, #000)` con `::before` de puntos blancos (estrellas con `radial-gradient` repetido) y `::after` de un triángulo cyan (nave) centrado abajo con `clip-path`.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **448×576**.
- HUD de React: puntaje, **3 vidas**, **nivel** (= fase) y stat extra `kills` ("DERRIBOS", `int`, enemigos derribados en la partida).
- Sin HUD nativo de texto en el canvas; el texto "STAGE N" entre fases no se dibuja (sin overlays).
- Controles: `←`/`→` (también `A`/`D`) mueven la nave; `Espacio` o `Z` dispara. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Fases de desafío, enemigos transformables (escorpiones), nave capturada hostil que ataca y estadística de acierto de fin de partida.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Derriba la formación antes de que caiga en picada.',
       'Mueve tu nave con las flechas y dispara con Espacio: solo puedes tener dos disparos en pantalla. Cuarenta enemigos entran volando, forman arriba y bajan en picada. El jefe aguanta dos impactos y puede capturar tu nave con su rayo tractor; derríbalo mientras baja y la recuperas como caza doble. Tienes tres vidas; cada fase limpia trae una formación más agresiva.',
       'SHOOTER', 'cyan', 'cover-galaga', 1, 1, '{keyboard}', '{CLÁSICO,NAVES}', 4, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 448, height: 576,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "kills", label: "DERRIBOS", color: "magenta", format: "int" }],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `player { x, alive, dual, respawnMs }`, `keysDown: Set<string>`, `shots: { x, y }[]`, `enemies: { kind: "bee" | "butterfly" | "boss", col, row, x, y, hp, mode: "wait" | "entry" | "toSlot" | "formation" | "dive" | "beam" | "return", pathIdx, t, delayMs, diveT, diveX0, escortOf: number | null, hasCaptive: boolean }[]`, `enemyBullets: { x, y, vx, vy }[]`, `captive { x, y, mode: "held" | "falling" } | null`, `beam { bossIdx, ms } | null`, `explosions: { x, y, age, big }[]`, `stars: { x, y, v, c }[]` (80, generadas por instancia), `swayT`, `group` (grupo de entrada en curso), `groupTimer`, `diveTimer`, `stage`, `phase: "entry" | "attack" | "clear" | "respawn"`, `phaseMs`, `score`, `lives`, `kills`, `nextExtraAt`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (fase), `onStat("kills", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("kills", 0)` (0 oculta el stat hasta el primer derribo, comportamiento esperado).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (un disparo por pulsación, como el original); el movimiento usa `keysDown`.
- Pausa/blur/destroy vacían `keysDown`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de fase ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** fondo negro `#000005` con 80 estrellas (1–2 px) que bajan a velocidad aleatoria en `[20, 60]` px/s y reaparecen arriba; colores al azar entre `#ffffff`, `#00f5ff`, `#ff2bd6`, `#ffe600`. Las estrellas se congelan en pausa.
- **Nave:** 26×24 px, centro en `y = PLAYER_Y = 536`, empieza en `x = 224`. Se mueve a **240 px/s**; limitada a `x ∈ [20, 428]` (caza doble: `x ∈ [34, 414]`). Hitbox rectángulo 20×18 por nave.
- **Disparo:** proyectil 3×12 px a **600 px/s** hacia arriba, sale de la punta (`y = 520`). Máximo **2** en pantalla (caza doble: cada pulsación dispara 2, uno por nave, máximo **4**); si se alcanza el máximo, la pulsación se ignora. Un proyectil que sale por `y < 0` desaparece.
- **Formación:** 10 columnas con `COLS_X[c] = 224 + (c − 4.5) × 32` y 5 filas con `ROWS_Y = [80, 112, 144, 176, 208]`. Fila 0: **4 jefes** (columnas 3–6). Filas 1–2: **8 mariposas** cada una (columnas 1–8). Filas 3–4: **10 abejas** cada una (columnas 0–9). Total **40**. La formación oscila en horizontal: `swayX = 16 × sin(2π × swayT / 4000)` (amplitud 16 px, periodo 4 s); los huecos de enemigos en picada se mantienen.
- **Entrada (fase `entry`):** 5 grupos de 8, uno cada **1500 ms** desde el inicio de la fase; dentro del grupo, cada enemigo sale **120 ms** después del anterior. Siguen una curva cúbica a **220 px/s** (avance de `t` proporcional a la longitud aproximada de 20 segmentos) y luego vuelan en línea recta a su hueco a 220 px/s.
  - G1: 4 mariposas (fila 1, columnas 3–6) + 4 abejas (fila 3, columnas 3–6); curva **superior**: P0 (224, −20), P1 (224, 220), P2 (60, 320), P3 (120, 160).
  - G2: 4 jefes + 4 mariposas (fila 1, columnas 1, 2, 7, 8); curva **izquierda**: P0 (−20, 420), P1 (160, 400), P2 (260, 180), P3 (160, 120).
  - G3: 8 mariposas (fila 2, columnas 1–8); curva **derecha** (espejo de la izquierda, `x → 448 − x`).
  - G4: 8 abejas (fila 3, columnas 0–2 y 7–9, fila 4 columnas 0 y 9); curva izquierda.
  - G5: 8 abejas (fila 4, columnas 1–8); curva derecha.
  - En fase 1 los enemigos no disparan durante la entrada; desde la fase 2 cada enemigo que entra dispara **1** proyectil con probabilidad `entryFire = min(0.1 + 0.05 × (s − 2), 0.3)` al cruzar `y = 260` en su curva.
  - La fase pasa a `attack` cuando los 40 (o los que queden vivos) han llegado a su hueco.
- **Picadas (fase `attack`, fase `s`, `stageConfig`):**
  - Cada `diveMs = max(900, 2600 − 150 × (s − 1))` ms empieza una picada si hay menos de `maxDivers = min(2 + Math.floor(s / 2), 6)` enemigos fuera de la formación.
  - Elige al azar un enemigo vivo en formación. Si es jefe, se lleva como escolta hasta **2 mariposas** vivas en formación de las columnas adyacentes (`col − 1`, `col`, `col + 1`, fila 1), que lo siguen con desfase de 24 px.
  - Trayectoria: semicírculo hacia arriba y afuera de 30 px de radio en **400 ms**; después baja con `vy = diveVy = min(160 + 10 × (s − 1), 260)` px/s y `x = diveX0 + 60 × sin(2π × diveT / 1600)`, donde `diveX0` es la `x` de la nave al empezar la picada. Al salir por `y > 596` reaparece en `y = −20` sobre su columna y vuelve a su hueco a 220 px/s (`mode = "return"`).
  - Disparo en picada: al cruzar `y = 260`, con probabilidad `fireChance = min(0.6 + 0.05 × (s − 1), 0.9)`, dispara **1** proyectil apuntado a la posición actual de la nave a **240 px/s** (si `vy` resultante < 120 px/s, se fuerza `vy = 120` y se recalcula `vx` para mantener la rapidez).
- **Rayo tractor:** cuando un jefe sin escolta inicia una picada, con probabilidad **0.35**, si la nave no es doble, no hay `captive` ni otro rayo activo, hace una picada de captura: baja en línea recta a 160 px/s hasta `y = 330` sobre `diveX0`, se detiene y despliega el rayo durante **3000 ms** (trapecio de 24 px de ancho en el jefe a 96 px en `y = 576`, ondas cyan/magenta). Si el centro de la nave queda dentro del ancho del rayo en `y = PLAYER_Y` en cualquier momento, la nave es **capturada**: se pierde una vida (`onLives(lives)`), la nave sube a 120 px/s hasta quedar 28 px sobre el jefe y pasa a `captive.held` (dibujada en rojo `#ff3355`); el jefe vuelve a su hueco con ella. Si era la última vida → game over. Si no, `phase = "respawn"`.
- **Rescate y caza doble:** si se derriba un jefe con `hasCaptive` mientras está en picada (no en formación), la nave capturada pasa a `captive.falling`, baja a 160 px/s hacia `PLAYER_Y` y se acopla a la derecha de la nave (`dual = true`, separación 28 px entre centros). Si el jefe con cautiva se derriba **en formación**, la nave capturada se pierde (desaparece) sin puntos. Disparar a la nave cautiva (en cualquier modo `held`) la destruye: **1000** puntos.
- **Jefe:** 2 impactos. El primero cambia su color de verde `#00ff88` a violeta `#a855f7` y no da puntos; el segundo lo derriba.
- **Puntuación:**
  - Abeja: **50** en formación / **100** en picada (incluye entrada y regreso).
  - Mariposa: **80** en formación / **160** en picada.
  - Jefe: **150** en formación / **400** en picada solo; en picada con escolta: **800** si ya se derribó 1 escolta de esa picada, **1600** si se derribaron las 2.
  - Nave cautiva destruida: **1000**.
- **Daño a la nave:** proyectil enemigo en la hitbox o choque con un enemigo (el enemigo muere y da sus puntos de picada). Con caza doble, el impacto destruye solo esa mitad (`dual = false`, la otra queda centrada en su posición) y **no** cuesta vida. Con nave simple: explosión de 800 ms, `lives − 1`, `onLives(lives)`; si `lives = 0` → `onLives(0)` y `onGameOver(score)`.
- **Reaparición (fase `respawn`):** 2000 ms sin nave; los enemigos en picada terminan su trayectoria y vuelven a la formación, no empiezan picadas nuevas y los proyectiles enemigos en pantalla siguen. La nave reaparece en `x = 224` y las picadas se reanudan **1500 ms** después.
- **Fin de fase:** al morir los 40, `phase = "clear"` durante **2000 ms** (sin enemigos ni proyectiles enemigos nuevos), luego `stage + 1`, `onLevel(stage)`, formación rearmada y nueva fase `entry`. La nave doble y la cautiva no derrotada se conservan (la cautiva vuelve sobre el jefe nuevo de columna 3 si existe; si no hay `captive`, nada).
- **Vida extra:** a los **20000** puntos y luego cada **70000** (`nextExtraAt` 20000, 90000, 160000, …), `lives + 1` hasta un máximo de **5**, `onLives(lives)`.
- **Derribos:** `kills + 1` por cada enemigo derribado (no cuenta la nave cautiva); `onStat("kills", kills)`.
- **Dibujo:** nave blanca `#ffffff` con cabina y alas cyan `#00f5ff`; proyectil del jugador `#ffe600`; abeja amarilla `#ffe600` con alas azules `#3b82f6` (las alas alternan abierto/cerrado cada 250 ms); mariposa roja `#ff3355` con alas blancas; jefe verde `#00ff88` (violeta `#a855f7` tras el primer impacto) con alas amarillas; proyectiles enemigos `#ff2bd6` de 3×8 px; explosión: 8 rayos que crecen de 0 a 18 px en 400 ms y se desvanecen (jugador: 28 px y 800 ms).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/paths.ts` (curvas, huecos y `stageConfig`). Verificar: `npm run lint`; `stageConfig(1)` da `diveMs` 2600, `maxDivers` 2, `diveVy` 160, `fireChance` 0.6; `stageConfig(12)` da 950, 6, 260, 0.9.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): entrada de los 5 grupos, formación oscilando, límite de 2 disparos, picadas con escolta, jefe de 2 impactos, captura por rayo tractor (vida perdida), rescate en picada (caza doble con 4 disparos), perder una mitad del caza doble sin perder vida, limpiar la fase 1 (nivel 2), perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`NAVES`, dificultad 4, color cyan, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 7:9 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven la nave a 240 px/s dentro de `x ∈ [20, 428]`; flechas y `Espacio` no hacen scroll.
- [ ] Nunca hay más de 2 disparos propios en pantalla (4 con caza doble); mantener `Espacio` no repite disparos.
- [ ] La fase 1 trae exactamente 40 enemigos (4 jefes, 16 mariposas, 20 abejas) en 5 grupos de 8, que terminan en su hueco de la formación; la formación oscila ±16 px cada 4 s.
- [ ] En fase 1 empiezan picadas cada 2600 ms con como mucho 2 enemigos fuera de la formación; los enemigos en picada que salen por abajo reaparecen arriba y vuelven a su hueco.
- [ ] Puntos: abeja 50/100, mariposa 80/160, jefe 150/400 (800 y 1600 con 1 y 2 escoltas derribados), nave cautiva 1000.
- [ ] El jefe cambia de verde a violeta con el primer impacto y muere con el segundo.
- [ ] Quedar dentro del rayo tractor captura la nave: baja una vida en el HUD y la nave roja queda sobre el jefe; derribar ese jefe en picada devuelve la nave como caza doble.
- [ ] Un impacto con caza doble elimina solo una mitad y no baja vidas; con nave simple baja una vida y la nave reaparece a los 2000 ms en `x = 224`.
- [ ] Limpiar los 40 enemigos sube el nivel del HUD tras 2000 ms y empieza una nueva entrada.
- [ ] Al llegar a 20000 puntos se gana una vida (máximo 5); la siguiente llega a 90000.
- [ ] DERRIBOS sube en 1 por cada enemigo derribado; sin eventos por frame.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] Pausa (botón y `P`) congela nave, enemigos, proyectiles, rayo, estrellas y temporizadores; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `Z`, espacio) no mueve la nave ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, fase 1, DERRIBOS oculto, nave simple en `x = 224`, sin cautiva ni proyectiles).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** límite de 2 disparos en pantalla y disparo por pulsación; es la tensión central del original. **No:** autodisparo (es de la variante 02).
- **Sí:** rayo tractor, nave cautiva y caza doble; son la seña de identidad de Galaga frente a Space Invaders.
- **No:** nave cautiva hostil que ataca al jugador; se simplifica a "se pierde" si el jefe muere en formación (menos IA, mismo dilema).
- **No:** fases de desafío; añaden 8 coreografías sin disparo enemigo que no cambian la puntuación competitiva básica (spec aparte).
- **Sí:** 3 vidas (`initialLives: 3`), fase como nivel y stat `DERRIBOS`; **No:** stat de porcentaje de acierto (cambiaría casi en cada disparo).
- **Sí:** caza doble absorbe un impacto sin coste de vida, como el original.
- **Sí:** valores de balance (velocidades, intervalos, probabilidades, puntos, vidas extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 448×576 (proporción vertical del arcade); **Sí:** `cat` SHOOTER y color cyan; `.cover-galaga` nueva.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                 | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| La máquina de estados por enemigo (`entry`/`toSlot`/`formation`/`dive`/`beam`/`return`) se enreda. | Un `switch` por `mode` con una función de actualización por modo; transiciones solo en esos puntos.                     |
| La fase nunca termina (enemigo atascado en `return` o contador mal llevado).        | Fin de fase cuando `enemies.filter(alive).length === 0`, no por contadores; enemigos siempre vuelven a su hueco.         |
| Captura y rescate en el mismo frame que un impacto producen estados imposibles.      | Orden fijo por frame: mover → impactos del jugador → impactos enemigos → rayo; `captive` y `beam` con un único dueño.  |
| La entrada de fase 1 es demasiado lenta o la fase 4+ imposible con teclado.          | Valores fijos en `stageConfig` con topes (`maxDivers` 6, `diveVy` 260); verificar en paso 6 y ajustar solo en el spec.  |
| Emitir `onLives`/`onStat` por frame satura React.                                    | Emitir solo en impacto, captura, vida extra, derribo y cambio de fase.                                                  |
| `dt` grande tras pausar o cambiar de pestaña teletransporta enemigos.                | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                    |
| Flechas, `A`/`D`, `Z` o espacio interfieren con el input del modal.                  | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| Tecla "pegada" tras perder foco.                                                     | `blur` y `pause` vacían `keysDown`.                                                                                     |
| Doble loop / listeners por StrictMode.                                               | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| Next 16 difiere del conocimiento previo.                                             | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Fases de desafío, escorpiones/transformaciones y nave cautiva hostil.
- HUD nativo de texto dentro del canvas y overlays de pausa/transición/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
