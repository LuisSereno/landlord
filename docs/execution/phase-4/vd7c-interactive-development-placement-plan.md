# V.d-7C — Interactive Development Placement & Construction Choreography

Status: PLANNED  
Depends on: V.d-7A, V.d-7B  
Decision record: D-097 (proposed)  
Product spec: `docs/product/10-interactive-development-placement.md`

## 1. Goal

Turn construction from an administrative confirmation into a visible spatial planning action while preserving Landlord's current authoritative urban simulation.

V.d-7C does not replace parcels, DevelopmentCode, multi-parcel sites, deterministic footprints, crews or materials. It exposes the existing placement intelligence to the player, lets the player select among legal deterministic candidates, then makes construction progress visually legible.

## 2. Scope boundaries

In scope:

- refactor autoplacement into reusable legal candidate enumeration;
- stable placement candidate identity;
- player placement mode;
- candidate ghost preview;
- legal orientation selection;
- exact confirmation;
- stale-candidate rejection;
- AI/automation reuse of same enumeration;
- construction-stage visuals derived from progress;
- visible crew travel/arrival/work state where existing simulation supports it;
- deterministic property/site dressing;
- browser acceptance and golden evidence.

Out of scope:

- freeform footprint editing;
- manual parcel drawing;
- changing parcel generator;
- changing road topology;
- new building economics;
- new production recipes;
- victory condition;
- new municipal services;
- copied historical UI/art;
- per-worker micro-simulation.

## 3. Implementation strategy

Do not implement the entire workstream in one commit.

Recommended subphases:

```text
V.d-7C.0  baseline + placement inventory
V.d-7C.1  authoritative candidate enumeration
V.d-7C.2  command / worker / projection contract
V.d-7C.3  placement UI state
V.d-7C.4  Phaser ghost + picking + orientation
V.d-7C.5  single-parcel browser flow
V.d-7C.6  multi-parcel browser flow
V.d-7C.7  construction choreography
V.d-7C.8  derived property grounds
V.d-7C.9  hardening, performance, evidence
```

Each subphase should leave tests green.

## 4. V.d-7C.0 — Baseline and code inventory

Before code changes:

1. verify branch and HEAD;
2. run:
   - lint;
   - typecheck;
   - format;
   - tests;
   - build;
   - smoke:alpha;
   - smoke:vd-core-loop;
   - smoke:vd-ux;
3. locate the existing buildable-envelope / footprint generation functions;
4. map exact call chain from StartConstruction to final footprint/orientation;
5. identify:
   - deterministic ordering;
   - scoring;
   - setbacks;
   - coverage/FAR;
   - road frontage;
   - existing rejection codes;
   - AI callers;
   - automation callers;
6. write a short implementation inventory before refactoring.

Gate:

- exact current placement algorithm understood;
- no second algorithm designed in parallel.

## 5. V.d-7C.1 — Authoritative candidate enumeration

### 5.1 Refactor

Extract the current automatic placement logic into a pure or simulation-level helper.

Preferred conceptual API:

```ts
enumerateDevelopmentPlacementCandidates(input): readonly DevelopmentPlacementCandidate[]
```

Input should include only authoritative inputs required for legality:

- state/indexes;
- district;
- canonical parcelIds;
- BuildingDefinition;
- DevelopmentCode / vested permit rules as applicable;
- occupied footprints;
- road/frontage geometry.

### 5.2 Candidate requirements

Every candidate must:

- remain inside selected parcel union;
- respect setbacks;
- respect max coverage;
- respect FAR;
- not overlap existing building footprints;
- not overlap active site footprints;
- not overlap roads;
- not overlap public spaces;
- respect orientation/shape rules;
- satisfy any frontage/access requirement already used by current autoplacement.

### 5.3 Determinism

Candidate enumeration must be invariant to:

- Map insertion order;
- parcelIds input order;
- footprint cell discovery order.

Canonical sort must be explicit.

Suggested ordering:

```text
score desc
→ orientation
→ min y
→ min x
→ canonical footprint signature
```

If current algorithm already uses a different valid canonical order, preserve it unless there is a reason to change.

### 5.4 IDs

Add opaque `DevelopmentPlacementId` if appropriate.

The ID must be reproducible from canonical placement data.

No random UUID.

### 5.5 Tests

Required:

- same input -> same candidates;
- shuffled maps -> same candidate IDs/order;
- single legal candidate;
- multiple legal candidates;
- no candidate;
- 0/90/180/270 orientation cases;
- symmetric building does not create duplicate equivalent candidates;
- multi-parcel union;
- existing footprint obstruction;
- setback violation excluded;
- coverage/FAR invalid candidate excluded.

Gate:

- existing auto-placement test behavior preserved;
- old deterministic best placement equals first/best candidate under the new helper.

## 6. V.d-7C.2 — Command and protocol

### 6.1 Command

Adopt D-097 command shape.

Preferred:

```ts
StartConstruction {
  parcelIds;
  buildingType;
  placementId?;
}
```

The human path should provide placement identity.

Simulation re-enumerates/revalidates before committing.

### 6.2 AI compatibility

AI / automation:

```text
enumerate
→ choose deterministic best
→ dispatch same StartConstruction contract
```

No AI-only placement bypass.

### 6.3 Errors

Add precise rejection only if existing codes cannot represent the failure.

Candidate examples:

- `PLACEMENT_REQUIRED`;
- `PLACEMENT_NOT_FOUND`;
- `PLACEMENT_NO_LONGER_VALID`.

Prefer existing precise envelope/coverage/FAR errors where possible.

### 6.4 Protocol

If UI cannot efficiently obtain candidates from standing projection, add a deterministic read-only worker request.

Preferred:

```text
GetDevelopmentPlacementCandidates
```

Input:

- observed district;
- parcelIds;
- buildingType.

Output:

- candidate IDs;
- footprintCells;
- orientation;
- optional recommended flag.

Do not expose rival private plans.

### 6.5 Tests

- protocol schema;
- malformed request rejection;
- same request same ordered response;
- changing observed district does not mutate canonical game state;
- candidate request does not advance PRNG;
- human command selected candidate accepted;
- stale candidate rejected;
- AI command still accepted.

## 7. V.d-7C.3 — React placement state

Create explicit transient UI state.

Conceptual:

```ts
type PendingPlacement = {
  buildingType: BuildingType;
  parcelIds: string[];
  candidates: DevelopmentPlacementCandidate[];
  selectedCandidateId: string | null;
};
```

Do not persist it.

State transitions:

```text
idle
→ requesting
→ placing
→ confirming
→ idle
```

Failure states:

- no legal candidates;
- candidate stale;
- worker request failed.

### Integration with multi-parcel assembly

Current flow:

```text
BuildCatalog
→ PendingDevelopmentSite
→ valid parcel set
```

New flow:

```text
BuildCatalog
→ PendingDevelopmentSite if required
→ valid parcel set
→ PendingPlacement
→ confirm
→ StartConstruction
```

For one-parcel:

```text
BuildCatalog
→ PendingPlacement
```

Do not create two different placement implementations.

### Cancel hierarchy

Escape priority:

1. tooltip/popover;
2. placement confirmation;
3. placement mode;
4. parcel assembly;
5. contextual panel/hub.

Cancel placement does not cancel parcel ownership.

## 8. V.d-7C.4 — Phaser placement ghost

Add a dedicated layer:

```text
placementGraphics
placementGhostSprite
```

Keep separate from:

- normal overlays;
- selection;
- site assembly.

### Ghost

Use real BuildingThumbnail/runtime frame only if coordinate anchor/orientation is trustworthy.

Otherwise use a Graphic Civic footprint proxy first.

Requirements:

- semi-transparent;
- visibly distinct from completed building;
- footprint cells obvious;
- candidate boundary obvious;
- road frontage visible;
- no copied historic cursor.

### Candidate selection

Pointer movement may select nearest legal candidate.

Do not recalculate legality on pointer move.

Use cached candidate geometry.

### Orientation

Controls:

- rotate button;
- keyboard R if suitable;
- candidate cycle.

Rotate means select another candidate with equivalent/similar position and different legal orientation.

It does not mutate geometry locally.

### Visual states

Recommended original Landlord language:

- legal candidate: neutral cyan/teal or current accent;
- recommended candidate: stronger accent;
- selected: high-contrast boundary;
- unavailable/no candidate: subdued red explanation.

Use existing design tokens where possible.

## 9. V.d-7C.5 — Single-parcel flow

Browser test:

1. new game;
2. acquire suitable parcel;
3. open BuildCatalog;
4. choose one-parcel building;
5. placement mode opens;
6. candidate list non-empty;
7. select candidate not equal to recommended if multiple exist;
8. confirm;
9. exact footprint appears as ConstructionSite;
10. costs/materials consumed once;
11. assign crew;
12. complete.

Regression:

- no double construction on rapid confirm;
- cancel spends nothing;
- candidate preview never appears after confirmed site.

## 10. V.d-7C.6 — Multi-parcel flow

### Two parcels

Use warehouse/brickworks/cement plant.

Flow:

```text
assemble 2
→ placement
→ candidate spans legal union
→ select
→ confirm
```

### Three parcels

Use steelworks.

Required acceptance:

- 3/3 assembly;
- candidate footprint over union;
- orientation displayed;
- confirm if economy permits;
- otherwise placement itself verified without cheating economy.

Tests:

- candidate cannot use unselected fourth parcel;
- candidate cannot cross internal site boundary into rival/public parcel;
- canonical parcel order does not change candidate IDs.

## 11. V.d-7C.7 — Construction choreography

Do not change construction duration or economics.

Derive visual stage from progress.

Create helper:

```ts
constructionVisualStage(progress, required): "foundation" | "structure" | "finishing"
```

Exact thresholds documented and tested.

### Assets

Use RuntimeAssetManifestV2 if it already supports relevant construction frames.

If not:

- add lightweight procedural/Graphic Civic construction representations;
- do not block workstream on final Blender art;
- provenance required for any external asset.

### Scene behavior

Construction site should visibly occupy exact chosen footprint.

Recommended:

- foundation pad / excavation;
- scaffolding/structure;
- finishing state;
- transition to final building.

No animation should change domain state.

## 12. Crew choreography

Inspect existing agent projection before changing contracts.

If current state provides route/current position/task:

render crew travel.

If only district-level state exists:

add minimal additive projection needed to show existing authoritative information.

Do not fabricate worker movement disconnected from simulation.

Acceptance:

- assigned crew has understandable visual status;
- no work-progress illusion while simulation says crew unavailable;
- crew release reflected after completion.

## 13. V.d-7C.8 — Derived property grounds

Implement only after placement/ghost is stable.

Create deterministic planner, e.g.:

```text
property-grounds.ts
```

Inputs:

- parcel/site cells;
- building footprint;
- frontage;
- building type/form;
- urban role;
- seed/signature.

Outputs are render-only descriptors.

Possible descriptor types:

```text
path
driveway
garden
yard
fence
hedge
tree
pallet
container
loading-area
```

### Constraints

No descriptor may overlap:

- road;
- public space;
- building footprint;
- incompatible obstacle.

No random runtime calls.

The same geometry produces same dressing.

### Visual goal

A building should read as a developed property/complex rather than a free-floating sprite.

## 14. Performance

Measure:

- candidate enumeration p50/p95;
- response latency for candidate request;
- placement mode FPS;
- normal mode FPS;
- construction-site rendering;
- district switching with active/inactive placement.

Suggested gate:

- candidate request comfortably below interactive threshold on normal sites;
- no continuous candidate enumeration per frame;
- no material regression to baseline normal-map FPS;
- no sprite/listener leak after repeated enter/cancel placement.

Do not establish a hard new numeric threshold without baseline measurement.

## 15. Save/load

Placement UI before confirmation is intentionally ephemeral.

Required:

### cancel/reload before confirm

No site created.

### save after confirm while site active

Reload preserves:

- parcelIds;
- footprint;
- orientation;
- progress;
- crew assignment;
- materials/cost state.

No need to restore placement UI.

## 16. Browser smoke extension

Extend `smoke:vd-ux` or add a narrowly scoped smoke only if the existing script becomes unwieldy.

Required steps:

- single-parcel placement;
- candidate cycle;
- cancel;
- confirm;
- direct site picking;
- 2-parcel placement;
- 3-parcel placement preview;
- tooltip/panel unaffected;
- no page errors.

Avoid silent `.catch(() => {})` on critical steps.

## 17. Golden evidence

Create:

```text
docs/art/golden/vd7c/
```

Minimum:

1. single parcel recommended candidate;
2. single parcel alternative candidate;
3. rotated candidate;
4. two-parcel placement;
5. three-parcel placement;
6. no-legal-placement feedback;
7. foundation;
8. structure/scaffolding;
9. finishing;
10. completed residential property;
11. completed industrial property;
12. crew travelling/on-site;
13. residential grounds;
14. industrial grounds;
15. 1280×720 placement;
16. 1920×1080 placement.

All must be visually reviewed before closure.

## 18. Required gates

At minimum:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
pnpm smoke:alpha
pnpm smoke:vd-core-loop
pnpm smoke:vd-ux
pnpm art:assets:check
pnpm art:binaries:check
```

If simulation hot paths changed materially:

- system cost focused benchmark;
- soak if warranted.

If placement changes snapshot/canonical behavior:

- golden/canonical save-load suites.

## 19. Commit structure

Recommended:

```text
refactor: expose deterministic development placement candidates
feat: add placement candidate protocol and command validation
feat: add interactive development placement state
feat: render development placement ghost and orientation
test: cover single and multi parcel placement flows
feat: add staged construction presentation
feat: add deterministic property grounds
test: capture V.d-7C browser and visual evidence
docs: close V.d-7C interactive development placement
```

Do not combine contract refactor, UI, art and evidence in one commit.

## 20. Stop conditions

Stop and report rather than improvising if:

- current auto-placement cannot be safely refactored without changing economic rules;
- candidate enumeration would require nondeterministic render state;
- command migration would invalidate SnapshotV2 incompatibly;
- AI relies on undocumented placement behavior;
- legal candidates cannot be identified without duplicating rules;
- final visual implementation would require copying historical trade dress.

## 21. Closure

V.d-7C may be declared READY FOR HUMAN PLAYTEST only when:

- one authoritative placement algorithm exists;
- human chooses legal candidate;
- AI uses same legality;
- 1/2/3 parcel flows work;
- cancel/stale cases are safe;
- chosen footprint persists;
- construction is visually staged;
- property reads as a coherent developed site;
- tests/smokes pass;
- visual evidence reviewed;
- P0/P1 = 0.

It does not close V.d or replace the final human playtest.
