import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseOrganizationId,
  parsePersonId,
  parseRequestId,
  parseStructureId,
} from "./primitives";

describe("opaque IDs", () => {
  it("accepts stable entity IDs with their own prefixes", () => {
    expect(parsePersonId("person_00000001")).toBe("person_00000001");
    expect(parseOrganizationId("org_00000001")).toBe("org_00000001");
    expect(parseStructureId("structure_00000001")).toBe("structure_00000001");
  });

  it("keeps transport IDs opaque without treating them as entity IDs", () => {
    expect(parseRequestId("request-17")).toBe("request-17");
    expect(parseCommandId("command-9")).toBe("command-9");
  });

  it("rejects a wrong entity prefix or malformed sequence", () => {
    expect(() => parsePersonId("org_00000001")).toThrow();
    expect(() => parsePersonId("person_1")).toThrow();
    expect(() => parsePersonId("person_00000001-extra")).toThrow();
  });
});
