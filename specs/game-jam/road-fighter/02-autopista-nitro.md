# SPEC GJ-road-fighter-02 — Juego real: ROAD FIGHTER (variante: autopista nitro) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-09
> **Variant:** 02 de 2 — Arcade moderno sin fin: 5 carriles discretos, velocidad automática que sube por nivel, nitro recargable que duplica puntos, rozones con combo multiplicador y 3 vidas.
> **Objective:** Crear un motor TypeScript de Road Fighter (variante autopista nitro) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/road-fighter` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Road Fighter. Convierte la carrera en una **autopista infinita de 5 carriles** pensada para teclado y partidas cortas: el coche avanza solo, `←/→` cambian **un carril por pulsación**, `↑` activa el **nitro** (más velocidad y puntos dobles mientras dura la barra) y `↓` frena. El riesgo se premia con **rozones**: adelantar un coche en el carril contiguo suma puntos con un **combo** que crece si se encadenan. Hay **3 vidas**, vida extra por puntos, obras fijas en la calzada y coches que cambian de carril. Se distingue de la variante 01 (conducción analógica libre, trazado por etapas que se estrecha, combustible como reloj y sin vidas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, líneas y gradientes con brillo neón. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-road-fighter`.

Decisiones fijadas por el agente (no se reabren): `id` `road-fighter`, título `ROAD FIGHTER`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 y `missile-command` = 6 reservado por sus specs game-jam), dificultad 4, tags `CARRERAS` y `NITRO`, 1 jugador, teclado. Canvas **400×600** (2:3, vertical). **3 vidas** (`initialLives: 3`, máx. 5 con vidas extra), **nivel** por distancia (`showLevel: true`, sin tope), stats extra `NITRO` y `COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/road-fighter/engine.ts`: sin globals de módulo; exporta `roadFighterDef: GameEngineDef` con `createRoadFighter(canvas, events) → GameController`.
- Módulo `lib/games/road-fighter/balance.ts`: funciones puras y constantes (`LANE_X`, `PLAYER`, `baseSpeed(level)`, `levelAt(totalPx)`, `spawnGap(level)`, `rollTrafficType(level, rand)`, `nearMissPoints(combo)`).
- Módulo `lib/games/road-fighter/draw.ts`: `drawBackground`, `drawRoad` (calzada, arcenes, líneas de carril con desplazamiento), `drawCar(ctx, x, y, w, h, body, glow)`, `drawTruck`, `drawBarrier`, `drawCanister`, `drawSpeedLines`, `drawExplosion`, `drawNearMissLabel` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"road-fighter"` en `lib/games/registry.ts`.
- Clase `.cover-road-fighter` en `app/globals.css`: fondo `radial-gradient(circle at 50% 110%,#3a0040,#07001a 70%)`; `::before` con cuatro líneas de carril magenta discontinuas en perspectiva (`repeating-linear-gradient`) y `::after` con un coche cian con halo (`box-shadow` `#00f5ff`) y dos estelas de nitro magenta debajo.
- Migración `add_game_road_fighter`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **400×600**.
- HUD de React: puntaje, **3 vidas**, **nivel** y stats extra `nitro` ("NITRO", `int`) y `combo` ("COMBO", `int`).
- Sin HUD nativo de texto en el canvas, salvo la etiqueta efímera `ROZÓN ×N` junto al coche (efecto de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` cambian de carril; `↑`/`W` o `Espacio` (mantenidos) activan el nitro; `↓`/`S` (mantenido) frena. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'road-fighter'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `road-fighter`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Combustible, trazado con curvas o estrechamientos, conducción analógica libre.
- Disparos, policía perseguidora, power-ups distintos del bidón de nitro.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('road-fighter', 'ROAD FIGHTER', 'Nitro a fondo y rozones al límite.',
       'Cambia de carril con las flechas o A/D en una autopista sin fin que no deja de acelerar. Mantén arriba, W o Espacio para usar el nitro y sumar puntos dobles; frena con abajo o S. Adelanta coches rozándolos en el carril de al lado para encadenar combos. Tienes tres vidas y cada 10 000 puntos ganas una más.',
       'ARCADE', 'magenta', 'cover-road-fighter', 1, 1, '{keyboard}', '{CARRERAS,NITRO}', 4, 7, false);

Definición del motor:

    export const roadFighterDef: GameEngineDef = {
      width: 400, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "nitro", label: "NITRO", color: "green", format: "int" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createRoadFighter,
    };

Estado interno (dentro de `createRoadFighter`): `lane` (0–4, carril destino), `laneFrom`, `slideMs`, `queuedMove` (−1, 0 o +1; máx. 1 pendiente), `nitroHeld`, `brakeHeld`, `speed` (px/s actual), `nitro` (0–100), `totalPx`, `pointAcc`, `spawnAcc`, `canisterAcc`, `level`, `lives`, `nextLifeAt`, `combo`, `comboMs`, `traffic: { lane, laneFrom, shiftMs, x, y, w, h, speed, type: "car" | "truck" | "barrier" | "swerver", color, passed, swerved }[]`, `canisters: { lane, y }[]`, `labels: { text, x, y, ms }[]`, `crashMs`, `invulnMs`, `explosion { x, y, age } | null`, `score`, `lastNitroEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("nitro", n)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("nitro", 100)`, `onStat("combo", 0)`.
- `onStat("nitro", n)` solo cuando cambia `Math.floor(nitro / 5) × 5` (pasos de 5). `onStat("combo", n)` solo cuando cambia `combo`. Valor 0 oculta el stat (contrato de `onStat`); esperado con combo 0 o nitro vacío.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Cambio de carril: una acción por pulsación (ignora `e.repeat`). Nitro y freno: teclas mantenidas.
- Pausa/blur/destroy ponen `nitroHeld = brakeHeld = false` y `queuedMove = 0`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** calzada de `x = 50` a `350` con **5 carriles de 60 px**; centros `LANE_X = [80, 140, 200, 260, 320]`. Arcenes de 50 px a cada lado (decorado, no transitables).
- **Jugador:** **36×60 px**, borde superior fijo en `y = 470`. Empieza en el carril **2** (centro). `←`/`A` resta 1 carril y `→`/`D` suma 1 (en el carril 0 o 4 la pulsación hacia fuera se ignora). El cambio es un deslizamiento lineal de **110 ms**; una pulsación durante el deslizamiento se guarda en `queuedMove` (solo 1) y se ejecuta al terminar. Para colisiones cuenta la `x` interpolada.
- **Velocidad:** `baseSpeed(level) = min(300 + 25 × (level − 1), 550)` px/s. Objetivo: con nitro activo `base × 1.5`; con freno `base × 0.6` (el freno anula el nitro); sin nada `base`. `speed` se acerca al objetivo a **600 px/s²**. `totalPx += speed × dt_s`.
- **Nitro:** activo si `nitroHeld && nitro > 0 && !brakeHeld`. Activo: `nitro −= 30 × dt_s`; inactivo: `nitro += 6 × dt_s`; rango `[0, 100]`. Mientras está activo se dibujan líneas de velocidad y llamas en el escape.
- **Nivel:** `level = 1 + Math.floor(totalPx / 15000)` (sin tope). Al subir: `onLevel(level)` y +**200 × level** puntos.
- **Puntos:**
  - Distancia: cada **100 px** recorridos (`pointAcc`) → +**10**, o +**20** si el nitro está activo en ese momento.
  - Rozón: la primera vez que el borde superior de un vehículo (`car`, `truck` o `swerver`; no `barrier`) queda por debajo del borde inferior del jugador (`passed = true`), si su carril está a distancia **1** del carril destino del jugador y el jugador no está invulnerable: `combo = min(combo + 1, 8)`, +`nearMissPoints(combo) = 50 × combo` puntos, `comboMs = 3000` y etiqueta `ROZÓN ×combo` durante 700 ms junto al coche.
  - El combo vuelve a 0 si pasan **3000 ms** sin rozón o al chocar.
  - Bidón de nitro: tocarlo → `nitro = min(100, nitro + 35)` y +**100** puntos.
- **Vida extra:** cada **10000** puntos (`nextLifeAt` 10000, 20000, …) `lives = min(5, lives + 1)` → `onLives(lives)`. Con 5 vidas el umbral se consume sin efecto.
- **Tráfico** (velocidad propia; posición en pantalla `y += (speedJugador − speedVehículo) × dt_s`; los más rápidos que el jugador suben):
  - `car`: **36×56**, velocidad entera aleatoria en `[140, 240]` px/s, color al azar entre `#ffe600`, `#ff3355`, `#00a2ff`, `#ffffff`.
  - `truck` (desde nivel 2, probabilidad **0.2**): **40×100**, 120 px/s, `#e0e0e0` con caja `#555`.
  - `barrier` (obras, desde nivel 3, probabilidad **0.15**): **52×24**, 0 px/s, franjas `#ff6a00`/`#ffffff`.
  - `swerver` (desde nivel 4, probabilidad **0.2**): como `car` pero `#00ff88`; al cruzar `y = 200` cambia **una vez** a un carril contiguo libre al azar en **400 ms** (si ninguno está libre a ±80 px vertical, no cambia).
  - El tipo se sortea en orden `barrier` → `truck` → `swerver` → `car`.
- **Aparición:** `spawnAcc` suma los px recorridos; cada vez que supera `spawnGap(level) = max(150, 400 − 25 × (level − 1))` se resta y aparecen vehículos con su borde inferior en `y = −10`: 1, o 2 con probabilidad **0.3** desde nivel 3 (en carriles distintos). El carril se elige al azar entre los que no tienen ningún vehículo con `y` en `[−260, 40]`; nunca se ocupa un carril si eso deja menos de **2 carriles libres** en esa ventana (se generan menos vehículos). No aparece tráfico en los primeros **1000 ms** de partida. Se elimina el tráfico con `y > 650` o `y < −300`.
- **Bidón de nitro:** cada **3000 px** recorridos (`canisterAcc`) aparece un bidón **24×24** `#00ff88` estático (0 px/s) en `y = −30`, en un carril libre de la ventana anterior; si no hay, se pospone a la siguiente aparición.
- **Choque:** colisión AABB con los rectángulos reducidos **4 px** por lado, contra cualquier vehículo u obra, salvo con `invulnMs > 0`. Efecto: `lives −= 1` → `onLives(lives)`, `combo = 0` → `onStat("combo", 0)`, `speed = 0`, explosión de **1000 ms** (círculo `#ff6a00` → `#ffe600` que crece hasta 44 px) sin control ni avance. Después se elimina el tráfico con `y` entre 250 y 650, el coche sigue en su carril, `speed` vuelve a subir a 600 px/s² y queda invulnerable **2000 ms** (parpadeo cada 100 ms). Si `lives` llega a 0: `onLives(0)` y `onGameOver(score)` inmediatamente, sin esperar la explosión.
- **Dibujo:** fondo `#07001a`; arcenes `#0d0d24` con postes `#00f5ff` cada 120 px que se desplazan; calzada `#12122a`; bordes de calzada continuos `#00f5ff` de 3 px; líneas de carril discontinuas `#ff2bd6` (30 px trazo, 30 px hueco) desplazadas con `totalPx`. Coche del jugador `#00f5ff` con `shadowBlur` 12 y faros blancos; vehículos con pilotos traseros `#ff3355`. Etiqueta de rozón: texto `#ffe600`, 16 px monoespaciada, sube 24 px y se desvanece.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-road-fighter` en `app/globals.css`. Aplicar migración `add_game_road_fighter` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'road-fighter'` muestra la fila; `npm run build`.
2. Crear `lib/games/road-fighter/balance.ts`. Verificar: `npm run lint`; `baseSpeed(1) = 300`, `baseSpeed(11) = 550`, `baseSpeed(20) = 550`, `levelAt(14999) = 1`, `levelAt(15000) = 2`, `spawnGap(1) = 400`, `spawnGap(12) = 150`, `nearMissPoints(3) = 150`.
3. Crear `lib/games/road-fighter/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/road-fighter/engine.ts` y exportar `roadFighterDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"road-fighter"` en `lib/games/registry.ts`. Verificar: `/games/road-fighter/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cambio de carril y cola de 1, topes de carril 0 y 4, nitro (velocidad ×1.5, puntos dobles, barra baja y se recarga), freno, rozón y combo hasta ×8 y su caída a los 3 s, bidón de nitro, camiones (nivel 2), obras (nivel 3), `swerver` (nivel 4), choque con pérdida de vida e invulnerabilidad, vida extra a los 10000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'road-fighter'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `road-fighter` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-road-fighter`), la ficha `/games/road-fighter` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CARRERAS`/`NITRO`, dificultad 4, color magenta, categoría ARCADE).
- [ ] `/games/road-fighter/jugar` muestra el canvas 2:3 sin desborde a 375 px y 1280 px.
- [ ] La partida empieza en el carril central, 3 vidas, nivel 1, NITRO 100, COMBO oculto, a 300 px/s.
- [ ] `←`/`→` y `A`/`D` mueven exactamente un carril por pulsación en 110 ms; mantener pulsado no repite; una segunda pulsación durante el deslizamiento se ejecuta al terminar; las flechas y `Espacio` no hacen scroll.
- [ ] Con nitro la velocidad sube a ×1.5, cada 100 px suman 20 en lugar de 10 y la barra baja 30/s; sin nitro se recarga 6/s; con la barra a 0 el nitro no actúa.
- [ ] `↓`/`S` reduce la velocidad a ×0.6 y anula el nitro.
- [ ] Adelantar un vehículo en el carril contiguo suma 50, 100, 150… hasta 400 (combo ×8); COMBO en el HUD vuelve a 0 tras 3 s sin rozón o al chocar. Las obras no cuentan como rozón.
- [ ] El bidón de nitro aparece cada 3000 px y suma 35 de NITRO (máx. 100) y 100 puntos.
- [ ] El nivel sube cada 15000 px sumando 200 × nivel; la velocidad base sube 25 px/s por nivel hasta 550.
- [ ] Camiones desde nivel 2, obras fijas desde nivel 3 y `swerver` (cambia de carril en `y = 200`) desde nivel 4.
- [ ] Siempre quedan al menos 2 carriles libres en la franja de aparición.
- [ ] Un choque resta 1 vida, detiene el coche 1000 ms y da 2000 ms de invulnerabilidad con parpadeo; cada 10000 puntos se gana una vida (máx. 5).
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas, nivel, NITRO (pasos de 5) y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela tráfico, distancia, nitro y temporizador de combo; reanudar sin salto de tiempo ni nitro/freno pegado.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`, espacio) no mueve el coche.
- [ ] Guardar inserta en `scores` con `game_id = 'road-fighter'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/road-fighter` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, NITRO 100, COMBO 0, carril central, sin tráfico).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/road-fighter/jugar`.
- [ ] `CLAUDE.md`, `references/implemented-games.md` y `references/production/prod-setup.md` reflejan el nuevo juego y su migración.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** 5 carriles discretos con un cambio por pulsación; control preciso con teclado y la diferencia central con la variante 01. **No:** posición lateral libre.
- **Sí:** velocidad automática por nivel con nitro y freno como únicas decisiones de ritmo; **No:** acelerador manual ni combustible.
- **Sí:** 3 vidas con vida extra cada 10000 (máx. 5); partidas cortas pero no de un golpe.
- **Sí:** rozones con combo hasta ×8 y nitro con puntos dobles; premian el riesgo y amplían el rango del leaderboard.
- **Sí:** regla de 2 carriles libres en la franja de aparición; evita muros imposibles sin pathfinding.
- **Sí:** stats `NITRO` (pasos de 5) y `COMBO`; son los dos recursos de la variante.
- **Sí:** camiones, obras y `swerver` desbloqueados por nivel; **No:** policía, disparos ni otros power-ups.
- **Sí:** valores de balance (velocidades, aceleración, nitro, puntos, intervalos) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas vertical 400×600.
- **Sí:** `cat` ARCADE y color magenta (estética neón nocturna); **Sí:** `.cover-road-fighter` nueva.
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Combinaciones de tráfico a distintas velocidades cierran todos los carriles más abajo. | Regla de 2 carriles libres en la franja `[−260, 40]`; verificar nivel 8+ en el paso 6 y ajustar en el spec.  |
| A 550 px/s × 1.5 el tiempo de reacción es demasiado corto.                             | Aparición desde `y = −10` y cambio de carril de 110 ms; si no es jugable, bajar el tope solo editando el spec. |
| Rozón contado dos veces o al vehículo con el que se choca.                             | `passed` por vehículo; un choque elimina el tráfico cercano y la invulnerabilidad anula rozones.            |
| Emitir `NITRO` por frame satura React.                                                 | Emitir solo al cambiar `Math.floor(nitro / 5) × 5`.                                                          |
| `dt` grande tras pausar o cambiar de pestaña hace saltar distancia o un choque.        | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                        |
| Nitro o freno "pegado" tras perder foco.                                               | `blur` y `pause` ponen `nitroHeld`/`brakeHeld` a `false` y vacían `queuedMove`.                             |
| Flechas, `WASD` o espacio interfieren con el input del modal.                          | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                        |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                      |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"road-fighter"` entre comillas; carpeta `lib/games/road-fighter/`; migración con `_` en el nombre.    |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Combustible, curvas o estrechamientos del trazado y conducción analógica.
- Policía, disparos y power-ups distintos del bidón de nitro.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
