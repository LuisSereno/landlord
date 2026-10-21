# Acta de revisión Gate 1 — 2026-10-20

## Identificación

- Gate: Gate 1 — viabilidad técnica
- Engine/toolchain: Node 24.19.0, pnpm 12.11.2, engine `gate1-dev`
- Commit auditado: `fe27dff`
- Responsable técnico: Codex
- Entornos: Linux x86_64, Intel i7-10510U, 16 GiB; Chromium 156 headless; Firefox 157 headless

## Decisión

- [ ] `GO`
- [ ] `CONDITIONAL GO`
- [x] `REWORK`
- [ ] `STOP`

Gate 1 queda en `REWORK`. La revisión posterior detectó que el benchmark original detenía los
agentes al completar su primera ruta y que el runner browser abría una aplicación sin la carga
de referencia sobre Vite de desarrollo. Esas mediciones no certifican D-052. El fixture continuo
en Worker + Phaser y el servidor de producción ya están implementados; faltan las ejecuciones
prolongadas y la instrumentación browser restante.

## Alcance auditado

| Elemento | Estado | Evidencia |
|---|---|---|
| Workspace/tooling fijado | PASS | `pnpm install --frozen-lockfile`, lint, typecheck, test, build |
| Simulation sin DOM/React/Phaser | PASS | `scripts/check-architecture.mjs` y fixture negativo |
| PRNG/reloj/estado/comandos | PASS | tests de `packages/simulation/src` |
| Worker/protocolo v1 | PASS funcional | `worker-runtime.test.ts`, cliente tipado y entrypoint Vite |
| Snapshot/IndexedDB | PASS funcional | tests roundtrip, corrupción y schema |
| Phaser/picking/proyección | PASS smoke | tests geométricos y runner Chromium/Firefox |
| Fixture de carga continuo | PENDING retest | 100 edificios, 500 agentes, A* y reasignación determinista de destinos |
| Soak headless | PASS | `soak-baseline-2026-10-20.md` |
| Soak navegador 2 h (Chromium) | PENDING | runner de producción, artefacto aún no archivado |

## Checks funcionales

| Check | Resultado | Artefacto |
|---|---|---|
| Install congelado | PASS | lockfile y CI base |
| Lint | PASS | `pnpm lint` |
| Typecheck | PASS | `pnpm typecheck` |
| Unit/integration | PASS | 23 shared, 35 simulation (+1 soak skip), 13 web |
| Build producción | PASS | `pnpm build` |
| E2E Chromium | PASS smoke | fixture continuo, build de producción, 90 frames |
| E2E Firefox | PASS smoke | fixture continuo, build de producción, 90 frames |
| Determinismo | PASS | golden/runner y benchmark digest |
| Save/load/corrupción | PASS | snapshot + IndexedDB tests |
| Fronteras arquitectónicas | PASS | check positivo y fixture negativo |
| Revisión IP | PASS | sólo geometría y colores originales, sin assets externos |

## Performance

| Métrica | Umbral | Resultado disponible | Estado |
|---|---:|---:|---|
| Tick headless p95 | 10 ms | ≤ 0,106 ms | PASS |
| Tick headless p99 | 20 ms | ≤ 0,165 ms | PASS |
| Ticks > 50 ms | 0,1 % | 0 observado | PASS |
| Worker p95 | 12 ms | 0,254 ms | PASS |
| Command/response p95 | 100 ms | 0,254 ms | PASS |
| Frame p95 | 20 ms | Chromium 17; Firefox 18 | PASS smoke |
| Frame p99 | 33,3 ms | Chromium 17,3; Firefox 19 | PASS smoke |
| Snapshot | 5 MiB | 635 bytes | PASS |
| Serialize p95 | 100 ms | 0,015 ms | PASS |
| Validate + restore p95 | 500 ms | 0,171 ms | PASS |
| Memoria delta | 25 MiB | RSS +14,6 MiB headless | PASS headless |
| Memoria slope | 5 MiB/h | sin pendiente creciente headless | PASS headless |

## Deuda y acciones de rework

| ID | Acción de cierre | Evidencia requerida |
|---|---|---|
| G1-RW-01 | Retest headless continuo | cinco repeticiones por seed con A* sostenido |
| G1-RW-02 | Ejecutar browser 10 min Chromium y Firefox | artefactos de frame, Worker y memoria disponible |
| G1-RW-03 | Ejecutar soak 2 h Chromium | artefactos JSON con memoria/frame p95, hash y save/load |
| G1-RW-04 | Completar instrumentación browser | command/response, backlog, proyección y save/load |

No se autoriza Gate 2 hasta cerrar G1-RW-01 a G1-RW-04 o emitir un ADR que cambie explícitamente el
criterio; no se modifican retrospectivamente los umbrales.

## Documentación actualizada

- `ai-context/PROJECT-STATE.md`
- `ai-context/KNOWN-GAPS.md`
- `docs/execution/02-fase-1-gate-1.md`
- `docs/execution/phase-1/benchmark-baseline-2026-10-20.md`
- `docs/execution/phase-1/soak-baseline-2026-10-20.md`
