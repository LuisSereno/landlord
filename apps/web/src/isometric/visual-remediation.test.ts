import { describe, expect, it } from "vitest";
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
// Edificios con candidato Composer revisado por el responsable y promovido a runtime_exact.
const REVIEWED_COMPOSER: readonly BuildingType[] = [
  "courtyard_home",
  "town_hall",
  "school_block",
  "row_house",
  "apartment_block",
  "mixed_tenement",
];

describe("V.h visual remediation", () => {
  it("publishes a valid curated RuntimeAssetManifestV2", () => {
    expect(validateRuntimeAssetManifestV2(BLENDER_ASSETS)).toEqual([]);
  });

  it("excludes every early-phase building from gameplay", () => {
    for (const id of LEGACY) expect(BLENDER_ASSETS.buildings[id]).toBeUndefined();
  });

  it("uses reviewed Composer assets only for the approved catalog and semantic fallback for the rest", () => {
    for (const type of TYPES) {
      const policy = BUILDING_VISUAL_POLICIES[type];
      const visual = visualArchetypeForBuilding(type, "building:" + type);
      if (REVIEWED_COMPOSER.includes(type)) {
        expect(policy.mode, type).toBe("runtime_exact");
        expect(BLENDER_ASSETS.buildings[visual], type).toBeTruthy();
      } else {
        expect(policy, type).toEqual({ mode: "procedural_semantic_fallback", assetId: type });
        expect(visual, type).toBe(type);
      }
    }
  });

  it("promotes the V.i residential catalog with provenance and no fabricated states", () => {
    const approved: Record<string, string> = {
      row_house: "vg_row_house_1001",
      apartment_block: "vg_apartment_block_1002",
      mixed_tenement: "vg_mixed_tenement_1001",
    };
    for (const [type, candidateId] of Object.entries(approved)) {
      const asset = BLENDER_ASSETS.buildings[type]!;
      expect(asset, type).toBeTruthy();
      expect(asset.states.complete.src, type).toContain(`${type}-complete.png`);
      expect(asset.provenance?.notes, type).toContain(candidateId);
      expect(asset.stateFallback, type).toBe("procedural");
      expect(asset.states.construction, type).toBeUndefined();
      expect(asset.states.damaged, type).toBeUndefined();
      expect(asset.states.burning, type).toBeUndefined();
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

  it("uses the owner-selected V7 town hall without manufacturing missing states", () => {
    const hall = BLENDER_ASSETS.buildings.town_hall!;
    expect(hall.states.complete.src).toContain("town_hall-complete.png");
    expect(hall.provenance?.notes).toContain("vf_town_hall_1006");
    expect(hall.stateFallback).toBe("procedural");
    expect(hall.states.construction).toBeUndefined();
    expect(hall.states.damaged).toBeUndefined();
    expect(hall.states.burning).toBeUndefined();
  });
});
