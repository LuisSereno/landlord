import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRuntimeAssetManifest,
  runtimeAssetManifestV2Schema,
  validateRuntimeAssetManifestV2,
  type RuntimeAssetManifestV2,
} from "@landlord/shared";
import blenderBundle from "./generated/runtime-assets-blender.json";

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Medidas declaradas en el IHDR del PNG: no hace falta decodificar la imagen. */
function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("WP4.15-H ruta Blender E2E", () => {
  const bundle = blenderBundle as unknown as RuntimeAssetManifestV2;

  it("el bundle generado por Blender cumple el contrato runtime V2", () => {
    const parsed = runtimeAssetManifestV2Schema.safeParse(bundle);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
    expect(bundle.generator.method).toBe("blender_render");
    expect(bundle.buildings["courtyard_home"]!.states).toHaveProperty("complete");
    expect(bundle.buildings["bld_shopfront"]!.states).toHaveProperty("complete");
    expect(bundle.characters["vecino_variante"]!.directions).toBe(4);
  });

  it("el bundle entra por el parser único y valida como V2", () => {
    const parsedBundle = parseRuntimeAssetManifest(blenderBundle);
    expect(parsedBundle.schemaVersion).toBe(2);
    expect(validateRuntimeAssetManifestV2(parsedBundle)).toEqual([]);
    for (const [id, asset] of Object.entries(parsedBundle.buildings)) {
      expect(asset.allowedOrientations).toEqual([45]);
      if (id !== "town_hall") expect(asset.domainFootprint).toEqual(asset.footprint);
    }
  });

  it("promueve el town_hall V7 elegido y conserva el candidato anterior como school_block", () => {
    const townHall = bundle.buildings.town_hall!;
    expect(townHall.type).toBe("town_hall");
    expect(townHall.footprint).toEqual({ width: 8, height: 4 });
    expect(townHall.domainFootprint).toEqual({ width: 8, height: 4 });
    expect(townHall.allowedOrientations).toEqual([45]);
    expect(townHall.states.complete.sha256).toBe(
      "426a25e6a83a5bacd03b7d0354dde238fa0d26f936b0f1c758fa8c11db46dde7",
    );
    expect(Object.keys(townHall.states)).toEqual(["complete"]);
    expect(townHall.stateFallback).toBe("procedural");
    expect(townHall.provenance?.notes).toContain("vf_town_hall_1006");
    const school = bundle.buildings.school_block!;
    expect(school.type).toBe("school_block");
    expect(school.domainFootprint).toEqual({ width: 8, height: 4 });
    expect(school.states.complete.sha256).toBe(
      "4d83edc33cb948eada9ac69ee48fdfbbe9d4af628e80209b5a140c32a05e0495",
    );
    expect(school.provenance?.notes).toContain("vf_town_hall_1002");
  });

  it("cubre los cuatro estados del edificio y las cuatro direcciones del personaje", () => {
    const states = Object.keys(bundle.buildings["courtyard_home"]!.states).sort();
    expect(states).toEqual(["burning", "complete", "construction", "damaged"]);
    const character = bundle.characters["vecino_variante"]!;
    for (const animation of ["idle", "walk"] as const) {
      expect(character.animations[animation].frames).toHaveLength(character.directions * 2);
      for (const frame of character.animations[animation].frames) expect(frame).toBeTruthy();
    }
    // V.h.11: los actores del juego son avatares Rocketbox horneados (retarget de clips idle/walk).
    expect(Object.keys(bundle.characters).sort()).toEqual([
      "chr_citizen",
      "chr_firefighter",
      "chr_medical",
      "chr_police",
      "chr_worker",
      "vecino_variante",
    ]);
    for (const id of [
      "chr_citizen",
      "chr_police",
      "chr_medical",
      "chr_firefighter",
      "chr_worker",
    ]) {
      const avatar = bundle.characters[id]!;
      expect(avatar.directions).toBe(4);
      // idle y walk deben ser clips DISTINTOS (hashes distintos): no metadata falsa de animación.
      const idle0 = avatar.animations.idle.frames[0]!;
      const walk0 = avatar.animations.walk.frames[0]!;
      expect(idle0.sha256).not.toBe(walk0.sha256);
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
    // V.g civic-core P7 horneó 4 props cívicos (monumento, jardinera, bolardo, arbusto) en el atlas.
    expect(Object.keys(bundle.props ?? {}).sort()).toEqual([
      "prp_bench",
      "prp_bollard",
      "prp_bush",
      "prp_construction_barrier",
      "prp_construction_cone",
      "prp_monument_obelisk",
      "prp_planter_urn",
      "prp_street_light",
      "prp_traffic_light",
      "prp_trash_can",
      "prp_tree_detailed",
      "prp_tree_oak",
      "prp_tree_pine",
    ]);
    // V.h.6: 9 vehículos (3 originales + 6 contextuales horneados para dressing por edificio).
    expect(Object.keys(bundle.vehicles ?? {}).sort()).toEqual([
      "veh_ambulance",
      "veh_delivery",
      "veh_firetruck",
      "veh_garbage",
      "veh_police",
      "veh_sedan",
      "veh_taxi",
      "veh_tractor",
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
    // 81 (V.h.6) + 80 Rocketbox V.h.11 + town_hall + school_block V7 + row_house/apartment_block/
    // mixed_tenement V.i + workshop/warehouse V.i promovidos.
    expect(images.length).toBe(168);
    let totalBytes = 0;
    for (const image of images) {
      const buffer = readFileSync(join(PUBLIC_DIR, image.src));
      totalBytes += buffer.length;
      expect(createHash("sha256").update(buffer).digest("hex"), image.src).toBe(image.sha256);
      expect(pngSize(buffer), image.src).toEqual({ width: image.width, height: image.height });
    }
    /** Los binarios Blender de Alpha caben en el repo sin LFS: se revisa en la decisión de atlas/LFS. */
    // V.h.11: 80 frames Rocketbox nuevos (5 × 16) subieron el atlas de ~2.2 a ~4.6 MB.
    // V.i: cada edificio Composer promovido copia el PNG del candidato a resolución de render
    // completa (p.ej. apartment_block 615×855), así que el atlas crece ~0.5 MB por edificio. Con
    // 6 edificios promovidos el atlas está en ~7.2 MB. El umbral se sube a 10 MB para admitir el
    // lote residencial; sigue muy por debajo de lo que obligaría a LFS. FIX CORRECTO PENDIENTE (P2):
    // reducir el runtimeImage al footprint real en vez de copiar el candidato entero, antes de
    // cerrar los 15/15 (volverá a tocar el techo con los lotes industrial y cívico).
    expect(totalBytes).toBeLessThan(10_000_000);
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
