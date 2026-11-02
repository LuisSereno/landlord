# D-097 — Interactive Development Placement

Status: PROPOSED  
Workstream: V.d-7C  
Decision date: 2026-11-02

## Context

Landlord currently resolves building placement automatically after the player has selected a legal parcel set. This preserves determinism and keeps the simulation authoritative, but it removes too much spatial agency from the act of construction.

Historical construction strategy games demonstrate a useful abstract interaction principle: the player understands construction better when the intended building is previewed physically on the world before commitment, legal/illegal placement is visible, and the construction process has spatial presence. Landlord must recover that principle without copying any historical game's interface, content, art, progression or exact mechanics.

V.d-7A already established canonical multi-parcel site contracts. V.d-7B established authoritative parcel geometry, semantic selection, direct entity picking and multi-parcel assembly UX.

The open architectural question is how to let a human choose placement while retaining:

- deterministic simulation;
- replayability;
- AI parity;
- DevelopmentCode rules;
- setbacks;
- coverage/FAR;
- road frontage;
- canonical snapshots;
- clean separation between simulation and render.

## Decision

Landlord will use **deterministic candidate placement**, not freeform player-authored footprints.

The authoritative placement system will expose a stable ordered set of legal placement candidates for a given:

```text
state
district
parcelIds
buildingType
```

Each candidate contains at least:

- canonical identity;
- parcel scope;
- footprint cells;
- orientation.

The human player chooses one candidate through a visual placement mode.

AI and automation use the same candidate enumeration but may continue to select the deterministic highest-ranked candidate automatically.

The final construction command revalidates the selected candidate in simulation.

## Why this decision

### Compared with fully automatic placement

Advantages:

- restores meaningful spatial agency;
- makes setbacks/frontage/fit visible;
- makes construction a map interaction rather than a panel-only action;
- creates a natural place for visual preview and orientation;
- preserves the current urban model.

### Compared with freeform placement

Advantages:

- deterministic;
- testable;
- no UI-only geometry rules;
- avoids malformed footprints;
- avoids hidden divergence between React and simulation;
- AI can use identical rules;
- stale selections can be rejected cleanly;
- canonical replay remains straightforward.

## Candidate contract

Recommended domain-level shape:

```ts
type DevelopmentPlacementCandidate = {
  id: DevelopmentPlacementId;
  districtId: DistrictId;
  parcelIds: ParcelId[];
  footprintCells: GridCell[];
  orientation: 0 | 90 | 180 | 270;
};
```

Optional scoring/debug information may remain internal:

```ts
type PlacementScore = {
  frontage: number;
  continuity: number;
  compactness?: number;
};
```

Scoring should not be required by the UI unless needed to label a recommended candidate.

## Identity

`DevelopmentPlacementId` must derive from canonical data, for example:

```text
building type
+
canonical parcelIds
+
canonical footprint signature
+
orientation
```

It must not derive from enumeration order.

## Enumeration

Refactor the current autoplacement implementation rather than creating a second placement algorithm.

Preferred architecture:

```text
enumerate legal candidates
→ canonical sort
→ optional score/rank
→ human UI chooses OR AI chooses best
→ StartConstruction revalidates selected candidate
```

One legal source of truth.

## Command decision

Preferred command:

```ts
StartConstruction {
  parcelIds: ParcelId[];
  buildingType: BuildingType;
  placementId?: DevelopmentPlacementId;
}
```

Human path:

- placementId required after placement mode is enabled.

AI/automation path:

- either supplies the selected deterministic candidate ID;
- or uses a command helper that resolves the deterministic best candidate before dispatch.

Alternative allowed if implementation shows that candidate identity is not sufficient across save/replay boundaries:

```ts
placement: {
  footprintCells: GridCell[];
  orientation: 0 | 90 | 180 | 270;
}
```

If this alternative is chosen, simulation must recompute and confirm that the submitted geometry exactly matches one currently legal candidate.

The implementation acta must record which form was adopted and why.

## Persistence

No unconfirmed placement state is persisted in GameState.

Before confirmation, placement selection belongs to UI state.

After confirmation:

- ConstructionSite persists the authoritative chosen footprint;
- orientation persists as already required by current contracts;
- parcelIds remain canonical.

Save/load during an active construction must preserve the chosen placement exactly.

## Projection

Projection may expose legal candidates for the current player/site, but must not publish unnecessary private rival planning information.

Preferred approach:

- request/derive candidates only for the active player interaction;
- avoid putting every legal footprint for every parcel in the standing world projection.

If worker protocol needs an additive technical request such as:

```text
GetDevelopmentPlacementCandidates
```

that is acceptable provided it is deterministic and read-only.

## React/Phaser responsibilities

Simulation:

- legal candidate enumeration;
- validation;
- authoritative chosen footprint;
- command acceptance/rejection.

React:

- placement interaction state;
- catalog/confirmation controls;
- explanatory copy.

Phaser:

- ghost rendering;
- candidate footprint visualization;
- pointer hit testing for candidate choice;
- construction-stage presentation.

Phaser does not decide whether a candidate is legal.

## Orientation

Orientation is a player choice only among orientations represented by legal candidates.

No rotation may fabricate geometry by rotating an asset independently of domain footprint.

For symmetric buildings, orientation controls may be omitted when they have no meaningful result.

## Snapping

Pointer movement may select the nearest candidate to the pointer.

The pointer never creates a new candidate.

Recommended behavior:

```text
pointer world cell
→ nearest legal candidate anchor/centroid
→ candidate selected
→ ghost snaps
```

Keyboard/controller next/previous candidate remains available.

## Cancellation

Escape or Cancel:

- exits placement;
- creates no ConstructionSite;
- spends no money;
- consumes no materials;
- consumes no permit;
- leaves no reservation beyond whatever pre-existing parcel ownership already existed.

This must have a regression test.

## Stale placement

A placement preview can become stale if state changes before confirmation.

The simulation must reject it with a specific code, for example:

```text
PLACEMENT_NO_LONGER_VALID
```

or reuse an existing precise buildability code if that better describes the failure.

The UI refreshes candidates rather than silently choosing a different footprint.

## Construction choreography

Construction visual stages are derived presentation unless future gameplay explicitly needs them.

Recommended derived phases:

```text
foundation
structure
finishing
```

They map from current authoritative construction progress.

Do not add extra simulation ticks or alter workRequired merely to support visuals.

## Crew choreography

Existing district/path/presence rules remain authoritative.

V.d-7C may visualize:

- assigned;
- travelling;
- on site;
- working.

If current simulation does not expose enough information, projection may be extended additively.

Do not add a second movement model for visuals.

## Site grounds

Derived property dressing is accepted as a presentation concern:

- garden;
- path;
- fence/hedge;
- service yard;
- loading/storage props.

Dressing must be deterministic from authoritative geometry and building/site type.

It must not affect:

- ownership;
- buildability;
- collision;
- production;
- valuation;

unless a future ADR promotes those elements to gameplay.

## AI parity

AI and player share:

- legal site rules;
- candidate enumeration;
- command validation;
- costs;
- materials;
- crews;
- permits.

The human receives placement agency. The AI may deterministically choose the best candidate.

This difference is UI/control, not rules.

## Intellectual-property constraint

The design is based on an abstract principle, not reproduction.

Forbidden:

- historical cursor artwork;
- copied HUD;
- copied placement colors/layout if distinctive;
- copied building grounds;
- copied names/text;
- copied animation timing;
- copied progression.

Landlord's spatial planning language must remain original and consistent with Graphic Civic.

## Testing consequences

Required unit/property tests:

- candidate enumeration deterministic;
- insertion-order invariance;
- candidate IDs stable;
- every candidate obeys envelope/coverage/FAR/setbacks;
- no footprint crosses roads/public spaces/other footprints;
- orientation matches footprint;
- same state + choice gives same result;
- stale candidate rejected;
- cancel has zero authoritative side effects;
- AI best candidate remains deterministic.

Required integration:

- single parcel;
- two parcels;
- three parcels;
- save/load active site;
- AI construction;
- automation construction.

Required browser:

- ghost;
- candidate switch;
- orientation;
- confirm;
- cancel;
- stale rejection messaging;
- construction stages.

## Performance consequence

Candidate enumeration must be demand-driven.

It must not execute every Phaser frame.

Cache key should include only authoritative inputs that affect legality.

If candidate enumeration becomes expensive, optimize exact enumeration/indexing before introducing approximation.

## Compatibility

No requirement to migrate old SnapshotV2 states that predate this new placement contract unless implementation changes persisted ConstructionSite shape incompatibly.

Preferred implementation is additive:

- existing active sites remain valid;
- new sites record the same existing footprint/orientation fields;
- new command metadata is consumed at construction start.

## Rejected alternatives

### A. Keep fully automatic placement

Rejected because it preserves too little player spatial agency.

### B. Freeform drag/drop footprint

Rejected because it duplicates domain rules and risks nondeterminism.

### C. Manual drawing of property boundaries

Rejected because parcel boundaries already have authoritative urban meaning and this would create excessive micromanagement.

### D. Make fences/yards authoritative immediately

Rejected because presentation value can be validated first without increasing simulation scope.

## Consequences

Positive:

- construction becomes a physical planning act;
- V.d urban geometry becomes directly legible in gameplay;
- multi-parcel developments gain a meaningful second step;
- worker/site systems become more visible;
- visual identity improves without discarding current architecture.

Cost:

- placement candidate API/refactor;
- new UX state;
- new Phaser ghost layer;
- more browser tests;
- additional construction art/states.

## Gate

D-097 can be marked ACCEPTED only after:

- the implementation reuses a single authoritative placement algorithm;
- AI and player use the same legality rules;
- candidate enumeration is deterministic;
- browser evidence proves player placement choice;
- no simulation/render boundary is violated;
- no copied historical visual/trade-dress elements are introduced.
