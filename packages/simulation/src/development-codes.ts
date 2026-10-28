import {
  parseDevelopmentCodeId,
  type DevelopmentCode,
  type DevelopmentCodeId,
  type UrbanRole,
} from "@landlord/shared";

/**
 * Initial development-code catalog (§4.2 of PLAN_improvements.md). V.d.1 only needs the identity
 * and the role mapping so `Block.defaultDevelopmentCodeId` is a real, authored value; V.d.2 turns
 * the envelope fields into permit rules.
 */
function code(
  id: string,
  allowedUses: DevelopmentCode["allowedUses"],
  maxFloors: number,
  maxCoveragePercent: number,
  maxFloorAreaRatioPercent: number,
  streetSetbackCells: number,
): DevelopmentCode {
  return {
    id: parseDevelopmentCodeId(id),
    allowedUses,
    maxFloors,
    maxCoveragePercent,
    maxFloorAreaRatioPercent,
    streetSetbackCells,
    sideSetbackCells: 0,
  };
}

export const DEVELOPMENT_CODES: Record<string, DevelopmentCode> = {
  res_low_2f: code("res_low_2f", ["residential"], 2, 60, 120, 1),
  res_urban_4f: code("res_urban_4f", ["residential"], 4, 80, 280, 0),
  mixed_core_5f: code("mixed_core_5f", ["residential", "retail", "office"], 5, 90, 400, 0),
  commercial_corridor_4f: code(
    "commercial_corridor_4f",
    ["retail", "office", "residential"],
    4,
    85,
    320,
    0,
  ),
  industrial_yard_2f: code("industrial_yard_2f", ["industrial", "utility"], 2, 65, 100, 1),
  institutional_3f: code("institutional_3f", ["civic", "education", "health"], 3, 70, 180, 1),
  civic_landmark_5f: code("civic_landmark_5f", ["civic"], 5, 75, 220, 0),
};

export const DEFAULT_DEVELOPMENT_CODE_BY_ROLE: Record<UrbanRole, DevelopmentCodeId> = {
  low_density_residential: DEVELOPMENT_CODES.res_low_2f!.id,
  urban_residential: DEVELOPMENT_CODES.res_urban_4f!.id,
  mixed_core: DEVELOPMENT_CODES.mixed_core_5f!.id,
  commercial_corridor: DEVELOPMENT_CODES.commercial_corridor_4f!.id,
  industrial_logistics: DEVELOPMENT_CODES.industrial_yard_2f!.id,
  institutional: DEVELOPMENT_CODES.institutional_3f!.id,
  civic_core: DEVELOPMENT_CODES.civic_landmark_5f!.id,
  green_open_space: DEVELOPMENT_CODES.res_low_2f!.id,
};
