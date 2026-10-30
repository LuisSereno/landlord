import { useState } from "react";

import type { BuildingType } from "@landlord/shared";

import { BuildingThumbnail } from "./building-thumbnail";
import { constructionBlockedReasons, reasonSummary } from "./disabled-reasons";
import { HelpPopover, HelpTooltip } from "./help";
import { ResourceIcon, UiIcon } from "./icons";
import { buildingTypeLabel, formatGameDuration, resourceLabel } from "./labels";
import type { Economy, GameActions, GameCalendar, ProjectedParcel } from "./types";

/**
 * V.d-UX · catálogo de construcción visual (spec §7.3). Tarjetas con miniatura del asset real,
 * coste y función; el detalle explica materiales, capacidad/producción y el motivo exacto de
 * bloqueo. La elegibilidad la fija el motor (`permittedBuildingTypes`, inventario, caja y
 * cuadrillas proyectadas); aquí sólo se explica.
 */
type CategoryId = "housing" | "mixed" | "industry" | "production";

const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: "housing", label: "Vivienda" },
  { id: "mixed", label: "Comercio y mixto" },
  { id: "industry", label: "Industria y logística" },
  { id: "production", label: "Producción" },
];

export const CATEGORY_BY_TYPE: Record<string, CategoryId> = {
  courtyard_home: "housing",
  row_house: "housing",
  apartment_block: "housing",
  workshop: "mixed",
  mixed_tenement: "mixed",
  warehouse: "industry",
  cement_plant: "production",
  brickworks: "production",
  steelworks: "production",
};

/** Agrupa las opciones por categoría real del catálogo; ninguna tarjeta queda fuera. */
export function groupConstructionOptions(
  options: Economy["constructionOptions"],
): Array<{ id: CategoryId; label: string; options: Economy["constructionOptions"] }> {
  return CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    options: options.filter((option) => CATEGORY_BY_TYPE[option.type] === category.id),
  })).filter((group) => group.options.length > 0);
}

export function BuildCatalog({
  economy,
  parcel,
  calendar,
  actions,
}: {
  economy: Economy;
  parcel: ProjectedParcel;
  calendar: GameCalendar;
  actions: GameActions;
}) {
  const [selected, setSelected] = useState<BuildingType | null>(null);
  const eligible = economy.constructionOptions
    .filter((option) => !option.municipal && parcel.permittedBuildingTypes.includes(option.type))
    .sort((left, right) => left.cost - right.cost);
  if (eligible.length === 0)
    return (
      <p className="empty-state">Este solar no admite ningún proyecto con el código actual.</p>
    );
  const selectedOption = eligible.find((option) => option.type === selected) ?? null;

  return (
    <section aria-label="Catálogo de construcción" className="build-catalog">
      <header className="section-heading">
        <h3>
          <UiIcon name="construction" /> Qué construir
        </h3>
        <HelpPopover topic="construction" />
      </header>
      {CATEGORIES.map((category) => {
        const options = eligible.filter((option) => CATEGORY_BY_TYPE[option.type] === category.id);
        if (options.length === 0) return null;
        return (
          <div className="build-category" key={category.id}>
            <p className="eyebrow">{category.label}</p>
            <div className="build-grid" role="list">
              {options.map((option) => {
                const reasons = constructionBlockedReasons({
                  option,
                  economy,
                  parcelOwned: true,
                  hasBuilding: parcel.buildingIds.length > 0,
                  permitted: parcel.permittedBuildingTypes.includes(option.type),
                });
                const disabled = reasons.length > 0;
                return (
                  <button
                    aria-pressed={selected === option.type}
                    className="construction-option build-card"
                    key={option.type}
                    onClick={() => setSelected(option.type)}
                    role="listitem"
                    type="button"
                  >
                    <BuildingThumbnail size={56} type={option.type} />
                    <span className="build-card-body">
                      <strong>{buildingTypeLabel(option.type)}</strong>
                      <span className="build-card-cost">
                        <UiIcon name="money" size={14} /> {option.cost} u.
                      </span>
                      <span className="build-card-function">
                        {option.production
                          ? `Produce ${resourceLabel(option.production.output)}`
                          : option.capacity > 0
                            ? `${option.capacity} plazas · renta ${option.baseRent} u.`
                            : "Almacenamiento sin plazas de alquiler"}
                      </span>
                      {disabled ? (
                        <span className="build-card-blocked">
                          <UiIcon name="warning" size={13} /> {reasonSummary(reasons)}
                        </span>
                      ) : (
                        <span className="build-card-ready">
                          <UiIcon name="success" size={13} /> Disponible
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {selectedOption ? (
        <BuildDetail
          actions={actions}
          calendar={calendar}
          economy={economy}
          onClose={() => setSelected(null)}
          option={selectedOption}
          parcel={parcel}
        />
      ) : null}
    </section>
  );
}

function BuildDetail({
  option,
  economy,
  parcel,
  calendar,
  actions,
  onClose,
}: {
  option: Economy["constructionOptions"][number];
  economy: Economy;
  parcel: ProjectedParcel;
  calendar: GameCalendar;
  actions: GameActions;
  onClose: () => void;
}) {
  const reasons = constructionBlockedReasons({
    option,
    economy,
    parcelOwned: true,
    hasBuilding: parcel.buildingIds.length > 0,
    permitted: parcel.permittedBuildingTypes.includes(option.type),
  });
  return (
    <div
      aria-label={`Detalle de ${buildingTypeLabel(option.type)}`}
      className="build-detail"
      role="group"
    >
      <header className="section-heading">
        <h4>
          <BuildingThumbnail size={44} type={option.type} /> {buildingTypeLabel(option.type)}
        </h4>
        <button aria-label="Cerrar detalle" className="icon-button" onClick={onClose} type="button">
          <UiIcon name="close" size={14} />
        </button>
      </header>
      <p className="muted">
        {option.production
          ? `Produce ${resourceLabel(option.production.output)} para tus obras y para el mercado.`
          : `${option.capacity} plazas de alquiler; renta base ${option.baseRent} u. por plaza y mes.`}
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Caja</dt>
          <dd>
            {option.cost} u.{option.cost !== option.baseCost ? ` (base ${option.baseCost})` : ""}
          </dd>
        </div>
        <div>
          <dt>Trabajo</dt>
          <dd>
            {formatGameDuration((option.workRequired * calendar.ticksPerDay) / 24, calendar)} de
            obra
          </dd>
        </div>
        <div>
          <dt>Materiales</dt>
          <dd className="resource-list">
            {(["cement", "brick", "steel"] as const).map((resource) => (
              <span
                className={
                  option.resources[resource] > economy.inventory[resource] ? "resource-missing" : ""
                }
                key={resource}
              >
                <ResourceIcon resource={resource} size={14} />
                {option.resources[resource]}
              </span>
            ))}
          </dd>
        </div>
        {option.production ? (
          <div>
            <dt>Producción</dt>
            <dd>
              +{option.production.outputAmount} cada {option.production.cycleLength} h · coste{" "}
              {option.production.operatingCost} u.
            </dd>
          </div>
        ) : (
          <div>
            <dt>Renta</dt>
            <dd>{option.baseRent} u. por plaza y mes</dd>
          </div>
        )}
        <div>
          <dt>Usos</dt>
          <dd>{option.allowedUses.length} uso(s) compatibles con el código</dd>
        </div>
        <div>
          <dt>Mejora</dt>
          <dd>
            {option.upgradeCost} u. ·{" "}
            {option.production ? "producción +25 %" : `renta +${option.upgradeRentBonusPercent} %`}
          </dd>
        </div>
      </dl>
      {reasons.length > 0 ? (
        <ul className="blocked-reasons" role="list">
          {reasons.map((reason) => (
            <li key={reason.code}>
              <UiIcon name="warning" size={14} /> {reason.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="positive-note">
          <UiIcon name="success" size={14} /> Todo listo para empezar.
        </p>
      )}
      <button
        className="primary-action"
        disabled={reasons.length > 0 || economy.cash < option.cost}
        onClick={() => actions.startConstruction(parcel.id, option.type)}
        type="button"
      >
        <UiIcon name="construction" /> Construir
      </button>
      <p className="muted">
        <HelpTooltip topic="crew" /> Una cuadrilla libre debe quedar asignada para que la obra
        avance.
      </p>
    </div>
  );
}
