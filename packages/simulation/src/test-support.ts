import type { DistrictId, Parcel } from "@landlord/shared";

import { RIVAL_HOME_DISTRICT_ID, PLAYER_HOME_DISTRICT_ID } from "./city";
import type { GameState } from "./state";

/**
 * Helpers for tests that need "a parcel the organization can actually work on".
 *
 * V.d made work district-scoped (D-088): a crew cannot build, repair or sabotage in a district it is
 * not in, so a test that grabs the first parcel in the city is testing the rejection path by
 * accident. These pick by district first, then by the caller's predicate, in canonical id order.
 */
export function parcelsInDistrict(
  state: GameState,
  districtId: DistrictId,
  predicate: (parcel: Parcel) => boolean = () => true,
): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && predicate(parcel))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function firstParcelInDistrict(
  state: GameState,
  districtId: DistrictId,
  predicate: (parcel: Parcel) => boolean = () => true,
): Parcel {
  const parcel = parcelsInDistrict(state, districtId, predicate)[0];
  if (!parcel) throw new Error(`No parcel in district ${districtId} matches the predicate`);
  return parcel;
}

export function rivalParcel(
  state: GameState,
  predicate: (parcel: Parcel) => boolean = () => true,
): Parcel {
  return firstParcelInDistrict(state, RIVAL_HOME_DISTRICT_ID, predicate);
}

export function playerParcel(
  state: GameState,
  predicate: (parcel: Parcel) => boolean = () => true,
): Parcel {
  return firstParcelInDistrict(state, PLAYER_HOME_DISTRICT_ID, predicate);
}
