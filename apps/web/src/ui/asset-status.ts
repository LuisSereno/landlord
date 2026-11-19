import type { HelpTopicKey } from "./help";
import {
  auctionStatusLabel,
  encumbranceStatusLabel,
  formatGameDate,
  insuranceCoverageLabel,
  insuranceStateLabel,
  loanStatusLabel,
  occupancyBandLabel,
} from "./labels";
import type { Economy, ProjectedBuilding } from "./types";

/**
 * V.d-UX.S · puerta única del estado del activo (doctrina D-103: escena y panel leen lo mismo).
 *
 * Todo lo que se indexa aquí YA viaja en `ViewProjectionV3`: préstamos y subastas por
 * `collateralParcelId`, pólizas por `buildingId`, ocupación por `tenantIds`/`capacity`, backlog como
 * resta de dos campos publicados y las causas de alerta con su discriminador `reason`. No se
 * recalcula ninguna regla económica: los umbrales los decide el motor al emitir o no la alerta.
 *
 * Regla de información imperfecta: `unknown` NUNCA equivale a `none`. Los préstamos y las pólizas
 * sólo se publican para el jugador, y los inquilinos de edificios ajenos llegan anonimizados, así
 * que una parcela ajena no está "sin carga" y un edificio rival no está "vacío": no se sabe.
 */

const PLAYER = "org_00000001";

export type ParcelLoadKind =
  "unknown" | "none" | "loan" | "delinquent" | "defaulted" | "auction" | "auction_bid";

/** `offered` todavía no grava nada y `paid_off` ya no grava: ninguno es carga viva. */
export type LiveLoanStatus = "active" | "delinquent" | "defaulted";

export type LoanEncumbrance = {
  loanId: string;
  status: LiveLoanStatus;
  outstandingPrincipal: number;
  monthlyPayment: number;
  remainingMonths: number;
  missedPayments: number;
};

export type AuctionEncumbrance = {
  loanId: string;
  role: "seller" | "bidder";
  reservePrice: number;
  highestBid: number;
  closesAtTick: number;
};

export type ParcelLoad = {
  kind: ParcelLoadKind;
  /** Todos los préstamos vivos de la parcela: `defaulted` no bloquea uno nuevo, no hay unicidad. */
  loans: readonly LoanEncumbrance[];
  auction: AuctionEncumbrance | null;
  label: string;
  detail: readonly string[];
};

export type InsuranceState = "active" | "lapsed" | "none" | "unknown";
export type OccupancyBand = "full" | "partial" | "empty" | "production" | "unknown";

export type BuildingStatus = {
  buildingId: string;
  upgraded: boolean;
  insurance: InsuranceState;
  occupancy: OccupancyBand;
  occupied: number;
  capacity: number;
  /** Deuda de mantenimiento viva: `maintenanceDue` ya incluye el coste del mes, se resta. */
  backlog: number;
  conditionAlert: boolean;
  insuranceAlert: boolean;
};

export type AssetStatusIndex = {
  loadsByParcelId: ReadonlyMap<string, ParcelLoad>;
  statusByBuildingId: ReadonlyMap<string, BuildingStatus>;
};

export type AssetFinanceRow = { label: string; value: string; helpTopic?: HelpTopicKey };

const LOAD_RANK: Record<ParcelLoadKind, number> = {
  unknown: -1,
  none: 0,
  loan: 1,
  delinquent: 2,
  defaulted: 3,
  auction: 4,
  auction_bid: 0,
};

const EMPTY_LOAD: ParcelLoad = {
  kind: "none",
  loans: [],
  auction: null,
  label: encumbranceStatusLabel("none"),
  detail: [],
};

const UNKNOWN_LOAD: ParcelLoad = {
  kind: "unknown",
  loans: [],
  auction: null,
  label: encumbranceStatusLabel("unknown"),
  detail: [],
};

function isLive(status: string): status is LiveLoanStatus {
  return status === "active" || status === "delinquent" || status === "defaulted";
}

function loanDetail(loan: LoanEncumbrance): string {
  const base = `${loanStatusLabel(loan.status)} · ${loan.outstandingPrincipal} u. pendientes · cuota ${loan.monthlyPayment} u./mes`;
  return loan.missedPayments > 0
    ? `${base} · ${loan.missedPayments} cuota(s) impagada(s)`
    : `${base} · ${loan.remainingMonths} meses restantes`;
}

/**
 * Indexa el estado del activo a partir de la proyección. Pura y determinista: mismo economy ⇒
 * mismo índice, sin PRNG ni reloj real. `undefined` produce mapas vacíos, nunca un estado inventado.
 */
export function indexAssetStatus(economy: Economy | undefined): AssetStatusIndex {
  const loadsByParcelId = new Map<string, ParcelLoad>();
  const statusByBuildingId = new Map<string, BuildingStatus>();
  if (!economy) return { loadsByParcelId, statusByBuildingId };

  const loansByParcel = new Map<string, LoanEncumbrance[]>();
  for (const loan of economy.banking.loans) {
    if (!isLive(loan.status)) continue;
    const entry: LoanEncumbrance = {
      loanId: loan.id,
      status: loan.status,
      outstandingPrincipal: loan.outstandingPrincipal,
      monthlyPayment: loan.monthlyPayment,
      remainingMonths: loan.remainingMonths,
      missedPayments: loan.missedPayments,
    };
    const list = loansByParcel.get(loan.collateralParcelId) ?? [];
    list.push(entry);
    loansByParcel.set(loan.collateralParcelId, list);
  }

  const auctionByParcel = new Map<string, AuctionEncumbrance>();
  for (const auction of economy.banking.auctions) {
    if (auction.status !== "open") continue;
    const role =
      auction.sellerOrganizationId === PLAYER
        ? "seller"
        : auction.highestBidderOrganizationId === PLAYER
          ? "bidder"
          : null;
    if (!role) continue;
    const previous = auctionByParcel.get(auction.collateralParcelId);
    /** Una parcela puede tener varias subastas abiertas: gana la de reserva mayor, orden estable. */
    if (previous && previous.reservePrice >= auction.reservePrice) continue;
    auctionByParcel.set(auction.collateralParcelId, {
      loanId: auction.loanId,
      role,
      reservePrice: auction.reservePrice,
      highestBid: auction.highestBid,
      closesAtTick: auction.closesAtTick,
    });
  }

  const parcelIds = new Set<string>([
    ...economy.parcels.map((parcel) => parcel.id),
    ...loansByParcel.keys(),
    ...auctionByParcel.keys(),
  ]);
  const ownerByParcel = new Map<string, string | null>(
    economy.parcels.map(
      (parcel) => [parcel.id, parcel.ownerOrganizationId] as [string, string | null],
    ),
  );
  const dispositionByParcel = new Map<string, string>(
    economy.parcels.map((parcel) => [parcel.id, parcel.disposition] as [string, string]),
  );

  for (const parcelId of [...parcelIds].sort((a, b) => a.localeCompare(b))) {
    const loans = (loansByParcel.get(parcelId) ?? []).sort((a, b) =>
      a.loanId.localeCompare(b.loanId),
    );
    const auction = auctionByParcel.get(parcelId) ?? null;
    const owner = ownerByParcel.get(parcelId);
    const disposition = dispositionByParcel.get(parcelId);
    const detail: string[] = [];
    let kind: ParcelLoadKind;

    if (auction?.role === "seller") {
      kind = "auction";
      detail.push(
        `Subasta ${auctionStatusLabel("open")} · reserva ${auction.reservePrice} u. · puja actual ${auction.highestBid} u.`,
      );
      detail.push(`Cierra el ${formatGameDate(auction.closesAtTick, economy.gameTime)}`);
    } else if (owner !== undefined && owner !== PLAYER) {
      /** Parcela ajena: no se publica su deuda. Si pujamos en su subasta, eso sí es nuestro. */
      kind = auction?.role === "bidder" ? "auction_bid" : "unknown";
      if (kind === "auction_bid" && auction) {
        detail.push(`Puja propia de ${auction.highestBid} u. · reserva ${auction.reservePrice} u.`);
        detail.push(`Cierra el ${formatGameDate(auction.closesAtTick, economy.gameTime)}`);
      }
    } else if (disposition === "public" || disposition === "infrastructure") {
      /** Suelo público: el motor no lo admite como garantía, así que no hay carga que publicar. */
      kind = "unknown";
    } else {
      kind = "none";
      for (const loan of loans) {
        const rank: ParcelLoadKind =
          loan.status === "defaulted"
            ? "defaulted"
            : loan.status === "delinquent"
              ? "delinquent"
              : "loan";
        if (LOAD_RANK[rank] > LOAD_RANK[kind]) kind = rank;
      }
    }
    for (const loan of loans) detail.push(loanDetail(loan));
    loadsByParcelId.set(parcelId, {
      kind,
      loans,
      auction,
      label: encumbranceStatusLabel(kind),
      detail,
    });
  }

  const productionBuildings = new Set<string>();
  for (const entry of economy.production) {
    if (entry.buildingId !== null) productionBuildings.add(entry.buildingId);
  }
  const contracts = new Map(economy.insurance.contracts.map((entry) => [entry.buildingId, entry]));
  const conditionAlerts = new Set<string>();
  const insuranceAlerts = new Set<string>();
  const publishedBuildings = new Set(economy.buildings.map((entry) => entry.id));
  for (const alert of economy.alerts) {
    if (alert.kind !== "maintenance" || alert.buildingId === null) continue;
    /**
     * Las dos causas de mantenimiento comparten `kind` y `targetId`. El discriminador tipado
     * `reason` las separa y `buildingId` dice a qué edificio afectan: una parcela puede sostener
     * varios. El `id` de la alerta es opaco y no se parsea. Una alerta sobre un edificio que no se
     * publica en este distrito se ignora: no se inventa un badge para lo que no se ve.
     */
    if (!publishedBuildings.has(alert.buildingId)) continue;
    if (alert.reason === "building_condition") conditionAlerts.add(alert.buildingId);
    if (alert.reason === "uninsured_building") insuranceAlerts.add(alert.buildingId);
  }

  for (const building of economy.buildings) {
    const owned = building.ownerOrganizationId === PLAYER;
    const contract = contracts.get(building.id);
    const insurance: InsuranceState = !owned
      ? "unknown"
      : contract?.status === "active"
        ? "active"
        : contract?.status === "lapsed"
          ? "lapsed"
          : "none";
    const occupied = building.tenantIds.length;
    const capacity = building.capacity;
    const occupancy: OccupancyBand = !owned
      ? "unknown"
      : productionBuildings.has(building.id)
        ? "production"
        : occupied === 0
          ? "empty"
          : occupied >= capacity
            ? "full"
            : "partial";
    statusByBuildingId.set(building.id, {
      buildingId: building.id,
      upgraded: building.upgraded,
      insurance,
      occupancy,
      occupied,
      capacity,
      backlog: Math.max(0, (building.maintenanceDue ?? 0) - (building.maintenanceCost ?? 0)),
      conditionAlert: conditionAlerts.has(building.id),
      insuranceAlert: insuranceAlerts.has(building.id),
    });
  }
  return { loadsByParcelId, statusByBuildingId };
}

export function parcelLoadFor(index: AssetStatusIndex, parcelId: string): ParcelLoad {
  return index.loadsByParcelId.get(parcelId) ?? UNKNOWN_LOAD;
}

export function buildingStatusFor(
  index: AssetStatusIndex,
  buildingId: string,
): BuildingStatus | null {
  return index.statusByBuildingId.get(buildingId) ?? null;
}

export function emptyLoad(): ParcelLoad {
  return EMPTY_LOAD;
}

/**
 * Hipoteca del activo: préstamos VIVOS cuya garantía es alguna de las parcelas del edificio.
 * Un edificio multi-parcela puede estar gravado sólo en parte; `paid_off` no suma deuda.
 */
export function assetMortgageTotal(economy: Economy, building: ProjectedBuilding): number {
  const parcels = new Set(building.parcelIds);
  return economy.banking.loans
    .filter((loan) => isLive(loan.status) && parcels.has(loan.collateralParcelId))
    .reduce((total, loan) => total + loan.outstandingPrincipal, 0);
}

/** Parcelas del edificio que respaldan algún préstamo vivo, con su estado. */
export function assetCollateralParcels(
  economy: Economy,
  building: ProjectedBuilding,
): Array<{ parcelId: string; kind: ParcelLoadKind }> {
  const index = indexAssetStatus(economy);
  return building.parcelIds
    .map((parcelId) => ({ parcelId, kind: parcelLoadFor(index, parcelId).kind }))
    .filter((entry) => entry.kind !== "none" && entry.kind !== "unknown");
}

/**
 * Filas de finanzas del activo. La misma puerta que alimenta los badges: el panel no puede decir
 * una cifra distinta de la que el mapa señala.
 */
export function assetFinanceRows(economy: Economy, building: ProjectedBuilding): AssetFinanceRow[] {
  const mortgage = assetMortgageTotal(economy, building);
  const collateral = assetCollateralParcels(economy, building);
  const rows: AssetFinanceRow[] = [
    { label: "Renta efectiva", value: `${building.effectiveRent} u./plaza` },
    {
      label: "Mantenimiento",
      value: `${building.maintenanceDue} u. pendientes`,
      helpTopic: "maintenance",
    },
    {
      label: "Hipoteca del activo",
      value: mortgage > 0 ? `${mortgage} u.` : "sin carga viva",
      helpTopic: "collateral",
    },
    {
      label: "Garantía",
      value:
        collateral.length > 0
          ? `${collateral.length} parcela(s) · ${encumbranceStatusLabel(collateral[0]!.kind)}`
          : "ninguna parcela gravada",
      helpTopic: "collateral",
    },
    {
      label: "Deuda de la cartera",
      value: `${economy.financials.liabilities} u.`,
      helpTopic: "debt",
    },
    { label: "Caja", value: `${economy.cash} u.` },
  ];
  return rows;
}

/** Texto de ocupación para chips y tooltips, sin ids ni enums. */
export function occupancyText(status: BuildingStatus): string {
  if (status.occupancy === "production") return occupancyBandLabel("production");
  if (status.occupancy === "unknown") return occupancyBandLabel("unknown");
  return `${occupancyBandLabel(status.occupancy)} · ${status.occupied}/${status.capacity} plazas`;
}

/** Texto de seguro para chips y tooltips. */
export function insuranceText(economy: Economy, status: BuildingStatus): string {
  const label = insuranceStateLabel(status.insurance);
  const contract = economy.insurance.contracts.find(
    (entry) => entry.buildingId === status.buildingId,
  );
  if (!contract || status.insurance === "unknown") return label;
  return `${label} · ${insuranceCoverageLabel(contract.coverage)} · prima ${contract.premium} u./mes`;
}
