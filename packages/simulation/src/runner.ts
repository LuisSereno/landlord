import { type ProductCommand } from "@landlord/shared";
import type { CommandResult, ProductCommandResult } from "./commands";
import { dispatchPlaceTestStructure, dispatchProductCommand } from "./commands";
import { createInitialState, type GameState, type InitialStateOptions } from "./state";
import { advanceProductSystems } from "./systems";

function orderedEntries<T>(map: ReadonlyMap<string, T>): Array<[string, T]> {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function orderedMapValues<T>(map: ReadonlyMap<string, T>): T[] {
  return orderedEntries(map).map(([, value]) => value);
}

/**
 * Ordena las claves de todo objeto anidado antes de serializar. `JSON.stringify` conserva el orden
 * de inserción de las claves, y un estado restaurado lo reconstruye en otro orden aunque sus valores
 * sean idénticos; el digesto tiene que depender del contenido, no de cómo se construyó el objeto.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortKeysDeep(source[key]);
    return sorted;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function canonicalizeState(state: GameState): string {
  return canonicalJson({
    seed: state.seed,
    /**
     * `runState` y `speed` son controles del scheduler y de la UI, no estado del mundo: la snapshot no
     * los guarda y al restaurar vuelve a `paused` 1x. Incluirlos haría falsa la promesa de que una
     * partida guardada corriendo a 4x carga canónicamente igual.
     */
    clock: { tick: state.clock.tick },
    prng: state.prng,
    idCounters: state.idCounters,
    /**
     * La ciudad entra en la superficie canónica en el orden de slots del perfil, no en el de
     * inserción del Map (D-089). Cambiar el distrito observado no toca este bloque: es una petición
     * técnica, no estado del mundo.
     */
    world: {
      city: {
        ...state.world.city,
        districtIds: [...state.world.city.districtIds].sort((left, right) =>
          left.localeCompare(right),
        ),
        connections: [...state.world.city.connections].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      },
      gateways: [...state.world.gateways].sort((left, right) => left.id.localeCompare(right.id)),
      districts: [...state.world.city.districtIds]
        .sort((left, right) => left.localeCompare(right))
        .map((districtId) => {
          const entry = state.world.districts.get(districtId)!;
          return {
            district: entry.district,
            map: {
              width: entry.map.width,
              height: entry.map.height,
              blockedCells: [...entry.map.blockedCells].sort(),
              roads: entry.map.roads,
            },
            blocks: [...entry.blocks.values()].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
            publicSpaces: [...entry.publicSpaces.values()].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
          };
        }),
    },
    playerIdentities: orderedMapValues(state.playerIdentities),
    persons: orderedMapValues(state.persons),
    organizations: orderedMapValues(state.organizations),
    controlGrants: [...state.controlGrants.values()].sort((left, right) =>
      `${left.personId}:${left.organizationId}`.localeCompare(
        `${right.personId}:${right.organizationId}`,
      ),
    ),
    agents: orderedMapValues(state.agents),
    structures: orderedMapValues(state.structures),
    processedCommandIds: [...state.processedCommandIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    pendingCommands: [...state.pendingCommands].sort(
      (left, right) => left.acceptedOrder - right.acceptedOrder,
    ),
    phase2: {
      idCounters: state.phase2.idCounters,
      parcels: orderedMapValues(state.phase2.parcels),
      balances: orderedEntries(state.phase2.balances).map(([organizationId, balance]) => ({
        organizationId,
        balance,
      })),
      inventories: orderedEntries(state.phase2.inventories).map(([organizationId, inventory]) => ({
        organizationId,
        inventory,
      })),
      facilities: orderedMapValues(state.phase2.facilities),
      buildings: orderedMapValues(state.phase2.buildings),
      constructionSites: orderedMapValues(state.phase2.constructionSites),
      crews: orderedMapValues(state.phase2.crews),
      incidents: orderedMapValues(state.phase2.incidents),
      tenants: orderedMapValues(state.phase2.tenants),
      transactions: state.phase2.transactions,
      ordinance: state.phase2.ordinance,
      crime: state.phase2.crime,
      /** El PRNG propio entra en la superficie: dos partidas con shocks distintos no son iguales. */
      macroEvents: state.phase2.macroEvents,
      automation: state.phase2.automation,
      influenceByOrganizationId: orderedEntries(state.phase2.influenceByOrganizationId).map(
        ([organizationId, influence]) => ({ organizationId, influence }),
      ),
      rivalAi: state.phase2.rivalAi,
      loans: orderedMapValues(state.phase2.loans),
      taxation: state.phase2.taxation,
      maintenance: state.phase2.maintenance,
      insurance: state.phase2.insurance,
      permitting: state.phase2.permitting,
      insolvency: state.phase2.insolvency,
      employment: state.phase2.employment,
      housingMarket: state.phase2.housingMarket,
      municipal: state.phase2.municipal,
      politics: state.phase2.politics,
      contracts: state.phase2.contracts,
      reputation: state.phase2.reputation,
      intelligence: state.phase2.intelligence,
      factions: state.phase2.factions,
    },
  });
}

export type ScheduledCommand = {
  atTick: number;
  command: ProductCommand;
};

export type ScenarioCheckpoint = {
  tick: number;
  canonicalState: string;
};

export type ScenarioRun = {
  state: GameState;
  results: Array<{ atTick: number; result: CommandResult | ProductCommandResult }>;
  checkpoints: ScenarioCheckpoint[];
};

export function createScenarioState(seed: number, options: InitialStateOptions = {}): GameState {
  return createInitialState(seed, options);
}

/** `checkpointEvery` es del harness, no del estado: 0 registra sólo el estado final. */
export type ScenarioOptions = InitialStateOptions & { checkpointEvery?: number };

export function runScenario(
  seed: number,
  scheduledCommands: readonly ScheduledCommand[],
  totalTicks: number,
  options: ScenarioOptions = {},
): ScenarioRun {
  if (!Number.isSafeInteger(totalTicks) || totalTicks < 0) {
    throw new RangeError("Scenario duration must be a non-negative safe integer");
  }
  const commands = [...scheduledCommands].sort((left, right) => left.atTick - right.atTick);
  if (
    commands.some((scheduled) => !Number.isSafeInteger(scheduled.atTick) || scheduled.atTick < 0)
  ) {
    throw new RangeError("Scheduled command ticks must be non-negative safe integers");
  }
  if (commands.some((scheduled) => scheduled.atTick >= totalTicks && totalTicks > 0)) {
    throw new RangeError("Scheduled command must execute before scenario end");
  }

  const state = createScenarioState(seed, options);
  const checkpointEvery = options.checkpointEvery ?? 1;
  const results: ScenarioRun["results"] = [];
  const checkpoints: ScenarioCheckpoint[] = [];
  let commandIndex = 0;

  for (let step = 0; step < totalTicks; step += 1) {
    const atTick = state.clock.tick;
    while (commandIndex < commands.length && commands[commandIndex]!.atTick === atTick) {
      const scheduled = commands[commandIndex]!;
      results.push({
        atTick,
        result:
          scheduled.command.type === "PlaceTestStructure"
            ? dispatchPlaceTestStructure(state, scheduled.command)
            : dispatchProductCommand(state, scheduled.command),
      });
      commandIndex += 1;
    }
    advanceProductSystems(state);
    if (checkpointEvery > 0 && step % checkpointEvery === 0) {
      checkpoints.push({ tick: state.clock.tick, canonicalState: canonicalizeState(state) });
    }
  }
  /**
   * El estado final siempre queda registrado: los tests de conservación comparan el digesto de la
   * carrera completa y no necesitan una cadena canónica de 291 KB por tick, que a 6,9 ms dominaba el
   * coste del harness desde que el mundo son nueve distritos.
   */
  if (checkpoints.at(-1)?.tick !== state.clock.tick) {
    checkpoints.push({ tick: state.clock.tick, canonicalState: canonicalizeState(state) });
  }

  if (commandIndex !== commands.length) {
    throw new Error("Scenario contains a command that was not scheduled");
  }
  return { state, results, checkpoints };
}

export function findFirstDivergentTick(left: ScenarioRun, right: ScenarioRun): number | null {
  const length = Math.max(left.checkpoints.length, right.checkpoints.length);
  for (let index = 0; index < length; index += 1) {
    if (left.checkpoints[index]?.canonicalState !== right.checkpoints[index]?.canonicalState) {
      return left.checkpoints[index]?.tick ?? right.checkpoints[index]?.tick ?? null;
    }
  }
  return null;
}
