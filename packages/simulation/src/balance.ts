import type { BuildingType, OrganizationId } from "@landlord/shared";
import {
  BUILDING_DEFINITIONS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import type { GameState } from "./state";

/**
 * Lectura de balance para las herramientas internas de WP4.14. No decide nada ni entra en la
 * proyección: mide quiebras, vacancia, concentración, movilidad, deuda y presupuesto para comparar
 * campañas con las mismas seeds.
 */
export type OrganizationBalance = {
  organizationId: string;
  cash: number;
  parcels: number;
  buildings: number;
  debt: number;
  defaultedLoans: number;
};

export type BalanceMetrics = {
  tick: number;
  bankruptcies: {
    defaultedLoans: number;
    organizationsWithDefault: number;
    openAuctions: number;
  };
  vacancy: {
    slots: number;
    vacantSlots: number;
    percent: number;
    arrivalsTotal: number;
    departuresTotal: number;
    mobilityTotal: number;
  };
  concentration: {
    parcelsByOrganization: Record<string, number>;
    topParcelSharePercent: number;
    parcelHhi: number;
    buildingHhi: number;
  };
  debt: {
    outstandingPrincipal: number;
    taxArrears: number;
  };
  budget: {
    municipalReserve: number;
    deficitMonths: number;
    revenueTotal: number;
    spentTotal: number;
    serviceLevelPercentByCategory: Record<string, number>;
  };
  organizations: OrganizationBalance[];
};

function capacityOf(type: BuildingType): number {
  return BUILDING_DEFINITIONS[type].capacity;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hhi(counts: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const count of counts.values()) total += count;
  if (total === 0) return 0;
  let sum = 0;
  for (const count of counts.values()) {
    const share = count / total;
    sum += share * share;
  }
  return round2(sum * 10_000);
}

export function measureBalance(state: GameState): BalanceMetrics {
  const organizations = new Map<string, OrganizationBalance>();
  const ensure = (organizationId: string): OrganizationBalance => {
    const existing = organizations.get(organizationId);
    if (existing) return existing;
    const created: OrganizationBalance = {
      organizationId,
      cash: state.phase2.balances.get(organizationId as OrganizationId) ?? 0,
      parcels: 0,
      buildings: 0,
      debt: 0,
      defaultedLoans: 0,
    };
    organizations.set(organizationId, created);
    return created;
  };
  for (const organizationId of state.phase2.balances.keys()) ensure(organizationId);

  const parcelsByOrganization = new Map<string, number>();
  for (const parcel of state.phase2.parcels.values()) {
    const owner = parcel.ownerOrganizationId;
    if (!owner) continue;
    ensure(owner).parcels += 1;
    parcelsByOrganization.set(owner, (parcelsByOrganization.get(owner) ?? 0) + 1);
  }
  const buildingsByOrganization = new Map<string, number>();
  for (const building of state.phase2.buildings.values()) {
    const owner = building.ownerOrganizationId;
    ensure(owner).buildings += 1;
    buildingsByOrganization.set(owner, (buildingsByOrganization.get(owner) ?? 0) + 1);
  }

  let slots = 0;
  let vacantSlots = 0;
  for (const building of state.phase2.buildings.values()) {
    if (building.state !== "operational") continue;
    const capacity = capacityOf(building.type);
    slots += capacity;
    vacantSlots += Math.max(0, capacity - building.tenantIds.length);
  }

  let outstandingPrincipal = 0;
  let defaultedLoans = 0;
  const organizationsWithDefault = new Set<string>();
  for (const loan of state.phase2.loans.values()) {
    if (loan.status === "active" || loan.status === "delinquent") {
      outstandingPrincipal += loan.outstandingPrincipal;
      ensure(loan.borrowerOrganizationId).debt += loan.outstandingPrincipal;
    }
    if (loan.status === "defaulted") {
      defaultedLoans += 1;
      organizationsWithDefault.add(loan.borrowerOrganizationId);
      ensure(loan.borrowerOrganizationId).defaultedLoans += 1;
    }
  }

  let taxArrears = 0;
  for (const amount of Object.values(state.phase2.taxation.arrearsByOrganizationId)) {
    taxArrears += amount;
  }

  const municipal = state.phase2.municipal;
  const revenueTotal = Object.values(municipal.revenueTotalBySource).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  );
  const spentTotal = Object.values(municipal.spentTotalByCategory).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  );

  const totalParcels = [...parcelsByOrganization.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const topParcelSharePercent =
    totalParcels === 0
      ? 0
      : round2((100 * Math.max(0, ...parcelsByOrganization.values())) / totalParcels);

  return {
    tick: state.clock.tick,
    bankruptcies: {
      defaultedLoans,
      organizationsWithDefault: organizationsWithDefault.size,
      openAuctions: Object.values(state.phase2.insolvency.auctionsByLoanId).filter(
        (auction) => auction.status === "open",
      ).length,
    },
    vacancy: {
      slots,
      vacantSlots,
      percent: slots === 0 ? 0 : round2((100 * vacantSlots) / slots),
      arrivalsTotal: state.phase2.housingMarket.arrivalsTotal,
      departuresTotal: state.phase2.housingMarket.departuresTotal,
      mobilityTotal:
        state.phase2.housingMarket.arrivalsTotal + state.phase2.housingMarket.departuresTotal,
    },
    concentration: {
      parcelsByOrganization: Object.fromEntries(
        [...parcelsByOrganization.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
      topParcelSharePercent,
      parcelHhi: hhi(parcelsByOrganization),
      buildingHhi: hhi(buildingsByOrganization),
    },
    debt: { outstandingPrincipal, taxArrears },
    budget: {
      municipalReserve: state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? 0,
      deficitMonths: municipal.deficitMonths,
      revenueTotal,
      spentTotal,
      serviceLevelPercentByCategory: { ...municipal.serviceLevelPercentByCategory },
    },
    organizations: [...organizations.values()].sort((left, right) =>
      left.organizationId.localeCompare(right.organizationId),
    ),
  };
}

/**
 * Invariantes que la simulación nunca debe romper. Devuelve una lista de violaciones legibles; una
 * lista vacía significa que el estado es coherente. Se usa en la campaña y en los tests, no en el tick.
 */
export function detectInvariantViolations(state: GameState): string[] {
  const violations: string[] = [];
  for (const [organizationId, balance] of state.phase2.balances) {
    if (!Number.isFinite(balance) || balance < 0) {
      violations.push(`balance_negative:${organizationId}:${balance}`);
    }
  }
  for (const [organizationId, inventory] of state.phase2.inventories) {
    for (const resource of ["cement", "brick", "steel"] as const) {
      const amount = inventory[resource];
      if (!Number.isFinite(amount) || amount < 0) {
        violations.push(`inventory_negative:${organizationId}:${resource}:${amount}`);
      }
    }
    if (inventory.cement + inventory.brick + inventory.steel > inventory.capacity) {
      violations.push(`inventory_over_capacity:${organizationId}`);
    }
  }
  for (const building of state.phase2.buildings.values()) {
    const capacity = capacityOf(building.type);
    if (building.tenantIds.length > capacity) {
      violations.push(`building_over_capacity:${building.id}`);
    }
    for (const tenantId of building.tenantIds) {
      const tenant = state.phase2.tenants.get(tenantId);
      if (!tenant) {
        violations.push(`tenant_missing:${building.id}:${tenantId}`);
        continue;
      }
      if (tenant.activeContractBuildingId !== building.id) {
        violations.push(`tenant_contract_mismatch:${building.id}:${tenantId}`);
      }
    }
    const parcel = state.phase2.parcels.get(building.parcelId);
    if (!parcel) violations.push(`building_parcel_missing:${building.id}`);
    else if (parcel.buildingId !== building.id)
      violations.push(`building_parcel_mismatch:${building.id}`);
  }
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status !== "contracted" || !tenant.activeContractBuildingId) continue;
    const building = state.phase2.buildings.get(tenant.activeContractBuildingId);
    if (!building || !building.tenantIds.includes(tenant.id)) {
      violations.push(`tenant_orphan:${tenant.id}`);
    }
  }
  for (const parcel of state.phase2.parcels.values()) {
    if (!parcel.buildingId) continue;
    const building = state.phase2.buildings.get(parcel.buildingId);
    if (!building) violations.push(`parcel_building_missing:${parcel.id}`);
    else if (building.parcelId !== parcel.id)
      violations.push(`parcel_building_mismatch:${parcel.id}`);
  }
  for (const loan of state.phase2.loans.values()) {
    if (
      !Number.isFinite(loan.outstandingPrincipal) ||
      loan.outstandingPrincipal < 0 ||
      loan.outstandingPrincipal > loan.principal
    ) {
      violations.push(`loan_principal_invalid:${loan.id}`);
    }
    if (loan.remainingMonths < 0) violations.push(`loan_remaining_invalid:${loan.id}`);
  }
  const automation = state.phase2.automation;
  if (
    automation.maintenanceRepairThreshold !== null &&
    (automation.maintenanceRepairThreshold < 0 || automation.maintenanceRepairThreshold > 100)
  ) {
    violations.push(`automation_threshold_invalid:${automation.maintenanceRepairThreshold}`);
  }
  if (automation.financeCashFloor < 0) violations.push(`automation_floor_invalid`);
  for (const event of state.phase2.macroEvents.events) {
    if (event.endTick <= event.startTick) violations.push(`macro_event_interval:${event.id}`);
    if (event.intensity < 0 || event.intensity > 1)
      violations.push(`macro_event_intensity:${event.id}`);
  }
  for (const [category, level] of Object.entries(
    state.phase2.municipal.serviceLevelPercentByCategory,
  )) {
    if (!Number.isFinite(level) || level < 0 || level > 100) {
      violations.push(`service_level_invalid:${category}:${level}`);
    }
  }
  return violations;
}

/** Utilidad de las herramientas: efectivo total de una organización concreta. */
export function organizationCash(state: GameState, organizationId: OrganizationId): number {
  return state.phase2.balances.get(organizationId) ?? 0;
}

export function playerCash(state: GameState): number {
  return organizationCash(state, PLAYER_ORGANIZATION_ID);
}
