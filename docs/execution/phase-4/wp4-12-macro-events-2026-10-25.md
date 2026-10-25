# WP4.12-R — Macroeventos económicos: cierre del alcance original

## Estado

`DONE` el 2026-10-25 sobre `50e7f49`. Reapertura de WP4.12 tras la auditoría humana que señaló cinco
desencuentros entre el plan de Fase 4, el acta anterior y el código. No es un rediseño: corrige la
infraestructura, conecta los seis modifiers a sus consumidores centrales, añade trigger determinista,
señal pública, reacción de IA, pruebas de save/load con evento activo y un benchmark A/B con la misma
metodología. Decisión en `docs/engineering/adr/D-077-macroeventos-acotados.md`.

## Baseline

- HEAD inicial: `50e7f49a61ec8afb522d793c6fe4d1fd085cda12`, igual que `origin/main` al iniciar.
- Se conserva lo que la auditoría aprobó: tipos, estado, templates, helpers de agregación, limpieza
  en `PRODUCT_SYSTEMS`, persistencia aditiva, 15 tests del módulo y el benchmark longitudinal.
- No se toca `placeSearchers` ni se abre WP4.13.

## Hallazgos y correcciones

### 1 — Duraciones ×50 más cortas que lo declarado (`P1`)

- **Finding:** los templates usaban `3 * 30 * 24 = 2 160` ticks comentados como «3 meses», cuando
  `GAME_MONTH_TICKS` vale 36 000. Una escasez «de 3 meses» duraba 1,8 días y no llegaba ni al primer
  cierre mensual.
- **Fix:** `durationMonths` en el template y conversión con `GAME_MONTH_TICKS`.
- **Tests:** la duración de cada tipo se compara contra el calendario del motor y se comprueba que un
  evento activado en el tick 0 sigue vivo en el cierre del mes 1.

### 2 — `macroEvents` fuera del estado canónico (`P1`)

- **Finding:** `canonicalizeState` serializaba once agregados Alpha pero no `macroEvents`; dos
  partidas con shocks distintos compartían digesto y los dorados no protegían el sistema.
- **Fix:** el bloque completo (eventos, ordinal, arroyo y próximo sorteo) entra en la superficie
  canónica. `canonical-state.test.ts` muta `nextEventOrdinal` y exige que el digesto cambie.
- **Digestos:** los diez dorados se regeneran de forma deliberada. Atribución verificada: eliminando
  `phase2.macroEvents` del estado canónico nuevo, los diez recuperan exactamente sus valores de
  WP4.11-H.1. En esos diez casos el sorteo natural no disparó ningún shock (10 % mensual y sólo tres
  cruzan un cierre), así que no hay delta económico que atribuir.

### 3 — Ningún consumidor activaba un macroevento (`P1`)

- **Finding:** `activateMacroEvent` existía pero el runtime sólo limpiaba expirados; la partida vivía
  con `events: []` para siempre.
- **Fix:** trigger mensual determinista. `nextCheckTick` programa el sorteo en cada cierre; si no hay
  evento activo, un `Xoshiro128ss` propio (derivado de la seed y decorrelacionado del económico)
  decide con 10 % mensual, tipo uniforme e intensidad 50–100 %. El arroyo entra en el snapshot y en
  el estado canónico.
- **Tests:** determinismo por seed a dos años, aislamiento del PRNG económico (una campaña con
  trigger y otra sin él terminan con el mismo `state.prng`), cadencia mensual de `nextCheckTick` y
  una campaña de 20 semillas × 60 meses que produce shocks y nunca solapa dos.

### 4 — Los modifiers no afectaban a nada (`P1`)

- **Finding:** `aggregateMacroEventModifiers` estaba bien implementado pero ningún sistema lo leía.
- **Fix:** seis consumidores centrales, sin excepciones dispersas:
  - `materialCost` → precio efectivo de `BuyMaterials`, coste de arranque de obra, `constructionOptions`
    y `market.prices` de la proyección. Se suma a la ordenanza en un único helper.
  - `rent` → `askingRentFor`, sumado a la ordenanza; cobro, contrato y UI comparten la cifra.
  - `demand` → llegada mensual de hogares antes de los topes de plazas.
  - `vacancy` → señal de vacancia que alimenta el descubrimiento de precio (la vacancia publicada
    sigue siendo la observada).
  - `laborCost` → deriva mensual del índice salarial a escala 1/10, separada del paso por tensión.
  - `constructionCost` → esfuerzo de obra (`workRequired`), no un coste en caja artificial.
- **Tests:** compra con escasez pagando el precio efectivo; renta arriba con crisis y abajo con
  recesión; salario +2 puntos con falta de mano de obra; más llegadas con migración; índice de renta
  más bajo con la señal de vacancia de recesión; esfuerzo de obra 154 en vez de 192 con auge.

### 5 — El acta anterior difería objetivos del WP (`P1`)

- **Finding:** UI, IA y conexión a sistemas se habían declarado «fuera de alcance» aunque el plan de
  Fase 4 los exige.
- **Fix:** este checkpoint los entrega. La UI muestra clima económico, intensidad, ventana y efectos
  agregados; la IA rival sesga su utilidad por familia de objetivos con el estado público del mundo;
  y la conexión a sistemas es la del punto 4. El acta anterior queda sustituida por esta.

### 6 — El benchmark no medía con shocks activos (`P1`)

- **Finding:** el acta afirmaba «benchmark con macroeventos activos», pero `measureMonthlyCloses`
  nunca llamaba a `activateMacroEvent`; además comparaba el nuevo benchmark longitudinal contra el
  sintético anterior y atribuía el delta a WP4.12.
- **Fix:** `macroMode: "natural" | "none" | "representative" | "max"`. Los modos forzados desactivan
  el sorteo y reactivan lo que caduque antes de cada cierre, así que la comparación usa la misma
  campaña, las mismas semillas y las mismas cargas; sólo cambian los shocks.
- **Análisis de maduración:** el resultado separa mes 1, meses 2-3 y maduros 4+, y publica una
  muestra por cierre con `seed`, `month`, `tick`, `closeMs`, `tenants`, `buildings`, `vacantSlots` y
  `loansDue`.

### 7 — Contratos duplicados entre shared y simulation (`P2`)

- **Fix:** `macro-events.ts` importa `MacroEvent`, `MacroEventModifiers`, `MacroEventType` y
  `MacroEventsState` de `@landlord/shared`; deja de redeclararlos.

### 8 — CI rojo por formato (`P1`)

- **Fix:** `pnpm format` + `pnpm format:check` verdes antes del commit; la verificación final repite
  la secuencia completa de CI.

## Verificación

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y smokes de Gate 2 y
  Alpha: verdes (ver sección de resultados al final del acta).
- Suite de simulación: 21 tests de macroeventos, 7 de estado canónico, conservación de los diez
  digestos y el resto de la suite sin regresiones.
- Benchmark A/B bajo la misma metodología longitudinal: resultados en la tabla de rendimiento.

## Rendimiento medido

`pnpm system:cost` sobre la ciudad de 800 parcelas, campañas longitudinales (cada semilla vive sus
cierres en secuencia):

| Modo | Semillas × cierres | Media | p50 | p95 | Máximo |
|---|---:|---:|---:|---:|---:|
| `natural` (trigger) | 8 × 6 | 30,12 ms | 29,01 ms | 40,87 ms | 48,53 ms |
| `none` (sin shocks) | 4 × 6 | 28,44 ms | 28,41 ms | 35,84 ms | 39,31 ms |
| `representative` (3 shocks) | 4 × 6 | 33,64 ms | 34,55 ms | 39,10 ms | 40,30 ms |
| `max` (6 shocks) | 4 × 6 | 37,60 ms | 35,70 ms | 49,91 ms | 61,77 ms |

- Tick ordinario: p95 0,079 ms.
- Desglose por maduración en `natural`: mes 1 30,97 ms · meses 2-3 29,25 ms · maduros 4+ 30,41 ms.
  La campaña no degrada con la edad; el coste alto es estructural del cierre, no una fuga de
  `placeSearchers` mes a mes.
- **Lectura del A/B:** los shocks no añaden un barrido, pero sí cambian la carga que el cierre
  procesa. Con `max` activo hay más vacancia y más buscadores esperando plaza (`housing_crisis`
  sube la demanda y la renta), y `placeSearchers` recorre más pares búsqueda × unidad: +18 % de media
  con tres shocks y +32 % con seis frente a `none`. La diferencia es económica, no de lookup.
- Con la carga observada (`tenants` 877-986, `buildings` 595-626, `vacantSlots` 144-219,
  `loansDue` 81-88 por cierre), el cierre sigue cruzando el presupuesto p95 y el disparador de 5 ms
  de D-065. La optimización exacta de `placeSearchers` sigue siendo obligatoria antes de WP4.13 y
  debe volver a medirse con los mismos tres modos.

## Verificación final

- `pnpm format:check`: verde.
- `pnpm lint` (ESLint + fronteras de arquitectura): verde.
- `pnpm typecheck`: verde en shared, simulation y web.
- `pnpm test`: 275 tests pasan, 5 skipped (incluye los 21 de macroeventos, los 7 de estado canónico
  y la conservación de los diez digestos).
- `pnpm build`: verde.
- `pnpm smoke:phase2` y `pnpm smoke:alpha`: verdes (caja del smoke sin cambios, `5228 u.`).
- CI remoto: pendiente de subir el commit; se confirma al hacer push.

