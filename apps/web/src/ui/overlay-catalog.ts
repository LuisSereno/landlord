import type { UiIconName } from "./icons";

/**
 * V.d-UX · catálogo de capas del mapa (spec §14). Es la fuente única de nombres, iconos, grupos
 * y leyendas; la escena importa de aquí sus colores para que la leyenda no pueda desviarse de lo
 * que se pinta. `none` es la vista normal: sin color semántico.
 */
export type MapOverlay =
  | "none"
  | "ownership"
  | "profitability"
  | "condition"
  | "zoning"
  | "landValue"
  | "security"
  | "fire"
  | "health"
  | "education"
  | "transport"
  | "risk"
  | "use"
  | "developmentCode"
  | "urbanRole";

export type OverlayGroupId = "ownership" | "value" | "use" | "services" | "risk";

/** Colores compartidos con el renderer. */
export const MAP_COLORS = {
  selected: 0xf2c14e,
  parcelAvailable: 0x7f8fa6,
  parcelPlayer: 0x4db6ac,
  parcelRival: 0xd97757,
  parcelCivic: 0x6fa8dc,
  building: 0xead7a1,
  construction: 0xb8a46a,
  fire: 0xf05a28,
  ruin: 0x6b5b73,
} as const;

export const ZONING_COLORS = {
  residential: 0x69a86b,
  mixed: 0xe0b04b,
  industrial: 0x9b7ede,
} as const;

export const USE_COLORS = {
  residential: 0x69a86b,
  retail: 0xe0b04b,
  office: 0x6fa8dc,
  industrial: 0x9b7ede,
  civic: 0xf2c14e,
  education: 0x4db6ac,
  health: 0xd98f6a,
  utility: 0x7f8fa6,
} as const;

export const ROLE_COLORS = {
  civic_core: 0xf2c14e,
  mixed_core: 0xd98f6a,
  commercial_corridor: 0xe0b04b,
  urban_residential: 0x69a86b,
  low_density_residential: 0x8fbf7a,
  industrial_logistics: 0x9b7ede,
  institutional: 0x6fa8dc,
  green_open_space: 0x4db6ac,
} as const;

export const CODE_PALETTE = [
  0x69a86b, 0x6fa8dc, 0xe0b04b, 0xd98f6a, 0x9b7ede, 0x4db6ac, 0xf2c14e,
] as const;

export function cssColor(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

export type OverlayLegendEntry = { color: string; label: string };

export type OverlayOption = {
  value: MapOverlay;
  group: OverlayGroupId;
  label: string;
  description: string;
  icon: UiIconName;
  legend: OverlayLegendEntry[];
};

export const OVERLAY_GROUPS: ReadonlyArray<{ id: OverlayGroupId; label: string }> = [
  { id: "ownership", label: "Propiedad" },
  { id: "value", label: "Valor" },
  { id: "use", label: "Uso" },
  { id: "services", label: "Servicios" },
  { id: "risk", label: "Riesgo" },
];

const coverageLegend: OverlayLegendEntry[] = [
  { color: cssColor(MAP_COLORS.parcelPlayer), label: "Cobertura alta (≥ 75 %)" },
  { color: cssColor(MAP_COLORS.construction), label: "Cobertura media (40-74 %)" },
  { color: cssColor(MAP_COLORS.parcelAvailable), label: "Cobertura baja (1-39 %)" },
  { color: cssColor(MAP_COLORS.fire), label: "Sin cobertura" },
];

export const OVERLAY_OPTIONS: readonly OverlayOption[] = [
  {
    value: "none",
    group: "ownership",
    label: "Vista normal",
    description: "Sin color semántico: la ciudad tal cual.",
    icon: "navigate",
    legend: [],
  },
  {
    value: "ownership",
    group: "ownership",
    label: "Propiedad",
    description: "Quién posee cada parcela.",
    icon: "ownership",
    legend: [
      { color: cssColor(MAP_COLORS.parcelPlayer), label: "Tu suelo" },
      { color: cssColor(MAP_COLORS.parcelRival), label: "Rival" },
      { color: cssColor(MAP_COLORS.parcelCivic), label: "Ayuntamiento" },
      { color: cssColor(MAP_COLORS.parcelAvailable), label: "Disponible" },
    ],
  },
  {
    value: "landValue",
    group: "value",
    label: "Valor del suelo",
    description: "Score de valoración del solar.",
    icon: "land-value",
    legend: [
      { color: cssColor(MAP_COLORS.parcelPlayer), label: "Alto (≥ 25)" },
      { color: cssColor(MAP_COLORS.construction), label: "Medio (5-24)" },
      { color: cssColor(MAP_COLORS.parcelAvailable), label: "Bajo (-10-4)" },
      { color: cssColor(MAP_COLORS.fire), label: "Muy bajo (< -10)" },
    ],
  },
  {
    value: "profitability",
    group: "value",
    label: "Rentabilidad",
    description: "Renta frente a deuda de mantenimiento por parcela.",
    icon: "income",
    legend: [
      { color: cssColor(MAP_COLORS.parcelPlayer), label: "Renta dobla la deuda" },
      { color: cssColor(MAP_COLORS.construction), label: "Renta justa" },
      { color: cssColor(MAP_COLORS.fire), label: "Pierde dinero" },
    ],
  },
  {
    value: "condition",
    group: "value",
    label: "Condición",
    description: "Estado del peor edificio de la parcela.",
    icon: "maintenance",
    legend: [
      { color: cssColor(MAP_COLORS.parcelPlayer), label: "Buen estado (> 70 %)" },
      { color: cssColor(MAP_COLORS.construction), label: "Deteriorado (36-70 %)" },
      { color: cssColor(MAP_COLORS.fire), label: "Crítico (≤ 35 %)" },
    ],
  },
  {
    value: "zoning",
    group: "use",
    label: "Zonificación",
    description: "Familia de uso del suelo.",
    icon: "zoning",
    legend: [
      { color: cssColor(ZONING_COLORS.residential), label: "Residencial" },
      { color: cssColor(ZONING_COLORS.mixed), label: "Mixta" },
      { color: cssColor(ZONING_COLORS.industrial), label: "Industrial" },
    ],
  },
  {
    value: "use",
    group: "use",
    label: "Uso actual",
    description: "Uso principal de la parcela.",
    icon: "housing",
    legend: [
      { color: cssColor(USE_COLORS.residential), label: "Residencial" },
      { color: cssColor(USE_COLORS.retail), label: "Comercio" },
      { color: cssColor(USE_COLORS.office), label: "Oficinas" },
      { color: cssColor(USE_COLORS.industrial), label: "Industrial" },
      { color: cssColor(USE_COLORS.civic), label: "Cívico" },
      { color: cssColor(USE_COLORS.education), label: "Educación" },
      { color: cssColor(USE_COLORS.health), label: "Salud" },
      { color: cssColor(USE_COLORS.utility), label: "Servicios" },
    ],
  },
  {
    value: "developmentCode",
    group: "use",
    label: "Código urbanístico",
    description: "Norma de edificación de cada solar.",
    icon: "ordinance",
    legend: [{ color: cssColor(CODE_PALETTE[2]!), label: "Un color por código (7 en total)" }],
  },
  {
    value: "urbanRole",
    group: "use",
    label: "Rol urbano",
    description: "Papel del bloque en la ciudad.",
    icon: "city",
    legend: [
      { color: cssColor(ROLE_COLORS.civic_core), label: "Núcleo cívico" },
      { color: cssColor(ROLE_COLORS.commercial_corridor), label: "Corredor comercial" },
      { color: cssColor(ROLE_COLORS.urban_residential), label: "Residencial urbano" },
      { color: cssColor(ROLE_COLORS.industrial_logistics), label: "Industria y logística" },
      { color: cssColor(ROLE_COLORS.institutional), label: "Institucional" },
      { color: cssColor(ROLE_COLORS.green_open_space), label: "Verde" },
    ],
  },
  {
    value: "security",
    group: "services",
    label: "Seguridad",
    description: "Cobertura de comisarías.",
    icon: "security",
    legend: coverageLegend,
  },
  {
    value: "fire",
    group: "services",
    label: "Bomberos",
    description: "Cobertura de parques de bomberos.",
    icon: "fire",
    legend: coverageLegend,
  },
  {
    value: "health",
    group: "services",
    label: "Salud",
    description: "Cobertura de clínicas.",
    icon: "health",
    legend: coverageLegend,
  },
  {
    value: "education",
    group: "services",
    label: "Educación",
    description: "Cobertura de escuelas.",
    icon: "education",
    legend: coverageLegend,
  },
  {
    value: "transport",
    group: "services",
    label: "Transporte",
    description: "Acceso a la red de transporte.",
    icon: "services",
    legend: coverageLegend,
  },
  {
    value: "risk",
    group: "risk",
    label: "Riesgo regulatorio",
    description: "Probabilidad de que la norma complique el proyecto.",
    icon: "risk",
    legend: [
      { color: cssColor(MAP_COLORS.fire), label: "Alto (≥ 30 %)" },
      { color: cssColor(MAP_COLORS.construction), label: "Medio (15-29 %)" },
      { color: cssColor(MAP_COLORS.parcelPlayer), label: "Bajo (< 15 %)" },
    ],
  },
];

export function overlayOption(value: MapOverlay): OverlayOption {
  return OVERLAY_OPTIONS.find((option) => option.value === value) ?? OVERLAY_OPTIONS[0]!;
}
