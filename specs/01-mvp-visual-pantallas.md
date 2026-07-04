# SPEC 01 — MVP visual: pantallas del Arcade Vault

> **Status:** Implementado · **Depends on:** — · **Date:** 2026-07-03
> **Objective:** Implementar visualmente las 5 pantallas del template (Biblioteca, Detalle, Reproductor, Salón de la Fama, Auth) en Next.js App Router con rutas reales y la interactividad mock del template, sin backend ni persistencia.

> The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are to be interpreted as described in RFC 2119 and RFC 8174 when, and only when, they appear in all capitals.

_Nota: el prompt decía "Arcade Bot"; el proyecto es **Arcade Vault** — se asume ese nombre._

---

## Scope

**In:**

- Tema global ya aplicado (`app/globals.css` con `styles.css`, fuentes `Press Start 2P` / `JetBrains Mono`) — **ya implementado**, se da por base.
- **Biblioteca** (`/`) — hero, buscador, chips de categoría, grid de tarjetas con tilt — **ya implementado**; el spec lo formaliza y verifica.
- **Detalle** (`/juego/[id]`) — portada grande, tags, descripción, stat-strip, acciones, leaderboard con puntuaciones sembradas.
- **Reproductor** (`/jugar/[id]`) — HUD (jugador/score/vidas/nivel), pantalla CRT con arena falsa animada, pausa, modal de fin de juego con guardado mock.
- **Salón de la Fama** (`/salon`) — tabs por juego, podio top-3, tabla de ranking, fila "tu marca" si hay usuario.
- **Auth** (`/auth`) — tarjeta con tabs iniciar/crear, campos, login falso, "jugar como invitado", social buttons.
- Datos mock compartidos: `GAMES`, `CATS`, `seededScores()` (portados de `data.jsx`) en `app/data/`.
- Navegación real entre rutas + estado de usuario en memoria vía `AuthContext` cliente.

**Out of scope (for future specs):**

- Motores de juego reales (la arena CRT es decorativa; ningún juego es jugable).
- Backend, API, autenticación real, base de datos.
- Persistencia (localStorage/IndexedDB) — estado solo en memoria.
- Registro/login funcional (validación, contraseñas, OAuth Google/GitHub reales).
- Puntuaciones reales o rankings persistentes entre sesiones.
- Responsive fino más allá de lo que el CSS del template ya cubre.
- Tests automatizados (la verificación es build + inspección visual).

---

## Data model

Sin datos nuevos persistentes. Info ficticia mock en `app/data/`, tipada, lista para sustituir por BD (base de datos).

**`app/data/games.ts`**

```ts
type Game = {
  id: string; title: string; short: string; long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;        // clase CSS de portada: "cover-bricks", "cover-tetro", …
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number; plays: string;
};
const GAMES: Game[];    // 8 juegos (portados de data.jsx)
const CATS: string[];   // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
```

**`app/data/scores.ts`**

```ts
type ScoreRow = { rank: number; name: string; score: number; date: string };
const PLAYERS: string[];                                     // 18 alias
function seededScores(seed: number, count = 12): ScoreRow[]; // PRNG determinista
```

**`AuthContext` (en memoria, cliente)**

```ts
type User = { name: string } | null;   // se pierde al recargar; sin persistencia
```

Convenciones:

- Puntuaciones: `seededScores` es determinista por `seed` → mismos datos en render server/client (evita hydration mismatch). **No** usar `Math.random()`/`Date.now()` en render.
- Formato de número: `toLocaleString("es-ES")`.
- Estilos: clases `.av-*` de `globals.css` para estructura del template; Tailwind para lo incidental.

---

## Requirements

**Globales / tema**

- **REQ-01** (ubiquitous): The system MUST render every screen with the migrated `globals.css` theme (`.av-*` classes, `Press Start 2P` / `JetBrains Mono` fonts).
- **REQ-02** (ubiquitous): The system MUST source all game/score data from `app/data/` modules, never inline in components.
- **REQ-03** (ubiquitous): The system MUST expose one real App Router route per screen: `/`, `/juego/[id]`, `/jugar/[id]`, `/salon`, `/auth`.

**Biblioteca (`/`)**

- **REQ-04** (event-driven): When the user types in the search box, the system MUST filter cards by title substring (case-insensitive).
- **REQ-05** (event-driven): When the user selects a category chip, the system MUST show only games in that category (`TODOS` shows all).
- **REQ-06** (unwanted behavior): If no game matches the filter, then the system MUST show the "NO HAY RESULTADOS" placeholder instead of an empty grid.
- **REQ-07** (event-driven): When the user activates a card or its JUGAR button, the system MUST navigate to `/juego/[id]`.

**Detalle (`/juego/[id]`)**

- **REQ-08** (ubiquitous): The system MUST show cover, tags, long description, stat-strip and a seeded leaderboard for the game.
- **REQ-09** (event-driven): When the user activates "JUGAR AHORA", the system MUST navigate to `/jugar/[id]`.
- **REQ-10** (unwanted behavior): If `[id]` matches no game, then the system MUST render the App Router `not-found` screen.

**Reproductor (`/jugar/[id]`)**

- **REQ-11** (ubiquitous): The system MUST render the CRT placeholder arena (decorative, non-playable) as copied from the template.
- **REQ-12** (state-driven): While not paused and not over, the system MUST auto-increment the mock score on an interval.
- **REQ-13** (event-driven): When the user activates PAUSA, the system MUST freeze the score and show the "EN PAUSA" overlay; REANUDAR reverses it.
- **REQ-14** (event-driven): When the user activates FIN, the system MUST show the game-over modal with the final score.
- **REQ-15** (event-driven): When the user saves the score in the modal, the system MUST show the "PUNTUACIÓN GUARDADA" toast (in-memory only, not persisted).

**Salón (`/salon`)**

- **REQ-16** (event-driven): When the user selects a game tab, the system MUST show that game's podium (top-3) and ranking table from `seededScores`.
- **REQ-17** (state-driven): While a user is logged in, the system MUST show the "tu marca" row; while logged out, it MUST omit it.

**Auth (`/auth`)**

- **REQ-18** (event-driven): When the user submits the auth form, the system MUST set the in-memory user (name uppercased, ≤10 chars) and navigate to `/`.
- **REQ-19** (event-driven): When the user picks "JUGAR COMO INVITADO", the system MUST clear the user and navigate to `/`.
- **REQ-20** (event-driven): When the user toggles the INICIAR/CREAR tab, the system MUST show/hide the email field.

**Navegación / usuario**

- **REQ-21** (ubiquitous): The system MUST hold user state in an in-memory client `AuthContext`; it MUST NOT persist it (lost on reload).
- **REQ-22** (state-driven): While a user is set, the nav MUST show the user name button; while unset, it MUST show "Iniciar Sesión".
- **REQ-23** (unwanted behavior): If any component renders non-deterministic values (`Math.random`/`Date.now`) during SSR, then the system MUST avoid it (use seeded/deterministic data) to prevent hydration mismatch.

---

## Implementation plan

Cada paso deja la app compilando (`next build`) y commiteable por sí solo.

1. **Datos → `app/data/`.** Crear `app/data/games.ts` (tipo `Game`, `GAMES`, `CATS`) moviendo el actual `app/lib/games.ts`; crear `app/data/scores.ts` (`ScoreRow`, `PLAYERS`, `seededScores`). Borrar `app/lib/`. Actualizar imports en `Library`/`GameCard`. _(REQ-02)_
2. **AuthContext.** Crear `app/context/AuthContext.tsx` (client provider, `user` en memoria, `login`/`signOut`). Envolver `{children}` en `app/layout.tsx`. _(REQ-21)_
3. **Refactor home a routing real.** `Nav.tsx`: `Link` a `/`, `/salon`, `/auth`; botón usuario/Iniciar Sesión desde `useAuth`; `usePathname` para `active`. `GameCard.tsx`: `Link`/`useRouter` a `/juego/[id]`. Convertir `style={{…}}` inline a Tailwind. _(REQ-01, REQ-03, REQ-04..07, REQ-22)_
4. **Detalle.** `app/juego/[id]/page.tsx` (server, resuelve juego; `notFound()` si no existe) + `app/components/Leaderboard.tsx`. Portada, tags, stat-strip, acciones (`Link` a `/jugar/[id]` y `/`). _(REQ-08, REQ-09, REQ-10)_
5. **Reproductor.** `app/jugar/[id]/page.tsx` + `app/components/Player.tsx` (client): HUD, arena CRT placeholder copiada del template, loop de score, pausa, modal fin de juego con toast guardado (memoria). _(REQ-11..15)_
6. **Salón.** `app/salon/page.tsx` + `app/components/HallOfFame.tsx` (client): tabs por juego, podio top-3, tabla `seededScores`, fila "tu marca" si `useAuth().user`. _(REQ-16, REQ-17, REQ-23)_
7. **Auth.** `app/auth/page.tsx` + `app/components/Auth.tsx` (client): tabs iniciar/crear (muestra/oculta email), submit → `login()` + `router.push('/')`, "jugar como invitado", social buttons decorativos. _(REQ-18, REQ-19, REQ-20)_
8. **Metadata por ruta.** `export const metadata` (o `generateMetadata` en detalle/reproductor) con títulos por pantalla. _(REQ-03)_

Archivos nuevos/tocados: `app/data/{games,scores}.ts`, `app/context/AuthContext.tsx`, `app/layout.tsx`, `app/components/{Nav,Library,GameCard,Leaderboard,Player,HallOfFame,Auth}.tsx`, `app/{juego/[id],jugar/[id],salon,auth}/page.tsx`, `app/page.tsx`.

---

## Acceptance criteria

**Build/tema**

- [ ] (REQ-01) `next build` termina con exit 0 y sin errores de hydration en consola.
- [ ] (REQ-03) Las 5 rutas responden: `/`, `/juego/bloque-buster`, `/jugar/bloque-buster`, `/salon`, `/auth`.

**Biblioteca (REQ-04..07)**

```
Scenario: filtrar por texto
  Given la biblioteca con 8 juegos
  When escribo "caí" en el buscador
  Then solo se muestra la tarjeta "CAÍDA"

Scenario: filtrar por categoría
  Given el chip "PUZZLE" activo
  Then solo se muestran juegos de categoría PUZZLE

Scenario: sin resultados (REQ-06, edge)
  Given el buscador con "zzzz"
  Then aparece "NO HAY RESULTADOS" y ningún grid vacío

Scenario: abrir detalle
  When activo una tarjeta
  Then navego a /juego/[id]
```

**Detalle (REQ-08..10)**

```
Scenario: id inexistente (edge/error)
  Given navego a /juego/no-existe
  Then se renderiza la pantalla not-found

Scenario: jugar
  When activo "JUGAR AHORA"
  Then navego a /jugar/[id]
```

- [ ] (REQ-08) Muestra portada, tags, stat-strip y leaderboard de 10 filas.

**Reproductor (REQ-11..15)**

```
Scenario: score sube (state)
  Given el juego activo sin pausa
  When pasa ~1s
  Then la puntuación aumenta

Scenario: pausa (state, edge)
  When activo PAUSA
  Then la puntuación se congela y aparece overlay "EN PAUSA"

Scenario: fin y guardado
  When activo FIN, luego GUARDAR PUNTUACIÓN
  Then aparece modal con score final y toast "PUNTUACIÓN GUARDADA"
```

- [ ] (REQ-11) La arena CRT se muestra (decorativa, no jugable).

**Salón (REQ-16, REQ-17)**

```
Scenario: cambiar tab
  When selecciono otro juego en las tabs
  Then podio y tabla cambian a datos de ese juego

Scenario: fila "tu marca" (state, edge)
  Given usuario logueado
  Then aparece la fila resaltada "TU MEJOR MARCA"
  Given usuario deslogueado
  Then esa fila NO aparece
```

**Auth (REQ-18..20)**

```
Scenario: login mock
  When escribo "px_kai" y envío
  Then el usuario queda como "PX_KAI" y navego a /

Scenario: tab crear cuenta (edge)
  When selecciono "CREAR CUENTA"
  Then aparece el campo email

Scenario: invitado
  When activo "JUGAR COMO INVITADO"
  Then usuario queda nulo y navego a /
```

**Usuario / navegación (REQ-21, REQ-22)**

```
Scenario: usuario en memoria (edge)
  Given usuario logueado "PX_KAI"
  When recargo la página (F5)
  Then el nav vuelve a mostrar "Iniciar Sesión" (no persiste)
```

**Fuera de alcance (check explícito)**

- [ ] No existe lógica de juego real, backend, ni persistencia en disco/localStorage.

---

## Non-functional requirements

- **Rendimiento:** `next build` produce las 5 rutas como estáticas o con generación válida; First Load JS de `/` ≤ 130 kB (baseline actual del scaffold + componentes).
- **Hidratación:** 0 warnings de hydration mismatch en consola (garantizado por datos deterministas, REQ-23).
- **Accesibilidad:** inputs con `<label>`; botones con texto o `aria-label` (ej. hamburguesa); foco visible vía estilos del tema.
- **Compatibilidad:** render correcto en Chromium ≥ 120 (target de la demo); layout responsive en breakpoints ya definidos en `globals.css` (840px, 900px, 720px).

---

## Decisions

### D1 — Routing real vs single-page

- **Status:** Accepted
- **Context:** Template usa hash-routing en una SPA (single-page application); Next 16 favorece rutas de archivo.
- **Decision:** Una ruta App Router por pantalla (`/`, `/juego/[id]`, `/jugar/[id]`, `/salon`, `/auth`).
- **Consequences:** URLs compartibles, back del navegador; el estado en memoria se pierde al recargar.
- **Rejected:** Hash-routing SPA (no idiomático, rompe SSR/metadata por ruta).

### D2 — Estado de usuario en memoria

- **Status:** Accepted
- **Context:** MVP visual; sin backend ni auth real.
- **Decision:** `AuthContext` cliente en el layout raíz; sin persistencia.
- **Consequences:** El login mock se refleja en nav/salón durante la sesión; se pierde al recargar (aceptado).
- **Rejected:** localStorage (añade lógica no visual, fuera de alcance) · cookies/servidor (requiere backend).

### D3 — Estilado: `.av-*` + Tailwind

- **Status:** Accepted
- **Context:** `globals.css` ya tiene el tema migrado; el usuario quiere Tailwind para lo demás.
- **Decision:** Reutilizar clases `.av-*` para estructura del template; Tailwind para estilos incidentales; convertir `style={{…}}` inline a utilidades.
- **Consequences:** Consistencia con el diseño original + ergonomía Tailwind.
- **Rejected:** Reescribir todo en Tailwind puro (perdería fidelidad y duplicaría el CSS ya migrado) · solo CSS del template (ignora la preferencia Tailwind).

### D4 — Datos deterministas (`seededScores`)

- **Status:** Accepted
- **Context:** Rankings necesitan datos; `Math.random`/`Date.now` en render rompen hydration.
- **Decision:** PRNG (generador pseudoaleatorio) sembrado determinista en `app/data/scores.ts`.
- **Consequences:** Mismos datos server/client; reproducible; listo para sustituir por BD.
- **Rejected:** Random en runtime (hydration mismatch) · fechas reales (no determinista).

### D5 — Reproductor como placeholder

- **Status:** Accepted
- **Context:** Juegos reales aún no existen; el usuario pide copiar la arena tal cual.
- **Decision:** Copiar la arena CRT del template como placeholder decorativo en `/jugar/[id]`.
- **Consequences:** Pantalla visualmente completa; sustituible por motor real luego.
- **Rejected:** Implementar un juego real ahora (fuera de alcance del MVP visual).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Hydration mismatch por datos no deterministas | `seededScores` sembrado; sin `Math.random`/`Date.now` en render (REQ-23, D4). |
| Estado de usuario se pierde al recargar y confunde | Comportamiento documentado y aceptado (D2); no es bug. |
| Fuentes `next/font/google` fallan sin red en build | Red verificada OK; build previo exit 0. Fallback a fuentes del sistema en `--pixel`/`--mono`. |

---

## Verification

1. `npx next build` → exit 0, 5 rutas listadas, sin errores.
2. `npx next start` (o `dev`) y visitar las 5 rutas; abrir consola → 0 warnings de hydration.
3. Recorrer los escenarios de Acceptance (filtros, detalle, not-found `/juego/no-existe`, pausa/fin en reproductor, tabs salón, login/invitado en auth, F5 borra usuario).
4. Evidencia: capturas de las 5 pantallas + salida del build.

---

## What is **not** in this spec

- Motores de juego reales / jugabilidad.
- Backend, API, base de datos, autenticación real.
- Persistencia (localStorage/IndexedDB/cookies).
- OAuth real (Google/GitHub).
- Rankings/puntuaciones reales entre sesiones.
- Tests automatizados.

Cada uno, si llega, en su propio spec.
