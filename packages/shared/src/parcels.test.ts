import { describe, expect, it } from "vitest";

import {
  areCellGroupsEdgeConnected,
  areSameParcelSet,
  canonicalParcelIds,
  primaryParcelId,
} from "./parcels";
import { parseParcelId } from "./primitives";
import { requestPermitSchema, startConstructionSchema } from "./domain";

const A = parseParcelId("parcel_00000001");
const B = parseParcelId("parcel_00000002");
const C = parseParcelId("parcel_00000003");

const base = {
  commandId: "cmd_vd7",
  issuedByPersonId: "person_00000001",
  actingAsOrganizationId: "org_00000001",
};

describe("V.d-7 contrato multi-parcela", () => {
  it("canonicaliza ids sin duplicados y en orden lexicográfico estable", () => {
    expect(canonicalParcelIds([B, A, B])).toEqual([A, B]);
    expect(canonicalParcelIds([A, B])).toEqual(canonicalParcelIds([B, A]));
    expect(canonicalParcelIds([C, A, B])).toEqual([A, B, C]);
    expect(canonicalParcelIds([])).toEqual([]);
  });

  it("expone una parcela primaria sólo como ancla de presentación", () => {
    expect(primaryParcelId([B, A])).toBe(A);
    expect(primaryParcelId([C])).toBe(C);
    expect(primaryParcelId([])).toBeNull();
  });

  it("compara conjuntos completos, no listas ni subconjuntos", () => {
    expect(areSameParcelSet([A, B], [B, A])).toBe(true);
    expect(areSameParcelSet([A, B], [A, C])).toBe(false);
    expect(areSameParcelSet([A, B], [A])).toBe(false);
    expect(areSameParcelSet([A, B], [A, B, C])).toBe(false);
  });

  it("exige una única componente 4-conexa y rechaza el contacto diagonal", () => {
    expect(areCellGroupsEdgeConnected([[{ x: 0, y: 0 }], [{ x: 1, y: 0 }]])).toBe(true);
    expect(areCellGroupsEdgeConnected([[{ x: 0, y: 0 }], [{ x: 1, y: 1 }]])).toBe(false);
    expect(areCellGroupsEdgeConnected([[{ x: 0, y: 0 }], [{ x: 1, y: 0 }], [{ x: 1, y: 1 }]])).toBe(
      true,
    );
    expect(areCellGroupsEdgeConnected([[{ x: 0, y: 0 }], [{ x: 1, y: 0 }], [{ x: 4, y: 0 }]])).toBe(
      false,
    );
    expect(areCellGroupsEdgeConnected([])).toBe(false);
  });

  it("los comandos aceptan parcelIds y rechazan el contrato singular anterior", () => {
    expect(
      startConstructionSchema.safeParse({
        ...base,
        type: "StartConstruction",
        payload: { parcelIds: [A, B], buildingType: "cement_plant" },
      }).success,
    ).toBe(true);
    expect(
      startConstructionSchema.safeParse({
        ...base,
        type: "StartConstruction",
        payload: { parcelId: A, buildingType: "cement_plant" },
      }).success,
    ).toBe(false);
    expect(
      requestPermitSchema.safeParse({
        ...base,
        type: "RequestPermit",
        payload: { parcelIds: [A, B], buildingType: "cement_plant" },
      }).success,
    ).toBe(true);
    expect(
      requestPermitSchema.safeParse({
        ...base,
        type: "RequestPermit",
        payload: { parcelId: A, buildingType: "cement_plant" },
      }).success,
    ).toBe(false);
  });
});
