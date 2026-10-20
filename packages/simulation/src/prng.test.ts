import { describe, expect, it } from "vitest";

import { createPrng, PRNG_ALGORITHM, Xoshiro128ss, type PrngState } from "./prng";

const vectors = [
  {
    seed: 0,
    initial: [1684164658, 3653269916, 2939563536, 2141751570],
    output: [
      1789933344, 44971166, 2521387044, 3848737593, 1138324114, 749234105, 1899511038, 1995189375,
      3629653958, 19166872,
    ],
    final: [3935033944, 190438867, 878468656, 2324950187],
  },
  {
    seed: 1,
    initial: [1580013426, 350525680, 3524174333, 3011703609],
    output: [
      393288148, 2174103013, 3814759091, 2092745082, 1865176206, 2179171167, 3207394750, 2858353069,
      559075315, 3395495274,
    ],
    final: [3604652282, 544282413, 1267161376, 3034057615],
  },
  {
    seed: 0xffffffff,
    initial: [3950124170, 4293442868, 1302505678, 2762329221],
    output: [
      4104197751, 1825856343, 1152209388, 2427537429, 3685145430, 609215610, 4161674276, 1502890106,
      904255344, 859094872,
    ],
    final: [1209703510, 1679837229, 4053859004, 718193118],
  },
] as const;

describe("xoshiro128ss-v1", () => {
  it.each(vectors)("matches the conformance vector for seed $seed", (vector) => {
    const prng = createPrng(vector.seed);
    expect(prng.exportState()).toEqual({ algorithm: PRNG_ALGORITHM, state: vector.initial });
    expect(vector.output.map(() => prng.nextUint32())).toEqual(vector.output);
    expect(prng.exportState()).toEqual({ algorithm: PRNG_ALGORITHM, state: vector.final });
  });

  it("continues at the exact next value after restoring state", () => {
    const original = createPrng(1);
    original.nextUint32();
    const checkpoint = original.exportState();
    const expected = original.nextUint32();
    const restored = createPrng(0);
    restored.restoreState(checkpoint);
    expect(restored.nextUint32()).toBe(expected);
  });

  it("returns values within a half-open range without modulo API exposure", () => {
    const prng = createPrng(42);
    const values = Array.from({ length: 1000 }, () => prng.nextInt(3, 9));
    expect(values.every((value) => value >= 3 && value < 9)).toBe(true);
  });

  it("rejects invalid ranges, algorithms and all-zero state", () => {
    const prng = new Xoshiro128ss(1 as never);
    expect(() => prng.nextInt(1, 1)).toThrow();
    expect(() => prng.nextInt(-1, 2)).toThrow();
    expect(() => prng.nextInt(0, 0x100000001)).toThrow();
    expect(() => prng.restoreState({ algorithm: "other" as never, state: [1, 2, 3, 4] })).toThrow();
    expect(() =>
      prng.restoreState({ algorithm: PRNG_ALGORITHM, state: [0, 0, 0, 0] } as PrngState),
    ).toThrow();
  });
});
