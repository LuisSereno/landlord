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
  | "INCOMPATIBLE_SCHEMA"
  | "PARCEL_NOT_FOUND"
  | "PARCEL_UNAVAILABLE"
  | "INSUFFICIENT_FUNDS"
  | "BUILDING_NOT_FOUND"
  | "INVALID_ZONING"
  | "INSUFFICIENT_RESOURCES"
  | "CONSTRUCTION_ALREADY_ACTIVE"
  | "CONSTRUCTION_SITE_NOT_FOUND"
  | "CREW_UNAVAILABLE"
  | "TENANT_NOT_FOUND"
  | "TENANT_INCOMPATIBLE"
  | "TENANT_ALREADY_ASSIGNED"
  | "POLICY_NOT_AVAILABLE"
  | "INFLUENCE_TOO_LOW"
  | "CRIME_TARGET_INVALID"
  | "TENANT_BUDGET_TOO_LOW"
  | "INVENTORY_CAPACITY"
  | "FACILITY_ALREADY_ACTIVE"
  | "FACILITY_NOT_FOUND"
  | "INVALID_CREW_ALLOCATION"
  | "BUILDING_CONDITION_FULL"
  | "CRIME_COOLDOWN"
  | "CREW_NOT_FOUND"
  | "AGENT_NOT_FOUND"
  | "INVALID_AGENT_ACTION"
  | "RUIN_REQUIRED"
  | "LOAN_COLLATERAL_INVALID"
  | "LOAN_AMOUNT_INVALID"
  | "LOAN_CAPACITY_EXCEEDED"
  | "LOAN_NOT_FOUND"
  | "LOAN_NOT_AVAILABLE"
  | "LOAN_ALREADY_ACTIVE"
  | "LOAN_DEFAULTED"
  | "INSURANCE_BUILDING_INVALID"
  | "INSURANCE_ALREADY_ACTIVE"
  | "INSURANCE_NOT_FOUND"
  | "PERMIT_DENIED"
  | "AUCTION_NOT_FOUND"
  | "AUCTION_NOT_OPEN"
  | "AUCTION_BID_TOO_LOW"
  | "AUCTION_FUNDS_RESERVED"
  | "AUCTION_NOT_BIDDER"
  | "LOAN_REFINANCE_UNAVAILABLE"
  | "SELL_NOT_AVAILABLE"
  | "CONTRACT_NOT_FOUND"
  | "CONTRACT_CLOSED"
  | "CONTRACT_CONFLICT"
  | "CONTRACT_CAPACITY"
  | "BID_ALREADY_SUBMITTED"
  | "BID_EXCEEDS_BUDGET"
  | "BOND_UNAVAILABLE";

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
  "PARCEL_NOT_FOUND",
  "PARCEL_UNAVAILABLE",
  "INSUFFICIENT_FUNDS",
  "BUILDING_NOT_FOUND",
  "INVALID_ZONING",
  "INSUFFICIENT_RESOURCES",
  "CONSTRUCTION_ALREADY_ACTIVE",
  "CONSTRUCTION_SITE_NOT_FOUND",
  "CREW_UNAVAILABLE",
  "TENANT_NOT_FOUND",
  "TENANT_INCOMPATIBLE",
  "TENANT_ALREADY_ASSIGNED",
  "POLICY_NOT_AVAILABLE",
  "INFLUENCE_TOO_LOW",
  "CRIME_TARGET_INVALID",
  "TENANT_BUDGET_TOO_LOW",
  "INVENTORY_CAPACITY",
  "FACILITY_ALREADY_ACTIVE",
  "FACILITY_NOT_FOUND",
  "INVALID_CREW_ALLOCATION",
  "BUILDING_CONDITION_FULL",
  "CRIME_COOLDOWN",
  "CREW_NOT_FOUND",
  "AGENT_NOT_FOUND",
  "INVALID_AGENT_ACTION",
  "RUIN_REQUIRED",
  "LOAN_COLLATERAL_INVALID",
  "LOAN_AMOUNT_INVALID",
  "LOAN_CAPACITY_EXCEEDED",
  "LOAN_NOT_FOUND",
  "LOAN_NOT_AVAILABLE",
  "LOAN_ALREADY_ACTIVE",
  "LOAN_DEFAULTED",
  "INSURANCE_BUILDING_INVALID",
  "INSURANCE_ALREADY_ACTIVE",
  "INSURANCE_NOT_FOUND",
  "PERMIT_DENIED",
  "AUCTION_NOT_FOUND",
  "AUCTION_NOT_OPEN",
  "AUCTION_BID_TOO_LOW",
  "AUCTION_FUNDS_RESERVED",
  "AUCTION_NOT_BIDDER",
  "LOAN_REFINANCE_UNAVAILABLE",
  "SELL_NOT_AVAILABLE",
  "CONTRACT_NOT_FOUND",
  "CONTRACT_CLOSED",
  "CONTRACT_CONFLICT",
  "CONTRACT_CAPACITY",
  "BID_ALREADY_SUBMITTED",
  "BID_EXCEEDS_BUDGET",
  "BOND_UNAVAILABLE",
]);

export const simulationMetricsSchema = z.object({
  tick: tickSchema,
  pendingCommands: z.number().int().nonnegative(),
  structures: z.number().int().nonnegative(),
  acceptedCommands: z.number().int().nonnegative(),
  rejectedCommands: z.array(
    z.object({
      code: errorCodeSchema,
      count: z.number().int().positive(),
    }),
  ),
});

export type SimulationMetrics = z.infer<typeof simulationMetricsSchema>;

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
  payload: SimulationMetrics;
};

export const simulationMetricsPublishedSchema = z.object({
  protocolVersion: responseVersion,
  requestId: z.null(),
  type: z.literal("SimulationMetricsPublished"),
  payload: simulationMetricsSchema,
});

export const workerResponseSchemas = [
  requestSucceededSchema,
  requestFailedSchema,
  projectionPublishedSchema,
  simulationMetricsPublishedSchema,
] as const;

export const workerResponseSchema = z.discriminatedUnion("type", [
  requestSucceededSchema,
  requestFailedSchema,
  projectionPublishedSchema,
  simulationMetricsPublishedSchema,
]);

export type WorkerResponse = z.infer<typeof workerResponseSchema>;
