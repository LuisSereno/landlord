# D-111.3 — Ledger de rework artístico

Correcciones de los defectos identificados en la revisión artística de D-111.2.
Tabla `Fase | Estado | Commit | Archivos modificados | Evidencia | Pendientes`.
Cada fase se retoma leyendo este ledger y sus archivos de referencia. Rama
`wip/organization-headquarters`, HEAD inicial de referencia `cd7bb6b`.

## Decisiones del propietario (autoritativas, 2026-11-23)

| Elemento | Decisión | Trabajo |
|---|---|---|
| `mixed_tenement` | MEJORAR | corregir franja oscura de fachada (seed 2) |
| `row_house` | MEJORAR | corregir franja oscura de fachada (seed 17) |
| `warehouse` | APROBADO ARTÍSTICAMENTE | conservar el aspecto exterior (seed 2) |
| `town_hall` actual | RECHAZADO COMO AYUNTAMIENTO | alternativa neoclásica monumental (seed 2), sin copiar la Casa Blanca; `ag_civic_v2` y sus arcadas se conservan |
| Envejecimiento | MEJORAR | reconocible a escala de juego (0,5×/1×), no filtro oscuro uniforme |
| Incendios y humo | APROBADOS ARTÍSTICAMENTE | conservar efectos; mejorar interior expuesto (referencias moderada 8 focos residencial / intensa 19 almacén) |
| Iluminación nocturna | APROBADA ARTÍSTICAMENTE | no tocar la calibración |

La aprobación artística NO autoriza promoción a producción: `runtime-promotions.json` intocable.

## Controles congelados (FASE 0)

Perfiles verificados en `building-composer-candidates.json`: `gn_residential_v2`,
`gn_industrial_v2`, `ag_civic_v2`. Mismas cámaras y escalas que las comparativas D-111.2
(`evidence/v2/candidates/` y `evidence/v2/final-assets/`); ninguna imagen con evidencia válida se
regenera sin necesidad.

| Elemento | Control (PNG) | Variantes disponibles |
| --- | --- | --- |
| `mixed_tenement` | `wp06_mixed_tenement-candidata.png` (firma 94f1106d02e6…) | `-aged`, `-damaged` · burning = `closure/fire/hybrid_sprite_{day,night}` (firma 3442cb6e…) |
| `row_house` | `wp06_row_house-candidata.png` (firma 5468186522ad…) | sólo complete (dañado/envejecido/burning de row_house no existen) |
| `warehouse` | `wp06_warehouse-candidata.png` (firma 460b94c4e447…) | `-damaged`, `-burning` (night), `-burning-day` |
| `town_hall` | `wp06_town_hall-candidata.png` (firma d950e513e67e…) | sólo complete |

## Fases

| Fase | Estado | Commit | Archivos modificados | Evidencia | Pendientes |
| --- | --- | --- | --- | --- | --- |
| 0 · preparación y controles | PENDING | — | este ledger | controles arriba | — |
| 1 · diagnóstico franjas fachadas | PENDING | — | — | `evidence/d1113/facade_diagnosis.{png,md}` (por crear) | — |
| 2 · corrección fachadas residenciales | PENDING | — | — | `evidence/d1113/facades/facade_fix_*.png` (por crear) | — |
| 3 · interiores dañados | PENDING | — | — | `damaged_interior_mixed_tenement_ab.png` (por crear) | — |
| 4 · interiores industriales + fuego | PENDING | — | — | `damage_fire_interiors_ab.png` (por crear) | — |
| 5 · envejecimiento reconocible | PENDING | — | — | `weathering_v3_ab.png` (por crear) | no promocionar aged (D-080) |
| 6 · town hall neoclásico | PENDING | — | — | `town_hall_neoclassical_ab.png` (por crear) | candidata QA |
| 7 · integración Phaser | PENDING | — | — | `evidence/d1113/final/` (por crear) | — |
| 8 · validación y cierre | PENDING | — | — | `D1113-ART-ACCEPTANCE.md` (por crear) | — |
