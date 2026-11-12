import { describe, expect, it } from "vitest";

import {
  buildRoadSectionChannel,
  roadCellsFromSegments,
  roadSectionDigest,
  type ViewProjectionV2,
} from "@landlord/shared";
import { applyQaRoadOverride, isQaRoadFixture } from "./road-qa-override";

function baseProjection(): ViewProjectionV2 {
  const channel = buildRoadSectionChannel({
    topologyVersion: 1,
    derivationVersion: 2,
    segments: [{ id: "a", from: { x: 0, y: 0 }, to: { x: 63, y: 0 }, class: "street" }],
  });
  return {
    map: {
      width: 64,
      height: 64,
      roads: { revision: 0, digest: "00000000", cells: ["0:0"] },
      roadSection: { revision: 0, digest: roadSectionDigest(channel), ...channel },
    },
  } as unknown as ViewProjectionV2;
}

describe("Gate D · override QA de sección vial (sólo presentación)", () => {
  it("isQaRoadFixture acepta motorway y rechaza el resto", () => {
    expect(isQaRoadFixture("motorway")).toBe(true);
    expect(isQaRoadFixture("avenue")).toBe(false);
    expect(isQaRoadFixture(null)).toBe(false);
  });

  it("el override publica el perfil motorway de 7 con dos carriles por sentido", () => {
    const overridden = applyQaRoadOverride(baseProjection(), "motorway");
    const motorway = overridden.map.roadSection.profiles.find((p) => p.id === "motorway");
    expect(motorway?.width).toBe(7);
    expect(motorway?.laneSenses.filter((s) => s === "forward")).toHaveLength(2);
    expect(motorway?.laneSenses.filter((s) => s === "backward")).toHaveLength(2);
    expect(overridden.map.roadSection.segments.some((s) => s.profile === "motorway")).toBe(true);
  });

  it("no muta la proyección original y es determinista", () => {
    const base = baseProjection();
    const before = JSON.stringify(base);
    const a = applyQaRoadOverride(base, "motorway");
    const b = applyQaRoadOverride(base, "motorway");
    expect(JSON.stringify(base)).toBe(before);
    expect(a.map.roadSection.digest).toBe(b.map.roadSection.digest);
    expect(a.map.roads.digest).toBe(b.map.roads.digest);
  });

  it("el eje publicado coincide con roadCellsFromSegments de los segmentos del override", () => {
    const overridden = applyQaRoadOverride(baseProjection(), "motorway");
    const segments = overridden.map.roadSection.segments.map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      class: s.profile,
    }));
    const expected = [...roadCellsFromSegments(segments)].sort((a, b) => {
      const [ax, ay] = a.split(":").map(Number) as [number, number];
      const [bx, by] = b.split(":").map(Number) as [number, number];
      return ay - by || ax - bx;
    });
    expect(overridden.map.roads.cells).toEqual(expected);
  });
});
