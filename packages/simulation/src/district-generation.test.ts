import { describe, expect, it } from "vitest";

import {
  parseDistrictId,
  parseCommandId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parseSnapshotV2,
  parseTenantId,
  type ProductCommand,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { DISTRICT_FIXTURES, DISTRICT_FIXTURE_SEEDS } from "./district-fixtures";
import {
  DistrictGenerationError,
  cellKey,
  districtCanonicalString,
  generateDistrict,
  generateDistrictFromProfile,
  type GeneratedDistrict,
} from "./district-generator";
import {
  DEFAULT_DISTRICT_PROFILE_ID,
  DISTRICT_GENERATOR_VERSION,
  DISTRICT_PROFILE_IDS,
  resolveDistrictProfile,
  type DistrictProfile,
} from "./district-profiles";
import { GAME_DAY_TICKS, GAME_MONTH_TICKS } from "./game-data";
import { buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { developmentCodeById } from "./development-codes";
import { createPrng } from "./prng";
import { canonicalizeState, runScenario, type ScheduledCommand } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, districtMapOf, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

const actor = parsePersonId("person_00000001");
const playerOrganization = parseOrganizationId("org_00000001");
const SWEEP_SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: playerOrganization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function canonical(generated: GeneratedDistrict): string {
  return districtCanonicalString({
    profileId: generated.report.profileId,
    seed: generated.report.seed,
    district: generated.district,
    parcels: generated.parcels,
    blocks: generated.blocks,
    publicSpaces: generated.publicSpaces,
    buildings: generated.buildings,
    facilities: generated.facilities,
    blockedCells: generated.blockedCells,
    roads: generated.roads,
    spawnAnchors: generated.spawnAnchors,
  });
}

function advanceUntil(state: GameState, predicate: () => boolean, limit: number): void {
  for (let step = 0; step < limit && !predicate(); step += 1) advanceProductSystems(state);
}

function manhattan(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

describe("WP4.1 district generation", () => {
  it("reproduce exactamente el mismo distrito para la misma versión, perfil y seed", () => {
    for (const profileId of DISTRICT_PROFILE_IDS) {
      for (const seed of DISTRICT_FIXTURE_SEEDS) {
        const first = generateDistrict({ seed, profileId });
        const second = generateDistrict({ seed, profileId });
        expect(second.report, `${profileId} seed ${seed}`).toEqual(first.report);
        expect(second.parcels).toEqual(first.parcels);
        expect(second.blockedCells).toEqual(first.blockedCells);
        expect(canonical(second)).toBe(canonical(first));
      }
    }
  });

  it("mantiene determinista el estado inicial sin consumir el PRNG de la partida", () => {
    const first = createInitialState(9);
    const second = createInitialState(9);
    expect(canonicalizeState(second)).toBe(canonicalizeState(first));
    expect(first.prng).toEqual(createPrng(9).exportState());
    expect(first.world.city.districtIds).toHaveLength(9);
    expect(second.world.city.districtIds).toEqual(first.world.city.districtIds);
  });

  it("varía el distrito entre seeds conservando las anclas autoradas del perfil", () => {
    const profile = resolveDistrictProfile();
    const hashes = new Set<string>();
    const parcelCounts = new Set<number>();

    for (const seed of SWEEP_SEEDS) {
      const generated = generateDistrict({ seed });
      expect(generated.district.generation?.profileId).toBe(profile.id);
      expect(generated.district.generation?.generatorVersion).toBe(DISTRICT_GENERATOR_VERSION);
      expect(Number(generated.district.generation?.seed)).toBe(seed);
      hashes.add(generated.report.hash);
      parcelCounts.add(generated.report.parcelCount);

      // Las anclas del perfil se aplican a parcelas reales cercanas a sus celdas autoradas,
      // no a puntos sueltos: la identidad económica se conserva sin fijar la geometría.
      expect(generated.report.anchorParcelCount, `seed ${seed}`).toBe(profile.anchorSlots.length);
      for (const slot of profile.anchorSlots) {
        expect(
          generated.parcels.some((parcel) => Number(parcel.marketValue) === slot.price),
          `seed ${seed} ancla @${slot.price}`,
        ).toBe(true);
      }
    }

    expect(hashes.size).toBe(SWEEP_SEEDS.length);
    expect(parcelCounts.size).toBeGreaterThan(1);
  });

  it("produce distritos distintos por perfil aunque compartan seed", () => {
    const hashes = DISTRICT_PROFILE_IDS.map(
      (profileId) => generateDistrict({ seed: 1, profileId }).report.hash,
    );
    expect(new Set(hashes).size).toBe(DISTRICT_PROFILE_IDS.length);
  });

  it("respeta jugabilidad y topología en el barrido de perfiles y seeds", () => {
    for (const profileId of DISTRICT_PROFILE_IDS) {
      const profile = resolveDistrictProfile(profileId);
      for (const seed of SWEEP_SEEDS) {
        const generated = generateDistrict({ seed, profileId });
        const label = `${profileId} seed ${seed}`;
        expect(generated.report.issues, label).toEqual([]);
        expect(generated.report.attempts, label).toBeGreaterThan(0);

        const parcelCells = generated.parcels.flatMap((parcel) =>
          parcel.cells.map((cell) => cellKey(cell)),
        );
        const blockedCells = new Set(generated.blockedCells);
        expect(new Set(parcelCells).size, label).toBe(parcelCells.length);

        for (const parcel of generated.parcels) {
          expect(parcel.districtId, label).toBe(generated.district.id);
          if (parcel.disposition === "public") {
            expect(parcel.ownerOrganizationId, label).toBe(
              "org_00000004" as typeof parcel.ownerOrganizationId,
            );
          } else {
            expect(parcel.ownerOrganizationId, label).toBeNull();
          }
          expect(parcel.cells.length, label).toBeGreaterThan(0);
          expect(parcel.roadFrontages.length, label).toBeGreaterThan(0);
          for (const cell of parcel.cells) {
            expect(cell.x, label).toBeGreaterThanOrEqual(0);
            expect(cell.y, label).toBeGreaterThanOrEqual(0);
            expect(cell.x, label).toBeLessThan(profile.width);
            expect(cell.y, label).toBeLessThan(profile.height);
          }
        }

        expect(
          parcelCells.filter((key) => blockedCells.has(key)),
          label,
        ).toEqual([]);
      }
    }
  }, 600_000);

  it("conserva los hashes de las fixtures publicadas", () => {
    for (const fixture of DISTRICT_FIXTURES) {
      const generated = generateDistrict({
        seed: fixture.seed,
        profileId: fixture.profileId,
      });
      const {
        profileId,
        seed,
        hash,
        parcelCount,
        anchorParcelCount,
        blockedCellCount,
        roleCounts,
      } = generated.report;
      expect(
        { profileId, seed, hash, parcelCount, anchorParcelCount, blockedCellCount, roleCounts },
        `${fixture.profileId} seed ${fixture.seed}`,
      ).toEqual(fixture);
    }
  });

  it("completa comprar, construir, ocupar y cobrar renta sobre un distrito generado", () => {
    const state = createInitialState(1337);
    // El roster inicial vive en el distrito del jugador: construir allí no exige traslado (D-088).
    const crew = [...state.phase2.crews.values()].find(
      (entry) => entry.organizationId === playerOrganization,
    )!;
    const homeAgent = state.agents.get(crew.supervisorAgentId)!;
    const homeDistrictId = homeAgent.districtId;
    expect(districtMapOf(state, homeDistrictId).blockedCells.size).toBeGreaterThan(0);
    expect(state.phase2.parcels.size).toBeGreaterThan(20);

    const spawn = state.agents.get(crew.supervisorAgentId)!.cell;
    const target = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.districtId === homeDistrictId &&
          developmentCodeById(parcel.developmentCodeId).allowedUses.includes("residential"),
      )
      .sort(
        (left, right) =>
          manhattan(left.anchorCell, spawn) - manhattan(right.anchorCell, spawn) ||
          left.id.localeCompare(right.id),
      )[0]!;

    const balanceBeforePurchase = state.phase2.balances.get(playerOrganization)!;
    expect(
      dispatchProductCommand(state, command("buy-1", "BuyParcel", { parcelId: target.id }))
        .accepted,
    ).toBe(true);
    expect(state.phase2.parcels.get(target.id)?.ownerOrganizationId).toBe(playerOrganization);
    expect(state.phase2.balances.get(playerOrganization)!).toBeLessThan(balanceBeforePurchase);

    expect(
      dispatchProductCommand(
        state,
        command("build-1", "StartConstruction", {
          parcelIds: [target.id],
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);

    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.parcelIds[0]! === target.id,
    )!;
    expect(
      dispatchProductCommand(
        state,
        command("crew-1", "AssignCrewToWorkOrder", { crewId: crew.id, workOrderId: site.id }),
      ).accepted,
    ).toBe(true);

    advanceUntil(
      state,
      () => buildingsOnParcel(buildBuildingIndex(state), target.id).length > 0,
      GAME_DAY_TICKS * 12,
    );
    const buildingId = buildingsOnParcel(buildBuildingIndex(state), target.id)[0]?.id;
    expect(buildingId, `obra sin terminar en el tick ${state.clock.tick}`).not.toBeUndefined();

    const tenantId = parseTenantId("tenant_00000001");
    expect(
      dispatchProductCommand(
        state,
        command("tenant-1", "AssignTenant", { buildingId: buildingId!, tenantId }),
      ).accepted,
    ).toBe(true);
    expect(state.phase2.buildings.get(buildingId!)?.tenantId).toBe(tenantId);

    const balanceBeforeRent = state.phase2.balances.get(playerOrganization)!;
    advanceUntil(
      state,
      () => state.phase2.balances.get(playerOrganization)! > balanceBeforeRent,
      GAME_MONTH_TICKS,
    );
    expect(state.phase2.balances.get(playerOrganization)!).toBeGreaterThan(balanceBeforeRent);
    expect(state.phase2.transactions.length).toBeGreaterThan(3);
  });

  it("repite los escenarios cuando se fija el perfil de distrito", () => {
    const commands: ScheduledCommand[] = [
      {
        atTick: 0,
        command: command("buy-1", "BuyParcel", {
          parcelId: parseParcelId("parcel_00000001"),
        }),
      },
      {
        atTick: 3,
        command: command("buy-2", "BuyParcel", {
          parcelId: parseParcelId("parcel_00000002"),
        }),
      },
    ];
    const options = {};
    const first = runScenario(5, commands, 240, options);
    const second = runScenario(5, commands, 240, options);

    expect(first.results.map((entry) => entry.result.accepted)).toEqual([true, true]);
    expect(second.results.map((entry) => entry.result.accepted)).toEqual([true, true]);
    expect(first.checkpoints.at(-1)?.canonicalState).toBe(
      second.checkpoints.at(-1)?.canonicalState,
    );

    const otherSeed = runScenario(6, commands, 240, options);
    expect(first.checkpoints.at(-1)?.canonicalState).not.toBe(
      otherSeed.checkpoints.at(-1)?.canonicalState,
    );
  }, 300_000);

  it("persiste la identidad de generación de la ciudad y las celdas bloqueadas por distrito", () => {
    const state = createInitialState(1337);
    const snapshot = serializeSnapshot(state);

    expect(snapshot.world.city.generation.profileId).toBe("ciudad_del_umbral_v1");
    expect(snapshot.world.city.generation.generatorVersion).toBe(DISTRICT_GENERATOR_VERSION);
    expect(Number(snapshot.world.city.generation.seed)).toBe(1337);
    expect(snapshot.world.districts).toHaveLength(9);
    expect(snapshot.world.gateways).toHaveLength(12);
    for (const entry of snapshot.world.districts) {
      const live = districtMapOf(state, parseDistrictId(entry.district.id));
      expect(entry.map.blockedCells).toHaveLength(live.blockedCells.size);
      expect(typeof entry.district.generation?.profileId).toBe("string");
    }

    const parsed = parseSnapshotV2(JSON.parse(JSON.stringify(snapshot)));
    const restored = restoreStateFromSnapshot(parsed);
    for (const districtId of state.world.city.districtIds) {
      expect([...districtMapOf(restored, districtId).blockedCells].sort()).toEqual(
        [...districtMapOf(state, districtId).blockedCells].sort(),
      );
    }
    /** El estado canónico ordena maps y claves: dos estados equivalentes deben coincidir en cadena. */
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));
    expect(serializeSnapshot(restored)).toEqual(snapshot);
  });

  it("rechaza un guardado v1 con un mensaje comprensible, sin migrarlo ni borrarlo", () => {
    const state = createInitialState(4);
    const snapshot = serializeSnapshot(state);
    const legacy = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.world;

    expect(() => restoreStateFromSnapshot(legacy)).toThrowError(/UNSUPPORTED_SNAPSHOT_VERSION/);
    // Rechazar no es destruir: el estado en memoria sigue intacto.
    expect(state.world.districts.size).toBe(9);
  });

  it("falla de forma explícita cuando un perfil no produce un distrito jugable", () => {
    const base = resolveDistrictProfile(DEFAULT_DISTRICT_PROFILE_ID);
    const impossible: DistrictProfile = {
      ...base,
      playability: { ...base.playability, minimumParcels: 5_000 },
    };

    expect(() => generateDistrictFromProfile(impossible, 1)).toThrowError(DistrictGenerationError);
    let thrown: unknown;
    try {
      generateDistrictFromProfile(impossible, 1);
    } catch (error) {
      thrown = error;
    }
    const failure = thrown as DistrictGenerationError;
    expect(failure.profileId).toBe(base.id);
    expect(failure.seed).toBe(1);
    expect(failure.issues.map((issue) => issue.code)).toContain("INSUFFICIENT_PARCELS");
  });

  it("rechaza perfiles de distrito desconocidos", () => {
    expect(() => resolveDistrictProfile("distrito_inexistente")).toThrowError(RangeError);
    expect(() => resolveDistrictProfile("distrito_inexistente")).toThrow(
      DISTRICT_PROFILE_IDS.join(", "),
    );
    expect(() => generateDistrict({ seed: 1, profileId: "distrito_inexistente" })).toThrowError(
      RangeError,
    );
  });
});
