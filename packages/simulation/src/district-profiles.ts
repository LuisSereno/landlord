import type { AgentSpecialty, GridCell, ProductionSuitability, Zoning } from "@landlord/shared";

/** Versión del algoritmo de generación. Cambiarla invalida los hashes de fixtures. */
export const DISTRICT_GENERATOR_VERSION = 1;

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

export const DISTRICT_PROFILES: Record<string, DistrictProfile> = {
  barrio_del_umbral: {
    id: "barrio_del_umbral",
    name: "Barrio del Umbral",
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
