# SPEC GJ-pong-vs-cpu-02 — Juego real: PONG VS CPU (variante: rally con efecto) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-17
> **Variant:** 02 de 2 — Pong moderno vertical de supervivencia: 3 vidas, partida sin fin contra una CPU que mejora con cada gol tuyo, efecto (curva) al golpear en movimiento y multiplicador de rally.
> **Objective:** Crear un motor TypeScript de Pong vs CPU (variante rally con efecto) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Pong vs CPU. Reinterpreta el Pong como **supervivencia**: la cancha es **vertical** (jugador abajo, CPU arriba, palas horizontales; encaja mejor en pantallas de móvil para el futuro `mobile-porter`), no hay partidos ni marcador cerrado y la partida dura mientras te queden **3 vidas**. Dos mecánicas nuevas dan profundidad y abren el rango del leaderboard: el **efecto** (si la pala se mueve al golpear, la pelota curva su trayectoria, lo que despista a la CPU) y el **multiplicador de rally** (cada 4 devoluciones seguidas sube el multiplicador hasta ×8). Cada gol tuyo sube el nivel de la CPU; encadenar 3 goles sin recibir devuelve una vida. Se distingue de la variante 01 (horizontal, escalera de partidos a 5 goles, sin efecto ni multiplicador, perder un partido termina).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos y gradientes. `.cover-duelo` de `app/globals.css` es horizontal y de prototipo; se crea `.cover-pong-vs-cpu` vertical propia.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `VERSUS`, color `magenta`, `sort_order` **7** (siguiente libre: frogger = 5 implementado, `missile-command` reserva 6 en sus specs propuestos), dificultad 3, tags `DUELO` y `EFECTO`, 1 jugador (contra la CPU), teclado. Canvas **480×640** (3:4, vertical). **3 vidas** (`initialLives: 3`, máximo 5), **nivel** de la CPU (`showLevel: true`), stats extra `MULTI` y `MEJOR RALLY`. Sin marcador nativo en el canvas (el HUD de React basta). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/balance.ts`: funciones puras (`cpuSpeed(level)`, `cpuReactMs(level)`, `cpuError(level)`, `bounceAngle(rel)`, `nextSpeed(speed)`, `multiplier(rallyHits)`, `decaySpin(spin, dtMs)`) y constantes (`W`, `H`, `PADDLE`, `BALL`, `MAX_LIVES`).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawCourt` (fondo + línea central, pre-renderizado una vez en un canvas offscreen por instancia), `drawPaddle`, `drawBall` (halo con gradiente radial pre-renderizado, sin `shadowBlur`), `drawTrail` (estela de efecto). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `linear-gradient(180deg,#0a0018,#1a0030)`, `::after` con línea central horizontal punteada blanca, pala superior `var(--cyan)` (30% 12%/30% 6px), pala inferior `var(--magenta)` (60% 88%/30% 6px) y pelota `var(--yellow)` de 10 px en 55% 45%; `::before` con una curva punteada amarilla (`radial-gradient` en anillo, 40% de opacidad) que sugiere el efecto.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **vidas** (3, máximo 5), **nivel** y stats extra `mult` ("MULTI", `int`) y `rally` ("MEJOR RALLY", `int`).
- Sin HUD nativo en el canvas: cancha, palas, pelota y estela.
- Controles: `←`/`→` y `A`/`D` mueven la pala del jugador. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores local u online, power-ups, varias pelotas, efecto en los golpes de la CPU.
- Partidos con marcador cerrado o escalera de rivales.
- Selector de dificultad.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Curva la pelota y sobrevive a la CPU.',
       'Mueve tu pala con las flechas o A/D y devuelve la pelota. Si golpeas mientras te mueves, la pelota toma efecto y se curva para engañar a la CPU. Cada 4 devoluciones seguidas sube el multiplicador hasta ×8; cada gol tuyo hace a la CPU más rápida y tres goles seguidos te devuelven una vida. Tienes 3 vidas: cada gol que recibes te quita una.',
       'VERSUS', 'magenta', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{DUELO,EFECTO}', 3, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "mult", label: "MULTI", color: "magenta", format: "int" },
        { key: "rally", label: "MEJOR RALLY", color: "yellow", format: "int" },
      ],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { x, left, right }`, `cpu { x, sampleX, sampleMs, error }`, `ball { x, y, vx, vy, speed, spin }`, `trail: {x, y}[]` (máx. 8), `serveMs` (cuenta atrás del saque; `> 0` = pelota oculta), `serveDir` (`-1` hacia la CPU, `1` hacia el jugador), `lives`, `level`, `score`, `rallyHits`, `mult`, `bestRally`, `goalStreak`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`, canvas offscreen de la cancha y del halo.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("mult", n)`, `onStat("rally", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("mult", 1)`, `onStat("rally", 0)` (valor 0 oculta el stat según el contrato; esperado al inicio).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en `←`/`→` solo con el juego activo y sin pausa. El movimiento es continuo mientras la tecla está mantenida (`e.repeat` no cambia nada).
- Pausa/blur/destroy ponen `player.left = player.right = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Cancha:** 480×640. Rebote en los bordes izquierdo (`x = 0`) y derecho (`x = 480`). Línea central: rectángulos de 16×4 px cada 32 px en `y = 318`.
- **Palas:** 90×12 px. CPU con borde superior en `y = 24`; jugador con borde superior en `y = 604`. Ambas empiezan centradas (`x` izquierda = 195) y se limitan a `[0, 390]`.
- **Jugador:** `←`/`A` y `→`/`D` mueven la pala a **480 px/s**; ambas pulsadas = quieto. `playerVx` ∈ {−480, 0, 480}.
- **Pelota:** cuadrado de 10×10. Saque desde el centro (235, 315) tras **1000 ms** (`serveMs`) a **320 px/s**, ángulo aleatorio en `[−25°, +25°]` respecto a la vertical, en dirección `serveDir`, con `spin = 0`. Primer saque: hacia la CPU. Tras un gol, saca hacia quien lo recibió.
- **Golpe de pala:** solo si la pelota se mueve hacia esa pala y sus rectángulos se solapan. `rel = (centroPelotaX − centroPalaX) / 45` limitado a `[−1, 1]`; ángulo de salida `rel × 55°` respecto a la vertical; `speed = min(speed × 1.05, 760)`; la pelota se recoloca justo fuera de la pala. Movimiento integrado en subpasos de como máximo **5 px** (sin túneles).
- **Efecto (solo golpes del jugador):** al golpear, `spin = playerVx / 480` (−1, 0 o 1). Cada frame: `vx += spin × 320 × dt/1000`; luego se renormaliza `(vx, vy)` a `speed` y se limita el ángulo a **±65°** de la vertical; `spin *= 0.5^(dt/1000)` (se reduce a la mitad por segundo). Un golpe de la CPU o un rebote lateral ponen `spin = 0`. Mientras `|spin| ≥ 0.1` se dibuja la estela.
- **Rally y multiplicador:** cada golpe del jugador hace `rallyHits += 1`, `mult = min(1 + Math.floor(rallyHits / 4), 8)` y suma **10 × mult** puntos. `onStat("mult", mult)` solo si cambió. Si `rallyHits > bestRally`, `bestRally = rallyHits` y `onStat("rally", bestRally)`. Tras cada gol: `rallyHits = 0`, `mult = 1` (`onStat("mult", 1)` si cambió).
- **Gol del jugador** (pelota con `y + 10 < 0`): suma **200 × mult** (mult previo al reinicio) y **+100** extra si `|spin| ≥ 0.25` en ese momento ("gol con efecto"); `level += 1` → `onLevel(level)`; `goalStreak += 1`; si `goalStreak = 3`: `goalStreak = 0` y, si `lives < 5`, `lives += 1` → `onLives(lives)`.
- **Gol de la CPU** (pelota con `y > 640`): `lives -= 1` → `onLives(lives)`; `goalStreak = 0`. Con `lives = 0`: `onGameOver(score)` (el `onLives(0)` ya se emitió antes).
- **IA de la CPU** (nivel `L`, sin tope):
  - Velocidad máxima `cpuSpeed(L) = min(240 + 30 × (L − 1), 480)` px/s.
  - Muestreo con retardo: solo mientras la pelota sube (`vy < 0`), cada `cpuReactMs(L) = max(70, 250 − 20 × (L − 1))` ms copia `sampleX = centroPelotaX`; entre muestras sigue el último `sampleX` (por eso el efecto la engaña). Con la pelota bajando vuelve al centro (`x` = 195) a la mitad de su velocidad.
  - Error de puntería: en cada golpe del jugador se sortea `error` uniforme en `[−e, +e]` con `e = cpuError(L) = max(6, 30 − 3 × (L − 1))` px; el objetivo es que el centro de la pala quede en `sampleX + error`.
  - Zona muerta de **4 px**. La CPU no predice rebotes ni curva.
- **Puntaje:** solo crece; nunca resta.
- **Dibujo:** fondo `#0a0012`; línea central `rgba(255,255,255,0.2)`; pala del jugador `#ff2bd6`, pala CPU `#00f5ff`; pelota `#ffffff` con halo radial `rgba(255,43,214,0.35)` → transparente de 24 px; estela de efecto: últimos 8 centros como cuadrados de 6 px `#ffe600` con opacidad 0.6 → 0.05. Desde `mult ≥ 4` el halo de la pelota pasa a `rgba(255,230,0,0.45)`. Durante `serveMs > 0` la pelota no se dibuja.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/balance.ts`. Verificar: `npm run lint`; `cpuSpeed(1) = 240`, `cpuSpeed(9) = 480`, `cpuReactMs(1) = 250`, `cpuReactMs(10) = 70`, `cpuError(1) = 30`, `cpuError(9) = 6`, `multiplier(3) = 1`, `multiplier(4) = 2`, `multiplier(40) = 8`, `decaySpin(1, 1000) = 0.5`.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover la pala a los topes, golpe quieto (sin curva) y en movimiento (curva visible con estela), rebote lateral que anula el efecto, multiplicador ×2 a las 4 devoluciones, MEJOR RALLY, gol propio (nivel sube, 200 × mult, +100 con efecto), 3 goles seguidos (vida extra, tope 5), recibir goles hasta 0 vidas (modal), aceleración hasta 760 px/s sin túnel, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu` vertical), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `DUELO`/`EFECTO`, dificultad 3, color magenta, categoría VERSUS); aparece al filtrar por VERSUS en `/games`.
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas 3:4 vertical sin desborde a 375 px y 1280 px (en escritorio no supera el alto de la ventana).
- [ ] `←`/`→` y `A`/`D` mueven la pala a 480 px/s sin salir de la cancha; las flechas no hacen scroll de la página.
- [ ] El primer saque sale hacia la CPU a 320 px/s tras 1000 ms, con ángulo dentro de ±25° de la vertical.
- [ ] Golpear con el centro de la pala devuelve la pelota vertical; con el borde, a 55°; cada golpe multiplica la velocidad por 1.05 hasta 760 px/s y la pelota nunca atraviesa una pala.
- [ ] Golpear quieto no curva la pelota; golpear moviéndose la curva hacia el lado del movimiento con estela amarilla, el efecto se reduce a la mitad cada segundo y un rebote lateral o un golpe de la CPU lo anulan; el ángulo nunca pasa de 65° desde la vertical.
- [ ] Devoluciones 1–3 suman 10 cada una, 4–7 suman 20, …, hasta 80 (×8); MULTI en el HUD cambia solo al subir o al reiniciarse a 1 tras un gol.
- [ ] Un gol del jugador suma 200 × mult (+100 si la pelota llevaba efecto ≥ 0.25) y sube el nivel en 1; 3 goles seguidos sin recibir dan +1 vida sin pasar de 5.
- [ ] En nivel 1 la CPU se mueve como máximo a 240 px/s y muestrea la pelota cada 250 ms; en nivel 9 va a 480 px/s; desde nivel 10 muestrea cada 70 ms.
- [ ] Cada gol de la CPU baja 1 vida; al llegar a 0 se emite `onLives(0)` y luego `onGameOver` y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3, máx. 5), nivel, MULTI y MEJOR RALLY; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pelota, efecto, palas, muestreo de la CPU y cuenta atrás del saque; reanudar sin salto de tiempo ni pala "pegada".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`) no mueve la pala.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vidas 3, nivel 1, MULTI 1, MEJOR RALLY oculto, palas centradas, sin estela, saque hacia la CPU).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** supervivencia con 3 vidas y partida sin fin; el puntaje es abierto y competible. **No:** partidos con marcador cerrado (es la variante 01).
- **Sí:** cancha vertical 480×640; diferencia visual clara con la 01 y mejor encaje futuro en móvil vertical.
- **Sí:** efecto solo en golpes del jugador y CPU con muestreo retardado; la curva es la herramienta para ganar puntos. **No:** efecto en golpes de la CPU (haría la defensa injusta con teclado).
- **Sí:** multiplicador por rally (×1 a ×8 cada 4 devoluciones) y gol que vale 200 × mult; premia mantener rallies largos antes de rematar.
- **Sí:** nivel sube con cada gol del jugador (la CPU mejora en velocidad, muestreo y puntería, con topes 480 px/s, 70 ms, 6 px). **No:** nivel por tiempo.
- **Sí:** vida extra por 3 goles seguidos, tope 5; recompensa rachas sin alargar la partida indefinidamente.
- **Sí:** stats `MULTI` y `MEJOR RALLY`; sin marcador nativo en el canvas (no hay marcador de partido).
- **Sí:** subpasos de 5 px en la pelota para evitar túneles a 760 px/s con `dt` de 50 ms.
- **Sí:** valores de balance (velocidades, ángulos, efecto, aceleración, puntos, multiplicador, vida extra) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS (primer juego real de la categoría) y color magenta (pala del jugador); **Sí:** `.cover-pong-vs-cpu` nueva y vertical; **No:** reutilizar `.cover-duelo` de prototipo.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| La pelota atraviesa la pala a alta velocidad (túnel) con `dt` de 50 ms. | Subpasos de máximo 5 px; colisión solo si la pelota va hacia la pala; recolocar fuera tras el golpe. |
| El efecto vuelve la pelota casi horizontal y rebota sin avanzar. | Renormalizar a `speed` y limitar el ángulo a ±65° de la vertical; rebote lateral anula `spin`. |
| Efecto demasiado fuerte o débil (CPU siempre engañada o nunca). | Aceleración 320 px/s² con decaimiento a la mitad por segundo; verificar niveles 1, 5 y 10 en el paso 6 y ajustar solo editando el spec. |
| Partidas interminables en niveles altos. | La pelota acelera 5 % por golpe hasta 760 px/s, por encima del máximo de la CPU y del jugador (480 px/s); vida extra con tope 5. |
| Canvas vertical demasiado alto en escritorio o desbordado en móvil. | `GamePlayer` fija `--game-ar` desde `width/height`; criterio de aceptación a 375 y 1280 px. |
| `dt` grande tras pausar o cambiar de pestaña hace saltar la pelota o adelanta el muestreo. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; `sampleMs` solo avanza en juego. |
| Flechas o `A`/`D` interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Pala "pegada" tras perder foco. | `blur` y `pause` ponen `left`/`right` a `false`. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| El id con guiones requiere comillas en `ENGINES`, carpeta y nombre de migración. | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores (local u online), power-ups, varias pelotas, efecto en los golpes de la CPU.
- Partidos con marcador cerrado y escalera de rivales.
- HUD nativo dentro del canvas y overlays de pausa/game over.
- Selector de dificultad.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
