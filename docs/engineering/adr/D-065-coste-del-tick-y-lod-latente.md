# D-065 — Coste del tick medido por sistema; LOD espacial documentado pero latente

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.2 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide medir el coste por sistema y entidad
antes de agregar, clasificar zona activa/cercana/lejana, definir estado agregado y reglas de
transición, **implementar sólo para los sistemas que excedan budgets**, probar conservación
económica y comparar el resultado agregado frente al detallado dentro de tolerancias documentadas.
Su aceptación es que ampliar la ciudad no degrade linealmente el tick y que cambiar de LOD no
duplique ni destruya valor.

Dos hechos acotan el problema antes de decidir nada:

- **El mundo está limitado a 64×64 celdas** (`map.width`/`map.height` son literales en `GameState`
  y `districtSchema` usa `z.literal(64)`). Con la separación ortogonal que exige la validación de
  jugabilidad de D-064, la ciudad máxima factible es del orden de 800 parcelas. No existe un
  crecimiento ilimitado que el LOD tenga que sostener.
- **Los umbrales ya están fijados** en `docs/execution/phase-0/benchmark-plan.md`: headless tick
  p95 ≤ 10 ms, p99 ≤ 20 ms y ticks por encima de 50 ms ≤ 0,1 %. Cambiar carga o umbral exige ADR
  posterior.

Hasta WP4.2 el tick era una función opaca: `advanceProductSystems` llamaba a diez funciones en
orden fijo sin nombres estables, sin forma de atribuir coste a un sistema y sin ninguna ciudad de
prueba mayor que las ocho parcelas autoradas. No se podía decidir qué agregar porque no se podía
medir nada.

## Decisión

### 1. Los sistemas del tick son entidades nombradas

`PRODUCT_SYSTEMS` es la lista explícita y ordenada de los diez sistemas (`tactical`, `production`,
`rent`, `debt`, `auctions`, `propertyTax`, `maintenance`, `insurance`, `policy`, `rival`) y
`advanceProductSystems` es el único punto que los ejecuta. La lista es a la vez el orden
determinista de D-060 y la unidad de instrumentación: el nombre es estable y lo usan el harness de
coste y, en el futuro, las reglas de LOD.

### 2. Se mide antes de decidir

`packages/simulation/src/system-cost.ts` construye una ciudad sintética escalada y cronometra cada
sistema por separado. La carga es **carga, no balance**: saldos e inventarios se amplían para que
ningún límite económico recorte el camino medido. La generación usa un PRNG propio derivado de la
seed, de modo que `state.prng` queda intacto y la partida sigue siendo la misma. Tres escalas
(barrio, distrito, ciudad) y tres ventanas (día completo, cierre mensual y cascada de incendios)
cubren los regímenes que activan etapas distintas. `pnpm system:cost` reproduce la medición.

El bucle instrumentado replica `advanceProductSystems` y una prueba siempre activa comprueba que
produce exactamente el mismo estado, de modo que la instrumentación no pueda falsear la medición.

### 3. La conservación se blinda con digestos dorados

`packages/simulation/src/tick-conservation.test.ts` fija el digesto de diez carreras largas
(escenarios seed 1/7/42 a 1200 y 36000 ticks, ciudad sintética estable, dos cruces mensuales y tres
cascadas de incendio con colapso y bajas). Toda optimización de coste debe conservarlos. Las tres
carreras de cascada llegan a 37, 135 y 463 edificios en ruina con 150, 544 y 1938 bajas, así que
cubren el recuento de casualties, el desplazamiento de tenants y el daño en cadena, que sólo se
ejecutan con incidentes vivos.

### 4. No se introduce LOD espacial

Ningún sistema excede ningún umbral en la ciudad máxima factible. Con 828 parcelas, 607 edificios,
951 tenants, 290 agentes y 151 pólizas, el tick headless mide de media **0,0498 ms** y p95
**0,1152 ms**: el 0,5 % y el 1,2 % del presupuesto de p95. El máximo observado en las nueve
combinaciones de escala y ventana es 3,19 ms, muy por debajo del límite de 50 ms, y ningún tick lo
supera. Aplicar la regla del propio WP ("implementar sólo para los sistemas que excedan budgets")
significa no agregar nada.

Introducir estado agregado donde no hace falta añadiría tolerancias que validar y un riesgo real de
duplicar o destruir valor en la transición, que es exactamente lo que la aceptación de WP4.2
prohíbe. El trabajo entregado es **exacto, no aproximado**: el estado resultante es idéntico bit a
bit, verificado contra la implementación anterior.

Lo que sí se corrige son costes algorítmicos que eran defectos, no diseño:

- `tacticalTick` ordenaba todos los agentes y recorría todas las etapas horarias en cada tick,
  aunque en 9 de cada 10 ticks no vence ni movimiento ni ninguna etapa horaria.
- El paso horario de técnicos era O(edificios × agentes) y además repartía una copia de la tabla de
  incidentes **dentro** del bucle por edificio: 607 × 290 = 176 030 evaluaciones de predicado por
  hora de juego en la ciudad máxima.
- La ignición mensual comprobaba incidentes activos por edificio con un barrido completo,
  O(edificios × incidentes).
- `settleInsurance` ordenaba toda la cartera en cada tick aunque las primas son mensuales: una
  operación garantizada sin efecto en 35 999 de cada 36 000 ticks.
- `settleAuctions` ordenaba una lista vacía en cada tick sin subastas abiertas.

Sustituidos por salidas anticipadas e índices por edificio (`indexActiveIncidents`,
`indexAdjacentTechnicians`, `collectWorkingMaintenance`) construidos una vez por etapa y
reconstruidos sólo allí donde una etapa anterior puede mutar el estado. Cada índice conserva la
semántica de primer hallazgo del `find`/`some` original y el orden de inserción de la tabla de
incidentes, y se construye después de la etapa que puede invalidarlo: el índice de técnicos tras la
ignición mensual, el de mantenimiento en servicio tras las órdenes de los operativos (que pueden
dejar a un agente sin tarea) y el de incidentes raíz tras la actualización de fuego (que resuelve
incidentes).

Resultado en la ciudad máxima, ventana de día: media 0,2036 → 0,0498 ms (−76 %), p95 0,2303 →
0,1152 ms (−50 %) y máximo 6,53 → 3,13 ms (−52 %). El exponente de crecimiento de barrio a ciudad
(parcelas ×10,62, edificios ×15,18) pasa de 0,935 a **0,744** para la media y de 0,774 a **0,716**
para el p95: el tick ya no crece linealmente con la ciudad.

### 5. Diseño de zonas documentado y latente

La clasificación existe como diseño, no como código. Cuando un disparador la active, se implementa
sobre `PRODUCT_SYSTEMS` sin cambiar el orden del tick.

Las zonas se derivan del estado de la simulación, nunca de la cámara ni del render: el render no
decide reglas de negocio.

- **Zona activa.** Parcelas con obra en curso, incidente activo, agente con tarea asignada,
  contrato de alquiler vigente, subasta abierta o préstamo en mora. Simulación detallada completa
  en cada tick.
- **Zona cercana.** Resto del distrito activo. Detalle completo en las etapas horarias y mensuales;
  movimiento y producción en cada tick. Es el régimen actual de toda la ciudad, porque hoy sólo
  existe un distrito por partida.
- **Zona lejana.** Distintos del distrito activo. Sólo existe cuando la partida tenga varios
  distritos, que WP4.1 dejó fuera de alcance. Agregado mensual por cartera: renta neta, deterioro
  esperado y siniestralidad como tasas, sin agentes individuales, sin navegación y sin incidentes
  propios.

Regla de transición: al cruzar el límite, la zona lejana materializa su estado detallado desde el
agregado consumiendo el PRNG autoritativo de la partida, y la regularización se registra como
transacciones auditables de modo que la suma de caja, edificios y contratos se conserve. Nunca se
crean ni se destruyen valor ni entidades fuera de esas transacciones.

Disparadores de activación. Basta uno. **Desde D-076 (WP4.11-H.1) un disparador no ordena implementar
LOD: abre una remediación de rendimiento obligatoria** —medir bien, optimizar exacto y sólo entonces
aproximar—, ver la revisión al final de esta decisión.

- headless tick p95 por encima de 5 ms en la ciudad de referencia del benchmark;
- ticks por encima de 50 ms en más del 0,1 %;
- el mapa deja de estar limitado a 64×64, o se habilita más de un distrito por partida;
- la carga de producto supera ×4 la ciudad sintética máxima medida (828 parcelas, 607 edificios,
  290 agentes).

### 6. Deuda de coste registrada con disparador

El término lineal que queda es `settleInsurance`, que filtra la cartera completa en cada tick
(59,2 % del coste en la ciudad máxima, 0,0305 ms de media). Un índice de primas vencidas lo
reduciría a O(vencidas), pero exige cambiar el formato de guardado y decidir migración. Se difiere
mientras el p95 siga por debajo del 25 % del presupuesto. El segundo término es `tactical` (30,8 %),
cuyos picos vienen de `findDeterministicPath`, que reordena la lista abierta con un `sort` completo
en cada iteración.

## Alternativas consideradas

- **Implementar el LOD agregado ahora.** Descartada: ningún sistema excede umbral en la ciudad
  máxima factible, y el coste sería introducir aproximación y tolerancias donde hoy hay exactitud,
  con riesgo de duplicar o destruir valor en cada transición de zona.
- **Sustituir `localeCompare` por comparación relacional.** Descartada para este WP aunque medida:
  ordenar 290 ids de agente cuesta 0,0853 ms con `localeCompare` frente a 0,0222 ms con comparación
  relacional (3,8×), 607 ids de edificio 0,1514 frente a 0,0338 (4,5×) y 151 ids de póliza 0,0321
  frente a 0,0051 (6,3×), con el mismo orden en los tres casos y una prueba siempre activa que lo
  verifica sobre agentes, edificios, parcelas, instalaciones, préstamos y obras. Además eliminaría
  una dependencia del locale del entorno, que es un riesgo de determinismo entre máquinas. Se
  rechaza aquí porque `localeCompare` aparece en unos veinte puntos, incluido `orderEntityIds` de
  `clock.ts`: cambiar sólo `systems.ts` dejaría dos criterios de orden en el mismo motor. Requiere
  ADR propio y cambio global.
- **Índice de primas vencidas en el estado de seguros.** Descartada ahora: cambio de formato de
  guardado y migración por 0,03 ms de media. Registrada con disparador en el punto 6.
- **Reordenar, fusionar o paralelizar sistemas.** Descartada: el orden del tick es parte del
  determinismo (D-060) y cualquier reordenación cambia todas las partidas.
- **Agrupar agentes en cuadrillas agregadas para reducir entidad.** Descartada: D-061 exige
  agentes individuales visibles, y la medición no muestra ningún problema que lo justifique.

## Alcance

Incluido:

- `PRODUCT_SYSTEMS` y `advanceProductSystems` como única fuente del orden del tick;
- harness de coste por sistema y escala, con ciudad sintética y ventana de incendios
  (`pnpm system:cost`);
- guarda de conservación por digestos dorados sobre diez carreras largas;
- índices y salidas anticipadas exactas en `tacticalTick`, `settleInsurance` y `settleAuctions`;
- verificación diferencial contra la implementación anterior en cuatro escenarios;
- diseño de zonas y disparadores de activación registrado en esta decisión.

No incluido:

- estado agregado por sistema, transiciones de zona y tolerancias de comparación
  agregado/detallado: quedan latentes hasta que un disparador los active;
- índice de primas vencidas y cualquier cambio de formato de guardado;
- sustitución global de `localeCompare`;
- reescritura del ordenamiento de la lista abierta en `findDeterministicPath`;
- varios distritos por partida (WP4.1 lo dejó fuera de alcance) y cualquier decisión del render.

## Consecuencias

### Positivas

- El coste del tick es atribuible a un sistema con nombre estable y reproducible con una orden.
- La ciudad máxima factible cabe en el presupuesto con dos órdenes de magnitud de margen: p95
  0,1152 ms frente a 10 ms.
- El crecimiento es sublineal (exponente 0,74 en la media y 0,72 en p95 para un crecimiento de
  ciudad de ×10,62 en parcelas y ×15,18 en edificios), que es lo que la aceptación de WP4.2 pide.
- Las optimizaciones son exactas: los diez digestos dorados y la comparación diferencial contra la
  implementación anterior coinciden, así que ninguna evidencia económica anterior pierde validez.
- El diseño de zonas queda escrito con disparadores objetivos, de modo que activarlo es una
  decisión de medición y no una reinvención.

### Costes

- La ciudad sintética del harness es código que hay que mantener cuando cambian los contratos de
  edificios, tenants, préstamos o pólizas; si deja de compilar, la medición desaparece.
- Los digestos dorados se invalidan con cualquier cambio de comportamiento del motor, incluido uno
  legítimo: hay que regenerarlos deliberadamente y justificarlo, no volcarlos a ciegas.
- Tres índices por etapa horaria hacen `tacticalTick` menos literal que los barridos anteriores; a
  cambio cada índice declara en su comentario qué etapa puede invalidarlo.
- `insurance` concentra ahora el 59,2 % del coste en la ciudad máxima. Es el primer candidato si un
  disparador obliga a intervenir, y el único término lineal puro que queda.
- El LOD no implementado sigue siendo un requisito de WP4.2. Se cierra como diseño latente con
  disparadores, no como código: si el responsable no acepta esa lectura, el WP vuelve a `REWORK`.

## Evidencia requerida

- `packages/simulation/src/systems.ts`: `PRODUCT_SYSTEMS`, `advanceProductSystems`,
  `indexActiveIncidents`, `indexAdjacentTechnicians`, `collectWorkingMaintenance` y las salidas
  anticipadas de `tacticalTick`, `settleInsurance` y `settleAuctions`.
- `packages/simulation/src/system-cost.ts`: escalas, ventanas, ciudad sintética, medición por
  sistema, distribución y crecimiento entre escalas.
- `packages/simulation/src/system-cost.test.ts`: reproducibilidad de la ciudad sintética, PRNG de
  partida intacto, neutralidad de la instrumentación, rechazo de escalas imposibles, equivalencia
  de orden relacional/`localeCompare` y medición opt-in por variable de entorno.
- `packages/simulation/src/tick-conservation.test.ts`: diez digestos dorados, incluidas tres
  cascadas de incendio con colapso.
- Acta `docs/execution/phase-4/wp4-2-simulation-lod-2026-10-23.md`.

## Nota de revisión (WP4.11-H, 2026-10-25)

El benchmark mensual corregido mide por fin el cierre real (antes el warmup lo consumía). Con 800
parcelas, la ventana `month` da 4,77 ms de media, **28,4 ms de p95/máximo** (42,8 ms instrumentado) y
`housing` se lleva el 65 %. Eso cruza el presupuesto p95 de 10 ms **para esa ventana** y el disparador
de revisión de 5 ms, aunque el máximo sigue por debajo del límite duro de 50 ms. El tick estable de
día sigue en 0,048 ms de media y 0,109 ms de p95, dos órdenes de magnitud por debajo del presupuesto.

No se implementa LOD en WP4.11-H: está fuera de su alcance y el problema está localizado en un solo
sistema mensual, no en el tick de producto. La decisión queda abierta con datos nuevos; la acción
recomendada antes de WP4.13 es optimizar `runHousingMarket` y volver a medir. Ver D-075 y el acta
`docs/execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md`.

## Nota de revisión (WP4.11-H.1, 2026-10-25) — gobernanza y métrica corregidas

La nota de WP4.11-H tiene dos defectos que este follow-up arregla, uno de gobernanza y uno de métrica.

**Gobernanza.** La lista de disparadores leídos como "basta uno para implementar LOD" hacía que el
motor dictara la solución antes de conocer el problema. Con el cierre mensual cruzando 5 ms, la regla
literal obligaba a escribir simulación aproximada cuando el coste está localizado en un único sistema
(`housing`, ~69 % del cierre) y con una alternativa exacta pendiente: en `runHousingMarket`,
`placeSearchers` prueba cada hogar que busca contra todo el stock del distrito, O(búsquedas × unidades),
en el tick del cierre mensual. Desde ahora, **cruzar un disparador abre una remediación obligatoria en
tres pasos, en orden**: (1) medir bien la frontera que dispara, con distribución real; (2) optimización
exacta, preservando los digestos dorados; (3) LOD agregado solo si, después de (2), el presupuesto
sigue sin cumplirse. El disparador de 5 ms no se relaja: sigue siendo el umbral que obliga a actuar,
lo que cambia es qué obliga. Consecuencia registrada: la optimización exacta de `runHousingMarket`
queda programada **antes de WP4.13** y WP4.12 no debe añadir trabajo nuevo al cierre mensual sin
volver a medir.

**Métrica.** "p95 mensual 28,4 ms" no era un p95: la ventana `month` recorre seis ticks, así que
`floor(n × 0,95)` devuelve el último elemento y el número era el máximo de un único cierre. El arnés
ahora separa las dos cosas. Cada ventana publica `ordinaryTick` (su distribución sin el cierre) y
`monthClose` (la duración exacta del tick que cruzó el mes, o `null`), y `measureMonthlyCloses` mide
muchos cierres independientes —una semilla y un distrito por muestra— para poder hablar de distribución
de verdad. Medido en la ciudad de 800 parcelas, 24 cierres (8 semillas × 3 fronteras): p50 ~28 ms,
p95 ~37 ms, máximo ~38 ms, frente a un tick ordinario con p95 ~0,08 ms y media ~0,04 ms. Es decir, el
cierre cuesta unas doscientas veces más que un tick normal, y esa asimetría —no el "p95 mensual"— es el
hallazgo. El disparador de 5 ms sigue saltado, ahora con la estadística correcta y atribuida a la
frontera mensual. Las cifras exactas varían con la máquina y con el GC (la corrida que publicó
WP4.11-H dio 28,4 ms y otra posterior 31,6 ms de media); lo estable es el orden de magnitud.

**Ventana `fire`.** Los incendios se colocaban en la generación de carga, antes del warmup, así que el
primer paso horario de propagación ocurría fuera de la sección medida. `injectScaledIncidents` queda
exportada y el arnés inyecta al empezar a medir, de modo que la cascada se cronometra desde el primer
update. `createScaledCity` mantiene su comportamiento: los diez digestos de `tick-conservation` no se
mueven con este cambio.

## Nota de revisión (documentación posterior al push, 2026-10-25) — el baseline sigue siendo PROVISIONAL

La nota anterior describía `measureMonthlyCloses` como "muchos cierres independientes —una semilla y un
distrito por muestra". Es impreciso y esta nota lo corrige sin mover el umbral de 5 ms ni retractar la
gobernanza de tres pasos → cuatro.

El bucle real es `for (seed) { for (closeIndex = 1..3) { createScaledCity(seed); ... } }`. Cada
iteración crea una ciudad nueva con `createScaledCity(seed)` y salta el reloj a
`closeIndex * GAME_MONTH_TICKS - 3`, así que son **8 layouts espaciales × 3 posiciones sintéticas = 24
muestras**, no 24 campañas. Las muestras 2 y 3 de cada semilla provienen de una ciudad que nunca vivió
el cierre del mes anterior.

Consecuencia concreta sobre el `nextPaymentTick` de los préstamos sintéticos: se siembra a
`GAME_MONTH_TICKS` (36 000) y `processLoanPayments` exige igualdad exacta contra `state.clock.tick`, así
que la muestra plantada en 71 997 no paga el mes 2 y la plantada en 107 997 tampoco: su ciclo financiero
está congelado en el de la ciudad recién creada. Y en el sistema que domina el cierre —`placeSearchers`
dentro de `runHousingMarket`— la muestra madura y la recién creada son cosas distintas: la primera
acumula llegadas, envejecimiento de buscadores, vacancia derivada, rentas ajustadas y leases viejos; la
segunda no.

**Qué queda firme y qué no.** Firme: la asimetría (~200× entre cierre y tick ordinario) y la
concentración en `housing` (~69 %). Ambas se leen igual sobre el estado inicial que se mide hoy.
Provisional: p50 ~28 ms, p95 ~37 ms y máximo ~38 ms, porque no sabemos si el cierre de una partida
madura con stock acumulado es más caro o más barato que el de la ciudad que construimos al efecto. No
usar esas cifras como presupuesto objetivo hasta tener la distribución longitudinal.

**La secuencia de remediación pasa de tres pasos a cuatro, en orden, antes de WP4.13.**

1. **Reescribir `measureMonthlyCloses` como campaña longitudinal.** Una ciudad por semilla que corre
   en secuencia y mide cada frontera de mes real; sin saltos de reloj, sin resetear historia. Opt-in,
   no test ordinario. Recomendado 8 semillas × 6–12 cierres para poder reportar mes 1, meses 2–3 y
   meses maduros 4–12 por separado, porque nos interesa saber si `placeSearchers` empeora con el
   tiempo.
2. **Volver a medir con esa campaña** y publicar el baseline definitivo: p50 / p95 / máximo del cierre
   sobre una partida madura, con la cuota de `housing` sobre esa muestra real.
3. **Optimizar `placeSearchers` exacto** preservando los diez digestos dorados de
   `tick-conservation.test.ts`.
4. **LOD agregado solo si** después de 3 y 4 el presupuesto sigue sin cumplirse.

WP4.12 (macroeventos) mantiene su GO, con la misma condición que ya tenía: no añadir trabajo nuevo al
cierre mensual sin volver a medir. Con la precisión añadida por esta nota: "volver a medir" significa
"medir longitudinalmente", no "repetir la distribución actual sobre sintéticos". Ver la nota de revisión
equivalente en `docs/engineering/adr/D-076-follow-up-hardening-alpha.md`.

**Nota de revisión 2026-10-25 (WP4.12-R).** La reescritura longitudinal de `measureMonthlyCloses` que
D-076 dejó como paso obligatorio está hecha y publicada en D-077: una ciudad por semilla que vive sus
cierres en secuencia, desglose por maduración y muestra con la carga de cada cierre. El cierre de 800
parcelas mide 30,12 ms de media (p95 40,87 ms) en modo natural y 28,44 ms sin shocks, frente a un tick
ordinario de p95 0,079 ms. El disparador de 5 ms sigue cruzado; la optimización exacta de
`placeSearchers` es el siguiente paso antes de WP4.13.
