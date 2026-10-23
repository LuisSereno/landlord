# WP3.7 — Seguros y eventos cubiertos — 2026-10-23

## Estado

`DONE`. La economía del slice incorpora una aseguradora independiente, ofertas comparables,
primas automáticas, exclusiones explícitas y siniestros trazables.

## Resultado

- Se añadió la organización aseguradora `org_00000005` con tesorería separada.
- Se modelaron dos productos data-driven: `fire_basic` cubre deterioro/incendio con menor límite
  y excluye sabotaje y explosión; `fire_plus` cubre también sabotaje, con mayor prima, límite y
  franquicia. Ambos excluyen explosión.
- La prima inicial se cobra al contratar y la prima recurrente se liquida cada mes. Si no hay caja,
  la póliza pasa a `lapsed` y no se mantiene una cobertura ficticia.
- La póliza puede cancelarse sin devolver primas ya pagadas.
- Los eventos de deterioro, sabotaje y blast generan un registro de claim. El claim conserva
  evento, edificio, cobertura, pérdida estimada, resultado y pago. El pago respeta franquicia,
  límite, exclusión y liquidez de la aseguradora.
- Las primas aparecen en la previsión de gastos; los pagos de siniestros recorren el libro de caja.
- El HUD muestra pólizas activas y permite comparar/contratar/cancelar cobertura desde el edificio
  seleccionado.
- El contrato y el histórico de claims se serializan y restauran de forma aditiva.

## Evidencia

### Evidence

- `packages/simulation/src/phase2.test.ts` cubre prima inicial y mensual, claim cubierto,
  exclusiones, impago, cancelación, proyección y persistencia.
- `packages/simulation/src/systems.ts` liquida primas y crea el claim al generarse un incidente.
- `packages/shared/src/domain.ts`, `packages/shared/src/snapshot.ts` y
  `packages/shared/src/projection.ts` fijan contratos y schemas v1 aditivos.

### Finding

El seguro reduce la pérdida esperada a cambio de un coste periódico, pero no elimina el riesgo:
la cobertura puede excluir el origen del evento, agotar su límite, exigir franquicia o caducar si
la organización no puede pagar.

### Path

La cadena queda integrada como:

`riesgo del edificio -> oferta -> prima -> evento -> exclusión/franquicia/límite -> claim y caja`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 75 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementa todavía un mercado asegurador dinámico, reaseguro, valoración actuarial avanzada
ni coberturas de vida/persona. Las coberturas se limitan a los eventos físicos del vertical slice.
