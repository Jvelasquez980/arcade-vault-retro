# SPEC GJ-pong-vs-cpu-01 — Juego real: PONG VS CPU (variante: escalera de rivales) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-17
> **Variant:** 01 de 2 — Pong clásico horizontal: partidos a 5 goles contra una escalera de rivales CPU cada vez más hábiles; perder un partido termina la carrera.
> **Objective:** Crear un motor TypeScript de Pong vs CPU (variante escalera de rivales) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/pong-vs-cpu` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Pong vs CPU. Es el Pong **fiel al original**: cancha horizontal, palas verticales a izquierda (jugador) y derecha (CPU), pelota cuadrada, red punteada y marcador grande en el canvas. Para que el puntaje sea **competible** (el problema señalado en `references/game-suggestions-todo.md`), la partida no es un único partido sino una **escalera**: cada partido es a **5 goles**; ganarlo sube de rival (nivel) con una CPU más rápida y precisa, y perderlo termina la partida. El puntaje suma devoluciones, goles y bonus por partido ganado, escalados por el nivel del rival. Se distingue de la variante 02 (vertical, supervivencia infinita con 3 vidas, efecto/curva y multiplicador de rally).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con rectángulos y gradientes. En `app/globals.css` existe `.cover-duelo` (prototipo, no usada por ningún juego real); se crea `.cover-pong-vs-cpu` propia tomándola como base para no acoplar el juego a una clase de prototipo.

Decisiones fijadas por el agente (no se reabren): `id` `pong-vs-cpu`, título `PONG VS CPU`, `cat` `VERSUS`, color `cyan`, `sort_order` **7** (siguiente libre: frogger = 5 implementado, `missile-command` reserva 6 en sus specs propuestos), dificultad 2, tags `CLÁSICO` y `DUELO`, 1 jugador (contra la CPU), teclado. Canvas **800×500** (16:10). **Vidas = goles que la CPU aún necesita para ganar el partido** (`initialLives: 5`, se reponen a 5 al empezar cada partido), **nivel = rival actual** (`showLevel: true`), stat extra `MEJOR RALLY`. Marcador nativo de goles dibujado en el canvas (elemento del juego, no overlay). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/pong-vs-cpu/engine.ts`: sin globals de módulo; exporta `pongVsCpuDef: GameEngineDef` con `createPongVsCpu(canvas, events) → GameController`.
- Módulo `lib/games/pong-vs-cpu/balance.ts`: funciones puras (`cpuSpeed(level)`, `cpuTrackFrom(level)`, `cpuError(level)`, `bounceAngle(rel)`, `nextSpeed(speed)`, `matchBonus(level, lives)`) y constantes (`W`, `H`, `PADDLE`, `BALL`, `GOALS_TO_WIN`).
- Módulo `lib/games/pong-vs-cpu/draw.ts`: `drawCourt` (fondo + red, pre-renderizado una vez en un canvas offscreen por instancia), `drawPaddle`, `drawBall` (halo con gradiente radial pre-renderizado, sin `shadowBlur`), `drawScore` (dígitos de 7 segmentos con rectángulos). Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"pong-vs-cpu"` en `lib/games/registry.ts`.
- Clase `.cover-pong-vs-cpu` en `app/globals.css`: fondo `#0a0a18`, `::after` con red central punteada blanca, pala izquierda `var(--cyan)` (6% 40%/6px 30%), pala derecha `var(--magenta)` (88% 30%/6px 30%) y pelota cuadrada `var(--yellow)` de 10 px en 40% 50%; `drop-shadow` cyan.
- Migración `add_game_pong_vs_cpu`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **800×500**.
- HUD de React: puntaje, **vidas** (5 por partido), **nivel** (rival) y stat extra `rally` ("MEJOR RALLY", `int`).
- HUD nativo en el canvas: solo el marcador de goles del partido actual (jugador | CPU) en la parte superior.
- Controles: `↑`/`↓` y `W`/`S` mueven la pala del jugador. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'pong-vs-cpu'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `pong-vs-cpu`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Modo 2 jugadores local u online, efecto/curva de pelota, power-ups, multiplicadores.
- Selector de dificultad o de rival inicial.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('pong-vs-cpu', 'PONG VS CPU', 'Vence a una escalera de rivales CPU.',
       'Mueve tu pala con las flechas o W/S y devuelve la pelota. Cada partido es a 5 goles: si lo ganas, llega un rival CPU más rápido y preciso; si la CPU marca 5, se acabó. Sumas puntos por cada devolución, por cada gol y por cada partido ganado, y todo vale más cuanto más alto llegues en la escalera.',
       'VERSUS', 'cyan', 'cover-pong-vs-cpu', 1, 1, '{keyboard}', '{CLÁSICO,DUELO}', 2, 7, false);

Definición del motor:

    export const pongVsCpuDef: GameEngineDef = {
      width: 800, height: 500,
      initialLives: 5,
      showLevel: true,
      stats: [{ key: "rally", label: "MEJOR RALLY", color: "yellow", format: "int" }],
      create: createPongVsCpu,
    };

Estado interno (dentro de `createPongVsCpu`): `player { y, up, down }`, `cpu { y, targetY, error }`, `ball { x, y, vx, vy, speed } `, `serveMs` (cuenta atrás del saque; `> 0` = pelota oculta), `serveDir` (`1` hacia la CPU, `-1` hacia el jugador), `playerGoals`, `cpuGoals`, `lives`, `level`, `score`, `rallyHits`, `bestRally`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`, canvas offscreen de la cancha y del halo.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("rally", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(5)`, `onLevel(1)`, `onStat("rally", 0)` (valor 0 oculta el stat según el contrato; esperado al inicio).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas (marcador con los 5 goles de la CPU).
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en `↑`/`↓` solo con el juego activo y sin pausa. El movimiento es continuo mientras la tecla está mantenida (`e.repeat` no cambia nada).
- Pausa/blur/destroy ponen `player.up = player.down = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Cancha:** 800×500. Rebote en el borde superior (`y = 0`) e inferior (`y = 500`). Red central: rectángulos de 4×16 px cada 32 px en `x = 398`.
- **Palas:** 12×80 px. Jugador con borde izquierdo en `x = 24`; CPU con borde izquierdo en `x = 764`. Ambas empiezan centradas (`y` superior = 210) y se limitan a `[0, 420]`.
- **Jugador:** `↑`/`W` sube y `↓`/`S` baja a **420 px/s**; ambas pulsadas = quieto.
- **Pelota:** cuadrado de 10×10. Saque desde el centro (395, 245) tras **800 ms** (`serveMs`) con velocidad **300 px/s** y ángulo aleatorio en `[−30°, +30°]` respecto a la horizontal, en dirección `serveDir`. Primer saque de la partida y de cada partido: hacia la CPU. Tras un gol, saca hacia quien lo recibió.
- **Golpe de pala:** solo si la pelota se mueve hacia esa pala y sus rectángulos se solapan. `rel = (centroPelotaY − centroPalaY) / 40` limitado a `[−1, 1]`; ángulo de salida `rel × 60°` respecto a la horizontal; `speed = min(speed × 1.06, 720)`; la pelota se recoloca justo fuera de la pala. Para evitar túneles, el movimiento de la pelota se integra en subpasos de como máximo **5 px**.
- **Rally:** cada golpe de la pala del jugador suma `rallyHits += 1` y +**10** puntos. Si `rallyHits > bestRally`, `bestRally = rallyHits` y `onStat("rally", bestRally)`. `rallyHits` vuelve a 0 tras cada gol. `bestRally` dura toda la partida.
- **Gol del jugador** (pelota con `x > 800`): `playerGoals += 1`, +**100 × level** puntos.
- **Gol de la CPU** (pelota con `x + 10 < 0`): `cpuGoals += 1`, `lives = 5 − cpuGoals` → `onLives(lives)`.
- **Fin de partido ganado** (`playerGoals = 5`): bonus **500 × level + 100 × lives**; `level += 1` → `onLevel(level)`; `playerGoals = cpuGoals = 0`, `lives = 5` → `onLives(5)`; palas recentradas; saque hacia la CPU tras **1500 ms** (en lugar de 800).
- **Fin de partido perdido** (`cpuGoals = 5`): `onLives(0)` y `onGameOver(score)`. No hay segunda oportunidad.
- **IA de la CPU** (nivel `L`, sin tope):
  - Velocidad máxima `cpuSpeed(L) = min(220 + 40 × (L − 1), 460)` px/s.
  - Solo persigue la pelota si se mueve hacia ella (`vx > 0`) y `ball.x ≥ cpuTrackFrom(L) = max(160, 480 − 40 × (L − 1))`; si no, vuelve al centro (`y` = 210) a la mitad de su velocidad.
  - Error de puntería: en cada golpe del jugador se sortea `error` uniforme en `[−e, +e]` con `e = cpuError(L) = max(8, 36 − 4 × (L − 1))` px; el objetivo es que el centro de la pala quede en `centroPelotaY + error`.
  - Zona muerta de **4 px** (no se mueve si la diferencia es menor). La CPU no predice rebotes: sigue la posición actual.
- **Puntaje:** solo crece; nunca resta.
- **Dibujo:** fondo `#05050f`; red `rgba(255,255,255,0.25)`; pala del jugador `#00f5ff`, pala CPU `#ff2bd6`; pelota `#ffffff` con halo radial `rgba(0,245,255,0.35)` → transparente de 24 px; marcador de 7 segmentos (dígitos de 30×50 px, trazo 6 px) en `#ffffff` a 60 % de opacidad, jugador centrado en `x = 320` y CPU en `x = 480`, `y = 24`. Durante `serveMs > 0` la pelota no se dibuja.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-pong-vs-cpu` en `app/globals.css`. Aplicar migración `add_game_pong_vs_cpu` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en la tabla de `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'pong-vs-cpu'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/pong-vs-cpu/balance.ts`. Verificar: `npm run lint`; `cpuSpeed(1) = 220`, `cpuSpeed(7) = 460`, `cpuSpeed(10) = 460`, `cpuTrackFrom(1) = 480`, `cpuTrackFrom(9) = 160`, `cpuError(1) = 36`, `cpuError(8) = 8`, `matchBonus(2, 3) = 1300`.
3. Crear `lib/games/pong-vs-cpu/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/pong-vs-cpu/engine.ts` y exportar `pongVsCpuDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"pong-vs-cpu"` en `lib/games/registry.ts`. Verificar: `/games/pong-vs-cpu/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover la pala a los topes, golpes con distintos ángulos (centro recto, borde 60°), aceleración hasta 720 px/s sin túnel, marcar y recibir goles (marcador nativo y vidas del HUD), ganar un partido (bonus, nivel 2, vidas 5, saque a 1500 ms), MEJOR RALLY, perder un partido (modal), pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'pong-vs-cpu'`. Verificar: tarjeta en `/games` (filtro VERSUS) y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `pong-vs-cpu` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-pong-vs-cpu`), la ficha `/games/pong-vs-cpu` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`DUELO`, dificultad 2, color cyan, categoría VERSUS); aparece al filtrar por VERSUS en `/games`.
- [ ] `/games/pong-vs-cpu/jugar` muestra el canvas 16:10 sin desborde a 375 px y 1280 px.
- [ ] `↑`/`↓` y `W`/`S` mueven la pala a 420 px/s sin salir de la cancha; las flechas no hacen scroll de la página.
- [ ] El primer saque sale hacia la CPU a 300 px/s tras 800 ms, con ángulo dentro de ±30°.
- [ ] Golpear con el centro de la pala devuelve la pelota horizontal; con el borde, a 60°; cada golpe multiplica la velocidad por 1.06 hasta 720 px/s y la pelota nunca atraviesa una pala.
- [ ] Cada devolución del jugador suma exactamente 10 puntos; MEJOR RALLY sube solo al superar el récord de la partida.
- [ ] Un gol del jugador suma 100 × nivel y actualiza el marcador nativo; un gol de la CPU baja las vidas del HUD en 1.
- [ ] Ganar 5–N suma 500 × nivel + 100 × vidas restantes, sube el nivel en 1, repone 5 vidas, pone el marcador a 0–0 y saca hacia la CPU tras 1500 ms.
- [ ] En nivel 1 la CPU se mueve como máximo a 220 px/s y solo reacciona con la pelota en `x ≥ 480`; en nivel 7 llega a 460 px/s; desde nivel 9 reacciona desde `x = 160`.
- [ ] Cuando la CPU marca su 5.º gol se emite `onLives(0)` y luego `onGameOver` y se abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (5 → 0), nivel y MEJOR RALLY; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela pelota, palas y cuenta atrás del saque; reanudar sin salto de tiempo ni pala "pegada".
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `S`) no mueve la pala.
- [ ] Guardar inserta en `scores` con `game_id = 'pong-vs-cpu'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/pong-vs-cpu` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, vidas 5, nivel 1, marcador 0–0, MEJOR RALLY oculto, palas centradas, saque hacia la CPU).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/pong-vs-cpu/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** escalera de partidos a 5 goles con rivales progresivos; convierte un duelo de marcador cerrado en un puntaje abierto y competible. **No:** un único partido a 11 (puntaje con techo fijo).
- **Sí:** vidas = goles que la CPU aún necesita (5, se reponen por partido); el HUD comunica el peligro real del partido. **No:** vidas globales entre partidos.
- **Sí:** nivel = rival; la CPU mejora en velocidad, zona de reacción y puntería, con topes (460 px/s, `x = 160`, 8 px) para que siempre sea batible por ángulo y velocidad de pelota.
- **Sí:** CPU sin predicción de rebotes; los golpes en ángulo son la herramienta del jugador. **No:** IA perfecta.
- **Sí:** marcador nativo de 7 segmentos en el canvas (identidad del Pong); es parte del juego, no un overlay.
- **Sí:** subpasos de 5 px en la pelota para evitar túneles a 720 px/s con `dt` de 50 ms.
- **Sí:** stat `MEJOR RALLY`; métrica de habilidad visible sin duplicar el marcador.
- **Sí:** valores de balance (velocidades, ángulos, aceleración, puntos, bonus) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` VERSUS (primer juego real de la categoría) y color cyan (pala del jugador); **Sí:** `.cover-pong-vs-cpu` nueva; **No:** reutilizar `.cover-duelo` de prototipo.
- **Sí:** canvas 800×500 horizontal, proporción clásica del Pong.
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| La pelota atraviesa la pala a alta velocidad (túnel) con `dt` de 50 ms. | Subpasos de máximo 5 px por integración; colisión solo si la pelota va hacia la pala; recolocar fuera tras el golpe. |
| CPU imbatible o trivial en algún nivel. | Topes de velocidad, reacción y error definidos; verificar niveles 1, 4 y 8 en el paso 6 y ajustar solo editando el spec. |
| Rallies interminables en niveles altos (partida sin fin). | La pelota acelera 6 % por golpe hasta 720 px/s, por encima del máximo de la CPU (460 px/s). |
| Pelota casi vertical rebotando sin avanzar. | Ángulo de salida limitado a ±60° desde la horizontal; saque limitado a ±30°. |
| `dt` grande tras pausar o cambiar de pestaña hace saltar la pelota. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms. |
| Flechas o `W`/`S` interfieren con el input del modal. | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa. |
| Pala "pegada" tras perder foco. | `blur` y `pause` ponen `up`/`down` a `false`. |
| Doble loop / listeners por StrictMode. | `destroy` idempotente con bandera `destroyed`; criterio de aceptación. |
| El id con guiones requiere comillas en `ENGINES`, carpeta y nombre de migración. | Clave `"pong-vs-cpu"` entre comillas; carpeta `lib/games/pong-vs-cpu/`; migración `add_game_pong_vs_cpu`. |
| Next 16 difiere del conocimiento previo. | Paso 1 consulta `node_modules/next/dist/docs/`. |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Modo 2 jugadores (local u online), efecto/curva, power-ups, multiplicadores.
- Overlays de pausa/game over o de presentación de rival dentro del canvas.
- Selector de dificultad o de rival inicial.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
