import { describe, expect, it } from "vitest";
import type { ViewProjectionV3 } from "@landlord/shared";
import {
  headquartersIdentityForProjection,
  organizationBadgeWorldSize,
  organizationIdentityFor,
  visibleOrganizationBadge,
  type OrganizationBadgeAnchor,
} from "./organization-identity";

function projection(identityId: "company_turquoise" | "rival_terracotta" | "municipal_blue") {
  return {
    bases: [{ organizationId: "org_owner", visualIdentityId: identityId }],
  } as unknown as ViewProjectionV3;
}

const badge = (overrides: Partial<OrganizationBadgeAnchor> = {}): OrganizationBadgeAnchor => ({
  detailId: "identity_front",
  mount: "face",
  side: "front",
  doubleSided: false,
  visible: true,
  anchor: { x: 0.34, y: 0.7 },
  widthPixels: 29,
  heightPixels: 24,
  widthMeters: 0.696,
  heightMeters: 0.58,
  physicalOrientationDegrees: 0,
  bakedOrganizationColor: null,
  ...overrides,
});

describe("D-110 organization identity overlay", () => {
  it("resolves player turquoise/diamond and rival terracotta/triangle from owner data", () => {
    expect(headquartersIdentityForProjection(projection("company_turquoise"), "org_owner")).toMatchObject({
      color: "#4DB6AC",
      emblem: "diamond",
    });
    expect(headquartersIdentityForProjection(projection("rival_terracotta"), "org_owner")).toMatchObject({
      color: "#D97757",
      emblem: "triangle",
    });
  });

  it("never guesses the player identity for an unknown owner", () => {
    expect(headquartersIdentityForProjection(projection("company_turquoise"), "org_other").id).toBe(
      "neutral",
    );
    expect(organizationIdentityFor(undefined).id).toBe("neutral");
  });

  it("keeps municipal blue explicitly reserved", () => {
    expect(organizationIdentityFor("municipal_blue")).toMatchObject({
      color: "#4F86C6",
      emblem: "diamond",
      reservedForMunicipality: true,
    });
  });

  it("selects the visible front/rear plaque and accepts a double-sided construction board", () => {
    expect(
      visibleOrganizationBadge([
        badge({ detailId: "front", visible: false }),
        badge({ detailId: "rear", side: "rear", visible: true }),
      ])?.detailId,
    ).toBe("rear");
    expect(
      visibleOrganizationBadge([
        badge({ detailId: "board", mount: "site", doubleSided: true, visible: true }),
      ])?.detailId,
    ).toBe("board");
    expect(visibleOrganizationBadge([badge({ visible: false })])).toBeNull();
  });

  it("keeps the QA badge readable at all capture zooms without changing its anchor", () => {
    expect(organizationBadgeWorldSize(badge(), 0.18, 0.5)).toBe(20);
    expect(organizationBadgeWorldSize(badge(), 0.18, 1)).toBe(10);
    expect(organizationBadgeWorldSize(badge(), 0.18, 1.5)).toBeCloseTo(10 / 1.5);
    expect(organizationBadgeWorldSize(badge(), 2, 0.5)).toBe(58);
  });
});
