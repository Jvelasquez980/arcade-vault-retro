# SPEC GJ-endless-runner-02 — Juego real: ENDLESS RUNNER (variante: carriles y power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-03
> **Variant:** 02 de 2 — Runner moderno en vista cenital: 3 carriles, cambio de carril y salto, monedas con combo multiplicador, power-ups (imán, escudo, x2), 3 vidas y zonas que aceleran.
> **Objective:** Crear un motor TypeScript de Endless Runner (variante carriles y power-ups) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/endless-runner` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Endless Runner. Es la lectura **moderna** del género (estilo runner de carriles): cámara cenital en vertical, la pista avanza hacia abajo y el corredor elige entre **3 carriles** con `←/→` y **salta** vallas bajas. Los muros altos solo se esquivan cambiando de carril. El puntaje premia la **recolección**: las monedas suben un **combo** (×1 a ×5) que se pierde si dejas pasar una moneda o recibes un golpe, y tres **power-ups** cambian el ritmo. Hay **3 vidas** con invulnerabilidad breve y la velocidad sube por **zonas** cada 400 m. Se distingue de la variante 01 (vista lateral, saltar/agacharse, 1 vida, puntaje = distancia pura, sin recolectables).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencias vigentes: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`) y se dibuja todo con rectángulos, círculos, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-endless-runner`.

Decisiones fijadas por el agente (no se reabren): `id` `endless-runner`, título `ENDLESS RUNNER`, `cat` `ARCADE`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `6` queda reservado por las variantes propuestas de `missile-command`), dificultad 3, tags `CARRILES` y `POWER-UPS`, 1 jugador, teclado. Canvas **400×640** (5:8, vertical). **3 vidas** (`initialLives: 3`), **nivel = zona** (`showLevel: true`), stats extra `MONEDAS` y `COMBO`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/endless-runner/engine.ts`: sin globals de módulo; exporta `endlessRunnerDef: GameEngineDef` con `createEndlessRunner(canvas, events) → GameController`.
- Módulo `lib/games/endless-runner/track.ts`: constantes (`LANE_X`, `LANE_W`, `PLAYER_Y`, tamaños, `PX_PER_M`, duraciones) y funciones puras `zoneAt(meters)`, `speedAt(zone)`, `rowGap(zone)`, `rollRow(zone, rand)` (obstáculos de una fila, garantiza un carril libre), `comboAt(streak)` y `hit(a, b)` (AABB con márgenes).
- Módulo `lib/games/endless-runner/draw.ts`: `drawTrack` (asfalto, divisorias y rieles), `drawRunner` (con escala de salto y parpadeo), `drawBarrier`, `drawWall`, `drawCoin`, `drawPowerUp`, `drawActivePowerUps` (iconos y barras de tiempo) con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"endless-runner"` en `lib/games/registry.ts`.
- Clase `.cover-endless-runner` en `app/globals.css`: fondo `linear-gradient(180deg,#1a0030,#0a0a18)`, `::before` con 2 líneas verticales discontinuas magenta (`#ff2bd6`) en perspectiva (divisorias de carril) y `::after` con una fila de 3 monedas amarillas (`#ffe600`) y un bloque magenta.
- Migración `add_game_endless_runner`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **400×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (zona), stats extra `coins` ("MONEDAS", `int`) y `combo` ("COMBO", `int`).
- HUD nativo mínimo en el canvas: solo los iconos y barras de los power-ups activos (elemento de juego, no overlay).
- Controles: `←`/`→` y `A`/`D` cambian de carril (un carril por pulsación); `Espacio`, `↑` y `W` saltan. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'endless-runner'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `endless-runner`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Deslizarse/agacharse, trenes o plataformas elevadas, vidas extra, tienda o mejoras persistentes de power-ups.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('endless-runner', 'ENDLESS RUNNER', 'Cambia de carril, junta monedas y no frenes.',
       'Corre por una autopista neón de tres carriles: cambia de carril con las flechas o A/D y salta las vallas con Espacio. Los muros solo se esquivan cambiando de carril. Junta monedas seguidas para subir el combo hasta ×5 y atrapa el imán, el escudo y el ×2. Tienes 3 vidas y la pista se acelera cada 400 metros.',
       'ARCADE', 'magenta', 'cover-endless-runner', 1, 1, '{keyboard}', '{CARRILES,POWER-UPS}', 3, 7, false);

Definición del motor:

    export const endlessRunnerDef: GameEngineDef = {
      width: 400, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "coins", label: "MONEDAS", color: "yellow", format: "int" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createEndlessRunner,
    };

Estado interno (dentro de `createEndlessRunner`): `lane` (0–2, destino), `playerX` (interpolado), `laneFromX`, `laneTweenMs`, `jumpMs` (0 = en el suelo), `obstacles: { kind: "barrier" | "wall", lane, y, w, h }[]`, `coins: { x, y, lane, taken }[]`, `powerUps: { kind: "magnet" | "shield" | "x2", lane, y }[]`, `active { magnetMs, shieldMs, x2Ms }`, `invulnMs`, `distancePx`, `meters`, `zone`, `speed`, `sinceRowPx`, `rowCount`, `score`, `lastEmittedScore`, `scoreEmitMs`, `coinsTaken`, `streak`, `combo`, `lives`, `stripeOffset`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("coins", n)`, `onStat("combo", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("coins", 0)`, `onStat("combo", 1)`. Valor 0 oculta el stat (contrato de `onStat`); esperado en MONEDAS al inicio.
- `onScore` se emite solo si el puntaje cambió y como máximo una vez cada **100 ms** (`scoreEmitMs`); al perder la última vida se emite el valor final antes de `onLives(0)`.
- Game over: `onScore(final)` (si difiere del último emitido), `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Cambio de carril y salto ignoran `e.repeat` (una acción por pulsación).
- Pausa/blur/destroy no dejan teclas pegadas (no hay teclas mantenidas); al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. Los temporizadores de power-ups, invulnerabilidad, salto y cambio de carril solo descuentan `dt` en juego.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Pista:** carriles de **120 px** entre `x = 20` y `x = 380`; centros `LANE_X = [80, 200, 320]`. Todo avanza hacia abajo a `speed` px/s. Escala: **1 m = 10 px**.
- **Corredor:** caja **52×68 px** con centro en `y = PLAYER_Y = 540`; empieza en el carril 1 (centro). `←`/`A` y `→`/`D` mueven el destino un carril (sin salir de 0–2; se puede encadenar durante el desplazamiento); `playerX` interpola linealmente hacia `LANE_X[lane]` en **120 ms**. La colisión usa `playerX` real.
- **Salto:** `Espacio`/`↑`/`W` en el suelo inicia un salto de **650 ms** (`jumpMs`); durante él las vallas no colisionan, los muros sí, y las monedas y power-ups se recogen igual. Visualmente escala `1 + 0.25 × sin(π × t / 650)` con sombra. Se puede cambiar de carril en el aire.
- **Zonas:** `zone = 1 + Math.floor(meters / 400)` (sin tope). Al subir: `onLevel(zone)` y +**50 × zone** puntos (no se multiplica).
- **Velocidad:** `speed = min(720, 320 + 40 × (zone − 1))` px/s (zona 1 = 320, tope 720 en zona 11).
- **Filas de obstáculos:** cada fila ocupa una banda de **110 px** de alto; `y` es el borde superior de la banda. Se genera una fila con `y = −140` cada vez que `sinceRowPx ≥ rowGap(zone) = max(240, 400 − 16 × (zone − 1))` px. La primera fila llega tras **600 px** recorridos.
  - Carriles bloqueados por fila: 2 con probabilidad `min(0.6, 0.1 × zone)`, si no 1. Nunca 3: siempre queda al menos un carril sin obstáculo.
  - Cada carril bloqueado recibe `barrier` (valla, **100×26**, saltable, centrada verticalmente en la banda: `y + 42` a `y + 68`) o `wall` (muro, **100×110**, no saltable, ocupa toda la banda) con probabilidad 0.5 cada uno, centrados en su carril.
  - Los objetos se eliminan cuando `y > 700`.
- **Monedas:** tras generar cada fila, con probabilidad **0.65** se coloca una línea vertical de **5 monedas** (radio 10 px, separación 44 px) en un carril **libre** de esa fila elegido al azar, centrada en el centro de la banda (`y + 55`); así marcan el paso y nunca solapan obstáculos de filas vecinas (separadas ≥ 240 px). Valor: **10 × combo**, ×2 si `x2` está activo. Cada moneda suma 1 a MONEDAS.
- **Combo:** `streak` sube 1 por moneda; `combo = min(5, 1 + Math.floor(streak / 10))`. `streak = 0` (combo 1) si una moneda no recogida pasa `y > 600` o si el corredor recibe un golpe (también con escudo).
- **Distancia:** +**1 punto por metro** recorrido (no se multiplica).
- **Power-ups:** por fila, con probabilidad **0.07**, aparece uno centrado en la banda (`y + 55`) de un carril libre de esa fila que no tenga monedas; si no queda ninguno, no aparece. Tipo uniforme entre:
  - `magnet` (imán): **8000 ms**; toda moneda a ≤ **150 px** del centro del corredor se desplaza hacia él a **900 px/s**.
  - `shield` (escudo): hasta absorber un golpe o **15000 ms**; al absorberlo no se pierde vida y da **1000 ms** de invulnerabilidad.
  - `x2`: **10000 ms**; duplica el valor de las monedas.
  - Recoger uno ya activo reinicia su duración. Caja de recogida **36×36**.
- **Golpe:** contacto AABB (margen interior **6 px** en el corredor, **4 px** en el obstáculo) con un muro, o con una valla sin estar saltando, fuera de invulnerabilidad: si hay escudo se consume; si no, `lives − 1` → `onLives(lives)` e invulnerabilidad **1500 ms** (parpadeo cada 100 ms). En ambos casos `streak = 0`. Los obstáculos no se eliminan al golpear.
- **Game over:** al llegar `lives` a 0 → `onLives(0)` y `onGameOver(score)`.
- **Dibujo:** asfalto `#0d0a1f`; rieles laterales `#ff2bd6` de 3 px con brillo; divisorias discontinuas `rgba(255,43,214,0.45)` (trazos de 30 px cada 60 px, desplazadas con la pista). Corredor `#00f5ff` (cuerpo redondeado + cabeza) con sombra elíptica `rgba(0,0,0,0.5)`. Vallas a franjas `#ffe600`/`#1a1a1a`; muros `#ff2bd6` con borde superior `#ffffff`. Monedas `#ffe600` con brillo interior. Power-ups dentro de un círculo de 18 px: imán `#00f5ff` (forma de U), escudo `#39ff14` (hexágono), x2 `#ffffff` (texto `x2`, 14 px monoespaciada). `drawActivePowerUps` dibuja en la esquina superior izquierda (desde `x = 28, y = 16`) un icono de 14 px y una barra de 48×4 px por power-up activo.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` / `lib/games/frogger/engine.ts` (patrón vigente). Crear `.cover-endless-runner` en `app/globals.css`. Aplicar migración `add_game_endless_runner` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'endless-runner'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/endless-runner/track.ts`. Verificar: `npm run lint`; `zoneAt(399) = 1`, `zoneAt(400) = 2`, `speedAt(1) = 320`, `speedAt(20) = 720`, `rowGap(1) = 400`, `rowGap(15) = 240`, `comboAt(9) = 1`, `comboAt(10) = 2`, `comboAt(80) = 5`; `rollRow` nunca bloquea los 3 carriles.
3. Crear `lib/games/endless-runner/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/endless-runner/engine.ts` y exportar `endlessRunnerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"endless-runner"` en `lib/games/registry.ts`. Verificar: `/games/endless-runner/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cambio de carril y topes, saltar valla, chocar muro saltando, perder vida e invulnerabilidad, combo ×2 tras 10 monedas y reset al dejar pasar una, los 3 power-ups (imán atrae, escudo absorbe, x2 duplica) y su barra, zona 2 a los 400 m con bonus, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'endless-runner'` (y registrar el `update` en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `endless-runner` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-endless-runner`), la ficha `/games/endless-runner` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CARRILES`/`POWER-UPS`, dificultad 3, color magenta, categoría ARCADE).
- [ ] `/games/endless-runner/jugar` muestra el canvas vertical 5:8 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven un carril por pulsación en 120 ms, sin salir de los 3 carriles; mantener pulsado no repite; las flechas y `Espacio` no hacen scroll.
- [ ] `Espacio`/`↑`/`W` saltan 650 ms: las vallas no dañan durante el salto, los muros sí.
- [ ] Ninguna fila bloquea los 3 carriles; la primera fila llega tras 600 px; monedas y power-ups solo aparecen en carriles libres de su fila y nunca solapan obstáculos.
- [ ] Zona 1 avanza a 320 px/s; cada 400 m sube la zona (HUD de nivel), suma 50 × zona y +40 px/s hasta 720.
- [ ] Cada moneda suma 10 × combo (×2 con x2 activo) y +1 a MONEDAS; el COMBO pasa a 2 tras 10 monedas seguidas, tope 5, y vuelve a 1 al dejar pasar una moneda o recibir un golpe.
- [ ] Imán atrae monedas a ≤ 150 px durante 8 s; escudo absorbe un golpe sin perder vida; x2 dura 10 s; sus barras se ven en la esquina superior izquierda y desaparecen al expirar.
- [ ] Un golpe sin escudo resta una vida y da 1500 ms de invulnerabilidad con parpadeo.
- [ ] Perder la 3.ª vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje (como máximo cada 100 ms), vidas (3 → 0), nivel, MONEDAS y COMBO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pista, salto, cambio de carril, invulnerabilidad y temporizadores de power-ups; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni salta.
- [ ] Guardar inserta en `scores` con `game_id = 'endless-runner'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/endless-runner` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, zona 1, MONEDAS 0, COMBO 1, carril central, sin power-ups ni objetos en pista).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/endless-runner/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración figura en `prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** vista cenital con 3 carriles discretos y salto; es la diferencia central con la variante 01 (vista lateral, saltar/agacharse). **No:** agacharse ni física de salto variable (el salto es de duración fija).
- **Sí:** vallas saltables y muros no saltables; obligan a combinar salto y cambio de carril.
- **Sí:** monedas con combo ×1–×5 que se rompe al fallar; premian la precisión y amplían el rango del leaderboard. **No:** monedas como moneda de tienda.
- **Sí:** tres power-ups (imán, escudo, x2) con duraciones fijas; **No:** más tipos ni mejoras persistentes.
- **Sí:** 3 vidas con 1500 ms de invulnerabilidad; partida algo más larga y perdonadora que la variante 01. **No:** vidas extra.
- **Sí:** nivel = zona cada 400 m (`showLevel: true`) con bonus 50 × zona; da hitos visibles en el HUD.
- **Sí:** `onScore` limitado a 10 Hz; la distancia cambia el puntaje casi cada frame.
- **Sí:** indicadores de power-ups dentro del canvas; son información de juego, no overlay de pausa/game over.
- **Sí:** valores de balance (velocidades, huecos, probabilidades, duraciones, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color magenta; **Sí:** `.cover-endless-runner` nueva.
- **Sí:** canvas 400×640 vertical: tres carriles legibles y buen encaje en móvil.
- **Sí:** `sort_order` 7 para no chocar con el 6 reservado por `missile-command`.
- **No:** sonido, táctil/swipe, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Filas consecutivas imposibles (carril libre lejano sin tiempo a 720 px/s).            | `rowGap` mínimo 240 px (0,33 s a 720 px/s) ≥ 2 cambios de carril (240 ms); verificar zona 11+ en el paso 6 y ajustar el spec. |
| Monedas colocadas encima de obstáculos.                                               | Monedas solo en un carril libre de su fila, centradas en la banda (span 196 px); filas vecinas a ≥ 240 px no las alcanzan.   |
| Golpe repetido cada frame mientras se atraviesa un obstáculo.                         | Invulnerabilidad 1500 ms (1000 ms tras escudo); el obstáculo no colisiona durante ella.                                       |
| `onScore` por frame satura React.                                                     | Emitir solo si cambió y como máximo cada 100 ms; valor final forzado al morir.                                                |
| `dt` grande tras pausar o cambiar de pestaña consume power-ups o teletransporta filas. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; temporizadores solo avanzan en juego.                    |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                          |
| Canvas vertical 5:8 muy alto en escritorio a 1280 px.                                 | `GamePlayer` fija `--game-ar` y limita el alto; verificar que no desborda a 1280 px ni a 375 px.                              |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                        |
| El id con guion requiere comillas en `ENGINES` y nombre de migración.                 | Clave `"endless-runner"` entre comillas; carpeta `lib/games/endless-runner/`; migración `add_game_endless_runner`.            |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                               |

---

## What is **not** in this spec

- Controles táctiles, swipe, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Deslizarse/agacharse, trenes, plataformas elevadas, vidas extra, tienda y mejoras persistentes.
- HUD nativo de texto dentro del canvas (más allá de los indicadores de power-ups) y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
