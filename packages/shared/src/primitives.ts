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
export type CrewId = Brand<string, "CrewId">;
export type IncidentId = Brand<string, "IncidentId">;
export type DistrictId = Brand<string, "DistrictId">;
export type ParcelId = Brand<string, "ParcelId">;
export type BuildingId = Brand<string, "BuildingId">;
export type ConstructionSiteId = Brand<string, "ConstructionSiteId">;
export type TenantId = Brand<string, "TenantId">;
export type FacilityId = Brand<string, "FacilityId">;
export type TransactionId = Brand<string, "TransactionId">;
export type PolicyId = Brand<string, "PolicyId">;

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
export const crewIdSchema = entityIdSchema("crew").transform((value) => value as CrewId);
export const incidentIdSchema = entityIdSchema("incident").transform((value) => value as IncidentId);
export const districtIdSchema = entityIdSchema("district").transform(
  (value) => value as DistrictId,
);
export const parcelIdSchema = entityIdSchema("parcel").transform((value) => value as ParcelId);
export const buildingIdSchema = entityIdSchema("building").transform(
  (value) => value as BuildingId,
);
export const constructionSiteIdSchema = entityIdSchema("site").transform(
  (value) => value as ConstructionSiteId,
);
export const tenantIdSchema = entityIdSchema("tenant").transform((value) => value as TenantId);
export const facilityIdSchema = entityIdSchema("facility").transform(
  (value) => value as FacilityId,
);
export const transactionIdSchema = entityIdSchema("txn").transform(
  (value) => value as TransactionId,
);
export const policyIdSchema = entityIdSchema("policy").transform((value) => value as PolicyId);

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
export function parseCrewId(value: string): CrewId {
  return crewIdSchema.parse(value);
}
export function parseIncidentId(value: string): IncidentId {
  return incidentIdSchema.parse(value);
}

export function parseDistrictId(value: string): DistrictId {
  return districtIdSchema.parse(value);
}

export function parseParcelId(value: string): ParcelId {
  return parcelIdSchema.parse(value);
}

export function parseBuildingId(value: string): BuildingId {
  return buildingIdSchema.parse(value);
}

export function parseConstructionSiteId(value: string): ConstructionSiteId {
  return constructionSiteIdSchema.parse(value);
}

export function parseTenantId(value: string): TenantId {
  return tenantIdSchema.parse(value);
}

export function parseFacilityId(value: string): FacilityId {
  return facilityIdSchema.parse(value);
}

export function parseTransactionId(value: string): TransactionId {
  return transactionIdSchema.parse(value);
}

export function parsePolicyId(value: string): PolicyId {
  return policyIdSchema.parse(value);
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
