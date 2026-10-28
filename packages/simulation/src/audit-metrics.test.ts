import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { describe, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { serializeSnapshot, restoreStateFromSnapshot } from "./snapshot";
import { createInitialState } from "./state";
import { SimulationWorkerRuntime } from "./worker-runtime";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  performance: { now(): number };
  TextEncoder: new () => { encode(value: string): { byteLength: number } };
  console: { log(value: string): void };
};

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

describe("Gate 1 audit metrics", () => {
  it.skipIf(environment.process?.env?.AUDIT_METRICS !== "1")(
    "measures Worker response and snapshot budgets without changing them",
    () => {
      const worker = new SimulationWorkerRuntime();
      worker.handle({
        protocolVersion: 2,
        requestId: "audit-init",
        type: "InitializeGame",
        payload: { seed: 1 },
      });
      const commandLatencies: number[] = [];
      for (let index = 0; index < 100; index += 1) {
        const start = environment.performance.now();
        worker.handle({
          protocolVersion: 2,
          requestId: `audit-command-${index}`,
          type: "SubmitCommand",
          payload: {
            command: {
              commandId: parseCommandId(`audit-command-${index}`),
              issuedByPersonId: parsePersonId("person_00000001"),
              actingAsOrganizationId: parseOrganizationId("org_00000001"),
              type: "PlaceTestStructure",
              payload: {
                districtId: PLAYER_HOME_DISTRICT_ID,
                cell: { x: index % 64, y: Math.floor(index / 64) },
              },
            },
          },
        });
        worker.advanceTicks(1);
        commandLatencies.push(environment.performance.now() - start);
      }

      const state = createInitialState(1);
      const snapshotTimings: number[] = [];
      const restoreTimings: number[] = [];
      let snapshot = serializeSnapshot(state);
      for (let index = 0; index < 100; index += 1) {
        const saveStart = environment.performance.now();
        snapshot = serializeSnapshot(state);
        snapshotTimings.push(environment.performance.now() - saveStart);
        const restoreStart = environment.performance.now();
        restoreStateFromSnapshot(snapshot);
        restoreTimings.push(environment.performance.now() - restoreStart);
      }
      const bytes = new environment.TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
      environment.console.log(
        JSON.stringify({
          worker: { p95: percentile(commandLatencies, 0.95), max: Math.max(...commandLatencies) },
          snapshot: {
            bytes,
            serializeP95: percentile(snapshotTimings, 0.95),
            restoreP95: percentile(restoreTimings, 0.95),
          },
        }),
      );
    },
  );
});
