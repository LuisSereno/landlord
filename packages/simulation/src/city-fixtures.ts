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
/** Regeneración D-109 (2026-11-18): envolvente medida con generador v4 (687–730 parcelas). */
export const CITY_PARCEL_COUNT_ENVELOPE = { min: 687, max: 730 } as const;

/**
 * Regeneración V.l.5c (2026-11-10): cartera visual opción 3. `barrio_del_umbral` usa el eje,
 * `vega_del_cauce`, `mercado_del_norte` y `patios_del_este` usan `ave3`, y
 * `ensanche_ferroviario_oeste` conserva la sección completa. La envolvente medida permanece en
 * 700–760 parcelas; estos valores son la baseline autoritativa de la cartera adoptada.
 *
 * Regeneración D-106 (2026-11-12), sólo seed 2026: la oferta de suelo accionable fusiona o
 * reclasifica residuos de mercado; en esta seed la validación de mínimos recompone la geometría
 * (+1 manzana industrial) y la ciudad queda en 718 parcelas (703 marketables / 15 públicas),
 * dentro de la envolvente 700–760 sin tocarla. Las otras once seeds no cambian: su suelo ya era
 * accionable. Control: programme municipal 14/7/14 intacto en las doce.
 */
/**
 * Regeneración D-109 (2026-11-18): generador v4 con solar/huella separados y numeración pública
 * corregida. El suelo público incluye los residuos D-106 reclasificados (14–16 parcelas públicas
 * por ciudad, no sólo las 14 de equipamientos); el programa municipal 14/7/14 permanece intacto.
 * Digestos medidos sobre el estado canónico recién generado, nunca ajustados para hacer pasar un test.
 */
export const CITY_SEED_FIXTURES: readonly CitySeedFixture[] = [
  {
    seed: 1,
    digest: "1a4ef82c32a65f9a",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 713,
    marketableParcelCount: 698,
    publicParcelCount: 15,
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
    digest: "5f780b710179c67d",
    districtCount: 9,
    blockCount: 119,
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
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 3,
    digest: "0143c51b7f983951",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 714,
    marketableParcelCount: 700,
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
    seed: 5,
    digest: "f21858d240df90b9",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 722,
    marketableParcelCount: 707,
    publicParcelCount: 15,
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
    seed: 7,
    digest: "7ab334205af6b2d2",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 721,
    marketableParcelCount: 705,
    publicParcelCount: 16,
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
    digest: "eb1698e33f139d9c",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 730,
    marketableParcelCount: 715,
    publicParcelCount: 15,
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
    digest: "27786044c52eb1c7",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 701,
    marketableParcelCount: 687,
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
    digest: "85f87cf3247255ba",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 694,
    marketableParcelCount: 679,
    publicParcelCount: 15,
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
    seed: 23,
    digest: "777372f170629292",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 711,
    marketableParcelCount: 695,
    publicParcelCount: 16,
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
    seed: 42,
    digest: "fb7f12e5c4505606",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 694,
    marketableParcelCount: 679,
    publicParcelCount: 15,
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
    digest: "c8700c15cc908de8",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 687,
    marketableParcelCount: 672,
    publicParcelCount: 15,
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
    digest: "106ce98d0593f11d",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 717,
    marketableParcelCount: 702,
    publicParcelCount: 15,
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
];
