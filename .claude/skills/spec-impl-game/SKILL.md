---
name: spec-impl-game
description: Igual que /spec-impl, pero para specs de juegos. Tras implementar el spec, lanza en secuencia (nunca en paralelo) los agentes skin-designer y mobile-porter sobre el juego.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl + skins + port móvil

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instrucciones

Argumento recibido: `$ARGUMENTS`

### Fases 1–4 — Idénticas a /spec-impl

Lee `.claude/skills/spec-impl/SKILL.md` y sigue sus Fases 1–4 **al pie de la letra** (identificar spec, validar estado "Aprobado", rama `spec-NN-slug`, implementación paso a paso con pausas, nunca commitear), usando el argumento y el session context de arriba. Mismos bloqueos y mensajes de error.

Excepción: al terminar el último paso **no** muestres aún el mensaje final de `/spec-impl`; continúa con la Fase 5.

### Fase 5 — Identificar el juego

Deduce el `id` del juego del spec (id en la migración `games`, carpeta `lib/games/<id>/`, entrada en `ENGINES` de `lib/games/registry.ts`).

- Si no se puede determinar o no está en `ENGINES`: pregunta al usuario el id. No adivines.
- Si el spec no trata de un juego: avisa y termina con el cierre normal de `/spec-impl`.

### Fase 6 — Agente `skin-designer`

Lanza con la tool `Agent` (`subagent_type: "skin-designer"`), prompt: el id del juego, el spec implementado, la rama activa y "no commitear". Espera a que termine. Resume archivos tocados y di:

`Skins listas. ¿Reviso el diff y sigo con mobile-porter?`

Espera confirmación.

### Fase 7 — Agente `mobile-porter`

Solo tras confirmar, **después** de que skin-designer terminó (nunca en paralelo). `Agent` con `subagent_type: "mobile-porter"`, mismo formato de prompt. Resume archivos tocados y pausa para revisión.

### Cierre

```
✅ Spec implementado, con skins y port móvil.

Siguiente: verifica uno a uno los criterios de aceptación del spec. Si pasan,
actualiza el estado a "Implementado" y haz el commit final antes de mergear.
Estado actualizado en references/skins-status.md y references/mobile-status.md.
```

### Reglas

- Nunca commitear automáticamente.
- Ambigüedad no resuelta por el spec: parar, describirla, ofrecer 2–3 opciones, esperar.
- Fuera del alcance del spec: recordarlo y no implementarlo en esta rama.
