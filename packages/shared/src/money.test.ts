import { describe, expect, it } from "vitest";

import { addMoney, parseMoney, subtractMoney } from "./money";

describe("Money", () => {
  it("uses non-negative safe integers in the minor unit", () => {
    expect(parseMoney(0)).toBe(0);
    expect(parseMoney(1250)).toBe(1250);
  });

  it("returns checked results instead of clamping or wrapping", () => {
    const balance = parseMoney(100);
    const cost = parseMoney(40);
    expect(subtractMoney(balance, cost)).toEqual({ ok: true, value: 60 });
    expect(subtractMoney(balance, parseMoney(101))).toEqual({
      ok: false,
      code: "INSUFFICIENT_FUNDS",
    });
    expect(addMoney(parseMoney(Number.MAX_SAFE_INTEGER), parseMoney(1))).toEqual({
      ok: false,
      code: "OVERFLOW",
    });
  });

  it("rejects floats, negative values, NaN and infinity", () => {
    expect(() => parseMoney(1.5)).toThrow();
    expect(() => parseMoney(-1)).toThrow();
    expect(() => parseMoney(Number.NaN)).toThrow();
    expect(() => parseMoney(Number.POSITIVE_INFINITY)).toThrow();
  });
});
