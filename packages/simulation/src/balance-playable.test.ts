import { describe, expect, it } from "vitest";
import {
  parseCommandId,
  parseMoney,
  parsePersonId,
  type AutomationFinanceMode,
  type AutomationPropertyMode,
  type BuildingDefinition,
  type BuildingType,
  type ConstructionSiteId,
  type CrewId,
  type MaintenancePolicy,
  type Money,
  type Parcel,
  type ParcelId,
  type ProductCommand,
  type ResourceKind,
} from "@landlord/shared";
import { detectInvariantViolations, measureBalance, type BalanceMetrics } from "./balance";
import { buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { developmentCodeById, isBuildingAllowedByDevelopmentCode } from "./development-codes";
import { dispatchProductCommand, type ProductCommandResult } from "./commands";
import {
  BUILDING_DEFINITIONS,
  GAME_DAY_TICKS,
  GAME_MONTH_TICKS,
  PLAYER_ORGANIZATION_ID,
  calculateTax,
  effectiveTaxRateBps,
} from "./game-data";
import { effectiveMarketPriceFor, materialCostModifierPercentFor } from "./macro-events";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  console?: { log(value: string): void };
};

/**
 * Campaña de balance **jugable**: arranca de `createInitialState(seed)` (distrito generado, 12 000 de
 * caja, inventario y cuadrillas autoradas) y sólo actúa mediante comandos reales despachados como la
 * persona/organización del jugador. No usa `createScaledCity`: ese mundo es un arnés de carga con
 * 5 000 000 de caja y activos regalados, y su campaña vive aparte en `balance.test.ts`.
 */

const PLAYER_PERSON_ID = parsePersonId("person_00000001");
const RESOURCES: readonly ResourceKind[] = ["cement", "brick", "steel"];
const STARTING_CASH = 12_000;
const FINANCE_CASH_FLOOR = parseMoney(2_000);

type StrategyId = "passive" | "maintained" | "delegated_deferred" | "delegated_balanced";

type StrategyDefinition = {
  id: StrategyId;
  maintenance: MaintenancePolicy;
  property: AutomationPropertyMode;
  finance: AutomationFinanceMode;
  maintenanceRepairThreshold: number | null;
};

/**
 * Las cuatro políticas comparables, expresadas sólo con `SetMaintenancePolicy` y
 * `SetAutomationPolicy`. `passive` reproduce la postura inicial de la partida salvo el mantenimiento,
 * que se fija en diferido para que la pareja passive/maintained aísle esa política.
 */
const STRATEGIES: readonly StrategyDefinition[] = [
  {
    id: "passive",
    maintenance: "deferred",
    property: "manual",
    finance: "manual",
    maintenanceRepairThreshold: null,
  },
  {
    id: "maintained",
    maintenance: "balanced",
    property: "manual",
    finance: "manual",
    maintenanceRepairThreshold: null,
  },
  {
    id: "delegated_deferred",
    maintenance: "deferred",
    property: "fill_vacancies",
    finance: "cover_shortfall",
    maintenanceRepairThreshold: null,
  },
  {
    id: "delegated_balanced",
    maintenance: "balanced",
    property: "fill_vacancies",
    finance: "cover_shortfall",
    maintenanceRepairThreshold: 40,
  },
];

const STRATEGY_IDS: readonly StrategyId[] = STRATEGIES.map((strategy) => strategy.id);

type CommandTally = {
  accepted: number;
  rejected: number;
  rejectionCodes: Record<string, number>;
};

type CommandAudit = Record<string, CommandTally>;

type PlayableCommand = Exclude<ProductCommand, { type: "PlaceTestStructure" }>;

/** El borrador que escribe la campaña; la identidad la añade siempre el emisor. */
type CommandDraft = {
  [TType in PlayableCommand["type"]]: Omit<
    Extract<PlayableCommand, { type: TType }>,
    "commandId" | "issuedByPersonId" | "actingAsOrganizationId"
  >;
}[PlayableCommand["type"]];

type CommandSender = {
  setMaintenancePolicy(policy: MaintenancePolicy): ProductCommandResult;
  setAutomationPolicy(payload: {
    property: AutomationPropertyMode;
    finance: AutomationFinanceMode;
    maintenanceRepairThreshold: number | null;
    financeCashFloor: Money;
  }): ProductCommandResult;
  buyParcel(parcelId: ParcelId): ProductCommandResult;
  buyMaterials(resource: ResourceKind, amount: number): ProductCommandResult;
  requestPermit(parcelId: ParcelId, buildingType: BuildingType): ProductCommandResult;
  startConstruction(parcelId: ParcelId, buildingType: BuildingType): ProductCommandResult;
  allocateCrew(constructionSiteId: ConstructionSiteId, crewCapacity: 1 | 2): ProductCommandResult;
  assignCrewToWorkOrder(crewId: CrewId, workOrderId: ConstructionSiteId): ProductCommandResult;
};

/**
 * Despacha comandos reales del jugador y contabiliza aceptados/rechazados por tipo y código, para que
 * el dataset pueda auditar que cada estrategia hizo algo y no quedó bloqueada en silencio.
 */
function createCommandSender(state: GameState, prefix: string, audit: CommandAudit): CommandSender {
  let counter = 0;
  const emit = (command: PlayableCommand): ProductCommandResult => {
    const result = dispatchProductCommand(state, command);
    const tally = (audit[command.type] ??= {
      accepted: 0,
      rejected: 0,
      rejectionCodes: {},
    });
    if (result.accepted) {
      tally.accepted += 1;
      return result;
    }
    tally.rejected += 1;
    tally.rejectionCodes[result.code] = (tally.rejectionCodes[result.code] ?? 0) + 1;
    return result;
  };
  const withIdentity = (draft: CommandDraft): PlayableCommand => {
    counter += 1;
    return {
      ...draft,
      commandId: parseCommandId(`${prefix}-${counter}`),
      issuedByPersonId: PLAYER_PERSON_ID,
      actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    } as PlayableCommand;
  };
  return {
    setMaintenancePolicy: (policy) =>
      emit(withIdentity({ type: "SetMaintenancePolicy", payload: { policy } })),
    setAutomationPolicy: (payload) =>
      emit(withIdentity({ type: "SetAutomationPolicy", payload: { ...payload } })),
    buyParcel: (parcelId) => emit(withIdentity({ type: "BuyParcel", payload: { parcelId } })),
    buyMaterials: (resource, amount) =>
      emit(withIdentity({ type: "BuyMaterials", payload: { resource, amount } })),
    requestPermit: (parcelId, buildingType) =>
      emit(withIdentity({ type: "RequestPermit", payload: { parcelId, buildingType } })),
    startConstruction: (parcelId, buildingType) =>
      emit(withIdentity({ type: "StartConstruction", payload: { parcelId, buildingType } })),
    allocateCrew: (constructionSiteId, crewCapacity) =>
      emit(withIdentity({ type: "AllocateCrew", payload: { constructionSiteId, crewCapacity } })),
    assignCrewToWorkOrder: (crewId, workOrderId) =>
      emit(withIdentity({ type: "AssignCrewToWorkOrder", payload: { crewId, workOrderId } })),
  };
}

function playerCash(state: GameState): number {
  return state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0;
}

function playerInventory(state: GameState) {
  return state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
}

/** Edificio rentable más barato que el código admite; `null` si la parcela sólo permite producción. */
function rentableDefinitionFor(codeId: Parcel["developmentCodeId"]): BuildingDefinition | null {
  const code = developmentCodeById(codeId);
  const candidates = Object.values(BUILDING_DEFINITIONS)
    .filter(
      (definition) =>
        definition.capacity > 0 && isBuildingAllowedByDevelopmentCode(definition, code),
    )
    .sort((left, right) => left.cost - right.cost || left.type.localeCompare(right.type));
  return candidates[0] ?? null;
}

/**
 * Ciclo de expansión más barato disponible. Termina primero lo que la organización ya posee (parcela
 * propia sin edificio ni obra) y sólo después compra suelo libre: el mismo criterio para las cuatro
 * estrategias, ordenado por coste total del ciclo y desempate por id de parcela.
 */
function expansionTarget(
  state: GameState,
): { parcel: Parcel; definition: BuildingDefinition; owned: boolean } | null {
  const busyParcelIds = new Set(
    [...state.phase2.constructionSites.values()].map((site) => site.parcelId),
  );
  /** V.d: la cuadrilla sólo trabaja en su distrito, así que la rutina no compra suelo inalcanzable. */
  const playerDistricts = new Set(
    [...state.agents.values()]
      .filter(
        (agent) =>
          agent.organizationId === PLAYER_ORGANIZATION_ID &&
          agent.state !== "dead" &&
          agent.state !== "injured",
      )
      .map((agent) => agent.districtId),
  );
  const buildingIndex = buildBuildingIndex(state);
  const candidates = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        buildingsOnParcel(buildingIndex, parcel.id).length === 0 &&
        !busyParcelIds.has(parcel.id) &&
        playerDistricts.has(parcel.districtId),
    )
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID ||
        parcel.ownerOrganizationId === null,
    )
    .map((parcel) => ({
      parcel,
      definition: rentableDefinitionFor(parcel.developmentCodeId),
      owned: parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID,
    }))
    .filter(
      (entry): entry is { parcel: Parcel; definition: BuildingDefinition; owned: boolean } =>
        entry.definition !== null,
    )
    .map((entry) => ({ ...entry, total: expansionBudget(state, entry.parcel, entry.definition) }))
    .sort(
      (left, right) =>
        left.total.total - right.total.total || left.parcel.id.localeCompare(right.parcel.id),
    );
  const cheapest = candidates[0];
  return cheapest
    ? { parcel: cheapest.parcel, definition: cheapest.definition, owned: cheapest.owned }
    : null;
}

/**
 * Presupuesto exacto del ciclo de expansión con los mismos modificadores que aplican los comandos
 * (ordenanza y macroeventos), para que la rutina no gaste en materiales y luego no pueda construir.
 */
function expansionBudget(
  state: GameState,
  parcel: Parcel,
  definition: BuildingDefinition,
): {
  total: number;
  missing: Record<ResourceKind, number>;
  materialsFit: boolean;
} {
  const owned = parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID;
  const transferRateBps = effectiveTaxRateBps(
    state.phase2.taxation.transferRateBps,
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.transferTaxModifierPercent
      : 0,
  );
  const transferTax = owned ? 0 : calculateTax(parcel.marketValue, transferRateBps);
  const inventory = playerInventory(state);
  const missing = { cement: 0, brick: 0, steel: 0 } as Record<ResourceKind, number>;
  for (const resource of RESOURCES) {
    missing[resource] = Math.max(0, definition.resources[resource] - inventory[resource]);
  }
  const materialCost = RESOURCES.reduce(
    (total, resource) => total + missing[resource] * effectiveMarketPriceFor(state, resource),
    0,
  );
  const buildCost = parseMoney(
    Math.max(0, Math.round(definition.cost * (1 + materialCostModifierPercentFor(state) / 100))),
  );
  const used = inventory.cement + inventory.brick + inventory.steel;
  const missingTotal = RESOURCES.reduce((total, resource) => total + missing[resource], 0);
  return {
    total: (owned ? 0 : parcel.marketValue) + transferTax + materialCost + buildCost,
    missing,
    materialsFit: missingTotal <= inventory.capacity - used,
  };
}

function playerConstructionSites(state: GameState) {
  return [...state.phase2.constructionSites.values()]
    .filter((site) => site.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Suma de los valores de catálogo autorados del suelo y los edificios del jugador. Es una lectura
 * derivada para poder comparar estrategias que reinvierten de forma distinta: no es una tasación, no
 * entra en el estado y no cambia ninguna regla económica.
 */
function playerAssetBookValue(state: GameState): number {
  let total = 0;
  const index = buildBuildingIndex(state);
  for (const parcel of state.phase2.parcels.values()) {
    if (parcel.ownerOrganizationId !== PLAYER_ORGANIZATION_ID) continue;
    total += parcel.marketValue;
    for (const building of buildingsOnParcel(index, parcel.id)) {
      total += BUILDING_DEFINITIONS[building.type].cost;
    }
  }
  return total;
}

function freePlayerCrew(state: GameState) {
  const busy = new Set(
    [...state.phase2.constructionSites.values()].flatMap((site) => site.assignedCrewIds),
  );
  return (
    [...state.phase2.crews.values()]
      .filter((crew) => crew.organizationId === PLAYER_ORGANIZATION_ID && !busy.has(crew.id))
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

/**
 * Rutina de crecimiento común e idéntica para las cuatro estrategias: cerrar el ciclo de expansión más
 * barato (comprar la parcela si no es propia, comprar los materiales que faltan, pedir el permiso,
 * iniciar la obra y asignar una cuadrilla), un ciclo por día de juego y sólo mientras la caja cubra el
 * coste exacto. No toca el mantenimiento, la ocupación ni la financiación: ésas son la política que se
 * compara, y ninguna estrategia obtiene recursos gratis ni se salta una validación.
 */
function runGrowthRoutine(state: GameState, send: CommandSender): void {
  const ownSiteInProgress = playerConstructionSites(state).some(
    (site) => site.kind === "construction",
  );
  if (!ownSiteInProgress) {
    const target = expansionTarget(state);
    if (target) {
      const budget = expansionBudget(state, target.parcel, target.definition);
      if (budget.materialsFit && playerCash(state) >= budget.total) {
        const ready = target.owned || send.buyParcel(target.parcel.id).accepted;
        if (ready) {
          for (const resource of RESOURCES) {
            const amount = budget.missing[resource];
            if (amount > 0) send.buyMaterials(resource, amount);
          }
          send.requestPermit(target.parcel.id, target.definition.type);
          send.startConstruction(target.parcel.id, target.definition.type);
        }
      }
    }
  }
  // Sólo las obras nuevas que abre esta rutina: los partes de reparación los gestiona la política.
  for (const site of playerConstructionSites(state)) {
    if (site.kind !== "construction" || site.assignedCrewIds.length > 0) continue;
    const crew = freePlayerCrew(state);
    if (!crew) break;
    send.allocateCrew(site.id, 2);
    send.assignCrewToWorkOrder(crew.id, site.id);
  }
}

type PlayableOutcome = {
  strategy: StrategyId;
  seed: number;
  playerCash: number;
  /** Deuda viva de la organización del jugador; `metrics.debt` suma la de todo el distrito. */
  playerDebt: number;
  worldParcelCount: number;
  playerParcels: number;
  playerBuildings: number;
  playerAssetBookValue: number;
  acceptedCommands: number;
  rejectedCommands: number;
  audit: CommandAudit;
  metrics: BalanceMetrics;
  violations: string[];
};

function acceptedTotal(audit: CommandAudit): number {
  return Object.values(audit).reduce((total, tally) => total + tally.accepted, 0);
}

function rejectedTotal(audit: CommandAudit): number {
  return Object.values(audit).reduce((total, tally) => total + tally.rejected, 0);
}

/**
 * Una campaña jugable completa: posición inicial legítima, políticas por comando, rutina de crecimiento
 * común y `months` meses de sistemas de producto.
 */
function runPlayableCampaign(
  strategy: StrategyDefinition,
  seed: number,
  months: number,
): PlayableOutcome {
  const state = createInitialState(seed);
  const audit: CommandAudit = {};
  const send = createCommandSender(state, `playable-${strategy.id}-${seed}`, audit);
  send.setMaintenancePolicy(strategy.maintenance);
  send.setAutomationPolicy({
    property: strategy.property,
    finance: strategy.finance,
    maintenanceRepairThreshold: strategy.maintenanceRepairThreshold,
    financeCashFloor: FINANCE_CASH_FLOOR,
  });
  for (let tick = 0; tick < GAME_MONTH_TICKS * months; tick += 1) {
    advanceProductSystems(state);
    if (state.clock.tick % GAME_DAY_TICKS === 0) runGrowthRoutine(state, send);
  }
  const metrics = measureBalance(state);
  const player = metrics.organizations.find(
    (entry) => entry.organizationId === PLAYER_ORGANIZATION_ID,
  );
  return {
    strategy: strategy.id,
    seed,
    playerCash: playerCash(state),
    playerDebt: player?.debt ?? 0,
    worldParcelCount: state.phase2.parcels.size,
    playerParcels: player?.parcels ?? 0,
    playerBuildings: player?.buildings ?? 0,
    playerAssetBookValue: playerAssetBookValue(state),
    acceptedCommands: acceptedTotal(audit),
    rejectedCommands: rejectedTotal(audit),
    audit,
    metrics,
    violations: detectInvariantViolations(state),
  };
}

/**
 * Semillas registradas de la campaña jugable. 16 semillas × 12 meses × 4 estrategias tardan ~70 s en
 * un portátil de desarrollo, muy por debajo del techo de 10 minutos que se fija esta herramienta; cada
 * semilla genera su propio distrito (`worldParcelCount` varía entre 18 y 36 parcelas).
 */
const CAMPAIGN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const CAMPAIGN_MONTHS = 12;

/** Cada estrategia debe actuar de verdad: sin compras ni obras aceptadas la campaña no mide nada. */
function expectStrategyActed(outcome: PlayableOutcome): void {
  const accepted = (type: string): number => outcome.audit[type]?.accepted ?? 0;
  const label = `${outcome.strategy}:${outcome.seed}`;
  expect(accepted("SetMaintenancePolicy"), label).toBe(1);
  expect(accepted("SetAutomationPolicy"), label).toBe(1);
  expect(accepted("BuyParcel"), label).toBeGreaterThan(0);
  expect(accepted("StartConstruction"), label).toBeGreaterThan(0);
  expect(accepted("AssignCrewToWorkOrder"), label).toBeGreaterThan(0);
  expect(outcome.playerParcels, label).toBeGreaterThan(0);
  expect(outcome.playerCash, label).toBeLessThan(STARTING_CASH);
}

describe("Balance jugable (revisión de WP4.14)", () => {
  it("la rutina de crecimiento construye con la posición inicial legítima", () => {
    const outcome = runPlayableCampaign(STRATEGIES[1]!, 1, 4);
    expect(outcome.violations).toEqual([]);
    expect(outcome.audit["BuyParcel"]?.accepted).toBeGreaterThan(0);
    expect(outcome.audit["RequestPermit"]?.accepted).toBeGreaterThan(0);
    expect(outcome.audit["StartConstruction"]?.accepted).toBeGreaterThan(0);
    expect(outcome.audit["AssignCrewToWorkOrder"]?.accepted).toBeGreaterThan(0);
    expect(outcome.playerParcels).toBeGreaterThan(0);
    expect(outcome.playerCash).toBeLessThan(STARTING_CASH);
    expect(outcome.playerCash).toBeGreaterThan(0);
    // Ningún comando de la rutina se rechaza por condiciones previas mal calculadas.
    expect(outcome.audit["BuyParcel"]?.rejected ?? 0).toBe(0);
    expect(outcome.audit["StartConstruction"]?.rejected ?? 0).toBe(0);
    expect(outcome.audit["BuyMaterials"]?.rejected ?? 0).toBe(0);
  });

  it("no regala nada: la caja sólo baja por comandos aceptados", () => {
    // La posición de salida es la autorada en `state.ts`; si cambia, esta campaña deja de ser jugable.
    expect(createInitialState(2).phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(STARTING_CASH);
    const outcome = runPlayableCampaign(STRATEGIES[0]!, 2, 4);
    expect(outcome.violations).toEqual([]);
    expect(outcome.playerCash).toBeLessThan(STARTING_CASH);
    // Sin delegación financiera no hay préstamos: la estrategia pasiva se financia con su caja.
    expect(outcome.audit["RequestLoan"]?.accepted ?? 0).toBe(0);
    expect(outcome.audit["AcceptLoanOffer"]?.accepted ?? 0).toBe(0);
    expect(outcome.metrics.debt.outstandingPrincipal).toBeGreaterThanOrEqual(0);
  });

  it("la misma semilla produce exactamente la misma campaña", () => {
    const first = runPlayableCampaign(STRATEGIES[2]!, 3, 6);
    const second = runPlayableCampaign(STRATEGIES[2]!, 3, 6);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  }, 60_000);

  it.skipIf(environment.process?.env?.PLAYABLE_BALANCE_CAMPAIGN !== "1")(
    "campaña jugable con seeds registradas, auditoría de comandos y dominancia",
    () => {
      const outcomes = STRATEGIES.flatMap((strategy) =>
        CAMPAIGN_SEEDS.map((seed) => runPlayableCampaign(strategy, seed, CAMPAIGN_MONTHS)),
      );
      for (const outcome of outcomes) {
        expect(outcome.violations, `${outcome.strategy}:${outcome.seed}`).toEqual([]);
        expectStrategyActed(outcome);
      }
      // Determinismo: se repite una semilla por estrategia y debe coincidir byte a byte.
      for (const strategy of STRATEGIES) {
        const seed = CAMPAIGN_SEEDS[0]!;
        const repeat = runPlayableCampaign(strategy, seed, CAMPAIGN_MONTHS);
        const original = outcomes.find(
          (outcome) => outcome.strategy === strategy.id && outcome.seed === seed,
        )!;
        expect(JSON.stringify(repeat), `${strategy.id}:${seed}`).toBe(JSON.stringify(original));
      }
      const dominance = CAMPAIGN_SEEDS.map((seed) => {
        const byStrategy = (id: StrategyId): number =>
          outcomes.find((outcome) => outcome.strategy === id && outcome.seed === seed)!.playerCash;
        const ranking = STRATEGY_IDS.map((id) => ({ id, cash: byStrategy(id) })).sort(
          (left, right) => right.cash - left.cash || left.id.localeCompare(right.id),
        );
        return { seed, winner: ranking[0]!.id, ranking: ranking.map((entry) => entry.id) };
      });
      const winsByStrategy = Object.fromEntries(
        STRATEGY_IDS.map((id) => [id, dominance.filter((entry) => entry.winner === id).length]),
      ) as Record<StrategyId, number>;
      const threshold = Math.ceil(CAMPAIGN_SEEDS.length * 0.9);
      environment.console?.log(`PLAYABLE_BALANCE_CAMPAIGN ${JSON.stringify(outcomes)}`);
      environment.console?.log(
        `PLAYABLE_BALANCE_DOMINANCE ${JSON.stringify({
          metric: "playerCash",
          seeds: CAMPAIGN_SEEDS.length,
          dominantThreshold: threshold,
          winsByStrategy,
          anyDominant: STRATEGY_IDS.some((id) => winsByStrategy[id] >= threshold),
        })}`,
      );
      expect(Object.values(winsByStrategy).reduce((total, wins) => total + wins, 0)).toBe(
        CAMPAIGN_SEEDS.length,
      );
    },
    3_600_000,
  );
});
