import type { Building, ParcelId } from "@landlord/shared";
import { canonicalParcelIds } from "@landlord/shared";

/**
 * V.d-7 · el valor de un edificio multi-parcela se reparte entre sus parcelas para que el índice
 * multi-parcela no lo cuente una vez por cada una. Reparto determinista y exacto:
 * `floor(value / n)` para todas y el resto (+1) a las primeras `remainder` en orden canónico.
 * La suma de las contribuciones es SIEMPRE el valor completo, sin residuo perdido.
 */
export function buildingCollateralContribution(
  building: Pick<Building, "parcelIds">,
  parcelId: ParcelId,
  value: number,
): number {
  const ids = canonicalParcelIds(building.parcelIds);
  const index = ids.indexOf(parcelId);
  if (index < 0) return 0;
  const base = Math.floor(value / ids.length);
  const remainder = value % ids.length;
  return base + (index < remainder ? 1 : 0);
}

/** Valor de tasación del edificio según la base usada por cada flujo (coste o coste por condición). */
export function collateralBuildingValue(
  building: Pick<Building, "condition">,
  cost: number,
  basis: "cost" | "condition",
): number {
  return basis === "cost" ? cost : Math.round((cost * building.condition) / 100);
}
