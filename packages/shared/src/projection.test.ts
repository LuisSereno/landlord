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
        facilities: 0,
        publicSpaces: 0,
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
    movement: { ticksPerCell: 10 },
    map: {
      width: 64,
      height: 64,
      roads: { revision: 0, digest: "811c9dc5", cells },
      roadSection: { revision: 0, digest: "811c9dc5", profiles: [], segments: [] },
    },
    publicSpaces: [],
    facilities: [],
    structures: [
      { id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 1, y: 2 } },
    ],
    agents: [
      {
        id: "agent_00000001",
        districtId: "district_00000001",
        cell: { x: 2, y: 2 },
        nextCell: { x: 3, y: 2 },
      },
    ],
  });

  it("accepts a serializable projection", () => {
    expect(viewProjectionV2Schema.parse(projection(["0:0", "63:63"])).tick).toBe(2);
  });

  it("rejects non-canonical and out-of-bounds projected road cells", () => {
    for (const cell of ["64:0", "0:64", "01:2", "2:01", "-1:2", "2.0:3"]) {
      expect(() => viewProjectionV2Schema.parse(projection([cell])), cell).toThrow();
    }
  });

  /**
   * V.l.3 (D-104) · el canal de sección transversal es contrato estricto: sin él el render no puede
   * pintar por rol, y con un campo de más el worker estaría publicando algo que la UI ignora en
   * silencio. `.strict()` convierte las dos cosas en error.
   */
  it("requires the road section channel and rejects undeclared fields inside it", () => {
    const base = projection(["0:0"]);
    const { roadSection, ...mapWithoutSection } = base.map;
    expect(() => viewProjectionV2Schema.parse({ ...base, map: mapWithoutSection })).toThrow();
    expect(() =>
      viewProjectionV2Schema.parse({
        ...base,
        map: { ...base.map, roadSection: { ...roadSection, lanes: 2 } },
      }),
    ).toThrow();
    expect(() =>
      viewProjectionV2Schema.parse({
        ...base,
        map: {
          ...base.map,
          roadSection: {
            ...roadSection,
            segments: [
              {
                id: "road_00000001",
                from: { x: 0, y: 0 },
                to: { x: 1, y: 0 },
                profile: "street",
                width: 3,
              },
            ],
          },
        },
      }),
    ).toThrow();
    expect(viewProjectionV2Schema.parse(base).map.roadSection).toEqual(roadSection);
  });

  /**
   * V.k.1 · el rumbo y la fase del paseo de una cuadrilla son contrato: si el worker publica un
   * campo que el esquema no conoce, `parse` lo recortaría en silencio y la UI pintaría un agente
   * quieto. `.strict()` en el agente convierte ese recorte en error.
   */
  it("requires the agent movement contract and rejects undeclared agent fields", () => {
    const base = projection(["0:0"]);
    for (const agent of [
      { ...base.agents[0], districtId: undefined },
      { ...base.agents[0], nextCell: undefined },
      { ...base.agents[0], path: [{ x: 4, y: 2 }] },
    ]) {
      expect(() => viewProjectionV2Schema.parse({ ...base, agents: [agent] })).toThrow();
    }
    expect(
      viewProjectionV2Schema.parse({
        ...base,
        agents: [{ ...base.agents[0], nextCell: null }],
      }).agents[0]?.nextCell,
    ).toBeNull();
  });

  it("publishes a positive movement cadence", () => {
    for (const ticksPerCell of [0, -1, 2.5]) {
      expect(() =>
        viewProjectionV2Schema.parse({ ...projection(["0:0"]), movement: { ticksPerCell } }),
      ).toThrow();
    }
  });
});
