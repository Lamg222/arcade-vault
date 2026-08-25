"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { resendConfirmation, signIn, signUp } from "../lib/auth/actions";
import { createClient } from "../lib/supabase/client";

/* Pantalla de acceso real (spec 09). `callbackError` llega de /auth?error=... — mensajes del callback (enlace expirado, OAuth cancelado; REQ-10/12). */
export default function Auth({ callbackError }: { callbackError?: string }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(callbackError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  /* REQ-03: validación local ANTES de llamar a Supabase — bloquea y nombra el error concreto. */
  const validate = (): string | null => {
    if (!email.trim()) return "Escribe tu email.";
    if (pass.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (tab === "up") {
      const name = username.trim();
      if (name.length < 1) return "Escribe un nombre de jugador.";
      if (name.length > 10) return "El nombre no puede pasar de 10 caracteres.";
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const localError = validate();
    if (localError) {
      setError(localError);
      return;
    }
    setBusy(true);
    if (tab === "up") {
      // REQ-01/02: registro con username en user_metadata; sin sesión hasta confirmar el correo.
      const res = await signUp(email, pass, username);
      setBusy(false);
      if (res.ok) {
        setNotice("REVISA TU CORREO: te enviamos un enlace para confirmar la cuenta.");
      } else {
        setError(res.error);
      }
    } else {
      // REQ-05/06: login real; la sesión queda en cookies y refrescamos los Server Components.
      const res = await signIn(email, pass);
      setBusy(false);
      if (res.ok) {
        router.push("/biblioteca");
        router.refresh();
      } else {
        setError(res.error);
      }
    }
  };

  // REQ-08: OAuth con PKCE — redirige al proveedor; el retorno cae en /auth/callback.
  const oauth = async (provider: "google" | "github") => {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/biblioteca` },
      });
      if (oauthError) {
        setError(oauthError.message);
        setBusy(false);
      }
      // Sin error, el navegador está redirigiendo al proveedor: no reactivamos el botón.
    } catch {
      setError("No se pudo iniciar el acceso con el proveedor.");
      setBusy(false);
    }
  };

  const asGuest = () => {
    if (user) signOut();
    router.push("/biblioteca");
  };

  /* AC-11: ofrecer reenvío del enlace de confirmación cuando el error apunta a correo sin confirmar o enlace caducado. */
  const confirmationIssue =
    !!error && /confirma tu correo|expiró|inválido o incompleto/i.test(error);

  const resend = async () => {
    if (!email.trim()) {
      setError("Escribe tu email arriba para reenviarte el enlace.");
      return;
    }
    setBusy(true);
    const res = await resendConfirmation(email);
    setBusy(false);
    setError(null);
    if (res.ok) {
      setNotice("Si la cuenta existe y sigue sin confirmar, te reenviamos el enlace.");
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-[color:var(--ink-faint)]">
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Nombre de jugador (máx. 10)</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="PX_KAI"
                disabled={busy}
              />
            </div>
          )}
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
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="mono mt-2 text-[11px] tracking-[0.12em] text-[color:var(--magenta)]">
              ▸ {error}
              {confirmationIssue && (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={resend}
                  disabled={busy}
                >
                  REENVIAR CONFIRMACIÓN
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="mono mt-2 text-[11px] tracking-[0.12em] text-[color:var(--yellow)]">
              ▸ {notice}
            </div>
          )}

          <button className="btn lg mt-2 w-full" type="submit" disabled={busy}>
            {busy ? "PROCESANDO…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>
        </form>

        {tab === "in" && (
          <div className="mt-2 text-center">
            <Link
              href="/recuperar"
              className="mono text-[11px] tracking-[0.12em] text-[color:var(--ink-dim)] underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        )}

        <button className="btn ghost mt-2.5 w-full" onClick={asGuest} disabled={busy}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" onClick={() => oauth("google")} disabled={busy}>
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button" onClick={() => oauth("github")} disabled={busy}>
            ▣ GITHUB
          </button>
        </div>

        <div className="mt-4 text-center text-[11px] tracking-[0.1em] text-[color:var(--ink-faint)]">
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
