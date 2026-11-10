import type { UrbanRole } from "@landlord/shared";

/**
 * Doce seeds canónicas de **ciudad** completa (nueve distritos), distintas de las doce instantáneas
 * de distrito de `district-fixtures.ts`. Son el conjunto estable sobre el que se validan
 * invariantes, programa municipal, conectividad y determinismo antes de cerrar V.d.
 *
 * `digest` es el hash FNV-1a de 16 hex del estado canónico recién generado por esa seed: cambia si
 * cambia la geometría, el programa municipal o cualquier regla autoritativa de generación, y se
 * regenera de forma deliberada cuando un fix lo justifica (nunca para hacer pasar un test).
 */
export type CitySeedFixture = {
  seed: number;
  digest: string;
  districtCount: number;
  blockCount: number;
  parcelCount: number;
  marketableParcelCount: number;
  publicParcelCount: number;
  facilityCount: number;
  publicSpaceCount: number;
  municipalBuildingCount: number;
  gatewayCount: number;
  connectionCount: number;
  /** Manzanas por rol urbano (no parcelas): es la composición que ve el generador de roles. */
  blockRoleCounts: Record<UrbanRole, number>;
};

/** Semillas explícitas y ordenadas: no un barrido implícito `1..12`. */
export const CANONICAL_CITY_SEEDS: readonly number[] = [
  1, 2, 3, 5, 7, 11, 13, 17, 23, 42, 1337, 2026,
];

/** Envolvente medida de parcelas por ciudad: sirve de alarma temprana contra derrames del generador. */
export const CITY_PARCEL_COUNT_ENVELOPE = { min: 700, max: 760 } as const;

/**
 * Regeneración V.l.5c (2026-11-10): cartera visual opción 3. `barrio_del_umbral` usa el eje,
 * `vega_del_cauce`, `mercado_del_norte` y `patios_del_este` usan `ave3`, y
 * `ensanche_ferroviario_oeste` conserva la sección completa. La envolvente medida permanece en
 * 700–760 parcelas; estos valores son la baseline autoritativa de la cartera adoptada.
 */
export const CITY_SEED_FIXTURES: readonly CitySeedFixture[] = [
  {
    seed: 1,
    digest: "a12be6d30efc2dd1",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 708,
    marketableParcelCount: 694,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 2,
    digest: "319add2a206fbfa4",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 725,
    marketableParcelCount: 711,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 3,
    digest: "9c2d901dd6b61c14",
    districtCount: 9,
    blockCount: 117,
    parcelCount: 702,
    marketableParcelCount: 688,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 8,
      commercial_corridor: 24,
      urban_residential: 28,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 5,
    digest: "cbf73c6b3f05b7bc",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 710,
    marketableParcelCount: 696,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 8,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 7,
    digest: "81ee48ea2e42a408",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 715,
    marketableParcelCount: 701,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 11,
    digest: "c2382e0858757bf2",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 705,
    marketableParcelCount: 691,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 13,
    digest: "f487a862b4fe8ead",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 721,
    marketableParcelCount: 707,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 17,
    digest: "08d38229b6a4c9bd",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 707,
    marketableParcelCount: 693,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 8,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 23,
    digest: "3a4575356b6fa470",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 720,
    marketableParcelCount: 706,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 8,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 42,
    digest: "b0bc322151eb3f94",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 716,
    marketableParcelCount: 702,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 1337,
    digest: "3adc2ad330da9c77",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 720,
    marketableParcelCount: 706,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 9,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 5,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 2026,
    digest: "8bed0d08ee6776ce",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 724,
    marketableParcelCount: 710,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 8,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
];
