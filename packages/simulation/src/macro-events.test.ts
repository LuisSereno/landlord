import { describe, expect, it } from "vitest";
import { parseTick } from "@landlord/shared";
import {
  activateMacroEvent,
  aggregateMacroEventModifiers,
  createInitialMacroEventsState,
  getActiveMacroEvents,
  macroEventId,
  MACRO_EVENT_TEMPLATES,
  removeExpiredMacroEvents,
  type MacroEventType,
} from "./macro-events";

describe("macro-events", () => {
  describe("createInitialMacroEventsState", () => {
    it("crea un estado vacío con ordinal 1", () => {
      const state = createInitialMacroEventsState();
      expect(state.events).toHaveLength(0);
      expect(state.nextEventOrdinal).toBe(1);
    });
  });

  describe("macroEventId", () => {
    it("genera IDs deterministas con padding", () => {
      expect(macroEventId(1)).toBe("macro_event_00000001");
      expect(macroEventId(42)).toBe("macro_event_00000042");
      expect(macroEventId(99999999)).toBe("macro_event_99999999");
    });
  });

  describe("activateMacroEvent", () => {
    it("activa un evento con duration y modifiers del template", () => {
      const state = createInitialMacroEventsState();
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(100), 0.8);
      expect(updated.events).toHaveLength(1);
      expect(updated.nextEventOrdinal).toBe(2);
      const event = updated.events[0]!;
      expect(event.id).toBe("macro_event_00000001");
      expect(event.type).toBe("material_scarcity");
      expect(event.startTick).toBe(100);
      expect(event.endTick).toBe(MACRO_EVENT_TEMPLATES.material_scarcity.durationTicks + 100);
      expect(event.intensity).toBe(0.8);
      expect(event.modifiers.materialCostModifierPercent).toBe(25);
    });

    it("acota la intensidad entre 0 y 1", () => {
      const state = createInitialMacroEventsState();
      const low = activateMacroEvent(state, "economic_recession", parseTick(0), -0.5);
      expect(low.events[0]!.intensity).toBe(0);
      const high = activateMacroEvent(low, "economic_recession", parseTick(0), 1.5);
      expect(high.events[1]!.intensity).toBe(1);
    });

    it("permite apilar múltiples eventos", () => {
      let state = createInitialMacroEventsState();
      const types: MacroEventType[] = ["material_scarcity", "economic_recession", "housing_crisis"];
      for (const type of types) {
        state = activateMacroEvent(state, type, parseTick(0), 1);
      }
      expect(state.events).toHaveLength(3);
      expect(state.nextEventOrdinal).toBe(4);
      expect(state.events.map((e) => e.type)).toEqual(types);
    });
  });

  describe("getActiveMacroEvents", () => {
    it("devuelve solo eventos cuyo intervalo contiene el tick", () => {
      let state = createInitialMacroEventsState();
      state = activateMacroEvent(state, "material_scarcity", parseTick(100), 1);
      state = activateMacroEvent(state, "economic_recession", parseTick(200), 1);
      expect(getActiveMacroEvents(state, parseTick(50))).toHaveLength(0);
      expect(getActiveMacroEvents(state, parseTick(150))).toHaveLength(1);
      expect(getActiveMacroEvents(state, parseTick(250))).toHaveLength(2);
    });

    it("excluye el tick exacto de finalización (endTick es exclusivo)", () => {
      const state = createInitialMacroEventsState();
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      const endTick = updated.events[0]!.endTick;
      expect(getActiveMacroEvents(updated, parseTick(endTick - 1))).toHaveLength(1);
      expect(getActiveMacroEvents(updated, endTick)).toHaveLength(0);
    });
  });

  describe("removeExpiredMacroEvents", () => {
    it("no modifica el estado si no hay eventos expirados", () => {
      const state = createInitialMacroEventsState();
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(100), 1);
      const cleaned = removeExpiredMacroEvents(updated, parseTick(150));
      expect(cleaned).toBe(updated);
    });

    it("elimina eventos cuyo endTick <= currentTick", () => {
      let state = createInitialMacroEventsState();
      state = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      state = activateMacroEvent(state, "economic_recession", parseTick(100), 1);
      const shortEndTick = state.events[0]!.endTick;
      const cleaned = removeExpiredMacroEvents(state, shortEndTick);
      expect(cleaned.events).toHaveLength(1);
      expect(cleaned.events[0]!.type).toBe("economic_recession");
    });
  });

  describe("aggregateMacroEventModifiers", () => {
    it("devuelve modifiers vacíos sin eventos activos", () => {
      const state = createInitialMacroEventsState();
      const modifiers = aggregateMacroEventModifiers(state, parseTick(0));
      expect(modifiers).toEqual({});
    });

    it("suma aditivamente los modifiers de eventos activos", () => {
      let state = createInitialMacroEventsState();
      state = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      state = activateMacroEvent(state, "construction_boom", parseTick(0), 1);
      const modifiers = aggregateMacroEventModifiers(state, parseTick(100));
      expect(modifiers.materialCostModifierPercent).toBe(25 + 10);
      expect(modifiers.constructionCostModifierPercent).toBe(-20);
    });

    it("escala los modifiers por la intensidad del evento", () => {
      const state = createInitialMacroEventsState();
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(0), 0.5);
      const modifiers = aggregateMacroEventModifiers(updated, parseTick(100));
      expect(modifiers.materialCostModifierPercent).toBeCloseTo(12.5, 5);
    });

    it("ignora eventos expirados", () => {
      const state = createInitialMacroEventsState();
      const updated = activateMacroEvent(state, "material_scarcity", parseTick(0), 1);
      const endTick = updated.events[0]!.endTick;
      const modifiers = aggregateMacroEventModifiers(updated, endTick);
      expect(modifiers).toEqual({});
    });

    it("acumula modifiers opuestos de forma neta", () => {
      let state = createInitialMacroEventsState();
      state = activateMacroEvent(state, "construction_boom", parseTick(0), 1);
      state = activateMacroEvent(state, "labor_shortage", parseTick(0), 1);
      const modifiers = aggregateMacroEventModifiers(state, parseTick(100));
      expect(modifiers.constructionCostModifierPercent).toBeCloseTo(-20 + 15, 5);
    });
  });

  describe("templates", () => {
    it("todos los tipos tienen un template con duración positiva", () => {
      const types: MacroEventType[] = [
        "material_scarcity",
        "economic_recession",
        "population_migration",
        "construction_boom",
        "housing_crisis",
        "labor_shortage",
      ];
      for (const type of types) {
        const template = MACRO_EVENT_TEMPLATES[type];
        expect(template).toBeDefined();
        expect(template!.durationTicks).toBeGreaterThan(0);
        expect(Object.keys(template!.modifiers).length).toBeGreaterThan(0);
      }
    });
  });
});
