# Art Bible — Landlord

> Version: 0.1
>
> Status: preproduction specification.
>
> Purpose: define how Landlord should look, what visual information must be readable in play, and which constraints all world, character, UI and VFX assets must respect.
>
> Governance: this document distinguishes accepted project decisions from provisional art baselines. Any value marked BASELINE must be validated by the Visual Direction Spike before mass production.

---

## 1. Status legend

Every rule in this document belongs to one of these states:

- **DECIDED** — backed by an accepted project decision and treated as current source of truth.
- **BASELINE** — recommended working value for preproduction; must be measured or visually validated before becoming fixed.
- **OPEN** — unresolved; do not make irreversible production choices around it.

When this document conflicts with \`ai-context/DECISIONS.md\`, the newest accepted decision wins.

---

## 2. Product visual objective

### 2.1 North star

> **A living industrial city, attractive but morally ambiguous, presented as a cinematic isometric model where wealth, decline, power and crime can be read before opening a panel.**

Landlord is not trying to reproduce the exact visual language of any existing game. It must be immediately readable as a management game while building an original identity.

### 2.2 Visual goals

The art must make these questions answerable at a glance:

- What kind of district am I looking at?
- Which buildings are residential, commercial, industrial, civic or illicit?
- Which assets are mine, neutral or controlled by a rival?
- Is a building prospering, deteriorating, under construction or abandoned?
- Is an area attractive, unsafe, congested, expensive or politically contested?
- Which characters matter right now?
- Where is the player expected to click next?

### 2.3 Non-goals

Landlord does not target:

- photorealistic urban rendering;
- unrestricted free-camera 3D;
- visual density that requires constant pausing to understand;
- pixel art as the primary visual direction;
- UI styled as a direct recreation of late-1990s strategy games;
- historical reproduction so exact that it limits systemic readability;
- visual spectacle at the cost of simulation clarity.

---

## 3. Visual pillars

### 3.1 Legibility before detail — DECIDED AS PRINCIPLE

A building should be identifiable by silhouette and massing before the player reads signage.

Detail is valuable only when it survives the intended camera distance or reinforces material, class, function or condition.

### 3.2 History without documentary literalism — BASELINE

The working setting is a fictional transatlantic city inspired by approximately 1925–1940.

The goal is to use a recognizable industrial-modern vocabulary:

- brick industry;
- early reinforced concrete;
- stone civic architecture;
- modest Art Deco influence;
- trams and early motor traffic;
- signage and print culture;
- warehouses, row housing, hotels, workshops and municipal buildings.

The city must be fictional. It should evoke an era, not reproduce a real city or franchise.

### 3.3 Material caricature — BASELINE

Forms may be moderately exaggerated, but materials should feel materially credible.

Core material families:

- red/brown brick;
- warm plaster;
- cut stone;
- dark painted steel;
- brass;
- timber;
- asphalt;
- glass;
- soot;
- aged paper and painted signage.

### 3.4 The economy is visible — DESIGN RULE

Economic state must alter the city visually.

Examples:

- prosperity -> cleaner facades, improved signage, better lighting, planted streets;
- low-income pressure -> exposed brick, cheap repairs, clutter, smoke, worn materials;
- vacancy -> boarded openings, dark interiors, faded signs;
- speculative growth -> scaffolding, hoists, active deliveries, partial construction;
- decline -> stains, broken fixtures, patched roofs, debris.

### 3.5 Darkness with humor — TONE RULE

Crime, corruption and inequality can be present without turning the whole presentation into monochrome misery.

Humor may come from animation, timing, signage, exaggerated silhouettes, props and character reactions.

Humor must not depend on copying recognizable characters or visual gags from existing IP.

---

## 4. Reference framework

References are used to extract principles, never to copy execution.

| Reference family | Useful principle | Avoid |
|---|---|---|
| Constructor / Mob Rule | strong silhouettes, readable bitmap isometric scenes, personality | copied buildings, characters, UI, iconography or trade dress |
| Anno 1800 | material richness, modular architecture, class progression visible in the city | full real-time 3D detail budget |
| SimCity 2000/3000/4 | readable urban layers and tile-based structure | retro resolution as an end goal |
| Tropico | political/economic state expressed through buildings and characters | tropical identity |
| Frostpunk | environment and VFX as product identity | darkness that hides economic information |
| Prison Architect / RimWorld | form-before-detail and systemic clarity | over-abstraction of premium assets |
| Two Point | exaggerated forms and readable characters | fully cartoon tone |
| Cities: Skylines | asset modularity, metadata discipline, content ecosystem thinking | photorealistic 3D scope |
| Banished | coherent materials and organic settlement readability | high-cost real-time content scope |

### 4.1 Anti-copy rule — DECIDED

Landlord is an original IP.

Do not recreate or trace:

- franchise buildings;
- characters;
- maps;
- UI layouts;
- icons;
- logos;
- signs;
- music;
- dialogue;
- animation poses;
- color arrangements that function as recognizable trade dress.

Reference images are for comparison and critique only.

---

## 5. Perspective and camera

### 5.1 Representation — DECIDED

The world is represented as **2.5D isometric/dimetric**.

### 5.2 Projection baseline — BASELINE

Proposed camera:

- projection: orthographic;
- azimuth: approximately 45 degrees;
- elevation: approximately 30 degrees over the horizon;
- roll: 0;
- projected logical cell ratio: 2:1.

The exact transform is not yet frozen. It must be calibrated through the Visual Direction Spike.

### 5.3 Grid baseline — BASELINE

Working visual reference:

\`\`\`text
1 logical cell
-> 128 x 64 px projected footprint at reference zoom

master render reference
-> 256 x 128 px equivalent per cell
\`\`\`

This does not constrain full sprite height. Tall buildings may extend several hundred pixels above their footprint.

### 5.4 Rotation — OPEN

Vertical Slice baseline assumes a fixed camera orientation.

Therefore:

- buildings require one canonical view initially;
- character locomotion may still use multiple directional sprites;
- four 90-degree building views are only produced if gameplay later requires building rotation or camera rotation.

Do not pay for four building orientations before that requirement exists.

---

## 6. Scale

### 6.1 Logical versus visual scale

Gameplay scale and visual scale are related but not identical.

The player must believe the city is coherent even when:

- doors are slightly larger than strict architectural scale;
- characters are enlarged for readability;
- road widths are adjusted to support navigation;
- signs are oversized to survive zoom.

### 6.2 Physical baseline — OPEN

Current proposal:

\`\`\`text
1 Blender unit = 1 metre
1 logical cell ~ 4 x 4 metres
\`\`\`

This must be validated against pedestrian scale, vehicle scale, row-house footprint, industrial density and street width.

No artist should manually rescale an asset simply because it looks better in one screenshot.

---

## 7. Shape language

### 7.1 Residential

Lower-income:

- narrower frontage;
- stacked repetition;
- asymmetric repairs;
- visible chimneys and service elements;
- simpler roofs;
- higher prop clutter.

Middle-income:

- stronger facade rhythm;
- more regular windows;
- awnings;
- cleaner masonry;
- restrained ornament.

Higher-income:

- symmetric composition;
- stone or decorated plaster;
- brass;
- larger windows;
- controlled greenery;
- pronounced entrances.

### 7.2 Commercial

Commercial silhouettes should advertise function through massing and frontage.

Examples:

- hotel -> vertical mass + strong entrance/canopy;
- restaurant -> frontage + awnings + signs;
- office -> repetitive vertical window rhythm;
- cinema/theatre -> marquee or dominant frontage volume;
- retail -> transparent or sign-heavy ground floor.

### 7.3 Industrial

Industrial buildings should prioritize long horizontal massing, stacks/vents, loading areas, large doors, tanks/sheds/annexes and visible smoke/steam attachment points.

### 7.4 Civic

Civic buildings should communicate institutional power through symmetry, heavier materials, stairs/plinths, vertical emphasis, controlled ornament and cleaner surroundings.

---

## 8. Materials

### 8.1 Material library principle

Prefer reusable material families to one-off textures.

Proposed shared families:

\`\`\`text
mat_brick_red_01
mat_brick_dirty_01
mat_plaster_warm_01
mat_stone_light_01
mat_steel_painted_01
mat_brass_01
mat_asphalt_01
mat_wood_dark_01
mat_glass_smoked_01
\`\`\`

### 8.2 Material readability

At game scale:

- roughness differences matter more than micro-surface noise;
- window grouping matters more than individual mullions;
- soot patterns matter more than tiny decals;
- hue/value separation matters more than high-frequency texture detail.

---

## 9. Palette

### 9.1 Working tokens — BASELINE

| Token | Value | Intended role |
|---|---:|---|
| \`coal\` | \`#25282A\` | roof, steel, dark neutral |
| \`warm_plaster\` | \`#D6C4A1\` | plaster, light masonry |
| \`brick\` | \`#8C503D\` | residential/industrial brick |
| \`brass\` | \`#B08A50\` | wealth, signage, accents |
| \`petrol\` | \`#315A5E\` | transport/industrial accents |
| \`olive\` | \`#696C52\` | utility/environment accents |
| \`paper\` | \`#E8DFC8\` | documents and UI surfaces |
| \`danger\` | \`#A74339\` | warning/police/loss |

These are art-direction tokens, not a restricted world palette.

### 9.2 Value hierarchy

At reference zoom:

1. interactable entity silhouette;
2. ownership/selection feedback;
3. functional building class;
4. condition/state;
5. surface detail.

A facade texture must never overpower selection or state feedback.

---

## 10. Lighting and weather

### 10.1 Canonical lighting — BASELINE

Proposed production lighting:

- fixed key from visual north-west;
- shadows generally toward visual south-east;
- soft ambient fill;
- slightly warm neutral daylight;
- restrained ambient occlusion;
- no crushed blacks;
- transparent render background.

### 10.2 Day/night — OPEN

A true physically moving sun is not part of the current prerender baseline.

If a night presentation is needed in v1, prefer grading, window/emissive variants, overlays and VFX.

A full solar cycle would require a specific feature decision.

### 10.3 Weather

Weather should add identity and information without hiding gameplay.

Candidates:

- rain;
- fog;
- industrial haze;
- puddles/road sheen;
- smoke direction changes.

---

## 11. Terrain, parcels and roads

### 11.1 Logical separation — DESIGN RULE

Never infer gameplay collision or occupancy from sprite transparency.

\`\`\`text
visual tile != logical cell
\`\`\`

Logical data must define walkability, buildability, road, terrain type, district, occupancy, zoning and ownership.

### 11.2 Terrain baseline

Initial families:

- grass;
- dirt;
- mud;
- asphalt;
- pavement;
- industrial ground;
- water.

### 11.3 Roads

Roads should be modular:

\`\`\`text
base
+ road surface
+ curb
+ markings
+ decals
+ props
\`\`\`

Do not create a unique bitmap for every possible street combination.

---

## 12. Buildings

### 12.1 Building visual states

Minimum candidate states:

\`\`\`text
planned
foundation
construction_50
complete
damaged
\`\`\`

Optional per asset:

\`\`\`text
abandoned
upgraded_1
upgraded_2
\`\`\`

### 12.2 Condition ladder

World-readable condition model:

\`\`\`text
pristine
used
neglected
damaged
abandoned
\`\`\`

Not every level needs a unique mesh. Use combinations of material swaps, decals, broken/removed props, boarded openings, lighting changes, vegetation, smoke/dust and signage.

### 12.3 Silhouette test

A building passes silhouette review if an informed player can distinguish its broad functional class at 50–75% zoom without signage.

### 12.4 Signage

Use signage to reinforce function, never as the only identifier.

Avoid baked localization-sensitive text wherever possible.

---

## 13. Characters

### 13.1 Character style — BASELINE

Moderately stylized proportions.

Objectives:

- readable occupation/archetype;
- strong pose;
- oversized key props where necessary;
- clear facing direction;
- controlled clothing contrast.

### 13.2 Directional baseline — BASELINE

Candidate directions:

\`\`\`text
N  NE  E  SE  S  SW  W  NW
\`\`\`

Do not assume mirroring is safe.

Optional manifest flag:

\`\`\`json
{
  "mirrorSafe": true
}
\`\`\`

### 13.3 Animation budget — BASELINE

| Clip | Frames | FPS | Loop |
|---|---:|---:|---|
| idle | 6–8 | 6 | yes |
| walk | 8 | 10–12 | yes |
| carry | 8 | 10–12 | yes |
| work | 10–16 | 10–12 | yes |
| talk | 6–10 | 8 | yes |
| interact | 8–12 | 10 | no |
| injured | 4–8 | 6 | situational |

These are production budgets, not engine restrictions.

### 13.4 Character modularity

Prefer offline modularity:

\`\`\`text
base rig
+ body preset
+ clothing preset
+ hair preset
+ palette preset
-> batch render
-> final sprite
\`\`\`

Runtime layering should be reserved for carried items, selection, limited accessories, faction markers and temporary status.

---

## 14. Vehicles and moving props

Vehicles must remain readable at mid/far zoom.

Visual priorities:

1. body silhouette;
2. vehicle class;
3. faction/service identity where relevant;
4. condition;
5. fine trim.

Animation should be minimal unless gameplay requires more: rolling, steering/facing changes, exhaust, lights and load/unload effects.

---

## 15. VFX

### 15.1 Priority order

\`\`\`text
1. information
2. feedback
3. atmosphere
4. spectacle
\`\`\`

### 15.2 Sprite VFX candidates

- construction dust;
- smoke;
- sparks;
- steam;
- fire;
- paper/leaves;
- splashes;
- small explosions.

### 15.3 Runtime/procedural feedback

- selection ring;
- placement footprint;
- zoning;
- ownership;
- influence;
- path;
- area mask;
- directional arrows.

Avoid large stacks of transparent particles covering the scene.

---

## 16. Overlays and systemic readability

Core overlay families:

- ownership;
- property value;
- rent;
- zoning;
- accessibility;
- crime/heat;
- political influence;
- service coverage;
- demand;
- pollution/industrial pressure.

Rules:

- overlays must have an off state;
- values should remain interpretable without relying on red/green alone;
- selected entities remain visible over overlays;
- legends remain stable across sessions;
- overlay color families should not conflict with faction ownership colors.

---

## 17. UI visual language

### 17.1 Technology — DECIDED BY ARCHITECTURE

HUD, management panels, tables and complex screens use React/DOM.

World entities remain in the game renderer.

### 17.2 Visual theme — BASELINE

UI should combine:

- paper/document cues;
- brass/metal accents;
- newspaper/print culture;
- modern information hierarchy.

The UI should evoke the setting without becoming a novelty interface.

### 17.3 Typography

Use three roles:

\`\`\`text
display
-> branding, selected headings

ui sans
-> operational text

tabular numeric
-> finance and statistics where useful
\`\`\`

Exact families remain OPEN until licensing and localization review.

### 17.4 Localization rule

Never bake operational text into world or UI bitmaps when DOM/SVG text can be used.

Components must support text expansion, wrapping, pseudo-localization, different number formats and future RTL testing.

---

## 18. Accessibility

Baseline target: WCAG 2.2 AA for DOM UI where applicable.

Art rules:

- do not communicate state only by color;
- ownership combines color with outline/pattern/icon when necessary;
- positive/negative states combine sign, icon and color;
- check scenes under protanopia, deuteranopia, tritanopia and grayscale simulation;
- preserve focus visibility in UI;
- avoid tiny click targets;
- important UI text must remain usable at 200% text zoom.

---

## 19. Zoom and visual LOD

### 19.1 Evaluation zooms

Every representative asset must be reviewed at:

\`\`\`text
50%
75%
100%
150%
200%
\`\`\`

### 19.2 Artistic LOD concept

\`\`\`text
NEAR
- high-resolution sprite
- props visible
- characters animated
- full minor VFX

MID
- same family / mip chain
- fewer minor effects

FAR
- lower-resolution family if needed
- fewer characters
- minor signage/props suppressed

MAP
- district abstraction
- icons / blocks / heatmaps
\`\`\`

This can align with Simulation LOD, but visual and simulation LOD remain separate systems.

---

## 20. Density and readability budget

A scene fails even if individual assets are excellent when:

- silhouettes merge into one mass;
- signs compete with selection;
- VFX obscure roads/parcels;
- characters disappear against terrain;
- ownership is unreadable;
- district class cannot be identified;
- every building uses the same value range.

The Art Lab must include dense scenes, not only isolated turntables.

---

## 21. Audio crossover

Audio is not fully governed by this Art Bible, but audiovisual feedback must be coherent.

Candidate environmental identities:

- poor residential -> repairs, older traffic, dogs, dense ambience;
- industrial -> machinery, steam, impacts;
- wealthy commercial -> cleaner traffic, interior music leakage, commerce;
- high crime -> distant sirens, arguments, breaking glass.

Use priority/concurrency so simulation density does not become audio noise.

---

## 22. Do / Don't

### Do

- identify buildings through silhouette;
- exaggerate features that communicate function;
- show wealth and decline physically;
- reuse material families;
- keep ownership and selection readable;
- use props to create variation;
- test in dense scenes;
- preserve a fictional identity;
- document every deliberate exception.

### Don't

- copy recognizable reference-game assets;
- depend on signs to identify a building;
- add microdetail that disappears at reference zoom;
- let grime reduce contrast everywhere equally;
- use red/green as the only gameplay signal;
- bake localized UI text into images;
- hand-tune per-asset camera perspective;
- polish assets whose gameplay footprint is not approved;
- create four building orientations without a gameplay requirement.

---

## 23. Golden scenes

Target golden scenes:

\`\`\`text
golden_small_residential
golden_dense_commercial
golden_industrial
golden_construction
golden_crowd
golden_ui_economy
golden_ui_politics
\`\`\`

Each golden scene should define seed, camera position, zoom, viewport, DPR, asset build version and expected screenshot.

---

## 24. Visual Direction Spike acceptance

The Art Bible becomes production-ready only after the spike evaluates 2–3 original directions using the same content kit.

Required content:

- residential building;
- industrial/commercial building;
- road/sidewalk/parcel;
- terrain;
- worker;
- civilian;
- vehicle/moving prop;
- props/vegetation;
- construction and damage;
- ownership/selection;
- economic overlay;
- HUD panel;
- icon family;
- one atmospheric VFX.

Decision criteria include readability, originality/IP distance, production cost, web performance, modular variation, perceived quality, contributor friendliness, automation and accessibility.

---

## 25. Open decisions before mass production

The following must remain explicit until validated:

- final visual style;
- exact historical/fictional era;
- camera elevation;
- projected cell dimensions;
- physical cell scale;
- master resolution;
- Blender version;
- renderer choice;
- canonical light rig;
- character direction count;
- animation budgets;
- atlas baseline;
- runtime image format;
- typefaces;
- GPU texture compression;
- weather/night scope.

See [OPEN-DECISIONS.md](OPEN-DECISIONS.md).

---

## 26. Definition of success

The Art Bible succeeds when a new artist can answer, without asking the original creator:

- what Landlord should look like;
- what visual information matters most;
- what is allowed to vary;
- what must remain consistent;
- how to distinguish original inspiration from copying;
- whether an asset is visually ready for production review.

The Art Bible defines **what** to make.

The Art Pipeline Specification defines **how** to make it reproducibly.
