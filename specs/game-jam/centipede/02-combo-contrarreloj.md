# SPEC GJ-centipede-02 — Juego real: CENTIPEDE (variante: combo contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-11
> **Variant:** 02 de 2 — Score attack moderno: sin vidas, reloj de 90 s que se recarga limpiando oleadas, multiplicador de combo por racha de aciertos y power-ups que sueltan las cabezas.
> **Objective:** Crear un motor TypeScript de Centipede (variante combo contrarreloj) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/centipede` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Centipede. Mantiene el núcleo (cañón en la franja inferior, ciempiés que baja en zigzag entre hongos y se parte al disparar), pero cambia el objetivo: **no hay vidas**, la partida dura lo que dure el **reloj** (empieza en 90 s; limpiar una oleada da +8 s; recibir un golpe quita 10 s). La puntuación la decide un **multiplicador de combo** (×1 a ×8) que crece con aciertos seguidos y se pierde al fallar un disparo o recibir un golpe, y **power-ups** (TRIPLE, RÁPIDO, BOMBA, +TIEMPO) que caen al matar cabezas. Se distingue de la variante 01 (clásica: 3 vidas, vida extra por puntos, restauración de hongos al morir, sin combo ni power-ups).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-centipede`.

Decisiones fijadas por el agente (no se reabren): `id` `centipede`, título `CENTIPEDE`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, missile-command reserva 6), dificultad 3, tags `CONTRARRELOJ` y `COMBOS`, 1 jugador, teclado. Canvas **600×600** (1:1), rejilla de **30 × 30 celdas de 20 px**. **Sin vidas** (sin `initialLives`; el HUD no muestra vidas), **nivel = oleada** (`showLevel: true`), stats extra `TIEMPO` y `COMBO`. Sin pulga ni escorpión: el único enemigo extra es la araña. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/centipede/engine.ts`: sin globals de módulo; exporta `centipedeDef: GameEngineDef` con `createCentipede(canvas, events) → GameController`.
- Módulo `lib/games/centipede/rules.ts`: funciones puras y constantes (`COLS`, `ROWS`, `CELL`, `ZONE_TOP`, `stepChain(chain, grid)`, `splitChain(chain, index)`, `tickMs(wave)`, `chainLength(wave)`, `multiplier(streak)`, `rollPowerUp(rand)`).
- Módulo `lib/games/centipede/draw.ts`: `drawBackground`, `drawMushroom`, `drawSegment`, `drawPlayer` (con anillo del power-up activo y parpadeo de invulnerabilidad), `drawBullet`, `drawSpider`, `drawPowerUp`, `drawPopup` (texto flotante de puntos), `drawBombWave` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `centipede` en `lib/games/registry.ts`.
- Clase `.cover-centipede` en `app/globals.css`: `radial-gradient(circle at 50% 100%,#2a0030,#0a0a18)` con `::after` de un ciempiés de 6 círculos magenta `#ff2bd6` en diagonal y `::before` de una cápsula amarilla `#ffe600` con un brillo `box-shadow` (power-up).
- Migración `add_game_centipede`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **600×600** (1:1).
- HUD de React: puntaje, **nivel** (oleada), stats extra `time` ("TIEMPO", `seconds`) y `combo` ("COMBO", `int`). Sin vidas.
- Texto en el canvas solo como efecto de juego: popups de puntos (`+300`) y etiqueta del power-up recogido; no es HUD ni overlay.
- Controles: `←↑→↓` y `WASD` mueven el cañón; `Espacio` dispara (mantener = autodisparo). `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'centipede'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `centipede`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Vidas, pulga, escorpión, hongos envenenados, power-ups acumulables o tienda de mejoras.
- Selector de duración o dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('centipede', 'CENTIPEDE', 'Encadena aciertos antes de que acabe el reloj.',
       'Mueve el cañón con las flechas o WASD y dispara con Espacio al ciempiés que baja entre los hongos. Tienes 90 segundos: cada oleada limpia suma tiempo y cada golpe lo resta. Acierta seguido para subir el combo hasta ×8 y recoge los power-ups que sueltan las cabezas: disparo triple, ráfaga rápida, bomba y tiempo extra.',
       'SHOOTER', 'magenta', 'cover-centipede', 1, 1, '{keyboard}', '{CONTRARRELOJ,COMBOS}', 3, 7, false);

Definición del motor:

    export const centipedeDef: GameEngineDef = {
      width: 600, height: 600,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
      ],
      create: createCentipede,
    };

Estado interno (dentro de `createCentipede`): `grid: Uint8Array(30 × 30)` (salud de hongo 0–3), `chains: { segs: { c, r, pc, pr, dx }[], dirX: -1 | 1, dirY: -1 | 1 }[]`, `stepAcc`, `player { x, y }`, `keys { left, right, up, down, fire }`, `bullets: { x, y, vx, vy }[]`, `fireCooldown`, `spider { x, y, vx, vy } | null`, `spiderTimer`, `powerUps: { x, y, type }[]`, `active { type: "triple" | "rapid", ms } | null`, `invulnMs`, `bombWave { r, ms } | null`, `popups: { text, x, y, ms }[]`, `timeLeftMs`, `streak`, `mult`, `wave`, `score`, `lastSecondEmitted`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLevel`, `onStat("time", s)`, `onStat("combo", m)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLevel(1)`, `onStat("time", 90)`, `onStat("combo", 1)`.
- `onStat("time", s)` con `s = Math.ceil(timeLeftMs / 1000)` se emite solo cuando cambia ese entero. `onStat("combo", m)` solo cuando cambia `mult`.
- Game over: sin vidas, no se emite `onLives`. Al llegar `timeLeftMs` a 0 se emite `onStat("time", 0)` (lo oculta) y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa.
- Pausa/blur/destroy ponen todas las `keys` a `false`; al reanudar se reinicia `lastTime`; el reloj, los power-ups activos y la invulnerabilidad no corren en pausa; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Rejilla:** 30 × 30 celdas de 20 px. **Zona del jugador:** filas 24–29 (`y ≥ 480`).
- **Hongos:** al iniciar la partida se colocan **40** hongos en celdas aleatorias distintas de las filas 2–22, con salud **3**. Al empezar cada oleada desde la 2 se añaden **6** hongos más en celdas libres aleatorias de las filas 2–22. Cada impacto resta 1 de salud; a 0 desaparece y suma **1** punto (sin multiplicador). Disparar a un hongo no altera la racha.
- **Cañón:** 16×16 px (hitbox 12×12 centrada), arranca en (292, 570). Velocidad **260 px/s** por eje, limitado a `x ∈ [0, 584]`, `y ∈ [480, 584]`. Se resuelve por eje y se cancela el eje que entraría en una celda con hongo.
- **Disparo base:** con `Espacio` mantenido dispara si `fireCooldown ≤ 0` y hay menos de **1** bala propia en pantalla; bala de 2×10 px a **900 px/s** hacia arriba; `fireCooldown = 120 ms`. Las balas se mueven en subpasos de **≤ 8 px**; orden de impacto: araña, segmento, hongo.
- **Ciempiés:** la oleada `w` empieza con una cadena de `chainLength(w) = min(10 + (w − 1), 16)` segmentos en la fila 0, cabeza en la columna `chainLength − 1`, `dirX = 1`, `dirY = 1`. Paso cada `tickMs(w) = max(55, 110 − 5 × (w − 1))` ms con interpolación visual. Movimiento de la cabeza: intenta `c + dirX`; si sale de 0–29 o hay hongo, se mueve a `r + dirY` e invierte `dirX`; en la fila 29 bajando, o subiendo por encima de la fila 24, se invierte `dirY` antes de moverse. El cuerpo sigue celda a celda; cada segmento guarda su último `dx`.
- **Impacto en segmento:** el segmento desaparece, deja un hongo de salud 3 en su celda (si no lo había) y la cadena se parte (la parte trasera sigue con `dirX = dx` de su nuevo jefe y el `dirY` original). Puntos base: **cabeza 100**, **cuerpo 10**, multiplicados por `mult`. Popup `+N` 600 ms.
- **Combo:** `streak` +1 por cada enemigo alcanzado (segmento o araña). `mult = multiplier(streak) = min(1 + Math.floor(streak / 5), 8)`. `streak = 0` (y `mult = 1`) cuando una bala propia sale por `y < 0` sin impactar nada, o al recibir un golpe.
- **Fin de oleada:** sin segmentos vivos → bonus **500 × wave × mult** puntos, `timeLeftMs += 8000` (máximo **180000**), `wave + 1`, `onLevel(wave)`, 6 hongos nuevos y nueva cadena en el siguiente paso.
- **Araña:** si no hay araña, `spiderTimer` aleatorio en **[4000, 7000] ms**; entra por un lateral al azar a una `y` en [480, 584], `vx = ±min(120 + 10 × (wave − 1), 200)` px/s y `vy = ±180` px/s rebotando entre `y = 470` y `y = 590`; 24×14 px; come hongos que toca; sale por el borde opuesto. Vale **300 × mult** y siempre suelta un power-up.
- **Power-ups:** al matar una **cabeza** cae un power-up con probabilidad **0.2** (la araña, siempre). Cápsula de 14×14 px que cae a **120 px/s** desde el punto de muerte; desaparece al salir por abajo. Se recoge al tocar la hitbox del cañón (+**50** puntos sin multiplicador). Tipo con igual probabilidad (0.25 cada uno):
  - `triple` (`#ffe600`, "TRIPLE"): **8000 ms**; cada disparo lanza 3 balas a −15°, 0° y +15° (misma velocidad 900 px/s); máximo **3** balas propias en pantalla.
  - `rapid` (`#00f5ff`, "RÁPIDO"): **8000 ms**; `fireCooldown = 70 ms` y máximo **3** balas propias en pantalla.
  - `bomb` (`#ff3355`, "BOMBA"): instantáneo; onda circular desde el cañón que crece de 0 a **160 px** en 400 ms; destruye los hongos (sin puntos) y mata la araña y los segmentos (con puntos y racha normales) cuyo centro queda dentro del radio.
  - `time` (`#39ff14`, "+5 S"): instantáneo; `timeLeftMs += 5000` (máximo 180000).
  - `triple` y `rapid` no se acumulan: recoger uno sustituye al activo y reinicia su duración a 8000 ms. Las balas que salen por los laterales desaparecen sin romper la racha.
- **Golpe al jugador:** si `invulnMs ≤ 0` y la hitbox del cañón toca un segmento (16×16 interpolado) o la araña → `timeLeftMs −= 10000` (mínimo 0), `streak = 0`, `mult = 1`, se quita la araña, se cancela el power-up activo y `invulnMs = 1500` (el cañón parpadea a 10 Hz y no recibe golpes). El ciempiés no se reinicia ni se reagrupa.
- **Reloj:** `timeLeftMs` empieza en **90000** y baja con `dt` solo en juego. Al llegar a 0 termina la partida (ver Game over).
- **Dibujo:** fondo `#05000f` con rejilla `rgba(255,43,214,0.06)`. Hongos: sombrero `#00f5ff` de 18 px y tallo `#ffffff`, recortados a `salud/3` del alto. Cabeza `#ff2bd6` (radio 9, ojos `#000`), cuerpo `#b0179a` (radio 8); con `mult ≥ 4` el ciempiés recibe `shadowBlur` 8. Cañón `#ffe600`; anillo del power-up activo en su color con radio 14. Balas `#ffffff`. Araña `#ff3355`. Popups en fuente monoespaciada 14 px `#ffffff`, suben 24 px y se desvanecen; etiqueta del power-up 18 px en su color durante 800 ms. Onda de bomba: anillo `#ff3355` de 3 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-centipede` en `app/globals.css`. Aplicar migración `add_game_centipede` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'centipede'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/centipede/rules.ts`. Verificar: `npm run lint`; `tickMs(1) = 110`, `tickMs(12) = 55`, `chainLength(1) = 10`, `chainLength(9) = 16`, `multiplier(4) = 1`, `multiplier(5) = 2`, `multiplier(60) = 8`.
3. Crear `lib/games/centipede/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/centipede/engine.ts` y exportar `centipedeDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `centipede` en `lib/games/registry.ts`. Verificar: `/games/centipede/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): reloj de 90 s bajando, racha de 5 aciertos (COMBO 2) y pérdida al fallar, partir el ciempiés, limpiar oleada (+8 s, bonus, 6 hongos nuevos, cadena de 11), los 4 power-ups (triple con 3 balas, rápido, bomba que limpia hongos y mata segmentos, +5 s), sustitución de triple por rápido, golpe (−10 s, COMBO 1, parpadeo 1500 ms), tope de 180 s, fin por tiempo, pausa (botón y `P`) congelando el reloj, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'centipede'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `centipede` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-centipede`), la ficha `/games/centipede` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`COMBOS`, dificultad 3, color magenta, categoría SHOOTER).
- [ ] `/games/centipede/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] El HUD muestra puntaje, nivel, TIEMPO y COMBO, y no muestra vidas.
- [ ] `←↑→↓` y `WASD` mueven el cañón a 260 px/s dentro de las filas 24–29 sin atravesar hongos; flechas y `Espacio` no hacen scroll.
- [ ] Sin power-up hay como máximo 1 bala propia; con TRIPLE salen 3 balas en abanico (máx. 3); con RÁPIDO el intervalo baja a 70 ms (máx. 3); ambos duran 8 s y no se acumulan.
- [ ] La partida empieza con 40 hongos de salud 3 y un ciempiés de 10 segmentos que da un paso cada 110 ms.
- [ ] Acertar suma 100 (cabeza) o 10 (cuerpo) × COMBO, deja un hongo y parte la cadena.
- [ ] COMBO pasa de 1 a 2 al 5.º acierto seguido, sube cada 5 aciertos hasta 8 y vuelve a 1 al salir una bala por arriba sin impactar o al recibir un golpe; disparar a hongos no lo cambia.
- [ ] Limpiar una oleada suma 500 × oleada × COMBO, +8 s (tope 180 s), sube el nivel, añade 6 hongos y la siguiente cadena tiene un segmento más (tope 16) y es 5 ms más rápida (mínimo 55 ms).
- [ ] La araña aparece cada 4–7 s, come hongos, vale 300 × COMBO y siempre suelta un power-up; las cabezas lo sueltan con probabilidad 0.2.
- [ ] Recoger un power-up suma 50; BOMBA crece hasta 160 px en 400 ms destruyendo hongos y enemigos en su radio; +5 S suma 5 s al reloj.
- [ ] Un golpe resta 10 s, reinicia COMBO, quita la araña y el power-up activo y da 1500 ms de invulnerabilidad con parpadeo; el ciempiés no se reinicia.
- [ ] TIEMPO baja 1 por segundo de juego desde 90; al llegar a 0 se emite `onGameOver` (sin `onLives`) y se abre el modal con el puntaje correcto.
- [ ] Sin eventos por frame: TIEMPO solo al cambiar el segundo, COMBO solo al cambiar el multiplicador.
- [ ] Pausa (botón y `P`) congela reloj, ciempiés, araña, balas, power-ups, invulnerabilidad y duración del power-up activo; reanudar sin salto ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'centipede'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/centipede` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 90, COMBO 1, 40 hongos nuevos, sin araña, power-ups ni popups).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/centipede/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** contrarreloj sin vidas (90 s, +8 s por oleada, −10 s por golpe, tope 180 s); es la diferencia central con la variante 01 y da partidas cortas y comparables. **No:** `initialLives` ni vida extra.
- **Sí:** multiplicador de combo ×1–×8 por racha de 5 aciertos; premia la precisión y abre el rango del leaderboard. **No:** perder la racha por disparar a hongos (sería castigar el juego normal entre hongos).
- **Sí:** 4 power-ups no acumulables; **No:** power-ups permanentes o tienda (rompen el balance de una partida corta).
- **Sí:** araña como único enemigo extra y que siempre suelte power-up; **No:** pulga ni escorpión (la siembra de hongos ya la hace el +6 por oleada).
- **Sí:** golpe sin reinicio del ciempiés e invulnerabilidad de 1500 ms; evita golpes encadenados que vacíen el reloj.
- **Sí:** stats `TIEMPO` y `COMBO`; nivel = oleada (`showLevel: true`).
- **Sí:** `onGameOver` sin `onLives` al acabar el tiempo; el contrato permite omitir vidas (`onLives` es opcional).
- **Sí:** valores de balance (velocidades, tiempos, puntos, probabilidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER, color magenta, `.cover-centipede` nueva y canvas 600×600 (1:1, más ancho para el abanico del TRIPLE).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Partidas infinitas si el +8 s por oleada supera el ritmo de pérdida.                     | Tope de 180 s, cadenas más largas y rápidas por oleada; verificar oleada 8+ en el paso 6 y ajustar en spec.  |
| El bonus de oleada × COMBO dispara puntajes y desequilibra el leaderboard.               | Multiplicador con tope ×8 y bonus lineal en oleada; ajustable solo editando el spec.                         |
| Balas en abanico (TRIPLE) atraviesan objetivos o cuentan dos veces el mismo segmento.    | Subpasos de ≤ 8 px; un segmento se retira al primer impacto; cada bala impacta una sola vez.                 |
| La racha se rompe por balas laterales del TRIPLE.                                        | Solo rompe la racha la salida por `y < 0` sin impacto; las laterales desaparecen sin efecto.                 |
| Emitir `onStat("time")` por frame satura React.                                          | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                    |
| `dt` grande tras pausar o cambiar de pestaña consume reloj o da pasos múltiples.         | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; el reloj solo corre en juego.            |
| Flechas, WASD o espacio interfieren con el input del modal.                              | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                         |
| Tecla "pegada" tras perder foco.                                                         | `blur` y `pause` ponen todas las `keys` a `false`.                                                           |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                       |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                              |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Vidas, vida extra, pulga, escorpión y hongos envenenados.
- Power-ups acumulables, permanentes o tienda de mejoras.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de duración, dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
