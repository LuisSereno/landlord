import { describe, expect, it } from "vitest";

import { generateDistrict, type DistrictGenerationReport } from "./district-generator";
import { DISTRICT_PROFILE_IDS, resolveDistrictProfile } from "./district-profiles";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  console: { log(value: string): void };
};

const DEFAULT_INSPECTION_SEEDS = [1, 7, 42, 1337];

function parseList(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw || raw.trim() === "") return [...fallback];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function parseSeeds(raw: string | undefined): number[] {
  const seeds = parseList(raw, DEFAULT_INSPECTION_SEEDS.map(String)).map((entry) => Number(entry));
  if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)) {
    throw new RangeError("DISTRICT_SEED acepta enteros entre 0 y 4294967295, separados por comas");
  }
  return seeds;
}

function fixtureLiteral(report: DistrictGenerationReport): string {
  return [
    "  {",
    `    profileId: ${JSON.stringify(report.profileId)},`,
    `    seed: ${report.seed},`,
    `    hash: ${JSON.stringify(report.hash)},`,
    `    parcelCount: ${report.parcelCount},`,
    `    anchorParcelCount: ${report.anchorParcelCount},`,
    `    blockedCellCount: ${report.blockedCellCount},`,
    `    zoningCounts: { residential: ${report.zoningCounts.residential}, mixed: ${report.zoningCounts.mixed}, industrial: ${report.zoningCounts.industrial} },`,
    "  },",
  ].join("\n");
}

describe("WP4.1 district inspector", () => {
  it.skipIf(environment.process?.env?.DISTRICT_INSPECT !== "1")(
    "inspecciona y reproduce distritos generados para las seeds solicitadas",
    () => {
      const profileIds = parseList(
        environment.process?.env?.DISTRICT_PROFILE,
        DISTRICT_PROFILE_IDS,
      );
      const seeds = parseSeeds(environment.process?.env?.DISTRICT_SEED);
      const reports: DistrictGenerationReport[] = [];

      for (const profileId of profileIds) {
        const profile = resolveDistrictProfile(profileId);
        for (const seed of seeds) {
          const generated = generateDistrict({ seed, profileId });
          reports.push(generated.report);
          environment.console.log(
            [
              `── ${profile.name} (${profile.id}) seed=${seed}`,
              `   hash=${generated.report.hash} intentos=${generated.report.attempts} ` +
                `parcelas=${generated.report.parcelCount} (anclas ${generated.report.anchorParcelCount}) ` +
                `bloqueadas=${generated.report.blockedCellCount}`,
              `   zoning R/M/I=${generated.report.zoningCounts.residential}/` +
                `${generated.report.zoningCounts.mixed}/${generated.report.zoningCounts.industrial} ` +
                `precio min/media/max=${generated.report.cheapestParcelPrice}/` +
                `${generated.report.averageParcelPrice}/${generated.report.mostExpensiveParcelPrice}`,
              `   spawns jugador=${generated.spawnAnchors.player.x},${generated.spawnAnchors.player.y} ` +
                `rival=${generated.spawnAnchors.rival.x},${generated.spawnAnchors.rival.y}`,
              `   parcelas: ${generated.parcels
                .map(
                  (parcel) =>
                    `${parcel.id.slice(-4)}@${parcel.cell.x},${parcel.cell.y}:${parcel.zoning[0]}`,
                )
                .join(" ")}`,
            ].join("\n"),
          );
        }
      }

      environment.console.log(
        [
          "",
          "── Fixtures reproducibles (pegar en district-fixtures.ts)",
          ...reports.map(fixtureLiteral),
        ].join("\n"),
      );

      for (const report of reports) expect(report.issues).toEqual([]);
    },
  );
});
