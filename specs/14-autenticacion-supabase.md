# SPEC 14 — Autenticación real con Supabase Auth (registro, login, OAuth, recuperación)

> **Status:** Aprovado
> **Depends on:** SPEC 04, SPEC 06
> **Date:** 2026-10-15
> **Objective:** Reemplazar la sesión mock (`lib/session.ts`) por Supabase Auth con registro y login por email/contraseña, Google y GitHub, recuperación de contraseña, cierre de sesión y puntajes de usuarios registrados ligados a su `user_id`.

---

## Por qué existe este spec

`/auth` (`components/auth-form.tsx`) solo guarda un nombre en `localStorage` (`av_user`) sin validar nada. SPEC 04 dejó la infraestructura de Supabase (clientes SSR + `proxy.ts`) y SPEC 06 los puntajes por nombre libre. Este spec cierra el hueco: cuentas reales, `username` único y puntajes que identifican al usuario aunque cambie su nombre.

Decisiones del usuario (no se reabren): email+contraseña **y** Google/GitHub; tabla `profiles` con `username`; pantalla "elige tu usuario" tras el primer login OAuth; reemplazar la sesión mock conservando el modo invitado; sin confirmación de email y sin proteger rutas; incluir cerrar sesión y recuperar contraseña; los puntajes guardan el nombre tal cual lo escribe la persona (sugerido: su username) **y** `user_id`; la migración va por MCP y el usuario configura los proveedores OAuth en el dashboard.

---

## Scope

**In:**

- Migración Supabase (por MCP):
  - Tabla `profiles` (`id`, `username`, `created_at`) con RLS: lectura pública, sin políticas de escritura.
  - Trigger en `auth.users` que crea el perfil cuando el usuario trae `username` en `raw_user_meta_data` (registro por email).
  - RPC `set_username(p_username text)` (`security definer`) para crear el perfil de usuarios OAuth.
  - Columna `scores.user_id uuid null` (FK a `auth.users`, `on delete set null`) y `submit_score` actualizado para guardarla desde `auth.uid()`.
- Server Actions de auth (`app/auth/actions.ts`): `signUp`, `signIn`, `signInWithProvider`, `signOut`, `requestPasswordReset`, `updatePassword`, `chooseUsername`.
- Route Handler `app/auth/callback/route.ts` (intercambio de `code` por sesión para OAuth y recuperación).
- Pantallas: `/auth` (pestañas entrar/crear + botones Google/GitHub + invitado, reutiliza `.auth-card`), `/auth/username`, `/auth/recuperar`, `/auth/nueva-clave`.
- `lib/auth-validation.ts`: validación de `username`, email y contraseña (compartida cliente/servidor).
- `SessionProvider` y `useSession` pasan a leer Supabase; API: `{ user: { id, name } | null, logout }`. Se elimina `login`.
- Nav: "Cerrar sesión" conectado a `signOut` real.
- `app/games/[id]/jugar/actions.ts`: sin cambios de firma; `user_id` lo pone el RPC.
- `app/salon/actions.ts` `getMyBest(gameId)`: usa el `user_id` de la sesión del servidor (ya no recibe nombre).
- Eliminar `lib/session.ts` y la clave `av_user`.
- Actualizar `CLAUDE.md`.

**Out of scope (para specs futuras):**

- Editar username, avatar o pantalla de perfil.
- Confirmación de email, MFA, magic link, otros proveedores OAuth.
- Protección de rutas en `proxy.ts` (todo sigue público; el invitado puede jugar y puntuar).
- Ranking/estadísticas por `user_id` (la columna queda lista; `getTopScores`/`/salon` siguen por nombre).
- Backfill de puntajes antiguos (`user_id` queda `null`).
- Migrar el nombre guardado en `av_player_name` ni cambiar el modal de puntaje más allá del valor sugerido.
- Rate limiting propio, captcha, SMTP personalizado.
- Tests automatizados.

---

## Data model

```sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;
create policy "profiles_read" on public.profiles for select using (true);
-- sin políticas de insert/update/delete: solo trigger y RPC (security definer)

-- scores
alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;
create index scores_user_game_idx on public.scores (user_id, game_id, score desc);
```

```ts
// lib/session-provider (contexto)
type User = { id: string; name: string }; // name = profiles.username
type SessionContextValue = { user: User | null; logout: () => Promise<void> };

// lib/auth-validation.ts
export const AUTH_LIMITS = {
  usernameMin: 3,
  usernameMax: 10,
  passwordMin: 8,
} as const;
export function normalizeUsername(raw: string): string; // trim + toUpperCase
export function validateSignUp(i: {
  username: unknown;
  email: unknown;
  password: unknown;
}):
  | { ok: true; value: { username: string; email: string; password: string } }
  | { ok: false; error: string };
```

Convenciones:

- `username`: `A-Z0-9_`, 3–10 caracteres, guardado en mayúsculas (coincide con el estilo actual `PLAYER1`). Único.
- Registro por email: el `username` viaja en `options.data.username` de `signUp`; el trigger crea la fila en `profiles`. Si la inserción falla por duplicado, el registro falla y la Server Action devuelve "Ese usuario ya existe". Antes de registrar se hace un `select` previo a `profiles` para dar el error temprano (la restricción única es la verdad).
- Usuario OAuth: no hay fila en `profiles` hasta llamar `set_username`; `/auth/callback` lo redirige a `/auth/username` si falta.
- `submit_score(p_game_id, p_name, p_score)` conserva su firma; guarda `user_id = auth.uid()` (`null` para invitados). El `user_id` **nunca** viene del cliente.
- `scores.name` sigue siendo texto libre (máx. 12, SPEC 06); `GamePlayer` lo sugiere con `user.name` y el usuario puede cambiarlo.
- `next` en las URLs de auth solo acepta rutas relativas que empiezan por `/` (y no `//`); si no, `/`.
- Login con **email + contraseña** (el campo "Usuario" del diseño actual solo existe en el registro).

---

## Implementation plan

0. **Prerrequisitos manuales del usuario** (el MCP no los gestiona): en el dashboard de Supabase, desactivar "Confirm email"; habilitar Google y GitHub con sus Client ID/Secret; añadir a Redirect URLs `http://localhost:3000/auth/callback` y la URL de producción. Verificar: el usuario confirma que están hechos antes del paso 6.
1. Leer `node_modules/next/dist/docs/` (Server Actions, `redirect`, Route Handlers) y la guía de Supabase (`mcp__supabase__search_docs`: "Server-Side Auth Next.js", "Auth with OAuth PKCE", "Password reset") para confirmar APIs vigentes.
2. Migración `auth_profiles_and_score_user_id` por MCP: `profiles` + RLS + trigger `handle_new_user` + RPC `set_username` + columna `scores.user_id` + `submit_score` actualizado. Verificar: `mcp__supabase__get_advisors` (security) sin avisos nuevos; `submit_score` sin sesión sigue insertando con `user_id` nulo; los puntajes existentes no cambian.
3. `lib/auth-validation.ts` con las reglas de arriba. Verificar: compila.
4. `app/auth/actions.ts` con `signUp` (valida, comprueba disponibilidad, `supabase.auth.signUp` con `options.data.username`), `signIn`, `signOut`. Errores genéricos en español, sin filtrar mensajes crudos de Supabase. Verificar: build compila.
5. `SessionProvider`: usa `createClient()` del navegador; primer render sin sesión, luego `getSession()` + `profiles` y `onAuthStateChange`; `logout` llama a `signOut` del navegador. Quitar `login`. Actualizar Nav, `GamePlayer` y `HallOfFame` al nuevo contrato (`user.name`). Verificar: sitio carga igual como invitado.
6. Reescribir `components/auth-form.tsx` con `useActionState` contra las acciones: pestañas, errores por campo, estado pendiente, botón invitado, enlace "¿Olvidaste tu contraseña?". Usar el skill `frontend-design` y portar estilos de `references/templates/auth.jsx`/`styles.css`. Si ya hay sesión, `/auth` redirige a `/`. Verificar: registrar `TEST_01` → Nav muestra `TEST_01`; cerrar sesión → "Iniciar Sesión".
7. `signInWithProvider` (`signInWithOAuth` con `redirectTo` a `/auth/callback`) y `app/auth/callback/route.ts` (`exchangeCodeForSession`, redirige a `next` o `/auth/username` si no hay perfil). Conectar los botones Google/GitHub. Verificar: login con GitHub crea sesión y cae en `/auth/username`.
8. `/auth/username` + `chooseUsername` (RPC `set_username`, validación compartida, error si está tomado). Sin sesión → `/auth`; con perfil → `/`. Verificar: elegir usuario libre → Nav lo muestra.
9. Recuperación: `/auth/recuperar` + `requestPasswordReset` (`resetPasswordForEmail` con `redirectTo` a `/auth/callback?next=/auth/nueva-clave`; respuesta idéntica exista o no el correo) y `/auth/nueva-clave` + `updatePassword`. Verificar: correo recibido → nueva clave → login con ella.
10. Puntajes: `getMyBest(gameId)` por `user_id` de la sesión del servidor (añadir `getBestByUser` en `lib/leaderboard.ts`); `HallOfFame` ya no pasa nombre. Verificar: jugar logueado y guardar → fila con `user_id` en BD; como invitado → `user_id` nulo; tras cambiar el nombre en el modal, "mi mejor" sigue apareciendo.
11. Eliminar `lib/session.ts` y referencias a `av_user`; actualizar `CLAUDE.md` (Architecture) y correr `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` pasan.
- [ ] Registro con username, email y contraseña (≥8) crea usuario, fila en `profiles` y deja la sesión iniciada sin pasos de confirmación.
- [ ] Registrar un username ya existente (sin importar mayúsculas) muestra "Ese usuario ya existe" y no crea usuario.
- [ ] Username fuera de `A-Z0-9_` o de 3–10 caracteres es rechazado en cliente y en servidor.
- [ ] Login con email y contraseña correctos inicia sesión; con datos incorrectos muestra un error genérico (sin distinguir email inexistente de clave errónea).
- [ ] Google y GitHub inician sesión; un usuario OAuth sin perfil es llevado a `/auth/username` y no puede usar el sitio como "logueado" hasta elegir uno válido y libre.
- [ ] Recuperar contraseña: el formulario responde igual exista o no el correo; el enlace del correo lleva a `/auth/nueva-clave` y la nueva clave permite entrar.
- [ ] "Cerrar sesión" en Nav elimina la sesión; recargar la página mantiene al usuario como invitado.
- [ ] Recargar la página con sesión iniciada conserva al usuario (cookies de Supabase).
- [ ] "Jugar como invitado" navega a `/` sin sesión; un invitado puede jugar y guardar puntaje con `user_id` nulo.
- [ ] Un usuario logueado guarda un puntaje: la fila tiene `user_id = auth.users.id` y `name` igual al texto enviado (por defecto su username, editable).
- [ ] Un cliente no puede fijar `user_id`: `submit_score` no recibe ese parámetro y las tablas siguen sin políticas de escritura (`get_advisors` sin avisos de RLS nuevos).
- [ ] Un usuario no autenticado no puede leer `auth.users`; `profiles` solo expone `id`, `username`, `created_at`.
- [ ] `next` con valor externo (`https://x.com`, `//x.com`) redirige a `/`.
- [ ] `/auth` con sesión activa redirige a `/`; `/auth/username` sin sesión redirige a `/auth`.
- [ ] No existe `lib/session.ts` ni la clave `av_user` en el código; Nav, `GamePlayer` y `HallOfFame` funcionan con el nuevo `useSession`.
- [ ] La consola no muestra errores ni warnings de hydration en `/`, `/auth` y `/games/<id>/jugar`.
- [ ] Ninguna referencia a `service_role` en el repo.
- [ ] `CLAUDE.md` documenta la auth (acciones, callback, `profiles`, `scores.user_id`).

---

## Decisions

- **Sí:** Supabase Auth con `@supabase/ssr` y cookies (SPEC 04). Sesión válida en Server Actions y en `auth.uid()` del RPC.
- **Sí:** email+contraseña **y** OAuth Google/GitHub. Decisión del usuario; el costo es configuración manual en dashboard (paso 0).
- **Sí:** tabla `profiles` con `username` único en mayúsculas. Decisión del usuario; mantiene el estilo arcade (`PLAYER1`) y permite validar unicidad en BD.
- **Sí:** pantalla `/auth/username` tras el primer login OAuth. Decisión del usuario; evita nombres autogenerados raros a costa de una ruta extra.
- **Sí:** el username solo se escribe vía trigger (email) o RPC `set_username` (OAuth). **No:** políticas de escritura en `profiles`; mantiene el patrón "el cliente no escribe directo".
- **Sí:** reemplazar la sesión mock y conservar invitado (= sin sesión). Una sola fuente de verdad; Nav/GamePlayer/HallOfFame casi no cambian.
- **No:** convivir mock + Supabase. Doble estado, ambigüedad sobre quién es el usuario.
- **Sí:** `scores.name` libre + `scores.user_id`. Decisión del usuario; el nombre puede cambiar o ser distinto al username, el ID identifica siempre al jugador.
- **Sí:** `user_id` tomado de `auth.uid()` en el RPC. **No:** pasarlo desde el cliente (falsificable).
- **Sí:** `on delete set null` en `scores.user_id`. Borrar la cuenta no borra el ranking público.
- **Sí:** `getMyBest` por `user_id`. El nombre del puntaje ya no identifica al jugador.
- **Sí:** login por email. El diseño actual pedía "Usuario" sin validar; el email es el identificador estándar de Supabase.
- **Sí:** sesión del navegador hidratada en `useEffect` en `SessionProvider`. Mantiene el layout estático (sin `cookies()` en `app/layout.tsx`) y evita mismatch de hydration.
- **No:** confirmación de email ni protección de rutas. Decisión del usuario; el SMTP por defecto de Supabase tiene límites muy bajos.
- **No:** perfil editable, ranking por `user_id`, backfill. Cada uno en spec propio.
- **Sí:** errores genéricos y respuesta uniforme en recuperación. Evita enumeración de cuentas.

---

## Risks

| Riesgo                                                                                | Mitigación                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase limita envíos y solo entrega a miembros del proyecto. | Recuperación puede fallar en pruebas con correos externos; configurar SMTP propio (Resend ya existe) queda para otro spec. |
| OAuth mal configurado (redirect URL o secretos) rompe Google/GitHub.                  | Paso 0 lista lo exacto; el paso 7 se verifica con GitHub antes de seguir.                                                  |
| Usuario OAuth abandona `/auth/username` y queda con sesión sin perfil.                | `useSession` devuelve `user = null` sin perfil; `/auth/username` siempre disponible; sigue jugando como invitado.          |
| Carrera de unicidad entre el chequeo previo y el trigger.                             | El índice único es la verdad; el fallo del trigger se traduce a "Ese usuario ya existe".                                   |
| Fallo en el trigger bloquea todos los registros (`Database error saving new user`).   | Trigger mínimo, probado en el paso 2; sin lógica más allá de insertar el perfil.                                           |
| Open redirect vía `next`.                                                             | Solo rutas relativas que empiezan por `/` y no `//` (criterio de aceptación).                                              |
| Nombre de puntaje distinto al username puede suplantar a otro jugador visualmente.    | Aceptado: es decisión del usuario; el `user_id` permite identificar la verdad en un spec futuro.                           |
| Cambiar la firma de `getMyBest` rompe `HallOfFame`.                                   | Se actualiza en el mismo paso 10; build lo detecta.                                                                        |

---

## What is **not** in this spec

- Editar username/perfil, avatar, borrar cuenta.
- Confirmación de email, MFA, magic link, otros proveedores.
- Protección de rutas o roles.
- Ranking o estadísticas por `user_id`; backfill de puntajes antiguos.
- SMTP propio, captcha o rate limiting.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
