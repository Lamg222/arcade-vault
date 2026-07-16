# 04 — Integración base de Supabase (clientes browser + server)

- **Estado:** Implemented
- **Fecha:** 2026-07-16
- **Dependencias:** 01-mvp-visual-pantallas, 03-about-y-contacto-resend (patrón de env vars vía `.env.local`)
- **Objetivo (una frase):** Instalar Supabase (backend-as-a-service — Postgres gestionado + auth + APIs) y crear los clientes tipados browser y server con `@supabase/ssr` (paquete oficial para Next.js App Router — enrutador de app), dejando la app lista para consumir Supabase en specs futuros.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con el significado normativo estándar.

## Scope

**En scope:**
- Instalar dependencias `@supabase/supabase-js` (SDK — kit de desarrollo base) y `@supabase/ssr` (helper de sesión en cookies para SSR — Server-Side Rendering, render en servidor).
- Variables de entorno públicas: `NEXT_PUBLIC_SUPABASE_URL` (URL del proyecto) y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave publicable, formato `sb_publishable_...` — nombre actual de Supabase para la antigua "anon key"; segura en navegador porque RLS la limita). El usuario provee los valores; van en `.env.local`; plantilla en `.env.example`.
- Cliente **browser** en TypeScript (`createBrowserClient`) para Client Components (componentes que corren en navegador).
- Cliente **server** en TypeScript (`createServerClient`) que lee/escribe cookies de sesión vía `next/headers`, para Server Components (componentes que corren en servidor), Route Handlers (manejadores de ruta API) y Server Actions.

**NO en scope (specs futuros):**
- Flujos de autenticación reales (login/registro/logout) — reemplazo de `AuthContext` falso.
- Tablas de DB (base de datos), esquema, migraciones, RLS (Row Level Security — reglas por fila que deciden quién lee/escribe cada registro), leaderboard persistente.
- `middleware.ts` para refresh de sesión (refresco de token en cada request).
- Migración de `games.ts` / `scores.ts` a DB.
- Realtime (tiempo real por WebSocket) y Edge Functions (funciones serverless en el borde).
- `SERVICE_ROLE_KEY` (clave privada de servidor que salta RLS) — no necesaria aún.

## Data model

**Sin nuevas estructuras de datos persistentes** (las tablas van en un spec posterior). Lo nuevo son módulos de cliente y configuración:

- **`app/lib/supabase/client.ts`** — exporta `createClient(): SupabaseClient` (browser). Sin estado propio; instancia por llamada.
- **`app/lib/supabase/server.ts`** — exporta `async createClient(): Promise<SupabaseClient>` que integra el cookie store (almacén de cookies) de Next.js (`cookies()` de `next/headers`).
- **Tipo compartido:** `SupabaseClient` viene de `@supabase/supabase-js` (los genéricos de esquema DB se añaden cuando existan tablas).
- **Env vars** (ambas públicas, prefijo `NEXT_PUBLIC_` — expuestas al bundle de navegador): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Ubicación `app/lib/supabase/` — consistente con `app/context/`, `app/hooks/`, `app/data/` ya existentes.

## Requirements (EARS + RFC 2119)

- **REQ-01** — The system MUST declarar `@supabase/supabase-js` y `@supabase/ssr` como dependencias en `package.json`.
- **REQ-02** — The system MUST leer `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` desde el entorno (`process.env`).
- **REQ-03** — The browser client module MUST exportar `createClient()` que retorna un `SupabaseClient` configurado con las dos env vars públicas, vía `createBrowserClient` de `@supabase/ssr`.
- **REQ-04** — The server client module MUST exportar `async createClient()` que enlaza el cookie store de Next.js (`cookies()` de `next/headers`) vía `createServerClient`, para persistir sesión en Server Components, Route Handlers y Server Actions.
- **REQ-05** *(unwanted)* — If falta o está vacía cualquiera de las dos env vars al crear un cliente, then the system MUST lanzar un error claro que nombre la variable ausente (fallo ruidoso — no `undefined` silencioso).
- **REQ-06** — The `.env.example` MUST documentar ambas variables públicas como plantilla; los valores reales viven solo en `.env.local` (ignorado por git — no se versiona).
- **REQ-07** *(unwanted)* — If el cliente server intenta escribir cookies durante el render de un Server Component (contexto de solo lectura), then the system MUST envolver `setAll` en `try/catch` y no romper el render (Next.js prohíbe escribir cookies fuera de una Server Action o Route Handler).
- **REQ-08** — The system MUST verificar conectividad real contra el proyecto Supabase mediante una llamada de red que efectivamente golpee el servidor (fetch al health de GoTrue, `${url}/auth/v1/health`), retornando éxito solo si el proyecto responde. `auth.getUser()` sin sesión NO cumple esto: resuelve localmente sin tocar la red.

## Implementation plan

Cada paso deja la app ejecutable y commiteable por sí solo. Antes de escribir código, `spec-impl` DEBE leer los docs de Next.js incluidos (`node_modules/next/dist/docs/01-app/`) — la versión 16.2.9 es más nueva que el training del modelo.

1. **Dependencias + plantilla env.** `npm install @supabase/supabase-js @supabase/ssr`. Añadir a `.env.example` las dos vars públicas con comentario. El usuario rellena `.env.local` con los valores que pasará. → commit.
2. **Cliente browser** `app/lib/supabase/client.ts`: `createClient()` con `createBrowserClient(url, publishableKey)`, validando ambas vars (REQ-05). → commit.
3. **Cliente server** `app/lib/supabase/server.ts`: `async createClient()` con `createServerClient(url, publishableKey, { cookies: { getAll, setAll } })`, `setAll` en `try/catch` (REQ-07), validando vars (REQ-05). → commit.
4. **Verificación de conexión** (REQ-08): Route Handler temporal `app/api/supabase-check/route.ts` que hace fetch al health de GoTrue (`${url}/auth/v1/health`) para probar la red, y reporta la sesión con `auth.getUser()`; retorna `{ ok, reachable, user }`. Probar en navegador/curl. Confirmada la conexión, evaluar borrar el handler (ver D-05). → commit final = acceptance.

## Acceptance criteria

- **AC-01 (happy path, REQ-01/02/03)** — Given `.env.local` con ambas vars válidas, When importo `createClient` del cliente browser en un Client Component, Then obtengo un `SupabaseClient` sin error.
- **AC-02 (server, REQ-04)** — Given una sesión inexistente, When un Server Component llama al `createClient` server y luego `auth.getUser()`, Then retorna `{ data: { user: null }, error: null }` (sin excepción).
- **AC-03 (conexión real, REQ-08)** — Given el proyecto Supabase provisionado, When hago GET a `/api/supabase-check`, Then respuesta `200` con `{ ok: true, reachable: true, user: null }` (el fetch al health de GoTrue confirma URL + proyecto activo + red).
- **AC-04 (edge: var faltante, REQ-05)** — Given `.env.local` sin `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, When creo cualquier cliente, Then lanza error nombrando la variable ausente (no `undefined` silencioso).
- **AC-05 (edge: cookies en render, REQ-07)** — Given un Server Component que renderiza (contexto solo-lectura), When el cliente server intenta `setAll` de cookies, Then no rompe el render (`try/catch` traga el throw de Next.js).
- **AC-06 (edge: URL malformada)** — Given `NEXT_PUBLIC_SUPABASE_URL` con valor inválido, When llamo `/api/supabase-check`, Then el fetch lanza y la respuesta es `{ ok: false, reachable: false, error }`, no crash del servidor.
- **AC-07 (fuera de scope)** — El repo NO contiene tablas, migraciones, RLS, flujos de login ni `middleware.ts`. Checklist booleano: verdadero.
- **AC-08 (build)** — `npm run build` compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

### D-01 · `@supabase/ssr` en vez de solo `@supabase/supabase-js`
- **Contexto:** Next.js App Router necesita sesión en cookies compartida entre servidor y navegador.
- **Decisión:** usar `@supabase/ssr` (maneja cookies).
- **Consecuencias:** dos clientes (browser/server) en vez de uno.
- **Descartado:** cliente único `createClient` de `supabase-js` — no sincroniza sesión en SSR, rompe el auth futuro.

### D-02 · Dos clientes separados (`client.ts` / `server.ts`)
- **Contexto:** browser y server usan APIs de cookies distintas.
- **Decisión:** un módulo por contexto.
- **Consecuencias:** import correcto según el tipo de componente.
- **Descartado:** cliente isomórfico único — mezcla `next/headers` (solo server) en el bundle de navegador → error de build.

### D-03 · Solo env vars públicas, sin `SERVICE_ROLE_KEY`
- **Contexto:** aún no hay escrituras privilegiadas que salten RLS.
- **Decisión:** solo URL + anon key públicas.
- **Consecuencias:** superficie de secreto mínima.
- **Descartado:** incluir la service_role key ya — secreto de alto privilegio sin uso, riesgo innecesario.

### D-04 · Sin `middleware.ts` en este spec
- **Contexto:** el refresh de sesión (refresco de token en cada request) solo importa cuando haya auth real.
- **Decisión:** diferir.
- **Consecuencias:** las sesiones no se auto-refrescan aún — irrelevante sin login.
- **Descartado:** middleware ahora — código muerto sin flujo de auth.

### D-05 · Route de verificación temporal
- **Contexto:** probar la conexión sin UI.
- **Decisión:** `/api/supabase-check` temporal, se evalúa borrarlo tras confirmar.
- **Consecuencias:** un endpoint (punto de acceso HTTP) extra transitorio.
- **Descartado:** test unitario con mock — no prueba la conectividad real contra el proyecto.

### D-06 · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `..._ANON_KEY`
- **Contexto:** Supabase renombró la clave pública: la "anon key" (un JWT — JSON Web Token, formato legacy) pasó a "publishable key" (`sb_publishable_...`). El `.env` real del usuario ya usa el nombre nuevo.
- **Decisión:** estandarizar en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en código, `.env.example` y spec.
- **Consecuencias:** alineado con la credencial real y la convención actual de Supabase.
- **Descartado:** mantener `..._ANON_KEY` — desajusta con el `.env` del usuario y con el naming vigente; el cliente lanzaría "falta la variable".

### D-07 · Verificación de red vía health de GoTrue, no `auth.getUser()`
- **Contexto:** la revisión adversarial (verificada en el fuente de `@supabase/auth-js`) mostró que `auth.getUser()` sin sesión resuelve localmente sin tocar la red → daría falso positivo con URL incorrecta.
- **Decisión:** el route hace `fetch(${url}/auth/v1/health)` (health-check público de GoTrue) como prueba de conectividad real; `getUser()` queda solo como reporte informativo de sesión.
- **Consecuencias:** REQ-08 y AC-06 se cumplen de verdad (URL mala → fetch lanza → `ok:false`).
- **Descartado:** validar la clave contra `/rest/v1/` (PostgREST) — con las publishable keys nuevas devolvía 401/555 de forma frágil; el health es estable y suficiente para "¿el proyecto responde?".

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm install` → `package.json` lista ambos paquetes (REQ-01).
2. `npm run build` → verde, sin errores de tipos/lint (AC-08).
3. `npm run dev` + `curl localhost:3000/api/supabase-check` → `{ ok: true, reachable: true, user: null }` (AC-03, prueba de red real).
4. Borrar temporalmente `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de `.env.local` → recarga → el error nombra la var (AC-04). Restaurar.

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|-----------|------------|-----------------|--------------|
| REQ-01 | AC-08 | `package.json` | `npm install` + build |
| REQ-02 | AC-01 | `process.env` | build + AC-01 |
| REQ-03 | AC-01 | `app/lib/supabase/client.ts` | import en Client Component |
| REQ-04 | AC-02 | `app/lib/supabase/server.ts` | `auth.getUser()` en Server Component |
| REQ-05 | AC-04 | validación en ambos clientes | quitar var → error |
| REQ-06 | AC-01 | `.env.example` / `.env.local` | inspección |
| REQ-07 | AC-05 | `setAll` en `try/catch` (server.ts) | render de Server Component |
| REQ-08 | AC-03 | `app/api/supabase-check/route.ts` | `curl` al endpoint |

## Qué NO está en este spec

Tablas, esquema, migraciones, RLS (Row Level Security), leaderboard persistente, flujos de login/registro/logout, reemplazo de `AuthContext` falso, `middleware.ts`, migración de `games.ts` / `scores.ts`, Realtime, Edge Functions, `SERVICE_ROLE_KEY`.
