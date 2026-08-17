# 07 — Juego Frogger (cruce de carriles) embebido y puenteado

- **Estado:** Draft (spec listo para construir)
- **Fecha:** 2026-08-17
- **Dependencias:** 05-juego-asteroides (patrón de embed iframe + puente `postMessage`), 06-leaderboard-supabase (tabla `scores`, FK `game_id → games.id`, `saveScore`)
- **Objetivo (una frase):** Añadir a Arcade Vault un juego canvas nuevo de tipo *cruce de carriles* (Frogger), de id `frogger`, construido de cero (no hay juego de referencia — como se hizo con `snake`), embebido en un iframe (marco HTML aislado) servido desde `public/games/frogger/`, con el puente `postMessage` (mensajería entre iframe y página) bidireccional ya genérico: el juego emite score/vidas/nivel/game-over al HUD (barra de estado) React y recibe pause/resume/restart del contenedor.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.

## Contexto y encaje (por qué este juego)

Los cuatro juegos reales actuales cubren cuatro géneros disjuntos: disparo vectorial (`asteroides`), puzzle de piezas que caen (`tetris`), paleta-y-bola (`arkanoid`) y serpiente-en-grilla (`snake`). Falta el género *dodge & advance* (esquiva y avanza): mover un avatar a través de carriles de obstáculos móviles sin disparar ni rebotar nada. Frogger es el arquetipo. No solapa mecánica con ningún juego real y encaja con el contrato del puente sin tocarlo:

- **Estático embebible** — HTML + JS servidos como estáticos desde `public/games/frogger/`, sin backend propio. ✔
- **Canvas + loop** — un `<canvas>` con loop `requestAnimationFrame` (repintado sincronizado con el refresco de pantalla) donde inyectar `emitState()` y el *freeze* (congelado) de pausa. ✔
- **Teclado** — 4 flechas para moverse rejilla-a-rejilla + tecla `P` de pausa. ✔
- **Score entero creciente** — puntúa avanzar filas y llegar a casa; entero ≥ 0. ✔
- **Game-over detectable** — `gameOver` es `true` cuando `lives` llega a 0. ✔
- **Init/restart** — `initGame()` resetea a score 0, 3 vidas, nivel 1. ✔
- **Jugable standalone** — el puente es inerte sin `parent` (bloque `try/catch`), el `index.html` suelto sigue jugándose. ✔

Existe ya en el catálogo la entrada **mock** `ranaria` (ARCADE, `cover-rana`, tema rana/autopista). Se mantiene intacta; el juego real es una entrada nueva `frogger`, igual que `asteroides` convive con el mock `rocas` (spec 05, D-05).

## Scope

**En scope:**
- Construir de cero `public/games/frogger/` (`index.html`, `game.js`, `favicon.svg`) — juego canvas jugable con teclado, sin dependencias externas ni assets pesados (todo dibujado con primitivas: rectángulos/formas y color).
- Inyectar el puente (espejo del contrato de `app/lib/games/bridge.ts`): handshake `ready`, emit-por-diferencia de `score`/`lives`/`level`, `gameover` en el flanco de subida, `setPaused` + emit `paused`, listener de `pause`/`resume`/`restart`, y `P` como toggle de pausa. Mismo patrón que `public/games/snake/game.js`.
- Nueva entrada `frogger` en el catálogo `GAMES` (`app/data/games.ts`) con `embed`, `best: 0`, `plays: "0"`.
- Migración aditiva idempotente que inserta la fila `frogger` en la tabla `games` (para que la FK `game_id` acepte sus scores).
- Verificación end-to-end (build + jugar + HUD + leaderboard).

**NO en scope (specs futuros):**
- Modificar los archivos genéricos de plataforma: `Player.tsx`, `scores.ts`, `HallOfFame.tsx`, `Leaderboard.tsx`, `bridge.ts`, `supabase/{client,server}.ts`. Si el juego pareciera exigirlo, es otra spec.
- Controles táctiles (la plataforma hoy es solo teclado; swipe/d-pad es otra spec — ver Risks).
- Sonido, sprites bitmap, animaciones de muerte elaboradas.
- Tocar el mock `ranaria` (o cualquier otra entrada existente).

## Data model

**Cambios de datos (sin esquema nuevo — la maquinaria de leaderboard ya es genérica):**

- **Nueva entrada `GAMES`** en `app/data/games.ts`:
  - `id: "frogger"`, `title: "FROGGER"`, `cat: "ARCADE"`, `color: "green"`
  - `short: "Cruza carriles de tráfico y un río de troncos sin morir."`
  - `long: "Guía a la rana desde la acera inferior hasta los cinco nidos de la orilla superior. Abajo esquivas carriles de coches que van a distinta velocidad y sentido; arriba saltas sobre troncos y tortugas a la deriva — si caes al agua, se acabó. Cada nido alcanzado suma puntos y, al llenar los cinco, subes de nivel y todo se acelera. Empiezas con 3 vidas y un cronómetro por travesía."`
  - `cover: "cover-rana"` (reusa la portada del mock `ranaria` — solo estilo visual, sin acoplar id ni lógica; igual que `asteroides` reusa `cover-rocas`)
  - `embed: "/games/frogger/index.html"`, `best: 0`, `plays: "0"`
- **Fila semilla en la tabla `games`** (Supabase), vía migración aditiva, con los mismos valores (`id`, `title`, `cat`, `cover`, `color`, `embed`). Sin ella, todo `insert` en `scores` con `game_id='frogger'` es rechazado por la FK (clave foránea).
- **Contrato del puente**: sin cambios. `frogger` usa el subconjunto `ready` · `score` · `lives` · `level` · `paused` · `gameover` (Juego→Host) y `pause` · `resume` · `restart` (Host→Juego). No usa `powerup` (opcional; el HUD lo tolera).

## Mapeo de los 5 anchors del puente (game.js aún no existe — así serán)

El puente se engancha a cinco puntos del `game.js`. Como se construye de cero, se diseñan explícitamente para existir con estos nombres/forma (patrón `snake`):

### 1. Variables de estado — score / lives / level
- `let score = 0;` — entero creciente. Suma: `+10` por fila nueva más alta alcanzada (no por retroceder), `+50` al llegar a un nido, `+bonus` por segundos restantes del cronómetro, `+bonus` al completar los 5 nidos (fin de nivel).
- `let lives = 3;` — decrementa en cada muerte (atropello, caída al agua, salir del tronco por el borde, o cronómetro agotado).
- `let level = 1;` — incrementa al llenar los 5 nidos; recalcula la velocidad base de los carriles.

### 2. Loop principal
- `function loop(ts) { ... requestAnimationFrame(loop); }` con paso por tiempo (`dt`) para el desplazamiento continuo de carriles/troncos. `emitState()` se llama una vez por frame; la sección de update (física de carriles, colisiones, cronómetro) va **gated** (condicionada) por `!paused && !gameOver`.

### 3. Expresión de game-over
- `let gameOver = false;` que pasa a `true` cuando `lives <= 0`. `emitState()` emite `{type:'gameover', score}` solo en el flanco de subida (`gameOver && !lastEmit.over`).

### 4. Init / restart
- `function initGame() { score=0; lives=3; level=1; gameOver=false; resetFrog(); buildLanes(level); resetTimer(); }` — invocada al cargar y al recibir `restart`.

### 5. Flag de pausa
- `let paused = false;` alternada por `setPaused(next)` (emite `{type:'paused', value}`) desde la tecla `P` y desde los comandos `pause`/`resume` del host.

## Requirements (EARS + RFC 2119)

- **REQ-01** — The system MUST servir el juego desde `public/games/frogger/` (`index.html`, `game.js`, `favicon.svg`) como estáticos accesibles en `/games/frogger/index.html`.
- **REQ-02** — The game MUST ser jugable solo con teclado: flechas ↑↓←→ mueven la rana una celda por pulsación (movimiento discreto en rejilla), y `P` alterna pausa.
- **REQ-03** — The game MUST mantener un `score` entero ≥ 0 que crece al avanzar filas y al alcanzar nidos, y MUST NOT decrecer por retroceder.
- **REQ-04** — The game MUST modelar 3 vidas y restar una en cada muerte (atropello en carril de tráfico, caída al agua, salir por el borde arrastrado por un tronco, o cronómetro de travesía agotado).
- **REQ-05** — When se llenan los 5 nidos de la orilla, the game MUST subir de nivel, reiniciar los nidos y aumentar la velocidad de los carriles.
- **REQ-06** — When el juego carga, the game bridge MUST emitir `{type:'ready'}` (handshake antes de recibir comandos).
- **REQ-07** — When cambian `score`, `lives` o `level`, the game bridge MUST emitir el mensaje correspondiente por diferencia (solo si cambió el valor).
- **REQ-08** — When `lives` llega a 0, the game bridge MUST emitir `{type:'gameover', score}` una sola vez (flanco de subida de `gameOver`).
- **REQ-09** — When el host envía `pause`/`resume`, the game MUST congelar/reanudar la física (carriles, cronómetro, colisiones) sin cerrarse; y `P` MUST alternar pausa emitiendo `{type:'paused', value}` para sincronizar el botón del Player.
- **REQ-10** — When el host envía `restart`, the game MUST reiniciar a score 0 / 3 vidas / nivel 1 vía `initGame()`.
- **REQ-11** *(unwanted)* — If el juego se abre standalone (sin `parent`, p.ej. `file://`), then el puente MUST ser inerte (envolver `window.parent.postMessage` en `try/catch`) y el juego MUST seguir jugándose.
- **REQ-12** — The catálogo `GAMES` MUST ganar la entrada `frogger` con `embed`, `best: 0`, `plays: "0"`, y MUST NOT modificar la entrada mock `ranaria` ni ninguna otra.
- **REQ-13** — The base de datos MUST tener una fila `games.id = 'frogger'` (migración aditiva idempotente) antes de que se acepte cualquier score; el spec NO edita migraciones ya aplicadas.
- **NFR/REQ-14** — The game MUST sostener ≥ 55 FPS (fotogramas por segundo) en el iframe con el mismo `requestAnimationFrame` que standalone.

## Implementation plan

Alineado con las 5 fases de `/add-game`, adaptado a *construir de cero* (no hay carpeta en `references/started-games/`, como pasó con `snake`). Cada fase deja la app ejecutable y commiteable; pausa para revisión de diff tras cada una. Antes de tocar nada bajo `app/`, leer los docs Next.js incluidos (`node_modules/next/dist/docs/01-app/`, v16.2.9). Node ≥ 20 vía nvm.

1. **Autoría del juego canvas (standalone, sin puente).** Crear `public/games/frogger/{index.html,game.js,favicon.svg}`: canvas, grilla de filas (acera inicial · carriles de tráfico · mediana segura · río con troncos/tortugas · orilla con 5 nidos), movimiento discreto de la rana con flechas, carriles móviles por `dt`, colisiones (atropello / agua / arrastre por tronco), cronómetro por travesía, `score`/`lives`/`level`, `gameOver`, `initGame()`, y `paused` en el loop. Jugable abriendo el `index.html`. → commit.
2. **Inyección del puente.** Añadir al final de `game.js` el bloque espejo de `snake`: `postToHost` (con `try/catch`), `emitState()` por diferencia, `setPaused`, listener `message` con validación `e.origin === window.location.origin` (pause/resume/restart), y `postToHost({type:'ready'})`. Cablear `P` → `setPaused(!paused)` y `emitState()` una vez por frame. Confirmar que sigue jugándose standalone (puente inerte). → commit.
3. **Entrada de catálogo.** Añadir la entrada `frogger` a `GAMES` (`app/data/games.ts`) con los campos del Data model. No tocar `ranaria` ni otras. → commit.
4. **Semilla en Supabase.** Crear migración aditiva `supabase/migrations/000N_seed_frogger.sql` (siguiente número libre) con `insert ... on conflict (id) do nothing`, valores iguales a la entrada de catálogo. Indicar al usuario que la aplique (CLI o SQL Editor); no es verificable hasta entonces. → commit.
5. **Verificación (aceptación).** `npm run build` verde; `npm run dev` → `/jugar/frogger` renderiza el iframe (no arena mock), responde a teclado, el HUD refleja score/vidas/nivel reales, `P` y botón PAUSA en sync, game-over abre el modal con score real; guardar inserta fila en `scores` y aparece en `/juego/frogger` y `/salon`. → commit final.

## Acceptance criteria

- **AC-01 (happy path, REQ-01/12)** — Given la entrada `frogger` con `embed`, When navego a `/jugar/frogger`, Then el Player renderiza el iframe del juego (canvas jugable) y NO la arena mock.
- **AC-02 (teclado + score, REQ-02/03)** — Given el juego corriendo, When avanzo la rana hacia arriba cruzando filas, Then la rana se mueve celda a celda y el `score` del HUD crece; retroceder no lo baja.
- **AC-03 (muertes y vidas, REQ-04)** — Given la rana en un carril de tráfico o sobre el agua, When la atropella un coche / cae al agua / sale por el borde en un tronco / se agota el cronómetro, Then pierde una vida y el HUD la refleja.
- **AC-04 (nivel, REQ-05)** — Given 4 nidos llenos, When ocupo el quinto, Then subo de nivel, los nidos se reinician y los carriles aceleran (el HUD muestra el nivel nuevo).
- **AC-05 (game-over, REQ-08)** — Given 1 vida, When muero, Then el juego emite `gameover` una sola vez y el modal de fin abre con el score final real.
- **AC-06 (pausa bidireccional + sync, REQ-09)** — Given el juego corriendo, When pulso el botón PAUSA del Player o la tecla `P`, Then la física (carriles/cronómetro) se congela y el estado del botón queda en sync; al reanudar continúa donde estaba.
- **AC-07 (reinicio, REQ-10)** — Given el modal de game-over, When pulso "JUGAR DE NUEVO", Then el juego reinicia a score 0 / 3 vidas / nivel 1 y el HUD se resetea.
- **AC-08 (standalone, REQ-11)** — Given el `index.html` abierto suelto (sin parent), When juego, Then funciona sin errores de consola por el puente (inerte).
- **AC-09 (leaderboard, REQ-13)** — Given la migración aplicada, When guardo un score con nombre al terminar, Then aparece una fila en `scores` y el score se ve en `/juego/frogger` (Leaderboard) y en `/salon` (Hall of Fame).
- **AC-10 (no-mezcla, REQ-12)** — Given el catálogo, Then coexisten `frogger` (con `embed`) y el mock `ranaria` (sin `embed`) como entradas separadas; `ranaria` sin modificar.
- **AC-11 (build)** — `npm run build` compila sin errores de tipos ni lint.

## Non-functional requirements

- **NFR-01 (rendimiento).** ≥ 55 FPS en el iframe con `requestAnimationFrame`; el número de entidades (unas pocas decenas de rectángulos: coches, troncos, tortugas, rana) hace esto holgado.
- **NFR-02 (latencia del puente).** Un cambio de estado se refleja en el HUD React en ≤ ~50 ms (≤ 1 frame percibido); `postMessage` es asíncrono pero intra-página.
- **NFR-03 (aislamiento).** Los globals del juego (`keys`, `canvas`, loop) no se filtran al documento de la plataforma (garantizado por el iframe).
- **NFR-04 (sin assets pesados).** Cero imágenes/audio externos; todo dibujado con primitivas de canvas. El bundle del juego son 3 archivos de texto.

## Decisiones tomadas y descartadas

### D-01 · Frogger frente a otros clásicos pendientes
- **Contexto:** el catálogo tiene mocks para Pac-Man (`gloton`), Space Invaders (`invasores`), Frogger (`ranaria`) y Pong (`duelo-pixel`).
- **Decisión:** portar Frogger.
- **Consecuencias:** aporta un género nuevo (esquiva-y-avanza) que no solapa con los 4 reales; encaja con el puente sin tocarlo; usa el modelo de leaderboard estándar (un score entero creciente).
- **Descartado:** `invasores` (Space Invaders) — es SHOOTER, mismo género que `asteroides`, solapa. `duelo-pixel` (Pong) — es VERSUS local a dos jugadores: no produce *un* score individual limpio para un leaderboard de máximas puntuaciones (mediría rondas ganadas, encaje forzado). `gloton` (Pac-Man) — encaja igual de bien pero es más costoso/arriesgado (mapa de laberinto + IA de 4 fantasmas con persecución); queda como respaldo.

### D-02 · Construir de cero (como `snake`), no `/add-game`
- **Contexto:** no existe `references/started-games/*frogger*`; `/add-game` copia de ahí.
- **Decisión:** autoría desde cero de los 3 archivos, luego inyectar el puente con el mismo patrón que `snake`.
- **Consecuencias:** el spec cubre la fase de autoría (Fase 1); el resto (puente, catálogo, semilla, verificación) es idéntico al flujo `/add-game`.
- **Descartado:** buscar un clon de terceros — dependencias/licencias/estilo inconsistente; el patrón canvas-primitivas de la casa es trivial para este juego.

### D-03 · Entrada nueva `frogger`, mock `ranaria` intacto; portada reusada
- **Contexto:** ya hay un mock temático de rana (`ranaria`).
- **Decisión:** id real `frogger` (no colisiona con `GAMES` ni con `public/games/`), `ranaria` sin tocar, `cover: "cover-rana"` reusado (solo visual).
- **Consecuencias:** coexisten sin mezclarse, igual que `asteroides`/`rocas`.
- **Descartado:** reescribir el mock `ranaria` in situ — rompería el paralelismo establecido y arrastraría sus stats falsas (`best: 18900`, `plays: "6.4K"`). Alternativa abierta: si se prefiere marca en español, renombrar la entrada real a título `RANARIA` manteniendo id `frogger` — decisión de naming, no técnica.

### D-04 · Movimiento discreto en rejilla, carriles continuos por `dt`
- **Contexto:** Frogger clásico mueve la rana celda a celda pero los vehículos fluyen.
- **Decisión:** rana en pasos discretos por pulsación; carriles/troncos con posición continua escalada por `dt` (delta de tiempo entre frames).
- **Consecuencias:** colisión rana-vehículo por solape de rectángulos; “ir sobre el tronco” = heredar el desplazamiento del tronco ese frame; salir del borde montado en tronco = muerte.
- **Descartado:** todo discreto por *ticks* — el flujo de tráfico se ve a tirones y baja la sensación arcade.

### D-05 · Cronómetro por travesía como cuarta causa de muerte
- **Contexto:** el Frogger original penaliza la lentitud y da bonus por tiempo restante.
- **Decisión:** cronómetro que, al agotarse, cuesta una vida; su remanente da bonus de score al llegar a un nido.
- **Consecuencias:** presiona a avanzar (mejores partidas, leaderboard más disputado) y aporta score además del avance.
- **Descartado:** sin tiempo — partidas pasivas y campeo; peor para un ranking de máximas.

## Risks

### Foco del teclado no entra al iframe
- Mitigación: el Player ya gestiona autofocus del iframe (patrón de spec 05); nada nuevo que hacer en el juego salvo `tabindex`/foco en el canvas al cargar, como los otros juegos.

### Carrera: el host envía comandos antes de que el juego cargue
- Mitigación: handshake `ready` (REQ-06); el Player no envía hasta recibirlo (comportamiento genérico ya implementado).

### Colisión sobre troncos con *tunneling* (atravesar sin detectar) a alta velocidad
- Mitigación: como la rana es discreta y los troncos anchos, evaluar solape por AABB (caja envolvente alineada a ejes) por frame basta; capear la velocidad máxima por nivel para que ningún tronco recorra más de su propio ancho por frame.

### Ausencia de control táctil limita el alcance móvil
- Mitigación: fuera de scope aquí (es transversal a toda la plataforma). Registrado como candidato a spec propia (d-pad/swipe → sintetizar las mismas pulsaciones de flecha).

### La migración no se aplica y guardar falla por FK
- Mitigación: es esperado; reportar como “bloqueado en migración”, no como bug (REQ-13). `on conflict do nothing` hace la migración re-ejecutable.

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm run build` → verde (AC-11).
2. `npm run dev` + `/jugar/frogger` → canvas responde a flechas; cruzar filas sube el score en el HUD real; morir por coche/agua/tiempo baja vidas (AC-01/02/03).
3. Llenar 5 nidos → sube nivel, carriles aceleran (AC-04).
4. Perder la última vida → modal con score real, emitido una sola vez (AC-05); "JUGAR DE NUEVO" reinicia a 0/3/1 (AC-07).
5. Botón PAUSA y tecla `P` → físicas congeladas y en sync (AC-06).
6. Abrir el `index.html` suelto → juega sin errores de puente (AC-08).
7. Aplicar migración, guardar score con nombre → fila en `scores`, visible en `/juego/frogger` y `/salon` (AC-09).
8. Inspección de catálogo → `frogger` y `ranaria` separados, `ranaria` intacto (AC-10).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01 | AC-01 | `public/games/frogger/` | build + navegar |
| REQ-02/03 | AC-02 | `game.js` (input + score) | jugar |
| REQ-04 | AC-03 | `game.js` (colisiones + cronómetro) | morir |
| REQ-05 | AC-04 | `game.js` (nidos + nivel) | llenar nidos |
| REQ-06 | AC-01 | puente `ready` | consola/red |
| REQ-07 | AC-02 | `emitState()` por diferencia | jugar |
| REQ-08 | AC-05 | `emitState()` gameover (flanco) | perder vida |
| REQ-09 | AC-06 | `setPaused` + listener + `P` | PAUSA / P |
| REQ-10 | AC-07 | `initGame()` + restart | modal |
| REQ-11 | AC-08 | `postToHost` en `try/catch` | `file://` |
| REQ-12 | AC-10 | `app/data/games.ts` | inspección |
| REQ-13 | AC-09 | `supabase/migrations/000N_seed_frogger.sql` | dashboard |
| REQ-14 (NFR-01) | — | `requestAnimationFrame` | medición FPS |

## Qué NO está en este spec

Controles táctiles (spec transversal futura), sonido, sprites bitmap, persistencia distinta de la genérica del leaderboard, y cualquier cambio a los archivos genéricos de plataforma (`Player.tsx`, `scores.ts`, leaderboards, `bridge.ts`, clientes Supabase). Portar los otros mocks (`gloton`/`invasores`/`duelo-pixel`) es cada uno su propia entrada.
