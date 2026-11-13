# D-099 — Building Composer basado en geometría modular real

Estado: PROPUESTA  
Fecha: 2026-11-03  
Workstream: V.f — Procedural Asset Composition

## Contexto

La remediación D-098 retiró la Building Factory anterior porque declaraba fuentes Kenney/Quaternius/KayKit/Poly Haven sin importar físicamente esa geometría al render. El resultado era técnicamente reproducible pero visualmente insatisfactorio.

Landlord sí dispone ya de:

- staging local con fuentes licenciadas;
- importadores GLB/FBX;
- validación de procedencia;
- Blender headless;
- cámara y luz canónicas;
- renders de evidencia;
- RuntimeAssetManifestV2;
- property grounds derivados;
- un catálogo honesto de edificios candidatos.

El siguiente problema es producir edificios propios con mayor variedad y calidad sin volver a generar masas desde primitivas genéricas ni depender de un artista humano dedicado.

## Decisión

Se adopta como dirección propuesta un **Building Composer modular basado en geometría real**.

El compositor:

1. importa módulos o assets completos desde fuentes registradas;
2. conserva procedencia por módulo;
3. normaliza escala/orientación/materiales;
4. compone nuevas estructuras mediante gramáticas data-driven;
5. aplica un StyleProfile común;
6. produce variantes deterministas;
7. publica únicamente evidencia candidata;
8. requiere aprobación humana antes de promoción al runtime.

## Regla principal

La geometría real de fuente debe entrar físicamente en el resultado.

No se permite una composición cuya relación con la fuente exista sólo como metadata o texto.

## Diferencia con la Building Factory retirada

La Building Factory retirada:

- generaba masas principalmente desde primitivas;
- declaraba familias externas como inspiración;
- no importaba la geometría declarada.

El Building Composer:

- parte de módulos extraídos/referenciados desde assets reales;
- registra object/node selectors;
- mantiene sourceId/sourcePath/licencia por módulo;
- usa primitivas originales sólo como apoyo secundario y explícito;
- valida que cada módulo exista en la escena fuente.

## Composición frente a simple re-render

No basta con re-renderizar un GLB fuente.

Para considerarse variante compuesta, debe cambiar materialmente al menos dos de:

- masa;
- secuencia modular;
- cubierta;
- acceso;
- volumen secundario;
- fachada;
- silueta;
- props intrínsecos.

Un simple cambio de color no constituye nueva variante.

## Catálogo modular

Se propone:

```text
blender_artist/manifests/building-modules.json
```

Cada módulo debe declarar:

- id;
- category;
- sourceId;
- sourcePath;
- objectSelector/nodeSelector;
- allowedFamilies;
- anchor;
- nominal dimensions;
- license/provenance inherited from source.

El catálogo debe validarse contra:

- staging-sources;
- asset-jobs o source registry;
- archivo físico;
- jerarquía importada.

## StyleProfile

Se propone un perfil versionado:

```text
blender_artist/manifests/building-style-profiles.json
```

El perfil define normalización común de:

- escala de plantas;
- bevel;
- roof overhang;
- roughness/metallic;
- paleta;
- saturación;
- densidad de detalle;
- tolerancias de footprint.

Los parámetros se derivarán de mediciones y Art Bible, no de valores arbitrarios sin evidencia.

## Gramáticas

Las reglas deben ser por familia:

- residential_low;
- residential_urban;
- mixed_commercial;
- industrial_light;
- industrial_heavy;
- civic_small;
- civic_medium;
- civic_landmark.

No crear un script distinto por building type salvo adaptadores mínimos inevitables.

## Determinismo

La composición debe depender sólo de entradas explícitas:

```text
composerVersion
styleProfileId
buildingType
variantSeed
moduleCatalogVersion
```

El mismo input produce:

- mismos módulos;
- mismas transformaciones;
- mismos materiales;
- misma metadata;
- mismo render dentro del entorno Blender fijado.

No usar aleatoriedad no sembrada.

## Relación con el dominio

El compositor no decide gameplay.

No modifica:

- BuildingDefinition;
- targetFootprintCells;
- preferredFootprint;
- siteRequirements;
- DevelopmentCode;
- FAR;
- coverage;
- economía.

El asset debe adaptarse al contrato del dominio.

Si no cabe visualmente, el candidato se rechaza.

## Relación con V.d-7C

V.d-7C sigue siendo autoritativa para placement.

El compositor no decide dónde se coloca el edificio.

El resultado debe:

- respetar el footprint visual esperado;
- publicar pivot y dimensiones;
- poder renderizarse como ghost más adelante si se promueve.

## Property Grounds

Los elementos que dependen del solar permanecen fuera del sprite compuesto.

No hornear:

- valla perimetral;
- jardín dependiente de parcela;
- driveway según frontage;
- patio industrial dependiente de espacio libre;
- contenedores externos posicionados por el solar.

Sí se permiten elementos intrínsecos:

- canopy;
- chimenea;
- muelle integrado;
- depósito pegado;
- escalón;
- señal propia.

## Procedencia

D-083 y D-098 siguen siendo obligatorias.

La metadata de cada candidato debe poder reconstruir la cadena:

```text
candidate
→ composition
→ modules
→ source objects
→ source files
→ license
```

Un candidato con procedencia incompleta falla.

## Estados de edificio

El primer spike sólo produce `complete`.

No generar construction/damaged/burning hasta que la silueta complete haya sido aprobada visualmente.

Esto evita repetir V.e.3 sobre una base visual no aceptada.

## Piloto

El primer spike queda limitado a:

- row_house;
- cement_plant;
- town_hall.

Cuatro variantes por tipo.

Razón:

- residencial bajo;
- industrial pesado;
- landmark cívico.

Si el sistema no funciona en esas tres familias, no se escala.

## Promoción

El Building Composer publica evidence.

No escribe automáticamente:

```text
runtime-assets-blender.json
```

ni sustituye `runtime-assets.json`.

Promoción requiere:

1. QA visual humana;
2. validación de pivote/footprint;
3. orientación;
4. budget;
5. estados necesarios;
6. decisión explícita.

## Métricas

Cada variante registra:

- módulos usados;
- triángulos;
- materiales;
- texturas;
- bounds;
- footprint;
- render time;
- PNG size;
- hash;
- provenance.

No se fija todavía un budget definitivo de producción; primero se mide el spike.

## Alternativas rechazadas

### Reactivar Building Factory de primitivas

Rechazada: ya produjo una calidad insuficiente y rompía la semántica de procedencia.

### Renderizar directamente un asset fuente y llamarlo variante

Rechazada: aporta poca identidad y variedad.

### Generación 3D mediante IA como fuente final

Rechazada para este spike: introduce procedencia, topología, materiales y QA difíciles de gobernar.

### Crear manualmente 15 edificios

Rechazada como primer paso: demasiado coste antes de demostrar una gramática reutilizable.

### Comprar nuevos packs ahora

Diferido: el inventario actual cubre suficiente materia prima para validar la técnica.

## Consecuencias

Positivas:

- más variedad con bajo coste marginal;
- identidad visual progresiva;
- uso real de packs ya disponibles;
- pipeline reproducible;
- procedencia verificable;
- posibilidad de generar familias.

Costes:

- extracción/normalización modular;
- gramáticas;
- nuevos validadores;
- QA visual;
- necesidad de medir semejanza y coherencia.

## Gate

D-099 sólo puede pasar a ACEPTADA cuando el spike demuestre:

- 12 variantes reproducibles;
- 3 familias distintas;
- procedencia completa;
- sin promoción runtime;
- mejora visual clara frente al baseline procedural;
- al menos 2 variantes aceptables por familia según revisión humana;
- P0/P1 técnicos = 0.

Hasta entonces permanece PROPUESTA.
