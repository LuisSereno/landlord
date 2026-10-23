import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parseSnapshotV1,
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
  rosterLayout,
  type DistrictProfile,
} from "./district-profiles";
import { GAME_DAY_TICKS, GAME_MONTH_TICKS } from "./game-data";
import { createPrng } from "./prng";
import { canonicalizeState, runScenario, type ScheduledCommand } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
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
    blockedCells: generated.blockedCells,
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
    const first = createInitialState(9, { districtProfileId: "vega_del_cauce" });
    const second = createInitialState(9, { districtProfileId: "vega_del_cauce" });
    expect(canonicalizeState(second)).toBe(canonicalizeState(first));
    expect(first.prng).toEqual(createPrng(9).exportState());
    expect(canonicalizeState(createInitialState(3))).toBe(
      canonicalizeState(createInitialState(3, { districtProfileId: DEFAULT_DISTRICT_PROFILE_ID })),
    );
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

      const anchors = generated.parcels.slice(0, profile.anchorSlots.length);
      expect(
        anchors.map((parcel) => ({
          id: parcel.id,
          cell: parcel.cell,
          zoning: parcel.zoning,
          price: Number(parcel.price),
          suitability: parcel.productionSuitability,
        })),
        `seed ${seed}`,
      ).toEqual(
        profile.anchorSlots.map((slot, index) => ({
          id: parseParcelId(`parcel_${String(index + 1).padStart(8, "0")}`),
          cell: slot.cell,
          zoning: slot.zoning,
          price: slot.price,
          suitability: profile.suitability[slot.zoning],
        })),
      );
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

        const parcelCells = new Set(generated.parcels.map((parcel) => cellKey(parcel.cell)));
        const blockedCells = new Set(generated.blockedCells);
        expect(parcelCells.size, label).toBe(generated.parcels.length);

        for (const parcel of generated.parcels) {
          expect(parcel.districtId, label).toBe(generated.district.id);
          expect(parcel.ownerOrganizationId, label).toBeNull();
          expect(parcel.buildingId, label).toBeNull();
          expect(parcel.cell.x, label).toBeGreaterThanOrEqual(0);
          expect(parcel.cell.y, label).toBeGreaterThanOrEqual(0);
          expect(parcel.cell.x, label).toBeLessThan(profile.width);
          expect(parcel.cell.y, label).toBeLessThan(profile.height);
        }

        for (const anchor of [generated.spawnAnchors.player, generated.spawnAnchors.rival]) {
          const reserved = [
            cellKey(anchor),
            ...rosterLayout(anchor).map((slot) => cellKey(slot.cell)),
          ];
          expect(
            reserved.filter((key) => parcelCells.has(key) || blockedCells.has(key)),
            label,
          ).toEqual([]);
        }
        expect(
          [...parcelCells].filter((key) => blockedCells.has(key)),
          label,
        ).toEqual([]);
      }
    }
  });

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
        zoningCounts,
      } = generated.report;
      expect(
        { profileId, seed, hash, parcelCount, anchorParcelCount, blockedCellCount, zoningCounts },
        `${fixture.profileId} seed ${fixture.seed}`,
      ).toEqual(fixture);
    }
  });

  it("completa comprar, construir, ocupar y cobrar renta sobre un distrito generado", () => {
    const profile = resolveDistrictProfile("vega_del_cauce");
    const state = createInitialState(1337, { districtProfileId: profile.id });
    expect(state.map.blockedCells.size).toBeGreaterThan(0);
    expect(state.phase2.parcels.size).toBeGreaterThan(profile.anchorSlots.length);

    const spawn = profile.spawnAnchors.player;
    const target = [...state.phase2.parcels.values()]
      .slice(profile.anchorSlots.length)
      .filter((parcel) => parcel.zoning === "residential")
      .sort(
        (left, right) =>
          manhattan(left.cell, spawn) - manhattan(right.cell, spawn) ||
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
          parcelId: target.id,
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);

    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.parcelId === target.id,
    )!;
    const crew = [...state.phase2.crews.values()].find(
      (entry) => entry.organizationId === playerOrganization,
    )!;
    expect(
      dispatchProductCommand(
        state,
        command("crew-1", "AssignCrewToWorkOrder", { crewId: crew.id, workOrderId: site.id }),
      ).accepted,
    ).toBe(true);

    advanceUntil(
      state,
      () => (state.phase2.parcels.get(target.id)?.buildingId ?? null) !== null,
      GAME_DAY_TICKS * 12,
    );
    const buildingId = state.phase2.parcels.get(target.id)?.buildingId;
    expect(buildingId, `obra sin terminar en el tick ${state.clock.tick}`).not.toBeNull();

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
    const options = { districtProfileId: "ensanche_ferroviario" };
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
  });

  it("persiste la identidad de generación y las celdas bloqueadas en la partida guardada", () => {
    const state = createInitialState(1337, { districtProfileId: "vega_del_cauce" });
    const snapshot = serializeSnapshot(state);
    const persisted = snapshot.phase2!.district;

    expect(persisted.generation?.profileId).toBe("vega_del_cauce");
    expect(persisted.generation?.generatorVersion).toBe(DISTRICT_GENERATOR_VERSION);
    expect(Number(persisted.generation?.seed)).toBe(1337);
    expect(snapshot.map.blockedCells).toHaveLength(state.map.blockedCells.size);

    const parsed = parseSnapshotV1(JSON.parse(JSON.stringify(snapshot)));
    const restored = restoreStateFromSnapshot(parsed);
    expect([...restored.map.blockedCells].sort()).toEqual([...state.map.blockedCells].sort());
    expect(restored.phase2.district.generation?.profileId).toBe("vega_del_cauce");
    // Comparación estructural: `canonicalizeState` serializa con JSON.stringify y el orden de
    // claves de un estado restaurado difiere del original sin que cambie ningún valor.
    expect(JSON.parse(canonicalizeState(restored))).toEqual(JSON.parse(canonicalizeState(state)));
    expect(serializeSnapshot(restored)).toEqual(snapshot);
  });

  it("sigue cargando partidas guardadas anteriores a la generación procedural", () => {
    const fresh = createInitialState(4);
    const snapshot = serializeSnapshot(fresh);
    const legacy: typeof snapshot = JSON.parse(JSON.stringify(snapshot));
    delete legacy.phase2!.district.generation;

    const restored = restoreStateFromSnapshot(legacy);
    expect(restored.phase2.district.generation).toBeUndefined();
    expect(restored.phase2.parcels.size).toBe(fresh.phase2.parcels.size);
    expect([...restored.phase2.parcels.values()]).toEqual([...fresh.phase2.parcels.values()]);
    expect([...restored.map.blockedCells].sort()).toEqual([...fresh.map.blockedCells].sort());
    expect([...restored.phase2.crews.values()]).toEqual([...fresh.phase2.crews.values()]);
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
