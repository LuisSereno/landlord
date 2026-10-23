# WP3.6 — Mantenimiento y deterioro — 2026-10-23

## Estado

`DONE`. El mantenimiento recurrente queda automatizado, es configurable por política y
mantiene sus obligaciones en el snapshot v1. La reparación existente continúa siendo la vía
manual para recuperar una condición degradada.

## Resultado

- Se añadió una política de mantenimiento `balanced`/`deferred` y el comando
  `SetMaintenancePolicy`.
- Cada liquidación mensual aplica desgaste a los edificios y liquida el coste por tipo de activo.
  La política equilibrada intenta el débito automáticamente; si no hay caja, conserva el importe
  como backlog sin permitir saldos negativos.
- La política diferida no realiza el débito y acumula el coste pendiente por edificio.
- La condición afecta progresivamente a renta, valor patrimonial y probabilidad de deterioro.
  La satisfacción de tenants y la producción ya reaccionaban a la condición y permanecen
  conectadas al mismo estado autoritativo.
- La proyección muestra política, próxima liquidación, carga mensual, backlog, coste base y
  obligación pendiente por edificio.
- La UI permite cambiar la política una vez por decisión, sin convertir el mantenimiento
  rutinario en una secuencia de pagos por edificio.
- La serialización restaura calendario, política y backlog sin doble liquidación.

## Evidencia

### Evidence

- `packages/simulation/src/phase2.test.ts` cubre liquidación automática, recuperación de
  condición, diferimiento, backlog, falta de caja, proyección y save/load.
- `packages/simulation/src/systems.ts` centraliza la liquidación mensual y el riesgo progresivo
  de deterioro.
- `packages/shared/src/domain.ts` y `packages/shared/src/projection.ts` validan el contrato de
  política y la información visible de mantenimiento.

### Finding

El mantenimiento es una decisión de liquidez: equilibrar conserva los activos y paga el servicio
automáticamente; diferir conserva caja hoy pero reduce condición, renta y valoración, acumula una
obligación y eleva el riesgo de incidente.

### Path

La cadena queda integrada como:

`política -> liquidación mensual -> condición/backlog -> renta, satisfacción, valor, producción y riesgo`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 72 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo ya conocido sobre el tamaño del bundle principal.

## Fuera de alcance

La selección de técnicos y la reparación física ya existente no se reemplazan por un sistema de
órdenes nuevo. La cobertura de seguros corresponde a WP3.7; refinanciación, ejecución y crisis de
deuda avanzada corresponden a WP3.9.
