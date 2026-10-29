import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseIncidentId,
  parseMoney,
  parseSeed,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingId,
  type BuildingType,
  type GridCell,
  type Tenant,
  type TenantId,
} from "@landlord/shared";
import { BUILDING_DEFINITIONS, GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import {
  countNeighbours,
  HOUSING_MARKET_POLICY,
  HOUSING_SEGMENTS,
  askingRentFor,
  describeHousingMarket,
  describeHousingStock,
  desirabilityOf,
  indexCells,
  runHousingMarket,
  vacancyPercentByBuildingType,
} from "./housing-market";
import { Xoshiro128ss } from "./prng";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { buildCoverageIndex } from "./urban-services";
import { advanceProductSystems } from "./systems";

/** Distrito de prueba con el rival y las finanzas acallados: el mercado es el único sujeto. */
function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addBuilding(
  state: GameState,
  index: number,
  type: BuildingType,
  options: { condition?: number; cell?: { x: number; y: number } } = {},
): BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  if (options.cell) parcel.anchorCell = { ...options.cell };
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
    type,
    level: 1,
    condition: options.condition ?? 100,
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

function addTenant(state: GameState, id: number, overrides: Partial<Tenant> = {}): TenantId {
  const tenantId = parseTenantId(`tenant_${String(id).padStart(8, "0")}`);
  const tenant: Tenant = {
    id: tenantId,
    profile: "household",
    budget: parseMoney(220),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    marketDistrictId: null,
    satisfaction: 60,
    leaseRemaining: 0,
    status: "available",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    ...overrides,
  };
  state.phase2.tenants.set(tenantId, tenant);
  return tenantId;
}

function seat(state: GameState, buildingId: BuildingId, tenantId: TenantId): void {
  const building = state.phase2.buildings.get(buildingId)!;
  const tenant = state.phase2.tenants.get(tenantId)!;
  building.tenantIds.push(tenantId);
  building.tenantId = building.tenantIds[0]!;
  tenant.activeContractBuildingId = buildingId;
  tenant.status = "contracted";
  tenant.leaseRemaining = 24;
}

function settleAt(state: GameState, tick: number): void {
  state.clock = { ...state.clock, tick: parseTick(tick) };
  runHousingMarket(state);
}

function months(state: GameState, count: number, from = 0): void {
  for (let index = 1; index <= count; index += 1) {
    state.clock = { ...state.clock, tick: parseTick((from + index) * GAME_MONTH_TICKS) };
    advanceProductSystems(state);
  }
}

function occupiedSlots(state: GameState): number {
  let total = 0;
  for (const building of state.phase2.buildings.values()) total += building.tenantIds.length;
  return total;
}

function vacantSlots(state: GameState): number {
  return describeHousingStock(state).reduce((total, unit) => total + unit.vacantSlots, 0);
}

function fillBuildings(state: GameState, capacity: number): void {
  let index = 1_000;
  for (const building of [...state.phase2.buildings.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    for (let slot = 0; slot < capacity; slot += 1) {
      index += 1;
      seat(state, building.id, addTenant(state, index));
    }
  }
}

describe("WP4.3 oferta y demanda de vivienda", () => {
  it("no crea demanda de la nada y retira a quien no encuentra vivienda", () => {
    const state = newState();
    months(state, 1);

    expect(state.phase2.housingMarket.arrivalsTotal).toBe(0);
    expect(state.phase2.tenants.size).toBe(4);
    expect(Object.values(vacancyPercentByBuildingType(state)).every((value) => value === 0)).toBe(
      true,
    );

    months(state, 6, 1);

    // Los cuatro hogares autorados agotan su búsqueda: sin oferta, el mercado se vacía solo.
    expect(state.phase2.tenants.size).toBe(0);
    expect(state.phase2.housingMarket.departuresTotal).toBe(4);
    expect(state.phase2.housingMarket.arrivalsTotal).toBe(0);
  });

  it("construir más plazas no garantiza ocuparlas", () => {
    const compact = newState(11);
    for (let index = 0; index < 12; index += 1) addBuilding(compact, index, "courtyard_home");
    const generous = newState(11);
    for (let index = 0; index < 20; index += 1) addBuilding(generous, index, "courtyard_home");

    months(compact, 24);
    months(generous, 24);

    expect(occupiedSlots(compact)).toBeGreaterThan(0);
    expect(occupiedSlots(generous)).toBeLessThanOrEqual(HOUSING_SEGMENTS.household.populationCap);
    // Dieciséis plazas más no producen dieciséis hogares más: la ocupación la fija la demanda.
    expect(occupiedSlots(generous)).toBeLessThanOrEqual(occupiedSlots(compact) + 2);
    expect(vacantSlots(generous)).toBeGreaterThanOrEqual(vacantSlots(compact) + 10);
    expect(describeHousingMarket(generous)[0]!.population).toBeLessThanOrEqual(
      HOUSING_SEGMENTS.household.populationCap,
    );
  });

  it("sube el índice sin vacancia y lo baja con el parque vacío", () => {
    const empty = newState();
    for (let index = 0; index < 4; index += 1) addBuilding(empty, index, "courtyard_home");
    settleAt(empty, GAME_MONTH_TICKS);
    expect(empty.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home).toBe(
      100 - HOUSING_MARKET_POLICY.maximumIndexStepPercent,
    );

    const full = newState();
    for (let index = 0; index < 4; index += 1) addBuilding(full, index, "courtyard_home");
    fillBuildings(full, 2);
    expect(vacantSlots(full)).toBe(0);
    settleAt(full, GAME_MONTH_TICKS);
    expect(full.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home).toBe(
      100 + HOUSING_MARKET_POLICY.maximumIndexStepPercent,
    );
  });

  it("no fija precio con un único edificio del tipo", () => {
    const state = newState();
    addBuilding(state, 0, "courtyard_home");
    settleAt(state, GAME_MONTH_TICKS);
    expect(state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home).toBe(100);
  });

  it("el índice nunca sale de la banda acotada", () => {
    const state = newState();
    for (let index = 0; index < 4; index += 1) addBuilding(state, index, "courtyard_home");
    for (let month = 1; month <= 12; month += 1) settleAt(state, month * GAME_MONTH_TICKS);
    const index = state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home!;
    expect(index).toBeGreaterThanOrEqual(HOUSING_MARKET_POLICY.minimumIndexPercent);
    expect(index).toBeLessThanOrEqual(HOUSING_MARKET_POLICY.maximumIndexPercent);
  });

  it("un shock de renta corta la asequibilidad y frena las llegadas", () => {
    const state = newState(13);
    for (let index = 0; index < 6; index += 1) addBuilding(state, index, "courtyard_home");
    months(state, 4);

    const beforeShock = state.phase2.housingMarket.arrivalsTotal;
    const demandBefore = describeHousingMarket(state)[0]!;
    expect(demandBefore.affordableVacantSlots).toBeGreaterThan(0);

    state.phase2.ordinance.status = "active";
    state.phase2.ordinance.rentModifierPercent = 100;
    months(state, 1, 4);

    const demandAfter = describeHousingMarket(state)[0]!;
    expect(demandAfter.affordableVacantSlots).toBe(0);
    expect(demandAfter.vacantSlots).toBeGreaterThan(0);
    expect(state.phase2.housingMarket.arrivalsTotal).toBe(beforeShock);

    const seatedBefore = occupiedSlots(state);
    months(state, 4, 5);
    // La renta impagable erosiona la satisfacción y acaba desalojando hogares.
    expect(occupiedSlots(state)).toBeLessThan(seatedBefore);
  });

  it("el mercado coloca al hogar en la vivienda más deseable que puede pagar", () => {
    const state = newState();
    const degraded = addBuilding(state, 0, "courtyard_home", {
      condition: 45,
      cell: { x: 20, y: 20 },
    });
    const pristine = addBuilding(state, 1, "courtyard_home", {
      condition: 100,
      cell: { x: 21, y: 20 },
    });
    const searcher = addTenant(state, 500, { origin: "market", searchMonths: 1 });

    settleAt(state, GAME_MONTH_TICKS);

    expect(state.phase2.buildings.get(pristine)?.tenantIds).toContain(searcher);
    expect(state.phase2.buildings.get(degraded)?.tenantIds).not.toContain(searcher);
  });

  it("pondera calidad, accesibilidad, seguridad y servicios según el segmento", () => {
    const housing = HOUSING_SEGMENTS.household;
    const maker = HOUSING_SEGMENTS.maker;
    const qualityOnly = { quality: 100, accessibility: 0, safety: 0, services: 0 };
    const centralityOnly = { quality: 0, accessibility: 100, safety: 0, services: 0 };
    const safetyOnly = { quality: 0, accessibility: 0, safety: 100, services: 0 };

    expect(desirabilityOf(qualityOnly, housing)).toBeGreaterThan(
      desirabilityOf(safetyOnly, housing),
    );
    expect(desirabilityOf(qualityOnly, housing)).toBeGreaterThan(
      desirabilityOf(centralityOnly, housing),
    );
    expect(desirabilityOf(centralityOnly, maker)).toBeGreaterThan(
      desirabilityOf(centralityOnly, housing),
    );
    expect(desirabilityOf(qualityOnly, maker)).toBeLessThan(desirabilityOf(qualityOnly, housing));
  });

  it("la seguridad de una parcela cae con un siniestro cerca y no con uno lejos", () => {
    const state = newState();
    // Ambos edificios a la misma distancia del centro para que la cobertura de seguridad sea
    // idéntica y sólo cambie la proximidad al siniestro.
    const near = addBuilding(state, 0, "courtyard_home", { cell: { x: 10, y: 10 } });
    const far = addBuilding(state, 1, "courtyard_home", { cell: { x: 10, y: 20 } });
    const burning = addBuilding(state, 2, "courtyard_home", { cell: { x: 11, y: 10 } });
    const coverage = buildCoverageIndex(state);
    const nearParcel = state.phase2.buildings.get(near)!.parcelId;
    const farParcel = state.phase2.buildings.get(far)!.parcelId;
    /** La limpieza es radial dentro del distrito de las parcelas, no del centro de la ciudad. */
    const center = coverage.cleaningByDistrictId.get(
      state.phase2.parcels.get(nearParcel)!.districtId,
    )!.center;
    state.phase2.parcels.get(nearParcel)!.anchorCell = { x: center.x - 5, y: center.y };
    state.phase2.parcels.get(farParcel)!.anchorCell = { x: center.x + 5, y: center.y };
    state.phase2.parcels.get(state.phase2.buildings.get(burning)!.parcelId)!.anchorCell = {
      x: center.x - 6,
      y: center.y,
    };
    state.phase2.buildings.get(burning)!.state = "burning";
    const incidentId = parseIncidentId("incident_00000001");
    state.phase2.incidents.set(incidentId, {
      id: incidentId,
      buildingId: burning,
      origin: "deterioration",
      intensity: 40,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: null,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });

    const stock = describeHousingStock(state);
    const nearUnit = stock.find((unit) => unit.buildingId === near)!;
    const farUnit = stock.find((unit) => unit.buildingId === far)!;

    expect(nearUnit.safety).toBeLessThan(100);
    expect(nearUnit.safety).toBeLessThan(farUnit.safety);
    // WP4.6: la cobertura de seguridad es radial, así que el borde del distrito también pierde
    // puntos aunque no haya ningún siniestro cerca.
    expect(farUnit.safety).toBeLessThan(100);
  });

  it("es determinista y sobrevive a guardar y cargar", () => {
    const setup = (): GameState => {
      const state = newState(17);
      for (let index = 0; index < 6; index += 1) addBuilding(state, index, "courtyard_home");
      return state;
    };
    const first = setup();
    const second = setup();
    months(first, 12);
    months(second, 12);
    expect(canonicalizeState(first)).toBe(canonicalizeState(second));

    const saved = setup();
    months(saved, 5);
    const restored = restoreStateFromSnapshot(serializeSnapshot(saved));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(saved));
    months(saved, 3, 5);
    months(restored, 3, 5);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(saved));
  });

  it("una partida anterior a WP4.3 carga con el mercado por defecto y sin perder hogares", () => {
    const state = newState(19);
    addBuilding(state, 0, "courtyard_home");
    const raw = JSON.parse(JSON.stringify(serializeSnapshot(state))) as {
      phase2: {
        housingMarket?: unknown;
        tenants: Array<Record<string, unknown>>;
      };
    };
    delete raw.phase2.housingMarket;
    for (const tenant of raw.phase2.tenants) {
      delete tenant.size;
      delete tenant.segmentId;
      delete tenant.searchMonths;
      delete tenant.origin;
    }

    const restored = restoreStateFromSnapshot(raw);

    expect(restored.phase2.housingMarket).toEqual({
      rentIndexPercentByBuildingType: Object.fromEntries(
        Object.keys(BUILDING_DEFINITIONS).map((type) => [type, 100]),
      ),
      byDistrictId: expect.any(Object),
      lastSettlementTick: null,
      arrivalsTotal: 0,
      departuresTotal: 0,
      nextTenantOrdinal: 1,
    });
    expect(Object.keys(restored.phase2.housingMarket.byDistrictId)).toHaveLength(9);
    expect([...restored.phase2.tenants.values()].map((tenant) => tenant.size)).toEqual([
      3, 2, 2, 3,
    ]);
    expect([...restored.phase2.tenants.values()].map((tenant) => tenant.segmentId)).toEqual([
      "household",
      "maker",
      "shopkeeper",
      "household",
    ]);
    expect(
      [...restored.phase2.tenants.values()].every((tenant) => tenant.origin === "authored"),
    ).toBe(true);
  });

  it("el índice llega a la renta que valida un contrato y a la que cobra el motor", () => {
    const state = newState();
    const buildingId = addBuilding(state, 0, "courtyard_home");
    const building = state.phase2.buildings.get(buildingId)!;
    const base = askingRentFor(state, building);

    state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home = 110;

    expect(base).toBe(180);
    expect(askingRentFor(state, building)).toBe(198);
  });

  it("el índice espacial cuenta exactamente los mismos vecinos que el barrido completo", () => {
    const prng = new Xoshiro128ss(parseSeed(11));
    const cells: GridCell[] = [];
    for (let index = 0; index < 400; index += 1) {
      cells.push({ x: prng.nextInt(0, 63), y: prng.nextInt(0, 63) });
    }
    /** Fronteras de bucket (radio 6 → bucket de 7) y dos edificios compartiendo celda. */
    cells.push({ x: 6, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 7 }, { x: 0, y: 13 }, { x: 13, y: 0 });

    const districtId = createInitialState(7).world.city.districtIds[0]!;
    const buckets = indexCells(cells.map((cell) => ({ districtId, cell })));
    const radius = HOUSING_MARKET_POLICY.serviceRadiusCells;
    for (const cell of cells) {
      const bruteForce =
        cells.filter((other) => Math.abs(other.x - cell.x) + Math.abs(other.y - cell.y) <= radius)
          .length - 1;
      expect(countNeighbours({ districtId, cell }, buckets), `${cell.x},${cell.y}`).toBe(
        bruteForce,
      );
    }
  });
});
