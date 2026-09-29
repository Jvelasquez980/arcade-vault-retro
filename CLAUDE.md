# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: plataforma para jugar online y competir por puntos. Sigue Spec Driven Design (`/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`). Specs en `specs/NN-slug.md` (01 pantallas MVP, 02 home/games, 03 about + contacto). Diseños de referencia en `references/templates/` (JSX/CSS de prototipo); las pantallas se portan de ahí. UI y copy en español.

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

## Architecture

- Sin backend/DB: sesión y puntajes son mock en `localStorage` (`lib/session.ts` clave `av_user`, `lib/scores.ts` clave `av_scores`); acceso siempre client-side (`window`, try/catch). `components/session-provider.tsx` hidrata la sesión tras el primer render.
- Datos estáticos de juegos y rankings en `lib/data.ts`; contenido del home en `lib/home-data.ts`. `components/game-player.tsx` simula partidas (puntaje aleatorio), no hay juegos reales.
- Rutas: `/`, `/games`, `/games/[id]`, `/games/[id]/jugar`, `/salon`, `/auth`, `/about`. Layout raíz (`app/layout.tsx`) monta Nav/Footer/SessionProvider y las fuentes vía `next/font`.
- Contacto: `app/about/actions.ts` (Server Action `sendContact`, `useActionState` en `components/about/contact-form.tsx`) valida con `lib/contact.ts` y envía con Resend. Requiere `.env.local` con `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (ver `.env.example`); con `onboarding@resend.dev` solo entrega al correo dueño de la cuenta.
- Estilos: tokens y clases `av-*` en `app/globals.css` (tema retro/neón: cyan/magenta/yellow) expuestos a Tailwind vía `@theme inline`.

## Skills 
Always use the frontend design skill when you try to design a user interface. 
