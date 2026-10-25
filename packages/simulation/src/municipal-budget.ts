import { parseMoney, parseTick, type Money, type MunicipalBudgetState } from "@landlord/shared";
import { credit, debit } from "./commands";
import { GAME_MONTH_TICKS, MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import type { GameState } from "./state";
import { budgetPriorityFor } from "./municipal-politics";
import { URBAN_SERVICE_POLICY, municipalServiceFee } from "./urban-services";

export type MunicipalBudgetCategory = "administration" | "security" | "transport" | "cleaning";

/**
 * Gasto planificado del municipio. Se paga en orden de prioridad con la caja municipal —el mismo
 * saldo que recibe impuestos—, así que no existe dinero municipal implícito: si no hay caja, la
 * categoría queda sin financiar y su nivel de servicio baja.
 */
export const MUNICIPAL_BUDGET_POLICY = {
  // Orden por defecto: se paga primero lo esencial y la limpieza es lo primero que se recorta.
  // El partido que gobierna el concejo puede sustituirlo (WP4.11); éste es el orden de referencia.
  priority: ["administration", "security", "transport", "cleaning"] as const,
  administrationCost: 10,
} as const;

export function initialMunicipalBudgetState(): MunicipalBudgetState {
  return {
    lastSettlementTick: null,
    revenueThisMonthBySource: {
      propertyTax: parseMoney(0),
      transferTax: parseMoney(0),
      serviceFee: parseMoney(0),
    },
    revenueTotalBySource: {
      propertyTax: parseMoney(0),
      transferTax: parseMoney(0),
      serviceFee: parseMoney(0),
    },
    spentTotalByCategory: {
      administration: parseMoney(0),
      security: parseMoney(0),
      transport: parseMoney(0),
      cleaning: parseMoney(0),
    },
    unfundedTotalByCategory: {
      administration: parseMoney(0),
      security: parseMoney(0),
      transport: parseMoney(0),
      cleaning: parseMoney(0),
    },
    serviceLevelPercentByCategory: {
      administration: 100,
      security: 100,
      transport: 100,
      cleaning: 100,
    },
    deficitMonths: 0,
    surplusMonths: 0,
  };
}

export function plannedMunicipalCosts(state: GameState): Record<MunicipalBudgetCategory, number> {
  let buildings = 0;
  for (const building of state.phase2.buildings.values()) {
    if (building.state !== "ruin") buildings += 1;
  }
  return {
    administration: MUNICIPAL_BUDGET_POLICY.administrationCost,
    security: buildings * URBAN_SERVICE_POLICY.security.costPerBuilding,
    transport: buildings * URBAN_SERVICE_POLICY.transport.costPerBuilding,
    cleaning: buildings * URBAN_SERVICE_POLICY.cleaning.costPerBuilding,
  };
}

export type MunicipalBudgetReport = {
  reserve: Money;
  plannedByCategory: Record<MunicipalBudgetCategory, Money>;
  serviceLevelPercentByCategory: Record<MunicipalBudgetCategory, number>;
  revenueThisMonthBySource: Record<string, Money>;
  revenueTotalBySource: Record<string, Money>;
  serviceFeeDueNextSettlement: Money;
  spentTotalByCategory: Record<string, Money>;
  unfundedTotalByCategory: Record<string, Money>;
  deficitMonths: number;
  surplusMonths: number;
  lastSettlementTick: import("@landlord/shared").Tick | null;
};

export function describeMunicipalBudget(state: GameState): MunicipalBudgetReport {
  const budget = state.phase2.municipal;
  const planned = plannedMunicipalCosts(state);
  return {
    reserve: state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? parseMoney(0),
    plannedByCategory: {
      administration: parseMoney(planned.administration),
      security: parseMoney(planned.security),
      transport: parseMoney(planned.transport),
      cleaning: parseMoney(planned.cleaning),
    },
    serviceLevelPercentByCategory: {
      administration: budget.serviceLevelPercentByCategory.administration ?? 100,
      security: budget.serviceLevelPercentByCategory.security ?? 100,
      transport: budget.serviceLevelPercentByCategory.transport ?? 100,
      cleaning: budget.serviceLevelPercentByCategory.cleaning ?? 100,
    },
    revenueThisMonthBySource: { ...budget.revenueThisMonthBySource },
    /**
     * Lo que la tasa de servicios supondrá en el próximo cierre con el servicio de hoy. Existe porque
     * `runMunicipalBudget` devenga la tasa, la suma al total y vuelve a cero el acumulado dentro de la
     * misma ejecución: `revenueThisMonthBySource.serviceFee`, visto desde fuera, siempre vale 0.
     */
    serviceFeeDueNextSettlement: parseMoney(municipalServiceFee(state)),
    revenueTotalBySource: { ...budget.revenueTotalBySource },
    spentTotalByCategory: { ...budget.spentTotalByCategory },
    unfundedTotalByCategory: { ...budget.unfundedTotalByCategory },
    deficitMonths: budget.deficitMonths,
    surplusMonths: budget.surplusMonths,
    lastSettlementTick: budget.lastSettlementTick,
  };
}

export function municipalServiceLevel(state: GameState, category: MunicipalBudgetCategory): number {
  return state.phase2.municipal.serviceLevelPercentByCategory[category] ?? 100;
}

/**
 * Cierre presupuestario mensual. Se ejecuta al final del tick, cuando ya se han cobrado los
 * impuestos del mes: el municipio paga con su caja real en orden de prioridad y lo que no puede
 * pagar queda registrado como descubierto, con la caída de nivel de servicio correspondiente.
 */
export function runMunicipalBudget(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const budget = state.phase2.municipal;
  const planned = plannedMunicipalCosts(state);
  const fee = municipalServiceFee(state);
  if (
    fee > 0 &&
    credit(
      state,
      MUNICIPALITY_ORGANIZATION_ID,
      parseMoney(fee),
      "service_fee",
      `month-${state.clock.tick}`,
    )
  ) {
    budget.revenueThisMonthBySource.serviceFee = parseMoney(
      (budget.revenueThisMonthBySource.serviceFee ?? 0) + fee,
    );
  }
  let available = state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? 0;
  let unfundedTotal = 0;

  for (const category of budgetPriorityFor(state, MUNICIPAL_BUDGET_POLICY.priority)) {
    const plannedCost = planned[category];
    const paid = Math.min(plannedCost, Math.max(0, available));
    if (
      paid > 0 &&
      debit(state, MUNICIPALITY_ORGANIZATION_ID, parseMoney(paid), "municipal_expense", category)
    ) {
      available -= paid;
    }
    budget.spentTotalByCategory[category] = parseMoney(
      (budget.spentTotalByCategory[category] ?? 0) + paid,
    );
    const unfunded = plannedCost - paid;
    unfundedTotal += unfunded;
    budget.unfundedTotalByCategory[category] = parseMoney(
      (budget.unfundedTotalByCategory[category] ?? 0) + unfunded,
    );
    budget.serviceLevelPercentByCategory[category] =
      plannedCost === 0 ? 100 : Math.round((100 * paid) / plannedCost);
  }

  if (unfundedTotal > 0) budget.deficitMonths += 1;
  else budget.surplusMonths += 1;

  for (const source of ["propertyTax", "transferTax", "serviceFee"] as const) {
    budget.revenueTotalBySource[source] = parseMoney(
      (budget.revenueTotalBySource[source] ?? 0) + (budget.revenueThisMonthBySource[source] ?? 0),
    );
    budget.revenueThisMonthBySource[source] = parseMoney(0);
  }
  budget.lastSettlementTick = parseTick(state.clock.tick);
}
