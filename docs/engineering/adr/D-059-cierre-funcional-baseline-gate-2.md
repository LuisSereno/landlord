# D-059 — Cierre funcional del baseline jugable de Gate 2

Estado: Aceptada
Fecha: 2026-10-21
Alcance: prototipo de Gate 2

## Contexto

El primer baseline necesitaba recursos renovables, limitación de trabajo, reinversión y
consecuencias visibles para poder iniciar pruebas cortas de comprensión.

## Decisión

- Tres líneas de producción, cancelación con devolución del 50 % entero de materiales y sin caja.
- Capacidad de trabajo limitada y visible.
- Mejora de edificio con coste, tiempo y aumento de renta del 25 %.
- Ruta ilegal opcional con detección, heat y multa máxima de 180 u.
- Proyección de costes, ritmos, libro económico y resumen rival.

Los valores son parámetros de validación, no balance final. D-060 sustituye los puntos de esta
decisión relativos al número de cuadrillas, activación/coste de producción y escala temporal.

## Evidencia

`packages/simulation/src/game-data.ts`, `packages/simulation/src/commands.ts` y
`apps/web/src/App.tsx`.
