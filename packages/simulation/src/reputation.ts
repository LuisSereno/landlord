import {
  parseTick,
  type OrganizationId,
  type ReputationFact,
  type ReputationFactKind,
  type ReputationGroupId,
  type ReputationState,
  type Tick,
} from "@landlord/shared";
import { GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import type { GameState } from "./state";

/**
 * Tres grupos con efecto real, no una barra universal: los residentes juzgan la calles, el gobierno
 * juzga la conveniencia cívica y la banca juzga el riesgo. Cada uno valora distinto el mismo hecho.
 */
export const REPUTATION_GROUPS: readonly ReputationGroupId[] = [
  "residents",
  "municipality",
  "banks",
];

export const REPUTATION_POLICY = {
  factLimitPerOrganization: 16,
  minimumStanding: -100,
  maximumStanding: 100,
  /**
   * Sólo decae la opinión pública. El historial crediticio no se borra con el tiempo: un impago
   * sigue pesando en la banca hasta que otro hecho lo compense.
   */
  decayPerMonth: { residents: 3, municipality: 2, banks: 0 },
  facts: {
    contract_completed: {
      magnitudeCap: 1,
      deltaByGroup: { residents: 3, municipality: 8, banks: 2 },
    },
    contract_defaulted: {
      magnitudeCap: 1,
      deltaByGroup: { residents: -2, municipality: -10, banks: -5 },
    },
    households_displaced: {
      magnitudeCap: 8,
      /**
       * Neutral para la banca desde WP4.11-H: desalojar hogares no mejora la solvencia, y un +1 sin
       * decaimiento convertía los desahucios repetidos en un descuento permanente del préstamo.
       */
      deltaByGroup: { residents: -3, municipality: -1, banks: 0 },
    },
    casualties: { magnitudeCap: 12, deltaByGroup: { residents: -4, municipality: -3, banks: -1 } },
    /** El daño deliberado que mata o hiere inquilinos recae también sobre quien lo causó. */
    violent_sabotage: {
      magnitudeCap: 12,
      deltaByGroup: { residents: -5, municipality: -4, banks: -2 },
    },
    tax_arrears: { magnitudeCap: 4, deltaByGroup: { municipality: -4, banks: -3 } },
    maintenance_backlog: { magnitudeCap: 6, deltaByGroup: { residents: -2, municipality: -1 } },
    loan_defaulted: { magnitudeCap: 1, deltaByGroup: { municipality: -2, banks: -12 } },
    loan_paid_off: { magnitudeCap: 1, deltaByGroup: { municipality: 1, banks: 5 } },
  } as const satisfies Record<
    ReputationFactKind,
    {
      readonly magnitudeCap: number;
      readonly deltaByGroup: Partial<Record<ReputationGroupId, number>>;
    }
  >,
  /** Recargos y descuentos sobre la tasa base del préstamo, en puntos básicos. */
  bankRateBpsByStanding: [
    { minimumStanding: 40, modifierBps: -100 },
    { minimumStanding: 10, modifierBps: -25 },
    { minimumStanding: -10, modifierBps: 0 },
    { minimumStanding: -40, modifierBps: 100 },
    { minimumStanding: -101, modifierBps: 250 },
  ] as const,
  /** Porcentaje que la opinión de los residentes aplica a la deseabilidad del parque del dueño. */
  residentFactorPercentByStanding: [
    { minimumStanding: 40, factorPercent: 108 },
    { minimumStanding: 10, factorPercent: 104 },
    { minimumStanding: -10, factorPercent: 100 },
    { minimumStanding: -40, factorPercent: 92 },
    { minimumStanding: -101, factorPercent: 80 },
  ] as const,
  /** Influencia que el gobierno deja en manos de cada empresa al cerrar el mes. */
  influenceGainByStanding: [
    { minimumStanding: 60, influence: 3 },
    { minimumStanding: 20, influence: 2 },
    { minimumStanding: -20, influence: 1 },
    { minimumStanding: -101, influence: 0 },
  ] as const,
} as const;

export type ReputationReport = {
  standingByGroup: Record<ReputationGroupId, number>;
  bankRateModifierBps: number;
  residentFactorPercent: number;
  influenceGainPerMonth: number;
  facts: Array<{ id: string; kind: ReputationFactKind; atTick: Tick; magnitude: number }>;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function initialReputationState(): ReputationState {
  return {
    lastDecayTick: null,
    nextFactOrdinal: 1,
    standingByOrganizationId: {},
    factsByOrganizationId: {},
  };
}

export function standingFor(
  state: GameState,
  organizationId: OrganizationId,
  group: ReputationGroupId,
): number {
  return state.phase2.reputation.standingByOrganizationId[organizationId]?.[group] ?? 0;
}

/** Primera fila de la tabla cuyo umbral alcanza la posición; las tablas van de mejor a peor. */
function rowFor<T extends { readonly minimumStanding: number }>(
  table: readonly T[],
  standing: number,
): T {
  for (const row of table) if (standing >= row.minimumStanding) return row;
  return table[table.length - 1]!;
}

export function bankRateModifierBpsFor(state: GameState, organizationId: OrganizationId): number {
  return rowFor(
    REPUTATION_POLICY.bankRateBpsByStanding,
    standingFor(state, organizationId, "banks"),
  ).modifierBps;
}

export function residentFactorPercentFor(state: GameState, organizationId: OrganizationId): number {
  return rowFor(
    REPUTATION_POLICY.residentFactorPercentByStanding,
    standingFor(state, organizationId, "residents"),
  ).factorPercent;
}

export function influenceGainFor(state: GameState, organizationId: OrganizationId): number {
  return rowFor(
    REPUTATION_POLICY.influenceGainByStanding,
    standingFor(state, organizationId, "municipality"),
  ).influence;
}

/**
 * Registra un hecho y mueve la percepción de los grupos que lo valoran. La magnitud se topa por
 * hecho para que un mes malo no hunda una reputación construida en años.
 */
export function recordReputationFact(
  state: GameState,
  organizationId: OrganizationId,
  kind: ReputationFactKind,
  options: { referenceId?: string | null; magnitude?: number } = {},
): void {
  const spec = REPUTATION_POLICY.facts[kind];
  const magnitude = clamp(options.magnitude ?? 1, 1, spec.magnitudeCap);
  const deltaByGroup: Record<string, number> = {};
  const standing = { ...state.phase2.reputation.standingByOrganizationId[organizationId] };
  for (const group of REPUTATION_GROUPS) {
    const unit = (spec.deltaByGroup as Partial<Record<ReputationGroupId, number>>)[group] ?? 0;
    if (unit === 0) continue;
    const delta = unit * magnitude;
    deltaByGroup[group] = delta;
    standing[group] = clamp(
      (standing[group] ?? 0) + delta,
      REPUTATION_POLICY.minimumStanding,
      REPUTATION_POLICY.maximumStanding,
    );
  }

  state.phase2.reputation.standingByOrganizationId[organizationId] = standing;
  const fact: ReputationFact = {
    id: `reputation_${String(state.phase2.reputation.nextFactOrdinal).padStart(8, "0")}`,
    kind,
    atTick: parseTick(state.clock.tick),
    referenceId: options.referenceId ?? null,
    magnitude,
    deltaByGroup,
  };
  state.phase2.reputation.nextFactOrdinal += 1;
  const history = [...(state.phase2.reputation.factsByOrganizationId[organizationId] ?? []), fact];
  state.phase2.reputation.factsByOrganizationId[organizationId] = history.slice(
    Math.max(0, history.length - REPUTATION_POLICY.factLimitPerOrganization),
  );
}

/** Cierre mensual: hechos agregados del mes, decaimiento de la opinión e influencia acumulada. */
export function runReputation(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;

  for (const organizationId of [...state.organizations.keys()].sort()) {
    const arrears = state.phase2.taxation.arrearsByOrganizationId[organizationId] ?? 0;
    if (arrears > 0) {
      recordReputationFact(state, organizationId, "tax_arrears", {
        magnitude: Math.ceil(arrears / 50),
      });
    }
  }

  const neglectedByOrganizationId = new Map<OrganizationId, number>();
  for (const building of state.phase2.buildings.values()) {
    if ((state.phase2.maintenance.backlogByBuildingId[building.id] ?? 0) <= 0) continue;
    neglectedByOrganizationId.set(
      building.ownerOrganizationId,
      (neglectedByOrganizationId.get(building.ownerOrganizationId) ?? 0) + 1,
    );
  }
  for (const [organizationId, count] of [...neglectedByOrganizationId.entries()].sort(
    (left, right) => left[0].localeCompare(right[0]),
  )) {
    recordReputationFact(state, organizationId, "maintenance_backlog", { magnitude: count });
  }

  for (const organizationId of Object.keys(
    state.phase2.reputation.standingByOrganizationId,
  ).sort()) {
    const standing = state.phase2.reputation.standingByOrganizationId[organizationId]!;
    for (const group of REPUTATION_GROUPS) {
      const decay = REPUTATION_POLICY.decayPerMonth[group];
      const value = standing[group] ?? 0;
      if (decay === 0 || value === 0) continue;
      standing[group] = clamp(
        value > 0 ? Math.max(0, value - decay) : Math.min(0, value + decay),
        REPUTATION_POLICY.minimumStanding,
        REPUTATION_POLICY.maximumStanding,
      );
    }
  }

  for (const organization of [...state.organizations.values()]
    .filter((organization) => organization.kind === "company")
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const gain = influenceGainFor(state, organization.id);
    if (gain === 0) continue;
    state.phase2.influenceByOrganizationId.set(
      organization.id,
      (state.phase2.influenceByOrganizationId.get(organization.id) ?? 0) + gain,
    );
  }

  state.phase2.reputation.lastDecayTick = parseTick(state.clock.tick);
}

/**
 * Lo que el jugador puede saber de sí mismo. La percepción ajena queda fuera a propósito: WP4.9
 * decidirá qué información del rival es pública, inferida o privada.
 */
export function describeReputation(state: GameState): ReputationReport {
  const standingByGroup = Object.fromEntries(
    REPUTATION_GROUPS.map((group) => [group, standingFor(state, PLAYER_ORGANIZATION_ID, group)]),
  ) as Record<ReputationGroupId, number>;
  return {
    standingByGroup,
    bankRateModifierBps: bankRateModifierBpsFor(state, PLAYER_ORGANIZATION_ID),
    residentFactorPercent: residentFactorPercentFor(state, PLAYER_ORGANIZATION_ID),
    influenceGainPerMonth: influenceGainFor(state, PLAYER_ORGANIZATION_ID),
    facts: (state.phase2.reputation.factsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? [])
      .slice(-6)
      .map((fact) => ({
        id: fact.id,
        kind: fact.kind,
        atTick: fact.atTick,
        magnitude: fact.magnitude,
      })),
  };
}
