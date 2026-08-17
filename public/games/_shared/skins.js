'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
 * Arcade Vault — mecanismo compartido de skins (FUENTE ÚNICA).
 *
 * Una "skin" es un tema visual intercambiable (paleta de colores) del juego.
 * Este archivo es el ÚNICO lugar donde vive la maquinaria del conmutador:
 *   - selección de skin por atributo en el <body>  (data-skin="clasico|neon|retro")
 *   - persistencia en localStorage con una clave común  (av-skin)
 *   - el botón de UI para conmutar dentro del juego
 *   - el registro de callbacks para que el canvas se repinte al cambiar
 *
 * Cada juego NO reimplementa nada de esto: solo declara SUS paletas (los valores
 * de color que ese juego dibuja) y se suscribe con AVSkin.onChange(...). Si te
 * descubres copiando la lógica del conmutador dentro de un game.js, ese es el bug.
 *
 * API pública (window.AVSkin):
 *   AVSkin.current()          -> id de la skin activa ('clasico' | 'neon' | 'retro')
 *   AVSkin.set(id)            -> cambia y persiste la skin
 *   AVSkin.cycle()            -> avanza a la siguiente skin
 *   AVSkin.skins()            -> lista de ids disponibles
 *   AVSkin.onChange(fn)       -> registra fn(id); se invoca UNA VEZ de inmediato
 *                                con la skin activa y luego en cada cambio.
 *
 * Las skins son PURAMENTE VISUALES: no tocan el contrato del puente postMessage
 * (mensajería iframe<->página), ni la jugabilidad, ni el score.
 * ───────────────────────────────────────────────────────────────────────────── */

(function () {
  const KEY = 'av-skin';                                 // clave común de localStorage
  const SKINS = ['clasico', 'neon', 'retro', 'claro'];   // 'clasico' es SIEMPRE el default
  const DEFAULT = 'clasico';
  const LABEL = { clasico: 'CLÁSICO', neon: 'NEON', retro: 'RETRO', claro: 'CLARO' };

  function read() {
    try {
      const v = localStorage.getItem(KEY);
      return SKINS.includes(v) ? v : DEFAULT;
    } catch (_) {
      // Sin localStorage (modo privado, file:// restringido): usa el default.
      return DEFAULT;
    }
  }

  function store(id) {
    try { localStorage.setItem(KEY, id); } catch (_) { /* ignora */ }
  }

  let current = read();
  const listeners = [];
  let btnLabel = null;

  function apply(id) {
    document.body.dataset.skin = id;              // selección por atributo
    if (btnLabel) btnLabel.textContent = LABEL[id];
    for (const fn of listeners) {
      try { fn(id); } catch (_) { /* un listener roto no rompe a los demás */ }
    }
  }

  function set(id) {
    if (!SKINS.includes(id)) return;
    current = id;
    store(id);
    apply(id);
  }

  function cycle() {
    const i = SKINS.indexOf(current);
    set(SKINS[(i + 1) % SKINS.length]);
  }

  // ── Botón de UI compartido (flotante arriba-derecha) ────────────────────────
  function buildUI() {
    const btn = document.createElement('button');
    btn.className = 'av-skin-switch';
    btn.type = 'button';
    btn.tabIndex = -1;                            // no roba foco por teclado (Tab)
    btn.setAttribute('aria-label', 'Cambiar skin del juego');
    btn.innerHTML =
      '<span class="av-skin-icon" aria-hidden="true">◆</span>' +
      '<span class="av-skin-label"></span>';
    btnLabel = btn.querySelector('.av-skin-label');
    // Evita que el click deje el foco en el botón: si no, la barra espaciadora
    // (disparo/caída del juego) activaría el botón en vez de jugar.
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => { cycle(); btn.blur(); });
    document.body.appendChild(btn);
  }

  window.AVSkin = {
    current: () => current,
    set,
    cycle,
    skins: () => SKINS.slice(),
    onChange(fn) {
      if (typeof fn !== 'function') return fn;
      listeners.push(fn);
      try { fn(current); } catch (_) { /* ignora */ }   // invocación inicial
      return fn;
    },
  };

  function boot() { buildUI(); apply(current); }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
