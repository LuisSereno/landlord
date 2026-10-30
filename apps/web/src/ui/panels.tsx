import { useState } from "react";

import type { ViewProjectionV2 } from "@landlord/shared";

import { BuildCatalog } from "./build-catalog";
import { BuildingThumbnail } from "./building-thumbnail";
import {
  repairBlockedReasons,
  tenantBlockedReason,
  upgradeBlockedReasons,
} from "./disabled-reasons";
import { HelpPopover, HelpTooltip } from "./help";
import { ResourceIcon, UiIcon } from "./icons";
import {
  buildingDisplayName,
  buildingStateLabel,
  buildingTypeLabel,
  constructionKindLabel,
  crewDisplayName,
  developmentCodeLabel,
  facilityKindLabel,
  facilityServiceLabel,
  formatGameDate,
  formatGameDuration,
  insuranceCoverageLabel,
  insuranceStatusLabel,
  landUseLabel,
  maintenancePolicyLabel,
  organizationDisplayName,
  parcelDispositionLabel,
  permitStatusLabel,
  publicSpaceKindLabel,
  tenantProfileLabel,
  urbanRoleLabel,
  zoningLabel,
} from "./labels";
import type {
  Economy,
  GameActions,
  GameCalendar,
  HubKind,
  ProjectedBuilding,
  ProjectedFacility,
  ProjectedParcel,
  ProjectedPublicSpace,
  ProjectedSite,
} from "./types";
import { facilityMetricsSummary } from "../facility-metrics";

const PLAYER = "org_00000001";

export type ContextSelection =
  | { kind: "parcel"; parcel: ProjectedParcel }
  | { kind: "building"; parcel: ProjectedParcel; building: ProjectedBuilding; owned: boolean }
  | { kind: "construction"; parcel: ProjectedParcel; site: ProjectedSite; owned: boolean }
  | { kind: "facility"; parcel: ProjectedParcel; facility: ProjectedFacility }
  | { kind: "public-space"; parcel: ProjectedParcel; space: ProjectedPublicSpace };

export type PanelContext = {
  economy: Economy;
  projection: ViewProjectionV2;
  projectionDistrictName: string;
  calendar: GameCalendar;
  actions: GameActions;
  onClose: () => void;
  onOpenHub: (hub: HubKind) => void;
  onSelectBuilding: (buildingId: string) => void;
};

/**
 * V.d-UX · panel contextual (spec §5.3, §6). Aparece sólo cuando hay selección, se cierra con
 * × o Escape y devuelve el espacio al mapa. La cabecera siempre dice qué se está mirando y cómo se
 * llama en el mundo del jugador; el id técnico no aparece.
 */
export function ContextPanel({
  selection,
  context,
}: {
  selection: ContextSelection;
  context: PanelContext;
}) {
  const title =
    selection.kind === "building"
      ? buildingDisplayName(selection.building.type)
      : selection.kind === "construction"
        ? `${constructionKindLabel(selection.site.kind)} en curso`
        : selection.kind === "facility"
          ? facilityKindLabel(selection.facility.kind)
          : selection.kind === "public-space"
            ? publicSpaceKindLabel(selection.space.kind)
            : selection.parcel.disposition === "public"
              ? "Suelo municipal"
              : selection.parcel.ownerOrganizationId === PLAYER
                ? "Tu solar"
                : "Solar disponible";
  const eyebrow =
    selection.kind === "facility"
      ? "Equipamiento"
      : selection.kind === "public-space"
        ? "Espacio público"
        : "Parcela";
  return (
    <aside aria-label="Inspección de parcela" className="context-panel">
      <header className="context-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="muted">
            {context.projectionDistrictName} · {urbanRoleLabel(selection.parcel.urbanRole)}
          </p>
        </div>
        <button
          aria-label="Cerrar panel"
          className="icon-button"
          onClick={context.onClose}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </header>
      <div className="context-body">
        {selection.kind === "parcel" ? (
          <ParcelPanel context={context} parcel={selection.parcel} />
        ) : selection.kind === "building" ? (
          <BuildingPanel
            building={selection.building}
            context={context}
            parcel={selection.parcel}
          />
        ) : selection.kind === "construction" ? (
          <ConstructionPanel context={context} owned={selection.owned} site={selection.site} />
        ) : selection.kind === "facility" ? (
          <FacilityPanel context={context} facility={selection.facility} />
        ) : (
          <PublicSpacePanel space={selection.space} />
        )}
      </div>
    </aside>
  );
}

function ParcelPanel({ parcel, context }: { parcel: ProjectedParcel; context: PanelContext }) {
  const { economy, calendar, actions } = context;
  const owned = parcel.ownerOrganizationId === PLAYER;
  const vacant = parcel.buildingIds.length === 0;
  const potential = parcel.potentialService;
  const coverage = parcel.serviceCoverage;
  return (
    <>
      <section className="panel-section">
        <div className="summary-row">
          <span className="summary-price">{parcel.marketValue} u.</span>
          <span className="chip">
            <UiIcon name="ownership" size={13} /> {parcelDispositionLabel(parcel.disposition)}
          </span>
          <span className="chip">
            <UiIcon name="tenants" size={13} />{" "}
            {organizationDisplayName(parcel.ownerOrganizationId)}
          </span>
          <span className="chip">
            <UiIcon name="zoning" size={13} /> {developmentCodeLabel(parcel.developmentCodeId)}
          </span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Valor del suelo</dt>
            <dd>
              {parcel.landValueBreakdown.score} <HelpTooltip topic="land_value" />
            </dd>
          </div>
          <div>
            <dt>Riesgo regulatorio</dt>
            <dd>
              {parcel.regulatoryRiskPercent} % <HelpTooltip topic="regulation" />
            </dd>
          </div>
          <div>
            <dt>Familia</dt>
            <dd>{zoningLabel(parcel.zoning)}</dd>
          </div>
          <div>
            <dt>Cargas</dt>
            <dd>
              {parcel.estimatedTransferTax} u. transmisión · {parcel.estimatedMonthlyPropertyTax}{" "}
              u./mes <HelpTooltip topic="taxes" />
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel-section">
        <h3>
          <UiIcon name="services" /> {vacant ? "Servicio potencial" : "Servicios"}{" "}
          <HelpTooltip topic="services" />
        </h3>
        <ul className="service-list" role="list">
          {(["security", "fire", "health", "education", "market"] as const).map((service) => {
            const value = vacant ? potential[service] : coverage[service];
            return (
              <li key={service}>
                <UiIcon
                  name={
                    service === "security"
                      ? "security"
                      : service === "fire"
                        ? "fire"
                        : service === "health"
                          ? "health"
                          : service === "education"
                            ? "education"
                            : "market"
                  }
                  size={14}
                />
                {serviceLabel(service)} {value} %
              </li>
            );
          })}
          <li>
            <UiIcon name="services" size={14} /> Transporte {coverage.transport} %
          </li>
          <li>
            <UiIcon name="city" size={14} /> Parques {coverage.parks} %
          </li>
        </ul>
      </section>

      <details className="panel-section">
        <summary>Detalle urbanístico</summary>
        <dl className="detail-grid">
          <div>
            <dt>Usos permitidos</dt>
            <dd>{parcel.allowedUses.map(landUseLabel).join(", ")}</dd>
          </div>
          <div>
            <dt>Usos actuales</dt>
            <dd>
              {parcel.currentUses.length === 0
                ? "Sin uso"
                : parcel.currentUses.map(landUseLabel).join(", ")}
            </dd>
          </div>
          <div>
            <dt>Aptitud productiva</dt>
            <dd className="resource-list">
              {(["cement", "brick", "steel"] as const).map((resource) => (
                <span key={resource}>
                  <ResourceIcon resource={resource} size={14} />
                  {parcel.productionSuitability[resource]} %
                </span>
              ))}
              <HelpTooltip topic="production_suitability" />
            </dd>
          </div>
          <div>
            <dt>Riesgo</dt>
            <dd>
              {parcel.regulatoryRiskPercent} %
              {parcel.permitStatus ? ` · permiso ${permitStatusLabel(parcel.permitStatus)}` : ""}
              {parcel.permitExpiresAtTick !== null
                ? ` · válido hasta el ${formatGameDate(parcel.permitExpiresAtTick, calendar)}`
                : ""}
              <HelpTooltip topic="permits" />
            </dd>
          </div>
        </dl>
      </details>

      {!owned && parcel.disposition === "marketable" ? (
        <button
          className="primary-action"
          onClick={() => actions.buyParcel(parcel.id)}
          type="button"
        >
          <UiIcon name="money" /> Comprar parcela · {parcel.marketValue} u.
        </button>
      ) : null}
      {owned && vacant ? (
        <BuildCatalog actions={actions} calendar={calendar} economy={economy} parcel={parcel} />
      ) : null}
      {owned && !vacant ? (
        <p className="muted">
          <UiIcon name="info" size={14} /> Este solar ya está edificado. Selecciona un edificio para
          gestionarlo.
        </p>
      ) : null}
    </>
  );
}

function serviceLabel(service: "security" | "fire" | "health" | "education" | "market"): string {
  return {
    security: "Seguridad",
    fire: "Bomberos",
    health: "Salud",
    education: "Educación",
    market: "Mercado",
  }[service];
}

function BuildingPanel({
  building,
  parcel,
  context,
}: {
  building: ProjectedBuilding;
  parcel: ProjectedParcel;
  context: PanelContext;
}) {
  const { economy, calendar, actions } = context;
  const owned = building.ownerOrganizationId === PLAYER;
  if (!owned) return <RivalPanel building={building} context={context} />;
  const option = economy.constructionOptions.find((entry) => entry.type === building.type);
  const production = economy.production.find((entry) => entry.buildingId === building.id);
  const contract = economy.insurance.contracts.find((entry) => entry.buildingId === building.id);
  const offers = economy.insurance.offers.filter((offer) => offer.buildingId === building.id);
  const compatibleTenants = economy.tenants.filter(
    (tenant) => !tenant.activeContractBuildingId && tenant.preferredBuildingType === building.type,
  );
  const [tab, setTab] = useState<"summary" | "tenants" | "maintenance" | "insurance" | "finance">(
    "summary",
  );
  const upgradeReasons = option
    ? upgradeBlockedReasons({ economy, option, alreadyUpgraded: building.upgraded })
    : [];
  const repairReasons = repairBlockedReasons({ economy, condition: building.condition });
  const occupied = building.tenantIds.length;
  return (
    <>
      <section className="panel-section entity-head">
        <BuildingThumbnail size={72} type={building.type} />
        <div>
          <p className="entity-title">{buildingDisplayName(building.type)}</p>
          <p className="muted">
            {buildingStateLabel(building.state)} · nivel {building.level} ·{" "}
            {organizationDisplayName(building.ownerOrganizationId)}
          </p>
          <p className="muted">
            Condición {building.condition} % · integridad {building.structuralIntegrity} %
          </p>
        </div>
      </section>

      <nav aria-label="Secciones del edificio" className="tab-row">
        {(
          [
            ["summary", "Resumen", "info"],
            ["tenants", "Inquilinos", "tenants"],
            ["maintenance", "Mantenimiento", "maintenance"],
            ["insurance", "Seguro", "insurance"],
            ["finance", "Finanzas", "finance"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            aria-pressed={tab === id}
            className="tab"
            key={id}
            onClick={() => setTab(id)}
            type="button"
          >
            <UiIcon name={icon} size={14} /> {label}
          </button>
        ))}
      </nav>

      {tab === "summary" ? (
        <section className="panel-section">
          <dl className="detail-grid">
            <div>
              <dt>Ocupación</dt>
              <dd>{production ? "Producción" : `${occupied}/${building.capacity} plazas`}</dd>
            </div>
            <div>
              <dt>Ingresos</dt>
              <dd>
                {production
                  ? `${production.averageOutputAmount.toFixed(2)} ${production.output}/ciclo`
                  : `${building.effectiveRent} u./plaza`}
              </dd>
            </div>
            <div>
              <dt>Gastos</dt>
              <dd>{building.maintenanceCost} u./mes</dd>
            </div>
            <div>
              <dt>Rentabilidad</dt>
              <dd>
                {production
                  ? `Aptitud ${production.suitabilityPercent} %`
                  : `${occupied * building.effectiveRent - building.maintenanceCost} u./mes`}
                <HelpTooltip topic="profitability" />
              </dd>
            </div>
          </dl>
          {production ? (
            <p className="muted">
              Ciclo {production.cycleProgress}/{production.cycleLength} · próximo +
              {production.nextCycleOutputAmount} · coste {production.operatingCost} u. · condición{" "}
              {production.conditionPercent} % · ampliación {production.upgradePercent} %
            </p>
          ) : null}
          {option && !building.upgraded ? (
            <button
              disabled={upgradeReasons.length > 0}
              onClick={() => actions.upgradeBuilding(building.id)}
              type="button"
            >
              <UiIcon name="upgrade" /> Mejorar · {option.upgradeCost} u. ·{" "}
              {option.upgradeWorkRequired} h
            </button>
          ) : building.upgraded ? (
            <p className="muted">Mejora completada.</p>
          ) : null}
          {upgradeReasons.length > 0 && option && !building.upgraded ? (
            <ul className="blocked-reasons" role="list">
              {upgradeReasons.map((reason) => (
                <li key={reason.code}>
                  <UiIcon name="warning" size={13} /> {reason.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tab === "tenants" ? (
        <section className="panel-section">
          {production ? (
            <p className="muted">
              <UiIcon name="production" size={14} /> Una instalación productiva no se ocupa con
              hogares: su rendimiento depende de la aptitud y la condición.
            </p>
          ) : (
            <>
              <h3>
                <UiIcon name="tenants" /> Inquilinos
              </h3>
              {building.tenantIds.length === 0 ? (
                <p className="muted">Sin contratos activos.</p>
              ) : (
                <ul className="list-plain" role="list">
                  {building.tenantIds.map((tenantId) => {
                    const tenant = economy.tenants.find((entry) => entry.id === tenantId);
                    return (
                      <li key={tenantId}>
                        {tenant ? (
                          <>
                            {tenantProfileLabel(tenant.profile)} · satisfacción{" "}
                            {tenant.satisfaction} % · contrato {tenant.leaseRemaining} meses
                          </>
                        ) : (
                          "Inquilino"
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {occupied < building.capacity ? (
                compatibleTenants.length > 0 ? (
                  <ul className="list-plain" role="list">
                    {compatibleTenants.map((tenant) => {
                      const blocked = tenantBlockedReason(tenant.budget, building.effectiveRent);
                      return (
                        <li key={tenant.id}>
                          <button
                            disabled={blocked !== null}
                            onClick={() => actions.assignTenant(building.id, tenant.id)}
                            type="button"
                          >
                            <UiIcon name="tenants" /> Ocupar con{" "}
                            {tenantProfileLabel(tenant.profile)} · {tenant.budget} u.
                          </button>
                          {blocked ? <span className="muted"> {blocked.message}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted">No hay inquilinos compatibles disponibles.</p>
                )
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {tab === "maintenance" ? (
        <section className="panel-section">
          <h3>
            <UiIcon name="maintenance" /> Mantenimiento <HelpTooltip topic="maintenance" />
          </h3>
          <p className="muted">
            Coste {building.maintenanceCost} u./mes · deuda acumulada {building.maintenanceDue} u. ·
            política {maintenancePolicyLabel(economy.maintenance.policy)}
          </p>
          <button
            disabled={repairReasons.length > 0}
            onClick={() => actions.repairBuilding(building.id)}
            type="button"
          >
            <UiIcon name="maintenance" /> Reparar · {economy.maintenance.repairCost} u.
          </button>
          {repairReasons.length > 0 ? (
            <ul className="blocked-reasons" role="list">
              {repairReasons.map((reason) => (
                <li key={reason.code}>
                  <UiIcon name="warning" size={13} /> {reason.message}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            disabled={building.state === "ruin"}
            onClick={() => actions.assignMaintenance(building.id)}
            type="button"
          >
            <UiIcon name="crew" /> Enviar técnico
          </button>
          {building.state === "ruin" ? (
            <button onClick={() => actions.clearRuin(building.id)} type="button">
              <UiIcon name="construction" /> Despejar ruina
            </button>
          ) : null}
        </section>
      ) : null}

      {tab === "insurance" ? (
        <section className="panel-section">
          <h3>
            <UiIcon name="insurance" /> Seguro <HelpTooltip topic="insurance" />
          </h3>
          {contract && contract.status === "active" ? (
            <>
              <p className="muted">
                {insuranceCoverageLabel(contract.coverage)} · prima {contract.premium} u./mes ·
                límite {contract.coverageLimit} u.
                {contract.nextPremiumTick !== null
                  ? ` · próximo cobro el ${formatGameDate(contract.nextPremiumTick, calendar)}`
                  : ""}
              </p>
              <button onClick={() => actions.cancelInsurance(building.id)} type="button">
                Cancelar seguro
              </button>
            </>
          ) : offers.length > 0 ? (
            <ul className="list-plain" role="list">
              {offers.map((offer) => (
                <li key={offer.coverage}>
                  <button
                    disabled={economy.cash < offer.premium}
                    onClick={() => actions.buyInsurance(offer.buildingId, offer.coverage)}
                    type="button"
                  >
                    <UiIcon name="insurance" /> {insuranceCoverageLabel(offer.coverage)} ·{" "}
                    {offer.premium} u./mes · límite {offer.coverageLimit} u.
                  </button>
                  {economy.cash < offer.premium ? (
                    <span className="muted"> Necesitas {offer.premium} u. y la caja no llega.</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No hay coberturas disponibles para este edificio.
              {contract ? ` Estado actual: ${insuranceStatusLabel(contract.status)}.` : ""}
            </p>
          )}
        </section>
      ) : null}

      {tab === "finance" ? (
        <section className="panel-section">
          <h3>
            <UiIcon name="finance" /> Finanzas del activo <HelpPopover topic="portfolio" />
          </h3>
          <dl className="detail-grid">
            <div>
              <dt>Renta efectiva</dt>
              <dd>{building.effectiveRent} u./plaza</dd>
            </div>
            <div>
              <dt>Mantenimiento</dt>
              <dd>{building.maintenanceDue} u. pendientes</dd>
            </div>
            <div>
              <dt>Deuda</dt>
              <dd>
                {economy.financials.liabilities} u. <HelpTooltip topic="debt" />
              </dd>
            </div>
            <div>
              <dt>Caja</dt>
              <dd>{economy.cash} u.</dd>
            </div>
          </dl>
          <button
            className="secondary-action"
            onClick={() => context.onOpenHub("finance")}
            type="button"
          >
            <UiIcon name="finance" /> Abrir Finanzas
          </button>
          <AuctionCard actions={actions} economy={economy} parcel={parcel} />
        </section>
      ) : null}
    </>
  );
}

function AuctionCard({
  economy,
  parcel,
  actions,
}: {
  economy: Economy;
  parcel: ProjectedParcel;
  actions: GameActions;
}) {
  const auction = economy.banking.auctions.find(
    (entry) => entry.collateralParcelId === parcel.id && entry.status === "open",
  );
  if (!auction) return null;
  const bid = Math.max(auction.reservePrice, auction.highestBid + 1);
  return (
    <div className="notice-card">
      <p>
        <UiIcon name="auction" /> <strong>Garantía en subasta</strong> · reserva{" "}
        {auction.reservePrice} u. · puja actual {auction.highestBid} u.{" "}
        <HelpTooltip topic="auction" />
      </p>
      {auction.sellerOrganizationId === PLAYER ? (
        <button onClick={() => actions.requestRefinancing(auction.loanId, 12)} type="button">
          Refinanciar a 12 meses
        </button>
      ) : auction.highestBidderOrganizationId === PLAYER ? (
        <button onClick={() => actions.withdrawAuctionBid(auction.loanId)} type="button">
          Retirar puja
        </button>
      ) : (
        <button
          disabled={economy.cash < bid}
          onClick={() => actions.placeAuctionBid(auction.loanId, bid)}
          type="button"
        >
          Pujar {bid} u.
        </button>
      )}
    </div>
  );
}

function ConstructionPanel({
  site,
  owned,
  context,
}: {
  site: ProjectedSite;
  owned: boolean;
  context: PanelContext;
}) {
  const { economy, calendar, actions } = context;
  const progress = Math.floor((site.progress / Math.max(1, site.workRequired)) * 100);
  const remainingHours = Math.max(0, site.workRequired - site.progress);
  const freeCrews = economy.crews.filter((crew) => !crew.assignedWorkOrderId);
  return (
    <>
      <section className="panel-section entity-head">
        <BuildingThumbnail size={72} type={site.buildingType} />
        <div>
          <p className="entity-title">{buildingTypeLabel(site.buildingType)}</p>
          <p className="muted">
            {constructionKindLabel(site.kind)} · {organizationDisplayName(site.ownerOrganizationId)}
          </p>
          <p className="muted">
            {formatGameDuration((remainingHours * calendar.ticksPerDay) / 24, calendar)} de trabajo
            restante
          </p>
        </div>
      </section>
      <section className="panel-section">
        <div
          aria-label={`Progreso ${progress} %`}
          className="progress"
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="muted">{progress} % completado</p>
        <h3>
          <UiIcon name="crew" /> Cuadrillas <HelpTooltip topic="crew" />
        </h3>
        {site.assignedCrewIds.length === 0 ? (
          <p className="muted">Ninguna cuadrilla asignada todavía.</p>
        ) : (
          <ul className="list-plain" role="list">
            {site.assignedCrewIds.map((crewId) => (
              <li key={crewId}>
                <UiIcon name="crew" size={14} /> {crewDisplayName(crewId)}
              </li>
            ))}
          </ul>
        )}
        {owned ? (
          <ul className="list-plain" role="list">
            {freeCrews.map((crew) => (
              <li key={crew.id}>
                <button onClick={() => actions.assignCrew(crew.id, site.id)} type="button">
                  <UiIcon name="crew" /> Asignar {crewDisplayName(crew.id)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {owned && freeCrews.length === 0 && site.assignedCrewIds.length === 0 ? (
          <p className="muted">No tienes una cuadrilla libre.</p>
        ) : null}
        <MaterialsHint economy={economy} />
        {owned ? (
          <button
            className="danger-action"
            onClick={() => actions.cancelConstruction(site.id)}
            type="button"
          >
            <UiIcon name="close" /> Cancelar obra
          </button>
        ) : null}
      </section>
    </>
  );
}

function MaterialsHint({ economy }: { economy: Economy }) {
  return (
    <p className="muted resource-row">
      Inventario:
      {(["cement", "brick", "steel"] as const).map((resource) => (
        <span key={resource}>
          <ResourceIcon resource={resource} size={14} /> {economy.inventory[resource]}
        </span>
      ))}
    </p>
  );
}

function RivalPanel({ building, context }: { building: ProjectedBuilding; context: PanelContext }) {
  const enforcer = context.projection.agents.find(
    (agent) =>
      agent.organizationId === PLAYER && agent.specialty === "enforcer" && agent.state === "idle",
  );
  return (
    <section className="panel-section">
      <p className="muted">
        Edificio rival · {buildingStateLabel(building.state)} · integridad{" "}
        {building.structuralIntegrity} %.
      </p>
      <p className="muted">
        <UiIcon name="info" size={14} /> Sólo se muestra lo que tu sistema de información puede
        conocer del rival.
      </p>
      <button
        disabled={!enforcer}
        onClick={() => enforcer && context.actions.orderEnforcerSabotage(enforcer.id, building.id)}
        type="button"
      >
        <UiIcon name="rival" /> Ordenar sabotaje físico
      </button>
      {!enforcer ? <p className="muted">No tienes un enforcer libre para esta operación.</p> : null}
    </section>
  );
}

function FacilityPanel({
  facility,
  context,
}: {
  facility: ProjectedFacility;
  context: PanelContext;
}) {
  return (
    <section className="panel-section">
      <p className="entity-title">
        <UiIcon name="government" /> {facilityKindLabel(facility.kind)}
      </p>
      <p className="muted">Suelo municipal · gestionado por el Ayuntamiento; no es transferible.</p>
      <dl className="detail-grid">
        <div>
          <dt>Servicio</dt>
          <dd>{facilityServiceLabel(facility.serviceProfileId)}</dd>
        </div>
        <div>
          <dt>Capacidad</dt>
          <dd>{facility.capacity} cohortes</dd>
        </div>
        <div>
          <dt>Operador</dt>
          <dd>{organizationDisplayName(facility.operatorOrganizationId)}</dd>
        </div>
        <div>
          <dt>Acceso</dt>
          <dd>{facility.accessCells.length} celdas de acceso vial</dd>
        </div>
      </dl>
      <p className="muted">{facilityMetricsSummary(facility.serviceMetrics)}</p>
      <button
        className="secondary-action"
        onClick={() => context.onOpenHub("government")}
        type="button"
      >
        <UiIcon name="government" /> Ir al Ayuntamiento
      </button>
    </section>
  );
}

function PublicSpacePanel({ space }: { space: ProjectedPublicSpace }) {
  return (
    <section className="panel-section">
      <p className="entity-title">
        <UiIcon name="services" /> {publicSpaceKindLabel(space.kind)}
      </p>
      <p className="muted">
        Suelo municipal · {space.cells.length} celdas de espacio público gestionadas por el
        ayuntamiento.
      </p>
    </section>
  );
}
