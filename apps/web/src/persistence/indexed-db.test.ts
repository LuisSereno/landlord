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
      schemaVersion: 2,
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

  it("lists a v1 slot as incompatible, refuses to load it and deletes it only on request", async () => {
    const databaseName = nextDatabaseName();
    const persistence = createIndexedDbPersistence({ databaseName });
    openDatabases.push(persistence);
    // Crear la base y el almacén con una escritura válida antes de inyectar el registro v1.
    await persistence.save("slot-b", serializeSnapshot(createInitialState(1)));

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("snapshots", "readwrite");
        transaction.objectStore("snapshots").put({
          slotId: "old-alpha",
          schemaVersion: 1,
          engineVersion: "alpha",
          savedAt: 99,
          snapshot: { schemaVersion: 1 },
        });
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });

    // Listado: el slot existe y se declara incompatible; no desaparece por su cuenta.
    await expect(persistence.list()).resolves.toMatchObject([
      { slotId: "old-alpha", schemaVersion: 1, compatible: false },
      { slotId: "slot-b", schemaVersion: 2, compatible: true },
    ]);
    await expect(persistence.load("old-alpha")).rejects.toThrow(/UNSUPPORTED_SNAPSHOT_VERSION/);
    // Sigue ahí después del rechazo: rechazar no es borrar.
    await expect(persistence.list()).resolves.toHaveLength(2);

    await persistence.remove("old-alpha");
    await expect(persistence.list()).resolves.toMatchObject([{ slotId: "slot-b" }]);
  });
});
