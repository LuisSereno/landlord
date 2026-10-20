import { z } from "zod";

import {
  protocolVersionSchema,
  requestIdSchema,
  type ProtocolVersion,
  type RequestId,
} from "./primitives";
import { tickSchema, type Tick } from "./time-and-grid";

export type ErrorCode =
  | "DUPLICATE_COMMAND"
  | "PERSON_NOT_FOUND"
  | "ORGANIZATION_NOT_FOUND"
  | "ACTOR_NOT_AUTHORIZED"
  | "CELL_OUT_OF_BOUNDS"
  | "CELL_OCCUPIED"
  | "INVALID_PAYLOAD"
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_SNAPSHOT"
  | "INCOMPATIBLE_SCHEMA";

const responseVersion = protocolVersionSchema;

export type RequestSucceeded = {
  protocolVersion: ProtocolVersion;
  requestId: RequestId;
  type: "RequestSucceeded";
  payload: {
    acceptedAtTick: Tick;
    result?: unknown;
  };
};

export const requestSucceededSchema = z.object({
  protocolVersion: responseVersion,
  requestId: requestIdSchema,
  type: z.literal("RequestSucceeded"),
  payload: z.object({
    acceptedAtTick: tickSchema,
    result: z.unknown().optional(),
  }),
});

export type RequestFailed = {
  protocolVersion: ProtocolVersion;
  requestId: RequestId;
  type: "RequestFailed";
  payload: {
    code: ErrorCode;
    message: string;
    details?: Record<string, string | number | boolean>;
  };
};

const errorCodeSchema = z.enum([
  "DUPLICATE_COMMAND",
  "PERSON_NOT_FOUND",
  "ORGANIZATION_NOT_FOUND",
  "ACTOR_NOT_AUTHORIZED",
  "CELL_OUT_OF_BOUNDS",
  "CELL_OCCUPIED",
  "INVALID_PAYLOAD",
  "UNSUPPORTED_PROTOCOL",
  "INVALID_SNAPSHOT",
  "INCOMPATIBLE_SCHEMA",
]);

export const requestFailedSchema = z.object({
  protocolVersion: responseVersion,
  requestId: requestIdSchema,
  type: z.literal("RequestFailed"),
  payload: z.object({
    code: errorCodeSchema,
    message: z.string().min(1).max(500),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
});

export type ProjectionPublished = {
  protocolVersion: ProtocolVersion;
  requestId: null;
  type: "ProjectionPublished";
  payload: unknown;
};

export const projectionPublishedSchema = z.object({
  protocolVersion: responseVersion,
  requestId: z.null(),
  type: z.literal("ProjectionPublished"),
  payload: z.unknown(),
});

export type SimulationMetricsPublished = {
  protocolVersion: ProtocolVersion;
  requestId: null;
  type: "SimulationMetricsPublished";
  payload: unknown;
};

export const simulationMetricsPublishedSchema = z.object({
  protocolVersion: responseVersion,
  requestId: z.null(),
  type: z.literal("SimulationMetricsPublished"),
  payload: z.unknown(),
});

export const workerResponseSchemas = [
  requestSucceededSchema,
  requestFailedSchema,
  projectionPublishedSchema,
  simulationMetricsPublishedSchema,
] as const;
