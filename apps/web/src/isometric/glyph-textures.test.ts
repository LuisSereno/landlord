import { describe, expect, it } from "vitest";

import { iconCatalog } from "../ui/icons";
import { STATUS_COLORS, type StatusTone } from "../ui/overlay-catalog";
import {
  GLYPH_TEXTURE_PX,
  cssTone,
  glyphDataUri,
  glyphInkFor,
  glyphTextureKey,
  toneHex,
} from "./glyph-textures";

const TONES = Object.keys(STATUS_COLORS) as StatusTone[];

describe("V.d-UX.S · texturas de glifo para la escena", () => {
  it("la clave es estable por glifo, tono y tamaño", () => {
    expect(glyphTextureKey("lien", "lien")).toBe(glyphTextureKey("lien", "lien"));
    expect(glyphTextureKey("lien", "lien")).not.toBe(glyphTextureKey("lien", "loss"));
    expect(glyphTextureKey("lien", "lien")).not.toBe(glyphTextureKey("auction", "lien"));
    expect(glyphTextureKey("lien", "lien", 24)).not.toBe(glyphTextureKey("lien", "lien"));
    expect(glyphTextureKey("lien", "lien")).toContain(cssTone("lien"));
  });

  it("la tinta se elige por contraste medido, no por un umbral de brillo a ojo", () => {
    expect(glyphInkFor(STATUS_COLORS.occupied)).toBe("#0c1220");
    expect(glyphInkFor(STATUS_COLORS.partial)).toBe("#0c1220");
    expect(glyphInkFor(STATUS_COLORS.arrears)).toBe("#0c1220");
    expect(glyphInkFor(STATUS_COLORS.lien)).toBe("#f7f1df");
    expect(glyphInkFor(STATUS_COLORS.loss)).toBe("#f7f1df");
    /** El violeta frío queda más cerca del claro: gana la tinta oscura (4,5:1 frente a 3,7:1). */
    expect(glyphInkFor(STATUS_COLORS.vacancy)).toBe("#0c1220");
    for (const tone of TONES) {
      const ink = glyphInkFor(toneHex(tone));
      expect(["#0c1220", "#f7f1df"], tone).toContain(ink);
    }
  });

  it("el data URI es un SVG autónomo del mismo registro que pinta la UI", () => {
    for (const entry of iconCatalog) {
      const uri = glyphDataUri(entry.name, "lien");
      expect(uri.startsWith("data:image/svg+xml;charset=utf-8,"), entry.name).toBe(true);
      const markup = decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length));
      expect(markup, entry.name).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(markup, entry.name).toContain('viewBox="0 0 24 24"');
      expect(markup, entry.name).toContain(`width="${GLYPH_TEXTURE_PX}"`);
      expect(markup, entry.name).not.toContain("currentColor");
      expect(markup, entry.name).toContain(glyphInkFor(STATUS_COLORS.lien));
    }
  });

  it("el tono viaja como color explícito, no como referencia a un estilo del DOM", () => {
    const markup = decodeURIComponent(
      glyphDataUri("auction", "loss").slice("data:image/svg+xml;charset=utf-8,".length),
    );
    expect(markup).toContain(glyphInkFor(STATUS_COLORS.loss));
    expect(cssTone("loss")).toBe("#d92d20");
  });

  it("sobre chapa oscura la tinta es clara aunque el tono pida tinta oscura", () => {
    /** El fondo de una placa es 0x10161f, no el tono: ámbar y verde pedirían tinta oscura. */
    for (const tone of ["arrears", "upgrade", "partial"] as const) {
      expect(glyphInkFor(STATUS_COLORS[tone]), tone).toBe("#0c1220");
      const uri = glyphDataUri("lien", tone, GLYPH_TEXTURE_PX, true);
      const markup = decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length));
      expect(markup, tone).toContain("#f7f1df");
      expect(markup, tone).not.toContain('stroke="#0c1220"');
      expect(glyphTextureKey("lien", tone, GLYPH_TEXTURE_PX, true)).not.toBe(
        glyphTextureKey("lien", tone),
      );
    }
  });
});