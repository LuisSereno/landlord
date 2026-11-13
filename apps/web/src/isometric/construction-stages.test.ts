import { describe, expect, it } from "vitest";

import {
  CONSTRUCTION_STAGE_BANDS,
  constructionStageLabel,
  constructionStageMassing,
  constructionVisualStage,
  crewStateLabel,
  crewVisualState,
} from "./construction-stages";

describe("V.d-7C · etapas visuales de obra", () => {
  it("deriva la etapa del progreso autoritativo", () => {
    expect(constructionVisualStage(0, 100)).toBe("foundation");
    expect(constructionVisualStage(14, 100)).toBe("foundation");
    expect(constructionVisualStage(15, 100)).toBe("structure");
    expect(constructionVisualStage(69, 100)).toBe("structure");
    expect(constructionVisualStage(70, 100)).toBe("finishing");
    expect(constructionVisualStage(99, 100)).toBe("finishing");
    expect(constructionVisualStage(100, 100)).toBe("complete");
  });

  it("acota valores fuera de rango sin inventar gameplay", () => {
    expect(constructionVisualStage(-10, 100)).toBe("foundation");
    expect(constructionVisualStage(500, 100)).toBe("complete");
    /** Una obra sin trabajo exigido ya está terminada: no hay división por cero. */
    expect(constructionVisualStage(0, 0)).toBe("complete");
    expect(constructionVisualStage(Number.NaN, 100)).toBe("complete");
  });

  it("las bandas son constantes de presentación, no reglas de simulación", () => {
    expect(CONSTRUCTION_STAGE_BANDS.foundationUntil).toBeGreaterThan(0);
    expect(CONSTRUCTION_STAGE_BANDS.structureUntil).toBeGreaterThan(
      CONSTRUCTION_STAGE_BANDS.foundationUntil,
    );
    expect(CONSTRUCTION_STAGE_BANDS.finishingUntil).toBe(1);
    /** La masa crece con la etapa y nunca supera el volumen final. */
    const masses = (["foundation", "structure", "finishing", "complete"] as const).map(
      constructionStageMassing,
    );
    expect(masses).toEqual([...masses].sort((left, right) => left - right));
    expect(masses[3]).toBe(1);
  });

  it("etiqueta cada etapa en lenguaje de jugador", () => {
    expect(constructionStageLabel("foundation")).toBe("Cimentación");
    expect(constructionStageLabel("structure")).toBe("Estructura y andamios");
    expect(constructionStageLabel("finishing")).toBe("Acabados");
    expect(constructionStageLabel("complete")).toBe("Terminado");
  });
});

describe("V.d-7C · estados visibles de cuadrilla", () => {
  it("usa únicamente lo que el dominio ya sabe", () => {
    expect(crewVisualState({ assignedToSite: false, agentState: "idle", atSite: false })).toBe(
      "released",
    );
    expect(crewVisualState({ assignedToSite: true, agentState: "idle", atSite: false })).toBe(
      "assigned",
    );
    expect(crewVisualState({ assignedToSite: true, agentState: "moving", atSite: false })).toBe(
      "travelling",
    );
    expect(crewVisualState({ assignedToSite: true, agentState: "idle", atSite: true })).toBe(
      "on-site",
    );
    expect(crewVisualState({ assignedToSite: true, agentState: "working", atSite: true })).toBe(
      "working",
    );
  });

  it("nombra los estados sin enums técnicos en la ficha", () => {
    expect(crewStateLabel("travelling")).toBe("De camino");
    expect(crewStateLabel("working")).toBe("Trabajando");
  });
});
