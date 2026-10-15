# Performance por juego — Arcade Vault

Un juego cumple cuando pasa el checklist de `.claude/agents/perf-optimizer.md` (SPEC 13).

| Juego     | fondo offscreen | rAF pausa | CSS /jugar | Actualizado | Pendientes fuera de alcance                                                |
| --------- | --------------- | --------- | ---------- | ----------- | -------------------------------------------------------------------------- |
| frogger   | ✅              | ✅        | ✅         | 2026-10-15  | shadowBlur por entidad (neón)                                              |
| asteroids | N/A             | ✅        | ✅         | 2026-10-15  | shadowBlur por entidad (neón); asignaciones por frame (`filter`/`forEach`) |
| tetris    | ✅              | ✅        | ✅         | 2026-10-15  | shadowBlur por bloque y valores del panel (neón); `toLocaleString`/`rotateCW` asignan por frame/input |
| arkanoid  | ✅              | ✅        | ✅         | 2026-10-15  | shadowBlur en contornos de bloques/paleta/bola (neón); `filter` de explosiones por frame |
| snake     | ✅              | ✅        | ✅         | 2026-10-15  | shadowBlur del cuerpo/cabeza (neón); `Set`/`map` en `placeFruit`            |

Leyenda: ✅ verificado por código · ❌ pendiente · N/A no aplica.
