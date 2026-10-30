import { describe, expect, it } from "vitest";

import { parseBuildingId, type Building, type Parcel } from "@landlord/shared";
import {
  facilityCoverageForDistrict,
  facilityCoverageIndex,
  fireDamageForBuilding,
  injuredRecoveryDays,
  type FacilityServiceId,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
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

/**
 * H2-05 · la demanda es el desarrollo urbano, no el censo catastral. Un fixture con cero edificios
 * privados ya no activa ningún servicio, así que los tests que miden "cobertura" tienen que
 * construir solares primero. El helper pone `count` edificios en las primeras parcelas del
 * distrito, ordenadas por id para que sea determinista.
 */
function developParcels(
  state: GameState,
  districtId: string,
  count: number,
  serialStart = 0,
): Parcel[] {
  const parcels = parcelsOf(state, districtId).slice(0, count);
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(serialStart + index).padStart(8, "0")}`);
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    state.phase2.buildings.set(id, {
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
  return parcels;
}

describe("V.d.5 cobertura por grafo", () => {
  it("asigna demanda y publica saturación de capacidad", () => {
    const state = createInitialState(7);
    /**
     * H2-05 + H2-07: para saturar un capacity service hay que desarrollar más parcelas que su
     * capacidad efectiva. Con el calibrado nuevo:
     *   - security 2 × 2 cohortes × 75 = 300 slots por city;
     *   - education 3 × 6 cohortes × 17 = 306 slots.
     * Se llenan 500 parcelas en el Centro Cívico y 100 en los demás distritos. El objetivo no
     * es saturar un servicio concreto sino demostrar que, más allá de la capacidad, el informe
     * reporta `saturated: true` y la utilización llena el cupo: `served === effectiveCapacity`,
     * `utilizationPercent === 100` (H2.1-01).
     */
    const centro = districtIdByName(state, "Centro Cívico");
    developParcels(state, centro, 500, 0);
    for (const district of state.world.districts.values()) {
      if ((district.district.id as string) === centro) continue;
      developParcels(state, district.district.id as string, 100, 800);
    }
    const index = facilityCoverageIndex(state);
    const reports = [...index.facilities.values()];
    expect(reports.length).toBeGreaterThan(0);
    const saturated = reports.filter((report) => report.saturated);
    expect(saturated.length, "al menos una facility saturada").toBeGreaterThan(0);
    for (const report of saturated) {
      expect(report.served).toBe(report.effectiveCapacity);
      expect(report.utilizationPercent).toBe(100);
    }
    /**
     * H2.1-01: ninguna facility puede reportar una utilización fuera de 0..100 ni una cifra que
     * se preste a leer `served / firstChoiceDemand` como si fuera un porcentaje de cobertura.
     */
    for (const report of reports) {
      expect(report.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(report.utilizationPercent).toBeLessThanOrEqual(100);
      expect(report.served).toBeLessThanOrEqual(report.effectiveCapacity);
    }
  });

  it("un recorte de presupuesto reduce la capacidad efectiva sin quitar el edificio", () => {
    const state = createInitialState(7);
    const centro = districtIdByName(state, "Centro Cívico");
    const developed = developParcels(state, centro, 20, 100);
    const before = facilityCoverageIndex(state);
    const coveredBefore = developed.filter(
      (parcel) => (before.byParcelId.get(parcel.id)?.security ?? 0) > 0,
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
    /**
     * H2-05: la parcela sin frente se queda sin cobertura tanto en capacity services (no
     * alcanza la facility) como en parks/transport. Se construye encima para que FORME parte
     * de la demanda y el test siga comprobando que el grafo no atraviesa suelo —si no, la
     * parcela sería vacante y no tendría cobertura por diseño, no por ausencia de frente.
     */
    developParcels(state, parcel.districtId, 1, 900);
    const index = facilityCoverageIndex(state);
    for (const service of SERVICES) {
      expect(index.byParcelId.get(parcel.id)![service], service).toBe(0);
    }
  });

  it("usa un único helper para fuego y salud", () => {
    const state = createInitialState(7);
    /**
     * H2-05: desarrollar parcelas en varios distritos para que alguno tenga cobertura de fuego
     * y alguno no, y que un distrito cruce el umbral de salud y otro no.
     */
    const districtIds = [...state.world.city.districtIds];
    let serial = 1000;
    for (const districtId of districtIds) {
      developParcels(state, districtId as string, 20, serial);
      serial += 100;
    }
    const index = facilityCoverageIndex(state);
    const parcels = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.disposition === "marketable",
    );
    const covered = parcels.find((parcel) => index.byParcelId.get(parcel.id)!.fire === 100)!;
    const uncovered = parcels.find((parcel) => index.byParcelId.get(parcel.id)!.fire === 0)!;
    expect(
      fireDamageForBuilding(state, { parcelIds: [covered.id] }, 50).intensityGrowth,
    ).toBeLessThan(fireDamageForBuilding(state, { parcelIds: [uncovered.id] }, 50).intensityGrowth);
    expect(
      fireDamageForBuilding(state, { parcelIds: [covered.id] }, 50).structuralDamage,
    ).toBeLessThan(
      fireDamageForBuilding(state, { parcelIds: [uncovered.id] }, 50).structuralDamage,
    );
    const coveredHealth = districtIds.find(
      (districtId) => facilityCoverageForDistrict(state, districtId, "health") >= 50,
    )!;
    const uncoveredHealth = districtIds.find(
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

  it("la seguridad del índice urbano sale del grafo, no de un radio", () => {
    /**
     * V.d.5 + H2-05 · reformulado. "Sin comisarías cerca, el rollup del distrito es 0" seguía
     * siendo cierto en el modelo antiguo porque la Voronoi asignaba TODAS las parcelas marketables
     * y la comisaría de 50 slots sólo servía a las 50 más baratas del centro. Con H2-05, un
     * distrito con 20 parcelas desarrolladas puede servir vía gateways a un vecino: la cobertura
     * llega POR RED, no POR RADIOS. Lo que sigue sin existir es un radio: si se cortan las
     * conexiones del distrito, la cobertura cae a 0.
     */
    const state = createInitialState(7);
    const lomas = districtIdByName(state, "Lomas del Umbral");
    const centro = districtIdByName(state, "Centro Cívico");
    developParcels(state, centro, 20, 100);
    developParcels(state, lomas, 20, 200);
    const connected = facilityCoverageIndex(state);
    expect(connected.byDistrictId.get(centro as never)!.security).toBeGreaterThan(0);
    /** Lomas tiene cobertura sólo si las comisarías de Centro alcanzan por grafo. */
    /** Se cortan las conexiones del distrito: la cobertura por grafo desaparece. */
    state.world.city.connections = state.world.city.connections.filter(
      (connection) => connection.fromDistrictId !== lomas && connection.toDistrictId !== lomas,
    );
    const isolated = facilityCoverageIndex(state);
    expect(isolated.byDistrictId.get(lomas as never)!.security).toBe(0);
  });

  it("una parcela vacante conserva parks/transport pero no consume capacity", () => {
    /**
     * H2-05 · invariante del contrato: la accesibilidad (parks/transport) sigue midiendo sobre
     * toda parcela marketable, pero la capacidad (security/fire/health/education/market) se
     * asigna sólo sobre DESARROLLADAS. Una parcela sin edificio no aparece en el grupo de
     * Voronoi de ninguna facility.
     */
    const state = createInitialState(7);
    const centro = districtIdByName(state, "Centro Cívico");
    const developed = developParcels(state, centro, 10, 500);
    const allParcels = parcelsOf(state, centro);
    const vacant = allParcels.filter(
      (parcel) => !developed.some((built) => built.id === parcel.id),
    );
    const index = facilityCoverageIndex(state);
    /** Parks/transport: una parcela vacante del centro puede estar servida. */
    const anyVacantWithParks = vacant.some(
      (parcel) => (index.byParcelId.get(parcel.id)?.parks ?? 0) > 0,
    );
    expect(anyVacantWithParks).toBe(true);
    /** Capacity: las parcelas del distrito observado no pueden estar servidas si están vacantes. */
    for (const parcel of vacant) {
      const coverage = index.byParcelId.get(parcel.id)!;
      expect(coverage.security, parcel.id).toBe(0);
      expect(coverage.fire, parcel.id).toBe(0);
      expect(coverage.health, parcel.id).toBe(0);
      expect(coverage.education, parcel.id).toBe(0);
      expect(coverage.market, parcel.id).toBe(0);
    }
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
    /** H2-05: sin edificios privados no hay demanda activa; se construye el distrito del jugador. */
    const centro = districtIdByName(state, "Centro Cívico");
    developParcels(state, centro, 20, 300);
    const projection = createViewProjection(state, true);
    const parcel = projection.economy!.parcels.find((entry) =>
      Object.values(entry.serviceCoverage).some((value) => value > 0),
    );
    expect(parcel).toBeDefined();
    expect(parcel!.serviceCoverage.transport).toBeGreaterThanOrEqual(0);
    expect(
      projection.facilities.some(
        (facility) =>
          facility.serviceMetrics !== null && facility.serviceMetrics.firstChoiceDemand > 0,
      ),
    ).toBe(true);
  });
});
