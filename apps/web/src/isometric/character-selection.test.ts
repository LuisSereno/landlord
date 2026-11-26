import { describe, expect, it } from "vitest";
import type { RuntimeAssetManifestV2 } from "@landlord/shared";
import { actorCharacterFor, crewCharacterFor, KENNEY_CHARACTER_IDS } from "./character-selection";

const manifest = {
  characters: Object.fromEntries(
    [...KENNEY_CHARACTER_IDS, "chr_worker", "chr_citizen"].map((id) => [
      id,
      {
        id,
        name: id,
        directions: 4,
        animations: {
          idle: { frameDurationMs: 400, frames: [] },
          walk: { frameDurationMs: 180, frames: [] },
        },
      },
    ]),
  ),
} as unknown as RuntimeAssetManifestV2;

describe("approved Kenney character selection", () => {
  it("maps operational specialties and keeps A/B variants deterministic", () => {
    expect(crewCharacterFor(manifest, "supervisor", "agent-1")).toBe("supervisor");
    expect(crewCharacterFor(manifest, "maintenance_technician", "agent-1")).toBe(
      "maintenance_technician",
    );
    const first = crewCharacterFor(manifest, "construction_worker", "agent-1");
    expect(["construction_worker_a", "construction_worker_b"]).toContain(first);
    expect(crewCharacterFor(manifest, "construction_worker", "agent-1")).toBe(first);
    expect(["enforcer_male", "enforcer_female"]).toContain(
      crewCharacterFor(manifest, "enforcer", "agent-2"),
    );
  });

  it("maps ambient and professional actors without inventing domain roles", () => {
    expect(actorCharacterFor(manifest, "chr_police", "actor-1", "police")).toBe("police");
    expect(actorCharacterFor(manifest, "chr_medical", "actor-1", "medical")).toBe(
      "medical_professional",
    );
    expect(actorCharacterFor(manifest, "chr_citizen", "actor-1", "municipal")).toBe(
      "municipal_professional",
    );
    expect([
      "civilian_male_a",
      "civilian_male_b",
      "civilian_female_a",
      "civilian_female_b",
    ]).toContain(actorCharacterFor(manifest, "chr_citizen", "actor-2"));
  });

  it("retains legacy fallback when a promoted character is absent", () => {
    const legacyOnly = {
      characters: { chr_worker: manifest.characters.chr_worker },
    } as unknown as RuntimeAssetManifestV2;
    expect(crewCharacterFor(legacyOnly, "supervisor", "agent-1")).toBe("chr_worker");
    expect(actorCharacterFor(legacyOnly, "chr_police", "actor-1", "police")).toBe("chr_police");
  });
});
