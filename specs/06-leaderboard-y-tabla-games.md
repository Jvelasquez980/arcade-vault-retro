# SPEC 06 — Catálogo de juegos y leaderboard en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 02, SPEC 04, SPEC 05
> **Date:** 2026-10-02
> **Objective:** Mover el catálogo a la tabla `games` de Supabase (solo Asteroids, con todos sus metadatos y leída por la UI), eliminar los juegos simulados y reemplazar los rankings de relleno por puntajes reales guardados desde el modal de fin de partida y mostrados en la ficha del juego y en el Salón de la Fama.

---

## Por qué existe este spec

SPEC 04 dejó Supabase conectado pero con el esquema `public` vacío. Hoy el catálogo vive en `lib/data.ts` (`GAMES`, 9 entradas, solo una real), los rankings (`/games/[id]` y `/salon`) salen de `seededScores` (datos falsos) y los puntajes van a `localStorage` (`av_scores`), invisibles para otros jugadores. Asteroids (SPEC 05) es el único juego real.

Decisiones del usuario (no se reabren):

- **Los juegos simulados desaparecen** (incluido `rocas`, que SPEC 05 había dejado intacto): el catálogo es solo Asteroids.
- `games` guarda **todos** los metadatos del juego (categoría, descripción, jugadores, controles, tags, dificultad, portada, color) y la UI los **lee de la BD**; añadir un juego nuevo no debe requerir rehacer el esquema.
- Los puntajes viven en Supabase; el nombre escrito en el modal se guarda en la BD **y** se recuerda en `localStorage` para precargarlo la próxima vez.
- El leaderboard se muestra en la ficha del juego (panel "Mejores puntuaciones", antes de jugar) y en el Salón de la Fama.
- Inserción por Server Action; el ranking lista todas las partidas (top N por puntaje); se eliminan los datos de relleno.

---

## Scope

**In:**

- Migración Supabase: tablas `games` (catálogo con metadatos) y `scores`, RLS, índices, vista `game_stats`, función `submit_score` y siembra de **una** fila (`asteroids`, textos copiados de `lib/data.ts`).
- `lib/catalog.ts`: tipos del catálogo, `CATS` y lecturas del servidor (`listGames`, `getGame`) que unen metadatos y estadísticas.
- `lib/leaderboard.ts`: lecturas del servidor (`getTopScores`, `getBestByName`).
- `lib/scores-validation.ts`: validación de nombre y puntaje (patrón de `lib/contact.ts`).
- Server Action `submitScore` (`app/games/[id]/jugar/actions.ts`) que valida y llama al RPC, y revalida `/salon` y `/games/<id>`.
- La UI lee el catálogo de la BD en: `/games` (`Library`), home (`GamesPreview`), `/games/[id]`, `/games/[id]/jugar` y `/salon`. `Library`, `GameCard` y `HallOfFame` reciben los juegos por props.
- Ficha `/games/[id]`: jugadores, controles, tags y dificultad salen de columnas (hoy fijos en el JSX); panel "Mejores puntuaciones" (top 10) real con estado vacío; `Partidas` y `Mejor global` reales.
- Eliminar los juegos simulados: sus entradas de `GAMES`, la rama de simulación de `components/game-player.tsx` (puntaje aleatorio, `setInterval`, nivel por módulo) y `lib/scores.ts` (`av_scores`). `GamePlayer` queda solo con el motor de Asteroids.
- Modal de fin de partida: precarga el nombre recordado, guarda por Server Action, estados `guardando` y `error`. Recordar el nombre en `localStorage` (`av_player_name`).
- Salón de la Fama: pestañas generadas desde `games`, podio y tabla reales (top 12), estado vacío y podio con menos de 3 filas.
- `app/error.tsx` mínimo (mensaje y botón "Reintentar") para cuando falle la lectura del catálogo.
- Eliminar `lib/data.ts` (`GAMES`, `getGame`, `seededScores`, `ScoreRow`, `PLAYERS`).
- Actualizar `CLAUDE.md` (Architecture).

**Out of scope (para specs futuras):**

- Supabase Auth real; los puntajes no se ligan a un usuario (`user_id`).
- Anti-trampas real (el puntaje lo reporta el cliente), rate limiting, captcha.
- Un registro genérico de motores: `GamePlayer` sigue montando solo Asteroids; el spec del próximo juego real lo generaliza.
- Panel de administración o UI para crear juegos; se insertan por migración/SQL.
- Subir portadas a Storage: `cover` sigue siendo una clase CSS de `app/globals.css`.
- Borrar del CSS las clases `cover-*` huérfanas de los juegos eliminados.
- Contenido estático del home que no es catálogo (`lib/home-data.ts`: `ACTIVITY`, `TOP_TODAY`, stats), aunque nombre juegos eliminados.
- Ranking "mejor por nombre", filtros por fecha, paginación, realtime.
- Moderación de nombres.
- Caché/ISR del catálogo (`use cache`).
- Tipos generados (`supabase gen types`).
- Tests automatizados (no hay runner).

---

## Data model

Migración `create_games_and_scores` (aplicada con `mcp__supabase__apply_migration`):

```sql
create table public.games (
  id          text primary key,                 -- slug en URL: "asteroids"
  title       text not null,
  short       text not null,                    -- descripción de tarjeta
  long        text not null,                    -- descripción de la ficha
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  color       text not null check (color in ('cyan','magenta','green','yellow')),
  cover       text not null,                    -- clase CSS en globals.css ("cover-asteroids")
  players_min smallint not null default 1 check (players_min >= 1),
  players_max smallint not null default 1 check (players_max >= players_min),
  controls    text[] not null default '{keyboard}'
              check (controls <@ array['keyboard','touch','gamepad']),
  tags        text[] not null default '{}',     -- p. ej. '{"RETRO 1985"}'
  difficulty  smallint not null default 3 check (difficulty between 1 and 5),
  sort_order  integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games(id),
  name       text not null check (char_length(name) between 1 and 12),
  score      integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);

create view public.game_stats with (security_invoker = true) as
  select g.id as game_id, count(s.id)::int as plays, coalesce(max(s.score), 0) as best
  from public.games g left join public.scores s on s.game_id = g.id
  group by g.id;

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games: lectura pública"  on public.games  for select using (published);
create policy "scores: lectura pública" on public.scores for select using (true);
-- Sin políticas de insert/update/delete: nadie escribe directo con la clave publishable.

create function public.submit_score(p_game_id text, p_name text, p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.games where id = p_game_id and published) then
    raise exception 'game_not_scoreable';
  end if;
  insert into public.scores (game_id, name, score) values (p_game_id, p_name, p_score);
end;
$$;

revoke all on function public.submit_score(text, text, integer) from public;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;
```

Siembra (única fila; `short` y `long` copiados literalmente de `lib/data.ts`):

```sql
insert into public.games
  (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order)
values
  ('asteroids', 'ASTEROIDS', 'Parte las rocas antes de que te alcancen.', '<texto de lib/data.ts>',
   'SHOOTER', 'cyan', 'cover-asteroids', 1, 1, '{keyboard}', '{"RETRO 1985"}', 3, 1);
```

Tipos y funciones de aplicación:

```ts
// lib/catalog.ts (servidor; usa lib/supabase/server.ts)
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "green" | "yellow";
export const CATS: ["TODOS", ...Category[]];

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  color: Accent;
  cover: string;
  playersMin: number;
  playersMax: number;
  controls: ("keyboard" | "touch" | "gamepad")[];
  tags: string[];
  difficulty: number;
  plays: number; // game_stats.plays
  best: number; // game_stats.best
};

export async function listGames(opts?: { limit?: number }): Promise<Game[]>; // published, por sort_order
export async function getGame(id: string): Promise<Game | null>;
export function formatPlays(n: number): string; // 12400 → "12.4K", 0 → "0"

// lib/leaderboard.ts
export type ScoreRow = { name: string; score: number; createdAt: string };
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;
export async function getBestByName(
  gameId: string,
  name: string,
): Promise<ScoreRow | null>;

// lib/scores-validation.ts
export function validateScoreInput(input: {
  gameId: unknown;
  name: unknown;
  score: unknown;
}):
  | { ok: true; value: { gameId: string; name: string; score: number } }
  | { ok: false; error: string };

// app/games/[id]/jugar/actions.ts ("use server")
export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

Convenciones:

- Etiquetas de la ficha derivadas de columnas: jugadores (`1 JUGADOR` / `1–2 JUGADORES`), controles (`keyboard` → `TECLADO`, `touch` → `TÁCTIL`, `gamepad` → `MANDO`, unidos con `/`), `tags` tal cual y dificultad como `difficulty` estrellas llenas de 5.
- Añadir un juego nuevo = una migración con un `insert` en `games`, su clase `cover-*` en CSS y su motor; `/games/<id>/jugar` hoy solo monta el motor de Asteroids, así que un juego nuevo requiere el spec que generalice `GamePlayer`. Hasta entonces, `/games/<id>/jugar` de cualquier `id` distinto de `asteroids` responde 404 y no se debe publicar un juego sin motor (`published = false`).
- `ScoreRow` ordena por `score desc, created_at asc` (desempata el más antiguo).
- `plays` = filas guardadas en `scores` (partidas guardadas, no jugadas); `best` = `max(score)` o `0`.
- Nombre: `trim`, 1–12 caracteres, se guarda tal cual (sin forzar mayúsculas). Puntaje: entero entre 0 y 10 000 000.
- `localStorage`: clave `av_player_name` (string), siempre client-side con `try/catch`, igual que `lib/session.ts`. La clave `av_scores` deja de usarse y no se migra.
- Los errores de Supabase nunca se devuelven al cliente tal cual; el cliente recibe un mensaje genérico en español.
- Fechas del ranking `dd/mm/aaaa` (formato actual).

---

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` (Server Components async, Server Actions, `revalidatePath`, `error.tsx`) según `AGENTS.md`, y `mcp__supabase__list_tables` para confirmar que el esquema sigue vacío. Aplicar la migración con la siembra. Verificar: `execute_sql` muestra 1 fila en `games` con textos idénticos a `lib/data.ts`; `get_advisors` (security) sin tablas sin RLS; `insert` directo en `scores` con la clave publishable falla; `submit_score('asteroids', …)` inserta y `submit_score('rocas', …)` falla; se borran las filas de prueba.
2. Crear `lib/catalog.ts`, `lib/leaderboard.ts` y `lib/scores-validation.ts`. Verificar: `npm run build` y `npm run lint` pasan.
3. Migrar la lectura del catálogo, sin tocar rankings todavía: `/games` (`app/games/page.tsx` async pasa `games` a `Library`), `GameCard` y `GamesPreview` (async, `listGames({ limit: 6 })`) usan `Game` de `lib/catalog.ts`; `app/games/[id]/jugar/page.tsx` usa `getGame` y responde 404 si el juego no es `asteroids`. Añadir `app/error.tsx`. Verificar: `/`, `/games` (búsqueda y filtros) y `/games/asteroids/jugar` funcionan; `/games/rocas` da 404.
4. Quitar la simulación: borrar de `components/game-player.tsx` la rama simulada (puntaje aleatorio, `setInterval`, nivel por módulo, `isAsteroids`) y dejar solo el motor; las entradas simuladas desaparecen al estar ya fuera de la BD. Verificar: `/games/asteroids/jugar` se juega como antes (HUD, pausa, `P`, FIN, modal); `npm run lint` y `npm run build` pasan.
5. Crear `app/games/[id]/jugar/actions.ts` con `submitScore` (valida, `supabase.rpc("submit_score", …)`, `revalidatePath("/salon")` y `revalidatePath("/games/<id>")`). Verificar: build compila; nombre vacío o puntaje negativo devuelve `{ ok: false }`.
6. Integrar en el modal de `GamePlayer`: input precargado con `av_player_name` (si no existe, nombre de sesión), guardado con `submitScore`, botón deshabilitado mientras guarda, error con reintento y `saved` solo si `ok`; guardar `av_player_name` tras éxito; borrar `lib/scores.ts` y su import. Verificar: jugar, terminar, guardar y ver la fila en `scores`; al terminar otra partida el nombre aparece cargado.
7. Ficha `app/games/[id]/page.tsx`: usar `getGame`; renderizar jugadores, controles, tags y dificultad desde el juego; stats desde `plays`/`best`; cargar `getTopScores(id, 10)` y mostrar el panel con estado vacío "AÚN NO HAY PUNTAJES · SÉ EL PRIMERO". Verificar: `/games/asteroids` muestra el puntaje guardado.
8. Salón: `app/salon/page.tsx` carga `listGames()` y `getTopScores(id, 12)` por juego y pasa todo a `HallOfFame`; el componente genera las pestañas de esas props, soporta 0–2 filas en el podio y reemplaza `getBestScore` local por `getBestByName` (Server Action de lectura) en el bloque "tu mejor". Verificar: `/salon` muestra el ranking real y el estado vacío sin errores.
9. Eliminar `lib/data.ts` y comprobar con `grep` que nadie lo importa (`lib/home-data.ts` importa `Accent` de `@/lib/catalog`). Actualizar `CLAUDE.md` (Architecture: catálogo y puntajes en Supabase, `lib/catalog.ts`, `lib/leaderboard.ts`, `submit_score`, `av_player_name`, cómo añadir un juego; quitar la mención de la simulación y de `av_scores`) y correr `npm run lint` y `npm run build`.

---

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] En Supabase existen `public.games` (1 fila: `asteroids`), `public.scores` y la vista `public.game_stats`; las dos tablas con RLS activo y sin advertencias de seguridad en `get_advisors`.
- [ ] `title`, `short` y `long` de la fila `asteroids` son idénticos a los de `lib/data.ts` antes de borrarlo.
- [ ] `/games` y el home muestran únicamente ASTEROIDS, leído de la BD; búsqueda y filtro por categoría siguen funcionando (SHOOTER lo muestra, ARCADE no).
- [ ] `/games/rocas`, `/games/bloque-buster` y los demás ids de juegos eliminados responden 404; `/games/rocas/jugar` también.
- [ ] No quedan en el repo la simulación de partidas (puntaje aleatorio en `components/game-player.tsx`), `lib/scores.ts`, `GAMES`, `getGame` de `lib/data.ts` ni `seededScores`; `lib/data.ts` no existe.
- [ ] Insertar un juego de prueba en `games` (published, con clase `cover-*` existente) hace que aparezca en `/games` y en `/games/<id>` sin cambiar código; el 404 de `/jugar` para ese id es el esperado; borrar la fila de prueba al terminar.
- [ ] Un juego con `published = false` no aparece en `/games`, el home ni `/games/<id>` (404).
- [ ] La ficha de Asteroids muestra `1 JUGADOR`, `TECLADO`, el tag `RETRO 1985` y 3 estrellas llenas de 5, según las columnas.
- [ ] Un `insert` directo en `scores` con la clave publishable es rechazado; `submit_score` con datos válidos para `asteroids` inserta una fila.
- [ ] `submit_score` para un juego inexistente falla; con nombre de 13 caracteres o puntaje negativo falla por `CHECK`.
- [ ] Terminar una partida de Asteroids, escribir un nombre y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con `game_id = 'asteroids'`, ese nombre y el puntaje final; el botón no permite un segundo guardado de la misma partida.
- [ ] Al terminar otra partida, el input del modal aparece con el nombre guardado en `av_player_name` y se puede guardar sin escribir.
- [ ] Si `submitScore` falla (p. ej. sin red), el modal muestra un error en español, no marca como guardado y permite reintentar.
- [ ] Nombre vacío o de más de 12 caracteres y puntaje fuera de rango son rechazados por la Server Action sin llegar a la BD.
- [ ] `/games/asteroids` muestra "MEJORES PUNTUACIONES" con hasta 10 filas reales ordenadas por puntaje descendente (empates: más antiguo primero), con nombre, fecha `dd/mm/aaaa` y puntaje; con `scores` vacío muestra el estado vacío y `Mejor global` en `0`.
- [ ] `Partidas` y `Mejor global` de `/games/asteroids` coinciden con `count(*)` y `max(score)` de `scores`.
- [ ] `/salon` muestra una pestaña por juego publicado (hoy solo ASTEROIDS); podio y tabla coinciden con la BD; con 0, 1 o 2 puntajes no hay errores ni filas `undefined`.
- [ ] Un puntaje guardado aparece en `/salon` y en `/games/asteroids` sin reiniciar el servidor.
- [ ] El juego sigue funcionando como en SPEC 05: HUD, pausa (botón y `P`), FIN, "JUGAR DE NUEVO" y teclado.
- [ ] Con la URL de Supabase inválida, `/games` muestra `app/error.tsx` con botón "Reintentar" y sin filtrar claves ni stack traces.
- [ ] La consola no muestra errores ni warnings de hydration en `/`, `/games`, `/salon`, `/games/asteroids` y `/games/asteroids/jugar`.
- [ ] Ninguna referencia a `service_role` en el repo.
- [ ] `CLAUDE.md` documenta tablas, RPC, `lib/catalog.ts`, `lib/leaderboard.ts`, `av_player_name` y los pasos para añadir un juego, y ya no menciona la simulación de partidas ni `av_scores`.

---

## Decisions

- **Sí:** eliminar los juegos simulados (incluido `rocas`). Decisión del usuario; desaparecen del catálogo, del código de simulación y de la BD. Esto reemplaza lo dicho en SPEC 05 ("no eliminar `rocas`").
- **Sí:** `games` con todos los metadatos y la UI leyendo de la BD. Decisión del usuario; evita rehacer el esquema al sumar juegos. **No:** `games` mínima con el catálogo duplicado en `lib/data.ts` (deriva y dos fuentes de verdad).
- **Sí:** `controls`, `tags` como `text[]` y `players_min/max` numéricos. Cubren los datos hoy fijos en el JSX sin tablas auxiliares. **No:** tablas `tags`/`controls` normalizadas: sobreingeniería para un catálogo pequeño.
- **Sí:** `cover` guarda el nombre de la clase CSS. Las portadas son CSS puro (gradientes), no archivos; Storage va en otro spec.
- **No:** columnas `engine`, `mock_plays`, `mock_best`. Existían solo para convivir con juegos simulados; sin ellos, todo juego publicado es jugable y puntúa.
- **Sí:** `game_stats` (vista) para `plays`/`best` en vivo. **No:** guardar contadores en `games` (se desincronizan).
- **Sí:** `published` y `sort_order`. Permiten ocultar un juego sin motor y controlar el orden del home/vault sin tocar código.
- **Sí:** `GamePlayer` solo con Asteroids y 404 en `/jugar` para otros ids. **No:** un registro genérico de motores ahora: sin un segundo motor real no hay forma de validar la abstracción (YAGNI); lo introduce el spec del próximo juego.
- **Sí:** puntajes en Supabase. Decisión del usuario. **No:** fallback a `localStorage` si falla la red (mezcla fuentes y muestra puntajes que nadie más ve). **No:** migrar `av_scores` existentes (eran de juegos simulados o de relleno).
- **Sí:** inserción vía Server Action → RPC `submit_score` (`security definer`). Decisión del usuario sobre la Server Action; el RPC es necesario porque sin Auth y sin política de insert la clave publishable no puede escribir. **No:** política de insert pública en `scores` (cualquiera insertaría desde el navegador sin pasar por validación).
- **Sí:** validación doble: `lib/scores-validation.ts` (mensajes amigables) y `CHECK` en la BD. El tope de 10 000 000 es una cota anti-abuso burda, no anti-trampas.
- **Sí:** el nombre se guarda en la BD y se recuerda en `localStorage` (`av_player_name`). Decisión del usuario. **No:** ligar el puntaje a una cuenta; Auth real va en otro spec.
- **Sí:** nombre de 1–12 caracteres. Convención nueva decidida aquí; cabe en la columna del ranking sin desbordar.
- **Sí:** ranking con todas las partidas, top N por puntaje. Decisión del usuario. **No:** mejor puntaje por nombre; requiere agrupación y no es necesario sin cuentas.
- **Sí:** eliminar `seededScores` y mostrar estados vacíos. Decisión del usuario; mezclar datos falsos con reales confunde.
- **Sí:** `lib/catalog.ts` (no `lib/games.ts`) para no chocar con el directorio `lib/games/` de los motores.
- **Sí:** `revalidatePath` tras guardar, para que ficha y Salón muestren el puntaje al instante.
- **No:** tests automatizados; no hay runner. La verificación es manual/Playwright y con `execute_sql`.

---

## Risks

| Risk                                                                                                   | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El catálogo pasa a depender de Supabase: si falla, caen `/`, `/games` y las fichas.                    | `app/error.tsx` con "Reintentar"; criterio de aceptación con URL inválida. Caché/ISR queda para un spec futuro.                                                   |
| Las páginas pasan a ser dinámicas (cookies + BD) y suben la latencia.                                  | Aceptado; consultas pequeñas con índice y `limit`; `proxy.ts` ya existe.                                                                                          |
| Con un solo juego, el vault, el home y el Salón se ven casi vacíos.                                    | Aceptado por decisión del usuario; el layout no se rediseña en este spec.                                                                                         |
| `lib/home-data.ts` (`ACTIVITY`, `TOP_TODAY`) y otros textos del home nombran juegos que ya no existen. | Fuera de alcance; se limpia en un spec del home. Documentado para no confundirlo con un bug de este spec.                                                         |
| Borrar la rama de simulación de `GamePlayer` rompe el flujo de Asteroids (HUD, pausa, modal).          | Paso 4 verifica el juego completo antes de seguir; criterio de aceptación de no regresión.                                                                        |
| Textos del catálogo alterados al sembrar (tildes, comillas).                                           | Copiar literalmente de `lib/data.ts` antes de borrarlo y comparar con `execute_sql`.                                                                              |
| El puntaje lo reporta el cliente: se puede enviar un valor falso a la Server Action.                   | Aceptado (sin Auth ni verificación en servidor); cota `CHECK` y validación; anti-trampas en un spec futuro.                                                       |
| Spam de inserciones llamando a `submit_score` con la clave publishable (ejecutable por `anon`).        | Aceptado; rate limiting en un spec futuro. La FK, `published` y los `CHECK` limitan el daño al ruido en el ranking.                                               |
| `security definer` mal configurado permite escalar privilegios.                                        | `set search_path = ''`, nombres calificados con `public.`, `revoke all … from public`, `grant execute` solo a `anon, authenticated`; `get_advisors` en el paso 1. |
| Nombres ofensivos o con HTML en el ranking.                                                            | React escapa el texto; sin moderación (fuera de alcance).                                                                                                         |
| Una fila nueva en `games` con `cover` inexistente muestra una tarjeta sin imagen.                      | Documentado en `CLAUDE.md`: añadir primero la clase `cover-*` en `globals.css`.                                                                                   |
| Next 16 difiere del conocimiento previo (Server Actions, `PageProps`, `revalidatePath`, `error.tsx`).  | Paso 1 consulta `node_modules/next/dist/docs/` (ver `AGENTS.md`).                                                                                                 |
| El lint de React 19 (`react-hooks/set-state-in-effect`) rechaza leer `av_player_name` en un efecto.    | Inicialización perezosa del estado o lectura en el callback de fin de partida; no silenciar la regla.                                                             |
| Doble envío por doble clic en "GUARDAR".                                                               | Botón deshabilitado durante el envío y tras el éxito.                                                                                                             |

---

## What is **not** in this spec

- Supabase Auth real ni `user_id` en `scores`.
- Anti-trampas, rate limiting o moderación de nombres.
- Juegos reales nuevos ni un registro genérico de motores.
- Panel de administración, Storage de portadas, caché del catálogo.
- Limpieza del contenido estático del home (`ACTIVITY`, `TOP_TODAY`, stats) ni de las clases `cover-*` huérfanas.
- Filtros por fecha, paginación, ranking por nombre, realtime.
- Tipos generados de Supabase.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
