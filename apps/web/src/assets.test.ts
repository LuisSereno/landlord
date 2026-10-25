import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BUILDING_ASSET_STATES,
  runtimeAssetManifestV1Schema,
  type RuntimeAssetManifestV1,
} from "@landlord/shared";

const manifestPath = new URL("./generated/runtime-assets.json", import.meta.url);
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RuntimeAssetManifestV1;

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
  it("cumple el esquema v1 y declara generador y provenance", () => {
    expect(() => runtimeAssetManifestV1Schema.parse(manifest)).not.toThrow();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generator.method).toBe("procedural_svg");
    expect(manifest.generator.source).toBe("scripts/generate-runtime-assets.mjs");
    expect(manifest.provenance.license).toBe("original");
  });

  it("cubre los cinco edificios con los cuatro estados y hashes íntegros", () => {
    expect(Object.keys(manifest.buildings).sort()).toEqual(
      ["brickworks", "cement_plant", "courtyard_home", "steelworks", "workshop"].sort(),
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
