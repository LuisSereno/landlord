import type { DevelopmentAvailabilityRejection } from "@landlord/shared";

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
      message:
        input.option.type === "headquarters"
          ? "La sede necesita un solar mixto cuyo código permita oficinas."
          : "La parcela no permite este uso con el código urbanístico vigente.",
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

const AVAILABILITY_MESSAGES: Record<DevelopmentAvailabilityRejection, string> = {
  NO_BUILDABLE_ENVELOPE:
    "El conjunto de solares no deja ninguna huella legal que ocupe todas las parcelas requeridas.",
  COVERAGE_LIMIT: "La huella supera la cobertura máxima del código urbanístico.",
  FAR_LIMIT: "La edificabilidad supera el FAR máximo del código urbanístico.",
  DUPLICATE_PARCELS: "El proyecto no puede repetir una misma parcela.",
  WRONG_PARCEL_COUNT: "El proyecto necesita exactamente el número de parcelas indicado.",
  PARCEL_NOT_FOUND: "El solar seleccionado ya no está disponible.",
  PARCELS_DIFFERENT_DISTRICT: "Todas las parcelas del proyecto deben estar en el mismo distrito.",
  MIXED_DEVELOPMENT_CODES:
    "Aunque sean de la misma familia, los solares deben tener exactamente el mismo código urbanístico.",
  USE_NOT_ALLOWED: "El código urbanístico no permite este uso en el solar ancla.",
  ACTIVE_SITE_ON_PARCEL: "El solar ancla ya tiene una obra activa.",
  PARCEL_OCCUPIED: "El solar ancla ya está ocupado por un edificio o una ruina.",
  PARCELS_NOT_EDGE_CONTIGUOUS:
    "Los solares deben compartir un borde; una calle o un contacto en esquina no valen.",
  SITE_AREA_TOO_SMALL: "La superficie combinada es insuficiente para este proyecto.",
  PUBLIC_LAND_NOT_BUILDABLE: "La empresa no puede construir sobre suelo municipal.",
  ACTOR_NOT_AUTHORIZED: "Necesitas ser propietario del solar ancla.",
  NO_COMPATIBLE_SITE:
    "No hay ningún solar propio o comprable que complete un proyecto legal contiguo.",
  BUILDING_CAPACITY_FULL: "Tu organización ya tiene una sede operativa o en obra.",
  INVALID_AGENT_ACTION:
    "No hay un acceso peatonal válido desde el local provisional hasta la sede.",
};

export function developmentAvailabilityReason(
  rejection: DevelopmentAvailabilityRejection,
): DisabledReason {
  return { code: "no_legal_site", message: AVAILABILITY_MESSAGES[rejection] };
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
