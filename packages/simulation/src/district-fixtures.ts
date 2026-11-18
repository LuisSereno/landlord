import type { UrbanRole } from "@landlord/shared";

/**
 * Instantáneas reproducibles del generador de distritos. Regenerar con `pnpm district:inspect`
 * (las variables `DISTRICT_PROFILE` y `DISTRICT_SEED` acotan el barrido) después de cambiar
 * `DISTRICT_GENERATOR_VERSION`, los perfiles o el algoritmo.
 *
 * Regeneración V.l.5c (2026-11-10): cartera visual opción 3. `barrio_del_umbral` vuelve al eje,
 * `vega_del_cauce` adopta la sección `ave3` y `ensanche_ferroviario` permanece en eje.
 *
 * La tabla conserva sólo las doce filas que el gate usa; el resto de perfiles se inspecciona con
 * `pnpm district:inspect` cuando cambia su receta.
 *
 */
export type DistrictFixture = {
  profileId: string;
  seed: number;
  hash: string;
  parcelCount: number;
  anchorParcelCount: number;
  blockedCellCount: number;
  roleCounts: Record<UrbanRole, number>;
};

export const DISTRICT_FIXTURE_SEEDS: readonly number[] = [1, 7, 42, 1337];

/**
 * Regeneración D-109 (2026-11-18): DISTRICT_GENERATOR_VERSION 4. Los equipamientos reservan solar
 * y huella física por separado (siteFootprint) y la numeración pública usa la marca alta de ids
 * privados tras la fusión D-106. Las doce filas se miden con `pnpm district:inspect`; el cambio
 * de versión invalida los hashes anteriores de forma visible, como exige D-064.
 */
export const DISTRICT_FIXTURES: readonly DistrictFixture[] = [
  {
    profileId: "barrio_del_umbral",
    seed: 1,
    hash: "e4cbaa2f",
    parcelCount: 101,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 42,
      urban_residential: 30,
      low_density_residential: 0,
      industrial_logistics: 27,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 7,
    hash: "471ff88f",
    parcelCount: 98,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 41,
      urban_residential: 32,
      low_density_residential: 0,
      industrial_logistics: 23,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 42,
    hash: "ba9acbd6",
    parcelCount: 100,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 38,
      urban_residential: 32,
      low_density_residential: 0,
      industrial_logistics: 28,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 1337,
    hash: "f0c48273",
    parcelCount: 95,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 39,
      urban_residential: 27,
      low_density_residential: 0,
      industrial_logistics: 27,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1,
    hash: "a69b5b69",
    parcelCount: 73,
    anchorParcelCount: 6,
    blockedCellCount: 233,
    roleCounts: {
      civic_core: 0,
      mixed_core: 26,
      commercial_corridor: 0,
      urban_residential: 23,
      low_density_residential: 0,
      industrial_logistics: 24,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 7,
    hash: "7547c5d5",
    parcelCount: 74,
    anchorParcelCount: 6,
    blockedCellCount: 228,
    roleCounts: {
      civic_core: 0,
      mixed_core: 26,
      commercial_corridor: 0,
      urban_residential: 25,
      low_density_residential: 0,
      industrial_logistics: 23,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 42,
    hash: "bf8ceddf",
    parcelCount: 69,
    anchorParcelCount: 6,
    blockedCellCount: 229,
    roleCounts: {
      civic_core: 0,
      mixed_core: 25,
      commercial_corridor: 0,
      urban_residential: 22,
      low_density_residential: 0,
      industrial_logistics: 22,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1337,
    hash: "7521ffb2",
    parcelCount: 65,
    anchorParcelCount: 6,
    blockedCellCount: 225,
    roleCounts: {
      civic_core: 0,
      mixed_core: 23,
      commercial_corridor: 0,
      urban_residential: 20,
      low_density_residential: 0,
      industrial_logistics: 22,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1,
    hash: "5441d007",
    parcelCount: 47,
    anchorParcelCount: 4,
    blockedCellCount: 133,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 28,
      industrial_logistics: 17,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 7,
    hash: "3f8631ba",
    parcelCount: 47,
    anchorParcelCount: 4,
    blockedCellCount: 124,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 27,
      industrial_logistics: 18,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 42,
    hash: "6e156ae5",
    parcelCount: 54,
    anchorParcelCount: 4,
    blockedCellCount: 124,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 30,
      industrial_logistics: 22,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1337,
    hash: "12a8d957",
    parcelCount: 50,
    anchorParcelCount: 4,
    blockedCellCount: 134,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 29,
      industrial_logistics: 19,
      institutional: 2,
      green_open_space: 0,
    },
  },
];
