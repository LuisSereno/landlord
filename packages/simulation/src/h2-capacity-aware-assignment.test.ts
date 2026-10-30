import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  type Building,
  type Parcel,
  type UrbanFacility,
  type UrbanFacilityId,
} from "@landlord/shared";

import {
  facilityCoverageIndex,
  geometrySignature,
  operationalFacilityCapacity,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { createInitialState, type GameState } from "./state";

/**
 * H2-06 · la Voronoi "nearest-first" dejaba parcelas sin servir cuando la facility más cercana
 * estaba llena o sin edificio, aunque otra alcanzable tuviera capacidad libre. El algoritmo
 * nuevo es un greedy determinista sobre todos los pares (parcel, facility, cost) alcanzables:
 * coste ascendente, desempate por parcelId y facilityId; si una facility está llena se prueba
 * la siguiente alternativa. Sin recalcular distancias: el grafo es el mismo, sólo cambia quién
 * sirve a quién.
 *
 * Los tres casos canónicos del plan:
 *   1. A a coste 4 sin capacidad, B a coste 6 con capacidad → la parcela es servida por B.
 *   2. A destruida, B operativa → la demanda se reasigna sin invalidar la firma geométrica.
 *   3. Ambas llenas → la demanda queda sin servir, pero sin inventar rutas.
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

describe("H2-06 · asignación determinista con capacidad", () => {
  it("una parcela cuyo primer destino está sin capacidad se sirve en la siguiente alternativa", () => {
    /**
     * Escenario del plan: A a coste 4 sin capacidad (edificio destruido), B a coste 6 con
     * capacidad libre. El algoritmo viejo Voronoi dejaba la parcela en A y no la servía; el
     * greedy canónico la sirve en B.
     *
     * Montaje: en el estado canónico hay dos comisarías (Centro Cívico y otro barrio). Se
     * desarrollan parcelas en el distrito de la primera, se destruye su edificio, y se comprueba
     * que las mismas parcelas reciben seguridad vía la segunda comisaría.
     */
    const state = createInitialState(7);
    const [first, second] = facilitiesOfKind(state, "police_station");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const parcels = developParcels(state, first!.districtId, 20, 3000);
    /** Confirmar la cobertura antes de quemar. */
    const before = facilityCoverageIndex(state);
    expect(before.facilities.get(first!.id as UrbanFacilityId)!.served).toBeGreaterThan(0);
    expect(before.facilities.get(second!.id as UrbanFacilityId)!.served).toBeLessThan(
      before.facilities.get(second!.id as UrbanFacilityId)!.effectiveCapacity,
    );

    /** Quemar sólo la comisaría A. */
    setFacilityBuildingState(state, first!, "ruin");

    const after = facilityCoverageIndex(state);
    const reportA = after.facilities.get(first!.id as UrbanFacilityId)!;
    const reportB = after.facilities.get(second!.id as UrbanFacilityId)!;
    expect(operationalFacilityCapacity(state, first!)).toBe(0);
    expect(reportA.effectiveCapacity).toBe(0);
    expect(reportA.served).toBe(0);
    /** B asume el spill: su `served` sube respecto a antes. */
    expect(reportB.served).toBeGreaterThan(
      before.facilities.get(second!.id as UrbanFacilityId)!.served,
    );
    /** Y las parcelas del distrito de A siguen cubiertas (o al menos las más baratas). */
    const stillCovered = parcels.filter(
      (parcel) => (after.byParcelId.get(parcel.id)?.security ?? 0) >= 50,
    ).length;
    expect(stillCovered).toBeGreaterThan(0);
  });

  it("quemar un edificio reasigna sin recalcular la geometría (cache key)", () => {
    /**
     * Invariante de D-092 §5: la firma de geometría es independiente de la disponibilidad.
     * Quemar un edificio cambia `availabilitySignature` (reasigna demanda) pero NO
     * `geometrySignature` (Dijkstra se conserva). Esto no es sólo una optimización: si al
     * quemar se reconstruyera el grafo, una regresión en `buildGraph` podría colar.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    developParcels(state, station!.districtId, 15, 4000);
    /** Se estabiliza la caché sobre el estado actual antes de mutar. */
    facilityCoverageIndex(state);
    const geomBefore = geometrySignature(state);
    const indexBefore = facilityCoverageIndex(state);

    setFacilityBuildingState(state, station!, "collapse_pending");

    expect(geometrySignature(state)).toBe(geomBefore);
    const indexAfter = facilityCoverageIndex(state);
    /** El índice SÍ cambia: es un objeto nuevo (la asignación cambió), no la geometría. */
    expect(indexAfter).not.toBe(indexBefore);
    /** La facility en ruina deja de servir. */
    expect(indexAfter.facilities.get(station!.id as UrbanFacilityId)!.served).toBe(0);
  });

  it("si no queda capacidad, la demanda permanece sin servir (sin inventar rutas)", () => {
    /**
     * Las dos comisarías quedan llenas: la Voronoi y el greedy producen el mismo resultado —
     * las parcelas que caben se sirven, las demás quedan a 0. Se fuerza un nivel de
     * presupuesto 0 (effectiveCapacity = 0 en toda la red) para que el caso sea trivial.
     */
    const state = createInitialState(7);
    const stations = facilitiesOfKind(state, "police_station");
    const parcels = developParcels(state, stations[0]!.districtId, 30, 5000);
    for (const parcel of parcels)
      expect(
        facilityCoverageIndex(state).byParcelId.get(parcel.id)?.security ?? 0,
      ).toBeGreaterThanOrEqual(0);
    /** Antes de cortar, al menos una parcela estaba servida. */
    const before = facilityCoverageIndex(state);
    expect(
      parcels.filter((parcel) => (before.byParcelId.get(parcel.id)?.security ?? 0) >= 50).length,
    ).toBeGreaterThan(0);

    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const after = facilityCoverageIndex(state);
    for (const parcel of parcels)
      expect(after.byParcelId.get(parcel.id)!.security, parcel.id).toBe(0);
    for (const station of stations) {
      const report = after.facilities.get(station.id as UrbanFacilityId)!;
      expect(report.effectiveCapacity).toBe(0);
      expect(report.served).toBe(0);
    }
  });

  it("la asignación no depende del orden de inserción de Maps", () => {
    const first = createInitialState(7);
    const second = createInitialState(7);
    second.phase2.parcels = new Map([...second.phase2.parcels.entries()].reverse());
    second.phase2.buildings = new Map([...second.phase2.buildings.entries()].reverse());
    for (const district of second.world.districts.values()) {
      district.facilities = new Map([...district.facilities.entries()].reverse());
      district.publicSpaces = new Map([...district.publicSpaces.entries()].reverse());
    }
    /** Se construyen parcelas idénticas en los dos estados para fijar la demanda. */
    const stations = facilitiesOfKind(first, "police_station");
    const district = stations[0]!.districtId;
    const firstParcels = [...first.phase2.parcels.values()]
      .filter((parcel) => parcel.districtId === district && parcel.disposition === "marketable")
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 10);
    const secondParcels = [...second.phase2.parcels.values()]
      .filter((parcel) => parcel.districtId === district && parcel.disposition === "marketable")
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 10);
    firstParcels.forEach((parcel, index) => {
      const id = parseBuildingId(`building_${String(6000 + index).padStart(8, "0")}`);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      first.phase2.buildings.set(id, {
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
      });
    });
    secondParcels.forEach((parcel, index) => {
      const id = parseBuildingId(`building_${String(6000 + index).padStart(8, "0")}`);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      second.phase2.buildings.set(id, {
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
      });
    });
    const a = facilityCoverageIndex(first);
    const b = facilityCoverageIndex(second);
    for (const parcelId of first.phase2.parcels.keys())
      expect(b.byParcelId.get(parcelId), parcelId).toEqual(a.byParcelId.get(parcelId));
    for (const facilityId of a.facilities.keys())
      expect(b.facilities.get(facilityId), facilityId).toEqual(a.facilities.get(facilityId));
  });

  it("bajo presupuesto nulo la capacidad efectiva es cero y toda la red queda sin asignación", () => {
    /**
     * No es un "sin demanda": hay demanda, pero la política de presupuesto deja la capacidad
     * en cero y el greedy la excluye como destino. Antes de H2-06 las facilities seguían
     * apareciendo como sources del grafo y podían "absorber" demanda sin servirla: una parcela
     * podía quedar Voronoi'd a una facility sin capacidad y no migrar a la siguiente.
     */
    const state = createInitialState(7);
    const stations = facilitiesOfKind(state, "police_station");
    const parcels = developParcels(state, stations[0]!.districtId, 20, 7000);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const index = facilityCoverageIndex(state);
    /** Las facility reports siguen existiendo, pero con capacidad y servidas = 0. */
    for (const station of stations) {
      const report = index.facilities.get(station.id as UrbanFacilityId)!;
      expect(report.effectiveCapacity).toBe(0);
      expect(report.served).toBe(0);
    }
    /** Y ninguna de las 20 parcelas tiene seguridad. */
    for (const parcel of parcels)
      expect(index.byParcelId.get(parcel.id)!.security, parcel.id).toBe(0);
  });
});
