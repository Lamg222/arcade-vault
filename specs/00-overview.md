# Specs — overview

> Objetivo global: Arcade Vault es una plataforma para jugar videojuegos online y competir por la puntuación más alta.
> Fuente de verdad: los specs de esta carpeta. El código sigue a los specs, no al revés.

## Índice

| #  | Título                                             | Estado      | Depende de              | Slug                    | Compliance |
| -- | -------------------------------------------------- | ----------- | ----------------------- | ----------------------- | ---------- |
| 01 | MVP visual: pantallas del Arcade Vault             | Implemented | —                       | mvp-visual-pantallas    | —          |
| 02 | Landing page (Home) y navegación Inicio/Acerca     | Implemented | 01                      | landing-home-y-nav      | —          |
| 03 | About real y contacto por email con Resend         | Implemented | 02                      | about-y-contacto-resend | —          |
| 04 | Integración base de Supabase (clientes browser+server) | Implemented | 01, 03              | integracion-supabase    | —          |
| 05 | Juego Asteroides embebido y puenteado                  | Implemented | 01                  | juego-asteroides        | —          |

## Mapa de dependencias

```
SPEC 01 ──▶ SPEC 02 ──▶ SPEC 03 ──▶ SPEC 04
   │                                  ▲
   ├──────────────────────────────────┘   (04 depende de 01 y de 03)
   └──▶ SPEC 05                            (05 depende de 01)
```

## Próximos specs (planeados, fuera del scope actual)

Recogidos de las secciones "Qué NO está en este spec" de los specs existentes:

- Flujos de autenticación reales (login/registro/logout) sobre Supabase — reemplazo del `AuthContext` falso.
- Tablas de DB (base de datos), esquema, migraciones y RLS (Row Level Security — reglas por fila).
- Leaderboard (tabla de puntuaciones) persistente — reemplazo del `scores.ts` ficticio.
- Migración del catálogo `games.ts` / `scores.ts` a DB.
- `middleware.ts` para refresh de sesión (refresco de token en cada request).
- Realtime (tiempo real por WebSocket) y Edge Functions (funciones serverless en el borde).
- Portar el resto de juegos (`rocas`, `caida`, `serpentina`, …) al patrón embed + puente `postMessage` establecido en el spec 05.
