import {
  parseRequestId,
  parseTick,
  protocolVersionSchema,
  requestIdSchema,
  workerRequestSchema,
  type RequestId,
  type WorkerRequest,
  type WorkerResponse,
} from "@landlord/shared";
import { dispatchPlaceTestStructure } from "./commands";
import { createViewProjection } from "./projection";
import { createInitialState, type GameState } from "./state";

const errorMessages = {
  DUPLICATE_COMMAND: "The command has already been processed.",
  PERSON_NOT_FOUND: "The issuing person does not exist.",
  ORGANIZATION_NOT_FOUND: "The acting organization does not exist.",
  ACTOR_NOT_AUTHORIZED: "The person cannot act for this organization.",
  CELL_OUT_OF_BOUNDS: "The target cell is outside the map.",
  CELL_OCCUPIED: "The target cell is occupied.",
  INVALID_PAYLOAD: "The request payload is invalid for the current protocol.",
  UNSUPPORTED_PROTOCOL: "The request protocol version is unsupported.",
  INVALID_SNAPSHOT: "The snapshot is invalid or unavailable in this runtime.",
  INCOMPATIBLE_SCHEMA: "The snapshot schema is incompatible.",
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
  private pendingCommands: Array<{
    requestId: RequestId;
    command: Extract<WorkerRequest, { type: "SubmitCommand" }>["payload"]["command"];
  }> = [];

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
      const pending = this.pendingCommands;
      this.pendingCommands = [];
      for (const queued of pending) {
        const result = dispatchPlaceTestStructure(this.state, queued.command);
        if (result.accepted) {
          responses.push(succeeded(queued.requestId, tick, result.event));
        } else {
          responses.push(failed(queued.requestId, result.code));
        }
      }
      this.state.clock = { ...this.state.clock, tick: parseTick(tick + 1) };
      if (this.state.clock.tick % 2 === 0) responses.push(this.projectionMessage());
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
        this.pendingCommands = [];
        return [succeeded(request.requestId, this.state.clock.tick), this.projectionMessage()];
      }
      case "SubmitCommand": {
        if (!this.state) return [failed(request.requestId, "INVALID_PAYLOAD")];
        const alreadyPending = this.pendingCommands.some(
          (pending) => pending.command.commandId === request.payload.command.commandId,
        );
        if (
          alreadyPending ||
          this.state.processedCommandIds.has(request.payload.command.commandId)
        ) {
          return [failed(request.requestId, "DUPLICATE_COMMAND")];
        }
        this.pendingCommands.push({
          requestId: request.requestId,
          command: request.payload.command,
        });
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
            tick: this.state.clock.tick,
            pendingCommands: this.pendingCommands.length,
            structures: this.state.structures.size,
          }),
        ];
      }
      case "SaveSnapshot":
      case "LoadSnapshot":
        return [failed(request.requestId, "INVALID_SNAPSHOT")];
    }
  }

  private projectionMessage(): WorkerResponse {
    if (!this.state) return failed(null, "INVALID_PAYLOAD");
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: null,
      type: "ProjectionPublished",
      payload: createViewProjection(this.state),
    };
  }
}
