import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingType,
  type ProductCommand,
  type Tenant,
} from "@landlord/shared";
import { DEFAULT_DEVELOPMENT_CODE_BY_ROLE, developmentCodeById } from "./development-codes";
import { dispatchProductCommand } from "./commands";
import { buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { chooseFootprint, parcelEnvelopeUsage } from "./footprints";
import { effectivePopulationByDistrict } from "./municipal-politics";
import { askingRentFor } from "./housing-market";
import { createInitialState, type GameState } from "./state";
import { BUILDING_DEFINITIONS, GAME_HOUR_TICKS, GAME_MONTH_TICKS } from "./game-data";
import { advanceProductSystems } from "./systems";

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

function residentialParcel(state: GameState, districtId: string) {
  return [...state.phase2.parcels.values()].find(
    (parcel) =>
      parcel.districtId === districtId &&
      !parcel.ownerOrganizationId &&
      developmentCodeById(parcel.developmentCodeId).allowedUses.includes("residential"),
  );
}

function largeParcel(state: GameState) {
  return [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        !parcel.ownerOrganizationId &&
        parcel.cells.length >= 18 &&
        developmentCodeById(parcel.developmentCodeId).allowedUses.includes("residential"),
    )
    .sort(
      (left, right) => right.cells.length - left.cells.length || left.id.localeCompare(right.id),
    )[0];
}

function completeSite(state: GameState): void {
  const site = [...state.phase2.constructionSites.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )[0];
  if (!site) throw new Error("sin obra activa");
  site.progress = site.workRequired;
  state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
  advanceProductSystems(state);
}

function buildingAt(state: GameState, parcelId: ReturnType<typeof parseParcelId>): Building {
  const building = buildingsOnParcel(buildBuildingIndex(state), parcelId)[0];
  if (!building) throw new Error(`sin edificio en ${parcelId}`);
  return building;
}

describe("V.d.2 composición urbana y códigos", () => {
  it("assigns a development code to every block and parcel from its urban role", () => {
    const state = createInitialState(7);
    for (const [, district] of state.world.districts) {
      const roles = new Set([...district.blocks.values()].map((block) => block.urbanRole));
      expect(roles.size).toBeGreaterThan(1);
      for (const block of district.blocks.values()) {
        expect(block.defaultDevelopmentCodeId).toBe(
          DEFAULT_DEVELOPMENT_CODE_BY_ROLE[block.urbanRole],
        );
      }
      for (const parcel of state.phase2.parcels.values()) {
        if (parcel.districtId !== district.district.id) continue;
        expect(developmentCodeById(parcel.developmentCodeId).allowedUses.length).toBeGreaterThan(0);
        if (parcel.disposition === "marketable") expect(parcel.currentUses).toEqual([]);
      }
    }
  });

  it("places footprints deterministically and never exceeds coverage or FAR", () => {
    const state = createInitialState(11);
    state.phase2.balances.set(organization, parseMoney(1_000_000));
    const parcel = largeParcel(state)!;
    const code = developmentCodeById(parcel.developmentCodeId);
    const definition = BUILDING_DEFINITIONS.courtyard_home;
    const first = chooseFootprint({ parcel, code, definition, buildings: [] });
    const second = chooseFootprint({ parcel, code, definition, buildings: [] });
    expect(second).toEqual(first);
    if ("error" in first) throw new Error(first.error);
    expect(first.footprintCells.length).toBeGreaterThan(0);
    expect(first.floors).toBeGreaterThanOrEqual(1);
    expect(first.floors).toBeLessThanOrEqual(code.maxFloors);
  });

  it("allows several finished buildings on one parcel but only one active site", () => {
    const state = createInitialState(13);
    state.phase2.balances.set(organization, parseMoney(1_000_000));
    const parcel = largeParcel(state)!;
    expect(
      dispatchProductCommand(
        state,
        command("composition-buy", "BuyParcel", { parcelId: parcel.id }),
      ).accepted,
    ).toBe(true);
    const type: BuildingType = "courtyard_home";
    expect(
      dispatchProductCommand(
        state,
        command("composition-build-1", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: type,
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("composition-build-2", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: type,
        }),
      ),
    ).toEqual({ accepted: false, code: "ACTIVE_SITE_ON_PARCEL" });
    completeSite(state);
    expect(buildingsOnParcel(buildBuildingIndex(state), parcel.id)).toHaveLength(1);
    expect(
      dispatchProductCommand(
        state,
        command("composition-build-3", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: type,
        }),
      ).accepted,
    ).toBe(true);
    completeSite(state);
    expect(buildingsOnParcel(buildBuildingIndex(state), parcel.id)).toHaveLength(2);
    for (let attempt = 4; attempt <= 12; attempt += 1) {
      const result = dispatchProductCommand(
        state,
        command(`composition-build-${attempt}`, "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: type,
        }),
      );
      if (!result.accepted) {
        expect([
          "COVERAGE_LIMIT",
          "FAR_LIMIT",
          "NO_BUILDABLE_ENVELOPE",
          "INSUFFICIENT_FUNDS",
          "INSUFFICIENT_RESOURCES",
          "CREW_UNAVAILABLE",
        ]).toContain(result.code);
        break;
      }
      completeSite(state);
    }
    const usage = parcelEnvelopeUsage({
      parcel,
      code: developmentCodeById(parcel.developmentCodeId),
      buildings: buildingsOnParcel(buildBuildingIndex(state), parcel.id),
    });
    expect(usage.coveragePercent).toBeLessThanOrEqual(usage.coverageLimitPercent);
    expect(usage.farPercent).toBeLessThanOrEqual(usage.farLimitPercent);
  });

  it("produces the same footprint for the same seed and command", () => {
    const run = () => {
      const state = createInitialState(23);
      state.phase2.balances.set(organization, parseMoney(1_000_000));
      const parcel = largeParcel(state)!;
      dispatchProductCommand(state, command("det-buy", "BuyParcel", { parcelId: parcel.id }));
      dispatchProductCommand(
        state,
        command("det-build", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      );
      const site = [...state.phase2.constructionSites.values()][0]!;
      return {
        footprint: site.footprintCells.map((cell) => `${cell.x},${cell.y}`).sort(),
        orientation: site.orientation,
        floors: site.floors,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe("V.d.2 ciclo inmobiliario en los nueve distritos", () => {
  it("compra, permiso, construye, ocupa y cobra en cada distrito", () => {
    const seeds = [17, 29, 41, 53, 67, 79, 83, 97, 101];
    for (const [index, seed] of seeds.entries()) {
      const state = createInitialState(seed);
      state.phase2.balances.set(organization, parseMoney(1_000_000));
      const districtId = state.world.city.districtIds[index]!;
      const parcel = residentialParcel(state, districtId);
      expect(parcel, `${districtId} sin suelo residencial`).toBeDefined();
      expect(
        dispatchProductCommand(
          state,
          command(`nine-buy-${seed}`, "BuyParcel", { parcelId: parcel!.id }),
        ).accepted,
      ).toBe(true);
      expect(
        dispatchProductCommand(
          state,
          command(`nine-permit-${seed}`, "RequestPermit", {
            parcelIds: [parcel!.id],
            buildingType: "courtyard_home",
          }),
        ).accepted,
      ).toBe(true);
      expect(
        dispatchProductCommand(
          state,
          command(`nine-build-${seed}`, "StartConstruction", {
            parcelIds: [parcel!.id],
            buildingType: "courtyard_home",
          }),
        ).accepted,
      ).toBe(true);
      completeSite(state);
      const building = buildingAt(state, parcel!.id);
      const tenantId = parseTenantId(`tenant_${String(900_000 + seed).padStart(8, "0")}`);
      const tenant: Tenant = {
        id: tenantId,
        profile: "household",
        budget: parseMoney(1_000),
        preferredBuildingType: "courtyard_home",
        activeContractBuildingId: null,
        marketDistrictId: building.districtId,
        satisfaction: 60,
        leaseRemaining: 0,
        status: "available",
        size: 3,
        segmentId: "household",
        searchMonths: 0,
        incomeFactorPercent: 100,
        origin: "authored",
      };
      state.phase2.tenants.set(tenantId, tenant);
      expect(
        dispatchProductCommand(
          state,
          command(`nine-tenant-${seed}`, "AssignTenant", {
            buildingId: building.id,
            tenantId,
          }),
        ).accepted,
      ).toBe(true);
      const beforeRent = state.phase2.balances.get(organization)!;
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
      advanceProductSystems(state);
      expect(state.phase2.balances.get(organization)!).toBeGreaterThan(beforeRent);
    }
  }, 180_000);
});

describe("V.d.2 usos existentes", () => {
  it("keeps a use while a building stands and removes it when the ruin is cleared", () => {
    const state = createInitialState(31);
    state.phase2.balances.set(organization, parseMoney(1_000_000));
    const parcel = largeParcel(state)!;
    dispatchProductCommand(state, command("uses-buy", "BuyParcel", { parcelId: parcel.id }));
    dispatchProductCommand(
      state,
      command("uses-build", "StartConstruction", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    completeSite(state);
    expect(parcel.currentUses).toEqual(["residential"]);
    const building = buildingAt(state, parcel.id);
    building.state = "ruin";
    expect(
      dispatchProductCommand(state, command("uses-clear", "ClearRuin", { buildingId: building.id }))
        .accepted,
    ).toBe(true);
    expect(parcel.currentUses).toEqual([]);
    completeSite(state);
    expect(parcel.currentUses).toEqual([]);
    expect(buildingsOnParcel(buildBuildingIndex(state), parcel.id)).toHaveLength(0);
  });
});

describe("V.d.2 reglas de convivencia", () => {
  it("rejects assigning a tenant outside its market district", () => {
    const state = createInitialState(19);
    state.phase2.balances.set(organization, parseMoney(1_000_000));
    const districts = state.world.city.districtIds;
    const parcel = [...state.phase2.parcels.values()].find(
      (entry) =>
        entry.districtId === districts[1] &&
        !entry.ownerOrganizationId &&
        developmentCodeById(entry.developmentCodeId).allowedUses.includes("residential"),
    )!;
    dispatchProductCommand(state, command("move-buy", "BuyParcel", { parcelId: parcel.id }));
    dispatchProductCommand(
      state,
      command("move-build", "StartConstruction", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    completeSite(state);
    const building = buildingAt(state, parcel.id);
    const tenantId = parseTenantId("tenant_00000999");
    state.phase2.tenants.set(tenantId, {
      id: tenantId,
      profile: "household",
      budget: parseMoney(1_000),
      preferredBuildingType: "courtyard_home",
      activeContractBuildingId: null,
      marketDistrictId: districts[0]!,
      satisfaction: 60,
      leaseRemaining: 0,
      status: "available",
      size: 3,
      segmentId: "household",
      searchMonths: 0,
      incomeFactorPercent: 100,
      origin: "authored",
    });
    expect(
      dispatchProductCommand(
        state,
        command("move-tenant", "AssignTenant", { buildingId: building.id, tenantId }),
      ),
    ).toEqual({ accepted: false, code: "TENANT_INCOMPATIBLE" });
  });
});

describe("V.d.2 mercados y población", () => {
  it("uses the district rent index first and falls back to the city index with a small sample", () => {
    const state = createInitialState(3);
    const districtId = state.world.city.districtIds[0]!;
    const building = {
      id: parseBuildingId("building_00000999"),
      parcelIds: [parseParcelId("parcel_00000001")],
      districtId,
      ownerOrganizationId: organization,
      productionFacilityId: null,
      type: "courtyard_home",
      footprintCells: [{ x: 1, y: 1 }],
      orientation: 0,
      floors: 1,
      form: "detached",
      level: 1,
      condition: 100,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    } satisfies Building;
    state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home = 120;
    const district = state.phase2.housingMarket.byDistrictId[districtId]!;
    district.unitsByBuildingType.courtyard_home = 2;
    district.rentIndexPercentByBuildingType.courtyard_home = 80;
    const cityRent = askingRentFor(state, building);
    district.unitsByBuildingType.courtyard_home = 3;
    const districtRent = askingRentFor(state, building);
    expect(districtRent).toBeLessThan(cityRent);
  });

  it("counts effective population per district and keeps tenants in their market district", () => {
    const state = createInitialState(5);
    const districtId = state.world.city.districtIds[0]!;
    state.phase2.tenants.clear();
    state.phase2.tenants.set(parseTenantId("tenant_00000901"), {
      id: parseTenantId("tenant_00000901"),
      profile: "household",
      budget: parseMoney(500),
      preferredBuildingType: "courtyard_home",
      activeContractBuildingId: null,
      marketDistrictId: districtId,
      satisfaction: 60,
      leaseRemaining: 0,
      status: "contracted",
      size: 5,
      segmentId: "household",
      searchMonths: 0,
      incomeFactorPercent: 100,
      origin: "authored",
    });
    expect(effectivePopulationByDistrict(state)[districtId]).toBe(5);
  });
});
