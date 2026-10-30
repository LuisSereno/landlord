import type { BuildingType, ViewProjectionV2 } from "@landlord/shared";

/** Alias del contrato de proyección que consumen los componentes del shell. */
export type Economy = NonNullable<ViewProjectionV2["economy"]>;
export type ProjectedParcel = Economy["parcels"][number];
export type ProjectedBuilding = Economy["buildings"][number];
export type ProjectedSite = Economy["constructionSites"][number];
export type ProjectedFacility = ViewProjectionV2["facilities"][number];
export type ProjectedPublicSpace = ViewProjectionV2["publicSpaces"][number];
export type ProjectedDistrict = ViewProjectionV2["city"]["districts"][number];
export type GameCalendar = Economy["gameTime"];

export type HubKind = "government" | "finance" | "portfolio" | "city";
export type SurfaceKind =
  "parcel" | "building" | "construction" | "rival" | "facility" | "public-space" | HubKind;

/**
 * Comandos del juego expuestos a la UI. Cada uno se limita a enviar el comando existente por el
 * worker: React no decide elegibilidad ni muta el estado (spec §3.7).
 */
export type GameActions = {
  buyParcel: (parcelId: string) => void;
  startConstruction: (parcelId: string, buildingType: BuildingType) => void;
  cancelConstruction: (siteId: string) => void;
  assignCrew: (crewId: string, siteId: string) => void;
  assignTenant: (buildingId: string, tenantId: string) => void;
  upgradeBuilding: (buildingId: string) => void;
  repairBuilding: (buildingId: string) => void;
  assignMaintenance: (buildingId: string) => void;
  clearRuin: (buildingId: string) => void;
  buyMaterials: (resource: "cement" | "brick" | "steel", amount: number) => void;
  requestLoan: (amount: number, termMonths: 6 | 12 | 24, collateralParcelId: string) => void;
  acceptLoanOffer: (offerId: string) => void;
  requestRefinancing: (loanId: string, termMonths: 6 | 12 | 24) => void;
  placeAuctionBid: (loanId: string, amount: number) => void;
  withdrawAuctionBid: (loanId: string) => void;
  buyInsurance: (buildingId: string, coverage: "fire_basic" | "fire_plus") => void;
  cancelInsurance: (buildingId: string) => void;
  setMaintenancePolicy: (policy: "balanced" | "deferred") => void;
  setAutomationPolicy: (patch: {
    property?: "manual" | "fill_vacancies";
    finance?: "manual" | "cover_shortfall";
    maintenanceRepairThreshold?: number | null;
  }) => void;
  runPortfolioRoutine: () => void;
  proposePolicy: (policyId: string) => void;
  lobbyPolicy: (policyId: string, influence: number) => void;
  withdrawPolicy: (policyId: string) => void;
  submitPublicBid: (contractId: string, amount: number) => void;
  commissionIntelligence: (
    organizationId: string,
    kind: Economy["intelligence"]["kinds"][number]["kind"],
  ) => void;
  orderEnforcerSabotage: (agentId: string, buildingId: string) => void;
  placeStructure: (cell: { x: number; y: number }) => void;
};
