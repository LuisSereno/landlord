import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parsePersonId,
  parseTick,
  type Building,
  type BuildingType,
  type DevelopmentCodeId,
  type Parcel,
  type ProductCommand,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import { blockOfParcel } from "./building-index";
import {
  developmentCodeById,
  developmentCodeForRole,
  isBuildingAllowedByDevelopmentCode,
} from "./development-codes";
import { DEVELOPMENT_CODES } from "./development-codes";
import { BUILDING_DEFINITIONS, GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { activePermitFor, permitsFor } from "./permitting";
import { canonicalizeState } from "./runner";
import { createInitialState, type GameState } from "./state";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { parcelsInDistrict } from "./test-support";
import { createMunicipalPolicy } from "./game-data";

/**
 * H1-03 y H1-04. El permiso pasa a ser una decisión administrativa con identidad propia: se consume
 * al iniciar la obra, no puede financiar una segunda, y sobrevive a la caducidad de la ordenanza que
 * le dio los derechos de densidad. `allowedUses` se lee como compatibilidad (OR), no como requisitos
 * acumulativos: con la lectura anterior `workshop` no era construible en ningún código.
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

function fundedState(): GameState {
  const state = createInitialState(7);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  inventory.cement = 500;
  inventory.brick = 500;
  inventory.steel = 500;
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function ownedParcel(state: GameState, developmentCodeId: DevelopmentCodeId, index = 0): Parcel {
  const parcel = parcelsInDistrict(
    state,
    PLAYER_HOME_DISTRICT_ID,
    (entry) => entry.disposition === "marketable" && entry.developmentCodeId === developmentCodeId,
  )[index];
  if (!parcel) throw new Error(`Sin parcela con código ${developmentCodeId} para el test`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  return parcel;
}

/** Cero probabilidad: ningún permiso nuevo puede emitirse, así que sólo vale lo ya concedido. */
function denyFurtherPermits(state: GameState, parcel: Parcel): void {
  const role = blockOfParcel(state, parcel).urbanRole;
  state.phase2.permitting.approvalChanceByRole = {
    ...state.phase2.permitting.approvalChanceByRole,
    [role]: 0,
  };
}

function startAndConsume(state: GameState, parcel: Parcel, buildingType: BuildingType): string {
  const before = Object.keys(state.phase2.permitting.permitsById).length;
  const result = dispatchProductCommand(
    state,
    command(`build-${buildingType}`, "StartConstruction", { parcelIds: [parcel.id], buildingType }),
  );
  expect(result.accepted).toBe(true);
  const created = Object.values(state.phase2.permitting.permitsById).filter(
    (permit) => permit.parcelIds[0]! === parcel.id && permit.status === "consumed",
  );
  expect(created).toHaveLength(1);
  expect(Object.keys(state.phase2.permitting.permitsById).length).toBeGreaterThanOrEqual(before);
  return created[0]!.id;
}

describe("H1-03 · ciclo de vida del permiso", () => {
  it("RequestPermit crea un permiso identificable y los ids son únicos y deterministas", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);

    expect(
      dispatchProductCommand(
        state,
        command("permit-a", "RequestPermit", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("permit-b", "RequestPermit", { parcelIds: [parcel.id], buildingType: "workshop" }),
      ).accepted,
    ).toBe(true);

    const ids = Object.keys(state.phase2.permitting.permitsById);
    expect(ids).toEqual(["permit_00000001", "permit_00000002"]);
    const first = state.phase2.permitting.permitsById["permit_00000001"]!;
    expect(first).toMatchObject({
      id: "permit_00000001",
      parcelIds: [parcel.id],
      buildingType: "courtyard_home",
      status: "approved",
      consumedAtTick: null,
      authorityOrganizationId: "org_00000004",
    });

    /** Misma seed, mismos ids: la identidad es función del expediente, no del reloj. */
    const replay = fundedState();
    const replayParcel = ownedParcel(replay, developmentCodeForRole("mixed_core").id);
    dispatchProductCommand(
      replay,
      command("permit-a", "RequestPermit", {
        parcelIds: [replayParcel.id],
        buildingType: "courtyard_home",
      }),
    );
    dispatchProductCommand(
      replay,
      command("permit-b", "RequestPermit", {
        parcelIds: [replayParcel.id],
        buildingType: "workshop",
      }),
    );
    expect(Object.keys(replay.phase2.permitting.permitsById)).toEqual(ids);
  });

  it("un permiso del tipo A no sirve para construir el tipo B", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    dispatchProductCommand(
      state,
      command("permit-only-home", "RequestPermit", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    denyFurtherPermits(state, parcel);

    expect(
      dispatchProductCommand(
        state,
        command("build-workshop-with-home-permit", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "workshop",
        }),
      ),
    ).toEqual({ accepted: false, code: "PERMIT_DENIED" });
    expect(activePermitFor(state, [parcel.id], "workshop", state.clock.tick)).toBeNull();
    expect(activePermitFor(state, [parcel.id], "courtyard_home", state.clock.tick)).not.toBeNull();
  });

  it("StartConstruction consume el permiso correcto y un segundo intento no lo reutiliza", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    const homePermitId = startAndConsume(state, parcel, "courtyard_home");

    expect(state.phase2.permitting.permitsById[homePermitId]).toMatchObject({
      status: "consumed",
      consumedAtTick: state.clock.tick,
      buildingType: "courtyard_home",
    });

    /**
     * La obra en curso taparía el rechazo de permiso con ACTIVE_SITE_ON_PARCEL, así que se retira:
     * lo que se quiere comprobar es que el permiso consumido no financia una segunda obra.
     */
    for (const siteId of [...state.phase2.constructionSites.keys()])
      state.phase2.constructionSites.delete(siteId);
    denyFurtherPermits(state, parcel);
    expect(
      dispatchProductCommand(
        state,
        command("second-build", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "PERMIT_DENIED" });
    expect(state.phase2.permitting.permitsById[homePermitId]?.status).toBe("consumed");
  });

  it("un permiso expirado no autoriza construir", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    const permitId = startAndConsume(state, parcel, "courtyard_home");
    // Segunda parcela con permiso propio, al que se le vence la validez antes de construir.
    const other = ownedParcel(state, developmentCodeForRole("mixed_core").id, 1);
    dispatchProductCommand(
      state,
      command("permit-expire", "RequestPermit", {
        parcelIds: [other.id],
        buildingType: "courtyard_home",
      }),
    );
    expect(state.phase2.permitting.permitsById[permitId]).toBeDefined();
    for (const permit of permitsFor(state, [other.id], "courtyard_home"))
      state.phase2.permitting.permitsById[permit.id] = {
        ...permit,
        expiresAtTick: parseTick(state.clock.tick),
      };
    denyFurtherPermits(state, other);

    expect(
      dispatchProductCommand(
        state,
        command("build-after-expiry", "StartConstruction", {
          parcelIds: [other.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "PERMIT_DENIED" });
  });

  it("un fallo de footprint, recursos o fondos no quema un permiso aprobado", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    dispatchProductCommand(
      state,
      command("permit-keep", "RequestPermit", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    const live = activePermitFor(state, [parcel.id], "courtyard_home", state.clock.tick)!;

    /** Huella imposible: la parcela ya está físicamente ocupada por otro edificio. */
    const blocker: Building = {
      id: parseBuildingId("building_00000777"),
      parcelIds: [parcel.id],
      districtId: parcel.districtId,
      footprintCells: parcel.cells.map((cell) => ({ ...cell })),
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
    state.phase2.buildings.set(blocker.id, blocker);
    expect(
      dispatchProductCommand(
        state,
        command("build-blocked", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(false);
    expect(state.phase2.permitting.permitsById[live.id]?.status).toBe("approved");
    expect(state.phase2.permitting.permitsById[live.id]?.consumedAtTick).toBeNull();
    state.phase2.buildings.delete(blocker.id);

    /** Sin recursos. */
    const inventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
    const resources = { ...inventory };
    inventory.cement = 0;
    inventory.brick = 0;
    inventory.steel = 0;
    expect(
      dispatchProductCommand(
        state,
        command("build-no-resources", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "INSUFFICIENT_RESOURCES" });
    expect(state.phase2.permitting.permitsById[live.id]?.status).toBe("approved");
    Object.assign(inventory, resources);

    /** Sin fondos. */
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(0));
    expect(
      dispatchProductCommand(
        state,
        command("build-no-funds", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "INSUFFICIENT_FUNDS" });
    expect(state.phase2.permitting.permitsById[live.id]?.status).toBe("approved");

    /** Y cuando todo cuadra, ese mismo permiso es el que se gasta. */
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
    const consumed = dispatchProductCommand(
      state,
      command("build-ok", "StartConstruction", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    expect(consumed.accepted).toBe(true);
    expect(state.phase2.permitting.permitsById[live.id]).toMatchObject({
      status: "consumed",
      consumedAtTick: state.clock.tick,
    });
  });

  it("consumir no destruye los derechos de densidad adquiridos", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("commercial_corridor").id);
    state.phase2.permitting.approvalChanceByRole = {
      ...state.phase2.permitting.approvalChanceByRole,
      commercial_corridor: 100,
    };
    state.phase2.ordinance = {
      ...createMunicipalPolicy("policy_00000005")!,
      status: "active",
      activeFromTick: parseTick(0),
      expiresAtTick: parseTick(GAME_MONTH_TICKS * 2),
    };
    dispatchProductCommand(
      state,
      command("permit-density", "RequestPermit", {
        parcelIds: [parcel.id],
        buildingType: "apartment_block",
      }),
    );
    const permit = activePermitFor(state, [parcel.id], "apartment_block", state.clock.tick)!;
    expect(permit.densityBonusFloors).toBe(1);
    expect(permit.densityBonusFarPercent).toBe(100);

    state.phase2.ordinance = { ...state.phase2.ordinance, status: "expired" };
    expect(
      dispatchProductCommand(
        state,
        command("build-density", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "apartment_block",
        }),
      ).accepted,
    ).toBe(true);

    const consumed = state.phase2.permitting.permitsById[permit.id]!;
    expect(consumed.status).toBe("consumed");
    expect(consumed.densityBonusFloors).toBe(1);
    expect(consumed.densityBonusFarPercent).toBe(100);
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.parcelIds[0]! === parcel.id,
    )!;
    expect(site.floors).toBe(5);
  });

  it("guardar y cargar conserva ids, estado y derechos del permiso", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    const consumedId = startAndConsume(state, parcel, "courtyard_home");
    dispatchProductCommand(
      state,
      command("permit-extra", "RequestPermit", {
        parcelIds: [parcel.id],
        buildingType: "workshop",
      }),
    );

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.permitting).toEqual(state.phase2.permitting);
    expect(Object.keys(restored.phase2.permitting.permitsById).sort()).toEqual([
      consumedId,
      "permit_00000002",
    ]);
    expect(restored.phase2.permitting.permitsById[consumedId]).toMatchObject({
      status: "consumed",
      consumedAtTick: state.clock.tick,
    });
    expect(restored.phase2.idCounters.permit).toBe(state.phase2.idCounters.permit);
  });

  it("el digesto canónico no depende del orden de inserción de la colección", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    dispatchProductCommand(
      state,
      command("canon-a", "RequestPermit", {
        parcelIds: [parcel.id],
        buildingType: "courtyard_home",
      }),
    );
    const second = ownedParcel(state, developmentCodeForRole("mixed_core").id, 1);
    dispatchProductCommand(
      state,
      command("canon-b", "RequestPermit", { parcelIds: [second.id], buildingType: "workshop" }),
    );
    const canonical = canonicalizeState(state);

    const entries = Object.entries(state.phase2.permitting.permitsById).reverse();
    state.phase2.permitting.permitsById = {};
    for (const [id, permit] of entries) state.phase2.permitting.permitsById[id] = permit;

    expect(canonicalizeState(state)).toBe(canonical);
  });
});

describe("H1-04 · compatibilidad de usos", () => {
  it("todo edificio privado tiene al menos un código urbanístico legal", () => {
    const codes = Object.values(DEVELOPMENT_CODES);
    expect(codes.length).toBeGreaterThan(0);
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      if (definition.municipal) continue;
      const legal = codes.filter((code) => isBuildingAllowedByDevelopmentCode(definition, code));
      expect(legal.length, `${definition.type} no es construible en ningún código`).toBeGreaterThan(
        0,
      );
    }
  });

  it("workshop es legal en industrial y en un código compatible vía retail", () => {
    const workshop = BUILDING_DEFINITIONS.workshop!;
    expect(
      isBuildingAllowedByDevelopmentCode(workshop, developmentCodeForRole("industrial_logistics")),
    ).toBe(true);
    expect(isBuildingAllowedByDevelopmentCode(workshop, developmentCodeForRole("mixed_core"))).toBe(
      true,
    );
  });

  it("vivienda, industria y mixto mantienen su código histórico", () => {
    expect(
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.courtyard_home!,
        developmentCodeForRole("urban_residential"),
      ),
    ).toBe(true);
    expect(
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.steelworks!,
        developmentCodeForRole("industrial_logistics"),
      ),
    ).toBe(true);
    expect(
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.warehouse!,
        developmentCodeForRole("industrial_logistics"),
      ),
    ).toBe(true);
    expect(
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.mixed_tenement!,
        developmentCodeForRole("mixed_core"),
      ),
    ).toBe(true);
  });

  it("un uso totalmente incompatible se rechaza y lo municipal nunca está disponible", () => {
    expect(
      isBuildingAllowedByDevelopmentCode(
        BUILDING_DEFINITIONS.steelworks!,
        developmentCodeForRole("low_density_residential"),
      ),
    ).toBe(false);
    const municipal = Object.values(BUILDING_DEFINITIONS).find(
      (definition) => definition.municipal,
    );
    if (municipal)
      expect(
        isBuildingAllowedByDevelopmentCode(municipal, developmentCodeForRole("civic_core")),
      ).toBe(false);
  });

  it("la parcela mixta admite a la vez vivienda y taller, cada una con su permiso", () => {
    const state = fundedState();
    const parcel = ownedParcel(state, developmentCodeForRole("mixed_core").id);
    const permitted = Object.values(BUILDING_DEFINITIONS)
      .filter((definition) =>
        isBuildingAllowedByDevelopmentCode(
          definition,
          developmentCodeById(parcel.developmentCodeId),
        ),
      )
      .map((definition) => definition.type);
    expect(permitted).toContain("courtyard_home");
    expect(permitted).toContain("workshop");

    expect(
      dispatchProductCommand(
        state,
        command("mixed-permit-home", "RequestPermit", {
          parcelIds: [parcel.id],
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("mixed-permit-workshop", "RequestPermit", {
          parcelIds: [parcel.id],
          buildingType: "workshop",
        }),
      ).accepted,
    ).toBe(true);
    expect(permitsFor(state, [parcel.id], "courtyard_home")).toHaveLength(1);
    expect(permitsFor(state, [parcel.id], "workshop")).toHaveLength(1);
  });
});
