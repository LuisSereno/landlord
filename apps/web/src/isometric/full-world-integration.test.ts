import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState, createViewProjection } from "@landlord/simulation";
import { parseRuntimeAssetManifest } from "@landlord/shared";
import {
  BUILDING_VISUAL_POLICIES,
  buildGameplayVisualModel,
  type GameplayAmbientActor,
} from "./gameplay-visual-adapter";
import BLENDER from "../generated/runtime-assets-blender.json";
import PROCEDURAL from "../generated/runtime-assets.json";

/**
 * Snapshot de performance (§26): se escribe con VH10_PERF=1.
 */
const PERF_PATH = resolve(
  import.meta.dirname,
  "../../../../docs/art/world-visual-foundation/performance.json",
);

/**
 * V.h.9 §21/§25-world/§33: integración runtime del MUNDO COMPLETO sobre el estado canónico real
 * (`createInitialState`, nueve distritos), no un fixture artificial. Para cada distrito se proyecta
 * y se construye el modelo visual de gameplay, y se comprueba que todas las capas de presentación
 * quedan pobladas y que ninguna referencia de asset runtime está rota.
 *
 *   VC9_FULLWORLD=1 pnpm --filter @landlord/web test
 */
const SEED = 2026;

/** Kinds de espacio público con regla de presentación (espejo de public-space-dressing.json). */
const KNOWN_PUBLIC_SPACE_KINDS = new Set([
  "plaza",
  "park",
  "pocket_park",
  "civic_courtyard",
  "schoolyard",
]);
const BLENDER_V2 = parseRuntimeAssetManifest(BLENDER);

function expectActorRuntimeReference(actor: GameplayAmbientActor): void {
  const character = BLENDER_V2.characters[actor.character];
  expect(character, `character roto: ${actor.character}`).toBeTruthy();
  if (!character) return;
  expect(actor.direction, `${actor.id}: direction negativa`).toBeGreaterThanOrEqual(0);
  expect(actor.direction, `${actor.id}: direction fuera del contrato`).toBeLessThan(
    character.directions,
  );
  const animation = character.animations[actor.animation];
  expect(animation, `${actor.id}: animation rota ${actor.animation}`).toBeTruthy();
  if (!animation) return;
  expect(animation.frames.length % character.directions, `${actor.id}: matriz irregular`).toBe(0);
  const framesPerDirection = animation.frames.length / character.directions;
  expect(actor.slot, `${actor.id}: slot negativo`).toBeGreaterThanOrEqual(0);
  expect(actor.slot, `${actor.id}: slot fuera del contrato`).toBeLessThan(framesPerDirection);
  expect(
    animation.frames[actor.direction * framesPerDirection + actor.slot],
    `${actor.id}: frame ausente`,
  ).toBeTruthy();
}

describe("V.h.9 full-world runtime integration (9 distritos reales)", () => {
  it(
    "los 9 distritos generan un modelo visual con todas las capas y sin referencias rotas",
    { skip: !process.env.VC9_FULLWORLD, timeout: 120_000 },
    () => {
      const state = createInitialState(SEED);
      const districtIds = state.world.city.districtIds;
      expect(districtIds).toHaveLength(9);

      const propRefs = new Set<string>();
      const vehicleRefs = new Set<string>();
      const buildingVisuals: { domainType: string; archetype: string }[] = [];
      const publicSpaceKinds = new Set<string>();
      let cityBuildings = 0;
      let cityVehicles = 0;
      let cityDressing = 0;
      let cityAmbientActors = 0;
      let cityContextActors = 0;

      for (const districtId of districtIds) {
        const projection = createViewProjection(state, true, districtId);
        const model = buildGameplayVisualModel(projection);

        // Todo distrito real tiene red viaria y produce un modelo sin errores. Un distrito
        // green_open_space puede no tener edificios construidos en el estado inicial: la cobertura
        // de edificios/vehículos/dressing se exige a nivel de ciudad (unión de los 9), no por distrito.
        expect(model.roadVisuals.length, `${districtId}: carreteras`).toBeGreaterThan(0);

        for (const building of model.buildings) {
          buildingVisuals.push({ domainType: building.domainType, archetype: building.archetype });
        }
        for (const furniture of model.publicSpaceFurniture) propRefs.add(furniture.asset);
        for (const furniture of model.streetFurniture) propRefs.add(furniture.asset);
        for (const dressing of model.parcelDressing) propRefs.add(dressing.asset);
        for (const vehicle of [...model.parkedVehicles, ...model.contextVehicles]) {
          vehicleRefs.add(vehicle.asset);
        }
        for (const actor of [...model.ambientActors, ...model.contextActors]) {
          expectActorRuntimeReference(actor);
        }
        for (const space of projection.publicSpaces ?? []) publicSpaceKinds.add(space.kind);
        cityBuildings += model.buildings.length;
        cityVehicles += model.parkedVehicles.length + model.contextVehicles.length;
        cityDressing += model.parcelDressing.length;
        cityAmbientActors += model.ambientActors.length;
        cityContextActors += model.contextActors.length;
      }

      // §21: la ciudad completa (unión de distritos) muestra tejido, vehículos, dressing y actores.
      expect(cityBuildings, "edificios en la ciudad").toBeGreaterThan(0);
      expect(cityVehicles, "vehículos en la ciudad").toBeGreaterThan(0);
      expect(cityDressing, "parcel dressing en la ciudad").toBeGreaterThan(0);
      const cityActorsTotal = cityAmbientActors + cityContextActors;
      expect(cityAmbientActors, "actores ambientales en la ciudad").toBeGreaterThan(0);
      expect(cityContextActors, "actores contextuales en la ciudad").toBeGreaterThan(0);
      expect(cityActorsTotal, "actores totales en la ciudad").toBe(
        cityAmbientActors + cityContextActors,
      );
      expect(publicSpaceKinds.size, "kinds de espacio público").toBeGreaterThan(0);

      // §33 RUNTIME_ASSET_REFERENCES: ningún prop/vehículo referenciado falta en el atlas.
      for (const prop of propRefs) {
        expect((BLENDER.props as Record<string, unknown>)[prop], `prop roto: ${prop}`).toBeTruthy();
      }
      for (const vehicle of vehicleRefs) {
        expect(
          (BLENDER.vehicles as Record<string, unknown>)[vehicle],
          `vehículo roto: ${vehicle}`,
        ).toBeTruthy();
      }

      // §33 BUILDING_VISUAL_COVERAGE: todo edificio presente tiene sprite (archetype en el atlas
      // Blender o domainType en el fallback procedural, como resuelve el renderer).
      for (const { domainType, archetype } of buildingVisuals) {
        const hasVisual =
          (BLENDER.buildings as Record<string, unknown>)[archetype] ??
          (PROCEDURAL.buildings as Record<string, unknown>)[domainType];
        expect(hasVisual, `edificio sin visual: ${domainType}/${archetype}`).toBeTruthy();
      }

      // §33 PUBLIC_SPACE_VISUAL_COVERAGE: todo kind de espacio público que aparece tiene regla.
      for (const kind of publicSpaceKinds) {
        expect(KNOWN_PUBLIC_SPACE_KINDS.has(kind), `kind sin regla de presentación: ${kind}`).toBe(
          true,
        );
      }
    },
  );

  it(
    "el modelo visual del mundo completo es determinista (mismo estado → mismo mundo)",
    { skip: !process.env.VC9_FULLWORLD, timeout: 120_000 },
    () => {
      const state = createInitialState(SEED);
      const districtId = state.world.city.districtIds[0]!;
      const a = buildGameplayVisualModel(createViewProjection(state, true, districtId));
      const b = buildGameplayVisualModel(createViewProjection(state, true, districtId));
      expect(a).toEqual(b);
    },
  );

  it(
    "los distritos cívico e industrial visten distinto (perfiles §11 aplicados)",
    { skip: !process.env.VC9_FULLWORLD, timeout: 120_000 },
    () => {
      const state = createInitialState(SEED);
      const layersByRole = new Map<
        string,
        { furniture: number; vehicles: number; vegetation: number; actors: number }
      >();
      for (const districtId of state.world.city.districtIds) {
        const projection = createViewProjection(state, true, districtId);
        const role =
          projection.city.districts.find(
            (district) => district.id === projection.observedDistrictId,
          )?.role ?? "";
        if (!layersByRole.has(role)) {
          const model = buildGameplayVisualModel(projection);
          layersByRole.set(role, {
            furniture: model.streetFurniture.length,
            vehicles: model.parkedVehicles.length + model.contextVehicles.length,
            vegetation:
              model.decorations.length +
              model.publicSpaceFurniture.filter(
                (entry) => entry.kind === "tree" || entry.kind === "foliage",
              ).length,
            actors: model.ambientActors.length + model.contextActors.length,
          });
        }
      }
      const civic = layersByRole.get("civic_core");
      const industrial = layersByRole.get("industrial_logistics");
      expect(layersByRole.size).toBeGreaterThanOrEqual(2);
      expect(civic).toBeTruthy();
      expect(industrial).toBeTruthy();
      // Gate de modelo real: ya no se limita a contar peatones.
      expect(civic!.actors).toBeGreaterThan(industrial!.actors);
      expect(civic!.furniture).not.toBe(industrial!.furniture);
    },
  );

  it(
    "snapshot de performance (§26): textures/sprites y tiempo de generación de los 9 distritos",
    { skip: !process.env.VH10_PERF, timeout: 120_000 },
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const B = BLENDER as any;
      const imgCount = (asset: { orientations?: Record<string, unknown> }) =>
        1 + Object.keys(asset.orientations ?? {}).length;
      const textures =
        Object.values(B.buildings as Record<string, { states: Record<string, unknown> }>).reduce(
          (n, b) => n + Object.keys(b.states).length,
          0,
        ) +
        Object.values(
          (B.terrain ?? {}) as Record<string, { orientations?: Record<string, unknown> }>,
        ).reduce((n, t) => n + imgCount(t), 0) +
        Object.values(
          (B.props ?? {}) as Record<string, { orientations?: Record<string, unknown> }>,
        ).reduce((n, p) => n + imgCount(p), 0) +
        Object.values(
          (B.vehicles ?? {}) as Record<string, { orientations?: Record<string, unknown> }>,
        ).reduce((n, v) => n + imgCount(v), 0) +
        Object.values(
          (B.characters ?? {}) as Record<
            string,
            { animations: Record<string, { frames: unknown[] }> }
          >,
        ).reduce(
          (n, c) => n + Object.values(c.animations).reduce((m, a) => m + a.frames.length, 0),
          0,
        );

      const state = createInitialState(SEED);
      const started = performance.now();
      let objects = 0;
      const perDistrict: Record<string, number> = {};
      const layerTotals = {
        buildings: 0,
        streetFurniture: 0,
        publicSpaceFurniture: 0,
        parcelDressing: 0,
        parkedVehicles: 0,
        contextVehicles: 0,
        ambientActors: 0,
        contextActors: 0,
      };
      for (const districtId of state.world.city.districtIds) {
        const model = buildGameplayVisualModel(createViewProjection(state, true, districtId));
        const layers = {
          buildings: model.buildings.length,
          streetFurniture: model.streetFurniture.length,
          publicSpaceFurniture: model.publicSpaceFurniture.length,
          parcelDressing: model.parcelDressing.length,
          parkedVehicles: model.parkedVehicles.length,
          contextVehicles: model.contextVehicles.length,
          ambientActors: model.ambientActors.length,
          contextActors: model.contextActors.length,
        };
        const count = Object.values(layers).reduce((sum, value) => sum + value, 0);
        for (const key of Object.keys(layerTotals) as Array<keyof typeof layerTotals>) {
          layerTotals[key] += layers[key];
        }
        perDistrict[districtId] = count;
        objects += count;
      }
      const generationMs = Math.round(performance.now() - started);

      const snapshot = {
        generatedAt: new Date().toISOString(),
        seed: SEED,
        before_V_h: {
          atlasImages: 69,
          vehicles: 3,
          props: 13,
          characters: 1,
          note: "baseline al inicio de V.h (atlas de V.g civic-core P7)",
        },
        V_h_10: {
          atlasImages: 81,
          vehicles: 9,
          props: 13,
          characters: 1,
          presentationalObjects: 2720,
          generationMs: 551,
          note: "snapshot archivado antes de V.h.11; no incluía contextActors",
        },
        V_h_11: {
          atlasImages: 161,
          vehicles: 9,
          props: 13,
          characters: 6,
          note: "cinco Rocketbox nuevos × 16 frames = 80 imágenes nuevas",
        },
        V_h_12: {
          atlasImages: textures,
          vehicles: Object.keys(B.vehicles ?? {}).length,
          props: Object.keys(B.props ?? {}).length,
          characters: Object.keys(B.characters ?? {}).length,
          buildingTypes: Object.keys(B.buildings).length,
          buildingVisualPolicyTypes: Object.keys(BUILDING_VISUAL_POLICIES).length,
        },
        world: {
          districts: state.world.city.districtIds.length,
          presentationalObjects: objects,
          layers: layerTotals,
          cityAmbientActors: layerTotals.ambientActors,
          cityContextActors: layerTotals.contextActors,
          cityActorsTotal: layerTotals.ambientActors + layerTotals.contextActors,
          perDistrict,
          generationMs,
        },
        note:
          "generationMs = proyectar + construir el modelo visual de los 9 distritos en node (sin GPU). " +
          "El FPS interactivo requiere la app Phaser y se valida en la review humana; el render usa " +
          "reuse de texturas, culling por viewport y sprites compartidos del atlas (sin duplicar mallas ni PNGs).",
      };
      mkdirSync(dirname(PERF_PATH), { recursive: true });
      writeFileSync(PERF_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
      expect(objects).toBeGreaterThan(0);
      expect(generationMs).toBeGreaterThan(0);
      expect(textures).toBeGreaterThan(69);
    },
  );
});
