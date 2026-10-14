# SPEC GJ-frogger-01 — Juego real: FROGGER (variante: clásico arcade) (motor TS nuevo + canvas en React)

> **Status:** Propuesto
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-14
> **Variant:** 01 de 1 — Frogger clásico fiel: carretera de 5 carriles + río de 5 carriles, 5 casillas meta, temporizador por intento, 3 vidas y niveles que aceleran el tráfico.
> **Objective:** Crear un motor TypeScript de Frogger dibujado con primitivas, registrado en `ENGINES`, publicado en el catálogo y con leaderboard en `/games/frogger` y `/salon`.

---

## Por qué existe este spec

Única variante de la game jam de Frogger: recrea el arcade clásico (1981) con reglas fieles — cruzar tráfico, saltar sobre troncos y tortugas (algunas se sumergen), llenar las 5 casillas meta antes de que se agote el tiempo — y con la mosca bonus. Es la primera mecánica de "cruce por carriles" del catálogo (distinta a Snake, que también es rejilla pero de crecimiento).

**No hay código original que portar** ni assets: `references/started-games/` solo tiene Asteroids, Tetris y Arkanoid, y `references/snake-assets/` es de Snake. El motor se escribe desde cero con el patrón `createX(canvas, events) → GameController` de SPEC 05/07 y se dibuja todo con formas y colores planos. `.cover-rana` existe en `app/globals.css` (prototipo `ranaria` de `references/templates/data.jsx`); se crea `.cover-frogger` copiando su estilo para seguir la convención `cover-<id>`.

Decisiones fijadas por el agente (no se reabren): `id` `frogger`, título `FROGGER`, `cat` `ARCADE`, color `cyan`, `sort_order` **5** (siguiente libre; snake = 4), dificultad 3, tags `CLÁSICO` y `ESQUIVAR`, 1 jugador, teclado. Canvas **560×520**, rejilla de **14 columnas × 13 filas de 40 px**. **3 vidas**, **niveles infinitos** (el HUD muestra nivel), stat extra `TIEMPO`. Salto **instantáneo** de una celda por pulsación (sin animación intermedia). Sin sonido, sin imágenes.

Reglas definidas por este spec: ver "Reglas del juego" en Data model. No se inventan reglas en implementación.

---

## Scope

**In:**

- Motor `lib/games/frogger/engine.ts`: sin globals de módulo; exporta `froggerDef: GameEngineDef` con `createFrogger(canvas, events) → GameController`.
- Módulo `lib/games/frogger/lanes.ts`: tabla tipada `LANES` (fila, tipo `road|river`, largo, velocidad, cantidad, separación, color, carril con tortugas que bucean) y helper `laneObjects(lane, offset) → {x, len, diving}[]`. Solo datos y funciones puras.
- Módulo `lib/games/frogger/draw.ts`: funciones de dibujo (`drawBackground`, `drawVehicle`, `drawLog`, `drawTurtles`, `drawFrog`, `drawBays`) con primitivas Canvas 2D.
- Entrada `frogger` en `lib/games/registry.ts`.
- Clase `.cover-frogger` en `app/globals.css` (copia de `.cover-rana`: franjas cyan horizontales + círculo verde).
- Migración `add_game_frogger`: `insert` en `games` (`published = false`), luego `update` a `true` al verificar.
- Canvas lógico **560×520** (14:13).
- HUD de React: puntaje, **3 vidas**, **nivel** y stat extra `time` ("TIEMPO", `seconds`).
- Sin HUD nativo en el canvas: solo escenario, objetos, rana, casillas meta y mosca.
- Controles: `←↑→↓` y `WASD` saltan una celda. `P` (pausa) la maneja React.
- Leaderboard: sin cambios de código; usa `submitScore` y `scores.game_id = 'frogger'`.
- Actualizar `CLAUDE.md` (lista de motores y specs) y `references/implemented-games.md` (fila `frogger`).

**Out of scope (para specs futuras):**

- Controles táctiles / swipe, gamepad, HiDPI.
- Sonido y música.
- Serpientes en la mediana, cocodrilos, rana dama (lady frog), nutrias: enemigos extra del arcade.
- Animación de salto entre celdas y sprites.
- Selector de dificultad o modos.
- Cambios de esquema Supabase y del contrato `GameEvents`.
- Tests automatizados (no hay runner).

---

## Data model

Fila de catálogo:

    insert into public.games
      (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
    values
      ('frogger', 'FROGGER', 'Cruza el tráfico y el río hasta casa.',
       'Lleva a la rana con las flechas o WASD a través de cinco carriles de tráfico y cinco de río, saltando sobre troncos y tortugas, hasta las cinco casillas de la orilla. Tienes 30 segundos por intento y 3 vidas; llenar las cinco casillas sube de nivel y acelera todo.',
       'ARCADE', 'cyan', 'cover-frogger', 1, 1, '{keyboard}', '{CLÁSICO,ESQUIVAR}', 3, 5, false);

Definición del motor:

    export const froggerDef: GameEngineDef = {
      width: 560, height: 520,
      initialLives: 3,
      showLevel: true,
      stats: [{ key: "time", label: "TIEMPO", color: "yellow", format: "seconds" }],
      create: createFrogger,
    };

Estado interno (dentro de `createFrogger`): `frog { x, row }` (`x` en px, borde izquierdo; `row` 0–12), `maxRow` (fila más alta alcanzada en el intento; menor índice = más arriba), `laneOffsets: number[]` (desplazamiento acumulado por carril), `bays: boolean[5]`, `fly { bay, msLeft } | null`, `flyTimer`, `turtleClock`, `timeLeftMs`, `lastSecondEmitted`, `score`, `lives`, `level`, `extraLifeGiven`, `dying { msLeft } | null`, `paused`, `finished`, `lastTime`, `rafId`, `destroyed`.

Convenciones fijas (heredadas de SPEC 05):

- Eventos solo al cambiar el valor, nunca por frame: `onScore`, `onLives`, `onLevel`, `onStat("time", s)`. Al iniciar/reiniciar se emiten `onScore(0)`, `onLives(3)`, `onLevel(1)`, `onStat("time", 30)`.
- `onStat("time", s)` se emite solo cuando cambia `Math.ceil(timeLeftMs / 1000)` (una vez por segundo entero).
- Game over: `onLives(0)` y luego `onGameOver(score)`; el motor deja de actualizar y de reaccionar a teclas. El último frame (rana muerta) queda en el canvas.
- Se ignoran `keydown` con target `input/textarea/select`; `preventDefault` en flechas solo con el juego activo y sin pausa. Se ignora `e.repeat` (mantener pulsado no encadena saltos).
- Pausa/blur/destroy: al reanudar se reinicia `lastTime`; `dt` capado a **50 ms**. `blur` pausa el avance interno (no emite eventos).
- `destroy()` idempotente y seguro en StrictMode; cancela rAF y listeners (`keydown`, `blur`). No hay recursos asíncronos: el loop arranca en `create`.
- Sin overlays de pausa ni game over dentro del canvas.

**Reglas del juego:**

- **Rejilla:** 14 columnas × 13 filas, celda 40 px. Filas (de arriba a abajo): 0 = orilla con 5 casillas meta; 1–5 = río; 6 = mediana segura; 7–11 = carretera; 12 = acera de salida (segura).
- **Inicio de intento:** rana en `x = 240`, `row = 12`, `maxRow = 12`, `timeLeftMs = 30000`.
- **Salto:** cada `keydown` (no repetido) mueve una celda: arriba/abajo cambia `row` ±1 (abajo limitado a 12); izquierda/derecha cambia `x` ±40, limitado a `[0, 520]`. Salto instantáneo. Sin cola de saltos. Durante `dying` las teclas se ignoran.
- **Carriles** (velocidad en px/s, negativa = hacia la izquierda; `separación` = distancia de inicio a inicio; bucle = `cantidad × separación`):

  | Fila | Tipo  | Objeto       | Largo (px) | Velocidad | Cantidad | Separación | Color     |
  | ---- | ----- | ------------ | ---------: | --------: | -------: | ---------: | --------- |
  | 11   | road  | coche        |         40 |       −60 |        4 |        200 | `#ffe600` |
  | 10   | road  | excavadora   |         40 |       +50 |        4 |        200 | `#00f5ff` |
  | 9    | road  | coche        |         40 |       −80 |        4 |        200 | `#ff2bd6` |
  | 8    | road  | bólido       |         40 |      +140 |        2 |        400 | `#ffffff` |
  | 7    | road  | camión       |         80 |       −50 |        3 |        280 | `#ff8a00` |
  | 5    | river | 3 tortugas   |        120 |       −50 |        4 |        210 | `#ff3355` |
  | 4    | river | tronco corto |        120 |       +40 |        4 |        220 | `#8b5a2b` |
  | 3    | river | tronco largo |        240 |       +80 |        2 |        400 | `#8b5a2b` |
  | 2    | river | 2 tortugas   |         80 |       −60 |        4 |        200 | `#ff3355` |
  | 1    | river | tronco medio |        160 |       +50 |        3 |        280 | `#8b5a2b` |

- **Posición de objetos:** objeto `i` del carril: `x = mod(i × separación + offset, bucle) − largo`; `offset += velocidad × mult × dt`. Se dibuja si `x < 560` y `x + largo > 0`.
- **Multiplicador de nivel:** `mult = min(1 + 0.15 × (level − 1), 2.2)` (tope en nivel 9).
- **Tortugas que bucean:** en la fila 5 el grupo índice 2 y en la fila 2 el grupo índice 1. Ciclo de **4000 ms** (`turtleClock`, no escala con nivel): 0–2800 superficie (seguras), 2800–3200 medio hundidas (seguras, color `#7a1a2a`), 3200–3800 sumergidas (no seguras, no se dibujan salvo burbujas), 3800–4000 medio hundidas (seguras).
- **Colisión en carretera (filas 7–11):** hitbox de la rana `[x + 6, x + 34]`; hitbox del vehículo `[x + 2, x + largo − 2]`. Solapamiento → muerte.
- **Río (filas 1–5):** la rana está a salvo si su centro (`x + 20`) está dentro de `[x, x + largo]` de algún tronco o tortuga segura del carril; si no, se ahoga → muerte. Estando a salvo, la rana se desplaza con el objeto: `frog.x += velocidad × mult × dt`. Si su centro sale de `[0, 560]` → muerte.
- **Casillas meta (fila 0):** 5 casillas con centro en x = **60, 170, 280, 390, 500**. Al saltar a la fila 0: si `|frog.x + 20 − centro| ≤ 20` de una casilla libre → llegada; si cae fuera de toda casilla o en una ocupada → muerte.
- **Mosca bonus:** cada **8000 ms** aparece en una casilla libre al azar durante **4000 ms** (si no hay libres, no aparece). Llegar a esa casilla mientras está la mosca suma bonus.
- **Puntuación:**
  - +**10** por cada salto hacia arriba que alcanza una fila nueva (`row < maxRow`; se actualiza `maxRow`).
  - Llegada a casilla: +**50**, más **+10 por segundo entero restante** (`Math.floor(timeLeftMs / 1000) × 10`), más **+200** si había mosca.
  - Llenar las 5 casillas: +**1000**, `level + 1`, `onLevel`, casillas vaciadas, mosca eliminada.
  - Tras cada llegada empieza un nuevo intento (rana a la salida, `maxRow = 12`, `timeLeftMs = 30000`).
  - Vida extra: una sola vez al alcanzar **10000** puntos, `lives + 1` (máx. 5), `onLives`.
- **Tiempo:** `timeLeftMs` baja con `dt`; al llegar a 0 → muerte.
- **Muerte:** `lives − 1`, `onLives(lives)`. Si `lives = 0` → `onGameOver(score)` inmediatamente. Si no, `dying = 600 ms` (la rana se dibuja como aspa roja `#ff3355`, el tráfico sigue moviéndose), luego nuevo intento. La muerte no vacía casillas.
- **Dibujo:** orilla `#003a1a` con setos verdes y casillas `#001a4d`; río `#001a4d` con ondas tenues; mediana y acera `#2a0a4a`; carretera `#0a0a18` con líneas discontinuas `#333`. Rana verde neón `#00ff88` (cuerpo redondeado 28 px + 4 patas + ojos), orientada según el último salto. Casilla ocupada: rana dibujada en ella. Mosca: punto `#ffe600` con dos alas blancas. Vehículos: rectángulos redondeados con faros. Troncos: rectángulo marrón con vetas. Tortugas: círculos de 16 px de radio por cada 40 px.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` según `AGENTS.md` y `lib/games/snake/engine.ts` (patrón vigente). Crear `.cover-frogger` en `app/globals.css`. Aplicar migración `add_game_frogger` con `published = false` (`mcp__supabase__apply_migration`). Verificar: `execute_sql` `select * from games where id = 'frogger'` muestra la fila; `npm run build`.
2. Crear `lib/games/frogger/lanes.ts` con la tabla de carriles y `laneObjects`. Verificar: `npm run lint`.
3. Crear `lib/games/frogger/draw.ts`. Verificar: `npm run lint`.
4. Crear `lib/games/frogger/engine.ts` y exportar `froggerDef`. Verificar: `npm run lint` y `npm run build`.
5. Registrar en `lib/games/registry.ts`. Verificar: `/games/frogger/jugar` carga el canvas (con `published = false` la ficha da 404; probar `/jugar`).
6. Verificación en navegador (Playwright o manual): cruzar carretera, morir atropellado, ahogarse, montarse en tronco y en tortugas, ser arrastrado fuera del borde, ver tortugas sumergirse, llegar a casilla con y sin mosca, caer en seto, agotar tiempo, llenar 5 casillas (nivel 2, tráfico ×1.15), pausa (botón y `P`), FIN, guardar puntaje, "JUGAR DE NUEVO", consola limpia.
7. `update games set published = true where id = 'frogger'`. Verificar: tarjeta en `/games` y home, ficha, puntaje en top 10 y pestaña en `/salon`. Borrar filas de prueba de `scores`; `get_advisors` sin advertencias nuevas.
8. Actualizar `CLAUDE.md` y `references/implemented-games.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `games` contiene `frogger` con `published = true` y los metadatos del spec (`sort_order` 5); `get_advisors` sin nuevas advertencias.
- [ ] La tarjeta (con `.cover-frogger`), la ficha `/games/frogger` y el home muestran el juego desde la BD (1 jugador, teclado, tags `CLÁSICO`/`ESQUIVAR`, dificultad 3, color cyan).
- [ ] `/games/frogger/jugar` muestra el canvas 14:13 sin desborde a 375 px y 1280 px.
- [ ] `←↑→↓` y `WASD` mueven la rana exactamente una celda por pulsación; mantener pulsado no repite; las flechas no hacen scroll.
- [ ] La rana empieza en `x = 240`, fila 12; no baja de la fila 12 ni sale de `[0, 520]` horizontalmente por salto.
- [ ] Cada salto a una fila nueva suma 10; volver a subir a una fila ya alcanzada en el mismo intento no suma.
- [ ] Los 10 carriles usan los largos, velocidades, cantidades y separaciones de la tabla; el bólido de la fila 8 es el más rápido (140 px/s en nivel 1).
- [ ] Tocar un vehículo mata; caer al agua fuera de tronco/tortuga mata; ser arrastrado hasta que el centro sale del canvas mata.
- [ ] Sobre tronco o tortuga, la rana se desplaza con él.
- [ ] Los grupos de tortugas que bucean siguen el ciclo de 4000 ms y solo matan durante 3200–3800 ms.
- [ ] Llegar a una casilla libre suma 50 + 10 × segundos enteros restantes (+200 con mosca); caer en seto o casilla ocupada mata.
- [ ] La mosca aparece cada 8 s en una casilla libre y dura 4 s.
- [ ] Llenar las 5 casillas suma 1000, sube el nivel en el HUD, vacía casillas y acelera el tráfico (×1.15 en nivel 2, tope ×2.2).
- [ ] El TIEMPO del HUD empieza en 30, baja un segundo cada segundo y se reinicia a 30 tras cada llegada o muerte; a 0 la rana muere.
- [ ] Al alcanzar 10000 puntos se gana una vida (una sola vez).
- [ ] El HUD de React refleja puntaje, vidas (3 → 0), nivel y TIEMPO; sin eventos por frame.
- [ ] La muerte muestra el aspa 600 ms antes del nuevo intento; durante ese tiempo las teclas no mueven nada.
- [ ] Pausa (botón y `P`) congela tráfico, río, temporizador y mosca; reanudar sin salto de tiempo.
- [ ] FIN y game over natural (`onLives(0)` → `onGameOver`) abren el modal con el puntaje correcto; teclear en el input (flechas y WASD) no mueve la rana.
- [ ] Guardar inserta en `scores` con `game_id = 'frogger'`, nombre y puntaje; sin doble guardado.
- [ ] El puntaje aparece en `/games/frogger` (top 10) y en una pestaña de `/salon`, sin reiniciar el servidor.
- [ ] "JUGAR DE NUEVO" empieza limpio (puntaje 0, 3 vidas, nivel 1, TIEMPO 30, casillas vacías, `mult` 1).
- [ ] Desmontar en juego cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Asteroids, Tetris, Arkanoid y Snake sin regresión.
- [ ] Sin errores ni warnings de hydration en `/games/frogger/jugar`.
- [ ] `CLAUDE.md` y `references/implemented-games.md` listan el nuevo juego.

---

## Decisions

- **Sí:** motor nuevo desde cero con reglas del arcade clásico; **No:** portar código externo (no existe en `references/`).
- **Sí:** todo dibujado con primitivas Canvas 2D; **No:** sprites ni imágenes (sin carga asíncrona, el loop arranca en `create`).
- **Sí:** 3 vidas + niveles infinitos con multiplicador de velocidad 0.15 por nivel, tope ×2.2; es el bucle de dificultad del original.
- **Sí:** `showLevel: true` e `initialLives: 3`; **Sí:** stat `TIEMPO` porque el temporizador es parte central de la regla y no hay HUD nativo.
- **Sí:** salto instantáneo por celda; **No:** animación de salto (añade estados intermedios y colisiones a medio salto).
- **Sí:** posición horizontal en px (no en columnas) porque los troncos arrastran a la rana de forma continua.
- **Sí:** tortugas que bucean y mosca bonus (fieles al original, bajo coste). **No:** cocodrilos, serpientes, nutrias, rana dama (más IA y estados; spec aparte).
- **Sí:** puntuación por fila nueva, llegada, segundos restantes, mosca y nivel; vida extra a 10000 (valores de este spec, ajustables solo editándolo).
- **Sí:** `cat` ARCADE, color cyan (río/neón; distingue de Snake, verde); **Sí:** `.cover-frogger` nueva basada en `.cover-rana`; **No:** reutilizar `cover-rana` (convención `cover-<id>`).
- **Sí:** canvas 560×520 (rejilla 14×13 de 40 px) para que la carretera y el río tengan anchura de bucle suficiente.
- **No:** sonido, táctil/swipe, HiDPI (specs aparte).
- **Sí:** publicar al final (`published = false` hasta verificar).
- **Sí:** leaderboard reutiliza `scores`/`submitScore`; **No:** tablas o columnas nuevas.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                                                                      | Mitigation                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Arrastre del río acumula error de coma flotante y la rana "salta" de objeto.                              | La comprobación de seguridad usa el centro de la rana contra el rango del objeto en el mismo frame tras mover los offsets. |
| Saltar a la fila 0 con `x` no alineada (arrastrada por un tronco) hace casi imposible acertar la casilla. | Tolerancia de ±20 px sobre el centro de casilla; verificar en el paso 6.                                                   |
| Emitir `onStat("time")` por frame satura React.                                                           | Emitir solo cuando cambia `Math.ceil(timeLeftMs / 1000)`.                                                                  |
| `dt` grande tras pausar o cambiar de pestaña teletransporta tráfico y rana.                               | `lastTime` se reinicia al reanudar y tras blur; `dt` capado a 50 ms.                                                       |
| Letras WASD o flechas interfieren con el input del modal.                                                 | Ignorar `input/textarea/select`; `preventDefault` solo con juego activo y sin pausa.                                       |
| Tecla mantenida encadena saltos y rompe el balance.                                                       | Ignorar `e.repeat`; un salto por `keydown`.                                                                                |
| Doble loop / listeners por StrictMode.                                                                    | `destroy` idempotente con bandera `destroyed`; criterio de aceptación.                                                     |
| Velocidades de nivel alto hacen el río injugable.                                                         | Tope de `mult` en 2.2; ajustable solo editando el spec.                                                                    |
| Next 16 difiere del conocimiento previo.                                                                  | Paso 1 consulta `node_modules/next/dist/docs/`.                                                                            |

---

## What is **not** in this spec

- Controles táctiles, gamepad y móvil; HiDPI.
- Sonido y música.
- Cocodrilos, serpientes, nutrias, rana dama y otros enemigos del arcade.
- Animación de salto y sprites.
- HUD nativo dentro del canvas y overlays de pausa/game over.
- Selector de dificultad o modos alternativos.
- Cambios de esquema Supabase o del contrato de motores.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
