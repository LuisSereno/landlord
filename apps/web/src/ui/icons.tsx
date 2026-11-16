import { createElement } from "react";

import { resourceLabel } from "./labels";

/**
 * V.d-UX · registro único de iconografía semántica (spec §7.5, §7.6). Todos los iconos son SVG
 * internos con el mismo `viewBox 0 0 24 24`, trazo `currentColor`, grosor 1,8 y extremos
 * redondeados. No hay SVG sueltos por componentes, ni emojis, ni dependencia externa.
 *
 * Los iconos decorativos llevan `aria-hidden`; los interactivos reciben su nombre accesible del
 * botón que los contiene. `title` convierte el icono en imagen con nombre (uso aislado).
 *
 * V.d-UX.S · el registro guarda PRIMITIVAS, no elementos React. Una sola fuente produce las dos
 * salidas que hacen falta: el componente para la UI y el markup SVG serializable que la escena
 * rasteriza como textura de Phaser. Así no hay una segunda colección de iconos que pueda divergir,
 * ni falta `react-dom/server` en el bundle del navegador.
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
  | "influence"
  | "contract"
  | "illegal-route"
  | "crew"
  | "automation"
  | "heat"
  | "resource-cement"
  | "resource-brick"
  | "resource-steel"
  | "lien"
  | "vacancy"
  | "demolition";

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
  influence: "Influencia",
  contract: "Contrato",
  "illegal-route": "Ruta ilegal",
  crew: "Cuadrilla",
  automation: "Automatización",
  heat: "Presión policial",
  "resource-cement": "Cemento",
  "resource-brick": "Ladrillo",
  "resource-steel": "Acero",
  lien: "Gravamen",
  vacancy: "Vacancia",
  demolition: "Desescombro",
};

/**
 * Primitiva SVG del registro. El orden de los campos es el orden de atributos que se renderiza:
 * cambiarlo cambia el markup y rompe el fixture de paridad `icon-parity.fixture.json`.
 */
export type GlyphPrimitive =
  | { tag: "path"; d: string; dash?: string }
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { tag: "circle"; cx: number; cy: number; r: number };

const ICON_GLYPHS: Record<UiIconName, readonly GlyphPrimitive[]> = {
  money: [
    { tag: "rect", x: 3, y: 6, width: 18, height: 12, rx: 2 },
    { tag: "circle", cx: 12, cy: 12, r: 2.6 },
    { tag: "path", d: "M6.5 9.5v5M17.5 9.5v5" },
  ],
  income: [
    { tag: "path", d: "M4 17 10 11l3 3 7-7" },
    { tag: "path", d: "M14 7h6v6" },
  ],
  expense: [
    { tag: "path", d: "M4 7 10 13l3-3 7 7" },
    { tag: "path", d: "M20 17h-6v-6" },
  ],
  finance: [
    { tag: "path", d: "M3 9 12 4l9 5" },
    { tag: "path", d: "M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" },
  ],
  loan: [
    { tag: "rect", x: 3, y: 5, width: 13, height: 9, rx: 1.5 },
    { tag: "path", d: "M6.5 8h4M6.5 11h2.5" },
    { tag: "path", d: "M14 16l4 4 3-3" },
  ],
  government: [
    { tag: "path", d: "M3 9 12 3l9 6" },
    { tag: "path", d: "M5 9v8M9.5 9v8M14.5 9v8M19 9v8" },
    { tag: "path", d: "M3 20h18M3 17h18" },
  ],
  ordinance: [
    { tag: "path", d: "M6 3h9l4 4v14H6z" },
    { tag: "path", d: "M15 3v4h4" },
    { tag: "path", d: "M9 11h6M9 14.5h6M9 18h4" },
  ],
  tax: [
    { tag: "circle", cx: 7.5, cy: 7.5, r: 2.4 },
    { tag: "circle", cx: 16.5, cy: 16.5, r: 2.4 },
    { tag: "path", d: "M18.5 5.5 5.5 18.5" },
  ],
  housing: [
    { tag: "path", d: "M4 11 12 4l8 7" },
    { tag: "path", d: "M6 10v10h12V10" },
    { tag: "path", d: "M10 20v-5h4v5" },
  ],
  industry: [
    { tag: "path", d: "M3 20V10l5 3V10l5 3V8l5 3v9z" },
    { tag: "path", d: "M17 8V4h2v4" },
  ],
  production: [
    { tag: "circle", cx: 12, cy: 12, r: 3.2 },
    {
      tag: "path",
      d: "M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8",
    },
  ],
  materials: [
    { tag: "path", d: "M4 8.5 12 4l8 4.5-8 4.5z" },
    { tag: "path", d: "M4 13.5 12 18l8-4.5M4 18 12 22.5 20 18" },
  ],
  construction: [
    { tag: "path", d: "M4 20 14 10" },
    { tag: "path", d: "M12.5 5.5l6 6-2 2-6-6z" },
    { tag: "path", d: "M15 4l1.5-1.5M19.5 8.5 21 7" },
  ],
  tenants: [
    { tag: "circle", cx: 9, cy: 8, r: 2.6 },
    { tag: "path", d: "M4 19c0-3 2.2-5 5-5s5 2 5 5" },
    { tag: "circle", cx: 17, cy: 9.5, r: 2 },
    { tag: "path", d: "M15.5 19c0-2.2 1.6-3.8 3.5-3.8 1.2 0 2.2.5 2.8 1.4" },
  ],
  maintenance: [
    { tag: "path", d: "M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3L16.5 8.5" },
    { tag: "path", d: "M14.5 6.5 17 4a4 4 0 0 1 3 3l-2.5 2.5" },
  ],
  security: [
    { tag: "path", d: "M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" },
    { tag: "path", d: "m9 12 2 2 4-4" },
  ],
  fire: [
    { tag: "path", d: "M12 3c3 4 6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 10 8 7.5 12 3z" },
    { tag: "path", d: "M12 12c1.2 1.4 2 2.4 2 3.6a2 2 0 1 1-4 0c0-1.2.8-2.2 2-3.6z" },
  ],
  health: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5 },
    { tag: "path", d: "M12 8v8M8 12h8" },
  ],
  education: [
    { tag: "path", d: "M3 7.5 12 4l9 3.5-9 3.5z" },
    { tag: "path", d: "M7 9.5V14c0 1.6 2.2 3 5 3s5-1.4 5-3V9.5" },
    { tag: "path", d: "M21 7.5V13" },
  ],
  market: [
    { tag: "path", d: "M4 9h16l-1.5 11h-13z" },
    { tag: "path", d: "M4 9 5.5 5h13L20 9" },
    { tag: "path", d: "M9 13v3h6v-3" },
  ],
  insurance: [
    { tag: "path", d: "M12 3c3.5 2.5 6 3 8 3 0 7-3 12-8 15-5-3-8-8-8-15 2 0 4.5-.5 8-3z" },
    { tag: "path", d: "M8 12h8" },
  ],
  auction: [
    { tag: "path", d: "m5 15 6-6 4 4-6 6z" },
    { tag: "path", d: "m13 5 6 6M10 3l4 4M15 20h6" },
  ],
  rival: [
    { tag: "path", d: "M4 6h6v6H4zM14 12h6v6h-6z" },
    { tag: "path", d: "M10 9h2.5a2 2 0 0 1 2 2v1M14 15h-2.5a2 2 0 0 1-2-2v-1" },
  ],
  ownership: [
    { tag: "circle", cx: 8, cy: 8, r: 4 },
    { tag: "path", d: "m11 11 9 9M16 16l2-2M19 19l2-2" },
  ],
  "land-value": [
    { tag: "path", d: "M3 20h18" },
    { tag: "path", d: "M4 16 9 10l3 3 6-7" },
    { tag: "path", d: "M15 6h3v3" },
  ],
  zoning: [
    { tag: "rect", x: 3.5, y: 3.5, width: 17, height: 17, rx: 1.5 },
    { tag: "path", d: "M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17" },
  ],
  services: [
    { tag: "circle", cx: 6, cy: 12, r: 2.2 },
    { tag: "circle", cx: 17, cy: 6, r: 2.2 },
    { tag: "circle", cx: 17, cy: 18, r: 2.2 },
    { tag: "path", d: "M8 11 15 7M8 13l7 4" },
  ],
  risk: [
    { tag: "path", d: "M12 4 21 20H3z" },
    { tag: "path", d: "M12 10v4.5M12 17.2v.3" },
  ],
  notifications: [
    { tag: "path", d: "M6 16V11a6 6 0 1 1 12 0v5l1.6 2H4.4z" },
    { tag: "path", d: "M9.5 20a2.6 2.6 0 0 0 5 0" },
  ],
  help: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5 },
    { tag: "path", d: "M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.4" },
    { tag: "path", d: "M12 17.3v.3" },
  ],
  info: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5 },
    { tag: "path", d: "M12 11v5.5M12 7.8v.4" },
  ],
  warning: [
    { tag: "path", d: "M12 4 21 20H3z" },
    { tag: "path", d: "M12 10v4.5M12 17.2v.3" },
  ],
  error: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5 },
    { tag: "path", d: "m9 9 6 6M15 9l-6 6" },
  ],
  success: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5 },
    { tag: "path", d: "m8 12.2 2.6 2.6L16 9.4" },
  ],
  navigate: [
    { tag: "circle", cx: 12, cy: 12, r: 6.5 },
    { tag: "path", d: "M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" },
    { tag: "circle", cx: 12, cy: 12, r: 1.4 },
  ],
  close: [{ tag: "path", d: "m6 6 12 12M18 6 6 18" }],
  save: [
    { tag: "path", d: "M12 4v10" },
    { tag: "path", d: "m8 10 4 4 4-4" },
    { tag: "path", d: "M4 16v3h16v-3" },
  ],
  load: [
    { tag: "path", d: "M12 14V4" },
    { tag: "path", d: "m8 8 4-4 4 4" },
    { tag: "path", d: "M4 16v3h16v-3" },
  ],
  pause: [{ tag: "path", d: "M9 5v14M15 5v14" }],
  play: [{ tag: "path", d: "M8 5v14l11-7z" }],
  city: [
    { tag: "path", d: "M3 20V9l5-2v13M8 20V6l6-2v16M14 20v-8l7 2v6" },
    { tag: "path", d: "M5 12h1M5 15h1M10.5 9h1M10.5 12h1M10.5 15h1M17 15h1.5" },
  ],
  portfolio: [
    { tag: "rect", x: 3, y: 7.5, width: 18, height: 12, rx: 1.8 },
    { tag: "path", d: "M9 7.5V5h6v2.5M3 12.5h18" },
  ],
  calendar: [
    { tag: "rect", x: 3.5, y: 5, width: 17, height: 15, rx: 1.8 },
    { tag: "path", d: "M3.5 9.5h17M8 3v4M16 3v4" },
  ],
  upgrade: [
    { tag: "path", d: "M12 19V7" },
    { tag: "path", d: "m7 12 5-5 5 5" },
    { tag: "path", d: "M5 4h14" },
  ],
  intelligence: [
    { tag: "path", d: "M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" },
    { tag: "circle", cx: 12, cy: 12, r: 2.6 },
  ],
  reputation: [
    { tag: "path", d: "m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" },
  ],
  influence: [
    { tag: "path", d: "M12 3v18M5 8l7-5 7 5" },
    { tag: "path", d: "M5 8v3M19 8v3M9 21h6" },
  ],
  contract: [
    { tag: "path", d: "M6 3h9l4 4v14H6z" },
    { tag: "path", d: "M15 3v4h4" },
    { tag: "path", d: "M9 13c2-2 4 2 6 0M9 17h3" },
  ],
  "illegal-route": [
    { tag: "path", d: "M4 19l4-6 4 3 4-7 4 3", dash: "2.5 2.5" },
    { tag: "circle", cx: 4, cy: 19, r: 1.4 },
    { tag: "circle", cx: 20, cy: 12, r: 1.4 },
  ],
  crew: [
    { tag: "path", d: "M4 16a8 8 0 0 1 16 0" },
    { tag: "path", d: "M3 16h18v3H3z" },
    { tag: "path", d: "M12 8v-3" },
  ],
  automation: [
    { tag: "path", d: "M4 7h10M18 7h2M4 17h2M10 17h10" },
    { tag: "circle", cx: 16, cy: 7, r: 2 },
    { tag: "circle", cx: 8, cy: 17, r: 2 },
  ],
  heat: [
    { tag: "path", d: "M12 4a2.4 2.4 0 0 1 2.4 2.4v7.2a4 4 0 1 1-4.8 0V6.4A2.4 2.4 0 0 1 12 4z" },
    { tag: "path", d: "M12 16.5v-4" },
  ],
  "resource-cement": [
    { tag: "path", d: "M6 8h12l1.2 10.5a1.5 1.5 0 0 1-1.5 1.5H6.3a1.5 1.5 0 0 1-1.5-1.5z" },
    { tag: "path", d: "M7 8V6a5 5 0 0 1 10 0v2" },
    { tag: "path", d: "M9 12.5h6" },
  ],
  "resource-brick": [
    { tag: "rect", x: 3.5, y: 6, width: 17, height: 5, rx: 1 },
    { tag: "rect", x: 3.5, y: 13, width: 8, height: 5, rx: 1 },
    { tag: "rect", x: 13, y: 13, width: 7.5, height: 5, rx: 1 },
  ],
  "resource-steel": [
    { tag: "path", d: "M8 4h8v5h-2v6h2v5H8v-5h2V9H8z" },
    { tag: "path", d: "M6 4h12M6 20h12" },
  ],
  /** V.d-UX.S · inmueble con candado: la carga legal vive sobre la propiedad, no sobre el dinero. */
  lien: [
    { tag: "path", d: "M3.5 11 12 4l8.5 7" },
    { tag: "path", d: "M6 9.5V20h12V9.5" },
    { tag: "rect", x: 9.5, y: 13.5, width: 5, height: 4.5, rx: 0.8 },
    { tag: "path", d: "M10.8 13.5v-1.3a1.2 1.2 0 0 1 2.4 0v1.3" },
  ],
  /** V.d-UX.S · inmueble con cartel: vacío y en el mercado, no dañado. */
  vacancy: [
    { tag: "path", d: "M3.5 10.5 11 5l7.5 5.5" },
    { tag: "path", d: "M6 9.5V19h10V9.5" },
    { tag: "rect", x: 13.5, y: 12.5, width: 7.5, height: 5, rx: 0.8 },
    { tag: "path", d: "M17.2 17.5V21" },
  ],
  /** V.d-UX.S · estructura agrietada con flecha de derribo: desescombro, no obra nueva. */
  demolition: [
    { tag: "path", d: "M4 20V8l7-4v16" },
    { tag: "path", d: "M11 10l-3 2 3 2-3 2" },
    { tag: "path", d: "M17.5 8v9M14.5 14l3 3 3-3" },
    { tag: "path", d: "M3 20h18" },
  ],
};

/** El orden de construcción de props es el orden de atributos renderizado: no reordenar. */
function glyphElement(primitive: GlyphPrimitive, key: number) {
  if (primitive.tag === "rect") {
    const props: Record<string, number> = {
      x: primitive.x,
      y: primitive.y,
      width: primitive.width,
      height: primitive.height,
    };
    if (primitive.rx !== undefined) props.rx = primitive.rx;
    return createElement("rect", { key, ...props });
  }
  if (primitive.tag === "circle") {
    return createElement("circle", { key, cx: primitive.cx, cy: primitive.cy, r: primitive.r });
  }
  const props: Record<string, string> = { d: primitive.d };
  if (primitive.dash !== undefined) props.strokeDasharray = primitive.dash;
  return createElement("path", { key, ...props });
}

export function UiIcon({
  name,
  size = 18,
  className,
  title,
  color,
}: {
  name: UiIconName;
  size?: number;
  className?: string;
  title?: string;
  /** Tono explícito para rasterizar el glifo fuera del DOM; por defecto hereda `currentColor`. */
  color?: string;
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      focusable="false"
      height={size}
      role={title ? "img" : undefined}
      stroke={color ?? "currentColor"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      {ICON_GLYPHS[name].map((primitive, index) => glyphElement(primitive, index))}
    </svg>
  );
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializePrimitive(primitive: GlyphPrimitive): string {
  if (primitive.tag === "rect") {
    const rx = primitive.rx === undefined ? "" : ` rx="${primitive.rx}"`;
    return `<rect x="${primitive.x}" y="${primitive.y}" width="${primitive.width}" height="${primitive.height}"${rx}/>`;
  }
  if (primitive.tag === "circle") {
    return `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}"/>`;
  }
  const dash = primitive.dash === undefined ? "" : ` stroke-dasharray="${primitive.dash}"`;
  return `<path d="${escapeAttribute(primitive.d)}"${dash}/>`;
}

/**
 * Markup SVG autónomo del mismo registro que pinta `UiIcon`. Lo consume la escena para rasterizar
 * el glifo como textura de Phaser: lleva `xmlns` porque va en un data URI fuera del DOM, y un tono
 * explícito porque allí no existe `currentColor`. Síncrono y sin dependencias de renderizado.
 */
export function glyphSvgMarkup(
  name: UiIconName,
  options: { size: number; stroke: string; strokeWidth?: number },
): string {
  const body = ICON_GLYPHS[name].map(serializePrimitive).join("");
  const width = options.strokeWidth ?? 1.8;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="${options.size}" ` +
    `stroke="${escapeAttribute(options.stroke)}" stroke-linecap="round" stroke-linejoin="round" ` +
    `stroke-width="${width}" viewBox="0 0 24 24" width="${options.size}">${body}</svg>`
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
