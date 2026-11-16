import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parsePersonId,
  parseTick,
  type BuildingId,
  type ProductCommand,
} from "@landlord/shared";
import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/**
 * V.d-UX.S · S0.5: audit limitado de referencias VIVAS indexadas por `buildingId` al desaparecer
 * el edificio. Se corrigen el backlog de mantenimiento huérfano y la tarea del técnico colgada;
 * se conserva toda referencia histórica deliberada (claims, incidentes, transacciones).
 */

const actor = parsePersonId("person_00000001");
const organization = PLAYER_ORGANIZATION_ID as ProductCommand["actingAsOrganizationId"];

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: organization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

/** Estado quieto: ni rival ni delegación actúan, para que el único ruido sea el caso probado. */
function quietState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

/**
 * Edificio autorado en el distrito del jugador, con id fuera del rango del contador del motor para
 * que ninguna obra nueva de la carrera pueda reutilizarlo y sobrescribir el fixture.
 */
function authorBuilding(state: GameState, ordinal: number): BuildingId {
  const serial = 9100 + ordinal;
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  state.phase2.idCounters.building = Math.max(state.phase2.idCounters.building, serial);
  const parcel = [...state.phase2.parcels.values()]
    .filter(
      (entry) =>
        entry.disposition === "marketable" &&
        !entry.ownerOrganizationId &&
        entry.districtId === PLAYER_HOME_DISTRICT_ID,
    )
    .sort((a, b) => a.id.localeCompare(b.id))[ordinal - 1]!;
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  state.phase2.buildings.set(id, {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: [{ ...parcel.anchorCell }],
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  });
  return id;
}

function advanceHours(state: GameState, hours: number): void {
  for (let tick = 0; tick < hours * GAME_HOUR_TICKS + 1; tick += 1) advanceProductSystems(state);
}

function technicianOf(state: GameState) {
  const agent = [...state.agents.values()]
    .filter(
      (entry) =>
        entry.organizationId === PLAYER_ORGANIZATION_ID &&
        entry.districtId === PLAYER_HOME_DISTRICT_ID &&
        entry.specialty === "maintenance_technician",
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  expect(agent, "técnico de mantenimiento del jugador").toBeDefined();
  return agent!;
}

function assignMaintenance(state: GameState, id: BuildingId, label: string): void {
  const result = dispatchProductCommand(
    state,
    command(label, "AssignMaintenance", { buildingId: id }),
  );
  expect(result.accepted, JSON.stringify(result)).toBe(true);
}

function collapseByFire(state: GameState, id: BuildingId): void {
  const building = state.phase2.buildings.get(id)!;
  building.structuralIntegrity = 1;
  const incidentId = parseIncidentId("incident_00000092");
  state.phase2.incidents.set(incidentId, {
    id: incidentId,
    buildingId: id,
    origin: "deterioration",
    intensity: 60,
    status: "active",
    targetOrganizationId: PLAYER_ORGANIZATION_ID,
    createdAtTick: state.clock.tick,
    causedByAgentId: null,
    causedByOrganizationId: null,
    publiclyAttributedOrganizationId: null,
    casualties: { injured: 0, dead: 0 },
  });
  building.state = "burning";
  for (let hour = 0; hour < 12; hour += 1) {
    advanceHours(state, 1);
    if (state.phase2.buildings.get(id)?.state === "ruin") return;
  }
  throw new Error("el edificio no llegó a ruina en 12 horas de juego");
}

function clearRuin(state: GameState, id: BuildingId, label: string): void {
  const result = dispatchProductCommand(state, command(label, "ClearRuin", { buildingId: id }));
  expect(result.accepted, JSON.stringify(result)).toBe(true);
  const site = [...state.phase2.constructionSites.values()].find(
    (entry) => entry.kind === "clear_ruin" && entry.targetBuildingId === id,
  )!;
  site.progress = site.workRequired;
  advanceHours(state, 1);
  expect(state.phase2.buildings.has(id)).toBe(false);
}

describe("V.d-UX.S · referencias vivas por edificio al desaparecer el inmueble", () => {
  it("libera al técnico cuando su edificio pasa a ruina y vuelve a ser asignable", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    const other = authorBuilding(state, 2);
    assignMaintenance(state, target, "ruin-assign");
    const technician = technicianOf(state);
    expect(technician.task).toEqual({ kind: "maintenance", buildingId: target });
    advanceHours(state, 2);
    state.phase2.buildings.get(target)!.state = "ruin";
    advanceHours(state, 1);
    expect(technician.task).toBeNull();
    expect(technician.state).toBe("idle");
    /** El recurso operativo se recupera: puede destinarse a otro edificio. */
    assignMaintenance(state, other, "ruin-reassign");
    expect(technician.task).toEqual({ kind: "maintenance", buildingId: other });
  });

  it("tras un colapso real ningún técnico conserva una tarea sobre la ruina", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    assignMaintenance(state, target, "collapse-assign");
    const technician = technicianOf(state);
    advanceHours(state, 2);
    collapseByFire(state, target);
    /**
     * El técnico está junto a la huella, así que la onda expansiva puede herirlo: en ese caso
     * `hurtAgent` ya limpia la tarea. Lo que se exige es que no quede referencia colgada, y que
     * quien siga sano vuelva a idle.
     */
    expect(technician.task).toBeNull();
    if (technician.state !== "injured" && technician.state !== "dead")
      expect(technician.state).toBe("idle");
  });

  it("libera al técnico y borra el backlog en el mismo tick del desescombro", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    state.phase2.maintenance.backlogByBuildingId[target] = parseMoney(450);
    assignMaintenance(state, target, "clear-assign");
    const technician = technicianOf(state);
    advanceHours(state, 2);
    state.phase2.buildings.get(target)!.state = "ruin";
    advanceHours(state, 1);
    expect(technician.task).toBeNull();
    clearRuin(state, target, "clear-run");
    expect(state.phase2.maintenance.backlogByBuildingId[target]).toBeUndefined();
    expect(technician.task).toBeNull();
    expect(technician.state).toBe("idle");
  });

  it("el backlog huérfano no infla la deuda agregada, pero se elimina del estado", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    const survivor = authorBuilding(state, 2);
    state.phase2.maintenance.backlogByBuildingId[target] = parseMoney(450);
    state.phase2.maintenance.backlogByBuildingId[survivor] = parseMoney(120);
    const before = createViewProjection(state, true).economy?.maintenance.backlog;
    expect(before).toBe(570);
    state.phase2.buildings.get(target)!.state = "ruin";
    clearRuin(state, target, "backlog-clear");
    expect(state.phase2.maintenance.backlogByBuildingId[target]).toBeUndefined();
    expect(state.phase2.maintenance.backlogByBuildingId[survivor]).toBe(120);
    expect(createViewProjection(state, true).economy?.maintenance.backlog).toBe(120);
  });

  it("sana una tarea colgada heredada de una partida guardada", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    assignMaintenance(state, target, "legacy-assign");
    const technician = technicianOf(state);
    /** Save con la referencia ya colgada: el edificio desapareció sin liberar la tarea. */
    state.phase2.buildings.delete(target);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    const legacy = [...restored.agents.values()].find((entry) => entry.id === technician.id)!;
    expect(legacy.task).toEqual({ kind: "maintenance", buildingId: target });
    advanceHours(restored, 1);
    expect(legacy.task).toBeNull();
    expect(legacy.state).toBe("idle");
  });

  it("conserva las referencias históricas deliberadas al desescombrar", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    collapseByFire(state, target);
    const incidentsBefore = [...state.phase2.incidents.values()].filter(
      (entry) => entry.buildingId === target,
    );
    const transactionsBefore = state.phase2.transactions.filter(
      (entry) => entry.referenceId === target,
    );
    expect(incidentsBefore.length).toBeGreaterThan(0);
    clearRuin(state, target, "history-clear");
    expect(
      [...state.phase2.incidents.values()].filter((entry) => entry.buildingId === target),
    ).toEqual(incidentsBefore);
    expect(state.phase2.transactions.filter((entry) => entry.referenceId === target)).toEqual(
      transactionsBefore,
    );
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
  });

  it("no libera al técnico de otro edificio ni toca tareas que no son de mantenimiento", () => {
    const state = quietState();
    const target = authorBuilding(state, 1);
    const survivor = authorBuilding(state, 2);
    assignMaintenance(state, survivor, "survivor-assign");
    const technician = technicianOf(state);
    state.phase2.buildings.get(target)!.state = "ruin";
    advanceHours(state, 1);
    expect(technician.task).toEqual({ kind: "maintenance", buildingId: survivor });
    clearRuin(state, target, "isolation-clear");
    expect(technician.task).toEqual({ kind: "maintenance", buildingId: survivor });
  });
});