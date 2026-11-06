#!/usr/bin/env node
/**
 * V.h visual integration remediation, aligned with branch HEAD after V.h.12.
 * Idempotent and fail-closed: a changed source marker aborts before any commit.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_HEAD = "5c305e1892d7669e52c8c61d155b2efa21876e45";

const abs = (path) => join(ROOT, path);
const read = (path) => readFileSync(abs(path), "utf8");
const write = (path, content) => {
  const target = abs(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
};
const copy = (source, destination) => {
  const src = abs(source);
  if (!existsSync(src)) throw new Error(`[vh-remediation-v2] falta ${source}`);
  const dst = abs(destination);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
};
const replaceExact = (content, before, after, label) => {
  if (content.includes(after)) return content;
  if (!content.includes(before)) throw new Error(`[vh-remediation-v2] falta ${label}`);
  return content.replace(before, after);
};
const replaceRange = (content, startMarker, endMarker, replacement, label) => {
  if (content.includes(replacement.trim())) return content;
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`[vh-remediation-v2] no se pudo reemplazar ${label}`);
  }
  return `${content.slice(0, start)}${replacement}\n\n${content.slice(end)}`;
};

// ---------------------------------------------------------------------------
// Curated runtime assets. The raw Blender manifest remains historical evidence;
// gameplay receives a filtered+overridden view.
// ---------------------------------------------------------------------------
const overrides = {
  schemaVersion: 1,
  purpose:
    "Curated Composer assets promoted over the raw Blender bundle; legacy early-phase buildings are excluded from gameplay.",
  buildings: {
    courtyard_home: {
      type: "courtyard_home",
      name: "Casa con patio V.g",
      footprint: { width: 2, height: 2 },
      domainFootprint: { width: 2, height: 2 },
      pivot: { x: 0.6692, y: 0.6465 },
      states: {
        complete: {
          src: "/assets/runtime/blender/courtyard_home-vg-complete.png",
          width: 260,
          height: 320,
          sha256: "31ff308d8a06da59cf5935c07737aaeab70d51536fb75ce62c91409461038de3",
        },
      },
      stateFallback: "procedural",
      pixelsPerMeter: 30.1,
      provenance: {
        license: "CC0-1.0",
        author: "Landlord Building Composer",
        sourceId: "building_composer:vg_courtyard_home_1002",
        notes: "Candidato doméstico curado; estados ausentes vuelven al procedural semántico.",
      },
      allowedOrientations: [45],
      symmetry: "none",
    },
    town_hall: {
      type: "town_hall",
      name: "Ayuntamiento cívico con cubierta inclinada",
      footprint: { width: 4, height: 3 },
      domainFootprint: { width: 8, height: 4 },
      pivot: { x: 0.4612, y: 0.8324 },
      states: {
        complete: {
          src: "/assets/runtime/blender/town_hall-roofed-complete.png",
          width: 554,
          height: 762,
          sha256: "f3d000694d7fe86a7d4cc32bb03d9c415492628ffe1bce9efa9058a5052224de",
        },
      },
      stateFallback: "procedural",
      pixelsPerMeter: 30.1,
      provenance: {
        license: "CC0-1.0",
        author: "Landlord Building Composer",
        sourceId: "building_composer:vf_town_hall_1000_roofed",
        notes: "Variante con gable_dormers restaurada tras la regresión de cubierta plana V7.",
      },
      allowedOrientations: [45],
      symmetry: "none",
    },
  },
  legacyGameplayExclusions: [
    "bld_shopfront",
    "bld_commercial_b",
    "bld_commercial_c",
    "bld_residential_a",
    "bld_residential_b",
    "bld_residential_c",
  ],
};
write(
  "apps/web/src/generated/runtime-visual-overrides.json",
  JSON.stringify(overrides, null, 2),
);
copy(
  "docs/art/building-catalog-vg/candidates/vg_courtyard_home_1002.png",
  "apps/web/public/assets/runtime/blender/courtyard_home-vg-complete.png",
);
copy(
  "docs/art/building-catalog-vg/town-hall-spike-v2/vf_town_hall_1000.png",
  "apps/web/public/assets/runtime/blender/town_hall-roofed-complete.png",
);

write(
  "apps/web/src/assets/runtime-assets.ts",
  `import { parseRuntimeAssetManifest, validateRuntimeAssetManifestV2 } from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";
import runtimeVisualOverrides from "../generated/runtime-visual-overrides.json";

export const PROCEDURAL_ASSETS = parseRuntimeAssetManifest(runtimeAssets);
const RAW_BLENDER_ASSETS = parseRuntimeAssetManifest(runtimeAssetsBlender);
const LEGACY_GAMEPLAY_EXCLUSIONS = new Set(runtimeVisualOverrides.legacyGameplayExclusions);

/**
 * The raw bundle remains available as generated evidence, but gameplay never consumes the early
 * residential/commercial placeholders. Only reviewed Composer overrides are merged back.
 */
export const BLENDER_ASSETS = {
  ...RAW_BLENDER_ASSETS,
  buildings: {
    ...Object.fromEntries(
      Object.entries(RAW_BLENDER_ASSETS.buildings).filter(
        ([assetId]) => !LEGACY_GAMEPLAY_EXCLUSIONS.has(assetId),
      ),
    ),
    ...runtimeVisualOverrides.buildings,
  },
} as unknown as typeof RAW_BLENDER_ASSETS;

const blenderIssues = validateRuntimeAssetManifestV2(BLENDER_ASSETS);
if (blenderIssues.length > 0) {
  throw new Error(
    \`El bundle Blender curado no cumple RuntimeAssetManifestV2: \${blenderIssues.join(" | ")}\`,
  );
}
`,
);

write(
  "blender_artist/manifests/runtime-promotions.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      purpose:
        "Composer candidates visually reviewed and promoted to gameplay; early archetypes stay historical only.",
      approvedAgainstHead: AUDIT_HEAD,
      promotions: [
        {
          assetId: "courtyard_home",
          candidateId: "vg_courtyard_home_1002",
          candidateMetadata:
            "docs/art/building-catalog-vg/candidates/vg_courtyard_home_1002.json",
          candidateImage:
            "docs/art/building-catalog-vg/candidates/vg_courtyard_home_1002.png",
          runtimeImage:
            "apps/web/public/assets/runtime/blender/courtyard_home-vg-complete.png",
          compositionSignature:
            "f28b15c80c4ce3cbbf0fa0180aa49d4e54d11fff5a36442910d7f24c22222f90",
          imageSha256:
            "31ff308d8a06da59cf5935c07737aaeab70d51536fb75ce62c91409461038de3",
          footprint: { width: 2, height: 2 },
          domainFootprint: { width: 2, height: 2 },
          state: "complete",
          stateFallback: "procedural",
        },
        {
          assetId: "town_hall",
          candidateId: "vf_town_hall_1000",
          candidateMetadata:
            "docs/art/building-catalog-vg/town-hall-spike-v2/vf_town_hall_1000.json",
          candidateImage:
            "docs/art/building-catalog-vg/town-hall-spike-v2/vf_town_hall_1000.png",
          runtimeImage:
            "apps/web/public/assets/runtime/blender/town_hall-roofed-complete.png",
          compositionSignature:
            "3d5c31ed1ea5a0565fe0ac45c69e10a7de870df96f21535661a6221387f87dda",
          imageSha256:
            "f3d000694d7fe86a7d4cc32bb03d9c415492628ffe1bce9efa9058a5052224de",
          footprint: { width: 4, height: 3 },
          domainFootprint: { width: 8, height: 4 },
          state: "complete",
          stateFallback: "procedural",
        },
      ],
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// Exact BuildingType policy. No cross-family Blender substitution.
// ---------------------------------------------------------------------------
const adapterPath = "apps/web/src/isometric/gameplay-visual-adapter.ts";
let adapter = read(adapterPath);
adapter = replaceRange(
  adapter,
  "/**\n * Archetypes residenciales compatibles",
  "/** Especies de árbol",
  `/**
 * Explicit temporary policy for all fifteen domain types. A missing reviewed Blender asset falls
 * back to the exact procedural type; it is never disguised as an unrelated old house or shop.
 */
export type BuildingVisualPolicy =
  | { mode: "runtime_exact"; assetId: string }
  | { mode: "runtime_compatible"; archetypes: readonly string[] }
  | { mode: "procedural_semantic_fallback"; assetId: BuildingType };

export const BUILDING_VISUAL_POLICIES: Record<BuildingType, BuildingVisualPolicy> = {
  courtyard_home: { mode: "runtime_exact", assetId: "courtyard_home" },
  row_house: { mode: "procedural_semantic_fallback", assetId: "row_house" },
  apartment_block: { mode: "procedural_semantic_fallback", assetId: "apartment_block" },
  mixed_tenement: { mode: "procedural_semantic_fallback", assetId: "mixed_tenement" },
  workshop: { mode: "procedural_semantic_fallback", assetId: "workshop" },
  warehouse: { mode: "procedural_semantic_fallback", assetId: "warehouse" },
  cement_plant: { mode: "procedural_semantic_fallback", assetId: "cement_plant" },
  brickworks: { mode: "procedural_semantic_fallback", assetId: "brickworks" },
  steelworks: { mode: "procedural_semantic_fallback", assetId: "steelworks" },
  town_hall: { mode: "runtime_exact", assetId: "town_hall" },
  school_block: { mode: "procedural_semantic_fallback", assetId: "school_block" },
  clinic: { mode: "procedural_semantic_fallback", assetId: "clinic" },
  police_station: { mode: "procedural_semantic_fallback", assetId: "police_station" },
  fire_station: { mode: "procedural_semantic_fallback", assetId: "fire_station" },
  market_hall: { mode: "procedural_semantic_fallback", assetId: "market_hall" },
};`,
  "BuildingVisualPolicy",
);
adapter = replaceExact(
  adapter,
  "  azimuth: 45 | 225;",
  "  azimuth: 45 | 135 | 225 | 315;",
  "tipo de azimut de vehículo",
);
if (!adapter.includes("export function vehicleAzimuthForRoad")) {
  const marker = "/** Vehículos aparcados estáticos: sólo rectas";
  const index = adapter.indexOf(marker);
  if (index < 0) throw new Error("[vh-remediation-v2] falta marcador de vehículos");
  const helper = `/** Eje visual de vehículo paralelo a la carretera, en ambos sentidos. */
export function vehicleAzimuthForRoad(
  orientation: "straight_ns" | "straight_ew",
  reverse: boolean,
): 45 | 135 | 225 | 315 {
  if (orientation === "straight_ns") return reverse ? 315 : 135;
  return reverse ? 225 : 45;
}

`;
  adapter = `${adapter.slice(0, index)}${helper}${adapter.slice(index)}`;
}
adapter = replaceExact(
  adapter,
  '    const azimuth: 45 | 225 = road.orientation === "straight_ns" ? 45 : 225;',
  `    const reverseDirection = spatialHash(road.cell.x, road.cell.y, 0x17b3) % 2 === 1;
    const azimuth = vehicleAzimuthForRoad(road.orientation, reverseDirection);`,
  "azimut de vehículos aparcados",
);
adapter = replaceExact(
  adapter,
  '      const azimuth: 45 | 225 = curb.road.orientation === "straight_ns" ? 45 : 225;',
  `      const reverseDirection = spatialHash(anchor.x, anchor.y, 0x31d5 + i * 0x53) % 2 === 1;
      const azimuth = vehicleAzimuthForRoad(curb.road.orientation, reverseDirection);`,
  "azimut de vehículos contextuales",
);
write(adapterPath, adapter);

// ---------------------------------------------------------------------------
// Physical presentation scale and screen rotation for unbaked vehicle axes.
// ---------------------------------------------------------------------------
write(
  "apps/web/src/isometric/visual-scale.ts",
  `/** Physical presentation contracts introduced by V.h visual remediation. */
export const CHARACTER_SOURCE_FRAME_PIXELS = 256;
export const CHARACTER_TARGET_HEIGHT_PIXELS = 28;
export const CHARACTER_RENDER_SCALE =
  CHARACTER_TARGET_HEIGHT_PIXELS / CHARACTER_SOURCE_FRAME_PIXELS;

export function vehicleScreenRotation(azimuth: 45 | 135 | 225 | 315): number {
  if (azimuth === 135) return Math.PI / 2;
  if (azimuth === 315) return -Math.PI / 2;
  return 0;
}
`,
);
let scene = read("apps/web/src/isometric/IsometricSpikeScene.ts");
scene = replaceExact(
  scene,
  'import Phaser from "phaser";',
  'import Phaser from "phaser";\nimport { CHARACTER_RENDER_SCALE, vehicleScreenRotation } from "./visual-scale";',
  "import visual-scale",
);
scene = replaceExact(
  scene,
  `.setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));`,
  `.setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setRotation(vehicleScreenRotation(vehicle.azimuth))
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));`,
  "rotación de vehículo",
);
scene = replaceExact(
  scene,
  ".setScale(0.75)",
  ".setScale(CHARACTER_RENDER_SCALE)",
  "escala humana",
);
write("apps/web/src/isometric/IsometricSpikeScene.ts", scene);

// ---------------------------------------------------------------------------
// Capture correctness and duplicated cwd evidence.
// ---------------------------------------------------------------------------
let capture = read("scripts/vh-world-visual-capture.mjs");
capture = replaceExact(
  capture,
  '    "Corredor Ferroviario": "industrial",',
  '    "Ensanche Ferroviario Oeste": "industrial",',
  "distrito industrial de captura",
);
write("scripts/vh-world-visual-capture.mjs", capture);
rmSync(abs("apps/web/docs/art/world-visual-foundation"), { recursive: true, force: true });

// ---------------------------------------------------------------------------
// Regression tests: semantic catalog, scale, orientation and V2 validity.
// ---------------------------------------------------------------------------
write(
  "apps/web/src/isometric/visual-remediation.test.ts",
  `import { describe, expect, it } from "vitest";
import type { BuildingType } from "@landlord/shared";
import { validateRuntimeAssetManifestV2 } from "@landlord/shared";
import { BLENDER_ASSETS } from "../assets/runtime-assets";
import {
  BUILDING_VISUAL_POLICIES,
  vehicleAzimuthForRoad,
  visualArchetypeForBuilding,
} from "./gameplay-visual-adapter";
import {
  CHARACTER_RENDER_SCALE,
  CHARACTER_SOURCE_FRAME_PIXELS,
  CHARACTER_TARGET_HEIGHT_PIXELS,
  vehicleScreenRotation,
} from "./visual-scale";

const TYPES: readonly BuildingType[] = [
  "courtyard_home", "row_house", "apartment_block", "mixed_tenement", "workshop",
  "warehouse", "cement_plant", "brickworks", "steelworks", "town_hall", "school_block",
  "clinic", "police_station", "fire_station", "market_hall",
];
const LEGACY = [
  "bld_shopfront", "bld_commercial_b", "bld_commercial_c",
  "bld_residential_a", "bld_residential_b", "bld_residential_c",
];

describe("V.h visual remediation", () => {
  it("publishes a valid curated RuntimeAssetManifestV2", () => {
    expect(validateRuntimeAssetManifestV2(BLENDER_ASSETS)).toEqual([]);
  });

  it("excludes every early-phase building from gameplay", () => {
    for (const id of LEGACY) expect(BLENDER_ASSETS.buildings[id]).toBeUndefined();
  });

  it("uses reviewed Composer assets only for courtyard_home and town_hall", () => {
    for (const type of TYPES) {
      const policy = BUILDING_VISUAL_POLICIES[type];
      const visual = visualArchetypeForBuilding(type, `building:${type}`);
      if (type === "courtyard_home" || type === "town_hall") {
        expect(policy.mode).toBe("runtime_exact");
        expect(BLENDER_ASSETS.buildings[visual]).toBeTruthy();
      } else {
        expect(policy).toEqual({ mode: "procedural_semantic_fallback", assetId: type });
        expect(visual).toBe(type);
      }
    }
  });

  it("maps both road axes and directions", () => {
    expect(vehicleAzimuthForRoad("straight_ew", false)).toBe(45);
    expect(vehicleAzimuthForRoad("straight_ew", true)).toBe(225);
    expect(vehicleAzimuthForRoad("straight_ns", false)).toBe(135);
    expect(vehicleAzimuthForRoad("straight_ns", true)).toBe(315);
    expect(vehicleScreenRotation(45)).toBe(0);
    expect(vehicleScreenRotation(225)).toBe(0);
    expect(Math.abs(vehicleScreenRotation(135))).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(vehicleScreenRotation(315))).toBeCloseTo(Math.PI / 2);
  });

  it("keeps a 256px Rocketbox frame in a 22-32px urban-height envelope", () => {
    expect(CHARACTER_RENDER_SCALE).toBeCloseTo(0.109375);
    expect(CHARACTER_SOURCE_FRAME_PIXELS * CHARACTER_RENDER_SCALE).toBe(
      CHARACTER_TARGET_HEIGHT_PIXELS,
    );
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeGreaterThanOrEqual(22);
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeLessThanOrEqual(32);
  });

  it("restores the roofed town hall without manufacturing missing states", () => {
    const hall = BLENDER_ASSETS.buildings.town_hall!;
    expect(hall.states.complete.src).toContain("town_hall-roofed-complete.png");
    expect(hall.stateFallback).toBe("procedural");
    expect(hall.states.construction).toBeUndefined();
    expect(hall.states.damaged).toBeUndefined();
    expect(hall.states.burning).toBeUndefined();
  });
});
`,
);

console.log(
  JSON.stringify({
    status: "visual-remediation-v2-applied",
    promoted: ["courtyard_home", "town_hall"],
    exactProceduralFallbacks: 13,
    legacyExcluded: 6,
    actorHeightPx: 28,
    vehicleAxes: 4,
  }),
);
