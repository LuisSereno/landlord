import { describe, expect, it } from "vitest";

import { indexAssetStatus } from "../ui/asset-status";
import { RIVAL, building, economy } from "../ui/status-fixtures";
import { signageAnchorFor, type SignagePlanInput } from "./building-signage";
import { facadeMarkAnchor, facadeMarkPlan, reconcileFacadeMarks } from "./building-marks";

const placement = (overrides: Partial<SignagePlanInput> = {}): SignagePlanInput => ({
  id: "building:building_00000001",
  entityKind: "building",
  domainType: "town_hall",
  assetState: "complete",
  orientation: 0,
  ...overrides,
});

describe("V.d-UX.S · marca de mejora en fachada", () => {
  it("sólo los edificios terminados y mejorados la llevan, sea cual sea el propietario", () => {
    const e = economy({
      buildings: [
        building({ id: "building_00000001", upgraded: true }),
        building({ id: "building_00000002", upgraded: false }),
        building({ id: "building_00000003", upgraded: true, ownerOrganizationId: RIVAL }),
      ],
    });
    const plan = facadeMarkPlan(
      [
        placement(),
        placement({ id: "building:building_00000002" }),
        placement({ id: "building:building_00000003" }),
      ],
      e,
      indexAssetStatus(e),
    );
    expect(plan.map((entry) => entry.buildingId)).toEqual([
      "building_00000001",
      "building_00000003",
    ]);
  });

  it("una obra, un dañado o un ardiendo no rotulan mejora", () => {
    const e = economy({ buildings: [building({ upgraded: true })] });
    for (const assetState of ["construction", "damaged", "burning"] as const) {
      expect(
        facadeMarkPlan([placement({ assetState })], e, indexAssetStatus(e)),
        assetState,
      ).toEqual([]);
    }
    expect(
      facadeMarkPlan([placement({ entityKind: "construction" })], e, indexAssetStatus(e)),
    ).toEqual([]);
  });

  it("el anclaje hereda el espejo de 180° y no se solapa con el rótulo", () => {
    for (const type of ["town_hall", "clinic", "cement_plant", "courtyard_home"]) {
      for (const orientation of [0, 90, 180, 270] as const) {
        const signage = signageAnchorFor(type, orientation);
        const mark = facadeMarkAnchor(type, orientation);
        expect(mark.y, `${type}@${orientation}`).toBeLessThan(signage.y);
        expect(mark.y).toBeGreaterThanOrEqual(0.05);
        expect(mark.y).toBeLessThanOrEqual(0.95);
        expect(mark.x).toBe(signage.x);
      }
    }
    expect(facadeMarkAnchor("town_hall", 180).x).toBe(1 - signageAnchorFor("town_hall", 0).x);
  });

  it("la reconciliación es idempotente y el plan tiene una entrada por edificio elegible", () => {
    const e = economy({
      buildings: [
        building({ id: "building_00000001", upgraded: true }),
        building({ id: "building_00000002", upgraded: true }),
      ],
    });
    const plan = facadeMarkPlan(
      [placement(), placement({ id: "building:building_00000002" })],
      e,
      indexAssetStatus(e),
    );
    expect(plan).toHaveLength(2);
    expect(new Set(plan.map((entry) => entry.id)).size).toBe(2);
    const first = reconcileFacadeMarks(new Map(), plan);
    expect(first.created).toHaveLength(2);
    const second = reconcileFacadeMarks(first.next, plan);
    expect(second.created).toEqual([]);
    expect(second.removed).toEqual([]);
    expect(reconcileFacadeMarks(second.next, []).removed).toHaveLength(2);
  });

  it("sin proyección no hay marcas", () => {
    expect(facadeMarkPlan([placement()], undefined, indexAssetStatus(undefined))).toEqual([]);
  });
});
