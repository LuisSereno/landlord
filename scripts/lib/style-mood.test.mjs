import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveStyleMood } from "./style-mood.mjs";

const repoRoot = new URL("../../", import.meta.url);
const styleLayer = JSON.parse(
  readFileSync(
    new URL("tools/art-pipeline/blender/style_layer_graphic_civic.json", repoRoot),
    "utf8",
  ),
);

for (const moodId of [
  "night_civic",
  "day_civic",
  "day_industrial",
  "material_maquette_day",
  "material_maquette_night",
]) {
  const mood = resolveStyleMood(styleLayer, moodId);
  assert.ok(mood.lighting, `${moodId} inherits lighting`);
  assert.ok(mood.rendering, `${moodId} inherits render settings`);
  assert.ok(mood.shadow, `${moodId} inherits shadows`);
  assert.ok(mood.externalTreatment.hueBands.length > 0, `${moodId} inherits hue bands`);
}

const night = resolveStyleMood(styleLayer, "night_civic");
const day = resolveStyleMood(styleLayer, "day_civic");
const industrial = resolveStyleMood(styleLayer, "day_industrial");
const material = resolveStyleMood(styleLayer, "material_maquette_day");
const materialNight = resolveStyleMood(styleLayer, "material_maquette_night");
const sourceNearWhite = styleLayer.moodProfiles.night_civic.externalTreatment.hueBands.find(
  (band) => band.id === "near_white_trim",
);
assert.notEqual(day.lighting.keyEnergy, night.lighting.keyEnergy);
assert.notEqual(day.externalTreatment.global.valueScale, night.externalTreatment.global.valueScale);
assert.equal(
  industrial.externalTreatment.bandOverrides,
  undefined,
  "band overrides are applied and removed after resolution",
);
assert.equal(material.externalTreatment.global.saturationScale, 0.92);
assert.equal(material.lighting.keyColor[2], 0.76);
assert.equal(material.externalTreatment.hueBands.find((band) => band.id === "near_white_trim").valueScale, 0.68);
assert.equal(materialNight.lighting.keyColor[2], 0.68);
const industrialBand = industrial.externalTreatment.hueBands.find(
  (band) => band.id === "near_white_trim",
);
assert.equal(industrialBand.valueScale, 0.5);
assert.notEqual(
  styleLayer.moodProfiles.day_civic.externalTreatment.bandOverrides,
  undefined,
  "resolving a mood must not mutate the source manifest",
);
assert.notEqual(
  sourceNearWhite.valueScale,
  industrial.externalTreatment.hueBands.find((band) => band.id === "near_white_trim").valueScale,
  "applying an inherited override must not mutate the parent mood's hue bands",
);

assert.throws(() => resolveStyleMood(styleLayer, "missing_mood"), /activeMood desconocido/u);
const cyclic = {
  moodProfiles: {
    a: { extends: "b" },
    b: { extends: "a" },
  },
};
assert.throws(() => resolveStyleMood(cyclic, "a"), /ciclo de herencia/u);
const missingBand = {
  moodProfiles: {
    broken: {
      externalTreatment: {
        hueBands: [],
        bandOverrides: { ghost_band: { valueScale: 0.2 } },
      },
    },
  },
};
assert.throws(() => resolveStyleMood(missingBand, "broken"), /banda inexistente/u);

console.log(
  "style-mood: 5 moods, inheritance, overrides, missing profile, cycle and unknown band passed",
);
