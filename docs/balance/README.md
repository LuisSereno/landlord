# Datasets de balance

Resultados de campañas headless con seeds registradas, comparables entre commits y versionados en
Git. El esquema está validado por `packages/simulation/src/balance-dataset.test.ts`; la campaña se
ejecuta con `pnpm balance:campaign` y el dataset se construye con
`node scripts/build-balance-dataset.mjs <salida-vitest.txt> docs/balance/<id>.json`.

## alpha-baseline-v1.json

- Motor: commit `f33c698` (WP4.13).
- Semillas: `[1, 2, 3, 4, 5, 6, 7, 8]`.
- Campaña: 12 meses por semilla, distrito sintético de 200 parcelas, seed de generación 7.
- Estrategias:
  - `passive`: mantenimiento diferido, sin automatización.
  - `maintained`: mantenimiento equilibrado, sin automatización.
  - `delegated_deferred`: gestores de propiedad y finanzas activos, mantenimiento diferido.
  - `delegated_balanced`: gestores activos y mantenimiento equilibrado con reparación bajo 40 %.
- Métricas por fila: caja del jugador, vacancia, cuota de la organización con más parcelas, HHI de
  parcelas, movilidad total del mercado, deuda viva, préstamos impagados, reserva municipal y meses
  en déficit.

### Lectura de la baseline

- **La delegación es económicamente positiva**: `delegated_deferred` gana a `passive` en caja en las
  8 semillas (media 4 933 734 frente a 4 925 564) y elimina la vacancia medida (0 % frente a 3,13 %).
- **Hallazgo de balance, no invariante rota**: `maintained` pierde contra `passive` en 8/8 semillas
  (media 4 819 490 frente a 4 925 564) porque el mantenimiento equilibrado sube la condición, la
  renta y la vacancia (31,84 % frente a 3,13 %) y además cuesta caja. La bandera
  `maintenance_balanced_dominated_on_cash` lo registra para tuning posterior; no se corrige en
  WP4.14 porque este WP entrega detección, no rebalanceo.
- **Sin invariantes rotas** en ninguna de las 32 campañas (`violations: []`).
- La comparación `delegated_balanced` contra `delegated_deferred` pierde 8/8: con la misma
  delegación, el mantenimiento equilibrado sigue siendo peor en caja que el diferido en este
  escenario sintético.

### Regenerar

```bash
pnpm balance:campaign > /tmp/balance-campaign.log
BALANCE_COMMIT=$(git rev-parse --short HEAD) \
  node scripts/build-balance-dataset.mjs /tmp/balance-campaign.log docs/balance/alpha-baseline-v1.json
pnpm vitest run packages/simulation/src/balance-dataset.test.ts
```

La campaña es determinista para las mismas seeds y el mismo commit; el dataset debe coincidir salvo
`generatedAt`.
