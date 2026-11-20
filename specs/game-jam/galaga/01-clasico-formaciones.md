# SPEC GJ-galaga-01 — Juego real: GALAGA (variante: clásico de formaciones) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-20
> **Variant:** 01 de 2 — Clásico fiel: fases de 40 enemigos que entran en vuelo, forman en rejilla y atacan en picada, con rayo tractor, nave doble al rescatar y fases de desafío.
> **Objective:** Crear un motor TypeScript de Galaga (variante clásico de formaciones) dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/galaga` y `/salon`.

---

## Por qué existe este spec

Variante 01 de 2 de la game jam de Galaga. Reproduce el bucle del arcade original: cada **fase** trae 40 enemigos (4 jefes, 16 mariposas, 20 abejas) que **entran en vuelo** por curvas, ocupan su hueco en una **formación** que oscila y desde ahí lanzan **picadas** contra el jugador. El jefe puede **capturar la nave con un rayo tractor**; rescatarla da la **nave doble** (dos cañones). Cada 4 fases (3, 7, 11…) hay una **fase de desafío** sin disparos enemigos. Disparo por pulsación con máximo 2 balas en pantalla, 3 vidas. Se distingue de la variante 02 (contrarreloj de 90 s, sin formación, escuadrones continuos, movimiento 2D, disparo automático, power-ups y multiplicador de combo).

**No hay código original que portar** ni assets: `references/started-games/` solo trae Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 (referencia vigente: `lib/games/snake/engine.ts` y `lib/games/frogger/engine.ts`); naves y enemigos se dibujan con polígonos y rectángulos. No existe clase cover para este juego en `app/globals.css`; se crea `.cover-galaga`.

Decisiones fijadas por el agente (no se reabren): `id` `galaga`, título `GALAGA`, `cat` `SHOOTER`, color `cyan`, `sort_order` **7** (siguiente libre; frogger = 5 implementado y missile-command = 6 reservado por sus specs propuestos), dificultad 4, tags `CLÁSICO` y `FORMACIONES`, 1 jugador, teclado. Canvas **480×640** (3:4). **3 vidas** (`initialLives: 3`), **nivel** = fase (`showLevel: true`), stat extra `PRECISIÓN %`. Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/galaga/engine.ts`: sin globals de módulo; exporta `galagaDef: GameEngineDef` con `createGalaga(canvas, events) → GameController`.
- Módulo `lib/games/galaga/formation.ts`: funciones puras y constantes: `SLOTS` (40 huecos con `row`, `col`, `kind`), `slotPos(slot, swayX)`, `ENTRY_ORDER`, `entryPath(group, slot)` (Bézier cúbica), `challengePath(group)`, `bezier(p0, p1, p2, p3, t)`, `diveIntervalMs(stage)`, `maxDivers(stage)`, `diveSpeed(stage)`, `isChallenge(stage)`, `bossDivePoints(escortsKilled)`.
- Módulo `lib/games/galaga/draw.ts`: `drawStars`, `drawShip` (simple/doble), `drawBee`, `drawButterfly`, `drawBoss` (verde / dañado), `drawBeam`, `drawBullet`, `drawExplosion` con primitivas Canvas 2D. Todos los colores salen de una constante `PALETTE` del motor (facilita el spec de skins posterior).
- Entrada `galaga` en `lib/games/registry.ts`.
- Clase `.cover-galaga` en `app/globals.css`: fondo `radial-gradient(circle at 50% 30%,#0a1a3a,#0a0a18)` con `::before` de puntos de estrellas (`radial-gradient` repetidos) y `::after` de una nave cyan triangular abajo y tres siluetas de enemigos magenta/amarillo arriba.
- Migración `add_game_galaga`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **480×640**.
- HUD de React: puntaje, **3 vidas**, **nivel** (fase) y stat extra `accuracy` ("PRECISIÓN %", `int`).
- Sin HUD nativo de texto en el canvas, salvo los rótulos de juego `FASE N`, `DESAFÍO` y `PERFECTO` / `ACIERTOS N` entre fases (texto centrado de duración fija, no overlay de pausa ni game over).
- Controles: `←`/`→` y `A`/`D` mueven la nave; `Espacio` (o `↑`/`W`) dispara. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'galaga'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `galaga`).

**Out of scope (para specs futuras):**

- Controles táctiles / gamepad virtual (`touch` en el def; lo añade `mobile-porter`), HiDPI.
- Skins (`skins.ts`; lo añade `skin-designer`).
- Sonido y música.
- Power-ups, disparo automático, movimiento vertical, modo contrarreloj.
- Enemigos transformables (escorpiones) y variantes de jefes de fases altas del original.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('galaga', 'GALAGA', 'Rompe la formación antes de que se lance en picada.',
       'Mueve tu nave con las flechas o A/D y dispara con Espacio. Cada fase, cuarenta insectos entran volando, forman en la parte alta y se lanzan en picada contra ti. Cuidado con el rayo tractor de los jefes: si capturan tu nave, rescátala derribando al jefe en vuelo y lucharás con doble cañón. Cada cuatro fases llega un desafío sin disparos enemigos. Tienes tres vidas.',
       'SHOOTER', 'cyan', 'cover-galaga', 1, 1, '{keyboard}', '{CLÁSICO,FORMACIONES}', 4, 7, false);

Definición del motor:

    export const galagaDef: GameEngineDef = {
      width: 480, height: 640,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "accuracy", label: "PRECISIÓN %", color: "yellow", format: "int" }],
      create: createGalaga,
    };

Estado interno (dentro de `createGalaga`): `ship { x, alive, dual, invulnMs, respawnMs }`, `moveLeft`, `moveRight`, `bullets: { x, y }[]`, `enemyBullets: { x, y, vx, vy }[]`, `enemies: { id, kind: "bee" | "butterfly" | "boss" | "captured", slot, hp, mode: "entering" | "formation" | "diving" | "returning" | "beaming" | "challenge", path, t, x, y, escortOf, firedAt300, firedAt380, beam }[]`, `entryQueue`, `entryTimer`, `diveTimer`, `swayMs`, `capturedShip { bossId } | null`, `stage`, `phase: "intro" | "play" | "clear"`, `phaseMs`, `challengeHits`, `diveKills: Map<bossId, number>`, `shots`, `hits`, `score`, `lives`, `nextExtraAt`, `stars`, `explosions`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel` (fase), `onStat("accuracy", pct)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("accuracy", 0)`.
- `accuracy = Math.round(100 × hits / shots)` (0 si `shots = 0`); se emite solo cuando el entero cambia. Valor 0 oculta el stat (contrato de `onStat`); esperado al inicio.
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame queda en el canvas.
- Se ignoran `keydown/keyup` con target `input/textarea/select`; `preventDefault` en flechas y `Espacio` solo con el juego activo y sin pausa. El disparo ignora `e.repeat` (una bala por pulsación); el movimiento es continuo mientras se mantiene la tecla.
- Pausa/blur/destroy ponen `moveLeft = moveRight = false`; al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**.
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `keyup`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Nave:** centro inicial (240, 600), cuerpo 26×24 px, hitbox 18×18 centrada. Se mueve a **240 px/s**, `x` limitada a `[20, 460]`. En modo doble hay dos naves a `x − 14` y `x + 14` (límite `[34, 446]`), cada una con su hitbox.
- **Disparo propio:** bala 3×10 px a **600 px/s** hacia arriba desde la punta. Máximo **2** balas propias en pantalla (**4** en modo doble, donde cada pulsación dispara 2 balas, una por cañón). Si se alcanza el máximo la pulsación se ignora y no cuenta. `shots` suma 1 por bala creada; `hits` suma 1 por bala que impacta un enemigo.
- **Formación:** rejilla de 10 columnas, separación horizontal **36 px**, columna `c` en `x = 78 + 36 × c + swayX`. Filas: 0 jefes (columnas 3–6) en `y = 90`; 1–2 mariposas (columnas 1–8) en `y = 122` y `154`; 3–4 abejas (columnas 0–9) en `y = 186` y `218`. Total 4 + 16 + 20 = **40**. `swayX = 16 × sin(2π × swayMs / 4000)`.
- **Tamaños / hitbox:** abeja 22×18, mariposa 24×20, jefe 28×24, nave capturada 26×24.
- **Entrada de fase:** `ENTRY_ORDER` = jefes, mariposas fila 1, mariposas fila 2, abejas fila 3, abejas fila 4 (40 huecos), repartidos en **5 grupos consecutivos de 8**. Grupo `g` sale a `600 + 1500 × g` ms del inicio de la fase; dentro del grupo, un enemigo cada **120 ms**. Cada enemigo recorre una Bézier cúbica en **1800 ms**: grupos pares desde `(−20, 380)` con controles `(240, 560)` y `(120, 40)`; impares en espejo desde `(500, 380)` con `(240, 560)` y `(360, 40)`; destino su hueco. Durante la entrada no disparan ni pican.
- **Picadas:** empiezan cuando el último enemigo de la entrada llega a su hueco. Cada `diveIntervalMs(stage) = max(900, 2600 − 200 × (stage − 1))` ms se elige un enemigo al azar en formación, si hay menos de `maxDivers(stage) = min(2 + floor(stage / 2), 6)` en picada.
  - Trayectoria: arco lateral de 60 px hacia el lado más cercano al borde durante 400 ms, luego descenso hacia la `x` que tenía la nave al iniciar la picada, con oscilación lateral `40 × sin(2π × t / 1200)`. Velocidad `diveSpeed(stage) = min(170 + 10 × (stage − 1), 260)` px/s.
  - Al pasar `y > 660` reaparece en `y = −20` sobre su hueco y vuelve a él a **220 px/s** (`returning`); al llegar vuelve a `formation`.
  - Un jefe que pica lleva como **escolta** hasta 2 mariposas vivas en formación de las columnas `c` y `c + 1` de la fila 1 bajo él (si existen); siguen la misma trayectoria desplazadas ±24 px.
  - Disparo enemigo: cada atacante en picada dispara 1 bala al cruzar `y = 300` y, desde la fase 4, otra al cruzar `y = 380`. Bala 3×8 px, `vy = 260` px/s, `vx = clamp((naveX − x) × 0.5, −80, 80)` px/s. Máximo **8** balas enemigas simultáneas (las que excedan no se crean). En formación no disparan.
- **Jefe:** 2 impactos. El primero lo pasa de verde a morado (dañado) sin puntos; el segundo lo destruye.
- **Puntos:** abeja 50 en formación / 100 en picada; mariposa 80 / 160; jefe 150 en formación; jefe en picada **400**, **800** o **1600** si en esa picada el jugador ya derribó 0, 1 o 2 de sus escoltas. "En picada" incluye `diving`, `returning` y `beaming`; `entering` puntúa como formación.
- **Rayo tractor:** desde la fase 2, si `capturedShip` es `null`, la nave no está en modo doble, `lives ≥ 1` y el jefe elegido para picar no tiene escoltas, con probabilidad **0.35** hace picada de captura: baja en línea recta a 180 px/s hasta `y = 380` sobre la `x` de la nave y emite el rayo **3000 ms** (crece 600 ms, se mantiene 1800 ms, se retrae 600 ms). Cono de 24 px de ancho en el jefe a **96 px** en `y = 620`.
  - Si durante el tramo mantenido el centro de la nave queda dentro del cono, la nave es **capturada**: `lives −= 1` → `onLives(lives)`, la nave sube con el jefe y queda como enemigo `captured` (rojo) en `y = 62` sobre el hueco del jefe; el jefe vuelve a su hueco a 220 px/s. Si `lives` llega a 0 → game over. Si no, nueva nave según **Respawn**.
  - Derribar al jefe captor mientras está **en picada** libera la nave: desciende y se acopla a la del jugador → **modo doble** (sin cambiar vidas). Si el jefe captor muere **en formación**, la nave capturada pasa a ser enemiga y pica sola como una mariposa (`kind: "captured"`).
  - Destruir la nave capturada vale **1000** puntos y la elimina.
  - Si el jefe se retrae sin capturar, vuelve a su hueco sin efecto.
- **Modo doble:** si un impacto o colisión alcanza una de las dos naves, se pierde esa nave (se vuelve a nave simple en la `x` de la superviviente) sin perder vida. Si alcanza a las dos en el mismo frame, se pierde vida normalmente.
- **Muerte:** bala enemiga o colisión con un enemigo (el enemigo también muere y da sus puntos) → explosión de 1000 ms, `lives −= 1`, `onLives(lives)`, se borran las balas enemigas. Si `lives = 0` → `onGameOver`. Si no, **Respawn** a los **2000 ms** en (240, 600) con **1500 ms** de invulnerabilidad (parpadeo cada 100 ms). Durante la espera no empiezan picadas nuevas.
- **Vidas extra:** a los **20000** puntos y luego cada **70000** (20000, 90000, 160000…), máximo **5** vidas → `onLives(lives)`. Si ya hay 5, el umbral se consume sin efecto.
- **Fin de fase:** cuando no queda ningún enemigo vivo (incluida la nave capturada enemiga) ni entradas pendientes: rótulo `FASE N+1` durante **2000 ms**, `stage += 1`, `onLevel(stage)`, se borran balas y comienza la entrada. Una nave capturada aún retenida por un jefe vivo no existe al terminar la fase (el jefe debe morir para cerrar la fase).
- **Fase de desafío** (`isChallenge(stage)`: `stage % 4 === 3`, es decir 3, 7, 11…): rótulo `DESAFÍO` 2000 ms. 40 abejas/mariposas (mismo reparto sin jefes: 20 mariposas y 20 abejas) en 5 grupos de 8, cada grupo a `1800 × g` ms, un enemigo cada **150 ms**. Cada enemigo recorre en **3000 ms** una Bézier desde `(120, −20)` (grupos pares) o `(360, −20)` (impares) con controles `(480, 300)` / `(0, 300)` y `(0, 500)` / `(480, 500)` hasta `(360, 680)` / `(120, 680)` y desaparece. No disparan, no pican y no forman; la colisión sí mata. Cada derribo vale **100**. Al salir el último: rótulo `PERFECTO` (+**10000**) si se derribaron los 40, o `ACIERTOS N` (+**100 × N** adicional) si no, durante 2000 ms; luego fase siguiente normal.
- **Estrellas:** 60 estrellas de 1–2 px en posiciones aleatorias, velocidad vertical aleatoria **30–90 px/s**, reaparecen arriba al salir; siguen moviéndose entre fases, no en pausa ni tras game over.
- **Dibujo:** fondo `#000010`; estrellas blancas/cyan con alfa 0.4–1. Nave blanca con cabina `#00f5ff` y alas `#ff2b4e`. Abeja amarillo `#ffe600` con alas azules `#2b6bff`; mariposa roja `#ff2b4e` con alas blancas; jefe verde `#00ff88` (dañado `#b14cff`); nave capturada en rojo `#ff2b4e`. Rayo tractor: bandas horizontales `rgba(0,245,255,0.35)` alternas cada 8 px. Balas propias `#ffffff`, enemigas `#ff3355`. Explosión: 8 rayos que crecen 0 → 18 px en 300 ms. Rótulos: 20 px monoespaciado `#00f5ff`, centrados en `y = 320`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-galaga` en `app/globals.css`. Aplicar migración `add_game_galaga` con `published = false` (`mcp__supabase__apply_migration`) y registrarla en `references/production/prod-setup.md`. Verificar: `execute_sql` `select * from games where id = 'galaga'` muestra la fila; `npm run build`.
2. Crear `lib/games/galaga/formation.ts`. Verificar: `npm run lint`; `SLOTS.length = 40`; `diveIntervalMs(1) = 2600`, `diveIntervalMs(10) = 900`; `maxDivers(1) = 2`, `maxDivers(12) = 6`; `diveSpeed(1) = 170`, `diveSpeed(20) = 260`; `isChallenge(3) = isChallenge(7) = true`, `isChallenge(4) = false`; `bossDivePoints(2) = 1600`.
3. Crear `lib/games/galaga/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/galaga/engine.ts` y exportar `galagaDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar `galaga` en `lib/games/registry.ts`. Verificar: `/games/galaga/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): entrada de los 5 grupos, formación oscilando, picadas con disparos, jefe de 2 impactos, picada con escoltas y 1600, captura por rayo (fase 2) y rescate a modo doble, perder una nave del modo doble, fase de desafío 3 con `PERFECTO`/`ACIERTOS`, vida extra a 20000, perder las 3 vidas, PRECISIÓN en el HUD, pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'galaga'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `galaga` con `published = true` y los metadatos del spec (`sort_order` 7); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-galaga`), la ficha `/games/galaga` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`FORMACIONES`, dificultad 4, color cyan, categoría SHOOTER).
- [ ] `/games/galaga/jugar` muestra el canvas 3:4 sin desborde a 375 px y 1280 px.
- [ ] `←`/`→` y `A`/`D` mueven la nave a 240 px/s entre `x = 20` y `x = 460`; las flechas y `Espacio` no hacen scroll.
- [ ] Cada pulsación de `Espacio` (o `↑`/`W`) dispara una bala a 600 px/s; nunca hay más de 2 balas propias (4 en modo doble); mantener pulsado no repite.
- [ ] Cada fase normal empieza con 40 enemigos que entran en 5 grupos de 8 alternando lados y ocupan una formación de 4 jefes, 16 mariposas y 20 abejas que oscila ±16 px cada 4 s.
- [ ] Durante la entrada nadie dispara ni pica; después pican hasta `min(2 + floor(fase/2), 6)` a la vez, a un intervalo de `max(900, 2600 − 200 × (fase − 1))` ms.
- [ ] Puntos: abeja 50/100, mariposa 80/160, jefe 150 en formación y 400/800/1600 en picada según escoltas derribadas; el jefe necesita 2 impactos y cambia a morado tras el primero.
- [ ] Desde la fase 2 un jefe puede capturar la nave con el rayo (3000 ms): se pierde una vida, la nave roja queda sobre el jefe; derribar al jefe en picada da el modo doble; destruir la nave capturada vale 1000.
- [ ] En modo doble cada pulsación dispara 2 balas; un impacto sobre una nave la elimina sin restar vida.
- [ ] Morir resta una vida, borra las balas enemigas y la nave reaparece a los 2000 ms con 1500 ms de invulnerabilidad parpadeando.
- [ ] La fase 3 (y 7, 11…) es de desafío: 40 enemigos sin disparos, 100 por derribo y bonus 10000 (`PERFECTO`) o 100 × aciertos.
- [ ] Al limpiar la fase se muestra `FASE N` 2000 ms y el nivel del HUD sube en 1.
- [ ] Vida extra a los 20000 y a los 90000 puntos; las vidas nunca superan 5.
- [ ] PRECISIÓN % del HUD = `round(100 × aciertos / disparos)` y solo cambia cuando cambia el entero.
- [ ] Perder la última vida (por disparo, colisión o captura) emite `onLives(0)` y luego `onGameOver` y abre el modal con el puntaje correcto.
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y PRECISIÓN %; sin eventos por frame.
- [ ] Pausa (botón y `P`) congela nave, enemigos, balas, rayo, estrellas y temporizadores; reanudar sin salto de tiempo ni movimiento residual.
- [ ] FIN y game over natural abren el modal con el puntaje correcto; teclear en el input (flechas, `A`, `D`, `W`, espacio) no mueve ni dispara.
- [ ] Guardar inserta en `scores` con `game_id = 'galaga'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/galaga` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, fase 1, PRECISIÓN oculta, nave simple en (240, 600), sin nave capturada ni balas).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid, Snake y Frogger sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/galaga/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas propias de esta variante; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** fases de 40 enemigos con entrada en vuelo + formación + picadas; es el núcleo del original y la diferencia con la variante 02. **No:** escuadrones continuos ni contrarreloj.
- **Sí:** rayo tractor y nave doble; es la mecánica distintiva de Galaga. **No:** más de una nave capturada a la vez.
- **Sí:** disparo por pulsación con máximo 2 balas; premia la puntería (de ahí el stat PRECISIÓN %). **No:** disparo automático ni power-ups.
- **Sí:** fase de desafío cada 4 fases desde la 3 con bonus 10000 por perfecto; da picos de puntaje para el leaderboard.
- **Sí:** 3 vidas, vida extra a 20000 y cada 70000, tope 5; **Sí:** `showLevel` con la fase.
- **Sí:** trayectorias como Bézier cúbicas con puntos fijados en el spec; deterministas y fáciles de verificar.
- **Sí:** valores de balance (velocidades, intervalos, puntos, probabilidad 0.35 de captura) fijados en este spec, ajustables solo editándolo.
- **Sí:** `cat` SHOOTER y color cyan; **Sí:** `.cover-galaga` nueva.
- **Sí:** canvas 480×640 (3:4 vertical, como el arcade).
- **No:** sonido, táctil, HiDPI, skins (specs/subagentes aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                       | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| La máquina de estados de enemigos (entrada, formación, picada, retorno, rayo) crece mucho. | `mode` explícito por enemigo y trayectorias puras en `formation.ts`; cada modo se actualiza en una función separada.    |
| La captura deja estados inconsistentes (jefe muerto con nave colgada, fase que no cierra). | `capturedShip` referencia al `bossId`; al morir el jefe se resuelve en el mismo frame (rescate u hostil); criterio de aceptación. |
| Picadas en fases altas resultan injugables.                                                | Topes `maxDivers` 6, intervalo mínimo 900 ms, velocidad máx. 260 px/s y 8 balas enemigas; verificar fase 8+ en el paso 6. |
| Emitir `onStat("accuracy")` por frame satura React.                                        | Emitir solo cuando cambia el entero redondeado.                                                                         |
| `dt` grande tras pausar o cambiar de pestaña hace saltar trayectorias.                     | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                    |
| Flechas, `A`/`D`/`W` o espacio interfieren con el input del modal.                         | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                    |
| Movimiento "pegado" tras perder foco.                                                      | `blur` y `pause` ponen `moveLeft`/`moveRight` a `false`.                                                                |
| Doble loop / listeners por StrictMode.                                                     | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                  |
| Next 16 difiere del conocimiento previo.                                                   | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                         |

---

## What is **not** in this spec

- Controles táctiles, gamepad virtual y móvil; HiDPI.
- Skins (classic/neon/retro).
- Sonido y música.
- Power-ups, disparo automático, movimiento vertical, modo contrarreloj.
- Escorpiones, jefes transformados y demás enemigos de fases altas del original.
- HUD nativo de texto dentro del canvas (salvo rótulos de fase) y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
