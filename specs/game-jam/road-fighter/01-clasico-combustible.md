# SPEC GJ-road-fighter-01 — Juego real: ROAD FIGHTER (variante: clásico de combustible) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-22
> **Variant:** 01 de 2 — Clásico fiel: acelerador y freno analógicos, conducción libre en una carretera que se estrecha y serpentea, sin vidas, el combustible es el único recurso y la partida termina cuando se agota.
> **Objective:** Crear un motor TypeScript de Road Fighter (variante clásico de combustible) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/road-fighter` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Road Fighter. Reproduce el espíritu del original: el jugador **controla la velocidad** (acelera con `↑`, frena con `↓`) y se mueve **libremente en horizontal** dentro de una carretera de ancho y centro variables, con bordes (bordillos) mortales. **No hay vidas**: cada choque cuesta combustible y tiempo (trompo de 1,2 s parado), y el combustible baja también con el paso del tiempo. Se recarga tocando el **coche de combustible** multicolor. La carrera se divide en **etapas de 4000 m** con meta; al cruzarla el combustible restante se convierte en puntos y se rellena el depósito. Se distingue de la variante 02 (autopista nitro: 4 carriles discretos, velocidad automática, nitro, 3 vidas y combos de roce).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-road-fighter`.

Decisiones fijadas por el agente (no se reabren): `id` `road-fighter`, título `ROAD FIGHTER`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 está implementado y `missile-command` reserva 6 en sus specs propuestos), dificultad 3, tags `CLÁSICO` y `CARRERAS`, 1 jugador, teclado. Canvas **480×640** (3:4, vertical). **Sin vidas** (`initialLives` ausente), **nivel = etapa** (`showLevel: true`), stats extra `COMBUSTIBLE` y `KM/H`. Escala fija **1 m = 4 px**. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/road-fighter/engine.ts`: sin globals de módulo; exporta `roadFighterDef: GameEngineDef` con `createRoadFighter(canvas, events) → GameController`.
- Módulo `lib/games/road-fighter/track.ts`: funciones puras y constantes de pista (`SEGMENTS`, `STAGE_M`, `roadAt(meters, level) → { center, width }` con interpolación, `pxToMeters`, `kmhToPxPerSec`).
- Módulo `lib/games/road-fighter/balance.ts`: funciones puras de balance (`accelAt(kmh)`, `drainPerSec(level)`, `spawnGapM(level)`, `rollTrafficType(level, rand)`).
- Módulo `lib/games/road-fighter/draw.ts`: `drawGrass`, `drawRoad` (asfalto, bordillos, línea central, meta), `drawCar`, `drawTruck`, `drawFuelCar`, `drawProgress` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"road-fighter"` en `lib/games/registry.ts`.
- Clase `.cover-road-fighter` en `app/globals.css`: fondo `linear-gradient(90deg,#0b3d0b 0 25%,#2a2a33 25% 75%,#0b3d0b 75%)` con `::after` de línea central discontinua blanca (`repeating-linear-gradient`) y `::before` de un coche cyan `#00f5ff` (rectángulo redondeado con luces) centrado abajo.
- Migración `add_game_road_fighter`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **nivel** (etapa), stats extra `fuel` ("COMBUSTIBLE", `int`, yellow) y `speed` ("KM/H", `int`, cyan). Sin vidas.
- HUD nativo mínimo en canvas: barra vertical de progreso de etapa sobre el césped derecho (sin texto). Sin overlays.
- Controles: `↑`/`W` acelera, `↓`/`S` frena, `←`/`→` y `A`/`D` mueven el coche en horizontal. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'road-fighter'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `road-fighter`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Vidas, nitro, combos, cambios de marcha manuales, rivales que embisten o charcos de aceite.
- Pistas distintas por etapa (todas las etapas usan la misma tabla de segmentos; solo cambia el balance).
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('road-fighter', 'ROAD FIGHTER', 'Esquiva el tráfico antes de quedarte sin gasolina.',
       'Acelera con la flecha arriba, frena con la de abajo y esquiva el tráfico con izquierda/derecha en una carretera que se estrecha y serpentea. No hay vidas: cada choque o roce con el bordillo te cuesta combustible, y el depósito se vacía con el tiempo. Toca el coche multicolor para repostar y llega a la meta de cada etapa de 4000 m: la gasolina que te quede se convierte en puntos.',
       'ARCADE', 'cyan', 'cover-road-fighter', 1, 1, '{keyboard}', '{CLÁSICO,CARRERAS}', 3, 7, false);

Definición del motor:

    export const roadFighterDef: GameEngineDef = {
      width: 480, height: 640,
      showLevel: true,
      stats: [
        { key: "fuel", label: "COMBUSTIBLE", color: "yellow", format: "int" },
        { key: "speed", label: "KM/H", color: "cyan", format: "int" },
      ],
      create: createRoadFighter,
    };

Estado interno (dentro de `createRoadFighter`): `x` (centro del coche, px), `kmh`, `fuel`, `level`, `stageM` (metros recorridos en la etapa), `pointM` (metros acumulados hacia el siguiente bloque de 25 m), `spawnM`, `fuelSpawnM`, `traffic: { x, y, w, h, kmh, type: "blue" | "red" | "truck" | "fuel", passed, weaved }[]`, `crashMs`, `spinAngle`, `invulnMs`, `keys { up, down, left, right }`, `score`, `lastFuelEmitted`, `lastSpeedEmitted`, `grassOffset`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("fuel", n)`, `onStat("speed", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("fuel", 100)`, `onStat("speed", 0)`.
- `onStat("fuel", n)` con `n = Math.ceil(fuel)`, solo cuando `n` cambia. `onStat("speed", n)` con `n = Math.round(kmh / 10) * 10`, solo cuando `n` cambia. Valor 0 oculta el stat (contrato de `onStat`); esperado con el coche parado.
- Game over: este juego no declara vidas, así que no emite `onLives`; al agotarse el combustible emite `onStat("fuel", 0)` y luego `onGameOver(score)`. El motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Las teclas son de mantener (no usan `e.repeat`).
- Pausa/blur/destroy ponen todas las `keys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escala y scroll:** 1 m = 4 px. La pista se desplaza hacia abajo a `kmh × 1.2` px/s (400 km/h = 480 px/s). Metros avanzados por frame = `kmh × 1.2 × dt / 4`.
- **Coche del jugador:** 24×40 px, centro vertical fijo en `y = 560`. Empieza en el centro de la pista, `kmh = 0`, `fuel = 100`, `level = 1`.
- **Velocidad:** rango 0–400 km/h. Con `↑`/`W`: +140 km/h/s si `kmh < 200`, +70 km/h/s si `kmh ≥ 200`. Con `↓`/`S`: −320 km/h/s. Sin ninguna de las dos: −50 km/h/s (inercia). Si se pulsan ambas, gana el freno.
- **Dirección:** `←`/`A` y `→`/`D` mueven el coche a **200 px/s** en horizontal, solo si `kmh > 0`.
- **Pista (`SEGMENTS`):** cada etapa mide **4000 m** en 8 segmentos de 500 m con `width` = [240, 240, 200, 160, 200, 240, 160, 240] px y `center` = [240, 240, 260, 220, 240, 260, 240, 220] px. Los primeros **60 m** de cada segmento interpolan linealmente desde los valores del segmento anterior (el segmento 0 de la etapa interpola desde el 7, salvo en la etapa 1, que arranca directo). `roadAt(m, level)` devuelve `{ center, width }` para cualquier metro de la etapa; la fila de pantalla `y` corresponde a `stageM + (560 − y) / 4`; un metro `m ≥ 4000` (pista por encima de la meta) se resuelve como `roadAt(m − 4000, level + 1)`.
- **Bordillos:** si `x − 12 < center − width/2` o `x + 12 > center + width/2` en `y = 560` → choque (aunque haya invulnerabilidad).
- **Tráfico** (todos 24×40 salvo camión 28×64; velocidad propia fija; en pantalla `vy = (kmhJugador − kmhCoche) × 1.2` px/s):
  - `blue` `#2a6cff`, 120 km/h, recto.
  - `red` `#ff3355`, 150 km/h; la primera vez que su centro está entre **120 y 300 px por encima** del jugador, se desplaza hacia la `x` del jugador a **80 px/s** hasta quedar a menos de 4 px o salir de esa franja (`weaved = true`, una sola vez).
  - `truck` (cabina `#ffe600`, caja `#888`), 28×64, 90 km/h, recto; solo desde nivel 2.
  - `fuel` (franjas `#ff2bd6`/`#ffe600`/`#00f5ff`), 130 km/h, recto; no es mortal.
  - Cada coche mantiene su `x` dentro de `[center − width/2 + w/2 + 2, center + width/2 − w/2 − 2]` de la pista a su altura (sigue las curvas y estrechamientos).
- **Aparición:** cada vez que `spawnM` acumula `max(30, 70 − 8 × (level − 1))` m se lanza un coche. Tipo: `truck` con probabilidad **0.15** (nivel ≥ 2), si no `red` con probabilidad `min(0.15 + 0.08 × (level − 1), 0.5)`, si no `blue`. Si `kmh ≥ kmhCoche` nace arriba (`y = −70`), si no nace abajo (`y = 710`) con `|x − xJugador| ≥ 50`. `x` aleatoria dentro de la pista. Si otro coche está a menos de 90 px en vertical y 40 px en horizontal del punto de aparición, se reintenta al cumplirse 5 m más. El coche `fuel` aparece cada **1000 m** recorridos en la etapa (`fuelSpawnM`: a los 1000, 2000 y 3000 m, 3 por etapa) en lugar del spawn normal de ese momento. Se eliminan los coches con `y < −120` o `y > 760`.
- **Puntos:** +**10** por cada 25 m recorridos; +**50** al adelantar un coche (`blue`/`red`/`truck`) cuando su centro pasa de `y < 560` a `y ≥ 560`, una vez por coche (`passed`); tocar el coche `fuel`: +**1000** y +**20** de combustible (tope 100), el coche desaparece.
- **Combustible:** baja `min(1.5 + 0.1 × (level − 1), 2.5)` unidades/s mientras se juega (también parado), salvo durante el trompo. Al llegar a 0 → game over inmediato.
- **Choque** (contra `blue`/`red`/`truck` sin invulnerabilidad, AABB reducido 2 px por lado, o bordillo): `fuel −= 10` (si queda ≤ 0 → game over), `kmh = 0`, el coche chocado se elimina, el jugador gira 720° en **1200 ms** (`crashMs`) sin aceptar controles ni gastar combustible; al terminar reaparece en el `center` de la pista en `y = 560`, se eliminan los coches a menos de 150 px en vertical y obtiene **1500 ms** de invulnerabilidad al tráfico (parpadeo cada 100 ms).
- **Meta de etapa:** al llegar `stageM` a 4000 se suma `Math.floor(fuel) × 20`, `level += 1` → `onLevel(level)`, `fuel = 100`, `stageM = 0`, se vacía el tráfico y se conserva la velocidad. La meta se dibuja como una franja ajedrezada blanca/negra de 16 px de alto a lo ancho de la pista cuando está en pantalla.
- **Tiempo:** todo avanza con `dt` solo en juego (no en pausa ni tras game over).
- **Dibujo:** césped `#0b3d0b` con franjas `#0e4a0e` de 40 px que se desplazan con la pista; asfalto `#2a2a33`; bordillos de 6 px alternando `#ff3355`/`#ffffff` cada 16 px; línea central discontinua blanca 4×24 px con hueco de 24 px. Jugador `#00f5ff` con franja central blanca, ruedas `#111` (4 rectángulos 4×10) y luces traseras rojas. Barra de progreso en `x = 462–470`, `y = 40–600`: fondo `#222`, relleno `#00f5ff` de abajo arriba proporcional a `stageM / 4000`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-road-fighter` en `app/globals.css`. Aplicar migración `add_game_road_fighter` con `published = false` (`mcp__supabase__apply_migration`) y anotarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'road-fighter'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/road-fighter/track.ts` y `balance.ts`. Verificar: `npm run lint`; `roadAt(0, 1)` = `{ center: 240, width: 240 }`, `roadAt(0, 2)` = `{ center: 220, width: 240 }`, `roadAt(1600, 1)` = `{ center: 220, width: 160 }`, `roadAt(1030, 1)` interpola a `{ center: 250, width: 220 }`; `spawnGapM(1) = 70`, `spawnGapM(6) = 30`; `drainPerSec(1) = 1.5`, `drainPerSec(20) = 2.5`.
3. Crear `lib/games/road-fighter/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/road-fighter/engine.ts` y exportar `roadFighterDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"road-fighter"` en `lib/games/registry.ts`. Verificar: `/games/road-fighter/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): acelerar a 400 km/h, frenar, inercia, adelantar coches (+50), coche rojo que se cruza, choque contra tráfico y contra bordillo (trompo, −10 combustible, reaparición con parpadeo), repostar con el coche multicolor (1000 m), cruzar la meta de 4000 m (bonus, nivel 2, depósito lleno, aparecen camiones), agotar el combustible, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'road-fighter'` (anotar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `road-fighter` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-road-fighter`), la ficha `/games/road-fighter` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`CARRERAS`, dificultad 3, color cyan, categoría ARCADE).
- [ ] `/games/road-fighter/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza parada (KM/H oculto), COMBUSTIBLE 100, nivel 1, puntaje 0, coche centrado en la pista.
- [ ] `↑`/`W` acelera (0→200 km/h en ~1,4 s, 200→400 en ~2,9 s), `↓`/`S` frena a 320 km/h/s, soltar decelera a 50 km/h/s; tope 400 km/h; las flechas no hacen scroll.
- [ ] `←`/`→` y `A`/`D` mueven el coche a 200 px/s solo en movimiento.
- [ ] La pista se estrecha a 160 px y se desplaza lateralmente según `SEGMENTS`, con transiciones de 60 m; tocar el bordillo provoca choque.
- [ ] Cada 25 m suman 10 puntos; adelantar un coche suma 50 una sola vez por coche.
- [ ] El coche rojo se desvía hacia el jugador una sola vez a 80 px/s; los camiones solo aparecen desde el nivel 2.
- [ ] Un choque resta 10 de combustible, para el coche, lo hace girar 1,2 s y lo recoloca en el centro con 1,5 s de invulnerabilidad al tráfico (parpadeo).
- [ ] El coche multicolor aparece a los 1000, 2000 y 3000 m de cada etapa; tocarlo suma 1000 puntos y 20 de combustible (tope 100) y no es mortal.
- [ ] El combustible baja 1,5/s en nivel 1 (también parado), no baja durante el trompo, y COMBUSTIBLE en el HUD cambia solo al cambiar su entero.
- [ ] Al cruzar la meta de 4000 m: suma `floor(combustible) × 20`, nivel +1, COMBUSTIBLE 100, tráfico vacío y velocidad conservada; la barra de progreso vuelve abajo.
- [ ] Con el combustible en 0 (por tiempo o por choque) se emite `onStat("fuel", 0)` y luego `onGameOver`, y se abre el modal con el puntaje correcto; no se emite `onLives`.
- [ ] El HUD de React refleja puntaje, nivel, COMBUSTIBLE y KM/H (en pasos de 10); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pista, tráfico, combustible y trompo; reanudar sin salto de tiempo ni tecla "pegada".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`) no mueve el coche.
- [ ] Guardar inserta en `scores` con `game_id = 'road-fighter'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/road-fighter` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, COMBUSTIBLE 100, 0 km/h, sin tráfico, `stageM` 0).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/road-fighter/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración figura en `references/production/prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** acelerador/freno y movimiento lateral libre, fiel al original; es la diferencia central con la variante 02 (carriles y velocidad automática).
- **Sí:** sin vidas, el combustible es la única barra de supervivencia (como el original); **No:** `initialLives` (el HUD no mostraría nada útil).
- **Sí:** game over sin `onLives`; la convención `onLives(0)` → `onGameOver` solo aplica a juegos con vidas.
- **Sí:** choque = −10 combustible + trompo de 1,2 s; castiga en recurso y en tiempo sin terminar la partida.
- **Sí:** etapas de 4000 m con meta y bonus `combustible × 20`; dan estructura y nivel visibles. **No:** pistas distintas por etapa (misma tabla, más tráfico y más consumo).
- **Sí:** tráfico que nace abajo si el jugador va más lento que él; evita una pantalla vacía al frenar.
- **Sí:** stats `COMBUSTIBLE` y `KM/H`; **No:** stat de distancia (la barra de progreso nativa ya la muestra).
- **Sí:** valores de balance (aceleraciones, consumo, huecos de aparición, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 480×640 vertical (el scroll es vertical); **Sí:** `.cover-road-fighter` nueva.
- **Sí:** `sort_order` 7, saltando el 6 que reservan los specs propuestos de `missile-command`.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Coches de tráfico quedan fuera de la pista al estrecharse.                             | Cada frame se acota su `x` a la pista calculada en su propia altura con `roadAt`.                                |
| Aparición encima de otro coche o del jugador (al nacer abajo).                         | Reintento cada 5 m si hay solape en 90×40 px; abajo exige 50 px de separación horizontal con el jugador.                                 |
| Choques encadenados al reaparecer junto a tráfico.                                     | Se eliminan coches a menos de 150 px en vertical y hay 1500 ms de invulnerabilidad.                              |
| Emitir `onStat("speed")`/`onStat("fuel")` por frame satura React.                      | Emitir solo cuando cambia el valor redondeado (decena de km/h, entero de combustible).                           |
| `dt` grande tras pausar o cambiar de pestaña hace saltar metros o atravesar coches.    | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms (máx. 24 px por frame a 400 km/h).           |
| Flechas o `W/A/S/D` interfieren con el input del modal.                                | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                             |
| Acelerador "pegado" tras perder foco.                                                  | `blur` y `pause` ponen todas las `keys` a `false`.                                                               |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                           |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"road-fighter"` entre comillas; carpeta `lib/games/road-fighter/`; migración con `_` en el nombre.         |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                  |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas, nitro, combos, marchas manuales, rivales que embisten, charcos de aceite y power-ups.
- Pistas distintas por etapa, curvas reales con perspectiva.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
