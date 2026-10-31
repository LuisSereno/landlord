import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_CITY_SEEDS } from "./city-fixtures";
import { canonicalSlots, districtIdForSlot, resolveCityProfile } from "./city";
import { resolveDistrictProfile } from "./district-profiles";
import { generatedIndustrialSites } from "./generated-sites";
import { selectDisjointSites } from "./generated-sites";
import { enumerateCompatibleDevelopmentSites } from "./development-site";
import { BUILDING_DEFINITIONS } from "./game-data";
import { createInitialState } from "./state";

const output = process.env.GENERATED_SITES_OUT;

describe.skipIf(!output)("V.d-7A.1 · capacidad industrial generada", () => {
  it("mide solares naturales con el buscador de dominio", () => {
    const profile = resolveCityProfile();
    const cities = CANONICAL_CITY_SEEDS.map((seed) => {
      const state = createInitialState(seed);
      const districts = canonicalSlots(profile).map((slot) => {
        const districtId = districtIdForSlot(slot.slotX, slot.slotY);
        const sites = generatedIndustrialSites(state, new Set([districtId]));
        return {
          districtId,
          profileId: slot.districtProfileId,
          dominantRole: resolveDistrictProfile(slot.districtProfileId).dominantRole,
          industrialParcels: [...state.phase2.parcels.values()].filter(
            (parcel) =>
              parcel.districtId === districtId &&
              parcel.disposition === "marketable" &&
              parcel.developmentCodeId === "industrial_logistics",
          ).length,
          twoParcelSites: sites.twoParcel.total,
          threeParcelSites: sites.threeParcel.total,
        };
      });
      const sites = generatedIndustrialSites(state);
      return {
        seed,
        totalMarketableParcels: [...state.phase2.parcels.values()].filter(
          (parcel) => parcel.disposition === "marketable",
        ).length,
        industrialParcels: districts.reduce((sum, district) => sum + district.industrialParcels, 0),
        validTwoParcelIndustrialSites: sites.twoParcel.total,
        validThreeParcelIndustrialSites: sites.threeParcel.total,
        disjointTwoParcelSites: sites.twoParcel.disjoint,
        disjointThreeParcelSites: sites.threeParcel.disjoint,
        districts,
      };
    });
    const evidence = { contract: "findDevelopmentSite-compatible physical capacity", cities };
    mkdirSync(dirname(output!), { recursive: true });
    writeFileSync(output!, `${JSON.stringify(evidence, null, 2)}\n`);
    expect(cities).toHaveLength(12);
  }, 180_000);
});

describe("V.d-7A.1 · determinismo de enumeración", () => {
  it("no depende del orden de inserción de parcelas ni del orden de candidates disjuntos", () => {
    const state = createInitialState(42);
    const parcels = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.disposition === "marketable",
    );
    const normal = enumerateCompatibleDevelopmentSites({
      parcels,
      definition: BUILDING_DEFINITIONS.steelworks,
    });
    const shuffled = enumerateCompatibleDevelopmentSites({
      parcels: [...parcels].reverse(),
      definition: BUILDING_DEFINITIONS.steelworks,
    });
    expect(shuffled).toEqual(normal);
    expect(selectDisjointSites([...normal].reverse())).toEqual(selectDisjointSites(normal));
  });
});
