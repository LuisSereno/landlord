import {
  parseAgentId,
  parseDistrictId,
  parseOrganizationId,
  parseTick,
  type AgentId,
  type AgentSpecialty,
  type ViewProjectionV3,
} from "@landlord/shared";
import { describe, expect, it } from "vitest";

import {
  planAgentVisuals,
  type AgentVisualAppearance,
  type AgentVisualMemory,
} from "./agent-visual-plan";

type ProjectedAgent = ViewProjectionV3["agents"][number];
type ProjectedBase = ViewProjectionV3["bases"][number];

const DISTRICT = parseDistrictId("district_00000001");
const OTHER_DISTRICT = parseDistrictId("district_00000002");
const PLAYER = parseOrganizationId("org_00000001");
const RIVAL = parseOrganizationId("org_00000002");

function agent(
  id: string,
  specialty: AgentSpecialty | undefined,
  overrides: Partial<ProjectedAgent> = {},
): ProjectedAgent {
  return {
    id: parseAgentId(id),
    districtId: DISTRICT,
    cell: { x: 5, y: 5 },
    nextCell: null,
    organizationId: PLAYER,
    ...(specialty ? { specialty } : {}),
    health: 100,
    state: "idle",
    atBase: false,
    returningToBase: false,
    ...overrides,
  };
}

function base(
  organizationId: ProjectedBase["organizationId"],
  visualIdentityId: ProjectedBase["visualIdentityId"],
): ProjectedBase {
  return {
    organizationId,
    visualIdentityId,
    districtId: DISTRICT,
    mainEntranceCell: { x: 4, y: 4 },
    serviceEntranceCell: { x: 4, y: 4 },
    provisional: true,
    headquartersBuildingId: null,
    headquartersVariantId: null,
    staffCount: 8,
  };
}

function projection(
  agents: readonly ProjectedAgent[],
  bases: readonly ProjectedBase[] = [],
): ViewProjectionV3 {
  return {
    projectionVersion: 3,
    observedDistrictId: DISTRICT,
    city: { id: "city_test", name: "Test", layout: { columns: 3, rows: 3 }, districts: [] },
    tick: parseTick(6),
    movement: { ticksPerCell: 10 },
    bases,
    map: {
      width: 64,
      height: 64,
      roads: { revision: 0, digest: "test", cells: [] },
      roadSection: { revision: 0, digest: "test", profiles: [], segments: [] },
    },
    publicSpaces: [],
    facilities: [],
    structures: [],
    agents,
  } as unknown as ViewProjectionV3;
}

function appearance(
  id: string,
  specialty: AgentSpecialty,
  spriteId = `sprite_${id}`,
  overrides: Partial<AgentVisualAppearance> = {},
): AgentVisualAppearance {
  return {
    id,
    specialty,
    spriteId,
    status: "runtime_ready",
    directions: 4,
    animations: ["idle", "walk"],
    ...overrides,
  };
}

const OPERATIONAL_APPEARANCES: readonly AgentVisualAppearance[] = [
  appearance("supervisor_a", "supervisor"),
  appearance("worker_a", "construction_worker"),
  appearance("maintenance_a", "maintenance_technician"),
  appearance("enforcer_a", "enforcer"),
];

describe("agent-visual-plan", () => {
  it("resolves the four operational specialties to explicit appearances", () => {
    const agents = [
      agent("agent_00000001", "supervisor"),
      agent("agent_00000002", "construction_worker"),
      agent("agent_00000003", "maintenance_technician"),
      agent("agent_00000004", "enforcer"),
    ];
    const plans = planAgentVisuals(projection(agents), { appearances: OPERATIONAL_APPEARANCES });
    expect(plans.map((plan) => plan.specialty)).toEqual([
      "supervisor",
      "construction_worker",
      "maintenance_technician",
      "enforcer",
    ]);
    expect(
      plans.every((plan) => plan.renderKind === "sprite" && plan.fallbackReason === null),
    ).toBe(true);
    expect(plans.map((plan) => plan.spriteId)).toEqual([
      "sprite_supervisor_a",
      "sprite_worker_a",
      "sprite_maintenance_a",
      "sprite_enforcer_a",
    ]);
  });

  it("preserves the existing chr_worker sprite contract for construction workers", () => {
    const plans = planAgentVisuals(projection([agent("agent_00000001", "construction_worker")]), {
      appearances: [appearance("runtime_worker", "construction_worker", "chr_worker")],
    });
    expect(plans[0]).toMatchObject({
      appearanceId: "runtime_worker",
      spriteId: "chr_worker",
      renderKind: "sprite",
      fallbackReason: null,
    });
  });

  it("keeps identities independent and selection stable across inventory order", () => {
    const agents = [
      agent("agent_00000001", "construction_worker"),
      agent("agent_00000002", "construction_worker"),
    ];
    const workerA = appearance("worker_a", "construction_worker", "sprite_a");
    const workerB = appearance("worker_b", "construction_worker", "sprite_b");
    const first = planAgentVisuals(projection(agents), { appearances: [workerB, workerA] });
    const second = planAgentVisuals(projection(agents), { appearances: [workerA, workerB] });
    expect(first).toEqual(second);
    expect(first.map((plan) => plan.agentId)).toEqual(["agent_00000001", "agent_00000002"]);
    expect(first.map((plan) => plan.appearanceId)).toEqual(["worker_a", "worker_b"]);
    expect(first[0]).not.toBe(first[1]);
  });

  it("does not let organization change specialty or appearance selection", () => {
    const subject = agent("agent_00000001", "enforcer");
    const playerPlan = planAgentVisuals(
      projection([subject], [base(PLAYER, "company_turquoise")]),
      { appearances: OPERATIONAL_APPEARANCES },
    )[0]!;
    const rivalPlan = planAgentVisuals(
      projection([{ ...subject, organizationId: RIVAL }], [base(RIVAL, "rival_terracotta")]),
      { appearances: OPERATIONAL_APPEARANCES },
    )[0]!;
    expect(playerPlan.specialty).toBe("enforcer");
    expect(rivalPlan.specialty).toBe("enforcer");
    expect(playerPlan.appearanceId).toBe(rivalPlan.appearanceId);
    expect(playerPlan.organization).toMatchObject({
      id: PLAYER,
      visualIdentityId: "company_turquoise",
      shape: "diamond",
      color: "#4DB6AC",
    });
    expect(rivalPlan.organization).toMatchObject({
      id: RIVAL,
      visualIdentityId: "rival_terracotta",
      shape: "triangle",
      color: "#D97757",
    });
  });

  it("filters other districts and agents inside the base", () => {
    const plans = planAgentVisuals(
      projection([
        agent("agent_00000001", "supervisor"),
        agent("agent_00000002", "construction_worker", { districtId: OTHER_DISTRICT }),
        agent("agent_00000003", "enforcer", { atBase: true }),
      ]),
      { appearances: OPERATIONAL_APPEARANCES },
    );
    expect(plans.map((plan) => plan.agentId)).toEqual(["agent_00000001"]);
  });

  it("keeps injured and dead agents visible and stops their walk clip", () => {
    const plans = planAgentVisuals(
      projection([
        agent("agent_00000001", "construction_worker", {
          state: "injured",
          health: 45,
          nextCell: { x: 6, y: 5 },
        }),
        agent("agent_00000002", "enforcer", {
          state: "dead",
          health: 0,
          nextCell: { x: 6, y: 5 },
        }),
      ]),
      { appearances: OPERATIONAL_APPEARANCES },
    );
    expect(plans[0]).toMatchObject({
      animation: "idle",
      moving: false,
      healthIndicator: { state: "injured", value: 45, visible: true, glyph: "amber_cross" },
    });
    expect(plans[1]).toMatchObject({
      animation: "idle",
      moving: false,
      healthIndicator: { state: "dead", value: 0, visible: true, glyph: "grey_cross" },
    });
  });

  it("processes maintenance and enforcer agents without crew or economy data", () => {
    const view = projection([
      agent("agent_00000001", "maintenance_technician"),
      agent("agent_00000002", "enforcer", { returningToBase: true }),
    ]);
    expect(view.economy).toBeUndefined();
    const plans = planAgentVisuals(view, { appearances: OPERATIONAL_APPEARANCES });
    expect(plans.map((plan) => plan.specialty)).toEqual(["maintenance_technician", "enforcer"]);
    expect(plans[1]!.returningToBase).toBe(true);
  });

  it("uses an explained marker instead of disappearing or disguising a missing profession", () => {
    const plans = planAgentVisuals(projection([agent("agent_00000001", "supervisor")]), {
      appearances: [],
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      spriteId: null,
      renderKind: "marker",
      markerKey: "agent-supervisor",
      fallbackReason: "no_runtime_appearance",
    });
  });

  it("does not promote candidate-only or incomplete runtime appearances", () => {
    const candidate = planAgentVisuals(projection([agent("agent_00000001", "supervisor")]), {
      appearances: [
        appearance("supervisor_candidate", "supervisor", "candidate_supervisor", {
          status: "candidate",
        }),
      ],
    })[0]!;
    const incomplete = planAgentVisuals(projection([agent("agent_00000002", "supervisor")]), {
      appearances: [
        appearance("supervisor_partial", "supervisor", "partial_supervisor", {
          animations: ["idle"],
        }),
      ],
    })[0]!;
    expect(candidate).toMatchObject({
      renderKind: "marker",
      fallbackReason: "only_candidate_appearance",
    });
    expect(incomplete).toMatchObject({
      renderKind: "marker",
      fallbackReason: "incomplete_runtime_appearance",
    });
  });

  it("keeps ambient collections outside the operational agent plan", () => {
    const operational = agent("agent_00000001", "construction_worker");
    const view = projection([operational]) as ViewProjectionV3 & {
      ambientActors?: Array<{ id: string; specialty: AgentSpecialty }>;
      contextActors?: Array<{ id: string; specialty: AgentSpecialty }>;
    };
    view.ambientActors = [{ id: "ambient_00000001", specialty: "enforcer" }];
    view.contextActors = [{ id: "context_00000001", specialty: "supervisor" }];
    const plans = planAgentVisuals(view, { appearances: OPERATIONAL_APPEARANCES });
    expect(plans.map((plan) => plan.agentId)).toEqual([operational.id]);
  });

  it("uses authoritative steps for interpolation and remembers arrival direction", () => {
    const walking = planAgentVisuals(
      projection([
        agent("agent_00000001", "construction_worker", {
          state: "moving",
          nextCell: { x: 6, y: 5 },
        }),
      ]),
      { appearances: OPERATIONAL_APPEARANCES },
    )[0]!;
    expect(walking).toMatchObject({
      animation: "walk",
      direction: 1,
      moving: true,
      cell: { x: 5, y: 5 },
      renderCell: { x: 5.5, y: 5 },
    });

    const previous = new Map<AgentId, AgentVisualMemory>([
      [walking.agentId, { cell: { x: 4, y: 5 }, direction: 1 }],
    ]);
    const stopped = planAgentVisuals(projection([agent("agent_00000001", "construction_worker")]), {
      appearances: OPERATIONAL_APPEARANCES,
      previous,
    })[0]!;
    expect(stopped).toMatchObject({ animation: "idle", direction: 1, moving: false });
  });

  it("returns an explicit fallback when specialty is absent", () => {
    const plans = planAgentVisuals(projection([agent("agent_00000001", undefined)]), {
      appearances: OPERATIONAL_APPEARANCES,
    });
    expect(plans[0]).toMatchObject({
      specialty: null,
      renderKind: "marker",
      markerKey: "agent-unknown",
      fallbackReason: "missing_specialty",
    });
  });

  it("does not mutate the projection or the appearance inventory", () => {
    const view = projection([agent("agent_00000001", "construction_worker")]);
    const beforeView = JSON.stringify(view);
    const beforeAppearances = JSON.stringify(OPERATIONAL_APPEARANCES);
    planAgentVisuals(view, { appearances: OPERATIONAL_APPEARANCES });
    expect(JSON.stringify(view)).toBe(beforeView);
    expect(JSON.stringify(OPERATIONAL_APPEARANCES)).toBe(beforeAppearances);
  });
});
