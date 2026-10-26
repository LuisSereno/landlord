import { describe, expect, it } from "vitest";

import {
  ASSET_LICENSES,
  ATTRIBUTION_REQUIRED_LICENSES,
  assetProvenanceSchema,
  buildingAssetSchema,
  runtimeAssetManifestV1Schema,
} from "./assets";

/**
 * WP4.15-V.a 〔R1〕, D-083. Comportamiento del contrato de licencias.
 *
 * La comprobación de que estos literales coinciden con
 * `blender_artist/manifests/license-allowlist.json` vive en `scripts/check-third-party-license.mjs`
 * porque este paquete se typechea sin tipos de Node a propósito: el dominio compartido no debe
 * depender del sistema de ficheros.
 */
const completeAttribution = {
  sourceUrl: "https://github.com/microsoft/Microsoft-Rocketbox",
  licenseUrl: "https://opensource.org/licenses/MIT",
  attributionText: "Characters based on Microsoft Rocketbox (c) 2020 Microsoft",
  verifiedAt: "2026-10-26",
  licenseFileSha256: "b".repeat(64),
};

const image = (letter: string) => ({
  src: `${letter}.png`,
  width: 64,
  height: 64,
  sha256: letter.repeat(64),
});

const building = (provenance?: unknown) => ({
  type: "courtyard_home",
  name: "Casa de patio",
  footprint: { width: 2, height: 2 },
  pivot: { x: 0.5, y: 0.85 },
  states: {
    complete: image("a"),
    construction: image("b"),
    damaged: image("c"),
    burning: image("d"),
  },
  ...(provenance ? { provenance } : {}),
});

describe("licencias de assets (D-083)", () => {
  it("mantiene las licencias que exigen atribución como subconjunto de las permitidas", () => {
    for (const license of ATTRIBUTION_REQUIRED_LICENSES) {
      expect(ASSET_LICENSES).toContain(license);
    }
  });

  it("rechaza una licencia no habilitada, aunque sea permisible", () => {
    const result = assetProvenanceSchema.safeParse({ license: "CC-BY-3.0", author: "alguien" });
    expect(result.success).toBe(false);
  });

  it("rechaza una licencia con sufijo incorrecto", () => {
    expect(assetProvenanceSchema.safeParse({ license: "cc0", author: "Kenney" }).success).toBe(
      false,
    );
  });

  it("acepta CC0 sin atribución: el dominio público no la exige", () => {
    const result = assetProvenanceSchema.safeParse({
      license: "CC0-1.0",
      author: "Kenney",
      sourceId: "src_kenney_city_roads",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza MIT sin evidencia de atribución", () => {
    const result = assetProvenanceSchema.safeParse({ license: "MIT", author: "Microsoft" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["attribution"]);
    }
  });

  it("acepta MIT con la evidencia completa", () => {
    const result = assetProvenanceSchema.safeParse({
      license: "MIT",
      author: "Microsoft",
      sourceId: "src_microsoft_rocketbox",
      attribution: completeAttribution,
    });
    expect(result.success).toBe(true);
  });

  it("la procedencia puede declararse por asset, no sólo por bundle", () => {
    const result = buildingAssetSchema.safeParse(
      building({ license: "CC0-1.0", author: "Kenney", sourceId: "src_kenney_city_commercial" }),
    );
    expect(result.success).toBe(true);
  });

  it("un bundle mezclado declara CC0 en el resumen y MIT por asset", () => {
    const result = runtimeAssetManifestV1Schema.safeParse({
      schemaVersion: 1,
      generator: { id: "landlord-blender", version: 1, method: "blender_render", source: "x" },
      provenance: { license: "CC0-1.0", author: "Kenney/Quaternius" },
      buildings: { courtyard_home: building() },
      characters: {
        chr_worker: {
          id: "chr_worker",
          name: "Obrero",
          directions: 4,
          animations: {
            idle: { frameDurationMs: 400, frames: [image("e")] },
            walk: { frameDurationMs: 160, frames: [image("f")] },
          },
          provenance: {
            license: "MIT",
            author: "Microsoft",
            sourceId: "src_microsoft_rocketbox",
            attribution: completeAttribution,
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("un MIT por asset sin evidencia revienta el bundle entero", () => {
    const result = runtimeAssetManifestV1Schema.safeParse({
      schemaVersion: 1,
      generator: { id: "landlord-blender", version: 1, method: "blender_render", source: "x" },
      provenance: { license: "CC0-1.0", author: "Kenney" },
      buildings: {},
      characters: {
        chr_worker: {
          id: "chr_worker",
          name: "Obrero",
          directions: 4,
          animations: {
            idle: { frameDurationMs: 400, frames: [image("e")] },
            walk: { frameDurationMs: 160, frames: [image("f")] },
          },
          provenance: { license: "MIT", author: "Microsoft" },
        },
      },
    });
    expect(result.success).toBe(false);
  });
});
