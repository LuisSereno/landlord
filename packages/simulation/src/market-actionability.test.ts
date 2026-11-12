import { describe, expect, it } from "vitest";

import {
  parseBlockId,
  parseDistrictId,
  parseMoney,
  parseOrganizationId,
  parseParcelId,
  type GridCell,
  type Parcel,
  type ParcelId,
} from "@landlord/shared";
import { DEVELOPMENT_CODES, developmentCodeById } from "./development-codes";
import { developmentPlacementCandidatesFor, evaluateActionableSite } from "./development-placement";
import { enumerateCompatibleDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS, MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import { enforceMarketableActionability } from "./market-actionability";
import { createInitialState } from "./state";
import type { UrbanFabricConfig } from "./urban-fabric";

/**
 * D-106 · un solar de mercado es una oportunidad accionable: construcción individual válida o
 * participación física en un sitio multi-parcela válido, con la misma regla autoritativa que usan
 * comando, UI, IA y automatización. El residuo sin salida se fusiona o deja de comercializarse;
 * un solar pequeño que sí sirve dentro de un complejo NUNCA se reclasifica.
 */

const config: UrbanFabricConfig = {
  latticeLines: 3,
  connectSpawns: true,
  maxBlockAreaCells: 200,
  maxBlockDepthCells: 20,
  parcelFrontageCells: [2, 6],
  parcelDepthCells: [2, 12],
  parcelAreaCells: [4, 96],
  maxParcelAspectRatio: 8,
};

function rectangle(x: number, y: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < height; row += 1)
    for (let column = 0; column < width; column += 1) cells.push({ x: x + column, y: y + row });
  return cells;
}

function parcelOf(
  id: string,
  cells: GridCell[],
  frontage: GridCell[] = [],
  block = "block_00000001",
): Parcel {
  return {
    id: parseParcelId(id),
    districtId: parseDistrictId("district_00000001"),
    blockId: parseBlockId(block),
    cells,
    anchorCell: cells[0]!,
    roadFrontages: frontage.length ? [{ roadSegmentId: "road_fixture", cells: frontage }] : [],
    disposition: "marketable",
    baseLandValue: parseMoney(100),
    marketValue: parseMoney(100),
    developmentCodeId: DEVELOPMENT_CODES.industrial_yard_2f!.id,
    currentUses: [],
    ownerOrganizationId: null,
    productionSuitability: { cement: 100, brick: 100, steel: 100 },
  };
}

const INDUSTRIAL = DEVELOPMENT_CODES.industrial_yard_2f!;

function standaloneActionable(parcel: Parcel): boolean {
  return Object.values(BUILDING_DEFINITIONS).some(
    (definition) =>
      definition.cost > 0 &&
      definition.siteRequirements.requiredParcels === 1 &&
      evaluateActionableSite({
        parcels: [parcel],
        definition,
        code: developmentCodeById(parcel.developmentCodeId),
      }).ok,
  );
}

function multiActionable(parcel: Parcel, pool: readonly Parcel[]): boolean {
  const byId = new Map(pool.map((entry) => [entry.id, entry]));
  const code = developmentCodeById(parcel.developmentCodeId);
  for (const definition of Object.values(BUILDING_DEFINITIONS)) {
    if (definition.cost === 0 || definition.siteRequirements.requiredParcels === 1) continue;
    const sites = enumerateCompatibleDevelopmentSites({
      parcels: pool,
      definition,
      seedParcelId: parcel.id,
      maxExplored: 128,
    });
    for (const ids of sites)
      if (
        evaluateActionableSite({
          parcels: ids.map((id) => byId.get(id)!).filter(Boolean),
          definition,
          code,
        }).ok
      )
        return true;
  }
  return false;
}

describe("D-106 · fusión y reclasificación de residuos de mercado", () => {
  it("preserva el solar pequeño que sólo sirve dentro de un complejo multi-parcela", () => {
    const small = parcelOf("parcel_00000001", rectangle(0, 0, 2, 3), rectangle(0, 0, 2, 1));
    const big = parcelOf("parcel_00000002", rectangle(2, 0, 4, 3), rectangle(2, 0, 4, 1));
    // La regla provisional (sólo proyecto individual) habría reclasificado este solar…
    expect(standaloneActionable(small)).toBe(false);
    // …pero la cementera sobre el par sí es una jugada legal que lo ocupa físicamente.
    expect(
      evaluateActionableSite({
        parcels: [small, big],
        definition: BUILDING_DEFINITIONS.cement_plant,
        code: INDUSTRIAL,
      }).ok,
    ).toBe(true);
    const parcels = [small, big];
    const outcome = enforceMarketableActionability({
      parcels,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
    });
    expect(outcome).toEqual({ merged: 0, reclassified: 0 });
    expect(parcels.map((parcel) => parcel.disposition)).toEqual(["marketable", "marketable"]);
  });

  it("fusiona el residuo con el vecino compatible de mayor borde compartido y reevalúa", () => {
    const residual = parcelOf("parcel_00000001", rectangle(2, 0, 3, 1), rectangle(2, 0, 3, 1));
    const minor = parcelOf("parcel_00000002", rectangle(0, 0, 2, 2), rectangle(0, 0, 2, 1));
    const major = parcelOf("parcel_00000003", rectangle(2, 1, 4, 3));
    expect(standaloneActionable(residual)).toBe(false);
    expect(multiActionable(residual, [residual, minor, major])).toBe(false);
    const parcels = [residual, minor, major];
    const outcome = enforceMarketableActionability({
      parcels,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
    });
    expect(outcome).toEqual({ merged: 1, reclassified: 0 });
    expect(parcels.map((parcel) => parcel.id)).toEqual([
      parseParcelId("parcel_00000001"),
      parseParcelId("parcel_00000002"),
    ]);
    const merged = parcels[0]!;
    expect(merged.cells).toHaveLength(15);
    expect(merged.roadFrontages[0]!.cells).toHaveLength(3);
    expect(merged.disposition).toBe("marketable");
    expect(standaloneActionable(merged)).toBe(true);
  });

  it("el ancla autorada conserva su id y su referencia económica en la fusión", () => {
    const residual = parcelOf("parcel_00000001", rectangle(2, 0, 3, 1), rectangle(2, 0, 3, 1));
    const anchor = parcelOf("parcel_00000003", rectangle(2, 1, 4, 3));
    const parcels = [residual, anchor];
    const outcome = enforceMarketableActionability({
      parcels,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
      anchorParcelIds: new Set<ParcelId>([anchor.id]),
    });
    expect(outcome.merged).toBe(1);
    expect(parcels).toHaveLength(1);
    expect(parcels[0]!.id).toBe(anchor.id);
    expect(parcels[0]!.cells).toHaveLength(15);
    expect(parcels[0]!.baseLandValue).toBe(parseMoney(100));
  });

  it("reclasifica como público el residuo sin vecino compatible", () => {
    const residual = parcelOf("parcel_00000001", rectangle(2, 0, 3, 1), rectangle(2, 0, 3, 1));
    const parcels = [residual];
    const outcome = enforceMarketableActionability({
      parcels,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
    });
    expect(outcome).toEqual({ merged: 0, reclassified: 1 });
    expect(residual.disposition).toBe("public");
    expect(residual.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    expect(residual.marketValue).toBe(parseMoney(0));
  });

  it("el envelope morfológico veta fusiones que el validador rechazaría", () => {
    const tight: UrbanFabricConfig = { ...config, parcelAreaCells: [4, 12] };
    const residual = parcelOf("parcel_00000001", rectangle(2, 0, 3, 1), rectangle(2, 0, 3, 1));
    const minor = parcelOf("parcel_00000002", rectangle(0, 0, 2, 2), rectangle(0, 0, 2, 1));
    const major = parcelOf("parcel_00000003", rectangle(2, 1, 4, 3));
    const parcels = [residual, minor, major];
    enforceMarketableActionability({
      parcels,
      fabricConfig: tight,
      avenueSegmentIds: new Set(),
    });
    // La fusión con el vecino de mayor borde (15 celdas) rompería el máximo de 12: no ocurre.
    expect(parcels.some((parcel) => parcel.cells.length === 15)).toBe(false);
    expect(parcels.every((parcel) => parcel.cells.length <= 12)).toBe(true);
  });

  it("es determinista: misma entrada, misma salida", () => {
    const build = () => [
      parcelOf("parcel_00000001", rectangle(2, 0, 3, 1), rectangle(2, 0, 3, 1)),
      parcelOf("parcel_00000002", rectangle(0, 0, 2, 2), rectangle(0, 0, 2, 1)),
      parcelOf("parcel_00000003", rectangle(2, 1, 4, 3)),
    ];
    const left = build();
    const right = build();
    const a = enforceMarketableActionability({
      parcels: left,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
    });
    const b = enforceMarketableActionability({
      parcels: right,
      fabricConfig: config,
      avenueSegmentIds: new Set(),
    });
    expect(a).toEqual(b);
    expect(left.map((parcel) => [parcel.id, parcel.cells.length, parcel.disposition])).toEqual(
      right.map((parcel) => [parcel.id, parcel.cells.length, parcel.disposition]),
    );
  });
});

describe("D-106 · regresión de ciudad", () => {
  it("seed 15: ningún solar de mercado es una compra trampa y el residuo histórico no tiene valor multi-parcela", () => {
    const state = createInitialState(15);
    const parcels = [...state.phase2.parcels.values()];
    const marketable = parcels.filter(
      (parcel) => parcel.disposition === "marketable" && !parcel.ownerOrganizationId,
    );
    const avenueByDistrict = new Map(
      [...state.world.districts.values()].map((district) => [
        district.id,
        new Set(
          district.map.roads.segments
            .filter((segment) => segment.class === "avenue")
            .map((segment) => segment.id as string),
        ),
      ]),
    );
    const actionable = (parcel: Parcel, pool: readonly Parcel[]) => {
      const code = developmentCodeById(parcel.developmentCodeId);
      const avenueSegmentIds = avenueByDistrict.get(parcel.districtId)!;
      for (const definition of Object.values(BUILDING_DEFINITIONS)) {
        if (definition.cost === 0) continue;
        if (definition.siteRequirements.requiredParcels === 1) {
          if (evaluateActionableSite({ parcels: [parcel], definition, code, avenueSegmentIds }).ok)
            return true;
        } else {
          const byId = new Map(pool.map((entry) => [entry.id, entry]));
          const sites = enumerateCompatibleDevelopmentSites({
            parcels: pool,
            definition,
            seedParcelId: parcel.id,
            maxExplored: 128,
          });
          for (const ids of sites)
            if (
              evaluateActionableSite({
                parcels: ids.map((id) => byId.get(id)!).filter(Boolean),
                definition,
                code,
                avenueSegmentIds,
              }).ok
            )
              return true;
        }
      }
      return false;
    };
    for (const parcel of marketable) expect(actionable(parcel, marketable)).toBe(true);
    const residual = state.phase2.parcels.get(parseParcelId("parcel_08000010"));
    expect(residual).toBeDefined();
    if (residual!.disposition === "marketable") {
      expect(actionable(residual!, marketable)).toBe(true);
    } else {
      // Público residual: sólo es legítimo si tampoco serviría dentro de un complejo.
      const copy = { ...residual!, disposition: "marketable" } as Parcel;
      expect(multiActionable(copy, [...marketable, copy])).toBe(false);
    }
  }, 300_000);

  it("el evaluador puro coincide con la enumeración del comando en suelo recién generado", () => {
    const state = createInitialState(42);
    const organization = parseOrganizationId("org_00000001");
    const openable = [...state.phase2.parcels.values()]
      .filter((parcel) => parcel.disposition === "marketable" && !parcel.ownerOrganizationId)
      .slice(0, 8);
    for (const parcel of openable) {
      const avenueSegmentIds = new Set(
        state.world.districts
          .get(parcel.districtId)!
          .map.roads.segments.filter((segment) => segment.class === "avenue")
          .map((segment) => segment.id as string),
      );
      for (const definition of Object.values(BUILDING_DEFINITIONS)) {
        if (definition.cost === 0 || definition.siteRequirements.requiredParcels !== 1) continue;
        const pure = evaluateActionableSite({
          parcels: [parcel],
          definition,
          code: developmentCodeById(parcel.developmentCodeId),
          avenueSegmentIds,
        });
        state.phase2.parcels.set(parcel.id, { ...parcel, ownerOrganizationId: organization });
        const answer = developmentPlacementCandidatesFor(state, {
          districtId: parcel.districtId,
          parcelIds: [parcel.id],
          buildingType: definition.type,
          organizationId: organization,
        });
        state.phase2.parcels.set(parcel.id, parcel);
        expect(pure.ok, `${parcel.id} ${definition.type}`).toBe(answer.totalCandidates > 0);
      }
    }
  }, 300_000);
});
