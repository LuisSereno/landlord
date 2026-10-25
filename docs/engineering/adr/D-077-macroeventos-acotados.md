# D-077 — Macroeventos económicos acotados, con trigger propio y efectos cableados

Estado: aceptada el 2026-10-25 para **WP4.12-R** (reapertura de WP4.12 tras auditoría humana). Sustituye
la lectura de WP4.12 como «sólo infraestructura» por el alcance original del plan de Fase 4: shocks
condicionados y acotados, conectados a sistemas existentes, con señales, reacción de IA y pruebas de
inicio, stacking, finalización, save/load y recuperación.

## Contexto

El primer cierre de WP4.12 (`9d40de6`, `50e7f49`) entregó tipos, templates, limpieza en el tick,
persistencia y un benchmark longitudinal correcto, pero la auditoría encontró cinco desencuentros:
las duraciones estaban expresadas en días (×50 más cortas que lo que decían los comentarios),
`macroEvents` no entraba en `canonicalizeState`, ningún consumidor invocaba `activateMacroEvent`,
ningún sistema leía `aggregateMacroEventModifiers`, y el acta difería cuatro de los cinco objetivos
funcionales del WP. El benchmark tampoco medía con shocks activos: comparaba dos metodologías
distintas. WP4.12-R cierra exactamente ese alcance sin rediseñar el sistema.

## Decisiones

1. **Las duraciones se declaran en meses del juego.** Cada template guarda `durationMonths` y la
   conversión usa `GAME_MONTH_TICKS` (36 000 ticks), no `30 × 24`. Un «3» son tres cierres mensuales;
   los tests comparan `endTick − startTick` contra el calendario del motor y no contra el propio
   template. Un evento activado en el tick 0 sigue vivo en el primer cierre. La tabla queda:
   escasez 3, recesión 6, migración 4, auge constructivo 3, crisis de vivienda 5, falta de mano de
   obra 4 meses.

2. **Cota estructural: un evento por tipo y seis en total.** `activateMacroEvent` no apila duplicados
   ni supera `MACRO_EVENT_POLICY.maxActiveEvents`. Como sólo existen seis tipos, el coste de
   `aggregateMacroEventModifiers` está acotado por construcción y es independiente de parcelas,
   edificios, hogares y agentes. La formulación honesta es «coste acotado O(eventos activos ≤ 6)»,
   no «O(1) literal»; lo que importa para D-065 es que no barre entidades.

3. **Trigger mensual determinista con PRNG propio.** Cada cierre mensual programa el siguiente
   sorteo en `nextCheckTick`. Si no hay ningún evento activo, se sortea con un `Xoshiro128ss` propio
   derivado de la seed (`seed ^ 0x9e3779b9`): 10 % de probabilidad mensual, tipo uniforme e
   intensidad 50–100 %. El arroyo vive en `MacroEventsState.prng`, entra en el snapshot y en el estado
   canónico, y **no desplaza el PRNG económico** (mismo patrón que D-072 para inteligencia): una
   campaña con shocks y otra sin ellos comparten exactamente la misma secuencia de sabotajes,
   permisos y subastas. El solapamiento natural está limitado a un evento a la vez; el stacking
   múltiple existe por API y lo prueban los tests, no lo produce el sorteo.

4. **Un solo helper por familia de modifier, compartido por motor y proyección.**
   - `materialCostModifierPercentFor` suma ordenanza y shocks. Lo usan `BuyMaterials` (precio
     efectivo por unidad), `StartConstruction` (coste de arranque), `constructionOptions` y
     `market.prices` de la proyección, así que la cifra que ve la jugadora es la que paga.
   - `rentModifierPercentFor` suma ordenanza y shocks y es la única entrada de política de
     `askingRentFor`; el cobro, la validación de contrato y la UI siguen compartiendo una fórmula.
   - `demandModifierPercent` multiplica la llegada mensual de hogares antes de los topes de plazas
     libres y asequibles.
   - `vacancyModifierPercent` escala la **señal** de vacancia que alimenta el descubrimiento de
     precio (no la vacancia física publicada): una recesión hace que la misma vacancia presione más
     la renta a la baja; una crisis de vivienda, lo contrario.
   - `laborCostModifierPercent` añade una deriva mensual al índice salarial a escala 1/10 (+20 % ⇒
     +2 puntos), separada del ajuste por tensión para que muerda también con el mercado equilibrado.
   - `constructionCostModifierPercent` se aplica al **esfuerzo de obra** (`workRequired`), no a un
     coste en caja artificial: el modelo construye con recursos y trabajo y no se inventa un peaje
     para consumir el modifier. El sitio conserva el esfuerzo con el que nació aunque el shock
     caduque, que es lo que ya hizo el mercado de obra.

5. **La IA reacciona con información pública.** `macroShockBiasFor` convierte los shocks activos en
   un sesgo de utilidad por familia de objetivos (`develop`, `dispose`, `produce`, `finance`,
   `compete`, `protect`). El rival conservador usa el mismo menú de candidatos y el mismo dispatcher;
   una recesión lo inclina a vender y una crisis de vivienda a construir. No recibe ninguna cifra
   privada de la jugadora: el macroevento es estado público del mundo.

6. **Señal pública mínima, sin mecanismo.** La proyección publica eventos activos (tipo, etiqueta,
   intensidad, ventana) y los modifiers agregados; el panel muestra «clima económico», intensidad,
   fin estimado y efectos. No expone el arroyo, la probabilidad mensual ni el próximo tipo, que
   seguirían siendo superficie privada del motor.

7. **Persistencia aditiva y estado canónico completo.** `phase2.macroEvents` gana `prng` y
   `nextCheckTick`. En el schema son opcionales para que una partida anterior a WP4.12-R restaure
   derivando ambos de la seed; el snapshot nuevo los escribe. `canonicalizeState` incluye el bloque
   completo, así que dos partidas con shocks distintos no comparten digesto. Se regeneran los diez
   dorados: quitando `phase2.macroEvents` del estado canónico nuevo recuperan exactamente sus valores
   de WP4.11-H.1 (`290ae56589918230`, `81470bc663a2116a`, `2eedd2a42fda6677`, `440287b1646aa604`,
   `c99ebd1caffb8af6`, `2b460e2479f02a02`, `2ae6584f346b79b3`, `a7c43328b70b75c5`,
   `787f7087a4af7f99`, `f5fcd654560b88e7`). En esos diez casos el sorteo natural no disparó ningún
   shock, así que el delta es superficie canónica y no economía.

8. **Rendimiento medido con la misma metodología.** `measureMonthlyCloses` acepta
   `macroMode: "natural" | "none" | "representative" | "max"` y re-activa los shocks forzados que
   caduquen antes de cada cierre, de modo que la comparación A/B no depende de dónde caiga el sorteo.
   Añade además un desglose por maduración (mes 1, meses 2-3, maduros 4+) y una muestra por cierre
   con `seed`, `month`, `tick`, `closeMs`, `tenants`, `buildings`, `vacantSlots` y `loansDue`, que es
   la carga con la que se diagnosticará `placeSearchers`. Medición en la ciudad de 800 parcelas:

   | Modo | Media | p50 | p95 | Máximo |
   |---|---:|---:|---:|---:|
   | `natural` (8×6) | 30,12 ms | 29,01 ms | 40,87 ms | 48,53 ms |
   | `none` (4×6) | 28,44 ms | 28,41 ms | 35,84 ms | 39,31 ms |
   | `representative` (4×6) | 33,64 ms | 34,55 ms | 39,10 ms | 40,30 ms |
   | `max` (4×6) | 37,60 ms | 35,70 ms | 49,91 ms | 61,77 ms |

   El A/B demuestra que el coste del cierre no crece por el lookup de modifiers (acotado) sino por la
   carga que el shock deja al mercado: con seis eventos activos hay más vacancia y más buscadores, y
   `placeSearchers` recorre más pares búsqueda × unidad (+32 % de media frente a `none`). El tick
   ordinario queda en p95 0,079 ms. El cierre sigue fuera del presupuesto p95 de D-065, así que la
   optimización exacta de `placeSearchers` sigue siendo la deuda previa a WP4.13.

## Consecuencias

- El cierre mensual sigue dominado por `housing`; los shocks no añaden un barrido nuevo y el coste
  agregado está acotado por el número de eventos (≤ 6), no por el tamaño de la ciudad.
- Cualquier evento futuro debe declarar su familia de modifier, su consumidor central y su efecto
  sobre la IA; añadir un modifier sin lector es un fallo de alcance, no una infraestructura.
- El sorteo sólo entra cuando no hay evento activo. Si Alpha pide crisis simultáneas, se cambia la
  condición del trigger en una decisión posterior, no la cota estructural.
- `placeSearchers` sigue siendo la deuda de rendimiento anterior a WP4.13 (D-065/D-076); este WP no
  la toca.
