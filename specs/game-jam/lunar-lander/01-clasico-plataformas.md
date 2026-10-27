# SPEC GJ-lunar-lander-01 — Juego real: LUNAR LANDER (variante: clásico de plataformas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-27
> **Variant:** 01 de 2 — Lunar Lander clásico fiel: módulo con rotación y empuje, terreno lunar de una pantalla con 3 plataformas multiplicadoras (×1, ×2, ×5), combustible compartido entre 3 naves y gravedad creciente por aterrizaje.
> **Objective:** Crear un motor TypeScript de Lunar Lander dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/lunar-lander` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Lunar Lander. Recrea el arcade de Atari (1979): el módulo **rota** con `←`/`→` y **empuja** en la dirección de su morro con `↑`; la gravedad tira hacia abajo y hay que posarse suave y recto sobre una de las **3 plataformas** del terreno, cada una con su **multiplicador** (la más estrecha vale más). El combustible es un recurso **compartido por toda la partida** que solo se recupera aterrizando bien. Cada aterrizaje genera un terreno nuevo con más gravedad. Se distingue de la variante 02 (descenso vertical por una caverna con scroll, sin rotación, propulsores laterales, 1 vida y estaciones obligatorias): aquí el reto es **controlar el ángulo** y **elegir plataforma** (riesgo/recompensa) en una sola pantalla.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con líneas, polígonos y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-lunar-lander`.

Decisiones fijadas por el agente (no se reabren): `id` `lunar-lander`, título `LUNAR LANDER`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 y `missile-command` = 6 está reservado por su game jam), dificultad 3, tags `CLÁSICO` y `GRAVEDAD`, 1 jugador, teclado. Canvas **800×600** (4:3). **3 vidas** (naves), **nivel** = número de terreno (`showLevel: true`), stat extra `COMBUSTIBLE`. Sin sonido, sin imágenes. Se dibuja un **instrumental nativo** pequeño en el canvas (ALT, VX, VY, ÁNGULO) porque es imprescindible para aterrizar; no es un overlay.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/lunar-lander/engine.ts`: sin globals de módulo; exporta `lunarLanderDef: GameEngineDef` con `createLunarLander(canvas, events) → GameController`.
- Módulo `lib/games/lunar-lander/terrain.ts`: funciones puras `generateTerrain(rng = Math.random) → { points: {x, y}[], pads: { i0, i1, y, mult }[] }`, `terrainYAt(points, x)` (interpolación lineal) y `padAt(pads, points, x)`. Constantes `SEG_W`, `TERRAIN_MIN_Y`, `TERRAIN_MAX_Y`.
- Módulo `lib/games/lunar-lander/draw.ts`: `drawSky` (estrellas fijas por instancia), `drawTerrain`, `drawPads` (con etiqueta `×N`), `drawLander` (con llama si empuja), `drawExplosion`, `drawInstruments`. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"lunar-lander"` en `lib/games/registry.ts`.
- Clase `.cover-lunar-lander` en `app/globals.css`: cielo `linear-gradient(180deg,#000814,#001d2e)`, `::before` con estrellas (`radial-gradient` repetidos de 1 px blancos) y `::after` con silueta de terreno cyan (`clip-path: polygon(...)` sobre fondo `#00f5ff33` con borde superior `#00f5ff`).
- Migración `add_game_lunar_lander`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **800×600**.
- HUD de React: puntaje, **3 vidas**, **nivel** y stat extra `fuel` ("COMBUSTIBLE", `int`).
- HUD nativo en el canvas: solo el instrumental (esquina superior derecha) y las etiquetas `×N` de las plataformas. Sin textos de "ATERRIZAJE", "CRASH", pausa ni game over.
- Controles: `←`/`→` rotan; `↑` o `Espacio` empujan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'lunar-lander'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `lunar-lander`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Zoom de cámara al acercarse al suelo y terreno más ancho que la pantalla con scroll (del arcade original).
- Selector de dificultad o modos (entrenamiento, cadete, etc.).
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('lunar-lander', 'LUNAR LANDER', 'Posa el módulo sin estrellarte.',
       'Rota el módulo con las flechas izquierda y derecha y enciende el motor con la flecha arriba o Espacio. Posa las dos patas sobre una plataforma, despacio y recto: las plataformas estrechas multiplican más los puntos. El combustible se comparte entre tus tres naves y solo se recupera aterrizando bien; cada aterrizaje trae un terreno nuevo con más gravedad.',
       'ARCADE', 'cyan', 'cover-lunar-lander', 1, 1, '{keyboard}', '{CLÁSICO,GRAVEDAD}', 3, 7, false);

Definición del motor:

    export const lunarLanderDef: GameEngineDef = {
      width: 800, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "fuel", label: "COMBUSTIBLE", color: "yellow", format: "int" }],
      create: createLunarLander,
    };

Estado interno (dentro de `createLunarLander`): `ship { x, y, vx, vy, angle }` (ángulo en radianes, 0 = morro arriba, positivo = horario), `thrusting: boolean`, `keysDown: Set<string>`, `terrain { points, pads }`, `stars: { x, y, r }[]` (generadas una vez por instancia), `fuel`, `lastFuelEmitted`, `lives`, `level`, `gravity`, `phase: "flying" | "landed" | "crashed"`, `phaseMs`, `explosion { x, y, age } | null`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("fuel", n)`. El combustible se emite redondeado hacia abajo a múltiplos de **10** (`Math.floor(fuel / 10) * 10`) y solo cuando ese valor cambia (≈2,5 eventos/s empujando). Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("fuel", 1500)`.
- `onStat("fuel", 0)` oculta el stat en el HUD (contrato de `onStat`); es el comportamiento esperado sin combustible.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Todas las teclas de juego usan `keysDown` (acción continua mientras se mantienen); `e.repeat` no añade nada.
- Pausa/blur/destroy vacían `keysDown` y apagan `thrusting`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` no emite eventos.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, aterrizaje, choque ni game over dentro del canvas.

**Reglas del juego:**

- **Terreno** (`generateTerrain`): 33 puntos con `x_i = 25 × i` (`i = 0..32`, `SEG_W = 25`). `y_0` aleatorio en `[420, 540]`; `y_{i+1} = clamp(y_i + rand(−45, 45), 330, 570)`. Se rellena hasta `y = 600` con relleno sólido.
- **Plataformas:** 3 por terreno, planas (todos sus puntos con la `y` del primero): **×1** de 4 segmentos (100 px), **×2** de 3 segmentos (75 px), **×5** de 2 segmentos (50 px). Índice inicial aleatorio en `[1, 30 − segmentos]`, sin solaparse y con al menos 2 segmentos de separación entre plataformas; hasta 50 intentos y, si fallan, índices fijos 3 (×1), 14 (×2) y 25 (×5). Se dibujan con línea de 3 px y la etiqueta `×N` centrada 14 px debajo.
- **Nave:** triángulo/cápsula de 20 px de ancho con dos patas. Puntos de contacto en coordenadas locales (antes de rotar): patas (−10, +10) y (+10, +10), laterales (−8, 0) y (+8, 0), morro (0, −12).
- **Salida de cada nave:** `x = 80`, `y = 60`, `vx = 50 px/s`, `vy = 0`, `angle = 0`.
- **Física por frame (s = dt/1000):**
  - Rotación: `←`/`→` giran **180°/s**; ángulo limitado a **[−90°, +90°]**.
  - Empuje (`↑` o `Espacio`, solo si `fuel > 0`): aceleración **60 px/s²** en la dirección del morro (`ax = 60·sin(angle)`, `ay = −60·cos(angle)`); consume **25 unidades/s**. Con `fuel = 0` no hay empuje ni llama.
  - Gravedad del nivel `L`: `gravity = min(20 + 2 × (L − 1), 40)` px/s² hacia abajo.
  - Velocidad total limitada a **300 px/s** (se escala el vector si la supera).
  - Bordes: si `x < 10` o `x > 790` se fija en el borde y `vx = 0`; si `y < 12` se fija en 12 y, si `vy < 0`, `vy = 0`.
- **Contacto:** si cualquier punto de contacto rotado tiene `y ≥ terrainYAt(x)` se evalúa:
  - **Aterrizaje** si ambas patas están sobre la misma plataforma (sus `x` dentro de `[x_i0, x_i1]`), `|vy| ≤ 40`, `|vx| ≤ 20` y `|angle| ≤ 10°`. **Perfecto** si además `|vy| ≤ 20`, `|vx| ≤ 10` y `|angle| ≤ 5°`.
  - Cualquier otro contacto es **choque**.
- **Puntuación** (× `mult` de la plataforma):
  - Aterrizaje normal: **50**; combustible **+50**.
  - Aterrizaje perfecto: **100**; combustible **+150**.
  - Combustible limitado a **1500** (máximo e inicial). Choque: 0 puntos.
- **Tras aterrizar:** `phase = "landed"` durante **1500 ms** (nave quieta sobre la plataforma, llama apagada, teclas ignoradas); luego `level + 1`, `onLevel(level)`, nueva gravedad, nuevo terreno y nueva salida. Las vidas no cambian.
- **Tras chocar:** `phase = "crashed"`, explosión (anillo y 12 fragmentos lineales) de **1500 ms**; `lives − 1`, `onLives(lives)` al empezar la explosión. Al terminar: si `lives = 0` → game over; si `fuel = 0` → `onLives(0)` y `onGameOver(score)` (sin combustible no hay nave útil); si no, nueva salida en el **mismo terreno** y mismo nivel.
- **Game over** con `lives = 0`: `onLives(0)` ya emitido al chocar; tras la explosión `onGameOver(score)`. El orden `onLives(0)` → `onGameOver` se respeta en ambos casos.
- **Instrumental nativo** (esquina superior derecha, fuente monoespaciada 14 px, 4 líneas): `ALT` (= `terrainYAt(ship.x) − (ship.y + 10)`, entero ≥ 0), `VX`, `VY` (enteros, `VY` positivo = cayendo) y `ANG` (grados enteros). `VX`, `VY` y `ANG` en verde `#39ff14` si cumplen el umbral de aterrizaje normal y en rojo `#ff3355` si no.
- **Dibujo:** fondo `#000814` con 80 estrellas blancas (radio 0.5–1.5 px, alfa 0.4–1). Terreno con relleno `#001d2e` y contorno `#00f5ff` de 2 px. Plataformas `#ffe600` con etiqueta `×N` `#ffe600`. Nave contorno `#ffffff` de 2 px con patas; llama triangular con gradiente `#ffe600` → `#ff2bd6`, largo 14–22 px con parpadeo aleatorio por frame. Explosión: anillo `#ff2bd6` que crece hasta 40 px y fragmentos `#ffffff` que se dispersan a 120 px/s con alfa decreciente.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-lunar-lander` en `app/globals.css`. Aplicar migración `add_game_lunar_lander` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'lunar-lander'` muestra la fila; `npm run build`.
2. Crear `lib/games/lunar-lander/terrain.ts`. Verificar: `npm run lint`; un terreno generado tiene 33 puntos dentro de `[330, 570]`, 3 plataformas planas de 100/75/50 px sin solaparse y con ≥ 2 segmentos de separación.
3. Crear `lib/games/lunar-lander/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/lunar-lander/engine.ts` y exportar `lunarLanderDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"lunar-lander"` en `lib/games/registry.ts`. Verificar: `/games/lunar-lander/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): rotar, empujar (llama y consumo), instrumental en verde/rojo, aterrizaje normal y perfecto en cada multiplicador (puntos y combustible), paso de nivel (terreno nuevo, más gravedad), choque contra terreno y contra plataforma a velocidad alta, perder las 3 naves, agotar el combustible (game over tras el choque), pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'lunar-lander'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `lunar-lander` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; ambas migraciones registradas en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-lunar-lander`), la ficha `/games/lunar-lander` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`GRAVEDAD`, dificultad 3, color cyan, categoría ARCADE).
- [ ] `/games/lunar-lander/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] Cada nave sale en (80, 60) con `vx = 50`, `vy = 0` y morro arriba.
- [ ] `←`/`→` rotan a 180°/s sin pasar de ±90°; `↑` y `Espacio` empujan a 60 px/s² en la dirección del morro y muestran llama; flechas y `Espacio` no hacen scroll.
- [ ] Empujar consume 25 unidades/s; COMBUSTIBLE empieza en 1500 y baja en pasos de 10; con 0 no hay empuje ni llama y el stat se oculta.
- [ ] La gravedad es 20 px/s² en el nivel 1, 22 en el 2 y nunca supera 40.
- [ ] Cada terreno tiene 3 plataformas amarillas (×1 de 100 px, ×2 de 75 px, ×5 de 50 px) con su etiqueta.
- [ ] Posarse con ambas patas en una plataforma, `|vy| ≤ 40`, `|vx| ≤ 20` y `|ángulo| ≤ 10°` aterriza: +50 × mult y +50 combustible; con `|vy| ≤ 20`, `|vx| ≤ 10` y `|ángulo| ≤ 5°` es perfecto: +100 × mult y +150 combustible (tope 1500).
- [ ] Tras aterrizar, a los 1500 ms el nivel del HUD sube, aparece un terreno nuevo y la nave sale de nuevo; las vidas no cambian.
- [ ] Tocar terreno fuera de plataforma, o una plataforma fuera de los umbrales, es choque: explosión de 1500 ms, vidas −1 y nueva nave en el mismo terreno.
- [ ] El instrumental muestra ALT, VX, VY y ANG; VX/VY/ANG en verde dentro de los umbrales de aterrizaje y en rojo fuera.
- [ ] Perder la 3.ª nave, o chocar con combustible 0, emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y COMBUSTIBLE; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela nave, física, consumo, explosión y temporizadores; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, espacio) no mueve ni empuja la nave.
- [ ] Guardar inserta en `scores` con `game_id = 'lunar-lander'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/lunar-lander` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, combustible 1500, gravedad 20, terreno nuevo, nave en la salida).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/lunar-lander/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade de 1979; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** rotación + empuje en la dirección del morro (esencia del clásico); **No:** propulsores laterales (eso es la variante 02).
- **Sí:** 3 naves como vidas con combustible compartido; **No:** combustible por nave (quita la tensión de gestionar el recurso toda la partida).
- **Sí:** game over al chocar con combustible 0 aunque queden naves; **No:** dejar naves sin combustible cayendo (partidas muertas sin decisión).
- **Sí:** plataformas ×1/×2/×5 con ancho inverso al multiplicador (riesgo/recompensa); **No:** plataformas fijas entre niveles.
- **Sí:** terreno de una sola pantalla; **No:** scroll y zoom del original (más cámara y más riesgo; spec aparte si se pide).
- **Sí:** instrumental nativo en canvas (ALT/VX/VY/ANG) porque sin él no se puede aterrizar con criterio; **No:** overlays de estado.
- **Sí:** COMBUSTIBLE emitido en múltiplos de 10 para respetar "solo al cambiar" sin saturar React.
- **Sí:** valores de balance (gravedad, empuje, consumo, umbrales, puntos, combustible) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color cyan; `.cover-lunar-lander` nueva.
- **Sí:** canvas 800×600 (4:3, como el monitor del arcade).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Detección de contacto falla con `dt` alto y la nave atraviesa el terreno.             | `dt` capado a 50 ms (máx. 15 px por frame a 300 px/s); terreno con relleno hasta `y = 600`, contacto con `y ≥ terrainY`. |
| Umbrales de aterrizaje demasiado duros con teclado.                                   | Gravedad 20 y empuje 60 dan margen; instrumental verde/rojo; verificar en paso 6 y ajustar solo editando el spec.       |
| Generación de terreno coloca plataformas solapadas o en el borde.                     | Rango de índices acotado, separación ≥ 2 segmentos y fallback de índices fijos tras 50 intentos.                        |
| Emitir `onStat("fuel")` por frame satura React.                                       | Emitir solo cuando cambia `Math.floor(fuel / 10) * 10`.                                                                 |
| Orden incorrecto `onGameOver` antes de `onLives(0)` en el caso sin combustible.       | Rama explícita: `onLives(0)` y luego `onGameOver(score)`; criterio de aceptación dedicado.                               |
| Flechas o espacio interfieren con el input del modal.                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| Tecla de empuje "pegada" tras perder foco (consume combustible sin querer).           | `blur` y `pause` vacían `keysDown` y apagan `thrusting`.                                                                |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                    | Clave `"lunar-lander"` entre comillas; carpeta `lib/games/lunar-lander/`; migración con `_` en el nombre.                |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Terreno con scroll, zoom de cámara y modos de dificultad del arcade.
- Overlays de pausa/aterrizaje/choque/game over dentro del canvas.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
