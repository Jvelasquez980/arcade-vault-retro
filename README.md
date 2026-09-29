## Arcade Vault

Plataforma para jugar online y competir por la mayor cantidad de puntos.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Resend (correo de contacto).

## Empezar

```bash
npm install
cp .env.example .env.local   # completar variables (ver abajo)
npm run dev                  # http://localhost:3000
```

Otros scripts: `npm run build`, `npm run start`, `npm run lint`.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `RESEND_API_KEY` | Clave de Resend (solo servidor). |
| `CONTACT_TO_EMAIL` | Destinatario del formulario de contacto. Con `onboarding@resend.dev`, Resend solo entrega al correo dueño de la cuenta. |
| `CONTACT_FROM_EMAIL` | Remitente. Por defecto `Arcade Vault <onboarding@resend.dev>`. |

## Pantallas

| Ruta | Descripción |
| --- | --- |
| `/` | Landing / home |
| `/games` | Biblioteca de juegos |
| `/games/[id]` | Detalle del juego |
| `/games/[id]/jugar` | Reproductor (partida simulada) |
| `/salon` | Salón de la fama |
| `/auth` | Acceso |
| `/about` | Acerca de + formulario de contacto |

> Sesión y puntajes son mock en `localStorage`; aún no hay backend ni base de datos.

## Usa Spec Driven Design

Basado en `/spec` y `/spec-impl`. Los specs viven en `specs/`:

1. `01-mvp-pantallas.md`
2. `02-home-landing-y-games.md`
3. `03-about-page-y-contacto-resend.md`

Los diseños de referencia están en `references/templates/`.

Siguiendo las buenas prácticas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```
