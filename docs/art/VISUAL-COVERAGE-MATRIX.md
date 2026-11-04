# Matriz de cobertura visual

> Generada por `pnpm art:coverage:audit`. No promueve assets automáticamente.

Estado actual: evidencia candidata 15/15; 18/60 estados renderizados; 14 edificios importados (14/14 complete); legacy congelado courtyard_home 4/4; promoción al runtime: pending QA.
`preferred footprint` y `shapePenalty` están integrados en V.d-7B y alimentan la enumeración autoritativa de V.d-7C.

| Domain type | Gameplay footprint | Preferred footprint | Candidate source | Final source | Complete | Construction | Damaged | Burning/VFX | Orientation | Status | Notes |
|---|---:|---:|---|---|---|---|---|---|---|---|---|
| `courtyard_home` | 4 cells / 1 parcel(s) | 2×2 | Original procedural courtyard (legacy congelado, ruta interna) | legacy frozen | PASS | PASS | PASS | PASS | 45 | LEGACY FROZEN | 1 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `row_house` | 4 cells / 1 parcel(s) | 4×1 | Kenney City Kit Suburban · building-type-f.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `apartment_block` | 10 cells / 1 parcel(s) | 2×5 | Kenney City Kit Commercial · building-skyscraper-a.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 5 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `mixed_tenement` | 8 cells / 1 parcel(s) | 2×4 | Kenney City Kit Commercial · building-l.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 3 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `workshop` | 8 cells / 1 parcel(s) | 2×4 | Kenney City Kit Industrial · building-m.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 1 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `warehouse` | 12 cells / 2 parcel(s) | 3×4 | Kenney City Kit Industrial · building-l.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 1 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `cement_plant` | 10 cells / 2 parcel(s) | 2×5 | Kenney City Kit Industrial · building-c.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `brickworks` | 10 cells / 2 parcel(s) | 2×5 | Kenney City Kit Industrial · building-j.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `steelworks` | 12 cells / 3 parcel(s) | 3×4 | Kenney City Kit Industrial · building-h.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `town_hall` | 12 cells / 1 parcel(s) | 3×4 | Kenney City Kit Commercial · building-k.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 4 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `school_block` | 14 cells / 1 parcel(s) | 2×7 | Kenney City Kit Commercial · building-i.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 3 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `clinic` | 6 cells / 1 parcel(s) | 2×3 | Kenney City Kit Commercial · building-e.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `police_station` | 6 cells / 1 parcel(s) | 2×3 | Kenney City Kit Commercial · building-f.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `fire_station` | 8 cells / 1 parcel(s) | 2×4 | Kenney City Kit Commercial · building-g.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |
| `market_hall` | 10 cells / 1 parcel(s) | 2×5 | Kenney City Kit Commercial · building-h.glb · CC0-1.0 | candidate evidence | PASS | PENDING | PENDING | PENDING | 45 | CANDIDATE EVIDENCE | 2 floor baseline; integrated V.d-7B preferredFootprint + shapePenalty |

## Missing imported states

- `row_house`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `apartment_block`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `mixed_tenement`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `workshop`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `warehouse`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `cement_plant`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `brickworks`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `steelworks`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `town_hall`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `school_block`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `clinic`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `police_station`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `fire_station`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.
- `market_hall`: faltan construction, damaged, burning sobre la fuente importada — **PENDING**.

La evidencia de edificios es candidata: los 14 importados tienen sólo `complete`; `courtyard_home` conserva su conjunto legacy congelado de cuatro estados. Nada se promociona al runtime sin QA visual.

## Gate

V.e puede pasar a revisión de candidatos, pero la producción no está completa: la evidencia importada es 14/14 en `complete`, el total es 18/60 estados y la promoción al runtime sigue pendiente de QA.
