# WP4.13 — Automatización, delegación y Gameplay LOD mínimo

## Estado

`DONE` el 2026-10-25 sobre `d13a92b`. Los gestores de propiedad, finanzas y mantenimiento delegan la
rutina con los mismos comandos y permisos; la bandeja de excepciones existente se reutiliza y se
extiende; la carga rutinaria se mide en carteras de 50, 200 y 800 parcelas. No se introduce LOD nuevo
ni `ControlContext` sin consumidor. Decisión en
`docs/engineering/adr/D-078-delegacion-y-excepciones.md`.

## Baseline

- HEAD inicial: `d13a92b` (`perf: optimize placeSearchers exactly and re-measure`), CI remoto verde.
- No se toca `placeSearchers` ni `buildStock`: la deuda de rendimiento de D-065 queda para la
  evaluación de LOD, con `buildStock` como hotspot medido.

## Entregado

### Estado y comando

- `AutomationState` en shared: `property: manual | fill_vacancies`,
  `finance: manual | cover_shortfall`, `maintenanceRepairThreshold: 0–100 | null` y
  `financeCashFloor`. Por defecto, manual y sin reparación automática.
- `SetAutomationPolicy` con payload parcial; valida los mismos rangos que la proyección.
- Persistencia aditiva en `phase2.automation`; las partidas anteriores restauran la política manual.

### Gestores

- Sistema `automation` en `PRODUCT_SYSTEMS` después de `rival`, sólo en fronteras de día y sólo para
  la organización del jugador.
- **Propiedad:** hasta tres `AssignTenant` diarios en unidades propias compatibles; respeta tipo
  preferido, capacidad y presupuesto.
- **Finanzas:** si la caja cae bajo el suelo y no hay deuda viva, `RequestLoan` con una parcela libre
  como garantía (importe del descubierto y el mínimo como segundo intento) y `AcceptLoanOffer`.
- **Mantenimiento:** una `RepairBuilding` diaria bajo el umbral si la caja cubre el coste sin
  perforar el suelo, más `AssignCrewToWorkOrder` con una cuadrilla libre. Sin cuadrilla, la obra
  queda en cola; no hay progreso inventado.
- Todos los efectos pasan por `dispatchProductCommand`, con la persona y la organización del jugador.
  Los tests cubren presupuesto insuficiente, falta de garantía, deuda viva, caja insuficiente y una
  organización ajena.

### Bandeja de excepciones

- Se reutiliza `economy.alerts` (ya priorizada) y se añade el edificio sin seguro con riesgo de
  deterioro alto.
- `automation.routineTaskCount` cuenta la rutina total antes de delegar; el informe interno
  `describeAutomation` conserva el desglose completo por tipo antes del tope de 20 entradas.
- La UI muestra las políticas, el número de tareas y botones para activar/desactivar cada gestor.

### Medición de la rutina

Campañas sintéticas de 50, 200 y 800 parcelas maduradas seis meses, con un inquilino disponible por
plaza vacía del jugador (`AUTOMATION_LOAD=1`):

| Parcelas | Plazas vacías (interacciones manuales) | Interacciones del jugador con gestor | Plazas resueltas en 10 días |
|---:|---:|---:|---:|
| 50 | 6 | 0 | 4 |
| 200 | 28 | 0 | 21 |
| 800 | 121 | 0 | 17 |

La rutina crece con la cartera; las interacciones del jugador no. El gestor trabaja a un ritmo
acotado (tres asignaciones diarias) y deja cola, que es el comportamiento declarado.

### Persistencia y digestos

- `canonicalizeState` incluye `phase2.automation`; los diez digestos se regeneran por superficie.
  Atribución verificada: eliminando la clave `automation` del estado canónico nuevo recuperan
  exactamente los valores de WP4.12-R (`f7867a5a1e57fdd9`, `26267ba2389a386f`, `9cc24e739ecde8bf`,
  `d766a1f2d895a5cd`, `0281775ece6fa189`, `6940184eb08761a5`, `74d9cf8b0fe0ecc0`, `ed5e94dedebe2ea8`,
  `8b4904c945c9f8ff`, `94b9cc664d254f39`). La política por defecto es manual, así que no hay delta
  económico.
- Snapshot: roundtrip con la política activa y restauración de una partida anterior sin el bloque.

## Verificación

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: verdes.
- Suite: 286 tests pasan, 6 skipped (incluye 11 de automatización).
- `pnpm smoke:phase2` y `pnpm smoke:alpha`: verdes.
- CI remoto: se confirma al subir el commit.

## No incluido

- LOD nuevo: `buildStock` sigue siendo el hotspot medido (17,6 ms de mediana por sí solo en la ciudad
  madura). Es el candidato exacto antes de aproximar, y su evaluación pertenece a la deuda de D-065.
- `ControlContext`: no existe una segunda perspectiva ni un consumidor real; se documenta como
  evolución.
