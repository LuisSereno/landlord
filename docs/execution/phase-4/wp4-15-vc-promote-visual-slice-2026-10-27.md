# WP4.15-V.c — Promote Visual Slice to Gameplay

**Status:** V.c.1 implemented and PASS (D-084). Road topology superseded by the V.c.2A design — see below  
**Date:** 2026-10-27  
**Baseline:** commit 9b60bef (post V.b3.2 PERFORMANCE = PASS)

> **Superado en lo relativo a las calles.** Este plan proponía `deriveRoadsFromBlockedCells` y
> `blockedCells → asphalt`. Ambas ideas son inviables: `map.blockedCells` son clústeres de
> `profile.obstacles` y constituyen el muro del A\* (`navigation.ts:40`), así que derivar calles de ellas
> haría las calles intransitables. La topología vial autoritativa se diseñó en
> `wp4-15-vc2a-road-topology-design-2026-10-27.md` (D-085), con semánticas separadas
> obstacle/road/parcel/open. El resto del documento sigue siendo el registro de V.c.1.

---

## Objective

When the user runs the normal game (`pnpm --filter @landlord/web dev`), they must progressively see:

- Graphic Civic terrain (multi-surface ground with curbs, dressing, crossings);
- Roads and sidewalks from simulation state;
- Parcel dressing (vacant lots, parks);
- Blender buildings (already partially working via `selectBuildingTextureKey`);
- Trees, street furniture, props;
- Vehicles on roads;
- Contact shadows;
- Same camera/pivots/scale as the Visual Slice.

The simulation remains authoritative. `/visual-slice` becomes a regression fixture, not a parallel renderer.

---

## Current Architecture Analysis

### Normal Game Route

**File:** `apps/web/src/App.tsx` → `IsometricCanvas` → `mountIsometricSpike()`

The normal game creates `new IsometricSpikeScene()` **without options**:
- `sliceLayout = undefined`
- `terrainStage = "base"` (flat `#1f2a39` ground + grid)
- `showGrid = true`
- `groundPlan = null` (no surface classification)
- Terrain/props/vehicles textures **not loaded** (gated by `if (!this.sliceLayout) continue` at line 452 of `IsometricSpikeScene.ts`)

**What it renders:**
- Buildings: simulation-driven sprites (Blender preferred, procedural fallback) ✅
- Agents: 4×4 colored blitter dots
- Structures: 16×16 orange markers (legacy)
- Overlay: parcel diamonds, construction progress bars, incident circles
- Terrain: flat dark ground with grid lines

### Visual Slice Route

**File:** `apps/web/src/VisualSlice.tsx` → `mountVisualSlice()`

Creates `new IsometricSpikeScene({ visualSlice: VISUAL_SLICE_LAYOUT, ... })`:
- `sliceLayout = VISUAL_SLICE_LAYOUT` (authored composition)
- `terrainStage = "full"` (rich multi-surface ground)
- `showGrid = false`
- `groundPlan = planGround(sliceLayout, ...)` (surface classification from authored data)
- All terrain/props/vehicles textures loaded

**What it renders:**
- Buildings: authored placement from `layout.ts` (not simulation)
- Terrain: Blender road tiles, dirt lots, crossings
- Props: trees, lights, benches, barriers, cones
- Vehicles: sedans, trucks, taxis
- Characters: full sprites with shadows (optional)
- Ground: full Graphic Civic pipeline (asphalt, pavement, grass, dirt, gravel, construction, curbs, dressing)

### Key Architectural Insight

Both modes use the **same `IsometricSpikeScene` class**. The branching is entirely controlled by `this.sliceLayout`:

| Aspect | Normal (sliceLayout=undefined) | Visual Slice (sliceLayout=set) |
|--------|-------------------------------|--------------------------------|
| Ground | Flat + grid | Rich multi-surface |
| Buildings | Simulation-driven | Authored layout |
| Roads/Props/Vehicles | None | All loaded and rendered |
| Camera bounds | (0,0,4096,4096) | (-4096,-4096,16384,16384) |
| Grid | Visible | Hidden |

---

## What to Reuse from Visual Slice

### Directly Reusable (no changes)

1. **`terrain-paint.ts`** — the entire ground baking pipeline:
   - `paintGround({ context, document, layout, bounds, plan, stage, showGrid })`
   - Surface styles (`SURFACE_STYLE`), edge marking, dressing, crossings
   - Deterministic noise (`hashCell`, `field`, `random`)

2. **`ground.ts` primitives** — surface classification functions:
   - `cellKey()`, `hashCell()`, `field()` (noise)
   - `GroundSurface` type, `GroundPlan` type
   - `OPEN_SPACES` (but not the hardcoded values — those are fixture-specific)

3. **Asset loading** — `registerBuildingTextures()` already loads terrain/props/vehicles when `sliceLayout` is set. The logic is correct; only the gate condition needs adjustment.

4. **Depth calculation** — `depthForAsset()`, `footprintCenter()` work for any cell.

5. **Shadow treatment** — `addSliceShadow()` creates contact shadows for any sprite.

6. **Camera behavior** — zoom/pan/picking already work in both modes.

7. **Blender building sprites** — `selectBuildingTextureKey()` already prefers Blender over procedural.

### Fixture-Specific (do NOT copy)

1. **`layout.ts`** — the authored `VISUAL_SLICE_LAYOUT`:
   - `BUILDINGS[]`, `PROPS[]`, `VEHICLES[]`, `CHARACTERS[]` arrays
   - `HORIZONTAL_STREETS`, `VERTICAL_AVENUES` constants
   - `WORKS_LOT` construction site
   - `roadCells()`, `roadTiles()`, `worksLotTiles()` helpers

   These are a **QA composition**, not game data. The normal game must derive equivalent data from simulation state.

2. **`renderVisualSlice()`** — the method that places authored sprites. It iterates `sliceLayout.buildings/props/vehicles/characters` and creates Phaser images. This is fixture logic.

### Must Extract/Adapt

1. **`planGround()`** — currently takes `VisualSliceLayout` and classifies cells. Needs a new signature that takes simulation data (parcels, buildings, roads) instead.

2. **Road topology** — the visual slice uses hardcoded `HORIZONTAL_STREETS` / `VERTICAL_AVENUES`. The normal game must derive roads from simulation (currently `map.blockedCells` exists but no road rendering).

3. **Prop/vehicle placement** — the visual slice uses authored positions. The normal game needs procedural placement rules (trees along roads, vehicles on road cells, etc.).

---

## Proposed Adapter Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Simulation (authoritative)                                 │
│  - GameState.parcels, buildings, constructionSites, agents  │
│  - GameState.map.blockedCells (roads)                       │
│  - ViewProjectionV1 (render-facing snapshot)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Presentation Adapter (NEW)                                 │
│  - convertProjectionToGroundPlan(projection) → GroundPlan   │
│  - deriveRoadsFromBlockedCells(blockedCells) → RoadCells    │
│  - classifyParcelSurfaces(parcels, buildings) → surfaces    │
│  - generatePropPlacements(roads, parcels) → Prop[]          │
│  - generateVehiclePlacements(roads) → Vehicle[]             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Graphic Civic Renderer (EXISTING, reused)                  │
│  - terrain-paint.ts: paintGround(plan) → CanvasTexture      │
│  - IsometricSpikeScene: bakeGround(), registerTextures()    │
│  - depthForAsset(), footprintCenter(), addSliceShadow()     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phaser (EXISTING)                                          │
│  - IsometricSpikeScene renders adapter output               │
│  - Same camera, picking, overlay system                     │
└─────────────────────────────────────────────────────────────┘
```

### Adapter Responsibilities

The `PresentationAdapter` converts simulation state into presentation data:

1. **Ground plan generation** — classify each cell:
   - `blockedCells` → asphalt (roads)
   - `parcels[].zoning` → pavement (sidewalks around buildings)
   - `parcels[]` with `buildingId = null` → dirt/gravel (vacant lots)
   - Open spaces (parks) → grass (derive from parcel ownership patterns or explicit markers)
   - Construction sites → construction surface

2. **Road topology** — extract road cells from `map.blockedCells` (already exists in simulation).

3. **Prop placement** — procedural rules:
   - Trees: every N cells along road edges, deterministic from seed
   - Street lights: at intersections, every M cells
   - Benches/trash cans: near buildings, sparse

4. **Vehicle placement** — procedural rules:
   - Vehicles on road cells, oriented to road direction
   - Density from simulation (agent count, building activity)

5. **Building state mapping** — already working via `selectBuildingTextureKey()`, but must honor:
   - `complete` → Blender complete sprite
   - `construction` → Blender construction sprite (or procedural fallback)
   - `damaged` → Blender damaged sprite
   - `burning` → Blender burning sprite
   - `ruin` → Blender damaged with alpha 0.4 (current behavior)

---

## Implementation Phases (Small, No Big-Bang)

### Phase V.c.1 — Terrain Promotion (Ground Plan from Simulation)

**Goal:** Normal game shows Graphic Civic ground instead of flat `#1f2a39`.

**Changes:**
1. Create `apps/web/src/presentation/adapter.ts` with `convertProjectionToGroundPlan(projection)`.
2. Extract `planGround()` signature to accept a generic input (not just `VisualSliceLayout`).
3. In `IsometricSpikeScene`, when `!sliceLayout`, compute ground plan from projection.
4. Set `terrainStage = "full"` in normal mode (or make it configurable).
5. Load terrain textures in normal mode (remove the `if (!this.sliceLayout) continue` gate).

**Validation:**
- Normal game shows multi-surface ground (asphalt roads, pavement sidewalks, dirt vacant lots).
- Buildings still render correctly on top.
- Overlay system (parcel diamonds, construction bars) still works.
- `/visual-slice` regression unchanged.

**Risk:** Low. This is purely presentational; simulation state is not modified.

---

### Phase V.c.2 — Deferred: Blender Road Tiles (Requires Road Topology WP)

**Goal:** Normal game shows Blender road tiles instead of painted asphalt.

**Status:** DEFERRED — requires explicit road topology in simulation (future WP).

**Rationale:** The simulation has no road data. Blender road tiles (`ter_road_straight`, `ter_road_corner`, `ter_road_intersection`) require explicit road cell classification (straight segment, corner, intersection). The Visual Slice uses hardcoded positions; the normal game cannot derive these from simulation state.

**Future WP scope (not V.c):**
- Add `RoadTopology` to simulation state (road cells, direction, intersection markers).
- Update district generation to produce road topology alongside parcels.
- Adapter consumes road topology and produces tile placements.
- Render Blender road tiles with proper orientation.

**V.c initial workaround:** Phase V.c.1 paints asphalt surfaces for implied roads (cells between parcels). This is visually acceptable without Blender tiles.

---

### Phase V.c.3 — Props and Vegetation

**Goal:** Normal game shows trees, street lights, benches.

**Changes:**
1. In `adapter.ts`, add `generatePropPlacements(roads, parcels, seed)` → array of prop placements.
2. Use deterministic PRNG from `GameState.seed` for reproducible placement.
3. In `IsometricSpikeScene`, add `renderProps()` method.
4. Load `prp_*` textures in normal mode.

**Validation:**
- Trees appear along roads, deterministic from seed.
- Street lights at intersections.
- Save/load produces identical prop placement.

**Risk:** Low. Props are purely decorative; no gameplay impact.

---

### Phase V.c.4 — Vehicles

**Goal:** Normal game shows vehicles on roads.

**Changes:**
1. In `adapter.ts`, add `generateVehiclePlacements(roads, agents, seed)` → array of vehicle placements.
2. Vehicle density derived from agent count or building activity.
3. In `IsometricSpikeScene`, add `renderVehicles()` method.
4. Load `veh_*` textures in normal mode.

**Validation:**
- Vehicles appear on road cells, oriented correctly.
- Density changes with simulation state.
- Performance stable.

**Risk:** Low. Vehicles are decorative; no pathfinding or AI.

---

### Phase V.c.5 — Camera and Bounds Adjustment

**Goal:** Normal game uses the same camera behavior as visual slice.

**Changes:**
1. In `IsometricSpikeScene.create()`, when `!sliceLayout`, set camera bounds to `(-4096, -4096, 16384, 16384)` instead of `(0, 0, 4096, 4096)`.
2. Hide grid by default in normal mode (`showGrid = false`).
3. Remove debug text in normal mode.

**Validation:**
- Camera can pan beyond the 64×64 grid (useful for viewing edge parcels).
- Grid hidden by default (cleaner look).
- User can toggle grid via a setting (future enhancement, not in V.c initial).

**Risk:** Low. Camera bounds are presentational.

---

### Phase V.c.6 — Visual Slice as Regression Fixture

**Goal:** `/visual-slice` remains as a QA tool, not a parallel renderer.

**Changes:**
1. Keep `VisualSlice.tsx` route unchanged.
2. Keep `mountVisualSlice()` unchanged.
3. Document that `/visual-slice` is a fixture for comparing authored composition vs simulation-driven rendering.
4. Add a visual regression test: capture `/visual-slice` and compare against baseline SHA-256.

**Validation:**
- `/visual-slice` still renders the authored composition.
- Baseline captures unchanged.
- Normal game and visual slice can be compared side-by-side.

**Risk:** None. This is documentation and test infrastructure.

---

## Risks and Mitigations

### Risk 1: Performance Degradation

**Concern:** Adding terrain, props, vehicles to the normal game may drop FPS below 55.

**Mitigation:**
- Measure FPS after each phase (V.c.1 through V.c.5).
- The visual slice already renders 552 objects at 60 FPS; the normal game has fewer parcels (64×64 = 4096 cells max, but typically 200-800 parcels).
- If FPS drops, apply viewport culling (already present in `syncBuildingSprites()`).

### Risk 2: Simulation Coupling

**Concern:** Presentation adapter may accidentally modify simulation state or introduce non-determinism.

**Mitigation:**
- Adapter is **read-only** on projection data.
- All procedural placement uses `GameState.seed` via PRNG.
- Adapter has no access to `dispatch` or command system.
- Tests: adapter functions are pure and testable in isolation.

### Risk 3: Visual Mismatch

**Concern:** Normal game may look different from visual slice even with the same assets.

**Mitigation:**
- Reuse exact same rendering primitives (`terrain-paint.ts`, `depthForAsset()`, `addSliceShadow()`).
- Visual slice remains as a reference for comparison.
- Side-by-side screenshots during QA.

### Risk 4: Asset Loading Overhead

**Concern:** Loading terrain/props/vehicles textures in normal mode may slow initial load.

**Mitigation:**
- Textures are already loaded in visual slice; no new assets required.
- Lazy loading: only load props/vehicles when zoom level reveals them (future optimization, not in V.c initial).
- Measure load time before/after.

### Risk 5: Breaking Existing Overlays

**Concern:** Adding terrain/props may obscure parcel diamonds, construction bars, incident markers.

**Mitigation:**
- Overlays render at `depth = 20_000` (above everything).
- Terrain/props render at `depth < 10_000`.
- Existing overlay system unchanged.

---

## Gate Criteria for V.c Initial

Consider V.c complete when:

1. ✅ Normal game shows Graphic Civic terrain (multi-surface ground with asphalt, pavement, dirt, grass).
2. ✅ Terrain data comes from simulation state (parcels, buildings, implied roads between parcels).
3. ✅ Blender buildings render correctly (already working via `selectBuildingTextureKey`).
4. ⏸ Roads show painted asphalt surfaces (Blender road tiles DEFERRED to future WP).
5. ✅ Props (trees, lights) appear procedurally from seed.
6. ⏸ Vehicles appear on roads (OPTIONAL; can defer to V.c.2 or future WP).
7. ✅ Player can use camera/pan/picking as before.
8. ✅ No dependency on `visual-slice/layout.ts` in normal mode.
9. ✅ Fallback to procedural SVG if Blender asset missing (already working).
10. ✅ `/visual-slice` still passes regression (baseline SHA-256 unchanged).
11. ✅ Simulation tests still pass (no gameplay changes).
12. ✅ FPS ≥ 55 at zoom 1.0 with 200+ parcels.

---

## What NOT to Do in V.c Initial

- ❌ Import Quaternius assets (already decided: ACCEPT FOR SELECTIVE USE).
- ❌ Add Rocketbox characters (deferred; normal game uses blitter dots for agents).
- ❌ Increase texture resolution to 512 px (deferred; current 256 px is approved).
- ❌ Build texture atlas (deferred; current per-image loading is sufficient).
- ❌ Set up Git LFS (deferred; no new binary assets required).
- ❌ Add new building states (deferred; current complete/construction/damaged/burning is sufficient).
- ❌ Redesign UI/overlays (out of scope; V.c is purely visual layer promotion).
- ❌ Modify simulation logic (out of scope; V.c is presentational only).

---

## File Structure (Proposed)

```
apps/web/src/
├── presentation/
│   ├── adapter.ts              # NEW: convertProjectionToGroundPlan, generatePropPlacements, etc.
│   ├── adapter.test.ts         # NEW: unit tests for adapter functions
│   ├── prop-placement.ts       # NEW: deterministic prop generation rules
│   └── vehicle-placement.ts    # NEW: deterministic vehicle generation rules
├── visual-slice/
│   ├── layout.ts               # UNCHANGED: authored fixture
│   ├── ground.ts               # REFACTOR: extract planGround() to accept generic input
│   └── terrain-paint.ts        # UNCHANGED: reused by both modes
├── isometric/
│   └── IsometricSpikeScene.ts  # MODIFY: use adapter output in normal mode
└── App.tsx                     # UNCHANGED: already passes projection to IsometricCanvas
```

---

## Next Steps

1. **Review this plan** — confirm scope, phases, and risks.
2. **Implement V.c.1** — terrain promotion (ground plan from simulation, asphalt for implied roads).
3. **Measure FPS** — verify no performance regression.
4. **Implement V.c.3** — props and vegetation (trees, street lights).
5. **Implement V.c.5** — camera bounds adjustment (hide grid, expand bounds).
6. **Implement V.c.6** — document visual slice as regression fixture.
7. **Final measurement** — FPS, load time, visual comparison.
8. **Commit and close V.c** — update DECISIONS.md, PROJECT-STATE.md.

**Deferred to future WPs:**
- V.c.2 (Blender road tiles) — requires road topology in simulation.
- V.c.4 (vehicles) — optional, can be a separate decorative WP.

---

## Critical Architectural Finding: No Road Topology in Simulation

**The simulation does not model roads as explicit data.**

- `map.blockedCells` = building footprints (cells occupied by buildings), NOT roads.
- Pathfinding (`findDeterministicPath`) treats `blockedCells` as obstacles to avoid.
- District generation (`district-generator.ts`) creates parcels and buildings, but no road network.
- The Visual Slice uses hardcoded `HORIZONTAL_STREETS` / `VERTICAL_AVENUES` in `layout.ts` — purely presentational, not derived from simulation.

**Implication for V.c:** The normal game has no road data to render. The adapter cannot produce Blender road tiles (`ter_road_straight`, `ter_road_corner`, `ter_road_intersection`) without explicit topology.

**Resolution for V.c initial:**

1. **Procedural road surfaces** — the adapter classifies cells between parcels as "asphalt" (implied roads) using a simple heuristic: cells adjacent to parcels but not occupied by buildings.
2. **Terrain paint** — `terrain-paint.ts` paints asphalt surfaces for these cells (no Blender tiles).
3. **Defer Blender road tiles** — they require explicit road topology, which is out of scope for V.c initial. A future WP (e.g., WP4.17 or Beta) can add road topology to the simulation.
4. **Crossings** — defer until road topology exists. The Visual Slice's hardcoded crossings remain fixture-only.

This keeps V.c focused on **terrain promotion** (Graphic Civic ground) without inventing road gameplay.

---

## Open Questions

1. **Prop density rules:** How many trees per road segment? How many street lights per intersection? Need art direction input.
2. **Vehicle density:** Should vehicle count scale with agent count, building activity, or time of day? Need gameplay design input.
3. **Open spaces (parks):** How to derive park locations from simulation state? Are there explicit park parcels, or should we infer from vacant lots?
4. **Performance budget:** Is 55 FPS the hard minimum, or can we accept 45-55 FPS with OBSERVATION?
5. **Road topology (future WP):** Should a future WP add explicit road topology to the simulation (road cells, intersections, traffic lanes)? This would enable Blender road tiles, crossings, and traffic simulation.

These questions should be resolved during implementation, not during planning.

---

## V.c.1 — Implementation Results (2026-10-27)

**Status:** GAMEPLAY_VISUAL_PROMOTION = PASS. Under D-084.

### Section 0 confirmed by code

`map.blockedCells` is populated from `profile.obstacles` (unbuildable clusters) in
`composeDistrict()` and restored in `state.ts:267`. It is NOT a road network; building occupancy is
computed separately (`occupiedBuildingCells`, `hasStructureAt`). `ViewProjectionV1` exposes only
`map: { width, height }` — no road data at all. `PROJECT-STATE.md` corrected accordingly.

### Adapter architecture (final)

`apps/web/src/isometric/gameplay-visual-adapter.ts` — pure, reads only `ViewProjectionV1`:

```
buildGameplayVisualModel(projection) → {
  groundPlan: GroundPlan,        // surfaces from real parcels
  geometryKey: string,           // spatial-only signature (no cash/rent/condition/tick)
  buildings: [{ id, domainType, archetype }],
  decorations: [{ cell, asset, scale }],  // trees only (no road-dependent props)
}
```

Chain: `GameState → createViewProjection → ViewProjectionV1 → adapter → Graphic Civic renderer → Phaser`.
Enforced by `check-architecture.mjs` (gameplay adapter must not import `visual-slice/layout`).

### Domain type → visual archetypes

| Domain type | Visual archetypes (deterministic by `fnv1a32(domainType|building.id)`) |
|---|---|
| `courtyard_home` | `bld_residential_a`, `bld_residential_b`, `bld_residential_c`, `courtyard_home` |
| `workshop` | `bld_shopfront`, `bld_commercial_b`, `bld_commercial_c` |
| `cement_plant` | `cement_plant` (procedural fallback — no compatible Blender geometry) |
| `brickworks` | `brickworks` (procedural fallback) |
| `steelworks` | `steelworks` (procedural fallback) |

Resolution in `resolveBuildingVisual`: Blender for the archetype if the texture exists, else
procedural for the domain type. A building never disappears for a missing Blender asset.

### Ground surfaces used (real data, no invented roads)

- built residential → `gravel` apron + `grass` ring
- built mixed → `pavement`
- built industrial → `gravel`
- vacant parcel → `dirt`
- construction site → `construction`
- non-parcel cells → `urban` base (textured by `paintGround` value noise + dressing)
- **No `asphalt`** produced by the gameplay plan (asserted by test).

### Determinism

`fnv1a32` over immutable identity (`building.id`, `domainType`); spatial hash over cell coords for
decoration. No `Math.random`, no tick, no array order, no `GameState.seed`. Same projection → same
model (test-verified).

### Evidence (real `/`, not `/visual-slice`)

- `artifacts/visual-slice/gameplay-before-zoom-{0.5,1,2}.png` — flat ground + technical grid + debug text.
- `artifacts/visual-slice/gameplay-after-zoom-{0.5,1,2}.png` — Graphic Civic terrain + trees + parcel
  surfaces, grid and debug removed.
- `artifacts/visual-slice/gameplay-after-built-zoom-{1,2}.png` — a REAL simulation projection (built by
  `VC1_PROJECTION=1` harness: buy parcels + construct courtyard homes + leave uncrewed works) injected
  through the camera-test hook into the same `setProjection` path. Shows a Blender courtyard_home, a
  construction site, vacant lots and dressing.
- `artifacts/visual-slice/vc1-gameplay-performance.json` — FPS + rebake-stability.

### Gameplay FPS (headed Chromium, GPU, preview build)

| Zoom | Samples | Median | P10 | Min | Max | First half | Second half |
|---|---|---|---|---|---|---|---|
| 0.5 | 24 | 60 | 60 | 60 | 60 | 60 | 60 |
| 1.0 | 23 | 60 | 60 | 60 | 60 | 60 | 60 |
| 2.0 | 23 | 60 | 60 | 60 | 60 | 60 | 60 |
| 2.5 | 23 | 60 | 60 | 60 | 60 | 60 | 60 |

`groundRebakes` stayed at 1 across the whole measurement while the simulation ran with no spatial
change → confirms no per-tick rebake. 0 page errors; 1 console error (automatic `/favicon.ico` 404,
cosmetic).

### Gate criteria

1. `/` shows Graphic Civic terrain — PASS
2. Buildings come from the simulation projection — PASS (harness-injected real projection + unchanged sync path)
3. Visual variety without changing domain types — PASS (archetype layer)
4. Construction still real — PASS (construction-site sprites from projection)
5. Picking works — PASS (unchanged; 0 errors)
6. Overlays work — PASS (Propiedad layer visible in captures)
7. Pan/zoom work — PASS (60 FPS at all zooms)
8. Fallback works — PASS (industrial → procedural; test-verified)
9. No dependency on Visual Slice layout — PASS (architecture guard + test)
10. `/visual-slice` still works — PASS (552 objects, 60 FPS)
11. Gameplay performance acceptable — PASS (60 FPS median)

### Remaining visual defects (deferred, not blockers)

- **No roads/crossings/street furniture/vehicles** — deferred to WP4.15-V.c.2 (Authoritative Road
  Topology). Deliberately not faked.
- **Sparse starting district** — seed-1 gameplay begins with few buildings (lean economy by design);
  the built-cluster evidence uses a richer real projection.
- **Building scale** — uses physical `spriteScaleFor`; if a future A/B finds it too small vs the
  slice, fix the physical/render cause, not a global multiplier.
- **Industrial geometry** — cement/brick/steel remain procedural until Blender geometry exists.

### Tests added

- `apps/web/src/isometric/gameplay-visual-adapter.test.ts` (10): determinism, stable archetype,
  commercial/industrial mapping, no-asphalt rule, real-data surfaces, no decoration on built cells,
  geometry key ignores non-spatial economy, geometry key reacts to relocation, no slice fields.
- `scripts/check-architecture.mjs` + fixture: gameplay adapter must not import `visual-slice/layout`.
- `packages/simulation/src/vc1-projection.test.ts` (opt-in): real projection generator for capture.

All green: typecheck (all), lint (0 errors), format, build, simulation 305 tests, web 70 tests,
architecture, asset/blender/binary/license guards.
