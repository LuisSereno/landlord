import {
  initializeGameRequestSchema,
  loadSnapshotRequestSchema,
  parseCommandId,
  parseOrganizationId,
  parsePersonId,
  requestIdSchema,
  saveSnapshotRequestSchema,
  setRunStateRequestSchema,
  submitCommandRequestSchema,
  viewProjectionV1Schema,
  workerResponseSchema,
  type SnapshotV1,
  type ViewProjectionV1,
  type WorkerRequest,
  type WorkerResponse,
} from "@landlord/shared";

type MessageEventLike = { data: unknown };

export type WorkerPort = {
  postMessage(message: WorkerRequest): void;
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  removeEventListener?(type: "message", listener: (event: MessageEventLike) => void): void;
  terminate?(): void;
};

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
};

export class SimulationWorkerClient {
  private nextRequestNumber = 1;
  private nextCommandNumber = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly handleMessageBound = (event: MessageEventLike) => this.handleMessage(event.data);

  public constructor(
    private readonly port: WorkerPort,
    private readonly onProjection: (projection: ViewProjectionV1) => void,
    private readonly onTransportError: (message: string) => void,
  ) {
    this.port.addEventListener("message", this.handleMessageBound);
  }

  public initialize(seed: number): Promise<WorkerResponse> {
    return this.send(
      initializeGameRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "InitializeGame",
        payload: { seed },
      }),
    );
  }

  public setRunState(state: "paused" | "running", speed: 1 | 2 | 4): Promise<WorkerResponse> {
    return this.send(
      setRunStateRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "SetRunState",
        payload: { state, speed },
      }),
    );
  }

  public placeTestStructure(cell: { x: number; y: number }): Promise<WorkerResponse> {
    return this.send(
      submitCommandRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "SubmitCommand",
        payload: {
          command: {
            commandId: parseCommandId(`command-${this.nextCommandNumber++}`),
            issuedByPersonId: parsePersonId("person_00000001"),
            actingAsOrganizationId: parseOrganizationId("org_00000001"),
            type: "PlaceTestStructure",
            payload: { cell },
          },
        },
      }),
    );
  }

  public saveSnapshot(): Promise<WorkerResponse> {
    return this.send(
      saveSnapshotRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "SaveSnapshot",
        payload: {},
      }),
    );
  }

  public loadSnapshot(snapshot: SnapshotV1): Promise<WorkerResponse> {
    return this.send(
      loadSnapshotRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "LoadSnapshot",
        payload: { snapshot },
      }),
    );
  }

  public dispose(): void {
    this.port.removeEventListener?.("message", this.handleMessageBound);
    this.port.terminate?.();
    this.pending.clear();
  }

  private send(request: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve) => {
      this.pending.set(request.requestId, { resolve });
      this.port.postMessage(request);
    });
  }

  private nextRequestId() {
    return requestIdSchema.parse(`request-${this.nextRequestNumber++}`);
  }

  private handleMessage(rawResponse: unknown): void {
    const parsed = workerResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      this.onTransportError("El Worker devolvió un mensaje inválido.");
      return;
    }
    const response = parsed.data;
    if (response.type === "ProjectionPublished") {
      const projection = viewProjectionV1Schema.safeParse(response.payload);
      if (projection.success) this.onProjection(projection.data);
      else this.onTransportError("La proyección del Worker no es válida.");
      return;
    }
    if (response.type === "SimulationMetricsPublished") return;
    this.pending.get(response.requestId)?.resolve(response);
    this.pending.delete(response.requestId);
  }
}
