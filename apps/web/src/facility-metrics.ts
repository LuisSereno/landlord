import type { FacilityServiceMetrics } from "@landlord/shared";

/**
 * Línea de carga de una facility para el inspector (H2.1-01). Existe como función pura porque el
 * texto ES el contrato: hasta V.d-H2 el inspector escribía `cobertura: served/demand %`, una
 * magnitud que no era cobertura de nada —con spill-in podía pasar de 100 y con demanda primaria 0
 * no existía—. Cada cifra va etiquetada con su unidad y ninguna se llama cobertura.
 */
export function facilityMetricsSummary(metrics: FacilityServiceMetrics | null): string {
  if (!metrics) return "sin informe de carga";
  return (
    [
      `atendidas: ${metrics.served}`,
      `capacidad: ${metrics.effectiveCapacity}`,
      `utilización: ${metrics.utilizationPercent} %`,
      `demanda primaria: ${metrics.firstChoiceDemand}`,
    ].join(" / ") + (metrics.saturated ? " · sin hueco libre" : "")
  );
}
