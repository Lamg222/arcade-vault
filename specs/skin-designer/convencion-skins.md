# Convención de skins de Arcade Vault (fuente única)

Estado: vigente. Aplica a **todos** los juegos de `public/games/<id>/`, no solo a los ya migrados.

Una **skin** es un tema visual intercambiable de un juego: su paleta de colores y estilo de dibujo. No cambia jugabilidad, ni score, ni el contrato del puente `postMessage` (mensajería entre el iframe del juego y la página del Player). Las skins son puramente visuales.

Toda plataforma ofrece las mismas **tres** skins, con estos ids exactos:

- `clasico` — el default, **siempre**. El look original del juego.
- `neon` — paleta saturada y brillante, con glow (resplandor) sobre fondo casi negro.
- `retro` — paleta cálida/fosforescente estilo arcade o CRT (monitor de tubo) antiguo.

No se inventan skins más allá de estas tres salvo que el usuario lo pida.

## Principio rector: un solo mecanismo

Existe **una** implementación del conmutador, compartida por todos los juegos, en `public/games/_shared/`. Ningún `game.js` reimplementa la selección, la persistencia, ni el botón. Lo único que cada juego aporta es **su paleta** — los valores de color que ese juego concreto dibuja, que por naturaleza son distintos en cada juego (Tetris pinta piezas; asteroides pinta vectores). Si te descubres copiando la lógica del conmutador dentro de un juego, ese conteo es el bug: extrae el mecanismo común.

Separación de responsabilidades:

| Capa | Quién la posee | Qué contiene |
|------|----------------|--------------|
| Mecanismo | `_shared/skins.js` (único) | selección, persistencia, botón de UI, callbacks |
| Estilo del conmutador | `_shared/skins.css` (único) | el botón flotante y sus tokens por skin |
| Cromo del DOM del juego | la hoja del juego (`style.css` o `<style>`) | variables CSS bajo `body[data-skin="…"]` para fondo, bordes, texto del panel |
| Paleta del canvas | objeto JS del juego (`SKIN_PALETTES`) | colores que el juego dibuja en el `<canvas>` (píxeles) |

Por qué dos capas (CSS y JS) para el color: el CSS puede tematizar el DOM (marco, panel lateral, botones HTML), pero **no** puede pintar píxeles dentro de un `<canvas>`. Lo que se dibuja en canvas (piezas, naves, HUD) tiene que leer sus colores desde JavaScript. Por eso cada juego mantiene un objeto `SKIN_PALETTES` indexado por id de skin, y se repinta cuando la skin cambia.

## Cómo se selecciona una skin

1. `skins.js` lee la clave común `av-skin` de `localStorage` (almacenamiento del navegador que persiste entre sesiones). Si no hay valor válido, usa `clasico`.
2. Escribe el id en `document.body.dataset.skin`, es decir el atributo `<body data-skin="…">`. Ese atributo es el interruptor: el CSS del juego reacciona con selectores `body[data-skin="neon"] { … }`.
3. Inyecta un botón flotante (arriba-derecha) que cicla `clasico → neon → retro → clasico`. Al cambiar, persiste la elección y avisa a los suscriptores.

## API que consume cada juego

`skins.js` expone `window.AVSkin`:

- `AVSkin.current()` — id de la skin activa.
- `AVSkin.set(id)` — cambia y persiste.
- `AVSkin.cycle()` — avanza a la siguiente.
- `AVSkin.skins()` — lista de ids.
- `AVSkin.onChange(fn)` — registra `fn(id)`; se invoca **una vez de inmediato** con la skin activa (para el pintado inicial) y luego en cada cambio.

Patrón que sigue cada juego en su `game.js`:

```js
const SKIN_PALETTES = {
  clasico: { /* colores del canvas para clasico */ },
  neon:    { /* … */ },
  retro:   { /* … */ },
};
let theme = SKIN_PALETTES.clasico;
AVSkin.onChange(id => {
  theme = SKIN_PALETTES[id] || SKIN_PALETTES.clasico;
  // repinta si el juego ya arrancó
});
```

En las funciones de dibujo, los colores literales (`'#fff'`, `'#0ff'`, …) se sustituyen por `theme.*`.

## Cómo se enchufa en el HTML del juego

En `index.html`, dentro de `<head>` tras la hoja propia del juego:

```html
<link rel="stylesheet" href="../_shared/skins.css" />
```

Al final de `<body>`, **antes** de `game.js` (para que `window.AVSkin` exista cuando el juego se suscriba):

```html
<script src="../_shared/skins.js"></script>
<script src="game.js"></script>
```

La ruta `../_shared/` resuelve tanto servida (el iframe carga `/games/<id>/index.html`, así que sube a `/games/_shared/`) como abriendo el archivo en standalone (`file://`).

## Migración del toggle claro/oscuro de Tetris

Tetris tenía su propio conmutador de **dos** modos (`body.light-mode` + clave `tetris-theme` en `localStorage`), independiente y no reutilizable. Se reemplaza por este mecanismo de tres skins:

- El botón propio de Tetris y su código (`applyTheme`, la clave `tetris-theme`) se eliminan; los sustituye el botón compartido y la clave común `av-skin`.
- Sus tokens de cromo dejan de colgar de `:root` / `body.light-mode` y pasan a `body[data-skin="clasico|neon|retro"]`.
- El default pasa a ser `clasico` (el tema oscuro original de Tetris).

Decisión y su tradeoff (compromiso): el antiguo **modo claro** era un cuarto look. La instrucción vigente fija exactamente tres skins (`clasico`, `neon`, `retro`) y prohíbe inventar una cuarta, y mantener a la vez un toggle claro/oscuro y un conmutador de skins violaría el principio de un solo mecanismo. Por eso el modo claro se retira como modo separado. Si en el futuro se quiere recuperar un look claro, se añade como skin adicional bajo esta misma maquinaria (una entrada más en `SKINS`, un bloque `body[data-skin="…"]` y una paleta), nunca como un conmutador paralelo.

## Verificación por juego

Cada juego debe: arrancar en `clasico`; conmutar entre las tres skins con el botón; persistir la elección al recargar; y seguir jugable en standalone. El puente `postMessage` no se ve afectado — no se emite ni se escucha ningún mensaje nuevo por causa de las skins.
