# Plan V.d — Ciudad multidistrito y tejido urbano autoritativo

## 1. Resultado esperado

Transformar Landlord desde un único distrito formado por parcelas puntuales en una ciudad determinista 3×3 compuesta por nueve distritos de 64×64 celdas, cada uno con:

- red vial autoritativa conectada mediante gateways;
- manzanas y parcelas multi-cell;
- usos, intensidad edificatoria y normativa separados;
- suelo público, plazas y parques persistentes;
- equipamientos municipales físicos;
- valor del suelo explicado por centralidad, accesibilidad, servicios y externalidades;
- mercados inmobiliarios diferenciados por distrito;
- servicios que recorren la red urbana;
- una vista estratégica de ciudad y un distrito activo renderizado;
- dressing visual derivado de la función urbana.

La simulación seguirá siendo completamente autoritativa, headless y determinista. Los nueve distritos avanzarán simultáneamente con detalle completo; sólo se introducirá LOD si los benchmarks vigentes demuestran que es necesario.

### Decisiones fijadas

- La escala física continúa siendo 4 m por celda.
- Cada distrito representa 256×256 m; la ciudad inicial ocupa aproximadamente 768×768 m.
- Ciudad inicial: nueve distritos organizados conceptualmente en una cuadrícula 3×3.
- Phaser renderiza un distrito activo; React ofrece la vista estratégica de ciudad.
- Todos los distritos están disponibles desde el inicio.
- No se conservará compatibilidad con snapshots Alpha v1.
- Los equipamientos públicos son generados y operados por el municipio.
- La huella de los edificios del jugador se calcula automáticamente de forma determinista.
- Vivienda, suelo, vacancia, demanda y puestos se miden por distrito; municipio, política, banca, salario base y macroeventos siguen siendo de ciudad.
- Los servicios pueden cruzar distritos mediante gateways.
- El benchmark morfológico real forma parte del gate.
- No se implementan perspectivas política/criminal jugables, tráfico, commuting individual ni una ciudad infinita.

## 2. Justificación de producto y límites

### Problema del jugador

Actualmente el mapa no permite comprender visualmente por qué un terreno es residencial, caro, accesible o estratégico. Las parcelas son puntos aislados y los servicios nacen de un centro abstracto. V.d debe convertir la localización en una decisión jugable:

- elegir entre suelo céntrico caro y periferia barata;
- valorar intensidad permitida frente a precio;
- explotar corredores comerciales o logísticos;
- anticipar externalidades industriales;
- reaccionar a cobertura municipal y cambios regulatorios;
- comparar oportunidades entre distritos.

### Encaje en el roadmap

Este trabajo no debe incorporarse silenciosamente a WP4.16. Es una ampliación estructural posterior al baseline Alpha actual y necesita un gate propio. Antes de cambiar generación, snapshots y balance se debe cerrar la evidencia pendiente de D-063 o registrar una nueva excepción explícita.

### Respuestas a las reglas de AGENTS.md

1. Resuelve legibilidad urbana, estrategia de localización y credibilidad del mundo.
2. Requiere un workstream nuevo V.d; excede el cierre técnico de WP4.16.
3. Añade decisiones de inversión y localización; la autocolocación evita microgestión.
4. Se implementa como generador, códigos urbanísticos, grafo y servicios reutilizables.
5. Toda generación y valoración se prueba por seed, perfil, versión y comandos.
6. Persisten ciudad, distritos, geometría, equipamientos, edificios y mercados distritales.
7. Se introduce `SnapshotV2`; los saves v1 se rechazan explícitamente.
8. No se copia geometría, edificios ni contenido de ciudades reales; sólo se usan métricas agregadas.
9. Las propiedades siguen perteneciendo a organizaciones independientes.
10. No se necesitan roles nuevos: el municipio genera/opera los equipamientos y el jugador actúa mediante el control empresarial existente.

## 3. Contratos y arquitectura objetivo

### 3.1 Estado autoritativo

Sustituir `GameState.map` y `phase2.district` singulares por:

```ts
type City = {
  id: CityId;
  name: string;
  municipalityOrganizationId: OrganizationId;
  layout: { columns: 3; rows: 3 };
  districtIds: DistrictId[];
  connections: DistrictConnection[];
  generation: {
    profileId: CityProfileId;
    generatorVersion: number;
    seed: Seed;
  };
};

type DistrictState = {
  district: District;
  map: {
    width: 64;
    height: 64;
    blockedCells: Set<string>;
    roads: RoadTopology;
  };
  blocks: Map<BlockId, Block>;
  publicSpaces: Map<PublicSpaceId, PublicSpace>;
};

type WorldState = {
  city: City;
  districts: Map<DistrictId, DistrictState>;
};
```

Parcelas, edificios, agentes, obras, inquilinos y organizaciones continuarán normalizados en mapas globales con IDs opacos. Toda entidad espacial incorporará o podrá resolver un `districtId`.

### 3.2 Nuevos IDs y entidades

Añadir IDs opacos y schemas para:

- `CityId`, `CityProfileId`;
- `BlockId`;
- `DevelopmentCodeId`;
- `PublicSpaceId`;
- `UrbanFacilityId`;
- `DistrictGatewayId`;
- `DistrictConnectionId`;
- `PermitId`.

Conservar `FacilityId` para `ProductionFacility`; usar `UrbanFacility` para evitar colisiones semánticas.

```ts
type UrbanRole =
  | "civic_core"
  | "mixed_core"
  | "commercial_corridor"
  | "urban_residential"
  | "low_density_residential"
  | "industrial_logistics"
  | "institutional"
  | "green_open_space";

type LandUse =
  "residential" | "retail" | "office" | "industrial" | "civic" | "education" | "health" | "utility";

type DevelopmentCode = {
  id: DevelopmentCodeId;
  allowedUses: LandUse[];
  maxFloors: number;
  maxCoveragePercent: number;
  maxFloorAreaRatioPercent: number;
  streetSetbackCells: number;
  sideSetbackCells: number;
};

type Block = {
  id: BlockId;
  districtId: DistrictId;
  cells: GridCell[];
  frontageRoadSegmentIds: string[];
  urbanRole: UrbanRole;
  defaultDevelopmentCodeId: DevelopmentCodeId;
};

type Parcel = {
  id: ParcelId;
  districtId: DistrictId;
  blockId: BlockId;
  cells: GridCell[];
  anchorCell: GridCell;
  roadFrontages: Array<{
    roadSegmentId: string;
    cells: GridCell[];
  }>;
  ownerOrganizationId: OrganizationId | null;
  disposition: "marketable" | "public" | "infrastructure";
  developmentCodeId: DevelopmentCodeId;
  currentUses: LandUse[];
  baseLandValue: Money;
  marketValue: Money;
  productionSuitability?: ProductionSuitability;
};
```

Eliminar `Parcel.cell`, `Parcel.zoning` y `Parcel.buildingId`. La proyección podrá publicar `buildingIds`, pero siempre como relación derivada desde `Building.parcelId`.

### 3.3 Edificios y construcción

Extender `Building` y `ConstructionSite` con:

```ts
districtId: DistrictId;
footprintCells: GridCell[];
orientation: 0 | 90 | 180 | 270;
floors: number;
form:
  | "detached"
  | "row"
  | "perimeter"
  | "shed"
  | "civic_landmark"
  | "pavilion";
```

Reglas:

- Una parcela admite varios edificios terminados.
- Sólo puede tener una obra activa simultánea durante V.d.
- Ninguna huella puede cruzar parcela, setback, vía, espacio público u otra huella.
- `StartConstruction` conserva `parcelId + buildingType`.
- El motor enumera candidatos, los puntúa y elige el mejor; el jugador no coloca cada celda.
- Desempate: orientación, `y`, `x` y firma de huella en orden canónico.
- Rechazos nuevos: `NO_BUILDABLE_ENVELOPE`, `COVERAGE_LIMIT`, `FAR_LIMIT`, `ACTIVE_SITE_ON_PARCEL`.
- Los permisos pasan a identificarse por `PermitId` y por combinación parcela/tipo de edificio; se consumen al iniciar la obra.

### 3.4 Equipamientos y espacios públicos

```ts
type PublicSpace = {
  id: PublicSpaceId;
  districtId: DistrictId;
  blockId: BlockId | null;
  kind: "plaza" | "park" | "pocket_park" | "civic_courtyard" | "schoolyard";
  cells: GridCell[];
  operatorOrganizationId: OrganizationId;
};

type UrbanFacility = {
  id: UrbanFacilityId;
  kind: "town_hall" | "school" | "clinic" | "police_station" | "fire_station" | "market";
  districtId: DistrictId;
  parcelIds: ParcelId[];
  buildingIds: BuildingId[];
  publicSpaceIds: PublicSpaceId[];
  operatorOrganizationId: OrganizationId;
  capacity: number;
  serviceProfileId: string;
};
```

Un equipamiento es una función operativa; sus edificios son objetos físicos. Esto permite colegio con edificio y patio, o mercado trasladable, sin confundir función con sprite.

### 3.5 Snapshot, protocolo y proyección

- Introducir `SnapshotV2` y `schemaVersion: 2`.
- Los snapshots v1 se rechazan con `UNSUPPORTED_SNAPSHOT_VERSION`; no se migran ni se borran automáticamente.
- IndexedDB debe mostrar que el slot es incompatible y ofrecer eliminación explícita.
- Incrementar el protocolo Worker a v2.
- Añadir petición técnica `SetObservedDistrict`; no será comando de dominio ni se persistirá.
- `ViewProjectionV2` publicará:
  - resumen de ciudad;
  - nueve resúmenes distritales públicos;
  - cartera propia por distrito;
  - mapa, parcelas, edificios, servicios y obras sólo del distrito observado;
  - economía, banca, política y municipio globales.
- La proyección nunca expondrá caja, estrategia o memoria privadas del rival.
- El cambio de distrito observado no altera `GameState`, PRNG, canonicalización ni resultados.

### 3.6 Mercados híbridos

- `HousingMarketState` contendrá `byDistrictId`.
- Cada distrito mantendrá vacancia, demanda, índices de renta y movilidad.
- `askingRentFor` usará primero el índice distrital; si hay menos de tres edificios comparables, usará el índice de ciudad; si tampoco existe muestra, usará 100.
- Cada buscador tendrá `marketDistrictId`; no habrá mudanza inter-distrito automática en esta fase.
- `EmploymentState` mantendrá puestos por distrito y salario base de ciudad.
- Política, municipio y macroeventos seguirán siendo únicos y ponderarán los nueve distritos.
- Inventarios de materiales siguen siendo organizacionales y globales; no se añade logística de almacenes.

### 3.7 Agentes y cuadrillas

- `Agent` y `Crew` deberán resolver su distrito actual.
- Pathfinding sigue siendo local al distrito.
- Añadir `TransferCrew` y `TransferAgent` para trasladar recursos operativos entre gateways.
- El traslado usa el grafo de ciudad, tiene duración determinista y deja agentes no disponibles mientras viajan.
- No tiene coste monetario inicial.
- Construcción, reparación y sabotaje exigen presencia en el distrito objetivo.
- La IA rival usa los mismos comandos.
- No se simulan peatones o vehículos atravesando físicamente nueve mapas.

## 4. Ciudad inicial y catálogos

### 4.1 Perfil de ciudad

Crear `ciudad_del_umbral_v1` con esta composición:

| Posición | Distrito                   | Función dominante            |
| -------- | -------------------------- | ---------------------------- |
| 0,0      | Lomas del Umbral           | residencial de baja densidad |
| 1,0      | Mercado del Norte          | corredor comercial y mixto   |
| 2,0      | Vega del Cauce             | residencial verde            |
| 0,1      | Barrio del Umbral          | residencial urbano           |
| 1,1      | Centro Cívico              | núcleo cívico y mixto        |
| 2,1      | Barrio del Taller          | mixto, talleres y comercio   |
| 0,2      | Ensanche Ferroviario Oeste | industria y logística        |
| 1,2      | Corredor Ferroviario       | mixto productivo             |
| 2,2      | Patios del Este            | industria y logística        |

El jugador comienza con su roster en Barrio del Umbral y el rival en Barrio del Taller. Todos los distritos son observables y comercialmente accesibles.

### 4.2 Códigos urbanísticos iniciales

| Código                   | Usos                        | Pisos | Cobertura |   FAR | Setback |
| ------------------------ | --------------------------- | ----: | --------: | ----: | ------: |
| `res_low_2f`             | residencial                 |     2 |      60 % | 120 % |       1 |
| `res_urban_4f`           | residencial                 |     4 |      80 % | 280 % |       0 |
| `mixed_core_5f`          | residencial, retail, office |     5 |      90 % | 400 % |       0 |
| `commercial_corridor_4f` | retail, office, residencial |     4 |      85 % | 320 % |       0 |
| `industrial_yard_2f`     | industrial, utility         |     2 |      65 % | 100 % |       1 |
| `institutional_3f`       | civic, education, health    |     3 |      70 % | 180 % |       1 |
| `civic_landmark_5f`      | civic                       |     5 |      75 % | 220 % |       0 |

Los porcentajes son enteros; no usar floats en reglas autoritativas.

### 4.3 Catálogo edificatorio mínimo

Conservar las cinco construcciones actuales y añadir:

- `row_house`;
- `apartment_block`;
- `mixed_tenement`;
- `warehouse`;
- `town_hall`;
- `school_block`;
- `clinic`;
- `police_station`;
- `fire_station`;
- `market_hall`.

Los cinco últimos son edificios municipales generados y no aparecen como opciones de construcción empresarial.

### 4.4 Programa municipal inicial

- 1 ayuntamiento y 1 plaza principal en Centro Cívico.
- 3 escuelas: Lomas, Barrio del Umbral y Vega.
- 6 parques/pocket parks: uno en cada distrito residencial o mixto prioritario.
- 2 comisarías: Centro Cívico y Barrio del Taller.
- 2 parques de bomberos: los dos extremos industriales.
- 3 clínicas: Centro Cívico, Barrio del Umbral y Vega.
- 3 mercados: Centro Cívico, Mercado del Norte y Barrio del Taller.

Las reservas se realizan antes de subdividir las manzanas. Si el programa no cabe, la generación completa del distrito se reintenta; nunca se omite silenciosamente un equipamiento obligatorio.

## 5. Plan de implementación

## Fase 0 — Baseline y benchmark morfológico

Estimación: 1–2 semanas.

1. Ejecutar y archivar lint, typecheck, tests, build, smoke Alpha, benchmark, coste por sistema y balance jugable.
2. Completar el playtest instrumentado de 30–60 minutos pendiente de D-063 o registrar formalmente una nueva excepción.
3. Etiquetar el baseline anterior a V.d para poder comparar economía, rendimiento y UX.
4. Crear ADRs para:
   - ciudad 3×3 y escala física;
   - snapshot/protocolo v2;
   - tejido urbano y parcela multi-cell;
   - mercados híbridos;
   - equipamientos y servicios espaciales.
5. Crear herramienta offline `tools/urban-benchmark` con OSMnx fijado por versión.
6. Construir 28 ventanas de referencia de 256×256 m:
   - cuatro ciudades industriales atlánticas: Liverpool, Manchester, Bilbao y Philadelphia;
   - siete familias: irregular histórica, ensanche, mixto denso, residencial bajo, borde industrial, ferroviario y centro cívico.
7. Extraer densidad vial, intersecciones, orientación, área de manzana, cobertura edificada, verde, equipamientos y mezcla funcional.
8. Versionar sólo:
   - manifest de muestras y fecha;
   - métricas agregadas;
   - envelopes por categoría;
   - attribution/provenance.
9. No incluir geometría OSM ni datos descargados en runtime. OSMnx permite extraer redes y features por bounding box; cualquier resultado derivado deberá conservar la atribución exigida por ODbL. [OSMnx](https://osmnx.readthedocs.io/en/stable/user-reference.html), [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

Gate:

- baseline reproducible y verde;
- corpus con 28 muestras y provenance;
- ningún dato externo forma parte del juego;
- envelopes aprobados para orientar parámetros, no para copiar layouts.

## V.d.0 — Contrato urbano y ciudad multidistrito

Estimación: 2–3 semanas.

1. Introducir los tipos descritos en la sección 3 en `@landlord/shared`.
2. Reestructurar `GameState` alrededor de `WorldState`.
3. Añadir `districtId` a agentes, estructuras técnicas y entidades espaciales que no puedan resolverlo por parcela.
4. Implementar `SnapshotV2`, protocolo v2 y rechazo explícito de v1.
5. Implementar `CityProfile` y el layout 3×3.
6. Derivar una seed independiente por distrito desde:
   `citySeed | cityProfileId | slotX | slotY | districtProfileId`.
7. Mantener el PRNG económico separado del PRNG de generación.
8. Implementar conexiones y gateways de ciudad:
   - un gateway compartido por cada par de distritos ortogonalmente adyacentes;
   - gateways en celdas de borde;
   - coste de conexión entero;
   - IDs derivados de los dos distritos y sus lados.
9. Implementar `SetObservedDistrict` y `ViewProjectionV2`.
10. Añadir vista React 3×3 con nombre, roles dominantes, renta, vacancia, valor del suelo, servicios, activos propios/rivales y alertas.
11. El renderer Phaser continúa mostrando sólo el distrito observado.
12. Añadir traslado determinista de cuadrillas/agentes.

Gate:

- misma seed produce la misma ciudad, gateways, IDs y nueve hashes;
- cambiar distrito observado no cambia el estado canónico;
- save/load v2 devuelve la misma cadena canónica;
- snapshots v1 fallan con mensaje comprensible;
- los nueve distritos avanzan simultáneamente;
- ningún observable privado aparece en resúmenes.

## V.d.1 — Red vial, manzanas y parcelación

Estimación: 3–4 semanas.

### Orden del generador v2

```text
CityProfile
→ gateways y anclas urbanas
→ corredores y red vial
→ manzanas/envelopes
→ reservas públicas
→ subdivisión parcelaria
→ ownership y validación
```

1. Mantener la forma del contrato vial: segmentos ortogonales y una única derivación de celdas.
2. Renombrar el tipo a `RoadTopology`, conservar `topologyVersion: 1` y elevar `derivationVersion` a 2.
3. Refactorizar el derivador para trabajar con `RoadAnchor[]`:
   - gateways;
   - centro cívico;
   - corredores comerciales;
   - acceso industrial;
   - spawns.
4. No derivar carreteras desde parcelas ya colocadas.
5. Mantener las optimizaciones y la semántica de D-085: road, obstacle, parcel y open siguen separados.
6. Formar manzanas mediante flood fill de suelo desarrollable separado por vías y obstáculos.
7. Para corredores abiertos, crear development envelopes a ambos lados hasta la profundidad máxima del perfil.
8. Dividir componentes excesivos mediante cortes deterministas sobre su eje largo.
9. Subdividir desde el frente hacia el interior:
   - detectar frentes;
   - crear semillas por anchura objetivo;
   - crecer hacia el fondo;
   - limitar área, profundidad y proporción;
   - unir celdas huérfanas al vecino con mayor borde común;
   - ordenar por geometría canónica.
10. Los IDs de bloque/parcela se derivan de distrito y geometría canónica; no del orden accidental de descubrimiento.
11. Añadir issues:

- `BLOCK_UNASSIGNED_CELLS`;
- `BLOCK_DISCONNECTED`;
- `PARCEL_DISCONNECTED`;
- `PARCEL_WITHOUT_ROAD_FRONTAGE`;
- `PARCEL_TOO_NARROW`;
- `PARCEL_TOO_DEEP`;
- `GATEWAY_NOT_CONNECTED`;
- `PUBLIC_RESERVATION_INVALID`;
- `FACILITY_SITE_INVALID`.

12. Reintentar con attempt seed derivada, máximo doce intentos por distrito; error final debe identificar ciudad, distrito, seed e issues.

Gate:

- 100 % de parcelas marketable con frente válido;
- cero solapes entre vía, obstáculo, parcela y espacio público;
- parcelas y manzanas internamente conexas;
- todos los gateways conectados a la red pública;
- sweep mínimo de 100 city seeds: 900 distritos sin fallos silenciosos;
- métricas de cada receta dentro del envelope morfológico correspondiente;
- generación total p95 inferior a 300 ms en el hardware de referencia;
- derivación vial por distrito mantiene el presupuesto de 25 ms de D-085.

## V.d.2 — Composición urbana y gameplay inmobiliario

Estimación: 3 semanas.

1. Sustituir pesos de `Zoning` por recetas de `UrbanRole`.
2. Asignar roles mediante:
   - centralidad vial;
   - proximidad al centro cívico;
   - avenidas y gateways;
   - borde industrial;
   - reservas verdes/institucionales;
   - transición con bloques vecinos.
3. Asignar `DevelopmentCode` desde el rol y el perfil.
4. Sustituir `allowedZoning` por `allowedUses`.
5. Actualizar permisos para registrar código urbanístico y usos en el momento de decisión.
6. Refactorizar construcción, impuestos, préstamos, subastas, seguros, automatización, housing, facciones y proyección para no leer `Parcel.buildingId`.
7. Implementar índices derivados:
   - edificios por parcela;
   - huellas ocupadas por parcela;
   - edificios por distrito;
   - parcelas por bloque.
8. Implementar autocolocación de huellas y validación de coverage/FAR.
9. Ampliar el catálogo edificatorio mínimo.
10. Dividir housing por distrito y empleo en puestos distritales + salario de ciudad.
11. La política municipal debe ponderar población efectiva de toda la ciudad.
12. La presión territorial de facciones debe usar bloques/frentes compartidos, no distancia artificial entre anchors.
13. Actualizar automatización:

- sólo ocupa edificios del distrito del buscador;
- sólo asigna cuadrilla local;
- si necesita otro distrito, crea una excepción en vez de teletransportar agentes.

Gate:

- comprar → permiso → construir → ocupar → cobrar funciona en los nueve distritos;
- varias construcciones terminadas pueden compartir parcela sin referencias rotas;
- coverage y FAR nunca se exceden;
- el mismo comando y seed producen la misma huella;
- dinero total, ownership, garantías y subastas conservan sus invariantes;
- housing usa fallback distrital/ciudad correctamente;
- no se introducen desplazamientos individuales ni commuting.

## V.d.3 — Ciudad cívica

Estimación: 2–3 semanas.

1. Reservar superlots y espacios públicos antes de parcelar.
2. Generar el programa municipal exacto de la sección 4.4.
3. Crear parcelas públicas propiedad del municipio y `disposition: public`.
4. Crear plazas/parques como `PublicSpace`, no como terreno decorativo.
5. Crear edificios físicos y enlazarlos con `UrbanFacility`.
6. Validar:
   - propiedad municipal;
   - operador existente;
   - edificios y parcelas en el mismo distrito;
   - acceso vial;
   - capacidad positiva;
   - relación facility↔building sin duplicados.
7. Bloquear compra, venta, garantía, subasta y construcción empresarial sobre suelo público.
8. Renderizar estados públicos, privados, vacantes, jugador, rival e infraestructura de forma distinta.
9. Añadir inspector de equipamiento con función, capacidad, operador, edificios y cobertura futura.
10. No añadir una capability política ni permitir que la empresa coloque equipamientos.

Gate:

- ayuntamiento/plaza siempre existen y son alcanzables;
- ningún equipamiento obligatorio desaparece por una seed;
- suelo público no es transferible ni hipotecable;
- el HUD apagado permite localizar centro cívico, parques y áreas institucionales;
- save/load conserva todas las referencias.

## V.d.4 — Densidad, skyline y valor del suelo

Estimación: 2–3 semanas.

### Valoración

Calcular un score entero por parcela:

- centralidad vial: 0…20;
- acceso comercial: 0…12;
- amenidades cívicas: 0…10;
- frente a avenida/calle: 6/3;
- potencial del DevelopmentCode: 0…12;
- servicios: 0…10;
- externalidad industrial: 0…−18;
- aislamiento: 0…−20;
- variación por seed: −3…3.

```text
score = clamp(-40, 60, suma)
targetValue = baseLandValue × (100 + score) / 100
```

Reglas:

- sólo aritmética entera;
- `marketValue` cambia como máximo ±5 % por cierre mensual;
- compras, garantías, impuestos y balance usan `marketValue`;
- conservar `baseLandValue` para auditoría;
- publicar `LandValueBreakdown` en inspector y overlay.

### Densidad

1. `DevelopmentCode` limita pisos, cobertura, FAR y setbacks.
2. `BuildingDefinition` declara footprint, pisos base, forma y usos.
3. La autocolocación prefiere frente principal y continuidad urbana.
4. Los edificios cívicos pueden sobresalir del gradiente mediante código específico.
5. Añadir una ordenanza original `corridor_density_trial`:
   - afecta sólo bloques `commercial_corridor`;
   - permite +1 piso y +100 puntos de FAR;
   - permisos emitidos durante su vigencia conservan el derecho adquirido;
   - al expirar no invalida edificios existentes.
6. No codificar `downtown => tall`; la altura debe surgir de código, valor, tipo y parcela.

Gate:

- el valor es reproducible y su desglose suma exactamente;
- centro, residencial e industria muestran bandas diferentes;
- una amenidad o recorte de servicio mueve valor en la dirección esperada;
- la ordenanza cambia oportunidades sin demoler ni invalidar activos;
- siguen existiendo entradas baratas, medias y premium en cada city seed aceptada;
- regenerar baseline jugable y verificar que ninguna estrategia domina por error.

## V.d.5 — Servicios espaciales

Estimación: 3 semanas.

1. Construir un grafo de viaje compuesto por:
   - celdas viales locales;
   - segmentos y clases;
   - gateways;
   - conexiones entre distritos.
2. Usar Dijkstra multi-source con costes enteros:
   - avenida: coste 1;
   - calle: coste 2;
   - conexión de gateway: coste configurado por `CityProfile`.
3. Cachear resultados por firma de topología, facilities, capacidad y presupuesto.
4. Invalidar cache sólo ante cambios espaciales o de nivel de servicio.
5. Sustituir la cobertura radial de seguridad por origen en comisarías.
6. Añadir:
   - bomberos: reduce progresión de daño/incendio mediante helper central;
   - salud: reduce tiempo de recuperación de heridos;
   - educación: amenidad de vivienda y suelo;
   - mercado: amenidad comercial;
   - parques/plazas: amenidad y calidad urbana.
7. Mantener excepciones deliberadas:
   - transporte es accesibilidad de red/gateways, no radio desde una estación;
   - limpieza continúa como red municipal sin edificio operativo;
   - administración procede del ayuntamiento pero no usa radio de cobertura.
8. La calidad presupuestaria municipal multiplica la capacidad efectiva de cada facility.
9. Asignar demanda en orden estable al facility alcanzable de menor coste; desempatar por ID.
10. No crear presupuesto por distrito: existe una única tesorería y un único orden de gasto municipal.
11. Publicar overlays de seguridad, fuego, salud, educación, transporte y valor.

Gate:

- rutas cruzan gateways y nunca atraviesan obstáculos;
- cerrar un gateway empeora únicamente las coberturas dependientes;
- capacidad saturada produce cobertura parcial explicable;
- recorte presupuestario reduce capacidad sin dinero implícito;
- incendio, lesión, vivienda y valor consumen un único helper por servicio;
- invariancia ante orden de Maps/arrays;
- benchmark equivalente sin regresión superior al 25 %;
- no implementar LOD si los umbrales D-052/D-065 siguen cumpliéndose.

## V.d.6 — Presentación y dressing contextual

Estimación: 3–4 semanas.

1. Evolucionar el adapter visual para consumir:
   - parcelas multi-cell;
   - blocks y urban roles;
   - public spaces;
   - building footprints;
   - facilities;
   - distrito observado.
2. La clave de geometría incluirá sólo topología espacial; caja, tick y reputación no provocan re-bake.
3. Añadir `RuntimeAssetManifestV2`:
   - orientaciones de edificios asimétricos;
   - footprints coherentes con dominio;
   - formas cívicas;
   - estados complete/construction/damaged/burning;
   - provenance por asset.
4. Producir assets mínimos para los nuevos edificios y espacios públicos mediante el pipeline Blender/Graphic Civic.
5. Aplicar dressing determinista:
   - árboles en parques y buffers residenciales;
   - bancos/papeleras en plaza, parques y corredores;
   - vehículos comerciales en corredores;
   - camiones y contenedores en industria;
   - iluminación según jerarquía vial;
   - service yards detrás de industria/equipamientos.
6. Los props decorativos permanecen derivados y efímeros; plazas, parques, edificios y facilities sí son autoritativos.
7. Añadir overlays:
   - propiedad/disposición;
   - uso;
   - DevelopmentCode;
   - valor del suelo;
   - servicios;
   - urban role.
8. Vista ciudad:
   - cuadrícula 3×3;
   - selección de distrito;
   - indicadores comparables;
   - alertas y cartera;
   - retorno al mapa sin reinicializar Phaser.
9. Actualizar picking para seleccionar cualquier celda de la parcela pero resolver un único `ParcelId`.
10. Añadir capturas golden de:
    - ciudad completa;
    - centro cívico;
    - residencial;
    - industria;
    - servicio saturado;
    - ordenanza de densidad.

Gate visual:

- con HUD oculto se distinguen centro, residencial, industria, verde, suelo público y parcelas comprables;
- no hay objetos sobre vías, huellas o espacios incompatibles;
- el distrito activo cambia sin fuga de sprites ni re-bake continuo;
- picking correcto a 0.5×, 1×, 2× y 2.5×;
- perfil denso mantiene el budget vigente;
- ningún asset copia identidad, layout o trade dress de otra IP.

## 6. Hardening, pruebas y cierre

Estimación: 2–3 semanas.

### Pruebas unitarias y de propiedades

- Schemas e IDs de todas las entidades nuevas.
- Conectividad de cells de blocks, parcels y public spaces.
- Canonicalización independiente del orden de inserción.
- Frente vial, coverage, FAR, setbacks y autocolocación.
- Grafo de gateways y rutas cross-district.
- Valor del suelo y límites mensuales.
- Capacidad y saturación de facilities.
- Relaciones building→parcel y facility→buildings.
- Rechazo de operaciones sobre suelo público.
- Información pública/privada en `ViewProjectionV2`.

### Integración determinista

- Diez escenarios dorados adaptados a SnapshotV2.
- Save/load byte-equivalente.
- Misma seed/perfil/comandos → misma ciudad y economía.
- Cambio de distrito observado → ningún cambio de digest.
- Campaña de dos años en nueve distritos.
- Rival operando y transfiriendo recursos con comandos reales.
- Elecciones, presupuesto, contratos, macroeventos y automatización sobre la ciudad completa.
- Incendio cross-systems con respuesta de bomberos.
- Colapso, seguro, reparación y subasta en parcelas multi-cell.

### Generación

- 100 seeds de ciudad por perfil.
- 900 distritos validados.
- Fixtures canónicas para al menos 12 city seeds.
- Inspector actualizado para mostrar ciudad, distritos, blocks, parcelas, facilities, gateways, métricas y hashes.
- Comparación automática contra envelopes del benchmark real.

### Browser y UX

- Crear partida v2.
- Vista ciudad → seleccionar distrito → seleccionar parcela.
- Comprar, solicitar permiso, construir, asignar cuadrilla y ocupar.
- Transferir cuadrilla a otro distrito.
- Guardar, recargar navegador y restaurar.
- Cambiar overlays.
- Ver suelo público no accionable.
- Activar ordenanza y observar cambio de potencial/valor.
- Ver cobertura cross-district.

### Rendimiento

Medir por separado:

- generación completa de ciudad;
- tick ordinario;
- cierre mensual;
- vivienda por distrito;
- valoración de suelo;
- servicios/rutas;
- construcción de proyección activa;
- structured clone Worker→UI;
- frame Phaser;
- cambio de distrito;
- memoria tras recorrer los nueve distritos.

Criterios:

- conservar budgets D-052/D-065;
- comparar también por número equivalente de entidades;
- no aceptar optimizaciones aproximadas antes de agotar índices/caches exactos;
- si se cruza un trigger, abrir remediación: medir → optimizar exacto → volver a medir → evaluar LOD.

### Balance y playtest

1. Regenerar datasets sintético y jugable; no mezclar sus conclusiones.
2. Campaña jugable mínima: 16 seeds × 12 meses × cuatro estrategias.
3. Añadir métricas por distrito:
   - vacancia;
   - renta;
   - valor;
   - concentración;
   - cobertura;
   - inversión pública;
   - suelo público/privado;
   - actividad del jugador/rival.
4. Playtests instrumentados de 45–60 minutos con al menos:
   - primera compra;
   - primer cambio de distrito;
   - comprensión del valor del suelo;
   - uso de overlays;
   - lectura del centro/industria/residencial;
   - carga operativa de transferir cuadrillas;
   - reacción a una ordenanza.
5. No declarar el gate cerrado sólo por pruebas automatizadas.

## 7. Documentación y entrega incremental

Cada fase debe cerrar con:

- código y tests verdes;
- acta de implementación;
- ADR si cambia un contrato o regla;
- actualización de `PROJECT-STATE.md`;
- actualización de `DECISIONS.md`;
- corrección de `ARCHITECTURE.md`, `GAME-DOMAIN.md`, `KNOWN-GAPS.md` y glosario;
- fixtures/hashes regenerados con explicación de superficie frente a cambio económico;
- captura o evidencia cuando haya cambio visual.

Orden de commits recomendado por fase:

1. contratos/schemas;
2. estado y generación;
3. snapshot/canonicalización;
4. reglas económicas;
5. proyección;
6. UI/render;
7. tests y fixtures;
8. documentación/evidencia.

No mezclar en un mismo commit cambios de schema, regeneración ciega de goldens y tuning económico.

## 8. Criterio final de aceptación

V.d se considera completo cuando:

- una nueva partida genera nueve distritos conectados y reproducibles;
- el core loop funciona en cualquiera de ellos;
- las parcelas tienen geometría, frente y normativa reales;
- el municipio posee y opera espacios/equipamientos físicos;
- los servicios recorren la ciudad mediante calles y gateways;
- valor, densidad y oportunidades se explican visual y numéricamente;
- los mercados distritales producen diferencias observables sin romper la economía municipal común;
- la vista estratégica permite comparar y cambiar de distrito;
- la simulación sigue siendo determinista, headless y separada del render;
- CI, benchmarks, balance, browser smokes y playtests pasan;
- un jugador puede reconocer centro, barrios, industria, verde y suelo público sin consultar el HUD;
- no existe compatibilidad silenciosa con saves v1 ni contenido derivado de otra IP.
