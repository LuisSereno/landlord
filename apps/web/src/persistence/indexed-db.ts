import { parseSnapshotV1, type SnapshotV1 } from "@landlord/shared";

const DEFAULT_DATABASE_NAME = "landlord-gate1";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";

type SnapshotRecord = {
  slotId: string;
  schemaVersion: 1;
  engineVersion: string;
  savedAt: number;
  snapshot: SnapshotV1;
};

export type SnapshotSlot = {
  slotId: string;
  schemaVersion: 1;
  engineVersion: string;
  savedAt: number;
};

export class SnapshotPersistenceError extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SnapshotPersistenceError";
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export type IndexedDbPersistenceOptions = {
  databaseName?: string;
  indexedDBFactory?: IDBFactory;
  now?: () => number;
};

export function createIndexedDbPersistence(options: IndexedDbPersistenceOptions = {}) {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const factory = options.indexedDBFactory ?? globalThis.indexedDB;
  const now = options.now ?? (() => Date.now());

  if (!factory) throw new SnapshotPersistenceError("IndexedDB is not available");

  let databasePromise: Promise<IDBDatabase> | undefined;
  let database: IDBDatabase | undefined;
  const openDatabase = (): Promise<IDBDatabase> => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "slotId" });
        }
      };
      request.onsuccess = () => {
        database = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
    return databasePromise;
  };

  return {
    async save(slotId: string, snapshotValue: unknown): Promise<SnapshotSlot> {
      if (!slotId.trim()) throw new SnapshotPersistenceError("Slot ID must not be empty");
      let snapshot: SnapshotV1;
      try {
        snapshot = parseSnapshotV1(snapshotValue);
      } catch (error) {
        throw new SnapshotPersistenceError("Snapshot validation failed", error);
      }
      const record: SnapshotRecord = {
        slotId,
        schemaVersion: 1,
        engineVersion: snapshot.engineVersion,
        savedAt: now(),
        snapshot,
      };
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      await transactionComplete(transaction);
      return {
        slotId: record.slotId,
        schemaVersion: record.schemaVersion,
        engineVersion: record.engineVersion,
        savedAt: record.savedAt,
      };
    },

    async list(): Promise<SnapshotSlot[]> {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      return records
        .map((record) => ({
          slotId: record.slotId,
          schemaVersion: record.schemaVersion,
          engineVersion: record.engineVersion,
          savedAt: record.savedAt,
        }))
        .sort((left, right) => left.slotId.localeCompare(right.slotId));
    },

    async load(slotId: string): Promise<SnapshotV1 | null> {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const record = await requestResult<SnapshotRecord | undefined>(
        transaction.objectStore(STORE_NAME).get(slotId),
      );
      if (!record) return null;
      try {
        return parseSnapshotV1(record.snapshot);
      } catch (error) {
        throw new SnapshotPersistenceError("Stored snapshot validation failed", error);
      }
    },

    close(): void {
      database?.close();
      database = undefined;
      databasePromise = undefined;
    },
  };
}

export type IndexedDbPersistence = ReturnType<typeof createIndexedDbPersistence>;
