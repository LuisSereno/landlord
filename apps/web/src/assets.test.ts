import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BUILDING_ASSET_STATES,
  buildingFrameForOrientation,
  parseRuntimeAssetManifest,
  runtimeAssetManifestV2Schema,
  validateRuntimeAssetManifestV2,
  type RuntimeAssetManifestV1,
  type RuntimeAssetManifestV2,
} from "@landlord/shared";
import { BUILDING_DEFINITIONS } from "@landlord/simulation";

const manifestPath = new URL("./generated/runtime-assets.json", import.meta.url);
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const manifest = parseRuntimeAssetManifest(rawManifest) as RuntimeAssetManifestV2;

function decodedSvg(src: string): string {
  const prefix = "data:image/svg+xml;base64,";
  expect(src.startsWith(prefix)).toBe(true);
  return Buffer.from(src.slice(prefix.length), "base64").toString("utf8");
}

function expectHashed(src: string, sha256: string): void {
  const content = decodedSvg(src);
  expect(createHash("sha256").update(content).digest("hex")).toBe(sha256);
  expect(content).toContain("<svg");
}

describe("WP4.15 manifiesto de assets runtime", () => {
  it("cumple el esquema V2 y declara generador y provenance", () => {
    expect(() => runtimeAssetManifestV2Schema.parse(rawManifest)).not.toThrow();
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.generator.method).toBe("procedural_svg");
    expect(manifest.generator.version).toBe(2);
    expect(manifest.generator.source).toBe("scripts/generate-runtime-assets.mjs");
    expect(manifest.provenance.license).toBe("original");
    /** Contrato V2: ningún issue de validación en el bundle versionado. */
    expect(validateRuntimeAssetManifestV2(manifest)).toEqual([]);
  });

  it("declara la huella de dominio del tipo que representa el dibujo", () => {
    for (const [type, asset] of Object.entries(manifest.buildings)) {
      expect(asset.domainFootprint.width, type).toBeGreaterThanOrEqual(asset.footprint.width);
      expect(asset.domainFootprint.height, type).toBeGreaterThanOrEqual(asset.footprint.height);
      const definition = (BUILDING_DEFINITIONS as Record<string, { targetFootprintCells: number }>)[
        type
      ];
      if (!definition) continue;
      expect(
        asset.domainFootprint.width * asset.domainFootprint.height,
        `${type}: la huella de dominio debe cuadrar con targetFootprintCells`,
      ).toBe(definition.targetFootprintCells);
    }
  });

  it("el runtime no puede inventar una orientación ilegal", () => {
    const asset = manifest.buildings.courtyard_home!;
    expect(asset.allowedOrientations).toEqual([45]);
    expect(asset.symmetry).toBe("none");
    expect(buildingFrameForOrientation(asset, 45)).not.toBeNull();
    for (const azimuth of [135, 225, 315])
      expect(buildingFrameForOrientation(asset, azimuth), `azimut ${String(azimuth)}`).toBeNull();
  });

  it("un manifiesto V1 se convierte de forma explícita y determinista", () => {
    const legacy: RuntimeAssetManifestV1 = {
      ...manifest,
      schemaVersion: 1,
      buildings: Object.fromEntries(
        Object.entries(manifest.buildings).map(([key, asset]) => {
          const copy: Record<string, unknown> = { ...asset };
          delete copy.domainFootprint;
          delete copy.allowedOrientations;
          delete copy.symmetry;
          return [key, copy];
        }),
      ),
    } as unknown as RuntimeAssetManifestV1;
    const converted = parseRuntimeAssetManifest(legacy);
    expect(converted.schemaVersion).toBe(2);
    /** Un V1 sólo se dibujó de frente: eso es lo único que se le puede garantizar. */
    for (const asset of Object.values(converted.buildings)) {
      expect(asset.allowedOrientations).toEqual([45]);
      expect(asset.symmetry).toBe("none");
      expect(asset.domainFootprint).toEqual(asset.footprint);
    }
    expect(parseRuntimeAssetManifest(legacy)).toEqual(converted);
    expect(validateRuntimeAssetManifestV2(converted)).toEqual([]);
    /** Una versión desconocida es un error, no una rama por defecto. */
    expect(() => parseRuntimeAssetManifest({ ...manifest, schemaVersion: 3 })).toThrow(
      /RUNTIME_ASSET_MANIFEST_VERSION/,
    );
  });

  it("cubre los edificios base y cívicos con los cuatro estados y hashes íntegros", () => {
    expect(Object.keys(manifest.buildings).sort()).toEqual(
      [
        "brickworks",
        "cement_plant",
        "clinic",
        "courtyard_home",
        "fire_station",
        "market_hall",
        "police_station",
        "school_block",
        "steelworks",
        "town_hall",
        "workshop",
      ].sort(),
    );
    for (const [type, asset] of Object.entries(manifest.buildings)) {
      expect(asset.type, type).toBe(type);
      expect(asset.footprint.width, type).toBeGreaterThan(0);
      expect(asset.footprint.height, type).toBeGreaterThan(0);
      expect(asset.pivot.x, type).toBeGreaterThanOrEqual(0);
      expect(asset.pivot.x, type).toBeLessThanOrEqual(1);
      expect(asset.pivot.y, type).toBeGreaterThanOrEqual(0);
      expect(asset.pivot.y, type).toBeLessThanOrEqual(1);
      for (const state of BUILDING_ASSET_STATES) {
        const image = asset.states[state];
        expect(image, `${type}:${state}`).toBeDefined();
        expectHashed(image.src, image.sha256);
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
      }
    }
  });

  it("integra dos variantes de personaje con 8 y 4 direcciones y frames animados", () => {
    const characters = Object.values(manifest.characters);
    expect(characters).toHaveLength(2);
    expect(characters.map((entry) => entry.directions).sort()).toEqual([4, 8]);
    for (const character of characters) {
      for (const animation of ["idle", "walk"] as const) {
        const { frames, frameDurationMs } = character.animations[animation];
        expect(frameDurationMs, `${character.id}:${animation}`).toBeGreaterThan(0);
        expect(frames).toHaveLength(character.directions * 2);
        for (const frame of frames) expectHashed(frame.src, frame.sha256);
      }
    }
  });

  it("la factoría es determinista y el manifiesto versionado no tiene ediciones manuales", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/generate-runtime-assets.mjs", "--check"], {
        cwd: repoRoot,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("respeta el budget de contenido de Alpha", () => {
    const raw = readFileSync(manifestPath, "utf8");
    /** Budget Alpha: el manifiesto completo debe caber en un chunk pequeño y cada SVG ser barato. */
    expect(Buffer.byteLength(raw)).toBeLessThan(200_000);
    for (const [type, asset] of Object.entries(manifest.buildings)) {
      for (const state of BUILDING_ASSET_STATES) {
        const svg = decodedSvg(asset.states[state].src);
        expect(Buffer.byteLength(svg), `${type}:${state}`).toBeLessThan(8_192);
      }
    }
    for (const character of Object.values(manifest.characters)) {
      for (const animation of ["idle", "walk"] as const) {
        for (const frame of character.animations[animation].frames) {
          expect(Buffer.byteLength(decodedSvg(frame.src)), character.id).toBeLessThan(8_192);
        }
      }
    }
  });
});
