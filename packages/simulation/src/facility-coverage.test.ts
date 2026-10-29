import { describe, expect, it } from "vitest";

import {
  facilityCoverageForDistrict,
  facilityCoverageIndex,
  fireDamageForBuilding,
  injuredRecoveryDays,
  type FacilityServiceId,
} from "./facility-coverage";
import { createViewProjection } from "./projection";
import { createInitialState, type GameState } from "./state";

const SERVICES: readonly FacilityServiceId[] = [
  "security",
  "fire",
  "health",
  "education",
  "market",
  "parks",
];

function districtIdByName(state: GameState, name: string): string {
  const entry = [...state.world.districts.values()].find(
    (district) => district.district.name === name,
  );
  if (!entry) throw new Error(`Unknown district ${name}`);
  return entry.district.id as string;
}

function parcelsOf(state: GameState, districtId: string) {
  return [...state.phase2.parcels.values()].filter(
    (parcel) => parcel.districtId === districtId && parcel.disposition === "marketable",
  );
}

describe("V.d.5 cobertura por grafo", () => {
  it("asigna demanda y publica saturación de capacidad", () => {
    const state = createInitialState(7);
    const index = facilityCoverageIndex(state);
    const reports = [...index.facilities.values()];
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.some((report) => report.saturated)).toBe(true);
    const security = reports.find((report) => report.service === "security")!;
    expect(security.demand).toBeGreaterThan(security.effectiveCapacity);
    expect(security.coveragePercent).toBeLessThan(100);
  });

  it("un recorte de presupuesto reduce la capacidad efectiva sin quitar el edificio", () => {
    const state = createInitialState(7);
    const before = facilityCoverageIndex(state);
    const coveredBefore = parcelsOf(state, districtIdByName(state, "Centro Cívico")).filter(
      (parcel) => before.byParcelId.get(parcel.id)!.security > 0,
    );
    expect(coveredBefore.length).toBeGreaterThan(0);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const after = facilityCoverageIndex(state);
    expect(after).not.toBe(before);
    for (const parcel of state.phase2.parcels.values()) {
      if (parcel.disposition !== "marketable") continue;
      expect(after.byParcelId.get(parcel.id)!.security).toBe(0);
    }
    const reports = [...after.facilities.values()].filter(
      (report) => report.service === "security",
    );
    expect(reports.every((report) => report.effectiveCapacity === 0)).toBe(true);
    expect(state.phase2.buildings.size).toBeGreaterThan(0);
  });

  it("reutiliza la caché mientras la firma no cambia", () => {
    const state = createInitialState(7);
    const first = facilityCoverageIndex(state);
    expect(facilityCoverageIndex(state)).toBe(first);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 50;
    expect(facilityCoverageIndex(state)).not.toBe(first);
  });

  it("cierra un gateway sin inventar una ruta: sólo se degrada el distrito dependiente", () => {
    const state = createInitialState(7);
    const oeste = districtIdByName(state, "Ensanche Ferroviario Oeste");
    const other = districtIdByName(state, "Barrio del Umbral");
    const before = facilityCoverageIndex(state);
    const oesteParcels = parcelsOf(state, oeste);
    const otherParcels = parcelsOf(state, other);
    expect(oesteParcels.some((parcel) => before.byParcelId.get(parcel.id)!.parks > 0)).toBe(true);
    const otherBefore = otherParcels.map((parcel) => before.byParcelId.get(parcel.id)!.parks);
    state.world.city.connections = state.world.city.connections.filter(
      (connection) => connection.fromDistrictId !== oeste && connection.toDistrictId !== oeste,
    );
    const after = facilityCoverageIndex(state);
    expect(oesteParcels.every((parcel) => after.byParcelId.get(parcel.id)!.parks === 0)).toBe(true);
    expect(otherParcels.map((parcel) => after.byParcelId.get(parcel.id)!.parks)).toEqual(
      otherBefore,
    );
  });

  it("un frente vial eliminado deja la parcela sin cobertura: el grafo no atraviesa suelo", () => {
    const state = createInitialState(7);
    const parcel = [...state.phase2.parcels.values()].find(
      (candidate) => candidate.disposition === "marketable",
    )!;
    parcel.roadFrontages = [];
    const index = facilityCoverageIndex(state);
    for (const service of SERVICES) {
      expect(index.byParcelId.get(parcel.id)![service], service).toBe(0);
    }
  });

  it("usa un único helper para fuego y salud", () => {
    const state = createInitialState(7);
    const index = facilityCoverageIndex(state);
    const parcels = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.disposition === "marketable",
    );
    const covered = parcels.find((parcel) => index.byParcelId.get(parcel.id)!.fire === 100)!;
    const uncovered = parcels.find((parcel) => index.byParcelId.get(parcel.id)!.fire === 0)!;
    expect(fireDamageForBuilding(state, { parcelId: covered.id }, 50).intensityGrowth).toBeLessThan(
      fireDamageForBuilding(state, { parcelId: uncovered.id }, 50).intensityGrowth,
    );
    expect(
      fireDamageForBuilding(state, { parcelId: covered.id }, 50).structuralDamage,
    ).toBeLessThan(fireDamageForBuilding(state, { parcelId: uncovered.id }, 50).structuralDamage);
    const coveredHealth = [...state.world.city.districtIds].find(
      (districtId) => facilityCoverageForDistrict(state, districtId, "health") >= 50,
    )!;
    const uncoveredHealth = [...state.world.city.districtIds].find(
      (districtId) => facilityCoverageForDistrict(state, districtId, "health") < 50,
    )!;
    expect(injuredRecoveryDays(state, coveredHealth)).toBe(1);
    expect(injuredRecoveryDays(state, uncoveredHealth)).toBe(2);
  });

  it("no depende del orden de inserción de Maps", () => {
    const first = createInitialState(7);
    const second = createInitialState(7);
    second.phase2.parcels = new Map([...second.phase2.parcels.entries()].reverse());
    for (const district of second.world.districts.values()) {
      district.facilities = new Map([...district.facilities.entries()].reverse());
      district.publicSpaces = new Map([...district.publicSpaces.entries()].reverse());
    }
    const a = facilityCoverageIndex(first);
    const b = facilityCoverageIndex(second);
    for (const parcelId of first.phase2.parcels.keys()) {
      expect(b.byParcelId.get(parcelId), parcelId).toEqual(a.byParcelId.get(parcelId));
    }
  });

  it("la seguridad del índice urbano sale de comisarías, no de un radio", () => {
    const state = createInitialState(7);
    const index = facilityCoverageIndex(state);
    const lomas = districtIdByName(state, "Lomas del Umbral");
    expect(index.byDistrictId.get(lomas as never)!.security).toBe(0);
    const centro = districtIdByName(state, "Centro Cívico");
    expect(index.byDistrictId.get(centro as never)!.security).toBeGreaterThan(0);
  });
});

describe("V.d.5 transporte como accesibilidad", () => {
  it("sin gateways abiertos no hay accesibilidad de red", () => {
    const state = createInitialState(7);
    const open = facilityCoverageIndex(state);
    const some = [...open.byParcelId.values()].some((coverage) => coverage.transport > 0);
    expect(some).toBe(true);
    state.world.city.connections = [];
    const closed = facilityCoverageIndex(state);
    expect([...closed.byParcelId.values()].every((coverage) => coverage.transport === 0)).toBe(
      true,
    );
  });
});

describe("V.d.5 proyección de servicios", () => {
  it("publica cobertura por parcela y el informe de la facility", () => {
    const state = createInitialState(7);
    const projection = createViewProjection(state, true);
    const parcel = projection.economy!.parcels.find((entry) =>
      Object.values(entry.serviceCoverage).some((value) => value > 0),
    );
    expect(parcel).toBeDefined();
    expect(parcel!.serviceCoverage.transport).toBeGreaterThanOrEqual(0);
    expect(
      projection.facilities.some(
        (facility) => facility.coverage !== null && facility.coverage.demand > 0,
      ),
    ).toBe(true);
  });
});
