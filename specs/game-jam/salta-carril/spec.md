# SALTA CARRIL — Frogger clásico de acción/reflejos embebido y puenteado

- **Estado:** Draft candidato game-jam
- **Fecha:** 2026-08-17
- **Dependencias:** 05-juego-asteroides (patrón de embed iframe + puente `postMessage`), 06-leaderboard-supabase (tabla `scores`, FK — clave foránea — `game_id → games.id`, `saveScore`)
- **Objetivo (una frase):** Añadir a Arcade Vault un Frogger canónico de arcade puro (id `salta-carril`) — carriles de coches, río de troncos/tortugas, cronómetro por travesía, 3 vidas y niveles que aceleran — construido de cero como juego canvas, embebido en un iframe (marco HTML aislado) servido desde `public/games/salta-carril/`, usando el puente `postMessage` (mensajería entre iframe y página) genérico ya existente: el juego emite score/vidas/nivel/game-over al HUD (barra de estado) React y recibe pause/resume/restart del contenedor.

> Palabras clave RFC 2119: **MUST / MUST NOT / SHOULD / MAY** con significado normativo estándar.

## Contexto y encaje (por qué este juego)

Propuesta A del game-jam "Frogger": fidelidad al arcade original de 1981 — reflejo y timing puros, sin giro de género. Es un *dodge & advance* (esquiva y avanza) clásico: subir un avatar de abajo hacia arriba cruzando una zona de tráfico y un río, contra reloj, con dificultad que escala por nivel. No dispara ni rebota nada, así que no solapa mecánica con `asteroides` (SHOOTER vectorial), `tetris` (PUZZLE), `arkanoid` (paleta-y-bola) ni `snake` (serpiente-en-grilla). Encaja con el contrato del puente sin tocarlo:

- **Estático embebible** — HTML + JS servidos como estáticos desde `public/games/salta-carril/`, sin backend propio. ✔
- **Canvas + loop** — un `<canvas>` con loop `requestAnimationFrame` (repintado sincronizado con el refresco de pantalla) donde inyectar `emitState()` y el *freeze* (congelado) de pausa. ✔
- **Teclado** — 4 flechas para moverse celda a celda + tecla `P` de pausa. ✔
- **Score entero creciente** — puntúa avanzar filas, llegar a nidos, bonus de tiempo y bonus de nivel; entero ≥ 0. ✔
- **Game-over detectable** — `gameOver` es `true` cuando `lives` llega a 0. ✔
- **Init/restart** — `initGame()` resetea a score 0, 3 vidas, nivel 1. ✔
- **Jugable standalone** — el puente es inerte sin `parent` (bloque `try/catch`), el `index.html` suelto sigue jugándose. ✔

Existe ya en el catálogo la entrada **mock** `ranaria` (ARCADE, `cover-rana`, tema rana/autopista). Se mantiene intacta; el juego real es una entrada nueva `salta-carril`, igual que `asteroides` convive con el mock `rocas` (spec 05, D-05). El id `frogger` está reservado por otra propuesta del jam (spec 07); este borrador usa id propio `salta-carril` para no colisionar con `GAMES` ni con `public/games/`.

## Scope

**En scope:**
- Construir de cero `public/games/salta-carril/` (`index.html`, `game.js`, `favicon.svg`) — juego canvas jugable con teclado, sin dependencias externas ni assets pesados (todo dibujado con primitivas: rectángulos/formas y color).
- Tablero canónico: acera inicial · 5 carriles de tráfico (coches/camiones a distinta velocidad y sentido, incluyendo un carril rápido) · mediana segura · río con 5 filas de troncos y tortugas (algunas tortugas que **se sumergen** periódicamente) · orilla superior con 5 nidos.
- Cronómetro por travesía (barra que se agota); su remanente da bonus de score al llegar a un nido, y agotarlo cuesta una vida.
- Niveles que aceleran: al llenar los 5 nidos, sube el nivel, se reinician los nidos, aumenta la velocidad base de carriles/río y se acorta el cronómetro (con un tope de velocidad por seguridad de colisión).
- Inyectar el puente (espejo del contrato de `app/lib/games/bridge.ts`): handshake `ready`, emit-por-diferencia de `score`/`lives`/`level`, `gameover` en el flanco de subida, `setPaused` + emit `paused`, listener de `pause`/`resume`/`restart`, y `P` como toggle de pausa. Mismo patrón que `public/games/snake/game.js`.
- Nueva entrada `salta-carril` en el catálogo `GAMES` (`app/data/games.ts`) con `embed`, `best: 0`, `plays: "0"`.
- Migración aditiva idempotente que inserta la fila `salta-carril` en la tabla `games` (para que la FK — clave foránea — acepte sus scores).
- Verificación end-to-end (build + jugar + HUD + leaderboard).

**NO en scope (specs futuros):**
- Modificar los archivos genéricos de plataforma: `Player.tsx`, `scores.ts`, `HallOfFame.tsx`, `Leaderboard.tsx`, `bridge.ts`, `supabase/{client,server}.ts`. Si el juego pareciera exigirlo, es otra spec.
- Controles táctiles (la plataforma hoy es solo teclado; swipe/d-pad es otra spec transversal — ver Risks).
- Sonido, sprites bitmap, animaciones de muerte elaboradas.
- Enemigos extra del arcade original más allá de las tortugas que se sumergen (p.ej. cocodrilo en un nido, mosca-bonus, serpiente sobre la mediana) — quedan como expansión posterior (ver D-06).
- Tocar el mock `ranaria` (o cualquier otra entrada existente).

## Data model

**Cambios de datos (sin esquema nuevo — la maquinaria de leaderboard ya es genérica):**

- **Nueva entrada `GAMES`** en `app/data/games.ts`:
  - `id: "salta-carril"`, `title: "SALTA CARRIL"`, `cat: "ARCADE"`, `color: "green"`
  - `short: "Cruza el tráfico y el río contra reloj sin morir."`
  - `long: "El arcade clásico de reflejos: guía a la rana desde la acera hasta los cinco nidos de la orilla, esquivando cinco carriles de coches y camiones a distinta velocidad y saltando sobre troncos y tortugas que van a la deriva — ojo, algunas tortugas se sumergen. Un cronómetro presiona cada travesía: su remanente suma bonus, agotarlo cuesta una vida. Llena los cinco nidos para subir de nivel y que todo acelere. Tres vidas, puro timing."`
  - `cover: "cover-rana"` (reusa la portada del mock `ranaria` — solo estilo visual, sin acoplar id ni lógica; igual que `asteroides` reusa `cover-rocas`)
  - `embed: "/games/salta-carril/index.html"`, `best: 0`, `plays: "0"`
- **Fila semilla en la tabla `games`** (Supabase), vía migración aditiva, con los mismos valores (`id`, `title`, `cat`, `cover`, `color`, `embed`). Sin ella, todo `insert` en `scores` con `game_id='salta-carril'` es rechazado por la FK (clave foránea).
- **Contrato del puente**: sin cambios. `salta-carril` usa el subconjunto `ready` · `score` · `lives` · `level` · `paused` · `gameover` (Juego→Host) y `pause` · `resume` · `restart` (Host→Juego). No usa `powerup` (opcional; el HUD lo tolera).

## Mapeo de los 5 anchors del puente (game.js aún no existe — así serán)

El puente se engancha a cinco puntos del `game.js`. Como se construye de cero, se diseñan explícitamente para existir con estos nombres/forma (patrón `snake`):

### 1. Variables de estado — score / lives / level
- `let score = 0;` — entero creciente. Suma: `+10` por cada fila nueva más alta alcanzada en la travesía (no por retroceder), `+50` al llegar a un nido, `+bonus` por segundos restantes del cronómetro (p.ej. `10 × segundos`), `+1000` al completar los 5 nidos (fin de nivel). Solo crece, nunca decrece.
- `let lives = 3;` — decrementa en cada muerte (atropello, caída al agua, montar una tortuga sumergida, salir del río arrastrado por el borde, o cronómetro agotado).
- `let level = 1;` — incrementa al llenar los 5 nidos; recalcula la velocidad base de carriles/río y el tiempo de travesía.

### 2. Loop principal
- `function loop(ts) { ... requestAnimationFrame(loop); }` con paso por tiempo (`dt` — delta entre frames) para el desplazamiento continuo de carriles/troncos/tortugas. `emitState()` se llama una vez por frame; la sección de update (física de carriles, colisiones, cronómetro, sumersión de tortugas) va **gated** (condicionada) por `!paused && !gameOver`.

### 3. Expresión de game-over
- `let gameOver = false;` que pasa a `true` cuando `lives <= 0`. `emitState()` emite `{type:'gameover', score}` solo en el flanco de subida (`gameOver && !lastEmit.over`).

### 4. Init / restart
- `function initGame() { score=0; lives=3; level=1; gameOver=false; nests=[false×5]; resetFrog(); buildLanes(level); resetTimer(level); }` — invocada al cargar y al recibir `restart`.

### 5. Flag de pausa
- `let paused = false;` alternada por `setPaused(next)` (emite `{type:'paused', value}`) desde la tecla `P` y desde los comandos `pause`/`resume` del host. Congela también el cronómetro y la sumersión de tortugas.

## Requirements (EARS + RFC 2119)

- **REQ-01** — The system MUST servir el juego desde `public/games/salta-carril/` (`index.html`, `game.js`, `favicon.svg`) como estáticos accesibles en `/games/salta-carril/index.html`.
- **REQ-02** — The game MUST ser jugable solo con teclado: flechas ↑↓←→ mueven la rana una celda por pulsación (movimiento discreto en rejilla), y `P` alterna pausa.
- **REQ-03** — The game MUST mantener un `score` entero ≥ 0 que crece al avanzar filas, al alcanzar nidos, por bonus de tiempo y por completar nivel, y MUST NOT decrecer por retroceder ni por perder vidas.
- **REQ-04** — The game MUST modelar 3 vidas y restar una en cada muerte: atropello en carril de tráfico, caída al agua (no estar sobre tronco/tortuga en el río), montar una tortuga sumergida, salir por el borde arrastrado por un tronco/tortuga, o cronómetro de travesía agotado.
- **REQ-05** — The river MUST contener troncos y tortugas a la deriva; algunas tortugas MUST sumergirse y emerger cíclicamente, siendo plataforma segura solo mientras están emergidas.
- **REQ-06** — The game MUST mantener un cronómetro por travesía que, al agotarse, cuesta una vida; su remanente al alcanzar un nido MUST sumar bonus al `score`.
- **REQ-07** — When se llenan los 5 nidos de la orilla, the game MUST subir de nivel, reiniciar los nidos, aumentar la velocidad base de carriles/río y acortar el cronómetro (respetando un tope de velocidad, ver REQ-08).
- **REQ-08** — The game MUST capear la velocidad máxima de cualquier tronco/tortuga/coche por nivel de forma que ninguna entidad recorra más de su propio ancho por frame (evita *tunneling* — atravesar sin detección — en la colisión AABB).
- **REQ-09** — When el juego carga, the game bridge MUST emitir `{type:'ready'}` (handshake antes de recibir comandos).
- **REQ-10** — When cambian `score`, `lives` o `level`, the game bridge MUST emitir el mensaje correspondiente por diferencia (solo si cambió el valor).
- **REQ-11** — When `lives` llega a 0, the game bridge MUST emitir `{type:'gameover', score}` una sola vez (flanco de subida de `gameOver`).
- **REQ-12** — When el host envía `pause`/`resume`, the game MUST congelar/reanudar la física (carriles, río, cronómetro, sumersión) sin cerrarse; y `P` MUST alternar pausa emitiendo `{type:'paused', value}` para sincronizar el botón del Player.
- **REQ-13** — When el host envía `restart`, the game MUST reiniciar a score 0 / 3 vidas / nivel 1 vía `initGame()`.
- **REQ-14** *(unwanted)* — If el juego se abre standalone (sin `parent`, p.ej. `file://`), then el puente MUST ser inerte (envolver `window.parent.postMessage` en `try/catch`) y el juego MUST seguir jugándose.
- **REQ-15** — The catálogo `GAMES` MUST ganar la entrada `salta-carril` con `embed`, `best: 0`, `plays: "0"`, y MUST NOT modificar la entrada mock `ranaria` ni ninguna otra.
- **REQ-16** — The base de datos MUST tener una fila `games.id = 'salta-carril'` (migración aditiva idempotente) antes de que se acepte cualquier score; el spec NO edita migraciones ya aplicadas.
- **REQ-17 (NFR)** — The game MUST sostener ≥ 55 FPS (fotogramas por segundo) en el iframe con el mismo `requestAnimationFrame` que standalone.

## Implementation plan

Alineado con las 5 fases de `/add-game`, adaptado a *construir de cero* (no hay carpeta en `references/started-games/`, como pasó con `snake`). Cada fase deja la app ejecutable y commiteable; pausa para revisión de diff tras cada una. Antes de tocar nada bajo `app/`, leer los docs Next.js incluidos (`node_modules/next/dist/docs/01-app/`, v16.2.9). Node ≥ 20 vía nvm.

1. **Autoría del juego canvas (standalone, sin puente).** Crear `public/games/salta-carril/{index.html,game.js,favicon.svg}`: canvas, grilla de filas (acera · 5 carriles de tráfico · mediana segura · 5 filas de río con troncos/tortugas · orilla con 5 nidos), movimiento discreto de la rana con flechas, carriles/río móviles por `dt`, tortugas que se sumergen por ciclo, colisiones (atropello / agua / tortuga sumergida / arrastre por borde), cronómetro por travesía con bonus, `score`/`lives`/`level`, `gameOver`, `initGame()`, `paused` en el loop y tope de velocidad por nivel. Jugable abriendo el `index.html`. → commit.
2. **Inyección del puente.** Añadir al final de `game.js` el bloque espejo de `snake`: `postToHost` (con `try/catch`), `emitState()` por diferencia, `setPaused`, listener `message` con validación `e.origin === window.location.origin` (pause/resume/restart), y `postToHost({type:'ready'})`. Cablear `P` → `setPaused(!paused)` y `emitState()` una vez por frame. Confirmar que sigue jugándose standalone (puente inerte). → commit.
3. **Entrada de catálogo.** Añadir la entrada `salta-carril` a `GAMES` (`app/data/games.ts`) con los campos del Data model. No tocar `ranaria` ni otras. → commit.
4. **Semilla en Supabase.** Crear migración aditiva `supabase/migrations/0005_seed_salta_carril.sql` (siguiente número libre) con `insert ... on conflict (id) do nothing`, valores iguales a la entrada de catálogo. Indicar al usuario que la aplique (CLI o SQL Editor); no es verificable hasta entonces. → commit.
5. **Verificación (aceptación).** `npm run build` verde; `npm run dev` → `/jugar/salta-carril` renderiza el iframe (no arena mock), responde a teclado, el HUD refleja score/vidas/nivel reales, `P` y botón PAUSA en sync, game-over abre el modal con score real; guardar inserta fila en `scores` y aparece en `/juego/salta-carril` y `/salon`. → commit final.

## Acceptance criteria

- **AC-01 (happy path, REQ-01/15)** — Given la entrada `salta-carril` con `embed`, When navego a `/jugar/salta-carril`, Then el Player renderiza el iframe del juego (canvas jugable) y NO la arena mock.
- **AC-02 (teclado + score, REQ-02/03)** — Given el juego corriendo, When avanzo la rana hacia arriba cruzando filas, Then la rana se mueve celda a celda y el `score` del HUD crece; retroceder no lo baja.
- **AC-03 (muertes y vidas, REQ-04/05)** — Given la rana en un carril de tráfico o sobre el río, When la atropella un coche / cae al agua / monta una tortuga sumergida / sale por el borde en un tronco / se agota el cronómetro, Then pierde una vida y el HUD la refleja.
- **AC-04 (cronómetro y bonus, REQ-06)** — Given una travesía en curso, When llego a un nido con tiempo restante, Then el `score` suma el bonus proporcional al remanente; y si el cronómetro llega a 0 antes, pierdo una vida.
- **AC-05 (nivel, REQ-07/08)** — Given 4 nidos llenos, When ocupo el quinto, Then subo de nivel, los nidos se reinician y carriles/río aceleran sin que ninguna entidad supere el tope de velocidad (sin *tunneling* en colisión).
- **AC-06 (game-over, REQ-11)** — Given 1 vida, When muero, Then el juego emite `gameover` una sola vez y el modal de fin abre con el score final real.
- **AC-07 (pausa bidireccional + sync, REQ-12)** — Given el juego corriendo, When pulso el botón PAUSA del Player o la tecla `P`, Then la física (carriles/río/cronómetro/sumersión) se congela y el estado del botón queda en sync; al reanudar continúa donde estaba.
- **AC-08 (reinicio, REQ-13)** — Given el modal de game-over, When pulso "JUGAR DE NUEVO", Then el juego reinicia a score 0 / 3 vidas / nivel 1 y el HUD se resetea.
- **AC-09 (standalone, REQ-14)** — Given el `index.html` abierto suelto (sin parent), When juego, Then funciona sin errores de consola por el puente (inerte).
- **AC-10 (leaderboard, REQ-16)** — Given la migración aplicada, When guardo un score con nombre al terminar, Then aparece una fila en `scores` y el score se ve en `/juego/salta-carril` (Leaderboard) y en `/salon` (Hall of Fame).
- **AC-11 (no-mezcla, REQ-15)** — Given el catálogo, Then coexisten `salta-carril` (con `embed`) y el mock `ranaria` (sin `embed`) como entradas separadas; `ranaria` sin modificar.
- **AC-12 (build)** — `npm run build` compila sin errores de tipos ni lint.

## Non-functional requirements

- **NFR-01 (rendimiento).** ≥ 55 FPS en el iframe con `requestAnimationFrame`; el número de entidades (unas decenas de rectángulos: coches, troncos, tortugas, rana) hace esto holgado.
- **NFR-02 (latencia del puente).** Un cambio de estado se refleja en el HUD React en ≤ ~50 ms (≤ 1 frame percibido); `postMessage` es asíncrono pero intra-página.
- **NFR-03 (aislamiento).** Los globals del juego (`keys`, `canvas`, loop) no se filtran al documento de la plataforma (garantizado por el iframe).
- **NFR-04 (sin assets pesados).** Cero imágenes/audio externos; todo dibujado con primitivas de canvas. El bundle del juego son 3 archivos de texto.
- **NFR-05 (fidelidad arcade).** El ritmo, la aceleración por nivel y la presión del cronómetro deben reproducir la sensación del Frogger original — reflejo y timing, no estrategia.

## Decisiones tomadas y descartadas

### D-01 · Frogger canónico de acción, sin giro de género
- **Contexto:** propuesta A del game-jam "Frogger"; otras propuestas exploran giros de género.
- **Decisión:** fidelidad al arcade original — carriles + río + tortugas sumergibles + cronómetro + niveles que aceleran.
- **Consecuencias:** aporta el género *dodge & advance* (esquiva y avanza) puro, que no solapa con los 4 juegos reales; leaderboard limpio de un score entero creciente.
- **Descartado:** añadir mecánicas de otro género (recursos, construcción, disparo) — sería otra propuesta del jam, no ésta.

### D-02 · Construir de cero (como `snake`), no `/add-game` desde referencia
- **Contexto:** no existe `references/started-games/*frogger*`; `/add-game` copia de ahí.
- **Decisión:** autoría desde cero de los 3 archivos, luego inyectar el puente con el mismo patrón que `snake`.
- **Consecuencias:** el spec cubre la fase de autoría (Fase 1); el resto (puente, catálogo, semilla, verificación) es idéntico al flujo `/add-game`.
- **Descartado:** clonar un tercero — dependencias/licencias/estilo inconsistente; el patrón canvas-primitivas de la casa es trivial para este juego.

### D-03 · id `salta-carril`, mock `ranaria` intacto; portada reusada
- **Contexto:** ya hay un mock temático de rana (`ranaria`); el id `frogger` lo reserva otra propuesta del jam (spec 07).
- **Decisión:** id real `salta-carril` (no colisiona con `GAMES` ni con `public/games/`), `ranaria` sin tocar, `cover: "cover-rana"` reusado (solo visual).
- **Consecuencias:** coexisten sin mezclarse, igual que `asteroides`/`rocas`; si esta propuesta gana el jam, puede promoverse a spec numerado y, si se decide, renombrarse a id `frogger`.
- **Descartado:** reescribir el mock `ranaria` in situ — rompería el paralelismo establecido y arrastraría sus stats falsas (`best: 18900`, `plays: "6.4K"`).

### D-04 · Movimiento discreto en rejilla, carriles/río continuos por `dt`
- **Contexto:** el Frogger clásico mueve la rana celda a celda pero vehículos y troncos fluyen.
- **Decisión:** rana en pasos discretos por pulsación; carriles/troncos/tortugas con posición continua escalada por `dt` (delta de tiempo entre frames).
- **Consecuencias:** colisión rana-vehículo por solape de rectángulos (AABB); "ir sobre el tronco/tortuga" = heredar su desplazamiento ese frame; salir del borde montado = muerte.
- **Descartado:** todo discreto por *ticks* — el flujo se ve a tirones y baja la sensación arcade.

### D-05 · Cronómetro por travesía como presión y fuente de bonus
- **Contexto:** el Frogger original penaliza la lentitud y premia el tiempo restante.
- **Decisión:** cronómetro que, al agotarse, cuesta una vida; su remanente da bonus de score al llegar a un nido.
- **Consecuencias:** presiona a avanzar rápido (partidas más disputadas, leaderboard más separado por habilidad) y aporta score además del avance.
- **Descartado:** sin tiempo — partidas pasivas y campeo; peor para un ranking de máximas.

### D-06 · Tortugas sumergibles sí; cocodrilo/mosca-bonus/serpiente no (por ahora)
- **Contexto:** el arcade tiene extras (cocodrilo en nido, mosca-bonus, serpiente en la mediana, nutria).
- **Decisión:** incluir las tortugas que se sumergen (clave del río canónico) pero dejar los demás enemigos como expansión posterior.
- **Consecuencias:** captura la esencia del río sin inflar el alcance del borrador.
- **Descartado:** todos los extras de golpe — riesgo/esfuerzo alto para un candidato de jam; se añaden luego si gana.

## Risks

### Foco del teclado no entra al iframe
- Mitigación: el Player ya gestiona autofocus del iframe (patrón de spec 05); nada nuevo salvo `tabindex`/foco en el canvas al cargar, como los otros juegos.

### Carrera: el host envía comandos antes de que el juego cargue
- Mitigación: handshake `ready` (REQ-09); el Player no envía hasta recibirlo (comportamiento genérico ya implementado).

### Colisión sobre troncos/tortugas con *tunneling* (atravesar sin detectar) a alta velocidad
- Mitigación: la rana es discreta y troncos/tortugas anchos; evaluar solape AABB (caja envolvente alineada a ejes) por frame basta; capear la velocidad máxima por nivel para que ninguna entidad recorra más de su propio ancho por frame (REQ-08).

### Sumersión de tortugas ambigua para el jugador
- Mitigación: telegrafía visual clara (cambio de color/altura + fase de "hundiéndose") antes de desaparecer, para que la muerte se perciba justa y no aleatoria.

### Ausencia de control táctil limita el alcance móvil
- Mitigación: fuera de scope aquí (transversal a toda la plataforma). Candidato a spec propia (d-pad/swipe → sintetizar las mismas pulsaciones de flecha).

### La migración no se aplica y guardar falla por FK
- Mitigación: esperado; reportar como "bloqueado en migración", no como bug (REQ-16). `on conflict do nothing` la hace re-ejecutable.

## Verification

Ejecutable end-to-end, produce evidencia:

1. `npm run build` → verde (AC-12).
2. `npm run dev` + `/jugar/salta-carril` → canvas responde a flechas; cruzar filas sube el score en el HUD real; morir por coche/agua/tortuga sumergida/tiempo baja vidas (AC-01/02/03).
3. Llegar a un nido con tiempo → bonus aplicado; agotar el cronómetro → pierde vida (AC-04).
4. Llenar 5 nidos → sube nivel, carriles/río aceleran sin *tunneling* (AC-05).
5. Perder la última vida → modal con score real, emitido una sola vez (AC-06); "JUGAR DE NUEVO" reinicia a 0/3/1 (AC-08).
6. Botón PAUSA y tecla `P` → físicas congeladas y en sync (AC-07).
7. Abrir el `index.html` suelto → juega sin errores de puente (AC-09).
8. Aplicar migración, guardar score con nombre → fila en `scores`, visible en `/juego/salta-carril` y `/salon` (AC-10).
9. Inspección de catálogo → `salta-carril` y `ranaria` separados, `ranaria` intacto (AC-11).

## Traceability matrix

| Requisito | Acceptance | Diseño / módulo | Verificación |
|---|---|---|---|
| REQ-01 | AC-01 | `public/games/salta-carril/` | build + navegar |
| REQ-02/03 | AC-02 | `game.js` (input + score) | jugar |
| REQ-04/05 | AC-03 | `game.js` (colisiones + tortugas) | morir |
| REQ-06 | AC-04 | `game.js` (cronómetro + bonus) | nido/tiempo |
| REQ-07/08 | AC-05 | `game.js` (nidos + nivel + tope vel.) | llenar nidos |
| REQ-09 | AC-01 | puente `ready` | consola/red |
| REQ-10 | AC-02 | `emitState()` por diferencia | jugar |
| REQ-11 | AC-06 | `emitState()` gameover (flanco) | perder vida |
| REQ-12 | AC-07 | `setPaused` + listener + `P` | PAUSA / P |
| REQ-13 | AC-08 | `initGame()` + restart | modal |
| REQ-14 | AC-09 | `postToHost` en `try/catch` | `file://` |
| REQ-15 | AC-11 | `app/data/games.ts` | inspección |
| REQ-16 | AC-10 | `supabase/migrations/0005_seed_salta_carril.sql` | dashboard |
| REQ-17 (NFR-01) | — | `requestAnimationFrame` | medición FPS |

## Qué NO está en este spec

Controles táctiles (spec transversal futura), sonido, sprites bitmap, enemigos extra del arcade (cocodrilo/mosca-bonus/serpiente), persistencia distinta de la genérica del leaderboard, y cualquier cambio a los archivos genéricos de plataforma (`Player.tsx`, `scores.ts`, leaderboards, `bridge.ts`, clientes Supabase).
