import { z } from "zod";

import {
  landUseSchema,
  roadFrontageSchema,
  urbanRoleSchema,
  type LandUse,
  type RoadFrontage,
  type UrbanRole,
} from "./urban";
import {
  blockIdSchema,
  developmentCodeIdSchema,
  commandIdSchema,
  buildingIdSchema,
  agentIdSchema,
  crewIdSchema,
  incidentIdSchema,
  constructionSiteIdSchema,
  districtIdSchema,
  eventIdSchema,
  facilityIdSchema,
  organizationIdSchema,
  parcelIdSchema,
  permitIdSchema,
  policyIdSchema,
  personIdSchema,
  playerIdentityIdSchema,
  structureIdSchema,
  tenantIdSchema,
  transactionIdSchema,
  loanIdSchema,
  type BlockId,
  type DevelopmentCodeId,
  type BuildingId,
  type AgentId,
  type CrewId,
  type IncidentId,
  type ConstructionSiteId,
  type CommandId,
  type DistrictId,
  type EventId,
  type FacilityId,
  type OrganizationId,
  type ParcelId,
  type PermitId,
  type PersonId,
  type PolicyId,
  type PlayerIdentityId,
  type StructureId,
  type TenantId,
  type TransactionId,
  type LoanId,
} from "./primitives";
import {
  gridCellSchema,
  seedSchema,
  tickSchema,
  type GridCell,
  type Seed,
  type Tick,
} from "./time-and-grid";
import { moneySchema, parseMoney, type Money } from "./money";

export type PlayerIdentity = {
  id: PlayerIdentityId;
  personId: PersonId;
};

export type Person = {
  id: PersonId;
};

export type Organization = {
  id: OrganizationId;
  kind: "company" | "bank" | "municipality" | "insurer";
};

export type OrganizationControlGrant = {
  personId: PersonId;
  organizationId: OrganizationId;
};

export type TestStructure = {
  id: StructureId;
  ownerOrganizationId: OrganizationId;
  /** A cell alone does not identify a place once the city has nine 64×64 maps (D-088). */
  districtId: DistrictId;
  cell: GridCell;
};

export const playerIdentitySchema = z.object({
  id: playerIdentityIdSchema,
  personId: personIdSchema,
});

export const personSchema = z.object({
  id: personIdSchema,
});

export const organizationSchema = z.object({
  id: organizationIdSchema,
  kind: z.enum(["company", "bank", "municipality", "insurer"]),
});

export const organizationControlGrantSchema = z.object({
  personId: personIdSchema,
  organizationId: organizationIdSchema,
});

export const testStructureSchema = z.object({
  id: structureIdSchema,
  ownerOrganizationId: organizationIdSchema,
  districtId: districtIdSchema,
  cell: gridCellSchema,
});

export type PlaceTestStructure = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
  type: "PlaceTestStructure";
  payload: {
    districtId: DistrictId;
    cell: GridCell;
  };
};

export const placeTestStructureSchema = z.object({
  commandId: commandIdSchema,
  issuedByPersonId: personIdSchema,
  actingAsOrganizationId: organizationIdSchema,
  type: z.literal("PlaceTestStructure"),
  payload: z.object({
    districtId: districtIdSchema,
    cell: gridCellSchema,
  }),
});

export type TestStructurePlaced = {
  eventId: EventId;
  tick: Tick;
  causationCommandId: CommandId;
  type: "TestStructurePlaced";
  payload: {
    structureId: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  };
};

export const testStructurePlacedSchema = z.object({
  eventId: eventIdSchema,
  tick: tickSchema,
  causationCommandId: commandIdSchema,
  type: z.literal("TestStructurePlaced"),
  payload: z.object({
    structureId: structureIdSchema,
    ownerOrganizationId: organizationIdSchema,
    cell: gridCellSchema,
  }),
});

export const resourceKindSchema = z.enum(["cement", "brick", "steel"]);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const buildingTypeSchema = z.enum([
  "courtyard_home",
  "workshop",
  "cement_plant",
  "brickworks",
  "steelworks",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "warehouse",
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
]);
export type BuildingType = z.infer<typeof buildingTypeSchema>;

export const zoningSchema = z.enum(["residential", "industrial", "mixed"]);
export type Zoning = z.infer<typeof zoningSchema>;

/**
 * Identidad persistente de un distrito generado. No contiene representación visual:
 * tiles, sprites o atlas se derivan en el renderer a partir de zoning y topología.
 */
export type DistrictGeneration = {
  profileId: string;
  generatorVersion: number;
  seed: Seed;
};

export type District = {
  id: DistrictId;
  name: string;
  width: 64;
  height: 64;
  /** Ausente en partidas guardadas anteriores a la generación procedural (WP4.1). */
  generation?: DistrictGeneration;
};

export const roadCellClassSchema = z.enum(["street", "avenue"]);
export type RoadCellClass = z.infer<typeof roadCellClassSchema>;

/** Segmento vial ortogonal, cerrado e identificado por su geometría canónica. */
export type RoadSegment = {
  id: string;
  from: GridCell;
  to: GridCell;
  class: RoadCellClass;
};

/**
 * Road topology of one district (D-085, D-090). The shape is unchanged; `derivationVersion: 2`
 * records that segments now come from `RoadAnchor[]` instead of from already placed parcels.
 */
export type RoadTopology = {
  topologyVersion: 1;
  derivationVersion: 2;
  segments: RoadSegment[];
};

export const roadSegmentSchema = z.object({
  id: z.string().min(1),
  from: gridCellSchema,
  to: gridCellSchema,
  class: roadCellClassSchema,
});

export const roadTopologySchema = z.object({
  topologyVersion: z.literal(1),
  derivationVersion: z.literal(2),
  segments: z.array(roadSegmentSchema),
});

function roadCellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

/** FNV-1a estable para identidades que no dependan del orden de descubrimiento. */
export function roadSegmentId(roadClass: RoadCellClass, from: GridCell, to: GridCell): string {
  let hash = 0x811c9dc5;
  const source = `${roadClass}|${from.x}:${from.y}|${to.x}:${to.y}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul((hash ^ source.charCodeAt(index)) >>> 0, 0x01000193) >>> 0;
  }
  return `road_${hash.toString(16).padStart(8, "0")}`;
}

/** La única derivación de celdas de carretera: segmentos inclusivos, en orden canónico. */
export function roadCellsFromSegments(segments: readonly RoadSegment[]): ReadonlySet<string> {
  const cells = new Set<string>();
  for (const segment of segments) {
    const dx = Math.sign(segment.to.x - segment.from.x);
    const dy = Math.sign(segment.to.y - segment.from.y);
    if (dx !== 0 && dy !== 0) throw new Error(`Road segment ${segment.id} is not orthogonal`);
    const length = Math.max(
      Math.abs(segment.to.x - segment.from.x),
      Math.abs(segment.to.y - segment.from.y),
    );
    for (let step = 0; step <= length; step += 1) {
      cells.add(roadCellKey({ x: segment.from.x + dx * step, y: segment.from.y + dy * step }));
    }
  }
  return cells;
}

/** Si dos trazados coinciden, avenue domina la semántica derivada de la celda. */
export function roadCellClassesFromSegments(
  segments: readonly RoadSegment[],
): ReadonlyMap<string, RoadCellClass> {
  const classes = new Map<string, RoadCellClass>();
  for (const segment of segments) {
    const dx = Math.sign(segment.to.x - segment.from.x);
    const dy = Math.sign(segment.to.y - segment.from.y);
    const length = Math.max(
      Math.abs(segment.to.x - segment.from.x),
      Math.abs(segment.to.y - segment.from.y),
    );
    for (let step = 0; step <= length; step += 1) {
      const key = roadCellKey({ x: segment.from.x + dx * step, y: segment.from.y + dy * step });
      if (segment.class === "avenue" || !classes.has(key)) classes.set(key, segment.class);
    }
  }
  return classes;
}

export const parcelDispositionSchema = z.enum(["marketable", "public", "infrastructure"]);
export type ParcelDisposition = z.infer<typeof parcelDispositionSchema>;

/**
 * A parcel is a connected subset of one block with at least one road frontage (D-090). The visible
 * identity stays single: picking any of its cells resolves the same `ParcelId`. `zoning` and
 * `buildingId` are still the v1 economic surfaces; V.d.2 replaces them with development codes and
 * derived building indexes.
 */
export type Parcel = {
  id: ParcelId;
  districtId: DistrictId;
  blockId: BlockId;
  cells: GridCell[];
  anchorCell: GridCell;
  roadFrontages: RoadFrontage[];
  disposition: ParcelDisposition;
  /** Authored land value; never overwritten, kept for audit (V.d.4). */
  baseLandValue: Money;
  /** Monthly market value used by purchases, collateral, taxes and balance (V.d.4). */
  marketValue: Money;
  /** Normative envelope inherited from its block (D-090). */
  developmentCodeId: DevelopmentCodeId;
  /** Uses already built on the parcel; empty for a vacant plot. */
  currentUses: LandUse[];
  ownerOrganizationId: OrganizationId | null;
  productionSuitability?: ProductionSuitability;
};

export type ResourceBundle = { cement: number; brick: number; steel: number };
export type ResourceInventory = ResourceBundle & { capacity: number };
export type ProductionSuitability = ResourceBundle;
export type ProductionFacilityKind = "legacy" | "physical";

export type ProductionFacility = {
  id: FacilityId;
  ownerOrganizationId: OrganizationId;
  operational: boolean;
  cycleProgress: number;
  cycleLength: number;
  output: ResourceKind;
  outputAmount: number;
  kind: ProductionFacilityKind;
  investmentCost: Money;
  operatingCost: Money;
  buildingId: BuildingId | null;
  suitabilityPercent: number;
  conditionPercent: number;
  upgradePercent: number;
  remainder: number;
};

export const buildingFormSchema = z.enum([
  "detached",
  "row",
  "perimeter",
  "shed",
  "civic_landmark",
  "pavilion",
]);
export type BuildingForm = z.infer<typeof buildingFormSchema>;

export type BuildingDefinition = {
  type: BuildingType;
  name: string;
  /**
   * Uses this building is compatible with — the successor of the old zoning-compatibility set.
   * Compatibility, not a cumulative requirement: a code allowing any one of them admits the
   * building. See `isBuildingAllowedByDevelopmentCode`, the only authoritative reading (D-090, H1-04).
   */
  allowedUses: LandUse[];
  cost: Money;
  workRequired: number;
  capacity: number;
  baseRent: Money;
  upgradeCost: Money;
  upgradeWorkRequired: number;
  resources: ResourceBundle;
  /** Physical envelope of the building; V.d.2 auto-places it inside the parcel. */
  form: BuildingForm;
  defaultFloors: number;
  /** Preferred footprint area in 4 m cells; the engine fits it inside the parcel. */
  targetFootprintCells: number;
  /**
   * V.d-7 · requisitos de solar. `requiredParcels` es cuántas parcelas contiguas necesita el
   * proyecto (≥ 1); `minCombinedAreaCells` el área mínima de la unión y `requireEdgeContiguous`
   * exige que la unión sea 4-conexa. No sustituye a `targetFootprintCells`: ése describe la
   * huella física, éste la parcela catastral que la sostiene.
   */
  siteRequirements: {
    requiredParcels: number;
    minCombinedAreaCells: number;
    requireEdgeContiguous: boolean;
  };
  /** Municipal buildings are generated by V.d.3, never offered to companies. */
  municipal: boolean;
  production?: {
    output: ResourceKind;
    cycleLength: number;
    outputAmount: number;
    operatingCost: Money;
  };
};

export type Building = {
  id: BuildingId;
  /** V.d-7 · parcelas catastrales que sostienen el edificio, en orden canónico. */
  parcelIds: ParcelId[];
  districtId: DistrictId;
  ownerOrganizationId: OrganizationId;
  productionFacilityId?: FacilityId | null;
  type: BuildingType;
  /** Authoritative footprint inside the parcel, outside setbacks and other footprints. */
  footprintCells: GridCell[];
  orientation: 0 | 90 | 180 | 270;
  floors: number;
  form: BuildingForm;
  level: number;
  condition: number;
  tenantId: TenantId | null;
  tenantIds: TenantId[];
  upgraded: boolean;
  structuralIntegrity: number;
  state: "operational" | "burning" | "collapse_pending" | "ruin";
  casualtiesTotal: { injured: number; dead: number };
};

export type AgentSpecialty =
  "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";

export type Agent = {
  id: AgentId;
  personId?: PersonId;
  organizationId?: OrganizationId;
  specialty?: AgentSpecialty;
  health?: number;
  state?: "idle" | "moving" | "working" | "injured" | "dead";
  /** District the agent is physically in. Pathfinding never crosses it; transfers are explicit (D-088). */
  districtId: DistrictId;
  cell: GridCell;
  target?: GridCell;
  path?: GridCell[];
  task?:
    | { kind: "work_order"; workOrderId: ConstructionSiteId }
    | { kind: "maintenance"; buildingId: BuildingId }
    | { kind: "attack_agent"; targetAgentId: AgentId }
    | { kind: "sabotage_building"; targetBuildingId: BuildingId }
    | null;
  /**
   * Traslado en curso entre distritos (D-088). Mientras exista, el agente no acepta tareas: el
   * viaje es una orden explícita del jugador, no un teletransporte. `route` guarda las paradas por
   * gateway para que el progreso sea determinista y auditable.
   */
  travel?: {
    fromDistrictId: DistrictId;
    toDistrictId: DistrictId;
    departAtTick: Tick;
    arriveAtTick: Tick;
    route: DistrictId[];
  } | null;
  cooldownUntilTick?: Tick;
  injuredUntilTick?: Tick | null;
  lastPathRecalculationTick?: Tick;
};
export type Crew = {
  id: CrewId;
  organizationId: OrganizationId;
  supervisorAgentId: AgentId;
  workerAgentIds: AgentId[];
};
export type IncidentRecord = {
  id: IncidentId;
  buildingId: BuildingId;
  origin: "sabotage" | "deterioration" | "blast";
  intensity: number;
  status: "active" | "resolved";
  targetOrganizationId: OrganizationId;
  createdAtTick: Tick;
  causedByAgentId: AgentId | null;
  causedByOrganizationId: OrganizationId | null;
  /**
   * Lo que sabe el mundo, no la verdad autoritativa: sólo el autor visto por alguien. Un sabotaje no
   * detectado deja `causedBy*` intactos para la auditoría del motor y este campo a null.
   */
  publiclyAttributedOrganizationId: OrganizationId | null;
  casualties: { injured: number; dead: number };
};

export type IncidentOrigin = IncidentRecord["origin"];

export type InsuranceCoverage = "fire_basic" | "fire_plus";
export type InsuranceContract = {
  buildingId: BuildingId;
  insurerOrganizationId: OrganizationId;
  coverage: InsuranceCoverage;
  premium: Money;
  coverageLimit: Money;
  deductible: Money;
  exclusions: IncidentOrigin[];
  status: "active" | "lapsed" | "cancelled";
  purchasedAtTick: Tick;
  lastPremiumTick: Tick;
  nextPremiumTick: Tick | null;
  totalPremiumPaid: Money;
};

export type InsuranceClaim = {
  incidentId: IncidentId;
  buildingId: BuildingId;
  coverage: InsuranceCoverage | null;
  status: "paid" | "excluded" | "unpaid";
  lossEstimate: Money;
  payout: Money;
  createdAtTick: Tick;
  processedAtTick: Tick;
};

export type InsuranceState = {
  contractsByBuildingId: Record<string, InsuranceContract>;
  claimsByIncidentId: Record<string, InsuranceClaim>;
};

export type ConstructionSite = {
  id: ConstructionSiteId;
  /** V.d-7 · parcelas del proyecto, en orden canónico. */
  parcelIds: ParcelId[];
  districtId: DistrictId;
  ownerOrganizationId: OrganizationId;
  buildingType: BuildingType;
  footprintCells: GridCell[];
  orientation: 0 | 90 | 180 | 270;
  floors: number;
  form: BuildingForm;
  progress: number;
  workRequired: number;
  resourcesReserved: ResourceBundle;
  crewCapacity: number;
  upgradeBuildingId: BuildingId | null;
  repairBuildingId: BuildingId | null;
  kind: "construction" | "upgrade" | "repair" | "clear_ruin";
  targetBuildingId: BuildingId | null;
  assignedCrewIds: CrewId[];
  assignedTechnicianId: AgentId | null;
};

export type TenantProfile = "household" | "maker" | "shopkeeper";
export type Tenant = {
  id: TenantId;
  profile: TenantProfile;
  budget: Money;
  preferredBuildingType: BuildingType;
  activeContractBuildingId: BuildingId | null;
  satisfaction: number;
  leaseRemaining: number;
  status: "available" | "contracted" | "displaced";
  /** Ocupantes del hogar. Se usa para las bajas de un siniestro; no consume plazas de capacidad. */
  size: number;
  /** Segmento de demanda que originó el hogar; los hogares autorados usan su propio perfil. */
  segmentId: string;
  /** Distrito donde busca vivienda; la vivienda nunca cambia de distrito en V.d.2. */
  marketDistrictId: DistrictId | null;
  /** Meses que el hogar lleva disponible sin firmar contrato. */
  searchMonths: number;
  /** Ingreso del hogar respecto a su segmento, en porcentaje; 100 es el ingreso de referencia. */
  incomeFactorPercent: number;
  /**
   * `authored` es un candidato que el jugador coloca a mano (el pool del slice); `market` lo generó
   * el mercado y se instala por su cuenta cuando encuentra una plaza asequible.
   */
  origin: "authored" | "market";
};

export type EconomicTransaction = {
  id: TransactionId;
  tick: Tick;
  organizationId: OrganizationId;
  cause: string;
  amount: Money;
  direction: "debit" | "credit";
  referenceId: string;
};

export type LoanStatus = "offered" | "active" | "delinquent" | "paid_off" | "defaulted";
export type Loan = {
  id: LoanId;
  borrowerOrganizationId: OrganizationId;
  lenderOrganizationId: OrganizationId;
  principal: Money;
  outstandingPrincipal: Money;
  annualInterestRateBps: number;
  termMonths: number;
  remainingMonths: number;
  collateralParcelId: ParcelId;
  status: LoanStatus;
  offeredAtTick: Tick;
  acceptedAtTick: Tick | null;
  nextPaymentTick: Tick | null;
  missedPayments: number;
};

export type AuctionStatus = "open" | "closed" | "executed";
export type Auction = {
  loanId: LoanId;
  collateralParcelId: ParcelId;
  sellerOrganizationId: OrganizationId;
  reservePrice: Money;
  highestBid: Money;
  highestBidderOrganizationId: OrganizationId | null;
  reservedFundsByOrganizationId: Record<string, Money>;
  status: AuctionStatus;
  openedAtTick: Tick;
  closesAtTick: Tick;
};
export type InsolvencyState = {
  auctionsByLoanId: Record<string, Auction>;
};

export type TaxationState = {
  propertyRateBps: number;
  transferRateBps: number;
  nextSettlementTick: Tick;
  lastSettlementTick: Tick | null;
  totalCollected: Money;
  exemptOrganizationIds: OrganizationId[];
  arrearsByOrganizationId: Record<string, Money>;
};

export type PublicContractKind = "public_works" | "supply";
export type PublicContractStatus = "open" | "awarded" | "completed" | "failed" | "defaulted";
export type PublicContractBid = {
  organizationId: OrganizationId;
  amount: Money;
  atTick: Tick;
};
export type PublicContract = {
  id: string;
  kind: PublicContractKind;
  title: string;
  budget: Money;
  /** Fianza que paga el adjudicatario; se pierde si incumple. */
  bond: Money;
  /** Edificios operativos mínimos que debe mantener el adjudicatario para ejecutar. */
  requiredBuildings: number;
  publishedAtTick: Tick;
  closesAtTick: Tick;
  executesAtTick: Tick;
  status: PublicContractStatus;
  awardedToOrganizationId: OrganizationId | null;
  awardedAmount: Money | null;
  bids: PublicContractBid[];
};

export type PublicContractsState = {
  lastPublishedTick: Tick | null;
  nextOrdinal: number;
  contracts: Record<string, PublicContract>;
  reliabilityByOrganizationId: Record<
    string,
    { awarded: number; completed: number; defaulted: number }
  >;
};

export type ReputationGroupId = "residents" | "municipality" | "banks";

export type ReputationFactKind =
  | "contract_completed"
  | "contract_defaulted"
  | "households_displaced"
  | "casualties"
  | "violent_sabotage"
  | "tax_arrears"
  | "maintenance_backlog"
  | "loan_defaulted"
  | "loan_paid_off";

/**
 * Entrada de memoria acotada: el hecho ocurrido, no la opinión. Los importes por grupo se fijan al
 * registrarse para que una partida guardada siga siendo legible aunque el balance se reajuste.
 */
export type ReputationFact = {
  id: string;
  kind: ReputationFactKind;
  atTick: Tick;
  /** Contrato, edificio o préstamo que lo originó; null en hechos agregados del cierre. */
  referenceId: string | null;
  magnitude: number;
  deltaByGroup: Record<string, number>;
};

export type ReputationState = {
  lastDecayTick: Tick | null;
  nextFactOrdinal: number;
  /** Percepción por organización y grupo, de −100 a 100. No existe un score único. */
  standingByOrganizationId: Record<string, Record<string, number>>;
  factsByOrganizationId: Record<string, ReputationFact[]>;
};

export type InformationScope = "public" | "own" | "inferred" | "private";

export type IntelKind = "balance" | "exposure" | "arrears" | "bid_intent";

export type IntelSource = "market" | "contacts";

/**
 * Estimación, no verdad: el valor observado se degrada con un error conocido y envejece desde el tick
 * en que se tomó. Lo que el jugador decide es si le basta o paga por una más reciente.
 */
export type IntelligenceEstimate = {
  id: string;
  subjectOrganizationId: OrganizationId;
  kind: IntelKind;
  source: IntelSource;
  value: number;
  accuracyPercent: number;
  atTick: Tick;
};

export type IntelligenceState = {
  /** Quién paga por saber: el expediente es propio, no del mundo. */
  observerOrganizationId: OrganizationId;
  /** Arroyo propio para no mover el PRNG económico: el ruido de estimación no cambia partidas. */
  prng: { algorithm: "xoshiro128ss-v1"; state: [number, number, number, number] };
  estimatesBySubjectOrganizationId: Record<string, IntelligenceEstimate[]>;
  nextEstimateOrdinal: number;
  commissionCooldownUntilTick: Tick;
  lastRefreshTick: Tick | null;
};

/**
 * Cómo una organización persigue sus objetivos. No es una alineación decorativa: cada perfil fija
 * cuánto valora cada familia de metas, cuánto capital deja sin invertir y a partir de qué riesgo protege.
 */
export type FactionProfileId = "conservative" | "expansionist";

/** Conjuntos de acciones que compiten por el mismo presupuesto; el perfil los pondera en bloque. */
export type FactionGoalFamily =
  "acquire" | "develop" | "produce" | "protect" | "finance" | "compete" | "political" | "dispose";

export type FactionEncounterKind = "sabotage" | "auction_outbid" | "tender_contested" | "territory";

/**
 * Lo que la IA recuerda de sus propios intentos: la acción y su desenlace, no una opinión del mundo.
 * La lista se recorta por tamaño y por ventana temporal, nunca crece con la partida.
 */
export type FactionMemoryEntry = {
  id: string;
  atTick: Tick;
  action: string;
  /** Identificador del objetivo (parcela, edificio,_loan_…) o `*` cuando la acción no apunta a uno. */
  target: string;
  accepted: boolean;
  rejectionCode: string | null;
};

export type FactionState = {
  profileByOrganizationId: Record<string, FactionProfileId>;
  /** Postura por par dirigido `actor>target`, de −100 a 100; sólo se guarda lo distinto de cero. */
  stanceByPairId: Record<string, number>;
  memoryByOrganizationId: Record<string, FactionMemoryEntry[]>;
  /** Cuántas veces el anti-bucle suprimió una acción: diagnóstico, nunca regla de negocio. */
  cycleCountByOrganizationId: Record<string, number>;
  nextMemoryOrdinal: number;
  lastDecayTick: Tick | null;
};

export type MunicipalBudgetState = {
  lastSettlementTick: Tick | null;
  /** Ingresos del mes en curso, por fuente; el cierre presupuestario los acumula y los reinicia. */
  revenueThisMonthBySource: Record<string, Money>;
  revenueTotalBySource: Record<string, Money>;
  spentTotalByCategory: Record<string, Money>;
  unfundedTotalByCategory: Record<string, Money>;
  serviceLevelPercentByCategory: Record<string, number>;
  deficitMonths: number;
  surplusMonths: number;
};

/**
 * Los cinco asuntos sobre los que el concejo recibe quejas. Son ficticios y funcionan como ejes
 * de medición: no corresponden a ninguna ideología ni partido real.
 */
export const POLITICAL_ISSUES = ["housing", "employment", "safety", "services", "taxes"] as const;
export type PoliticalIssue = (typeof POLITICAL_ISSUES)[number];

/** Plataforma de un partido municipal: datos, no condicionales codificados en el motor. */
export type MunicipalParty = {
  id: string;
  name: string;
  /** Saliencia 0..100 por asunto: cuánto pesa esa queja en su propio electorado. */
  positionByIssue: Record<PoliticalIssue, number>;
  /** Orden en el que el partido paga las categorías cuando gobierna la caja municipal. */
  budgetPriority: readonly string[];
  /** Ordenanza que el concejo intenta poner en vigor al tomar posesión. */
  preferredOrdinanceId: PolicyId;
  /** Escaños con los que el partido abre la legislatura, antes de la primera elección. */
  openingSeats: number;
};

export type MunicipalPoliticsState = {
  seatsByPartyId: Record<string, number>;
  /** Partido con más escaños: manda en el presupuesto y en la agenda de ordenanzas. */
  governingPartyId: string;
  /** Opinión por asunto, 0..100; 100 es "sin queja". Se recalcula al cierre de cada mes. */
  moodByIssue: Record<string, number>;
  /** Apoyo observado en la última elección, 0..100 por partido. */
  supportPercentByPartyId: Record<string, number>;
  lastTurnoutPercent: number;
  electionsHeld: number;
  lastElectionTick: Tick | null;
  nextElectionTick: Tick;
  lastMoodTick: Tick | null;
  /** Tick del próximo debate del concejo sobre su propia ordenanza; `null` si no hay pendiente. */
  nextDebateTick: Tick | null;
};

export type EmploymentState = {
  /** Nivel salarial de ciudad; 100 es el salario de referencia. */
  salaryIndexPercent: number;
  /** Puestos por distrito, recalculados en el cierre mensual. */
  postsByDistrictId: Record<string, number>;
  lastSettlementTick: Tick | null;
};

export type DistrictHousingMarket = {
  rentIndexPercentByBuildingType: Record<string, number>;
  /** Stock y demanda observados en el último cierre, por tipo. */
  unitsByBuildingType: Record<string, number>;
  demandByBuildingType: Record<string, number>;
  lastSettlementTick: Tick | null;
};

export type HousingMarketState = {
  /** Índice de ciudad por tipo de edificio; 100 es el precio base de `BUILDING_DEFINITIONS`. */
  rentIndexPercentByBuildingType: Record<string, number>;
  /** Mercado distrital; `askingRentFor` lo usa primero y cae a ciudad con muestra insuficiente. */
  byDistrictId: Record<string, DistrictHousingMarket>;
  lastSettlementTick: Tick | null;
  arrivalsTotal: number;
  departuresTotal: number;
  /** Último ordinal de id de hogar emitido por el mercado; nunca retrocede al vaciar el pool. */
  nextTenantOrdinal: number;
};

export type MaintenancePolicy = "balanced" | "deferred";
export type MaintenanceState = {
  policy: MaintenancePolicy;
  nextSettlementTick: Tick;
  lastSettlementTick: Tick | null;
  backlogByBuildingId: Record<string, Money>;
};

/**
 * Delegación del jugador: qué tareas rutinarias ejecuta un gestor con los mismos comandos y permisos
 * que la jugadora. Ningún modo puede saltarse una validación del dispatcher.
 */
export type AutomationPropertyMode = "manual" | "fill_vacancies";
export type AutomationFinanceMode = "manual" | "cover_shortfall";
export type AutomationState = {
  property: AutomationPropertyMode;
  finance: AutomationFinanceMode;
  /** Condición (0–100) a partir de la cual el gestor repara; `null` desactiva la reparación. */
  maintenanceRepairThreshold: number | null;
  /** Caja mínima que el gestor financiero intenta no perforar. */
  financeCashFloor: Money;
};

export type PolicyStatus =
  "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn";
export type Ordinance = {
  id: PolicyId;
  name: string;
  status: PolicyStatus;
  proposedAtTick: Tick | null;
  activeFromTick: Tick | null;
  expiresAtTick: Tick | null;
  materialCostModifierPercent: number;
  rentModifierPercent: number;
  influenceRequired: number;
  approvalChancePercent: number;
  propertyTaxModifierPercent: number;
  transferTaxModifierPercent: number;
  permitApprovalModifierPercent: number;
  /** V.d.4 density trial: extra floors and FAR only for the declared block role. */
  densityBonusFloors: number;
  densityBonusFarPercent: number;
  densityAppliesToRole: UrbanRole | null;
};

/**
 * `consumed` es terminal: un permiso es una decisión administrativa y sólo puede financiar una obra.
 * `expired` conserva el registro histórico, nunca se borra al consumir (V.d-H1).
 */
export type PermitStatus = "approved" | "denied" | "expired" | "consumed";
export type Permit = {
  /** Identidad propia (plan §3.2): el permiso es la decisión, no un estado colgado de la parcela. */
  id: PermitId;
  /** V.d-7 · conjunto exacto de parcelas para el que se decidió el permiso. */
  parcelIds: ParcelId[];
  buildingType: BuildingType;
  authorityOrganizationId: OrganizationId;
  requirements: string[];
  /** Normative snapshot at the moment of the decision (D-090). */
  developmentCodeIdAtDecision: DevelopmentCodeId;
  allowedUsesAtDecision: LandUse[];
  currentUsesAtDecision: LandUse[];
  /** Acquired density rights: construction keeps them after the ordinance expires (V.d.4). */
  densityBonusFloors: number;
  densityBonusFarPercent: number;
  status: PermitStatus;
  requestedAtTick: Tick;
  decidedAtTick: Tick;
  expiresAtTick: Tick | null;
  /** Tick en el que una obra aceptada gastó el permiso; `null` mientras sigue vigente. */
  consumedAtTick: Tick | null;
};
export type PermittingState = {
  validityTicks: number;
  approvalChanceByRole: Record<UrbanRole, number>;
  /**
   * Colección por identidad. La vigencia por parcela y tipo se deriva canónicamente
   * (`activePermitFor`), así que no existe un índice duplicado que pueda desincronizarse.
   */
  permitsById: Record<string, Permit>;
};

export type CrimeState = {
  heatByOrganizationId: Record<string, number>;
  policePressure: number;
  lastOutcome: "none" | "profitable" | "detected";
  nextAvailableTickByOrganizationId: Record<string, number>;
};

/**
 * Tipos de macroeventos económicos. Cada uno afecta a sistemas específicos mediante modifiers.
 * Los macroeventos son O(1): no barren entidades, solo aplican modifiers globales al distrito.
 */
export type MacroEventType =
  | "material_scarcity" // Aumenta costes de materiales
  | "economic_recession" // Reduce rentas, aumenta vacancia
  | "population_migration" // Aumenta demanda de vivienda
  | "construction_boom" // Reduce costes de construcción
  | "housing_crisis" // Aumenta rentas, reduce vacancia
  | "labor_shortage"; // Aumenta costes laborales

/**
 * Modifier global que afecta a un sistema específico. Los valores son porcentajes (ej: 10 = +10%, -5 = -5%).
 */
export type MacroEventModifiers = {
  materialCostModifierPercent?: number;
  rentModifierPercent?: number;
  vacancyModifierPercent?: number;
  constructionCostModifierPercent?: number;
  laborCostModifierPercent?: number;
  demandModifierPercent?: number;
};

/**
 * Macroevento económico activo en el distrito. Determinista, con duración fija y modifiers globales.
 * No barre entidades: los sistemas leen los modifiers activos y los aplican O(1).
 */
export type MacroEvent = {
  id: string;
  type: MacroEventType;
  startTick: Tick;
  endTick: Tick;
  intensity: number; // 0-1, magnitud del efecto
  modifiers: MacroEventModifiers;
};

/**
 * Estado de macroeventos en el distrito. El PRNG propio decide cuándo y qué shock entra, sin
 * desplazar el arroyo económico (mismo patrón que el expediente de inteligencia de D-072).
 */
export type MacroEventsState = {
  events: MacroEvent[];
  nextEventOrdinal: number;
  prng: { algorithm: "xoshiro128ss-v1"; state: [number, number, number, number] };
  /** Próximo cierre mensual en el que se sortea si entra un shock; 0 = sin sorteo pendiente. */
  nextCheckTick: Tick;
};

export const macroEventTypeSchema = z.enum([
  "material_scarcity",
  "economic_recession",
  "population_migration",
  "construction_boom",
  "housing_crisis",
  "labor_shortage",
]);

export const macroEventModifiersSchema = z.object({
  materialCostModifierPercent: z.number().optional(),
  rentModifierPercent: z.number().optional(),
  vacancyModifierPercent: z.number().optional(),
  constructionCostModifierPercent: z.number().optional(),
  laborCostModifierPercent: z.number().optional(),
  demandModifierPercent: z.number().optional(),
});

export const macroEventSchema = z.object({
  id: z.string().min(1).max(64),
  type: macroEventTypeSchema,
  startTick: tickSchema,
  endTick: tickSchema,
  intensity: z.number().min(0).max(1),
  modifiers: macroEventModifiersSchema,
});

export const macroEventsStateSchema = z.object({
  events: z.array(macroEventSchema),
  nextEventOrdinal: z.number().int().nonnegative(),
  /** Opcionales para cargar partidas anteriores a WP4.12-R; el restaurador deriva ambos de la seed. */
  prng: z
    .object({
      algorithm: z.literal("xoshiro128ss-v1"),
      state: z.tuple([
        z.number().int().min(0).max(0xffffffff),
        z.number().int().min(0).max(0xffffffff),
        z.number().int().min(0).max(0xffffffff),
        z.number().int().min(0).max(0xffffffff),
      ]),
    })
    .optional(),
  nextCheckTick: tickSchema.optional(),
});

export const districtGenerationSchema = z.object({
  profileId: z.string().min(1).max(64),
  generatorVersion: z.number().int().nonnegative(),
  seed: seedSchema,
});
export const districtSchema = z.object({
  id: districtIdSchema,
  name: z.string().min(1).max(80),
  width: z.literal(64),
  height: z.literal(64),
  generation: districtGenerationSchema.optional(),
});
export const parcelSchema = z.object({
  id: parcelIdSchema,
  districtId: districtIdSchema,
  blockId: blockIdSchema,
  cells: z.array(gridCellSchema).min(1),
  anchorCell: gridCellSchema,
  roadFrontages: z.array(roadFrontageSchema),
  disposition: parcelDispositionSchema,
  baseLandValue: moneySchema,
  marketValue: moneySchema,
  developmentCodeId: developmentCodeIdSchema,
  currentUses: z.array(landUseSchema),
  ownerOrganizationId: organizationIdSchema.nullable(),
  productionSuitability: z
    .object({
      cement: z.number().int().positive(),
      brick: z.number().int().positive(),
      steel: z.number().int().positive(),
    })
    .default({ cement: 100, brick: 100, steel: 100 }),
});
export const resourceBundleSchema = z.object({
  cement: z.number().int().nonnegative(),
  brick: z.number().int().nonnegative(),
  steel: z.number().int().nonnegative(),
});
export const resourceInventorySchema = resourceBundleSchema.extend({
  capacity: z.number().int().positive(),
});
export const productionFacilitySchema = z.object({
  id: facilityIdSchema,
  ownerOrganizationId: organizationIdSchema,
  operational: z.boolean(),
  cycleProgress: z.number().int().nonnegative(),
  cycleLength: z.number().int().positive(),
  output: resourceKindSchema,
  outputAmount: z.number().int().positive(),
  kind: z.enum(["legacy", "physical"]).optional(),
  investmentCost: moneySchema.default(parseMoney(0)),
  operatingCost: moneySchema.default(parseMoney(0)),
  buildingId: buildingIdSchema.nullable().default(null),
  suitabilityPercent: z.number().int().positive().default(100),
  conditionPercent: z.number().int().min(0).max(100).default(100),
  upgradePercent: z.number().int().positive().default(100),
  remainder: z.number().int().min(0).max(999_999).default(0),
});
export const buildingSchema = z.object({
  id: buildingIdSchema,
  /** V.d-7 · parcelas catastrales que sostienen el edificio, en orden canónico. */
  parcelIds: z.array(parcelIdSchema).min(1),
  districtId: districtIdSchema,
  ownerOrganizationId: organizationIdSchema,
  productionFacilityId: facilityIdSchema.nullable().default(null),
  type: buildingTypeSchema,
  footprintCells: z.array(gridCellSchema).min(1),
  orientation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  floors: z.number().int().min(1).max(64),
  form: buildingFormSchema,
  level: z.number().int().positive(),
  condition: z.number().int().min(0).max(100),
  tenantId: tenantIdSchema.nullable(),
  tenantIds: z.array(tenantIdSchema).default([]),
  upgraded: z.boolean(),
  structuralIntegrity: z.number().int().min(0).max(100).default(100),
  state: z.enum(["operational", "burning", "collapse_pending", "ruin"]).default("operational"),
  casualtiesTotal: z
    .object({ injured: z.number().int().nonnegative(), dead: z.number().int().nonnegative() })
    .default({ injured: 0, dead: 0 }),
});
export const constructionSiteSchema = z.object({
  id: constructionSiteIdSchema,
  parcelIds: z.array(parcelIdSchema).min(1),
  districtId: districtIdSchema,
  ownerOrganizationId: organizationIdSchema,
  buildingType: buildingTypeSchema,
  footprintCells: z.array(gridCellSchema).min(1),
  orientation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  floors: z.number().int().min(1).max(64),
  form: buildingFormSchema,
  progress: z.number().int().nonnegative(),
  workRequired: z.number().int().positive(),
  resourcesReserved: resourceBundleSchema,
  crewCapacity: z.number().int().nonnegative(),
  upgradeBuildingId: buildingIdSchema.nullable(),
  repairBuildingId: buildingIdSchema.nullable().default(null),
  kind: z.enum(["construction", "upgrade", "repair", "clear_ruin"]).default("construction"),
  targetBuildingId: buildingIdSchema.nullable().default(null),
  assignedCrewIds: z.array(crewIdSchema).default([]),
  assignedTechnicianId: agentIdSchema.nullable().default(null),
});
export const agentTaskSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("work_order"), workOrderId: constructionSiteIdSchema }),
  z.object({ kind: z.literal("maintenance"), buildingId: buildingIdSchema }),
  z.object({ kind: z.literal("attack_agent"), targetAgentId: agentIdSchema }),
  z.object({ kind: z.literal("sabotage_building"), targetBuildingId: buildingIdSchema }),
]);
export const agentSchema = z.object({
  id: agentIdSchema,
  personId: personIdSchema.optional(),
  organizationId: organizationIdSchema.optional(),
  specialty: z
    .enum(["supervisor", "construction_worker", "maintenance_technician", "enforcer"])
    .optional(),
  health: z.number().int().min(0).max(100).optional(),
  state: z.enum(["idle", "moving", "working", "injured", "dead"]).optional(),
  cell: gridCellSchema,
  target: gridCellSchema.optional(),
  path: z.array(gridCellSchema).optional(),
  task: agentTaskSchema.nullable().optional(),
  cooldownUntilTick: tickSchema.optional(),
  injuredUntilTick: tickSchema.nullable().optional(),
  lastPathRecalculationTick: tickSchema.optional(),
});
export const crewSchema = z.object({
  id: crewIdSchema,
  organizationId: organizationIdSchema,
  supervisorAgentId: agentIdSchema,
  workerAgentIds: z.array(agentIdSchema),
});
export const incidentSchema = z.object({
  id: incidentIdSchema,
  buildingId: buildingIdSchema,
  origin: z.enum(["sabotage", "deterioration", "blast"]),
  intensity: z.number().int().min(0).max(100),
  status: z.enum(["active", "resolved"]),
  targetOrganizationId: organizationIdSchema,
  createdAtTick: tickSchema,
  causedByAgentId: agentIdSchema.nullable(),
  causedByOrganizationId: organizationIdSchema.nullable(),
  publiclyAttributedOrganizationId: organizationIdSchema.nullable().default(null),
  casualties: z.object({
    injured: z.number().int().nonnegative(),
    dead: z.number().int().nonnegative(),
  }),
});
export const insuranceContractSchema = z.object({
  buildingId: buildingIdSchema,
  insurerOrganizationId: organizationIdSchema,
  coverage: z.enum(["fire_basic", "fire_plus"]),
  premium: moneySchema,
  coverageLimit: moneySchema,
  deductible: moneySchema,
  exclusions: z.array(z.enum(["sabotage", "deterioration", "blast"])),
  status: z.enum(["active", "lapsed", "cancelled"]),
  purchasedAtTick: tickSchema,
  lastPremiumTick: tickSchema,
  nextPremiumTick: tickSchema.nullable(),
  totalPremiumPaid: moneySchema,
});
export const insuranceClaimSchema = z.object({
  incidentId: incidentIdSchema,
  buildingId: buildingIdSchema,
  coverage: z.enum(["fire_basic", "fire_plus"]).nullable(),
  status: z.enum(["paid", "excluded", "unpaid"]),
  lossEstimate: moneySchema,
  payout: moneySchema,
  createdAtTick: tickSchema,
  processedAtTick: tickSchema,
});
export const insuranceStateSchema = z.object({
  contractsByBuildingId: z.record(z.string(), insuranceContractSchema),
  claimsByIncidentId: z.record(z.string(), insuranceClaimSchema),
});
export const tenantSchema = z.object({
  id: tenantIdSchema,
  profile: z.enum(["household", "maker", "shopkeeper"]),
  budget: moneySchema,
  preferredBuildingType: buildingTypeSchema,
  activeContractBuildingId: buildingIdSchema.nullable(),
  satisfaction: z.number().int().min(0).max(100),
  leaseRemaining: z.number().int().nonnegative(),
  status: z.enum(["available", "contracted", "displaced"]).optional(),
  size: z.number().int().positive().optional(),
  segmentId: z.string().min(1).max(64).optional(),
  marketDistrictId: districtIdSchema.nullable().default(null),
  searchMonths: z.number().int().nonnegative().optional(),
  incomeFactorPercent: z.number().int().positive().optional(),
  origin: z.enum(["authored", "market"]).optional(),
});
export const economicTransactionSchema = z.object({
  id: transactionIdSchema,
  tick: tickSchema,
  organizationId: organizationIdSchema,
  cause: z.string().min(1).max(120),
  amount: moneySchema,
  direction: z.enum(["debit", "credit"]),
  referenceId: z.string().min(1).max(128),
});
export const loanSchema = z.object({
  id: loanIdSchema,
  borrowerOrganizationId: organizationIdSchema,
  lenderOrganizationId: organizationIdSchema,
  principal: moneySchema,
  outstandingPrincipal: moneySchema,
  annualInterestRateBps: z.number().int().positive(),
  termMonths: z.number().int().positive(),
  remainingMonths: z.number().int().nonnegative(),
  collateralParcelId: parcelIdSchema,
  status: z.enum(["offered", "active", "delinquent", "paid_off", "defaulted"]),
  offeredAtTick: tickSchema,
  acceptedAtTick: tickSchema.nullable(),
  nextPaymentTick: tickSchema.nullable(),
  missedPayments: z.number().int().nonnegative(),
});
export const auctionSchema = z.object({
  loanId: loanIdSchema,
  collateralParcelId: parcelIdSchema,
  sellerOrganizationId: organizationIdSchema,
  reservePrice: moneySchema,
  highestBid: moneySchema,
  highestBidderOrganizationId: organizationIdSchema.nullable(),
  reservedFundsByOrganizationId: z.record(z.string(), moneySchema),
  status: z.enum(["open", "closed", "executed"]),
  openedAtTick: tickSchema,
  closesAtTick: tickSchema,
});
export const insolvencyStateSchema = z.object({
  auctionsByLoanId: z.record(z.string(), auctionSchema),
});
export const taxationStateSchema = z.object({
  propertyRateBps: z.number().int().nonnegative(),
  transferRateBps: z.number().int().nonnegative(),
  nextSettlementTick: tickSchema,
  lastSettlementTick: tickSchema.nullable(),
  totalCollected: moneySchema,
  exemptOrganizationIds: z.array(organizationIdSchema),
  arrearsByOrganizationId: z.record(z.string(), moneySchema),
});
export const publicContractSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["public_works", "supply"]),
  title: z.string().min(1).max(120),
  budget: moneySchema,
  bond: moneySchema,
  requiredBuildings: z.number().int().nonnegative(),
  publishedAtTick: tickSchema,
  closesAtTick: tickSchema,
  executesAtTick: tickSchema,
  status: z.enum(["open", "awarded", "completed", "failed", "defaulted"]),
  awardedToOrganizationId: organizationIdSchema.nullable(),
  awardedAmount: moneySchema.nullable(),
  bids: z.array(
    z.object({
      organizationId: organizationIdSchema,
      amount: moneySchema,
      atTick: tickSchema,
    }),
  ),
});
export const publicContractsStateSchema = z.object({
  lastPublishedTick: tickSchema.nullable(),
  nextOrdinal: z.number().int().positive(),
  contracts: z.record(z.string(), publicContractSchema),
  reliabilityByOrganizationId: z.record(
    z.string(),
    z.object({
      awarded: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      defaulted: z.number().int().nonnegative(),
    }),
  ),
});
export const reputationFactSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "contract_completed",
    "contract_defaulted",
    "households_displaced",
    "casualties",
    "violent_sabotage",
    "tax_arrears",
    "maintenance_backlog",
    "loan_defaulted",
    "loan_paid_off",
  ]),
  atTick: tickSchema,
  referenceId: z.string().nullable(),
  magnitude: z.number().int().positive(),
  deltaByGroup: z.record(z.string(), z.number().int()),
});
export const reputationStateSchema = z.object({
  lastDecayTick: tickSchema.nullable(),
  nextFactOrdinal: z.number().int().positive(),
  standingByOrganizationId: z.record(
    z.string(),
    z.record(z.string(), z.number().int().min(-100).max(100)),
  ),
  factsByOrganizationId: z.record(z.string(), z.array(reputationFactSchema)),
});
export const intelligenceEstimateSchema = z.object({
  id: z.string().min(1),
  subjectOrganizationId: organizationIdSchema,
  kind: z.enum(["balance", "exposure", "arrears", "bid_intent"]),
  source: z.enum(["market", "contacts"]),
  value: z.number().int(),
  accuracyPercent: z.number().int().min(1).max(100),
  atTick: tickSchema,
});
export const intelligenceStateSchema = z.object({
  observerOrganizationId: organizationIdSchema,
  prng: z.object({
    algorithm: z.literal("xoshiro128ss-v1"),
    state: z.tuple([
      z.number().int().min(0).max(0xffffffff),
      z.number().int().min(0).max(0xffffffff),
      z.number().int().min(0).max(0xffffffff),
      z.number().int().min(0).max(0xffffffff),
    ]),
  }),
  estimatesBySubjectOrganizationId: z.record(z.string(), z.array(intelligenceEstimateSchema)),
  nextEstimateOrdinal: z.number().int().positive(),
  commissionCooldownUntilTick: tickSchema,
  lastRefreshTick: tickSchema.nullable(),
});
export const factionMemoryEntrySchema = z.object({
  id: z.string().min(1),
  atTick: tickSchema,
  action: z.string().min(1),
  target: z.string().min(1),
  accepted: z.boolean(),
  rejectionCode: z.string().nullable(),
});
export const factionStateSchema = z.object({
  profileByOrganizationId: z.record(z.string(), z.enum(["conservative", "expansionist"])),
  stanceByPairId: z.record(z.string(), z.number().int().min(-100).max(100)),
  memoryByOrganizationId: z.record(z.string(), z.array(factionMemoryEntrySchema)),
  cycleCountByOrganizationId: z.record(z.string(), z.number().int().nonnegative()),
  nextMemoryOrdinal: z.number().int().positive(),
  lastDecayTick: tickSchema.nullable(),
});
export const municipalPoliticsStateSchema = z.object({
  seatsByPartyId: z.record(z.string(), z.number().int().nonnegative()),
  governingPartyId: z.string().min(1).max(64),
  moodByIssue: z.record(
    z.enum(["housing", "employment", "safety", "services", "taxes"]),
    z.number().int().min(0).max(100),
  ),
  supportPercentByPartyId: z.record(z.string(), z.number().int().min(0).max(100)),
  lastTurnoutPercent: z.number().int().min(0).max(100),
  electionsHeld: z.number().int().nonnegative(),
  lastElectionTick: tickSchema.nullable(),
  nextElectionTick: tickSchema,
  lastMoodTick: tickSchema.nullable(),
  nextDebateTick: tickSchema.nullable(),
});
export const municipalBudgetStateSchema = z.object({
  lastSettlementTick: tickSchema.nullable(),
  revenueThisMonthBySource: z.record(z.string(), moneySchema),
  revenueTotalBySource: z.record(z.string(), moneySchema),
  spentTotalByCategory: z.record(z.string(), moneySchema),
  unfundedTotalByCategory: z.record(z.string(), moneySchema),
  serviceLevelPercentByCategory: z.record(z.string(), z.number().int().min(0).max(100)),
  deficitMonths: z.number().int().nonnegative(),
  surplusMonths: z.number().int().nonnegative(),
});
export const employmentStateSchema = z.object({
  salaryIndexPercent: z.number().int().min(50).max(200),
  postsByDistrictId: z.record(z.string(), z.number().int().nonnegative()).default({}),
  lastSettlementTick: tickSchema.nullable(),
});
const districtHousingMarketSchema = z.object({
  rentIndexPercentByBuildingType: z.record(z.string(), z.number().int().min(50).max(150)),
  unitsByBuildingType: z.record(z.string(), z.number().int().nonnegative()).default({}),
  demandByBuildingType: z.record(z.string(), z.number().int().nonnegative()).default({}),
  lastSettlementTick: tickSchema.nullable(),
});
export const housingMarketStateSchema = z.object({
  rentIndexPercentByBuildingType: z.record(z.string(), z.number().int().min(50).max(150)),
  byDistrictId: z.record(z.string(), districtHousingMarketSchema).default({}),
  lastSettlementTick: tickSchema.nullable(),
  arrivalsTotal: z.number().int().nonnegative(),
  departuresTotal: z.number().int().nonnegative(),
  nextTenantOrdinal: z.number().int().positive(),
});
export const maintenanceStateSchema = z.object({
  policy: z.enum(["balanced", "deferred"]),
  nextSettlementTick: tickSchema,
  lastSettlementTick: tickSchema.nullable(),
  backlogByBuildingId: z.record(z.string(), moneySchema),
});
export const automationStateSchema = z.object({
  property: z.enum(["manual", "fill_vacancies"]),
  finance: z.enum(["manual", "cover_shortfall"]),
  maintenanceRepairThreshold: z.number().int().min(0).max(100).nullable(),
  financeCashFloor: moneySchema,
});
export const ordinanceSchema = z.object({
  id: policyIdSchema,
  name: z.string().min(1).max(120),
  status: z.enum(["proposed", "approved", "active", "expired", "rejected", "withdrawn"]),
  proposedAtTick: tickSchema.nullable(),
  activeFromTick: tickSchema.nullable(),
  expiresAtTick: tickSchema.nullable(),
  materialCostModifierPercent: z.number().int(),
  rentModifierPercent: z.number().int(),
  influenceRequired: z.number().int().nonnegative(),
  approvalChancePercent: z.number().int().min(0).max(100).default(65),
  propertyTaxModifierPercent: z.number().int().default(0),
  transferTaxModifierPercent: z.number().int().default(0),
  permitApprovalModifierPercent: z.number().int().default(0),
  densityBonusFloors: z.number().int().min(0).default(0),
  densityBonusFarPercent: z.number().int().min(0).default(0),
  densityAppliesToRole: urbanRoleSchema.nullable().default(null),
});
export const permitSchema = z.object({
  id: permitIdSchema,
  /** V.d-7 · el permiso se emite para un CONJUNTO exacto de parcelas. */
  parcelIds: z.array(parcelIdSchema).min(1),
  buildingType: buildingTypeSchema,
  authorityOrganizationId: organizationIdSchema,
  requirements: z.array(z.string().min(1).max(80)),
  developmentCodeIdAtDecision: developmentCodeIdSchema,
  allowedUsesAtDecision: z.array(landUseSchema),
  currentUsesAtDecision: z.array(landUseSchema),
  densityBonusFloors: z.number().int().min(0).default(0),
  densityBonusFarPercent: z.number().int().min(0).default(0),
  status: z.enum(["approved", "denied", "expired", "consumed"]),
  requestedAtTick: tickSchema,
  decidedAtTick: tickSchema,
  expiresAtTick: tickSchema.nullable(),
  consumedAtTick: tickSchema.nullable().default(null),
});
export const permittingStateSchema = z.object({
  validityTicks: z.number().int().positive(),
  approvalChanceByRole: z.record(z.string(), z.number().int().min(0).max(100)),
  permitsById: z.record(z.string(), permitSchema),
});
export const crimeStateSchema = z.object({
  heatByOrganizationId: z.record(z.string(), z.number().int().nonnegative()),
  policePressure: z.number().int().nonnegative(),
  lastOutcome: z.enum(["none", "profitable", "detected"]),
  nextAvailableTickByOrganizationId: z
    .record(z.string(), z.number().int().nonnegative())
    .default({}),
});

type DomainCommandBase = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
};
export type BuyParcel = DomainCommandBase & { type: "BuyParcel"; payload: { parcelId: ParcelId } };
export type SellParcel = DomainCommandBase & {
  type: "SellParcel";
  payload: { parcelId: ParcelId };
};
export type StartConstruction = DomainCommandBase & {
  type: "StartConstruction";
  /** V.d-7 · conjunto canónico de parcelas del proyecto; el engine lo valida entero. */
  payload: { parcelIds: ParcelId[]; buildingType: BuildingType };
};
export type CancelConstruction = DomainCommandBase & {
  type: "CancelConstruction";
  payload: { constructionSiteId: ConstructionSiteId };
};
export type AssignTenant = DomainCommandBase & {
  type: "AssignTenant";
  payload: { buildingId: BuildingId; tenantId: TenantId };
};
export type UpgradeBuilding = DomainCommandBase & {
  type: "UpgradeBuilding";
  payload: { buildingId: BuildingId };
};
export type LobbyPolicy = DomainCommandBase & {
  type: "LobbyPolicy";
  payload: { policyId: PolicyId; influenceSpend: number };
};
export type ProposePolicy = DomainCommandBase & {
  type: "ProposePolicy";
  payload: { policyId: PolicyId };
};
export type WithdrawPolicy = DomainCommandBase & {
  type: "WithdrawPolicy";
  payload: { policyId: PolicyId };
};
export type CommitCrime = DomainCommandBase & {
  type: "CommitCrime";
  payload: { targetOrganizationId: OrganizationId };
};
export type BuyMaterials = DomainCommandBase & {
  type: "BuyMaterials";
  payload: { resource: ResourceKind; amount: number };
};
export type InvestInProduction = DomainCommandBase & {
  type: "InvestInProduction";
  payload: { resource: ResourceKind };
};
export type AllocateCrew = DomainCommandBase & {
  type: "AllocateCrew";
  payload: { constructionSiteId: ConstructionSiteId; crewCapacity: 1 | 2 };
};
export type RepairBuilding = DomainCommandBase & {
  type: "RepairBuilding";
  payload: { buildingId: BuildingId };
};
export type AssignCrewToWorkOrder = DomainCommandBase & {
  type: "AssignCrewToWorkOrder";
  payload: { crewId: CrewId; workOrderId: ConstructionSiteId };
};
export type AssignMaintenance = DomainCommandBase & {
  type: "AssignMaintenance";
  payload: { buildingId: BuildingId };
};
export type OrderEnforcerAction = DomainCommandBase & {
  type: "OrderEnforcerAction";
  payload: {
    enforcerAgentId: AgentId;
    action: "attack_agent" | "sabotage_building";
    targetAgentId?: AgentId;
    targetBuildingId?: BuildingId;
  };
};
export type ClearRuin = DomainCommandBase & {
  type: "ClearRuin";
  payload: { buildingId: BuildingId };
};
export type RequestLoan = DomainCommandBase & {
  type: "RequestLoan";
  payload: { amount: Money; termMonths: number; collateralParcelId: ParcelId };
};
export type AcceptLoanOffer = DomainCommandBase & {
  type: "AcceptLoanOffer";
  payload: { loanId: LoanId };
};
export type RequestRefinancing = DomainCommandBase & {
  type: "RequestRefinancing";
  payload: { loanId: LoanId; termMonths: number };
};
export type PlaceAuctionBid = DomainCommandBase & {
  type: "PlaceAuctionBid";
  payload: { loanId: LoanId; amount: Money };
};
export type WithdrawAuctionBid = DomainCommandBase & {
  type: "WithdrawAuctionBid";
  payload: { loanId: LoanId };
};
export type SetMaintenancePolicy = DomainCommandBase & {
  type: "SetMaintenancePolicy";
  payload: { policy: MaintenancePolicy };
};
export type SetAutomationPolicy = DomainCommandBase & {
  type: "SetAutomationPolicy";
  payload: {
    property?: AutomationPropertyMode;
    finance?: AutomationFinanceMode;
    maintenanceRepairThreshold?: number | null;
    financeCashFloor?: Money;
  };
};
export type RequestPermit = DomainCommandBase & {
  type: "RequestPermit";
  /** V.d-7 · el permiso se pide para el conjunto exacto del proyecto. */
  payload: { parcelIds: ParcelId[]; buildingType: BuildingType };
};
export type SubmitPublicBid = DomainCommandBase & {
  type: "SubmitPublicBid";
  payload: { contractId: string; amount: Money };
};
export type CommissionIntelligence = DomainCommandBase & {
  type: "CommissionIntelligence";
  payload: { subjectOrganizationId: OrganizationId; kind: IntelKind };
};
export type BuyInsurance = DomainCommandBase & {
  type: "BuyInsurance";
  payload: { buildingId: BuildingId; coverage: InsuranceCoverage };
};
export type CancelInsurance = DomainCommandBase & {
  type: "CancelInsurance";
  payload: { buildingId: BuildingId };
};
export type ProductCommand =
  | PlaceTestStructure
  | BuyParcel
  | SellParcel
  | StartConstruction
  | CancelConstruction
  | AssignTenant
  | UpgradeBuilding
  | LobbyPolicy
  | ProposePolicy
  | WithdrawPolicy
  | CommitCrime
  | BuyMaterials
  | InvestInProduction
  | AllocateCrew
  | RepairBuilding
  | AssignCrewToWorkOrder
  | AssignMaintenance
  | OrderEnforcerAction
  | ClearRuin
  | RequestLoan
  | AcceptLoanOffer
  | RequestRefinancing
  | PlaceAuctionBid
  | WithdrawAuctionBid
  | SetMaintenancePolicy
  | SetAutomationPolicy
  | RequestPermit
  | BuyInsurance
  | CancelInsurance
  | SubmitPublicBid
  | CommissionIntelligence
  | TransferCrew
  | TransferAgent;

function commandSchema<TType extends string>(type: TType, payload: z.ZodType) {
  return z.object({
    commandId: commandIdSchema,
    issuedByPersonId: personIdSchema,
    actingAsOrganizationId: organizationIdSchema,
    type: z.literal(type),
    payload,
  });
}
export const buyParcelSchema = commandSchema("BuyParcel", z.object({ parcelId: parcelIdSchema }));
export const sellParcelSchema = commandSchema("SellParcel", z.object({ parcelId: parcelIdSchema }));
export const startConstructionSchema = commandSchema(
  "StartConstruction",
  z.object({ parcelId: parcelIdSchema, buildingType: buildingTypeSchema }),
);
export const cancelConstructionSchema = commandSchema(
  "CancelConstruction",
  z.object({ constructionSiteId: constructionSiteIdSchema }),
);
export const assignTenantSchema = commandSchema(
  "AssignTenant",
  z.object({ buildingId: buildingIdSchema, tenantId: tenantIdSchema }),
);
export const upgradeBuildingSchema = commandSchema(
  "UpgradeBuilding",
  z.object({ buildingId: buildingIdSchema }),
);
export const lobbyPolicySchema = commandSchema(
  "LobbyPolicy",
  z.object({ policyId: policyIdSchema, influenceSpend: z.number().int().min(1).max(3) }),
);
export const proposePolicySchema = commandSchema(
  "ProposePolicy",
  z.object({ policyId: policyIdSchema }),
);
export const withdrawPolicySchema = commandSchema(
  "WithdrawPolicy",
  z.object({ policyId: policyIdSchema }),
);
export const commitCrimeSchema = commandSchema(
  "CommitCrime",
  z.object({ targetOrganizationId: organizationIdSchema }),
);
export const buyMaterialsSchema = commandSchema(
  "BuyMaterials",
  z.object({ resource: resourceKindSchema, amount: z.number().int().positive().max(40) }),
);
export const investInProductionSchema = commandSchema(
  "InvestInProduction",
  z.object({ resource: resourceKindSchema }),
);
export const allocateCrewSchema = commandSchema(
  "AllocateCrew",
  z.object({
    constructionSiteId: constructionSiteIdSchema,
    crewCapacity: z.union([z.literal(1), z.literal(2)]),
  }),
);
export const repairBuildingSchema = commandSchema(
  "RepairBuilding",
  z.object({ buildingId: buildingIdSchema }),
);
export const assignCrewToWorkOrderSchema = commandSchema(
  "AssignCrewToWorkOrder",
  z.object({ crewId: crewIdSchema, workOrderId: constructionSiteIdSchema }),
);
export const assignMaintenanceSchema = commandSchema(
  "AssignMaintenance",
  z.object({ buildingId: buildingIdSchema }),
);
export const orderEnforcerActionSchema = commandSchema(
  "OrderEnforcerAction",
  z.object({
    enforcerAgentId: agentIdSchema,
    action: z.enum(["attack_agent", "sabotage_building"]),
    targetAgentId: agentIdSchema.optional(),
    targetBuildingId: buildingIdSchema.optional(),
  }),
);
export const clearRuinSchema = commandSchema(
  "ClearRuin",
  z.object({ buildingId: buildingIdSchema }),
);
export const requestLoanSchema = commandSchema(
  "RequestLoan",
  z.object({
    amount: moneySchema,
    termMonths: z.number().int().positive().max(24),
    collateralParcelId: parcelIdSchema,
  }),
);
export const acceptLoanOfferSchema = commandSchema(
  "AcceptLoanOffer",
  z.object({ loanId: loanIdSchema }),
);
export const requestRefinancingSchema = commandSchema(
  "RequestRefinancing",
  z.object({
    loanId: loanIdSchema,
    termMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]),
  }),
);
export const placeAuctionBidSchema = commandSchema(
  "PlaceAuctionBid",
  z.object({ loanId: loanIdSchema, amount: moneySchema }),
);
export const withdrawAuctionBidSchema = commandSchema(
  "WithdrawAuctionBid",
  z.object({ loanId: loanIdSchema }),
);
export const setMaintenancePolicySchema = commandSchema(
  "SetMaintenancePolicy",
  z.object({ policy: z.enum(["balanced", "deferred"]) }),
);
export const setAutomationPolicySchema = commandSchema(
  "SetAutomationPolicy",
  z.object({
    property: z.enum(["manual", "fill_vacancies"]).optional(),
    finance: z.enum(["manual", "cover_shortfall"]).optional(),
    maintenanceRepairThreshold: z.number().int().min(0).max(100).nullable().optional(),
    financeCashFloor: moneySchema.optional(),
  }),
);
export const requestPermitSchema = commandSchema(
  "RequestPermit",
  z.object({ parcelId: parcelIdSchema, buildingType: buildingTypeSchema }),
);
export const buyInsuranceSchema = commandSchema(
  "BuyInsurance",
  z.object({
    buildingId: buildingIdSchema,
    coverage: z.enum(["fire_basic", "fire_plus"]),
  }),
);
export const submitPublicBidSchema = commandSchema(
  "SubmitPublicBid",
  z.object({ contractId: z.string().min(1).max(64), amount: moneySchema }),
);
export const cancelInsuranceSchema = commandSchema(
  "CancelInsurance",
  z.object({ buildingId: buildingIdSchema }),
);
export const commissionIntelligenceSchema = commandSchema(
  "CommissionIntelligence",
  z.object({
    subjectOrganizationId: organizationIdSchema,
    kind: z.enum(["balance", "exposure", "arrears", "bid_intent"]),
  }),
);
export type TransferCrew = DomainCommandBase & {
  type: "TransferCrew";
  payload: { crewId: CrewId; toDistrictId: DistrictId };
};

export const transferCrewSchema = commandSchema(
  "TransferCrew",
  z.object({ crewId: crewIdSchema, toDistrictId: districtIdSchema }),
);

export type TransferAgent = DomainCommandBase & {
  type: "TransferAgent";
  payload: { agentId: AgentId; toDistrictId: DistrictId };
};

export const transferAgentSchema = commandSchema(
  "TransferAgent",
  z.object({ agentId: agentIdSchema, toDistrictId: districtIdSchema }),
);

export const productCommandSchema = z.discriminatedUnion("type", [
  placeTestStructureSchema,
  buyParcelSchema,
  sellParcelSchema,
  startConstructionSchema,
  cancelConstructionSchema,
  assignTenantSchema,
  upgradeBuildingSchema,
  lobbyPolicySchema,
  proposePolicySchema,
  withdrawPolicySchema,
  commitCrimeSchema,
  buyMaterialsSchema,
  investInProductionSchema,
  allocateCrewSchema,
  repairBuildingSchema,
  assignCrewToWorkOrderSchema,
  assignMaintenanceSchema,
  orderEnforcerActionSchema,
  clearRuinSchema,
  requestLoanSchema,
  acceptLoanOfferSchema,
  requestRefinancingSchema,
  placeAuctionBidSchema,
  withdrawAuctionBidSchema,
  setMaintenancePolicySchema,
  setAutomationPolicySchema,
  requestPermitSchema,
  buyInsuranceSchema,
  cancelInsuranceSchema,
  submitPublicBidSchema,
  commissionIntelligenceSchema,
  transferCrewSchema,
  transferAgentSchema,
]);
