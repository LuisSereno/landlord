# WP3.12 — Automatización y UX de escala — 2026-10-23

## Estado

`DONE`. El crecimiento de la cartera no obliga a repetir cada operación rutinaria ni a buscar
manualmente las excepciones.

## Resultado

- `Resolver rutina de cartera` agrupa ocupación compatible y asignación de cuadrillas libres;
  cada acción sigue viajando como comando normal y se informa cuántas operaciones se aceptaron.
- La proyección ofrece una bandeja derivada de excepciones con severidad y objetivo: déficit de
  liquidez, atrasos/deuda, condición baja, permisos rechazados/caducados, subastas y vacantes.
- El comparador de cartera reúne en una lectura activos, renta, condición, mantenimiento,
  préstamos y coberturas de seguro.
- El mapa dispone de overlays de propiedad, rentabilidad, condición de edificio, zoning y riesgo regulatorio;
  la selección de parcela mantiene el detalle operativo contextual.
- Las alertas no mutan el estado autoritativo: se recalculan desde la simulación y se validan
  con el contrato de proyección.

## Evidencia

### Evidence

- `packages/simulation/src/projection.ts` deriva alertas estables y ordenadas desde caja,
  préstamos, mantenimiento, permisos, subastas y ocupación.
- `packages/shared/src/projection.ts` fija el contrato de alertas para no acoplar reglas al DOM.
- `apps/web/src/App.tsx` implementa la rutina de cartera, bandeja, comparador y selector de
  overlays.
- `apps/web/src/isometric/IsometricSpikeScene.ts` colorea el mapa con las cuatro capas sin
  cambiar las reglas de simulación.
- `packages/simulation/src/phase2.test.ts` cubre la generación determinista y la validación de
  alertas; las operaciones agrupadas usan comandos existentes.

### Finding

La automatización queda reservada a trabajo repetitivo y reversible; las decisiones económicas
(comprar, construir, endeudarse, asegurar o promover política) siguen requiriendo una acción
explícita. La bandeja convierte el estado en excepciones priorizadas en vez de añadir polling o
micromanagement.

### Path

La cadena queda integrada como:

`estado autoritativo -> proyección de excepciones/comparadores -> rutina limitada -> comandos normales -> nuevo estado`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 84 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan todavía reglas de gestión persistentes, agentes de cartera autónomos para el
jugador, filtros server-side, accesibilidad completa auditada ni automatización de decisiones
económicas irreversibles. La superficie actual deja el camino preparado para esas iteraciones.
