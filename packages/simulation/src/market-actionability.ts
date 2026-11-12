import {
  parseMoney,
  type BuildingDefinition,
  type Parcel,
  type ParcelId,
  type RoadFrontage,
} from "@landlord/shared";

import { developmentCodeById } from "./development-codes";
import { evaluateActionableSite } from "./development-placement";
import { enumerateCompatibleDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS, MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import {
  canonicalCellKeys,
  canonicalGridCells,
  cellKey,
  compareCellKey,
  parcelDepthFits,
  parcelFrontageWidth,
  type UrbanFabricConfig,
} from "./urban-fabric";

/**
 * D-106 · oferta de suelo accionable. Tras parcelar, cada solar `marketable` se evalúa con la
 * misma regla autoritativa de colocación (`evaluateActionableSite`: contrato de solar + huellas
 * legales, incluida la participación física en sitios de dos o tres parcelas). El residuo sin
 * ninguna jugada legal se fusiona con el vecino compatible de mayor borde compartido y se vuelve
 * a evaluar; si tampoco queda salida, deja de ser comercializable. Nunca se reclasifica un solar
 * que sí participa en un complejo multi-parcela válido.
 */

export type MarketActionabilityOutcome = {
  merged: number;
  reclassified: number;
};

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function sharedBorder(left: Parcel, right: Parcel): number {
  const keys = new Set(right.cells.map(cellKey));
  let border = 0;
  for (const cell of left.cells)
    for (const offset of OFFSETS)
      if (keys.has(`${cell.x + offset.x}:${cell.y + offset.y}`)) border += 1;
  return border;
}

function mergedFrontages(
  left: readonly RoadFrontage[],
  right: readonly RoadFrontage[],
): RoadFrontage[] {
  const bySignature = new Map<string, RoadFrontage>();
  for (const frontage of [...left, ...right]) {
    const signature = `${frontage.roadSegmentId}@${canonicalCellKeys(frontage.cells).join(",")}`;
    if (!bySignature.has(signature)) bySignature.set(signature, frontage);
  }
  return [...bySignature.values()].sort(
    (a, b) =>
      a.roadSegmentId.localeCompare(b.roadSegmentId) ||
      compareCellKey(canonicalCellKeys(a.cells)[0]!, canonicalCellKeys(b.cells)[0]!),
  );
}

function mergedGeometry(left: Parcel, right: Parcel): Pick<Parcel, "cells" | "roadFrontages"> {
  return {
    cells: canonicalGridCells([...left.cells, ...right.cells]),
    roadFrontages: mergedFrontages(left.roadFrontages, right.roadFrontages),
  };
}

function isActionable(
  parcel: Parcel,
  marketable: readonly Parcel[],
  byId: ReadonlyMap<ParcelId, Parcel>,
  avenueSegmentIds: ReadonlySet<string>,
): boolean {
  const code = developmentCodeById(parcel.developmentCodeId);
  for (const definition of Object.values(BUILDING_DEFINITIONS)) {
    if (definition.cost === 0) continue;
    if (definition.siteRequirements.requiredParcels === 1) {
      if (evaluateActionableSite({ parcels: [parcel], definition, code, avenueSegmentIds }).ok)
        return true;
      continue;
    }
    const sites = enumerateCompatibleDevelopmentSites({
      parcels: marketable,
      definition,
      seedParcelId: parcel.id,
      maxExplored: 128,
    });
    for (const ids of sites) {
      const group = ids.map((id) => byId.get(id)!);
      if (evaluateActionableSite({ parcels: group, definition, code, avenueSegmentIds }).ok)
        return true;
    }
  }
  return false;
}

/**
 * Vecino compatible: mismo distrito, manzana y norma, borde compartido positivo y una fusión que
 * cabe en el envelope morfológico del tejido (el mismo que valida `validateUrbanFabric`). Mayor
 * borde primero; desempate por id canónico.
 */
function bestCompatibleNeighbour(
  subject: Parcel,
  marketable: readonly Parcel[],
  config: UrbanFabricConfig,
): { neighbour: Parcel; geometry: Pick<Parcel, "cells" | "roadFrontages"> } | null {
  let best: { neighbour: Parcel; geometry: Pick<Parcel, "cells" | "roadFrontages"> } | null = null;
  let bestBorder = 0;
  for (const other of marketable) {
    if (
      other.id === subject.id ||
      other.districtId !== subject.districtId ||
      other.blockId !== subject.blockId ||
      other.developmentCodeId !== subject.developmentCodeId
    )
      continue;
    const border = sharedBorder(subject, other);
    if (border === 0) continue;
    if (border < bestBorder || (border === bestBorder && best && other.id > best.neighbour.id))
      continue;
    const geometry = mergedGeometry(subject, other);
    if (parcelFrontageWidth(geometry) < config.parcelFrontageCells[0]) continue;
    if (!parcelDepthFits(geometry, config)) continue;
    best = { neighbour: other, geometry };
    bestBorder = border;
  }
  return best;
}

/**
 * Muta `parcels` hasta el punto fijo: todo solar que queda `marketable` es accionable contra el
 * conjunto final de solares. Cada iteración fusiona (−1 parcela) o reclasifica (−1 marketable),
 * así que termina. Determinista: orden canónico por id en sujetos, vecinos y supervivientes.
 */
export function enforceMarketableActionability(input: {
  parcels: Parcel[];
  fabricConfig: UrbanFabricConfig;
  avenueSegmentIds: ReadonlySet<string>;
  anchorParcelIds?: ReadonlySet<ParcelId>;
}): MarketActionabilityOutcome {
  const anchors = input.anchorParcelIds ?? new Set<ParcelId>();
  let merged = 0;
  let reclassified = 0;
  for (;;) {
    const marketable = input.parcels
      .filter((parcel) => parcel.disposition === "marketable")
      .sort((left, right) => left.id.localeCompare(right.id));
    const byId = new Map(marketable.map((parcel) => [parcel.id, parcel]));
    const subject = marketable.find(
      (parcel) => !isActionable(parcel, marketable, byId, input.avenueSegmentIds),
    );
    if (!subject) break;
    const match = bestCompatibleNeighbour(subject, marketable, input.fabricConfig);
    if (!match) {
      subject.disposition = "public";
      subject.ownerOrganizationId = MUNICIPALITY_ORGANIZATION_ID;
      subject.baseLandValue = parseMoney(0);
      subject.marketValue = parseMoney(0);
      reclassified += 1;
      continue;
    }
    const { neighbour, geometry } = match;
    // El ancla autorada conserva su id y su referencia económica (D-064); si ninguno lo es,
    // sobrevive el id canónico menor.
    const survivor =
      anchors.has(neighbour.id) && !anchors.has(subject.id)
        ? neighbour
        : subject.id < neighbour.id
          ? subject
          : neighbour;
    const removed = survivor === subject ? neighbour : subject;
    survivor.cells = geometry.cells;
    survivor.roadFrontages = geometry.roadFrontages;
    input.parcels.splice(input.parcels.indexOf(removed), 1);
    merged += 1;
  }
  return { merged, reclassified };
}

/**
 * Gate B · ¿el suelo de mercado hospeda al menos un sitio autoritativo para la definición?
 * Misma regla que D-106 (contrato + huellas), sobre todos los conjuntos compatibles del pool.
 * La consume la ciudad para garantizar disponibilidad ciudad-global de la industria pesada.
 */
export function hasActionableSiteForDefinition(input: {
  parcels: readonly Parcel[];
  definition: BuildingDefinition;
  avenueSegmentIds: ReadonlySet<string>;
}): boolean {
  const marketable = input.parcels.filter((parcel) => parcel.disposition === "marketable");
  const byId = new Map(marketable.map((parcel) => [parcel.id, parcel]));
  const sites = enumerateCompatibleDevelopmentSites({
    parcels: marketable,
    definition: input.definition,
    maxExplored: 512,
  });
  for (const ids of sites) {
    const group = ids.map((id) => byId.get(id)!).filter(Boolean);
    if (group.length !== input.definition.siteRequirements.requiredParcels) continue;
    if (
      evaluateActionableSite({
        parcels: group,
        definition: input.definition,
        code: developmentCodeById(group[0]!.developmentCodeId),
        avenueSegmentIds: input.avenueSegmentIds,
      }).ok
    )
      return true;
  }
  return false;
}
