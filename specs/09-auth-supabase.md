# 09 — Autenticación real con Supabase Auth (registro, login, perfil)

- **Estado:** Approved
- **Fecha:** 2026-08-25
- **Dependencias:** 04-integracion-supabase (clientes browser/server), 06-leaderboard-supabase (`scores.user_id` nullable, guardado de scores), 01-mvp-visual-pantallas (UI de `Auth.tsx`)
- **Objetivo (una frase):** Reemplazar el `AuthContext` falso por autenticación real con Supabase Auth — registro con email + contraseña + confirmación de correo, login (incluido OAuth Google/GitHub), logout, recuperación de contraseña y username en `user_metadata` — manteniendo el modo invitado intacto y enriqueciendo los scores con `user_id` y el username del perfil.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.
> Perfil de compliance: **pii** (información personal identificable) lean — el email del usuario vive solo en `auth.users` (tabla interna gestionada por Supabase); a leaderboards solo llega el username. Sin módulo GDPR formal; registrado en decisiones.

## Scope

**En scope:**
- Reemplazo del `AuthContext` falso por sesión real de Supabase Auth: estado de usuario desde la sesión en **cookies** (pequeños datos que el navegador reenvía al servidor en cada petición — ahí viaja el token de sesión) gestionadas por `@supabase/ssr`.
- **Registro** con email + contraseña + username (≤ 10 caracteres, guardado en **`user_metadata`** — campo JSON de datos libres por usuario dentro de `auth.users`, la tabla interna de usuarios de Supabase) y **confirmación de correo** obligatoria: sin clic en el enlace no hay sesión. Correo por el **SMTP** (protocolo estándar de envío de email) incluido de Supabase.
- **Login OAuth** (protocolo para "entrar con" una cuenta de un tercero sin darle tu contraseña a la app) con **Google** y **GitHub**, con flujo **PKCE** (Proof Key for Code Exchange — variante segura de OAuth donde el enlace de retorno trae un código de un solo uso que la app canjea por sesión). Requiere configuración manual del usuario: crear credenciales en Google Cloud Console y una OAuth App en GitHub, y pegarlas en el dashboard de Supabase — pasos documentados en el plan.
- En primer login OAuth sin username: derivarlo de los datos que entrega el proveedor (nombre de usuario de GitHub / nombre de Google), normalizado a ≤ 10 caracteres en mayúsculas, y guardarlo en `user_metadata.username`.
- **Login** email + contraseña y **logout** reales en `Auth.tsx` y `Nav.tsx`.
- **Recuperación de contraseña:** pantalla "olvidé mi contraseña" (pide email, envía enlace) + pantalla de nueva contraseña al volver. Solo aplica a cuentas email+contraseña (las de OAuth no tienen contraseña en la app).
- Ruta de **callback** (URL a la que Supabase redirige tras el clic en enlace de confirmación/reseteo o tras el consentimiento OAuth; ahí la app canjea el código por sesión válida).
- **`middleware.ts`** (interceptor que corre en cada petición HTTP) para refrescar el token de sesión — deuda de spec 04.
- Enriquecimiento del guardado de scores: con sesión activa, `saveScore` llena `scores.user_id` y usa `user_metadata.username` automáticamente (caja de nombre oculta).
- Modo invitado intacto: jugar y guardar score con iniciales libres sigue funcionando sin cuenta.

**NO en scope (specs futuros):**
- Tabla `profiles` y unicidad de username — `user_metadata` no permite restricción UNIQUE (regla de base de datos que rechaza duplicados); usernames pueden repetirse, igual que hoy los de invitados.
- **Magic link** (acceso por enlace de un solo uso, sin contraseña).
- Resend como SMTP custom de Supabase — requiere dominio verificado; mejora futura.
- Página de perfil editable (cambiar username/avatar), borrado de cuenta, migración de scores de invitado a cuenta, vincular varias identidades (OAuth + contraseña) en una cuenta.
- Rutas protegidas que exijan sesión — todo sigue accesible como invitado.
- Rate-limiting (límite de intentos por tiempo) propio — se usa el de fábrica de Supabase.

## Data model

**Sin tablas ni migraciones nuevas** — `scores.user_id` (FK — Foreign Key, clave foránea que enlaza cada score con un usuario) ya existe desde spec 06. Lo nuevo son datos gestionados por Supabase Auth y módulos de código:

**`auth.users`** (tabla interna que Supabase Auth administra solo — la app nunca la escribe directamente):
- `id uuid` (Universally Unique Identifier — cadena aleatoria larga que evita choques), `email`, `encrypted_password` (la contraseña **hasheada** — cifrada de forma irreversible), `email_confirmed_at` (fecha del clic de confirmación; `NULL` = sin confirmar).
- **`raw_user_meta_data` (`user_metadata`)** — campo **JSON** (formato de texto para datos estructurados) de datos libres por usuario. Aquí vive **`username`** (`text`, ≤ 10 caracteres, mayúsculas). Se escribe: en registro (formulario), o en primer login OAuth (derivado del proveedor). Sin restricción UNIQUE — puede repetirse, aceptado en D-02.
- `identities` — vinculación por proveedor (email, Google, GitHub) que Supabase mantiene solo.

**Clasificación de datos (perfil `pii` lean):** `email` = PII (información personal identificable) — vive solo en `auth.users`, nunca se copia a tablas propias ni a leaderboards. `username` = seudónimo público (aparece en leaderboards). Contraseña = solo hasheada, jamás en logs ni en tablas propias.

**Sesión:** viaja en cookies `sb-*`, gestionadas por `@supabase/ssr`; contienen el **JWT** (JSON Web Token — credencial firmada digitalmente que prueba quién eres sin consultar la base de datos en cada petición) de acceso + token de refresco. Nada de sesión en `localStorage` (almacén del navegador) — las cookies permiten que el servidor también vea la sesión.

**Módulos nuevos / cambiados:**
- `app/lib/auth/actions.ts` — Server Actions (funciones que corren en el servidor invocadas desde el navegador): `signUp`, `signIn`, `signOutAction`, `requestPasswordReset`, `updatePassword`.
- `app/auth/callback/route.ts` — Route Handler (endpoint HTTP manual) que canjea el código del enlace (confirmación, reseteo, OAuth) por sesión.
- `app/recuperar/page.tsx` (pedir email) y `app/restablecer/page.tsx` (nueva contraseña).
- `middleware.ts` (raíz) — interceptor por petición que refresca el token de sesión.
- `app/context/AuthContext.tsx` — reescrito: el estado sale de la sesión real de Supabase (escucha `onAuthStateChange` — evento que avisa cuando la sesión cambia).
- Cambian: `Auth.tsx` (formularios reales + botones OAuth activos), `Nav.tsx` (logout real), `Player.tsx` + `app/lib/scores.ts` (`saveScore` con `user_id` + username del perfil).

**`localStorage`:** `av_player_name` sigue solo para invitados; con sesión no se usa.

**Env vars:** sin variables nuevas (las dos públicas de spec 04 bastan). Configuración manual en dashboards: credenciales OAuth de Google/GitHub pegadas en Supabase, y "Redirect URLs" (lista blanca de URLs a las que Supabase acepta redirigir tras el callback) con `http://localhost:3000/auth/callback`.

## Requirements (EARS + RFC 2119)

**Registro y confirmación:**
- **REQ-01** — When el usuario envía el formulario "CREAR CUENTA" con email, contraseña y username válidos, the system MUST llamar `signUp` de Supabase Auth guardando `username` (mayúsculas, ≤ 10) en `user_metadata` y MUST mostrar aviso "revisa tu correo para confirmar".
- **REQ-02** — The registro MUST exigir confirmación de correo: sin clic en el enlace, no hay sesión iniciada.
- **REQ-03** *(unwanted)* — If el username está vacío, es > 10 caracteres, o la contraseña tiene < 8 caracteres, then the formulario MUST bloquear el envío y mostrar el error concreto, sin llamar a Supabase.
- **REQ-04** *(unwanted)* — If `signUp` falla (email ya registrado, email inválido, error de red), then the UI MUST mostrar el error legible y MUST NOT fingir éxito.

**Login / logout:**
- **REQ-05** — When el usuario envía "INICIAR SESIÓN" con credenciales correctas y email confirmado, the system MUST iniciar sesión (cookies `sb-*` vía `@supabase/ssr`) y redirigir a `/biblioteca`.
- **REQ-06** *(unwanted)* — If las credenciales son incorrectas o el email no está confirmado, then the UI MUST mostrar el error específico ("credenciales inválidas" / "confirma tu correo") y MUST NOT iniciar sesión.
- **REQ-07** — When el usuario pulsa cerrar sesión en `Nav`, the system MUST llamar `signOut` real (invalida cookies de sesión) y volver al estado invitado sin recargar rota la página.

**OAuth:**
- **REQ-08** — When el usuario pulsa GOOGLE o GITHUB, the system MUST iniciar el flujo OAuth con PKCE vía `signInWithOAuth`, con `redirectTo` al callback propio.
- **REQ-09** — When un usuario OAuth inicia sesión sin `username` en `user_metadata`, the system MUST derivarlo del proveedor (login de GitHub / nombre de Google), normalizarlo (mayúsculas, ≤ 10) y persistirlo en `user_metadata` vía `updateUser`.
- **REQ-10** *(unwanted)* — If el proveedor OAuth devuelve error o el usuario cancela el consentimiento, then the callback MUST redirigir a la pantalla de acceso con mensaje de error, sin sesión ni crash.

**Callback y middleware:**
- **REQ-11** — The `app/auth/callback/route.ts` MUST canjear el código (`exchangeCodeForSession`) de enlaces de confirmación, reseteo y OAuth, y redirigir según origen (confirmación/OAuth → `/biblioteca`; reseteo → `/restablecer`).
- **REQ-12** *(unwanted)* — If el código es inválido o expiró, then the callback MUST redirigir a la pantalla de acceso con error legible, nunca página en blanco.
- **REQ-13** — The `middleware.ts` MUST refrescar el token de sesión en cada request navegable, excluyendo assets estáticos (imágenes, JS de juegos) por `matcher`.

**Recuperación de contraseña:**
- **REQ-14** — When el usuario pide reseteo en `/recuperar` con su email, the system MUST enviar el enlace vía `resetPasswordForEmail` y mostrar siempre el mismo aviso neutro "si existe la cuenta, llegará un correo" (no revela si el email está registrado — evita **enumeración de cuentas**, sondeo de qué emails tienen cuenta).
- **REQ-15** — When el usuario llega a `/restablecer` con sesión de reseteo válida y envía nueva contraseña (≥ 8), the system MUST actualizarla (`updateUser`) y dejarlo con sesión iniciada.
- **REQ-16** *(unwanted)* — If el enlace de reseteo expiró o `/restablecer` se abre sin sesión de reseteo, then the UI MUST explicar y ofrecer pedir enlace nuevo.

**Estado global y scores:**
- **REQ-17** — The `AuthContext` MUST exponer el usuario real de la sesión Supabase (con `username` y `user_id`) y reaccionar a `onAuthStateChange`, reemplazando el estado falso en memoria.
- **REQ-18** — While hay sesión activa, when se guarda un score, `saveScore` MUST insertar `user_id` del usuario y `player_name` = `user_metadata.username`, y el modal MUST ocultar la caja de nombre.
- **REQ-19** — While NO hay sesión (invitado), the flujo actual MUST permanecer intacto: caja de nombre libre + `localStorage`, `user_id` en `NULL`.
- **REQ-20** — The leaderboards MUST NOT exponer el email en ninguna vista ni respuesta — solo `player_name`.

## Implementation plan

Cada paso deja la app ejecutable y commiteable. Antes de escribir código, `spec-impl` DEBE leer los docs incluidos de Next.js (`node_modules/next/dist/docs/01-app/`, en especial middleware, Route Handlers y Server Actions — la versión 16.2.9 es más nueva que el training del modelo) y la guía oficial de `@supabase/ssr` para App Router. `main` protegida: rama propia + PR con `gh`.

1. **Configuración manual (usuario, sin código).** En el dashboard de Supabase: (a) Auth → activar "Confirm email"; (b) Auth → URL Configuration → añadir `http://localhost:3000/auth/callback` a Redirect URLs; (c) crear credenciales OAuth — en Google Cloud Console un "OAuth Client ID" web y en GitHub una "OAuth App" — pegando en cada uno el callback de Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`), y las claves resultantes (client id + secret) en Supabase → Auth → Providers. Checklist en el PR. → sin commit de código.
2. **Middleware + refresco de sesión.** `middleware.ts` en la raíz con `createServerClient` sobre `NextRequest`/`NextResponse`, refrescando el token; `matcher` que excluye `_next/static`, `_next/image`, `favicon` y `games/` (REQ-13). App sigue funcionando idéntica para invitados. → commit.
3. **Callback + Server Actions.** `app/auth/callback/route.ts` con `exchangeCodeForSession` y redirección por parámetro `next` (REQ-11/12). `app/lib/auth/actions.ts`: `signUp` (con `username` en `user_metadata`, validación REQ-03), `signIn`, `signOutAction`, `requestPasswordReset` (aviso neutro REQ-14), `updatePassword` (REQ-15). Errores devueltos como valores, nunca excepciones sin capturar (REQ-04/06). → commit.
4. **AuthContext real.** Reescribir `app/context/AuthContext.tsx`: usuario inicial desde el servidor (prop desde `layout.tsx` con el cliente server) + suscripción a `onAuthStateChange` en el navegador; expone `{ user: { id, username }, signOut }` (REQ-17). `Nav.tsx` usa logout real (REQ-07). Login/registro aún no conectados — app compila y corre. → commit.
5. **Pantalla de acceso real.** `Auth.tsx`: pestaña CREAR CUENTA llama `signUp` y muestra "revisa tu correo" (REQ-01/02); INICIAR SESIÓN llama `signIn` con manejo de error específico (REQ-05/06); botones GOOGLE/GITHUB activos con `signInWithOAuth` + PKCE (REQ-08); derivación de username en primer login OAuth vía callback/`updateUser` (REQ-09/10); enlace "¿Olvidaste tu contraseña?" → `/recuperar`. → commit.
6. **Recuperación de contraseña.** `app/recuperar/page.tsx` (email → `requestPasswordReset`) y `app/restablecer/page.tsx` (nueva contraseña ≥ 8 → `updatePassword`; estado sin-sesión-de-reseteo con aviso y reintento) (REQ-14/15/16). → commit.
7. **Scores enriquecidos.** `app/lib/scores.ts` / `saveScore`: si hay sesión, insertar `user_id` + `player_name` desde `user_metadata.username`; `Player.tsx` oculta caja de nombre con sesión y conserva flujo invitado + `localStorage` sin cambios (REQ-18/19). Verificar que ninguna vista expone email (REQ-20). → commit final = acceptance.

## Acceptance criteria

- **AC-01 (registro happy path, REQ-01/02)** — Given el formulario CREAR CUENTA con email real, contraseña ≥ 8 y username ≤ 10, When envío, Then veo "revisa tu correo", llega el email de confirmación, y sin hacer clic el login es rechazado con "confirma tu correo".
- **AC-02 (confirmación, REQ-02/11)** — Given el email de confirmación, When hago clic en el enlace, Then paso por `/auth/callback`, quedo con sesión iniciada y aterrizo en `/biblioteca` con mi username visible en `Nav`.
- **AC-03 (login/logout, REQ-05/07)** — Given cuenta confirmada, When inicio sesión con credenciales correctas, Then entro a `/biblioteca`; When pulso cerrar sesión, Then vuelvo a estado invitado y las cookies `sb-*` quedan invalidadas.
- **AC-04 (OAuth, REQ-08/09)** — Given proveedores configurados, When entro con GOOGLE o GITHUB y consiento, Then vuelvo con sesión activa y `user_metadata.username` poblado (derivado del proveedor, ≤ 10, mayúsculas), visible en `Nav` y usado por scores.
- **AC-05 (score con sesión, REQ-18)** — Given sesión activa, When termino partida y guardo, Then la fila en `scores` lleva mi `user_id` y `player_name` = username del perfil, y el modal NO mostró caja de nombre.
- **AC-06 (invitado intacto, REQ-19)** — Given sin sesión, When juego y guardo score, Then el flujo actual funciona igual: caja de nombre libre, `localStorage` recuerda el nombre, `user_id` queda `NULL`.
- **AC-07 (reseteo, REQ-14/15)** — Given cuenta existente, When pido reseteo en `/recuperar` y sigo el enlace, Then `/restablecer` acepta contraseña nueva ≥ 8 y quedo con sesión; el login posterior con la contraseña nueva funciona y con la vieja falla.
- **AC-08 (edge: credenciales malas, REQ-06)** — Given cuenta confirmada, When intento login con contraseña incorrecta, Then veo "credenciales inválidas", sin sesión, sin crash.
- **AC-09 (edge: validación local, REQ-03)** — Given username de 11+ caracteres o contraseña de 7, When intento registrarme, Then el formulario bloquea con el error concreto y NO se llamó a Supabase (verificable en la pestaña Network del navegador).
- **AC-10 (edge: email duplicado, REQ-04)** — Given un email ya registrado, When intento registrarlo de nuevo, Then veo error legible, sin fila nueva ni falso éxito.
- **AC-11 (edge: enlace expirado / código inválido, REQ-12/16)** — Given un enlace de confirmación o reseteo caducado, When lo abro, Then aterrizo en pantalla con error explicado y opción de pedir enlace nuevo — nunca página en blanco.
- **AC-12 (edge: OAuth cancelado, REQ-10)** — Given el consentimiento de Google/GitHub abierto, When cancelo, Then vuelvo a la pantalla de acceso con aviso de error, sin sesión.
- **AC-13 (privacidad, REQ-20)** — Given scores de usuarios con cuenta, When inspecciono `/salon`, `/juego/[id]` y sus respuestas HTML, Then no aparece ningún email — solo usernames.
- **AC-14 (fuera de scope)** — El repo NO contiene tabla `profiles`, magic link, SMTP custom de Resend, página de perfil editable ni rutas que exijan sesión. Checklist booleano: verdadero.
- **AC-15 (build)** — `npm run build` compila sin errores de tipos ni lint.

## Non-functional requirements

- **NFR-01 (latencia de middleware).** El `middleware.ts` MUST añadir ≤ 50 ms p95 (percentil 95: el 95% de las peticiones tardan eso o menos) cuando la sesión NO necesita refresco (caso común: el token de acceso sigue vigente ~1 hora), y MUST NOT ejecutarse en assets estáticos ni en `public/games/` (vía `matcher`) — los juegos no pagan este peaje.
- **NFR-02 (seguridad de credenciales).** La contraseña MUST viajar solo por HTTPS hacia Supabase y MUST NOT aparecer en logs, URLs ni estado de React persistido. Mínimo 8 caracteres impuesto en formulario Y en configuración de Supabase (política del servidor, no solo de la app).
- **NFR-03 (sesión).** Las cookies de sesión `sb-*` MUST ser `HttpOnly` donde `@supabase/ssr` lo aplica (cookie que el JavaScript de la página no puede leer — mitiga robo por XSS, inyección de scripts maliciosos) y la sesión MUST sobrevivir recarga de página y reinicio del navegador.
- **NFR-04 (anti-enumeración).** El flujo de reseteo MUST responder idéntico (mismo mensaje, tiempo similar) exista o no la cuenta — impide a un atacante descubrir qué emails están registrados.
- **NFR-05 (disponibilidad del modo invitado).** Con Supabase Auth caído o mal configurado, jugar como invitado y guardar scores anónimos MUST seguir funcionando — la autenticación degrada, nunca bloquea el producto.
- **NFR-06 (límite SMTP, restricción aceptada).** El SMTP incluido de Supabase tolera ~2-4 correos/hora; suficiente para desarrollo, documentado como techo conocido hasta migrar a Resend con dominio verificado.

## Decisiones tomadas y descartadas

### D-01 · Supabase Auth como proveedor de identidad
- **Contexto:** ya existe proyecto Supabase con clientes browser/server (spec 04) y `scores.user_id` apuntando a `auth.users` (spec 06).
- **Decisión:** usar Supabase Auth (servicio de identidad incluido: guarda usuarios, hashea contraseñas y emite sesión en cookies).
- **Consecuencias:** cero infraestructura nueva; login, OAuth y reseteo son llamadas al SDK ya instalado.
- **Descartado:** NextAuth/Auth.js — segunda pila de identidad paralela a la ya pagada; hacerlo a mano — riesgo de seguridad injustificable.

### D-02 · `user_metadata` en vez de tabla `profiles`
- **Contexto:** el username debe vivir en algún lado; se propuso tabla `profiles` con UNIQUE.
- **Decisión (usuario):** guardar `username` en `user_metadata` (campo JSON de datos libres por usuario dentro de `auth.users`).
- **Consecuencias:** spec sin migración SQL ni trigger; menos piezas. A cambio, sin unicidad: dos cuentas pueden compartir username — aceptable porque los invitados ya repiten iniciales libremente en el leaderboard.
- **Descartado:** tabla `profiles` — unicidad y consultas por username quedan para un spec futuro (página de perfil) si hace falta.

### D-03 · Confirmación de correo activada
- **Contexto:** fricción vs. calidad de datos.
- **Decisión:** exigir clic de confirmación antes de la primera sesión.
- **Consecuencias:** emails verificados (imprescindible para que el reseteo de contraseña llegue a su dueño real); un paso extra al registrarse.
- **Descartado:** entrada directa sin confirmar — un typo en el email crearía cuentas irrecuperables.

### D-04 · OAuth Google + GitHub dentro del spec
- **Contexto:** los botones ya existían decorativos; primer bloque de preguntas los dejaba fuera, el usuario revirtió.
- **Decisión:** activarlos de verdad con PKCE (variante de OAuth donde el retorno trae un código de un solo uso que solo la app puede canjear — evita robo de sesión en el redirect).
- **Consecuencias:** configuración manual en Google Cloud Console y GitHub (paso 1 del plan); login de un clic para quien ya tiene esas cuentas.
- **Descartado:** diferirlos con "PRÓXIMAMENTE" — decisión inicial, revertida por el usuario en fase de scope.

### D-05 · Invitado intacto; el login solo enriquece
- **Contexto:** D-05 de spec 06 estableció no bloquear a nadie para jugar.
- **Decisión:** ninguna ruta exige sesión; con sesión, el score gana `user_id` y username fijo del perfil (caja oculta).
- **Consecuencias:** cero fricción para jugar; identidad consistente en leaderboards para usuarios con cuenta.
- **Descartado:** exigir login para guardar score — mataría el flujo actual de arcade.

### D-06 · SMTP default de Supabase; Resend diferido
- **Contexto:** Resend está en sandbox (solo envía al dueño de la cuenta) y conectarlo como SMTP de Supabase exige dominio verificado con DNS propio — no existe.
- **Decisión:** correos de confirmación/reseteo por el SMTP incluido de Supabase (~2-4/hora).
- **Consecuencias:** cero configuración; techo de volumen conocido (NFR-06).
- **Descartado:** Resend custom ahora — bloqueado por dominio; anotado como mejora futura.

### D-07 · Perfil compliance `pii` lean
- **Contexto:** email = PII; audiencia principal no-UE.
- **Decisión:** perfil lean como spec 06 — email confinado a `auth.users`, nunca en leaderboards (REQ-20); sin módulo GDPR formal.
- **Consecuencias:** spec liviano; si el producto apunta a UE en serio, se abre spec de privacidad (derechos de borrado/exportación).
- **Descartado:** módulo GDPR completo — sobreingeniería hoy.

## Risks

| Riesgo | Mitigación |
|---|---|
| Límite SMTP (~2-4 correos/hora) frena pruebas de registro | Usar pocos registros por hora en dev; techo documentado (NFR-06); salida real: Resend + dominio verificado (futuro) |
| Config OAuth manual mal hecha (URLs de callback equivocadas) | Paso 1 del plan con checklist explícito; AC-04 no pasa hasta que funcione |
| Username duplicado (sin UNIQUE en `user_metadata`) | Aceptado en D-02; leaderboard ya convive con nombres repetidos de invitados |
| `middleware.ts` mal acotado ralentiza juegos/assets | `matcher` excluye estáticos y `games/` (REQ-13, NFR-01) |
| Supabase Auth caído bloquea el producto | Modo invitado no depende de auth (NFR-05) |
| Enlace de confirmación abierto en otro navegador/dispositivo (código PKCE no canjeable ahí) | Callback degrada con error legible + reenvío (REQ-12); anotado para QA |

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm run build` → verde (AC-15).
2. Registro con email propio → llega correo → login antes de confirmar falla con mensaje → clic en enlace → sesión activa, username en `Nav` (AC-01/02).
3. Jugar asteroides con sesión → guardar → fila en `scores` con `user_id` y username del perfil, sin caja de nombre (dashboard de Supabase como evidencia) (AC-05).
4. Logout → jugar como invitado → guardar con iniciales → `user_id` NULL, `localStorage` funciona (AC-03/06).
5. Login con GOOGLE y con GITHUB → sesión + username derivado (AC-04); cancelar consentimiento → error legible (AC-12).
6. `/recuperar` → correo → `/restablecer` → contraseña nueva entra, vieja falla (AC-07).
7. Forzar errores: contraseña mala, email duplicado, username de 11, enlace expirado (AC-08/09/10/11).
8. Ver fuente HTML de `/salon` → cero emails (AC-13).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01/02 | AC-01/02 | `signUp` + dashboard "Confirm email" | registro real |
| REQ-03/04 | AC-09/10 | validación en `actions.ts` + `Auth.tsx` | envíos inválidos |
| REQ-05/06 | AC-03/08 | `signIn` | login bueno/malo |
| REQ-07 | AC-03 | `signOutAction` + `Nav.tsx` | logout |
| REQ-08/09/10 | AC-04/12 | `signInWithOAuth` + callback | login Google/GitHub |
| REQ-11/12 | AC-02/11 | `app/auth/callback/route.ts` | enlaces válidos/expirados |
| REQ-13 | NFR-01 | `middleware.ts` + `matcher` | inspección + juegos fluidos |
| REQ-14/15/16 | AC-07/11 | `/recuperar`, `/restablecer` | flujo reseteo |
| REQ-17 | AC-02/03 | `AuthContext.tsx` real | sesión sobrevive recarga |
| REQ-18 | AC-05 | `saveScore` + `Player.tsx` | fila con `user_id` |
| REQ-19 | AC-06 | flujo invitado sin cambios | guardar anónimo |
| REQ-20 | AC-13 | vistas leaderboard | fuente HTML |

## Qué NO está en este spec

Tabla `profiles` / unicidad de username, magic link, Resend como SMTP custom (requiere dominio verificado), página de perfil editable, borrado de cuenta, migración de scores invitado→cuenta, vinculación de identidades múltiples, rutas protegidas, rate-limiting propio.
