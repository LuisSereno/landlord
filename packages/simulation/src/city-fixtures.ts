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
 * Regeneración V.l.5 (2026-11-10) · **causa**: el corredor de D-104 se recorta a un perfil. Con los
 * seis perfiles de V.l.4 las doce ciudades caían a 638–677 parcelas y las doce se salían de la
 * envolvente; el recorte deja `roadCorridor` sólo en `barrio_del_umbral`, el más barato de los seis en
 * la barrida de perfiles (6,25 parcelas de media sobre cuatro seeds de distrito; `mercado_del_norte` y
 * `ensanche_ferroviario` cuestan 20 cada uno). Ahí cada city seed tiene exactamente un slot con ese
 * perfil (`CITY_SLOTS` en `city.ts`), así que el efecto por ciudad es el de ese único distrito.
 * La envolvente no se toca: es la alarma del generador, no un umbral que se adapte al fallo.
 *
 * **Control** medido en las mismas doce seeds con el corredor fuera de los seis perfiles: las parcelas
 * recuperan EXACTAMENTE los doce valores de la tabla publicada antes de V.l (723, 738, 722, 739, 726,
 * 712, 736, 730, 738, 730, 739, 740; commit `3a32240`, última regeneración `68c0056`, anterior por
 * tanto a esta fase) y también `blockCount` 119, `publicParcelCount` 14, `facilityCount` 14,
 * `publicSpaceCount` 7, `municipalBuildingCount` 14, `gatewayCount` y `connectionCount` 12 y los ocho
 * `blockRoleCounts`. Es decir: el corredor no movió ningún otro recuento de la ciudad; en el perfil que
 * lo conserva cuesta entre −8 y −22 parcelas por ciudad (media 13,25: 22, 17, 15, 15, 10, 12, 11, 12, 8,
 * 14, 14, 9 en las doce seeds). Los `digest` sí cambian incluso con el corredor apagado (seed 1 pasa de
 * `c92a0e6bb0f08e48` a `e51bdec8a96a19f2`), así que el residual es de forma y no de economía, y no lo
 * escribe el camino nuevo de V.l: en `vega_del_cauce`, con el corredor fuera, las 375/375 celdas de eje
 * y sus segmentos dueños coinciden con la fórmula de V.d.4. La firma —recuentos sí, digesto no— es la
 * misma deuda de baseline que el acta de V.e (2026-11-03) ya registraba fallando en `develop` antes de
 * V.l: ver `docs/engineering/adr/D-104-seccion-transversal-autoritativa.md`, sección V.l.5, donde
 * queda registrado como abierto para V.l.6.
 *
 * Alternativas medidas y descartadas por la envolvente: dos perfiles (barrio + ensanche oeste)
 * 695–728 con tres seeds fuera; los dos comerciales (mercado + ensanche) 682–709 con ocho fuera;
 * cuatro perfiles 659–692 con las doce fuera.
 *
 * Queda abierto y es decisión del responsable: ese único perfil con corredor es el slot del jugador y
 * cuesta diez tests de comportamiento que están verdes con cero corredores (ningún frente vial se
 * pierde). ADR D-104, "El coste del recorte no lo paga la envolvente".
 */
export const CITY_SEED_FIXTURES: readonly CitySeedFixture[] = [
  {
    seed: 1,
    digest: "3693390b21391b9f",
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
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 2,
    digest: "9cb6a86833e51ed6",
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
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 3,
    digest: "e1ab5e97ee325f3c",
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
      commercial_corridor: 24,
      urban_residential: 29,
      low_density_residential: 6,
      industrial_logistics: 41,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 5,
    digest: "3297dd304fda6452",
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
    digest: "896215e3afd418c5",
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
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 11,
    digest: "6716a122a8f81283",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 700,
    marketableParcelCount: 686,
    publicParcelCount: 14,
    facilityCount: 14,
    publicSpaceCount: 7,
    municipalBuildingCount: 14,
    gatewayCount: 12,
    connectionCount: 12,
    blockRoleCounts: {
      civic_core: 0,
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 13,
    digest: "e3e38312cea42185",
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
    seed: 17,
    digest: "28cc2c87dabc82a9",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 718,
    marketableParcelCount: 704,
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
    digest: "2116747bf75b8e32",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 730,
    marketableParcelCount: 716,
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
    seed: 42,
    digest: "88f62d2093b6f8e7",
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
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 1337,
    digest: "b0c971f17bf12de0",
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
      mixed_core: 10,
      commercial_corridor: 25,
      urban_residential: 29,
      low_density_residential: 4,
      industrial_logistics: 40,
      institutional: 11,
      green_open_space: 0,
    },
  },
  {
    seed: 2026,
    digest: "7ed5819990b9ebb2",
    districtCount: 9,
    blockCount: 119,
    parcelCount: 731,
    marketableParcelCount: 717,
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
];
