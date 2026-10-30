import type { Economy, ProjectedParcel } from "./types";

/**
 * V.d-UX · onboarding progresivo derivado del estado (spec §12). No crea misiones ni guarda nada
 * en `GameState`: en cada momento propone el siguiente paso relevante y desaparece cuando el
 * jugador lo completa. El orden es el del bucle real de la Alpha.
 */
export type OnboardingAction =
  | "show-parcel"
  | "open-build"
  | "buy-materials"
  | "open-construction"
  | "open-finance"
  | "open-government";

export type OnboardingStep = {
  id:
    | "first_parcel"
    | "first_project"
    | "resources"
    | "crew"
    | "construction"
    | "operation"
    | "finance"
    | "government";
  title: string;
  body: string;
  missing: Array<{ resource: "cement" | "brick" | "steel"; amount: number }>;
  actionLabel: string | null;
  action: OnboardingAction | null;
};

const PLAYER = "org_00000001";
const PRODUCTION_TYPES = new Set(["cement_plant", "brickworks", "steelworks"]);

function ownedParcels(economy: Economy): ProjectedParcel[] {
  return economy.parcels.filter((parcel) => parcel.ownerOrganizationId === PLAYER);
}

function cheapestMissing(
  economy: Economy,
  parcel: ProjectedParcel,
): Array<{ resource: "cement" | "brick" | "steel"; amount: number }> {
  const options = economy.constructionOptions
    .filter((option) => !option.municipal && parcel.permittedBuildingTypes.includes(option.type))
    .sort((left, right) => left.cost - right.cost);
  const option = options[0];
  if (!option) return [];
  return (["cement", "brick", "steel"] as const).flatMap((resource) => {
    const amount = option.resources[resource] - economy.inventory[resource];
    return amount > 0 ? [{ resource, amount }] : [];
  });
}

export function deriveOnboardingStep(economy: Economy | undefined): OnboardingStep | null {
  if (!economy) return null;
  const owned = ownedParcels(economy);
  const ownedBuildings = economy.buildings.filter(
    (building) => building.ownerOrganizationId === PLAYER,
  );
  const ownedSites = economy.constructionSites.filter(
    (site) => site.ownerOrganizationId === PLAYER,
  );

  if (owned.length === 0)
    return {
      id: "first_parcel",
      title: "Compra tu primera parcela",
      body: "Selecciona un solar disponible en el mapa y cómpralo para empezar a construir.",
      missing: [],
      actionLabel: "Mostrarme uno",
      action: "show-parcel",
    };

  if (ownedBuildings.length === 0 && ownedSites.length === 0) {
    const emptyParcel = owned.find((parcel) => parcel.buildingIds.length === 0);
    if (emptyParcel) {
      const missing = cheapestMissing(economy, emptyParcel);
      if (missing.length > 0)
        return {
          id: "resources",
          title: "Reúne materiales para tu primer proyecto",
          body: "Compra los materiales que faltan; la obra no puede empezar sin ellos.",
          missing,
          actionLabel: "Comprar materiales",
          action: "buy-materials",
        };
      return {
        id: "first_project",
        title: "Elige qué construir",
        body: "Abre el catálogo del solar y elige un proyecto compatible con su código.",
        missing: [],
        actionLabel: "Abrir catálogo",
        action: "open-build",
      };
    }
  }

  const siteWithoutCrew = ownedSites.find((site) => site.assignedCrewIds.length === 0);
  if (siteWithoutCrew)
    return {
      id: "crew",
      title: "Asigna una cuadrilla",
      body: "La obra avanza cuando una cuadrilla libre trabaja en ella.",
      missing: [],
      actionLabel: "Ver la obra",
      action: "open-construction",
    };

  if (ownedSites.length > 0)
    return {
      id: "construction",
      title: "La obra está en marcha",
      body: "Sigue el progreso y mantén la cuadrilla asignada hasta terminarla.",
      missing: [],
      actionLabel: "Ver la obra",
      action: "open-construction",
    };

  const needsTenants = ownedBuildings.filter(
    (building) => !PRODUCTION_TYPES.has(building.type) && building.tenantIds.length === 0,
  );
  if (needsTenants.length > 0)
    return {
      id: "operation",
      title: "Ocupa tu primer edificio",
      body: "Selecciona el edificio y asigna un inquilino compatible para empezar a cobrar renta.",
      missing: [],
      actionLabel: null,
      action: null,
    };

  if (economy.financials.forecast.shortfall > 0 || economy.taxation.playerArrears > 0)
    return {
      id: "finance",
      title: "Revisa tus finanzas",
      body: "La previsión no cubre el mes. Finanzas reúne préstamos, atrasos y garantías.",
      missing: [],
      actionLabel: "Abrir Finanzas",
      action: "open-finance",
    };

  if (economy.ordinance.status === "proposed" && economy.influence >= 1)
    return {
      id: "government",
      title: "Apoya una ordenanza",
      body: "Tu influencia puede inclinar una propuesta municipal. Está en Gobierno.",
      missing: [],
      actionLabel: "Abrir Gobierno",
      action: "open-government",
    };

  return null;
}
