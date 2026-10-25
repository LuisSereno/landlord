import { parseTick, type Tick, type MacroEventsState } from "@landlord/shared";
import type { GameState } from "./state";

/**
 * Tipos de macroeventos económicos. Cada uno afecta a sistemas específicos mediante modifiers.
 * Los macroeventos son O(1): no barren entidades, solo aplican modifiers globales al distrito.
 */
export type MacroEventType =
  | "material_scarcity" // Aumenta costes de materiales
  | "economic_recession" // Reduce rentas, aumenta vacancia
  | "population_migration" // Aumenta demanda de vivienda
  | "construction_boom" // Reduce costes de construcción
  | "housing_crisis" // Aumenta rentas, reduce vacancia
  | "labor_shortage"; // Aumenta costes laborales

/**
 * Modifier global que afecta a un sistema específico. Los valores son porcentajes (ej: 10 = +10%, -5 = -5%).
 */
export type MacroEventModifiers = {
  materialCostModifierPercent?: number;
  rentModifierPercent?: number;
  vacancyModifierPercent?: number;
  constructionCostModifierPercent?: number;
  laborCostModifierPercent?: number;
  demandModifierPercent?: number;
};

/**
 * Macroevento económico activo en el distrito. Determinista, con duración fija y modifiers globales.
 * No barre entidades: los sistemas leen los modifiers activos y los aplican O(1).
 */
export type MacroEvent = {
  id: string;
  type: MacroEventType;
  startTick: Tick;
  endTick: Tick;
  intensity: number; // 0-1, magnitud del efecto
  modifiers: MacroEventModifiers;
};

/**
 * Configuración de macroevento: tipo, duración y modifiers.
 */
export type MacroEventTemplate = {
  type: MacroEventType;
  durationTicks: number;
  intensity: number;
  modifiers: MacroEventModifiers;
};

/**
 * Templates de macroeventos por defecto. La intensidad se escala según las condiciones económicas.
 */
export const MACRO_EVENT_TEMPLATES: Record<MacroEventType, Omit<MacroEventTemplate, "intensity">> = {
  material_scarcity: {
    type: "material_scarcity",
    durationTicks: 3 * 30 * 24, // 3 meses (asumiendo 30 días/mes, 24 ticks/día)
    modifiers: {
      materialCostModifierPercent: 25, // +25% coste de materiales
    },
  },
  economic_recession: {
    type: "economic_recession",
    durationTicks: 6 * 30 * 24, // 6 meses
    modifiers: {
      rentModifierPercent: -15, // -15% rentas
      vacancyModifierPercent: 20, // +20% vacancia
      demandModifierPercent: -20, // -20% demanda
    },
  },
  population_migration: {
    type: "population_migration",
    durationTicks: 4 * 30 * 24, // 4 meses
    modifiers: {
      demandModifierPercent: 30, // +30% demanda de vivienda
      rentModifierPercent: 10, // +10% rentas
      vacancyModifierPercent: -15, // -15% vacancia
    },
  },
  construction_boom: {
    type: "construction_boom",
    durationTicks: 3 * 30 * 24, // 3 meses
    modifiers: {
      constructionCostModifierPercent: -20, // -20% coste de construcción
      materialCostModifierPercent: 10, // +10% coste de materiales (efecto secundario)
    },
  },
  housing_crisis: {
    type: "housing_crisis",
    durationTicks: 5 * 30 * 24, // 5 meses
    modifiers: {
      rentModifierPercent: 25, // +25% rentas
      vacancyModifierPercent: -30, // -30% vacancia
      demandModifierPercent: 40, // +40% demanda
    },
  },
  labor_shortage: {
    type: "labor_shortage",
    durationTicks: 4 * 30 * 24, // 4 meses
    modifiers: {
      laborCostModifierPercent: 20, // +20% coste laboral
      constructionCostModifierPercent: 15, // +15% coste de construcción
    },
  },
};

/**
 * Crea un estado inicial de macroeventos vacío.
 */
export function createInitialMacroEventsState(): MacroEventsState {
  return {
    events: [],
    nextEventOrdinal: 1,
  };
}

/**
 * Genera un ID determinista para un macroevento.
 */
export function macroEventId(ordinal: number): string {
  return `macro_event_${ordinal.toString().padStart(8, "0")}`;
}

/**
 * Activa un macroevento en el estado. Devuelve el nuevo estado.
 */
export function activateMacroEvent(
  state: MacroEventsState,
  type: MacroEventType,
  currentTick: Tick,
  intensity: number,
): MacroEventsState {
  const template = MACRO_EVENT_TEMPLATES[type];
  const id = macroEventId(state.nextEventOrdinal);
  const event: MacroEvent = {
    id,
    type,
    startTick: currentTick,
    endTick: parseTick(currentTick + template.durationTicks),
    intensity: Math.max(0, Math.min(1, intensity)),
    modifiers: template.modifiers,
  };
  return {
    events: [...state.events, event],
    nextEventOrdinal: state.nextEventOrdinal + 1,
  };
}

/**
 * Elimina macroeventos expirados del estado. Devuelve el nuevo estado.
 */
export function removeExpiredMacroEvents(state: MacroEventsState, currentTick: Tick): MacroEventsState {
  const active = state.events.filter((event) => event.endTick > currentTick);
  if (active.length === state.events.length) {
    return state; // Sin cambios
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
  return state.events.filter((event) => event.startTick <= currentTick && event.endTick > currentTick);
}

/**
 * Suma los modifiers de todos los macroeventos activos. Los modifiers se acumulan aditivamente.
 * Ejemplo: dos eventos con +10% y +15% dan +25%.
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
        aggregated[typedKey] = (aggregated[typedKey] ?? 0) + value * event.intensity;
      }
    }
  }
  return aggregated;
}

/**
 * Sistema de macroeventos: limpia eventos expirados al inicio del tick.
 * Los modifiers se leen O(1) mediante aggregateMacroEventModifiers.
 */
export function runMacroEvents(state: GameState): void {
  state.phase2.macroEvents = removeExpiredMacroEvents(state.phase2.macroEvents, state.clock.tick);
}
