"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const close = () => setOpen(false);

  const isInicio = pathname === "/";
  const isBiblioteca =
    pathname.startsWith("/biblioteca") ||
    pathname.startsWith("/juego") ||
    pathname.startsWith("/jugar");
  const isSalon = pathname.startsWith("/salon");
  const isAcerca = pathname.startsWith("/acerca");

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isInicio ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isBiblioteca ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isSalon ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/acerca" className={isAcerca ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENÚ</div>
        <Link href="/" className={isInicio ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isBiblioteca ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link href="/salon" className={isSalon ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/acerca" className={isAcerca ? "active" : ""} onClick={close}>
          Acerca de
        </Link>
        {user ? (
          <button
            className="pixel text-left text-[11px] text-[color:var(--ink-dim)]"
            onClick={() => {
              signOut();
              close();
            }}
          >
            Cerrar Sesión
          </button>
        ) : (
          <Link href="/auth" onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        <div className="flex-1" />
        <div className="pixel text-[9px] tracking-[0.16em] text-[color:var(--ink-faint)]">
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
