# D-094 — Semántica de demanda urbana y asignación capacity-aware en los servicios municipales

Estado: aceptada y aplicada. La decide el plan **V.d-H2 Presentation & Municipal Service Closure**
(2026-10-30) sobre `3f3c707`, y se implementa en los diez commits de `develop` hasta la firma de
esta acta. Amplía —no sustituye— D-092 (equipamientos y servicios espaciales) y D-093 (integridad
urbana de V.d) donde su texto dejaba la demanda anclada al censo catastral y la asignación atada a
un Voronoí estricto. El bundle procedural pasa de 11 a 15 tipos cubiertos (D-080, §3 de D-093);
la proyección publica la huella física real (D-093 §2 y §8); y la orientación de dominio se
separa explícitamente del azimut de cámara (nuevo §7 de esta decisión).

## Contexto

D-092 dijo "los servicios son espaciales y su cobertura depende de la red, no de un radio global".
D-093 dijo "la capacidad de un equipamiento es cero mientras su edificio no esté operacional".
Ambos son ciertos, pero dejaron dos huecos estructurales que el playtest automatizado no podía ver:

1. **La demanda se contaba mal.** `facilityCoverageIndex()` trataba toda parcela marketable como
   demandante, tuviera edificio encima o no. Una ciudad recién generada tiene ~716 solares y
   ~600 slots de capacidad municipal (2 comisarías × 2 cohortes × 25 + 3 clínicas × 4 × 25 + 3
   colegios × 6 × 25 + 3 mercados × 4 × 25 + 2 bomberos × 2 × 25). Al nacer, 12 de 14 facilities
   aparecían saturadas. La saturación no era consecuencia del crecimiento urbano: era el censo.
   Esto hacia imposible la frase de diseño "la ciudad crece → aumenta la demanda → aparecen
   saturaciones".

2. **La asignación era Voronoí estricta sin spillover.** Primero se buscaba la facility más barata
   para cada parcela; después se aplicaba su capacidad. Una parcela cuyo primer destino estuviera
   lleno o sin edificio operativo quedaba sin servir, aunque otra alcanzable tuviera hueco libre.
   No era un problema de tuning: era un problema de algoritmo.

Y dos huecos más en la capa de presentación:

3. **El footprint físico no llegaba al renderer.** `ViewProjectionV2.economy.buildings[]` declaraba
   `parcelId` pero no `footprintCells`, `orientation`, `floors`, `form` ni `districtId`. El
   producer usaba `{...building}` que sí los filtraba en-process, pero Zod stripaba los campos no
   declarados en `worker/client.ts:504`. `syncBuildingSprites` resolvía la parcela buscando
   `parcel.buildingId === building.id` (sólo el primer edificio derivado) y colocaba el sprite en
   `parcel.cell` —el anchor de la parcela, no la huella del edificio—. Una parcela con dos
   edificios renderizaba uno, ambos en el mismo sitio.

4. **El bundle procedural sólo cubría 11 de los 15 tipos de dominio.** `row_house`,
   `apartment_block`, `mixed_tenement` y `warehouse` dependían de un Blender que no siempre
   estaba disponible; con el Blender ausente, `resolveBuildingVisual` devolvía `null` y el
   edificio desaparecía del render. El contrato del propio helper afirmaba lo contrario.

A esto se suma una confusión terminológica latente: `Building.orientation ∈ {0, 90, 180, 270}`
(rotación física dentro de la parcela) y `RuntimeAssetManifestV2.allowedOrientations ⊂
{45, 135, 225, 315}` (azimut de cámara) son dos vocabularios disjuntos que el código no conecta.
Hasta que el arte no tenga frames laterales, conectarlos sería inventar rotaciones incorrectas.

## Decisiones

### 1. La demanda activa es desarrollo urbano, no censo catastral

Una parcela marketable **con al menos un Building privado no-ruin encima** genera una unidad de
demanda de servicio. Una parcela vacante no genera demanda, pero conserva accesibilidad: puede
llegar a la facility, sólo no consume su capacidad.

Es una aproximación **Alpha**. Una parcela con dos edificios sigue valiendo **una** unidad —no
hay todavía un modelo demográfico que pondere residentes, floors, usos, tamaño, children o
empleo—. Introducir esos pesos es una decisión de Beta con su propia ADR, no una extensión de
ésta. La separación conceptual queda fijada:

- **ACCESSIBILITY** = "¿puede esta parcela llegar al servicio?". Se calcula sobre todas las
  marketables, para capacity services y para parks/transport.
- **ACTIVE DEMAND** = "¿cuánta capacidad está usando realmente la ciudad?". Cero para vacantes,
  uno para cada parcela desarrollada.

Consecuencia: la ciudad puede expresar crecimiento → aumento de demanda → saturación. La
saturación es ahora un **resultado observable del juego**, no un hecho topológico.

### 2. La asignación es greedy determinista con capacidad

Se generan todos los pares (parcela, facility, coste) alcanzables, se excluyen facilities con
`effectiveCapacity === 0`, se ordenan por `cost asc → parcelId asc → facilityId asc` y se
recorre la lista asignando mientras la parcela no esté servida y la facility conserve hueco. Si
la primera opción está llena, la parcela prueba la siguiente alternativa.

No es un min-cost-flow óptimo: es un greedy canónico que cumple las mismas propiedades que el
diseño pide (determinista, sin depender del orden de Map, con spill visible). Si el playtest o
el balance futuro demostraran que el greedy es insuficiente, un óptimo real sería una sucesora
de esta decisión, no una enmienda.

`FacilityCoverageReport.demand` conserva la semántica de "cuántas parcelas tienen esta facility
como primera opción" (Voronoi estricto). `served` es lo que realmente admite, incluyendo el
spill-in de vecinos saturados. La diferencia entre ambos es el número que el inspector debe
poder explicar: si `served < demand`, la facility perdió parcelas hacia otra por capacidad; si
`served > demand`, la facility absorbió spill-in de un vecino.

**Enmienda H2.1-01 (2026-10-30) — semántica publicada del informe.** El párrafo anterior describía
dos magnitudes correctas y un tercer campo que no lo era: `coveragePercent = served / demand`. Con
spill-in esa división puede pasar de 100 (una facility de cuenca pequeña que absorbe el excedente
de varias vecinas atiende más parcelas de las que la elegían) y con `demand === 0` no existe. No era
una cobertura y se llamaba así en el contrato del renderer y en el inspector. El informe pasa a
publicar cuatro magnitudes sueltas, sin ratios cruzados entre ellas:

```
firstChoiceDemand    parcelas cuya primera opción es esta facility (Voronoi estricto)
effectiveCapacity    huecos disponibles = cohortes operativas × cohorte del servicio × presupuesto
served               huecos consumidos (primeras opciones + spill-in)
utilizationPercent   served / effectiveCapacity, 0 si no hay huecos, acotado 0..100
```

Y `saturated` deja de ser `demand > effectiveCapacity` para significar **«sin hueco libre»**:
`effectiveCapacity > 0 && served >= effectiveCapacity`. Con la definición anterior una facility
apagada (presupuesto 0 o edificio destruido, capacidad 0) nunca aparecía saturada mientras que una
receptora de spill podía no aparecer si su cuenca propia era pequeña; las dos readings eran
incorrectas. Ahora `saturated` afirma una sola cosa comprobable: la próxima parcela que llegue será
derivada a otra facility. No afirma demanda insatisfecha en la ciudad —el spill puede resolverla—,
y para eso está `unfulfilledReachableDemand` del harness de balance. La proyección renombra el
bloque a `serviceMetrics` y el inspector web enuncia cada cifra con su unidad
(`atendidas / capacidad / utilización / demanda primaria`).

### 3. La capacidad se recalibra por servicio, no con una constante global

`DEMAND_UNITS_PER_CAPACITY = 25` global queda sustituido por
`DEMAND_UNITS_PER_CAPACITY_BY_SERVICE` con los valores:

```
security    75    → 2 × 2 cohortes × 75 = 300 slots por ciudad
fire        75    → 2 × 2 cohortes × 75 = 300
health      25    → 3 × 4 cohortes × 25 = 300
education   17    → 3 × 6 cohortes × 17 = 306
market      25    → 3 × 4 cohortes × 25 = 300
```

Derivados sobre las doce seeds canónicas y los cuatro escenarios de crecimiento de §5, para
que la cobertura de los cinco capacity services caiga en la banda de diseño 60–90 % al 50 % de
desarrollo y 45–80 % al 75 %. `parks` y `transport` quedan fuera: son radios de accesibilidad,
no slots.

**El programa municipal no cambia.** Las recetas municipales (2 comisarías, 2 parques de
bomberos, 3 clínicas, 3 colegios, 3 mercados) y `MUNICIPAL_FACILITY_CAPACITY` en cohortes se
conservan intactas. Solo cambia cuántas parcelas vale cada cohorte.

**Enmienda H2.1-03 (2026-10-30) — la evidencia publicaba la unidad equivocada.** El harness
`pnpm services:balance` etiquetaba `capacityUnitParcels` con el scalar global
`DEMAND_UNITS_PER_CAPACITY` (25), que desde H2-07 ya no es la cohorte de ninguno de los cinco
capacity services: las cohortes medidas en el propio informe no cuadraban con la etiqueta. Pasa a
publicar `demandUnitsPerCapacityFor(service)` por servicio y un mapa explícito en la cabecera
(`security 75 · fire 75 · health 25 · education 17 · market 25`; parks y transport conservan 25
porque no consumen slots). **Ninguna capacidad se modificó para cambiar la evidencia**: las
demandas, coberturas y saturación medidas siguen siendo las de H2; la corrida corregida se guarda
en `docs/execution/phase-4/vd-h21-service-final.json` sin pisar `vd-h2-service-final.json` ni el
baseline histórico.

### 4. La respuesta al presupuesto modula unidades, no cohortes enteras

Antes `Math.floor((facilityCapacity × level) / 100) × demandUnitsPerCapacity` truncaba a
cohortes ENTERAS antes de multiplicar. Una comisaría de capacity 2 y demandUnits 75 daba 150
slots al 100 % y 0 al 49 %, con un salto discreto a 75 al 50 %. El presupuesto no podía modular
nada: o servías cohortes completas o no servías.

Se sustituye por `Math.floor(facilityCapacity × demandUnitsPerCapacity × level / 100)`. Sigue
siendo aritmética entera y determinista, pero la curva es suave y monotónica: 150 / 112 / 75 /
37 / 0 para 100 / 75 / 50 / 25 / 0 %. Al 100 % de presupuesto las dos fórmulas dan el mismo
número, así que los diez golden digests no se mueven.

### 5. Las parcelas vacantes exponen servicio potencial sin reservar slot

`FacilityCoverageIndex.potentialByParcelId` publica, para cada parcela sin edificio privado,
qué facilities alcanzables tienen capacidad residual en este momento. El jugador las ve en
overlay, en la compra, en el inspector y —a través de `CoverageIndex`— en el score de suelo.
No reserva slot: si mañana dos jugadores construyen sobre dos solares que compartían el mismo
hueco, la Voronoi y el greedy resuelven la contienda canónicamente.

**Enmienda H2.1-02 (2026-10-30) — el potencial sí entra en la tasación del suelo.** La redacción
original de este punto era contradictoria: afirmaba que el potencial llegaba al score «a través de
`CoverageIndex`» y dos líneas después negaba que el score lo consumiera. En H2 el código hacía lo
segundo —el término `services` leía sólo cobertura activa—, de modo que un solar vacío junto a una
red operativa puntuaba `services: 0` igual que un erial sin acceso, y el mapa no reaccionaba hasta
que el jugador ya había construido.

El contrato queda así, y es el que implementa `serviceScore()`:

- La **demanda activa** de una parcela vacante sigue siendo cero: no consume capacidad y no aparece
  en `CoverageIndex.byParcelId`.
- Para **tasar**: parcela desarrollada → cobertura real; parcela vacante → cobertura potencial.
- Sólo sustituye el término `security`, que es el único de la composición que viene de facilities con
  capacidad. `transport` (accesibilidad de red) y `cleaning` (radio por distrito) ya se computaban
  para toda parcela marketable.
- La composición y los pesos **no cambian**: `(transport + security + cleaning) / 30`, banda 0..10, y
  `civicAmenities` sigue siendo la componente geométrica que no consulta grafo, edificio ni
  presupuesto (D-093 §7).
- El potencial **no reserva** capacidad: dos solares contiguos pueden ver el mismo hueco libre. El
  día que se construyan, la Voronoi y el greedy resuelven la contienda sobre la demanda activa.

Medida: sobre el caso dorado `city:200-parcels:month-boundary`, 90 de los 676 solares vacantes suben
su `marketValue` (Σ +2604) y cero observables más se mueven —ni las 157 parcelas desarrolladas, ni
las cinco cajas, ni transacciones, hogares, incidentes, ruinas ni bajas.

### 6. La proyección y el renderer consumen la huella física real

`ViewProjectionV2.economy.buildings[]` publica ahora `districtId`, `footprintCells`,
`orientation`, `floors` y `form` además de los campos actuales, con schema Zod y tipo TypeScript
en coherencia. `constructionSites[]` hace lo propio. El producer pasa de un `{...building}` que
filtraba Zod en el navegador a un pick explícito que declara lo que viaja.

`syncBuildingSprites` recorre `economy.buildings` y `economy.constructionSites` directamente,
usa `building.footprintCells` para colocación y depth, y `building.parcelId` para la relación
inversa. Se eliminan los tres sitios donde el renderer resolvía la parcela buscando
`parcel.buildingId === building.id`. `drawOverlay` y `parcelOverlayColor` consultan todos los
edificios de la parcela, no sólo el primero. `gameplayGeometryKey` considera "construida" a
cualquier parcela con algún edificio proyectado.

Tres helpers puros nuevos sobre `GridCell[]`:
`footprintBounds`, `footprintVisualCenter` y `depthForFootprintCells`. El scene consume
`buildingSpritePlan`, una función pura que devuelve una entrada por edificio/obra proyectado.
Su paridad —"sprites == edificios proyectados renderizables"— es observable sin levantar
Phaser.

### 7. La orientación física del dominio NO se confunde con el azimut de cámara

`Building.orientation ∈ {0, 90, 180, 270}` es rotación física del sólido dentro de la parcela
(la elige `chooseFootprint` según el eje largo). `RuntimeAssetManifestV2.allowedOrientations ⊂
{45, 135, 225, 315}` es azimut de cámara para el que existe un frame. Los dos conjuntos son
disjuntos. `SCENE_AZIMUTH = 45` es una constante de módulo; `resolveBuildingVisual` no recibe
`orientation` —aridad cuatro, ninguno de los argumentos lo es—.

El arte actual (bundle procedural con `symmetry: "none"` y `[45]`, Blender convertidos V1→V2 con
`[45]` forzado) no tiene frames laterales. **No se conecta** la orientación física a la
representación visual: eso sería inventar rotaciones. La representación visual de la orientación
física queda registrada como **deuda visual P2** en `ai-context/KNOWN-GAPS.md`. Un future fix
con renders laterales puede añadir un quinto argumento `orientation` al helper sin tocar el
contrato existente.

### 8. El bundle procedural cubre el catálogo entero

Los cuatro tipos que faltaban —`row_house`, `apartment_block`, `mixed_tenement` y `warehouse`—
tienen ahora silueta procedural propia, diferenciada por forma, escala y altura aparente sobre
la gramática isométrica base. El test estructural `apps/web/src/assets.test.ts` se deriva de
`BUILDING_DEFINITIONS`, no de una lista mantenida a mano: un tipo nuevo en el catálogo sin
procedural revienta el test antes de desaparecer silenciosamente en el render. `pnpm
services:balance` queda como gate nuevo que mide el balance de los siete servicios sobre las
doce seeds canónicas.

## Consecuencias

- **Determinismo.** Un único golden digest cambia (H2-05, `city:200-parcels:month-boundary`
  `c6a317866f27ad1a` → `b58283d43f7fd764`, Voronoi sobre 200 desarroladas en lugar de 716
  marketables). H2-06, H2-07, H2-08, H2-09 y H2-10 conservan los diez digestos de H2-05 bit a
  bit: las cuatro correcciones afectan a cobertura y capacidad, no a caja, transacciones,
  incidentes ni hogares en esos escenarios.
- **Guardados.** Ninguna incompatibilidad nueva: `SnapshotV2` conserva los cinco canales de
  demanda/capacidad sin cambiar de forma. `demandSignature` es derivada, no persistida.
- **Pruebas nuevas.** Nueve ficheros nuevos o extendidos:
  - `apps/web/src/isometric/building-sprites.test.ts` (11 tests H2-01 + 11 H2-02 + 3 H2-03)
  - `apps/web/src/assets.test.ts` (2 tests reescritos: cobertura estructural + huella de dominio)
  - `packages/simulation/src/h2-projection-footprint.test.ts` (5 tests)
  - `packages/simulation/src/h2-demand-follows-development.test.ts` (11 tests)
  - `packages/simulation/src/h2-capacity-aware-assignment.test.ts` (5 tests)
  - `packages/simulation/src/h2-service-capacity-calibration.test.ts` (7 tests)
  - `packages/simulation/src/h2-potential-service.test.ts` (9 tests)
  - `packages/simulation/src/services-balance.test.ts` (1 test, gate `pnpm services:balance`)
  - `packages/simulation/src/tick-conservation.test.ts` (1 test reformateado: informa todos los
    digestos con drift de una, no sólo el primero)
- **Rendimiento.** La asignación greedy es O(pairs log pairs) en lugar de O(facilities × parcels);
  sobre los 12 seeds y 7 services se mantiene dentro del mature close p95 < 60 ms de D-065 (ver
  acta §4 y tabla de performance). El cache key crece una firma (`demandSignature`): en un mes
  normal, con cero construcciones, la firma no cambia y `facilityCoverageIndex` responde desde
  caché.
- **Lo que esto no arregla.** Escala del programa municipal bajo desarrollo extremo (>75 %):
  la banda 45–80 % da cobertura pero no saturación por encima del techo. El player puede
  construir hasta el 100 % de las parcelas y seguir viendo un 40 % de cobertura de security;
  cerrar ese caso requiere decisiones de producto (nuevas facilities, más cohortes) que no son
  de esta fase. Cold graph hitch sigue vivo (~312 ms el primer cierre de cada GameState nuevo;
  los siguientes reutilizan WeakMap). `delegated_defcerral` dominante en la campaña jugable,
  reproducida idéntica en `95e8937`. Arte final cívico, representación visual de la orientación
  física y playtest humano siguen pendientes.

## Relación con D-092 y D-093

D-092 dijo "los servicios son espaciales, no radiales", pero no dijo qué es la demanda: quedó
implícito que toda parcela marketable era demandante. D-093 añadió "un equipamiento existe si su
edificio existe" y "limpieza radial por distrito", sin tocar la semántica de demanda. D-094
completa el cuadro: **la demanda es el desarrollo urbano**, la **asignación es capacity-aware**,
la **capacidad se calibra por servicio**, y la **respuesta al presupuesto es suave**. Las cuatro
cosas son consecuencia directa de la separación ACCESSIBILITY / ACTIVE DEMAND, no cuatro parches
independientes.

D-093 §7 se reescribe en H2-11 para que quede inequívoco que `civicAmenities` (geométrica) y
`services` (operativa) son canales ortogonales del desglose, no una suma paralela ni la misma
señal dos veces. El texto original se prestaba a la lectura contraria; el código nunca lo hizo.
