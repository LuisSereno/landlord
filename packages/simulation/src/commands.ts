import {
  parseEventId,
  parseStructureId,
  type ErrorCode,
  type PlaceTestStructure,
  type TestStructurePlaced,
} from "@landlord/shared";
import { hasOrganizationControl, type GameState } from "./state";

export type CommandRejection = {
  accepted: false;
  code: ErrorCode;
};

/** The event is delivered to current consumers and is not retained in GameState. */
export type CommandAcceptance = {
  accepted: true;
  event: TestStructurePlaced;
};

export type CommandResult = CommandRejection | CommandAcceptance;

function inMap(state: GameState, cell: { x: number; y: number }): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < state.map.width && cell.y < state.map.height;
}

function cellKey(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

function nextEntityId(prefix: "structure" | "event", value: number): string {
  return `${prefix}_${String(value).padStart(8, "0")}`;
}

function hasStructureAt(state: GameState, cell: { x: number; y: number }): boolean {
  const key = cellKey(cell);
  return [...state.structures.values()].some((structure) => cellKey(structure.cell) === key);
}

export function dispatchPlaceTestStructure(
  state: GameState,
  command: PlaceTestStructure,
): CommandResult {
  if (state.processedCommandIds.has(command.commandId)) {
    return { accepted: false, code: "DUPLICATE_COMMAND" };
  }
  if (!state.persons.has(command.issuedByPersonId)) {
    return { accepted: false, code: "PERSON_NOT_FOUND" };
  }
  if (!state.organizations.has(command.actingAsOrganizationId)) {
    return { accepted: false, code: "ORGANIZATION_NOT_FOUND" };
  }
  if (!hasOrganizationControl(state, command.issuedByPersonId, command.actingAsOrganizationId)) {
    return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
  }
  if (!inMap(state, command.payload.cell)) {
    return { accepted: false, code: "CELL_OUT_OF_BOUNDS" };
  }
  if (
    state.map.blockedCells.has(cellKey(command.payload.cell)) ||
    hasStructureAt(state, command.payload.cell)
  ) {
    return { accepted: false, code: "CELL_OCCUPIED" };
  }

  const structureCounter = state.idCounters.structure + 1;
  const eventCounter = state.idCounters.event + 1;
  const structureId = parseStructureId(nextEntityId("structure", structureCounter));
  const eventId = parseEventId(nextEntityId("event", eventCounter));
  const event: TestStructurePlaced = {
    eventId,
    tick: state.clock.tick,
    causationCommandId: command.commandId,
    type: "TestStructurePlaced",
    payload: {
      structureId,
      ownerOrganizationId: command.actingAsOrganizationId,
      cell: { ...command.payload.cell },
    },
  };

  state.idCounters.structure = structureCounter;
  state.idCounters.event = eventCounter;
  state.structures.set(structureId, {
    id: structureId,
    ownerOrganizationId: command.actingAsOrganizationId,
    cell: { ...command.payload.cell },
  });
  state.processedCommandIds.add(command.commandId);

  return { accepted: true, event };
}
