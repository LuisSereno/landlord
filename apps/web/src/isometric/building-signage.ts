import type {
  BuildingAssetState,
  BuildingPhysicalOrientation,
  BuildingType,
} from "@landlord/shared";

/**
 * Señalización de edificios oficiales e industriales (capa de presentación, no estado de juego).
 *
 * El catálogo es puro y semántico: decide QUÉ tipos llevan rótulo y devuelve una clave estable
 * (`civic.clinic`, `industry.steel`…), nunca el texto final. El texto visible lo resuelve un
 * segundo paso por locale, de modo que cambiar de idioma no regenera arte ni toca la simulación.
 * Los rótulos se dibujan en runtime como `Phaser.GameObjects.Text` anclados al sprite; ningún
 * texto se hornea en los PNG ni pasa por Blender.
 *
 * No reutiliza `buildingTypeLabel()` (ui/labels.ts): esa función sirve a la UI con nombres
 * completos ("Parque de bomberos"); el contrato de señalización es corto, en mayúsculas y
 * localizado de forma independiente ("BOMBEROS").
 */

/** Clave semántica estable de señalización. Independiente del idioma y del nombre de UI. */
export type SignageKey =
  | "civic.town_hall"
  | "civic.school"
  | "civic.clinic"
  | "civic.police"
  | "civic.fire"
  | "civic.market"
  | "industry.workshop"
  | "industry.warehouse"
  | "industry.cement"
  | "industry.brick"
  | "industry.steel";

/** Locales con tabla de señalización. Español es el fallback para cualquier locale desconocido. */
export type SignageLocale = "es";

export const DEFAULT_SIGNAGE_LOCALE: SignageLocale = "es";

/**
 * Tipos que SÍ llevan rótulo en este primer alcance. Las viviendas (courtyard_home, row_house,
 * apartment_block, mixed_tenement) y cualquier tipo desconocido quedan fuera a propósito.
 */
const SIGNAGE_KEYS: Readonly<Partial<Record<BuildingType, SignageKey>>> = {
  town_hall: "civic.town_hall",
  school_block: "civic.school",
  clinic: "civic.clinic",
  police_station: "civic.police",
  fire_station: "civic.fire",
  market_hall: "civic.market",
  workshop: "industry.workshop",
  warehouse: "industry.warehouse",
  cement_plant: "industry.cement",
  brickworks: "industry.brick",
  steelworks: "industry.steel",
};

/** Tablas de texto por locale. Añadir un idioma = añadir una tabla, sin tocar el catálogo. */
const SIGNAGE_TEXT: Readonly<Record<SignageLocale, Readonly<Record<SignageKey, string>>>> = {
  es: {
    "civic.town_hall": "AYUNTAMIENTO",
    "civic.school": "COLEGIO",
    "civic.clinic": "CLÍNICA",
    "civic.police": "COMISARÍA",
    "civic.fire": "BOMBEROS",
    "civic.market": "MERCADO",
    "industry.workshop": "TALLER",
    "industry.warehouse": "NAVE LOGÍSTICA",
    "industry.cement": "CEMENTERA",
    "industry.brick": "LADRILLERA",
    "industry.steel": "ACERÍA",
  },
};

/** Clave semántica de un tipo, o `null` si no debe llevar rótulo. Acepta `BuildingType` o string. */
export function signageKeyFor(type: BuildingType | string): SignageKey | null {
  return SIGNAGE_KEYS[type as BuildingType] ?? null;
}

/** Locale efectivo: el solicitado si existe tabla; si no, español. Nunca devuelve undefined. */
export function resolveSignageLocale(locale: string): SignageLocale {
  return (locale as SignageLocale) in SIGNAGE_TEXT
    ? (locale as SignageLocale)
    : DEFAULT_SIGNAGE_LOCALE;
}

/** Texto visible de una clave en un locale. El fallback de locale ya lo aplica el resolver. */
export function signageTextFor(key: SignageKey, locale: string = DEFAULT_SIGNAGE_LOCALE): string {
  return SIGNAGE_TEXT[resolveSignageLocale(locale)][key];
}

/**
 * Anclaje normalizado de la placa dentro de la caja visible del sprite (0,0 = esquina superior
 * izquierda, 1,1 = inferior derecha). Se mide sobre el render real de cada arquetipo para que la
 * placa caiga sobre la fachada / volumen administrativo, nunca flotando sobre el solar. La escena
 * lo convierte a mundo con `sprite.displayWidth/Height` y `sprite.originX/Y`, de modo que la placa
 * acompaña al sprite al moverse, escalarse o rotar.
 */
export type SignageAnchor = { x: number; y: number };

/** Anclaje por tipo medido sobre el sprite `complete @ orient 0` (fachada frontal / acceso). */
const SIGNAGE_ANCHORS: Readonly<Partial<Record<BuildingType, SignageAnchor>>> = {
  town_hall: { x: 0.4, y: 0.5 },
  // Colegio y mercado estaban apoyados en el borde superior del tejado; bajados a la cornisa.
  school_block: { x: 0.5, y: 0.65 },
  // En estos dos sprites la masa opaca está a la derecha del centro del frame (la sombra ocupa la
  // franja izquierda), así que un anclaje en 0,5 roza el borde izquierdo del volumen.
  clinic: { x: 0.56, y: 0.55 },
  police_station: { x: 0.52, y: 0.45 },
  fire_station: { x: 0.55, y: 0.48 },
  market_hall: { x: 0.38, y: 0.55 },
  // Industriales: el cartel es alargado, así que el anclaje se centra sobre la masa. Con una placa
  // ancha, un anclaje descentrado colgaría fuera de la fachada; por eso los polígonos industriales
  // usan cartel alargado (SIGNAGE_PLATE_STYLES) y además van centrados.
  workshop: { x: 0.45, y: 0.6 },
  warehouse: { x: 0.45, y: 0.6 },
  cement_plant: { x: 0.35, y: 0.54 },
  brickworks: { x: 0.55, y: 0.7 },
  steelworks: { x: 0.45, y: 0.62 },
};

const DEFAULT_SIGNAGE_ANCHOR: SignageAnchor = { x: 0.5, y: 0.55 };

/**
 * Forma de la placa. La señal cívica se lee mejor compacta (la palabra define al edificio); en
 * nave industrial, cementera o acería el cartel largo tipo corporativo es lo que pertenece a la
 * fachada de un volumen grande. Es una decisión de presentación, no del dominio.
 */
export type SignagePlateStyle = "compact" | "banner";

const SIGNAGE_PLATE_STYLES: Readonly<Partial<Record<BuildingType, SignagePlateStyle>>> = {
  workshop: "banner",
  warehouse: "banner",
  cement_plant: "banner",
  brickworks: "banner",
  steelworks: "banner",
};

const DEFAULT_SIGNAGE_PLATE_STYLE: SignagePlateStyle = "compact";

/** Estilo de placa de un tipo; lo que no es industria pesada conserva el formato compacto. */
export function signagePlateStyleFor(type: BuildingType | string): SignagePlateStyle {
  return SIGNAGE_PLATE_STYLES[type as BuildingType] ?? DEFAULT_SIGNAGE_PLATE_STYLE;
}

/**
 * Saliencia del rótulo, usada sólo por la densidad adaptativa de la escena. Es dato del catálogo,
 * no un condicional codificado en el render: la escena pregunta "¿esto es un servicio público?" y
 * nunca decide por nombre de tipo ni por texto.
 */
export type SignageSalience = "public_service" | "commercial";

const SIGNAGE_SALIENCE: Readonly<Record<SignageKey, SignageSalience>> = {
  "civic.town_hall": "public_service",
  "civic.school": "public_service",
  "civic.clinic": "public_service",
  "civic.police": "public_service",
  "civic.fire": "public_service",
  "civic.market": "public_service",
  "industry.workshop": "commercial",
  "industry.warehouse": "commercial",
  "industry.cement": "commercial",
  "industry.brick": "commercial",
  "industry.steel": "commercial",
};

/** Qué merece seguir visible cuando el mapa se aleja y las placas empiezan a pisarse. */
export function signageSalienceFor(key: SignageKey): SignageSalience {
  return SIGNAGE_SALIENCE[key];
}

/**
 * Anclaje efectivo para una orientación física. En 180° la fachada visible se invierte en horizontal
 * (espejo de x); en 90°/270° el cuerpo largo gira y la placa se centra sobre la masa del edificio
 * (x 0.5) para no caer fuera de la fachada. Siempre dentro de la caja del sprite.
 */
export function signageAnchorFor(
  type: BuildingType | string,
  orientation: BuildingPhysicalOrientation = 0,
): SignageAnchor {
  const base = SIGNAGE_ANCHORS[type as BuildingType] ?? DEFAULT_SIGNAGE_ANCHOR;
  if (orientation === 180) return { x: 1 - base.x, y: base.y };
  if (orientation === 90 || orientation === 270) return { x: 0.5, y: base.y };
  return base;
}

/**
 * Entrada mínima del plan de sprites que la señalización necesita. `buildingSpritePlan` ya
 * resolvió que hay un sprite real renderizable; aquí sólo se lee tipo, clase de entidad y estado
 * visual para decidir elegibilidad. No se crea ningún canal de datos nuevo desde la simulación.
 */
export type SignagePlanInput = {
  id: string;
  entityKind: "building" | "construction";
  domainType: string;
  assetState: BuildingAssetState;
  orientation: BuildingPhysicalOrientation;
};

/** Un rótulo decidido: identidad estable del sprite + clave semántica + texto ya localizado. */
export type BuildingSignageEntry = {
  id: string;
  key: SignageKey;
  text: string;
  /** Anclaje normalizado dentro de la caja del sprite para colocar la placa integrada. */
  anchor: SignageAnchor;
  /** Forma de la placa (compacta cívica / cartel alargado industrial); afecta sólo al padding. */
  plateStyle: SignagePlateStyle;
  /** Saliencia de la clave: decide si el rótulo sobrevive a la densidad adaptativa de zoom lejano. */
  salience: SignageSalience;
};

/**
 * Elegibilidad de un rótulo. Sólo edificios terminados (`complete`) de un tipo con clave: las
 * obras (`construction`), el daño (`damaged`), el fuego (`burning`) y las viviendas no rotulan.
 * Se evalúa DESPUÉS de que el plan de sprites haya confirmado un asset renderizable.
 */
export function signageEntryFor(
  input: SignagePlanInput,
  locale: string = DEFAULT_SIGNAGE_LOCALE,
): BuildingSignageEntry | null {
  if (input.entityKind !== "building") return null;
  if (input.assetState !== "complete") return null;
  const key = signageKeyFor(input.domainType);
  if (!key) return null;
  return {
    id: input.id,
    key,
    text: signageTextFor(key, locale),
    anchor: signageAnchorFor(input.domainType, input.orientation),
    plateStyle: signagePlateStyleFor(input.domainType),
    salience: signageSalienceFor(key),
  };
}

/**
 * Plan de señalización puro: una entrada por edificio elegible, en el orden del plan de sprites y
 * con ids únicos (el mismo identificador estable `building:<id>` que usan los sprites). Determinista:
 * mismo plan + mismo locale ⇒ mismo resultado.
 */
export function buildingSignagePlan(
  plan: readonly SignagePlanInput[],
  locale: string = DEFAULT_SIGNAGE_LOCALE,
): BuildingSignageEntry[] {
  const entries: BuildingSignageEntry[] = [];
  for (const placement of plan) {
    const entry = signageEntryFor(placement, locale);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * Reconciliación pura entre el estado anterior de rótulos y el plan nuevo. Devuelve el mapa
 * siguiente, los ids creados y los ids que deben destruirse. La escena aplica este diff sobre su
 * `Map` de `Phaser.GameObjects.Text`: crear sólo lo nuevo, destruir lo que salió, actualizar el
 * resto. Dos sincronizaciones con el mismo plan no crean ni destruyen nada (sin duplicados).
 */
export type SignageReconciliation = {
  next: Map<string, BuildingSignageEntry>;
  created: BuildingSignageEntry[];
  removed: string[];
};

export function reconcileBuildingSignage(
  previous: ReadonlyMap<string, BuildingSignageEntry>,
  plan: readonly SignagePlanInput[],
  locale: string = DEFAULT_SIGNAGE_LOCALE,
): SignageReconciliation {
  const entries = buildingSignagePlan(plan, locale);
  const next = new Map<string, BuildingSignageEntry>();
  const created: BuildingSignageEntry[] = [];
  for (const entry of entries) {
    next.set(entry.id, entry);
    if (!previous.has(entry.id)) created.push(entry);
  }
  const removed: string[] = [];
  for (const id of previous.keys()) if (!next.has(id)) removed.push(id);
  return { next, created, removed };
}
