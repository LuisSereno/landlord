import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseFacilityId,
  parseLoanId,
  parseMoney,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parseTick,
  viewProjectionV2Schema,
} from "@landlord/shared";
import { dispatchPlaceTestStructure, dispatchProductCommand } from "./commands";
import { activateMacroEvent } from "./macro-events";
import { createViewProjection } from "./projection";
import { createInitialState } from "./state";

describe("simulation view projection", () => {
  it("projects confirmed state in stable entity order", () => {
    const state = createInitialState(1);
    dispatchPlaceTestStructure(state, {
      commandId: parseCommandId("command-1"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceTestStructure",
      payload: { districtId: PLAYER_HOME_DISTRICT_ID, cell: { x: 3, y: 4 } },
    });
    const projection = createViewProjection(state);
    expect(projection).toMatchObject({
      projectionVersion: 2,
      tick: 0,
      observedDistrictId: PLAYER_HOME_DISTRICT_ID,
      map: expect.objectContaining({ width: 64, height: 64, roads: expect.any(Object) }),
      structures: [
        { id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 3, y: 4 } },
      ],
    });
    expect(projection.city.districts).toHaveLength(9);
    expect(projection.city.districts.map((district) => district.name)).toContain(
      "Barrio del Umbral",
    );
    expect(projection.agents).toHaveLength(16);
  });

  it("projects a signed period result and a conservative financial position", () => {
    const state = createInitialState(2);
    const initial = createViewProjection(state, true);
    expect(initial.economy?.financials).toMatchObject({
      assets: 14560,
      liabilities: 0,
      equity: 14560,
      period: { month: 1, income: 0, expenses: 0, netIncome: 0, cashFlow: 0 },
      forecast: { income: 0, expenses: 0, netCashFlow: 0, closingCash: 12000, shortfall: 0 },
    });

    dispatchProductCommand(state, {
      commandId: parseCommandId("finance-buy"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "BuyParcel",
      payload: { parcelId: parseParcelId("parcel_00000005") },
    });
    const afterPurchase = createViewProjection(state, true);
    expect(afterPurchase.economy?.financials).toMatchObject({
      assets: 14548,
      liabilities: 0,
      equity: 14548,
      period: { expenses: 812, netIncome: -812, cashFlow: -812 },
    });
    expect(() => viewProjectionV2Schema.parse(afterPurchase)).not.toThrow();
  });

  it("forecasts a shortfall without creating a negative authoritative balance", () => {
    const state = createInitialState(3);
    state.phase2.balances.set(parseOrganizationId("org_00000001"), parseMoney(10));
    state.phase2.facilities.set(parseFacilityId("facility_00000001"), {
      id: parseFacilityId("facility_00000001"),
      ownerOrganizationId: parseOrganizationId("org_00000001"),
      operational: true,
      cycleProgress: 0,
      cycleLength: 24,
      output: "cement",
      outputAmount: 2,
      kind: "legacy",
      investmentCost: parseMoney(0),
      operatingCost: parseMoney(80),
      buildingId: null,
      suitabilityPercent: 100,
      conditionPercent: 100,
      upgradePercent: 100,
      remainder: 0,
    });

    const financials = createViewProjection(state, true).economy!.financials;
    expect(financials.forecast).toMatchObject({
      expenses: 2400,
      netCashFlow: -2400,
      closingCash: 0,
      shortfall: 2390,
    });
    expect(createViewProjection(state, true).economy?.cash).toBe(10);
  });

  it("projects debt as a liability and financing cost, not operating income", () => {
    const state = createInitialState(4);
    const parcelId = parseParcelId("parcel_00000001");
    state.phase2.parcels.get(parcelId)!.ownerOrganizationId = parseOrganizationId("org_00000001");
    state.phase2.loans.set(parseLoanId("loan_00000001"), {
      id: parseLoanId("loan_00000001"),
      borrowerOrganizationId: parseOrganizationId("org_00000001"),
      lenderOrganizationId: parseOrganizationId("org_00000003"),
      principal: parseMoney(600),
      outstandingPrincipal: parseMoney(600),
      annualInterestRateBps: 900,
      termMonths: 12,
      remainingMonths: 12,
      collateralParcelId: parcelId,
      status: "active",
      offeredAtTick: parseTick(0),
      acceptedAtTick: parseTick(0),
      nextPaymentTick: parseTick(36000),
      missedPayments: 0,
    });

    const economy = createViewProjection(state, true).economy!;
    expect(economy.financials).toMatchObject({
      liabilities: 600,
      equity: 14860,
      period: { income: 0 },
      forecast: { expenses: 62 },
    });
    expect(economy.banking.loans[0]).toMatchObject({
      status: "active",
      outstandingPrincipal: 600,
      monthlyPayment: 51,
    });
    expect(() => viewProjectionV2Schema.parse(createViewProjection(state, true))).not.toThrow();
  });

  it("publica los macroeventos activos sin exponer el arroyo del sorteo", () => {
    const state = createInitialState(6);
    state.phase2.macroEvents = activateMacroEvent(
      state.phase2.macroEvents,
      "economic_recession",
      parseTick(0),
      0.8,
    );
    const projection = createViewProjection(state, true);
    expect(projection.economy?.macroEvents.active).toEqual([
      expect.objectContaining({
        type: "economic_recession",
        label: "Recesión económica",
        intensity: 0.8,
        startTick: 0,
      }),
    ]);
    expect(projection.economy?.macroEvents.aggregatedModifiers.rentModifierPercent).toBeCloseTo(
      -12,
      5,
    );
    expect(() => viewProjectionV2Schema.parse(projection)).not.toThrow();
    /** El arroyo del sorteo y la probabilidad mensual son superficie privada del motor. */
    expect(JSON.stringify(projection)).not.toMatch(/xoshiro|prng|triggerChance/i);
  });
});

describe("V.d.0 resúmenes de ciudad", () => {
  it("no publica caja, estrategia ni memoria privada del rival en los resúmenes distritales", () => {
    const state = createInitialState(5);
    state.phase2.rivalAi.lastReason = "RAZON-PRIVADA-RIVAL";
    state.phase2.rivalAi.lastAction = "accion-privada-rival";
    const projection = createViewProjection(state);
    const summaries = JSON.stringify(projection.city);
    expect(summaries).not.toContain("RAZON-PRIVADA-RIVAL");
    expect(summaries).not.toContain("accion-privada-rival");
    for (const forbidden of ["cash", "balance", "strategy", "memory", "reserve"]) {
      expect(summaries.toLowerCase()).not.toContain(`"${forbidden}`);
    }
  });

  it("publica sólo las parcelas y edificios del distrito observado", () => {
    const state = createInitialState(6);
    const projection = createViewProjection(state);
    const observed = projection.observedDistrictId;
    for (const parcel of projection.economy?.parcels ?? []) {
      expect(
        state.phase2.parcels.get(parcel.id as never)?.districtId,
        `parcela ${parcel.id} fuera del distrito observado`,
      ).toBe(observed);
    }
    for (const building of projection.economy?.buildings ?? []) {
      const parent = state.phase2.parcels.get(
        state.phase2.buildings.get(building.id as never)!.parcelId,
      )!;
      expect(parent.districtId).toBe(observed);
    }
  });
});
