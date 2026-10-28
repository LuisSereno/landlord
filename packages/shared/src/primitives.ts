import { z } from "zod";

export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

export type ProtocolVersion = Brand<2, "ProtocolVersion">;
export type SchemaVersion = Brand<2, "SchemaVersion">;

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
export type LoanId = Brand<string, "LoanId">;
export type CityId = Brand<string, "CityId">;
export type CityProfileId = Brand<string, "CityProfileId">;
export type BlockId = Brand<string, "BlockId">;
export type DevelopmentCodeId = Brand<string, "DevelopmentCodeId">;
export type PublicSpaceId = Brand<string, "PublicSpaceId">;
export type UrbanFacilityId = Brand<string, "UrbanFacilityId">;
export type DistrictGatewayId = Brand<string, "DistrictGatewayId">;
export type DistrictConnectionId = Brand<string, "DistrictConnectionId">;
export type PermitId = Brand<string, "PermitId">;

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
export const incidentIdSchema = entityIdSchema("incident").transform(
  (value) => value as IncidentId,
);
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
export const loanIdSchema = entityIdSchema("loan").transform((value) => value as LoanId);
export const cityIdSchema = entityIdSchema("city").transform((value) => value as CityId);
export const publicSpaceIdSchema = entityIdSchema("publicspace").transform(
  (value) => value as PublicSpaceId,
);
export const urbanFacilityIdSchema = entityIdSchema("urbanfacility").transform(
  (value) => value as UrbanFacilityId,
);
export const permitIdSchema = entityIdSchema("permit").transform((value) => value as PermitId);

/**
 * Identifiers derived from canonical geometry rather than from a counter. A block, a gateway or a
 * connection has no emission order that means anything, so their ids come from a stable hash of the
 * thing they are (D-090). The numeric prefix form would imply an ordinal that the generator cannot
 * honestly promise.
 */
function geometryEntityIdSchema(prefix: string) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}_[0-9a-f]{8,16}$`))
    .transform((value) => value as string);
}

export const blockIdSchema = geometryEntityIdSchema("block").transform((value) => value as BlockId);
export const districtGatewayIdSchema = geometryEntityIdSchema("gateway").transform(
  (value) => value as DistrictGatewayId,
);
export const districtConnectionIdSchema = geometryEntityIdSchema("connection").transform(
  (value) => value as DistrictConnectionId,
);

/** Profile identifiers are authored slugs: renaming one breaks every save that references it (D-064). */
const profileIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/);
export const cityProfileIdSchema = profileIdSchema.transform((value) => value as CityProfileId);
export const developmentCodeIdSchema = profileIdSchema.transform(
  (value) => value as DevelopmentCodeId,
);

export const requestIdSchema = opaqueString.transform((value) => value as RequestId);
export const commandIdSchema = opaqueString.transform((value) => value as CommandId);
export const eventIdSchema = opaqueString.transform((value) => value as EventId);

/**
 * Protocol and snapshot versions are v2 (D-089). A v1 payload must fail here rather than be
 * silently reinterpreted: the single-district world it describes cannot be derived into nine.
 */
export const protocolVersionSchema = z.literal(2).transform((value) => value as ProtocolVersion);
export const schemaVersionSchema = z.literal(2).transform((value) => value as SchemaVersion);

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

export function parseLoanId(value: string): LoanId {
  return loanIdSchema.parse(value);
}

export function parseCityId(value: string): CityId {
  return cityIdSchema.parse(value);
}

export function parseCityProfileId(value: string): CityProfileId {
  return cityProfileIdSchema.parse(value);
}

export function parseBlockId(value: string): BlockId {
  return blockIdSchema.parse(value);
}

export function parseDevelopmentCodeId(value: string): DevelopmentCodeId {
  return developmentCodeIdSchema.parse(value);
}

export function parsePublicSpaceId(value: string): PublicSpaceId {
  return publicSpaceIdSchema.parse(value);
}

export function parseUrbanFacilityId(value: string): UrbanFacilityId {
  return urbanFacilityIdSchema.parse(value);
}

export function parseDistrictGatewayId(value: string): DistrictGatewayId {
  return districtGatewayIdSchema.parse(value);
}

export function parseDistrictConnectionId(value: string): DistrictConnectionId {
  return districtConnectionIdSchema.parse(value);
}

export function parsePermitId(value: string): PermitId {
  return permitIdSchema.parse(value);
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
