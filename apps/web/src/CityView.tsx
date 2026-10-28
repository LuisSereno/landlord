import type { PublicDistrictSummary } from "@landlord/shared";

const ROLE_LABELS: Record<string, string> = {
  civic_core: "Núcleo cívico",
  mixed_core: "Mixto",
  commercial_corridor: "Corredor comercial",
  urban_residential: "Residencial urbano",
  low_density_residential: "Residencial baja densidad",
  industrial_logistics: "Industria y logística",
  institutional: "Institucional",
  green_open_space: "Verde",
};

/**
 * Vista estratégica de ciudad: la cuadrícula 3×3 con un resumen comparable por distrito (D-088).
 * Seleccionar un distrito cambia sólo lo que dibuja el mapa; no es una acción de juego.
 */
export function CityView({
  districts,
  observedDistrictId,
  onSelect,
}: {
  districts: PublicDistrictSummary[];
  observedDistrictId: string;
  onSelect: (districtId: string) => void;
}) {
  const ordered = [...districts].sort(
    (left, right) => left.slotY - right.slotY || left.slotX - right.slotX,
  );
  return (
    <section className="side-panel" aria-label="Ciudad">
      <div className="panel-heading">
        <h3>Ciudad</h3>
        <span className="panel-hint">9 distritos · selecciona uno para verlo en el mapa</span>
      </div>
      <div className="city-grid" role="grid" aria-label="Distritos">
        {ordered.map((district) => {
          const selected = district.id === observedDistrictId;
          return (
            <button
              key={district.id}
              type="button"
              role="gridcell"
              className={selected ? "city-tile city-tile-selected" : "city-tile"}
              aria-pressed={selected}
              onClick={() => onSelect(district.id)}
            >
              <strong>{district.name}</strong>
              <span className="city-role">{ROLE_LABELS[district.role] ?? district.role}</span>
              <span>
                {district.ownBuildings} propias · {district.rivalBuildings} rival ·{" "}
                {district.vacantUnits} vacantes
              </span>
              <span>
                renta {district.rentIndexPercent}% · suelo {district.averageLandValue} u.
              </span>
              <span>
                {district.marketableParcels} parcelas libres
                {district.alerts > 0 ? ` · ${district.alerts} en alerta` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
