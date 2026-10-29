import { describe, expect, it } from "vitest";
import { DISTRICT_PROFILES, ZONING_ORDER } from "./district-profiles";
import {
  BUILDING_DEFINITIONS,
  LOAN_POLICY,
  MAINTENANCE_POLICY,
  MUNICIPAL_PARTY_CATALOG,
  MUNICIPAL_POLICY_CATALOG,
  PROTOTYPE_ORDINANCE,
  TAX_POLICY,
} from "./game-data";
import { FACTION_PROFILES, FACTION_ACTION_FAMILY } from "./factions";
import { HOUSING_SEGMENTS } from "./housing-segments";
import { MACRO_EVENT_LABELS, MACRO_EVENT_POLICY, MACRO_EVENT_TEMPLATES } from "./macro-events";
import { MUNICIPAL_INSTITUTION } from "./municipal-politics";
import { URBAN_SERVICE_POLICY } from "./urban-services";

describe("WP4.14 validación de datos", () => {
  it("los edificios declaran costes, obra, capacidad y zoning coherentes", () => {
    for (const [type, definition] of Object.entries(BUILDING_DEFINITIONS)) {
      expect(definition.type, type).toBe(type);
      expect(definition.cost, type).toBeGreaterThanOrEqual(0);
      expect(definition.workRequired, type).toBeGreaterThan(0);
      expect(definition.upgradeCost, type).toBeGreaterThanOrEqual(0);
      expect(definition.upgradeWorkRequired, type).toBeGreaterThan(0);
      expect(definition.capacity, type).toBeGreaterThanOrEqual(0);
      expect(definition.baseRent, type).toBeGreaterThanOrEqual(0);
      expect(definition.allowedUses.length, type).toBeGreaterThan(0);
      for (const use of definition.allowedUses) {
        expect(
          [
            "residential",
            "retail",
            "office",
            "industrial",
            "civic",
            "education",
            "health",
            "utility",
          ],
          type,
        ).toContain(use);
      }
      for (const amount of Object.values(definition.resources)) {
        expect(amount, type).toBeGreaterThanOrEqual(0);
      }
      if (definition.production) {
        expect(definition.production.cycleLength, type).toBeGreaterThan(0);
        expect(definition.production.outputAmount, type).toBeGreaterThan(0);
        expect(definition.capacity, type).toBe(0);
      }
    }
  });

  it("los segmentos de vivienda apuntan a tipos existentes y tienen demanda positiva", () => {
    for (const segment of Object.values(HOUSING_SEGMENTS)) {
      expect(segment.rentBudget).toBeGreaterThan(0);
      expect(segment.populationCap).toBeGreaterThan(0);
      expect(segment.arrivalsAtFullAppeal).toBeGreaterThan(0);
      expect(segment.preferredBuildingTypes.length).toBeGreaterThan(0);
      for (const type of segment.preferredBuildingTypes) {
        expect(Object.keys(BUILDING_DEFINITIONS)).toContain(type);
      }
      for (const weight of Object.values(segment.weights)) expect(weight).toBeGreaterThanOrEqual(0);
    }
  });

  it("el catálogo de ordenanzas tiene ids únicos y campos en rango", () => {
    const ids = MUNICIPAL_POLICY_CATALOG.map((policy) => policy.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const policy of MUNICIPAL_POLICY_CATALOG) {
      expect(policy.influenceRequired).toBeGreaterThan(0);
      expect(policy.approvalChancePercent).toBeGreaterThanOrEqual(0);
      expect(policy.approvalChancePercent).toBeLessThanOrEqual(100);
    }
    expect(ids).toContain(PROTOTYPE_ORDINANCE.id);
  });

  it("los partidos suman los escaños del concejo y no repiten id", () => {
    const ids = MUNICIPAL_PARTY_CATALOG.map((party) => party.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seats = MUNICIPAL_PARTY_CATALOG.reduce((total, party) => total + party.openingSeats, 0);
    expect(seats).toBe(MUNICIPAL_INSTITUTION.councilSeats);
    for (const party of MUNICIPAL_PARTY_CATALOG) {
      expect(Object.keys(party.positionByIssue)).toHaveLength(5);
      for (const position of Object.values(party.positionByIssue)) {
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(100);
      }
      expect(party.budgetPriority.length).toBeGreaterThan(0);
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  it("los macroeventos cubren los seis tipos con etiqueta y duración positiva", () => {
    const types = Object.keys(MACRO_EVENT_TEMPLATES);
    expect(types).toHaveLength(6);
    for (const type of types) {
      expect(MACRO_EVENT_LABELS[type as keyof typeof MACRO_EVENT_LABELS]).toBeTruthy();
      const template = MACRO_EVENT_TEMPLATES[type as keyof typeof MACRO_EVENT_TEMPLATES];
      expect(template.durationMonths).toBeGreaterThan(0);
      expect(Object.keys(template.modifiers).length).toBeGreaterThan(0);
    }
    expect(MACRO_EVENT_POLICY.maxActiveEvents).toBe(types.length);
    expect(MACRO_EVENT_POLICY.monthlyTriggerChancePercent).toBeGreaterThan(0);
    expect(MACRO_EVENT_POLICY.monthlyTriggerChancePercent).toBeLessThanOrEqual(100);
  });

  it("los perfiles de facción cubren todas las familias y umbrales válidos", () => {
    const families = new Set(Object.values(FACTION_ACTION_FAMILY));
    for (const profile of Object.values(FACTION_PROFILES)) {
      for (const family of families) {
        expect(profile.goalBiasByFamily[family]).toBeTypeOf("number");
      }
      expect(profile.minimumReservePercent).toBeGreaterThanOrEqual(0);
      expect(profile.minimumReservePercent).toBeLessThanOrEqual(100);
      expect(profile.maintenanceConditionThreshold).toBeGreaterThan(0);
      expect(profile.maintenanceConditionThreshold).toBeLessThanOrEqual(100);
      expect(profile.insuranceRiskThreshold).toBeGreaterThan(0);
      expect(profile.insuranceRiskThreshold).toBeLessThanOrEqual(100);
      expect(profile.contractBidPercent).toBeGreaterThan(0);
      expect(profile.contractBidPercent).toBeLessThanOrEqual(100);
    }
  });

  it("los perfiles de distrito caben en el mapa y declaran zoning completo", () => {
    for (const [id, profile] of Object.entries(DISTRICT_PROFILES)) {
      expect(profile.id, id).toBe(id);
      expect(profile.width).toBe(64);
      expect(profile.height).toBe(64);
      const cells = [
        profile.spawnAnchors.player,
        profile.spawnAnchors.rival,
        ...profile.anchorSlots.map((slot) => slot.cell),
      ];
      for (const cell of cells) {
        expect(cell.x, id).toBeGreaterThanOrEqual(0);
        expect(cell.x, id).toBeLessThan(64);
        expect(cell.y, id).toBeGreaterThanOrEqual(0);
        expect(cell.y, id).toBeLessThan(64);
      }
      for (const zoning of ZONING_ORDER) {
        expect(profile.priceBand[zoning][0], id).toBeLessThanOrEqual(profile.priceBand[zoning][1]);
        expect(profile.suitability[zoning], id).toBeDefined();
      }
      expect(profile.playability.minimumParcels, id).toBeGreaterThan(0);
      expect(profile.playability.maximumZoningSharePercent, id).toBeGreaterThan(0);
      expect(profile.playability.maximumZoningSharePercent, id).toBeLessThanOrEqual(100);
    }
  });

  it("las políticas numéricas conservan bandas válidas", () => {
    expect(TAX_POLICY.propertyRateBps).toBeGreaterThanOrEqual(0);
    expect(TAX_POLICY.propertyRateBps).toBeLessThanOrEqual(10_000);
    expect(TAX_POLICY.transferRateBps).toBeGreaterThanOrEqual(0);
    expect(TAX_POLICY.transferRateBps).toBeLessThanOrEqual(10_000);
    expect(LOAN_POLICY.minimumPrincipal).toBeLessThanOrEqual(LOAN_POLICY.maximumPrincipal);
    expect(LOAN_POLICY.allowedTermsMonths).toContain(12);
    expect(LOAN_POLICY.collateralLoanToValuePercent).toBeGreaterThan(0);
    expect(LOAN_POLICY.collateralLoanToValuePercent).toBeLessThanOrEqual(100);
    expect(MAINTENANCE_POLICY.wearPerSettlement).toBeGreaterThan(0);
    expect(MAINTENANCE_POLICY.recoveryPerSettlement).toBeGreaterThan(0);
    expect(Object.keys(MAINTENANCE_POLICY.costsByBuildingType).sort()).toEqual(
      Object.keys(BUILDING_DEFINITIONS).sort(),
    );
    for (const service of Object.values(URBAN_SERVICE_POLICY)) {
      expect(service.costPerBuilding).toBeGreaterThanOrEqual(0);
      expect(service.baseRadiusCells).toBeGreaterThan(0);
      expect(service.minimumRadiusCells).toBeGreaterThan(0);
    }
  });
});
