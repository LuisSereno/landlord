import type { BuildingType, PublicSpaceKind, UrbanFacilityKind } from "@landlord/shared";

/**
 * Exact municipal programme of §4.4, authored per district recipe. The generator reserves one block
 * per entry before subdividing private soil; a district whose programme does not fit fails the
 * attempt instead of silently dropping a facility (V.d.3).
 */
export type MunicipalProgramEntry =
  | {
      id: string;
      kind: "facility";
      facilityKind: UrbanFacilityKind;
      buildingType: BuildingType;
    }
  | {
      id: string;
      kind: "public_space";
      publicSpaceKind: PublicSpaceKind;
    };

export const MUNICIPAL_PROGRAM_BY_PROFILE: Record<string, readonly MunicipalProgramEntry[]> = {
  centro_civico: [
    {
      id: "centro_town_hall",
      kind: "facility",
      facilityKind: "town_hall",
      buildingType: "town_hall",
    },
    { id: "centro_plaza", kind: "public_space", publicSpaceKind: "plaza" },
    {
      id: "centro_police",
      kind: "facility",
      facilityKind: "police_station",
      buildingType: "police_station",
    },
    { id: "centro_clinic", kind: "facility", facilityKind: "clinic", buildingType: "clinic" },
    { id: "centro_market", kind: "facility", facilityKind: "market", buildingType: "market_hall" },
  ],
  lomas_del_umbral: [
    { id: "lomas_school", kind: "facility", facilityKind: "school", buildingType: "school_block" },
    { id: "lomas_park", kind: "public_space", publicSpaceKind: "park" },
  ],
  barrio_del_umbral: [
    { id: "barrio_school", kind: "facility", facilityKind: "school", buildingType: "school_block" },
    { id: "barrio_clinic", kind: "facility", facilityKind: "clinic", buildingType: "clinic" },
    { id: "barrio_park", kind: "public_space", publicSpaceKind: "park" },
  ],
  vega_del_cauce: [
    { id: "vega_school", kind: "facility", facilityKind: "school", buildingType: "school_block" },
    { id: "vega_clinic", kind: "facility", facilityKind: "clinic", buildingType: "clinic" },
    { id: "vega_park", kind: "public_space", publicSpaceKind: "park" },
  ],
  mercado_del_norte: [
    {
      id: "mercado_market",
      kind: "facility",
      facilityKind: "market",
      buildingType: "market_hall",
    },
    { id: "mercado_park", kind: "public_space", publicSpaceKind: "park" },
  ],
  barrio_del_taller: [
    {
      id: "taller_police",
      kind: "facility",
      facilityKind: "police_station",
      buildingType: "police_station",
    },
    { id: "taller_market", kind: "facility", facilityKind: "market", buildingType: "market_hall" },
    { id: "taller_park", kind: "public_space", publicSpaceKind: "park" },
  ],
  ensanche_ferroviario: [{ id: "ferroviario_park", kind: "public_space", publicSpaceKind: "park" }],
  ensanche_ferroviario_oeste: [
    {
      id: "ferroviario_oeste_fire",
      kind: "facility",
      facilityKind: "fire_station",
      buildingType: "fire_station",
    },
  ],
  patios_del_este: [
    {
      id: "patios_este_fire",
      kind: "facility",
      facilityKind: "fire_station",
      buildingType: "fire_station",
    },
  ],
};

export function municipalProgramForProfile(profileId: string): readonly MunicipalProgramEntry[] {
  return MUNICIPAL_PROGRAM_BY_PROFILE[profileId] ?? [];
}

export const MUNICIPAL_FACILITY_SERVICE_PROFILE: Record<UrbanFacilityKind, string> = {
  town_hall: "town_hall_service_v1",
  school: "school_service_v1",
  clinic: "clinic_service_v1",
  police_station: "police_service_v1",
  fire_station: "fire_service_v1",
  market: "market_service_v1",
};

export const MUNICIPAL_FACILITY_CAPACITY: Record<UrbanFacilityKind, number> = {
  town_hall: 1,
  school: 6,
  clinic: 4,
  police_station: 2,
  fire_station: 2,
  market: 4,
};

/** Expected programme of the nine authored recipes, checked by tests and the gate. */
export const CITY_MUNICIPAL_PROGRAM_COUNTS = {
  town_hall: 1,
  plaza: 1,
  schools: 3,
  parks: 6,
  police_stations: 2,
  fire_stations: 2,
  clinics: 3,
  markets: 3,
} as const;
