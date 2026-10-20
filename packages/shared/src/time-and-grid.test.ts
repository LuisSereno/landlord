import { describe, expect, it } from "vitest";

import { parseGridCell, parseSeed, parseTick } from "./time-and-grid";

describe("time and grid primitives", () => {
  it("accepts safe non-negative ticks and the complete uint32 seed range", () => {
    expect(parseTick(0)).toBe(0);
    expect(parseTick(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseSeed(0)).toBe(0);
    expect(parseSeed(0xffffffff)).toBe(0xffffffff);
  });

  it("accepts integer grid cells without applying map bounds", () => {
    expect(parseGridCell({ x: 0, y: 63 })).toEqual({ x: 0, y: 63 });
    expect(parseGridCell({ x: 1000, y: 1000 })).toEqual({ x: 1000, y: 1000 });
  });

  it("rejects unsafe, negative, fractional and non-finite values", () => {
    expect(() => parseTick(-1)).toThrow();
    expect(() => parseTick(1.5)).toThrow();
    expect(() => parseTick(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => parseSeed(0x100000000)).toThrow();
    expect(() => parseGridCell({ x: 1.5, y: 0 })).toThrow();
    expect(() => parseGridCell({ x: 0, y: -1 })).toThrow();
  });
});
