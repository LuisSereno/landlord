# D-057 — Diagnóstico efímero y acotado de sesión

Estado: Aceptada
Fecha: 2026-10-21
Alcance: playtests de Gate 2

## Contexto

Los playtests necesitan distinguir errores de transporte, rechazos de dominio y patrones de
interacción sin convertir la telemetría local en estado autoritativo.

## Decisión

- El Worker publica métricas cada 20 ticks y bajo demanda.
- La web conserva como máximo 120 entradas y muestra las ocho más recientes.
- Tres rechazos iguales se señalan como patrón.
- El diagnóstico no entra en `GameState`, snapshots ni reglas de simulación.
- Inicializar o cargar una partida reinicia las métricas de sesión.

## Consecuencias

Una captura textual del panel es suficiente para una primera investigación. No sustituye una
sesión de producto ni constituye analítica remota.

## Evidencia

`packages/simulation/src/worker-runtime.ts`, `apps/web/src/diagnostics.ts` y
`apps/web/src/App.tsx`.
