import { describe, expect, it } from "vitest";

import type {
  DevelopmentPlacementCandidate,
  DevelopmentPlacementCandidates,
} from "@landlord/shared";

import {
  beginPlacementRequest,
  nearestCandidateToCell,
  nearestPlacementCandidate,
  nextPlacementCandidate,
  placementAnswerReceived,
  placementConfirmIssues,
  placementEntryIssues,
  placementCounterLabel,
  placementHasRotation,
  placementIssue,
  placementRequestFailed,
  placementSummary,
  previousPlacementCandidate,
  rotatePlacementCandidate,
  selectPlacementCandidate,
  selectedCandidate,
  confirmablePlacement,
  type PendingPlacement,
} from "./placement";

function candidate(
  id: string,
  cells: { x: number; y: number }[],
  orientation: 0 | 90 | 180 | 270,
  recommended = false,
): DevelopmentPlacementCandidate {
  return {
    id: `placement_${id}` as DevelopmentPlacementCandidate["id"],
    districtId: "district_00000001" as DevelopmentPlacementCandidate["districtId"],
    parcelIds: ["parcel_00000001"] as DevelopmentPlacementCandidate["parcelIds"],
    footprintCells: cells,
    orientation,
    floors: 2,
    recommended,
  };
}

const CANDIDATES = [
  candidate("aaaa", [{ x: 2, y: 2 }], 0, true),
  candidate("bbbb", [{ x: 8, y: 2 }], 0),
  candidate(
    "cccc",
    [
      { x: 2, y: 9 },
      { x: 2, y: 10 },
    ],
    90,
  ),
];

const ANSWER: DevelopmentPlacementCandidates = {
  districtId: "district_00000001" as DevelopmentPlacementCandidates["districtId"],
  parcelIds: ["parcel_00000001"] as DevelopmentPlacementCandidates["parcelIds"],
  buildingType: "courtyard_home",
  candidates: CANDIDATES,
  totalCandidates: 3,
  rejection: null,
};

function placing(): PendingPlacement {
  return placementAnswerReceived(
    beginPlacementRequest({
      buildingType: "courtyard_home",
      districtId: "district_00000001",
      parcelIds: ["parcel_00000001"],
    }),
    ANSWER,
  );
}

describe("V.d-7C · estado transitorio de colocación", () => {
  it("empieza pidiendo y termina con la recomendada seleccionada", () => {
    const pending = beginPlacementRequest({
      buildingType: "courtyard_home",
      districtId: "district_00000001",
      parcelIds: ["parcel_00000001"],
    });
    expect(pending.status).toBe("requesting");
    expect(confirmablePlacement(pending)).toBeNull();
    const ready = placementAnswerReceived(pending, ANSWER);
    expect(ready.status).toBe("placing");
    expect(ready.selectedCandidateId).toBe(CANDIDATES[0]!.id);
    expect(confirmablePlacement(ready)).toBe(CANDIDATES[0]!.id);
  });

  it("sin candidatas el modo se bloquea con la razón del motor", () => {
    const empty = placementAnswerReceived(
      beginPlacementRequest({
        buildingType: "apartment_block",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
      }),
      { ...ANSWER, candidates: [], totalCandidates: 0, rejection: "NO_BUILDABLE_ENVELOPE" },
    );
    expect(empty.status).toBe("blocked");
    expect(confirmablePlacement(empty)).toBeNull();
    /** Copia de jugador, no el enum técnico (§29). */
    expect(placementIssue(empty)).toBe(
      "No cabe este edificio respetando los retranqueos del código.",
    );
    expect(placementIssue(empty)).not.toContain("NO_BUILDABLE_ENVELOPE");
  });

  it("una petición fallida no deja confirmar", () => {
    const failed = placementRequestFailed(
      beginPlacementRequest({
        buildingType: "courtyard_home",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
      }),
    );
    expect(failed.status).toBe("failed");
    expect(placementIssue(failed)).toContain("El motor no pudo responder");
    expect(confirmablePlacement(failed)).toBeNull();
  });

  it("sólo se puede seleccionar una candidata legal", () => {
    const pending = placing();
    const chosen = selectPlacementCandidate(pending, CANDIDATES[2]!.id);
    expect(chosen.selectedCandidateId).toBe(CANDIDATES[2]!.id);
    expect(selectPlacementCandidate(pending, "placement_inventada").selectedCandidateId).toBe(
      CANDIDATES[0]!.id,
    );
  });

  it("anterior y siguiente rotan por toda la lista", () => {
    const pending = placing();
    expect(nextPlacementCandidate(pending).selectedCandidateId).toBe(CANDIDATES[1]!.id);
    expect(
      nextPlacementCandidate(nextPlacementCandidate(nextPlacementCandidate(pending)))
        .selectedCandidateId,
    ).toBe(CANDIDATES[0]!.id);
    expect(previousPlacementCandidate(pending).selectedCandidateId).toBe(CANDIDATES[2]!.id);
  });

  it("rotar salta a otra orientación legal y no inventa geometría", () => {
    const pending = placing();
    const rotated = rotatePlacementCandidate(pending);
    expect(rotated.selectedCandidateId).toBe(CANDIDATES[2]!.id);
    expect(selectedCandidate(rotated)!.orientation).toBe(90);
    const onlyOneOrientation = placementAnswerReceived(
      beginPlacementRequest({
        buildingType: "courtyard_home",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
      }),
      { ...ANSWER, candidates: CANDIDATES.slice(0, 2) },
    );
    expect(placementHasRotation(onlyOneOrientation)).toBe(false);
    expect(rotatePlacementCandidate(onlyOneOrientation).selectedCandidateId).toBe(
      CANDIDATES[0]!.id,
    );
  });

  it("el puntero elige la candidata legal más cercana, sin crear huellas", () => {
    const pending = placing();
    expect(nearestPlacementCandidate(pending, { x: 3, y: 3 })).toBe(CANDIDATES[0]!.id);
    expect(nearestPlacementCandidate(pending, { x: 8, y: 3 })).toBe(CANDIDATES[1]!.id);
    expect(nearestPlacementCandidate(pending, { x: 2, y: 10 })).toBe(CANDIDATES[2]!.id);
    /** Empate resuelto por id: la regla es total y determinista. */
    expect(nearestCandidateToCell([CANDIDATES[1]!, CANDIDATES[0]!], { x: 5, y: 2 })).toBe(
      CANDIDATES[0]!.id,
    );
    /** Lejísimos de todo sigue resolviendo una candidata legal: el puntero nunca crea geometría. */
    expect(nearestPlacementCandidate(pending, { x: 40, y: 40 })).toBe(CANDIDATES[2]!.id);
  });

  it("la ficha dice cuántas candidatas hay y si el motor envió más", () => {
    expect(placementCounterLabel(placing())).toBe("1 de 3");
    const clipped = placementAnswerReceived(
      beginPlacementRequest({
        buildingType: "courtyard_home",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
      }),
      { ...ANSWER, totalCandidates: 41 },
    );
    expect(placementCounterLabel(clipped)).toBe("1 de 3 (hay más)");
    expect(placementSummary(clipped)).toContain("1 celdas");
  });

  it("las razones de entrada y de confirmación se separan", () => {
    const reasons = [
      { code: "not_owned", message: "Necesitas comprar la parcela antes de construir." },
      { code: "parcel_busy", message: "La parcela ya tiene un edificio." },
      { code: "missing_cement", message: "Te faltan 4 de cemento." },
      { code: "not_enough_cash", message: "Te faltan 900 u. para pagar la obra." },
      { code: "no_free_crew", message: "No tienes una cuadrilla libre." },
    ];
    expect(placementEntryIssues(reasons)).toEqual([
      "Necesitas comprar la parcela antes de construir.",
      "La parcela ya tiene un edificio.",
    ]);
    /** §33: ver el mapa no depende de la tesorería; sólo confirmar sí. */
    expect(placementConfirmIssues(reasons)).toEqual([
      "Te faltan 4 de cemento.",
      "Te faltan 900 u. para pagar la obra.",
      "No tienes una cuadrilla libre.",
    ]);
  });
});
