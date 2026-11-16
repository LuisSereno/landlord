import type { GridCell } from "@landlord/shared";

import type { AssetStatusIndex, ParcelLoadKind } from "../ui/asset-status";
import type { UiIconName } from "../ui/icons";
import type { StatusTone } from "../ui/overlay-catalog";
import type { Economy, ProjectedParcel } from "../ui/types";

/**
 * V.d-UX.S · placas persistentes de carga a nivel de PARCELA.
 *
 * Una hipoteca al día no es un problema: es identidad del activo. Por eso no compite con los badges
 * flotantes (spec §9) sino que vive como señalética, en la familia de los rótulos de edificio.
 *
 * La placa NO crea una capa interactiva nueva: no lleva `Zone`. El hover se resuelve con hit-test
 * manual sobre su caja (precedente `updateSignageHover`) y el click atraviesa hasta el picking de
 * suelo, que ya selecciona la parcela. Así no roba clicks al edificio, a la colocación ni al rótulo.
 */

export type ParcelMarkEntry = {
  id: string;
  parcelId: string;
  cell: GridCell;
  kind: ParcelLoadKind;
  glyph: UiIconName;
  tone: StatusTone;
  label: string;
  detail: readonly string[];
};

const PLAYER = "org_00000001";

const MARK_STYLE: Record<
  Exclude<ParcelLoadKind, "unknown" | "none">,
  { glyph: UiIconName; tone: StatusTone }
> = {
  loan: { glyph: "lien", tone: "lien" },
  delinquent: { glyph: "loan", tone: "arrears" },
  defaulted: { glyph: "loan", tone: "loss" },
  auction: { glyph: "auction", tone: "loss" },
  auction_bid: { glyph: "auction", tone: "opportunity" },
};

/**
 * Celda de anclaje: la esquina con frente de calle más cercana al origen isométrico. Nunca el
 * centroide del edificio, que es donde ya viven el sprite, el rótulo y los badges. Determinista:
 * mismo parcel ⇒ misma celda, con y sin frente vial publicado.
 */
export function parcelMarkCell(parcel: ProjectedParcel): GridCell {
  const frontage = parcel.roadFrontages.flatMap((entry) => entry.cells);
  const pool = frontage.length > 0 ? frontage : parcel.cells;
  const sorted = [...pool].sort(
    (left, right) => left.x + left.y - (right.x + right.y) || left.x - right.x || left.y - right.y,
  );
  const cell = sorted[0] ?? parcel.cell;
  return { x: cell.x, y: cell.y };
}

/**
 * Una placa por parcela gravada. En un edificio multi-parcela la carga vive sobre la parcela
 * concreta que respalda el préstamo, no sobre `parcelIds[0]`: las demás pueden estar libres.
 * Las parcelas ajenas sin puja propia no se marcan: no se publica su deuda.
 */
export function parcelMarkPlan(
  economy: Economy | undefined,
  index: AssetStatusIndex,
): ParcelMarkEntry[] {
  if (!economy) return [];
  const entries: ParcelMarkEntry[] = [];
  for (const parcel of economy.parcels) {
    const load = index.loadsByParcelId.get(parcel.id);
    if (!load) continue;
    if (load.kind === "unknown" || load.kind === "none") continue;
    if (load.kind === "auction_bid" && parcel.ownerOrganizationId === PLAYER) continue;
    const style = MARK_STYLE[load.kind];
    entries.push({
      id: `parcelmark:${parcel.id}`,
      parcelId: parcel.id,
      cell: parcelMarkCell(parcel),
      kind: load.kind,
      glyph: style.glyph,
      tone: style.tone,
      label: load.label,
      detail: load.detail,
    });
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export type ParcelMarkReconciliation = {
  next: Map<string, ParcelMarkEntry>;
  created: ParcelMarkEntry[];
  removed: string[];
};

/** Diff puro e idempotente: dos sincronizaciones con el mismo plan no crean ni destruyen nada. */
export function reconcileParcelMarks(
  previous: ReadonlyMap<string, ParcelMarkEntry>,
  plan: readonly ParcelMarkEntry[],
): ParcelMarkReconciliation {
  const next = new Map<string, ParcelMarkEntry>();
  const created: ParcelMarkEntry[] = [];
  for (const entry of plan) {
    next.set(entry.id, entry);
    if (!previous.has(entry.id)) created.push(entry);
  }
  const removed: string[] = [];
  for (const id of previous.keys()) if (!next.has(id)) removed.push(id);
  return { next, created, removed };
}
