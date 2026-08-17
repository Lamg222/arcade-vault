import { getGameTop } from "../lib/scores";

/* Leaderboard por juego (REQ-07): Server Component asíncrono que lee el top real de un `gameId` desde la base de datos. Vacío o error => mensaje, sin datos ficticios (REQ-05/REQ-10). */

export default async function Leaderboard({ gameId, count = 10 }: { gameId: string; count?: number }) {
  const { rows, error } = await getGameTop(gameId, count);

  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.length === 0 ? (
        <div className="lb-row" style={{ justifyContent: "center", textAlign: "center" }}>
          {error
            ? "No se pudieron cargar las puntuaciones."
            : "Sé el primero en entrar al Salón de la Fama"}
        </div>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.id}
            className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
          >
            <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
            <div className="pl">
              {r.player_name}
              <div className="text-[10px] tracking-[0.1em] text-[color:var(--ink-faint)]">
                {new Date(r.created_at).toLocaleDateString("es-ES")}
              </div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
    </div>
  );
}
