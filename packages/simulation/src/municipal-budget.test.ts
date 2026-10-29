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
import { buildCoverageIndex } from "./urban-services";
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
  const building: Building = {
    id,
    parcelId: parcel.id,
    districtId: parcel.districtId,
    footprintCells: [{ ...parcel.anchorCell }],
    orientation: 0,
    floors: 1,
    form: "detached",
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
  for (const parcel of state.phase2.parcels.values()) {
    if (parcel.disposition !== "public") parcel.ownerOrganizationId = null;
  }
}

describe("WP4.5 presupuesto municipal", () => {
  it("cobra impuestos y paga gasto planificado con caja real", () => {
    const state = newState();
    const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const parcel of parcels.slice(0, 2)) {
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      parcel.marketValue = parseMoney(10_000);
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
    expect(report.spentTotalByCategory).toMatchObject({
      administration: 10,
      security: 2,
      transport: 4,
      cleaning: 4,
    });
    expect(report.serviceLevelPercentByCategory).toEqual({
      administration: 100,
      security: 100,
      transport: 100,
      cleaning: 100,
    });
    expect(report.reserve).toBe(240 - 20);
    expect(report.surplusMonths).toBe(1);
    expect(report.deficitMonths).toBe(0);
  });

  it("recorta por la prioridad del partido que gobierna y registra el descubierto", () => {
    const state = newState();
    clearOwnership(state);
    for (let index = 0; index < 3; index += 1) addBuilding(state, index);
    // Sin propiedades no hay impuesto que financie el gasto: la caja es exactamente 15.
    clearOwnership(state);
    state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(15));
    /** Desde WP4.11 el orden lo fija el concejo; se asigna una formación conocida para medir el recorte. */
    state.phase2.politics.governingPartyId = "party_cuentas_claras";

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalBudget(state);

    const report = describeMunicipalBudget(state);
    // Su plataforma paga administración (10) íntegra y deja el resto en transporte (6): seguridad
    // (3) y limpieza (6) se quedan sin financiar.
    expect(report.spentTotalByCategory).toMatchObject({
      administration: 10,
      security: 0,
      transport: 5,
      cleaning: 0,
    });
    expect(report.unfundedTotalByCategory).toMatchObject({
      administration: 0,
      security: 3,
      transport: 1,
      cleaning: 6,
    });
    expect(report.serviceLevelPercentByCategory).toEqual({
      administration: 100,
      security: 0,
      transport: 83,
      cleaning: 0,
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
    parcel.marketValue = parseMoney(1_000);

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

  it("el recorte de servicios se nota en la deseabilidad del barrio", () => {
    const build = (levels: Record<string, number>): GameState => {
      const state = newState();
      addBuilding(state, 0);
      addBuilding(state, 1);
      // Los dos edificios se colocan en el centro de cobertura para aislar el efecto del nivel de
      // servicio de la distancia geográfica.
      const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      /** Centro del distrito de esas parcelas: los nueve mapas comparten coordenadas (H1-06). */
      const center = buildCoverageIndex(state).cleaningByDistrictId.get(
        parcels[0]!.districtId,
      )!.center;
      parcels[0]!.anchorCell = { ...center };
      parcels[1]!.anchorCell = { x: center.x + 1, y: center.y };
      state.phase2.municipal.serviceLevelPercentByCategory = levels;
      return state;
    };
    const funded = build({ administration: 100, security: 100, transport: 100, cleaning: 100 });
    const cut = build({ administration: 100, security: 0, transport: 0, cleaning: 0 });

    const fundedUnit = describeHousingStock(funded)[0]!;
    const cutUnit = describeHousingStock(cut)[0]!;

    expect(cutUnit.accessibility).toBe(0);
    expect(cutUnit.safety).toBe(50);
    // 100 - 25 de limpieza + 5 de amenidades cívicas (educación/parques) = 80.
    expect(cutUnit.quality).toBe(80);
    expect(fundedUnit.accessibility).toBeGreaterThan(80);
    // La seguridad ya es cobertura de comisaría por grafo: sin una comisaría alcanzable puede
    // quedar en el suelo base, no en el 90 % del radio antiguo.
    expect(fundedUnit.safety).toBeGreaterThanOrEqual(50);
    expect(cutUnit.safety).toBeLessThanOrEqual(fundedUnit.safety);
    expect(fundedUnit.quality).toBeGreaterThanOrEqual(95);
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

  it("la proyección municipal sólo publica las cuatro categorías reales", () => {
    const report = describeMunicipalBudget(newState());
    expect(Object.keys(report.plannedByCategory).sort()).toEqual([
      "administration",
      "cleaning",
      "security",
      "transport",
    ]);
    expect(Object.keys(report.serviceLevelPercentByCategory).sort()).toEqual([
      "administration",
      "cleaning",
      "security",
      "transport",
    ]);
    /** `services` fue la categoría obsoleta del HUD hasta WP4.11-H: no debe reaparecer. */
    expect(JSON.stringify(report)).not.toContain('"services"');
  });
});
