# SPEC 03 — About real (Acerca de nosotros) y contacto por email con Resend

> **Status:** Implemented · **Depends on:** 02-landing-home-y-nav · **Date:** 2026-07-06
> **Objective:** Reemplazar el placeholder (contenido provisional "de relleno") de la ruta `/acerca` por la página About (página "Acerca de") real (`about.jsx`: misión, highlights (puntos destacados), formulario de contacto, terminal de éxito) con envío de correo funcional vía Resend (servicio de correo transaccional — envío automático por API) a `alberto22295@gmail.com`, renombrando el enlace de nav (barra de navegación) a "Acerca de nosotros".

> The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are to be interpreted as described in RFC 2119 and RFC 8174 when, and only when, they appear in all capitals.
> _(RFC 2119/8174 = documentos estándar que fijan el significado exacto de MUST/MUST NOT/SHOULD… en especificaciones técnicas.)_

_Nota: se implementa `references/home-about/about.jsx` completo. El envío usa **Resend** (servicio de correo transaccional vía API — interfaz de programación para pedir el envío) desde un **Route Handler** (manejador de ruta HTTP en el servidor de Next.js) server-side (del lado del servidor, `app/api/contact/route.ts`); la API key (clave secreta de acceso a la API) vive en `.env.local` (archivo de variables de entorno local, no versionado — fuera del control de versiones Git). Remitente en sandbox (entorno de pruebas) `onboarding@resend.dev`; destinatario configurable por `CONTACT_TO_EMAIL`._

---

## Scope

_(Scope = alcance: qué entra y qué NO entra en este spec.)_

**In (dentro del alcance):**

- **Página About (página "Acerca de") real** en `/acerca` (reemplaza el placeholder — contenido provisional — del spec 02), portada fiel de `references/home-about/about.jsx`:
  - **Hero About** — kicker (línea corta de encabezado, "▸ ACERCA DE"), título, misión, fila de 3 highlights (puntos destacados: corazón / navegador / crecimiento) con íconos SVG (Scalable Vector Graphics — gráficos vectoriales que escalan sin pixelarse) estilo pixel-art (arte de píxeles, estética retro).
  - **Divider banner** (banda separadora) animado (barras + píxeles).
  - **Sección Contacto** — intro (introducción) con tips (consejos: respuesta 24-48h, sugerencias, sin spam) + formulario (nombre, correo, mensaje).
  - **Terminal de éxito** — animación "VAULT-OS // TERMINAL" (imita una terminal — consola de comandos — retro) tras envío OK, con botón "ENVIAR OTRO MENSAJE".
- **Reveal-on-scroll** (aparición al desplazar la página) en secciones `.reveal` reusando `useReveal()` (hook — función reutilizable de React con lógica de estado/efectos — cliente del spec 02).
- **Envío de correo funcional** vía **Route Handler** (manejador de ruta HTTP en el servidor) `app/api/contact/route.ts` (método POST — verbo HTTP para enviar datos al servidor) que llama a Resend.
- **Cliente `About.tsx`** (componente que corre en el navegador) que hace `fetch` (llamada HTTP desde el navegador) a `/api/contact`, gestiona estados (enviando, éxito, error, shake — sacudida visual — por validación).
- **Validación** de `name`, `email`, `msg` en cliente y servidor (no-vacío + formato email).
- **Nav (barra de navegación)** (`Nav.tsx`): renombrar enlace "Acerca de" → **"Acerca de nosotros"** (desktop — escritorio — + panel móvil), ruta `/acerca` sin cambios; estado `active` (enlace marcado como activo) preservado.
- **Config de entorno:** dependencia `resend` (librería instalada) en `package.json`; variables de entorno (valores de configuración externos al código) `RESEND_API_KEY` y `CONTACT_TO_EMAIL` declaradas en `.env.example` (plantilla versionada — de ejemplo, sin valores reales) y consumidas desde el server (servidor). Valores reales en `.env.local` (no versionado) que provee el usuario.
- **Migración de estilos** (mover reglas CSS — hojas de estilo) `.about-*`, `.highlight*`, `.contact-*`, `.field`, `.terminal-success`, `.term-*`, `.tip*`, `.shake`, `.about-divider`, `.div-*` desde `references/home-about/styles.css` a `app/globals.css` (los no migrados ya en spec 02).
- **Metadata** (metadatos — datos de la página para el navegador/buscadores) de `/acerca` → title (título de pestaña) "Acerca de nosotros".

**Out of scope (fuera de alcance, para specs futuros):**

- **Dominio propio verificado** en Resend (DKIM — firma criptográfica que autentica el correo / SPF — registro DNS que autoriza qué servidores envían por tu dominio). Se usa el sandbox (entorno de pruebas) `onboarding@resend.dev`; migración de dominio queda fuera.
- **Autoreply** (acuse de recibo automático) al usuario que escribe. Solo se notifica al equipo.
- **Anti-abuso avanzado**: honeypot (campo trampa oculto anti-bots), rate limit (límite de peticiones por IP — dirección de red) por IP, CAPTCHA (reto para distinguir humano de bot). Solo validación de campos.
- **Persistencia** (guardar de forma permanente) de los mensajes (BD — base de datos, CRM — gestor de relación con clientes, tabla). El mensaje solo viaja por email; no se guarda.
- **Adjuntos** (archivos anexos) en el formulario.
- **i18n** (internationalization — soporte multi-idioma). Todo en Español.
- **Tests automatizados** (pruebas de código que corren solas). Verificación = build (compilación) + envío manual real.
- Cambiar la ruta a `/sobre-nosotros` (se mantiene `/acerca`).

---

## Data model

_(Data model = modelo de datos: qué estructuras de datos maneja la funcionalidad.)_

Sin datos persistentes nuevos (nada que se guarde en disco/BD). El contenido estático (fijo) de la página (misión, highlights, tips) se porta como literales (valores escritos directamente en el código) en el propio componente o en un módulo de datos ligero; el mensaje del formulario es efímero (temporal: viaja por email, no se guarda).

**Payload (cuerpo de datos) del formulario → API** (contrato — forma acordada — del `fetch` POST a `/api/contact`):

```ts
// Request body (cuerpo de la petición, en formato JSON — JavaScript Object Notation, texto estructurado)
type ContactRequest = {
  name: string;   // nombre del remitente, no vacío tras trim() (quita espacios sobrantes)
  email: string;  // email del remitente, formato válido
  msg: string;    // cuerpo del mensaje, no vacío tras trim()
};

// Response OK (respuesta correcta, HTTP 200 — código de éxito)
type ContactOk = { ok: true; id: string };   // id = identificador del email devuelto por Resend

// Response error (HTTP 400 validación | 429 rate | 500 fallo Resend/env)
//   400 = "Bad Request" (petición mal formada) · 429 = "Too Many Requests" (demasiadas) · 500 = error interno del servidor
type ContactError = { ok: false; error: string };  // mensaje legible para el cliente
```

**Correo generado** (lo que Resend envía):

```ts
{
  from: "Arcade Vault <onboarding@resend.dev>",   // from = remitente; sandbox (entorno de pruebas)
  to: process.env.CONTACT_TO_EMAIL,                // to = destinatario; alberto22295@gmail.com
  reply_to: email,                                  // reply_to = a quién responde el botón "Responder"; email del usuario → responder con 1 clic
  subject: `[Arcade Vault] Nuevo mensaje de ${name}`,  // subject = asunto
  text / html: cuerpo con name, email, msg,        // text = texto plano · html = versión con formato
}
```

**Variables de entorno** (valores de configuración externos al código, consumidas solo en servidor):

| Variable | Uso | Dónde |
| --- | --- | --- |
| `RESEND_API_KEY` | Autenticación (probar identidad) con la API de Resend | `.env.local` (real) · `.env.example` (placeholder — de ejemplo) |
| `CONTACT_TO_EMAIL` | Destinatario de las notificaciones | igual |

Convenciones:

- **Clasificación de datos:** `name`/`email`/`msg` son **PII** (Personally Identifiable Information — datos personales identificables) del remitente. No se persisten (no se guardan); solo se transmiten a Resend y al buzón del equipo. `reply_to` (dirección de respuesta) expone el email del usuario únicamente al destinatario interno.
- **Secretos:** `RESEND_API_KEY` (clave secreta) nunca se expone al cliente (sin prefijo `NEXT_PUBLIC_` — el prefijo que en Next.js haría la variable visible en el navegador); solo se lee en el Route Handler (código de servidor).
- **Datos estáticos** (highlights, tips, textos de misión): literales deterministas (siempre el mismo valor), sin `Math.random()` (número aleatorio) / `Date.now()` (marca de tiempo actual) → evita hydration mismatch (desajuste de hidratación: cuando el HTML del servidor no coincide con el que reconstruye el navegador), coherente con spec 02.

---

## Requirements

_(Requirements = requisitos, escritos en formato EARS — Easy Approach to Requirements Syntax, sintaxis estructurada — con palabra clave RFC 2119 en mayúsculas e ID único. Tipos: ubiquitous = siempre; event-driven = "When…" al ocurrir un evento; state-driven = "While…" mientras dura un estado; unwanted behavior = "If… then…" ante un caso no deseado.)_

**Página About (`/acerca`)**

- **REQ-01** (ubiquitous — siempre): The `/acerca` route MUST render the real About page (hero, misión, 3 highlights, divider, sección de contacto), replacing the spec-02 placeholder.
- **REQ-02** (ubiquitous — siempre): The About page MUST source its static text (misión, highlights, tips) from deterministic literals, never from `Math.random()`/`Date.now()`.
- **REQ-03** (state-driven — mientras dura un estado): While a `.reveal` section scrolls into the viewport (área visible de la pantalla) (threshold — umbral ≥ 0.12, es decir ≥12% visible), the system MUST add the `in` class once per element (reusing `useReveal()`).
- **REQ-04** (ubiquitous — siempre): Per-route metadata `title` (título por ruta) for `/acerca` MUST be "Acerca de nosotros".

**Nav (barra de navegación)**

- **REQ-05** (ubiquitous — siempre): The nav MUST label the `/acerca` link **"Acerca de nosotros"** in both desktop and mobile panels.
- **REQ-06** (state-driven — mientras dura un estado): While on `/acerca`, the nav MUST mark that link `active` (activo).

**Formulario — cliente (`About.tsx`)**

- **REQ-07** (event-driven — al ocurrir un evento): When the user submits the form with any of `name`/`email`/`msg` empty after trim, the system MUST NOT send the request and MUST trigger the `shake` (sacudida) feedback.
- **REQ-08** (event-driven — al ocurrir un evento): When the user submits a valid form, the client MUST POST `{name,email,msg}` as JSON to `/api/contact`.
- **REQ-09** (state-driven — mientras dura un estado): While the request is in flight (en vuelo — enviada y esperando respuesta), the system MUST show a sending/disabled state (estado enviando/deshabilitado) and MUST prevent duplicate submissions.
- **REQ-10** (event-driven — al ocurrir un evento): When the API responds `200 {ok:true}`, the system MUST render the "VAULT-OS // TERMINAL" success animation with the sender name.
- **REQ-11** (event-driven — al ocurrir un evento): When the user activates "ENVIAR OTRO MENSAJE", the system MUST reset the form and return to the input state.
- **REQ-12** (unwanted behavior — caso no deseado): If the API responds non-2xx (código distinto de 2xx = fuera del rango de éxito) or the fetch rejects (network error — fallo de red), then the system MUST show a legible error message and keep the entered data intact (no data loss — sin pérdida de datos).

**Endpoint — servidor (`app/api/contact/route.ts`)**

_(Endpoint = URL del servidor que recibe y responde peticiones.)_

- **REQ-13** (ubiquitous — siempre): The endpoint MUST accept only POST; other methods MUST return `405` (Method Not Allowed — método HTTP no permitido).
- **REQ-14** (unwanted behavior — caso no deseado): If the body is missing a field, has empty `name`/`msg` after trim, or an `email` failing format validation, then the endpoint MUST return `400 {ok:false,error}` (Bad Request) without calling Resend.
- **REQ-15** (event-driven — al ocurrir un evento): When the payload is valid, the endpoint MUST call Resend with `from` = `onboarding@resend.dev`, `to` = `CONTACT_TO_EMAIL`, `reply_to` = user email, subject `[Arcade Vault] Nuevo mensaje de ${name}`, and a body containing name/email/msg.
- **REQ-16** (event-driven — al ocurrir un evento): When Resend confirms send, the endpoint MUST return `200 {ok:true,id}`.
- **REQ-17** (unwanted behavior — caso no deseado): If `RESEND_API_KEY` or `CONTACT_TO_EMAIL` is missing/undefined (ausente), then the endpoint MUST return `500 {ok:false,error}` (error interno del servidor) and MUST log (registrar en los logs del servidor) the misconfiguration server-side, without leaking (sin filtrar) the key.
- **REQ-18** (unwanted behavior — caso no deseado): If the Resend call throws/fails (lanza excepción o falla), then the endpoint MUST return `500 {ok:false,error}` with a generic message (no internal details leaked to the client — sin filtrar detalles internos al cliente).

**Seguridad / config**

- **REQ-19** (ubiquitous — siempre): `RESEND_API_KEY` MUST NOT be exposed to the client (no `NEXT_PUBLIC_` prefix — el prefijo que la haría visible en el navegador); it MUST be read only in server code.
- **REQ-20** (ubiquitous — siempre): `.env.example` MUST document `RESEND_API_KEY` and `CONTACT_TO_EMAIL` (placeholders — valores de ejemplo), and `.env.local` MUST NOT be committed (no debe subirse al repositorio, gitignored — excluido por `.gitignore`).

---

## Implementation plan

_(Implementation plan = plan de implementación: pasos concretos. Cada paso deja la app compilando —`next build`, comando que genera la versión de producción— y commiteable —listo para guardar como commit de Git— por sí solo.)_

1. **Dependencia + entorno.** Añadir `resend` (librería) a `package.json` (`npm install resend` — comando que instala el paquete). Crear `.env.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=`. Verificar que `.env.local` está en `.gitignore` (lista de archivos que Git ignora; Next.js ya lo incluye). _(REQ-19, REQ-20)_
2. **Route Handler (manejador de ruta HTTP).** Crear `app/api/contact/route.ts`: `export async function POST(req)` (función asíncrona que atiende el POST) que parsea (interpreta) el JSON, valida (`name`/`msg` no vacíos, `email` con regex — patrón de texto para validar formato), lee env vars (variables de entorno), instancia `new Resend(process.env.RESEND_API_KEY)` (crea el cliente de Resend), llama `resend.emails.send({...})`, devuelve `NextResponse.json` (helper de Next.js para responder JSON) con los códigos `200/400/500`. Sin export `GET` → métodos no-POST caen en `405` por defecto del framework (el marco de trabajo, Next.js). _(REQ-13..19)_
3. **Migrar estilos About.** Copiar de `references/home-about/styles.css` a `app/globals.css` los bloques (selectores CSS) `.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight`, `.hl-*`, `.about-divider`, `.div-*`, `.about-contact`, `.contact-*`, `.field`, `.tip*`, `.shake`, `.terminal-success`, `.term-*`, `.caret` (solo los que aún no migró el spec 02). _(REQ-01)_
4. **Componente About (cliente).** Crear `app/components/About.tsx` (`'use client'` — directiva que marca el componente para correr en el navegador): portar `about.jsx` a TSX (TypeScript + JSX — JavaScript con tipos y sintaxis de componentes) (misión, highlights con `HighlightIcon` SVG, divider, form). Sustituir el `onSubmit` (manejador de envío) local por: validar → `fetch('/api/contact', {method:'POST', body})` → estados `sending`/`sent`/`error`/`shake`. Mantener la terminal de éxito y "ENVIAR OTRO MENSAJE". Usar `useReveal()`. _(REQ-02, REQ-03, REQ-07..12)_
5. **Montar en `/acerca`.** Reescribir `app/acerca/page.tsx`: quitar el placeholder "próximamente", renderizar (dibujar en pantalla) `<About/>`, metadata `title: "Acerca de nosotros"`. _(REQ-01, REQ-04)_
6. **Nav.** En `app/components/Nav.tsx` renombrar el texto "Acerca de" → "Acerca de nosotros" (desktop + panel móvil); `active` por `/acerca` ya existe del spec 02, verificar. _(REQ-05, REQ-06)_

**Archivos nuevos:** `app/api/contact/route.ts`, `app/components/About.tsx`, `.env.example`.
**Archivos tocados:** `app/acerca/page.tsx`, `app/components/Nav.tsx`, `app/globals.css`, `package.json` (+ `package-lock.json` — archivo que fija las versiones exactas instaladas).

---

## Acceptance criteria

_(Acceptance criteria = criterios de aceptación: condiciones que prueban que la funcionalidad está terminada. Formato Given-When-Then — Dado/Cuando/Entonces — para conducta condicional; checklist booleano — lista de sí/no — para hechos simples.)_

**Build / rutas (REQ-01, REQ-04)**

- [ ] `next build` (compilación de producción) termina exit 0 (código de salida 0 = sin error), sin warnings (avisos) de hydration (desajuste servidor/cliente al hidratar).
- [ ] `/acerca` responde con la About real; su `<title>` (título de pestaña) es "Acerca de nosotros".

**Página About (REQ-01, REQ-02, REQ-03)**

```
Scenario: secciones presentes
  Given (dado que) navego a /acerca
  Then (entonces) veo en orden: hero "ACERCA DE ARCADE VAULT" + misión, fila de 3 highlights,
       divider animado, sección "CONTÁCTANOS" con tips y formulario

Scenario: reveal al hacer scroll (state, REQ-03)
  Given una sección .reveal fuera del viewport (área visible)
  When (cuando) entra en pantalla
  Then recibe la clase "in", una sola vez
```

**Nav (REQ-05, REQ-06)**

```
Scenario: enlace renombrado
  Given el nav (desktop y móvil)
  Then el enlace a /acerca dice "Acerca de nosotros"

Scenario: active por ruta (state)
  Given estoy en /acerca
  Then "Acerca de nosotros" queda active (marcado como activo)
```

**Formulario — cliente (REQ-07..12)**

```
Scenario: validación vacía (unwanted, REQ-07)
  Given un campo vacío (name, email o msg)
  When envío
  Then no se hace POST y el form hace shake (sacudida)

Scenario: envío exitoso (REQ-08, REQ-10)
  Given nombre, email válido y mensaje
  When envío y la API responde 200 {ok:true}
  Then aparece la terminal "VAULT-OS // TERMINAL" con mi nombre en mayúsculas

Scenario: doble envío bloqueado (state, REQ-09)
  While la petición está en vuelo (in flight — enviada, esperando respuesta)
  Then el botón queda deshabilitado y no se dispara un segundo POST

Scenario: reset (REQ-11)
  Given la terminal de éxito
  When activo "ENVIAR OTRO MENSAJE"
  Then vuelvo al formulario vacío

Scenario: error de API/red (unwanted, REQ-12)
  Given la API responde 500 (error interno del servidor) (o falla la red)
  When envío
  Then veo un mensaje de error legible y mis datos siguen en el form (sin pérdida)
```

**Endpoint (REQ-13..18)**

```
Scenario: método no permitido (REQ-13)
  When hago GET (verbo HTTP de lectura) a /api/contact
  Then recibo 405 (Method Not Allowed — método no permitido)

Scenario: payload inválido (unwanted, REQ-14)
  Given body (cuerpo) sin msg (o email con formato inválido)
  When POST /api/contact
  Then recibo 400 {ok:false,error} y Resend NO se invoca

Scenario: envío correcto (REQ-15, REQ-16)
  Given payload válido y env vars presentes
  When POST /api/contact
  Then Resend envía con from=onboarding@resend.dev, to=CONTACT_TO_EMAIL,
       reply_to=email del usuario, subject "[Arcade Vault] Nuevo mensaje de <name>"
  And recibo 200 {ok:true,id}

Scenario: env faltante (unwanted, REQ-17)
  Given RESEND_API_KEY o CONTACT_TO_EMAIL sin definir
  When POST /api/contact
  Then recibo 500, se loguea (registra) el error en servidor, y la key no se filtra

Scenario: fallo de Resend (unwanted, REQ-18)
  Given Resend lanza excepción
  When POST /api/contact
  Then recibo 500 con mensaje genérico (sin detalles internos)
```

**Seguridad (REQ-19, REQ-20)**

- [ ] No hay `NEXT_PUBLIC_RESEND_API_KEY` ni la key aparece en el bundle (paquete JS que descarga el navegador) del cliente.
- [ ] `.env.example` documenta ambas variables con placeholders (valores de ejemplo); `.env.local` no está versionado (fuera de Git).

**Fuera de alcance (check explícito)**

- [ ] No hay autoreply (acuse automático) al usuario; solo se notifica al equipo.
- [ ] No se persiste (guarda) el mensaje (ni BD ni CRM); solo viaja por email.
- [ ] Sigue usándose el sandbox (entorno de pruebas) `onboarding@resend.dev`; no hay dominio propio verificado.

---

## Non-functional requirements

_(Non-functional requirements = requisitos no funcionales: cualidades del sistema —rendimiento, seguridad, etc.—, cada una cuantificada con número, no adjetivos.)_

- **Rendimiento:** el POST a `/api/contact` responde en p95 (percentil 95 — el 95% de las peticiones tardan como mucho eso) ≤ 1500 ms (milisegundos) (dominado por la latencia — retardo — de la API de Resend). El First Load JS (JavaScript inicial que descarga el navegador al abrir la página) de `/acerca` ≤ 175 kB (kilobytes).
- **Seguridad:** `RESEND_API_KEY` (clave secreta) solo server-side (del lado del servidor); 0 apariciones en el bundle (paquete JS) cliente. Ningún dato del error interno de Resend se filtra al cliente (mensajes genéricos, REQ-18).
- **Fiabilidad:** ante fallo de red o 5xx (códigos HTTP 500-599 = errores de servidor), 0 pérdida de datos del formulario (REQ-12); sin doble envío en peticiones concurrentes (simultáneas) (REQ-09).
- **Privacidad:** los datos PII (Personally Identifiable Information — datos personales identificables: nombre/email/mensaje) no se persisten; se transmiten solo a Resend y al buzón destino. Sin logging (registro en los logs) del contenido del mensaje en servidor.
- **Accesibilidad:** íconos SVG (gráficos vectoriales) decorativos con `aria-hidden="true"` (atributo que los oculta a los lectores de pantalla); `<label>` (etiqueta) asociado a cada campo; foco visible (borde al navegar con teclado); estado de error anunciado por texto, no solo color.
- **Fidelidad visual:** reproduce secciones, colores y tipografía del template (plantilla) `about.jsx` (mismo orden y textos).
- **Compatibilidad:** render (dibujado) correcto en Chromium (motor de navegador de Chrome/Edge) ≥ 120; `IntersectionObserver` (API del navegador que detecta cuándo un elemento entra en el área visible) soportado, con fallback (plan B) que muestra el contenido sin animación si no existe.

---

## Decisions

_(Decisions = decisiones, estilo mini-ADR — Architecture Decision Record, registro de decisión de arquitectura. Cada una: Context/Contexto · Decision/Decisión · Consequences/Consecuencias · Rejected/Rechazadas.)_

### D1 — Envío vía Route Handler server-side, no Server Action

- **Status:** Accepted (aceptada)
- **Context:** Next.js 16 ofrece dos vías para lógica de servidor: Route Handler (endpoint HTTP explícito en `app/api/.../route.ts`) o Server Action (función `'use server'` — que corre en servidor — invocada directamente desde el form, sin URL explícita).
- **Decision:** Route Handler `POST /api/contact`.
- **Consequences:** Endpoint (URL del servidor) explícito, probable con `curl` (herramienta de terminal para hacer peticiones HTTP), contrato JSON claro, desacoplado del componente. Algo más de boilerplate (código repetitivo de plomería) que una Server Action.
- **Rejected:** Server Action (menos código pero endpoint implícito, menos testeable — probable — de forma aislada, contrato menos explícito).

### D2 — Remitente en sandbox `onboarding@resend.dev`, from hardcodeado

- **Status:** Accepted (aceptada)
- **Context:** Resend exige `from` (remitente) de dominio verificado o su sandbox (entorno de pruebas). El usuario aún no tiene dominio propio con DNS (Domain Name System — sistema que traduce nombres a direcciones) configurado.
- **Decision:** Usar el sandbox; `from` hardcodeado (incrustado fijo en el código); solo 2 env vars (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`).
- **Consequences:** Funciona sin configurar DNS; **limitación**: el sandbox solo entrega al email dueño de la cuenta Resend (`alberto22295@gmail.com`). Migrar a dominio propio requerirá tocar código.
- **Rejected:** Dominio propio verificado ahora (requiere DKIM — firma que autentica el correo / SPF — registro que autoriza servidores emisores, fuera de MVP — Minimum Viable Product, producto mínimo viable) · 3ª env var `CONTACT_FROM_EMAIL` (config que hoy no se usa).

### D3 — Solo notificar al equipo, sin autoreply

- **Status:** Accepted (aceptada)
- **Context:** El usuario solo necesita recibir los mensajes.
- **Decision:** 1 correo al equipo, con `reply_to` (dirección de respuesta) = email del usuario para responder con 1 clic.
- **Consequences:** Menos llamadas a Resend, menos superficie de fallo. El usuario no recibe acuse automático (autoreply).
- **Rejected:** Notificar + autoreply (2 correos, 2 plantillas; innecesario en MVP — producto mínimo viable).

### D4 — Solo validación de campos; sin honeypot/rate-limit

- **Status:** Accepted (aceptada)
- **Context:** Formulario público → potencial spam, pero es MVP (producto mínimo viable) y bajo tráfico.
- **Decision:** Validar no-vacío + formato email en cliente y servidor.
- **Consequences:** Simple; endpoint queda expuesto a abuso si escala el tráfico.
- **Rejected:** Honeypot (campo trampa oculto anti-bots) + rate limit (límite de peticiones por IP — dirección de red) + CAPTCHA (reto anti-bot) — diferidos a un spec de endurecimiento (hardening — reforzar seguridad) si hace falta.

### D5 — Mensaje efímero, sin persistencia

- **Status:** Accepted (aceptada)
- **Context:** No hay BD (base de datos) ni CRM (Customer Relationship Management — gestor de relación con clientes) en el proyecto.
- **Decision:** El mensaje solo viaja por email; no se guarda.
- **Consequences:** Cero infraestructura de datos; si Resend falla y no hay reintento, el mensaje se pierde (mitigado por mostrar error y conservar datos en el form, REQ-12).
- **Rejected:** Persistir (guardar) en BD/tabla (sobre-ingeniería — complejidad innecesaria — para el objetivo actual).

### D6 — Mantener ruta `/acerca`, solo renombrar el enlace

- **Status:** Accepted (aceptada)
- **Context:** El spec 02 ya creó `/acerca` (placeholder) y el nav apunta ahí; el usuario pidió el enlace "Acerca de nosotros".
- **Decision:** Conservar la ruta `/acerca`; cambiar solo el texto del enlace a "Acerca de nosotros".
- **Consequences:** Sin redirects (redirecciones HTTP — reenvíos automáticos de una URL a otra) ni enlaces rotos; cambio mínimo.
- **Rejected:** Mover a `/sobre-nosotros` (URL más clara pero obliga a redirect y a tocar más sitios).

---

## Risks

_(Risks = riesgos: qué puede fallar y cómo se mitiga.)_

| Risk (riesgo) | Mitigation (mitigación) |
| --- | --- |
| Sandbox (entorno de pruebas) de Resend solo entrega al email dueño de la cuenta; enviar a otro destinatario falla silenciosamente | `CONTACT_TO_EMAIL` = `alberto22295@gmail.com` (el dueño); documentado en D2 y `.env.example`. Verificación incluye envío real recibido. |
| `RESEND_API_KEY` (clave secreta) filtrada al cliente o al repo (repositorio) | Sin prefijo `NEXT_PUBLIC_`, leída solo en Route Handler (REQ-19); `.env.local` gitignored (excluido de Git), `.env.example` sin valores reales (REQ-20). |
| Env var (variable de entorno) ausente en runtime (tiempo de ejecución) → 500 opaco | REQ-17: chequeo explícito + log (registro) server-side + 500 con mensaje genérico (sin filtrar la key). |
| Spam/abuso del endpoint público | Aceptado en MVP (D4); validación de campos como barrera mínima; honeypot/rate-limit diferidos. |
| Doble envío por doble clic | Estado `sending` deshabilita el botón mientras la petición está en vuelo (in flight) (REQ-09). |
| Falla de Resend/red → mensaje perdido | Error legible + datos conservados en el form (REQ-12); sin persistencia (riesgo aceptado, D5). |

---

## Verification

_(Verification = verificación: comprobación ejecutable de extremo a extremo — end-to-end — que produce evidencia real, no una afirmación de éxito.)_

1. **Instalación:** `npm install resend` (instala la librería) → `resend` en `package.json`; `.env.example` con las 2 variables; `.env.local` con valores reales (provistos por el usuario: `RESEND_API_KEY` + `CONTACT_TO_EMAIL=alberto22295@gmail.com`).
2. **Build (compilación):** `npx next build` → exit 0 (sin error); `/acerca` y `/api/contact` listadas; sin errores ni warnings (avisos) de hydration.
3. **Endpoint (curl — herramienta de terminal para peticiones HTTP):**
   - `curl -X POST localhost:3000/api/contact -H 'Content-Type: application/json' -d '{"name":"","email":"x","msg":""}'` → **400** (validación, Resend no invocado).
   - `curl -X GET localhost:3000/api/contact` → **405** (método no permitido).
   - `curl -X POST ... -d '{"name":"Kai","email":"kai@test.com","msg":"Hola"}'` → **200 {ok:true,id}** y correo recibido en `alberto22295@gmail.com` con `reply_to` (dirección de respuesta) = `kai@test.com`.
   - Con `RESEND_API_KEY` borrada → **500** + log (registro) en servidor, sin filtrar la key.
4. **UI (User Interface — interfaz de usuario; `npx next dev` — servidor de desarrollo, visitar `/acerca`):**
   - Orden de secciones (hero, highlights, divider, contacto); reveal (aparición) al hacer scroll.
   - Enviar con campo vacío → shake (sacudida), sin POST.
   - Enviar válido → terminal "VAULT-OS" con el nombre; "ENVIAR OTRO MENSAJE" resetea.
   - Nav muestra "Acerca de nosotros" y queda `active` en `/acerca`.
5. **Seguridad:** buscar `RESEND_API_KEY` en el bundle (paquete JS) cliente (`grep` — comando de búsqueda de texto — sobre `.next/static`) → 0 apariciones.
6. **Evidencia:** salida del build, respuestas curl (códigos HTTP), captura del correo recibido en Gmail, capturas de `/acerca` (form + terminal de éxito).

---

## Traceability matrix

_(Traceability matrix = matriz de trazabilidad: liga cada requisito con su criterio de aceptación, su archivo de implementación y su verificación, para que no haya requisitos huérfanos — sin cubrir — ni código sin requisito.)_

| Req | Acceptance (criterio) | Archivo/paso | Verificación |
| --- | --- | --- | --- |
| REQ-01,04 | About presente + title | `app/acerca/page.tsx`, `About.tsx` (pasos 4-5) | Build + UI |
| REQ-02,03 | literales + reveal | `About.tsx`, `useReveal` (paso 4) | UI scroll |
| REQ-05,06 | enlace + active | `Nav.tsx` (paso 6) | UI nav |
| REQ-07,11 | shake / reset | `About.tsx` (paso 4) | UI form |
| REQ-08,09,10,12 | POST / in-flight / éxito / error | `About.tsx` (paso 4) | UI + curl |
| REQ-13,14 | 405 / 400 | `route.ts` (paso 2) | curl |
| REQ-15,16 | send + 200 | `route.ts` (paso 2) | curl + Gmail |
| REQ-17,18 | 500 env/Resend | `route.ts` (paso 2) | curl sin key |
| REQ-19,20 | key server-only + .env | `route.ts`, `.env.example` (pasos 1-2) | grep bundle |

---

## What is **not** in this spec

_(Qué NO entra en este spec — refuerzo del alcance al final.)_

- Dominio propio verificado en Resend (DKIM — firma que autentica el correo / SPF — autoriza servidores emisores) — sigue el sandbox (entorno de pruebas).
- Autoreply (acuse automático) al usuario; persistencia (guardado) del mensaje (BD/CRM); adjuntos (archivos anexos).
- Anti-abuso avanzado (honeypot — campo trampa, rate limit — límite por IP, CAPTCHA — reto anti-bot).
- i18n (multi-idioma); tests automatizados; cambio de ruta a `/sobre-nosotros`.

Cada uno, si llega, en su propio spec.
