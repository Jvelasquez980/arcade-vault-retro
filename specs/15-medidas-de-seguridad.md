# SPEC 15 — Medidas de seguridad básicas (headers, Supabase Auth y advisors)

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 06, SPEC 14
> **Date:** 2026-10-15
> **Objective:** Aplicar el checklist de `references/security/security-checklist.md`: headers de seguridad en Next.js, protección optimista de rutas de auth en `proxy.ts`, revocar la ejecución pública de `rls_auto_enable`, endurecer Auth en el dashboard y documentar los warnings de Supabase que se aceptan a propósito.

---

## Por qué existe este spec

El checklist pide RLS, contraseña mínima, leaked password protection, límite de signups por IP, headers de seguridad y revisar los warnings del panel de Supabase. Parte ya está cumplida (RLS en las 3 tablas, mínimo 8 en el cliente/servidor) pero sin verificar ni documentar; el resto falta.

Decisiones del usuario (no se reabren): `submit_score` y `set_username` siguen `security definer` con `EXECUTE` para sus roles y su warning se acepta y documenta; headers = los 3 del checklist + HSTS + Permissions-Policy (sin CSP); los ajustes de Auth del dashboard son pasos manuales del usuario dentro de este spec; la protección de rutas con `proxy.ts` entra en este spec, acotada a las dos rutas de auth que exigen sesión (sin proteger juego, salón ni puntajes: los invitados siguen jugando).

---

## Scope

**In:**

- `next.config.ts`: `headers()` con `source: "/(.*)"` y los headers del data model.
- `lib/supabase/proxy.ts` + `proxy.ts`: `updateSession` devuelve `{ response, claims }` (de `getClaims()`) y `proxy` redirige según la tabla de rutas protegidas (Data model), copiando las cookies refrescadas a la respuesta de redirección. Barrera optimista: las páginas siguen validando con `getUser()` (ya lo hacen).
- Migración por MCP `revoke_rls_auto_enable_execute`: `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;` (es función de event trigger; no necesita ser RPC).
- Verificación (sin cambios) de RLS en `games`, `scores`, `profiles`.
- Pasos manuales del usuario en el dashboard de Supabase (Auth): contraseña mínima 8, leaked password protection, rate limit de sign-ups/sign-ins por IP.
- `references/security/security-checklist.md`: marcar cada ítem y añadir sección "Warnings aceptados" con la justificación de `submit_score` y `set_username`.
- `CLAUDE.md`: una línea sobre headers en `next.config.ts` y warnings aceptados.

**Out of scope:**

- Content-Security-Policy (riesgo de romper fuentes, Supabase y OAuth; spec propio).
- CAPTCHA en registro, rate limiting propio en la app (middleware/Server Actions).
- Cambiar `submit_score`/`set_username` a `security invoker` o usar claves privilegiadas.
- Anti-trampas de puntajes (validación de partida en servidor).
- Proteger `/games`, `/salon`, `/about` o `/jugar` (los invitados juegan y puntúan por diseño, SPEC 14).
- Redirigir `/auth` si ya hay sesión (un usuario OAuth sin `profiles` actúa como invitado y debe poder volver a `/auth`).
- Control de roles/permisos por usuario (no existen roles).

---

## Data model

Sin datos nuevos. Cambios:

- Headers (`next.config.ts`):

  | Header                      | Valor                                      |
  | --------------------------- | ------------------------------------------ |
  | `X-Content-Type-Options`    | `nosniff`                                  |
  | `X-Frame-Options`           | `DENY`                                     |
  | `Referrer-Policy`           | `strict-origin-when-cross-origin`          |
  | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`      |
  | `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()` |

- Rutas protegidas en `proxy.ts` (sin claims válidos = sin sesión):

  | Ruta                | Sin sesión                    | Con sesión                                  |
  | ------------------- | ----------------------------- | ------------------------------------------- |
  | `/auth/username`    | redirige a `/auth`            | pasa (la página decide si ya tiene perfil)  |
  | `/auth/nueva-clave` | redirige a `/auth/recuperar`  | pasa                                        |

  El `matcher` actual se mantiene; la lógica filtra por `request.nextUrl.pathname`. El resto de rutas (incl. `/auth`, `/auth/recuperar`, `/auth/callback`) no se tocan.

- Privilegios: `public.rls_auto_enable()` solo ejecutable por `postgres`/`service_role`.

---

## Implementation plan

1. Añadir `securityHeaders` y `headers: async () => [{ source: "/(.*)", headers: securityHeaders }]` a `next.config.ts` (conservando `allowedDevOrigins`). Consultar `node_modules/next/dist/docs/` (headers) antes.
2. Modificar `lib/supabase/proxy.ts` (`updateSession` devuelve `{ response, claims }`) y `proxy.ts` (redirecciones de la tabla; copiar cookies de `response` al `NextResponse.redirect`). Consultar `node_modules/next/dist/docs/` (proxy) antes.
3. Aplicar por MCP la migración `revoke_rls_auto_enable_execute`.
4. Verificar por MCP `relrowsecurity = true` en `games`, `scores`, `profiles` y correr `get_advisors(security)`.
5. Usuario, en el dashboard → Authentication: (a) Password: mínimo 8; (b) activar leaked password protection (requiere plan Pro; si no está disponible, se anota en el checklist); (c) Rate limits: sign-ups/sign-ins por IP a 30 por 5 min (se confirma valor al implementar).
6. Actualizar `references/security/security-checklist.md` (ítems marcados + "Warnings aceptados") y `CLAUDE.md` (incluye la línea de `proxy.ts`, que ya no «solo refresca la sesión»).

---

## Acceptance criteria

- [ ] `curl -sI http://localhost:3000/` y `/games/snake/jugar` devuelven los 5 headers con los valores de la tabla.
- [ ] Sin sesión (ventana privada), `/auth/username` redirige a `/auth` y `/auth/nueva-clave` a `/auth/recuperar`; con sesión, ambas cargan.
- [ ] El flujo completo de recuperación de contraseña (correo → `/auth/callback` → `/auth/nueva-clave`) y el de OAuth nuevo (→ `/auth/username`) siguen funcionando; la sesión no se pierde al redirigir.
- [ ] La home, `/games/<id>/jugar`, `/auth` (incl. login con Google/GitHub) y `/about` funcionan igual que antes.
- [ ] `get_advisors(security)` ya no lista `rls_auto_enable`; solo quedan los 3 warnings aceptados (`submit_score` anon/authenticated, `set_username` authenticated).
- [ ] Un invitado y un usuario logueado pueden seguir guardando puntaje; un usuario OAuth nuevo puede elegir username.
- [ ] RLS activo en `games`, `scores`, `profiles` (consulta MCP).
- [ ] Registrar con contraseña de 7 caracteres falla (cliente y, saltando el cliente, Supabase).
- [ ] El checklist tiene todos los ítems marcados o con nota explícita de por qué no aplica (p. ej. leaked password en plan Free).
- [ ] `npm run lint` y `npm run build` pasan.

---

## Decisions

- **`submit_score` sigue `security definer` ejecutable por `anon`/`authenticated`:** los invitados puntúan con la clave publishable; el RPC fija `user_id` desde `auth.uid()` y las constraints de BD limitan nombre/puntaje. Descartado: `security invoker` + política INSERT (abre insert directo por REST) y clave `service_role` (CLAUDE.md lo prohíbe).
- **`set_username` sigue `security definer` para `authenticated`:** necesario para OAuth; ya revocado a `anon`. Descartado: invoker + política INSERT en `profiles`.
- **`rls_auto_enable` se revoca, no se borra:** es el event trigger que activa RLS en tablas nuevas; sigue funcionando sin `EXECUTE` para roles de API.
- **Headers sin CSP:** HSTS y Permissions-Policy son de bajo riesgo; CSP requiere ajuste fino y queda para otro spec.
- **Proxy protege solo `/auth/username` y `/auth/nueva-clave`:** son las únicas rutas que exigen sesión; el resto es público por diseño (SPEC 14). Descartado: redirigir `/auth` con sesión (rompería a usuarios OAuth sin perfil) y consultar `profiles` desde el proxy (una query por petición). El proxy es barrera optimista con `getClaims()`; la autorización real sigue en páginas/Server Actions con `getUser()`.
- **Ajustes de Auth como pasos manuales:** el MCP no expone la configuración de Auth.

---

## Risks

- **Rate limit por IP con Server Actions:** `signUp`/`signIn` se ejecutan en el servidor de Next, así que Supabase puede ver la IP del servidor y no la del jugador; un límite bajo bloquearía a todos. Mitigación: valor holgado y verificar en logs de Auth; rate limit propio queda fuera de scope.
- **Leaked password protection solo en plan Pro:** en Free queda sin activar y documentado.
- **HSTS:** solo aplica sobre HTTPS; en `localhost` el navegador lo ignora. Con `includeSubDomains` todo subdominio debe servir HTTPS.
- **Redirección en el proxy:** si se devuelve un `NextResponse.redirect` nuevo sin copiar las cookies de `updateSession`, se pierde el refresco de sesión. Mitigación: copiar cookies y verificar el flujo de recuperación.
- **`X-Frame-Options: DENY`:** impide embeber el sitio en iframes (aceptado).

---

## Referencias

- Next.js — Proxy: https://nextjs.org/docs/app/getting-started/proxy (convención `proxy.ts`, `matcher`, redirecciones y cookies). Copia offline en `node_modules/next/dist/docs/`.

---

## What is **not** in this spec

CSP, CAPTCHA, rate limiting en la app, protección de rutas públicas, roles, anti-trampas de puntajes, auditoría de dependencias.
