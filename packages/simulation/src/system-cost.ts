/**
 * Harness de coste por sistema (WP4.2). No forma parte del runtime del juego: construye ciudades
 * sintéticas deterministas y cronometra cada sistema del tick por separado para decidir con datos
 * qué merece LOD. La ciudad sintética es carga, no balance: saldos e inventorios se amplían para
 * que ningún límite económico recorte el camino medido.
 */
import {
  parseAgentId,
  parseBuildingId,
  parseConstructionSiteId,
  parseCrewId,
  parseFacilityId,
  parseIncidentId,
  parseLoanId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parseSeed,
  parseTenantId,
  parseTick,
  type Agent,
  type AgentId,
  type AgentSpecialty,
  type Building,
  type BuildingType,
  type ConstructionSite,
  type Crew,
  type GridCell,
  type IncidentRecord,
  type InsuranceContract,
  type Loan,
  type OrganizationId,
  type Parcel,
  type ProductionFacility,
  type Tenant,
  type TenantProfile,
  type Zoning,
} from "@landlord/shared";
import { cellKey } from "./district-generator";
import { DEFAULT_DISTRICT_PROFILE_ID } from "./district-profiles";
import {
  BANK_ORGANIZATION_ID,
  BUILDING_DEFINITIONS,
  GAME_MONTH_TICKS,
  INSURER_ORGANIZATION_ID,
  LOAN_POLICY,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
  TENANT_PROFILE_DEFAULTS,
  calculateInsuranceOffer,
} from "./game-data";
import { createPrng } from "./prng";
import { createInitialState, type GameState } from "./state";
import { PRODUCT_SYSTEMS, advanceProductSystems } from "./systems";

/** Escalas de referencia: el ratio de entidades entre ellas es lo que revela la degradación. */
export const SYSTEM_COST_SCALES = [
  { id: "barrio", parcels: 50 },
  { id: "distrito", parcels: 200 },
  { id: "ciudad", parcels: 800 },
] as const;

export type SystemCostScale = (typeof SYSTEM_COST_SCALES)[number];

/** Ventanas medidas. `month` alinea el reloj con el cierre mensual porque esos sistemas sólo corren ahí. */
export const SYSTEM_COST_WINDOWS = [
  { label: "day", ticks: 1_200, startTick: 0, incidentCount: 0 },
  { label: "month", ticks: 6, startTick: GAME_MONTH_TICKS - 3, incidentCount: 0 },
  { label: "fire", ticks: 300, startTick: 0, incidentCount: 12 },
] as const;

export type SystemCostWindow = (typeof SYSTEM_COST_WINDOWS)[number];

/**
 * El warmup se ejecuta antes de la ventana, así que el reloj arranca lo bastante pronto para que el
 * warmup termine justo en `startTick`. Para las ventanas que empiezan en cero no hay hueco anterior:
 * se calienta desde el tick 0 y la medición empieza donde termina el warmup.
 */
export function warmupStartTick(costWindow: SystemCostWindow, warmupTicks: number): number {
  return Math.max(0, costWindow.startTick - Math.max(0, warmupTicks));
}

/** Tick en el que empieza la sección medida: justo después de consumir el warmup. */
export function measurementStartTick(costWindow: SystemCostWindow, warmupTicks: number): number {
  return warmupStartTick(costWindow, warmupTicks) + Math.max(0, warmupTicks);
}

/**
 * ¿La sección medida ejecuta algún cierre mensual? Los sistemas corren antes de incrementar el reloj,
 * así que la ventana recorrida es [start, start + ticks) y el cierre ocurre en cada múltiplo del mes.
 * El tick 0 se excluye: todos los sistemas mensuales salen antes de hacer nada.
 */
export function windowCrossesMonthClose(
  costWindow: SystemCostWindow,
  warmupTicks: number,
): boolean {
  const start = measurementStartTick(costWindow, warmupTicks);
  const nextClose =
    start > 0 && start % GAME_MONTH_TICKS === 0
      ? start
      : (Math.floor(start / GAME_MONTH_TICKS) + 1) * GAME_MONTH_TICKS;
  return nextClose < start + costWindow.ticks;
}

const ZONING_BAG: readonly Zoning[] = ["residential", "residential", "mixed", "industrial"];
const BUILDING_TYPES_BY_ZONING: Record<Zoning, readonly BuildingType[]> = {
  residential: ["courtyard_home"],
  mixed: ["courtyard_home", "workshop"],
  industrial: ["workshop", "cement_plant", "brickworks", "steelworks"],
};
const SYNTHETIC_TENANT_START = 1_000;
const BUILT_PERCENT = 85;
const SITE_PERCENT = 6;
const LOAN_PERCENT = 12;
const INSURANCE_PERCENT = 25;
const VACANCY_PERCENT = 15;
const POPULATION_PER_PARCELS = 8;
const TECHNICIAN_PER_BUILDINGS = 20;
const CREW_WALK_DISTANCE = 12;
const HARNESS_BALANCE = 5_000_000;
const HARNESS_INVENTORY_CAPACITY = 1_000_000;
const SITE_WORK_REQUIRED = 100_000;
const STANDING_OFFSETS: readonly GridCell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function pad(value: number): string {
  return String(value).padStart(8, "0");
}

export type ScaledCityCounts = {
  parcels: number;
  buildings: number;
  tenants: number;
  facilities: number;
  constructionSites: number;
  crews: number;
  agents: number;
  loans: number;
  incidents: number;
  insuranceContracts: number;
  blockedCells: number;
};

export function describeScaledCity(state: GameState): ScaledCityCounts {
  return {
    parcels: state.phase2.parcels.size,
    buildings: state.phase2.buildings.size,
    tenants: state.phase2.tenants.size,
    facilities: state.phase2.facilities.size,
    constructionSites: state.phase2.constructionSites.size,
    crews: state.phase2.crews.size,
    agents: state.agents.size,
    loans: state.phase2.loans.size,
    incidents: state.phase2.incidents.size,
    insuranceContracts: Object.keys(state.phase2.insurance.contractsByBuildingId).length,
    blockedCells: state.map.blockedCells.size,
  };
}

export type ScaledCityOptions = {
  parcelCount: number;
  districtProfileId?: string | undefined;
  /** Incidentes activos inyectados. 0 mantiene la ciudad en régimen estable, sin cascadas. */
  incidentCount?: number | undefined;
};

function freeNeighbour(
  cell: GridCell,
  taken: ReadonlySet<string>,
  state: GameState,
): GridCell | null {
  for (const offset of STANDING_OFFSETS) {
    const candidate = { x: cell.x + offset.x, y: cell.y + offset.y };
    if (
      candidate.x < 0 ||
      candidate.y < 0 ||
      candidate.x >= state.map.width ||
      candidate.y >= state.map.height
    )
      continue;
    if (taken.has(cellKey(candidate))) continue;
    return candidate;
  }
  return null;
}

function createAgent(
  state: GameState,
  counters: { agent: number },
  input: {
    organizationId: OrganizationId;
    specialty: AgentSpecialty;
    cell: GridCell;
    target: GridCell;
    task: NonNullable<Agent["task"]> | null;
    working: boolean;
  },
): Agent {
  counters.agent += 1;
  const id = parseAgentId(`agent_${pad(counters.agent)}`);
  const personId = parsePersonId(`person_${pad(1_000 + counters.agent)}`);
  state.persons.set(personId, { id: personId });
  const agent: Agent = {
    id,
    personId,
    organizationId: input.organizationId,
    specialty: input.specialty,
    health: 100,
    state: input.working ? "working" : "idle",
    cell: { ...input.cell },
    target: { ...input.target },
    path: [],
    task: input.task,
    cooldownUntilTick: parseTick(0),
    injuredUntilTick: null,
    lastPathRecalculationTick: parseTick(0),
  };
  state.agents.set(id, agent);
  return agent;
}

export function createScaledCity(seedValue: number, options: ScaledCityOptions): GameState {
  const seed = parseSeed(seedValue);
  const state = createInitialState(seed, { districtProfileId: options.districtProfileId });
  // Flujo propio del harness: `state.prng` queda intacto para que la partida siga siendo la misma.
  const prng = createPrng(seed);
  const incidentCount = options.incidentCount ?? 0;

  for (const organizationId of [PLAYER_ORGANIZATION_ID, RIVAL_ORGANIZATION_ID]) {
    state.phase2.balances.set(organizationId, parseMoney(HARNESS_BALANCE));
    const inventory = state.phase2.inventories.get(organizationId);
    if (inventory) inventory.capacity = HARNESS_INVENTORY_CAPACITY;
  }
  state.phase2.balances.set(BANK_ORGANIZATION_ID, parseMoney(HARNESS_BALANCE * 10));
  state.phase2.balances.set(INSURER_ORGANIZATION_ID, parseMoney(HARNESS_BALANCE * 10));

  const taken = new Set<string>(state.map.blockedCells);
  for (const parcel of state.phase2.parcels.values()) taken.add(cellKey(parcel.cell));
  for (const agent of state.agents.values()) taken.add(cellKey(agent.cell));

  const cells: GridCell[] = [];
  for (let y = 0; y < state.map.height && cells.length < options.parcelCount; y += 2) {
    for (let x = 0; x < state.map.width && cells.length < options.parcelCount; x += 2) {
      const key = cellKey({ x, y });
      if (taken.has(key)) continue;
      taken.add(key);
      cells.push({ x, y });
    }
  }
  if (cells.length < options.parcelCount) {
    throw new RangeError(
      `createScaledCity: el mapa sólo admite ${cells.length} parcelas de ${options.parcelCount}`,
    );
  }

  const counters = { agent: state.idCounters.agent };
  let tenantCounter = SYNTHETIC_TENANT_START;
  const createdParcels: Parcel[] = [];
  const createdBuildings: Building[] = [];

  for (const cell of cells) {
    const parcelId = parseParcelId(`parcel_${pad(state.phase2.parcels.size + 1)}`);
    const zoning = ZONING_BAG[prng.nextInt(0, ZONING_BAG.length)]!;
    const ownership = prng.nextInt(0, 100);
    const ownerOrganizationId =
      ownership < 10 ? null : ownership < 40 ? RIVAL_ORGANIZATION_ID : PLAYER_ORGANIZATION_ID;
    const suitability = {
      cement: 60 + prng.nextInt(0, 80),
      brick: 60 + prng.nextInt(0, 80),
      steel: 60 + prng.nextInt(0, 80),
    };
    const parcel: Parcel = {
      id: parcelId,
      districtId: state.phase2.district.id,
      cell: { ...cell },
      price: parseMoney(600 + prng.nextInt(0, 900)),
      zoning,
      ownerOrganizationId,
      buildingId: null,
      productionSuitability: suitability,
    };
    state.phase2.parcels.set(parcelId, parcel);
    createdParcels.push(parcel);
    if (ownerOrganizationId === null || prng.nextInt(0, 100) >= BUILT_PERCENT) continue;

    const types = BUILDING_TYPES_BY_ZONING[zoning];
    const type = types[prng.nextInt(0, types.length)]!;
    state.phase2.idCounters.building += 1;
    const buildingId = parseBuildingId(`building_${pad(state.phase2.idCounters.building)}`);
    const building: Building = {
      id: buildingId,
      parcelId,
      ownerOrganizationId,
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
    state.phase2.buildings.set(buildingId, building);
    parcel.buildingId = buildingId;
    createdBuildings.push(building);

    const capacity = BUILDING_DEFINITIONS[type].capacity;
    for (let slot = 0; slot < capacity; slot += 1) {
      if (prng.nextInt(0, 100) < VACANCY_PERCENT) continue;
      tenantCounter += 1;
      const tenantId = parseTenantId(`tenant_${pad(tenantCounter)}`);
      const profile: TenantProfile =
        type === "courtyard_home" ? "household" : slot % 2 === 0 ? "maker" : "shopkeeper";
      const tenant: Tenant = {
        id: tenantId,
        profile,
        budget: parseMoney(200 + prng.nextInt(0, 180)),
        preferredBuildingType: type,
        activeContractBuildingId: buildingId,
        satisfaction: 60 + prng.nextInt(0, 26),
        leaseRemaining: 6 + prng.nextInt(0, 19),
        status: "contracted",
        size: TENANT_PROFILE_DEFAULTS[profile].size,
        segmentId: profile,
        searchMonths: 0,
        incomeFactorPercent: 100,
        origin: "authored",
      };
      state.phase2.tenants.set(tenantId, tenant);
      building.tenantIds.push(tenantId);
    }
    building.tenantId = building.tenantIds[0] ?? null;

    const production = BUILDING_DEFINITIONS[type].production;
    if (!production) continue;
    state.phase2.idCounters.facility += 1;
    const facilityId = parseFacilityId(`facility_${pad(state.phase2.idCounters.facility)}`);
    const facility: ProductionFacility = {
      id: facilityId,
      ownerOrganizationId,
      operational: true,
      cycleProgress: prng.nextInt(0, production.cycleLength),
      cycleLength: production.cycleLength,
      output: production.output,
      outputAmount: production.outputAmount,
      kind: "physical",
      investmentCost: parseMoney(0),
      operatingCost: production.operatingCost,
      buildingId,
      suitabilityPercent: suitability[production.output],
      conditionPercent: 100,
      upgradePercent: 100,
      remainder: 0,
    };
    state.phase2.facilities.set(facilityId, facility);
    building.productionFacilityId = facilityId;
  }

  const siteTarget = Math.max(1, Math.floor((cells.length * SITE_PERCENT) / 100));
  const siteParcels = createdParcels
    .filter((parcel) => parcel.ownerOrganizationId !== null && parcel.buildingId === null)
    .slice(0, siteTarget);
  for (const parcel of siteParcels) {
    const organizationId = parcel.ownerOrganizationId!;
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(`site_${pad(state.phase2.idCounters.constructionSite)}`);
    const types = BUILDING_TYPES_BY_ZONING[parcel.zoning];
    const site: ConstructionSite = {
      id: siteId,
      parcelId: parcel.id,
      ownerOrganizationId: organizationId,
      buildingType: types[0]!,
      progress: 0,
      workRequired: SITE_WORK_REQUIRED,
      resourcesReserved: { cement: 0, brick: 0, steel: 0 },
      crewCapacity: 2,
      upgradeBuildingId: null,
      repairBuildingId: null,
      kind: "construction",
      targetBuildingId: null,
      assignedCrewIds: [],
      assignedTechnicianId: null,
    };
    state.phase2.constructionSites.set(siteId, site);
    const memberIds: AgentId[] = [];
    for (let member = 0; member < 3; member += 1) {
      const home = freeNeighbour(parcel.cell, taken, state);
      if (!home) break;
      taken.add(cellKey(home));
      // Nacen lejos de la obra y caminan: así la ventana medida incluye navegación real.
      const spawn = {
        x: Math.max(0, Math.min(state.map.width - 1, home.x - CREW_WALK_DISTANCE)),
        y: home.y,
      };
      const agent = createAgent(state, counters, {
        organizationId,
        specialty: member === 0 ? "supervisor" : "construction_worker",
        cell: spawn,
        target: home,
        task: { kind: "work_order", workOrderId: siteId },
        working: false,
      });
      memberIds.push(agent.id);
    }
    if (memberIds.length === 0) continue;
    const crewId = parseCrewId(`crew_${pad(state.phase2.crews.size + 1)}`);
    const crew: Crew = {
      id: crewId,
      organizationId,
      supervisorAgentId: memberIds[0]!,
      workerAgentIds: memberIds.slice(1),
    };
    state.phase2.crews.set(crewId, crew);
    site.assignedCrewIds = [crewId];
  }

  for (let index = 0; index < createdBuildings.length; index += 1) {
    if (index % TECHNICIAN_PER_BUILDINGS !== 0) continue;
    const building = createdBuildings[index]!;
    const parcel = state.phase2.parcels.get(building.parcelId)!;
    const spot = freeNeighbour(parcel.cell, taken, state);
    if (!spot) continue;
    taken.add(cellKey(spot));
    createAgent(state, counters, {
      organizationId: building.ownerOrganizationId,
      specialty: "maintenance_technician",
      cell: spot,
      target: spot,
      task: { kind: "maintenance", buildingId: building.id },
      working: true,
    });
  }

  const population = Math.floor(cells.length / POPULATION_PER_PARCELS);
  for (let index = 0; index < population; index += 1) {
    const parcel = createdParcels[(index * 7) % createdParcels.length]!;
    const spot = freeNeighbour(parcel.cell, taken, state);
    if (!spot) continue;
    taken.add(cellKey(spot));
    createAgent(state, counters, {
      organizationId: PLAYER_ORGANIZATION_ID,
      specialty: "construction_worker",
      cell: spot,
      target: spot,
      task: null,
      working: false,
    });
  }

  const loanTarget = Math.floor((createdParcels.length * LOAN_PERCENT) / 100);
  for (let index = 0; index < loanTarget; index += 1) {
    const parcel = createdParcels[index]!;
    if (parcel.ownerOrganizationId === null) continue;
    state.phase2.idCounters.loan += 1;
    const loanId = parseLoanId(`loan_${pad(state.phase2.idCounters.loan)}`);
    const principal = parseMoney(2_000 + prng.nextInt(0, 4_000));
    const loan: Loan = {
      id: loanId,
      borrowerOrganizationId: parcel.ownerOrganizationId,
      lenderOrganizationId: BANK_ORGANIZATION_ID,
      principal,
      outstandingPrincipal: principal,
      annualInterestRateBps: LOAN_POLICY.annualInterestRateBps,
      termMonths: 12,
      remainingMonths: 12,
      collateralParcelId: parcel.id,
      status: "active",
      offeredAtTick: parseTick(0),
      acceptedAtTick: parseTick(0),
      nextPaymentTick: parseTick(GAME_MONTH_TICKS),
      missedPayments: 0,
    };
    state.phase2.loans.set(loanId, loan);
  }

  const insuranceTarget = Math.floor((createdBuildings.length * INSURANCE_PERCENT) / 100);
  for (let index = 0; index < insuranceTarget; index += 1) {
    const building = createdBuildings[index]!;
    const offer = calculateInsuranceOffer(building, "fire_basic");
    const contract: InsuranceContract = {
      buildingId: building.id,
      insurerOrganizationId: INSURER_ORGANIZATION_ID,
      coverage: "fire_basic",
      premium: offer.premium,
      coverageLimit: offer.coverageLimit,
      deductible: offer.deductible,
      exclusions: [...offer.exclusions],
      status: "active",
      purchasedAtTick: parseTick(0),
      lastPremiumTick: parseTick(0),
      nextPremiumTick: parseTick(GAME_MONTH_TICKS),
      totalPremiumPaid: parseMoney(0),
    };
    state.phase2.insurance.contractsByBuildingId[building.id] = contract;
  }

  if (incidentCount > 0 && createdBuildings.length > 0) {
    const stride = Math.max(
      TECHNICIAN_PER_BUILDINGS + 1,
      Math.floor(createdBuildings.length / incidentCount),
    );
    for (let index = 0; index < incidentCount; index += 1) {
      const building = createdBuildings[(index * stride + stride - 1) % createdBuildings.length]!;
      if (building.state !== "operational") continue;
      building.state = "burning";
      state.phase2.idCounters.incident += 1;
      const incidentId = parseIncidentId(`incident_${pad(state.phase2.idCounters.incident)}`);
      const incident: IncidentRecord = {
        id: incidentId,
        buildingId: building.id,
        origin: "deterioration",
        intensity: 30,
        status: "active",
        targetOrganizationId: building.ownerOrganizationId,
        createdAtTick: parseTick(0),
        causedByAgentId: null,
        causedByOrganizationId: null,
        publiclyAttributedOrganizationId: null,
        casualties: { injured: 0, dead: 0 },
      };
      state.phase2.incidents.set(incidentId, incident);
    }
  }

  state.idCounters.agent = counters.agent;
  return state;
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function summarize(samples: readonly number[]) {
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    meanMs: samples.length === 0 ? 0 : total / samples.length,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    maxMs: samples.length === 0 ? 0 : Math.max(...samples),
    totalMs: total,
  };
}

function distribution(summary: ReturnType<typeof summarize>): CostDistribution {
  return {
    meanMs: summary.meanMs,
    p50Ms: summary.p50Ms,
    p95Ms: summary.p95Ms,
    p99Ms: summary.p99Ms,
    maxMs: summary.maxMs,
  };
}

export type CostDistribution = {
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

export type SystemCostSummary = CostDistribution & {
  name: string;
  totalMs: number;
  /** Porcentaje del coste instrumentado total de la ventana. */
  share: number;
};

export type SystemCostWindowReport = {
  label: string;
  ticks: number;
  startTick: number;
  endTick: number;
  counts: ScaledCityCounts;
  endCounts: ScaledCityCounts;
  /** Tick completo sin instrumentación: el coste real, sin el overhead de cronometrar por sistema. */
  plainTick: CostDistribution;
  instrumentedTick: CostDistribution;
  systems: SystemCostSummary[];
};

export type ScaledCityMeasurement = {
  seed: number;
  scaleId: string;
  parcelCount: number;
  districtProfileId: string;
  warmupTicks: number;
  windows: SystemCostWindowReport[];
};

export type MeasureScaledCityInput = {
  seed: number;
  scale: SystemCostScale;
  windows?: readonly SystemCostWindow[];
  warmupTicks?: number;
  districtProfileId?: string;
  now: () => number;
};

function prepareCity(
  input: MeasureScaledCityInput,
  costWindow: SystemCostWindow,
  parcelCount: number,
): GameState {
  return createScaledCity(input.seed, {
    parcelCount,
    districtProfileId: input.districtProfileId,
    incidentCount: costWindow.incidentCount,
  });
}

/**
 * Cronometra cada sistema por separado dentro del tick real. El bucle replica
 * `advanceProductSystems` y `system-cost.test.ts` comprueba que produce exactamente el mismo
 * estado, de modo que la instrumentación no pueda falsear la medición.
 */
export function measureScaledCity(input: MeasureScaledCityInput): ScaledCityMeasurement {
  const warmupTicks = input.warmupTicks ?? 60;
  const windows = input.windows ?? SYSTEM_COST_WINDOWS;
  const districtProfileId = input.districtProfileId ?? DEFAULT_DISTRICT_PROFILE_ID;
  const reports: SystemCostWindowReport[] = [];

  for (const costWindow of windows) {
    const state = prepareCity(input, costWindow, input.scale.parcels);
    const plain = prepareCity(input, costWindow, input.scale.parcels);
    const warmupStart = parseTick(warmupStartTick(costWindow, warmupTicks));
    state.clock = { ...state.clock, tick: warmupStart };
    plain.clock = { ...plain.clock, tick: warmupStart };
    for (let tick = 0; tick < warmupTicks; tick += 1) {
      advanceProductSystems(state);
      advanceProductSystems(plain);
    }
    /** El warmup ya ocurrió y dejó el reloj donde debe empezar la medición. */
    const startTick = state.clock.tick;
    const counts = describeScaledCity(state);

    const plainSamples: number[] = [];
    for (let tick = 0; tick < costWindow.ticks; tick += 1) {
      const start = input.now();
      advanceProductSystems(plain);
      plainSamples.push(input.now() - start);
    }

    const systemSamples = new Map<string, number[]>(
      PRODUCT_SYSTEMS.map((system) => [system.name, []]),
    );
    const tickSamples: number[] = [];
    for (let tick = 0; tick < costWindow.ticks; tick += 1) {
      const tickStart = input.now();
      for (const system of PRODUCT_SYSTEMS) {
        const start = input.now();
        system.run(state);
        systemSamples.get(system.name)!.push(input.now() - start);
      }
      state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
      tickSamples.push(input.now() - tickStart);
    }

    const instrumented = summarize(tickSamples);
    const systems: SystemCostSummary[] = PRODUCT_SYSTEMS.map((system) => {
      const summary = summarize(systemSamples.get(system.name)!);
      return {
        name: system.name,
        ...distribution(summary),
        totalMs: summary.totalMs,
        share: instrumented.totalMs === 0 ? 0 : (summary.totalMs / instrumented.totalMs) * 100,
      };
    });
    const plainSummary = summarize(plainSamples);
    reports.push({
      label: costWindow.label,
      ticks: costWindow.ticks,
      startTick,
      endTick: state.clock.tick,
      counts,
      endCounts: describeScaledCity(state),
      plainTick: distribution(plainSummary),
      instrumentedTick: distribution(instrumented),
      systems,
    });
  }

  return {
    seed: input.seed,
    scaleId: input.scale.id,
    parcelCount: input.scale.parcels,
    districtProfileId,
    warmupTicks,
    windows: reports,
  };
}

export type ScaleGrowthRow = {
  from: string;
  to: string;
  windowLabel: string;
  parcels: { from: number; to: number; ratio: number };
  buildings: { from: number; to: number; ratio: number };
  agents: { from: number; to: number; ratio: number };
  tickMeanMs: { from: number; to: number; ratio: number };
  tickP95Ms: { from: number; to: number; ratio: number };
  tickP99Ms: { from: number; to: number; ratio: number };
};

function growthRow(
  from: ScaledCityMeasurement,
  to: ScaledCityMeasurement,
  windowLabel: string,
): ScaleGrowthRow | null {
  const fromWindow = from.windows.find((entry) => entry.label === windowLabel);
  const toWindow = to.windows.find((entry) => entry.label === windowLabel);
  if (!fromWindow || !toWindow) return null;
  const ratio = (left: number, right: number) => (left === 0 ? 0 : right / left);
  return {
    from: from.scaleId,
    to: to.scaleId,
    windowLabel,
    parcels: {
      from: fromWindow.counts.parcels,
      to: toWindow.counts.parcels,
      ratio: ratio(fromWindow.counts.parcels, toWindow.counts.parcels),
    },
    buildings: {
      from: fromWindow.counts.buildings,
      to: toWindow.counts.buildings,
      ratio: ratio(fromWindow.counts.buildings, toWindow.counts.buildings),
    },
    agents: {
      from: fromWindow.counts.agents,
      to: toWindow.counts.agents,
      ratio: ratio(fromWindow.counts.agents, toWindow.counts.agents),
    },
    tickMeanMs: {
      from: fromWindow.plainTick.meanMs,
      to: toWindow.plainTick.meanMs,
      ratio: ratio(fromWindow.plainTick.meanMs, toWindow.plainTick.meanMs),
    },
    tickP95Ms: {
      from: fromWindow.plainTick.p95Ms,
      to: toWindow.plainTick.p95Ms,
      ratio: ratio(fromWindow.plainTick.p95Ms, toWindow.plainTick.p95Ms),
    },
    tickP99Ms: {
      from: fromWindow.plainTick.p99Ms,
      to: toWindow.plainTick.p99Ms,
      ratio: ratio(fromWindow.plainTick.p99Ms, toWindow.plainTick.p99Ms),
    },
  };
}

/** Comparación entre escalas consecutivas: `ratio` de ms frente a `ratio` de entidades revela si el crecimiento es lineal. */
export function summarizeScaleGrowth(
  measurements: readonly ScaledCityMeasurement[],
  windowLabel: string,
): ScaleGrowthRow[] {
  const rows: ScaleGrowthRow[] = [];
  for (let index = 1; index < measurements.length; index += 1) {
    const from = measurements[index - 1]!;
    const to = measurements[index]!;
    const row = growthRow(from, to, windowLabel);
    if (row) rows.push(row);
  }
  return rows;
}
