import type {
  AgentSpecialty,
  GridCell,
  ProductionSuitability,
  UrbanRole,
  Zoning,
} from "@landlord/shared";

import type { UrbanFabricConfig } from "./urban-fabric";

/** Versión del algoritmo de generación. Cambiarla invalida los hashes de fixtures. */
export const DISTRICT_GENERATOR_VERSION = 2;

export const DEFAULT_DISTRICT_PROFILE_ID = "barrio_del_umbral";

/** Orden canónico: toda elección ponderada y todo hash recorren los zonings en este orden. */
export const ZONING_ORDER: readonly Zoning[] = ["residential", "mixed", "industrial"];

export type DistrictAnchorSlot = {
  cell: GridCell;
  zoning: Zoning;
  /** Precio autorado: las anclas no dependen de la seed y fijan el suelo de referencia. */
  price: number;
};

export type DistrictSpawnAnchors = {
  player: GridCell;
  rival: GridCell;
};

export type DistrictProfile = {
  id: string;
  name: string;
  width: 64;
  height: 64;
  /** Dominant function of the district; V.d.2 will refine it block by block. */
  dominantRole: UrbanRole;
  /** Road lattice and parcel envelope of the recipe (D-090). */
  fabric: UrbanFabricConfig;
  spawnAnchors: DistrictSpawnAnchors;
  /**
   * Composición fija del perfil. Garantiza que el bucle de juego siempre dispone de suelo
   * residencial, mixto e industrial y que las parcelas de referencia conservan su identidad.
   */
  anchorSlots: readonly DistrictAnchorSlot[];
  expansion: {
    blockCount: readonly [number, number];
    blockColumns: readonly [number, number];
    blockRows: readonly [number, number];
    spacingX: number;
    spacingY: number;
    margin: number;
    zoningWeights: Record<Zoning, number>;
  };
  /** Banda de precio de las parcelas de expansión; las anclas usan su precio autorado. */
  priceBand: Record<Zoning, readonly [number, number]>;
  suitability: Record<Zoning, ProductionSuitability>;
  /** Se aplica sólo a parcelas de expansión: las anclas conservan los valores del perfil. */
  suitabilityJitterPercent: number;
  obstacles: {
    clusters: readonly [number, number];
    cellsPerCluster: readonly [number, number];
  };
  playability: {
    minimumParcels: number;
    minimumParcelsPerZoning: Record<Zoning, number>;
    maximumZoningSharePercent: number;
    maximumCheapestParcelPrice: number;
  };
};

export type RosterSlot = {
  crewIndex: number | null;
  specialty: AgentSpecialty;
  cell: GridCell;
};

/**
 * Celdas que ocupa la plantilla inicial de una organización alrededor de su spawn.
 * El generador las reserva y `createInitialState` las usa, de modo que la topología
 * generada nunca se solapa con los agentes.
 */
export function rosterLayout(anchor: GridCell): RosterSlot[] {
  const slots: RosterSlot[] = [];
  for (let crewIndex = 0; crewIndex < 2; crewIndex += 1) {
    const specialties: readonly AgentSpecialty[] = [
      "supervisor",
      "construction_worker",
      "construction_worker",
    ];
    specialties.forEach((specialty, memberIndex) => {
      slots.push({
        crewIndex,
        specialty,
        cell: { x: anchor.x + crewIndex, y: anchor.y + memberIndex + 1 },
      });
    });
  }
  slots.push(
    {
      crewIndex: null,
      specialty: "maintenance_technician",
      cell: { x: anchor.x, y: anchor.y + 8 },
    },
    { crewIndex: null, specialty: "enforcer", cell: { x: anchor.x, y: anchor.y + 9 } },
  );
  return slots;
}

const CONTINUITY_SUITABILITY: DistrictProfile["suitability"] = {
  residential: { cement: 70, brick: 85, steel: 55 },
  mixed: { cement: 95, brick: 125, steel: 80 },
  industrial: { cement: 120, brick: 100, steel: 135 },
};

/**
 * Fabric envelopes (D-090). A 3-line lattice yields ≈ 23 km/km² of street and 31-cell blocks;
 * a 4-line lattice yields ≈ 31 km/km² and 20-cell blocks. Both sit inside the Fase 0 envelopes of
 * their morphological family; block splitting inside the envelope only adds alleys, never streets.
 */
const FABRIC_URBAN: DistrictProfile["fabric"] = {
  latticeLines: 3,
  connectSpawns: true,
  maxBlockAreaCells: 340,
  maxBlockDepthCells: 15,
  parcelFrontageCells: [2, 4],
  parcelDepthCells: [5, 15],
  parcelAreaCells: [12, 96],
  maxParcelAspectRatio: 8,
};

const FABRIC_DENSE: DistrictProfile["fabric"] = {
  latticeLines: 4,
  connectSpawns: true,
  maxBlockAreaCells: 340,
  maxBlockDepthCells: 10,
  parcelFrontageCells: [2, 4],
  parcelDepthCells: [4, 10],
  parcelAreaCells: [10, 72],
  maxParcelAspectRatio: 6,
};

const FABRIC_MIXED: DistrictProfile["fabric"] = {
  latticeLines: 4,
  connectSpawns: true,
  maxBlockAreaCells: 460,
  maxBlockDepthCells: 10,
  parcelFrontageCells: [2, 5],
  parcelDepthCells: [5, 10],
  parcelAreaCells: [12, 96],
  maxParcelAspectRatio: 6,
};

const FABRIC_CIVIC: DistrictProfile["fabric"] = {
  latticeLines: 4,
  connectSpawns: true,
  maxBlockAreaCells: 360,
  maxBlockDepthCells: 10,
  parcelFrontageCells: [3, 6],
  parcelDepthCells: [5, 10],
  parcelAreaCells: [15, 96],
  maxParcelAspectRatio: 6,
};

const FABRIC_LOW_DENSITY: DistrictProfile["fabric"] = {
  latticeLines: 3,
  connectSpawns: false,
  maxBlockAreaCells: 620,
  maxBlockDepthCells: 15,
  parcelFrontageCells: [2, 4],
  parcelDepthCells: [8, 15],
  parcelAreaCells: [24, 140],
  maxParcelAspectRatio: 8,
};

const FABRIC_INDUSTRIAL: DistrictProfile["fabric"] = {
  latticeLines: 3,
  connectSpawns: true,
  maxBlockAreaCells: 330,
  maxBlockDepthCells: 15,
  parcelFrontageCells: [4, 8],
  parcelDepthCells: [8, 15],
  parcelAreaCells: [32, 220],
  maxParcelAspectRatio: 8,
};

const FABRIC_RAIL: DistrictProfile["fabric"] = {
  latticeLines: 3,
  connectSpawns: true,
  maxBlockAreaCells: 420,
  maxBlockDepthCells: 15,
  parcelFrontageCells: [2, 4],
  parcelDepthCells: [8, 15],
  parcelAreaCells: [24, 160],
  maxParcelAspectRatio: 8,
};

export const DISTRICT_PROFILES: Record<string, DistrictProfile> = {
  barrio_del_umbral: {
    id: "barrio_del_umbral",
    name: "Barrio del Umbral",
    dominantRole: "urban_residential",
    fabric: FABRIC_URBAN,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 4, y: 4 }, rival: { x: 56, y: 4 } },
    anchorSlots: [
      { cell: { x: 7, y: 7 }, zoning: "residential", price: 900 },
      { cell: { x: 9, y: 7 }, zoning: "mixed", price: 1000 },
      { cell: { x: 11, y: 7 }, zoning: "residential", price: 1050 },
      { cell: { x: 13, y: 7 }, zoning: "mixed", price: 1200 },
      { cell: { x: 7, y: 11 }, zoning: "industrial", price: 800 },
      { cell: { x: 9, y: 11 }, zoning: "mixed", price: 950 },
      { cell: { x: 11, y: 11 }, zoning: "industrial", price: 850 },
      { cell: { x: 13, y: 11 }, zoning: "mixed", price: 1100 },
    ],
    expansion: {
      blockCount: [2, 4],
      blockColumns: [2, 3],
      blockRows: [2, 3],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 5, mixed: 3, industrial: 2 },
    },
    priceBand: {
      residential: [900, 1100],
      mixed: [950, 1200],
      industrial: [800, 950],
    },
    suitability: CONTINUITY_SUITABILITY,
    suitabilityJitterPercent: 15,
    // Sin obstáculos: el distrito de continuidad reproduce la topología transitable de Fase 3.
    obstacles: { clusters: [0, 0], cellsPerCluster: [0, 0] },
    playability: {
      minimumParcels: 12,
      minimumParcelsPerZoning: { residential: 3, mixed: 3, industrial: 2 },
      maximumZoningSharePercent: 60,
      maximumCheapestParcelPrice: 1000,
    },
  },
  vega_del_cauce: {
    id: "vega_del_cauce",
    name: "Vega del Cauce",
    dominantRole: "green_open_space",
    fabric: FABRIC_LOW_DENSITY,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 6, y: 6 }, rival: { x: 52, y: 8 } },
    anchorSlots: [
      { cell: { x: 12, y: 12 }, zoning: "residential", price: 780 },
      { cell: { x: 14, y: 12 }, zoning: "mixed", price: 900 },
      { cell: { x: 12, y: 14 }, zoning: "industrial", price: 700 },
      { cell: { x: 14, y: 14 }, zoning: "residential", price: 820 },
    ],
    expansion: {
      blockCount: [3, 6],
      blockColumns: [2, 4],
      blockRows: [2, 3],
      spacingX: 2,
      spacingY: 2,
      margin: 5,
      zoningWeights: { residential: 4, mixed: 4, industrial: 2 },
    },
    priceBand: {
      residential: [700, 950],
      mixed: [820, 1080],
      industrial: [620, 840],
    },
    suitability: {
      residential: { cement: 60, brick: 95, steel: 45 },
      mixed: { cement: 90, brick: 115, steel: 85 },
      industrial: { cement: 110, brick: 130, steel: 95 },
    },
    suitabilityJitterPercent: 20,
    obstacles: { clusters: [2, 4], cellsPerCluster: [4, 9] },
    playability: {
      minimumParcels: 18,
      minimumParcelsPerZoning: { residential: 5, mixed: 5, industrial: 3 },
      maximumZoningSharePercent: 55,
      maximumCheapestParcelPrice: 850,
    },
  },
  ensanche_ferroviario: {
    id: "ensanche_ferroviario",
    name: "Ensanche Ferroviario",
    dominantRole: "commercial_corridor",
    fabric: FABRIC_RAIL,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 8, y: 4 }, rival: { x: 48, y: 4 } },
    anchorSlots: [
      { cell: { x: 16, y: 10 }, zoning: "mixed", price: 1250 },
      { cell: { x: 18, y: 10 }, zoning: "industrial", price: 1000 },
      { cell: { x: 20, y: 10 }, zoning: "industrial", price: 1050 },
      { cell: { x: 16, y: 12 }, zoning: "residential", price: 1100 },
      { cell: { x: 18, y: 12 }, zoning: "mixed", price: 1300 },
      { cell: { x: 20, y: 12 }, zoning: "residential", price: 1150 },
    ],
    expansion: {
      blockCount: [4, 7],
      blockColumns: [2, 3],
      blockRows: [2, 4],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 3, mixed: 3, industrial: 4 },
    },
    priceBand: {
      residential: [1000, 1300],
      mixed: [1150, 1450],
      industrial: [900, 1150],
    },
    suitability: {
      residential: { cement: 80, brick: 75, steel: 60 },
      mixed: { cement: 100, brick: 105, steel: 95 },
      industrial: { cement: 125, brick: 90, steel: 145 },
    },
    suitabilityJitterPercent: 12,
    obstacles: { clusters: [1, 2], cellsPerCluster: [6, 12] },
    playability: {
      minimumParcels: 22,
      minimumParcelsPerZoning: { residential: 4, mixed: 4, industrial: 6 },
      maximumZoningSharePercent: 55,
      maximumCheapestParcelPrice: 1200,
    },
  },
  lomas_del_umbral: {
    id: "lomas_del_umbral",
    name: "Lomas del Umbral",
    dominantRole: "low_density_residential",
    fabric: FABRIC_LOW_DENSITY,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 5, y: 5 }, rival: { x: 54, y: 6 } },
    anchorSlots: [
      { cell: { x: 11, y: 11 }, zoning: "residential", price: 640 },
      { cell: { x: 13, y: 11 }, zoning: "residential", price: 700 },
      { cell: { x: 11, y: 13 }, zoning: "mixed", price: 780 },
      { cell: { x: 13, y: 13 }, zoning: "industrial", price: 620 },
    ],
    expansion: {
      blockCount: [3, 6],
      blockColumns: [2, 3],
      blockRows: [2, 3],
      spacingX: 2,
      spacingY: 2,
      margin: 5,
      zoningWeights: { residential: 6, mixed: 2, industrial: 2 },
    },
    priceBand: {
      residential: [600, 820],
      mixed: [700, 920],
      industrial: [540, 760],
    },
    suitability: {
      residential: { cement: 55, brick: 90, steel: 40 },
      mixed: { cement: 85, brick: 105, steel: 75 },
      industrial: { cement: 105, brick: 120, steel: 120 },
    },
    suitabilityJitterPercent: 18,
    obstacles: { clusters: [2, 4], cellsPerCluster: [4, 8] },
    playability: {
      minimumParcels: 14,
      minimumParcelsPerZoning: { residential: 6, mixed: 2, industrial: 2 },
      maximumZoningSharePercent: 72,
      maximumCheapestParcelPrice: 720,
    },
  },
  mercado_del_norte: {
    id: "mercado_del_norte",
    name: "Mercado del Norte",
    dominantRole: "commercial_corridor",
    fabric: FABRIC_MIXED,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 6, y: 4 }, rival: { x: 52, y: 4 } },
    anchorSlots: [
      { cell: { x: 12, y: 9 }, zoning: "mixed", price: 1180 },
      { cell: { x: 14, y: 9 }, zoning: "mixed", price: 1260 },
      { cell: { x: 16, y: 9 }, zoning: "residential", price: 1040 },
      { cell: { x: 12, y: 11 }, zoning: "industrial", price: 880 },
      { cell: { x: 14, y: 11 }, zoning: "mixed", price: 1120 },
      { cell: { x: 16, y: 11 }, zoning: "residential", price: 980 },
    ],
    expansion: {
      blockCount: [3, 6],
      blockColumns: [2, 4],
      blockRows: [2, 3],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 3, mixed: 5, industrial: 2 },
    },
    priceBand: {
      residential: [900, 1180],
      mixed: [1050, 1380],
      industrial: [820, 1040],
    },
    suitability: {
      residential: { cement: 70, brick: 80, steel: 55 },
      mixed: { cement: 95, brick: 110, steel: 90 },
      industrial: { cement: 110, brick: 100, steel: 125 },
    },
    suitabilityJitterPercent: 14,
    obstacles: { clusters: [1, 2], cellsPerCluster: [4, 8] },
    playability: {
      minimumParcels: 18,
      minimumParcelsPerZoning: { residential: 4, mixed: 6, industrial: 3 },
      maximumZoningSharePercent: 55,
      maximumCheapestParcelPrice: 1050,
    },
  },
  centro_civico: {
    id: "centro_civico",
    name: "Centro Cívico",
    dominantRole: "civic_core",
    fabric: FABRIC_CIVIC,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 4, y: 4 }, rival: { x: 56, y: 4 } },
    anchorSlots: [
      { cell: { x: 9, y: 9 }, zoning: "mixed", price: 1420 },
      { cell: { x: 11, y: 9 }, zoning: "mixed", price: 1500 },
      { cell: { x: 13, y: 9 }, zoning: "residential", price: 1240 },
      { cell: { x: 9, y: 11 }, zoning: "residential", price: 1180 },
      { cell: { x: 11, y: 11 }, zoning: "mixed", price: 1360 },
      { cell: { x: 13, y: 11 }, zoning: "industrial", price: 1020 },
    ],
    expansion: {
      blockCount: [3, 6],
      blockColumns: [2, 4],
      blockRows: [2, 4],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 3, mixed: 5, industrial: 2 },
    },
    priceBand: {
      residential: [1080, 1380],
      mixed: [1200, 1550],
      industrial: [940, 1180],
    },
    suitability: {
      residential: { cement: 85, brick: 70, steel: 65 },
      mixed: { cement: 105, brick: 95, steel: 100 },
      industrial: { cement: 115, brick: 85, steel: 130 },
    },
    suitabilityJitterPercent: 12,
    obstacles: { clusters: [1, 2], cellsPerCluster: [3, 6] },
    playability: {
      minimumParcels: 20,
      minimumParcelsPerZoning: { residential: 4, mixed: 6, industrial: 2 },
      maximumZoningSharePercent: 60,
      maximumCheapestParcelPrice: 1150,
    },
  },
  barrio_del_taller: {
    id: "barrio_del_taller",
    name: "Barrio del Taller",
    dominantRole: "mixed_core",
    fabric: FABRIC_DENSE,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 8, y: 6 }, rival: { x: 50, y: 6 } },
    anchorSlots: [
      { cell: { x: 14, y: 12 }, zoning: "mixed", price: 1020 },
      { cell: { x: 16, y: 12 }, zoning: "industrial", price: 900 },
      { cell: { x: 18, y: 12 }, zoning: "mixed", price: 1080 },
      { cell: { x: 14, y: 14 }, zoning: "residential", price: 860 },
      { cell: { x: 16, y: 14 }, zoning: "industrial", price: 940 },
      { cell: { x: 18, y: 14 }, zoning: "residential", price: 820 },
    ],
    expansion: {
      blockCount: [3, 6],
      blockColumns: [2, 4],
      blockRows: [2, 3],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 3, mixed: 4, industrial: 3 },
    },
    priceBand: {
      residential: [760, 1000],
      mixed: [880, 1160],
      industrial: [780, 1020],
    },
    suitability: {
      residential: { cement: 75, brick: 85, steel: 58 },
      mixed: { cement: 100, brick: 112, steel: 92 },
      industrial: { cement: 118, brick: 96, steel: 132 },
    },
    suitabilityJitterPercent: 16,
    obstacles: { clusters: [2, 3], cellsPerCluster: [4, 9] },
    playability: {
      minimumParcels: 18,
      minimumParcelsPerZoning: { residential: 4, mixed: 5, industrial: 4 },
      maximumZoningSharePercent: 55,
      maximumCheapestParcelPrice: 950,
    },
  },
  ensanche_ferroviario_oeste: {
    id: "ensanche_ferroviario_oeste",
    name: "Ensanche Ferroviario Oeste",
    dominantRole: "industrial_logistics",
    fabric: FABRIC_INDUSTRIAL,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 6, y: 5 }, rival: { x: 52, y: 5 } },
    anchorSlots: [
      { cell: { x: 12, y: 10 }, zoning: "industrial", price: 860 },
      { cell: { x: 14, y: 10 }, zoning: "industrial", price: 920 },
      { cell: { x: 16, y: 10 }, zoning: "mixed", price: 1010 },
      { cell: { x: 12, y: 12 }, zoning: "mixed", price: 960 },
      { cell: { x: 14, y: 12 }, zoning: "industrial", price: 880 },
      { cell: { x: 16, y: 12 }, zoning: "residential", price: 840 },
    ],
    expansion: {
      blockCount: [4, 7],
      blockColumns: [2, 3],
      blockRows: [2, 4],
      spacingX: 2,
      spacingY: 2,
      margin: 4,
      zoningWeights: { residential: 2, mixed: 3, industrial: 5 },
    },
    priceBand: {
      residential: [740, 980],
      mixed: [860, 1120],
      industrial: [760, 1000],
    },
    suitability: {
      residential: { cement: 70, brick: 78, steel: 52 },
      mixed: { cement: 92, brick: 96, steel: 88 },
      industrial: { cement: 122, brick: 88, steel: 140 },
    },
    suitabilityJitterPercent: 14,
    obstacles: { clusters: [2, 4], cellsPerCluster: [6, 14] },
    playability: {
      minimumParcels: 20,
      minimumParcelsPerZoning: { residential: 3, mixed: 4, industrial: 7 },
      maximumZoningSharePercent: 58,
      maximumCheapestParcelPrice: 950,
    },
  },
  patios_del_este: {
    id: "patios_del_este",
    name: "Patios del Este",
    dominantRole: "industrial_logistics",
    fabric: FABRIC_INDUSTRIAL,
    width: 64,
    height: 64,
    spawnAnchors: { player: { x: 8, y: 5 }, rival: { x: 50, y: 7 } },
    anchorSlots: [
      { cell: { x: 15, y: 11 }, zoning: "industrial", price: 780 },
      { cell: { x: 17, y: 11 }, zoning: "industrial", price: 840 },
      { cell: { x: 19, y: 11 }, zoning: "mixed", price: 930 },
      { cell: { x: 15, y: 13 }, zoning: "mixed", price: 900 },
      { cell: { x: 17, y: 13 }, zoning: "industrial", price: 800 },
      { cell: { x: 19, y: 13 }, zoning: "residential", price: 760 },
    ],
    expansion: {
      blockCount: [4, 7],
      blockColumns: [2, 3],
      blockRows: [2, 4],
      spacingX: 2,
      spacingY: 3,
      margin: 5,
      zoningWeights: { residential: 3, mixed: 2, industrial: 5 },
    },
    priceBand: {
      residential: [680, 900],
      mixed: [800, 1040],
      industrial: [700, 920],
    },
    suitability: {
      residential: { cement: 65, brick: 82, steel: 48 },
      mixed: { cement: 88, brick: 94, steel: 82 },
      industrial: { cement: 126, brick: 84, steel: 148 },
    },
    suitabilityJitterPercent: 16,
    obstacles: { clusters: [3, 5], cellsPerCluster: [6, 16] },
    playability: {
      minimumParcels: 18,
      minimumParcelsPerZoning: { residential: 3, mixed: 3, industrial: 6 },
      maximumZoningSharePercent: 60,
      maximumCheapestParcelPrice: 900,
    },
  },
};

export const DISTRICT_PROFILE_IDS: readonly string[] = Object.keys(DISTRICT_PROFILES).sort(
  (left, right) => left.localeCompare(right),
);

export function resolveDistrictProfile(profileId = DEFAULT_DISTRICT_PROFILE_ID): DistrictProfile {
  const profile = DISTRICT_PROFILES[profileId];
  if (!profile) {
    throw new RangeError(
      `Unknown district profile: ${profileId} (disponibles: ${DISTRICT_PROFILE_IDS.join(", ")})`,
    );
  }
  return profile;
}
