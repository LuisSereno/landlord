import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { createInitialState, ENGINE_VERSION, serializeSnapshot } from "@landlord/simulation";
import { createIndexedDbPersistence, SnapshotPersistenceError } from "./indexed-db";

let databaseIndex = 0;
const openDatabases: Array<{ close(): void }> = [];

function nextDatabaseName(): string {
  databaseIndex += 1;
  return `landlord-test-persistence-${databaseIndex}`;
}

describe("IndexedDB snapshot persistence", () => {
  afterEach(() => {
    for (const database of openDatabases.splice(0)) database.close();
  });

  it("saves, lists and loads a validated snapshot with metadata", async () => {
    const persistence = createIndexedDbPersistence({
      databaseName: nextDatabaseName(),
      now: () => 1234,
    });
    openDatabases.push(persistence);
    const snapshot = serializeSnapshot(createInitialState(1));
    await expect(persistence.save("slot-b", snapshot)).resolves.toMatchObject({
      slotId: "slot-b",
      schemaVersion: 1,
      engineVersion: ENGINE_VERSION,
      savedAt: 1234,
    });
    await persistence.save("slot-a", snapshot);
    await expect(persistence.list()).resolves.toMatchObject([
      { slotId: "slot-a" },
      { slotId: "slot-b" },
    ]);
    await expect(persistence.load("slot-b")).resolves.toEqual(snapshot);
  });

  it("rejects invalid writes and preserves the last valid save", async () => {
    const persistence = createIndexedDbPersistence({ databaseName: nextDatabaseName() });
    openDatabases.push(persistence);
    const snapshot = serializeSnapshot(createInitialState(1));
    await persistence.save("slot", snapshot);
    await expect(persistence.save("slot", { schemaVersion: 2 })).rejects.toBeInstanceOf(
      SnapshotPersistenceError,
    );
    await expect(persistence.load("slot")).resolves.toEqual(snapshot);
  });

  it("returns null for an unknown slot", async () => {
    const persistence = createIndexedDbPersistence({ databaseName: nextDatabaseName() });
    openDatabases.push(persistence);
    await expect(persistence.load("missing")).resolves.toBeNull();
  });

  it("rejects a corrupted payload already stored in IndexedDB", async () => {
    const databaseName = nextDatabaseName();
    const persistence = createIndexedDbPersistence({ databaseName });
    openDatabases.push(persistence);
    await persistence.save("slot", serializeSnapshot(createInitialState(1)));

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("snapshots", "readwrite");
        transaction.objectStore("snapshots").put({
          slotId: "slot",
          schemaVersion: 2,
          engineVersion: "future",
          savedAt: 1,
          snapshot: { schemaVersion: 2 },
        });
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });

    await expect(persistence.load("slot")).rejects.toBeInstanceOf(SnapshotPersistenceError);
  });
});
