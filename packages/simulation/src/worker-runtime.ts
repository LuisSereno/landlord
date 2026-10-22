import {
  parseRequestId,
  parseTick,
  protocolVersionSchema,
  requestIdSchema,
  workerRequestSchema,
  type ErrorCode,
  type ProductCommand,
  type RequestId,
  type SimulationMetrics,
  type WorkerRequest,
  type WorkerResponse,
} from "@landlord/shared";
import { dispatchPlaceTestStructure, dispatchProductCommand } from "./commands";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

const errorMessages: Record<ErrorCode, string> = {
  DUPLICATE_COMMAND: "El comando ya fue procesado.",
  PERSON_NOT_FOUND: "La persona que emite el comando no existe.",
  ORGANIZATION_NOT_FOUND: "La organización activa no existe.",
  ACTOR_NOT_AUTHORIZED: "La persona no puede actuar por esta organización.",
  CELL_OUT_OF_BOUNDS: "La celda está fuera del mapa.",
  CELL_OCCUPIED: "La celda está ocupada.",
  INVALID_PAYLOAD: "La solicitud no es válida para el protocolo actual.",
  UNSUPPORTED_PROTOCOL: "La versión del protocolo no está soportada.",
  INVALID_SNAPSHOT: "La partida guardada no es válida.",
  INCOMPATIBLE_SCHEMA: "La partida guardada usa un schema incompatible.",
  PARCEL_NOT_FOUND: "La parcela no existe.",
  PARCEL_UNAVAILABLE: "La parcela ya tiene propietario.",
  INSUFFICIENT_FUNDS: "La organización no tiene caja suficiente.",
  BUILDING_NOT_FOUND: "El edificio no existe.",
  INVALID_ZONING: "El zoning no permite este edificio.",
  INSUFFICIENT_RESOURCES: "Faltan materiales para realizar la acción.",
  CONSTRUCTION_ALREADY_ACTIVE: "La parcela o edificio ya tiene una obra activa.",
  CONSTRUCTION_SITE_NOT_FOUND: "La obra no existe.",
  CREW_UNAVAILABLE: "La crew está ocupada en otra obra.",
  TENANT_NOT_FOUND: "El tenant no está disponible.",
  TENANT_INCOMPATIBLE: "El tenant no es compatible con este edificio.",
  TENANT_ALREADY_ASSIGNED: "El tenant o edificio ya tiene contrato.",
  POLICY_NOT_AVAILABLE: "La ordenanza no está disponible para promoverla.",
  INFLUENCE_TOO_LOW: "La organización no tiene influencia suficiente.",
  CRIME_TARGET_INVALID: "El objetivo de la acción ilegal no es válido.",
  TENANT_BUDGET_TOO_LOW: "El alquiler supera el presupuesto del inquilino.",
  INVENTORY_CAPACITY: "No queda capacidad suficiente en el almacén.",
  FACILITY_ALREADY_ACTIVE: "Esta línea de producción ya está activa.",
  FACILITY_NOT_FOUND: "No existe una línea de producción para ese material.",
  INVALID_CREW_ALLOCATION: "No hay suficientes cuadrillas libres para esa asignación.",
  BUILDING_CONDITION_FULL: "El edificio no necesita reparación.",
  CRIME_COOLDOWN: "La ruta ilegal todavía está en periodo de enfriamiento.",
  CREW_NOT_FOUND: "La cuadrilla indicada no existe.",
  AGENT_NOT_FOUND: "El agente indicado no existe.",
  INVALID_AGENT_ACTION: "La orden operativa no es válida para ese objetivo.",
  RUIN_REQUIRED: "La operación requiere una ruina.",
} as const;

const PROTOCOL_VERSION = protocolVersionSchema.parse(1);
const INVALID_REQUEST_ID = parseRequestId("invalid-request");

function requestIdFromUnknown(value: unknown): RequestId | null {
  if (!value || typeof value !== "object" || !("requestId" in value)) return null;
  const parsed = requestIdSchema.safeParse(value.requestId);
  return parsed.success ? parsed.data : null;
}

function failed(requestId: RequestId | null, code: keyof typeof errorMessages): WorkerResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: requestId ?? INVALID_REQUEST_ID,
    type: "RequestFailed",
    payload: { code, message: errorMessages[code] },
  };
}

function succeeded(requestId: RequestId, tick: number, result?: unknown): WorkerResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    type: "RequestSucceeded",
    payload: {
      acceptedAtTick: parseTick(tick),
      ...(result === undefined ? {} : { result }),
    },
  };
}

export class SimulationWorkerRuntime {
  private state: GameState | null = null;
  private readonly pendingRequestIds = new Map<string, RequestId>();
  private acceptedCommands = 0;
  private readonly rejectedCommands = new Map<ErrorCode, number>();

  public handle(rawRequest: unknown): WorkerResponse[] {
    const requestId = requestIdFromUnknown(rawRequest);
    if (
      rawRequest &&
      typeof rawRequest === "object" &&
      "protocolVersion" in rawRequest &&
      rawRequest.protocolVersion !== 1
    ) {
      return [failed(requestId, "UNSUPPORTED_PROTOCOL")];
    }
    const parsed = workerRequestSchema.safeParse(rawRequest);
    if (!parsed.success) return [failed(requestId, "INVALID_PAYLOAD")];
    return this.handleRequest(parsed.data);
  }

  public advanceTicks(count = 1): WorkerResponse[] {
    if (!this.state) return [failed(null, "INVALID_PAYLOAD")];
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("Invalid tick count");

    const responses: WorkerResponse[] = [];
    for (let index = 0; index < count; index += 1) {
      const tick = this.state.clock.tick;
      const pending = this.state.pendingCommands
        .splice(0)
        .sort((left, right) => left.acceptedOrder - right.acceptedOrder);
      for (const queued of pending) {
        const result =
          queued.command.type === "PlaceTestStructure"
            ? dispatchPlaceTestStructure(this.state, queued.command)
            : dispatchProductCommand(this.state, queued.command);
        const requestId = this.pendingRequestIds.get(queued.command.commandId);
        this.pendingRequestIds.delete(queued.command.commandId);
        if (result.accepted) {
          this.acceptedCommands += 1;
          if (requestId) responses.push(succeeded(requestId, tick, result.event));
        } else {
          this.recordRejectedCommand(result.code);
          if (requestId) responses.push(failed(requestId, result.code));
        }
      }
      advanceProductSystems(this.state);
      if (this.state.clock.tick % 2 === 0) responses.push(this.projectionMessage());
      if (this.state.clock.tick % 20 === 0) responses.push(this.metricsMessage());
    }
    return responses;
  }

  public getState(): GameState | null {
    return this.state;
  }

  private handleRequest(request: WorkerRequest): WorkerResponse[] {
    switch (request.type) {
      case "InitializeGame": {
        this.state = createInitialState(request.payload.seed);
        this.pendingRequestIds.clear();
        this.resetDiagnostics();
        return [succeeded(request.requestId, this.state.clock.tick), this.projectionMessage()];
      }
      case "SubmitCommand": {
        if (!this.state) return [failed(request.requestId, "INVALID_PAYLOAD")];
        const alreadyPending = this.state.pendingCommands.some(
          (pending) => pending.command.commandId === request.payload.command.commandId,
        );
        if (
          alreadyPending ||
          this.state.processedCommandIds.has(request.payload.command.commandId)
        ) {
          this.recordRejectedCommand("DUPLICATE_COMMAND");
          return [failed(request.requestId, "DUPLICATE_COMMAND")];
        }
        this.state.idCounters.commandOrder += 1;
        this.state.pendingCommands.push({
          acceptedOrder: this.state.idCounters.commandOrder,
          command: request.payload.command as ProductCommand,
        });
        this.pendingRequestIds.set(request.payload.command.commandId, request.requestId);
        return [];
      }
      case "SetRunState": {
        if (!this.state) return [failed(request.requestId, "INVALID_PAYLOAD")];
        this.state.clock = {
          ...this.state.clock,
          runState: request.payload.state,
          speed: request.payload.speed,
        };
        return [succeeded(request.requestId, this.state.clock.tick)];
      }
      case "GetMetrics": {
        if (!this.state) return [failed(request.requestId, "INVALID_PAYLOAD")];
        return [
          succeeded(request.requestId, this.state.clock.tick, {
            ...this.metrics(),
          }),
        ];
      }
      case "SaveSnapshot": {
        if (!this.state) return [failed(request.requestId, "INVALID_SNAPSHOT")];
        return [
          succeeded(request.requestId, this.state.clock.tick, {
            snapshot: serializeSnapshot(this.state),
          }),
        ];
      }
      case "LoadSnapshot": {
        const rawSnapshot = request.payload.snapshot;
        if (
          rawSnapshot &&
          typeof rawSnapshot === "object" &&
          "schemaVersion" in rawSnapshot &&
          rawSnapshot.schemaVersion !== 1
        ) {
          return [failed(request.requestId, "INCOMPATIBLE_SCHEMA")];
        }
        try {
          const nextState = restoreStateFromSnapshot(rawSnapshot);
          this.state = nextState;
          this.pendingRequestIds.clear();
          this.resetDiagnostics();
          return [succeeded(request.requestId, nextState.clock.tick), this.projectionMessage()];
        } catch {
          return [failed(request.requestId, "INVALID_SNAPSHOT")];
        }
      }
    }
  }

  private projectionMessage(): WorkerResponse {
    if (!this.state) return failed(null, "INVALID_PAYLOAD");
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: null,
      type: "ProjectionPublished",
      payload: createViewProjection(this.state, true),
    };
  }

  private resetDiagnostics(): void {
    this.acceptedCommands = 0;
    this.rejectedCommands.clear();
  }

  private recordRejectedCommand(code: ErrorCode): void {
    this.rejectedCommands.set(code, (this.rejectedCommands.get(code) ?? 0) + 1);
  }

  private metrics(): SimulationMetrics {
    if (!this.state) throw new Error("Metrics require an initialized state");
    return {
      tick: parseTick(this.state.clock.tick),
      pendingCommands: this.state.pendingCommands.length,
      structures: this.state.structures.size,
      acceptedCommands: this.acceptedCommands,
      rejectedCommands: [...this.rejectedCommands.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((left, right) => left.code.localeCompare(right.code)),
    };
  }

  private metricsMessage(): WorkerResponse {
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: null,
      type: "SimulationMetricsPublished",
      payload: this.metrics(),
    };
  }
}
