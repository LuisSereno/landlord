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
const organization = parseOrganizationId("org_00000001");
const cellKey = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;
const OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

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
  const ownerOfCell = new Map<string, ParcelId>();
  for (const parcel of openable)
    for (const cell of parcel.cells) ownerOfCell.set(cellKey(cell), parcel.id);
  const adjacent = new Map<ParcelId, ParcelId[]>();
  for (const parcel of openable) {
    const set = new Set<ParcelId>();
    for (const cell of parcel.cells)
      for (const offset of OFFSETS) {
        const other = ownerOfCell.get(`${cell.x + offset.x},${cell.y + offset.y}`);
        if (other && other !== parcel.id) set.add(other);
      }
    adjacent.set(parcel.id, [...set].sort());
  }

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
  const minimumByBuildingType: Record<string, number> = {};

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
    }
    return answer.totalCandidates;
  };

  for (const parcel of openable)
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      if (definition.cost === 0 || definition.siteRequirements.requiredParcels !== 1) continue;
      if (!permitted(parcel, definition.type)) continue;
      observe("single", [parcel.id], definition.type, parcel.districtId);
    }

  for (const a of openable)
    for (const bId of adjacent.get(a.id) ?? []) {
      if (bId <= a.id) continue;
      const b = byId.get(bId)!;
      if (a.developmentCodeId !== b.developmentCodeId || a.districtId !== b.districtId) continue;
      for (const definition of Object.values(BUILDING_DEFINITIONS)) {
        if (definition.cost === 0 || definition.siteRequirements.requiredParcels !== 2) continue;
        if (!permitted(a, definition.type) || !permitted(b, definition.type)) continue;
        observe("pair", [a.id, bId], definition.type, a.districtId);
      }
      for (const cId of adjacent.get(a.id) ?? []) {
        if (cId <= bId) continue;
        if (!(adjacent.get(bId) ?? []).includes(cId)) continue;
        const c = byId.get(cId)!;
        if (c.developmentCodeId !== a.developmentCodeId || c.districtId !== a.districtId) continue;
        for (const definition of Object.values(BUILDING_DEFINITIONS)) {
          if (definition.cost === 0 || definition.siteRequirements.requiredParcels !== 3) continue;
          if (!permitted(c, definition.type)) continue;
          observe("triple", [a.id, bId, cId], definition.type, a.districtId);
        }
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
  return {
    seed,
    projects,
    minimumCandidates: minimum === Number.POSITIVE_INFINITY ? null : minimum,
    zeroCandidateProjects: zeroCases,
    zeroExamples,
    minimumByBuildingType,
    smallestOpenableParcelCells: sizes[0] ?? null,
    largestSingleParcelMinimumArea: singleMinArea,
    openableParcels: openable.length,
    buildableFamilies: Object.fromEntries(families),
  };
}

describe.skipIf(!ENABLED)("V.d-7C · alcanzabilidad del caso sin colocación", () => {
  it("barre los proyectos que la interfaz puede armar en la ciudad entregada", () => {
    /** Semilla 1 = la que inicializa la app (`use-game-session.ts`); las otras dos amplían la muestra. */
    const runs = [1, 7, 42].map(measure);
    const again = measure(1);
    expect(again.projects).toBe(runs[0]!.projects);
    expect(again.minimumCandidates).toBe(runs[0]!.minimumCandidates);

    const evidence = {
      measuredAt: new Date().toISOString(),
      note: "Recuento autoritativo de candidatas sobre TODOS los proyectos que una jugadora puede abrir en una partida nueva (comprar → catálogo → elegir ubicación).",
      appSeed: 1,
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
    // eslint-disable-next-line no-console
    console.log(
      `V.d-7C reachability · ${runs
        .map(
          (run) =>
            `seed ${run.seed}: ${run.projects} proyectos, mínimo ${run.minimumCandidates} candidatas, ceros ${run.zeroCandidateProjects}`,
        )
        .join(" · ")}`,
    );
  }, 300_000);
});
