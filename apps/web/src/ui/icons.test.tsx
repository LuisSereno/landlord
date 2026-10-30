import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildingTypeSchema } from "@landlord/shared";

import { iconCatalog, ResourceIcon, UiIcon, UI_ICON_LABELS, type UiIconName } from "./icons";
import { buildingThumbnailSource } from "./building-thumbnail";
import { BLENDER_ASSETS, PROCEDURAL_ASSETS } from "../assets/runtime-assets";

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
  it("los 15 tipos de edificio resuelven una miniatura válida desde el manifiesto", () => {
    const types = buildingTypeSchema.options;
    expect(types).toHaveLength(15);
    for (const type of types) {
      const source = buildingThumbnailSource(type);
      expect(source, type).not.toBeNull();
      /** El procedural embebe data URI; el asset de Blender se sirve desde `public/`. */
      expect(/^(data:image\/|\/assets\/)/.test(source!), type).toBe(true);
    }
  });

  it("prefiere el asset de Blender cuando lo declara y cae al procedural cuando no", () => {
    const blenderHome = BLENDER_ASSETS.buildings.courtyard_home?.states.complete?.src;
    expect(blenderHome).toBeDefined();
    expect(buildingThumbnailSource("courtyard_home")).toBe(blenderHome);
    const proceduralOnly = buildingThumbnailSource("steelworks");
    expect(proceduralOnly).toBe(PROCEDURAL_ASSETS.buildings.steelworks?.states.complete?.src);
  });

  it("un tipo desconocido no inventa imagen", () => {
    expect(buildingThumbnailSource("castillo_inexistente")).toBeNull();
  });
});
