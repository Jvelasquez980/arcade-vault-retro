# SPEC GJ-centipede-01 — Juego real: CENTIPEDE (variante: clásico entre hongos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-28
> **Variant:** 01 de 2 — Clásico fiel: cañón en zona inferior, un disparo en pantalla, ciempiés que se parte en hongos, araña y pulga, 3 vidas y oleadas como niveles.
> **Objective:** Crear un motor TypeScript de Centipede (variante clásica) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Centipede. Reproduce el arcade de 1981 en su forma reconocible: el jugador mueve un cañón dentro de una franja inferior, dispara **un único proyectil a la vez** y destruye un ciempiés que baja zigzagueando entre hongos. Cada segmento destruido se convierte en hongo y parte al ciempiés en dos. Se pierde una vida al tocar un segmento, la araña o la pulga; hay **3 vidas**, vida extra por puntos y las **oleadas son niveles**. Se distingue de la variante 02 (contrarreloj sin vidas, reloj que baja, combo multiplicador, power-ups y disparo múltiple).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `SHOOTER`, color `green`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` reserva 6 en sus specs propuestos), dificultad 4, tags `CLÁSICO` y `HONGOS`, 1 jugador, teclado. Canvas **480×512**, rejilla de **30 columnas × 32 filas de 16 px**. **3 vidas** (`initialLives: 3`), **nivel = oleada** (`showLevel: true`), sin stats extra. Movimiento del ciempiés **a saltos de celda** (sin interpolación). Sin escorpión. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/rules.ts`: constantes (`COLS`, `ROWS`, `CELL`, `ZONE_TOP_ROW`) y funciones puras (`stepMs(wave)`, `waveLayout(wave)`, `spiderPoints(dist)`, `nextHeadMove(seg, isBlocked)`).
- Módulo `lib/games/centipede/draw.ts`: `drawBackground`, `drawMushroom(hp, color)`, `drawSegment(isHead)`, `drawPlayer`, `drawShot`, `drawSpider`, `drawFlea` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: fondo `linear-gradient(180deg,#001a0a,#0a0a18)`, `::after` con cinco círculos verdes encadenados en diagonal (ciempiés, `var(--green)`) y `::before` con tres semicírculos magenta (hongos), con `drop-shadow` verde.
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×512**.
- HUD de React: puntaje, **3 vidas** y **nivel** (oleada). Sin HUD nativo en el canvas.
- Controles: `←↑→↓` y `WASD` mueven el cañón; `Espacio` dispara (mantener = autodisparo). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse/trackball, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Escorpión y hongos envenenados, cabezas extra por permanencia en la zona inferior, power-ups, reloj.
- Animación interpolada entre celdas.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Parte al ciempiés antes de que te alcance.',
       'Mueve el cañón con las flechas o WASD por la franja inferior y dispara con Espacio. Cada segmento que aciertas se convierte en hongo y parte al ciempiés en dos; las cabezas valen más. Cuidado con la araña, que salta por tu zona, y con la pulga, que siembra hongos al caer. Tienes tres vidas y cada oleada es más rápida.',
       'SHOOTER', 'green', 'cover-centipede', 1, 1, '{keyboard}', '{CLÁSICO,HONGOS}', 4, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 480, height: 512,
      initialLives: 3,
      showLevel: true,
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `mushrooms: Map<cellKey, hp>` (`cellKey = row * 30 + col`), `segments: { col, row, dx, dy, isHead, nextId }[]` (cadenas enlazadas por índice del segmento anterior), `stepAcc`, `player { x, y }`, `keys` (arriba/abajo/izq/der/fuego mantenidos), `shot { x, y } | null`, `spider { x, y, vx, vy } | null`, `spiderTimer`, `flea { x, y, vy, hits, lastRow } | null`, `fleaCheckMs`, `wave`, `lives`, `score`, `nextExtraAt`, `deathMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El movimiento y el fuego son continuos mientras se mantiene la tecla (`e.repeat` no añade nada).
- Pausa/blur/destroy limpian `keys`; al reanudar se reinicia `lastTime` y `stepAcc = 0`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 30 columnas × 32 filas de 16 px. Zona del jugador: filas **26–31** (`y` 416–512).
- **Hongos:** al iniciar la partida se colocan **40** en celdas distintas al azar de las filas 1–25 (columnas 0–29). Cada hongo tiene **4 HP**; cada impacto resta 1 y se dibuja más pequeño (4/4 → 1/4 del alto). Al llegar a 0 desaparece y suma **1** punto. Los hongos persisten entre oleadas.
- **Cañón:** cuadrado lógico de 12×12 px centrado en `player`; empieza en (240, 496). Se mueve a **240 px/s** en 8 direcciones, limitado a `x ∈ [6, 474]`, `y ∈ [422, 506]`. No puede solaparse con hongos: el movimiento se resuelve eje por eje y se cancela el eje que provocaría solape.
- **Disparo:** proyectil de 2×10 px a **900 px/s** hacia arriba desde la punta del cañón. **Solo uno en pantalla**; con `Espacio` mantenido se dispara uno nuevo en cuanto el anterior desaparece. El avance se integra en subpasos de ≤ 8 px; en cada subpaso se comprueba colisión en orden segmento → pulga → araña → hongo y el proyectil se consume con el primer impacto. Sale por `y < 0` sin efecto.
- **Ciempiés por oleada (`waveLayout`):** 12 segmentos en total. Oleada 1: una cadena de 12. Oleada `n ≥ 2`: una cadena de `12 − k` más `k` cabezas sueltas, con `k = min(n − 1, 6)`. La cadena entra con la cabeza en (col 14, fila 0), `dx = +1`, y el cuerpo en columnas 13, 12, … (las columnas negativas no se dibujan y entran por el rastro). Las cabezas sueltas aparecen en la fila 0 en columnas al azar con `dx` al azar.
- **Movimiento:** todos los segmentos avanzan una celda cada `stepMs(wave) = max(55, 100 − 5 × (wave − 1))` ms. Cada cabeza intenta `col + dx`; si sale de 0–29 o hay un hongo, baja a `row + dy` y invierte `dx`. `dy` empieza en +1; si la fila destino supera 31 pasa a `dy = −1`; con `dy = −1`, si la fila destino es menor que 26 vuelve a `dy = +1`. Cada segmento de cuerpo ocupa la celda que dejó el segmento anterior en ese mismo paso.
- **Impacto en segmento:** se elimina, deja un hongo de 4 HP en su celda (si está vacía) y el segmento siguiente, si existe, pasa a ser cabeza con el `dx` de su último movimiento horizontal y el `dy` de la cadena. Puntos: **100** cabeza, **10** cuerpo.
- **Araña:** primera aparición a los 5000 ms de cada oleada; tras salir o morir, la siguiente a los `6000 + rand × 4000` ms. Entra por el lado izquierdo o derecho (al azar) en `y` aleatoria de la zona, cuerpo 24×12 px. Velocidad horizontal **100 px/s** hacia el lado opuesto y vertical **140 px/s** rebotando entre `y = 420` y `y = 504`. Elimina los hongos de las celdas que toca su centro (sin puntos). Al salir del lado opuesto desaparece. Muere con 1 impacto: **900** si la distancia al cañón es < 48 px, **600** si < 96 px, si no **300**.
- **Pulga:** desde la oleada 2. Cada 1000 ms, si no hay pulga y hay menos de **5** hongos en las filas 26–31, aparece en una columna al azar (fila −1) y cae a **300 px/s**. Al entrar en cada fila de 1 a 25, con probabilidad **0.25** deja un hongo de 4 HP si la celda está vacía. Requiere **2** impactos: el primero sube su velocidad a **600 px/s**; el segundo la destruye (+**200**). Sale por abajo sin efecto.
- **Muerte:** si el rect del cañón toca un segmento (rect de celda con 2 px de margen), la araña o la pulga → `lives − 1`, `onLives(lives)`. Si `lives = 0` → `onGameOver(score)`. Si no, `deathMs = 1000` (todo congelado y sin entrada); al terminar: cada hongo con HP < 4 se restaura a 4 sumando **5** puntos, se retiran araña, pulga y proyectil, los segmentos restantes (`k`) se reagrupan en una sola cadena de `k` que entra como al inicio de oleada, y el cañón vuelve a (240, 496). El temporizador de araña se reinicia a 5000 ms.
- **Fin de oleada:** sin segmentos vivos → `wave + 1`, `onLevel(wave)`, nuevo ciempiés según `waveLayout`, hongos intactos, araña/pulga retiradas.
- **Vida extra:** cada **12000** puntos (`nextExtraAt` 12000, 24000, …) +1 vida hasta un máximo de **6** → `onLives(lives)`. Si ya hay 6, el umbral se consume sin efecto.
- **Dibujo:** fondo `#000`. Hongos: semicírculo + tallo; color por oleada en ciclo `#ff2bd6`, `#00f5ff`, `#ffe600`, `#ff7a00` (oleada 1 = magenta). Segmentos: círculos de 14 px `#39ff14` con borde `#1fae0c`; cabeza `#ffe600` con dos ojos negros. Cañón: cabeza `#00f5ff` con base blanca. Proyectil `#ffffff`. Araña `#ff3355` con 8 patas en línea. Pulga `#ffffff` alargada. Línea tenue `rgba(0,245,255,0.15)` marcando el borde superior de la zona (`y = 416`).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila; `npm run build`.
2. Crear `lib/games/centipede/rules.ts`. Verificar: `npm run lint`; `stepMs(1) = 100`, `stepMs(10) = 55`, `stepMs(20) = 55`, `waveLayout(1)` = cadena 12 + 0 sueltas, `waveLayout(3)` = cadena 10 + 2 sueltas, `waveLayout(9)` = cadena 6 + 6 sueltas, `spiderPoints(40) = 900`, `spiderPoints(100) = 300`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): disparo único y autodisparo, hongos de 4 impactos, partir el ciempiés (hongo + nueva cabeza), zigzag y rebote en la zona inferior, araña con 300/600/900, pulga desde oleada 2, muerte y restauración de hongos (+5), fin de oleada y nivel, vida extra a 12000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas. Registrar la migración en la tabla de `references/production/prod-setup.md`.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`HONGOS`, dificultad 4, color verde, categoría SHOOTER).
- [ ] `/games/centipede/jugar` muestra el canvas 480×512 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven el cañón a 240 px/s solo dentro de las filas 26–31; no atraviesa hongos; flechas y `Espacio` no hacen scroll.
- [ ] Nunca hay más de un proyectil en pantalla; mantener `Espacio` dispara de nuevo en cuanto el anterior desaparece.
- [ ] La partida empieza con 40 hongos en filas 1–25 y una cadena de 12 segmentos en la fila 0; cada hongo aguanta 4 impactos y destruido suma 1.
- [ ] El ciempiés avanza una celda cada 100 ms en la oleada 1, baja e invierte al chocar con borde u hongo y rebota dentro de la zona inferior.
- [ ] Acertar un segmento suma 10 (cuerpo) o 100 (cabeza), deja un hongo en su celda y el siguiente segmento se convierte en cabeza.
- [ ] La araña aparece a los 5 s de la oleada, come hongos y vale 900 / 600 / 300 según distancia (< 48, < 96, resto).
- [ ] Desde la oleada 2 cae la pulga cuando hay menos de 5 hongos en la zona; necesita 2 impactos (acelera tras el primero) y vale 200.
- [ ] Tocar un segmento, la araña o la pulga quita una vida; tras 1 s los hongos dañados se restauran sumando 5 cada uno y el ciempiés restante reentra por arriba.
- [ ] Destruir los 12 segmentos sube el nivel en el HUD; la oleada `n` trae `min(n − 1, 6)` cabezas sueltas y paso `max(55, 100 − 5 × (n − 1))` ms.
- [ ] Cada 12000 puntos se gana una vida (máx. 6).
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0) y nivel; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela ciempiés, araña, pulga, proyectil y temporizadores; reanudar sin salto ni pasos dobles ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, 40 hongos nuevos, cadena de 12, sin araña ni pulga).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade original; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** un solo proyectil en pantalla con autodisparo; es la regla que define el ritmo del clásico y la diferencia con la variante 02.
- **Sí:** 3 vidas, vida extra cada 12000 (máx. 6) y oleadas como nivel; **No:** reloj ni combos.
- **Sí:** araña y pulga; **No:** escorpión ni hongos envenenados (alcance de un motor; spec aparte si llega).
- **Sí:** cuerpo que sigue el rastro de la cabeza y paso de celda; **No:** interpolación (simplifica colisiones y es fiel al arcade).
- **Sí:** restaurar hongos dañados tras morir (+5 c/u); es la recompensa clásica y mantiene el puntaje competible.
- **Sí:** valores de balance (velocidades, puntos, intervalos, 40 hongos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER y color green (coincide con la sugerencia del `game-planner`); **Sí:** `.cover-centipede` nueva.
- **Sí:** `sort_order` 7 para no chocar con `missile-command` (6, propuesto).
- **No:** sonido, táctil, mouse/trackball, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| El proyectil a 900 px/s atraviesa celdas de 16 px en un frame. | Subpasos de ≤ 8 px con comprobación de colisión en cada uno. |
| Al partir la cadena se pierde la dirección del nuevo segmento cabeza. | Cada segmento guarda `dx`/`dy` de su último movimiento; el nuevo cabeza los hereda. |
| Ciempiés atrapado en bucle entre hongos y bordes en la zona inferior. | Regla de rebote vertical `dy` explícita entre filas 26 y 31; verificar en el paso 6. |
| `dt` grande tras pausar o cambiar de pestaña provoca pasos múltiples. | `lastTime` y `stepAcc` se reinician al reanudar y tras blur; `dt` capado a 50 ms. |
| Flechas, `WASD` o espacio interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Movimiento "pegado" tras perder foco. | `blur` y `pause` limpian `keys`. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| Canvas 480×512 (casi 1:1, vertical) deja poco margen en móvil. | `GamePlayer` fija `--game-ar`; verificar 375 px en el paso 6. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse/trackball y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Escorpión, hongos envenenados, cabezas extra por permanencia, power-ups y reloj.
- Animación interpolada entre celdas.
- HUD nativo dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
