import { describe, expect, it } from "vitest";
import { parseBuildingId, type BuildingId } from "@landlord/shared";
import { resolveBuildingSelection } from "./building-selection";

/**
 * H1-07. La proyección publica `buildingIds` desde V.d.2, pero el inspector actuaba sobre el primer
 * `buildingId` de la parcela. Estas reglas fijan la selección explícita: el jugador elige el edificio
 * y ninguna acción se ejecuta sobre un arbitrio cuando la parcela tiene varios.
 */

const FIRST = parseBuildingId("building_00000001");
const SECOND = parseBuildingId("building_00000002");
const OTHER = parseBuildingId("building_00000009");

function id(value: BuildingId | null): string | null {
  return value;
}

describe("H1-07 · selección explícita de edificio", () => {
  it("un solar vacío no deja ninguna selección activa", () => {
    expect(resolveBuildingSelection([], FIRST)).toEqual({
      activeBuildingId: null,
      requiresBuildingChoice: false,
    });
  });

  it("una parcela con un solo edificio lo selecciona sola", () => {
    expect(resolveBuildingSelection([FIRST], null)).toEqual({
      activeBuildingId: FIRST,
      requiresBuildingChoice: false,
    });
  });

  it("con varios edificios hay que elegir, y la acción va al elegido", () => {
    expect(resolveBuildingSelection([FIRST, SECOND], null)).toEqual({
      activeBuildingId: null,
      requiresBuildingChoice: true,
    });
    const chosen = resolveBuildingSelection([FIRST, SECOND], SECOND);
    expect(id(chosen.activeBuildingId)).toBe(SECOND);
    expect(chosen.requiresBuildingChoice).toBe(false);
    expect(resolveBuildingSelection([FIRST, SECOND], FIRST).activeBuildingId).toBe(FIRST);
  });

  it("cambiar de parcela limpia la selección anterior", () => {
    /** El id elegido pertenecía a la parcela previa: no puede seguir mandando en la nueva. */
    expect(resolveBuildingSelection([FIRST, SECOND], OTHER).activeBuildingId).toBeNull();
    expect(resolveBuildingSelection([FIRST], OTHER).activeBuildingId).toBe(FIRST);
    expect(resolveBuildingSelection([], OTHER)).toEqual({
      activeBuildingId: null,
      requiresBuildingChoice: false,
    });
  });

  it("la lista vacante de una parcela pública nunca activa acciones", () => {
    expect(resolveBuildingSelection([], null)).toEqual({
      activeBuildingId: null,
      requiresBuildingChoice: false,
    });
  });

  it("el orden de la lista no cambia la elección explícita", () => {
    expect(resolveBuildingSelection([SECOND, FIRST], SECOND)).toEqual(
      resolveBuildingSelection([FIRST, SECOND], SECOND),
    );
    expect(resolveBuildingSelection([SECOND, FIRST], null).activeBuildingId).toBeNull();
  });
});
