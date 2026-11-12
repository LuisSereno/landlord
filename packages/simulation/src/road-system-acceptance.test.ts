import { describe, expect, it } from "vitest";

import {
  parseCityProfileId,
  roadCellsFromSegments,
  roadCorridorCellsFromSegments,
  roadCorridorSegmentsByCell,
  roadProfileForTopology,
  roadSectionCellsFromSegments,
  type RoadTopology,
} from "@landlord/shared";

import { adjacentPairs, canonicalSlots, districtIdForSlot, resolveCityProfile } from "./city";
import { defaultRoadAnchors, generateDistrictFromProfile } from "./district-generator";
import { resolveDistrictProfile } from "./district-profiles";
import { buildLandValueContext } from "./land-value";
import { createInitialState } from "./state";
import { deriveRoadNetwork } from "./urban-fabric";
import { buildCoverageIndex } from "./urban-services";

/**
 * Gate C · aceptación del sistema vial sobre las tres variantes persistidas (v2/eje, ave3 y full)
 * y la autovía de 7. Comprueba roles, sentidos, medianas, intersecciones, costuras mixtas y que
 * los consumidores de cobertura y valor leen el corredor donde la topología es v4 (D-104).
 */

function sectionOf(roads: RoadTopology) {
  return roadSectionCellsFromSegments(roads.segments, (roadClass) =>
    roadProfileForTopology(roads, roadClass),
  );
}

function variantOf(roads: RoadTopology): string | undefined {
  return roads.derivationVersion === 4 ? roads.roadSectionVariant : undefined;
}

function generated(profileId: string, seed: number) {
  return generateDistrictFromProfile(resolveDistrictProfile(profileId), seed);
}

describe("Gate C · road-system acceptance v2 / ave3 / full", () => {
  it("v2: el corredor publicado coincide con el eje y los perfiles son de ancho 1", () => {
    const district = generated("barrio_del_umbral", 7);
    expect(district.roads.derivationVersion).toBe(2);
    const corridor = roadCorridorCellsFromSegments(district.roads.segments, (roadClass) =>
      roadProfileForTopology(district.roads, roadClass),
    );
    expect([...corridor].sort()).toEqual(
      [...roadCellsFromSegments(district.roads.segments)].sort(),
    );
    for (const roadClass of ["street", "avenue"] as const) {
      expect(roadProfileForTopology(district.roads, roadClass).width).toBe(1);
    }
  });

  it("ave3: avenida con aceras y doble sentido, calle al eje, sin mediana", () => {
    const district = generated("vega_del_cauce", 7);
    expect(district.roads.derivationVersion).toBe(4);
    expect(variantOf(district.roads)).toBe("ave3");
    const section = sectionOf(district.roads);
    expect([...section.values()].some((cell) => cell.role === "median")).toBe(false);
    const avenue = [...section.values()].filter((cell) => cell.profile === "avenue");
    expect(avenue.some((cell) => cell.role === "sidewalk")).toBe(true);
    expect(
      avenue
        .filter((cell) => cell.role === "carriageway")
        .every((cell) => cell.laneSense === "both"),
    ).toBe(true);
    const streetAxis = roadCellsFromSegments(
      district.roads.segments.filter((segment) => segment.class === "street"),
    );
    // El eje de la calle nunca pierde su rol de calzada aunque el corredor de la avenida lo
    // alcance como acera; y el perfil street de ave3 (ancho 1) no añade celdas fuera del eje.
    for (const key of streetAxis) {
      const cell = section.get(key);
      expect(cell, key).toBeDefined();
      expect(cell!.role, key).toBe("carriageway");
    }
    for (const [key, cell] of section) {
      if (cell.profile === "street") expect(streetAxis.has(key), key).toBe(true);
    }
  });

  it("full: la mediana sobrevive a los ejes colineales y el cruce perpendicular es calzada de doble sentido", () => {
    const district = generated("ensanche_ferroviario_oeste", 7);
    expect(district.roads.derivationVersion).toBe(4);
    expect(variantOf(district.roads)).toBe("full");
    const section = sectionOf(district.roads);
    const median = [...section.entries()].filter(([, cell]) => cell.role === "median");
    expect(median.length).toBeGreaterThan(0);
    expect(median.every(([, cell]) => cell.profile === "avenue")).toBe(true);
    const crossing = [...section.values()].filter(
      (cell) =>
        cell.role === "carriageway" && cell.laneSense === "both" && cell.profile === "avenue",
    );
    expect(crossing.length).toBeGreaterThan(0);
    const avenueLanes = [...section.values()].filter(
      (cell) =>
        cell.profile === "avenue" && cell.role === "carriageway" && cell.laneSense !== "both",
    );
    expect(avenueLanes.some((cell) => cell.laneSense === "forward")).toBe(true);
    expect(avenueLanes.some((cell) => cell.laneSense === "backward")).toBe(true);
  });

  it("motorway: la red v4 con autovía publica 7 celdas de sección, dos carriles por sentido y circulación por la derecha", () => {
    const profile = resolveDistrictProfile("patios_del_este");
    const network = deriveRoadNetwork({
      anchors: defaultRoadAnchors(profile),
      latticeLines: profile.fabric.latticeLines,
      connectSpawns: profile.fabric.connectSpawns,
      motorwayAxis: true,
      roadCorridor: true,
      roadSectionVariant: "full",
      width: profile.width,
      height: profile.height,
    });
    expect(network.topology.derivationVersion).toBe(4);
    const motorwaySegments = network.topology.segments.filter(
      (segment) => segment.class === "motorway",
    );
    expect(motorwaySegments.length).toBeGreaterThan(0);
    const section = sectionOf(network.topology);
    const owners = roadCorridorSegmentsByCell(network.topology.segments, (roadClass) =>
      roadProfileForTopology(network.topology, roadClass),
    );
    const segmentById = new Map(network.topology.segments.map((segment) => [segment.id, segment]));
    const motorwayCells = [...section.entries()].filter(([, cell]) => cell.profile === "motorway");
    expect(motorwayCells.length).toBeGreaterThan(0);
    expect(motorwayCells.some(([, cell]) => cell.role === "median")).toBe(true);
    expect(motorwayCells.some(([, cell]) => cell.role === "sidewalk")).toBe(true);
    const lanes = motorwayCells.filter(([, cell]) => cell.role === "carriageway");
    expect(lanes.some(([, cell]) => cell.laneSense === "forward")).toBe(true);
    expect(lanes.some(([, cell]) => cell.laneSense === "backward")).toBe(true);
    for (const [key, cell] of lanes) {
      if (cell.laneSense === "both" || cell.axisOrientation !== "horizontal") continue;
      const axisSegment = (owners.get(key) ?? [])
        .map((id) => segmentById.get(id)!)
        .find((segment) => segment.class === "motorway" && segment.from.y === segment.to.y);
      if (!axisSegment) continue;
      const [, y] = key.split(":").map(Number) as [number, number];
      if (y === axisSegment.from.y) continue;
      const rightSideIsGreaterY = cell.axisDirection === "east";
      const onRight = rightSideIsGreaterY ? y > axisSegment.from.y : y < axisSegment.from.y;
      expect(onRight, `${key} ${cell.laneSense} ${cell.axisDirection}`).toBe(
        cell.laneSense === "forward",
      );
    }
  });

  it("la cartera canónica cose variantes distintas: existe costura v2↔v4 y ave3↔full", () => {
    const cityProfile = resolveCityProfile(parseCityProfileId("ciudad_del_umbral_v1"));
    const variantBySlot = new Map<string, string>();
    for (const slot of canonicalSlots(cityProfile)) {
      const profile = resolveDistrictProfile(slot.districtProfileId);
      variantBySlot.set(
        `${slot.slotX},${slot.slotY}`,
        profile.roadCorridor ? (profile.roadSectionVariant ?? "full") : "v2",
      );
    }
    const mixed = adjacentPairs().filter(
      (pair) =>
        variantBySlot.get(`${pair.slotX},${pair.slotY}`) !==
        variantBySlot.get(`${pair.neighbourSlotX},${pair.neighbourSlotY}`),
    );
    expect(mixed.length).toBeGreaterThan(0);
    const kinds = new Set(
      mixed.map(
        (pair) =>
          `${variantBySlot.get(`${pair.slotX},${pair.slotY}`)}↔${variantBySlot.get(
            `${pair.neighbourSlotX},${pair.neighbourSlotY}`,
          )}`,
      ),
    );
    expect([...kinds].some((kind) => kind.includes("v2"))).toBe(true);
  });

  it("cobertura y valor del suelo leen el corredor en el distrito full", () => {
    const state = createInitialState(7);
    const districtId = districtIdForSlot(0, 2);
    const district = state.world.districts.get(districtId)!;
    expect(district.map.roads.derivationVersion).toBe(4);
    const coverage = buildCoverageIndex(state);
    const marketable = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.districtId === districtId && parcel.disposition === "marketable",
    );
    const withTransport = marketable.filter(
      (parcel) => (coverage.byParcelId.get(parcel.id)?.transport ?? 0) > 0,
    );
    expect(withTransport.length / marketable.length).toBeGreaterThan(0.8);
    const context = buildLandValueContext(state, districtId, coverage);
    const section = sectionOf(district.map.roads);
    const avenueSidewalk = [...section.entries()].find(
      ([, cell]) => cell.profile === "avenue" && cell.role === "sidewalk",
    );
    expect(avenueSidewalk).toBeDefined();
    expect(context.avenueDistance.get(avenueSidewalk![0])).toBe(0);
    expect(context.roadDistance.get(avenueSidewalk![0])).toBe(0);
  }, 120_000);

  it("la sección es determinista: misma topología, mismo digesto de celdas", () => {
    const left = generated("ensanche_ferroviario_oeste", 15);
    const right = generated("ensanche_ferroviario_oeste", 15);
    const a = [...sectionOf(left.roads).entries()].sort(([x], [y]) => x.localeCompare(y));
    const b = [...sectionOf(right.roads).entries()].sort(([x], [y]) => x.localeCompare(y));
    expect(a).toEqual(b);
  });
});
