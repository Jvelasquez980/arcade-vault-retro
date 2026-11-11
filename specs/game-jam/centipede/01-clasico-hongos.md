# SPEC GJ-centipede-01 — Juego real: CENTIPEDE (variante: clásico de hongos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-11
> **Variant:** 01 de 2 — Clásico arcade fiel: 3 vidas, oleadas de ciempiés de 12 segmentos que se parten al disparar, hongos de 4 impactos, araña y pulga, vida extra por puntos.
> **Objective:** Crear un motor TypeScript de Centipede (variante clásica) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Centipede. Reproduce el bucle del arcade de 1981: un cañón confinado en la franja inferior dispara hacia arriba a un ciempiés que baja en zigzag rebotando contra hongos y bordes; cada segmento alcanzado se convierte en hongo y parte al ciempiés en dos. Hay **vidas**, **oleadas** (nivel), **araña** que acosa la zona del jugador y **pulga** que siembra hongos. Se distingue de la variante 02 (contrarreloj sin vidas, multiplicador de combo, power-ups y bonus de tiempo por oleada).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `SHOOTER`, color `green`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, missile-command reserva 6), dificultad 3, tags `CLÁSICO` y `HONGOS`, 1 jugador, teclado. Canvas **480×600**, rejilla de **24 columnas × 30 filas de 20 px**. **3 vidas** (`initialLives: 3`), **nivel = oleada** (`showLevel: true`), stat extra `SEGMENTOS`. Sin escorpión ni hongos envenenados. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/field.ts`: funciones puras sobre la rejilla (`cellOf(x, y)`, `hasMushroom(grid, c, r)`, `stepChain(chain, grid)` que calcula el siguiente paso de un ciempiés, `splitChain(chain, index)`, `tickMs(wave)`, `spiderPoints(dist)`) y constantes (`COLS`, `ROWS`, `CELL`, `ZONE_TOP`).
- Módulo `lib/games/centipede/draw.ts`: `drawBackground`, `drawMushroom` (según salud), `drawSegment` (cabeza/cuerpo), `drawPlayer`, `drawBullet`, `drawSpider`, `drawFlea`, `drawDeath` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: `linear-gradient(180deg,#001a0a,#0a0a18)` con `::after` de una fila de 6 círculos verdes `#39ff14` en zigzag (ciempiés) y `::before` de 4 hongos (semicírculos magenta `#ff2bd6` sobre tallo) dispersos.
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×600** (4:5).
- HUD de React: puntaje, **3 vidas**, **nivel** (oleada) y stat extra `segs` ("SEGMENTOS", `int`).
- Sin HUD nativo de texto en el canvas.
- Controles: `←↑→↓` y `WASD` mueven el cañón; `Espacio` dispara (mantener = autodisparo). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse/trackball, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Escorpión, hongos envenenados, cabezas extra por llegar al fondo, modo 2 jugadores.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Parte al ciempiés entre los hongos.',
       'Mueve el cañón por la franja inferior con las flechas o WASD y dispara con Espacio. El ciempiés baja en zigzag rebotando en los hongos; cada segmento que aciertas se vuelve hongo y lo parte en dos. Esquiva la araña, derriba la pulga y limpia cada oleada antes de perder tus tres vidas.',
       'SHOOTER', 'green', 'cover-centipede', 1, 1, '{keyboard}', '{CLÁSICO,HONGOS}', 3, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 480, height: 600,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "segs", label: "SEGMENTOS", color: "green", format: "int" }],
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `grid: Uint8Array(24 × 30)` (salud de hongo 0–4 por celda), `chains: { segs: { c, r, pc, pr, dx }[], dirX: -1 | 1, dirY: -1 | 1 }[]` (`pc/pr` = celda previa para interpolar), `stepAcc`, `player { x, y }`, `keys { left, right, up, down, fire }`, `bullet { x, y } | null`, `spider { x, y, vx, vy } | null`, `spiderTimer`, `flea { x, y, vy, hits } | null`, `fleaTimer`, `wave`, `lives`, `score`, `nextLifeAt`, `dying { ms } | null`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("segs", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("segs", 12)`. `segs` = segmentos vivos sumando todas las cadenas; valor 0 lo oculta (esperado un instante al cambiar de oleada).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa.
- Pausa/blur/destroy ponen todas las `keys` a `false`; al reanudar se reinicia `lastTime` y `stepAcc` no acumula el tiempo pausado; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Rejilla:** 24 × 30 celdas de 20 px; celda `(c, r)` ocupa `x = 20c`, `y = 20r`. **Zona del jugador:** filas 24–29 (`y ≥ 480`).
- **Hongos:** al iniciar la partida se colocan **34** hongos en celdas aleatorias distintas de las filas 1–22, con salud **4**. El campo persiste entre oleadas. Cada impacto de bala resta 1 de salud; a 0 desaparece y suma **1** punto.
- **Cañón:** rectángulo lógico de **14×16 px** (hitbox interna 12×12 centrada), arranca en (233, 570). Se mueve a **220 px/s** en ambos ejes (diagonal sin normalizar), limitado a `x ∈ [0, 466]`, `y ∈ [480, 584]`. No atraviesa hongos: el movimiento se resuelve por eje y se cancela en el eje que entraría en una celda con hongo.
- **Disparo:** una sola bala en pantalla (2×10 px) que sale del centro superior del cañón a **960 px/s** hacia arriba. Con `Espacio` mantenido se dispara en cuanto no hay bala (autodisparo). La bala se mueve en subpasos de **≤ 8 px** para no atravesar celdas y desaparece al impactar o al salir por `y < 0`. Orden de impacto en cada subpaso: pulga, araña, segmento, hongo.
- **Ciempiés:** cada oleada empieza con una cadena de **12** segmentos en la fila 0, cabeza en la columna 11 y cuerpo en columnas 10…0, `dirX = 1`, `dirY = 1`. Desde la oleada 2 se añaden además `min(wave − 1, 6)` cabezas sueltas (cadenas de 1) en la fila 0, columnas aleatorias libres, `dirX` aleatorio.
- **Paso:** todas las cadenas avanzan una celda cada `tickMs(wave) = max(70, 120 − 6 × (wave − 1))` ms (acumulador). Se dibujan interpoladas entre `(pc, pr)` y `(c, r)` según `stepAcc / tickMs`.
- **Movimiento de la cabeza:** intenta `c + dirX`. Si esa celda está fuera de 0–23 o tiene hongo, en su lugar baja/sube una fila (`r + dirY`) e invierte `dirX`. Si `r + dirY` sale de la rejilla por abajo (fila 29) o, subiendo, quedaría por encima de la fila 24, se invierte `dirY` antes de moverse. El cuerpo sigue: cada segmento toma la celda previa del que le precede. Cada segmento guarda en `dx` su último desplazamiento horizontal.
- **Impacto en segmento:** el segmento desaparece, en su celda aparece un hongo de salud 4 (si no lo había) y suma **100** si era cabeza o **10** si era cuerpo. Los segmentos detrás forman una cadena nueva cuya cabeza es el siguiente segmento, con `dirX = dx` de ese segmento y el mismo `dirY` de la cadena original. `onStat("segs", n)`.
- **Fin de oleada:** sin segmentos vivos → `wave + 1`, `onLevel(wave)` y aparece la nueva oleada en el siguiente paso.
- **Araña:** si no hay araña, `spiderTimer` aleatorio en **[5000, 9000] ms**; al vencer entra por el borde izquierdo o derecho (azar) a una `y` aleatoria en [480, 584]. `vx = ±min(100 + 10 × (wave − 1), 180)` px/s hacia el lado opuesto y `vy = ±160` px/s rebotando entre `y = 470` y `y = 590`. Tamaño 24×14. Se come (elimina sin puntos) los hongos de las celdas que toca. Sale al cruzar el borde opuesto. Puntos al matarla según distancia entre centros araña–cañón: **< 60 px = 900**, **< 120 px = 600**, resto **300**.
- **Pulga:** desde la oleada 2, cada **3000 ms** se comprueba: si no hay pulga y hay menos de **5** hongos en la zona del jugador, cae una pulga en una columna aleatoria desde `y = −20` a **360 px/s**. Al entrar en cada celda de las filas 1–28 sin hongo, deja un hongo de salud 4 con probabilidad **0.3**. Necesita **2** impactos: el primero la acelera a **600 px/s**; el segundo la mata (+**200**). Sale por abajo sin efecto.
- **Muerte del jugador:** la hitbox del cañón toca un segmento (celda interpolada 16×16 centrada), la araña o la pulga → `lives − 1`, `onLives(lives)`. Se congela el juego **1500 ms** (`dying`, animación de chispas), luego: se quitan araña, pulga y bala; cada hongo con salud < 4 vuelve a 4 sumando **5** puntos por hongo; los segmentos vivos se reagrupan en una sola cadena del mismo largo en la fila 0 (cabeza en la columna `min(largo − 1, 23)`, `dirX = 1`, `dirY = 1`); el cañón vuelve a (233, 570). Si `lives` llega a 0: `onLives(0)` y `onGameOver(score)` al terminar la animación, sin restaurar hongos.
- **Vida extra:** cada **12000** puntos (`nextLifeAt` 12000, 24000, …) +1 vida hasta un máximo de **6** → `onLives(lives)`; con 6 el umbral se consume sin efecto.
- **Dibujo:** fondo `#000`. Hongos: sombrero semicircular `#ff2bd6` de 18 px y tallo `#ffe600`; con salud `h` se dibuja solo la parte superior `h/4` del alto. Cabeza `#39ff14` (círculo de radio 9 con dos ojos `#000`), cuerpo `#1fae0c` (radio 8). Cañón `#00f5ff` con punta blanca. Bala `#ffffff`. Araña `#ff3355` (cuerpo elíptico + 8 patas de línea). Pulga `#ffe600` (gota). Muerte: 12 chispas `#ffffff` que se expanden 40 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/centipede/field.ts`. Verificar: `npm run lint`; `tickMs(1) = 120`, `tickMs(9) = 72`, `tickMs(20) = 70`, `spiderPoints(30) = 900`, `spiderPoints(100) = 600`, `spiderPoints(200) = 300`; `stepChain` con hongo delante baja una fila e invierte `dirX`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover el cañón por la zona y contra hongos, autodisparo, gastar un hongo en 4 impactos, partir el ciempiés (hongo nuevo y nueva cabeza), limpiar la oleada 1 (nivel 2 con cabezas extra), araña con los 3 rangos de puntos, pulga en oleada 2 con 2 impactos, morir (restauración de hongos +5 y reagrupación), vida extra a 12000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`HONGOS`, dificultad 3, color verde, categoría SHOOTER).
- [ ] `/games/centipede/jugar` muestra el canvas 4:5 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven el cañón a 220 px/s solo dentro de las filas 24–29; no atraviesa hongos; las flechas y `Espacio` no hacen scroll.
- [ ] Nunca hay más de una bala; mantener `Espacio` dispara de nuevo en cuanto la anterior desaparece; la bala no atraviesa hongos ni segmentos aunque `dt` sea 50 ms.
- [ ] La partida empieza con 34 hongos en filas 1–22 y un ciempiés de 12 segmentos en la fila 0; el HUD muestra SEGMENTOS 12.
- [ ] Un hongo desaparece al 4.º impacto y suma 1 punto; se dibuja más corto con cada impacto.
- [ ] El ciempiés avanza una celda cada 120 ms en la oleada 1, baja una fila e invierte al chocar con hongo o borde, y rebota dentro de la zona del jugador.
- [ ] Acertar un segmento suma 100 (cabeza) o 10 (cuerpo), deja un hongo en su celda y parte la cadena; la parte trasera sigue con cabeza propia.
- [ ] Al limpiar la oleada sube el nivel del HUD, aparece un ciempiés de 12 más `min(wave − 1, 6)` cabezas sueltas y el paso es 6 ms más rápido (mínimo 70 ms).
- [ ] La araña aparece cada 5–9 s en la zona del jugador, come hongos y vale 900 / 600 / 300 según distancia (< 60, < 120, resto).
- [ ] Desde la oleada 2, con menos de 5 hongos en la zona del jugador cae una pulga que siembra hongos; muere al 2.º impacto (+200) tras acelerar con el 1.º.
- [ ] Tocar segmento, araña o pulga quita una vida, congela 1500 ms, restaura los hongos dañados (+5 c/u) y reagrupa el ciempiés en la fila 0 con el mismo largo.
- [ ] Cada 12000 puntos se gana una vida (máximo 6).
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y SEGMENTOS; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela ciempiés, araña, pulga, bala y temporizadores; reanudar sin salto ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, SEGMENTOS 12, 34 hongos nuevos, sin araña ni pulga).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade original simplificadas; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** ciempiés por rejilla con paso discreto e interpolación visual; **No:** movimiento continuo por píxel (complica colisiones con hongos sin aportar al bucle clásico).
- **Sí:** cuerpo que sigue a la cabeza celda a celda (como Snake); permite partir cadenas de forma determinista.
- **Sí:** 3 vidas, vida extra cada 12000 (máx. 6) y restauración de hongos al morir, como el original.
- **Sí:** araña y pulga; **No:** escorpión ni hongos envenenados (reducen alcance a un solo motor y se pueden añadir en otro spec).
- **Sí:** nivel = oleada (`showLevel: true`) y stat `SEGMENTOS` (cuánto falta para limpiar la oleada).
- **Sí:** una bala con autodisparo y subpasos de 8 px; reproduce el ritmo del original sin tunelado.
- **Sí:** valores de balance (velocidades, salud, puntos, temporizadores) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER, color verde y `.cover-centipede` nueva.
- **Sí:** canvas 480×600 (4:5, vertical como el mueble original).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| La bala a 960 px/s atraviesa hongos o segmentos con `dt` de 50 ms.                     | Subpasos de ≤ 8 px con orden de impacto fijo; criterio de aceptación.                                       |
| Cadenas nuevas tras un corte se solapan o giran hacia su propio cuerpo.                | `dirX` del nuevo jefe = `dx` de su último movimiento; segmentos de una cadena no colisionan entre sí.       |
| Ciempiés atascado entre hongos y borde (bucle de bajar/invertir).                      | Bajar siempre es posible (la regla vertical no mira hongos); en fila 29 se invierte `dirY`.                 |
| La pulga satura la zona del jugador de hongos y bloquea el cañón.                      | Solo aparece con < 5 hongos en zona, comprobación cada 3 s y probabilidad 0.3 por celda; la araña los come. |
| `dt` grande tras pausar o cambiar de pestaña hace dar varios pasos de golpe.           | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                        |
| Flechas, WASD o espacio interfieren con el input del modal.                            | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                        |
| Tecla "pegada" tras perder foco mueve el cañón solo.                                   | `blur` y `pause` ponen todas las `keys` a `false`.                                                          |
| Doble loop / listeners por StrictMode.                                                 | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                      |
| Next 16 difiere del conocimiento previo.                                               | Paso 1 consulta `node_modules/next/dist/docs/`.                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse/trackball y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Escorpión, hongos envenenados, cabezas extra por llegar al fondo, 2 jugadores.
- Multiplicadores de combo, power-ups o contrarreloj.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
