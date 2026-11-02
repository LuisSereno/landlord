import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseOrganizationId, type BuildingType, type ParcelId } from "@landlord/shared";
import { enumeratePurchasableDevelopmentSites } from "./development-site";
import {
  developmentPlacementCandidatesFor,
  enumerateDevelopmentPlacementCandidates,
} from "./development-placement";
import { BUILDING_DEFINITIONS } from "./game-data";
import { createInitialState, type GameState } from "./state";

/**
 * V.d-7C · coste de la enumeración autoritativa (§45). Opt-in:
 * `pnpm placement:bench` escribe `docs/execution/phase-4/vd7c-placement-performance.json`.
 * No hay umbral nuevo inventado aquí: se registra la medida y se compara con el coste de
 * autocolocación que ya existía (`chooseFootprint` sobre el mismo insumo).
 */
const ENABLED = process.env.PLACEMENT_BENCHMARK === "1";
const organization = parseOrganizationId("org_00000001");
const REPEATS = 60;

function quantile(samples: readonly number[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return Number(sorted[index]!.toFixed(4));
}

function acquire(state: GameState, buildingType: BuildingType): ParcelId[] | null {
  const sites = enumeratePurchasableDevelopmentSites({
    state,
    definition: BUILDING_DEFINITIONS[buildingType],
  });
  const ids = sites[0];
  if (!ids) return null;
  for (const id of ids) state.phase2.parcels.get(id)!.ownerOrganizationId = organization;
  return ids;
}

describe.skipIf(!ENABLED)("V.d-7C · benchmark de colocación", () => {
  it("mide enumeración, recuento y latencia de la petición", () => {
    const types: BuildingType[] = [
      "courtyard_home",
      "row_house",
      "apartment_block",
      "workshop",
      "warehouse",
      "brickworks",
      "cement_plant",
      "steelworks",
    ];
    const cases: Array<{
      seed: number;
      buildingType: string;
      parcels: number;
      samples: number[];
      candidates: number;
      requestSamples: number[];
    }> = [];
    for (const seed of [7, 11, 42]) {
      /** Un estado por semilla: cada tipo encuentra su propio solar comprable y lo pasa a propiedad. */
      const fresh = createInitialState(seed);
      expect(fresh.seed).toBe(seed);
      for (const buildingType of types) {
        const ids = acquire(fresh, buildingType);
        if (!ids) continue;
        const samples: number[] = [];
        let candidates = 0;
        for (let repeat = 0; repeat < REPEATS; repeat += 1) {
          const started = performance.now();
          const enumerated = enumerateDevelopmentPlacementCandidates(fresh, {
            parcelIds: ids,
            buildingType,
            organizationId: organization,
          });
          samples.push(performance.now() - started);
          candidates = Math.max(candidates, enumerated.candidates.length);
        }
        const requestSamples: number[] = [];
        for (let repeat = 0; repeat < 20; repeat += 1) {
          const started = performance.now();
          developmentPlacementCandidatesFor(fresh, {
            districtId: fresh.phase2.parcels.get(ids[0]!)!.districtId,
            parcelIds: ids,
            buildingType,
            organizationId: organization,
          });
          requestSamples.push(performance.now() - started);
        }
        cases.push({
          seed,
          buildingType,
          parcels: ids.length,
          samples,
          candidates,
          requestSamples,
        });
      }
    }
    expect(cases.length).toBeGreaterThan(8);
    const all = cases.flatMap((entry) => entry.samples);
    const evidence = {
      measuredAt: new Date().toISOString(),
      repeats: REPEATS,
      note: "Enumeración completa de candidatas legales por proyecto, sin caché y sobre el estado generado.",
      overall: {
        p50ms: quantile(all, 0.5),
        p95ms: quantile(all, 0.95),
        maxMs: Number(Math.max(...all).toFixed(4)),
        cases: cases.length,
      },
      byCase: cases.map((entry) => ({
        seed: entry.seed,
        buildingType: entry.buildingType,
        parcels: entry.parcels,
        candidates: entry.candidates,
        p50ms: quantile(entry.samples, 0.5),
        p95ms: quantile(entry.samples, 0.95),
        requestP50ms: quantile(entry.requestSamples, 0.5),
        requestP95ms: quantile(entry.requestSamples, 0.95),
      })),
    };
    mkdirSync("docs/execution/phase-4", { recursive: true });
    writeFileSync(
      "docs/execution/phase-4/vd7c-placement-performance.json",
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log(`V.d-7C placement bench · ${JSON.stringify(evidence.overall)}`);
    /** Guardas duras: una petición interactiva no puede costar cientos de milisegundos. */
    expect(evidence.overall.p95ms).toBeLessThan(50);
    expect(evidence.byCase.every((entry) => entry.requestP95ms < 50)).toBe(true);
  }, 300_000);
});
