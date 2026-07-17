# 05 — Juego Asteroides embebido y puenteado con la plataforma

- **Estado:** Implemented
- **Fecha:** 2026-07-17
- **Dependencias:** 01-mvp-visual-pantallas (rutas `/jugar/[id]`, componente `Player`, catálogo `GAMES`)
- **Objetivo (una frase):** Portar el juego canvas Asteroides (`references/started-games/02-asteroids/`) a la plataforma como juego jugable de id `asteroides`, embebido en un iframe (marco aislado) servido desde `public/games/asteroides/`, con un puente `postMessage` (mensajería entre iframe y página) bidireccional: el juego notifica score/vidas/nivel/game-over al HUD (barra de estado) React, y el contenedor React controla pausa/reanudar/reinicio.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.

## Scope

**En scope:**
- Copiar los archivos del juego a `public/games/asteroides/` (`index.html`, `game.js`, `favicon.svg`), servidos como estáticos.
- Modificar `game.js` **mínimamente** (sigue siendo el mismo juego) para: (a) implementar **pausa** (congelar el loop de update — la física), (b) emitir por `postMessage` los cambios de estado (score, vidas, nivel, power-up, game-over), (c) escuchar comandos del contenedor (pause/resume/restart), (d) handshake `ready` al cargar.
- Nueva entrada `asteroides` en el catálogo `GAMES`, **distinta** del mock `rocas` existente (que NO se toca).
- Campo `embed?: string` en el tipo `Game` (única fuente de verdad de "qué juego es jugable"): ruta pública al `index.html` del juego. Sin `embed` = mock.
- `Player.tsx`: si `game.embed` existe → renderizar el iframe y cablear el puente (HUD y modal de game-over movidos por eventos reales; ocultar la arena mock). Si no → arena mock actual intacta.
- Sincronización de pausa bidireccional: tecla `P` dentro del juego y botón PAUSA del Player quedan en sync.

**NO en scope (specs futuros):**
- Persistencia real de puntuación (tabla `scores`, Supabase, RLS — Row Level Security, reglas por fila): el modal sigue guardando mock. Depende del spec de leaderboard.
- Portar los otros juegos (`rocas`, `caida`, `serpentina`, etc.) — el patrón queda listo pero solo se cablea `asteroides`.
- Controles táctiles (el juego es solo teclado).
- Sonido, nuevos niveles o cambios de jugabilidad del juego original.
- Responsividad avanzada del canvas más allá de escalar-para-encajar preservando proporción.

## Data model

**Cambios de tipos y datos (sin base de datos):**

- **`Game.embed?: string`** (nuevo campo en `app/data/games.ts`) — ruta pública al juego, p.ej. `"/games/asteroides/index.html"`. `undefined` → juego mock.
- **Nueva entrada `GAMES`:**
  - `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`
  - `short: "Rota, propulsa y pulveriza asteroides en el vacío."`
  - `long: "Pilota una nave triangular en un campo de asteroides toroidal (los bordes se envuelven). Dispara para partir rocas grandes en fragmentos menores y recoge power-ups de disparo triple. 3 vidas con invencibilidad temporal al reaparecer."`
  - `cover: "cover-rocas"` (reusa el estilo de portada existente — solo visual, sin acoplar lógica ni id con `rocas`)
  - `embed: "/games/asteroides/index.html"`, `best: 0`, `plays: "0"`
- **Contrato del puente `postMessage`** (definido en TypeScript para React, espejado en el bridge JS del juego), en `app/lib/games/bridge.ts` como fuente única del protocolo, reusable para futuros juegos:
  - **Juego → Host (React):** `{type:'ready'}` · `{type:'score', value:number}` · `{type:'lives', value:number}` · `{type:'level', value:number}` · `{type:'powerup', name:string, remaining:number}` · `{type:'paused', value:boolean}` · `{type:'gameover', score:number}`
  - **Host → Juego:** `{type:'pause'}` · `{type:'resume'}` · `{type:'restart'}`
  - Origen validado (`event.origin` == mismo origen; los archivos se sirven desde el mismo dominio Next).

## Requirements (EARS + RFC 2119)

- **REQ-01** — The system MUST servir el juego desde `public/games/asteroides/` (`index.html`, `game.js`, `favicon.svg`) como archivos estáticos accesibles en `/games/asteroides/index.html`.
- **REQ-02** — The `Game` type MUST incluir el campo opcional `embed?: string`, y la entrada `asteroides` de `GAMES` MUST tener `embed: "/games/asteroides/index.html"`.
- **REQ-03** — While `game.embed` está definido, the `Player` MUST renderizar un `<iframe>` cargando esa ruta y MUST NOT renderizar la arena mock (naves CSS).
- **REQ-04** — When el juego carga, the game bridge MUST emitir `{type:'ready'}` por `postMessage`, y the `Player` MUST esperar `ready` antes de enviar comandos (evita carrera de inicialización).
- **REQ-05** — When cambian score, vidas o nivel en el juego, the game bridge MUST emitir el mensaje correspondiente (`score`/`lives`/`level`), y the `Player` MUST reflejar el valor en su HUD React.
- **REQ-06** — When el juego termina, the game bridge MUST emitir `{type:'gameover', score}`, y the `Player` MUST abrir el modal de fin con ese score real.
- **REQ-07** — When el usuario pulsa el botón PAUSA del Player, the `Player` MUST enviar `{type:'pause'}` (y `{type:'resume'}` al reanudar), y the game MUST congelar/reanudar el loop de update (física) sin cerrar el juego.
- **REQ-08** — When el usuario pulsa la tecla `P` dentro del juego, the game MUST alternar pausa y MUST emitir `{type:'paused', value}` para que el botón del Player quede en sync.
- **REQ-09** — When el usuario pulsa "JUGAR DE NUEVO" en el modal, the `Player` MUST enviar `{type:'restart'}` y the game MUST reiniciar a estado inicial (score 0, 3 vidas, nivel 1).
- **REQ-10** *(unwanted)* — If llega un `message` cuyo `origin` no es el mismo origen de la app, then the `Player` MUST ignorarlo (no procesar el mensaje).
- **REQ-11** *(unwanted)* — If `game.embed` no está definido, then the `Player` MUST conservar el comportamiento mock actual sin cambios (arena CSS, score falso).
- **REQ-12** — The catálogo MUST mantener la entrada `rocas` existente sin modificar (juego distinto, sigue mock).

## Implementation plan

Cada paso deja la app ejecutable y commiteable. Antes de escribir código, `spec-impl` DEBE leer los docs de Next.js incluidos (`node_modules/next/dist/docs/01-app/`) — v16.2.9 más nueva que el training. Node ≥20 vía nvm (default 22).

1. **Assets del juego + contrato de tipos.** Copiar `references/started-games/02-asteroids/{index.html,game.js,favicon.svg}` a `public/games/asteroides/`. Crear `app/lib/games/bridge.ts` con los tipos del protocolo (`GameToHost`, `HostToGame`). → commit.
2. **Bridge dentro del juego.** Modificar `public/games/asteroides/game.js`: variable `paused` + freeze del update; listener de `message` (pause/resume/restart); emisión `postMessage` en `ready`, cambios de score/vidas/nivel/power-up y game-over; tecla `P` → toggle pausa + emitir `paused`. → commit (juego jugable standalone abriendo el html).
3. **Campo `embed` + entrada de catálogo.** Añadir `embed?: string` al tipo `Game`; añadir la entrada `asteroides` con `embed`. Dejar `rocas` intacto. → commit.
4. **Integración en `Player`.** Renderizar iframe cuando `game.embed`; efecto/hook que escucha el puente (valida origin, actualiza HUD score/vidas/nivel, abre modal en gameover) y envía pause/resume/restart; ocultar arena mock; botón PAUSA y modal cableados a los mensajes. Rama mock intacta cuando no hay `embed`. → commit final = acceptance.

## Acceptance criteria

- **AC-01 (happy path, REQ-01/02/03)** — Given la entrada `asteroides` con `embed`, When navego a `/jugar/asteroides`, Then el Player renderiza el iframe del juego (canvas jugable) y NO la arena mock.
- **AC-02 (HUD real, REQ-05)** — Given el juego corriendo, When destruyo asteroides y gano puntos/pierdo vidas, Then el HUD React muestra el score, vidas y nivel reales del juego (no el score falso aleatorio).
- **AC-03 (game-over, REQ-06)** — Given 0 vidas, When el juego emite `gameover`, Then el modal de fin abre con el score final real.
- **AC-04 (pausa desde plataforma, REQ-07)** — Given el juego corriendo, When pulso el botón PAUSA del Player, Then la física del juego se congela; al REANUDAR, continúa donde estaba.
- **AC-05 (pausa con tecla P + sync, REQ-08)** — Given foco en el juego, When pulso `P`, Then el juego pausa/reanuda y el botón del Player refleja el estado (queda en sync).
- **AC-06 (reinicio, REQ-09)** — Given el modal de game-over, When pulso "JUGAR DE NUEVO", Then el juego reinicia a score 0 / 3 vidas / nivel 1 y el HUD se resetea.
- **AC-07 (edge: origen inválido, REQ-10)** — Given un `postMessage` de origen distinto al de la app, When llega al Player, Then se ignora (no muta HUD ni abre modal).
- **AC-08 (edge: juego mock intacto, REQ-11)** — Given `rocas` (sin `embed`), When navego a `/jugar/rocas`, Then se muestra la arena mock actual con score falso, sin iframe.
- **AC-09 (edge: no-mezcla, REQ-12)** — Given el catálogo, Then existen `asteroides` (con `embed`) y `rocas` (sin `embed`) como entradas separadas; `rocas` sin modificar.
- **AC-10 (build)** — `npm run build` compila sin errores de tipos ni lint; `/jugar/asteroides` y `/jugar/rocas` renderizan.

## Non-functional requirements

- **NFR-01 (rendimiento).** El juego MUST correr a ≥ 55 FPS (fotogramas por segundo) en el iframe con el loop `requestAnimationFrame` (el mismo que standalone) — sin degradación medible por el embebido.
- **NFR-02 (latencia del puente).** Un cambio de estado del juego MUST reflejarse en el HUD React en ≤ 1 fotograma percibido (≤ ~50 ms) — `postMessage` es asíncrono pero intra-página.
- **NFR-03 (aislamiento).** Los globals del juego (`keys`, `getElementById('canvas')`, loop) MUST NOT filtrarse al documento de la plataforma (garantizado por el iframe).

## Decisiones tomadas y descartadas

### D-01 · iframe en vez de portar el juego a React
- **Contexto:** el juego usa `document`/`window` globales y su propio loop.
- **Decisión:** embeber vía iframe (marco aislado).
- **Consecuencias:** aislamiento total, juego sin reescribir, comunicación por `postMessage`.
- **Descartado:** portar 510 líneas a un componente con `canvas ref` (referencia) — reescritura grande y globals filtrándose entre juegos.

### D-02 · `embed?: string` en `Game` como única fuente de verdad
- **Contexto:** distinguir juegos jugables de mocks.
- **Decisión:** un campo en el catálogo.
- **Consecuencias:** Player decide iframe vs mock leyendo `embed`; portar otro juego = añadir su `embed`.
- **Descartado:** registro aparte — duplica la lista de juegos.

### D-03 · Puente bidireccional con protocolo tipado en `bridge.ts`
- **Contexto:** juego↔React deben comunicar estado y control.
- **Decisión:** contrato `postMessage` tipado, reusable.
- **Consecuencias:** HUD y game-over movidos por eventos reales; base para futuros juegos.
- **Descartado:** acoplar el Player a variables internas del juego — imposible cruzando el borde del iframe.

### D-04 · Pausa implementada en el juego, controlada por el contenedor
- **Contexto:** el juego no tenía pausa.
- **Decisión:** añadir `paused` al loop del juego; disparada por botón del Player (`pause`/`resume`) y por tecla `P`, con sync vía `{type:'paused'}`.
- **Consecuencias:** una sola lógica de pausa (en el juego), dos disparadores sincronizados.
- **Descartado:** pausar "por fuera" congelando el iframe — no existe API para congelar un `requestAnimationFrame` ajeno sin cooperación del juego.

### D-05 · `asteroides` nuevo, `rocas` intacto; portada reusada
- **Contexto:** ya hay un mock parecido (`rocas`).
- **Decisión:** entrada nueva `asteroides` con `id` propio; `rocas` sin tocar; `cover: "cover-rocas"` reusado (solo estilo visual, sin acoplar lógica/id).
- **Consecuencias:** coexisten sin mezclarse.
- **Descartado:** reemplazar `rocas` — el usuario pidió explícitamente no mezclarlos.

### D-06 · Guardado sigue mock
- **Contexto:** no hay tabla de puntuaciones aún.
- **Decisión:** el modal pasa el score real pero "guarda" mock.
- **Consecuencias:** persistencia real queda para el spec de leaderboard.
- **Descartado:** persistir ya — depende de tablas/RLS (Row Level Security) inexistentes.

## Risks

| Riesgo | Mitigación |
|---|---|
| Foco del teclado no entra al iframe → controles no responden | Autofocus del iframe al cargar/click; documentar en el bridge |
| Carrera: Player envía comandos antes de que el juego cargue | Handshake `ready` (REQ-04): no enviar hasta recibirlo |
| Doble game-over (mock + real) | Al haber `embed`, el loop mock de score se desactiva por completo (REQ-03) |

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm run build` → verde (AC-10).
2. `npm run dev` + navegar a `/jugar/asteroides` → el canvas del juego responde a teclado; jugar y ver el HUD React actualizándose con score/vidas/nivel reales (AC-01/02).
3. Pulsar PAUSA → la física se congela; tecla `P` → sync del botón (AC-04/05).
4. Perder las 3 vidas → modal con score real; "JUGAR DE NUEVO" reinicia (AC-03/06).
5. Navegar a `/jugar/rocas` → arena mock intacta, sin iframe (AC-08/09).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01/02 | AC-01 | `public/games/asteroides/`, `games.ts` | build + navegar |
| REQ-03 | AC-01 | `Player.tsx` (rama iframe) | render |
| REQ-04 | AC-01 | bridge `ready` | consola/red |
| REQ-05 | AC-02 | bridge score/lives/level | jugar |
| REQ-06 | AC-03 | bridge gameover | perder vidas |
| REQ-07 | AC-04 | `game.js` pausa + Player | botón PAUSA |
| REQ-08 | AC-05 | `game.js` tecla P | tecla P |
| REQ-09 | AC-06 | bridge restart | modal |
| REQ-10 | AC-07 | validación `origin` | mensaje falso |
| REQ-11 | AC-08 | `Player.tsx` (rama mock) | `/jugar/rocas` |
| REQ-12 | AC-09 | `games.ts` | inspección |

## Qué NO está en este spec

Persistencia real de puntuación (tabla `scores`, Supabase, RLS — Row Level Security), portar otros juegos (`rocas` / `caida` / `serpentina` / …), controles táctiles, sonido, cambios de jugabilidad del juego original, responsividad avanzada del canvas.
