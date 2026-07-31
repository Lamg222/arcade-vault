-- ── Siembra de la fila `tetris` en games ─────────────────────────────────────────
-- Aditiva e idempotente: no toca 0001 (ya aplicada). Necesaria para que la FK
-- scores.game_id → games.id acepte los scores de tetris. Valores espejados de
-- app/data/games.ts (fuente de autoría; esta tabla es copia derivada, spec 06 D-04).
insert into public.games (id, title, cat, cover, color, embed) values
  ('tetris', 'TETRIS', 'PUZZLE', 'cover-tetro', 'yellow', '/games/tetris/index.html')
on conflict (id) do nothing;
