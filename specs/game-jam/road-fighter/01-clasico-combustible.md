# SPEC GJ-road-fighter-01 — Juego real: ROAD FIGHTER (variante: clásico de combustible) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-09
> **Variant:** 01 de 2 — Clásico fiel: conducción analógica (acelerar, frenar, girar libre), carretera que se estrecha y curva por etapas, sin vidas y con el combustible como único reloj de la partida.
> **Objective:** Crear un motor TypeScript de Road Fighter (variante clásico de combustible) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/road-fighter` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Road Fighter. Reproduce el espíritu del original de Konami: scroll vertical, el coche se controla con **acelerador, freno y volante continuo** (posición horizontal libre, sin carriles), la carretera cambia de **ancho y posición** a lo largo de **4 etapas** y **no hay vidas**: el depósito de **combustible** baja con el tiempo, chocar cuesta combustible y la partida termina cuando se vacía. Recargar exige tocar los **coches de combustible**. Se distingue de la variante 02 (autopista infinita por carriles discretos, velocidad automática, nitro, rozones con combo y 3 vidas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-road-fighter`.

Decisiones fijadas por el agente (no se reabren): `id` `road-fighter`, título `ROAD FIGHTER`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 y `missile-command` = 6 reservado por sus specs game-jam), dificultad 3, tags `CLÁSICO` y `CARRERAS`, 1 jugador, teclado. Canvas **480×640** (3:4, vertical). **Sin vidas** (sin `initialLives`), **nivel = etapa** (`showLevel: true`, infinito: tras la etapa 4 se repite el trazado con más tráfico), stats extra `FUEL` y `KM/H`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/road-fighter/engine.ts`: sin globals de módulo; exporta `roadFighterDef: GameEngineDef` con `createRoadFighter(canvas, events) → GameController`.
- Módulo `lib/games/road-fighter/track.ts`: funciones puras y constantes del trazado (`STAGES`, `STAGE_LENGTH`, `roadAt(level, d) → { left, right }`, `spawnGap(level)`, `rollTrafficType(level, rand)`, `kmhToPx(kmh)`).
- Módulo `lib/games/road-fighter/draw.ts`: `drawGrass`, `drawRoad` (asfalto, bordillos, líneas), `drawFinishLine`, `drawCar(ctx, x, y, w, h, body, accent)`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"road-fighter"` en `lib/games/registry.ts`.
- Clase `.cover-road-fighter` en `app/globals.css`: fondo `linear-gradient(90deg,#0b3d0b 0 25%,#2b2b33 25% 75%,#0b3d0b 75%)`; `::before` con línea central discontinua blanca (`repeating-linear-gradient` vertical) y `::after` con un coche cian (rectángulo redondeado `#00f5ff` con parabrisas oscuro) centrado abajo.
- Migración `add_game_road_fighter`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **nivel** (etapa) y stats extra `fuel` ("FUEL", `int`) y `speed` ("KM/H", `int`). Sin vidas.
- Sin HUD nativo de texto en el canvas, salvo el texto `ETAPA N` pintado sobre la meta (forma parte del escenario, no overlay).
- Controles: `↑`/`W` acelera, `↓`/`S` frena, `←`/`→` y `A`/`D` giran. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'road-fighter'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `road-fighter`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Marchas (baja/alta), derrapes por golpe lateral, manchas de aceite, camiones que embisten, bifurcaciones del trazado.
- Vidas, nitro, combos o power-ups distintos del combustible.
- Selector de dificultad o de etapa.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('road-fighter', 'ROAD FIGHTER', 'Corre, adelanta y no te quedes sin gasolina.',
       'Acelera con la flecha arriba o W, frena con abajo o S y esquiva el tráfico con izquierda/derecha o A/D. La carretera se estrecha y se curva en cada etapa; salirte o chocar te cuesta combustible. Toca los coches de combustible para recargar: la partida termina cuando el depósito se vacía.',
       'ARCADE', 'cyan', 'cover-road-fighter', 1, 1, '{keyboard}', '{CLÁSICO,CARRERAS}', 3, 7, false);

Definición del motor:

    export const roadFighterDef: GameEngineDef = {
      width: 480, height: 640,
      showLevel: true,
      stats: [
        { key: "fuel", label: "FUEL", color: "yellow", format: "int" },
        { key: "speed", label: "KM/H", color: "cyan", format: "int" },
      ],
      create: createRoadFighter,
    };

Estado interno (dentro de `createRoadFighter`): `playerX` (borde izquierdo del coche, px de pantalla), `kmh`, `keys { up, down, left, right }` (teclas mantenidas), `distance` (px recorridos en la etapa actual), `pointAcc` (px acumulados para puntos de distancia), `spawnAcc`, `nextFuelAt`, `level`, `fuel`, `traffic: { x, y, w, h, kmh, type: "sedan" | "weaver" | "truck" | "fuel", passed }[]`, `crashMs`, `invulnMs`, `explosion { x, y, age } | null`, `score`, `lastFuelEmitted`, `lastSpeedEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("fuel", n)`, `onStat("speed", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("fuel", 100)`, `onStat("speed", 0)`.
- `onStat("fuel", n)` solo cuando cambia `Math.ceil(fuel)`. `onStat("speed", n)` solo cuando cambia `Math.round(kmh / 10) × 10`. Valor 0 oculta el stat (contrato de `onStat`); esperado con el coche parado.
- Game over: este juego **no tiene vidas**, así que no se emite `onLives`; al vaciarse el depósito se emite `onStat("fuel", 0)` y luego `onGameOver(score)`. El motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Las cuatro direcciones son teclas mantenidas (`keydown` → `true`, `keyup` → `false`; `e.repeat` no cambia nada).
- Pausa/blur/destroy ponen las cuatro `keys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Coordenadas:** el coche del jugador (**28×48 px**) tiene `y` fija en pantalla: borde superior en **520**. Un punto de pantalla a altura `y` corresponde a la distancia de etapa `d = distance + (520 − y)`. Conversión de velocidad: `px/s = kmh × 1.5` (400 km/h = 600 px/s).
- **Conducción:**
  - `↑`/`W` mantenida: `kmh += 140 × dt_s` hasta **400**.
  - `↓`/`S` mantenida: `kmh −= 320 × dt_s` (prioridad sobre `↑` si ambas están pulsadas).
  - Sin `↑` ni `↓`: `kmh −= 80 × dt_s` (freno motor). `kmh` nunca baja de 0.
  - `←`/`A` y `→`/`D`: desplazamiento lateral `240 × min(1, kmh / 120)` px/s (parado no gira). `playerX` se limita a `[0, 452]`.
  - `distance += kmh × 1.5 × dt_s`.
- **Etapas:** `STAGE_LENGTH = 24000` px. Cada etapa tiene 4 tramos de 6000 px `{ center, width }`; en los primeros **600 px** de cada tramo el centro y el ancho se interpolan linealmente desde los del tramo anterior (el tramo 1 parte del último tramo de la etapa del nivel anterior, `STAGES[(level − 2) % 4][3]`; en el nivel 1 parte de `{240, 320}`). `left = center − width/2`, `right = center + width/2`. Trazado por etapa (`STAGES[(level − 1) % 4]`):
  - Etapa 1: `{240, 320}`, `{240, 260}`, `{200, 240}`, `{240, 300}`.
  - Etapa 2: `{240, 280}`, `{280, 220}`, `{180, 220}`, `{240, 200}`.
  - Etapa 3: `{240, 240}`, `{300, 200}`, `{170, 200}`, `{240, 180}`.
  - Etapa 4: `{240, 220}`, `{200, 180}`, `{290, 170}`, `{240, 160}`.
- **Fin de etapa:** al llegar `distance ≥ 24000`: +**2000 × level** puntos, `fuel = min(100, fuel + 30)`, `level += 1` → `onLevel(level)`, `distance = 0`, `spawnAcc = 0`, `nextFuelAt = 5000`, se elimina todo el tráfico y se conserva `kmh`. La meta se dibuja como banda a cuadros blanco/negro de 24 px de alto en `d = 24000` con el texto `ETAPA N` (N = nivel actual) encima.
- **Combustible:** empieza en **100**, baja **1.5 por segundo** de juego (también durante la explosión; no en pausa ni tras game over). Al llegar a 0 → game over.
- **Tráfico** (velocidad propia constante; posición en pantalla `y += (kmhJugador − kmhCoche) × 1.5 × dt_s`, así que los más rápidos que el jugador suben):
  - `sedan`: **26×44**, 200 km/h, recto. Color `#ffe600`.
  - `weaver` (desde nivel 2, probabilidad **0.25**): **26×44**, 180 km/h; cuando su `y` está entre 260 y 520 se desplaza en horizontal hacia `playerX` a **70 px/s**, sin salir de la carretera. Color `#00a2ff`.
  - `truck` (desde nivel 3, probabilidad **0.2**): **34×76**, 130 km/h, recto. Color `#e0e0e0`.
  - `fuel`: **26×44**, 150 km/h, recto. Carrocería alternando `#ff2bd6`/`#ffffff` cada 150 ms.
  - El tipo se sortea en orden `truck` → `weaver` → `sedan`.
- **Aparición:** `spawnAcc` suma los px recorridos por el jugador; cada vez que supera `spawnGap(level) = max(220, 520 − 60 × (level − 1))` se resta y aparece un coche en `y = −h − 10` (encima del borde superior), con `x` aleatoria en `[left + 10, right − 10 − w]` de la carretera a esa altura. Si a menos de 120 px vertical hay otro coche que se solaparía en `x`, se reintenta hasta 4 veces; si falla, no aparece. No aparece tráfico en los primeros **800 px** de cada etapa. Cuando `distance ≥ nextFuelAt` (5000, 10000, 15000, 20000) la siguiente aparición es un coche `fuel` y `nextFuelAt += 5000`. Se elimina el tráfico con `y > 700` o `y < −200`.
- **Puntos:**
  - Distancia: cada **100 px** recorridos (`pointAcc`) → +**10**.
  - Adelantamiento: +**50** la primera vez que el borde superior de un coche de tráfico (no `fuel`) queda por debajo del borde inferior del jugador (`passed = true`; cuenta una sola vez por coche).
  - Combustible: tocar un coche `fuel` → +**1000** puntos y `fuel = min(100, fuel + 20)`; el coche desaparece.
  - Fin de etapa: +2000 × nivel (ver arriba).
- **Choque:** colisión AABB con el rectángulo de cada coche reducido **4 px** por lado, contra `sedan`/`weaver`/`truck`, o el coche del jugador fuera de `[left, right]` a la altura `y = 544` (centro del coche). Efecto: `fuel −= 8`, `kmh = 0`, explosión de **1200 ms** (círculo `#ff6a00` → `#ffe600` que crece hasta 40 px) sin control ni avance; luego reaparece con `playerX = center − 14`, se elimina el tráfico con `y` entre 220 y 640 y queda invulnerable al tráfico **1500 ms** (parpadeo cada 100 ms; los bordes siguen contando). Si el choque deja `fuel ≤ 0`, game over inmediato.
- **Dibujo:** césped `#0b3d0b` con franjas `#0f4f0f` de 40 px que se desplazan con la distancia; asfalto `#2b2b33`; bordillos de 6 px alternando `#ff3355`/`#ffffff` cada 40 px; línea central discontinua blanca (24 px trazo, 24 px hueco) que sigue el centro del trazado. El trazado se dibuja en franjas horizontales de 8 px usando `roadAt` en cada franja. Coche del jugador `#00f5ff` con parabrisas `#0a0a18` y ruedas negras.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-road-fighter` en `app/globals.css`. Aplicar migración `add_game_road_fighter` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'road-fighter'` muestra la fila; `npm run build`.
2. Crear `lib/games/road-fighter/track.ts`. Verificar: `npm run lint`; `roadAt(1, 0) = {left: 80, right: 400}`, `roadAt(1, 6300)` está a mitad de transición (`width` 290), `roadAt(4, 23000) = {left: 160, right: 320}`, `roadAt(5, 0) = {left: 160, right: 320}`, `spawnGap(1) = 520`, `spawnGap(10) = 220`, `kmhToPx(400) = 600`.
3. Crear `lib/games/road-fighter/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/road-fighter/engine.ts` y exportar `roadFighterDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"road-fighter"` en `lib/games/registry.ts`. Verificar: `/games/road-fighter/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): acelerar a 400, frenar, freno motor, girar parado (no gira), adelantar (+50), recoger combustible (+1000, +20 fuel), chocar con coche y con el borde (−8 fuel, 1200 ms, reaparición centrada), `weaver` desde etapa 2, `truck` desde etapa 3, completar una etapa (+2000, +30 fuel, nivel 2, trazado nuevo), vaciar el depósito, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'road-fighter'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `road-fighter` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-road-fighter`), la ficha `/games/road-fighter` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`CARRERAS`, dificultad 3, color cian, categoría ARCADE).
- [ ] `/games/road-fighter/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza parada (KM/H oculto), FUEL 100, nivel 1, puntaje 0, coche centrado en la carretera de 320 px.
- [ ] `↑`/`W` acelera a 140 km/h/s hasta 400; `↓`/`S` frena a 320 km/h/s; sin teclas baja a 80 km/h/s; las flechas no hacen scroll.
- [ ] El giro es continuo mientras se mantiene la tecla, nulo con el coche parado y máximo (240 px/s) desde 120 km/h.
- [ ] KM/H en el HUD se actualiza en pasos de 10 y FUEL baja 1.5 por segundo, sin eventos por frame.
- [ ] Cada 100 px recorridos suman 10 puntos; adelantar un coche suma 50 una sola vez.
- [ ] A los 5000, 10000, 15000 y 20000 px de cada etapa aparece un coche de combustible parpadeante; tocarlo suma 1000 puntos y 20 de FUEL (máx. 100).
- [ ] Chocar con un coche o salirse del asfalto resta 8 de FUEL, para el coche 1200 ms y lo reaparece centrado con 1500 ms de invulnerabilidad al tráfico.
- [ ] La carretera cambia de ancho y centro según la tabla de 4 etapas, con transiciones suaves de 600 px; la etapa 4 termina con 160 px de ancho.
- [ ] Al cruzar la meta (24000 px) se suman 2000 × nivel puntos y 30 de FUEL, sube el nivel y se limpia el tráfico; tras la etapa 4 el nivel 5 usa el trazado de la etapa 1 con `spawnGap` 280.
- [ ] `weaver` aparece desde nivel 2 y se acerca al jugador; `truck` (34×76) desde nivel 3.
- [ ] Con FUEL en 0 se emite `onStat("fuel", 0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto; no se muestra HUD de vidas.
- [ ] Pausa (botón y `P`) congela tráfico, distancia y combustible; reanudar sin salto de tiempo ni tecla pegada.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`) no mueve el coche.
- [ ] Guardar inserta en `scores` con `game_id = 'road-fighter'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/road-fighter` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, FUEL 100, nivel 1, 0 km/h, sin tráfico, etapa 1 desde el inicio).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/road-fighter/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` reflejan el nuevo juego y su migración.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** conducción analógica (acelerador, freno, posición lateral libre); es lo fiel al original y la diferencia central con la variante 02. **No:** carriles discretos.
- **Sí:** combustible como único límite y sin vidas; el choque castiga con combustible y tiempo perdido. **No:** `initialLives` (el HUD de vidas no aplica).
- **Sí:** 4 etapas con tabla fija de tramos que se repite con más tráfico; da progresión legible y nivel infinito para el leaderboard.
- **Sí:** stats `FUEL` y `KM/H`; son las dos lecturas que el jugador necesita sin HUD nativo. `KM/H` en pasos de 10 para no saturar React.
- **Sí:** puntos por distancia, adelantamiento, combustible y etapa; premian ir rápido y arriesgar.
- **Sí:** tipos `sedan`, `weaver` y `truck` desbloqueados por nivel; **No:** manchas de aceite, derrapes ni marchas (alcance de un motor).
- **Sí:** valores de balance (aceleraciones, velocidades, consumo, tramos, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas vertical 480×640 (el scroll es vertical como en el original).
- **Sí:** `cat` ARCADE y color cian; **Sí:** `.cover-road-fighter` nueva.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dibujar la carretera por franjas de 8 px con `roadAt` cada frame cuesta CPU.           | 80 llamadas puras por frame (640/8); medir en el paso 6 y, si hace falta, cachear por franja en un spec de perf. |
| Coches nacen pegados a un borde en curva y el hueco es imposible.                      | `x` dentro de `[left + 10, right − 10 − w]` a la altura de aparición; reintentos y descarte si se solapan.      |
| Partida infinita si el jugador recoge todos los combustibles.                          | 4 recargas × 20 + 30 por etapa < consumo con choques; el tráfico se densifica por nivel. Ajustar solo en spec.  |
| Emitir `KM/H` o `FUEL` por frame satura React.                                         | Emitir solo al cambiar `Math.round(kmh/10)×10` y `Math.ceil(fuel)`.                                              |
| `dt` grande tras pausar o cambiar de pestaña hace saltar la distancia o un choque.     | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                            |
| Tecla de dirección "pegada" tras perder foco.                                          | `blur` y `pause` ponen todas las `keys` a `false`.                                                              |
| Flechas o `WASD` interfieren con el input del modal.                                   | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                            |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                          |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"road-fighter"` entre comillas; carpeta `lib/games/road-fighter/`; migración con `_` en el nombre.        |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                 |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Marchas, derrapes, manchas de aceite, camiones agresivos, bifurcaciones del trazado.
- Vidas, nitro, combos y power-ups distintos del combustible.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o de etapa.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
