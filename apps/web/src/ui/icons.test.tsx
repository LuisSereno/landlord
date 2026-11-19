import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildingTypeSchema } from "@landlord/shared";

import { iconCatalog, ResourceIcon, UiIcon, UI_ICON_LABELS, type UiIconName } from "./icons";
import { buildingThumbnailSource } from "./building-thumbnail";
import { PROCEDURAL_ASSETS } from "../assets/runtime-assets";
import { BUILDING_VARIANTS } from "../assets/building-variants";

/** Conjunto mínimo del spec §7.5: si falta uno, el registro no es el contrato. */
const REQUIRED_ICONS: UiIconName[] = [
  "money",
  "income",
  "expense",
  "finance",
  "loan",
  "government",
  "ordinance",
  "tax",
  "housing",
  "industry",
  "production",
  "materials",
  "construction",
  "tenants",
  "maintenance",
  "security",
  "fire",
  "health",
  "education",
  "market",
  "insurance",
  "auction",
  "rival",
  "ownership",
  "land-value",
  "zoning",
  "services",
  "risk",
  "notifications",
  "help",
  "info",
  "warning",
  "error",
  "success",
  "navigate",
];

describe("V.d-UX · registro de iconos", () => {
  it("cubre el conjunto mínimo y cada nombre tiene etiqueta accesible", () => {
    const names = new Set(iconCatalog.map((entry) => entry.name));
    for (const required of REQUIRED_ICONS) expect(names.has(required), required).toBe(true);
    for (const entry of iconCatalog) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.label).toBe(UI_ICON_LABELS[entry.name]);
    }
  });

  it("renderiza SVG 24×24 decorativo por defecto y con nombre cuando recibe title", () => {
    const decorative = renderToStaticMarkup(<UiIcon name="money" />);
    expect(decorative).toContain('viewBox="0 0 24 24"');
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("<title>");
    const labelled = renderToStaticMarkup(<UiIcon name="government" title="Gobierno" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain("<title>Gobierno</title>");
  });

  it("los tres materiales tienen icono con nombre accesible", () => {
    for (const resource of ["cement", "brick", "steel"] as const) {
      const markup = renderToStaticMarkup(<ResourceIcon resource={resource} />);
      expect(markup).toContain("<svg");
      expect(markup).toContain("sr-only");
    }
    expect(renderToStaticMarkup(<ResourceIcon resource="brick" showLabel />)).toContain("ladrillo");
  });
});

describe("V.d-UX · miniatura de edificio", () => {
  it("los 16 tipos de edificio resuelven una miniatura válida", () => {
    const types = buildingTypeSchema.options;
    expect(types).toHaveLength(16);
    for (const type of types) {
      const source = buildingThumbnailSource(type);
      expect(source, type).not.toBeNull();
      /** El procedural embebe data URI; el asset de Blender se sirve desde `public/`. */
      expect(/^(data:image\/|\/assets\/)/.test(source!), type).toBe(true);
    }
  });

  it("prefiere la variante runtime promovida y conserva Blender/procedural como respaldo", () => {
    for (const type of buildingTypeSchema.options) {
      const variant = BUILDING_VARIANTS.variants[`${type}:complete:-:0`];
      if (type === "headquarters") {
        expect(variant, type).toBeUndefined();
        expect(buildingThumbnailSource(type), type).toBe(
          PROCEDURAL_ASSETS.buildings.courtyard_home?.states.complete?.src,
        );
        continue;
      }
      expect(variant, type).toBeDefined();
      if (!variant) throw new Error(`${type}: falta variante complete@0`);
      expect(buildingThumbnailSource(type), type).toBe(variant.image.src);
    }
    const proceduralOnly = buildingThumbnailSource("steelworks", "complete", {
      procedural: PROCEDURAL_ASSETS,
    });
    expect(proceduralOnly).toBe(PROCEDURAL_ASSETS.buildings.steelworks?.states.complete?.src);
  });

  it("un tipo desconocido no inventa imagen", () => {
    expect(buildingThumbnailSource("castillo_inexistente")).toBeNull();
  });
});
