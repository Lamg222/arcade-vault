# Skins de Tetris

Aplica la [convención compartida](../convencion-skins.md). Tres skins: `clasico` (default), `neon`, `retro`.

## Estado previo

Tetris tenía un conmutador propio de dos modos (claro/oscuro): un botón `#theme-toggle`, la función `applyTheme`, y la clave `tetris-theme` en `localStorage` (almacenamiento del navegador). Era una maquinaria aislada, no reutilizable por otros juegos. Los ocho colores de las piezas estaban fijos en la constante `COLORS` de `game.js`; la línea de la rejilla se leía por CSS (`--grid-line`) vía `getComputedStyle`.

## Cambios

- `index.html`: se elimina el botón propio `#theme-toggle`; se enlaza `../_shared/skins.css` y se carga `../_shared/skins.js` antes de `game.js`.
- `style.css`: los tokens de cromo (fondo, texto, canvas, borde, panel, teclas, overlay) pasan de `:root` / `body.light-mode` a tres bloques `body[data-skin="clasico|neon|retro"]`. Se añaden `--accent` (color de marca de cada skin) y `--danger`, y los literales fijos de acento (`#7aa2f7`, `#e57373`) se sustituyen por esas variables en título, valores, overlay y botón. Se retiran los estilos del botón propio.
- `game.js`: la constante `COLORS` se reemplaza por `SKIN_PALETTES` (tres paletas del canvas: colores de las ocho piezas, línea de rejilla, brillo del bloque, y radio de glow para neon). Se añade `AVSkin.onChange` para fijar la paleta activa y repintar. `drawBlock` y `drawGrid` leen de `theme` en vez de literales o de CSS. Se elimina todo el código del toggle propio (`applyTheme` y la clave `tetris-theme`).

## Paletas

- `clasico`: los colores originales de Tetris — fondo azul-noche `#0f0f17`, acento `#7aa2f7`, piezas cian/amarillo/púrpura/verde/rojo/azul/naranja/gris.
- `neon`: fondo casi negro violáceo `#05010d`, acento magenta `#ff2bd6`, piezas saturadas con glow (resplandor via `shadowBlur`).
- `retro`: fondo cálido `#1a1410`, acento ámbar `#ffcf4d`, piezas apagadas estilo CRT (monitor de tubo).

## Migración del modo claro

El antiguo modo claro se retira como modo separado (ver el apartado de migración en la convención): la instrucción fija exactamente tres skins y prohíbe una cuarta, y sostener a la vez un toggle claro/oscuro y un conmutador de skins rompería el principio de un solo mecanismo. Recuperarlo en el futuro sería añadir una skin más bajo esta misma maquinaria, nunca un conmutador paralelo.

## Verificación

- Arranca en `clasico`; el botón compartido cicla `clasico → neon → retro`.
- La elección persiste al recargar (clave común `av-skin`).
- Jugable en standalone (`file://`) y embebido en el iframe del Player.
- El puente `postMessage` no cambia: no se emite ni se escucha ningún mensaje por causa de las skins.
