import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (middleware en Next <16): refresca el token de sesión de Supabase en cada
 * petición navegable (REQ-13). Sin sesión que refrescar es casi gratis (NFR-01).
 * Si Supabase no está configurado o falla, la petición sigue su curso: el modo
 * invitado nunca depende de auth (NFR-05).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        /* Reescribe las cookies en la request (para lo que se renderice en esta misma pasada) y en la response (para el navegador). Patrón oficial de @supabase/ssr. */
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    /* getClaims() valida el JWT localmente (firma asimétrica, sin round-trip a Supabase cuando el token sigue vigente — NFR-01) y dispara el refresco vía setAll solo cuando expiró. */
    await supabase.auth.getClaims();
  } catch {
    // NFR-05: auth caído no bloquea la navegación.
  }

  return response;
}

export const config = {
  /* REQ-13 / NFR-01: excluye assets estáticos y los juegos (public/games/) — no pagan el peaje de sesión. */
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
