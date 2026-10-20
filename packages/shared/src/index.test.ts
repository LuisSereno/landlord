import { describe, expect, it } from "vitest";

import { packageSmokeSchema, sharedPackage } from "./index";

describe("shared package", () => {
  it("validates a serializable schema at the boundary", () => {
    expect(packageSmokeSchema.parse(sharedPackage)).toBe(sharedPackage);
  });
});
