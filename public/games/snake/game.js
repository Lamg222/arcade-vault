const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRID_N = 20;                       // celdas por lado
const CELL = canvas.width / GRID_N;      // 600 / 20 = 30 px por celda
const BASE_STEP = 200;                   // ms por avance en nivel 1 (arranque tranquilo)
const STEP_DECREMENT = 6;                // ms menos por nivel (más rápido)
const MIN_STEP = 80;                     // suelo de velocidad
const FRUITS_PER_LEVEL = 5;              // frutas para subir de nivel
const POINTS_PER_FRUIT = 10;

const atlas = window.SPRITE_ATLAS;
const FRUIT_KEYS = Object.keys(atlas.fruits);
const fruitsImg = new Image();
let assetsReady = false;
fruitsImg.onload = () => { assetsReady = true; };
fruitsImg.src = atlas.sources.fruits;

let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = null;
let score = 0;
let level = 1;
let fruitsEaten = 0;
let stepInterval = BASE_STEP;
let gameOver = false;
let paused = false;
let started = false;                      // la serpiente no se mueve hasta la primera flecha/WASD

// Último estado emitido al host, para enviar solo los cambios (emisor por diff). Lo usa initGame() al reiniciar, por eso vive aquí arriba y no en el bloque puente.
const lastEmit = { score: null, level: null, over: false };

function randCell() {
  return { x: Math.floor(Math.random() * GRID_N), y: Math.floor(Math.random() * GRID_N) };
}

function spawnFood() {
  let cell;
  do { cell = randCell(); } while (snake.some(s => s.x === cell.x && s.y === cell.y));
  cell.fruit = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
  food = cell;
}

function initGame() {
  // Arranca pegada a la izquierda mirando a la derecha: toda la pista por delante.
  const midY = Math.floor(GRID_N / 2);
  snake = [
    { x: 3, y: midY },
    { x: 2, y: midY },
    { x: 1, y: midY },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  level = 1;
  fruitsEaten = 0;
  stepInterval = BASE_STEP;
  gameOver = false;
  started = false;
  lastEmit.over = false;
  spawnFood();
}

function setDirection(nx, ny) {
  // Ignora el giro de 180° (no puede volver sobre sí misma en un mismo paso).
  if (nx === -dir.x && ny === -dir.y) return;
  nextDir = { x: nx, y: ny };
  started = true;   // la primera flecha/WASD arranca el movimiento
}

document.addEventListener('keydown', (e) => {
  // Evita que flechas/espacio hagan scroll de la página en vez de mover el juego.
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': setDirection(0, -1); break;
    case 'ArrowDown': case 's': case 'S': setDirection(0, 1); break;
    case 'ArrowLeft': case 'a': case 'A': setDirection(-1, 0); break;
    case 'ArrowRight': case 'd': case 'D': setDirection(1, 0); break;
    case 'p': case 'P': case 'Escape':
      if (!gameOver) setPaused(!paused);
      break;
    case 'Enter':
      if (gameOver) initGame();
      break;
  }
});

function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Choque con pared.
  if (head.x < 0 || head.x >= GRID_N || head.y < 0 || head.y >= GRID_N) {
    gameOver = true;
    return;
  }
  // Choque consigo misma (la cola se libera este paso, así que la ignoramos salvo que crezca).
  const willEat = food && head.x === food.x && head.y === food.y;
  const body = willEat ? snake : snake.slice(0, -1);
  if (body.some(s => s.x === head.x && s.y === head.y)) {
    gameOver = true;
    return;
  }

  snake.unshift(head);
  if (willEat) {
    score += POINTS_PER_FRUIT;
    fruitsEaten++;
    if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
      level++;
      stepInterval = Math.max(MIN_STEP, BASE_STEP - (level - 1) * STEP_DECREMENT);
    }
    spawnFood();
  } else {
    snake.pop();
  }
}

function drawCell(x, y, color, inset) {
  const pad = inset || 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 6);
  ctx.fill();
}

function drawFood() {
  if (!food) return;
  const fr = atlas.fruits[food.fruit];
  if (assetsReady) {
    // Encaja el recorte de fruta dentro de la celda preservando su proporción.
    const scale = Math.min(CELL / fr.w, CELL / fr.h) * 0.9;
    const dw = fr.w * scale;
    const dh = fr.h * scale;
    const dx = food.x * CELL + (CELL - dw) / 2;
    const dy = food.y * CELL + (CELL - dh) / 2;
    ctx.drawImage(fruitsImg, fr.x, fr.y, fr.w, fr.h, dx, dy, dw, dh);
  } else {
    drawCell(food.x, food.y, '#ff3b6b', 6);
  }
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#39ff14';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
  if (subtitle) {
    ctx.fillStyle = '#cfeecc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 30);
  }
}

function draw() {
  // Fondo con rejilla tenue.
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_N; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
  }

  drawFood();

  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const color = i === 0 ? '#39ff14' : 'rgba(57, 255, 20, 0.55)';
    drawCell(seg.x, seg.y, color, 2);
  }

  // HUD sobre el lienzo (el HUD de React se alimenta por el puente aparte).
  ctx.fillStyle = '#e8ffe0';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Score: ' + score, 12, 12);
  ctx.textAlign = 'right';
  ctx.fillText('Nivel: ' + level, canvas.width - 12, 12);

  if (!started && !gameOver) drawOverlay('SNAKE', 'FLECHAS O WASD PARA EMPEZAR');
  if (paused && !gameOver) drawOverlay('PAUSA', 'P O EL BOTÓN PARA CONTINUAR');
  if (gameOver) drawOverlay('GAME OVER', 'ENTER PARA REINICIAR');
}

let lastTime = null;
let acc = 0;

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (started && !paused && !gameOver) {
    acc += dt;
    while (acc >= stepInterval) {
      acc -= stepInterval;
      step();
      if (gameOver) break;
    }
  }

  draw();
  emitState();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);

/* Enfoca el lienzo para que las flechas lleguen al juego y no desplacen la página.
 * Sin esto, hasta el primer clic el iframe no tiene el foco y las teclas van al contenedor. */
canvas.tabIndex = 0;
canvas.style.outline = 'none';
function grabFocus() { try { window.focus(); canvas.focus(); } catch (_) {} }
grabFocus();
window.addEventListener('load', grabFocus);
window.addEventListener('pointerdown', grabFocus);

// ── Puente con la plataforma (postMessage) ──────────────────────────────────────
/* Contrato espejado en app/lib/games/bridge.ts (spec 05).
 * Juego → Host: ready, score, level, paused, gameover (snake tiene 1 vida: sin 'lives').
 * Host → Juego: pause, resume, restart. */

function postToHost(msg) {
  try {
    window.parent.postMessage(msg, window.location.origin || '*');
  } catch (_) {
    // Standalone (file://) o sin parent: ignorar; el juego sigue funcionando.
  }
}

function emitState() {
  if (score !== lastEmit.score) { lastEmit.score = score; postToHost({ type: 'score', value: score }); }
  if (level !== lastEmit.level) { lastEmit.level = level; postToHost({ type: 'level', value: level }); }

  if (gameOver && !lastEmit.over) postToHost({ type: 'gameover', score });
  lastEmit.over = gameOver;
}

function setPaused(next) {
  if (paused === next) return;
  paused = next;
  postToHost({ type: 'paused', value: paused });
}

// Comandos del contenedor (Player).
window.addEventListener('message', e => {
  if (e.origin !== window.location.origin) return;   // solo mismo origen
  const cmd = e.data && e.data.type;
  if (cmd === 'pause') setPaused(true);
  else if (cmd === 'resume') setPaused(false);
  else if (cmd === 'restart') { initGame(); setPaused(false); }
});

// Handshake: el host no envía comandos hasta recibir 'ready'.
postToHost({ type: 'ready' });
