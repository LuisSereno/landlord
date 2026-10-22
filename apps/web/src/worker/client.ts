import {
  initializeGameRequestSchema,
  loadSnapshotRequestSchema,
  parseCommandId,
  parseBuildingId,
  parseConstructionSiteId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parsePolicyId,
  parseTenantId,
  requestIdSchema,
  saveSnapshotRequestSchema,
  setRunStateRequestSchema,
  submitCommandRequestSchema,
  viewProjectionV1Schema,
  workerResponseSchema,
  type SnapshotV1,
  type ProductCommand,
  type SimulationMetrics,
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
  label: string;
};

export type ClientDiagnostic =
  | { kind: "commandAccepted"; label: string }
  | { kind: "commandRejected"; code: string; message: string }
  | { kind: "transportError"; message: string }
  | { kind: "metrics"; metrics: SimulationMetrics };

export class SimulationWorkerClient {
  private nextRequestNumber = 1;
  private nextCommandNumber = 1;
  private readonly commandSession = globalThis.crypto.randomUUID();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly handleMessageBound = (event: MessageEventLike) => this.handleMessage(event.data);

  public constructor(
    private readonly port: WorkerPort,
    private readonly onProjection: (projection: ViewProjectionV1) => void,
    private readonly onTransportError: (message: string) => void,
    private readonly onDiagnostic: (diagnostic: ClientDiagnostic) => void = () => undefined,
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
            commandId: this.nextCommandId(),
            issuedByPersonId: parsePersonId("person_00000001"),
            actingAsOrganizationId: parseOrganizationId("org_00000001"),
            type: "PlaceTestStructure",
            payload: { cell },
          },
        },
      }),
    );
  }

  public buyParcel(parcelId: string): Promise<WorkerResponse> {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "BuyParcel",
      payload: { parcelId: parseParcelId(parcelId) },
    });
  }

  public startConstruction(parcelId: string, buildingType: "courtyard_home" | "workshop") {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "StartConstruction",
      payload: { parcelId: parseParcelId(parcelId), buildingType },
    });
  }

  public assignTenant(buildingId: string, tenantId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "AssignTenant",
      payload: { buildingId: parseBuildingId(buildingId), tenantId: parseTenantId(tenantId) },
    });
  }

  public cancelConstruction(constructionSiteId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "CancelConstruction",
      payload: { constructionSiteId: parseConstructionSiteId(constructionSiteId) },
    });
  }

  public upgradeBuilding(buildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "UpgradeBuilding",
      payload: { buildingId: parseBuildingId(buildingId) },
    });
  }

  public lobbyPolicy(policyId: string, influenceSpend = 1) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "LobbyPolicy",
      payload: { policyId: parsePolicyId(policyId), influenceSpend },
    });
  }

  public commitCrime(targetOrganizationId = "org_00000002") {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "CommitCrime",
      payload: { targetOrganizationId: parseOrganizationId(targetOrganizationId) },
    });
  }

  public buyMaterials(resource: "cement" | "brick" | "steel", amount: number) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "BuyMaterials",
      payload: { resource, amount },
    });
  }

  public investInProduction(resource: "cement" | "brick" | "steel") {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "InvestInProduction",
      payload: { resource },
    });
  }

  public allocateCrew(constructionSiteId: string, crewCapacity: 1 | 2) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "AllocateCrew",
      payload: { constructionSiteId: parseConstructionSiteId(constructionSiteId), crewCapacity },
    });
  }

  public repairBuilding(buildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "RepairBuilding",
      payload: { buildingId: parseBuildingId(buildingId) },
    });
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
      this.pending.set(request.requestId, { resolve, label: requestLabel(request) });
      this.port.postMessage(request);
    });
  }

  private submitProductCommand(command: ProductCommand): Promise<WorkerResponse> {
    return this.send(
      submitCommandRequestSchema.parse({
        protocolVersion: 1,
        requestId: this.nextRequestId(),
        type: "SubmitCommand",
        payload: { command },
      }) as WorkerRequest,
    );
  }

  private nextCommandId() {
    return parseCommandId(`command-${this.commandSession}-${this.nextCommandNumber++}`);
  }

  private nextRequestId() {
    return requestIdSchema.parse(`request-${this.nextRequestNumber++}`);
  }

  private handleMessage(rawResponse: unknown): void {
    const parsed = workerResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      const message = "El Worker devolvió un mensaje inválido.";
      this.onTransportError(message);
      this.onDiagnostic({ kind: "transportError", message });
      return;
    }
    const response = parsed.data;
    if (response.type === "ProjectionPublished") {
      const projection = viewProjectionV1Schema.safeParse(response.payload);
      if (projection.success) this.onProjection(projection.data as ViewProjectionV1);
      else this.onTransportError("La proyección del Worker no es válida.");
      return;
    }
    if (response.type === "SimulationMetricsPublished") {
      this.onDiagnostic({ kind: "metrics", metrics: response.payload });
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (response.type === "RequestFailed") {
      this.onDiagnostic({
        kind: "commandRejected",
        code: response.payload.code,
        message: response.payload.message,
      });
    } else if (pending?.label.startsWith("SubmitCommand:")) {
      this.onDiagnostic({ kind: "commandAccepted", label: pending.label });
    }
    pending?.resolve(response);
    this.pending.delete(response.requestId);
  }
}

function requestLabel(request: WorkerRequest): string {
  return request.type === "SubmitCommand"
    ? `SubmitCommand:${request.payload.command.type}`
    : request.type;
}
