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
  parseBlockId,
  parseParcelId,
  parsePersonId,
  parseSeed,
  parseTenantId,
  parseTick,
  roadCellsFromSegments,
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
  type MacroEventType,
  type OrganizationId,
  type Parcel,
  type ProductionFacility,
  type Tenant,
  type TenantProfile,
} from "@landlord/shared";
import type { DistrictId } from "@landlord/shared";
import { developmentCodeForRole } from "./development-codes";
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
import {
  createInitialState,
  districtMapOf,
  districtStateOf,
  type DistrictMap,
  type GameState,
} from "./state";
import { CITY_ROSTER_SLOTS, districtIdForSlot } from "./city";
import { activateMacroEvent, MACRO_EVENT_TEMPLATES } from "./macro-events";
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

const SYNTHETIC_BUILDING_TYPES: readonly BuildingType[] = [
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
];
const SYNTHETIC_TENANT_START = 1_000;
const BUILT_PERCENT = 85;
const SITE_PERCENT = 6;
const LOAN_PERCENT = 12;
const INSURANCE_PERCENT = 25;
const VACANCY_PERCENT = 15;
const POPULATION_PER_PARCELS = 8;
const TECHNICIAN_PER_BUILDINGS = 20;
const CREW_WALK_DISTANCE = 12;
/** Bloque de ordinales propio del harness: nunca colisiona con los de los nueve distritos. */
const HARNESS_PARCEL_ORDINAL = 9_000_000;

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
  districts: number;
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
    blockedCells: [...state.world.districts.values()].reduce(
      (total, district) => total + district.map.blockedCells.size,
      0,
    ),
    districts: state.world.districts.size,
  };
}

export type ScaledCityOptions = {
  parcelCount: number;
  /** Distrito que recibe la carga sintética; por defecto el del roster del jugador. */
  districtId?: DistrictId | undefined;
  /** Incidentes activos inyectados. 0 mantiene la ciudad en régimen estable, sin cascadas. */
  incidentCount?: number | undefined;
};

function freeNeighbour(
  cell: GridCell,
  taken: ReadonlySet<string>,
  map: DistrictMap,
): GridCell | null {
  for (const offset of STANDING_OFFSETS) {
    const candidate = { x: cell.x + offset.x, y: cell.y + offset.y };
    if (candidate.x < 0 || candidate.y < 0 || candidate.x >= map.width || candidate.y >= map.height)
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
    districtId: DistrictId;
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
    districtId: input.districtId,
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
  const state = createInitialState(seed);
  const targetDistrictId =
    options.districtId ??
    districtIdForSlot(CITY_ROSTER_SLOTS.player.slotX, CITY_ROSTER_SLOTS.player.slotY);
  const targetMap = districtMapOf(state, targetDistrictId);
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

  // El harness sustituye el tejido del distrito objetivo por una carga sintética; no pretende
  // respetar vías ni manzanas, sólo medir sistemas con el número de parcelas solicitado.
  for (const [parcelId, parcel] of [...state.phase2.parcels]) {
    if (parcel.districtId === targetDistrictId && parcel.disposition === "marketable")
      state.phase2.parcels.delete(parcelId);
  }
  const taken = new Set<string>(targetMap.blockedCells);
  for (const cell of roadCellsFromSegments(targetMap.roads.segments)) taken.add(cell);
  const targetState = state.world.districts.get(targetDistrictId)!;
  for (const space of targetState.publicSpaces.values()) {
    for (const cell of space.cells) taken.add(cellKey(cell));
  }
  for (const parcel of state.phase2.parcels.values()) {
    if (parcel.districtId !== targetDistrictId) continue;
    for (const cell of parcel.cells) taken.add(cellKey(cell));
  }
  for (const agent of state.agents.values()) taken.add(cellKey(agent.cell));

  const cells: GridCell[] = [];
  for (let y = 0; y < targetMap.height && cells.length < options.parcelCount; y += 1) {
    for (let x = 0; x < targetMap.width && cells.length < options.parcelCount; x += 1) {
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
    const parcelId = parseParcelId(
      `parcel_${pad(HARNESS_PARCEL_ORDINAL + createdParcels.length + 1)}`,
    );
    const ownership = prng.nextInt(0, 100);
    const ownerOrganizationId =
      ownership < 10 ? null : ownership < 40 ? RIVAL_ORGANIZATION_ID : PLAYER_ORGANIZATION_ID;
    const suitability = {
      cement: 60 + prng.nextInt(0, 80),
      brick: 60 + prng.nextInt(0, 80),
      steel: 60 + prng.nextInt(0, 80),
    };
    const landValue = parseMoney(600 + prng.nextInt(0, 900));
    const parcel: Parcel = {
      id: parcelId,
      districtId: targetDistrictId,
      blockId: parseBlockId(
        `block_${(Math.floor(cell.x / 4) * 100 + Math.floor(cell.y / 4))
          .toString(16)
          .padStart(8, "0")}`,
      ),
      cells: [{ ...cell }],
      anchorCell: { ...cell },
      roadFrontages: [],
      disposition: "marketable",
      baseLandValue: landValue,
      marketValue: landValue,
      developmentCodeId: developmentCodeForRole("urban_residential").id,
      currentUses: [],
      ownerOrganizationId,
      productionSuitability: suitability,
    };
    state.phase2.parcels.set(parcelId, parcel);
    createdParcels.push(parcel);
    if (ownerOrganizationId === null || prng.nextInt(0, 100) >= BUILT_PERCENT) continue;

    const type = SYNTHETIC_BUILDING_TYPES[prng.nextInt(0, SYNTHETIC_BUILDING_TYPES.length)]!;
    const definition = BUILDING_DEFINITIONS[type];
    state.phase2.idCounters.building += 1;
    const buildingId = parseBuildingId(`building_${pad(state.phase2.idCounters.building)}`);
    const building: Building = {
      id: buildingId,
      parcelId,
      districtId: targetDistrictId,
      ownerOrganizationId,
      productionFacilityId: null,
      type,
      footprintCells: [{ ...cell }],
      orientation: 0,
      floors: definition.defaultFloors,
      form: definition.form,
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
    const primaryUse = definition.allowedUses[0];
    if (primaryUse && !parcel.currentUses.includes(primaryUse)) parcel.currentUses.push(primaryUse);
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
        marketDistrictId: targetDistrictId,
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
  const builtParcelIds = new Set(createdBuildings.map((building) => building.parcelId));
  const siteParcels = createdParcels
    .filter((parcel) => parcel.ownerOrganizationId !== null && !builtParcelIds.has(parcel.id))
    .slice(0, siteTarget);
  for (const parcel of siteParcels) {
    const organizationId = parcel.ownerOrganizationId!;
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(`site_${pad(state.phase2.idCounters.constructionSite)}`);
    const siteType = SYNTHETIC_BUILDING_TYPES[prng.nextInt(0, SYNTHETIC_BUILDING_TYPES.length)]!;
    const siteDefinition = BUILDING_DEFINITIONS[siteType];
    const site: ConstructionSite = {
      id: siteId,
      parcelId: parcel.id,
      districtId: targetDistrictId,
      ownerOrganizationId: organizationId,
      buildingType: siteType,
      footprintCells: parcel.cells.map((cell) => ({ ...cell })),
      orientation: 0,
      floors: siteDefinition.defaultFloors,
      form: siteDefinition.form,
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
      const home = freeNeighbour(parcel.anchorCell, taken, targetMap);
      if (!home) break;
      taken.add(cellKey(home));
      // Nacen lejos de la obra y caminan: así la ventana medida incluye navegación real.
      const spawn = {
        x: Math.max(0, Math.min(targetMap.width - 1, home.x - CREW_WALK_DISTANCE)),
        y: home.y,
      };
      const agent = createAgent(state, counters, {
        organizationId,
        specialty: member === 0 ? "supervisor" : "construction_worker",
        districtId: targetDistrictId,
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
    const spot = freeNeighbour(parcel.anchorCell, taken, targetMap);
    if (!spot) continue;
    taken.add(cellKey(spot));
    createAgent(state, counters, {
      organizationId: building.ownerOrganizationId,
      specialty: "maintenance_technician",
      districtId: targetDistrictId,
      cell: spot,
      target: spot,
      task: { kind: "maintenance", buildingId: building.id },
      working: true,
    });
  }

  const population = Math.floor(cells.length / POPULATION_PER_PARCELS);
  for (let index = 0; index < population; index += 1) {
    const parcel = createdParcels[(index * 7) % createdParcels.length]!;
    const spot = freeNeighbour(parcel.anchorCell, taken, targetMap);
    if (!spot) continue;
    taken.add(cellKey(spot));
    createAgent(state, counters, {
      organizationId: PLAYER_ORGANIZATION_ID,
      specialty: "construction_worker",
      districtId: targetDistrictId,
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

  if (incidentCount > 0) injectScaledIncidents(state, incidentCount);

  // Las parcelas sintéticas son carga de rendimiento: la topología vial generada se conserva y
  // las parcelas ocupan celdas libres, de modo que vía y parcela nunca comparten celda.
  state.idCounters.agent = counters.agent;
  return state;
}

/**
 * Planta `incidentCount` incendios repartidos entre los edificios del estado, elegidos por id
 * ascendente. Existe aparte de `createScaledCity` porque la ventana `fire` necesita calentar el
 * distrito *sin* fuego y ponerlo justo al empezar la sección medida: si los incendios ya estaban en
 * el warmup, el primer paso de propagación ocurría antes de cronometrar nada.
 */
export function injectScaledIncidents(state: GameState, incidentCount: number): number {
  const buildings = [...state.phase2.buildings.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (incidentCount <= 0 || buildings.length === 0) return 0;
  const stride = Math.max(
    TECHNICIAN_PER_BUILDINGS + 1,
    Math.floor(buildings.length / incidentCount),
  );
  let injected = 0;
  for (let index = 0; index < incidentCount; index += 1) {
    const building = buildings[(index * stride + stride - 1) % buildings.length]!;
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
      createdAtTick: state.clock.tick,
      causedByAgentId: null,
      causedByOrganizationId: null,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    };
    state.phase2.incidents.set(incidentId, incident);
    injected += 1;
  }
  return injected;
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
  /**
   * La misma sección sin el tick del cierre mensual. Con seis muestras el p95 de la ventana `month`
   * era el máximo, o sea el cierre: mezclarlo con el tick ordinario daba un "p95 mensual" que no
   * significaba nada (D-076 punto 5).
   */
  ordinaryTick: CostDistribution;
  /** Duración del cierre mensual caído dentro de la ventana, o null si la ventana no cruza ninguno. */
  monthClose: { tick: number; plainMs: number; instrumentedMs: number } | null;
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
  districtId?: DistrictId;
  now: () => number;
};

function prepareCity(input: MeasureScaledCityInput, parcelCount: number): GameState {
  /** El fuego se coloca después del warmup, no en la generación: ver `injectScaledIncidents`. */
  return createScaledCity(input.seed, {
    parcelCount,
    districtId: input.districtId,
    incidentCount: 0,
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
  const districtProfileId =
    districtStateOf(
      createInitialState(parseSeed(input.seed)),
      input.districtId ??
        districtIdForSlot(CITY_ROSTER_SLOTS.player.slotX, CITY_ROSTER_SLOTS.player.slotY),
    ).district.generation?.profileId ?? DEFAULT_DISTRICT_PROFILE_ID;
  const reports: SystemCostWindowReport[] = [];

  for (const costWindow of windows) {
    const state = prepareCity(input, input.scale.parcels);
    const plain = prepareCity(input, input.scale.parcels);
    const warmupStart = parseTick(warmupStartTick(costWindow, warmupTicks));
    state.clock = { ...state.clock, tick: warmupStart };
    plain.clock = { ...plain.clock, tick: warmupStart };
    for (let tick = 0; tick < warmupTicks; tick += 1) {
      advanceProductSystems(state);
      advanceProductSystems(plain);
    }
    /** El warmup ya ocurrió y dejó el reloj donde debe empezar la medición. */
    const startTick = state.clock.tick;
    injectScaledIncidents(state, costWindow.incidentCount);
    injectScaledIncidents(plain, costWindow.incidentCount);
    const counts = describeScaledCity(state);

    const plainSamples: number[] = [];
    const ordinarySamples: number[] = [];
    let plainClose: { tick: number; ms: number } | null = null;
    for (let tick = 0; tick < costWindow.ticks; tick += 1) {
      const closeTick = plain.clock.tick;
      const start = input.now();
      advanceProductSystems(plain);
      const elapsed = input.now() - start;
      plainSamples.push(elapsed);
      if (closeTick > 0 && closeTick % GAME_MONTH_TICKS === 0)
        plainClose = { tick: Number(closeTick), ms: elapsed };
      else ordinarySamples.push(elapsed);
    }

    const systemSamples = new Map<string, number[]>(
      PRODUCT_SYSTEMS.map((system) => [system.name, []]),
    );
    const tickSamples: number[] = [];
    let instrumentedCloseMs = 0;
    for (let tick = 0; tick < costWindow.ticks; tick += 1) {
      const closeTick = state.clock.tick;
      const tickStart = input.now();
      for (const system of PRODUCT_SYSTEMS) {
        const start = input.now();
        system.run(state);
        systemSamples.get(system.name)!.push(input.now() - start);
      }
      state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
      const elapsed = input.now() - tickStart;
      tickSamples.push(elapsed);
      if (closeTick > 0 && closeTick % GAME_MONTH_TICKS === 0) instrumentedCloseMs = elapsed;
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
      ordinaryTick: distribution(summarize(ordinarySamples)),
      monthClose: plainClose
        ? {
            tick: plainClose.tick,
            plainMs: plainClose.ms,
            instrumentedMs: instrumentedCloseMs,
          }
        : null,
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

export type MonthlyCloseSample = {
  seed: number;
  month: number;
  tick: number;
  closeMs: number;
  tenants: number;
  buildings: number;
  vacantSlots: number;
  loansDue: number;
};

export type MonthlyCloseMacroMode = "natural" | "none" | "representative" | "max";

export const MONTHLY_CLOSE_MACRO_MODES: readonly MonthlyCloseMacroMode[] = [
  "natural",
  "none",
  "representative",
  "max",
];

/** Tres shocks representativos de familias distintas: vivienda, obra y empleo. */
export const REPRESENTATIVE_MACRO_EVENTS = [
  "economic_recession",
  "construction_boom",
  "labor_shortage",
] as const satisfies readonly MacroEventType[];

export type MonthlyCloseMeasurement = {
  scaleId: string;
  parcelCount: number;
  seeds: number[];
  closesPerSeed: number;
  warmupTicks: number;
  macroMode: MonthlyCloseMacroMode;
  /** Muestra cruda de cada cierre, en el orden en que se midió. */
  closeSamplesMs: number[];
  close: CostDistribution;
  ordinaryTick: CostDistribution;
  /** Cada cierre con la carga que lo produjo: alimenta la optimización de `placeSearchers`. */
  samples: MonthlyCloseSample[];
  /** Desglose de maduración: mes 1, meses 2-3 y meses maduros 4+. */
  months: {
    first: CostDistribution;
    transition: CostDistribution;
    mature: CostDistribution;
  };
};

function forceMacroScenario(
  state: GameState,
  mode: MonthlyCloseMacroMode,
  currentTick: number,
): void {
  if (mode === "natural") return;
  state.phase2.macroEvents = {
    ...state.phase2.macroEvents,
    nextCheckTick: parseTick(Number.MAX_SAFE_INTEGER),
  };
  if (mode === "none") return;
  const types: readonly MacroEventType[] =
    mode === "max"
      ? (Object.keys(MACRO_EVENT_TEMPLATES) as MacroEventType[])
      : REPRESENTATIVE_MACRO_EVENTS;
  for (const type of types) {
    state.phase2.macroEvents = activateMacroEvent(
      state.phase2.macroEvents,
      type,
      parseTick(currentTick),
      1,
    );
  }
}

function closeLoad(
  state: GameState,
): Pick<MonthlyCloseSample, "tenants" | "buildings" | "vacantSlots" | "loansDue"> {
  let tenants = 0;
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status === "contracted") tenants += 1;
  }
  let buildings = 0;
  let vacantSlots = 0;
  for (const building of state.phase2.buildings.values()) {
    if (building.state !== "operational") continue;
    buildings += 1;
    vacantSlots += Math.max(
      0,
      BUILDING_DEFINITIONS[building.type].capacity - building.tenantIds.length,
    );
  }
  let loansDue = 0;
  for (const loan of state.phase2.loans.values()) {
    if (loan.status === "active" || loan.status === "delinquent") {
      if ((loan.nextPaymentTick ?? 0) <= state.clock.tick) loansDue += 1;
    }
  }
  return { tenants, buildings, vacantSlots, loansDue };
}

/**
 * Distribución del cierre mensual medida sobre campañas longitudinales reales. Cada semilla genera
 * UNA ciudad que vive múltiples cierres en secuencia, acumulando estado (préstamos pagados, mercado
 * de vivienda evolucionado, etc.). Esto reemplaza el benchmark sintético anterior que saltaba el reloj
 * y medía ciudades que nunca vivieron el cierre anterior.
 *
 * `macroMode` permite comparar con la misma metodología: `none` desactiva el sorteo, `representative`
 * mantiene tres shocks activos y `max` los seis; los modos forzados reactivan lo que caduque antes de
 * cada cierre, así que la comparación A/B no depende de dónde caiga el sorteo natural.
 *
 * Reporta además por separado mes 1 (estado inicial), meses 2-3 (transición) y meses maduros 4+, y
 * adjunta la carga de cada cierre para diagnosticar si `placeSearchers` empeora con el tiempo.
 */
export function measureMonthlyCloses(input: {
  scale: SystemCostScale;
  seeds: readonly number[];
  closesPerSeed?: number;
  warmupTicks?: number;
  districtId?: DistrictId;
  macroMode?: MonthlyCloseMacroMode;
  now: () => number;
}): MonthlyCloseMeasurement {
  const closesPerSeed = input.closesPerSeed ?? 6;
  const warmupTicks = input.warmupTicks ?? 60;
  const macroMode = input.macroMode ?? "natural";
  const closeSamplesMs: number[] = [];
  const ordinarySamples: number[] = [];
  const samples: MonthlyCloseSample[] = [];

  for (const seed of input.seeds) {
    // Crear UNA ciudad por semilla y dejarla vivir múltiples cierres
    const state = createScaledCity(seed, {
      parcelCount: input.scale.parcels,
      districtId: input.districtId,
    });
    forceMacroScenario(state, macroMode, 0);

    // Warmup inicial
    for (let tick = 0; tick < warmupTicks; tick += 1) advanceProductSystems(state);

    // Medir múltiples cierres mensuales en la MISMA ciudad
    for (let closeIndex = 1; closeIndex <= closesPerSeed; closeIndex += 1) {
      // Avanzar hasta 3 ticks antes del cierre mensual
      const targetTick = closeIndex * GAME_MONTH_TICKS;
      while (state.clock.tick < targetTick - 3) {
        advanceProductSystems(state);
      }
      forceMacroScenario(state, macroMode, state.clock.tick);

      // Medir los 6 ticks alrededor del cierre (3 antes, el cierre, 2 después)
      for (let tick = 0; tick < 6; tick += 1) {
        const currentTick = state.clock.tick;
        const isClose = currentTick > 0 && currentTick % GAME_MONTH_TICKS === 0;
        const load = isClose ? closeLoad(state) : null;
        const from = input.now();
        advanceProductSystems(state);
        const elapsed = input.now() - from;

        if (isClose) {
          closeSamplesMs.push(elapsed);
          samples.push({ seed, month: closeIndex, tick: currentTick, closeMs: elapsed, ...load! });
        } else {
          ordinarySamples.push(elapsed);
        }
      }
    }
  }

  const byMonth = (predicate: (month: number) => boolean): number[] =>
    samples.filter((sample) => predicate(sample.month)).map((sample) => sample.closeMs);

  return {
    scaleId: input.scale.id,
    parcelCount: input.scale.parcels,
    seeds: [...input.seeds],
    closesPerSeed,
    warmupTicks,
    macroMode,
    closeSamplesMs,
    close: distribution(summarize(closeSamplesMs)),
    ordinaryTick: distribution(summarize(ordinarySamples)),
    samples,
    months: {
      first: distribution(summarize(byMonth((month) => month === 1))),
      transition: distribution(summarize(byMonth((month) => month >= 2 && month <= 3))),
      mature: distribution(summarize(byMonth((month) => month >= 4))),
    },
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
