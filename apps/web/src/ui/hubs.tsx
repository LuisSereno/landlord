import { useState } from "react";

import type { ViewProjectionV2 } from "@landlord/shared";

import { CityView } from "../CityView";
import { BuildingThumbnail } from "./building-thumbnail";
import { HelpPopover, HelpTooltip } from "./help";
import { UiIcon } from "./icons";
import {
  auctionStatusLabel,
  buildingDisplayName,
  buildingStateLabel,
  constructionKindLabel,
  formatGameDate,
  formatGameDuration,
  formatMoney,
  insuranceCoverageLabel,
  insuranceStatusLabel,
  loanStatusLabel,
  maintenancePolicyLabel,
  ordinanceStatusLabel,
  organizationDisplayName,
  signedAmount,
  transactionLabel,
} from "./labels";
import type { Economy, GameActions, GameCalendar, HubKind, ProjectedParcel } from "./types";

const PLAYER = "org_00000001";

const MACRO_MODIFIER_LABELS: Record<string, string> = {
  materialCostModifierPercent: "materiales",
  rentModifierPercent: "rentas",
  vacancyModifierPercent: "presión de vacancia",
  constructionCostModifierPercent: "esfuerzo de obra",
  laborCostModifierPercent: "coste laboral",
  demandModifierPercent: "demanda de vivienda",
};

function macroModifierSummary(modifiers: Record<string, number | undefined>): string {
  return Object.entries(modifiers)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${MACRO_MODIFIER_LABELS[key] ?? "efecto"} ${value >= 0 ? "+" : "−"}${Math.abs(value)} %`,
    )
    .join(", ");
}

function municipalPlannedTotal(planned: Record<string, number>): number {
  return (
    (planned.administration ?? 0) +
    (planned.security ?? 0) +
    (planned.transport ?? 0) +
    (planned.cleaning ?? 0)
  );
}

export type HubProps = {
  economy: Economy;
  projection: ViewProjectionV2;
  calendar: GameCalendar;
  actions: GameActions;
  onClose: () => void;
  onOpenHub: (hub: HubKind) => void;
  onSelectDistrict: (districtId: string) => void;
};

const HUB_TITLES: Record<HubKind, string> = {
  government: "Gobierno municipal",
  finance: "Finanzas",
  portfolio: "Cartera",
  city: "Ciudad",
};

export function HubPanel({ hub, ...props }: HubProps & { hub: HubKind }) {
  return (
    <aside aria-label={HUB_TITLES[hub]} className="context-panel hub-panel">
      <header className="context-header">
        <div>
          <p className="eyebrow">Panel global</p>
          <h2>{HUB_TITLES[hub]}</h2>
          <p className="muted">{props.economy.district.name}</p>
        </div>
        <button
          aria-label="Cerrar panel"
          className="icon-button"
          onClick={props.onClose}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </header>
      <div className="context-body">
        {hub === "government" ? <GovernmentHub {...props} /> : null}
        {hub === "finance" ? <FinanceHub {...props} /> : null}
        {hub === "portfolio" ? <PortfolioHub {...props} /> : null}
        {hub === "city" ? <CityHub {...props} /> : null}
      </div>
    </aside>
  );
}

function GovernmentHub({ economy, calendar, actions, projection }: HubProps) {
  return (
    <>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="ordinance" /> Ordenanza vigente <HelpPopover topic="ordinance" />
          </h3>
          <span className="chip">{ordinanceStatusLabel(economy.ordinance.status)}</span>
        </header>
        <p className="entity-title">{economy.ordinance.name}</p>
        <p className="muted">
          Construcción {economy.ordinance.materialCostModifierPercent} % · renta{" "}
          {economy.ordinance.rentModifierPercent} % · propiedad{" "}
          {economy.ordinance.propertyTaxModifierPercent} % · permisos{" "}
          {economy.ordinance.permitApprovalModifierPercent} %.
          {economy.ordinance.status === "active"
            ? ` Aplicada hasta el ${formatGameDate(economy.ordinance.expiresAtTick ?? 0, calendar)}.`
            : ""}
        </p>
        {economy.ordinance.status === "proposed" ? (
          <p className="muted">
            Apoyo base {economy.ordinance.approvalChancePercent} % · influencia disponible{" "}
            {economy.influence}.
          </p>
        ) : null}
        <div className="button-row">
          <button
            disabled={economy.ordinance.status !== "proposed" || economy.influence < 1}
            onClick={() =>
              actions.lobbyPolicy(economy.ordinance.id, Math.min(2, economy.influence))
            }
            type="button"
          >
            <UiIcon name="influence" /> Promover con influencia
          </button>
          <button
            disabled={economy.ordinance.status !== "proposed"}
            onClick={() => actions.withdrawPolicy(economy.ordinance.id)}
            type="button"
          >
            Retirar propuesta
          </button>
        </div>
        {economy.ordinance.status !== "proposed" ? null : economy.influence < 1 ? (
          <p className="muted">No tienes influencia suficiente para apoyar la propuesta.</p>
        ) : null}
        <ul className="list-plain" role="list">
          {economy.policyOptions
            .filter((option) => option.id !== economy.ordinance.id)
            .map((option) => (
              <li key={option.id}>
                <button
                  disabled={["active", "proposed"].includes(economy.ordinance.status)}
                  onClick={() => actions.proposePolicy(option.id)}
                  type="button"
                >
                  <UiIcon name="ordinance" /> Proponer {option.name}
                </button>
                <span className="muted">
                  {" "}
                  materiales {option.materialCostModifierPercent} % · renta{" "}
                  {option.rentModifierPercent} % · permisos {option.permitApprovalModifierPercent} %
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="tax" /> Fiscalidad <HelpTooltip topic="taxes" />
          </h3>
        </header>
        <dl className="detail-grid">
          <div>
            <dt>Propiedad</dt>
            <dd>{economy.taxation.propertyRateBps / 100} % mensual</dd>
          </div>
          <div>
            <dt>Próxima liquidación</dt>
            <dd>{formatGameDate(economy.taxation.nextSettlementTick, calendar)}</dd>
          </div>
          <div>
            <dt>Previsión</dt>
            <dd>{economy.taxation.projectedMonthlyPropertyTax} u./mes</dd>
          </div>
          <div>
            <dt>Atrasos</dt>
            <dd>{economy.taxation.playerArrears} u.</dd>
          </div>
        </dl>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="money" /> Presupuesto municipal <HelpPopover topic="budget" />
          </h3>
        </header>
        <dl className="detail-grid">
          <div>
            <dt>Reservas</dt>
            <dd>{economy.municipal.reserve} u.</dd>
          </div>
          <div>
            <dt>Ingresos del mes</dt>
            <dd>
              {economy.municipal.revenueThisMonthBySource.propertyTax ?? 0} propiedad +{" "}
              {economy.municipal.revenueThisMonthBySource.transferTax ?? 0} transmisión
            </dd>
          </div>
          <div>
            <dt>Tasa de servicios</dt>
            <dd>{economy.municipal.serviceFeeDueNextSettlement} u. previstos</dd>
          </div>
          <div>
            <dt>Gasto planificado</dt>
            <dd>{municipalPlannedTotal(economy.municipal.plannedByCategory)} u.</dd>
          </div>
          <div>
            <dt>Meses en déficit</dt>
            <dd>{economy.municipal.deficitMonths}</dd>
          </div>
        </dl>
        <p className="muted">
          Nivel de servicio · administración{" "}
          {economy.municipal.serviceLevelPercentByCategory.administration ?? 100} % · seguridad{" "}
          {economy.municipal.serviceLevelPercentByCategory.security ?? 100} % · transporte{" "}
          {economy.municipal.serviceLevelPercentByCategory.transport ?? 100} % · limpieza{" "}
          {economy.municipal.serviceLevelPercentByCategory.cleaning ?? 100} %
        </p>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="services" /> Servicios municipales <HelpTooltip topic="services" />
          </h3>
        </header>
        <ul className="list-plain" role="list">
          {economy.urbanServices.map((service) => (
            <li key={service.id}>
              {service.id}: calidad {service.qualityPercent} % · radio {service.radiusCells} celdas
              · {service.buildingsCovered} edificios cubiertos · media {service.meanCoveragePercent}{" "}
              %
            </li>
          ))}
        </ul>
        <p className="muted">
          Programa del distrito: {projection.facilities.length} equipamientos y{" "}
          {projection.publicSpaces.length} espacios públicos.
        </p>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="government" /> Concejo municipal <HelpPopover topic="council" />
          </h3>
        </header>
        <p className="muted">
          Gobierna {economy.politics.governingPartyName} · participación{" "}
          {economy.politics.lastTurnoutPercent} % · {economy.politics.electionsHeld} elección(es).
        </p>
        <p className="muted">
          Próxima elección el {formatGameDate(economy.politics.nextElectionTick, calendar)}
          {economy.politics.nextDebateTick !== null
            ? ` · debate el ${formatGameDate(economy.politics.nextDebateTick, calendar)}`
            : " · sin debate programado"}
          .
        </p>
        <ul className="list-plain" role="list">
          {economy.politics.parties.map((party) => (
            <li key={party.id}>
              {party.name}: {party.seats} escaños · {party.supportPercent} % de apoyo
            </li>
          ))}
        </ul>
        <p className="muted">
          Ánimo del distrito · vivienda {economy.politics.moodByIssue.housing} · empleo{" "}
          {economy.politics.moodByIssue.employment} · seguridad{" "}
          {economy.politics.moodByIssue.safety} · servicios {economy.politics.moodByIssue.services}{" "}
          · impuestos {economy.politics.moodByIssue.taxes}
        </p>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="reputation" /> Reputación <HelpTooltip topic="reputation" />
          </h3>
        </header>
        <p className="muted">
          Vecinos {economy.reputation.standingByGroup.residents} · gobierno{" "}
          {economy.reputation.standingByGroup.municipality} · banca{" "}
          {economy.reputation.standingByGroup.banks}.
        </p>
        <p className="muted">
          La banca aplica {economy.reputation.bankRateModifierBps} puntos básicos al préstamo, los
          residentes valoran tu parque al {economy.reputation.residentFactorPercent} % y el gobierno
          te deja {economy.reputation.influenceGainPerMonth} de influencia al mes.
        </p>
      </section>

      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="contract" /> Contratos públicos <HelpPopover topic="public_contracts" />
          </h3>
        </header>
        <p className="muted">
          {economy.publicContracts.open.length} en curso ·{" "}
          {economy.publicContracts.reliability.completed} completados ·{" "}
          {economy.publicContracts.reliability.defaulted} incumplidos ·
          {economy.publicContracts.reliability.awarded} adjudicados a tu empresa.
        </p>
        {economy.publicContracts.open.length === 0 ? (
          <p className="muted">No hay licitaciones abiertas este mes.</p>
        ) : (
          <ul className="list-plain" role="list">
            {economy.publicContracts.open.map((contract) => (
              <li key={contract.id}>
                <ContractBidForm
                  action={(amount) => actions.submitPublicBid(contract.id, amount)}
                  cash={economy.cash}
                  contract={contract}
                  disabled={contract.status !== "open"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type ProjectedContract = Economy["publicContracts"]["open"][number];

function ContractBidForm({
  contract,
  cash,
  disabled,
  action,
}: {
  contract: ProjectedContract;
  cash: number;
  disabled: boolean;
  action: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(Math.ceil((contract.budget * 92) / 100)));
  const parsed = Number(amount);
  const valid = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= contract.budget;
  return (
    <div className="notice-card">
      <p>
        <strong>{contract.title}</strong> · presupuesto {contract.budget} u. · fianza{" "}
        {contract.bond} u. · {contract.bidCount} oferta(s)
        {contract.playerBid !== null ? ` · tu oferta ${contract.playerBid} u.` : ""}
      </p>
      {contract.status === "open" && contract.playerBid === null ? (
        <>
          <label className="field-row">
            <span>Importe de la oferta</span>
            <input
              max={contract.budget}
              min={1}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              value={amount}
            />
          </label>
          <button
            disabled={disabled || !valid || cash < contract.bond}
            onClick={() => action(parsed)}
            type="button"
          >
            <UiIcon name="contract" /> Presentar oferta · {valid ? parsed : "—"} u.
          </button>
          {!valid ? (
            <p className="muted">La oferta debe ser un entero entre 1 y {contract.budget} u.</p>
          ) : null}
          {cash < contract.bond ? (
            <p className="muted">La caja no cubre la fianza de {contract.bond} u.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function FinanceHub({ economy, calendar, actions }: HubProps) {
  return (
    <>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="finance" /> Posición <HelpPopover topic="debt" />
          </h3>
        </header>
        <dl className="detail-grid">
          <div>
            <dt>Caja</dt>
            <dd>{formatMoney(economy.cash)}</dd>
          </div>
          <div>
            <dt>Activos</dt>
            <dd>{formatMoney(economy.financials.assets)}</dd>
          </div>
          <div>
            <dt>Pasivos</dt>
            <dd>{formatMoney(economy.financials.liabilities)}</dd>
          </div>
          <div>
            <dt>Patrimonio</dt>
            <dd>{formatMoney(economy.financials.equity)}</dd>
          </div>
        </dl>
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="income" /> Mes actual
        </h3>
        <p className="muted">
          Ingresos {economy.financials.period.income} u. · gastos{" "}
          {economy.financials.period.expenses} u. · resultado{" "}
          {signedAmount(economy.financials.period.netIncome)}
        </p>
        <p className="muted">
          Previsión: {economy.financials.forecast.income} u. de ingresos ·{" "}
          {economy.financials.forecast.expenses} u. de gastos · cierre{" "}
          {economy.financials.forecast.closingCash} u.
          {economy.financials.forecast.shortfall > 0
            ? ` · faltan ${economy.financials.forecast.shortfall} u.`
            : ""}
        </p>
      </section>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="loan" /> Préstamos <HelpPopover topic="collateral" />
          </h3>
        </header>
        <ul className="list-plain" role="list">
          {economy.banking.offers.map((offer) => (
            <li key={offer.id} className="notice-card">
              <p>
                Oferta {offer.principal} u. · {offer.termMonths} meses ·{" "}
                {offer.annualInterestRateBps / 100} % anual · garantía: parcela propia
              </p>
              <button onClick={() => actions.acceptLoanOffer(offer.id)} type="button">
                Aceptar oferta
              </button>
            </li>
          ))}
          {economy.banking.loans.map((loan) => (
            <li key={loan.id}>
              {loanStatusLabel(loan.status)} · deuda {loan.outstandingPrincipal} u. · cuota{" "}
              {loan.monthlyPayment} u. · {loan.remainingMonths} meses restantes
              {loan.missedPayments > 0 ? ` · impagos: ${loan.missedPayments}` : ""}
            </li>
          ))}
          {economy.banking.offers.length === 0 && economy.banking.loans.length === 0 ? (
            <li className="muted">Sin préstamos ni ofertas activas.</li>
          ) : null}
        </ul>
        <p className="muted">
          Garantía respaldada por una parcela propia; el impago puede abrir subasta.
        </p>
        {(() => {
          const collateral = economy.parcels.find(
            (parcel) => parcel.ownerOrganizationId === PLAYER && parcel.buildingIds.length === 0,
          );
          if (!collateral) return null;
          return (
            <button
              className="secondary-action"
              onClick={() => actions.requestLoan(600, 12, collateral.id)}
              type="button"
            >
              <UiIcon name="loan" /> Solicitar 600 u. a 12 meses
            </button>
          );
        })()}
      </section>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="auction" /> Subastas <HelpTooltip topic="auction" />
          </h3>
        </header>
        <ul className="list-plain" role="list">
          {economy.banking.auctions.map((auction) => {
            const bid = Math.max(auction.reservePrice, auction.highestBid + 1);
            const parcel = economy.parcels.find((entry) => entry.id === auction.collateralParcelId);
            return (
              <li key={auction.loanId} className="notice-card">
                <p>
                  {auctionStatusLabel(auction.status)} ·{" "}
                  {parcel
                    ? `solar de ${parcel.zoning === "industrial" ? "uso industrial" : "uso urbano"}`
                    : "garantía"}{" "}
                  · reserva {auction.reservePrice} u. · puja actual {auction.highestBid} u.
                </p>
                {auction.status !== "open" ? null : auction.sellerOrganizationId === PLAYER ? (
                  <button
                    onClick={() => actions.requestRefinancing(auction.loanId, 12)}
                    type="button"
                  >
                    Refinanciar a 12 meses
                  </button>
                ) : auction.highestBidderOrganizationId === PLAYER ? (
                  <button onClick={() => actions.withdrawAuctionBid(auction.loanId)} type="button">
                    <UiIcon name="auction" /> Retirar puja
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
              </li>
            );
          })}
          {economy.banking.auctions.length === 0 ? (
            <li className="muted">No hay subastas activas.</li>
          ) : null}
        </ul>
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="portfolio" /> Libro de caja
        </h3>
        <ul className="list-plain ledger" role="list">
          {economy.recentTransactions.map((transaction, index) => (
            <li key={`${transaction.tick}-${transaction.cause}-${index}`}>
              {formatGameDate(transaction.tick, calendar)} · {transactionLabel(transaction.cause)} ·{" "}
              {transaction.direction === "credit" ? "+" : "−"}
              {transaction.amount} u.
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function PortfolioHub({ economy, calendar, actions }: HubProps) {
  const owned = economy.buildings.filter((building) => building.ownerOrganizationId === PLAYER);
  const sites = economy.constructionSites.filter((site) => site.ownerOrganizationId === PLAYER);
  const ownedParcels = economy.parcels.filter((parcel) => parcel.ownerOrganizationId === PLAYER);
  return (
    <>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="portfolio" /> Activos <HelpPopover topic="portfolio" />
          </h3>
          <span className="chip">{owned.length} edificios</span>
        </header>
        {owned.length === 0 ? (
          <p className="muted">Todavía no tienes edificios.</p>
        ) : (
          <ul className="asset-list" role="list">
            {owned.map((building) => {
              const occupied = building.tenantIds.length;
              return (
                <li key={building.id}>
                  <BuildingThumbnail size={40} type={building.type} />
                  <span className="asset-body">
                    <strong>{buildingDisplayName(building.type)}</strong>
                    <span className="muted">
                      {buildingStateLabel(building.state)} · ocupación {occupied}/
                      {building.capacity} · condición {building.condition} %
                    </span>
                  </span>
                  <span className="asset-numbers">
                    <span>{building.effectiveRent} u./plaza</span>
                    <span className="muted">{building.maintenanceDue} u. pendientes</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {sites.length > 0 ? (
          <p className="muted">
            {sites.length} obra(s) en curso · {ownedParcels.length} parcelas propias
          </p>
        ) : (
          <p className="muted">{ownedParcels.length} parcelas propias</p>
        )}
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="insurance" /> Seguros
        </h3>
        <ul className="list-plain" role="list">
          {economy.insurance.contracts
            .filter((contract) => contract.status === "active")
            .map((contract) => (
              <li key={contract.buildingId}>
                {insuranceCoverageLabel(contract.coverage)} · prima {contract.premium} u./mes ·
                límite {contract.coverageLimit} u.
              </li>
            ))}
          {economy.insurance.contracts.filter((contract) => contract.status === "active").length ===
          0 ? (
            <li className="muted">Sin pólizas activas.</li>
          ) : null}
        </ul>
        {economy.insurance.contracts.some((contract) => contract.status !== "active") ? (
          <p className="muted">
            {economy.insurance.contracts
              .filter((contract) => contract.status !== "active")
              .map((contract) => insuranceStatusLabel(contract.status))
              .join(" · ")}
          </p>
        ) : null}
      </section>
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="maintenance" /> Mantenimiento y automatización
          </h3>
        </header>
        <p className="muted">
          Política {maintenancePolicyLabel(economy.maintenance.policy)} · próxima liquidación el{" "}
          {formatGameDate(economy.maintenance.nextSettlementTick, calendar)} · carga{" "}
          {economy.maintenance.monthlyCost} u. · backlog {economy.maintenance.backlog} u.
        </p>
        <div className="button-row">
          <button
            onClick={() =>
              actions.setMaintenancePolicy(
                economy.maintenance.policy === "balanced" ? "deferred" : "balanced",
              )
            }
            type="button"
          >
            <UiIcon name="maintenance" /> Cambiar a{" "}
            {economy.maintenance.policy === "balanced" ? "diferida" : "equilibrada"}
          </button>
          <button
            onClick={() =>
              actions.setAutomationPolicy({
                property:
                  economy.automation.policies.property === "manual" ? "fill_vacancies" : "manual",
              })
            }
            type="button"
          >
            <UiIcon name="automation" />{" "}
            {economy.automation.policies.property === "manual"
              ? "Activar gestor de propiedad"
              : "Desactivar gestor de propiedad"}
          </button>
          <button
            onClick={() =>
              actions.setAutomationPolicy({
                finance:
                  economy.automation.policies.finance === "manual" ? "cover_shortfall" : "manual",
              })
            }
            type="button"
          >
            <UiIcon name="automation" />{" "}
            {economy.automation.policies.finance === "manual"
              ? "Activar gestor financiero"
              : "Desactivar gestor financiero"}
          </button>
          <button
            onClick={() =>
              actions.setAutomationPolicy({
                maintenanceRepairThreshold:
                  economy.automation.policies.maintenanceRepairThreshold === null ? 40 : null,
              })
            }
            type="button"
          >
            <UiIcon name="automation" />{" "}
            {economy.automation.policies.maintenanceRepairThreshold === null
              ? "Reparar bajo 40 %"
              : "Desactivar reparación automática"}
          </button>
          <button onClick={() => actions.runPortfolioRoutine()} type="button">
            <UiIcon name="crew" /> Resolver rutina
          </button>
        </div>
        <p className="muted">
          Automatización · propiedad{" "}
          {economy.automation.policies.property === "manual" ? "manual" : "gestor de vacantes"} ·
          finanzas {economy.automation.policies.finance === "manual" ? "manual" : "cubre la caja"} ·
          rutina {economy.automation.routineTaskCount} tarea(s) detectada(s).
        </p>
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="warning" /> Excepciones
        </h3>
        <ul className="list-plain" role="list">
          {economy.alerts.length === 0 ? (
            <li className="muted">Sin excepciones prioritarias.</li>
          ) : (
            economy.alerts.map((alert) => (
              <li key={alert.id}>
                {alert.severity === "high"
                  ? "Urgente"
                  : alert.severity === "medium"
                    ? "Importante"
                    : "Informativa"}
                {" · "}
                {alert.kind === "maintenance"
                  ? "mantenimiento"
                  : alert.kind === "occupancy"
                    ? "ocupación"
                    : alert.kind === "permit"
                      ? "permiso"
                      : alert.kind === "auction"
                        ? "subasta"
                        : alert.kind === "debt"
                          ? "deuda"
                          : "liquidez"}
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}

function CityHub({ economy, projection, calendar, actions, onSelectDistrict }: HubProps) {
  return (
    <>
      <CityView
        districts={projection.city.districts}
        observedDistrictId={projection.observedDistrictId}
        onSelect={onSelectDistrict}
      />
      <section className="panel-section">
        <header className="section-heading">
          <h3>
            <UiIcon name="rival" /> Competencia <HelpPopover topic="intelligence" />
          </h3>
        </header>
        <p className="muted">
          Rival: {economy.rival.parcels} parcelas · {economy.rival.buildings} edificios ·{" "}
          {economy.rival.occupiedBuildings} ocupados. Su caja, contratos e intención no son
          observables.
        </p>
        <p className="muted">
          Encargo: {economy.intelligence.commissionCost} u. · disponible{" "}
          {economy.intelligence.cooldownRemainingTicks > 0
            ? `en ${formatGameDuration(economy.intelligence.cooldownRemainingTicks, calendar)}`
            : "ahora"}
          .
        </p>
        <ul className="list-plain" role="list">
          {economy.intelligence.kinds.map((entry) => (
            <li key={entry.kind}>
              <button
                disabled={
                  economy.intelligence.cooldownRemainingTicks > 0 ||
                  economy.cash < economy.intelligence.commissionCost
                }
                onClick={() => actions.commissionIntelligence("org_00000002", entry.kind)}
                type="button"
              >
                <UiIcon name="intelligence" /> Investigar {entry.label} ·{" "}
                {economy.intelligence.commissionCost} u.
              </button>
            </li>
          ))}
        </ul>
        {economy.intelligence.estimates.length === 0 ? (
          <p className="muted">El expediente está vacío.</p>
        ) : (
          <ul className="list-plain" role="list">
            {economy.intelligence.estimates.map((estimate) => (
              <li key={estimate.id}>
                {estimate.label}: {estimate.value} u. · {estimate.effectiveAccuracyPercent} % de
                acierto · {estimate.ageMonths} meses de antigüedad
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="calendar" /> Clima económico <HelpPopover topic="macro_climate" />
        </h3>
        <p className="muted">
          {economy.macroEvents.active.length === 0
            ? `Sin eventos activos · próximo sorteo el ${formatGameDate(economy.macroEvents.nextCheckTick, calendar)}`
            : economy.macroEvents.active
                .map(
                  (event) =>
                    `${event.label} (intensidad ${Math.round(event.intensity * 100)} % · hasta el ${formatGameDate(event.endTick, calendar)})`,
                )
                .join(" · ")}
        </p>
        {economy.macroEvents.active.length > 0 &&
        Object.keys(economy.macroEvents.aggregatedModifiers).length > 0 ? (
          <p className="muted">
            Efectos: {macroModifierSummary(economy.macroEvents.aggregatedModifiers)}
          </p>
        ) : null}
      </section>
      <section className="panel-section">
        <h3>
          <UiIcon name="tenants" /> Empleo y vivienda <HelpTooltip topic="housing_market" />
        </h3>
        <p className="muted">
          {economy.employment.jobs} puestos · {economy.employment.workers} trabajadores · paro{" "}
          {100 - economy.employment.employmentRatePercent} % · salario índice{" "}
          {economy.employment.salaryIndexPercent} %
        </p>
        <p className="muted">
          Vacancia patio {economy.housingMarket.vacancyPercentByBuildingType.courtyard_home ?? 0} %
          · taller {economy.housingMarket.vacancyPercentByBuildingType.workshop ?? 0} % ·{" "}
          {economy.housingMarket.arrivalsTotal} llegadas y {economy.housingMarket.departuresTotal}{" "}
          salidas
        </p>
        <ul className="list-plain" role="list">
          {economy.housingMarket.segments.map((segment) => (
            <li key={segment.id}>
              {segment.label}: {segment.population}/{segment.populationCap} hogares · atractivo{" "}
              {segment.appealPercent} % · {segment.vacantSlots} plazas vacantes
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
