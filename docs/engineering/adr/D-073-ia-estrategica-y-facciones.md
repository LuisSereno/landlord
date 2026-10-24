# D-073 — IA estratégica: perfiles de facción, postura por encuentro y memoria antirrepetición

Estado: **Aceptada**
Fecha: 2026-10-24

## Contexto

WP4.10 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide introducir perfiles de facción con
objetivos, recursos, relaciones y memoria; añadir planificador sólo para secuencias que la utilidad
aislada no resuelva; hacer que las facciones interactúen entre sí; incorporar empleo, demanda,
presupuesto, reputación e información parcial; añadir detección de ciclos y antirrepetición; y ejecutar
campañas headless que comparen estrategias y detecten invariantes rotos.

Hasta aquí el rival era una sola lista de puntuaciones fijas leída por una sola política (`RIVAL_AI_POLICY`
en `game-data.ts`): reserva del 30 %, umbral de mantenimiento 55, riesgo de seguro 35 y puja del 92 % del
presupuesto. No había relaciones —dos empresas que se disputaran el mismo solar durante un año terminaban
idénticas a dos que nunca se cruzaron—, ni memoria: la única que existía (`rivalAi.memory`) guardaba tres
contadores agregados, no acciones. Y como `rivalAction` elegía siempre el máximo de una lista determinista
de puntuaciones, cuando la acción ganadora era rechazada por el motor la IA volvía a elegirla al día
siguiente, y al siguiente, hasta que el mundo cambiaba por sí solo. Esa repetición ya era observable en
`rivalAi.memory.lossCount`.

WP4.9 dejó una deuda explícita: el registro de accesos no filtraba nada y el rival seguía leyendo el mundo
completo. Este WP cierra la parte que puede cerrarse sin montar el multirol.

## Decisión

1. **Dos perfiles, no ocho.** Sólo la promotora rival tiene una IA que los consuma. `FACTION_PROFILES`
   define `conservative` y `expansionist`, y el conservador reproduce **exactamente** los cuatro números
   históricos (30 / 55 / 35 / 92 %), así que cambiar de perfil es la única forma de mover el comportamiento
   y eso hace medible la campaña headless. Un catálogo de ocho facciones sin IA que las leyera sería
   decoración.
2. **El perfil es una tabla de preferencias, no un guion.** Contiene seis grados de libertad, todos con un
   efecto ya existente en el motor: `goalBiasByFamily` (ocho familias de objetivo sumadas a la utilidad),
   `minimumReservePercent`, `maintenanceConditionThreshold`, `insuranceRiskThreshold`,
   `contractBidPercent` y `stanceSwingPerHostility`. Ninguno introduce una acción nueva ni un sistema nuevo.
3. **Ocho familias de objetivo cubren el repertorio.** `acquire`, `develop`, `produce`, `protect`,
   `finance`, `compete`, `political`, `dispose`. `FACTION_ACTION_FAMILY` asigna cada una de las catorce
   acciones rivales a una familia, y una prueba recorre el roster vivo de las campañas para exigir que
   ninguna acción se quede sin familia: el sesgo del perfil no puede volverse decorativo por omisión.
4. **Las relaciones se forman por encuentro, no por decreto.** La postura es un número por par ordenado
   `observador>subjecto`, topado en ±100, y sólo se crea por cuatro causas que de verdad ocurren en el
   mundo: `sabotage` (−12), `auction_outbid` (−6), `tender_contested` (−2) y `territory` (−1 por frontera
   compartida, topado en −4 al mes). Nadie cambia de opinión porque sí.
5. **El registro lo hace el actor, en el sitio donde ocurre la interacción.** `commands.ts` anota el
   sabotaje en la víctima, `settleAuctions` anota el agravio al pujador desbancado y al vendedor que perdió
   el suelo, `public-contracts.ts` anota el roce a cada competidor de la licitación. Ninguno de los tres
   calcula una utilidad: sólo declaran que dos empresas se tocaron.
6. **El roce es mutuo y la hostilidad no se convierte en amistad.** La presión territorial se aplica en las
   dos direcciones; el decaimiento mensual (3 puntos) se detiene en cero y nunca cruza al signo opuesto.
   Una postura que llega a cero se **borra** del estado, para que una partida de diez años no acumule pares
   sin relación.
7. **Memoria de acciones, no de estadísticas.** Cada intento del rival deja una entrada con `action`,
   `target`, `accepted` y `rejectionCode`, acotada a 12 por organización y a una ventana de tres meses, con
   identificadores `faction_00000001…`. La ventana es lo que impide que un historial antiguo congele la IA
   para siempre: el mundo cambia y la acción vuelve a poder intentarse.
8. **Antirrepetición en dos escalones, medidos antes de decidirlos.** Dos rechazos sobre el mismo
   `(acción, destino)` cuestan −60 de utilidad —la acción sigue siendo elegible si el contexto mejora— y al
   tercero sale del menú hasta que la ventana la olvide. El primer diseño sólo penalizaba (−60 y −120) y se
   midió en campaña: el expansionista de la seed 4 acumuló **101 acciones fallidas en doce meses**, doce
   entradas consecutivas de `start_construction:parcel_00000021:INSUFFICIENT_FUNDS`, porque una utilidad de
   80 − 120 sigue siendo la mejor cuando todo lo demás también está bloqueado por la caja. Con la escalada a
   supresión, la misma campaña cierra con **12 fallidas** y 190 ciclos cortados. Sólo cuentan los rechazos:
   repetir con éxito es trabajo, no un bucle, y cinco `buy_materials` seguidos no deben vetar la compra de
   materiales.
9. **La presión territorial usa la trama real.** Las parcelas se plantan con `spacingX = spacingY = 2` porque
   los impares son la calzada, así que "compartir manzana" es estar a **una o dos** celdas en la misma fila o
   columna. Con la vecindad a distancia 1 la regla no disparaba nunca —en una ciudad de 50 parcelas el mapa
   de posturas quedaba vacío tras dos meses—; con la distancia 2 incluida, esas dos promotoras cierran el mes
   a −4 mutuo, el tope mensual.
10. **Detección de ciclos visible sin leer el log.** Cuando la memoria desbanca al candidato que la utilidad
    sola habría elegido —incluido el caso en que se queda sin opciones y el rival pasa a reservar liquidez— se
    incrementa `cycleCountByOrganizationId`. En la ciudad de 50 parcelas a dos meses el contador llega a 24.
11. **Sin planificador.** La regla del WP era añadirlo sólo para secuencias que la utilidad aislada no
    resolviera. No existen: las dos cadenas reales (oferta de préstamo → aceptación, obra iniciada → cuadro
    asignado) ya se resuelven como seguimiento inmediato tras el `dispatch`, y ninguna depende de un orden
    futuro. Un planificador sin secuencia que planificar habría añadido el coste de estado y de tests sin
    cerrar ninguna brecha. El disparo para revisitarlo está escrito en el acta: en cuanto una decisión
    necesite dos pasos separados por más de un tick para ser rentable.
12. **La información parcial sustituye a la omnisciencia donde se puede medir.** `publicBidPercentFor` fija
    la puja de la licitación a partir de la hostilidad que la empresa *recuerda*, modulada por su perfil, con
    suelo del 50 % (por debajo no cubre el coste de ejecutar) y techo del 100 % (por encima la oferta
    superaría el presupuesto anunciado y el motor la rechazaría). La estimación de WP4.9 pasa a preguntar la
    puja al mismo sitio que la IA real, así que no hay dos fórmulas para la misma cifra.
13. **El rival deja de decidir mirando lo privado del jugador.** Siete observables registrados como `private`
    en `INFORMATION_POLICY.scopeByObservable` —caja, inventario, deuda viva, impuestos adeudados, búsqueda de
    los hogares, fondos reservados en subasta y reputación ante la banca— se alteran masivamente antes del
    turno del rival y su decisión sale idéntica. Es la prueba, no un filtro: el registro sigue siendo un
    contrato y una regla nueva puede seguir leyendo lo que no debe.
14. **Perfil y postura no salen hacia la jugadora.** `phase2.factions` no se proyecta; `describeFactions`
    existe para el motor y para las pruebas. La serialización de la proyección no contiene la palabra
    `expansionist` ni la clave `stanceByPairId`.
15. **Empleo, demanda, presupuesto y reputación entran por el mundo, no por una arista nueva.** El rival
    ocupa unidades porque existen hogares con capacidad de alquiler (WP4.4/4.3), puja porque el municipio saca
    licitaciones con presupuesto (WP4.5/4.7) y le aceptan o rechazan el préstamo según su reputación bancaria
    (WP4.8). Conectar esas cifras con una línea directa dentro de `rivalAction` habría duplicado el modelo con
    un retraso propio.
16. **Persistencia aditiva y orden de systems.** `phase2.factions` es opcional en el snapshot: una partida
    anterior se restaura con el estado vacío. `factions` se coloca después de `municipal` y antes de
    `intelligence`, porque el roce territorial necesita el mapa ya cerrado del mes y la inteligencia debe
    re-basar sobre posturas ya decaídas (D-060 fija que el orden es parte de la determinancia).

## Alternativas consideradas

- **Un árbol de comportamiento por facción.** Descartada: el repertorio rival ya se elige por utilidad y un
  árbol duplicaría la lógica de elegibilidad que poseen los comandos. La IA fallaría en dos sitios.
- **Un planificador de dos o tres pasos.** Descartada hoy: no hay ninguna secuencia en el juego que exija
  reservar una acción para más adelante. Se reabre con el disparo escrito en el acta de WP4.10.
- **Ocho perfiles con nombres de facción.** Descartada: siete no tendrían lector. Un catálogo se justifica
  cuando hay más de una IA activa, y eso llega con WP4.11 (candidatos) o con la perspectiva criminal.
- **Que la postura suba con el tiempo hasta volverse favorable.** Descartada: ningún hecho registrado mejora
  la relación, así que una ascensión hacia cero ya es generosa; cruzar al signo opuesto inventaría amistad
  donde sólo hubo ausencia de roce.
- **Sólo penalizar, sin vetar nunca.** Descartada **después de medirla**: era el diseño inicial (−60 y −120)
  y la campaña de doce meses lo rechazó —101 acciones fallidas porque una utilidad penalizada seguía siendo
  la mejor cuando el resto del menú también estaba bloqueado por la caja—.
- **Un veto permanente sobre la acción rechazada.** Descartada: sin ventana temporal, un rechazo transitorio
  (subasta ya ganada, tesorería insuficiente este mes) se volvería amnesia para siempre. La supresión adoptada
  caduca con la ventana de tres meses, así que es una pausa, no un borrado.
- **Castigar la repetición sin mirar si tuvo éxito.** Descartada: las tres primeras versiones contaban
  intentos, no rechazos, y habrían vetado `assign_tenant` o `buy_materials` por repetir trabajo legítimo.
- **Memoria ilimitada o por entidad completa.** Descartada: sin cota, una partida larga acumularía entradas
  por parcelas que ya no existen, y la serialización crecería sin límite.
- **Exponer perfiles y posturas en la proyección.** Descartada: serían una barra decorativa del mismo tipo que
  ya se rechazó en D-071 y D-072. El jugador puede inferir el perfil observando conducta —que es el diseño—
  y la evidencia dura queda en las pruebas y en las campañas headless.
- **Dar al rival un expediente de inteligencia propio (`CommissionIntelligence` como IA).** Descartada dentro
  de este WP: exigiría decidir qué cifra compra, con qué presupuesto y con qué frecuencia, que es tuning de
  balance sin herramienta. La cota medible ya se impuso con la batería de invariancia; el expediente rival
  corresponde a la pasada de balance de Fase 4.
- **Ampliar `canonicalizeState` a `factions` y regenerar los diez digestos.** Descartada, como en D-071 y
  D-072: reescribiría la línea base por un motivo ajeno al cambio.

## Alcance

Incluido:

- `packages/simulation/src/factions.ts`: `FACTION_PROFILES`, `FACTION_ACTION_FAMILY`, `FACTION_POLICY`,
  `initialFactionState`, `factionProfileIdOf`/`factionProfileOf`/`setFactionProfile`, `stanceFor`,
  `recordFactionEncounter`, `worstStanceAgainstCompanies`, `publicBidPercentFor`,
  `rememberFactionAction`, `repetitionPenaltyFor`, `noteCycleSuppressed`, `runFactions`, `describeFactions`;
- `FactionProfileId`, `FactionGoalFamily`, `FactionEncounterKind`, `FactionMemoryEntry` y `FactionState` con
  su esquema en `packages/shared/src/domain.ts`, y `phase2.factions` opcional en `snapshot.ts` tanto en el
  esquema como en el tipo escrito a mano de `SnapshotV1`;
- anotación de encuentros en `commands.ts` (sabotaje), `systems.ts` (subastas) y `public-contracts.ts`
  (licitaciones); capa de decisión por perfil + memoria en `rivalAction`; sistema `factions` en
  `PRODUCT_SYSTEMS`;
- la puja de `information.ts` delegada en `publicBidPercentFor`, para que la estimación y la oferta real
  compartan fórmula;
- `RIVAL_AI_POLICY` reducido a `salePricePercent`, que es una regla de liquidación de mercado y no una
  preferencia de facción;
- veinte pruebas en `packages/simulation/src/factions.test.ts`, incluidas cuatro campañas headless.

No incluido:

- planificador de secuencias;
- expediente de inteligencia para la IA rival;
- más facciones jugables, partidos o candidatos (WP4.11);
- exposición de relaciones en la interfaz;
- acciones rivales nuevas ni repertorio criminal propio de la IA;
- herramienta de balance para barrer los doce grados de libertad del perfil.

## Consecuencias

### Positivas

- Por primera vez dos partidas con la misma semilla pueden tener rivales **diferentes por política**, y la
  diferencia es medible: en la campaña de seed 4 a dos meses, el expansionista termina con menos caja y otra
  cartera de solares y edificios que el conservador.
- El bucle que repetía una acción rechazada desaparece sin añadir vetos: se sustituye por una penalización
  que decae con la ventana temporal, y su efecto queda contabilizado en `cyclesSuppressed`.
- La economía apenas se mueve: nueve de los diez digestos dorados son idénticos y el único que cambia
  (`scenario:seed-1:36000`) lo hace por el mecanismo pretendido, no por un canal accidental.
- Las relaciones son consecuencia de hechos jugables —sabotear, desbancar, competir, ocupar suelo vecino—, así
  que el WP4.11 (opinión y elecciones) y el futuro rol criminal tienen dónde apoyarse sin reabrir el modelo.
- La deuda de WP4.9 queda cubierta donde es verificable: siete observables privados del jugador ya no cambian
  la decisión del rival, y la proyección no filtra perfiles ni posturas.
- Un perfil nuevo se añade como dato, no como condicional, cumpliendo la regla de arquitectura de preferir
  configuración sobre código.

### Costes

- Sólo hay una IA que lea los perfiles. El catálogo existe para que una segunda facción no obligue a tocar el
  modelo, pero hoy esa segunda facción no está y el coste es teórica tracción frente a dos filas reales.
- El decaimiento y el roce territorial dependen del cierre mensual, así que una partida de menos de un mes no
  desarrolla relaciones: es correcto pero significa que el WP no se observa en el smoke de navegador
  (`CAJA 5228 u.` sin cambios, ocho ticks).
- La postura es un único número por par, sin dimensiones. "Esta empresa me ganó una subasta pero no me ha
  sabotiado" se pierde; se simplifica en la peor postura contra cualquier empresa (`worstStanceAgainstCompanies`).
- La antirrepetición trabaja sobre `(acción, destino)`, no sobre `(acción, intención)`: un rival puede oscilar
  entre dos parcelas caras sin repetir la misma clave y seguir sin avanzar.
- El roce territorial depende de la trama: dos parcelas a más de dos celdas en fila o columna no se tocan, así
  que en un mapa muy disperso la presión puede no aparecer nunca aunque ambas empresas sean vecinas de distrito.
- El rival sigue leyendo la estructura del mundo (mapa, subastas, contratos) sin coste. La batería de
  invariancia protege los observables registrados, no la topología del mapa.
- Doce cifras de perfil y seis de política (`stanceDecayPerMonth`, ventana de tres meses, 12 entradas, −60 a
  los dos rechazos, supresión al tercero, topes de encuentro y −4 territorial) están elegidas a mano, sin
  barrido.

## Evidencia requerida

- `packages/simulation/src/factions.ts` y `factions.test.ts`.
- `packages/shared/src/domain.ts` (`FactionState` y sus tipos), `snapshot.ts` (esquema y tipo `SnapshotV1`).
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts`, `commands.ts`, `public-contracts.ts`,
  `information.ts`, `game-data.ts`.
- `packages/simulation/src/tick-conservation.test.ts` (regeneración justificada de un solo digesto).
- Acta `docs/execution/phase-4/wp4-10-strategic-ai-factions-2026-10-24.md`.
