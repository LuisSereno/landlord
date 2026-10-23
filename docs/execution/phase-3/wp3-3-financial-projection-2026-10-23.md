# WP3.3 — Modelo financiero y liquidez: baseline de proyección

Fecha: 2026-10-23
Estado: DONE para el baseline del Vertical Slice; la deuda y financiación se integraron después
en WP3.4 con cierre condicional

## Resultado del incremento

La proyección de economía expone un resumen financiero sin trasladar contabilidad al jugador:

- caja actual;
- activos derivados de caja, inventario, parcelas y edificios;
- pasivos explícitos, inicialmente `0` en este baseline y posteriormente ampliados por WP3.4;
- patrimonio derivado;
- ingresos, gastos y resultado del periodo actual a partir del libro de transacciones;
- previsión mensual de rentas y costes operativos de fábricas;
- caja de cierre prevista y déficit si la previsión no cubre los costes.

El HUD muestra el resumen como panel informativo. No crea un segundo estado financiero ni permite
editar caja desde React.

## Evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Separar caja, activos, pasivos y patrimonio | PASS en proyección | `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts` |
| Resultado y cash flow del periodo | PASS | Test de compra de parcela con resultado negativo firmado |
| Previsión de ingresos y gastos recurrentes | PASS para rentas y fábricas físicas | función `createFinancialSummary` |
| Mostrar información al jugador | PASS | panel `Resumen financiero` en `apps/web/src/App.tsx` |
| Anticipar déficit sin saldo negativo | PASS | regresión `forecasts a shortfall...` |
| Anticipar riesgo con deuda y financiación | DEFERRED en este baseline | implementado en WP3.4 |

## Límites

Este incremento no implementa préstamos, intereses, garantías, mora, deuda negativa ni cierres
contables persistidos. El campo de pasivos no debe interpretarse como un sistema bancario
terminado. Tampoco se fijan todavía ratios ni decisiones de balance: deben validarse con una
sesión de Fase 3.

## Verificación

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke:phase2
```

Todos pasan el 2026-10-23. El siguiente trabajo de esta línea fue WP3.4 — banca y deuda — para añadir pasivos
reales, calendario de amortización y escenarios de liquidez; después se conectarán los estados
financieros con fiscalidad, mantenimiento y seguros.
