import { describe, expect, it } from "vitest";

import {
  districtGenerationSeed,
  parseCityId,
  parseCityProfileId,
  parseSeed,
  roadCellsFromSegments,
  roadCorridorCellsFromSegments,
  roadProfileForTopology,
} from "@landlord/shared";

import {
  adjacentPairs,
  canonicalSlots,
  districtIdForSlot,
  gatewayCellForSide,
  gatewayCellsByDistrict,
  parcelIdOrdinalForSlot,
  resolveCityProfile,
} from "./city";
import { generateDistrictFromProfile } from "./district-generator";
import { resolveDistrictProfile } from "./district-profiles";
import { cellKey } from "./urban-fabric";

/**
 * V.l.4 (D-104) · costura inter-distrito. El corredor se recorta en el borde del distrito en vez de
 * desplazarse, así que había que comprobar que la abertura compartida sigue siendo suelo vial en los
 * dos lados: si el corredor de un distrito se comiera el gateway del vecino, la ciudad quedaría
 * cosida por un punto no transitable.
 */
describe("V.l.4 · costura inter-distrito con corredor transversal", () => {
  it("los gateways de cada par son suelo vial en los dos distritos, con corredor y con eje", () => {
    const cityProfile = resolveCityProfile(parseCityProfileId("ciudad_del_umbral_v1"));
    const cityId = parseCityId("city_00000001");
    const gateways = gatewayCellsByDistrict();
    let corridorDistricts = 0;
    let axisDistricts = 0;

    for (const citySeed of [7, 80]) {
      const ground = new Map<string, ReadonlySet<string>>();
      for (const slot of canonicalSlots(cityProfile)) {
        const profile = resolveDistrictProfile(slot.districtProfileId);
        const districtId = districtIdForSlot(slot.slotX, slot.slotY);
        const district = generateDistrictFromProfile(
          profile,
          districtGenerationSeed({
            citySeed: parseSeed(citySeed),
            cityProfileId: cityProfile.id,
            slotX: slot.slotX,
            slotY: slot.slotY,
            districtProfileId: profile.id,
          }),
          {
            districtId,
            parcelIdOrdinal: parcelIdOrdinalForSlot(slot.slotX, slot.slotY),
            gatewayCells: gateways.get(districtId) ?? [],
            cityId,
          },
        );
        if (district.roads.derivationVersion === 4) corridorDistricts += 1;
        else axisDistricts += 1;
        ground.set(
          districtId,
          district.roads.derivationVersion === 4
            ? roadCorridorCellsFromSegments(district.roads.segments, (roadClass) =>
                roadProfileForTopology(district.roads, roadClass),
              )
            : roadCellsFromSegments(district.roads.segments),
        );
      }

      for (const pair of adjacentPairs()) {
        const leftId = districtIdForSlot(pair.slotX, pair.slotY);
        const rightId = districtIdForSlot(pair.neighbourSlotX, pair.neighbourSlotY);
        const leftCell = gatewayCellForSide(pair.side);
        const rightCell = gatewayCellForSide(pair.neighbourSide);
        const label = `seed ${citySeed} · ${leftId}↔${rightId}`;
        expect(ground.get(leftId)!.has(cellKey(leftCell)), `${label} izquierda`).toBe(true);
        expect(ground.get(rightId)!.has(cellKey(rightCell)), `${label} derecha`).toBe(true);
        // Las dos aberturas son la misma costura vista desde cada lado: borde opuesto y misma
        // coordenada perpendicular. Si el corredor desplazara la sección en vez de recortarla,
        // esto seguiría pasando pero el gateway dejaría de ser vial en alguno de los dos.
        if (pair.side === "east") {
          expect(leftCell.x, label).toBe(63);
          expect(rightCell.x, label).toBe(0);
          expect(leftCell.y, label).toBe(rightCell.y);
        } else {
          expect(leftCell.y, label).toBe(63);
          expect(rightCell.y, label).toBe(0);
          expect(leftCell.x, label).toBe(rightCell.x);
        }
      }
    }

    // El test no puede ser vacuo: la ciudad mezcla distritos con corredor y distritos de eje.
    expect(corridorDistricts).toBeGreaterThan(0);
    expect(axisDistricts).toBeGreaterThan(0);
  });
});
