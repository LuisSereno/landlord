## Summary

Integra `wip/vh-world-visual-foundation` (243 commits, `develop` es ancestro → sin conflictos) a
`develop`: World Visual Foundation (V.h/V.j/V.k/V.l), colocación interactiva V.d-7C y el hardening de
integración con D-106 (solares de mercado accionables) y los gates A–G.

- **D-106:** evaluación pura y única de sitio accionable compartida con comando/UI/IA/automatización;
  el residuo sin jugada legal se fusiona (mayor borde compartido, veto morfológico, anclas preservadas)
  o deja de comercializarse. Garantía ciudad-global de acería (`STEELWORKS_SITE_MISSING`).
- **Gate A:** `pnpm test` 0 failed (shared 80, sim 593, web 277) + guard de arquitectura.
- **Gate B:** sweep 60 seeds — 0 solares sin jugada, 0 complejos multi-parcela incompletos, 9 tipos
  privados disponibles ciudad-global. Evidencia: `vd7c-placement-reachability.json`.
- **Gate C:** aceptación vial v2/ave3/full/motorway (roles, laneSense, medianas, intersecciones,
  costuras); cobertura y valor leen el corredor en v4.
- **Gate D:** pixel QA sobre Phaser real (27+5+3 capturas + 8 viales), revisadas una a una, 0 pageerrors.
- **Gate E:** `gameplay:acceptance` con comandos reales (9 tipos + acería multi-parcela, renta,
  reparación, incendio→ruina→ClearRuin, save/load idempotente, automatización). Determinismo verificado.
- **Gate F:** `balance:playable`, `services:balance`, `system:cost:monthly` verdes; cierre mensual
  maduro p95 38,47 ms (800 parcelas).

## Test plan

- [x] `pnpm lint` / `typecheck` / `test` / `format:check`
- [x] `pnpm art:licenses:check` / `art:jobs:validate`
- [x] Gates B–F (ver acta `integration-hardening-2026-11-12.md`)
- [ ] `pnpm build` + smokes Chromium (`smoke:phase2`, `smoke:alpha`, `smoke:art-lab`)
- [ ] `pnpm art:blender:check` / `art:binaries:check`
- [ ] `pnpm fabric:gate`

## Bloqueantes / decisiones pendientes (no mergear hasta resolver)

- **⛔ `art:binaries:check` (D-105, preexistente):** 16 binarios >1 MiB (`blender-day/`,
  `day-candidates/`) sin excepción en `BINARY-ALLOWLIST.json`. Decidir: excepciones nombradas (D-100),
  gitignore o LFS.
- **Playtest humano de V.d** sigue `PENDING HUMAN PLAYTEST`; integrar a `develop` no cierra V.d.
- Señales preexistentes que viajan: `delegated_deferred` dominante por caja, cierre mensual fuera del
  presupuesto p95 de D-065, orientación física P2, no-determinismo raster Blender.

Acta completa: `docs/execution/phase-4/integration-to-develop-2026-11-12.md`.