"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type User = { name: string } | null;

type AuthContextValue = {
  user: User;
  login: (name: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Estado solo en memoria: se pierde al recargar (sin persistencia, por diseño).
  const [user, setUser] = useState<User>(null);

  const login = (name: string) =>
    setUser({ name: (name || "PLAYER1").toUpperCase().slice(0, 10) });
  const signOut = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
