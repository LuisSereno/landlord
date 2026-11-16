import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { glyphSvgMarkup, iconCatalog, UiIcon, type UiIconName } from "./icons";

/**
 * V.d-UX.S · paridad del registro de iconos. El fixture se capturó con la implementación JSX
 * ANTES de convertir el registro a primitivas serializables: cualquier deriva visual en la
 * conversión rompe este test byte a byte. No se regenera sin un cambio deliberado documentado.
 */
const fixture = JSON.parse(
  readFileSync(new URL("./icon-parity.fixture.json", import.meta.url), "utf8"),
) as Record<string, string>;

const NEW_GLYPHS: UiIconName[] = ["lien", "vacancy", "demolition"];

describe("V.d-UX.S · paridad del registro de iconos", () => {
  it("los iconos existentes renderizan exactamente el markup comprometido", () => {
    const names = Object.keys(fixture);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) {
      expect(renderToStaticMarkup(<UiIcon name={name as UiIconName} />), name).toBe(fixture[name]);
    }
  });

  it("el catálogo cubre el fixture más los glifos nuevos de estado", () => {
    const catalog = new Set(iconCatalog.map((entry) => entry.name));
    for (const name of Object.keys(fixture)) expect(catalog.has(name as UiIconName), name).toBe(true);
    for (const name of NEW_GLYPHS) expect(catalog.has(name), name).toBe(true);
    expect(catalog.size).toBe(Object.keys(fixture).length + NEW_GLYPHS.length);
  });

  it("el tono explícito sólo cambia el trazo, no la geometría", () => {
    const markup = renderToStaticMarkup(<UiIcon name="loan" color="#3f5f9f" />);
    expect(markup).toBe(fixture.loan!.replace('stroke="currentColor"', 'stroke="#3f5f9f"'));
  });
});

describe("V.d-UX.S · markup serializable para la escena", () => {
  it("produce un SVG autónomo con el tono pedido y la misma geometría que el componente", () => {
    for (const entry of iconCatalog) {
      const markup = glyphSvgMarkup(entry.name, { size: 48, stroke: "#f7f1df" });
      expect(markup, entry.name).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(markup, entry.name).toContain('viewBox="0 0 24 24"');
      expect(markup, entry.name).toContain('stroke="#f7f1df"');
      expect(markup, entry.name).not.toContain("currentColor");
      const shapes = (markup.match(/<(path|rect|circle)\b/g) ?? []).length;
      const reactShapes = (
        renderToStaticMarkup(<UiIcon name={entry.name} />).match(/<(path|rect|circle)\b/g) ?? []
      ).length;
      expect(shapes, entry.name).toBe(reactShapes);
      expect(shapes, entry.name).toBeGreaterThan(0);
    }
  });

  it("conserva el trazo discontinuo donde el registro lo declara", () => {
    expect(glyphSvgMarkup("illegal-route", { size: 24, stroke: "#fff" })).toContain(
      'stroke-dasharray="2.5 2.5"',
    );
  });

  it("escapa el tono para que no pueda romper el atributo", () => {
    const markup = glyphSvgMarkup("lien", { size: 24, stroke: '#fff" onload="alert(1)' });
    expect(markup).not.toContain('onload="alert(1)"');
    expect(markup).toContain("&quot;");
  });
});