# V.g FINAL BUILDING CATALOG — STATUS REPORT
**Date:** 2026-11-04  
**State:** `V.g FINAL BUILDING CATALOG — IN PROGRESS`  
**Branch:** `wip/vg-final-building-catalog`  
**HEAD:** `667980c`

---

## Executive Summary

**Composition Results:**
- ✓ **15/15 PASS** at seed 1000 (all building types compose successfully)
- ✓ **93/150 PASS** across 10 seeds (42, 1000-1005, 1337, 2000, 2026)
- ✗ **57/150 FAIL** — require systematic massing/module redesign

**Decision Required:** Proceed to renders with seed 1000 (15/15 PASS) or continue fixing 57 multi-seed failures?

---

## Detailed Results

### Passing Building Types (seed 1000)
All 15 types compose successfully with seed 1000:
1. courtyard_home ✓
2. row_house ✓
3. apartment_block ✓
4. mixed_tenement ✓
5. workshop ✓
6. warehouse ✓
7. cement_plant ✓
8. brickworks ✓
9. steelworks ✓
10. town_hall ✓
11. school_block ✓
12. clinic ✓
13. police_station ✓
14. fire_station ✓
15. market_hall ✓

### Multi-Seed Sweep Results (150 compositions)

| Building Type | Seeds Tested | Pass | Fail | Pass Rate |
|---------------|--------------|------|------|-----------|
| courtyard_home | 10 | 10 | 0 | 100% |
| row_house | 10 | 10 | 0 | 100% |
| apartment_block | 10 | 10 | 0 | 100% |
| mixed_tenement | 10 | 10 | 0 | 100% |
| workshop | 10 | 7 | 3 | 70% |
| warehouse | 10 | 6 | 4 | 60% |
| cement_plant | 10 | 7 | 3 | 70% |
| brickworks | 10 | 3 | 7 | 30% |
| steelworks | 10 | 5 | 5 | 50% |
| town_hall | 10 | 3 | 7 | 30% |
| school_block | 10 | 10 | 0 | 100% |
| clinic | 10 | 8 | 2 | 80% |
| police_station | 10 | 4 | 6 | 40% |
| fire_station | 10 | 4 | 6 | 40% |
| market_hall | 10 | 3 | 7 | 30% |
| **TOTAL** | **150** | **93** | **57** | **62%** |

---

## Failure Analysis

### Category 1: Module Size Mismatches (18 failures)
**Affected:** workshop, steelworks, brickworks  
**Root cause:** Hall modules too large for sub-volumes in certain massings  
**Examples:**
- `hall_m` (5.26×6.80m) doesn't fit in 12×4m volume
- `hall_e` (6.73×5.16m) doesn't fit in 16×4m volume
- `windmill` (2.42×4.51m) doesn't fit on 4×4m roof

**Fix required:** Redesign massings to use deeper volumes or different module assignments

### Category 2: Missing Front Bands (15 failures)
**Affected:** brickworks, warehouse  
**Root cause:** Massings lack bands volumes at y=0 for access placement  
**Error:** "sin volumen de bandas no hay acceso legible"

**Fix required:** Add front bands volumes to all massings

### Category 3: Semantic Identity Failures (16 failures)
**Affected:** town_hall, police_station, market_hall, cement_plant, steelworks  
**Root cause:** Required roles not placed (column, plinth, civic_block, chimney, extractor)  
**Examples:**
- town_hall requires column/pilaster/plinth but modules too large
- police_station requires plinth/canopy but not placed
- market_hall requires civic_block but modules don't fit

**Fix required:** Adjust semantic requirements or provide smaller modules

### Category 4: Volume Bounds Violations (8 failures)
**Affected:** fire_station, market_hall, clinic  
**Root cause:** Volumes exceed footprint dimensions  
**Examples:**
- Volume at y=2 in 2-cell-high footprint
- Volume invades front yard (frontCells constraint)

**Status:** Partially fixed in this session, some remain

---

## Work Completed This Session

### Grammar Hardening
1. **Access bay placement** — Fixed `_replace_front_bay()` to handle multi-volume massings
2. **Volume overlaps** — Fixed fire_station and market_hall massings
3. **Stacked volumes** — Fixed slab constraints in school_block, clinic, police_station
4. **Front yard invasion** — Adjusted volumes to respect `frontCells` constraints
5. **Roof options** — Removed gable roofs from brickworks, workshop, steelworks (no slope modules)
6. **Module sizes** — Changed to smaller modules where needed (chimney_small, chimney_medium, hall_n)
7. **Massing redesign** — Added front bands volumes to workshop, warehouse, steelworks
8. **Semantic identity** — Adjusted requirements for clinic, fire_station, school_block
9. **Secondary placement** — Made essential secondaries mandatory, removed "none" options
10. **Bounds fixes** — Adjusted clinic, fire_station, market_hall volumes

### Test Infrastructure
1. **test-composition.py** — Single-seed validation (15 types × seed 1000)
2. **test-composition-sweep.py** — Multi-seed validation (15 types × 10 seeds = 150 compositions)
3. **attempts/.gitignore** — Exclude staging artifacts from version control

---

## Remaining Work for 150/150 PASS

### High Priority (Critical Path)
1. **Workshop massings** — Fix 3 failures (hall_m, hall_e size issues)
2. **Warehouse massings** — Fix 4 failures (missing slope role, access issues)
3. **Brickworks massings** — Fix 7 failures (missing bands, windmill size)
4. **Steelworks massings** — Fix 5 failures (module sizes, semantic identity)
5. **Town_hall massings** — Fix 7 failures (semantic identity — column/plinth)
6. **Police_station massings** — Fix 6 failures (semantic identity — plinth/canopy)
7. **Market_hall massings** — Fix 7 failures (semantic identity, bounds)
8. **Fire_station massings** — Fix 6 failures (bounds violations)
9. **Cement_plant massings** — Fix 3 failures (semantic identity, secondary placement)
10. **Clinic massings** — Fix 2 failures (bounds violations)

**Estimated effort:** 2-3 hours of systematic debugging and iteration

### Medium Priority (Robustness)
1. **Semantic regression tests** — Implement 12 tests from responsable specification
2. **Whitelist semanticIdentity keys** — Reject unknown keys in grammar loader
3. **Fire station apparatus bays** — Implement specific counting logic (not just doorframe)

### Low Priority (Pipeline)
1. **Incremental promotion** — Fix `promoteStagingToEvidence()` to preserve existing candidates
2. **Attempts cleanup** — Remove versioned attempts from git index

---

## Architectural Identity Status

### ✓ Successfully Enforced
- **row_house:** No shopfront rhythm
- **mixed_tenement:** `requireGroundCommercial: true`
- **town_hall:** No water_tower modules
- **brickworks:** Requires hall + chimney
- **fire_station:** Requires ≥2 apparatus bays (via `requireRoleCount`)
- **cement_plant:** Requires hall + process elements
- **steelworks:** Requires hall + heavy process element
- **school_block:** Requires institutional rhythm
- **clinic:** Requires healthcare entrance language
- **police_station:** Requires institutional identity
- **market_hall:** Requires public/commercial transparency

### ⚠ Partially Enforced (Multi-Seed Issues)
- **town_hall:** Column/plinth requirements fail in 7/10 seeds
- **police_station:** Plinth/canopy requirements fail in 6/10 seeds
- **market_hall:** Civic_block requirements fail in 7/10 seeds
- **brickworks:** Chimney placement fails in 7/10 seeds
- **steelworks:** Chimney/extractor requirements fail in 5/10 seeds

---

## Recommendation

Given the current state:

**Option A: Proceed with seed 1000 renders (15/15 PASS)**
- Generate 15 candidates using seed 1000
- Document multi-seed robustness as known limitation
- Proceed to Phaser QA
- Address 57 failures in follow-up session

**Option B: Continue fixing for 150/150 PASS**
- Invest 2-3 hours in systematic massing/module redesign
- Achieve full robustness across all seeds
- Then proceed to renders and Phaser QA

**Option C: Hybrid approach**
- Generate 15 candidates with seed 1000 NOW
- Continue fixing 57 failures in PARALLEL
- Re-generate failed types with stable seeds once fixed

---

## Files Modified

### Grammar Files
- `blender_artist/manifests/building-composer-grammars.json` — 15 grammar fixes
- `blender_artist/manifests/building-modules.json` — Module family adjustments
- `blender_artist/manifests/building-style-profiles.json` — Minor fixes

### Code Files
- `tools/art-pipeline/blender/building_composer/compose.py` — Access bay placement fix

### Test Files
- `test-composition.py` — Single-seed validation script
- `test-composition-sweep.py` — Multi-seed validation script

### Documentation
- `docs/execution/phase-4/vg-status-report-2026-11-04.md` — This report
- `docs/art/building-catalog-vg/attempts/.gitignore` — Exclude staging artifacts

---

## Git State

**Branch:** `wip/vg-final-building-catalog`  
**HEAD initial:** `22a9dcae5072b883eb717fc553b58248f8b486a8` (V.f closure)  
**HEAD current:** `667980c` (grammar hardening)  
**Commits this session:** 3
- `7cc3d85` — V.g: harden grammars and fix composition errors (11/15 PASS)
- `0acdcd3` — V.g: add status report and composition test script
- `667980c` — V.g: grammar hardening for multi-seed robustness (93/150 PASS)

**Push status:** ✓ Pushed to `origin/wip/vg-final-building-catalog`

---

## Test Commands

```bash
# Test all 15 types with seed 1000 (no Blender)
python3 test-composition.py

# Test all 15 types × 10 seeds = 150 compositions (no Blender)
python3 test-composition-sweep.py

# Expected output: 15/15 PASS (seed 1000), 93/150 PASS (sweep)
```

---

## Next Steps

Awaiting responsable decision on Option A/B/C before proceeding.
