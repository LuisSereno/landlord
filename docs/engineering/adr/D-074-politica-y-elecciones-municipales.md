# D-074 — Política y elecciones municipales: opinión por eje, partido gobernante y transferencia del presupuesto

Estado: **Aceptada**
Fecha: 2026-10-24

## Contexto

WP4.11 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide definir instituciones y calendario municipal
ficticios, modelar preferencias a partir de vivienda, empleo, seguridad, servicios e impuestos, añadir
candidatos y partidos ficticios con posiciones data-driven, conectar opinión, presupuesto y policies, evitar
equivalencias directas con partidos reales y probar cambio de apoyo, participación, resultado y transferencia
institucional. **Aceptación: las elecciones emergen del estado social y no garantizan el resultado deseado por
el jugador.**

Hasta aquí la política era una sola cosa: una ordenanza que **sólo la jugadora** proponía y compraba con
influencia (`ProposePolicy` / `LobbyPolicy` en `commands.ts`). No había institución que la discutiera, ni
electorado que la juzgara, ni forma de que una regla del distrito cambiara sin que ella la pidiera. El
presupuesto municipal (D-068) ya recortaba servicios, pero lo hacía en un orden fijo dentro de
`MUNICIPAL_BUDGET_POLICY.priority` —una decisión de diseño sin dueño— y ese recorte alimentaba la deseabilidad
del mercado de vivienda (D-066) sin que nadie lo payara en votos. WP4.10 (D-073) dejó dicho que el disparo para
abrir el planificador rival podía llegar con este WP: un concejo que legisla solo es una secuencia con dos
pasos separados por meses.

Tres invariantes del repo limitaban la solución: la conservación de dinero del baseline (ninguna regla política
puede crear o destruir caja), la determinancia con semilla (D-060 fija que el orden de `PRODUCT_SYSTEMS` y el
arroyo de PRNG son parte del estado) y la regla de propiedad intelectual de AGENTS.md: IP original, sin
nombres, ideologías ni textos de partidos reales.

## Decisión

1. **Un concejo ficticio de nueve escaños, legislatura de seis meses y debate dos meses después de la
   elección** (`MUNICIPAL_INSTITUTION`). Seis meses es el equilibrio medido: con doce, la campaña de dos años no
   veía alternancia; con tres, el concejo legislaba antes de que la opinión que lo eligió tuviera consecuencias
   visibles. El debate con retraso de dos meses existe para que un gobierno electo tenga un mandato que se
   note antes de cambiar una ley.
2. **La opinión son cinco ejes de 0 a 100, cada uno leído en un subsistema que ya existía**
   (`MUNICIPAL_MOOD_POLICY`): vivienda, empleo, seguridad, servicios e impuestos. No se añade ningún estado
   social nuevo —sólo los cinco números— y ninguno de los cinco se declara: se calcula desde el mercado de
   vivienda (`askingRentFor`), el mercado laboral (`describeLaborMarket`), el crime (`policePressure`, ruinas e
   incidentes del mes), el presupuesto (`serviceLevelPercentByCategory`) y la tesorería municipal
   (`revenueThisMonthBySource`).
3. **El eje de vivienda se mide contra el presupuesto de renta del hogar, no contra su ingreso.** La comodidad
   está en que la renta consuma ≤ 80 % de `tenant.budget` y cada punto por encima cuesta 3 de opinión; un hogar
   desplazado cuenta como queja doble. La calibración vino de medir: `budget` **es** un presupuesto de renta
   (en el baseline 180 de 260 = 69 %), así que una referencia de "parte del ingreso" habría dejado el eje clavado
   cerca de cero y la queja estructuralmente invisible.
4. **El eje de impuestos es carga fiscal vivida, no tipo legal**: la suma de contribución urbana, impuesto de
   transmisiones y tasa de servicios dividida por la renta que el distrito paga cada mes, con 25 % como parte
   cómoda y 2 puntos de queja por punto encima. Con un eje de tipos, la opinión nunca bajaría de 100 —ninguna
   ordenanza del catálogo sube tasas y la jugadora no puede subirlos—, así que sería un eje decorativo. Ésta es
   la razón por la que `politics` cierra el mes **justo antes** que `municipal`: `runMunicipalBudget` vuelca y
   pone a cero `revenueThisMonthBySource` al liquidar, y leerla después daría un eje de impuestos siempre en
   cero.
5. **La saliencia es un dato por segmento** (`POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT`), con una tabla de respaldo
   para segmentos desconocidos: al hogar le duele la renta (45), al artesano el trabajo (45) y al comerciante la
   mezcla de licencias y tasas. La queja de un votante es la media ponderada de los cinco ejes por esa saliencia;
   nadie hardcodea "los pobres votan X".
6. **La apelación de un partido es la media ponderada de sus posiciones sobre los asuntos que duelen a ese
   votante.** El que gobierna pierde además una fracción proporcional a lo mucho que prometió justo en los
   asuntos rotos (`incumbentPenaltyFactorPercent` 40 %): ése es el mecanismo por el que la opinión se convierte
   en castigo. Sin dolor, el votante contento sostiene al gobierno (75) y la oposición se queda en 50, así que
   un distrito tranquilo no cambia de manos por el ruido.
7. **La participación sube con la queja** (`MUNICIPAL_ELECTION_POLICY`): base 45 %, +0,5 puntos por punto de
   queja, topada entre 30 y 95. Medido en la ciudad de 24 parcelas: distrito tranquilo 58 %, distrito con la
   renta triplicada, sin servicios y con presión policial 8 → 64 %. La queja no sólo decide a quién se vota,
   decide cuántos van.
8. **Los escaños se reparten por resto mayor con desempate por id** (`allocateSeats`). Si ningún voto se emite,
   el concejo conserva el reparto de apertura —una abstención no puede dejar la gobernanza sin dueño— y la
   suma de escaños es 9 en todos los casos, probado en campaña de dos años.
9. **La transferencia institucional tiene tres canales, todos sobre reglas que ya existían.** (a) El orden de
   pago del presupuesto municipal pasa a ser el del partido que gobierna: con los mismos 15 u. de caja, la
   plataforma de obras deja transporte al 100 % y administración al 90 %, y la de cuentas al revés (100 / 83 y
   limpieza a 0). (b) El concejo intenta imponer su propia ordenanza dos meses después de la elección, con el
   sorteo de aprobación del catálogo. (c) `councilAlignmentPercent` modula ±25 puntos la probabilidad de la ley
   que la jugadora esté cabildeando: la misma ordenanza con la misma influencia sale al 65 % con un concejo afín,
   48 % con uno hostil y 55 % con uno neutro. La influencia deja de comprar la ley por sí sola.
10. **Si otra ordenanza ocupa la mesa, el debate se pospone un mes en vez de borrarla.** La jugadora puede
    frenar la ley del concejo manteniendo la suya vigente: es la única forma de que la institución nueva no
    destruya silenciosamente una decisión del jugador, que era la objeción obvia al canal (b).
11. **La jugadora no vota.** Con la misma semilla y el mismo estado, 0 y 50 de influencia producen exactamente
    la misma participación, los mismos escaños y el mismo gobernante (prueba `el jugador no vota…`). Su única
    palanca política es cambiar el estado que la opinión observa. Ésta es la prueba de la línea de aceptación.
12. **El sistema político no toca la caja.** `runMunicipalPolitics` no mueve saldos ni escribe transacciones:
    probado comparando el mapa de saldos y el longitud del libro antes y después de un cierre con elección.
    El gasto político es una **reordenación** de lo que ya recauda `municipal`, nunca dinero nuevo (baseline de
    conservación de D-056).
13. **Tres plataformas, ningún candidato.** La unidad modelada es el partido, con `positionByIssue` (cinco
   números), `budgetPriority` (las cuatro categorías), `preferredOrdinanceId` (una ordenanza del catálogo) y
    `openingSeats`. No hay personalidad, ambición ni integridad de político: no había ningún consumidor, y la
    agenda de `docs/product/05-politics-and-society.md` los describe como atributos "posibles", no necesarios.
    Un candidato sin lector habría sido estado serializado y pruebas sin juego detrás.
14. **Las plataformas son puramente datos consumibles** (`MUNICIPAL_PARTY_CATALOG` en `game-data.ts`): cada
    posición es un número 0…100 sobre los cinco ejes, cada prioridad de gasto una permutación de las cuatro
    categorías del presupuesto y cada ordenanza preferida un id del catálogo existente. Una prueba recorre el
    catálogo y exige que las permutaciones y las firmas de posiciones sean distintas —dos plataformas iguales
    harían que el voto no eligiera nada— y otra rechaza nomenclatura de partidos reales (lista negra de nombres
    y longitud). La identidad es propia: *Concentración del Suelo Común*, *Liga del Trabajo Local*, *Unión de
    Cuentas Claras*.
15. **Ninguna ordenanza nueva.** La conexión ley↔opinión se hace con una sola tabla (`ORDINANCE_AXES`) que
    asigna a cada modificador existente su eje y su signo de alivio: bajar renta o tasas alivia (−1), aprobar más
    licencias también alivia pero se anota con signo +1. No se han añadido campos a `Ordinance`: los cinco ya
    cruzan con la política por los modificadores existentes y por la palanca del orden de gasto.
16. **El calendario se ancla al tick en el que dispara, no a una tabla de fechas**: tras una elección,
    `nextElectionTick = tick + 6 meses` y `nextDebateTick = tick + 2 meses`. Un cierre que llega tarde por una
    pausa no elige dos veces ni deja el debate huérfano.
17. **Persistencia aditiva y digesto ampliado.** `phase2.politics` es opcional en el snapshot: una partida
    anterior se restaura con la legislatura de apertura (prueba `una partida anterior sin concejo…`). A
    diferencia de D-071, D-072 y D-073, **sí** se añade `politics` a `canonicalizeState`, porque sin él la
    determinancia del subsistema no la cubre el arnés de dorados y sólo quedaría comparando snapshots. El coste
    es que se regeneran los diez digestos; la verificación de que el delta es el pretendido está más abajo.
18. **La proyección publica agregados, nunca el voto.** `economy.politics` expone escaños, apoyo, participación,
    los cinco ejes de opinión, nombre del partido que gobierna, su ordenanza preferida y el calendario. Una
    prueba exige que la serialización de la sección no contenga ningún `tenant_`: el voto individual no se
    persiste ni se proyecta.

## Alternativas consideradas

- **Partidos, ideologías o candidatos con nombre real.** Descartada por AGENTS.md y por diseño: una equivalencia
  real importa un bagaje de votos que el modelo no puede sostener y hace ilegible la sátira propia. La lista de
  plataformas es ficticia y una prueba la vigila.
- **Aprobación del municipio como un único número.** Descartada: un solo eje no puede decir *qué* duele, así que
  las posiciones de los partidos no tendrían sobre qué proyectarse y el castigo al gobierno no podría
  diferenciarse del descontento general. Cinco ejes cuestan cinco números en el estado.
- **Agentes votantes individuales con identidad política persistente.** Descartada: no hay ningún consumidor hoy
  —ninguna regla mira a un votante concreto— y multiplicaría el estado del snapshot por el censo. El censo se
  deriva de los hogares que ya existen; sólo se materializa un voto por unidad de escrutinio en el momento del
  recuento y se tira.
- **Elecciones como tabla de eventos aleatorios.** Descartada: es justo lo que la aceptación prohíbe. El
  resultado es una función determinista del estado social más el ruido de la semilla, no un sorteo.
- **Escaños proporcionales a la población del distrito.** Descartada: el concejo es una institución con un
  tamaño fijo; si la población crece cambia la participación y el peso de cada voto, no el número de actas.
  Hacerlo dependería de un censo que el motor no mantiene.
- **Que el concejo decrete su ordenanza sin sorteo.** Descartada: convertiría la elección en una máquina de
  leyes garantizada, y el WP pide que el resultado *no* garantice lo que la jugadora quiere —pero tampoco lo que
  quiere el concejo—. El sorteo mantiene el riesgo en el sistema de `approvalChancePercent` que ya existía.
- **Que el concejo reemplace la ordenanza vigente por la suya.** Descartada: borra silenciosamente una decisión
  comprada con influencia de la jugadora. Se pospone el debate hasta que la mesa quede libre.
- **Eje de impuestos medido por tipos legales.** Descartada **después de medirla**: ningún elemento del catálogo
  sube tasas y la jugadora no puede subirlas, así que el eje habría quedado clavado en 100 para siempre.
- **Referencia de vivienda sobre el ingreso del hogar.** Descartada **después de medirla**: `tenant.budget` es un
  presupuesto de renta, no un ingreso; con la referencia original el eje se clavaba cerca de cero y la queja
  estructural no aparecía nunca.
- **Ampliar el ruido de persuasión para forzar parlamentos de coalición.** Descartada: la distancia de apelación
  entre plataformas sobre un eje dominante es de 40 a 50 puntos, así que un ruido capaz de partir el voto tendría
  que ser del mismo orden y se comería la señal social. El reparto por resto mayor ya está y se ejerce cuando
  varios ejes duelen a la vez (medido: 8/0/1); queda anotado como deuda de tuning.
- **Cerrar `municipal` antes que `politics`.** Descartada: `runMunicipalBudget` pone a cero
  `revenueThisMonthBySource` al liquidar, así que el eje de impuestos leería siempre cero y la opinión juzgaría
  el recorte en el mismo tick en que se produjo. El orden elegido es parte de la determinancia (D-060) y está
  comentado en `PRODUCT_SYSTEMS`.
- **Dejar `politics` fuera de `canonicalizeState`, como en WP4.8–WP4.10.** Descartada aquí: el subsistema nuevo
  consume el arroyo de PRNG compartido y cambia el orden de gasto municipal, así que su determinancia importa al
  baseline económico. Ampliar el digesto es lo que permite *demostrar* que el delta es sólo el canal pretendido.

## Alcance

Incluido:

- `packages/simulation/src/municipal-politics.ts`: `MUNICIPAL_INSTITUTION`, `MUNICIPAL_MOOD_POLICY`,
  `MUNICIPAL_ELECTION_POLICY`, `POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT`, `politicalPartyById`,
  `initialMunicipalPoliticsState`, `computeCivicMood`, `councilAlignmentPercent`, `budgetPriorityFor`,
  `runMunicipalPolitics` (con `censusHomes`, `housingMood`, `employmentMood`, `safetyMood`, `servicesMood`,
  `taxesMood`, `grievanceFor`, `appealFor`, `allocateSeats`, `governingPartyOf`, `holdElection`,
  `runCouncilDebate`) y `describeMunicipalPolitics`;
- `MUNICIPAL_PARTY_CATALOG` y la ordenanza `policy_00000004` —*Tope de renta del Umbral*— en `game-data.ts`;
- `POLITICAL_ISSUES`, `PoliticalIssue`, `MunicipalParty`, `MunicipalPoliticsState` con su esquema en
  `packages/shared/src/domain.ts`, `phase2.politics` opcional en `snapshot.ts` y la sección `politics` en
  `packages/shared/src/projection.ts`;
- cableado en `state.ts` (estado inicial), `systems.ts` (sistema `politics` antes de `municipal`),
  `snapshot.ts` (serializar/restaurar), `projection.ts`, `runner.ts` (`politics` en el digesto canónico),
  `municipal-budget.ts` (orden de pago desde la plataforma) y `commands.ts` (`LobbyPolicy` modulada por el
  alineamiento, con `councilAlignmentPercent` en el evento);
- veintitrés pruebas en `packages/simulation/src/municipal-politics.test.ts` en cuatro bloques: institución y
  calendario, opinión desde el estado social, voto/participación/transferencia, y persistencia/proyección/
  campaña.

No incluido:

- candidatos con personalidad, ambición o integridad;
- grupos de presión, prensa, protesta o huelga como actores políticos;
- perspectiva ciudadana jugable ni `ControlContext` político (Gate posterior, AGENTS.md);
- referéndums, mociones de censura, coaliciones de gobierno y Presupuesto aprobado por votación;
- campaña electoral jugable, debates con efectos o sondeos;
- panel de interfaz para el concejo;
- barrido de los quince grados de libertad del modelo.

## Consecuencias

### Positivas

- Por primera vez una regla del distrito cambia **sin que la jugadora la pida**: en la campaña de dos años el
  concejo debate tres veces (meses 8, 14 y 20), falla dos sorteos y en el mes 20 pone en vigor el tope de renta
  que la Liga no habría propuesto nunca.
- El resultado emerge del estado social y **alterna**: en esa misma campaña el gobierno pasa de *Liga del
  Trabajo Local* (apertura) a *Concentración del Suelo Común* en el mes 6, vuelve a la Liga en el 12 —cuando el
  empleo cae a 89 y la renta deja de ser el asunto dominante— y regresa al Suelo Común en el 18 con el empleo
  otra vez al 100. Nadie del jugador decide eso; la prueba `la misma participación y escaños con máxima
  influencia o sin ninguna` lo fija.
- El recorte del presupuesto deja de ser una constante del motor y pasa a tener dueño: el mismo dinero financia
  categorías distintas según quién gobierne, y eso se ve en los niveles de servicio que consume el mercado de
  vivienda (D-066) y, al mes siguiente, la propia opinión de servicios.
- La opinión es legible sin panel: cinco números con una causa cada uno, y cada causa apunta a un subsistema
  existente. Un diseñador puede mover el umbral de comodidad de renta y ver a qué partido beneficia.
- Un partido nuevo se añade como dato —cinco posiciones, una permutación, una ordenanza y sus escaños de
  apertura— sin tocar el modelo, cumpliendo la regla de arquitectura de preferir configuración sobre condicional.
- La cota de información de D-072 se respeta sola: la sección proyectada no contiene identificadores de hogar,
  así que no hay voto individual que filtrar.

### Costes

- **Un distrito con un solo asunto roto elige parlamento 9-0.** La apelación es una media ponderada, así que con
  un eje dominante la distancia entre plataformas (40-50 puntos) es mayor que el ruido de persuasión (±15) y el
  apoyo publicado queda en 100/0/0. El resto mayor sólo se ejerce cuando duelen varios ejes a la vez. Es
  honesto como modelo de elección monomátemática y queda anotado como deuda de tuning.
- **La opinión de servicios va un mes por detrás del servicio.** `politics` cierra antes que `municipal` —que es
  lo que hace legible el eje de impuestos—, así que el vecino juzga el nivel que ya tenía, no el recorte que se
  está aprobando en el mismo tick. Elegimos un eje correcto y un retraso antes que dos ejes adelantados.
- **El eje de impuestos depende del orden de `PRODUCT_SYSTEMS`.** Si alguien mueve `politics` después de
  `municipal`, el eje se clava en 100 sin que salte ningún test de tipos. Está comentado en los dos sitios.
- **La jugadora no puede subir tasas**, así que el eje de impuestos sólo se mueve por la tasa de servicios (D-069)
  y por la base de rentas. Su palanca fiscal sigue siendo indirecta.
- **Las elecciones consumen el arroyo de PRNG compartido** (participación, ruido y sorteo del debate), así que un
  resultado electoral desplaza el stream económico de los meses siguientes. Es correcto —la semilla y el estado
  siguen siendo la única fuente (D-060)— y es la razón por la que `politics` entra en el digesto canónico, pero
  significa que dos partidas idénticas divergen económicamente tras una elección distinta. `intelligence` (D-072)
  usa un arroyo aparte; la política no, porque su resultado **es** estado de juego.
- **Una partida de menos de seis meses no ve ninguna elección**, y el `smoke:phase2` recorre ocho ticks. El WP no
  se observa en navegador; se observa en la campaña headless.
- **No hay ninguna exposición del concejo en la interfaz** (ver deuda del acta sobre `App.tsx`): la jugadora hoy
  ve el efecto —sus leyes cuestan más o menos, el servicio que cobra su barrio cambia de orden— pero no el
  panel.
- Quince números de calibración (umbral y sensibilidad de vivienda, pesos de seguridad, comodidad y sensibilidad
  fiscal, tres pesos de saliencia por segmento, participación base y pendiente, dos topes, ruido y castigo al
  gobierno) están elegidos a mano y medidos con cuatro escenarios, sin búsqueda de parámetros.

## Evidencia requerida

- `packages/simulation/src/municipal-politics.ts` y `municipal-politics.test.ts`.
- `packages/shared/src/domain.ts` (`PoliticalIssue`, `MunicipalParty`, `MunicipalPoliticsState` y su esquema),
  `snapshot.ts` y `projection.ts`.
- `packages/simulation/src/game-data.ts`, `state.ts`, `systems.ts`, `snapshot.ts`, `projection.ts`, `runner.ts`,
  `commands.ts`, `municipal-budget.ts`.
- `packages/simulation/src/municipal-budget.test.ts` (la prueba de prioridad declara ahora su gobernante) y
  `phase2.test.ts` (catálogo de cuatro ordenanzas).
- `packages/simulation/src/tick-conservation.test.ts` (regeneración de los diez digestos con neutralización
  documentada).
- Acta `docs/execution/phase-4/wp4-11-municipal-politics-2026-10-24.md`.
