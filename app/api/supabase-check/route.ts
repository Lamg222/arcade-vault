import { createClient } from "@/app/lib/supabase/server";

/**
 * Route Handler temporal de verificación (REQ-08, spec 04).
 * Prueba conectividad REAL contra el proyecto Supabase:
 *   1. fetch al endpoint de salud de GoTrue (el servicio de autenticación de Supabase): `${url}/auth/v1/health`, con la publishable key en `apikey`. Es un health-check público que sí golpea la red: valida URL + proyecto activo + alcance. URL malformada o red caída → fetch lanza → cae en el catch (AC-06). Proyecto inalcanzable → status no-ok → ok:false.
 *   2. `auth.getUser()` para reportar la sesión (null sin login) — informativo; sin sesión es una comprobación local, no de red.
 * Sin sesión y con proyecto sano la respuesta esperada es `{ ok: true, reachable: true, user: null }`.
 * Borrar (o proteger) una vez confirmada la conexión; ver decisión D-05 del spec.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    const falta = !url ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
    return Response.json({ ok: false, error: `Falta la variable ${falta}` }, { status: 500 });
  }

  try {
    // REQ-08 / AC-03 / AC-06: llamada de red real al health de GoTrue. Confirma URL + reachability del proyecto.
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json(
        { ok: false, reachable: true, status: res.status, error: `Supabase respondió ${res.status}` },
        { status: 502 },
      );
    }

    // Conexión confirmada. La sesión (null sin login) se reporta como dato informativo.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return Response.json({ ok: true, reachable: true, user: user ?? null });
  } catch (e) {
    // AC-06: URL malformada / DNS / red caída → fetch lanza aquí. Respuesta controlada, sin crash del servidor.
    const message = e instanceof Error ? e.message : "Error desconocido";
    return Response.json({ ok: false, reachable: false, error: message }, { status: 502 });
  }
}
