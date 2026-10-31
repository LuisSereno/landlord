import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { measureMonthlyCloses, SYSTEM_COST_SCALES } from "./system-cost";

const enabled = process.env.SYSTEM_COST_MONTHLY === "1";
const seeds = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const closesPerSeed = 6;
const scale = SYSTEM_COST_SCALES[SYSTEM_COST_SCALES.length - 1]!;

function runMeasurement() {
  return measureMonthlyCloses({
    scale,
    seeds,
    closesPerSeed,
    now: () => performance.now(),
  });
}

function outputMeasurement(measurement: ReturnType<typeof runMeasurement>): void {
  const path = process.env.SYSTEM_COST_MONTHLY_OUT;
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        sha: process.env.SYSTEM_COST_MONTHLY_SHA ?? "unknown",
        node: process.version,
        scale: measurement.parcelCount,
        seeds: [...seeds],
        closesPerSeed,
        samples: measurement.closeSamplesMs.length,
        early: measurement.months.first,
        transition: measurement.months.transition,
        mature: measurement.months.mature,
      },
      null,
      2,
    )}\n`,
  );
}

describe("focused monthly-close performance gate", () => {
  it("declares the authoritative 8×6 configuration", () => {
    expect(scale.parcels).toBe(800);
    expect(seeds).toHaveLength(8);
    expect(closesPerSeed).toBe(6);
  });

  it.skipIf(!enabled)(
    "measures mature monthly closes with the shared longitudinal harness",
    () => {
      const measurement = runMeasurement();
      expect(measurement.closeSamplesMs).toHaveLength(48);
      expect(measurement.months.mature.meanMs).toBeGreaterThanOrEqual(0);
      outputMeasurement(measurement);
    },
    900_000,
  );
});
