import { describe, expect, it } from "vitest";
import { createInitialState, createViewProjection } from "@landlord/simulation";
import { buildGameplayVisualModel } from "./gameplay-visual-adapter";
import BLENDER from "../generated/runtime-assets-blender.json";
import PROCEDURAL from "../generated/runtime-assets.json";

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
      let cityActors = 0;

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
        for (const space of projection.publicSpaces ?? []) publicSpaceKinds.add(space.kind);
        cityBuildings += model.buildings.length;
        cityVehicles += model.parkedVehicles.length + model.contextVehicles.length;
        cityDressing += model.parcelDressing.length;
        cityActors += model.ambientActors.length;
      }

      // §21: la ciudad completa (unión de distritos) muestra tejido, vehículos, dressing y actores.
      expect(cityBuildings, "edificios en la ciudad").toBeGreaterThan(0);
      expect(cityVehicles, "vehículos en la ciudad").toBeGreaterThan(0);
      expect(cityDressing, "parcel dressing en la ciudad").toBeGreaterThan(0);
      expect(cityActors, "actores ambientales en la ciudad").toBeGreaterThan(0);
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
      const actorsByRole = new Map<string, number>();
      for (const districtId of state.world.city.districtIds) {
        const projection = createViewProjection(state, true, districtId);
        const role =
          projection.city.districts.find(
            (district) => district.id === projection.observedDistrictId,
          )?.role ?? "";
        if (!actorsByRole.has(role)) {
          actorsByRole.set(role, buildGameplayVisualModel(projection).ambientActors.length);
        }
      }
      const civic = actorsByRole.get("civic_core") ?? 0;
      const industrial = actorsByRole.get("industrial_logistics") ?? 0;
      expect(actorsByRole.size).toBeGreaterThanOrEqual(2);
      // El perfil cívico concentra más actividad peatonal que el industrial (§11).
      expect(civic).toBeGreaterThan(industrial);
    },
  );
});
