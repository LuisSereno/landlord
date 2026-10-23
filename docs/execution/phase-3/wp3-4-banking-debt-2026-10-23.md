# WP3.4 — Banca y deuda — 2026-10-23

## Decisión

`CONDITIONAL DONE` para el Vertical Slice. El núcleo de financiación es jugable y
determinista; la refinanciación, ejecución de garantías y reestructuración avanzada se
mantienen en WP3.9, donde se tratarán junto a las crisis económicas.

## Entregado

- Banco independiente `org_00000003`, con balance propio y sin control del jugador.
- Préstamo con principal, tipo anual en puntos básicos, plazo, parcela en garantía,
  estado, calendario, saldo pendiente e impagos.
- Flujo explícito `RequestLoan` → `LoanOffered` → `AcceptLoanOffer` →
  `LoanAccepted`.
- Política de riesgo data-driven: importe mínimo/máximo, plazos permitidos, LTV de la
  garantía y techo de deuda acumulada.
- Amortización mensual entera y determinista: principal proporcional al saldo restante más
  interés redondeado hacia arriba.
- Mora por falta de caja; segundo vencimiento impagado conduce a `defaulted`. No se crea
  saldo negativo ni se ejecuta todavía la parcela.
- Pasivos, previsión de cuotas y estado de préstamos integrados en la proyección financiera.
- Calendario y contador de préstamos persistidos. `nextPaymentTick` evita doble cobro después
  de save/load.
- HUD operativo para solicitar una oferta sobre una parcela propia y aceptarla.

## Evidencia

- `packages/simulation/src/phase2.test.ts`: garantía, conservación de masa monetaria,
  amortización única por vencimiento, mora/default y round-trip de snapshot.
- Suite completa de simulación: 65 tests OK; 3 benchmarks opt-in omitidos.
- `pnpm typecheck`: OK.
- `pnpm format:check`: OK tras la implementación.
- La proyección excluye el desembolso de ingreso operativo y conserva el pasivo en balance.

## Condición abierta

`G3-04`: la refinanciación limitada, ejecución de garantía y recuperación ante default no se
implementan en este incremento. No bloquean WP3.5 ni WP3.6; deben resolverse en WP3.9 antes de
cerrar la economía de crisis.
