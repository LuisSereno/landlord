import { z } from "zod";

import type { Brand } from "./primitives";

export type Money = Brand<number, "Money">;

export const moneySchema = z
  .number()
  .refine(Number.isSafeInteger, "money must be a safe integer")
  .nonnegative()
  .transform((value) => value as Money);

export type MoneyOperationResult =
  { ok: true; value: Money } | { ok: false; code: "INSUFFICIENT_FUNDS" | "OVERFLOW" };

export function parseMoney(value: number): Money {
  return moneySchema.parse(value);
}

export function addMoney(left: Money, right: Money): MoneyOperationResult {
  const value = left + right;
  if (!Number.isSafeInteger(value)) return { ok: false, code: "OVERFLOW" };
  return { ok: true, value: value as Money };
}

export function subtractMoney(left: Money, right: Money): MoneyOperationResult {
  const value = left - right;
  if (value < 0) return { ok: false, code: "INSUFFICIENT_FUNDS" };
  if (!Number.isSafeInteger(value)) return { ok: false, code: "OVERFLOW" };
  return { ok: true, value: value as Money };
}
