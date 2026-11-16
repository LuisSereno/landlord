import { describe, expect, it } from "vitest";

import { iconCatalog } from "./icons";
import { OVERLAY_GROUP_ICONS } from "./game-hud";
import {
  CODE_PALETTE,
  MAP_COLORS,
  OVERLAY_GROUPS,
  OVERLAY_OPTIONS,
  ROLE_COLORS,
  STATUS_COLORS,
  USE_COLORS,
  ZONING_COLORS,
  cssColor,
  overlayOption,
  type MapOverlay,
} from "./overlay-catalog";

/**
 * V.d-UX.S · contrato del catálogo de capas (spec §14). Antes no había ningún test: una capa nueva
 * sin leyenda, sin icono o con un color inventado pasaba desapercibida, y la escena caía en el
 * coloreado de propiedad sin avisar. Aquí se exige que toda capa declarada sea presentable.
 */
const PALETTE = new Set<string>(
  [
    ...Object.values(MAP_COLORS),
    ...Object.values(ZONING_COLORS),
    ...Object.values(USE_COLORS),
    ...Object.values(ROLE_COLORS),
    ...Object.values(STATUS_COLORS),
    ...CODE_PALETTE,
  ].map((value) => cssColor(value as number)),
);

const ICON_NAMES = new Set(iconCatalog.map((entry) => entry.name));

describe("V.d-UX.S · catálogo de capas del mapa", () => {
  it("toda capa tiene entrada única, grupo válido, icono del registro y textos", () => {
    const values = OVERLAY_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    const groups = new Set(OVERLAY_GROUPS.map((group) => group.id));
    for (const option of OVERLAY_OPTIONS) {
      expect(groups.has(option.group), option.value).toBe(true);
      expect(ICON_NAMES.has(option.icon), option.value).toBe(true);
      expect(option.label.length, option.value).toBeGreaterThan(0);
      expect(option.description.length, option.value).toBeGreaterThan(10);
    }
  });

  it("todo grupo declarado tiene icono en la toolbar", () => {
    for (const group of OVERLAY_GROUPS) {
      expect(OVERLAY_GROUP_ICONS[group.id], group.id).toBeDefined();
      expect(ICON_NAMES.has(OVERLAY_GROUP_ICONS[group.id]), group.id).toBe(true);
    }
  });

  it("toda capa semántica tiene leyenda con color de la paleta; las de bandas, al menos dos", () => {
    /**
     * `developmentCode` es categórica: siete códigos y una muestra representativa, no bandas
     * ordenadas. Se nombra la excepción en vez de relajar la regla para todas las capas.
     */
    const categorical = new Set<MapOverlay>(["developmentCode"]);
    for (const option of OVERLAY_OPTIONS) {
      if (option.value === "none") {
        expect(option.legend).toEqual([]);
        continue;
      }
      const minimum = categorical.has(option.value) ? 1 : 2;
      expect(option.legend.length, option.value).toBeGreaterThanOrEqual(minimum);
      for (const entry of option.legend) {
        expect(entry.label.length, option.value).toBeGreaterThan(0);
        expect(PALETTE.has(entry.color), `${option.value}: ${entry.color}`).toBe(true);
      }
    }
  });

  it("los tonos de estado son distintos entre sí y no reutilizan un hex ambiguo", () => {
    const values = Object.values(STATUS_COLORS);
    expect(new Set(values).size).toBe(values.length);
    /** «Sin datos» y «solar sin edificio» se separan por luminancia, no sólo por matiz. */
    expect(STATUS_COLORS.unknown).not.toBe(STATUS_COLORS.neutral);
    expect(STATUS_COLORS.loss).not.toBe(STATUS_COLORS.fire);
    expect(STATUS_COLORS.lien).not.toBe(STATUS_COLORS.opportunity);
  });

  it("las tres capas de estado del activo existen con su leyenda completa", () => {
    const expected: Array<[MapOverlay, number]> = [
      ["encumbrances", 6],
      ["occupancy", 6],
      ["insurance", 4],
    ];
    for (const [value, bands] of expected) {
      const option = overlayOption(value);
      expect(option.value, value).toBe(value);
      expect(option.group, value).toBe("status");
      expect(option.legend.length, value).toBe(bands);
    }
    /** La vista normal sigue siendo el fallback del selector. */
    expect(overlayOption("no-existe" as MapOverlay).value).toBe("none");
  });

  it("la capa de cargas distingue la oportunidad de la pérdida y reserva el rojo a la crisis", () => {
    const legend = overlayOption("encumbrances").legend;
    const byLabel = new Map(legend.map((entry) => [entry.label, entry.color]));
    expect(byLabel.get("Impagada o en subasta")).toBe(cssColor(STATUS_COLORS.loss));
    expect(byLabel.get("Puja en subasta ajena")).toBe(cssColor(STATUS_COLORS.opportunity));
    expect(byLabel.get("Hipoteca al día")).toBe(cssColor(STATUS_COLORS.lien));
    expect(byLabel.get("En atraso")).toBe(cssColor(STATUS_COLORS.arrears));
  });
});