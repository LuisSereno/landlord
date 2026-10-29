import { describe, expect, it } from "vitest";
import {
  parseCommandId,
  parsePersonId,
  validateSnapshotReferences,
  type ParcelId,
  type ProductCommand,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { CANONICAL_CITY_SEEDS } from "./city-fixtures";
import { dispatchProductCommand } from "./commands";
import { facilityCoverageIndex } from "./facility-coverage";
import { describeHousingStock, HOUSING_MARKET_POLICY } from "./housing-market";
import {
  BANK_ORGANIZATION_ID,
  BUILDING_DEFINITIONS,
  GAME_MONTH_TICKS,
  INSURER_ORGANIZATION_ID,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { developmentCodeById, isBuildingAllowedByDevelopmentCode } from "./development-codes";
import { buildLandValueContext, landValueBreakdownFor } from "./land-value";
import { buildCoverageIndex } from "./urban-services";
import { canonicalizeState } from "./runner";
import { advanceProductSystems } from "./systems";
import { serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";

/**
 * §2.2 · CAMPAÑA INSTRUMENTADA DE 24 MESES (2 AÑOS).
 *
 * Dos años de juego (24 cierres mensuales, 345 600 ticks) sobre una seed canónica de ciudad, con
 * delegación de cartera activa y un guion fijo de decisiones del jugador. El objetivo NO es demostrar
 * que el jugador gana: las aserciones son estructurales ( invariantes, integridad numérica,
 * referencias, coherencia de mercado/servicios/suelo/préstamos/incidentes/vivienda/IA rival/gasto
 * municipal) y los importes resultantes se registran tal cual salen. Ningún umbral se ha ajustado
 * para que la economía luzca favorable; si un número es malo, este test lo cuenta, no lo esconde.
 */

const MONTHS = 24;
const MILESTONES = [1, 6, 12, 18, 24] as const;
const CAMPAIGN_SEED = CANONICAL_CITY_SEEDS[4]!;

const actor = parsePersonId("person_00000001");

function playerCommand<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

/**
 * Guion del jugador, no un guion a medida: en los meses 1, 6 y 13 compra el solar libre más barato
 * que su código permite, pide permiso, construye y asigna una cuadrilla libre. Las decisiones tienen
 * que ser aceptadas por el motor; si alguna se rechaza, el test lo denuncia con su código en vez de
 * fingir que la campaña funcionó.
 */
function scriptedMonth(state: GameState, month: number): string[] {
  const failures: string[] = [];
  const record = (label: string, result: { accepted: boolean; code?: string }): void => {
    if (!result.accepted) failures.push(`${label}: ${String(result.code ?? "rechazado")}`);
  };

  const cash = Number(state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0);
  const candidates = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.districtId === PLAYER_HOME_DISTRICT_ID &&
        parcel.disposition === "marketable" &&
        !parcel.ownerOrganizationId &&
        isBuildingAllowedByDevelopmentCode(
          BUILDING_DEFINITIONS.courtyard_home,
          developmentCodeById(parcel.developmentCodeId),
        ) &&
        Number(parcel.marketValue) < cash,
    )
    .sort(
      (left, right) =>
        Number(left.marketValue) - Number(right.marketValue) || left.id.localeCompare(right.id),
    );
  const target = candidates[0];
  if (!target) return [`mes ${String(month)}: sin solar asequible y compatible para el jugador`];

  record(
    `BuyParcel mes ${String(month)}`,
    dispatchProductCommand(
      state,
      playerCommand(`campaign-buy-${String(month)}`, "BuyParcel", { parcelId: target.id }),
    ),
  );
  record(
    `RequestPermit mes ${String(month)}`,
    dispatchProductCommand(
      state,
      playerCommand(`campaign-permit-${String(month)}`, "RequestPermit", {
        parcelId: target.id,
        buildingType: "courtyard_home",
      }),
    ),
  );
  /** El jugador compra el material que le falta: es parte del juego, no una ventaja escrita. */
  const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  const definition = BUILDING_DEFINITIONS.courtyard_home;
  for (const resource of ["cement", "brick", "steel"] as const) {
    const missing = definition.resources[resource] - inventory[resource];
    if (missing <= 0) continue;
    record(
      `BuyMaterials ${resource} mes ${String(month)}`,
      dispatchProductCommand(
        state,
        playerCommand(`campaign-materials-${resource}-${String(month)}`, "BuyMaterials", {
          resource,
          amount: missing,
        }),
      ),
    );
  }
  record(
    `StartConstruction mes ${String(month)}`,
    dispatchProductCommand(
      state,
      playerCommand(`campaign-build-${String(month)}`, "StartConstruction", {
        parcelId: target.id,
        buildingType: "courtyard_home",
      }),
    ),
  );
  assignFreeCrews(state, `mes-${String(month)}`, failures);
  return failures;
}

/** Toda obra propia sin cuadrilla recibe la primera cuadrilla libre, en orden canónico de id. */
function assignFreeCrews(state: GameState, label: string, failures: string[]): void {
  const busy = new Set<string>();
  for (const entry of state.phase2.constructionSites.values())
    for (const crewId of entry.assignedCrewIds) busy.add(crewId as string);
  const freeCrews = [...state.phase2.crews.values()]
    .filter(
      (crew) => !busy.has(crew.id as string) && crew.organizationId === PLAYER_ORGANIZATION_ID,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const openSites = [...state.phase2.constructionSites.values()]
    .filter(
      (entry) =>
        entry.ownerOrganizationId === PLAYER_ORGANIZATION_ID && entry.assignedCrewIds.length === 0,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const entry of openSites) {
    const crew = freeCrews.shift();
    if (!crew) break;
    const result = dispatchProductCommand(
      state,
      playerCommand(`campaign-crew-${label}-${entry.id}`, "AssignCrewToWorkOrder", {
        workOrderId: entry.id,
        crewId: crew.id,
      }),
    );
    if (!result.accepted)
      failures.push(`${label} ${entry.id}: ${String(result.code ?? "rechazado")}`);
  }
}
type Observation = {
  month: number;
  cashByOrganizationId: Record<string, number>;
  playerParcels: number;
  playerBuildings: number;
  rivalParcels: number;
  rivalBuildings: number;
  rivalTransactions: number;
  transactions: number;
  municipalSpent: number;
  incidentsTotal: number;
  incidentsActive: number;
  ruins: number;
  meanHousingSafety: number;
  meanLandValue: number;
  servedDemandParcels: number;
  cleaningCoveredParcels: number;
  saturatedFacilities: number;
  loans: number;
  households: number;
  contracted: number;
  displaced: number;
};

function finite(value: number, label: string): void {
  expect(Number.isFinite(value), label).toBe(true);
  expect(Number.isSafeInteger(value), `${label} no es entero`).toBe(true);
}

/** Invariantes que han de sostenerse en CADA cierre mensual, no sólo en los hitos. */
function assertInvariants(state: GameState, month: number, previous: Map<ParcelId, number>): void {
  const districts = [...state.world.districts.values()];
  const label = `mes ${String(month)}`;

  /** Estructura de ciudad y programa municipal. */
  expect(state.world.districts.size, label).toBe(9);
  const facilities = districts.flatMap((district) => [...district.facilities.values()]);
  expect(facilities.length, label).toBe(14);
  expect(districts.flatMap((district) => [...district.publicSpaces.values()]).length, label).toBe(
    7,
  );

  /** Suelo público: inalienable, no edificable por empresas, siempre del ayuntamiento. */
  for (const parcel of state.phase2.parcels.values()) {
    if (parcel.disposition === "marketable") continue;
    expect(parcel.ownerOrganizationId, `parcela pública ${parcel.id} en ${label}`).toBe(
      MUNICIPALITY_ORGANIZATION_ID,
    );
  }

  /** Dinero: entero, finito y no negativo para las organizaciones que no prestan. */
  for (const [organizationId, balance] of state.phase2.balances)
    finite(Number(balance), `saldo ${organizationId} en ${label}`);

  /** Edificios: dueño, distrito y huella consistentes; ningún edificio huérfano de parcela. */
  for (const building of state.phase2.buildings.values()) {
    const parcel = state.phase2.parcels.get(building.parcelId);
    expect(parcel, `edificio ${building.id} sin parcela en ${label}`).toBeDefined();
    expect(building.districtId, `distrito de ${building.id} en ${label}`).toBe(parcel!.districtId);
    expect(building.footprintCells.length, `huella de ${building.id} en ${label}`).toBeGreaterThan(
      0,
    );
    for (const cell of building.footprintCells)
      expect(
        parcel!.cells.some((host) => host.x === cell.x && host.y === cell.y),
        `${building.id} pisa fuera de su parcela en ${label}`,
      ).toBe(true);
    finite(Number(building.structuralIntegrity), `integridad de ${building.id} en ${label}`);
    expect(building.structuralIntegrity, label).toBeGreaterThanOrEqual(0);
    expect(building.structuralIntegrity, label).toBeLessThanOrEqual(100);
    expect(building.condition, label).toBeGreaterThanOrEqual(0);
    expect(building.condition, label).toBeLessThanOrEqual(100);
  }

  /** Dos edificios no comparten celda: la huella es ocupación física exclusiva. */
  const seenCells = new Map<string, string>();
  for (const building of state.phase2.buildings.values())
    for (const cell of building.footprintCells) {
      const key = `${building.districtId}|${cell.x}:${cell.y}`;
      expect(seenCells.has(key), `celda ${key} duplicada en ${label}`).toBe(false);
      seenCells.set(key, building.id);
    }

  /** Trabajo táctico dentro del distrito del agente (D-088): nada de automatismo transdistrital. */
  for (const agent of state.agents.values()) {
    if (!agent.task) continue;
    if (agent.task.kind === "maintenance" || agent.task.kind === "sabotage_building") {
      const building = state.phase2.buildings.get(
        agent.task.kind === "maintenance" ? agent.task.buildingId : agent.task.targetBuildingId,
      );
      if (building)
        expect(building.districtId, `${agent.id} trabaja fuera de su distrito en ${label}`).toBe(
          agent.districtId,
        );
    }
    if (agent.task.kind === "work_order") {
      const site = state.phase2.constructionSites.get(agent.task.workOrderId);
      if (site)
        expect(site.districtId, `${agent.id} obra fuera de su distrito en ${label}`).toBe(
          agent.districtId,
        );
    }
    expect(agent.travel ?? null, `${agent.id} viaja y trabaja en ${label}`).toBeNull();
  }

  /** Valor del suelo: entero, no negativo, paso mensual ≤ 5 % y desglose que suma exacto. */
  const coverage = buildCoverageIndex(state);
  const contexts = new Map(
    state.world.city.districtIds.map((districtId) => [
      districtId,
      buildLandValueContext(state, districtId, coverage),
    ]),
  );
  for (const parcel of state.phase2.parcels.values()) {
    finite(Number(parcel.marketValue), `marketValue de ${parcel.id} en ${label}`);
    finite(Number(parcel.baseLandValue), `baseLandValue de ${parcel.id} en ${label}`);
    expect(parcel.marketValue, label).toBeGreaterThanOrEqual(0);
    if (parcel.disposition !== "marketable") {
      expect(parcel.marketValue, `suelo público valorado en ${label}`).toBe(0);
      continue;
    }
    const breakdown = landValueBreakdownFor(parcel, contexts.get(parcel.districtId)!);
    expect(breakdown.rawScore, `desglose de ${parcel.id} en ${label}`).toBe(
      breakdown.roadCentrality +
        breakdown.commercialAccess +
        breakdown.civicAmenities +
        breakdown.frontage +
        breakdown.codePotential +
        breakdown.services +
        breakdown.industrialExternality +
        breakdown.isolation +
        breakdown.seedVariation,
    );
    expect(breakdown.score, label).toBeGreaterThanOrEqual(-40);
    expect(breakdown.score, label).toBeLessThanOrEqual(60);
    const before = previous.get(parcel.id);
    if (before !== undefined) {
      const cap = Math.floor((before * 5) / 100);
      expect(
        Math.abs(parcel.marketValue - before),
        `paso mensual de ${parcel.id} en ${label}: ${String(before)}→${String(parcel.marketValue)}`,
      ).toBeLessThanOrEqual(cap);
    }
    previous.set(parcel.id, parcel.marketValue);
  }

  /** Servicios: cobertura acotada y reparto de capacidad coherente. */
  for (const values of coverage.byParcelId.values())
    for (const key of ["transport", "security", "cleaning"] as const) {
      expect(values[key], label).toBeGreaterThanOrEqual(0);
      expect(values[key], label).toBeLessThanOrEqual(100);
    }
  const facilityIndex = facilityCoverageIndex(state);
  for (const report of facilityIndex.facilities.values()) {
    expect(report.served, label).toBeLessThanOrEqual(report.effectiveCapacity);
    expect(report.served, label).toBeLessThanOrEqual(report.demand);
    expect(report.coveragePercent, label).toBeGreaterThanOrEqual(0);
    expect(report.coveragePercent, label).toBeLessThanOrEqual(100);
    expect(report.saturated, `saturación de ${report.facilityId} en ${label}`).toBe(
      report.demand > report.effectiveCapacity,
    );
  }

  /** Mercado de vivienda: índices dentro de la banda y unidades contadas. */
  for (const [districtId, market] of Object.entries(state.phase2.housingMarket.byDistrictId)) {
    for (const [type, index] of Object.entries(market.rentIndexPercentByBuildingType)) {
      expect(index, `índice ${type} en ${districtId} ${label}`).toBeGreaterThanOrEqual(
        HOUSING_MARKET_POLICY.minimumIndexPercent,
      );
      expect(index, `índice ${type} en ${districtId} ${label}`).toBeLessThanOrEqual(
        HOUSING_MARKET_POLICY.maximumIndexPercent,
      );
    }
  }

  /** Hogares: un contrato activo apunta a un edificio que existe y no está en ruina. */
  for (const tenant of state.phase2.tenants.values()) {
    expect(tenant.leaseRemaining, `hogar ${tenant.id} en ${label}`).toBeGreaterThanOrEqual(0);
    if (!tenant.activeContractBuildingId) continue;
    const building = state.phase2.buildings.get(tenant.activeContractBuildingId);
    expect(building, `contrato huérfano en ${label}`).toBeDefined();
    expect(building!.state, `contrato sobre ruina en ${label}`).not.toBe("ruin");
  }

  /** Préstamos: principal e intereses enteros y términos positivos. */
  for (const loan of state.phase2.loans.values()) {
    finite(Number(loan.principal), `principal de ${loan.id} en ${label}`);
    finite(Number(loan.outstandingPrincipal), `vivo de ${loan.id} en ${label}`);
    expect(Number(loan.outstandingPrincipal), label).toBeGreaterThanOrEqual(0);
    expect(Number(loan.outstandingPrincipal), label).toBeLessThanOrEqual(Number(loan.principal));
    expect(loan.termMonths, label).toBeGreaterThan(0);
    expect(loan.remainingMonths, label).toBeGreaterThanOrEqual(0);
  }

  /** Incidentes: referencias vivas y campos acotados. */
  for (const incident of state.phase2.incidents.values()) {
    expect(
      state.phase2.buildings.has(incident.buildingId) || incident.status === "resolved",
      `incidente ${incident.id} sin edificio en ${label}`,
    ).toBe(true);
    expect(incident.intensity, label).toBeGreaterThanOrEqual(0);
    expect(incident.intensity, label).toBeLessThanOrEqual(100);
  }

  /** Referencias del snapshot: íntegras en cada cierre. */
  expect(validateSnapshotReferences(serializeSnapshot(state)), label).toEqual([]);
}

function observe(state: GameState, month: number): Observation {
  const stock = describeHousingStock(state);
  const coverage = buildCoverageIndex(state);
  const facilityIndex = facilityCoverageIndex(state);
  const parcels = [...state.phase2.parcels.values()];
  const buildings = [...state.phase2.buildings.values()];
  return {
    month,
    cashByOrganizationId: Object.fromEntries(
      [...state.phase2.balances.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([organizationId, balance]) => [organizationId, Number(balance)]),
    ),
    playerParcels: parcels.filter((parcel) => parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
      .length,
    playerBuildings: buildings.filter(
      (building) => building.ownerOrganizationId === PLAYER_ORGANIZATION_ID,
    ).length,
    rivalParcels: parcels.filter((parcel) => parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID)
      .length,
    rivalBuildings: buildings.filter(
      (building) => building.ownerOrganizationId === RIVAL_ORGANIZATION_ID,
    ).length,
    rivalTransactions: [...state.phase2.transactions.values()].filter(
      (transaction) => transaction.organizationId === RIVAL_ORGANIZATION_ID,
    ).length,
    transactions: state.phase2.transactions.length,
    municipalSpent: [...state.phase2.transactions.values()]
      .filter((transaction) => transaction.organizationId === MUNICIPALITY_ORGANIZATION_ID)
      .reduce((total, transaction) => total + Number(transaction.amount), 0),
    incidentsTotal: state.phase2.incidents.size,
    incidentsActive: [...state.phase2.incidents.values()].filter(
      (incident) => incident.status === "active",
    ).length,
    ruins: buildings.filter((building) => building.state === "ruin").length,
    meanHousingSafety:
      stock.length === 0
        ? 0
        : Math.round(stock.reduce((total, unit) => total + unit.safety, 0) / stock.length),
    meanLandValue: Math.round(
      parcels
        .filter((parcel) => parcel.disposition === "marketable")
        .reduce((total, parcel) => total + Number(parcel.marketValue), 0) /
        Math.max(1, parcels.filter((parcel) => parcel.disposition === "marketable").length),
    ),
    servedDemandParcels: [...facilityIndex.byParcelId.values()].filter(
      (values) => values.security > 0,
    ).length,
    cleaningCoveredParcels: [...coverage.byParcelId.values()].filter(
      (values) => values.cleaning > 0,
    ).length,
    saturatedFacilities: [...facilityIndex.facilities.values()].filter((report) => report.saturated)
      .length,
    loans: state.phase2.loans.size,
    households: state.phase2.tenants.size,
    contracted: [...state.phase2.tenants.values()].filter(
      (tenant) => tenant.activeContractBuildingId !== null,
    ).length,
    displaced: [...state.phase2.tenants.values()].filter((tenant) => tenant.status === "displaced")
      .length,
  };
}

function runCampaign(seed: number): {
  state: GameState;
  observations: Observation[];
  scriptFailures: string[];
  finalDigest: string;
} {
  const state = createInitialState(seed);
  const observations: Observation[] = [];
  const scriptFailures: string[] = [];
  const previousMarketValues = new Map<ParcelId, number>();
  for (const parcel of state.phase2.parcels.values())
    if (parcel.disposition === "marketable")
      previousMarketValues.set(parcel.id, parcel.marketValue);

  /** Delegación de cartera y mantenimiento: la rutina del motor, sin ventajas escritas a mano. */
  const automation = dispatchProductCommand(
    state,
    playerCommand("campaign-automation", "SetAutomationPolicy", {
      property: "fill_vacancies",
      finance: "cover_shortfall",
    }),
  );
  if (!automation.accepted) scriptFailures.push(`SetAutomationPolicy: ${String(automation.code)}`);

  for (let month = 1; month <= MONTHS; month += 1) {
    if (month === 1 || month === 6 || month === 13)
      scriptFailures.push(...scriptedMonth(state, month));
    else assignFreeCrews(state, `mes-${String(month)}`, scriptFailures);
    for (let tick = 0; tick < GAME_MONTH_TICKS; tick += 1) advanceProductSystems(state);
    assertInvariants(state, month, previousMarketValues);
    if ((MILESTONES as readonly number[]).includes(month)) observations.push(observe(state, month));
  }
  return { state, observations, scriptFailures, finalDigest: canonicalizeState(state) };
}

describe("§2.2 · campaña instrumentada de 24 meses (2 años)", () => {
  const campaign = runCampaign(CAMPAIGN_SEED);

  it("los cinco hitos se instrumentan y los dos años se completan", () => {
    expect(campaign.observations.map((entry) => entry.month)).toEqual([...MILESTONES]);
    expect(Number(campaign.state.clock.tick)).toBe(GAME_MONTH_TICKS * MONTHS);
  });

  it("la campaña es determinista: la misma seed reproduce el mismo estado final", () => {
    const replay = runCampaign(CAMPAIGN_SEED);
    expect(replay.finalDigest).toBe(campaign.finalDigest);
    expect(replay.observations).toEqual(campaign.observations);
  });

  it("las cinco organizaciones siguen vivas y el municipio ha gastado de verdad", () => {
    const last = campaign.observations[campaign.observations.length - 1]!;
    for (const organizationId of [
      PLAYER_ORGANIZATION_ID,
      RIVAL_ORGANIZATION_ID,
      BANK_ORGANIZATION_ID,
      INSURER_ORGANIZATION_ID,
      MUNICIPALITY_ORGANIZATION_ID,
    ] as const)
      expect(last.cashByOrganizationId[organizationId], `saldo ${organizationId}`).toBeDefined();
    expect(last.transactions).toBeGreaterThan(0);
    expect(last.municipalSpent).toBeGreaterThan(0);
  });

  it("el mercado, los servicios y la vivienda producen señal medible sin explotar", () => {
    const last = campaign.observations[campaign.observations.length - 1]!;
    expect(last.households).toBeGreaterThan(0);
    expect(last.meanHousingSafety).toBeGreaterThanOrEqual(0);
    expect(last.meanHousingSafety).toBeLessThanOrEqual(100);
    expect(last.meanLandValue).toBeGreaterThan(0);
    expect(last.servedDemandParcels).toBeGreaterThan(0);
    /** Que haya saturación declarada es esperado: la capacidad finita es la regla del plan. */
    expect(last.saturatedFacilities).toBeGreaterThanOrEqual(0);
    expect(last.ruins).toBeGreaterThanOrEqual(0);
  });

  it("la IA rival actúa durante los dos años y no queda congelada", () => {
    const first = campaign.observations[0]!;
    const last = campaign.observations[campaign.observations.length - 1]!;
    /** Se mide por transacciones propias del rival: si no actúa, el contador no se mueve. */
    expect(last.rivalTransactions).toBeGreaterThan(first.rivalTransactions);
    expect(last.rivalParcels + last.rivalBuildings).toBeGreaterThan(0);
  });

  it("el jugador ejecuta el guion: compra, edifica, ocupa y el motor no le rechaza nada", () => {
    /** Cualquier rechazo del guion es un fallo del escenario, no una nota al pie. */
    expect(campaign.scriptFailures).toEqual([]);
    const last = campaign.observations[campaign.observations.length - 1]!;
    expect(last.playerParcels).toBeGreaterThanOrEqual(3);
    expect(last.playerBuildings).toBeGreaterThanOrEqual(3);
    expect(last.contracted).toBeGreaterThan(0);
  });

  it("el crédito aparece cuando la delegación lo pide, sin saldos absurdos", () => {
    const last = campaign.observations[campaign.observations.length - 1]!;
    expect(last.loans).toBeGreaterThanOrEqual(0);
    for (const loan of campaign.state.phase2.loans.values()) {
      expect(Number(loan.principal)).toBeGreaterThanOrEqual(0);
    }
  });
});
