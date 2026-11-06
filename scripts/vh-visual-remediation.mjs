#!/usr/bin/env node
/**
 * V.h visual remediation.
 *
 * This script applies the visual-integration corrections identified in
 * docs/execution/phase-4/vh-world-visual-preliminary-audit-2026-11-06.md.
 * It is intentionally idempotent and fails loudly when the expected source shape changes.
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
const BRANCH_BASE = "5c305e1892d7669e52c8c61d155b2efa21876e45";

function absolute(path) {
  return join(ROOT, path);
}

function read(path) {
  return readFileSync(absolute(path), "utf8");
}

function write(path, content) {
  const target = absolute(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) {
    if (content.includes(after)) return content;
    throw new Error(`[vh-remediation] no se encontró ${label}`);
  }
  return content.replace(before, after);
}

function replaceBetween(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    if (content.includes(replacement.trim())) return content;
    throw new Error(`[vh-remediation] no se pudo reemplazar ${label}`);
  }
  return `${content.slice(0, start)}${replacement}\n\n${content.slice(end)}`;
}

function copy(source, destination) {
  const src = absolute(source);
  const dst = absolute(destination);
  if (!existsSync(src)) throw new Error(`[vh-remediation] falta fuente binaria ${source}`);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

// ---------------------------------------------------------------------------
// 1. Runtime visual bundle: curated Composer assets only; legacy buildings are
// retained in the raw manifest for Art Lab/history but excluded from gameplay.
// ---------------------------------------------------------------------------
write(
  "apps/web/src/generated/runtime-visual-overrides.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      purpose:
        "V.h remediation: curated Building Composer assets promoted over the raw Blender bundle. Legacy early-phase archetypes remain auditable but are excluded from gameplay.",
      buildings: {
        courtyard_home: {
          type: "building",
          id: "courtyard_home",
          states: {
            complete: {
              src: "/assets/runtime/blender/courtyard_home-vg-complete.png",
              width: 260,
              height: 320,
              sha256: "31ff308d8a06da59cf5935c07737aaeab70d51536fb75ce62c91409461038de3",
            },
          },
          footprint: { width: 2, height: 2 },
          domainFootprint: { width: 2, height: 2 },
          pivot: { x: 0.6692, y: 0.6465 },
          allowedOrientations: [45],
          symmetry: "asymmetric",
          pixelsPerMeter: 30.1,
          stateFallback: "procedural",
          provenance: {
            origin: "licensed",
            license: "CC0-1.0",
            sourceId: "building_composer:vg_courtyard_home_1002",
          },
        },
        town_hall: {
          type: "building",
          id: "town_hall",
          states: {
            complete: {
              src: "/assets/runtime/blender/town_hall-roofed-complete.png",
              width: 554,
              height: 762,
              sha256: "f3d000694d7fe86a7d4cc32bb03d9c415492628ffe1bce9efa9058a5052224de",
            },
          },
          footprint: { width: 4, height: 3 },
          domainFootprint: { width: 8, height: 4 },
          pivot: { x: 0.4612, y: 0.8324 },
          allowedOrientations: [45],
          symmetry: "asymmetric",
          pixelsPerMeter: 15.05,
          stateFallback: "procedural",
          provenance: {
            origin: "licensed",
            license: "CC0-1.0",
            sourceId: "building_composer:vf_town_hall_1000_roofed",
          },
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
    },
    null,
    2,
  ),
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
  `import { parseRuntimeAssetManifest } from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";
import runtimeVisualOverrides from "../generated/runtime-visual-overrides.json";

export const PROCEDURAL_ASSETS = parseRuntimeAssetManifest(runtimeAssets);

const RAW_BLENDER_ASSETS = parseRuntimeAssetManifest(runtimeAssetsBlender);
const LEGACY_GAMEPLAY_EXCLUSIONS = new Set(runtimeVisualOverrides.legacyGameplayExclusions);
const filteredBuildings = Object.fromEntries(
  Object.entries(RAW_BLENDER_ASSETS.buildings).filter(
    ([assetId]) => !LEGACY_GAMEPLAY_EXCLUSIONS.has(assetId),
  ),
);

/**
 * Gameplay consumes only curated Composer buildings plus non-building Blender assets.
 * Legacy early-phase buildings remain in the raw manifest for Art Lab and historical evidence,
 * but cannot leak into the city through archetype selection.
 */
export const BLENDER_ASSETS = {
  ...RAW_BLENDER_ASSETS,
  buildings: {
    ...filteredBuildings,
    ...runtimeVisualOverrides.buildings,
  },
} as unknown as typeof RAW_BLENDER_ASSETS;
`,
);

write(
  "blender_artist/manifests/runtime-promotions.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      purpose:
        "Curated Building Composer candidates promoted to runtime after visual review. Raw early-phase archetypes are not gameplay candidates.",
      approvedAgainstHead: BRANCH_BASE,
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
          review: "Curated V.g domestic candidate; replaces early 1x1 residential archetypes.",
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
          review:
            "Roofed civic candidate restored after V7 flat-roof regression; plaza remains a separate public-space layer.",
        },
      ],
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// 2. Exact semantic building policy: no residential/commercial cross-family
// substitutions. Only two reviewed Composer assets are runtime-exact today.
// ---------------------------------------------------------------------------
const adapterPath = "apps/web/src/isometric/gameplay-visual-adapter.ts";
let adapter = read(adapterPath);
adapter = replaceBetween(
  adapter,
  "/** Archetypes residenciales compatibles",
  "/** Especies de árbol",
  `/**
 * Política visual temporal y explícita por BuildingType.
 *
 * Sólo los Composer candidates aprobados usan Blender exacto. Los trece tipos restantes conservan
 * su fallback procedural SEMÁNTICO exacto; nunca se sustituyen por una casa/tienda antigua para
 * obtener variedad aparente.
 */
export type BuildingVisualPolicy =
  | { kind: "runtime_exact"; assetId: string }
  | { kind: "runtime_compatible"; assetIds: readonly string[] }
  | { kind: "procedural_semantic_fallback"; assetId: string };

export const BUILDING_VISUAL_POLICIES: Record<BuildingType, BuildingVisualPolicy> = {
  courtyard_home: { kind: "runtime_exact", assetId: "courtyard_home" },
  row_house: { kind: "procedural_semantic_fallback", assetId: "row_house" },
  apartment_block: { kind: "procedural_semantic_fallback", assetId: "apartment_block" },
  mixed_tenement: { kind: "procedural_semantic_fallback", assetId: "mixed_tenement" },
  workshop: { kind: "procedural_semantic_fallback", assetId: "workshop" },
  warehouse: { kind: "procedural_semantic_fallback", assetId: "warehouse" },
  cement_plant: { kind: "procedural_semantic_fallback", assetId: "cement_plant" },
  brickworks: { kind: "procedural_semantic_fallback", assetId: "brickworks" },
  steelworks: { kind: "procedural_semantic_fallback", assetId: "steelworks" },
  town_hall: { kind: "runtime_exact", assetId: "town_hall" },
  school_block: { kind: "procedural_semantic_fallback", assetId: "school_block" },
  clinic: { kind: "procedural_semantic_fallback", assetId: "clinic" },
  police_station: { kind: "procedural_semantic_fallback", assetId: "police_station" },
  fire_station: { kind: "procedural_semantic_fallback", assetId: "fire_station" },
  market_hall: { kind: "procedural_semantic_fallback", assetId: "market_hall" },
};`,
  "política visual de edificios",
);

adapter = adapter.replace(
  /(export type GameplayParkedVehicle = \{[\s\S]*?\n\s*azimuth:) 45 \| 225;/,
  "$1 45 | 135 | 225 | 315;",
);

if (!adapter.includes("export function vehicleAzimuthForRoad")) {
  const marker = "/** Vehículos aparcados estáticos: sólo rectas";
  const helper = `/**
 * Azimut visual paralelo al eje de la calzada. Los dos sentidos de cada eje son explícitos para que
 * el renderer pueda usar un frame horneado o una rotación de pantalla equivalente.
 */
export function vehicleAzimuthForRoad(
  orientation: "straight_ns" | "straight_ew",
  reverse: boolean,
): 45 | 135 | 225 | 315 {
  if (orientation === "straight_ns") return reverse ? 315 : 135;
  return reverse ? 225 : 45;
}

`;
  const index = adapter.indexOf(marker);
  if (index < 0) throw new Error("[vh-remediation] no se encontró marcador de vehículos");
  adapter = `${adapter.slice(0, index)}${helper}${adapter.slice(index)}`;
}

const oldAzimuth =
  'const azimuth: 45 | 225 = road.orientation === "straight_ns" ? 45 : 225;';
const parkedReplacement = `const reverseDirection =
      spatialHash(road.cell.x, road.cell.y, 0x17b3) % 2 === 1;
    const azimuth = vehicleAzimuthForRoad(road.orientation, reverseDirection);`;
adapter = replaceExact(adapter, oldAzimuth, parkedReplacement, "azimut de coches aparcados");

const contextIndex = adapter.indexOf("export function planGameplayContextVehicles");
const contextNeedle = oldAzimuth;
const contextLine = adapter.indexOf(contextNeedle, contextIndex);
if (contextLine >= 0) {
  adapter = `${adapter.slice(0, contextLine)}const reverseDirection =
      spatialHash(anchor.x, anchor.y, 0x31d5 + i * 0x53) % 2 === 1;
    const azimuth = vehicleAzimuthForRoad(curb.road.orientation, reverseDirection);${adapter.slice(
      contextLine + contextNeedle.length,
    )}`;
} else if (!adapter.includes("vehicleAzimuthForRoad(curb.road.orientation")) {
  throw new Error("[vh-remediation] no se encontró azimut de vehículos contextuales");
}
write(adapterPath, adapter);

// ---------------------------------------------------------------------------
// 3. Physical actor scale and screen-axis vehicle rotation.
// ---------------------------------------------------------------------------
write(
  "apps/web/src/isometric/visual-scale.ts",
  `/** V.h remediation: physical presentation-scale contracts. */
export const CHARACTER_SOURCE_FRAME_PIXELS = 256;
export const CHARACTER_TARGET_HEIGHT_PIXELS = 28;
export const CHARACTER_RENDER_SCALE =
  CHARACTER_TARGET_HEIGHT_PIXELS / CHARACTER_SOURCE_FRAME_PIXELS;

/**
 * Rotation required when only the 45°/225° vehicle frames are baked. 135°/315° use the same
 * silhouette rotated by 90° until four-direction vehicle sprites are produced.
 */
export function vehicleScreenRotation(azimuth: 45 | 135 | 225 | 315): number {
  if (azimuth === 135) return Math.PI / 2;
  if (azimuth === 315) return -Math.PI / 2;
  return 0;
}
`,
);

const scenePath = "apps/web/src/isometric/IsometricSpikeScene.ts";
let scene = read(scenePath);
scene = replaceExact(
  scene,
  'import Phaser from "phaser";',
  'import Phaser from "phaser";\nimport { CHARACTER_RENDER_SCALE, vehicleScreenRotation } from "./visual-scale";',
  "import de escala visual",
);
scene = replaceExact(
  scene,
  `.setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));`,
  `.setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setRotation(vehicleScreenRotation(vehicle.azimuth))
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));`,
  "rotación de vehículos",
);
scene = replaceExact(
  scene,
  ".setScale(0.75)",
  ".setScale(CHARACTER_RENDER_SCALE)",
  "escala física de actores",
);
write(scenePath, scene);

// ---------------------------------------------------------------------------
// 4. Capture hygiene: real industrial district and no duplicated cwd output.
// ---------------------------------------------------------------------------
const capturePath = "scripts/vh-world-visual-capture.mjs";
let capture = read(capturePath);
const industrialPattern =
  /(id:\s*["']detail-industrial["'][\s\S]{0,500}?district(?:Name)?:\s*["'])[^"']+(["'])/;
if (industrialPattern.test(capture)) {
  capture = capture.replace(industrialPattern, "$1Ensanche Ferroviario Oeste$2");
} else if (!capture.includes("Ensanche Ferroviario Oeste")) {
  throw new Error("[vh-remediation] no se encontró detalle industrial en capture script");
}
write(capturePath, capture);
rmSync(absolute("apps/web/docs/art/world-visual-foundation"), {
  recursive: true,
  force: true,
});

// ---------------------------------------------------------------------------
// 5. Structural regression tests. Pixel review remains a separate human gate.
// ---------------------------------------------------------------------------
write(
  "apps/web/src/isometric/visual-remediation.test.ts",
  `import { describe, expect, it } from "vitest";
import type { BuildingType } from "@landlord/shared";
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

const BUILDING_TYPES: readonly BuildingType[] = [
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
];

const LEGACY = [
  "bld_shopfront",
  "bld_commercial_b",
  "bld_commercial_c",
  "bld_residential_a",
  "bld_residential_b",
  "bld_residential_c",
];

describe("V.h visual remediation", () => {
  it("excluye del gameplay todos los edificios heredados de las primeras versiones", () => {
    for (const assetId of LEGACY) expect(BLENDER_ASSETS.buildings[assetId]).toBeUndefined();
  });

  it("promueve sólo Composer candidates revisados y conserva fallback semántico exacto", () => {
    expect(BLENDER_ASSETS.buildings.courtyard_home?.states.complete).toBeTruthy();
    expect(BLENDER_ASSETS.buildings.town_hall?.states.complete).toBeTruthy();
    for (const type of BUILDING_TYPES) {
      const policy = BUILDING_VISUAL_POLICIES[type];
      const archetype = visualArchetypeForBuilding(type, `building:${type}`);
      if (type === "courtyard_home" || type === "town_hall") {
        expect(policy.kind).toBe("runtime_exact");
        expect(BLENDER_ASSETS.buildings[archetype]).toBeTruthy();
      } else {
        expect(policy).toEqual({ kind: "procedural_semantic_fallback", assetId: type });
        expect(archetype).toBe(type);
      }
    }
  });

  it("mantiene ambos ejes viales y ambos sentidos visuales", () => {
    expect(vehicleAzimuthForRoad("straight_ew", false)).toBe(45);
    expect(vehicleAzimuthForRoad("straight_ew", true)).toBe(225);
    expect(vehicleAzimuthForRoad("straight_ns", false)).toBe(135);
    expect(vehicleAzimuthForRoad("straight_ns", true)).toBe(315);
    expect(vehicleScreenRotation(45)).toBe(0);
    expect(vehicleScreenRotation(225)).toBe(0);
    expect(Math.abs(vehicleScreenRotation(135))).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(vehicleScreenRotation(315))).toBeCloseTo(Math.PI / 2);
  });

  it("escala los Rocketbox a una presencia humana urbana, no a 192 px", () => {
    expect(CHARACTER_RENDER_SCALE).toBeCloseTo(0.109375);
    expect(CHARACTER_SOURCE_FRAME_PIXELS * CHARACTER_RENDER_SCALE).toBe(
      CHARACTER_TARGET_HEIGHT_PIXELS,
    );
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeGreaterThanOrEqual(22);
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeLessThanOrEqual(32);
  });

  it("el ayuntamiento promovido conserva una imagen de tejado y fallback de estados honesto", () => {
    const hall = BLENDER_ASSETS.buildings.town_hall!;
    expect(hall.states.complete.src).toContain("town_hall-roofed-complete.png");
    expect(hall.stateFallback).toBe("procedural");
    expect(hall.states).not.toHaveProperty("burning");
    expect(hall.states).not.toHaveProperty("damaged");
    expect(hall.states).not.toHaveProperty("construction");
  });
});
`,
);

console.log(
  JSON.stringify({
    status: "visual-remediation-applied",
    base: BRANCH_BASE,
    promotedBuildings: ["courtyard_home", "town_hall"],
    legacyBuildingsExcluded: 6,
    actorTargetPixels: 28,
    vehicleAzimuths: [45, 135, 225, 315],
  }),
);
