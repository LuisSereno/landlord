# Gate 2 — revisión y decisión

Fecha: 2026-10-23
Commit de referencia: `11cc8f5` + cobertura de regresión de WP3.2 en el working tree
Gate: Gate 2 / viabilidad de producto
Entorno: Node 24.19.0, pnpm 12.11.2, Chromium headless; evidencia Firefox heredada de Gate 1

## Decisión

- [ ] `GO`
- [x] `CONDITIONAL GO`
- [ ] `REWORK`
- [ ] `STOP`

El núcleo de producto queda aprobado para iniciar el Vertical Slice funcional. La condición
restante afecta exclusivamente a la producción artística representativa: WP2.14 aún está
briefado pero no ha cerrado sus renders, métricas, provenance y baseline visual. Por tanto no se
autoriza producción masiva de arte ni WP3.13 hasta cerrar ese spike; sí se puede continuar con
los work packages funcionales que no dependen de esa baseline.

La confirmación manual del responsable del proyecto ha sido `OK`. Se conserva como evidencia
cualitativa de la sesión jugable; como no se registraron duración, seeds ni métricas de decisión
en esa comunicación, esas métricas quedan como deuda de medición y no se presentan como datos
cuantitativos observados.

## Alcance y evidencia

| Elemento | Estado | Evidencia |
|---|---|---|
| WP2.1–WP2.12, bucle económico y persistencia | DONE | `docs/execution/phase-2/gate-2-baseline-2026-10-21.md` |
| WP2.13, prueba jugable y regresión | DONE con métrica cualitativa | Confirmación manual OK + suite y smoke reproducibles |
| WP2.14, dirección visual | CONDITION | `blender_artist/manifests/visual-direction-spike-kit.json` sigue en `briefed_not_rendered` |
| WP2.15, agentes, daño e incidentes | DONE | `docs/execution/phase-2/wp2-15-implementation-2026-10-22.md` |
| D-062 / WP3.2, producción física localizada | DONE para el slice actual | `docs/execution/phase-3/wp3-2-implementation-2026-10-23.md` |
| WP3.3, posición financiera y previsión de caja | DONE para baseline | `docs/execution/phase-3/wp3-3-financial-projection-2026-10-23.md` |

## Checks funcionales

| Check | Resultado |
|---|---|
| `pnpm test` | PASS — 100 tests, 3 benchmarks opt-in omitidos |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS — aviso no bloqueante de chunk web >500 kB |
| `pnpm smoke:phase2` | PASS — Chromium recorre fábrica física, crews, ampliación, ordenanza y save/load |
| `pnpm art:staging:validate` | PASS — 13 fuentes aprobadas y 11 briefs originales |
| Fronteras arquitectónicas | PASS |
| Continuación determinista y migración de save | PASS — tests de simulation |

## Performance

| Métrica | Resultado observado | Estado |
|---|---:|---|
| Tick headless p95 máximo del benchmark | 1,216 ms | PASS |
| Proyección p95 máximo del benchmark | 0,118 ms | PASS |
| Worker p95 | 0,676 ms | PASS |
| Restore de snapshot p95 | 2,858 ms | PASS |
| Benchmark | 4 seeds × 5 repeticiones × 20.000 ticks | PASS |

El benchmark completo no modifica el criterio de Gate 1 ni convierte una métrica de una máquina
en un límite universal; demuestra que la extensión táctica y la producción física no han
introducido una regresión observable frente al budget aceptado.

## Condición de entrada de Fase 3

| ID | Condición | Cierre requerido | Responsable | Fecha objetivo | Estado |
|---|---|---|---|---|---|
| G2-C01 | Cerrar WP2.14 con 2–3 direcciones originales, recorrido reproducible, métricas de legibilidad/rendimiento, provenance y recomendación | Informe de spike + manifest aprobado/rework explícito + smoke de Art Lab | Proyecto | 2026-10-24 | OPEN, sólo bloquea arte representativo |

No se abren condiciones sobre determinismo, autoridad, saves, IP o budgets técnicos. Las tareas
funcionales de Fase 3 pueden avanzar sin producir assets finales.

## Riesgos y deuda aceptada

- El bundle web inicial sigue por encima de 500 kB minificados; queda como optimización posterior.
- La medición cuantitativa del playtest humano no está registrada en este cierre; debe capturarse
  antes de balancear finanzas profundas.
- La política artística, Git LFS, cámara final, atlas y escala continúan abiertos hasta G2-C01.

## Documentación actualizada

- [x] `ai-context/PROJECT-STATE.md`
- [x] `ai-context/ROADMAP.md`
- [x] `ai-context/KNOWN-GAPS.md`
- [x] `docs/execution/README.md`
- [x] `README.md`
- [x] Evidencia específica de WP3.2
