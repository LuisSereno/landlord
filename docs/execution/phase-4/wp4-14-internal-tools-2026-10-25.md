# WP4.14 — Herramientas internas y balance

## Estado

`DONE` el 2026-10-25 sobre `f33c698`. Entrega el inspector de estado, el validador de catálogos, la
campaña de balance con seeds registradas, el detector de invariantes y el dataset versionado
`alpha-baseline-v1`. No cambia gameplay. Decisión en
`docs/engineering/adr/D-079-herramientas-internas-y-balance.md`.

## Baseline

- HEAD inicial: `f33c698` (`feat: delegate routine portfolio work with the same commands (WP4.13)`),
  CI remoto verde.
- No se toca la simulación: `balance.ts` es lectura derivada; los catálogos no cambian.

## Entregado

### Métricas e invariantes

- `packages/simulation/src/balance.ts`:
  - `measureBalance(state)` con quiebras, vacancia, movilidad, concentración (cuota y HHI de parcelas
    y edificios), deuda, presupuesto y fila por organización.
  - `detectInvariantViolations(state)` con cajas, inventarios, tenencia, referencias parcela↔edificio,
    préstamos, automatización, macroeventos y niveles de servicio.
- Tests: estado inicial limpio; campaña madura con vacancia, HHI y movilidad; roturas plantadas de
  cada familia; referencias huérfanas y préstamo inválido.

### Validador de datos

`data-validation.test.ts` (8 pruebas permanentes) valida edificios, segmentos de vivienda, catálogo de
ordenanzas, partidos y escaños, macroeventos, perfiles de facción, perfiles de distrito y políticas
numéricas. Un catálogo incoherente rompe CI.

### Inspector de estado

`packages/simulation/src/state-inspect.test.ts` (`pnpm state:inspect`, opt-in) resume una campaña con
`STATE_INSPECT_SEED`, `STATE_INSPECT_PARCELS` y `STATE_INSPECT_MONTHS`: balance, invariantes, conteos,
automatización, segmentos de vivienda y alertas. Sólo desarrollo; no se expone en la UI.

### Campaña y dataset

- `pnpm balance:campaign`: 8 semillas × 12 meses × 200 parcelas × cuatro estrategias (`passive`,
  `maintained`, `delegated_deferred`, `delegated_balanced`). Falla si alguna campaña rompe una
  invariante.
- `scripts/build-balance-dataset.mjs` convierte la salida cruda en
  `docs/balance/alpha-baseline-v1.json` (esquema v1, filas, agregados, comparaciones y banderas).
- `balance-dataset.test.ts` valida el esquema, recalcula las comparaciones desde las filas y exige
  cero violaciones.

### Resultados de la baseline

| Estrategia | Caja media | Vacancia media | Movilidad | Reserva municipal |
|---|---:|---:|---:|---:|
| `passive` | 4 925 564 | 3,13 % | 31,75 | 29 531 |
| `maintained` | 4 819 490 | 31,84 % | 103,63 | 26 832 |
| `delegated_deferred` | 4 933 734 | 0,00 % | 44,88 | 29 703 |
| `delegated_balanced` | 4 860 000 | 15,83 % | 135,25 | 27 553 |

- `delegated_deferred` gana a `passive` en caja en 8/8 semillas (bandera
  `automation_deferred_dominates_passive_on_cash`): la delegación es económicamente positiva.
- `maintained` pierde contra `passive` en 8/8 (bandera `maintenance_balanced_dominated_on_cash`): el
  mantenimiento equilibrado sube condición, renta y vacancia, y cuesta caja. **Es un hallazgo de
  balance, no una invariante rota**; se registra para tuning posterior y no se corrige aquí.
- Ninguna de las 32 campañas rompe invariantes.

## Verificación

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: verdes.
- Suite: 302 tests pasan, 8 skipped (incluye 8 de validación de datos, 4 de balance y 4 de dataset).
- `pnpm smoke:phase2` y `pnpm smoke:alpha`: verdes.
- CI remoto: verde en el run 40212653834, que valida `88ce688` junto con WP4.15 (el run
  específico de este commit fue cancelado por la concurrencia del push siguiente).

## No incluido

- Rebalanceo del mantenimiento: detectado y versionado, no tuneado.
- LOD: la deuda de `buildStock` sigue abierta (D-065).
