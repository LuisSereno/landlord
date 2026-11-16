import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parsePersonId,
  parseTick,
  type BuildingId,
  type ProductCommand,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { GAME_HOUR_TICKS, GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/**
 * V.d-UX.S · S0.4 (E3): ciclo de vida insurance ↔ ruin ↔ clear_ruin.
 *
 * Siete invariantes exigibles:
 *  1 · una ruina no puede tener póliza `active`;
 *  2 · contrato no activo → `nextPremiumTick === null`;
 *  3 · desescombro completado → no queda contrato de un edificio inexistente;
 *  4 · el claim del incidente que produjo la ruina se conserva;
 *  5 · no se cobra ninguna prima después de la ruina;
 *  6 · save/load conserva los invariantes anteriores;
 *  7 · la corrección no altera el flujo de caja (settleInsurance ya saltaba el débito de ruinas).
 */

const actor = parsePersonId("person_00000001");
const organization = PLAYER_ORGANIZATION_ID as ProductCommand["actingAsOrganizationId"];

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: organization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

/**
 * Edificio autorado sobre un solar libre, como fixture determinista del ciclo de vida. El id vive
 * fuera del rango del contador del motor y el contador se eleva por encima: si no, una obra nueva
 * construida durante la carrera reutilizaría el mismo id y sobrescribiría la ruina del fixture.
 */
function authorBuilding(
  state: GameState,
  ordinal: number,
  condition = 100,
): BuildingId {
  const serial = 9000 + ordinal;
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  state.phase2.idCounters.building = Math.max(state.phase2.idCounters.building, serial);
  const parcel = [...state.phase2.parcels.values()]
    .filter((entry) => entry.disposition === "marketable" && !entry.ownerOrganizationId)
    .sort((a, b) => a.id.localeCompare(b.id))[ordinal - 1]!;
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  state.phase2.buildings.set(id, {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: [{ ...parcel.anchorCell }],
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  });
  return id;
}

/**
 * Avanza `hours` horas de juego garantizando que se procesa al menos ese número de límites
 * horarios desde cualquier fase del reloj: `tacticalTick` sólo corre su bloque horario cuando
 * `tick % GAME_HOUR_TICKS === 0`, y el tick se incrementa DESPUÉS de los sistemas, así que desde
 * tick 0 una hora exacta de 50 ticks no llegaría a ejecutar ningún bloque horario.
 */
function advanceHours(state: GameState, hours: number): void {
  for (let tick = 0; tick < hours * GAME_HOUR_TICKS + 1; tick += 1) advanceProductSystems(state);
}

/** Invariante 2 sobre toda la cartera, no sólo sobre el edificio del caso. */
function expectNoPremiumScheduledOnInactiveContracts(state: GameState): void {
  for (const contract of Object.values(state.phase2.insurance.contractsByBuildingId)) {
    if (contract.status !== "active") expect(contract.nextPremiumTick).toBeNull();
  }
}

/** Invariante 3 sobre toda la cartera. */
function expectNoOrphanContracts(state: GameState): void {
  for (const contract of Object.values(state.phase2.insurance.contractsByBuildingId)) {
    expect(state.phase2.buildings.has(contract.buildingId)).toBe(true);
  }
}

function buy(state: GameState, id: BuildingId, label: string): void {
  expect(
    dispatchProductCommand(state, command(label, "BuyInsurance", { buildingId: id, coverage: "fire_plus" }))
      .accepted,
  ).toBe(true);
}

/**
 * Lleva el edificio a ruina por el camino real del motor: incendio activo + integridad estructural
 * agotada → collapse_pending → ruin.
 */
function collapseByFire(state: GameState, id: BuildingId): void {
  const building = state.phase2.buildings.get(id)!;
  building.structuralIntegrity = 1;
  if (building.state === "operational") {
    const incidentId = parseIncidentId("incident_00000091");
    state.phase2.incidents.set(incidentId, {
      id: incidentId,
      buildingId: id,
      origin: "deterioration",
      intensity: 60,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: state.clock.tick,
      causedByAgentId: null,
      causedByOrganizationId: null,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    building.state = "burning";
  }
  for (let hour = 0; hour < 12; hour += 1) {
    advanceHours(state, 1);
    if (state.phase2.buildings.get(id)?.state === "ruin") return;
  }
  throw new Error("el edificio no llegó a ruina en 12 horas de juego");
}

function clearRuin(state: GameState, id: BuildingId, label: string): void {
  const building = state.phase2.buildings.get(id);
  expect(building?.state, "el edificio sigue en ruina antes de desescombrar").toBe("ruin");
  const result = dispatchProductCommand(state, command(label, "ClearRuin", { buildingId: id }));
  expect(result.accepted, JSON.stringify(result)).toBe(true);
  const site = [...state.phase2.constructionSites.values()].find(
    (entry) => entry.kind === "clear_ruin" && entry.targetBuildingId === id,
  )!;
  expect(site).toBeDefined();
  site.progress = site.workRequired;
  advanceHours(state, 1);
  expect(state.phase2.buildings.has(id)).toBe(false);
}

describe("V.d-UX.S · ciclo de vida del seguro frente a ruina y desescombro", () => {
  it("recorre la cadena completa: póliza → siniestro → claim → colapso → desescombro → claim vivo", () => {
    let state: GameState | undefined;
    let buildingId: BuildingId | undefined;
    for (let seed = 1; seed <= 100 && !state; seed += 1) {
      const candidate = createInitialState(seed);
      const id = authorBuilding(candidate, 1, 10);
      buy(candidate, id, `chain-buy-${seed}`);
      candidate.phase2.taxation.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
      candidate.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
      candidate.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 2);
      candidate.clock = { ...candidate.clock, tick: parseTick(GAME_MONTH_TICKS) };
      advanceProductSystems(candidate);
      const paid = Object.values(candidate.phase2.insurance.claimsByIncidentId).some(
        (claim) => claim.buildingId === id && claim.status === "paid",
      );
      if (paid && candidate.phase2.insurance.contractsByBuildingId[id]?.status === "active") {
        state = candidate;
        buildingId = id;
      }
    }
    expect(state).toBeDefined();
    const id = buildingId!;
    const claimsBefore = Object.values(state!.phase2.insurance.claimsByIncidentId).filter(
      (claim) => claim.buildingId === id,
    );
    expect(claimsBefore.length).toBeGreaterThan(0);
    const premiumPaidBefore = state!.phase2.insurance.contractsByBuildingId[id]!.totalPremiumPaid;

    collapseByFire(state!, id);
    /** Invariante 1: en el MISMO tick del colapso, no un mes después. */
    const contractAtRuin = state!.phase2.insurance.contractsByBuildingId[id]!;
    expect(contractAtRuin.status).not.toBe("active");
    expect(contractAtRuin.status).toBe("cancelled");
    expect(contractAtRuin.nextPremiumTick).toBeNull();
    /** Invariante 4: el claim del siniestro sigue ahí tras el colapso. */
    expect(
      Object.values(state!.phase2.insurance.claimsByIncidentId).filter(
        (claim) => claim.buildingId === id,
      ),
    ).toEqual(claimsBefore);
    expectNoPremiumScheduledOnInactiveContracts(state!);

    /** Invariante 5: cruzar otro cierre mensual no cobra prima de una ruina. */
    advanceHours(state!, 24 * 40);
    expect(state!.phase2.insurance.contractsByBuildingId[id]!.totalPremiumPaid).toBe(
      premiumPaidBefore,
    );

    clearRuin(state!, id, "chain-clear");
    /** Invariante 3: el contrato desaparece con el edificio. */
    expect(state!.phase2.insurance.contractsByBuildingId[id]).toBeUndefined();
    expectNoOrphanContracts(state!);
    /** Invariante 4: el claim sobrevive al desescombro. */
    expect(
      Object.values(state!.phase2.insurance.claimsByIncidentId).filter(
        (claim) => claim.buildingId === id,
      ),
    ).toEqual(claimsBefore);

    /** Invariante 6: save/load conserva todo lo anterior. */
    const restored = restoreStateFromSnapshot(serializeSnapshot(state!));
    expect(restored.phase2.insurance).toEqual(state!.phase2.insurance);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state!));
    expectNoOrphanContracts(restored);
    expectNoPremiumScheduledOnInactiveContracts(restored);
    expect(
      Object.values(restored.phase2.insurance.claimsByIncidentId).filter(
        (claim) => claim.buildingId === id,
      ),
    ).toEqual(claimsBefore);
  });

  it("termina la póliza de una ruina heredada de una partida guardada con el estado inválido", () => {
    const state = createInitialState(7);
    const id = authorBuilding(state, 1);
    buy(state, id, "legacy-buy");
    /** Ruina autorada con póliza activa: es exactamente el estado inválido que deja un save antiguo. */
    state.phase2.buildings.get(id)!.state = "ruin";
    expect(state.phase2.insurance.contractsByBuildingId[id]!.status).toBe("active");
    advanceHours(state, 1);
    expect(state.phase2.insurance.contractsByBuildingId[id]).toMatchObject({
      status: "cancelled",
      nextPremiumTick: null,
    });
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.insurance.contractsByBuildingId[id]!.status).toBe("cancelled");
  });

  it("no deja contrato huérfano cuando la póliza estaba vencida o ya cancelada", () => {
    for (const path of ["lapsed", "cancelled"] as const) {
      const state = createInitialState(11);
      const id = authorBuilding(state, 1);
      buy(state, id, `${path}-buy`);
      if (path === "lapsed") {
        state.phase2.balances.set(organization, parseMoney(0));
        state.phase2.taxation.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
        state.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
        state.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 2);
        state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
        advanceProductSystems(state);
        expect(state.phase2.insurance.contractsByBuildingId[id]!.status).toBe("lapsed");
      } else {
        expect(
          dispatchProductCommand(state, command(`${path}-cancel`, "CancelInsurance", { buildingId: id }))
            .accepted,
        ).toBe(true);
      }
      state.phase2.buildings.get(id)!.state = "ruin";
      advanceHours(state, 1);
      expectNoPremiumScheduledOnInactiveContracts(state);
      clearRuin(state, id, `${path}-clear`);
      expect(state.phase2.insurance.contractsByBuildingId[id]).toBeUndefined();
      expectNoOrphanContracts(state);
    }
  });

  it("desescombrar una ruina sin póliza es un no-op y no toca la cartera ajena", () => {
    const state = createInitialState(13);
    const ruined = authorBuilding(state, 1);
    const neighbour = authorBuilding(state, 2);
    buy(state, neighbour, "neighbour-buy");
    state.phase2.buildings.get(ruined)!.state = "ruin";
    advanceHours(state, 1);
    clearRuin(state, ruined, "bare-clear");
    expect(state.phase2.insurance.contractsByBuildingId[ruined]).toBeUndefined();
    /** El vecino intacto conserva su cobertura activa: la limpieza no es global. */
    expect(state.phase2.insurance.contractsByBuildingId[neighbour]).toMatchObject({
      status: "active",
    });
    expectNoOrphanContracts(state);
  });

  it("el colapso de un edificio no termina la póliza del otro edificio de la misma parcela", () => {
    const state = createInitialState(17);
    const first = authorBuilding(state, 1);
    const second = authorBuilding(state, 2);
    /** Los dos comparten parcela: el caso multi-edificio de H2-01. */
    const parcelId = state.phase2.buildings.get(first)!.parcelIds[0]!;
    state.phase2.buildings.get(second)!.parcelIds = [parcelId];
    buy(state, first, "shared-first");
    buy(state, second, "shared-second");
    collapseByFire(state, first);
    expect(state.phase2.insurance.contractsByBuildingId[first]!.status).toBe("cancelled");
    expect(state.phase2.insurance.contractsByBuildingId[second]).toMatchObject({
      status: "active",
    });
    expectNoPremiumScheduledOnInactiveContracts(state);
  });

  it("la corrección no altera el flujo de caja: ninguna prima después de la ruina", () => {
    const state = createInitialState(19);
    const id = authorBuilding(state, 1);
    buy(state, id, "cash-buy");
    const contract = state.phase2.insurance.contractsByBuildingId[id]!;
    const premium = contract.premium;
    const paidBefore = contract.totalPremiumPaid;
    expect(premium).toBeGreaterThan(0);
    collapseByFire(state, id);
    const ruinTick = state.clock.tick;
    advanceHours(state, 24 * 40);
    /** Invariante 5: se cruza un cierre mensual y la póliza no vuelve a cobrar. */
    expect(state.phase2.insurance.contractsByBuildingId[id]!.totalPremiumPaid).toBe(paidBefore);
    expect(
      state.phase2.transactions.filter(
        (entry) =>
          entry.cause === "insurance_premium" &&
          entry.referenceId === id &&
          entry.tick >= ruinTick,
      ),
    ).toEqual([]);
  });

  it("la prima de una ruina deja de inflar los gastos previstos del jugador", () => {
    const state = createInitialState(23);
    const id = authorBuilding(state, 1);
    buy(state, id, "forecast-buy");
    const premium = state.phase2.insurance.contractsByBuildingId[id]!.premium;
    /**
     * Mismo tick, mismo edificio, misma ruina: lo único que cambia es el estado del contrato.
     * Aísla el canal del seguro del resto de componentes del forecast.
     */
    state.phase2.buildings.get(id)!.state = "ruin";
    const inflated = createViewProjection(state, true).economy?.financials?.forecast.expenses;
    const contract = state.phase2.insurance.contractsByBuildingId[id]!;
    contract.status = "cancelled";
    contract.nextPremiumTick = null;
    const corrected = createViewProjection(state, true).economy?.financials?.forecast.expenses;
    expect(inflated).toBeDefined();
    expect(corrected).toBeDefined();
    expect(inflated! - corrected!).toBe(premium);
  });
});