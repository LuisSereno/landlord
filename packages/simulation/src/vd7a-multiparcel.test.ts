import { describe, expect, it } from "vitest";

import {
  canonicalParcelIds,
  parseCommandId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parseTick,
  type BuildingType,
  type GridCell,
  type Parcel,
  type ParcelId,
  type ProductCommand,
} from "@landlord/shared";
import { runAutomation } from "./automation";
import { activeSiteOnParcel, buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { buildingCollateralContribution, collateralBuildingValue } from "./collateral";
import { dispatchProductCommand } from "./commands";
import {
  DEVELOPMENT_CODES,
  developmentCodeById,
  isBuildingAllowedByDevelopmentCode,
} from "./development-codes";
import {
  BUILDING_DEFINITIONS,
  GAME_DAY_TICKS,
  GAME_HOUR_TICKS,
  LOAN_POLICY,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { activePermitFor, permitsFor } from "./permitting";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/**
 * V.d-7A · invariantes del dominio multi-parcela. La ciudad de fixture no contiene tripletes
 * industriales contiguos (los bloques industriales se generan por pares), así que los casos que
 * necesitan tres parcelas o una frontera catastral concreta reconstruyen la geometría de parcelas
 * ya compradas. El comando valida el contrato real; lo sintético es sólo el solar de prueba.
 */

const ACTOR = parsePersonId("person_00000001");

type Command = Exclude<ProductCommand, { type: "PlaceTestStructure" }>;

function command<T extends Command["type"]>(
  id: string,
  type: T,
  payload: Extract<Command, { type: T }>["payload"],
  organizationId: Command["actingAsOrganizationId"] = PLAYER_ORGANIZATION_ID,
): Extract<Command, { type: T }> {
  return {
    commandId: parseCommandId(id),
    type,
    payload,
    issuedByPersonId: ACTOR,
    actingAsOrganizationId: organizationId,
  } as Extract<Command, { type: T }>;
}

function freshState(seed = 31): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(200_000));
  return state;
}

function buy(state: GameState, parcels: readonly Parcel[]): void {
  for (const parcel of parcels) {
    const result = dispatchProductCommand(
      state,
      command(`buy-${parcel.id}`, "BuyParcel", { parcelId: parcel.id }),
    );
    if (!result.accepted) throw new Error(`no se pudo comprar ${parcel.id}: ${result.code}`);
  }
}

function build(
  state: GameState,
  parcelIds: ParcelId[],
  buildingType: BuildingType,
  commandId = "build",
) {
  return dispatchProductCommand(
    state,
    command(commandId, "StartConstruction", { parcelIds, buildingType }),
  );
}

function finishSites(state: GameState): void {
  for (const site of [...state.phase2.constructionSites.values()])
    site.progress = site.workRequired;
  /** La obra sólo avanza en horas de juego: se salta al siguiente límite antes de simular. */
  const nextHour = Math.max(
    GAME_HOUR_TICKS,
    Math.ceil((state.clock.tick + 1) / GAME_HOUR_TICKS) * GAME_HOUR_TICKS,
  );
  state.clock = { ...state.clock, tick: parseTick(nextHour) };
  advanceProductSystems(state);
}

function playerBuilding(state: GameState, type: BuildingType) {
  const building = [...state.phase2.buildings.values()].find(
    (entry) => entry.ownerOrganizationId === PLAYER_ORGANIZATION_ID && entry.type === type,
  );
  if (!building) throw new Error(`no existe un edificio del jugador de tipo ${type}`);
  return building;
}

function marketableParcels(state: GameState, districtId?: string): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.disposition === "marketable" &&
        !parcel.ownerOrganizationId &&
        (districtId === undefined || parcel.districtId === districtId),
    )
    .sort(
      (left, right) =>
        left.districtId.localeCompare(right.districtId) || left.id.localeCompare(right.id),
    );
}

/**
 * Busca un conjunto de parcelas libres, del mismo distrito y código, que el tipo de edificio
 * admita. No exige contigüidad: los tests sintéticos la reconstruyen después.
 */
function findParcelsFor(
  state: GameState,
  definition: (typeof BUILDING_DEFINITIONS)[BuildingType],
  count: number,
  options: { districtId?: string } = {},
): Parcel[] {
  const byCode = new Map<string, Parcel[]>();
  for (const parcel of marketableParcels(state, options.districtId)) {
    if (
      !isBuildingAllowedByDevelopmentCode(definition, developmentCodeById(parcel.developmentCodeId))
    )
      continue;
    const key = `${parcel.districtId}:${parcel.developmentCodeId}`;
    const group = byCode.get(key) ?? [];
    group.push(parcel);
    byCode.set(key, group);
  }
  for (const key of [...byCode.keys()].sort()) {
    const group = byCode.get(key)!;
    if (group.length >= count) return group.slice(0, count);
  }
  throw new Error(
    `la ciudad de fixture no tiene ${count} parcelas compatibles con ${definition.type}`,
  );
}

function rectangle(x0: number, y0: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let y = y0; y < y0 + height; y += 1)
    for (let x = x0; x < x0 + width; x += 1) cells.push({ x, y });
  return cells;
}

/**
 * Conjunto real de parcelas contiguas por borde, del mismo distrito y código, aptas para el tipo.
 * La ciudad genera pares industriales naturales; no hay tripletes, así que sólo se usa con 2.
 */
function findConnectedParcels(
  state: GameState,
  definition: (typeof BUILDING_DEFINITIONS)[BuildingType],
  count: number,
  options: { districtId?: string } = {},
): Parcel[] {
  const candidates = marketableParcels(state, options.districtId).filter((parcel) =>
    isBuildingAllowedByDevelopmentCode(definition, developmentCodeById(parcel.developmentCodeId)),
  );
  const byId = new Map(candidates.map((parcel) => [parcel.id, parcel]));
  const cellOwner = new Map<string, string>();
  for (const parcel of candidates)
    for (const cell of parcel.cells)
      cellOwner.set(`${parcel.districtId}:${cell.x}:${cell.y}`, parcel.id);
  const neighbours = new Map<ParcelId, ParcelId[]>();
  for (const parcel of candidates) {
    const found = new Set<ParcelId>();
    for (const cell of parcel.cells)
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const id = cellOwner.get(`${parcel.districtId}:${cell.x + dx}:${cell.y + dy}`);
        if (id && id !== parcel.id) found.add(parseParcelId(id));
      }
    neighbours.set(
      parcel.id,
      [...found].sort((left, right) => left.localeCompare(right)),
    );
  }
  const sets = new Set<string>();
  for (const seed of candidates) {
    const frontier: ParcelId[][] = [[seed.id]];
    while (frontier.length > 0) {
      const set = frontier.shift()!;
      if (set.length === count) {
        sets.add(canonicalParcelIds(set).join(","));
        continue;
      }
      for (const next of neighbours.get(set[set.length - 1]!) ?? [])
        if (!set.includes(next)) frontier.push([...set, next]);
    }
  }
  for (const key of [...sets].sort()) {
    const parcels = key.split(",").map((id) => byId.get(parseParcelId(id))!);
    if (parcels.some((parcel) => parcel === undefined)) continue;
    const districtId = parcels[0]!.districtId;
    const codeId = parcels[0]!.developmentCodeId;
    if (
      parcels.some(
        (parcel) => parcel.districtId !== districtId || parcel.developmentCodeId !== codeId,
      )
    )
      continue;
    const area = parcels.reduce((total, parcel) => total + parcel.cells.length, 0);
    if (area < definition.siteRequirements.minCombinedAreaCells) continue;
    return parcels;
  }
  throw new Error(
    `la ciudad de fixture no tiene ${count} parcelas contiguas compatibles con ${definition.type}`,
  );
}

function reshape(parcel: Parcel, cells: GridCell[], frontage?: GridCell[]): void {
  parcel.cells = cells;
  parcel.roadFrontages =
    frontage === undefined ? [] : [{ roadSegmentId: "synthetic_vd7", cells: frontage }];
}

function buildCompletedCementPlant(seed = 31) {
  const state = freshState(seed);
  const pair = findConnectedParcels(state, BUILDING_DEFINITIONS.cement_plant, 2);
  buy(state, pair);
  const result = build(
    state,
    pair.map((parcel) => parcel.id),
    "cement_plant",
    "factory-build",
  );
  if (!result.accepted) throw new Error(`cementera rechazada: ${result.code}`);
  finishSites(state);
  return { state, pair, building: playerBuilding(state, "cement_plant") };
}

describe("V.d-7A · solar multi-parcela (A-L)", () => {
  it("A · una vivienda de una parcela sigue siendo válida", () => {
    const state = freshState(31);
    const parcel = findParcelsFor(state, BUILDING_DEFINITIONS.courtyard_home, 1)[0]!;
    buy(state, [parcel]);
    expect(build(state, [parcel.id], "courtyard_home")).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(site.parcelIds).toEqual([parcel.id]);
  });

  it("B · una cementera exige exactamente dos parcelas", () => {
    const state = freshState(31);
    const [seed] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [seed!]);
    expect(build(state, [seed!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "WRONG_PARCEL_COUNT",
    });
  });

  it("C · una cementera con dos parcelas contiguas se acepta", () => {
    const state = freshState(31);
    const [first, second] = findConnectedParcels(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    const result = build(state, [first!.id, second!.id], "cement_plant");
    expect(result).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(site.parcelIds).toEqual(canonicalParcelIds([first!.id, second!.id]));
  });

  it("D · dos parcelas que sólo se tocan en diagonal se rechazan", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    reshape(first!, [{ x: 20, y: 20 }]);
    reshape(second!, [{ x: 21, y: 21 }]);
    expect(build(state, [first!.id, second!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "PARCELS_NOT_EDGE_CONTIGUOUS",
    });
  });

  it("E · parcelas de distritos distintos se rechazan", () => {
    const state = freshState(31);
    const parcels = marketableParcels(state).filter((parcel) =>
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.cement_plant,
        developmentCodeById(parcel.developmentCodeId),
      ),
    );
    const first = parcels[0]!;
    const other = parcels.find((parcel) => parcel.districtId !== first.districtId)!;
    buy(state, [first, other]);
    expect(build(state, [first.id, other.id], "cement_plant")).toEqual({
      accepted: false,
      code: "PARCELS_DIFFERENT_DISTRICT",
    });
  });

  it("F · una parcela del rival se rechaza", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!]);
    second!.ownerOrganizationId = RIVAL_ORGANIZATION_ID;
    expect(build(state, [first!.id, second!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "ACTOR_NOT_AUTHORIZED",
    });
  });

  it("G · una parcela pública se rechaza", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    second!.disposition = "public";
    expect(build(state, [first!.id, second!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "PUBLIC_LAND_NOT_BUILDABLE",
    });
  });

  it("H · códigos urbanísticos distintos se rechazan", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    const otherCode = Object.values(DEVELOPMENT_CODES).find(
      (code) => code.id !== second!.developmentCodeId,
    )!;
    second!.developmentCodeId = otherCode.id;
    expect(build(state, [first!.id, second!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "MIXED_DEVELOPMENT_CODES",
    });
  });

  it("I · ids duplicados se rechazan antes de cualquier cobro", () => {
    const state = freshState(31);
    const [first] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!]);
    expect(build(state, [first!.id, first!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "DUPLICATE_PARCELS",
    });
  });

  it("J · área combinada insuficiente se rechaza", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    reshape(first!, [{ x: 20, y: 20 }]);
    reshape(second!, [{ x: 21, y: 20 }]);
    expect(build(state, [first!.id, second!.id], "cement_plant")).toEqual({
      accepted: false,
      code: "SITE_AREA_TOO_SMALL",
    });
  });

  it("K · la huella puede cruzar la frontera catastral interna", () => {
    const state = freshState(31);
    const [first, second] = findParcelsFor(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    reshape(first!, rectangle(0, 0, 5, 4), [{ x: 0, y: 0 }]);
    reshape(second!, rectangle(5, 0, 5, 4));
    const result = build(state, [first!.id, second!.id], "cement_plant");
    expect(result).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()][0]!;
    const inFirst = new Set(first!.cells.map((cell) => `${cell.x}:${cell.y}`));
    expect(site.footprintCells.some((cell) => inFirst.has(`${cell.x}:${cell.y}`))).toBe(true);
    expect(site.footprintCells.some((cell) => !inFirst.has(`${cell.x}:${cell.y}`))).toBe(true);
    const union = new Set([...first!.cells, ...second!.cells].map((cell) => `${cell.x}:${cell.y}`));
    expect(site.footprintCells.every((cell) => union.has(`${cell.x}:${cell.y}`))).toBe(true);
  });

  it("L · la acería sólo se acepta con tres parcelas", () => {
    const state = freshState(31);
    const parcels = findParcelsFor(state, BUILDING_DEFINITIONS.steelworks, 3);
    buy(state, parcels);
    reshape(parcels[0]!, rectangle(0, 0, 4, 4), [{ x: 0, y: 0 }]);
    reshape(parcels[1]!, rectangle(4, 0, 4, 4));
    reshape(parcels[2]!, rectangle(8, 0, 4, 4));
    const [first, second, third] = parcels as [Parcel, Parcel, Parcel];
    expect(build(state, [first.id, second.id], "steelworks")).toEqual({
      accepted: false,
      code: "WRONG_PARCEL_COUNT",
    });
    expect(build(state, [first.id, second.id, third.id], "steelworks")).toMatchObject({
      accepted: true,
    });
    expect([...state.phase2.constructionSites.values()][0]!.parcelIds).toEqual(
      canonicalParcelIds([first.id, second.id, third.id]),
    );
  });
});

describe("V.d-7A · permisos, ciclo de vida e índices (M-T)", () => {
  it("M · el permiso vale para el conjunto exacto, no para otro ni para un subconjunto", () => {
    const state = freshState(31);
    const [first, second] = findConnectedParcels(state, BUILDING_DEFINITIONS.cement_plant, 2);
    const third = marketableParcels(state).find(
      (parcel) => parcel.id !== first!.id && parcel.id !== second!.id,
    )!;
    buy(state, [first!, second!, third!]);
    const request = dispatchProductCommand(
      state,
      command("permit-ab", "RequestPermit", {
        parcelIds: [first!.id, second!.id],
        buildingType: "cement_plant",
      }),
    );
    expect(request).toMatchObject({ accepted: true });
    const permit = activePermitFor(
      state,
      [first!.id, second!.id],
      "cement_plant",
      state.clock.tick,
    )!;
    expect(permit).not.toBeNull();
    expect(
      activePermitFor(state, [second!.id, first!.id], "cement_plant", state.clock.tick)?.id,
    ).toBe(permit.id);
    expect(permitsFor(state, [first!.id, third!.id], "cement_plant")).toEqual([]);
    expect(activePermitFor(state, [first!.id], "cement_plant", state.clock.tick)).toBeNull();
    expect(
      activePermitFor(state, [first!.id, second!.id, third!.id], "cement_plant", state.clock.tick),
    ).toBeNull();

    expect(build(state, [first!.id, second!.id], "cement_plant")).toMatchObject({
      accepted: true,
    });
    expect(permit.status).toBe("consumed");
    expect(
      activePermitFor(state, [first!.id, second!.id], "cement_plant", state.clock.tick),
    ).toBeNull();
  });

  it("N · completar la obra conserva todas las parcelas", () => {
    const { state, pair, building } = buildCompletedCementPlant();
    expect(building.parcelIds).toEqual(canonicalParcelIds(pair.map((parcel) => parcel.id)));
    const index = buildBuildingIndex(state);
    for (const parcel of pair) {
      const found = buildingsOnParcel(index, parcel.id);
      expect(found.map((entry) => entry.id)).toEqual([building.id]);
    }
    for (const parcel of pair) expect(parcel.currentUses).toContain("industrial");
  });

  it("O · upgrade hereda el conjunto completo de parcelas", () => {
    const { state, building } = buildCompletedCementPlant();
    expect(
      dispatchProductCommand(
        state,
        command("upgrade", "UpgradeBuilding", { buildingId: building.id }),
      ),
    ).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.upgradeBuildingId === building.id,
    )!;
    expect(site.parcelIds).toEqual(building.parcelIds);
    finishSites(state);
    expect(building.upgraded).toBe(true);
    expect(building.parcelIds).toEqual(canonicalParcelIds(building.parcelIds));
  });

  it("P · la reparación hereda el conjunto completo de parcelas", () => {
    const { state, building } = buildCompletedCementPlant();
    building.condition = 50;
    expect(
      dispatchProductCommand(
        state,
        command("repair", "RepairBuilding", { buildingId: building.id }),
      ),
    ).toMatchObject({ accepted: true });
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.repairBuildingId === building.id,
    )!;
    expect(site.parcelIds).toEqual(building.parcelIds);
    finishSites(state);
    expect(building.condition).toBe(100);
    expect(building.parcelIds).toEqual(site.parcelIds);
  });

  it("Q · la ruina bloquea todas sus parcelas y ClearRuin las libera al terminar", () => {
    const { state, pair, building } = buildCompletedCementPlant();
    building.state = "ruin";
    for (const parcel of pair) {
      expect(
        dispatchProductCommand(
          state,
          command(`sell-ruin-${parcel.id}`, "SellParcel", { parcelId: parcel.id }),
        ),
      ).toEqual({ accepted: false, code: "SELL_NOT_AVAILABLE" });
    }
    expect(
      dispatchProductCommand(
        state,
        command("clear-ruin", "ClearRuin", { buildingId: building.id }),
      ),
    ).toMatchObject({ accepted: true });
    for (const parcel of pair) expect(parcel.currentUses).not.toContain("industrial");
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.kind === "clear_ruin",
    )!;
    expect(site.parcelIds).toEqual(building.parcelIds);
    finishSites(state);
    expect(state.phase2.buildings.has(building.id)).toBe(false);
    for (const parcel of pair) {
      expect(parcel.currentUses).not.toContain("industrial");
      expect(
        dispatchProductCommand(
          state,
          command(`sell-${parcel.id}`, "SellParcel", { parcelId: parcel.id }),
        ).accepted,
      ).toBe(true);
    }
  });

  it("R · no se vende ninguna parcela del proyecto mientras esté ocupada", () => {
    const state = freshState(31);
    const [first, second] = findConnectedParcels(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    build(state, [first!.id, second!.id], "cement_plant");
    for (const parcel of [first!, second!]) {
      expect(
        dispatchProductCommand(
          state,
          command(`sell-site-${parcel.id}`, "SellParcel", { parcelId: parcel.id }),
        ),
      ).toEqual({ accepted: false, code: "SELL_NOT_AVAILABLE" });
    }
    finishSites(state);
    for (const parcel of [first!, second!]) {
      expect(
        dispatchProductCommand(
          state,
          command(`sell-building-${parcel.id}`, "SellParcel", { parcelId: parcel.id }),
        ),
      ).toEqual({ accepted: false, code: "SELL_NOT_AVAILABLE" });
    }
  });

  it("un complejo reserva sus parcelas incluso para un proyecto de una sola parcela", () => {
    const built = buildCompletedCementPlant();
    for (const parcel of built.pair)
      expect(build(built.state, [parcel.id], "workshop", `small-${parcel.id}`)).toEqual({
        accepted: false,
        code: "PARCEL_OCCUPIED",
      });
    built.building.state = "ruin";
    for (const parcel of built.pair)
      expect(build(built.state, [parcel.id], "workshop", `ruin-small-${parcel.id}`)).toEqual({
        accepted: false,
        code: "PARCEL_OCCUPIED",
      });
  });

  it("S · guardar y cargar conserva parcelIds en obra, edificio y permiso", () => {
    const { state, pair } = buildCompletedCementPlant();
    const canonical = canonicalizeState(state);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(canonicalizeState(restored)).toBe(canonical);
    const ids = canonicalParcelIds(pair.map((parcel) => parcel.id));
    const building = playerBuilding(restored, "cement_plant");
    expect(building.parcelIds).toEqual(ids);
    const permits = Object.values(restored.phase2.permitting.permitsById);
    expect(
      permits.some((permit) => canonicalParcelIds(permit.parcelIds).join() === ids.join()),
    ).toBe(true);

    const active = freshState(37);
    const pair2 = findConnectedParcels(active, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(active, pair2);
    build(
      active,
      pair2.map((parcel) => parcel.id),
      "cement_plant",
    );
    const restoredActive = restoreStateFromSnapshot(serializeSnapshot(active));
    expect(canonicalizeState(restoredActive)).toBe(canonicalizeState(active));
    const site = [...restoredActive.phase2.constructionSites.values()][0]!;
    expect(site.parcelIds).toEqual(canonicalParcelIds(pair2.map((parcel) => parcel.id)));

    /** Una snapshot V2 anterior al contrato multi-parcela no se migra a ciegas: se rechaza. */
    const legacy = JSON.parse(JSON.stringify(serializeSnapshot(state))) as {
      phase2: { buildings: Array<Record<string, unknown>> };
    };
    for (const entry of legacy.phase2.buildings) {
      const ids = entry.parcelIds as string[];
      entry.parcelId = ids[0];
      delete entry.parcelIds;
    }
    expect(() => restoreStateFromSnapshot(legacy)).toThrow();
  });

  it("T · el orden de los ids no cambia el estado ni el digesto", () => {
    const first = freshState(41);
    const second = freshState(41);
    const pair = findConnectedParcels(first, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(first, pair);
    buy(second, pair);
    expect(build(first, [pair[0]!.id, pair[1]!.id], "cement_plant", "order-build")).toMatchObject({
      accepted: true,
    });
    expect(build(second, [pair[1]!.id, pair[0]!.id], "cement_plant", "order-build")).toMatchObject({
      accepted: true,
    });
    expect(canonicalizeState(second)).toBe(canonicalizeState(first));
  });

  it("índices · cualquier parcela del conjunto encuentra edificio y obra sin duplicados", () => {
    const state = freshState(31);
    const [first, second] = findConnectedParcels(state, BUILDING_DEFINITIONS.cement_plant, 2);
    buy(state, [first!, second!]);
    build(state, [first!.id, second!.id], "cement_plant");
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(activeSiteOnParcel(state, first!.id)?.id).toBe(site.id);
    expect(activeSiteOnParcel(state, second!.id)?.id).toBe(site.id);
    finishSites(state);
    const index = buildBuildingIndex(state);
    const building = playerBuilding(state, "cement_plant");
    for (const parcel of [first!, second!]) {
      const found = buildingsOnParcel(index, parcel.id);
      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe(building.id);
    }
  });
});

describe("V.d-7A · colateral prorrateado", () => {
  it("un edificio de 5200 en dos parcelas suma 5200, no 10400", () => {
    const building = {
      parcelIds: [parseParcelId("parcel_00000001"), parseParcelId("parcel_00000002")],
    };
    const contributions = building.parcelIds.map((id) =>
      buildingCollateralContribution(building, id, 5200),
    );
    expect(contributions).toEqual([2600, 2600]);
    expect(contributions.reduce((total, value) => total + value, 0)).toBe(5200);
    expect(contributions.reduce((total, value) => total + value, 0)).not.toBe(10400);
  });

  it("una acería en tres parcelas reparte el coste exacto y en orden canónico", () => {
    const cost = BUILDING_DEFINITIONS.steelworks.cost;
    const ids = [
      parseParcelId("parcel_00000003"),
      parseParcelId("parcel_00000001"),
      parseParcelId("parcel_00000002"),
    ];
    const contributions = ids.map((id) =>
      buildingCollateralContribution({ parcelIds: ids }, id, cost),
    );
    const ordered = [
      parseParcelId("parcel_00000001"),
      parseParcelId("parcel_00000002"),
      parseParcelId("parcel_00000003"),
    ];
    expect(
      ordered.map((id) => buildingCollateralContribution({ parcelIds: ids }, id, cost)),
    ).toEqual([1734, 1733, 1733]);
    expect(contributions.reduce((total, value) => total + value, 0)).toBe(cost);
  });

  it("RequestLoan usa la contribución prorrateada de la parcela y no duplica el edificio", () => {
    const { state, pair, building } = buildCompletedCementPlant();
    const parcel = pair[0]!;
    const buildingValue = collateralBuildingValue(
      building,
      BUILDING_DEFINITIONS.cement_plant.cost,
      "cost",
    );
    const contribution = buildingCollateralContribution(building, parcel.id, buildingValue);
    const limit = Math.floor(
      ((parcel.marketValue + contribution) * LOAN_POLICY.collateralLoanToValuePercent) / 100,
    );
    const amount = Math.max(
      LOAN_POLICY.minimumPrincipal,
      Math.min(LOAN_POLICY.maximumPrincipal, limit),
    );
    expect(
      dispatchProductCommand(
        state,
        command("loan-exact", "RequestLoan", {
          amount: parseMoney(amount),
          termMonths: 12,
          collateralParcelId: parcel.id,
        }),
      ),
    ).toMatchObject({ accepted: true });
    const inflated = Math.min(LOAN_POLICY.maximumPrincipal, limit + 100);
    expect(
      dispatchProductCommand(
        state,
        command("loan-inflated", "RequestLoan", {
          amount: parseMoney(inflated),
          termMonths: 12,
          collateralParcelId: pair[1]!.id,
        }),
      ),
    ).toEqual({ accepted: false, code: "LOAN_CAPACITY_EXCEEDED" });
  });
});

describe("V.d-7A · IA y automatización", () => {
  function rivalIndustrialTriple() {
    const state = createInitialState(47);
    const parcels = findParcelsFor(state, BUILDING_DEFINITIONS.steelworks, 3);
    for (const parcel of parcels) parcel.ownerOrganizationId = RIVAL_ORGANIZATION_ID;
    /** El rival arranca con parcelas en su distrito natal: el fixture aísla las tres del test. */
    for (const parcel of state.phase2.parcels.values())
      if (
        parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        !parcels.some((owned) => owned.id === parcel.id)
      )
        parcel.ownerOrganizationId = null;
    reshape(parcels[0]!, rectangle(0, 0, 4, 4), [{ x: 0, y: 0 }]);
    reshape(parcels[1]!, rectangle(4, 0, 4, 4));
    reshape(parcels[2]!, rectangle(8, 0, 4, 4));
    const seed = [...parcels].sort((left, right) => left.marketValue - right.marketValue)[0]!;
    seed.productionSuitability = { cement: 100, brick: 100, steel: 120 };
    const agent = [...state.agents.values()].find(
      (entry) => entry.organizationId === RIVAL_ORGANIZATION_ID,
    )!;
    agent.districtId = parcels[0]!.districtId;
    state.clock = { ...state.clock, tick: parseTick(50 * 24) };
    return { state, parcels };
  }

  it("el rival encuentra un site de tres parcelas para la acería", () => {
    const { state, parcels } = rivalIndustrialTriple();
    advanceProductSystems(state);
    expect(state.phase2.rivalAi.lastAction).toBe("build_production");
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(site.buildingType).toBe("steelworks");
    expect(site.parcelIds).toEqual(canonicalParcelIds(parcels.map((parcel) => parcel.id)));
  });

  it("sin la tercera parcela el rival elige un proyecto válido de dos parcelas", () => {
    const { state, parcels } = rivalIndustrialTriple();
    parcels[2]!.ownerOrganizationId = null;
    advanceProductSystems(state);
    expect(state.phase2.rivalAi.lastAction).toBe("build_production");
    const site = [...state.phase2.constructionSites.values()][0]!;
    expect(site.buildingType).not.toBe("steelworks");
    expect(site.parcelIds).toHaveLength(
      BUILDING_DEFINITIONS[site.buildingType].siteRequirements.requiredParcels,
    );
    for (const id of site.parcelIds) {
      expect(state.phase2.parcels.get(id)?.ownerOrganizationId).toBe(RIVAL_ORGANIZATION_ID);
    }
  });

  it("la automatización hereda el solar completo al abrir una reparación", () => {
    const { state, building } = buildCompletedCementPlant();
    building.condition = 40;
    state.phase2.automation.maintenanceRepairThreshold = 50;
    state.phase2.automation.financeCashFloor = parseMoney(2000);
    state.clock = { ...state.clock, tick: parseTick(GAME_DAY_TICKS * 10) };
    runAutomation(state);
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.repairBuildingId === building.id,
    )!;
    expect(site.parcelIds).toEqual(building.parcelIds);
    for (const id of site.parcelIds) expect(building.parcelIds).toContain(id);
  });
});
