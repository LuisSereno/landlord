import { describe, expect, it } from "vitest";
import {
  parseCommandId,
  parsePersonId,
  parseTick,
  type Parcel,
  type ProductCommand,
} from "@landlord/shared";

import { dispatchProductCommand } from "./commands";
import { developmentCodeForRole, effectiveDevelopmentCode } from "./development-codes";
import { BUILDING_DEFINITIONS, createMunicipalPolicy, PLAYER_ORGANIZATION_ID } from "./game-data";
import { chooseFootprint } from "./footprints";
import { createInitialState, type GameState } from "./state";

const actor = parsePersonId("person_00000001");

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function commercialParcel(state: GameState, offset = 0): Parcel {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .filter((parcel) => {
      const block = state.world.districts.get(parcel.districtId)?.blocks.get(parcel.blockId);
      return (
        block?.urbanRole === "commercial_corridor" &&
        parcel.developmentCodeId === developmentCodeForRole("commercial_corridor").id
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const parcel = parcels[offset];
  if (!parcel) throw new Error("No commercial parcel");
  return parcel;
}

function prepare(state: GameState, parcel: Parcel): void {
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, 100_000 as never);
  const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  inventory.cement = 100;
  inventory.brick = 100;
  inventory.steel = 100;
  state.phase2.permitting.approvalChanceByRole = {
    ...state.phase2.permitting.approvalChanceByRole,
    commercial_corridor: 100,
  };
}

function activateTrial(state: GameState): void {
  state.phase2.ordinance = {
    ...createMunicipalPolicy("policy_00000005")!,
    status: "active",
    activeFromTick: parseTick(0),
    expiresAtTick: parseTick(36_000),
  };
}

describe("V.d.4 densidad de corredor", () => {
  it("el permiso emitido durante el ensayo conserva +1 planta y +100 FAR", () => {
    const state = createInitialState(7);
    const parcel = commercialParcel(state);
    prepare(state, parcel);
    activateTrial(state);
    const result = dispatchProductCommand(
      state,
      command("density-permit", "RequestPermit", {
        parcelId: parcel.id,
        buildingType: "apartment_block",
      }),
    );
    expect(result.accepted).toBe(true);
    const permit = state.phase2.permitting.permitsByParcelId[parcel.id]!;
    expect(permit.densityBonusFloors).toBe(1);
    expect(permit.densityBonusFarPercent).toBe(100);
  });

  it("construir con un permiso adquirido sigue permitido tras expirar el ensayo", () => {
    const state = createInitialState(7);
    const parcel = commercialParcel(state);
    prepare(state, parcel);
    activateTrial(state);
    expect(
      dispatchProductCommand(
        state,
        command("density-permit-2", "RequestPermit", {
          parcelId: parcel.id,
          buildingType: "apartment_block",
        }),
      ).accepted,
    ).toBe(true);
    state.phase2.ordinance = {
      ...state.phase2.ordinance,
      status: "expired",
      expiresAtTick: parseTick(0),
    };
    const result = dispatchProductCommand(
      state,
      command("density-build", "StartConstruction", {
        parcelId: parcel.id,
        buildingType: "apartment_block",
      }),
    );
    expect(result.accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.parcelId === parcel.id,
    )!;
    expect(site.floors).toBe(5);
  });

  it("un permiso nuevo tras expirar ya no recibe el bonus", () => {
    const state = createInitialState(7);
    const first = commercialParcel(state);
    const second = commercialParcel(state, 1);
    prepare(state, first);
    prepare(state, second);
    activateTrial(state);
    dispatchProductCommand(
      state,
      command("density-permit-3", "RequestPermit", {
        parcelId: first.id,
        buildingType: "apartment_block",
      }),
    );
    state.phase2.ordinance = {
      ...state.phase2.ordinance,
      status: "expired",
      expiresAtTick: parseTick(0),
    };
    expect(
      dispatchProductCommand(
        state,
        command("density-permit-4", "RequestPermit", {
          parcelId: second.id,
          buildingType: "apartment_block",
        }),
      ).accepted,
    ).toBe(true);
    const permit = state.phase2.permitting.permitsByParcelId[second.id]!;
    expect(permit.densityBonusFloors).toBe(0);
    expect(permit.densityBonusFarPercent).toBe(0);
  });

  it("el código efectivo suma el bonus sobre el código de la parcela", () => {
    const code = developmentCodeForRole("commercial_corridor");
    const effective = effectiveDevelopmentCode(code.id, 1, 100);
    expect(effective.maxFloors).toBe(code.maxFloors + 1);
    expect(effective.maxFloorAreaRatioPercent).toBe(code.maxFloorAreaRatioPercent + 100);
    expect(developmentCodeForRole("commercial_corridor").maxFloors).toBe(code.maxFloors);
  });
});

describe("V.d.4 autocolocación", () => {
  it("prefiere el frente principal cuando el área y las plantas empatan", () => {
    const parcel = {
      cells: Array.from({ length: 100 }, (_, index) => ({
        x: index % 10,
        y: Math.floor(index / 10),
      })),
      roadFrontages: [
        {
          roadSegmentId: "road_north",
          cells: Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })),
        },
      ],
    };
    const north = chooseFootprint({
      parcel,
      code: developmentCodeForRole("urban_residential"),
      definition: BUILDING_DEFINITIONS.apartment_block!,
      principalFrontageCells: Array.from({ length: 10 }, (_, x) => ({ x, y: -1 })),
      buildings: [],
    });
    expect("error" in north).toBe(false);
    if ("error" in north) return;
    expect(Math.min(...north.footprintCells.map((cell) => cell.y))).toBe(0);
  });
});
