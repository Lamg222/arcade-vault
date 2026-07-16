import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el servidor (Server Components, Route Handlers, Server Actions).
 * Enlaza el cookie store de Next.js (`cookies()` de `next/headers`, async en Next 16) para persistir la sesión.
 * `getAll`/`setAll` permiten a Supabase leer y refrescar los tokens de sesión guardados en cookies.
 */
export async function createClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // REQ-05: fallo ruidoso si falta cualquier var, en vez de pasar `undefined` a createServerClient.
  if (!url) throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey)
    throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        /* REQ-07: durante el render de un Server Component el cookie store es de solo lectura y `set` lanza. Lo tragamos: si hay middleware refrescando la sesión, la escritura ocurre allí; sin middleware, es inofensivo. */
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Ignorado a propósito (ver comentario arriba).
        }
      },
    },
  });
}
