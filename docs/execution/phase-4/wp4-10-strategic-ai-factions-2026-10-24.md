# WP4.10 — IA estratégica y facciones — 2026-10-24

## Estado

`DONE`. Dos perfiles de facción con objetivos, recursos, umbrales y puja propios; relaciones que sólo se
forman por encuentros que ocurren en el mundo (sabotaje, desbanco en subasta, licitación competida y roce
territorial); memoria de acciones acotada por tamaño y por ventana; y una escalada antirrepetición que
**corta** el bucle en lugar de medirlo. La campaña headless es la que lo demostró: el primer diseño sólo
penalizaba y el rival acumuló 101 acciones fallidas en doce meses dando golpes contra la misma parcela; con
la supresión al tercer rechazo la misma campaña cierra con 12 fallidas y 190 ciclos cortados. Decisión en
`docs/engineering/adr/D-073-ia-estrategica-y-facciones.md`.

## Resultado

- **Dos perfiles, no ocho**: `conservative` y `expansionist` en `FACTION_PROFILES`. El conservador reproduce
  exactamente los cuatro números que el rival usaba antes (reserva 30 %, mantenimiento 55, seguro 35, puja
  92 %), así que cambiar de perfil es la única forma de mover la conducta y la comparación es medible.
- **Objetivos como ocho familias** (`acquire`, `develop`, `produce`, `protect`, `finance`, `compete`,
  `political`, `dispose`) sumadas a la utilidad de cada acción. `FACTION_ACTION_FAMILY` cubre las catorce
  acciones del repertorio y una prueba recorre el roster vivo de las campañas para que ninguna se quede sin
  familia.
- **Postura por par ordenado**, topada en ±100, creada sólo por cuatro encuentros reales: `sabotage` −12,
  `auction_outbid` −6, `tender_contested` −2, `territory` −1 por frontera con tope mensual de −4. Decae 3
  puntos al mes hacia cero, se detiene ahí y se **borra** del estado al llegar.
- **Los encuentros los anotan los actores** en el sitio donde ocurren: `commands.ts` (sabotaje, en la
  víctima), `settleAuctions` (desbancados y vendedor agraviado) y `public-contracts.ts` (competidores de la
  licitación). Ninguno calcula utilidad.
- **Roce territorial con la trama real**: las parcelas se plantan a `spacing 2` porque los impares son la
  calzada, así que la regla mira a una **y a dos** celdas en fila y columna. Con sólo la celda contigua la
  presión nunca disparaba en un distrito generado.
- **Memoria de acciones**: 12 entradas por organización, ventana de tres meses, con `action`, `target`,
  `accepted` y `rejectionCode`, identificadores `faction_00000001…`.
- **Antirrepetición en dos escalones**: dos rechazos sobre la misma clave cuestan −60 de utilidad (sigue
  siendo elegible si el contexto mejora) y al tercero la acción sale del menú hasta que la ventana la
  olvide. Sólo cuentan los rechazos: repetir con éxito es trabajo.
- **Detección de ciclos contada**: cuando la memoria desbanca a lo que la utilidad sola habría elegido —o
  deja al rival sin opciones— sube `cycleCountByOrganizationId`.
- **Información parcial con una sola fórmula**: `publicBidPercentFor` modula la puja por la hostilidad
  recordada (suelo 50 %, techo 100 %) y `information.ts` pregunta ahí la puja que estima, en vez de
  duplicar la política.
- **Cota de información ejecutada**: siete observables `private` del jugador alterados masivamente no cambian
  la decisión del rival, y la proyección serializada no contiene `expansionist` ni `stanceByPairId`.
- **Empleo, demanda, presupuesto y reputación entran por el mundo**: el rival ocupa porque hay hogares con
  capacidad de alquiler (WP4.3/4.4), puja porque el municipio licita (WP4.5/4.7) y el banco le acepta el
  préstamo según su reputación (WP4.8). Ninguna arista nueva dentro de `rivalAction`.
- **Sin planificador**: no existe secuencia que la utilidad aislada no resuelva; las dos cadenas reales ya
  son seguimiento inmediato tras el `dispatch`.
- `phase2.factions` es opcional y `factions` cierra el mes entre `municipal` e `intelligence`.

## Evidencia

### Evidence

- `packages/simulation/src/factions.ts`: `FACTION_PROFILES`, `FACTION_ACTION_FAMILY`, `FACTION_POLICY`,
  `initialFactionState`, `factionProfileIdOf`/`factionProfileOf`/`setFactionProfile`, `stanceFor`,
  `recordFactionEncounter`, `worstStanceAgainstCompanies`, `publicBidPercentFor`, `rememberFactionAction`,
  `repetitionPenaltyFor`, `isActionCycleSuppressed`, `noteCycleSuppressed`, `runFactions`,
  `describeFactions`.
- `packages/simulation/src/factions.test.ts`: 21 pruebas en cuatro bloques (perfiles, encuentros y postura,
  persistencia y cota de información, campañas headless).
- `packages/shared/src/domain.ts` (`FactionProfileId`, `FactionGoalFamily`, `FactionEncounterKind`,
  `FactionMemoryEntry`, `FactionState` y sus esquemas) y `snapshot.ts` (esquema y tipo escrito a mano de
  `SnapshotV1`).
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts` (capa de decisión de `rivalAction`,
  encuentros en `settleAuctions`, sistema `factions` en `PRODUCT_SYSTEMS`), `commands.ts`,
  `public-contracts.ts`, `information.ts`, `game-data.ts` (`RIVAL_AI_POLICY` reducido a `salePricePercent`).
- `packages/simulation/src/tick-conservation.test.ts`: regeneración justificada de un solo digesto.

### Finding

**La campaña derribó el primer diseño.** Con sólo penalización (−60 y −120), el rival expansionista de la
seed 4 a doce meses cerraba con **101 acciones fallidas** y las doce entradas de su memoria eran la misma
`start_construction:parcel_00000021:INSUFFICIENT_FUNDS`: una utilidad de 80 − 120 seguía siendo la mejor
opción cuando todo lo demás del menú también estaba bloqueado por la caja. Tras la escalada a supresión, la
misma campaña cierra con **12 fallidas**, **190 ciclos cortados** y una memoria que alterna rechazos con
`buy_parcel`, `sell_parcel` y `bid_public_contract` aceptados. La cartera no se empobrece: 13 solares y 2
edificios en ambos casos, 228 transacciones.

**El roce territorial estaba muerto por la trama.** En la ciudad de 50 parcelas (seed 7, 12 incidentes) a dos
meses, la versión con vecindad a una celda dejaba `stanceByPairId` vacío. Con la vecindad a una o dos celdas,
las dos promotoras cierran el mes en **−4 mutuo** —el tope mensual— sobre 33 solares del rival y 32 del
jugador, y `cyclesSuppressed` llega a 24. El motivo es estructural: `spacingX = spacingY = 2` en los tres
perfiles de distrito porque las celdas impares son la calzada.

**Dos perfiles, dos empresas distintas.** Seed 4, dos meses: la conservadora termina con 1 solar y 1 edificio
y 3 178 u. de caja tras 20 intentos fallidos; la expansionista con 2 solares y 2 edificios, 2 053 u. —menos
caja, más cartera— y cero fallos. La caja de la jugadora no se mueve en ninguno de los dos casos (12 000 u.).

**Los encuentros se forman donde ocurren.** Un sabotaje del jugador deja −12 en la víctima y 0 en el
agresor; una puja en una licitación con dos competidores registrados deja −2 por competidor; compartir
manzana deja −1 en las dos direcciones y se topa en −4 con diez fronteras. Fuera del cierre mensual la
postura no se mueve ni un punto, y tras cuatro meses la hostilidad llega a cero y desaparece del estado con
`lastDecayTick = 4 × 36 000`.

**La cota de información es ejecutable, no declarada.** Alterando caja, inventario, deuda viva, impuestos,
búsqueda de los hogares, fondos reservados en subasta y reputación bancaria del jugador, la decisión del
rival en el día siguiente sale idéntica en los siete casos. Y la proyección serializada no contiene la
palabra `expansionist` ni la clave `stanceByPairId`, aunque `describeFactions` devuelva perfil, puja,
reserva, peor postura y entradas recordadas para el motor.

**Un solo digesto se mueve y está justificado.** `scenario:seed-1:36000` pasa de `6a05240180ec5c23` (WP4.9) a
`ce55085a1cfdc871`; los otros nueve casos son idénticos. Neutralizando la escalada antirrepetición y la
presión territorial, ese digesto **recupera exactamente `6a05240180ec5c23`**, así que el delta procede sólo de
los dos canales pretendidos. En ese escenario el rival pasa de 2 a 3 solares, de 9 a 3 acciones fallidas y de
21 a 26 transacciones, su caja termina en 2 815 en vez de 3 066 y el banco baja de 100 000 a 99 400: deja de
golpear la parcela que no puede pagar y pide financiación. La caja de la jugadora (12 000 u.) no se mueve.

### Path

`FACTION_PROFILES (conservative/expansionist) -> factionProfileOf -> umbrales de reserva, mantenimiento y
seguro -> candidatos de rivalAction -> + goalBiasByFamily[FACTION_ACTION_FAMILY[accion]] -> utilidad base
-> + repetitionPenaltyFor (2 rechazos = −60) -> filtro isActionCycleSuppressed (3 rechazos = fuera del menú
hasta que la ventana de 3 meses la olvide) -> selected; si desbanca al máximo de utilidad ->
noteCycleSuppressed -> dispatchProductCommand -> rememberFactionAction(action, target, accepted,
rejectionCode) -> (mensual, tras municipal y antes de intelligence) runFactions: decaimiento de posturas,
presión territorial mutua topada a −4, recorte de memoria por ventana, lastDecayTick -> worstStanceAgainstCompanies
-> publicBidPercentFor (50…100 %) -> puja real en la licitación y estimación en information.ts`

`encuentros: CommitCrime (commands.ts) -> víctima −12 · settleAuctions (systems.ts) -> desbancado −6 y
vendedor −6 · submitPublicBid (public-contracts.ts) -> competidores −2 · parcelas a 1–2 celdas (runFactions)
-> ambos −1 por frontera, tope −4/mes`

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm check:architecture
pnpm exec eslint packages apps scripts
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, **179** en simulation (5 opt-in omitidos) y 17 en web. Las veintiuna
  pruebas nuevas de WP4.10 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios — ocho ticks no cruzan un cierre mensual, así que
  ni posturas ni memoria se desarrollan en ese recorrido.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Digestos dorados: **uno regenerado**, `scenario:seed-1:36000` → `ce55085a1cfdc871`, con la neutralización
  documentada arriba. La determinancia de `factions` se prueba comparando el snapshot completo y repetimiento
  de campaña con la misma semilla y perfil, porque `canonicalizeState` sigue sin serializar el agregado.

## Deuda detectada no corregida en este WP

- **`canonicalizeState` sigue ciego a los agregados** de WP4.3–WP4.10 (`employment`, `municipal`,
  `housingMarket`, `contracts`, `reputation`, `intelligence`, `factions`). Se prolonga la decisión de D-071:
  ampliarlo reescribiría los diez digestos por un motivo ajeno al WP.
- **El planificador no está y sigue sin hacer falta hoy.** El disparo para abrirlo: cualquier decisión que
  necesite dos pasos separados por más de un tick para ser rentable (reservar caja para una subasta futura,
  por ejemplo). WP4.11 y WP4.12 pueden crearlo.
- **La postura es un escalar por par.** No distingue "me ganó una subasta" de "me sabotió", y
  `worstStanceAgainstCompanies` reduce el historial a un número. Suficiente para modular la puja; insuficiente
  si WP4.11 quiere campañas contra una facción concreta.
- **El encuentro `sabotage` sólo lo puede provocar la jugadora**, porque `CommitCrime` es su único llamada.
  Cuando la IA tenga capacidades criminales propias, el mismo registro se aplicará sin cambios.
- **Sin expediente de inteligencia para la IA.** D-072 prometió que las facciones lo tendrían como entrada;
  lo que se ha cerrado es la cota medible (los siete observables privados no mueven la decisión) y la fórmula
  compartida de la puja. Darle al rival un presupuesto de investigación es tuning sin herramienta de balance.
- **`RIVAL_AI_POLICY` se queda con un solo campo** (`salePricePercent`) y un nombre que ya no describe nada de
  lo que contiene: es la regla de liquidación de mercado de cualquier vendedor. Debe renombrarse con la
  pasada de limpieza de datos de Fase 4.
- **Grados de libertad sin barrido**: dos perfiles con seis cifras cada uno, decaimiento 3/mes, ventana de
  tres meses, 12 entradas de memoria, −60 a los dos rechazos, supresión al tercero, topes de encuentro y −4
  territorial. Elegidos a mano; la campaña headless ya mide el efecto, pero no hay búsqueda de parámetros.
- **La supresión puede dejar al rival inactivo hasta tres meses** en una ciudad donde todo el menú está
  bloqueado por la caja. Es el comportamiento diseñado (esperar a que el mundo cambie) pero hoy no hay ninguna
  otra arista que considere vender o endeudarse de forma explícita en esa situación.
- **No hay ninguna exposición en interfaz** de perfiles, posturas ni memoria, por decisión. Si la Fase 4
  quiere que la jugadora "lea" al rival, deberá ser a través de la conducta y de la cota de información de
  WP4.9, no de un panel.
- `apps/web/src/App.tsx` sigue leyendo la categoría `services` obsoleta en la línea municipal desde WP4.6.
- `pnpm format:check` sigue fallando por cuatro ficheros ya commiteados antes de este WP; `pnpm lint` sigue
  fallando en local por `blender_artist/toolchain/`.

## Fuera de alcance

No se implementan instituciones electorales, candidatos, partidos ficticios ni aprobación popular (WP4.11),
ni shocks macroeconómicos condicionados (WP4.12), ni automatización y delegación con gameplay LOD (WP4.13),
ni planificador de secuencias, ni facción criminal jugable con su propio repertorio, ni balance por barrido
de perfiles. La instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
