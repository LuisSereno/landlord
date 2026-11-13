import {
  areCellGroupsEdgeConnected,
  canonicalParcelIds,
  type Building,
  type BuildingDefinition,
  type BuildingType,
  type DevelopmentCode,
  type DevelopmentPlacementCandidate,
  type DevelopmentPlacementId,
  type DistrictId,
  type GridCell,
  type OrganizationId,
  type Parcel,
  type ParcelId,
  type PlacementRejection,
  type RoadFrontage,
} from "@landlord/shared";

import {
  activeSiteOnParcel,
  blockOfParcel,
  buildBuildingIndex,
  buildingsOnParcel,
} from "./building-index";
import {
  developmentCodeById,
  effectiveDensityBonus,
  effectiveDevelopmentCode,
  isParcelUseAllowed,
} from "./development-codes";
import {
  enumerateFootprintCandidates,
  type FootprintCandidate,
  type FootprintPlacementInput,
} from "./footprints";
import { BUILDING_DEFINITIONS } from "./game-data";
import { activePermitFor } from "./permitting";
import type { GameState } from "./state";
import { fnv1a32 } from "./urban-fabric";

/**
 * V.d-7C · única fuente autoritativa de colocaciones legales (D-097).
 *
 * `StartConstruction`, la petición de candidatos del navegador, la IA rival y el generador municipal
 * leen TODOS este módulo: aquí está el conjunto de parcelas admisible, el código urbanístico que lo
 * rige y la enumeración de huellas. Nadie reimplementa setback, cobertura, FAR, frente o contigüidad
 * fuera del motor, y por eso el jugador gana una decisión espacial sin ganar reglas distintas.
 */

/** Un solar ya validado como proyecto, listo para hospedar huellas. */
export type DevelopmentPlacementSite = {
  districtId: DistrictId;
  /** Orden canónico del motor; nunca el orden en que llegó del cliente. */
  parcelIds: ParcelId[];
  parcels: Parcel[];
  buildingType: BuildingType;
  definition: BuildingDefinition;
  frontages: RoadFrontage[];
  principalFrontageCells: GridCell[];
  /** Edificios que ya ocupan el solar; entran tal cual en las reglas de envelope. */
  occupiedBy: Pick<import("@landlord/shared").Building, "footprintCells" | "floors">[];
};

export type PlacementSiteResult =
  { ok: true; site: DevelopmentPlacementSite } | { ok: false; rejection: PlacementRejection };

/**
 * Contrato de solar puro (D-106): la misma secuencia de reglas que `StartConstruction`, sin
 * propiedad, obras ni edificios. Los consumidores con estado inyectan sus comprobaciones en los
 * puntos exactos donde el comando las hace; el generador y la sonda de accionabilidad las omiten
 * porque evalúan suelo recién parcelado. Nadie reimplementa contigüidad, norma, usos o área.
 */
export function siteContractRejection(input: {
  parcelIds: readonly ParcelId[];
  parcels: readonly Parcel[];
  definition: BuildingDefinition;
  authorize?: (parcels: readonly Parcel[]) => PlacementRejection | null;
  occupancy?: (parcels: readonly Parcel[]) => PlacementRejection | null;
}): PlacementRejection | null {
  const { parcels, definition } = input;
  const requirements = definition.siteRequirements;
  if (new Set(input.parcelIds).size !== input.parcelIds.length) return "DUPLICATE_PARCELS";
  if (canonicalParcelIds(input.parcelIds).length !== requirements.requiredParcels)
    return "WRONG_PARCEL_COUNT";
  if (parcels.some((parcel) => parcel.disposition !== "marketable"))
    return "PUBLIC_LAND_NOT_BUILDABLE";
  const unauthorized = input.authorize?.(parcels);
  if (unauthorized) return unauthorized;
  const primary = parcels[0]!;
  if (parcels.some((parcel) => parcel.districtId !== primary.districtId))
    return "PARCELS_DIFFERENT_DISTRICT";
  /** Alpha no mezcla normas: un proyecto multi-parcela exige el mismo código urbanístico. */
  if (parcels.some((parcel) => parcel.developmentCodeId !== primary.developmentCodeId))
    return "MIXED_DEVELOPMENT_CODES";
  if (parcels.some((parcel) => !isParcelUseAllowed(parcel, definition))) return "USE_NOT_ALLOWED";
  const occupied = input.occupancy?.(parcels);
  if (occupied) return occupied;
  if (
    requirements.requireEdgeContiguous &&
    !areCellGroupsEdgeConnected(parcels.map((parcel) => parcel.cells))
  )
    return "PARCELS_NOT_EDGE_CONTIGUOUS";
  const combinedArea = parcels.reduce((total, parcel) => total + parcel.cells.length, 0);
  if (combinedArea < requirements.minCombinedAreaCells) return "SITE_AREA_TOO_SMALL";
  return null;
}

/** Frentes del solar y frente principal (avenida), con el mismo fallback que el comando. */
export function siteFrontagesFor(
  parcels: readonly Parcel[],
  avenueSegmentIds: ReadonlySet<string>,
): { frontages: RoadFrontage[]; principalFrontageCells: GridCell[] } {
  const frontages = parcels.flatMap((parcel) => parcel.roadFrontages);
  const principalFrontageCells = frontages
    .filter((frontage) => avenueSegmentIds.has(frontage.roadSegmentId))
    .flatMap((frontage) => frontage.cells);
  return {
    frontages,
    principalFrontageCells:
      principalFrontageCells.length > 0
        ? principalFrontageCells
        : frontages.flatMap((frontage) => frontage.cells),
  };
}

/**
 * Validación de proyecto sobre el conjunto exacto de parcelas. Es el cuerpo que `StartConstruction`
 * ejecutaba en línea: mismos checks, mismo orden y mismo código de rechazo, sólo que ahora lo llama
 * también quien quiere enseñar opciones antes de despachar nada. Es de sólo lectura.
 */
export function resolveDevelopmentPlacementSite(
  state: GameState,
  input: {
    parcelIds: readonly ParcelId[];
    buildingType: BuildingType;
    organizationId: OrganizationId;
  },
): PlacementSiteResult {
  const definition = BUILDING_DEFINITIONS[input.buildingType];
  if (new Set(input.parcelIds).size !== input.parcelIds.length)
    return { ok: false, rejection: "DUPLICATE_PARCELS" };
  const parcelIds = canonicalParcelIds(input.parcelIds);
  if (parcelIds.length !== definition.siteRequirements.requiredParcels)
    return { ok: false, rejection: "WRONG_PARCEL_COUNT" };
  const resolved = parcelIds.map((id) => state.phase2.parcels.get(id));
  if (resolved.some((entry) => entry === undefined))
    return { ok: false, rejection: "PARCEL_NOT_FOUND" };
  const parcels = resolved as Parcel[];
  const buildingIndex = buildBuildingIndex(state);
  const rejection = siteContractRejection({
    parcelIds,
    parcels,
    definition,
    authorize: (sites) =>
      sites.some((parcel) => parcel.ownerOrganizationId !== input.organizationId)
        ? "ACTOR_NOT_AUTHORIZED"
        : null,
    occupancy: (sites) => {
      if (sites.some((parcel) => activeSiteOnParcel(state, parcel.id)))
        return "ACTIVE_SITE_ON_PARCEL";
      /**
       * Un complejo reserva TODAS sus parcelas (D-096 §10): mientras exista obra, edificio o ruina,
       * no se inicia otro proyecto en ninguna de ellas.
       */
      const occupiedByComplex = sites.some((parcel) =>
        buildingsOnParcel(buildingIndex, parcel.id).some(
          (building) => building.parcelIds.length > 1,
        ),
      );
      if (
        occupiedByComplex ||
        (definition.siteRequirements.requiredParcels > 1 &&
          sites.some((parcel) => buildingsOnParcel(buildingIndex, parcel.id).length > 0))
      )
        return "PARCEL_OCCUPIED";
      return null;
    },
  });
  if (rejection) return { ok: false, rejection };
  const primary = parcels[0]!;
  const avenueSegmentIds = new Set(
    state.world.districts
      .get(primary.districtId)!
      .map.roads.segments.filter((segment) => segment.class === "avenue")
      .map((segment) => segment.id as string),
  );
  const { frontages, principalFrontageCells } = siteFrontagesFor(parcels, avenueSegmentIds);
  return {
    ok: true,
    site: {
      districtId: primary.districtId,
      parcelIds,
      parcels,
      buildingType: input.buildingType,
      definition,
      frontages,
      principalFrontageCells,
      occupiedBy: parcels.flatMap((parcel) => buildingsOnParcel(buildingIndex, parcel.id)),
    },
  };
}

/**
 * D-106 · evaluación pura y única de «sitio accionable»: el contrato de solar del comando más la
 * enumeración autoritativa de huellas (retranqueos, cobertura, FAR, frente y toque físico de cada
 * parcela requerida). La consumen el generador tras parcelar y cualquier sonda de oferta; UI,
 * comandos, IA y automatización siguen leyendo `enumerateDevelopmentPlacementCandidates`, que
 * comparte exactamente estas reglas. Sin estado: ni propiedad, ni permisos, ni ordenanzas.
 */
export function evaluateActionableSite(input: {
  parcels: readonly Parcel[];
  definition: BuildingDefinition;
  code: DevelopmentCode;
  avenueSegmentIds?: ReadonlySet<string>;
  occupiedBy?: readonly Pick<Building, "footprintCells" | "floors">[];
}): { ok: true } | { ok: false; rejection: PlacementRejection } {
  const { parcels, definition } = input;
  const rejection = siteContractRejection({
    parcelIds: parcels.map((parcel) => parcel.id),
    parcels,
    definition,
  });
  if (rejection) return { ok: false, rejection };
  const { frontages, principalFrontageCells } = siteFrontagesFor(
    parcels,
    input.avenueSegmentIds ?? new Set(),
  );
  const site: DevelopmentPlacementSite = {
    districtId: parcels[0]!.districtId,
    parcelIds: canonicalParcelIds(parcels.map((parcel) => parcel.id)),
    parcels: [...parcels],
    buildingType: definition.type,
    definition,
    frontages,
    principalFrontageCells,
    occupiedBy: [...(input.occupiedBy ?? [])],
  };
  const enumeration = enumerateFootprintCandidates(footprintInputFor(site, input.code));
  if (enumeration.candidates.length === 0)
    return { ok: false, rejection: enumeration.rejection ?? "NO_BUILDABLE_ENVELOPE" };
  return { ok: true };
}

/**
 * El código con el que el motor decide hoy. Con permiso vivo es el congelado en la decisión (los
 * derechos adquiridos mandan); sin permiso es el código de la parcela más el bonus de densidad
 * vigente, que es exactamente lo que `issuePermit` congelaría si se emitiera ahora. Por eso la
 * petición de candidatos —que no puede emitir permisos— muestra las mismas huellas que el comando
 * aceptará después, sin tocar el PRNG ni el expediente.
 */
export function placementCodeFor(
  state: GameState,
  site: DevelopmentPlacementSite,
): DevelopmentCode {
  const permit = activePermitFor(state, site.parcelIds, site.buildingType, state.clock.tick);
  if (permit)
    return effectiveDevelopmentCode(
      permit.developmentCodeIdAtDecision,
      permit.densityBonusFloors,
      permit.densityBonusFarPercent,
    );
  const code = developmentCodeById(site.parcels[0]!.developmentCodeId);
  const bonus = effectiveDensityBonus(
    state.phase2.ordinance,
    blockOfParcel(state, site.parcels[0]!).urbanRole,
  );
  return effectiveDevelopmentCode(code.id, bonus.floors, bonus.farPercent);
}

/** Las reglas de huella sobre la unión del solar, con el código ya decidido. */
export function footprintInputFor(
  site: DevelopmentPlacementSite,
  code: DevelopmentCode,
): FootprintPlacementInput {
  return {
    /** La unión es el solar normativo: la frontera catastral interna no bloquea la huella. */
    parcel: {
      cells: site.parcels.flatMap((parcel) => parcel.cells),
      roadFrontages: site.frontages,
    },
    ...(site.definition.siteRequirements.requiredParcels > 1
      ? { requiredParcelCellGroups: site.parcels.map((parcel) => parcel.cells) }
      : {}),
    code,
    definition: site.definition,
    principalFrontageCells: site.principalFrontageCells,
    buildings: site.occupiedBy,
  };
}

/**
 * Identidad canónica de una colocación (D-097 · Identity): tipo de edificio + parcelas canónicas +
 * firma de huella + orientación. Nada de UUIDs, índices de array ni contadores mutables, así que la
 * misma geometría produce el mismo id en cualquier orden de descubrimiento y sigue siendo válida a
 * través de save/load y de la cadena de comandos.
 *
 * Se derivan dos FNV-1a con dominios distintos (64 bits) en lugar de uno: un `placement_` de 32 bits
 * colisionaría con probabilidad apreciable dentro de una enumeración grande, y una colisión aquí
 * significaría construir una huella distinta de la elegida.
 */
export function developmentPlacementIdFor(
  site: Pick<DevelopmentPlacementSite, "buildingType" | "parcelIds">,
  candidate: Pick<FootprintCandidate, "signature" | "orientation">,
): DevelopmentPlacementId {
  const canonical = `landlord.placement.v1|${site.buildingType}|${site.parcelIds.join(",")}|${
    candidate.signature
  }|${candidate.orientation}`;
  const high = fnv1a32(canonical);
  const low = fnv1a32(`${canonical}|v`);
  return `placement_${high.toString(16).padStart(8, "0")}${low
    .toString(16)
    .padStart(8, "0")}` as DevelopmentPlacementId;
}

/** La forma autoritativa del candidato, ya con identidad y alcance catastral. */
export function toDevelopmentPlacementCandidate(
  site: Pick<DevelopmentPlacementSite, "districtId" | "buildingType" | "parcelIds">,
  candidate: FootprintCandidate,
  recommended: boolean,
): DevelopmentPlacementCandidate {
  return {
    id: developmentPlacementIdFor(site, candidate),
    districtId: site.districtId,
    parcelIds: site.parcelIds,
    footprintCells: candidate.footprintCells,
    orientation: candidate.orientation,
    floors: candidate.floors,
    recommended,
  };
}

export type PlacementEnumeration = {
  /** Mejor candidatura primera. Vacío con `rejection` cuando el motor no admite ninguna. */
  candidates: DevelopmentPlacementCandidate[];
  rejection: PlacementRejection | null;
};

/**
 * Candidatos legales para (distrito, parcelas, tipo) sin mutar nada. Es lo que pide la UI y lo que
 * usa cualquiera que necesite la mejor colocación sin interfaz: el primer candidato ES la
 * autocolocación que el motor habría elegido.
 */
export function enumerateDevelopmentPlacementCandidates(
  state: GameState,
  input: {
    parcelIds: readonly ParcelId[];
    buildingType: BuildingType;
    organizationId: OrganizationId;
  },
): PlacementEnumeration {
  const site = resolveDevelopmentPlacementSite(state, input);
  if (!site.ok) return { candidates: [], rejection: site.rejection };
  const enumeration = enumerateFootprintCandidates(
    footprintInputFor(site.site, placementCodeFor(state, site.site)),
  );
  return {
    candidates: enumeration.candidates.map((candidate, index) =>
      toDevelopmentPlacementCandidate(site.site, candidate, index === 0),
    ),
    rejection: enumeration.rejection,
  };
}

/** Cota de la página que viaja en la respuesta: el orden canónico decide quién entra. */
export const PLACEMENT_CANDIDATE_PAGE_SIZE = 24;

/**
 * Lo que puede fallar al resolver UNA colocación: las razones de solar/huella de siempre y el
 * candidato obsoleto. `PLACEMENT_NO_LONGER_VALID` sólo aparece cuando el conjunto legal existe pero
 * la colocación que el jugador confirmó ya no está entre ellas.
 */
export type PlacementSelectionRejection = PlacementRejection | "PLACEMENT_NO_LONGER_VALID";

export type PlacementSelection =
  | { ok: true; placement: DevelopmentPlacementCandidate; totalCandidates: number }
  | { ok: false; rejection: PlacementSelectionRejection };

/**
 * Revalidación autoritativa del comando (D-097 · Command decision): el motor vuelve a enumerar con
 * el código congelado en el permiso y busca la identidad pedida. Si el candidato dejó de ser legal,
 * rechaza —nunca elige otra huella en el lugar del jugador, aunque la nueva enumeración sea legal.
 * Sin `placementId` se toma la primera candidata, que es exactamente la autocolocación anterior, y
 * por eso la IA, la automatización y el generador municipal siguen obteniendo el mismo resultado.
 */
export function choosePlacementFrom(
  site: DevelopmentPlacementSite,
  code: DevelopmentCode,
  placementId?: DevelopmentPlacementId,
): PlacementSelection {
  const { candidates, rejection } = enumerateFootprintCandidates(footprintInputFor(site, code));
  if (candidates.length === 0)
    return { ok: false, rejection: rejection ?? "NO_BUILDABLE_ENVELOPE" };
  if (placementId === undefined)
    return {
      ok: true,
      placement: toDevelopmentPlacementCandidate(site, candidates[0]!, true),
      totalCandidates: candidates.length,
    };
  for (const candidate of candidates) {
    if (developmentPlacementIdFor(site, candidate) === placementId)
      return {
        ok: true,
        placement: toDevelopmentPlacementCandidate(site, candidate, false),
        totalCandidates: candidates.length,
      };
  }
  return { ok: false, rejection: "PLACEMENT_NO_LONGER_VALID" };
}

/**
 * Respuesta de sólo lectura para el worker. `totalCandidates` conserva el tamaño real del conjunto
 * legal para que la UI pueda decir «hay más» sin recibir miles de huellas por mensaje.
 */
export function developmentPlacementCandidatesFor(
  state: GameState,
  input: {
    districtId: DistrictId;
    parcelIds: readonly ParcelId[];
    buildingType: BuildingType;
    organizationId: OrganizationId;
  },
): {
  districtId: DistrictId;
  parcelIds: ParcelId[];
  buildingType: BuildingType;
  candidates: DevelopmentPlacementCandidate[];
  totalCandidates: number;
  rejection: PlacementRejection | null;
} {
  const enumerated = enumerateDevelopmentPlacementCandidates(state, {
    parcelIds: input.parcelIds,
    buildingType: input.buildingType,
    organizationId: input.organizationId,
  });
  const districtId = enumerated.candidates[0]?.districtId ?? input.districtId;
  if (enumerated.candidates.length > 0 && enumerated.candidates[0]!.districtId !== input.districtId)
    return {
      districtId: input.districtId,
      parcelIds: canonicalParcelIds(input.parcelIds),
      buildingType: input.buildingType,
      candidates: [],
      totalCandidates: 0,
      rejection: "PARCELS_DIFFERENT_DISTRICT",
    };
  return {
    districtId,
    parcelIds: canonicalParcelIds(input.parcelIds),
    buildingType: input.buildingType,
    candidates: enumerated.candidates.slice(0, PLACEMENT_CANDIDATE_PAGE_SIZE),
    totalCandidates: enumerated.candidates.length,
    rejection:
      enumerated.candidates.length === 0 ? (enumerated.rejection ?? "NO_BUILDABLE_ENVELOPE") : null,
  };
}
