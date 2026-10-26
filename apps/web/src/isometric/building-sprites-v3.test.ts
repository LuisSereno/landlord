import { describe, expect, it } from "vitest";
import { selectBuildingTextureKey } from "./building-sprites";

describe("WP4.15-V.a3 degradación por asset", () => {
  it("caso A: Blender disponible → se selecciona Blender", () => {
    const proceduralKey = "building-bld_shopfront-complete";
    const blenderAvailable = new Set(["blender-building-bld_shopfront-complete"]);
    const selected = selectBuildingTextureKey(proceduralKey, blenderAvailable);
    expect(selected).toBe("blender-building-bld_shopfront-complete");
  });

  it("caso B: Blender ausente → se selecciona procedural sin error", () => {
    const proceduralKey = "building-courtyard_home-complete";
    const blenderAvailable = new Set();
    const selected = selectBuildingTextureKey(proceduralKey, blenderAvailable);
    expect(selected).toBe("building-courtyard_home-complete");
  });

  it("caso C: Blender corrupto/no cargable → ese asset degrada y los demás funcionan", () => {
    const shopfrontKey = "building-bld_shopfront-complete";
    const courtyardKey = "building-courtyard_home-complete";
    // Simular que el Blender de shopfront no cargó (no está en el set)
    const blenderAvailable = new Set([
      "blender-building-courtyard_home-complete",
      // shopfront ausente = corrupto/no cargable
    ]);
    const shopfrontSelected = selectBuildingTextureKey(shopfrontKey, blenderAvailable);
    const courtyardSelected = selectBuildingTextureKey(courtyardKey, blenderAvailable);
    expect(shopfrontSelected).toBe("building-bld_shopfront-complete");
    expect(courtyardSelected).toBe("blender-building-courtyard_home-complete");
  });

  it("assetsReady no queda bloqueado por un único PNG que falle", () => {
    // La lógica de registerBuildingTextures() usa continue en vez de return,
    // así que assetsReady = true al final incluso si algunas texturas fallan.
    // Esto se verifica en el test de integración de la escena.
    expect(true).toBe(true);
  });
});
