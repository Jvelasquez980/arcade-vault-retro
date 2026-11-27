# SPEC GJ-centipede-01 — Juego real: CENTIPEDE (variante: clásico entre hongos) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-27
> **Variant:** 01 de 2 — Centipede arcade fiel: movimiento libre en la zona del jugador, un solo disparo en pantalla, ciempiés por oleadas que se parte en hongos, pulga, araña y escorpión con hongos envenenados.
> **Objective:** Crear un motor TypeScript de Centipede dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Centipede. Recrea el arcade de 1981: el jugador se mueve **libremente** (ambos ejes) dentro de una franja inferior de 6 filas, con **un solo disparo en pantalla** (mantener `Espacio` = autodisparo en cuanto el anterior desaparece), y debe destruir un **ciempiés por oleadas** que baja serpenteando entre hongos. Cada segmento abatido se convierte en hongo y parte la cadena en dos. Completan el ecosistema la **pulga** (siembra hongos), la **araña** (zigzaguea en la zona del jugador y come hongos) y el **escorpión** (envenena hongos: el ciempiés que toca uno se lanza en picado). Se distingue de la variante 02 (cañón fijo en un riel horizontal, ráfagas múltiples, enjambre continuo por tiempo, power-ups, combo y vidas perdidas cuando un ciempiés **escapa**): aquí el reto es **posicionarse y racionar el único disparo**, con ritmo por oleadas.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con círculos, rectángulos y líneas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `SHOOTER`, color `green`, `sort_order` **7** (siguiente libre: frogger = 5 y `missile-command` tiene reservado el 6 en sus specs de game jam), dificultad 4, tags `CLÁSICO` y `HONGOS`, 1 jugador, teclado. Canvas **480×512**, rejilla de **30 columnas × 32 filas de 16 px**. **3 vidas** (`initialLives: 3`), **nivel = oleada** (`showLevel: true`), sin stats extra. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/rules.ts`: funciones puras y constantes (`COLS = 30`, `ROWS = 32`, `CELL = 16`, `ZONE_TOP = 26`, `waveConfig(w) → { chainLen, extraHeads, stepMs }`, `spiderPoints(dy)`, `stepHead(head, mushrooms, bounds)`).
- Módulo `lib/games/centipede/draw.ts`: `drawMushroom`, `drawSegment`, `drawPlayer`, `drawBullet`, `drawFlea`, `drawSpider`, `drawScorpion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: fondo `linear-gradient(180deg,#06140a,#0a0a18)`, `::after` con una fila de 7 círculos verdes `#39ff14` (cabeza `#ff3355`) en diagonal (cadena de `radial-gradient`) y `::before` con 5 hongos magenta `#ff2bd6` (semicírculo sobre tallo cyan).
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrar ambas en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **480×512**.
- HUD de React: puntaje, **3 vidas** y **nivel** (= oleada). Sin stats extra.
- Sin HUD nativo de texto en el canvas ni overlays.
- Controles: `←↑→↓` y `WASD` mueven al jugador; `Espacio` dispara (mantener = autodisparo). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse/trackball, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores alternos, selector de dificultad, tabla de récords propia.
- Animación interpolada de los segmentos entre celdas.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Destruye al ciempiés entre los hongos.',
       'Muévete con las flechas o WASD por la zona inferior y dispara con Espacio (un solo disparo a la vez). El ciempiés baja serpenteando entre hongos: cada segmento abatido se vuelve hongo y parte la cadena. Cuidado con la araña, la pulga y el escorpión, que envenena hongos. Tienes 3 vidas y una extra cada 12000 puntos.',
       'SHOOTER', 'green', 'cover-centipede', 1, 1, '{keyboard}', '{CLÁSICO,HONGOS}', 4, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 480, height: 512,
      initialLives: 3,
      showLevel: true,
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `player { x, y }` (centro, px), `keysDown: Set<string>`, `fireHeld`, `bullet { x, y } | null`, `mushrooms: Map<number, { hp: 1..4, poisoned: boolean }>` (clave `row * 30 + col`), `chains: { segs: { c, r }[], dir: 1 | -1, vdir: 1 | -1, diving: boolean }[]` (cabeza en índice 0; segmentos con `r = −1` están en cola fuera de pantalla), `stepAcc`, `stepMs`, `flea { x, y, hp, speed } | null`, `fleaTimer`, `spider { x, y, vx, vy } | null`, `spiderTimer`, `scorpion { x, row, vx } | null`, `scorpionTimer`, `zoneHeadTimer`, `wave`, `lives`, `score`, `nextLifeAt`, `phase: "play" | "dying"`, `phaseMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El movimiento usa `keysDown` (continuo mientras se mantiene) y el disparo `fireHeld`.
- Pausa/blur/destroy vacían `keysDown` y `fireHeld`; al reanudar se reinicia `lastTime` y `stepAcc = 0`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, transición de oleada ni game over dentro del canvas.

**Reglas del juego:**

- **Tablero:** 30×32 celdas de 16 px; fila 0 arriba. **Zona del jugador:** filas 26–31 (`y ∈ [416, 512]`).
- **Hongos iniciales:** 45 en celdas aleatorias distintas de las filas 1–25 (nunca en la zona del jugador al empezar). Cada hongo tiene **4 PV**; cada impacto de bala resta 1 y se dibuja más bajo (alto proporcional a `hp / 4`). Destruirlo suma **1** punto.
- **Jugador:** cuadrado de 14×14 px (hitbox); empieza en (240, 488). Se mueve a **220 px/s** por eje con flechas/WASD (diagonal sin normalizar), limitado a `x ∈ [7, 473]`, `y ∈ [423, 505]`. Los hongos son sólidos: el movimiento se resuelve por eje (se aplica `x`; si solapa un hongo se revierte; igual con `y`).
- **Disparo:** máximo **1 bala** en pantalla. Con `Espacio` mantenido, en cuanto no hay bala se dispara otra desde el borde superior del jugador. Bala de 2×10 px a **960 px/s** hacia arriba, avanzada en sub-pasos de ≤ 8 px para no atravesar celdas. Impacta lo primero que toca (segmento, pulga, araña, escorpión u hongo) y desaparece; al salir por arriba también.
- **Oleada `w`** (`waveConfig`, con `c = (w − 1) mod 12`): una cadena de `12 − c` segmentos más `c` cabezas sueltas; `stepMs = max(60, 100 − 4 × (w − 1))` (oleada 1: 100 ms por celda; desde la 11: 60 ms).
- **Entrada:** la cadena principal entra por la columna 15, fila 0, `dir = −1`, con todos sus segmentos en cola en `r = −1` (entran uno por paso siguiendo la estela). Las cabezas sueltas entran en fila 0 en columnas aleatorias distintas, `dir` aleatorio. Las celdas con `r = −1` no se dibujan ni colisionan.
- **Paso del ciempiés** (cada `stepMs`, todas las cadenas a la vez): cada segmento del cuerpo ocupa la posición anterior del segmento de delante; la cabeza intenta `(c + dir, r)`:
  - Si está fuera del tablero o hay un hongo → baja a `(c, r + vdir)` y `dir = −dir` (la bajada ignora hongos).
  - Si el hongo de destino está **envenenado** → `diving = true`: baja 1 fila por paso sin girar hasta llegar a la fila 26, luego `diving = false` y sigue normal.
  - Rebote vertical: con `vdir = 1` en la fila 31 pasa a `vdir = −1`; con `vdir = −1` en la fila 26 pasa a `vdir = 1` (una vez en la zona, la cabeza ya no sale de ella).
  - Los segmentos no colisionan entre sí (pueden solaparse).
- **Abatir un segmento:** se elimina, deja un hongo de 4 PV en su celda (si no hay ya uno) y la cadena se parte: `segs[0..i−1]` conserva cabeza y `dir`; `segs[i+1..]` forma una cadena nueva cuya cabeza es `segs[i+1]`, con `dir = sign(segs[i].c − segs[i+1].c)` (si es 0, el `dir` original) y el mismo `vdir`. Puntos: cabeza **100**, cuerpo **10**.
- **Cabezas de refuerzo:** mientras haya algún segmento en las filas 26–31, cada **6000 ms** entra una cabeza suelta en la fila 26 por la columna 0 (`dir = 1`) o 29 (`dir = −1`) al azar. Cuenta para terminar la oleada.
- **Pulga:** desde la oleada 2. Cada **1000 ms**, si no hay pulga y hay **menos de 5** hongos en las filas 26–31, aparece en una columna aleatoria en `y = −8` y cae a **320 px/s**. Al entrar en cada fila 1–25 coloca un hongo en su celda con probabilidad **0,25** (si está libre). Tiene **2 PV**: el primer impacto la acelera a **640 px/s**; el segundo la mata (**200** puntos). Desaparece al salir por abajo. Tocar al jugador lo mata.
- **Araña:** primera aparición **3000 ms** tras empezar la oleada; luego, tras morir o salir, la siguiente a los `4000 + random × 4000` ms. Entra por el borde izquierdo o derecho (al azar) con `y` aleatoria en `[416, 496]`, `vx = ±150 px/s` hacia el lado opuesto y `vy = ±200 px/s`, rebotando entre `y = 400` y `y = 504`. Hitbox 24×14. Elimina (sin puntos) los hongos cuya celda solapa. Sale al cruzar el borde opuesto. Puntos al abatirla según `dy = |spider.y − player.y|`: `dy < 32` → **900**, `dy < 64` → **600**, si no **300**. Tocar al jugador lo mata.
- **Escorpión:** desde la oleada 3. Cada **10000 ms**, si no hay escorpión, aparece con probabilidad **0,5** en una fila aleatoria 4–16 por un borde lateral y cruza a **100 px/s**. Todo hongo cuya celda atraviesa queda **envenenado**. Hitbox 24×14. Abatirlo: **1000** puntos. No entra en la zona del jugador.
- **Fin de oleada:** cuando no quedan segmentos (incluidos los en cola). `wave + 1`, `onLevel(wave)`, se lanza la composición de la nueva oleada; hongos, araña, pulga y escorpión siguen como estén; los temporizadores de araña/escorpión/refuerzo se reinician.
- **Muerte:** el hitbox del jugador solapa un segmento (celda de 16×16 reducida a 14×14), la pulga o la araña. Se resta 1 vida y `onLives(lives)`. Si `lives = 0` → `onLives(0)` y `onGameOver(score)` inmediatamente. Si no: `phase = "dying"` durante **1000 ms** (todo congelado, jugador parpadea); al terminar, cada hongo dañado o envenenado vuelve a 4 PV sin veneno sumando **5** puntos por hongo restaurado; se eliminan todas las cadenas, pulga, araña, escorpión y bala; se relanza **la misma oleada completa** (sin cambiar `wave`); el jugador vuelve a (240, 488) y se eliminan los hongos que solapen su hitbox de salida.
- **Vida extra:** cada **12000** puntos (`nextLifeAt` 12000, 24000, …) `lives + 1`, máximo **6**; `onLives(lives)`.
- **Dibujo:** fondo `#000`. Colores de hongo por oleada, índice `(w − 1) mod 4` → `[sombrero, tallo]`: `[#ff2bd6, #00f5ff]`, `[#00f5ff, #ffe600]`, `[#ffe600, #39ff14]`, `[#39ff14, #ff2bd6]`. Hongo envenenado: todo `#9b30ff`. Segmentos: círculo de radio 7, cuerpo `#39ff14`, cabeza `#ff3355` con dos ojos blancos de 2 px. Jugador: cabeza `#ffffff` con punta `#00f5ff`. Bala `#ffffff`. Pulga `#ffe600`, araña `#ff2bd6` con 8 patas en línea, escorpión `#ff8a00` con cola curva. Zona del jugador sin borde visible.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/centipede/rules.ts`. Verificar: `npm run lint`; `waveConfig(1)` = `{ chainLen: 12, extraHeads: 0, stepMs: 100 }`, `waveConfig(5)` = `{ 8, 4, 84 }`, `waveConfig(13)` = `{ 12, 0, 60 }`; `spiderPoints(20) = 900`, `spiderPoints(40) = 600`, `spiderPoints(80) = 300`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): moverse por la zona y chocar con hongos, disparar (una bala a la vez, autodisparo), partir el ciempiés y ver hongos nuevos, completar la oleada 1 (nivel 2), ver pulga (oleada 2+, zona casi sin hongos), araña comiendo hongos y puntos 300/600/900, escorpión envenenando (oleada 3+) y picado del ciempiés, morir (restauración de hongos +5, misma oleada), vida extra a 12000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'` (registrar en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; ambas migraciones constan en `prod-setup.md`.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`HONGOS`, dificultad 4, color verde, categoría SHOOTER).
- [ ] `/games/centipede/jugar` muestra el canvas 480×512 (15:16) sin desborde a 375 px y 1280 px.
- [ ] La partida empieza con 45 hongos en las filas 1–25, jugador en (240, 488) y un ciempiés de 12 segmentos entrando por la columna 15.
- [ ] Flechas y WASD mueven al jugador a 220 px/s solo dentro de las filas 26–31; los hongos lo bloquean; flechas y `Espacio` no hacen scroll.
- [ ] Nunca hay más de una bala en pantalla; mantener `Espacio` dispara de nuevo en cuanto la anterior desaparece; la bala no atraviesa hongos ni segmentos.
- [ ] Un hongo desaparece al 4.º impacto (+1 punto) y se ve más bajo con cada impacto.
- [ ] Abatir una cabeza suma 100 y un segmento de cuerpo 10; el segmento deja un hongo y la cadena se parte en dos que se mueven de forma independiente.
- [ ] El ciempiés avanza 1 celda cada 100 ms en la oleada 1, gira y baja al tocar un hongo o el borde y rebota entre las filas 26 y 31 al llegar abajo.
- [ ] La oleada 2 trae una cadena de 11 + 1 cabeza suelta a 96 ms por celda; el nivel del HUD sube al acabar cada oleada.
- [ ] La pulga (oleada 2+) cae solo con menos de 5 hongos en la zona, siembra hongos, necesita 2 impactos y da 200.
- [ ] La araña come hongos de la zona y da 900/600/300 según su distancia vertical al jugador (< 32 / < 64 / resto).
- [ ] El escorpión (oleada 3+) envenena hongos (morados) y da 1000; una cabeza que toca un hongo envenenado baja en picado hasta la fila 26.
- [ ] Morir resta una vida, congela 1000 ms, restaura hongos dañados/envenenados (+5 cada uno) y relanza la misma oleada completa.
- [ ] A los 12000 puntos se gana una vida (máx. 6) y el HUD lo refleja.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas y nivel (oleada); sin eventos por frame.
- [ ] Pausa (botón y `P`) congela ciempiés, enemigos, bala y temporizadores; reanudar sin salto de tiempo ni pasos dobles.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, oleada 1, 45 hongos nuevos, sin enemigos).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites, imágenes ni audio (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** un solo disparo en pantalla con autodisparo (fiel al original; premia acercarse al objetivo); **No:** ráfagas múltiples (es la variante 02).
- **Sí:** movimiento libre en 6 filas con hongos sólidos; **No:** riel fijo.
- **Sí:** ciempiés en rejilla a saltos de celda (como Snake); **No:** interpolación (spec aparte).
- **Sí:** pulga, araña y escorpión con sus reglas clásicas simplificadas a números fijos; **No:** IA de araña con pausas aleatorias.
- **Sí:** al morir se relanza la misma oleada con restauración de hongos (+5); **No:** conservar el ciempiés a medio destruir (evita morir en bucle al reaparecer).
- **Sí:** oleada como nivel (`showLevel: true`), 3 vidas y vida extra cada 12000 (máx. 6); **No:** stats extra.
- **Sí:** valores de balance (velocidades, PV, probabilidades, temporizadores, puntos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER, color verde (el ciempiés) y `sort_order` 7; **Sí:** `.cover-centipede` nueva.
- **Sí:** canvas 480×512 para rejilla exacta 30×32 de 16 px.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                              | Mitigation                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| La bala a 960 px/s atraviesa una celda de 16 px en un frame de 50 ms.             | Sub-pasos de ≤ 8 px con comprobación de colisión en cada uno.                                                 |
| Partir cadenas deja `dir` incoherente y la cabeza nueva "salta" o se invierte.    | Regla fija: `dir = sign(segs[i].c − segs[i+1].c)`; verificar en paso 6 partiendo cadenas en giros.            |
| La oleada nunca termina por segmentos en cola (`r = −1`) huérfanos.               | Fin de oleada = no queda ningún segmento en ninguna cadena, incluidos los en cola.                            |
| Reaparecer encima de un hongo o de un segmento deja al jugador atrapado o muerto. | Se relanza la oleada desde arriba y se borran los hongos que solapan el hitbox de salida.                     |
| Emitir `onScore` en la restauración de hongos por cada hongo satura React.        | La restauración es instantánea al final de `dying`: un solo `onScore` con el total.                           |
| `dt` grande tras pausar o cambiar de pestaña produce varios pasos de ciempiés.    | `lastTime` y `stepAcc` se reinician al reanudar y tras blur; `dt` capado a 50 ms; máximo 1 paso por frame.    |
| Flechas, WASD o espacio interfieren con el input del modal.                       | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                          |
| Tecla "pegada" tras perder foco (movimiento o autodisparo infinito).              | `blur` y `pause` vacían `keysDown` y `fireHeld`.                                                              |
| Doble loop / listeners por StrictMode.                                            | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                        |
| `sort_order` 7 choca si `missile-command` no se implementa o cambia de número.    | Dejar hueco en 6 es inocuo (solo ordena); verificar con `execute_sql` antes de migrar que 7 está libre.       |
| Next 16 difiere del conocimiento previo.                                          | Paso 1 consulta `node_modules/next/dist/docs/`.                                                               |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse/trackball y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores, selector de dificultad o modos alternativos.
- Animación interpolada del ciempiés.
- HUD nativo de texto dentro del canvas y overlays de pausa/transición/game over.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
