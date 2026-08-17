const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ── Geometría del tablero ────────────────────────────────────────────────────
const COLS = 15;
const ROWS = 15;
const CELL = canvas.width / COLS;        // 600 / 15 = 40 px por celda
const FROG = CELL - 8;                    // lado de la rana (algo menor que la celda)

// Tipos de fila, de arriba (y=0) hacia abajo (y=14).
// 0: nidos · 1-5: río · 6: mediana segura · 7-11: tráfico · 12-14: acera de salida.
const ROW_TYPE = [
  'nest',
  'water', 'water', 'water', 'water', 'water',
  'safe',
  'road', 'road', 'road', 'road', 'road',
  'safe', 'safe', 'safe',
];
const START_ROW = 13;                      // fila donde reaparece la rana
const NEST_COLS = [1, 4, 7, 10, 13];       // columnas de los 5 nidos en la fila 0

// ── Parámetros de dificultad ─────────────────────────────────────────────────
const BASE_SPEED = 70;                     // px/s de las entidades en nivel 1
const SPEED_PER_LEVEL = 22;                // +px/s por nivel
const SPEED_CAP = 300;                     // tope de velocidad (evita tunneling en AABB)
const BASE_TIME = 30;                      // segundos de cronómetro por travesía en nivel 1
const TIME_PER_LEVEL = 2;                  // segundos menos por nivel
const MIN_TIME = 12;                       // suelo del cronómetro
const SUBMERGE_CYCLE = 4200;              // ms del ciclo completo de una tortuga
const SUBMERGE_DOWN = 1400;                // ms que pasa hundida dentro del ciclo
const POINTS_ROW = 10;                     // por cada fila nueva más alta
const POINTS_NEST = 50;                    // por llegar a un nido
const POINTS_TIME = 10;                    // por segundo restante al llegar al nido
const POINTS_LEVEL = 1000;                 // por completar los 5 nidos

// ── Estado de juego ──────────────────────────────────────────────────────────
let score = 0;
let lives = 3;
let level = 1;
let gameOver = false;
let paused = false;
let started = false;                       // el cronómetro no corre hasta la primera flecha

let frog;                                  // { x, y, row } — x/y en px (esquina), row entera
let highestRow;                            // fila más alta (índice menor) alcanzada en la travesía actual
let timeLeft;                              // segundos restantes del cronómetro
let nests;                                 // [bool×5] — nido ocupado
let roadLanes = [];                        // carriles de tráfico
let waterLanes = [];                       // filas de río (troncos/tortugas)

// Último estado emitido al host, para enviar solo los cambios (emisor por diff).
const lastEmit = { score: null, lives: null, level: null, over: false };

function laneSpeed() {
  return Math.min(SPEED_CAP, BASE_SPEED + (level - 1) * SPEED_PER_LEVEL);
}

// Reparte `count` entidades de ancho `w` px repartidas por el ancho del canvas.
function makeEntities(count, w, dir, speed) {
  const period = canvas.width + w;
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({ x: (period / count) * i, w, dir, speed });
  }
  return arr;
}

function buildLanes() {
  const v = laneSpeed();
  roadLanes = [];
  for (let row = 7; row <= 11; row++) {
    const dir = row % 2 === 0 ? 1 : -1;          // alterna el sentido por carril
    const fast = row === 8;                        // un carril rápido
    const carW = fast ? CELL * 1.4 : CELL * 1.8;
    const count = fast ? 3 : 2;
    roadLanes.push({ row, entities: makeEntities(count, carW, dir, v * (fast ? 1.6 : 1)) });
  }

  waterLanes = [];
  for (let row = 1; row <= 5; row++) {
    const dir = row % 2 === 0 ? -1 : 1;
    const isTurtle = row === 2 || row === 4;       // dos filas de tortugas (se sumergen)
    const platW = isTurtle ? CELL * 2 : CELL * 2.6;
    const count = 2;
    const ents = makeEntities(count, platW, dir, v * 0.9);
    ents.forEach((e, i) => {
      e.turtle = isTurtle;
      e.subTimer = isTurtle ? (SUBMERGE_CYCLE / count) * i : 0;   // desfase entre grupos
    });
    waterLanes.push({ row, entities: ents });
  }
}

function resetFrog() {
  frog = { x: 7 * CELL, y: START_ROW * CELL, row: START_ROW };
  highestRow = START_ROW;
  timeLeft = Math.max(MIN_TIME, BASE_TIME - (level - 1) * TIME_PER_LEVEL);
}

function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  started = false;
  lastEmit.over = false;
  nests = [false, false, false, false, false];
  buildLanes();
  resetFrog();
}

// Una tortuga está sumergida (insegura) en la parte final de su ciclo.
function submerged(e) {
  if (!e.turtle) return false;
  return (e.subTimer % SUBMERGE_CYCLE) > (SUBMERGE_CYCLE - SUBMERGE_DOWN);
}
// Fase de aviso: telegrafía el hundimiento antes de volverse insegura.
function sinking(e) {
  if (!e.turtle) return false;
  const t = e.subTimer % SUBMERGE_CYCLE;
  return t > (SUBMERGE_CYCLE - SUBMERGE_DOWN - 500) && t <= (SUBMERGE_CYCLE - SUBMERGE_DOWN);
}

// ── Muerte y avance ──────────────────────────────────────────────────────────
function die() {
  lives--;
  if (lives <= 0) { gameOver = true; return; }
  resetFrog();
}

function reachNest(idx) {
  nests[idx] = true;
  score += POINTS_NEST + Math.floor(timeLeft) * POINTS_TIME;
  if (nests.every(Boolean)) {
    score += POINTS_LEVEL;
    level++;
    nests = [false, false, false, false, false];
    buildLanes();
  }
  resetFrog();
}

// ── Entrada ──────────────────────────────────────────────────────────────────
function moveFrog(dc, dr) {
  if (gameOver || paused) return;
  started = true;
  const nc = Math.round(frog.x / CELL) + dc;
  const nr = frog.row + dr;
  if (nr < 0 || nr >= ROWS) return;              // no salir por arriba/abajo del tablero
  if (nc < 0 || nc >= COLS) return;              // no salir por los lados a pie
  frog.x = nc * CELL;
  frog.row = nr;
  frog.y = nr * CELL;

  if (frog.row < highestRow) {                    // fila nueva más alta → puntúa
    score += POINTS_ROW * (highestRow - frog.row);
    highestRow = frog.row;
  }

  if (ROW_TYPE[frog.row] === 'nest') {
    const col = Math.round(frog.x / CELL);
    const idx = NEST_COLS.indexOf(col);
    if (idx >= 0 && !nests[idx]) reachNest(idx);   // nido libre → avanza
    else die();                                    // seto / nido ocupado → muerte
  }
}

document.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': moveFrog(0, -1); break;
    case 'ArrowDown': case 's': case 'S': moveFrog(0, 1); break;
    case 'ArrowLeft': case 'a': case 'A': moveFrog(-1, 0); break;
    case 'ArrowRight': case 'd': case 'D': moveFrog(1, 0); break;
    case 'p': case 'P': case 'Escape':
      if (!gameOver) setPaused(!paused);
      break;
    case 'Enter':
      if (gameOver) initGame();
      break;
  }
});

// ── Física por frame ─────────────────────────────────────────────────────────
function aabb(ax, aw, bx, bw) { return ax < bx + bw && ax + aw > bx; }   // solape 1-D en x

function moveEntities(lane, dt) {
  const period = canvas.width;
  for (const e of lane.entities) {
    e.x += e.dir * e.speed * (dt / 1000);
    if (e.turtle) e.subTimer += dt;
    if (e.x >= period) e.x -= period + e.w;              // reaparece por el otro lado
    else if (e.x + e.w <= 0) e.x += period + e.w;
  }
}

function update(dt) {
  for (const lane of roadLanes) moveEntities(lane, dt);
  for (const lane of waterLanes) moveEntities(lane, dt);
  if (!started) return;

  const type = ROW_TYPE[frog.row];
  const fx = frog.x + 4, fw = FROG;                       // caja de la rana en x

  if (type === 'road') {
    const lane = roadLanes.find(l => l.row === frog.row);
    if (lane && lane.entities.some(e => aabb(fx, fw, e.x, e.w))) return die();   // atropello
  } else if (type === 'water') {
    const lane = waterLanes.find(l => l.row === frog.row);
    const carrier = lane && lane.entities.find(e => !submerged(e) && aabb(fx, fw, e.x, e.w));
    if (!carrier) return die();                           // sin plataforma segura → al agua
    frog.x += carrier.dir * carrier.speed * (dt / 1000);  // la rana viaja con el tronco/tortuga
    if (frog.x < 0 || frog.x + CELL > canvas.width) return die();   // arrastrada fuera del borde
  }

  timeLeft -= dt / 1000;
  if (timeLeft <= 0) return die();                         // cronómetro agotado
}

// ── Dibujo ───────────────────────────────────────────────────────────────────
const COL = {
  nest: '#0a2a16', water: '#0d2340', safe: '#123a1e', road: '#15151c',
  log: '#7a4a22', turtle: '#2fae6b', turtleSink: '#b9a13a',
  car1: '#ff3b6b', car2: '#ffd23b', car3: '#3bd8ff', frog: '#39ff14',
};

function drawRow(row) {
  const y = row * CELL;
  ctx.fillStyle = COL[ROW_TYPE[row]];
  ctx.fillRect(0, y, canvas.width, CELL);
}

function drawRoundRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function draw() {
  for (let row = 0; row < ROWS; row++) drawRow(row);

  // Nidos.
  for (let i = 0; i < NEST_COLS.length; i++) {
    const x = NEST_COLS[i] * CELL;
    drawRoundRect(x + 3, 3, CELL - 6, CELL - 6, 6, nests[i] ? COL.frog : '#0f4022');
  }

  // Río: troncos y tortugas.
  for (const lane of waterLanes) {
    const y = lane.row * CELL;
    for (const e of lane.entities) {
      if (e.turtle) {
        if (submerged(e)) continue;                        // hundida: no se dibuja (insegura)
        drawRoundRect(e.x, y + 5, e.w, CELL - 10, 10, sinking(e) ? COL.turtleSink : COL.turtle);
      } else {
        drawRoundRect(e.x, y + 6, e.w, CELL - 12, 5, COL.log);
      }
    }
  }

  // Tráfico.
  const carColors = [COL.car1, COL.car2, COL.car3];
  for (let li = 0; li < roadLanes.length; li++) {
    const lane = roadLanes[li];
    const y = lane.row * CELL;
    for (const e of lane.entities) drawRoundRect(e.x, y + 5, e.w, CELL - 10, 5, carColors[li % 3]);
  }

  // Rana.
  drawRoundRect(frog.x + 4, frog.y + 4, FROG, FROG, 8, COL.frog);
  ctx.fillStyle = '#05130a';
  const cx = frog.x + 4;
  ctx.beginPath(); ctx.arc(cx + FROG * 0.32, frog.y + FROG * 0.45, 2.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + FROG * 0.68, frog.y + FROG * 0.45, 2.5, 0, 7); ctx.fill();

  // HUD sobre el lienzo (el HUD de React se alimenta por el puente aparte).
  ctx.fillStyle = '#e8ffe0';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('Score: ' + score, 10, 8);
  ctx.textAlign = 'center';
  ctx.fillText('Vidas: ' + lives, canvas.width / 2, 8);
  ctx.textAlign = 'right';
  ctx.fillText('Nivel: ' + level, canvas.width - 10, 8);

  // Barra de cronómetro.
  const frac = Math.max(0, timeLeft) / Math.max(MIN_TIME, BASE_TIME - (level - 1) * TIME_PER_LEVEL);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(10, canvas.height - 12, canvas.width - 20, 6);
  ctx.fillStyle = frac < 0.25 ? '#ff3b6b' : COL.frog;
  ctx.fillRect(10, canvas.height - 12, (canvas.width - 20) * frac, 6);

  if (!started && !gameOver) drawOverlay('SALTA CARRIL', 'FLECHAS PARA CRUZAR');
  if (paused && !gameOver) drawOverlay('PAUSA', 'P O EL BOTÓN PARA CONTINUAR');
  if (gameOver) drawOverlay('GAME OVER', 'ENTER PARA REINICIAR');
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COL.frog;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 18);
  if (subtitle) {
    ctx.fillStyle = '#cfeecc';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 26);
  }
}

// ── Loop principal ───────────────────────────────────────────────────────────
let lastTime = null;

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  let dt = timestamp - lastTime;
  lastTime = timestamp;
  if (dt > 100) dt = 100;                     // clamp tras pestaña en 2º plano (evita saltos)

  if (!paused && !gameOver) update(dt);
  draw();
  emitState();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);

// Enfoca el lienzo para que las flechas lleguen al juego y no desplacen la página.
canvas.tabIndex = 0;
canvas.style.outline = 'none';
function grabFocus() { try { window.focus(); canvas.focus(); } catch (_) {} }
grabFocus();
window.addEventListener('load', grabFocus);
window.addEventListener('pointerdown', grabFocus);

// ── Puente con la plataforma (postMessage) ──────────────────────────────────────
/* Contrato espejado en app/lib/games/bridge.ts (spec 05).
 * Juego → Host: ready, score, lives, level, paused, gameover.
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
  if (lives !== lastEmit.lives) { lastEmit.lives = lives; postToHost({ type: 'lives', value: lives }); }
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
