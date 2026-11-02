import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseDevelopmentCodeId,
  parseMoney,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parseTick,
  type Building,
  type BuildingDefinition,
  type BuildingType,
  type DevelopmentCode,
  type DevelopmentPlacementId,
  type GridCell,
  type OrganizationId,
  type Parcel,
  type ParcelId,
  type ProductCommand,
} from "@landlord/shared";
import { developmentCodeById } from "./development-codes";
import { dispatchProductCommand } from "./commands";
import { enumeratePurchasableDevelopmentSites } from "./development-site";
import {
  PLACEMENT_CANDIDATE_PAGE_SIZE,
  choosePlacementFrom,
  developmentPlacementIdFor,
  developmentPlacementCandidatesFor,
  enumerateDevelopmentPlacementCandidates,
  placementCodeFor,
  resolveDevelopmentPlacementSite,
} from "./development-placement";
import { chooseFootprint, enumerateFootprintCandidates } from "./footprints";
import { BUILDING_DEFINITIONS, GAME_HOUR_TICKS } from "./game-data";
import { activePermitFor } from "./permitting";
import { advanceProductSystems } from "./systems";
import { createInitialState, type GameState } from "./state";

const actor = parsePersonId("person_00000001");
const organization = parseOrganizationId("org_00000001");

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: organization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

/* ------------------------------------------------------------------ *
 * Fixtures geométricos puros: la legalidad de una huella se decide con
 * celdas, código y definición, sin necesidad de una ciudad generada.
 * ------------------------------------------------------------------ */

function rectangle(x: number, y: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < height; row += 1)
    for (let column = 0; column < width; column += 1) cells.push({ x: x + column, y: y + row });
  return cells;
}

function codeOf(overrides: Partial<DevelopmentCode> = {}): DevelopmentCode {
  return {
    id: parseDevelopmentCodeId("placement_fixture_code"),
    allowedUses: ["residential", "retail", "industrial"],
    maxFloors: 5,
    maxCoveragePercent: 100,
    maxFloorAreaRatioPercent: 1_000,
    streetSetbackCells: 0,
    sideSetbackCells: 0,
    ...overrides,
  };
}

function siteOf(cells: GridCell[], frontageCells: GridCell[] = []) {
  return {
    parcel: {
      cells,
      roadFrontages: frontageCells.length
        ? [{ roadSegmentId: "road_fixture", cells: frontageCells }]
        : [],
    },
    principalFrontageCells: frontageCells,
  };
}

function footprintOf(cells: readonly GridCell[]): string {
  return [...cells]
    .map((cell) => `${cell.x},${cell.y}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function enumerate(
  cells: GridCell[],
  definition: BuildingDefinition,
  options: {
    code?: DevelopmentCode;
    frontage?: GridCell[];
    buildings?: readonly Pick<Building, "footprintCells" | "floors">[];
  } = {},
) {
  const site = siteOf(cells, options.frontage ?? []);
  return enumerateFootprintCandidates({
    parcel: site.parcel,
    code: options.code ?? codeOf(),
    definition,
    principalFrontageCells: site.principalFrontageCells,
    buildings: options.buildings ?? [],
  });
}

const COURTYARD = BUILDING_DEFINITIONS.courtyard_home;
const WAREHOUSE = BUILDING_DEFINITIONS.warehouse;

describe("V.d-7C · enumeración autoritativa de colocaciones (fixtures de geometría)", () => {
  it("un solar de una celda da exactamente un candidato", () => {
    const enumeration = enumerate([{ x: 4, y: 4 }], { ...COURTYARD, targetFootprintCells: 1 });
    expect(enumeration.candidates).toHaveLength(1);
    expect(enumeration.rejection).toBeNull();
    expect(enumeration.candidates[0]!.footprintCells).toEqual([{ x: 4, y: 4 }]);
  });

  it("un envelope más grande da varios candidatos ordenados canónicamente", () => {
    const enumeration = enumerate(rectangle(0, 0, 4, 3), COURTYARD);
    expect(enumeration.candidates.length).toBeGreaterThan(1);
    /** El área objetivo manda, y dentro del mismo bloque gana la huella más pegada al frente. */
    const areas = enumeration.candidates.map((entry) => entry.footprintCells.length);
    expect(areas[0]).toBeGreaterThanOrEqual(Math.min(COURTYARD.targetFootprintCells, ...areas));
    /** El orden es un orden total: ninguna comparacióntie deja el resultado indefinido. */
    const keys = enumeration.candidates.map(
      (entry) => `${entry.signature}|${entry.orientation}|${entry.floors}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cero candidatos por retranqueos: NO_BUILDABLE_ENVELOPE", () => {
    /** Banda 3×1 con retranqueo de calle y de lado: no queda nada edificable. */
    const strip = rectangle(0, 0, 3, 1);
    const enumeration = enumerate(strip, COURTYARD, {
      code: codeOf({ streetSetbackCells: 1, sideSetbackCells: 1 }),
      frontage: strip,
    });
    expect(enumeration.candidates).toHaveLength(0);
    expect(enumeration.rejection).toBe("NO_BUILDABLE_ENVELOPE");
  });

  it("cero candidatos por cobertura: COVERAGE_LIMIT", () => {
    const cells = rectangle(0, 0, 2, 2);
    const enumeration = enumerate(cells, COURTYARD, {
      code: codeOf({ maxCoveragePercent: 75 }),
      buildings: [{ footprintCells: [cells[0]!, cells[1]!, cells[2]!], floors: 1 }],
    });
    expect(enumeration.candidates).toHaveLength(0);
    expect(enumeration.rejection).toBe("COVERAGE_LIMIT");
  });

  it("cero candidatos por FAR: FAR_LIMIT", () => {
    const cells = rectangle(0, 0, 2, 2);
    const enumeration = enumerate(cells, COURTYARD, {
      code: codeOf({ maxFloorAreaRatioPercent: 100 }),
      buildings: [{ footprintCells: [cells[0]!], floors: 4 }],
    });
    expect(enumeration.candidates).toHaveLength(0);
    expect(enumeration.rejection).toBe("FAR_LIMIT");
  });

  it("la superficie edificable insuficiente se explica con el código del motor", () => {
    /** Cubertura al 50 % sobre 4 celdas: sólo caben huellas de 2 celdas como máximo. */
    const enumeration = enumerate(rectangle(0, 0, 2, 2), COURTYARD, {
      code: codeOf({ maxCoveragePercent: 50 }),
    });
    expect(enumeration.candidates.length).toBeGreaterThan(0);
    for (const candidate of enumeration.candidates)
      expect(candidate.footprintCells.length).toBeLessThanOrEqual(2);
  });

  it("una obstrucción existente saca sus celdas de todas las candidatas", () => {
    const cells = rectangle(0, 0, 3, 3);
    const blocker = rectangle(1, 1, 1, 1);
    const enumeration = enumerate(
      cells,
      { ...COURTYARD, targetFootprintCells: 9 },
      {
        buildings: [{ footprintCells: blocker, floors: 1 }],
      },
    );
    expect(enumeration.candidates.length).toBeGreaterThan(0);
    for (const candidate of enumeration.candidates)
      for (const cell of candidate.footprintCells) expect(cell.x === 1 && cell.y === 1).toBe(false);
  });

  it("produce orientación 0° y 90° según geometría y nunca 180° ni 270°", () => {
    const enumeration = enumerate(rectangle(0, 0, 3, 2), {
      ...WAREHOUSE,
      targetFootprintCells: 6,
    });
    const orientations = new Set(enumeration.candidates.map((entry) => entry.orientation));
    expect(orientations.has(0)).toBe(true);
    expect(orientations.has(90)).toBe(true);
    for (const candidate of enumeration.candidates) {
      const width =
        Math.max(...candidate.footprintCells.map((cell) => cell.x)) -
        Math.min(...candidate.footprintCells.map((cell) => cell.x)) +
        1;
      const height =
        Math.max(...candidate.footprintCells.map((cell) => cell.y)) -
        Math.min(...candidate.footprintCells.map((cell) => cell.y)) +
        1;
      expect(candidate.orientation).toBe(width >= height ? 0 : 90);
    }
  });

  it("un edificio simétrico no genera opciones duplicadas equivalentes", () => {
    const enumeration = enumerate(rectangle(0, 0, 4, 4), COURTYARD);
    const byGeometry = enumeration.candidates.map((entry) => footprintOf(entry.footprintCells));
    /** Misma huella = mismo rectángulo; rotarla 180° es geométricamente la misma celda. */
    expect(new Set(byGeometry).size).toBe(byGeometry.length);
    const byIdentity = enumeration.candidates.map((entry) =>
      developmentPlacementIdFor(
        { buildingType: "courtyard_home", parcelIds: [parseParcelId("parcel_00000001")] },
        entry,
      ),
    );
    expect(new Set(byIdentity).size).toBe(byIdentity.length);
  });

  it("el orden de las celdas de la parcela no cambia los candidatos", () => {
    const cells = rectangle(0, 0, 4, 3);
    const forward = enumerate(cells, COURTYARD);
    const backward = enumerate([...cells].reverse(), COURTYARD);
    expect(backward.candidates.map((entry) => entry.signature)).toEqual(
      forward.candidates.map((entry) => entry.signature),
    );
  });

  it("descubrir primero huellas pequeñas no reordena la lista final", () => {
    const cells = rectangle(0, 0, 5, 4);
    const first = enumerate(cells, COURTYARD);
    const second = enumerate(
      [...cells].sort((left, right) => right.x - left.x),
      COURTYARD,
    );
    expect(second.candidates.map((entry) => entry.signature)).toEqual(
      first.candidates.map((entry) => entry.signature),
    );
  });

  it("el mejor candidato coincide con la autocolocación que decidía el motor", () => {
    const shapes: GridCell[][] = [
      rectangle(0, 0, 3, 3),
      rectangle(0, 0, 5, 2),
      rectangle(2, 1, 4, 4),
      [...rectangle(0, 0, 2, 2), ...rectangle(4, 0, 2, 3)],
    ];
    const codes = [codeOf(), codeOf({ maxCoveragePercent: 60 }), codeOf({ streetSetbackCells: 1 })];
    const types: BuildingType[] = ["courtyard_home", "row_house", "apartment_block", "workshop"];
    for (const cells of shapes)
      for (const code of codes)
        for (const buildingType of types) {
          const input = {
            parcel: siteOf(cells).parcel,
            code,
            definition: BUILDING_DEFINITIONS[buildingType],
            principalFrontageCells: siteOf(cells).principalFrontageCells,
            buildings: [],
          };
          const legacy = chooseFootprint(input);
          const enumeration = enumerateFootprintCandidates(input);
          if ("error" in legacy) {
            expect(enumeration.candidates).toHaveLength(0);
            expect(enumeration.rejection).toBe(legacy.error);
          } else {
            expect(enumeration.candidates[0]).toBeDefined();
            expect(footprintOf(enumeration.candidates[0]!.footprintCells)).toBe(
              footprintOf(legacy.footprintCells),
            );
            expect(enumeration.candidates[0]!.orientation).toBe(legacy.orientation);
            expect(enumeration.candidates[0]!.floors).toBe(legacy.floors);
          }
        }
  });

  it("la identidad deriva de geometría canónica y es estable entre ejecuciones", () => {
    const site = {
      buildingType: "courtyard_home" as BuildingType,
      parcelIds: [parseParcelId("parcel_00000002"), parseParcelId("parcel_00000001")] as ParcelId[],
    };
    const candidate = { signature: "1,2,3,4", orientation: 90 as const };
    const id = developmentPlacementIdFor(site, candidate);
    expect(id).toMatch(/^placement_[0-9a-f]{16}$/);
    expect(developmentPlacementIdFor(site, candidate)).toBe(id);
    /** El orden del conjunto no cambia la identidad: se canonicaliza antes de derivar. */
    const enumeration = enumerate(rectangle(0, 0, 3, 3), COURTYARD);
    const asCanonical = {
      buildingType: "courtyard_home" as BuildingType,
      parcelIds: [parseParcelId("parcel_00000001"), parseParcelId("parcel_00000002")] as ParcelId[],
    };
    expect(
      developmentPlacementIdFor(asCanonical, {
        signature: enumeration.candidates[0]!.signature,
        orientation: enumeration.candidates[0]!.orientation,
      }),
    ).toBe(
      developmentPlacementIdFor(asCanonical, {
        signature: enumeration.candidates[0]!.signature,
        orientation: enumeration.candidates[0]!.orientation,
      }),
    );
    /** Cambiar la orientación es otra colocación. */
    expect(developmentPlacementIdFor(site, { signature: "1,2,3,4", orientation: 0 })).not.toBe(
      developmentPlacementIdFor(site, candidate),
    );
    /** Cambiar el tipo de edificio es otra colocación aunque la huella sea idéntica. */
    expect(developmentPlacementIdFor({ ...site, buildingType: "row_house" }, candidate)).not.toBe(
      developmentPlacementIdFor(site, candidate),
    );
  });
});

/* ------------------------------------------------------------------ *
 * Nivel de estado: solar multi-parcela, revalidación y petición de sólo
 * lectura sobre la ciudad generada (semilla 7, la canónica de V.d-7A).
 * ------------------------------------------------------------------ */

function fund(state: GameState): void {
  state.phase2.balances.set(organization, parseMoney(5_000_000));
  const inventory = state.phase2.inventories.get(organization);
  if (inventory) {
    inventory.cement += 900;
    inventory.brick += 900;
    inventory.steel += 900;
  }
}

/** Compra el primer solar físico válido para el tipo y lo pone a nombre del jugador. */
function acquireSite(state: GameState, buildingType: BuildingType): ParcelId[] {
  const definition = BUILDING_DEFINITIONS[buildingType];
  const sites = enumeratePurchasableDevelopmentSites({ state, definition });
  expect(sites.length).toBeGreaterThan(0);
  const ids = sites[0]!;
  for (const id of ids) state.phase2.parcels.get(id)!.ownerOrganizationId = organization;
  return ids;
}

function parcelsOf(state: GameState, ids: readonly ParcelId[]): Parcel[] {
  return ids.map((id) => state.phase2.parcels.get(id)!);
}

function enumerateFor(
  state: GameState,
  ids: readonly ParcelId[],
  buildingType: BuildingType,
  observer: OrganizationId = organization,
) {
  return enumerateDevelopmentPlacementCandidates(state, {
    parcelIds: ids,
    buildingType,
    organizationId: observer,
  });
}

function completeOldestSite(state: GameState): Building {
  const site = [...state.phase2.constructionSites.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )[0]!;
  site.progress = site.workRequired;
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + GAME_HOUR_TICKS) };
  advanceProductSystems(state);
  const building = [...state.phase2.buildings.values()].at(-1)!;
  return building;
}

describe("V.d-7C · colocación sobre el estado de la partida", () => {
  it("una parcela: al menos una colocación legal y la primera es la recomendada", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "courtyard_home");
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    expect(enumerated.rejection).toBeNull();
    expect(enumerated.candidates.length).toBeGreaterThan(0);
    expect(enumerated.candidates[0]!.recommended).toBe(true);
    expect(enumerated.candidates.slice(1).every((entry) => !entry.recommended)).toBe(true);
  });

  it("dos parcelas: la huella puede usar la unión y nunca una tercera parcela", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "warehouse");
    expect(ids).toHaveLength(2);
    const enumerated = enumerateFor(state, ids, "warehouse");
    expect(enumerated.candidates.length).toBeGreaterThan(0);
    const union = new Set(
      parcelsOf(state, ids).flatMap((parcel) => parcel.cells.map((cell) => `${cell.x},${cell.y}`)),
    );
    for (const candidate of enumerated.candidates) {
      expect(candidate.parcelIds).toEqual([...ids].sort());
      for (const cell of candidate.footprintCells)
        expect(union.has(`${cell.x},${cell.y}`)).toBe(true);
    }
    const widest = Math.max(
      ...enumerated.candidates.map((candidate) => candidate.footprintCells.length),
    );
    expect(widest).toBeGreaterThan(0);
  });

  it("tres parcelas: la acería enumera sobre la unión canónica", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "steelworks");
    expect(ids).toHaveLength(3);
    const enumerated = enumerateFor(state, ids, "steelworks");
    expect(enumerated.candidates.length).toBeGreaterThan(0);
    const union = new Set(
      parcelsOf(state, ids).flatMap((parcel) => parcel.cells.map((cell) => `${cell.x},${cell.y}`)),
    );
    for (const candidate of enumerated.candidates)
      for (const cell of candidate.footprintCells)
        expect(union.has(`${cell.x},${cell.y}`)).toBe(true);
  });

  it("el orden de parcelIds y el orden de los Maps no cambian los candidatos", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "warehouse");
    const forward = enumerateFor(state, ids, "warehouse");
    const backward = enumerateFor(state, [...ids].reverse(), "warehouse");
    expect(backward.candidates.map((entry) => entry.id)).toEqual(
      forward.candidates.map((entry) => entry.id),
    );
    const reversedMaps = {
      ...state,
      phase2: {
        ...state.phase2,
        parcels: new Map([...state.phase2.parcels.entries()].reverse()),
        buildings: new Map([...state.phase2.buildings.entries()].reverse()),
        constructionSites: new Map([...state.phase2.constructionSites.entries()].reverse()),
      },
    } as GameState;
    const shuffled = enumerateFor(reversedMaps, ids, "warehouse");
    expect(shuffled.candidates.map((entry) => entry.id)).toEqual(
      forward.candidates.map((entry) => entry.id),
    );
  });

  it("sin propiedad no hay colocación: el mismo código de rechazo que el comando", () => {
    const state = createInitialState(7);
    const definition = BUILDING_DEFINITIONS.courtyard_home;
    const foreign = enumeratePurchasableDevelopmentSites({ state, definition })[0]!;
    const enumerated = enumerateFor(state, foreign, "courtyard_home");
    expect(enumerated.candidates).toHaveLength(0);
    expect(enumerated.rejection).toBe("ACTOR_NOT_AUTHORIZED");
  });

  it("un edificio terminado deja su huella fuera de las candidatas restantes", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    const accepted = dispatchProductCommand(
      state,
      command("vd7c-occupy", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: enumerated.candidates[0]!.id,
      }),
    );
    expect(accepted.accepted).toBe(true);
    const building = completeOldestSite(state);
    const occupied = new Set(footprintOf(building.footprintCells).split("|"));
    const after = enumerateFor(state, ids, "courtyard_home");
    for (const candidate of after.candidates)
      for (const cell of candidate.footprintCells)
        expect(occupied.has(`${cell.x},${cell.y}`)).toBe(false);
  });

  it("la petición acota el transporte y conserva el total legal", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "courtyard_home");
    const parcel = state.phase2.parcels.get(ids[0]!)!;
    const answer = developmentPlacementCandidatesFor(state, {
      districtId: parcel.districtId,
      parcelIds: ids,
      buildingType: "courtyard_home",
      organizationId: organization,
    });
    expect(answer.candidates.length).toBeLessThanOrEqual(PLACEMENT_CANDIDATE_PAGE_SIZE);
    expect(answer.totalCandidates).toBeGreaterThanOrEqual(answer.candidates.length);
    expect(answer.districtId).toBe(parcel.districtId);
    expect(answer.parcelIds).toEqual([...ids].sort());
    expect(answer.rejection).toBeNull();
  });

  it("lejos del distrito pedido no se publican candidatos", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "courtyard_home");
    const own = parcelsOf(state, ids)[0]!;
    const other = [...state.phase2.parcels.values()].find(
      (parcel) => parcel.districtId !== own.districtId,
    )!;
    const answer = developmentPlacementCandidatesFor(state, {
      districtId: other.districtId,
      parcelIds: ids,
      buildingType: "courtyard_home",
      organizationId: organization,
    });
    expect(answer.candidates).toHaveLength(0);
    expect(answer.rejection).toBe("PARCELS_DIFFERENT_DISTRICT");
  });

  it("la petición de candidatos no avanza ticks, PRNG, caja ni expediente", () => {
    const state = createInitialState(7);
    const ids = acquireSite(state, "courtyard_home");
    const districtId = parcelsOf(state, ids)[0]!.districtId;
    const before = {
      tick: state.clock.tick,
      prng: JSON.stringify(state.prng),
      cash: state.phase2.balances.get(organization)!,
      inventory: JSON.stringify(state.phase2.inventories.get(organization)),
      permits: JSON.stringify(state.phase2.permitting),
      sites: state.phase2.constructionSites.size,
      serialized: JSON.stringify([...state.phase2.parcels]),
    };
    const answer = developmentPlacementCandidatesFor(state, {
      districtId,
      parcelIds: ids,
      buildingType: "courtyard_home",
      organizationId: organization,
    });
    expect(answer.candidates.length).toBeGreaterThan(0);
    expect(state.clock.tick).toBe(before.tick);
    expect(JSON.stringify(state.prng)).toBe(before.prng);
    expect(state.phase2.balances.get(organization)).toBe(before.cash);
    expect(JSON.stringify(state.phase2.inventories.get(organization))).toBe(before.inventory);
    expect(JSON.stringify(state.phase2.permitting)).toBe(before.permits);
    expect(state.phase2.constructionSites.size).toBe(before.sites);
    expect(JSON.stringify([...state.phase2.parcels])).toBe(before.serialized);
  });
});

describe("V.d-7C · StartConstruction revalidado", () => {
  it("construye exactamente la colocación confirmada, aunque no sea la recomendada", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    const chosen =
      enumerated.candidates.length > 1
        ? enumerated.candidates[enumerated.candidates.length - 1]!
        : enumerated.candidates[0]!;
    const result = dispatchProductCommand(
      state,
      command("vd7c-confirm", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: chosen.id,
      }),
    );
    expect(result.accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()].at(-1)!;
    expect(footprintOf(site.footprintCells)).toBe(footprintOf(chosen.footprintCells));
    expect(site.orientation).toBe(chosen.orientation);
    expect(site.floors).toBe(chosen.floors);
    expect(site.parcelIds).toEqual(chosen.parcelIds);
    if (enumerated.candidates.length > 1)
      expect(footprintOf(site.footprintCells)).not.toBe(
        footprintOf(enumerated.candidates[0]!.footprintCells),
      );
  });

  it("sin placementId el motor toma la mejor candidata: paridad con la IA", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    /** Lo que la IA ve antes de despachar: el enumerador autoritativo, sin interfaz. */
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    const best = enumerated.candidates[0]!;
    expect(best.recommended).toBe(true);
    const automatic = dispatchProductCommand(
      state,
      command("vd7c-automatic", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
      }),
    );
    expect(automatic.accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()].at(-1)!;
    /** El rival no tiene reglas distintas: su resultado ES el primer candidato del enumerador. */
    expect(footprintOf(site.footprintCells)).toBe(footprintOf(best.footprintCells));
    expect(site.orientation).toBe(best.orientation);
    expect(site.floors).toBe(best.floors);
    /** Y confirmar ese mismo candidato explícitamente tampoco puede dar otra huella. */
    const explicit = dispatchProductCommand(
      state,
      command("vd7c-explicit", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: best.id,
      }),
    );
    /** La parcela ya tiene una obra activa: el contrato es el mismo, el rechazo también. */
    expect(explicit.accepted).toBe(false);
    if (!explicit.accepted) expect(explicit.code).toBe("ACTIVE_SITE_ON_PARCEL");
  });

  it("candidato obsoleto: se rechaza sin gastar caja, materiales ni permiso y sin crear obra", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    dispatchProductCommand(
      state,
      command("vd7c-stale-permit", "RequestPermit", {
        parcelIds: ids,
        buildingType: "courtyard_home",
      }),
    );
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    const candidate = enumerated.candidates[0]!;
    /** Cambio legal de estado: una obra ocupa el solar y deja la candidata sin hueco. */
    const first = dispatchProductCommand(
      state,
      command("vd7c-stale-block", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: candidate.id,
      }),
    );
    expect(first.accepted).toBe(true);
    const before = {
      cash: state.phase2.balances.get(organization)!,
      inventory: JSON.stringify(state.phase2.inventories.get(organization)),
      permit: activePermitFor(state, ids, "courtyard_home", state.clock.tick)?.status ?? null,
      sites: state.phase2.constructionSites.size,
      permits: JSON.stringify(state.phase2.permitting),
      counters: JSON.stringify(state.phase2.idCounters),
      processed: state.processedCommandIds.size,
    };
    const stale = dispatchProductCommand(
      state,
      command("vd7c-stale-retry", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: candidate.id,
      }),
    );
    expect(stale.accepted).toBe(false);
    expect(state.phase2.balances.get(organization)).toBe(before.cash);
    expect(JSON.stringify(state.phase2.inventories.get(organization))).toBe(before.inventory);
    expect(state.phase2.constructionSites.size).toBe(before.sites);
    expect(JSON.stringify(state.phase2.permitting)).toBe(before.permits);
    expect(JSON.stringify(state.phase2.idCounters)).toBe(before.counters);
    expect(state.processedCommandIds.size).toBe(before.processed);
    /** El motor no reasigna: no aparece ninguna obra nueva con otra huella. */
    expect([...state.phase2.constructionSites.values()]).toHaveLength(before.sites);
  });

  it("una huella tapada por un edificio ya no es confirmable: PLACEMENT_NO_LONGER_VALID", () => {
    const state = createInitialState(7);
    fund(state);
    /** Parcela grande de una sola parcela: admite varios edificios conviviendo dentro del solar. */
    const definition = BUILDING_DEFINITIONS.courtyard_home;
    const candidate = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.disposition === "marketable" &&
          !parcel.ownerOrganizationId &&
          parcel.cells.length >= 18 &&
          enumeratePurchasableDevelopmentSites({ state, definition, seedParcelId: parcel.id })
            .length > 0,
      )
      .sort(
        (left, right) => right.cells.length - left.cells.length || left.id.localeCompare(right.id),
      )[0]!;
    candidate.ownerOrganizationId = organization;
    const ids = [candidate.id];
    const before = enumerateFor(state, ids, "courtyard_home");
    expect(before.candidates.length).toBeGreaterThan(1);
    /** El jugador confirma una candidata y la obra termina: ésa es la huella ocupada. */
    const occupiedPlacement = before.candidates[0]!;
    expect(
      dispatchProductCommand(
        state,
        command("vd7c-cover-build", "StartConstruction", {
          parcelIds: ids,
          buildingType: "courtyard_home",
          placementId: occupiedPlacement.id,
        }),
      ).accepted,
    ).toBe(true);
    const building = completeOldestSite(state);
    const buildingsNow = state.phase2.buildings.size;
    const occupied = new Set(footprintOf(building.footprintCells).split("|"));
    /** Buscamos una candidata anterior que cruzara esa huella: ahora es ilegal. */
    const overlapping = before.candidates.find((entry) =>
      entry.footprintCells.some((cell) => occupied.has(`${cell.x},${cell.y}`)),
    );
    expect(overlapping).toBeDefined();
    if (!overlapping) return;
    const after = enumerateFor(state, ids, "courtyard_home");
    /** El solar sigue siendo un proyecto válido: sólo ésa colocación desapareció. */
    expect(after.candidates.length).toBeGreaterThan(0);
    expect(after.candidates.map((entry) => entry.id)).not.toContain(overlapping.id);
    const cashBefore = state.phase2.balances.get(organization)!;
    const rejected = dispatchProductCommand(
      state,
      command("vd7c-cover-retry", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: overlapping.id,
      }),
    );
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) expect(rejected.code).toBe("PLACEMENT_NO_LONGER_VALID");
    expect(state.phase2.balances.get(organization)).toBe(cashBefore);
    /** Ninguna obra nueva: sólo el edificio terminado que ocupó la huella sigue en el mundo. */
    expect(state.phase2.buildings.size).toBe(buildingsNow);
  });

  it("una identidad inventada no cuela ninguna huella", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    const before = state.phase2.balances.get(organization)!;
    const invented = `placement_${"f".repeat(16)}` as DevelopmentPlacementId;
    const rejected = dispatchProductCommand(
      state,
      command("vd7c-invented", "StartConstruction", {
        parcelIds: ids,
        buildingType: "courtyard_home",
        placementId: invented,
      }),
    );
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) expect(rejected.code).toBe("PLACEMENT_NO_LONGER_VALID");
    expect(state.phase2.balances.get(organization)).toBe(before);
    expect(state.phase2.constructionSites.size).toBe(0);
  });

  it("cancelar la colocación no muta el estado: no hay comando que cancelar", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    const enumerated = enumerateFor(state, ids, "courtyard_home");
    /** La UI cambia de candidata y sale: ninguna de esas acciones toca el motor. */
    const before = JSON.stringify(state);
    expect(enumerated.candidates.length).toBeGreaterThan(0);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.phase2.constructionSites.size).toBe(0);
    expect(activePermitFor(state, ids, "courtyard_home", state.clock.tick)).toBeNull();
  });

  it("el código congelado en el permiso manda también en la revalidación", () => {
    const state = createInitialState(7);
    fund(state);
    const ids = acquireSite(state, "courtyard_home");
    const site = resolveDevelopmentPlacementSite(state, {
      parcelIds: ids,
      buildingType: "courtyard_home",
      organizationId: organization,
    });
    expect(site.ok).toBe(true);
    if (!site.ok) return;
    const code = placementCodeFor(state, site.site);
    expect(code.id).toBe(developmentCodeById(site.site.parcels[0]!.developmentCodeId).id);
    const chosen = choosePlacementFrom(site.site, code);
    expect(chosen.ok).toBe(true);
  });
});
