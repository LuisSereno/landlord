import { useEffect, useId, useState } from "react";

import type { GameSession } from "../session/use-game-session";
import { HelpTooltip, helpCatalog, type HelpTopicKey } from "./help";
import { ResourceIcon, UiIcon, type UiIconName } from "./icons";
import { formatGameDate, formatMoney } from "./labels";
import {
  OVERLAY_GROUPS,
  OVERLAY_OPTIONS,
  overlayOption,
  type MapOverlay,
  type OverlayGroupId,
} from "./overlay-catalog";
import type { OnboardingAction, OnboardingStep } from "./onboarding";
import {
  groupNotifications,
  notificationCategoryTitle,
  unreadCount,
  type GameNotification,
} from "./notifications";
import type { HubKind } from "./types";

/**
 * V.d-UX · HUD superior compacto (spec §5.2). Sólo estado de consulta frecuente y accesos
 * globales; el detalle vive en el panel contextual o en los hubs. El mapa ocupa el resto.
 */
export function GameHud({
  session,
  districtName,
  unread,
  onOpenHub,
  onOpenCity,
  onToggleNotifications,
  onToggleHelp,
  debug,
  onToggleDebug,
  notificationsOpen,
  helpOpen,
}: {
  session: GameSession;
  districtName: string;
  unread: number;
  onOpenHub: (hub: HubKind) => void;
  onOpenCity: () => void;
  onToggleNotifications: () => void;
  onToggleHelp: () => void;
  debug: boolean;
  onToggleDebug: () => void;
  notificationsOpen: boolean;
  helpOpen: boolean;
}) {
  const { economy, projection, runState, speed, message } = session;
  const calendar = economy?.gameTime;
  return (
    <>
      <header className="hud">
        <div className="hud-left">
          <span className="hud-brand">
            <UiIcon name="city" size={20} /> Landlord
          </span>
          <button className="hud-district" onClick={onOpenCity} type="button">
            <UiIcon name="navigate" size={14} /> {districtName}
          </button>
        </div>
        <div className="hud-metrics" aria-label="Estado de la empresa">
          <button
            aria-label="Abrir Finanzas"
            className="metric-chip metric-chip-button"
            onClick={() => onOpenHub("finance")}
            type="button"
          >
            <UiIcon name="money" size={15} />
            <span className="metric-label">Caja</span>
            <span className="metric-value">{economy ? formatMoney(economy.cash) : "—"}</span>
          </button>
          <span className="metric-chip">
            <UiIcon name="calendar" size={15} />
            <span className="metric-label">Fecha</span>
            <span className="metric-value">
              {calendar && projection
                ? `${formatGameDate(projection.tick, calendar)} · ${String(calendar.hour).padStart(2, "0")}:00`
                : "—"}
            </span>
          </span>
          <span className="metric-chip resource-chip" title="Materiales">
            {(["cement", "brick", "steel"] as const).map((resource) => (
              <span className="resource-inline" key={resource}>
                <ResourceIcon resource={resource} size={14} />
                <span className="metric-value">{economy ? economy.inventory[resource] : "—"}</span>
              </span>
            ))}
          </span>
          <span className="metric-chip">
            <UiIcon name="crew" size={15} />
            <span className="metric-label">Cuadrilla</span>
            <span className="metric-value">
              {economy ? `${economy.crew.used}/${economy.crew.capacity}` : "—"}
            </span>
          </span>
        </div>
        <div className="hud-controls">
          <button
            aria-label="Abrir Gobierno"
            className="hud-text-button"
            onClick={() => onOpenHub("government")}
            type="button"
          >
            <UiIcon name="government" size={15} /> Gobierno
          </button>
          <button
            aria-label="Abrir Finanzas"
            className="hud-text-button"
            onClick={() => onOpenHub("finance")}
            type="button"
          >
            <UiIcon name="finance" size={15} /> Finanzas
          </button>
          <button
            aria-label="Abrir Cartera"
            className="hud-text-button"
            onClick={() => onOpenHub("portfolio")}
            type="button"
          >
            <UiIcon name="portfolio" size={15} /> Cartera
          </button>
          <button
            aria-label={runState === "running" ? "Pausar simulación" : "Continuar simulación"}
            aria-pressed={runState === "running"}
            className="icon-button"
            disabled={!session.client}
            onClick={() => void session.toggleRunState()}
            type="button"
          >
            <UiIcon name={runState === "running" ? "pause" : "play"} size={16} />
          </button>
          {([1, 2, 4] as const).map((value) => (
            <button
              aria-pressed={speed === value}
              className="speed-button"
              disabled={!session.client}
              key={value}
              onClick={() => void session.changeSpeed(value)}
              type="button"
            >
              {value}×
            </button>
          ))}
          <button
            aria-expanded={notificationsOpen}
            aria-label={`Notificaciones${unread > 0 ? `: ${unread} sin leer` : ""}`}
            className="icon-button bell-button"
            onClick={onToggleNotifications}
            type="button"
          >
            <UiIcon name="notifications" size={17} />
            {unread > 0 ? <span className="bell-count">{unread}</span> : null}
          </button>
          <button
            aria-expanded={helpOpen}
            aria-label="Abrir ayuda"
            className="icon-button"
            onClick={onToggleHelp}
            type="button"
          >
            <UiIcon name="help" size={17} />
          </button>
          <button
            className="hud-text-button"
            disabled={!session.client}
            onClick={() => void session.saveSnapshot()}
            type="button"
          >
            <UiIcon name="save" size={15} /> Guardar
          </button>
          <button
            className="hud-text-button"
            disabled={!session.client}
            onClick={() => void session.loadSnapshot()}
            type="button"
          >
            <UiIcon name="load" size={15} /> Cargar
          </button>
          {debug ? (
            <>
              <a className="hud-text-button" href="/art-lab">
                Art Lab
              </a>
              <button
                aria-pressed={helpOpen}
                className="hud-text-button"
                onClick={onToggleDebug}
                type="button"
              >
                <UiIcon name="info" size={15} /> Debug
              </button>
            </>
          ) : null}
        </div>
      </header>
      <p className="status-strip" role="status">
        {message}
      </p>
    </>
  );
}

/**
 * V.d-UX · toolbar de capas (spec §14). Grupos con icono y etiqueta, opciones con estado
 * `aria-pressed` y leyenda cuando el color tiene significado; salida explícita a vista normal.
 */
export function OverlayToolbar({
  overlay,
  onChange,
}: {
  overlay: MapOverlay;
  onChange: (overlay: MapOverlay) => void;
}) {
  const [openGroup, setOpenGroup] = useState<OverlayGroupId | null>(null);
  const active = overlayOption(overlay);
  return (
    <div className="overlay-toolbar" role="toolbar" aria-label="Capas del mapa">
      <button
        aria-pressed={overlay === "none"}
        className="overlay-normal"
        onClick={() => {
          setOpenGroup(null);
          onChange("none");
        }}
        type="button"
      >
        <UiIcon name="navigate" size={15} /> Vista normal
      </button>
      <div className="overlay-groups">
        {OVERLAY_GROUPS.map((group) => {
          const groupOptions = OVERLAY_OPTIONS.filter((option) => option.group === group.id);
          const isActive = active.group === group.id && overlay !== "none";
          const expanded = openGroup === group.id;
          return (
            <div className="overlay-group" key={group.id}>
              <button
                aria-expanded={expanded}
                aria-pressed={isActive}
                className="overlay-group-button"
                onClick={() => setOpenGroup(expanded ? null : group.id)}
                type="button"
              >
                <UiIcon
                  name={
                    (
                      {
                        ownership: "ownership",
                        value: "land-value",
                        use: "zoning",
                        services: "services",
                        risk: "risk",
                      } as Record<OverlayGroupId, UiIconName>
                    )[group.id]
                  }
                  size={15}
                />
                {group.label}
              </button>
              {expanded ? (
                <div className="overlay-menu" role="group" aria-label={`Capas de ${group.label}`}>
                  {groupOptions.map((option) => (
                    <button
                      aria-pressed={overlay === option.value}
                      className="overlay-option"
                      key={option.value}
                      onClick={() => {
                        onChange(option.value);
                        setOpenGroup(null);
                      }}
                      title={option.description}
                      type="button"
                    >
                      <UiIcon name={option.icon} size={15} /> {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {active.legend.length > 0 ? (
        <div className="overlay-legend" aria-label={`Leyenda de ${active.label}`}>
          <span className="overlay-legend-title">{active.label}</span>
          {active.legend.map((entry) => (
            <span className="legend-entry" key={entry.label}>
              <span
                aria-hidden="true"
                className="legend-swatch"
                style={{ background: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Campana: historial agrupado, no leídas y navegación al origen (spec §8). */
export function NotificationCenter({
  notifications,
  read,
  onClose,
  onNavigate,
  onMarkAllRead,
}: {
  notifications: GameNotification[];
  read: ReadonlySet<string>;
  onClose: () => void;
  onNavigate: (notification: GameNotification) => void;
  onMarkAllRead: () => void;
}) {
  const unread = unreadCount(notifications, read);
  const groups = groupNotifications(notifications);
  return (
    <aside aria-label="Centro de notificaciones" className="notification-panel">
      <header className="context-header">
        <div>
          <p className="eyebrow">Notificaciones</p>
          <h2>{unread > 0 ? `${unread} sin leer` : "Todo al día"}</h2>
        </div>
        <button
          aria-label="Cerrar notificaciones"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </header>
      <div className="context-body">
        {notifications.length === 0 ? (
          <p className="muted">No hay avisos: la ciudad no tiene excepciones pendientes.</p>
        ) : (
          <>
            <button className="secondary-action" onClick={onMarkAllRead} type="button">
              <UiIcon name="success" size={14} /> Marcar todo como leído
            </button>
            {groups.map((group) => (
              <section className="notification-group" key={group.category}>
                <h3>{notificationCategoryTitle(group.category)}</h3>
                <ul role="list" className="list-plain">
                  {group.entries.map((entry) => (
                    <li
                      className={read.has(entry.id) ? "notification read" : "notification unread"}
                      key={entry.id}
                    >
                      <span className="notification-body">
                        <strong>{entry.title}</strong>
                        <span className="muted">{entry.body}</span>
                      </span>
                      {entry.actionLabel ? (
                        <button onClick={() => onNavigate(entry)} type="button">
                          <UiIcon name="navigate" size={13} /> {entry.actionLabel}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

const HELP_TOPICS: HelpTopicKey[] = [
  "first_steps",
  "construction",
  "crew",
  "land_value",
  "services",
  "profitability",
  "debt",
  "insurance",
  "maintenance",
  "ordinance",
  "council",
  "overlays",
];

/** Ayuda general del shell: la misma fuente que los tooltips, sin párrafos duplicados. */
export function HelpMenu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside aria-label="Ayuda" className="help-panel">
      <header className="context-header">
        <div>
          <p className="eyebrow">Ayuda</p>
          <h2>Cómo funciona la ciudad</h2>
        </div>
        <button aria-label="Cerrar ayuda" className="icon-button" onClick={onClose} type="button">
          <UiIcon name="close" size={16} />
        </button>
      </header>
      <div className="context-body">
        <ul className="help-index" role="list">
          {HELP_TOPICS.map((topic) => (
            <li key={topic}>
              <strong>{helpCatalog[topic].title}</strong>
              <p className="muted">{helpCatalog[topic].summary}</p>
            </li>
          ))}
        </ul>
        <p className="muted">
          Pasa el ratón o enfoca con el teclado cualquier icono <UiIcon name="help" size={12} />{" "}
          para ver la explicación de esa métrica.
        </p>
      </div>
    </aside>
  );
}

/**
 * V.d-UX · onboarding contextual (spec §12). Una tarjeta con el siguiente paso real; se oculta
 * sin crear misiones ni estado autoritativo.
 */
export function OnboardingBanner({
  step,
  onAction,
  onDismiss,
}: {
  step: OnboardingStep;
  onAction: (action: OnboardingAction | null) => void;
  onDismiss: () => void;
}) {
  const id = useId();
  return (
    <aside aria-labelledby={id} className="onboarding-card">
      <div className="onboarding-head">
        <span className="eyebrow">Siguiente paso</span>
        <button
          aria-label="Ocultar sugerencia"
          className="icon-button"
          onClick={onDismiss}
          type="button"
        >
          <UiIcon name="close" size={13} />
        </button>
      </div>
      <p className="entity-title" id={id}>
        {step.title}
      </p>
      <p className="muted">{step.body}</p>
      {step.missing.length > 0 ? (
        <ul className="material-needs" role="list">
          {step.missing.map((entry) => (
            <li key={entry.resource}>
              <ResourceIcon resource={entry.resource} showLabel />
              <span className="muted">faltan {entry.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="button-row">
        {step.actionLabel && step.action ? (
          <button className="primary-action" onClick={() => onAction(step.action)} type="button">
            {step.actionLabel}
          </button>
        ) : null}
        <button className="secondary-action" onClick={onDismiss} type="button">
          Ahora no
        </button>
      </div>
    </aside>
  );
}

/** Diagnóstico técnico: sólo con `?debug=1` (spec §22.6). */
export function DebugPanel({ session, onClose }: { session: GameSession; onClose: () => void }) {
  return (
    <aside aria-label="Diagnóstico" className="debug-panel">
      <header className="context-header">
        <div>
          <p className="eyebrow">Modo desarrollo</p>
          <h2>Diagnóstico</h2>
        </div>
        <button
          aria-label="Cerrar diagnóstico"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </header>
      <div className="context-body">
        {session.latestMetrics ? (
          <p className="muted">
            Tick {session.latestMetrics.tick} · cola {session.latestMetrics.pendingCommands} ·
            aceptados {session.latestMetrics.acceptedCommands}
          </p>
        ) : null}
        <ol className="diagnostic-log">
          {session.diagnostics
            .slice(-12)
            .reverse()
            .map((entry) => (
              <li key={entry.id}>
                [{entry.level}] {entry.message}
              </li>
            ))}
        </ol>
        <button onClick={session.clearDiagnostics} type="button">
          Limpiar
        </button>
      </div>
    </aside>
  );
}

export { HelpTooltip };
