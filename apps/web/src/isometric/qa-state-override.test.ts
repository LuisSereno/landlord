import { describe, expect, it } from "vitest";
import { applyQaStateOverride, buildingAssetStateFor } from "./building-sprites";

const economy = {
  buildings: [
    {
      id: "b1",
      type: "row_house",
      state: "operational",
      condition: 100,
      orientation: 0,
      footprintCells: [{ x: 0, y: 0 }],
      parcelIds: ["p1"],
    },
  ],
  constructionSites: [] as Array<Record<string, unknown>>,
};

describe("V.j.8 override QA de estado (sólo presentación)", () => {
  it("complete no muta", () => {
    expect(applyQaStateOverride(economy, "complete")).toBe(economy);
  });
  it("damaged fuerza condition<60 => asset damaged", () => {
    const r = applyQaStateOverride(economy, "damaged");
    const b = r.buildings[0]!;
    expect(buildingAssetStateFor(b.state as never, b.condition as number)).toBe("damaged");
  });
  it("burning => asset burning", () => {
    const r = applyQaStateOverride(economy, "burning");
    expect(buildingAssetStateFor(r.buildings[0]!.state as never, 100)).toBe("burning");
  });
  it("construction convierte edificios en obras", () => {
    const r = applyQaStateOverride(economy, "construction");
    expect(r.buildings).toHaveLength(0);
    expect(r.constructionSites).toHaveLength(1);
    expect(r.constructionSites[0]!.buildingType).toBe("row_house");
  });
  it("construction conserva variante, dueño y accesos de una sede", () => {
    const hq = {
      buildings: [
        {
          id: "hq1",
          type: "headquarters",
          orientation: 270,
          footprintCells: [{ x: 4, y: 4 }],
          parcelIds: ["p1", "p2"],
          districtId: "district_1",
          ownerOrganizationId: "org_rival",
          headquartersVariantId: "courtyard",
          headquartersAccess: { main: { x: 4, y: 3 }, service: { x: 5, y: 5 } },
          siteCells: [{ x: 3, y: 3 }],
        },
      ],
      constructionSites: [] as Array<Record<string, unknown>>,
    };
    const site = applyQaStateOverride(hq, "construction").constructionSites[0]!;
    expect(site).toMatchObject({
      buildingType: "headquarters",
      orientation: 270,
      parcelIds: ["p1", "p2"],
      ownerOrganizationId: "org_rival",
      headquartersVariantId: "courtyard",
      headquartersAccess: { main: { x: 4, y: 3 }, service: { x: 5, y: 5 } },
    });
  });
  it("no muta el economy original", () => {
    applyQaStateOverride(economy, "burning");
    expect(economy.buildings[0]!.state).toBe("operational");
  });
});
