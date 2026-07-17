/**
 * Contrato del puente `postMessage` (mensajería entre iframe y página) entre un juego embebido y el Player de la plataforma.
 * Fuente única del protocolo (spec 05), espejada en el bridge JS de cada juego (p.ej. `public/games/asteroides/game.js`).
 * Reusable para cualquier juego que se porte a la plataforma vía iframe (marco aislado).
 */

/** Mensajes que el juego (iframe) envía al Player (host React). */
export type GameToHost =
  | { type: "ready" }
  | { type: "score"; value: number }
  | { type: "lives"; value: number }
  | { type: "level"; value: number }
  | { type: "powerup"; name: string; remaining: number }
  | { type: "paused"; value: boolean }
  | { type: "gameover"; score: number };

/** Comandos que el Player (host React) envía al juego (iframe). */
export type HostToGame =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" };

/** Type guard: valida que un dato arbitrario sea un mensaje GameToHost conocido. */
export function isGameToHost(data: unknown): data is GameToHost {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as { type?: unknown }).type;
  return (
    t === "ready" ||
    t === "score" ||
    t === "lives" ||
    t === "level" ||
    t === "powerup" ||
    t === "paused" ||
    t === "gameover"
  );
}
