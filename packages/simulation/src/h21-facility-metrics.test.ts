import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  viewProjectionV2Schema,
  type Building,
  type Parcel,
  type UrbanFacility,
  type UrbanFacilityId,
} from "@landlord/shared";

import { facilityCoverageIndex } from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { createInitialState, type GameState } from "./state";
import { createViewProjection } from "./projection";

/**
 * H2.1-01 · el informe por facility mezcla magnitudes. `firstChoiceDemand` es la cuenca Voronoi
 * estricta (qué parcelas eligen esta facility como más cercana); `served` es capacidad realmente
 * consumida, y desde H2-06 incluye el spill-in de vecinas llenas. Dividir `served` entre
 * `firstChoiceDemand` no es una cobertura: puede superar 100 (la receptora de spill atiende más
 * parcelas de las que la elegían) o no existir (demanda primaria 0). El informe nuevo publica las
 * cuatro magnitudes sueltas y una utilización medida contra la capacidad.
 */

function facilitiesOfKind(state: GameState, kind: string): UrbanFacility[] {
  const out: UrbanFacility[] = [];
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) out.push(facility);
  return out.sort((left, right) => left.id.localeCompare(right.id));
}

function marketableOf(state: GameState, districtId: Parcel["districtId"], count: number): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, count);
}

function develop(parcels: Parcel[], target: GameState, serialStart: number): void {
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(serialStart + index).padStart(8, "0")}`);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    target.phase2.buildings.set(id, {
      id,
      parcelIds: [parcel.id],
      districtId: parcel.districtId,
      footprintCells: [{ ...parcel.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "detached",
      ownerOrganizationId: PLAYER_ORGANIZATION_ID,
      productionFacilityId: null,
      type: "courtyard_home",
      level: 1,
      condition: 100,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    } satisfies Building);
  });
}

/**
 * Escenario de spill: la red de seguridad al 25 % de presupuesto deja 37 huecos por comisaría
 * (capacity 2 × cohorte 75 × 25 / 100). Se desarrollan 60 parcelas en el distrito de A y sólo 3
 * en el de B: A llena su cupo y vierte el excedente sobre B, que atiende muchas más parcelas de
 * las que la elegían como primera opción.
 */
function spillScenario(seed: number): {
  state: GameState;
  first: UrbanFacility;
  second: UrbanFacility;
} {
  const state = createInitialState(seed);
  const [first, second] = facilitiesOfKind(state, "police_station");
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  develop(marketableOf(state, first!.districtId, 60), state, 1000);
  develop(marketableOf(state, second!.districtId, 3), state, 1100);
  state.phase2.municipal.serviceLevelPercentByCategory.security = 25;
  return { state, first: first!, second: second! };
}

describe("H2.1-01 · métricas explícitas del informe de facilities", () => {
  it("una facility con poca demanda primaria que recibe spill atiende más parcelas de las que la elegían", () => {
    const { state, first, second } = spillScenario(7);
    const index = facilityCoverageIndex(state);
    const overflown = index.facilities.get(first.id as UrbanFacilityId)!;
    const receiver = index.facilities.get(second.id as UrbanFacilityId)!;

    /** Precondición del escenario: A desborda, así que su excedente tiene a dónde ir. */
    expect(overflown.firstChoiceDemand).toBeGreaterThan(overflown.effectiveCapacity);
    expect(overflown.saturated).toBe(true);
    expect(overflown.utilizationPercent).toBe(100);

    /** B no llegó a llenarse: atiende su cuenca propia más el excedente de A. */
    expect(receiver.served).toBeGreaterThan(receiver.firstChoiceDemand);
    expect(receiver.served).toBeLessThan(receiver.effectiveCapacity);
    expect(receiver.saturated).toBe(false);
    /**
     * La división prohibida. Con las cifras reales de este escenario, `served / firstChoiceDemand`
     * sería un porcentaje de "cobertura" muy por encima de 100: el informe viejo lo publicaba así
     * y el Zod del renderer lo acotaba a 100 —la UI mostraba un número sin significado o el
     * projection se rechazaba—.
     */
    expect(
      Math.round((receiver.served * 100) / receiver.firstChoiceDemand),
      "served/firstChoiceDemand no es una cobertura",
    ).toBeGreaterThan(100);
    /** La utilización nueva sí cabe en su definición: served sobre capacidad. */
    expect(receiver.utilizationPercent).toBe(
      Math.round((receiver.served * 100) / receiver.effectiveCapacity),
    );
    expect(receiver.utilizationPercent).toBeLessThanOrEqual(100);
  });

  it("ninguna facility de la ciudad publica una utilización fuera de 0..100", () => {
    for (const level of [0, 25, 50, 75, 100]) {
      const { state } = spillScenario(7);
      state.phase2.municipal.serviceLevelPercentByCategory.security = level;
      for (const report of facilityCoverageIndex(state).facilities.values()) {
        expect(
          report.utilizationPercent,
          `${report.facilityId} al ${level} %`,
        ).toBeGreaterThanOrEqual(0);
        expect(report.utilizationPercent, `${report.facilityId} al ${level} %`).toBeLessThanOrEqual(
          100,
        );
        expect(report.served, report.facilityId).toBeLessThanOrEqual(report.effectiveCapacity);
        expect(report.saturated, report.facilityId).toBe(
          report.effectiveCapacity > 0 && report.served >= report.effectiveCapacity,
        );
      }
    }
  });

  it("una facility sin capacidad está apagada, no saturada", () => {
    /**
     * `saturated` respondía a `demand > effectiveCapacity`. Con presupuesto 0 esa expresión era
     * falsa por 0 > 0, y con la red apagada no hay ningún hueco que la facility haya llenado: la
     * palabra correcta es "apagada". El `saturated` nuevo exige huecos existentes y consumidos.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    develop(marketableOf(state, station!.districtId, 20), state, 1200);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const report = facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!;
    expect(report.effectiveCapacity).toBe(0);
    expect(report.served).toBe(0);
    expect(report.utilizationPercent).toBe(0);
    expect(report.saturated).toBe(false);
    /** Sin capacidad no es primera opción de nadie: la cuenca se reparte entre las operativas. */
    expect(report.firstChoiceDemand).toBe(0);
  });

  it("el informe no depende del orden de inserción de los Maps", () => {
    const left = spillScenario(7);
    const right = spillScenario(7);
    for (const district of right.state.world.districts.values())
      district.facilities = new Map([...district.facilities.entries()].reverse());
    right.state.phase2.parcels = new Map([...right.state.phase2.parcels.entries()].reverse());
    right.state.phase2.buildings = new Map([...right.state.phase2.buildings.entries()].reverse());
    const a = facilityCoverageIndex(left.state);
    const b = facilityCoverageIndex(right.state);
    expect([...b.facilities.keys()].sort()).toEqual([...a.facilities.keys()].sort());
    for (const facilityId of a.facilities.keys())
      expect(b.facilities.get(facilityId), facilityId).toEqual(a.facilities.get(facilityId));
    for (const parcelId of a.byParcelId.keys())
      expect(b.byParcelId.get(parcelId), parcelId).toEqual(a.byParcelId.get(parcelId));
  });

  it("la proyección publica serviceMetrics y ningún campo se llama cobertura", () => {
    const { state, second } = spillScenario(7);
    /**
     * La proyección es por distrito observado (D-089): se pide el distrito de B, que es la
     * receptora del spill —la que bajo el informe viejo publicaba una "cobertura" de 1200 %—.
     */
    const projection = createViewProjection(state, true, second.districtId);
    /** El contrato del renderer valida antes de pintar: un porcentaje >100 tiraba el projection. */
    expect(() =>
      viewProjectionV2Schema.parse(JSON.parse(JSON.stringify(projection))),
    ).not.toThrow();
    const reported = projection.facilities.filter((entry) => entry.serviceMetrics !== null);
    expect(reported.length).toBeGreaterThan(0);
    for (const facility of projection.facilities) {
      expect(facility).not.toHaveProperty("coverage");
      if (!facility.serviceMetrics) continue;
      expect(Object.keys(facility.serviceMetrics).sort()).toEqual([
        "effectiveCapacity",
        "firstChoiceDemand",
        "saturated",
        "served",
        "utilizationPercent",
      ]);
    }
    /** La receptora de spill llega al inspector con cifras coherentes y sin ratio inflado. */
    const receiver = reported.find((entry) => entry.id === second.id);
    expect(receiver).toBeDefined();
    expect(receiver!.serviceMetrics!.served).toBeGreaterThan(
      receiver!.serviceMetrics!.firstChoiceDemand,
    );
    expect(receiver!.serviceMetrics!.utilizationPercent).toBeLessThanOrEqual(100);
  });
});
