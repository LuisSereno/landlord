import { parseSeed, type Seed } from "@landlord/shared";

export const PRNG_ALGORITHM = "xoshiro128ss-v1" as const;

export type PrngState = {
  algorithm: typeof PRNG_ALGORITHM;
  state: [number, number, number, number];
};

function rotateLeft(value: number, rotation: number): number {
  return ((value << rotation) | (value >>> (32 - rotation))) >>> 0;
}

function createSplitMix32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let value = state ^ (state >>> 16);
    value = Math.imul(value, 0x21f0aaad);
    value ^= value >>> 15;
    value = Math.imul(value, 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
  };
}

function assertUint32(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError("PRNG state words must be uint32 values");
  }
}

function assertState(state: PrngState): void {
  if (state.algorithm !== PRNG_ALGORITHM) {
    throw new Error(`Unsupported PRNG algorithm: ${state.algorithm}`);
  }
  if (state.state.length !== 4 || state.state.every((word) => word === 0)) {
    throw new RangeError("PRNG state must contain four non-zero words");
  }
  state.state.forEach(assertUint32);
}

export class Xoshiro128ss {
  private state: [number, number, number, number];

  public constructor(seed: Seed) {
    const splitMix32 = createSplitMix32(seed);
    this.state = [splitMix32(), splitMix32(), splitMix32(), splitMix32()];
    assertState(this.exportState());
  }

  public nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(this.state[1], 5) >>> 0, 7), 9) >>> 0;
    const temporary = (this.state[1] << 9) >>> 0;

    this.state[2] = (this.state[2] ^ this.state[0]) >>> 0;
    this.state[3] = (this.state[3] ^ this.state[1]) >>> 0;
    this.state[1] = (this.state[1] ^ this.state[2]) >>> 0;
    this.state[0] = (this.state[0] ^ this.state[3]) >>> 0;
    this.state[2] = (this.state[2] ^ temporary) >>> 0;
    this.state[3] = rotateLeft(this.state[3], 11);

    return result;
  }

  public nextInt(minInclusive: number, maxExclusive: number): number {
    if (
      !Number.isSafeInteger(minInclusive) ||
      !Number.isSafeInteger(maxExclusive) ||
      minInclusive < 0 ||
      maxExclusive <= minInclusive ||
      maxExclusive > 0x100000000
    ) {
      throw new RangeError("nextInt requires a non-negative integer half-open range");
    }

    const range = maxExclusive - minInclusive;
    const domainSize = 0x100000000;
    const limit = domainSize - (domainSize % range);
    let value = this.nextUint32();
    while (value >= limit) value = this.nextUint32();
    return minInclusive + (value % range);
  }

  public exportState(): PrngState {
    return { algorithm: PRNG_ALGORITHM, state: [...this.state] as PrngState["state"] };
  }

  public restoreState(state: PrngState): void {
    assertState(state);
    this.state = [...state.state] as PrngState["state"];
  }
}

export function createPrng(seed: number): Xoshiro128ss {
  return new Xoshiro128ss(parseSeed(seed));
}
