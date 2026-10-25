import {
  POLITICAL_ISSUES,
  parseTick,
  type MunicipalParty,
  type MunicipalPoliticsState,
  type Ordinance,
  type PoliticalIssue,
  type Tenant,
  type Tick,
} from "@landlord/shared";
import {
  GAME_MONTH_TICKS,
  MUNICIPAL_PARTY_CATALOG,
  MUNICIPAL_POLICY_DURATION_TICKS,
  MUNICIPAL_TERM_MONTHS,
  createMunicipalPolicy,
} from "./game-data";
import { Xoshiro128ss } from "./prng";
import { askingRentFor } from "./housing-market";
import { describeLaborMarket } from "./employment";
import type { MunicipalBudgetCategory } from "./municipal-budget";
import { municipalServiceFee } from "./urban-services";
import type { GameState } from "./state";

/**
 * Concejo ficticio de nueve escaños y una legislatura deliberadamente corta: con doce meses por
 * mandato el distrito entero puede pasar sin ver nunca una alternancia, y el electorado no llega a
 * castigar al gobierno que produjo su propia queja.
 */
export const MUNICIPAL_INSTITUTION = {
  councilSeats: 9,
  termMonths: MUNICIPAL_TERM_MONTHS,
  /** Meses que el concejo deja pasar desde la elección hasta que debate su propia ordenanza. */
  debateDelayMonths: 2,
} as const;

/** Todos los baremos de la opinión en un solo sitio: los números que un diseñador mueve para cambiar el clima. */
export const MUNICIPAL_MOOD_POLICY = {
  /**
   * Porcentaje del presupuesto de renta que un hogar considera cómodo. El mercado sólo firma cuando
   * la renta cabe en el presupuesto, así que la queja aparece justo cuando el distrito empuja a los
   * hogares a vivir en el techo de lo que pueden pagar.
   */
  housingComfortableRentSharePercent: 80,
  housingGrievancePerPointOverShare: 3,
  /**
   * Queja de vivienda con todo el distrito desplazado, en puntos sobre la base cómoda. Se reparte
   * por proporción de hogares afectados: un desplazado pesa distinto en un barrio de dos que en uno
   * de doscientos, y no hay una rama especial para el distrito vacío.
   */
  housingDisplacedWeight: 100,
  safetyPolicePressurePenalty: 6,
  safetyRuinPenalty: 5,
  safetyIncidentPenalty: 3,
  /** Porcentaje de la renta del distrito que el municipio puede quedarse sin generar queja. */
  taxesComfortableSharePercent: 25,
  taxesGrievancePerPointOverShare: 2,
} as const;

/** Baremos del voto: participación, ruido y castigo a quien ya gobierna. */
export const MUNICIPAL_ELECTION_POLICY = {
  baseTurnoutPercent: 45,
  turnoutPerGrievancePoint: 0.5,
  minimumTurnoutPercent: 30,
  maximumTurnoutPercent: 95,
  /** Dispersión del PRNG sobre la preferencia de cada votante, en puntos de apelación. */
  persuasionNoisePoints: 15,
  /** Fracción de la apelación que pierde el governing party cuando un asunto suyo está en queja. */
  incumbentPenaltyFactorPercent: 40,
} as const;

/**
 * A quién le importa cada asunto dentro de cada segmento. Son datos, no condicionales: el hogar
 * vota angustiado por la renta, el artesano por el trabajo y el comerciante por las licencias y
 * las tasas, igual que eligen su vivienda por criterios distintos.
 */
export const POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT: Record<
  string,
  Record<PoliticalIssue, number>
> = {
  household: { housing: 45, employment: 25, safety: 20, services: 5, taxes: 5 },
  maker: { housing: 20, employment: 45, safety: 15, services: 10, taxes: 10 },
  shopkeeper: { housing: 15, employment: 25, safety: 20, services: 25, taxes: 15 },
};

const FALLBACK_PRIORITY_WEIGHTS: Record<PoliticalIssue, number> = {
  housing: 30,
  employment: 25,
  safety: 20,
  services: 15,
  taxes: 10,
};

const SERVICE_CATEGORIES: readonly MunicipalBudgetCategory[] = [
  "transport",
  "security",
  "cleaning",
];

export function politicalPartyById(partyId: string): MunicipalParty | null {
  return MUNICIPAL_PARTY_CATALOG.find((party) => party.id === partyId) ?? null;
}

export function initialMunicipalPoliticsState(): MunicipalPoliticsState {
  const seatsByPartyId: Record<string, number> = {};
  const supportPercentByPartyId: Record<string, number> = {};
  const moodByIssue: Record<string, number> = {};
  for (const issue of POLITICAL_ISSUES) moodByIssue[issue] = 100;
  for (const party of MUNICIPAL_PARTY_CATALOG) {
    seatsByPartyId[party.id] = party.openingSeats;
    supportPercentByPartyId[party.id] = Math.round(
      (100 * party.openingSeats) / MUNICIPAL_INSTITUTION.councilSeats,
    );
  }
  return {
    seatsByPartyId,
    governingPartyId: governingPartyOf(seatsByPartyId),
    moodByIssue,
    supportPercentByPartyId,
    lastTurnoutPercent: 0,
    electionsHeld: 0,
    lastElectionTick: null,
    nextElectionTick: parseTick(GAME_MONTH_TICKS * MUNICIPAL_INSTITUTION.termMonths),
    lastMoodTick: null,
    nextDebateTick: null,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function moodOf(state: GameState, issue: PoliticalIssue): number {
  return state.phase2.politics.moodByIssue[issue] ?? 100;
}

/** Opinión de vivienda: qué parte de su presupuesto de renta gastan los hogares contratados. */
type HomeCensus = {
  /** Puntos por encima del presupuesto cómodo, sumados sobre todos los hogares. */
  burdenPoints: number;
  households: number;
  displaced: number;
  /** Renta que el distrito paga cada mes: la base sobre la que se mide la carga fiscal. */
  rentRoll: number;
};

function censusHomes(state: GameState): HomeCensus {
  const census: HomeCensus = { burdenPoints: 0, households: 0, displaced: 0, rentRoll: 0 };
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status === "displaced") {
      census.displaced += 1;
      continue;
    }
    if (tenant.status !== "contracted" || !tenant.activeContractBuildingId) continue;
    const building = state.phase2.buildings.get(tenant.activeContractBuildingId);
    if (!building) continue;
    const rent = askingRentFor(state, building);
    census.rentRoll += rent;
    if (tenant.budget <= 0) continue;
    const rentSharePercent = Math.round((100 * rent) / tenant.budget);
    census.burdenPoints += Math.max(
      0,
      rentSharePercent - MUNICIPAL_MOOD_POLICY.housingComfortableRentSharePercent,
    );
    census.households += 1;
  }
  return census;
}

function housingMood(census: HomeCensus): number {
  const affectedHouseholds = census.households + census.displaced;
  if (affectedHouseholds === 0) return 100;
  /** Proporción, no recuento: el mismo desplazado no puede pesar igual en dos hogares que en doscientos. */
  const displacedGrievance =
    (census.displaced / affectedHouseholds) * MUNICIPAL_MOOD_POLICY.housingDisplacedWeight;
  const meanBurden = census.burdenPoints / affectedHouseholds + displacedGrievance;
  return clamp(100 - meanBurden * MUNICIPAL_MOOD_POLICY.housingGrievancePerPointOverShare, 0, 100);
}

function employmentMood(state: GameState): number {
  return clamp(describeLaborMarket(state).employmentRatePercent, 0, 100);
}

/** Opinión de seguridad: lo que el distrito observa, no lo que el jugador declara. */
function safetyMood(state: GameState): number {
  let ruins = 0;
  for (const building of state.phase2.buildings.values()) {
    if (building.state === "ruin") ruins += 1;
  }
  const windowStart = state.clock.tick - GAME_MONTH_TICKS;
  let recentIncidents = 0;
  for (const incident of state.phase2.incidents.values()) {
    if (incident.createdAtTick > windowStart) recentIncidents += 1;
  }
  const grievance =
    state.phase2.crime.policePressure * MUNICIPAL_MOOD_POLICY.safetyPolicePressurePenalty +
    ruins * MUNICIPAL_MOOD_POLICY.safetyRuinPenalty +
    recentIncidents * MUNICIPAL_MOOD_POLICY.safetyIncidentPenalty;
  return clamp(100 - grievance, 0, 100);
}

/**
 * Opinión de servicios: el nivel realmente pagado por el municipio. Se lee antes del cierre
 * presupuestario del mes, así que el vecino juzga el servicio que ha tenido, no el que se acaba de
 * aprobar.
 */
function servicesMood(state: GameState): number {
  const levels = SERVICE_CATEGORIES.map(
    (category) => state.phase2.municipal.serviceLevelPercentByCategory[category] ?? 100,
  );
  return clamp(levels.reduce((sum, level) => sum + level, 0) / levels.length, 0, 100);
}

/**
 * Opinión de impuestos: cuánta parte de la renta del distrito se ha llevado el municipio este mes,
 * incluyendo la tasa de servicios. Bajar el recibo no sube la opinión por encima de neutra; subirlo
 * sí la hunde. Ahí está el cambio que el concejo paga: recortar ingresos contenta un mes y descubre
 * el servicio al siguiente.
 *
 * La tasa de servicios se mide con el mismo helper puro que la cobra el presupuesto, no con el
 * acumulado: `politics` cierra antes que `municipal`, así que el recibo del mes todavía no está
 * apuntado y leer sólo el libro dejaría el eje fiscal ciego a su ingreso más elástico.
 */
function taxesMood(state: GameState, census: HomeCensus): number {
  const revenue = state.phase2.municipal.revenueThisMonthBySource;
  const collected =
    (revenue.propertyTax ?? 0) + (revenue.transferTax ?? 0) + municipalServiceFee(state);
  if (census.rentRoll <= 0) return 100;
  const chargeSharePercent = (100 * collected) / census.rentRoll;
  const overShare = Math.max(
    0,
    chargeSharePercent - MUNICIPAL_MOOD_POLICY.taxesComfortableSharePercent,
  );
  return clamp(100 - overShare * MUNICIPAL_MOOD_POLICY.taxesGrievancePerPointOverShare, 0, 100);
}

export function computeCivicMood(state: GameState): Record<PoliticalIssue, number> {
  const census = censusHomes(state);
  return {
    housing: housingMood(census),
    employment: employmentMood(state),
    safety: safetyMood(state),
    services: servicesMood(state),
    taxes: taxesMood(state, census),
  };
}

function priorityWeightsOf(segmentId: string): Record<PoliticalIssue, number> {
  return POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT[segmentId] ?? FALLBACK_PRIORITY_WEIGHTS;
}

/** Queja ponderada del segmento de un hogar: 0 es "nada le duele", 100 es "lo tiene todo en contra". */
function grievanceFor(state: GameState, segmentId: string): number {
  const weights = priorityWeightsOf(segmentId);
  let total = 0;
  let weightSum = 0;
  for (const issue of POLITICAL_ISSUES) {
    const weight = weights[issue] ?? 0;
    total += weight * (100 - moodOf(state, issue));
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

/**
 * Apelación de un partido para un votante: su saliencia media sobre los asuntos que le duelen. El
 * que gobierna pierde además una fracción de esa apelación proporcional a lo mucho que prometió
 * justo en los asuntos rotos, que es como la opinión se convierte en castigo.
 */
function appealFor(
  state: GameState,
  party: MunicipalParty,
  voterWeights: Record<PoliticalIssue, number>,
): number {
  let weightedSalience = 0;
  let pain = 0;
  for (const issue of POLITICAL_ISSUES) {
    const hurt = ((voterWeights[issue] ?? 0) / 100) * (100 - moodOf(state, issue));
    pain += hurt;
    weightedSalience += hurt * (party.positionByIssue[issue] / 100);
  }
  if (party.id === state.phase2.politics.governingPartyId) {
    /** Sin dolor no hay preferencia: el votante contento sostiene al gobierno. */
    if (pain <= 0) return 75;
    const brokenPromises =
      POLITICAL_ISSUES.reduce(
        (sum, issue) => sum + (party.positionByIssue[issue] / 100) * (100 - moodOf(state, issue)),
        0,
      ) / POLITICAL_ISSUES.length;
    return (
      (100 * weightedSalience) / pain -
      brokenPromises * MUNICIPAL_ELECTION_POLICY.incumbentPenaltyFactorPercent
    );
  }
  if (pain <= 0) return 50;
  return (100 * weightedSalience) / pain;
}

/** Reparto por cociente mayor: el resto se asigna por residuo y el empate se rompe por id. */
function allocateSeats(votesByPartyId: Record<string, number>): Record<string, number> {
  const totalVotes = MUNICIPAL_PARTY_CATALOG.reduce(
    (sum, party) => sum + (votesByPartyId[party.id] ?? 0),
    0,
  );
  const seatsByPartyId: Record<string, number> = {};
  if (totalVotes === 0) {
    for (const party of MUNICIPAL_PARTY_CATALOG) seatsByPartyId[party.id] = party.openingSeats;
    return seatsByPartyId;
  }
  const remainders: Array<{ partyId: string; remainder: number }> = [];
  let assigned = 0;
  for (const party of MUNICIPAL_PARTY_CATALOG) {
    const exact =
      ((votesByPartyId[party.id] ?? 0) * MUNICIPAL_INSTITUTION.councilSeats) / totalVotes;
    const seats = Math.floor(exact);
    seatsByPartyId[party.id] = seats;
    assigned += seats;
    remainders.push({ partyId: party.id, remainder: exact - seats });
  }
  const ordered = [...remainders].sort(
    (left, right) => right.remainder - left.remainder || left.partyId.localeCompare(right.partyId),
  );
  for (let index = 0; index < MUNICIPAL_INSTITUTION.councilSeats - assigned; index += 1) {
    const next = ordered[index % ordered.length];
    if (!next) break;
    seatsByPartyId[next.partyId] = (seatsByPartyId[next.partyId] ?? 0) + 1;
  }
  return seatsByPartyId;
}

function governingPartyOf(seatsByPartyId: Record<string, number>): string {
  const sorted = [...MUNICIPAL_PARTY_CATALOG].sort(
    (left, right) =>
      (seatsByPartyId[right.id] ?? 0) - (seatsByPartyId[left.id] ?? 0) ||
      left.id.localeCompare(right.id),
  );
  return sorted[0]!.id;
}

/**
 * Eje de cada modificador de una ordenanza y el signo con el que alivia o agrava al votante: la
 * única tabla que conecta una ley con la política. Bajar la renta o las tasas alivia (signo −1);
 * aprobar más licencias también alivia, pero sube (signo +1).
 */
const ORDINANCE_AXES: ReadonlyArray<{
  axis: keyof Ordinance;
  issue: PoliticalIssue;
  reliefSign: 1 | -1;
}> = [
  { axis: "rentModifierPercent", issue: "housing", reliefSign: -1 },
  { axis: "materialCostModifierPercent", issue: "employment", reliefSign: -1 },
  { axis: "propertyTaxModifierPercent", issue: "taxes", reliefSign: -1 },
  { axis: "transferTaxModifierPercent", issue: "taxes", reliefSign: -1 },
  { axis: "permitApprovalModifierPercent", issue: "services", reliefSign: 1 },
];

/**
 * Cuánto empuja o frena el concejo gobernante a una ordenanza, en puntos porcentuales de
 * probabilidad de aprobación. Topado a ±25: ni la formación más hostil bloquea una ley ella sola,
 * ni la más afín la aprueba sin que nadie la trabaje.
 */
export function councilAlignmentPercent(state: GameState, ordinance: Ordinance): number {
  const party = politicalPartyById(state.phase2.politics.governingPartyId);
  if (!party) return 0;
  let score = 0;
  for (const { axis, issue, reliefSign } of ORDINANCE_AXES) {
    const modifier = ordinance[axis];
    if (typeof modifier !== "number") continue;
    score += reliefSign * (modifier / 100) * (party.positionByIssue[issue] / 100);
  }
  return clamp(score * 100, -25, 25);
}

/**
 * Orden de pago del presupuesto municipal: manda la plataforma del partido que gobierna la caja.
 * El orden por defecto lo recibe como argumento, para que el catálogo de categorías siga viviendo
 * en el módulo de presupuesto y esta función no dependa de él.
 */
export function budgetPriorityFor(
  state: GameState,
  fallback: readonly MunicipalBudgetCategory[],
): readonly MunicipalBudgetCategory[] {
  const party = politicalPartyById(state.phase2.politics.governingPartyId);
  if (!party) return fallback;
  const known = new Set<MunicipalBudgetCategory>(fallback);
  /** Se ignoran las categorías desconocidas y se añaden al final las que el partido omitió. */
  const order = party.budgetPriority.filter((category): category is MunicipalBudgetCategory =>
    known.has(category as MunicipalBudgetCategory),
  );
  for (const category of fallback) {
    if (!order.includes(category)) order.push(category);
  }
  return order;
}

/**
 * Debate del concejo: si la mesa está libre, la formación gobernante intenta poner su propia
 * ordenanza en vigor con la probabilidad que dicta su alineamiento. Si otro texto la ocupa, el
 * debate se pospone un mes: el jugador puede frenar la ley del concejo manteniendo la suya vigente.
 * Una ley ya activa nunca se vuelve a sortear: su vigencia es el resultado, no una propuesta nueva.
 */
function runCouncilDebate(state: GameState): void {
  const politics = state.phase2.politics;
  politics.nextDebateTick = null;
  const party = politicalPartyById(politics.governingPartyId);
  if (!party) return;
  const ordinance = state.phase2.ordinance;
  if (ordinance.status === "active") {
    if (ordinance.id !== party.preferredOrdinanceId) {
      politics.nextDebateTick = parseTick(state.clock.tick + GAME_MONTH_TICKS);
      return;
    }
    /** Su propia ley ya está en vigor: no hay nada que debatir hasta que caduque o llegue otra ventana. */
    politics.nextDebateTick =
      ordinance.expiresAtTick !== null && ordinance.expiresAtTick > state.clock.tick
        ? ordinance.expiresAtTick
        : parseTick(state.clock.tick + GAME_MONTH_TICKS);
    return;
  }
  if (
    ["proposed", "approved"].includes(ordinance.status) &&
    ordinance.id !== party.preferredOrdinanceId
  ) {
    politics.nextDebateTick = parseTick(state.clock.tick + GAME_MONTH_TICKS);
    return;
  }
  const bill = createMunicipalPolicy(String(party.preferredOrdinanceId));
  if (!bill) return;
  const chance = Math.min(
    95,
    Math.max(5, bill.approvalChancePercent + councilAlignmentPercent(state, bill)),
  );
  const generator = new Xoshiro128ss(state.seed);
  generator.restoreState(state.prng);
  const enacted = generator.nextInt(0, 100) < chance;
  state.prng = generator.exportState();
  state.phase2.ordinance = {
    ...bill,
    status: enacted ? "active" : "rejected",
    proposedAtTick: parseTick(state.clock.tick),
    activeFromTick: enacted ? parseTick(state.clock.tick) : null,
    expiresAtTick: enacted ? parseTick(state.clock.tick + MUNICIPAL_POLICY_DURATION_TICKS) : null,
  };
}

/**
 * Censo electoral: sólo residentes efectivos. Un hogar vota si tiene contrato vigente y el edificio
 * existe; los que buscan piso y los desplazados no están en el padrón. Los desplazados de un colapso
 * siguen en el estado como memoria del hogar, pero no vuelven a votar ni inflan la participación.
 */
export function eligibleVoters(state: GameState): Tenant[] {
  const voters: Tenant[] = [];
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status !== "contracted") continue;
    if (!tenant.activeContractBuildingId) continue;
    if (!state.phase2.buildings.has(tenant.activeContractBuildingId)) continue;
    voters.push(tenant);
  }
  return voters.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Elección: cada hogar del distrito decide con la opinión del mes. La participación sube con la
 * queja, el voto sigue la saliencia de cada partido sobre los asuntos que duelen y el PRNG siembra
 * el resto. El resultado emerge del estado social: el jugador no vota, sólo puede cambiar el
 * estado que la opinión observa.
 */
function holdElection(state: GameState): void {
  const politics = state.phase2.politics;
  const generator = new Xoshiro128ss(state.seed);
  generator.restoreState(state.prng);
  const voters = eligibleVoters(state);
  const votesByPartyId: Record<string, number> = {};
  for (const party of MUNICIPAL_PARTY_CATALOG) votesByPartyId[party.id] = 0;
  let voted = 0;
  for (const voter of voters) {
    const turnoutPercent = clamp(
      MUNICIPAL_ELECTION_POLICY.baseTurnoutPercent +
        grievanceFor(state, voter.segmentId) * MUNICIPAL_ELECTION_POLICY.turnoutPerGrievancePoint,
      MUNICIPAL_ELECTION_POLICY.minimumTurnoutPercent,
      MUNICIPAL_ELECTION_POLICY.maximumTurnoutPercent,
    );
    if (generator.nextInt(0, 100) >= turnoutPercent) continue;
    voted += 1;
    const voterWeights = priorityWeightsOf(voter.segmentId);
    let bestPartyId = MUNICIPAL_PARTY_CATALOG[0]!.id;
    let bestAppeal = Number.NEGATIVE_INFINITY;
    for (const party of MUNICIPAL_PARTY_CATALOG) {
      const noise =
        generator.nextInt(0, 2 * MUNICIPAL_ELECTION_POLICY.persuasionNoisePoints + 1) -
        MUNICIPAL_ELECTION_POLICY.persuasionNoisePoints;
      const appeal = appealFor(state, party, voterWeights) + noise;
      if (appeal > bestAppeal) {
        bestAppeal = appeal;
        bestPartyId = party.id;
      }
    }
    votesByPartyId[bestPartyId] = (votesByPartyId[bestPartyId] ?? 0) + 1;
  }
  state.prng = generator.exportState();

  politics.seatsByPartyId = allocateSeats(votesByPartyId);
  politics.governingPartyId = governingPartyOf(politics.seatsByPartyId);
  politics.lastTurnoutPercent = voters.length === 0 ? 0 : Math.round((100 * voted) / voters.length);
  for (const party of MUNICIPAL_PARTY_CATALOG) {
    politics.supportPercentByPartyId[party.id] =
      voted === 0
        ? Math.round(
            (100 * (politics.seatsByPartyId[party.id] ?? 0)) / MUNICIPAL_INSTITUTION.councilSeats,
          )
        : Math.round((100 * (votesByPartyId[party.id] ?? 0)) / voted);
  }
  politics.electionsHeld += 1;
  politics.lastElectionTick = parseTick(state.clock.tick);
  politics.nextElectionTick = parseTick(
    state.clock.tick + GAME_MONTH_TICKS * MUNICIPAL_INSTITUTION.termMonths,
  );
  politics.nextDebateTick = parseTick(
    state.clock.tick + GAME_MONTH_TICKS * MUNICIPAL_INSTITUTION.debateDelayMonths,
  );
}

export function runMunicipalPolitics(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const politics = state.phase2.politics;
  const mood = computeCivicMood(state);
  for (const issue of POLITICAL_ISSUES) politics.moodByIssue[issue] = mood[issue];
  politics.lastMoodTick = parseTick(state.clock.tick);
  if (state.clock.tick >= politics.nextElectionTick) holdElection(state);
  const debateTick = politics.nextDebateTick;
  if (debateTick !== null && state.clock.tick >= debateTick) runCouncilDebate(state);
}

export type MunicipalPoliticsReport = {
  seatsByPartyId: Record<string, number>;
  governingPartyId: string;
  governingPartyName: string;
  moodByIssue: Record<string, number>;
  supportPercentByPartyId: Record<string, number>;
  lastTurnoutPercent: number;
  electionsHeld: number;
  lastElectionTick: Tick | null;
  nextElectionTick: Tick;
  nextDebateTick: Tick | null;
  councilOrdinanceId: string | null;
  parties: Array<{
    id: string;
    name: string;
    seats: number;
    supportPercent: number;
    positionByIssue: Record<string, number>;
  }>;
};

/** Lo que el jugador ve del concejo: todo se deriva del estado autoritativo, nada es una simulación aparte. */
export function describeMunicipalPolitics(state: GameState): MunicipalPoliticsReport {
  const politics = state.phase2.politics;
  const governing = politicalPartyById(politics.governingPartyId);
  return {
    seatsByPartyId: { ...politics.seatsByPartyId },
    governingPartyId: politics.governingPartyId,
    governingPartyName: governing?.name ?? "",
    moodByIssue: { ...politics.moodByIssue },
    supportPercentByPartyId: { ...politics.supportPercentByPartyId },
    lastTurnoutPercent: politics.lastTurnoutPercent,
    electionsHeld: politics.electionsHeld,
    lastElectionTick: politics.lastElectionTick,
    nextElectionTick: politics.nextElectionTick,
    nextDebateTick: politics.nextDebateTick,
    councilOrdinanceId: governing ? String(governing.preferredOrdinanceId) : null,
    parties: MUNICIPAL_PARTY_CATALOG.map((party) => ({
      id: party.id,
      name: party.name,
      seats: politics.seatsByPartyId[party.id] ?? 0,
      supportPercent: politics.supportPercentByPartyId[party.id] ?? 0,
      positionByIssue: { ...party.positionByIssue },
    })),
  };
}
