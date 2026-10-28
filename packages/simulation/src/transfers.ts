import { parseTick, type DistrictId, type Tick } from "@landlord/shared";

import type { GameState } from "./state";

/**
 * Traslado de cuadrillas y agentes entre distritos (D-088, plan §3.7).
 *
 * El viaje usa el grafo de ciudad —conexiones con coste entero— y no teletransporta a nadie: el
 * agente queda no disponible hasta llegar, y aparece en la celda del gateway por el que entró. No
 * tiene coste monetario. La ruta se decide con Dijkstra sobre las conexiones y desempata por id, así
 * que dos partidas con la misma seed y los mismos comandos viajan igual.
 */

/** Ticks de juego por unidad de coste de conexión: coste 4 = 60 ticks = 1,2 h de juego. */
export const TRANSFER_TICKS_PER_COST = 15;

export type DistrictRoute = {
  /** Distritos intermedios y destino, sin incluir el origen. */
  route: DistrictId[];
  cost: number;
};

/** Dijkstra determinista sobre las conexiones de la ciudad. */
export function districtRoute(
  state: GameState,
  fromDistrictId: DistrictId,
  toDistrictId: DistrictId,
): DistrictRoute | null {
  if (fromDistrictId === toDistrictId) return { route: [], cost: 0 };
  const distances = new Map<DistrictId, number>([[fromDistrictId, 0]]);
  const previous = new Map<DistrictId, DistrictId>();
  const settled = new Set<DistrictId>();
  const frontier: Array<{ districtId: DistrictId; cost: number }> = [
    { districtId: fromDistrictId, cost: 0 },
  ];

  while (frontier.length > 0) {
    frontier.sort(
      (left, right) => left.cost - right.cost || left.districtId.localeCompare(right.districtId),
    );
    const current = frontier.shift()!;
    if (settled.has(current.districtId)) continue;
    settled.add(current.districtId);
    if (current.districtId === toDistrictId) break;
    for (const connection of state.world.city.connections) {
      let neighbour: DistrictId | null = null;
      if (connection.fromDistrictId === current.districtId) {
        neighbour = connection.toDistrictId;
      } else if (connection.toDistrictId === current.districtId) {
        neighbour = connection.fromDistrictId;
      }
      if (neighbour === null || settled.has(neighbour)) continue;
      const candidate = current.cost + connection.cost;
      const known = distances.get(neighbour);
      if (known === undefined || candidate < known) {
        distances.set(neighbour, candidate);
        previous.set(neighbour, current.districtId);
        frontier.push({ districtId: neighbour, cost: candidate });
      }
    }
  }

  const total = distances.get(toDistrictId);
  if (total === undefined) return null;
  const route: DistrictId[] = [];
  let cursor: DistrictId | undefined = toDistrictId;
  while (cursor && cursor !== fromDistrictId) {
    route.unshift(cursor);
    cursor = previous.get(cursor);
  }
  // Si la cadena no llega al origen, el destino se alcanzó por una arista suelta: no hay ruta.
  if (cursor !== fromDistrictId || route.at(-1) !== toDistrictId) return null;
  return { route, cost: total };
}

/** Celda del gateway que une dos distritos, en el lado del distrito pedido. */
export function gatewayCell(state: GameState, from: DistrictId, to: DistrictId) {
  for (const gateway of state.world.gateways) {
    const fromIndex = gateway.districtIds.indexOf(from);
    const toIndex = gateway.districtIds.indexOf(to);
    if (fromIndex === -1 || toIndex === -1) continue;
    return { ...gateway.cells[toIndex]! };
  }
  return null;
}

/**
 * Marca a un agente como viajero. Devuelve la ruta o null si ya está viajando, ya está allí o los
 * distritos no están conectados.
 */
export function startAgentTravel(
  state: GameState,
  agentId: import("@landlord/shared").AgentId,
  toDistrictId: DistrictId,
): { arriveAtTick: Tick; route: DistrictId[] } | null {
  const agent = state.agents.get(agentId);
  if (!agent || agent.travel) return null;
  if (agent.districtId === toDistrictId) return null;
  const plan = districtRoute(state, agent.districtId, toDistrictId);
  if (!plan) return null;
  const departAtTick = state.clock.tick;
  const arriveAtTick = parseTick(
    Number(departAtTick) + Math.max(1, plan.cost * TRANSFER_TICKS_PER_COST),
  );
  agent.travel = {
    fromDistrictId: agent.districtId,
    toDistrictId,
    departAtTick,
    arriveAtTick,
    route: [...plan.route],
  };
  agent.task = null;
  agent.path = [];
  agent.state = "moving";
  agent.target = { ...agent.cell };
  return { arriveAtTick, route: plan.route };
}

/** Un tick de traslados: los agentes cuya hora llegó cambian de distrito en su gateway de entrada. */
export function advanceTransfers(state: GameState): void {
  // El orden no altera el resultado (cada llegada escribe sólo su agente y su gateway) y ordenar a
  // todos los agentes en cada tick costaba más que la propia simulación.
  for (const agent of state.agents.values()) {
    const travel = agent.travel;
    if (!travel) continue;
    if (Number(state.clock.tick) < Number(travel.arriveAtTick)) continue;
    const entry = gatewayCell(state, travel.fromDistrictId, travel.toDistrictId);
    agent.districtId = travel.toDistrictId;
    if (entry) {
      agent.cell = entry;
      agent.target = { ...entry };
    }
    agent.travel = null;
    agent.state = "idle";
    agent.path = [];
  }
}
