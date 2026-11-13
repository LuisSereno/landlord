import {
  buildRoadSectionChannel,
  roadCellsDigest,
  roadCellsFromSegments,
  roadSectionDigest,
  roadSegmentId,
  type RoadSegment,
  type RoadTopology,
  type ViewProjectionV2,
} from "@landlord/shared";

/**
 * Gate D · fixture QA de presentación (precedente V.j.8 `applyQaStateOverride`). El mundo canónico
 * ratificado (V.l.5c) no tiene autovías activas, así que la app real no puede mostrar una motorway.
 * Este override sustituye SÓLO el canal vial de la proyección observada por una topología sintética
 * con autovía de 7, derivada con las mismas funciones shared que usa el worker. No toca GameState,
 * no decide reglas y se etiqueta en pantalla; existe para validar el pintado de la sección.
 */
export const QA_ROAD_FIXTURES = ["motorway"] as const;
export type QaRoadFixture = (typeof QA_ROAD_FIXTURES)[number];

export function isQaRoadFixture(value: string | null): value is QaRoadFixture {
  return (QA_ROAD_FIXTURES as readonly string[]).includes(value ?? "");
}

function motorwayTopology(): RoadTopology {
  const segments: RoadSegment[] = [
    {
      id: roadSegmentId("motorway", { x: 0, y: 32 }, { x: 63, y: 32 }),
      from: { x: 0, y: 32 },
      to: { x: 63, y: 32 },
      class: "motorway",
    },
    {
      id: roadSegmentId("motorway", { x: 32, y: 0 }, { x: 32, y: 63 }),
      from: { x: 32, y: 0 },
      to: { x: 32, y: 63 },
      class: "motorway",
    },
    {
      id: roadSegmentId("avenue", { x: 0, y: 16 }, { x: 63, y: 16 }),
      from: { x: 0, y: 16 },
      to: { x: 63, y: 16 },
      class: "avenue",
    },
    {
      id: roadSegmentId("street", { x: 48, y: 0 }, { x: 48, y: 63 }),
      from: { x: 48, y: 0 },
      to: { x: 48, y: 63 },
      class: "street",
    },
  ];
  return { topologyVersion: 1, derivationVersion: 4, roadSectionVariant: "full", segments };
}

/** Override puro y determinista del canal vial; el resto de la proyección queda intacto. */
export function applyQaRoadOverride(
  projection: ViewProjectionV2,
  fixture: QaRoadFixture,
): ViewProjectionV2 {
  if (fixture !== "motorway") return projection;
  const topology = motorwayTopology();
  const cells = [...roadCellsFromSegments(topology.segments)].sort((left, right) => {
    const [leftX, leftY] = left.split(":").map(Number) as [number, number];
    const [rightX, rightY] = right.split(":").map(Number) as [number, number];
    return leftY - rightY || leftX - rightX;
  });
  const channel = buildRoadSectionChannel(topology);
  return {
    ...projection,
    map: {
      ...projection.map,
      roads: {
        revision: projection.map.roads.revision,
        digest: roadCellsDigest(cells),
        cells,
      },
      roadSection: {
        revision: projection.map.roadSection.revision,
        digest: roadSectionDigest(channel),
        profiles: channel.profiles,
        segments: channel.segments,
      },
    },
  };
}
