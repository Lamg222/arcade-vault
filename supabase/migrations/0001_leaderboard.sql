-- 0001_leaderboard.sql — spec 06 (leaderboard con Supabase y tabla de juegos)
--
-- Crea las tablas `games` y `scores`, sus índices, habilita RLS (Row Level Security
-- — reglas por fila que deciden quién lee/escribe) y crea las políticas, y siembra
-- `games` con el catálogo actual (derivado de app/data/games.ts). NO siembra `scores`.
--
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS para poder
-- re-aplicarse sin romper. Aplícala en el SQL Editor del dashboard de Supabase o vía
-- la Supabase CLI (herramienta de terminal).

-- ── Tabla games ────────────────────────────────────────────────────────────────
-- Catálogo, solo lectura pública. `id` es el slug (identificador legible, p.ej.
-- `asteroides`). `embed` NULL => juego aún no jugable. Copia derivada por siembra;
-- games.ts sigue siendo la fuente de autoría (REQ-14).
create table if not exists public.games (
  id         text primary key,
  title      text not null,
  cat        text not null,
  cover      text not null,
  color      text not null,
  embed      text,
  created_at timestamptz not null default now()
);

-- ── Tabla scores ───────────────────────────────────────────────────────────────
-- id uuid (Universally Unique Identifier — cadena aleatoria larga que evita choques
-- aunque se inserten dos scores a la vez). FK (Foreign Key, clave foránea) a games:
-- la base de datos rechaza un score de un juego inexistente (integridad referencial).
create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score       int  not null check (score >= 0),
  user_id     uuid references auth.users(id),   -- nullable: preparado para auth futura
  created_at  timestamptz not null default now()
);

-- Índice (estructura que agiliza búsquedas, como el índice de un libro) para el top por juego.
create index if not exists scores_game_score_idx
  on public.scores (game_id, score desc);

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────────
alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- games: SELECT público; sin INSERT/UPDATE/DELETE para la clave anónima (no se crean
-- políticas de escritura => con RLS activa, la escritura anónima queda denegada).
drop policy if exists games_select_public on public.games;
create policy games_select_public on public.games
  for select using (true);

-- scores: SELECT público; INSERT público que cumpla los CHECK/FK; sin UPDATE/DELETE
-- (no se crean esas políticas => denegadas con RLS activa) (REQ-04, NFR-03).
drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores
  for select using (true);

drop policy if exists scores_insert_public on public.scores;
create policy scores_insert_public on public.scores
  for insert with check (true);

-- ── Siembra de games (catálogo actual de app/data/games.ts) ──────────────────────
-- Solo asteroides tiene `embed` (jugable); el resto es NULL (etiqueta "PRÓXIMAMENTE").
insert into public.games (id, title, cat, cover, color, embed) values
  ('bloque-buster', 'BLOQUE BUSTER', 'ARCADE',  'cover-bricks',   'cyan',    null),
  ('caida',         'CAÍDA',         'PUZZLE',  'cover-tetro',    'magenta', null),
  ('serpentina',    'SERPENTINA',    'ARCADE',  'cover-snake',    'green',   null),
  ('gloton',        'GLOTÓN',        'ARCADE',  'cover-glot',     'yellow',  null),
  ('invasores',     'INVASORES',     'SHOOTER', 'cover-invaders', 'green',   null),
  ('rocas',         'ROCAS',         'SHOOTER', 'cover-rocas',    'yellow',  null),
  ('ranaria',       'RANARIA',       'ARCADE',  'cover-rana',     'green',   null),
  ('duelo-pixel',   'DUELO PIXEL',   'VERSUS',  'cover-duelo',    'cyan',    null),
  ('asteroides',    'ASTEROIDES',    'SHOOTER', 'cover-rocas',    'cyan',    '/games/asteroides/index.html')
on conflict (id) do nothing;
