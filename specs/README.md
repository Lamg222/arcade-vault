# Organización de `specs/`

Conviven dos esquemas por razones históricas.

## 1. Specs numerados planos (`00`…`07`) — legado, no se tocan

Los specs base de la plataforma e infraestructura viven como archivos planos numerados en la raíz de `specs/` (`00-overview.md`, `01-mvp-visual-pantallas.md`, …, `07-juego-frogger.md`). Se mantienen como están; sus números son referenciados desde otros documentos y desde el historial.

## 2. Specs de juegos por agente (nuevo) — de aquí en adelante

Cada juego nuevo que produzca un agente de juegos se guarda bajo una carpeta con el nombre del **agente que realmente lo generó**, y dentro una subcarpeta con el nombre del juego:

```
specs/
  <agente>/            # game-planner | game-jam | game-expander | …
    <juego>/           # id del juego en kebab-case: frogger, gloton, invasores…
      spec.md          # el spec accionable (formato del repo)
```

Ejemplos:

```
specs/game-planner/frogger/spec.md      # recomendación puntual de game-planner
specs/game-jam/<tema>/<juego>/spec.md   # varias propuestas de una jam temática
specs/game-expander/tetris/spec.md      # expansión de un juego ya portado
```

### Reglas

- La carpeta de agente lleva el **nombre del agente real** (`game-planner`, `game-jam`, `game-expander`), no un genérico. Si dos agentes proponen el mismo juego, cada uno bajo su carpeta.
- La subcarpeta del juego usa el **`id` de catálogo** en kebab-case (minúsculas con guiones), el mismo que va en `public/games/<id>/` y en la tabla `games` de Supabase — así el nombre es rastreable de punta a punta.
- El registro humano-legible de qué propuso cada agente vive aparte, en [`references/propuestas-juegos.md`](../references/propuestas-juegos.md); esta carpeta guarda los specs accionables.

### Caso frontera: Frogger

`07-juego-frogger.md` (generado por `game-planner`) se quedó en el esquema plano por decisión de no mover specs existentes. La convención por-agente aplica a los juegos generados a partir de ahora; su equivalente sería `specs/game-planner/frogger/spec.md`.
