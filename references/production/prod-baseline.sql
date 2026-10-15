-- Arcade Vault: baseline de producción (equivale a las 7 migraciones de dev, estado final).
-- Pegar completo en Supabase prod -> SQL Editor -> Run. Idempotente: se puede repetir.
-- Datos: solo catálogo de juegos (sin puntajes ni usuarios).

begin;

-- ───────── Tablas ─────────
create table if not exists public.games (
  id          text primary key,
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  color       text not null check (color in ('cyan','magenta','green','yellow')),
  cover       text not null,
  players_min smallint not null default 1 check (players_min >= 1),
  players_max smallint not null default 1 check (players_max >= players_min),
  controls    text[] not null default '{keyboard}'
              check (controls <@ array['keyboard','touch','gamepad']),
  tags        text[] not null default '{}',
  difficulty  smallint not null default 3 check (difficulty between 1 and 5),
  sort_order  integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games(id),
  name       text not null check (char_length(name) between 1 and 12),
  score      integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null
);

create unique index if not exists profiles_username_key on public.profiles (username);
create index if not exists scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index if not exists scores_user_game_idx on public.scores (user_id, game_id, score desc);

create or replace view public.game_stats with (security_invoker = true) as
  select g.id as game_id, count(s.id)::int as plays, coalesce(max(s.score), 0) as best
  from public.games g left join public.scores s on s.game_id = g.id
  group by g.id;

-- ───────── RLS: lectura pública, sin políticas de escritura ─────────
alter table public.games    enable row level security;
alter table public.scores   enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "games: lectura pública"  on public.games;
drop policy if exists "scores: lectura pública" on public.scores;
drop policy if exists "profiles_read"           on public.profiles;
create policy "games: lectura pública"  on public.games    for select using (published);
create policy "scores: lectura pública" on public.scores   for select using (true);
create policy "profiles_read"           on public.profiles for select using (true);

-- ───────── Grants: solo SELECT a anon/authenticated (escrituras solo vía RPC) ─────────
revoke all on public.games, public.scores, public.profiles, public.game_stats from anon, authenticated;
grant select on public.games, public.scores, public.profiles, public.game_stats to anon, authenticated;

-- ───────── Funciones ─────────
create or replace function public.submit_score(p_game_id text, p_name text, p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.games where id = p_game_id and published) then
    raise exception 'game_not_scoreable';
  end if;
  insert into public.scores (game_id, name, score, user_id)
  values (p_game_id, p_name, p_score, auth.uid());
end;
$$;
revoke all on function public.submit_score(text, text, integer) from public;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username)
    values (new.id, upper(trim(new.raw_user_meta_data ->> 'username')));
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_username(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.profiles (id, username)
  values (auth.uid(), upper(trim(p_username)));
end;
$$;
revoke execute on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- rls_auto_enable lo crea Supabase (event trigger); si existe, sin EXECUTE público.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- ───────── Catálogo (estado actual de dev: los 5 publicados) ─────────
insert into public.games
  (id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty, sort_order, published)
values
  ('asteroids', 'ASTEROIDS', 'Parte las rocas antes de que te alcancen.',
   'Pilota tu nave en un campo de asteroides sin bordes: lo que sale por un lado entra por el otro. Cada roca grande se parte en medianas y luego en pequeñas. Tienes 3 vidas; recoge el 3x para disparar triple.',
   'SHOOTER', 'cyan', 'cover-asteroids', 1, 1, '{keyboard}', '{"RETRO 1985"}', 3, 1, true),
  ('tetris', 'TETRIS', 'Encaja las piezas y completa líneas.',
   'Rota y encaja piezas que caen en un tablero de 10×20. Completa líneas para sumar puntos; cada 10 líneas sube el nivel y la caída se acelera. Incluye la pieza N (tuerca) y pieza fantasma.',
   'PUZZLE', 'magenta', 'cover-tetris', 1, 1, '{keyboard}', '{CLÁSICO,LÍNEAS}', 3, 2, true),
  ('arkanoid', 'ARKANOID', 'Rompe todos los bloques con la pelota.',
   'Mueve la paleta con las flechas o el mouse para que la pelota no caiga y destruye todos los bloques. Cinco niveles con patrones distintos y una pelota cada vez más rápida; 10 puntos por bloque y 3 vidas.',
   'ARCADE', 'yellow', 'cover-arkanoid', 1, 1, '{keyboard}', '{CLÁSICO,ROMPEBLOQUES}', 2, 3, true),
  ('snake', 'SNAKE', 'Come frutas y crece sin chocar.',
   'Guía a la serpiente con las flechas o WASD para comer frutas y crecer. Chocar con el muro o con tu propio cuerpo termina la partida; cada fruta suma 10 puntos y la serpiente se acelera a medida que comes.',
   'ARCADE', 'green', 'cover-snake', 1, 1, '{keyboard}', '{CLÁSICO,SERPIENTE}', 2, 4, true),
  ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.',
   'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
   'ARCADE', 'green', 'cover-frogger', 1, 1, '{keyboard}', '{CLÁSICO,RANA}', 3, 5, true)
on conflict (id) do update set
  title = excluded.title, short = excluded.short, long = excluded.long,
  cat = excluded.cat, color = excluded.color, cover = excluded.cover,
  players_min = excluded.players_min, players_max = excluded.players_max,
  controls = excluded.controls, tags = excluded.tags,
  difficulty = excluded.difficulty, sort_order = excluded.sort_order,
  published = excluded.published;

commit;

-- ───────── Verificación (esperado: 5 juegos publicados, 3 políticas, trigger presente) ─────────
select
  (select count(*) from public.games where published)                         as juegos_publicados,
  (select count(*) from pg_policies where schemaname = 'public')              as politicas,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('games','scores','profiles') and c.relrowsecurity) as tablas_con_rls,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal) as trigger_auth,
  (select count(*) from public.scores)                                        as puntajes;

-- ACL de funciones: submit_score = anon+authenticated; set_username = authenticated; handle_new_user = ninguno.
select p.proname, p.proacl::text as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;
