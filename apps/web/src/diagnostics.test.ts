import { describe, expect, it } from "vitest";

import {
  MAX_DIAGNOSTIC_ENTRIES,
  appendDiagnostic,
  summarizeDiagnostics,
  type DiagnosticEntry,
} from "./diagnostics";

const rejection = (id: number, code = "INSUFFICIENT_FUNDS"): DiagnosticEntry => ({
  id,
  at: id,
  level: "warning",
  category: "command",
  code,
  message: code,
});

describe("session diagnostics", () => {
  it("keeps a bounded recent history", () => {
    const entries = Array.from({ length: MAX_DIAGNOSTIC_ENTRIES + 2 }, (_, index) =>
      rejection(index),
    );
    const log = entries.reduce(appendDiagnostic, [] as DiagnosticEntry[]);
    expect(log).toHaveLength(MAX_DIAGNOSTIC_ENTRIES);
    expect(log[0]?.id).toBe(2);
  });

  it("surfaces repeated rejections as a playtest pattern", () => {
    const summary = summarizeDiagnostics([rejection(1), rejection(2), rejection(3)]);
    expect(summary.patterns).toEqual([{ code: "INSUFFICIENT_FUNDS", count: 3 }]);
  });
});
