import { describe, expect, it } from "vitest";

import { indexAssetStatus } from "./asset-status";
import { parcelOverlayColor } from "./overlay-color";
import { MAP_COLORS, OVERLAY_OPTIONS, STATUS_COLORS, type MapOverlay } from "./overlay-catalog";
import { PLAYER, RIVAL, building, contract, economy, loan, parcel } from "./status-fixtures";

function color(
  overlay: MapOverlay,
  e: ReturnType<typeof economy>,
  target = e.parcels[0] ?? parcel(),
): number {
  return parcelOverlayColor(overlay as Exclude<MapOverlay, "none">, {
    parcel: target,
    economy: e,
    index: indexAssetStatus(e),
  });
}

describe("V.d-UX.S · color de capas (helper puro extraído de la escena)", () => {
  it("toda capa declarada resuelve un color: no hay fallback silencioso a propiedad", () => {
    const e = economy({ parcels: [parcel()], buildings: [building()] });
    for (const option of OVERLAY_OPTIONS) {
      if (option.value === "none") continue;
      const value = color(option.value, e);
      expect(typeof value, option.value).toBe("number");
      expect(Number.isFinite(value), option.value).toBe(true);
    }
  });

  it("conserva las bandas de las capas existentes", () => {
    const at = (condition: number) =>
      color("condition", economy({ parcels: [parcel()], buildings: [building({ condition })] }));
    expect(at(35)).toBe(MAP_COLORS.fire);
    expect(at(70)).toBe(MAP_COLORS.construction);
    expect(at(71)).toBe(MAP_COLORS.parcelPlayer);
    expect(color("condition", economy({ parcels: [parcel()] }))).toBe(MAP_COLORS.parcelAvailable);

    const risk = (percent: number) =>
      color("risk", economy({ parcels: [parcel({ regulatoryRiskPercent: percent })] }));
    expect(risk(30)).toBe(MAP_COLORS.fire);
    expect(risk(15)).toBe(MAP_COLORS.construction);
    expect(risk(14)).toBe(MAP_COLORS.parcelPlayer);

    const value = (score: number) =>
      color("landValue", economy({ parcels: [parcel({ landValueBreakdown: { score } })] }));
    expect(value(25)).toBe(MAP_COLORS.parcelPlayer);
    expect(value(5)).toBe(MAP_COLORS.construction);
    expect(value(-10)).toBe(MAP_COLORS.parcelAvailable);
    expect(value(-11)).toBe(MAP_COLORS.fire);
  });

  it("H2-05 · un solar vacío usa la cobertura potencial, no la activa", () => {
    const vacant = economy({
      parcels: [parcel({ serviceCoverage: { security: 0 }, potentialService: { security: 90 } })],
    });
    expect(color("security", vacant)).toBe(MAP_COLORS.parcelPlayer);
    const built = economy({
      parcels: [parcel({ serviceCoverage: { security: 0 }, potentialService: { security: 90 } })],
      buildings: [building()],
    });
    expect(color("security", built)).toBe(MAP_COLORS.fire);
  });

  it("H2-01 · la capa de condición enseña el peor edificio de la parcela, no el primero", () => {
    const e = economy({
      parcels: [parcel()],
      buildings: [building({ condition: 100 }), building({ id: "building_00000002", condition: 20 })],
    });
    expect(color("condition", e)).toBe(MAP_COLORS.fire);
  });

  it("cargas: cada estado vivo tiene su tono y lo ajeno queda en «sin datos»", () => {
    const withLoan = (status: string) =>
      color(
        "encumbrances",
        economy({ parcels: [parcel()], banking: { offers: [], loans: [loan({ status })], auctions: [] } }),
      );
    expect(withLoan("active")).toBe(STATUS_COLORS.lien);
    expect(withLoan("delinquent")).toBe(STATUS_COLORS.arrears);
    expect(withLoan("defaulted")).toBe(STATUS_COLORS.loss);
    expect(withLoan("paid_off")).toBe(STATUS_COLORS.occupied);
    expect(color("encumbrances", economy({ parcels: [parcel({ ownerOrganizationId: RIVAL })] }))).toBe(
      STATUS_COLORS.unknown,
    );
  });

  it("ocupación: peor caso conocido, producción aparte y rival nunca «vacío»", () => {
    const mixed = economy({
      parcels: [parcel()],
      buildings: [
        building({ tenantIds: ["t1", "t2"] }),
        building({ id: "building_00000002", tenantIds: [] }),
      ],
    });
    expect(color("occupancy", mixed)).toBe(STATUS_COLORS.vacancy);
    const partial = economy({
      parcels: [parcel()],
      buildings: [building({ tenantIds: ["t1"] })],
    });
    expect(color("occupancy", partial)).toBe(STATUS_COLORS.partial);
    const production = economy({
      parcels: [parcel()],
      buildings: [building({ type: "cement_plant" })],
      production: [{ buildingId: "building_00000001" }],
    });
    expect(color("occupancy", production)).toBe(STATUS_COLORS.upkeep);
    const rival = economy({
      parcels: [parcel()],
      buildings: [building({ ownerOrganizationId: RIVAL, tenantIds: [] })],
    });
    expect(color("occupancy", rival)).toBe(STATUS_COLORS.unknown);
    expect(color("occupancy", economy({ parcels: [parcel()] }))).toBe(STATUS_COLORS.neutral);
  });

  it("seguro: una póliza vencida pesa más que un edificio sin seguro", () => {
    const e = economy({
      parcels: [parcel()],
      buildings: [building(), building({ id: "building_00000002" })],
      insurance: {
        offers: [],
        claims: [],
        contracts: [
          contract({ buildingId: "building_00000001", status: "active" }),
          contract({ buildingId: "building_00000002", status: "lapsed" }),
        ],
      },
    });
    expect(color("insurance", e)).toBe(STATUS_COLORS.arrears);
    const none = economy({
      parcels: [parcel()],
      buildings: [building({ ownerOrganizationId: PLAYER })],
    });
    expect(color("insurance", none)).toBe(STATUS_COLORS.uninsured);
    const rival = economy({
      parcels: [parcel()],
      buildings: [building({ ownerOrganizationId: RIVAL })],
    });
    expect(color("insurance", rival)).toBe(STATUS_COLORS.unknown);
  });
});