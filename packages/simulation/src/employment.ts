import { parseMoney, parseTick, type BuildingType, type Tenant } from "@landlord/shared";
import { GAME_MONTH_TICKS } from "./game-data";
import { HOUSING_SEGMENTS } from "./housing-segments";
import { activeMacroModifiers } from "./macro-events";
import type { GameState } from "./state";

export type EmploymentSector = "materials" | "commerce";

export const SECTOR_BY_BUILDING_TYPE: Record<BuildingType, EmploymentSector | null> = {
  courtyard_home: null,
  workshop: "commerce",
  cement_plant: "materials",
  brickworks: "materials",
  steelworks: "materials",
};

/**
 * Puestos por edificio. Sólo las plantas productivas contratan mano de obra: los talleres los
 * ocupa un artesano o un comerciante autónomo, cuyo ingreso sigue el nivel salarial local pero no
 * consume un puesto. Modelo agregado: no hay asignación individuo-puesto.
 */
export const JOBS_BY_BUILDING_TYPE: Record<BuildingType, number> = {
  courtyard_home: 0,
  workshop: 0,
  cement_plant: 4,
  brickworks: 4,
  steelworks: 4,
};

export const EMPLOYMENT_POLICY = {
  /** Índice salarial: 100 es el salario base; la banda evita espirales. */
  initialSalaryIndexPercent: 100,
  minimumSalaryIndexPercent: 90,
  maximumSalaryIndexPercent: 120,
  maximumSalaryStepPercent: 3,
  /** Sensibilidad del salario a la tensión del mercado laboral (puestos por trabajador). */
  salaryPressurePerRatio: 6,
  /** Un hogar sin empleo no se queda a cero: la economía informal cubre parte de su renta. */
  unemploymentSupportPercent: 85,
  minimumIncomeIndexPercent: 60,
  maximumIncomeIndexPercent: 130,
} as const;

export type LaborMarket = {
  jobs: number;
  jobsBySector: Record<EmploymentSector, number>;
  workers: number;
  employedWorkers: number;
  unemployedWorkers: number;
  employmentRatePercent: number;
};

export function initialEmploymentState(): import("@landlord/shared").EmploymentState {
  return {
    salaryIndexPercent: EMPLOYMENT_POLICY.initialSalaryIndexPercent,
    lastSettlementTick: null,
  };
}

export type EmploymentReport = LaborMarket & {
  salaryIndexPercent: number;
  incomeIndexPercentBySegment: Record<string, number>;
  lastSettlementTick: import("@landlord/shared").Tick | null;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function segmentOf(tenant: Tenant): string {
  return tenant.segmentId in HOUSING_SEGMENTS ? tenant.segmentId : tenant.profile;
}

/** Trabajadores y puestos del distrito, en una pasada y sin asignación individual. */
export function describeLaborMarket(state: GameState): LaborMarket {
  const jobsBySector: Record<EmploymentSector, number> = { materials: 0, commerce: 0 };
  let jobs = 0;
  for (const building of state.phase2.buildings.values()) {
    if (building.state !== "operational") continue;
    const sector = SECTOR_BY_BUILDING_TYPE[building.type];
    const perBuilding = JOBS_BY_BUILDING_TYPE[building.type];
    if (!sector || perBuilding === 0) continue;
    jobs += perBuilding;
    jobsBySector[sector] += perBuilding;
  }
  let workers = 0;
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status !== "contracted") continue;
    if (segmentOf(tenant) !== "household") continue;
    workers += 1;
  }
  const employedWorkers = Math.min(jobs, workers);
  return {
    jobs,
    jobsBySector,
    workers,
    employedWorkers,
    unemployedWorkers: workers - employedWorkers,
    employmentRatePercent: workers === 0 ? 100 : Math.round((100 * employedWorkers) / workers),
  };
}

/**
 * Índice de ingresos por segmento. Los hogares dependen del empleo asalariado; artesanos y
 * comerciantes son autónomos y su ingreso sigue el nivel salarial local sin contar paro.
 */
export function incomeIndexPercentBySegment(state: GameState): Record<string, number> {
  const labor = describeLaborMarket(state);
  const salary = state.phase2.employment.salaryIndexPercent;
  const utilisation =
    labor.workers === 0
      ? 1
      : (labor.employedWorkers +
          (labor.unemployedWorkers * EMPLOYMENT_POLICY.unemploymentSupportPercent) / 100) /
        labor.workers;
  const household = clamp(
    Math.round(salary * utilisation),
    EMPLOYMENT_POLICY.minimumIncomeIndexPercent,
    EMPLOYMENT_POLICY.maximumIncomeIndexPercent,
  );
  return {
    household,
    maker: salary,
    shopkeeper: salary,
  };
}

export function incomeIndexFor(state: GameState, segmentId: string): number {
  return incomeIndexPercentBySegment(state)[segmentId] ?? 100;
}

export function describeEmployment(state: GameState): EmploymentReport {
  return {
    ...describeLaborMarket(state),
    salaryIndexPercent: state.phase2.employment.salaryIndexPercent,
    incomeIndexPercentBySegment: incomeIndexPercentBySegment(state),
    lastSettlementTick: state.phase2.employment.lastSettlementTick,
  };
}

/**
 * Cierre mensual del mercado laboral. Ajusta el salario con la tensión observada y propaga el
 * nuevo nivel de ingresos al presupuesto de renta de los hogares que generó el mercado; los
 * hogares autorados conservan su presupuesto de escenario.
 */
export function runEmployment(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const employment = state.phase2.employment;
  const labor = describeLaborMarket(state);
  const ratio = labor.workers === 0 ? (labor.jobs > 0 ? 2 : 1) : labor.jobs / labor.workers;
  const step = clamp(
    Math.round((ratio - 1) * EMPLOYMENT_POLICY.salaryPressurePerRatio),
    -EMPLOYMENT_POLICY.maximumSalaryStepPercent,
    EMPLOYMENT_POLICY.maximumSalaryStepPercent,
  );
  /**
   * La escasez de mano de obra empuja el salario aunque el mercado esté equilibrado: el modifier es
   * presión mensual sobre el índice a escala 1/10 (+20 % de coste laboral = +2 puntos de índice).
   * Es un empuje distinto del ajuste por tensión, así que no se recorta con el paso máximo.
   */
  const shockDrift = Math.round((activeMacroModifiers(state).laborCostModifierPercent ?? 0) / 10);
  employment.salaryIndexPercent = clamp(
    employment.salaryIndexPercent + step + shockDrift,
    EMPLOYMENT_POLICY.minimumSalaryIndexPercent,
    EMPLOYMENT_POLICY.maximumSalaryIndexPercent,
  );
  employment.lastSettlementTick = parseTick(state.clock.tick);

  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.origin !== "market" || tenant.status === "displaced") continue;
    const segment = HOUSING_SEGMENTS[segmentOf(tenant) as keyof typeof HOUSING_SEGMENTS];
    if (!segment) continue;
    tenant.budget = parseMoney(
      Math.round((effectiveRentBudget(state, segment) * tenant.incomeFactorPercent) / 100),
    );
  }
}

/** Presupuesto de renta efectivo del segmento: la base ajustada por el ingreso vigente. */
export function effectiveRentBudget(
  state: GameState,
  segment: { id: string; rentBudget: number },
): number {
  return Math.round((segment.rentBudget * incomeIndexFor(state, segment.id)) / 100);
}
