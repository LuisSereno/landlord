import type { BuildingType, Parcel, ParcelId, Permit } from "@landlord/shared";
import { areSameParcelSet, canonicalParcelIds as canonicalIds } from "@landlord/shared";

import type { GameState } from "./state";

/**
 * Un permiso es una decisión administrativa con identidad propia (H1-03) ligada al CONJUNTO exacto
 * de parcelas del proyecto (V.d-7). Se guarda por `PermitId` y la vigencia se deriva en orden
 * canónico, así que no existe un índice duplicado que pueda quedar inconsistente con el registro.
 */

/** Permisos de un conjunto exacto de parcelas y tipo, en orden canónico. */
export function permitsFor(
  state: GameState,
  parcelIds: readonly ParcelId[],
  buildingType: BuildingType,
): Permit[] {
  const target = canonicalIds(parcelIds);
  return Object.values(state.phase2.permitting.permitsById)
    .filter(
      (permit) =>
        permit.buildingType === buildingType && areSameParcelSet(permit.parcelIds, target),
    )
    .sort(
      (left, right) =>
        left.requestedAtTick - right.requestedAtTick || left.id.localeCompare(right.id),
    );
}

/**
 * Permiso vigente para construir: aprobado, sin consumir y sin caducar, del conjunto exacto. Un
 * permiso de [A, B] no sirve para [A, C] ni para [A] (V.d-7 §12).
 */
export function activePermitFor(
  state: GameState,
  parcelIds: readonly ParcelId[],
  buildingType: BuildingType,
  tick: number,
): Permit | null {
  const live = permitsFor(state, parcelIds, buildingType).filter(
    (permit) =>
      permit.status === "approved" &&
      (permit.expiresAtTick === null || permit.expiresAtTick > tick),
  );
  return live[live.length - 1] ?? null;
}

/** Permisos que INCLUYEN una parcela, sea cual sea el conjunto con el que se emitieron. */
export function allPermitsForParcel(state: GameState, parcelId: ParcelId): Permit[] {
  return Object.values(state.phase2.permitting.permitsById)
    .filter((permit) => permit.parcelIds.includes(parcelId))
    .sort(
      (left, right) =>
        left.requestedAtTick - right.requestedAtTick || left.id.localeCompare(right.id),
    );
}

/** Permiso vigente más reciente que incluye la parcela, sea cual sea el tipo. */
export function latestLivePermitForParcel(
  state: GameState,
  parcelId: ParcelId,
  tick: number,
): Permit | null {
  const live = allPermitsForParcel(state, parcelId).filter(
    (permit) =>
      permit.status === "approved" &&
      (permit.expiresAtTick === null || permit.expiresAtTick > tick),
  );
  return live[live.length - 1] ?? null;
}

/**
 * Lo que la inspección publica por parcela: primero un permiso vivo, y si no lo hay la última
 * decisión registrada. Así el jugador ve en qué quedó el expediente sin adivinar el tipo.
 */
export function publishedPermitForParcel(
  state: GameState,
  parcelId: ParcelId,
  tick: number,
): Permit | null {
  const live = latestLivePermitForParcel(state, parcelId, tick);
  if (live) return live;
  const history = allPermitsForParcel(state, parcelId);
  return history[history.length - 1] ?? null;
}

/** La parcela primaria de un permiso es su ancla de presentación, no una regla económica. */
export function permitPrimaryParcelId(permit: Permit): ParcelId {
  return permit.parcelIds[0]!;
}

/** Los permisos se emiten para parcelas reales; el helper evita repetir el tipo en cada llamada. */
export type PermitParcel = Pick<Parcel, "id" | "developmentCodeId" | "currentUses">;
