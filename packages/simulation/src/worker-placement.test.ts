import { describe, expect, it } from "vitest";

import {
  developmentPlacementCandidatesSchema,
  parseMoney,
  type WorkerResponse,
} from "@landlord/shared";
import { enumeratePurchasableDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { canonicalizeState } from "./runner";
import { SimulationWorkerRuntime } from "./worker-runtime";

/**
 * V.d-7C · contrato de sólo lectura del worker (D-097 · Projection). Lo que se prueba aquí es la
 * frontera: la petición responde con candidatos canónicos, no toca el estado autoritativo y rechaza
 * por nombre todo lo malformado, para que la UI nunca invente una colocación por su cuenta.
 */

const initialize = {
  protocolVersion: 2,
  requestId: "request-placement-init",
  type: "InitializeGame" as const,
  payload: { seed: 7 },
};

function placementRequest(
  requestId: string,
  payload: { districtId: string; parcelIds: string[]; buildingType: string },
) {
  return {
    protocolVersion: 2,
    requestId,
    type: "GetDevelopmentPlacementCandidates" as const,
    payload,
  };
}

function started(): SimulationWorkerRuntime {
  const runtime = new SimulationWorkerRuntime();
  runtime.handle(initialize);
  return runtime;
}

/** Un solar propio del observador, encontrado con el mismo buscador autoritativo que usa la IA. */
function ownedSite(runtime: SimulationWorkerRuntime) {
  const state = runtime.getState()!;
  const sites = enumeratePurchasableDevelopmentSites({
    state,
    definition: BUILDING_DEFINITIONS.courtyard_home,
  });
  const parcelIds = sites[0]!;
  for (const id of parcelIds)
    state.phase2.parcels.get(id)!.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  return {
    state,
    districtId: state.phase2.parcels.get(parcelIds[0]!)!.districtId,
    parcelIds,
  };
}

function resultOf(response: WorkerResponse | undefined) {
  return (response as { payload: { result: unknown } }).payload.result as {
    districtId: string;
    parcelIds: string[];
    candidates: { id: string; recommended: boolean; footprintCells: { x: number; y: number }[] }[];
    totalCandidates: number;
    rejection: string | null;
  };
}

describe("V.d-7C · petición de candidatos del worker", () => {
  it("responde candidatos legales sin mover el estado autoritativo", () => {
    const runtime = started();
    const { state, districtId, parcelIds } = ownedSite(runtime);
    const before = {
      canonical: canonicalizeState(state),
      tick: state.clock.tick,
      prng: JSON.stringify(state.prng),
      permits: JSON.stringify(state.phase2.permitting),
      sites: state.phase2.constructionSites.size,
    };
    const responses = runtime.handle(
      placementRequest("request-placement-ok", {
        districtId,
        parcelIds,
        buildingType: "courtyard_home",
      }),
    );
    expect(responses.map((response) => response.type)).toEqual(["RequestSucceeded"]);
    const result = resultOf(responses[0]);
    expect(developmentPlacementCandidatesSchema.safeParse(result).success).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]!.recommended).toBe(true);
    expect(result.rejection).toBeNull();
    expect(canonicalizeState(runtime.getState()!)).toBe(before.canonical);
    expect(runtime.getState()!.clock.tick).toBe(before.tick);
    expect(JSON.stringify(runtime.getState()!.prng)).toBe(before.prng);
    expect(JSON.stringify(runtime.getState()!.phase2.permitting)).toBe(before.permits);
    expect(runtime.getState()!.phase2.constructionSites.size).toBe(before.sites);
  });

  it("la misma petición, con parcelIds invertidos, devuelve el mismo orden", () => {
    const runtime = started();
    const { districtId, parcelIds } = ownedSite(runtime);
    const first = resultOf(
      runtime.handle(
        placementRequest("request-placement-a", {
          districtId,
          parcelIds,
          buildingType: "courtyard_home",
        }),
      )[0],
    );
    const second = resultOf(
      runtime.handle(
        placementRequest("request-placement-b", {
          districtId,
          parcelIds: [...parcelIds].reverse(),
          buildingType: "courtyard_home",
        }),
      )[0],
    );
    expect(second.candidates.map((candidate) => candidate.id)).toEqual(
      first.candidates.map((candidate) => candidate.id),
    );
    expect(second.totalCandidates).toBe(first.totalCandidates);
  });

  it("rechaza por nombre una solicitud malformada", () => {
    const runtime = started();
    const { districtId, parcelIds } = ownedSite(runtime);
    expect(
      runtime.handle({
        protocolVersion: 2,
        requestId: "request-placement-no-type",
        type: "GetDevelopmentPlacementCandidates",
        payload: { districtId, parcelIds },
      }),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "INVALID_PAYLOAD" } }]);
    expect(
      runtime.handle(
        placementRequest("request-placement-four-parcels", {
          districtId,
          parcelIds: ["parcel_00000001", "parcel_00000002", "parcel_00000003", "parcel_00000004"],
          buildingType: "courtyard_home",
        }),
      ),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "INVALID_PAYLOAD" } }]);
    expect(
      runtime.handle({
        protocolVersion: 2,
        requestId: "request-placement-extra-key",
        type: "GetDevelopmentPlacementCandidates",
        payload: { districtId, parcelIds, buildingType: "courtyard_home", observer: "rival" },
      }),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "INVALID_PAYLOAD" } }]);
    /** Ninguna de las tres reachazadas dejó estado nuevo detrás. */
    expect(canonicalizeState(runtime.getState()!)).toContain("district_00000001");
  });

  it("un distrito inexistente se rechaza por nombre", () => {
    const runtime = started();
    const { parcelIds } = ownedSite(runtime);
    expect(
      runtime.handle(
        placementRequest("request-placement-bad-district", {
          districtId: "district_99999999",
          parcelIds,
          buildingType: "courtyard_home",
        }),
      ),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "DISTRICT_NOT_FOUND" } }]);
  });

  it("no publica colocaciones de un solar que el observador no posee", () => {
    const runtime = started();
    const state = runtime.getState()!;
    const foreign = enumeratePurchasableDevelopmentSites({
      state,
      definition: BUILDING_DEFINITIONS.courtyard_home,
    })[0]!;
    const result = resultOf(
      runtime.handle(
        placementRequest("request-placement-foreign", {
          districtId: state.phase2.parcels.get(foreign[0]!)!.districtId,
          parcelIds: foreign,
          buildingType: "courtyard_home",
        }),
      )[0],
    );
    expect(developmentPlacementCandidatesSchema.safeParse(result).success).toBe(true);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejection).toBe("ACTOR_NOT_AUTHORIZED");
  });

  it("el candidato confirmado por el comando es exactamente el devuelto por la petición", () => {
    const runtime = started();
    const { state, districtId, parcelIds } = ownedSite(runtime);
    /** Fondos y materiales del partida real: la prueba mide la frontera, no la economía. */
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(1_000_000));
    const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
    inventory.cement += 500;
    inventory.brick += 500;
    inventory.steel += 500;
    const result = resultOf(
      runtime.handle(
        placementRequest("request-placement-command-parity", {
          districtId,
          parcelIds,
          buildingType: "courtyard_home",
        }),
      )[0],
    );
    /** La página se recorta; la tercera candidata sigue siendo legal para el motor. */
    const chosen = result.candidates[Math.min(1, result.candidates.length - 1)]!;
    const accepted = dispatchStart(runtime, parcelIds, chosen.id);
    expect(accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()].at(-1)!;
    expect(
      chosen.footprintCells.every((cell) =>
        site.footprintCells.some((entry) => entry.x === cell.x && entry.y === cell.y),
      ),
    ).toBe(true);
    expect(site.footprintCells).toHaveLength(chosen.footprintCells.length);
  });
});

/** Se envía como comando normal y se liquida en el siguiente tick, igual que en la partida real. */
function dispatchStart(
  runtime: SimulationWorkerRuntime,
  parcelIds: readonly string[],
  placementId: string,
): boolean {
  runtime.handle({
    protocolVersion: 2,
    requestId: "request-placement-command",
    type: "SubmitCommand",
    payload: {
      command: {
        commandId: `command-placement-${placementId}`,
        issuedByPersonId: "person_00000001",
        actingAsOrganizationId: "org_00000001",
        type: "StartConstruction",
        payload: { parcelIds: [...parcelIds], buildingType: "courtyard_home", placementId },
      },
    },
  });
  const responses = runtime.advanceTicks(1);
  const failed = responses.find((response) => response.type === "RequestFailed");
  return failed === undefined;
}
