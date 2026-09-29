# SPEC 01 — MVP visual: pantallas de Arcade Vault

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-09-29
> **Objective:** Portar a Next.js (App Router) las 5 pantallas de `references/templates/` (biblioteca, detalle, reproductor simulado, auth, salón de la fama) con datos mock, sin implementar ningún juego real.

---

## Por qué existe este spec

El repo es un scaffold de `create-next-app`. Los templates de `references/templates/` son un prototipo React-por-CDN (SPA con hash, `window.*`, Babel). Este spec los convierte en código Next.js real, con la frontera de datos aislada para que una spec futura reemplace los mocks por una base de datos sin tocar la UI.

Ya está hecho (no se repite): `app/globals.css` (port de `styles.css` + variables Tailwind v4) y fuentes vía `next/font` en `app/layout.tsx` (`--font-press-start`, `--font-jetbrains`, `--font-courier`).

---

## Scope

**In:**

- Rutas App Router: `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon`.
- Componentes `Nav` (con menú móvil) y `Footer`, compartidos en `app/layout.tsx`.
- Datos mock tipados: juegos, categorías y puntuaciones semilla (`seededScores`).
- Sesión mock: login/registro/invitado/cerrar sesión, persistida en `localStorage` (`av_user`).
- Puntuaciones guardadas desde el reproductor en `localStorage` (`av_scores`), mostradas como "tu mejor marca" en el salón.
- Reproductor simulado: marco CRT, arena decorativa, HUD, pausa, fin, modal de guardar puntuación. El score sube aleatoriamente, como en el template.
- Filtro por texto y categoría en la biblioteca; tabs por juego en el salón.
- Responsive según `styles.css` (menú hamburguesa).
- Módulos `lib/session.ts` y `lib/scores.ts` como única frontera de persistencia.

**Out of scope (para specs futuras):**

- Cualquier juego real (lógica, canvas, input de teclado/táctil).
- Base de datos, autenticación real, hash de contraseñas, OAuth (Google/GitHub son botones inertes).
- Validación de formularios más allá del `required`/`type="email"` nativo.
- Tests automatizados (no hay runner configurado).
- Contador de créditos funcional (queda fijo en `CRÉDITOS · 03`).
- Leaderboards reales por juego (siguen siendo `seededScores`).

---

## Data model

```ts
// lib/data.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "green" | "yellow";

export type Game = {
  id: string;        // slug: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;     // clase CSS: "cover-bricks", ...
  color: Accent;
  best: number;
  plays: string;     // "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

export const GAMES: Game[];                         // los 8 juegos de data.jsx
export const CATS: ["TODOS", ...Category[]];
export function seededScores(seed: number, count?: number): ScoreRow[];
export function getGame(id: string): Game | undefined;

// lib/session.ts  (localStorage "av_user")
export type User = { name: string };               // MAYÚSCULAS, máx. 10 chars
export function getUser(): User | null;
export function login(user: User): void;
export function logout(): void;

// lib/scores.ts  (localStorage "av_scores")
export type SavedScore = { game: string; score: number; name: string; at: number };
export function saveScore(entry: Omit<SavedScore, "at">): void;
export function getBestScore(game: string, name: string): SavedScore | null;
```

Convenciones:

- Los datos de `GAMES`/`seededScores` se copian tal cual de `data.jsx` (mismo seed → mismas tablas).
- Números con `toLocaleString("es-ES")`.
- Toda lectura de `localStorage` va en `try/catch` y solo en cliente (dentro de `useEffect`), para no romper SSR ni causar hydration mismatch.
- `lib/session.ts` y `lib/scores.ts` son los únicos módulos que tocan `localStorage`; ningún componente lo hace directo. Una spec futura los reemplaza por acceso a base de datos.
- Estado de sesión compartido con un `SessionProvider` (`components/session-provider.tsx`, client) que expone `{ user, login, logout }` vía contexto.

---

## Implementation plan

1. Crear `lib/data.ts` con tipos, `GAMES`, `CATS`, `seededScores`, `getGame`. Verificar: `npm run build` compila.
2. Crear `lib/session.ts`, `lib/scores.ts` y `components/session-provider.tsx`. Verificar: build compila.
3. Crear `components/nav.tsx` (client, con menú móvil) y `components/footer.tsx`. Montar `SessionProvider`, `Nav`, `<main className="av-main">` y `Footer` en `app/layout.tsx`. Verificar: `/` muestra nav y footer sobre el scaffold.
4. Reemplazar `app/page.tsx` por la biblioteca: `components/game-card.tsx` (client, tilt) y `components/library.tsx` (client, búsqueda + chips + estado vacío). Verificar: filtrar por texto y categoría; click en tarjeta cambia a `/juegos/[id]`.
5. Crear `app/juegos/[id]/page.tsx` (detalle, server component, `notFound()` si el id no existe) con leaderboard de `seededScores`. Botón JUGAR → `/juegos/[id]/jugar`; VOLVER → `/`.
6. Crear `app/auth/page.tsx` + `components/auth-form.tsx` (client): tabs entrar/crear, campo email solo en registro, submit → `login()` y redirect a `/`, botón invitado → `logout()` y redirect a `/`. Verificar: el nav muestra el nombre tras entrar.
7. Crear `app/salon/page.tsx` + `components/hall-of-fame.tsx` (client): tabs por juego, podio, tabla, fila "tu mejor marca" (solo con usuario; usa `getBestScore`, o "AÚN SIN MARCA" si no hay).
8. Crear `app/juegos/[id]/jugar/page.tsx` + `components/game-player.tsx` (client): HUD, pausa, FIN, modal de fin con guardado (`saveScore`), reiniciar, volver. Verificar: guardar una marca y verla en `/salon`.
9. Limpiar el scaffold: eliminar contenido de ejemplo restante (`public/next.svg` etc. si no se usan) y ajustar `metadata` si hace falta. Verificar: `npm run lint` y `npm run build` pasan.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/` muestra hero, buscador, 5 chips (TODOS + 4 categorías) y 8 tarjetas.
- [ ] Escribir "gl" en el buscador deja solo la tarjeta GLOTÓN; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Elegir el chip PUZZLE deja solo CAÍDA.
- [ ] Click en una tarjeta o su botón JUGAR navega a `/juegos/<id>` (URL real, el botón atrás funciona).
- [ ] `/juegos/inexistente` devuelve 404.
- [ ] El detalle muestra portada, tags, descripción larga, stats y 10 filas de "MEJORES PUNTUACIONES" con top 3 destacado.
- [ ] "JUGAR AHORA" navega a `/juegos/<id>/jugar`; "VOLVER AL VAULT" navega a `/`.
- [ ] En el reproductor la puntuación aumenta cada ~220 ms; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la retoma.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN muestra "PUNTUACIÓN GUARDADA_"; JUGAR DE NUEVO reinicia score, vidas y nivel.
- [ ] Un score guardado aparece en `localStorage["av_scores"]` y como "TU MEJOR MARCA" en `/salon` para ese juego (usuario logueado).
- [ ] En `/auth` la pestaña CREAR CUENTA muestra el campo de correo; INICIAR SESIÓN no.
- [ ] Enviar el formulario con usuario "kai" redirige a `/`, el nav muestra `KAI ▾` y `localStorage["av_user"]` contiene `{"name":"KAI"}`.
- [ ] Recargar la página conserva la sesión; el botón del nav con nombre cierra sesión y vuelve a "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin sesión.
- [ ] `/salon` muestra podio (oro/plata/bronce), tabla de 12 filas y un chip por cada uno de los 8 juegos; cambiar de chip cambia las filas.
- [ ] A ancho ≤ 768 px aparece el botón hamburguesa y abre el panel lateral con los 3 enlaces.
- [ ] La consola del navegador no muestra errores ni warnings de hydration en ninguna de las 5 rutas.
- [ ] Ningún componente accede a `localStorage` fuera de `lib/session.ts` y `lib/scores.ts`.

---

## Decisions

- **Sí:** rutas reales del App Router en vez de SPA con hash. URLs compartibles, back/forward nativos, server components para detalle.
- **No:** replicar el estado de ruta en `location.hash` del template. Es un artefacto del prototipo.
- **Sí:** mock en `localStorage` (`av_user`, `av_scores`) detrás de `lib/session.ts` / `lib/scores.ts`. Así la migración a BD toca solo esos módulos.
- **No:** persistencia en memoria. Se pierde la sesión al recargar y no permite validar el flujo guardar → salón.
- **Sí:** reproductor simulado como en el template. Permite validar el flujo completo sin lógica de juego.
- **Sí:** reutilizar el `app/globals.css` ya portado (clases `av-*`, variables CSS). **No:** reescribir a utilidades Tailwind; riesgo de divergir del diseño.
- **Sí:** "tu mejor marca" en el salón lee `av_scores` real. **No:** el valor fake (`rows[5].score - 2400`, rango inventado) del template.
- **Sí:** leaderboards de detalle y salón siguen siendo `seededScores` (mock), porque no existe backend compartido.
- **Sí:** un solo spec para las 5 pantallas, pese a ser amplio: comparten nav, datos y sesión, y separarlas dejaría specs sin verificación visible.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Hydration mismatch al leer `localStorage` (nav, salón). | Leer solo en `useEffect`; renderizar estado "sin sesión" en el primer render. |
| `localStorage` bloqueado (modo privado). | `try/catch` en `lib/session.ts` y `lib/scores.ts`; la app funciona sin persistir. |
| Next 16 difiere del conocimiento previo (tipos `PageProps`, `params` asíncrono, `LayoutProps`). | Consultar `node_modules/next/dist/docs/` antes de escribir cada ruta (ver `AGENTS.md`). |
| Score aleatorio + `useEffect` de nivel del template puede subir nivel repetidamente. | Portar tal cual como comportamiento decorativo; no se verifica el nivel en los criterios. |
| `styles.css` usa `window.scrollTo`/animaciones que asumen SPA. | Las rutas de Next ya hacen scroll-to-top; no portar ese efecto. |

---

## What is **not** in this spec

- Ningún juego jugable.
- Base de datos ni auth real (spec futura que reemplaza `lib/session.ts`, `lib/scores.ts` y `lib/data.ts`).
- OAuth con Google/GitHub.
- Créditos funcionales.
- Tests automatizados.
- Leaderboards reales.

Cada uno, si llega, va en su propio spec.
