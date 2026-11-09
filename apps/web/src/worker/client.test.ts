import { describe, expect, it } from "vitest";

import { SimulationWorkerClient, type WorkerPort } from "./client";

class FakeWorker implements WorkerPort {
  private listener?: (event: { data: unknown }) => void;
  public sent: unknown[] = [];

  public postMessage(message: never): void {
    this.sent.push(message);
  }

  public addEventListener(_type: "message", listener: (event: { data: unknown }) => void): void {
    this.listener = listener;
  }

  public emit(message: unknown): void {
    this.listener?.({ data: message });
  }
}

describe("SimulationWorkerClient", () => {
  it("sends versioned requests and resolves correlated responses", async () => {
    const worker = new FakeWorker();
    const projections: unknown[] = [];
    const errors: string[] = [];
    const client = new SimulationWorkerClient(
      worker,
      (projection) => projections.push(projection),
      (error) => errors.push(error),
    );
    const promise = client.initialize(1);
    expect(worker.sent[0]).toMatchObject({ type: "InitializeGame", protocolVersion: 2 });
    worker.emit({
      protocolVersion: 2,
      requestId: "request-1",
      type: "RequestSucceeded",
      payload: { acceptedAtTick: 0 },
    });
    await expect(promise).resolves.toMatchObject({ type: "RequestSucceeded" });
    worker.emit({
      protocolVersion: 2,
      requestId: null,
      type: "ProjectionPublished",
      payload: {
        projectionVersion: 2,
        observedDistrictId: "district_00000004",
        city: {
          id: "city_00000001",
          name: "Ciudad de prueba",
          layout: { columns: 3, rows: 3 },
          districts: Array.from({ length: 9 }, (_, index) => ({
            id: `district_${String(index + 1).padStart(8, "0")}`,
            name: `Distrito ${index + 1}`,
            slotX: index % 3,
            slotY: Math.floor(index / 3),
            role: "mixed_core",
            parcels: 0,
            marketableParcels: 0,
            ownParcels: 0,
            rivalParcels: 0,
            buildings: 0,
            ownBuildings: 0,
            rivalBuildings: 0,
            occupiedUnits: 0,
            vacantUnits: 0,
            rentIndexPercent: 100,
            averageLandValue: 0,
            facilities: 0,
            publicSpaces: 0,
            alerts: 0,
          })),
        },
        tick: 0,
        // V.k.1 · la cadencia de paso viaja en la proyección: sin ella el worker no puede animar cuadrillas.
        movement: { ticksPerCell: 10 },
        map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells: [] } },
        publicSpaces: [],
        facilities: [],
        structures: [],
        agents: [
          {
            id: "agent_00000001",
            districtId: "district_00000004",
            cell: { x: 3, y: 4 },
            nextCell: { x: 4, y: 4 },
            specialty: "supervisor",
            state: "moving",
          },
        ],
      },
    });
    expect(projections).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("shapes public bid and intelligence commands with the player identity", () => {
    const worker = new FakeWorker();
    const client = new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
    );
    void client.submitPublicBid("contract_00000001", 260);
    void client.commissionIntelligence("org_00000002", "balance");
    expect(worker.sent[0]).toMatchObject({
      type: "SubmitCommand",
      payload: {
        command: {
          type: "SubmitPublicBid",
          issuedByPersonId: "person_00000001",
          actingAsOrganizationId: "org_00000001",
          payload: { contractId: "contract_00000001", amount: 260 },
        },
      },
    });
    expect(worker.sent[1]).toMatchObject({
      type: "SubmitCommand",
      payload: {
        command: {
          type: "CommissionIntelligence",
          payload: { subjectOrganizationId: "org_00000002", kind: "balance" },
        },
      },
    });
  });

  it("reports malformed Worker messages without mutating client state", () => {
    const worker = new FakeWorker();
    const errors: string[] = [];
    new SimulationWorkerClient(
      worker,
      () => undefined,
      (error) => errors.push(error),
    );
    worker.emit({ invalid: true });
    expect(errors).toEqual(["El Worker devolvió un mensaje inválido."]);
  });

  it("forwards validated session metrics without treating them as a request response", () => {
    const worker = new FakeWorker();
    const diagnostics: unknown[] = [];
    new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
      (entry) => diagnostics.push(entry),
    );
    worker.emit({
      protocolVersion: 2,
      requestId: null,
      type: "SimulationMetricsPublished",
      payload: {
        tick: 20,
        pendingCommands: 0,
        structures: 1,
        acceptedCommands: 1,
        rejectedCommands: [{ code: "DUPLICATE_COMMAND", count: 1 }],
      },
    });
    expect(diagnostics).toEqual([
      {
        kind: "metrics",
        metrics: {
          tick: 20,
          pendingCommands: 0,
          structures: 1,
          acceptedCommands: 1,
          rejectedCommands: [{ code: "DUPLICATE_COMMAND", count: 1 }],
        },
      },
    ]);
  });

  it("uses a fresh command namespace after recreating the client", () => {
    const firstWorker = new FakeWorker();
    const secondWorker = new FakeWorker();
    const first = new SimulationWorkerClient(
      firstWorker,
      () => undefined,
      () => undefined,
    );
    const second = new SimulationWorkerClient(
      secondWorker,
      () => undefined,
      () => undefined,
    );
    void first.buyParcel("parcel_00000001");
    void second.buyParcel("parcel_00000001");
    const firstId = (firstWorker.sent[0] as { payload: { command: { commandId: string } } }).payload
      .command.commandId;
    const secondId = (secondWorker.sent[0] as { payload: { command: { commandId: string } } })
      .payload.command.commandId;
    expect(firstId).not.toBe(secondId);
  });
});

describe("V.d-7C · colocación interactiva en el cliente del Worker", () => {
  const candidateResult = {
    districtId: "district_00000001",
    parcelIds: ["parcel_00000001"],
    buildingType: "courtyard_home",
    candidates: [
      {
        id: "placement_0000000000000001",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
        footprintCells: [{ x: 4, y: 4 }],
        orientation: 0,
        floors: 1,
        recommended: true,
      },
    ],
    totalCandidates: 1,
    rejection: null,
  };

  it("envía la petición de sólo lectura y valida la respuesta", async () => {
    const worker = new FakeWorker();
    const client = new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
    );
    const pending = client.getDevelopmentPlacementCandidates({
      buildingType: "courtyard_home",
      districtId: "district_00000001",
      parcelIds: ["parcel_00000001"],
    });
    expect(worker.sent[0]).toMatchObject({
      protocolVersion: 2,
      type: "GetDevelopmentPlacementCandidates",
      payload: {
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
        buildingType: "courtyard_home",
      },
    });
    worker.emit({
      protocolVersion: 2,
      requestId: "request-1",
      type: "RequestSucceeded",
      payload: { acceptedAtTick: 0, result: candidateResult },
    });
    await expect(pending).resolves.toEqual(candidateResult);
  });

  it("devuelve null cuando el Worker rechaza o entrega algo que no es este contrato", async () => {
    const worker = new FakeWorker();
    const client = new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
    );
    const rejected = client.getDevelopmentPlacementCandidates({
      buildingType: "courtyard_home",
      districtId: "district_00000001",
      parcelIds: ["parcel_00000001"],
    });
    worker.emit({
      protocolVersion: 2,
      requestId: "request-1",
      type: "RequestFailed",
      payload: { code: "DISTRICT_NOT_FOUND", message: "El distrito indicado no existe." },
    });
    await expect(rejected).resolves.toBeNull();

    const garbage = client.getDevelopmentPlacementCandidates({
      buildingType: "courtyard_home",
      districtId: "district_00000001",
      parcelIds: ["parcel_00000001"],
    });
    worker.emit({
      protocolVersion: 2,
      requestId: "request-2",
      type: "RequestSucceeded",
      payload: { acceptedAtTick: 0, result: { candidates: "muchas" } },
    });
    await expect(garbage).resolves.toBeNull();
  });

  it("sólo añade placementId al comando cuando el jugador confirmó una colocación", async () => {
    const worker = new FakeWorker();
    const client = new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
    );
    void client.startConstruction(["parcel_00000001"], "courtyard_home");
    expect(
      (worker.sent[0] as { payload: { command: { payload: Record<string, unknown> } } }).payload
        .command.payload,
    ).not.toHaveProperty("placementId");
    void client.startConstruction(
      ["parcel_00000001"],
      "courtyard_home",
      "placement_0000000000000001",
    );
    expect(
      (worker.sent[1] as { payload: { command: { payload: Record<string, unknown> } } }).payload
        .command.payload,
    ).toMatchObject({ placementId: "placement_0000000000000001" });
  });

  it("rechaza por schema un placementId que no tiene forma canónica", async () => {
    const worker = new FakeWorker();
    const client = new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
    );
    expect(() =>
      client.startConstruction(["parcel_00000001"], "courtyard_home", "placement-1"),
    ).toThrow();
  });
});
