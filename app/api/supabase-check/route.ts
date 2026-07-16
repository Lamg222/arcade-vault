import { createClient } from "@/app/lib/supabase/server";

/**
 * Route Handler temporal de verificación (REQ-08, spec 04).
 * Prueba conectividad real contra el proyecto Supabase: instancia el cliente server y llama `auth.getUser()`.
 * Sin sesión, la respuesta esperada es `{ ok: true, user: null }` — confirma que URL + anon key + red funcionan.
 * Borrar (o proteger) una vez confirmada la conexión; ver decisión D-05 del spec.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Sin sesión, getUser devuelve `error` de "Auth session missing": es esperado, no un fallo de conexión.
    if (error && error.name !== "AuthSessionMissingError") {
      return Response.json({ ok: false, error: error.message }, { status: 502 });
    }

    return Response.json({ ok: true, user: user ?? null });
  } catch (e) {
    // AC-06: config/URL inválida o red caída → responder controlado, no crashear el servidor.
    const message = e instanceof Error ? e.message : "Error desconocido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
