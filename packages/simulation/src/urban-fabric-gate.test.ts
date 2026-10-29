import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  districtGenerationSeed,
  parseCityId,
  parseSeed,
  parseCityProfileId,
  roadCellsFromSegments,
  type GridCell,
  type RoadAnchor,
} from "@landlord/shared";

import {
  canonicalSlots,
  districtIdForSlot,
  gatewayCellsByDistrict,
  parcelIdOrdinalForSlot,
  resolveCityProfile,
} from "./city";
import { defaultRoadAnchors, generateDistrictFromProfile } from "./district-generator";
import { resolveDistrictProfile } from "./district-profiles";
import { deriveRoadNetwork, cellKey } from "./urban-fabric";
import {
  MORPHOLOGY_FAMILY_BY_PROFILE,
  medianBlockAreaCells,
  streetDensityKmPerKm2,
  intersectionDensityPerKm2,
} from "./urban-morphology";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const enabled = process.env.FABRIC_GATE === "1";
const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const now = () => performance.now();

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

type Envelope = {
  families: Record<
    string,
    {
      metrics: Record<string, { min: number; max: number; median: number }>;
    }
  >;
};

const envelopes = JSON.parse(
  readFileSync(new URL("../../../docs/urban-benchmark/envelopes-v1.json", import.meta.url), "utf8"),
) as Envelope;

describe.skipIf(!enabled)("V.d.1 gate de tejido urbano", () => {
  it("barre 100 seeds (900 distritos) sin fallos silenciosos y dentro de presupuesto", () => {
    const cityProfile = resolveCityProfile(parseCityProfileId("ciudad_del_umbral_v1"));
    const cityId = parseCityId("city_00000001");
    const gatewaysByDistrict = gatewayCellsByDistrict();
    const generationTimes: number[] = [];
    const roadTimes: number[] = [];
    const densityByProfile = new Map<string, number[]>();
    const intersectionsByProfile = new Map<string, number[]>();
    const blockAreaByProfile = new Map<string, number[]>();
    let districts = 0;
    let parcels = 0;

    for (const seed of SEEDS) {
      for (const slot of canonicalSlots(cityProfile)) {
        const profile = resolveDistrictProfile(slot.districtProfileId);
        const districtId = districtIdForSlot(slot.slotX, slot.slotY);
        const gatewayCells = gatewaysByDistrict.get(districtId) ?? [];
        const districtSeed = districtGenerationSeed({
          citySeed: parseSeed(seed),
          cityProfileId: cityProfile.id,
          slotX: slot.slotX,
          slotY: slot.slotY,
          districtProfileId: profile.id,
        });
        const start = now();
        const district = generateDistrictFromProfile(profile, districtSeed, {
          districtId,
          parcelIdOrdinal: parcelIdOrdinalForSlot(slot.slotX, slot.slotY),
          gatewayCells,
          cityId,
        });
        generationTimes.push(now() - start);
        districts += 1;
        parcels += district.parcels.length;

        const roads = roadCellsFromSegments(district.roads.segments);
        for (const gateway of gatewayCells) {
          expect(roads.has(cellKey(gateway)), `${profile.id}/${seed} gateway`).toBe(true);
        }
        for (const parcel of district.parcels) {
          expect(parcel.roadFrontages.length, `${profile.id}/${seed}/${parcel.id}`).toBeGreaterThan(
            0,
          );
          expect(
            parcel.cells.some((cell) => roads.has(cellKey(cell))),
            `${profile.id}/${seed}/${parcel.id}`,
          ).toBe(false);
        }

        const anchors: RoadAnchor[] = defaultRoadAnchors(
          profile,
          gatewayCells.map((cell: GridCell, index) => ({
            id: `gateway_${index}`,
            kind: "gateway" as const,
            cell,
          })),
        );
        const roadStart = now();
        deriveRoadNetwork({
          anchors,
          latticeLines: profile.fabric.latticeLines,
          connectSpawns: profile.fabric.connectSpawns,
          width: profile.width,
          height: profile.height,
        });
        roadTimes.push(now() - roadStart);

        const push = (map: Map<string, number[]>, value: number) => {
          const list = map.get(profile.id) ?? [];
          list.push(value);
          map.set(profile.id, list);
        };
        push(densityByProfile, streetDensityKmPerKm2(district.roads));
        push(intersectionsByProfile, intersectionDensityPerKm2(district.roads));
        push(blockAreaByProfile, medianBlockAreaCells(district.blocks));
      }
    }

    const generationP95 = percentile(generationTimes, 0.95);
    const roadP95 = percentile(roadTimes, 0.95);
    const summary: Array<Record<string, unknown>> = [];
    for (const [profileId, family] of Object.entries(MORPHOLOGY_FAMILY_BY_PROFILE).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const envelope = envelopes.families[family]!.metrics;
      const density = median(densityByProfile.get(profileId) ?? []);
      const intersections = median(intersectionsByProfile.get(profileId) ?? []);
      const blockArea = median(blockAreaByProfile.get(profileId) ?? []);
      summary.push({
        profileId,
        family,
        density: Number(density.toFixed(2)),
        intersections: Number(intersections.toFixed(1)),
        blockAreaCells: blockArea,
        envelope: {
          density: [
            envelope["street.densityKmPerKm2"]!.min,
            envelope["street.densityKmPerKm2"]!.max,
          ],
          intersections: [
            envelope["street.intersectionDensityPerKm2"]!.min,
            envelope["street.intersectionDensityPerKm2"]!.max,
          ],
          blockArea: [
            envelope["blocks.medianAreaCells4m"]!.min,
            envelope["blocks.medianAreaCells4m"]!.max,
          ],
        },
      });
      // Los envelopes están publicados con dos decimales: se comparan redondeados para que un
      // empate exacto (11 intersecciones = 167,85/km²) no falle por el último bit del float.
      const round2 = (value: number) => Math.round(value * 100) / 100;
      expect(round2(density), `${profileId} density`).toBeGreaterThanOrEqual(
        round2(envelope["street.densityKmPerKm2"]!.min),
      );
      expect(round2(density), `${profileId} density`).toBeLessThanOrEqual(
        round2(envelope["street.densityKmPerKm2"]!.max),
      );
      expect(round2(intersections), `${profileId} intersections`).toBeGreaterThanOrEqual(
        round2(envelope["street.intersectionDensityPerKm2"]!.min),
      );
      expect(round2(intersections), `${profileId} intersections`).toBeLessThanOrEqual(
        round2(envelope["street.intersectionDensityPerKm2"]!.max),
      );
      expect(blockArea, `${profileId} block area`).toBeGreaterThanOrEqual(
        envelope["blocks.medianAreaCells4m"]!.min,
      );
      expect(blockArea, `${profileId} block area`).toBeLessThanOrEqual(
        envelope["blocks.medianAreaCells4m"]!.max,
      );
    }

    const evidence = {
      head: execSync("git rev-parse HEAD").toString().trim(),
      generatedAt: new Date().toISOString(),
      tool: "pnpm fabric:gate",
      seeds: SEEDS.length,
      districts,
      parcels,
      generationMs: {
        p50: Number(percentile(generationTimes, 0.5).toFixed(2)),
        p95: Number(generationP95.toFixed(2)),
        max: Number(Math.max(...generationTimes).toFixed(2)),
      },
      roadDerivationMs: {
        p50: Number(percentile(roadTimes, 0.5).toFixed(2)),
        p95: Number(roadP95.toFixed(2)),
        max: Number(Math.max(...roadTimes).toFixed(2)),
      },
      morphology: summary,
    };
    console.log(JSON.stringify(evidence, null, 2));
    /**
     * El destino es configurable para que una corrida de hardening no pise la evidencia de V.d.1,
     * que es histórica. Sin variable, sigue escribiendo el fichero original de la fase.
     */
    const evidencePath =
      environment.process?.env?.FABRIC_GATE_OUT ?? "docs/execution/phase-4/vd1-fabric-gate.json";
    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    expect(districts).toBe(100 * 9);
    expect(generationP95).toBeLessThan(300);
    expect(roadP95).toBeLessThan(25);
  }, 900_000);
});
