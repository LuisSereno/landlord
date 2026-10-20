import type { ViewProjectionV1 } from "@landlord/shared";
import { parseTick } from "@landlord/shared";
import { type GameState } from "./state";

export function createViewProjection(state: GameState): ViewProjectionV1 {
  return {
    projectionVersion: 1,
    tick: parseTick(state.clock.tick),
    map: { width: 64, height: 64 },
    structures: [...state.structures.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((structure) => ({
        id: structure.id,
        ownerOrganizationId: structure.ownerOrganizationId,
        cell: { ...structure.cell },
      })),
    agents: [...state.agents.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((agent) => ({ id: agent.id, cell: { ...agent.cell } })),
  };
}
