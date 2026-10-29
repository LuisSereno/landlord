import { describe, expect, it } from "vitest";

import { roadSegmentId } from "./domain";
import {
  parseSnapshotV2,
  snapshotV2Schema,
  UnsupportedSnapshotVersionError,
  UnsupportedPermitContractError,
  UnsupportedUrbanFabricError,
  validateSnapshotReferences,
} from "./snapshot";

const districtId = (ordinal: number) => `district_${String(ordinal).padStart(8, "0")}`;

/** Minimal but complete nine-district world: the shape a v2 save must carry. */
function validWorld(overrides: { blockedCells?: Array<{ x: number; y: number }> } = {}) {
  const districts = Array.from({ length: 9 }, (_, index) => ({
    district: {
      id: districtId(index + 1),
      name: `Distrito ${index + 1}`,
      width: 64 as const,
      height: 64 as const,
      generation: { profileId: "perfil_de_prueba", generatorVersion: 1, seed: index + 1 },
    },
    map: {
      width: 64 as const,
      height: 64 as const,
      blockedCells: index === 0 ? (overrides.blockedCells ?? [{ x: 0, y: 0 }]) : [],
      roads: { topologyVersion: 1 as const, derivationVersion: 2 as const, segments: [] },
    },
    blocks: [],
    publicSpaces: [],
  }));

  const gateways: Array<Record<string, unknown>> = [];
  const connections: Array<Record<string, unknown>> = [];
  for (let slotY = 0; slotY < 3; slotY += 1) {
    for (let slotX = 0; slotX < 3; slotX += 1) {
      const ordinal = slotY * 3 + slotX + 1;
      if (slotX + 1 < 3) {
        const id = `gateway_${(ordinal * 16).toString(16).padStart(8, "0")}`;
        gateways.push({
          id,
          districtIds: [districtId(ordinal), districtId(ordinal + 1)],
          sides: ["east", "west"],
          cells: [
            { x: 63, y: 32 },
            { x: 0, y: 32 },
          ],
          roadSegmentIds: [],
        });
        connections.push({
          id: `connection_${(ordinal * 16).toString(16).padStart(8, "0")}`,
          gatewayId: id,
          fromDistrictId: districtId(ordinal),
          toDistrictId: districtId(ordinal + 1),
          cost: 4,
        });
      }
      if (slotY + 1 < 3) {
        const id = `gateway_${(ordinal * 16 + 1).toString(16).padStart(8, "0")}`;
        gateways.push({
          id,
          districtIds: [districtId(ordinal), districtId(ordinal + 3)],
          sides: ["south", "north"],
          cells: [
            { x: 32, y: 63 },
            { x: 32, y: 0 },
          ],
          roadSegmentIds: [],
        });
        connections.push({
          id: `connection_${(ordinal * 16 + 1).toString(16).padStart(8, "0")}`,
          gatewayId: id,
          fromDistrictId: districtId(ordinal),
          toDistrictId: districtId(ordinal + 3),
          cost: 4,
        });
      }
    }
  }

  return {
    city: {
      id: "city_00000001",
      name: "Ciudad de prueba",
      municipalityOrganizationId: "org_00000004",
      layout: { columns: 3 as const, rows: 3 as const },
      districtIds: Array.from({ length: 9 }, (_, index) => districtId(index + 1)),
      connections,
      generation: { profileId: "ciudad_de_prueba_v1", generatorVersion: 1, seed: 1 },
    },
    gateways,
    districts,
  };
}

function validSnapshot() {
  return {
    schemaVersion: 2,
    engineVersion: "gate1-dev",
    seed: 1,
    tick: 0,
    prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3, 4] },
    idCounters: { structure: 1, agent: 1, event: 0, commandOrder: 0 },
    world: validWorld(),
    playerIdentities: [{ id: "player_00000001", personId: "person_00000001" }],
    persons: [{ id: "person_00000001" }],
    organizations: [
      { id: "org_00000001", kind: "company" },
      { id: "org_00000004", kind: "municipality" },
    ],
    controlGrants: [{ personId: "person_00000001", organizationId: "org_00000001" }],
    agents: [
      {
        id: "agent_00000001",
        districtId: districtId(1),
        cell: { x: 1, y: 1 },
        target: { x: 2, y: 2 },
        path: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      },
    ],
    structures: [
      {
        id: "structure_00000001",
        ownerOrganizationId: "org_00000001",
        districtId: districtId(1),
        cell: { x: 3, y: 3 },
      },
    ],
    processedCommandIds: ["command-1"],
    pendingCommands: [],
  };
}

describe("snapshot v2", () => {
  it("parses a valid fixture and validates references", () => {
    const parsed = parseSnapshotV2(validSnapshot());
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.world.districts).toHaveLength(9);
    expect(parsed.world.gateways).toHaveLength(12);
    expect(validateSnapshotReferences(parsed)).toEqual([]);
  });

  it("rejects a v1 save by name instead of by schema diff", () => {
    expect(() => parseSnapshotV2({ ...validSnapshot(), schemaVersion: 1 })).toThrowError(
      UnsupportedSnapshotVersionError,
    );
    expect(() => parseSnapshotV2({ ...validSnapshot(), schemaVersion: 1 })).toThrowError(
      /UNSUPPORTED_SNAPSHOT_VERSION/,
    );
  });

  it("rejects invalid PRNG shape and duplicate structure cells", () => {
    expect(() =>
      snapshotV2Schema.parse({
        ...validSnapshot(),
        prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3] },
      }),
    ).toThrow();
    expect(
      validateSnapshotReferences({
        ...validSnapshot(),
        structures: [
          {
            id: "structure_00000001",
            ownerOrganizationId: "org_00000001",
            districtId: districtId(1),
            cell: { x: 3, y: 3 },
          },
          {
            id: "structure_00000002",
            ownerOrganizationId: "org_00000001",
            districtId: districtId(1),
            cell: { x: 3, y: 3 },
          },
        ],
      } as never),
    ).toContainEqual({ code: "DUPLICATE_CELL", path: "world/structures" });
  });

  it("flags an agent or a parcel that points at a district the city does not have", () => {
    const issues = validateSnapshotReferences({
      ...validSnapshot(),
      agents: [
        {
          id: "agent_00000001",
          districtId: districtId(99),
          cell: { x: 1, y: 1 },
          target: { x: 2, y: 2 },
          path: [],
        },
      ],
    } as never);
    expect(issues).toContainEqual({
      code: "MISSING_REFERENCE",
      path: `world/agents/agent_00000001`,
    });
  });

  it("rejects a pre-V.d.1 v2 save by name, leaving the slot untouched", () => {
    const legacyRoads = validSnapshot();
    (
      legacyRoads.world.districts[0]!.map.roads as unknown as { derivationVersion: number }
    ).derivationVersion = 1;
    expect(() => parseSnapshotV2(legacyRoads)).toThrow(UnsupportedUrbanFabricError);
    expect(() =>
      parseSnapshotV2({
        schemaVersion: 2,
        world: { districts: [{ map: { roads: { derivationVersion: 2 } } }] },
        phase2: {
          parcels: [
            { id: "parcel_00000001", districtId: "district_00000001", cell: { x: 1, y: 1 } },
          ],
        },
      }),
    ).toThrow(UnsupportedUrbanFabricError);
  });

  it("rejects a permit ledger without PermitId instead of inventing one", () => {
    const legacyPermits = {
      ...validSnapshot(),
      phase2: {
        permitting: {
          validityTicks: 216_000,
          approvalChanceByRole: {},
          permitsByParcelId: {
            parcel_00000001: { parcelId: "parcel_00000001", status: "approved" },
          },
        },
      },
    };
    expect(() => parseSnapshotV2(legacyPermits)).toThrow(UnsupportedPermitContractError);

    /** Un expediente sin permisos no dispara el rechazo: lo que se rechaza es la forma antigua. */
    const modernLedger = {
      ...validSnapshot(),
      phase2: { permitting: { validityTicks: 216_000, approvalChanceByRole: {}, permitsById: {} } },
    };
    expect(() => parseSnapshotV2(modernLedger)).not.toThrow(UnsupportedPermitContractError);
  });

  it("rejects broken entity references before hydration", () => {
    expect(() =>
      parseSnapshotV2({
        ...validSnapshot(),
        structures: [
          {
            id: "structure_00000001",
            ownerOrganizationId: "org_00000002",
            districtId: districtId(1),
            cell: { x: 3, y: 3 },
          },
        ],
      }),
    ).toThrow(/ownerOrganizationId/);
  });

  it("validates the canonical road-segment order per district, including the destination", () => {
    const longer = {
      class: "street" as const,
      from: { x: 1, y: 1 },
      to: { x: 1, y: 3 },
    };
    const shorter = { ...longer, to: { x: 1, y: 2 } };
    const world = validWorld();
    world.districts[0]!.map.roads.segments = [
      { ...longer, id: roadSegmentId(longer.class, longer.from, longer.to) },
      { ...shorter, id: roadSegmentId(shorter.class, shorter.from, shorter.to) },
    ] as never;
    const snapshot = { ...validSnapshot(), world };
    expect(validateSnapshotReferences(snapshot as never)).toContainEqual({
      code: "DUPLICATE_ORDER",
      path: `world/districts/${districtId(1)}/roads/segments`,
    });
  });
});
