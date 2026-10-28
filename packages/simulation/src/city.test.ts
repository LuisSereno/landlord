import { describe, expect, it } from "vitest";

import { parseDistrictId } from "@landlord/shared";

import {
  CITY_LAYOUT,
  CITY_ROSTER_SLOTS,
  adjacentPairs,
  createCity,
  deriveGateways,
  districtIdForSlot,
  parcelIdOrdinalForSlot,
  resolveCityProfile,
  slotForDistrictId,
} from "./city";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";

const PROFILE = resolveCityProfile();

describe("V.d.0 city layer", () => {
  it("generates the nine authored districts in canonical slot order", () => {
    const city = createCity({ seed: 1 });
    expect(city.districts.size).toBe(9);
    expect(city.city.districtIds).toHaveLength(9);
    expect(city.city.layout).toEqual(CITY_LAYOUT);
    expect(city.city.municipalityOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    const names = city.city.districtIds.map((id) => city.districts.get(id)!.district.name);
    expect(names).toEqual([
      "Lomas del Umbral",
      "Mercado del Norte",
      "Vega del Cauce",
      "Barrio del Umbral",
      "Centro Cívico",
      "Barrio del Taller",
      "Ensanche Ferroviario Oeste",
      "Corredor Ferroviario",
      "Patios del Este",
    ]);
  });

  it("produces the same city, gateways and parcel ids for the same seed", () => {
    const signature = (city: ReturnType<typeof createCity>) =>
      JSON.stringify({
        districtIds: city.city.districtIds,
        gateways: city.gateways,
        connections: city.connections,
        parcels: [...city.districts.values()].flatMap((district) =>
          district.parcels.map((parcel) => parcel.id),
        ),
        blocked: [...city.districts.values()].map((district) => district.blockedCells.length),
      });
    expect(signature(createCity({ seed: 7 }))).toBe(signature(createCity({ seed: 7 })));
    expect(signature(createCity({ seed: 7 }))).not.toBe(signature(createCity({ seed: 8 })));
  });

  it("keeps parcel ids unique across the nine districts", () => {
    const city = createCity({ seed: 3 });
    const ids = [...city.districts.values()].flatMap((district) =>
      district.parcels.map((parcel) => parcel.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(100);
    for (const district of city.districts.values()) {
      for (const parcel of district.parcels) {
        expect(parcel.districtId).toBe(district.district.id);
      }
    }
  });

  it("emits one gateway per orthogonally adjacent pair, on border cells", () => {
    const city = createCity({ seed: 1 });
    expect(adjacentPairs()).toHaveLength(12);
    expect(city.gateways).toHaveLength(12);
    expect(new Set(city.gateways.map((gateway) => gateway.id)).size).toBe(12);

    for (const gateway of city.gateways) {
      expect(gateway.districtIds).toHaveLength(2);
      expect(gateway.cells).toHaveLength(2);
      expect(gateway.sides).toHaveLength(2);
      expect([...gateway.districtIds].sort()).toEqual(gateway.districtIds);
      gateway.cells.forEach((cell, index) => {
        const side = gateway.sides[index]!;
        if (side === "west") expect(cell.x).toBe(0);
        if (side === "east") expect(cell.x).toBe(63);
        if (side === "north") expect(cell.y).toBe(0);
        if (side === "south") expect(cell.y).toBe(63);
      });
      const [first, second] = gateway.districtIds;
      expect(city.districts.has(first!)).toBe(true);
      expect(city.districts.has(second!)).toBe(true);
    }
  });

  it("derives the gateway identity from the pair, not from the order it was asked", () => {
    const city = createCity({ seed: 1 });
    const gateway = city.gateways[0]!;
    const [firstId, secondId] = gateway.districtIds;
    const [firstSide, secondSide] = gateway.sides;
    const reversed = deriveGateways(
      new Map([...city.districts].map(([id, state]) => [id, state] as const)),
    );
    const samePair = reversed.find(
      (candidate) =>
        (candidate.leftId === secondId && candidate.rightId === firstId) ||
        (candidate.leftId === firstId && candidate.rightId === secondId),
    );
    expect(samePair).toBeDefined();
    const identity = gateway.id;
    expect(identity.startsWith("gateway_")).toBe(true);
    expect(firstSide).not.toBe(secondSide);
  });

  it("prices every connection with a positive integer and points at a real gateway", () => {
    const city = createCity({ seed: 1 });
    expect(city.connections).toHaveLength(12);
    const gatewayIds = new Set(city.gateways.map((gateway) => gateway.id));
    for (const connection of city.connections) {
      expect(Number.isInteger(connection.cost)).toBe(true);
      expect(connection.cost).toBeGreaterThan(0);
      expect(gatewayIds.has(connection.gatewayId)).toBe(true);
      expect(connection.fromDistrictId).not.toBe(connection.toDistrictId);
    }
  });

  it("derives one seed per district so a recipe change does not shift other districts", () => {
    const city = createCity({ seed: 11 });
    const generations = city.city.districtIds.map(
      (id) => city.districts.get(id)!.district.generation!,
    );
    const seeds = generations.map((generation) => generation.seed);
    expect(new Set(seeds).size).toBe(9);
    for (const generation of generations) {
      expect(generation.profileId).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it("maps slots to district ids both ways", () => {
    expect(districtIdForSlot(0, 0)).toBe(parseDistrictId("district_00000001"));
    expect(districtIdForSlot(2, 2)).toBe(parseDistrictId("district_00000009"));
    expect(slotForDistrictId(parseDistrictId("district_00000005"))).toEqual({ slotX: 1, slotY: 1 });
    expect(parcelIdOrdinalForSlot(1, 1)).toBe(4_000_000);
    expect(PROFILE.slots).toHaveLength(9);
    expect(CITY_ROSTER_SLOTS.player).toEqual({ slotX: 0, slotY: 1 });
    expect(CITY_ROSTER_SLOTS.rival).toEqual({ slotX: 2, slotY: 1 });
  });
});
