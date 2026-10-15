# Puesta en producción (Supabase prod)

Claude NO tiene acceso a prod. Todo lo de este archivo lo ejecuta el usuario a mano.
Dev: `wyntxoeivipiytzpzkbc` (MCP). Prod: `<prod-ref>` (solo el usuario).

## 0. Aislar a Claude de prod

- [ ] `.mcp.json` mantiene `project_ref=wyntxoeivipiytzpzkbc`. Quitar `account` de `features` (permite listar otros proyectos de la cuenta): `features=docs,database,debugging,development,functions,branching`.
- [ ] Idealmente prod en otra organización de Supabase.
- [ ] Nunca poner credenciales de prod (`.env.local`) con claves privilegiadas; `.env.local` apunta a dev.

## 1. Base de datos

- [ ] Prod → SQL Editor → pegar completo `references/production/prod-baseline.sql` → Run.
- [ ] Salida esperada: `juegos_publicados=5`, `politicas=3`, `tablas_con_rls=3`, `trigger_auth=1`, `puntajes=0`. ACL: `submit_score` anon+authenticated, `set_username` authenticated, `handle_new_user` y `rls_auto_enable` sin anon/authenticated.
- [ ] Advisors (Security): solo deben quedar los 3 warnings aceptados (`submit_score` anon/authenticated, `set_username` authenticated). Ver `references/security/security-checklist.md`.

## 2. Auth → dashboard

- [ ] Sign In / Providers: Email activo; **Confirm email desactivado**; contraseña mínima 8; leaked password protection si el plan lo permite.
- [ ] URL Configuration: Site URL `https://arcadevault.xyz`; Redirect URLs exactas, sin `*`: `https://arcadevault.xyz/auth/callback` (sin localhost).
- [ ] Rate limits de sign-up/sign-in por IP: valor holgado (SPEC 15; el servidor de Next aparece como una sola IP).
- [ ] SMTP: el integrado solo entrega a miembros del proyecto y tiene límites bajos; para recuperación de clave real configurar SMTP propio (p. ej. Resend con dominio verificado).

## 3. OAuth (apps nuevas para prod)

- [ ] Google: Cloud Console → credencial OAuth web; Authorized redirect URI `https://<prod-ref>.supabase.co/auth/v1/callback`; Client ID/Secret en Supabase prod → Providers → Google.
- [ ] GitHub: OAuth App nueva; Authorization callback URL `https://<prod-ref>.supabase.co/auth/v1/callback`; Client ID/Secret en Supabase prod → Providers → GitHub.

## 4. Variables del hosting (prod)

| Variable                               | Valor                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<prod-ref>.supabase.co`                                                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` de prod (Project Settings → API Keys)                                               |
| `NEXT_PUBLIC_SITE_URL`                 | `https://arcadevault.xyz` (obligatoria: sin ella la app falla en producción)                           |
| `RESEND_API_KEY`                       | clave de Resend                                                                                        |
| `CONTACT_TO_EMAIL`                     | correo del equipo                                                                                      |
| `CONTACT_FROM_EMAIL`                   | remitente en dominio verificado en Resend (`onboarding@resend.dev` solo entrega al dueño de la cuenta) |

Nunca `service_role`/secret keys. `SUPABASE_DB_PASSWORD` no lo usa la app.

## 5. Verificación E2E en el sitio

- [ ] `/games` lista 5 juegos; `/games/<id>/jugar` carga cada uno.
- [ ] Invitado: jugar, guardar puntaje → aparece en `/salon`.
- [ ] Registro por email con username → Nav muestra el username; cerrar sesión.
- [ ] Login Google y GitHub → `/auth/username` → elegir username.
- [ ] Recuperar contraseña (llega correo, `/auth/nueva-clave` funciona).
- [ ] Formulario de `/about` envía correo.
- [ ] Headers de seguridad presentes (HSTS, X-Frame-Options…).

## 6. Cambios futuros de esquema

Cada migración aplicada a dev por MCP se aplica a mano en prod (SQL Editor), en el mismo orden. Registrar aquí:

| Fecha      | Migración dev                      | Aplicada en prod |
| ---------- | ---------------------------------- | ---------------- |
| 2026-10-15 | baseline (7 migraciones iniciales) | pendiente        |
