import { parseSnapshotV2, type SnapshotV2 } from "@landlord/shared";

const DEFAULT_DATABASE_NAME = "landlord-gate1";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";

/**
 * The stored shape is versioned separately from the database version: the IndexedDB schema did not
 * change, the snapshot contract did (D-089). A v1 record stays readable as metadata so the UI can
 * name the slot incompatible instead of silently dropping it.
 */
type StoredRecord = {
  slotId: string;
  schemaVersion: number;
  engineVersion: string;
  savedAt: number;
  snapshot: unknown;
};

type SnapshotRecord = {
  slotId: string;
  schemaVersion: 2;
  engineVersion: string;
  savedAt: number;
  snapshot: SnapshotV2;
};

export type SnapshotSlot = {
  slotId: string;
  schemaVersion: number;
  engineVersion: string;
  savedAt: number;
  /** False for Alpha v1 saves: they are listed, never loaded, and only removed explicitly. */
  compatible: boolean;
};

export const SUPPORTED_SCHEMA_VERSION = 2;

export class SnapshotPersistenceError extends Error {
  public override readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SnapshotPersistenceError";
    this.cause = cause;
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
      let snapshot: SnapshotV2;
      try {
        snapshot = parseSnapshotV2(snapshotValue);
      } catch (error) {
        throw new SnapshotPersistenceError("Snapshot validation failed", error);
      }
      const record: SnapshotRecord = {
        slotId,
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
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
        compatible: true,
      };
    },

    async list(): Promise<SnapshotSlot[]> {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      return records
        .map((record: StoredRecord) => ({
          slotId: record.slotId,
          schemaVersion: record.schemaVersion,
          engineVersion: record.engineVersion,
          savedAt: record.savedAt,
          compatible: record.schemaVersion === SUPPORTED_SCHEMA_VERSION,
        }))
        .sort((left, right) => left.slotId.localeCompare(right.slotId));
    },

    async load(slotId: string): Promise<SnapshotV2 | null> {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const record = await requestResult<StoredRecord | undefined>(
        transaction.objectStore(STORE_NAME).get(slotId),
      );
      if (!record) return null;
      if (record.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        throw new SnapshotPersistenceError(
          `UNSUPPORTED_SNAPSHOT_VERSION: el slot "${slotId}" guarda una partida v${record.schemaVersion} y esta versión sólo carga v${SUPPORTED_SCHEMA_VERSION}. Las partidas Alpha v1 no se migran; elimínalo explícitamente para liberar el slot.`,
        );
      }
      try {
        return parseSnapshotV2(record.snapshot);
      } catch (error) {
        throw new SnapshotPersistenceError("Stored snapshot validation failed", error);
      }
    },

    /** Explicit deletion: an incompatible slot is never removed on the player's behalf (D-089). */
    async remove(slotId: string): Promise<void> {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(slotId);
      await transactionComplete(transaction);
    },

    close(): void {
      database?.close();
      database = undefined;
      databasePromise = undefined;
    },
  };
}

export type IndexedDbPersistence = ReturnType<typeof createIndexedDbPersistence>;
