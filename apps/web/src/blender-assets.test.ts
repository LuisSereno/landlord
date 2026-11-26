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
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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

  it("promueve el town_hall y el colegio con la huella física D-109 (enmienda a D-099)", () => {
    const townHall = bundle.buildings.town_hall!;
    expect(townHall.type).toBe("town_hall");
    expect(townHall.footprint).toEqual({ width: 5, height: 3 });
    expect(townHall.domainFootprint).toEqual({ width: 5, height: 3 });
    expect(townHall.allowedOrientations).toEqual([45]);
    expect(townHall.states.complete.sha256).toBe(
      "862a3c9b7ecbf467496dad11c8f3bfa0a5faa395bc6e05ae2e892a3ae6506ca8",
    );
    expect(Object.keys(townHall.states)).toEqual(["complete"]);
    expect(townHall.stateFallback).toBe("procedural");
    expect(townHall.provenance?.notes).toContain("vf_town_hall_1000");
    const school = bundle.buildings.school_block!;
    expect(school.type).toBe("school_block");
    expect(school.domainFootprint).toEqual({ width: 5, height: 1 });
    expect(school.states.complete.sha256).toBe(
      "d6945010293f250ca93c75bb23aa21f25ce82bc9e7b0d9b9e5875eac39e4f752",
    );
    expect(school.provenance?.notes).toContain("vf_school_block_1000");
  });

  it("cubre el estado complete con fallback procedural y las cuatro direcciones del personaje", () => {
    // V.i: los estados construction/damaged/burning quedan para la siguiente fase; el catálogo
    // promovido publica sólo complete y el motor cae al procedural semántico del mismo tipo.
    const states = Object.keys(bundle.buildings["courtyard_home"]!.states).sort();
    expect(states).toEqual(["complete"]);
    expect(bundle.buildings["courtyard_home"]!.stateFallback).toBe("procedural");
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
      "civilian_female_a",
      "civilian_female_b",
      "civilian_male_a",
      "civilian_male_b",
      "construction_worker_a",
      "construction_worker_b",
      "enforcer_female",
      "enforcer_male",
      "firefighter",
      "maintenance_technician",
      "medical_professional",
      "municipal_professional",
      "police",
      "supervisor",
      "vecino_variante",
    ]);
    for (const id of [
      "civilian_male_a",
      "civilian_male_b",
      "civilian_female_a",
      "civilian_female_b",
      "supervisor",
      "construction_worker_a",
      "construction_worker_b",
      "maintenance_technician",
      "enforcer_male",
      "enforcer_female",
      "police",
      "firefighter",
      "medical_professional",
      "municipal_professional",
    ]) {
      const character = bundle.characters[id]!;
      expect(character.directions).toBe(4);
      expect(character.animations.idle.frames).toHaveLength(4);
      expect(character.animations.walk.frames).toHaveLength(32);
      expect(character.provenance?.sourceId).toBe("src_kenney_mini_characters");
      expect(character.provenance?.license).toBe("CC0-1.0");
    }
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
    // V.g civic-core P7 y el entorno vivo hornean props cívicos, vegetación, perímetros y fauna.
    expect(Object.keys(bundle.props ?? {}).sort()).toEqual([
      "prp_bench",
      "prp_bollard",
      "prp_bush",
      "prp_bush_detailed",
      "prp_bush_large",
      "prp_construction_barrier",
      "prp_construction_cone",
      "prp_fence_corner",
      "prp_fence_gate",
      "prp_fence_high",
      "prp_fence_low",
      "prp_flagpole",
      "prp_flower_purple",
      "prp_flower_red",
      "prp_flower_yellow",
      "prp_grass",
      "prp_market_stall",
      "prp_monument_obelisk",
      "prp_planter_urn",
      "prp_school_playground",
      "prp_street_light",
      "prp_traffic_light",
      "prp_trash_can",
      "prp_tree_cone",
      "prp_tree_detailed",
      "prp_tree_oak",
      "prp_tree_pine",
      "prp_tree_small",
      "prp_waste_heap",
      "prp_wild_bull",
      "prp_wild_camel",
      "prp_wild_chicken_brown",
      "prp_wild_chicken_white",
      "prp_wild_duck_female",
      "prp_wild_duck_male",
      "prp_wild_goose_grey",
      "prp_wild_goose_white",
      "prp_wild_rooster",
      "prp_wild_sparrow",
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
    // V.i remediation: courtyard_home se renderiza a renderScale 2 (decisión explícita D-100).
    expect(bundle.buildings["courtyard_home"]!.pixelsPerMeter).toBe(60.2);
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
    // 81 (V.h.6) + 80 Rocketbox V.h.11 + 15 edificios Composer V.i (courtyard_home y school_block
    // incluidos vía runtime-promotions; el override manual de courtyard quedó retirado).
    // V.j.4: +18 vistas de orientación de vehículo; entorno vivo: +64 sprites;
    // patios de equipamientos (WP-D): +9 props originales (juegos, puesto, asta).
    expect(images.length).toBe(771);
    let totalBytes = 0;
    for (const image of images) {
      const buffer = readFileSync(join(PUBLIC_DIR, image.src));
      totalBytes += buffer.length;
      expect(createHash("sha256").update(buffer).digest("hex"), image.src).toBe(image.sha256);
      expect(pngSize(buffer), image.src).toEqual({ width: image.width, height: image.height });
    }
    /** Los binarios Blender de Alpha caben en el repo sin LFS: se revisa en la decisión de atlas/LFS. */
    // V.h.11: 80 frames Rocketbox nuevos (5 × 16) subieron el atlas de ~2.2 a ~4.6 MB.
    // V.i quality pass: los 15 edificios se re-renderizan a renderScale 2 (densidad x2 para zoom x4
    // nítido). El bundle runtime pasa de ~9.4 MB a ~22.7 MB medidos.
    // V.j.4 + entorno vivo: 64 sprites adicionales mantienen el atlas por debajo de 25 MiB.
    const legacyBytes = images
      .filter((image) => !image.src.startsWith("/assets/runtime/characters-kenney/"))
      .reduce((total, image) => total + readFileSync(join(PUBLIC_DIR, image.src)).length, 0);
    const kenneyImages = images.filter((image) =>
      image.src.startsWith("/assets/runtime/characters-kenney/"),
    );
    const kenneyBytes = totalBytes - legacyBytes;
    expect(kenneyImages).toHaveLength(504);
    expect(kenneyBytes).toBeLessThan(96 * 1024 * 1024);
    expect(legacyBytes).toBeLessThan(25_000_000);
    expect(totalBytes).toBeLessThan(112 * 1024 * 1024);
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

  it("los 15 complete aprobados coinciden con el baseline V.j re-congelado por D-109", () => {
    const baseline = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "docs/art/world-visual-foundation/baseline-vj.json"), "utf8"),
    ) as { buildings: { type: string; sha256: string; width: number; height: number }[] };
    expect(baseline.buildings).toHaveLength(15);
    for (const frozen of baseline.buildings) {
      const asset = bundle.buildings[frozen.type];
      expect(asset, frozen.type).toBeDefined();
      expect(asset!.states.complete!.sha256, frozen.type).toBe(frozen.sha256);
      expect(asset!.states.complete!.width, frozen.type).toBe(frozen.width);
      expect(asset!.states.complete!.height, frozen.type).toBe(frozen.height);
    }
  });
});
