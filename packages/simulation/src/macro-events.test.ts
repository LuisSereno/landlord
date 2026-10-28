import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseMoney,
  parseOrganizationId,
  parseSeed,
  parseTenantId,
  parseTick,
  type Building,
  type MacroEventType,
  type Tenant,
} from "@landlord/shared";
import {
  BUILDING_DEFINITIONS,
  GAME_DAY_TICKS,
  GAME_MONTH_TICKS,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import {
  activateMacroEvent,
  activeMacroModifiers,
  aggregateMacroEventModifiers,
  effectiveMarketPriceFor,
  getActiveMacroEvents,
  initialMacroEventsState,
  macroEventId,
  MACRO_EVENT_POLICY,
  MACRO_EVENT_TEMPLATES,
  removeExpiredMacroEvents,
  rentModifierPercentFor,
  runMacroEvents,
} from "./macro-events";
import { askingRentFor, runHousingMarket } from "./housing-market";
import { runEmployment } from "./employment";
import { dispatchProductCommand } from "./commands";
import { createViewProjection } from "./projection";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { rivalParcel } from "./test-support";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

const ALL_TYPES = Object.keys(MACRO_EVENT_TEMPLATES) as MacroEventType[];

function expectMonthDuration(type: MacroEventType, months: number): void {
  expect(MACRO_EVENT_TEMPLATES[type].durationMonths).toBe(months);
}

/** Estado con el PRNG de shocks sembrado y el reloj quieto: no dispara nada por accidente. */
function idleState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.macroEvents = {
    ...initialMacroEventsState(parseSeed(seed)),
    nextCheckTick: parseTick(Number.MAX_SAFE_INTEGER),
  };
  state.phase2.rivalAi.cooldownUntilTick = parseTick(Number.MAX_SAFE_INTEGER);
  return state;
}

/** Planta un edificio en la parcela libre más cercana al centro: la cobertura radial queda alta. */
function addBuilding(
  state: GameState,
  index: number,
  tenants: number,
  type: Building["type"] = "courtyard_home",
): Building {
  const parcels = [...state.phase2.parcels.values()];
  const center = {
    x: Math.round(
      parcels.reduce((total, parcel) => total + parcel.anchorCell.x, 0) / parcels.length,
    ),
    y: Math.round(
      parcels.reduce((total, parcel) => total + parcel.anchorCell.y, 0) / parcels.length,
    ),
  };
  const used = new Set([...state.phase2.buildings.values()].map((building) => building.parcelId));
  const parcel = parcels
    .filter(
      (candidate) =>
        !candidate.buildingId &&
        !used.has(candidate.id) &&
        (type !== "cement_plant" || candidate.zoning !== "residential"),
    )
    .sort((left, right) => {
      const distance = (candidate: (typeof parcels)[number]) =>
        Math.abs(candidate.anchorCell.x - center.x) + Math.abs(candidate.anchorCell.y - center.y);
      return distance(left) - distance(right) || left.id.localeCompare(right.id);
    })[index % 6]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type,
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
  const capacity = type === "courtyard_home" ? 2 : 0;
  for (let seated = 0; seated < Math.min(tenants, capacity); seated += 1) {
    const tenantId = parseTenantId(`tenant_${String(index * 2 + seated + 1).padStart(8, "0")}`);
    const tenant: Tenant = {
      id: tenantId,
      profile: "household",
      budget: parseMoney(260),
      preferredBuildingType: "courtyard_home",
      activeContractBuildingId: id,
      satisfaction: 60,
      leaseRemaining: 24,
      status: "contracted",
      size: 3,
      segmentId: "household",
      searchMonths: 0,
      incomeFactorPercent: 100,
      origin: "authored",
    };
    state.phase2.tenants.set(tenantId, tenant);
    building.tenantIds.push(tenantId);
    building.tenantId = building.tenantIds[0]!;
  }
  return building;
}

describe("WP4.12-R macroeventos", () => {
  describe("calendario", () => {
    it("cada template dura los meses que declara, no días", () => {
      expectMonthDuration("material_scarcity", 3);
      expectMonthDuration("economic_recession", 6);
      expectMonthDuration("population_migration", 4);
      expectMonthDuration("construction_boom", 3);
      expectMonthDuration("housing_crisis", 5);
      expectMonthDuration("labor_shortage", 4);
      const state = initialMacroEventsState(parseSeed(1));
      for (const type of ALL_TYPES) {
        const updated = activateMacroEvent(state, type, parseTick(0), 1);
        const event = updated.events.at(-1)!;
        expect(event.endTick - event.startTick, type).toBe(
          MACRO_EVENT_TEMPLATES[type].durationMonths * GAME_MONTH_TICKS,
        );
      }
    });

    it("un evento activado en el tick cero sigue vivo en el primer cierre mensual", () => {
      const state = initialMacroEventsState(parseSeed(1));
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      expect(getActiveMacroEvents(updated, parseTick(GAME_MONTH_TICKS))).toHaveLength(1);
    });
  });

  describe("cota", () => {
    it("no apila dos eventos del mismo tipo", () => {
      const state = initialMacroEventsState(parseSeed(1));
      const first = activateMacroEvent(state, "economic_recession", parseTick(0), 1);
      const second = activateMacroEvent(first, "economic_recession", parseTick(10), 0.5);
      expect(second.events).toHaveLength(1);
      expect(second.nextEventOrdinal).toBe(first.nextEventOrdinal);
    });

    it("no supera el máximo de eventos activos", () => {
      let state = initialMacroEventsState(parseSeed(1));
      for (const type of [...ALL_TYPES, ...ALL_TYPES]) {
        state = activateMacroEvent(state, type, parseTick(0), 1);
      }
      expect(state.events).toHaveLength(MACRO_EVENT_POLICY.maxActiveEvents);
      expect(state.events).toHaveLength(ALL_TYPES.length);
    });

    it("los IDs son deterministas y no se repiten", () => {
      let state = initialMacroEventsState(parseSeed(1));
      for (const type of ALL_TYPES) state = activateMacroEvent(state, type, parseTick(0), 1);
      expect(state.events.map((event) => event.id)).toEqual(
        ALL_TYPES.map((_, index) => macroEventId(index + 1)),
      );
    });
  });

  describe("agregación", () => {
    it("suma aditivamente y escala por intensidad", () => {
      let state = initialMacroEventsState(parseSeed(1));
      state = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      state = activateMacroEvent(state, "construction_boom", parseTick(0), 0.5);
      const modifiers = aggregateMacroEventModifiers(state, parseTick(100));
      expect(modifiers.materialCostModifierPercent).toBe(25 + 5);
      expect(modifiers.constructionCostModifierPercent).toBe(-10);
    });

    it("ignora los expirados y el endTick es exclusivo", () => {
      const state = initialMacroEventsState(parseSeed(1));
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      const end = updated.events[0]!.endTick;
      expect(getActiveMacroEvents(updated, parseTick(end - 1))).toHaveLength(1);
      expect(getActiveMacroEvents(updated, end)).toHaveLength(0);
      expect(removeExpiredMacroEvents(updated, end).events).toHaveLength(0);
    });
  });

  describe("trigger", () => {
    it("es determinista por seed a lo largo de un año", () => {
      const run = () => {
        const state = createInitialState(23);
        for (let month = 1; month <= 12; month += 1) {
          state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
          runMacroEvents(state);
        }
        return state.phase2.macroEvents;
      };
      expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    });

    it("el sorteo no consume el PRNG económico", () => {
      const state = createInitialState(5);
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
      const economicBefore = { ...state.prng, state: [...state.prng.state] };
      const macroBefore = {
        ...state.phase2.macroEvents.prng,
        state: [...state.phase2.macroEvents.prng.state],
      };
      runMacroEvents(state);
      /** El sorteo ocurre seguro en este cierre: nextCheckTick arranca en el mes 1. */
      expect(state.phase2.macroEvents.nextCheckTick).toBe(GAME_MONTH_TICKS * 2);
      expect(state.prng).toEqual(economicBefore);
      expect(state.phase2.macroEvents.prng).not.toEqual(macroBefore);
    });

    it("produce shocks a lo largo de una campaña y nunca solapa dos", () => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const state = createInitialState(seed);
        let activeSeen = 0;
        for (let month = 1; month <= 60; month += 1) {
          state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
          runMacroEvents(state);
          activeSeen = Math.max(activeSeen, state.phase2.macroEvents.events.length);
        }
        expect(activeSeen, `seed ${seed}`).toBeLessThanOrEqual(1);
        total += state.phase2.macroEvents.nextEventOrdinal - 1;
      }
      expect(total).toBeGreaterThan(0);
    }, 120_000);

    it("respeta el calendario de sorteo mensual", () => {
      const state = createInitialState(11);
      state.phase2.macroEvents.nextCheckTick = parseTick(GAME_MONTH_TICKS * 2);
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 2) };
      runMacroEvents(state);
      expect(state.phase2.macroEvents.nextCheckTick).toBe(GAME_MONTH_TICKS * 3);
    });
  });

  describe("efectos económicos", () => {
    it("comprar materiales paga el precio con el modifier de escasez", () => {
      const state = idleState(7);
      state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(10_000));
      const before = state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
      const buy = dispatchProductCommand(state, {
        commandId: "command_00000001" as never,
        issuedByPersonId: "person_00000001" as never,
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type: "BuyMaterials",
        payload: { resource: "cement", amount: 2 },
      });
      expect(buy.accepted).toBe(true);
      const paidWithout = before - state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;

      const shocked = idleState(7);
      shocked.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(10_000));
      shocked.phase2.macroEvents = activateMacroEvent(
        shocked.phase2.macroEvents,
        "material_scarcity",
        parseTick(0),
        1,
      );
      const shockedBefore = shocked.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
      const shockedBuy = dispatchProductCommand(shocked, {
        commandId: "command_00000002" as never,
        issuedByPersonId: "person_00000001" as never,
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type: "BuyMaterials",
        payload: { resource: "cement", amount: 2 },
      });
      expect(shockedBuy.accepted).toBe(true);
      const paidWith = shockedBefore - shocked.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
      expect(paidWith).toBeGreaterThan(paidWithout);
      expect(paidWith).toBe(2 * 113);
      expect(effectiveMarketPriceFor(shocked, "cement")).toBe(113);
    });

    it("la renta sube con crisis de vivienda y baja con recesión", () => {
      const state = idleState(7);
      const building = addBuilding(state, 0, 0);
      const base = askingRentFor(state, building);
      const recession = idleState(7);
      recession.phase2.macroEvents = activateMacroEvent(
        recession.phase2.macroEvents,
        "economic_recession",
        parseTick(0),
        1,
      );
      expect(rentModifierPercentFor(recession)).toBe(-15);
      expect(askingRentFor(recession, building)).toBeLessThan(base);

      const crisis = idleState(7);
      crisis.phase2.macroEvents = activateMacroEvent(
        crisis.phase2.macroEvents,
        "housing_crisis",
        parseTick(0),
        1,
      );
      expect(askingRentFor(crisis, building)).toBeGreaterThan(base);
    });

    it("la escasez de mano de obra empuja el salario y el ingreso de los hogares", () => {
      const state = idleState(7);
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
      runEmployment(state);
      const baselineSalary = state.phase2.employment.salaryIndexPercent;

      const shocked = idleState(7);
      shocked.clock = { ...shocked.clock, tick: parseTick(GAME_MONTH_TICKS) };
      shocked.phase2.macroEvents = activateMacroEvent(
        shocked.phase2.macroEvents,
        "labor_shortage",
        parseTick(0),
        1,
      );
      runEmployment(shocked);
      expect(shocked.phase2.employment.salaryIndexPercent).toBe(baselineSalary + 2);
    });

    it("la migración admite más hogares que el mercado sin shock", () => {
      const settleMonths = (state: GameState) => {
        for (let index = 0; index < 6; index += 1) addBuilding(state, index, 0);
        /** Una planta operativa da empleo al segmento y lleva el atractivo al máximo. */
        addBuilding(state, 6, 0, "cement_plant");
        for (let month = 1; month <= 3; month += 1) {
          state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
          runHousingMarket(state);
        }
        return state.phase2.housingMarket.arrivalsTotal;
      };
      const baselineArrivals = settleMonths(idleState(7));

      const migration = idleState(7);
      migration.phase2.macroEvents = activateMacroEvent(
        migration.phase2.macroEvents,
        "population_migration",
        parseTick(0),
        1,
      );
      const migrationArrivals = settleMonths(migration);
      expect(activeMacroModifiers(migration).demandModifierPercent).toBe(30);
      expect(migrationArrivals).toBeGreaterThan(baselineArrivals);
    });

    it("la recesión escala la señal de vacancia que mueve el índice de renta", () => {
      const baseline = idleState(7);
      for (let index = 0; index < 6; index += 1) addBuilding(baseline, index, index < 5 ? 2 : 1);
      baseline.clock = { ...baseline.clock, tick: parseTick(GAME_MONTH_TICKS) };
      runHousingMarket(baseline);
      const baselineIndex =
        baseline.phase2.housingMarket.rentIndexPercentByBuildingType["courtyard_home"]!;

      const recession = idleState(7);
      for (let index = 0; index < 6; index += 1) addBuilding(recession, index, index < 5 ? 2 : 1);
      recession.phase2.macroEvents = activateMacroEvent(
        recession.phase2.macroEvents,
        "economic_recession",
        parseTick(0),
        1,
      );
      recession.clock = { ...recession.clock, tick: parseTick(GAME_MONTH_TICKS) };
      runHousingMarket(recession);
      expect(
        recession.phase2.housingMarket.rentIndexPercentByBuildingType["courtyard_home"]!,
      ).toBeLessThan(baselineIndex);
    });

    it("el modifier de obra cambia el esfuerzo requerido, no un coste en caja artificial", () => {
      const state = idleState(7);
      const parcel = [...state.phase2.parcels.values()].find(
        (candidate) => candidate.ownerOrganizationId === null && candidate.zoning !== "industrial",
      )!;
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      state.phase2.permitting.permitsByParcelId[parcel.id] = {
        parcelId: parcel.id,
        buildingType: "courtyard_home",
        authorityOrganizationId: parseOrganizationId("org_00000004"),
        requirements: [],
        zoningAtDecision: parcel.zoning,
        status: "approved",
        requestedAtTick: parseTick(0),
        decidedAtTick: parseTick(0),
        expiresAtTick: null,
      };
      state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(50_000));
      state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!.cement = 20;
      state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!.brick = 20;
      state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!.steel = 20;
      const hoursWithoutShock = createViewProjection(state, true).economy!.constructionOptions.find(
        (entry) => entry.type === "courtyard_home",
      )!.workRequired;
      expect(hoursWithoutShock).toBe(BUILDING_DEFINITIONS["courtyard_home"].workRequired);
      state.phase2.macroEvents = activateMacroEvent(
        state.phase2.macroEvents,
        "construction_boom",
        parseTick(0),
        1,
      );
      const result = dispatchProductCommand(state, {
        commandId: "command_00000003" as never,
        issuedByPersonId: "person_00000001" as never,
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type: "StartConstruction",
        payload: { parcelId: parcel.id, buildingType: "courtyard_home" },
      });
      expect(result.accepted).toBe(true);
      const site = [...state.phase2.constructionSites.values()][0]!;
      /** courtyard_home declara 96 de obra: ×2 del sitio y −20 % del auge = 154. */
      expect(site.workRequired).toBe(154);
      const option = createViewProjection(state, true).economy!.constructionOptions.find(
        (entry) => entry.type === "courtyard_home",
      )!;
      /** La UI publica la misma obra que ejecuta el motor: 154 medias horas = 77 h. */
      expect(option.workRequired).toBe(77);
      expect(option.workRequired * 2).toBe(site.workRequired);
    });
  });

  describe("reacción de la IA", () => {
    it("con recesión el rival prefiere vender a comprar materiales", () => {
      const dispatchRivalAction = (withRecession: boolean) => {
        const state = createInitialState(7);
        state.phase2.balances.set(parseOrganizationId("org_00000002"), parseMoney(1_000));
        state.phase2.rivalAi.cooldownUntilTick = parseTick(0);
        const parcel = rivalParcel(state, (candidate) => candidate.ownerOrganizationId === null);
        parcel.ownerOrganizationId = parseOrganizationId("org_00000002");
        const inventory = state.phase2.inventories.get(parseOrganizationId("org_00000002"))!;
        inventory.cement = 0;
        inventory.brick = 0;
        inventory.steel = 0;
        inventory.capacity = 40;
        if (withRecession) {
          state.phase2.macroEvents = activateMacroEvent(
            state.phase2.macroEvents,
            "economic_recession",
            parseTick(0),
            1,
          );
        }
        state.clock = { ...state.clock, tick: parseTick(GAME_DAY_TICKS) };
        advanceProductSystems(state);
        return state.phase2.rivalAi.lastAction;
      };
      expect(dispatchRivalAction(false)).toBe("buy_materials");
      expect(dispatchRivalAction(true)).toBe("sell_parcel");
    });
  });

  describe("persistencia y estado canónico", () => {
    it("guarda y carga un evento activo con todos sus campos y la misma expiración", () => {
      const state = idleState(7);
      state.phase2.macroEvents = activateMacroEvent(
        state.phase2.macroEvents,
        "housing_crisis",
        parseTick(500),
        0.8,
      );
      const restored = restoreStateFromSnapshot(serializeSnapshot(state));
      expect(restored.phase2.macroEvents.events).toEqual(state.phase2.macroEvents.events);
      expect(restored.phase2.macroEvents.prng).toEqual(state.phase2.macroEvents.prng);
      expect(restored.phase2.macroEvents.nextCheckTick).toBe(
        state.phase2.macroEvents.nextCheckTick,
      );
      /** La misma expiración: al cruzar el endTick el evento desaparece en ambos. */
      const end = state.phase2.macroEvents.events[0]!.endTick;
      runMacroEvents(state);
      state.clock = { ...state.clock, tick: parseTick(end) };
      restored.clock = { ...restored.clock, tick: parseTick(end) };
      runMacroEvents(state);
      runMacroEvents(restored);
      expect(state.phase2.macroEvents.events).toHaveLength(0);
      expect(restored.phase2.macroEvents.events).toHaveLength(0);
    });

    it("el estado canónico distingue un evento activo de ninguno", () => {
      const state = idleState(7);
      const baseline = canonicalizeState(state);
      state.phase2.macroEvents = activateMacroEvent(
        state.phase2.macroEvents,
        "material_scarcity",
        parseTick(0),
        1,
      );
      expect(canonicalizeState(state)).not.toBe(baseline);
    });

    it("las partidas anteriores a WP4.12-R se restauran con arroyo derivado de la seed", () => {
      const state = idleState(7);
      const snapshot = serializeSnapshot(state) as unknown as {
        phase2: { macroEvents?: Record<string, unknown> };
      };
      const legacy = JSON.parse(JSON.stringify(snapshot));
      delete legacy.phase2.macroEvents!.prng;
      delete legacy.phase2.macroEvents!.nextCheckTick;
      const restored = restoreStateFromSnapshot(legacy);
      expect(restored.phase2.macroEvents.prng.algorithm).toBe("xoshiro128ss-v1");
      expect(restored.phase2.macroEvents.nextCheckTick).toBe(GAME_MONTH_TICKS);
    });
  });
});
