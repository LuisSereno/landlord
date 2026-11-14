import type { BuildingType, TenantProfile } from "@landlord/shared";

export type HousingSegment = {
  id: TenantProfile;
  label: string;
  /** Presupuesto mensual de renta con ingresos al 100 %; el mercado lo ajusta al nivel vigente. */
  rentBudget: number;
  preferredBuildingTypes: readonly BuildingType[];
  /** Techo de población del segmento: es lo que impide que la demanda sea infinita. */
  populationCap: number;
  /** Llegadas por mes con atractivo del 100 % y población muy por debajo del techo. */
  arrivalsAtFullAppeal: number;
  weights: { quality: number; accessibility: number; safety: number; services: number };
};

/**
 * Demanda segmentada. Cada segmento aporta una decisión distinta al jugador: el hogar elige por
 * calidad y seguridad, el artesano por cercanía al trabajo y el comerciante por clientela. Los
 * tres comparten presupuesto acotado y techo de población, así que construir no garantiza ocupar.
 *
 * Vive en su propio módulo para que el mercado de vivienda y el de empleo lo compartan sin que uno
 * dependa del otro.
 */
export const HOUSING_SEGMENTS: Record<TenantProfile, HousingSegment> = {
  household: {
    id: "household",
    label: "Hogares",
    rentBudget: 260,
    // Las familias pueden elegir cualquier producto residencial. La preferencia concreta se
    // decide al entrar al mercado según el parque con plazas; no limitarla al primer producto
    // evita que las promociones posteriores queden sin demanda por definición.
    preferredBuildingTypes: ["courtyard_home", "row_house", "apartment_block", "mixed_tenement"],
    populationCap: 24,
    arrivalsAtFullAppeal: 3,
    weights: { quality: 35, accessibility: 15, safety: 30, services: 20 },
  },
  maker: {
    id: "maker",
    label: "Artesanos",
    rentBudget: 360,
    preferredBuildingTypes: ["workshop"],
    populationCap: 16,
    arrivalsAtFullAppeal: 2,
    weights: { quality: 25, accessibility: 35, safety: 25, services: 15 },
  },
  shopkeeper: {
    id: "shopkeeper",
    label: "Comerciantes",
    rentBudget: 380,
    preferredBuildingTypes: ["workshop"],
    populationCap: 12,
    arrivalsAtFullAppeal: 1,
    weights: { quality: 25, accessibility: 30, safety: 20, services: 25 },
  },
};
