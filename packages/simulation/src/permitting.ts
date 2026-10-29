import type { BuildingType, ParcelId, Permit } from "@landlord/shared";
import type { GameState } from "./state";

/**
 * Un permiso es una decisión administrativa con identidad propia (H1-03). Se guarda la colección por
 * `PermitId` y la vigencia se deriva en orden canónico, así que no existe un índice duplicado que
 * pueda quedar inconsistente con el registro.
 */

/** Permisos de una parcela y tipo en orden canónico: tick de solicitud y, al empatar, id. */
export function permitsFor(
  state: GameState,
  parcelId: ParcelId,
  buildingType: BuildingType,
): Permit[] {
  return Object.values(state.phase2.permitting.permitsById)
    .filter((permit) => permit.parcelId === parcelId && permit.buildingType === buildingType)
    .sort(
      (left, right) =>
        left.requestedAtTick - right.requestedAtTick || left.id.localeCompare(right.id),
    );
}

/**
 * Permiso vigente para construir: aprobado, sin consumir y sin caducar. El más reciente si la
 * historia deja varios; `null` cuando no lo hay, nunca un permiso de otro tipo de edificio.
 */
export function activePermitFor(
  state: GameState,
  parcelId: ParcelId,
  buildingType: BuildingType,
  tick: number,
): Permit | null {
  const live = permitsFor(state, parcelId, buildingType).filter(
    (permit) =>
      permit.status === "approved" &&
      (permit.expiresAtTick === null || permit.expiresAtTick > tick),
  );
  return live[live.length - 1] ?? null;
}

/**
 * Permiso vigente más reciente de la parcela, sea cual sea el tipo: es lo que la inspección muestra
 * cuando el jugador aún no ha elegido edificio. Se ordena por solicitud y, al empatar, por id, para
 * no depender del orden de inserción de la colección.
 */
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

function allPermitsForParcel(state: GameState, parcelId: ParcelId): Permit[] {
  return Object.values(state.phase2.permitting.permitsById)
    .filter((permit) => permit.parcelId === parcelId)
    .sort(
      (left, right) =>
        left.requestedAtTick - right.requestedAtTick || left.id.localeCompare(right.id),
    );
}

/**
 * Lo que la inspección publica por parcela: primero un permiso vivo, y si no lo hay la última
 * decisión registrada (denegada, caducada o consumida). Así el jugador ve en qué quedó el expediente
 * sin que la proyección tenga que adivinar el tipo de edificio.
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
