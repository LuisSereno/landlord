import { describe, expect, it } from "vitest";
import { validateSnapshotReferences, type UrbanRole } from "@landlord/shared";

import {
  CITY_PARCEL_COUNT_ENVELOPE,
  CITY_SEED_FIXTURES,
  CANONICAL_CITY_SEEDS,
} from "./city-fixtures";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import { canonicalizeState } from "./runner";
import { serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";

/**
 * §2.1. Doce seeds canónicas de ciudad completa, no doce fixtures de distrito. Cada una se valida
 * contra la tabla medida: nueve distritos, programa municipal exacto, referencias íntegras,
 * envolvente de parcelas, conectividad por gateway y determinismo.
 */

function digest(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right + code + index, 0x85ebca6b) >>> 0;
  }
  return (left.toString(16).padStart(8, "0") + right.toString(16).padStart(8, "0")).slice(0, 16);
}

function measure(state: GameState) {
  const parcels = [...state.phase2.parcels.values()];
  const districts = [...state.world.districts.values()];
  const facilities = districts.flatMap((district) => [...district.facilities.values()]);
  const publicSpaces = districts.flatMap((district) => [...district.publicSpaces.values()]);
  const blockRoleCounts = Object.fromEntries(URBAN_ROLES.map((role) => [role, 0])) as Record<
    UrbanRole,
    number
  >;
  for (const district of districts)
    for (const block of district.blocks.values()) blockRoleCounts[block.urbanRole] += 1;
  return {
    digestValue: digest(canonicalizeState(state)),
    districtCount: state.world.districts.size,
    blockCount: districts.reduce((total, district) => total + district.blocks.size, 0),
    parcelCount: parcels.length,
    marketableParcelCount: parcels.filter((parcel) => parcel.disposition === "marketable").length,
    publicParcelCount: parcels.filter((parcel) => parcel.disposition === "public").length,
    facilityCount: facilities.length,
    publicSpaceCount: publicSpaces.length,
    municipalBuildingCount: [...state.phase2.buildings.values()].filter(
      (building) => building.ownerOrganizationId === MUNICIPALITY_ORGANIZATION_ID,
    ).length,
    gatewayCount: state.world.gateways.length,
    connectionCount: state.world.city.connections.length,
    blockRoleCounts,
  };
}

/** Orden canónico de roles, el mismo del generador de distritos. */
const URBAN_ROLES: readonly UrbanRole[] = [
  "civic_core",
  "mixed_core",
  "commercial_corridor",
  "urban_residential",
  "low_density_residential",
  "industrial_logistics",
  "institutional",
  "green_open_space",
];

/** Alcance real por gateway: los nueve distritos tienen que ser un único componente conectado. */
function reachableDistrictCount(state: GameState): number {
  const adjacency = new Map<string, string[]>();
  for (const connection of state.world.city.connections) {
    const gateway = state.world.gateways.find((entry) => entry.id === connection.gatewayId);
    if (!gateway) continue;
    for (const from of gateway.districtIds)
      for (const to of gateway.districtIds)
        if (from !== to)
          adjacency.set(from as string, [...(adjacency.get(from as string) ?? []), to as string]);
  }
  const start = state.world.city.districtIds[0]! as string;
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? [])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  }
  return seen.size;
}

describe("§2.1 · doce seeds canónicas de ciudad", () => {
  it("la tabla es explícita, son doce y distintas de las fixtures de distrito", () => {
    expect(CANONICAL_CITY_SEEDS).toHaveLength(12);
    expect(new Set(CANONICAL_CITY_SEEDS).size).toBe(12);
    expect(CITY_SEED_FIXTURES.map((entry) => entry.seed)).toEqual([...CANONICAL_CITY_SEEDS]);
    expect(CITY_SEED_FIXTURES.length).toBe(CANONICAL_CITY_SEEDS.length);
  });

  it("cada seed reproduce su medida: nueve distritos, programa municipal y geometría", () => {
    for (const fixture of CITY_SEED_FIXTURES) {
      const state = createInitialState(fixture.seed);
      expect(measure(state), `seed ${String(fixture.seed)}`).toEqual({
        digestValue: fixture.digest,
        districtCount: fixture.districtCount,
        blockCount: fixture.blockCount,
        parcelCount: fixture.parcelCount,
        marketableParcelCount: fixture.marketableParcelCount,
        publicParcelCount: fixture.publicParcelCount,
        facilityCount: fixture.facilityCount,
        publicSpaceCount: fixture.publicSpaceCount,
        municipalBuildingCount: fixture.municipalBuildingCount,
        gatewayCount: fixture.gatewayCount,
        connectionCount: fixture.connectionCount,
        blockRoleCounts: fixture.blockRoleCounts,
      });
    }
  });

  it("el programa municipal es idéntico en las doce ciudades", () => {
    /** §9: 14 facilities, 7 espacios públicos, 14 parcelas públicas y 14 edificios municipales. */
    for (const seed of CANONICAL_CITY_SEEDS) {
      const state = createInitialState(seed);
      const facilities = [...state.world.districts.values()].flatMap((district) => [
        ...district.facilities.values(),
      ]);
      expect(facilities.filter((entry) => entry.kind === "town_hall")).toHaveLength(1);
      expect(facilities.filter((entry) => entry.kind === "school")).toHaveLength(3);
      expect(facilities.filter((entry) => entry.kind === "clinic")).toHaveLength(3);
      expect(facilities.filter((entry) => entry.kind === "police_station")).toHaveLength(2);
      expect(facilities.filter((entry) => entry.kind === "fire_station")).toHaveLength(2);
      expect(facilities.filter((entry) => entry.kind === "market")).toHaveLength(3);
      expect(facilities).toHaveLength(14);
      for (const facility of facilities) {
        expect(facility.operatorOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
        expect(facility.buildingIds.length).toBeGreaterThan(0);
        for (const buildingId of facility.buildingIds)
          expect(state.phase2.buildings.get(buildingId)!.ownerOrganizationId).toBe(
            MUNICIPALITY_ORGANIZATION_ID,
          );
      }
      /** Suelo público inalienable: nunca en manos de una empresa. */
      for (const parcel of state.phase2.parcels.values()) {
        if (parcel.disposition !== "marketable")
          expect(parcel.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
        else expect(parcel.ownerOrganizationId).toBeNull();
      }
    }
  });

  it("no hay referencias rotas en ninguna ciudad canónica", () => {
    for (const seed of CANONICAL_CITY_SEEDS) {
      const snapshot = serializeSnapshot(createInitialState(seed));
      expect(validateSnapshotReferences(snapshot), `seed ${String(seed)}`).toEqual([]);
    }
  });

  it("los nueve distritos están conectados por gateways en las doce semillas", () => {
    for (const seed of CANONICAL_CITY_SEEDS) {
      const state = createInitialState(seed);
      expect(reachableDistrictCount(state), `seed ${String(seed)}`).toBe(9);
      for (const connection of state.world.city.connections) {
        const gateway = state.world.gateways.find((entry) => entry.id === connection.gatewayId)!;
        expect(gateway.districtIds).toHaveLength(2);
        expect(gateway.districtIds[0]).not.toBe(gateway.districtIds[1]);
        expect(connection.cost).toBeGreaterThan(0);
      }
    }
  });

  it("el número de parcelas se mantiene dentro de la envolvente medida", () => {
    for (const fixture of CITY_SEED_FIXTURES) {
      expect(fixture.parcelCount).toBeGreaterThanOrEqual(CITY_PARCEL_COUNT_ENVELOPE.min);
      expect(fixture.parcelCount).toBeLessThanOrEqual(CITY_PARCEL_COUNT_ENVELOPE.max);
      expect(fixture.marketableParcelCount + fixture.publicParcelCount).toBe(fixture.parcelCount);
    }
  });

  it("la generación es determinista y cada semilla produce una ciudad distinta", () => {
    const digests = CANONICAL_CITY_SEEDS.map((seed) => {
      const first = canonicalizeState(createInitialState(seed));
      const second = canonicalizeState(createInitialState(seed));
      expect(second).toBe(first);
      return digest(first);
    });
    expect(new Set(digests).size).toBe(digests.length);
  });
});
