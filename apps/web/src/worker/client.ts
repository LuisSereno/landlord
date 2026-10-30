import type { BuildingType, DistrictId } from "@landlord/shared";
import {
  initializeGameRequestSchema,
  loadSnapshotRequestSchema,
  parseCommandId,
  parseBuildingId,
  parseCrewId,
  parseAgentId,
  parseConstructionSiteId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parsePolicyId,
  parseTenantId,
  parseLoanId,
  parseMoney,
  requestIdSchema,
  saveSnapshotRequestSchema,
  setObservedDistrictRequestSchema,
  setRunStateRequestSchema,
  submitCommandRequestSchema,
  viewProjectionV2Schema,
  workerResponseSchema,
  type SnapshotV2,
  type IntelKind,
  type ProductCommand,
  type SimulationMetrics,
  type ViewProjectionV2,
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
    private readonly onProjection: (projection: ViewProjectionV2) => void,
    private readonly onTransportError: (message: string) => void,
    private readonly onDiagnostic: (diagnostic: ClientDiagnostic) => void = () => undefined,
  ) {
    this.port.addEventListener("message", this.handleMessageBound);
  }

  public initialize(seed: number): Promise<WorkerResponse> {
    return this.send(
      initializeGameRequestSchema.parse({
        protocolVersion: 2,
        requestId: this.nextRequestId(),
        type: "InitializeGame",
        payload: { seed },
      }),
    );
  }

  /** Petición técnica: cambia lo que se dibuja, no el mundo (D-089). */
  public setObservedDistrict(districtId: string): Promise<WorkerResponse> {
    return this.send(
      setObservedDistrictRequestSchema.parse({
        protocolVersion: 2,
        requestId: this.nextRequestId(),
        type: "SetObservedDistrict",
        payload: { districtId },
      }),
    );
  }

  public setRunState(state: "paused" | "running", speed: 1 | 2 | 4): Promise<WorkerResponse> {
    return this.send(
      setRunStateRequestSchema.parse({
        protocolVersion: 2,
        requestId: this.nextRequestId(),
        type: "SetRunState",
        payload: { state, speed },
      }),
    );
  }

  public placeTestStructure(
    cell: { x: number; y: number },
    districtId: DistrictId,
  ): Promise<WorkerResponse> {
    return this.send(
      submitCommandRequestSchema.parse({
        protocolVersion: 2,
        requestId: this.nextRequestId(),
        type: "SubmitCommand",
        payload: {
          command: {
            commandId: this.nextCommandId(),
            issuedByPersonId: parsePersonId("person_00000001"),
            actingAsOrganizationId: parseOrganizationId("org_00000001"),
            type: "PlaceTestStructure",
            payload: { districtId, cell },
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

  public sellParcel(parcelId: string): Promise<WorkerResponse> {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "SellParcel",
      payload: { parcelId: parseParcelId(parcelId) },
    });
  }

  /** V.d-7 · el comando lleva el conjunto; la UI single-parcel envía `[parcelId]`. */
  public startConstruction(parcelIds: readonly string[], buildingType: BuildingType) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "StartConstruction",
      payload: { parcelIds: parcelIds.map(parseParcelId), buildingType },
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

  public proposePolicy(policyId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "ProposePolicy",
      payload: { policyId: parsePolicyId(policyId) },
    });
  }

  public withdrawPolicy(policyId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "WithdrawPolicy",
      payload: { policyId: parsePolicyId(policyId) },
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

  public assignCrew(crewId: string, workOrderId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "AssignCrewToWorkOrder",
      payload: { crewId: parseCrewId(crewId), workOrderId: parseConstructionSiteId(workOrderId) },
    });
  }

  public assignMaintenance(buildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "AssignMaintenance",
      payload: { buildingId: parseBuildingId(buildingId) },
    });
  }

  public orderEnforcerSabotage(enforcerAgentId: string, targetBuildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "OrderEnforcerAction",
      payload: {
        enforcerAgentId: parseAgentId(enforcerAgentId),
        action: "sabotage_building",
        targetBuildingId: parseBuildingId(targetBuildingId),
      },
    });
  }

  public clearRuin(buildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "ClearRuin",
      payload: { buildingId: parseBuildingId(buildingId) },
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

  public requestLoan(amount: number, termMonths: number, collateralParcelId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "RequestLoan",
      payload: {
        amount: parseMoney(amount),
        termMonths,
        collateralParcelId: parseParcelId(collateralParcelId),
      },
    });
  }

  public acceptLoanOffer(loanId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "AcceptLoanOffer",
      payload: { loanId: parseLoanId(loanId) },
    });
  }

  public setMaintenancePolicy(policy: "balanced" | "deferred") {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "SetMaintenancePolicy",
      payload: { policy },
    });
  }

  public setAutomationPolicy(payload: {
    property?: "manual" | "fill_vacancies";
    finance?: "manual" | "cover_shortfall";
    maintenanceRepairThreshold?: number | null;
  }) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "SetAutomationPolicy",
      payload,
    });
  }

  public requestPermit(
    parcelIds: readonly string[],
    buildingType: "courtyard_home" | "workshop" | "cement_plant" | "brickworks" | "steelworks",
  ) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "RequestPermit",
      payload: { parcelIds: parcelIds.map(parseParcelId), buildingType },
    });
  }

  public buyInsurance(buildingId: string, coverage: "fire_basic" | "fire_plus") {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "BuyInsurance",
      payload: { buildingId: parseBuildingId(buildingId), coverage },
    });
  }

  public cancelInsurance(buildingId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "CancelInsurance",
      payload: { buildingId: parseBuildingId(buildingId) },
    });
  }

  public requestRefinancing(loanId: string, termMonths: 6 | 12 | 24) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "RequestRefinancing",
      payload: { loanId: parseLoanId(loanId), termMonths },
    });
  }

  public placeAuctionBid(loanId: string, amount: number) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceAuctionBid",
      payload: { loanId: parseLoanId(loanId), amount: parseMoney(amount) },
    });
  }

  public withdrawAuctionBid(loanId: string) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "WithdrawAuctionBid",
      payload: { loanId: parseLoanId(loanId) },
    });
  }

  public submitPublicBid(contractId: string, amount: number) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "SubmitPublicBid",
      payload: { contractId, amount: parseMoney(amount) },
    });
  }

  public commissionIntelligence(subjectOrganizationId: string, kind: IntelKind) {
    return this.submitProductCommand({
      commandId: this.nextCommandId(),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "CommissionIntelligence",
      payload: { subjectOrganizationId: parseOrganizationId(subjectOrganizationId), kind },
    });
  }

  public saveSnapshot(): Promise<WorkerResponse> {
    return this.send(
      saveSnapshotRequestSchema.parse({
        protocolVersion: 2,
        requestId: this.nextRequestId(),
        type: "SaveSnapshot",
        payload: {},
      }),
    );
  }

  public loadSnapshot(snapshot: SnapshotV2): Promise<WorkerResponse> {
    return this.send(
      loadSnapshotRequestSchema.parse({
        protocolVersion: 2,
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
        protocolVersion: 2,
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
      const projection = viewProjectionV2Schema.safeParse(response.payload);
      if (projection.success) this.onProjection(projection.data as ViewProjectionV2);
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
