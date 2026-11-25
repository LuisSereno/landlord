export type PixelBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SupportPoint = {
  x: number;
  y: number;
};

export type SpriteFrameMeasurement = {
  width: number;
  height: number;
  visible: PixelBounds;
  support: SupportPoint;
};

export type SpriteCalibration = {
  scale: number;
  originX: number;
  originY: number;
  referenceVisibleHeight: number;
  visibleHeight: number;
  worldHeight: number;
  screenHeight: number;
  cameraZoom: number;
};

const ALPHA_THRESHOLD = 2;

function assertPositiveDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

export function measureAlphaBounds(
  width: number,
  height: number,
  alpha: Uint8Array | Uint8ClampedArray,
): { visible: PixelBounds; support: SupportPoint } {
  assertPositiveDimension(width, "width");
  assertPositiveDimension(height, "height");
  if (alpha.length !== width * height) {
    throw new RangeError(`alpha length ${alpha.length} does not match ${width}×${height}`);
  }
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x]! <= ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right < 0 || bottom < 0) {
    throw new RangeError("sprite has no visible pixels above the alpha threshold");
  }
  return {
    visible: { left, top, right, bottom },
    support: { x: (left + right) / 2, y: bottom },
  };
}

export function calibrateSprite(
  frame: SpriteFrameMeasurement,
  targetWorldHeight: number,
  cameraZoom = 1,
): SpriteCalibration {
  assertPositiveDimension(frame.width, "width");
  assertPositiveDimension(frame.height, "height");
  assertFinite(targetWorldHeight, "targetWorldHeight");
  assertFinite(cameraZoom, "cameraZoom");
  if (targetWorldHeight <= 0 || cameraZoom <= 0) {
    throw new RangeError("targetWorldHeight and cameraZoom must be positive");
  }
  const { visible, support } = frame;
  for (const [label, value] of [
    ["left", visible.left],
    ["top", visible.top],
    ["right", visible.right],
    ["bottom", visible.bottom],
    ["support.x", support.x],
    ["support.y", support.y],
  ] as const) {
    assertFinite(value, label);
  }
  if (
    visible.left < 0 ||
    visible.top < 0 ||
    visible.right > frame.width ||
    visible.bottom > frame.height ||
    visible.right <= visible.left ||
    visible.bottom <= visible.top
  ) {
    throw new RangeError("visible bounds are empty or outside the source frame");
  }
  if (
    support.x < visible.left ||
    support.x > visible.right ||
    support.y < visible.top ||
    support.y > visible.bottom
  ) {
    throw new RangeError("support point must lie inside the visible bounds");
  }
  const visibleHeight = visible.bottom - visible.top;
  const scale = targetWorldHeight / visibleHeight;
  return {
    scale,
    originX: support.x / frame.width,
    originY: support.y / frame.height,
    referenceVisibleHeight: visibleHeight,
    visibleHeight,
    worldHeight: visibleHeight * scale,
    screenHeight: visibleHeight * scale * cameraZoom,
    cameraZoom,
  };
}

export function calibrateAnimation(
  frames: readonly SpriteFrameMeasurement[],
  targetWorldHeight: number,
  cameraZoom = 1,
): SpriteCalibration[] {
  if (frames.length === 0) {
    throw new RangeError("animation needs at least one frame");
  }
  assertFinite(targetWorldHeight, "targetWorldHeight");
  assertFinite(cameraZoom, "cameraZoom");
  if (targetWorldHeight <= 0 || cameraZoom <= 0) {
    throw new RangeError("targetWorldHeight and cameraZoom must be positive");
  }
  const heights = frames.map((frame) => {
    const calibration = calibrateSprite(frame, targetWorldHeight, cameraZoom);
    return calibration.visibleHeight;
  });
  const referenceVisibleHeight = Math.max(...heights);
  return frames.map((frame, index) => ({
    ...calibrateSprite(frame, targetWorldHeight, cameraZoom),
    scale: targetWorldHeight / referenceVisibleHeight,
    referenceVisibleHeight,
    worldHeight: heights[index]! * (targetWorldHeight / referenceVisibleHeight),
    screenHeight: heights[index]! * (targetWorldHeight / referenceVisibleHeight) * cameraZoom,
  }));
}
