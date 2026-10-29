import { describe, expect, it } from "vitest";
import { parseTick, type Parcel } from "@landlord/shared";

import { GAME_MONTH_TICKS } from "./game-data";
import { buildLandValueContext, landValueBreakdownFor, updateLandValues } from "./land-value";
import { createInitialState, type GameState } from "./state";

function marketable(state: GameState, districtId: string): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
}

function districtIdByName(state: GameState, name: string): string {
  const entry = [...state.world.districts.values()].find(
    (district) => district.district.name === name,
  );
  if (!entry) throw new Error(`Unknown district ${name}`);
  return entry.district.id as string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe("V.d.4 valor del suelo", () => {
  it("reproduce el desglose y lo suma exactamente", () => {
    const state = createInitialState(7);
    const context = buildLandValueContext(
      state,
      districtIdByName(state, "Centro Cívico") as Parcel["districtId"],
    );
    for (const parcel of marketable(state, districtIdByName(state, "Centro Cívico"))) {
      const first = landValueBreakdownFor(parcel, context);
      const second = landValueBreakdownFor(parcel, context);
      expect(second).toEqual(first);
      const sum =
        first.roadCentrality +
        first.commercialAccess +
        first.civicAmenities +
        first.frontage +
        first.codePotential +
        first.services +
        first.industrialExternality +
        first.isolation +
        first.seedVariation;
      expect(first.rawScore, parcel.id).toBe(sum);
      expect(first.rawScore + first.clampAdjustment, parcel.id).toBe(first.score);
      expect(first.targetValue, parcel.id).toBe(
        Math.floor((parcel.baseLandValue * (100 + first.score)) / 100),
      );
    }
  });

  it("distingue bandas de centro, residencial e industria", () => {
    const state = createInitialState(7);
    const values = (name: string): number[] => {
      const districtId = districtIdByName(state, name);
      const context = buildLandValueContext(state, districtId as Parcel["districtId"]);
      return marketable(state, districtId).map(
        (parcel) => landValueBreakdownFor(parcel, context).targetValue,
      );
    };
    const center = median(values("Centro Cívico"));
    const residential = median(values("Barrio del Umbral"));
    const industrial = Math.min(
      median(values("Ensanche Ferroviario Oeste")),
      median(values("Patios del Este")),
    );
    expect(center).toBeGreaterThan(residential);
    expect(residential).toBeGreaterThan(industrial);
  });

  it("mueve el valor en la dirección esperada al recortar servicios", () => {
    const state = createInitialState(7);
    const districtId = districtIdByName(state, "Centro Cívico") as Parcel["districtId"];
    const parcels = marketable(state, districtId);
    const context = buildLandValueContext(state, districtId);
    const parcel = parcels
      .map((candidate) => ({
        candidate,
        breakdown: landValueBreakdownFor(candidate, context),
      }))
      .sort((left, right) => right.breakdown.services - left.breakdown.services)[0]!;
    state.phase2.municipal.serviceLevelPercentByCategory = {
      administration: 100,
      security: 0,
      transport: 0,
      cleaning: 0,
    };
    const cut = landValueBreakdownFor(parcel.candidate, buildLandValueContext(state, districtId));
    expect(cut.services).toBeLessThan(parcel.breakdown.services);
    expect(cut.targetValue).toBeLessThan(parcel.breakdown.targetValue);
  });

  it("limita el cambio mensual al 5 % y deja el suelo público en cero", () => {
    const state = createInitialState(7);
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    state.phase2.municipal.serviceLevelPercentByCategory = {
      administration: 100,
      security: 0,
      transport: 0,
      cleaning: 0,
    };
    const before = new Map(
      [...state.phase2.parcels.values()].map((parcel) => [parcel.id, parcel.marketValue]),
    );
    updateLandValues(state);
    for (const parcel of state.phase2.parcels.values()) {
      const previous = before.get(parcel.id)!;
      if (parcel.disposition !== "marketable") {
        expect(parcel.marketValue).toBe(0);
        continue;
      }
      const change = Math.abs(parcel.marketValue - previous);
      expect(change, parcel.id).toBeLessThanOrEqual(Math.floor((previous * 5) / 100));
    }
  });

  it("mantiene entradas baratas, medias y premium en cada seed aceptada", () => {
    for (const seed of [1, 7, 42, 1337]) {
      const state = createInitialState(seed);
      const values = [...state.phase2.parcels.values()]
        .filter((parcel) => parcel.disposition === "marketable")
        .map((parcel) => parcel.marketValue);
      expect(new Set(values).size, `seed ${seed}`).toBeGreaterThan(2);
      expect(Math.min(...values), `seed ${seed}`).toBeLessThan(median(values));
      expect(median(values)).toBeLessThan(Math.max(...values));
    }
  });
});
