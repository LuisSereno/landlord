import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseCrewId,
  parseDistrictId,
  parseOrganizationId,
  parsePersonId,
  type ProductCommand,
} from "@landlord/shared";

import { dispatchProductCommand } from "./commands";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState } from "./state";
import { advanceProductSystems } from "./systems";
import { districtRoute, gatewayCell, TRANSFER_TICKS_PER_COST } from "./transfers";
import { RIVAL_HOME_DISTRICT_ID, PLAYER_HOME_DISTRICT_ID, districtIdForSlot } from "./city";

let commandCounter = 0;

type CommandOf<T extends ProductCommand["type"]> = Extract<ProductCommand, { type: T }>;

function command<T extends ProductCommand["type"]>(
  type: T,
  payload: CommandOf<T>["payload"],
): CommandOf<T> {
  commandCounter += 1;
  return {
    commandId: parseCommandId(`transfer-${type}-${commandCounter}`),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type,
    payload,
  } as CommandOf<T>;
}

const NEIGHBOUR_EAST = districtIdForSlot(1, 1);

describe("V.d.0 traslado de cuadrillas y agentes", () => {
  it("encuentra la ruta más barata por gateways y desempata de forma estable", () => {
    const state = createInitialState(1);
    const direct = districtRoute(state, PLAYER_HOME_DISTRICT_ID, NEIGHBOUR_EAST)!;
    expect(direct.route).toEqual([NEIGHBOUR_EAST]);
    const far = districtRoute(state, districtIdForSlot(0, 1), districtIdForSlot(2, 2))!;
    // Barrio del Umbral (0,1) → Centro Cívico (1,1) → Barrio del Taller (2,1) → Patios del Este (2,2).
    expect(far.route).toEqual([
      districtIdForSlot(1, 1),
      districtIdForSlot(2, 1),
      districtIdForSlot(2, 2),
    ]);
    expect(far.cost).toBe(12);
    expect(districtRoute(state, PLAYER_HOME_DISTRICT_ID, PLAYER_HOME_DISTRICT_ID)!.cost).toBe(0);
  });

  it("mueve la cuadrilla entera, la deja no disponible y la aparece en el gateway", () => {
    const state = createInitialState(1);
    const crew = state.phase2.crews.get(parseCrewId("crew_00000001"))!;
    const members = [crew.supervisorAgentId, ...crew.workerAgentIds];
    const arrival = gatewayCell(state, PLAYER_HOME_DISTRICT_ID, NEIGHBOUR_EAST)!;

    expect(
      dispatchProductCommand(
        state,
        command("TransferCrew", { crewId: crew.id, toDistrictId: NEIGHBOUR_EAST }),
      ),
    ).toMatchObject({ accepted: true });

    for (const agentId of members) {
      const agent = state.agents.get(agentId)!;
      expect(agent.travel?.toDistrictId).toBe(NEIGHBOUR_EAST);
      expect(agent.districtId).toBe(PLAYER_HOME_DISTRICT_ID);
      expect(agent.task).toBeNull();
    }

    // Mientras viajan no se les puede asignar otra obra.
    const rivalParcel = [...state.phase2.parcels.values()].find(
      (parcel) => parcel.districtId === NEIGHBOUR_EAST,
    )!;
    state.phase2.parcels.get(rivalParcel.id)!.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    expect(
      dispatchProductCommand(
        state,
        command("StartConstruction", { parcelIds: [rivalParcel.id], buildingType: "courtyard_home" }),
      ),
    ).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(
      dispatchProductCommand(
        state,
        command("AssignCrewToWorkOrder", { crewId: crew.id, workOrderId: site.id }),
      ),
    ).toMatchObject({ accepted: false, code: "AGENT_ALREADY_TRAVELLING" });

    // El reloj avanza al final del tick, así que la llegada se ejecuta en la llamada siguiente.
    const travelTicks = TRANSFER_TICKS_PER_COST * 4 + 1;
    for (let tick = 0; tick < travelTicks; tick += 1) advanceProductSystems(state);
    for (const agentId of members) {
      const agent = state.agents.get(agentId)!;
      expect(agent.districtId).toBe(NEIGHBOUR_EAST);
      expect(agent.travel).toBeNull();
      expect(agent.cell).toEqual(arrival);
      expect(agent.state).toBe("idle");
    }
  });

  it("rechaza traslados sin ruta, de otra organización o ya en curso", () => {
    const state = createInitialState(1);
    const crew = state.phase2.crews.get(parseCrewId("crew_00000001"))!;
    expect(
      dispatchProductCommand(
        state,
        command("TransferCrew", { crewId: crew.id, toDistrictId: RIVAL_HOME_DISTRICT_ID }),
      ),
    ).toMatchObject({ accepted: true });
    expect(
      dispatchProductCommand(
        state,
        command("TransferCrew", { crewId: crew.id, toDistrictId: NEIGHBOUR_EAST }),
      ),
    ).toMatchObject({ accepted: false, code: "AGENT_ALREADY_TRAVELLING" });

    const rivalAgent = [...state.agents.values()].find(
      (agent) => agent.organizationId === parseOrganizationId("org_00000002"),
    )!;
    expect(
      dispatchProductCommand(
        state,
        command("TransferAgent", { agentId: rivalAgent.id, toDistrictId: NEIGHBOUR_EAST }),
      ),
    ).toMatchObject({ accepted: false, code: "ACTOR_NOT_AUTHORIZED" });
    expect(
      dispatchProductCommand(
        state,
        command("TransferAgent", {
          agentId: rivalAgent.id,
          toDistrictId: parseDistrictId("district_99999999"),
        }),
      ),
    ).toMatchObject({ accepted: false, code: "ACTOR_NOT_AUTHORIZED" });
  });

  it("persiste el viaje en el snapshot y lo completa tras cargar", () => {
    const state = createInitialState(1);
    const crew = state.phase2.crews.get(parseCrewId("crew_00000001"))!;
    dispatchProductCommand(
      state,
      command("TransferCrew", { crewId: crew.id, toDistrictId: NEIGHBOUR_EAST }),
    );

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    const restoredCrew = restored.phase2.crews.get(crew.id)!;
    const restoredAgent = restored.agents.get(restoredCrew.supervisorAgentId)!;
    expect(restoredAgent.travel?.toDistrictId).toBe(NEIGHBOUR_EAST);
    expect(restoredAgent.districtId).toBe(PLAYER_HOME_DISTRICT_ID);

    for (let tick = 0; tick < TRANSFER_TICKS_PER_COST * 4 + 1; tick += 1)
      advanceProductSystems(restored);
    expect(restored.agents.get(restoredCrew.supervisorAgentId)!.districtId).toBe(NEIGHBOUR_EAST);
  });
});
