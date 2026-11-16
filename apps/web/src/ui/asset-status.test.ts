import { describe, expect, it } from "vitest";
import { createInitialState, createViewProjection, runScenario } from "@landlord/simulation";
import { parseParcelId } from "@landlord/shared";

import {
  assetFinanceRows,
  assetMortgageTotal,
  buildingStatusFor,
  indexAssetStatus,
  parcelLoadFor,
} from "./asset-status";
import {
  PLAYER,
  RIVAL,
  alert,
  auction,
  building,
  contract,
  economy,
  loan,
  parcel,
} from "./status-fixtures";

describe("V.d-UX.S · puerta de estado del activo", () => {
  it("sin proyección no inventa estado", () => {
    const index = indexAssetStatus(undefined);
    expect(index.loadsByParcelId.size).toBe(0);
    expect(index.statusByBuildingId.size).toBe(0);
    expect(parcelLoadFor(index, "parcel_00000001").kind).toBe("unknown");
    expect(buildingStatusFor(index, "building_00000001")).toBeNull();
  });

  it("distingue «sin carga» de «sin datos»: la parcela ajena no está libre de deuda", () => {
    const own = parcel({ id: "parcel_00000001", ownerOrganizationId: PLAYER });
    const foreign = parcel({ id: "parcel_00000002", ownerOrganizationId: RIVAL });
    const index = indexAssetStatus(economy({ parcels: [own, foreign] }));
    expect(parcelLoadFor(index, "parcel_00000001").kind).toBe("none");
    expect(parcelLoadFor(index, "parcel_00000002").kind).toBe("unknown");
    expect(parcelLoadFor(index, "parcel_00000002").label).not.toBe(
      parcelLoadFor(index, "parcel_00000001").label,
    );
  });

  it("el suelo público no se presenta como carga desconocida de un propietario", () => {
    const index = indexAssetStatus(
      economy({ parcels: [parcel({ disposition: "public", ownerOrganizationId: "org_00000004" })] }),
    );
    expect(parcelLoadFor(index, "parcel_00000001").kind).toBe("unknown");
  });

  it("agrega el peor estado vivo y no asume unicidad de préstamo", () => {
    const index = indexAssetStatus(
      economy({
        parcels: [parcel()],
        banking: {
          offers: [],
          auctions: [],
          loans: [
            loan({ id: "loan_00000001", status: "active" }),
            loan({ id: "loan_00000002", status: "defaulted", outstandingPrincipal: 300 }),
            loan({ id: "loan_00000003", status: "paid_off" }),
          ],
        },
      }),
    );
    const load = parcelLoadFor(index, "parcel_00000001");
    expect(load.kind).toBe("defaulted");
    expect(load.loans.map((entry) => entry.status)).toEqual(["active", "defaulted"]);
    /** `paid_off` no es carga viva ni suma deuda. */
    expect(load.loans.some((entry) => entry.status === ("paid_off" as never))).toBe(false);
  });

  it("la subasta abierta propia domina sobre cualquier préstamo de la parcela", () => {
    const index = indexAssetStatus(
      economy({
        parcels: [parcel()],
        banking: {
          offers: [],
          loans: [loan({ status: "delinquent", missedPayments: 2 })],
          auctions: [auction()],
        },
      }),
    );
    const load = parcelLoadFor(index, "parcel_00000001");
    expect(load.kind).toBe("auction");
    expect(load.auction?.role).toBe("seller");
    expect(load.detail.join(" ")).toContain("500");
    expect(load.detail.join(" ")).not.toMatch(/loan_|parcel_\d|tick/);
  });

  it("una puja propia en subasta ajena es oportunidad, no pérdida", () => {
    const index = indexAssetStatus(
      economy({
        parcels: [parcel({ ownerOrganizationId: RIVAL })],
        banking: {
          offers: [],
          loans: [],
          auctions: [
            auction({ sellerOrganizationId: RIVAL, highestBidderOrganizationId: PLAYER, highestBid: 620 }),
          ],
        },
      }),
    );
    const load = parcelLoadFor(index, "parcel_00000001");
    expect(load.kind).toBe("auction_bid");
    expect(load.auction?.role).toBe("bidder");
  });

  it("las subastas cerradas o ejecutadas no dejan marca persistente", () => {
    for (const status of ["closed", "executed"] as const) {
      const index = indexAssetStatus(
        economy({ parcels: [parcel()], banking: { offers: [], loans: [], auctions: [auction({ status })] } }),
      );
      expect(parcelLoadFor(index, "parcel_00000001").kind, status).toBe("none");
    }
  });

  it("ocupación: llena, parcial, vacía, producción y ajena nunca se confunden", () => {
    const index = indexAssetStatus(
      economy({
        parcels: [parcel()],
        buildings: [
          building({ id: "building_00000001", tenantIds: ["tenant_00000001", "tenant_00000002"] }),
          building({ id: "building_00000002", tenantIds: ["tenant_00000001"] }),
          building({ id: "building_00000003", tenantIds: [] }),
          building({ id: "building_00000004", tenantIds: [], type: "cement_plant" }),
          building({ id: "building_00000005", ownerOrganizationId: RIVAL, tenantIds: [] }),
        ],
        production: [{ buildingId: "building_00000004" }],
      }),
    );
    expect(buildingStatusFor(index, "building_00000001")?.occupancy).toBe("full");
    expect(buildingStatusFor(index, "building_00000002")?.occupancy).toBe("partial");
    expect(buildingStatusFor(index, "building_00000003")?.occupancy).toBe("empty");
    expect(buildingStatusFor(index, "building_00000004")?.occupancy).toBe("production");
    /** El rival llega con tenantIds anonimizado: vacío NO es vacío. */
    expect(buildingStatusFor(index, "building_00000005")?.occupancy).toBe("unknown");
  });

  it("seguro: activo, vencido, sin póliza y ajeno", () => {
    const index = indexAssetStatus(
      economy({
        buildings: [
          building({ id: "building_00000001" }),
          building({ id: "building_00000002" }),
          building({ id: "building_00000003" }),
          building({ id: "building_00000004", ownerOrganizationId: RIVAL }),
        ],
        insurance: {
          offers: [],
          claims: [],
          contracts: [
            contract({ buildingId: "building_00000001", status: "active" }),
            contract({ buildingId: "building_00000002", status: "lapsed" }),
            contract({ buildingId: "building_00000003", status: "cancelled" }),
          ],
        },
      }),
    );
    expect(buildingStatusFor(index, "building_00000001")?.insurance).toBe("active");
    expect(buildingStatusFor(index, "building_00000002")?.insurance).toBe("lapsed");
    expect(buildingStatusFor(index, "building_00000003")?.insurance).toBe("none");
    expect(buildingStatusFor(index, "building_00000004")?.insurance).toBe("unknown");
  });

  it("el backlog es la resta de dos campos publicados, tolera ausencias y nunca es negativo", () => {
    const index = indexAssetStatus(
      economy({
        buildings: [
          building({ id: "building_00000001", maintenanceCost: 300, maintenanceDue: 900 }),
          building({ id: "building_00000002", maintenanceCost: 40, maintenanceDue: 40 }),
          building({ id: "building_00000003", maintenanceCost: undefined, maintenanceDue: undefined }),
        ],
      }),
    );
    expect(buildingStatusFor(index, "building_00000001")?.backlog).toBe(600);
    expect(buildingStatusFor(index, "building_00000002")?.backlog).toBe(0);
    expect(buildingStatusFor(index, "building_00000003")?.backlog).toBe(0);
  });

  it("las dos causas de mantenimiento se separan por reason y buildingId, no por el id", () => {
    const index = indexAssetStatus(
      economy({
        parcels: [parcel()],
        buildings: [
          building({ id: "building_00000001" }),
          building({ id: "building_00000002" }),
        ],
        alerts: [
          alert({ id: "condition-building_00000001", reason: "building_condition", buildingId: "building_00000001" }),
          alert({ id: "insurance-building_00000002", reason: "uninsured_building", buildingId: "building_00000002" }),
          alert({ id: "condition-building_00000099", reason: "building_condition", buildingId: "building_00000099" }),
        ],
      }),
    );
    const first = buildingStatusFor(index, "building_00000001")!;
    const second = buildingStatusFor(index, "building_00000002")!;
    expect(first.conditionAlert).toBe(true);
    expect(first.insuranceAlert).toBe(false);
    expect(second.conditionAlert).toBe(false);
    expect(second.insuranceAlert).toBe(true);
  });

  it("la hipoteca del activo suma todas sus parcelas y excluye lo liquidado", () => {
    const multi = building({
      id: "building_00000001",
      parcelIds: ["parcel_00000001", "parcel_00000002"],
    });
    const e = economy({
      parcels: [parcel(), parcel({ id: "parcel_00000002" })],
      buildings: [multi],
      banking: {
        offers: [],
        auctions: [],
        loans: [
          loan({ id: "loan_00000001", collateralParcelId: "parcel_00000001", outstandingPrincipal: 600 }),
          loan({ id: "loan_00000002", collateralParcelId: "parcel_00000002", outstandingPrincipal: 250 }),
          loan({ id: "loan_00000003", collateralParcelId: "parcel_00000002", status: "paid_off", outstandingPrincipal: 0 }),
        ],
      },
      financials: { liabilities: 5000 },
    });
    expect(assetMortgageTotal(e, multi)).toBe(850);
    const rows = assetFinanceRows(e, multi);
    const mortgage = rows.find((row) => row.label === "Hipoteca del activo")!;
    const portfolio = rows.find((row) => row.label === "Deuda de la cartera")!;
    expect(mortgage.value).toBe("850 u.");
    expect(portfolio.value).toBe("5000 u.");
    expect(mortgage.value).not.toBe(portfolio.value);
    expect(rows.find((row) => row.label === "Garantía")?.value).toContain("2 parcela(s)");
  });

  it("es determinista: la misma proyección produce el mismo índice", () => {
    const e = economy({
      parcels: [parcel()],
      buildings: [building({ upgraded: true })],
      banking: { offers: [], loans: [loan({ status: "delinquent" })], auctions: [] },
    });
    const first = indexAssetStatus(e);
    const second = indexAssetStatus(e);
    expect([...first.loadsByParcelId.entries()]).toEqual([...second.loadsByParcelId.entries()]);
    expect([...first.statusByBuildingId.entries()]).toEqual([...second.statusByBuildingId.entries()]);
    expect(first.statusByBuildingId.get("building_00000001")?.upgraded).toBe(true);
  });
});

/**
 * Nivel B · integración con el motor REAL. No se fabrica la proyección: los comandos los despacha
 * el motor, el tiempo lo avanza `runScenario` y la vista la produce `createViewProjection`. Lo único
 * autorado es el punto de partida (un solar propio), como hacen los tests de dominio del repo.
 */
describe("V.d-UX.S · cadena simulation → projection → asset-status", () => {
  it("un préstamo aceptado llega al índice como carga viva de su parcela", () => {
    const seed = 1;
    const probe = createInitialState(seed);
    const target = [...probe.phase2.parcels.values()]
      .filter((entry) => entry.disposition === "marketable" && !entry.ownerOrganizationId)
      .sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const run = runScenario(
      seed,
      [
        { atTick: 0, command: buyParcel(target.id) },
        { atTick: 1, command: requestLoan(target.id) },
        { atTick: 2, command: acceptLoan("loan_00000001") },
      ],
      200,
      { checkpointEvery: 0 },
    );
    const accepted = run.results.filter((entry) => entry.result.accepted);
    expect(accepted.length).toBe(3);
    const projection = createViewProjection(run.state, true);
    const index = indexAssetStatus(projection.economy);
    const load = parcelLoadFor(index, target.id);
    expect(load.kind).toBe("loan");
    expect(load.loans).toHaveLength(1);
    expect(load.loans[0]!.outstandingPrincipal).toBe(600);
    expect(assetMortgageTotal(projection.economy!, {
      parcelIds: [target.id],
    } as never)).toBe(600);
  });
});

const ACTOR = "person_00000001";
const ORG = "org_00000001";

function base(commandId: string, type: string, payload: unknown) {
  return {
    commandId: commandId,
    issuedByPersonId: ACTOR,
    actingAsOrganizationId: ORG,
    type,
    payload,
  } as never;
}

function buyParcel(parcelId: string) {
  return base("engine-buy", "BuyParcel", { parcelId: parseParcelId(parcelId) });
}

function requestLoan(parcelId: string) {
  return base("engine-loan", "RequestLoan", {
    amount: 600,
    termMonths: 12,
    collateralParcelId: parseParcelId(parcelId),
  });
}

function acceptLoan(loanId: string) {
  return base("engine-accept", "AcceptLoanOffer", { loanId });
}