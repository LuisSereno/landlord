import { describe, expect, it } from "vitest";

import {
  deriveWorldIndicators,
  resolvePanelTab,
  worldIndicatorSignature,
  worldIndicatorsSignature,
  type PanelSection,
} from "./world-indicators";
import {
  RIVAL,
  alert,
  auction,
  building,
  contract,
  economy,
  loan,
  parcel,
  site,
} from "./status-fixtures";

describe("V.d-UX.S · avisos del mundo", () => {
  it("sin proyección no hay avisos", () => {
    expect(deriveWorldIndicators(undefined)).toEqual([]);
  });

  it("respeta el tope, prioriza lo crítico y excluye rivales", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      building({
        id: `building_${String(index).padStart(8, "0")}`,
        parcelIds: [`parcel_${String(index).padStart(8, "0")}`],
        condition: 40,
      }),
    );
    const indicators = deriveWorldIndicators(
      economy({
        parcels: many.map((_, index) => parcel({ id: `parcel_${String(index).padStart(8, "0")}` })),
        buildings: [
          ...many,
          building({ id: "building_burning", state: "burning" }),
          building({ id: "building_rival", ownerOrganizationId: RIVAL, state: "burning" }),
        ],
        constructionSites: [site()],
      }),
    );
    expect(indicators).toHaveLength(12);
    expect(indicators[0]!.critical).toBe(true);
    expect(indicators[0]!.kind).toBe("danger");
    expect(indicators.some((entry) => entry.buildingId === "building_rival")).toBe(false);
  });

  it("un solo badge por edificio: el de mayor consecuencia, con el resto plegado en el detalle", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [
          building({
            state: "burning",
            condition: 40,
            tenantIds: [],
            maintenanceCost: 40,
            maintenanceDue: 400,
            upgraded: true,
          }),
        ],
        insurance: { offers: [], claims: [], contracts: [contract({ status: "lapsed" })] },
      }),
    );
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.kind).toBe("danger");
    const detail = indicators[0]!.detail.join(" ");
    expect(detail).toContain("Mantenimiento atrasado");
    expect(detail).toContain("póliza vencida");
    expect(detail).toContain("Mejora completada");
  });

  it("la pérdida financiera irreversible comparte nivel crítico con el incendio", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel(), parcel({ id: "parcel_00000002" })],
        buildings: [
          building({ id: "building_00000001", condition: 40 }),
          building({ id: "building_00000002", parcelIds: ["parcel_00000002"] }),
        ],
        banking: {
          offers: [],
          loans: [loan({ status: "defaulted" })],
          auctions: [auction({ collateralParcelId: "parcel_00000002" })],
        },
      }),
    );
    const critical = indicators.filter((entry) => entry.critical);
    expect(critical.map((entry) => entry.kind).sort()).toEqual(["auction", "debt"]);
    /** El físico precede al financiero dentro del mismo nivel (spec §9). */
    expect(indicators[0]!.kind).toBe("auction");
    expect(indicators.some((entry) => entry.kind === "maintenance")).toBe(true);
  });

  it("una parcela con atraso y subasta abierta produce un solo aviso, el peor", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        banking: {
          offers: [],
          loans: [loan({ status: "delinquent", missedPayments: 2 })],
          auctions: [auction()],
        },
      }),
    );
    const parcelBadges = indicators.filter((entry) => entry.buildingId === undefined);
    expect(parcelBadges).toHaveLength(1);
    expect(parcelBadges[0]!.kind).toBe("auction");
  });

  it("la vacancia parcial no genera badge; la total sí, y sólo sin alerta del motor no hay aviso de seguro", () => {
    const partial = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [building({ tenantIds: ["tenant_00000001"], capacity: 2 })],
      }),
    );
    expect(partial).toEqual([]);

    const empty = deriveWorldIndicators(
      economy({ parcels: [parcel()], buildings: [building({ tenantIds: [], capacity: 2 })] }),
    );
    expect(empty).toHaveLength(1);
    expect(empty[0]!.kind).toBe("vacancy");
    expect(empty[0]!.section).toBe("tenants");

    const uninsuredNoAlert = deriveWorldIndicators(
      economy({ parcels: [parcel()], buildings: [building({ tenantIds: ["t1", "t2"] })] }),
    );
    expect(uninsuredNoAlert).toEqual([]);

    const uninsuredWithAlert = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [building({ tenantIds: ["t1", "t2"] })],
        alerts: [alert({ reason: "uninsured_building" })],
      }),
    );
    expect(uninsuredWithAlert).toHaveLength(1);
    expect(uninsuredWithAlert[0]!.kind).toBe("insurance");
    expect(uninsuredWithAlert[0]!.glyph).toBe("risk");
  });

  it("el backlog vivo avisa, y el tipo de obra se lee en el aviso de obra bloqueada", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [
          building({ tenantIds: ["t1", "t2"], maintenanceCost: 40, maintenanceDue: 400 }),
        ],
        constructionSites: [site({ kind: "clear_ruin" })],
      }),
    );
    const upkeep = indicators.find((entry) => entry.kind === "upkeep")!;
    expect(upkeep.label).toContain("360");
    const blocked = indicators.find((entry) => entry.kind === "blocked")!;
    expect(blocked.label).toContain("Desescombro");
    expect(blocked.glyph).toBe("demolition");
  });

  it("la hipoteca al día no interrumpe: no produce badge flotante", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [building({ tenantIds: ["t1", "t2"] })],
        banking: { offers: [], loans: [loan({ status: "active" })], auctions: [] },
      }),
    );
    expect(indicators).toEqual([]);
  });
});

describe("V.d-UX.S · firma de reconciliación", () => {
  const base = economy({
    parcels: [parcel()],
    banking: { offers: [], loans: [loan({ status: "delinquent" })], auctions: [] },
  });

  it("delinquent → defaulted cambia la firma aunque la key sea la misma", () => {
    const before = deriveWorldIndicators(base)[0]!;
    const after = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        banking: { offers: [], loans: [loan({ status: "defaulted" })], auctions: [] },
      }),
    )[0]!;
    expect(after.key).toBe(before.key);
    expect(worldIndicatorSignature(after)).not.toBe(worldIndicatorSignature(before));
    expect(after.critical).toBe(true);
    expect(before.critical).toBe(false);
  });

  it("todo campo visual o de comportamiento entra en la firma", () => {
    const indicator = deriveWorldIndicators(base)[0]!;
    const variants = [
      { ...indicator, label: "otro texto" },
      { ...indicator, detail: ["nuevo detalle"] },
      { ...indicator, tone: "loss" as const },
      { ...indicator, glyph: "auction" as const },
      { ...indicator, section: "summary" as const },
      { ...indicator, critical: !indicator.critical },
      { ...indicator, cell: { x: indicator.cell.x + 1, y: indicator.cell.y } },
    ];
    for (const variant of variants) {
      expect(worldIndicatorSignature(variant)).not.toBe(worldIndicatorSignature(indicator));
    }
    expect(worldIndicatorsSignature([indicator])).toBe(
      worldIndicatorsSignature([{ ...indicator }]),
    );
  });
});

describe("V.d-UX.S · pestaña pedida por el badge", () => {
  it("cubre la matriz de transición sobre el mismo edificio y el cambio de edificio", () => {
    const sequence: PanelSection[] = ["summary", "insurance", "maintenance", "finance"];
    let current: PanelSection = "summary";
    for (const section of sequence) {
      current = resolvePanelTab(current, false, { section, token: sequence.indexOf(section) + 1 });
      expect(current).toBe(section);
    }
    /** Sin petición, cambiar de edificio vuelve al resumen. */
    expect(resolvePanelTab(current, true, undefined)).toBe("summary");
    /** Sin petición y sin cambio de edificio, se conserva la pestaña elegida a mano. */
    expect(resolvePanelTab(current, false, undefined)).toBe(current);
    /** Una petición repetida con token nuevo vuelve a aplicarse aunque la sección no cambie. */
    expect(resolvePanelTab("summary", false, { section: "insurance", token: 9 })).toBe("insurance");
  });

  it("los badges declaran la sección pertinente del panel", () => {
    const indicators = deriveWorldIndicators(
      economy({
        parcels: [parcel()],
        buildings: [building({ condition: 40 })],
        insurance: { offers: [], claims: [], contracts: [contract({ status: "lapsed" })] },
      }),
    );
    expect(indicators[0]!.section).toBe("maintenance");
    expect(indicators[0]!.detail.join(" ")).toContain("póliza vencida");
  });
});
