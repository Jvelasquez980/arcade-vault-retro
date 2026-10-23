# SPEC GJ-robotron-2084-01 — Juego real: ROBOTRON: 2084 (variante: clásico por oleadas) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-23
> **Variant:** 01 de 2 — Clásico fiel: twin-stick con teclado (mover con WASD, disparar en 8 direcciones con las flechas), oleadas cerradas con grunts, hulks, electrodos, esferoides/enforcers y cerebros, rescate de la familia con bonus creciente y 3 vidas.
> **Objective:** Crear un motor TypeScript de Robotron: 2084 (variante clásica por oleadas) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/robotron-2084` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Robotron: 2084. Reproduce la estructura del arcade de 1982: **oleadas** numeradas que se completan al destruir a todos los robots destructibles, **familia humana** que vaga por la arena y se rescata tocándola (bonus 1000, 2000 … 5000), **hulks** indestructibles que solo se empujan a tiros, **electrodos** estáticos mortales, **esferoides** que fabrican **enforcers** que disparan chispas, y **cerebros** que convierten humanos en **progs**. El control es el twin-stick del original trasladado al teclado: `WASD` mueve y las flechas disparan (combinando dos flechas, en diagonal). Se distingue de la variante 02 (supervivencia contrarreloj, aparición continua, auto-apuntado, multiplicador, bombas y power-ups, sin vidas).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y todo se dibuja con formas, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-robotron-2084`.

Decisiones fijadas por el agente (no se reabren): `id` `robotron-2084`, título `ROBOTRON: 2084`, `cat` `SHOOTER`, color `magenta`, `sort_order` **7** (siguiente libre; frogger = 5 implementado, `missile-command` reserva 6 en su game jam), dificultad 4, tags `CLÁSICO` y `TWIN-STICK`, 1 jugador, teclado. Canvas **640×480** (4:3). **3 vidas** (`initialLives: 3`), **nivel = oleada** (`showLevel: true`), stat extra `RESCATES`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/robotron-2084/engine.ts`: sin globals de módulo; exporta `robotron2084Def: GameEngineDef` con `createRobotron2084(canvas, events) → GameController`.
- Módulo `lib/games/robotron-2084/waves.ts`: funciones puras `waveConfig(n)` (cantidades por tipo), `gruntSpeed(n)`, `rescueBonus(k)` y constantes de arena (`ARENA`, `CENTER`, `SAFE_RADIUS`).
- Módulo `lib/games/robotron-2084/draw.ts`: `drawArena`, `drawPlayer`, `drawGrunt`, `drawHulk`, `drawElectrode`, `drawHuman`, `drawBrain`, `drawProg`, `drawSpheroid`, `drawEnforcer`, `drawSpark`, `drawBullet`, `drawFloatText` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `"robotron-2084"` en `lib/games/registry.ts`.
- Clase `.cover-robotron-2084` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%, #1a0026, #0a0a18)`, `::before` con marco rectangular de arena `#ff2bd6` (borde 3 px, `inset: 14%`) y `::after` con un jugador central (rombo blanco) rodeado de 6 cuadrados rojos `#ff3355` dispuestos en anillo (`box-shadow` múltiple).
- Migración `add_game_robotron_2084`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **640×480**.
- HUD de React: puntaje, **3 vidas**, **nivel** (oleada) y stat extra `rescued` ("RESCATES", `int`, color `cyan`).
- Sin HUD nativo de texto en el canvas, salvo los números flotantes de bonus de rescate (efecto de juego, no overlay).
- Controles: `W`/`A`/`S`/`D` mueven en 8 direcciones; `←↑→↓` disparan en 8 direcciones mientras se mantienen. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'robotron-2084'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `robotron-2084`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, gamepad físico, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Tanques, quarks y misiles crucero de los cerebros del original; oleadas especiales (solo grunts, solo cerebros).
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('robotron-2084', 'ROBOTRON: 2084', 'Salva a la última familia humana.',
       'Muévete con WASD y dispara en ocho direcciones con las flechas. Cada oleada llena la arena de robots: destruye a todos para avanzar, esquiva a los hulks indestructibles y los electrodos, y rescata a la familia antes de que la aplasten o la conviertan los cerebros. Cada rescate de la oleada vale más que el anterior; tienes tres vidas y una extra cada 25 000 puntos.',
       'SHOOTER', 'magenta', 'cover-robotron-2084', 1, 1, '{keyboard}', '{CLÁSICO,TWIN-STICK}', 4, 7, false);

Definición del motor:

    export const robotron2084Def: GameEngineDef = {
      width: 640, height: 480,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "rescued", label: "RESCATES", color: "cyan", format: "int" }],
      create: createRobotron2084,
    };

Estado interno (dentro de `createRobotron2084`): `player { x, y }`, `moveKeys { up, down, left, right }`, `fireKeys { up, down, left, right }`, `fireCooldownMs`, `bullets: { x, y, vx, vy }[]`, `grunts`, `hulks`, `electrodes`, `humans`, `brains`, `progs`, `spheroids`, `enforcers`, `sparks` (arrays de `{ x, y, vx, vy, … }` con campos propios por tipo: temporizadores de giro, de fabricación o de disparo), `floatTexts: { text, x, y, ms }[]`, `skulls: { x, y, ms }[]`, `wave`, `phase: "warp" | "play" | "dying"`, `phaseMs`, `lives`, `score`, `nextExtraLifeAt`, `rescuedThisWave`, `rescuedTotal`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`, `rand` (`Math.random` por instancia).

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("rescued", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("rescued", 0)` (valor 0 oculta el stat según el contrato; esperado al inicio).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `WASD` solo con el juego activo y sin pausa. Movimiento y disparo son continuos mientras se mantienen las teclas (`e.repeat` no cambia nada: se usan banderas por tecla). Las teclas se comparan por `e.code` (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `ArrowUp`…) para que funcione con cualquier distribución.
- Pausa/blur/destroy ponen todas las banderas de `moveKeys` y `fireKeys` a `false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** rectángulo jugable de (8, 8) a (632, 472), borde `#ff2bd6` de 2 px. Todo se mantiene dentro (posición recortada al rectángulo menos el radio). `CENTER = (320, 240)`, `SAFE_RADIUS = 120`.
- **Colisiones:** círculo contra círculo con los radios indicados por tipo.
- **Jugador:** radio **7**, velocidad **160 px/s** en 8 direcciones (diagonal normalizada). Empieza en `CENTER`.
- **Disparo:** mientras haya al menos una flecha pulsada, cada **90 ms** sale una bala en la dirección resultante (suma de flechas; `↑`+`→` = diagonal; flechas opuestas se anulan en su eje y si el vector queda (0,0) no se dispara). Bala: radio 2, segmento de 10 px, **640 px/s**, máx. **8** en pantalla (si hay 8, se espera). Desaparece al salir de la arena o al impactar (una bala, un impacto).
- **Grunt:** radio **8**, 1 disparo, **100** pts. Persigue al jugador en línea recta a `gruntSpeed(n) = min(45 + 5 × (n − 1), 120)` px/s. Si toca un electrodo, el grunt muere sin puntos.
- **Electrodo:** radio **9**, estático, 1 disparo, **25** pts. Tocarlo mata al jugador. Forma cosmética según oleada: `(n − 1) % 3` → estrella / cuadrado / rombo.
- **Hulk:** radio **12**, indestructible, **0** pts. Camina a **40 px/s**; cambia de dirección (una de 8 al azar) cada `1200–2000` ms al azar; si hay un humano a ≤ **180 px**, va hacia el más cercano. Cada bala que lo toca lo empuja **10 px** en la dirección de la bala (sin salir de la arena). Mata humanos y jugador al contacto. No cuenta para terminar la oleada.
- **Familia (humano):** radio **7**; tres apariencias cosméticas rotativas (mamá rosa `#ff7ad9`, papá azul `#4da6ff`, niño amarillo `#ffe600`). Camina a **30 px/s**, cambia de dirección cada **1500 ms** y rebota en los bordes. Los enemigos no lo atacan salvo hulks y cerebros. Las balas lo atraviesan.
- **Rescate:** el jugador toca a un humano → `rescuedThisWave += 1`, suma `rescueBonus(k) = 1000 × min(k, 5)` con `k = rescuedThisWave`, `rescuedTotal += 1` → `onStat("rescued", rescuedTotal)`; texto flotante con el bonus (sube 24 px y se desvanece en 800 ms).
- **Humano perdido:** si lo toca un hulk, muere (calavera blanca 600 ms, sin penalización).
- **Cerebro** (oleada ≥ 5): radio **9**, 1 disparo, **500** pts. Va a **50 px/s** hacia el humano más cercano (si no quedan, hacia el jugador). Al tocar un humano lo convierte en **prog** en esa posición. Mata al jugador al contacto.
- **Prog:** radio **7**, 1 disparo, **100** pts. Persigue al jugador a **150 px/s**.
- **Esferoide** (oleada ≥ 3): radio **10**, 1 disparo, **1000** pts. Flota a **90 px/s** rebotando en los bordes. Fabrica un enforcer en su posición cada **2500 ms** (el primero a los 1500 ms de iniciar la fase `play`); tras fabricar el **4.º** desaparece sin dar puntos. No daña al jugador al contacto.
- **Enforcer:** radio **7**, 1 disparo, **150** pts. Cada **800 ms** recalcula un objetivo = posición del jugador + desplazamiento aleatorio de ±60 px en cada eje y se mueve hacia él a **120 px/s**. Dispara una **chispa** cada `1500–2500` ms al azar (la primera a los 1000 ms de nacer) apuntada al jugador. Mata al jugador al contacto.
- **Chispa:** radio **4**, **200 px/s**, rebota en los bordes, dura **3000 ms**. Se destruye con un disparo (**25** pts). Mata al jugador al contacto.
- **Composición de oleada** `waveConfig(n)`:
  - grunts `min(15 + 5 × (n − 1), 60)`
  - electrodos `min(5 + 2 × (n − 1), 20)`
  - hulks `n ≥ 2 ? min(n − 1, 8) : 0`
  - humanos `3 + min(n − 1, 5)`
  - esferoides `n ≥ 3 ? min(1 + floor((n − 3) / 2), 4) : 0`
  - cerebros `n ≥ 5 ? min(2 + (n − 5), 8) : 0`
- **Colocación:** robots y electrodos en puntos al azar de la arena a ≥ `SAFE_RADIUS` de `CENTER` y a ≥ 20 px entre electrodos; humanos al azar a ≥ 60 px de `CENTER`.
- **Fase `warp`** (inicio de oleada y tras cada muerte): **800 ms** en los que nada se mueve ni colisiona y los robots se dibujan creciendo de escala 0 a 1; el jugador sí puede moverse pero no disparar. Luego fase `play`.
- **Fin de oleada:** cuando no quedan grunts, cerebros, progs, esferoides, enforcers ni chispas. Hulks, electrodos y humanos restantes se retiran sin puntos. `wave += 1` → `onLevel(wave)`, `rescuedThisWave = 0`, jugador al `CENTER`, se genera la oleada nueva y empieza `warp`. No hay bonus por terminar la oleada.
- **Muerte:** el jugador toca grunt, hulk, electrodo, cerebro, prog, enforcer o chispa → `lives −= 1` → `onLives(lives)`; fase `dying` de **1000 ms** (anillos de explosión del jugador, nada se mueve). Si `lives > 0`: se eliminan balas y chispas, el jugador vuelve al `CENTER`, los robots que quedan (incluidos hulks y enforcers) se reubican al azar a ≥ `SAFE_RADIUS` del centro, `rescuedThisWave = 0` (el bonus vuelve a 1000), y empieza `warp` con la misma oleada. Si `lives = 0`: `onLives(0)` → `onGameOver(score)` inmediatamente (sin esperar la fase `dying`).
- **Vida extra:** cada **25 000** puntos (`nextExtraLifeAt` 25 000, 50 000, …) → `lives += 1` (tope **9**; si está en 9, el umbral se consume sin efecto) → `onLives(lives)`.
- **Dibujo:** fondo `#05000a`; borde de arena `#ff2bd6`. Jugador: rombo blanco 14×16 con visor `#00f5ff`. Grunt: cuadrado `#ff3355` 14 px con "cintura" negra. Hulk: rectángulo verde `#39ff14` 22×24 con hombros. Electrodo: forma de la oleada en color que rota por oleada (`#ffe600`, `#00f5ff`, `#ff7a00`). Cerebro: círculo `#ff2bd6` con surcos. Prog: rombo con estela de 3 copias atenuadas en el color del humano original. Esferoide: anillo `#ff7a00` pulsante (radio ±2 px a 4 Hz). Enforcer: triángulo `#00f5ff`. Chispa: cruz blanca 8 px. Bala: segmento `#ffffff`. Texto flotante: 14 px monoespaciada `#ffe600`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-robotron-2084` en `app/globals.css`. Aplicar migración `add_game_robotron_2084` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'robotron-2084'` muestra la fila con `sort_order = 7`; `npm run build`.
2. Crear `lib/games/robotron-2084/waves.ts`. Verificar: `npm run lint`; `waveConfig(1)` = 15 grunts, 5 electrodos, 0 hulks, 3 humanos, 0 esferoides, 0 cerebros; `waveConfig(5)` = 35, 13, 4, 7, 2, 2; `waveConfig(12)` = 60, 20, 8, 8, 4, 8; `gruntSpeed(1) = 45`, `gruntSpeed(16) = 120`; `rescueBonus(1) = 1000`, `rescueBonus(7) = 5000`.
3. Crear `lib/games/robotron-2084/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/robotron-2084/engine.ts` y exportar `robotron2084Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"robotron-2084"` en `lib/games/registry.ts`. Verificar: `/games/robotron-2084/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): moverse en 8 direcciones, disparar en 8 direcciones (diagonales con dos flechas), cadencia y tope de 8 balas, matar grunts y electrodos, empujar un hulk, rescatar 3 humanos (1000/2000/3000), humano aplastado por hulk, completar oleada 1 y ver oleada 2, llegar a oleada 3 (esferoide → enforcers → chispas) y 5 (cerebro → prog), morir y ver reubicación + `warp`, vida extra a 25 000, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'robotron-2084'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `robotron-2084` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-robotron-2084`), la ficha `/games/robotron-2084` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`TWIN-STICK`, dificultad 4, color magenta, categoría SHOOTER).
- [ ] `/games/robotron-2084/jugar` muestra el canvas 4:3 sin desborde a 375 px y 1280 px.
- [ ] `WASD` mueve a 160 px/s en 8 direcciones (diagonal sin ir más rápido); las flechas disparan en 8 direcciones cada 90 ms con máx. 8 balas; las flechas no hacen scroll.
- [ ] Se puede mover en una dirección y disparar en otra a la vez; flechas opuestas no disparan.
- [ ] Oleada 1: 15 grunts a 45 px/s, 5 electrodos, 3 humanos; ningún robot aparece a menos de 120 px del centro.
- [ ] Grunt 100, electrodo 25, cerebro 500, prog 100, esferoide 1000, enforcer 150, chispa 25 puntos; un grunt que toca un electrodo muere sin puntos.
- [ ] Los hulks no mueren: cada bala los empuja 10 px; aplastan humanos (calavera) y no cuentan para terminar la oleada.
- [ ] Rescatar humanos en una oleada da 1000, 2000, 3000, 4000, 5000, 5000…; el contador vuelve a 1000 en la oleada siguiente y tras morir; RESCATES en el HUD suma el total de la partida.
- [ ] Desde la oleada 3 hay esferoides que fabrican hasta 4 enforcers (cada 2500 ms) y desaparecen; los enforcers disparan chispas que rebotan 3000 ms.
- [ ] Desde la oleada 5 hay cerebros que convierten humanos en progs (150 px/s).
- [ ] Al destruir el último robot destructible, el nivel del HUD sube y empieza la oleada siguiente tras 800 ms de `warp`, con la composición de `waveConfig(n)`.
- [ ] Morir resta una vida, congela 1000 ms, reubica los robots restantes lejos del centro y repite la misma oleada; durante `warp` nada daña al jugador.
- [ ] A los 25 000 puntos se gana una vida (HUD sube), tope 9.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y RESCATES; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela todo; reanudar sin salto de tiempo, sin movimiento ni disparo residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `W`, `A`, `S`, `D`) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'robotron-2084'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/robotron-2084` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, oleada 1, RESCATES 0, jugador al centro, sin balas ni chispas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/robotron-2084/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con las reglas de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** twin-stick en teclado (`WASD` mueve, flechas disparan en 8 direcciones); es el control fiel al original y la diferencia central con la variante 02. **No:** auto-apuntado.
- **Sí:** teclas por `e.code` para que `WASD` funcione con AZERTY u otras distribuciones.
- **Sí:** oleadas cerradas como nivel (`showLevel: true`); **No:** aparición continua ni temporizador.
- **Sí:** 3 vidas y vida extra cada 25 000 (tope 9), como el arcade; **No:** escudos ni invulnerabilidad salvo la fase `warp`.
- **Sí:** bonus de rescate 1000 × k con tope 5000 y reinicio por oleada y por muerte; es la fuente principal de puntos y de decisión táctica.
- **Sí:** subconjunto de enemigos (grunt, hulk, electrodo, esferoide/enforcer/chispa, cerebro/prog); **No:** tanques, quarks ni misiles crucero (alcance de un motor).
- **Sí:** stat `RESCATES` total; **No:** stat de robots restantes (se ve en pantalla).
- **Sí:** valores de balance (velocidades, cantidades, radios, puntos, tiempos) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER y color magenta; **Sí:** `.cover-robotron-2084` nueva.
- **Sí:** canvas 640×480 (4:3), proporción cercana al monitor original.
- **Sí:** `id` con guion y título `ROBOTRON: 2084` (con dos puntos, como el original).
- **No:** sonido, táctil, mouse, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                   | Mitigation                                                                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Colisiones O(n²) con 60 grunts + 8 balas + chispas en oleadas altas.                   | Solo se comprueban pares necesarios (balas × enemigos, jugador × enemigos, grunts × electrodos, hulks/cerebros × humanos); n ≤ ~110. |
| Ghosting del teclado: algunas combinaciones de 4+ teclas no se registran.              | Diagonales de disparo con dos flechas y movimiento con `WASD` (zonas separadas); documentado, sin solución por software.         |
| Muerte injusta al reaparecer junto a un robot.                                          | Reubicación a ≥ 120 px del centro y fase `warp` de 800 ms sin colisiones.                                                       |
| Oleada imposible de terminar por un esferoide o chispa inalcanzable.                   | Esferoides desaparecen tras 4 enforcers y las chispas expiran a 3000 ms; los hulks y electrodos no bloquean el fin de oleada.    |
| `dt` grande tras pausar o cambiar de pestaña teletransporta robots.                     | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                            |
| Flechas o `WASD` interfieren con el input del modal.                                   | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                            |
| Movimiento o disparo "pegado" tras perder foco.                                         | `blur` y `pause` ponen todas las banderas a `false`.                                                                            |
| Doble loop / listeners por StrictMode.                                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                          |
| El id con guion y dígitos requiere comillas en `ENGINES` y un nombre de export válido. | Clave `"robotron-2084"` entre comillas; export `robotron2084Def`; carpeta `lib/games/robotron-2084/`; migración con `_`.          |
| Twin-stick no encaja en el gamepad táctil (dpad + 2 botones).                           | Fuera de alcance; `mobile-porter` decidirá en su spec (p. ej. disparo hacia la última dirección).                               |
| Next 16 difiere del conocimiento previo.                                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                                 |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse, gamepad físico y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Tanques, quarks, misiles crucero y oleadas especiales del original.
- HUD nativo de texto dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
