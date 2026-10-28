import {
  parseTick,
  type FactionEncounterKind,
  type FactionGoalFamily,
  type FactionMemoryEntry,
  type FactionProfileId,
  type FactionState,
  type OrganizationId,
} from "@landlord/shared";
import { GAME_MONTH_TICKS, RIVAL_ORGANIZATION_ID } from "./game-data";
import type { GameState } from "./state";

export type FactionProfile = {
  readonly label: string;
  /** Qué familia de objetivos premia o castiga sobre la puntuación base de la acción. */
  readonly goalBiasByFamily: Record<FactionGoalFamily, number>;
  readonly minimumReservePercent: number;
  readonly maintenanceConditionThreshold: number;
  readonly insuranceRiskThreshold: number;
  /** Porcentaje del presupuesto que oferta en una licitación abierta. */
  readonly contractBidPercent: number;
  /** Cuánto mueve la puja la hostilidad: negativo evita el choque, positivo lo busca. */
  readonly stanceSwingPerHostility: number;
};

/**
 * Dos perfiles, no ocho: sólo la promotora rival tiene una IA que los consuma. El conservador reproduce
 * exactamente los números que el rival usaba antes de WP4.10, así que cambiar de perfil es la única
 * forma de mover el comportamiento y eso hace medible la campaña headless.
 */
export const FACTION_PROFILES: Record<FactionProfileId, FactionProfile> = {
  conservative: {
    label: "Promotora conservadora",
    goalBiasByFamily: {
      acquire: 0,
      develop: 0,
      produce: 0,
      protect: 0,
      finance: 0,
      compete: 0,
      political: 0,
      dispose: 0,
    },
    minimumReservePercent: 30,
    maintenanceConditionThreshold: 55,
    insuranceRiskThreshold: 35,
    contractBidPercent: 92,
    stanceSwingPerHostility: -15,
  },
  expansionist: {
    label: "Promotora expansionista",
    goalBiasByFamily: {
      acquire: 14,
      develop: 12,
      produce: 10,
      protect: -8,
      finance: -6,
      compete: 8,
      political: 0,
      dispose: -12,
    },
    minimumReservePercent: 12,
    maintenanceConditionThreshold: 40,
    insuranceRiskThreshold: 25,
    contractBidPercent: 97,
    stanceSwingPerHostility: 20,
  },
};

export const FACTION_DEFAULT_PROFILE_ID: FactionProfileId = "conservative";

/** Cada acción del repertorio pertenece a una familia de objetivos; el perfil pondera la familia. */
export const FACTION_ACTION_FAMILY: Record<string, FactionGoalFamily> = {
  assign_tenant: "develop",
  buy_materials: "develop",
  start_construction: "develop",
  build_production: "produce",
  expand_production: "produce",
  buy_parcel: "acquire",
  bid_auction: "acquire",
  repair_building: "protect",
  buy_insurance: "protect",
  request_financing: "finance",
  refinance_debt: "finance",
  bid_public_contract: "compete",
  lobby_policy: "political",
  sell_parcel: "dispose",
};

export const FACTION_POLICY = {
  minimumStance: -100,
  maximumStance: 100,
  /** La hostilidad se olvida sola si no hay nuevos choques. */
  stanceDecayPerMonth: 3,
  memoryLimitPerOrganization: 12,
  /** Fuera de esta ventana un recuerdo ya no pesa: el mundo cambió y la acción puede volver. */
  memoryWindowTicks: 3 * GAME_MONTH_TICKS,
  repetition: {
    rejectionStrikes: 2,
    rejectionPenalty: -60,
    /** A este número de rechazos seguidos la acción se aparta hasta que la ventana la olvide. */
    suppressionStrikes: 3,
  },
  encounters: {
    sabotage: -12,
    auction_outbid: -6,
    tender_contested: -2,
    /** Compartir manzana entre parcelas de dos empresas: roce, no guerra. */
    territory: -1,
  },
  territoryCapPerMonth: -4,
} as const;

function pairKey(observerId: OrganizationId, subjectId: OrganizationId): string {
  return `${observerId}>${subjectId}`;
}

export function initialFactionState(): FactionState {
  return {
    profileByOrganizationId: {},
    stanceByPairId: {},
    memoryByOrganizationId: {},
    cycleCountByOrganizationId: {},
    nextMemoryOrdinal: 1,
    lastDecayTick: null,
  };
}

/**
 * El perfil vive en `factions`, pero el selector de estrategia del rival sigue siendo el campo que ya
 * existía: una sola fuente por organización y el conservador es el valor con el que arranca toda partida.
 */
export function factionProfileIdOf(
  state: GameState,
  organizationId: OrganizationId,
): FactionProfileId {
  const stored = state.phase2.factions.profileByOrganizationId[organizationId];
  if (stored) return stored;
  return organizationId === RIVAL_ORGANIZATION_ID
    ? state.phase2.rivalAi.strategyProfile
    : FACTION_DEFAULT_PROFILE_ID;
}

export function factionProfileOf(state: GameState, organizationId: OrganizationId): FactionProfile {
  return FACTION_PROFILES[factionProfileIdOf(state, organizationId)];
}

export function setFactionProfile(
  state: GameState,
  organizationId: OrganizationId,
  profileId: FactionProfileId,
): void {
  state.phase2.factions.profileByOrganizationId[organizationId] = profileId;
}

export function stanceFor(
  state: GameState,
  observerId: OrganizationId,
  subjectId: OrganizationId,
): number {
  return state.phase2.factions.stanceByPairId[pairKey(observerId, subjectId)] ?? 0;
}

function clampStance(value: number): number {
  return Math.max(FACTION_POLICY.minimumStance, Math.min(FACTION_POLICY.maximumStance, value));
}

/**
 * Registrar una postura en ceros: se borra la entrada en vez de guardar un 0 eterno, para que una
 * partida jugada diez años no acumule pares sin relación.
 */
function writeStance(
  state: GameState,
  observerId: OrganizationId,
  subjectId: OrganizationId,
  next: number,
): void {
  const key = pairKey(observerId, subjectId);
  if (next === 0) delete state.phase2.factions.stanceByPairId[key];
  else state.phase2.factions.stanceByPairId[key] = next;
}

/**
 * Un encuentro es una interacción observable entre dos organizaciones: nadie cambia de opinión por
 * decreto, sólo por algo que la otra hizo o por compartir suelo. La postura la forma el observador
 * sobre quien actuó, nunca al revés por simpatía.
 */
export function recordFactionEncounter(
  state: GameState,
  observerId: OrganizationId,
  subjectId: OrganizationId,
  kind: FactionEncounterKind,
): void {
  if (observerId === subjectId) return;
  const current = stanceFor(state, observerId, subjectId);
  const next = clampStance(current + FACTION_POLICY.encounters[kind]);
  if (next !== current) writeStance(state, observerId, subjectId, next);
}

/** Lo peor que la organización recuerda de cualquier otra empresa: la hostilidad que manda es la activa. */
export function worstStanceAgainstCompanies(state: GameState, observerId: OrganizationId): number {
  let worst = 0;
  for (const organization of [...state.organizations.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (organization.kind !== "company" || organization.id === observerId) continue;
    worst = Math.min(worst, stanceFor(state, observerId, organization.id));
  }
  return worst;
}

export function publicBidPercentFor(state: GameState, organizationId: OrganizationId): number {
  const profile = factionProfileOf(state, organizationId);
  /**
   * La hostilidad modula la puja entre dos cotas: por debajo de 50 no cubre el coste de ejecutar y por
   * encima de 100 la oferta supera el presupuesto anunciado, así que sería rechazada por el motor.
   */
  const hostility = -worstStanceAgainstCompanies(state, organizationId);
  const swing = (profile.stanceSwingPerHostility * hostility) / 100;
  return Math.max(50, Math.min(100, profile.contractBidPercent + swing));
}

export function rememberFactionAction(
  state: GameState,
  organizationId: OrganizationId,
  input: { action: string; target: string; accepted: boolean; rejectionCode: string | null },
): void {
  const memory = state.phase2.factions.memoryByOrganizationId;
  const entry: FactionMemoryEntry = {
    id: `faction_${String(state.phase2.factions.nextMemoryOrdinal).padStart(8, "0")}`,
    atTick: parseTick(state.clock.tick),
    action: input.action,
    target: input.target,
    accepted: input.accepted,
    rejectionCode: input.rejectionCode,
  };
  state.phase2.factions.nextMemoryOrdinal += 1;
  memory[organizationId] = [...(memory[organizationId] ?? []), entry].slice(
    -FACTION_POLICY.memoryLimitPerOrganization,
  );
}

/**
 * Rechazos acumulados sobre la misma acción y el mismo destino dentro de la ventana. Solo cuentan los
 * intentos fallidos: repetir con éxito es trabajo, no un bucle.
 */
function rejectedAttempts(
  state: GameState,
  organizationId: OrganizationId,
  action: string,
  target: string,
): number {
  const entries = state.phase2.factions.memoryByOrganizationId[organizationId] ?? [];
  const windowStart = state.clock.tick - FACTION_POLICY.memoryWindowTicks;
  return entries.filter(
    (entry) =>
      entry.atTick >= windowStart &&
      !entry.accepted &&
      entry.action === action &&
      entry.target === target,
  ).length;
}

/**
 * Antirrepetición blanda: insistir dos veces en algo que ya falló cuesta, pero no lo prohíbe. Si el
 * contexto mejora, la acción sigue siendo elegible.
 */
export function repetitionPenaltyFor(
  state: GameState,
  organizationId: OrganizationId,
  action: string,
  target: string,
): number {
  if (
    rejectedAttempts(state, organizationId, action, target) >=
    FACTION_POLICY.repetition.rejectionStrikes
  )
    return FACTION_POLICY.repetition.rejectionPenalty;
  return 0;
}

/**
 * Antirrepetición dura: tras tres rechazos la acción se aparta del menú hasta que la ventana la olvide.
 * La penalización sola no basta —se midió en campaña— porque un candidato con utilidad negativa sigue
 * siendo el mejor cuando el resto del mundo también está bloqueado, y la IA se queda dando golpes contra
 * el mismo muro durante meses.
 */
export function isActionCycleSuppressed(
  state: GameState,
  organizationId: OrganizationId,
  action: string,
  target: string,
): boolean {
  return (
    rejectedAttempts(state, organizationId, action, target) >=
    FACTION_POLICY.repetition.suppressionStrikes
  );
}

export function noteCycleSuppressed(state: GameState, organizationId: OrganizationId): void {
  state.phase2.factions.cycleCountByOrganizationId[organizationId] =
    (state.phase2.factions.cycleCountByOrganizationId[organizationId] ?? 0) + 1;
}

/**
 * Pares ordenados de empresas que se tocan en el mapa, con cuántas fronteras comparten. Las parcelas se
 * plantan con `spacingX = spacingY = 2` dentro de cada manzana, así que "compartir manzana" significa
 * estar a una o dos celdas en la misma fila o columna: mirar sólo la celda vecina no encontraría nada en
 * un distrito real. NO es la calzada — el origen de cada manzana se sortea, la paridad cambia de manzana
 * en manzana. La topología vial autoritativa no cambia todavía esta métrica de territorio (D-085).
 */
function territoryContacts(state: GameState): Array<[string, number]> {
  const ownerByCell = new Map<string, OrganizationId>();
  for (const parcel of [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (!parcel.ownerOrganizationId) continue;
    if (state.organizations.get(parcel.ownerOrganizationId)?.kind !== "company") continue;
    ownerByCell.set(`${parcel.anchorCell.x}:${parcel.anchorCell.y}`, parcel.ownerOrganizationId);
  }
  const contacts = new Map<string, number>();
  /** Sólo hacia adelante: cada frontera entre dos parcelas se cuenta una vez. */
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [2, 0],
    [0, 1],
    [0, 2],
  ];
  for (const [key, owner] of [...ownerByCell.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const [x, y] = key.split(":");
    for (const [dx, dy] of offsets) {
      const neighbour = ownerByCell.get(`${Number(x) + dx}:${Number(y) + dy}`);
      if (!neighbour || neighbour === owner) continue;
      const pair = owner < neighbour ? pairKey(owner, neighbour) : pairKey(neighbour, owner);
      contacts.set(pair, (contacts.get(pair) ?? 0) + 1);
    }
  }
  return [...contacts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function runFactions(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;

  for (const [key, value] of Object.entries(state.phase2.factions.stanceByPairId)) {
    if (value === 0) continue;
    const [observerId, subjectId] = key.split(">") as [OrganizationId, OrganizationId];
    /** El decaimiento se detiene en cero: la hostilidad no se convierte en amistad por el paso del tiempo. */
    const decayed =
      value > 0
        ? Math.max(0, value - FACTION_POLICY.stanceDecayPerMonth)
        : Math.min(0, value + FACTION_POLICY.stanceDecayPerMonth);
    writeStance(state, observerId, subjectId, clampStance(decayed));
  }

  /** La presión territorial se topa por mes: compartir manzana no declara una guerra. */
  for (const [key, borders] of territoryContacts(state)) {
    const [first, second] = key.split(">") as [OrganizationId, OrganizationId];
    const pressure = Math.max(
      FACTION_POLICY.territoryCapPerMonth,
      FACTION_POLICY.encounters.territory * borders,
    );
    /** El roce es mutuo: ambas promotoras lo sienten, aunque la frontera se cuente una sola vez. */
    writeStance(state, first, second, clampStance(stanceFor(state, first, second) + pressure));
    writeStance(state, second, first, clampStance(stanceFor(state, second, first) + pressure));
  }

  const windowStart = state.clock.tick - FACTION_POLICY.memoryWindowTicks;
  for (const [organizationId, entries] of Object.entries(
    state.phase2.factions.memoryByOrganizationId,
  )) {
    const kept = entries.filter((entry) => entry.atTick >= windowStart);
    if (kept.length === 0) delete state.phase2.factions.memoryByOrganizationId[organizationId];
    else state.phase2.factions.memoryByOrganizationId[organizationId] = kept;
  }

  state.phase2.factions.lastDecayTick = parseTick(state.clock.tick);
}

export function describeFactions(
  state: GameState,
  organizationId: OrganizationId,
): {
  profileId: FactionProfileId;
  label: string;
  goalBiasByFamily: Record<FactionGoalFamily, number>;
  contractBidPercent: number;
  minimumReservePercent: number;
  worstStance: number;
  rememberedActions: number;
  cyclesSuppressed: number;
} {
  const profile = factionProfileOf(state, organizationId);
  return {
    profileId: factionProfileIdOf(state, organizationId),
    label: profile.label,
    goalBiasByFamily: profile.goalBiasByFamily,
    contractBidPercent: profile.contractBidPercent,
    minimumReservePercent: profile.minimumReservePercent,
    worstStance: worstStanceAgainstCompanies(state, organizationId),
    rememberedActions: (state.phase2.factions.memoryByOrganizationId[organizationId] ?? []).length,
    cyclesSuppressed: state.phase2.factions.cycleCountByOrganizationId[organizationId] ?? 0,
  };
}
