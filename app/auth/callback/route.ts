import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { usernameFromUser } from "../../lib/auth/username";

/* Callback de auth (REQ-11/12): destino de los enlaces de confirmación/reseteo y del retorno OAuth. Canjea el código PKCE por sesión y redirige según `next` (confirmación/OAuth → /biblioteca, reseteo → /restablecer). Cualquier fallo aterriza en /auth con un error legible — nunca página en blanco. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/biblioteca";
  // El proveedor OAuth puede volver con error (p.ej. el usuario canceló el consentimiento) — REQ-10.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent("Acceso cancelado o rechazado por el proveedor.")}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent("Enlace inválido o incompleto. Pide uno nuevo.")}`,
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent("El enlace expiró o ya se usó. Pide uno nuevo.")}`,
      );
    }

    /* REQ-09: primer login OAuth sin username en user_metadata → derivarlo del proveedor y persistirlo. Fallo aquí no bloquea la sesión (el username se re-deriva al vuelo donde se necesite). */
    const user = data.user;
    if (user && typeof user.user_metadata?.username !== "string") {
      try {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { username: usernameFromUser(user) },
        });
        /* Fallo (como valor o excepción) no bloquea la sesión: el siguiente login reintenta esta rama y usernameFromUser deriva al vuelo mientras tanto. */
        if (metaError) console.warn("No se persistió username OAuth:", metaError.message);
      } catch {
        // Ver comentario anterior.
      }
    }

    // Solo rutas internas: evita open redirect (redirección abierta a dominios ajenos).
    const safeNext = next.startsWith("/") ? next : "/biblioteca";
    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent("No se pudo completar el acceso. Intenta de nuevo.")}`,
    );
  }
}
