---
name: integrar-juego
description: Genera el spec para integrar un juego de references/templates/started-games/ en Arcade Vault (motor TS con canvas, registro, fila en `games`, leaderboard). Solo escribe el spec; se implementa luego con /spec-impl.
disable-model-invocation: true
argument-hint: "carpeta del juego en started-games, ej. 03-tetris"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /integrar-juego — Spec de integración de un juego

## Session context

Fecha (úsala en el header, nunca la inventes):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos disponibles:
!`ls references/templates/started-games/ 2>/dev/null`

---

**No escribes código de la app.** Produces `specs/NN-juego-<id>.md` a partir de `template.md` (mismo directorio), listo para `/spec-impl`. Responde en español.

`$ARGUMENTS` = carpeta del juego (ej. `03-tetris`). Si viene vacío o no existe en la lista, pregunta cuál con `AskUserQuestion`.

## Fase 1 — Contexto

1. Lee `CLAUDE.md` y `AGENTS.md`.
2. Lee `specs/05-juego-asteroids.md`, `specs/06-leaderboard-y-tabla-games.md` y `specs/07-registro-de-motores.md`.
3. **Prerrequisito:** `specs/07` debe estar `Implementado` y existir `lib/games/types.ts` y `lib/games/registry.ts`. Si no, detente y dile al usuario que corra `/spec-impl 07` primero.
4. Lee `lib/games/types.ts`, `lib/games/registry.ts` y `lib/games/asteroids/engine.ts` (referencia del patrón de port).
5. Si ya existe un spec para ese juego en `specs/`, avisa y pregunta antes de continuar.

## Fase 2 — Analizar el template

Lee en `references/templates/started-games/$ARGUMENTS/`: `game.js` (y otros `.js`), `index.html`, `README.md`, `CLAUDE.md`, `style.css` si hay, y lista `assets/`. Extrae este checklist (va al spec, sin inventar):

- Tamaño del canvas (`width`/`height`) y relación de aspecto.
- Estado global y acceso al DOM (`getElementById`, `localStorage`, overlays) → a eliminar o mover a React.
- Loop (`requestAnimationFrame`, `dt`, acumuladores) y condiciones de game over.
- Teclas/mouse y cuáles requieren `preventDefault`.
- Pausa y game over propios (se eliminan: los muestra la plataforma).
- HUD propio (lo que se conserva en canvas) vs. valores que irán a React: puntaje, vidas, nivel, stats extra.
- Reglas de puntuación (tablas/constantes que se conservan literalmente).
- Assets (imágenes, sonidos): ruta destino `public/games/<id>/`.
- Features del original que no encajan en la plataforma (tema claro, selector de nivel, botón reiniciar propio…).
- Dependencias entre archivos (`levels.js`, `spritesheet.js`) → módulos TS.

## Fase 3 — Preguntas

Un bloque de 3–5 con `AskUserQuestion` (recomendación primero). Cubre: `id` (slug), título, `cat` (ARCADE/PUZZLE/SHOOTER/VERSUS), `color`, `tags`, `difficulty` 1–5, `controls`, `players`; stats extra del HUD y si hay vidas/nivel; qué features del original quedan fuera; si se incluye sonido (si hay mp3); `sort_order`. Descubrimientos que merezcan otro spec (p. ej. táctil) → fuera de alcance, confírmalo.

Para la descripción `short`/`long` propón texto en español y deja que el usuario lo ajuste.

## Fase 4 — Escribir el spec

1. Número = máximo en `specs/` + 1, dos dígitos. Archivo: `specs/NN-juego-<id>.md`.
2. Parte de `template.md`, sustituye todos los `<…>` con lo del análisis y las respuestas. No dejes huecos sin rellenar; si falta información, pregunta.
3. `Status: Borrador`, `Depends on: SPEC 05, SPEC 06, SPEC 07`, fecha del contexto.
4. Escribe el archivo sin pedir permiso (solo pregunta si ya existe).
5. Cierra con: ruta del spec, resumen de 3 líneas (stats extra, assets, exclusiones) y siguiente paso: `/spec-impl NN`.

## Reglas

- El spec describe un port fiel: no cambiar reglas, balance ni look salvo lo exigido por la plataforma.
- No introducir cambios de esquema: `games` y `scores` ya sirven (SPEC 06). El leaderboard se activa al insertar la fila en `games`.
- La fila en `games` se inserta con `published = false` y se publica en el último paso del plan, tras verificar el juego.
- No tocar `GamePlayer` ni el contrato: solo registrar el motor en `ENGINES`. Si el juego exige ampliar el contrato, dilo y sugiere un spec aparte.
