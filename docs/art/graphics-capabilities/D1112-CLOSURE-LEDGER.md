# D-111.2 — Ledger de cierre (ejecución definitiva)

Ejecuta las fases pendientes sobre el baseline del runbook `D111-V2-VISUAL-QUALITY-RUNBOOK.md`
(WP00–WP08 ya ejecutados y commiteados). Tabla `Fase | Estado | Commit | Evidencia | Pendiente`.
Si una sesión se interrumpe, el siguiente agente continúa leyendo este archivo, el HEAD y el runbook.

Estado objetivo: `READY FOR HUMAN VISUAL REVIEW` — sin promocionar nada a producción
(`runtime-promotions.json` intacto).

## Baseline (verificado en FASE 1)

- Rama `wip/organization-headquarters`, HEAD `5d23a19`, árbol limpio, 8 commits de FASE 1–7
  del runbook SIN push (`8b42a64` F1, `9e95206` F2 + `d123a16` ledger, `b58f263` F3,
  `74a4ec2` F4, `f606813` F5, `62304dc` F6, `5d23a19` F7/WP08).
- Cuatro candidatas WP06 presentes en `blender_artist/manifests/building-composer-candidates.json`:
  `row_house` y `mixed_tenement` (perfil `gn_residential_v2`), `town_hall` (`ag_civic_v2`),
  `warehouse` (`gn_industrial_v2`).
- Módulos de fuego presentes: `apps/web/src/fx-lab/fx-fire.ts`, `fx-fire-anchors.ts`,
  `FxLabScene.ts`, `fx-effects.ts`, `fx-lab-types.ts`. Contrato de envejecimiento
  `building-weathering-contract.json` declara `aged`.
- Evidencia v2 existente: `evidence/v2/fire/` (control/candidata día/noche), `evidence/v2/urban/`
  (8 capturas + manifiesto), `evidence/INDEX.md` (108 PNG), cuatro hojas WP08.

## Fases

| Fase | Estado | Commit | Evidencia | Pendiente |
| --- | --- | --- | --- | --- |
| 1 · baseline y ledger | completada | (este commit) | este archivo, verificación arriba | — |
| 2 · incendio híbrido Blender+Phaser | pendiente | — | `evidence/v2/closure/fire/` (por crear) | — |
| 3 · cuatro candidatas en Phaser | pendiente | — | `evidence/v2/closure/urban/` (por crear) | — |
| 4 · envejecimiento vs daño | pendiente | — | `building_condition_in_phaser.png` | sprite `aged` no existe en catálogo runtime (D-080) |
| 5 · exposición nocturna definitiva | pendiente | — | `night_lighting_final_ab.png` | — |
| 6 · evidencias y validadores | pendiente | — | índice `--check` | ver defectos heredados |
| 7 · WP09 y documentación | pendiente | — | README capabilities, guía de edificio nuevo | rótulos §6.1–§6.3 |
| 8 · validación final y publicación | pendiente | — | informe corto | push al cerrar |

## Defectos heredados registrados en FASE 1 (sin regenerar evidencias antiguas)

1. Las 8 capturas `evidence/v2/urban/` marcan `LAVADA` por el HUD dentro del recorte
   (4,4–4,6 % de píxel blanco; 0,02–0,14 % sin la banda del HUD) — se resuelve en FASE 6.
2. 13 PNG anteriores a WP08 sin JSON hermano, motivo anclado en `evidence/INDEX.md` — FASE 6.
3. Las dos `fire/candidata_mixed_tenement_*` piden re-render tras el fix de cornisa de FASE 6
   del runbook — FASE 6.
4. `pnpm lint` rojo: 7 179 errores en `apps/web/dist-fxlab/` (gitignoreada; el `ignores` de
   `eslint.config.js` sólo casa `**/dist/**`) + 30 en diez ficheros ajenos — FASE 6.
5. La entrada `phaser_fx_lab` del README de capacidades dice «sin presets», contradicha por
   `f606813` — FASE 7.
6. Los rótulos §6.1/§6.2/§6.3 citados en código apuntan a secciones por escribir — FASE 7.
7. Sólo Centro Cívico cumple los siete contadores de WP08 (densidad del generador de mundo,
   fuera del alcance de este cierre).
8. `building-condition.ts` no tiene call site jugable; mover `condition < 60 ⇒ damaged` es la
   decisión D-080 del propietario — FASE 4 aplica la proyección nueva sin cambiar estados de dominio.
