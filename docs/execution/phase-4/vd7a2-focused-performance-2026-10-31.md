# V.d-7A.2 — Focused monthly-close performance gate

Fecha: 2026-10-31. Rama: `wip/vd7-multiparcel-domain`.

## Motivo y método

La observación aislada de `system:cost` (`mature p95 = 79,43 ms`) no distinguía entre ruido de
entorno y regresión de V.d-7A.2. Este gate reutiliza exactamente `measureMonthlyCloses()` sobre la
escala sintética de 800 parcelas: ocho seeds, seis cierres longitudinales por seed y 48 muestras por
corrida. No se midieron otras escalas, ventanas, shocks macro ni housing stock.

BASE es `1afa0c8df27e25c699ab236e950447a7fdc4f52f`; WIP es `b78e04f39b3d085da6e36fb65890a7b8dafb1437`.
Node `v24.19.0`, pnpm `12.11.2`, misma máquina y ejecuciones secuenciales. En el worktree base se
copió sólo el archivo de infraestructura del gate, sin modificar código funcional.

## Resultados

| Run | BASE p50 | BASE p95 | WIP p50 | WIP p95 |
|---|---:|---:|---:|---:|
| 1 | 39,75 ms | 51,83 ms | 39,14 ms | 54,89 ms |
| 2 | 38,12 ms | 47,48 ms | 37,02 ms | 46,70 ms |
| 3 | 40,97 ms | 54,95 ms | 40,84 ms | 59,60 ms |

Medianas de las tres corridas:

- BASE: mean `39,97 ms`, p50 `39,75 ms`, p95 `51,83 ms`, max `58,39 ms`.
- WIP: mean `40,67 ms`, p50 `39,14 ms`, p95 `54,89 ms`, max `55,29 ms`.
- Delta p50: `-1,53 %`.
- Delta p95: `+5,91 %`.

## Decisión

`PERFORMANCE PASS`: la mediana WIP p95 (`54,89 ms`) permanece por debajo del presupuesto de 60 ms;
la diferencia frente a BASE está por debajo del umbral de regresión material. La observación aislada
de 79,43 ms queda superseded by paired focused measurement, conservada como dato histórico en el
acta V.d-7A.

## Evidencia y deuda

Los seis JSON de cada corrida están en `docs/execution/phase-4/perf/`; el resumen reproducible es
`vd7a2-system-cost-comparison.json`. El generador urbano no se modificó: las 12 seeds canónicas
conservan sites naturales de Acería. V.d-7B sigue pendiente y fuera de alcance.
