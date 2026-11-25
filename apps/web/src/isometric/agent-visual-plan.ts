import type {
  AgentId,
  AgentSpecialty,
  CharacterAnimation,
  GridCell,
  OrganizationId,
  ViewProjectionV3,
} from "@landlord/shared";

type ProjectedAgent = ViewProjectionV3["agents"][number];
type OrganizationVisualIdentityId = ViewProjectionV3["bases"][number]["visualIdentityId"];

export type AgentVisualDirection = 0 | 1 | 2 | 3;

export type AgentVisualAppearance = {
  id: string;
  specialty: AgentSpecialty;
  spriteId: string;
  status: "runtime_ready" | "candidate";
  directions: number;
  animations: readonly CharacterAnimation[];
};

export type AgentVisualFallbackReason =
  | "missing_specialty"
  | "no_runtime_appearance"
  | "only_candidate_appearance"
  | "incomplete_runtime_appearance";

export type AgentVisualOrganizationMarker = {
  id: OrganizationId | null;
  visualIdentityId: OrganizationVisualIdentityId;
  shape: "diamond" | "triangle" | "circle" | "ring";
  color: string;
};

export type AgentVisualHealthIndicator = {
  value: number;
  state: "healthy" | "injured" | "dead";
  visible: boolean;
  glyph: "none" | "amber_cross" | "grey_cross";
};

export type AgentVisualPlan = {
  agentId: AgentId;
  districtId: ProjectedAgent["districtId"];
  organizationId: OrganizationId | null;
  specialty: AgentSpecialty | null;
  state: NonNullable<ProjectedAgent["state"]>;
  returningToBase: boolean;
  appearanceId: string | null;
  spriteId: string | null;
  renderKind: "sprite" | "marker";
  markerKey: string | null;
  fallbackReason: AgentVisualFallbackReason | null;
  animation: CharacterAnimation;
  direction: AgentVisualDirection;
  cell: GridCell;
  renderCell: GridCell;
  moving: boolean;
  healthIndicator: AgentVisualHealthIndicator;
  organization: AgentVisualOrganizationMarker;
};

export type AgentVisualMemory = Pick<AgentVisualPlan, "cell" | "direction">;

export type AgentVisualPlanOptions = {
  appearances: readonly AgentVisualAppearance[];
  previous?: ReadonlyMap<AgentId, AgentVisualMemory>;
};

const STEP_DIRECTIONS: Readonly<Record<string, AgentVisualDirection>> = {
  "1,0": 1,
  "0,1": 0,
  "-1,0": 3,
  "0,-1": 2,
};

const ORGANIZATION_MARKERS: Readonly<
  Record<
    NonNullable<OrganizationVisualIdentityId>,
    Pick<AgentVisualOrganizationMarker, "shape" | "color">
  >
> = {
  company_turquoise: { shape: "diamond", color: "#4DB6AC" },
  rival_terracotta: { shape: "triangle", color: "#D97757" },
  municipal_blue: { shape: "circle", color: "#4F78A8" },
  neutral: { shape: "ring", color: "#7F8FA6" },
};

const NEUTRAL_ORGANIZATION_MARKER = ORGANIZATION_MARKERS.neutral;

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function stepDirection(from: GridCell, to: GridCell): AgentVisualDirection | null {
  return STEP_DIRECTIONS[`${to.x - from.x},${to.y - from.y}`] ?? null;
}

function sameCell(left: GridCell, right: GridCell): boolean {
  return left.x === right.x && left.y === right.y;
}

function stepProgress(tick: number, ticksPerCell: number): number {
  if (!Number.isFinite(tick) || !Number.isInteger(ticksPerCell) || ticksPerCell <= 0) return 0;
  return ((((tick - 1) % ticksPerCell) + ticksPerCell) % ticksPerCell) / ticksPerCell;
}

function interpolateCell(from: GridCell, to: GridCell, progress: number): GridCell {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function isCompleteRuntimeAppearance(appearance: AgentVisualAppearance): boolean {
  return (
    appearance.id.trim().length > 0 &&
    appearance.spriteId.trim().length > 0 &&
    appearance.directions === 4 &&
    appearance.animations.includes("idle") &&
    appearance.animations.includes("walk")
  );
}

function resolveAppearance(
  agentId: AgentId,
  specialty: AgentSpecialty | null,
  appearances: readonly AgentVisualAppearance[],
): { appearance: AgentVisualAppearance | null; fallbackReason: AgentVisualFallbackReason | null } {
  if (!specialty) return { appearance: null, fallbackReason: "missing_specialty" };
  const matching = appearances.filter((appearance) => appearance.specialty === specialty);
  if (matching.length === 0) return { appearance: null, fallbackReason: "no_runtime_appearance" };
  const runtime = matching.filter((appearance) => appearance.status === "runtime_ready");
  if (runtime.length === 0)
    return { appearance: null, fallbackReason: "only_candidate_appearance" };
  const usable = runtime.filter(isCompleteRuntimeAppearance);
  if (usable.length === 0)
    return { appearance: null, fallbackReason: "incomplete_runtime_appearance" };
  const ordered = [...usable].sort((left, right) =>
    left.id < right.id
      ? -1
      : left.id > right.id
        ? 1
        : left.spriteId < right.spriteId
          ? -1
          : left.spriteId > right.spriteId
            ? 1
            : 0,
  );
  return { appearance: ordered[stableHash(agentId) % ordered.length]!, fallbackReason: null };
}

function healthIndicator(agent: ProjectedAgent): AgentVisualHealthIndicator {
  const value = agent.health ?? 100;
  if (agent.state === "dead") {
    return { value, state: "dead", visible: true, glyph: "grey_cross" };
  }
  if (agent.state === "injured" || value < 100) {
    return { value, state: "injured", visible: true, glyph: "amber_cross" };
  }
  return { value, state: "healthy", visible: false, glyph: "none" };
}

function organizationMarker(
  agent: ProjectedAgent,
  basesByOrganization: ReadonlyMap<OrganizationId, ViewProjectionV3["bases"][number]>,
): AgentVisualOrganizationMarker {
  const organizationId = agent.organizationId ?? null;
  const visualIdentityId = organizationId
    ? (basesByOrganization.get(organizationId)?.visualIdentityId ?? null)
    : null;
  const marker = visualIdentityId
    ? ORGANIZATION_MARKERS[visualIdentityId]
    : NEUTRAL_ORGANIZATION_MARKER;
  return { id: organizationId, visualIdentityId, ...marker };
}

export function planAgentVisuals(
  projection: ViewProjectionV3,
  options: AgentVisualPlanOptions,
): AgentVisualPlan[] {
  const basesByOrganization = new Map(
    projection.bases.map((base) => [base.organizationId, base] as const),
  );
  const plans: AgentVisualPlan[] = [];
  for (const agent of projection.agents) {
    if (agent.districtId !== projection.observedDistrictId || agent.atBase) continue;
    const specialty = agent.specialty ?? null;
    const { appearance, fallbackReason } = resolveAppearance(
      agent.id,
      specialty,
      options.appearances,
    );
    const health = healthIndicator(agent);
    const step =
      health.state === "healthy" && agent.nextCell
        ? stepDirection(agent.cell, agent.nextCell)
        : null;
    const previous = options.previous?.get(agent.id);
    const arrived =
      previous && !sameCell(previous.cell, agent.cell)
        ? stepDirection(previous.cell, agent.cell)
        : null;
    const direction = step ?? arrived ?? previous?.direction ?? 0;
    const moving = step !== null;
    plans.push({
      agentId: agent.id,
      districtId: agent.districtId,
      organizationId: agent.organizationId ?? null,
      specialty,
      state: agent.state ?? "idle",
      returningToBase: agent.returningToBase,
      appearanceId: appearance?.id ?? null,
      spriteId: appearance?.spriteId ?? null,
      renderKind: appearance ? "sprite" : "marker",
      markerKey: appearance ? null : `agent-${specialty ?? "unknown"}`,
      fallbackReason,
      animation: moving ? "walk" : "idle",
      direction,
      cell: { ...agent.cell },
      renderCell:
        moving && agent.nextCell
          ? interpolateCell(
              agent.cell,
              agent.nextCell,
              stepProgress(projection.tick, projection.movement.ticksPerCell),
            )
          : { ...agent.cell },
      moving,
      healthIndicator: health,
      organization: organizationMarker(agent, basesByOrganization),
    });
  }
  return plans;
}
