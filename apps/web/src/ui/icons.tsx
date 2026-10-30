import type { ReactNode } from "react";

import { resourceLabel } from "./labels";

/**
 * V.d-UX · registro único de iconografía semántica (spec §7.5, §7.6). Todos los iconos son SVG
 * internos con el mismo `viewBox 0 0 24 24`, trazo `currentColor`, grosor 1,8 y extremos
 * redondeados. No hay SVG sueltos por componentes, ni emojis, ni dependencia externa.
 *
 * Los iconos decorativos llevan `aria-hidden`; los interactivos reciben su nombre accesible del
 * botón que los contiene. `title` convierte el icono en imagen con nombre (uso aislado).
 */
export type UiIconName =
  | "money"
  | "income"
  | "expense"
  | "finance"
  | "loan"
  | "government"
  | "ordinance"
  | "tax"
  | "housing"
  | "industry"
  | "production"
  | "materials"
  | "construction"
  | "tenants"
  | "maintenance"
  | "security"
  | "fire"
  | "health"
  | "education"
  | "market"
  | "insurance"
  | "auction"
  | "rival"
  | "ownership"
  | "land-value"
  | "zoning"
  | "services"
  | "risk"
  | "notifications"
  | "help"
  | "info"
  | "warning"
  | "error"
  | "success"
  | "navigate"
  | "close"
  | "save"
  | "load"
  | "pause"
  | "play"
  | "city"
  | "portfolio"
  | "calendar"
  | "upgrade"
  | "intelligence"
  | "reputation"
  | "contract"
  | "illegal-route"
  | "crew"
  | "automation"
  | "heat"
  | "resource-cement"
  | "resource-brick"
  | "resource-steel";

export const UI_ICON_LABELS: Record<UiIconName, string> = {
  money: "Dinero",
  income: "Ingresos",
  expense: "Gastos",
  finance: "Finanzas",
  loan: "Préstamo",
  government: "Gobierno",
  ordinance: "Ordenanza",
  tax: "Impuestos",
  housing: "Vivienda",
  industry: "Industria",
  production: "Producción",
  materials: "Materiales",
  construction: "Construcción",
  tenants: "Inquilinos",
  maintenance: "Mantenimiento",
  security: "Seguridad",
  fire: "Bomberos",
  health: "Salud",
  education: "Educación",
  market: "Mercado",
  insurance: "Seguro",
  auction: "Subasta",
  rival: "Competencia",
  ownership: "Propiedad",
  "land-value": "Valor del suelo",
  zoning: "Zonificación",
  services: "Servicios",
  risk: "Riesgo",
  notifications: "Notificaciones",
  help: "Ayuda",
  info: "Información",
  warning: "Aviso",
  error: "Error",
  success: "Correcto",
  navigate: "Ir al mapa",
  close: "Cerrar",
  save: "Guardar",
  load: "Cargar",
  pause: "Pausar",
  play: "Continuar",
  city: "Ciudad",
  portfolio: "Cartera",
  calendar: "Calendario",
  upgrade: "Mejorar",
  intelligence: "Inteligencia",
  reputation: "Reputación",
  contract: "Contrato",
  "illegal-route": "Ruta ilegal",
  crew: "Cuadrilla",
  automation: "Automatización",
  heat: "Presión policial",
  "resource-cement": "Cemento",
  "resource-brick": "Ladrillo",
  "resource-steel": "Acero",
};

const ICON_GLYPHS: Record<UiIconName, ReactNode> = {
  money: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  income: (
    <>
      <path d="M4 17 10 11l3 3 7-7" />
      <path d="M14 7h6v6" />
    </>
  ),
  expense: (
    <>
      <path d="M4 7 10 13l3-3 7 7" />
      <path d="M20 17h-6v-6" />
    </>
  ),
  finance: (
    <>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />
    </>
  ),
  loan: (
    <>
      <rect x="3" y="5" width="13" height="9" rx="1.5" />
      <path d="M6.5 8h4M6.5 11h2.5" />
      <path d="M14 16l4 4 3-3" />
    </>
  ),
  government: (
    <>
      <path d="M3 9 12 3l9 6" />
      <path d="M5 9v8M9.5 9v8M14.5 9v8M19 9v8" />
      <path d="M3 20h18M3 17h18" />
    </>
  ),
  ordinance: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 11h6M9 14.5h6M9 18h4" />
    </>
  ),
  tax: (
    <>
      <circle cx="7.5" cy="7.5" r="2.4" />
      <circle cx="16.5" cy="16.5" r="2.4" />
      <path d="M18.5 5.5 5.5 18.5" />
    </>
  ),
  housing: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  industry: (
    <>
      <path d="M3 20V10l5 3V10l5 3V8l5 3v9z" />
      <path d="M17 8V4h2v4" />
    </>
  ),
  production: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  materials: (
    <>
      <path d="M4 8.5 12 4l8 4.5-8 4.5z" />
      <path d="M4 13.5 12 18l8-4.5M4 18 12 22.5 20 18" />
    </>
  ),
  construction: (
    <>
      <path d="M4 20 14 10" />
      <path d="M12.5 5.5l6 6-2 2-6-6z" />
      <path d="M15 4l1.5-1.5M19.5 8.5 21 7" />
    </>
  ),
  tenants: (
    <>
      <circle cx="9" cy="8" r="2.6" />
      <path d="M4 19c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="17" cy="9.5" r="2" />
      <path d="M15.5 19c0-2.2 1.6-3.8 3.5-3.8 1.2 0 2.2.5 2.8 1.4" />
    </>
  ),
  maintenance: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3L16.5 8.5" />
      <path d="M14.5 6.5 17 4a4 4 0 0 1 3 3l-2.5 2.5" />
    </>
  ),
  security: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  fire: (
    <>
      <path d="M12 3c3 4 6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 10 8 7.5 12 3z" />
      <path d="M12 12c1.2 1.4 2 2.4 2 3.6a2 2 0 1 1-4 0c0-1.2.8-2.2 2-3.6z" />
    </>
  ),
  health: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  education: (
    <>
      <path d="M3 7.5 12 4l9 3.5-9 3.5z" />
      <path d="M7 9.5V14c0 1.6 2.2 3 5 3s5-1.4 5-3V9.5" />
      <path d="M21 7.5V13" />
    </>
  ),
  market: (
    <>
      <path d="M4 9h16l-1.5 11h-13z" />
      <path d="M4 9 5.5 5h13L20 9" />
      <path d="M9 13v3h6v-3" />
    </>
  ),
  insurance: (
    <>
      <path d="M12 3c3.5 2.5 6 3 8 3 0 7-3 12-8 15-5-3-8-8-8-15 2 0 4.5-.5 8-3z" />
      <path d="M8 12h8" />
    </>
  ),
  auction: (
    <>
      <path d="m5 15 6-6 4 4-6 6z" />
      <path d="m13 5 6 6M10 3l4 4M15 20h6" />
    </>
  ),
  rival: (
    <>
      <path d="M4 6h6v6H4zM14 12h6v6h-6z" />
      <path d="M10 9h2.5a2 2 0 0 1 2 2v1M14 15h-2.5a2 2 0 0 1-2-2v-1" />
    </>
  ),
  ownership: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M16 16l2-2M19 19l2-2" />
    </>
  ),
  "land-value": (
    <>
      <path d="M3 20h18" />
      <path d="M4 16 9 10l3 3 6-7" />
      <path d="M15 6h3v3" />
    </>
  ),
  zoning: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17" />
    </>
  ),
  services: (
    <>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="17" cy="6" r="2.2" />
      <circle cx="17" cy="18" r="2.2" />
      <path d="M8 11 15 7M8 13l7 4" />
    </>
  ),
  risk: (
    <>
      <path d="M12 4 21 20H3z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.6 2H4.4z" />
      <path d="M9.5 20a2.6 2.6 0 0 0 5 0" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.4" />
      <path d="M12 17.3v.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.2 2.6 2.6L16 9.4" />
    </>
  ),
  navigate: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  save: (
    <>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 16v3h16v-3" />
    </>
  ),
  load: (
    <>
      <path d="M12 14V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M4 16v3h16v-3" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M8 5v14l11-7z" />,
  city: (
    <>
      <path d="M3 20V9l5-2v13M8 20V6l6-2v16M14 20v-8l7 2v6" />
      <path d="M5 12h1M5 15h1M10.5 9h1M10.5 12h1M10.5 15h1M17 15h1.5" />
    </>
  ),
  portfolio: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="1.8" />
      <path d="M9 7.5V5h6v2.5M3 12.5h18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  upgrade: (
    <>
      <path d="M12 19V7" />
      <path d="m7 12 5-5 5 5" />
      <path d="M5 4h14" />
    </>
  ),
  intelligence: (
    <>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  reputation: (
    <>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </>
  ),
  contract: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 13c2-2 4 2 6 0M9 17h3" />
    </>
  ),
  "illegal-route": (
    <>
      <path d="M4 19l4-6 4 3 4-7 4 3" strokeDasharray="2.5 2.5" />
      <circle cx="4" cy="19" r="1.4" />
      <circle cx="20" cy="12" r="1.4" />
    </>
  ),
  crew: (
    <>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M3 16h18v3H3z" />
      <path d="M12 8v-3" />
    </>
  ),
  automation: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  heat: (
    <>
      <path d="M12 4a2.4 2.4 0 0 1 2.4 2.4v7.2a4 4 0 1 1-4.8 0V6.4A2.4 2.4 0 0 1 12 4z" />
      <path d="M12 16.5v-4" />
    </>
  ),
  "resource-cement": (
    <>
      <path d="M6 8h12l1.2 10.5a1.5 1.5 0 0 1-1.5 1.5H6.3a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M7 8V6a5 5 0 0 1 10 0v2" />
      <path d="M9 12.5h6" />
    </>
  ),
  "resource-brick": (
    <>
      <rect x="3.5" y="6" width="17" height="5" rx="1" />
      <rect x="3.5" y="13" width="8" height="5" rx="1" />
      <rect x="13" y="13" width="7.5" height="5" rx="1" />
    </>
  ),
  "resource-steel": (
    <>
      <path d="M8 4h8v5h-2v6h2v5H8v-5h2V9H8z" />
      <path d="M6 4h12M6 20h12" />
    </>
  ),
};

export function UiIcon({
  name,
  size = 18,
  className,
  title,
}: {
  name: UiIconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      focusable="false"
      height={size}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      {ICON_GLYPHS[name]}
    </svg>
  );
}

/** Catálogo derivado del registro: nombre semántico → etiqueta accesible. */
export const iconCatalog: ReadonlyArray<{ name: UiIconName; label: string }> = (
  Object.keys(ICON_GLYPHS) as UiIconName[]
).map((name) => ({ name, label: UI_ICON_LABELS[name] }));

const RESOURCE_ICONS = {
  cement: "resource-cement",
  brick: "resource-brick",
  steel: "resource-steel",
} as const satisfies Record<string, UiIconName>;

/** Icono de material con su nombre accesible: cemento, ladrillo y acero (spec §7.4). */
export function ResourceIcon({
  resource,
  size = 16,
  showLabel = false,
}: {
  resource: "cement" | "brick" | "steel";
  size?: number;
  showLabel?: boolean;
}) {
  return (
    <span className={showLabel ? "resource-icon resource-icon-labeled" : "resource-icon"}>
      <UiIcon name={RESOURCE_ICONS[resource]} size={size} />
      {showLabel ? (
        <span>{resourceLabel(resource)}</span>
      ) : (
        <span className="sr-only">{resourceLabel(resource)}</span>
      )}
    </span>
  );
}
