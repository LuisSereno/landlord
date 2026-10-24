# WP4.11 — Política y elecciones iniciales — 2026-10-24

## Estado

`DONE`. Un concejo municipal ficticio de nueve escaños con calendario propio, cinco ejes de opinión calculados
cada mes desde subsistemas que ya existían, tres plataformas data-driven, y una transferencia institucional con
tres canales: el orden de pago del presupuesto, la ordenanza que el concejo intenta imponerse a sí mismo y la
modulación ±25 de la ley que la jugadora cabildea. Decisión en
`docs/engineering/adr/D-074-politica-y-elecciones-municipales.md`.

La línea de aceptación —"las elecciones emergen del estado social y no garantizan el resultado deseado por el
jugador"— está medida dos veces: en la campaña de dos años el gobierno **alterna** (apertura Liga del Trabajo
Local → Suelo Común al mes 6 → Liga al 12 cuando el empleo cae a 89 → Suelo Común al 18) y con 0 y 50 de
influencia la participación, los escaños y el gobernante salen **idénticos**. Decisión de calibración tomada
después de medir, no antes: el eje de impuestos se definió como carga fiscal vivida porque con un eje de tipos
nunca habría bajado de 100 —ninguna ordenanza sube tasas y la jugadora no puede subirlas—, y el de vivienda
contra el presupuesto de renta porque `tenant.budget` no es un ingreso.

## Resultado

- **Institución**: 9 escaños, legislatura de 6 meses, debate 2 meses después de la elección
  (`MUNICIPAL_INSTITUTION`). Doce meses no producían alternancia en la campaña de dos años; tres legislaban antes
  de que la opinión que eligió tuviera consecuencias.
- **Cinco ejes de opinión, ninguno declarado**: vivienda, empleo, seguridad, servicios e impuestos. Cada uno lee
  un subsistema existente —`askingRentFor`, `describeLaborMarket`, `policePressure`/ruinas/incidentes del mes,
  `serviceLevelPercentByCategory`, `revenueThisMonthBySource`— y el único estado nuevo son los cinco números.
- **Vivienda = renta sobre presupuesto de renta del hogar** (cómodo ≤ 80 %, 3 puntos de queja por punto encima,
  desplazado cuenta doble). En el baseline la renta ya consume el 69 % del presupuesto (180 de 260), así que una
  referencia de "parte del ingreso" clavaba el eje cerca de cero.
- **Impuestos = recaudación del mes sobre la renta que paga el distrito** (contribución + transmisiones + tasa de
  servicios; cómodo ≤ 25 %, 2 puntos por punto encima). Exige que `politics` cierre **antes** que `municipal`,
  porque `runMunicipalBudget` vuelca y pone a cero `revenueThisMonthBySource` al liquidar.
- **Saliencia por segmento como dato** (`POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT` + tabla de respaldo): hogar 45 de
  vivienda, artesano 45 de empleo, comerciante 25 de servicios y 15 de tasas. La queja de un votante es la media
  ponderada; ningún `if` decide quién vota qué.
- **Apelación = media ponderada de posiciones sobre los asuntos que duelen**, con castigo al gobierno proporcional
  a lo mucho que prometió en los asuntos rotos (40 %). Sin dolor, el votante contento sostiene al gobierno (75) y
  la oposición se queda en 50: un distrito tranquilo no cambia de manos por el ruido.
- **Participación que sube con la queja**: 45 % base, +0,5 por punto de queja, topada 30…95. Medido en la ciudad de
  24 parcelas: 58 % distrito tranquilo → 64 % con renta ×3, servicios a cero y presión policial 8.
- **Resto mayor con desempate por id**, reparto de apertura si nadie vota y suma de escaños = 9 siempre, probado
  a través de tres elecciones de campaña.
- **Tres canales de transferencia institucional**: (a) el orden de pago del presupuesto es el del partido que
  gobierna; (b) el concejo intenta imponer su propia ordenanza dos meses después de la elección; (c)
  `councilAlignmentPercent` modula ±25 la probabilidad del `LobbyPolicy` y se anota en el evento.
- **El debate se pospone, no destruye**: si otra ordenanza ocupa la mesa, `nextDebateTick` corre un mes. La
  jugadora puede frenar la ley del concejo manteniendo la suya vigente.
- **La jugadora no vota** y el sistema no toca la caja: dos pruebas lo fijan (identidad de resultado con 0 vs 50
  de influencia; saldos y libro de transacciones intactos tras un cierre con elección).
- **Tres plataformas, ningún candidato**: `MUNICIPAL_PARTY_CATALOG` con cinco posiciones 0…100, una permutación de
  las cuatro categorías de gasto, una ordenanza del catálogo y sus escaños de apertura (2+4+3=9). *Concentración
  del Suelo Común*, *Liga del Trabajo Local*, *Unión de Cuentas Claras*.
- **Sin ordenanzas nuevas ni campos nuevos en `Ordinance`**: `ORDINANCE_AXES` conecta los cinco modificadores ya
  existentes con su eje y su signo de alivio (bajar renta o tasas alivia −1; aprobar más licencias alivia pero se
  anota +1). Sólo se añadió `policy_00000004` —*Tope de renta del Umbral*— como ordenanza preferida de Suelo Común.
- **Persistencia aditiva**: `phase2.politics` opcional; una partida anterior arranca la legislatura de referencia.
- **`politics` entra en `canonicalizeState`** (única vez que se hace en Fase 4) porque el subsistema consume el
  arroyo de PRNG compartido y reordena el gasto municipal.
- **Proyección sólo de agregados**: escaños, apoyo, participación, cinco ejes, calendario, nombre del gobernante y
  su ordenanza. Ninguna clave `tenant_` sale de la sección.

## Evidencia

### Evidence

- `packages/simulation/src/municipal-politics.ts`: `MUNICIPAL_INSTITUTION`, `MUNICIPAL_MOOD_POLICY`,
  `MUNICIPAL_ELECTION_POLICY`, `POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT`, `politicalPartyById`,
  `initialMunicipalPoliticsState`, `computeCivicMood`, `councilAlignmentPercent`, `budgetPriorityFor`,
  `runMunicipalPolitics`, `describeMunicipalPolitics` (privados: `censusHomes`, `housingMood`, `employmentMood`,
  `safetyMood`, `servicesMood`, `taxesMood`, `grievanceFor`, `appealFor`, `allocateSeats`, `governingPartyOf`,
  `holdElection`, `runCouncilDebate`).
- `packages/simulation/src/municipal-politics.test.ts`: 23 pruebas en cuatro bloques (institución y calendario,
  opinión desde el estado social, voto/participación/transferencia, persistencia/proyección/campaña).
- `packages/shared/src/domain.ts` (`POLITICAL_ISSUES`, `PoliticalIssue`, `MunicipalParty`,
  `MunicipalPoliticsState` y su esquema), `snapshot.ts` (campo opcional en esquema y tipo `SnapshotV1`) y
  `projection.ts` (sección pública `politics`).
- `packages/simulation/src/game-data.ts` (`MUNICIPAL_PARTY_CATALOG`, `policy_00000004`), `state.ts`, `systems.ts`
  (sistema `politics` antes de `municipal`), `snapshot.ts` (serializar/restaurar), `projection.ts`, `runner.ts`
  (digesto canónico), `municipal-budget.ts` (orden desde la plataforma) y `commands.ts` (`LobbyPolicy`).
- `packages/simulation/src/municipal-budget.test.ts` reescrita para **declarar** su gobernante y `phase2.test.ts`
  con el catálogo de cuatro ordenanzas.
- `packages/simulation/src/tick-conservation.test.ts`: regeneración justificada de los diez digestos.

### Finding

**La campaña alternó el gobierno por el motivo equivocado… hasta que se midió.** Con la primera definición del
eje de impuestos (tipos frente a una línea base) el eje quedaba clavado en 100: ninguna ordenanza del catálogo
sube tasas. Con la segunda definición (carga vivida) apareció un problema de orden —`municipal` pone a cero
`revenueThisMonthBySource` al liquidar— y la solución movió `politics` delante del presupuesto. La campaña de 24
meses en la ciudad de 24 parcelas (seed 4) cierra así: mes 6, opinión `vivienda 93` y gobierno **Suelo Común** 9-0
con 50 % de participación; mes 12, opinión `vivienda 98 / empleo 89` y **la Liga gana 9-0** con 40 %; mes 18,
empleo otra vez 100 y **Suelo Común recupera el concejo** con 38 %. El eje que manda cambia solo, y con él el
partido.

**El concejo legisló tres veces y dos se equivocó.** Debates en los meses 8, 14 y 20: los dos primeros sorteos son
rechazo (el tope de renta del Suelo Común en el 8, la renovación de la Liga en el 14) y en el 20 entra en vigor la
ordenanza 4 con `status: "active"`. Ninguna de las tres leyes las pidió la jugadora.

**La influencia compra menos que antes.** La misma ordenanza (`policy_00000004`) con la misma inversión de 2
puntos de influencia sale al **65 %** con concejo afín, **48 %** con concejo hostil y **55 %** con uno neutro. La
tabla de alineamiento completa (tres partidos × cuatro ordenanzas) va de −15 a +25 y está topada a ±25: ninguna
formación aprueba ni bloquea una ley ella sola.

**La transferencia se ve en el servicio, no en el discurso.** Con 15 u. de caja municipal, la plataforma de obras
paga transporte al 100 % y deja administración al 90 %; la de cuentas al revés (100 y 83) y limpieza a 0. El mismo
dinero, tres categorías con dueño distinto —y al mes siguiente eso es la opinión de servicios que vota.

**La queja mobiliza, pero poco a poco.** En la ciudad de 24 parcelas, degradar renta (×3), servicios (a 0) y
seguridad (presión 8) sube la participación de **58 % a 64 %** y hunde vivienda de 78 a 0. Un electorado de cuatro
votantes no mostraba ningún cambio medible —el mismo 50 %—, y ésa fue la razón de mover la prueba al distrito
grande: con muestras pequeñas la participación es ruido, no señal.

**Un distrito de un solo asunto elige 9-0.** Semilla 11, renta y empleo a cero: Suelo Común 8, Cuentas Claras 1
(apoyo 88/0/13 sobre 8 votantes). Semillas 7, 12, 13 y 21 con la misma opinión dan 9-0. La distancia de apelación
entre plataformas sobre el eje dominante es de 40 a 50 puntos y el ruido de persuasión es ±15, así que el resto
mayor sólo se ejerce cuando duelen varios ejes. Se decidió no ampliar el ruido: un ruido del orden de la distancia
se comería la señal social. Queda anotado como deuda de tuning.

**Los diez digestos cambian y ocho no deberían.** `politics` entra en el estado canónico, así que se regeneran los
diez. Comprobación: quitando el bloque `politics` del JSON, **ocho** recuperan exactamente su digesto de WP4.10.
Los dos que no son los cruces de cierre mensual, donde el delta sí es económico —el orden de pago cambia—;
neutralizando la transferencia con un `governingPartyId` fuera del catálogo, esos dos recuperan
`611b01b5e69f0d61` y `7ab1cf04050e3d4d`, sus valores de WP4.10. Ninguna otra caja, transacción, hogar ni incidente
se mueve por otro canal.

**El WP4.5 no podía quedarse casado con un partido por defecto.** La prueba de recorte por prioridad asumía el
orden histórico del motor; con la gobernanza de apertura (Liga, que paga transporte primero) los 15 u. ya no
llegaban a limpieza. Se corrigió la prueba declarando a *Unión de Cuentas Claras* como gobernante y recalculando
los niveles, en vez de dejar el WP4.5 acoplado a quién abre en el poder.

### Path

```
mensual (tick % 36 000 == 0, antes que municipal):
  censusHomes -> rentRoll / burdenPoints / displaced
    -> housingMood (80 % cómodo, 3/pt, desplazado ×2)
    -> taxesMood  (revenueThisMonth propertyTax+transferTax+serviceFee / rentRoll, 25 % cómodo, 2/pt)
  employmentMood = employmentRatePercent · safetyMood = 100 − (6·presión + 5·ruina + 3·siniestro)
  servicesMood = media de transport/security/cleaning ya pagados
  -> politics.moodByIssue, lastMoodTick

  if tick >= nextElectionTick: holdElection
    votantes por id -> turnout = clamp(45 + 0.5·grievance(segmento), 30, 95) -> nextInt(0,100)
    -> appeal = 100·Σ(peso·(100−ánimo)·posición)/Σ(peso·(100−ánimo)) [+ castigo 40 % al gobernante]
       + ruido nextInt(0,31)−15
    -> allocateSeats (resto mayor, desempate por id, apertura si 0 votos)
    -> governingPartyId, lastTurnoutPercent, supportPercentByPartyId,
       nextElectionTick = tick + 6 meses, nextDebateTick = tick + 2 meses

  if tick >= nextDebateTick: runCouncilDebate
    mesa ocupada por otra ley -> nextDebateTick += 1 mes (no se toca la ley del jugador)
    mesa libre -> chance = clamp(5, 95, approvalChance + councilAlignmentPercent) -> sorteo
                 -> ordinance = bill activo hasta tick + 6 meses, o rejected

jugadora: LobbyPolicy -> alignment = councilAlignmentPercent(ordenanza)
  -> chance = clamp(5, 95, approvalChance + (influencia−1)·15 + alignment)

municipal (justo después): budgetPriorityFor(state, MUNICIPAL_BUDGET_POLICY.priority)
  -> orden de pago del recorte -> serviceLevelPercentByCategory -> housing/deseabilidad (D-066)
```

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm check:architecture
pnpm exec eslint packages/simulation/src/municipal-politics.ts packages/simulation/src/municipal-politics.test.ts \
  packages/simulation/src/{game-data,state,systems,snapshot,commands,municipal-budget,runner,projection}.ts \
  packages/shared/src/{domain,projection,snapshot}.ts packages/simulation/src/{tick-conservation,municipal-budget,phase2}.test.ts
pnpm exec prettier --check <los mismos ficheros>
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, **202** en simulation (5 opt-in omitidos) y 17 en web. Las veintitrés
  pruebas nuevas de WP4.11 pasan; `tick-conservation` pasa con los diez digestos regenerados.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios y la nueva ordenanza visible en la lista de
  proposición (`Promover Renovación de barrio / Proponer Disciplina fiscal / Proponer Tope de renta del Umbral`).
  Ocho ticks no cruzan un cierre mensual, así que ni opinión ni elección se observan en el recorrido.
- Guarda de arquitectura en verde, eslint y prettier limpios sobre el código tocado.

## Deuda detectada no corregida en este WP

- **Un solo eje de dolor produce parlamento 9-0** y apoyo publicado 100/0/0. El resto mayor está y se ejerce con
  dos ejes rotos, pero la escala del ruido (±15) no es comparable a la distancia entre plataformas (40-50). El
  disparo para tocarlo: cuando exista un consumidor del reparto (coalición, moción, presupuesto negociado) o un
  barrido de parámetros. Ampliar `persuasionNoisePoints` a secas destruiría la señal social.
- **`canonicalizeState` sigue ciego a `housingMarket`, `employment`, `municipal`, `contracts`, `reputation`,
  `intelligence` y `factions`.** Este WP añade sólo `politics`, que era la que necesitaba digesto propio; la
  pasada de línea base debería meter las siete a la vez y regenerar una sola vez.
- **El digesto canónico depende del orden de claves de los objetos.** Un estado restaurado no produce la misma
  cadena que el original (el caso de `agents`), por eso las pruebas de save/load comparan estructura
  (`JSON.parse`) y no `toBe`, igual que hacía la prueba de generación de distrito.
- **La opinión de servicios va un mes por detrás del servicio** y el eje de impuestos depende de que `politics`
  cierre antes que `municipal`. Ninguna prueba de tipos lo protege; está comentado en `PRODUCT_SYSTEMS`, en
  `servicesMood` y en `taxesMood`. Un test que mueva el orden y falle sería el parche barato, pero acoplaría la
  prueba al orden de un array.
- **La jugadora no puede subir tasas**, así que el eje de impuestos sólo se mueve vía tasa de servicios (D-069) y
  base de rentas. La palanca fiscal directa sigue sin existir; corresponde a la perspectiva política jugable.
- **Sin candidatos**: la agenda de `docs/product/05-politics-and-society.md` lista atributos posibles
  (ambición, integridad, aversión al riesgo, popularidad, dependencia de grupos) que hoy no tienen lector. No se
  implementaron porque no hay consumidor.
- **No hay exposición del concejo en la interfaz.** `apps/web/src/App.tsx` no tiene panel de política municipal y
  sigue leyendo la categoría `services` obsoleta de la línea municipal desde WP4.6. La sección `politics` de la
  proyección ya está servida; dibujarla no requiere estado nuevo.
- **Sin protesta, medios, grupos de presión ni lobbies como actores**: la opinión sólo se expresa en las urnas
  cada seis meses. Con seis meses de legislatura, una partida corta no ve ninguna elección.
- **Elecciones sobre el arroyo de PRNG compartido**: dos partidas idénticas divergen económicamente tras una
  elección distinta. Es correcto (D-060) pero significa que "mismo mundo, otro voto" no es una comparación limpia;
  `intelligence` (D-072) sí usa arroyo aparte porque su resultado es creencia, no estado.
- **Quince cifras de calibración a mano**, con cuatro escenarios medidos y sin búsqueda de parámetros.
- `pnpm lint` sigue fallando en repo completo por `blender_artist/toolchain/` (JS vendorizado fuera de `packages`
  y `apps`); `pnpm format:check` sigue fallando por ficheros ya commiteados antes de este WP.

## Fuera de alcance

No se implementan shocks macroeconómicos condicionados (WP4.12), automatización y delegación con gameplay LOD
(WP4.13), inspector de estado y editor de balance (WP4.14), ni panel de interfaz para el concejo. Quedan también
fuera la perspectiva ciudadana y la criminal jugables, los candidatos con atributos, referéndums y mociones de
censura, coaliciones de gobierno, campaña electoral con debates, prensa y protestas, y el presupuesto aprobado por
votación del concejo. La instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
