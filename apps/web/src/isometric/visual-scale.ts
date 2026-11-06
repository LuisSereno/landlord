/** Physical presentation contracts introduced by V.h visual remediation. */
export const CHARACTER_SOURCE_FRAME_PIXELS = 256;
export const CHARACTER_TARGET_HEIGHT_PIXELS = 28;
export const CHARACTER_RENDER_SCALE =
  CHARACTER_TARGET_HEIGHT_PIXELS / CHARACTER_SOURCE_FRAME_PIXELS;

export function vehicleScreenRotation(azimuth: 45 | 135 | 225 | 315): number {
  if (azimuth === 135) return Math.PI / 2;
  if (azimuth === 315) return -Math.PI / 2;
  return 0;
}
