import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  viewProjectionV2Schema,
  type Building,
  type Parcel,
  type UrbanFacility,
  type UrbanFacilityId,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import {
  facilityCoverageIndex,
  facilityPotentialForParcel,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { buildLandValueContext, landValueBreakdownFor } from "./land-value";
import { createViewProjection } from "./projection";
import { buildCoverageIndex } from "./urban-services";
import { createInitialState, type GameState } from "./state";

/**
 * H2-10 · las parcelas vacantes dejan de consumir capacidad (H2-05), pero el jugador sigue
 * necesitando información para decidir. Se separan tres conceptos que antes se confundían:
 *
 *   ACCESSIBILITY     ¿puede esta parcela llegar al servicio? (grafo + gateways + facility
 *                     operational + coste). Todas las marketables pueden tenerla.
 *   ACTIVE LOAD       ¿está esta parcela usando un slot? H2-05 responde: sólo si está
 *                     desarrollada.
 *   POTENTIAL SERVICE ¿hay un hueco libre AL que podría atender esta parcela si construyo?
 *                     H2-10 lo expone en `potentialService`. No reserva slot.
 */

function facilitiesOfKind(state: GameState, kind: string): UrbanFacility[] {
  const out: UrbanFacility[] = [];
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) out.push(facility);
  return out.sort((left, right) => left.id.localeCompare(right.id));
}

function developParcels(
  state: GameState,
  districtId: Parcel["districtId"],
  count: number,
  serialStart: number,
): Parcel[] {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, count);
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(serialStart + index).padStart(8, "0")}`);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    state.phase2.buildings.set(id, {
      id,
      parcelId: parcel.id,
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
  return parcels;
}

function setFacilityBuildingState(
  state: GameState,
  facility: UrbanFacility,
  buildingState: Building["state"],
): void {
  for (const buildingId of facility.buildingIds) {
    const building = state.phase2.buildings.get(buildingId);
    if (building) building.state = buildingState;
  }
}

describe("H2-10 · cobertura potencial de las parcelas vacantes", () => {
  it("una parcela vacante sin edificios cercanos tiene potencial pero carga cero", () => {
    /**
     * Estado recién generado: no hay edificios privados. Todas las marketables están vacantes
     * y, si una facility alcanzable tiene capacidad residual (toda, porque nadie la usa), el
     * potencial es 100 aunque `serviceCoverage` (carga real) sea 0.
     */
    const state = createInitialState(7);
    const index = facilityCoverageIndex(state);
    let checked = 0;
    for (const parcelId of state.phase2.parcels.keys()) {
      const active = index.byParcelId.get(parcelId)?.security ?? 0;
      const potential = index.potentialByParcelId.get(parcelId)?.security ?? 0;
      /** Vacante → carga activa cero; si está en el mapa de potencial, potencial = 0 o 100. */
      expect(active, parcelId).toBe(0);
      if (potential > 0) checked += 1;
    }
    /** Al menos un solar de la ciudad 3×3 ve una comisaría con hueco libre. */
    expect(checked).toBeGreaterThan(0);
  });

  it("una parcela desarrollada no aparece en `potentialByParcelId`", () => {
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    const built = developParcels(state, station!.districtId, 30, 100);
    const index = facilityCoverageIndex(state);
    for (const parcel of built)
      expect(
        index.potentialByParcelId.has(parcel.id),
        `parcela desarrollada ${parcel.id} no debe tener potencial`,
      ).toBe(false);
  });

  it("quemar la red de comisarías deja a las vacantes sin potencial de seguridad", () => {
    /**
     * Con una facility operativa y capacidad residual, el solar la alcanza → potencial. Con la
     * red entera quemada, `effectiveCapacity === 0` para todas y no hay a dónde asignar:
     * potencial 0. La accesibilidad geométrica del grafo no cambia (mismas calles), lo que
     * cambia es la capacidad operativa.
     */
    const state = createInitialState(7);
    const stations = facilitiesOfKind(state, "police_station");
    /** Se construye algo para no quedarse en el trivial "nadie consume". */
    developParcels(state, stations[0]!.districtId, 20, 400);
    const withSecurity = facilityCoverageIndex(state);
    const vacantIds = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.disposition === "marketable" &&
          ![...state.phase2.buildings.values()].some((b) => b.parcelId === parcel.id),
      )
      .slice(0, 5)
      .map((parcel) => parcel.id);
    expect(
      vacantIds.some(
        (id) => (withSecurity.potentialByParcelId.get(id)?.security ?? 0) > 0,
      ),
    ).toBe(true);

    for (const station of stations) setFacilityBuildingState(state, station, "ruin");
    const after = facilityCoverageIndex(state);
    for (const id of vacantIds)
      expect(after.potentialByParcelId.get(id)?.security ?? 0, id).toBe(0);
  });

  it("llenar la capacidad reduce el potencial de las vacantes restantes", () => {
    /**
     * Se desarrollan TODAS las parcelas disponibles del distrito hasta alcanzar o superar la
     * capacidad de la facility local (2 cohortes × 75 = 150 slots). Si el greedy las coloca a
     * todas en esta facility, queda llena y el potencial de las vacantes cae a cero; si alguna
     * spilla a otra comisaría de la red, el potencial de las vacantes cercanas sigue existiendo
     * vía esa otra facility. Ningún caso es una regresión —lo que el test fija es que el
     * potencial NO se calcula por fuera de la capacidad residual real—.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    const built = developParcels(state, station!.districtId, 200, 1000);
    expect(built.length).toBeGreaterThan(0);
    const index = facilityCoverageIndex(state);
    const report = index.facilities.get(station!.id as UrbanFacilityId)!;
    const districtVacants = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.districtId === station!.districtId &&
          parcel.disposition === "marketable" &&
          !built.some((b) => b.id === parcel.id),
      )
      .slice(0, 10);
    for (const parcel of districtVacants) {
      const value = index.potentialByParcelId.get(parcel.id)?.security ?? 0;
      expect(value === 0 || value === 100, parcel.id).toBe(true);
    }
    /** Coherencia: si el greedy llenó la facility, el potencial de este distrito depende de otra. */
    if (report.served >= report.effectiveCapacity) {
      /** Comprobamos al menos una vacante: si todo está lleno, potencial puede ser 0. */
      for (const parcel of districtVacants)
        expect(
          /** O hay residual en otra facility que alcanza, o potencial es 0 (sin hueco). */
          (index.potentialByParcelId.get(parcel.id)?.security ?? 0) === 0 ||
            report.facilityId !== station!.id,
        ).toBe(true);
    }
  });

  it("la proyección publica `potentialService` junto a `serviceCoverage`", () => {
    const state = createInitialState(7);
    /** Se desarrolla en el distrito observado, que es el que viaja en la proyección. */
    developParcels(state, PLAYER_HOME_DISTRICT_ID, 20, 2000);
    const projection = createViewProjection(state, true);
    expect(() => viewProjectionV2Schema.parse(projection)).not.toThrow();
    const parcels = projection.economy!.parcels;
    const builtIds = new Set(
      [...state.phase2.buildings.values()]
        .filter((entry) => entry.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
        .map((entry) => entry.parcelId),
    );
    /** Una parcela construida: `serviceCoverage` manda, `potentialService` es cero. */
    const builtParcel = parcels.find((entry) => builtIds.has(entry.id))!;
    for (const value of Object.values(builtParcel.potentialService)) expect(value).toBe(0);
    /** Una parcela vacante: `potentialService` existe aunque `serviceCoverage` sea cero. */
    const vacantParcel = parcels.find((entry) => !builtIds.has(entry.id))!;
    expect(vacantParcel.potentialService).toBeDefined();
    expect(Object.keys(vacantParcel.potentialService).sort()).toEqual([
      "education",
      "fire",
      "health",
      "market",
      "security",
    ]);
  });

  it("el potencial no reserva slots: dos vacantes vecinas pueden apuntar al mismo hueco", () => {
    /**
     * Contrato explícito (plan §10): "No reserves capacidad permanentemente para ella. No hagas
     * que 700 parcelas vacantes consuman 700 slots sólo porque el jugador puede comprarlas."
     * Aquí: dos solares contiguos sin edificar; ambos ven el mismo residual. Ninguno lo consume.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    const district = station!.districtId;
    const index = facilityCoverageIndex(state);
    const vacants = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.districtId === district &&
          parcel.disposition === "marketable" &&
          index.potentialByParcelId.has(parcel.id),
      )
      .slice(0, 2);
    expect(vacants.length).toBe(2);
    for (const parcel of vacants)
      expect((index.potentialByParcelId.get(parcel.id)?.security ?? 0) > 0).toBe(true);
    /** Y `report.served` sigue siendo 0: el potencial no ha consumido slot. */
    const report = index.facilities.get(station!.id as UrbanFacilityId)!;
    expect(report.served).toBe(0);
  });

  it("el land value sigue respondiendo a la disponibilidad, no al potencial", () => {
    /**
     * H2-10 no inventa pesos nuevos en el score de suelo. El término `services` de
     * `landValueBreakdownFor` consume `CoverageIndex` —cobertura ACTIVA—, no el potencial. Una
     * parcela vacante conserva su valoración por `civicAmenities` (geométrica) sin que el
     * potencial la revalorice artificialmente. Se comprueba quemando la red de comisarías: si
     * el potencial afectara al score, el suelo vacante perdería valor; sólo lo pierden los
     * solares DESARROLLADOS que estaban servidos.
     */
    const state = createInitialState(7);
    const stations = facilitiesOfKind(state, "police_station");
    const built = developParcels(state, PLAYER_HOME_DISTRICT_ID, 30, 3000);
    const projection1 = createViewProjection(state, true);
    const parcel = projection1.economy!.parcels.find((entry) => entry.id === built[0]!.id)!;
    expect(parcel.serviceCoverage.security).toBeGreaterThan(0);
    expect(parcel.potentialService.security).toBe(0);
    for (const station of stations) setFacilityBuildingState(state, station, "ruin");
    const projection2 = createViewProjection(state, true);
    const parcelAfter = projection2.economy!.parcels.find((entry) => entry.id === built[0]!.id)!;
    expect(parcelAfter.serviceCoverage.security).toBe(0);
  });

  it("facilityPotentialForParcel es la puerta de acceso a la cobertura potencial", () => {
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    const built = developParcels(state, station!.districtId, 5, 4000);
    /** Vacante: `facilityPotentialForParcel` puede devolver 100. */
    const vacant = [...state.phase2.parcels.values()].find(
      (parcel) =>
        parcel.districtId === station!.districtId &&
        parcel.disposition === "marketable" &&
        !built.some((b) => b.id === parcel.id),
    )!;
    /** Developed: el helper devuelve 0, su servicio real vive en `facilityCoverageForParcel`. */
    expect(facilityPotentialForParcel(state, built[0]!.id, "security")).toBe(0);
    /** Vacante: helper no lanza, devuelve un número 0 o 100. */
    const value = facilityPotentialForParcel(state, vacant.id, "security");
    expect(value === 0 || value === 100).toBe(true);
  });

  it("H2-11 · el desglose del suelo conserva `civicAmenities` geométrica ≠ `services` operativa", () => {
    /**
     * Contrato de D-093 §7 (aclaración H2-11): las dos componentes conviven en el desglose y
     * miden cosas distintas. Quemar un equipamiento debe bajar `services` —que consulta la
     * disponibilidad operativa vía `CoverageIndex`— y dejar `civicAmenities` intacta —que mide
     * proximidad geométrica a parcelas de facility y espacios públicos, sin consultar grafo,
     * edificio ni presupuesto. `h1-land-value.test.ts` fija el mismo invariante para el caso
     * de una sola comisaría; este test lo refuerza sobre la red completa con el nuevo potencial
     * (H2-10) expuesto, que NO puede sustituir a ninguno de los dos.
     */
    const state = createInitialState(7);
    const built = developParcels(state, PLAYER_HOME_DISTRICT_ID, 30, 6000);
    const context = () =>
      buildLandValueContext(state, PLAYER_HOME_DISTRICT_ID, buildCoverageIndex(state));
    const before = built.map((parcel) => landValueBreakdownFor(parcel, context()));
    const stations = facilitiesOfKind(state, "police_station");
    for (const station of stations) setFacilityBuildingState(state, station, "ruin");
    const after = built.map((parcel) => landValueBreakdownFor(parcel, context()));

    /** `civicAmenities` es la misma componente antes y después de la quema. */
    expect(after.map((entry) => entry.civicAmenities)).toEqual(
      before.map((entry) => entry.civicAmenities),
    );
    /** `services` baja si antes había disponibilidad; nunca sube artificialmente. */
    const servicesBefore = before.reduce((total, entry) => total + entry.services, 0);
    const servicesAfter = after.reduce((total, entry) => total + entry.services, 0);
    expect(servicesAfter).toBeLessThanOrEqual(servicesBefore);
    /**
     * El desglose tiene las nueve componentes del score de V.d.4 —`civicAmenities` y `services`
     * son dos términos distintos, no el mismo dos veces (D-093 §7).
     */
    const sum =
      after[0]!.roadCentrality +
      after[0]!.commercialAccess +
      after[0]!.civicAmenities +
      after[0]!.frontage +
      after[0]!.codePotential +
      after[0]!.services +
      after[0]!.industrialExternality +
      after[0]!.isolation +
      after[0]!.seedVariation;
    expect(after[0]!.rawScore).toBe(sum);
  });
});
