import type { Economy } from "./types";

/**
 * V.d-UX · razones de bloqueo (spec §16). La elegibilidad la decide el motor: aquí sólo se
 * EXPLICA, con los números que ya vienen en la proyección (inventario, caja, cuadrillas libres,
 * usos permitidos). Ninguna regla se reimplementa: si el motor cambia el umbral, esta capa
 * muestra el número nuevo porque lo lee, no lo calcula.
 */
export type DisabledReason = { code: string; message: string };

type OptionLike = Economy["constructionOptions"][number];

export function missingResourceLines(
  inventory: { cement: number; brick: number; steel: number } | undefined,
  requirements: { cement: number; brick: number; steel: number },
): DisabledReason[] {
  const labels = { cement: "de cemento", brick: "ladrillos", steel: "de acero" } as const;
  if (!inventory)
    return [{ code: "inventory_unknown", message: "Todavía no hay inventario disponible." }];
  return (["cement", "brick", "steel"] as const).flatMap((resource) => {
    const missing = requirements[resource] - inventory[resource];
    if (missing <= 0) return [];
    return [
      {
        code: `missing_${resource}`,
        message: `Te ${missing === 1 ? "falta" : "faltan"} ${missing} ${labels[resource]}.`,
      },
    ];
  });
}

export function constructionBlockedReasons(input: {
  option: OptionLike;
  economy: Economy;
  parcelOwned: boolean;
  hasBuilding: boolean;
  permitted: boolean;
}): DisabledReason[] {
  const reasons: DisabledReason[] = [];
  if (!input.parcelOwned)
    reasons.push({
      code: "not_owned",
      message: "Necesitas comprar la parcela antes de construir.",
    });
  if (!input.permitted)
    reasons.push({
      code: "use_not_permitted",
      message: "La parcela no permite este uso con el código urbanístico vigente.",
    });
  if (input.hasBuilding)
    reasons.push({
      code: "parcel_busy",
      message: "La parcela ya tiene un edificio: mejora o vende antes de levantar otro.",
    });
  reasons.push(...missingResourceLines(input.economy.inventory, input.option.resources));
  if (input.economy.cash < input.option.cost)
    reasons.push({
      code: "not_enough_cash",
      message: `Te faltan ${input.option.cost - input.economy.cash} u. para pagar la obra.`,
    });
  const freeCrews = input.economy.crews.filter((crew) => !crew.assignedWorkOrderId).length;
  if (freeCrews === 0)
    reasons.push({ code: "no_free_crew", message: "No tienes una cuadrilla libre." });
  return reasons;
}

export function upgradeBlockedReasons(input: {
  economy: Economy;
  option: OptionLike;
  alreadyUpgraded: boolean;
}): DisabledReason[] {
  if (input.alreadyUpgraded)
    return [{ code: "already_upgraded", message: "Este edificio ya está mejorado." }];
  const reasons = missingResourceLines(input.economy.inventory, input.option.upgradeResources);
  if (input.economy.cash < input.option.upgradeCost)
    reasons.push({
      code: "not_enough_cash",
      message: `Te faltan ${input.option.upgradeCost - input.economy.cash} u. para la mejora.`,
    });
  if (input.economy.crew.used >= input.economy.crew.capacity)
    reasons.push({ code: "crew_busy", message: "No hay capacidad de cuadrilla disponible." });
  return reasons;
}

export function repairBlockedReasons(input: {
  economy: Economy;
  condition: number;
}): DisabledReason[] {
  const reasons: DisabledReason[] = [];
  if (input.condition >= 100)
    reasons.push({ code: "like_new", message: "El edificio está en perfecto estado." });
  if (input.economy.crew.used >= input.economy.crew.capacity)
    reasons.push({ code: "crew_busy", message: "No hay capacidad de cuadrilla disponible." });
  if (input.economy.cash < input.economy.maintenance.repairCost)
    reasons.push({
      code: "not_enough_cash",
      message: `Te faltan ${input.economy.maintenance.repairCost - input.economy.cash} u. para la reparación.`,
    });
  return reasons;
}

export function tenantBlockedReason(budget: number, rent: number): DisabledReason | null {
  if (budget >= rent) return null;
  return {
    code: "tenant_budget",
    message: `Este hogar no puede pagar la renta: presupuesto ${budget} u. frente a ${rent} u.`,
  };
}

export function reasonSummary(reasons: readonly DisabledReason[]): string {
  return reasons.map((reason) => reason.message).join(" · ");
}
