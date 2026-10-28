import { describe, expect, it } from "vitest";

import { viewProjectionV2Schema } from "./projection";

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

describe("view projection v1", () => {
  const projection = (cells: string[]) => ({
    projectionVersion: 2,
    ...cityFixture("district_00000001"),
    tick: 2,
    map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells } },
    structures: [
      { id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 1, y: 2 } },
    ],
    agents: [{ id: "agent_00000001", cell: { x: 2, y: 2 } }],
  });

  it("accepts a serializable projection", () => {
    expect(viewProjectionV2Schema.parse(projection(["0:0", "63:63"])).tick).toBe(2);
  });

  it("rejects non-canonical and out-of-bounds projected road cells", () => {
    for (const cell of ["64:0", "0:64", "01:2", "2:01", "-1:2", "2.0:3"]) {
      expect(() => viewProjectionV2Schema.parse(projection([cell])), cell).toThrow();
    }
  });
});
