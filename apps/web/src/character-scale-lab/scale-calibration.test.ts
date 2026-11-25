import { describe, expect, it } from "vitest";
import {
  calibrateAnimation,
  calibrateSprite,
  measureAlphaBounds,
  type SpriteFrameMeasurement,
} from "./scale-calibration";

function frame(
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): SpriteFrameMeasurement {
  return {
    width,
    height,
    visible: { left, top, right, bottom },
    support: { x: (left + right) / 2, y: bottom },
  };
}

describe("measureAlphaBounds", () => {
  it("measures visible pixels with transparent padding", () => {
    const alpha = new Uint8Array(8 * 8);
    alpha[2 * 8 + 3] = 255;
    alpha[4 * 8 + 5] = 255;
    expect(measureAlphaBounds(8, 8, alpha)).toEqual({
      visible: { left: 3, top: 2, right: 6, bottom: 5 },
      support: { x: 4.5, y: 5 },
    });
  });

  it("supports a frame without padding", () => {
    const result = measureAlphaBounds(4, 3, new Uint8Array(12).fill(255));
    expect(result.visible).toEqual({ left: 0, top: 0, right: 4, bottom: 3 });
    expect(result.support).toEqual({ x: 2, y: 3 });
  });

  it("rejects empty images and invalid dimensions", () => {
    expect(() => measureAlphaBounds(4, 4, new Uint8Array(16))).toThrow(/no visible pixels/);
    expect(() => measureAlphaBounds(0, 4, new Uint8Array(0))).toThrow(/positive integer/);
    expect(() => measureAlphaBounds(4, 4, new Uint8Array(15))).toThrow(/does not match/);
  });
});

describe("calibrateSprite", () => {
  it("uses visible alpha height and keeps the support point on the ground", () => {
    const result = calibrateSprite(frame(512, 512, 100, 50, 300, 450), 28, 1);
    expect(result.visibleHeight).toBe(400);
    expect(result.scale).toBeCloseTo(0.07, 10);
    expect(result.originX).toBeCloseTo(200 / 512, 10);
    expect(result.originY).toBeCloseTo(450 / 512, 10);
    expect(result.worldHeight).toBeCloseTo(28, 10);
    expect(result.screenHeight).toBeCloseTo(28, 10);
  });

  it("supports pivots near the bottom edge without adding padding", () => {
    const result = calibrateSprite(frame(128, 200, 0, 0, 128, 200), 34, 1);
    expect(result.originY).toBe(1);
    expect(result.screenHeight).toBeCloseTo(34, 10);
  });

  it.each([0.5, 1, 1.25, 2.5])("applies camera zoom %s to screen height", (zoom) => {
    const result = calibrateSprite(frame(512, 512, 50, 20, 400, 420), 28, zoom);
    expect(result.screenHeight).toBeCloseTo(28 * zoom, 10);
    expect(result.worldHeight).toBeCloseTo(28, 10);
  });

  it("rejects incompatible metadata", () => {
    expect(() => calibrateSprite(frame(100, 100, 0, 0, 101, 80), 28)).toThrow(/outside/);
    expect(() => calibrateSprite(frame(100, 100, 10, 10, 10, 80), 28)).toThrow(/empty/);
    expect(() => calibrateSprite(frame(100, 100, 0, 0, 100, 100), 0)).toThrow(/positive/);
    expect(() => calibrateSprite(frame(100, 100, 0, 0, 100, 100), 28, Number.NaN)).toThrow(/finite/);
  });
});

describe("calibrateAnimation", () => {
  it("keeps one stable scale across frames with different alpha heights", () => {
    const frames = [frame(512, 512, 100, 20, 400, 470), frame(512, 512, 90, 60, 410, 460)];
    const result = calibrateAnimation(frames, 28, 1);
    expect(result[0]!.scale).toBe(result[1]!.scale);
    expect(result[0]!.referenceVisibleHeight).toBe(450);
    expect(result[1]!.referenceVisibleHeight).toBe(450);
    expect(result[0]!.screenHeight).toBeCloseTo(28, 10);
    expect(result[1]!.screenHeight).toBeCloseTo(28 * (400 / 450), 10);
    expect(result[0]!.originY).not.toBe(result[1]!.originY);
  });

  it("rejects an empty animation", () => {
    expect(() => calibrateAnimation([], 28)).toThrow(/at least one frame/);
  });
});
