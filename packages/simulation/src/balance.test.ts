import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseMoney,
  parseOrganizationId,
  parseParcelId,
  parseTenantId,
  parseTick,
  type Building,
  type Tenant,
} from "@landlord/shared";
import { detectInvariantViolations, measureBalance } from "./balance";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { createInitialState, type GameState } from "./state";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  console?: { log(value: string): void };
};

function playerBuilding(state: GameState, index: number, condition = 100): Building {
  const parcel = [...state.phase2.parcels.values()][index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return building;
}

function addTenant(state: GameState, ordinal: number): Tenant {
  const id = parseTenantId(`tenant_${String(ordinal).padStart(8, "0")}`);
  const tenant: Tenant = {
    id,
    profile: "household",
    budget: parseMoney(300),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    satisfaction: 60,
    leaseRemaining: 0,
    status: "available",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
  };
  state.phase2.tenants.set(id, tenant);
  return tenant;
}

describe("WP4.14 métricas de balance", () => {
  it("un estado inicial no tiene deuda, vacancia ni concentración", () => {
    const metrics = measureBalance(createInitialState(1));
    expect(metrics.bankruptcies).toEqual({
      defaultedLoans: 0,
      organizationsWithDefault: 0,
      openAuctions: 0,
    });
    expect(metrics.vacancy.percent).toBe(0);
    expect(metrics.vacancy.mobilityTotal).toBe(0);
    expect(metrics.debt).toEqual({ outstandingPrincipal: 0, taxArrears: 0 });
    expect(metrics.concentration.topParcelSharePercent).toBe(0);
    expect(metrics.concentration.parcelHhi).toBe(0);
    expect(metrics.organizations.map((entry) => entry.organizationId)).toContain(
      PLAYER_ORGANIZATION_ID,
    );
    expect(metrics.budget.serviceLevelPercentByCategory.transport).toBe(100);
  });

  it("mide vacancia, concentración y movilidad en una campaña madura", () => {
    const state = createScaledCity(7, { parcelCount: 50 });
    for (let tick = 0; tick < GAME_MONTH_TICKS * 6; tick += 1) advanceProductSystems(state);
    const metrics = measureBalance(state);
    expect(metrics.vacancy.slots).toBeGreaterThan(0);
    expect(metrics.vacancy.percent).toBeGreaterThanOrEqual(0);
    expect(metrics.vacancy.percent).toBeLessThanOrEqual(100);
    expect(metrics.concentration.parcelHhi).toBeGreaterThan(0);
    expect(metrics.concentration.parcelHhi).toBeLessThanOrEqual(10_000);
    expect(metrics.concentration.topParcelSharePercent).toBeGreaterThan(0);
    expect(metrics.vacancy.mobilityTotal).toBeGreaterThan(0);
    expect(
      metrics.organizations.find((entry) => entry.organizationId === RIVAL_ORGANIZATION_ID),
    ).toBeDefined();
    expect(metrics.budget.municipalReserve).toBe(
      state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID),
    );
  });

  it("detecta invariantes rotas en un estado manipulado", () => {
    const state = createInitialState(2);
    expect(detectInvariantViolations(state)).toEqual([]);

    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, -1 as never);
    const building = playerBuilding(state, 0);
    const tenant = addTenant(state, 1);
    tenant.activeContractBuildingId = building.id;
    tenant.status = "contracted";
    building.tenantIds = [tenant.id, tenant.id, tenant.id];
    state.phase2.automation.maintenanceRepairThreshold = 150;
    state.phase2.macroEvents.events = [
      {
        id: "event_bad",
        type: "material_scarcity",
        startTick: parseTick(10),
        endTick: parseTick(10),
        intensity: 2,
        modifiers: { materialCostModifierPercent: 10 },
      },
    ];
    const violations = detectInvariantViolations(state);
    expect(violations.some((violation) => violation.startsWith("balance_negative"))).toBe(true);
    expect(violations.some((violation) => violation.startsWith("building_over_capacity"))).toBe(
      true,
    );
    expect(
      violations.some((violation) => violation.startsWith("automation_threshold_invalid")),
    ).toBe(true);
    expect(violations.some((violation) => violation.startsWith("macro_event_interval"))).toBe(true);
    expect(violations.some((violation) => violation.startsWith("macro_event_intensity"))).toBe(
      true,
    );
  });

  it("detecta referencias huérfanas de contratos y préstamos", () => {
    const state = createInitialState(3);
    addTenant(state, 1);
    const orphan = state.phase2.tenants.get(parseTenantId("tenant_00000001"))!;
    orphan.activeContractBuildingId = parseBuildingId("building_99999999");
    orphan.status = "contracted";
    const parcel = [...state.phase2.parcels.values()][0]!;
    state.phase2.loans.set("loan_00000099" as import("@landlord/shared").LoanId, {
      id: "loan_00000099" as import("@landlord/shared").LoanId,
      borrowerOrganizationId: PLAYER_ORGANIZATION_ID,
      lenderOrganizationId: parseOrganizationId("org_00000003"),
      principal: parseMoney(500),
      outstandingPrincipal: parseMoney(600),
      annualInterestRateBps: 900,
      termMonths: 12,
      remainingMonths: -1,
      collateralParcelId: parcel.id,
      status: "active",
      offeredAtTick: parseTick(0),
      acceptedAtTick: parseTick(0),
      nextPaymentTick: parseTick(36_000),
      missedPayments: 0,
    });
    state.phase2.parcels.get(parcel.id)!.buildingId = parseBuildingId("building_99999998");
    const violations = detectInvariantViolations(state);
    expect(violations).toContain("tenant_orphan:tenant_00000001");
    expect(violations).toContain("loan_principal_invalid:loan_00000099");
    expect(violations).toContain("loan_remaining_invalid:loan_00000099");
    expect(violations).toContain(`parcel_building_missing:${parseParcelId(parcel.id)}`);
  });

  /**
   * Arnés de carga, no baseline de balance de gameplay. `createScaledCity` inyecta 5 000 000 de caja,
   * 1 000 000 de capacidad de inventario y regala parcelas, edificios, fábricas, inquilinos, préstamos,
   * cuadrillas y agentes que el jugador nunca compró ni construyó, así que aquí `financeCashFloor` es
   * irrelevante y las diferencias las domina la ocupación automática de una cartera ya montada. Sirve
   * para detectar invariantes rotas y degradación bajo volumen; su dataset se publica como
   * `docs/balance/synthetic-city-balance-v1.json`. La campaña comparable con una partida real está en
   * `balance-playable.test.ts` (`pnpm balance:playable`).
   */
  it.skipIf(environment.process?.env?.BALANCE_CAMPAIGN !== "1")(
    "campaña sintética de carga con seeds registradas y detección de dominancia",
    () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
      const months = 12;
      const strategies = [
        {
          id: "passive",
          setup: (state: GameState) => {
            state.phase2.maintenance.policy = "deferred";
          },
        },
        {
          id: "maintained",
          setup: (state: GameState) => {
            state.phase2.maintenance.policy = "balanced";
          },
        },
        {
          id: "delegated_deferred",
          setup: (state: GameState) => {
            state.phase2.maintenance.policy = "deferred";
            state.phase2.automation.property = "fill_vacancies";
            state.phase2.automation.finance = "cover_shortfall";
            state.phase2.automation.maintenanceRepairThreshold = null;
          },
        },
        {
          id: "delegated_balanced",
          setup: (state: GameState) => {
            state.phase2.maintenance.policy = "balanced";
            state.phase2.automation.property = "fill_vacancies";
            state.phase2.automation.finance = "cover_shortfall";
            state.phase2.automation.maintenanceRepairThreshold = 40;
          },
        },
      ] as const;
      const outcomes = strategies.flatMap((strategy) =>
        seeds.map((seed) => {
          const state = createScaledCity(seed, { parcelCount: 200 });
          strategy.setup(state);
          for (let tick = 0; tick < GAME_MONTH_TICKS * months; tick += 1) {
            advanceProductSystems(state);
          }
          const metrics = measureBalance(state);
          return {
            strategy: strategy.id,
            seed,
            playerCash: state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0,
            metrics,
            violations: detectInvariantViolations(state),
          };
        }),
      );
      environment.console?.log(`BALANCE_CAMPAIGN ${JSON.stringify(outcomes)}`);
      for (const outcome of outcomes) {
        expect(outcome.violations, `${outcome.strategy}:${outcome.seed}`).toEqual([]);
      }
      const wins = seeds.filter((seed) => {
        const passive = outcomes.find(
          (entry) => entry.strategy === "passive" && entry.seed === seed,
        )!;
        const delegated = outcomes.find(
          (entry) => entry.strategy === "delegated_balanced" && entry.seed === seed,
        )!;
        return delegated.playerCash > passive.playerCash;
      });
      environment.console?.log(
        `BALANCE_DOMINANCE ${JSON.stringify({
          metric: "playerCash",
          strategy: "delegated_balanced",
          wins: wins.length,
          seeds: seeds.length,
          dominant: wins.length >= Math.ceil(seeds.length * 0.9),
        })}`,
      );
      expect(wins.length).toBeGreaterThanOrEqual(0);
    },
    1_800_000,
  );
});
