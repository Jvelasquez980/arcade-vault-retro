# SPEC 04 — Integración base de Supabase (clientes SSR + sesión por cookies)

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-10-01
> **Objective:** Dejar Supabase conectado al proyecto Next.js (paquetes, variables de entorno, clientes de navegador/servidor y refresco de sesión en `proxy.ts`) sin migrar todavía ninguna funcionalidad existente.

---

## Por qué existe este spec

La app usa sesión y puntajes mock en `localStorage` (`lib/session.ts`, `lib/scores.ts`). El usuario quiere migrar a Supabase por partes. Este spec solo prepara la **infraestructura** para que los specs siguientes (auth real, puntajes, catálogo) se apoyen en ella. Decisión del usuario: "de momento solamente la integración con Supabase; el resto, en specs futuros".

El proyecto Supabase ya existe (`.mcp.json`, ref `wyntxoeivipiytzpzkbc`) y su esquema `public` está vacío.

---

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y `.env.example`.
- `lib/supabase/client.ts`: cliente para componentes cliente (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente para Server Components, Server Actions y Route Handlers (`createServerClient` con `cookies()`).
- `lib/supabase/proxy.ts`: helper `updateSession` que refresca la sesión y reescribe cookies.
- `proxy.ts` en la raíz (convención de Next 16, reemplaza `middleware.ts`) que invoca `updateSession`.
- Ruta de verificación temporal `app/api/supabase-health/route.ts` que comprueba la conexión y se elimina en el último paso.
- Actualizar `CLAUDE.md` (sección Architecture) con la nota de Supabase.

**Out of scope (para specs futuras):**

- Supabase Auth real (reemplazar `lib/session.ts`, `/auth`, modo invitado).
- Tablas, migraciones y RLS (`profiles`, `scores`, `games`).
- Migrar `lib/scores.ts`, `/salon` o `lib/data.ts` a la BD.
- Guardar mensajes de contacto en la BD.
- Protección de rutas por sesión en `proxy.ts` (solo refresca, no redirige).
- Tipos generados (`supabase gen types`) y Supabase CLI / entorno local.
- Clave `service_role` o cualquier uso privilegiado.
- Tests automatizados.

---

## Data model

Este spec no introduce estructuras de datos de dominio ni tablas. Solo configuración:

```
# .env.local / .env.example (prefijo NEXT_PUBLIC_: se expone al navegador; son claves públicas por diseño)
NEXT_PUBLIC_SUPABASE_URL=                  # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # sb_publishable_...
```

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // browser, sin async

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // lee/escribe cookies vía next/headers

// lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
```

Convenciones:

- Se usa la clave `sb_publishable_...` (no la anon JWT legacy). Nunca la `service_role`.
- `SUPABASE_DB_PASSWORD` (ya en `.env.example`) no se usa en código; solo para herramientas. No lleva prefijo `NEXT_PUBLIC_`.
- El cliente del servidor se crea **por petición**, nunca como singleton global.
- En `proxy.ts` se valida con `supabase.auth.getClaims()`/`getUser()`, nunca con `getSession()` (no verifica el token en servidor). Confirmar el método vigente en la documentación de `@supabase/ssr`.
- Los clientes siguen `@/*` como alias; la sesión mock de `localStorage` (`av_user`) **no se toca** y convive con Supabase.

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` y la guía de Supabase para Next.js (`mcp__supabase__search_docs`, "Server-Side Auth Next.js") para confirmar APIs vigentes. Instalar `npm i @supabase/supabase-js @supabase/ssr`. Verificar: `npm run build` compila.
2. Añadir las dos variables a `.env.example` (sin valores) y a `.env.local` (URL y publishable key del proyecto, obtenidas con las herramientas MCP de Supabase). Verificar: `.env.local` sigue ignorado por git; `git status` solo muestra `.env.example`, `package*.json`.
3. Crear `lib/supabase/client.ts` con `createBrowserClient`. Verificar: build compila.
4. Crear `lib/supabase/server.ts` con `createServerClient` y `cookies()` (`await cookies()` según Next 16; `setAll` envuelto en try/catch para Server Components). Verificar: build compila.
5. Crear `lib/supabase/proxy.ts` (`updateSession`) y `proxy.ts` en la raíz con `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes. Verificar: `npm run dev` arranca y `/`, `/games`, `/about` cargan sin errores.
6. Crear `app/api/supabase-health/route.ts` temporal: usa el cliente de servidor y devuelve `{ ok: true }` si `supabase.auth.getUser()` responde sin error de red/configuración (sin sesión es válido). Verificar: `GET /api/supabase-health` → 200 `{ "ok": true }`; con la URL rota → 500 `{ "ok": false }`.
7. Eliminar la ruta temporal, actualizar `CLAUDE.md` (Architecture: clientes en `lib/supabase/`, `proxy.ts`, variables) y correr `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales; `.env.local` contiene valores reales y no está versionado.
- [ ] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts` y `proxy.ts` en la raíz; no existe `middleware.ts`.
- [ ] Con la ruta temporal activa, `GET /api/supabase-health` devuelve 200 y `{ "ok": true }`.
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` inválida, la ruta temporal devuelve 500 y `{ "ok": false }` sin filtrar la clave ni stack traces.
- [ ] `app/api/supabase-health/` no existe al terminar el spec.
- [ ] `/`, `/games`, `/games/<id>`, `/games/<id>/jugar`, `/salon`, `/auth` y `/about` se comportan igual que antes (login/invitado, puntajes en `localStorage` y formulario de contacto intactos).
- [ ] `proxy.ts` no excluye ni intercepta peticiones a `_next/static` ni a imágenes.
- [ ] Ninguna referencia a `service_role` ni a la anon key JWT legacy en el repo.
- [ ] La consola del navegador no muestra errores ni warnings de hydration en `/` y `/auth`.
- [ ] `CLAUDE.md` documenta los clientes de Supabase, `proxy.ts` y las dos variables.

---

## Decisions

- **Sí:** solo infraestructura en este spec. Decisión del usuario; auth, puntajes y catálogo van en specs propios y evitan un cambio de cuatro dominios a la vez.
- **Sí:** `@supabase/ssr` con cookies. Decisión del usuario; permite sesión autenticada en Server Components y Server Actions.
- **No:** `@supabase/supabase-js` solo en cliente. Sesión en `localStorage` impide SSR autenticado y habría que rehacerlo después.
- **Sí:** `proxy.ts` (Next 16). **No:** `middleware.ts`, nombre deprecado en esta versión.
- **Sí:** clave publishable `sb_publishable_...`. Es la recomendada por Supabase y permite rotación independiente. **No:** anon JWT legacy.
- **Sí:** `proxy.ts` solo refresca la sesión, no redirige. Sin auth real aún no hay rutas que proteger; la protección va con el spec de auth.
- **Sí:** convivir con la sesión mock (`av_user`). Evita romper `/auth`, `/salon` y el reproductor hasta su migración.
- **Sí:** ruta de verificación temporal eliminada al final. Verifica la conexión de punta a punta sin dejar superficie pública. **No:** dejarla permanente.
- **No:** crear tablas ni RLS aquí. Sin consumidores no hay forma de validarlas; entran con el primer spec que las use.
- **Sí:** variables `NEXT_PUBLIC_*` solo para URL y publishable key. Son públicas por diseño; la seguridad depende de RLS (spec futuro).

---

## Risks

| Risk                                                                                     | Mitigation                                                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Next 16 difiere de la guía de Supabase (nombre `proxy`, `cookies()` async).              | Paso 1 lee la doc offline de Next y la de Supabase antes de escribir código (ver `AGENTS.md`). |
| El `proxy.ts` rompe assets o rutas existentes por un `matcher` mal definido.             | `matcher` excluye estáticos; criterio de aceptación recorre todas las rutas.                   |
| Cookies de sesión no se propagan si no se devuelve el `NextResponse` de `updateSession`. | `proxy.ts` devuelve siempre la respuesta de `updateSession` sin reconstruirla.                 |
| Pérdida de valores de `.env.local` o commit accidental de claves.                        | `.env*` ya está ignorado (excepto `.env.example`); `.env.example` sin valores.                 |
| `getSession()` en servidor no valida el JWT.                                             | Convención: usar `getClaims()`/`getUser()` en servidor.                                        |
| Latencia añadida por el `proxy.ts` en cada navegación.                                   | Aceptado; sin sesión la llamada es mínima y el `matcher` excluye estáticos.                    |

---

## What is **not** in this spec

- Supabase Auth real, reemplazo de `lib/session.ts` o del modo invitado.
- Tablas, migraciones y RLS.
- Migración de puntajes, ranking, catálogo de juegos o mensajes de contacto.
- Protección de rutas, roles o perfiles.
- Tipos generados, Supabase CLI y entorno local.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
