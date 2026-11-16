# SPEC GJ-robotron-2084-02 — Juego real: ROBOTRON 2084 (variante: supervivencia contrarreloj) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-16
> **Variant:** 02 de 2 — Arena de supervivencia continua: los robots entran sin pausa por 4 puertas, un solo stick con bloqueo de dirección al disparar, cañón que se sobrecalienta, reloj que solo se recarga rescatando humanos, multiplicador por racha y 1 vida.
> **Objective:** Crear un motor TypeScript de Robotron 2084 (modo supervivencia) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/robotron-2084` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Robotron 2084. Toma la fantasía de Robotron (arena cerrada, hordas que convergen sobre ti, humanos que salvar) y la convierte en una **partida corta de supervivencia**: no hay oleadas que limpiar, los robots **entran continuamente por 4 puertas** con intensidad que sube cada 20 s, el **reloj** baja sin parar y solo se recarga **rescatando humanos**, y el puntaje lo multiplica una **racha** que se pierde al **sobrecalentar** el cañón. Se distingue de la variante 01 (doble stick, oleadas discretas, 3 vidas, bonus de rescate escalonado): aquí se juega con **un solo stick** (flechas o `WASD`) y `Espacio` dispara en la última dirección de movimiento **bloqueándola** mientras se mantiene (strafe), y el reto es **gestionar calor y tiempo**, con **1 vida**.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events, skin?) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts`) y se dibuja todo con primitivas. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-robotron-2084`.

Decisiones fijadas por el agente (no se reabren): `id` `robotron-2084`, título `ROBOTRON 2084`, `cat` `SHOOTER`, color `green`, `sort_order` **7** (siguiente libre: frogger = 5 implementado y `missile-command` reserva el 6 en sus specs propuestas), dificultad 3, tags `SUPERVIVENCIA` y `CONTRARRELOJ`, 1 jugador, teclado. Canvas **600×600** (1:1). **1 vida** (`initialLives: 1`), **nivel = intensidad** que sube cada 20 s (`showLevel: true`), stats extra `TIEMPO` y `MULTI`. Tres tipos de robot (Grunt, Hulk, Tirador). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/robotron-2084/engine.ts`: sin globals de módulo; exporta `robotron2084Def: GameEngineDef` con `createRobotron2084(canvas, events, skin?) → GameController` (acepta y por ahora ignora `skin`).
- Módulo `lib/games/robotron-2084/intensity.ts`: funciones puras `levelAt(elapsedMs)`, `spawnIntervalMs(level)`, `gruntSpeed(level)`, `pickSpawnType(level, rand)` y constantes (`ARENA`, `GATES`, `MAX_ENEMIES`).
- Módulo `lib/games/robotron-2084/draw.ts`: `drawArena` (con puertas), `drawPlayer`, `drawHeatRing`, `drawHuman`, `drawGrunt`, `drawHulk`, `drawShooter`, `drawSpark`, `drawShot`, `drawPopup` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` (facilita el spec de skins posterior).
- Entrada `"robotron-2084"` en `lib/games/registry.ts`.
- Clase `.cover-robotron-2084` en `app/globals.css`: fondo `radial-gradient(circle at 50% 50%, #002a14, #0a0a18)`, `::before` con marco cuadrado `#39ff14` de 2 px inset 12% y cuatro huecos (puertas) en los puntos medios, `::after` con un círculo blanco central y un anillo `#ffe600` parcial (`conic-gradient`) que evoca el calor.
- Migración `add_game_robotron_2084`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **600×600**.
- HUD de React: puntaje, **1 vida**, **nivel** (intensidad) y stats extra `time` ("TIEMPO", `seconds`, color `yellow`) y `mult` ("MULTI", `int`, color `magenta`).
- El calor del cañón se ve solo como anillo alrededor del jugador (parte del mundo, sin texto). Popups de puntos de rescate en el mundo (800 ms). Ningún otro texto en el canvas.
- Controles: `←↑→↓` o `W`/`A`/`S`/`D` mueven (8 direcciones combinando); `Espacio` mantenido dispara en la dirección de apuntado bloqueada. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'robotron-2084'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `robotron-2084`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), mouse, HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Oleadas discretas, vidas múltiples, Electrodes, Spheroids/Enforcers, Brains y power-ups.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('robotron-2084', 'ROBOTRON 2084', 'Resiste la horda robot contra el reloj.',
       'Los robots entran sin parar por las cuatro puertas de la arena. Muévete con las flechas o WASD y mantén Espacio para disparar en la dirección en la que ibas, sin dejar de esquivar. El cañón se calienta: si llega al máximo se bloquea y pierdes el multiplicador. El reloj empieza en 60 segundos y solo se recarga rescatando humanos; un solo toque o quedarte sin tiempo termina la partida.',
       'SHOOTER', 'green', 'cover-robotron-2084', 1, 1, '{keyboard}', '{SUPERVIVENCIA,CONTRARRELOJ}', 3, 7, false);

Definición del motor:

    export const robotron2084Def: GameEngineDef = {
      width: 600, height: 600,
      initialLives: 1,
      showLevel: true,
      stats: [
        { key: "time", label: "TIEMPO", color: "yellow", format: "seconds" },
        { key: "mult", label: "MULTI", color: "magenta", format: "int" },
      ],
      create: createRobotron2084,
    };

Estado interno (dentro de `createRobotron2084`): `player { x, y }`, `keysDown: Set<string>`, `aim { x, y }` (vector unitario de 8 direcciones), `aimLocked`, `fireCooldown`, `heat` (0–100), `overheatMs`, `shots: { x, y, vx, vy }[]`, `grunts: { x, y, spawnMs }[]`, `hulks: { x, y, spawnMs }[]`, `shooters: { x, y, hp, fireMs, spawnMs }[]`, `sparks: { x, y, vx, vy }[]`, `human: { x, y, vx, vy, turnMs } | null`, `humanRespawnMs`, `popups: { x, y, text, ageMs }[]`, `elapsedMs`, `level`, `spawnAcc`, `timeLeftMs`, `lastTimeTenth`, `streak`, `mult`, `score`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (intensidad), `onStat("time", s)` solo cuando cambia la décima mostrada (máx. 10/s), `onStat("mult", n)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(1)`, `onLevel(1)`, `onStat("time", 60)`, `onStat("mult", 1)`.
- Game over (golpe o reloj a 0): `onStat("time", …)` final, `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas, `WASD` y `Espacio` solo con el juego activo y sin pausa. Teclas leídas por `e.code` (`ArrowUp`, `KeyW`, `Space`…; compatible con eventos sintéticos de SPEC 11, sin filtrar `e.isTrusted`). Movimiento y disparo por `keysDown` (se ignora `e.repeat`).
- Pausa/blur/destroy vacían `keysDown` (lo que libera `aimLocked`); al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. El reloj no corre en pausa.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, subida de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Arena:** borde de 2 px en `x, y ∈ [10, 590]`. Zona jugable (centros) `x, y ∈ [18, 582]`. **4 puertas** de 60 px centradas en el punto medio de cada lado (arriba (300, 10), abajo (300, 590), izquierda (10, 300), derecha (590, 300)), dibujadas como hueco en el borde. Colisiones círculo-círculo.
- **Jugador:** radio **7**, empieza en (300, 300). Velocidad **170 px/s** en 8 direcciones (diagonal normalizada; flechas y `WASD` equivalentes y combinables). Limitado a la zona jugable.
- **Apuntado:** `aim` inicial (0, −1). Mientras `Espacio` no está pulsado, `aim` se actualiza al vector de movimiento cada vez que no es nulo. Mientras `Espacio` está mantenido, `aim` queda bloqueado (strafe: moverse no cambia la dirección de disparo).
- **Disparo:** con `Espacio` mantenido y sin sobrecalentamiento, un disparo cada **90 ms** en `aim`. Máximo **10** en vuelo (si hay 10, no dispara y el cooldown no se consume). Disparo: segmento de 10 px, **640 px/s**, radio de impacto **3**, desaparece al salir de la zona o al impactar.
- **Calor:** cada disparo suma **+6**; se enfría **35/s** siempre (mínimo 0). Si llega a **100** → sobrecalentamiento: no se puede disparar durante **1500 ms**, `heat` baja linealmente de 100 a 0 en ese tiempo, `streak = 0` y `mult = 1` (`onStat("mult", 1)` si cambia). Disparo continuo sobrecalienta en ~3.2 s.
- **Intensidad (nivel):** `level = 1 + Math.floor(elapsedMs / 20000)`; al cambiar, `onLevel(level)`. `elapsedMs` solo avanza sin pausa.
- **Aparición:** cada `spawnIntervalMs(level) = max(300, 1300 − 100 × (level − 1))` ms aparece un robot en una puerta aleatoria, excluida la más cercana al jugador. Si hay **40** robots vivos (`MAX_ENEMIES`), se omite esa aparición. Tipo según `pickSpawnType`:
  - Nivel 1: 100 % Grunt. Nivel 2: 85 % Grunt / 15 % Hulk. Nivel 3: 70 % Grunt / 15 % Hulk / 15 % Tirador. Nivel 4+: 60 % Grunt / 20 % Hulk / 20 % Tirador.
  - Máximo **4** Hulks vivos; si toca Hulk y ya hay 4, sale Grunt.
  - Al aparecer, el robot pasa **400 ms** inmóvil e inofensivo (parpadea cada 100 ms) en la puerta.
- **Grunt:** radio **7**, **50** pts. Se mueve en línea recta hacia el jugador a `gruntSpeed(level) = min(70 + 6 × (level − 1), 130)` px/s. Letal al tocar.
- **Hulk:** radio **11**, **indestructible**. Se mueve a **35 px/s** hacia el humano si existe y si no hacia el jugador. Cada disparo que lo toca lo empuja **8 px** en la dirección del disparo. Si toca al humano lo mata: `streak = 0`, `mult = 1`, popup `✕` 800 ms, nuevo humano a los 2000 ms. Letal al tocar al jugador.
- **Tirador:** radio **8**, **3** impactos para destruirlo, **200** pts. Velocidad **50 px/s**: se acerca si está a más de 200 px del jugador y se aleja si está a menos de 160 px (sin salir de la zona). Cada **1800 ms** (primera a los 1000 ms de activarse) dispara una chispa hacia la posición actual del jugador. Destella blanco 80 ms al recibir un impacto. Letal al tocar.
- **Chispa:** radio **3**, **200 px/s** en línea recta, desaparece en el borde; disparable (**10** pts). Letal al tocar.
- **Puntuación de robots:** `puntos base × mult`. Cada robot o chispa destruidos suma `streak + 1`; `mult = min(1 + Math.floor(streak / 10), 8)` (`onStat("mult")` al cambiar).
- **Humano:** solo hay uno a la vez; el primero aparece a los 1000 ms y los siguientes **2000 ms** después del rescate o la muerte del anterior, en posición aleatoria a **≥ 150 px** del jugador y **≥ 60 px** de cada puerta. Radio **6**, camina a **30 px/s**, cambia de dirección cada **1200 ms**, rebota en el borde. Al tocarlo el jugador: `timeLeftMs + 6000` (máximo **99900**), **500 × mult** puntos, popup con los puntos 800 ms. Grunts, tiradores y chispas no lo dañan.
- **Reloj:** `timeLeftMs` empieza en **60000** y baja con el tiempo de juego. Al llegar a 0 → game over.
- **Muerte:** colisión del jugador con un robot activo o una chispa → game over (1 vida, sin gracia ni reaparición).
- **Dibujo:** fondo `#000` con rejilla tenue `#0a1a0a` cada 50 px; borde `#39ff14` con puertas como huecos; la puerta elegida para la próxima aparición brilla `#ffe600` los 300 ms previos. Jugador: círculo blanco `#ffffff` de radio 7 con un triángulo `#00f5ff` que indica `aim`. Anillo de calor: arco de radio 12 alrededor del jugador, longitud proporcional a `heat`, color de `#00f5ff` (0) a `#ffe600` (60) a `#ff3355` (100); en sobrecalentamiento parpadea `#ff3355` cada 150 ms. Grunt: cuadrado 12 px `#ff3355`. Hulk: rectángulo 20×22 `#39ff14` con visor `#000`. Tirador: hexágono 16 px `#ff2bd6`. Chispa: aspa blanca 6 px. Humano: figura 8×14 `#00f5ff` con cabeza `#ffffff`. Disparo: línea `#ffe600` de 2 px. Popups: `bold 12px monospace` `#ffffff`, suben 20 px y se desvanecen en 800 ms.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-robotron-2084` en `app/globals.css`. Aplicar migración `add_game_robotron_2084` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'robotron-2084'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/robotron-2084/intensity.ts`. Verificar: `npm run lint`; `levelAt(0) = 1`, `levelAt(19999) = 1`, `levelAt(20000) = 2`; `spawnIntervalMs(1) = 1300`, `spawnIntervalMs(11) = 300`; `gruntSpeed(1) = 70`, `gruntSpeed(11) = 130`.
3. Crear `lib/games/robotron-2084/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/robotron-2084/engine.ts` y exportar `robotron2084Def`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `"robotron-2084"` en `lib/games/registry.ts`. Verificar: `/games/robotron-2084/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): mover con flechas y `WASD`, disparar con `Espacio` y comprobar el bloqueo de dirección al moverse, sobrecalentar (MULTI vuelve a 1), subir el multiplicador a 2 con 10 bajas, rescatar un humano (+6.0 s), ver un Hulk aplastar al humano, llegar a nivel 3 (tiradores), morir por contacto y por reloj a 0, pausa (botón y `P`) con el reloj detenido, FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'robotron-2084'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; registrar la migración en la tabla de `references/production/prod-setup.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `robotron-2084` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-robotron-2084`), la ficha `/games/robotron-2084` y el home muestran el juego desde la BD (1 jugador, teclado, tags `SUPERVIVENCIA`/`CONTRARRELOJ`, dificultad 3, color verde, categoría SHOOTER).
- [ ] `/games/robotron-2084/jugar` muestra el canvas 1:1 sin desborde a 375 px y 1280 px.
- [ ] Flechas y `WASD` mueven al jugador a 170 px/s (diagonal normalizada) sin salir de la zona; flechas, `WASD` y `Espacio` no hacen scroll.
- [ ] Con `Espacio` mantenido se dispara cada 90 ms a 640 px/s (máx. 10 en vuelo) en la última dirección de movimiento, que no cambia aunque el jugador se mueva en otra dirección hasta soltar `Espacio`.
- [ ] Cada disparo suma 6 de calor y se enfría 35/s; al llegar a 100 el cañón se bloquea 1500 ms, el anillo parpadea en rojo y MULTI vuelve a 1.
- [ ] Los robots solo aparecen por las puertas (nunca por la más cercana al jugador), cada 1300 ms en nivel 1, con 400 ms inofensivos; nunca hay más de 40 vivos ni más de 4 Hulks.
- [ ] El nivel del HUD sube cada 20 s de juego; en nivel 1 solo hay Grunts, desde el 2 Hulks y desde el 3 Tiradores.
- [ ] Puntos base exactos: Grunt 50, Tirador 200 (tras 3 impactos), chispa 10, todos × MULTI; los Hulks no mueren y retroceden 8 px por disparo.
- [ ] MULTI sube 1 cada 10 bajas seguidas (máx. 8) y vuelve a 1 al sobrecalentar o al morir el humano por un Hulk.
- [ ] Rescatar al humano suma 6.0 s a TIEMPO (máx. 99.9) y 500 × MULTI puntos; el siguiente aparece a los 2000 ms a ≥ 150 px del jugador.
- [ ] TIEMPO empieza en 60.0, baja en décimas y no corre en pausa; al llegar a 0 termina la partida.
- [ ] Tocar un robot activo o una chispa emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vida (1 → 0), nivel, TIEMPO y MULTI; TIEMPO se emite como máximo 10 veces por segundo y el resto solo al cambiar.
- [ ] Pausa (botón y `P`) congela robots, disparos, chispas, humano, calor, apariciones y reloj; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `WASD`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'robotron-2084'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/robotron-2084` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, nivel 1, TIEMPO 60.0, MULTI 1, calor 0, jugador en (300, 300) apuntando arriba, sin robots, disparos ni humano).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/robotron-2084/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego; la migración está registrada en `references/production/prod-setup.md`.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de supervivencia; **No:** portar código externo (no existe en `references/`).
- **Sí:** un solo stick + `Espacio` con bloqueo de dirección (strafe); más accesible en teclado y en el futuro gamepad virtual de 1 botón; **No:** doble stick (es la variante 01).
- **Sí:** aparición continua por 4 puertas excluyendo la más cercana al jugador, para que siempre haya reacción posible; **No:** oleadas discretas.
- **Sí:** 1 vida y game over inmediato; la partida corta la limita el reloj; **No:** vidas extra ni gracia.
- **Sí:** reloj recargable solo por rescates, para que salvar humanos sea obligatorio y no opcional.
- **Sí:** sobrecalentamiento que reinicia el multiplicador, para castigar el disparo continuo sin pensar.
- **Sí:** stats `TIEMPO` y `MULTI` en el HUD de React; el calor se ve como anillo en el mundo; **No:** emitir calor como stat (cambia cada frame).
- **Sí:** tres tipos de robot (Grunt, Hulk, Tirador); **No:** Electrodes, Spheroids, Enforcers ni Brains (spec aparte).
- **Sí:** valores de balance (intervalos, velocidades, calor, multiplicador, bonus de tiempo) fijados en este spec, ajustables solo editándolo.
- **Sí:** canvas 600×600 (arena cuadrada con puertas simétricas); **Sí:** `cat` SHOOTER y color verde.
- **Sí:** todo con primitivas Canvas 2D y `PALETTE` central; **No:** sprites, imágenes ni sonido.
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** táctil, mouse, HiDPI, skins (specs/subagentes aparte); **No:** tests automatizados.

---

## Risks

| Risk                                                                    | Mitigation                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Emitir `onStat("time")` cada frame satura React.                        | Emitir solo cuando cambia la décima (`lastTimeTenth`), máx. 10/s.                                                       |
| 40 robots + 10 disparos + chispas con colisiones por frame.             | Tope `MAX_ENEMIES` 40; distancia al cuadrado sin `sqrt`; arrays compactados al eliminar.                                |
| Un robot aparece encima del jugador junto a una puerta.                 | Se excluye la puerta más cercana y hay 400 ms inofensivos con parpadeo; la puerta destella 300 ms antes.                |
| El reloj hace la partida demasiado corta o infinita.                    | 60 s iniciales, +6 s por rescate, humano cada ≥ 2 s y Hulks que lo cazan; verificar duración típica (1–4 min) en paso 6. |
| `dt` grande tras pausar o cambiar de pestaña consume reloj y teletransporta. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; el reloj usa el mismo `dt`.                     |
| `Espacio` "pegado" deja el apuntado bloqueado tras perder foco.         | `blur` y `pause` vacían `keysDown` y liberan `aimLocked`.                                                               |
| Flechas, `WASD` o espacio interfieren con el input del modal.           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| Doble loop / listeners por StrictMode.                                  | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| El id con guion y dígitos requiere comillas y nombres válidos.          | Clave `"robotron-2084"` en `ENGINES`, carpeta `lib/games/robotron-2084/`, export `robotron2084Def`, migración con `_`.   |
| Next 16 difiere del conocimiento previo.                                | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual, mouse y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Oleadas discretas, vidas múltiples, Electrodes, Spheroids, Enforcers, Brains y power-ups.
- HUD nativo de texto dentro del canvas (más allá de los popups de rescate) y overlays de pausa/nivel/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
