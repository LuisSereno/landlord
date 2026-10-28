import type { Zoning } from "@landlord/shared";

/**
 * Instantáneas reproducibles del generador de distritos. Regenerar con `pnpm district:inspect`
 * (las variables `DISTRICT_PROFILE` y `DISTRICT_SEED` acotan el barrido) después de cambiar
 * `DISTRICT_GENERATOR_VERSION`, los perfiles o el algoritmo.
 */
export type DistrictFixture = {
  profileId: string;
  seed: number;
  hash: string;
  parcelCount: number;
  anchorParcelCount: number;
  blockedCellCount: number;
  zoningCounts: Record<Zoning, number>;
};

export const DISTRICT_FIXTURE_SEEDS: readonly number[] = [1, 7, 42, 1337];

export const DISTRICT_FIXTURES: readonly DistrictFixture[] = [
  {
    profileId: "barrio_del_umbral",
    seed: 1,
    hash: "3471cc6a",
    parcelCount: 111,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    zoningCounts: { residential: 51, mixed: 35, industrial: 25 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 7,
    hash: "9a964059",
    parcelCount: 111,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    zoningCounts: { residential: 56, mixed: 33, industrial: 22 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 42,
    hash: "a78dc2be",
    parcelCount: 113,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    zoningCounts: { residential: 54, mixed: 36, industrial: 23 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 1337,
    hash: "ede99a82",
    parcelCount: 107,
    anchorParcelCount: 8,
    blockedCellCount: 240,
    zoningCounts: { residential: 53, mixed: 33, industrial: 21 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1,
    hash: "c43c1a12",
    parcelCount: 70,
    anchorParcelCount: 6,
    blockedCellCount: 232,
    zoningCounts: { residential: 23, mixed: 22, industrial: 25 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 7,
    hash: "33ce5502",
    parcelCount: 69,
    anchorParcelCount: 6,
    blockedCellCount: 225,
    zoningCounts: { residential: 22, mixed: 22, industrial: 25 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 42,
    hash: "db2453ef",
    parcelCount: 69,
    anchorParcelCount: 6,
    blockedCellCount: 224,
    zoningCounts: { residential: 22, mixed: 21, industrial: 26 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1337,
    hash: "6d93180a",
    parcelCount: 70,
    anchorParcelCount: 6,
    blockedCellCount: 240,
    zoningCounts: { residential: 20, mixed: 22, industrial: 28 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1,
    hash: "3cb7de2d",
    parcelCount: 77,
    anchorParcelCount: 4,
    blockedCellCount: 136,
    zoningCounts: { residential: 31, mixed: 32, industrial: 14 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 7,
    hash: "0fe8a355",
    parcelCount: 70,
    anchorParcelCount: 4,
    blockedCellCount: 139,
    zoningCounts: { residential: 29, mixed: 26, industrial: 15 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 42,
    hash: "8a938a18",
    parcelCount: 74,
    anchorParcelCount: 4,
    blockedCellCount: 128,
    zoningCounts: { residential: 31, mixed: 28, industrial: 15 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1337,
    hash: "80196d2b",
    parcelCount: 69,
    anchorParcelCount: 4,
    blockedCellCount: 142,
    zoningCounts: { residential: 28, mixed: 28, industrial: 13 },
  },
];
