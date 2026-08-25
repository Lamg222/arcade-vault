"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { updatePassword } from "../lib/auth/actions";

/* REQ-15/16: fijar la contraseña nueva con la sesión de reseteo que dejó el callback. Sin sesión (enlace expirado o entrada directa) se explica y se ofrece pedir enlace nuevo — el intento de update también degrada con error legible. */
export default function RestablecerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pass !== pass2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const res = await updatePassword(pass);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-[color:var(--ink-faint)]">
            RESTABLECER ACCESO
          </div>
        </div>

        {done ? (
          <>
            <div className="mono text-[12px] leading-relaxed tracking-[0.08em] text-[color:var(--yellow)]">
              ▸ Contraseña actualizada. Ya tienes la sesión iniciada.
            </div>
            <button
              className="btn lg mt-4 w-full"
              onClick={() => router.push("/biblioteca")}
            >
              IR A LA BIBLIOTECA
            </button>
          </>
        ) : !user ? (
          <>
            <div className="mono text-[12px] leading-relaxed tracking-[0.08em] text-[color:var(--ink-dim)]">
              ▸ El enlace expiró, ya se usó, o llegaste aquí sin uno. Pide un enlace nuevo
              para restablecer tu contraseña.
            </div>
            <Link href="/recuperar" className="btn lg mt-4 block w-full text-center">
              PEDIR ENLACE NUEVO
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña (mín. 8)</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label>Repite la contraseña</label>
              <input
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="••••••••"
                disabled={busy}
              />
            </div>
            {error && (
              <div className="mono mt-2 text-[11px] tracking-[0.12em] text-[color:var(--magenta)]">
                ▸ {error}
              </div>
            )}
            <button className="btn lg mt-2 w-full" type="submit" disabled={busy}>
              {busy ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
