# Registro de retirada de arte — 2026-11-25

Commit local: `51f3260` (`art(catalog): retire rejected candidates and invalid jobs`). Sin push.

| IDs / conjunto | Motivo | Retirado | Conservado |
| --- | --- | --- | --- |
| `vf_town_hall_1006*` | 24 PNG huérfanos, sin referencia de manifiesto o código | 24 PNG / 58.968.998 B del directorio runtime local (archivos ignorados, por tanto no aparecen en el commit) | Candidatos/metadata de procedencia que aún usan otros pipelines |
| `qa_mini_male`, `qa_mini_female`, `qa_mini_worker` | Jobs inválidos y pilotos no seleccionados | 3 jobs de `asset-jobs.json`; 3 PNG y 3 JSON | GLB Kenney, licencia CC0 y registro de fuente |
| `char_construction_worker_candidate`, `char_enforcer_candidate`, `char_supervisor_candidate` | Prototipos Rocketbox rechazados por lectura de oficio/época | 48 renders, sidecars, láminas y manifiestos | Fuentes Rocketbox MIT y mappings runtime legados |
| `phase-1b/*` | Candidatos operativos Rocketbox no aprobados para la familia canónica | 96 renders, sidecars, láminas, métricas y manifiestos | Fuentes Rocketbox MIT y mappings runtime legados |
| `render_phase1_candidates`, `validate_phase1*`, `compose_phase1*`, `measure_phase1b*` | Herramientas que sólo producían/validaban los candidatos retirados | 7 herramientas y 2 manifiestos de jobs | Pipeline Kenney WP-CHAR-02A/02B/02C/03 y runtime Blender vigente |
| `docs/art/building-composer/candidates`, `building-catalog-vg/candidates`, catálogos `residential/industrial-light/civic/industrial-heavy/remediation-vi/candidates` | Candidatos no seleccionados, superseded por promociones canónicas | Directorios completos de candidatos históricos | `quality-vi`, `day-candidates`, `facilities-v4`, lotes de promoción y `runtime-promotions.json` |
| `vg-town-hall-spike-v3..v6` | Iteraciones anteriores a V7 | Directorios completos | V7, gramáticas, fuentes, licencias y metadata de promoción |
| 654 PNG runtime sin referencia | Familias antiguas de variantes y seis fallbacks sustituidos; ningún manifiesto los consume | 654 PNG / 780.948.327 B del directorio runtime local (ignorados) | 1.173 PNG referenciados, con hashes verificados |

Total versionado: 642 archivos, 89 inserciones y 892.800 líneas borradas. La validación de jobs pasó con 80 jobs, el validador del Composer con 17 gramáticas, 15 promociones y 4 candidatos WP06, y la nueva guarda `art:runtime-references:check` pasó con 1.173 referencias, 1.173 archivos, 0 huérfanos, 0 ausentes y 0 hashes divergentes.

Las actas de ejecución antiguas se conservan como historia; los documentos canónicos de arte quedaron marcados `RETIRED` y ya no presentan los artefactos borrados como catálogo activo.
