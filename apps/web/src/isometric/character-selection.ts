import type { RuntimeAssetManifestV2 } from "@landlord/shared";

export const KENNEY_CHARACTER_IDS = [
  "civilian_male_a",
  "civilian_male_b",
  "civilian_female_a",
  "civilian_female_b",
  "supervisor",
  "construction_worker_a",
  "construction_worker_b",
  "maintenance_technician",
  "enforcer_male",
  "enforcer_female",
  "police",
  "firefighter",
  "medical_professional",
  "municipal_professional",
] as const;

export type KenneyCharacterId = (typeof KENNEY_CHARACTER_IDS)[number];

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function variant(id: string, choices: readonly string[]): string {
  return choices[stableHash(id) % choices.length]!;
}

function available(manifest: RuntimeAssetManifestV2, preferred: string, legacy: string): string {
  return manifest.characters[preferred] ? preferred : legacy;
}

export function crewCharacterFor(
  manifest: RuntimeAssetManifestV2,
  specialty: string,
  agentId: string,
): string {
  switch (specialty) {
    case "supervisor":
      return available(manifest, "supervisor", "chr_worker");
    case "construction_worker":
      return available(
        manifest,
        variant(agentId, ["construction_worker_a", "construction_worker_b"]),
        "chr_worker",
      );
    case "maintenance_technician":
      return available(manifest, "maintenance_technician", "chr_worker");
    case "enforcer":
      return available(
        manifest,
        variant(agentId, ["enforcer_male", "enforcer_female"]),
        "chr_worker",
      );
    default:
      return available(manifest, "construction_worker_a", "chr_worker");
  }
}

export function actorCharacterFor(
  manifest: RuntimeAssetManifestV2,
  legacyCharacter: string,
  actorId: string,
  actorClass?: string,
): string {
  if (actorClass === "municipal") {
    return available(manifest, "municipal_professional", legacyCharacter);
  }
  switch (legacyCharacter) {
    case "chr_citizen":
      return available(
        manifest,
        variant(actorId, [
          "civilian_male_a",
          "civilian_male_b",
          "civilian_female_a",
          "civilian_female_b",
        ]),
        legacyCharacter,
      );
    case "chr_worker":
      return available(
        manifest,
        variant(actorId, ["construction_worker_a", "construction_worker_b"]),
        legacyCharacter,
      );
    case "chr_police":
      return available(manifest, "police", legacyCharacter);
    case "chr_firefighter":
      return available(manifest, "firefighter", legacyCharacter);
    case "chr_medical":
      return available(manifest, "medical_professional", legacyCharacter);
    default:
      return available(manifest, "municipal_professional", legacyCharacter);
  }
}
