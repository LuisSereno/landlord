import { z } from "zod";

import {
  protocolVersionSchema,
  requestIdSchema,
  type ProtocolVersion,
  type RequestId,
} from "./primitives";
import { seedSchema, type Seed } from "./time-and-grid";
import { productCommandSchema, type ProductCommand } from "./domain";

export type RequestEnvelope<TType extends string, TPayload> = {
  protocolVersion: ProtocolVersion;
  requestId: RequestId;
  type: TType;
  payload: TPayload;
};

const requestEnvelopeShape = {
  protocolVersion: protocolVersionSchema,
  requestId: requestIdSchema,
};

const requestEnvelopeSchema = <TType extends string, TPayload extends z.ZodType>(
  type: TType,
  payload: TPayload,
) =>
  z.object({
    ...requestEnvelopeShape,
    type: z.literal(type),
    payload,
  });

export type InitializeGameRequest = RequestEnvelope<"InitializeGame", { seed: Seed }>;
export const initializeGameRequestSchema = requestEnvelopeSchema(
  "InitializeGame",
  z.object({ seed: seedSchema }),
);

export type SubmitCommandRequest = RequestEnvelope<
  "SubmitCommand",
  {
    command: ProductCommand;
  }
>;
export const submitCommandRequestSchema = requestEnvelopeSchema(
  "SubmitCommand",
  z.object({ command: productCommandSchema }),
);

export type SetRunStateRequest = RequestEnvelope<
  "SetRunState",
  { state: "paused" | "running"; speed: 1 | 2 | 4 }
>;
export const setRunStateRequestSchema = requestEnvelopeSchema(
  "SetRunState",
  z.object({
    state: z.enum(["paused", "running"]),
    speed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  }),
);

export type SaveSnapshotRequest = RequestEnvelope<"SaveSnapshot", Record<string, never>>;
export const saveSnapshotRequestSchema = requestEnvelopeSchema(
  "SaveSnapshot",
  z.object({}).strict(),
);

export type LoadSnapshotRequest = RequestEnvelope<"LoadSnapshot", { snapshot: unknown }>;
export const loadSnapshotRequestSchema = requestEnvelopeSchema(
  "LoadSnapshot",
  z.object({ snapshot: z.unknown() }),
);

export type GetMetricsRequest = RequestEnvelope<"GetMetrics", Record<string, never>>;
export const getMetricsRequestSchema = requestEnvelopeSchema("GetMetrics", z.object({}).strict());

export const workerRequestSchemas = [
  initializeGameRequestSchema,
  submitCommandRequestSchema,
  setRunStateRequestSchema,
  saveSnapshotRequestSchema,
  loadSnapshotRequestSchema,
  getMetricsRequestSchema,
] as const;

export const workerRequestSchema = z.discriminatedUnion("type", [
  initializeGameRequestSchema,
  submitCommandRequestSchema,
  setRunStateRequestSchema,
  saveSnapshotRequestSchema,
  loadSnapshotRequestSchema,
  getMetricsRequestSchema,
]);

export type WorkerRequest = z.infer<typeof workerRequestSchema>;
