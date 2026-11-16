import { footprintVisualCenter } from "../isometric/building-sprites";
import { indexAssetStatus, occupancyText, type BuildingStatus } from "./asset-status";
import type { UiIconName } from "./icons";
import { constructionKindLabel, insuranceStateLabel } from "./labels";
import type { StatusTone } from "./overlay-catalog";
import type { Economy } from "./types";

/**
 * V.d-UX.S · avisos espaciales del mundo (spec §9). Sólo información accionable del jugador, con
 * prioridad por consecuencia y un marcador por edificio como máximo: los hechos secundarios se
 * pliegan en el detalle del tooltip en vez de competir por el mismo punto de pantalla.
 *
 * La carga hipotecaria al día NO es un badge: es identidad del activo y vive en la placa de parcela
 * (`parcel-marks.ts`) y en la capa de datos. Un badge flotante es una interrupción, y una hipoteca
 * al día no interrumpe nada.
 */

export type WorldIndicatorKind =
  "danger" | "auction" | "debt" | "maintenance" | "insurance" | "blocked" | "upkeep" | "vacancy";

export type PanelSection = "summary" | "tenants" | "maintenance" | "insurance" | "finance";

export type WorldIndicator = {
  key: string;
  kind: WorldIndicatorKind;
  critical: boolean;
  cell: { x: number; y: number };
  label: string;
  detail: readonly string[];
  parcelId: string;
  buildingId?: string;
  glyph: UiIconName;
  tone: StatusTone;
  section?: PanelSection;
};

export type PanelSectionRequest = { section: PanelSection; token: number };

const PLAYER = "org_00000001";
const MAX_INDICATORS = 12;

/**
 * Niveles por consecuencia, no por categoría. El 1 agrupa la pérdida irreversible del activo: el
 * fuego puede extinguirse con un técnico, pero el colapso y la adjudicación de una subasta no se
 * revierten — la parcela y todos sus edificios cambian de dueño. Dentro del mismo nivel el orden
 * es determinista y el físico precede al financiero, como pide el spec §9.
 */
const TIER_LOSS = 1;
const TIER_CONDITION = 2;
const TIER_BLOCKED = 3;
const TIER_PENDING = 4;
const TIER_SECONDARY = 5;

type Candidate = { indicator: WorldIndicator; tier: number; rank: number };

function buildingDetail(status: BuildingStatus): string[] {
  const detail: string[] = [];
  if (status.backlog > 0) detail.push(`Mantenimiento atrasado: ${status.backlog} u. acumuladas`);
  if (status.occupancy !== "production") detail.push(occupancyText(status));
  if (status.insurance !== "unknown" && status.insurance !== "active")
    detail.push(insuranceStateLabel(status.insurance));
  if (status.upgraded) detail.push("Mejora completada");
  return detail;
}

/**
 * Qué avisos se dibujan sobre el mundo. Pura y determinista: un badge por edificio (el de mayor
 * consecuencia), un badge financiero por parcela, rivales fuera, tope global y orden estable.
 */
export function deriveWorldIndicators(
  economy: Economy | undefined,
  limit = MAX_INDICATORS,
): WorldIndicator[] {
  if (!economy) return [];
  const index = indexAssetStatus(economy);
  const candidates: Candidate[] = [];
  const push = (tier: number, rank: number, indicator: WorldIndicator): void => {
    candidates.push({ indicator, tier, rank });
  };

  for (const building of economy.buildings) {
    if (building.ownerOrganizationId !== PLAYER) continue;
    const cell = footprintVisualCenter(building.footprintCells);
    const parcelId = building.parcelIds[0]!;
    const status = index.statusByBuildingId.get(building.id);
    const detail = status ? buildingDetail(status) : [];
    const base = { cell, parcelId, buildingId: building.id, detail };

    if (building.state === "burning" || building.state === "collapse_pending") {
      push(TIER_LOSS, 0, {
        ...base,
        key: `building:${building.id}:danger`,
        kind: "danger",
        critical: true,
        label:
          building.state === "burning"
            ? "Incendio activo: revisa el edificio"
            : "Riesgo de colapso: revisa el edificio",
        glyph: "fire",
        tone: "fire",
        section: "summary",
      });
      continue;
    }
    if (building.state === "ruin") continue;

    if (building.condition <= 55) {
      push(TIER_CONDITION, 0, {
        ...base,
        key: `building:${building.id}:maintenance`,
        kind: "maintenance",
        critical: false,
        label: `Condición ${building.condition} %: conviene reparar`,
        glyph: "maintenance",
        tone: "upkeep",
        section: "maintenance",
      });
      continue;
    }
    if (status?.insurance === "lapsed") {
      push(TIER_PENDING, 0, {
        ...base,
        key: `building:${building.id}:insurance`,
        kind: "insurance",
        critical: false,
        label: "Póliza vencida: el edificio queda sin cobertura",
        glyph: "insurance",
        tone: "arrears",
        section: "insurance",
      });
      continue;
    }
    if (status && status.backlog > 0) {
      push(TIER_SECONDARY, 0, {
        ...base,
        key: `building:${building.id}:upkeep`,
        kind: "upkeep",
        critical: false,
        label: `Mantenimiento atrasado: ${status.backlog} u. acumuladas`,
        glyph: "expense",
        tone: "arrears",
        section: "maintenance",
      });
      continue;
    }
    if (status?.insuranceAlert) {
      push(TIER_SECONDARY, 1, {
        ...base,
        key: `building:${building.id}:uninsured`,
        kind: "insurance",
        critical: false,
        label: "Sin seguro y riesgo de deterioro alto",
        glyph: "risk",
        tone: "arrears",
        section: "insurance",
      });
      continue;
    }
    if (status?.occupancy === "empty") {
      push(TIER_SECONDARY, 2, {
        ...base,
        key: `building:${building.id}:vacancy`,
        kind: "vacancy",
        critical: false,
        label: `Sin inquilinos: ${status.capacity} plazas libres`,
        glyph: "vacancy",
        tone: "vacancy",
        section: "tenants",
      });
    }
  }

  for (const site of economy.constructionSites) {
    if (site.ownerOrganizationId !== PLAYER) continue;
    if (site.assignedCrewIds.length > 0) continue;
    push(TIER_BLOCKED, 0, {
      key: `site:${site.id}`,
      kind: "blocked",
      critical: false,
      cell: footprintVisualCenter(site.footprintCells),
      label: `${constructionKindLabel(site.kind)} sin cuadrilla: asígnala para avanzar`,
      detail: [],
      parcelId: site.parcelIds[0]!,
      glyph: site.kind === "clear_ruin" ? "demolition" : "crew",
      tone: "neutral",
    });
  }

  for (const parcel of economy.parcels) {
    const load = index.loadsByParcelId.get(parcel.id);
    if (!load) continue;
    const cell = footprintVisualCenter(parcel.cells);
    if (load.kind === "auction" && load.auction?.role === "seller") {
      push(TIER_LOSS, 1, {
        key: `parcel:${parcel.id}:auction`,
        kind: "auction",
        critical: true,
        cell,
        label: `Garantía en subasta: reserva ${load.auction.reservePrice} u.`,
        detail: load.detail,
        parcelId: parcel.id,
        glyph: "auction",
        tone: "loss",
        section: "finance",
      });
      continue;
    }
    if (load.kind === "defaulted") {
      push(TIER_LOSS, 2, {
        key: `parcel:${parcel.id}:debt`,
        kind: "debt",
        critical: true,
        cell,
        label: "Préstamo impagado: la garantía puede subastarse",
        detail: load.detail,
        parcelId: parcel.id,
        glyph: "loan",
        tone: "loss",
        section: "finance",
      });
      continue;
    }
    if (load.kind === "delinquent") {
      push(TIER_PENDING, 2, {
        key: `parcel:${parcel.id}:debt`,
        kind: "debt",
        critical: false,
        cell,
        label: "Préstamo en atraso: paga la cuota para evitar la subasta",
        detail: load.detail,
        parcelId: parcel.id,
        glyph: "loan",
        tone: "arrears",
        section: "finance",
      });
    }
  }

  candidates.sort(
    (left, right) =>
      left.tier - right.tier ||
      left.rank - right.rank ||
      left.indicator.key.localeCompare(right.indicator.key),
  );
  return candidates.slice(0, limit).map((entry) => entry.indicator);
}

/**
 * Firma visual completa de un indicador. La reconciliación de la escena no puede quedarse con un
 * objeto obsoleto sólo porque conserva identidad lógica: `delinquent → defaulted` mantiene la key
 * pero cambia kind, tono, forma y criticidad. Todo lo que altera aspecto o comportamiento entra.
 */
export function worldIndicatorSignature(indicator: WorldIndicator): string {
  return JSON.stringify([
    indicator.key,
    indicator.kind,
    indicator.critical,
    indicator.glyph,
    indicator.tone,
    indicator.label,
    indicator.detail,
    indicator.section ?? null,
    indicator.cell.x,
    indicator.cell.y,
  ]);
}

export function worldIndicatorsSignature(indicators: readonly WorldIndicator[]): string {
  return indicators.map(worldIndicatorSignature).join("\u0001");
}

/**
 * Pestaña que debe mostrar el panel. La petición de un badge gana siempre; al cambiar de edificio
 * sin petición se vuelve al resumen. Pura para poder probar la matriz de transición sin DOM: el
 * cableado reactivo del componente se verifica en navegador.
 */
export function resolvePanelTab(
  current: PanelSection,
  buildingChanged: boolean,
  request: PanelSectionRequest | undefined,
): PanelSection {
  if (request) return request.section;
  return buildingChanged ? "summary" : current;
}
