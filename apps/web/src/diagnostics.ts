import type { ErrorCode } from "@landlord/shared";

export const MAX_DIAGNOSTIC_ENTRIES = 120;

export type DiagnosticEntry = {
  id: number;
  at: number;
  level: "info" | "warning" | "error";
  category: "command" | "worker" | "transport";
  code: string;
  message: string;
};

export function appendDiagnostic(
  entries: readonly DiagnosticEntry[],
  entry: DiagnosticEntry,
): DiagnosticEntry[] {
  return [...entries, entry].slice(-MAX_DIAGNOSTIC_ENTRIES);
}

export function summarizeDiagnostics(entries: readonly DiagnosticEntry[]) {
  const rejections = new Map<ErrorCode, number>();
  let errors = 0;
  for (const entry of entries) {
    if (entry.level === "error") errors += 1;
    if (entry.category === "command" && entry.level === "warning") {
      const code = entry.code as ErrorCode;
      rejections.set(code, (rejections.get(code) ?? 0) + 1);
    }
  }
  const patterns = [...rejections.entries()]
    .filter(([, count]) => count >= 3)
    .map(([code, count]) => ({ code, count }));
  return { errors, rejections: [...rejections.entries()], patterns };
}
