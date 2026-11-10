# D-104 — Sección transversal autoritativa: aceras, carriles y sentidos dejan de ser presentación

- **Estado:** alcance decidido por el responsable el 2026-11-09 (topología autoritativa **ahora**,
  ampliación de la proyección y **autovía de 7**), registrado en las tareas V.l.1–V.l.8. Esta ADR es el
  documento que faltaba: no existía spec de V.l en el repo. Implementación en curso, **sin cierre**;
  la aprobación visual final es humana (V.l.8).
- **Workstream:** WP4.15-V.l, sobre `wip/vh-world-visual-foundation` (encima de V.k, ya publicado).
- **Enmienda:** D-085 §2 y D-090 §2. No sustituye ninguna de las dos: mantiene su arquitectura y levanta
  una prohibición concreta.

## Contexto medido

Hoy la calzada es **sólo el eje**. `RoadSegment { id, from, to, class }`
(`packages/shared/src/domain.ts:214`) con `class ∈ {street, avenue}` (`domain.ts:210`), y
`roadCellsFromSegments()` (`domain.ts:259`) deriva una celda por paso del segmento. `RoadTopology`
lleva `topologyVersion: 1` y `derivationVersion: 2` (`domain.ts:225`), y la red se produce desde
`RoadAnchor[]` en `deriveRoadNetwork()` (`packages/simulation/src/urban-fabric.ts:253`).

Lo que el jugador ve como acera, bordillo, cebra o carril es **presentación**: el adapter deriva
máscaras N/E/S/W y `GroundRoadMarking` desde `projection.map.roads.cells`
(`apps/web/src/isometric/gameplay-visual-adapter.ts`), y `visual-slice/terrain-paint.ts` pinta aceras y
bordillos alrededor de esa celda única. El desplazamiento lateral de vehículos y actores ambientales
sale de una moneda `spatialHash(coordenada, salt)`, no de un carril con sentido. Consecuencia del
playtest de V.d: no hay dos carriles legibles, el peatón no tiene una acera propia donde anclarse y la
«avenida» se distingue de la calle sólo por semántica interna.

Números de la retícula actual, medidos sobre `axisPositions()` (`urban-fabric.ts:142`) con mapa 64×64:

| `latticeLines` | posiciones por eje | avenida (índice medio) |
| --- | --- | --- |
| 3 | 0, 32, 63 | 32 |
| 4 | 0, 21, 42, 63 | 42 |

Con 3 líneas en ambos ejes el eje ocupa **375 celdas** (9,2 % del mapa); D-085 midió 451 celdas
(11,0 %) incluyendo los conectores de ancla. Un corredor de **7** celdas sobre una sola línea consume
**448 celdas (10,9 %)** por sí solo, y sobre las tres líneas de un eje **1.344 (32,8 %)**. Es decir: la
autovía de 7 no puede aplicarse a toda la retícula sin comerse un tercio del distrito por eje.

## Qué se enmienda y qué se mantiene

**Se levanta** la prohibición de D-085 §2 —«sin carriles, sentidos, nombres, anchos variables ni
tráfico»— **sólo en lo que toca a la sección transversal**: ancho, roles de celda (calzada / mediana /
acera) y sentido de carril pasan a dato autoritativo derivado, publicado y persistible.

**Se mantiene en pie**, y es la razón de que esto sea una enmienda parcial y no una sustitución:

1. **El eje sigue siendo la verdad de red.** `RoadSegment` y `roadSegmentId()` no cambian; los
   segmentos siguen siendo ortogonales, canónicos y derivados de `RoadAnchor[]`, nunca de parcelas ya
   colocadas (D-090 §1/§2). El corredor se deriva *del* segmento, no al revés.
2. **Una sola función deriva las celdas del eje**: `roadCellsFromSegments()` sigue siendo la única
   puerta, y `map.roads.cells` de la proyección sigue publicando el eje, no el corredor expandido.
3. **Las cuatro semánticas de D-085 §1** (obstacle / road / parcel / open) no se tocan. El corredor es
   suelo **no edificable** de tipo road: **nunca entra en `blockedCells`**, porque ese conjunto es el
   muro del A\* y convertirlo en calzada haría intransitable la ciudad (el error que D-085 §1 corrigió).
4. **Nada de tráfico simulado, nombres de calle ni reglas de producto nuevas.** El coste
   `road < open terrain` y `hasRoadAccess` como regla real siguen diferidos (V.c.2D).
5. **El render no decide geometría.** Los roles y el sentido llegan por la frontera de proyección;
   `apps/web` no importa simulación (guard de arquitectura).

## Decisión

1. **Tabla de perfiles** en `packages/shared/src/road-cross-section.ts` (módulo nuevo, puro, sin
   dependencias de Phaser/React/DOM): `RoadProfile` y `ROAD_PROFILES` con `street` = 3 celdas,
   `avenue` = 5 con mediana central, `motorway` = 7. Cada perfil declara el ancho total, la secuencia
   de roles desde el borde izquierdo y qué lado de la calzada lleva cada sentido.
2. **Derivación determinista del corredor**: `roadCorridorCellsFromSegments()` y
   `roadCellRolesFromSegments()` con precedencia explícita cuando dos trazados se pisan (la clase mayor
   domina, igual que `roadCellClassesFromSegments()` hace hoy con `avenue`), recorte a `[0,64)` y
   orden canónico. Sin PRNG nuevo y sin `state.prng`.
3. **Canal nuevo de proyección, no expansión del viejo**: `map.roadSection` con esquema `.strict()`
   `{ revision, digest, profiles[], segments[] }`, mientras `map.roads` sigue siendo el eje. Así el
   contrato existente no cambia de forma y los digestos de `map.roads` siguen siendo comparables
   byte a byte hasta que V.l.4 toque la geometría.
4. **`derivationVersion: 3`** para la geometría con corredor y autovía en retícula
   (`roadCellClassSchema` gana la clase nueva). Lectura `z.union([literal(2), literal(3)])`, escritura
   3, y el corredor se gatea por versión: un save v2 debe reproducir su vía de 1 celda **bit a bit**,
   porque `restoreStateFromSnapshot` lee del save y no re-deriva (precedente de D-085 §7, ya
   implementado en `packages/simulation/src/snapshot.ts:439`).
5. **Presentación por rol**: `planGameplayGround` pinta carriageway / median / sidewalk y suprime el
   apron duplicado; la línea central discontinua va en `terrain-paint` antes de
   `strokeSidewalks`/`strokeCurbs`; el lateral de vehículos y actores sale de
   `lateralOffsetForProfile` + `laneSense` en vez de la moneda `spatialHash`; los `contextActors`
   peatonales se anclan a la celda `sidewalk`. Sección procedural: **cero tiles nuevos**.
6. **Invariante dura sentido ⇄ bordillo**: en los 3 perfiles × 8 seeds, un carril cuyo sentido apunta
   hacia `+x`/`+y` debe quedar del lado del bordillo que le corresponde según la convención de
   circulación adoptada. Es la prueba de que el sentido no es decorativo.

## Secuencia y STOPs (los WP no son intercambiables)

| WP | Entrega | STOP |
| --- | --- | --- |
| V.l.1 | Esta ADR + D-104 en `DECISIONS.md` + enmiendas marcadas en D-085/D-090 | — |
| V.l.2 | `road-cross-section.ts` + tests; `roadSegmentId` y digestos intactos | — |
| V.l.3 | `map.roadSection` `.strict()` + relleno + re-medición de payload en `road-topology-benchmark` | digestos de `map.roads` byte-idénticos |
| V.l.4 | Corredor como suelo no edificable, `axisPositions`/`latticeLines` para la autovía, costura inter-distrito | **si se pierde un frente vial, revienta `maxBlockDepth`/`maxBlockArea` o p95 > ~20 ms → volver al responsable con avenida-3 de respaldo** |
| V.l.5 | Regeneración de 10 digestos + 12 hashes de fixture en commit **sólo de hashes**, con changelog de causa y control | `parcelCount`/`blockedCellCount` sin cambios; perfiles a ancho 1 recuperan los valores V.d.4 |
| V.l.6 | Lectura 2\|3, escritura 3, tests de save viejo | **si un save v2 no reproduce su vía bit a bit → STOP** |
| V.l.7 | Pintado por rol, sentido ⇄ bordillo, peatón en acera | invariante en 3 perfiles × 8 seeds |
| V.l.8 | Capturas en directorio nuevo + FPS + aprobación humana | `baseline-vj.json` y pixel-qa de V.j **intocables**; `groundRebakes = 1` |

## Consecuencias

- El corredor consume suelo: con autovía de 7 sobre un eje completo son 448 celdas por línea. Por eso
  V.l.4 tiene STOP y respaldo (avenida de 3) en vez de un ajuste silencioso del ancho.
- Los ejes en `x = 0` y `x = 63` (retícula de 3 y de 4 líneas) quedan en el borde: un corredor de 7 se
  sale del mapa y **debe recortarse**, no desplazarse. La costura inter-distrito es un test explícito,
  no una consecuencia esperada.
- La avenida de la retícula de 4 líneas cae en `42`, no en el centro geométrico: es el comportamiento
  actual de `axisPositions` y V.l.4 no lo «corrige» de rebote.
- Cambiar la geometría regenera digestos dorados y hashes de fixture. Se hace en un commit aislado y
  atribuido (V.l.5), nunca mezclado con código, siguiendo D-085 §8.
- El baseline visual de V.j queda congelado: V.l.8 captura en directorio nuevo y la aprobación es del
  responsable.

## V.l.4 · Corredor y autovía por perfil (decisión del responsable, 2026-11-10)

El primer intento aplicó el corredor a los nueve perfiles y **rompió la generación en 24 de 72
distritos** (3 perfiles × 8 seeds: `barrio_del_taller`, `centro_civico`, `lomas_del_umbral`, con
`ZONING_SHORTAGE`, `ZONING_CONCENTRATION` y `PARCEL_TOO_NARROW`). El suelo no edificable pasaba de
~384 celdas por distrito (9,4 %) a ~1.094 (26,7 %), y a ~1.388 (33,9 %) con autovía. STOP declarado y
resuelto por el responsable con **corredor por perfil**, no con una reducción global de anchos.

- `DistrictProfile.roadCorridor` decide si el suelo no edificable es el corredor completo o el eje de
  1 celda. Está activo en los seis perfiles medidos sanos (`barrio_del_umbral`, `vega_del_cauce`,
  `ensanche_ferroviario`, `mercado_del_norte`, `ensanche_ferroviario_oeste`, `patios_del_este`) y
  ausente en los tres que no aguantan. Es por perfil y no por fabric porque `FABRIC_LOW_DENSITY` lo
  comparten `vega_del_cauce` (sano) y `lomas_del_umbral` (roto).
  **V.l.5 recorta esta lista a un solo perfil** por la envolvente de ciudad; ver la sección siguiente.
- **La versión registra la geometría**: con corredor se escribe `derivationVersion: 3`; sin corredor
  se escribe `2` y la geometría —y por tanto los digestos— es exactamente la de antes. No hay un
  tercer estado ni un flag de ancho que haya que persistir aparte. *(V.l.5 matiza la segunda mitad de
  la frase: la geometría sí vuelve exacto, la mesa de fixtures publicada no, por una deuda previa a
  D-104.)*
- `DistrictProfile.motorwayAxis` decide si la línea central es autovía de 7. Vive en el perfil, no en
  el fabric: con autovía en los dos industriales, `ensanche_ferroviario_oeste` falla en el city seed
  80 (`ZONING_SHORTAGE mixed 3 < 4`); el mismo distrito con avenida de 5 y corredor genera **42
  parcelas con 42 frentes en un intento**. La autovía de 7 queda entonces en `patios_del_este`,
  medido 100/100, y el responsable lo ratificó así.
- La proyección publica descriptores de ancho 1 para las redes v2 (`roadAxisProfileForClass`), de modo
  que el render nunca deriva un corredor más ancho que el suelo real del distrito.

**Gate de cierre de V.l.4** (`FABRIC_GATE=1`, 100 seeds × 9 perfiles, evidencia en
`docs/execution/phase-4/vl4-fabric-gate-2026-11-10.json`): **900 distritos, 65.607 parcelas, 0
fallos**. Derivación vial p50 2,71 ms / **p95 5,19 ms** / max 14,38 ms, holgado frente al STOP de
~20 ms. Generación p50 158,5 ms / p95 323,98 ms (presupuesto 500). 784 distritos al primer intento y
máximo 8 (tope 12). Todas las familias dentro de su envelope morfológico; ejemplo
`barrio_del_taller`: densidad 32,9 km/km² en [16,174 … 36,777], intersecciones 320,4 en
[61,04 … 411,99] y área mediana de manzana 193 en [54,76 … 811,06]. La costura inter-distrito queda
cubierta por `packages/simulation/src/road-corridor-seam.test.ts`: 12 pares × 2 city seeds, gateway
vial en los dos lados y aberturas espejo en el borde.

## V.l.5 · El alcance del corredor lo fija la envolvente de ciudad (decisión del responsable, 2026-11-10)

V.l.4 dejó el corredor en seis perfiles y postergó a esta fase la regeneración de la evidencia
canónica. Al regenerarla aparece el muro real: **la envolvente `CITY_PARCEL_COUNT_ENVELOPE`
(700..760) no admite seis corredores**. No es un fallo del generador —900 distritos sanos—, es una
cuestión de cuota de suelo a escala de ciudad, y la ciudad se compone de los nueve perfiles una vez
por slot, así que el coste distrital se suma entero.

**Precio del corredor por perfil** (4 seeds, `Δ = parcelas con corredor − parcelas sin corredor`):

| perfil | Δ medio |
|---|---|
| `mercado_del_norte` | −20,00 |
| `ensanche_ferroviario` | −20,00 |
| `patios_del_este` | −11,75 |
| `vega_del_cauce` | −11,50 |
| `ensanche_ferroviario_oeste` | −8,00 |
| `barrio_del_umbral` | −6,25 |
| `lomas_del_umbral`, `centro_civico`, `barrio_del_taller` | 0,00 |

Sumando los seis, ≈77,5 parcelas por ciudad —un 10,6 %— frente a ~12 de margen por encima del suelo
700. El responsable elige **recortar el alcance del corredor**; `CITY_PARCEL_COUNT_ENVELOPE` no se
toca, porque es la alarma del generador y no un umbral que se adapte al fallo.

**Frontera medida** (las doce city seeds, parcelas por ciudad):

| configuración | rango | seeds fuera de 700..760 |
|---|---|---|
| los seis corredores de V.l.4 | 638–677 | 12/12 |
| los dos comerciales (`mercado` + `ensanche`) | 682–709 | 8 |
| dos perfiles (`barrio` + `ensanche_oeste`) | 695–728 | 3 |
| **sólo `barrio_del_umbral`** (decidido) | **700–731** | **0** |
| ningún corredor (control) | 712–740 | 0 |

Con un perfil la peor ciudad (seed 11) queda clavada en el suelo 700: margen cero. Es una señal para
V.l.6 y para el playtest de V.d, no una holgura.

**Consecuencia que hay que ratificar**: el mundo canónico tiene ahora **un distrito con corredor** y
**cero autovías**. `motorwayAxis` se apaga en `patios_del_este` porque la autovía de 7 sólo se publica
por el camino del corredor —`roadCorridor` es la que escribe la clase en una red v3—, y dejar
`motorwayAxis: true` con el corredor fuera escribiría segmentos `motorway` dentro de una red marcada
`derivationVersion: 2`, que es exactamente el estado inválido que D-104 promete no producir. Medido
además que la autovía en sí no era cara: 7 frente a 5 en `patios_del_este` da −6, −1, +3 y 0 parcelas
por seed (media −1, dentro del ruido). Lo caro es el corredor, no los siete metros; si el responsable
quiere la autovía como contenido canónico, vuelve a ser diseño pendiente, no un interruptor.

**Regeneración** (tres commits, cada uno sólo de valores, con el código ya cerrado):
`district-fixtures.ts` (12 hashes), `city-fixtures.ts` (12 filas; cambian `digest`, `parcelCount` y
`marketableParcelCount`, y quedan iguales `blockCount` 119, `publicParcelCount` 14, `facilityCount`
14, `publicSpaceCount` 7, `municipalBuildingCount` 14, `gatewayCount`/`connectionCount` 12 y los ocho
`blockRoleCounts`) y `tick-conservation.test.ts` (10 digestos).

**Controles medidos**, que son lo que exige la fila de STOP de V.l.5:

- Perfiles a ancho 1 que recuperan V.d.4: `ensanche_ferroviario` es **byte a byte** la fila de
  `401ae93` en las cuatro seeds (`ca0d645f/73/226`, `5090e181/73/227`, `e45dae7e/73/229`,
  `d2540270/71/225`).
- `vega_del_cauce` recupera los tres recuentos de V.d.4 (parcelas y celdas bloqueadas 50/135,
  57/144, 54/140, 52/145, y anclas 4 en las cuatro seeds) pero no el hash (`793bfa88`→`ca952382` y
  tres más). Acotado por medida: con el corredor fuera, las **375/375**
  celdas de eje y sus segmentos dueños coinciden con la fórmula de V.d.4, así que D-104 no escribe
  ese residual. La frase de V.l.4 —"sin corredor la geometría, y por tanto los digestos, es
  exactamente la de antes"— se cumple sobre la geometría y **no** sobre la mesa de fixtures publicada.
- Las doce ciudades con el corredor fuera recuperan exactamente los doce `parcelCount` de la tabla
  publicada antes de V.l (723, 738, 722, 739, 726, 712, 736, 730, 738, 730, 739, 740; `3a32240`, con
  su última regeneración en `68c0056`, es decir anterior a esta fase) y todos los demás recuentos; los
  `digest` no vuelven (seed 1 `c92a0e6bb0f08e48` → `e51bdec8a96a19f2`). El corredor que queda cuesta
  entre −8 y −22 parcelas por ciudad (media 13,25), y es un solo distrito: `CITY_SLOTS` coloca cada
  perfil una vez, así que el slot `barrio_del_umbral` es el único que lo pisa.
- Los diez digestos dorados con **cero** corredores en los nueve perfiles (`3b6faef71ae04463`…)
  tampoco recuperan los valores de V.d-7A.

Las tres firmas convergen: **hay una componente de forma anterior a V.l**, ya registrada como BASELINE
DEBT el 2026-11-03 (`docs/execution/phase-4/ve-integrated-correction-verification-2026-11-03.md`:
`city-seeds`, `district-generation` y `tick-conservation` ya fallaban en `develop` antes de V.l). Su
causa no se atribuye en V.l.5 y pasa a ser el **primer ítem de V.l.6**: esa fase tiene que garantizar
que un save v2 reproduce su vía bit a bit, y un canal de forma sin identificar en el estado canónico
es justo lo que puede romper esa promesa.

**Gate de V.l.5** (`FABRIC_GATE=1`, 100 seeds × 9 perfiles con el recorte en el árbol de trabajo sobre
`8ad1da7`; evidencia en `docs/execution/phase-4/vl5-fabric-gate-2026-11-10.json`): 900 distritos,
**72.124 parcelas** (frente a 65.607 con los seis corredores), 0 fallos. Generación p50 202,12 ms /
**p95 339,23 ms** / max 673,72 ms; el presupuesto de 500 ms que afirma el gate es sobre p95
(`urban-fabric-gate.test.ts:246`), no sobre el máximo. Derivación vial p50 2,38 ms / **p95 5,04 ms** /
max 12,61 ms (STOP ~20). 879 distritos al primer intento, 20 al segundo, 1 al tercero; el tope 12 lo
pone `MAX_COMPOSITION_ATTEMPTS` (`district-generator.ts:74`) y el gate publica el histograma sin
afirmarlo. Las
nueve familias dentro de su envelope morfológico, y la señal de que el recorte es real:
`vega_del_cauce` queda en 23,07 / 137,3 / 450 —idéntico a `lomas_del_umbral`, que comparte
`FABRIC_LOW_DENSITY` y ahora comparte también el eje de 1 celda— mientras `barrio_del_umbral`, el único
que conserva corredor, se separa en área de manzana (169 frente a los 225 de `ensanche_ferroviario` a
la misma densidad 23,6).

**Deuda que este gate no cubre** (medida al leerlo, no corregida aquí): la guarda "ninguna parcela
pisa suelo vial" compara contra `roadCellsFromSegments` —el eje— incluso en distritos con
`derivationVersion: 3`, así que el gate no demuestra que ninguna parcela invada la acera o la mediana
del corredor; lo que sí lo verifica es el `validateUrbanFabric` de la propia composición, que bifurca
por versión. Alinear esa guarda con el corredor es trabajo de V.l.6, y su coste es un `expect` por
parcela.

### El coste del recorte no lo paga la envolvente (medido el 2026-11-10, abierto al responsable)

La suite de simulación entera, con el recorte en el árbol de trabajo, da **11 archivos rojos,
566 passed y 19 skipped sobre 596 tests** (807 s). De esos once, uno es el preexistente que la lista
de V.k ya registraba (`vd7a-multiparcel.test.ts:388` · la huella cruza la frontera catastral) y tres
de los cuatro preexistentes —`tick-conservation`, `city-seeds` y `district-generation`— quedaron
verdes al regenerar sus mesas. **Los otros diez son nuevos con D-104.**

El control decide de dónde vienen. Con la mesa de perfiles anterior a V.l (cero corredores) y el
mismo árbol por todo lo demás, esos doce archivos dan **142 passed / 1 failed (143) en 160 s**, y el
único fallo sigue siendo `vd7a-multiparcel.test.ts:388`. Es decir: los diez los escribe la geometría
del corredor, no el resto de V.l ni las mesas regeneradas.

Por qué cuestan tanto con un solo perfil: `CITY_ROSTER_SLOTS.player` es el slot `(0,1)`
(`city.ts:371-381`), o sea **`barrio_del_umbral` — el corredor cae justo en el distrito del jugador**,
que es el distrito sobre el que construyen estos tests.

Medido sobre `barrio_del_umbral` seed 1 (red v3): 88 parcelas, **0 sin frente** y **88 sin adyacencia
al eje** (distancia mínima 2 al eje frente a 1 al corredor, y adyacencia al corredor cierta en las
88), con 384 celdas de eje y 1.094 de corredor. **No se pierde ningún frente vial**: no salta el STOP
de V.l.4. Lo que salta es que media suite sigue midiendo el acceso contra el eje. Los diez se
reparten en dos clases distintas, y la distinción importa porque el arreglo no es el mismo:

- **Dos comprobaciones con el conjunto de celdas equivocado** (`road-topology.test.ts:61` y
  `urban-civic.test.ts:140`): ambas derivan `roadCellsFromSegments` —sólo eje— sobre distritos que
  ya son v3. Es el mismo defecto que la guarda del gate de arriba, esta vez materializado en un test.
  El arreglo es pasar el cell-set del corredor cuando `derivationVersion === 3`; el invariante no se
  toca.
- **Ocho con evidencia canónica embebida** (`facility-coverage.test.ts:318`,
  `h1-acceptance-isolation.test.ts:187`, `h1-land-value.test.ts:251`, `h2-potential-service.test.ts:256`,
  `housing-market.test.ts:332`, `municipal-budget.test.ts:208` —`parcel_00000001`—,
  `phase2.test.ts:543` —`facility.remainder`— y `urban-services.test.ts:277` —`building_00000001/2`—):
  ids de parcela y de edificio, distancias en celdas y muestras por posición elegidas sobre la
  geometría vieja. Aquí no hay invariantes rotos a la vista —en `housing-market` pasa la aserción
  semántica "cerca baja, lejos no toca" y falla el valor absoluto `toBe(100)` del comentario—, pero
  re-muestrear diez tests ajenos a V.l no es un extra de esta fase, es una fase.

**Consecuencia de gobierno**: V.l.5 **no se declara cerrada**. La envolvente está restaurada por
geometría y las tres mesas canónicas están regeneradas y atribuidas, pero el árbol queda rojo en diez
tests de comportamiento y las tres salidas son decisión del responsable:

1. **Cero corredores en el mundo canónico** — medido verde (142/143 con el único rojo preexistente) y
   las doce ciudades en 712–740, holgadas. D-104 quedaría probado por sus tests propios (V.l.2–V.l.4,
   el gate de 900 distritos y la costura inter-distrito) sin estar activo en las mesas canónicas.
2. **Un corredor y pagar la realineación** — las dos comprobaciones de clase 1 se alinean con el
   corredor; los ocho de clase 2 se re-muestrean. Es trabajo nuevo, con su propia evidencia.
3. **Otro perfil** — de los seis sanos, el único con precio por debajo del margen de la envolvente es
   `ensanche_ferroviario_oeste` (−8 frente a los −6,25 de `barrio_del_umbral`); está **sin medir** ni
   en envolvente ni en estos diez tests, y cambiar de perfil vuelve a exigir regenerar las tres mesas.

### La salida 3, medida (2026-11-10): no existe sola, y la causa de los diez no era la que se anotó

El responsable ordenó empezar por la 3. Se midió con una barrida temporal de las banderas de
`district-profiles.ts` (respaldo + restauración verificados por sha256; nada de esto se conmutó).

**Envolvente: la salida 3 es mejor que la que está en el árbol.** Con `roadCorridor` sólo en
`ensanche_ferroviario_oeste` (slot `(0,2)` de `CITY_SLOTS`: ni jugador ni rival) las doce ciudades dan
**707–737, cero fuera de 700..760**, con **7 de margen sobre el suelo** (seed 11 = 707). En el árbol de
hoy -corredor en `barrio_del_umbral`, slot del jugador- el peor es **exactamente 700**. Precio medido
por ciudad: −3..−15, media **7,42** frente a los −8..−22 y media 13,25 del perfil actual. Las doce filas
transcritas de la corrida de esta sesión (`digest` = FNV-1a sobre `canonicalizeState`; "sin corredor" es
la mesa de control `C5` ya citada arriba; Oeste aporta 40–46 parcelas):

| seed | sin corredor | con corredor en Oeste | Δ | `digest` con corredor en Oeste |
|---|---|---|---|---|
| 1 | 723 | 717 | −6 | `cc5b33b7d4adf373` |
| 2 | 738 | 733 | −5 | `207436845741c62a` |
| 3 | 722 | 714 | −8 | `991c596d87c2c2ca` |
| 5 | 739 | 724 | −15 | `cc008f2570051820` |
| 7 | 726 | 721 | −5 | `bcda9cfb4a45fcc9` |
| 11 | 712 | 707 | −5 | `f12a49664d880c12` |
| 13 | 736 | 729 | −7 | `4d1cfa6e979c752e` |
| 17 | 730 | 719 | −11 | `4905ae0180f645a9` |
| 23 | 738 | 729 | −9 | `d23903d5f215322a` |
| 42 | 730 | 722 | −8 | `42dcd9f75b66f37a` |
| 1337 | 739 | 732 | −7 | `754da4a8a712a515` |
| 2026 | 740 | 737 | −3 | `0310c2b99707c900` |

Estas doce filas son **medida de barrida temporal, no mesa canónica**: no están en
`packages/simulation/src/city-fixtures.ts` y sólo se convertirían en evidencia comprometida si el
responsable autoriza el paquete de abajo.

**Tests: ocho de los diez vuelven a verde** (11 ficheros, 142 tests: **139 passed / 3 failed** frente a
los 141/1 del control de cero corredores, cuyo único rojo es el preexistente
`vd7a-multiparcel.test.ts:388`). Quedan `road-topology.test.ts:61` y `facility-coverage.test.ts:155`.

`road-topology.test.ts:61` recorre los **nueve** perfiles con `generateDistrict`, así que falla con
cualquier perfil que lleve el corredor: **no hay elección de perfil que lo evite**. La salida 3 tal
como estaba escrita en el menú (cambiar de perfil, sin tocar nada más) no existe.

**Y el fallo de `facility-coverage.test.ts:155` no es evidencia desfasada: es un defecto de
producción.** `roadCellsByDistrict` (`packages/simulation/src/facility-coverage.ts:262-268`, con
`roadCellsFromSegments` en `:265`) y `roadCostsByDistrict` (`:143-157`, en `:149`) construyen el suelo
vial sólo con el **eje**, y `roadAccessNodes` (`:270-285`) exige una celda de ese conjunto junto al
frente de la parcela. Medido con una réplica exacta de esa función sobre las tres variantes (seeds 7 y
1):

| variante | distritos v3 | parcelas con nodo de acceso | parcelas adyacentes al corredor |
|---|---|---|---|
| cero corredores | ninguno | Barrio 93/93 · Oeste 47/47 | - |
| corredor en Barrio (árbol de hoy) | Barrio | **Barrio 0/83 · 0/76** | 83/83 · 76/76 |
| corredor en Oeste | Oeste | **Oeste 1/42 · 1/44** | 42/42 · 44/44 |

El grafo tampoco conoce las celdas del corredor, así que **el distrito que lleva el corredor queda
incomunicado del grafo de servicios**. Consecuencia medida sobre las semillas 7, 1 y 11: parcelas de
Oeste con cobertura de parques **9, 14 y 14** con cero corredores, **2, 7 y 7** con el corredor en el
vecino -misma geometría de Oeste, el efecto es de asignación citywide- y **0, 0 y 0** cuando Oeste es el
distrito con corredor; `barrio_del_umbral` en el árbol de hoy está en **0, 0 y 0** desde que V.l.4 lo
puso en versión 3, antes 63, 61 y 62. La afirmación llega hasta donde llega la medida: lo que se cae por
`accessByParcel` es `parkDistance` (`:525`) y `transportDistance` (`:534`), y en el mundo canónico de
hoy el distrito del jugador no tiene ni una parcela con nodo, o sea **ni parques ni transporte
alcanzables**. Los cinco servicios de capacidad (`:509`) leen 0 en **las tres** variantes, incluida la
de cero corredores, y eso no lo explica D-104: la sonda mide `byParcelId` sobre un estado recién
generado y H2-05 sólo cuenta parcelas desarrolladas (`:564-565`), así que en esas semillas no hay
demanda que cubrir. No significa que el grafo no les afecte -la misma guarda `access.length === 0`, en
`:625` y también en la cobertura potencial de `:708`, las incomunica igual en cuanto haya edificios-,
pero eso no está medido aquí y no se afirma. Esto sí
corrige la clasificación de la sección anterior: los diez no eran "dos con el conjunto de celdas
equivocado y ocho con evidencia canónica"; al menos en buena parte eran una sola causa, y esa causa está
en código de dominio, no en los tests.

**El fix, medido como experimento** (bifurcar `facility-coverage` por `derivationVersion`: v3 usa
`roadCorridorCellsFromSegments`, v2 sigue con el eje; dos sitios + un helper compartido). Mismos once
ficheros:

| variante | sin el fix | con el fix |
|---|---|---|
| cero corredores | 1 failed / 10 passed | **1 failed / 10 passed** (no-op verificado) |
| corredor en Barrio | 11 rojos en la suite completa (10 de ellos aquí) | **5 failed / 6 passed** (`phase2`, `road-topology`, `urban-civic`, `urban-services`, `vd7a`) |
| corredor en Oeste | 3 failed / 139 passed | **2 failed / 9 passed** (`road-topology`, `vd7a`) |

Es decir: **fix + salida 3 deja un solo rojo imputable a D-104** -`road-topology.test.ts:61`, que es la
comprobación del propio test midiendo contra el eje en una red v3- más el preexistente
`vd7a-multiparcel.test.ts:388`. El fix solo, con el corredor en el slot del jugador, no basta: quedan
cuatro.

**El fix está ejecutado (2026-11-10, ítem 1 autorizado por el responsable).** En
`packages/simulation/src/facility-coverage.ts` un helper -`roadCellsForSegments(roads, segments)`, `:146-159`-
elige el suelo vial por `derivationVersion` (v3 → `roadCorridorCellsFromSegments`, v2 → el eje) y lo
consumen los dos sitios de la tabla de arriba: `roadCostsByDistrict` (`:167`) y `roadCellsByDistrict`
(`:283`). El precedente de la bifurcación es el mismo que `validateUrbanFabric`
(`packages/simulation/src/urban-fabric.ts:869-876`, anotado en V.l.4); el commentario de `:147-150` dice
por qué: el eje de una red v3 no es por donde las parcelas acceden a la red.

Suite de simulación completa, mismo árbol (corredor en `barrio_del_umbral`, sin el resto del paquete):
**11 failed / 566 passed / 19 skipped en 807,50 s → 5 failed / 572 passed / 19 skipped en 715,13 s**.
Seis ficheros pasan a verde sin encender ni apagar ninguna bandera: `facility-coverage`,
`h1-acceptance-isolation`, `h1-land-value`, `h2-potential-service`, `housing-market`,
`municipal-budget`. Los cinco que quedan no son deuda de este fix:

| rojo | causa | ítem |
|---|---|---|
| `road-topology.test.ts:61` | el test comprueba el frente contra `roadCellsFromSegments` (`:44`, `:71`, `:127`) y recorre los nueve perfiles: falla con **cualquier** corredor | (3) |
| `urban-civic.test.ts:128` | la misma clase: `publicspace_00000401 sin acceso desde la red`, comprobado contra el eje | (3) |
| `phase2.test.ts:543` | `expected 200000 to be 800000`: producción derivada de la cobertura, evidencia muestreada en la geometría vieja | (2)/(4) |
| `urban-services.test.ts` | `expected 100 to be greater than 100`: misma causa | (2)/(4) |
| `vd7a-multiparcel.test.ts:388` | BASELINE DEBT desde 2026-11-03, ajena a D-104 | — |

Con el corredor en Oeste el experimento ya dejaba **2 rojos** de los once, que son `road-topology` (ítem 3)
y el preexistente: los dos de evidencia canónica de la tabla se van con el ítem (2). El verde de
`urban-civic` con Oeste no desmiente que sea clase 1 -el distrito del jugador vuelve a v2 y su
comprobación por eje vuelve a valer-; lo que demuestra es que sólo muerde en el distrito con corredor.

**Timings del fix, medidos A/B** (`/tmp/vl5b-ab.log`; 40 reconstrucciones frías de
`facilityCoverageIndex` sobre `createInitialState`, misma muestra en las dos piernas, árbol restaurado y
verificado por sha256):

| pierna | p50 | p95 | max | parcelas | con transporte | con parques |
|---|---|---|---|---|---|---|
| HEAD (eje) | 63,43 ms | 75,87 ms | 89,14 ms | 28.311 | 23.864 | 12.645 |
| con fix | 94,99 ms | 113,86 ms | 166,15 ms | 28.311 | 27.210 | 15.099 |

**+31,6 ms p50 y +38,0 ms p95 por ciudad**, y a cambio **+3.346 parcelas con transporte y +2.454 con
parques** que antes no tenía ninguna por estar el distrito-isla fuera del grafo. Dos acotaciones: **no
hay ninguna gate que temporice la cobertura**, así que ningún presupuesto declarado se rompe con estos
números -el presupuesto de 500 ms es de generación/derivación del `FABRIC_GATE`, no de este índice-; y
la caída de 807,50 s a 715,13 s en la suite **no es una mejora de rendimiento**, son seis ficheros que
fallan antes de terminar sus casos y no se afirma como tal.

**Y la predicción del ítem (4) sobre los dorados no se cumple.** `tick-conservation.test.ts` pasó
aislado con el fix en verde (**1 passed / 27,68 s**, `/tmp/vl5b-tickconservation.log`): los diez digestos
de carreras largas no se mueven, así que la tercera regeneración no incluye los dorados por culpa de este
fix. Lo que sí queda por regenerar son las dos mesas que mueve el perfil elegido -`city-fixtures.ts`,
con `digest` y `parcelCount`, y `district-fixtures.ts`-, y eso es consecuencia del ítem (2), no de este
fix.

**Paquete que la medida hace posible (V.l.5b), pendientes de autorización del responsable porque tocan
mesas canónicas y un test de V.c.2B:**

1. ~~el fix de `facility-coverage` bifurcando por `derivationVersion`~~ **EJECUTADO 2026-11-10.**
2. `roadCorridor` en `ensanche_ferroviario_oeste` y fuera de `barrio_del_umbral`.
3. alinear `road-topology.test.ts:61` y `urban-civic.test.ts:128` al mismo conjunto de celdas -es la
   deuda que el gate de V.l.5 ya declaraba sin cubrir, y con el fix ejecutado es lo único que separa el
   árbol de un solo rojo D-104-.
4. regenerar las **dos mesas de ciudad y distrito** que mueve el ítem (2). Aquí va la corrección de esta
   línea, escrita antes de medir: **el fix no toca los diez digestos dorados**, así que no hay tercera
   regeneración de `tick-conservation` por su causa; lo que sí cambia es `city-fixtures.ts`
   (`digest` y `parcelCount`) y `district-fixtures.ts`, y eso es consecuencia del ítem (2).
5. gate + suite completa + lint/typecheck.

Nota de coste, resuelta: (1) y (3) cambian distancias sobre el grafo en los distritos v3 -más nodos, no
menos-. La de (1) está medida arriba (+38,0 ms p95 por reconstrucción del índice, sin presupuesto
declarado que cubrir porque ninguna gate temporiza la cobertura). La de (3) no se aplica: alinear un test
no mueve producción.

**Deuda adyacente que este fix no toca y deja registrado** -mismos cuatro sitios que llaman al eje donde
una red v3 publicaría el corredor, ninguno pedido y por tanto ninguno cambiado-:
`land-value.ts:125-128` (el bonus de avenida y la distancia a vía se miden desde el eje; **producción**,
afecta al valor del suelo de un distrito v3 y no está medido su sesgo), `district-generator.ts:702`
(`roadCellCount` como métrica de forma), `urban-morphology.ts:13`/`:33` (métricas sobre el eje, casadas
con las envolventes declaradas en Fase 0: cambiarlas sería relajar un umbral), `system-cost.ts:276`
(harness sintético, no toca geometría real) y, en los tests de la misma clase que el ítem (3),
`road-topology.test.ts:44`/`:71`/`:127` y `urban-fabric-gate.test.ts:104`. Dos que **no** son deuda:
`projection.ts:484`, porque el canal `map.roads.cells` es el eje por decisión D-104 §2, y
`urban-fabric.test.ts:42-43` con `road-corridor-seam.test.ts:65-66`, que ya bifurcan por
`derivationVersion`.

## V.l.5c · el corredor mixto, medido (2026-11-10)

El responsable pidió la barrida de coste del variante «5+3» antes de elegir entre los ítems (2)–(5).
Evidencia completa y procedencia en
`docs/execution/phase-4/vl5c-corredor-mixto-2026-11-10.md` (árbol `5482bcd`, arnés validado reproduciendo
los dos controles publicados, todo restaurado y verificado por sha256; **nada adoptado**).

**La premisa del «5+3» era falsa y el hallazgo es que no era esa la palanca.** `deriveRoadNetwork`
(`packages/simulation/src/urban-fabric.ts:280-281`) marca `avenue` en **una sola línea por sentido** -la
central-; el resto de la retícula ya es `street`. La avenida de 5 ya estaba reservada a un eje signature,
así que lo que consume las parcelas es la **acera en todas las calles**. Se barrió el eje real, con tres
modos: `full` (calle 3 / av 5), `ave` (calle **1** / av 5 con mediana), `ave3` (calle **1** / av 3 sin
mediana).

Precios por perfil (peor case sobre las doce ciudades, suelo declarado 700, media en paréntesis):

| perfil | `full` | `ave` | `ave3` |
|---|---|---|---|
| `barrio_del_umbral` (slot del jugador) | 22 (13,25) | 15 (9,17) | 7 (2,83) |
| `vega_del_cauce` | 11 (7,67) | 11 (4,75) | 6 (1,67) |
| `ensanche_ferroviario` | 26 (18,08) | 21 (14,83) | 20 (8,67) |
| `mercado_del_norte` | 23 (17,5) | 16 (9,0) | 12 (5,5) |
| `ensanche_ferroviario_oeste` | 15 (7,42) | 9 (6,5) | 7 (2,92) |
| `patios_del_este` | 12 (8,58) | 8 (5,92) | 5 (2,08) |
| `barrio_del_taller` | no compone | no compone 11/12 | 14 (7,08) |
| `lomas_del_umbral`, `centro_civico` | **no componen** | **no componen** | **no componen** |

`ZONING_SHORTAGE (mixed: 0 < 2)` en el primer intento y en las doce seeds: a `lomas_del_umbral` y
`centro_civico` el corredor **no les entra con ningún ancho**. El techo de la variabilidad es estructural
(cuota de usos), no de envolvente, y nueve perfiles con corredor directamente no componen. Aditividad
comprobada con diferencia 0 contra las combinaciones medidas, así que la búsqueda de carteras predice.

Lo que da la envolvente, en distritos v3 dentro de 700..760: **con `full` en el slot del jugador, 1** -ni
un acompañante: `barrio full + oeste ave3` cae a 698-. **Con `ave` en el jugador, 3** (barrio `ave` +
vega y oeste `ave3`, min 702). **Con `ave3` en el jugador, 5** (barrio, vega, mercado, oeste, patios,
min 701). Y la cartera que más variedad da sin renunciar al look completo es **`full` en `oeste` + tres
`ave3`** = 702: el perfil barato es el único que puede pagar la sección de 3/5 y dejar aceras en otros
tres distritos. Ninguna variante que compone pierde un solo frente vial (0 sobre las 8.773 parcelas del
control), así
que el STOP de V.l.4 por frentes no se activa en ninguna. Contra-intuitivo medido: en `vega_del_cauce`,
`ave3` **sube** el peor case de 712 a 713 -al quitar aceras alguna manzana partida vuelve a ser una y
empaqueta mejor; el coste no es monótono con el ancho.

**Hallazgo de producción, de clase STOP para V.l.7: la mediana no existe en el mundo generado.**
`median` = **0 celdas** en los tres modos y en las 127 celdas de eje de avenida del distrito medido. La
mediana de `ROAD_PROFILES.avenue` cae en el offset 0 -el eje-, pero esa celda tiene encima dos tramos de
`avenue` (el largo `32,0 → 32,63` y el de una celda `32,0 → 32,0`) y dos de `street`: la retícula añade
`street.add(key)` **antes** de añadir la avenida a `trunk` (`urban-fabric.ts:287-302`), así que la línea
de avenida se publica dos veces. `resolveRole` (`packages/shared/src/road-cross-section.ts:219-223`)
aplica la regla 1 -«dos ejes que se cruzan son calzada»- por recuento de ejes, sin distinguir
**colineal de perpendicular**, y con `axisHits >= 2` en el 127/127 la mediana nunca sobrevive. Cuesta el
elemento firma de D-104 §1, no bytes. Las dos salidas tienen precio: minimizar tramos colineales cambia
`roadSegmentId` y los frentes (lo que V.l.2/V.l.3 prometieron no tocar) o ceñir la regla 1 a ejes de
distinta orientación, que cambia el rol publicado y por tanto el digesto de `map.roadSection`. **No se
tocó nada**: no está pedido y es decisión del responsable.

**Lo que esta barrida NO mide**, declarado en el acta: costuras inter-distrito con vecinos de sección
distinta (`road-corridor-seam.test.ts` sólo cubre pares homogéneos); el canal `map.roadSection`, que
hoy publica **un** perfil por clase con un único `width` (`packages/simulation/src/projection.ts:501-521`
bajo esquema `.strict()`) y por tanto **no es expresable en sección mixta** sin cambiar el contrato de
D-104 §4 o añadir ids de perfil; la economía derivada (cobertura, valor del suelo, programa municipal);
y ningún digesto canónico -las variantes no están regeneradas en ninguna mesa.

## Deuda aceptada (decisión del responsable, 2026-11-09)

V.l.3 se midió con `ROAD_BENCHMARK=1` (`artifacts/road-topology/vc2b-performance.json`, PASS):
`roadSection` = **22.860 B** con 265 segmentos y 2 perfiles, frente a **2.921 B** del eje; delta vial
total 25.805 B sobre una proyección que se publica cada 2 ticks. El coste lo domina la
**representación no mínima de segmentos** que D-085 ya dejó como deuda: `segmentsFromGrid` emite un
tramo horizontal de una celda por cada línea vertical de la retícula.

El responsable decidió **ceñir V.l.4 a lo especificado y aceptar ese payload**, dejando la
minimización de tramos colineales como deuda de otra fase. Fusionarlos cambiaría `roadSegmentId` y
los frentes de parcela que lo referencian, justo lo que V.l.2/V.l.3 prometieron no tocar.

## V.l.5c adoptada · opción 3 (2026-11-10)

La decisión del responsable queda ratificada y ya está implementada. `DistrictProfile` publica
`roadSectionVariant`: `full` para `ensanche_ferroviario_oeste`, `ave3` para `vega_del_cauce`,
`mercado_del_norte` y `patios_del_este`; `barrio_del_umbral` conserva la red v2 de eje. El resolver
`roadProfileForSection` mantiene las clases del eje y sólo cambia la sección transversal, por lo que
`map.roadSection` sigue siendo estricto y autoritativo por distrito. Cobertura de facilities y valor del
suelo derivan las mismas celdas de corredor; fixtures de ciudad/distrito y seams se regeneraron. La
mediana colineal no se amplía en esta entrega y queda como decisión visual separada.

## Verificación

**Medido ya:** V.l.2 tiene 16 tests puros (perfiles, recorte en borde, precedencia en cruce,
determinismo ante orden de entrada, eje preservado y el control de ancho 1 que recupera exactamente
`roadCellsFromSegments`); shared 73/73. V.l.3 tiene el contrato `.strict()` probado (canal ausente y
campos de más rechazados) y la igualdad del eje entre dos proyecciones de la misma partida; shared +
proyección de simulación 86/86, web 266 passed | 4 skipped, typecheck y ESLint limpios. Payload y
timings de proyección en la sección de deuda aceptada. V.l.4 cierra con su gate de 900 distritos
(`vl4-fabric-gate-2026-11-10.json`) y la costura inter-distrito (`road-corridor-seam.test.ts`, 12 pares
× 2 seeds). V.l.5 regenera la evidencia canónica —12 hashes de distrito, 12 filas de ciudad, 10
digestos dorados— con los controles de la sección de arriba, y vuelve a pasar su gate
(`vl5-fabric-gate-2026-11-10.json`: 900 distritos, 72.124 parcelas, p95 de generación 339,23 ms y de
derivación vial 5,04 ms).

**El fix (V.l.5b ítem 1) está ejecutado y medido el 2026-11-10** -ver la sección "La salida 3, medida"-:
la isla del grafo en redes v3 no existe, seis ficheros de simulación pasan a verde sin tocar banderas y
el coste medido es +38,0 ms p95 por reconstrucción del índice de cobertura. **Sigue sin cerrar V.l.5**:
quedan los ítems (2) a (5), que son decisión del responsable.

**Pendiente de medir:** carga de save v2 bit a bit y
atribución de la componente de forma previa a V.l.5 (V.l.6), invariante sentido ⇄ bordillo (V.l.7) y
capturas + FPS (V.l.8). La aprobación visual es humana.

## Relacionadas

D-085 (topología vial autoritativa; §2 enmendada), D-090 (tejido urbano; §2 enmendada por
`derivationVersion` 3), D-086 (street dressing presentacional: lo que era sólo pintura pasa a tener
dato detrás), D-093 (identidad espacial y huellas), D-096/D-097 (contrato multi-parcela y colocación),
D-102 (carga por distrito: el canal nuevo no añade binarios), D-103 (agentes como avatares: el peatón
tendrá por fin una celda `sidewalk` donde anclarse).
