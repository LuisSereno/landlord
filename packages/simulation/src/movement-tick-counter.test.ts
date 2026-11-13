import { parseConstructionSiteId, parseTick } from "@landlord/shared";
import { describe, expect, it } from "vitest";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { MOVEMENT_TICKS_PER_CELL } from "./game-data";
import { createViewProjection } from "./projection";
import { createInitialState } from "./state";
import type { GameState } from "./state";
import { PRODUCT_SYSTEMS } from "./systems";

/**
 * V.k.1 deja en la proyección dos datos (`movement.ticksPerCell` y `nextCell`) cuyo único cliente es
 * el interpolador de `update()`. Ese interpolador sólo es correcto si respeta la **fase** del paso:
 * `tacticalTick` se ejecuta con el tick aún sin incrementar, así que el paso vencido en el múltiplo
 * `10k` se publica en el tick `10k + 1`. La fracción del tramo ya recorrido es por tanto
 * `((tick - 1) % ticksPerCell) / ticksPerCell`, que vale 0 al llegar y 0,9 en el último tick antes
 * del siguiente paso. Con la fórmula ingenua (`tick % ticksPerCell`) el agente se rebobinaría al
 * inicio del tramo en cada múltiplo y caminaría un tick por delante del motor. Estos tests fijan la
 * fase contra el motor real, que es lo que V.k.3 necesita para que el paseo no se vea a saltos.
 */
const tactical = PRODUCT_SYSTEMS.find((system) => system.name === "tactical");
if (!tactical) throw new Error("el sistema táctico no está en PRODUCT_SYSTEMS");
/** Cerrada después de la guarda, para que el estrechado de tipos llegue al interior de `stepTick`. */
const runTactical = (state: GameState): void => tactical.run(state);

/** Un tick del motor, pero solo el sistema que mueve agentes: automation no debe re-rutear la ruta. */
function stepTick(state: GameState): void {
  runTactical(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

/** Peatón propio con una ruta recta de 6 celdas, en el distrito que se pinta por defecto. */
function crewOnTheMove() {
  const state = createInitialState(1);
  const agent = [...state.agents.values()].find(
    (entry) => entry.districtId === PLAYER_HOME_DISTRICT_ID,
  );
  if (!agent) throw new Error("el roster inicial no tiene agentes del distrito del jugador");
  const site = [...state.phase2.constructionSites.values()][0];
  agent.task = {
    kind: "work_order",
    workOrderId: site?.id ?? parseConstructionSiteId("site_00000001"),
  };
  agent.state = "moving";
  const origin = { ...agent.cell };
  const route = Array.from({ length: 6 }, (_, index) => ({ x: origin.x + index + 1, y: origin.y }));
  agent.path = route.map((cell) => ({ ...cell }));
  agent.target = { ...route[route.length - 1]! };
  return { state, agent, origin, route };
}

describe("V.k.1 · cadencia y fase del contador de movimiento", () => {
  it("mueve al agente una sola celda en cada tick vencido y ninguna en los otros", () => {
    const { state, agent, route } = crewOnTheMove();
    const cellKey = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;
    const changes: { tick: number; from: string; to: string }[] = [];
    let previous = cellKey(agent.cell);
    for (let index = 0; index < 60; index += 1) {
      const tickAtRun = state.clock.tick;
      stepTick(state);
      const current = cellKey(agent.cell);
      if (current !== previous) {
        changes.push({ tick: state.clock.tick, from: previous, to: current });
        previous = current;
        // El paso ocurre en el sistema ejecutado con `tickAtRun`, no con el tick ya publicado.
        expect(tickAtRun % MOVEMENT_TICKS_PER_CELL, `paso publicado en ${state.clock.tick}`).toBe(
          0,
        );
      }
    }

    expect(changes).toHaveLength(route.length);
    expect(changes.map((change) => change.tick)).toEqual([1, 11, 21, 31, 41, 51]);
    for (const [index, change] of changes.entries()) {
      expect(change.to).toBe(cellKey(route[index]!));
      // Un paso = una celda 4-adyacente: el render interpola un segmento, nunca dos.
      const [fromX, fromY] = change.from.split(",").map(Number);
      const [toX, toY] = change.to.split(",").map(Number);
      expect(Math.abs(toX! - fromX!) + Math.abs(toY! - fromY!)).toBe(1);
    }
  });

  it("publica la fase que el interpolador necesita: 0 al llegar, 0,9 en el último tick del tramo", () => {
    const { state, agent, route } = crewOnTheMove();
    const progress = (tick: number) =>
      ((tick - 1) % MOVEMENT_TICKS_PER_CELL) / MOVEMENT_TICKS_PER_CELL;

    stepTick(state);
    const arrival = createViewProjection(state);
    const published = arrival.agents.find((entry) => entry.id === agent.id);
    expect(published?.cell).toEqual(route[0]);
    expect(published?.nextCell).toEqual(route[1]);
    expect(progress(Number(arrival.tick))).toBe(0);

    for (let index = 0; index < 9; index += 1) stepTick(state);
    const mid = createViewProjection(state);
    expect(progress(Number(mid.tick))).toBeCloseTo(0.9, 10);
    const midAgent = mid.agents.find((entry) => entry.id === agent.id);
    expect(midAgent?.cell).toEqual(route[0]);
    expect(midAgent?.nextCell).toEqual(route[1]);

    // Aquí es donde la fórmula ingenua miente: el tick publicado 10 es múltiplo de la cadencia, así
    // que `tick % ticksPerCell` daría 0 (el agente volvería al inicio del tramo) cuando en realidad
    // va por el 90 % y el paso se aplicará en el siguiente `stepTick`.
    expect(Number(mid.tick) % MOVEMENT_TICKS_PER_CELL).toBe(0);
  });

  it("la cadencia publicada en la proyección es la separación real entre dos pasos", () => {
    const { state, agent } = crewOnTheMove();
    const stepTicks: number[] = [];
    let lastCell = `${agent.cell.x},${agent.cell.y}`;
    for (let index = 0; index < 30; index += 1) {
      stepTick(state);
      const projection = createViewProjection(state);
      const published = projection.agents.find((entry) => entry.id === agent.id);
      const key = `${published?.cell.x},${published?.cell.y}`;
      if (key !== lastCell) stepTicks.push(Number(projection.tick));
      lastCell = key;
    }

    expect(stepTicks.length).toBeGreaterThan(1);
    const gaps = stepTicks.slice(1).map((tick, index) => tick - stepTicks[index]!);
    expect([...new Set(gaps)]).toEqual([MOVEMENT_TICKS_PER_CELL]);
    expect(createViewProjection(state).movement.ticksPerCell).toEqual(gaps[0]);
  });
});
