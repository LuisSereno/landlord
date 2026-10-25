# D-076 — Follow-up de corrección del hardening Alpha (WP4.11-H.1)

Estado: aceptada el 2026-10-25 para el checkpoint **WP4.11-H.1**, después de la auditoría humana de
WP4.11-H sobre `83cc25a`. No abre WP4.12: cierra las inconsistencias entre sistemas que evolucionaron
en WPs distintos.

## Contexto

WP4.11-H pagó la deuda transversal de WP4.2–WP4.11 y dejó CI verde, pero la revisión posterior
encontró seis fallos que no son deuda nueva sino reglas de paquetes diferentes que ya no encajan:
una `WithdrawPolicy` heredada de WP3.11 que borra una ley que ahora impone el concejo (D-074), un
hecho reputacional de WP4.8 que publica al autor de un sabotaje que nadie detectó (D-072), dos
tablas de reputación que la documentación seguía describiendo al revés (D-071), validación de
snapshot que comprueba existencia pero no tipo, una métrica de UI que siempre vale 0 y una gobernanza
de rendimiento (D-065) cuyo disparador ya saltó sin que nadie reformulara qué obliga.

## Decisiones

Numeradas por orden de aterrizaje en el checkpoint; el acta de WP4.11-H.1 conserva el orden de la
auditoría y enlaza cada hallazgo con su decisión.

1. **Una ordenanza `active` ya no se retira con `WithdrawPolicy`.** El comando sólo acepta
   `status === "proposed"`; una ley en vigor —la imponga la jugadora por lobby o la imponga el
   concejo— caduca por `MUNICIPAL_POLICY_DURATION_TICKS` y nadie más la borra. La coherencia con
   D-074 lo pide: si el concejo puede aprobar una ley sin que la jugadora la pida, la jugadora no
   puede desaprobarla sola. Retirar además silenciaría al gobierno, porque el debate siguiente está
   programado contra la caducidad (`nextDebateTick = expiresAtTick`) y no existe derogación
   parlamentaria en Alpha.
   - Alternativa descartada: añadir `source: player_lobby | council` al expediente y permitir la
     retirada sólo de las leyes propias. Resuelve el caso del lobby pero introduce provenance y
     calendario doble por un beneficio que ningún test pide; queda como evolución si algún día el
     concejo admite derogaciones.
   - UI: el botón pasa a llamarse *Retirar propuesta actual* y sólo se habilita con `proposed`.
   - Consecuencia: la regla que WP3.11 documentó ("retira una propuesta o una política activa") queda
     parcialmente superada y su acta se anota en lugar de reescribirse.

2. **La atribución de un sabotaje se separa de su autoría.** `IncidentRecord` mantiene
   `causedByAgentId` / `causedByOrganizationId` como verdad autoritativa y gana
   `publiclyAttributedOrganizationId`, que sólo se llena cuando la tirada de detección del sabotaje
   vio al agresor. El hecho reputacional `violent_sabotage` (D-075 decide 11) se registra contra la
   atribución pública, no contra la verdad: un sabotaje no detectado no puede bajar la reputación del
   atacante ante vecinos, municipio y banca, porque nadie en el distrito sabe quién fue. Es la misma
   separación que D-072 ya exige para `truth ≠ public knowledge ≠ inferred`: la reputación mide lo que
   la calle conoce, y el incidente causante sigue siendo auditable para el motor y para una futura
   investigación policial.
   - Alternativa descartada: un booleano `perpetratorDetected`. Resuelve el caso inmediato pero no
     deja sitio para atribuciones que lleguen por otros canales (testigos, registro de accesos); con
     `OrganizationId | null` una investigación futura escribe en el mismo campo.
   - Compatibilidad: el campo es `nullable().default(null)`, así que una partida anterior restaura sin
     migración y su delta canónico es sólo superficie (ver los digestos regenerados).
   - Deuda registrada: la onda expansiva de un colapso (`ignite(..., "blast")`) no propaga la
     atribución al incidente secundario, así que un saboteador detectado cuyo edificio derriba a un
     vecino no carga por las víctimas indirectas. Se deja en `ai-context/KNOWN-GAPS.md`, junto con la
     ausencia de canal para investigar un sabotaje no atribuido.

3. **La integridad del snapshot comprueba el tipo de organización, y el estado canónico deja de
   prometer lo que la snapshot no guarda.**
   - `validateSnapshotReferences` ya no se conforma con que la referencia exista: los roles reservados
     a una empresa exigen `kind === "company"`. Son `contracts.reliabilityByOrganizationId` (la consume
     `SubmitPublicBid`), los sujetos de `intelligence.estimatesBySubjectOrganizationId`
     (`CommissionIntelligence` rechaza cualquier no-empresa con `INTEL_SUBJECT_UNKNOWN`) y los tres
     registros de facciones (`profileByOrganizationId`, `memoryByOrganizationId`,
     `cycleCountByOrganizationId`) con ambos extremos de `stanceByPairId`. En Alpha el banco, el
     municipio y la aseguradora no son actores estratégicos, así que un snapshot que les dé uno de esos
     papeles es estado corrupto, no una partida legítima. `reputation` se queda en comprobación de
     existencia: `runReputation` anota `tax_arrears` recorriendo `state.organizations` sin filtrar tipo,
     así que hoy ninguna regla del motor prohíbe que otra organización tenga hechos.
   - `canonicalizeState` serializa `clock.tick` pero ya no `clock.runState` ni `clock.speed`. Son
     controles del scheduler y de la UI: `serializeSnapshot` no los persiste y `restoreStateFromSnapshot`
     reconstruye siempre `paused` a 1x, de modo que incluirlos hacía falsa la promesa de que
     `canonicalizeState(restored) === canonicalizeState(original)` para una partida guardada corriendo a
     2x o 4x. La alternativa —persistirlos en la snapshot— convertiría en estado autoritativo del mundo
     algo que decide la pestaña del navegador. Los diez digestos cambian por esta decisión, atribuidos a
     superficie reconstruyendo la cadena anterior sobre los mismos estados.
   - Los tests de canonicalización dejan de sobreafirmar: lo que se etiquetaba como `crews` e
     `incidents` mutaba contadores, no entidades. Ahora `crews` añade un jornalero a la cuadrilla,
     `incidents` sube la intensidad del siniestro (planta uno sobre un edificio real si la campaña no
     dejó ninguno) y `pendingCommands` encola un `SetMaintenancePolicy`, con `idCounters` y
     `phase2.idCounters` como casos separados y explícitos.

4. **La UI de hacienda muestra la tasa que se va a cobrar, no el acumulado que siempre vale 0.**
   `revenueThisMonthBySource.serviceFee` se devenga dentro de `runMunicipalBudget`, se suma al total
   histórico y se vuelve a cero en la misma ejecución, sin proyección intermedia: desde fuera el
   municipio parecía no cobrar tasa nunca, aunque el distrito pagara cientos de unidades al mes. El
   informe gana `serviceFeeDueNextSettlement = municipalServiceFee(state)` —la misma función pura que ya
   usa el ánimo fiscal desde D-075— y el panel la enseña junto al histórico efectivamente cobrado. No es
   un cuarto campo contable: no se persiste, se deriva en la proyección, así que el estado canónico y los
   digestos no se mueven.
   - Alternativa descartada: dejar el acumulado sin resetear en el cierre. Duplicaría la tasa en el
     siguiente histórico, que sí es contabilidad.

5. **Un disparador de rendimiento abre remediación; no ordena LOD.** D-065 enumeraba disparadores y
   decía "basta uno" para activar el diseño de zonas agregadas. El cierre mensual cruzó el de 5 ms y la
   lectura literal obligaba a escribir aproximación donde el problema es un bucle: en
   `runHousingMarket`, `placeSearchers` prueba cada hogar contra todo el stock del distrito, O(búsquedas
   × unidades), una vez por mes. La gobernanza pasa a tres pasos obligatorios y en orden: medir bien la
   frontera que disparó, optimizar exacto (preservando los digestos dorados) y sólo si el presupuesto
   sigue sin cumplirse, implementar LOD. El umbral de 5 ms no se relaja; cambia lo que obliga a hacer.
   Consecuencia de planificación: la optimización de `runHousingMarket` va **antes de WP4.13**, y WP4.12
   no debe añadir trabajo nuevo al cierre mensual sin volver a medir.
   - Alternativa descartada: subir el umbral a 40 ms para que el cierre "quepa". Sería reescribir el
     presupuesto para que el dato moleste menos; el disparador existe precisamente para incomodar.
   - Alternativa descartada: implementar ya el LOD agregado. Aportaría tolerancias y transiciones de zona
     por un coste localizado en un sistema, y cerraría la vía exacta que aún no se ha intentado.

6. **La métrica del cierre se separa del tick ordinario y se mide como distribución.** La ventana `month`
   recorre seis ticks, así que `floor(n × 0,95)` devuelve el último elemento: el "p95 mensual" publicado
   por D-075 era el máximo de un único cierre. El informe de ventana añade `ordinaryTick` (distribución
   sin el cierre) y `monthClose` (tick y duración del cierre caído en la ventana, o null), y
   `measureMonthlyCloses` toma muestras de muchos cierres independientes —distrito y semilla propios,
   colocados tres ticks antes de su frontera de mes— para poder hablar de p50, p95 y máximo con sentido.
   En la ciudad de 800 parcelas, 24 cierres: p50 ~28 ms, p95 ~37 ms, máximo ~38 ms, frente a un tick
   ordinario con p95 ~0,08 ms. La asimetría (un cierre cuesta ~200 veces un tick normal) es el hallazgo;
   las cifras absolutas varían con la máquina y el recolector de basura.

7. **La ventana `fire` calienta sin incendios.** `createScaledCity` colocaba los siniestros antes del
   warmup, así que el primer paso horario de propagación se consumía fuera de la sección medida.
   `injectScaledIncidents` se exporta y el arnés la llama al empezar a medir; `createScaledCity` mantiene
   el comportamiento de siempre y los diez digestos lo confirman.

8. **La documentación de reputación se anota, no se reescribe.** D-071, el acta de WP4.8 y el resumen de
   Fase 4 seguían afirmando que desplazar hogares suma ante la banca —y el acta de WP4.8 traía ejemplos
   con `banks +2`— después de que D-075 eliminara ese `+1`. Se deja el texto original como historia de la
   entrega y se añade al inicio de cada documento un aviso con la tabla vigente
   (`residents -3 / municipality -1 / banks 0`), el motivo y el hecho nuevo `violent_sabotage`, apuntando a
   `REPUTATION_POLICY.facts` como fuente de la verdad.
   - Por qué importa: `ai-context/DECISIONS.md` declara que una diferencia entre documentos se resuelve
     con la decisión registrada, y D-071 era literalmente una invitación a reintroducir el exploit: un
     agente que la leyera como canónica "corregiría" el código para devolver el `+1`.
   - La premisa de producto sobrevive intacta —un mismo hecho puntúa distinto por grupo— y hoy la prueban
     `contract_completed` (banca +2) frente a `violent_sabotage` (banca −2), no el desalojo.

## Consecuencias

- Un snapshot manipulado que reparta papeles de empresa a banco, municipio o aseguradora ya no carga:
  `restoreStateFromSnapshot` lo rechaza. El estado legítimo no cambia, y los diez digestos sólo se
  reescriben por la clave de atribución y por la salida de los controles del reloj.
- La promesa de canonicalidad ahora es cierta para cualquier partida: guardar corriendo a 2x o 4x y
  cargar produce la misma cadena.
- El panel de hacienda explica el sistema en vez de mentir sobre él, y el disparador de D-065 vuelve a
  significar algo: hay una remediación exacta obligatoria antes de cualquier aproximación.
- Retirar una ley activa desaparece del repertorio de la jugadora. Si el concejo aprueba una ordenanza
  incómoda, la respuesta es esperar a su caducidad, cambiar el gobierno en las urnas o tener la mesa
  ocupada con una ley propia; eso es exactamente el coste político que D-074 quería medir.
- Ningún documento de Fase 4 promete ya una reputación bancaria por desahuciar. La deuda documental
  queda pagada; la deuda de rendimiento (`placeSearchers`) queda programada antes de WP4.13.

## Evidencia

`docs/execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md`.

- Autoridad del concejo: `municipal-politics.test.ts` (la ley impuesta por el concejo rechaza la
  retirada y conserva su caducidad; al caducar la mesa vuelve a estar libre) y `phase2.test.ts` (lobby
  activo → retirada rechazada, modificadores intactos).
- Atribución: `reputation.test.ts` (visto / no visto / sin víctimas y una carrera real con
  `OrderEnforcerAction`) y `shared/src/snapshot.ts` valida la referencia nueva.
- Integridad y canonicalidad: `snapshot-integrity.test.ts` (los seis roles de empresa rechazados en
  banco, municipio y aseguradora) y `canonical-state.test.ts` (entidades reales, `pendingCommands` y la
  igualdad save/load guardando la partida a 4x).
- Tasa de servicios: `urban-services.test.ts` antes y después del cierre.
- Rendimiento: `system-cost.test.ts` (cierre identificado y separado del tick ordinario, inyección del
  fuego al empezar la medición y distribución de cierres con `measureMonthlyCloses`).
- `tick-conservation.test.ts` regenera los diez digestos con su prueba de superficie.

## Nota de revisión (documentación posterior al push, 2026-10-25)

La relectura del `origin/main` en `4c1df4b` confirma que los seis fixes funcionales están correctos y
que el CI remoto pasa. En el punto 6, sin embargo, la descripción de la distribución sobreestimó lo que
`measureMonthlyCloses` mide hoy. Queda aquí la corrección, sin reabrir el checkpoint.

**Lo que afirma el texto original.** "24 cierres independientes, distrito y semilla propios". Eso
sugiere 24 campañas con historia mensual, y no lo son: `measureMonthlyCloses` recorre un `for (seed)`
exterior y un `for (closeIndex)` interior, y en cada iteración llama a `createScaledCity(seed)` para
saltar después el reloj a `closeIndex * GAME_MONTH_TICKS - 3`. Son por tanto **8 layouts espaciales × 3
posiciones sintéticas del reloj = 24 muestras**, no 24 distritos independientes.

**Por qué importa para la decisión que alimenta.** Las muestras 2 y 3 de cada semilla parten de una
ciudad que nunca vivió un cierre real. Consecuencias concretas:

- `createInitialState` siembra préstamos con `nextPaymentTick = GAME_MONTH_TICKS`. `processLoanPayments`
  exige `loan.nextPaymentTick === state.clock.tick`, así que una ciudad plantada en el tick 71 997 no
  paga en el cierre del mes 2: el `nextPaymentTick` quedó en 36 000 y nunca se ejecutó el paso que lo
  habría desplazado a 72 000. La muestra 2 y la 3 tienen, por construcción, menos carga financiera que
  una partida real.
- El sistema que más nos interesa diagnosticar —`placeSearchers`, ~69 % del cierre, con coste
  O(búsquedas × unidades)— depende de la población acumulada, `searchMonths` envejecidos, vacancia
  derivada y rentas ajustadas mes a mes. Una ciudad recién creada los tiene en valor inicial, no los
  de una partida madura.
- El índice de renta, los leases y los contadores de facción evolucionan con los cierres; tampoco
  existen en las muestras 2 y 3.

**Cómo afecta a los números publicados.** p50 ~28 ms, p95 ~37 ms, máximo ~38 ms sobre 800 parcelas son
mediciones reales de ejecuciones reales, pero sobre una distribución sintética. No sabemos si son sobre-
o subestimación de la carga de una partida madura: puede que el stock de viviendas crezca con los
cierres y `placeSearchers` empeore, puede que la ciudad inicial esté artificialmente congestionada. Lo
que sí sabemos es que **la asimetría cierre/tick ordinario (~200×) y la concentración en `housing` (~69
%) son ciertas** — ambas salen del mismo estado inicial que usamos hoy.

**Gobernanza corregida.** La secuencia de remediación pasa de tres a cuatro pasos obligatorios, en
orden, antes de WP4.13:

1. Reescribir `measureMonthlyCloses` como campaña longitudinal: una ciudad por semilla que vive los
   cierres en secuencia y mide cada uno en su frontera real, sin saltos de reloj. Opt-in (`SYSTEM_COST=1`),
   no test ordinario. Idealmente con 8 semillas × 6–12 cierres para poder reportar mes 1, meses 2–3 y
   meses maduros 4–12 por separado.
2. Re-medir con esa campaña y publicar el baseline definitivo (p50, p95, máximo, proporción de `housing`
   sobre una partida madura).
3. Optimizar `placeSearchers` exacto, preservando los diez digestos dorados.
4. Volver a medir. LOD agregado solo si después de 3 y 4 el presupuesto sigue sin cumplirse.

**Qué NO cambia.** El umbral de 5 ms no se relaja. El hallazgo estructural —el cierre mensual domina el
coste y `housing` domina el cierre— sigue en pie: los datos actuales lo muestran con independencia de
la carga acumulada, y una campaña longitudinal sólo puede afinar la magnitud. La GO para WP4.12 se
mantiene; WP4.12 no debe añadir trabajo nuevo al cierre mensual sin volver a medir, exactamente igual
que antes, sólo que ahora "medir" significa "medir longitudinalmente".

**Nota de revisión 2026-10-25 (WP4.12-R).** La distribución PROVISIONAL de este ADR queda sustituida
por el baseline longitudinal de D-077: `measureMonthlyCloses` crea una ciudad por semilla que vive sus
cierres en secuencia y publica mes 1, meses 2-3 y maduros 4+, con la carga de cada cierre. Medición
`natural` 8×6: media 30,12 ms, p50 29,01 ms, p95 40,87 ms, máximo 48,53 ms; A/B sin shocks 28,44 ms,
tres shocks 33,64 ms y seis 37,60 ms. El cierre sigue fuera del presupuesto p95 y del disparador de
5 ms. `placeSearchers` ya está optimizado de forma exacta (goldens intactos): la cola del cierre
mejora hasta un 25 % en los escenarios cargados, pero la media sigue en ~28 ms porque `buildStock`
(recuento de vecinos O(edificios²)) domina el cierre. Ese es el siguiente candidato exacto antes de
LOD y antes de WP4.13.
