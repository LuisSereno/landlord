import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseParcelId,
  parseTenantId,
  parseCrewId,
  parseAgentId,
  parseOrganizationId,
  parsePersonId,
} from "@landlord/shared";
import { createInitialState } from "./state";
import { dispatchProductCommand } from "./commands";
import { advanceProductSystems } from "./systems";
import { buildBuildingIndex, buildingsOnParcel } from "./building-index";

const actor = {
  issuedByPersonId: parsePersonId("person_00000001"),
  actingAsOrganizationId: parseOrganizationId("org_00000001"),
};

function command(
  id: string,
  type: "StartConstruction" | "AssignCrewToWorkOrder" | "OrderEnforcerAction",
  payload: Record<string, unknown>,
) {
  return { commandId: parseCommandId(id), ...actor, type, payload } as never;
}

describe("WP2.15 tactical spike", () => {
  it("does not progress a work order until a physical crew reaches its interaction cell", () => {
    const state = createInitialState(101);
    const parcelId = parseParcelId("parcel_00000001");
    state.phase2.parcels.get(parcelId)!.ownerOrganizationId = actor.actingAsOrganizationId;
    expect(
      dispatchProductCommand(
        state,
        command("start", "StartConstruction", { parcelId, buildingType: "courtyard_home" }),
      ),
    ).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()][0]!;
    for (let tick = 0; tick < 51; tick += 1) advanceProductSystems(state);
    expect(site.progress).toBe(0);
    expect(
      dispatchProductCommand(
        state,
        command("assign", "AssignCrewToWorkOrder", {
          crewId: parseCrewId("crew_00000001"),
          workOrderId: site.id,
        }),
      ),
    ).toMatchObject({ accepted: true });
    // La geometría v2 aleja el tajo del spawn: se espera la llegada física, no un tick fijo.
    for (let tick = 0; tick < 500 && site.progress === 0; tick += 1) {
      advanceProductSystems(state);
    }
    expect(site.progress).toBeGreaterThan(0);
    expect(state.agents.get(parseAgentId("agent_00000001"))?.state).toBe("working");
  });

  it("applies two 50-point attacks as injury then death", () => {
    const state = createInitialState(102);
    const enforcer = state.agents.get(parseAgentId("agent_00000008"))!;
    const target = state.agents.get(parseAgentId("agent_00000009"))!;
    // V.d: una agresión exige presencia en el mismo distrito; el objetivo rival se traslada aquí
    // porque este test mide el daño táctico, no la regla de traslado (que tiene su propio test).
    target.districtId = enforcer.districtId;
    enforcer.cell = { x: 20, y: 20 };
    target.cell = { x: 20, y: 21 };
    const order = () =>
      dispatchProductCommand(
        state,
        command("attack-" + (target.health ?? 100), "OrderEnforcerAction", {
          enforcerAgentId: enforcer.id,
          action: "attack_agent",
          targetAgentId: target.id,
        }),
      );
    expect(order()).toMatchObject({ accepted: true });
    for (let tick = 0; tick < 51; tick += 1) advanceProductSystems(state);
    expect(target.health).toBe(50);
    target.state = "idle";
    expect(order()).toMatchObject({ accepted: true });
    for (let tick = 0; tick < 51; tick += 1) advanceProductSystems(state);
    expect(target.health).toBe(0);
    expect(target.state).toBe("dead");
  });

  it("counts casualties per contracted tenant and displaces them on collapse", () => {
    const state = createInitialState(103);
    const buildingId = parseBuildingId("building_00000001");
    const parcelId = parseParcelId("parcel_00000001");
    const buildingParcel = state.phase2.parcels.get(parcelId)!;
    const building = {
      id: buildingId,
      parcelId,
      districtId: buildingParcel.districtId,
      footprintCells: [{ ...buildingParcel.anchorCell }],
      orientation: 0 as const,
      floors: 1,
      form: "detached" as const,
      ownerOrganizationId: actor.actingAsOrganizationId,
      type: "courtyard_home" as const,
      level: 1,
      condition: 10,
      tenantId: parseTenantId("tenant_00000001"),
      tenantIds: [parseTenantId("tenant_00000001"), parseTenantId("tenant_00000004")],
      upgraded: false,
      structuralIntegrity: 0,
      state: "collapse_pending" as const,
      casualtiesTotal: { injured: 0, dead: 0 },
    };
    state.phase2.parcels.get(parcelId)!.ownerOrganizationId = actor.actingAsOrganizationId;
    state.phase2.buildings.set(buildingId, building);
    for (const tenantId of building.tenantIds) {
      const tenant = state.phase2.tenants.get(tenantId)!;
      tenant.activeContractBuildingId = buildingId;
      tenant.status = "contracted";
    }
    for (let tick = 0; tick < 51; tick += 1) advanceProductSystems(state);
    expect(building.state).toBe("ruin");
    expect(building.casualtiesTotal).toEqual({ dead: 3, injured: 3 });
    expect(state.phase2.tenants.get(parseTenantId("tenant_00000001"))?.status).toBe("displaced");
    expect(buildingsOnParcel(buildBuildingIndex(state), parcelId)[0]?.id).toBe(buildingId);
  });
});
