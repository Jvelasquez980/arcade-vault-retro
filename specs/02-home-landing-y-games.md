# SPEC 02 — Home landing (home + acerca de) en `/` y biblioteca en `/games`

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-29
> **Objective:** Reemplazar `/` por una única página landing (home + acerca de + contacto, portada de `references/templates/home-about/`) y mover la biblioteca de juegos, el detalle y el reproductor a `/games`.

---

## Por qué existe este spec

SPEC 01 dejó la biblioteca como página de inicio. El template `home-about` define una landing de marketing y una sección "acerca de". El usuario decidió fusionarlos en **una sola página** que sea la URL inicial de la app; la biblioteca pasa a tener su propia ruta.

---

## Scope

**In:**

- `app/page.tsx` pasa a ser la landing: secciones del `home.jsx` (hero, ¿por qué?, juegos disponibles, stats, actividad en vivo, precios/FAQ, CTA final) seguidas de las del `about.jsx` (acerca de, divisor, contacto) en la misma página.
- Ruta `/games` con la biblioteca actual (`components/library.tsx`, sin cambios de comportamiento).
- Mover `app/juegos/[id]` → `app/games/[id]` y `app/juegos/[id]/jugar` → `app/games/[id]/jugar`. Se elimina `/juegos/*` (sin redirects).
- Actualizar todos los enlaces internos a las rutas nuevas (nav, tarjetas, detalle, reproductor, auth, salón).
- Nav: enlaces `Inicio` (`/`), `Biblioteca` (`/games`), `Salón de la Fama` (`/salon`), `Acerca de` (`/#acerca`, ancla dentro del home); el logo apunta a `/`. Aplica al menú móvil.
- Portar a `app/globals.css` los estilos del `styles.css` del template que falten (`home-*`, `about-*`, `contact-*`, `feature-*`, `mini-*`, `activity-*`, `pricing-*`, `reveal`, etc.).
- Efecto `reveal` (IntersectionObserver) en un hook cliente reutilizable.
- Formulario de contacto simulado: solo estado local (validación de vacíos, shake, terminal de éxito). No envía nada.
- Datos del home hardcodeados como en el template (actividad, top jugadores, stats, precios/FAQ); las 6 mini-tarjetas usan `GAMES.slice(0, 6)`.

**Out of scope (para specs futuras):**

- Página `/about` separada.
- Envío real del formulario de contacto (endpoint, email).
- Actividad/top del home derivados de `av_scores` o de una base de datos.
- Redirects desde `/juegos/*`.
- Créditos funcionales, juegos reales, auth real (siguen fuera, como en SPEC 01).
- Cambios de diseño respecto al template.

---

## Data model

Este spec no introduce estructuras de datos de dominio nuevas; reutiliza `Game`, `GAMES` de SPEC 01. Solo constantes de presentación del home, tipadas y locales:

```ts
// lib/home-data.ts
export type ActivityRow = { p: string; g: string; s: number; t: string; c: Accent };
export type TopRow = { r: number; p: string; s: number };

export const ACTIVITY: ActivityRow[];   // 7 filas, copiadas de home.jsx
export const TOP_TODAY: TopRow[];       // 5 filas, copiadas de home.jsx
```

Convenciones:

- Los valores se copian tal cual de `home.jsx`.
- Números con `toLocaleString("es-ES")`.
- Las secciones estáticas (features, stats, precios, FAQ) viven en sus componentes.

---

## Implementation plan

1. Mover `app/juegos/[id]` → `app/games/[id]` (incluye `jugar`) y actualizar los `href`/`router.push` que apunten a `/juegos/...` (`game-card`, detalle, `game-player`). Verificar: `npm run build` compila; `/games/<id>` y `/games/<id>/jugar` cargan.
2. Crear `app/games/page.tsx` con `<Library />`. Verificar: `/games` muestra la biblioteca.
3. Reemplazar `/` de forma segura: crear `lib/home-data.ts` y portar los estilos faltantes del template a `app/globals.css`. Verificar: build compila, `/` sin cambios visibles aún.
4. Crear `hooks/use-reveal.ts` (client) y `components/home/` con `hero.tsx` (incluye `FloatingSilhouettes`), `features.tsx` (incluye `FeatureIcon`), `games-preview.tsx` (`MiniCard`, enlaza a `/games/<id>` y "VER TODOS" a `/games`), `stats.tsx`. Componer en `app/page.tsx`. Verificar: `/` muestra esas secciones.
5. Añadir `components/home/activity.tsx` (enlace "VER SALÓN" → `/salon`), `pricing.tsx` ("EMPEZAR GRATIS" → `/auth`) y `final-cta.tsx` ("INSERTAR MONEDA" → `/games`). Los CTA del hero: "EXPLORAR JUEGOS" → `/games`, "CREAR CUENTA" → `/auth`. Verificar: todos los enlaces navegan.
6. Añadir `components/home/about.tsx` (con `HighlightIcon`, `id="acerca"`) y `components/home/contact-form.tsx` (client, simulado), debajo de las secciones del home. Verificar: enviar vacío hace shake; enviar completo muestra la terminal de éxito.
7. Actualizar `components/nav.tsx`: enlaces Inicio/Biblioteca/Salón/Acerca de en escritorio y panel móvil; `isActive` (Inicio nunca activo, incluso en `/`; Biblioteca en `/games*`). Ajustar redirects: "VOLVER AL VAULT" del detalle → `/games`; login e invitado en `/auth` siguen a `/`. Verificar: `npm run lint` y `npm run build` pasan.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/` muestra en orden: hero, ¿por qué?, juegos disponibles, stats, actividad en vivo, precios, CTA final, acerca de y contacto.
- [ ] `/` no contiene la biblioteca (sin buscador ni chips de categoría).
- [ ] `/games` muestra hero de biblioteca, buscador, 5 chips y 8 tarjetas (mismo comportamiento que SPEC 01).
- [ ] La sección de juegos del home muestra 6 mini-tarjetas; click en una navega a `/games/<id>`.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/games`.
- [ ] "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; "VER SALÓN →" navega a `/salon`.
- [ ] `/games/<id>` muestra el detalle y `/games/<id>/jugar` el reproductor; `/games/inexistente` devuelve 404.
- [ ] `/juegos`, `/juegos/<id>` y `/juegos/<id>/jugar` devuelven 404.
- [ ] "VOLVER AL VAULT" en el detalle navega a `/games`.
- [ ] Tras iniciar sesión o entrar como invitado en `/auth`, la redirección va a `/`.
- [ ] El nav muestra Inicio, Biblioteca, Salón de la Fama y Acerca de; Biblioteca y Salón activos en su ruta (Biblioteca también en `/games/<id>` y `/games/<id>/jugar`); en `/` ningún enlace queda activo (incluido Inicio).
- [ ] "Acerca de" lleva a `/#acerca` y hace scroll a la sección de acerca de.
- [ ] Las secciones con clase `reveal` aparecen (`.in`) al entrar en viewport.
- [ ] En el formulario de contacto, enviar con algún campo vacío aplica `shake` y no muestra éxito; con todos rellenos muestra la terminal con `MENSAJE RECIBIDO ... GRACIAS, <NOMBRE EN MAYÚSCULAS>`; "ENVIAR OTRO MENSAJE" reinicia el formulario.
- [ ] El formulario de contacto no realiza ninguna petición de red.
- [ ] A ancho ≤ 768 px el panel móvil muestra los 4 enlaces + cuenta.
- [ ] La consola del navegador no muestra errores ni warnings de hydration en `/`, `/games`, `/games/<id>` y `/games/<id>/jugar`.
- [ ] Ninguna referencia a `/juegos` permanece en `app/`, `components/` ni `lib/`.

---

## Decisions

- **Sí:** home y about en una sola página en `/`. Decisión del usuario; el "acerca de" queda como sección con ancla `#acerca`.
- **No:** ruta `/about` separada. Contradice la decisión anterior.
- **Sí:** `/games` para biblioteca y mover detalle/reproductor a `/games/[id]`. Un solo prefijo coherente.
- **No:** mantener `/juegos/[id]`. Mezcla dos idiomas/prefijos para el mismo recurso.
- **No:** redirects desde `/juegos/*`. La app no está publicada; ahorra config.
- **Sí:** login/invitado siguen redirigiendo a `/`; "VOLVER AL VAULT" va a `/games`. La landing es la entrada; volver "al vault" significa la biblioteca. (Asumido por coherencia; el usuario puede cambiarlo al revisar el spec.)
- **Sí:** contacto simulado como el template. Un envío real necesita backend; su propio spec.
- **Sí:** datos del home hardcodeados. Igual que el template; el ranking real depende de la futura BD.
- **Sí:** estilos del template portados a `globals.css` (clases existentes). **No:** reescribir a utilidades Tailwind, mismo criterio que SPEC 01.
- **Sí:** split del home en componentes por sección en `components/home/`. Evita un archivo de ~400 líneas.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Enlaces a `/juegos` olvidados tras el renombre. | Criterio de aceptación con búsqueda de `/juegos` en el código. |
| `useReveal` con `IntersectionObserver` rompe hydration o deja secciones invisibles (`opacity:0`) si falla. | Hook cliente en `useEffect`; contenido renderizado en SSR con la clase `reveal` y activado solo en cliente. |
| Ancla `/#acerca` no hace scroll al navegar desde otra ruta. | Usar `<Link href="/#acerca">`; el App Router soporta hash. Verificar manualmente desde `/games`. |
| Colisión de clases entre `styles.css` del template y `globals.css` existente. | Portar solo las clases que falten; comparar antes de pegar. |
| Next 16 difiere del conocimiento previo. | Consultar `node_modules/next/dist/docs/` antes de mover rutas (ver `AGENTS.md`). |

---

## What is **not** in this spec

- Página `/about` independiente.
- Envío real del formulario de contacto.
- Datos reales para actividad y top del home.
- Redirects desde `/juegos/*`.
- Cambios en la lógica de la biblioteca, detalle, reproductor o salón (solo cambian sus rutas y enlaces).
- Juegos reales, base de datos, auth real, tests automatizados.

Cada uno, si llega, va en su propio spec.
