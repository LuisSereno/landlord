# WP3.15 — Validación del slice — 2026-10-23

## Estado

`CONDITIONAL`. La validación técnica y headless del slice pasa; la decisión final de inversión
queda condicionada al cierre de WP2.14 y al playtest visual representativo que depende de él.

## Resultado

- Suite funcional: 23 tests shared, 84 tests simulation y 17 tests web; tres benchmarks opt-in
  permanecen omitidos en la suite normal.
- Arquitectura, lint, typecheck y build pasan. Vite conserva sólo el aviso informativo del
  bundle principal superior a 500 kB.
- Smoke browser de Fase 2/vertical slice pasa con servidor preview externo: compra, producción,
  crews, ampliación, ordenanza, save/load y plegado del panel.
- Benchmark headless ejecutado con un seed y una repetición sobre 20.000 ticks: tick p95
  aproximado 0,924 ms y proyección p95 aproximada 0,100 ms en el entorno de ejecución.
- Auditoría de métricas: snapshot de referencia de 11.024 bytes, serialización p95 aproximada
  0,093 ms y restore p95 aproximado 2,634 ms.
- Soak headless de 144.000 ticks pasa y verifica save/restore posterior; duración observada
  71,6 s y RSS máximo observado aproximado 292 MB en este entorno.
- Los contratos de IA, política, automatización, persistencia y worker no generan divergencias
  para la misma seed y comandos.

## Evidencia

### Evidence

- `pnpm test` y `pnpm test:architecture` pasan.
- `pnpm lint`, `pnpm typecheck` y `pnpm build` pasan.
- `PHASE2_BASE_URL=http://127.0.0.1:4174/ pnpm smoke:phase2` pasa con salida de snapshot
  resincronizado y caja observable.
- `BENCHMARK_SEEDS=1 BENCHMARK_REPETITIONS=1 pnpm benchmark` pasa con 20.000 ticks medidos.
- `pnpm audit:metrics` pasa y publica los presupuestos observados.
- `pnpm soak` pasa con 144.000 ticks y restauración final.

### Finding

El núcleo funcional es reproducible, persistente y suficientemente medido para continuar el
vertical slice. No hay base honesta para aprobar todavía la inversión artística representativa:
faltan la dirección visual, provenance, budgets y el playtest de comprensión exigidos por WP2.14.

### Path

La decisión queda trazada como:

`suite -> smoke -> benchmark -> auditoría -> soak/save-restore -> CONDITIONAL -> WP2.14 -> playtest visual -> decisión final`

## Decisión

`CONDITIONAL GO` para el trabajo funcional y de infraestructura ya cerrado. `NO-GO` temporal
para producir arte representativo o declarar la Fase 3 completamente cerrada hasta que WP2.14
aporte baseline aprobada, provenance, métricas visuales y recomendación explícita.

## Fuera de alcance

No se inventa un playtest visual ni una aprobación de arte sin WP2.14. Tampoco se ejecuta un
benchmark browser de diez minutos como gate de inversión: el smoke reproducible y las métricas
headless actuales son evidencia técnica, no sustituto de la validación visual pendiente.
