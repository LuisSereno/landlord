import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseMoney,
  parseParcelId,
  parseTick,
  type Building,
  type BuildingId,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import { describeHousingStock } from "./housing-market";
import {
  MUNICIPAL_BUDGET_POLICY,
  describeMunicipalBudget,
  initialMunicipalBudgetState,
  runMunicipalBudget,
} from "./municipal-budget";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addBuilding(state: GameState, index: number): BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return id;
}

function clearOwnership(state: GameState): void {
  for (const parcel of state.phase2.parcels.values()) parcel.ownerOrganizationId = null;
}

describe("WP4.5 presupuesto municipal", () => {
  it("cobra impuestos y paga gasto planificado con caja real", () => {
    const state = newState();
    const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const parcel of parcels.slice(0, 2)) {
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      parcel.price = parseMoney(10_000);
    }
    addBuilding(state, 0);
    addBuilding(state, 1);
    state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(0));

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    advanceProductSystems(state);

    const report = describeMunicipalBudget(state);
    expect(report.revenueTotalBySource.propertyTax).toBe(240);
    expect(report.spentTotalByCategory.administration).toBe(
      MUNICIPAL_BUDGET_POLICY.administrationCost,
    );
    expect(report.spentTotalByCategory.security).toBe(2);
    expect(report.spentTotalByCategory.services).toBe(4);
    expect(report.serviceLevelPercentByCategory).toEqual({
      administration: 100,
      security: 100,
      services: 100,
    });
    expect(report.reserve).toBe(240 - 16);
    expect(report.surplusMonths).toBe(1);
    expect(report.deficitMonths).toBe(0);
  });

  it("recorta por prioridad y registra el descubierto cuando no hay caja", () => {
    const state = newState();
    clearOwnership(state);
    for (let index = 0; index < 3; index += 1) addBuilding(state, index);
    state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(15));

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalBudget(state);

    const report = describeMunicipalBudget(state);
    // Prioridad: administración (10) y seguridad (3) se pagan enteras; servicios (6) sólo 2.
    expect(report.spentTotalByCategory).toMatchObject({
      administration: 10,
      security: 3,
      services: 2,
    });
    expect(report.unfundedTotalByCategory).toMatchObject({
      administration: 0,
      security: 0,
      services: 4,
    });
    expect(report.serviceLevelPercentByCategory).toEqual({
      administration: 100,
      security: 100,
      services: 33,
    });
    expect(report.reserve).toBe(0);
    expect(report.deficitMonths).toBe(1);
    expect(report.surplusMonths).toBe(0);
  });

  it("enruta la transferencia y la propiedad al municipio y a su libro", () => {
    const state = newState();
    state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(0));
    const parcelId = parseParcelId("parcel_00000001");
    const parcel = state.phase2.parcels.get(parcelId)!;
    parcel.price = parseMoney(1_000);

    dispatchProductCommand(state, {
      type: "BuyParcel",
      commandId: "municipal-buy" as import("@landlord/shared").CommandId,
      issuedByPersonId: "person_00000001" as import("@landlord/shared").PersonId,
      actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
      payload: { parcelId },
    });

    const afterPurchase = describeMunicipalBudget(state);
    expect(afterPurchase.revenueThisMonthBySource.transferTax).toBe(15);
    expect(afterPurchase.reserve).toBe(15);

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    advanceProductSystems(state);

    const afterSettlement = describeMunicipalBudget(state);
    expect(afterSettlement.revenueTotalBySource.transferTax).toBe(15);
    expect(afterSettlement.revenueTotalBySource.propertyTax).toBe(12);
    expect(afterSettlement.revenueThisMonthBySource.transferTax).toBe(0);
    expect(afterSettlement.lastSettlementTick).toBe(GAME_MONTH_TICKS);
  });

  it("el recorte de servicios y seguridad se nota en la deseabilidad", () => {
    const funded = newState();
    addBuilding(funded, 0);
    addBuilding(funded, 1);
    funded.phase2.municipal.serviceLevelPercentByCategory = {
      administration: 100,
      security: 100,
      services: 100,
    };
    const cut = newState();
    addBuilding(cut, 0);
    addBuilding(cut, 1);
    cut.phase2.municipal.serviceLevelPercentByCategory = {
      administration: 100,
      security: 0,
      services: 0,
    };

    const fundedUnit = describeHousingStock(funded)[0]!;
    const cutUnit = describeHousingStock(cut)[0]!;

    expect(cutUnit.services).toBe(0);
    expect(cutUnit.safety).toBe(50);
    expect(fundedUnit.services).toBeGreaterThan(0);
    expect(fundedUnit.safety).toBe(100);
  });

  it("sobrevive a guardar y cargar y migra partidas anteriores", () => {
    const state = newState();
    clearOwnership(state);
    addBuilding(state, 0);
    state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(40));
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalBudget(state);

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
    expect(restored.phase2.municipal).toEqual(state.phase2.municipal);

    const raw = JSON.parse(JSON.stringify(serializeSnapshot(state))) as {
      phase2: { municipal?: unknown };
    };
    delete raw.phase2.municipal;
    const legacy = restoreStateFromSnapshot(raw);
    expect(legacy.phase2.municipal).toEqual(initialMunicipalBudgetState());
  });
});
