import {
  parseTick,
  type IntelKind,
  type IntelSource,
  type InformationScope,
  type IntelligenceEstimate,
  type IntelligenceState,
  type OrganizationId,
  type Seed,
} from "@landlord/shared";
import {
  hasActiveAward,
  operationalBuildingsOwned,
  PUBLIC_CONTRACTS_POLICY,
} from "./public-contracts";
import { Xoshiro128ss } from "./prng";
import { GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import type { GameState } from "./state";

export const INFORMATION_SCOPES: readonly InformationScope[] = [
  "public",
  "own",
  "inferred",
  "private",
];

/**
 * Registro de acceso, no de propiedad. `public` lo ve cualquiera desde el mundo; `own` lo conoce el
 * sujeto de su propia contabilidad; `inferred` sólo existe como estimación con error; `private` vive
 * en el estado autoritativo y no sale de él. El mismo número puede tener tres accesos distintos: la
 * vacancia agregada del distrito es pública, la cartera de alquileres propia es `own` y la caja del
 * rival es `private`.
 */
export const INFORMATION_POLICY = {
  scopeByObservable: {
    parcel_owner: "public",
    parcel_price: "public",
    building_owner: "public",
    building_state: "public",
    building_condition: "public",
    construction_site: "public",
    ordinance: "public",
    published_tender: "public",
    tender_award: "public",
    foreclosure_auction: "public",
    district_vacancy_index: "public",
    district_rent_index: "public",
    wage_index: "public",
    municipal_budget: "public",
    service_coverage: "public",
    heat: "public",
    incident: "public",
    tenant_roster_in_own_buildings: "own",
    own_balance: "own",
    own_loans: "own",
    own_inventory: "own",
    own_tax_arrears: "own",
    own_maintenance_backlog: "own",
    own_reputation: "own",
    own_influence: "own",
    own_intelligence_file: "own",
    rival_bid_intent: "inferred",
    estimated_balance: "inferred",
    estimated_exposure: "inferred",
    estimated_arrears: "inferred",
    rival_balance: "private",
    rival_loans: "private",
    rival_inventory: "private",
    rival_tax_arrears: "private",
    rival_maintenance_backlog: "private",
    rival_reputation: "private",
    rival_influence: "private",
    rival_bid: "private",
  } as const satisfies Record<string, InformationScope>,
  /** Cuatro cifras_privadas del rival que valen una decisión; todas en unidades de dinero. */
  kinds: {
    balance: {
      label: "caja disponible",
      errorPercentBySource: { market: 45, contacts: 10 },
    },
    exposure: {
      label: "deuda viva",
      errorPercentBySource: { market: 30, contacts: 8 },
    },
    arrears: {
      label: "impuestos adeudados",
      errorPercentBySource: { market: 50, contacts: 12 },
    },
    bid_intent: {
      label: "puja prevista en la próxima licitación",
      errorPercentBySource: { market: 25, contacts: 6 },
    },
  } as const satisfies Record<
    IntelKind,
    { readonly label: string; readonly errorPercentBySource: Record<IntelSource, number> }
  >,
  /** La precisión caduca: una estimación vieja vale menos que una fresca del mismo canal. */
  accuracyDecayPerMonth: 2,
  minimumAccuracyPercent: 5,
  /** El canal gratuito del mercado re-basa sola lo que el jugador ya sigue, y lo hace peor. */
  staleAfterMonths: 3,
  commissionCost: 150,
  commissionCooldownTicks: GAME_MONTH_TICKS,
} as const;

export type IntelligenceReport = {
  observerOrganizationId: OrganizationId;
  commissionCost: number;
  cooldownRemainingTicks: number;
  staleAfterMonths: number;
  kinds: Array<{
    kind: IntelKind;
    label: string;
    marketErrorPercent: number;
    contactsErrorPercent: number;
  }>;
  estimates: Array<{
    id: string;
    subjectOrganizationId: OrganizationId;
    kind: IntelKind;
    label: string;
    source: IntelSource;
    value: number;
    accuracyPercent: number;
    ageMonths: number;
    effectiveAccuracyPercent: number;
  }>;
};

export function initialIntelligenceState(seed: Seed): IntelligenceState {
  return {
    observerOrganizationId: PLAYER_ORGANIZATION_ID,
    prng: new Xoshiro128ss(seed).exportState(),
    estimatesBySubjectOrganizationId: {},
    nextEstimateOrdinal: 1,
    commissionCooldownUntilTick: parseTick(0),
    lastRefreshTick: null,
  };
}

export function scopeFor(
  observable: keyof typeof INFORMATION_POLICY.scopeByObservable,
): InformationScope {
  return INFORMATION_POLICY.scopeByObservable[observable];
}

/**
 * El lector de la verdad privada. Sólo lo usan el generador de estimaciones y las pruebas: la
 * proyección no puede llamarlo, porque entonces el expediente de inteligencia sería el estado.
 */
export function trueValueFor(
  state: GameState,
  subjectOrganizationId: OrganizationId,
  kind: IntelKind,
): number {
  if (kind === "balance") return state.phase2.balances.get(subjectOrganizationId) ?? 0;
  if (kind === "exposure") {
    return [...state.phase2.loans.values()]
      .filter(
        (loan) =>
          loan.borrowerOrganizationId === subjectOrganizationId &&
          ["offered", "active", "delinquent"].includes(loan.status),
      )
      .reduce((total, loan) => total + loan.outstandingPrincipal, 0);
  }
  if (kind === "arrears") {
    return state.phase2.taxation.arrearsByOrganizationId[subjectOrganizationId] ?? 0;
  }
  const tender = [...Object.values(state.phase2.contracts.contracts)]
    .filter(
      (contract) =>
        contract.status === "open" &&
        state.clock.tick < contract.closesAtTick &&
        !contract.bids.some((bid) => bid.organizationId === subjectOrganizationId) &&
        !hasActiveAward(state, subjectOrganizationId) &&
        operationalBuildingsOwned(state, subjectOrganizationId) >= contract.requiredBuildings,
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!tender) return 0;
  return Math.floor((tender.budget * PUBLIC_CONTRACTS_POLICY.rivalBidPercent) / 100);
}

export function monthsBetween(fromTick: number, toTick: number): number {
  return Math.max(0, Math.floor((toTick - fromTick) / GAME_MONTH_TICKS));
}

export function effectiveAccuracyPercent(estimate: IntelligenceEstimate, atTick: number): number {
  return Math.max(
    INFORMATION_POLICY.minimumAccuracyPercent,
    estimate.accuracyPercent -
      INFORMATION_POLICY.accuracyDecayPerMonth * monthsBetween(estimate.atTick, atTick),
  );
}

function drawEstimate(
  state: GameState,
  subjectOrganizationId: OrganizationId,
  kind: IntelKind,
  source: IntelSource,
): IntelligenceEstimate {
  const truth = trueValueFor(state, subjectOrganizationId, kind);
  const errorPercent = INFORMATION_POLICY.kinds[kind].errorPercentBySource[source];
  const intelligence = state.phase2.intelligence;
  // Arroyo propio: el ruido de estimación no puede desplazar el PRNG económico de la partida.
  const generator = new Xoshiro128ss(state.seed);
  generator.restoreState(intelligence.prng);
  const noisePercent = generator.nextInt(0, 2 * errorPercent + 1) - errorPercent;
  intelligence.prng = generator.exportState();

  const estimate: IntelligenceEstimate = {
    id: `intel_${String(intelligence.nextEstimateOrdinal).padStart(8, "0")}`,
    subjectOrganizationId,
    kind,
    source,
    value: Math.max(0, Math.round((truth * (100 + noisePercent)) / 100)),
    accuracyPercent: 100 - errorPercent,
    atTick: parseTick(state.clock.tick),
  };
  intelligence.nextEstimateOrdinal += 1;
  const kept = (intelligence.estimatesBySubjectOrganizationId[subjectOrganizationId] ?? []).filter(
    (entry) => entry.kind !== kind,
  );
  intelligence.estimatesBySubjectOrganizationId[subjectOrganizationId] = [...kept, estimate].sort(
    (left, right) => left.kind.localeCompare(right.kind),
  );
  return estimate;
}

/** Un expediente por observador: hoy el único que paga por saber es el jugador. */
export function commissionIntelligence(
  state: GameState,
  subjectOrganizationId: OrganizationId,
  kind: IntelKind,
): IntelligenceEstimate {
  const estimate = drawEstimate(state, subjectOrganizationId, kind, "contacts");
  state.phase2.intelligence.commissionCooldownUntilTick = parseTick(
    state.clock.tick + INFORMATION_POLICY.commissionCooldownTicks,
  );
  return estimate;
}

export function commissionRejection(
  state: GameState,
  actingAsOrganizationId: OrganizationId,
  subjectOrganizationId: OrganizationId,
):
  | "INTEL_SUBJECT_UNKNOWN"
  | "INTEL_SUBJECT_IS_SELF"
  | "INTEL_NOT_OBSERVER"
  | "INTEL_COOLDOWN"
  | null {
  const subject = state.organizations.get(subjectOrganizationId);
  if (!subject || subject.kind !== "company") return "INTEL_SUBJECT_UNKNOWN";
  if (subjectOrganizationId === actingAsOrganizationId) return "INTEL_SUBJECT_IS_SELF";
  // El expediente es propio: quien paga por saber es su dueño, no cualquiera que escriba en él.
  if (state.phase2.intelligence.observerOrganizationId !== actingAsOrganizationId)
    return "INTEL_NOT_OBSERVER";
  if (state.clock.tick < state.phase2.intelligence.commissionCooldownUntilTick)
    return "INTEL_COOLDOWN";
  return null;
}

/** El mercado re-basa lo que el jugador ya sigue, una vez que la estimación se quedó vieja. */
export function runIntelligence(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const staleAfterTicks = INFORMATION_POLICY.staleAfterMonths * GAME_MONTH_TICKS;
  const subjects = Object.keys(
    state.phase2.intelligence.estimatesBySubjectOrganizationId,
  ).sort() as OrganizationId[];
  for (const subjectId of subjects) {
    const held = [...(state.phase2.intelligence.estimatesBySubjectOrganizationId[subjectId] ?? [])]
      .filter((estimate) => state.clock.tick - estimate.atTick >= staleAfterTicks)
      .sort((left, right) => left.kind.localeCompare(right.kind));
    for (const estimate of held) drawEstimate(state, subjectId, estimate.kind, "market");
  }
  state.phase2.intelligence.lastRefreshTick = parseTick(state.clock.tick);
}

export function describeIntelligence(state: GameState): IntelligenceReport {
  const intelligence = state.phase2.intelligence;
  const observer = intelligence.observerOrganizationId;
  const estimates = Object.keys(intelligence.estimatesBySubjectOrganizationId)
    .sort()
    .flatMap(
      (subjectId) => intelligence.estimatesBySubjectOrganizationId[subjectId as string] ?? [],
    )
    .sort(
      (left, right) =>
        left.subjectOrganizationId.localeCompare(right.subjectOrganizationId) ||
        left.kind.localeCompare(right.kind),
    )
    .map((estimate) => ({
      id: estimate.id,
      subjectOrganizationId: estimate.subjectOrganizationId,
      kind: estimate.kind,
      label: INFORMATION_POLICY.kinds[estimate.kind].label,
      source: estimate.source,
      value: estimate.value,
      accuracyPercent: estimate.accuracyPercent,
      ageMonths: monthsBetween(estimate.atTick, state.clock.tick),
      effectiveAccuracyPercent: effectiveAccuracyPercent(estimate, state.clock.tick),
    }));
  return {
    observerOrganizationId: observer,
    commissionCost: INFORMATION_POLICY.commissionCost,
    cooldownRemainingTicks: Math.max(
      0,
      intelligence.commissionCooldownUntilTick - state.clock.tick,
    ),
    staleAfterMonths: INFORMATION_POLICY.staleAfterMonths,
    kinds: (Object.keys(INFORMATION_POLICY.kinds) as IntelKind[]).map((kind) => ({
      kind,
      label: INFORMATION_POLICY.kinds[kind].label,
      marketErrorPercent: INFORMATION_POLICY.kinds[kind].errorPercentBySource.market,
      contactsErrorPercent: INFORMATION_POLICY.kinds[kind].errorPercentBySource.contacts,
    })),
    estimates,
  };
}
