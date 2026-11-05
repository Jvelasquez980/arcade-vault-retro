# SPEC GJ-dig-dug-lite-02 — Juego real: DIG DUG LITE (variante: minero contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-05
> **Variant:** 02 de 2 — Contrarreloj moderna: recoger todas las gemas de cada veta antes de que acabe el tiempo, con topos que cavan su propio camino hacia ti, rocas persistentes y dinamita limitada, con una sola vida.
> **Objective:** Crear un motor TypeScript de Dig Dug (variante minero contrarreloj) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/dig-dug-lite` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Dig Dug. Conserva la excavación por rejilla y las rocas, pero cambia el objetivo y el arma: el jugador no tiene bomba de aire; gana puntos **recogiendo gemas** enterradas (valen más cuanto más hondas) contra una **cuenta regresiva** que se recarga con cada gema y al limpiar la veta. Los enemigos son **topos** que **cavan su propio túnel** hacia el jugador con un camino de coste mínimo (más lentos en tierra), así que el mapa se va agujereando y las rocas se vuelven peligrosas para ambos. La única defensa es **socavar rocas** (que no se rompen: quedan donde caen y pueden volver a caer) y la **dinamita** (pocas cargas, explosión en cruz, también te mata). **Una sola vida**: cualquier error termina la partida. Se distingue de la variante 01 (clásica: arpón y bombeo, 3 vidas, Pooka/Fygar, fantasmas, sin tiempo).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con formas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-dig-dug-lite`.

Decisiones fijadas por el agente (no se reabren): `id` `dig-dug-lite`, título `DIG DUG LITE`, `cat` `ARCADE`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, missile-command = 6 propuesto en game jam), dificultad 4, tags `CONTRARRELOJ` y `EXCAVAR`, 1 jugador, teclado. Canvas **640×640**, rejilla de **16 × 16 celdas de 40 px** (fila 0 = superficie, filas 1–15 = tierra). **1 vida** (`initialLives: 1`), **nivel** = veta (`showLevel: true`), stats extra `TIEMPO`, `GEMAS` y `DINAMITA`. Movimiento celda a celda con interpolación. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/dig-dug-lite/engine.ts`: sin globals de módulo; exporta `digDugLiteDef: GameEngineDef` con `createDigDugLite(canvas, events) → GameController`.
- Módulo `lib/games/dig-dug-lite/map.ts`: funciones puras `generateVein(level, rand)` (tierra, rocas, gemas, posiciones de topos) y helpers (`inBounds`, `isDug`, `gemValue(row)`, `blastCells(c, r)`).
- Módulo `lib/games/dig-dug-lite/pathing.ts`: `nextStep(map, rocks, from, to) → { c, r } | null` con Dijkstra sobre 16×16 (coste 1 celda excavada, 2.5 tierra, roca intransitable).
- Módulo `lib/games/dig-dug-lite/balance.ts`: constantes (`START_MS`, `GEM_MS`, `CLEAR_MS`, `MAX_MS`, `FUSE_MS`) y funciones puras (`gemCount(level)`, `rockCount(level)`, `moleCount(level)`, `moleSpeed(level)`, `crushPoints(n, level)`, `blastPoints(kills, level)`, `clearBonus(remainingMs, level)`).
- Módulo `lib/games/dig-dug-lite/draw.ts`: `drawSky`, `drawDirt` (3 estratos), `drawTunnels`, `drawGem`, `drawRock`, `drawPlayer`, `drawMole`, `drawDynamite`, `drawBlast`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"dig-dug-lite"` en `lib/games/registry.ts`.
- Clase `.cover-dig-dug-lite` en `app/globals.css`: tierra `linear-gradient(180deg,#0a1a2a 0 16%,#5a3a22 16% 50%,#3e2616 50% 80%,#24160c 80%)`, `::before` con tres rombos de gema (`#00ff88`, `#ff3355`, `#00f5ff`) con brillo `box-shadow` cian y `::after` con una barra de tiempo cian decreciente en la parte superior.
- Migración `add_game_dig_dug_lite`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **640×640**.
- HUD de React: puntaje, **1 vida**, **nivel**, stats extra `time` ("TIEMPO", `seconds`), `gems` ("GEMAS", `int`, gemas que faltan en la veta) y `dyn` ("DINAMITA", `int`).
- Sin HUD nativo de texto en el canvas, salvo los textos efímeros de puntos y de tiempo (`+100`, `+2s`) sobre la posición del evento (efecto de juego, no overlay).
- Controles: flechas y `W`/`A`/`S`/`D` mueven (y cavan); `Espacio` coloca dinamita. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'dig-dug-lite'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `dig-dug-lite`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Arpón/bomba de aire, Fygar y fuego, modo fantasma, varias vidas.
- Tienda, mejoras persistentes entre partidas, mapas diseñados a mano.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('dig-dug-lite', 'DIG DUG LITE', 'Cava rápido y saca las gemas antes del cero.',
       'Excava con las flechas o WASD y recoge todas las gemas de la veta antes de que el reloj llegue a cero: cada gema da tiempo y las más hondas valen más. Los topos cavan su propio túnel para atraparte; aplástalos socavando rocas o coloca dinamita con Espacio, pero aléjate de la explosión. Tienes una sola vida y cada veta es más difícil.',
       'ARCADE', 'cyan', 'cover-dig-dug-lite', 1, 1, '{keyboard}', '{CONTRARRELOJ,EXCAVAR}', 4, 7, false);

Definición del motor:

    export const digDugLiteDef: GameEngineDef = {
      width: 640, height: 640,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "cyan", format: "seconds" },
        { key: "gems", label: "GEMAS", color: "green", format: "int" },
        { key: "dyn", label: "DINAMITA", color: "yellow", format: "int" },
      ],
      create: createDigDugLite,
    };

Estado interno (dentro de `createDigDugLite`): `dug: boolean[16][16]`, `gems: Map<"c,r", { row }>`, `rocks: { c, r, y, state: "idle" | "wobble" | "falling", ms, kills }[]`, `player { c, r, nc, nr, progress }`, `held: Dir[]` (pila de direcciones pulsadas; manda la última), `moles: { c, r, nc, nr, progress, freezeMs }[]`, `dynamite { c, r, fuseMs } | null`, `dynCount`, `blasts: { cells, ms }[]`, `popups: { text, x, y, ms }[]`, `remainingMs`, `lastSecondEmitted`, `spawnTimerMs`, `spawnCorner` (alterna 0/15), `score`, `level`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`, `rand` (`Math.random`).

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`, `onStat("gems", n)`, `onStat("dyn", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 75)`, `onStat("gems", 8)`, `onStat("dyn", 3)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.ceil(remainingMs / 1000)` (una vez por segundo y al sumar tiempo). Valor 0 oculta el stat (contrato de `onStat`); ocurre con `gems` al limpiar la veta (justo antes de regenerarla), con `dyn` sin cargas y con `time` al agotarse.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. `Espacio` ignora `e.repeat` (una dinamita por pulsación); el movimiento es continuo mientras se mantiene una dirección.
- Pausa/blur/destroy vacían `held`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Rejilla:** 16 × 16 celdas de 40 px. Fila 0 = superficie, siempre excavada (cielo). Estratos: superficial filas 1–5, medio filas 6–10, profundo filas 11–15. Dos celdas excavadas adyacentes siempre están conectadas (no hay aristas).
- **Generación de veta** (`generateVein`): filas 1–15 todo tierra. Rocas: `rockCount = min(4 + level, 9)` en filas 2–12, fuera de la columna 7 en filas 1–3, sin dos rocas en vertical adyacentes y con tierra debajo. Gemas: `gemCount = 8 + min(level − 1, 4)` en celdas de tierra distintas de filas 2–15, sin roca y a distancia Manhattan ≥ 3 de (7, 0). Topos: `moleCount = min(1 + level, 6)` en filas 10–15, a Manhattan ≥ 8 de (7, 0) y ≥ 3 entre sí; su celda queda excavada. Hasta 200 reintentos por elemento; si falla, primera celda válida en orden de recorrido.
- **Jugador:** aparece en (7, 0). Movimiento celda a celda: parado en un centro, si hay dirección en `held` y la celda destino está dentro de la rejilla y no es roca, empieza un paso a **5 celdas/s** si está excavada o **3.5 celdas/s** si cava (la celda se marca excavada al empezar el paso). Invertir a mitad de paso es inmediato (`progress = 1 − progress`); un giro perpendicular espera al centro. Cavar no da puntos.
- **Gemas:** al entrar el jugador en el centro de su celda se recoge: `gemValue × level` puntos (superficial **50**, medio **100**, profundo **200**) y **+2000 ms** de tiempo (tope 99000) → `onStat("gems", quedan)`. Los topos no recogen gemas. Una roca que cae por la celda de una gema ya descubierta la destruye (cuenta como retirada, sin puntos ni tiempo).
- **Tiempo:** `remainingMs` empieza en **75000** y baja con `dt` solo en juego. Al llegar a 0 → game over.
- **Fin de veta:** al no quedar gemas: bonus `clearBonus = floor(remainingMs / 1000) × 10 × level`, `remainingMs = min(remainingMs + 15000, 99000)`, `level += 1` → `onLevel(level)`, `dynCount = min(dynCount + 1, 5)` → `onStat("dyn", n)`, nueva veta (`generateVein`), jugador en (7, 0), dinamita y explosiones eliminadas, `onStat("gems", gemCount)`. El tiempo sigue corriendo.
- **Topos:** en cada centro calculan `nextStep` hacia la celda actual del jugador (Dijkstra, coste 1 excavada, 2.5 tierra, roca intransitable) y avanzan una celda. Velocidad por túnel `moleSpeed = min(2.6 + 0.2 × (level − 1), 4.2)` celdas/s; cavando **0.55 ×** esa velocidad; la celda queda excavada al empezar el paso. Al inicio de cada veta están congelados **2000 ms** (parpadean); el jugador y el tiempo sí corren. Nunca entran en la fila 0 (intransitable para ellos); si el jugador está en la fila 0, su objetivo pasa a ser la celda (columna del jugador, 1).
- **Refuerzos:** cada **25000 ms** de juego, si hay menos de **6** topos, nace uno en (0, 15) o (15, 15) alternando, congelado **1000 ms**; su celda queda excavada.
- **Contacto:** un topo no congelado a menos de **26 px** del jugador → game over.
- **Rocas:** ni jugador ni topos entran en una celda de roca. Cuando la celda de abajo está excavada, la roca tiembla **500 ms** (aunque el jugador esté debajo) y cae a **7 celdas/s** por celdas excavadas hasta apoyarse en tierra, otra roca o la fila 15. **No se rompe**: queda en su nueva celda y vuelve a caer si se socava otra vez. Su celda original queda excavada.
- **Aplastar:** la roca en caída mata a todo topo y al jugador cuya celda redondeada atraviese (jugador → game over). El n-ésimo topo de la misma caída vale `crushPoints = 500 × n × level` (500, 1000, 1500… en nivel 1).
- **Dinamita** (`Espacio`): si `dynCount > 0` y no hay otra activa, se coloca en la celda redondeada del jugador, `dynCount −= 1` → `onStat("dyn", n)`. Mecha **1500 ms** (parpadea cada 150 ms). Al detonar, `blastCells` = la celda y hasta **2** celdas en cada dirección ortogonal (cruz de hasta 9 celdas, recortada a la rejilla y sin afectar a la fila 0): todas quedan excavadas, las rocas en ellas se destruyen (+**50 × level** cada una) y las gemas sobreviven. Mueren los topos con su celda redondeada en la cruz: **300 × level** cada uno, y si son 2 o más el total de esa explosión se duplica (`blastPoints`). Si el jugador está en la cruz → game over. La explosión se dibuja **300 ms** y solo afecta en el instante de detonar. Empieza con **3** cargas; +1 por veta limpiada, tope **5**.
- **Game over:** tiempo a 0, contacto con topo, roca o dinamita propia → `onLives(0)` y `onGameOver(score)` inmediatamente.
- **Dibujo:** cielo `#0a1a2a` con estrellas fijas; tierra por estrato `#5a3a22`, `#3e2616`, `#24160c` con vetas más claras fijas por celda; túnel `#05050a` (celda completa 40×40 con esquinas redondeadas de 6 px). Gemas como rombos de 22 px: esmeralda `#00ff88`, rubí `#ff3355`, diamante `#00f5ff`, con destello blanco que gira; si están en tierra aún sin cavar se ven al **40 %** de opacidad. Jugador: minero con casco `#ffe600` y linterna (cono `rgba(255,230,0,0.15)` de 60 px hacia la última dirección). Topo: elipse `#8a5a3a` con hocico rosa `#ff9eb5` y garras blancas; congelado parpadea. Roca `#8a8a9a` con borde `#5a5a6a`, tiembla ±2 px. Dinamita: cartucho `#ff3355` con mecha `#ffe600`. Explosión: celdas con gradiente radial blanco → `#ffe600` → `#ff8c00` → transparente. Textos `#ffffff` (puntos) y `#00f5ff` (tiempo) 14 px monoespaciada, suben 20 px en 700 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-dig-dug-lite` en `app/globals.css`. Aplicar migración `add_game_dig_dug_lite` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'dig-dug-lite'` muestra la fila; `npm run build`.
2. Crear `lib/games/dig-dug-lite/balance.ts`. Verificar: `npm run lint`; `gemCount(1) = 8`, `gemCount(9) = 12`, `rockCount(1) = 5`, `rockCount(9) = 9`, `moleCount(1) = 2`, `moleCount(9) = 6`, `moleSpeed(1) = 2.6`, `moleSpeed(20) = 4.2`, `crushPoints(3, 2) = 3000`, `blastPoints(2, 1) = 1200`, `clearBonus(42500, 3) = 1260`.
3. Crear `lib/games/dig-dug-lite/map.ts` y `pathing.ts`. Verificar: `npm run lint`; `generateVein(1)` cumple las distancias y `nextStep` prefiere 3 celdas excavadas a 2 de tierra y nunca atraviesa rocas.
4. Crear `lib/games/dig-dug-lite/draw.ts`. Verificar: `npm run lint`.
5. Crear `lib/games/dig-dug-lite/engine.ts` y exportar `digDugLiteDef`. Verificar: `npm run lint` y `npm run build`.
6. Registrar `"dig-dug-lite"` en `lib/games/registry.ts`. Verificar: `/games/dig-dug-lite/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
7. Verificación en navegador (Playwright o manual): velocidades cavando y por túnel, recoger gemas de los 3 estratos con puntos y +2 s, TIEMPO bajando 1 por segundo, topos congelados 2 s y luego cavando hacia el jugador, refuerzo a los 25 s, roca que cae con el jugador debajo, roca que queda y vuelve a caer, aplastar 2 topos (500 + 1000), dinamita con mecha 1,5 s, cruz de 2 celdas, doble por 2+ topos, morir por la propia dinamita, limpiar veta (bonus, +15 s, +1 dinamita, nivel 2), tiempo agotado, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
8. `update games set published = true where id = 'dig-dug-lite'` (también registrada en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
9. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `dig-dug-lite` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-dig-dug-lite`), la ficha `/games/dig-dug-lite` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CONTRARRELOJ`/`EXCAVAR`, dificultad 4, color cyan, categoría ARCADE).
- [ ] `/games/dig-dug-lite/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] Al empezar: jugador en (7, 0), 8 gemas, 5 rocas, 2 topos parpadeando quietos 2000 ms; HUD con TIEMPO 75, GEMAS 8, DINAMITA 3, nivel 1 y 1 vida.
- [ ] Flechas y `W`/`A`/`S`/`D` mueven celda a celda: 5 celdas/s por túnel, 3.5 cavando; invertir es inmediato; no se entra en rocas; las flechas y `Espacio` no hacen scroll.
- [ ] Las gemas sin descubrir se ven atenuadas; recogerlas en nivel 1 suma 50/100/200 según el estrato y +2 s (tope 99 s); GEMAS baja en 1.
- [ ] TIEMPO baja 1 por segundo de juego; al llegar a 0 termina la partida.
- [ ] Los topos cavan hacia el jugador a 2.6 × 0.55 celdas/s en tierra y 2.6 celdas/s por túnel en nivel 1, rodean las rocas y prefieren los túneles; tocar uno no congelado termina la partida.
- [ ] Cada 25 s de juego nace un topo en una esquina inferior (alternando) si hay menos de 6.
- [ ] Una roca socavada tiembla 500 ms y cae a 7 celdas/s aunque el jugador esté debajo; queda donde cae y vuelve a caer si se socava; aplasta topos por 500 × n × nivel y al jugador.
- [ ] `Espacio` coloca dinamita (solo una activa, mantener no repite); explota a los 1500 ms en cruz de radio 2, excava, destruye rocas (+50 × nivel), respeta gemas, mata topos (300 × nivel, total ×2 con 2 o más) y al jugador si está en la cruz; DINAMITA baja en 1 y no se puede colocar con 0.
- [ ] Limpiar la veta suma `floor(segundos) × 10 × nivel`, +15 s (tope 99), +1 dinamita (tope 5), sube el nivel (`onLevel`) y genera una veta nueva con 9 gemas en nivel 2; el puntaje se conserva.
- [ ] Cualquier muerte emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida, nivel, TIEMPO, GEMAS y DINAMITA; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela tiempo, jugador, topos, rocas, mecha y refuerzos; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`/`A`/`S`/`D`, espacio) no mueve ni coloca dinamita.
- [ ] Guardar inserta en `scores` con `game_id = 'dig-dug-lite'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/dig-dug-lite` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 75, GEMAS 8, DINAMITA 3, veta nueva, sin dinamita activa ni refuerzos pendientes).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/dig-dug-lite/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** objetivo de gemas contra reloj; es la diferencia central con la variante 01. **No:** arpón ni bombeo, fantasmas ni Fygar.
- **Sí:** topos que cavan con Dijkstra (coste 1 / 2.5); el mapa cambia en cada partida y el jugador puede usar sus túneles a favor. **No:** persecución aleatoria solo por túneles.
- **Sí:** rocas persistentes que caen aunque el jugador esté debajo; refuerzan el componente de riesgo y permiten reutilizarlas como trampa.
- **Sí:** dinamita limitada (3 iniciales, +1 por veta, tope 5) que también mata al jugador; arma de emergencia con coste.
- **Sí:** 1 vida (`initialLives: 1`); partida corta e intensa, el tiempo es el recurso a gestionar. **No:** vidas extra.
- **Sí:** puntos × nivel en gemas y bajas y bonus por segundos restantes; premia la velocidad y amplía el rango del leaderboard.
- **Sí:** stats `TIEMPO`, `GEMAS` y `DINAMITA`; son las tres decisiones del jugador en esta variante.
- **No:** puntos por cavar; el puntaje viene de objetivos, no de recorrer.
- **Sí:** valores de balance (velocidades, tiempos, radios, puntos, cantidades) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color cyan (gemas y reloj); **Sí:** `.cover-dig-dug-lite` nueva.
- **Sí:** canvas 640×640 (16×16 celdas de 40 px), más grande que la variante 01 para que haya rutas alternativas.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                             | Mitigation                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Dijkstra por topo en cada celda cuesta demasiado con 6 topos.                    | Rejilla de 256 nodos y cálculo solo al llegar a un centro (≤ ~25 cálculos/s en total); cola simple sin estructuras externas.     |
| Un topo encerrado entre rocas sin camino se queda bloqueado o rompe el estado.   | `nextStep` devuelve `null`: el topo espera quieto en su celda y reintenta el cálculo cada 250 ms.                                |
| Una gema queda inalcanzable (bajo rocas apoyadas) y la veta no se puede limpiar. | La dinamita destruye rocas y excava; una roca que cae por una gema descubierta la retira; se garantiza ≥ 1 carga tras cada veta. |
| Morir por la propia dinamita sin entender por qué.                               | Mecha visible de 1500 ms parpadeando y explosión dibujada 300 ms; criterio de aceptación explícito.                              |
| Emitir `onStat("time")` por frame satura React.                                  | Emitir solo cuando cambia `Math.ceil(remainingMs / 1000)`.                                                                       |
| `dt` grande tras pausar o cambiar de pestaña consume tiempo o salta celdas.      | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `remainingMs` solo baja en juego.                           |
| Flechas, `WASD` o espacio interfieren con el input del modal.                    | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                             |
| Dirección "pegada" tras perder foco.                                             | `blur` y `pause` vacían `held`.                                                                                                  |
| Doble loop / listeners por StrictMode.                                           | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                           |
| El id con guiones requiere comillas en `ENGINES` y rutas de carpeta.             | Clave `"dig-dug-lite"` entre comillas; carpeta `lib/games/dig-dug-lite/`; migración con `_` en el nombre.                        |
| Next 16 difiere del conocimiento previo.                                         | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                                  |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Arpón/bomba de aire, Fygar, fuego, modo fantasma y vidas extra.
- Tienda, mejoras persistentes y mapas diseñados a mano.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
