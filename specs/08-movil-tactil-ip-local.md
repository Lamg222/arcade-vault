# 08 — Juego táctil en móvil vía IP local

- **Estado:** Implemented
- **Fecha:** 2026-08-20
- **Dependencias:** 01-mvp-visual-pantallas (componente `Player`), 05-juego-asteroides (patrón iframe — marco HTML aislado — + puente `postMessage` — mensajería entre iframe y página), y los juegos embebidos existentes (`asteroides`, `tetris`, `arkanoid`, `snake`, `salta-carril`)
- **Objetivo (una frase):** Hacer jugables los 5 juegos embebidos desde un dispositivo móvil táctil en la red local: el servidor de desarrollo se expone por la IP local (`192.168.100.63`, documentada y configurada en `next.config.ts` vía `allowedDevOrigins` — lista blanca de orígenes externos que Next.js 16 acepta en desarrollo), y bajo el breakpoint `md` de Tailwind (768px) el reproductor cambia a layout vertical — canvas (lienzo del juego) arriba, gamepad táctil abajo con cruceta de 4 flechas + botones A/B + pausa, HUD del host oculto — que sintetiza eventos de teclado (genera programáticamente las mismas señales que teclas físicas) hacia el iframe, sin modificar ningún `game.js`.

> Palabras clave RFC 2119 (convención que da significado normativo a los verbos): **MUST / MUST NOT / SHOULD / MAY** con su significado estándar.

## Scope

**En scope:**
- Script `dev:lan` en `package.json`: `next dev -H 0.0.0.0` (el servidor de desarrollo escucha en todas las interfaces de red, no solo `localhost`, para que el teléfono en la misma Wi-Fi lo alcance).
- `next.config.ts`: `allowedDevOrigins` (lista blanca de Next.js 16 con los orígenes externos aceptados en desarrollo) con la IP local `192.168.100.63`, con comentario de cómo cambiarla si la red cambia.
- Sección corta "Jugar desde el móvil" en `README.md` (URL `http://192.168.100.63:3000`, cómo obtener la IP, nota de firewall de Windows/WSL2).
- Componente nuevo `app/components/TouchControls.tsx`: gamepad táctil — cruceta de 4 flechas, botones **A** y **B**, botón **PAUSA**.
- `app/components/Player.tsx`: bajo el breakpoint `md` de Tailwind (768px), layout vertical — canvas arriba, gamepad abajo, HUD del host oculto; en escritorio, todo idéntico a hoy.
- Ajuste CSS en el `index.html` de los 5 juegos (`asteroides`, `tetris`, `arkanoid`, `snake`, `salta-carril`): el canvas escala para caber en pantalla preservando proporción y resolución interna.
- Síntesis de eventos de teclado hacia el iframe: **cero cambios en los `game.js`**.

**NO en scope (specs futuros):**
- Juegos futuros con necesidades de control distintas (más botones, gestos) — nuevo requerimiento.
- `frogger` (spec 07 aún no construido) — al construirse hereda esto gratis (usa el mismo patrón).
- Acceso desde fuera de la red local (internet, HTTPS, túneles), build de producción, PWA (web instalable como app), app nativa.
- Gestos táctiles por juego (swipe, arrastre) — el gamepad uniforme es la decisión.
- Vibración, sonido, orientación horizontal forzada.

## Data model

**Sin datos nuevos.** Ni tablas, ni `localStorage` (almacén del navegador), ni cambios al catálogo `games.ts`. Solo configuración:

- `next.config.ts` → `allowedDevOrigins: ["192.168.100.63"]`
- `package.json` → `"dev:lan": "next dev -H 0.0.0.0"`

**Mapa de controles → teclas** (contrato del gamepad):

| Control | `key` | `code` | Uso en juegos |
|---|---|---|---|
| ✚ arriba/abajo/izq/der | `ArrowUp`… | `ArrowUp`… | movimiento en los 5 |
| Botón A | `" "` (espacio) | `Space` | disparo / caída dura / lanzar / acción |
| Botón B | `Enter` | `Enter` | reiniciar (`snake`, `salta-carril`) |
| PAUSA | — (no sintetiza tecla) | — | usa el puente `postMessage` (`pause`/`resume`), mismo flujo que el botón PAUSA de escritorio |

## Requirements (EARS + RFC 2119)

- **REQ-01** — The `package.json` MUST exponer el script `dev:lan` que ejecute `next dev -H 0.0.0.0`.
- **REQ-02** — The `next.config.ts` MUST declarar `allowedDevOrigins` incluyendo `192.168.100.63`, con comentario indicando cómo actualizarla.
- **REQ-03** — While el viewport (área visible del navegador) es < 768px, the `Player` MUST mostrar layout vertical: canvas arriba a ancho completo y `TouchControls` abajo, y MUST ocultar el HUD del host (la pausa vive en el gamepad).
- **REQ-04** — The `TouchControls` MUST contener cruceta de 4 direcciones, botón A, botón B y botón PAUSA.
- **REQ-05** — When el usuario toca un control direccional o A/B (`touchstart`/`pointerdown`), the host MUST despachar un `KeyboardEvent` sintético `keydown` con `key` **y** `code` correctos al `document` del iframe; when lo suelta (`touchend`/`pointercancel`), MUST despachar el `keyup` correspondiente.
- **REQ-06** — While una dirección se mantiene presionada, the host SHOULD auto-repetir el `keydown` (retardo inicial ≈250 ms, repetición ≈100 ms) imitando la repetición automática del teclado físico (necesario para mover piezas en `tetris` y avanzar fluido).
- **REQ-07** — The canvas de cada juego MUST escalar vía CSS para caber en el viewport preservando proporción (aspect ratio) y resolución interna, sin modificar `game.js`.
- **REQ-08** — The botón PAUSA MUST usar el puente `postMessage` (`pause`/`resume` con eco `paused`), no una tecla sintética.
- **REQ-09** *(unwanted)* — If el viewport es ≥ 768px, then the `TouchControls` MUST NOT renderizarse y el layout de escritorio MUST permanecer idéntico al actual.
- **REQ-10** *(unwanted)* — If el navegador intenta gestos por defecto sobre el gamepad (zoom por doble toque, scroll, pull-to-refresh — recargar jalando hacia abajo), then the `TouchControls` MUST prevenirlos (`touch-action: none` + `preventDefault`) para que la página no se mueva en plena partida.

## Implementation plan

Cada paso deja el sistema arrancable y commiteable:

1. **Red**: añadir `"dev:lan": "next dev -H 0.0.0.0"` en `package.json` y `allowedDevOrigins: ["192.168.100.63"]` en `next.config.ts` (con comentario de cómo actualizar la IP). Verificar que desde el teléfono carga `http://192.168.100.63:3000`.
2. **Escalado de canvas**: en el `index.html` de los 5 juegos, regla CSS `canvas { max-width: 100vw; max-height: 100dvh; width: auto; height: auto; }` (100dvh = alto dinámico del viewport — descuenta las barras del navegador móvil) preservando proporción. Escritorio no cambia (el canvas nunca excede su tamaño natural).
3. **`TouchControls.tsx`**: componente nuevo con cruceta, A, B, PAUSA; lógica de `pointerdown`/`pointerup` → `keydown`/`keyup` sintéticos (con `key` y `code`), auto-repetición direccional (≈250 ms de retardo, ≈100 ms de intervalo), `touch-action: none` + `preventDefault`. Recibe por props la referencia al iframe y el callback de pausa.
4. **`Player.tsx`**: layout responsive con clases Tailwind — `< md` (768px): canvas arriba, `TouchControls` abajo, HUD oculto; `≥ md`: idéntico a hoy. Conectar PAUSA del gamepad al flujo `postMessage` existente.
5. **Ajustes finos móviles**: `<meta name="viewport">` ya existe en los juegos; revisar que el contenedor del iframe no meta scroll; probar los 5 juegos en el teléfono y pulir tamaños de botón.

## Acceptance criteria

Given–When–Then, mapeados a requirements:

- **AC-01** (REQ-01/02): Given el servidor arrancado con `npm run dev:lan`, When abro `http://192.168.100.63:3000` en el teléfono (misma Wi-Fi), Then la home carga sin error de origen bloqueado (cross-origin).
- **AC-02** (REQ-03/04): Given un viewport < 768px en `/juego/asteroides`, When entra la vista, Then veo canvas arriba + gamepad abajo (cruceta, A, B, PAUSA) y no veo el HUD del host.
- **AC-03** (REQ-05): Given `snake` en móvil, When toco ✚ derecha, Then la serpiente gira a la derecha (el `keydown` sintético llegó al iframe).
- **AC-04** (REQ-06): Given `tetris` en móvil, When mantengo ✚ izquierda ~1 s, Then la pieza se desplaza varias celdas (auto-repetición activa).
- **AC-05** (REQ-05): Given `asteroides` en móvil, When toco A, Then dispara una vez por pulsación (paridad con Espacio en teclado físico: el disparo es por flanco — un guard ignora los auto-repeats); y When mantengo ✚ arriba, Then el empuje es sostenido y cesa al soltar (par `keydown`/`keyup` correcto en teclas mantenidas).
- **AC-06** (REQ-08): Given cualquier juego en móvil, When toco PAUSA, Then el juego se congela y al volver a tocar se reanuda (eco `paused` del puente).
- **AC-07** (REQ-09, out-of-scope check): Given viewport ≥ 768px, When abro cualquier juego, Then no existe gamepad y el layout es idéntico al actual (regresión cero en escritorio).
- **AC-08** (REQ-10, edge): Given el gamepad en uso intenso (toques rápidos repetidos), When juego 1 minuto, Then la página no hace zoom, ni scroll, ni pull-to-refresh.
- **AC-09** (REQ-07, edge): Given un teléfono angosto (~360px), When abro `tetris` y `arkanoid`, Then el canvas completo es visible sin recorte ni scroll horizontal.
- **AC-10** (REQ-05, edge): Given `arkanoid` en móvil, When toco B, Then no pasa nada indebido (Enter no tiene función ahí — tolerado sin error).

## Non-functional requirements

- **Latencia de input** (tiempo entre tocar y reaccionar el juego): ≤ 50 ms percibidos (un frame a 60 fps = 16.6 ms; el despacho sintético es síncrono, sin red de por medio).
- **Área táctil**: cada botón ≥ 44×44 px CSS (mínimo de accesibilidad táctil recomendado por Apple/W3C).
- **Regresión escritorio**: 0 cambios visuales/funcionales en ≥ 768px.
- **Sin dependencias nuevas**: 0 paquetes npm añadidos.

## Decisiones tomadas y descartadas

- **D-01 · Teclado sintético, no puente extendido.** Contexto: los 5 juegos ya escuchan teclado; el puente `postMessage` no define mensajes de input. Decisión: el gamepad despacha `KeyboardEvent` sintéticos al `document` del iframe (mismo origen lo permite; burbujean hasta `window`, cubriendo a `asteroides`). Consecuencias: cero cambios en `game.js`; contrato del puente intacto. Descartado: mensajes `input` en el puente (obligaría a tocar el contrato y cada juego).
- **D-02 · Gamepad uniforme, no gestos por juego.** Decisión del usuario: misma cruceta + A/B para todos. Consecuencia: curva de aprendizaje única; se pierde el gesto "natural" (swipe en snake). Descartado: híbrido gestos/d-pad (más código por juego, inconsistente).
- **D-03 · Breakpoint 768px, no `pointer: coarse`.** Decisión del usuario: usar el `md` estándar de Tailwind. Consecuencia: laptop táctil angosta vería gamepad; tablet ancha no — aceptado. Descartado: media query de tipo de puntero.
- **D-04 · HUD del host oculto en móvil.** Decisión del usuario: el HUD propio de cada juego (dibujado dentro del canvas) basta; solo PAUSA sobrevive, en el gamepad. Consecuencia: máximo espacio vertical para el canvas.
- **D-05 · PAUSA vía puente, no tecla sintética.** `P`/`Escape` varían por juego (`e.key` vs `e.code`); el puente ya unifica pausa con eco de confirmación. Menos fragilidad.
- **D-06 · IP fija documentada, no autodetección.** `192.168.100.63` en `allowedDevOrigins` con comentario. Descartado: script detector de IP (complejidad sin valor a esta escala; si cambia la red, se edita una línea).
- **D-07 · Ambos `key` y `code` en el evento sintético.** Los juegos mezclan ambas propiedades; poblar las dos evita fallos silenciosos.

## Risks

- **WSL2 y red**: si WSL2 (Linux virtualizado dentro de Windows) está en modo NAT (red traducida — el Linux tiene IP interna invisible para la Wi-Fi), el teléfono no alcanzará el puerto aunque el código esté bien. Mitigación: la IP detectada (`192.168.100.63`) es de rango doméstico — sugiere modo mirrored (WSL2 comparte la IP de Windows); si falla, documentar `netsh portproxy` (reenvío de puertos de Windows a WSL2) y regla de firewall para el puerto 3000 en el README.
- **La línea `Network:` de Next.js engaña**: `next dev` imprime la primera interfaz que encuentra — en esta máquina muestra `10.255.255.254` (adaptador interno de WSL2, inalcanzable desde el teléfono). No usarla; la URL correcta es la IP de la Wi-Fi (`192.168.100.63`).
- **Eventos sintéticos con `isTrusted: false`** (marca del navegador que distingue eventos generados por código de los físicos): los listeners actuales no la revisan (verificado), pero un juego futuro que la exija ignoraría el gamepad. Mitigación: requisito para juegos nuevos.
- **`100dvh` y barras del navegador móvil**: la barra de URL que aparece/desaparece cambia el alto visible. Mitigación: usar `dvh` (unidad que se ajusta sola) en vez de `vh`.

## Verificación

1. `npm run build` — compila sin errores.
2. `npm run dev:lan` en la máquina; en el teléfono (misma Wi-Fi) abrir `http://192.168.100.63:3000`.
3. Recorrer los 5 juegos: AC-02 a AC-10, marcando cada uno.
4. En escritorio, abrir 2 juegos y confirmar AC-07 (regresión cero).
5. Evidencia: captura de pantalla del teléfono con un juego + gamepad visible.

## What is NOT in this spec

Internet/HTTPS/túneles, build de producción, PWA, app nativa, gestos por juego, más de 2 botones, vibración/sonido, orientación horizontal forzada, `frogger` (spec 07), y juegos futuros con controles especiales (nuevo spec cuando lleguen).
