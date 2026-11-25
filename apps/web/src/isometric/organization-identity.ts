import type { OrganizationVisualIdentityId, ViewProjectionV3 } from "@landlord/shared";

/**
 * D-110 organization identity is presentation data, never building state.
 *
 * The Composer bakes only a neutral plaque and recess. This module resolves the stable organization
 * identity from the projection and provides the color/shape redundancy used by the QA overlay. No
 * organization color is inferred from the player, the company id or the frame/seed.
 */
export type OrganizationEmblem = "diamond" | "triangle";

export type OrganizationIdentity = {
  id: OrganizationVisualIdentityId;
  color: string;
  emblem: OrganizationEmblem;
  /** Municipal blue is reserved and must never become a company fallback. */
  reservedForMunicipality?: boolean;
};

export const ORGANIZATION_IDENTITIES: Readonly<
  Partial<Record<OrganizationVisualIdentityId, OrganizationIdentity>>
> = {
  company_turquoise: { id: "company_turquoise", color: "#4DB6AC", emblem: "diamond" },
  rival_terracotta: { id: "rival_terracotta", color: "#D97757", emblem: "triangle" },
  municipal_blue: {
    id: "municipal_blue",
    color: "#4F86C6",
    emblem: "diamond",
    reservedForMunicipality: true,
  },
};

const NEUTRAL_IDENTITY: OrganizationIdentity = {
  id: "neutral",
  color: "#B8B0A2",
  emblem: "diamond",
};

export function organizationIdentityFor(
  identityId: OrganizationVisualIdentityId | null | undefined,
): OrganizationIdentity {
  if (!identityId) return NEUTRAL_IDENTITY;
  return ORGANIZATION_IDENTITIES[identityId] ?? NEUTRAL_IDENTITY;
}

/** Resolves by the owner organization published in `organizationBases`, not by `player == company`. */
export function headquartersIdentityForProjection(
  projection: ViewProjectionV3 | null | undefined,
  ownerOrganizationId: string | null | undefined,
): OrganizationIdentity {
  if (!projection || !ownerOrganizationId) return NEUTRAL_IDENTITY;
  const base = projection.bases.find((entry) => entry.organizationId === ownerOrganizationId);
  return organizationIdentityFor(base?.visualIdentityId);
}

export type OrganizationBadgeAnchor = {
  detailId: string;
  mount: "face" | "site";
  side: string;
  doubleSided: boolean;
  visible: boolean;
  anchor: { x: number; y: number };
  /** Projected size in the candidate PNG, before Phaser scaling. */
  widthPixels: number;
  heightPixels: number;
  widthMeters: number;
  heightMeters: number;
  physicalOrientationDegrees: number;
  bakedOrganizationColor: null;
};

/** Front/rear plaques are alternatives; a double-sided construction board is always eligible. */
export function visibleOrganizationBadge(
  badges: readonly OrganizationBadgeAnchor[],
): OrganizationBadgeAnchor | null {
  return badges.find((badge) => badge.visible) ?? null;
}

/**
 * QA readability floor: the mark stays attached to the facade but remains at least 10 screen px at
 * 0.5×/1×/1.5×. The natural size still scales with the building whenever it is larger.
 */
export function organizationBadgeWorldSize(
  badge: OrganizationBadgeAnchor,
  spriteScale: number,
  cameraZoom: number,
): number {
  const natural = Math.max(1, badge.widthPixels * spriteScale);
  return Math.max(natural, 10 / Math.max(0.1, cameraZoom));
}
