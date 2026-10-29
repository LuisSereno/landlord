import { describe, expect, it } from "vitest";
import {
  parseAgentId,
  parseBuildingId,
  parseIncidentId,
  parseMoney,
  parseTick,
  type Agent,
  type Building,
  type BuildingId,
  type DistrictId,
  type GridCell,
  type IncidentRecord,
  type Parcel,
} from "@landlord/shared";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { describeHousingStock } from "./housing-market";
import { advanceProductSystems } from "./systems";
import { createInitialState, type GameState } from "./state";

/**
 * H1-01. Desde D-088 la ciudad son nueve mapas que comparten el rango local 0..63: una coordenada
 * `{x,y}` no identifica un lugar, lo identifica el par `districtId + cell`. Estos escenarios fijan
 * que ninguna interacción espacial —vecindad de mercado, incidentes, ondas de choque— cruce de
 * distrito, y que dentro del mismo distrito el comportamiento sigue siendo el de siempre.
 */

const SHARED_CELL: GridCell = { x: 20, y: 20 };

function stateWithTwoDistricts(): {
  state: GameState;
  districtA: DistrictId;
  districtB: DistrictId;
} {
  const state = createInitialState(7);
  const [districtA, districtB] = state.world.city.districtIds;
  if (!districtA || !districtB) throw new Error("La ciudad de prueba necesita dos distritos");
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return { state, districtA, districtB };
}

/** Parcela `index` del distrito, anclada en la coordenada pedida (por defecto la compartida). */
function parcelOf(
  state: GameState,
  districtId: DistrictId,
  index: number,
  cell: GridCell = SHARED_CELL,
): Parcel {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
  const parcel = parcels[index];
  if (!parcel) throw new Error(`El distrito ${districtId} no tiene la parcela ${index}`);
  parcel.anchorCell = { ...cell };
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  return parcel;
}

function addBuilding(state: GameState, parcel: Parcel, serial: number): BuildingId {
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  const building: Building = {
    id,
    parcelId: parcel.id,
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
  };
  state.phase2.buildings.set(id, building);
  return id;
}

function addIncident(state: GameState, buildingId: BuildingId): void {
  const id = parseIncidentId(
    `incident_${String(state.phase2.incidents.size + 1).padStart(8, "0")}`,
  );
  const incident: IncidentRecord = {
    id,
    buildingId,
    origin: "deterioration",
    intensity: 40,
    status: "active",
    targetOrganizationId: PLAYER_ORGANIZATION_ID,
    createdAtTick: parseTick(0),
    causedByAgentId: null,
    causedByOrganizationId: null,
    publiclyAttributedOrganizationId: null,
    casualties: { injured: 0, dead: 0 },
  };
  state.phase2.incidents.set(id, incident);
  const building = state.phase2.buildings.get(buildingId)!;
  building.state = "burning";
}

function addAgent(state: GameState, districtId: DistrictId, serial: number): Agent {
  const id = parseAgentId(`agent_${String(serial).padStart(8, "0")}`);
  const agent: Agent = {
    id,
    districtId,
    cell: { ...SHARED_CELL },
    state: "idle",
    health: 100,
    task: null,
    travel: null,
  };
  state.agents.set(id, agent);
  return agent;
}

function collapseTick(state: GameState): void {
  state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
  advanceProductSystems(state);
}

describe("H1-01 · identidad espacial por distrito", () => {
  it("dos edificios con la misma coordenada en distritos distintos no son vecinos", () => {
    const { state, districtA, districtB } = stateWithTwoDistricts();
    const inA = addBuilding(state, parcelOf(state, districtA, 0), 1);
    const aloneA = describeHousingStock(state).find((unit) => unit.buildingId === inA)!.services;
    const inB = addBuilding(state, parcelOf(state, districtB, 1), 2);
    const stock = describeHousingStock(state);

    /** Cada edificio solo ve los del propio distrito: la vecindad no cambia para ninguno. */
    const { state: soloB } = stateWithTwoDistricts();
    const twinAlone = addBuilding(soloB, parcelOf(soloB, districtB, 1), 2);
    expect(stock.find((unit) => unit.buildingId === inA)!.services).toBe(aloneA);
    expect(stock.find((unit) => unit.buildingId === inB)!.services).toBe(
      describeHousingStock(soloB).find((unit) => unit.buildingId === twinAlone)!.services,
    );

    /** Mismo distrito y coordenada próxima: aquí la vecindad sí cuenta, dos edificios = +20. */
    const { state: sameDistrictState, districtA: sameDistrict } = stateWithTwoDistricts();
    const first = addBuilding(sameDistrictState, parcelOf(sameDistrictState, sameDistrict, 0), 1);
    addBuilding(
      sameDistrictState,
      parcelOf(sameDistrictState, sameDistrict, 1, { x: 21, y: 20 }),
      2,
    );
    expect(
      describeHousingStock(sameDistrictState).find((unit) => unit.buildingId === first)!.services,
    ).toBe(aloneA + 20);
  });

  it("un incidente en un distrito no reduce la seguridad de una vivienda de otro", () => {
    const { state, districtA, districtB } = stateWithTwoDistricts();
    const inA = addBuilding(state, parcelOf(state, districtA, 0), 1);
    const inB = addBuilding(state, parcelOf(state, districtB, 1), 2);
    const before = describeHousingStock(state).find((unit) => unit.buildingId === inB)!.safety;

    addIncident(state, inA);
    const after = describeHousingStock(state).find((unit) => unit.buildingId === inB)!.safety;
    expect(after).toBe(before);
  });

  it("un incidente en el mismo distrito sí reduce la seguridad vecina", () => {
    const { state, districtA } = stateWithTwoDistricts();
    const inA = addBuilding(state, parcelOf(state, districtA, 0), 1);
    const neighbour = addBuilding(state, parcelOf(state, districtA, 1), 2);
    const before = describeHousingStock(state).find(
      (unit) => unit.buildingId === neighbour,
    )!.safety;

    addIncident(state, inA);
    const after = describeHousingStock(state).find((unit) => unit.buildingId === neighbour)!.safety;
    expect(after).toBeLessThan(before);
  });

  it("una explosión no daña el edificio gemelo de otro distrito", () => {
    const { state, districtA, districtB } = stateWithTwoDistricts();
    const root = addBuilding(state, parcelOf(state, districtA, 0), 1);
    const twin = addBuilding(state, parcelOf(state, districtB, 1), 2);
    state.phase2.buildings.get(root)!.state = "collapse_pending";

    collapseTick(state);

    const survivor = state.phase2.buildings.get(twin)!;
    expect(survivor.state).toBe("operational");
    expect(survivor.structuralIntegrity).toBe(100);
  });

  it("una explosión no hiere a un agente del otro distrito con la misma coordenada", () => {
    const { state, districtA, districtB } = stateWithTwoDistricts();
    const root = addBuilding(state, parcelOf(state, districtA, 0), 1);
    state.phase2.buildings.get(root)!.state = "collapse_pending";
    const bystander = addAgent(state, districtB, 9);

    collapseTick(state);

    expect(bystander.health).toBe(100);
    expect(bystander.state).toBe("idle");
  });

  it("dentro del mismo distrito la onda de choque sigue golpeando agentes y edificios", () => {
    const { state, districtA } = stateWithTwoDistricts();
    const root = addBuilding(state, parcelOf(state, districtA, 0), 1);
    const neighbour = addBuilding(state, parcelOf(state, districtA, 1, { x: 21, y: 20 }), 2);
    const bystander = addAgent(state, districtA, 9);
    state.phase2.buildings.get(root)!.state = "collapse_pending";

    collapseTick(state);

    expect(bystander.state).toBe("injured");
    expect(state.phase2.buildings.get(neighbour)!.state).not.toBe("operational");
  });
});
