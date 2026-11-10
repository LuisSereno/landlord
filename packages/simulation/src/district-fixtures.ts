import type { UrbanRole } from "@landlord/shared";

/**
 * Instantáneas reproducibles del generador de distritos. Regenerar con `pnpm district:inspect`
 * (las variables `DISTRICT_PROFILE` y `DISTRICT_SEED` acotan el barrido) después de cambiar
 * `DISTRICT_GENERATOR_VERSION`, los perfiles o el algoritmo.
 *
 * Regeneración V.l.5 (2026-11-10) · **causa**: D-104 con el corredor recortado a un perfil.
 * Comparado contra V.d.4 (`401ae93`, la referencia que pide el gate), las doce filas caen en tres
 * grupos medidos, no en uno:
 * - `ensanche_ferroviario` (4 filas) vuelve a ser byte a byte la fila de V.d.4 — `ca0d645f/73/226`,
 *   `5090e181/73/227`, `e45dae7e/73/229`, `d2540270/71/225` — así que el control del gate
 *   ("perfiles a ancho 1 recuperan los valores V.d.4") se cumple exacto en este perfil.
 * - `barrio_del_umbral` (4 filas) conserva corredor y por eso se mueve respecto a V.d.4: parcelas
 *   90→88, 100→89, 88→84, 93→85 y celdas bloqueadas 240→216 en las cuatro seeds. Aquí está el coste
 *   que compra la envolvente de ciudad: el corredor se lleva suelo que antes era edificable.
 * - `vega_del_cauce` (4 filas) recupera los tres recuentos de V.d.4 (parcelas y celdas bloqueadas
 *   50/135, 57/144, 54/140, 52/145, y anclas 4 en las cuatro) pero no el hash: `793bfa88`→`ca952382`, `5a223308`→`149aca6c`, `027d3b7b`→`b84749fd`,
 *   `e7a20c47`→`b9f82309`. Residual de forma, y acotado por medida: con el corredor fuera, las
 *   375/375 celdas de eje de vega y sus segmentos dueños coinciden con la fórmula de V.d.4
 *   (`roadCorridorSegmentsByCell` ≡ bucle viejo, 0 celdas distintas), así que no lo escribe el
 *   camino nuevo de V.l. La firma —recuentos sí, digesto no— es la misma deuda de baseline que el
 *   acta de V.e (`docs/execution/phase-4/ve-integrated-correction-verification-2026-11-03.md`)
 *   ya registraba fallando en `develop` antes de V.l. Su causa exacta queda abierta para V.l.6.
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
    hash: "4dfd8ade",
    parcelCount: 88,
    anchorParcelCount: 8,
    blockedCellCount: 216,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 34,
      urban_residential: 27,
      low_density_residential: 0,
      industrial_logistics: 25,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 7,
    hash: "b8ed6c4c",
    parcelCount: 89,
    anchorParcelCount: 8,
    blockedCellCount: 216,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 35,
      urban_residential: 25,
      low_density_residential: 0,
      industrial_logistics: 27,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 42,
    hash: "1f799795",
    parcelCount: 84,
    anchorParcelCount: 8,
    blockedCellCount: 216,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 31,
      urban_residential: 26,
      low_density_residential: 0,
      industrial_logistics: 25,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "barrio_del_umbral",
    seed: 1337,
    hash: "2ec04323",
    parcelCount: 85,
    anchorParcelCount: 8,
    blockedCellCount: 216,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 34,
      urban_residential: 26,
      low_density_residential: 0,
      industrial_logistics: 23,
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
    hash: "ca952382",
    parcelCount: 50,
    anchorParcelCount: 4,
    blockedCellCount: 135,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 30,
      industrial_logistics: 18,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 7,
    hash: "149aca6c",
    parcelCount: 57,
    anchorParcelCount: 4,
    blockedCellCount: 144,
    roleCounts: {
      civic_core: 0,
      mixed_core: 0,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 36,
      industrial_logistics: 19,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 42,
    hash: "b84749fd",
    parcelCount: 54,
    anchorParcelCount: 4,
    blockedCellCount: 140,
    roleCounts: {
      civic_core: 0,
      mixed_core: 11,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 21,
      industrial_logistics: 20,
      institutional: 2,
      green_open_space: 0,
    },
  },
  {
    profileId: "vega_del_cauce",
    seed: 1337,
    hash: "b9f82309",
    parcelCount: 52,
    anchorParcelCount: 4,
    blockedCellCount: 145,
    roleCounts: {
      civic_core: 0,
      mixed_core: 10,
      commercial_corridor: 0,
      urban_residential: 0,
      low_density_residential: 21,
      industrial_logistics: 19,
      institutional: 2,
      green_open_space: 0,
    },
  },
];
