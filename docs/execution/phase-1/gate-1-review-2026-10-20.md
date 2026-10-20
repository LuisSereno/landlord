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

Gate 1 queda en `REWORK` por evidencia faltante, no por una divergencia observada del motor:
el soak de dos horas en ambos navegadores todavía no se ha archivado. Las mediciones
cuantitativas de Worker, command/response y snapshot ya están archivadas por `pnpm audit:metrics`.
Los resultados headless, el smoke Chromium/Firefox, la determinidad, los contratos y las
fronteras arquitectónicas pasan sus comprobaciones disponibles.

## Alcance auditado

| Elemento | Estado | Evidencia |
|---|---|---|
| Workspace/tooling fijado | PASS | `pnpm install --frozen-lockfile`, lint, typecheck, test, build |
| Simulation sin DOM/React/Phaser | PASS | `scripts/check-architecture.mjs` y fixture negativo |
| PRNG/reloj/estado/comandos | PASS | tests de `packages/simulation/src` |
| Worker/protocolo v1 | PASS funcional | `worker-runtime.test.ts`, cliente tipado y entrypoint Vite |
| Snapshot/IndexedDB | PASS funcional | tests roundtrip, corrupción y schema |
| Phaser/picking/proyección | PASS smoke | tests geométricos y runner Chromium/Firefox |
| Fixture de carga | PASS | 100 edificios, 500 agentes, cuatro seeds × cinco repeticiones |
| Soak headless | PASS | `soak-baseline-2026-10-20.md` |
| Soak navegador 2 h | PENDING | comando preparado, artefacto aún no archivado |

## Checks funcionales

| Check | Resultado | Artefacto |
|---|---|---|
| Install congelado | PASS | lockfile y CI base |
| Lint | PASS | `pnpm lint` |
| Typecheck | PASS | `pnpm typecheck` |
| Unit/integration | PASS | 23 shared, 35 simulation (+1 soak skip), 13 web |
| Build producción | PASS | `pnpm build` |
| E2E Chromium | PASS smoke | browser benchmark, 180 frames |
| E2E Firefox | PASS smoke | browser benchmark, 180 frames |
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
| Frame p95 | 20 ms | Chromium 16,8; Firefox 19 | PASS smoke |
| Frame p99 | 33,3 ms | Chromium 16,9; Firefox 24 | PASS smoke |
| Snapshot | 5 MiB | 635 bytes | PASS |
| Serialize p95 | 100 ms | 0,015 ms | PASS |
| Validate + restore p95 | 500 ms | 0,171 ms | PASS |
| Memoria delta | 25 MiB | RSS +14,6 MiB headless | PASS headless |
| Memoria slope | 5 MiB/h | sin pendiente creciente headless | PASS headless |

## Deuda y acciones de rework

| ID | Acción de cierre | Evidencia requerida |
|---|---|---|
| G1-RW-01 | Ejecutar soak 2 h Chromium y Firefox | artefactos JSON con memoria/frame p95 |

G1-RW-02 y G1-RW-03 están cerrados por `pnpm audit:metrics`; sólo G1-RW-01 mantiene la
decisión `REWORK`.

No se autoriza Gate 2 hasta cerrar G1-RW-01 o emitir un ADR que cambie explícitamente el
criterio; no se modifican retrospectivamente los umbrales.

## Documentación actualizada

- `ai-context/PROJECT-STATE.md`
- `ai-context/KNOWN-GAPS.md`
- `docs/execution/02-fase-1-gate-1.md`
- `docs/execution/phase-1/benchmark-baseline-2026-10-20.md`
- `docs/execution/phase-1/soak-baseline-2026-10-20.md`
