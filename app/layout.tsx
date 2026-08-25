import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, type AuthUser } from "./context/AuthContext";
import Nav from "./components/Nav";
import { createClient } from "./lib/supabase/server";
import { usernameFromUser } from "./lib/auth/username";

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Arcade Vault",
    template: "%s · Arcade Vault",
  },
  description: "Juega en línea y compite por el puntaje más alto",
};

/* REQ-17: lee la sesión de las cookies en el servidor para que el primer render ya conozca al usuario. Degrada a invitado si Supabase falta o falla (NFR-05). */
async function getInitialUser(): Promise<AuthUser> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { id: user.id, username: usernameFromUser(user) } : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialUser();
  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div className="av-bg" aria-hidden />
        <div className="av-noise" aria-hidden />
        <AuthProvider initialUser={initialUser}>
          <div id="root">
            <Nav />
            <main className="av-main">{children}</main>
            <footer className="border-t border-[color:var(--line)] px-8 py-5 text-center font-[family-name:var(--mono)] text-[11px] tracking-[0.16em] text-[color:var(--ink-faint)]">
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
