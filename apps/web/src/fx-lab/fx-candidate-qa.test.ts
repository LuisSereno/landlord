import { describe, expect, it } from "vitest";
import { validateCandidateQa, type CandidateQaMetadata } from "./fx-candidate-qa";

const base = {
  candidateId: "w06cnd_mixed_tenement_2",
  buildingType: "mixed_tenement",
  state: "complete",
  compositionSignature: "94f1106d",
  candidateProfile: "gn_residential_v2",
  footprintCells: { width: 4, height: 3 },
  camera: { azimuthDegrees: 45, elevationDegrees: 30, targetZ: 4.5 },
  trim: {
    rendered: { width: 960, height: 540 },
    cropped: { width: 900, height: 500, offsetX: 30, offsetY: 20 },
    final: { width: 1048, height: 1046 },
  },
  framing: { pixelsPerMeter: 96 },
  pivot: { x: 0.5, y: 0.9 },
  fireAnchors: [],
} as CandidateQaMetadata;

describe("FINAL-ASSET-QA 2.3 · ruta QA sin sustituciones silenciosas", () => {
  it("acepta el tipo exacto y la variante de estado declarada", () => {
    expect(validateCandidateQa(base, "mixed_tenement").ok).toBe(true);
    const burning = { ...base, state: "burning" };
    expect(validateCandidateQa(burning, "mixed_tenement-burning").ok).toBe(true);
  });

  it("acepta `aged` cuando la metadata declara la proyección material", () => {
    const aged = { ...base, weathering: { visualState: "aged" } };
    expect(validateCandidateQa(aged, "mixed_tenement-aged").ok).toBe(true);
    // Sin la declaración en `weathering`, el sufijo aged no existe: se informa, no se sustituye.
    expect(validateCandidateQa(base, "mixed_tenement-aged")).toEqual({
      ok: false,
      requestedName: "mixed_tenement-aged",
      problems: ['variante pedida "aged" no disponible; la candidata es "complete"'],
    });
  });

  it("rechaza un tipo que no corresponde y metadata incompleta, con el motivo explícito", () => {
    expect(validateCandidateQa(base, "warehouse")).toEqual({
      ok: false,
      requestedName: "warehouse",
      problems: ['tipo solicitado "warehouse" no corresponde a la candidata "mixed_tenement"'],
    });
    const { candidateProfile: _omit, ...rest } = base;
    const incomplete = { ...rest, candidateId: "", compositionSignature: "" };
    const result = validateCandidateQa(incomplete, "mixed_tenement");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(" ")).toContain("candidateId");
      expect(result.problems.join(" ")).toContain("candidateProfile");
      expect(result.problems.join(" ")).toContain("compositionSignature");
    }
  });
});
