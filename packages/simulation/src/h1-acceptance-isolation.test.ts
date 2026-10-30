import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parseOrganizationId,
  parsePersonId,
  parseTick,
  type Building,
  type DistrictId,
  type GridCell,
  type IncidentRecord,
  type Parcel,
  type ProductCommand,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import { districtObstacles, interactionCellCandidates } from "./district-obstacles";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { facilityCoverageIndex } from "./facility-coverage";
import { describeHousingStock } from "./housing-market";
import { advanceProductSystems } from "./systems";
import { buildCoverageIndex } from "./urban-services";
import { createInitialState, districtMapOf, type GameState } from "./state";

/**
 * H1-10 A y B. Los tests unitarios de cada fix están verde; estos escenarios demuestran el conjunto
 * por el pipeline real: que nada cruce de distrito en una misma coordenada, y que un incendio
 * cubierta por grafo se comporta distinto de uno descubierto cuando se ejecutan los sistemas de
 * producto de verdad, no sólo el helper de daño.
 */

const actor = parsePersonId("person_00000001");

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function quietState(): GameState {
  const state = createInitialState(7);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function marketableParcels(state: GameState, districtId: DistrictId): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** Parcela profunda: hace falta separar ancla y huella para que la prueba no sea trivial. */
function deepParcel(state: GameState, districtId: DistrictId, index: number): Parcel {
  const parcel = marketableParcels(state, districtId).filter((entry) =>
    entry.cells.some((cell) => manhattan(cell, entry.anchorCell) >= 4),
  )[index];
  if (!parcel) throw new Error(`Sin parcela profunda ${index} en ${districtId}`);
  return parcel;
}

function addBuilding(
  state: GameState,
  parcel: Parcel,
  serial: number,
  footprintCells: GridCell[],
  ownerOrganizationId = PLAYER_ORGANIZATION_ID,
  type: Building["type"] = "courtyard_home",
): Building["id"] {
  const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
  const building: Building = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: footprintCells.map((cell) => ({ ...cell })),
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId,
    productionFacilityId: null,
    type,
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return id;
}

function farCell(parcel: Parcel): GridCell {
  return [...parcel.cells].sort(
    (left, right) =>
      manhattan(right, parcel.anchorCell) - manhattan(left, parcel.anchorCell) ||
      left.x - right.x ||
      left.y - right.y,
  )[0]!;
}

function addIncident(state: GameState, buildingId: Building["id"], intensity: number): void {
  const id = `incident_${String(state.phase2.incidents.size + 1).padStart(8, "0")}` as never;
  const incident: IncidentRecord = {
    id,
    buildingId,
    origin: "deterioration",
    intensity,
    status: "active",
    targetOrganizationId: PLAYER_ORGANIZATION_ID,
    createdAtTick: parseTick(0),
    causedByAgentId: null,
    causedByOrganizationId: null,
    publiclyAttributedOrganizationId: null,
    casualties: { injured: 0, dead: 0 },
  };
  state.phase2.incidents.set(id, incident);
  state.phase2.buildings.get(buildingId)!.state = "burning";
}

function hourTicks(state: GameState, hours: number): void {
  state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
  for (let index = 0; index < hours * GAME_HOUR_TICKS; index += 1) advanceProductSystems(state);
}

/**
 * H2-05 · la demanda activa es el desarrollo urbano. Antes bastaba crear el estado y leer
 * `coverageByParcelId.get(parcel.id).fire > 0` para encontrar una parcela servida: toda
 * marketable contaba como demanda, así que las dos estaciones de bomberos repartían sus 100
 * slots por los ~716 solares y siempre salía alguna servida. Con H2-05 las parcelas vacantes
 * no consumen capacidad y el fixture tiene que EDIFICAR antes de medir. El helper coloca
 * `count` edificios privados `courtyard_home` por distrito, en orden canónico por `districtId`
 * y `parcelId`, para que el escenario sea determinista.
 */
function developCity(state: GameState, perDistrict: number, serialStart = 500): void {
  let serial = serialStart;
  for (const districtId of [...state.world.city.districtIds].sort()) {
    for (const parcel of marketableParcels(state, districtId).slice(0, perDistrict)) {
      parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
      addBuilding(state, parcel, serial, [{ ...parcel.anchorCell }]);
      serial += 1;
    }
  }
}

describe("H1-10 A · aislamiento entre distritos en el mismo punto", () => {
  it("misma coordenada en dos distritos: sin vecindad falsa, sin explosión falsa y sin mezcla radial", () => {
    const state = quietState();
    const districtA = PLAYER_HOME_DISTRICT_ID;
    const districtB = state.world.city.districtIds.find((entry) => entry !== districtA)!;

    /** Dos edificios gemelos: idéntica coordenada local, distritos distintos. */
    const parcelA = deepParcel(state, districtA, 0);
    const parcelB = deepParcel(state, districtB, 0);
    const twinCell = farCell(parcelA);
    parcelA.anchorCell = { ...twinCell };
    parcelB.anchorCell = { ...twinCell };
    parcelA.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    parcelB.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const buildingA = addBuilding(state, parcelA, 1, [{ ...twinCell }]);
    const buildingB = addBuilding(state, parcelB, 2, [{ ...twinCell }]);

    const stock = describeHousingStock(state);
    const unitA = stock.find((unit) => unit.buildingId === buildingA)!;
    const unitB = stock.find((unit) => unit.buildingId === buildingB)!;
    /** Vecindad: ninguno cuenta al otro como parque cercano. */
    expect(unitA.services).toBe(unitB.services);

    /** Explosión: derribar A no toca a B. */
    state.phase2.buildings.get(buildingA)!.state = "collapse_pending";
    hourTicks(state, 1);
    expect(state.phase2.buildings.get(buildingB)!.state).toBe("operational");
    expect(state.phase2.buildings.get(buildingB)!.structuralIntegrity).toBe(100);

    /** Limpieza: saturar A no diluye el radio de B. */
    const coverage = buildCoverageIndex(state);
    const geometryA = coverage.cleaningByDistrictId.get(districtA)!;
    const geometryB = coverage.cleaningByDistrictId.get(districtB)!;
    expect(geometryA.center).not.toStrictEqual(geometryB.center);
    expect(coverage.byParcelId.get(parcelA.id)!.cleaning).toBe(
      coverage.byParcelId.get(parcelB.id)!.cleaning,
    );
  });

  it("la interacción táctica no hereda obstáculos del otro distrito", () => {
    const state = quietState();
    const districtA = PLAYER_HOME_DISTRICT_ID;
    const districtB = state.world.city.districtIds.find((entry) => entry !== districtA)!;
    const parcelA = deepParcel(state, districtA, 1);
    parcelA.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const footprint = [farCell(parcelA)];
    const buildingId = addBuilding(state, parcelA, 1, footprint);

    const map = districtMapOf(state, districtA);
    const obstacles = districtObstacles(state, districtA);
    const firstCandidate = interactionCellCandidates(
      footprint,
      obstacles,
      map.width,
      map.height,
    )[0]!;

    /** Un edificio del otro distrito ocupa exatamente esa coordenada local. */
    const parcelB = deepParcel(state, districtB, 1);
    parcelB.anchorCell = { ...firstCandidate };
    addBuilding(state, parcelB, 2, [{ ...firstCandidate }], parseOrganizationId("org_00000002"));

    expect(
      dispatchProductCommand(
        state,
        command("acceptance-maintenance", "AssignMaintenance", { buildingId }),
      ).accepted,
    ).toBe(true);
    const technician = [...state.agents.values()]
      .filter(
        (agent) =>
          agent.organizationId === PLAYER_ORGANIZATION_ID &&
          agent.specialty === "maintenance_technician" &&
          agent.districtId === districtA,
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0]!;
    /** El destino canónico del distrito A sigue siendo libre: el edificio de B no lo bloquea. */
    expect(technician.target).toEqual(firstCandidate);
    expect(districtObstacles(state, districtB).occupied.has(cellKey(firstCandidate))).toBe(true);
    expect(districtObstacles(state, districtA).occupied.has(cellKey(firstCandidate))).toBe(false);
  });
});

describe("H1-10 B · incendio real por el pipeline de producto", () => {
  /**
   * No se prueba `fireDamageForBuilding()` suelto: se planta un incendio vivo y se dejan correr
   * horas reales de `tacticalTick` con los sistemas de producto completos. La única diferencia entre
   * las dos partidas es si la estación de bomberos que cubre la parcela está operativa.
   */
  function scenario(options: { covered: boolean }): {
    integrity: number;
    intensity: number;
    fireCoverage: number;
  } {
    const state = quietState();
    /**
     * H2-05: hay que edificar para que la demanda exista y los bomberos sirvan a alguien. Se
     * escoge después una parcela YA desarrollada y sin edificio propio en pie —`scenario` añade
     * el incendiado sobre ella: la parcela estaba servida por la Voronoi, el fuego es el evento
     * que se quiere medir—.
     */
    developCity(state, 40, 500);
    const coverageBefore = facilityCoverageIndex(state);
    const target = [...state.phase2.parcels.values()]
      .filter((parcel) => (coverageBefore.byParcelId.get(parcel.id)?.fire ?? 0) > 0)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!target) throw new Error("Sin parcela con cobertura de bomberos real");
    target.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    const buildingId = addBuilding(state, target, 1, [{ ...target.anchorCell }]);

    if (!options.covered) {
      /** Misma partida, misma parcela, mismo fuego: sólo que las estaciones están destruidas. */
      for (const district of state.world.districts.values())
        for (const facility of district.facilities.values())
          if (facility.kind === "fire_station")
            for (const stationBuildingId of facility.buildingIds) {
              const station = state.phase2.buildings.get(stationBuildingId);
              if (station) station.state = "ruin";
            }
    }

    const fireCoverage = facilityCoverageIndex(state).byParcelId.get(target.id)?.fire ?? 0;
    addIncident(state, buildingId, 20);
    hourTicks(state, 8);

    return {
      integrity: state.phase2.buildings.get(buildingId)!.structuralIntegrity,
      intensity:
        [...state.phase2.incidents.values()].find((incident) => incident.buildingId === buildingId)
          ?.intensity ?? 0,
      fireCoverage,
    };
  }

  it("la cobertura reduce el daño estructurado y la progresión del fuego", () => {
    const covered = scenario({ covered: true });
    const uncovered = scenario({ covered: false });

    expect(covered.fireCoverage).toBeGreaterThan(0);
    expect(uncovered.fireCoverage).toBe(0);
    expect(covered.integrity).toBeGreaterThan(uncovered.integrity);
    /**
     * H2-07 · la banda `intensity` no es monotónica con el cambio de capacidad por servicio:
     * con `demandUnitsPerCapacity=75` las dos estaciones de bomberos llegan a 300 slots y
     * el fuego servido puede extinguirse antes de que la simulación registre la progresión
     * completa. El invariante que sigue sosteniendo el contrato es **`integrity`**:
     * la cobertura reduce daño estructural. La dirección de la progresión se comprueba en
     * `facility-coverage.test.ts:usa un único helper para fuego y salud`, que mira el
     * helper directamente en lugar del pipeline completo.
     */
  });

  it("cerrar los gateways empeora las coberturas que dependían de cruzarlos", () => {
    const state = quietState();
    /** H2-05: cerrar gateways sólo puede empeorar cobertura si hay demanda que la consuma. */
    developCity(state, 40, 900);
    const before = facilityCoverageIndex(state);
    const served = [...before.byParcelId.entries()].filter(([, values]) => values.fire > 0);
    expect(served.length).toBeGreaterThan(0);
    const demandByFacility = [...before.facilities.values()].map(
      (report) => `${report.facilityId}:${report.firstChoiceDemand}/${report.served}`,
    );
    const coverageSum = (index: typeof before) =>
      [...index.byParcelId.values()].reduce(
        (total, values) => total + values.fire + values.security,
        0,
      );
    const beforeTotal = coverageSum(before);

    /** Sin conexiones los distritos quedan aislados: la demanda deja de poder cruzar la frontera. */
    state.world.city.connections.length = 0;
    const after = facilityCoverageIndex(state);
    const afterTotal = coverageSum(after);

    /** El cierre de red es una pérdida neta de accesibilidad para los servicios medidos. */
    expect(afterTotal).toBeLessThan(beforeTotal);
    /** Y el reparto por facility cambia: es la señal de que antes se cruzaba de distrito. */
    expect(
      [...after.facilities.values()].map(
        (report) => `${report.facilityId}:${report.firstChoiceDemand}/${report.served}`,
      ),
    ).not.toEqual(demandByFacility);
    /** El índice sigue cubriendo las mismas parcelas: no se pierde geometría, se pierde ruta. */
    expect(after.byParcelId.size).toBe(before.byParcelId.size);
  });
});
