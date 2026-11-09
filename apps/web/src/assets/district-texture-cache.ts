/**
 * V.j.6 — caché de texturas de variante acotada por memoria, con expulsión LRU y scope por distrito.
 *
 * D-102: el presupuesto ya no es "total servido" sino "bytes cargados en arranque / por distrito".
 * El arranque no carga el catálogo de variantes (sólo el manifiesto); las imágenes entran bajo
 * demanda. Esta caché acota la memoria decodificada: protege el distrito observado y las texturas
 * en uso este frame, y expulsa LRU el resto hasta caber en el presupuesto.
 *
 * Pura (sin Phaser) para poder probar la política de expulsión y las métricas sin escena.
 */
export type DistrictTextureEntry = {
  key: string;
  bytes: number;
  districtId: string;
  lastUse: number;
};

export type DistrictAssetMetrics = {
  /** Bytes decodificados cargados desde el arranque (acumulado, incluye expulsados). */
  loadedBytesTotal: number;
  loadedCount: number;
  /** Bytes vivos en la caché ahora. */
  cacheBytes: number;
  cacheCount: number;
  evictedCount: number;
  evictedBytes: number;
  /** Bytes vivos por distrito. */
  byDistrict: Record<string, number>;
  budgetBytes: number;
};

export class DistrictTextureCache {
  private entries = new Map<string, DistrictTextureEntry>();
  private clock = 0;
  private loadedBytesTotal = 0;
  private loadedCount = 0;
  private evictedCount = 0;
  private evictedBytes = 0;

  constructor(private readonly budgetBytes: number) {}

  /** Registra una textura ya cargada (bytes decodificados) atribuida a un distrito. */
  recordLoad(key: string, bytes: number, districtId: string): void {
    this.clock += 1;
    const prev = this.entries.get(key);
    if (prev) {
      prev.lastUse = this.clock;
      prev.districtId = districtId;
      return;
    }
    this.entries.set(key, { key, bytes, districtId, lastUse: this.clock });
    this.loadedBytesTotal += bytes;
    this.loadedCount += 1;
  }

  /** Marca una textura como usada este frame (actualiza LRU). */
  touch(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.clock += 1;
      entry.lastUse = this.clock;
    }
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Fija el distrito observado y las claves en uso; expulsa LRU las no protegidas hasta caber en el
   * presupuesto. Devuelve las claves expulsadas (el scene debe eliminar sus texturas de Phaser).
   */
  settle(observedDistrictId: string, inUseKeys: Iterable<string>): string[] {
    const protectedKeys = new Set(inUseKeys);
    this.clock += 1;
    for (const key of protectedKeys) this.touch(key);

    const evicted: string[] = [];
    const candidates = [...this.entries.values()]
      .filter((e) => !protectedKeys.has(e.key) && e.districtId !== observedDistrictId)
      .sort((a, b) => a.lastUse - b.lastUse);
    for (const entry of candidates) {
      if (this.cacheBytes() <= this.budgetBytes) break;
      this.entries.delete(entry.key);
      this.evictedCount += 1;
      this.evictedBytes += entry.bytes;
      evicted.push(entry.key);
    }
    // Si sólo con no-protegidas de otros distritos no basta, expulsa LRU no-protegidas del propio
    // distrito observado (estados/orientaciones que ya no se muestran).
    if (this.cacheBytes() > this.budgetBytes) {
      const own = [...this.entries.values()]
        .filter((e) => !protectedKeys.has(e.key))
        .sort((a, b) => a.lastUse - b.lastUse);
      for (const entry of own) {
        if (this.cacheBytes() <= this.budgetBytes) break;
        this.entries.delete(entry.key);
        this.evictedCount += 1;
        this.evictedBytes += entry.bytes;
        evicted.push(entry.key);
      }
    }
    return evicted;
  }

  cacheBytes(): number {
    let total = 0;
    for (const e of this.entries.values()) total += e.bytes;
    return total;
  }

  metrics(): DistrictAssetMetrics {
    const byDistrict: Record<string, number> = {};
    for (const e of this.entries.values()) {
      byDistrict[e.districtId] = (byDistrict[e.districtId] ?? 0) + e.bytes;
    }
    return {
      loadedBytesTotal: this.loadedBytesTotal,
      loadedCount: this.loadedCount,
      cacheBytes: this.cacheBytes(),
      cacheCount: this.entries.size,
      evictedCount: this.evictedCount,
      evictedBytes: this.evictedBytes,
      byDistrict,
      budgetBytes: this.budgetBytes,
    };
  }
}

/** Memoria decodificada aproximada de un PNG (RGBA8). */
export function decodedTextureBytes(width: number, height: number): number {
  return width * height * 4;
}

/** Presupuesto de memoria de variantes por sesión (D-102). 96 MiB deja varios distritos calientes. */
export const VARIANT_CACHE_BUDGET_BYTES = 96 * 1024 * 1024;

/**
 * Vecinos de un distrito en la rejilla de ciudad (slotX/slotY) para preload. Devuelve ids adyacentes
 * (4-neighbourhood) dentro del layout; el scene puede precargar sus variantes complete al cambiar.
 */
export function neighborDistrictIds(
  districts: ReadonlyArray<{ id: string; slotX: number; slotY: number }>,
  observedId: string,
): string[] {
  const observed = districts.find((d) => d.id === observedId);
  if (!observed) return [];
  return districts
    .filter(
      (d) =>
        d.id !== observedId &&
        Math.abs(d.slotX - observed.slotX) + Math.abs(d.slotY - observed.slotY) === 1,
    )
    .map((d) => d.id);
}
