# SPEC 03 — Página `/about` con formulario de contacto real (Resend)

> **Status:** Implementado  
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-29
> **Objective:** Mover "acerca de" + contacto de `/` a una página `/about` (mismo diseño de `references/templates/home-about/about.jsx`) y hacer que el formulario envíe un correo real al equipo mediante Resend y una Server Action.

---

## Por qué existe este spec

SPEC 02 dejó "acerca de" y un contacto simulado al final de `/` (`#acerca`) y marcó `/about` y el envío real como fuera de alcance. El usuario decidió ahora que "acerca de" tenga su propia ruta y que el contacto envíe correos de verdad. Este spec **reemplaza** esas dos decisiones de SPEC 02 (sección en el home, `/#acerca`); SPEC 02 no se edita porque ya está `Implemented`.

---

## Scope

**In:**

- Ruta `/about` (`app/about/page.tsx`) con las secciones de `about.jsx`: acerca de, divisor, contacto.
- Eliminar "acerca de" y contacto de `/` (`app/page.tsx` termina en `FinalCta`).
- Mover `components/home/about.tsx` y `components/home/contact-form.tsx` a `components/about/`. El título de la sección pasa a `h1`; se elimina `id="acerca"`.
- Nav (escritorio y panel móvil): "Acerca de" apunta a `/about` y queda activo en `/about*`.
- Server Action `sendContact` en `app/about/actions.ts` que valida y envía el correo con el SDK `resend`.
- Validación en servidor (obligatorios, formato de email, longitudes) y campo honeypot.
- Un solo correo, al equipo (`CONTACT_TO_EMAIL`), con `replyTo` = email del usuario. Sin auto-respuesta.
- Estados del formulario: reposo, enviando (botón deshabilitado), éxito (terminal del template), error de validación (shake), error de envío (mensaje inline).
- Variables de entorno `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` y archivo `.env.example`.

**Out of scope (para specs futuras):**

- Correo de confirmación al usuario (requiere dominio verificado en Resend).
- Rate limit por IP, captcha, cola de reintentos.
- Guardar mensajes en base de datos o panel de administración.
- Plantillas HTML de correo (se envía texto plano).
- Adjuntos, campo de asunto, selector de tipo de mensaje.
- Redirect de `/#acerca` a `/about`.
- Cambios de diseño respecto al template (salvo el estilo mínimo del mensaje de error).
- Tests automatizados (sigue sin haber runner).

---

## Data model

```ts
// lib/contact.ts  (sin "use server"; importable desde servidor y cliente)
export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export type ContactValues = { name: string; email: string; message: string };

export type ContactState =
  | { status: "idle"; values: ContactValues }
  | { status: "success"; name: string }
  | { status: "invalid"; values: ContactValues }      // dispara shake
  | { status: "error"; values: ContactValues; message: string }; // fallo de Resend/config

export function validateContact(input: ContactValues): boolean;
```

```ts
// app/about/actions.ts
"use server";
export async function sendContact(prev: ContactState, formData: FormData): Promise<ContactState>;
```

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

```
RESEND_API_KEY=          # clave de Resend
CONTACT_TO_EMAIL=        # destinatario (equipo)
CONTACT_FROM_EMAIL=      # remitente; por defecto "Arcade Vault <onboarding@resend.dev>"
```

Convenciones:

- Campos del `FormData`: `name`, `email`, `message`, `website` (honeypot; debe llegar vacío).
- `values` se devuelve en `invalid`/`error` para que los inputs no pierdan lo escrito (los formularios con Server Action se resetean).
- Se recorta (`trim`) todo antes de validar. Email: regex simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- Correo: `subject` = `[Arcade Vault] Mensaje de <name>` con saltos de línea eliminados de `name`; cuerpo solo `text` (nombre, email, mensaje), nunca `html`.
- Honeypot con valor → la acción devuelve `success` sin llamar a Resend.
- El detalle del error de Resend solo se registra con `console.error` en servidor; el usuario ve un mensaje genérico.

---

## Implementation plan

1. Mover `components/home/about.tsx` y `components/home/contact-form.tsx` a `components/about/` (`git mv`), crear `app/about/page.tsx` (`<Reveal />`, `<About />`, `<ContactForm />` dentro de `div.about fade-in`, `h1` en el título, sin `id="acerca"`) y quitar ambos del `app/page.tsx`. Verificar: `/about` muestra about + contacto simulado; `/` termina en el CTA final; `npm run build` compila.
2. Actualizar `components/nav.tsx`: "Acerca de" → `/about` con clase `active` en `/about*`, en escritorio y panel móvil. Verificar: el enlace navega y se resalta.
3. Instalar `resend` (`npm i resend`), crear `.env.example` con las 3 variables y añadir `!.env.example` a `.gitignore`. Verificar: `npm run build` compila.
4. Crear `lib/contact.ts` con `CONTACT_LIMITS`, tipos y `validateContact`. Verificar: build compila.
5. Crear `app/about/actions.ts` con `sendContact`: honeypot, validación, envío con Resend, manejo de `error` de la respuesta y de variables faltantes. Antes, leer `node_modules/next/dist/docs/01-app/02-guides/forms.md`. Verificar: build compila.
6. Cablear `components/about/contact-form.tsx` con `useActionState(sendContact, …)`: inputs `name`/`email`/`message` con `defaultValue` desde `state.values`, honeypot oculto (`tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), botón deshabilitado con `useFormStatus`/`pending`, terminal de éxito con `state.name`, shake en `invalid`, mensaje inline en `error`. "ENVIAR OTRO MENSAJE" reinicia el formulario (remount por `key`). Verificar: enviar con clave real llega el correo.
7. Añadir a `app/globals.css` el estilo mínimo del mensaje de error (`.form-error`) reutilizando variables existentes. Verificar: `npm run lint` y `npm run build` pasan.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/about` muestra en orden: kicker "ACERCA DE", `h1` "ACERCA DE ARCADE VAULT", misión, 3 highlights, divisor, contacto.
- [ ] `/` ya no contiene "ACERCA DE ARCADE VAULT" ni el formulario de contacto; la última sección es el CTA final.
- [ ] El nav (escritorio y móvil) enlaza "Acerca de" a `/about` y lo marca `active` en `/about`.
- [ ] Ninguna referencia a `#acerca` permanece en `app/`, `components/` ni `lib/`.
- [ ] Enviar con algún campo vacío, o con email sin formato válido, aplica `shake`, conserva lo escrito y no llama a Resend.
- [ ] Enviar con todos los campos válidos y variables correctas entrega un correo en `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo con nombre, email y mensaje, y `Reply-To` igual al email del usuario.
- [ ] Tras enviar, la terminal muestra `MENSAJE RECIBIDO ... GRACIAS, <NOMBRE EN MAYÚSCULAS>` solo después de que la acción responde con éxito.
- [ ] Mientras la acción está pendiente el botón está deshabilitado.
- [ ] Sin `RESEND_API_KEY` (o con una clave inválida) el formulario muestra un mensaje de error genérico, conserva lo escrito y no muestra la terminal de éxito.
- [ ] Mensaje > 2000 caracteres, nombre > 60 o email > 254 se rechazan en servidor (estado `invalid`).
- [ ] Con el campo `website` relleno la acción responde éxito y no se envía ningún correo.
- [ ] Un nombre con saltos de línea no altera el `subject` (queda en una sola línea).
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente ni en ninguna respuesta de red.
- [ ] `.env.example` existe, está versionado y no contiene valores reales; `.env.local` sigue ignorado.
- [ ] La consola del navegador no muestra errores ni warnings de hydration en `/` y `/about`.

---

## Decisions

- **Sí:** `/about` separada y quitar la sección del home. Decisión del usuario; evita dos formularios reales.
- **No:** mantener about/contacto también en `/`. Duplica contenido y `id`.
- **Sí:** Server Action + `useActionState`. La clave de Resend nunca sale del servidor y no hay endpoint público que mantener.
- **No:** Route Handler `POST /api/contact`. Más código (fetch, parseo, CORS) sin otro consumidor.
- **Sí:** un solo correo al equipo con `replyTo` del usuario. Suficiente para responder desde el cliente de correo.
- **No:** auto-respuesta al usuario. Con `onboarding@resend.dev` Resend solo entrega al dueño de la cuenta; requiere dominio verificado.
- **Sí:** validación en servidor + honeypot. Cubre bots simples sin dependencias.
- **No:** rate limit en memoria. No es fiable en serverless/reinicios y sin Redis no vale la complejidad.
- **Sí:** correo en texto plano. Elimina el riesgo de inyección HTML con contenido del usuario.
- **Sí:** `CONTACT_FROM_EMAIL` con valor por defecto `Arcade Vault <onboarding@resend.dev>`. Permite probar sin dominio; producción lo sobrescribe.
- **Sí:** la validación real vive en el servidor; el cliente no duplica reglas (el `shake` se dispara con el estado `invalid`).
- **Sí:** mover los componentes a `components/about/`. Ya no pertenecen al home.
- **Sí:** mensaje de éxito solo tras respuesta del servidor. **No:** el éxito optimista del template simulado.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `onboarding@resend.dev` solo entrega al correo dueño de la cuenta de Resend. | Poner ese correo en `CONTACT_TO_EMAIL` en desarrollo; documentarlo en `.env.example`. |
| Falta de variables de entorno en producción. | La acción comprueba `RESEND_API_KEY` y `CONTACT_TO_EMAIL`, registra el motivo y devuelve estado `error`. |
| Formularios con Server Action resetean los inputs. | `defaultValue` desde `state.values` en `invalid`/`error`. |
| Next 16 difiere del conocimiento previo (`useActionState`, Server Actions). | Consultar `node_modules/next/dist/docs/` antes de escribir la acción (ver `AGENTS.md`). |
| Enlaces externos a `/#acerca` dejan de llevar a la sección. | Aceptado: la app no está publicada; sin redirect (fuera de alcance). |
| Spam que pase el honeypot. | Aceptado en este spec; rate limit/captcha en un spec futuro. |

---

## What is **not** in this spec

- Correo de confirmación al usuario.
- Rate limit, captcha o cola de reintentos.
- Base de datos de mensajes o panel de administración.
- Plantillas HTML de correo, adjuntos, campo de asunto.
- Redirect desde `/#acerca`.
- Cambios de diseño respecto al template.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
