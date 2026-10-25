# WP4.11-H.1 — Follow-up de corrección del hardening Alpha

## Estado

`DONE` el 2026-10-25. Mini-checkpoint autorizado por la auditoría humana de WP4.11-H (baseline
`83cc25a`) antes de WP4.12. Seis puntos de la auditoría resueltos en siete decisiones de D-076, sin
gameplay nuevo y con la verificación del final de este documento en verde.

## Baseline

- HEAD inicial: `83cc25aac6531145e18dc0b76fa17820d0613883`
  (`docs: reconcile phase4 alpha state after hardening`), verificado igual que `origin/main` tras
  `git fetch` y con el árbol limpio. Ese es exactamente el commit auditado, sin trabajo posterior.
- Ninguno de los seis hallazgos estaba corregido por otro trabajo: se relleyeron `commands.ts`,
  `systems.ts`, `snapshot.ts`, `canonical-state.test.ts`, `system-cost.ts`, `App.tsx`, `reputation.ts`
  y los ADR D-065/D-071/D-075 antes de tocar nada.
- Ninguna corrección revierte una decisión de WP4.11-H: D-075 se mantiene y este checkpoint la
  amplía (D-076).

## Hallazgos y correcciones

Numerados según la tabla de la auditoría y ordenados por aterrizaje en el checkpoint (el 3 es puramente
documental y cierra la serie). Las decisiones se registran en D-076.

### 1 — El concejo no tenía autoridad real sobre su propia ley (`P1`)

- **Finding:** `WithdrawPolicy` seguía aceptando `["proposed", "active"]` y el botón de la UI se
  habilitaba para ambos, igual que en WP3.11.
- **Impacto:** `elecciones → partido gobernante → ordenanza impuesta por el concejo → la jugadora
  pulsa "Retirar política actual" → la ley desaparece`. Contradice la premisa de D-074 (una regla del
  distrito cambia sin que la jugadora la pida) y, además, silencia al gobierno: el debate siguiente
  estaba programado contra `expiresAtTick`, así que retirar antes deja `nextDebateTick` en el futuro
  lejano.
- **Causa raíz:** la regla nació en WP3.11, cuando toda la política la controlaba el jugador, y WP4.11
  cambió el modelo sin revisar el comando heredado.
- **Fix:** `WithdrawPolicy` sólo retira `proposed` (D-076 punto 1). La ley en vigor caduca por
  `MUNICIPAL_POLICY_DURATION_TICKS`. El botón pasa a *Retirar propuesta actual* y sólo se habilita
  con una propuesta sobre la mesa.
- **Tests:** `municipal-politics.test.ts` — una ordenanza realmente impuesta por el concejo (semilla
  buscada hasta que el debate prospera) rechaza la retirada con `POLICY_NOT_AVAILABLE` y conserva su
  `expiresAtTick`; al llegar a la caducidad la mesa queda libre y `ProposePolicy` vuelve a aceptarse.
  `phase2.test.ts` — la ordenanza aprobada por lobby ya no se retira y sus modificadores siguen
  aplicados (coste 3300 u.).
- **Docs:** la nota de WP3.11 que afirmaba "retira una propuesta o una política activa" queda
  marcada como parcialmente superendada por D-076.

### 2 — Un sabotaje sin testigos manchaba al atacante (`P1/P2`)

- **Finding:** WP4.11-H añadió el hecho `violent_sabotage` leyendo `incident.causedByOrganizationId`, que `ignite()`
  rellena siempre con la organización del enforcer, se hubiera detectado la tirada o no.
- **Impacto:** `sabotaje no detectado → hay víctimas → vecinos, municipio y banca penalizan al autor`. La
  información imperfecta de WP4.9 (D-072: `truth ≠ public knowledge ≠ inferred`) quedaba rota por un canal que
  nadie paga ni investiga: el motor sabia quién fue y se lo contaba al distrito entero.
- **Causa raíz:** se corrigió la atribución del daño sin tocar el concepto de detección, que ya existía en la
  misma función (`detected` sólo alimentaba `policePressure` y `crime.lastOutcome`).
- **Fix:** `IncidentRecord` separa verdad (`causedByAgentId`, `causedByOrganizationId`) de conocimiento público
  (`publiclyAttributedOrganizationId`, D-076 punto 2). `ignite()` sólo llena la atribución pública cuando la
  tirada detectó al agresor, y el colapso registra `violent_sabotage` contra esa atribución. El campo es
  `nullable().default(null)`, así que una partida anterior restaura sin migración.
- **Tests:** `reputation.test.ts` — sabotaje público castiga al atacante (residentes −10) y al dueño (−8);
  sabotaje sin atribución deja la autoría intacta, cero hecho y cero reputación para el atacante; sin víctimas
  no se anota a nadie; y una carrera real con `OrderEnforcerAction` comprueba que la atribución pública nace con
  la tirada (presión policial 22 ⇒ visto siempre; sin presión se busca una semilla no vista y su autor sigue
  siendo privado). `shared/snapshot.ts` valida la nueva referencia.
- **Digestos:** `tick-conservation.test.ts` regenera los cinco casos con incidentes. Queda probado que el delta
  es superficie: quitando la clave nueva del estado canónico los cinco recuperan su valor de WP4.11-H, y en esos
  diez casos no hay ni un incidente atribuido ni un `violent_sabotage` registrado, así que la puerta nueva no
  mueve reputación, caja ni decisiones.
- **Dejada documentada:** la onda expansiva (`blast`) no propaga la atribución al incidente secundario, y no hay
  canal para investigar un sabotaje no atribuido. Ambas van a `ai-context/KNOWN-GAPS.md`.

### 4 — Integridad semántica del snapshot y promesa de canonicalidad (`P2`)

- **Finding (a):** `validateSnapshotReferences` comprobaba existencia en seis sitios y tipo en otros.
  Un snapshot manipulado podía poner el banco como sujeto de un expediente de inteligencia, como
  adjudicatario con fiabilidad o en perfil, memoria, ciclos y postura de facción, aunque
  `CommissionIntelligence`, `SubmitPublicBid` y la IA de facciones nunca admiten una no-empresa.
- **Finding (b):** `canonicalizeState` incluía `clock.runState` y `clock.speed`, que `serializeSnapshot`
  no guarda y `restoreStateFromSnapshot` reconstruye como `paused` 1x. La igualdad
  `canonicalizeState(restored) === canonicalizeState(original)` sólo valía para partidas pausadas a 1x:
  el test pasaba porque los estados headless que usa están pausados.
- **Finding (c):** los casos etiquetados `crews` e `incidents` en `canonical-state.test.ts` mutaban
  `idCounters`, no entidades, así que afirmaban cobertura de contenido que no tenían.
- **Fix:** los roles reservados a una empresa exigen `kind === "company"` (D-076 punto 3); el digesto
  conserva `clock.tick` y suelta los controles del scheduler; los casos de canonicalización mutan
  jornaleros de la cuadrilla, intensidad del siniestro y una orden pendiente real, con los contadores
  como entradas separadas y honestas. `reputation` se queda en existencia porque `runReputation` recorre
  `state.organizations` sin filtrar tipo: ninguna regla del motor prohíbe hechos a un no-empresa, y
  inventar ahí una restricción sería cambiar la regla para que el test brillara.
- **Tests:** `snapshot-integrity.test.ts` rechaza fiabilidad del banco, expediente del municipio,
  perfil/memoria/ciclos de la aseguradora y postura con el banco como sujeto, y sigue aceptando el
  snapshot legítimo. `canonical-state.test.ts` añade la igualdad save/load guardando a 4x y el cambio
  de `pendingCommands`.
- **Digestos:** los diez cambian (desaparecen dos claves de `clock`). Prueba de superficie: reinsertando
  `"runState":"paused","speed":1` en el estado canónico nuevo, y quitando además
  `publiclyAttributedOrganizationId`, los diez recuperan sus valores de WP4.11-H exactos.

### 5 — La tasa de servicios invisible en la UI (`P2`)

- **Finding:** el panel municipal sumaba `revenueThisMonthBySource.serviceFee` a los ingresos del mes.
- **Impacto:** la jugadora veía `0 tasa de servicios` mes tras mes aunque el distrito pagara la tasa por
  unidad ocupada, mientras propiedad y transferencia sí aparecían. No rompe contabilidad: rompe la
  explicación del sistema, que es lo que el panel existe para hacer.
- **Causa raíz:** dentro de `runMunicipalBudget` la tasa se acredita, se suma al histórico y se vuelve a
  cero en la misma ejecución. No hay ningún instante observable con el acumulado lleno.
- **Fix:** `describeMunicipalBudget` expone `serviceFeeDueNextSettlement` derivado de
  `municipalServiceFee(state)` (D-076 punto 4) y el panel lo muestra como tasa prevista junto al total
  ya cobrado. Nada se persiste, así que el estado canónico y los digestos no se tocan.
- **Tests:** `urban-services.test.ts` cubre distrito vacío (0 honesto), distrito ocupado antes del cierre
  (prevista = unidades × tarifa, acumulado = 0) y después del cierre (histórico == lo previsto, prevista
  sigue contando el mes siguiente).

### 6 — Gobernanza de rendimiento y "p95 mensual" mal nombrado (`P2`)

- **Finding (a):** D-065 enumeraba disparadores y decía que basta uno para activar el LOD. WP4.11-H
  registró que el cierre cruzaba el de 5 ms y concluyó "no implementamos LOD, decisión abierta". Las dos
  afirmaciones no pueden ser ciertas a la vez: o el disparador obliga, o no es un disparador.
- **Finding (b):** la ventana `month` tiene seis ticks. Con seis muestras, `percentile(samples, 0.95)`
  devuelve la última, así que el "p95 mensual de 28,4 ms" era el máximo de un solo cierre. La cifra era
  cierta como dato y engañosa como estadística: invitaba a comparar un pico mensual contra presupuestos
  pensados para el tick continuo.
- **Finding (c):** los incendios de la ventana `fire` se colocaban en `createScaledCity`, antes del
  warmup, así que su primer paso horario de propagación ocurría fuera de lo que se cronometraba.
- **Fix:** D-076 puntos 5, 6 y 7. Cruzar un disparador abre remediación obligatoria en tres pasos
  (medir, optimizar exacto, aproximar sólo si sigue fuera de presupuesto); el umbral de 5 ms no se toca.
  El informe de ventana separa `ordinaryTick` y `monthClose`, y `measureMonthlyCloses` muestrea cierres
  independientes. `injectScaledIncidents` se exporta y el arnés la llama al empezar la medición.
- **Números medidos (SYSTEM_COST=1, 2026-10-25, ciudad de 800 parcelas, 8 semillas × 3 cierres = 24
  muestras):** cierre p50 ~28 ms, p95 ~37 ms, máximo ~38 ms; tick ordinario medio ~0,04 ms y p95 ~0,08 ms;
  `housing` concentra ~69 % del cierre instrumentado. La corrida que publicó WP4.11-H dio 28,4 ms de
  media y una posterior 31,6 ms: lo reproducible es el orden de magnitud, no el decimal.
- **Tests:** `system-cost.test.ts` — la ventana `month` identifica su cierre y lo saca del recuento
  ordinario; una ventana sin cierre publica `monthClose` nulo e `ordinaryTick` igual a `plainTick`; la
  ventana `fire` calienta sin incidentes, los inyecta en el tick de inicio y su primera propagación horaria
  cae dentro de la sección medida; `measureMonthlyCloses` devuelve una muestra por cierre y un cierre
  medio claramente por encima del tick ordinario. Los diez digestos de `tick-conservation` no se mueven:
  la reescritura de `createScaledCity` selecciona los mismos edificios.
- **Deuda programada:** optimizar `placeSearchers` (O(búsquedas × unidades) en el cierre) antes de
  WP4.13. WP4.12 no debe añadir trabajo nuevo al cierre mensual sin volver a medir.

### 3 — Documentación que prometía el exploit bancario ya cerrado (`P2`)

- **Finding:** D-071, el acta de WP4.8 y el resumen de Fase 4 seguían afirmando que desplazar hogares
  suma ante la banca (`banks +1`, con ejemplos `banks +2` en la acta de WP4.8) después de que WP4.11-H
  eliminara ese premio precisamente porque no decae y fabricaba un descuento permanente del préstamo.
  `ai-context/KNOWN-GAPS.md` sí decía "banca neutral ante desalojos": los documentos se contradecían
  entre sí.
- **Impacto:** riesgo operativo, no teórico. `AGENTS.md` declara que las diferencias documentales se
  resuelven por la decisión registrada, y aquí la decisión registrada (D-071) era la obsoleta. Un agente
  que la lea como canónica "corrige" `reputation.ts` para devolver el +1 y reintroduce el exploit.
- **Fix (D-076 punto 8):** avisos fechados en el Estado de D-071, en el Estado del acta de WP4.8 y en su
  propio *Finding*, más la línea correspondiente del resumen de Fase 4 y de `ai-context/DECISIONS.md`. No
  se reescribió la historia de las entregas: cada aviso dice qué cambió, por qué y dónde está la tabla
  vigente (`REPUTATION_POLICY.facts` en `packages/simulation/src/reputation.ts`). La premisa de producto
  que aquellas actas defendían —un mismo hecho puntuado distinto por grupo— se señala viva y probada con
  `contract_completed` (+2 banca) frente a `violent_sabotage` (−2 banca).
- **Comprobación:** `grep` de las afirmaciones obsoletas sobre desalojo y banca en `docs/` y `ai-context/`
  no devuelve ya ninguna sin anotar.

## Verificación reproducible

- `pnpm format:check`
- `pnpm lint` (eslint + `check:architecture`)
- `pnpm typecheck`
- `pnpm test` (shared, simulation y web, incluidos los diez digestos dorados y el test transversal)
- `pnpm build`
- `pnpm smoke:phase2` y `pnpm smoke:alpha`
- CI remoto de `main` en verde.

**Digestos:** los diez regenerados durante este checkpoint (clave de atribución + salida de los controles
del reloj). Cada regeneración quedó atribuida a superficie reconstruyendo la cadena anterior sobre los
mismos estados; ningún escenario mueve caja, hogares, bajas ni decisiones por estos cambios.

## Deuda que deja este checkpoint

- `placeSearchers` en `runHousingMarket` es O(búsquedas × unidades) en el cierre: optimización exacta
  obligatoria antes de WP4.13 (D-076 punto 5). WP4.12 no debe añadir trabajo al cierre mensual sin
  re-medir.
- Un incidente `blast` no hereda la atribución pública del sabotaje que lo originó, y no existe canal para
  investigar un sabotaje no atribuido: ambas cosas en `ai-context/KNOWN-GAPS.md`.
- La retirada de una ley activa por vía parlamentaria (derogación o provenance `player_lobby | council`)
  queda descartada para Alpha; si algún día el concejo debate derogaciones, D-076 punto 1 explica qué
  habría que modelar.
- Protección de `main`: el repositorio sigue permitiendo el bypass de administrador en las reglas de
  protección. Es configuración del hosting, no del código, y queda como asunto de proceso.
