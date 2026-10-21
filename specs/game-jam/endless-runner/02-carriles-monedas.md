# SPEC GJ-endless-runner-02 — Juego real: ENDLESS RUNNER (variante: carriles y monedas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-21
> **Variant:** 02 de 2 — Runner moderno en vista cenital: 3 carriles con cambio de carril y salto, monedas con multiplicador por racha, power-ups (imán y escudo), 3 vidas con invulnerabilidad y niveles por distancia.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante carriles y monedas) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Endless Runner. Lleva el género al estilo de runner de carriles: vista **cenital vertical**, el corredor está abajo y la pista baja hacia él; se esquiva **cambiando entre 3 carriles** y **saltando** barreras bajas. El puntaje mezcla distancia y **monedas** con un **multiplicador por racha** que se pierde al chocar, y hay **power-ups** (imán y escudo). Se juega con **3 vidas** e invulnerabilidad temporal, y la velocidad sube por **niveles** de distancia. Se distingue de la variante 01 (vista lateral, solo saltar/agacharse, 1 vida, puntaje solo por distancia, sin objetos).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos, círculos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y `missile-command` = 6 reservado por sus specs propuestos), dificultad 3, tags `CARRILES` y `MONEDAS`, 1 jugador, teclado. Canvas **480×640** (3:4). **3 vidas** (`initialLives: 3`), **nivel** cada 500 m (`showLevel: true`), stats extra `MONEDAS` y `MULTIPLICADOR`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/balance.ts`: funciones puras (`levelFor(meters)`, `speedFor(level)`, `rowGapFor(level)`, `multFor(streak)`, `rollRow(level, prevFreeLanes, rand)`) y constantes (`LANES_X`, `PLAYER`, `OBSTACLES`, `COIN`, `POWERUPS`).
- Módulo `lib/games/endless-runner/draw.ts`: `drawTrack` (asfalto, rieles y divisiones que se desplazan), `drawRunner` (con escala de salto, sombra, parpadeo y anillo de escudo), `drawBarrier`, `drawBlock`, `drawTrain`, `drawCoin`, `drawMagnet`, `drawShield` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: fondo `linear-gradient(180deg,#0b0b14,#1a1400)` con `::before` de tres carriles en perspectiva (líneas `#ffe600` que convergen arriba) y `::after` de una fila de monedas amarillas y la silueta cyan del corredor.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel**, stats extra `coins` ("MONEDAS", `int`) y `mult` ("MULTIPLICADOR", `int`).
- Sin HUD nativo de texto en el canvas; los power-ups activos se ven como anillo (escudo) o halo (imán) alrededor del corredor.
- Controles: `←`/`A` y `→`/`D` cambian de carril; `Espacio`, `↑` o `W` saltan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deslizarse/agacharse, subir encima de trenes, más de 3 carriles, power-ups adicionales (×2, jetpack), tienda o personajes.
- Vista en perspectiva 3D real (la pista es cenital plana).
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('endless-runner', 'ENDLESS RUNNER', 'Cambia de carril, salta y junta monedas.',
       'Corre por una pista de tres carriles: cambia de carril con las flechas o A/D y salta las barreras bajas con Espacio, ↑ o W. Junta monedas sin chocar para subir el multiplicador hasta ×5, atrapa el imán y el escudo, y aguanta con tres vidas mientras la pista se acelera cada 500 metros.',
       'ARCADE', 'yellow', 'cover-endless-runner', 1, 1, '{keyboard}', '{CARRILES,MONEDAS}', 3, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "coins", label: "MONEDAS", color: "yellow", format: "int" },
        { key: "mult", label: "MULTIPLICADOR", color: "magenta", format: "int" },
      ],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `lane` (0–2, carril destino), `fromX`, `laneTweenMs`, `queuedMove` (−1, 0 o +1), `jumpMs` (0 = en el suelo), `obstacles: { kind: "barrier" | "block" | "train", lane, y, h, hit }[]`, `coins: { x, y, taken }[]`, `powerups: { kind: "magnet" | "shield", lane, y }[]`, `prevFreeLanes: number[]`, `lastRowTop`, `distance`, `meters`, `level`, `speed`, `score`, `coinCount`, `streak`, `mult`, `lives`, `invulnMs`, `magnetMs`, `shieldMs`, `stripeOffset`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("coins", n)`, `onStat("mult", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("coins", 0)`, `onStat("mult", 1)`.
- `onScore` solo cuando cambia `score` (al sumar un metro entero, una moneda, un power-up o el bonus de nivel). Valor 0 oculta el stat (contrato de `onStat`); esperado en MONEDAS al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Todas las teclas de juego ignoran `e.repeat` (una acción por pulsación).
- Pausa/blur/destroy limpian `queuedMove`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Los temporizadores (`jumpMs`, `invulnMs`, `magnetMs`, `shieldMs`, `laneTweenMs`) solo avanzan en juego.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Pista:** asfalto de `x = 30` a `x = 450` (3 carriles de **140 px**), centros `LANES_X = [100, 240, 380]`. Unidad: **10 px = 1 m**.
- **Corredor:** caja **44×56** centrada en el carril, con borde superior en `y = 540`; hitbox **36×44** centrada. Empieza en el carril 1 (centro).
- **Cambio de carril:** `←`/`A` (−1) o `→`/`D` (+1); el corredor se desplaza linealmente al nuevo centro en **120 ms** (la colisión usa la `x` interpolada). Pulsar durante un desplazamiento encola 1 movimiento (`queuedMove`, se sobrescribe). En el carril 0 `←` y en el 2 `→` se ignoran. Se puede cambiar de carril en el aire.
- **Salto:** `Espacio`/`↑`/`W` en el suelo → `jumpMs = 650`; mientras `jumpMs > 0` el corredor está en el aire (escala visual 1 → 1.3 → 1 con sombra). En el aire no choca con `barrier`, sí con `block` y `train`, y sí recoge monedas y power-ups. No se puede saltar en el aire.
- **Distancia y nivel:** `distance += speed × dt`; `meters = Math.floor(distance / 10)`; cada metro nuevo suma **+1** punto. `level = 1 + Math.floor(meters / 500)` (sin tope). Al subir: `onLevel(level)` y +**100 × level** puntos.
- **Velocidad:** `speed = min(300 + 30 × (level − 1), 660)` px/s (tope en el nivel 13).
- **Obstáculos** (ancho **110 px**, centrados en su carril):
  - `barrier` (baja) alto **22**: se salta.
  - `block` (alta) alto **70**: hay que cambiar de carril.
  - `train` (largo) alto **240**: hay que cambiar de carril; solo desde el nivel 3.
- **Filas:** los obstáculos llegan en filas. `rowGap = max(200, 360 − 15 × (level − 1))` px. La siguiente fila nace (con base en `y = 0`, entrando por arriba) cuando el borde superior del obstáculo más alto de la fila anterior ha bajado a `y ≥ rowGap`. La primera fila nace cuando `distance ≥ 400`.
- **Composición de fila:** se sortea 1 carril ocupado (prob. 0.6) o 2 (prob. 0.4). Antes se elige al azar un carril `F` entre los carriles libres de `block`/`train` de la fila anterior (primera fila: cualquiera); `F` nunca recibe `block` ni `train` (sí puede recibir `barrier`). Cada carril ocupado recibe `barrier` 0.40, `block` 0.45 o `train` 0.15 (antes del nivel 3, `train` se convierte en `block`). Así siempre existe un carril transitable entre filas consecutivas.
- **Monedas:** en cada fila, con prob. **0.6**, se coloca una línea de **4 monedas** (radio 10, separadas 45 px) en un carril sin obstáculo de esa fila, empezando 40 px por encima del borde superior de la fila. Se recoge cuando su círculo solapa la hitbox del corredor; cada una suma **10 × mult** puntos, `coinCount + 1` y `streak + 1`.
- **Multiplicador:** `mult = min(1 + Math.floor(streak / 10), 5)` (×2 a las 10 monedas seguidas, ×5 a las 40). Un golpe recibido (sin escudo) pone `streak = 0` y `mult = 1`.
- **Power-ups** (desde el nivel 2): en cada fila, con prob. **0.10** y en lugar de la línea de monedas, aparece un power-up (radio 14) en un carril sin obstáculo, 60 px por encima de la fila: `magnet` 0.5 o `shield` 0.5. Recogerlo suma **+50** puntos.
  - `magnet`: **8000 ms**; las monedas a menos de **220 px** por encima del corredor (cualquier carril) vuelan hacia él a **600 px/s**. Recoger otro reinicia el tiempo.
  - `shield`: hasta **12000 ms** o hasta absorber 1 golpe; el obstáculo golpeado se marca `hit` (ya no daña) y no se pierde vida ni racha. Recoger otro reinicia el tiempo.
- **Golpe:** solape AABB entre hitbox del corredor y un obstáculo no marcado `hit` (excepto `barrier` en el aire), sin escudo y con `invulnMs ≤ 0` → `lives − 1`, `onLives(lives)`, `invulnMs = 1500` (el corredor parpadea cada 100 ms), racha a 0, el obstáculo se marca `hit`. La velocidad no cambia.
- **Game over:** al llegar a 0 vidas → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Limpieza:** obstáculos, monedas y power-ups con `y > 640` se eliminan.
- **Dibujo:** asfalto `#0b0b14`; rieles laterales `#ff2bd6` (4 px) en `x = 30` y `x = 450`; divisiones de carril discontinuas `rgba(255,230,0,0.3)` (tramos de 30 px cada 60 px) que se desplazan a `speed`. Corredor `#00f5ff` (cabeza circular y cuerpo cápsula, brazos que alternan cada 120 ms), sombra `rgba(0,0,0,0.5)`. `barrier`: franjas diagonales `#ffe600`/`#111`; `block`: `#ff3355` con borde claro; `train`: `#6a5cff` con ventanas `#c9c3ff`. Monedas `#ffe600` con aro interior `#b8a000`. Imán: U `#ff2bd6`; escudo: círculo `#00f5ff`. Escudo activo: anillo `#00f5ff` alrededor del corredor; imán activo: halo `rgba(255,43,214,0.35)`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila; `npm run build`.
2. Crear `lib/games/endless-runner/balance.ts`. Verificar: `npm run lint`; `levelFor(499) = 1`, `levelFor(500) = 2`, `speedFor(1) = 300`, `speedFor(20) = 660`, `rowGapFor(1) = 360`, `rowGapFor(15) = 200`, `multFor(9) = 1`, `multFor(10) = 2`, `multFor(100) = 5`; `rollRow` nunca pone `block`/`train` en el carril `F`.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cambio de carril con cola, topes de carril, saltar una barrera, chocar con bloque (vida −1, parpadeo 1,5 s, racha a 0), recoger monedas hasta ×2, imán y escudo (nivel 2+), trenes (nivel 3+), subida de nivel a los 500 m con bonus, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CARRILES`/`MONEDAS`, dificultad 3, color amarillo, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`A` y `→`/`D` cambian un carril por pulsación en 120 ms; una pulsación durante el desplazamiento se encola; mantener pulsado no repite; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`/`↑`/`W` saltan 650 ms solo desde el suelo; en el aire se pasa sobre `barrier` pero se choca con `block` y `train`.
- [ ] Cada metro (10 px) suma 1 punto; a los 500 m sube el nivel (HUD) y suma 100 × nivel.
- [ ] La velocidad es 300 px/s en nivel 1, +30 por nivel, tope 660; `rowGap` baja de 360 a un mínimo de 200 px.
- [ ] Ninguna fila bloquea los 3 carriles y siempre hay un carril sin `block`/`train` compartido con la fila anterior; los trenes solo salen desde el nivel 3.
- [ ] Cada moneda suma 10 × multiplicador; MONEDAS sube en 1; el MULTIPLICADOR pasa a 2 con 10 seguidas y nunca supera 5.
- [ ] Desde el nivel 2 aparecen imán (8 s, atrae monedas a ≤ 220 px) y escudo (12 s o 1 golpe); cada uno suma 50 puntos.
- [ ] Un golpe sin escudo resta 1 vida, activa 1500 ms de invulnerabilidad con parpadeo y pone el multiplicador en 1; con escudo no se pierde vida ni racha.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel, MONEDAS y MULTIPLICADOR; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pista, salto, invulnerabilidad e imán/escudo; reanudar sin salto de tiempo ni movimiento encolado residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni salta.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, MONEDAS 0, MULTIPLICADOR 1, carril central, sin obstáculos ni power-ups activos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista cenital con 3 carriles discretos; es la diferencia central con la variante 01 y encaja con teclado (una pulsación = un carril). **No:** vista lateral, movimiento libre ni perspectiva 3D.
- **Sí:** salto con duración fija (650 ms) solo contra `barrier`; **No:** deslizarse (una acción menos, sin tecla extra).
- **Sí:** monedas con multiplicador por racha (tope ×5); premia jugar limpio y amplía el rango del leaderboard.
- **Sí:** power-ups imán y escudo desde el nivel 2; **No:** ×2, jetpack u otros (spec aparte si llegan).
- **Sí:** 3 vidas con 1500 ms de invulnerabilidad; el castigo real es perder la racha.
- **Sí:** nivel cada 500 m con bonus 100 × nivel (`showLevel: true`); comunica la escalada de velocidad.
- **Sí:** carril `F` garantizado entre filas consecutivas; ninguna fila es imposible.
- **Sí:** stats `MONEDAS` y `MULTIPLICADOR`; son las dos métricas propias de la variante.
- **Sí:** valores de balance (velocidades, separaciones, probabilidades, puntos, duraciones) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color amarillo (monedas); **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 480×640 (3:4), vertical natural de runner de carriles.
- **No:** sonido, táctil/swipe, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                           |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Con `rowGap` 200 y 660 px/s no da tiempo a cruzar 2 carriles (240 ms) entre filas.       | Carril `F` compartido con la fila anterior: basta quedarse quieto o moverse 1 carril; verificar nivel 13 en el paso 6. |
| Monedas o power-ups solapan obstáculos de la fila siguiente.                             | Línea de 4 monedas ocupa 185 px (< `rowGap` mínimo 200) y se coloca solo en carriles libres de su fila.              |
| Un mismo obstáculo resta varias vidas en frames seguidos.                                | Marca `hit` en el obstáculo e invulnerabilidad de 1500 ms.                                                            |
| `dt` grande tras pausar o cambiar de pestaña atraviesa obstáculos o sube de nivel.       | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; temporizadores solo avanzan en juego.            |
| Movimiento encolado residual tras perder foco.                                           | `blur` y `pause` limpian `queuedMove`.                                                                                |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                       | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                 |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                               |
| El id con guion requiere comillas en `ENGINES` y rutas de carpeta.                       | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración con `_` en el nombre.          |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                      |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deslizarse, subir a los trenes, más carriles, power-ups adicionales, tienda o personajes.
- Perspectiva 3D real.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
