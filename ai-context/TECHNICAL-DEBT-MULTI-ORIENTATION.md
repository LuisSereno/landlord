# Technical Debt — Multi-Orientation Assets

**Created:** 2026-10-27  
**Phase:** WP4.15-V (Visual Quality Recovery)  
**Priority:** Medium (visual polish, not blocking)

---

## Problem Statement

Several props, vehicles and road tiles in the Visual Slice use a single orientation or orientations designed only for horizontal streets. This causes visual inconsistencies when these assets are placed on vertical streets or on different sides of the road, and it forces at least one workaround (`flipX` on vertical avenues) that contradicts the baked-lighting policy below.

---

## Issue 1: Vehicles on Vertical Streets

### Current State

Vehicles have only 2 orientations available:
- **Default** (no azimuth): Car facing southwest
- **Azimuth 225**: Car facing southeast

These orientations work correctly for **horizontal streets** (east-west axis), but vehicles on **vertical avenues** (north-south axis) appear "crossed" — they use orientations designed for the wrong axis.

### Evidence

- File: `apps/web/src/visual-slice/layout.ts:308-309`
- Vehicles at `{ x: 30, y: 24 }` and `{ x: 30, y: 37 }` (avenue x=30) use default/225 orientations
- Visual result: Cars appear perpendicular to the road direction instead of parallel

### Required Solution

Render additional orientations from Blender:
- **Azimuth 135**: For vehicles traveling north
- **Azimuth 315**: For vehicles traveling south

### Assignment Logic

```typescript
// Horizontal streets (y=constant): use 45/225 or default/225
// Vertical avenues (x=constant): use 135/315

const VEHICLES: SliceVehicle[] = [
  // Horizontal street, traveling east
  { asset: "veh_sedan", cell: { x: 21, y: 30 }, azimuth: 45 },
  // Horizontal street, traveling west
  { asset: "veh_sedan", cell: { x: 35, y: 30 }, azimuth: 225 },
  // Vertical avenue, traveling north
  { asset: "veh_sedan", cell: { x: 30, y: 24 }, azimuth: 135 },
  // Vertical avenue, traveling south
  { asset: "veh_sedan", cell: { x: 30, y: 37 }, azimuth: 315 },
];
```

---

## Issue 2: Street Lights with Fixed Orientation

### Current State

`prp_street_light` has only **one orientation** (arm pointing in a fixed direction). All street lights in the scene have the arm pointing the same way, regardless of whether they're on the north, south, east, or west side of the road.

### Evidence

- File: `apps/web/src/visual-slice/layout.ts:248-257`
- 11 street lights placed at various positions
- All use the same sprite with arm pointing in one direction
- Visual result: Some lights have arms pointing away from the road (incorrect)

### Required Solution

Render 4 orientations from Blender:
- **Azimuth 45**: Arm pointing northeast
- **Azimuth 135**: Arm pointing northwest
- **Azimuth 225**: Arm pointing southwest
- **Azimuth 315**: Arm pointing southeast

### Assignment Logic

```typescript
// Street lights should have arms pointing toward the road
// For horizontal streets (y=constant):
//   - North side (y-1): azimuth 225 or 315 (arm pointing south)
//   - South side (y+1): azimuth 45 or 135 (arm pointing north)
// For vertical avenues (x=constant):
//   - West side (x-1): azimuth 45 or 315 (arm pointing east)
//   - East side (x+1): azimuth 135 or 225 (arm pointing west)

const PROPS: SliceProp[] = [
  // Horizontal street y=30, north side (y=29), arm pointing south
  { asset: "prp_street_light", cell: { x: 19, y: 29 }, azimuth: 225, scale: 1.8 },
  // Horizontal street y=30, south side (y=31), arm pointing north
  { asset: "prp_street_light", cell: { x: 19, y: 31 }, azimuth: 135, scale: 1.8 },
  // Vertical avenue x=30, west side (x=29), arm pointing east
  { asset: "prp_street_light", cell: { x: 29, y: 22 }, azimuth: 45, scale: 1.8 },
  // Vertical avenue x=30, east side (x=31), arm pointing west
  { asset: "prp_street_light", cell: { x: 31, y: 22 }, azimuth: 135, scale: 1.8 },
];
```

---

## Issue 3: Road Tiles Without Orientation Metadata

**Añadido el 2026-10-27 en WP4.15-V.c.2A (D-085).**

### Current State

El catálogo vial del manifiesto (`apps/web/src/generated/runtime-assets-blender.json:433-505`) tiene tres
assets — `ter_road_straight`, `ter_road_corner`, `ter_road_intersection` — todos 1×1, con
`pixelsPerMeter` 42,667 y **sin ningún metadato de orientación** (`orientations`/`azimuth`), a diferencia
de props y vehículos. `ter_road_corner` no se usa en ninguna parte del layout.

Las avenidas verticales se dibujan hoy con `ter_road_straight` + **`flipX: true`**
(`apps/web/src/visual-slice/layout.ts:116`), introducido en `685a352` para alinear bordillo y línea
central. Eso **viola la política de este documento**: la iluminación y las sombras van horneadas, así que
espejar la textura invierte la dirección de la luz en esas celdas.

### Required geometries for an arbitrary orthogonal network

Medido sobre la red que produciría el contrato V.c.2A (451 celdas de media en 24 distritos reales):

| Geometría | Orientaciones necesarias | Arte actual | Peso medido |
|---|---|---|---|
| Recta E–W | 1 | existe | 32,7 % |
| Recta N–S | 1 | **no existe sin flipX** | 35,7 % |
| Esquina | 4 | asset sin variantes, sin uso | ~1 % |
| T-junction | 4 | **no existe** | ~2 % |
| Cruz | 1 | existe | ~3,5 % |
| Tope de callejón | 4 | no existe | ~6 % (hoy se cierra con acera) |

Ninguna de estas geometrías se produce en V.c.2A/V.c.2B. La orientación es derivable desde la proyección
(patrones de vecinos de calzada), así que el contrato no bloquea el trabajo de arte: lo deja para cuando
el render de calzadas (V.c.2C) realmente lo necesite.

---

## Why Not Use flipX?

Both vehicles and street lights have **baked lighting** from the Blender rig:
- Light direction: [9, 16, 10]
- Shadow direction: 240.6° (southwest)

Using `flipX` would mirror the baked shadows, creating **physically contradictory illumination** across the scene. This violates the Graphic Civic style guide established in WP4.15-V.b2.

**Policy:** Sprites with baked lighting must not use flipX. Multi-orientation assets must be rendered from Blender at the correct camera angles.

---

## Implementation Plan (Future WP)

### Step 1: Extend Blender Pipeline

Modify `build-blender-assets.mjs` to render each asset at multiple azimuths:
- Vehicles: 4 orientations (45, 135, 225, 315)
- Street lights: 4 orientations (45, 135, 225, 315)

### Step 2: Update Asset Manifest

Regenerate `runtime-assets-blender.json` with orientation data:
```json
{
  "veh_sedan": {
    "orientations": {
      "45": { "image": { "src": "/assets/runtime/blender/veh_sedan-az45.png", ... }, ... },
      "135": { "image": { "src": "/assets/runtime/blender/veh_sedan-az135.png", ... }, ... },
      "225": { "image": { "src": "/assets/runtime/blender/veh_sedan-az225.png", ... }, ... },
      "315": { "image": { "src": "/assets/runtime/blender/veh_sedan-az315.png", ... }, ... }
    }
  }
}
```

### Step 3: Update Visual Slice Layout

Assign correct azimuths in `layout.ts` based on street orientation and asset position.

### Step 4: Capture Evidence

- BEFORE: Current state with orientation issues
- AFTER: Corrected state with proper orientations
- Contact sheet showing A/B comparison

### Step 5: Update External Visual Golden

Regenerate golden hash with new orientations.

---

## Impact

- **Bundle size:** +4 vehicle orientations × ~15 KB + 4 street light orientations × ~8 KB ≈ **92 KB increase**
- **Current bundle:** 1.51 MiB
- **New bundle:** ~1.60 MiB (still well under 8 MiB limit)
- **Visual quality:** Significant improvement in street realism

---

## Dependencies

- Blender 5.2.2 LTS toolchain
- Kenney City Roads pack (vehicles, street lights)
- Graphic Civic style layer (lighting consistency)

---

## Related Decisions

- [V.b2: Shadow Strategy](./VB2-SHADOW-STRATEGY.md) — Baked lighting direction established
- [V.b3: flipX Removal](./VB3-CLOSURE-CORRECTIONS.md) — Policy against flipX for baked lighting
- [D-085 Road Topology Design](../../docs/execution/phase-4/wp4-15-vc2a-road-topology-design-2026-10-27.md) — Measured junction distribution that sizes the road-tile catalog
- [Graphic Civic Style Guide](../../tools/art-pipeline/blender/style_layer_graphic_civic.json) — Lighting consistency requirements

---

## Status

**Deferred** — Documented for future execution. Not blocking current phase closure.
