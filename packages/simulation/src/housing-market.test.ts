import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parsePersonId,
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
import { dispatchProductCommand } from "./commands";
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
    parcelIds: [parcel.id],
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
  it("expone demanda inicial para todos los productos alquilables y conserva el pool autorado sin oferta", () => {
    const state = newState();

    expect(
      [...state.phase2.tenants.values()]
        .filter((tenant) => tenant.status === "available")
        .map((tenant) => tenant.preferredBuildingType)
        .sort(),
    ).toEqual([
      "apartment_block",
      "courtyard_home",
      "courtyard_home",
      "mixed_tenement",
      "row_house",
      "workshop",
      "workshop",
    ]);

    months(state, 1);

    expect(state.phase2.housingMarket.arrivalsTotal).toBe(0);
    expect(state.phase2.tenants.size).toBe(7);
    expect(Object.values(vacancyPercentByBuildingType(state)).every((value) => value === 0)).toBe(
      true,
    );

    months(state, 12, 1);

    // El pool autorado no caduca: sigue siendo la reserva manual del jugador aunque no haya oferta.
    expect(state.phase2.tenants.size).toBe(7);
    expect(state.phase2.housingMarket.departuresTotal).toBe(0);
    expect(state.phase2.housingMarket.arrivalsTotal).toBe(0);
  });

  it("una solicitud de mercado sigue disponible al cierre siguiente y sólo caduca a los seis meses", () => {
    const state = newState();
    const searcher = addTenant(state, 600, { origin: "market" });

    settleAt(state, GAME_MONTH_TICKS);
    expect(state.phase2.tenants.get(searcher)?.status).toBe("available");
    expect(state.phase2.tenants.get(searcher)?.searchMonths).toBe(1);

    for (let month = 2; month <= 5; month += 1) settleAt(state, month * GAME_MONTH_TICKS);
    expect(state.phase2.tenants.get(searcher)?.searchMonths).toBe(5);
    expect(state.phase2.housingMarket.departuresTotal).toBe(0);

    settleAt(state, 6 * GAME_MONTH_TICKS);
    expect(state.phase2.tenants.get(searcher)).toBeUndefined();
    expect(state.phase2.housingMarket.departuresTotal).toBe(1);
  });

  it("ninguna solicitud se autoocupa: la contratación es siempre manual", () => {
    const state = newState();
    const buildingId = addBuilding(state, 0, "courtyard_home");
    addBuilding(state, 1, "courtyard_home");

    months(state, 2);

    const applicants = [...state.phase2.tenants.values()].filter(
      (tenant) => tenant.origin === "market" && tenant.status === "available",
    );
    expect(applicants.length).toBeGreaterThan(0);
    expect(occupiedSlots(state)).toBe(0);

    const chosen = applicants[0]!;
    const result = dispatchProductCommand(state, {
      commandId: parseCommandId("command_00000001"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
      type: "AssignTenant",
      payload: { buildingId, tenantId: chosen.id },
    });
    expect(result.accepted).toBe(true);
    expect(state.phase2.buildings.get(buildingId)?.tenantIds).toContain(chosen.id);
    expect(state.phase2.tenants.get(chosen.id)?.status).toBe("contracted");

    months(state, 1, 2);
    // Las solicitudes originales siguen esperando una decisión manual al mes siguiente.
    for (const applicant of applicants) {
      if (applicant.id === chosen.id) continue;
      expect(state.phase2.tenants.get(applicant.id)?.status).toBe("available");
    }
  });

  it("construir más plazas no garantiza ocuparlas", () => {
    const compact = newState(11);
    for (let index = 0; index < 12; index += 1) addBuilding(compact, index, "courtyard_home");
    const generous = newState(11);
    for (let index = 0; index < 20; index += 1) addBuilding(generous, index, "courtyard_home");

    months(compact, 24);
    months(generous, 24);

    // Sin autoocupación la ocupación la decide el jugador; la demanda sigue acotada por el techo
    // y por la caducidad de las solicitudes no contratadas.
    expect(occupiedSlots(compact)).toBe(0);
    expect(occupiedSlots(generous)).toBe(0);
    expect(describeHousingMarket(generous)[0]!.population).toBeLessThanOrEqual(
      HOUSING_SEGMENTS.household.populationCap,
    );
    expect(generous.phase2.housingMarket.departuresTotal).toBeGreaterThan(0);
    expect(vacantSlots(generous)).toBeGreaterThanOrEqual(vacantSlots(compact) + 10);
  });

  it("contratando a mano el parque alcanza más de 24 hogares sin superar el techo de 60", () => {
    const state = newState(11);
    const buildingIds: BuildingId[] = [];
    for (let index = 0; index < 30; index += 1) {
      buildingIds.push(addBuilding(state, index, "courtyard_home"));
    }

    for (let month = 1; month <= 24; month += 1) {
      months(state, 1, month - 1);
      const applicants = [...state.phase2.tenants.values()]
        .filter((tenant) => tenant.status === "available" && tenant.segmentId === "household")
        .sort((left, right) => left.id.localeCompare(right.id));
      for (const tenant of applicants) {
        const target = buildingIds.find(
          (id) => state.phase2.buildings.get(id)!.tenantIds.length < 2,
        );
        if (!target) break;
        seat(state, target, tenant.id);
      }
    }

    const demand = describeHousingMarket(state)[0]!;
    expect(demand.population).toBeGreaterThan(24);
    expect(demand.population).toBeLessThanOrEqual(60);
  });

  it("genera solicitudes compatibles para un bloque de pisos", () => {
    const state = newState(23);
    const buildingId = addBuilding(state, 0, "apartment_block");

    months(state, 1);

    const applicants = [...state.phase2.tenants.values()].filter(
      (tenant) =>
        tenant.status === "available" && tenant.preferredBuildingType === "apartment_block",
    );
    expect(applicants.length).toBeGreaterThan(0);
    expect(applicants.every((tenant) => tenant.marketDistrictId !== null)).toBe(true);
    expect(
      applicants.every(
        (tenant) => tenant.budget >= askingRentFor(state, state.phase2.buildings.get(buildingId)!),
      ),
    ).toBe(true);
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
    const buildingIds: BuildingId[] = [];
    for (let index = 0; index < 6; index += 1) {
      buildingIds.push(addBuilding(state, index, "courtyard_home"));
    }
    months(state, 4);

    const beforeShock = state.phase2.housingMarket.arrivalsTotal;
    const demandBefore = describeHousingMarket(state)[0]!;
    expect(demandBefore.affordableVacantSlots).toBeGreaterThan(0);

    // El jugador contrata manualmente parte de las solicitudes antes del shock.
    const applicants = [...state.phase2.tenants.values()]
      .filter((tenant) => tenant.origin === "market" && tenant.status === "available")
      .sort((left, right) => left.id.localeCompare(right.id));
    expect(applicants.length).toBeGreaterThan(4);
    for (const [index, tenant] of applicants.slice(0, 4).entries()) {
      seat(state, buildingIds[index]!, tenant.id);
    }

    state.phase2.ordinance.status = "active";
    state.phase2.ordinance.rentModifierPercent = 100;
    months(state, 1, 4);

    const demandAfter = describeHousingMarket(state)[0]!;
    expect(demandAfter.affordableVacantSlots).toBe(0);
    expect(demandAfter.vacantSlots).toBeGreaterThan(0);
    expect(state.phase2.housingMarket.arrivalsTotal).toBe(beforeShock);

    const seatedBefore = occupiedSlots(state);
    expect(seatedBefore).toBeGreaterThan(0);
    months(state, 4, 5);
    // La renta impagable erosiona la satisfacción y acaba desalojando hogares.
    expect(occupiedSlots(state)).toBeLessThan(seatedBefore);
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
    const nearParcel = state.phase2.buildings.get(near)!.parcelIds[0]!;
    const farParcel = state.phase2.buildings.get(far)!.parcelIds[0]!;
    /** La limpieza es radial dentro del distrito de las parcelas, no del centro de la ciudad. */
    const center = coverage.cleaningByDistrictId.get(
      state.phase2.parcels.get(nearParcel)!.districtId,
    )!.center;
    state.phase2.parcels.get(nearParcel)!.anchorCell = { x: center.x - 5, y: center.y };
    state.phase2.parcels.get(farParcel)!.anchorCell = { x: center.x + 5, y: center.y };
    state.phase2.parcels.get(state.phase2.buildings.get(burning)!.parcelIds[0]!)!.anchorCell = {
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
    /**
     * H2-05 · antes también se exigía `farUnit.safety < 100`, argumentando que la cobertura de
     * seguridad era radial y el borde del distrito perdía puntos aunque no hubiera siniestro.
     * Con el nuevo contrato la seguridad ya no es un radio: es Voronoi de facilities, limitada
     * por capacidad. Con tres parcelas desarrolladas y ~50 slots de comisaría, far SÍ llega a
     * 100; el siniestro penaliza sólo a near. Lo importante —que un incidente cerca baja la
     * seguridad y otro lejos no la toca— se prueba en las dos aserciones de encima.
     */
    expect(farUnit.safety).toBe(100);
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
      3, 2, 2, 3, 3, 3, 3,
    ]);
    expect([...restored.phase2.tenants.values()].map((tenant) => tenant.segmentId)).toEqual([
      "household",
      "maker",
      "shopkeeper",
      "household",
      "household",
      "household",
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

describe("satisfacción del contrato: modificadores y umbrales de salida", () => {
  function seatedCase(
    overrides: { condition?: number; budget?: number; satisfaction?: number } = {},
  ): { state: GameState; tenantId: TenantId; buildingId: BuildingId } {
    const state = newState();
    const buildingId = addBuilding(state, 0, "courtyard_home", {
      condition: overrides.condition ?? 100,
    });
    const tenantId = addTenant(state, 700, {
      budget: parseMoney(overrides.budget ?? 220),
      satisfaction: overrides.satisfaction ?? 60,
    });
    seat(state, buildingId, tenantId);
    return { state, tenantId, buildingId };
  }

  it("suma +2 mensual base con renta asequible y condición sana", () => {
    const { state, tenantId } = seatedCase();
    months(state, 1);
    expect(state.phase2.tenants.get(tenantId)?.satisfaction).toBe(62);
    expect(state.phase2.tenants.get(tenantId)?.status).toBe("contracted");
  });

  it("resta 20 cuando la renta supera el presupuesto del hogar", () => {
    const { state, tenantId } = seatedCase({ budget: 100 });
    months(state, 1);
    expect(state.phase2.tenants.get(tenantId)?.satisfaction).toBe(42);
  });

  it("resta 10 cuando la condición está por debajo de 60", () => {
    const { state, tenantId } = seatedCase({ condition: 50 });
    months(state, 1);
    expect(state.phase2.tenants.get(tenantId)?.satisfaction).toBe(52);
  });

  it("acumula ambas penalizaciones y acota la satisfacción entre 0 y 100", () => {
    const both = seatedCase({ condition: 50, budget: 100 });
    months(both.state, 1);
    expect(both.state.phase2.tenants.get(both.tenantId)?.satisfaction).toBe(32);

    const ceiling = seatedCase({ satisfaction: 99 });
    months(ceiling.state, 1);
    expect(ceiling.state.phase2.tenants.get(ceiling.tenantId)?.satisfaction).toBe(100);

    const floor = seatedCase({ condition: 50, budget: 100, satisfaction: 5 });
    months(floor.state, 1);
    expect(floor.state.phase2.tenants.get(floor.tenantId)?.satisfaction).toBe(0);
  });

  it("desaloja forzosamente con condición menor de 20", () => {
    const { state, tenantId, buildingId } = seatedCase({ condition: 19 });
    months(state, 1);
    expect(state.phase2.tenants.get(tenantId)?.status).toBe("available");
    expect(state.phase2.buildings.get(buildingId)?.tenantIds).not.toContain(tenantId);
  });

  it("desaloja forzosamente con satisfacción menor de 30 tras el cierre", () => {
    const { state, tenantId } = seatedCase({ budget: 100, satisfaction: 28 });
    months(state, 1);
    // 28 + 2 − 20 = 10 < 30 → salida forzosa.
    expect(state.phase2.tenants.get(tenantId)?.status).toBe("available");
  });

  it("no desaloja en los bordes exactos: condición 20 y satisfacción 30", () => {
    const conditionEdge = seatedCase({ condition: 20 });
    months(conditionEdge.state, 1);
    expect(conditionEdge.state.phase2.tenants.get(conditionEdge.tenantId)?.status).toBe(
      "contracted",
    );
    expect(conditionEdge.state.phase2.tenants.get(conditionEdge.tenantId)?.satisfaction).toBe(52);

    const satisfactionEdge = seatedCase({ satisfaction: 28 });
    months(satisfactionEdge.state, 1);
    // 28 + 2 = 30, que no es menor de 30.
    expect(satisfactionEdge.state.phase2.tenants.get(satisfactionEdge.tenantId)?.status).toBe(
      "contracted",
    );
  });
});

describe("ritmo residencial ágil y segregación por segmento", () => {
  it("household declara techo 60 y hasta 6 llegadas mensuales con atractivo completo", () => {
    expect(HOUSING_SEGMENTS.household.populationCap).toBe(60);
    expect(HOUSING_SEGMENTS.household.arrivalsAtFullAppeal).toBe(6);
  });

  it("con plazas suficientes ninguna llegada mensual supera 6 ni el techo de población", () => {
    const state = newState(11);
    for (let index = 0; index < 30; index += 1) addBuilding(state, index, "courtyard_home");

    let previousArrivals = 0;
    for (let month = 1; month <= 12; month += 1) {
      months(state, 1, month - 1);
      const arrivals = state.phase2.housingMarket.arrivalsTotal;
      expect(arrivals - previousArrivals).toBeLessThanOrEqual(6);
      previousArrivals = arrivals;
    }
    expect(previousArrivals).toBeGreaterThan(0);

    const demand = describeHousingMarket(state)[0]!;
    expect(demand.population).toBeLessThanOrEqual(60);
    expect(demand.population).toBeLessThanOrEqual(demand.compatibleSlots);

    for (const tenant of state.phase2.tenants.values()) {
      if (tenant.origin !== "market") continue;
      expect(tenant.segmentId).toBe("household");
      expect(HOUSING_SEGMENTS.household.preferredBuildingTypes).toContain(
        tenant.preferredBuildingType,
      );
      const compatible = [...state.phase2.buildings.values()].filter(
        (building) =>
          building.districtId === tenant.marketDistrictId &&
          building.type === tenant.preferredBuildingType,
      );
      const cheapest = Math.min(
        ...compatible.map((building) => askingRentFor(state, building)),
      );
      expect(tenant.budget).toBeGreaterThanOrEqual(cheapest);
    }
  });

  it("los talleres sólo atraen artesanos y comerciantes; la vivienda sólo hogares", () => {
    const workshops = newState(29);
    for (let index = 0; index < 4; index += 1) addBuilding(workshops, index, "workshop");
    months(workshops, 3);
    const workshopApplicants = [...workshops.phase2.tenants.values()].filter(
      (tenant) => tenant.origin === "market",
    );
    expect(workshopApplicants.length).toBeGreaterThan(0);
    for (const tenant of workshopApplicants) {
      expect(["maker", "shopkeeper"]).toContain(tenant.segmentId);
      expect(tenant.preferredBuildingType).toBe("workshop");
    }

    const housing = newState(29);
    for (let index = 0; index < 4; index += 1) addBuilding(housing, index, "courtyard_home");
    months(housing, 3);
    const housingApplicants = [...housing.phase2.tenants.values()].filter(
      (tenant) => tenant.origin === "market",
    );
    expect(housingApplicants.length).toBeGreaterThan(0);
    for (const tenant of housingApplicants) {
      expect(tenant.segmentId).toBe("household");
    }
  });
});
