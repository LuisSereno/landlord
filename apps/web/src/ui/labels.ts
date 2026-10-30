import type { BuildingType, LandUse } from "@landlord/shared";

/**
 * V.d-UX · vocabulario del jugador. Todo texto que llega al DOM pasa por aquí: la UI no escribe
 * enums, nombres de propiedades ni identificadores técnicos (spec §3.4, §11). Los helpers son
 * puros y se prueban sin navegador; el calendario llega desde la proyección, nunca copiado del
 * motor (spec §11.1).
 */
export type GameCalendar = {
  ticksPerMonth: number;
  ticksPerDay: number;
  daysPerMonth: number;
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const NO_DATA = "—";

const MONTH_TICKS_FALLBACK: GameCalendar = {
  ticksPerMonth: 36_000,
  ticksPerDay: 1_200,
  daysPerMonth: 30,
};

/** Fecha de juego legible. Un tick nunca se muestra: se convierte a "17 de marzo". */
export function formatGameDate(
  tick: number,
  calendar: GameCalendar = MONTH_TICKS_FALLBACK,
): string {
  const safeTick = Math.max(0, Math.floor(tick));
  const month = Math.floor(safeTick / calendar.ticksPerMonth) + 1;
  const day = Math.floor((safeTick % calendar.ticksPerMonth) / calendar.ticksPerDay) + 1;
  const monthName = MONTH_NAMES[(month - 1) % 12]!;
  return month <= 12 ? `${day} de ${monthName}` : `${day} de ${monthName} (mes ${month})`;
}

/** Duración legible: "3 horas", "2 días", "1 mes y 4 días". Nunca "7200 ticks". */
export function formatGameDuration(
  ticks: number,
  calendar: GameCalendar = MONTH_TICKS_FALLBACK,
): string {
  const safe = Math.max(0, Math.floor(ticks));
  if (safe === 0) return "ahora";
  if (safe < calendar.ticksPerDay) {
    const hours = Math.max(1, Math.round((safe * 24) / calendar.ticksPerDay));
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  if (safe < calendar.ticksPerMonth) {
    const days = Math.max(1, Math.round(safe / calendar.ticksPerDay));
    return days === 1 ? "1 día" : `${days} días`;
  }
  const months = Math.floor(safe / calendar.ticksPerMonth);
  const restDays = Math.round((safe % calendar.ticksPerMonth) / calendar.ticksPerDay);
  const monthLabel = months === 1 ? "1 mes" : `${months} meses`;
  if (restDays === 0) return monthLabel;
  return `${monthLabel} y ${restDays === 1 ? "1 día" : `${restDays} días`}`;
}

export function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)} u.`;
}

export function formatMoney(value: number): string {
  return `${value} u.`;
}

export function formatPercent(value: number): string {
  return `${value} %`;
}

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  courtyard_home: "Patio residencial",
  workshop: "Taller",
  cement_plant: "Planta de cemento",
  brickworks: "Ladrillera",
  steelworks: "Acería",
  row_house: "Casa adosada",
  apartment_block: "Bloque de pisos",
  mixed_tenement: "Edificio mixto",
  warehouse: "Nave logística",
  town_hall: "Ayuntamiento",
  school_block: "Colegio",
  clinic: "Clínica",
  police_station: "Comisaría",
  fire_station: "Parque de bomberos",
  market_hall: "Mercado",
};

export function buildingTypeLabel(type: string): string {
  return BUILDING_TYPE_LABELS[type as BuildingType] ?? "Edificio";
}

export function buildingStateLabel(state: string): string {
  return (
    {
      operational: "En servicio",
      burning: "En llamas",
      collapse_pending: "Colapso inminente",
      ruin: "En ruinas",
    }[state] ?? "Estado desconocido"
  );
}

export function buildingDisplayName(type: string, ordinal?: number): string {
  const base = buildingTypeLabel(type);
  return ordinal && ordinal > 1 ? `${base} ${ordinal}` : base;
}

export function constructionKindLabel(kind: string): string {
  return (
    {
      construction: "Obra nueva",
      upgrade: "Mejora",
      repair: "Reparación",
      clear_ruin: "Desescombro",
    }[kind] ?? "Obra"
  );
}

export function landUseLabel(use: LandUse | string): string {
  return (
    {
      residential: "Residencial",
      retail: "Comercio",
      office: "Oficinas",
      industrial: "Industrial",
      civic: "Cívico",
      education: "Educación",
      health: "Salud",
      utility: "Servicios",
    }[use] ?? "Uso"
  );
}

/** Nombres de los códigos urbanísticos vigentes; el id técnico no llega al jugador. */
export function developmentCodeLabel(developmentCodeId: string): string {
  return (
    {
      res_low_2f: "Residencial de baja altura",
      res_urban_4f: "Residencial urbano",
      mixed_core_5f: "Núcleo mixto",
      commercial_corridor_4f: "Corredor comercial",
      industrial_yard_2f: "Patio industrial",
      institutional_3f: "Institucional",
      civic_landmark_5f: "Equipamiento cívico",
    }[developmentCodeId] ?? "Código urbanístico"
  );
}

export function urbanRoleLabel(role: string): string {
  return (
    {
      civic_core: "Núcleo cívico",
      mixed_core: "Mixto",
      commercial_corridor: "Corredor comercial",
      urban_residential: "Residencial urbano",
      low_density_residential: "Residencial baja densidad",
      industrial_logistics: "Industria y logística",
      institutional: "Institucional",
      green_open_space: "Verde",
    }[role] ?? "Suelo urbano"
  );
}

export function zoningLabel(zoning: "residential" | "industrial" | "mixed"): string {
  return { residential: "Residencial", industrial: "Industrial", mixed: "Mixta" }[zoning];
}

export function facilityKindLabel(kind: string): string {
  return (
    {
      town_hall: "Ayuntamiento",
      school: "Escuela",
      clinic: "Clínica",
      police_station: "Comisaría",
      fire_station: "Parque de bomberos",
      market: "Mercado",
    }[kind] ?? "Equipamiento"
  );
}

export function facilityServiceLabel(serviceProfileId: string): string {
  const key = serviceProfileId.replace(/_service$/, "");
  return (
    {
      security: "Seguridad ciudadana",
      fire: "Bomberos",
      health: "Salud",
      education: "Educación",
      market: "Mercado",
      parks: "Parques",
      transport: "Transporte",
    }[key] ?? "Servicio municipal"
  );
}

export function publicSpaceKindLabel(kind: string): string {
  return (
    {
      plaza: "Plaza",
      park: "Parque",
      pocket_park: "Jardín de bolsillo",
      civic_courtyard: "Patio cívico",
      schoolyard: "Patio escolar",
    }[kind] ?? "Espacio público"
  );
}

export function tenantProfileLabel(profile: "household" | "maker" | "shopkeeper"): string {
  return { household: "hogar", maker: "artesano", shopkeeper: "comerciante" }[profile];
}

export function resourceLabel(resource: "cement" | "brick" | "steel"): string {
  return resource === "cement" ? "cemento" : resource === "brick" ? "ladrillo" : "acero";
}

export function transactionLabel(cause: string): string {
  return (
    {
      parcel_purchase: "compra de parcela",
      parcel_sale: "venta de parcela",
      construction_start: "inicio de obra",
      building_upgrade: "mejora de edificio",
      rent_collection: "cobro de renta",
      illegal_route: "ruta ilegal",
      crime_fine: "multa por detección",
      materials_market: "compra de materiales",
      production_investment: "inversión productiva",
      production_operation: "coste de producción",
      building_repair: "reparación",
      intelligence_commission: "encargo de investigación",
      property_tax: "impuesto de propiedad",
      transfer_tax: "impuesto de transmisión",
      service_fee: "tasa de servicios",
      loan_disbursement: "préstamo recibido",
      loan_payment: "cuota del préstamo",
      insurance_premium: "prima de seguro",
      insurance_claim: "indemnización de seguro",
      auction_award: "adjudicación de subasta",
      public_contract_award: "contrato público",
    }[cause] ?? "movimiento de caja"
  );
}

export function permitStatusLabel(status: "approved" | "denied" | "expired" | "consumed"): string {
  return {
    approved: "concedido",
    denied: "denegado",
    expired: "caducado",
    consumed: "ya utilizado",
  }[status];
}

export function ordinanceStatusLabel(
  status: "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn",
): string {
  return {
    proposed: "propuesta disponible",
    approved: "aprobada",
    active: "activa",
    expired: "expirada",
    rejected: "rechazada",
    withdrawn: "retirada",
  }[status];
}

export function loanStatusLabel(
  status: "active" | "delinquent" | "paid_off" | "defaulted",
): string {
  return {
    active: "al día",
    delinquent: "en atraso",
    paid_off: "liquidado",
    defaulted: "impagado",
  }[status];
}

export function auctionStatusLabel(status: string): string {
  return (
    {
      open: "abierta",
      awarded: "adjudicada",
      withdrawn: "retirada",
      failed: "desierta",
    }[status] ?? "subasta"
  );
}

export function insuranceCoverageLabel(coverage: "fire_basic" | "fire_plus"): string {
  return coverage === "fire_basic" ? "Cobertura básica" : "Cobertura ampliada";
}

export function insuranceStatusLabel(status: "active" | "lapsed" | "cancelled"): string {
  return { active: "activa", lapsed: "vencida", cancelled: "cancelada" }[status];
}

export function maintenancePolicyLabel(policy: "balanced" | "deferred"): string {
  return policy === "balanced" ? "equilibrada" : "diferida";
}

export function alertSeverityLabel(severity: "high" | "medium" | "low"): string {
  return { high: "urgente", medium: "importante", low: "informativa" }[severity];
}

export function alertCategoryLabel(
  kind: "liquidity" | "debt" | "maintenance" | "permit" | "auction" | "occupancy",
): string {
  return {
    liquidity: "Finanzas",
    debt: "Finanzas",
    maintenance: "Propiedades",
    permit: "Propiedades",
    auction: "Finanzas",
    occupancy: "Propiedades",
  }[kind];
}

/**
 * Nombre estable de cuadrilla. `crew_00000002` se convierte en «Cuadrilla 2»; si el id no sigue
 * el patrón, se devuelve una etiqueta genérica — nunca el identificador (spec §11.2).
 */
export function crewDisplayName(crewId: string): string {
  const match = /(\d+)$/.exec(crewId);
  if (!match) return "Cuadrilla";
  return `Cuadrilla ${Number(match[1])}`;
}

/** Organizaciones conocidas del mundo jugable; un id desconocido no se muestra crudo. */
export function organizationDisplayName(organizationId: string | null | undefined): string {
  if (!organizationId) return "Sin propietario";
  return (
    {
      org_00000001: "Tu empresa",
      org_00000002: "Rival",
      org_00000003: "Banco",
      org_00000004: "Ayuntamiento",
      org_00000005: "Aseguradora",
    }[organizationId] ?? "Organización externa"
  );
}

export function parcelDispositionLabel(
  disposition: "marketable" | "public" | "infrastructure",
): string {
  return {
    marketable: "En venta",
    public: "Suelo municipal",
    infrastructure: "Infraestructura",
  }[disposition];
}

export function districtRoleLabel(role: string): string {
  return urbanRoleLabel(role);
}

export { MONTH_NAMES };
