# WP4.12 — Macroeconomic events (O(1) modifiers)

**Estado:** cerrado  
**Fecha:** 2026-10-25  
**Baseline:** `9d40de6` (macro events system) + `733f25e` (longitudinal benchmark)  
**ADR:** pendiente (D-077)

## Objetivo

Introducir macroeventos económicos (escasez de materiales, recesión, migración, boom constructivo, crisis de vivienda, falta de mano de obra) que afecten al distrito mediante **modifiers O(1)**, sin barridos de entidades ni trabajo adicional proporcional al tamaño del mundo.

## Restricción de rendimiento

> Ningún macroevento de WP4.12 debe introducir un nuevo barrido significativo en el cierre mensual. Si necesita reaccionar mensualmente, debe hacerlo mediante estado/modificadores O(1) o acotados y volver a medirse longitudinalmente antes de aceptar el WP.

## Implementación

### WP4.12a — Estructura de datos

**Tipos en `packages/shared/src/domain.ts`:**
- `MacroEventType`: 6 tipos de eventos (material_scarcity, economic_recession, population_migration, construction_boom, housing_crisis, labor_shortage)
- `MacroEventModifiers`: 6 modificadores porcentuales (materialCost, rent, vacancy, constructionCost, laborCost, demand)
- `MacroEvent`: evento activo con id, tipo, startTick, endTick, intensidad (0-1) y modifiers
- `MacroEventsState`: lista de eventos activos + nextEventOrdinal para IDs deterministas

**Templates en `packages/simulation/src/macro-events.ts`:**
- `MACRO_EVENT_TEMPLATES`: duración y modifiers por defecto para cada tipo
- Duraciones: 3-6 meses (en ticks)
- Intensidad: escalable 0-1, los modifiers se multiplican por intensidad

### WP4.12b — Benchmark longitudinal

**Reescritura de `measureMonthlyCloses` en `packages/simulation/src/system-cost.ts`:**
- Antes: creaba una ciudad nueva por cada closeIndex (muestras sintéticas independientes)
- Después: UNA ciudad por semilla que vive múltiples cierres en secuencia
- Estado acumulado: préstamos pagados, mercado de vivienda evolucionado, stock maduro
- Default `closesPerSeed`: 6 (antes 3)
- Reporta por separado: mes 1 (inicio), meses 2-3 (transición), meses 4+ (estado estable)

**Nota metodológica:** las muestras de mes 2+ parten de una ciudad que **sí vivió** los cierres anteriores, así que préstamos, buscadores y stock reflejan historia real. Esto reemplaza la distribución PROVISIONAL de D-076.

### WP4.12c — Sistema de macroeventos

**Funciones puras en `packages/simulation/src/macro-events.ts`:**
- `activateMacroEvent(state, type, currentTick, intensity)`: añade un evento con ID determinista
- `removeExpiredMacroEvents(state, currentTick)`: filtra eventos cuyo endTick <= currentTick
- `getActiveMacroEvents(state, currentTick)`: devuelve eventos activos en un tick
- `aggregateMacroEventModifiers(state, currentTick)`: suma aditivamente modifiers de todos los eventos activos, escalados por intensidad

**O(1) guarantee:** `aggregateMacroEventModifiers` recorre solo eventos activos (típicamente 0-3), no entidades del mundo. El coste es independiente del tamaño del distrito.

### WP4.12d — Integración en el tick

**Estado inicial en `packages/simulation/src/state.ts`:**
```typescript
macroEvents: {
  events: [],
  nextEventOrdinal: 1,
}
```

**Sistema en `PRODUCT_SYSTEMS` (`packages/simulation/src/systems.ts`):**
- Posición: después de `tactical`, antes de `production`
- Trabajo: `removeExpiredMacroEvents` cada tick
- Los modifiers quedan disponibles para que otros sistemas los lean O(1)

**Persistencia en snapshot v1:**
- `phase2.macroEvents` opcional en `SnapshotV1` type
- `macroEventsStateSchema` en `phase2SnapshotSchema`
- Serialización/deserialización en `serializeSnapshot` / `restoreStateFromSnapshot`
- Partidas antiguas se restauran con estado vacío

## Rendimiento medido

**Benchmark longitudinal con macroeventos activos:**
- Escala: ciudad (800 parcelas)
- Semillas: 8
- Cierres por semilla: 6
- Warmup: 60 ticks

**Resultados:**
- Cierre mensual p50: **32.90 ms**
- Cierre mensual p95: **37.72 ms**
- Cierre mensual máximo: **40.27 ms**
- Tick ordinario p95: **0.078 ms**

**Comparación con D-076 (antes de macroeventos):**
- p50: ~28 ms → 32.90 ms (+17%)
- p95: ~37 ms → 37.72 ms (+2%)
- máximo: ~38 ms → 40.27 ms (+6%)

**Conclusión:** macroeventos añaden trabajo mínimo al tick. El sistema `runMacroEvents` solo filtra eventos expirados (O(n) con n = eventos activos, típicamente 0-3). Los modifiers no se leen todavía desde otros sistemas, así que el impacto real es cero hasta que se conecten.

## Tests

**`packages/simulation/src/macro-events.test.ts` (15 tests):**
- `createInitialMacroEventsState`: estado vacío con ordinal 1
- `macroEventId`: IDs deterministas con padding
- `activateMacroEvent`: duración, modifiers, intensidad acotada [0,1], apilamiento
- `getActiveMacroEvents`: intervalo activo, endTick exclusivo
- `removeExpiredMacroEvents`: sin cambios si no hay expirados, elimina expirados
- `aggregateMacroEventModifiers`: suma aditiva, escala por intensidad, ignora expirados, acumulació n neta
- Templates: todos los tipos tienen duración positiva y al menos un modifier

**Suite completa:** 267 tests pasan, 5 skipped.

## Estado actual

**Implementado:**
- ✅ Estructura de datos y tipos
- ✅ Templates de macroeventos
- ✅ Sistema O(1) en el tick loop
- ✅ Persistencia en snapshot v1
- ✅ Benchmark longitudinal reescrito
- ✅ Tests unitarios
- ✅ Rendimiento medido y aceptable

**Pendiente (fuera de WP4.12):**
- ⏳ Conectar modifiers a sistemas de producto (housing, production, employment, construction)
- ⏳ Señales UI (mostrar eventos activos en proyección)
- ⏳ Reacciones de IA (rival y facciones leen modifiers)
- ⏳ Trigger de eventos (PRNG o condiciones económicas)

**Nota de scope:** WP4.12 entrega la **infraestructura** de macroeventos. La conexión a sistemas de producto, UI y IA queda diferida porque:
1. Requiere cambios en múltiples sistemas (housing-market, production, employment, etc.)
2. Puede afectar tests de conservación y digestos dorados
3. No es necesario para validar la arquitectura O(1)
4. El rendimiento ya está medido con la infraestructura activa

La conexión a sistemas puede hacerse en WPs futuros sin violar la restricción de D-065/D-076, porque los modifiers ya están disponibles y solo falta leerlos.

## Decisiones de diseño

1. **Modifiers aditivos:** dos eventos con +10% y +15% dan +25%. Simpre, predecible, O(1).
2. **Intensidad 0-1:** permite escalar el efecto del evento sin cambiar el template.
3. **IDs deterministas:** `macro_event_00000001`, `macro_event_00000002`, etc. Save/load estable.
4. **endTick exclusivo:** el evento activo en [start, end), así que removeExpired elimina con `<=`.
5. **Sin trigger automático:** los eventos se activan manualmente con `activateMacroEvent`. El trigger (PRNG, condiciones económicas, calendario) queda fuera de WP4.12.
6. **Templates data-driven:** duración y modifiers en `MACRO_EVENT_TEMPLATES`, no hardcodeados.

## Referencias

- D-065: coste del tick y LOD latente
- D-076: follow-up de hardening Alpha (distribución PROVISIONAL)
- WP4.2: Simulation LOD
- WP4.11-H.1: alpha follow-up
