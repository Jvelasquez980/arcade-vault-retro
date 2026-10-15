# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: plataforma para jugar online y competir por puntos. Sigue Spec Driven Design (`/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`). Specs en `specs/NN-slug.md` (01 pantallas MVP, 02 home/games, 03 about + contacto, 04 Supabase, 05 asteroids, 06 leaderboard + tabla games, 07 registro de motores, 08 tetris, 09 arkanoid, 10 snake; 09 y 10 con status "Aprovado", el resto "Implementado"). Diseños de referencia en `references/templates/` (JSX/CSS de prototipo); las pantallas se portan de ahí. Código/assets originales de juegos en `references/started-games/` y `references/snake-assets/`. UI y copy en español.

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
- If you need to check all the games that are implemented see `references/implemented-games.md`
- Sesión mock (sin Supabase Auth): `lib/session.ts` clave `av_user` en `localStorage`; `lib/player-name.ts` recuerda el nombre del modal de puntaje en `av_player_name`. Acceso siempre client-side (`window`, try/catch). `components/session-provider.tsx` hidrata la sesión tras el primer render.
- Catálogo y puntajes en Supabase (tablas `games` y `scores`, vista `game_stats`, RLS con lectura pública y sin políticas de escritura). `lib/catalog.ts` (servidor: `listGames`, `getGame`, une `game_stats`) re-exporta `lib/catalog-shared.ts` (tipos, `CATS`, etiquetas, `formatPlays`, `formatDate`; sin imports de servidor, usable en Client Components). `lib/leaderboard.ts` (`getTopScores`, `getBestByName`) y `lib/scores-validation.ts`. Los puntajes se insertan solo por la Server Action `submitScore` (`app/games/[id]/jugar/actions.ts`) → RPC `submit_score` (`security definer`); el cliente no escribe directo. `app/salon/actions.ts` (`getMyBest`) consulta el mejor puntaje por nombre. Contenido del home no-catálogo en `lib/home-data.ts`.
- Añadir un juego: (1) clase `cover-*` en `app/globals.css`, (2) migración con `insert` en `games` (`published = false` hasta verificarlo), (3) su motor en `lib/games/<juego>/engine.ts` exportando un `GameEngineDef`, (4) registrarlo en `ENGINES` de `lib/games/registry.ts`. `GamePlayer` y `/games/<id>/jugar` no se tocan; el id sin entrada en `ENGINES` da 404. Assets en `public/games/<id>/`. El skill `/integrar-juego` genera el spec.
- Motores de juego en `lib/games/<juego>/engine.ts`, patrón `createX(canvas, events) → GameController` (hoy `asteroids`, `tetris`, `arkanoid` y `snake`; `tetris` dibuja su panel HUD nativo dentro del canvas, 480×600; `arkanoid` es 800×600, carga su spritesheet por instancia en `sprites.ts` y no arranca el loop hasta que carga, con niveles en `levels.ts` y audio en `public/games/arkanoid/`; `snake` es 600×600, rejilla 20×20, 1 vida sin niveles, sin portar código original, carga `fruits.png` por instancia en `sprites.ts` y no arranca el loop hasta que carga). Contrato en `lib/games/types.ts`: `GameEvents` (`onScore/onGameOver` + opcionales `onLives/onLevel/onStat(key, value)`, solo al cambiar el valor), `GameController` (`pause/resume/restart/destroy`) y `GameEngineDef` (`width/height`, `initialLives?`, `showLevel?`, `stats?` extra del HUD, `create`). `lib/games/registry.ts` (`ENGINES`, import dinámico, `hasEngine`) mapea id → def. Sin globals de módulo; React es la fuente de verdad del HUD, la pausa (botón y tecla `P`) y el modal de puntaje. `components/games/game-canvas.tsx` crea el motor en `useEffect` y lo destruye al desmontar; `GamePlayer` es genérico y fija `--game-ar` desde `width/height`. Teclado: el motor ignora `input/textarea/select`.
- Controles táctiles (SPEC 11, gamepad MK-II SPEC 12): `GameEngineDef.touch?: TouchConfig` (`TouchButton { key, code, label, repeat? }`; `dpad` up/down/left/right + `actions` 0–2) declara el gamepad del juego; sin `touch` no se muestra. `components/games/touch-pad.tsx` (montado en `GamePlayer` bajo `.crt`, `disabled = paused || over`) despacha `KeyboardEvent` sintéticos (`key` y `code`) a `window` con pointer events (capture, multitouch, auto-repeat 250/120 ms con `repeat`, `keyup` de todo al desmontar/`blur`/`disabled`). Los motores no cambian: **no deben filtrar `e.isTrusted`**. Presentación MK-II (ref. `references/gamepad-assets/`): carcasa `.av-gp` con `data-skin` (prop `skin` de `TouchPad`, la pasa `GamePlayer`), cruz con 4 `.av-gp-dp` SVG + hub/gema `.av-gp-hub`, y B/A (`actions[1]`/`actions[0]`) `.av-gp-ab` siempre visibles (sin `TouchButton` → `disabled` atenuado; `label` bajo la letra); pulsado = `.on`. CSS `av-gp*` visible solo con `@media (pointer: coarse)`; flecha/hub `--tp-btn: clamp(48px, 14vw, 72px)`, A/B ×1.35 (×1.2 bajo 380 px) y alto de `.crt-screen` limitado con `dvh`. Colores por skin solo CSS en `.av-gp[data-skin=…]` (`--gp-dp/--gp-a/--gp-b/--gp-glow`; paleta global, no por juego). Añadir juego: declarar `touch` en su def.
- Skins: `SkinId` (`classic`/`neon`/`retro`) y `SKINS` en `lib/games/types.ts`; `create(canvas, events, skin?)` con default `"classic"` (motores sin skins lo ignoran). Paleta por juego en `lib/games/<id>/skins.ts` (`<id>Skins: Record<SkinId, Palette>`, todo color del motor sale de ahí, leída por instancia; classic = colores originales). `lib/skin.ts`: `getSkin/setSkin` (`localStorage` `av_skin_<id>`, try/catch) y `hasSkins(id)` (set `SKINNED_GAMES`: añadir el id al implementar sus skins). `GamePlayer` muestra el selector (`.av-skins` + `.chip`) solo si `hasSkins`; `GameCanvas` recrea el motor con `skin` en deps (cambiar skin reinicia la partida). Estado en `references/skins-status.md`; hoy `asteroids`, `tetris`, `arkanoid` y `snake` (los 4).
- Rutas: `/`, `/games`, `/games/[id]`, `/games/[id]/jugar`, `/salon`, `/auth`, `/about`. Layout raíz (`app/layout.tsx`) monta Nav/Footer/SessionProvider y las fuentes vía `next/font`.
- Contacto: `app/about/actions.ts` (Server Action `sendContact`, `useActionState` en `components/about/contact-form.tsx`) valida con `lib/contact.ts` y envía con Resend. Requiere `.env.local` con `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (ver `.env.example`); con `onboarding@resend.dev` solo entrega al correo dueño de la cuenta.
- Supabase (sin auth real; convive con la sesión mock): clientes en `lib/supabase/` (`client.ts` navegador, `server.ts` servidor/Server Actions, async y por petición; `proxy.ts` helper `updateSession`). `proxy.ts` en la raíz (convención Next 16, no `middleware.ts`) solo refresca la sesión con `getClaims()`, no protege rutas. Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_...`; nunca claves privilegiadas).
- Estilos: tokens y clases `av-*` en `app/globals.css` (tema retro/neón: cyan/magenta/yellow) expuestos a Tailwind vía `@theme inline`.

## Skills y hooks
- Skills de proyecto en `.claude/skills/`: `spec`, `spec-impl`, `spec-impl-game` (= `spec-impl` + al final `skin-designer` y luego `mobile-porter`, en secuencia), `integrar-juego`.
- Subagente `game-planner` en `.claude/agents/game-planner.md`: decide qué juego encaja; memoria/TODO de sugerencias en `references/game-suggestions-todo.md`.
- Subagente `skin-designer` en `.claude/agents/skin-designer.md`: recibe un juego e implementa sus 3 skins (classic/neon/retro) con contraste sobre fondo oscuro; estado por juego en `references/skins-status.md`.
- Subagente `mobile-porter` en `.claude/agents/mobile-porter.md`: recibe un juego y corrige solo código para web/móvil según SPEC 11 (sin Playwright); estado por juego en `references/mobile-status.md`.
- Subagente `perf-optimizer` en `.claude/agents/perf-optimizer.md`: recibe un juego y le aplica las técnicas de SPEC 13 (fondo offscreen, rAF detenido en pausa, CSS ligero en `/jugar`); estado por juego en `references/performance-status.md`.
- Hook `PostToolUse` (`Write`) en `.claude/settings.json` → `.claude/hooks/format-file.mjs`: Prettier + ESLint `--fix` al archivo escrito.
- `hooks/use-reveal.ts` (raíz) es un hook de React (reveal on scroll), no de Claude.0.

Always use the frontend design skill when you try to design a user interface. 
