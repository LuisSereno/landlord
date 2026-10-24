import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parsePersonId,
  parseTick,
  type Building,
  type BuildingId,
  type Money,
  type OrganizationId,
  type PublicContract,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  GAME_DAY_TICKS,
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import {
  PUBLIC_CONTRACTS_POLICY,
  bondFor,
  initialPublicContractsState,
  operationalBuildingsOwned,
  runPublicContracts,
} from "./public-contracts";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(10_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addBuilding(state: GameState, index: number, owner: OrganizationId): BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = owner;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
    ownerOrganizationId: owner,
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

function publish(state: GameState, overrides: Partial<PublicContract> = {}): PublicContract {
  const id = `contract_${String(state.phase2.contracts.nextOrdinal).padStart(8, "0")}`;
  const contract: PublicContract = {
    id,
    kind: "public_works",
    title: "Obra de prueba",
    budget: parseMoney(400),
    bond: parseMoney(40),
    requiredBuildings: 1,
    publishedAtTick: parseTick(state.clock.tick),
    closesAtTick: parseTick(state.clock.tick + GAME_MONTH_TICKS),
    executesAtTick: parseTick(state.clock.tick + 2 * GAME_MONTH_TICKS),
    status: "open",
    awardedToOrganizationId: null,
    awardedAmount: null,
    bids: [],
    ...overrides,
  };
  state.phase2.contracts.contracts[contract.id] = contract;
  state.phase2.contracts.nextOrdinal += 1;
  return contract;
}

function bid(state: GameState, organizationId: OrganizationId, contractId: string, amount: Money) {
  return dispatchProductCommand(state, {
    type: "SubmitPublicBid",
    commandId: parseCommandId(`contract-bid-${contractId}-${organizationId}-${amount}`),
    issuedByPersonId: parsePersonId(
      organizationId === RIVAL_ORGANIZATION_ID ? "person_00000002" : "person_00000001",
    ),
    actingAsOrganizationId: organizationId,
    payload: { contractId, amount },
  });
}

function at(state: GameState, tick: number): void {
  state.clock = { ...state.clock, tick: parseTick(tick) };
}

describe("WP4.7 contratos públicos", () => {
  it("publica por calendario y respeta el máximo de licitaciones abiertas", () => {
    const state = newState();
    at(state, GAME_MONTH_TICKS);
    runPublicContracts(state);
    expect(Object.keys(state.phase2.contracts.contracts)).toHaveLength(0);

    at(state, 2 * GAME_MONTH_TICKS);
    runPublicContracts(state);
    const published = Object.values(state.phase2.contracts.contracts);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      id: "contract_00000001",
      status: "open",
      budget: PUBLIC_CONTRACTS_POLICY.catalog[0]!.budget,
      bond: bondFor(PUBLIC_CONTRACTS_POLICY.catalog[0]!.budget),
      closesAtTick: 3 * GAME_MONTH_TICKS,
    });
    expect(state.phase2.contracts.lastPublishedTick).toBe(2 * GAME_MONTH_TICKS);

    // Con dos licitaciones abiertas, el calendario no publica una tercera.
    at(state, 5 * GAME_MONTH_TICKS);
    publish(state);
    publish(state);
    runPublicContracts(state);
    expect(Object.keys(state.phase2.contracts.contracts)).toHaveLength(3);
  });

  it("cierra sin ofertas como desierta y no mueve caja", () => {
    const state = newState();
    const contract = publish(state);
    const before = serializeSnapshot(state).phase2!.balances;

    at(state, contract.closesAtTick);
    runPublicContracts(state);

    expect(contract.status).toBe("failed");
    expect(serializeSnapshot(state).phase2!.balances).toEqual(before);
    expect(state.phase2.contracts.reliabilityByOrganizationId).toEqual({});
  });

  it("adjudica al mejor postor y desempata de forma determinista", () => {
    const state = newState();
    addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
    addBuilding(state, 1, RIVAL_ORGANIZATION_ID);
    const contract = publish(state);

    expect(bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(320))).toMatchObject({
      accepted: true,
    });
    expect(bid(state, RIVAL_ORGANIZATION_ID, contract.id, parseMoney(300))).toMatchObject({
      accepted: true,
    });

    at(state, contract.closesAtTick);
    runPublicContracts(state);

    expect(contract.status).toBe("awarded");
    expect(contract.awardedToOrganizationId).toBe(RIVAL_ORGANIZATION_ID);
    expect(contract.awardedAmount).toBe(300);
    expect(state.phase2.balances.get(RIVAL_ORGANIZATION_ID)).toBe(12_000 - 40);
    expect(state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID)).toBe(10_040);
    expect(state.phase2.contracts.reliabilityByOrganizationId[RIVAL_ORGANIZATION_ID]).toEqual({
      awarded: 1,
      completed: 0,
      defaulted: 0,
    });

    const tied = newState();
    addBuilding(tied, 0, PLAYER_ORGANIZATION_ID);
    addBuilding(tied, 1, RIVAL_ORGANIZATION_ID);
    const tie = publish(tied);
    bid(tied, RIVAL_ORGANIZATION_ID, tie.id, parseMoney(280));
    bid(tied, PLAYER_ORGANIZATION_ID, tie.id, parseMoney(280));
    at(tied, tie.closesAtTick);
    runPublicContracts(tied);
    // Mismo importe: decide el identificador de organización, no el orden de llegada.
    expect(tie.awardedToOrganizationId).toBe(PLAYER_ORGANIZATION_ID);
  });

  it("devuelve la fianza y paga la obra al completar", () => {
    const state = newState();
    addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
    const contract = publish(state);
    const totalMoney = (): number =>
      [...state.phase2.balances.values()].reduce((sum, balance) => sum + balance, 0);
    const initialMoney = totalMoney();
    bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(350));
    at(state, contract.closesAtTick);
    runPublicContracts(state);

    const playerAfterBond = state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
    expect(playerAfterBond).toBe(5_000_000 - 40);
    expect(state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID)).toBe(10_040);
    // La fianza es un traspaso, no una destrucción de caja.
    expect(totalMoney()).toBe(initialMoney);

    at(state, contract.executesAtTick);
    runPublicContracts(state);

    expect(contract.status).toBe("completed");
    expect(totalMoney()).toBe(initialMoney);
    expect(state.phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(playerAfterBond + 390);
    expect(state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID)).toBe(10_040 - 390);
    expect(state.phase2.contracts.reliabilityByOrganizationId[PLAYER_ORGANIZATION_ID]).toEqual({
      awarded: 1,
      completed: 1,
      defaulted: 0,
    });
  });

  it("incumplir cuesta la fianza y queda en el historial de fiabilidad", () => {
    const state = newState();
    const buildingId = addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
    const contract = publish(state);
    bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(350));
    at(state, contract.closesAtTick);
    runPublicContracts(state);
    expect(contract.status).toBe("awarded");

    state.phase2.buildings.get(buildingId)!.state = "ruin";
    expect(operationalBuildingsOwned(state, PLAYER_ORGANIZATION_ID)).toBe(0);
    const playerAfterBond = state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;

    at(state, contract.executesAtTick);
    runPublicContracts(state);

    expect(contract.status).toBe("defaulted");
    expect(state.phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(playerAfterBond);
    expect(state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID)).toBe(10_040);
    expect(state.phase2.contracts.reliabilityByOrganizationId[PLAYER_ORGANIZATION_ID]).toEqual({
      awarded: 1,
      completed: 0,
      defaulted: 1,
    });
  });

  it("rechaza ofertas fuera de plazo, duplicadas, sin capacidad o sin fianza", () => {
    const state = newState();
    const contract = publish(state);
    expect(bid(state, PLAYER_ORGANIZATION_ID, "contract_99999999", parseMoney(100))).toEqual({
      accepted: false,
      code: "CONTRACT_NOT_FOUND",
    });
    expect(bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(500))).toEqual({
      accepted: false,
      code: "BID_EXCEEDS_BUDGET",
    });
    // Sin edificios operativos no se puede ejecutar una obra pública.
    expect(bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(300))).toEqual({
      accepted: false,
      code: "CONTRACT_CAPACITY",
    });

    addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
    expect(bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(300))).toMatchObject({
      accepted: true,
    });
    expect(bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(290))).toEqual({
      accepted: false,
      code: "BID_ALREADY_SUBMITTED",
    });

    at(state, contract.closesAtTick);
    expect(bid(state, RIVAL_ORGANIZATION_ID, contract.id, parseMoney(250))).toEqual({
      accepted: false,
      code: "CONTRACT_CLOSED",
    });

    const second = publish(state, { id: "contract_00000009" });
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(10));
    expect(bid(state, PLAYER_ORGANIZATION_ID, second.id, parseMoney(200))).toEqual({
      accepted: false,
      code: "BOND_UNAVAILABLE",
    });

    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
    at(state, contract.closesAtTick);
    runPublicContracts(state);
    expect(contract.status).toBe("awarded");
    expect(bid(state, PLAYER_ORGANIZATION_ID, second.id, parseMoney(200))).toEqual({
      accepted: false,
      code: "CONTRACT_CONFLICT",
    });
  });

  it("el rival compite con el mismo comando y respeta la capacidad", () => {
    const state = newState();
    state.phase2.rivalAi.cooldownUntilTick = parseTick(0);
    // La obra exige un edificio operativo que el rival no tiene; el suministro no exige ninguno.
    const works = publish(state, { requiredBuildings: 1, budget: parseMoney(420) });
    const supply = publish(state, {
      kind: "supply",
      title: "Suministro de prueba",
      budget: parseMoney(260),
      bond: parseMoney(26),
      requiredBuildings: 0,
    });

    at(state, GAME_DAY_TICKS);
    advanceProductSystems(state);

    expect(works.bids).toHaveLength(0);
    expect(supply.bids).toHaveLength(1);
    expect(supply.bids[0]).toMatchObject({
      organizationId: RIVAL_ORGANIZATION_ID,
      amount: Math.floor((260 * PUBLIC_CONTRACTS_POLICY.rivalBidPercent) / 100),
    });
    expect(state.phase2.rivalAi.lastAction).toBe("bid_public_contract");
  });

  it("sobrevive a guardar y cargar y migra partidas anteriores", () => {
    const state = newState();
    addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
    const contract = publish(state);
    bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(300));
    at(state, contract.closesAtTick);
    runPublicContracts(state);
    at(state, contract.executesAtTick);
    runPublicContracts(state);

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
    expect(restored.phase2.contracts).toEqual(state.phase2.contracts);

    const raw = JSON.parse(JSON.stringify(serializeSnapshot(state))) as {
      phase2: { contracts?: unknown };
    };
    delete raw.phase2.contracts;
    const legacy = restoreStateFromSnapshot(raw);
    expect(legacy.phase2.contracts).toEqual(initialPublicContractsState());
  });

  it("dos partidas con la misma seed y las mismas ofertas convergen", () => {
    const run = (): string => {
      const state = newState(11);
      addBuilding(state, 0, PLAYER_ORGANIZATION_ID);
      addBuilding(state, 1, RIVAL_ORGANIZATION_ID);
      const contract = publish(state);
      bid(state, PLAYER_ORGANIZATION_ID, contract.id, parseMoney(310));
      bid(state, RIVAL_ORGANIZATION_ID, contract.id, parseMoney(305));
      at(state, contract.closesAtTick);
      runPublicContracts(state);
      at(state, contract.executesAtTick);
      runPublicContracts(state);
      // El snapshot completo incluye contratos y fiabilidad; `canonicalizeState` todavía no
      // serializa los agregados económicos de WP4.3–WP4.7 (deuda documentada).
      return JSON.stringify(serializeSnapshot(state));
    };
    expect(run()).toBe(run());
  });
});
