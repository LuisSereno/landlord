import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseCrewId,
  parseIncidentId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parseTick,
  type Building,
  type ConstructionSite,
  type DistrictId,
  type GridCell,
  type Parcel,
  type ProductCommand,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import { isAdjacentToCells } from "./district-obstacles";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { activePermitFor } from "./permitting";
import { createViewProjection } from "./projection";
import { advanceProductSystems } from "./systems";
import { createInitialState, type GameState } from "./state";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { reconcileParcelUses } from "./building-index";

/**
 * H1-10 C, D y E. Tres ciclos completos por el camino real: una parcela con varios edificios que
 * sobrevive a guardar, mantener, incendiar y limpiar; la secuencia de permisos hasta el consumo; y
 * una cuadrilla que tiene que viajar de verdad para trabajar en otro distrito.
 */

const actor = parsePersonId("person_00000001");

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function quietState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  inventory.cement = 500;
  inventory.brick = 500;
  inventory.steel = 500;
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function parcelsWithRoom(state: GameState, districtId: DistrictId): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.districtId === districtId &&
        parcel.disposition === "marketable" &&
        parcel.cells.length >= 12,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function addBuilding(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
  type: Building["type"],
): Building["id"] {
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  const building: Building = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: footprintCells.map((cell) => ({ ...cell })),
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type,
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return id;
}

/** Dos huellas separadas dentro del mismo solar, sin solaparse. */
function twoFootprints(parcel: Parcel): { front: GridCell[]; back: GridCell[] } {
  const sorted = [...parcel.cells].sort((left, right) => left.y - right.y || left.x - right.x);
  const front = [sorted[0]!];
  const back = [sorted[sorted.length - 1]!];
  return { front, back };
}

function site(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprint: GridCell[],
): ConstructionSite {
  const id = parseConstructionSiteId(`site_${String(serial).padStart(8, "0")}`);
  const entry: ConstructionSite = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    buildingType: "courtyard_home",
    footprintCells: footprint.map((cell) => ({ ...cell })),
    orientation: 0,
    floors: 1,
    form: "detached",
    progress: 0,
    workRequired: 400,
    resourcesReserved: { cement: 1, brick: 1, steel: 0 },
    crewCapacity: 0,
    upgradeBuildingId: null,
    repairBuildingId: null,
    kind: "construction",
    targetBuildingId: null,
    assignedCrewIds: [],
    assignedTechnicianId: null,
  };
  state.phase2.constructionSites.set(id, entry);
  return entry;
}

describe("H1-10 C · parcela con varios edificios", () => {
  it("sobrevive a guardar, mantener, incendiar, limpiar la ruina y reconciliar usos", () => {
    const state = quietState();
    const parcel = parcelsWithRoom(state, PLAYER_HOME_DISTRICT_ID)[0]!;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const { front, back } = twoFootprints(parcel);
    const housing = addBuilding(state, parcel, 1, front, "courtyard_home");
    const workshop = addBuilding(state, parcel, 2, back, "workshop");
    reconcileParcelUses(state, parcel.id);
    expect(parcel.currentUses).toContain("residential");
    expect(parcel.currentUses).toContain("industrial");

    /** La proyección publica los dos edificios: la UI selecciona sobre esa lista. */
    const projection = createViewProjection(state, true).economy!;
    const entry = projection.parcels.find((candidate) => candidate.id === parcel.id)!;
    expect(entry.buildingIds).toEqual([housing, workshop]);

    /** Save/load conserva ambos edificios y sus huellas. */
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect([...restored.phase2.buildings.keys()].sort()).toEqual(
      [...state.phase2.buildings.keys()].sort(),
    );
    expect(restored.phase2.parcels.get(parcel.id)!.currentUses).toEqual(parcel.currentUses);
    expect(restored.phase2.buildings.get(workshop)!.footprintCells).toEqual(back);

    /** Mantenimiento dirigido al segundo edificio, no al primero. */
    expect(
      dispatchProductCommand(
        restored,
        command("multi-maintenance", "AssignMaintenance", { buildingId: workshop }),
      ).accepted,
    ).toBe(true);
    const technician = [...restored.agents.values()]
      .filter(
        (agent) =>
          agent.organizationId === PLAYER_ORGANIZATION_ID &&
          agent.specialty === "maintenance_technician" &&
          agent.districtId === parcel.districtId &&
          agent.task?.kind === "maintenance",
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0]!;
    expect(technician.task).toEqual({ kind: "maintenance", buildingId: workshop });
    expect(isAdjacentToCells(technician.target!, back)).toBe(true);

    /** Un incidente sobre el segundo no toca al primero. */
    const incidentId = parseIncidentId("incident_00000090");
    restored.phase2.incidents.set(incidentId, {
      id: incidentId,
      buildingId: workshop,
      origin: "sabotage",
      intensity: 40,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: null,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    restored.phase2.buildings.get(workshop)!.state = "burning";
    restored.clock = { ...restored.clock, tick: parseTick(GAME_HOUR_TICKS) };
    for (let tick = 0; tick < GAME_HOUR_TICKS; tick += 1) advanceProductSystems(restored);
    /** El siniestro vive en el edificio elegido; el vecino del mismo solar no se incendia. */
    expect(restored.phase2.buildings.get(housing)!.state).toBe("operational");
    expect(restored.phase2.buildings.get(workshop)!.state).toBe("burning");
    expect(
      [...restored.phase2.incidents.values()].some(
        (incident) => incident.buildingId === workshop && incident.status === "active",
      ),
    ).toBe(true);

    /** La ruina del segundo se limpia sin borrar el primero ni su uso. */
    restored.phase2.buildings.get(workshop)!.state = "ruin";
    reconcileParcelUses(restored, parcel.id);
    expect(restored.phase2.parcels.get(parcel.id)!.currentUses).toEqual(["residential"]);
    restored.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
    expect(
      dispatchProductCommand(
        restored,
        command("multi-clear-ruin", "ClearRuin", { buildingId: workshop }),
      ).accepted,
    ).toBe(true);
    const siteAfterClear = [...restored.phase2.constructionSites.values()].find(
      (entry2) => entry2.kind === "clear_ruin",
    )!;
    siteAfterClear.progress = siteAfterClear.workRequired;
    restored.clock = { ...restored.clock, tick: parseTick(GAME_HOUR_TICKS) };
    advanceProductSystems(restored);
    expect(restored.phase2.buildings.get(workshop)).toBeUndefined();
    expect(restored.phase2.buildings.get(housing)).toBeDefined();
    expect(
      createViewProjection(restored, true).economy!.parcels.find(
        (candidate) => candidate.id === parcel.id,
      )!.buildingIds,
    ).toEqual([housing]);
  });
});

describe("H1-10 D · secuencia completa de permisos", () => {
  it("comprar, solicitar, construir, consumir, reintentar y guardar", () => {
    const state = quietState(92);
    const parcel = state.phase2.parcels.get(parseParcelId("parcel_00000001"))!;
    const role = state.world.districts
      .get(parcel.districtId)!
      .blocks.get(parcel.blockId)?.urbanRole;
    if (role)
      state.phase2.permitting.approvalChanceByRole = {
        ...state.phase2.permitting.approvalChanceByRole,
        [role]: 100,
      };

    expect(
      dispatchProductCommand(state, command("vd-buy", "BuyParcel", { parcelId: parcel.id }))
        .accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("vd-permit", "RequestPermit", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PermitApproved" } });

    const permit = activePermitFor(state, parcel.id, "courtyard_home", state.clock.tick)!;
    expect(permit.id).toBe("permit_00000001");
    expect(permit.consumedAtTick).toBeNull();

    expect(
      dispatchProductCommand(
        state,
        command("vd-build", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    expect(state.phase2.permitting.permitsById[permit.id]).toMatchObject({
      status: "consumed",
      consumedAtTick: state.clock.tick,
    });

    /** Segundo intento en el mismo solar: la obra activa lo bloquea antes de tocar permisos. */
    expect(
      dispatchProductCommand(
        state,
        command("vd-build-again", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "ACTIVE_SITE_ON_PARCEL" });

    /** Sin permiso vigente y sin margen para emitir otro, el permiso consumido no resucita. */
    for (const siteId of [...state.phase2.constructionSites.keys()])
      state.phase2.constructionSites.delete(siteId);
    const other = [...state.phase2.parcels.values()]
      .filter(
        (candidate) =>
          candidate.id !== parcel.id &&
          candidate.disposition === "marketable" &&
          !candidate.ownerOrganizationId,
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0]!;
    other.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const otherRole = state.world.districts
      .get(other.districtId)!
      .blocks.get(other.blockId)!.urbanRole;
    state.phase2.permitting.approvalChanceByRole = {
      ...state.phase2.permitting.approvalChanceByRole,
      [otherRole]: 0,
    };
    expect(
      dispatchProductCommand(
        state,
        command("vd-build-no-permit", "StartConstruction", {
          parcelIds: [other.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "PERMIT_DENIED" });
    expect(state.phase2.permitting.permitsById[permit.id]!.status).toBe("consumed");

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.permitting).toEqual(state.phase2.permitting);
    expect(restored.phase2.idCounters.permit).toBe(state.phase2.idCounters.permit);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
  });
});

describe("H1-10 E · cuadrilla que cruza de distrito", () => {
  it("rechaza mientras no está, viaja por gateway y trabaja con normalidad", () => {
    const state = quietState();
    const home = PLAYER_HOME_DISTRICT_ID;
    const away = state.world.city.districtIds.find((entry) => entry !== home)!;
    const parcel = parcelsWithRoom(state, away)[0]!;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const entry = site(state, parcel, 1, [parcel.anchorCell]);
    const crew = state.phase2.crews.get(parseCrewId("crew_00000001"))!;

    /** Mientras la cuadrilla está en su distrito, la orden se rechaza: nada de teletransporte. */
    expect(
      dispatchProductCommand(
        state,
        command("cross-assign-early", "AssignCrewToWorkOrder", {
          workOrderId: entry.id,
          crewId: crew.id,
        }),
      ),
    ).toEqual({ accepted: false, code: "AGENT_NOT_IN_DISTRICT" });

    /** El traslado es una orden explícita del jugador. */
    expect(
      dispatchProductCommand(
        state,
        command("cross-transfer", "TransferCrew", {
          crewId: crew.id,
          toDistrictId: away,
        }),
      ).accepted,
    ).toBe(true);
    const members = [crew.supervisorAgentId, ...crew.workerAgentIds].map((id) =>
      state.agents.get(id),
    );
    const arriveAtTick = Math.max(
      ...members.map((member) => Number(member?.travel?.arriveAtTick ?? 0)),
    );
    expect(arriveAtTick).toBeGreaterThan(0);

    state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
    /** Se avanza hasta que el viaje haya terminado de verdad, no hasta la frontera del tick. */
    let guard = 0;
    while (
      members.some((member) => member?.travel !== null && member?.travel !== undefined) &&
      guard < arriveAtTick + 200
    ) {
      advanceProductSystems(state);
      guard += 1;
    }
    for (const member of members) {
      expect(member!.districtId).toBe(away);
      expect(member!.travel ?? null).toBeNull();
    }

    /** Ya en el distrito: la asignación acepta y la obra avanza con rutas normales. */
    expect(
      dispatchProductCommand(
        state,
        command("cross-assign-after-arrival", "AssignCrewToWorkOrder", {
          workOrderId: entry.id,
          crewId: crew.id,
        }),
      ).accepted,
    ).toBe(true);
    for (const member of members) expect(member!.target).toBeDefined();

    const before = entry.progress;
    for (let tick = 0; tick < GAME_HOUR_TICKS * 200; tick += 1) advanceProductSystems(state);
    for (const member of members) expect(member!.state).toBe("working");
    expect(entry.progress).toBeGreaterThan(before);
    expect(entry.assignedCrewIds).toEqual([crew.id]);
  });
});
