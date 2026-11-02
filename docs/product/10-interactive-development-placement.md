# Interactive Development Placement — Product Specification

Status: PROPOSED  
Target workstream: V.d-7C  
Base branch for specification: `wip/vd7b-spatial-visual-integrity@974cc42`

## 1. Product problem

Landlord already models urban land, multi-cell parcels, development codes, road frontage, deterministic footprints, construction sites, crews, materials, production and district-scale economics. The current interaction, however, compresses most of the spatial decision into:

```text
buy parcel
→ choose building
→ if needed assemble 2/3 parcels
→ confirm
→ simulation auto-selects footprint/orientation
→ assign crew
```

This is technically coherent but makes construction feel administrative rather than spatial.

The intended change is not to replace Landlord's city model with a retro block-placement model. The goal is to restore the feeling that the player physically plans and places a development while preserving the current authoritative simulation, zoning, multi-parcel rules, determinism and original IP.

## 2. Design principle

Landlord keeps:

- authoritative multi-cell parcels;
- road frontage;
- DevelopmentCode;
- setbacks;
- coverage/FAR;
- multi-parcel development sites;
- deterministic simulation;
- automatic validation;
- building footprints defined by domain data;
- player-owned/rival/public land rules;
- construction materials and crews.

Landlord adds:

- an explicit development placement mode;
- visual ghost placement on the map;
- a finite deterministic set of legal placement candidates;
- player choice among those candidates;
- orientation choice when more than one legal orientation exists;
- visual representation of the development envelope and reserved site;
- stronger construction choreography;
- visible crew travel/arrival/work state where supported by existing agent systems.

The player chooses among legal solutions. The player does not draw arbitrary footprints or bypass simulation rules.

## 3. Player experience target

The player should feel:

> “I chose this site, I saw where the building could legally go, I picked its orientation and position, then my crew physically came and built it.”

The player should not feel:

> “I clicked Construct and the game silently decided everything.”

## 4. Intended flow

### 4.1 Single-parcel development

```text
Select owned parcel
→ choose building type
→ enter Development Placement Mode
→ show legal placement candidates
→ preview candidate footprint and access
→ rotate/cycle orientation when legal
→ choose candidate
→ confirm project
→ create ConstructionSite
→ assign crew
→ crew travels/arrives
→ site progresses through visible construction states
→ building completes
```

### 4.2 Multi-parcel development

```text
Select owned parcel
→ choose 2/3-parcel building
→ assemble required adjacent parcels
→ confirm parcel set
→ enter Development Placement Mode for combined site
→ show legal candidates over parcel union
→ choose candidate/orientation
→ confirm project
→ create ConstructionSite with canonical parcelIds + chosen placement
```

The existing parcel assembly UX remains. Placement begins only after the parcel set is valid.

## 5. Development Placement Mode

### 5.1 Entry

Entered from the construction detail after:

- building type selected;
- player owns required parcels;
- required parcel count satisfied;
- site set is edge-connected when required;
- minimum combined area satisfied;
- no active conflicting construction exists.

For one-parcel buildings, the mode starts directly from the owned parcel.

### 5.2 Map presentation

During placement:

- normal parcel/selection highlight becomes secondary;
- candidate footprint is the visual focus;
- legal candidate uses a positive neutral highlight;
- invalid map areas may show restrained red feedback only when relevant;
- road frontage is visible;
- setbacks may be shown as a subtle envelope;
- parcel boundaries remain visible but secondary;
- building ghost uses the real runtime asset when possible;
- if a real asset cannot be rendered safely, use a clean footprint proxy rather than a fake sprite.

No copied visual language from historical reference games.

### 5.3 Candidate selection

The simulation or a pure shared domain helper exposes a deterministic ordered list of legal placement candidates.

Conceptually:

```ts
type DevelopmentPlacementCandidate = {
  id: string;
  districtId: DistrictId;
  parcelIds: ParcelId[];
  footprintCells: GridCell[];
  orientation: 0 | 90 | 180 | 270;
  frontageScore: number;
  continuityScore: number;
};
```

Exact fields may differ, but identity, parcel scope, footprint and orientation are required.

Candidate IDs must be derived deterministically from canonical placement data, not array order.

### 5.4 Candidate navigation

Supported controls:

- pointer hover/click on candidate;
- previous/next candidate;
- rotate orientation when another legal orientation exists;
- Escape cancels placement;
- Enter or explicit Confirm action commits selected candidate.

The UI must work without keyboard-only assumptions.

### 5.5 No freeform illegal placement

The player cannot drag a footprint to arbitrary cells and ask the engine to “make it work”.

The game may allow snapping the ghost toward the pointer, but the result always resolves to one of the legal deterministic candidates.

## 6. Simulation contract

Current V.d.2 automatic placement logic already enumerates and scores buildable footprints. V.d-7C should refactor that logic so the same source of truth can support:

1. auto-placement for AI/automation when appropriate;
2. candidate enumeration for the human player;
3. validation of a chosen candidate at command execution time.

The selected candidate must be revalidated by simulation when the construction command is executed.

Never trust React/Phaser.

## 7. Command model

Preferred direction:

```ts
StartConstruction {
  parcelIds: ParcelId[];
  buildingType: BuildingType;
  placementId?: DevelopmentPlacementId;
}
```

or, if stronger replay transparency is preferred:

```ts
StartConstruction {
  parcelIds: ParcelId[];
  buildingType: BuildingType;
  placement: {
    footprintCells: GridCell[];
    orientation: 0 | 90 | 180 | 270;
  };
}
```

The final choice belongs in ADR D-097.

Requirements:

- canonical serialization;
- snapshot-safe;
- deterministic replay;
- AI can still use deterministic best candidate;
- stale/illegal candidate is rejected;
- no placement-specific private UI state enters GameState before confirmation.

## 8. AI and automation

AI and delegated automation must not require a UI choice.

They may:

- enumerate the same legal candidates;
- select the existing deterministic highest-ranked candidate;
- dispatch the same authoritative construction command.

The human player gains choice; AI does not gain different rules.

## 9. Construction choreography

The construction site should become visually legible as a physical process.

Minimum target states:

```text
planned
foundation
structure/scaffolding
finishing
complete
```

These can be presentation-derived from authoritative progress rather than persisted as separate domain states if no gameplay rule depends on them.

Example progress bands:

- 0–15%: ground works/foundation;
- 15–70%: structural shell/scaffolding;
- 70–99%: finishing;
- 100%: complete building.

Exact thresholds are presentation constants and must not affect construction duration.

## 10. Crew choreography

Where existing crew/agent/pathfinding contracts allow it:

```text
assigned
→ travelling
→ arrived/on-site
→ working
→ released
```

Construction progress should not visually begin before the assigned crew is operationally present if the simulation already enforces presence.

Do not invent per-worker bricklaying simulation.

The goal is spatial causality, not micromanagement.

## 11. Site dressing

Unused cells inside the selected parcel set can derive contextual dressing from building/site type.

Residential examples:

- garden;
- path;
- hedge/fence;
- small yard;
- trees.

Industrial examples:

- service yard;
- pallets;
- containers;
- loading area;
- storage;
- hardstanding.

Mixed/commercial examples:

- service access;
- rear yard;
- small forecourt;
- delivery space.

Rules:

- dressing is derived and ephemeral;
- it never changes authoritative land use;
- it does not occupy roads/public spaces;
- it respects building footprint;
- it remains deterministic;
- it uses Landlord's own visual language and licensed/open assets.

## 12. Property enclosure

A development should visually read as a property, not as a sprite dropped on terrain.

Possible derived elements:

- outer parcel/site boundary;
- frontage opening;
- fence/hedge where appropriate;
- driveway/path between frontage and building;
- service access.

These elements are presentation-derived unless a later product decision promotes them to gameplay.

## 13. Feedback and rejection

Before confirmation the UI should explain why no candidate exists.

Player-facing examples:

- “No cabe este edificio respetando los retranqueos.”
- “La superficie edificable es insuficiente.”
- “El proyecto necesita acceso válido a la calle.”
- “La combinación de parcelas no admite una huella legal.”

Do not expose raw codes as the primary message.

Simulation may keep technical codes such as coverage/FAR/buildable-envelope violations.

## 14. Relationship to V.d-7A and V.d-7B

V.d-7A remains authoritative for:

- parcelIds;
- requiredParcels;
- canonical parcel sets;
- multi-parcel permits;
- reservation;
- collateral allocation.

V.d-7B remains authoritative for:

- parcel geometry;
- semantic selection;
- direct sprite picking;
- multi-parcel assembly UX;
- road frontage visualization;
- contextual panels;
- tooltip behavior.

V.d-7C starts after the site set is valid and ends when ConstructionSite is created and visually staged.

## 15. Non-goals

V.d-7C does NOT add:

- arbitrary terrain sculpting;
- road construction;
- manual drawing of parcel boundaries;
- freeform footprint editing;
- copied mechanics/UI from Constructor, Street Wars or Mob Rule;
- new economy;
- new building catalog;
- new victory condition;
- new production recipes;
- per-worker animation simulation;
- multiplayer;
- dynamic zoning editor.

## 16. IP rule

Historical construction games may be used only to study abstract interaction principles:

- spatial preview;
- property enclosure;
- visible construction staging;
- worker arrival;
- resource feedback.

Do not copy:

- interface layout;
- iconography;
- cursor art;
- wording;
- building designs;
- sounds;
- animations;
- names;
- progression tables;
- level structure.

Landlord remains an original IP.

## 17. UX acceptance criteria

A player must be able to:

1. buy a legal parcel;
2. choose a building;
3. understand where it can legally fit;
4. choose between at least two legal candidates when multiple exist;
5. understand orientation;
6. cancel without side effects;
7. confirm one placement;
8. see exactly that footprint become the construction site;
9. assign a crew;
10. understand visually that the crew is travelling/working;
11. see visible progress;
12. see the exact selected building complete in the chosen position.

## 18. Determinism acceptance

For same:

```text
seed
state
parcelIds
buildingType
candidate selection
```

the same footprint/orientation and canonical digest must result.

Candidate enumeration must be invariant to Map/array insertion order.

## 19. Browser acceptance

Required browser scenarios:

### A — one-parcel residential

- buy parcel;
- choose row house or courtyard home;
- placement mode;
- inspect candidates;
- confirm non-default candidate when available;
- build;
- complete.

### B — two-parcel industrial

- assemble two parcels;
- select cement/brickworks/warehouse;
- enter placement;
- confirm;
- site footprint matches preview.

### C — three-parcel steelworks

- assemble valid 3-parcel site;
- placement preview spans combined land correctly;
- choose orientation/candidate;
- confirm or, if economy blocks start, verify placement stage without bypass.

### D — cancellation

- enter placement;
- change candidate;
- cancel;
- no command;
- no money/material change;
- no site created.

### E — stale candidate

- enumerate candidate;
- mutate authoritative state through a legal command so candidate becomes invalid;
- attempt confirmation;
- simulation rejects cleanly.

## 20. Visual acceptance

Golden evidence should include:

- single-parcel placement ghost;
- candidate rotation/orientation;
- legal/illegal or available/unavailable feedback;
- multi-parcel placement;
- foundation;
- scaffolding/structure;
- finishing;
- completed property;
- crew approaching/on site;
- residential grounds;
- industrial yard.

## 21. Performance constraints

Placement mode must not:

- enumerate candidates every render frame;
- rebuild all district geometry continuously;
- allocate large transient arrays per pointer move;
- materially reduce normal-map FPS when inactive.

Candidate enumeration should be event-driven and cached by authoritative inputs.

## 22. Success definition

V.d-7C succeeds when Landlord preserves its modern urban simulation while making building construction feel like a deliberate spatial act chosen by the player.

The essential product statement is:

> Landlord should not copy a 1990s construction interface. It should recover the agency of spatial planning while keeping the deterministic city simulation that now differentiates the project.
