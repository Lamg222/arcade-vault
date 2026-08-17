# GJ — Juego Rana Turnos (Frogger por turnos, avance infinito) embebido y puenteado

- **Estado:** Draft candidato game-jam
- **Fecha:** 2026-08-17
- **Dependencias:** 05-juego-asteroides (patrón de embed iframe + puente `postMessage`), 06-leaderboard-supabase (tabla `scores`, FK `game_id → games.id`, `saveScore`)
- **Objetivo (una frase):** Añadir a Arcade Vault un Frogger con un **giro por turnos** de id `rana-turnos`: el mundo (coches, troncos) solo avanza **un paso discreto cada vez que la rana actúa** (se mueve o espera), convirtiendo el clásico de reflejos en un **puzzle de planificación** con carriles procedurales infinitos hacia arriba y score = distancia máxima alcanzada; construido de cero (como `snake`), embebido en un iframe servido desde `public/games/rana-turnos/`, usando el puente `postMessage` genérico ya existente sin tocarlo.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.

## Contexto y encaje (por qué este giro)

El tema del jam es Frogger (esquiva-y-avanza). El **Frogger canónico de reflejos** (tiempo real, tráfico que fluye continuo, cronómetro) lo cubre otra propuesta. Este spec toma el **mismo tema con una mecánica realmente distinta**: **tiempo discreto por turnos**. Nada se mueve en tiempo real; el tráfico y el río avanzan **exactamente un paso** cada vez que el jugador decide una acción (mover en una de 4 direcciones, o esperar en el sitio). El reto deja de ser el pulso del jugador y pasa a ser **leer el tablero y planificar la secuencia de saltos** — un puzzle determinista y justo (toda muerte es un error de planificación, nunca de reflejos), estilo puzzle-roguelite por turnos.

El género aportado (**puzzle por turnos sobre rejilla móvil**) no solapa con ninguno de los juegos reales (disparo vectorial `asteroides`, piezas que caen `tetris`, paleta-y-bola `arkanoid`, serpiente `snake`) ni con el Frogger de reflejos de la otra propuesta. Encaja con el contrato del puente sin tocarlo:

- **Estático embebible** — HTML + JS servidos como estáticos desde `public/games/rana-turnos/`, sin backend propio. ✔
- **Canvas + loop** — un `<canvas>` con loop `requestAnimationFrame` que renderiza y anima la interpolación (*tween*) del salto; en él se inyectan `emitState()` y el *freeze* (congelado) de pausa. La física es discreta (avanza por acción del jugador), pero el loop sigue vivo para dibujo/animación. ✔
- **Teclado** — 4 flechas (mover una celda / gastar un turno) + `Espacio` (esperar un turno) + `P` (pausa). ✔
- **Score entero creciente** — `score` = fila máxima alcanzada (distancia); entero ≥ 0 y monótono (no baja al retroceder). ✔
- **Game-over detectable** — `gameOver` es `true` cuando la rana muere (atropello / ahogo). Muerte permanente por run (1 vida): un error termina la partida. ✔
- **Init/restart** — `initGame()` resetea a score 0, 1 vida, nivel 1, tablero nuevo. ✔
- **Jugable standalone** — el puente es inerte sin `parent` (bloque `try/catch`); el `index.html` suelto sigue jugándose. ✔

Existe ya en el catálogo la entrada **mock** `ranaria` (ARCADE, `cover-rana`, tema rana/autopista). Se mantiene intacta; el juego real es una entrada nueva `rana-turnos`, igual que `asteroides` convive con el mock `rocas` (spec 05, D-05).

### Veredicto de encaje: **ENCAJA**

El giro por turnos NO exige ningún cambio a la plataforma ni al contrato del puente: sigue siendo un `<canvas>` con `requestAnimationFrame`, teclado, un único `score` entero creciente, `gameOver` booleano, `initGame()` y `paused`. El modelo de leaderboard (un score entero creciente por partida = distancia) encaja limpio y de hecho **mejora el gancho competitivo**: al ser determinista y sin reflejos, la tabla premia la calidad de planificación pura, no la latencia de reacción — highscore de puro *skill*. No se toca `Player.tsx`, `scores.ts`, `bridge.ts`, `HallOfFame.tsx`, `Leaderboard.tsx` ni los clientes Supabase.

## Scope

**En scope:**
- Construir de cero `public/games/rana-turnos/` (`index.html`, `game.js`, `favicon.svg`) — juego canvas jugable con teclado, sin dependencias externas ni assets pesados (todo dibujado con primitivas: rectángulos/formas y color).
- Motor **por turnos**: el mundo avanza un tick de simulación **solo** cuando el jugador ejecuta una acción (mover ↑↓←→ o esperar con `Espacio`). Sin acción → nada se mueve. Interpolación visual del salto y del deslizamiento de carriles vía `requestAnimationFrame` (solo animación, no física).
- **Generación procedural infinita** de filas hacia arriba: acera inicial · carriles de tráfico · franjas seguras · río con troncos/tortugas, generadas al vuelo a medida que la rana asciende (scroll de cámara hacia arriba). Dificultad escalada por distancia (nivel).
- Inyectar el puente (espejo del contrato de `app/lib/games/bridge.ts`): handshake `ready`, emit-por-diferencia de `score`/`lives`/`level`, `gameover` en el flanco de subida, `setPaused` + emit `paused`, listener de `pause`/`resume`/`restart`, y `P` como toggle de pausa. Mismo patrón que `public/games/snake/game.js`.
- Nueva entrada `rana-turnos` en el catálogo `GAMES` (`app/data/games.ts`) con `embed`, `best: 0`, `plays: "0"`.
- Migración aditiva idempotente que inserta la fila `rana-turnos` en la tabla `games` (para que la FK `game_id` acepte sus scores).
- Verificación end-to-end (build + jugar + HUD + leaderboard).

**NO en scope (specs futuros):**
- Modificar los archivos genéricos de plataforma: `Player.tsx`, `scores.ts`, `HallOfFame.tsx`, `Leaderboard.tsx`, `bridge.ts`, `supabase/{client,server}.ts`. Si el juego pareciera exigirlo, es otra spec.
- Controles táctiles (la plataforma hoy es solo teclado; swipe/d-pad es otra spec — ver Risks).
- Modo **semilla diaria** (tablero determinista compartido por seed para competir en igualdad exacta) — gancho competitivo potente pero requiere UI/almacenar seed; se registra como extensión futura (ver D-05).
- Sonido, sprites bitmap, animaciones de muerte elaboradas.
- Tocar el mock `ranaria` (o cualquier otra entrada existente).

## Data model

**Cambios de datos (sin esquema nuevo — la maquinaria de leaderboard ya es genérica):**

- **Nueva entrada `GAMES`** en `app/data/games.ts`:
  - `id: "rana-turnos"`, `title: "RANA TÁCTICA"`, `cat: "PUZZLE"`, `color: "magenta"`
  - `short: "Frogger por turnos: el tráfico solo avanza cuando tú te mueves."`
  - `long: "Un Frogger de puzzle: nada se mueve en tiempo real. Cada salto de la rana hace avanzar el mundo un paso — los coches y los troncos ruedan una casilla por cada acción tuya. Lee el tablero, planea la secuencia y asciende por carriles generados sin fin; puedes esperar en el sitio para dejar pasar un coche. La distancia recorrida es tu puntuación y una sola muerte termina la carrera: aquí no fallan los reflejos, falla el plan."`
  - `cover: "cover-rana"` (reusa la portada del mock `ranaria` — solo estilo visual, sin acoplar id ni lógica; igual que `asteroides` reusa `cover-rocas`)
  - `embed: "/games/rana-turnos/index.html"`, `best: 0`, `plays: "0"`
- **Fila semilla en la tabla `games`** (Supabase), vía migración aditiva, con los mismos valores (`id`, `title`, `cat`, `cover`, `color`, `embed`). Sin ella, todo `insert` en `scores` con `game_id='rana-turnos'` es rechazado por la FK (clave foránea).
- **Contrato del puente**: **sin cambios**. `rana-turnos` usa el subconjunto `ready` · `score` · `lives` · `level` · `paused` · `gameover` (Juego→Host) y `pause` · `resume` · `restart` (Host→Juego). No usa `powerup` (opcional; el HUD lo tolera). Aunque hay muerte permanente (1 vida), se emite `lives` (valor `1` → `0`) para que el HUD muestre el estado; el contrato lo tolera igual que `snake` (que omite `lives`).

## Mapeo de los 5 anchors del puente (game.js aún no existe — así serán)

El puente se engancha a cinco puntos del `game.js`. Como se construye de cero, se diseñan explícitamente para existir con estos nombres/forma (patrón `snake`):

### 1. Variables de estado — score / lives / level
- `let score = 0;` — entero creciente = **fila máxima alcanzada** (`maxRow`). Se actualiza `score = Math.max(score, maxRow)` tras cada avance; **no** decrece al retroceder ni al esperar. (MAY sumar un pequeño bonus por recoger monedas opcionales en franjas seguras — extensión, no requisito.)
- `let lives = 1;` — muerte permanente por run: decrementa a `0` en la única muerte y dispara el game-over. Se emite para el HUD.
- `let level = 1;` — nivel de dificultad = `Math.floor(maxRow / 10) + 1`; a más nivel, carriles con más vehículos y troncos más cortos/espaciados. Se recalcula al cruzar cada umbral.

### 2. Loop principal
- `function loop(ts) { ... requestAnimationFrame(loop); }`. El loop **solo anima e interpola** (el *tween* del salto de la rana y el deslizamiento de una casilla de los carriles cuando se ejecutó un turno) y llama `emitState()` una vez por frame. **La física es por turnos**: un turno se procesa en `stepWorld()`, invocado **solo** desde el handler de teclado cuando el jugador actúa. La sección de animación va **gated** (condicionada) por `!paused && !gameOver`.

### 3. Expresión de game-over
- `let gameOver = false;` que pasa a `true` cuando la rana muere en un turno: la casilla destino queda ocupada por un vehículo tras el paso del mundo (atropello), o la rana queda sobre agua sin tronco (ahogo). `emitState()` emite `{type:'gameover', score}` solo en el flanco de subida (`gameOver && !lastEmit.over`).

### 4. Init / restart
- `function initGame() { score=0; lives=1; level=1; gameOver=false; maxRow=0; seedWorld(); resetFrog(); }` — invocada al cargar y al recibir `restart`. `seedWorld()` genera las primeras filas procedurales; a partir de ahí las filas se generan al vuelo al ascender.

### 5. Flag de pausa
- `let paused = false;` alternada por `setPaused(next)` (emite `{type:'paused', value}`) desde la tecla `P` y desde los comandos `pause`/`resume` del host. En pausa se ignora la entrada de juego y se congela el *tween* en curso.

## Requirements (EARS + RFC 2119)

- **REQ-01** — The system MUST servir el juego desde `public/games/rana-turnos/` (`index.html`, `game.js`, `favicon.svg`) como estáticos accesibles en `/games/rana-turnos/index.html`.
- **REQ-02** — The game MUST ser jugable solo con teclado: flechas ↑↓←→ mueven la rana una celda por pulsación y `Espacio` gasta un turno sin moverse; `P` alterna pausa.
- **REQ-03** — The game MUST avanzar el mundo (coches, troncos) **exactamente un paso discreto por cada acción del jugador** (mover o esperar), y MUST NOT mover ninguna entidad mientras no haya acción — no hay simulación en tiempo real.
- **REQ-04** — The game MUST mantener un `score` entero ≥ 0 igual a la fila máxima alcanzada, que crece al ascender y MUST NOT decrecer al retroceder o esperar.
- **REQ-05** — The game MUST modelar muerte permanente (`lives = 1`): la rana muere y termina la partida si, tras el paso del mundo del turno, su casilla queda ocupada por un vehículo (atropello) o está sobre agua sin tronco (ahogo).
- **REQ-06** — The game MUST generar filas proceduralmente hacia arriba de forma indefinida (acera · carriles · franjas seguras · río), de modo que cada partida sea jugable sin fin fijo, y cada tablero MUST ser siempre resoluble (esperar es siempre una acción legal).
- **REQ-07** — When `maxRow` cruza un umbral de nivel (cada 10 filas), the game MUST subir de nivel y aumentar la densidad/velocidad de los carriles generados a partir de ahí.
- **REQ-08** — When el juego carga, the game bridge MUST emitir `{type:'ready'}` (handshake antes de recibir comandos).
- **REQ-09** — When cambian `score`, `lives` o `level`, the game bridge MUST emitir el mensaje correspondiente por diferencia (solo si cambió el valor).
- **REQ-10** — When `lives` llega a 0, the game bridge MUST emitir `{type:'gameover', score}` una sola vez (flanco de subida de `gameOver`).
- **REQ-11** — When el host envía `pause`/`resume`, the game MUST congelar/reanudar (ignorar entrada de juego y congelar el *tween*) sin cerrarse; y `P` MUST alternar pausa emitiendo `{type:'paused', value}` para sincronizar el botón del Player.
- **REQ-12** — When el host envía `restart`, the game MUST reiniciar a score 0 / 1 vida / nivel 1 con tablero nuevo vía `initGame()`.
- **REQ-13** *(unwanted)* — If el juego se abre standalone (sin `parent`, p.ej. `file://`), then el puente MUST ser inerte (envolver `window.parent.postMessage` en `try/catch`) y el juego MUST seguir jugándose.
- **REQ-14** — The catálogo `GAMES` MUST ganar la entrada `rana-turnos` con `embed`, `best: 0`, `plays: "0"`, y MUST NOT modificar la entrada mock `ranaria` ni ninguna otra.
- **REQ-15** — The base de datos MUST tener una fila `games.id = 'rana-turnos'` (migración aditiva idempotente) antes de que se acepte cualquier score; el spec NO edita migraciones ya aplicadas.
- **REQ-16 (NFR)** — The game MUST sostener ≥ 55 FPS (fotogramas por segundo) en el iframe con `requestAnimationFrame` (el loop solo dibuja/interpola; la física discreta lo hace holgado).

## Implementation plan

Alineado con las 5 fases de `/add-game`, adaptado a *construir de cero* (no hay carpeta en `references/started-games/`, como pasó con `snake`). Cada fase deja la app ejecutable y commiteable; pausa para revisión de diff tras cada una. Antes de tocar nada bajo `app/`, leer los docs Next.js incluidos (`node_modules/next/dist/docs/01-app/`, v16.2.9). Node ≥ 20 vía nvm.

1. **Autoría del juego canvas por turnos (standalone, sin puente).** Crear `public/games/rana-turnos/{index.html,game.js,favicon.svg}`: canvas, modelo de rejilla con `maxRow`/cámara; `seedWorld()` + generación procedural de filas al ascender (acera · carriles de tráfico con offset entero por fila · franjas seguras · río con troncos/tortugas); `stepWorld()` que desplaza cada carril una casilla y evalúa atropello/ahogo; entrada por turnos (flechas mueven + gastan turno, `Espacio` espera); interpolación visual (*tween*) del salto y del deslizamiento; `score`/`lives`/`level`, `gameOver`, `initGame()`, `paused`. Jugable abriendo el `index.html`. → commit.
2. **Inyección del puente.** Añadir al final de `game.js` el bloque espejo de `snake`: `postToHost` (con `try/catch`), `emitState()` por diferencia (`score`/`lives`/`level` + `gameover` en flanco), `setPaused`, listener `message` con validación `e.origin === window.location.origin` (pause/resume/restart), y `postToHost({type:'ready'})`. Cablear `P` → `setPaused(!paused)`, `grabFocus()` del canvas (patrón `snake`) y `emitState()` una vez por frame. Confirmar que sigue jugándose standalone (puente inerte). → commit.
3. **Entrada de catálogo.** Añadir la entrada `rana-turnos` a `GAMES` (`app/data/games.ts`) con los campos del Data model. No tocar `ranaria` ni otras. → commit.
4. **Semilla en Supabase.** Crear migración aditiva `supabase/migrations/0005_seed_rana_turnos.sql` (siguiente número libre) con `insert ... on conflict (id) do nothing`, valores iguales a la entrada de catálogo. Indicar al usuario que la aplique (CLI o SQL Editor); no es verificable hasta entonces. → commit.
5. **Verificación (aceptación).** `npm run build` verde; `npm run dev` → `/jugar/rana-turnos` renderiza el iframe (no arena mock), responde a teclado, el mundo avanza solo al actuar, el HUD refleja score/vidas/nivel reales, `P` y botón PAUSA en sync, game-over abre el modal con score real; guardar inserta fila en `scores` y aparece en `/juego/rana-turnos` y `/salon`. → commit final.

## Acceptance criteria

- **AC-01 (happy path, REQ-01/14)** — Given la entrada `rana-turnos` con `embed`, When navego a `/jugar/rana-turnos`, Then el Player renderiza el iframe del juego (canvas jugable) y NO la arena mock.
- **AC-02 (turnos + score, REQ-02/03/04)** — Given el juego corriendo, When no pulso ninguna tecla, Then ningún coche ni tronco se mueve; When avanzo la rana hacia arriba, Then el mundo avanza un paso, la rana sube una celda y el `score` del HUD crece; retroceder o esperar no lo baja.
- **AC-03 (esperar un turno, REQ-02/03)** — Given un coche a punto de ocupar mi casilla destino, When pulso `Espacio`, Then la rana se queda y el mundo avanza un paso (el coche pasa), sin morir.
- **AC-04 (muerte permanente, REQ-05/10)** — Given la rana en un carril o sobre el río, When tras mi acción un coche ocupa su casilla o queda sobre agua sin tronco, Then muere, `lives` pasa a 0, se emite `gameover` una sola vez y el modal abre con el score final real.
- **AC-05 (nivel por distancia, REQ-07)** — Given `maxRow` cruzando un múltiplo de 10, When asciendo el umbral, Then subo de nivel y los carriles generados a partir de ahí son más densos/rápidos (el HUD muestra el nivel nuevo).
- **AC-06 (infinito y resoluble, REQ-06)** — Given cualquier estado de juego, When observo el tablero, Then siempre hay filas nuevas generadas arriba y `Espacio` es una acción legal (nunca hay bloqueo forzado por reflejos).
- **AC-07 (pausa bidireccional + sync, REQ-11)** — Given el juego corriendo, When pulso el botón PAUSA del Player o la tecla `P`, Then se ignora la entrada de juego y el *tween* se congela, y el estado del botón queda en sync; al reanudar continúa donde estaba.
- **AC-08 (reinicio, REQ-12)** — Given el modal de game-over, When pulso "JUGAR DE NUEVO", Then el juego reinicia a score 0 / 1 vida / nivel 1 con tablero nuevo y el HUD se resetea.
- **AC-09 (standalone, REQ-13)** — Given el `index.html` abierto suelto (sin parent), When juego, Then funciona sin errores de consola por el puente (inerte).
- **AC-10 (leaderboard, REQ-15)** — Given la migración aplicada, When guardo un score con nombre al terminar, Then aparece una fila en `scores` y el score se ve en `/juego/rana-turnos` (Leaderboard) y en `/salon` (Hall of Fame).
- **AC-11 (no-mezcla, REQ-14)** — Given el catálogo, Then coexisten `rana-turnos` (con `embed`) y el mock `ranaria` (sin `embed`) como entradas separadas; `ranaria` sin modificar.
- **AC-12 (build)** — `npm run build` compila sin errores de tipos ni lint.

## Non-functional requirements

- **NFR-01 (rendimiento).** ≥ 55 FPS en el iframe con `requestAnimationFrame`; el loop solo dibuja e interpola unas pocas decenas de rectángulos (coches, troncos, rana) y la física es discreta por acción, así que el margen es amplio.
- **NFR-02 (latencia del puente).** Un cambio de estado se refleja en el HUD React en ≤ ~50 ms (≤ 1 frame percibido); `postMessage` es asíncrono pero intra-página.
- **NFR-03 (aislamiento).** Los globals del juego (`keys`, `canvas`, loop) no se filtran al documento de la plataforma (garantizado por el iframe).
- **NFR-04 (sin assets pesados).** Cero imágenes/audio externos; todo dibujado con primitivas de canvas. El bundle del juego son 3 archivos de texto.
- **NFR-05 (justicia/determinismo).** El resultado de cada turno MUST ser función determinista del estado + la acción (sin aleatoriedad dentro del turno); la única aleatoriedad está en la generación de filas nuevas, siempre resolubles. Esto es lo que hace el leaderboard un ranking de planificación pura.

## Decisiones tomadas y descartadas

### D-01 · Giro por turnos frente al Frogger de reflejos
- **Contexto:** el jam pide una propuesta B con mecánica realmente distinta del Frogger canónico (que cubre otra propuesta).
- **Decisión:** tiempo discreto — el mundo avanza un paso por acción del jugador; `Espacio` para esperar.
- **Consecuencias:** el reto es planificar, no reaccionar; toda muerte es un error de plan (justo, determinista); el leaderboard mide *skill* de planificación, no latencia — gancho competitivo limpio y original.
- **Descartado:** ritmo/beats (interesante pero sigue siendo timing en tiempo real, más cerca del reflejo); invertir el control (manejar el tráfico) — rompe el modelo de "un score de distancia" y complica el encaje del leaderboard.

### D-02 · Score = distancia (fila máxima), avance infinito
- **Contexto:** el leaderboard modela un único score entero creciente por partida.
- **Decisión:** carriles procedurales infinitos hacia arriba; `score = maxRow`, monótono.
- **Consecuencias:** encaje perfecto con el modelo de leaderboard; muerte permanente por run hace cada carrera tensa y comparable; sin fin artificial que corte la progresión.
- **Descartado:** nidos/niveles fijos con completado (como el Frogger de reflejos) — el avance infinito da un highscore-chaser más puro para el ranking.

### D-03 · Construir de cero (como `snake`), no `/add-game`
- **Contexto:** no existe `references/started-games/*rana*`/`*frog*`; `/add-game` copia de ahí.
- **Decisión:** autoría desde cero de los 3 archivos, luego inyectar el puente con el mismo patrón que `snake`.
- **Consecuencias:** el spec cubre la fase de autoría (Fase 1); el resto (puente, catálogo, semilla, verificación) es idéntico al flujo `/add-game`.
- **Descartado:** buscar un clon de terceros — dependencias/licencias/estilo inconsistente; el patrón canvas-primitivas de la casa es trivial para este juego.

### D-04 · Entrada nueva `rana-turnos`, mock `ranaria` intacto; portada reusada
- **Contexto:** ya hay un mock temático de rana (`ranaria`) y otra propuesta usaría `frogger`.
- **Decisión:** id real `rana-turnos` (no colisiona con `GAMES`, con `public/games/`, ni con los ids reservados del jam: `frogger`, `ranaria`, `salta-carril`, `cruce-rana`, `saltarana`, `brinco`), `ranaria` sin tocar, `cover: "cover-rana"` reusado (solo visual), `cat: "PUZZLE"` para reflejar el giro de puzzle por turnos.
- **Consecuencias:** coexisten sin mezclarse, igual que `asteroides`/`rocas`; la categoría PUZZLE lo separa visualmente del Frogger ARCADE de reflejos.
- **Descartado:** reescribir el mock `ranaria` in situ — rompería el paralelismo establecido y arrastraría sus stats falsas (`best: 18900`, `plays: "6.4K"`).

### D-05 · Semilla aleatoria por run ahora; modo semilla diaria como extensión
- **Contexto:** un highscore justo puede querer que todos jueguen el mismo tablero.
- **Decisión:** MVP con generación aleatoria por partida (frescura y rejugabilidad); dejar el "reto diario" (seed compartida) como extensión futura fuera de scope.
- **Consecuencias:** el leaderboard sigue siendo comparable porque el motor es determinista y las filas siempre resolubles; la semilla diaria añadiría igualdad exacta pero exige UI/almacenar el seed.
- **Descartado:** meter la semilla diaria en el MVP — amplía el scope sin ser necesario para encajar con la plataforma.

## Risks

### Foco del teclado no entra al iframe
- Mitigación: el Player ya gestiona autofocus del iframe (patrón de spec 05); el juego hace `grabFocus()` del canvas al cargar/`pointerdown`, como `snake`.

### Carrera: el host envía comandos antes de que el juego cargue
- Mitigación: handshake `ready` (REQ-08); el Player no envía hasta recibirlo (comportamiento genérico ya implementado).

### El motor por turnos podría confundir a quien espera un Frogger de reflejos
- Mitigación: `short`/`long` del catálogo lo dejan explícito ("el tráfico solo avanza cuando tú te mueves"); una línea de ayuda en pantalla ("Flechas: mover · Espacio: esperar") en el canvas al inicio. Ambos SHOULD, dentro del juego, sin tocar plataforma.

### Un tablero procedural imposible (bloqueo sin salida)
- Mitigación: reglas de generación que garantizan solubilidad — al menos un tronco/hueco alcanzable por fila de río y `Espacio` siempre legal (REQ-06); capar densidad máxima por nivel. Registrado como invariante de la generación (NFR-05).

### Ausencia de control táctil limita el alcance móvil
- Mitigación: fuera de scope aquí (transversal a toda la plataforma). Candidato a spec propia (d-pad/swipe → sintetizar las mismas pulsaciones de flecha + un botón de "esperar").

### La migración no se aplica y guardar falla por FK
- Mitigación: es esperado; reportar como "bloqueado en migración", no como bug (REQ-15). `on conflict do nothing` hace la migración re-ejecutable.

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm run build` → verde (AC-12).
2. `npm run dev` + `/jugar/rana-turnos` → sin pulsar nada, el tráfico está quieto; al mover, el mundo avanza un paso y el score sube en el HUD real; esperar con `Espacio` deja pasar un coche (AC-01/02/03).
3. Morir por atropello/ahogo → `lives` a 0, modal con score real emitido una sola vez (AC-04); "JUGAR DE NUEVO" reinicia a 0/1/1 con tablero nuevo (AC-08).
4. Ascender pasando un múltiplo de 10 filas → sube nivel, carriles más densos (AC-05); observar filas nuevas generándose arriba y `Espacio` siempre legal (AC-06).
5. Botón PAUSA y tecla `P` → entrada ignorada y *tween* congelado, en sync (AC-07).
6. Abrir el `index.html` suelto → juega sin errores de puente (AC-09).
7. Aplicar migración, guardar score con nombre → fila en `scores`, visible en `/juego/rana-turnos` y `/salon` (AC-10).
8. Inspección de catálogo → `rana-turnos` y `ranaria` separados, `ranaria` intacto (AC-11).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01 | AC-01 | `public/games/rana-turnos/` | build + navegar |
| REQ-02 | AC-02/03 | `game.js` (input por turnos) | jugar |
| REQ-03 | AC-02/03 | `game.js` (`stepWorld` por acción) | observar tráfico quieto |
| REQ-04 | AC-02 | `game.js` (`score = maxRow`) | ascender |
| REQ-05 | AC-04 | `game.js` (atropello/ahogo) | morir |
| REQ-06 | AC-06 | `game.js` (generación procedural) | inspección |
| REQ-07 | AC-05 | `game.js` (nivel por distancia) | cruzar umbral |
| REQ-08 | AC-01 | puente `ready` | consola/red |
| REQ-09 | AC-02 | `emitState()` por diferencia | jugar |
| REQ-10 | AC-04 | `emitState()` gameover (flanco) | morir |
| REQ-11 | AC-07 | `setPaused` + listener + `P` | PAUSA / P |
| REQ-12 | AC-08 | `initGame()` + restart | modal |
| REQ-13 | AC-09 | `postToHost` en `try/catch` | `file://` |
| REQ-14 | AC-11 | `app/data/games.ts` | inspección |
| REQ-15 | AC-10 | `supabase/migrations/0005_seed_rana_turnos.sql` | dashboard |
| REQ-16 (NFR-01) | — | `requestAnimationFrame` | medición FPS |

## Qué NO está en este spec

Controles táctiles (spec transversal futura), modo semilla diaria (extensión), sonido, sprites bitmap, persistencia distinta de la genérica del leaderboard, y cualquier cambio a los archivos genéricos de plataforma (`Player.tsx`, `scores.ts`, leaderboards, `bridge.ts`, clientes Supabase).
