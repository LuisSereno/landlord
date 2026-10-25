import {
  parseSeed,
  parseTick,
  type FactionGoalFamily,
  type MacroEvent,
  type MacroEventModifiers,
  type MacroEventsState,
  type MacroEventType,
  type Seed,
  type Tick,
} from "@landlord/shared";
import { GAME_MONTH_TICKS, MARKET_PRICES } from "./game-data";
import { Xoshiro128ss } from "./prng";
import type { GameState } from "./state";

/**
 * Configuración de macroevento. La duración se declara en meses del juego y se convierte con
 * `GAME_MONTH_TICKS`: un "3" siempre son tres cierres mensuales, no tres días de 24 ticks.
 */
export type MacroEventTemplate = {
  type: MacroEventType;
  durationMonths: number;
  modifiers: MacroEventModifiers;
};

export const MACRO_EVENT_POLICY = {
  /** Probabilidad mensual de que entre un shock cuando no hay ninguno activo. */
  monthlyTriggerChancePercent: 10,
  /** La intensidad se sortea en este rango; escala linealmente los modifiers. */
  minimumIntensityPercent: 50,
  maximumIntensityPercent: 100,
  /** Un evento activo por tipo: con seis tipos el coste queda acotado de forma estructural. */
  maxActiveEvents: 6,
} as const;

export const MACRO_EVENT_TEMPLATES: Record<MacroEventType, MacroEventTemplate> = {
  material_scarcity: {
    type: "material_scarcity",
    durationMonths: 3,
    modifiers: {
      materialCostModifierPercent: 25, // +25 % coste de materiales
    },
  },
  economic_recession: {
    type: "economic_recession",
    durationMonths: 6,
    modifiers: {
      rentModifierPercent: -15,
      vacancyModifierPercent: 20,
      demandModifierPercent: -20,
    },
  },
  population_migration: {
    type: "population_migration",
    durationMonths: 4,
    modifiers: {
      demandModifierPercent: 30,
      rentModifierPercent: 10,
      vacancyModifierPercent: -15,
    },
  },
  construction_boom: {
    type: "construction_boom",
    durationMonths: 3,
    modifiers: {
      constructionCostModifierPercent: -20,
      materialCostModifierPercent: 10,
    },
  },
  housing_crisis: {
    type: "housing_crisis",
    durationMonths: 5,
    modifiers: {
      rentModifierPercent: 25,
      vacancyModifierPercent: -30,
      demandModifierPercent: 40,
    },
  },
  labor_shortage: {
    type: "labor_shortage",
    durationMonths: 4,
    modifiers: {
      laborCostModifierPercent: 20,
      constructionCostModifierPercent: 15,
    },
  },
};

export const MACRO_EVENT_LABELS: Record<MacroEventType, string> = {
  material_scarcity: "Escasez de materiales",
  economic_recession: "Recesión económica",
  population_migration: "Oleada de población",
  construction_boom: "Auge constructivo",
  housing_crisis: "Crisis de vivienda",
  labor_shortage: "Falta de mano de obra",
};

/**
 * Sesgo de utilidad que un shock activo imprime a cada familia de objetivos de la IA rival. Los
 * macroeventos son información pública del mundo; la IA no recibe nada privado por reaccionar.
 */
const MACRO_SHOCK_BIAS: Record<MacroEventType, Partial<Record<FactionGoalFamily, number>>> = {
  material_scarcity: { develop: -10, produce: 8, acquire: -5 },
  economic_recession: { develop: -20, dispose: 12, compete: -8, finance: -6 },
  population_migration: { develop: 18, protect: 4 },
  construction_boom: { develop: 16, acquire: 6 },
  housing_crisis: { develop: 14, compete: -4 },
  labor_shortage: { develop: -14, produce: -6, dispose: 4 },
};

/**
 * PRNG propio de los macroeventos, derivado de la seed pero decorrelacionado del arroyo económico y
 * del expediente de inteligencia: añadir shocks no desplaza sabotajes, permisos ni estimaciones.
 */
export function initialMacroEventsState(seed: Seed): MacroEventsState {
  return {
    events: [],
    nextEventOrdinal: 1,
    prng: new Xoshiro128ss(parseSeed((seed ^ 0x9e3779b9) >>> 0)).exportState(),
    nextCheckTick: parseTick(GAME_MONTH_TICKS),
  };
}

export function macroEventId(ordinal: number): string {
  return `macro_event_${ordinal.toString().padStart(8, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Activa un evento. Un tipo sólo puede estar activo una vez y nunca se superan los seis tipos, así
 * que el coste agregado queda acotado independientemente del tamaño de la ciudad.
 */
export function activateMacroEvent(
  state: MacroEventsState,
  type: MacroEventType,
  currentTick: Tick,
  intensity: number,
): MacroEventsState {
  if (state.events.some((event) => event.type === type)) return state;
  if (state.events.length >= MACRO_EVENT_POLICY.maxActiveEvents) return state;
  const template = MACRO_EVENT_TEMPLATES[type];
  const event: MacroEvent = {
    id: macroEventId(state.nextEventOrdinal),
    type,
    startTick: currentTick,
    endTick: parseTick(currentTick + template.durationMonths * GAME_MONTH_TICKS),
    intensity: clamp(intensity, 0, 1),
    modifiers: { ...template.modifiers },
  };
  return {
    events: [...state.events, event],
    nextEventOrdinal: state.nextEventOrdinal + 1,
    prng: state.prng,
    nextCheckTick: state.nextCheckTick,
  };
}

/**
 * Elimina macroeventos expirados del estado. Devuelve el nuevo estado.
 */
export function removeExpiredMacroEvents(
  state: MacroEventsState,
  currentTick: Tick,
): MacroEventsState {
  const active = state.events.filter((event) => event.endTick > currentTick);
  if (active.length === state.events.length) {
    return state;
  }
  return {
    ...state,
    events: active,
  };
}

/**
 * Obtiene los macroeventos activos en un tick dado.
 */
export function getActiveMacroEvents(state: MacroEventsState, currentTick: Tick): MacroEvent[] {
  return state.events.filter(
    (event) => event.startTick <= currentTick && event.endTick > currentTick,
  );
}

/**
 * Suma los modifiers de todos los macroeventos activos. Los modifiers se acumulan aditivamente.
 * Ejemplo: dos eventos con +10 % y +15 % dan +25 %.
 */
export function aggregateMacroEventModifiers(
  state: MacroEventsState,
  currentTick: Tick,
): MacroEventModifiers {
  const active = getActiveMacroEvents(state, currentTick);
  const aggregated: MacroEventModifiers = {};
  for (const event of active) {
    for (const [key, value] of Object.entries(event.modifiers)) {
      if (value !== undefined) {
        const typedKey = key as keyof MacroEventModifiers;
        /** Dos decimales: la intensidad se sortea al 1 % y el estado canónico no debe arrastrar ruido. */
        aggregated[typedKey] =
          Math.round(((aggregated[typedKey] ?? 0) + value * event.intensity) * 100) / 100;
      }
    }
  }
  return aggregated;
}

/** Lectura O(eventos activos ≤ 6) de los modifiers vigentes del mundo. */
export function activeMacroModifiers(state: GameState): MacroEventModifiers {
  return aggregateMacroEventModifiers(state.phase2.macroEvents, state.clock.tick);
}

/**
 * Coste efectivo de los materiales: la ordenanza y los shocks se suman en un único porcentaje. Lo
 * usan la compra de materiales, el arranque de obra y la proyección con la misma cifra.
 */
export function materialCostModifierPercentFor(state: GameState): number {
  const ordinance =
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.materialCostModifierPercent
      : 0;
  return ordinance + (activeMacroModifiers(state).materialCostModifierPercent ?? 0);
}

/** Renta efectiva: ordenanza y shocks comparten una sola suma, leída por `askingRentFor`. */
export function rentModifierPercentFor(state: GameState): number {
  const ordinance =
    state.phase2.ordinance.status === "active" ? state.phase2.ordinance.rentModifierPercent : 0;
  return ordinance + (activeMacroModifiers(state).rentModifierPercent ?? 0);
}

/** Precio de mercado que paga hoy una unidad de recurso, redondeado a unidad entera. */
export function effectiveMarketPriceFor(
  state: GameState,
  resource: keyof typeof MARKET_PRICES,
): number {
  const modifier = materialCostModifierPercentFor(state);
  return Math.max(1, Math.round(MARKET_PRICES[resource] * (1 + modifier / 100)));
}

/** Sesgo de utilidad de la IA rival para una familia de objetivos bajo los shocks activos. */
export function macroShockBiasFor(state: GameState, family: FactionGoalFamily): number {
  let bias = 0;
  for (const event of getActiveMacroEvents(state.phase2.macroEvents, state.clock.tick)) {
    bias += Math.round((MACRO_SHOCK_BIAS[event.type][family] ?? 0) * event.intensity);
  }
  return bias;
}

/**
 * Sortea si entra un shock este cierre mensual. Sólo se sortea cuando no hay ninguno activo, así que
 * el solapamiento natural está limitado a uno y la economía recibe un shock cada vez.
 */
function rollMonthlyMacroEvent(state: GameState, macro: MacroEventsState): MacroEventsState {
  const prng = new Xoshiro128ss(state.seed);
  prng.restoreState(macro.prng);
  let next = macro;
  if (
    macro.events.length === 0 &&
    prng.nextInt(0, 100) < MACRO_EVENT_POLICY.monthlyTriggerChancePercent
  ) {
    const types = Object.keys(MACRO_EVENT_TEMPLATES) as MacroEventType[];
    const type = types[prng.nextInt(0, types.length)]!;
    const intensity =
      prng.nextInt(
        MACRO_EVENT_POLICY.minimumIntensityPercent,
        MACRO_EVENT_POLICY.maximumIntensityPercent + 1,
      ) / 100;
    next = activateMacroEvent(macro, type, parseTick(state.clock.tick), intensity);
  }
  return { ...next, prng: prng.exportState() };
}

/**
 * Sistema de macroeventos: limpia los expirados y, en el cierre mensual programado, sortea la entrada
 * de un shock con el PRNG propio. Los modifiers se leen O(1) respecto al tamaño de la ciudad.
 */
export function runMacroEvents(state: GameState): void {
  const currentTick = state.clock.tick;
  let macro = removeExpiredMacroEvents(state.phase2.macroEvents, currentTick);
  if (
    currentTick > 0 &&
    currentTick % GAME_MONTH_TICKS === 0 &&
    currentTick >= macro.nextCheckTick
  ) {
    macro = rollMonthlyMacroEvent(state, macro);
    macro = { ...macro, nextCheckTick: parseTick(currentTick + GAME_MONTH_TICKS) };
  }
  state.phase2.macroEvents = macro;
}
