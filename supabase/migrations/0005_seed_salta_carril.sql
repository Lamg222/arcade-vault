-- Siembra la fila del juego `salta-carril` para que la FK (clave foránea) scores.game_id la acepte.
-- Aditiva e idempotente: `on conflict (id) do nothing` la hace segura de re-ejecutar.
-- Valores derivados de app/data/games.ts (fuente de autoría, spec 06).
insert into public.games (id, title, cat, cover, color, embed) values
  ('salta-carril', 'SALTA CARRIL', 'ARCADE', 'cover-rana', 'green', '/games/salta-carril/index.html')
on conflict (id) do nothing;
