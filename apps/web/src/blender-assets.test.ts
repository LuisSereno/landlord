import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeAssetManifestV1Schema, type RuntimeAssetManifestV1 } from "@landlord/shared";
import blenderBundle from "./generated/runtime-assets-blender.json";

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Medidas declaradas en el IHDR del PNG: no hace falta decodificar la imagen. */
function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("WP4.15-H ruta Blender E2E", () => {
  const bundle = blenderBundle as unknown as RuntimeAssetManifestV1;

  it("el bundle generado por Blender cumple el contrato runtime v1", () => {
    const parsed = runtimeAssetManifestV1Schema.safeParse(bundle);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
    expect(bundle.generator.method).toBe("blender_render");
    expect(bundle.buildings["courtyard_home"]!.states).toHaveProperty("complete");
    expect(bundle.buildings["bld_shopfront"]!.states).toHaveProperty("complete");
    expect(bundle.characters["vecino_variante"]!.directions).toBe(4);
  });

  it("cubre los cuatro estados del edificio y las cuatro direcciones del personaje", () => {
    const states = Object.keys(bundle.buildings["courtyard_home"]!.states).sort();
    expect(states).toEqual(["burning", "complete", "construction", "damaged"]);
    const character = bundle.characters["vecino_variante"]!;
    for (const animation of ["idle", "walk"] as const) {
      expect(character.animations[animation].frames).toHaveLength(character.directions * 2);
      for (const frame of character.animations[animation].frames) expect(frame).toBeTruthy();
    }
  });

  it("publica terrain, props y vehicles y declara su densidad de render", () => {
    expect(Object.keys(bundle.terrain ?? {}).sort()).toEqual([
      "ter_lot_dirt_a",
      "ter_lot_dirt_b",
      "ter_road_corner",
      "ter_road_intersection",
      "ter_road_straight",
    ]);
    expect(Object.keys(bundle.props ?? {})).toHaveLength(9);
    expect(Object.keys(bundle.vehicles ?? {}).sort()).toEqual([
      "veh_sedan",
      "veh_taxi",
      "veh_truck",
    ]);
    for (const group of [bundle.terrain, bundle.props, bundle.vehicles]) {
      for (const asset of Object.values(group ?? {})) {
        if (!asset.id.startsWith("ter_lot_dirt")) {
          expect(asset.pixelsPerMeter, asset.id).toBeGreaterThan(0);
        }
        expect(asset.image.width).toBeGreaterThan(0);
      }
    }
    // El terreno procedural se dibuja a escala de juego: la loseta mide exactamente una celda.
    expect(bundle.terrain!["ter_lot_dirt_a"]!.image).toMatchObject({ width: 64, height: 32 });
    expect(bundle.terrain!["ter_lot_dirt_a"]!.pixelsPerMeter).toBeUndefined();
    // El asset procedural ya está dibujado a escala de juego: no debe declarar densidad.
    expect(bundle.buildings["courtyard_home"]!.pixelsPerMeter).toBeUndefined();
    expect(bundle.buildings["bld_shopfront"]!.pixelsPerMeter).toBeGreaterThan(0);
  });

  it("publica la orientación 225 de semáforo y vehículos sin duplicar el frame base", () => {
    for (const id of ["prp_traffic_light"]) {
      expect(bundle.props![id]!.orientations?.["225"]?.image).toBeDefined();
    }
    for (const id of ["veh_sedan", "veh_taxi", "veh_truck"]) {
      expect(bundle.vehicles![id]!.orientations?.["225"]?.image).toBeDefined();
      expect(bundle.vehicles![id]!.orientations?.["225"]?.pivot).toBeDefined();
    }
  });

  it("cada imagen publicada existe, y su hash y sus medidas coinciden con el manifiesto", () => {
    const images = [
      ...Object.values(bundle.buildings).flatMap((asset) => Object.values(asset.states)),
      ...Object.values(bundle.characters).flatMap((character) =>
        Object.values(character.animations).flatMap((animation) => animation.frames),
      ),
      ...Object.values(bundle.terrain ?? {}).flatMap((asset) => [
        asset.image,
        ...Object.values(asset.orientations ?? {}).map((frame) => frame.image),
      ]),
      ...Object.values(bundle.props ?? {}).flatMap((asset) => [
        asset.image,
        ...Object.values(asset.orientations ?? {}).map((frame) => frame.image),
      ]),
      ...Object.values(bundle.vehicles ?? {}).flatMap((asset) => [
        asset.image,
        ...Object.values(asset.orientations ?? {}).map((frame) => frame.image),
      ]),
    ];
    expect(images.length).toBe(65);
    let totalBytes = 0;
    for (const image of images) {
      const buffer = readFileSync(join(PUBLIC_DIR, image.src));
      totalBytes += buffer.length;
      expect(createHash("sha256").update(buffer).digest("hex"), image.src).toBe(image.sha256);
      expect(pngSize(buffer), image.src).toEqual({ width: image.width, height: image.height });
    }
    /** Los binarios Blender de Alpha caben en el repo sin LFS: se revisa en la decisión de atlas/LFS. */
    expect(totalBytes).toBeLessThan(2_500_000);
  });

  it("el pivote queda dentro de la imagen recortada y la huella es positiva", () => {
    for (const asset of [
      ...Object.values(bundle.buildings),
      ...Object.values(bundle.terrain ?? {}),
      ...Object.values(bundle.props ?? {}),
      ...Object.values(bundle.vehicles ?? {}),
    ]) {
      expect(asset.pivot.x).toBeGreaterThanOrEqual(0);
      expect(asset.pivot.x).toBeLessThanOrEqual(1);
      expect(asset.pivot.y).toBeGreaterThanOrEqual(0.5);
      expect(asset.footprint.width).toBeGreaterThan(0);
      expect(asset.footprint.height).toBeGreaterThan(0);
    }
  });
});
