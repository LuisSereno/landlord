import { indexAssetStatus, type AssetStatusIndex } from "./asset-status";
import {
  CODE_PALETTE,
  MAP_COLORS,
  ROLE_COLORS,
  STATUS_COLORS,
  USE_COLORS,
  ZONING_COLORS,
  type MapOverlay,
} from "./overlay-catalog";
import type { Economy, ProjectedBuilding, ProjectedParcel } from "./types";

/**
 * V.d-UX.S · decisión de color de las capas del mapa, extraída de la escena a un helper puro.
 *
 * No es un refactor cosmético: antes una capa sin rama propia caía SILENCIOSAMENTE en el coloreado
 * de propiedad, así que añadir una capa nueva podía parecer que funcionaba mientras pintaba otra
 * cosa. El `Record` exhaustivo convierte ese fallo en error de compilación, y al ser puro se puede
 * probar la paridad de las capas existentes y el peor caso multi-edificio sin levantar Phaser.
 *
 * La escena sólo pinta el número que devuelve esta función (D-097: recibe el dato ya decidido).
 */

export type OverlayColorContext = {
  parcel: ProjectedParcel;
  economy: Economy;
  index: AssetStatusIndex;
};

type Resolver = (context: OverlayColorContext) => number;

/**
 * H2-01 · en una parcela multi-edificio el overlay enseña el peor caso, no el primero:
 * `parcel.buildingId` sólo publica el primer edificio derivado.
 */
function buildingsOf(context: OverlayColorContext): ProjectedBuilding[] {
  return context.economy.buildings.filter((entry) => entry.parcelIds.includes(context.parcel.id));
}

function coverageColor(overlay: string, context: OverlayColorContext): number {
  const buildings = buildingsOf(context);
  /**
   * H2-05 · un solar vacío no consume capacidad: su cobertura activa es 0 y pintarlo «sin
   * cobertura» era alarmante y falso. Lo que necesita saber el jugador es si el servicio LLEGARÍA
   * al construir, así que se usa la cobertura potencial cuando existe. `transport` es
   * accesibilidad, no capacidad, y no tiene potencial.
   */
  const vacant = buildings.length === 0;
  const potential =
    overlay === "transport"
      ? undefined
      : context.parcel.potentialService?.[overlay as "security" | "fire" | "health" | "education"];
  const coverage =
    vacant && potential !== undefined
      ? potential
      : (context.parcel.serviceCoverage?.[overlay as "security"] ?? 0);
  if (coverage >= 75) return MAP_COLORS.parcelPlayer;
  if (coverage >= 40) return MAP_COLORS.construction;
  if (coverage > 0) return MAP_COLORS.parcelAvailable;
  return MAP_COLORS.fire;
}

function ownershipColor(context: OverlayColorContext): number {
  const owner = context.parcel.ownerOrganizationId;
  if (owner === "org_00000001") return MAP_COLORS.parcelPlayer;
  if (owner === "org_00000002") return MAP_COLORS.parcelRival;
  if (owner === "org_00000004") return MAP_COLORS.parcelCivic;
  return MAP_COLORS.parcelAvailable;
}

function encumbranceColor(context: OverlayColorContext): number {
  const load = context.index.loadsByParcelId.get(context.parcel.id);
  if (!load) return STATUS_COLORS.unknown;
  switch (load.kind) {
    case "auction":
    case "defaulted":
      return STATUS_COLORS.loss;
    case "delinquent":
      return STATUS_COLORS.arrears;
    case "loan":
      return STATUS_COLORS.lien;
    case "auction_bid":
      return STATUS_COLORS.opportunity;
    case "none":
      return STATUS_COLORS.occupied;
    case "unknown":
      return STATUS_COLORS.unknown;
  }
}

/** Peor ocupación conocida de la parcela. Lo ajeno no se publica: nunca se pinta como vacío. */
function occupancyColor(context: OverlayColorContext): number {
  const buildings = buildingsOf(context);
  if (buildings.length === 0) return STATUS_COLORS.neutral;
  let known = 0;
  let production = 0;
  let worst: "full" | "partial" | "empty" = "full";
  for (const building of buildings) {
    const status = context.index.statusByBuildingId.get(building.id);
    if (!status || status.occupancy === "unknown") continue;
    if (status.occupancy === "production") {
      production += 1;
      continue;
    }
    known += 1;
    if (status.occupancy === "empty") worst = "empty";
    else if (status.occupancy === "partial" && worst !== "empty") worst = "partial";
  }
  if (known === 0) return production > 0 ? STATUS_COLORS.upkeep : STATUS_COLORS.unknown;
  if (worst === "empty") return STATUS_COLORS.vacancy;
  if (worst === "partial") return STATUS_COLORS.partial;
  return STATUS_COLORS.occupied;
}

/** Peor cobertura conocida: una póliza vencida pesa más que un edificio sin seguro. */
function insuranceColor(context: OverlayColorContext): number {
  const buildings = buildingsOf(context);
  let known = 0;
  let worst: "active" | "none" | "lapsed" = "active";
  for (const building of buildings) {
    const status = context.index.statusByBuildingId.get(building.id);
    if (!status || status.insurance === "unknown") continue;
    known += 1;
    if (status.insurance === "lapsed") worst = "lapsed";
    else if (status.insurance === "none" && worst !== "lapsed") worst = "none";
  }
  if (known === 0) return STATUS_COLORS.unknown;
  if (worst === "lapsed") return STATUS_COLORS.arrears;
  if (worst === "none") return STATUS_COLORS.uninsured;
  return STATUS_COLORS.occupied;
}

const RESOLVERS: Record<Exclude<MapOverlay, "none">, Resolver> = {
  ownership: ownershipColor,
  condition: (context) => {
    const buildings = buildingsOf(context);
    if (buildings.length === 0) return MAP_COLORS.parcelAvailable;
    const worst = Math.min(...buildings.map((entry) => entry.condition));
    if (worst <= 35) return MAP_COLORS.fire;
    if (worst <= 70) return MAP_COLORS.construction;
    return MAP_COLORS.parcelPlayer;
  },
  profitability: (context) => {
    const buildings = buildingsOf(context);
    if (buildings.length === 0) return MAP_COLORS.parcelAvailable;
    const rent = buildings.reduce((total, entry) => total + entry.effectiveRent, 0);
    const due = buildings.reduce((total, entry) => total + entry.maintenanceDue, 0);
    if (rent <= due) return MAP_COLORS.fire;
    if (rent < due * 2) return MAP_COLORS.construction;
    return MAP_COLORS.parcelPlayer;
  },
  zoning: (context) => ZONING_COLORS[context.parcel.zoning],
  risk: (context) => {
    const risk = context.parcel.regulatoryRiskPercent;
    if (risk >= 30) return MAP_COLORS.fire;
    if (risk >= 15) return MAP_COLORS.construction;
    return MAP_COLORS.parcelPlayer;
  },
  landValue: (context) => {
    const score = context.parcel.landValueBreakdown.score;
    if (score >= 25) return MAP_COLORS.parcelPlayer;
    if (score >= 5) return MAP_COLORS.construction;
    if (score >= -10) return MAP_COLORS.parcelAvailable;
    return MAP_COLORS.fire;
  },
  urbanRole: (context) => {
    const colors: Record<string, number> = ROLE_COLORS;
    return colors[context.parcel.urbanRole] ?? MAP_COLORS.parcelAvailable;
  },
  developmentCode: (context) => {
    const id = context.parcel.developmentCodeId;
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }
    return CODE_PALETTE[hash % CODE_PALETTE.length]!;
  },
  use: (context) => {
    const use = context.parcel.currentUses[0] ?? context.parcel.allowedUses[0] ?? "residential";
    return USE_COLORS[use] ?? MAP_COLORS.parcelAvailable;
  },
  security: (context) => coverageColor("security", context),
  fire: (context) => coverageColor("fire", context),
  health: (context) => coverageColor("health", context),
  education: (context) => coverageColor("education", context),
  transport: (context) => coverageColor("transport", context),
  encumbrances: encumbranceColor,
  occupancy: occupancyColor,
  insurance: insuranceColor,
};

/** Color de una capa para una parcela. `none` no se resuelve: la escena no pinta overlay. */
export function parcelOverlayColor(
  overlay: Exclude<MapOverlay, "none">,
  context: OverlayColorContext,
): number {
  return RESOLVERS[overlay](context);
}

/** Índice de estado para una proyección: la escena lo construye una vez por publicación. */
export function overlayIndexFor(economy: Economy | undefined): AssetStatusIndex {
  return indexAssetStatus(economy);
}
