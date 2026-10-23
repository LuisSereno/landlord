# WP3.15 — Validación del slice — 2026-10-23

## Estado

`DONE — GO CONTROLLED ALPHA`. La validación técnica, headless y visual representativa pasa.
La confirmación manual del responsable fue OK. La decisión de inversión es avanzar a una Alpha
controlada, manteniendo explícitas las mediciones de producto que deben recogerse con más sesiones.

## Resultado

- Suite funcional: 23 tests shared, 84 tests simulation y 17 tests web; tres benchmarks opt-in
  permanecen omitidos en la suite normal.
- Arquitectura, lint, typecheck y build pasan. Vite conserva sólo el aviso informativo del
  bundle principal superior a 500 kB.
- Smoke browser de Fase 2/vertical slice pasa con servidor preview externo: compra, producción,
  crews, ampliación, ordenanza, save/load y plegado del panel.
- Benchmark headless ejecutado con un seed y una repetición sobre 20.000 ticks: tick p95
  aproximado 0,905 ms y proyección p95 aproximada 0,096 ms en el entorno de ejecución.
- Auditoría de métricas: snapshot de referencia de 11.024 bytes, serialización p95 aproximada
  0,090 ms y restore p95 aproximado 2,287 ms.
- Soak headless de 144.000 ticks pasa y verifica save/restore posterior; duración observada
  71,6 s y RSS máximo observado aproximado 292 MB en este entorno.
- Los contratos de IA, política, automatización, persistencia y worker no generan divergencias
  para la misma seed y comandos.
- WP2.14 está cerrado con baseline `graphic_civic`, tres direcciones comparables, provenance,
  metadata y Art Lab.
- WP3.13 está cerrado con contenido representativo, audio procedural original y smoke de Art Lab:
  `pnpm art:spike:validate` y `pnpm smoke:art-lab` pasan.
- La prueba manual del responsable comunicada en esta ejecución fue OK; se conserva como
  evidencia cualitativa de comprensión del slice, no como sustituto de una muestra estadística.

## Evidencia

### Evidence

- `pnpm test` y `pnpm test:architecture` pasan.
- `pnpm lint`, `pnpm typecheck` y `pnpm build` pasan.
- `PHASE2_BASE_URL=http://127.0.0.1:4174/ pnpm smoke:phase2` pasa con salida de snapshot
  resincronizado y caja observable.
- `BENCHMARK_SEEDS=1 BENCHMARK_REPETITIONS=1 pnpm benchmark` pasa con 20.000 ticks medidos.
- `pnpm audit:metrics` pasa y publica los presupuestos observados.
- `pnpm soak` pasa con 144.000 ticks y restauración final.
- `pnpm art:spike:validate` pasa hashes, RGBA16, dimensiones, kit y baseline.
- `pnpm smoke:art-lab` pasa carga natural de las tres direcciones y captura visual.

### Finding

El núcleo funcional y la presentación representativa son reproducibles, persistentes y
suficientemente estables para una Alpha controlada. El límite honesto es de producto: una sola
confirmación manual OK no estima retención, balance a 30–60 minutos ni comprensión poblacional.

### Path

La decisión queda trazada como:

`suite -> smoke -> benchmark -> auditoría -> soak/save-restore -> WP2.14 -> WP3.13 -> confirmación manual OK -> GO CONTROLLED ALPHA`

## Decisión

`GO CONTROLLED ALPHA`. La Fase 3 queda cerrada para el alcance del Vertical Slice. La Alpha debe
recoger antes de ampliar contenido: duración efectiva de sesión, primera parcela/obra/ingreso,
decisiones estratégicas frente a tareas repetitivas, comprensión de overlays y carga operativa,
con seeds y cohortes registrados.

## Fuera de alcance

No se inventa una significancia estadística a partir de una única prueba manual. El siguiente
incremento debe instrumentar sesiones reales de Alpha y mantener la telemetría local consentida;
no exige bloquear la ejecución del slice ya validado.
