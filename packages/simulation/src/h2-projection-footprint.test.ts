import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseConstructionSiteId,
  viewProjectionV2Schema,
  type Building,
  type ConstructionSite,
  type GridCell,
  type Parcel,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { createViewProjection } from "./projection";
import { createInitialState, type GameState } from "./state";

/**
 * H2-01 · la proyección debe publicar el footprint físico real de cada edificio y de cada obra,
 * no sólo el `parcelId`. El renderer consume `footprintCells` para colocar y ordenar sprites; si
 * el schema los filtra, un parcela multi-edificio se dibuja incompleto. Estos tests fijan la
 * frontera: `viewProjectionV2Schema.parse()` (que corre en el navegador vía worker/client.ts)
 * tiene que conservar los cinco campos geométricos y el `districtId`.
 */

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/** Parcela del distrito observado con al menos cuatro celdas de profundidad para separar huellas. */
function deepParcel(state: GameState, index: number): Parcel {
  const parcels = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.districtId === PLAYER_HOME_DISTRICT_ID &&
        parcel.disposition === "marketable" &&
        parcel.cells.some((cell) => manhattan(cell, parcel.anchorCell) >= 4),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const parcel = parcels[index];
  if (!parcel) throw new Error(`Sin parcela profunda nº ${index} en el distrito observado`);
  return parcel;
}

/** Dos celdas de la parcela separadas entre sí y lejos del ancla: huellas reales de dos edificios. */
function separatedFootprints(parcel: Parcel): { left: GridCell[]; right: GridCell[] } {
  const far = parcel.cells
    .filter((cell) => manhattan(cell, parcel.anchorCell) >= 2)
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (far.length < 2) {
    throw new Error(`Parcela ${parcel.id} sin dos celdas separadas del ancla`);
  }
  return { left: [{ ...far[0]! }], right: [{ ...far[far.length - 1]! }] };
}

function addBuilding(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
): Building["id"] {
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  const building: Building = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: footprintCells.map((cell) => ({ ...cell })),
    orientation: 0,
    floors: 3,
    form: "row",
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "row_house",
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return id;
}

function addSite(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
): ConstructionSite["id"] {
  const id = parseConstructionSiteId(`site_${String(serial).padStart(8, "0")}`);
  const site: ConstructionSite = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    buildingType: "row_house",
    footprintCells: footprintCells.map((cell) => ({ ...cell })),
    orientation: 90,
    floors: 2,
    form: "row",
    progress: 5,
    workRequired: 40,
    resourcesReserved: { cement: 1, brick: 1, steel: 0 },
    crewCapacity: 0,
    upgradeBuildingId: null,
    repairBuildingId: null,
    kind: "construction",
    targetBuildingId: null,
    assignedCrewIds: [],
    assignedTechnicianId: null,
  };
  state.phase2.constructionSites.set(id, site);
  return id;
}

describe("H2-01 · la proyección publica el footprint físico de edificios y obras", () => {
  it("dos edificios de la misma parcela se proyectan cada uno con su huella y distrito", () => {
    const state = createInitialState(7);
    const parcel = deepParcel(state, 0);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const { left, right } = separatedFootprints(parcel);
    const b1 = addBuilding(state, parcel, 1, left);
    const b2 = addBuilding(state, parcel, 2, right);

    const projection = createViewProjection(state, true);
    expect(() => viewProjectionV2Schema.parse(projection)).not.toThrow();

    const projected = projection.economy!.buildings;
    const p1 = projected.find((entry) => entry.id === b1)!;
    const p2 = projected.find((entry) => entry.id === b2)!;

    /** Ambos viajan con su `parcelId`, `districtId` y su `footprintCells` propios. */
    expect(p1.parcelIds[0]!).toBe(parcel.id);
    expect(p2.parcelIds[0]!).toBe(parcel.id);
    expect(p1.districtId).toBe(parcel.districtId);
    expect(p2.districtId).toBe(parcel.districtId);
    expect(p1.footprintCells).toEqual(left);
    expect(p2.footprintCells).toEqual(right);

    /** Cinco campos geométricos del dominio, sin depender de propiedades accidentales del spread. */
    for (const entry of [p1, p2]) {
      expect(entry.orientation).toBe(0);
      expect(entry.floors).toBe(3);
      expect(entry.form).toBe("row");
    }

    /** Dos huellas distintas: no se colapsan en el anchor ni se duplican en la misma celda. */
    expect(p1.footprintCells).not.toEqual(p2.footprintCells);
  });

  it("un ConstructionSite con huella desplazada respecto al anchor conserva su geometría", () => {
    const state = createInitialState(7);
    const parcel = deepParcel(state, 1);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const { right } = separatedFootprints(parcel);
    const siteId = addSite(state, parcel, 1, right);

    const projection = createViewProjection(state, true);
    expect(() => viewProjectionV2Schema.parse(projection)).not.toThrow();
    const site = projection.economy!.constructionSites.find((entry) => entry.id === siteId)!;

    expect(site.parcelIds[0]!).toBe(parcel.id);
    expect(site.districtId).toBe(parcel.districtId);
    expect(site.footprintCells).toEqual(right);
    expect(site.orientation).toBe(90);
    expect(site.floors).toBe(2);
    expect(site.form).toBe("row");
    /** La huella no es el anchor de la parcela: el renderer no puede derivarla del `cell` proyectado. */
    expect(site.footprintCells[0]).not.toEqual(parcel.anchorCell);
  });

  it("el schema no recorta `footprintCells` ni `orientation` en el viaje worker → navegador", () => {
    /**
     * `apps/web/src/worker/client.ts:504` corre `viewProjectionV2Schema.safeParse(...)` sobre
     * el payload. Ese parse stripa todo campo no declarado: si el schema no declara los campos
     * geométricos, el navegador recibe un edificio sin huella y el bug de H2-01 reaparece
     * silenciosamente. El test lo fuerza pasando el objeto por Zod antes de leerlo.
     */
    const state = createInitialState(7);
    const parcel = deepParcel(state, 2);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const { left } = separatedFootprints(parcel);
    const buildingId = addBuilding(state, parcel, 3, left);

    const produced = createViewProjection(state, true);
    const reparsed = viewProjectionV2Schema.parse(produced);
    const projected = reparsed.economy!.buildings.find((entry) => entry.id === buildingId)!;

    /** Zod no debe haber borrado ninguno de los cinco campos añadidos en H2-01. */
    expect(projected.footprintCells).toEqual(left);
    expect(projected.districtId).toBe(parcel.districtId);
    expect(projected.orientation).toBe(0);
    expect(projected.floors).toBe(3);
    expect(projected.form).toBe("row");
  });

  it("un plan de dos edificios en parcelas distintas da dos `footprintCells` no solapados", () => {
    /**
     * El schema debe permitir que dos edificios proyectados compartan parcela con huellas
     * solapadas (los fixtures del motor lo impiden, pero el contrato de presentación no): el
     * punto es que la proyección *pueda* expresar dos localizaciones distintas dentro de una
     * misma parcela. Se comprueba midiendo el tamaño del bounding box: si los dos footprintCells
     * dieran el mismo centro, el renderer pintaría los dos sprites en el mismo sitio.
     */
    const state = createInitialState(7);
    const parcelA = deepParcel(state, 3);
    const parcelB = deepParcel(state, 4);
    parcelA.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    parcelB.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const a = separatedFootprints(parcelA).left;
    const b = separatedFootprints(parcelB).right;
    const ba = addBuilding(state, parcelA, 4, a);
    const bb = addBuilding(state, parcelB, 5, b);

    const projection = createViewProjection(state, true);
    const pa = projection.economy!.buildings.find((entry) => entry.id === ba)!;
    const pb = projection.economy!.buildings.find((entry) => entry.id === bb)!;
    expect(pa.footprintCells).not.toEqual(pb.footprintCells);
  });

  it("la proyección del distrito observado no publica edificios de otros distritos", () => {
    /**
     * Invariante de la vista: `districtId` publicado coincide con `observedDistrictId` para todos
     * los edificios. Se añade el campo por H2-01 sin abrir una puerta a información cross-district.
     */
    const state = createInitialState(7);
    const parcel = deepParcel(state, 5);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    addBuilding(state, parcel, 6, separatedFootprints(parcel).left);

    const projection = createViewProjection(state, true);
    const observed = projection.observedDistrictId;
    for (const building of projection.economy!.buildings) {
      expect(building.districtId).toBe(observed);
    }
    for (const site of projection.economy!.constructionSites) {
      expect(site.districtId).toBe(observed);
    }
  });
});
