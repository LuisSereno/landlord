import type { BuildingId } from "@landlord/shared";

/**
 * H1-07. Una parcela admite varios edificios desde V.d.2, así que la unidad de gestión deja de ser
 * `Parcel.buildingId` (que la proyección conserva sólo como compatibilidad) y pasa a ser una
 * selección explícita del jugador. Todo lo que se puede derivar se deriva: un id que ya no pertenece
 * a la parcela activa se ignora, y eso limpia la selección al cambiar de parcela sin efectos ni
 * estado adicional que pueda quedar inconsistente.
 */
export type BuildingSelection = {
  /** Edificio sobre el que se ejecutan las acciones; `null` cuando no hay uno claro. */
  activeBuildingId: BuildingId | null;
  /** Con varios edificios ninguna acción se ejecuta sobre un arbitrio: hay que elegir. */
  requiresBuildingChoice: boolean;
};

export function resolveBuildingSelection(
  buildingIds: readonly BuildingId[],
  selectedBuildingId: BuildingId | null,
): BuildingSelection {
  const explicit =
    selectedBuildingId !== null && buildingIds.includes(selectedBuildingId)
      ? selectedBuildingId
      : null;
  return {
    activeBuildingId: explicit ?? (buildingIds.length === 1 ? (buildingIds[0] ?? null) : null),
    requiresBuildingChoice: buildingIds.length > 1 && explicit === null,
  };
}
