/**
 * V.d-7C · etapas visuales de la obra (D-097 · Construction choreography).
 *
 * Se derivan del progreso autoritativo que ya existe. Ninguna banda cambia `workRequired`, el coste,
 * el consumo de materiales ni el ritmo de la obra: son constantes de presentación, y por eso viven
 * en `apps/web` y no en el motor.
 */
export type ConstructionVisualStage = "foundation" | "structure" | "finishing" | "complete";

/** Bandas elegidas para que una obra corta se lea como proceso, no como sprite con alpha. */
export const CONSTRUCTION_STAGE_BANDS = {
  foundationUntil: 0.15,
  structureUntil: 0.7,
  finishingUntil: 1,
} as const;

export function constructionVisualStage(
  progress: number,
  workRequired: number,
): ConstructionVisualStage {
  const ratio =
    Number.isFinite(progress) && workRequired > 0
      ? Math.min(1, Math.max(0, progress / workRequired))
      : 1;
  if (ratio >= CONSTRUCTION_STAGE_BANDS.finishingUntil) return "complete";
  if (ratio >= CONSTRUCTION_STAGE_BANDS.structureUntil) return "finishing";
  if (ratio >= CONSTRUCTION_STAGE_BANDS.foundationUntil) return "structure";
  return "foundation";
}

/** Cuánto de la altura final se insinúa en cada etapa. Sólo afecta al dibujo. */
export function constructionStageMassing(stage: ConstructionVisualStage): number {
  if (stage === "foundation") return 0.12;
  if (stage === "structure") return 0.55;
  if (stage === "finishing") return 0.85;
  return 1;
}

export function constructionStageLabel(stage: ConstructionVisualStage): string {
  return {
    foundation: "Cimentación",
    structure: "Estructura y andamios",
    finishing: "Acabados",
    complete: "Terminado",
  }[stage];
}

/**
 * Estados de cuadrilla que el dominio ya conoce (posición, tarea y disponibilidad proyectadas).
 * Aquí sólo se nombra lo que el motor dice; no se simula ningún segundo movimiento.
 */
export type CrewVisualState = "assigned" | "travelling" | "on-site" | "working" | "released";

export function crewVisualState(input: {
  assignedToSite: boolean;
  agentState: string | undefined;
  atSite: boolean;
}): CrewVisualState {
  if (!input.assignedToSite) return "released";
  if (input.agentState === "working") return "working";
  if (input.atSite) return "on-site";
  if (input.agentState === "moving") return "travelling";
  return "assigned";
}

export function crewStateLabel(state: CrewVisualState): string {
  return {
    assigned: "Asignada",
    travelling: "De camino",
    "on-site": "En el solar",
    working: "Trabajando",
    released: "Liberada",
  }[state];
}
