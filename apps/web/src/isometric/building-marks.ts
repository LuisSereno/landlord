import type { AssetStatusIndex } from "../ui/asset-status";
import type { Economy } from "../ui/types";
import { signageAnchorFor, type SignageAnchor, type SignagePlanInput } from "./building-signage";

/**
 * V.d-UX.S · marca de mejora integrada en la fachada.
 *
 * Canal positivo, separado del de problema: una mejora aplicada es un logro del jugador, no una
 * alarma. Vive en la familia de los rótulos (anclaje normalizado dentro de la caja del sprite,
 * depth del sprite + 2, no interactiva) pero en un módulo APARTE: el contrato de elegibilidad de
 * `building-signage.ts` está testeado y no se toca.
 *
 * `upgraded` se publica también para edificios ajenos, así que la marca aplica a cualquier
 * propietario: es inteligencia competitiva legítima, igual que el rótulo de un edificio rival.
 */

export type FacadeMarkEntry = {
  id: string;
  buildingId: string;
  anchor: SignageAnchor;
  label: string;
};

/** Separación vertical respecto al rótulo para que ambas placas no se pisen. */
const FACADE_MARK_OFFSET_Y = -0.22;

/**
 * Anclaje de la marca: el del rótulo desplazado hacia arriba, dentro de la caja del sprite.
 * Hereda el espejo de 180° y el centrado de 90/270° de `signageAnchorFor`.
 */
export function facadeMarkAnchor(
  type: string,
  orientation: SignagePlanInput["orientation"],
): SignageAnchor {
  const base = signageAnchorFor(type, orientation);
  const y = Math.min(0.95, Math.max(0.05, base.y + FACADE_MARK_OFFSET_Y));
  return { x: base.x, y };
}

/**
 * Una marca por edificio terminado y mejorado. Se evalúa DESPUÉS de que el plan de sprites haya
 * confirmado que hay asset renderizable: una obra, un dañado o un ardiendo no la llevan.
 */
export function facadeMarkPlan(
  plan: readonly SignagePlanInput[],
  economy: Economy | undefined,
  index: AssetStatusIndex,
): FacadeMarkEntry[] {
  if (!economy) return [];
  const byPlacementId = new Map(economy.buildings.map((entry) => [`building:${entry.id}`, entry]));
  const entries: FacadeMarkEntry[] = [];
  for (const placement of plan) {
    if (placement.entityKind !== "building") continue;
    if (placement.assetState !== "complete") continue;
    const building = byPlacementId.get(placement.id);
    if (!building) continue;
    const status = index.statusByBuildingId.get(building.id);
    if (!status?.upgraded) continue;
    entries.push({
      id: `facademark:${building.id}`,
      buildingId: building.id,
      anchor: facadeMarkAnchor(building.type, placement.orientation),
      label: "Mejora completada",
    });
  }
  return entries;
}

export type FacadeMarkReconciliation = {
  next: Map<string, FacadeMarkEntry>;
  created: FacadeMarkEntry[];
  removed: string[];
};

/** Diff puro e idempotente, mismo patrón que los rótulos. */
export function reconcileFacadeMarks(
  previous: ReadonlyMap<string, FacadeMarkEntry>,
  plan: readonly FacadeMarkEntry[],
): FacadeMarkReconciliation {
  const next = new Map<string, FacadeMarkEntry>();
  const created: FacadeMarkEntry[] = [];
  for (const entry of plan) {
    next.set(entry.id, entry);
    if (!previous.has(entry.id)) created.push(entry);
  }
  const removed: string[] = [];
  for (const id of previous.keys()) if (!next.has(id)) removed.push(id);
  return { next, created, removed };
}
