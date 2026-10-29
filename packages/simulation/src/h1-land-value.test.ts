import { describe, expect, it } from "vitest";
import { parseTick, type Block, type Parcel } from "@landlord/shared";

import { parseCommandId, parseMoney, parsePersonId } from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { activePermitFor } from "./permitting";
import { createMunicipalPolicy, GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { buildLandValueContext, landValueBreakdownFor } from "./land-value";
import { facilityCoverageIndex } from "./facility-coverage";
import { buildCoverageIndex } from "./urban-services";
import { createInitialState, type GameState } from "./state";

/**
 * H1-09. El suelo tiene que reaccionar a dos cosas que V.d.4 y V.d.5 dejaron a medio conectar: la
 * cobertura real de servicios (grafo, gateways y disponibilidad física de la facility) y la
 * oportunidad urbanística vigente de la ordenanza de densidad. Sin inventar pesos nuevos: se usan las
 * nueve componentes del plan y sólo se comprueba la dirección.
 */

function trialOrdinance(state: GameState, status: "active" | "expired"): void {
  const base = createMunicipalPolicy("policy_00000005")!;
  state.phase2.ordinance = {
    ...base,
    status,
    activeFromTick: parseTick(0),
    expiresAtTick: parseTick(status === "active" ? GAME_MONTH_TICKS * 12 : 0),
  };
}

function parcelsByRole(state: GameState, role: Block["urbanRole"]): Parcel[] {
  const out: Parcel[] = [];
  for (const district of state.world.districts.values()) {
    const blocks = new Map(
      [...district.blocks.values()].map((block) => [block.id as string, block]),
    );
    for (const parcel of state.phase2.parcels.values()) {
      if (parcel.disposition !== "marketable") continue;
      if (blocks.get(parcel.blockId as string)?.urbanRole !== role) continue;
      out.push(parcel);
    }
  }
  return out.sort((left, right) => left.id.localeCompare(right.id));
}

function breakdown(state: GameState, parcel: Parcel) {
  return landValueBreakdownFor(
    parcel,
    buildLandValueContext(state, parcel.districtId, buildCoverageIndex(state)),
  );
}

function facilityBuildingIds(state: GameState, kind: string): string[] {
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) return [...facility.buildingIds];
  return [];
}

describe("H1-09B · el potencial normativo consume la ordenanza vigente", () => {
  it("el ensayo de densidad sube el potencial de los solares de corredor", () => {
    const state = createInitialState(7);
    const corridor = parcelsByRole(state, "commercial_corridor");
    expect(corridor.length).toBeGreaterThan(0);
    const before = corridor.slice(0, 5).map((parcel) => breakdown(state, parcel).codePotential);

    trialOrdinance(state, "active");
    const after = corridor.slice(0, 5).map((parcel) => breakdown(state, parcel).codePotential);

    /** El código de corredor está en el borde de la banda (0…12), así que al menos uno sube. */
    expect(Math.max(...after)).toBeGreaterThan(Math.max(...before));
    expect(after.some((value, index) => value > before[index]!)).toBe(true);
  });

  it("los roles no aplicables no se revalorizan con la ordenanza de corredor", () => {
    const state = createInitialState(7);
    const residential = parcelsByRole(state, "urban_residential").slice(0, 5);
    const industrial = parcelsByRole(state, "industrial_logistics").slice(0, 5);
    expect(residential.length).toBeGreaterThan(0);
    expect(industrial.length).toBeGreaterThan(0);

    const before = [
      ...residential.map((parcel) => breakdown(state, parcel).codePotential),
      ...industrial.map((parcel) => breakdown(state, parcel).codePotential),
    ];
    trialOrdinance(state, "active");
    const after = [
      ...residential.map((parcel) => breakdown(state, parcel).codePotential),
      ...industrial.map((parcel) => breakdown(state, parcel).codePotential),
    ];
    expect(after).toEqual(before);
  });

  it("al expirar la ordenanza la oportunidad general vuelve a la del código base", () => {
    const state = createInitialState(7);
    const sample = parcelsByRole(state, "commercial_corridor").slice(0, 5);
    trialOrdinance(state, "expired");
    const base = sample.map((parcel) => breakdown(state, parcel).codePotential);
    trialOrdinance(state, "active");
    const boosted = sample.map((parcel) => breakdown(state, parcel).codePotential);
    trialOrdinance(state, "expired");

    expect(sample.map((parcel) => breakdown(state, parcel).codePotential)).toEqual(base);
    expect(Math.max(...boosted)).toBeGreaterThanOrEqual(Math.max(...base));
  });

  it("el derecho adquirido de un permiso no revaloriza el suelo de la ciudad", () => {
    const state = createInitialState(7);
    const sample = parcelsByRole(state, "commercial_corridor").slice(0, 5);
    trialOrdinance(state, "expired");
    const base = sample.map((parcel) => breakdown(state, parcel).codePotential);

    /** Se concede un permiso durante el ensayo: ése es el único titular del derecho adquirido. */
    trialOrdinance(state, "active");
    const parcel = sample[0]!;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
    state.phase2.permitting.approvalChanceByRole = {
      ...state.phase2.permitting.approvalChanceByRole,
      commercial_corridor: 100,
    };
    expect(
      dispatchProductCommand(state, {
        commandId: parseCommandId("h1-acquired-rights"),
        issuedByPersonId: parsePersonId("person_00000001"),
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type: "RequestPermit",
        payload: { parcelId: parcel.id, buildingType: "apartment_block" },
      } as never).accepted,
    ).toBe(true);
    const permit = activePermitFor(state, parcel.id, "apartment_block", state.clock.tick)!;
    expect(permit.densityBonusFloors).toBe(1);

    /** Al expirar la ordenanza, el potencial del suelo vuelve al código base pese al permiso vivo. */
    trialOrdinance(state, "expired");
    expect(sample.map((entry) => breakdown(state, entry).codePotential)).toEqual(base);
    /** Y el permiso conserva su derecho: lo consume su titular al construir, no el mercado. */
    expect(
      activePermitFor(state, parcel.id, "apartment_block", state.clock.tick)!.densityBonusFloors,
    ).toBe(1);
  });
});

describe("H1-09A · los servicios espaciales mueven el valor en la dirección esperada", () => {
  it("destruir la comisaría baja el valor donde sólo ella daba seguridad", () => {
    const state = createInitialState(7);
    const station = facilityBuildingIds(state, "police_station");
    expect(station.length).toBeGreaterThan(0);
    const covered = [...buildCoverageIndex(state).byParcelId.entries()]
      .filter(([parcelId]) => {
        const parcel = state.phase2.parcels.get(parcelId)!;
        return (facilityCoverageIndex(state).byParcelId.get(parcel.id)?.security ?? 0) > 0;
      })
      .map(([parcelId]) => state.phase2.parcels.get(parcelId)!);
    expect(covered.length).toBeGreaterThan(0);

    const before = covered.slice(0, 5).map((parcel) => breakdown(state, parcel));
    for (const id of station) {
      const building = state.phase2.buildings.get(id as never);
      if (building) building.state = "ruin";
    }
    const after = covered.slice(0, 5).map((parcel) => breakdown(state, parcel));

    for (const entry of before) expect(entry.services).toBeGreaterThan(0);
    expect(after.reduce((total, entry) => total + entry.services, 0)).toBeLessThan(
      before.reduce((total, entry) => total + entry.services, 0),
    );
    expect(after.reduce((total, entry) => total + entry.targetValue, 0)).toBeLessThan(
      before.reduce((total, entry) => total + entry.targetValue, 0),
    );
    /**
     * Sin doble conteo: `civicAmenities` mide proximidad geométrica a equipamientos y no cambia
     * porque el edificio arda; `services` es el canal de disponibilidad. Son componentes distintas.
     */
    expect(after.map((entry) => entry.civicAmenities)).toEqual(
      before.map((entry) => entry.civicAmenities),
    );
  });

  it("cerrar los gateways empeora el valor de los solares que dependían de la red", () => {
    const state = createInitialState(7);
    const sample = parcelsByRole(state, "commercial_corridor").slice(0, 5);
    const before = sample.map((parcel) => breakdown(state, parcel));
    const transportBefore = before.reduce((total, entry) => total + entry.services, 0);

    /** Un corte de red: conexiones vacías = todos los gateways cerrados. */
    const connections = [...state.world.city.connections];
    state.world.city.connections.length = 0;
    const after = sample.map((parcel) => breakdown(state, parcel));
    expect(after.reduce((total, entry) => total + entry.services, 0)).toBeLessThanOrEqual(
      transportBefore,
    );
    state.world.city.connections.push(...connections);
    expect(sample.map((parcel) => breakdown(state, parcel).services)).toEqual(
      before.map((entry) => entry.services),
    );
  });

  it("un recorte presupuestario de seguridad baja el valor y se recupera al reponer", () => {
    const state = createInitialState(7);
    const facilityCoverage = facilityCoverageIndex(state);
    /** Solares a los que de verdad sirve una comisaría: sólo ahí el recorte tiene efecto. */
    const sample = [...state.phase2.parcels.values()]
      .filter(
        (parcel) =>
          parcel.disposition === "marketable" &&
          (facilityCoverage.byParcelId.get(parcel.id)?.security ?? 0) > 0 &&
          breakdown(state, parcel).services > 0,
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 5);
    expect(sample.length).toBeGreaterThan(0);
    const before = sample.map((parcel) => breakdown(state, parcel));

    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const cut = sample.map((parcel) => breakdown(state, parcel));
    expect(cut.reduce((total, entry) => total + entry.services, 0)).toBeLessThan(
      before.reduce((total, entry) => total + entry.services, 0),
    );
    expect(cut.reduce((total, entry) => total + entry.targetValue, 0)).toBeLessThan(
      before.reduce((total, entry) => total + entry.targetValue, 0),
    );

    state.phase2.municipal.serviceLevelPercentByCategory.security = 100;
    expect(sample.map((parcel) => breakdown(state, parcel).services)).toEqual(
      before.map((entry) => entry.services),
    );
  });

  it("la descomposición del score sigue sumando exactamente y el paso mensual respeta el 5 %", () => {
    const state = createInitialState(7);
    for (const parcel of parcelsByRole(state, "commercial_corridor").slice(0, 3)) {
      const entry = breakdown(state, parcel);
      const sum =
        entry.roadCentrality +
        entry.commercialAccess +
        entry.civicAmenities +
        entry.frontage +
        entry.codePotential +
        entry.services +
        entry.industrialExternality +
        entry.isolation +
        entry.seedVariation;
      expect(entry.rawScore).toBe(sum);
      expect(entry.score + entry.clampAdjustment).toBe(entry.rawScore);
      expect(entry.score).toBeGreaterThanOrEqual(-40);
      expect(entry.score).toBeLessThanOrEqual(60);
      expect(entry.targetValue).toBe(
        Math.floor((parcel.baseLandValue * (100 + entry.score)) / 100),
      );
    }
  });

  it("el valor es reproducible: dos estados iguales producen el mismo desglose", () => {
    const first = createInitialState(11);
    const second = createInitialState(11);
    trialOrdinance(first, "active");
    trialOrdinance(second, "active");
    const left = parcelsByRole(first, "commercial_corridor")
      .slice(0, 8)
      .map((parcel) => breakdown(first, parcel));
    const right = parcelsByRole(second, "commercial_corridor")
      .slice(0, 8)
      .map((parcel) => breakdown(second, parcel));
    expect(left).toEqual(right);
  });
});
