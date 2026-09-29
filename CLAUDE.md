# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: plataforma para jugar online y competir por puntos. Sigue Spec Driven Design (`/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`). Actualmente es un scaffold de `create-next-app` sin lógica de negocio aún.

## Commands

```bash
npm run dev     # dev server (localhost:3000)
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner configured.

## Stack / architecture

- Next.js 16.3.7 (App Router, `app/` at repo root, no `src/`), React 19, TypeScript, Tailwind CSS v4 (via `@tailwindcss/postcss`; `@import "tailwindcss"` in `app/globals.css`).
- Path alias `@/*` → repo root.
- Next docs offline: `node_modules/next/dist/docs/` (01-app, 02-pages, 03-architecture, 04-community). Consult before writing Next code — see AGENTS.md.
