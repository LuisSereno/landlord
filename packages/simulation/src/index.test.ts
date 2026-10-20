import { describe, expect, it } from "vitest";

import { simulationPackage } from "./index";

describe("simulation package", () => {
  it("loads without browser APIs", () => {
    expect(simulationPackage).toBe("@landlord/simulation");
  });
});
