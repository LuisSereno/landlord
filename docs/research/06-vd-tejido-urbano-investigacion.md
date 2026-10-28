# Cómo generar ciudades creíbles en Landlord: arquitectura urbana, parcelas, espacio público y servicios

## Diagnóstico del estado actual

La intuición de la respuesta de partida es correcta: **el principal límite de Landlord ya no está en el renderer, sino en el modelo espacial que éste recibe**. Sin embargo, al revisar el código y contrastarlo con literatura de modelado urbano procedural, aparece una conclusión algo más fuerte: antes de “añadir barrios”, Landlord necesita introducir explícitamente la jerarquía espacial que existe entre **calle, manzana, parcela, edificio, uso y espacio público**.

El modelo actual todavía no puede expresar esa jerarquía. `District` sigue siendo fijo a 64×64; `Parcel` contiene una sola `GridCell`; una parcela sólo admite un `buildingId`; el edificio referencia a una única parcela; y `Zoning` sólo distingue `residential`, `industrial` y `mixed`. El catálogo edificatorio autoritativo continúa siendo muy reducido (`courtyard_home`, `workshop`, `cement_plant`, `brickworks`, `steelworks`). fileciteturn5file0L1-L2

Además, lo que el generador denomina hoy “block” **no es todavía una manzana urbana**. Los perfiles definen `blockCount`, `blockColumns`, `blockRows` y `spacingX/Y`, pero el algoritmo coloca parcelas separadas y `isParcelCompatible` impide explícitamente que dos parcelas sean ortogonalmente adyacentes. Es decir, se generan agrupaciones de *slots* parcelarios, no superficies continuas delimitadas por calles susceptibles de subdividirse catastralmente. fileciteturn8file0L1-L2 fileciteturn6file0L1-L2

La infraestructura vial sí está en una situación mucho mejor. El contrato reciente separa `road`, `parcel`, `obstacle` y `open`; utiliza segmentos ortogonales autoritativos; y las mediciones realizadas sobre 24 distritos y 989 parcelas obtuvieron frente vial para el 100 % de las parcelas sin consumir suelo edificable. La red adoptada ocupaba 451 celdas, alrededor del 11 % del mapa, y los callejones resultaron necesarios para mantener el acceso parcelario. fileciteturn18file0L1-L2 Esto significa que **no conviene rehacer la carretera otra vez**. Lo correcto es aprovecharla como esqueleto de la siguiente capa urbana.

Hay otra limitación estructural importante en los servicios. En el código actual existen únicamente `transport`, `security` y `cleaning`; su cobertura parte de un centro calculado a partir de las parcelas y decrece con distancia Manhattan y saturación. El propio código documenta que “no hay edificios de servicio: el modelo es de red”. No existen todavía comisarías, parques de bomberos, hospitales, escuelas o estaciones como fuentes espaciales del servicio. fileciteturn9file0L1-L2

Y hay un problema adicional que considero **más importante de lo que sugería la propuesta inicial: la escala**. Una celda lógica representa 4 m y el distrito es de 64×64 celdas, por lo que el área representada literalmente mide aproximadamente **256 × 256 m = 65.536 m² = 6,55 ha**. fileciteturn12file0L1-L10 El propio ADR de generación sigue tratando esta superficie como un distrito y deja expresamente fuera del alcance actual la existencia de varios distritos por partida o la expansión fuera del distrito activo. fileciteturn15file0L1-L2

Esto tiene una consecuencia de diseño importante:

> **El mapa actual tiene escala adecuada para representar un barrio o fragmento urbano muy denso; no una ciudad completa literal con centro, periferia, polígono industrial, hospital de gran escala y varios barrios separados.**

Se puede comprimir artísticamente esa escala, pero entonces `CELL_METERS = 4` dejaría de ser una medida geográfica coherente y habría que tratarla únicamente como escala de assets. Mi recomendación es la contraria: **preservar la escala física y asumir que el 64×64 representa un distrito de una ciudad mayor**. La “ciudad” puede existir conceptualmente alrededor del mapa, y en una fase posterior convertirse en varios distritos conectados.

Por ello, mi diagnóstico de carencias queda así:

| Capa urbana | Landlord actual | Lo que falta |
|---|---|---|
| Ciudad | Un único `District` 64×64 | contexto de ciudad / varios distritos a futuro |
| Red vial | ya autoritativa, `street`/`avenue` | centralidad y función urbana derivadas |
| Manzana | no existe como entidad | `Block` delimitando tejido urbano |
| Parcela | una celda | parcelas multi-cell con geometría y frente |
| Edificación | un edificio por parcela | huella dentro de parcela y múltiples edificios/estructuras |
| Zonificación | residential/mixed/industrial | uso, intensidad y normativa separados |
| Espacio público | presentación/terrain | parque, plaza y suelo público autoritativos |
| Equipamientos | inexistentes | ayuntamiento, escuela, salud, policía, bomberos, etc. |
| Servicios | radial desde centro | cobertura desde instalaciones y red vial |
| Valor del suelo | banda aleatoria por zoning | accesibilidad, centralidad, amenidades y externalidades |
| Morfología | distribución de slots | centro, corredores, tejidos, transiciones y densidad |

Por tanto, **sí existe un cuello de botella de “City Structure”, pero su solución no consiste simplemente en generar más parcelas**. La pieza fundamental que falta es un modelo de **tejido urbano**.

## Qué hace que una ciudad procedural parezca realmente una ciudad

La literatura de generación urbana lleva más de dos décadas convergiendo en una jerarquía muy distinta de “colocar edificios aleatoriamente sobre terreno”. El trabajo clásico de Parish y Müller genera primero la red vial en función de objetivos y restricciones, después subdivide las áreas situadas entre las calles en lotes y finalmente genera los edificios sobre esos lotes. También separa objetivos globales —población, patrones viales— de restricciones locales —agua, relieve, parques, cruces—. citeturn17view0turn18view0

La investigación específica sobre parcelación de Vanegas et al. parte de la misma idea: **la unidad de subdivisión es la manzana**, y las parcelas resultantes deben satisfacer restricciones como acceso a calle, área, anchura, proporción geométrica y alineación. Sus algoritmos producen parcelas cuyo frente da a calle y cuyo fondo se relaciona con parcelas vecinas o patios interiores, además de mantener estabilidad de identidad ante modificaciones del tejido. citeturn19search18turn19search5

Trabajo más reciente va incluso más lejos: Chen, Song y Ortner señalan que calles y parcelas están fuertemente acopladas y proponen generarlas jerárquicamente juntas precisamente para evitar parcelas irregulares y redes subóptimas. citeturn19search0 En Landlord no hace falta adoptar ese algoritmo literalmente porque la red vial acaba de convertirse en infraestructura autoritativa y ya garantiza el acceso de las parcelas existentes; pero confirma que **carretera y parcelación deben dejar de ser dos nubes de celdas independientes**.

La jerarquía que propongo para Landlord es ésta:

```text
CityContext
│
└── District
    │
    ├── RoadGraph
    │   ├── avenues
    │   └── streets
    │
    ├── Block[]
    │   │
    │   ├── PublicSpace[]
    │   │   ├── plaza
    │   │   ├── park
    │   │   └── civic courtyard
    │   │
    │   └── Parcel[]
    │       ├── geometry / cells
    │       ├── frontage
    │       ├── ownership
    │       ├── zoning code
    │       └── Building[]
    │
    └── Facility[]
        ├── civic
        ├── education
        ├── health
        ├── police
        └── fire
```

La diferencia conceptual respecto al generador actual es enorme: **la parcela deja de ser la unidad que crea la ciudad y pasa a ser una subdivisión de algo mayor**.

También conviene abandonar la idea de que una ciudad realista se construye mediante cinco zonas rígidas y perfectamente separadas. Los modelos modernos de urbanismo paramétrico trabajan con atributos de bloque o parcela como zonificación, cobertura edificatoria, FAR, altura y retranqueos; la forma edificada se deriva después de esas restricciones. CityEngine, por ejemplo, separa explícitamente zoning, lot coverage, FAR, altura, setbacks, tipos edificatorios y usos interiores. citeturn12search2turn12search3

Para Landlord esto sugiere utilizar **centros, corredores y gradientes**, no cuadrantes:

```text
                    industrial suitability
                           █████
                       ███████████
                 avenue / logistics gateway
                         │
                         │
 low density ─── mixed ──┼── civic/mixed ─── urban residential
 residential              │       ███
                          │     ███████
                          │     centrality
                          │
                     commercial corridor
```

El centro cívico puede ser un ancla fuerte; una avenida puede aumentar la propensión comercial; las calles secundarias pueden favorecer vivienda; el borde conectado a una avenida puede favorecer industria; y entre esas áreas deben aparecer transiciones. La literatura económica tampoco obliga a una ciudad monocéntrica rígida: las extensiones de los modelos clásicos contemplan múltiples centros y heterogeneidad espacial. citeturn21search5

Por eso cambiaría la semántica del generador de:

```ts
zoning = residential | mixed | industrial
```

a algo parecido a:

```text
UrbanRole
  civic_core
  mixed_core
  commercial_corridor
  urban_residential
  low_density_residential
  industrial_logistics
  institutional
  green_open_space
```

Estos `UrbanRole` **no tienen por qué ser reglas económicas directamente**. Son composición urbana. Después cada uno puede proporcionar probabilidades, restricciones y valores por defecto a zoning, intensidad, parcelación, arquitectura y precio.

Esto permite una propiedad que ahora falta mucho visualmente: **continuidad del tejido**. Una ciudad resulta reconocible no porque haya un ayuntamiento aislado, sino porque el ayuntamiento está delante de una plaza, la plaza conecta con calles importantes, esas calles tienen fachadas más continuas, aparecen comercios en las plantas bajas y la altura disminuye gradualmente al alejarse. Esa causalidad espacial es la que produce legibilidad.

## El modelo de dominio que falta en Landlord

La investigación sugiere no solucionar esto añadiendo quince nuevos valores al enum `Zoning`. Esa solución acabaría mezclando cinco conceptos distintos.

OpenStreetMap, pese a ser un modelo cartográfico y no una especificación para videojuegos, ofrece una separación especialmente útil: `landuse` describe el uso del suelo; una escuela, hospital o parque puede representar una utilización más específica dentro de un área urbana; y el suelo dedicado a la vía pública se trata separadamente del suelo urbanizable. citeturn13search2turn13search4 Además, distingue deliberadamente **la forma física de un edificio de su función actual**: un edificio físicamente construido como almacén puede tener uso residencial, y un edificio con forma de iglesia puede funcionar como biblioteca. citeturn13search0turn13search1

Para Landlord esa separación sería muy valiosa porque crea mecánicas futuras de reconversión, alquiler, cambio de uso y ordenanzas sin tener que cambiar sprites o destruir edificios.

Yo introduciría las siguientes abstracciones, de forma aditiva.

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

type Block = {
  id: BlockId;
  districtId: DistrictId;
  cells: GridCell[];
  roadFrontageIds: string[];
  urbanRole: UrbanRole;
  developmentCodeId: DevelopmentCodeId;
};

type Parcel = {
  id: ParcelId;
  districtId: DistrictId;

  // Sustituye conceptualmente al cell único.
  cells: GridCell[];
  anchorCell: GridCell;

  blockId: BlockId;
  roadFrontageIds: string[];

  ownerOrganizationId: OrganizationId | null;
  disposition: "marketable" | "public" | "infrastructure";

  developmentCodeId: DevelopmentCodeId;
  currentUse: LandUse | null;

  price: Money;
};

type DevelopmentCode = {
  id: DevelopmentCodeId;
  allowedUses: LandUse[];
  maxFloors: number;
  targetCoverageRange: [number, number];
  targetFloorAreaRatioRange: [number, number];
  setbackCells: number;
};

type LandUse =
  | "residential"
  | "retail"
  | "office"
  | "industrial"
  | "civic"
  | "education"
  | "health"
  | "utility";
```

No considero imprescindible cambiar inmediatamente el nombre `Parcel` por `Lot`. **Mantendría `Parcel` porque ya es una entidad económica importante y evolucionaría su geometría de una celda a un conjunto canónico de celdas.** Así se minimiza el impacto en comandos, economía, subastas, préstamos y saves.

La entidad nueva realmente imprescindible es `Block`.

Una manzana no tiene dueño ni se compra. Es una **unidad morfológica** que agrupa parcelas y determina cómo se subdivide el espacio comprendido entre calles.

También añadiría una entidad diferente para espacio público:

```ts
type PublicSpace = {
  id: PublicSpaceId;
  districtId: DistrictId;
  blockId?: BlockId;

  kind:
    | "plaza"
    | "park"
    | "pocket_park"
    | "civic_courtyard"
    | "schoolyard";

  cells: GridCell[];
  operatorOrganizationId: OrganizationId;
};
```

Esto evita volver a cometer el problema actual de interpretar cualquier celda verde como parque. Un parque debe tener **identidad, superficie, límites y función**, aunque todavía no produzca ninguna bonificación.

El siguiente cambio es igual de importante: el dominio actual presupone esencialmente un edificio por parcela. fileciteturn5file0L1-L2 Eso funciona con una vivienda pequeña, pero falla incluso después de crear parcelas multi-cell si se quiere modelar:

```text
school parcel
├── main building
├── sports hall
└── yard

industrial parcel
├── factory
├── warehouse
└── service yard

hospital parcel
├── main building
├── annex
└── emergency access
```

No necesariamente habría que implementar inmediatamente múltiples edificios interactivos. Pero **el nuevo contrato no debería volver a impedirlos**. Como mínimo, `Building.parcelId` debería poder repetirse para varios edificios y `Parcel.buildingId` singular debería desaparecer, quedar deprecado o transformarse en una relación derivada.

Por encima de los edificios introduciría `Facility`:

```ts
type FacilityKind =
  | "town_hall"
  | "school"
  | "clinic"
  | "hospital"
  | "police_station"
  | "fire_station"
  | "market";

type Facility = {
  id: FacilityId;
  kind: FacilityKind;

  parcelIds: ParcelId[];
  buildingIds: BuildingId[];

  operatorOrganizationId: OrganizationId;

  capacity?: number;
  serviceProfileId?: string;
};
```

La razón de mantener `Facility` separado de `Building` es exactamente la diferencia entre **objeto físico y función** observada en modelos geográficos reales. citeturn13search0turn13search1 Un colegio puede ocupar varios edificios; un mercado puede cambiar de edificio; un edificio histórico puede cambiar de uso; una comisaría es una función operativa, no sólo una silueta.

Finalmente, no ampliaría el actual `Zoning` hasta convertirlo en un catálogo de usos. Lo dividiría conceptualmente así:

```text
UrbanRole       dónde estamos en la estructura de la ciudad
DevelopmentCode qué se permite construir
LandUse         qué uso tiene realmente el suelo
BuildingForm    qué forma física tiene el edificio
Facility        qué servicio/función institucional opera allí
Ownership       quién controla el suelo
```

Ésta es probablemente la decisión arquitectónica que más posibilidades futuras abre a Landlord.

Una parcela céntrica podría tener:

```text
UrbanRole:        mixed_core
DevelopmentCode: central_mixed_5F
LandUse:          retail + residential
BuildingForm:     perimeter_block
Ownership:        rival_company
Facility:         none
```

mientras que otra inmediatamente enfrente:

```text
UrbanRole:        civic_core
DevelopmentCode: civic_landmark
LandUse:          civic
BuildingForm:     civic_hall
Ownership:        municipality
Facility:         town_hall
```

La diferencia visual, económica y política aparece entonces **a partir del mismo espacio urbano**, en lugar de estar codificada mediante excepciones visuales.

## Cómo debería funcionar el nuevo generador

No recomiendo generar primero “una cuadrícula de parcelas más densa” y después intentar encontrar dónde insertar la ciudad. El orden más sólido para Landlord sería éste:

```text
Seed + DistrictProfile
        │
        ▼
Urban Composition
centro · puertas · industria · verde · demanda
        │
        ▼
Authoritative Road Graph
street · avenue
        │
        ▼
Block Formation
manzanas / development envelopes
        │
        ▼
Public Reservations
plazas · parques · equipamientos
        │
        ▼
Parcel Subdivision
frente · fondo · tamaño · acceso
        │
        ▼
Land Use + Development Intensity
uso · altura · cobertura
        │
        ▼
Municipal / Rival / Vacant Ownership
        │
        ▼
Building Massing
        │
        ▼
Visual Dressing
```

Es casi el mismo orden conceptual que utilizan los pipelines procedurales urbanos clásicos: red, bloques, lotes, edificios. citeturn17view0turn18view0turn19search5 Pero está adaptado a la ventaja específica que Landlord ya posee: **una topología vial persistente y determinista**. fileciteturn18file0L1-L2

**Urban Composition.** Cada `DistrictProfile` debería evolucionar desde pesos de zoning y número de slots hacia una verdadera receta morfológica:

```ts
type UrbanCompositionProfile = {
  morphology: "grid" | "organic" | "industrial" | "mixed";

  civicCenter: { required: boolean };
  industrialEdge: { weight: number };
  commercialCorridors: { weight: number };
  greenSpace: { weight: number };

  roles: Record<UrbanRole, RoleParameters>;
  parcelStyles: Record<UrbanRole, ParcelSubdivisionParameters>;
  developmentCodes: DevelopmentCodeId[];
  facilities: FacilityProgram[];
};
```

No quiere decir que haya que descartar los perfiles existentes. Al contrario: `barrio_del_umbral`, `vega_del_cauce` y `ensanche_ferroviario` ya constituyen una excelente frontera data-driven para introducir estas diferencias. fileciteturn8file0L1-L2 Pueden evolucionar de “combinaciones de slots” a verdaderas identidades urbanas.

Por ejemplo:

| Perfil | Estructura plausible |
|---|---|
| Barrio del Umbral | centro cívico compacto + vivienda + eje comercial |
| Vega del Cauce | tejido condicionado por paisaje + parques + residencial |
| Ensanche Ferroviario | malla más regular + avenida + industria/logística + bloques mixtos |

**Elección del centro.** No lo fijaría siempre en `(32,32)`. El candidato cívico debería surgir de la red: cruce de avenidas, alta centralidad, accesibilidad a la mayor parte del tejido y disponibilidad espacial. Puede haber un ancla autorada para garantizar calidad y después una pequeña variación determinista. El principio de emplear accesibilidad y estructura de red en lugar de simple distancia geométrica tiene además una base sólida tanto en análisis urbanos como en modelos de valor inmobiliario. citeturn12search0turn21search1

**Formación de manzanas.** Aquí aparece una particularidad importante del proyecto. La red actual fue diseñada y validada para **dar acceso a parcelas**, no para garantizar que todas las calles formen polígonos cerrados. Su propio contrato conserva callejones porque eliminarlos destruiría gran parte del frente vial. fileciteturn18file0L1-L2 Por tanto, no asumiría ingenuamente que cada componente cerrado del mapa ya es una manzana perfecta.

Introduciría un paso específico `deriveUrbanBlocks()` que trabaje con los espacios edificables situados alrededor de la red. Allí donde haya circuitos cerrados, la manzana surge directamente. En corredores abiertos o callejones, pueden construirse **development envelopes** a ambos lados de la calle y dividirse posteriormente. Las avenidas y límites de distrito pueden actuar como fronteras adicionales.

Esto permite conservar el 100 % de acceso que ya existe sin imponer otra red de carreteras.

**Reserva pública antes de parcelar.** Éste es otro cambio relevante respecto a la propuesta inicial. Una plaza mayor, un parque, una escuela o un ayuntamiento no deberían introducirse después de subdividir todo en pequeños solares. Primero se reserva un `superlot` o `PublicSpace` dentro de la manzana y **el resto de la manzana se parcela alrededor**.

Ejemplo:

```text
avenue
══════════════════════════════════════════════
│ shop │ shop │      PLAZA       │ shop │ apt │
│──────│──────│                  │──────│─────│
│ apt  │ apt  │    TOWN HALL     │ apt  │ apt │
│ apt  │ apt  │                  │ apt  │ apt │
══════════════════════════════════════════════
street
```

Esta operación por sí sola hará que una plaza parezca urbanísticamente real: no será un parche de suelo diferente, sino **el vacío que organiza las fachadas circundantes**.

**Subdivisión parcelaria.** El algoritmo de Vanegas et al. utiliza geometría continua, straight skeleton y OBB para crear parcelas con frente, fondo y dimensiones plausibles. citeturn19search18 Landlord no necesita implementar un straight skeleton geométrico en V.d. La cuadrícula permite una solución mucho más barata:

```text
1. obtener los segmentos de borde de la manzana que tocan carretera
2. dividir cada segmento de frente según el perfil urbano
3. crear semillas de parcela
4. hacer crecer cada parcela hacia el interior
5. limitar profundidad/área/aspect ratio
6. resolver celdas huérfanas uniéndolas al vecino con mayor borde común
7. validar continuidad, acceso y ausencia de solapes
```

La equivalencia conceptual es la misma: **frente primero, profundidad después**. La variación aleatoria debe afectar a anchura, profundidad y agrupación, pero siempre dentro de restricciones.

Para vivienda exterior esto tenderá a generar solares relativamente estrechos y profundos; para bloques urbanos, parcelas más compactas o incluso una única parcela perimetral; para industria y equipamientos se reservarán superparcelas. No fijaría todavía números “realistas” universales: esos rangos deberían salir del corpus de referencia descrito más adelante.

Además, la investigación sobre parcelación insiste en que una buena subdivisión cubre la manzana de manera completa y controla área, anchura, proporción y acceso. citeturn19search18turn19search5 Esas condiciones pueden convertirse directamente en `DistrictGenerationIssue` nuevos:

```text
BLOCK_UNASSIGNED_CELLS
PARCEL_DISCONNECTED
PARCEL_WITHOUT_ROAD_FRONTAGE
PARCEL_TOO_NARROW
PARCEL_TOO_DEEP
PUBLIC_SPACE_UNREACHABLE
FACILITY_SITE_INVALID
```

Esto encaja muy bien con la filosofía actual de Landlord de **validar la jugabilidad y fallar explícitamente en vez de aceptar una seed rota**, ya establecida por D-064. fileciteturn15file0L1-L2

**Densidad.** No usaría directamente `downtown = tall`, aunque visualmente sea el resultado habitual. Introduciría un `DevelopmentCode` que controle cuatro dimensiones:

```text
coverage     % aproximado del solar que puede ocupar la huella
FAR          superficie total construible relativa al solar
maxFloors    límite vertical
setback      separación respecto a la calle/linderos
```

Son precisamente los tipos de variables utilizados en los workflows actuales de planificación paramétrica para convertir zonificación en masa edificatoria. citeturn12search2turn12search3

Entonces el skyline emerge de:

```text
centralidad
    +
accesibilidad
    +
DevelopmentCode
    +
valor del suelo
    +
tipo de parcela
```

y no sólo de un `if zone === downtown`.

Eso permitiría que una iglesia, ayuntamiento o antigua fábrica sobresalgan localmente sin romper el perfil general del barrio.

## Servicios públicos y economía del suelo

La introducción de ciudad física ofrece a Landlord una oportunidad especialmente importante porque **puede unir por primera vez la capa visual con la económica y política**.

El primer cambio debería ser físico y persistente, no necesariamente mecánico. Por ejemplo:

```text
V1
Town Hall exists and occupies municipal land.
Security calculation remains unchanged.

V2
Police Station exists and becomes origin of security coverage.

V3
Station has capacity/budget/staff and incidents consume capacity.
```

Así se evita otro big-bang.

Para el centro cívico, yo mantendría la idea original de **plaza + ayuntamiento como primer landmark**. Es la entidad que mejor conecta tres capas que Landlord ya tiene: territorio, municipio y política. Además, al no requerir una compleja simulación de emergencia puede convertirse inmediatamente en ancla urbana sin exigir nuevas reglas económicas.

El orden de equipamientos que recomiendo para el mapa actual sería:

| Prioridad | Equipamiento | Motivo |
|---|---|---|
| Muy alta | Ayuntamiento + plaza | centro cívico, política, landmark |
| Muy alta | Escuela | organiza barrio residencial y requiere recinto |
| Alta | Parque / plaza secundaria | introduce espacio público real |
| Alta | Comisaría | conexión natural con `security` existente |
| Alta | Parque de bomberos | primera cobertura espacial de emergencia |
| Media | Clínica / centro de salud | más proporcionado al distrito 256 m que un gran hospital |
| Media | Mercado municipal | refuerza centro/comercio |
| Posterior | Hospital de escala urbana | mejor en un distrito mayor o contexto multi-distrito |

La distinción `clínica` frente a `hospital` no es meramente estética. Con la escala literal actual, intentar representar simultáneamente ayuntamiento, gran hospital, complejo escolar, industria, downtown y varios barrios en 6,55 ha obliga a convertir todos esos recintos en iconos comprimidos. Mi recomendación es mantener **equipamientos de escala barrial ahora** y reservar los grandes equipamientos para la futura ciudad multi-distrito.

Para policía, bomberos o salud, tampoco utilizaría el centro geométrico como origen de la cobertura. La investigación clásica sobre localización de servicios de emergencia formula precisamente el problema como seleccionar ubicaciones desde las que los puntos de demanda estén dentro de un límite de tiempo o distancia. citeturn20search0turn20search5

En un juego no hace falta resolver un programa matemático exacto. Durante la generación se puede utilizar una heurística determinista muy sencilla:

```text
candidates = municipal-capable parcels

for each candidate:
    score =
        demandCoveredWithinRoadCost
        - constructionPenalty
        + avenueAccessBonus
        + centralityBonus

choose highest score
```

El elemento decisivo es `RoadCost`: **distancia sobre la red autoritativa**, no distancia Manhattan desde el centro del mapa.

La cobertura futura podría ser:

```text
building
   │
shortest road path
   │
fire station
   │
capacity × budget × staffing
   │
service quality
```

Esto transformaría el servicio urbano de una barra abstracta en una estructura espacial comprensible por el jugador.

Para `transport`, mantendría una excepción. El transporte es por naturaleza una red y no debería convertirse simplemente en “radio desde una estación”. Más adelante podrían existir paradas/estaciones y accesibilidad a través de la red. `cleaning` puede seguir abstracto más tiempo o adquirir posteriormente un depósito municipal. No hace falta que todos los sistemas físicos lleguen simultáneamente.

### El valor del suelo debería surgir de la ciudad

Aquí existe una oportunidad aún mayor para un juego llamado Landlord.

Hoy los perfiles generan el precio de una parcela a partir de una banda asociada a `residential`, `mixed` o `industrial` más variación determinista. fileciteturn8file0L1-L2 Eso sirve como balance, pero cuando exista estructura urbana será posible producir precios mucho más legibles.

La literatura de economía urbana relaciona el valor de localización con accesibilidad y costes de desplazamiento; además, revisiones empíricas sobre valoración inmobiliaria emplean métricas como distancia, oportunidades accesibles e impedancia. Estudios históricos de suelo han encontrado que medidas basadas en tiempo de viaje mediante la red pueden explicar mejor el gradiente de valor que la distancia directa al centro. citeturn21search1turn21search10

No intentaría implementar un modelo econométrico real. Usaría esos principios para construir un **land value field jugable**:

```text
LandValue(parcel) =
    base(profile)
  + networkCentrality
  + accessToCommercialActivity
  + accessToCivicAmenities
  + roadFrontageQuality
  + localDensity
  - industrialNuisance
  - isolation
  + seededVariation
```

Los pesos serían balance de juego, no constantes pretendidamente científicas.

El resultado sería exactamente la variedad que la propuesta inicial busca:

```text
avenida / plaza / centro
    → suelo escaso, conectado, caro
    → edificios más intensivos

calles residenciales
    → valor intermedio

borde residencial
    → solares mayores y baratos

corredor industrial
    → precio condicionado por acceso logístico,
      superficie y externalidades
```

Y, lo más importante, el precio resultaría **explicable visualmente**. El jugador podría mirar el mapa y comprender por qué una parcela vale más.

Esto también mejora enormemente la política municipal. Una futura ordenanza que aumente la altura permitida junto a una avenida cambiaría el potencial económico del suelo; una plaza nueva podría aumentar atractivo; una comisaría o escuela podría hacer más interesante un sector; una fábrica podría reducir atractivo residencial cercano. Ya no serían modificadores desconectados del mundo.

### Suelo público, privado y comprable

La respuesta inicial acierta plenamente en este punto: **no todo el territorio debe estar en el mercado**.

El dominio ya dispone de una organización de tipo `municipality`, por lo que muchos solares institucionales pueden aprovechar el sistema existente de propiedad. fileciteturn5file0L1-L2 Pero añadiría una política explícita de transferibilidad, porque “es propiedad municipal” y “puede venderse” no son necesariamente la misma cosa:

```text
Municipal + public
    Town Hall
    School
    Clinic

Municipal + infrastructure
    road
    depot

PublicSpace
    plaza
    park

Private + marketable
    vacant lot
    rival property
    player property
```

Esto debería ser inmediatamente visible en el mapa, incluso antes de tener mecánicas profundas:

```text
[ PUBLIC ]  verde / institucional
[ VACANT ]  disponible
[ RIVAL  ]  propiedad privada
[ PLAYER ]  propiedad propia
[ ROAD   ]  infraestructura
```

La ciudad empezaría entonces a contar una historia económica sin abrir ningún panel.

## Validación con ciudades reales y roadmap recomendado

La mejor manera de conseguir “ciudades parecidas a las reales” no es copiar literalmente una ciudad ni confiar en que las reglas *parezcan* razonables. Recomiendo construir un **benchmark morfológico offline** con muestras de ciudades reales del estilo que quiera representar Landlord.

OSMnx puede obtener y analizar redes de calles, huellas de edificios, parques, equipamientos, transporte y otros objetos de OpenStreetMap; también calcula indicadores como densidad de intersecciones, circuidad, grado de los nodos, centralidad y orientación de calles. citeturn12search0turn12search1 Es decir, proporciona casi exactamente el instrumental necesario para crear un test de realismo sin incorporar datos de OpenStreetMap al runtime del juego.

La idea que considero especialmente potente es muestrear ventanas de **256 × 256 m**, exactamente el tamaño físico del distrito actual, sobre varios tejidos reales del estilo visual objetivo.

Por ejemplo, si la dirección artística busca una ciudad europea, el corpus podría contener —como categorías, no necesariamente estas ciudades concretas—:

```text
historic / irregular
19th century extension
dense mixed residential
low density residential
industrial edge
railway district
small civic center
```

De cada muestra se podrían extraer:

| Familia | Métricas |
|---|---|
| Calles | longitud/área, intersecciones, callejones, orientación, centralidad |
| Manzanas | número, área, proporción, profundidad |
| Edificios | cobertura de suelo, número, superficie de huella |
| Intensidad | pisos/altura donde los datos sean fiables |
| Usos | residencial, comercio, industria, institucional, verde |
| Equipamientos | escuelas, salud, policía, bomberos, mercados, parques |
| Morfología | continuidad de fachadas, distancia a calle, patios |

OSMnx permite descargar conjuntamente red y objetos urbanos, y OpenStreetMap distingue usos como residencial, comercial, industrial, educativo e institucional, además de equipamientos específicos. citeturn12search5turn13search2turn13search8 Para las **parcelas catastrales reales** no asumiría que OSM proporciona cobertura consistente: cuando sean necesarias, utilizaría datasets catastrales abiertos apropiados al país de referencia o métricas inferidas de fachadas y huellas.

El objetivo tampoco debería ser que Landlord reproduzca exactamente esas muestras. Sería convertir cada perfil en un **sobre estadístico**:

```text
ensanche_ferroviario
  intersectionDensity    → reference distribution
  buildingCoverage       → reference distribution
  blockArea              → reference distribution
  streetOrientation      → reference distribution
  industrialShare        → reference distribution
  greenShare             → reference distribution
```

Entonces una seed puede variar mucho sin dejar de pertenecer al mismo “tipo de ciudad”.

Esto es mucho más robusto que decir:

```text
residential = 50 %
industrial = 20 %
mixed = 30 %
```

porque dos mapas con esos mismos porcentajes pueden tener morfologías completamente diferentes.

### Roadmap que recomiendo

Después de revisar el código, **cambiaría ligeramente el orden propuesto en la respuesta inicial**. Conceptualmente City Structure sigue siendo el objetivo, pero técnicamente no construiría esa estructura sobre `1 cell = 1 parcel`, porque obligaría a rehacerla casi inmediatamente.

La secuencia que considero más segura es:

```text
V.d.0 — Urban Domain Contract
        Block
        multi-cell Parcel
        PublicSpace
        Facility
        DevelopmentCode
        LandUse / BuildingForm separados
        decisión explícita sobre escala

              ↓

V.d.1 — Blocks & Parcel Fabric
        derivar manzanas/development envelopes
        subdividir por frente vial
        superlots
        suelo municipal/público
        mantener 100 % frontage

              ↓

V.d.2 — Urban Composition
        civic core
        mixed/commercial corridors
        residential fabrics
        industrial/logistics edge
        green/institutional
        transiciones y gradientes

              ↓

V.d.3 — Civic City
        plaza + ayuntamiento
        parque
        escuela
        comisaría
        bomberos
        clínica
        mercado

              ↓

V.d.4 — Density & Land Value
        coverage
        FAR
        floors
        setbacks
        accessibility
        centrality
        land-value field
        skyline

              ↓

V.d.5 — Spatial Services
        facility anchors
        road-network coverage
        capacity
        budget
        mantener adapters para sistemas antiguos

              ↓

V.d.6 — Contextual Dressing
        árboles según espacio
        mobiliario según plaza/calle/parque
        coches según función vial
        dumpsters en service yards
        iluminación según jerarquía
```

No es un big-bang. Cada nivel puede introducirse sin hacer funcionar todavía el siguiente.

La transición más delicada es `Parcel`. La haría **aditiva**:

```text
V1
Parcel.cell

V2 transición
Parcel.cell        // compatibilidad / anchor
Parcel.cells?      // nueva geometría

V2 final
Parcel.cells
Parcel.anchorCell  // derivado/canónico
```

Los saves antiguos pueden restaurarse como parcelas de una celda. Las partidas nuevas utilizarían `generatorVersion = 2`. La filosofía de versionado determinista que ya utiliza el generador es precisamente la apropiada para una migración de este tipo. fileciteturn15file0L1-L2

No cambiaría los hashes “silenciosamente”. Un nuevo generador urbano debería tener fixtures propias y semillas canónicas, igual que D-064 hace visibles los cambios del algoritmo y perfiles. fileciteturn15file0L1-L2

### Gates de aceptación que sustituirían al juicio puramente visual

El nuevo generador debería demostrar al menos estas propiedades:

| Gate | Criterio recomendado |
|---|---|
| Determinismo | misma seed/profile/version → misma composición |
| Frente vial | 100 % de parcelas comprables con acceso válido |
| Integridad | ninguna parcela cruza carretera, obstáculo o espacio público |
| Parcelación | parcelas contiguas internamente y sin celdas huérfanas accidentales |
| Público | carreteras, plazas y equipamientos públicos no comprables |
| Morfología | distribución dentro del sobre del perfil real de referencia |
| Centro | plaza/ayuntamiento accesibles desde toda la red |
| Industria | conectada a red principal y diferenciada del core residencial |
| Equipamientos | ubicaciones válidas según demanda/cobertura |
| Densidad | gradiente visual coherente con DevelopmentCode y centralidad |
| Persistencia | IDs y saves reproducibles |
| Economía | suficientes oportunidades baratas, medias y premium |
| Legibilidad | a zoom general se distinguen centro, residencial, industria y espacio público sin UI |

La medida final es especialmente importante. **Una buena ciudad procedural debe poder leerse con el HUD apagado.**

El jugador debería ser capaz de señalar visualmente:

```text
"ese es el centro"
"por ahí empieza el residencial"
"aquella avenida parece comercial"
"allí está el polígono industrial"
"eso es suelo público"
"esas parcelas vacías parecen comprables"
"ese solar es claramente más valioso"
```

antes de consultar ninguna cifra.

La conclusión de la investigación es, por tanto, ligeramente más ambiciosa que la respuesta de partida:

> **Landlord no necesita ahora “más ciudad” en el sentido de más edificios; necesita el modelo morfológico que explica por qué los edificios están donde están.**

Las carreteras autoritativas recién construidas son la base correcta y no deberían rehacerse. fileciteturn18file0L1-L2 El siguiente salto consiste en insertar entre carretera y edificio las capas que actualmente faltan:

```text
ROAD
  ↓
BLOCK
  ↓
PUBLIC / PRIVATE LAND
  ↓
MULTI-CELL PARCEL
  ↓
DEVELOPMENT CODE + USE
  ↓
BUILDING / FACILITY
  ↓
ECONOMIC VALUE
  ↓
VISUAL DRESSING
```

Ese orden coincide con los principios de generación urbana utilizados en la literatura procedural —red, bloques, lotes y edificación— y con herramientas contemporáneas que separan zonificación, intensidad y tipología edificatoria. citeturn17view0turn19search5turn12search2

Y, aplicado específicamente a Landlord, resuelve a la vez sus principales carencias actuales: parcelas diminutas, falta de manzanas, ausencia de espacio público autoritativo, equipamientos sin representación física, servicios radiales, zoning demasiado pobre, skyline arbitrario y precios del suelo desconectados de la forma de la ciudad.

**Ése sería el verdadero V.d: no “City Decoration”, sino `Urban Morphology / City Fabric`.** Una vez exista esa capa, las farolas, árboles, coches, parques, fachadas y assets de Quaternius dejarán de ser objetos colocados sobre un escenario y pasarán a ser consecuencias visibles de una ciudad que, internamente, ya tiene estructura.