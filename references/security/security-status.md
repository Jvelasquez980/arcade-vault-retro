# Estado de seguridad — Arcade Vault

Auditado por `.claude/agents/security-auditor.md` contra SPEC 14 y 15.

**Última auditoría:** 2026-10-15

## Resultado

| Área | Ítem                                | Estado | Nota                                                                                                                      |
| ---- | ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| BD   | Advisors security                   | ⚠️     | Solo los 3 aceptados (`submit_score` anon/auth, `set_username` auth); `rls_auto_enable` ya no aparece                     |
| BD   | Advisors performance                | ⚠️     | INFO `unused_index` `scores_user_game_idx` (índice nuevo, poco tráfico)                                                   |
| BD   | RLS en todas las tablas             | ✅     | `games`, `scores`, `profiles` con `relrowsecurity = true`                                                                 |
| BD   | Políticas solo `select`             | ✅     | 3 políticas SELECT (`games` filtra `published`); ninguna de escritura                                                     |
| BD   | Funciones `security definer`        | ✅     | 4 funciones con `search_path` fijado; EXECUTE coincide con lo aceptado; `rls_auto_enable` sin EXECUTE para anon/auth      |
| BD   | Grants a anon/authenticated         | ⚠️     | Grants por defecto (INSERT/UPDATE/DELETE/TRUNCATE…) en las 3 tablas y la vista; RLS bloquea DML; TRUNCATE no pasa por RLS |
| BD   | Vista `game_stats`                  | ✅     | `security_invoker=true`                                                                                                   |
| BD   | Constraints                         | ✅     | `scores` nombre 1–12 y puntaje 0–10M; `profiles.username` regex + único; FK `scores.user_id` `on delete set null`         |
| BD   | Migraciones                         | ✅     | 7 revisadas (baseline); última `revoke_rls_auto_enable_execute`                                                           |
| BD   | Logs (auth/postgres)                | ✅     | Solo actividad de pruebas (1 login fallido, 1 username duplicado); sin patrones de abuso                                  |
| App  | Secretos / claves privilegiadas     | ✅     | Sin `service_role`/`sb_secret` en código; `.env*` ignorado; `.env.example` vacío; cliente solo `NEXT_PUBLIC_*`            |
| App  | Headers de seguridad                | ✅     | 5 headers con valores de SPEC 15 (verificado por `curl` en `/` y `/games/snake/jugar`)                                    |
| App  | `proxy.ts` rutas protegidas         | ✅     | `/auth/username`→`/auth`, `/auth/nueva-clave`→`/auth/recuperar` sin sesión; cookies copiadas al redirect                  |
| App  | Server Actions (validación/getUser) | ⚠️     | Validan en servidor, errores genéricos, reset uniforme; `callbackUrl` arma `redirectTo` desde `Host`/`X-Forwarded-Host`   |
| App  | `safeNext` / open redirect          | ❌     | No rechaza caracteres de control: `/\t/evil.com` lo acepta y el navegador lo resuelve a `//evil.com`                      |
| App  | `user_id` y escrituras del cliente  | ✅     | `user_id` solo desde `auth.uid()`; cliente sin insert/update/delete/upsert; RPC solo desde Server Actions                 |
| App  | XSS / localStorage / contacto       | ✅     | Sin `dangerouslySetInnerHTML`/`eval`/`innerHTML`; localStorage solo nombre y skin; Resend sin CRLF en subject/replyTo     |
| App  | `npm audit --omit=dev`              | ❌     | 2 high: `next` 16.3.7 (fix 16.4.2, no major) y `source-map-js` 1.2.1 (transitiva)                                         |
| App  | Archivos nuevos desde último status | N/A    | Primera auditoría (baseline)                                                                                              |

## Hallazgos abiertos

- (medio) `safeNext` acepta `\t`, `\n`, `\r` → open redirect tras login (`/auth?next=%2F%09%2Fevil.com`) — `lib/auth-validation.ts:67-72` — rechazar caracteres de control y comprobar origen con `new URL(raw, "http://x").origin === "http://x"`.
- (medio) `redirectTo` de OAuth y recuperación de clave se deriva de `Host`/`X-Forwarded-Host` (posible envenenamiento del enlace de reset si la allowlist de Redirect URLs de Supabase es amplia) — `app/auth/actions.ts:122-129` — usar una URL base fija por env (`NEXT_PUBLIC_SITE_URL`) y revisar que Redirect URLs no tenga comodines.
- (alto) Dependencias: `next` 16.3.7 con advisories high (cache poisoning, SSRF en Image Optimization, etc.) — `package.json` — actualizar a 16.4.2; `source-map-js` vía `npm audit fix`.
- (bajo) Grants por defecto de DML/TRUNCATE a `anon`/`authenticated` en `games`, `scores`, `profiles`, `game_stats` — defensa en profundidad: `revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;` (mantener `select`).
- (bajo) `scores.user_id` y `profiles.id` legibles públicamente por REST (vinculan puntajes con cuentas); por diseño de lectura pública — valorar ocultar `user_id` con vista o grant por columna.
- (bajo) `next.config.ts:19` `allowedDevOrigins` incluye `*.trycloudflare.com` (solo dev) — quitar cuando no se use el túnel.

## Pendientes fuera de alcance

CSP, CAPTCHA, rate limiting propio (incl. formulario de contacto), anti-trampas de puntajes. Ajustes manuales de Auth en dashboard (mín. 8, leaked password, rate limit por IP) no verificables por MCP.

## Historial

- 2026-10-15: 12 ✅, 4 ⚠️, 2 ❌, 1 N/A (baseline)
