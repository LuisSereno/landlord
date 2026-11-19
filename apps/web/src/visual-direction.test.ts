import { describe, expect, it } from "vitest";

import { parseVisualDirection } from "./visual-direction";

describe("visual direction QA selector", () => {
  it("defaults to the graphic_civic control", () => {
    expect(parseVisualDirection("")).toBe("graphic_civic");
    expect(parseVisualDirection("?artQa=1&artDirection=unknown")).toBe("graphic_civic");
  });

  it("selects the material candidate from the URL without persistence", () => {
    expect(parseVisualDirection("?artQa=1&artDirection=material_maquette_candidate")).toBe(
      "material_maquette_candidate",
    );
  });
});
