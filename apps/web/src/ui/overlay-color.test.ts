import { describe, expect, it } from "vitest";

import { indexAssetStatus } from "./asset-status";
import { parcelOverlayColor } from "./overlay-color";
import {
  MAP_COLORS,
  OVERLAY_OPTIONS,
  STATUS_COLORS,
  cssColor,
  overlayOption,
  type MapOverlay,
} from "./overlay-catalog";
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
      buildings: [
        building({ condition: 100 }),
        building({ id: "building_00000002", condition: 20 }),
      ],
    });
    expect(color("condition", e)).toBe(MAP_COLORS.fire);
  });

  it("cargas: cada estado vivo tiene su tono y lo ajeno queda en «sin datos»", () => {
    const withLoan = (status: string) =>
      color(
        "encumbrances",
        economy({
          parcels: [parcel()],
          banking: { offers: [], loans: [loan({ status })], auctions: [] },
        }),
      );
    expect(withLoan("active")).toBe(STATUS_COLORS.lien);
    expect(withLoan("delinquent")).toBe(STATUS_COLORS.arrears);
    expect(withLoan("defaulted")).toBe(STATUS_COLORS.loss);
    expect(withLoan("paid_off")).toBe(STATUS_COLORS.occupied);
    expect(
      color("encumbrances", economy({ parcels: [parcel({ ownerOrganizationId: RIVAL })] })),
    ).toBe(STATUS_COLORS.unknown);
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

/**
 * V.d-UX.S · gate S4: la leyenda que ve el jugador y el color que pinta el resolver son la misma
 * fuente. Cada banda de las tres capas nuevas se ejercita con un fixture y se compara con su
 * entrada de leyenda, para que ninguna pueda desviarse de la otra en silencio.
 */
describe("V.d-UX.S · paridad leyenda ↔ color pintado", () => {
  const cases: Array<{ layer: MapOverlay; label: string; e: ReturnType<typeof economy> }> = [
    { layer: "encumbrances", label: "Sin carga viva", e: economy({ parcels: [parcel()] }) },
    {
      layer: "encumbrances",
      label: "Hipoteca al día",
      e: economy({ parcels: [parcel()], banking: { offers: [], loans: [loan()], auctions: [] } }),
    },
    {
      layer: "encumbrances",
      label: "En atraso",
      e: economy({
        parcels: [parcel()],
        banking: { offers: [], loans: [loan({ status: "delinquent" })], auctions: [] },
      }),
    },
    {
      layer: "encumbrances",
      label: "Impagada o en subasta",
      e: economy({
        parcels: [parcel()],
        banking: { offers: [], loans: [loan({ status: "defaulted" })], auctions: [] },
      }),
    },
    {
      layer: "encumbrances",
      label: "Puja en subasta ajena",
      e: economy({
        parcels: [parcel({ ownerOrganizationId: RIVAL })],
        banking: {
          offers: [],
          loans: [],
          auctions: [
            {
              loanId: "loan_00000009",
              collateralParcelId: "parcel_00000001",
              sellerOrganizationId: RIVAL,
              reservePrice: 400,
              highestBid: 450,
              highestBidderOrganizationId: PLAYER,
              status: "open",
              closesAtTick: 72000,
            },
          ],
        },
      }),
    },
    {
      layer: "encumbrances",
      label: "Ajena o no hipotecable",
      e: economy({ parcels: [parcel({ ownerOrganizationId: RIVAL })] }),
    },
    {
      layer: "occupancy",
      label: "Ocupación completa",
      e: economy({ parcels: [parcel()], buildings: [building({ tenantIds: ["t1", "t2"] })] }),
    },
    {
      layer: "occupancy",
      label: "Ocupación parcial",
      e: economy({ parcels: [parcel()], buildings: [building({ tenantIds: ["t1"] })] }),
    },
    {
      layer: "occupancy",
      label: "Sin inquilinos",
      e: economy({ parcels: [parcel()], buildings: [building({ tenantIds: [] })] }),
    },
    {
      layer: "occupancy",
      label: "Producción: no se ocupa con hogares",
      e: economy({
        parcels: [parcel()],
        buildings: [building({ type: "cement_plant" })],
        production: [{ buildingId: "building_00000001" }],
      }),
    },
    { layer: "occupancy", label: "Solar sin edificio", e: economy({ parcels: [parcel()] }) },
    {
      layer: "occupancy",
      label: "Sin datos (edificio ajeno)",
      e: economy({ parcels: [parcel()], buildings: [building({ ownerOrganizationId: RIVAL })] }),
    },
    {
      layer: "insurance",
      label: "Todo asegurado",
      e: economy({
        parcels: [parcel()],
        buildings: [building()],
        insurance: { offers: [], claims: [], contracts: [contract()] },
      }),
    },
    {
      layer: "insurance",
      label: "Alguna póliza vencida",
      e: economy({
        parcels: [parcel()],
        buildings: [building()],
        insurance: { offers: [], claims: [], contracts: [contract({ status: "lapsed" })] },
      }),
    },
    {
      layer: "insurance",
      label: "Alguno sin seguro",
      e: economy({ parcels: [parcel()], buildings: [building()] }),
    },
    {
      layer: "insurance",
      label: "Sin datos (edificio ajeno)",
      e: economy({ parcels: [parcel()], buildings: [building({ ownerOrganizationId: RIVAL })] }),
    },
  ];

  it("cada banda de leyenda coincide con el color que pinta el resolver", () => {
    for (const entry of cases) {
      const legend = overlayOption(entry.layer).legend.find((band) => band.label === entry.label);
      expect(legend, `${entry.layer}: ${entry.label}`).toBeDefined();
      const painted = cssColor(color(entry.layer, entry.e));
      expect(painted, `${entry.layer}: ${entry.label}`).toBe(legend!.color);
    }
    /** Y ninguna banda de las tres capas queda sin ejercitar. */
    for (const layer of ["encumbrances", "occupancy", "insurance"] as const) {
      const labels = overlayOption(layer).legend.map((band) => band.label);
      const covered = cases.filter((entry) => entry.layer === layer).map((entry) => entry.label);
      expect(covered.sort(), layer).toEqual(labels.sort());
    }
  });
});
