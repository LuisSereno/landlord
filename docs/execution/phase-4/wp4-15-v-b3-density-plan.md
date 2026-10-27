# V.b3 Density Expansion Plan

## Current State (V.b2)
- **Buildings:** 27 (4 rows × 6-7 buildings)
- **Zone:** 12-48 (37×37 cells)
- **Streets:** 2 horizontal (y=18, y=30), 2 vertical (x=30, x=42)
- **Trees:** 9
- **Props:** 20 (street lights, traffic lights, benches, trash cans, construction)
- **Vehicles:** 7
- **Characters:** 4

## V.b3 Target
- **Buildings:** 60-80 (3-4 complete blocks equivalent)
- **Zone:** 4-56 (53×53 cells) — expanded ~44%
- **Streets:** 4 horizontal (y=6, y=18, y=30, y=42), 4 vertical (x=18, x=30, x=42, x=54)
- **Hierarchy:**
  - Primary frontage: avenues x=30, x=42 (commercial, high density)
  - Secondary streets: y=18, y=30 (residential + commercial mix)
  - Tertiary: y=6, y=42, x=18, x=54 (residential, smaller buildings)
  - Open areas: parks, vacant lots, construction zones
- **Trees:** 20-25 (parks, street alignments, gardens)
- **Props:** 30-35 (scaled to where they make sense)
- **Vehicles:** 10-12
- **Characters:** 6-8

## Distribution Strategy

### Deterministic Seed
- Use fixed seed `0x4c5544` (same as ground dressing) for building placement
- PRNG: additive-increment with xorshift-multiply finalization
- Same seed always produces same layout

### Building Placement Rules
1. **Primary frontage (avenues x=30, x=42):**
   - Commercial buildings (shopfront, commercial_b, commercial_c)
   - Continuous facade, minimal gaps
   - Both sides of avenue

2. **Secondary streets (y=18, y=30):**
   - Mix of residential and commercial
   - Variable spacing (3-4 cells between buildings)
   - Some gaps for parks/vacant lots

3. **Tertiary streets (y=6, y=42, x=18, x=54):**
   - Primarily residential (residential_a, residential_b, residential_c)
   - Smaller buildings, more vegetation
   - Larger gaps between buildings

4. **Second/third row:**
   - Buildings behind primary frontage
   - Offset 3-4 cells from street
   - Creates depth and skyline

### Repetition Control
- Alternate building types: A B C A B C → A B C B A C B A (avoid obvious patterns)
- Use flipX for horizontal mirroring (50% probability based on hash)
- Variable block sizes: 2-4 buildings per block
- Small gaps (1-2 cells) between some buildings
- Parks and vacant lots break up density

### Skyline Strategy
1. **Composition first:**
   - Compact masses
   - Second row buildings
   - Grouping at intersections
   - Commercial buildings at key points

2. **Quaternius test (A/B):**
   - Test `bld_downtown_quaternius` as urban landmark
   - Place at prominent intersection (e.g., x=30, y=30)
   - Apply same style layer, lighting, shadows, scale, camera
   - Classify: ACCEPT if cohesive, REJECT if geometry/texture clashes

## Terrain Extension

### Road Network
- Extend existing roads to new zone bounds (4-56)
- Add new streets: y=6, y=42, x=18, x=54
- Maintain intersection logic

### Parcels
- Extend ground planner to new zone
- Maintain LOT_RADIUS=3 for implicit parcels
- Add new open spaces:
  - Park north: (8,8)-(15,15)
  - Park south: (40,40)-(48,48)
  - Vacant lots: scattered
  - Construction: keep existing WORKS_LOT

### Vegetation
- Tree clusters in parks
- Street alignments along tertiary streets
- Garden trees behind residential buildings
- Avoid homogeneous distribution

### Props
- Street lights along primary/secondary streets only
- Traffic lights at new intersections
- Benches in parks
- Trash cans near commercial buildings
- Do NOT multiply proportionally

## Performance Targets
- Object count: <150 total (buildings + props + vehicles + characters)
- FPS: stable 60fps at zoom 1.0
- No premature optimization, but avoid composition that destroys performance

## Evidence Required
1. BEFORE V.b3 zoom 0.5 (current state)
2. AFTER V.b3 zoom 0.5 (expanded density)
3. Final at zoom 0.5, 1.0, 2.0, 2.5
4. Skyline A/B: Kenney only vs Kenney + Quaternius
5. FPS and object count metrics

## Classification
- **DENSITY = PASS:** Zoom 0.5 reads as urban district, zoom 1-2.5 maintains legibility
- **DENSITY = CONDITIONAL PASS:** Mass works but composition issues remain
- **DENSITY = FAIL:** Current assets cannot produce convincing urban mass

- **QUATERNIUS = ACCEPT:** Cohesive with style layer, functions as landmark
- **QUATERNIUS = REJECT:** Geometry/texture clashes even after style layer
