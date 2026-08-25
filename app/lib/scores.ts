"use server";

// Capa de acceso a datos de puntuaciones (spec 06).
//
// Directiva "use server" a nivel de módulo: TODOS los exports son Server Functions
// (funciones que corren en el servidor). Esto permite importar `saveScore` desde el
// Player (Client Component) sin arrastrar `next/headers` al bundle del navegador —
// Next lo sustituye por una referencia de red (POST). Las lecturas se llaman
// directamente desde Server Components.
//
// D-01: leer en Server Components, escribir con Server Action.

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { usernameFromUser } from "./auth/username";

// Fila de score ya lista para la UI (incluye el título del juego para la vista global).
export type ScoreEntry = {
  id: string;
  game_id: string;
  game_title: string;
  player_name: string;
  score: number;
  created_at: string;
};

// Resultado de una lectura: `error=true` => fallo de red/config (REQ-10). La UI
// distingue "vacío" (rows=[] , error=false) de "error" (error=true).
export type ReadResult = { rows: ScoreEntry[]; error: boolean };

// Forma cruda que devuelve Supabase con el join a games (title anidado).
type RawRow = {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
  games: { title: string } | { title: string }[] | null;
};

function mapRow(r: RawRow): ScoreEntry {
  // El join anidado puede llegar como objeto o array (según la relación); normalizamos.
  const g = Array.isArray(r.games) ? r.games[0] : r.games;
  return {
    id: r.id,
    game_id: r.game_id,
    game_title: g?.title ?? r.game_id,
    player_name: r.player_name,
    score: r.score,
    created_at: r.created_at,
  };
}

// REQ-06: top global de todos los juegos, orden por score descendente.
export async function getGlobalTop(limit = 12): Promise<ReadResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scores")
      .select("id, game_id, player_name, score, created_at, games(title)")
      .order("score", { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: true };
    return { rows: (data as RawRow[]).map(mapRow), error: false };
  } catch {
    // REQ-10: claves ausentes/red caída => estado de error, sin romper la página.
    return { rows: [], error: true };
  }
}

// REQ-07: top de un juego concreto, orden por score descendente (usa el índice
// scores_game_score_idx).
export async function getGameTop(gameId: string, limit = 10): Promise<ReadResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scores")
      .select("id, game_id, player_name, score, created_at, games(title)")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: true };
    return { rows: (data as RawRow[]).map(mapRow), error: false };
  } catch {
    return { rows: [], error: true };
  }
}

// Resultado del guardado: discriminado para que la UI muestre éxito o el error real.
export type SaveResult = { ok: true } | { ok: false; error: string };

/* REQ-08/09 (spec 06) + REQ-18/19 (spec 09): Server Action que inserta un score. Con sesión activa, el servidor decide la identidad — user_id del usuario y player_name = username de user_metadata; el nombre que mande el cliente se ignora (no se puede suplantar a otro). Sin sesión (invitado), flujo original: nombre libre validado, user_id NULL. Valida en la app ANTES de tocar la base de datos y confía además en los CHECK/FK (NFR-02). Nunca finge éxito. */
export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<SaveResult> {
  if (!Number.isInteger(score) || score < 0)
    return { ok: false, error: "Puntuación inválida." };

  try {
    const supabase = await createClient();

    // NFR-05: si auth falla, degrada a invitado en vez de bloquear el guardado.
    let user = null;
    try {
      user = (await supabase.auth.getUser()).data.user;
    } catch {
      user = null;
    }

    let name: string;
    let userId: string | null = null;
    if (user) {
      name = usernameFromUser(user);
      userId = user.id;
    } else {
      name = (playerName ?? "").trim().toUpperCase().slice(0, 10);
      // Validación de forma (REQ-09 spec 06). El CHECK de la base de datos es la última línea.
      if (name.length < 1) return { ok: false, error: "Escribe tus iniciales (1-10)." };
      if (name.length > 10)
        return { ok: false, error: "El nombre no puede pasar de 10 caracteres." };
    }

    const { error } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: name, score, user_id: userId });
    // error incluye violación de CHECK (nombre/score) o FK (game_id inexistente) — AC-08/10.
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    // REQ-10: config/red — no rompas, informa.
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  // Refresca las vistas que muestran el nuevo score.
  revalidatePath("/salon");
  revalidatePath(`/juego/${gameId}`);
  return { ok: true };
}
