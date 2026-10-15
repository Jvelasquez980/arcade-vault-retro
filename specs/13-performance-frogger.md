# SPEC 13 — Performance de Frogger

> **Status:** Aprovado
> **Depends on:** SPEC 07, SPEC 11
> **Date:** 2026-10-15
> **Objective:** Eliminar los tirones de Frogger en móvil y escritorio cacheando su fondo estático, deteniendo el loop en pausa y aligerando las capas CSS que se componen sobre el canvas en `/games/[id]/jugar`, sin cambio visual perceptible.

---

## Por qué existe este spec

Frogger (`lib/games/frogger/engine.ts`) redibuja cada frame todo el escenario estático (5 zonas, líneas discontinuas con `setLineDash`, 5 bocas con `strokeRect` y glow) y sigue dibujando a 60 fps en pausa. Además, en toda página de juego hay capas globales caras que el navegador recompone sobre/bajo el canvas cada frame: la rejilla en perspectiva animada de `.av-bg::before` (animación de `background-position` + `transform` + `mask-image`) y el overlay `.crt-screen::after` con `mix-blend-mode: multiply`. Decisiones del usuario (no se reabren): solo Frogger en el motor; CSS global sí pero limitado a `/jugar`; aspecto idéntico o casi; solo técnica de fondo offscreen (sin sprites pre-renderizados, sin snap a píxel, sin refactor de asignaciones); verificación manual.

---

## Scope

**In:**

- `lib/games/frogger/engine.ts`:
  - Canvas offscreen por instancia (`document.createElement("canvas")`, 640×560) con el fondo estático: zonas (wall/river/safe/road), líneas discontinuas de carretera y bocas vacías (relleno + borde con glow de la skin). Se renderiza una vez al crear el motor (la skin es fija por instancia: cambiarla recrea el motor).
  - `draw()` empieza con un único `drawImage(bg, 0, 0)`; luego ranas en bocas ocupadas, entidades, rana, HUD interno y scanlines (sin cambios).
  - Loop: en pausa dibuja un frame y no pide más `requestAnimationFrame`; `resume()` lo relanza (ya llama a `startLoop()`); `pause()` cancela el rAF pendiente o deja que el siguiente tick termine sin re-pedir.
- `app/globals.css`, limitado a la página de juego con `body:has(.av-player)`:
  - `.av-bg::before`: `animation: none` (rejilla quieta).
  - `.crt-screen::after`: quitar `mix-blend-mode` (negro semitransparente sobre normal ≡ multiply; resultado visual idéntico).

**Out of scope:**

- Otros motores (asteroids, tetris, arkanoid, snake) → spec aparte si hace falta.
- Pre-render de sprites/glow de entidades (el `shadowBlur` por entidad en neón se mantiene).
- Snap a píxel entero, eliminación de asignaciones por frame, timestep fijo.
- `.av-noise`, `backdrop-filter` del nav, otras animaciones CSS fuera de `/jugar`.
- Contador de FPS, tests automatizados (no hay runner).
- Cambios en `GameEngineDef`, `GameEvents`, `GameController`, `GamePlayer`, `GameCanvas`.

---

## Data model

Sin estructuras nuevas de datos ni tipos públicos. Solo estado interno de la instancia:

```ts
// dentro de createFrogger
const bg: HTMLCanvasElement; // 640×560, fondo estático de la skin activa
function renderBackground(): void; // dibuja zonas, líneas y bocas en bg (una vez)
```

---

## Implementation plan

1. En `createFrogger`, crear `bg` y `renderBackground()` moviendo ahí el bloque "Zonas" y el bucle de bocas (relleno + `strokeRect` con glow) de `draw()`; llamarla una vez tras resolver la skin. Si `bg.getContext("2d")` falla, `draw()` cae al dibujo directo actual. Compila; mismo aspecto.
2. `draw()`: sustituir ese bloque por `c.drawImage(bg, 0, 0)` y dejar solo `if (goals[i]) drawFrog(...)` del bucle de bocas.
3. Loop: en `loop()`, si `paused`, dibujar y salir sin re-pedir rAF (igual que con `finished`). Confirmar que `pause()`/`resume()`/`restart()` siguen funcionando (resume → `startLoop()`; restart → `stopLoop` + `startLoop`).
4. `app/globals.css`: añadir reglas `body:has(.av-player) .av-bg::before { animation: none; }` y `body:has(.av-player) .crt-screen::after { mix-blend-mode: normal; }`.
5. Verificar manualmente (ver criterios) y `npm run lint` + `npm run build`.

---

## Acceptance criteria

- [ ] Frogger en las 3 skins (classic/neon/retro) se ve igual que antes: zonas, líneas discontinuas, bocas con su borde/glow, ranas en bocas ocupadas, entidades, HUD y scanlines retro.
- [ ] `draw()` de Frogger no contiene `setLineDash` ni dibujo de zonas; el fondo sale de un único `drawImage`.
- [ ] Con el juego en pausa, la pestaña Performance de DevTools no muestra frames de animación de Frogger (rAF detenido); al reanudar la partida continúa sin saltos de posición.
- [ ] `restart()`, game over, cambio de skin y desmontar la página siguen funcionando sin errores en consola.
- [ ] En `/games/frogger/jugar` la rejilla de fondo no se anima; en `/`, `/games` y demás rutas sigue animada.
- [ ] El overlay de scanlines del CRT se ve igual en `/jugar` (sin `mix-blend-mode`).
- [ ] Percepción manual: Frogger se juega fluido, sin tirones, en escritorio y en el móvil del usuario (incluida skin neón).
- [ ] Los otros 4 juegos siguen funcionando igual (solo les afecta el CSS de `/jugar`).
- [ ] `npm run lint` y `npm run build` pasan.

---

## Decisions

- **Sí:** solo Frogger en el motor. Es donde se reporta el problema; otros motores en spec aparte.
- **Sí:** fondo estático en canvas offscreen por instancia. Quita ~15 llamadas de dibujo + `setLineDash` + glow de bocas por frame sin cambio visual.
- **No:** sprites pre-renderizados de entidades/glow. Descartado por el usuario; si neón sigue con tirones, spec aparte.
- **No:** snap a píxel ni refactor de asignaciones por frame. Descartado por el usuario.
- **Sí:** detener rAF en pausa. Ahorra CPU/batería; reanudar ya pasa por `startLoop()` con `lastTime = null`.
- **Sí:** CSS limitado a `/jugar` vía `body:has(.av-player)`. Sin tocar layout ni JS; el resto del sitio conserva sus efectos.
- **Sí:** quitar `mix-blend-mode` del overlay CRT. Negro semitransparente en modo normal da el mismo resultado que multiply y evita componer el canvas con blend cada frame.
- **No:** quitar `.av-noise` ni `backdrop-filter` del nav. Son estáticos/no se recalculan cada frame del canvas; fuera de alcance.
- **No:** contador de FPS. El usuario verifica por percepción manual.

---

## Risks

| Riesgo                                                                   | Mitigación                                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Verificación solo perceptiva: puede no confirmarse la mejora             | Comparar antes/después en el mismo dispositivo y skin; si persiste, abrir spec de sprites pre-renderizados. |
| El cuello real es el `shadowBlur` por entidad en neón (fuera de alcance) | Criterio de percepción incluye neón; si falla, spec aparte.                                                 |
| `:has()` no soportado en navegadores antiguos                            | Degradación inocua: se mantienen los efectos actuales.                                                      |
| Pausa sin rAF deja un frame desactualizado                               | Dibujar un frame al pausar; `resume()` resetea `lastTime`.                                                  |

---

## What is **not** in this spec

- Optimización de asteroids, tetris, arkanoid y snake.
- Sprites/glow pre-renderizados, snap a píxel, timestep fijo.
- Contador de FPS o métricas automatizadas.

Cada uno, si llega, va en su propio spec.
