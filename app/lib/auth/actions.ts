"use server";

// Server Actions de autenticación (spec 09). Todas devuelven errores como valores
// (nunca excepciones sin capturar) para que la UI los muestre sin fingir éxito
// (REQ-04/06). Los mensajes de Supabase se traducen a texto legible en español.

import { headers } from "next/headers";
import { createClient } from "../supabase/server";
import { normalizeUsername } from "./username";

export type AuthResult = { ok: true } | { ok: false; error: string };

// Origen de la petición actual (http://localhost:3000 en dev) para construir las URLs de retorno de los correos y de OAuth.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host") ?? "localhost:3000"}`;
}

// Mapea los errores más comunes de Supabase Auth a mensajes en español (REQ-04/06).
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered")) return "Ese email ya tiene cuenta.";
  if (m.includes("invalid login credentials")) return "Credenciales inválidas.";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de entrar.";
  if (m.includes("invalid email") || m.includes("validate email")) return "Email inválido.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many requests"))
    return "Demasiados intentos. Espera un momento.";
  if (m.includes("session missing") || m.includes("session_not_found"))
    return "El enlace expiró o ya se usó. Pide uno nuevo.";
  return message;
}

/* REQ-01/02/03: registro con email + contraseña + username en user_metadata. La validación también vive aquí (defensa en el servidor) aunque el formulario bloquee antes (REQ-03). */
export async function signUp(
  email: string,
  password: string,
  username: string,
): Promise<AuthResult> {
  const name = normalizeUsername(username);
  if (name.length < 1) return { ok: false, error: "Escribe un nombre de jugador (1-10)." };
  if (password.length < 8)
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: name },
        emailRedirectTo: `${origin}/auth/callback?next=/biblioteca`,
      },
    });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar." };
  }
}

// REQ-05/06: login con email + contraseña. La sesión queda en cookies vía el cliente server.
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo iniciar sesión." };
  }
}

// REQ-07: cierra la sesión invalidando las cookies.
export async function signOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cerrar sesión." };
  }
}

/* REQ-14 / NFR-04: pide el correo de reseteo y SIEMPRE responde neutro — no revela si el email existe (anti-enumeración). Solo un fallo de infraestructura (config/red) devuelve error. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const origin = await requestOrigin();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/restablecer`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar el correo." };
  }
}

// REQ-15/16: fija la contraseña nueva usando la sesión de reseteo activa; sin sesión, devuelve error legible.
export async function updatePassword(password: string): Promise<AuthResult> {
  if (password.length < 8)
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar." };
  }
}
