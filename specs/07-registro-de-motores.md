# SPEC 07 — Registro de motores y `GamePlayer` genérico

> **Status:** Aprovado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-07
> **Objective:** Generalizar `GamePlayer` y `/games/[id]/jugar` con un contrato común de motor y un registro por id, para que añadir un juego sea registrar su motor sin tocar el reproductor.

---

## Por qué existe este spec

SPEC 05 y 06 dejaron `GamePlayer` acoplado a Asteroids (`AsteroidsCanvas`, `AsteroidsEvents`, stat `TRIPLE`) y `/jugar` con `game.id !== "asteroids"` → 404. Se van a integrar Tetris y Arkanoid (`references/templates/started-games/`). SPEC 06 difirió la abstracción hasta tener un segundo motor real; este spec la introduce antes de portarlos, con Asteroids como único consumidor para validar que no hay regresión.

Decisiones del usuario (no se reabren):

- Spec previo único para el registro; cada juego nuevo se integra luego con el skill `/integrar-juego`.
- HUD común + stats extra declarados por juego.
- Assets de juegos en `public/games/<id>/`.

---

## Scope

**In:**

- `lib/games/types.ts`: `GameEvents`, `GameController`, `GameEngineDef`, `ExtraStat`.
- `lib/games/registry.ts`: `ENGINES` (id → carga dinámica del `GameEngineDef`) y `hasEngine(id)`.
- Adaptar `lib/games/asteroids/engine.ts` al contrato (exporta `asteroidsDef`; `createAsteroids` conserva su comportamiento; `onTriple` pasa a `onStat("triple", v)`).
- `components/games/game-canvas.tsx` genérico (reemplaza `asteroids-canvas.tsx`, mismo patrón refs + `useEffect` + `destroy`).
- `GamePlayer` genérico: HUD base (jugador, puntuación) más vidas y nivel solo si el motor los emite, y stats extra declarados por el def.
- `/games/[id]/jugar`: 404 si el id no está en el registro.
- Clase `.game-canvas` en `app/globals.css` con `aspect-ratio` por variable CSS (`--game-ar`) en lugar de `.asteroids-canvas` fijo 4:3.
- Actualizar `CLAUDE.md` (Architecture y "Añadir un juego").

**Out of scope (para specs futuras):**

- Cualquier juego nuevo (Tetris, Arkanoid: un spec cada uno vía `/integrar-juego`).
- Controles táctiles, sonido global, HiDPI.
- Cambios de esquema en Supabase (`games`/`scores` ya sirven para cualquier juego).
- Cambios en la jugabilidad de Asteroids.
- Tests automatizados (no hay runner).

---

## Data model

```ts
// lib/games/types.ts
export type ExtraStat = {
  key: string;
  label: string;
  color?: "cyan" | "magenta" | "yellow" | "green";
  format?: "int" | "seconds"; // "seconds" = toFixed(1) + "s"
};

export type GameEvents = {
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  /** Stat extra; value null/0 oculta el stat. */
  onStat?: (key: string, value: number | null) => void;
};

export type GameController = {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia partida y reanuda
  destroy: () => void; // idempotente
};

export type GameEngineDef = {
  width: number; // tamaño lógico del canvas
  height: number;
  initialLives?: number; // si falta, no se muestra HUD de vidas
  showLevel?: boolean; // por defecto false
  stats?: ExtraStat[];
  create: (canvas: HTMLCanvasElement, events: GameEvents) => GameController;
};

// lib/games/registry.ts
export const ENGINES: Record<string, () => Promise<GameEngineDef>> = {
  asteroids: () => import("./asteroids/engine").then((m) => m.asteroidsDef),
};
export const hasEngine = (id: string) => id in ENGINES;
```

Convenciones:

- Los eventos se emiten solo al cambiar el valor (igual que SPEC 05).
- `registry.ts` no importa nada de servidor: lo usan Server Components (`hasEngine`) y el cliente (carga del def).
- `GamePlayer` recibe `game` y carga el def con `ENGINES[game.id]()`; mientras carga muestra el CRT vacío (sin layout shift: el canvas reserva `aspect-ratio`).
- Stat extra visible solo si `onStat(key, v)` con `v` truthy; formato `toFixed(1)` + `s` se decide en el def vía `label` (el formato numérico por defecto es entero; Asteroids usa `TRIPLE` con 1 decimal → `ExtraStat.format?: "int" | "seconds"`).
- Un juego nuevo requiere: clase `cover-*`, migración `insert` en `games` (`published=false` hasta tener motor), entrada en `ENGINES`, `lib/games/<id>/engine.ts`.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` (Client Components, `next/dynamic`/import dinámico) según `AGENTS.md`. Crear `lib/games/types.ts` y `registry.ts` con solo Asteroids. Verificar: `npm run lint`.
2. Adaptar el motor de Asteroids: exportar `asteroidsDef`, `onTriple` → `onStat("triple", v)`. Verificar: build compila.
3. Crear `components/games/game-canvas.tsx` genérico y la clase `.game-canvas`; borrar `asteroids-canvas.tsx` y `.asteroids-canvas`. Verificar: build.
4. Generalizar `GamePlayer` (HUD condicional, stats extra, def cargado por id). Verificar en `/games/asteroids/jugar`: HUD, `TRIPLE`, pausa (botón y `P`), FIN, modal, guardado, "JUGAR DE NUEVO".
5. `/jugar/page.tsx`: 404 con `!hasEngine(id)`. Verificar: id de juego sin motor → 404.
6. Actualizar `CLAUDE.md`; `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/games/asteroids/jugar` se comporta igual que en SPEC 05/06: HUD, `TRIPLE` con cuenta regresiva, pausa (botón y `P`), FIN, modal, guardado en `scores`, "JUGAR DE NUEVO".
- [ ] Un id existente en `games` pero sin entrada en `ENGINES` responde 404 en `/jugar`.
- [ ] `GamePlayer` no importa nada de `lib/games/asteroids/`.
- [ ] No existen `components/games/asteroids-canvas.tsx` ni `.asteroids-canvas`.
- [ ] Un motor que no emite `onLives`/`onLevel` no muestra esos stats en el HUD.
- [ ] Salir de la ruta cancela rAF y listeners; sin dos loops en StrictMode.
- [ ] Sin errores ni warnings de hydration en `/games/asteroids/jugar`.
- [ ] `CLAUDE.md` documenta el contrato, el registro y los pasos para añadir un juego.

---

## Decisions

- **Sí:** registro con import dinámico: el bundle de `/jugar` no carga motores de otros juegos. **No:** `switch` por id dentro de `GamePlayer` (vuelve a acoplarlo).
- **Sí:** contrato mínimo `onScore/onGameOver` y el resto opcional: Tetris no tiene vidas, Arkanoid sí. **No:** HUD fijo con campos vacíos.
- **Sí:** stats extra declarativos (`stats` + `onStat`). **No:** un callback por stat (`onTriple`, `onLines`…) que obliga a editar `GamePlayer` por juego.
- **Sí:** `width`/`height` en el def y `aspect-ratio` por variable CSS (Tetris es vertical 1:2, no 4:3).
- **Sí:** mantener `lib/catalog.ts` y el esquema SPEC 06 sin cambios.
- **No:** tests automatizados; verificación manual/Playwright.

---

## Risks

| Risk                                                             | Mitigation                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Regresión en Asteroids al refactorizar el reproductor.           | Paso 4 verifica el flujo completo antes de seguir; criterio de aceptación de no regresión. |
| Carga asíncrona del def provoca flash o doble montaje del motor. | `GameCanvas` monta solo con def resuelto; `destroy` idempotente; canvas reserva espacio.   |
| Lint de React 19 (`set-state-in-effect`) con la carga del def.   | Cargar en el efecto y setear estado desde la promesa/callback; no silenciar la regla.      |
| Next 16 difiere del conocimiento previo.                         | Paso 1 consulta `node_modules/next/dist/docs/`.                                            |

---

## What is **not** in this spec

- Juegos nuevos, sonido, táctil, HiDPI, cambios de esquema, tests.

Cada uno, si llega, va en su propio spec.
