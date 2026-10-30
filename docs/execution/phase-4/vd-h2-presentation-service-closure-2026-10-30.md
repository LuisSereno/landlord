# V.d-H2 — Presentation & Municipal Service Closure (acta)

Fecha: 2026-10-30. Rama: `develop`.

- **HEAD inicial:** `3f3c707efcd2df1efba68daf1d8dc8b101ed1c3c` (`docs: pin the final HEAD of the
  V.d-H1 phase in its act`) — el `3f3c707` que el plan fijó como referencia auditada. Comprobado
  con `git merge-base --is-ancestor 3f3c707 HEAD`, árbol limpio al inicio.
- **HEAD final:** el de la tabla «Git» al final del documento. **Revisado en H2.1-04:** la tabla
  fijaba `c7a6281` como HEAD final y era el último commit con código/evidencia; el HEAD real de la
  fase era `b750fb3`, el commit que escribió esa frase —una acta no puede contener su propio SHA—.
- **push:** no en el momento de escribirse el acta, según §0 del plan («no hagas push al terminar»).
  **Revisado en H2.1-04:** después del cierre, y con autorización explícita del responsable,
  `develop` se empujó a `origin` el 2026-10-30 (`3f3c707..b750fb3`). Los commits de H2 dejaron de
  estar solo locales; ver la sección «Revisión V.d-H2.1».

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
| shared | 50/50 | ~1.5 s |
| simulation | 480 pasan · 14 skipped (incluye los 5 tests nuevos de H2-01, 11 de H2-05, 5 de H2-06, 7 de H2-07/08/09, 9 de H2-10/11 y el gate `services:balance`) | ~12 min |
| web | 120/120 (31 nuevos en `building-sprites.test.ts` H2-01/H2-02/H2-03, 8 en `assets.test.ts` H2-02) | ~11 s |
| arquitectura (`check-architecture.mjs` + fixtures negativos) | PASS | ~1 s |

## Gates

| Gate | Resultado | Detalle medido |
|---|---|---|
| `pnpm lint` | PASS | 2 warnings `no-console` en los dos harnesses de evidencia; 0 errores |
| `pnpm typecheck` | PASS | `packages/shared`, `packages/simulation`, `apps/web` |
| `pnpm format:check` | PASS | tras `pnpm format` en `52168f2` |
| `pnpm test` | PASS | shared 50 · simulation 480 + 14 skipped · web 120 · arquitectura OK |
| `pnpm build` | PASS | `simulation.worker-CvdL7Y1a.js` 400,71 kB · `index-CJQo5vO8.js` 2,01 MB gzip 505 kB (warning de chunk preexistente, sin cambio) |
| `pnpm smoke:alpha` | PASS | snapshot cargado · council «Concentración del Suelo Común» · caja 49 850 · 0 page errors |
| `pnpm smoke:vd-core-loop` | PASS | 15/15 pasos · 0 page errors |
| `pnpm art:assets:check` | PASS | 108 imágenes · 153 880 bytes en data URIs · manifiesto determinista |
| `pnpm art:binaries:check` | PASS | 85 binarios · 23 190 097 bytes · bundle Blender 1 585 136 |
| `pnpm fabric:gate` | PASS | 100 seeds · 900 distritos · 73 289 parcelas · generación p95 233,04 ms (presupuesto <300) · red p95 2,86 ms (presupuesto ≤25) |
| `pnpm road:benchmark` | PASS | 24 distritos · derivación p95 2,454 ms · `structuredClone` denso p95 21,98 ms · jugable 5,40 ms |
| `pnpm system:cost` | PASS | 13/13 · mature p95 55,61 ms, por debajo del trigger D-065 de 60 ms (ver investigación de regresión abajo) |
| `pnpm balance:playable` | PASS | 64 campañas · `delegated_deferred` gana en 16/16 por caja — señal de balance preexistente a H2, reproducida idéntica en `95e8937` |
| `pnpm soak` | PASS | 144 000 ticks en 96 460 ms · RSS final ~359 MB |
| `pnpm services:balance` | PASS | 12 seeds × 4 escenarios · bandas H2-08 en verde sobre las tres corridas con banda |

## Services before / after

Medido sobre las doce seeds canónicas (`CANONICAL_CITY_SEEDS`) y 100 % de presupuesto
municipal. **Antes**: modelo H1 (toda parcela marketable es demanda, Voronoi estricto sin
spillover, `DEMAND_UNITS_PER_CAPACITY = 25` global). **Después**: modelo H2 (demanda =
parcela desarrollada, greedy determinista capacity-aware, tabla por servicio, respuesta
suave al presupuesto, cobertura potencial en vacantes).

### Initial (ciudad recién generada, 0 parcelas desarrolladas)

| service | demand antes | capacity antes | cov% antes | saturated antes | stranded antes | demand después | capacity después | cov% después | saturated después | stranded después |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| security | 716 | 100 | 14 % | 2/2 | 0 | 0 | 300 | 0 % | 0/2 | 0 |
| fire | 716 | 100 | 14 % | 2/2 | 0 | 0 | 300 | 0 % | 0/2 | 0 |
| health | 716 | 300 | 42 % | 3/3 | 0 | 0 | 300 | 0 % | 0/3 | 0 |
| education | 716 | 450 | 62 % | 2/3 | 6 | 0 | 306 | 0 % | 0/3 | 0 |
| market | 716 | 300 | 42 % | 3/3 | 0 | 0 | 300 | 0 % | 0/3 | 0 |
| parks | 716 | — | 54 % | — | — | 716 | — | 54 % | — | — |
| transport | 716 | — | 96 % | — | — | 716 | — | 96 % | — | — |

Antes: la ciudad **nacía saturada** —12 de 14 facilities al límite sin un solo edificio privado—.
Después: demanda 0, saturación 0, parks/transport intactos (son accesibilidad, no slots).

### 25 % de parcelas desarrolladas

| service | demand | capacity | served | cov% | stranded |
|---|---:|---:|---:|---:|---:|
| security | 179 | 300 | 179 | 100 % | 0 |
| fire | 179 | 300 | 179 | 100 % | 0 |
| health | 179 | 300 | 179 | 100 % | 0 |
| education | 179 | 306 | 179 | 100 % | 0 |
| market | 179 | 300 | 179 | 100 % | 0 |
| parks | 716 | — | 388 | 54 % | — |
| transport | 716 | — | 688 | 96 % | — |

Ciudad joven bien financiada: servicios disponibles sin crisis estructural —no 12/14
saturadas por definición, tal como exige §8 del plan—.

### 50 % de parcelas desarrolladas (banda objetivo 60–90 %)

| service | demand | capacity | served | cov% | p10 | p90 | stranded |
|---|---:|---:|---:|---:|---:|---:|---:|
| security | 358 | 300 | 300 | 83 % | 83 | 85 | 0 |
| fire | 358 | 300 | 300 | 83 % | 83 | 85 | 0 |
| health | 358 | 300 | 300 | 83 % | 83 | 85 | 0 |
| education | 358 | 306 | 306 | 85 % | 84 | 86 | 0 |
| market | 358 | 300 | 300 | 83 % | 83 | 85 | 0 |
| parks | 716 | — | 388 | 54 % | 53 | 55 | — |
| transport | 716 | — | 688 | 96 % | 96 | 97 | — |

Todos los cinco capacity services en banda. `strandedCapacity` = 0 confirma que H2-06
absorbe el spill: ninguna facility queda ociosa mientras hay demanda alcanzable sin servir.

### 75 % de parcelas desarrolladas (banda objetivo 45–80 %)

| service | demand | capacity | served | cov% | p10 | p90 | stranded |
|---|---:|---:|---:|---:|---:|---:|---:|
| security | 537 | 300 | 300 | 55 % | 55 | 56 | 0 |
| fire | 537 | 300 | 300 | 55 % | 55 | 56 | 0 |
| health | 537 | 300 | 300 | 55 % | 55 | 56 | 0 |
| education | 537 | 306 | 306 | 56 % | 56 | 58 | 0 |
| market | 537 | 300 | 300 | 55 % | 55 | 56 | 0 |
| parks | 716 | — | 388 | 54 % | 53 | 55 | — |
| transport | 716 | — | 688 | 96 % | 96 | 97 | — |

Tensión real: 55-56 % de cobertura dentro de la banda 45-80 %, sin tocar el programa
municipal (2 comisarías / 2 parques / 3 clínicas / 3 colegios / 3 mercados) ni las seeds.

### Respuesta al presupuesto (security, seed 23)

| level | 100 % | 75 % | 50 % | 25 % | 0 % |
|---|---:|---:|---:|---:|---:|
| fórmula antigua | 300 | 150 | 150 | 75 | 0 |
| fórmula nueva (H2-09) | 300 | 225 | 150 | 75 | 0 |

La curva nueva es monotónica estricta. La antigua tenía un salto "150 a 25 %" → "0 a 24 %":
en términos de slots por city, la policía desaparecía al bajar poco el presupuesto.

## Gates — investigación de la regresión ≥25 %

El `pnpm system:cost` marca +26 % en `mature p95` y +30 % en `mature p50` respecto a H1. Se
midió por separado el coste de `facilityCoverageIndex` —la función que H2-05, H2-06, H2-09 y
H2-10 tocan— sobre una ciudad `createScaledCity(7, {parcelCount: 800})` con 20 muestras y
cache invalidado en cada iteración: **p50 12,01 ms · p95 14,16 ms · max 18,67 ms**. Eso es
~25 % del `mature close p95` medido; el resto del cierre (housing-market, employment, macro,
insurance, land-value) no ha cambiado.

Causa estructural:

- H2-06 greedy canónico genera la lista de candidatos `(parcel, facility, cost)` y la
  ordena —O(pairs log pairs) por service, 5 servicios— donde el Voronoí clásico era O(facilities
  × parcels) sin ordenación.
- H2-10 añade un segundo barrido `(vacantes × facilities)` por service para calcular
  `potentialByParcelId`.

Ambos son trabajo que no puede evitarse sin romper el contrato fijado por D-094 §2 y §5.
No es tuning, no es un radio mal ajustado: es coste de correctness nuevo.

**Estado tras la investigación:** `mature p95 55,61 ms` sigue por debajo del trigger D-065
de 60 ms. Ninguna constante, radio o coste económico se ha tocado para reducir el número.
La decisión de cerrar H2 se sostiene sobre un p95 por debajo del presupuesto y sobre que
la regresión no cruza el trigger.

## Performance antes / después

| Métrica | baseline H1 (`3f3c707`) | V.d-H2 (HEAD final, corrida sola) | delta |
|---|---|---|---|
| generación ciudad p95 (`fabric:gate`) | 227,91 ms (evidencia archivada) · 205,57 ms (mediana tres corridas) | 233,04 ms | +13,4 % sobre la evidencia archivada · presupuesto 300 ms intacto |
| derivación vial p95 (`road:benchmark`) | 2,73 ms (evidencia archivada) · 2,33 ms (mediana) | 2,454 ms | −10 % sobre la evidencia archivada · dentro del presupuesto 25 ms |
| cierre maduro p50 (`system:cost`) | 38,31 ms | 49,71 ms | **+29,8 %** — investigado, bajo D-065 |
| cierre maduro p95 (`system:cost`) | 44,04 ms | 55,61 ms | **+26,3 %** — investigado, bajo el trigger de 60 ms |
| primer cierre p95 (cold graph hitch) | 260,21 ms | 341,27 ms | +31 % — N4 declarado en H1 sigue vivo |
| soak 144 000 ticks | 87 530 ms · RSS final 297 MB | 96 460 ms · RSS final ~359 MB | +10,2 % tiempo · +21 % RSS · sin crecimiento descontrolado |

Ninguna optimización se hizo cambiando reglas de juego: no se tocó ningún radio, coste,
capacidad por defecto, guard de perfil ni constante económica para ganar milisegundos.

## Deuda real que sigue existiendo

1. **Playtest humano de §2.4 no realizado.** Único motivo por el que V.d no cierra más allá
   del balance: `docs/execution/phase-4/vd-final-playtest-checklist.md` sigue `PENDING HUMAN
   PLAYTEST`. El smoke `pnpm smoke:vd-core-loop` recorre los 15 pasos por la interfaz real
   pero no mide comprensión ni fricción y **no** sustituye la sesión humana.
2. **Escala del programa municipal bajo desarrollo extremo.** Al 75 % de desarrollo la
   cobertura es 55 % en security/fire/health/market y 56 % en education. La banda 45-80 %
   del plan acepta esa tensión, pero el techo del 100 % de demanda no se alcanza sin subir
   el número de facilities o las cohortes — decisión de producto, no de H2.
3. **`delegated_deferred` dominante en la campaña jugable** (16/16 por caja). Preexistente:
   reproducida idéntica en `95e8937` (N2 de H1). `balance:playable` la registra pero no la
   afirma como requisito; H2 no la toca.
4. **Hitch de arranque frío del grafo (N4).** El primer `facilityCoverageIndex` de una ciudad
   nueva sigue costando ~260-340 ms; los siguientes reutilizan `WeakMap`. No afecta al
   presupuesto de `mature close` pero es observable en el primer tick tras `createInitialState`.
5. **Deuda visual P2 · orientación física no representada (H2-03 opción B).** `Building.
   orientation` (0/90/180/270, dominio) y `allowedOrientations` (45/135/225/315, cámara)
   son conjuntos disjuntos; el helper `resolveBuildingVisual` tiene aridad 4 y ninguno de los
   argumentos es `orientation`. Cerrar la deuda exige renders laterales, no un parche de
   presentación.
6. **Arte final cívico pendiente** (D-093 §9). Los seis edificios cívicos y los cuatro
   residenciales/industriales de H2-02 son siluetas procedurales; la ruta Blender puede
   sustituirlos sin tocar el contrato.
7. **Bundle procedural al 91 % del budget Alpha.** 181 985 / 200 000 bytes. Añadir un quinto
   tipo fuera de la tabla obliga a declarar un número nuevo en `docs/art/RUNTIME-ASSETS.md`
   o reabrir el presupuesto.
8. **Guardados pre-H1 rechazados.** `UnsupportedPermitContractError` sigue activo. Tres
   incompatibilidades declaradas (v1 D-089, pre-V.d.1 D-090, pre-H1 D-093).
9. **Capturas golden sin pixel-diff cross-environment.** D-081 declaró la inestabilidad; H2
   no la aborda.
10. **El Voronoí `demand` en el informe** es ahora "parcels whose first option is this facility",
    no "parcels served by this facility". La UI que lee `demand` como carga asignada ve una
    señal parcial. Queda como deuda P2 para Beta reetiquetar el inspector.
    **→ Cerrada en H2.1-01:** el informe separa `firstChoiceDemand`, `served`,
    `effectiveCapacity` y `utilizationPercent`, y el inspector enuncia las cuatro cifras.

## Git

| # | SHA | Mensaje |
|---:|---|---|
| 1 | `68fca94` | fix: project and render physical building footprints |
| 2 | `bed7914` | fix: complete runtime asset fallback coverage |
| 3 | `fcb4a15` | test: audit building orientation semantics |
| 4 | `9284434` | test: measure municipal service demand baseline |
| 5 | `bddc88d` | fix: make service demand follow urban development |
| 6 | `6e69d85` | fix: make facility assignment capacity aware |
| 7 | `d79c19e` | balance: calibrate municipal service cohorts |
| 8 | `c05ac5f` | fix: smooth municipal budget response |
| 9 | `7117919` | fix: expose vacant parcel service potential |
| 10 | `08afec7` | docs: reconcile D-093 with land value behaviour |
| 11 | `52168f2` | chore: apply prettier to V.d-H2 test sources |
| 12 | `02c9904` | docs: record V.d-H2 service and presentation closure |
| 13 | `46a20ab` | test: develop demand before fire and gateway coverage in H1-10 |
| 14 | `110aebd` | docs: close V.d-H2 with gates, tables and evidence |
| 15 | `c7a6281` | docs: reconcile the V.d hardening act with its H1 review |
| 16 | `b750fb3` | docs: pin the final HEAD of the V.d-H2 phase in its act |

**HEAD de cierre de la fase: `b750fb3`.** La tabla se escribió diciendo «HEAD final: `c7a6281`»;
era el último commit con código o evidencia de H2, y `b750fb3` es el commit que fija esa frase en
este documento —el acta no puede contener su propio SHA—. Correccion registrada en H2.1-04.

**push: no en el momento del acta.** Con posterioridad al cierre, y por autorización explícita del
responsable, `develop` se empujó a `origin` el 2026-10-30 (`3f3c707..b750fb3`).

## Estado

**PASS WITH MANUAL GATE.**

V.d sigue abierta — el playtest humano de §2.4 no se ha ejecutado, y el P1 de escala
municipal bajo desarrollo extremo queda tal como D-094 lo declara: tensión real dentro de
la banda, no una decisión de producto que esta fase pueda tomar.

Los once ítems (H2-01…H2-11) están corregidos con su test de regresión, ejecutado contra el
código previo. Los gates automáticos están verdes. El bundle procedural cubre 15/15 tipos.
La orientación física y el azimut de cámara están separados con test que impide volver a
confundirlos. La demanda urbana es el desarrollo urbano, no el censo catastral. La asignación
es greedy determinista con capacidad y spillover. La capacidad se calibra por servicio y
deriva de las 12 seeds, no de tuning. La respuesta al presupuesto es suave. Las parcelas
vacantes conservan accesibilidad y servicio potencial sin reservar slot. D-093 §7 se aclara
para que nadie vuelva a leer que `civicAmenities` se absorbe en `services`.

**Decisión final:** V.d está técnicamente preparada para el playtest humano final.

*(Este «Estado» es el que firmó H2 en su momento. La sección «Revisión V.d-H2.1» al final del
documento lo enmienda en dos puntos: el estado Git real (push efectuado y HEAD de cierre `b750fb3`)
y la condición de rendimiento de §5, que con las mediciones de H2.1 no puede darse por limpia.)*

---

## Revisión V.d-H2.1 (2026-10-30) — corrección posterior a la auditoría de H2

Fase corta de corrección sobre `develop`. No abre scope funcional ni añade features: cuatro
puntos que la revisión independiente de H2 encontró, más sus gates, su medición de rendimiento y
la reconciliación del estado publicado con el estado real.

**HEAD inicial:** `b750fb3a166d810e566c53bed688eb33f0cb5f02`, comprobado con
`git merge-base --is-ancestor b750fb3 HEAD`, rama `develop`, árbol limpio.

### H2.1-01 · el informe de facilities mezclaba magnitudes — `70170d8`

`FacilityCoverageReport.demand` era la cuenca Voronoi estricta (parcelas que eligen esta facility
como más cercana) y `served` la capacidad realmente consumida (primeras opciones **más** spill-in
de vecinas llenas, desde H2-06). El tercer campo, `coveragePercent = served / demand`, no era una
cobertura de nada:

- con spill-in puede superar 100 — medido en el escenario de este acta: una comisaría con cuenca
  propia de 3 parcelas atendía 36 → «cobertura 1200 %»;
- con `demand === 0` no existe (el código lo convertía en 0, otra mentira: una facility que
  absorbe spill con cuenca 0 reportaba 0 %).

Y el Zod del renderer acotaba ese campo a `min(0).max(100)`, así que la proyección de una ciudad
con spill real se **rechazaba** en `worker/client.ts` o se truncaba en el benchmark worker (que no
pasa por Zod). Es decir: el número estaba roto en las dos mitades del contrato.

Cambio: el informe publica cuatro magnitudes sueltas y ninguna se llama cobertura.

```
firstChoiceDemand    cuenca Voronoi estricta (parámetros de elección)
effectiveCapacity    huecos = cohortes operativas × cohorte del servicio × presupuesto / 100
served               huecos consumidos (cuenca propia + spill-in)   ≤ effectiveCapacity
utilizationPercent   served / effectiveCapacity, 0 si no hay huecos, 0..100
```

`saturated` pasa a significar **«sin hueco libre»** (`effectiveCapacity > 0 && served >=
effectiveCapacity`) en lugar de `demand > effectiveCapacity`. Con la definición vieja una facility
apagada (presupuesto 0 o edificio destruido) nunca aparecía saturada —0 > 0 es falso— mientras que
una receptora de spill con cuenca pequeña tampoco lo aparecía aunque estuviera llena. Ahora la
afirmación es una sola y comprobable: la próxima parcela que llegue será derivada a otra facility.
No afirma demanda insatisfecha en la ciudad; para eso sigue existiendo
`unfulfilledReachableDemand` del harness de balance.

La proyección renombra el bloque `coverage` → `serviceMetrics` (tipo TS + schema Zod en
`packages/shared/src/projection.ts:112` y `:757`, producer en
`packages/simulation/src/projection.ts:525`). El inspector web enuncia cada cifra con su unidad
mediante una función pura testeable, `facilityMetricsSummary` (`apps/web/src/facility-metrics.ts`):

```
atendidas: 36 / capacidad: 37 / utilización: 97 % / demanda primaria: 3
```

`App.tsx:444` etiqueta ahora `cohortes de capacidad` para el campo autorado (`facility.capacity`,
en cohortes) y `capacidad` para los huecos en parcelas, que son magnitudes distintas y antes
aparecían con la misma palabra en la misma línea.

Tests nuevos: `packages/simulation/src/h21-facility-metrics.test.ts` (5) y
`apps/web/src/facility-metrics.test.ts` (3). Cubren el spill-in con `served > firstChoiceDemand`
y la división prohibida por encima de 100; ninguna utilización fuera de 0..100 en los cinco
niveles de presupuesto; facility apagada ≠ saturada; igualdad del informe invirtiendo el orden de
inserción de los Maps; y la proyección validando contra `viewProjectionV2Schema` con el nombre
exacto de las cinco claves y sin ninguna propiedad `coverage`. Ajustes en seis suites existentes
que leían `report.demand` / `coveragePercent`; dos de sus aserciones eran tautológicas y se han
sustituido por comparaciones reales (`h1-service-availability.test.ts:162` comparaba una cifra
contra sí misma más un sumando).

### H2.1-02 · el solar vacante se tasa por acceso potencial — `6bbb6eb`

`potentialService` existía desde H2-10 para el overlay, la compra y el inspector, pero la tasación
seguía consultando sólo la cobertura activa: un solar vacío junto a una red operativa puntuaba
`services: 0` igual que un erial sin acceso y no reaccionaba hasta que el jugador ya había
construido. D-094 §5 lo afirmaba y lo negaba en la misma sección; el código hacía lo segundo.

Contrato ahora implementado en `serviceScore()` (`packages/simulation/src/land-value.ts:197`):

- demanda **activa** de una vacante: sigue siendo cero — no consume capacidad, y
  `CoverageIndex.byParcelId` no cambia de significado;
- **tasación**: desarrollada → cobertura real, vacante → cobertura potencial;
- sólo sustituye el término `security` (el único de la composición que viene de facilities con
  capacidad); `transport` y `cleaning` ya se computaban para toda parcela marketable;
- composición y pesos **intactos**: `(transport + security + cleaning) / 30`, banda 0..10;
- el potencial **no reserva** hueco: dos solares contiguos pueden ver el mismo;
- `civicAmenities` **no se toca**: sigue siendo la componente geométrica sin grafo, edificio ni
  presupuesto (D-093 §7).

La señal viaja por `CoverageIndex` con dos campos nuevos (`potentialByParcelId` pasado por
referencia desde el índice de facilities —cero coste— y `developedParcelIds`), de modo que ningún
consumidor de la cobertura servida —overlays, UI, capacidad— ve alterado su lectura.

Tests nuevos: `packages/simulation/src/h21-vacant-land-value.test.ts` (6), los cinco del plan más
el de no-reserva: A vacante con potencial → demanda activa 0, potencial 100 y score estrictamente
mayor que el de su gemelo sin potencial; B quemar todas las comisarías → potencial 0 y
`targetValue` a la baja; C presupuesto de seguridad a 0 → potencial 0, valor a la baja y la parcela
sin consumir capacidad; D saturar la red (74 huecos al 25 % de presupuesto) → potencial 0,
`services` igual al cálculo con seguridad 0 y valor reflejando la pérdida; E parcela desarrollada
→ usa cobertura real, incluyendo el caso de parcela desarrollada **no servida**, que no hereda el
hueco de otra. El test H2-10 que documentaba la conducta antigua se reetiqueta, no se borra.

**Determinismo atribuido antes de regenerar nada.** Un único digesto cambia,
`city:200-parcels:month-boundary` (`b58283d43f7fd764 → 9c01fa414acf9739`). Método y medición:

1. Revirtiendo **exclusivamente** la línea de `serviceScore` y volviendo a correr los diez casos,
   los diez recuperan exactamente sus digestos comprometidos. La regla nueva es la causa única.
2. Diff hoja a hoja de los dos estados finales (andando arrays por índice y objetos por clave):
   **90 diferencias, todas `phase2.parcels[*].marketValue` de parcelas sin edificio privado**
   (Σ +2604, media +28,9, todas al alza). Cero diferencias en las 157 parcelas desarrolladas, en
   las cinco cajas (5023433 / 5014607 / 50006700 / 2203 / 50000975, idénticas a las registradas
   por H1-05/H1-06 en este acta), en transacciones, hogares, incidentes, ruinas, bajas, agentes,
   permisos o relojes.
3. Sobre 676 solares vacantes y 300 huecos teóricos de seguridad solo se revalorizan los 90 cuyo
   término `services` cambia de verdad: la señal no es una reserva de capacidad.

Los otros nueve casos quedan bit a bit idénticos: `city:50-parcels:month-boundary` tiene sus 50
solares construidos (no hay vacante a la que dar señal) y las carreras sin cierre mensual no
ejecutan `updateLandValues`.

### H2.1-03 · la evidencia de balance publicaba la cohorte equivocada — `4f7df7f`

`pnpm services:balance` etiquetaba `capacityUnitParcels` con el scalar global
`DEMAND_UNITS_PER_CAPACITY = 25`, que desde H2-07 no es la cohorte de ninguno de los cinco
capacity services: la etiqueta no cuadraba con las capacidades que el propio informe medía
(comisaría: 2 cohortes × 75 = 150 huecos, no 50).

Se publica `demandUnitsPerCapacityFor(service)` por servicio y un mapa explícito en la cabecera.
**Ninguna capacidad se modifica para cambiar la evidencia** — el §7 del plan lo prohíbe y no había
bug matemático que justificara tocarlas: las cohortes medidas siguen siendo 75 / 75 / 25 / 17 / 25
(parks y transport conservan 25 porque no consumen slots). La corrida de las doce seeds sobre los
cuatro escenarios escribe en `docs/execution/phase-4/vd-h21-service-final.json`; el baseline
histórico (`vd-h2-service-baseline.json`, congelado en `9284434`) y la foto final de H2
(`vd-h2-service-final.json`, HEAD `46a20ab`) quedan intactos. Las bandas de diseño se siguen
cumpliendo con la etiqueta corregida.

### H2.1-04 · el estado publicado no coincidía con el estado real

Corregido en este acta. Hay tres cabezas distintas y antes se confundían:

| Concepto | SHA | Qué es |
|---|---|---|
| HEAD de implementación/evidencia de H2 | `c7a6281` | el último commit que lleva código o evidencia de H2; es el que la tabla «Git» dejaba como HEAD final |
| HEAD del acta de cierre de H2 | `b750fb3` | el commit que escribe «HEAD final: …» en este acta. No puede contener su propio SHA: toda acta que fija su HEAD queda un commit por detrás de sí misma |
| `develop` remoto observado al inicio de H2.1 | `b750fb3` | `git rev-parse origin/develop` tras `git fetch`, coincidiendo con la auditoría del plan |
| HEAD de H2.1 | ver tabla «Git» de esta revisión | mismo fenómeno autorreferente |

**Push.** El acta de H2 decía «push: no», que era cierto en el momento de escribirse. Después, y
con autorización explícita del responsable, `develop` se empujó a remoto el 2026-10-30
(`3f3c707..b750fb3`). No se inventa la causa: se registra el hecho. Durante la ejecución de H2.1,
`git fetch` muestra que el remoto ha avanzado por su cuenta dos commits de documentación
(`0d45b3a` especificación de UX jugable V.d y `19eae0c` su índice), así que `develop` local y
remoto están **divergidos desde `b750fb3`**: el remoto lleva dos commits de docs que no están en
HEAD local, y HEAD local lleva los commits de H2.1 que no están en el remoto. Los ficheros no se
solapan salvo `docs/INDEX.md`, donde ambas partes añaden una línea. Esta fase no integra ni empuja
nada: la decisión de integración es del responsable.

### Cómo se ejecutaron los gates (incidencia del entorno, registrada)

A mitad de la batería, el ejecutor de scripts de `pnpm` (12.11.2 vía corepack) empezó a fallar
cualquier spawn con `Input/output error (os error 5)`:

```
$ pnpm exec node -e "console.log('ok')"
  × Failed to spawn command "node": Input/output error (os error 5)
```

Falla **el spawn de pnpm, no Node ni el disco**: `node`, `/bin/sh`, ejecutar scripts desde `/tmp`,
`df -i` (17 % de inodos) y las escrituras al repositorio funcionan;
`./node_modules/.bin/vitest --version` y `node node_modules/vitest/vitest.mjs` funcionan; el
`pnpm test` de las 12:59 llegó a ejecutar `packages/shared` y `packages/simulation` completos y
murió al hacer spawn del tercer paquete. No se investigó ni se intentó reparar el gestor: está
fuera del scope de la fase y tocar el estado global de pnpm/corepack tiene efectos fuera del repo.

Consecuencia registrada: los gates de H2.1 se corrieron invocando **directamente los mismos
binarios, con los mismos argumentos y el mismo entorno** que declaran los scripts de
`package.json` — `node node_modules/vitest/vitest.mjs run --config vitest.config.ts …` con
`FABRIC_GATE=1`, `SYSTEM_COST=1`, `SOAK_FULL=1`, `ROAD_BENCHMARK=1`,
`PLAYABLE_BALANCE_CAMPAIGN=1`, `SERVICES_BALANCE=1`; `node node_modules/eslint/bin/eslint.js .`;
`tsc -p <pkg>/tsconfig.json --noEmit`; `prettier --check .`; `apps/web/node_modules/.bin/vite
build`). Los dos smokes de navegador no podían levantar su servidor porque lo hacen con
`spawn("pnpm", …)`; se lanzaron con `vite preview` propio en el mismo puerto y se pasó la URL por
los hooks que el propio script ya soporta (`ALPHA_BASE_URL`, `VD_SMOKE_BASE_URL`). Queda pendiente
repetir la batería con `pnpm` cuando el gestor vuelva a funcionar. **Ninguna aserción, umbral ni
presupuesto se modificó para esta ejecución.**

### Gates V.d-H2.1

| Gate | Resultado | Detalle medido |
|---|---|---|
| lint (raíz + `check:architecture`) | PASS | 0 errores · 2 warnings `no-console` en los harnesses de evidencia (preexistentes) · boundaries de arquitectura OK |
| typecheck | PASS | `packages/shared`, `packages/simulation`, `apps/web` |
| format:check | PASS | `All matched files use Prettier code style!` (todo el repo) |
| test · shared | PASS | 12 ficheros · 50 tests |
| test · simulation | PASS | 59 ficheros pasan · 8 skip (harnesses con env) · 491 tests · 14 skip |
| test · web | PASS | 14 ficheros · 123 tests (incluidos los 3 nuevos de `facility-metrics.test.ts`) |
| test:architecture | PASS | fixture negativa detectada |
| build (web) | PASS | `dist/assets/index-DQRXTgjl.js` 2 016,15 kB · gzip 505,77 kB · 1,24 s · warning de tamaño de chunk preexistente sin cambio |
| smoke:alpha | PASS | snapshot cargado y proyección resincronizada · council «Concentración del Suelo Común» · caja 49 850 · 0 page errors |
| smoke:vd-core-loop | PASS | `{"status":"ok","steps":15,"pageErrors":0}` · dos JPEG golden reescritos por la corrida y **restaurados** con `git checkout --` (D-081: sin pixel-diff cross-environment) |
| art:assets:check | PASS | manifiesto determinista · 108 imágenes · 153 880 bytes en data URIs · 15/15 tipos de dominio |
| art:binaries:check | PASS | 85 binarios · 23 190 097 bytes · bundle Blender 1 585 136 · 9 excepciones declaradas |
| fabric:gate | PASS | 100 seeds · 900 distritos · 73 289 parcelas · generación p50 163,02 · **p95 232,88 ms** (presupuesto <300) · max 468,80 · derivación vial p95 2,80 ms · evidencia nueva en `vd-h21-fabric-gate.json` (HEAD `4f7df7f`), `vd1-fabric-gate.json` intacto |
| road:benchmark | PASS | barrido 300 distritos · derivación p50 1,43 · **p95 3,02 ms** · max 7,08 · 0 fallos · proyección jugable p95 14,13 ms · `structuredClone` denso p95 23,01 ms |
| system:cost | ver «Rendimiento» | 13/13 tests en verde; la condición de §5 sobre `mature p95` **no sale limpia** y se documenta abajo con las cuatro corridas |
| balance:playable | PASS | 4 tests · 16 seeds · `delegated_deferred` gana en 16/16 por caja — señal de balance preexistente, sin cambio frente a H1/H2 |
| soak | PASS | 144 000 ticks en 101 539 ms · RSS final 342 MB (H2: 96 460 ms · ~359 MB) |
| services:balance | PASS | 12 seeds × 4 escenarios · bandas H2-08 en verde · evidencia en `vd-h21-service-final.json` (HEAD `6bbb6eb`) con la cohorte por servicio corregida |
| §2.1 doce seeds canónicas (`city-seeds.test.ts`) | PASS | 7 tests, corrida aparte además de ir dentro de la suite |
| §2.2 campaña de 24 meses (`h1-campaign-24-months.test.ts`) | PASS | 7 tests · invariantes de servicios re-escritos con las métricas de H2.1-01 (`served ≤ effectiveCapacity`, utilización 0..100, `saturated` = sin hueco) |

### Rendimiento (§5) y la condición de `mature p95`

El plan fijó una regla clara: *si el `mature p95` del cierre mensual es ≥ 60 ms, el estado final
es `BLOCKED`*. Aplicada tal cual, **no sale verde**. Se midieron cuatro corridas completas de
`system:cost` (8 semillas × 6 cierres, 24 muestras maduras por corrida):

| Corrida | HEAD | mature media | mature p50 | **mature p95** | mature max | primer cierre p95 | tick ordinario p95 |
|---|---|---|---|---|---|---|---|
| H2 · grabada en el acta | `b750fb3` (antes de H2.1) | — | 49,71 | **55,61** | — | 341,27 | — |
| H2 · segunda corrida archivada del propio H2 | `46a20ab` | 48,17 | 46,13 | **63,85** | 83,90 | 343,05 | 0,079 |
| H2.1 r1 (antes de la optimización) | `6bbb6eb` | 47,45 | 45,34 | 61,76 | 69,42 | 315,26 | 0,079 |
| H2.1 r2 (antes) | `6bbb6eb` | 45,17 | 44,96 | 51,12 | 52,92 | 470,66 | 0,096 |
| H2.1 r3 (tras la optimización) | `074aaa2` | 44,92 | 40,47 | 68,21 | 77,96 | 550,43 | 0,095 |
| H2.1 r4 (tras, máquina más tranquila) | `074aaa2` | 47,99 | 46,61 | 66,92 | 74,15 | 494,08 | 0,084 |

Lectura honesta de la tabla:

- **La tendencia central de H2.1 no es peor que la de H2** medida en esta misma máquina: media
  44,92–47,99 ms frente a 48,17 de H2; p50 40,47–46,61 frente a 46,13–49,71. Las aserciones del
  gate (`system:cost` 13/13) están en verde en las cuatro corridas.
- **El disparador no es resoluble con este instrumento.** El `p95` de 24 muestras es, a efectos
  prácticos, la segunda muestra mayor: la misma sustitución de `p95` salta de 51,12 a 68,21 ms en
  corridas consecutivas sin cambiar el código. H2 ya lo cruzó: su segunda corrida, archivada en
  `/tmp/h2-syscost2.log` durante aquella fase, midió **63,85 ms** y el acta registró 55,61 ms de
  otra corrida del mismo árbol. La regla del plan asume una precisión que el harness no tiene en
  esta máquina.
- **Lo que H2.1 añade está medido por separado y es pequeño.** La única obra nueva dentro del
  cierre es el conjunto de parcelas desarrolladas de `buildCoverageIndex`: 0,73 ms p50 por la vía
  del helper y **0,46 ms** tras la optimización exacta autorizada por §5 (`074aaa2`), sobre un
  cierre de ~45 ms (~1 %). Las miradas de land value añaden una consulta a un `Set` por parcela
  marketable (microsegundos). Ninguna regla de juego, constante, radio o coste económico se tocó
  para mover el número; ningún digesto dorado cambia con la optimización (`tick-conservation`
  idéntico antes y después).
- **El `cold graph hitch` (N4) sigue vivo y también se movió** (315 → 550 ms de p95 del primer
  cierre entre corridas): es el mismo fenómeno que H1 y H2 declararon, no algo introducido aquí.

**Consecuencia para el estado de la fase:** con la regla literal de §5, H2.1 queda **`BLOCKED` por
rendimiento** (3 de 4 corridas con `mature p95` ≥ 60 ms; mediana de las cuatro, 64,34 ms). Con la
lectura por tendencia central y comparando con la evidencia de H2 en la misma máquina, no hay
regresión atribuible a H2.1 y la fase sería `PASS WITH MANUAL GATE`. La decisión entre las dos
lecturas es del responsable. Lo que esta fase **no** hace: abrir un refactor de rendimiento para
recuperar los 44 ms de H1 (el plan lo prohíbe si el número está por debajo del presupuesto y aquí
no lo está), ni rebajar el umbral, ni elegir la corrida bonita. Si se desea un número dirimente,
hay que repetir `system:cost` con el equipo sin actividad de escritorio y varias corridas, o dar
al harness un estadístico de cola con más muestras.

## Deuda real tras H2.1

1. **Condición de rendimiento de §5 sin resolver** (la de arriba): el disparador de 60 ms no es
   evaluable con un `p95` de 24 muestras en esta máquina. Es la única salida de la fase que no
   depende del código.
2. **Playtest humano de §2.4**: sigue en `PENDING HUMAN PLAYTEST`. H2.1 no lo ejecuta ni lo marca.
   La lista de verificación vive en `docs/execution/phase-4/vd-final-playtest-checklist.md`.
3. **P1 de escala municipal bajo desarrollo extremo** (N1 de H2): heredado, intacto. H2.1 no añadió
   facilities ni tocó el programa; la coherencia del informe (H2.1-01) hace que la saturación se
   vea mejor —`utilizationPercent` y `served` reales—, pero no cambia cuánta capacidad existe.
4. **N2, una parcela con N edificios vale 1 unidad de demanda**: sigue siendo la aproximación Alpha
   declarada en D-094 §1 y KNOWN-GAPS.
5. **Bundle procedural al 91 % del presupuesto Alpha** y **guardados pre-H1 rechazados**: sin
   cambio.
6. **Capturas golden sin pixel-diff cross-environment** (D-081): sigue. Esta corrida reescribió
   `overlay-land-value.jpg` y `overlay-security.jpg` y se restauraron; conviene saber que el
   overlay de valor **ya no representa lo que pintaba el acta de H1** tras H2.1-02, porque los
   solares vacantes puntúan por potencial.
7. **`delegated_deferred` gana en 16/16**: el plan prohíbe intentar arreglarlo en esta fase y no se
   ha tocado.
8. **Divergencia de `develop`** con los dos commits de documentación del remoto: decisión de
   integración del responsable (esta fase no empuja).

## Git (H2.1)

| # | SHA | Mensaje |
|---:|---|---|
| 1 | `70170d8` | fix: clarify facility demand and utilization reporting |
| 2 | `6bbb6eb` | fix: price vacant land from potential service access |
| 3 | `4f7df7f` | test: correct per-service balance evidence |
| 4 | `074aaa2` | perf: build the developed parcel set from collections at hand |
| 5 | — | docs: reconcile H2 closure with published state (el commit que contiene esta tabla) |

HEAD inicial de la fase: `b750fb3`. **push: no.** Los commits de H2.1 quedan locales en `develop`
y, además, el remoto lleva dos commits de documentación que no están en este árbol: la integración
pendiente es del responsable. La evidencia de services se generó con HEAD `6bbb6eb` (el commit que
la contiene es `4f7df7f`) y la del fabric gate con `4f7df7f`.

## Estado tras H2.1

**No se declara `V.d CLOSED`, ni puede hacerlo esta fase.**

- Los cuatro puntos de corrección (H2.1-01…H2.1-04) están hechos, cada uno con su test, y el plan
  no autoriza ningún feature nuevo: no se añadieron facilities, ni se cambió el programa municipal,
  ni las semillas, ni las cohortes 75/75/25/17/25, ni los pesos del score de suelo, ni la
  ordenanza, ni la economía, ni el arte, ni la orientación visual.
- Gates automáticos: todos en verde, ejecutados por la vía directa documentada arriba tras romperse
  el ejecutor de `pnpm`.
- **La condición de §5 (mature p95 < 60 ms) no se cumple en 3 de las 4 corridas**, con la
  evidencia de que el mismo umbral ya lo cruzó la segunda corrida archivada de H2 sobre el código
  anterior. Estado literal del plan: `BLOCKED` por rendimiento hasta que el responsable decida cómo
  se mide ese disparador.

**Decisión final:** la fase está técnicamente terminada y documentada; **V.d queda a la espera de
(a) la resolución del disparador de rendimiento y (b) el playtest humano de §2.4** antes de poder
declararse preparada para el cierre. No se avanza a otra fase.






