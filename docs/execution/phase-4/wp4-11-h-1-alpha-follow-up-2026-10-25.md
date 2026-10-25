# WP4.11-H.1 — Follow-up de corrección del hardening Alpha

## Estado

`IN_PROGRESS`. Mini-checkpoint autorizado por la auditoría humana de WP4.11-H (baseline `83cc25a`)
antes de abrir WP4.12. Seis puntos, ninguno de gameplay nuevo.

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

Numerados según la tabla de la auditoría; las decisiones se registran en D-076 por orden de aterrizaje.

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

## Verificación reproducible

Pendiente del cierre: `format:check`, `lint`, `typecheck`, `test`, `build` y CI remoto en verde.
