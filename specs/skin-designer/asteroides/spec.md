# Skins de asteroides

Aplica la [convención compartida](../convencion-skins.md). Cuatro skins: `clasico` (default), `neon`, `retro`, `claro`.

## Estado previo

Asteroides no tenía ningún sistema de temas: todos los colores estaban fijos en `game.js` (`#fff` para naves/asteroides/balas/HUD, `#0ff` para el power-up y el contador triple, naranja para la llama del propulsor, blanco para las partículas) y el fondo `#000` se pintaba en el canvas y en el `<body>`. El `index.html` llevaba los estilos en un `<style>` inline, sin variables.

## Cambios

- `index.html`: se enlaza `../_shared/skins.css` y se carga `../_shared/skins.js` antes de `game.js`. El fondo del `<body>` y el borde del canvas pasan a variables (`--page-bg`, `--page-border`) definidas por skin con `body[data-skin="…"]`, para que el marco alrededor del canvas acompañe al tema.
- `game.js`: se añade el objeto `SKIN_PALETTES` con las cuatro paletas del canvas y `AVSkin.onChange` para fijar la paleta activa (`theme`). Todos los literales de color en los métodos de dibujo (Bullet, Asteroid, PowerUp, Ship, Particle, HUD, overlay y fondo) se sustituyen por `theme.*`. Se añade un resplandor (`shadowBlur`) para las skins `neon` y `retro`, tintado con el color de trazo. La skin `claro` (nueva en asteroides, que no tenía modo claro) usa lienzo claro con vectores oscuros para contraste.

## Paletas

- `clasico`: el look original — fondo negro, trazo blanco, power-up cian, llama naranja. Sin glow.
- `neon`: fondo casi negro violáceo `#05010d`, trazo cian-hielo `#7df9ff` con glow, power-up magenta `#ff37e6`.
- `retro`: fondo verde muy oscuro `#001200`, trazo verde fósforo `#33ff66` con glow suave, power-up ámbar `#ffcc33` — evoca el monitor CRT (tubo de rayos catódicos) de los recreativos.

Detalle de implementación: `particle` se guarda como una terna RGB suelta (`"r,g,b"`) porque las partículas de explosión se pintan con opacidad variable (`rgba(r,g,b,alpha)`); el resto son colores completos.

## Verificación

- Arranca en `clasico`; el botón compartido cicla `clasico → neon → retro → claro`.
- La elección persiste al recargar (clave común `av-skin`).
- Jugable en standalone (`file://`) y embebido en el iframe del Player.
- El puente `postMessage` no cambia: score, vidas, nivel, power-up, pausa y game over se emiten igual; las skins no tocan ningún mensaje.
