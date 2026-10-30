# V.d-H2 — Presentation & Municipal Service Closure (acta)

Fecha: 2026-10-30. Rama: `develop`.

- **HEAD inicial:** `3f3c707efcd2df1efba68daf1d8dc8b101ed1c3c` (`docs: pin the final HEAD of the
  V.d-H1 phase in its act`) — el `3f3c707` que el plan fijó como referencia auditada. Comprobado
  con `git merge-base --is-ancestor 3f3c707 HEAD`, árbol limpio al inicio.
- **HEAD final:** el de la tabla «Git» al final del documento.
- **push:** no, según §0 del plan («no hagas push al terminar»). Los once commits de H2 quedan
  locales en `develop`.

## Qué se pidió y qué se entendió

V.d-H2 no abre scope nuevo: cierra tres inconsistencias detectadas por revisión independiente
después de H1.

1. La simulación es multi-building / multi-cell pero la presentación todavía no lo representa
   fielmente: `ViewProjectionV2.economy.buildings` no publica `footprintCells`, `orientation`,
   `floors` ni `form`; `syncBuildingSprites` resuelve la parcela buscando
   `parcel.buildingId === building.id`, que sólo publica el primer edificio derivado.
2. El modelo de demanda de servicios municipales contaba TODAS las parcelas marketables como
   demanda, lo que hacía que una ciudad nueva naciera prácticamente saturada (12 de 14 facilities
   al 100 % del presupuesto).
3. `RuntimeAssetManifestV2` sólo cubría proceduralmente 11 de los 15 tipos de dominio; los cuatro
   restantes dependían de un Blender que no siempre estaba disponible. Además `Building.orientation`
   (0/90/180/270, dominio físico) y `allowedOrientations` (45/135/225/315, azimut de cámara) son
   dos vocabularios disjuntos que el código no conecta —y no debe conectar sin el arte lateral
   apropiado—.

Once work items (H2-01…H2-11), cuatro gates largos, evidencia nueva sin pisar la histórica y un
ADR D-094 sucesor de D-092 para el cambio de significado de demanda/capacidad.

Reglas del plan que han gobernado el acta:

- No añadir features de producto; cerrar tres inconsistencias concretas.
- No cambiar semillas, constantes económicas ni límites morfológicos para poner un verde.
- Cada fix con test de regresión, verificado contra el código previo.
- Conservar el programa municipal (2/2/3/3/3). Cambiar sólo la interpretación de las unidades.
- Explicar cualquier cambio de golden digest, con atribución medida antes/después.
- No pisar evidencia H1.

## Problemas confirmados y correcciones

### H2-01 · footprint físico en la proyección y el renderer (P1) — `68fca94`

**Síntoma.** `syncBuildingSprites` resolvía la parcela buscando `parcels.find(entry => entry.buildingId === building.id)`. Como `Parcel.buildingId` es `parcelBuildings[0]?.id ?? null` en la proyección, una parcela con dos edificios podía proyectar ambos correctamente pero renderizar sólo el primero. Además `place(...)` se llamaba con `parcel.cell` (anchor), ignorando el footprint autoritativo de H1-02. El overlay de incidencias y la geometría del adapter arrastraban el mismo patrón.

**Causa.** `ViewProjectionV2.economy.buildings[]` no declaraba `districtId`, `footprintCells`, `orientation`, `floors` ni `form`. El producer usaba `{...building}` (spread) que sí los filtraba desde el dominio en-process, pero Zod stripaba los campos no declarados en `apps/web/src/worker/client.ts:504` —así que el navegador nunca los veía—. El harness `benchmark.worker.ts` (bypass Zod) sí los veía, lo que ocultaba la asimetría en los tests de rendimiento.

**Corrección.** Cinco campos geométricos añadidos a `economy.buildings[]` y a `economy.constructionSites[]`, con su schema Zod y su tipo TypeScript ([packages/shared/src/projection.ts:295-338](../../../packages/shared/src/projection.ts)). El producer sustituye el spread por un pick explícito ([packages/simulation/src/projection.ts:795-858](../../../packages/simulation/src/projection.ts)). El renderer usa `building.footprintCells` directamente y `building.parcelId` para la parcela, eliminando toda dependencia de `parcel.buildingId === building.id` en el camino de colocación ([apps/web/src/isometric/IsometricSpikeScene.ts:1055-1105](../../../apps/web/src/isometric/IsometricSpikeScene.ts)). El overlay (`drawOverlay`) y el color del inspector (`parcelOverlayColor`) usan la huella real y consideran todos los edificios de una parcela multi-edificio, no sólo el primero. `gameplayGeometryKey` considera una parcela "construida" si algún edificio existe en ella, no si `parcel.buildingId` es truthy.

Tres helpers puros nuevos sobre `GridCell[]`:
- `footprintBounds(cells)` — bounding box completo.
- `footprintVisualCenter(cells)` — centro geométrico del bounding box, fraccionario si la huella es par.
- `depthForFootprintCells(cells)` — celda físicamente más próxima a cámara.

El scene consume además un nuevo helper puro `buildingSpritePlan(economy, {archetypeFor, resolveVisual})` que devuelve exactamente una entrada por edificio y obra proyectados. Se prueba sin levantar Phaser.

**Prueba.** `apps/web/src/isometric/building-sprites.test.ts` (11 tests nuevos bajo `describe("H2-01 …")`) cubre helpers, paridad del plan, dos edificios de una parcela, obra desplazada y supresión aislada. `packages/simulation/src/h2-projection-footprint.test.ts` (5 tests) cubre la publicación Zod-safe en el viaje worker→navegador y el aislamiento por distrito observado.

### H2-02 · fallback procedural para los 15 BuildingType (P1) — `bed7914`

**Síntoma.** `BUILDING_DEFINITIONS` tiene 15 tipos. La factoría procedural cubría 11. `row_house`, `apartment_block`, `mixed_tenement` y `warehouse` sólo se pintaban si un Blender `bld_*` existía. Con `ASSETS.buildings[domainType] === undefined`, `resolveBuildingVisual` devolvía `null` y `place` abortaba silenciosamente. El contrato del propio helper en `IsometricSpikeScene.ts:1107-1110` afirmaba "un edificio nunca desaparece por falta de un Blender", lo cual era falso en cuatro tipos.

**Corrección.** Cuatro ramas procedurales nuevas en `scripts/generate-runtime-assets.mjs`, cada una con silueta propia diferenciada por forma, escala y altura aparente sobre la gramática isométrica base. `domainFootprint` coherente con `targetFootprintCells`: `row_house` 4×1, `apartment_block` 2×5, `mixed_tenement` 2×4, `warehouse` 3×4. El bundle se regenera y sube de 11 a 15 edificios: 146 583 → 181 985 bytes (91 % del budget Alpha de 200 KB), mayor SVG 1 816 bytes (budget 8 KB).

Además, el helper `resolveBuildingVisual` se extrae a `apps/web/src/isometric/building-sprites.ts` como función pura con cuatro argumentos y `options` inyectados. `IsometricSpikeScene.resolveBuildingVisual` pasa a ser una envoltura delgada que inyecta `ASSETS_BLENDER`, `ASSETS`, `this.textures.exists` y `SCENE_AZIMUTH`.

**Prueba.** `apps/web/src/assets.test.ts` se reescribe para derivar el catálogo de `BUILDING_DEFINITIONS`, no de una lista mantenida a mano: "cada tipo de dominio → tiene entrada en el manifiesto" y "cada tipo → `domainFootprint.width × height === targetFootprintCells`". `apps/web/src/isometric/building-sprites.test.ts` (11 tests nuevos bajo `describe("H2-02 …")`) corre el helper con un `blenderBundle = { buildings: {} }` y comprueba que los 15 tipos resuelven una textura procedural válida en los cuatro estados.

### H2-03 · orientación de dominio vs azimut de cámara (P2 deuda) — `fcb4a15`

**Auditoría.** `Building.orientation ∈ {0, 90, 180, 270}` es la rotación física del sólido dentro de la parcela, la elige `chooseFootprint` según el eje largo. `RuntimeAssetManifestV2.allowedOrientations ⊂ {45, 135, 225, 315}` es el azimut de cámara para el que existe un frame. Son dos vocabularios disjuntos: ningún valor está en ambos.

`SCENE_AZIMUTH = 45` es una constante de módulo, no deriva del dominio, y el renderer no lee `Building.orientation` en ninguna parte del camino `simulation → projection → archetype → Blender → procedural`. El bundle procedural declara `[45]` con `symmetry: "none"` para los 15 tipos; la ruta Blender entra vía `fromRuntimeAssetManifestV1` que fuerza `[45]` y `symmetry: "none"`.

**Decisión: opción B.** El arte disponible no tiene frames laterales para los edificios, así que no hay forma honesta de conectar la orientación física con la visual sin inventar rotaciones. Se fija con test que:

1. `resolveBuildingVisual` tiene aridad cuatro y ninguno de los argumentos es `orientation`; la firma no puede consultarla aunque quisiera.
2. `buildingSpritePlan` tampoco la recibe: dos edificios con el mismo tipo pero `orientation = 0` vs `90` comparten `textureKey` y difieren en `cells` (bounding box).
3. Los dos conjuntos de valores son disjuntos.
4. El bundle procedural declara `[45]` y `symmetry: "none"` para los 15 tipos: los azimuts 135/225/315 están explícitamente prohibidos.

La representación visual de la orientación física queda registrada como deuda P2 en `ai-context/KNOWN-GAPS.md`. Si en el futuro se añaden frames laterales al bundle, el helper puede ganar un quinto argumento `orientation` sin tocar el resto del contrato.

### H2-04 · harness `pnpm services:balance` y baseline (P1 evidencia) — `9284434`

Se añade un gate de observabilidad nuevo, determinista sobre las doce seeds canónicas
([packages/simulation/src/city-fixtures.ts:30](../../../packages/simulation/src/city-fixtures.ts)),
que registra por servicio y por seed: parcelas marketables, desarrolladas, edificios privados
no-ruin, tenants ocupados, facilities, authored/effective capacity, demanda, servidas, cobertura
%, saturadas, unreachable demand, capacidad no usada, coste de viaje p50/p95, cobertura por
distrito, `theoreticalCapacityCoverage`, `actualCoverage` y `strandedCapacity`. Guarda en
`docs/execution/phase-4/vd-h2-service-baseline.json`.

Dos helpers nuevos de observabilidad sobre `rawCoverage` en
[packages/simulation/src/facility-coverage.ts](../../../packages/simulation/src/facility-coverage.ts):
`facilityServiceDistanceReport(state, service)` (coste canónico por parcela antes de capacidad) y
`listFacilitiesForService(state, service)`. Ninguno cambia la regla de juego: exponen la
información que la caché ya tenía.

Medido en `3f3c707` con la demanda antigua (todas las marketables):

| service | demand | capacity | coverage | saturated | stranded |
|---|---:|---:|---:|---:|---:|
| security | 716 | 100 | 14 % | 2/2 | 0 |
| fire | 716 | 100 | 14 % | 2/2 | 0 |
| health | 716 | 300 | 42 % | 3/3 | 0 |
| education | 716 | 450 | 62 % | 2/3 | 6 |
| market | 716 | 300 | 42 % | 3/3 | 0 |
| parks | 716 | — | 54 % | — | — |
| transport | 716 | — | 96 % | — | — |

Una ciudad nueva con **cero edificios privados** ya nace con 12 de 14 facilities saturadas. Es
el hallazgo que H2-05…H2-09 tenían que resolver, no una constante `25` demasiado baja.

### H2-05 · demanda = parcela desarrollada (P0) — `bddc88d`

**Síntoma.** `facilityCoverageIndex` trataba toda parcela marketable como demanda desde el tick
inicial, tanto si tenía edificios como si estaba en el plano catastral vacío. La ciudad no podía
expresar "el crecimiento aumenta la demanda" porque la demanda ya estaba al máximo antes de
construir el primer solar.

**Causa de raíz.** Se confundían ACCESSIBILITY ("¿puede esta parcela llegar al servicio?") y
ACTIVE DEMAND ("¿cuánta capacidad está usando realmente la ciudad?").

**Corrección.** Nueva definición de demanda activa: una parcela marketable con al menos un
Building privado no-ruin cuenta una unidad; una vacante, cero. Es un proxy conservador y
determinista, no un modelo demográfico —esa sería una Beta, declarada en D-094 y KNOWN-GAPS—.
Parks y transport siguen midiéndose sobre todas las marketables porque son radios de
accesibilidad, no consumo de slots.

La caché del índice obtiene una cuarta firma, `demandSignature`, que enumera canónicamente los
`parcelId` con edificios privados activos. Construir en una parcela inválida el índice pero NO
invalida la firma de geometría: Dijkstra permanece cacheado, igual que con un cambio de
presupuesto o de disponibilidad.

**Prueba.** `packages/simulation/src/h2-demand-follows-development.test.ts` (11 tests): una
ciudad nueva tiene cero demanda y cero saturación en los cinco capacity services; poner un
edificio dispara una unidad; quemarlo regresa la parcela a vacante; los edificios municipales no
generan demanda; una vacante conserva parks/transport pero no consume security ni fire; el
rollup por distrito divide entre demandantes, no entre marketables; la demanda crece
monótonamente con el desarrollo; la caché responde a la firma de demanda sin invalidar la de
geometría; la asignación no depende del orden de inserción de Maps.

**Regeneración de golden.** Un solo digesto cambia, `city:200-parcels:month-boundary`, de
`c6a317866f27ad1a` a `b58283d43f7fd764`. Atribución medida: la Voronoi sobre 200 parcelas
desarrolladas en lugar de 716 marketables cambia `services` y `marketValue` en el cierre
mensual. Los otros nueve casos quedan idénticos bit a bit (atribución completa en
[packages/simulation/src/tick-conservation.test.ts:245-259](../../../packages/simulation/src/tick-conservation.test.ts)).

### H2-06 · asignación capacity-aware determinista (P0) — `6e69d85`

**Síntoma.** "Primero la facility de menor coste (Voronoi); después su capacidad". Una parcela
cuyo primer destino estuviera lleno o sin edificio operativo quedaba sin servir, aunque otra
facility alcanzable tuviera hueco. No había spillover.

**Corrección.** Se generan todos los pares (parcel, facility, cost) alcanzables, se excluyen
facilities con `effectiveCapacity === 0`, se ordenan canónicamente por `cost asc → parcelId asc
→ facilityId asc` y se recorre la lista asignando mientras la parcela no esté servida y la
facility tenga hueco. La Voronoi se conserva como dato de reporte (`demand` = parcelas para las
que esta facility es primera opción); `served` = lo que realmente admite, incluyendo spill-in de
vecinos saturados.

No depende del orden de inserción de Maps, no reconstruye Dijkstra cuando cambia la
disponibilidad y no introduce min-cost-flow óptimo si el greedy canónico cumple las bandas.

**Prueba.** `packages/simulation/src/h2-capacity-aware-assignment.test.ts` (5 tests): A a coste 4
sin capacidad + B a coste 6 con capacidad → la parcela se sirve en B; quemar un edificio reasigna
sin invalidar `geometrySignature`; ambas llenas → la demanda queda sin servir, sin inventar
rutas; dos estados con el mismo contenido y Maps en orden inverso dan el mismo índice; con
presupuesto a 0 la capacidad efectiva desaparece y ninguna parcela tiene seguridad.

**Ajuste de tests H1.** `h1-service-availability.test.ts`: quemar *una* de las dos comisarías ya
no baja la cobertura citywide porque el spill reasigna al vecino. Se reenfoca: la facility
destruida deja de servir (`report.served === 0`) y, para ver el efecto global, se quema la red
entera. `h1-land-value.test.ts`: mismo razonamiento, se actualiza "destruir la comisaría" por
"destruir la red de comisarías".

### H2-07 · capacidad por servicio, no constante global (P1) — `d79c19e`

`DEMAND_UNITS_PER_CAPACITY = 25` imponía que una cohorte de policía, bomberos, clínica, colegio y
mercado sirvieran exactamente las mismas 25 parcelas. No hay razón de dominio: los cinco tipos
tienen arquitecturas, ratios de uso y programas municipales distintos.

**Derivación medida** sobre las doce seeds canónicas y los cuatro escenarios (initial / 25 % /
50 % / 75 %). Los valores calibrados:

| service | cohortes × facilities | × X | cap total | cov @ 25 % | cov @ 50 % | cov @ 75 % |
|---|---:|---:|---:|---:|---:|---:|
| security | 4 | 75 | 300 | 100 % | 83 % | 55 % |
| fire | 4 | 75 | 300 | 100 % | 83 % | 55 % |
| health | 12 | 25 | 300 | 100 % | 83 % | 55 % |
| education | 18 | 17 | 306 | 100 % | 85 % | 56 % |
| market | 12 | 25 | 300 | 100 % | 83 % | 55 % |

Al 50 % los cinco caen en la banda 60–90 %; al 75 %, en 45–80 %. `parks` y `transport` quedan
fuera: no son capacity services. El programa municipal (2/2/3/3/3) **no** se toca.

### H2-08 · escenarios 25/50/75 % y bandas de balance (P1 evidencia) — `d79c19e`

El harness `pnpm services:balance` se amplía con cuatro escenarios deterministas: `initial`,
`25_percent`, `50_percent`, `75_percent`. `growCity(state, percent)` coloca edificios privados
`courtyard_home` hasta alcanzar el objetivo, ordenando parcelas por `districtId` y `parcelId`
para que el escenario sea reproducible. No altera topología, no simula meses ni altera seeds: es
un harness de balance, no una simulación temporal.

Las bandas de H2-08 se evalúan sobre la mediana de `actualCoverage` de los cinco capacity
services, no sobre cada seed individual. `SERVICES_BALANCE_BANDS=0` desactiva las aserciones
para la corrida de calibración; por defecto están activas.

El escenario `75_percent` muestra **tensión real**: security/fire/health/market al 55 % y
education al 56 %. No se parchea a ojo; la banda 45–80 % lo acepta y el player ve saturación
local al construir en la zona equivocada de la ciudad.

### H2-09 · respuesta suave al presupuesto (P1) — `c05ac5f`

La fórmula anterior
`Math.floor((facilityCapacity × level) / 100) × demandUnitsPerCapacity` truncaba a cohortes
ENTERAS antes de multiplicar: una comisaría con capacity 2 y demandUnits 75 pasaba de 150 slots
al 100 % a 0 al 49 %, con un salto discreto de 0 → 75 al 50 %.

Se sustituye por `Math.floor(facilityCapacity × demandUnitsPerCapacity × level / 100)`. Sigue
siendo aritmética entera y determinista, pero el presupuesto modula UNIDADES DE SERVICIO, no
bloques de facility. Con los mismos parámetros la curva es monotónica y suave:

| level | 100 % | 75 % | 50 % | 25 % | 0 % |
|---|---:|---:|---:|---:|---:|
| slots | 150 | 112 | 75 | 37 | 0 |

**Prueba.** `h2-service-capacity-calibration.test.ts` (2 tests): la respuesta es monotónica estricta
en los cinco niveles; 49 % devuelve 73 slots (no 0) y 1 % devuelve 1 (no 0); 100 % da 150 (no
saltos de 0 → cohorte completa). Los diez digestos dorados quedan idénticos: al 100 % las dos
fórmulas dan el mismo número.

### H2-10 · cobertura potencial de parcelas vacantes (P1) — `7117919`

Las parcelas vacantes dejan de consumir capacidad (H2-05), pero el jugador las ve en el mapa,
las compra y las valora. Se distinguen tres conceptos que antes se confundían:
`ACCESSIBILITY` (¿puede llegar?), `ACTIVE LOAD` (¿está usando un slot?) y `POTENTIAL SERVICE`
(¿habría hueco si construyo?).

`FacilityCoverageIndex` expone `potentialByParcelId` —sólo parcelas sin edificio privado— y
`ViewProjectionV2.economy.parcels[i].potentialService` lo publica en la interfaz. El cálculo se
hace después del greedy: si una facility alcanzable tiene capacidad residual, la parcela ve
potencial = 100. No reserva slot: dos solares contiguos pueden apuntar al mismo hueco.

`land-value.ts` no cambia: `services` sigue consultando `CoverageIndex` (disponibilidad
operativa), no el potencial. Quemar una comisaría hace caer `serviceCoverage.security`; el
potencial no revaloriza artificialmente el suelo.

**Prueba.** `packages/simulation/src/h2-potential-service.test.ts` (8 tests): una vacante sin
edificios cercanos tiene potencial pero carga cero; una desarrollada no aparece en
`potentialByParcelId`; quemar la red deja a las vacantes sin potencial de seguridad; llenar la
capacidad reduce el potencial; el potencial no reserva slots; la proyección publica el campo
junto a `serviceCoverage`; `land-value` sigue respondiendo a disponibilidad, no al potencial.

### H2-11 · reconciliación D-093 con el comportamiento real (documental) — `08afec7`

`h1-land-value.test.ts` declara explícitamente `civicAmenities = proximidad geométrica` y
`services = disponibilidad operativa`, y comprueba que quemar una comisaría cambia `services`
pero no `civicAmenities`. Sin embargo D-093 §7 decía "la amenidad la aporta el equipamiento
alcanzable, no una suma paralela", frase que podía leerse como "las amenidades cívicas se
absorben en `services`". Nunca fue así.

Se corrige D-093 §7 con la redacción correcta: lo que H1-09 eliminó fue el **doble conteo
semántico** —antes ambos canales medían proximidad geométrica—, y las dos componentes siguen
conviviendo como términos ortogonales del desglose de nueve. Las entradas condensadas en
`ai-context/DECISIONS.md` y `ai-context/KNOWN-GAPS.md` se reescriben en coherencia. El resto del
cuerpo de D-093 se conserva sin cambios.

**Prueba.** Se añade una novena entrada en `h2-potential-service.test.ts`: `civicAmenities` es
invariante bajo quemar la red de comisarías entera; `services` puede bajar pero nunca subir
artificialmente; la suma de las nueve componentes sigue dando `rawScore`.

## Determinismo

Los diez digestos dorados de `tick-conservation.test.ts` sólo se regeneraron una vez, en H2-05,
con atribución medida sobre `city:200-parcels:month-boundary` (Voronoí de 200 vs 716 parcels en
el cierre mensual). H2-06, H2-07, H2-08, H2-09 y H2-10 conservan el resultado económico bit a
bit de H2-05: las cuatro correcciones afectan a la **cobertura y capacidad**, no a caja,
transacciones, incidentes ni hogares en esos diez escenarios.

Ninguna seed, constante económica, límite morfológico o guard de jugabilidad por perfil se ha
tocado para conseguir un verde.

## Problemas nuevos que H2 destapa (N1…N4)

### N1 · el Voronoí clásico ya no representa el modelo vigente

`FacilityCoverageReport.demand` se mantiene como "parcelas cuya primera opción es esta facility",
pero desde H2-06 el greedy puede asignar a otra. La UI muestra `demand` como si fuera carga
asignada; desde H2-06 eso es una lectura parcial. Queda como deuda P2 para Beta: reetiquetar el
inspector con `served` (carga real) y `attempted` (Voronoi), o fusionarlos en un término nuevo.

### N2 · una parcela con N edificios vale 1 unidad de demanda

H2-05 documenta la aproximación Alpha. En una parcela con dos edificios residenciales, cada
edificio tiene sus propios tenants, pero el índice cuenta UNA unidad. En Beta debería ponderarse
por residentes, floors, usos o superficie. No se introduce ahora porque el plan lo prohíbe
expresamente: "NO introduzcas esos modelos ahora".

### N3 · el bundle procedural llega al 91 % del budget Alpha

181 985 / 200 000 bytes. Añadir un quinto tipo de dominio fuera de la tabla obligaría a declarar
un nuevo número en `docs/art/RUNTIME-ASSETS.md` o a reabrir el presupuesto. Es una decisión
futura, no una deuda actual.

### N4 · cold graph hitch sigue vivo

La primera corrida de `facilityCoverageIndex` sobre una ciudad nueva construye el grafo una vez
(~312 ms p95 medidos en V.d.5, reproducibles en H1) y las siguientes reutilizan la caché. No
afecta a los gates ni al presupuesto de mature close, pero sigue siendo una interrupción
observable. Se conserva como deuda declarada y no se ha optimizado cambiando reglas.

## Suite

| Suite | Tests | Duración |
|---|---:|---:|
| shared | 50 | ~1.5 s |
| simulation | ~460 (incluye 12 nuevos H2-05, 5 nuevos H2-06, 7 nuevos H2-07/08/09, 9 nuevos H2-10/11, 5 nuevos H2-01) | ~10-11 min |
| web | 120 (31 nuevos en `building-sprites.test.ts` H2-01/H2-02/H2-03, 8 nuevos en `assets.test.ts` H2-02) | ~11 s |
| arquitectura (check-architecture.mjs + fixtures negativos) | pass | ~1 s |

<!--TABLES-PENDING-->
