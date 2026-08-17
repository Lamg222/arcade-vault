---
name: add-game
description: Ports a started game from references/started-games/ into Arcade Vault as a fully playable, leaderboard-backed game. Fuses the two one-time platform specs (05 embed+postMessage bridge, 06 Supabase leaderboard) into one repeatable per-game flow. Use it to add a new playable game, not to rebuild platform plumbing.
disable-model-invocation: true
argument-hint: '<source-folder> [target-id]  e.g. 03-tetris tetris'
---

# /add-game — Port a started game into the platform with a leaderboard

Specs 05 (`05-juego-asteroides.md`) and 06 (`06-leaderboard-supabase.md`) were the one-time work that built the platform's game-embedding and leaderboard machinery. That machinery is **already generic**. Adding game #3, #4, #5 is now a mechanical port, and this skill is that port. It does **not** re-spec anything: specs 05 + 06 are the standing contract.

Your replies must be in the same language as the invocation. If the user wrote Spanish, answer in Spanish.

## What is already generic — do NOT touch these

These files work for any game and must not be modified by this skill. Read them if you need to, but changing them is out of scope (it would be a new spec):

- `app/components/Player.tsx` — renders the `<iframe>` when `game.embed` is set, validates `event.origin`, drives the HUD from bridge messages, opens the gameover modal, sends `pause`/`resume`/`restart`, calls `saveScore`, manages the `av_player_name` localStorage key.
- `app/lib/scores.ts` — `getGlobalTop` / `getGameTop(gameId)` / `saveScore(gameId, name, score)`. All take a `gameId`; nothing per-game.
- `app/components/HallOfFame.tsx`, `app/components/Leaderboard.tsx` — async Server Components reading real scores, with empty/error states.
- `app/lib/games/bridge.ts` — the `postMessage` contract (`GameToHost` / `HostToGame` + `isGameToHost` guard).
- `app/lib/supabase/{client,server}.ts` — the two Supabase clients.
- `app/components/GameCard.tsx` — already shows "PRÓXIMAMENTE" for games without `embed`; a new game **has** `embed`, so it is automatically playable with no badge. No work.

The skill's entire job is **five per-game artifacts**: copied assets, an injected bridge, a catalog entry, a seeded `games` row, and verification.

## Before you start

Read, in this order:

1. `specs/05-juego-asteroides.md` and `specs/06-leaderboard-supabase.md` — the contract you are replaying.
2. `bridge-template.md` (next to this skill) — the game-agnostic bridge-injection recipe. The bridge is the only hard, per-game step; that file is where the real instructions live.
3. The Next.js docs bundled at `node_modules/next/dist/docs/01-app/` (this repo runs Next 16.2.9, newer than your training) — only if you end up needing to touch anything under `app/`. For a normal port you should not.

Node ≥20 via nvm (default 22). Supabase writes need `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from spec 04).

## Phase 0 — Inputs

The argument is `$ARGUMENTS`, expected as `<source-folder> [target-id]`.

1. `source-folder` names a directory under `references/started-games/` (e.g. `03-tetris`). List that folder to confirm it exists and see its files. If `$ARGUMENTS` is empty or the folder is missing, list `references/started-games/` and ask which game to port. Stop and wait.
2. `target-id` is the catalog slug and the public path segment (e.g. `tetris`). If omitted, derive it by stripping the `NN-` prefix from the source folder and confirm it with the user before proceeding. It **must** be unique — check it does not collide with an existing `GAMES` entry `id` in `app/data/games.ts` or an existing folder under `public/games/`.
3. Confirm the plan back to the user in one short block: source folder, target id, the five artifacts you will produce, and that you will pause after each phase for a diff review. Wait for a go-ahead before Phase 1.

## Phase 1 — Copy the game assets

Copy the playable files from `references/started-games/<source>/` into `public/games/<target-id>/`. Copy what the game actually loads — typically `index.html`, `game.js`, and any `style.css`, `favicon.svg`, `levels.js`, `assets/`. Do **not** copy the reference-only files: `README.md`, `CLAUDE.md`, `specs/`, `skills-lock.json`.

Open the copied `index.html` and confirm the `<canvas>` id and `<script src>` paths still resolve relative to `/games/<target-id>/` (they are static files served from `public/`). Fix only broken relative paths — nothing else.

→ commit. Pause for review.

## Phase 2 — Inject the bridge (the hard part)

Follow `bridge-template.md` end to end against the copied `public/games/<target-id>/game.js`:

- **Step A** — discover the five anchors (score/lives/level vars, main loop, game-over expression, init/restart fn, pause flag). Report the table you filled in — the exact identifiers this game uses — so the user can sanity-check before you edit.
- **Step B** — append the adapted bridge block (emit-by-diff, `setPaused`, host-command listener, `ready` handshake).
- **Step C** — wire the loop: `P` toggles pause, physics gated on the pause flag, `emitState()` per frame.
- **Step D** — open the copied `index.html` on `file://` and confirm the game **still plays standalone** (the bridge is inert with no parent). If it broke, you touched real game logic — revert and redo touching only the marked lines.

Keep game-logic edits minimal — this is the same game, only instrumented. Report which lines you added vs changed.

→ commit (game playable standalone). Pause for review.

## Phase 3 — Catalog entry

Add one entry to `export const GAMES` in `app/data/games.ts`. `games.ts` is the authoring source of truth (spec 06 D-04) — every field lives here first.

- `id: "<target-id>"`, and `embed: "/games/<target-id>/index.html"` — the presence of `embed` is the single switch that makes `Player` render the iframe instead of a mock arena.
- `cat` must be one of the union in the `Game` type (`"ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"`); `color` one of (`"cyan" | "magenta" | "yellow" | "green"`); `cover` an existing cover class (reuse one, e.g. `"cover-rocas"`, unless a new cover is in scope).
- `best: 0`, `plays: "0"` for a fresh game (no fake stats). Write a real `short` and `long` description.
- Leave every existing entry untouched.

→ commit. Pause for review.

## Phase 4 — Seed the `games` row in Supabase

The `scores` table has a foreign key `game_id → games.id`. Until the new game exists as a row in the `games` table, **every score insert for it is rejected by the database**. So seed it.

Create a new **additive, idempotent** migration — do not edit the already-applied `0001_leaderboard.sql`. Find the highest existing number in `supabase/migrations/` and create `000N_seed_<target-id>.sql` (next number):

```sql
-- Seed the <target-id> game row so scores.game_id FK accepts its scores.
insert into public.games (id, title, cat, cover, color, embed) values
  ('<target-id>', '<TITLE>', '<CAT>', '<cover>', '<color>', '/games/<target-id>/index.html')
on conflict (id) do nothing;
```

The values must match the `games.ts` entry from Phase 3 (same authoring source, derived copy). `on conflict (id) do nothing` makes re-running safe.

Tell the user to apply it (Supabase CLI or pasting into the dashboard SQL Editor) — you cannot apply it for them. This phase is not verifiable until they do.

→ commit. Pause for review.

## Phase 5 — Verify (this is the acceptance)

Do not claim done until these pass. Run and report honestly:

1. `npm run build` → green (no type/lint errors).
2. `npm run dev`, then in the browser:
   - `/jugar/<target-id>` renders the iframe (not a mock arena); the game responds to keyboard.
   - Playing updates the React HUD (score/lives/level) with real values; `P` and the PAUSA button stay in sync; losing opens the gameover modal with the real score.
   - Saving with a name inserts a row in `scores` (check the dashboard) and stores the name in `localStorage` under `av_player_name`.
   - `/juego/<target-id>` shows that score in its Leaderboard; `/salon` shows it in the global Hall of Fame.
3. A game with **no** scores yet shows "Sé el primero en entrar al Salón de la Fama", never fake data.

If Phase 4's migration is not applied, saving fails with a foreign-key error — that is expected; report it as "blocked on migration", not as a bug.

→ final commit = acceptance. Optionally update `specs/00-overview.md` if the project tracks games there.

## Hard rules

- **Touch only the five per-game artifacts.** If the port seems to need a change in `Player.tsx`, `scores.ts`, the leaderboards, or the bridge contract, stop — that is a new spec, not this skill. Surface it to the user.
- **Never fake stats or seed fake scores.** New games start at `best: 0`, `plays: "0"`, empty leaderboard.
- **Never edit an applied migration.** New games get a new additive migration file.
- **Pause after every phase** for a diff review, like `/spec-impl`. One phase, one commit.
- **Report the anchor table before editing `game.js`** so the user can catch a misidentified variable before it becomes a bug.
