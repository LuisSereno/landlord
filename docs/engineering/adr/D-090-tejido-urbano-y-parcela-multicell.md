# D-090 — Tejido urbano autoritativo: manzanas, parcelas multi-cell y normativa separada

Estado: ratificada el 2026-10-28 por el responsable para V.d.1 y V.d.2, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. Manzanas, parcelas multi-cell, códigos urbanísticos y autocolocación.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

## Contexto

`Parcel` hoy es un punto con etiqueta
([packages/shared/src/domain.ts:261](packages/shared/src/domain.ts)):

```ts
type Parcel = { id; districtId; cell: GridCell; price; zoning; ownerOrganizationId; buildingId | null }
```

Tres cosas se siguen de ahí y explican la mitad de los problemas de legibilidad de V.d:

- **La parcela no tiene geometría.** No hay frente, no hay fondo, no hay cobertura posible. Un solar
  de 8×18 m y una parcela de 30×30 m son indistinguibles para el motor.
- **`zoning` es una etiqueta, no una norma.** El enum es `residential | industrial | mixed`
  ([packages/shared/src/domain.ts:157](packages/shared/src/domain.ts)). No dice pisos máximos,
  cobertura, FAR ni retranqueos, así que "aquí se puede construir más alto que allá" no es expresable.
- **`buildingId` es una relación inversa duplicada.** `Building.parcelId` ya existe. Mantener las dos
  obliga a sincronizar, y una parcela con dos edificios terminados es literalmente imposible.

D-085 ya dejó el terreno preparado sin tocar estas tres cosas: midió 989/989 parcelas con frente vial
y concluyó que "la construcción de producto es parcela-scoped y nunca mira celdas". Eso era verdad **y
por eso era inofensivo**; V.d lo convierte en el problema central, porque ahora la huella sí mira
celdas.

## Decisiones

### 1. Cadena geométrica completa y autoritativa

`red vial → manzana → parcela → huella`, cada eslabón con celdas propias y conexidad exigida:

- `RoadTopology` mantiene la forma del contrato de D-085: segmentos ortogonales y **una única**
  derivación de celdas (`roadCellsFromSegments`). Renombra el tipo a `RoadTopology`, conserva
  `topologyVersion: 1` y sube `derivationVersion` a 2, porque cambia el *cómo se producen* los
  segmentos (desde `RoadAnchor[]` en vez de desde parcelas ya colocadas), no el *qué significan*.
- `Block` es un componente conexo de suelo desarrollable, separado por vías y obstáculos. Se forma
  por flood fill, no por retícula.
- `Parcel` es un subconjunto conexo de una manzana, con al menos un frente vial y geometría canónica.
- `Building.footprintCells` es la huella, dentro de la parcela y fuera de los retranqueos.

Ningún eslabón se deriva del siguiente hacia atrás. La lección explícita de D-085 (la ordenación
"los impares son calzada" era falsa) se generaliza: **las estructuras que se infieren del orden de
descubrimiento se vuelven deuda en cuanto cambia el generador.** Por eso los IDs de bloque y parcela
se derivan del distrito y de su geometría canónica, no de un contador de recorrido.

### 2. Parcela multi-cell, un solo `ParcelId` visible

El picking puede caer en cualquier celda de la parcela y debe resolver un único `ParcelId`. Es la
regla que impide que la granularidad geométrica se convierta en microgestión: el jugador sigue
comprando **una** parcela, no un conjunto de celdas.

### 3. Normativa como dato, no como condicional

`DevelopmentCode` separa lo permitido (`allowedUses`, `maxFloors`, `maxCoveragePercent`,
`maxFloorAreaRatioPercent`, setbacks) de lo existente (`currentUses`). Se declara con enteros y
porcentajes enteros, sin floats, por la misma razón que D-060 fijó para la aritmética económica: los
floats en reglas autoritativas hacen que el determinismo dependa del orden de evaluación.

`LandUse` reemplaza a `Zoning` con ocho valores (`residential`, `retail`, `office`, `industrial`,
`civic`, `education`, `health`, `utility`). `UrbanRole` es la **función del bloque**
(`mixed_core`, `commercial_corridor`, `industrial_logistics`, …): el rol decide el código, el código
decide qué se puede construir, y ninguno de los dos decide qué se construyó.

Tres niveles porque colapsarlos vuelve a producir el error actual: hoy `zoning` hace las tres cosas.

### 4. Autocolocación determinista de la huella

`PLAN_improvements.md` §3.3: el motor enumera candidatos, los puntúa y elige el mejor. El jugador no
coloca celdas. Empate resuelto por orientación, `y`, `x` y firma de huella en orden canónico.

Esto es deliberadamente lo contrario de un city builder de colocación libre, y la justificación es de
gobernanza, no de gusto: AGENTS.md pregunta "¿añade una decisión significativa o sólo más
microgestión?". Colocar cada celda de cada edificio es microgestión pura a escala de nueve distritos.
Lo que sí es decisión de jugador es **qué parcela comprar, qué tipo promover y en qué distrito**.

### 5. Una parcela admite varios edificios, pero una sola obra activa

Relación real (un solar con varias naves) sin permitir obras simultáneas que convierten el registro de
`ConstructionSite` en una lista de espera incomprensible. `ACTIVE_SITE_ON_PARCEL` es el rechazo
explícito.

### 6. Issues estructurales, no fallos silenciosos

El generador emite `BLOCK_UNASSIGNED_CELLS`, `PARCEL_WITHOUT_ROAD_FRONTAGE`, `GATEWAY_NOT_CONNECTED`,
`PUBLIC_RESERVATION_INVALID`, etc., reintenta con attempt seed derivada (máximo doce por distrito,
precedente de D-064) y, si no converge, el error identifica ciudad, distrito, seed e issues. Un
distrito generado sin frente vial es peor que un generador que falla: el jugador lo carga, no puede
construir y no sabe por qué.

## Consecuencias en el motor

`Parcel.buildingId` es leído hoy por construcción, impuestos, préstamos, subastas, seguros,
automatización, vivienda, facciones y proyección. V.d.2 los refactoriza a índices derivados
(edificios por parcela, huellas ocupadas por parcela, edificios por distrito, parcelas por bloque).
Esos índices son **derivados y reconstruibles**, no persistidos: persistirlos sería la segunda verdad
que D-085 prohibió para las celdas de vía.

## Alternativas descartadas

- **Parcela multi-cell pero `buildingId` único.** Conserva la duplicación y hace imposible el programa
  municipal (colegio = edificio + patio, mercado = nave + plazas).
- **Zonificación raster por celda** (cada celda con su uso). Más expresión espacial y ningún modelo
  mental posible para el jugador: no hay parcela que comprar ni normativa que leer.
- **Colocación libre de edificios por el jugador.** Choca con la regla 4 y con AGENTS.md.

## No decide

- Alturas automáticas por "downtown": la altura surge de código + valor + tipo + parcela (§V.d.4).
- Traza de vía variable, carriles, sentidos o tráfico: excluidos por §1 del plan.
- Que el jugador pueda editar el código urbanístico: no hay capability política en V.d.

## Adiciones respecto a `PLAN_improvements.md`

El plan fija la cadena geométrica, la norma como dato, la autocolocación y las reglas de obra. Esta
ADR añade que los índices derivados (edificios por parcela, huellas ocupadas, edificios por distrito,
parcelas por bloque) **no se persisten**, por coherencia con la prohibición de D-085 de guardar una
segunda verdad derivable. El plan no lo dice; se marca como decisión propia.

## Implementación V.d.1 (2026-10-28)

La cadena `RoadAnchor[] → RoadTopology → Block → Parcel` está implementada en
`packages/simulation/src/urban-fabric.ts` y orquestada por `district-generator.ts`. La red se traza
sobre una retícula autoral de 3 o 4 líneas por eje y se conecta a gateways, centro cívico, corredores
comerciales, accesos industriales y spawns; las parcelas no participan en la derivación. Las manzanas
son componentes 4-conexos de suelo desarrollable; los componentes que superan el envelope se parten
con cortes guillotina deterministas convertidos en callejones (obstáculo, no vía). Las parcelas nacen
de frentes viales, crecen por BFS multi-fuente y las celdas huérfanas se asignan al vecino con mayor
borde común.

Adiciones de implementación, marcadas como propias:

- `UrbanFabricConfig.connectSpawns`: las recetas de baja densidad no conectan físicamente el spawn a
  la retícula. Es lo que mantiene la densidad en 23,07 km/km², dentro del envelope de su familia;
  con conector subía a 23,8 y lo rebasaba.
- Los `ParcelId` son ordinales en orden geométrico canónico, con las parcelas ancla primero. El plan
  exige que no dependan del descubrimiento; el orden de las anclas es autorado y conserva la
  continuidad económica de D-064.
- Una manzana completa por distrito se reserva como `PublicSpace` provisional (`blockId: null`) hasta
  V.d.3. No es el programa municipal: es el mecanismo mínimo para que la reserva pública exista y se
  valide desde V.d.1.
- Un guardado v2 anterior a V.d.1 se rechaza por nombre (`UNSUPPORTED_URBAN_FABRIC`), no se migra.
- `zoning` y `buildingId` permanecen en `Parcel` hasta V.d.2; retirarlos ahora habría obligado a
  refactorizar los consumidores dos veces.

Evidencia del gate en `docs/execution/phase-4/vd1-red-vial-manzanas-parcelacion-2026-10-28.md` y
`docs/execution/phase-4/vd1-fabric-gate.json`.

## Implementación V.d.2 (2026-10-28)

La norma se separa del uso existente: `Parcel` pierde `zoning` y `buildingId`, gana
`developmentCodeId` y `currentUses`; `Building` y `ConstructionSite` incorporan `districtId`,
`footprintCells`, `orientation`, `floors` y `form`. `BuildingDefinition.allowedZoning` se sustituye
por `allowedUses`, y el permiso guarda el código, los usos permitidos y los usos existentes en el
momento de decidir.

Los roles de bloque se asignan por bandas de centralidad (núcleo, intermedio, borde), frentes de
avenida, gateways y el rol dominante del perfil, con desempate por rango dentro de la banda para que
la mezcla no dependa de la paridad accidental de un recorrido. Las anclas autoradas conservan su uso
de referencia y pueden llevar un código propio distinto del código por defecto de su manzana: es una
excepción de continuidad económica, no una regla de composición.

La huella se autocoloca: el motor construye el envelope edificable (retranqueos de calle y laterales,
huellas existentes), enumera rectángulos, descarta los que exceden cobertura o FAR y elige el más
cercano al área objetivo con desempate por orientación, `y`, `x` y firma. Una parcela admite varios
edificios terminados, pero una sola obra activa (`ACTIVE_SITE_ON_PARCEL`).

Los índices `buildingsByParcel`, `buildingsByDistrict`, `footprintCellsByParcel` y `parcelsByBlock`
se reconstruyen desde `phase2.buildings` y `phase2.parcels`; no se persisten. `Parcel.buildingId` deja
de existir y sus lectores usan el índice derivado.

Los saves v2 anteriores a V.d.2 (parcela con `zoning`/`buildingId` o edificio sin huella) se rechazan
por nombre con `UNSUPPORTED_URBAN_FABRIC`; no se migran. La evidencia del gate está en
`docs/execution/phase-4/vd2-composicion-urbana-2026-10-28.md`.

## Implementación V.d.4 (2026-10-29)

La parcela separa `baseLandValue` (autorado e inmutable) de `marketValue` (dinámico). `price`
desaparece: compras, garantías, impuestos, valoración de activos y balance leen `marketValue`, y el
base queda sólo para auditoría. `land-value.ts` puntúa cada parcela marketable con los rangos enteros
del plan —centralidad vial, acceso comercial, amenidades, frente, potencial del código, servicios,
externalidad industrial, aislamiento y variación por seed—, aplica el clamp −40…60 y mueve el valor
hacia `targetValue = floor(base × (100 + score) / 100)` como máximo un 5 % por cierre mensual. El
desglose se deriva en la proyección; no se persiste una segunda verdad.

El bloque de viviendas declara cinco plantas base: el código de corredor lo limita a cuatro y el
ensayo `corridor_density_trial` (+1 planta, +100 FAR, sólo `commercial_corridor`) permite la quinta.
El permiso congela esos bonus y la obra usa el código efectivo del permiso, de modo que el derecho
adquirido sobrevive a la expiración de la ordenanza; expirar no toca edificios ni obras existentes.
La autocolocación prefiere el frente principal y la continuidad con huellas de la misma parcela,
después de área objetivo y plantas.

El cálculo de distancias se cachea por geometría de distrito en un `WeakMap`: V.d.4 no muta la red,
las manzanas ni los equipamientos, y un save/load reconstruye el objeto de distrito. La caché de
cobertura por grafo sigue siendo responsabilidad de V.d.5.

Los saves v2 anteriores a V.d.4 (parcela con `price`) se rechazan por nombre
(`UNSUPPORTED_URBAN_FABRIC`) y no se migran. La evidencia del gate está en
`docs/execution/phase-4/vd4-densidad-skyline-valor-2026-10-29.md`.
