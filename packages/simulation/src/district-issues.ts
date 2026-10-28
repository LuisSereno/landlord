/**
 * Structural issues of the v2 district generator (D-090).
 *
 * Every issue is a reason to retry the district with another attempt seed. The generator never
 * publishes a district with an unmarketable parcel: a broken district is worse than a generator
 * that fails, because the player loads it and cannot build.
 */
export type DistrictGenerationIssueCode =
  | "INSUFFICIENT_PARCELS"
  | "ZONING_SHORTAGE"
  | "ZONING_CONCENTRATION"
  | "UNAFFORDABLE_ENTRY"
  | "DUPLICATE_PARCEL_CELL"
  | "PARCEL_ADJACENCY"
  | "SPAWN_BLOCKED"
  | "PARCEL_WITHOUT_ACCESS"
  | "ROAD_SEGMENTS_INVALID"
  | "ROAD_CROSSES_PARCEL"
  | "ROAD_UNREACHABLE_SPAWNS"
  | "BLOCK_UNASSIGNED_CELLS"
  | "BLOCK_DISCONNECTED"
  | "PARCEL_DISCONNECTED"
  | "PARCEL_WITHOUT_ROAD_FRONTAGE"
  | "PARCEL_TOO_NARROW"
  | "PARCEL_TOO_DEEP"
  | "GATEWAY_NOT_CONNECTED"
  | "PUBLIC_RESERVATION_INVALID"
  | "FACILITY_SITE_INVALID";

export type DistrictGenerationIssue = {
  code: DistrictGenerationIssueCode;
  detail: string;
};
