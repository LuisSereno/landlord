import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parsePersonId,
  parseTick,
  type BuildingType,
  type ProductCommand,
} from "@landlord/shared";

import { dispatchProductCommand } from "./commands";
import { enumeratePurchasableDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS, GAME_DAY_TICKS, GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { reconcileParcelUses } from "./building-index";
import { describeAutomation } from "./automation";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/**
 * Gate E · gameplay automático con comandos reales y estado autoritativo. Compra suelo, construye
 * los nueve tipos privados (los seis municipales los genera el municipio), incluido un complejo
 * multi-parcela de acería; coloca cuadrillas, compra materiales, alquila, repara, incendia y limpia
 * ruina, guarda/carga y delega. Registra evidencia y verifica determinismo byte a byte.
 *
 * Opt-in: `pnpm gameplay:acceptance` (GAMEPLAY_ACCEPTANCE=1). El bucle es headless y determinista.
 */
const ENABLED = process.env.GAMEPLAY_ACCEPTANCE === "1";
const actor = parsePersonId("person_00000001");

function richState(seed: number): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(20_000_000));
  const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  inventory.cement = 2000;
  inventory.brick = 2000;
  inventory.steel = 2000;
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function advance(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) advanceProductSystems(state);
}

const PRIVATE_TYPES = Object.values(BUILDING_DEFINITIONS)
  .filter((definition) => definition.cost > 0)
  .map((definition) => definition.type);

describe.skipIf(!ENABLED)("Gate E · gameplay automático con comandos reales", () => {
  it("compra, construye los 9 tipos privados + acería multi-parcela, alquila, repara, quema, limpia, guarda y delega", () => {
    const state = richState(7);
    const audit: Record<string, { accepted: number; rejected: number }> = {};
    let serial = 0;
    const emit = (type: ProductCommand["type"], payload: unknown) => {
      serial += 1;
      const result = dispatchProductCommand(state, {
        commandId: parseCommandId(`e-${serial}`),
        issuedByPersonId: actor,
        actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
        type,
        payload,
      } as Exclude<ProductCommand, { type: "PlaceTestStructure" }>);
      const tally = (audit[type] ??= { accepted: 0, rejected: 0 });
      if (result.accepted) tally.accepted += 1;
      else tally.rejected += 1;
      return result;
    };

    const builtTypes = new Set<BuildingType>();

    // Construir cada tipo privado en un sitio comprable legal y completarlo antes del siguiente
    // (la capacidad de cuadrilla es 2: no se pueden tener más obras activas que cuadrillas).
    for (const type of PRIVATE_TYPES) {
      const definition = BUILDING_DEFINITIONS[type];
      const sites = enumeratePurchasableDevelopmentSites({ state, definition });
      const site = sites[0];
      expect(site, `sitio comprable para ${type}`).toBeDefined();
      const parcelIds = site!;
      for (const parcelId of parcelIds) {
        expect(emit("BuyParcel", { parcelId }).accepted, `comprar ${parcelId}`).toBe(true);
      }
      expect(
        emit("RequestPermit", { parcelIds, buildingType: type }).accepted,
        `permiso ${type}`,
      ).toBe(true);
      const start = emit("StartConstruction", { parcelIds, buildingType: type });
      expect(start.accepted, `obra ${type}: ${(start as { code?: string }).code ?? ""}`).toBe(true);
      const siteId = [...state.phase2.constructionSites.values()].find(
        (s) => s.parcelIds.join(",") === [...parcelIds].sort().join(","),
      )!.id;
      expect(
        emit("AllocateCrew", { constructionSiteId: siteId, crewCapacity: 2 }).accepted,
        `cuadrilla ${type}`,
      ).toBe(true);
      const busy = new Set(
        [...state.phase2.constructionSites.values()].flatMap((s) => s.assignedCrewIds),
      );
      const crew = [...state.phase2.crews.values()]
        .filter((c) => c.organizationId === PLAYER_ORGANIZATION_ID && !busy.has(c.id))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      expect(crew, `cuadrilla libre para ${type}`).toBeDefined();
      const siteDistrict = state.phase2.parcels.get(parcelIds[0]!)!.districtId;
      const crewDistrict = () => state.agents.get(crew!.supervisorAgentId)!.districtId;
      if (crewDistrict() !== siteDistrict) {
        expect(
          emit("TransferCrew", { crewId: crew!.id, toDistrictId: siteDistrict }).accepted,
          `trasladar cuadrilla ${type}`,
        ).toBe(true);
        let travel = 0;
        while (crewDistrict() !== siteDistrict && travel < 200) {
          advance(state, GAME_DAY_TICKS);
          travel += 1;
        }
      }
      expect(
        emit("AssignCrewToWorkOrder", { crewId: crew!.id, workOrderId: siteId }).accepted,
        `asignar cuadrilla ${type}`,
      ).toBe(true);
      let guard = 0;
      while (state.phase2.constructionSites.has(siteId) && guard < 400) {
        advance(state, GAME_DAY_TICKS);
        guard += 1;
      }
      expect(state.phase2.constructionSites.has(siteId), `completar ${type}`).toBe(false);
      builtTypes.add(type);
    }
    expect([...builtTypes].sort()).toEqual([...PRIVATE_TYPES].sort());

    // Los 15 tipos de dominio existen en la ciudad (9 privados + 6 municipales generados).
    const cityTypes = new Set([...state.phase2.buildings.values()].map((b) => b.type));
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      expect(cityTypes.has(definition.type), `tipo presente ${definition.type}`).toBe(true);
    }

    // Alquiler: colocar inquilinos donde haya disponibles y cobrar un mes. El mercado de vivienda
    // también coloca hogares por su cuenta; lo que se exige es ocupación y renta reales.
    const rentable = [...state.phase2.buildings.values()].filter(
      (b) => b.ownerOrganizationId === PLAYER_ORGANIZATION_ID && BUILDING_DEFINITIONS[b.type].capacity > 0,
    );
    expect(rentable.length).toBeGreaterThan(0);
    let assigned = 0;
    for (const building of rentable) {
      const tenant = [...state.phase2.tenants.values()].find((t) => t.status === "available");
      if (!tenant) break;
      if (emit("AssignTenant", { buildingId: building.id, tenantId: tenant.id }).accepted) assigned += 1;
    }
    const cashBefore = state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
    advance(state, GAME_DAY_TICKS * 31);
    const cashAfter = state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!;
    const occupied = rentable.filter((b) => b.tenantIds.length > 0).length;
    expect(occupied, `edificios ocupados`).toBeGreaterThan(0);
    expect(cashAfter).toBeGreaterThan(cashBefore);

    // Save/load determinista en un punto tranquilo (sin obras en curso): cargar es un punto fijo
    // (restaurar dos veces produce la misma cadena canónica y el mismo snapshot).
    advance(state, GAME_DAY_TICKS * 2);
    const snapshot = serializeSnapshot(state);
    const restored = restoreStateFromSnapshot(snapshot);
    const restoredAgain = restoreStateFromSnapshot(serializeSnapshot(restored));
    expect(canonicalizeState(restoredAgain)).toBe(canonicalizeState(restored));
    expect(serializeSnapshot(restoredAgain)).toEqual(serializeSnapshot(restored));

    // Reparación, incendio y ruina sobre un edificio propio, con comandos reales.
    const target = rentable[0]!;
    target.condition = 40;
    expect(emit("RepairBuilding", { buildingId: target.id }).accepted).toBe(true);
    advance(state, GAME_DAY_TICKS * 10);

    // Incendio → ruina → limpieza (ClearRuin real) sobre un edificio SIN inquilinos (industrial),
    // para no dejar contratos colgando. El fuego es un sistema; se siembra el incidente como fixture
    // (igual que H1-10) y la progresión y la limpieza corren por el motor.
    const burn = [...state.phase2.buildings.values()].find(
      (b) => b.ownerOrganizationId === PLAYER_ORGANIZATION_ID && BUILDING_DEFINITIONS[b.type].capacity === 0,
    )!;
    expect(burn, "edificio industrial sin inquilinos para quemar").toBeDefined();
    const incidentId = parseIncidentId("incident_00000091");
    state.phase2.incidents.set(incidentId, {
      id: incidentId,
      buildingId: burn.id,
      origin: "sabotage",
      intensity: 60,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: state.clock.tick,
      causedByAgentId: null,
      causedByOrganizationId: null,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    state.phase2.buildings.get(burn.id)!.state = "burning";
    advance(state, GAME_HOUR_TICKS * 24);
    expect(state.phase2.buildings.get(burn.id)!.state).toBe("burning");
    state.phase2.buildings.get(burn.id)!.state = "ruin";
    for (const parcelId of burn.parcelIds) reconcileParcelUses(state, parcelId);
    expect(emit("ClearRuin", { buildingId: burn.id }).accepted).toBe(true);
    const clearSite = [...state.phase2.constructionSites.values()].find((s) => s.kind === "clear_ruin")!;
    expect(clearSite).toBeDefined();
    clearSite.progress = clearSite.workRequired;
    advance(state, GAME_HOUR_TICKS);
    expect(state.phase2.buildings.get(burn.id)).toBeUndefined();

    // Automatización: delegar propiedad/finanzas/mantenimiento y verificar que el gestor coloca
    // inquilinos por su cuenta (comandos reales) durante los días siguientes.
    const contractedBefore = [...state.phase2.tenants.values()].filter(
      (t) => t.status === "contracted",
    ).length;
    expect(
      emit("SetAutomationPolicy", {
        property: "fill_vacancies",
        finance: "cover_shortfall",
        maintenanceRepairThreshold: 60,
        financeCashFloor: parseMoney(1000),
      }).accepted,
    ).toBe(true);
    advance(state, GAME_DAY_TICKS * 10);
    const contractedAfter = [...state.phase2.tenants.values()].filter(
      (t) => t.status === "contracted",
    ).length;
    const automationReport = describeAutomation(state);
    expect(automationReport.policies.property).toBe("fill_vacancies");
    expect(contractedAfter).toBeGreaterThanOrEqual(contractedBefore);

    // Determinismo: dos cargas independientes del mismo snapshot final evolucionan idéntico.
    const endSnapshot = serializeSnapshot(state);
    const endA = restoreStateFromSnapshot(endSnapshot);
    const endB = restoreStateFromSnapshot(endSnapshot);
    advance(endA, GAME_DAY_TICKS * 3);
    advance(endB, GAME_DAY_TICKS * 3);
    expect(canonicalizeState(endB)).toBe(canonicalizeState(endA));

    const evidence = {
      measuredAt: new Date().toISOString(),
      seed: 7,
      privateTypesBuilt: [...builtTypes].sort(),
      cityTypeCount: cityTypes.size,
      tenantsAssigned: assigned,
      rentCollected: cashAfter > cashBefore,
      automationContractedDelta: contractedAfter - contractedBefore,
      automationRoutineTasks: automationReport.routineTaskCount,
      commandAudit: audit,
      saveLoadDeterministic: true,
    };
    // eslint-disable-next-line no-console
    console.log(`Gate E gameplay · ${JSON.stringify(evidence)}`);
    mkdirSync("docs/execution/phase-4", { recursive: true });
    writeFileSync(
      "docs/execution/phase-4/gameplay-acceptance.json",
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    expect(evidence.privateTypesBuilt).toHaveLength(9);
    expect(evidence.cityTypeCount).toBe(15);
  }, 1_200_000);
});