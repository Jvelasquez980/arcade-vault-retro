# SPEC 16 — Hardening de autenticación (redirects, URL base fija y sesiones)

> **Status:** Implementado
> **Depends on:** SPEC 14, SPEC 15
> **Date:** 2026-10-15
> **Objective:** Corregir los hallazgos de la revisión de seguridad de auth: `safeNext` sin caracteres de control, URL base fija por env en vez de `Host`, cierre de otras sesiones al cambiar la contraseña y tope de 72 caracteres en la contraseña.

---

## Por qué existe este spec

La revisión de `app/auth/actions.ts`, `app/auth/callback/route.ts`, `lib/auth-validation.ts` y `proxy.ts` (ver también `references/security/security-status.md`) encontró cuatro puntos accionables:

- `safeNext` acepta `/\t//evil.com`; los navegadores quitan tab/CR/LF de las URLs y el `Location` queda como `//evil.com` (open redirect en `redirect(safeNext(...))` de `signUp`, `signIn`, `chooseUsername`).
- `callbackUrl` y el callback derivan el origen de `Host`/`x-forwarded-host`, sin validar (riesgo de envenenar el enlace de recuperación si la allowlist de Redirect URLs es amplia).
- `updatePassword` no cierra las demás sesiones.
- `passwordError` no tiene máximo.

Decisiones del usuario (no se reabren): fallback a `http://localhost:3000` solo en desarrollo; máximo de 72 caracteres; pasos de dashboard manuales dentro de este spec.

---

## Scope

**In:**

- `lib/auth-validation.ts`: `safeNext` rechaza caracteres de control y valida que la ruta resuelta sea del mismo origen; `AUTH_LIMITS.passwordMax = 72` y `passwordError` lo aplica.
- `lib/site-url.ts` (nuevo): `getSiteUrl()` lee `NEXT_PUBLIC_SITE_URL`.
- `app/auth/actions.ts`: `callbackUrl` usa `getSiteUrl()` (se elimina el uso de `headers()`); `updatePassword` llama `signOut({ scope: "others" })` tras `updateUser`.
- `app/auth/callback/route.ts`: `base` sale de `getSiteUrl()` (se elimina `x-forwarded-host`).
- `.env.example`: añade `NEXT_PUBLIC_SITE_URL`.
- Pasos manuales en el dashboard de Supabase (Auth → URL Configuration): Site URL = URL de producción; Redirect URLs sin comodines (`/auth/callback` exacto por entorno).
- `references/security/security-status.md` y `CLAUDE.md`: reflejar los hallazgos cerrados y la variable nueva.

**Out of scope (para otros specs):**

- Verificar el trigger `handle_new_user` y los CHECK de `profiles.username` (auditoría de BD con `security-auditor`).
- Pedir la contraseña actual para cambiarla (re-autenticación).
- Rate limiting propio en la app, CAPTCHA.
- Leaked password protection y límites por IP (ya cubiertos en SPEC 15).
- Content-Security-Policy.

---

## Data model

Sin tablas ni migraciones. Cambios:

```ts
// lib/auth-validation.ts
export const AUTH_LIMITS = {
  usernameMin: 3,
  usernameMax: 10,
  passwordMin: 8,
  passwordMax: 72,
  email: 254,
} as const;
```

Variable de entorno nueva:

| Variable               | Ejemplo                   | Uso                                               |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | `https://arcadevault.xyz` | Origen para `redirectTo` y redirects del callback |

Reglas de `getSiteUrl()` (`lib/site-url.ts`):

- Devuelve el valor de `NEXT_PUBLIC_SITE_URL` sin `/` final.
- Si falta y `NODE_ENV !== "production"`, devuelve `http://localhost:3000`.
- Si falta en producción, lanza `Error("NEXT_PUBLIC_SITE_URL no definida")`.

Reglas de `safeNext(raw)`:

- Devuelve `"/"` si no es string, si no empieza por `/`, si empieza por `//`, o si contiene `\` o cualquier carácter `\u0000–\u001f` / `\u007f`.
- Además `new URL(raw, "http://x").origin` debe ser `"http://x"`; si no, `"/"`.

---

## Implementation plan

1. `lib/auth-validation.ts`: endurecer `safeNext` y añadir `passwordMax` a `AUTH_LIMITS` y `passwordError`. Comprobar con un script puntual en Node (fuera del repo) los casos de Acceptance criteria.
2. Crear `lib/site-url.ts` con `getSiteUrl()` y añadir `NEXT_PUBLIC_SITE_URL` a `.env.example` y a `.env.local`.
3. `app/auth/actions.ts`: reescribir `callbackUrl` con `getSiteUrl()` y quitar el import de `headers`. Probar login con Google/GitHub y el correo de recuperación en local.
4. `app/auth/callback/route.ts`: usar `getSiteUrl()` como `base`; quitar `x-forwarded-host`. Probar OAuth y recuperación.
5. `app/auth/actions.ts`: en `updatePassword`, tras `updateUser` sin error, `await supabase.auth.signOut({ scope: "others" })`. Consultar `node_modules/@supabase/auth-js` si la firma difiere.
6. Usuario, en el dashboard → Authentication → URL Configuration: Site URL de producción y Redirect URLs exactas, sin `*`. Definir `NEXT_PUBLIC_SITE_URL` en el hosting.
7. Actualizar `references/security/security-status.md` (hallazgos 1–4 cerrados) y `CLAUDE.md` (línea de `site-url.ts` y la variable).

---

## Acceptance criteria

- [ ] `safeNext("/\t//evil.com")`, `safeNext("/\n//evil.com")`, `safeNext("//evil.com")`, `safeNext("/\\evil.com")` y `safeNext("https://evil.com")` devuelven `"/"`.
- [ ] `safeNext("/games/snake/jugar?x=1")` y `safeNext("/salon")` se devuelven sin cambios.
- [ ] Registrar o cambiar contraseña con 73 caracteres devuelve error; con 72 pasa.
- [ ] Con `Host: evil.test` en la petición, el `redirectTo` enviado a Supabase sigue siendo `NEXT_PUBLIC_SITE_URL` + `/auth/callback?...`.
- [ ] En producción sin `NEXT_PUBLIC_SITE_URL`, iniciar OAuth lanza error explícito; en dev usa `http://localhost:3000`.
- [ ] `app/auth/actions.ts` y `app/auth/callback/route.ts` no leen `host` ni `x-forwarded-host`.
- [ ] Login con Google/GitHub, registro, login por email y recuperación de contraseña (correo → `/auth/callback` → `/auth/nueva-clave`) funcionan en local.
- [ ] Tras cambiar la contraseña en una sesión, otra sesión abierta del mismo usuario deja de ser válida y la actual sigue activa.
- [ ] El dashboard de Supabase no tiene comodines en Redirect URLs (confirmado por el usuario).
- [ ] `npm run lint` y `npm run build` pasan.

---

## Decisions

- **Sí:** URL base fija por env. El `Host` lo controla el cliente o el proxy; una variable de entorno no.
- **No:** validar `Host` contra una lista en código. Duplica la allowlist de Supabase y es más frágil que una sola variable.
- **Sí:** fallback a `localhost:3000` solo fuera de producción. Evita fricción en dev sin reabrir el riesgo en producción.
- **No:** fallback al `Host` si falta la variable. Deja el hallazgo abierto en el entorno que más importa.
- **Sí:** `safeNext` con lista de caracteres de control y comprobación de origen con `URL`. Dos capas; la segunda cubre casos que la regex no prevea.
- **Sí:** `signOut({ scope: "others" })` tras cambiar clave. Invalida sesiones robadas sin sacar al usuario actual.
- **No:** pedir contraseña actual. Cambia el flujo de recuperación (no la tiene); spec propio si se quiere.
- **Sí:** máximo 72. Es el límite de bcrypt; evita truncado silencioso y inputs enormes.
- **No:** auditar el trigger de BD aquí. Es trabajo del `security-auditor` por MCP.

---

## Risks

| Riesgo                                                                   | Mitigación                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Despliegue sin `NEXT_PUBLIC_SITE_URL` rompe OAuth y recuperación         | Error explícito; definir la variable antes del deploy (paso 6) y en previews si se usan.     |
| Previews con otro dominio dejan de funcionar con OAuth                   | Definir la variable por entorno y añadir cada Redirect URL exacta en Supabase.               |
| `scope: "others"` no disponible o con firma distinta en la versión usada | Verificar en `@supabase/auth-js` antes del paso 5; si falla, no bloquear el cambio de clave. |
| Usuarios con contraseña de más de 72 caracteres ya registrada            | El máximo se aplica solo al crear/cambiar; el login (`signIn`) no lo valida.                 |

---

## What is **not** in this spec

Auditoría del trigger/CHECK de `profiles`, re-autenticación para cambiar clave, rate limiting propio, CAPTCHA, CSP.
