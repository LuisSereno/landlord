/**
 * V.h.8 §11/§12: perfiles visuales de distrito y perfiles de contexto de edificio.
 *
 * Reglas de contexto por rol urbano (§11): cada perfil define multiplicadores de densidad por
 * categoría de dressing y un sesgo de vocabulario (props favorecidos/evitados). No es gameplay:
 * sólo modula la presentación determinista. `density` contiene exclusivamente multiplicadores con
 * consumidor runtime; los campos aún no conectados viven en `deferredDensity` para no fingir gate.
 *
 * Perfiles de contexto de edificio (§12): qué vocabulario acompaña a cada BuildingType además de su
 * vehículo contextual (V.h.6). No se bakea dentro del sprite; se aplica como dressing de solar.
 */

export type DistrictVisualRole =
  | "civic_core"
  | "mixed_core"
  | "urban_residential"
  | "low_density_residential"
  | "commercial_corridor"
  | "industrial_logistics"
  | "green_open_space";

export type DistrictVisualProfile = {
  role: DistrictVisualRole;
  /** Multiplicadores de densidad por categoría (1 = base del planificador). */
  density: {
    trees: number;
    bushes: number;
    lighting: number;
    benches: number;
    bins: number;
    vehicles: number;
    pedestrians: number;
    props: number;
  };
  /** Declarados para una capa futura; hoy no afectan al modelo visual ni cuentan como cobertura. */
  deferredDensity: {
    fencing: number;
    gardens: number;
    debris: number;
    signage: number;
  };
  /** Assets favorecidos / evitados al vestir solares y espacios del distrito. */
  favored: readonly string[];
  avoided: readonly string[];
  vacantLot: "weeds" | "gravel" | "debris" | "lawn";
};

const BASE_DENSITY = {
  trees: 1,
  bushes: 1,
  lighting: 1,
  benches: 1,
  bins: 1,
  vehicles: 1,
  pedestrians: 1,
  props: 1,
} as const;

const BASE_DEFERRED_DENSITY = {
  fencing: 1,
  gardens: 1,
  debris: 1,
  signage: 1,
} as const;

export const DISTRICT_VISUAL_PROFILES: Record<DistrictVisualRole, DistrictVisualProfile> = {
  civic_core: {
    role: "civic_core",
    density: {
      ...BASE_DENSITY,
      lighting: 1.4,
      benches: 1.4,
      trees: 1.1,
      pedestrians: 1.4,
      bins: 0.7,
      vehicles: 0.7,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, debris: 0.3 },
    favored: ["prp_planter_urn", "prp_bench", "prp_street_light", "prp_bollard"],
    avoided: ["prp_construction_cone", "prp_construction_barrier", "prp_trash_can"],
    vacantLot: "lawn",
  },
  mixed_core: {
    role: "mixed_core",
    density: {
      ...BASE_DENSITY,
      lighting: 1.2,
      benches: 1.2,
      bins: 1.1,
      pedestrians: 1.2,
      vehicles: 1.1,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY },
    favored: ["prp_bench", "prp_trash_can", "prp_street_light", "prp_tree_oak"],
    avoided: ["prp_construction_barrier"],
    vacantLot: "lawn",
  },
  urban_residential: {
    role: "urban_residential",
    density: {
      ...BASE_DENSITY,
      trees: 1.3,
      bushes: 1.3,
      bins: 1,
      vehicles: 1.1,
      pedestrians: 0.9,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, gardens: 1.3 },
    favored: ["prp_tree_oak", "prp_bush", "prp_trash_can", "prp_bench"],
    avoided: ["prp_construction_barrier"],
    vacantLot: "lawn",
  },
  low_density_residential: {
    role: "low_density_residential",
    density: {
      ...BASE_DENSITY,
      trees: 1.5,
      bushes: 1.4,
      vehicles: 0.9,
      pedestrians: 0.8,
      lighting: 0.9,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, gardens: 1.4 },
    favored: ["prp_tree_oak", "prp_tree_pine", "prp_bush"],
    avoided: ["prp_construction_barrier", "prp_trash_can"],
    vacantLot: "lawn",
  },
  commercial_corridor: {
    role: "commercial_corridor",
    density: {
      ...BASE_DENSITY,
      lighting: 1.3,
      benches: 1.2,
      bins: 1.3,
      vehicles: 1.3,
      pedestrians: 1.2,
      trees: 0.8,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, signage: 1.5 },
    favored: ["prp_bench", "prp_trash_can", "prp_street_light"],
    avoided: ["prp_construction_barrier"],
    vacantLot: "gravel",
  },
  industrial_logistics: {
    role: "industrial_logistics",
    density: {
      ...BASE_DENSITY,
      vehicles: 1.5,
      bins: 1.2,
      benches: 0.3,
      trees: 0.4,
      bushes: 0.4,
      pedestrians: 0.5,
      lighting: 0.9,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, debris: 1.5, fencing: 1.5 },
    favored: ["prp_construction_barrier", "prp_construction_cone", "prp_trash_can"],
    avoided: ["prp_planter_urn", "prp_bench", "prp_tree_oak"],
    vacantLot: "gravel",
  },
  green_open_space: {
    role: "green_open_space",
    density: {
      ...BASE_DENSITY,
      trees: 1.8,
      bushes: 1.6,
      benches: 1.2,
      pedestrians: 1.1,
      vehicles: 0.3,
      lighting: 0.8,
      bins: 0.8,
    },
    deferredDensity: { ...BASE_DEFERRED_DENSITY, debris: 0.4 },
    favored: ["prp_tree_oak", "prp_tree_pine", "prp_bush", "prp_bench"],
    avoided: ["prp_construction_barrier", "prp_construction_cone", "prp_trash_can"],
    vacantLot: "weeds",
  },
};

/** Perfil por defecto cuando el rol del distrito no está en la taxonomía. */
export const FALLBACK_DISTRICT_PROFILE: DistrictVisualProfile = DISTRICT_VISUAL_PROFILES.mixed_core;

export function districtVisualProfileFor(role: string | undefined): DistrictVisualProfile {
  if (role && role in DISTRICT_VISUAL_PROFILES) {
    return DISTRICT_VISUAL_PROFILES[role as DistrictVisualRole];
  }
  return FALLBACK_DISTRICT_PROFILE;
}

/**
 * §12: vocabulario de contexto por BuildingType (props que acompañan al edificio en su solar,
 * además del vehículo contextual de V.h.6). Sólo assets ya horneados en el atlas.
 */
export const BUILDING_CONTEXT_PROFILES: Record<string, readonly string[]> = {
  clinic: ["prp_bollard", "prp_bench"],
  police_station: ["prp_bollard", "prp_street_light"],
  fire_station: ["prp_street_light"],
  market_hall: ["prp_trash_can", "prp_bench"],
  town_hall: ["prp_planter_urn", "prp_bollard"],
  school_block: ["prp_bench", "prp_bush"],
  courtyard_home: ["prp_tree_oak", "prp_bush", "prp_trash_can"],
  row_house: ["prp_tree_oak", "prp_bush", "prp_trash_can"],
  apartment_block: ["prp_bush", "prp_trash_can", "prp_bench"],
  mixed_tenement: ["prp_bush", "prp_trash_can"],
  workshop: ["prp_construction_barrier", "prp_construction_cone"],
  warehouse: ["prp_construction_barrier", "prp_trash_can"],
  cement_plant: ["prp_construction_barrier", "prp_construction_cone"],
  brickworks: ["prp_construction_barrier", "prp_construction_cone"],
  steelworks: ["prp_construction_barrier", "prp_construction_cone"],
};

export function buildingContextProps(buildingType: string | undefined): readonly string[] {
  if (buildingType && buildingType in BUILDING_CONTEXT_PROFILES) {
    return BUILDING_CONTEXT_PROFILES[buildingType] ?? [];
  }
  return [];
}
