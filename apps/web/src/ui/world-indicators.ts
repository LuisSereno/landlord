import { footprintVisualCenter } from "../isometric/building-sprites";
import type { Economy } from "./types";

export type WorldIndicator = {
  key: string;
  kind: "danger" | "maintenance" | "blocked";
  critical: boolean;
  cell: { x: number; y: number };
  label: string;
  parcelId: string;
  buildingId?: string;
};

const PLAYER = "org_00000001";
const MAX_INDICATORS = 12;

/**
 * V.d-UX · qué avisos espaciales se dibujan sobre el mundo (spec §9). Sólo asuntos accionables del
 * jugador, en orden de prioridad y con tope; la escena sólo pinta esta lista. Es pura para poder
 * probarla sin Phaser: un incendio, una condición crítica y una obra sin cuadrilla salen una vez
 * cada uno, los rivales no salen y el resultado nunca supera el tope.
 */
export function deriveWorldIndicators(
  economy: Economy | undefined,
  limit = MAX_INDICATORS,
): WorldIndicator[] {
  if (!economy) return [];
  const candidates: WorldIndicator[] = [];
  for (const building of economy.buildings) {
    if (building.ownerOrganizationId !== PLAYER) continue;
    const cell = footprintVisualCenter(building.footprintCells);
    if (building.state === "burning" || building.state === "collapse_pending") {
      candidates.push({
        key: `building:${building.id}:critical`,
        kind: "danger",
        critical: true,
        cell,
        label:
          building.state === "burning"
            ? "Incendio activo: revisa el edificio"
            : "Riesgo de colapso: revisa el edificio",
        parcelId: building.parcelIds[0]!,
        buildingId: building.id,
      });
      continue;
    }
    if (building.condition <= 55)
      candidates.push({
        key: `building:${building.id}:maintenance`,
        kind: "maintenance",
        critical: false,
        cell,
        label: `Condición ${building.condition} %: conviene reparar`,
        parcelId: building.parcelIds[0]!,
        buildingId: building.id,
      });
  }
  for (const site of economy.constructionSites) {
    if (site.ownerOrganizationId !== PLAYER) continue;
    if (site.assignedCrewIds.length > 0) continue;
    candidates.push({
      key: `site:${site.id}`,
      kind: "blocked",
      critical: false,
      cell: footprintVisualCenter(site.footprintCells),
      label: "Obra sin cuadrilla: asígnala para avanzar",
      parcelId: site.parcelIds[0]!,
    });
  }
  candidates.sort((left, right) => Number(right.critical) - Number(left.critical));
  return candidates.slice(0, limit);
}
