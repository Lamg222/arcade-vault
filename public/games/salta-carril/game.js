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
/* Paleta única del canvas: TODO color de dibujo sale de aquí (fuente de verdad para las skins). */
const COL = {
  nest: '#0a2a16', nestHole: '#0f4022', nestEdge: '#1e5c33',
  water: '#0d2340', waterWave: 'rgba(140,190,255,0.10)',
  safe: '#123a1e', safeStripe: 'rgba(57,255,20,0.07)',
  road: '#15151c', roadLine: 'rgba(255,255,255,0.16)',
  log: '#7a4a22', logVein: '#5c3517', logRing: '#9c6a38',
  turtle: '#2fae6b', turtleShell: '#1d7a49', turtleSink: '#b9a13a', turtleSkin: '#57d18f',
  car1: '#ff3b6b', car2: '#ffd23b', car3: '#3bd8ff',
  glass: 'rgba(190,235,255,0.8)', wheel: '#0a0a10', headlight: '#fff6c8',
  frog: '#39ff14', frogDark: '#1f9e0a', eyeWhite: '#f2fff0', pupil: '#05130a',
};

let nowMs = 0;                               // reloj de animación (ondas del agua); lo alimenta loop()

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

// Fondos con detalle: ondas en el agua, líneas discontinuas entre carriles, rayado sutil en aceras.
function drawBackdrop() {
  for (let row = 0; row < ROWS; row++) drawRow(row);

  ctx.fillStyle = COL.waterWave;
  for (let row = 1; row <= 5; row++) {
    const y = row * CELL;
    const phase = ((nowMs / 40) + row * 37) % (CELL * 2);   // deriva lenta, desfasada por fila
    for (let x = -CELL * 2; x < canvas.width + CELL; x += CELL * 2) {
      ctx.beginPath();
      ctx.ellipse(x + phase, y + CELL * 0.7, CELL * 0.55, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = COL.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  for (let row = 8; row <= 11; row++) {                      // separadores entre los 5 carriles
    const y = row * CELL;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = COL.safeStripe;
  for (const row of [6, 12, 13, 14]) {
    const y = row * CELL;
    for (let x = 0; x < canvas.width; x += CELL) ctx.fillRect(x + 2, y + CELL - 6, CELL - 4, 3);
  }
}

function drawNests() {
  for (let i = 0; i < NEST_COLS.length; i++) {
    const x = NEST_COLS[i] * CELL;
    drawRoundRect(x + 2, 2, CELL - 4, CELL - 4, 8, COL.nestEdge);      // borde de seto
    drawRoundRect(x + 5, 5, CELL - 10, CELL - 10, 6, COL.nestHole);    // hueco
    if (nests[i]) drawFrogSprite(x + 4, 4, FROG, true);                 // rana ya instalada
  }
}

function drawLog(e, y) {
  drawRoundRect(e.x, y + 6, e.w, CELL - 12, 7, COL.log);
  ctx.strokeStyle = COL.logVein;                              // vetas de la madera
  ctx.lineWidth = 2;
  for (let i = 1; i <= 2; i++) {
    const vy = y + 6 + (CELL - 12) * (i / 3);
    ctx.beginPath(); ctx.moveTo(e.x + 6, vy); ctx.lineTo(e.x + e.w - 6, vy); ctx.stroke();
  }
  ctx.fillStyle = COL.logRing;                                // anillos de corte en los extremos
  ctx.beginPath(); ctx.ellipse(e.x + 5, y + CELL / 2, 4, (CELL - 14) / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(e.x + e.w - 5, y + CELL / 2, 4, (CELL - 14) / 2, 0, 0, Math.PI * 2); ctx.fill();
}

function drawTurtles(e, y) {
  const body = sinking(e) ? COL.turtleSink : COL.turtle;
  const shell = sinking(e) ? COL.turtleSink : COL.turtleShell;
  const n = Math.max(2, Math.round(e.w / CELL));              // el grupo se dibuja como n tortugas
  const d = e.w / n;
  for (let i = 0; i < n; i++) {
    const cx = e.x + d * i + d / 2;
    const cy = y + CELL / 2;
    ctx.fillStyle = COL.turtleSkin;                           // cabeza asomando en el sentido de avance
    ctx.beginPath(); ctx.arc(cx + e.dir * (d / 2 - 4), cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(cx, cy, d / 2 - 3, CELL / 2 - 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shell;                                  // dibujo del caparazón
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, d / 2 - 8, CELL / 2 - 11, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - d / 4, cy); ctx.lineTo(cx + d / 4, cy); ctx.stroke();
  }
}

function drawVehicle(e, y, color) {
  const h = CELL - 12;
  const top = y + 6;
  const truck = e.w > CELL * 1.6;                             // los anchos largos se dibujan como camión
  ctx.fillStyle = COL.wheel;                                  // ruedas por debajo del cuerpo
  for (const wx of [e.x + e.w * 0.2, e.x + e.w * 0.8]) {
    ctx.beginPath(); ctx.arc(wx, top + h + 1, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (truck) {
    const cabW = e.w * 0.28;
    const cabX = e.dir === 1 ? e.x + e.w - cabW : e.x;        // cabina al frente según el sentido
    const boxX = e.dir === 1 ? e.x : e.x + cabW + 2;
    drawRoundRect(boxX, top, e.w - cabW - 2, h, 4, color);    // caja de carga
    drawRoundRect(cabX, top + 2, cabW, h - 2, 5, color);      // cabina
    ctx.fillStyle = COL.glass;                                // parabrisas de la cabina
    const glassX = e.dir === 1 ? cabX + cabW * 0.15 : cabX + cabW * 0.45;
    ctx.fillRect(glassX, top + 4, cabW * 0.4, h * 0.4);
  } else {
    drawRoundRect(e.x, top, e.w, h, 8, color);                // carrocería
    ctx.fillStyle = COL.glass;                                // parabrisas + luneta
    ctx.fillRect(e.x + e.w * 0.3, top + 3, e.w * 0.18, h - 6);
    ctx.fillRect(e.x + e.w * 0.58, top + 3, e.w * 0.14, h - 6);
  }
  ctx.fillStyle = COL.headlight;                              // faro al frente
  const lx = e.dir === 1 ? e.x + e.w - 3 : e.x;
  ctx.fillRect(lx, top + 3, 3, 6);
  ctx.fillRect(lx, top + h - 9, 3, 6);
}

// Rana con ojos saltones y patas; `seated` = silueta quieta dentro de un nido.
function drawFrogSprite(px, py, s, seated) {
  const cx = px + s / 2, cy = py + s / 2;
  ctx.strokeStyle = COL.frogDark;                             // patas en diagonal
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [dx1, dy1, dx2, dy2] of [
    [-0.28, -0.1, -0.46, -0.32], [0.28, -0.1, 0.46, -0.32],   // delanteras
    [-0.28, 0.18, -0.5, 0.42], [0.28, 0.18, 0.5, 0.42],       // traseras
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * dx1, cy + s * dy1);
    ctx.lineTo(cx + s * dx2, cy + s * dy2);
    ctx.stroke();
  }
  ctx.fillStyle = seated ? COL.frogDark : COL.frog;           // cuerpo
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.06, s * 0.34, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.frogDark;                               // lomo
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  for (const ex of [-0.2, 0.2]) {                             // ojos saltones con pupila
    ctx.fillStyle = COL.eyeWhite;
    ctx.beginPath(); ctx.arc(cx + s * ex, cy - s * 0.3, s * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.pupil;
    ctx.beginPath(); ctx.arc(cx + s * ex, cy - s * 0.32, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}

function draw() {
  drawBackdrop();
  drawNests();

  // Río: troncos y tortugas.
  for (const lane of waterLanes) {
    const y = lane.row * CELL;
    for (const e of lane.entities) {
      if (e.turtle) {
        if (submerged(e)) continue;                        // hundida: no se dibuja (insegura)
        drawTurtles(e, y);
      } else {
        drawLog(e, y);
      }
    }
  }

  // Tráfico.
  const carColors = [COL.car1, COL.car2, COL.car3];
  for (let li = 0; li < roadLanes.length; li++) {
    const lane = roadLanes[li];
    const y = lane.row * CELL;
    for (const e of lane.entities) drawVehicle(e, y, carColors[li % 3]);
  }

  // Rana.
  drawFrogSprite(frog.x + 4, frog.y + 4, FROG, false);

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
  nowMs = timestamp;                          // alimenta las animaciones de fondo (ondas)
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
