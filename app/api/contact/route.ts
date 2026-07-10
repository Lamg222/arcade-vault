import { NextResponse } from "next/server";
import { Resend } from "resend";

// Route Handler del formulario de contacto (/acerca).
// Solo POST: Next.js responde 405 (Method Not Allowed) a cualquier otro método por no exportarlo.
// La API key vive solo aquí (servidor); nunca se expone al cliente (REQ-19).

// Validación de formato de email: patrón mínimo "algo@algo.dominio".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FROM = "Arcade Vault <onboarding@resend.dev>";

type Body = { name?: unknown; email?: unknown; msg?: unknown };

export async function POST(req: Request) {
  // Parseo defensivo del cuerpo JSON (REQ-14: body inválido → 400).
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const msg = typeof body.msg === "string" ? body.msg.trim() : "";

  // Validación de campos (REQ-14): no vacíos + email con formato válido.
  if (!name || !msg || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Revisa el nombre, el correo y el mensaje." },
      { status: 400 }
    );
  }

  // Config de entorno (REQ-17): sin key o destinatario → 500 + log, sin filtrar la key.
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error(
      "[contact] Configuración ausente:",
      !apiKey ? "RESEND_API_KEY" : "",
      !to ? "CONTACT_TO_EMAIL" : ""
    );
    return NextResponse.json(
      { ok: false, error: "El servicio de correo no está configurado." },
      { status: 500 }
    );
  }

  // Envío vía Resend (REQ-15): from sandbox, to del equipo, replyTo = email del usuario.
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Nuevo mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
      html: `<h2>Nuevo mensaje desde Arcade Vault</h2>
<p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
<p><strong>Correo:</strong> ${escapeHtml(email)}</p>
<p style="white-space:pre-wrap">${escapeHtml(msg)}</p>`,
    });

    if (error || !data) {
      // REQ-18: fallo de Resend → 500 genérico, detalle solo en el log del servidor.
      console.error("[contact] Error de Resend:", error);
      return NextResponse.json(
        { ok: false, error: "No se pudo enviar el mensaje. Inténtalo más tarde." },
        { status: 500 }
      );
    }

    // REQ-16: envío confirmado → 200 con el id del email.
    return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  } catch (err) {
    console.error("[contact] Excepción al enviar:", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el mensaje. Inténtalo más tarde." },
      { status: 500 }
    );
  }
}

// Escapa caracteres HTML para evitar inyección en el cuerpo del correo.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
