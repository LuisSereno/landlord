# Acta de revisión Gate 1 — 2026-10-20

## Identificación

- Gate: Gate 1 — viabilidad técnica
- Engine/toolchain: Node 24.19.0, pnpm 12.11.2, engine `gate1-dev`
- Commit auditado: `fe27dff`
- Responsable técnico: Codex
- Entornos: Linux x86_64, Intel i7-10510U, 16 GiB; Chromium 156 headless; Firefox 157 headless

## Decisión

- [x] `GO`
- [ ] `CONDITIONAL GO`
- [ ] `REWORK`
- [ ] `STOP`

Gate 1 queda en `GO`. El rework técnico del 2026-10-21 cerró el fixture continuo y la
instrumentación de comandos, backlog, proyección y save/load. La optimización final dejó Chromium
en 18,6 ms de frame p95 a la cadencia máxima de D-052 (10 Hz), dentro del umbral. La evidencia
completa está en `gate-1-retest-2026-10-21.md`.

## Alcance auditado

| Elemento | Estado | Evidencia |
|---|---|---|
| Workspace/tooling fijado | PASS | `pnpm install --frozen-lockfile`, lint, typecheck, test, build |
| Simulation sin DOM/React/Phaser | PASS | `scripts/check-architecture.mjs` y fixture negativo |
| PRNG/reloj/estado/comandos | PASS | tests de `packages/simulation/src` |
| Worker/protocolo v1 | PASS funcional | `worker-runtime.test.ts`, cliente tipado y entrypoint Vite |
| Snapshot/IndexedDB | PASS funcional | tests roundtrip, corrupción y schema |
| Phaser/picking/proyección | PASS smoke | tests geométricos y runner Chromium/Firefox |
| Fixture de carga continuo | PASS retest | 100 edificios, 500 agentes, A* y reasignación determinista; cuatro seeds × cinco repeticiones |
| Soak headless | PASS | `soak-baseline-2026-10-20.md` |
| Browser 10 min (Firefox) | PASS | 10 min a 10 Hz, sin errores ni divergencias |
| Browser 10 min (Chromium) | PASS | p95 18,6 ms; p99 22,8 ms a 10 Hz |
| Soak navegador reducido (Chromium) | PASS estabilidad | 30 min medidos + 10 min warm-up a 2 Hz; no sustituye el frame gate a 10 Hz |

## Checks funcionales

| Check | Resultado | Artefacto |
|---|---|---|
| Install congelado | PASS | lockfile y CI base |
| Lint | PASS | `pnpm lint` |
| Typecheck | PASS | `pnpm typecheck` |
| Unit/integration | PASS | 23 shared, 37 simulation (+3 skips explícitos), 13 web |
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
| Frame p95 | 20 ms | Chromium 18,6; Firefox 18 | PASS retest |
| Frame p99 | 33,3 ms | Chromium 22,8; Firefox 19 | PASS retest |
| Snapshot | 5 MiB | Chromium 463.491 bytes | PASS |
| Serialize p95 | 100 ms | Chromium 2,7 ms | PASS |
| Validate + restore p95 | 500 ms | Chromium 4,8 ms | PASS |
| Memoria delta | 25 MiB | heap estable/baja en soak Chromium | PASS |
| Memoria slope | 5 MiB/h | sin pendiente creciente en 30 min | PASS |

## Deuda y acciones de rework

| ID | Acción de cierre | Evidencia requerida |
|---|---|---|
| G1-RW-01 | Retest headless continuo | CERRADO: cuatro seeds × cinco repeticiones, A* sostenido |
| G1-RW-02 | Ejecutar browser 10 min Chromium y Firefox | CERRADO: ambos pasan a 10 Hz |
| G1-RW-03 | Ejecutar soak Chromium | CERRADO como estabilidad: 30 min medidos + 10 min warm-up; decisión explícita de reducción |
| G1-RW-04 | Completar instrumentación browser | CERRADO: command/response, backlog, proyección, snapshot y continuación |

Gate 1 queda aprobado para iniciar Gate 2. Los umbrales no se modifican retrospectivamente. La
reducción de duración del soak está registrada como decisión operativa de esta fase, no como cambio
de D-052.

## Documentación actualizada

- `ai-context/PROJECT-STATE.md`
- `ai-context/KNOWN-GAPS.md`
- `docs/execution/02-fase-1-gate-1.md`
- `docs/execution/phase-1/benchmark-baseline-2026-10-20.md`
- `docs/execution/phase-1/soak-baseline-2026-10-20.md`
- `docs/execution/phase-1/gate-1-retest-2026-10-21.md`
