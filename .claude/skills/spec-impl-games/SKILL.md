---
name: spec-impl-games
description: Igual que /spec-impl (implementa un spec aprobado con rama propia, pasos con pausas y revisión adversarial final) pero, cuando la implementación del spec termina, ejecuta la labor de dos agentes en secuencia estricta — primero skin-designer, después mobile-porter — para dejar el juego con sus skins y verificado en móvil. Trigger: "/spec-impl-games", "implementa el spec del juego con skins y móvil".
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-games — spec-impl + skins + móvil, en secuencia

Esta skill NO duplica el flujo de implementación: lo hereda. La fuente de verdad de las fases 1-5 es `.claude/skills/spec-impl/SKILL.md`; aquí solo se añaden las fases 6 y 7. Si `/spec-impl` cambia, esta skill hereda el cambio automáticamente.

## Fases 1-5 — idénticas a /spec-impl

Lee `.claude/skills/spec-impl/SKILL.md` y ejecuta sus fases EXACTAMENTE, pasando como argumento el `<NN-spec-name>` recibido por esta skill:

1. Identificar el spec en `specs/`.
2. Validar que el estado significa "Approved" (si no, detenerse con el mensaje de error estándar de esa skill — las fases 6 y 7 tampoco se ejecutan).
3. Crear/activar la rama `spec-NN-slug` y mostrar el resumen del spec.
4. Implementar paso a paso con pausas para revisar el diff.
5. Revisión adversarial del diff contra el spec con un subagente de contexto fresco, y corrección de los gaps reales.

**Las fases 6 y 7 solo arrancan cuando la fase 5 quedó limpia** (revisión sin hallazgos bloqueantes). Todo el trabajo de los agentes ocurre en la MISMA rama del spec.

## Fase 6 — agente `skin-designer` (primero, y solo)

1. Lanza el agente `skin-designer` (Agent tool, `subagent_type: "skin-designer"`) pasándole en el prompt: qué spec se acaba de implementar, qué juego(s) se crearon o tocaron (rutas bajo `public/games/`), y que trabaje sobre la rama activa siguiendo la convención compartida de skins ya establecida (`specs/skin-designer/convencion-skins.md`, `public/games/_shared/`).
2. **Espera a que termine.** No lances nada más mientras corre. Al terminar, reporta al usuario un resumen de lo que hizo y committea su trabajo en la rama (Conventional Commits, scope del juego).

## Fase 7 — agente `mobile-porter` (después, nunca en paralelo)

1. Solo cuando la fase 6 terminó y está committeada, lanza el agente `mobile-porter` (Agent tool, `subagent_type: "mobile-porter"`) pasándole: el mismo contexto del spec y, además, qué archivos tocó `skin-designer`, para que audite y arregle el renderizado móvil-web del resultado FINAL (canvas que escala, meta viewport, controles táctiles del patrón spec 08).
2. Espera a que termine, reporta el resumen y committea.

**Por qué este orden y no en paralelo:** ambos agentes editan los mismos archivos de los juegos (`index.html`, CSS); en paralelo se pisarían. Y `mobile-porter` debe auditar el CSS final — incluido el que las skins acaban de introducir — no una versión intermedia.

## Cierre

Igual que /spec-impl: recordar al usuario verificar los acceptance criteria (ahora incluyendo skins y móvil), actualizar el estado del spec a "Implemented", refrescar el overview y hacer el commit/PR final según el flujo git del repo (la `main` remota está protegida: rama + PR con `gh`).
