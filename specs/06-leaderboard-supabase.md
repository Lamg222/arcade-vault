# 06 — Leaderboard con Supabase y tabla de juegos

- **Estado:** Approved
- **Fecha:** 2026-07-20
- **Dependencias:** 04-integracion-supabase (clientes browser/server), 01-mvp-visual-pantallas (componentes/rutas), 05-juego-asteroides (scores reales del juego)
- **Objetivo (una frase):** Persistir puntuaciones en Supabase con una tabla `scores` (con FK —Foreign Key, clave foránea— a una tabla `games` sembrada desde el catálogo) y mostrar dos vistas reales de leaderboard, global (Salón de la Fama, `/salon`) y por juego (`/juego/[id]`), reemplazando los datos mock, más el guardado real de la puntuación al terminar la partida.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.
> Perfil de compliance: **pii** (información personal identificable) — `player_name` es dato personal ligero (iniciales ≤ 10, sin email). Se mantiene lean: sin módulo formal, solo se registra en decisiones.

## Scope

**En scope:**
- Migración SQL (Structured Query Language — lenguaje para crear/consultar tablas) versionada en `supabase/migrations/`: tablas `games` y `scores`, sus RLS (Row Level Security — reglas por fila que deciden quién lee/escribe) y políticas e índices.
- `games` sembrada con todo el catálogo actual (derivada de `games.ts`, que sigue siendo la fuente de autoría), solo lectura.
- `scores`: FK `game_id → games.id`, validaciones, `user_id` nullable, `created_at`. Sin sembrado de scores (nada ficticio).
- Vista global (`HallOfFame`, `/salon`) y por juego (`Leaderboard`, `/juego/[id]`) leen scores reales; vacío → mensaje "Sé el primero en entrar al Salón de la Fama".
- Guardado real: Server Action (función servidor invocada desde el navegador) inserta el score; nombre desde la caja de texto, recordado en `localStorage` (almacén del navegador) y pre-rellenado la próxima vez.
- Etiqueta "PRÓXIMAMENTE" en los juegos no jugables (sin `embed`) del catálogo.
- Lecturas vía Server Components (renderizados en el servidor).

**NO en scope (specs futuros):**
- Reconectar el catálogo (Library/Home/GameCard) a la base de datos — sigue leyendo `games.ts` (híbrido diferido; DB-only más adelante).
- Autenticación real / `user_id` obligatorio (el login sigue mock).
- Escritura/edición de `games` desde la app.
- Realtime (actualización en vivo por WebSocket), paginación, antitrampas, rate-limiting (límite de peticiones por tiempo).

## Data model

**Tabla `games`** (PK — Primary Key, clave primaria: identificador único de cada fila):
- `id text PK` — el slug (identificador legible, p.ej. `asteroides`)
- `title text` · `cat text` · `cover text` · `color text` · `embed text NULL`
- `created_at timestamptz default now()` (marca de tiempo con zona horaria)
- Sembrada con los 8 juegos del catálogo actual.

**Tabla `scores`:**
- `id uuid PK default gen_random_uuid()` (uuid — Universally Unique Identifier, cadena aleatoria larga que evita choques aunque se inserten dos scores a la vez)
- `game_id text NOT NULL`, FK → `games.id` (integridad referencial: la base de datos rechaza un score de un juego inexistente)
- `player_name text NOT NULL CHECK (length ≤ 10)` (CHECK — restricción validada por la base de datos en cada inserción)
- `score int NOT NULL CHECK (score ≥ 0)`
- `user_id uuid NULL`, FK → `auth.users.id` (opcional; preparado para auth futura)
- `created_at timestamptz default now()`
- Índice `(game_id, score desc)` para acelerar el top por juego (un índice = estructura que agiliza búsquedas, como el índice de un libro).
- Sin filas sembradas.

**RLS:**
- `games`: SELECT público; sin INSERT/UPDATE/DELETE para la clave anónima.
- `scores`: SELECT público; INSERT público que cumpla los CHECK; sin UPDATE/DELETE.

**localStorage:** clave `av_player_name` — el nombre del jugador, guardado en el navegador para pre-rellenarlo.

## Requirements (EARS + RFC 2119)

- **REQ-01** — The migration MUST crear `games` y `scores` con las columnas, tipos y restricciones del data model, incluida la FK `scores.game_id → games.id`.
- **REQ-02** — The `games` MUST sembrarse con todo el catálogo (`games.ts`) y ser solo lectura para la clave anónima (SELECT público; sin escritura).
- **REQ-03** — The `scores` MUST aplicar CHECK de `player_name` ≤ 10 caracteres y `score` ≥ 0, con `user_id` nullable y `created_at` fijado por el servidor.
- **REQ-04** — The `scores` RLS MUST permitir SELECT e INSERT válido públicos, y MUST NOT permitir UPDATE ni DELETE a la clave anónima.
- **REQ-05** *(unwanted)* — If un leaderboard tiene 0 filas, then MUST mostrar el mensaje de vacío "Sé el primero en entrar al Salón de la Fama" y MUST NOT mostrar scores ficticios.
- **REQ-06** — The vista global (`HallOfFame`, `/salon`) MUST leer el top real de todos los juegos desde la base de datos (orden por `score` descendente) vía Server Component.
- **REQ-07** — The vista por juego (`Leaderboard`, `/juego/[id]`) MUST leer el top real de ese `game_id` desde la base de datos.
- **REQ-08** — When el usuario pulsa "GUARDAR PUNTUACIÓN", a Server Action MUST insertar `(game_id, player_name, score)` en `scores` y la UI MUST reflejar el éxito.
- **REQ-09** *(unwanted)* — If la inserción viola validación o FK (nombre > 10, score < 0, `game_id` inexistente), then la Server Action MUST devolver error y la UI MUST mostrarlo, sin fingir éxito.
- **REQ-10** *(unwanted)* — If la lectura de la base de datos falla (red/config), then el leaderboard MUST renderizar un estado vacío/de error, sin romper la página.
- **REQ-11** — When se guarda un score, the Player MUST persistir `player_name` en `localStorage`; y al abrir el modal de fin, MUST pre-rellenar el nombre desde `localStorage` si existe.
- **REQ-12** — Where un juego no es jugable (sin `embed`), the catálogo MUST mostrar una etiqueta "PRÓXIMAMENTE".
- **REQ-13** — The catálogo (Library/Home/GameCard) MUST seguir leyendo `games.ts` (no reconectado a la base de datos en este spec).
- **REQ-14** — The `games.ts` MUST permanecer como fuente de autoría; la tabla `games` es copia derivada por siembra.

## Implementation plan

Cada paso deja la app ejecutable y commiteable. Antes de escribir código, `spec-impl` DEBE leer los docs de Next.js incluidos (`node_modules/next/dist/docs/01-app/`, en especial Server Actions y data fetching). Node ≥20 vía nvm (default 22). Requiere `.env.local` con las claves Supabase de spec 04.

1. **Migración + siembra de `games`.** `supabase/migrations/0001_leaderboard.sql`: crea `games` y `scores`, índices, habilita RLS y crea las políticas; siembra `games` con los 8 juegos (sin sembrar `scores`). El usuario la aplica (Supabase CLI —herramienta de terminal— o pegándola en el SQL Editor del dashboard). → commit.
2. **Capa de acceso a datos.** `app/lib/scores.ts`: funciones de servidor `getGlobalTop(limit)`, `getGameTop(gameId, limit)` (lecturas con el cliente `server.ts`) y `saveScore(...)` como Server Action (`"use server"`) con validación y manejo de error (REQ-09). → commit.
3. **Conectar lecturas.** `HallOfFame` (global) y `Leaderboard` (por juego) pasan a Server Components asíncronos que leen de la base de datos; mensaje de vacío (REQ-05) y estado de error (REQ-10); las páginas `/salon` y `/juego/[id]` dejan de pasar `seed` mock. → commit.
4. **Guardado + localStorage + badge.** El Player pre-rellena el nombre desde `localStorage`, llama `saveScore` al pulsar "GUARDAR PUNTUACIÓN", persiste el nombre y muestra éxito/error; etiqueta "PRÓXIMAMENTE" en `GameCard` para juegos sin `embed`. → commit final = acceptance.

## Acceptance criteria

- **AC-01 (migración, REQ-01/02/03/04)** — Given la migración aplicada, When inspecciono la base de datos, Then existen `games` (8 filas sembradas) y `scores` (0 filas) con la FK, los CHECK y las políticas RLS activas.
- **AC-02 (global real, REQ-06)** — Given ≥ 1 score guardado, When abro `/salon`, Then el Salón de la Fama lista los scores reales ordenados por puntuación descendente, leídos de la base de datos.
- **AC-03 (por juego real, REQ-07)** — Given scores de asteroides, When abro `/juego/asteroides`, Then el Leaderboard muestra solo los scores de ese juego, ordenados.
- **AC-04 (guardado real, REQ-08/11)** — Given una partida terminada, When escribo el nombre y pulso "GUARDAR PUNTUACIÓN", Then aparece una fila nueva en `scores` con `game_id`, `player_name`, `score`, y el nombre queda guardado en `localStorage`.
- **AC-05 (recordar nombre, REQ-11)** — Given que ya guardé antes con un nombre, When termino otra partida y se abre el modal, Then el campo de nombre viene pre-rellenado desde `localStorage`; pulsar "GUARDAR" persiste sin re-escribir.
- **AC-06 (vacío sin ficticios, REQ-05)** — Given un juego sin scores, When abro su Leaderboard o el Salón vacío, Then veo "Sé el primero en entrar al Salón de la Fama" y NINGÚN dato ficticio.
- **AC-07 (próximamente, REQ-12)** — Given un juego sin `embed` (no jugable), When veo el catálogo, Then su tarjeta muestra la etiqueta "PRÓXIMAMENTE"; asteroides (con `embed`) NO la muestra.
- **AC-08 (edge: validación, REQ-09)** — Given un intento de guardar con nombre > 10 caracteres o score negativo, When se envía, Then la Server Action devuelve error, la UI lo muestra y NO se inserta fila.
- **AC-09 (edge: lectura falla, REQ-10)** — Given la base de datos inalcanzable (claves malas/red caída), When abro un leaderboard, Then se renderiza el estado de vacío/error sin romper la página (sin pantalla en blanco).
- **AC-10 (edge: FK inexistente, REQ-09)** — Given un `game_id` que no existe en `games`, When se intenta insertar un score, Then la base de datos rechaza por la FK y la Server Action devuelve error.
- **AC-11 (fuera de scope, REQ-13)** — Given el catálogo, Then Library/Home/GameCard siguen leyendo `games.ts` (no consultan la base de datos para listar juegos).
- **AC-12 (build)** — `npm run build` compila sin errores de tipos ni lint.

## Non-functional requirements

- **NFR-01 (latencia de lectura).** Un leaderboard MUST cargar en p95 ≤ 400 ms (el percentil 95: el 95% de las cargas tardan eso o menos — mide la experiencia típica ignorando el 5% peor) con ≤ 1000 filas, apoyado en el índice `(game_id, score desc)`.
- **NFR-02 (integridad).** La base de datos MUST rechazar por CHECK/FK cualquier inserción inválida (nombre > 10, score < 0, juego inexistente) — la validación vive también en la base de datos, no solo en la app.
- **NFR-03 (seguridad).** Con la RLS activa, la clave anónima pública MUST NOT poder UPDATE/DELETE en `scores` ni escribir en `games`.

## Decisiones tomadas y descartadas

### D-01 · Lectura en Server Components, escritura por Server Action
- **Contexto:** mostrar leaderboards rápido y guardar desde el navegador sin API manual.
- **Decisión:** leer en Server Components (renderizado en servidor); escribir con Server Action (`"use server"`).
- **Consecuencias:** el HTML llega con datos; el guardado es una función servidor tipada.
- **Descartado:** un Route Handler (endpoint HTTP manual en `app/api`) — más código para el mismo efecto.

### D-02 · Sin scores ficticios; mensaje de vacío
- **Contexto:** el usuario quiere un leaderboard honesto.
- **Decisión:** no sembrar `scores`; vacío → mensaje "Sé el primero".
- **Consecuencias:** al inicio los leaderboards salen vacíos hasta que alguien juegue asteroides.
- **Descartado:** sembrar ejemplos — engañaría al mostrar puntuaciones inventadas.

### D-03 · Nombre en `localStorage`
- **Contexto:** evitar re-escribir el nombre cada vez.
- **Decisión:** guardar `player_name` en `localStorage` (navegador) y pre-rellenar.
- **Consecuencias:** comodidad; es dato local del equipo, no identidad verificada.
- **Descartado:** cookie/servidor — innecesario sin auth real.

### D-04 · `games` sembrada desde `games.ts`, híbrido diferido
- **Contexto:** la dirección es DB-only, pero reconectar 7 archivos ahora es grande.
- **Decisión:** `games.ts` sigue de autoría; la tabla se deriva por siembra; el catálogo no se reconecta aún.
- **Consecuencias:** transición segura; deuda controlada (se paga en el spec de catálogo-desde-DB).
- **Descartado:** reconectar todo ahora — blast radius (radio de impacto) alto en un spec ya cargado.

### D-05 · Inserción pública validada (sin auth)
- **Contexto:** no se fuerza login todavía.
- **Decisión:** INSERT público con CHECK; `user_id` nullable.
- **Consecuencias:** cualquiera guarda un score, pero con forma validada.
- **Descartado:** exigir autenticación — bloquearía jugar sin cuenta, que es el flujo actual.

## Risks

| Riesgo | Mitigación |
|---|---|
| Inserción pública abierta → spam de scores | CHECK de forma en la base de datos; rate-limiting y antitrampas quedan para spec futuro (anotado) |
| Claves Supabase ausentes en `.env.local` | Los clientes de spec 04 lanzan error claro; el leaderboard degrada a estado de error (REQ-10) |
| `player_name` es PII ligero | Solo iniciales ≤ 10; sin email; perfil `pii` lean anotado |

## Verification

Ejecutable end-to-end, produce evidencia:

1. Aplicar la migración → inspeccionar en el dashboard: `games` con 8 filas, `scores` vacía, políticas RLS visibles (AC-01).
2. `npm run build` → verde (AC-12).
3. `npm run dev`: jugar asteroides, terminar, guardar con un nombre → verificar fila en `scores` (dashboard) y nombre en `localStorage` (DevTools del navegador) (AC-04/05).
4. Abrir `/salon` y `/juego/asteroides` → ver el score real; abrir el leaderboard de un juego sin partidas → mensaje de vacío (AC-02/03/06).
5. Intentar guardar nombre > 10 o score negativo (forzado) → error, sin fila (AC-08).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01/02/03/04 | AC-01 | `supabase/migrations/0001_leaderboard.sql` | inspección dashboard |
| REQ-05 | AC-06 | `HallOfFame`/`Leaderboard` estado vacío | leaderboard sin datos |
| REQ-06 | AC-02 | `app/lib/scores.ts` + `HallOfFame` | `/salon` |
| REQ-07 | AC-03 | `app/lib/scores.ts` + `Leaderboard` | `/juego/[id]` |
| REQ-08 | AC-04 | `saveScore` Server Action + Player | guardar |
| REQ-09 | AC-08/10 | validación en `saveScore` + CHECK/FK | inserción inválida |
| REQ-10 | AC-09 | try/catch en lecturas | base de datos caída |
| REQ-11 | AC-05 | Player + `localStorage` | reabrir modal |
| REQ-12 | AC-07 | `GameCard` badge | catálogo |
| REQ-13 | AC-11 | catálogo sin cambios de fuente | inspección |

## Qué NO está en este spec

Reconexión del catálogo a la base de datos (DB-only), autenticación real / `user_id` obligatorio, escritura de `games` desde la app, Realtime (WebSocket), paginación, antitrampas / rate-limiting, moderación de nombres.
