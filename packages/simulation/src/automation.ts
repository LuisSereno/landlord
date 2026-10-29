import {
  parseCommandId,
  parseMoney,
  parsePersonId,
  type AutomationState,
  type Building,
  type Loan,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  GAME_DAY_TICKS,
  LOAN_POLICY,
  PLAYER_ORGANIZATION_ID,
  REPAIR_COST,
  deteriorationRiskPercent,
} from "./game-data";
import { askingRentFor } from "./housing-market";
import type { GameState } from "./state";

const PLAYER_PERSON_ID = parsePersonId("person_00000001");
const LOAN_TERM_MONTHS = 12;

export const AUTOMATION_POLICY = {
  /** Asignaciones de inquilino que el gestor de propiedad puede hacer por día. */
  propertyAssignmentsPerDay: 3,
  /** El gestor financiero pide préstamo solo si no hay ninguna deuda viva de la organización. */
  financeTermMonths: LOAN_TERM_MONTHS,
  /** Reparaciones que el gestor de mantenimiento puede abrir por día. */
  maintenanceRepairsPerDay: 1,
  exception: {
    maximumEntries: 20,
    conditionWarning: 50,
    conditionCritical: 20,
    insuranceRiskWarning: 35,
  },
} as const;

export function initialAutomationState(): AutomationState {
  return {
    property: "manual",
    finance: "manual",
    maintenanceRepairThreshold: null,
    financeCashFloor: parseMoney(2000),
  };
}

export type AutomationExceptionKind =
  | "loan_delinquent"
  | "tax_arrears"
  | "building_condition"
  | "uninsured_building"
  | "vacant_unit"
  | "crew_unavailable";

export type AutomationException = {
  id: string;
  kind: AutomationExceptionKind;
  severity: 1 | 2 | 3;
  referenceId: string;
  label: string;
};

export type AutomationReport = {
  policies: AutomationState;
  exceptions: AutomationException[];
  /** Excepciones totales antes del tope de la bandeja. */
  routineTaskCount: number;
  /** Desglose completo por tipo, también antes del tope. */
  routineCountByKind: Record<AutomationExceptionKind, number>;
};

function byId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function playerBuildings(state: GameState): Building[] {
  return [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === PLAYER_ORGANIZATION_ID && building.state === "operational",
    )
    .sort(byId);
}

function playerLoans(state: GameState): Loan[] {
  return [...state.phase2.loans.values()]
    .filter((loan) => loan.borrowerOrganizationId === PLAYER_ORGANIZATION_ID)
    .sort(byId);
}

function activeLoanStatus(loan: Loan): boolean {
  return loan.status === "offered" || loan.status === "active" || loan.status === "delinquent";
}

/**
 * Gestor de propiedad: coloca inquilinos disponibles en unidades propias compatibles. Usa
 * `AssignTenant`, así que respeta capacidad, tipo preferido y presupuesto exactamente igual que la
 * jugadora; un rechazo simplemente deja la unidad vacía y no se reintenta en el mismo día.
 */
function runPropertyManager(state: GameState): void {
  const candidates = [...state.phase2.tenants.values()]
    .filter((tenant) => tenant.status === "available" && tenant.activeContractBuildingId === null)
    .sort(byId);
  if (candidates.length === 0) return;
  let assignments = 0;
  for (const building of playerBuildings(state)) {
    if (assignments >= AUTOMATION_POLICY.propertyAssignmentsPerDay) break;
    const capacity = BUILDING_DEFINITIONS[building.type].capacity;
    while (
      building.tenantIds.length < capacity &&
      assignments < AUTOMATION_POLICY.propertyAssignmentsPerDay
    ) {
      const tenant = candidates.find(
        (candidate) =>
          candidate.status === "available" &&
          candidate.activeContractBuildingId === null &&
          candidate.preferredBuildingType === building.type &&
          candidate.marketDistrictId === building.districtId &&
          candidate.budget >= askingRentFor(state, building),
      );
      if (!tenant) break;
      const result = dispatchProductCommand(state, {
        commandId: parseCommandId(
          `auto-${state.clock.tick}-assign-${assignments + 1}-${building.id}`,
        ),
        issuedByPersonId: PLAYER_PERSON_ID,
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type: "AssignTenant",
        payload: { buildingId: building.id, tenantId: tenant.id },
      });
      if (!result.accepted) break;
      assignments += 1;
    }
  }
}

/**
 * Gestor financiero: si la caja cae bajo el suelo configurado, pide un préstamo con una parcela
 * libre como garantía y acepta la oferta resultante. Ambos pasos pasan por el dispatcher, así que
 * las reglas de LTV, deuda máxima, mora y autorización son las mismas que para la jugadora.
 */
function runFinanceManager(state: GameState): void {
  const policy = state.phase2.automation;
  const cash = state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0;
  if (cash >= policy.financeCashFloor) return;
  if (playerLoans(state).some(activeLoanStatus)) return;
  const collateral = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID &&
        !playerLoans(state).some(
          (loan) => loan.collateralParcelId === parcel.id && activeLoanStatus(loan),
        ),
    )
    .sort((left, right) => right.price - left.price || byId(left, right))[0];
  if (!collateral) return;
  const shortfall = policy.financeCashFloor - cash;
  const preferred = Math.min(
    LOAN_POLICY.maximumPrincipal,
    Math.max(LOAN_POLICY.minimumPrincipal, shortfall),
  );
  let requested = false;
  for (const amount of [...new Set([preferred, LOAN_POLICY.minimumPrincipal])]) {
    const result = dispatchProductCommand(state, {
      commandId: parseCommandId(`auto-${state.clock.tick}-loan-${amount}`),
      issuedByPersonId: PLAYER_PERSON_ID,
      actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
      type: "RequestLoan",
      payload: {
        amount: parseMoney(amount),
        termMonths: AUTOMATION_POLICY.financeTermMonths,
        collateralParcelId: collateral.id,
      },
    });
    if (result.accepted) {
      requested = true;
      break;
    }
  }
  if (!requested) return;
  const offer = playerLoans(state)
    .filter((loan) => loan.status === "offered")
    .sort(byId)
    .at(-1);
  if (!offer) return;
  dispatchProductCommand(state, {
    commandId: parseCommandId(`auto-${state.clock.tick}-accept-${offer.id}`),
    issuedByPersonId: PLAYER_PERSON_ID,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type: "AcceptLoanOffer",
    payload: { loanId: offer.id },
  });
}

/**
 * Gestor de mantenimiento: abre una reparación cuando la condición cae bajo el umbral y la caja
 * cubre el coste sin perforar el suelo financiero. La obra se asigna a una cuadrilla libre con
 * `AssignCrewToWorkOrder`; si no hay cuadrilla, la reparación queda en cola como la dejaría la
 * jugadora, sin inventar progreso.
 */
function runMaintenanceManager(state: GameState): void {
  const policy = state.phase2.automation;
  const threshold = policy.maintenanceRepairThreshold;
  if (threshold === null) return;
  const repairInProgress = [...state.phase2.constructionSites.values()].some(
    (site) => site.ownerOrganizationId === PLAYER_ORGANIZATION_ID && site.kind === "repair",
  );
  if (repairInProgress) return;
  const cash = state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0;
  if (cash < REPAIR_COST + policy.financeCashFloor) return;
  const building = playerBuildings(state)
    .filter(
      (candidate) =>
        candidate.condition <= threshold &&
        ![...state.phase2.constructionSites.values()].some(
          (site) => site.repairBuildingId === candidate.id,
        ),
    )
    .sort((left, right) => left.condition - right.condition || byId(left, right))[0];
  if (!building) return;
  const result = dispatchProductCommand(state, {
    commandId: parseCommandId(`auto-${state.clock.tick}-repair-${building.id}`),
    issuedByPersonId: PLAYER_PERSON_ID,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type: "RepairBuilding",
    payload: { buildingId: building.id },
  });
  if (!result.accepted) return;
  const site = [...state.phase2.constructionSites.values()].find(
    (candidate) => candidate.repairBuildingId === building.id,
  );
  if (!site) return;
  const busyCrewIds = new Set(
    [...state.phase2.constructionSites.values()].flatMap((candidate) =>
      candidate.id === site.id ? [] : candidate.assignedCrewIds,
    ),
  );
  const crew = [...state.phase2.crews.values()]
    .filter((candidate) => {
      if (candidate.organizationId !== PLAYER_ORGANIZATION_ID || busyCrewIds.has(candidate.id))
        return false;
      return [candidate.supervisorAgentId, ...candidate.workerAgentIds].every(
        (agentId) => state.agents.get(agentId)?.districtId === building.districtId,
      );
    })
    .sort(byId)[0];
  if (!crew) return;
  dispatchProductCommand(state, {
    commandId: parseCommandId(`auto-${state.clock.tick}-crew-${site.id}`),
    issuedByPersonId: PLAYER_PERSON_ID,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type: "AssignCrewToWorkOrder",
    payload: { crewId: crew.id, workOrderId: site.id },
  });
}

/**
 * Sistema diario de delegación. Sólo actúa sobre la organización del jugador y sólo si la política
 * correspondiente está activada; todos los efectos pasan por los comandos existentes.
 */
export function runAutomation(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_DAY_TICKS !== 0) return;
  const policy = state.phase2.automation;
  if (policy.property === "fill_vacancies") runPropertyManager(state);
  if (policy.finance === "cover_shortfall") runFinanceManager(state);
  if (policy.maintenanceRepairThreshold !== null) runMaintenanceManager(state);
}

/**
 * Bandeja de excepciones priorizada. Se deriva del estado; no se persiste ni decide nada. Severidad
 * 3 = dinero o deuda en riesgo, 2 = activo deteriorándose, 1 = rutina de ocupación.
 */
export function describeAutomation(state: GameState): AutomationReport {
  const exceptions: AutomationException[] = [];
  const routineCountByKind: Record<AutomationExceptionKind, number> = {
    loan_delinquent: 0,
    tax_arrears: 0,
    building_condition: 0,
    uninsured_building: 0,
    vacant_unit: 0,
    crew_unavailable: 0,
  };
  let routineTaskCount = 0;
  const add = (exception: AutomationException) => {
    routineTaskCount += 1;
    routineCountByKind[exception.kind] += 1;
    exceptions.push(exception);
  };

  for (const loan of playerLoans(state)) {
    if (loan.status !== "delinquent" && loan.status !== "defaulted") continue;
    add({
      id: `loan_${loan.id}`,
      kind: "loan_delinquent",
      severity: 3,
      referenceId: loan.id,
      label: `Préstamo ${loan.status === "defaulted" ? "impagado" : "en mora"} (${loan.outstandingPrincipal} u.)`,
    });
  }
  const arrears = state.phase2.taxation.arrearsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? 0;
  if (arrears > 0) {
    add({
      id: "tax_arrears",
      kind: "tax_arrears",
      severity: 3,
      referenceId: PLAYER_ORGANIZATION_ID,
      label: `Impuestos adeudados (${arrears} u.)`,
    });
  }
  for (const building of playerBuildings(state)) {
    if (building.condition <= AUTOMATION_POLICY.exception.conditionCritical) {
      add({
        id: `condition_${building.id}`,
        kind: "building_condition",
        severity: 3,
        referenceId: building.id,
        label: `Edificio al ${building.condition} % de condición`,
      });
    } else if (building.condition <= AUTOMATION_POLICY.exception.conditionWarning) {
      add({
        id: `condition_${building.id}`,
        kind: "building_condition",
        severity: 2,
        referenceId: building.id,
        label: `Edificio al ${building.condition} % de condición`,
      });
    }
    const insurance = state.phase2.insurance.contractsByBuildingId[building.id];
    if (
      (!insurance || insurance.status !== "active") &&
      deteriorationRiskPercent(building.condition) >=
        AUTOMATION_POLICY.exception.insuranceRiskWarning
    ) {
      add({
        id: `insurance_${building.id}`,
        kind: "uninsured_building",
        severity: 2,
        referenceId: building.id,
        label: `Edificio sin seguro con riesgo de deterioro`,
      });
    }
    const vacantSlots = Math.max(
      0,
      BUILDING_DEFINITIONS[building.type].capacity - building.tenantIds.length,
    );
    if (vacantSlots > 0) {
      add({
        id: `vacancy_${building.id}`,
        kind: "vacant_unit",
        severity: 1,
        referenceId: building.id,
        label: `${vacantSlots} plaza(s) vacante(s) en ${building.districtId}`,
      });
    }
    if (
      state.phase2.automation.maintenanceRepairThreshold !== null &&
      building.condition <= state.phase2.automation.maintenanceRepairThreshold
    ) {
      const localCrew = [...state.phase2.crews.values()].some(
        (crew) =>
          crew.organizationId === PLAYER_ORGANIZATION_ID &&
          [crew.supervisorAgentId, ...crew.workerAgentIds].every(
            (agentId) => state.agents.get(agentId)?.districtId === building.districtId,
          ),
      );
      if (!localCrew) {
        add({
          id: `crew_${building.id}`,
          kind: "crew_unavailable",
          severity: 2,
          referenceId: building.id,
          label: `Sin cuadrilla local en ${building.districtId}; no se traslada personal automáticamente.`,
        });
      }
    }
  }

  exceptions.sort(
    (left, right) =>
      right.severity - left.severity ||
      left.kind.localeCompare(right.kind) ||
      left.referenceId.localeCompare(right.referenceId),
  );
  return {
    policies: { ...state.phase2.automation },
    exceptions: exceptions.slice(0, AUTOMATION_POLICY.exception.maximumEntries),
    routineTaskCount,
    routineCountByKind,
  };
}
