# SPEC 02 — Landing page (Home) y navegación con Inicio/Acerca

> **Status:** Implemented · **Depends on:** 01-mvp-visual-pantallas · **Date:** 2026-07-04
> **Objective:** Implementar la landing visual (`home.jsx`) en la ruta `/`, moviendo la Biblioteca a `/biblioteca`, y ampliar el nav con "Inicio" y "Acerca de" (placeholder), sin implementar la página About real ni backend.

> The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are to be interpreted as described in RFC 2119 and RFC 8174 when, and only when, they appear in all capitals.

_Nota: se implementa `references/home-about/home.jsx` y `nav.jsx`. **NO** se implementa `about.jsx` (página About real queda fuera; el enlace "Acerca de" apunta a un placeholder `/acerca`)._

---

## Scope

**In:**

- **Landing / Home** (`/`) — hero con siluetas flotantes, sección "¿Por qué?", preview de juegos (`GAMES.slice(0,6)`), banda de stats, actividad en vivo (últimas puntuaciones + top jugadores), precios + FAQ, CTA final. Portado fiel de `home.jsx`.
- **Mover Biblioteca** de `/` a `/biblioteca` (misma UI del spec 01; sin cambios de comportamiento, solo de ruta).
- **Nav ampliado** (`nav.jsx`): enlaces **Inicio** (`/`), **Biblioteca** (`/biblioteca`), **Salón de la Fama** (`/salon`), **Acerca de** (`/acerca`), en desktop y panel móvil. Estado `active` correcto por ruta.
- **Placeholder `/acerca`** — página mínima "próximamente" (NO es la About real de `about.jsx`).
- **Datos mock decorativos** de la landing en `app/data/home.ts` tipado (actividad, top de hoy, stats, FAQ de precios).
- **Migración de estilos** `.home-*` (hero, secciones, feature-grid, stats, actividad, pricing, final) desde `references/home-about/styles.css` a `app/globals.css`.
- **Animaciones reveal-on-scroll** vía `IntersectionObserver` (hook cliente), fieles al template.
- **Reconexión de enlaces internos** que asumían `/` = Biblioteca (GameCard, "volver", detalle) hacia `/biblioteca`.

**Out of scope (for future specs):**

- **Página About real** (`about.jsx`): misión, highlights, formulario de contacto, terminal de éxito. Explícitamente fuera; solo se deja el placeholder `/acerca`.
- Backend, API, formularios funcionales, envío de mensajes.
- Datos reales de actividad/ranking (los de la landing son literales decorativos; no vienen de `seededScores` ni de sesiones reales).
- Precios/pagos reales (la sección de precios es informativa: "$0 / siempre").
- Redirección HTTP de la vieja `/` a `/biblioteca` (no se comparten URLs aún).
- Responsive fino más allá de lo que el CSS del template ya cubre.
- Tests automatizados (verificación = build + inspección visual).

---

## Data model

Sin datos persistentes nuevos. Datos mock decorativos de la landing, tipados, en `app/data/home.ts`. Los juegos reusan `GAMES` de `app/data/games.ts` (spec 01).

**`app/data/home.ts`**

```ts
// Actividad en vivo — últimas puntuaciones (decorativo, literal)
type ActivityRow = {
  player: string;                                   // alias jugador, p.ej. "NEONFOX"
  game: string;                                      // nombre mostrado, p.ej. "Caída"
  score: number;
  ago: string;                                       // texto relativo literal, p.ej. "hace 2 min"
  color: "cyan" | "magenta" | "yellow" | "green";
};
const ACTIVITY: ActivityRow[];                       // 7 filas (portadas de home.jsx)

// Top jugadores de hoy (decorativo, literal)
type TopRow = { rank: number; player: string; score: number };
const TOP_TODAY: TopRow[];                            // 5 filas

// Banda de stats
type StatBlock = { n: string; u: string; s: string }; // n="12+", u="JUEGOS", s="Y CONTANDO"
const STATS: StatBlock[];                             // 3 bloques

// Feature cards de "¿Por qué?"
type Feature = { icon: "GAMEPAD"|"FREE"|"TROPHY"|"ROCKET"; title: string; desc: string; color: "cyan"|"yellow"|"magenta"|"green" };
const FEATURES: Feature[];                            // 4 tarjetas

// FAQ de precios
type Faq = { q: string; a: string };
const PRICING_FAQ: Faq[];                             // 3 items
```

Convenciones:

- **Determinismo:** todos los datos son literales constantes → mismos valores en render server/client. **No** usar `Math.random()`/`Date.now()` (los "hace 2 min" son texto fijo). Evita hydration mismatch (desajuste servidor/cliente al hidratar).
- Formato de número: `toLocaleString("es-ES")`.
- Estilos: clases `.home-*`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.pricing-*`, `.pc-*`, `.faq-*` migradas del template; Tailwind para lo incidental.

---

## Requirements

**Estructura / rutas**

- **REQ-01** (ubiquitous): The system MUST serve the landing (Home) at route `/`.
- **REQ-02** (ubiquitous): The system MUST serve the Biblioteca at route `/biblioteca`, preserving its spec-01 behavior (search, chips, grid, tilt) unchanged.
- **REQ-03** (ubiquitous): The system MUST source all landing mock data from `app/data/home.ts` and all game data from `app/data/games.ts`, never inline in the component.
- **REQ-04** (ubiquitous): The system MUST render the migrated `.home-*` theme styles in `globals.css` (hero, feature-grid, stats, activity, pricing, final).

**Landing / Home (`/`)**

- **REQ-05** (ubiquitous): The Home MUST render, in order: hero (with floating silhouettes), "¿Por qué Arcade Vault?", games preview, stats band, live activity, pricing + FAQ, final CTA.
- **REQ-06** (ubiquitous): The games preview MUST show the first 6 games from `GAMES` (`GAMES.slice(0,6)`).
- **REQ-07** (event-driven): When the user activates a preview card, the system MUST navigate to `/juego/[id]`.
- **REQ-08** (event-driven): When the user activates "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS", or "INSERTAR MONEDA", the system MUST navigate to `/biblioteca`.
- **REQ-09** (event-driven): When the user activates "CREAR CUENTA" or "EMPEZAR GRATIS", the system MUST navigate to `/auth`.
- **REQ-10** (event-driven): When the user activates "VER SALÓN", the system MUST navigate to `/salon`.
- **REQ-11** (state-driven): While a `.reveal` section scrolls into the viewport (threshold ≥ 0.12), the system MUST add the `in` class to trigger its entrance animation, once per element.

**Nav (`nav.jsx`)**

- **REQ-12** (ubiquitous): The nav MUST expose four links in desktop and mobile: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`), Acerca de (`/acerca`).
- **REQ-13** (state-driven): While on `/`, the nav MUST mark "Inicio" active; while on `/biblioteca`, `/juego/*` or `/jugar/*`, it MUST mark "Biblioteca" active; while on `/salon`, "Salón"; while on `/acerca`, "Acerca de".
- **REQ-14** (state-driven): While a user is set, the nav MUST show the user-name button; while unset, it MUST show "Iniciar Sesión" (spec-01 behavior preserved).

**Acerca de (`/acerca`) — placeholder**

- **REQ-15** (ubiquitous): The `/acerca` route MUST render a minimal "próximamente" placeholder consistent with the theme, and MUST NOT implement the `about.jsx` contact form or mission content.

**Integración / no-regresión**

- **REQ-16** (ubiquitous): All internal links that previously targeted `/` as Biblioteca (GameCard, detalle "volver", player exits) MUST target `/biblioteca`.
- **REQ-17** (unwanted behavior): If any landing component renders non-deterministic values (`Math.random`/`Date.now`) during SSR, then the system MUST avoid it (use literal data) to prevent hydration mismatch.
- **REQ-18** (ubiquitous): Per-route metadata (`title`) MUST be set: `/` (Inicio/Home), `/biblioteca` (Biblioteca), `/acerca` (Acerca de).

---

## Implementation plan

Cada paso deja la app compilando (`next build`) y commiteable por sí solo.

1. **Datos → `app/data/home.ts`.** Crear el módulo con `ACTIVITY`, `TOP_TODAY`, `STATS`, `FEATURES`, `PRICING_FAQ` (tipados, portados de `home.jsx`). _(REQ-03)_
2. **Migrar estilos.** Copiar los bloques `.home-*`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.pc-*`, `.faq-*`, `.silo`, `.about-hero` (solo lo que use Home) desde `references/home-about/styles.css` al final de `app/globals.css`. NO copiar estilos exclusivos de la About real (contact-form, terminal-success) salvo los compartidos. _(REQ-04)_
3. **Hook reveal.** Crear `app/hooks/useReveal.ts` (client) con `IntersectionObserver` (threshold 0.12, `unobserve` tras entrar). _(REQ-11)_
4. **Mover Biblioteca a `/biblioteca`.** Crear `app/biblioteca/page.tsx` (mueve el `<Library/>` + metadata "Biblioteca" del actual `app/page.tsx`). _(REQ-02, REQ-18)_
5. **Home en `/`.** Crear `app/components/Home.tsx` (client): hero + `FloatingSilhouettes` + `FeatureIcon`/`FeatureCard`, preview con `MiniCard` (`GAMES.slice(0,6)` → `/juego/[id]`), stats, actividad (`ACTIVITY`, `TOP_TODAY`), precios + FAQ (`PRICING_FAQ`), CTA final. CTAs con `Link`/`useRouter` a `/biblioteca`, `/auth`, `/salon`. Usar `useReveal()`. Reescribir `app/page.tsx` para renderizar `<Home/>` + metadata "Inicio". _(REQ-01, REQ-05..11)_
6. **Nav ampliado.** `Nav.tsx`: añadir enlaces Inicio y Acerca de (desktop + móvil); recalcular `active` por ruta (`/` = Inicio; `/biblioteca|/juego|/jugar` = Biblioteca; `/salon`; `/acerca`). _(REQ-12, REQ-13, REQ-14)_
7. **Placeholder `/acerca`.** Crear `app/acerca/page.tsx` (server) con bloque temático "PRÓXIMAMENTE" + metadata "Acerca de". _(REQ-15, REQ-18)_
8. **Reconectar enlaces internos.** Actualizar `GameCard.tsx`, `app/juego/[id]/*` (volver), `Player.tsx`/salidas y cualquier `Link href="/"` que significara Biblioteca → `/biblioteca`. Verificar que el logo del nav sigue yendo a `/` (Home, correcto). _(REQ-16)_

Archivos nuevos: `app/data/home.ts`, `app/hooks/useReveal.ts`, `app/components/Home.tsx`, `app/biblioteca/page.tsx`, `app/acerca/page.tsx`.
Archivos tocados: `app/page.tsx`, `app/components/Nav.tsx`, `app/components/GameCard.tsx`, `app/juego/[id]/page.tsx` (y componentes de detalle), `app/components/Player.tsx`, `app/globals.css`.

---

## Acceptance criteria

**Build / rutas (REQ-01, REQ-02, REQ-18)**

- [ ] `next build` termina exit 0, sin warnings de hydration en consola.
- [ ] Responden: `/` (Home), `/biblioteca` (Biblioteca), `/acerca` (placeholder), y las de spec 01 (`/juego/[id]`, `/jugar/[id]`, `/salon`, `/auth`).

**Home (REQ-05..11)**

```
Scenario: secciones presentes
  Given navego a /
  Then veo en orden: hero, "¿POR QUÉ ARCADE VAULT?", preview de juegos,
       banda de stats, "ACTIVIDAD EN VIVO", "PRECIOS", CTA final

Scenario: preview usa 6 juegos reales (REQ-06)
  Given la sección "JUEGOS DISPONIBLES AHORA"
  Then muestra exactamente 6 tarjetas de GAMES

Scenario: abrir detalle desde preview (REQ-07)
  When activo una tarjeta del preview
  Then navego a /juego/[id]

Scenario: CTA a biblioteca (REQ-08)
  When activo "EXPLORAR JUEGOS" (o "VER TODOS", o "INSERTAR MONEDA")
  Then navego a /biblioteca

Scenario: CTA a auth (REQ-09)
  When activo "CREAR CUENTA" (o "EMPEZAR GRATIS")
  Then navego a /auth

Scenario: CTA a salón (REQ-10)
  When activo "VER SALÓN"
  Then navego a /salon

Scenario: reveal al hacer scroll (state, REQ-11)
  Given una sección .reveal fuera del viewport
  When entra en pantalla
  Then recibe la clase "in" (animación de entrada), una sola vez
```

**Nav (REQ-12..14)**

```
Scenario: cuatro enlaces
  Given el nav (desktop y móvil)
  Then muestra Inicio, Biblioteca, Salón de la Fama, Acerca de

Scenario: active por ruta (state, edge)
  Given estoy en /biblioteca (o /juego/x, /jugar/x)
  Then "Biblioteca" queda active y "Inicio" no
  Given estoy en /
  Then "Inicio" queda active

Scenario: usuario en nav (state)
  Given usuario "PX_KAI" logueado
  Then el nav muestra el botón con su nombre
```

**Acerca de (REQ-15)**

- [ ] `/acerca` muestra placeholder "próximamente" temático; NO hay formulario de contacto ni terminal de `about.jsx`.

**No-regresión (REQ-16)**

```
Scenario: enlaces internos a biblioteca
  Given estoy en /juego/[id]
  When activo "volver"
  Then navego a /biblioteca (no a la landing)
```

**Fuera de alcance (check explícito)**

- [ ] No existe la página About real (misión, highlights, formulario, terminal); solo el placeholder `/acerca`.
- [ ] Datos de actividad/top de la landing son literales decorativos; no vienen de sesiones reales ni de `seededScores`.

---

## Non-functional requirements

- **Rendimiento:** `next build` produce las rutas nuevas como estáticas; First Load JS de `/` ≤ 160 kB (baseline scaffold + Home client con observer).
- **Hidratación:** 0 warnings de hydration mismatch en consola (datos literales, REQ-17).
- **Accesibilidad:** siluetas/íconos decorativos con `aria-hidden="true"`; botones con texto; foco visible vía estilos del tema; enlaces del nav navegables por teclado.
- **Compatibilidad:** render correcto en Chromium ≥ 120; `IntersectionObserver` soportado (fallback aceptable: si no existe, mostrar contenido sin animación, nunca ocultarlo).
- **Fidelidad visual:** la landing reproduce las secciones y el color/tipografía del template `home.jsx` (mismo orden, mismos textos).

---

## Decisions

### D1 — Landing en `/`, Biblioteca a `/biblioteca`

- **Status:** Accepted
- **Context:** `nav.jsx` separa "Inicio" de "Biblioteca"; el template trata Home como landing y Biblioteca como catálogo.
- **Decision:** `/` = Home; mover Library a `/biblioteca`.
- **Consequences:** Reajusta spec 01 (su `/` era Biblioteca); requiere reconectar enlaces internos.
- **Rejected:** Landing en `/inicio` dejando Biblioteca en `/` (no idiomático; "Inicio" no apuntaría a la raíz).

### D2 — "Acerca de" como placeholder, sin About real

- **Status:** Accepted
- **Context:** El usuario pidió NO implementar `about.jsx`, pero `nav.jsx` incluye el enlace.
- **Decision:** Enlace "Acerca de" → `/acerca` con página "próximamente"; About real queda para otro spec.
- **Consequences:** Nav completo y sin enlaces muertos; About real diferida.
- **Rejected:** Omitir el enlace (rompe fidelidad del nav) · implementar About ya (contradice la instrucción).

### D3 — Datos mock de la landing en `app/data/home.ts`

- **Status:** Accepted
- **Context:** Spec 01 (REQ-02) exige datos fuera de los componentes; `home.jsx` los tenía inline.
- **Decision:** Mover a `app/data/home.ts` tipado.
- **Consequences:** Consistencia con la convención del proyecto; componente solo consume.
- **Rejected:** Literales inline (rompe REQ-02).

### D4 — Datos de actividad literales, no `seededScores`

- **Status:** Accepted
- **Context:** La landing muestra actividad "en vivo" y "hace N min"; datos reales/aleatorios romperían hidratación.
- **Decision:** Literales fijos decorativos (incluidos los textos "hace N min").
- **Consequences:** Deterministas y estables; no reflejan sesiones reales (aceptado, es decorativo).
- **Rejected:** `seededScores`/tiempos reales (no aportan y arriesgan mismatch).

### D5 — Home como client component con `IntersectionObserver`

- **Status:** Accepted
- **Context:** El template anima secciones al entrar en viewport.
- **Decision:** `Home.tsx` cliente + `useReveal()` con observer.
- **Consequences:** Fidelidad de animación; algo más de JS en `/`.
- **Rejected:** Home server sin animación (menos fiel al template, decisión del usuario fue replicar).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Mover `/` rompe enlaces internos que asumían Biblioteca en raíz | Paso 8 reconecta todos a `/biblioteca`; escenario de no-regresión (REQ-16). |
| Hydration mismatch por datos no deterministas | Datos literales; sin `Math.random`/`Date.now` (REQ-17, D4). |
| Copiar de `styles.css` estilos exclusivos de la About real por error | Paso 2 restringe a clases usadas por Home; About real explícitamente fuera. |
| `IntersectionObserver` no dispara y oculta contenido | Fallback: sin observer el contenido se muestra igual (nunca `display:none` permanente). |

---

## Verification

1. `npx next build` → exit 0; listadas `/`, `/biblioteca`, `/acerca` + rutas de spec 01; sin errores.
2. `npx next dev` y visitar `/`: comprobar orden de secciones, preview de 6 juegos, animaciones reveal al hacer scroll, consola con 0 warnings de hydration.
3. Recorrer escenarios de Acceptance: CTAs (biblioteca/auth/salón), tarjeta de preview → detalle, nav active por ruta, `/acerca` placeholder, "volver" desde detalle → `/biblioteca`.
4. Evidencia: capturas de `/` (secciones), `/biblioteca`, `/acerca`, y salida del build.

---

## What is **not** in this spec

- Página About real (`about.jsx`): misión, highlights, formulario de contacto, terminal de éxito.
- Backend, API, envío de formularios, autenticación real.
- Actividad/ranking reales o persistentes (los de la landing son decorativos).
- Precios/pagos reales.
- Redirección HTTP de `/` antigua.
- Tests automatizados.

Cada uno, si llega, en su propio spec.
