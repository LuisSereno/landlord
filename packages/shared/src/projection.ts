import { z } from "zod";

import {
  organizationIdSchema,
  structureIdSchema,
  agentIdSchema,
  type OrganizationId,
  type StructureId,
  type AgentId,
} from "./primitives";
import { gridCellSchema, tickSchema, type GridCell, type Tick } from "./time-and-grid";

export type ViewProjectionV1 = {
  projectionVersion: 1;
  tick: Tick;
  map: { width: 64; height: 64 };
  structures: Array<{
    id: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  }>;
  agents: Array<{
    id: AgentId;
    cell: GridCell;
  }>;
};

const mapSchema = z.object({
  width: z.literal(64),
  height: z.literal(64),
});

export const viewProjectionV1Schema = z.object({
  projectionVersion: z.literal(1),
  tick: tickSchema,
  map: mapSchema,
  structures: z.array(
    z.object({
      id: structureIdSchema,
      ownerOrganizationId: organizationIdSchema,
      cell: gridCellSchema,
    }),
  ),
  agents: z.array(
    z.object({
      id: agentIdSchema,
      cell: gridCellSchema,
    }),
  ),
});
