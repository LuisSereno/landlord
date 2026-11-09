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
  CHARACTER_LIFT_LUT,
  CHARACTER_RENDER_SCALE,
  CHARACTER_SOURCE_FRAME_PIXELS,
  CHARACTER_TARGET_HEIGHT_PIXELS,
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
  "workshop",
  "warehouse",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
  "cement_plant",
  "brickworks",
  "steelworks",
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

  it("promotes the V.i catalog with provenance and no fabricated states", () => {
    const approved: Record<string, string> = {
      row_house: "vg_row_house_1001",
      apartment_block: "vg_apartment_block_1002",
      mixed_tenement: "vg_mixed_tenement_1001",
      workshop: "vg_workshop_1003",
      warehouse: "vg_warehouse_1002",
      clinic: "vg_clinic_1003",
      police_station: "vg_police_station_1002",
      fire_station: "vg_fire_station_1003",
      market_hall: "vg_market_hall_1000",
      cement_plant: "vg_cement_plant_1001",
      brickworks: "vg_brickworks_1000",
      steelworks: "vg_steelworks_1003",
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

  it("maps both road axes and directions onto the baked facings", () => {
    expect(vehicleAzimuthForRoad("straight_ew", false)).toBe(135);
    expect(vehicleAzimuthForRoad("straight_ew", true)).toBe(315);
    expect(vehicleAzimuthForRoad("straight_ns", false)).toBe(225);
    expect(vehicleAzimuthForRoad("straight_ns", true)).toBe(45);
  });

  it("keeps a 256px Rocketbox frame in a 22-32px urban-height envelope", () => {
    expect(CHARACTER_RENDER_SCALE).toBeCloseTo(0.109375);
    expect(CHARACTER_SOURCE_FRAME_PIXELS * CHARACTER_RENDER_SCALE).toBe(
      CHARACTER_TARGET_HEIGHT_PIXELS,
    );
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeGreaterThanOrEqual(22);
    expect(CHARACTER_TARGET_HEIGHT_PIXELS).toBeLessThanOrEqual(32);
  });

  it("lifts baked characters above the ground they walk on without clipping the bake", () => {
    expect(CHARACTER_LIFT_LUT.length).toBe(256);
    expect(CHARACTER_LIFT_LUT[0]).toBe(0);
    expect(CHARACTER_LIFT_LUT[255]).toBe(255);
    for (let value = 1; value < 256; value += 1) {
      expect(CHARACTER_LIFT_LUT[value]!).toBeGreaterThanOrEqual(CHARACTER_LIFT_LUT[value - 1]!);
    }
    /** Medido sobre `chr_worker-d0-walk-0.png`: mediana 10/255 y media 16/255, bajo el suelo. */
    expect(CHARACTER_LIFT_LUT[10]!).toBeGreaterThanOrEqual(40);
    expect(CHARACTER_LIFT_LUT[16]!).toBeGreaterThanOrEqual(45);
    /** La ropa de trabajo sigue siendo ropa de trabajo: 2.2 la decoloraba a gris. */
    expect(CHARACTER_LIFT_LUT[64]!).toBeLessThan(128);
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
