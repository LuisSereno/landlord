import { z } from "zod";

import type { Brand } from "./primitives";

export type Tick = Brand<number, "Tick">;
export type Seed = Brand<number, "Seed">;

export type GridCell = {
  x: number;
  y: number;
};

const safeNonNegativeInteger = z
  .number()
  .refine(Number.isSafeInteger, "must be a safe integer")
  .nonnegative();

export const tickSchema = safeNonNegativeInteger.transform((value) => value as Tick);

export const seedSchema = z
  .number()
  .refine(Number.isSafeInteger, "must be a safe integer")
  .min(0)
  .max(0xffffffff)
  .transform((value) => value as Seed);

export const gridCellSchema = z.object({
  x: safeNonNegativeInteger,
  y: safeNonNegativeInteger,
});

export function parseTick(value: number): Tick {
  return tickSchema.parse(value);
}

export function parseSeed(value: number): Seed {
  return seedSchema.parse(value);
}

export function parseGridCell(value: unknown): GridCell {
  return gridCellSchema.parse(value);
}
