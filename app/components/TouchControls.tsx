"use client";

import { useEffect, useRef, type PointerEvent, type RefObject } from "react";

/* Gamepad táctil (spec 08). Visible solo bajo 768px (media query en globals.css). No extiende el puente postMessage: sintetiza KeyboardEvent (keydown/keyup con `key` Y `code`, porque los juegos mezclan ambas propiedades) directamente sobre el document del iframe — mismo origen, burbujea hasta window, así que llega tanto a los juegos que escuchan en document como a asteroides que escucha en window. Cero cambios en los game.js. La PAUSA es la excepción: usa el flujo postMessage del Player (REQ-08). */

const REPEAT_DELAY_MS = 250; // retardo inicial antes de auto-repetir, imita el teclado físico (REQ-06)
const REPEAT_INTERVAL_MS = 100;

type KeyDef = { key: string; code: string };

const DIRS: Record<"up" | "left" | "right" | "down", KeyDef> = {
  up: { key: "ArrowUp", code: "ArrowUp" },
  left: { key: "ArrowLeft", code: "ArrowLeft" },
  right: { key: "ArrowRight", code: "ArrowRight" },
  down: { key: "ArrowDown", code: "ArrowDown" },
};

const ACTION_A: KeyDef = { key: " ", code: "Space" }; // disparo / caída dura / lanzar / acción
const ACTION_B: KeyDef = { key: "Enter", code: "Enter" }; // reiniciar en snake y salta-carril

type Props = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  paused: boolean;
  onTogglePause: () => void;
};

export default function TouchControls({ iframeRef, paused, onTogglePause }: Props) {
  /* Timers de auto-repetición por `code` (multitouch: una dirección y un botón de acción pueden estar presionados a la vez). */
  const timers = useRef<Map<string, { delay?: number; interval?: number }>>(new Map());

  const dispatchKey = (type: "keydown" | "keyup", def: KeyDef, repeat = false) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.dispatchEvent(
      new KeyboardEvent(type, { key: def.key, code: def.code, repeat, bubbles: true, cancelable: true }),
    );
  };

  const clearTimers = (code: string) => {
    const t = timers.current.get(code);
    if (!t) return;
    if (t.delay !== undefined) window.clearTimeout(t.delay);
    if (t.interval !== undefined) window.clearInterval(t.interval);
    timers.current.delete(code);
  };

  const press = (def: KeyDef, repeats: boolean) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dispatchKey("keydown", def);
    if (!repeats) return;
    clearTimers(def.code);
    const delay = window.setTimeout(() => {
      const interval = window.setInterval(() => dispatchKey("keydown", def, true), REPEAT_INTERVAL_MS);
      timers.current.set(def.code, { interval });
    }, REPEAT_DELAY_MS);
    timers.current.set(def.code, { delay });
  };

  const release = (def: KeyDef) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    clearTimers(def.code);
    dispatchKey("keyup", def);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const code of Array.from(pending.keys())) {
        const t = pending.get(code);
        if (t?.delay !== undefined) window.clearTimeout(t.delay);
        if (t?.interval !== undefined) window.clearInterval(t.interval);
      }
      pending.clear();
    };
  }, []);

  const pad = (dir: keyof typeof DIRS, glyph: string, cls: string) => (
    <button
      type="button"
      className={`tc-btn tc-dir ${cls}`}
      aria-label={dir}
      onPointerDown={press(DIRS[dir], true)}
      onPointerUp={release(DIRS[dir])}
      onPointerCancel={release(DIRS[dir])}
      onPointerLeave={release(DIRS[dir])}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  );

  return (
    <div className="touch-controls" aria-hidden={false}>
      <div className="tc-dpad">
        {pad("up", "▲", "tc-up")}
        {pad("left", "◀", "tc-left")}
        {pad("right", "▶", "tc-right")}
        {pad("down", "▼", "tc-down")}
      </div>
      <button type="button" className="tc-btn tc-pause" onClick={onTogglePause}>
        {paused ? "REANUDAR" : "PAUSA"}
      </button>
      <div className="tc-actions">
        <button
          type="button"
          className="tc-btn tc-action tc-b"
          onPointerDown={press(ACTION_B, false)}
          onPointerUp={release(ACTION_B)}
          onPointerCancel={release(ACTION_B)}
          onPointerLeave={release(ACTION_B)}
          onContextMenu={(e) => e.preventDefault()}
        >
          B
        </button>
        <button
          type="button"
          className="tc-btn tc-action tc-a"
          onPointerDown={press(ACTION_A, false)}
          onPointerUp={release(ACTION_A)}
          onPointerCancel={release(ACTION_A)}
          onPointerLeave={release(ACTION_A)}
          onContextMenu={(e) => e.preventDefault()}
        >
          A
        </button>
      </div>
    </div>
  );
}
