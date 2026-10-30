import { describe, expect, it } from "vitest";

import { facilityMetricsSummary } from "./facility-metrics";
import type { FacilityServiceMetrics } from "@landlord/shared";

/**
 * H2.1-01 · el texto del inspector es parte del contrato. Antes leía
 * `cobertura: 1200 % (36/3 parcelas · capacidad 37)`: una cifra etiquetada como cobertura que era
 * `served / firstChoiceDemand`, y esa división no es un porcentaje de nada.
 */
const spillReceiver: FacilityServiceMetrics = {
  firstChoiceDemand: 3,
  effectiveCapacity: 37,
  served: 36,
  utilizationPercent: 97,
  saturated: false,
};

describe("H2.1-01 · texto de carga de facility", () => {
  it("enuncia las cuatro magnitudes con su nombre y nunca las llama cobertura", () => {
    const text = facilityMetricsSummary(spillReceiver);
    expect(text).toContain("atendidas: 36");
    expect(text).toContain("capacidad: 37");
    expect(text).toContain("utilización: 97 %");
    expect(text).toContain("demanda primaria: 3");
    expect(text.toLowerCase()).not.toContain("cobertura");
    expect(text.toLowerCase()).not.toContain("coverage");
    /** El único porcentaje del texto es la utilización; la división prohibida no aparece. */
    expect(text.match(/\d+ %/g)).toEqual(["97 %"]);
    expect(text).not.toContain("36 / 3");
  });

  it("distingue 'sin hueco libre' de la falta de capacidad", () => {
    expect(
      facilityMetricsSummary({
        ...spillReceiver,
        served: 37,
        utilizationPercent: 100,
        saturated: true,
      }),
    ).toContain("· sin hueco libre");
    expect(facilityMetricsSummary({ ...spillReceiver, saturated: false })).not.toContain(
      "sin hueco libre",
    );
    /** Facility apagada: capacidad 0 y utilización 0, sin etiqueta de saturación. */
    const offline = facilityMetricsSummary({
      firstChoiceDemand: 0,
      effectiveCapacity: 0,
      served: 0,
      utilizationPercent: 0,
      saturated: false,
    });
    expect(offline).toContain("capacidad: 0");
    expect(offline).toContain("utilización: 0 %");
    expect(offline).not.toContain("sin hueco libre");
  });

  it("sin informe no hay número inventado", () => {
    expect(facilityMetricsSummary(null)).toBe("sin informe de carga");
  });
});
