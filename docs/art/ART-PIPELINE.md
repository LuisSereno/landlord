# Art Pipeline Specification — Landlord

> Version: 0.1
>
> Status: preproduction engineering specification.
>
> Purpose: define a reproducible path from editable source asset to validated runtime content for Phaser.
>
> Governance: concrete tool versions and numeric budgets marked BASELINE remain provisional until the Visual Direction Spike and profiling close them.

---

## 1. Objectives

The pipeline must optimize for:

1. visual consistency across multiple contributors;
2. deterministic/reproducible output where practical;
3. automation;
4. low-friction web integration;
5. source provenance;
6. validation before merge;
7. scalability from tens to hundreds of assets;
8. independence between gameplay state and visual asset implementation.

The first successful production asset is not “a beautiful building”.

It is:

> **A building that can be modified in its source file and regenerated with one documented workflow into a correctly lit, anchored, trimmed, packed, metadata-valid, Phaser-loadable and visually tested runtime asset.**

---

## 2. Pipeline status legend

- **DECIDED** — current project decision.
- **BASELINE** — proposed production default, pending spike/profile.
- **OPEN** — unresolved and must not be hard-coded as irreversible.
- **FUTURE** — explicitly deferred.

---

## 3. End-to-end architecture

### 3.1 Candidate production flow — BASELINE

\`\`\`text
concept / art bible
    ↓
source asset
    ↓
model / UV / materials
    ↓
rig / animation if required
    ↓
source validation
    ↓
canonical camera + lighting
    ↓
headless render
    ↓
RGBA master frames
    ↓
post / trim / validation
    ↓
atlas packing
    ↓
runtime metadata
    ↓
asset manifest
    ↓
Phaser ingestion
    ↓
Art Lab
    ↓
visual regression
    ↓
performance smoke
    ↓
approved runtime asset
\`\`\`

### 3.2 Source and runtime are different products

Authoritative source files exist for editability.

Runtime files exist for loading performance.

Do not edit generated runtime atlases manually.

---

## 4. Repository layout

### 4.1 Baseline layout

\`\`\`text
landlord/
├── art/
│   ├── README.md
│   ├── concepts/
│   ├── blender/
│   │   ├── buildings/
│   │   ├── characters/
│   │   ├── vehicles/
│   │   ├── props/
│   │   └── templates/
│   ├── textures/
│   ├── substance/
│   ├── aseprite/
│   ├── ui-source/
│   ├── audio-source/
│   └── manifests/
│
├── assets-generated/
│   ├── frames/
│   ├── atlases/
│   ├── audio/
│   └── manifests/
│
├── apps/web/public/assets/
│   ├── atlases/
│   ├── terrain/
│   ├── ui/
│   ├── vfx/
│   └── audio/
│
├── tools/
│   └── art-pipeline/
│       ├── blender/
│       ├── pack/
│       ├── validate/
│       └── manifests/
│
└── docs/art/
\`\`\`

### 4.2 Separate art repository — FUTURE

Remain monorepo initially.

Re-evaluate a separate \`landlord-art-source\` only when binary source history becomes materially large, permissions differ, LFS/storage cost becomes a problem, or art CI requires an independent lifecycle.

---

## 5. Toolchain

### 5.1 Core DCC — BASELINE

Blender is the preferred authoritative 3D source tool.

Reasons established by the research include orthographic cameras, reproducible scene setup, Python scripting, command-line/headless rendering, rigging and animation.

Exact LTS version remains OPEN until the spike freezes it.

### 5.2 Renderer — BASELINE

Proposed:

- EEVEE for batch production;
- Cycles for reference, material validation and hero/marketing work where justified.

Do not use Cycles by default if it materially slows iteration without visible gameplay benefit.

### 5.3 Optional tools

- Substance Painter — advanced texturing, optional.
- Krita / Photoshop — concept, paintover, UI source, optional.
- Aseprite — 2D VFX, icon/sprite correction, useful.
- TexturePacker — candidate atlas packer.
- Tiled — candidate map/terrain authoring tool.
- Playwright — visual regression for web.
- Pixelmatch or equivalent — optional granular visual diff.

No optional commercial tool may become a mandatory contributor dependency without explicit approval.

---

## 6. Tool version pinning

Production must never depend on “latest”.

Proposed manifest:

\`\`\`json
{
  "blender": "TBD-LTS",
  "texturePacker": "TBD",
  "aseprite": "TBD",
  "assetSchema": 1,
  "pipelineSchema": 1
}
\`\`\`

Store under a versioned tooling configuration such as:

\`\`\`text
tools/versions.json
\`\`\`

---

## 7. Units and scale

### 7.1 Blender units — BASELINE

\`\`\`text
1 Blender unit = 1 metre
\`\`\`

### 7.2 Logical cell — OPEN

Working proposal:

\`\`\`text
1 Landlord cell ~ 4 x 4 metres
\`\`\`

Freeze only after the spike validates building/vehicle/character density.

### 7.3 No per-asset scale hacks

Assets must respect a master scale.

Exceptions require a written reason, visible review and metadata note if technically relevant.

---

## 8. Master templates

Candidate templates:

\`\`\`text
art/blender/templates/
├── building.blend
├── character.blend
├── prop.blend
└── vehicle.blend
\`\`\`

Each template should contain controlled collections:

\`\`\`text
COL_CAMERA
COL_LIGHTING
COL_REFERENCE
COL_RENDER
COL_COLLISION_HELPERS
COL_ANCHORS
\`\`\`

Reserved objects:

\`\`\`text
CAM_GAME
LIGHT_KEY
LIGHT_FILL
ANCHOR_ROOT
FOOTPRINT
HEIGHT_GUIDE
\`\`\`

Contributors should duplicate templates rather than rebuilding camera/light rigs.

---

## 9. Camera rig

### 9.1 Baseline

\`\`\`text
projection      ORTHOGRAPHIC
azimuth         ~45°
elevation       ~30°
roll            0°
camera shift    0
\`\`\`

Exact values are OPEN until the Visual Direction Spike.

### 9.2 Camera script

The pipeline should provide a script such as:

\`\`\`text
tools/art-pipeline/blender/camera_rig.py
\`\`\`

Responsibilities:

- orient camera toward world origin;
- set orthographic scale;
- validate expected projected footprint;
- fail when camera metadata deviates from project baseline.

Avoid hand-entered Euler values per asset.

---

## 10. Lighting rig

### 10.1 Canonical baseline

- fixed directional/key light;
- visual north-west source;
- visual south-east shadow direction;
- soft fill;
- transparent background;
- controlled ambient occlusion;
- no clipped black areas.

### 10.2 Why lighting is fixed

With baked sprites, incompatible light direction between assets is immediately visible.

A physically moving runtime sun is outside v0.1 pipeline scope.

---

## 11. Modelling rules

### 11.1 Buildings

Model for game silhouette first.

Priorities:

1. footprint;
2. massing;
3. roof line;
4. entrance/loading language;
5. gameplay-readable props;
6. material segmentation;
7. secondary detail.

### 11.2 Geometry economy

Because final world output is prerendered, polygon count is not a runtime GPU cost in the same way as real-time 3D.

However excessive geometry still increases authoring time, Blender load time, batch render time and maintenance.

Do not model invisible detail.

### 11.3 Modular kits

Prefer reusable modules for windows, doors, chimneys, awnings, roof equipment, pipes, fire escapes, vents, signs, fences and loading props.

---

## 12. Materials and textures

### 12.1 Internal material model

Candidate source channels:

\`\`\`text
BaseColor
Roughness
Metallic
Normal
AO
Emission
\`\`\`

The final sprite may collapse these into a single RGBA output.

### 12.2 Reuse

Shared materials should be named and versioned.

Avoid one material per building unless there is a real visual reason.

### 12.3 Substance

If Substance Painter is used:

- export naming must map to project conventions;
- the \`.spp\` is source, not runtime;
- contributors without Substance must still be able to deliver a valid Blender-based asset.

---

## 13. Source formats

### 13.1 Authoritative

\`\`\`text
.blend
\`\`\`

### 13.2 Optional source

\`\`\`text
.spp
.psd
.kra
.aseprite
.wav
\`\`\`

### 13.3 Interchange

\`\`\`text
.glb
\`\`\`

GLB is an exchange format, not the authoritative art master.

### 13.4 Render master

Candidate:

\`\`\`text
PNG RGBA 16-bit
\`\`\`

OpenEXR is optional for workflows that genuinely require HDR/passes.

### 13.5 Runtime baseline

Candidate:

\`\`\`text
PNG RGBA 8-bit
+ atlas metadata
\`\`\`

WebP/AVIF are more appropriate for selected large UI/marketing imagery than as an automatic first choice for world atlases.

GPU-compressed textures are FUTURE until profiling demonstrates need.

---

## 14. Asset IDs and naming

### 14.1 General rule

ASCII, lower snake case, no spaces.

Prefixes:

\`\`\`text
bld_ building
chr_ character
veh_ vehicle
prp_ prop
ter_ terrain
vfx_ effect
ui_  interface
ico_ icon
snd_ sound
mus_ music
\`\`\`

### 14.2 Examples

Building:

\`\`\`text
bld_res_rowhouse_a_r0_complete
bld_res_rowhouse_a_r0_build_25
bld_res_rowhouse_a_r0_build_50
bld_res_rowhouse_a_r0_damaged
\`\`\`

Character:

\`\`\`text
chr_worker_m01_idle_ne_f000
chr_worker_m01_walk_ne_f000
chr_worker_m01_walk_ne_f001
\`\`\`

Terrain:

\`\`\`text
ter_asphalt_clean_a
ter_grass_dry_a
ter_road_straight_ne_sw
\`\`\`

### 14.3 Versioning

Do not encode \`v1\`, \`v2\`, \`final\`, \`final2\` or similar suffixes in runtime asset IDs.

Version belongs in Git and manifests.

---

## 15. Anchors, pivots and footprints

### 15.1 Anchor source of truth

Each relevant Blender source contains:

\`\`\`text
ANCHOR_ROOT
\`\`\`

### 15.2 Characters

\`\`\`text
ANCHOR_ROOT = midpoint between feet on ground
\`\`\`

### 15.3 Buildings

\`\`\`text
ANCHOR_ROOT = logical footprint origin on ground plane
\`\`\`

### 15.4 Automated projection

The build script projects \`ANCHOR_ROOT\` through the canonical camera and writes runtime anchor/pivot metadata.

This prevents trimming from breaking placement.

### 15.5 Footprint data

Footprints are gameplay data.

Example:

\`\`\`json
{
  "assetId": "bld_res_rowhouse_a",
  "footprint": {
    "width": 2,
    "height": 3,
    "mask": [
      [1, 1],
      [1, 1],
      [1, 1]
    ]
  }
}
\`\`\`

Never derive occupancy from alpha pixels.

---

## 16. Building states

Minimum candidate pipeline states:

\`\`\`text
planned
foundation
construction_50
complete
damaged
\`\`\`

Optional:

\`\`\`text
abandoned
upgraded_1
upgraded_2
\`\`\`

The source should reuse geometry/materials wherever possible.

Do not count every state as a completely independent asset in production planning.

---

## 17. Character rig and animation

### 17.1 Base rig

One reusable rig should drive multiple character variants where feasible.

### 17.2 Direction output — BASELINE

Candidate:

\`\`\`text
N NE E SE S SW W NW
\`\`\`

### 17.3 Batch output

For each clip:

\`\`\`text
rig animation
-> direction/orientation loop
-> frame loop
-> headless render
-> named frames
\`\`\`

Example output:

\`\`\`text
chr_worker_m01_walk_ne_f000.png
...
chr_worker_m01_walk_ne_f007.png
\`\`\`

### 17.4 Mirroring

No automatic global mirroring.

Allow only when asset metadata explicitly declares it safe.

---

## 18. Render automation

### 18.1 Required command-line capability

Target commands should converge toward:

\`\`\`text
pnpm art:validate
pnpm art:render
pnpm art:pack
pnpm art:manifest
pnpm art:test
pnpm art:build
\`\`\`

Exact implementation is OPEN.

### 18.2 Headless Blender

The pipeline should invoke Blender in background/headless mode with version-pinned scripts.

The script should control scene, camera, lighting, frame, orientation, render resolution, transparent background, output name and output path.

### 18.3 Do not render everything on every PR

Use changed-asset detection and build cache.

Candidate cache key:

\`\`\`text
SHA256(
  source
  + referenced textures
  + render settings
  + Blender version
  + pipeline version
)
\`\`\`

---

## 19. Render output and post-processing

### 19.1 Master

BASELINE:

- PNG RGBA;
- transparent background;
- high-quality master;
- 16-bit candidate for grading headroom.

### 19.2 Runtime

BASELINE:

- 8-bit RGBA;
- cropped/trimmed;
- atlas packed.

### 19.3 Post-processing

Permitted operations should be deterministic and scripted where possible:

- crop/trim;
- alpha cleanup;
- color-space conversion;
- downscale;
- edge extrusion;
- metadata generation.

Avoid undocumented manual Photoshop fixes to generated runtime sprites.

If a manual paintover is required, preserve the editable source and document the step.

---

## 20. Trim and atlas packing

### 20.1 Candidate pack settings — BASELINE

\`\`\`text
trim                 on
trim threshold       1
trim margin          2 px
extrude              2 px
shape padding        4 px
border padding       4 px
rotation in atlas    off
algorithm            MaxRects
max atlas            2048 x 2048
multipack            on
\`\`\`

All values require profiling before being frozen.

### 20.2 Atlas families

Do not create one global atlas.

Candidate groups:

\`\`\`text
atlas_terrain
atlas_buildings_residential
atlas_buildings_commercial
atlas_buildings_industrial
atlas_characters_workers
atlas_characters_civilians
atlas_vfx
\`\`\`

### 20.3 Rotation

Keep atlas sprite rotation disabled initially for easier debugging and tooling.

---

## 21. Phaser ingestion

### 21.1 Loader

Use Phaser atlas/multiatlas support for world families that exceed one texture page.

Conceptual example:

\`\`\`ts
this.load.multiatlas(
  "buildings-residential",
  "/assets/atlases/buildings-residential.json",
  "/assets/atlases/"
);
\`\`\`

### 21.2 Animation

Animation clips are created from named atlas frames.

Conceptual example:

\`\`\`ts
this.anims.create({
  key: "worker.walk.ne",
  frames: this.anims.generateFrameNames("characters-workers", {
    prefix: "chr_worker_m01_walk_ne_f",
    start: 0,
    end: 7,
    zeroPad: 3,
  }),
  frameRate: 12,
  repeat: -1,
});
\`\`\`

Runtime code should depend on logical asset IDs/manifests, not hard-coded filesystem assumptions spread across scenes.

---

## 22. Depth sorting

Depth must be computed from logical world position and explicit asset metadata, not the trimmed PNG rectangle.

Potential inputs:

- cell coordinates;
- local position;
- asset anchor;
- layer class;
- temporary gameplay elevation.

The precise sorting formula belongs in engineering documentation once implemented.

---

## 23. Terrain pipeline

Terrain authoring may use Tiled or an equivalent data-driven editor, but the logical map remains separate from visuals.

Pipeline must support tile IDs, terrain family, variants, road adjacency, properties, overlays and district/zoning metadata.

No collision data derived from sprite image shape.

---

## 24. VFX pipeline

### 24.1 Sprite VFX

Use Aseprite or rendered frames where appropriate for dust, sparks, smoke puffs, small fire, splash and steam.

### 24.2 Procedural VFX

Prefer runtime procedural geometry/particles for selection, placement, zoning, route lines, masks and influence areas.

### 24.3 Overdraw budget

Transparent full-screen effects are high risk.

Dense-scene profiling is mandatory before approving large particle systems.

---

## 25. UI pipeline

### 25.1 Runtime format

DOM/CSS/SVG for operational UI whenever practical.

### 25.2 Rules

- no operational localized text baked into images;
- support flexible text width;
- support pseudo-localization;
- expose design tokens;
- preserve keyboard/focus states;
- export icons consistently.

---

## 26. Audio pipeline

Master proposal:

\`\`\`text
48 kHz
24-bit
WAV
\`\`\`

Runtime should derive compressed web formats from masters.

Categories:

- UI;
- construction;
- industry;
- traffic;
- citizens;
- crime;
- police;
- weather;
- ambience;
- music.

Audio runtime policy must include concurrency and priority.

---

## 27. Asset manifest

Every deliverable should be represented by structured metadata.

Candidate schema:

\`\`\`json
{
  "schemaVersion": 1,
  "assetId": "bld_res_rowhouse_a",
  "type": "building",
  "category": "residential",
  "author": "github:contributor",
  "origin": "original",
  "license": "PROJECT-ASSET-LICENSE",
  "source": "art/blender/buildings/res/rowhouse_a.blend",
  "artBibleVersion": "0.1",
  "toolchain": {
    "blender": "TBD"
  },
  "footprint": {
    "width": 2,
    "height": 3
  },
  "anchor": "ANCHOR_ROOT",
  "atlasGroup": "buildings_residential",
  "tags": [
    "era_1920",
    "residential",
    "low_income"
  ]
}
\`\`\`

The final schema must be machine-validated.

---

## 28. Provenance and licensing

### 28.1 Required origin

Allowed categories:

\`\`\`text
original
licensed
public_domain
generated
derived
\`\`\`

### 28.2 AI-assisted or generated material

Record generator/tool, model when known, human review, license review state and source references where applicable.

No generated asset is accepted solely because it looks original.

Similarity and provenance still require human review.

### 28.3 Public repository rule

The project should remain able to answer who made an asset, from what source, under what license and what pipeline version created its runtime output.

---

## 29. Git LFS — BASELINE

Candidate LFS patterns:

\`\`\`gitattributes
*.blend filter=lfs diff=lfs merge=lfs -text
*.spp filter=lfs diff=lfs merge=lfs -text
*.psd filter=lfs diff=lfs merge=lfs -text
*.kra filter=lfs diff=lfs merge=lfs -text
*.aseprite filter=lfs diff=lfs merge=lfs -text
*.exr filter=lfs diff=lfs merge=lfs -text
*.wav filter=lfs diff=lfs merge=lfs -text
\`\`\`

Do not automatically place every PNG in LFS.

This policy must be approved before large binary history is added.

---

## 30. CI pipeline

### 30.1 Pull request

Target:

\`\`\`text
PR
├── metadata validation
├── source validation
├── naming validation
├── changed-assets render
├── dimensions / alpha validation
├── atlas build
├── manifest build
├── app / Art Lab build
├── visual tests
└── small performance smoke
\`\`\`

### 30.2 Nightly

Target:

\`\`\`text
nightly
├── complete re-render
├── complete atlas rebuild
├── visual regression suite
└── performance suite
\`\`\`

### 30.3 Failure policy

CI should fail on objectively invalid assets, including duplicate asset IDs, missing manifests, invalid license fields, missing anchors, missing required states, unexpected dimensions, atlas hard-budget violations, missing sources and broken Phaser loads.

Subjective visual review remains human.

---

## 31. Art Lab

Create a dedicated route/scene:

\`\`\`text
/art-lab
\`\`\`

It should be independent of normal gameplay.

Required panels/scenes:

- camera calibration;
- tile calibration;
- terrain gallery;
- building states;
- character gallery;
- animation gallery;
- VFX;
- UI components;
- palette test;
- lighting test;
- dense-scene test.

Art Lab is used by art, engineering, QA, contributors and screenshot regression.

---

## 32. Golden-scene visual regression

Candidate golden scenes:

\`\`\`text
golden_small_residential
golden_dense_commercial
golden_industrial
golden_construction
golden_crowd
golden_ui_economy
golden_ui_politics
\`\`\`

Fix browser, OS/container, viewport, DPR, seed, camera, zoom and asset version.

DOM screenshots can use tighter tolerances than WebGL screenshots.

---

## 33. Performance budgets — BASELINE

Initial Vertical Slice targets:

| Metric | Target | Warning | Review/Fail |
|---|---:|---:|---:|
| atlas page | 2048² | 4096² exceptional | >4096 |
| world texture resident | <=96 MiB | 96–128 MiB | >128 MiB |
| total texture resident | <=128 MiB | 128–192 MiB | >192 MiB |
| visible atlas pages | <=6 | 7–10 | >10 |
| draw calls normal frame | <=150 | 150–250 | >250 |
| frame target | 60 FPS | 45–60 | <45 |
| frame budget | 16.67 ms | 16.67–22 ms | >22 ms |
| critical initial art download | <=20 MB | 20–30 MB | >30 MB |
| oversized runtime file | <=4 MB ideal | 4–8 MB | review |

These are project planning targets, not universal engine limits.

They must be measured in representative scenes before ratification.

---

## 34. Visual QA matrix

Each relevant asset is evaluated at:

\`\`\`text
50%
75%
100%
150%
200%
\`\`\`

Questions:

- Is category recognizable?
- Is it distinguishable from neighbors?
- Is construction distinct from complete?
- Is damage visible?
- Is ownership visible?
- Is selection visible?
- Are characters still readable?
- Do VFX hide interaction?
- Does the asset work on multiple terrain backgrounds?

---

## 35. Accessibility QA

Test representative scenes in normal vision, protanopia simulation, deuteranopia simulation, tritanopia simulation, grayscale and high contrast.

Ownership and policy states cannot rely on hue alone.

---

## 36. Localization QA

CI should eventually exercise:

\`\`\`text
EN
ES
pseudo-expanded
pseudo-accented
RTL test
\`\`\`

No fixed-width image-based operational text.

---

## 37. Asset maturity states

\`\`\`text
PLACEHOLDER
    ↓
BLOCKOUT
    ↓
STYLE CHECK
    ↓
GAMEPLAY APPROVED
    ↓
PRODUCTION MODEL
    ↓
MATERIAL
    ↓
RENDER
    ↓
ENGINE CHECK
    ↓
POLISH
    ↓
FINAL
\`\`\`

Rule:

> **Do not polish an asset whose gameplay footprint or function can still change.**

---

## 38. Definition of Done — building

### ART

- respects Art Bible;
- silhouette readable;
- approved scale;
- approved materials;
- official lighting rig;
- no third-party IP contamination.

### SOURCE

- clean \`.blend\`;
- naming valid;
- correct origin;
- \`ANCHOR_ROOT\` present;
- footprint defined;
- transforms sane;
- shared materials reused where appropriate.

### RENDER

- official camera;
- transparent background;
- approved master size;
- clean alpha;
- required states;
- required orientations only.

### PIPELINE

- valid metadata;
- provenance;
- author;
- license;
- atlas group;
- tags;
- headless render reproducible.

### ENGINE

- loads in Phaser;
- correct pivot;
- correct depth;
- correct selection;
- correct placement;
- save/load independent from visual file details.

### PERFORMANCE

- atlas within budget;
- runtime size reviewed;
- no unnecessary texture switching;
- tested in dense scene.

### QA

- golden screenshot;
- visual diff reviewed;
- readable at far zoom;
- tested on multiple backgrounds.

---

## 39. Open-source contribution workflow

A contributor should be able to:

1. read Art Bible;
2. obtain required source tooling;
3. start from an approved template;
4. create or modify source;
5. declare provenance/license;
6. run local validation;
7. generate preview/runtime output;
8. open PR;
9. receive automated checks;
10. receive human art review.

The official packer may run in CI if licensing/tool access would otherwise block external contributors.

---

## 40. Modding future

The pipeline should avoid choices that make future data-driven modding impossible.

Useful separation:

- asset ID;
- visual files;
- footprint;
- states;
- category;
- gameplay definition;
- localization;
- animation metadata.

Do not expose the full source-art pipeline as a modding requirement.

Mods should eventually be able to consume documented runtime asset formats without needing the project's complete internal DCC stack.

---

## 41. Rollout plan

### Gate 1

No mass art production.

Only placeholders, calibration aids and technical visualization.

### Gate 2

Run Visual Direction Spike in parallel with gameplay validation.

Deliver:

- 2–3 directions;
- one end-to-end asset pipeline proof;
- Art Lab skeleton;
- preliminary manifests.

### Vertical Slice

Freeze production rules and create representative terrain/roads, core buildings, characters, VFX, UI, audio, golden scenes and art CI.

### Alpha

Scale content production and variation; optimize district identity, character archetypes, accessibility and localization coverage.

### Beta

Focus on performance, download size, visual defects, compatibility, final provenance/license audit and content consistency.

---

## 42. Decisions to freeze after Visual Direction Spike

The spike should produce explicit accept/reject decisions for:

- exact Blender version;
- EEVEE production baseline;
- camera transform;
- 2:1 projection;
- reference tile size;
- physical cell scale;
- master render scale;
- lighting rig;
- character direction count;
- animation FPS/frame budgets;
- atlas size;
- runtime image baseline;
- packer;
- Git LFS policy;
- Art Lab regression environment;
- initial texture/download budgets.

If a decision materially changes architecture or long-term compatibility, record it as an ADR or equivalent accepted decision.

---

## 43. Definition of pipeline success

A new contributor should be able to take an approved template, create a conforming asset, run documented commands and produce an output that:

- renders consistently;
- has correct scale;
- has a deterministic ID;
- has a correct anchor;
- has valid footprint metadata;
- packs into the expected atlas family;
- loads correctly in Phaser;
- passes automated validation;
- can be visually reviewed in Art Lab;
- carries clear author/license/provenance.

The Art Pipeline Specification defines **how Landlord art becomes software-ready content**.
