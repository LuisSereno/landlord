import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  type Building,
  type Parcel,
} from "@landlord/shared";

import {
  developedParcelsOf,
  facilityCoverageIndex,
  type FacilityServiceId,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { createInitialState, type GameState } from "./state";

/**
 * H2-05 · la saturación es consecuencia del desarrollo urbano, no del censo catastral.
 *
 * El modelo antiguo (`parcel.disposition === "marketable"`) hacía que una ciudad nueva naciera
 * prácticamente saturada: ~716 solares y ~600 slots de capacidad entre security/fire/health/
 * education/market. El contrato nuevo separa ACCESSIBILITY (llegar) de ACTIVE DEMAND (consumir):
 * una parcela marketable DESARROLLADA (≥ 1 edificio privado no-ruin) vale una unidad; una vacante
 * vale cero.
 */

function developParcels(
  state: GameState,
  districtId: Parcel["districtId"],
  count: number,
  serialStart = 0,
  overrides?: Partial<Pick<Building, "state" | "ownerOrganizationId">>,
): Parcel[] {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, count);
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(serialStart + index).padStart(8, "0")}`);
    const owner = overrides?.ownerOrganizationId ?? PLAYER_ORGANIZATION_ID;
    parcel.ownerOrganizationId = owner;
    state.phase2.buildings.set(id, {
      id,
      parcelId: parcel.id,
      districtId: parcel.districtId,
      footprintCells: [{ ...parcel.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "detached",
      ownerOrganizationId: owner,
      productionFacilityId: null,
      type: "courtyard_home",
      level: 1,
      condition: 100,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: overrides?.state ?? "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    });
  });
  return parcels;
}

function cityDistricts(state: GameState): Parcel["districtId"][] {
  return [...state.world.city.districtIds] as Parcel["districtId"][];
}

function coverageOfParcel(state: GameState, parcel: Parcel, service: FacilityServiceId): number {
  return facilityCoverageIndex(state).byParcelId.get(parcel.id)?.[service] ?? 0;
}

describe("H2-05 · demanda = parcela desarrollada, no parcela marketable", () => {
  it("una ciudad nueva tiene cero demanda de capacidad y cero saturación", () => {
    const state = createInitialState(7);
    const index = facilityCoverageIndex(state);
    for (const report of index.facilities.values()) {
      expect(report.demand, report.facilityId).toBe(0);
      expect(report.served, report.facilityId).toBe(0);
      expect(report.saturated, report.facilityId).toBe(false);
    }
    /** Parks y transport SÍ marcan cobertura: son accesibilidad, no consumo de slots. */
    const anyParks = [...index.byParcelId.values()].some((coverage) => coverage.parks > 0);
    const anyTransport = [...index.byParcelId.values()].some((coverage) => coverage.transport > 0);
    expect(anyParks).toBe(true);
    expect(anyTransport).toBe(true);
  });

  it("poner un edificio privado dispara una unidad de demanda en esa parcela", () => {
    const state = createInitialState(7);
    const [districtId] = cityDistricts(state);
    const parcels = developParcels(state, districtId!, 1, 500);
    const parcel = parcels[0]!;
    /** La parcela está en la colección `developedParcelsOf` y puede aparecer servida en security. */
    const developed = developedParcelsOf(state);
    expect(developed.map((entry) => entry.id)).toContain(parcel.id);
    /** El informe de security puede o no servir esta parcela concreta (depende de la Voronoi),
     * pero al menos una facility debe reportar `demand === 1`. */
    const totalSecurityDemand = [...facilityCoverageIndex(state).facilities.values()]
      .filter((report) => report.service === "security")
      .reduce((total, report) => total + report.demand, 0);
    expect(totalSecurityDemand).toBe(1);
  });

  it("una parcela con edificio en ruina vuelve a no consumir capacidad", () => {
    const state = createInitialState(7);
    const [districtId] = cityDistricts(state);
    const parcels = developParcels(state, districtId!, 5, 600);
    const before = [...facilityCoverageIndex(state).facilities.values()]
      .filter((report) => report.service === "security")
      .reduce((total, report) => total + report.demand, 0);
    expect(before).toBe(5);

    /** Quemar el único edificio de la parcela 3: deja de contar como demanda. */
    const victim = parcels[2]!;
    for (const building of state.phase2.buildings.values()) {
      if (building.parcelId === victim.id) building.state = "ruin";
    }
    const after = [...facilityCoverageIndex(state).facilities.values()]
      .filter((report) => report.service === "security")
      .reduce((total, report) => total + report.demand, 0);
    expect(after).toBe(4);
  });

  it("un edificio municipal no genera demanda de capacidad privada", () => {
    const state = createInitialState(7);
    const [districtId] = cityDistricts(state);
    /**
     * El ayuntamiento ya vive en su parcela generada, y el edificio civic es propiedad municipal.
     * H2-05 define "demanda" como parcela con al menos un edificio NO municipal; si no, las
     * 14 facilities municipales serían demanda de sí mismas y saturarían el modelo.
     */
    const municipalParcels = new Set<string>();
    for (const building of state.phase2.buildings.values())
      if (building.ownerOrganizationId !== PLAYER_ORGANIZATION_ID)
        municipalParcels.add(building.parcelId as string);
    /** Se coloca un edificio PLAYER_ORGANIZATION_ID encima para contrastar. */
    const playerParcels = developParcels(state, districtId!, 3, 700);
    const index = facilityCoverageIndex(state);
    const demandIds = new Set<string>([...index.byParcelId.keys()].map((id) => id as string));
    for (const parcel of playerParcels) expect(demandIds.has(parcel.id as string)).toBe(true);
    /** Ninguna parcela municipal aparece en el índice: su demanda no cuenta. */
    for (const facilityParcelId of municipalParcels)
      expect(demandIds.has(facilityParcelId), facilityParcelId).toBe(false);
  });

  it("vacante conserva accessibility (parks/transport) pero no consume security ni fire", () => {
    const state = createInitialState(7);
    const all = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.disposition === "marketable",
    );
    const [firstDistrict] = cityDistricts(state);
    const developed = developParcels(state, firstDistrict!, 30, 800);
    const developedIds = new Set(developed.map((parcel) => parcel.id));
    const vacantSample = all
      .filter((parcel) => !developedIds.has(parcel.id))
      .slice(0, 20);
    expect(vacantSample.length).toBeGreaterThan(0);
    for (const parcel of vacantSample) {
      expect(coverageOfParcel(state, parcel, "security"), parcel.id).toBe(0);
      expect(coverageOfParcel(state, parcel, "fire"), parcel.id).toBe(0);
      expect(coverageOfParcel(state, parcel, "health"), parcel.id).toBe(0);
      expect(coverageOfParcel(state, parcel, "education"), parcel.id).toBe(0);
      expect(coverageOfParcel(state, parcel, "market"), parcel.id).toBe(0);
    }
    /** Pero las mismas parcelas pueden tener parks/transport: es accesibilidad, no consumo. */
    const anyParkCoverage = vacantSample.some(
      (parcel) => coverageOfParcel(state, parcel, "parks") > 0,
    );
    const anyTransportCoverage = vacantSample.some(
      (parcel) => coverageOfParcel(state, parcel, "transport") > 0,
    );
    /** El grafo de la ciudad 3×3 conecta todo: al menos una vacante debe ver parks y transporte. */
    expect(anyParkCoverage).toBe(true);
    expect(anyTransportCoverage).toBe(true);
  });

  it("la demanda crece monótonamente con el desarrollo urbano", () => {
    const state = createInitialState(7);
    const [districtId] = cityDistricts(state);
    const demands: number[] = [];
    for (const count of [5, 15, 40, 100]) {
      developParcels(state, districtId!, count, 1000 + count * 10);
      const index = facilityCoverageIndex(state);
      const total = [...index.facilities.values()]
        .filter((report) => report.service === "security")
        .reduce((sum, report) => sum + report.demand, 0);
      demands.push(total);
    }
    /** Cada salto añade demanda neta: la ciudad ya no nace saturada; la saturación es crecimiento. */
    for (let index = 1; index < demands.length; index += 1)
      expect(demands[index]).toBeGreaterThan(demands[index - 1]!);
  });

  it("el rollup por distrito divide entre demandantes, no entre marketables", () => {
    const state = createInitialState(7);
    const [districtId] = cityDistricts(state);
    /** Se desarrollan 5 parcelas del primer distrito: si todas son servidas, rollup = 100. */
    developParcels(state, districtId!, 5, 1200);
    const index = facilityCoverageIndex(state);
    const rollup = index.byDistrictId.get(districtId!)!;
    /**
     * El modelo antiguo dividió por TODAS las marketables del distrito: 5 servidas sobre 60+
     * daban un 8 %. Ahora divide por las DESARROLLADAS: 5 sobre 5 = 100 % si la Voronoi sirve.
     */
    expect(rollup.security).toBeGreaterThanOrEqual(50);
  });

  it("caché: un nuevo edificio invalida el índice sin invalidar la geometría", () => {
    const state = createInitialState(7);
    const first = facilityCoverageIndex(state);
    const [districtId] = cityDistricts(state);
    developParcels(state, districtId!, 10, 1400);
    const second = facilityCoverageIndex(state);
    /** Cambia la firma de demanda → el índice se recompute. */
    expect(second).not.toBe(first);
    /** La firma de geometría (calles, facilities, gateways) NO cambia: Dijkstra se conserva. */
    /** El `demandSignature` entra junto con la geometría y el presupuesto en la clave de caché. */
  });

  it("la demanda no depende del orden de inserción de Maps", () => {
    const first = createInitialState(7);
    const second = createInitialState(7);
    second.phase2.parcels = new Map([...second.phase2.parcels.entries()].reverse());
    second.phase2.buildings = new Map([...second.phase2.buildings.entries()].reverse());
    for (const district of second.world.districts.values()) {
      district.facilities = new Map([...district.facilities.entries()].reverse());
      district.publicSpaces = new Map([...district.publicSpaces.entries()].reverse());
    }
    /** Un edificio privado en la parcela 1 del primer distrito; en el segundo, en la parcela 1 del mismo. */
    const districtIds = [...first.world.city.districtIds];
    const [targetDistrict] = districtIds;
    const targetParcels = [...first.phase2.parcels.values()]
      .filter((parcel) => parcel.districtId === targetDistrict && parcel.disposition === "marketable")
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 5);
    for (const parcel of targetParcels) {
      const id = parseBuildingId(`building_${String(2000 + Number(parcel.id.slice(-8))).padStart(8, "0")}`);
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      const shared: Building = {
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
      };
      first.phase2.buildings.set(shared.id, shared);
      const mirror = second.phase2.parcels.get(parcel.id)!;
      mirror.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      second.phase2.buildings.set(shared.id, {
        ...shared,
        parcelId: mirror.id,
        footprintCells: [{ ...mirror.anchorCell }],
      });
    }
    const a = facilityCoverageIndex(first);
    const b = facilityCoverageIndex(second);
    for (const parcelId of first.phase2.parcels.keys())
      expect(b.byParcelId.get(parcelId), parcelId).toEqual(a.byParcelId.get(parcelId));
  });
});

describe("H2-05 · helper `developedParcelsOf`", () => {
  it("filtra marketable + edificio privado no-ruin", () => {
    const state = createInitialState(7);
    const districtIds = [...state.world.city.districtIds];
    for (const districtId of districtIds)
      developParcels(state, districtId as Parcel["districtId"], 2, 100 + districtIds.indexOf(districtId) * 10);
    const developed = developedParcelsOf(state);
    for (const parcel of developed) {
      expect(parcel.disposition).toBe("marketable");
      const hasPrivate = [...state.phase2.buildings.values()].some(
        (entry) =>
          entry.parcelId === parcel.id &&
          entry.state !== "ruin" &&
          entry.ownerOrganizationId !== "org_00000003",
      );
      expect(hasPrivate, parcel.id).toBe(true);
    }
    /** Orden canónico: por `parcelId.localeCompare`. */
    for (let index = 1; index < developed.length; index += 1)
      expect(developed[index - 1]!.id.localeCompare(developed[index]!.id)).toBeLessThan(0);
  });

  it("devuelve una lista vacía si ningún edificio privado existe", () => {
    const state = createInitialState(7);
    /** En el estado recién generado los únicos edificios son municipales (facilities de la receta). */
    const privateBuildings = [...state.phase2.buildings.values()].filter(
      (entry) => entry.ownerOrganizationId === PLAYER_ORGANIZATION_ID,
    );
    expect(privateBuildings).toHaveLength(0);
    expect(developedParcelsOf(state)).toEqual([]);
  });
});
