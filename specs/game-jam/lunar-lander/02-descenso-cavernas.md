# SPEC GJ-lunar-lander-02 — Juego real: LUNAR LANDER (variante: descenso por cavernas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-27
> **Variant:** 02 de 2 — Descenso vertical con scroll por una caverna que se estrecha: módulo sin rotación con motor principal y propulsores laterales, 1 vida, celdas de combustible y estaciones donde hay que aterrizar para seguir bajando, con bonus de tiempo.
> **Objective:** Crear un motor TypeScript de Lunar Lander (descenso por cavernas) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/lunar-lander` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Lunar Lander. Reinterpreta el clásico como **descenso continuo**: el módulo **no rota**; tiene un **motor principal** (frena la caída) y **propulsores laterales** (se desplaza a izquierda/derecha). La cámara sigue a la nave hacia abajo por una **caverna procedural** cuyas paredes se estrechan con la profundidad. Cada **1600 px** hay una **estación**: un suelo que cierra la caverna con una plataforma de 80 px; hay que **aterrizar** en ella para que el suelo se abra y continuar. Una sola vida: tocar pared, tocar el suelo fuera de la plataforma o llegar demasiado rápido termina la partida. Se distingue de la variante 01 (pantalla fija, rotación + empuje, 3 naves, plataformas multiplicadoras y gravedad por terreno): aquí el reto es **navegar un pasillo estrecho con inercia y gestionar velocidad vertical en tiempo real**, con puntos por profundidad y por rapidez.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con polígonos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-lunar-lander`.

Decisiones fijadas por el agente (no se reabren): `id` `lunar-lander`, título `LUNAR LANDER`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 y `missile-command` = 6 está reservado por su game jam), dificultad 4, tags `GRAVEDAD` y `CAVERNAS`, 1 jugador, teclado. Canvas **480×640** (3:4, vertical). **1 vida** (`initialLives: 1`), **nivel** = número de estación (sección) en curso (`showLevel: true`), stats extra `COMBUSTIBLE` y `PROFUNDIDAD`. Sin sonido, sin imágenes. Se dibuja un **instrumental nativo** pequeño en el canvas (VX, VY, T) porque es imprescindible para aterrizar; no es un overlay.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/lunar-lander/engine.ts`: sin globals de módulo; exporta `lunarLanderDef: GameEngineDef` con `createLunarLander(canvas, events) → GameController`.
- Módulo `lib/games/lunar-lander/cave.ts`: funciones puras `generateSection(s, prevNode, rng = Math.random) → { nodes: { y, left, right }[], padX0, cells: { x, y }[] }`, `wallsAt(nodes, y) → { left, right }` (interpolación lineal entre nodos) y `sectionConfig(s) → { minW, gravity }`. Constantes `NODE_DY`, `SECTION_H`, `PAD_W`, `FLOOR_H`.
- Módulo `lib/games/lunar-lander/draw.ts`: `drawBackground` (polvo con parallax), `drawCave`, `drawFloor` (con plataforma), `drawFuelCell`, `drawLander` (con llamas de motor principal y laterales), `drawExplosion`, `drawInstruments`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"lunar-lander"` en `lib/games/registry.ts`.
- Clase `.cover-lunar-lander` en `app/globals.css`: fondo `linear-gradient(180deg,#05000a,#1a0820)`, `::before` y `::after` con paredes de caverna magenta en zigzag (`clip-path: polygon(...)` sobre `#ff2bd633` con borde `#ff2bd6`) a izquierda y derecha, y una franja verde `#39ff14` abajo (plataforma).
- Migración `add_game_lunar_lander`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **1 vida** (baja a 0 al morir), **nivel** (estación) y stats extra `fuel` ("COMBUSTIBLE", `int`) y `depth` ("PROFUNDIDAD", `int`, metros).
- HUD nativo en el canvas: solo el instrumental (esquina superior derecha). Sin textos de "ESTACIÓN", "CRASH", pausa ni game over.
- Controles: `↑` o `Espacio` motor principal; `←`/`→` propulsores laterales. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'lunar-lander'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `lunar-lander`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Rotación de la nave, enemigos, obstáculos móviles, semillas compartidas o caverna fija diaria.
- Varias vidas, checkpoints con reaparición o selector de dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('lunar-lander', 'LUNAR LANDER', 'Desciende por la caverna sin rozar las paredes.',
       'Frena la caída con la flecha arriba o Espacio y desplázate con los propulsores laterales (flechas izquierda y derecha). La caverna se estrecha a medida que bajas y cada estación cierra el paso: aterriza suave sobre la plataforma verde para abrir el suelo y seguir. Recoge celdas de combustible, baja rápido para sumar bonus de tiempo y no toques las paredes: solo tienes una nave.',
       'ARCADE', 'magenta', 'cover-lunar-lander', 1, 1, '{keyboard}', '{GRAVEDAD,CAVERNAS}', 4, 7, false);

Definición del motor:

    export const lunarLanderDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "fuel", label: "COMBUSTIBLE", color: "yellow", format: "int" },
        { key: "depth", label: "PROFUNDIDAD", color: "cyan", format: "int" },
      ],
      create: createLunarLander,
    };

Estado interno (dentro de `createLunarLander`): `ship { x, y, vx, vy }` (coordenadas de mundo; `y` crece hacia abajo), `thrust { main, left, right }: boolean`, `keysDown: Set<string>`, `section` (estación en curso, desde 1), `nodes` (nodos de la sección en curso y la siguiente; los anteriores se descartan), `floorY`, `floorOpen: boolean`, `padX0`, `cells: { x, y, taken }[]`, `camY`, `dust: { x, y, r }[]` (generado una vez por instancia), `fuel`, `lastFuelEmitted`, `maxDepth`, `lastDepthEmitted`, `sectionMs`, `phase: "flying" | "landed" | "crashed"`, `phaseMs`, `explosion { x, y, age } | null`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("fuel", n)` y `onStat("depth", m)`. El combustible se emite como `Math.floor(fuel / 10) * 10` y la profundidad como `Math.floor(maxDepth / 100) * 10` metros (pasos de 10 m), solo cuando ese valor cambia. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("fuel", 1000)` y `onStat("depth", 0)` (oculta el stat hasta los primeros 10 m).
- `onStat(key, 0)` oculta el stat en el HUD (contrato de `onStat`); es el comportamiento esperado con combustible 0 o profundidad < 10 m.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Todas las teclas de juego usan `keysDown` (acción continua mientras se mantienen); `e.repeat` no añade nada.
- Pausa/blur/destroy vacían `keysDown` y apagan `thrust`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` no emite eventos.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, estación, choque ni game over dentro del canvas.

**Reglas del juego:**

- **Mundo:** ancho 480 px; profundidad ilimitada. Sección `s` ocupa `y ∈ [(s − 1) × 1600, s × 1600]` (`SECTION_H = 1600`). Nodos de pared cada **40 px** de `y` (`NODE_DY = 40`, 41 nodos por sección compartiendo el borde).
- **Caverna** (`generateSection`), con `minW(s) = max(120, 260 − 20 × (s − 1))`:
  - Primeros 4 tramos de la sección (160 px): ancho 280, centro 240 (en la sección 1, ancho 300 para la salida).
  - Últimos 4 tramos antes del suelo (160 px): ancho **280**, centro **240** (izquierda 100, derecha 380).
  - Nodos intermedios: centro `c_{k+1} = clamp(c_k + rand(−30, 30), w/2 + 20, 460 − w/2)` y ancho `w = rand(minW, minW + 80)` por nodo. Entre nodos la pared es un segmento recto.
- **Estación:** suelo en `floorY = s × 1600`, banda de **16 px** de alto de pared a pared. Plataforma de **80 px** (`PAD_W`) con `padX0` aleatorio en `[120, 280]`. Con `floorOpen` el suelo no existe.
- **Celdas de combustible:** 2 por sección, en `y` aleatoria dentro de `[sectionTop + 300, sectionTop + 1300]` con al menos 300 px entre ellas; `x = centro de la caverna en esa y + rand(−(w/2 − 30), w/2 − 30)`. Radio **10 px**. Se recogen si la distancia al centro de la nave es `≤ 19`: **+200** combustible (tope 1000) y **+50** puntos.
- **Nave:** caja de **18×18 px** centrada en `(x, y)` más 2 patas de 4 px bajo la base (contacto inferior en `y + 13`). Salida: `x = 240`, `y = 80`, `vx = vy = 0`, combustible **1000**.
- **Física por frame (s = dt/1000):**
  - Gravedad de la sección: `min(30 + 3 × (s − 1), 60)` px/s² hacia abajo.
  - Motor principal (`↑` o `Espacio`, si `fuel > 0`): **75 px/s²** hacia arriba; consume **20 unidades/s**.
  - Propulsor lateral (`←` / `→`, si `fuel > 0`): **45 px/s²** hacia izquierda/derecha; consume **8 unidades/s** cada uno (pulsar ambos consume ambos y se anulan).
  - Sin rozamiento. `vx ∈ [−160, 160]`, `vy ∈ [−160, 220]` (se recorta).
  - Techo: la nave no sube por encima de `sectionTop + 20`; si lo hace se fija ahí y, si `vy < 0`, `vy = 0`.
- **Cámara:** `camY = max(sectionTop, ship.y − 200)`; se dibuja todo con `screenY = worldY − camY` (la nave queda a 200 px del borde superior y se ven 440 px por debajo).
- **Choque con pared:** si alguna esquina de la caja (`x ± 9`, `y ± 9`) cumple `x ≤ left` o `x ≥ right` según `wallsAt(nodes, yEsquina)` → choque.
- **Contacto con el suelo** (si `!floorOpen` y `y + 13 ≥ floorY`):
  - **Aterrizaje** si `[x − 9, x + 9] ⊂ [padX0, padX0 + 80]`, `0 ≤ vy ≤ 50` y `|vx| ≤ 25`.
  - En otro caso → choque.
- **Puntuación:**
  - Profundidad: **+10** por cada 100 px nuevos de `maxDepth` (máxima `y` alcanzada).
  - Celda de combustible: **+50**.
  - Estación `s`: `300 × s` + bonus de tiempo `max(0, 600 − 10 × floor(sectionMs / 1000))` + bonus de combustible `floor(fuel / 10)` (calculado antes de recargar).
- **Tras aterrizar:** se suma el bonus de estación, `fuel = 1000`, `phase = "landed"` durante **1200 ms** (nave quieta, llamas apagadas, teclas ignoradas); luego `floorOpen = true`, `section + 1`, `onLevel(section)`, se genera la sección siguiente, `sectionMs = 0` y la nave cae libre desde reposo. `sectionMs` solo cuenta en `phase = "flying"`.
- **Choque:** `phase = "crashed"`, `onLives(0)` en el mismo frame, explosión (anillo y 12 fragmentos) de **1200 ms** y después `onGameOver(score)`.
- **Combustible 0:** sin empuje ni llamas; la partida sigue hasta el choque (no hay game over por combustible solo).
- **Instrumental nativo** (esquina superior derecha, fuente monoespaciada 14 px, 3 líneas): `VX`, `VY` (enteros, `VY` positivo = cayendo) y `T` (segundos enteros de la sección). `VX` y `VY` en verde `#39ff14` si cumplen el umbral de aterrizaje y en rojo `#ff3355` si no; `T` en amarillo `#ffe600` mientras el bonus de tiempo sea > 0 y gris `#666` cuando llega a 0.
- **Dibujo:** fondo `#05000a` con 60 motas de polvo `#ffffff` (alfa 0.15–0.4) que se desplazan a 0.5× la cámara (parallax, envuelven en vertical). Roca de las paredes `#1a0820` con borde `#ff2bd6` de 2 px. Suelo de estación `#333344` con plataforma `#39ff14` de 4 px de grosor y 2 balizas que parpadean a 2 Hz en sus extremos. Celdas de combustible: hexágono `#ffe600` con brillo radial. Nave: caja contorno `#ffffff` de 2 px con ventana `#00f5ff` y patas; llama principal bajo la nave (gradiente `#ffe600` → `#ff2bd6`, 12–20 px con parpadeo) y llamas laterales de 6–10 px en el lado opuesto al desplazamiento. Explosión: anillo `#ff2bd6` hasta 40 px y fragmentos `#ffffff` a 120 px/s con alfa decreciente.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-lunar-lander` en `app/globals.css`. Aplicar migración `add_game_lunar_lander` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'lunar-lander'` muestra la fila; `npm run build`.
2. Crear `lib/games/lunar-lander/cave.ts`. Verificar: `npm run lint`; `sectionConfig(1)` da `minW` 260 y gravedad 30; `sectionConfig(8)` da 120 y 51; `sectionConfig(12)` da 120 y 60; una sección generada tiene 41 nodos con paredes dentro de `[20, 460]`, los últimos 4 tramos de ancho 280 centrados y 2 celdas separadas ≥ 300 px.
3. Crear `lib/games/lunar-lander/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/lunar-lander/engine.ts` y exportar `lunarLanderDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"lunar-lander"` en `lib/games/registry.ts`. Verificar: `/games/lunar-lander/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): motor principal y laterales (llamas y consumo), scroll de cámara, puntos por profundidad, recoger celda, instrumental verde/rojo, aterrizar en la estación 1 (bonus, recarga, suelo abierto, nivel 2), choque con pared, choque con suelo fuera de plataforma y por velocidad, caer sin combustible, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'lunar-lander'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `lunar-lander` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; ambas migraciones registradas en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-lunar-lander`), la ficha `/games/lunar-lander` y el home muestran el juego desde la BD (1 jugador, teclado, tags `GRAVEDAD`/`CAVERNAS`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/lunar-lander/jugar` muestra el canvas vertical 3:4 sin desborde a 375 px y 1280 px.
- [ ] La nave sale en (240, 80) en reposo con 1000 de combustible y empieza a caer a 30 px/s².
- [ ] `↑` y `Espacio` aceleran hacia arriba a 75 px/s² consumiendo 20/s; `←`/`→` aceleran a 45 px/s² consumiendo 8/s; flechas y `Espacio` no hacen scroll de la página.
- [ ] COMBUSTIBLE baja en pasos de 10; con 0 no hay empuje ni llamas y el stat se oculta.
- [ ] La cámara sigue a la nave (200 px bajo el borde superior) y nunca muestra por encima del inicio de la sección.
- [ ] PROFUNDIDAD sube de 10 en 10 m y cada 100 px nuevos de profundidad suman 10 puntos; volver a subir no suma.
- [ ] Recoger una celda suma 50 puntos y 200 de combustible (tope 1000) y la celda desaparece.
- [ ] Tocar una pared con cualquier esquina de la nave es choque.
- [ ] Posarse sobre la plataforma verde completa dentro de ella, con `vy ≤ 50` y `|vx| ≤ 25`, aterriza: suma `300 × estación` + bonus de tiempo (`600 − 10 × segundos de la sección`, mín. 0) + `combustible / 10`, recarga a 1000 y a los 1200 ms el suelo se abre y el nivel del HUD sube.
- [ ] Tocar el suelo fuera de la plataforma o por encima de los umbrales es choque.
- [ ] El ancho mínimo de la caverna baja 20 px por estación hasta 120 y la gravedad sube 3 px/s² por estación hasta 60.
- [ ] El instrumental muestra VX, VY y T; VX/VY en verde dentro de los umbrales y en rojo fuera; T amarillo mientras hay bonus de tiempo.
- [ ] Un choque emite `onLives(0)` y, tras la explosión de 1200 ms, `onGameOver` abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (1 → 0), nivel (estación), COMBUSTIBLE y PROFUNDIDAD; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela nave, cámara, física, consumo, temporizador de sección y explosión; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, espacio) no mueve la nave.
- [ ] Guardar inserta en `scores` con `game_id = 'lunar-lander'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/lunar-lander` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 1 vida, nivel 1, combustible 1000, profundidad 0, caverna nueva, nave en la salida).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/lunar-lander/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** nave sin rotación con motor principal + laterales (control directo, adecuado a pasillos); **No:** rotación (eso es la variante 01).
- **Sí:** aterrizaje obligatorio en cada estación (conserva el núcleo de Lunar Lander dentro del descenso); **No:** descenso infinito sin aterrizar.
- **Sí:** 1 vida (`initialLives: 1`) para partidas cortas y puntaje claro; **No:** reapariciones ni checkpoints.
- **Sí:** el combustible 0 no termina la partida por sí solo (la caída termina en choque o en un aterrizaje afortunado que recarga).
- **Sí:** bonus de tiempo por estación y puntos por profundidad nueva (premia bajar rápido, castiga el exceso de velocidad con el choque); **No:** puntos por volver a bajar zonas ya recorridas.
- **Sí:** últimos 160 px de cada sección rectos y anchos (280 px) para que la plataforma sea siempre alcanzable.
- **Sí:** instrumental nativo en canvas (VX/VY/T); **No:** overlays de estado.
- **Sí:** stats emitidos en pasos (combustible de 10 en 10, profundidad de 10 en 10 m) para respetar "solo al cambiar".
- **Sí:** valores de balance (gravedad, empujes, consumos, anchos, bonus, umbrales) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta; canvas vertical 480×640 (el eje de juego es vertical); `.cover-lunar-lander` nueva.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                          | Mitigation                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| La generación produce tramos imposibles (pared que cruza la nave en diagonal). | Cambio de centro ≤ 30 px por nodo de 40 px, ancho mínimo 120 (> 6× la nave) y paredes dentro de `[20, 460]`; verificar en paso 2. |
| Colisión con pared atraviesa segmentos con `dt` alto.                          | `dt` capado a 50 ms (máx. 11 px por frame a 220 px/s, menor que la caja de 18 px).                                           |
| La plataforma queda inalcanzable o tapada por la pared.                        | Últimos 4 tramos rectos de 280 px y `padX0 ∈ [120, 280]` (siempre dentro de `[100, 380]`).                                 |
| Emitir `onStat`/`onScore` por frame satura React.                              | Combustible y profundidad emitidos por pasos; puntos de profundidad cada 100 px.                                            |
| Memoria creciente por nodos de secciones pasadas.                              | Mantener solo la sección en curso y la siguiente; descartar al abrir el suelo.                                              |
| Flechas o espacio interfieren con el input del modal.                          | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                        |
| Tecla de empuje "pegada" tras perder foco.                                     | `blur` y `pause` vacían `keysDown` y apagan `thrust`.                                                                       |
| Doble loop / listeners por StrictMode.                                         | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                      |
| Canvas vertical 3:4 desborda en escritorio bajo.                               | `GamePlayer` fija `--game-ar` desde `width/height`; verificar 375 y 1280 px en el criterio de aceptación.                   |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.             | Clave `"lunar-lander"` entre comillas; carpeta `lib/games/lunar-lander/`; migración con `_` en el nombre.                   |
| Next 16 difiere del conocimiento previo.                                       | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Rotación de la nave, enemigos y obstáculos móviles.
- Varias vidas, checkpoints y selector de dificultad.
- Caverna con semilla fija o desafío diario.
- Overlays de pausa/estación/choque/game over dentro del canvas.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
