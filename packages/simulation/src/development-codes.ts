import {
  parseDevelopmentCodeId,
  type BuildingDefinition,
  type LandUse,
  type DevelopmentCode,
  type DevelopmentCodeId,
  type Ordinance,
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

/** Coarse family used only for price bands, suitability and display; never for a rule. */
export function zoningFamilyForRole(role: UrbanRole): "residential" | "mixed" | "industrial" {
  if (role === "industrial_logistics") return "industrial";
  if (
    role === "mixed_core" ||
    role === "commercial_corridor" ||
    role === "civic_core" ||
    role === "institutional"
  )
    return "mixed";
  return "residential";
}

export function developmentCodeForRole(role: UrbanRole): DevelopmentCode {
  const id = DEFAULT_DEVELOPMENT_CODE_BY_ROLE[role];
  const code = Object.values(DEVELOPMENT_CODES).find((entry) => entry.id === id);
  if (!code) throw new RangeError(`No development code for role ${role}`);
  return code;
}

export function developmentCodeForAnchorUse(use: LandUse): DevelopmentCode {
  if (use === "industrial" || use === "utility") return DEVELOPMENT_CODES.industrial_yard_2f!;
  if (use === "civic" || use === "education" || use === "health")
    return DEVELOPMENT_CODES.institutional_3f!;
  if (use === "retail" || use === "office") return DEVELOPMENT_CODES.mixed_core_5f!;
  return DEVELOPMENT_CODES.res_urban_4f!;
}

export function developmentCodeById(id: DevelopmentCodeId): DevelopmentCode {
  const code = DEVELOPMENT_CODES[id];
  if (!code) throw new RangeError(`Unknown development code: ${id}`);
  return code;
}

/**
 * Regla autoritativa de compatibilidad entre edificio y DevelopmentCode (H1-04). `allowedUses` del
 * edificio es el conjunto de usos con los que es compatible —heredero del antiguo conjunto de
 * zonificaciones—, no una lista de requisitos acumulativos: leído como `every`, `workshop`
 * (`industrial` + `retail`) no podía construirse en ningún código de la ciudad. Un edificio municipal
 * nunca está disponible para una empresa. Backend, proyección y UI consumen esta única función.
 */
export function isBuildingAllowedByDevelopmentCode(
  definition: BuildingDefinition,
  code: DevelopmentCode,
): boolean {
  if (definition.municipal) return false;
  return definition.allowedUses.some((use) => code.allowedUses.includes(use));
}

/**
 * Densidad que la ordenanza vigente añade al código de un rol (V.d.4, H1-09). Es la oportunidad
 * urbanística del suelo mientras la ordenanza está activa, y por eso la leen tanto el permision
 * (derecho adquirido) como el valor del suelo (potencial normativo vigente). Los derechos de un
 * permiso concreto no pasan por aquí: un permiso no revaloriza toda la ciudad.
 */
/** La parte de la ordenanza que decide densidad: suficiente para el motor y para el valor del suelo. */
export type OrdinanceDensity = Pick<
  Ordinance,
  "status" | "densityAppliesToRole" | "densityBonusFloors" | "densityBonusFarPercent"
>;

export function effectiveDensityBonus(
  ordinance: OrdinanceDensity,
  role: UrbanRole | null | undefined,
): { floors: number; farPercent: number } {
  if (role === null || role === undefined) return { floors: 0, farPercent: 0 };
  if (ordinance.status !== "active" || ordinance.densityAppliesToRole !== role)
    return { floors: 0, farPercent: 0 };
  return {
    floors: ordinance.densityBonusFloors,
    farPercent: ordinance.densityBonusFarPercent,
  };
}

/** Code plus the density rights an approved permit acquired under a trial ordinance (V.d.4). */
export function effectiveDevelopmentCode(
  id: DevelopmentCodeId,
  bonusFloors: number,
  bonusFarPercent: number,
): DevelopmentCode {
  const code = developmentCodeById(id);
  if (bonusFloors === 0 && bonusFarPercent === 0) return code;
  return {
    ...code,
    maxFloors: code.maxFloors + bonusFloors,
    maxFloorAreaRatioPercent: code.maxFloorAreaRatioPercent + bonusFarPercent,
  };
}

/** The display family of a parcel is derived from its code, never stored on the parcel. */
export function zoningFamilyForCode(code: DevelopmentCode): "residential" | "mixed" | "industrial" {
  if (code.allowedUses.includes("industrial")) return "industrial";
  if (code.allowedUses.some((use) => use === "retail" || use === "office")) return "mixed";
  return "residential";
}

/** Display/economic family of a parcel, derived from its development code. */
export function zoningFamilyForParcel(parcel: {
  developmentCodeId: DevelopmentCodeId;
}): "residential" | "mixed" | "industrial" {
  return zoningFamilyForCode(developmentCodeById(parcel.developmentCodeId));
}
