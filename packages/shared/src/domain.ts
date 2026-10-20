import { z } from "zod";

import {
  commandIdSchema,
  eventIdSchema,
  organizationIdSchema,
  personIdSchema,
  playerIdentityIdSchema,
  structureIdSchema,
  type CommandId,
  type EventId,
  type OrganizationId,
  type PersonId,
  type PlayerIdentityId,
  type StructureId,
} from "./primitives";
import { gridCellSchema, tickSchema, type GridCell, type Tick } from "./time-and-grid";

export type PlayerIdentity = {
  id: PlayerIdentityId;
  personId: PersonId;
};

export type Person = {
  id: PersonId;
};

export type Organization = {
  id: OrganizationId;
  kind: "company";
};

export type OrganizationControlGrant = {
  personId: PersonId;
  organizationId: OrganizationId;
};

export type TestStructure = {
  id: StructureId;
  ownerOrganizationId: OrganizationId;
  cell: GridCell;
};

export const playerIdentitySchema = z.object({
  id: playerIdentityIdSchema,
  personId: personIdSchema,
});

export const personSchema = z.object({
  id: personIdSchema,
});

export const organizationSchema = z.object({
  id: organizationIdSchema,
  kind: z.literal("company"),
});

export const organizationControlGrantSchema = z.object({
  personId: personIdSchema,
  organizationId: organizationIdSchema,
});

export const testStructureSchema = z.object({
  id: structureIdSchema,
  ownerOrganizationId: organizationIdSchema,
  cell: gridCellSchema,
});

export type PlaceTestStructure = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
  type: "PlaceTestStructure";
  payload: {
    cell: GridCell;
  };
};

export const placeTestStructureSchema = z.object({
  commandId: commandIdSchema,
  issuedByPersonId: personIdSchema,
  actingAsOrganizationId: organizationIdSchema,
  type: z.literal("PlaceTestStructure"),
  payload: z.object({
    cell: gridCellSchema,
  }),
});

export type TestStructurePlaced = {
  eventId: EventId;
  tick: Tick;
  causationCommandId: CommandId;
  type: "TestStructurePlaced";
  payload: {
    structureId: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  };
};

export const testStructurePlacedSchema = z.object({
  eventId: eventIdSchema,
  tick: tickSchema,
  causationCommandId: commandIdSchema,
  type: z.literal("TestStructurePlaced"),
  payload: z.object({
    structureId: structureIdSchema,
    ownerOrganizationId: organizationIdSchema,
    cell: gridCellSchema,
  }),
});
