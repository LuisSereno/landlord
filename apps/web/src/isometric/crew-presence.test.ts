import {
  parseCommandId,
  parseCrewId,
  parseMoney,
  parseOrganizationId,
  parsePersonId,
  parseRuntimeAssetManifest,
  parseTick,
} from "@landlord/shared";
import {
  createViewProjection,
  dispatchProductCommand,
  SimulationWorkerRuntime,
} from "@landlord/simulation";
import { describe, expect, it } from "vitest";

import BLENDER from "../generated/runtime-assets-blender.json";
import type { AgentId, ViewProjectionV2 } from "@landlord/shared";
import {
  agentWorksAtSiteFootprint,
  CREW_CHARACTER,
  crewAnimationSlot,
  crewAnimationFrameKey,
  crewMembersBySite,
  crewRenderCell,
  crewSpriteKey,
  crewSpriteObservations,
  crewStepDirection,
  crewStepProgress,
  crewWalkPlan,
  GRID_DELTA_TO_DIRECTION,
  siteWorkingCells,
  type CrewSpriteObservation,
} from "./crew-presence";

const MANIFEST = parseRuntimeAssetManifest(BLENDER);
const ORG = parseOrganizationId("org_00000001");

/**
 * Partida real con una obra y una cuadrilla asignada por el camino de comandos del worker. El
 * estado inicial no tiene obras, así que el fixture compra una parcela vacía, la financia y fuerza
 * el permiso del rol a 100: lo único que se quiere medir aquí es el paseo, no la suerte del permit.
 */
function assignedCrewRuntime() {
  const runtime = new SimulationWorkerRuntime();
  runtime.handle({
    protocolVersion: 2,
    requestId: "req_initialize",
    type: "InitializeGame",
    payload: { seed: 7 },
  });
  const state = runtime.getState()!;
  const economy = createViewProjection(state, true).economy!;
  const option = economy.constructionOptions.find((entry) => !entry.municipal)!;
  const parcelView = economy.parcels.find(
    (parcel) =>
      parcel.disposition === "marketable" &&
      parcel.ownerOrganizationId === null &&
      parcel.allowedUses.some((use) => option.allowedUses.includes(use)),
  )!;
  const parcel = state.phase2.parcels.get(parcelView.id)!;
  parcel.ownerOrganizationId = ORG;
  state.phase2.balances.set(ORG, parseMoney(1_000_000));
  const inventory = state.phase2.inventories.get(ORG)!;
  inventory.cement = 1_000;
  inventory.brick = 1_000;
  inventory.steel = 1_000;
  const role = state.world.districts.get(parcel.districtId)?.blocks.get(parcel.blockId)?.urbanRole;
  if (role) {
    state.phase2.permitting.approvalChanceByRole = {
      ...state.phase2.permitting.approvalChanceByRole,
      [role]: 100,
    };
  }
  const started = dispatchProductCommand(state, {
    commandId: parseCommandId("cmd_00000001"),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: ORG,
    type: "StartConstruction",
    payload: { parcelIds: [parcel.id], buildingType: option.type },
  });
  expect(started.accepted, `StartConstruction: ${JSON.stringify(started)}`).toBe(true);
  const site = [...state.phase2.constructionSites.values()][0]!;
  const crew = [...state.phase2.crews.values()].find((entry) => entry.organizationId === ORG)!;
  const assigned = dispatchProductCommand(state, {
    commandId: parseCommandId("cmd_00000002"),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: ORG,
    type: "AssignCrewToWorkOrder",
    payload: { crewId: crew.id, workOrderId: site.id },
  });
  expect(assigned.accepted, `AssignCrewToWorkOrder: ${JSON.stringify(assigned)}`).toBe(true);
  return { runtime, state, crew, site };
}

describe("V.k.2 · lectura pura de cuadrillas", () => {
  it("la zona de obra es la huella más sus cuatro vecinas, sin diagonales", () => {
    const footprint = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];
    expect(siteWorkingCells(footprint).size).toBe(8);
    for (const cell of [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 3 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]) {
      expect(agentWorksAtSiteFootprint(cell, footprint), `${cell.x},${cell.y}`).toBe(true);
    }
    expect(agentWorksAtSiteFootprint({ x: 1, y: 1 }, footprint)).toBe(false);
    expect(agentWorksAtSiteFootprint({ x: 5, y: 2 }, footprint)).toBe(false);
  });

  it("crewMembersBySite cruza sitios y cuadrillas y salta ids que no existen", () => {
    const { state, crew, site } = assignedCrewRuntime();
    const economy = createViewProjection(state, true).economy!;
    const rows = crewMembersBySite(economy);
    const row = rows.find((entry) => entry.crew.id === crew.id);
    expect(row, "la cuadrilla asignada debe aparecer").toBeTruthy();
    expect(row!.site.id).toBe(site.id);
    expect(row!.agentIds).toEqual([crew.supervisorAgentId, ...crew.workerAgentIds]);

    const withGhost = {
      ...economy,
      constructionSites: economy.constructionSites.map((entry) =>
        entry.id === site.id
          ? { ...entry, assignedCrewIds: [...entry.assignedCrewIds, parseCrewId("crew_00009999")] }
          : entry,
      ),
    };
    const ghostRows = crewMembersBySite(withGhost);
    expect(ghostRows.map((entry) => entry.crew.id)).toEqual(rows.map((entry) => entry.crew.id));
    expect(ghostRows.map((entry) => entry.agentIds)).toEqual(rows.map((entry) => entry.agentIds));
  });

  it("la tabla de rumbos tiene cuatro entradas y sólo cubre pasos 4-adyacentes", () => {
    expect(Object.keys(GRID_DELTA_TO_DIRECTION)).toHaveLength(4);
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 5, y: 4 })).toBe(GRID_DELTA_TO_DIRECTION["1,0"]);
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 4, y: 5 })).toBe(GRID_DELTA_TO_DIRECTION["0,1"]);
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 3, y: 4 })).toBe(GRID_DELTA_TO_DIRECTION["-1,0"]);
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 4, y: 3 })).toBe(GRID_DELTA_TO_DIRECTION["0,-1"]);
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 5, y: 5 })).toBeNull();
    expect(crewStepDirection({ x: 4, y: 4 }, { x: 4, y: 4 })).toBeNull();
  });

  it("crewWalkPlan camina con paso autoritativo y posa idle conservando el rumbo de llegada", () => {
    const walking = crewWalkPlan({
      previousCell: { x: 3, y: 4 },
      cell: { x: 4, y: 4 },
      nextCell: { x: 5, y: 4 },
      agentState: "moving",
      atSite: false,
    });
    expect(walking.animation).toBe("walk");
    expect(walking.moving).toBe(true);
    expect(walking.direction).toBe(GRID_DELTA_TO_DIRECTION["1,0"]);
    expect(walking.visualState).toBe("travelling");

    const arrived = crewWalkPlan({
      previousCell: { x: 3, y: 4 },
      cell: { x: 4, y: 4 },
      nextCell: null,
      agentState: "idle",
      atSite: true,
    });
    expect(arrived.animation).toBe("idle");
    expect(arrived.moving).toBe(false);
    expect(arrived.direction).toBe(GRID_DELTA_TO_DIRECTION["1,0"]);
    expect(arrived.visualState).toBe("on-site");

    const working = crewWalkPlan({
      previousCell: null,
      cell: { x: 4, y: 4 },
      nextCell: null,
      agentState: "working",
      atSite: true,
    });
    expect(working.visualState).toBe("working");
    expect(working.direction).toBe(0);
  });

  it("crewAnimationSlot alterna las poses por la duración publicada, no por tick", () => {
    expect(crewAnimationSlot(0, 180, 2)).toBe(0);
    expect(crewAnimationSlot(179, 180, 2)).toBe(0);
    expect(crewAnimationSlot(180, 180, 2)).toBe(1);
    expect(crewAnimationSlot(359, 180, 2)).toBe(1);
    expect(crewAnimationSlot(360, 180, 2)).toBe(0);
    expect(crewAnimationSlot(399, 400, 2)).toBe(0);
    expect(crewAnimationSlot(400, 400, 2)).toBe(1);
    expect(crewAnimationSlot(-50, 180, 2)).toBe(0);
    expect(crewAnimationSlot(900, 180, 0)).toBe(0);
  });

  it("el manifiesto publica la cadencia de clip que el reloj de cuadrillas consume", () => {
    const worker = MANIFEST.characters.chr_worker!;
    expect(worker.animations.idle.frameDurationMs).toBe(400);
    expect(worker.animations.walk.frameDurationMs).toBe(180);
    expect(worker.directions).toBe(4);
    expect(worker.animations.idle.frames).toHaveLength(8);
    expect(worker.animations.walk.frames).toHaveLength(8);
  });

  it("crewSpriteKey valida contra el manifiesto y falla cerrado ante una referencia rota", () => {
    expect(crewSpriteKey(MANIFEST, "chr_worker", "walk", 1, 0)).toBe(
      "blender-character-chr_worker-walk-d1-0",
    );
    expect(() => crewSpriteKey(MANIFEST, "chr_inexistente", "walk", 0, 0)).toThrow(/manifiesto/);
    expect(() => crewSpriteKey(MANIFEST, "chr_worker", "walk", 4, 0)).toThrow(/direction/);
    expect(() => crewSpriteKey(MANIFEST, "chr_worker", "walk", -1, 0)).toThrow(/direction/);
    expect(() => crewSpriteKey(MANIFEST, "chr_worker", "walk", 0, 2)).toThrow(/slot/);
    expect(() => crewSpriteKey(MANIFEST, "chr_worker", "walk", 0, -1)).toThrow(/slot/);
  });

  it("cada paso que da el motor de verdad es 4-adyacente y la tabla de rumbos lo cubre", () => {
    const { runtime, crew } = assignedCrewRuntime();
    const cells: Array<{ x: number; y: number }> = [];
    for (let sample = 0; sample < 5; sample += 1) {
      if (sample > 0) runtime.advanceTicks(10);
      const agent = runtime.getState()!.agents.get(crew.supervisorAgentId)!;
      cells.push({ ...agent.cell });
    }
    const deltas = cells
      .slice(1)
      .map((cell, index) => `${cell.x - cells[index]!.x},${cell.y - cells[index]!.y}`)
      .filter((delta) => delta !== "0,0");
    expect(deltas.length, "el supervisor debe haber caminado").toBeGreaterThanOrEqual(2);
    for (const delta of deltas) {
      expect(GRID_DELTA_TO_DIRECTION[delta], `paso real del motor: ${delta}`).toBeDefined();
    }
  });
});

/** La proyección se muta sólo para fijar el instante que se quiere observar. */
function withAgents(
  projection: ViewProjectionV2,
  patch: (agent: ViewProjectionV2["agents"][number]) => ViewProjectionV2["agents"][number],
): ViewProjectionV2 {
  return { ...projection, agents: projection.agents.map(patch) };
}

describe("V.k.3 · observaciones para el pool de sprites", () => {
  it("la fase del tramo arranca en el tick que sigue al paso, no en el del paso", () => {
    expect(crewStepProgress(1, 10)).toBe(0);
    expect(crewStepProgress(2, 10)).toBeCloseTo(0.1, 10);
    expect(crewStepProgress(10, 10)).toBeCloseTo(0.9, 10);
    /** Con `tick % ticksPerCell` el tick 11 daría 0,1: el agente rebobinaría al cambiar de celda. */
    expect(crewStepProgress(11, 10)).toBe(0);
    const phases = Array.from({ length: 11 }, (_unused, index) => crewStepProgress(index + 1, 10));
    expect(phases.slice(0, 10)).toEqual(phases.slice(0, 10).sort((left, right) => left - right));
    expect(phases[10]).toBeLessThan(phases[9]!);
    expect(crewStepProgress(0, 10)).toBeGreaterThanOrEqual(0);
    expect(crewStepProgress(7, 0)).toBe(0);
    expect(crewStepProgress(Number.NaN, 10)).toBe(0);
  });

  it("crewRenderCell interpola sólo dentro del tramo autoritativo", () => {
    expect(crewRenderCell({ x: 5, y: 5 }, { x: 6, y: 5 }, 0)).toEqual({ x: 5, y: 5 });
    expect(crewRenderCell({ x: 5, y: 5 }, { x: 6, y: 5 }, 0.5)).toEqual({ x: 5.5, y: 5 });
    expect(crewRenderCell({ x: 5, y: 5 }, { x: 5, y: 4 }, 1)).toEqual({ x: 5, y: 4 });
    expect(crewRenderCell({ x: 5, y: 5 }, { x: 6, y: 5 }, 4)).toEqual({ x: 6, y: 5 });
    expect(crewRenderCell({ x: 5, y: 5 }, { x: 6, y: 5 }, -2)).toEqual({ x: 5, y: 5 });
  });

  it("el reloj de animación recorre las dos poses del clip con claves del contrato", () => {
    expect(crewAnimationFrameKey(MANIFEST, "chr_worker", "walk", 2, 0)).toBe(
      "blender-character-chr_worker-walk-d2-0",
    );
    expect(crewAnimationFrameKey(MANIFEST, "chr_worker", "walk", 2, 180)).toBe(
      "blender-character-chr_worker-walk-d2-1",
    );
    expect(crewAnimationFrameKey(MANIFEST, "chr_worker", "walk", 2, 360)).toBe(
      "blender-character-chr_worker-walk-d2-0",
    );
    expect(crewAnimationFrameKey(MANIFEST, "chr_worker", "idle", 0, 400)).toBe(
      "blender-character-chr_worker-idle-d0-1",
    );
    const worker = MANIFEST.characters.chr_worker!;
    for (const direction of [0, 1, 2, 3] as const) {
      for (const animation of ["idle", "walk"] as const) {
        for (const slot of [0, 1]) {
          const key = crewAnimationFrameKey(
            MANIFEST,
            CREW_CHARACTER,
            animation,
            direction,
            slot * 500,
          );
          const frames = worker.animations[animation].frames;
          expect(frames[direction * 2 + slot], `frame ausente: ${key}`).toBeTruthy();
        }
      }
    }
  });

  it("las observaciones cubren exactamente a la cuadrilla asignada y se vacían al despedirla", () => {
    const { state, crew, site } = assignedCrewRuntime();
    const projection = createViewProjection(state, true);
    const members = [crew.supervisorAgentId, ...crew.workerAgentIds];
    const first = crewSpriteObservations(projection, new Map());
    expect([...first.keys()].sort()).toEqual([...members].sort());
    for (const observation of first.values()) {
      expect(observation.siteId).toBe(site.id);
      expect(observation.character).toBe(CREW_CHARACTER);
      expect(observation.animation).toStrictEqual(expect.stringMatching(/^(idle|walk)$/));
      expect(observation.direction).toBeGreaterThanOrEqual(0);
      expect(observation.direction).toBeLessThan(MANIFEST.characters.chr_worker!.directions);
    }

    const sinCuadrilla: ViewProjectionV2 = {
      ...projection,
      economy: {
        ...projection.economy!,
        constructionSites: projection.economy!.constructionSites.map((entry) =>
          entry.id === site.id ? { ...entry, assignedCrewIds: [] } : entry,
        ),
      },
    };
    expect(crewSpriteObservations(sinCuadrilla, first).size).toBe(0);

    const otroDistrito = [...state.world.city.districtIds].find(
      (id) => id !== projection.observedDistrictId,
    )!;
    const lejos = withAgents(projection, (agent) =>
      agent.id === crew.supervisorAgentId ? { ...agent, districtId: otroDistrito } : agent,
    );
    const sinSupervisor = crewSpriteObservations(lejos, new Map());
    expect(sinSupervisor.has(crew.supervisorAgentId)).toBe(false);
    expect([...sinSupervisor.keys()].sort()).toEqual([...crew.workerAgentIds].sort());
  });

  it("la memoria entre proyecciones conserva el rumbo de llegada en vez de girar hacia la cámara", () => {
    const { state, crew } = assignedCrewRuntime();
    const projection = createViewProjection(state, true);
    const supervisorId = crew.supervisorAgentId;
    const arrivedCell = { x: 10, y: 12 };
    const posado = withAgents(projection, (agent) =>
      agent.id === supervisorId
        ? { ...agent, cell: arrivedCell, nextCell: null, state: "idle" as const }
        : agent,
    );
    const sinMemoria = crewSpriteObservations(posado, new Map()).get(supervisorId)!;
    expect(sinMemoria.animation).toBe("idle");
    expect(sinMemoria.direction).toBe(0);

    const anterior = new Map<AgentId, CrewSpriteObservation>();
    for (const [agentId, observation] of crewSpriteObservations(projection, new Map())) {
      anterior.set(agentId, { ...observation, cell: { x: 10, y: 11 } });
    }
    const conMemoria = crewSpriteObservations(posado, anterior).get(supervisorId)!;
    expect(conMemoria.animation).toBe("idle");
    expect(conMemoria.direction).toBe(GRID_DELTA_TO_DIRECTION["0,1"]);
    /** Sin paso que interpolar, el sprite se planta sobre la celda autoritativa. */
    expect(conMemoria.renderCell).toEqual(arrivedCell);
    expect(conMemoria.cell).toEqual(arrivedCell);
  });

  it("renderCell sigue la fase publicada por el tick de la proyección", () => {
    const { state, crew } = assignedCrewRuntime();
    const base = createViewProjection(state, true);
    const supervisorId = crew.supervisorAgentId;
    const step = (tick: number, nextCell: { x: number; y: number } | null): ViewProjectionV2 =>
      withAgents({ ...base, tick: parseTick(tick) }, (agent) =>
        agent.id === supervisorId ? { ...agent, cell: { x: 5, y: 5 }, nextCell } : agent,
      );

    expect(
      crewSpriteObservations(step(1, { x: 6, y: 5 }), new Map()).get(supervisorId)!.renderCell,
    ).toEqual({ x: 5, y: 5 });
    expect(
      crewSpriteObservations(step(6, { x: 6, y: 5 }), new Map()).get(supervisorId)!.renderCell,
    ).toEqual({ x: 5.5, y: 5 });
    expect(
      crewSpriteObservations(step(10, { x: 5, y: 4 }), new Map()).get(supervisorId)!.renderCell.y,
    ).toBeCloseTo(4.1, 10);
    expect(crewSpriteObservations(step(6, null), new Map()).get(supervisorId)!.renderCell).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("una proyección sin economía no deja ni una observación", () => {
    const { state } = assignedCrewRuntime();
    const projection = createViewProjection(state, true);
    delete projection.economy;
    expect(crewSpriteObservations(projection, new Map()).size).toBe(0);
  });
});
