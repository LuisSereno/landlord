import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "./generated/visual-catalog.json";
import { VisualCatalog } from "./VisualCatalog";

describe("VisualCatalog", () => {
  it("covers every building and state without duplicate hashes", () => {
    expect(catalog.buildings).toHaveLength(15);
    expect(catalog.buildings.flatMap((entry) => Object.keys(entry.states))).toHaveLength(18);
    expect(catalog.buildings.flatMap((entry) => entry.duplicateStates)).toEqual([]);
  });
  it("mounts all catalog categories and counters", () => {
    const markup = renderToStaticMarkup(<VisualCatalog />);
    expect((markup.match(/<article/g) ?? []).length).toBeGreaterThanOrEqual(43);
    expect(markup).toContain("15/15");
    expect(markup).toContain("18/60");
    expect(markup).toContain('data-testid="showcase-mount"');
  });
});
