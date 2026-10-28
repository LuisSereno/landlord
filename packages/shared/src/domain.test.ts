import { describe, expect, it } from "vitest";

import {
  organizationControlGrantSchema,
  organizationSchema,
  personSchema,
  placeTestStructureSchema,
  playerIdentitySchema,
  testStructurePlacedSchema,
  testStructureSchema,
} from "./domain";

describe("Gate 1 domain contracts", () => {
  it("keeps person, organization, control and ownership separate", () => {
    expect(
      playerIdentitySchema.parse({ id: "player_00000001", personId: "person_00000001" }),
    ).toEqual({ id: "player_00000001", personId: "person_00000001" });
    expect(personSchema.parse({ id: "person_00000001" })).toEqual({ id: "person_00000001" });
    expect(organizationSchema.parse({ id: "org_00000001", kind: "company" })).toEqual({
      id: "org_00000001",
      kind: "company",
    });
    expect(
      organizationControlGrantSchema.parse({
        personId: "person_00000001",
        organizationId: "org_00000001",
      }),
    ).toEqual({ personId: "person_00000001", organizationId: "org_00000001" });
    expect(
      testStructureSchema.parse({
        id: "structure_00000001",
        ownerOrganizationId: "org_00000002",
        districtId: "district_00000004",
        cell: { x: 10, y: 12 },
      }).ownerOrganizationId,
    ).toBe("org_00000002");
  });

  it("validates the technical command and causal event", () => {
    expect(
      placeTestStructureSchema.parse({
        commandId: "command-9",
        issuedByPersonId: "person_00000001",
        actingAsOrganizationId: "org_00000001",
        type: "PlaceTestStructure",
        payload: { districtId: "district_00000004", cell: { x: 10, y: 12 } },
      }).type,
    ).toBe("PlaceTestStructure");
    expect(
      testStructurePlacedSchema.parse({
        eventId: "event-1",
        tick: 1,
        causationCommandId: "command-9",
        type: "TestStructurePlaced",
        payload: {
          structureId: "structure_00000001",
          ownerOrganizationId: "org_00000001",
          cell: { x: 10, y: 12 },
        },
      }).payload.structureId,
    ).toBe("structure_00000001");
  });

  it("rejects missing actor, invalid ownership IDs and wrong event discriminants", () => {
    expect(() =>
      placeTestStructureSchema.parse({
        commandId: "command-9",
        actingAsOrganizationId: "org_00000001",
        type: "PlaceTestStructure",
        payload: { districtId: "district_00000004", cell: { x: 10, y: 12 } },
      }),
    ).toThrow();
    expect(() =>
      testStructureSchema.parse({
        id: "structure_00000001",
        ownerOrganizationId: "person_00000001",
        cell: { x: 10, y: 12 },
      }),
    ).toThrow();
    expect(() =>
      testStructurePlacedSchema.parse({
        eventId: "event-1",
        tick: 1,
        causationCommandId: "command-9",
        type: "WrongEvent",
        payload: {
          structureId: "structure_00000001",
          ownerOrganizationId: "org_00000001",
          cell: { x: 10, y: 12 },
        },
      }),
    ).toThrow();
  });
});
