import { describe, expect, it } from "vitest";

import {
  blockSchema,
  canonicalCellKeys,
  cityProfileSchema,
  citySchema,
  developmentCodeSchema,
  districtConnectionSchema,
  districtGatewayIdentity,
  districtGatewaySchema,
  districtGenerationSeed,
  publicSpaceSchema,
  urbanFacilitySchema,
} from "./urban";
import {
  parseBlockId,
  parseCityProfileId,
  parseDevelopmentCodeId,
  parseDistrictGatewayId,
  parseDistrictId,
} from "./primitives";
import { parseSeed } from "./time-and-grid";

const DEVELOPMENT_CODE = {
  id: "res_urban_4f",
  allowedUses: ["residential"],
  maxFloors: 4,
  maxCoveragePercent: 80,
  maxFloorAreaRatioPercent: 280,
  streetSetbackCells: 0,
  sideSetbackCells: 0,
};

describe("V.d urban contracts", () => {
  it("accepts a development code expressed only in integers", () => {
    expect(developmentCodeSchema.parse(DEVELOPMENT_CODE)).toEqual(DEVELOPMENT_CODE);
  });

  it("rejects fractional rules, empty use lists and a zero-height envelope", () => {
    expect(() => developmentCodeSchema.parse({ ...DEVELOPMENT_CODE, maxFloors: 3.5 })).toThrow();
    expect(() =>
      developmentCodeSchema.parse({ ...DEVELOPMENT_CODE, maxCoveragePercent: 80.5 }),
    ).toThrow();
    expect(() => developmentCodeSchema.parse({ ...DEVELOPMENT_CODE, allowedUses: [] })).toThrow();
    expect(() => developmentCodeSchema.parse({ ...DEVELOPMENT_CODE, maxFloors: 0 })).toThrow();
  });

  it("keeps profile identifiers as authored slugs and rejects opaque ones", () => {
    expect(parseCityProfileId("ciudad_del_umbral_v1")).toBe("ciudad_del_umbral_v1");
    expect(parseDevelopmentCodeId("mixed_core_5f")).toBe("mixed_core_5f");
    expect(() => parseCityProfileId("Ciudad_Del_Umbral")).toThrow();
    expect(() => parseCityProfileId("1nvalid")).toThrow();
  });

  it("requires geometry-derived ids to be hashes, not counters", () => {
    expect(parseBlockId("block_fdc9ba45")).toBe("block_fdc9ba45");
    expect(() => parseBlockId("block_00000007")).not.toThrow();
    expect(() => parseBlockId("block_7")).toThrow();
    expect(() => parseDistrictGatewayId("gateway_zzzzzzzz")).toThrow();
  });

  it("requires a block to have cells, a role and at least one road frontage", () => {
    expect(
      blockSchema.parse({
        id: "block_fdc9ba45",
        districtId: "district_00000001",
        cells: [{ x: 4, y: 4 }],
        frontageRoadSegmentIds: ["road_00ff12ab"],
        urbanRole: "urban_residential",
        defaultDevelopmentCodeId: "res_urban_4f",
      }),
    ).toMatchObject({ urbanRole: "urban_residential" });
    expect(() =>
      blockSchema.parse({
        id: "block_fdc9ba45",
        districtId: "district_00000001",
        cells: [{ x: 4, y: 4 }],
        frontageRoadSegmentIds: [],
        urbanRole: "urban_residential",
        defaultDevelopmentCodeId: "res_urban_4f",
      }),
    ).toThrow();
    expect(() => blockSchema.parse({ ...DEVELOPMENT_CODE, urbanRole: "downtown" })).toThrow();
  });

  it("allows a public space without a block but never without cells or an operator", () => {
    expect(
      publicSpaceSchema.parse({
        id: "publicspace_00000001",
        districtId: "district_00000001",
        blockId: null,
        kind: "plaza",
        cells: [{ x: 30, y: 30 }],
        operatorOrganizationId: "org_00000004",
      }),
    ).toMatchObject({ blockId: null, kind: "plaza" });
    expect(() =>
      publicSpaceSchema.parse({
        id: "publicspace_00000001",
        districtId: "district_00000001",
        blockId: null,
        kind: "plaza",
        cells: [],
        operatorOrganizationId: "org_00000004",
      }),
    ).toThrow();
  });

  it("separates an operating facility from its buildings and refuses zero capacity", () => {
    expect(
      urbanFacilitySchema.parse({
        id: "urbanfacility_00000001",
        kind: "school",
        districtId: "district_00000002",
        parcelIds: ["parcel_00000009"],
        buildingIds: ["building_00000003"],
        publicSpaceIds: ["publicspace_00000005"],
        operatorOrganizationId: "org_00000004",
        capacity: 120,
        serviceProfileId: "school_primary",
      }),
    ).toMatchObject({ kind: "school", capacity: 120 });
    expect(() =>
      urbanFacilitySchema.parse({
        id: "urbanfacility_00000001",
        kind: "school",
        districtId: "district_00000002",
        parcelIds: [],
        buildingIds: [],
        publicSpaceIds: [],
        operatorOrganizationId: "org_00000004",
        capacity: 0,
        serviceProfileId: "school_primary",
      }),
    ).toThrow();
  });

  it("derives gateway identity from the pair of districts, not from the order it was asked", () => {
    const forward = districtGatewayIdentity({
      firstDistrictId: parseDistrictId("district_00000002"),
      firstSide: "east",
      secondDistrictId: parseDistrictId("district_00000005"),
      secondSide: "west",
    });
    const backward = districtGatewayIdentity({
      firstDistrictId: parseDistrictId("district_00000005"),
      firstSide: "west",
      secondDistrictId: parseDistrictId("district_00000002"),
      secondSide: "east",
    });
    expect(backward.id).toBe(forward.id);
    expect(backward.districtIds).toEqual(forward.districtIds);
    expect(backward.sides).toEqual(forward.sides);
    expect(() => districtGatewaySchema.parse({ ...forward, cells: [{ x: 63, y: 10 }] })).toThrow();
  });

  it("prices a connection with a positive integer traversal cost", () => {
    const gateway = districtGatewayIdentity({
      firstDistrictId: parseDistrictId("district_00000001"),
      firstSide: "south",
      secondDistrictId: parseDistrictId("district_00000004"),
      secondSide: "north",
    });
    expect(
      districtConnectionSchema.parse({
        id: "connection_00ff12ab",
        gatewayId: gateway.id,
        fromDistrictId: "district_00000001",
        toDistrictId: "district_00000004",
        cost: 4,
      }),
    ).toMatchObject({ cost: 4 });
    expect(() =>
      districtConnectionSchema.parse({
        id: "connection_00ff12ab",
        gatewayId: gateway.id,
        fromDistrictId: "district_00000001",
        toDistrictId: "district_00000004",
        cost: 0,
      }),
    ).toThrow();
  });

  it("holds exactly nine districts of a 3×3 layout under one municipality", () => {
    const slots = Array.from({ length: 9 }, (_, index) => ({
      slotX: index % 3,
      slotY: Math.floor(index / 3),
      profileId: `perfil_${index}`,
      name: `Distrito ${index}`,
      dominantRole: "mixed_core",
    }));
    const city = {
      id: "city_00000001",
      name: "Ciudad del Umbral",
      municipalityOrganizationId: "org_00000004",
      layout: { columns: 3, rows: 3 },
      districtIds: Array.from(
        { length: 9 },
        (_, index) => `district_${String(index + 1).padStart(8, "0")}`,
      ),
      connections: [],
      generation: { profileId: "ciudad_del_umbral_v1", generatorVersion: 1, seed: 7 },
    };
    expect(citySchema.parse(city).districtIds).toHaveLength(9);
    expect(
      cityProfileSchema.parse({
        id: "ciudad_del_umbral_v1",
        name: "Ciudad del Umbral",
        layout: { columns: 3, rows: 3 },
        districtSlots: slots,
        gatewayConnectionCost: 4,
      }).districtSlots,
    ).toHaveLength(9);
    expect(() =>
      citySchema.parse({ ...city, districtIds: city.districtIds.slice(0, 8) }),
    ).toThrow();
    expect(() => citySchema.parse({ ...city, layout: { columns: 4, rows: 4 } })).toThrow();
  });

  it("derives one stable district seed per slot and never a shared one", () => {
    const base = {
      citySeed: parseSeed(7),
      cityProfileId: parseCityProfileId("ciudad_del_umbral_v1"),
      districtProfileId: "barrio_del_umbral",
    };
    const first = districtGenerationSeed({ ...base, slotX: 0, slotY: 1 });
    expect(districtGenerationSeed({ ...base, slotX: 0, slotY: 1 })).toBe(first);
    expect(districtGenerationSeed({ ...base, slotX: 1, slotY: 0 })).not.toBe(first);
    expect(
      districtGenerationSeed({ ...base, slotX: 0, slotY: 1, districtProfileId: "otro_perfil" }),
    ).not.toBe(first);
    expect(Number.isSafeInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffffffff);
  });

  it("canonicalises cell geometry independently of insertion order and duplicates", () => {
    expect(
      canonicalCellKeys([
        { x: 5, y: 1 },
        { x: 1, y: 2 },
        { x: 5, y: 1 },
      ]),
    ).toEqual(["1:2", "5:1"]);
    expect(
      canonicalCellKeys([
        { x: 10, y: 0 },
        { x: 2, y: 9 },
      ]),
    ).toEqual(
      canonicalCellKeys([
        { x: 2, y: 9 },
        { x: 10, y: 0 },
      ]),
    );
  });
});
