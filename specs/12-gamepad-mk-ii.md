# SPEC 12 — Gamepad MK-II en todos los juegos

> **Status:** Implementado
> **Depends on:** SPEC 11
> **Date:** 2026-10-14
> **Objective:** Rediseñar el gamepad táctil de SPEC 11 con el diseño MK-II (`references/gamepad-assets/`) —D-pad en cruz con hub y botones redondos A/B— coloreado según la skin activa, en los 4 juegos.

---

## Por qué existe este spec

El gamepad de SPEC 11 funciona pero es genérico (botones cuadrados con glifos). Hay un diseño de referencia (`gamepad.html`, `gamepad-neon.png`) con carcasa, D-pad en cruz con gema central y botones A/B redondos con glow. Decisión clave: **solo cambia la presentación**. El despacho de teclas sintéticas, auto-repeat, multitouch, liberación de teclas, visibilidad `(pointer: coarse)` y `TouchConfig` se mantienen.

Decisiones del usuario (no se reabren): solo táctil; A y B siempre visibles (no mapeados atenuados); letra A/B + nombre de acción pequeño; cruz completa con flechas no usadas atenuadas; `actions[0]→A`, `actions[1]→B`; flechas SVG del diseño; escalado con `clamp()`; colores por skin con paleta global (los 4 juegos tienen skins); cambio de skin solo por CSS.

---

## Scope

**In:**

- Reescribir el markup de `components/games/touch-pad.tsx` según `gamepad.html`:
  - Carcasa `.av-gp` (gradiente, borde, `::before` interior, `::after` trama de puntos).
  - D-pad: 4 botones `.av-gp-dp` (up/right/down/left) con SVG triangular del diseño + hub `.av-gp-hub` con gema pulsante. Dirección sin `TouchButton` → botón `disabled`, atenuado, sin handlers.
  - Acciones: B (izq.) y A (der.) siempre renderizados, redondos, con `.av-gp-ring`, letra en `--pixel` y debajo el `label` de la acción en texto pequeño. A = `actions[0]`, B = `actions[1]`; sin acción → `disabled` atenuado, sin label.
  - `aria-label` de cada botón: `label` del `TouchButton` (o dirección/letra si no hay).
  - Estado pulsado = clase `.on` (reemplaza `.pressed`).
- Prop nueva `skin: SkinId` en `TouchPad` → atributo `data-skin` en `.av-gp`. `GamePlayer` pasa su `skin` (los 4 juegos tienen skins; `classic` por defecto).
- CSS en `app/globals.css`: reemplazar el bloque `av-touchpad*` por `av-gp*`:
  - Oculto por defecto; visible con `@media (pointer: coarse)` (igual que SPEC 11).
  - Tamaños: `--tp-btn: clamp(48px, 14vw, 72px)` para cada flecha y hub; A/B `calc(var(--tp-btn) * 1.35)`; carcasa al 100 % del ancho del player.
  - Se conservan `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent` y el límite `dvh` del `.crt-screen`.
  - Variables por skin en `.av-gp[data-skin="…"]`: `--gp-dp` (color activo D-pad/gema), `--gp-a`, `--gp-b` (+ mid/deep/glow derivados), `--gp-glow` (intensidad), radios.
- Actualizar `CLAUDE.md` (gamepad MK-II, clases `av-gp*`, `data-skin`; corregir la línea de skins: hoy los 4 juegos tienen skins, no solo `asteroids`/`tetris`).

**Out of scope:**

- Mostrarlo en escritorio, toggle manual, iluminar botones con teclado real.
- Nuevas acciones (B sigue sin mapear en los 4 juegos actuales).
- Cambios en `TouchConfig`/`TouchButton`, `GameController`, `GameEvents` o los motores.
- Paletas de gamepad por juego.
- Layout horizontal, overlay sobre el canvas, haptics.
- Tests automatizados (no hay runner).

---

## Data model

Sin estructuras nuevas de datos. Cambios de tipos mínimos:

```ts
// components/games/touch-pad.tsx
type Props = {
  config: TouchConfig;  // sin cambios (SPEC 11)
  disabled: boolean;
  skin: SkinId;         // nuevo → data-skin
};
```

Mapeo: `dpad.up/right/down/left` → flechas; `actions[0]` → A; `actions[1]` → B. El `label` del D-pad pasa a ser solo `aria-label`.

Paletas (globales, en CSS):

| Skin | D-pad activo / gema | A | B | Estilo |
| --- | --- | --- | --- | --- |
| `classic` | cian `#00f5ff` | magenta `#ff006e` | cian `#00f5ff` | Diseño MK-II tal cual |
| `neon` | cian `#00f5ff`, glow mayor | amarillo `#f5ff00` | verde `#00ff88` | Más blur/glow |
| `retro` | fósforo `#33ff33` | ámbar `#ffb000` | fósforo `#33ff33` | Sin glow, radios duros, gema sin animación |

---

## Implementation plan

1. Añadir prop `skin` a `TouchPad` y pasarla desde `components/game-player.tsx`. Compila; sin cambio visual.
2. Reescribir el JSX de `TouchPad` con la estructura MK-II (carcasa, cruz con hub, B/A con ring/letra/label), reutilizando `press/release/move/releaseAll` intactos; clase `.on` para pulsado; direcciones/acciones ausentes como `disabled`.
3. Reemplazar el CSS `av-touchpad*` por `av-gp*` portado de `gamepad.html` con tokens del proyecto (`--cyan`, `--magenta`, `--pixel`) y tamaños con `--tp-btn`.
4. Añadir variables por `data-skin` (classic/neon/retro) según la tabla.
5. Verificar en DevTools (emulación táctil 390×844 y 340 px) los 4 juegos con las 3 skins cada uno.
6. Actualizar `CLAUDE.md`.

---

## Acceptance criteria

- [ ] En escritorio (puntero fino) el gamepad no aparece.
- [ ] Con emulación táctil 390×844 los 4 juegos muestran la carcasa MK-II bajo el canvas; canvas + gamepad sin scroll vertical.
- [ ] La cruz del D-pad siempre muestra 4 flechas SVG + hub con gema; en arkanoid ▲/▼ están atenuadas y no envían teclas.
- [ ] A y B siempre visibles; asteroids: A = DISPARO, tetris: A = CAÍDA; B atenuado y sin efecto en los 4 juegos; arkanoid/snake con A y B atenuados.
- [ ] Bajo la letra A aparece el nombre de la acción (DISPARO/CAÍDA).
- [ ] Pulsar un botón muestra el estado `.on` (hundido + glow) y se apaga al soltar.
- [ ] Todo el comportamiento de SPEC 11 se mantiene: auto-repeat en tetris, multitouch, sin teclas atascadas, sin scroll/zoom/menú, sin teclas en pausa o fin.
- [ ] En los 4 juegos, cambiar skin cambia los colores del gamepad (classic/neon/retro según la tabla).
- [ ] A 340 px de ancho los botones del D-pad miden 48 px y nada desborda horizontalmente.
- [ ] `npm run lint` y `npm run build` pasan.

---

## Decisions

- **Sí:** solo presentación; lógica de `TouchPad` y `TouchConfig` intactas. Menor riesgo, motores sin tocar.
- **Sí:** solo `(pointer: coarse)`. Igual que SPEC 11.
- **No:** gamepad en escritorio. El teclado basta; sería decorativo.
- **Sí:** A y B siempre visibles, no mapeados atenuados. Fiel al diseño, layout estable entre juegos.
- **Sí:** `actions[0]→A`, `actions[1]→B`. Sin cambiar tipos ni los 4 `engine.ts`.
- **No:** campos explícitos `a`/`b` en `TouchConfig`. Toca contrato y motores sin beneficio hoy.
- **Sí:** letra A/B + label pequeño. Fiel al diseño sin perder qué hace cada botón.
- **Sí:** cruz completa con flechas no usadas atenuadas. El diseño es una cruz; ocultar rompe la forma.
- **Sí:** flechas SVG del diseño; `label` del D-pad solo como `aria-label`.
- **Sí:** `clamp(48px, 14vw, 72px)`. Mantiene objetivo táctil mínimo y cabe en 340 px.
- **No:** medidas fijas del diseño. No garantizan caber en pantallas estrechas.
- **Sí:** colores por skin con paleta global en CSS (`data-skin`). Un solo lugar, sin JS.
- **No:** paleta por juego desde `skins.ts`. Más acoplado.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| A/B de 1.35× no caben junto al D-pad en 340 px | Gap y padding de carcasa reducidos bajo 620 px (como el diseño); verificar a 340 px. |
| `.on` y `disabled` se confunden visualmente | `disabled` con opacidad baja y sin glow; `.on` con glow fuerte. |
| Animación de la gema distrae o consume batería | `prefers-reduced-motion` la desactiva; retro sin animación. |
| Renombrar `av-touchpad*` deja CSS huérfano | Eliminar el bloque viejo completo en el mismo paso. |

---

## What is **not** in this spec

- Gamepad en escritorio, toggle, eco de teclado.
- Nuevas acciones o cambios en `TouchConfig`.
- Paletas por juego.
- Layout horizontal, overlay, haptics.

Cada uno, si llega, va en su propio spec.
