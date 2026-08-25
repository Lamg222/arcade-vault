import type { User } from "@supabase/supabase-js";

/* Normaliza un nombre al formato de leaderboard: mayúsculas, sin espacios, ≤ 10 caracteres (mismo contrato que el CHECK de scores.player_name del spec 06). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "").slice(0, 10);
}

/* Resuelve el username visible de un usuario Supabase (REQ-09). Prioridad: username ya persistido en user_metadata; si no (primer login OAuth), lo derivado del proveedor — user_name/preferred_username (GitHub), name/full_name (Google) — y como último recurso el tramo local del email. */
export function usernameFromUser(user: User): string {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidate =
    (typeof m.username === "string" && m.username) ||
    (typeof m.user_name === "string" && m.user_name) ||
    (typeof m.preferred_username === "string" && m.preferred_username) ||
    (typeof m.name === "string" && m.name) ||
    (typeof m.full_name === "string" && m.full_name) ||
    user.email?.split("@")[0] ||
    "PLAYER1";
  const normalized = normalizeUsername(candidate);
  return normalized || "PLAYER1";
}
