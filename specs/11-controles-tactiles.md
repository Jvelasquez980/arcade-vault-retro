# SPEC 11 — Controles táctiles para jugar en móvil

> **Status:** Aprovado
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-10-14
> **Objective:** Añadir un gamepad virtual genérico, visible solo con puntero táctil y escalado al ancho de pantalla, que traduce toques a teclas sintéticas para jugar los 4 juegos en móvil vertical.

---

## Por qué existe este spec

Los 4 motores (`asteroids`, `tetris`, `arkanoid`, `snake`) solo escuchan `keydown`/`keyup` en `window`; en un móvil no hay forma de jugar. Decisión clave: **no tocar la lógica de los motores**. Un componente React despacha `KeyboardEvent` sintéticos a `window` con el mismo `key` y `code` que el teclado real, así los motores no distinguen el origen. Cada motor solo declara qué botones necesita.

Decisiones del usuario (no se reabren): gamepad virtual (no gestos), teclas sintéticas (no API nueva en `GameController`), mapa en un campo `touch` de `GameEngineDef`, visible solo con `(pointer: coarse)`, tamaño de botón por `clamp()` según ancho, auto-repeat por botón, layout vertical con el gamepad **debajo** del canvas, bloqueo de scroll/zoom en el gamepad y canvas + gamepad caben en el alto del viewport.

---

## Scope

**In:**

- Tipo `TouchConfig` y campo opcional `touch?: TouchConfig` en `GameEngineDef` (`lib/games/types.ts`).
- Campo `touch` en los 4 `engine.ts` (solo el objeto de config; sin cambios de lógica).
- Componente `components/games/touch-pad.tsx` (Client Component): D-pad a la izquierda, botones de acción a la derecha.
- Despacho de eventos: `pointerdown` → `keydown`, `pointerup`/`pointercancel`/`pointerleave` → `keyup`, a `window`, con `key` y `code` correctos. Pointer capture por botón; multitouch (D-pad + acción a la vez).
- Auto-repeat en botones con `repeat: true`: tras 250 ms reenvía `keydown` cada 120 ms hasta soltar.
- Al desmontar el componente, en `blur` de ventana o al pausar/terminar: `keyup` de toda tecla pulsada (sin teclas atascadas).
- Montaje en `components/game-player.tsx`, debajo de `.crt`, solo si `def.touch` existe.
- CSS en `app/globals.css` (clases `av-touchpad*`):
  - Oculto por defecto; visible con `@media (pointer: coarse)`.
  - Tamaño de botón `clamp(48px, 14vw, 72px)`.
  - `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`; `contextmenu` cancelado.
  - En `(pointer: coarse)`: alto máximo del CRT limitado con `dvh` para que canvas + gamepad quepan en el viewport vertical sin scroll (el ancho se ajusta por `--game-ar`).
  - Estado pulsado visible (`.pressed`) con los tokens neón existentes.
- Actualizar `CLAUDE.md` (mención del gamepad y del campo `touch`).

**Out of scope (para specs futuras):**

- Gestos (swipe en snake/tetris, arrastrar en arkanoid, tap en el canvas).
- Layout horizontal optimizado (funciona, pero sin colocar controles a los lados).
- Overlay de botones sobre el canvas.
- Toggle manual para mostrar/ocultar el gamepad.
- HUD compacto y ocultar `.crt-bottom` en móvil.
- Pantalla completa, bloqueo de orientación, vibración (haptics).
- Canvas HiDPI (`devicePixelRatio`).
- Nuevo método en `GameController` o cambios en `GameEvents`.
- Cambios en Supabase.
- Tests automatizados (no hay runner).

---

## Data model

```ts
// lib/games/types.ts
export type TouchButton = {
  key: string;      // KeyboardEvent.key, p. ej. "ArrowLeft", " "
  code: string;     // KeyboardEvent.code, p. ej. "ArrowLeft", "Space"
  label: string;    // texto/glifo del botón: "◀", "DISPARO"
  repeat?: boolean; // auto-repeat mientras se mantiene
};

export type TouchConfig = {
  dpad: { up?: TouchButton; down?: TouchButton; left?: TouchButton; right?: TouchButton };
  actions?: TouchButton[]; // 0–2 botones a la derecha
};

// GameEngineDef gana:
touch?: TouchConfig; // si falta, no se muestra gamepad
```

Mapa por juego (los motores leen `e.key` o `e.code` según el caso; por eso se envían ambos):

| Juego | D-pad | Acciones |
| --- | --- | --- |
| `asteroids` | ← → (girar), ↑ (empuje) | `Space` "DISPARO" |
| `tetris` | ← → ↓ con `repeat`, ↑ (girar) | `Space` "CAÍDA" |
| `arkanoid` | ← → | — |
| `snake` | ← ↑ → ↓ | — |

Evento sintético: `new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true })` despachado en `window`.

---

## Implementation plan

1. Añadir `TouchButton`, `TouchConfig` y `touch?` a `lib/games/types.ts`. Compila sin cambios de comportamiento.
2. Crear `components/games/touch-pad.tsx` con render del D-pad/acciones y despacho `keydown`/`keyup` (sin repeat). Props: `config: TouchConfig`, `disabled: boolean`.
3. Añadir auto-repeat por botón y liberación de todas las teclas al desmontar, en `blur` y cuando `disabled` pasa a `true`.
4. Añadir CSS `av-touchpad*` en `app/globals.css` (oculto salvo `pointer: coarse`, `clamp()`, `touch-action`, `.pressed`).
5. Montar `<TouchPad>` en `components/game-player.tsx` bajo `.crt` si `def?.touch`; `disabled = paused || over`.
6. Añadir `touch` a `snakeDef` y verificar en Chrome DevTools (emulación táctil, móvil vertical).
7. Añadir `touch` a `arkanoidDef`, `asteroidsDef` y `tetrisDef`; verificar cada uno.
8. Limitar alto del CRT en `(pointer: coarse)` con `dvh` para que canvas + gamepad quepan sin scroll.
9. Actualizar `CLAUDE.md`.

---

## Acceptance criteria

- [ ] En escritorio (puntero fino) el gamepad no aparece en ningún juego.
- [ ] Con emulación táctil (DevTools, 390×844) el gamepad aparece bajo el canvas en los 4 juegos.
- [ ] En 390×844, canvas + gamepad se ven completos sin hacer scroll vertical.
- [ ] Los botones miden 48 px a 340 px de ancho y no superan 72 px en una tablet de 768 px.
- [ ] Snake: los 4 botones del D-pad giran la serpiente.
- [ ] Arkanoid: mantener ◀/▶ mueve la paleta de forma continua; al soltar se detiene.
- [ ] Asteroids: ↑ empuja mientras se mantiene, ◀/▶ giran y DISPARO dispara.
- [ ] Tetris: ◀/▶/▼ mantenidos repiten el movimiento; ↑ gira; CAÍDA hace caída instantánea.
- [ ] Mantener ◀ y pulsar DISPARO a la vez funciona (multitouch).
- [ ] Deslizar el dedo fuera de un botón lo libera (no queda tecla atascada).
- [ ] Tocar el gamepad no hace scroll, zoom ni abre menú contextual o selección de texto.
- [ ] Con el juego en pausa o el modal de fin abierto, el gamepad no envía teclas.
- [ ] El teclado sigue funcionando igual en escritorio en los 4 juegos.
- [ ] `npm run lint` y `npm run build` pasan sin errores.

---

## Decisions

- **Sí:** gamepad virtual genérico. Un componente sirve para los 4 juegos y los futuros.
- **No:** gestos por juego. 4 implementaciones distintas; posible spec futuro.
- **Sí:** teclas sintéticas a `window`. Los motores no cambian su lógica.
- **No:** `press(action, down)` en `GameController`. Obliga a tocar los 4 motores y el contrato.
- **Sí:** enviar `key` y `code` en cada evento. Asteroids/tetris leen `code`; snake/arkanoid leen `key`.
- **Sí:** mapa en `GameEngineDef.touch`. Sigue el patrón de `stats`/`initialLives`; cada juego declara lo suyo.
- **No:** archivo `lib/games/touch.ts` aparte. Separa la config del motor que la define.
- **Sí:** visibilidad por `@media (pointer: coarse)` en CSS. Sin JS ni problemas de hidratación.
- **No:** toggle manual ni visibilidad por ancho. Un portátil táctil estrecho no lo necesita; un escritorio pequeño no lo quiere.
- **Sí:** `clamp(48px, 14vw, 72px)`. 48 px es el objetivo táctil mínimo; escala con el ancho.
- **Sí:** auto-repeat solo en botones marcados. Tetris lo necesita; asteroids/arkanoid usan estado `keydown`/`keyup`.
- **Sí:** gamepad debajo del canvas, vertical. No tapa el juego.
- **No:** overlay ni layout horizontal optimizado. Fuera de este spec.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Tecla atascada si se pierde `pointerup` | Pointer capture + `keyup` en `pointercancel`/`pointerleave`/`blur`/desmontaje. |
| Un motor futuro filtra `e.isTrusted` | Documentado en `CLAUDE.md`: los motores no deben filtrar `isTrusted`. |
| iOS Safari hace zoom por doble toque | `touch-action: none` en el gamepad y `manipulation` en el contenedor del player. |
| `dvh` no soportado en navegadores viejos | Fallback a `vh` declarado antes. |

---

## What is **not** in this spec

- Gestos, overlay sobre el canvas, layout horizontal optimizado.
- Toggle manual del gamepad, HUD compacto.
- Pantalla completa, vibración, HiDPI.
- Cambios en `GameController`, `GameEvents` o Supabase.

Cada uno, si llega, va en su propio spec.
