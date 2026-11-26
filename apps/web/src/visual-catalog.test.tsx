import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "./generated/visual-catalog.json";
import { VisualCatalog } from "./VisualCatalog";

describe("VisualCatalog", () => {
  const characterCount = catalog.characters.length;
  const buildingCount = catalog.buildings.length;
  const buildingStateCount = catalog.buildings.flatMap((entry) => Object.keys(entry.states)).length;

  it("covers every building and state without duplicate hashes", () => {
    expect(buildingCount).toBe(17);
    expect(catalog.coverage.buildings).toBe(`${buildingCount}/${buildingCount}`);
    expect(catalog.coverage.buildingStates).toBe(`${buildingStateCount}/${buildingCount * 6}`);
    expect(catalog.buildings.flatMap((entry) => entry.duplicateStates)).toEqual([]);
  });
  it("mounts all catalog categories and counters", () => {
    const markup = renderToStaticMarkup(<VisualCatalog />);
    expect(characterCount).toBe(14);
    expect((markup.match(/<article/g) ?? []).length).toBeGreaterThanOrEqual(44);
    expect(markup).toContain(`${buildingCount}/${buildingCount}`);
    expect(markup).toContain(`${buildingStateCount}/${buildingCount * 6}`);
    expect(markup).toContain(`${characterCount}/${characterCount}`);
    expect(markup).toContain(`${characterCount}/${characterCount}`);
    expect(markup).toContain("Approved Kenney runtime sprites");
    expect(markup).toContain('data-testid="showcase-mount"');
  });
});
