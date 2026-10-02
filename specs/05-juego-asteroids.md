# SPEC 05 — Primer juego real: ASTEROIDS (port a TS + canvas en React)

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-01
> **Objective:** Portar el juego `references/templates/started-games/02-asteroids/` a un motor TypeScript con canvas, montado en `/games/asteroids/jugar`, donde React controla HUD, pausa y guardado de puntaje y el canvas le notifica los eventos.

---

## Por qué existe este spec

Hoy `components/game-player.tsx` simula partidas (puntaje aleatorio). El usuario quiere el primer juego real: Asteroids ya existe como clon en canvas puro (`game.js`, 510 líneas, globals y `document.getElementById`). Hay que adaptarlo a la plataforma sin perder su jugabilidad (3 vidas, rocas que se parten, power-up de disparo triple) y conectarlo al HUD, la pausa y el modal de puntaje que ya existen.

Decisiones del usuario (no se reabren): port a TS + canvas en React; el canvas **notifica** a React; se mantienen **ambos HUDs** (el del canvas y el de la plataforma); game over y pausa son solo los de la plataforma; entrada **nueva** `asteroids` en el catálogo (no reemplaza a `rocas`); la pausa se maneja desde React con un controller y el botón PAUSA sigue funcionando.

---

## Scope

**In:**

- Motor del juego en `lib/games/asteroids/engine.ts` (port de `game.js`: `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, update/draw, colisiones, niveles). Sin globals de módulo: todo el estado vive dentro de `createAsteroids(...)`.
- API del motor: recibe `canvas` y callbacks de eventos, devuelve un `AsteroidsController` (`pause`, `resume`, `restart`, `destroy`).
- Componente cliente `components/games/asteroids-canvas.tsx` que crea el motor en `useEffect`, lo destruye al desmontar y lo expone a `GamePlayer`.
- `GamePlayer` usa el motor cuando `game.id === "asteroids"`; el resto de juegos conserva la simulación actual.
- HUD de React alimentado por el motor: jugador, puntuación, vidas, nivel y un stat extra `TRIPLE <s>s` visible solo mientras el power-up está activo.
- Pausa: botón PAUSA (y tecla `P`) llaman a `controller.pause()/resume()`; se muestra el overlay "EN PAUSA" ya existente. El motor no tiene lógica de pausa propia ni tecla de pausa.
- FIN (botón) detiene el motor y abre el modal; game over natural (0 vidas) abre el mismo modal vía `onGameOver`. "JUGAR DE NUEVO" llama a `controller.restart()`.
- Entrada nueva `asteroids` en `GAMES` (`lib/data.ts`) y clase `cover-asteroids` en `app/globals.css`.
- Escala del canvas por CSS dentro de `.crt-screen` manteniendo 4:3 (lógica interna 800×600).
- Controles solo teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar. Se evita el scroll de página con esas teclas mientras el juego está activo.
- Guardar puntaje con `saveScore({ game: "asteroids", … })` existente.

**Out of scope (para specs futuras):**

- Controles táctiles / móvil.
- Sonido y música.
- Puntajes en Supabase, ranking real, tabla `scores` (sigue `localStorage`).
- Juegos reales distintos de Asteroids (los demás siguen simulados).
- Rediseño visual del juego (look vectorial blanco/cian del original se conserva) y cambios de reglas/balance.
- OVNIs (la descripción de `rocas` los menciona; Asteroids original no los tiene).
- Tests automatizados (no hay runner).
- Eliminar o modificar la entrada `rocas`.
- Cargar el HTML/`game.js` original en `public/` o iframe.

---

## Data model

Entrada de catálogo (tipo `Game` existente, sin cambios de esquema):

```ts
// lib/data.ts (añadir a GAMES)
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Parte las rocas antes de que te alcancen.",
  long: "Pilota tu nave en un campo de asteroides sin bordes: lo que sale por un lado entra por el otro. Cada roca grande se parte en medianas y luego en pequeñas. Tienes 3 vidas; recoge el 3x para disparar triple.",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

API del motor:

```ts
// lib/games/asteroids/engine.ts
export type AsteroidsEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onTriple: (secondsLeft: number) => void; // 0 cuando no está activo
  onGameOver: (finalScore: number) => void;
};

export type AsteroidsController = {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia partida y reanuda
  destroy: () => void; // cancela rAF y quita listeners
};

export function createAsteroids(
  canvas: HTMLCanvasElement,
  events: AsteroidsEvents,
): AsteroidsController;
```

Convenciones:

- Constantes del original se conservan: canvas lógico 800×600, `RADII/SPEEDS/POINTS` por tamaño, `POWERUP_*`, `TRIPLE_SPREAD`, `dt` capado a 50 ms.
- Los eventos se emiten **solo al cambiar el valor** (nunca por frame), excepto `onTriple`, que se emite al activarse, al cambiar el segundo mostrado (1 decimal, máx. ~10 Hz) y con `0` al expirar o reiniciar.
- Al emitir `onGameOver` el motor deja de actualizar y de reaccionar a `Space` (el original reiniciaba con Espacio; ahora reinicia React). El último frame queda en el canvas.
- El motor ignora `keydown`/`keyup` cuyo `event.target` sea `input`, `textarea` o `select` (el modal pide iniciales y se teclea Espacio ahí). Llama a `preventDefault()` en `ArrowLeft/Right/Up` y `Space` solo mientras corre y no está pausado.
- Al pausar, al perder foco (`blur`) y al `destroy` se limpia el mapa de teclas (evita "tecla pegada"). Al reanudar se reinicia `lastTime` para que `dt` no salte.
- `destroy()` es idempotente y seguro en StrictMode (doble montaje).
- Doble HUD: se conserva `drawHUD` del canvas (SCORE, NIVEL, vidas, contador `3x`) además del HUD de React. Solo se eliminan del canvas el overlay `GAME OVER … ESPACIO PARA REINICIAR` y cualquier indicación de pausa; game over y pausa los muestra únicamente la aplicación (modal "FIN DEL JUEGO" y overlay "EN PAUSA"). El icono `3x` del power-up también se conserva.
- Escala: `canvas { width: 100%; aspect-ratio: 4 / 3; max-width: 800px; }`; los atributos `width/height` del canvas siguen en 800/600.
- El cambio de nivel y el score en `GamePlayer` vienen del motor; los efectos decorativos (`setInterval` de puntaje falso y `setLevel` por módulo) se desactivan para `asteroids`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` (Client Components, `use client`, `useEffect`) según `AGENTS.md` y repasar `components/game-player.tsx`. Añadir la entrada `asteroids` en `lib/data.ts` y `.cover-asteroids` en `app/globals.css`. Verificar: `/games` muestra la tarjeta nueva con cover y `/games/asteroids` carga; `npm run build` compila.
2. Crear `lib/games/asteroids/engine.ts`: portar clases, constantes y utilidades sin globals; `createAsteroids` con loop `requestAnimationFrame`, input, `initGame/nextLevel/killShip`, callbacks de eventos y `AsteroidsController`. Se conserva `drawHUD`; se elimina el overlay de game over. Verificar: `npm run build` y `npm run lint` pasan (sin `any` implícitos).
3. Crear `components/games/asteroids-canvas.tsx` (`"use client"`): `<canvas width={800} height={600}>` con ref, `useEffect` que llama `createAsteroids` y devuelve `destroy`; expone el controller a `GamePlayer` (callback `onReady(controller)` o `ref`). Verificar: build compila.
4. Integrar en `GamePlayer`: para `game.id === "asteroids"` renderizar `AsteroidsCanvas` en `.crt-screen` en lugar de `.game-arena`; conectar `onScore/onLives/onLevel/onTriple/onGameOver` a los estados del HUD; agregar stat `TRIPLE` condicional; desactivar `setInterval`/nivel decorativo; el botón PAUSA llama `controller.pause()/resume()`, la tecla `P` hace lo mismo (listener de React, ignorando `input`); FIN llama `controller.pause()` y abre el modal; `restart` llama `controller.restart()` y limpia `saved`/`over`. Verificar: se juega, el HUD cambia y la pausa congela el juego.
5. Estilos: escala 4:3 del canvas dentro de `.crt-screen` (clase en `globals.css` junto a las `av-*`), overlay "EN PAUSA" por encima del canvas. Verificar visualmente en 1280 px y 375 px que el canvas no desborda.
6. Verificación final en navegador (Playwright o manual): partida completa hasta 0 vidas, guardar puntaje, `/salon`; confirmar que otros juegos (`/games/rocas/jugar`) siguen simulados; `npm run lint` y `npm run build`. Actualizar `CLAUDE.md` (Architecture): motor real en `lib/games/asteroids/`, patrón `createX(canvas, events) → controller`, y que `GamePlayer` solo simula los demás juegos.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `GAMES` contiene `asteroids` (ASTEROIDS, SHOOTER, `cyan`, `cover-asteroids`) y `rocas` sigue intacto; `/games` y `/games/asteroids` muestran la tarjeta/ficha sin errores.
- [ ] `/games/asteroids/jugar` muestra el canvas dentro del CRT, escalado a 4:3 sin desborde horizontal a 375 px y a 1280 px.
- [ ] `←` `→` rotan, `↑` propulsa y `Espacio` dispara; las flechas y el espacio no hacen scroll de la página durante la partida.
- [ ] Destruir una roca grande suma 20, mediana 50 y pequeña 100, y el HUD de React refleja el puntaje en el mismo instante visible del juego.
- [ ] Empieza con 3 vidas; perder una resta un corazón del HUD y la nave reaparece con invencibilidad; al llegar a 0 aparece el modal "FIN DEL JUEGO" con el puntaje final correcto.
- [ ] Limpiar todas las rocas sube el nivel y el HUD muestra el nuevo valor.
- [ ] Al recoger el power-up `3x` aparece el stat `TRIPLE` con cuenta regresiva y desaparece al expirar.
- [ ] El botón PAUSA congela por completo juego (rocas, balas, power-ups, timers) y la tecla `P` hace lo mismo; REANUDAR continúa sin salto de movimiento. Mientras está pausado, `Espacio`/flechas no disparan ni giran la nave.
- [ ] El botón FIN detiene el motor y abre el modal con el puntaje actual.
- [ ] Teclear iniciales (incluido Espacio) en el input del modal no dispara ni mueve la nave.
- [ ] "GUARDAR PUNTUACIÓN" guarda `{ game: "asteroids", score, name }` en `av_scores`; no hay doble guardado tras guardar.
- [ ] "JUGAR DE NUEVO" empieza una partida limpia (puntaje 0, 3 vidas, nivel 1, sin power-up activo) y el juego responde al teclado.
- [ ] Salir de la ruta o desmontar el componente cancela el `requestAnimationFrame` y quita los listeners (sin trabajo en segundo plano ni errores en consola); en `next dev` con StrictMode no hay dos loops simultáneos.
- [ ] `/games/rocas/jugar` y los demás juegos conservan el comportamiento simulado.
- [ ] La consola no muestra errores ni warnings de hydration en `/games/asteroids/jugar`.
- [ ] `CLAUDE.md` documenta el motor y el patrón controller/eventos.

---

## Decisions

- **Sí:** port a TS + canvas en React. Decisión del usuario; permite HUD, pausa y puntaje de la plataforma. **No:** iframe o `next/script` con `game.js` global (puente frágil, estado global, doble estilo).
- **Sí:** el canvas notifica a React por callbacks (`onScore`, `onLives`, …). Decisión del usuario; React es la fuente de verdad del HUD y del modal.
- **Sí:** mantener ambos HUDs (canvas y plataforma). Decisión del usuario; el HUD del canvas conserva el look original y el de React es el de la app. Ambos se alimentan del mismo estado del motor, por lo que no se desincronizan. **Sí:** game over y pausa solo en la app. **No:** overlay de game over ni de pausa dentro del canvas.
- **Sí:** pausa controlada por React mediante un `AsteroidsController` (`pause/resume`), con el botón PAUSA existente funcionando. Interpretación de la respuesta del usuario ("que reaccione con controller realmente … y que el botón siga funcionando"): el botón no cambia solo un estado visual, invoca el controller del motor. **Sí:** tecla `P` como atajo desde React (el motor sigue sin lógica de pausa). Si el usuario no la quiere, quitar el listener de `P`.
- **Sí:** entrada nueva `asteroids` en el catálogo. Decisión del usuario. **No:** reemplazar `rocas`, que sigue siendo simulado y se retirará o convertirá en otro spec.
- **Sí:** emitir eventos solo al cambiar el valor. Evita re-renderizar React a 60 fps.
- **Sí:** al terminar la partida el reinicio lo hace React (modal). **No:** conservar "Espacio para reiniciar" del original (chocaría con el input del modal).
- **Sí:** el motor ignora teclas con foco en `input/textarea/select`. Sin esto, escribir iniciales con Espacio dispararía.
- **Sí:** solo teclado y escala por CSS 4:3 con lógica 800×600. Controles táctiles van en spec propio.
- **Sí:** `best: 0`, `plays: "0"` para la entrada nueva (mock). Los rankings de `/salon` y de la ficha siguen siendo `seededScores`; el ranking real llega con Supabase.
- **Sí:** el look vectorial original (trazos blancos/cian sobre negro) se conserva; el CRT de la plataforma lo enmarca. **No:** repintar con la paleta neón en este spec.
- **No:** tests automatizados; no hay runner. La verificación es manual/Playwright.

---

## Risks

| Risk                                                                                        | Mitigation                                                                                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Doble loop o listeners duplicados por StrictMode / re-render.                               | `createAsteroids` solo se llama en `useEffect` con `[]` y `destroy` idempotente; criterio de aceptación lo verifica.              |
| Re-renders excesivos del `GamePlayer` por eventos del motor.                                | Emitir solo en cambios; `onTriple` limitado a ~10 Hz.                                                                             |
| Capturas de teclado interfieren con el input del modal o con el resto de la página.         | Ignorar `input/textarea/select`; `preventDefault` solo con el juego activo y sin pausa.                                           |
| `dt` enorme tras pausar o cambiar de pestaña.                                               | Reiniciar `lastTime` al reanudar; mantener cap de 50 ms.                                                                          |
| Estado `over` de React y `gameover` del motor se desincronizan (FIN vs 0 vidas).            | FIN detiene el motor explícitamente; `onGameOver` es la única vía natural; `restart` resetea ambos.                               |
| El lint de React 19 (`react-hooks/set-state-in-effect`, refs) rechaza el patrón de montaje. | Crear el motor en `useEffect`, setear estado solo desde callbacks; ajustar el diseño del componente antes que silenciar la regla. |
| Next 16 difiere del conocimiento previo.                                                    | Paso 1 consulta `node_modules/next/dist/docs/` (ver `AGENTS.md`).                                                                 |
| Canvas borroso al escalar por CSS en pantallas HiDPI.                                       | Aceptado en este spec; mejora de `devicePixelRatio` en un spec futuro.                                                            |

---

## What is **not** in this spec

- Controles táctiles y móvil.
- Sonido y música.
- Puntajes/rankings reales y Supabase.
- Otros juegos reales; cambios en `rocas`.
- OVNIs, nuevas mecánicas o rebalanceo.
- Rediseño visual neón del juego.
- Soporte HiDPI.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
