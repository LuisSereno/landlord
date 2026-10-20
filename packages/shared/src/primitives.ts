import { z } from "zod";

export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

export type ProtocolVersion = Brand<1, "ProtocolVersion">;
export type SchemaVersion = Brand<1, "SchemaVersion">;

export type PlayerIdentityId = Brand<string, "PlayerIdentityId">;
export type PersonId = Brand<string, "PersonId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type StructureId = Brand<string, "StructureId">;
export type AgentId = Brand<string, "AgentId">;

export type RequestId = Brand<string, "RequestId">;
export type CommandId = Brand<string, "CommandId">;
export type EventId = Brand<string, "EventId">;

const opaqueString = z.string().min(1).max(128);

function entityIdSchema(prefix: string) {
  return z.string().regex(new RegExp(`^${prefix}_[0-9]{8}$`));
}

export const playerIdentityIdSchema = entityIdSchema("player").transform(
  (value) => value as PlayerIdentityId,
);
export const personIdSchema = entityIdSchema("person").transform((value) => value as PersonId);
export const organizationIdSchema = entityIdSchema("org").transform(
  (value) => value as OrganizationId,
);
export const structureIdSchema = entityIdSchema("structure").transform(
  (value) => value as StructureId,
);
export const agentIdSchema = entityIdSchema("agent").transform((value) => value as AgentId);

export const requestIdSchema = opaqueString.transform((value) => value as RequestId);
export const commandIdSchema = opaqueString.transform((value) => value as CommandId);
export const eventIdSchema = opaqueString.transform((value) => value as EventId);

export const protocolVersionSchema = z.literal(1).transform((value) => value as ProtocolVersion);
export const schemaVersionSchema = z.literal(1).transform((value) => value as SchemaVersion);

export function parsePlayerIdentityId(value: string): PlayerIdentityId {
  return playerIdentityIdSchema.parse(value);
}

export function parsePersonId(value: string): PersonId {
  return personIdSchema.parse(value);
}

export function parseOrganizationId(value: string): OrganizationId {
  return organizationIdSchema.parse(value);
}

export function parseStructureId(value: string): StructureId {
  return structureIdSchema.parse(value);
}

export function parseAgentId(value: string): AgentId {
  return agentIdSchema.parse(value);
}

export function parseRequestId(value: string): RequestId {
  return requestIdSchema.parse(value);
}

export function parseCommandId(value: string): CommandId {
  return commandIdSchema.parse(value);
}

export function parseEventId(value: string): EventId {
  return eventIdSchema.parse(value);
}
