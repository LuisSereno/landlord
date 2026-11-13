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

export const DISTRICT_FIXTURES: readonly DistrictFixture[] = [
  {
    profileId: "barrio_del_umbral",
    seed: 1,
    hash: "3b2da309",
    parcelCount: 90,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 37,
      urban_residential: 27,
      low_density_residential: 0,
      industrial_logistics: 24,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 7,
    hash: "824ba450",
    parcelCount: 100,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 40,
      urban_residential: 30,
      low_density_residential: 0,
      industrial_logistics: 28,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 42,
    hash: "ecdb4836",
    parcelCount: 88,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 33,
      urban_residential: 28,
      low_density_residential: 0,
      industrial_logistics: 25,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 1337,
    hash: "8119b92f",
    parcelCount: 93,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 36,
      urban_residential: 29,
      low_density_residential: 0,
      industrial_logistics: 26,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1,
    hash: "ca0d645f",
    parcelCount: 73,
    anchorParcelCount: 6,
    blockedCellCount: 226,
    roleCounts: {
      civic_core: 0,
      mixed_core: 26,
      commercial_corridor: 0,
      urban_residential: 24,
      low_density_residential: 0,
      industrial_logistics: 23,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 7,
    hash: "5090e181",
    parcelCount: 73,
    anchorParcelCount: 6,
    blockedCellCount: 227,
    roleCounts: {
      civic_core: 0,
      mixed_core: 29,
      commercial_corridor: 0,
      urban_residential: 21,
      low_density_residential: 0,
      industrial_logistics: 23,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 42,
    hash: "e45dae7e",
    parcelCount: 73,
    anchorParcelCount: 6,
    blockedCellCount: 229,
    roleCounts: {
      civic_core: 0,
      mixed_core: 26,
      commercial_corridor: 0,
      urban_residential: 25,
      low_density_residential: 0,
      industrial_logistics: 22,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1337,
    hash: "d2540270",
    parcelCount: 71,
    anchorParcelCount: 6,
    blockedCellCount: 225,
    roleCounts: {
      civic_core: 0,
      mixed_core: 23,
      commercial_corridor: 0,
      urban_residential: 24,
      low_density_residential: 0,
      industrial_logistics: 24,
      institutional: 0,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1,
    hash: "c1043de0",
    parcelCount: 46,
    anchorParcelCount: 4,
    blockedCellCount: 131,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 29,
      industrial_logistics: 15,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 7,
    hash: "64ca9dc8",
    parcelCount: 52,
    anchorParcelCount: 4,
    blockedCellCount: 138,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 31,
      industrial_logistics: 19,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 42,
    hash: "8e910dc9",
    parcelCount: 49,
    anchorParcelCount: 4,
    blockedCellCount: 133,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 24,
      industrial_logistics: 23,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1337,
    hash: "f0c227d9",
    parcelCount: 47,
    anchorParcelCount: 4,
    blockedCellCount: 140,
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
];
