"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../lib/auth/actions";

/* REQ-14: pedir el correo de reseteo. El aviso es SIEMPRE el mismo, exista o no la cuenta (anti-enumeración, NFR-04). */
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Escribe tu email.");
      return;
    }
    setBusy(true);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-[color:var(--ink-faint)]">
            RESETEO DE CONTRASEÑA
          </div>
        </div>

        {sent ? (
          <div className="mono text-[12px] leading-relaxed tracking-[0.08em] text-[color:var(--ink-dim)]">
            ▸ Si existe una cuenta con ese email, llegará un correo con el enlace para
            restablecer la contraseña. Revisa también el spam.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                disabled={busy}
              />
            </div>
            {error && (
              <div className="mono mt-2 text-[11px] tracking-[0.12em] text-[color:var(--magenta)]">
                ▸ {error}
              </div>
            )}
            <button className="btn lg mt-2 w-full" type="submit" disabled={busy}>
              {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/auth"
            className="mono text-[11px] tracking-[0.12em] text-[color:var(--ink-dim)] underline"
          >
            Volver al acceso
          </Link>
        </div>
      </div>
    </div>
  );
}
