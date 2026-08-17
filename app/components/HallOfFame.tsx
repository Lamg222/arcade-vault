import Link from "next/link";
import { getGlobalTop } from "../lib/scores";
import type { ScoreEntry } from "../lib/scores";

/* Salón de la Fama: vista global (REQ-06). Server Component asíncrono que lee el top real de todos los juegos (orden por score descendente) desde la base de datos. Sin datos ficticios (REQ-05/D-02). */

// Formatea un timestamptz ISO como dd/mm/aaaa (es-ES).
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function EmptyOrError({ error }: { error: boolean }) {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>
      <div className="hall-table">
        <div className="tr" style={{ justifyContent: "center", textAlign: "center" }}>
          {/* REQ-05: mensaje de vacío. REQ-10: mismo lienzo si la lectura falló, sin romper la página. */}
          {error
            ? "No se pudo cargar el Salón de la Fama. Inténtalo de nuevo."
            : "Sé el primero en entrar al Salón de la Fama"}
        </div>
      </div>
      <div className="mt-8 text-center">
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

export default async function HallOfFame() {
  const { rows, error } = await getGlobalTop(12);

  if (error || rows.length === 0) return <EmptyOrError error={error} />;

  // El podio necesita hasta 3 filas; con menos, solo se muestran las disponibles.
  const podium = rows.slice(0, 3);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      {podium.length === 3 && (
        <div className="podium">
          <PodiumSlot cls="silver" rank="02" row={podium[1]} />
          <div className="podium-slot gold">
            <div className="pixel text-[9px] tracking-[0.18em] text-[color:var(--gold)]">CAMPEÓN</div>
            <div className="rank-num mt-1 text-[36px]">01</div>
            <div className="name">{podium[0].player_name}</div>
            <div className="score text-[20px]">{podium[0].score.toLocaleString("es-ES")}</div>
            <div className="date">{fmtDate(podium[0].created_at)}</div>
          </div>
          <PodiumSlot cls="bronze" rank="03" row={podium[2]} />
        </div>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>JUEGO</div>
          <div>PUNTUACIÓN</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
            <div className="pl">{r.player_name}</div>
            <div className="dt">{r.game_title}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

function PodiumSlot({ cls, rank, row }: { cls: string; rank: string; row: ScoreEntry }) {
  return (
    <div className={"podium-slot " + cls}>
      <div className="rank-num">{rank}</div>
      <div className="name">{row.player_name}</div>
      <div className="score">{row.score.toLocaleString("es-ES")}</div>
      <div className="date">{fmtDate(row.created_at)}</div>
    </div>
  );
}
