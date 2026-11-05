# SPEC GJ-dig-dug-lite-01 — Juego real: DIG DUG LITE (variante: clásico de la bomba) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-05
> **Variant:** 01 de 2 — Clásico fiel: cavar túneles, inflar enemigos con la bomba de aire hasta reventarlos, soltar rocas sobre ellos y limpiar cada nivel con 3 vidas.
> **Objective:** Crear un motor TypeScript de Dig Dug (variante clásica de la bomba) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/dig-dug-lite` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Dig Dug. Reproduce el bucle del arcade original en versión reducida: el jugador cava túneles en una rejilla de tierra por capas, dispara un **arpón con bomba de aire** que se engancha a los enemigos y los **infla a pulsaciones** hasta reventarlos, y puede **socavar rocas** para aplastarlos (con bonus creciente si caen varios). Dos tipos de enemigo: **Pooka** (persigue por los túneles) y **Fygar** (además escupe fuego en horizontal). Los enemigos se vuelven **fantasma** periódicamente y atraviesan la tierra; el último enemigo huye hacia la superficie. Hay **3 vidas** y niveles que se superan eliminando a todos los enemigos. Se distingue de la variante 02 (minero contrarreloj: sin bomba, 1 vida, cuenta regresiva, gemas que recolectar, topos que cavan y dinamita).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-dig-dug-lite`.

Decisiones fijadas por el agente (no se reabren): `id` `dig-dug-lite`, título `DIG DUG LITE`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, missile-command = 6 propuesto en game jam), dificultad 3, tags `CLÁSICO` y `EXCAVAR`, 1 jugador, teclado. Canvas **560×600**, rejilla de **14 columnas × 15 filas de 40 px** (fila 0 = superficie, filas 1–14 = tierra). **3 vidas** (`initialLives: 3`), **nivel** visible (`showLevel: true`), sin stats extra. Movimiento celda a celda con interpolación. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/dig-dug-lite/engine.ts`: sin globals de módulo; exporta `digDugLiteDef: GameEngineDef` con `createDigDugLite(canvas, events) → GameController`.
- Módulo `lib/games/dig-dug-lite/grid.ts`: funciones puras de rejilla (`makeGrid()`, `isDug`, `dig(grid, c, r)`, `link(grid, a, b)`, `hasLink`, `layerOf(row)`) y `generateLevel(level, rand)` (pozo inicial, túneles de enemigos, rocas).
- Módulo `lib/games/dig-dug-lite/balance.ts`: constantes y funciones puras (`enemyCount(level)`, `fygarCount(level)`, `rockCount(level)`, `enemySpeed(level)`, `ghostDelayMs(level, rand)`, `pumpPoints(row, type, horizontal)`, `crushPoints(n)`, `veggiePoints(level)`).
- Módulo `lib/games/dig-dug-lite/draw.ts`: `drawSky`, `drawDirt` (4 capas), `drawTunnels`, `drawRock`, `drawPlayer`, `drawHarpoon`, `drawPooka`, `drawFygar`, `drawFire`, `drawGhostEyes`, `drawVeggie`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"dig-dug-lite"` en `lib/games/registry.ts`.
- Clase `.cover-dig-dug-lite` en `app/globals.css`: franjas horizontales de tierra `linear-gradient(180deg,#1a1033 0 18%,#c8741e 18% 40%,#a8501a 40% 62%,#7a2e14 62% 82%,#4a1a10 82%)`, `::before` con un túnel negro en forma de L y `::after` con un Pooka (círculo rojo `#ff3355` con gafas amarillas).
- Migración `add_game_dig_dug_lite`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **560×600**.
- HUD de React: puntaje, **3 vidas**, **nivel**. Sin stats extra.
- Sin HUD nativo de texto en el canvas, salvo los textos efímeros de puntos (`+200`, `+2500`) sobre la posición del evento (efecto de juego, no overlay).
- Controles: flechas y `W`/`A`/`S`/`D` mueven (y cavan); `Espacio` dispara el arpón o, si está enganchado, bombea. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'dig-dug-lite'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `dig-dug-lite`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Animación de entrada del jugador, pantalla de ronda, flores de conteo de niveles.
- Modo 2 jugadores, selector de dificultad, dinamita, gemas o cuenta regresiva.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('dig-dug-lite', 'DIG DUG LITE', 'Cava, infla y revienta a los monstruos.',
       'Excava túneles con las flechas o WASD y dispara el arpón con Espacio: cuando se engancha, pulsa Espacio otra vez para inflar al monstruo hasta que reviente. Cuanto más profundo, más puntos. Socava las rocas para aplastar a varios a la vez, esquiva el fuego de los Fygar y cuidado con los fantasmas que atraviesan la tierra. Limpia el nivel para bajar al siguiente; tienes tres vidas.',
       'ARCADE', 'yellow', 'cover-dig-dug-lite', 1, 1, '{keyboard}', '{CLÁSICO,EXCAVAR}', 3, 7, false);

Definición del motor:

    export const digDugLiteDef: GameEngineDef = {
      width: 560, height: 600,
      initialLives: 3,
      showLevel: true,
      create: createDigDugLite,
    };

Estado interno (dentro de `createDigDugLite`): `grid { dug: boolean[14][15], links: Set<string> }` (arista entre celdas adyacentes, clave `"c,r|c,r"` ordenada), `player { c, r, nc, nr, progress, facing, dying, deathMs }`, `held: Dir[]` (pila de direcciones pulsadas; manda la última), `harpoon { len, dir, state: "extending" | "attached" | "miss", target, missMs } | null`, `harpoonCooldownMs`, `enemies: { id, type: "pooka" | "fygar", c, r, nc, nr, progress, dir, mode: "normal" | "ghost" | "inflated" | "popping", inflate, deflateMs, popMs, ghostInMs, ghostMs, gx, gy, spawnC, spawnR, freezeMs, fireCdMs, windupMs, fireMs, fireCells, fleeing }[]`, `rocks: { c, r, y, state: "idle" | "wobble" | "falling" | "breaking", ms, crushed }[]`, `rocksDropped`, `veggie { ms } | null`, `popups: { text, x, y, ms }[]`, `score`, `lives`, `level`, `extraLivesGiven: Set<number>`, `levelClearMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`, `rand` (`Math.random`).

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio` ignora `e.repeat` (una acción por pulsación); el movimiento es continuo mientras se mantiene una dirección.
- Pausa/blur/destroy vacían `held`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Rejilla:** 14 × 15 celdas de 40 px. Fila 0 = superficie: siempre excavada y con todas sus aristas horizontales enlazadas (se dibuja como cielo). Capas de tierra: capa 1 filas 1–3, capa 2 filas 4–7, capa 3 filas 8–11, capa 4 filas 12–14.
- **Inicio de nivel:** todo el subsuelo es tierra; se excava un **pozo** en la columna 6, filas 1–7, enlazado verticalmente (y con la fila 0). El jugador aparece en (6, 7) mirando abajo. Los enemigos quedan congelados **1500 ms** (parpadean).
- **Movimiento del jugador:** celda a celda. Parado en un centro, si hay dirección en `held` y la celda destino está dentro de la rejilla y no es roca, empieza un paso. Velocidad **4 celdas/s** si la celda destino ya está excavada, **3 celdas/s** si cava. Al empezar el paso la celda destino se marca excavada y se enlaza con la de origen; cada celda **nueva** excavada suma **+10** puntos. Invertir la dirección a mitad de paso es inmediato (`progress = 1 − progress`); un giro perpendicular espera a llegar al centro. Mover cancela el arpón.
- **Arpón** (`Espacio` sin arpón y `harpoonCooldownMs ≤ 0`): sale del centro del jugador en `facing` a **12 celdas/s**, alcance máximo **3 celdas** (120 px), y solo avanza por aristas enlazadas (se detiene al llegar a tierra). Si el segmento pasa a ≤ **20 px** del centro de un enemigo en modo `normal` o `inflated`, se engancha (`attached`) y ese enemigo pasa a `inflated` con `inflate = 1`. Si llega al tope sin enganchar → `miss`, se ve 150 ms y desaparece; `harpoonCooldownMs = 250`. Los fantasmas no se enganchan.
- **Bombear** (`Espacio` con arpón `attached`): `inflate += 1` y `deflateMs = 600`. Con `inflate = 4` el enemigo pasa a `popping` (200 ms) y se elimina sumando `pumpPoints`. Sin bombear, cada 600 ms `inflate −= 1`; al llegar a 0 vuelve a `normal` y el arpón se suelta. Un enemigo `inflated` está quieto, no mata al tocarlo y bloquea el paso del jugador.
- **Puntos por bomba** (según la fila del enemigo al reventar): capa 1 **200**, capa 2 **300**, capa 3 **400**, capa 4 **500**. Un Fygar reventado con el arpón en horizontal (izquierda/derecha) vale **×2**.
- **Enemigos por nivel:** `enemyCount = 4 + min(floor((level − 1) / 2), 4)` (4, 4, 5, 5, 6, 6, 7, 7, 8…); Fygar: `fygarCount = min(1 + floor((level − 1) / 2), floor(enemyCount / 2))`; el resto son Pooka. Cada enemigo nace en el centro de su propio túnel prexcavado de **3 celdas** (horizontal o vertical al 50 %, celdas enlazadas) en filas 3–13, sin tocar las columnas 5–7 y con al menos 1 celda de tierra entre túneles (hasta 200 reintentos del sorteo).
- **Persecución (`normal`):** se mueven solo por aristas enlazadas a `enemySpeed = min(2.2 + 0.15 × (level − 1), 3.7)` celdas/s. En cada centro eligen entre vecinos enlazados sin dar media vuelta (salvo callejón): con probabilidad **0.6** el que minimiza la distancia Manhattan al jugador; si no, uno al azar.
- **Fantasma:** cada enemigo tiene `ghostInMs` sorteado en `[6000, 10000] − 400 × (level − 1)` ms (mínimo 3000). Al agotarse (en modo `normal`) pasa a `ghost`: solo se dibujan los ojos, se mueve en línea recta en píxeles hacia el jugador a **64 px/s** atravesando tierra, no mata y no se engancha. Tras al menos **800 ms**, al quedar a ≤ 8 px del centro de una celda excavada se materializa ahí (`normal`) y se sortea un nuevo `ghostInMs`.
- **Fuego de Fygar:** si un Fygar `normal` está en la misma fila que el jugador, a ≤ **4** columnas y `fireCdMs ≤ 0`, se detiene, mira al jugador y parpadea **600 ms**; luego lanza fuego que ocupa hasta **3 celdas** en esa dirección (atraviesa tierra) durante **450 ms**. Si la celda redondeada del jugador está en `fireCells` mientras dura, el jugador muere. `fireCdMs = 3500` tras cada fuego.
- **Contacto:** un enemigo `normal` a menos de **28 px** del jugador lo mata.
- **Rocas:** `rockCount` = 3 (niveles 1–2), 4 (3–4), 5 (5+). Se colocan en tierra en filas 3–12, fuera de las columnas 5–7, no adyacentes a túneles de enemigos, con tierra debajo y sin otra roca en la misma columna a menos de 3 filas. Ni jugador ni enemigos entran en una celda de roca. Cuando la celda de abajo está excavada y el jugador **no** está en ella, la roca tiembla **500 ms** y cae a **6 celdas/s** por celdas excavadas hasta tierra o el fondo; luego se rompe (400 ms) y desaparece. Su celda original queda excavada y enlazada con la de abajo.
- **Aplastar:** la roca que cae mata a todo enemigo (cualquier modo salvo fantasma) y al jugador cuya celda redondeada atraviese. Puntos por enemigos aplastados en la misma caída: 1 → **1000**, 2 → **2500**, 3 → **4000**, 4 → **6000**, 5 o más → **8000**; se suman al romperse la roca.
- **Bonus de verdura:** al caer la **2.ª** roca del nivel aparece una verdura en (6, 7) durante **10000 ms**. Tocarla suma `veggiePoints = min(400 + 200 × (level − 1), 2000)`. Solo una por nivel.
- **Huida:** cuando queda **un** enemigo, pasa a `fleeing`: persigue la celda (0, 0) en vez del jugador (probabilidad de acercarse **1.0**), su velocidad se multiplica por **1.3** y su `ghostInMs` se divide entre 2 (fantasma también hacia (0, 0)). Sigue siendo vulnerable. Si llega a (0, 0) sale del nivel sin dar puntos.
- **Fin de nivel:** sin enemigos (reventados, aplastados o huido) → espera **1000 ms**, `level += 1` → `onLevel(level)`, nueva rejilla (`generateLevel`), jugador en (6, 7). Sin bonus de nivel. El puntaje se mantiene.
- **Vida extra:** al alcanzar **10000** y **40000** puntos (una vez cada umbral), `lives += 1` (tope 5) → `onLives(lives)`.
- **Muerte:** `lives −= 1` → `onLives(lives)`. Si `lives = 0` → `onGameOver(score)` inmediatamente (el jugador queda dibujado encogido). Si no: congelación **1500 ms** (animación de encoger), luego enemigos vivos vuelven a su celda de nacimiento con `inflate = 0`, modo `normal`, `freezeMs = 1500` y nuevo `ghostInMs`; el jugador vuelve a (6, 7); túneles, rocas y verdura se conservan; el arpón y el fuego se eliminan.
- **Dibujo:** cielo `#1a1033`; tierra por capa `#c8741e`, `#a8501a`, `#7a2e14`, `#4a1a10` con puntos de textura más oscuros fijos por celda; túnel `#0a0a12` (celda 32×32 centrada + puente de 32 px por cada arista enlazada). Jugador: cuerpo blanco con casco `#00f5ff` y visor; arpón línea `#ffffff` con punta triangular. Pooka: círculo rojo `#ff3355` con gafas `#ffe600`; Fygar: cuerpo verde `#2ecc40` con alas y ojo blanco; inflado: el radio crece 25 % por punto de `inflate` y el color se aclara. Fantasma: solo dos ojos blancos. Fuego `#ff8c00` → `#ffe600`. Roca `#8a8a9a` con borde `#5a5a6a`; tiembla ±2 px. Verdura: zanahoria naranja con hojas verdes. Textos de puntos `#ffffff` 14 px monoespaciada, suben 20 px en 700 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-dig-dug-lite` en `app/globals.css`. Aplicar migración `add_game_dig_dug_lite` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'dig-dug-lite'` muestra la fila; `npm run build`.
2. Crear `lib/games/dig-dug-lite/balance.ts`. Verificar: `npm run lint`; `enemyCount(1) = 4`, `enemyCount(3) = 5`, `enemyCount(20) = 8`, `fygarCount(1) = 1`, `fygarCount(5) = 3`, `enemySpeed(1) = 2.2`, `enemySpeed(20) = 3.7`, `pumpPoints(13, "fygar", true) = 1000`, `crushPoints(3) = 4000`, `veggiePoints(10) = 2000`.
3. Crear `lib/games/dig-dug-lite/grid.ts`. Verificar: `npm run lint`; `generateLevel` produce el pozo de la columna 6, túneles de 3 celdas fuera de las columnas 5–7 y rocas con tierra debajo.
4. Crear `lib/games/dig-dug-lite/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/dig-dug-lite/engine.ts` y exportar `digDugLiteDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"dig-dug-lite"` en `lib/games/registry.ts`. Verificar: `/games/dig-dug-lite/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): cavar (+10 por celda nueva), velocidades en túnel y cavando, arpón por túneles con alcance 3 y que no atraviesa tierra, bombear 4 veces y reventar con los puntos de la capa, Fygar horizontal ×2, desinflado cada 600 ms, fuego de Fygar, fantasmas que atraviesan tierra y se materializan, caída de roca con 2+ aplastados, verdura tras la 2.ª roca, huida del último enemigo, paso de nivel, vida extra a 10000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'dig-dug-lite'` (también registrada en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `dig-dug-lite` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-dig-dug-lite`), la ficha `/games/dig-dug-lite` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`EXCAVAR`, dificultad 3, color yellow, categoría ARCADE).
- [ ] `/games/dig-dug-lite/jugar` muestra el canvas 560×600 (proporción 14:15) sin desborde a 375 px y 1280 px.
- [ ] Al empezar existe el pozo de la columna 6 (filas 1–7), el jugador está en (6, 7) y los enemigos parpadean quietos 1500 ms.
- [ ] Flechas y `W`/`A`/`S`/`D` mueven celda a celda: 4 celdas/s por túnel, 3 celdas/s cavando; cada celda nueva suma 10 puntos; las flechas y `Espacio` no hacen scroll.
- [ ] Invertir la dirección a mitad de paso es inmediato; el jugador no entra en celdas de roca.
- [ ] `Espacio` lanza el arpón (alcance 3 celdas, solo por túnel enlazado); si falla desaparece y hay 250 ms de espera; mantener `Espacio` no repite.
- [ ] Con el arpón enganchado, 4 pulsaciones revientan al enemigo: 200/300/400/500 según la capa, ×2 para Fygar en horizontal; sin bombear se desinfla 1 punto cada 600 ms; inflado no mata al tocarlo.
- [ ] Moverse suelta el arpón.
- [ ] Los enemigos persiguen solo por túneles a 2.2 celdas/s en nivel 1; los fantasmas (solo ojos) atraviesan tierra a 64 px/s, no matan ni se enganchan y se materializan en un túnel.
- [ ] El Fygar en la misma fila a ≤ 4 columnas parpadea 600 ms y lanza fuego de 3 celdas durante 450 ms que atraviesa tierra y mata al jugador; espera 3500 ms entre fuegos.
- [ ] Una roca socavada tiembla 500 ms y cae a 6 celdas/s; no cae mientras el jugador está justo debajo; aplasta 1/2/3/4/5+ enemigos por 1000/2500/4000/6000/8000 y mata al jugador si lo atraviesa.
- [ ] Tras la 2.ª roca caída aparece la verdura 10 s en (6, 7) y suma 400 en nivel 1.
- [ ] El último enemigo huye hacia (0, 0) más rápido y, si llega, el nivel termina sin puntos por él.
- [ ] Sin enemigos, tras 1000 ms el nivel sube (`onLevel`), la rejilla se regenera y el puntaje se conserva; nivel 3 tiene 5 enemigos.
- [ ] Al llegar a 10000 y 40000 puntos se gana una vida (tope 5).
- [ ] Morir resta una vida, congela 1500 ms y devuelve enemigos a su nacimiento conservando los túneles; perder la última emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas y nivel; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela jugador, enemigos, rocas, fuego, arpón y temporizadores; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`/`A`/`S`/`D`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'dig-dug-lite'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/dig-dug-lite` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, rejilla nueva, sin arpón, fuego ni verdura).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/dig-dug-lite/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** arpón + bombeo por pulsaciones (4 para reventar) y rocas; es el núcleo del original y la diferencia central con la variante 02. **No:** dinamita, gemas ni cuenta regresiva.
- **Sí:** movimiento celda a celda con aristas enlazadas; da túneles limpios, persecución sencilla y colisiones fáciles de verificar. **No:** movimiento libre por píxel.
- **Sí:** puntos por capa (200–500), Fygar horizontal ×2 y tabla de aplastamiento 1000–8000; fieles al original y amplían el rango del leaderboard.
- **Sí:** fantasmas, fuego de Fygar y huida del último enemigo; mantienen la presión del clásico. **No:** escalado de fuego por nivel ni nuevos tipos de enemigo.
- **Sí:** 3 vidas con vidas extra a 10000 y 40000 (tope 5) y niveles infinitos (`showLevel: true`).
- **No:** stats extra en el HUD; el puntaje, las vidas y el nivel bastan para esta variante.
- **Sí:** +10 por celda nueva cavada; premia explorar sin desbalancear (máximo ~2000 por nivel).
- **Sí:** valores de balance (velocidades, tiempos, radios, puntos, umbrales) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color yellow (tierra cálida); **Sí:** `.cover-dig-dug-lite` nueva.
- **Sí:** canvas 560×600 (14×15 celdas de 40 px).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                     | Mitigation                                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| El sorteo de túneles y rocas no encuentra hueco válido en niveles con 8 enemigos.        | Hasta 200 reintentos por elemento; si falla, se coloca en la primera celda válida recorriendo la rejilla en orden. |
| Enemigos atascados en callejones sin aristas enlazadas.                                  | Media vuelta permitida en callejón; el modo fantasma (como máximo cada 10 s) los libera.                           |
| La roca cae sobre el jugador nada más socavarla y resulta injusta.                       | No cae mientras el jugador está en la celda de abajo; temblor de 500 ms como aviso.                                |
| Arpón enganchado a un enemigo que cambia de modo (fantasma, aplastado) deja estado roto. | Al cambiar el enemigo a `ghost` o eliminarse, `harpoon = null`; un `inflated` no puede volverse fantasma.          |
| `dt` grande tras pausar o cambiar de pestaña teletransporta entidades o salta celdas.    | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms (a 4 celdas/s, máximo 0.2 celdas por frame).   |
| Flechas, `WASD` o espacio interfieren con el input del modal.                            | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                               |
| Dirección "pegada" tras perder foco.                                                     | `blur` y `pause` vacían `held`.                                                                                    |
| Doble loop / listeners por StrictMode.                                                   | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                             |
| El id con guiones requiere comillas en `ENGINES` y rutas de carpeta.                     | Clave `"dig-dug-lite"` entre comillas; carpeta `lib/games/dig-dug-lite/`; migración con `_` en el nombre.          |
| Next 16 difiere del conocimiento previo.                                                 | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                    |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Animación de entrada, pantalla de ronda y flores de conteo de niveles.
- Dinamita, gemas, cuenta regresiva y enemigos que cavan.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Modo 2 jugadores, selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
