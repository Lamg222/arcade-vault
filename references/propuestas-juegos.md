# Propuestas de juegos — registro estructurado

Registro acumulable de las recomendaciones producidas por el agente `game-planner` (evalúa si una idea de juego encaja con la plataforma Arcade Vault y, si encaja, justifica y deja un spec accionable).

Cada entrada documenta: veredicto, checklist de encaje, encaje con el puente `postMessage` (mensajería entre el iframe —marco HTML aislado donde corre el juego— y la página contenedora) + leaderboard (tabla de máximas puntuaciones), por qué se eligió frente a alternativas, y punteros al spec generado.

---

## Entrada 01 — FROGGER

- **Fecha:** 2026-08-17
- **Veredicto:** ENCAJA — recomendado
- **Confianza:** alta
- **Spec generado:** [`specs/07-juego-frogger.md`](../specs/07-juego-frogger.md)
- **id de catálogo:** `frogger` · **título:** `FROGGER` (alt. `RANARIA`) · **cat:** `ARCADE` · **color:** `green` · **cover:** `cover-rana` (reusa portada del mock `ranaria`)

### Checklist de encaje (resuelto punto por punto)

| # | Criterio | Resultado |
|---|----------|-----------|
| 1 | Estático embebible (sin backend propio) | Sí — 3 archivos de texto en `public/games/frogger/` (`index.html`, `game.js`, `favicon.svg`) |
| 2 | Canvas + loop | Sí — `<canvas>` con `requestAnimationFrame` (repintado sincronizado al refresco de pantalla); pocas decenas de rectángulos → ≥55 FPS (fotogramas por segundo) holgado |
| 3 | Teclado | Sí — 4 flechas (movimiento discreto celda a celda) + `P` de pausa |
| 4 | Score entero creciente | Sí — sube al avanzar filas y llegar a nidos; entero ≥ 0, nunca decrece |
| 5 | Game-over detectable | Sí — `gameOver=true` cuando `lives <= 0`; se emite en el flanco de subida (una sola vez) |
| 6 | Init/restart | Sí — `initGame()` resetea a score 0 / 3 vidas / nivel 1 |
| 7 | Jugable standalone | Sí — puente envuelto en `try/catch` (inerte sin `parent`), como en snake |

### Encaje con el puente `postMessage` + leaderboard

Usa el puente genérico **sin tocarlo** — mismo patrón que `snake`, más completo por tener vidas y niveles:

- **Juego→Host:** `ready` (handshake = saludo inicial al cargar), `score`/`lives`/`level` emitidos por diferencia (solo si el valor cambió), `paused` (sync del botón), `gameover` (flanco de subida al llegar `lives=0`). No usa `powerup` (opcional; el HUD lo tolera).
- **Host→Juego:** `pause`/`resume` congelan la física (carriles + cronómetro), `restart` llama `initGame()`.
- **Leaderboard:** encaja limpio en el modelo de *un score entero creciente* de `scores.ts` + `saveScore`. Único paso manual: sembrar la fila `games.id='frogger'` mediante migración SQL aditiva idempotente, para que la **FK** (foreign key / clave foránea — regla que exige que `game_id` apunte a un juego existente en la tabla `games`) acepte los inserts.

### Por qué Frogger gana a los otros clásicos pendientes

Aporta un **género nuevo que no solapa** con los 4 juegos ya reales:

| Juego real | Género |
|-----------|--------|
| asteroides | disparo vectorial |
| tetris | puzzle de caída |
| arkanoid | paleta-y-bola |
| snake | serpiente-en-grilla |
| **frogger** | **esquiva-y-avanza** (arquetipo faltante) |

Descartados:

- **Space Invaders (`invasores`)** — shooter, mismo género que asteroides. Solapa.
- **Pong (`duelo-pixel`)** — versus local a 2 jugadores; no produce *un* score individual limpio para un ranking de máximas puntuaciones (mediría rondas ganadas). Encaje forzado con el leaderboard.
- **Pac-Man (`gloton`)** — encaja igual de bien pero más scope (mapa de laberinto + IA de persecución de 4 fantasmas). **Respaldo #1.**

### Alternativas de respaldo

1. `gloton` / Pac-Man — mismo encaje, más scope.
2. *Endless climber* de un botón (score = altura) — encaje más trivial del puente, aunque rompe la estética clásica-arcade del catálogo.

### Notas

- **Naming (decisión D-03 del spec):** título `FROGGER` para consistencia con ASTEROIDES/TETRIS/ARKANOID (marcas de terceros genericizadas en el repo). Alternativa en español: `RANARIA`, manteniendo el `id` interno `frogger`.
- **Construcción:** no existe carpeta de referencia (`references/started-games/` solo tiene asteroids/tetris/arkanoid), así que Frogger se construye de cero como snake — no aplica `/add-game` directo. Flujo: `/spec-impl` sobre el spec. La fase de aplicar la migración en Supabase es la única que requiere acción manual.
- El mock `ranaria` del catálogo queda intacto (como `asteroides` convive con `rocas`).
