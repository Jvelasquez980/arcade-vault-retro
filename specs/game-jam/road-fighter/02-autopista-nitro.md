# SPEC GJ-road-fighter-02 — Juego real: ROAD FIGHTER (variante: autopista nitro) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-22
> **Variant:** 02 de 2 — Moderno de alto riesgo: 4 carriles discretos, velocidad automática que sube por nivel, nitro que duplica puntos a cambio de quemar combustible, 3 vidas y combos por adelantar rozando.
> **Objective:** Crear un motor TypeScript de Road Fighter (variante autopista nitro) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/road-fighter` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Road Fighter. Reinterpreta el clásico como arcade de reflejos: el coche **no se conduce libremente**, salta entre **4 carriles** (una pulsación = un carril, deslizamiento de 100 ms) y la **velocidad es automática** y crece con el nivel. La decisión del jugador es de **riesgo/recompensa**: mantener `Espacio` activa el **nitro** (×1,5 velocidad, ×2 puntos, ×3 consumo) y **adelantar rozando** (coche en el carril contiguo) encadena un **combo** que multiplica los puntos. El combustible sigue siendo central: se gasta continuamente y se recarga con **bidones** en la calzada. Hay **3 vidas**; la partida termina al perderlas o al vaciarse el depósito. Se distingue de la variante 01 (clásico: acelerador/freno, movimiento libre, pista que se estrecha, sin vidas, etapas con meta).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-road-fighter`.

Decisiones fijadas por el agente (no se reabren): `id` `road-fighter`, título `ROAD FIGHTER`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 está implementado y `missile-command` reserva 6 en sus specs propuestos), dificultad 4, tags `CARRERAS` y `NITRO`, 1 jugador, teclado. Canvas **400×640** (5:8, vertical). **3 vidas** (`initialLives: 3`), **nivel** cada 1500 m (`showLevel: true`), stats extra `COMBUSTIBLE` y `COMBO`. Escala fija **1 m = 4 px**. Estética de autopista nocturna neón. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/road-fighter/engine.ts`: sin globals de módulo; exporta `roadFighterDef: GameEngineDef` con `createRoadFighter(canvas, events) → GameController`.
- Módulo `lib/games/road-fighter/balance.ts`: funciones puras y constantes (`LANES_X`, `baseKmh(level)`, `spawnGapM(level)`, `canGapM(level)`, `doubleSpawnChance(level)`, `nearMissPoints(combo, mult)`, `drainPerSec(nitro)`).
- Módulo `lib/games/road-fighter/draw.ts`: `drawBackground` (noche, luces laterales), `drawRoad` (asfalto, bordes neón, divisiones de carril), `drawCar` (con intermitente), `drawPlayer` (llama de nitro), `drawCan`, `drawSpeedLines` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"road-fighter"` en `lib/games/registry.ts`.
- Clase `.cover-road-fighter` en `app/globals.css`: fondo `linear-gradient(180deg,#07001a,#1a0030)` con `::after` de calzada en perspectiva (trapecio `clip-path` `#141428` con bordes `#ff2bd6`) y `::before` de tres estelas de velocidad cyan `#00f5ff` (`repeating-linear-gradient`).
- Migración `add_game_road_fighter`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **400×640**.
- HUD de React: puntaje, **3 vidas**, **nivel**, stats extra `fuel` ("COMBUSTIBLE", `int`, yellow) y `combo` ("COMBO", `int`, magenta).
- Sin HUD nativo de texto en el canvas salvo la etiqueta efímera `+N` sobre un roce (efecto de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` cambian de carril (una pulsación = un carril), `Espacio` o `↑`/`W` (mantener) nitro, `↓`/`S` (mantener) freno. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'road-fighter'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `road-fighter`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Movimiento lateral libre, acelerador analógico, estrechamientos o curvas de pista, metas de etapa.
- Power-ups distintos del bidón (escudos, imanes), rivales que embisten, vidas extra.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('road-fighter', 'ROAD FIGHTER', 'Esquiva el tráfico a fondo y con el nitro encendido.',
       'Cambia de carril con las flechas o A/D en una autopista de cuatro carriles que va cada vez más rápido. Mantén Espacio para el nitro: corres más y puntúas el doble, pero quemas el triple de gasolina. Adelanta rozando por el carril de al lado para encadenar combos y recoge bidones para no quedarte seco. Tres choques o el depósito vacío terminan la partida.',
       'ARCADE', 'magenta', 'cover-road-fighter', 1, 1, '{keyboard}', '{CARRERAS,NITRO}', 4, 7, false);

Definición del motor:

    export const roadFighterDef: GameEngineDef = {
      width: 400, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "fuel", label: "COMBUSTIBLE", color: "yellow", format: "int" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createRoadFighter,
    };

Estado interno (dentro de `createRoadFighter`): `lane` (0–3), `x` (px, interpolado), `slideFrom`, `slideMs`, `queuedLane | null`, `kmh`, `nitro`, `brake` (teclas mantenidas), `fuel`, `lives`, `level`, `totalM`, `pointM`, `spawnM`, `canM`, `cars: { lane, x, y, kmh, color, passed, changer: { at, blinkMs, slideMs, toLane } | null }[]`, `cans: { lane, y }[]`, `labels: { text, x, y, ms }[]`, `combo`, `comboMs`, `invulnMs`, `score`, `lastFuelEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("fuel", n)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("fuel", 100)`, `onStat("combo", 0)`.
- `onStat("fuel", n)` con `n = Math.ceil(fuel)`, solo cuando `n` cambia. `onStat("combo", n)` solo cuando `combo` cambia; valor 0 oculta el stat (contrato de `onStat`), esperado sin combo activo.
- Game over (por vidas o por combustible): `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El cambio de carril ignora `e.repeat` (un carril por pulsación); nitro y freno son de mantener.
- Pausa/blur/destroy ponen `nitro = brake = false` y vacían `queuedLane`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escala y scroll:** 1 m = 4 px. La calzada se desplaza hacia abajo a `kmh × 1.2` px/s. Metros por frame = `kmh × 1.2 × dt / 4`.
- **Calzada:** `x` de 60 a 340 (280 px), 4 carriles de 70 px con centros `LANES_X` = [95, 165, 235, 305]. Fuera de la calzada no se puede circular (no hay choque con bordes: el carril se limita a 0–3).
- **Jugador:** 26×44 px, centro vertical fijo en `y = 540`. Empieza en el carril 1 (`x = 165`), `kmh = baseKmh(1)`, `fuel = 100`, `lives = 3`, `level = 1`.
- **Cambio de carril:** `←`/`A` resta 1 y `→`/`D` suma 1 al carril (limitado a 0–3). El coche se desliza al nuevo centro en **100 ms** (interpolación lineal de `x`). Una pulsación durante el deslizamiento se encola (máx. 1) y se ejecuta al terminar. Para colisiones y roces cuenta el carril destino desde el inicio del deslizamiento.
- **Velocidad automática:** `baseKmh(level) = min(200 + 20 × (level − 1), 360)`. Objetivo: `base × 1.5` con nitro (`Espacio`/`↑`/`W`), `base × 0.6` con freno (`↓`/`S`; si se pulsan ambos, gana el freno), `base` sin ninguno. `kmh` se acerca al objetivo a **200 km/h/s**.
- **Multiplicador:** `mult = 2` mientras el nitro está pulsado (y no el freno), si no `mult = 1`. Se aplica a todos los puntos en el momento de ganarlos.
- **Nivel:** sube cada **1500 m** de `totalM` → `onLevel(level)` y +**200 × level** puntos (× `mult`).
- **Combustible:** empieza en 100 (tope 100); baja **2/s** sin nitro y **6/s** con nitro activo. Al llegar a 0 → `lives = 0` → `onLives(0)` y `onGameOver(score)`.
- **Bidones:** 20×24 px, verde `#39ff14`; uno cada `canGapM(level) = 600 + 100 × (level − 1)` m (`canM`) en un carril al azar sin coche a menos de 120 px en vertical del punto `y = −40`. Están quietos sobre la calzada (bajan a la velocidad del jugador). Tocarlo (mismo carril y solape vertical): +**25** combustible (tope 100) y +**100** × `mult` puntos.
- **Tráfico:** coches de 26×44 px con velocidad propia entera aleatoria en **[110, 170] km/h** y color aleatorio entre `#ff3355`, `#ffe600` y `#00ff88`; en pantalla `vy = (kmhJugador − kmhCoche) × 1.2` px/s (con freno los más rápidos se alejan hacia arriba). Se eliminan con `y < −150` o `y > 720`.
- **Aparición:** cada `spawnGapM(level) = max(18, 45 − 3 × (level − 1))` m nace 1 coche en `y = −60`; con probabilidad `doubleSpawnChance(level) = min(0.1 × (level − 1), 0.4)` nacen 2 en carriles distintos. Regla de seguridad: un carril es elegible solo si no tiene coche a menos de 110 px en vertical de `y = −60`, y nunca puede quedar ocupado el 4.º carril en la franja `y ∈ [−260, 140]` (si eso pasaría, ese coche no nace). Los coches siempre nacen arriba.
- **Coches que cambian de carril:** desde nivel 3, cada coche nuevo lo es con probabilidad **0.2**. Al alcanzar `y = 220`, si un carril contiguo (al azar entre los válidos) no tiene coche a menos de 110 px en vertical, parpadea su intermitente `#ffaa00` del lado de destino durante **500 ms** y luego se desliza al carril en **400 ms**; una sola vez. Si no hay carril válido, no cambia.
- **Puntos por distancia:** +**1** × `mult` por cada 10 m.
- **Adelantar y roce:** cuando el centro de un coche pasa de `y < 540` a `y ≥ 540` (una vez por coche, `passed`): si su carril (el más cercano a su `x`) difiere en exactamente 1 del carril del jugador y el jugador no es invulnerable → **roce**: `combo = min(combo + 1, 10)`, +`25 × combo × mult` puntos, `comboMs = 3000` y etiqueta `+N` blanca sobre el coche 600 ms. En otro caso: +**10** × `mult`.
- **Fin de combo:** `comboMs` baja con `dt`; al llegar a 0, `combo = 0`.
- **Choque** (mismo carril y solape AABB reducido 3 px por lado, sin invulnerabilidad): `lives −= 1` → `onLives(lives)`; si `lives = 0` → `onGameOver(score)`. Si no: el coche chocado se elimina, `combo = 0`, `kmh = base × 0.5` al instante, **1500 ms** de invulnerabilidad (el jugador parpadea cada 100 ms y atraviesa coches; los bidones sí se recogen).
- **Tiempo:** todo avanza con `dt` solo en juego (no en pausa ni tras game over).
- **Dibujo:** fondo `#07001a` con farolas laterales (puntos `#ffe600` cada 160 px que se desplazan con la calzada); asfalto `#141428`; bordes de calzada de 4 px `#ff2bd6` con brillo (`shadowBlur` 8); divisiones de carril discontinuas `#3a3a6a` 4×28 px con hueco de 28 px. Jugador `#00f5ff` con parabrisas `#07001a`; con nitro, llama de 2 triángulos (`#ff8800` exterior 18 px, `#00f5ff` interior 10 px) bajo el coche y 6 líneas de velocidad blancas `rgba(255,255,255,0.25)` en los laterales. Coches de tráfico con luces traseras `#ff0000`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-road-fighter` en `app/globals.css`. Aplicar migración `add_game_road_fighter` con `published = false` (`mcp__supabase__apply_migration`) y anotarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'road-fighter'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/road-fighter/balance.ts`. Verificar: `npm run lint`; `baseKmh(1) = 200`, `baseKmh(9) = 360`, `baseKmh(20) = 360`; `spawnGapM(1) = 45`, `spawnGapM(20) = 18`; `doubleSpawnChance(1) = 0`, `doubleSpawnChance(10) = 0.4`; `nearMissPoints(3, 2) = 150`; `canGapM(1) = 600`, `canGapM(9) = 1400`; `drainPerSec(true) = 6`.
3. Crear `lib/games/road-fighter/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/road-fighter/engine.ts` y exportar `roadFighterDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"road-fighter"` en `lib/games/registry.ts`. Verificar: `/games/road-fighter/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cambiar de carril (incluida pulsación encolada y topes 0/3), nitro (llama, puntos dobles, consumo 6/s), freno, roces encadenados hasta combo 10 y su caída a los 3 s, recoger bidones (cada 600 m en nivel 1), subida de nivel a 1500 m, coches que cambian de carril desde nivel 3, chocar 3 veces, agotar el combustible con nitro, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'road-fighter'` (anotar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `road-fighter` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-road-fighter`), la ficha `/games/road-fighter` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CARRERAS`/`NITRO`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/road-fighter/jugar` muestra el canvas 5:8 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza en el carril 1 a 200 km/h con 3 vidas, nivel 1, COMBUSTIBLE 100 y COMBO oculto.
- [ ] `←`/`→` y `A`/`D` mueven exactamente un carril por pulsación con deslizamiento de 100 ms; mantener pulsado no repite; no se sale de los carriles 0–3; las flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio`/`↑`/`W` sube a `base × 1.5`, duplica todos los puntos y gasta 6 de combustible/s (2/s sin nitro); `↓`/`S` baja a `base × 0.6`.
- [ ] La velocidad base sube 20 km/h por nivel hasta 360; el nivel sube cada 1500 m sumando 200 × nivel.
- [ ] Adelantar un coche suma 10; adelantarlo por el carril contiguo es roce: combo +1 (tope 10), suma 25 × combo y muestra `+N`; sin otro roce en 3 s el combo vuelve a 0 y COMBO se oculta.
- [ ] Un bidón aparece cada 600 m en nivel 1 (+100 m por nivel); tocarlo suma 25 de combustible (tope 100) y 100 puntos (× mult).
- [ ] Nunca nacen coches que bloqueen los 4 carriles a la vez en la franja superior.
- [ ] Desde nivel 3, algunos coches parpadean el intermitente 500 ms y cambian de carril en 400 ms, una sola vez.
- [ ] Un choque resta 1 vida en el HUD, reinicia el combo, baja a `base × 0.5` y da 1,5 s de invulnerabilidad con parpadeo.
- [ ] El 3.er choque o el combustible en 0 emiten `onLives(0)` y luego `onGameOver`, y abren el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, COMBUSTIBLE y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela calzada, tráfico, combustible, combo e invulnerabilidad; reanudar sin salto de tiempo ni nitro "pegado".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, espacio, `W`, `A`, `S`, `D`) no mueve el coche.
- [ ] Guardar inserta en `scores` con `game_id = 'road-fighter'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/road-fighter` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, COMBUSTIBLE 100, combo 0, carril 1, sin tráfico ni bidones).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/road-fighter/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración figura en `references/production/prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** 4 carriles discretos con un carril por pulsación; colisiones y roces por carril, simples y legibles. **No:** movimiento libre (es la variante 01).
- **Sí:** velocidad automática con nitro/freno como modificadores; la decisión es de riesgo, no de manejo del acelerador.
- **Sí:** nitro = ×2 puntos y ×3 consumo; enlaza el combustible con la puntuación y abre el rango del leaderboard.
- **Sí:** combo por roce (tope 10, ventana 3 s); premia el riesgo controlado. **No:** combos por distancia o por tiempo sin chocar.
- **Sí:** 3 vidas y además game over por combustible; un error no termina la partida, pero el depósito sigue mandando. El game over por combustible emite `onLives(0)` para respetar el orden de la convención.
- **Sí:** regla de seguridad que deja siempre un carril libre; evita muertes inevitables.
- **Sí:** stats `COMBUSTIBLE` y `COMBO`; **No:** stat de velocidad (es automática y no aporta decisión).
- **Sí:** valores de balance (velocidades, huecos, consumo, puntos, combo) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta (estética de autopista neón); **Sí:** `.cover-road-fighter` nueva.
- **Sí:** canvas 400×640 vertical; 4 carriles de 70 px dejan arcén para farolas y líneas de velocidad.
- **Sí:** `sort_order` 7, saltando el 6 que reservan los specs propuestos de `missile-command`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                       | Mitigation                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Muertes inevitables por un muro de 4 coches o un cambio de carril encima del jugador.      | Regla de los 4 carriles en la franja superior; el cambio de carril se decide en `y = 220` con 500 ms de aviso. |
| Nitro permanente rompe el balance (puntos dobles sin coste real).                          | Consumo 6/s vacía el depósito en ~17 s; con bidones cada `600 + 100 × (nivel − 1)` m el nitro continuo recupera como máximo ~3,8/s en nivel 1 y ~2,9/s en nivel 9.          |
| Roce contado dos veces o al estar invulnerable.                                            | Bandera `passed` por coche; el roce exige jugador no invulnerable.                                             |
| Emitir `onStat("fuel")` por frame satura React.                                            | Emitir solo cuando cambia `Math.ceil(fuel)`.                                                                   |
| `dt` grande tras pausar o cambiar de pestaña hace atravesar coches a 540 km/h.             | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms (máx. 32 px por frame, menor que 44 px).   |
| Flechas, espacio o `W/A/S/D` interfieren con el input del modal.                           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                           |
| Nitro "pegado" tras perder foco.                                                           | `blur` y `pause` ponen `nitro`/`brake` a `false` y vacían `queuedLane`.                                        |
| Doble loop / listeners por StrictMode.                                                     | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                         |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                         | Clave `"road-fighter"` entre comillas; carpeta `lib/games/road-fighter/`; migración con `_` en el nombre.       |
| Next 16 difiere del conocimiento previo.                                                   | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Movimiento lateral libre, acelerador analógico, curvas y estrechamientos, metas de etapa.
- Power-ups distintos del bidón, rivales que embisten y vidas extra.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
