import { describe, expect, it } from "vitest";

import {
  parseDistrictId,
  parseParcelId,
  parsePublicSpaceId,
  parseUrbanFacilityId,
  roadCellsFromSegments,
  roadSegmentId,
  type GridCell,
  type UrbanFacility,
} from "@landlord/shared";
import { defaultRoadAnchors, generateDistrict } from "./district-generator";
import { resolveDistrictProfile } from "./district-profiles";
import {
  blockIdForGeometry,
  canonicalCellKeys,
  cellKey,
  connectedComponents,
  deriveRoadNetwork,
  validateUrbanFabric,
} from "./urban-fabric";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import { streetDensityKmPerKm2, intersectionDensityPerKm2 } from "./urban-morphology";

const PROFILE = resolveDistrictProfile("barrio_del_umbral");
const DISTRICT_ID = parseDistrictId("district_00000004");

function generated() {
  return generateDistrict({ seed: 1, profileId: PROFILE.id });
}

function validationInput(district = generated()) {
  return {
    width: 64,
    height: 64,
    config: PROFILE.fabric,
    roads: district.roads,
    blockedCells: new Set(district.blockedCells),
    blocks: district.blocks,
    parcels: district.parcels,
    publicSpaces: district.publicSpaces,
    facilities: [] as UrbanFacility[],
    gatewayCells: [] as GridCell[],
    spawnCells: [district.spawnAnchors.player, district.spawnAnchors.rival],
  };
}

describe("V.d.1 road network from RoadAnchor[]", () => {
  it("derives one orthogonal, connected network from gateways and urban anchors", () => {
    const anchors = defaultRoadAnchors(PROFILE, [
      { id: "gateway_east", kind: "gateway", cell: { x: 63, y: 32 } },
    ]);
    const network = deriveRoadNetwork({
      anchors,
      latticeLines: PROFILE.fabric.latticeLines,
      connectSpawns: PROFILE.fabric.connectSpawns,
      width: 64,
      height: 64,
    });
    expect(network.topology.topologyVersion).toBe(1);
    expect(network.topology.derivationVersion).toBe(2);
    expect(connectedComponents(network.roadCells).length).toBe(1);
    expect(network.roadCells.has("63:32")).toBe(true);
    expect(network.roadCells.has("32:32")).toBe(true);
    for (const segment of network.topology.segments) {
      expect(segment.id).toBe(roadSegmentId(segment.class, segment.from, segment.to));
      expect(segment.from.x === segment.to.x || segment.from.y === segment.to.y).toBe(true);
      expect(segment.from.x).toBeGreaterThanOrEqual(0);
      expect(segment.to.y).toBeLessThan(64);
    }
    expect(network.topology.segments).toEqual(
      deriveRoadNetwork({
        anchors: [...anchors].reverse(),
        latticeLines: PROFILE.fabric.latticeLines,
        connectSpawns: PROFILE.fabric.connectSpawns,
        width: 64,
        height: 64,
      }).topology.segments,
    );
  });

  it("connects spawns only when the recipe asks for it", () => {
    const anchors = defaultRoadAnchors(PROFILE);
    const connected = deriveRoadNetwork({
      anchors,
      latticeLines: 3,
      connectSpawns: true,
      width: 64,
      height: 64,
    });
    const none = deriveRoadNetwork({
      anchors,
      latticeLines: 3,
      connectSpawns: false,
      width: 64,
      height: 64,
    });
    expect(connected.roadCells.size).toBeGreaterThan(none.roadCells.size);
    expect(streetDensityKmPerKm2(connected.topology)).toBeGreaterThan(
      streetDensityKmPerKm2(none.topology),
    );
    expect(intersectionDensityPerKm2(connected.topology)).toBeGreaterThanOrEqual(
      intersectionDensityPerKm2(none.topology),
    );
  });

  it("does not draw roads over parcels: the lattice is derived before any parcel exists", () => {
    const network = deriveRoadNetwork({
      anchors: defaultRoadAnchors(PROFILE),
      latticeLines: 3,
      connectSpawns: true,
      width: 64,
      height: 64,
    });
    const district = generated();
    const parcelCells = new Set(
      district.parcels.flatMap((parcel) => parcel.cells.map((cell) => cellKey(cell))),
    );
    expect([...network.roadCells].filter((key) => parcelCells.has(key))).toEqual([]);
  });
});

describe("V.d.1 flood-fill blocks", () => {
  it("partitions every developable cell into connected blocks separated by roads or obstacles", () => {
    const district = generated();
    const roads = roadCellsFromSegments(district.roads.segments);
    const blocked = new Set(district.blockedCells);
    const publicCells = new Set(
      district.publicSpaces.flatMap((space) => space.cells.map((cell) => cellKey(cell))),
    );
    const blockCells = new Set<string>();
    for (const block of district.blocks) {
      const keys = block.cells.map((cell) => cellKey(cell));
      expect(connectedComponents(new Set(keys)).length).toBe(1);
      expect(keys.filter((key) => roads.has(key) || blocked.has(key))).toEqual([]);
      expect(keys.filter((key) => blockCells.has(key))).toEqual([]);
      for (const key of keys) blockCells.add(key);
    }
    const developable: string[] = [];
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const key = `${x}:${y}`;
        if (!roads.has(key) && !blocked.has(key) && !publicCells.has(key)) developable.push(key);
      }
    }
    expect([...blockCells].sort()).toEqual(developable.sort());
    for (const block of district.blocks) {
      expect(block.urbanRole).toBe(PROFILE.dominantRole);
      expect(block.frontageRoadSegmentIds.length).toBeGreaterThan(0);
    }
  });

  it("derives block ids from canonical geometry, not from cell order", () => {
    const cells = [
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
    ];
    const first = blockIdForGeometry(DISTRICT_ID, cells);
    const second = blockIdForGeometry(DISTRICT_ID, [...cells].reverse());
    expect(second).toBe(first);
    expect(blockIdForGeometry(DISTRICT_ID, [...cells, { x: 4, y: 4 }])).not.toBe(first);
    expect(first).toMatch(/^block_[0-9a-f]{8}$/);
  });

  it("adds deterministic alleys instead of publishing oversized blocks", () => {
    const district = generated();
    const largest = Math.max(...district.blocks.map((block) => block.cells.length));
    expect(largest).toBeLessThanOrEqual(PROFILE.fabric.maxBlockAreaCells);
  });
});

describe("V.d.1 front-first multi-cell parcels", () => {
  it("covers each block with connected, front-facing parcels and canonical ids", () => {
    const district = generated();
    const roads = roadCellsFromSegments(district.roads.segments);
    const roadSegments = new Set(district.roads.segments.map((segment) => segment.id));
    const ids = new Set<string>();
    for (const parcel of district.parcels) {
      const keys = parcel.cells.map((cell) => cellKey(cell));
      expect(connectedComponents(new Set(keys)).length).toBe(1);
      expect(keys).toContain(cellKey(parcel.anchorCell));
      expect(parcel.roadFrontages.length).toBeGreaterThan(0);
      expect(parcel.disposition).toBe("marketable");
      expect(parcel.cells.some((cell) => roads.has(cellKey(cell)))).toBe(false);
      for (const frontage of parcel.roadFrontages) {
        expect(roadSegments.has(frontage.roadSegmentId)).toBe(true);
        expect(frontage.cells.length).toBeGreaterThan(0);
      }
      ids.add(parcel.id);
    }
    expect(ids.size).toBe(district.parcels.length);
    const parcelCells = district.parcels.flatMap((parcel) =>
      parcel.cells.map((cell) => cellKey(cell)),
    );
    expect(new Set(parcelCells).size).toBe(parcelCells.length);
  });

  it("picks the id ordinally from canonical geometry and anchors first", () => {
    const district = generated();
    expect(district.parcels[0]!.id).toBe(parseParcelId("parcel_00000001"));
    expect(district.parcels[0]!.price).toBe(900);
    expect(district.parcels[0]!.zoning).toBe("residential");
    expect(district.report.anchorParcelCount).toBe(PROFILE.anchorSlots.length);
  });
});

describe("V.d.1 structural issues", () => {
  function issuesFor(mutate: (input: ReturnType<typeof validationInput>) => void) {
    const input = validationInput();
    mutate(input);
    return validateUrbanFabric(input);
  }

  it("accepts a generated district with zero issues", () => {
    expect(validateUrbanFabric(validationInput())).toEqual([]);
  });

  it("emits the nine structural issue codes", () => {
    const base = generated();
    const roadCells = roadCellsFromSegments(base.roads.segments);
    const nonRoad = (() => {
      for (let y = 0; y < 64; y += 1) {
        for (let x = 0; x < 64; x += 1) {
          if (!roadCells.has(`${x}:${y}`)) return { x, y };
        }
      }
      throw new Error("sin celda no vial");
    })();

    expect(
      issuesFor((input) => {
        input.parcels = input.parcels.slice(0, -1);
      }).map((issue) => issue.code),
    ).toContain("BLOCK_UNASSIGNED_CELLS");

    expect(
      issuesFor((input) => {
        const block = input.blocks[0]!;
        input.blocks = [
          { ...block, cells: [block.cells[0]!, block.cells[block.cells.length - 1]!] },
          ...input.blocks.slice(1),
        ];
        input.parcels = input.parcels.filter((parcel) => parcel.blockId !== block.id);
      }).map((issue) => issue.code),
    ).toContain("BLOCK_DISCONNECTED");

    expect(
      issuesFor((input) => {
        const parcel = input.parcels.find((entry) => entry.cells.length > 2)!;
        const first = parcel.cells[0]!;
        const far = parcel.cells.find(
          (cell) => Math.abs(cell.x - first.x) + Math.abs(cell.y - first.y) > 1,
        )!;
        input.parcels = input.parcels.map((entry) =>
          entry.id === parcel.id ? { ...entry, cells: [first, far], anchorCell: first } : entry,
        );
      }).map((issue) => issue.code),
    ).toContain("PARCEL_DISCONNECTED");

    expect(
      issuesFor((input) => {
        input.parcels = input.parcels.map((parcel) => ({ ...parcel, roadFrontages: [] }));
      }).map((issue) => issue.code),
    ).toContain("PARCEL_WITHOUT_ROAD_FRONTAGE");

    expect(
      issuesFor((input) => {
        input.config = { ...input.config, parcelFrontageCells: [99, 99] };
      }).map((issue) => issue.code),
    ).toContain("PARCEL_TOO_NARROW");

    expect(
      issuesFor((input) => {
        input.config = { ...input.config, parcelDepthCells: [1, 1] };
      }).map((issue) => issue.code),
    ).toContain("PARCEL_TOO_DEEP");

    expect(
      issuesFor((input) => {
        input.gatewayCells = [nonRoad];
      }).map((issue) => issue.code),
    ).toContain("GATEWAY_NOT_CONNECTED");

    expect(
      issuesFor((input) => {
        const block = input.blocks[0]!;
        input.publicSpaces = [
          {
            id: parsePublicSpaceId("publicspace_00000901"),
            districtId: block.districtId,
            blockId: block.id,
            kind: "plaza",
            cells: [block.cells[0]!, block.cells[block.cells.length - 1]!],
            operatorOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
          },
        ];
      }).map((issue) => issue.code),
    ).toContain("PUBLIC_RESERVATION_INVALID");

    expect(
      issuesFor((input) => {
        input.facilities = [
          {
            id: parseUrbanFacilityId("urbanfacility_00000001"),
            kind: "school",
            districtId: parseDistrictId("district_00000004"),
            parcelIds: [parseParcelId("parcel_99999999")],
            buildingIds: [],
            publicSpaceIds: [],
            operatorOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
            capacity: 1,
            serviceProfileId: "school_service_v1",
          } satisfies UrbanFacility,
        ];
      }).map((issue) => issue.code),
    ).toContain("FACILITY_SITE_INVALID");
  });
});

describe("V.d.1 canonical identities", () => {
  it("uses canonical cell keys for blocks, parcels and public spaces", () => {
    const district = generated();
    for (const block of district.blocks) {
      expect(block.cells.map((cell) => cellKey(cell))).toEqual(canonicalCellKeys(block.cells));
    }
    for (const space of district.publicSpaces) {
      expect(space.cells.map((cell) => cellKey(cell))).toEqual(canonicalCellKeys(space.cells));
    }
  });
});
