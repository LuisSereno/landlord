import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  parseOrganizationId,
  type BuildingType,
  type DistrictId,
  type ParcelId,
} from "@landlord/shared";
import {
  developmentCodeById,
  isBuildingAllowedByDevelopmentCode,
  zoningFamilyForCode,
} from "./development-codes";
import { developmentPlacementCandidatesFor } from "./development-placement";
import { enumerateCompatibleDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS } from "./game-data";
import { createInitialState } from "./state";

/**
 * V.d-7C · ¿es alcanzable el caso «cero candidatas» en la ciudad que se entrega? Opt-in:
 * `pnpm placement:reachability` escribe `docs/execution/phase-4/vd7c-placement-reachability.json`.
 *
 * Barre TODOS los proyectos que la interfaz puede armar en una partida nueva (solar vacío comprable
 * con un proyecto de una parcela; pares y tríos adyacentes de la misma norma con sus proyectos de dos
 * y tres parcelas) y cuenta las candidatas que el motor autoritativo devuelve para cada uno. Es la
 * evidencia que falta cuando una captura necesita enseñar el panel bloqueado: o existe un solar real
 * que produzca cero colocaciones, o el caso sólo puede probarse con fixtures unitarios.
 */
const ENABLED = process.env.PLACEMENT_REACHABILITY === "1";
/** Comma-separated deterministic sweep; CI/default evidence remains the three representative seeds. */
const SWEEP_SEEDS = (process.env.PLACEMENT_REACHABILITY_SEEDS ?? "1,7,42")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value >= 0);
const organization = parseOrganizationId("org_00000001");
const cellKey = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;

function measure(seed: number) {
  const state = createInitialState(seed);
  const occupied = new Set(
    [...state.phase2.buildings.values()].flatMap((building) => building.parcelIds),
  );
  /** Sólo solares que la jugadora puede comprar y que están vacíos: los únicos que abren el catálogo. */
  const openable = [...state.phase2.parcels.values()].filter(
    (parcel) =>
      parcel.disposition === "marketable" &&
      !parcel.ownerOrganizationId &&
      !occupied.has(parcel.id),
  );
  const byId = new Map(openable.map((parcel) => [parcel.id, parcel]));

  const own = (ids: readonly ParcelId[]) => {
    for (const id of ids)
      state.phase2.parcels.set(id, { ...byId.get(id)!, ownerOrganizationId: organization });
  };
  const release = (ids: readonly ParcelId[]) => {
    for (const id of ids) state.phase2.parcels.set(id, byId.get(id)!);
  };
  const permitted = (parcel: (typeof openable)[number], buildingType: BuildingType) =>
    isBuildingAllowedByDevelopmentCode(
      BUILDING_DEFINITIONS[buildingType],
      developmentCodeById(parcel.developmentCodeId),
    );

  let projects = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let zeroCases = 0;
  const zeroExamples: string[] = [];
  const multiTouchFailures: string[] = [];
  const minimumByBuildingType: Record<string, number> = {};
  const availableBuildingTypes = new Set<BuildingType>();
  /**
   * D-106: an open market parcel is a real opportunity only if at least one legal project can
   * be placed. A project may make that opportunity actionable through its complete two/three
   * parcel site; it must not be artificially restricted to a one-parcel building.
   */
  const actionableParcelIds = new Set<ParcelId>();

  const observe = (
    label: string,
    ids: readonly ParcelId[],
    buildingType: BuildingType,
    districtId: DistrictId,
  ) => {
    own(ids);
    const answer = developmentPlacementCandidatesFor(state, {
      districtId,
      parcelIds: ids,
      buildingType,
      organizationId: organization,
    });
    release(ids);
    projects += 1;
    minimum = Math.min(minimum, answer.totalCandidates);
    minimumByBuildingType[buildingType] = Math.min(
      minimumByBuildingType[buildingType] ?? Number.POSITIVE_INFINITY,
      answer.totalCandidates,
    );
    if (answer.totalCandidates === 0) {
      zeroCases += 1;
      if (zeroExamples.length < 10)
        zeroExamples.push(`${label} ${ids.join("+")} · ${buildingType} · ${answer.rejection}`);
    } else {
      for (const id of ids) actionableParcelIds.add(id);
      availableBuildingTypes.add(buildingType);
      if (ids.length > 1) {
        // D-096/D-106: un complejo multi-parcela debe tocar físicamente TODAS sus parcelas.
        const footprint = new Set(answer.candidates[0]!.footprintCells.map(cellKey));
        for (const id of ids) {
          const touches = byId.get(id)!.cells.some((cell) => footprint.has(cellKey(cell)));
          if (!touches)
            multiTouchFailures.push(`${label} ${ids.join("+")} · ${buildingType} · ${id}`);
        }
      }
    }
    return answer.totalCandidates;
  };

  for (const definition of Object.values(BUILDING_DEFINITIONS)) {
    if (definition.cost === 0) continue;
    const required = definition.siteRequirements.requiredParcels;
    if (required === 1) {
      for (const parcel of openable) {
        if (!permitted(parcel, definition.type)) continue;
        observe("single", [parcel.id], definition.type, parcel.districtId);
      }
      continue;
    }
    // Pares y tríos con el mismo contrato autoritativo que UI/IA (admite cadenas a-b-c, no sólo
    // triángulos): un sitio legal de acería no puede quedar fuera del barrido por geometría.
    const sites = enumerateCompatibleDevelopmentSites({
      parcels: openable,
      definition,
      maxExplored: 20_000,
    });
    for (const ids of sites) {
      observe(
        required === 2 ? "pair" : "triple",
        ids,
        definition.type,
        byId.get(ids[0]!)!.districtId,
      );
    }
  }

  const sizes = openable.map((parcel) => parcel.cells.length).sort((left, right) => left - right);
  const singleMinArea = Math.max(
    ...Object.values(BUILDING_DEFINITIONS)
      .filter(
        (definition) => definition.cost > 0 && definition.siteRequirements.requiredParcels === 1,
      )
      .map((definition) => definition.siteRequirements.minCombinedAreaCells),
  );
  const families = new Map<string, number>();
  for (const parcel of openable) {
    const family = zoningFamilyForCode(developmentCodeById(parcel.developmentCodeId));
    families.set(family, (families.get(family) ?? 0) + 1);
  }
  const unactionableParcels = openable
    .filter((parcel) => !actionableParcelIds.has(parcel.id))
    .map((parcel) => parcel.id)
    .sort();
  return {
    seed,
    projects,
    minimumCandidates: minimum === Number.POSITIVE_INFINITY ? null : minimum,
    zeroCandidateProjects: zeroCases,
    zeroExamples,
    minimumByBuildingType,
    availableBuildingTypes: [...availableBuildingTypes].sort(),
    smallestOpenableParcelCells: sizes[0] ?? null,
    largestSingleParcelMinimumArea: singleMinArea,
    openableParcels: openable.length,
    actionableParcels: actionableParcelIds.size,
    unactionableParcels,
    multiTouchFailures,
    buildableFamilies: Object.fromEntries(families),
  };
}

describe.skipIf(!ENABLED)("V.d-7C · alcanzabilidad y accionabilidad de solares", () => {
  it("barre los proyectos y no publica solares de mercado sin una jugada legal", () => {
    /** Semilla 1 = la que inicializa la app (`use-game-session.ts`); el gate puede ampliar la muestra. */
    expect(SWEEP_SEEDS.length).toBeGreaterThan(0);
    const runs = SWEEP_SEEDS.map(measure);
    const again = measure(SWEEP_SEEDS[0]!);
    expect(again.projects).toBe(runs[0]!.projects);
    expect(again.minimumCandidates).toBe(runs[0]!.minimumCandidates);

    const evidence = {
      measuredAt: new Date().toISOString(),
      note: "Recuento autoritativo de candidatas sobre TODOS los proyectos que una jugadora puede abrir en una partida nueva (comprar → catálogo → elegir ubicación).",
      appSeed: SWEEP_SEEDS[0],
      requestedSeeds: SWEEP_SEEDS,
      runs,
      reachableZeroCandidate: runs.some((run) => run.zeroCandidateProjects > 0),
    };
    mkdirSync("docs/execution/phase-4", { recursive: true });
    writeFileSync(
      "docs/execution/phase-4/vd7c-placement-reachability.json",
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    expect(runs[0]!.projects).toBeGreaterThan(1000);
    const privateTypes = Object.values(BUILDING_DEFINITIONS)
      .filter((definition) => definition.cost > 0)
      .map((definition) => definition.type);
    for (const run of runs) {
      expect(run.actionableParcels).toBe(run.openableParcels);
      expect(run.unactionableParcels).toEqual([]);
      expect(run.multiTouchFailures).toEqual([]);
      // Disponibilidad ciudad-global: los nueve tipos privados, incluida la industria pesada
      // (cementera/ladrillera/acería), tienen al menos una colocación legal en la ciudad.
      // (El mínimo por tipo es informativo: no todo trío contiguo es un sitio legal.)
      for (const type of privateTypes) {
        expect(run.availableBuildingTypes, `seed ${run.seed} · ${type}`).toContain(type);
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `V.d-7C reachability · ${runs
        .map(
          (run) =>
            `seed ${run.seed}: ${run.projects} proyectos, mínimo ${run.minimumCandidates} candidatas, ceros ${run.zeroCandidateProjects}`,
        )
        .join(" · ")}`,
    );
  }, 2_700_000);
});
