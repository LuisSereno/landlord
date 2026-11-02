# Matriz de cobertura visual

> Generada por `pnpm art:coverage:audit`. No promueve assets automáticamente.

Estado de baseline: procedural 15/15 y 60/60 estados diferenciados; bundle Blender parcial.
`preferred footprint` lee `domainFootprint` del manifest V2 vigente; el contrato equivalente de `BuildingDefinition` permanece pendiente de integrar desde V.d-7B.

| Domain type | Gameplay footprint | Preferred footprint | Candidate source | Final source | Complete | Construction | Damaged | Burning/VFX | Orientation | Status | Notes |
|---|---:|---:|---|---|---|---|---|---|---|---|---|
| `courtyard_home` | 4 cells / 1 parcel(s) | 2×2 | Kenney Suburban / Blender E2E | pending QA | PASS | PASS | PASS | PASS | 45 | BLENDER CANDIDATE | 1 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `workshop` | 8 cells / 1 parcel(s) | 2×4 | Kenney Industrial + KayKit props | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 1 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `cement_plant` | 10 cells / 2 parcel(s) | 2×5 | Kenney Industrial + KayKit props | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `brickworks` | 10 cells / 2 parcel(s) | 2×5 | Kenney Industrial + Poly Haven brick | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `steelworks` | 12 cells / 3 parcel(s) | 3×4 | Kenney Industrial + rusty metal | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `row_house` | 4 cells / 1 parcel(s) | 4×1 | Kenney Suburban + Quaternius Downtown | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `apartment_block` | 10 cells / 1 parcel(s) | 2×5 | Kenney Commercial + Quaternius Downtown | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 5 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `mixed_tenement` | 8 cells / 1 parcel(s) | 2×4 | Kenney Commercial + Quaternius Downtown | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 3 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `warehouse` | 12 cells / 2 parcel(s) | 3×4 | Kenney Industrial | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 1 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `town_hall` | 12 cells / 1 parcel(s) | 3×4 | Quaternius Downtown composition | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 4 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `school_block` | 14 cells / 1 parcel(s) | 2×7 | Quaternius Downtown composition | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 3 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `clinic` | 6 cells / 1 parcel(s) | 2×3 | Quaternius Downtown composition | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `police_station` | 6 cells / 1 parcel(s) | 2×3 | Quaternius Downtown + KayKit props | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `fire_station` | 8 cells / 1 parcel(s) | 2×4 | Quaternius Downtown + Kenney vehicle language | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |
| `market_hall` | 10 cells / 1 parcel(s) | 2×5 | Kenney Commercial + Quaternius Downtown | pending QA | PASS | PASS | PASS | PASS | 45 | PROCEDURAL BASELINE | 2 floor baseline; manifest baseline; domain contract pending V.d-7B integration |

## Blender state gaps

- `bld_shopfront`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.
- `bld_commercial_b`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.
- `bld_residential_a`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.
- `bld_commercial_c`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.
- `bld_residential_b`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.
- `bld_residential_c`: construction, damaged, burning duplicate an earlier state — **VISUAL STATE GAP**.

Only `courtyard_home` currently maps a domain type to a Blender candidate with four distinct state hashes. The six additional Blender archetypes are candidates, not domain coverage, and reuse one image across states.

## Gate

V.e.1 may proceed to candidate assignment, but production is not complete: `final source` remains pending for all 15 types and six Blender archetypes require differentiated states.
