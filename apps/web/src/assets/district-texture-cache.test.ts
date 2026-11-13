import { describe, expect, it } from "vitest";
import {
  DistrictTextureCache,
  decodedTextureBytes,
  neighborDistrictIds,
} from "./district-texture-cache";

describe("V.j.6 caché de texturas por distrito", () => {
  it("decodedTextureBytes estima RGBA8", () => {
    expect(decodedTextureBytes(100, 100)).toBe(40_000);
  });

  it("protege el distrito observado y las claves en uso; expulsa LRU el resto", () => {
    const cache = new DistrictTextureCache(100);
    cache.recordLoad("a", 40, "d1");
    cache.recordLoad("b", 40, "d2");
    cache.recordLoad("c", 40, "d2");
    // observed d1, in-use none => cache=120 > 100; expulsa LRU de d2 (b, luego c hasta caber)
    const evicted = cache.settle("d1", []);
    expect(evicted).toContain("b");
    expect(cache.has("a")).toBe(true); // distrito observado protegido
    expect(cache.cacheBytes()).toBeLessThanOrEqual(100);
  });

  it("no expulsa una clave en uso aunque sea de otro distrito", () => {
    const cache = new DistrictTextureCache(50);
    cache.recordLoad("x", 40, "d2");
    cache.recordLoad("y", 40, "d2");
    const evicted = cache.settle("d1", ["x"]);
    expect(cache.has("x")).toBe(true);
    expect(evicted).toEqual(["y"]);
  });

  it("métricas acumulan carga y expulsión y desglosan por distrito", () => {
    const cache = new DistrictTextureCache(100);
    cache.recordLoad("a", 40, "d1");
    cache.recordLoad("b", 40, "d2");
    cache.settle("d1", ["a"]);
    const m = cache.metrics();
    expect(m.loadedCount).toBe(2);
    expect(m.loadedBytesTotal).toBe(80);
    expect(m.byDistrict.d1).toBe(40);
    expect(m.budgetBytes).toBe(100);
  });

  it("recordLoad repetido no duplica bytes cargados", () => {
    const cache = new DistrictTextureCache(1000);
    cache.recordLoad("a", 40, "d1");
    cache.recordLoad("a", 40, "d1");
    expect(cache.metrics().loadedCount).toBe(1);
    expect(cache.cacheBytes()).toBe(40);
  });
});

describe("V.j.6 vecinos para preload", () => {
  const districts = [
    { id: "center", slotX: 1, slotY: 1 },
    { id: "n", slotX: 1, slotY: 0 },
    { id: "e", slotX: 2, slotY: 1 },
    { id: "diag", slotX: 2, slotY: 0 },
  ];
  it("devuelve sólo adyacentes 4-neighbourhood", () => {
    expect(neighborDistrictIds(districts, "center").sort()).toEqual(["e", "n"]);
  });
  it("distrito desconocido => sin vecinos", () => {
    expect(neighborDistrictIds(districts, "nope")).toEqual([]);
  });
});
