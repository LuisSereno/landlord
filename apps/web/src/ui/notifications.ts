import type { Economy, HubKind } from "./types";
import { buildingTypeLabel, urbanRoleLabel } from "./labels";

/**
 * V.d-UX · notificaciones derivadas de las alertas que ya produce el motor (spec §8). No se crean
 * eventos nuevos: se categoriza, se traduce y se resuelve un destino navegable. El estado
 * leída/no leída vive en la UI y no toca la simulación.
 */
export type NotificationCategory =
  "urgent" | "finances" | "properties" | "production" | "government" | "competition" | "info";

export type NotificationTarget =
  { kind: "parcel"; parcelId: string } | { kind: "hub"; hub: HubKind } | { kind: "none" };

export type GameNotification = {
  id: string;
  category: NotificationCategory;
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  target: NotificationTarget;
  actionLabel: string | null;
};

const KIND_TITLES: Record<Economy["alerts"][number]["kind"], string> = {
  liquidity: "Previsión de caja",
  debt: "Deuda",
  maintenance: "Mantenimiento",
  permit: "Permiso",
  auction: "Subasta",
  occupancy: "Plazas vacantes",
};

const CATEGORY_TITLES: Record<NotificationCategory, string> = {
  urgent: "Urgente",
  finances: "Finanzas",
  properties: "Propiedades",
  production: "Producción",
  government: "Gobierno",
  competition: "Competencia",
  info: "Información",
};

export function notificationCategoryTitle(category: NotificationCategory): string {
  return CATEGORY_TITLES[category];
}

function categoryFor(
  kind: Economy["alerts"][number]["kind"],
  severity: "high" | "medium" | "low",
): NotificationCategory {
  if (severity === "high") return "urgent";
  return {
    liquidity: "finances",
    debt: "finances",
    auction: "finances",
    maintenance: "properties",
    permit: "properties",
    occupancy: "properties",
  }[kind] as NotificationCategory;
}

/**
 * Las alertas del motor mencionan ids técnicos dentro del texto (`building_...`, `parcel_...`).
 * La presentación los sustituye por el nombre legible usando la propia proyección; si un id no
 * se puede resolver, se retira el token en lugar de enseñarlo (spec §11.2).
 */
export function sanitizeAlertMessage(message: string, economy: Economy | undefined): string {
  return message
    .replace(/\b(building|parcel|loan|crew|org|facility|contract)_\d+\b/g, (token) => {
      if (!economy) return "";
      if (token.startsWith("building_")) {
        const building = economy.buildings.find((entry) => entry.id === token);
        return building ? buildingTypeLabel(building.type) : "";
      }
      if (token.startsWith("parcel_")) {
        const parcel = economy.parcels.find((entry) => entry.id === token);
        return parcel ? `la parcela de ${urbanRoleLabel(parcel.urbanRole).toLowerCase()}` : "";
      }
      if (token.startsWith("loan_")) return "el préstamo";
      if (token.startsWith("crew_")) return "la cuadrilla";
      if (token.startsWith("org_")) return "la organización";
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function deriveNotifications(economy: Economy | undefined): GameNotification[] {
  if (!economy) return [];
  return economy.alerts.map((alert) => {
    const category = categoryFor(alert.kind, alert.severity);
    const target: NotificationTarget = alert.targetId
      ? { kind: "parcel", parcelId: alert.targetId }
      : alert.kind === "liquidity" || alert.kind === "debt"
        ? { kind: "hub", hub: "finance" }
        : alert.kind === "auction"
          ? { kind: "hub", hub: "finance" }
          : { kind: "none" };
    return {
      id: alert.id,
      category,
      severity: alert.severity,
      title: KIND_TITLES[alert.kind],
      body: sanitizeAlertMessage(alert.message, economy),
      target,
      actionLabel:
        target.kind === "parcel" ? "Ver parcela" : target.kind === "hub" ? "Abrir Finanzas" : null,
    };
  });
}

export function unreadCount(notifications: GameNotification[], read: ReadonlySet<string>): number {
  return notifications.filter((entry) => !read.has(entry.id)).length;
}

export function groupNotifications(
  notifications: GameNotification[],
): Array<{ category: NotificationCategory; entries: GameNotification[] }> {
  const order: NotificationCategory[] = [
    "urgent",
    "finances",
    "properties",
    "production",
    "government",
    "competition",
    "info",
  ];
  return order
    .map((category) => ({
      category,
      entries: notifications.filter((entry) => entry.category === category),
    }))
    .filter((group) => group.entries.length > 0);
}
