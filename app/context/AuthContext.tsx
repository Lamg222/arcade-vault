"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { signOutAction } from "../lib/auth/actions";
import { usernameFromUser } from "../lib/auth/username";

// Usuario de sesión real (spec 09): id de auth.users + username de user_metadata.
export type AuthUser = { id: string; username: string } | null;

type AuthContextValue = {
  user: AuthUser;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/* REQ-17: el estado sale de la sesión real de Supabase. `initialUser` llega del servidor (layout.tsx) — así el primer render ya trae la sesión de las cookies, sin parpadeo. En el navegador, onAuthStateChange mantiene el estado al día (login, logout, refresco de token, retorno OAuth). */
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>(initialUser);
  const [prevInitial, setPrevInitial] = useState<AuthUser>(initialUser);

  /* Si el servidor re-renderiza con otra sesión (tras router.refresh()), sincroniza. Patrón "derived state" de React: ajustar estado durante el render evita el setState-en-effect. */
  if (
    (initialUser?.id ?? null) !== (prevInitial?.id ?? null) ||
    (initialUser?.username ?? null) !== (prevInitial?.username ?? null)
  ) {
    setPrevInitial(initialUser);
    setUser(initialUser);
  }

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      // NFR-05: sin config de Supabase la app sigue en modo invitado.
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, username: usernameFromUser(u) } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // REQ-07: logout real — invalida cookies en el servidor y refresca los Server Components.
  const signOut = async () => {
    setUser(null);
    try {
      await signOutAction();
    } finally {
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
