import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el navegador (Client Components).
 * Usa las dos env vars públicas (prefijo NEXT_PUBLIC_, expuestas al bundle del navegador).
 * `createBrowserClient` gestiona la sesión vía cookies del navegador, compatible con el cliente server SSR.
 */
export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // REQ-05: fallo ruidoso si falta cualquier var, en vez de pasar `undefined` a createBrowserClient.
  if (!url) throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createBrowserClient(url, anonKey);
}
