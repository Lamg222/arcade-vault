# Bridge injection recipe (game → platform)

This is the game-specific hard part of `/add-game`. Every started game names its state and loop differently, so you **cannot** paste a fixed block. You **discover** five anchors in the target `game.js`, then adapt the canonical block below to them.

The contract you are wiring to lives in `app/lib/games/bridge.ts` and never changes:

- **Game → Host:** `ready` · `score` · `lives` · `level` · `powerup` (optional) · `paused` · `gameover`
- **Host → Game:** `pause` · `resume` · `restart`
- Both sides validate `event.origin === window.location.origin`.

## Step A — Discover the five anchors

Grep the target `game.js` and fill this table before writing anything. Real examples from the three reference games show how much the names drift.

### 1. Score / lives / level variables
- asteroides: `let score, lives, level;`
- tetris: `let ...score, lines, level...;` (no lives — omit the `lives` emit)
- arkanoid: `let lives = 3; let score = 0; let currentLevel = 1;`

Write down the exact identifier each game uses. If a game has no `lives` or no `level`, **drop that emit line** — do not invent a value. The HUD tolerates a field never arriving.

### 2. The main loop function (where physics advances each frame)
- asteroides / tetris: `function loop(ts)` + `requestAnimationFrame`
- arkanoid: `function update(dt)` called from a loop

You inject the per-frame `emitState()` call and the pause-freeze here.

### 3. The game-over signal (the edge you emit `gameover` on)
- asteroides: `state === 'gameover'` (a string state machine)
- tetris: `gameOver === true` (a boolean)
- arkanoid: `gameState === 'gameover'` or `gameState === 'win'` (string)

Pick the exact expression that is true **once the run has ended**. You emit `gameover` only on the rising edge (false → true), never every frame.

### 4. The restart / init function (resets score=0, full lives, level=1)
- asteroides: `initGame()`
- tetris / arkanoid: `init()` / `initLevel(1)` (+ reset score/lives if init doesn't)

The `restart` command calls this.

### 5. The pause flag (create it if the game has none)
- asteroides: `let paused = false;` already existed after the port
- tetris: `paused` already in the `let` list
- arkanoid: `let isPaused = false;`

If the game has **no** pause concept, declare `let paused = false;` near the other state vars and gate the physics call on it (Step C).

## Step B — Append the bridge block

Append this at the **end** of `game.js`, after all game logic. Rename the five anchors to match what you found. Lines you must adapt are marked `// ADAPT`.

```js
// ── Puente con la plataforma (postMessage) ──────────────────────────────────────
/* Contrato espejado en app/lib/games/bridge.ts (spec 05).
 * Juego → Host: ready, score, lives, level, powerup, paused, gameover.
 * Host → Juego: pause, resume, restart. */

function postToHost(msg) {
  try {
    window.parent.postMessage(msg, window.location.origin || '*');
  } catch (_) {
    // Standalone (file://) o sin parent: ignorar; el juego sigue funcionando.
  }
}

// Último estado emitido, para enviar solo los cambios (emisor por diff).
const lastEmit = { score: null, lives: null, level: null, over: false };

function emitState() {
  if (score !== lastEmit.score) { lastEmit.score = score; postToHost({ type: 'score', value: score }); }   // ADAPT var name
  if (lives !== lastEmit.lives) { lastEmit.lives = lives; postToHost({ type: 'lives', value: lives }); }     // ADAPT / drop if no lives
  if (level !== lastEmit.level) { lastEmit.level = level; postToHost({ type: 'level', value: level }); }     // ADAPT var name / drop if no level

  const overNow = (state === 'gameover');   // ADAPT: the game-over expression from anchor 3
  if (overNow && !lastEmit.over) postToHost({ type: 'gameover', score });   // ADAPT score var
  lastEmit.over = overNow;
}

function setPaused(next) {
  if (paused === next) return;   // ADAPT pause flag name (anchor 5)
  paused = next;
  postToHost({ type: 'paused', value: paused });
}

// Comandos del contenedor (Player).
window.addEventListener('message', e => {
  if (e.origin !== window.location.origin) return;   // solo mismo origen
  const cmd = e.data && e.data.type;
  if (cmd === 'pause') setPaused(true);
  else if (cmd === 'resume') setPaused(false);
  else if (cmd === 'restart') { initGame(); setPaused(false); }   // ADAPT init fn (anchor 4)
});

// Handshake: el host no envía comandos hasta recibir 'ready'.
postToHost({ type: 'ready' });
```

## Step C — Wire the loop (pause-freeze + P key + per-frame emit)

In the main loop (anchor 2), three edits:

```js
function loop(ts) {
  // ...timestamp / dt calc stays as the game had it...

  if (pressed('KeyP')) setPaused(!paused);   // ADD: P toggles pause (use the game's own key-read helper)

  if (!paused) update(dt);   // CHANGE: guard the physics call on the pause flag — was `update(dt)`
  draw();                    // draw always runs so the frame doesn't freeze black
  if (paused) drawOverlay('EN PAUSA', 'P O EL BOTÓN PARA CONTINUAR');   // optional, if the game has an overlay helper

  emitState();               // ADD: flush state diffs to the host every frame
  requestAnimationFrame(loop);
}
```

- If the game reads keys some other way than `pressed('KeyP')`, use its own mechanism to detect `P`.
- If `emitState()` can't live inside the loop (e.g. the loop is `update(dt)` called elsewhere), call `emitState()` right after each score/lives/level change instead — the diff cache makes redundant calls cheap.
- **Do not** move `ready` here: it fires once at boot (end of Step B), before the first frame, so the host's handshake gate opens immediately.

## Step D — Verify standalone before touching the platform

Open `public/games/<id>/index.html` directly (`file://`) in a browser. The game **must still play normally** — the `try/catch` in `postToHost` and the origin check mean the bridge is inert with no parent. If the game broke, the injection touched real game logic; revert and re-do Step B/C touching only the marked lines.

## What the platform already does (do NOT build these)

- `app/components/Player.tsx` renders the `<iframe>`, validates origin, updates the HUD from `score`/`lives`/`level`/`paused`, opens the gameover modal, and sends `pause`/`resume`/`restart`. It is game-agnostic — the only trigger is the catalog `embed` field.
- `powerup` is in the contract but Player ignores it. Emit it only if trivial; skipping it is fine.
- The gameover modal calls `saveScore(game.id, name, score)` and manages the `av_player_name` localStorage key. No per-game work.
