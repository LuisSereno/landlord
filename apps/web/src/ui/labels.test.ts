import { describe, expect, it } from "vitest";
import { buildingTypeSchema } from "@landlord/shared";

import {
  alertCategoryLabel,
  alertSeverityLabel,
  auctionStatusLabel,
  buildingDisplayName,
  buildingStateLabel,
  buildingTypeLabel,
  constructionKindLabel,
  crewDisplayName,
  developmentCodeLabel,
  formatGameDate,
  formatGameDuration,
  insuranceCoverageLabel,
  insuranceStatusLabel,
  landUseLabel,
  loanStatusLabel,
  maintenancePolicyLabel,
  ordinanceStatusLabel,
  organizationDisplayName,
  parcelDispositionLabel,
  permitStatusLabel,
  tenantProfileLabel,
  transactionLabel,
  urbanRoleLabel,
  zoningLabel,
} from "./labels";

const CALENDAR = { ticksPerMonth: 36_000, ticksPerDay: 1_200, daysPerMonth: 30 };

/** Heurística de fuga de vocabulario técnico: snake_case, IDs y ticks nunca salen de la UI. */
function leaksTechnicalVocabulary(label: string): boolean {
  return /_[a-z]|org_|crew_|parcel_|building_\d|tick/i.test(label);
}

describe("V.d-UX · calendario legible", () => {
  it("convierte ticks a fechas de juego sin mostrar la palabra tick", () => {
    expect(formatGameDate(0, CALENDAR)).toBe("1 de enero");
    expect(formatGameDate(1_200 * 16, CALENDAR)).toBe("17 de enero");
    expect(formatGameDate(36_000 + 1_200 * 16, CALENDAR)).toBe("17 de febrero");
    expect(formatGameDate(13 * 36_000, CALENDAR)).toBe("1 de febrero (mes 14)");
    for (const tick of [0, 1_199, 36_000, 36_001, 500_000])
      expect(formatGameDate(tick, CALENDAR)).not.toMatch(/tick/i);
  });

  it("expresa duraciones en horas, días y meses", () => {
    expect(formatGameDuration(0, CALENDAR)).toBe("ahora");
    expect(formatGameDuration(600, CALENDAR)).toBe("12 horas");
    expect(formatGameDuration(1_200, CALENDAR)).toBe("1 día");
    expect(formatGameDuration(2_400, CALENDAR)).toBe("2 días");
    expect(formatGameDuration(36_000, CALENDAR)).toBe("1 mes");
    expect(formatGameDuration(36_000 + 4_800, CALENDAR)).toBe("1 mes y 4 días");
    expect(formatGameDuration(80_000, CALENDAR)).toBe("2 meses y 7 días");
  });
});

describe("V.d-UX · vocabulario del jugador", () => {
  it("los 15 tipos de edificio tienen nombre legible y ninguno filtra el enum", () => {
    const types = buildingTypeSchema.options;
    expect(types).toHaveLength(15);
    const labels = types.map((type) => buildingTypeLabel(type));
    expect(new Set(labels).size).toBe(15);
    for (const [index, label] of labels.entries()) {
      expect(label, types[index]).not.toBe(types[index]);
      expect(leaksTechnicalVocabulary(label), label).toBe(false);
    }
    expect(buildingDisplayName("courtyard_home", 2)).toBe("Patio residencial 2");
  });

  it("los estados, usos y códigos se traducen sin enums crudos", () => {
    expect(buildingStateLabel("operational")).toBe("En servicio");
    expect(buildingStateLabel("collapse_pending")).toBe("Colapso inminente");
    expect(landUseLabel("office")).toBe("Oficinas");
    expect(zoningLabel("mixed")).toBe("Mixta");
    expect(urbanRoleLabel("commercial_corridor")).toBe("Corredor comercial");
    expect(parcelDispositionLabel("public")).toBe("Suelo municipal");
    expect(tenantProfileLabel("shopkeeper")).toBe("comerciante");
    expect(constructionKindLabel("clear_ruin")).toBe("Desescombro");
    for (const code of [
      "res_low_2f",
      "res_urban_4f",
      "mixed_core_5f",
      "commercial_corridor_4f",
      "industrial_yard_2f",
      "institutional_3f",
      "civic_landmark_5f",
    ]) {
      const label = developmentCodeLabel(code);
      expect(label).not.toBe(code);
      expect(leaksTechnicalVocabulary(label), label).toBe(false);
    }
  });

  it("los estados técnicos de permiso, préstamo, subasta y seguro no llegan crudos", () => {
    for (const status of ["approved", "denied", "expired", "consumed"] as const) {
      expect(permitStatusLabel(status)).not.toBe(status);
      expect(leaksTechnicalVocabulary(permitStatusLabel(status))).toBe(false);
    }
    for (const status of ["active", "delinquent", "paid_off", "defaulted"] as const)
      expect(loanStatusLabel(status)).not.toBe(status);
    expect(auctionStatusLabel("awarded")).toBe("adjudicada");
    expect(insuranceCoverageLabel("fire_plus")).toBe("Cobertura ampliada");
    expect(insuranceStatusLabel("lapsed")).toBe("vencida");
    expect(maintenancePolicyLabel("deferred")).toBe("diferida");
    expect(ordinanceStatusLabel("proposed")).toBe("propuesta disponible");
    expect(alertSeverityLabel("high")).toBe("urgente");
    expect(alertCategoryLabel("occupancy")).toBe("Propiedades");
  });

  it("traduce organizaciones, cuadrillas y movimientos de caja sin IDs", () => {
    expect(organizationDisplayName("org_00000001")).toBe("Tu empresa");
    expect(organizationDisplayName("org_00000004")).toBe("Ayuntamiento");
    expect(organizationDisplayName("org_99999999")).toBe("Organización externa");
    expect(organizationDisplayName(null)).toBe("Sin propietario");
    expect(crewDisplayName("crew_00000002")).toBe("Cuadrilla 2");
    expect(crewDisplayName("crew_sin_numero")).toBe("Cuadrilla");
    expect(leaksTechnicalVocabulary(crewDisplayName("crew_00000002"))).toBe(false);
    expect(transactionLabel("rent_collection")).toBe("cobro de renta");
    expect(transactionLabel("causa_desconocida_xyz")).toBe("movimiento de caja");
  });
});
