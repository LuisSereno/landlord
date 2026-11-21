/**
 * D-111.2 §5.1 — los presets son configuraciones, no combinaciones manuales de toggles.
 *
 * Aquí se comprueba la TABLA (lo que es datos y no necesita navegador): el mood que fija cada uno,
 * que ninguno lleve `bloomThreshold`, que `night_fire` sea exactamente `night_balanced` más el
 * incendio y que la URL reproduzca la tabla sin pasar por el ratón. La identidad EN VIVO del preset
 * (que la escena no se lo borre al reconstruir el rig por el cambio de mood) se comprueba en
 * `scripts/fx-lab-smoke.mjs`, que es donde existe un Phaser real.
 */
import { describe, expect, it } from "vitest";
import { FX_PRESETS, FX_PRESET_TABLE, isFxPreset, parseFxLabOptions } from "./fx-lab-types";

const effectsOf = (preset: (typeof FX_PRESETS)[number]) => [...FX_PRESET_TABLE[preset].effects];

describe("presets de D-111.2 §5.1", () => {
  it("existen los tres que exige el encargo", () => {
    expect(FX_PRESETS).toEqual(["day_balanced", "night_balanced", "night_fire"]);
  });

  it("ninguno lleva bloom por umbral", () => {
    for (const preset of FX_PRESETS) {
      expect(effectsOf(preset), preset).not.toContain("bloomThreshold");
    }
  });

  it("los dos nocturnos fijan noche y el diurno día", () => {
    expect(FX_PRESET_TABLE.day_balanced.mood).toBe("day");
    expect(FX_PRESET_TABLE.night_balanced.mood).toBe("night");
    expect(FX_PRESET_TABLE.night_fire.mood).toBe("night");
  });

  it("el preset nocturno trae luz, farolas, bloom por objeto y partículas", () => {
    /** §5.1: ambiente suficiente + farolas cálidas + bloom suave por objeto + partículas. */
    const night = effectsOf("night_balanced");
    for (const required of ["lighting", "bloomObjects", "particles", "grading"]) {
      expect(night, required).toContain(required);
    }
  });

  it("night_fire es night_balanced más el incendio, sin perder nada", () => {
    const base = effectsOf("night_balanced");
    const fire = effectsOf("night_fire");
    expect(fire.filter((effect) => effect !== "fire")).toEqual(base);
    expect(fire).toContain("fire");
  });

  it("el orden de montaje deja el relieve sobre una luz ya existente", () => {
    /**
     * `lightingNormals` pide prestado el rig si no está y se lo lleva al apagar; con el orden
     * invertido el preset montaría y desmontaría una luz de más, y el A/B dejaría de comparar lo
     * mismo. La tabla es el orden real de `applyEffect`.
     */
    for (const preset of FX_PRESETS) {
      const effects = effectsOf(preset);
      if (!effects.includes("lightingNormals")) continue;
      expect(effects.indexOf("lighting"), preset).toBeLessThan(effects.indexOf("lightingNormals"));
    }
  });

  it("la URL aplica la tabla y un fx= explícito sigue mandando", () => {
    expect(isFxPreset("night_fire")).toBe(true);
    expect(isFxPreset("bloomThreshold")).toBe(false);

    const byPreset = parseFxLabOptions("?fxPreset=night_fire");
    expect(byPreset.preset).toBe("night_fire");
    expect(byPreset.mood).toBe("night");
    expect(byPreset.effects).toEqual(FX_PRESET_TABLE.night_fire.effects);

    /** `fx=` explícito gana: sin esto la batería de captura no podría aislar una familia. */
    const byHand = parseFxLabOptions("?fxPreset=night_fire&fx=grading");
    expect(byHand.effects).toEqual(["grading"]);
    expect(byHand.mood).toBe("night");

    /** Un nombre que no está en la tabla no puede colarse como preset. */
    expect(parseFxLabOptions("?fxPreset=inventado").preset).toBeNull();
  });
});
