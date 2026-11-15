import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CityView } from "../CityView";
import { CollapsibleSection } from "./hubs";
import { PlacementPanel } from "./placement-panel";
import {
  beginPlacementRequest,
  placementAnswerReceived,
  type PlacementHandlers,
} from "./placement";

const handlers: PlacementHandlers = {
  cancel: () => undefined,
  confirm: () => undefined,
  cycle: () => undefined,
  rotate: () => undefined,
  select: () => undefined,
};

const pending = placementAnswerReceived(
  beginPlacementRequest({
    buildingType: "courtyard_home",
    districtId: "district_00000001",
    parcelIds: ["parcel_00000001"],
  }),
  {
    districtId: "district_00000001",
    parcelIds: ["parcel_00000001"],
    buildingType: "courtyard_home",
    totalCandidates: 2,
    rejection: null,
    candidates: [
      {
        id: "placement_00000001",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
        footprintCells: [{ x: 2, y: 3 }],
        orientation: 0,
        floors: 1,
        recommended: true,
      },
      {
        id: "placement_00000002",
        districtId: "district_00000001",
        parcelIds: ["parcel_00000001"],
        footprintCells: [{ x: 4, y: 5 }],
        orientation: 90,
        floors: 1,
        recommended: false,
      },
    ],
  } as never,
);

const districts = [
  {
    id: "district_00000001",
    name: "Barrio del Umbral",
    role: "urban_residential",
    slotX: 1,
    slotY: 1,
    ownBuildings: 2,
    rivalBuildings: 1,
    vacantUnits: 4,
    rentIndexPercent: 105,
    averageLandValue: 1200,
    marketableParcels: 8,
    alerts: 1,
    facilities: 2,
    publicSpaces: 1,
  },
  {
    id: "district_00000002",
    name: "Barrio del Taller",
    role: "mixed_core",
    slotX: 2,
    slotY: 1,
    ownBuildings: 0,
    rivalBuildings: 3,
    vacantUnits: 7,
    rentIndexPercent: 97,
    averageLandValue: 900,
    marketableParcels: 12,
    alerts: 0,
    facilities: 1,
    publicSpaces: 0,
  },
] as never;

describe("UX de descubribilidad", () => {
  it("prioriza el mapa y mantiene las alternativas de ubicación bajo demanda", () => {
    const markup = renderToStaticMarkup(<PlacementPanel handlers={handlers} pending={pending} />);

    expect(markup).toContain("Ver alternativas (2)");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('aria-label="Colocaciones legales"');
    expect(markup).toContain("El mapa muestra la ubicación seleccionada");
  });

  it("resume los distritos y expone el detalle completo sólo para el observado", () => {
    const markup = renderToStaticMarkup(
      <CityView
        districts={districts}
        observedDistrictId="district_00000001"
        onSelect={() => undefined}
      />,
    );

    expect(markup).toContain("4 vacantes · 8 solares libres");
    expect(markup).toContain("Suelo medio 1200 u.");
    expect(markup).toContain("2 propias · 1 rival · renta 105%");
    expect(markup).not.toContain("0 propias · 3 rival · renta 97%");
  });

  it("deja Ordenanza abierta y las secciones secundarias plegadas", () => {
    const open = renderToStaticMarkup(
      <CollapsibleSection defaultOpen summary="Propuesta disponible" title="Ordenanza vigente">
        <p>Contenido de ordenanza</p>
      </CollapsibleSection>,
    );
    const closed = renderToStaticMarkup(
      <CollapsibleSection summary="Propiedad 1.2 % mensual" title="Fiscalidad">
        <p>Contenido fiscal</p>
      </CollapsibleSection>,
    );

    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain("Contenido de ordenanza");
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain("Contenido fiscal");
  });
});
