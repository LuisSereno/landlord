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

## Nota de revisión (2026-10-25) — el dataset entregado era carga, no balance

Una auditoría externa del WP4.14 concluyó que `alpha-baseline-v1.json` no es una baseline de balance de
gameplay, y tiene razón. La campaña construye el mundo con `createScaledCity(seed, { parcelCount: 200 })`
de `packages/simulation/src/system-cost.ts`, que es un arnés de carga: inyecta `HARNESS_BALANCE =
5 000 000` de caja al jugador y al rival, `HARNESS_INVENTORY_CAPACITY = 1 000 000` y regala parcelas,
edificios, fábricas, inquilinos con contrato, préstamos, cuadrillas y agentes que el jugador nunca
compró ni construyó. El propio módulo lo documenta: la ciudad sintética es carga, no balance. Con cinco
millones iniciales `financeCashFloor = 2000` no se activa nunca, las diferencias entre estrategias las
domina la ocupación automática de una cartera ya montada y las cajas finales del jugador quedan en
4,8–5,0 millones, es decir, en el entorno del regalo inicial. En el juego real se arranca con
`parseMoney(12000)` (`packages/simulation/src/state.ts`).

### Qué se corrige

- **El dataset se renombra y se etiqueta.** `docs/balance/alpha-baseline-v1.json` pasa a
  `docs/balance/synthetic-city-balance-v1.json` con `datasetId: "synthetic-city-balance-v1"`,
  `worldKind: "synthetic_load_harness"` y un campo `usage` que dice por sí solo que es un arnés de carga
  y remite a la baseline jugable. La campaña sintética **no se borra**: sigue siendo el único test de
  esfuerzo que somete `measureBalance` y `detectInvariantViolations` a 200 parcelas. Se regeneró con su
  pipeline real y las 32 filas coinciden exactamente con las publicadas sobre `f33c698`.
- **Se añade la campaña jugable.** `packages/simulation/src/balance-playable.test.ts`
  (`pnpm balance:playable`, opt-in con `PLAYABLE_BALANCE_CAMPAIGN=1`) arranca de
  `createInitialState(seed)` —distrito generado, 12 000 de caja, inventario y cuadrillas autoradas— y
  sólo actúa mediante comandos reales despachados como `person_00000001` / `PLAYER_ORGANIZATION_ID`. Las
  cuatro políticas se fijan con `SetMaintenancePolicy` y `SetAutomationPolicy`; la campaña no muta
  `state.phase2.*` para dar ventajas. Comparten una rutina de crecimiento idéntica (parcela asequible →
  materiales → permiso → obra → cuadrilla, un ciclo por día mientras la caja cubra el coste exacto), así
  que la diferencia mide la política y no la habilidad del script. 16 semillas × 12 meses × 4
  estrategias, 62-68 s reales en dos ejecuciones; la campaña repite una semilla por estrategia y
  exige el mismo resultado byte a byte.
- **El dataset jugable audita sus comandos.** `playable-alpha-baseline-v1.json` publica `commandAudit`
  por estrategia y tipo con aceptados, rechazados y códigos de rechazo. En las 64 campañas: 262
  `BuyParcel`, 262 `RequestPermit`, 262 `StartConstruction`, 262 `AssignCrewToWorkOrder` y 338
  `BuyMaterials` aceptados, cero rechazos. Ninguna estrategia quedó bloqueada en silencio.
- **El pipeline genera los dos.** `scripts/build-balance-dataset.mjs` acepta `--dataset
  synthetic|playable` y, si no se indica, lo deduce del marcador de la salida.
  `balance-dataset.test.ts` valida los dos archivos versionados.

### El hallazgo de mantenimiento queda rebajado a señal fuerte

La conclusión "`balanced maintenance` está dominada" **no se sostiene para una campaña jugable** y queda
rebajada a **señal fuerte para investigar**:

- En el arnés de carga: `maintained` pierde contra `passive` en 8/8 semillas (4 819 490 frente a
  4 925 564 de caja media, 31,84 % de vacancia frente a 3,13 %). La bandera
  `maintenance_balanced_dominated_on_cash` se conserva en ese dataset por trazabilidad, pero describe el
  arnés.
- En la campaña jugable: `maintained` gana a `passive` en 4 de 16 semillas (pierde en 12), muy por
  debajo del umbral de dominancia de 15/16, y su caja media es 1 657,69 frente a 3 433,38 con 4,00
  edificios frente a 3,13 y 15 712,56 de valor de catálogo frente a 12 375,31. Es decir: gasta más en
  mantener y lo convierte en activos, no en caja.
- Además, la caja final no es riqueza cuando la rutina reinvierte todo lo que puede:
  `delegated_balanced` es la peor en caja (1 253,56) y la mejor en valor de catálogo (19 431,88).

### Dominancia en la campaña jugable

Ninguna estrategia domina. Ganadoras por semilla sobre caja final: `passive` 8, `delegated_deferred` 5,
`maintained` 2, `delegated_balanced` 1. Comparaciones por parejas (umbral 15/16):
`delegated_deferred` contra `passive` 6/16; `maintained` contra `passive` 4/16; `delegated_balanced`
contra `delegated_deferred` 3/16. Cero invariantes rotas en las 64 campañas y cero préstamos impagados.
La delegación sí elimina la vacancia medida (0 % frente a 6,25 %) y añade 500 de deuda viva del jugador,
pero no compra caja por sí sola. El dataset lo declara con `dominance.anyDominant: false` y las banderas
`no_dominant_strategy_in_playable_campaign`, `maintenance_balanced_cash_signal_to_investigate` y
`automation_deferred_has_no_cash_advantage_playable`.

Lo que **sigue firme** de este acta: `measureBalance`, `detectInvariantViolations`, el validador de
catálogos y el inspector de estado. Ningún número de gameplay se ajustó entonces ni ahora.

