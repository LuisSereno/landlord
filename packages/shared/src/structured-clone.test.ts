import { describe, expect, it } from "vitest";

import * as shared from "./index";

function cityFixture(observedDistrictId: string) {
  return {
    observedDistrictId,
    city: {
      id: "city_00000001",
      name: "Ciudad de prueba",
      layout: { columns: 3, rows: 3 },
      districts: Array.from({ length: 9 }, (_, index) => ({
        id: `district_${String(index + 1).padStart(8, "0")}`,
        name: `Distrito ${index + 1}`,
        slotX: index % 3,
        slotY: Math.floor(index / 3),
        role: "mixed_core",
        parcels: 0,
        marketableParcels: 0,
        ownParcels: 0,
        rivalParcels: 0,
        buildings: 0,
        ownBuildings: 0,
        rivalBuildings: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        rentIndexPercent: 100,
        averageLandValue: 0,
        alerts: 0,
      })),
    },
  };
}

const clone = <T>(value: T): T =>
  (globalThis as typeof globalThis & { structuredClone<T>(value: T): T }).structuredClone(value);

const snapshot = {
  schemaVersion: 2,
  engineVersion: "gate1-dev",
  seed: 1,
  tick: 0,
  prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3, 4] },
  idCounters: { structure: 1, agent: 1, event: 0, commandOrder: 0 },
  world: {
    city: {
      id: "city_00000001",
      name: "Ciudad de prueba",
      municipalityOrganizationId: "org_00000001",
      layout: { columns: 3, rows: 3 },
      districtIds: Array.from(
        { length: 9 },
        (_, index) => `district_${String(index + 1).padStart(8, "0")}`,
      ),
      connections: [],
      generation: { profileId: "ciudad_de_prueba_v1", generatorVersion: 1, seed: 1 },
    },
    gateways: [],
    districts: Array.from({ length: 9 }, (_, index) => ({
      district: {
        id: `district_${String(index + 1).padStart(8, "0")}`,
        name: `Distrito ${index + 1}`,
        width: 64,
        height: 64,
      },
      map: {
        width: 64,
        height: 64,
        blockedCells: [],
        roads: { topologyVersion: 1, derivationVersion: 2, segments: [] },
      },
      blocks: [],
      publicSpaces: [],
    })),
  },
  playerIdentities: [{ id: "player_00000001", personId: "person_00000001" }],
  persons: [{ id: "person_00000001" }],
  organizations: [{ id: "org_00000001", kind: "company" }],
  controlGrants: [{ personId: "person_00000001", organizationId: "org_00000001" }],
  agents: [],
  structures: [],
  processedCommandIds: [],
  pendingCommands: [],
};

describe("shared wire data", () => {
  it("structured-clones requests, responses, domain events, projections and snapshots", () => {
    const values = [
      shared.initializeGameRequestSchema.parse({
        protocolVersion: 2,
        requestId: "request-1",
        type: "InitializeGame",
        payload: { seed: 1 },
      }),
      shared.requestSucceededSchema.parse({
        protocolVersion: 2,
        requestId: "request-1",
        type: "RequestSucceeded",
        payload: { acceptedAtTick: 1 },
      }),
      shared.placeTestStructureSchema.parse({
        commandId: "command-1",
        issuedByPersonId: "person_00000001",
        actingAsOrganizationId: "org_00000001",
        type: "PlaceTestStructure",
        payload: { districtId: "district_00000004", cell: { x: 1, y: 1 } },
      }),
      shared.testStructurePlacedSchema.parse({
        eventId: "event-1",
        tick: 1,
        causationCommandId: "command-1",
        type: "TestStructurePlaced",
        payload: {
          structureId: "structure_00000001",
          ownerOrganizationId: "org_00000001",
          cell: { x: 1, y: 1 },
        },
      }),
      shared.viewProjectionV2Schema.parse({
        projectionVersion: 2,
        ...cityFixture("district_00000001"),
        tick: 1,
        map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells: [] } },
        structures: [],
        agents: [],
      }),
      shared.snapshotV2Schema.parse(snapshot),
    ];

    for (const value of values) {
      expect(clone(value)).toEqual(value);
    }
  });

  it("exposes the package through its public barrel", () => {
    expect(shared.sharedPackage).toBe("@landlord/shared");
    expect(shared.snapshotV2Schema).toBeDefined();
    expect(shared.placeTestStructureSchema).toBeDefined();
  });
});
