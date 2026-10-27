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
    hash: "c0fcf5b0",
    parcelCount: 23,
    anchorParcelCount: 8,
    blockedCellCount: 0,
    zoningCounts: { residential: 8, mixed: 4, industrial: 11 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 7,
    hash: "bc4a7b8e",
    parcelCount: 28,
    anchorParcelCount: 8,
    blockedCellCount: 0,
    zoningCounts: { residential: 8, mixed: 14, industrial: 6 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 42,
    hash: "63235de9",
    parcelCount: 34,
    anchorParcelCount: 8,
    blockedCellCount: 0,
    zoningCounts: { residential: 19, mixed: 13, industrial: 2 },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 1337,
    hash: "8bcf0dc5",
    parcelCount: 29,
    anchorParcelCount: 8,
    blockedCellCount: 0,
    zoningCounts: { residential: 17, mixed: 10, industrial: 2 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1,
    hash: "18d44d2a",
    parcelCount: 64,
    anchorParcelCount: 6,
    blockedCellCount: 5,
    zoningCounts: { residential: 34, mixed: 10, industrial: 20 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 7,
    hash: "ac7704b0",
    parcelCount: 32,
    anchorParcelCount: 6,
    blockedCellCount: 11,
    zoningCounts: { residential: 8, mixed: 10, industrial: 14 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 42,
    hash: "8743da74",
    parcelCount: 54,
    anchorParcelCount: 6,
    blockedCellCount: 6,
    zoningCounts: { residential: 12, mixed: 23, industrial: 19 },
  },
  {
    profileId: "ensanche_ferroviario",
    seed: 1337,
    hash: "c395a1d6",
    parcelCount: 49,
    anchorParcelCount: 6,
    blockedCellCount: 12,
    zoningCounts: { residential: 15, mixed: 18, industrial: 16 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1,
    hash: "da0f216e",
    parcelCount: 57,
    anchorParcelCount: 4,
    blockedCellCount: 20,
    zoningCounts: { residential: 29, mixed: 15, industrial: 13 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 7,
    hash: "a45a99f4",
    parcelCount: 57,
    anchorParcelCount: 4,
    blockedCellCount: 11,
    zoningCounts: { residential: 31, mixed: 19, industrial: 7 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 42,
    hash: "ddfcee47",
    parcelCount: 49,
    anchorParcelCount: 4,
    blockedCellCount: 19,
    zoningCounts: { residential: 6, mixed: 22, industrial: 21 },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1337,
    hash: "5581ea3c",
    parcelCount: 48,
    anchorParcelCount: 4,
    blockedCellCount: 13,
    zoningCounts: { residential: 23, mixed: 15, industrial: 10 },
  },
];
