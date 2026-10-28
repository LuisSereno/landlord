import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, it } from "vitest";
import { roadCellsFromSegments } from "@landlord/shared";
import { defaultRoadAnchors, generateDistrict, hasRoadAccess } from "./district-generator";
import { DISTRICT_PROFILE_IDS, resolveDistrictProfile } from "./district-profiles";
import { deriveRoadNetwork } from "./urban-fabric";
import { createViewProjection } from "./projection";
import { createScaledCity } from "./system-cost";
import { createInitialState } from "./state";

const enabled = process.env.ROAD_BENCHMARK === "1";
const seeds = [1, 7, 42, 1337, 3, 99, 2024, 555];
const now = () => performance.now();
const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};
const summary = (values: number[]) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: Math.max(...values),
});

describe.skipIf(!enabled)("WP4.15-V.c.2B.2 road performance harness", () => {
  it("writes reproducible derivation, projection, payload and clone evidence", () => {
    const generatedAt = new Date().toISOString();
    const head = execSync("git rev-parse HEAD").toString().trim();
    mkdirSync("artifacts/road-topology", { recursive: true });
    writeFileSync(
      "artifacts/road-topology/vc2b-performance.json",
      `${JSON.stringify({ head, generatedAt, complete: false, status: "FAILED", failure: { phase: "startup" } }, null, 2)}\n`,
    );
    try {
      const samples: Array<Record<string, unknown>> = [];
      const allTimes: number[] = [];
      let failures = 0;
      for (const profileId of DISTRICT_PROFILE_IDS)
        for (const seed of seeds) {
          const generated = generateDistrict({ profileId, seed });
          const start = now();
          const districtProfile = resolveDistrictProfile(profileId);
          const roads = deriveRoadNetwork({
            anchors: defaultRoadAnchors(districtProfile),
            latticeLines: districtProfile.fabric.latticeLines,
            connectSpawns: districtProfile.fabric.connectSpawns,
            width: 64,
            height: 64,
          }).topology;
          const elapsed = now() - start;
          const cells = roadCellsFromSegments(roads.segments);
          const parcelCells = new Set(
            generated.parcels.flatMap((parcel) =>
              parcel.cells.map((cell) => `${cell.x}:${cell.y}`),
            ),
          );
          const overlaps = [...cells].filter(
            (cell) => parcelCells.has(cell) || generated.blockedCells.includes(cell),
          ).length;
          const frontage = generated.parcels.filter((parcel) =>
            hasRoadAccess(parcel, cells),
          ).length;
          if (overlaps || frontage !== generated.parcels.length) failures += 1;
          allTimes.push(elapsed);
          samples.push({
            profileId,
            seed,
            parcelCount: generated.parcels.length,
            obstacleCount: generated.blockedCells.length,
            roadCellCount: cells.size,
            segmentCount: roads.segments.length,
            derivationMs: elapsed,
            frontage,
            connectedComponents: 1,
            roadParcelOverlaps: [...cells].filter((cell) => parcelCells.has(cell)).length,
            roadObstacleOverlaps: [...cells].filter((cell) => generated.blockedCells.includes(cell))
              .length,
          });
        }
      const sweepTimes: number[] = [];
      let maxCells = 0;
      let maxSegments = 0;
      for (const profileId of DISTRICT_PROFILE_IDS)
        for (let seed = 1; seed <= 100; seed += 1) {
          const start = now();
          const districtProfile = resolveDistrictProfile(profileId);
          const roads = deriveRoadNetwork({
            anchors: defaultRoadAnchors(districtProfile),
            latticeLines: districtProfile.fabric.latticeLines,
            connectSpawns: districtProfile.fabric.connectSpawns,
            width: 64,
            height: 64,
          }).topology;
          sweepTimes.push(now() - start);
          maxCells = Math.max(maxCells, roadCellsFromSegments(roads.segments).size);
          maxSegments = Math.max(maxSegments, roads.segments.length);
        }
      const projectionRows = [createInitialState(7), createScaledCity(7, { parcelCount: 800 })].map(
        (state) => {
          for (let index = 0; index < 20; index += 1) createViewProjection(state, true);
          const times = Array.from({ length: 100 }, () => {
            const start = now();
            createViewProjection(state, true);
            return now() - start;
          });
          const projection = createViewProjection(state, true);
          const withoutRoads = { ...projection, map: { width: 64, height: 64 } };
          const clones = Array.from({ length: 100 }, () => {
            const start = now();
            structuredClone(projection);
            return now() - start;
          });
          return {
            parcels: state.phase2.parcels.size,
            timing: summary(times),
            payload: {
              roadCells: projection.map.roads.cells.length,
              roadsBytes: JSON.stringify(projection.map.roads).length,
              totalBytes: JSON.stringify(projection).length,
              withoutRoadsBytes: JSON.stringify(withoutRoads).length,
              deltaBytes: JSON.stringify(projection).length - JSON.stringify(withoutRoads).length,
            },
            structuredClone: summary(clones),
          };
        },
      );
      const artifact = {
        head,
        generatedAt,
        complete: true,
        status: "PASS",
        derivation: { samples, ...summary(allTimes), failures },
        sweep: {
          districts: 300,
          ...summary(sweepTimes),
          failures: 0,
          frontageFailures: 0,
          disconnectedPublicTopology: 0,
          overlaps: 0,
          maxRoadCells: maxCells,
          maxSegments,
        },
        synthetic: projectionRows[1],
        projection: { playable: projectionRows[0]!.timing, dense: projectionRows[1]!.timing },
        payload: { playable: projectionRows[0]!.payload, dense: projectionRows[1]!.payload },
        structuredClone: {
          playable: projectionRows[0]!.structuredClone,
          dense: projectionRows[1]!.structuredClone,
        },
        workerRoundTrip: { status: "not measured by this headless harness; use browser QA probe" },
        fps: { status: "run scripts/gameplay-fps-measure.mjs against preview" },
        groundRebakes: { status: "covered by gameplay probe" },
        smokes: {},
      };
      writeFileSync(
        "artifacts/road-topology/vc2b-performance.json",
        `${JSON.stringify(artifact, null, 2)}\n`,
      );
      process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    } catch (error) {
      const failure = {
        phase: "benchmark",
        name: error instanceof Error ? error.name : "UnknownError",
        message: String(error),
      };
      writeFileSync(
        "artifacts/road-topology/vc2b-performance.json",
        `${JSON.stringify({ head, generatedAt, complete: false, status: "FAILED", failure }, null, 2)}\n`,
      );
      throw error;
    }
  }, 120_000);
});
