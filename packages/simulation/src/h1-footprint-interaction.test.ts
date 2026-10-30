import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseCrewId,
  parseIncidentId,
  parsePersonId,
  parseTick,
  type Building,
  type ConstructionSite,
  type DistrictId,
  type GridCell,
  type Parcel,
  type ProductCommand,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID, RIVAL_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import {
  buildDistrictObstacleIndex,
  districtObstacles,
  interactionCellCandidates,
  isAdjacentToCells,
} from "./district-obstacles";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID, RIVAL_ORGANIZATION_ID } from "./game-data";
import { findDeterministicPath } from "./navigation";
import { advanceProductSystems } from "./systems";
import { createInitialState, districtMapOf, type GameState } from "./state";

/**
 * H1-02. La ciudad ya tiene parcelas multi-celda, varios edificios por parcela y obras con huella
 * propia, pero la capa táctica seguía modelando un edificio como el `anchorCell` de su parcela.
 * Estos escenarios fijan que lo físico manda: obstáculos por distrito, huella como objetivo y una
 * celda de interacción canónica que nunca deja a un operario dentro de un edificio.
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

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/**
 * Parcela del distrito del jugador con suficiente profundidad para colocar una huella lejos del
 * ancla: si la acción sigue acertando con el ancla a más de tres celdas, es que mira lo físico.
 */
function deepParcel(state: GameState, index: number): Parcel {
  const parcels = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.districtId === PLAYER_HOME_DISTRICT_ID &&
        parcel.disposition === "marketable" &&
        parcel.cells.some((cell) => manhattan(cell, parcel.anchorCell) >= 4),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const parcel = parcels[index];
  if (!parcel) throw new Error(`Sin parcela profunda nº ${index} en el distrito del jugador`);
  return parcel;
}

/** Celda propia de la parcela a distancia máxima del ancla (el fondo del solar). */
function backCell(parcel: Parcel): GridCell {
  return [...parcel.cells]
    .sort(
      (left, right) =>
        manhattan(right, parcel.anchorCell) - manhattan(left, parcel.anchorCell) ||
        left.x - right.x ||
        left.y - right.y,
    )
    .map((cell) => ({ ...cell }))[0]!;
}

function addBuilding(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
  ownerOrganizationId = PLAYER_ORGANIZATION_ID,
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
    ownerOrganizationId,
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
  };
  state.phase2.buildings.set(id, building);
  return id;
}

function addSite(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
): ConstructionSite["id"] {
  const id = parseConstructionSiteId(`site_${String(serial).padStart(8, "0")}`);
  const site: ConstructionSite = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    buildingType: "courtyard_home",
    footprintCells: footprintCells.map((cell) => ({ ...cell })),
    orientation: 0,
    floors: 1,
    form: "detached",
    progress: 0,
    workRequired: 40,
    resourcesReserved: { cement: 1, brick: 1, steel: 0 },
    crewCapacity: 0,
    upgradeBuildingId: null,
    repairBuildingId: null,
    kind: "construction",
    targetBuildingId: null,
    assignedCrewIds: [],
    assignedTechnicianId: null,
  };
  state.phase2.constructionSites.set(id, site);
  return id;
}

function agentOf(specialty: "maintenance_technician" | "enforcer", state: GameState) {
  const agent = [...state.agents.values()]
    .filter(
      (entry) =>
        entry.organizationId === PLAYER_ORGANIZATION_ID &&
        entry.districtId === PLAYER_HOME_DISTRICT_ID &&
        entry.specialty === specialty,
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!agent) throw new Error(`Sin ${specialty} en el distrito del jugador`);
  return agent;
}

/** Estado quieto: ni rival ni delegación actúan, para que el único ruido sea el caso probado. */
function quietState(): GameState {
  const state = createInitialState(7);
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function hourTick(state: GameState): void {
  state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
  advanceProductSystems(state);
}

function addBurningIncident(state: GameState, buildingId: Building["id"], intensity: number): void {
  const id = parseIncidentId(
    `incident_${String(state.phase2.incidents.size + 1).padStart(8, "0")}`,
  );
  state.phase2.incidents.set(id, {
    id,
    buildingId,
    origin: "deterioration",
    intensity,
    status: "active",
    targetOrganizationId: PLAYER_ORGANIZATION_ID,
    createdAtTick: parseTick(0),
    causedByAgentId: null,
    causedByOrganizationId: null,
    publiclyAttributedOrganizationId: null,
    casualties: { injured: 0, dead: 0 },
  });
  state.phase2.buildings.get(buildingId)!.state = "burning";
}

/** Celda libre en ambos distritos y sin edificio alguno: el gemelo local está garantizado vacío. */
function freeSharedCell(state: GameState, left: DistrictId, right: DistrictId): GridCell {
  const leftMap = districtMapOf(state, left);
  const rightMap = districtMapOf(state, right);
  const taken = new Set<string>();
  for (const building of state.phase2.buildings.values())
    for (const cell of building.footprintCells) taken.add(cellKey(cell));
  for (let y = 0; y < leftMap.height; y += 1) {
    for (let x = 0; x < leftMap.width; x += 1) {
      const key = `${String(x)}:${String(y)}`;
      if (leftMap.blockedCells.has(key) || rightMap.blockedCells.has(key) || taken.has(key))
        continue;
      return { x, y };
    }
  }
  throw new Error("Sin celda compartida libre");
}

describe("H1-02 · la huella física manda en la capa táctica", () => {
  it("los obstáculos físicos sólo se derivan dentro de su distrito", () => {
    const state = quietState();
    const cell = freeSharedCell(state, PLAYER_HOME_DISTRICT_ID, RIVAL_HOME_DISTRICT_ID);
    const parcel = deepParcel(state, 0);
    addBuilding(state, parcel, 1, [cell]);

    const obstacles = districtObstacles(state, PLAYER_HOME_DISTRICT_ID);
    const otherObstacles = districtObstacles(state, RIVAL_HOME_DISTRICT_ID);

    expect(obstacles.occupied.has(cellKey(cell))).toBe(true);
    expect(otherObstacles.occupied.has(cellKey(cell))).toBe(false);
    /** El terreno bloqueado del propio mapa siempre queda impracticable. */
    for (const key of districtMapOf(state, PLAYER_HOME_DISTRICT_ID).blockedCells)
      expect(obstacles.impassable.has(key)).toBe(true);
  });

  it("el objetivo de mantenimiento es adyacente a la huella y nunca cae dentro de un edificio", () => {
    const state = quietState();
    const parcel = deepParcel(state, 1);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    /** La huella construida está en el fondo del solar: el ancla no forma parte de ella. */
    const far = backCell(parcel);
    const footprint = [far];
    expect(manhattan(far, parcel.anchorCell)).toBeGreaterThanOrEqual(4);
    const buildingId = addBuilding(state, parcel, 1, footprint);

    expect(
      dispatchProductCommand(
        state,
        command("footprint-maintenance", "AssignMaintenance", { buildingId }),
      ).accepted,
    ).toBe(true);

    const technician = agentOf("maintenance_technician", state);
    const obstacles = districtObstacles(state, PLAYER_HOME_DISTRICT_ID);
    const target = technician.target!;
    expect(isAdjacentToCells(target, footprint)).toBe(true);
    expect(obstacles.occupied.has(cellKey(target))).toBe(false);
    /** El ancla ya no es el edificio: ningún destino puede justificarse por estar junto a ella. */
    expect(isAdjacentToCells(target, [parcel.anchorCell])).toBe(false);
    /** Ningún paso de la ruta pisa una huella del distrito. */
    for (const step of technician.path ?? [])
      expect(obstacles.occupied.has(cellKey(step))).toBe(false);
  });

  it("con dos edificios en la misma parcela cada acción va al edificio correcto", () => {
    const build = (targetBack: boolean) => {
      const state = quietState();
      const parcel = deepParcel(state, 2);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      const front = [{ ...parcel.anchorCell }];
      const back = [backCell(parcel)];
      const frontId = addBuilding(state, parcel, 1, front);
      const backId = addBuilding(state, parcel, 2, back);
      const buildingId = targetBack ? backId : frontId;
      expect(
        dispatchProductCommand(
          state,
          command(`footprint-two-${String(targetBack)}`, "AssignMaintenance", { buildingId }),
        ).accepted,
      ).toBe(true);
      return { target: agentOf("maintenance_technician", state).target!, front, back };
    };

    const onBack = build(true);
    expect(isAdjacentToCells(onBack.target, onBack.back)).toBe(true);
    expect(isAdjacentToCells(onBack.target, onBack.front)).toBe(false);

    const onFront = build(false);
    expect(isAdjacentToCells(onFront.target, onFront.front)).toBe(true);
    expect(isAdjacentToCells(onFront.target, onFront.back)).toBe(false);
  });

  it("una obra activa es obstáculo y su objetivo respeta su huella", () => {
    const state = quietState();
    const parcel = deepParcel(state, 3);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const siteFootprint = [backCell(parcel)];
    const siteId = addSite(state, parcel, 1, siteFootprint);

    const obstacles = districtObstacles(state, PLAYER_HOME_DISTRICT_ID);
    expect(obstacles.occupied.has(cellKey(siteFootprint[0]!))).toBe(true);

    const crew = state.phase2.crews.get(parseCrewId("crew_00000001"))!;
    expect(
      dispatchProductCommand(
        state,
        command("footprint-crew", "AssignCrewToWorkOrder", {
          workOrderId: siteId,
          crewId: crew.id,
        }),
      ).accepted,
    ).toBe(true);

    for (const agentId of [crew.supervisorAgentId, ...crew.workerAgentIds]) {
      const member = state.agents.get(agentId)!;
      expect(isAdjacentToCells(member.target!, siteFootprint)).toBe(true);
      expect(obstacles.occupied.has(cellKey(member.target!))).toBe(false);
      for (const step of member.path ?? [])
        expect(obstacles.occupied.has(cellKey(step))).toBe(false);
    }
  });

  it("reordenar los Maps no cambia el objetivo ni el técnico elegido", () => {
    const build = (reverse: boolean) => {
      const state = quietState();
      const parcel = deepParcel(state, 4);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      const buildingId = addBuilding(state, parcel, 1, [parcel.anchorCell]);
      addBuilding(state, parcel, 2, [backCell(parcel)]);
      if (reverse) {
        const buildings = [...state.phase2.buildings.entries()].reverse();
        state.phase2.buildings.clear();
        for (const [id, building] of buildings) state.phase2.buildings.set(id, building);
        const agents = [...state.agents.entries()].reverse();
        state.agents.clear();
        for (const [id, agent] of agents) state.agents.set(id, agent);
      }
      expect(
        dispatchProductCommand(
          state,
          command("footprint-order-free", "AssignMaintenance", { buildingId }),
        ).accepted,
      ).toBe(true);
      const technician = agentOf("maintenance_technician", state);
      return { target: technician.target, agentId: technician.id };
    };

    expect(build(false)).toEqual(build(true));
  });

  it("el sabotaje se resuelve junto a la huella: estar junto al ancla ya no basta", () => {
    const state = quietState();
    const parcel = deepParcel(state, 5);
    const far = backCell(parcel);
    const buildingId = addBuilding(state, parcel, 1, [far], RIVAL_ORGANIZATION_ID);
    const enforcer = agentOf("enforcer", state);
    enforcer.task = { kind: "sabotage_building", targetBuildingId: buildingId };
    enforcer.cooldownUntilTick = parseTick(0);
    /** De pie junto al ancla, sin alcanzar la huella: la orden no puede consumarse. */
    enforcer.cell = { x: parcel.anchorCell.x + 1, y: parcel.anchorCell.y };
    enforcer.target = { ...enforcer.cell };
    enforcer.path = [];

    hourTick(state);

    expect(state.phase2.incidents.size).toBe(0);

    enforcer.cell = { x: far.x + 1, y: far.y };
    enforcer.target = { ...enforcer.cell };
    enforcer.path = [];
    enforcer.cooldownUntilTick = parseTick(0);
    hourTick(state);

    expect([...state.phase2.incidents.values()][0]?.buildingId).toBe(buildingId);
  });

  it("un técnico sólo apaga el fuego si está junto a la huella del edificio", () => {
    const runWith = (cell: (parcel: Parcel) => GridCell): "resolved" | "active" => {
      const state = quietState();
      const parcel = deepParcel(state, 6);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      const buildingId = addBuilding(state, parcel, 1, [backCell(parcel)]);
      addBurningIncident(state, buildingId, 35);
      const technician = agentOf("maintenance_technician", state);
      technician.cell = cell(parcel);
      technician.target = { ...technician.cell };
      technician.path = [];
      technician.state = "working";
      technician.task = { kind: "maintenance", buildingId };
      hourTick(state);
      return [...state.phase2.incidents.values()][0]!.status;
    };

    expect(runWith((parcel) => ({ x: parcel.anchorCell.x + 1, y: parcel.anchorCell.y }))).toBe(
      "active",
    );
    expect(
      runWith((parcel) => {
        const far = backCell(parcel);
        return { x: far.x + 1, y: far.y };
      }),
    ).toBe("resolved");
  });

  it("los candidatos de interacción siguen un orden canónico estable", () => {
    const state = quietState();
    const parcel = deepParcel(state, 7);
    const footprint = [backCell(parcel), { x: parcel.anchorCell.x, y: parcel.anchorCell.y }];
    addBuilding(state, parcel, 1, footprint);
    const obstacles = districtObstacles(state, PLAYER_HOME_DISTRICT_ID);
    const map = districtMapOf(state, PLAYER_HOME_DISTRICT_ID);

    expect(interactionCellCandidates(footprint, obstacles, map.width, map.height)).toEqual(
      interactionCellCandidates([...footprint].reverse(), obstacles, map.width, map.height),
    );
    expect(
      interactionCellCandidates(footprint, obstacles, map.width, map.height).length,
    ).toBeGreaterThan(0);

    /** La derivación individual y el índice de los nueve distritos coinciden. */
    const index = buildDistrictObstacleIndex(state).get(PLAYER_HOME_DISTRICT_ID)!;
    expect([...index.occupied].sort()).toEqual([...obstacles.occupied].sort());

    /** Ninguna celda de la huella propia puede ser destino: el operario no entra en el edificio. */
    for (const candidate of interactionCellCandidates(footprint, obstacles, map.width, map.height))
      expect(obstacles.occupied.has(cellKey(candidate))).toBe(false);

    /** Y la ruta respeta la huella de un vecino construido sobre el corredor directo. */
    const reachable = findDeterministicPath(
      agentOf("maintenance_technician", state).cell,
      interactionCellCandidates(footprint, obstacles, map.width, map.height)[0]!,
      obstacles.impassable,
    );
    for (const step of reachable) expect(obstacles.occupied.has(cellKey(step))).toBe(false);
  });
});
