# SPEC GJ-galaga-02 — Juego real: GALAGA (variante: enjambre con power-ups) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-30
> **Variant:** 02 de 2 — Galaga moderno de supervivencia: enjambre continuo sin formación, nave con movimiento libre en la mitad inferior, disparo sostenido con sobrecalentamiento, 5 power-ups, multiplicador de combo y dificultad que sube cada 20 s.
> **Objective:** Crear un motor TypeScript de Galaga dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 02 de 2 de la game jam de Galaga. Toma la estética de Galaga (abejas, mariposas, Boss, estrellas) pero cambia la estructura: no hay fases ni formación, sino un **enjambre continuo** de escuadrones que bajan desde arriba y se vuelve más rápido y denso cada **20 s** (nivel). La nave se mueve **libremente en 2D** en la mitad inferior y dispara **mientras se mantiene `Espacio`**, con una barra de **calor** que obliga a soltar el gatillo. Los enemigos sueltan **power-ups** (doble, triple, frío, escudo, bomba) y los derribos encadenados suben un **multiplicador de combo** que se pierde al recibir daño o dejar escapar enemigos. Se distingue de la variante 01 (formación fija, picados, rayo tractor, nave doble y fase de desafío): aquí el reto es **sobrevivir y mantener el combo**, en partidas de ritmo constante.

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`) y se dibuja todo con formas, líneas y gradientes. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `ARCADE`, color `yellow`, `sort_order` **7** (siguiente libre; frogger = 5, `missile-command` = 6 reservado por su game jam), dificultad 3, tags `POWER-UPS` y `NAVES`, 1 jugador, teclado. Canvas **540×720** (3:4, vertical). **3 vidas** (`initialLives: 3`, casco), **nivel** sube cada 20 s (`showLevel: true`), stats extra `COMBO` y `TIEMPO`. Sin rayo tractor, sin nave doble, sin formación. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/spawner.ts`: funciones puras de balance (`levelConfig(level) → { spawnMs, enemySpeed, bulletSpeed, weights: { bee, butterfly, boss, kamikaze } }`), `pickType(weights, rnd)` y `comboMult(chain)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawPlayer` (con barra de calor y aro de escudo), `drawBee`, `drawButterfly`, `drawBoss` (con barra de vida), `drawKamikaze`, `drawPowerUp`, `drawBullet`, `drawExplosion`, `drawBombFlash` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `radial-gradient(circle at 50% 100%,#2a2000,#0a0a18)` con `::after` de círculos radiales dispersos (amarillo, magenta, verde) como enjambre y `::before` con una nave blanca abajo y dos haces verticales amarillos (`linear-gradient`), `drop-shadow` amarillo.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar. Registrarla en la tabla de `references/production/prod-setup.md`.
- Canvas lógico **540×720**.
- HUD de React: puntaje, **3 vidas**, **nivel** y stats extra `combo` ("COMBO", `int`, multiplicador actual) y `time` ("TIEMPO", `int`, segundos sobrevividos).
- Sin HUD nativo de texto en el canvas; la barra de calor (bajo la nave), el aro del escudo y la barra de vida del Boss forman parte de los sprites, no son texto.
- Controles: `←↑→↓` y `WASD` mueven la nave; mantener `Espacio` dispara. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Formación, rayo tractor, nave doble y fases de desafío (son la variante 01).
- Tienda o mejoras permanentes entre partidas, armas secundarias con tecla propia.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Sobrevive al enjambre y encadena combos.',
       'Mueve tu nave con las flechas o WASD y mantén Espacio para disparar, sin dejar que el cañón se sobrecaliente. Escuadrones de abejas, mariposas, kamikazes y Boss bajan sin descanso y cada 20 segundos llegan más rápido. Recoge power-ups de disparo doble, triple, frío, escudo y bomba, y encadena derribos para subir el combo hasta ×8; recibir daño o dejar escapar enemigos lo reinicia.',
       'ARCADE', 'yellow', 'cover-galaga', 1, 1, '{keyboard}', '{POWER-UPS,NAVES}', 3, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 540, height: 720,
      initialLives: 3,
      showLevel: true,
      stats: [
        { key: "combo", label: "COMBO", color: "magenta", format: "int" },
        { key: "time", label: "TIEMPO", color: "cyan", format: "int" },
      ],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ship { x, y }`, `keysDown: Set<string>`, `firing` (Espacio mantenido), `fireCd`, `heat` (0–100), `overheatMs`, `weapon: "single" | "double" | "triple"`, `weaponMs`, `coolMs` (power-up frío), `shield: boolean`, `invulnMs`, `playerBullets: { x, y, vx, vy }[]`, `enemyBullets: { x, y, vx, vy }[]`, `enemies: { type: "bee" | "butterfly" | "boss" | "kamikaze", hp, x, y, vx, vy, baseX, t, state, fired }[]`, `powerUps: { kind: "D" | "T" | "F" | "S" | "B", x, y }[]`, `explosions: { x, y, age, color }[]`, `stars: { x, y, speed, color }[]` (100), `level`, `levelMs`, `spawnTimer`, `elapsedMs`, `chain`, `chainMs`, `mult`, `lives`, `score`, `nextExtraAt`, `bombFlashMs`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("combo", mult)`, `onStat("time", segundos)` (una vez por segundo entero). Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("combo", 1)`, `onStat("time", 0)`.
- `onStat("time", 0)` oculta TIEMPO en el primer segundo (contrato de `onStat`); es el comportamiento esperado.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. Movimiento y disparo usan estado de teclas mantenidas (`keysDown`, `firing`); `e.repeat` no dispara de más (la cadencia la fija `fireCd`).
- Pausa/blur/destroy vacían `keysDown` y ponen `firing = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa, subida de nivel ni game over dentro del canvas.

**Reglas del juego:**

- **Escenario:** fondo `#000` con 100 estrellas de 1–2 px que bajan a `(40–120) × (1 + 0.08 × (level − 1))` px/s, colores aleatorios entre cyan, magenta, amarillo y blanco.
- **Nave:** 26×26 px, inicio en (270, 640). Se mueve a **300 px/s** en cada eje (diagonal normalizada a 300 px/s), limitada a `x ∈ [20, 520]`, `y ∈ [380, 700]`. Hitbox: círculo de 9 px.
- **Disparo:** mientras `Espacio` está mantenido, sin sobrecalentamiento, dispara cada **120 ms**. Bala 3×12 px a **700 px/s**, daño 1.
  - `single`: 1 bala vertical desde el morro.
  - `double`: 2 balas verticales separadas 14 px.
  - `triple`: 1 vertical + 2 a ±12° de la vertical.
- **Calor:** cada disparo suma **+5** (cualquier arma); se enfría **25/s** siempre. Al llegar a **100**: sobrecalentamiento, no se dispara durante **1500 ms** y luego `heat = 40`. Barra de 26×3 px bajo la nave: verde `#39ff14` < 60, amarilla `#ffe600` 60–85, roja `#ff3355` > 85; parpadea durante el sobrecalentamiento.
- **Nivel:** empieza en 1 y sube cada **20000 ms** de juego (`onLevel(level)`), sin máximo.
- **Balance por nivel** (`levelConfig(level)`, con `L = level`):
  - `spawnMs = max(900, 2600 − 140 × (L − 1))` (intervalo entre escuadrones; el primero sale a los 800 ms).
  - `enemySpeed = min(110 + 12 × (L − 1), 260)` px/s (velocidad base de descenso).
  - `bulletSpeed = min(220 + 8 × (L − 1), 320)` px/s.
  - Pesos de tipo de escuadrón: L1–2 abeja 70 / mariposa 30; L3 abeja 55 / mariposa 30 / Boss 15; L4+ abeja 40 / mariposa 30 / Boss 12 / kamikaze 18.
- **Escuadrones** (aparecen en `y = −20`, nunca más de **24** enemigos vivos; si se llega al tope, el escuadrón se pospone al siguiente intervalo):
  - **Abejas** (×5, en fila horizontal de separación 44 px, centrada en `x` aleatoria que quepa en `[30, 510]`): HP 1, **50** pts. Bajan a `enemySpeed` con zigzag `x = baseX + 40 × sin(2π t / 1500)`. No disparan.
  - **Mariposas** (×4, en V, separación 48 px): HP 1, **80** pts. Bajan a `enemySpeed` hasta una `y` aleatoria en `[120, 260]`, se detienen 400 ms, disparan **1** bala apuntada a la nave y se lanzan en línea recta hacia la posición que tenía la nave en ese momento a `enemySpeed × 1.6`.
  - **Boss** (×1): HP **4**, **300** pts. Baja hasta `y = 100` a 120 px/s, luego se desplaza en horizontal a **80 px/s** rebotando en `x ∈ [40, 500]` durante **8000 ms**, disparando un abanico de 3 balas (central apuntada a la nave y ±15°) cada **1600 ms**; después sube a 120 px/s y sale por arriba (no cuenta como escape). Siempre suelta un power-up al morir.
  - **Kamikazes** (×3, separación 60 px): HP 1, **120** pts. Bajan a 80 px/s durante **600 ms**, fijan la posición de la nave y aceleran en línea recta hacia ella a **360 px/s** (sin corregir rumbo).
  - Balas enemigas: círculo de 3 px a `bulletSpeed`. Mueren al salir del canvas.
- **Escape:** un enemigo (no Boss) que sale por `y > 760` o por los lados desaparece sin daño pero **reinicia el combo** (`chain = 0`).
- **Combo:** cada derribo suma 1 a `chain` y reinicia `chainMs = 1500`; si `chainMs` llega a 0, `chain = 0`. `mult = min(1 + floor(chain / 5), 8)` (×2 con 5 derribos encadenados, ×8 con 35). Recibir daño (aunque lo absorba el escudo) o un escape ponen `chain = 0`. `onStat("combo", mult)` solo cuando `mult` cambia.
- **Puntuación:**
  - Derribo: puntos base del tipo × `mult` (el `mult` vigente antes de sumar ese derribo a `chain`).
  - Supervivencia: **+5** por cada segundo entero sobrevivido (sin multiplicador), a la vez que `onStat("time")`.
  - Recoger un power-up: **+25** (sin multiplicador).
- **Power-ups:** al derribar un enemigo que no es Boss, probabilidad **0.08** de soltar uno (Boss: 1.0). Tipo aleatorio uniforme entre 5. Cápsula de 18×18 px que cae a **120 px/s**; se recoge al tocar la nave (círculo de 14 px) y desaparece al salir del canvas.
  - `D` doble: `weapon = "double"` durante **10000 ms**.
  - `T` triple: `weapon = "triple"` durante **8000 ms**.
  - `D` y `T` se reemplazan entre sí; el último recogido gana y reinicia su tiempo. Al expirar vuelve a `single`.
  - `F` frío: `heat = 0`, termina el sobrecalentamiento y el disparo no suma calor durante **6000 ms**.
  - `S` escudo: absorbe el siguiente impacto (máximo 1, no caduca); al absorber da 1000 ms de invulnerabilidad.
  - `B` bomba: destruye al instante todos los enemigos en pantalla (Boss incluido, pierde 2 HP; si le quedan ≤ 2 muere) y todas las balas enemigas; esos derribos dan puntos base × 1 y no suman a `chain`. Destello blanco de 300 ms.
- **Daño:** bala enemiga o choque con enemigo (círculo 9 px de la nave vs. 12 px del enemigo; Boss 18 px). Con escudo: se consume el escudo. Sin escudo: `lives − 1`, `onLives(lives)`, se borran todas las balas enemigas, `weapon = "single"`, la nave queda en su sitio con **2000 ms** de invulnerabilidad (parpadeo cada 100 ms). Un enemigo chocado (no Boss) muere sin dar puntos. Si `lives = 0` → `onLives(0)` y `onGameOver(score)`.
- **Vida extra:** cada **25000** puntos (25000, 50000, …): `lives + 1`, `onLives(lives)`, máximo **5**.
- **Dibujo:** abeja amarilla `#ffe600` con alas azules `#2b6bff`, 24×20 px. Mariposa blanca con alas rojas `#ff3355`, 26×22 px. Boss verde `#39ff14`, 36×30 px, con barra de vida de 36×3 px encima. Kamikaze: rombo magenta `#ff2bd6` con estela al lanzarse. Nave blanca con alerones rojos y cabina cyan `#00f5ff`; escudo: aro cyan de 18 px pulsante. Power-up: cápsula redondeada con la letra dibujada en trazos (no texto de HUD), color por tipo (D cyan, T magenta, F azul, S verde, B amarillo). Bala propia `#ffffff`, enemiga `#ff2bd6`. Explosión: 8 rayos radiales de 4 a 22 px en 400 ms, color del enemigo.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` / `lib/games/frogger/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila con `sort_order` 7; `npm run build`.
2. Crear `lib/games/galaga/spawner.ts`. Verificar: `npm run lint`; `levelConfig(1)` da 2600 ms, 110 px/s, 220 px/s y pesos 70/30/0/0; `levelConfig(15)` da 900 ms, 260 px/s, 320 px/s; `comboMult(4) = 1`, `comboMult(5) = 2`, `comboMult(40) = 8`.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): moverse en 2D dentro de los límites, disparo sostenido hasta sobrecalentar, los 4 tipos de enemigo (nivel 4+), recoger los 5 power-ups, subir el combo y perderlo por daño y por escape, subida de nivel a los 20 s, escudo absorbiendo un impacto, perder las 3 vidas, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'` (registrar también en `prod-setup.md`). Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias; la migración figura en `references/production/prod-setup.md`.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `POWER-UPS`/`NAVES`, dificultad 3, color amarillo, categoría ARCADE).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven la nave a 300 px/s (también en diagonal) dentro de `x ∈ [20, 520]`, `y ∈ [380, 700]`; las flechas y `Espacio` no hacen scroll.
- [ ] Mantener `Espacio` dispara cada 120 ms; ~6 s de disparo continuo sobrecalientan el cañón, que no dispara durante 1500 ms y vuelve con calor 40.
- [ ] El nivel del HUD sube cada 20 s; en nivel 1 sale un escuadrón cada 2600 ms y desde el nivel 4 aparecen kamikazes.
- [ ] Puntos base exactos: abeja 50, mariposa 80, kamikaze 120, Boss 300 (4 impactos), multiplicados por el combo vigente.
- [ ] COMBO empieza en 1, pasa a 2 tras 5 derribos encadenados (cada uno a menos de 1500 ms del anterior), no supera 8 y vuelve a 1 al recibir daño, al dejar escapar un enemigo o al pasar 1500 ms sin derribos.
- [ ] TIEMPO sube cada segundo y cada segundo suma 5 puntos.
- [ ] Los 5 power-ups funcionan: doble 10 s, triple 8 s, frío 6 s sin calor, escudo absorbe un impacto, bomba limpia enemigos y balas; cada recogida suma 25.
- [ ] Un impacto sin escudo baja las vidas en 1, borra las balas enemigas, vuelve a disparo simple y da 2000 ms de invulnerabilidad.
- [ ] Hay vida extra a los 25000 y 50000 puntos, con máximo 5.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas, nivel, COMBO y TIEMPO; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela enemigos, balas, calor, temporizadores de power-ups, combo y TIEMPO; reanudar sin salto de tiempo.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, WASD, espacio) no mueve la nave ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, COMBO 1, TIEMPO 0, calor 0, disparo simple, sin escudo, enemigos ni power-ups, nave en (270, 640)).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** enjambre continuo con nivel por tiempo (20 s); **No:** formación, rayo tractor ni nave doble (identidad de la variante 01).
- **Sí:** movimiento libre en la mitad inferior; da espacio a esquivar abanicos y kamikazes.
- **Sí:** disparo sostenido con calor; **No:** límite de balas en pantalla (el calor cumple la función de racionar).
- **Sí:** 5 power-ups con duración fija y escudo sin caducidad; **No:** power-ups acumulables ni niveles de arma.
- **Sí:** combo por cadena con ventana de 1500 ms, tope ×8 y penalización por escape; premia agresividad y castiga dejar pasar enemigos.
- **Sí:** bomba sin multiplicador para que no sea el atajo al puntaje máximo.
- **Sí:** vidas = casco (3, máx. 5) para respetar el orden `onLives(0)` → `onGameOver`; **Sí:** stats `COMBO` y `TIEMPO` (cambian como mucho una vez por segundo o por derribo).
- **No:** stat de calor en el HUD de React (cambia por frame); se dibuja como barra bajo la nave.
- **Sí:** valores de balance (velocidades, intervalos, pesos, probabilidades, puntos, duraciones) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` ARCADE y color amarillo (enfoque arcade moderno, distinto de la variante 01); **Sí:** `.cover-galaga` nueva.
- **Sí:** canvas 540×720 vertical (3:4).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                  | Mitigation                                                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Demasiadas entidades en niveles altos bajan el rendimiento.                           | Tope de 24 enemigos vivos; balas y power-ups se eliminan al salir del canvas; arrays compactados por frame.                 |
| El combo o el TIEMPO emiten eventos por frame y saturan React.                        | Emitir `combo` solo si `mult` cambia y `time` solo al cruzar un segundo entero.                                             |
| Balance: el calor hace el juego frustrante o irrelevante.                             | +5 por disparo y −25/s dan ~6 s de fuego continuo; ajustar solo editando el spec tras el paso 6.                           |
| La bomba o el triple rompen el leaderboard.                                           | Bomba sin multiplicador ni cadena; power-ups con duración fija y probabilidad 0.08.                                        |
| `dt` grande tras pausar o cambiar de pestaña teletransporta balas o salta temporizadores. | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms; temporizadores avanzan con `dt`, no con `Date.now()`. |
| Flechas, WASD o espacio interfieren con el input del modal.                           | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                        |
| Disparo "pegado" tras perder foco con `Espacio` mantenido.                            | `blur` y `pause` vacían `keysDown` y ponen `firing = false`.                                                               |
| Doble loop / listeners por StrictMode.                                                | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                      |
| Next 16 difiere del conocimiento previo.                                              | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                             |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Formación, rayo tractor, nave doble y fases de desafío.
- Mejoras permanentes, armas secundarias y power-ups acumulables.
- HUD nativo de texto dentro del canvas y overlays de pausa/subida de nivel/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
