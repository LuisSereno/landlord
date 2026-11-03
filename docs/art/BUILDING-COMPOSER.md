# Building Composer — especificación de producción modular

Estado: PROPUESTA  
Workstream objetivo: V.f — Procedural Asset Composition  
Baseline documental: `wip/ve-integrated-correction@39640cf`  
Depende de: D-083, D-098, RuntimeAssetManifestV2 y V.d-7C

## 1. Problema

Landlord necesita edificios con una calidad visual claramente superior al baseline procedural actual, pero el proyecto no debe depender todavía de un artista humano dedicado ni de comprar nuevos packs.

La antigua Building Factory demostró que componer edificios desde primitivas propias puede ser técnicamente reproducible y, aun así, producir una ciudad visualmente pobre. D-098 corrigió esa situación exigiendo que una fuente declarada entre realmente al render.

El siguiente paso no es reactivar aquella fábrica.

El objetivo es construir un **Building Composer basado en geometría real ya disponible**, capaz de:

- reutilizar módulos de GLB/FBX con licencia válida;
- normalizarlos a una escala común;
- combinarlos mediante reglas deterministas;
- aplicar una capa de estilo común;
- generar varias variantes visuales del mismo tipo funcional;
- producir candidatos Blender reproducibles;
- conservar procedencia por módulo;
- someter cada resultado a QA humana antes de cualquier promoción al runtime.

## 2. Principio de diseño

El compositor no modela edificios a partir de cubos genéricos.

Trabaja sobre una biblioteca modular de geometría real:

```text
source asset
→ extract/reference modules
→ normalize
→ compose
→ style normalize
→ render
→ evidence
→ human QA
→ optional runtime promotion
```

Cada edificio final debe poder rastrearse hasta los módulos que lo componen.

## 3. Resultado visual esperado

La ciudad debe ganar:

- siluetas reconocibles;
- proporciones coherentes;
- variedad controlada;
- mejor relación edificio/parcela;
- mayor riqueza de cubiertas, accesos y fachadas;
- una estética común aun cuando los módulos provengan de packs diferentes.

El objetivo NO es generar edificios hiperrealistas.

La prioridad es:

```text
legibilidad
→ silueta
→ coherencia de escala
→ materialidad
→ detalle
```

## 4. Relación con Graphic Civic

Graphic Civic sigue siendo la dirección visual base.

El Building Composer debe respetar:

- cámara isométrica/dimétrica canónica;
- iluminación fija;
- lectura clara a zoom medio;
- materiales mate;
- contraste suficiente con suelo/carreteras;
- paleta urbana controlada;
- baja densidad de ruido;
- pivote y footprint compatibles con Phaser.

No se busca imitar exactamente Kenney, Quaternius ni ningún juego histórico. Se busca una identidad Landlord coherente construida sobre módulos licenciados.

## 5. Fuentes permitidas

Sólo se pueden usar fuentes presentes en el registro de staging y aprobadas por D-083.

Cada módulo debe conservar:

- `sourceId`;
- `sourcePath`;
- licencia;
- attribution cuando aplique;
- objeto/nodo fuente;
- transformación de extracción;
- hash o firma de la fuente cuando sea viable.

No se permite:

- copiar geometría sin procedencia;
- convertir una captura o render en geometría;
- usar modelos descargados fuera del staging aprobado;
- declarar una familia visual que no participa físicamente en el resultado.

## 6. Biblioteca modular

Crear un catálogo modular versionado, por ejemplo:

```text
blender_artist/manifests/building-modules.json
```

Categorías iniciales:

```text
mass/
facade/
window/
door/
shopfront/
roof/
chimney/
canopy/
balcony/
industrial/
civic/
utility/
intrinsic-prop/
```

Un módulo representa una pieza reusable, no necesariamente un objeto independiente del pack original.

Forma conceptual:

```json
{
  "id": "facade_suburban_bay_a",
  "category": "facade",
  "sourceId": "kenney_city_kit_suburban",
  "sourcePath": ".../building-type-f.glb",
  "objectSelector": "Building/Façade_A",
  "allowedFamilies": ["residential_low"],
  "anchor": "wall_center",
  "nominalWidth": 1,
  "nominalHeight": 1,
  "license": "CC0-1.0"
}
```

Los nombres exactos se adaptarán a los assets reales.

## 7. Extracción de módulos

No asumir que los GLB existentes vienen preparados como kits.

El spike debe investigar tres estrategias, en este orden:

1. **Reutilización de objetos/nodos existentes** cuando el GLB ya tenga piezas separadas.
2. **Duplicación y recorte geométrico controlado** desde un edificio donante cuando la separación sea razonable y reproducible.
3. **Uso del edificio completo como módulo principal**, añadiendo otros módulos alrededor, cuando fragmentarlo destruya calidad.

No se debe abrir una fase de retopología manual masiva.

Si una fuente no permite extracción limpia, registrar `whole_asset_only`.

## 8. Normalización

Cada módulo importado debe normalizarse mediante un contenedor raíz, nunca alterando jerarquías internas de forma destructiva.

Normalizar:

- unidades;
- orientación;
- ground plane;
- escala;
- eje frontal;
- bounding box;
- origen lógico;
- materiales.

Registrar metadata:

- source bounds;
- import scale;
- import offset;
- module bounds;
- anchor transform.

Las comprobaciones existentes de `source_import.py` deben reutilizarse.

## 9. StyleProfile

Crear un perfil visual data-driven.

Ejemplo conceptual:

```json
{
  "id": "graphic_civic_buildings_v1",
  "floorHeightM": 3.1,
  "bevelWidthM": 0.05,
  "roofOverhangM": 0.2,
  "windowScale": 1.0,
  "doorScale": 1.0,
  "materialRoughness": 0.72,
  "saturation": 0.82,
  "contrast": 1.05,
  "paletteFamilies": ["brick", "warm_plaster", "coal", "petrol", "olive"],
  "detailDensity": 0.45
}
```

Estos valores son ilustrativos.

El agente debe medir primero los assets existentes y proponer valores derivados de fuentes aprobadas y de la Art Bible.

## 10. Qué puede normalizar el estilo

Permitido:

- material remap;
- roughness;
- metallic;
- hue/value dentro de paleta;
- bevel no destructivo;
- escala uniforme;
- pequeños cambios de proporción mediante módulos;
- repetición de bays;
- combinación de cubiertas;
- módulos de acceso;
- props intrínsecos;
- decals originales del proyecto.

No permitido:

- deformar agresivamente un asset hasta hacerlo irreconocible;
- crear texturas copiadas de otra IP;
- añadir detalles que cambien el footprint de dominio sin registrar la consecuencia.

## 11. Gramáticas de edificio

El sistema debe trabajar por familias, no por 15 scripts específicos.

Familias objetivo futuras:

```text
residential_low
residential_urban
mixed_commercial
industrial_light
industrial_heavy
civic_small
civic_medium
civic_landmark
```

Cada familia declara:

- módulos obligatorios;
- módulos opcionales;
- reglas de repetición;
- compatibilidad de cubiertas;
- materiales;
- límites de altura;
- vocabulario de silueta;
- props intrínsecos permitidos.

## 12. Determinismo

Un candidato debe poder regenerarse exactamente desde:

```text
composerVersion
+ styleProfileId
+ buildingType
+ variantSeed
+ module catalog version
```

No usar `Math.random()`.

En Python/Blender usar PRNG inicializado explícitamente o una derivación hash estable.

## 13. Identidad de variante

Forma recomendada:

```text
row_house:v1
row_house:v2
row_house:v3
row_house:v4
```

Pero el identificador persistente del candidato debe incluir versión de compositor.

Ejemplo:

```text
graphic_civic_buildings_v1:row_house:variant_02
```

## 14. Variación controlada

La variedad puede provenir de:

- módulo base;
- secuencia de bays;
- cubierta;
- chimenea;
- canopy;
- entrada;
- paleta;
- accesorios;
- pequeños cambios de altura;
- distribución de ventanas;
- props intrínsecos.

No variar:

- función visual hasta volverla irreconocible;
- número de plantas de forma incompatible con dominio;
- footprint visual más allá de tolerancia;
- escala global arbitraria.

## 15. Edificio frente a Property Grounds

V.d-7C ya tiene `property-grounds`.

El Building Composer NO debe duplicarlo.

Separación:

### Asset intrínseco

Puede contener:

- escalón;
- pequeño porche;
- canopy;
- chimenea;
- depósitos pegados al edificio;
- muelle de carga integrado;
- señalética propia;
- maquinaria inseparable.

### Property Grounds

Sigue siendo render/runtime derivado del solar:

- jardín;
- valla de parcela;
- driveway;
- patio;
- pallets externos;
- contenedores;
- vegetación del solar;
- acceso desde frontage.

No hornear en el sprite elementos cuya posición depende de la parcela concreta.

## 16. Pipeline de salida

```text
building-modules.json
+
building-composer-presets.json
+
style-profile.json
        ↓
Blender headless
        ↓
candidate .blend/.glb scene
        ↓
canonical camera/light
        ↓
PNG evidence
        ↓
metadata/provenance
        ↓
contact sheet
        ↓
visual QA
```

El spike no debe promocionar automáticamente a `runtime-assets-blender.json`.

## 17. Metadata de candidato

Cada render candidato debe registrar al menos:

- buildingType;
- variantId;
- composerVersion;
- styleProfileId;
- sourceModules[];
- source licenses;
- bounds;
- footprint visual;
- floor count;
- camera;
- render settings;
- SHA-256;
- pivot;
- provenance summary.

## 18. Validadores

Añadir validadores para impedir:

- módulo sin fuente;
- fuente fuera de staging;
- licencia no permitida;
- selector inexistente;
- familia incompatible;
- módulo duplicado accidentalmente;
- footprint fuera de tolerancia;
- edificio sin entrada/frontal cuando la familia lo exige;
- material fuera de allowlist de style profile;
- candidate sin provenance.

## 19. No promoción automática

Los candidatos se publican sólo como evidencia.

Estados posibles:

```text
generated
qa_rejected
qa_candidate
qa_approved
runtime_promoted
```

Sólo el responsable puede cambiar un candidato a `qa_approved`.

La promoción al runtime requiere una tarea posterior explícita.

## 20. Spike inicial

El spike se limita a tres tipos:

1. `row_house`
2. `cement_plant`
3. `town_hall`

Cada uno valida una familia distinta.

### row_house

Familia: `residential_low`.

Debe demostrar:

- repetición modular de fachada;
- puerta/entrada legible;
- cubierta coherente;
- escala residencial;
- 4 variantes distinguibles;
- compatibilidad con footprint 4×1.

### cement_plant

Familia: `industrial_heavy`.

Debe demostrar:

- nave/base;
- volumen industrial secundario;
- silo/tolva/tubería/chimenea cuando existan módulos adecuados;
- acceso técnico;
- masa industrial reconocible;
- 4 variantes distinguibles;
- compatibilidad con footprint 2×5.

No inventar equipamiento industrial que no pueda componerse de fuentes reales o geometría original simple claramente documentada.

### town_hall

Familia: `civic_landmark`.

Debe demostrar:

- eje de acceso;
- cuerpo central;
- jerarquía cívica;
- silueta distinta de vivienda/comercial;
- landmark reconocible sin cartel;
- 4 variantes distinguibles;
- compatibilidad con footprint 3×4.

## 21. Criterios de comparación

Para cada variante medir y revisar:

- silueta a zoom lejano;
- lectura a zoom normal;
- escala frente a personaje/vehículo;
- footprint visual;
- fachada principal;
- coherencia de materiales;
- ruido visual;
- relación con carretera;
- integración con property grounds;
- calidad de sombra;
- pivot;
- recorte;
- semejanza excesiva con asset donante;
- semejanza excesiva entre variantes.

## 22. Regla de originalidad

El resultado puede utilizar módulos licenciados, pero debe producir una composición claramente nueva.

Se debe evitar que una variante sea simplemente:

> “el GLB original renderizado con otro color”.

Para considerarse `composed`, debe cambiar de forma material al menos dos de:

- masa;
- secuencia modular;
- cubierta;
- acceso;
- volumen secundario;
- fachada;
- silueta;
- props intrínsecos.

Un simple material remap no cuenta como nueva variante.

## 23. Test de semejanza entre variantes

No hace falta visión artificial compleja en el primer spike.

Implementar heurísticas reproducibles:

- lista de módulos distinta;
- firma de composición distinta;
- bounding dimensions;
- module placement signature;
- perceptual hash opcional del render.

Si dos variantes tienen composición idéntica y sólo cambia la paleta, marcar:

```text
VARIANT_TOO_SIMILAR
```

## 24. Estados de construcción y daño

No forman parte del primer spike.

Primero aprobar la silueta `complete`.

Sólo después abrir:

```text
V.f-state-conditioning
```

para producir:

- construction;
- damaged;
- burning.

Esto evita repetir el error de generar 60 estados sobre edificios que todavía no gustan.

## 25. Orientaciones

El spike renderiza como mínimo la orientación canónica.

Si el candidato es asimétrico y se pretende runtime:

- estudiar 45/135/225/315;
- no asumir que espejo = rotación válida;
- mantener separación entre `Building.orientation` física y `allowedOrientations` visual.

La promoción runtime futura debe respetar RuntimeAssetManifestV2.

## 26. Presupuesto

El spike no tiene que cumplir todavía el budget final de runtime porque produce evidence.

Sí debe registrar:

- triángulos por composición;
- materiales;
- texturas;
- tiempo de import;
- tiempo de composición;
- tiempo de render;
- PNG size;
- memoria Blender pico cuando sea medible.

Esto permitirá decidir si bake/merge de módulos es necesario antes de promoción.

## 27. QA visual obligatoria

Generar una escena de comparación con:

- baseline procedural actual;
- evidencia Kenney directa D-098;
- cuatro variantes compuestas.

Para cada uno de los tres tipos.

Es decir, una lámina por tipo con seis columnas aproximadamente:

```text
procedural | source evidence | v1 | v2 | v3 | v4
```

No etiquetar una variante como aprobada automáticamente.

## 28. QA in-game

Si el spike técnico funciona, crear una ruta de showcase o fixture que permita visualizar los candidatos:

- junto a carreteras;
- con parcelas;
- con árboles/props;
- junto a personajes;
- a 0.5×, 1×, 2×.

No sustituir assets del juego.

## 29. Golden evidence

Crear:

```text
docs/art/golden/vf-building-composer/
```

Mínimo:

1. row-house-contact-sheet.png
2. row-house-city-context.png
3. cement-plant-contact-sheet.png
4. cement-plant-city-context.png
5. town-hall-contact-sheet.png
6. town-hall-city-context.png
7. scale-comparison.png
8. material-comparison.png
9. 1280x720.png
10. 1920x1080.png

## 30. Preguntas de aceptación humana

Para cada familia:

- ¿se reconoce el tipo sin leer texto?
- ¿parece pertenecer a Landlord?
- ¿es mejor que el procedural actual?
- ¿es mejor que usar directamente el modelo fuente?
- ¿las cuatro variantes parecen de la misma familia?
- ¿son suficientemente diferentes?
- ¿funcionan junto al terreno y las calles?
- ¿el tamaño parece correcto?
- ¿hay suficiente personalidad?
- ¿merece la pena escalar el sistema?

## 31. Criterio de éxito del spike

El spike sólo es exitoso si al menos:

- 3/3 familias producen cuatro variantes reproducibles;
- al menos 2/4 variantes de cada familia son visualmente aceptables por el responsable;
- ninguna viola provenance;
- ninguna depende de geometría inventada genérica como mecanismo principal;
- la composición se puede regenerar headless;
- la comparación in-game demuestra mejora clara sobre el baseline procedural.

Si no ocurre, no escalar a 15 edificios.

## 32. Escalado futuro

Sólo tras aprobar el spike:

```text
V.f.3 residential families
V.f.4 industrial families
V.f.5 civic families
V.f.6 mixed/commercial
V.f.7 state conditioning
V.f.8 runtime promotion
V.f.9 variant selection in gameplay
```

La selección de variante en gameplay será determinista, probablemente derivada de `BuildingId`, pero queda fuera del spike.

## 33. Non-goals

Este spike NO:

- sustituye automáticamente el runtime;
- crea 15 edificios finales;
- modifica simulación;
- modifica footprint del dominio;
- cambia economía;
- cambia V.d-7C;
- genera personajes;
- compra nuevos packs;
- usa IA generativa para crear geometría final;
- copia arquitectura de una IP histórica.

## 34. Definición de terminado

V.f Building Composer Spike queda listo para revisión humana cuando:

- catálogo modular versionado;
- style profile versionado;
- compositor headless reproducible;
- 12 variantes generadas;
- provenance validada;
- pruebas de determinismo verdes;
- contact sheets generadas;
- escenas de contexto generadas;
- métricas archivadas;
- 10 capturas revisadas técnicamente;
- runtime intacto;
- P0/P1 técnicos = 0.

El estado final permitido es:

```text
V.f BUILDING COMPOSER SPIKE — READY FOR HUMAN VISUAL REVIEW
```

No declarar `APPROVED`, `PRODUCTION COMPLETE` ni promover al runtime sin revisión humana.

---

## 35. Estado de implementación — V.f.1 (2026-11-03)

Rama `wip/vf-building-composer-spike`. Acta de la medición de fuentes:
[V.f.0](../execution/phase-4/vf0-module-inventory-2026-11-03.md).

### Pipeline construido

```text
staging licenciado (D-083/D-098)
  → building-module-inventory.json          Blender mide 517 archivos  · pnpm art:modules:inventory[:check]
  → building-modules-selection.json         curaduría humana (85 módulos, 85 archivos)
  → building-modules.json                   Blender mide la selección   · pnpm art:building-modules:build[:check]
  → validate-building-modules.mjs           gate §7 + §22               · pnpm art:building-modules:validate[:test]
```

La separación es la garantía de reproducibilidad: **las decisiones son humanas y viven en la
selección; la geometría es medida y la escribe Blender** (`measure_building_modules.py`). Un módulo
cuyo selector no aporte triángulos reales hace fallar la construcción, no se publica "declarado".

### Diferencias respecto a la propuesta (§6, §7)

* `objectSelector` es una **lista de meshes**, no una ruta de nodo: los glTF de estos packs no traen
  jerarquías nombradas por pieza (Kenney exporta un mesh por archivo con la geometría sin soldar).
* La unidad del módulo es el **archivo**, no el objeto dentro del archivo. MegaKit y KayKit ya son
  modulares a nivel de fichero (1 pieza = 1 gltf); sólo `mod_kenney_ind_windmill` selecciona 2 meshes
  (torre + palas) porque el archivo los separa. Esto corrige el supuesto de D-099 y quedó registrado
  como deuda en el acta de V.f.0.
* `anchor` no es un nombre (`"wall_center"`) sino lo que mide Blender: datum autoral, convención por
  eje, bounds respecto al origen, offsets de apoyo y el `anchorTransform` derivable de ellos.
* `nominalWidth`/`nominalHeight` pasan a `nominalBounds` en **metros de Landlord**, redondeados de la
  medición; el validador exige que coincidan con los bounds medidos a ±2 cm.
* Categorías realmente disponibles: `facade, mass, window, door, roof, chimney, canopy, industrial,
  civic, utility, intrinsic_prop`. No hay `shopfront` ni `balcony`: los packs en staging no aportan
  esa geometría separable, así que declaringlas sería inventario ficticio.

### Dos marcos de referencia (el error que cazó el gate)

`IMPORT_ROOT` lleva `scale = unitScale`, así que sus coordenadas **locales** siguen siendo las
unidades crudas del glTF. La primera versión de `moduleBounds` midió en marco local y produjo un
bloque cívico KayKit de **1,21 m** de ancho en vez de **4,83 m**. Ahora se mide en mundo (metros
normalizados, suelo Z=0) y se contrasta con el inventario de V.f.0, que es una pasada de Blender
distinta: las 85 huellas coinciden a ±2 cm. Un dato mal enmarcado habría dado edificios a un tercio
de escala sin que ningún número pareciera raro.

Segundo matiz: `originToGroundMeters` es ~0 para un módulo que ocupa todo el archivo porque
`normalize_import_root()` ya lo apoya en Z=0. Donde importa es en recortes parciales (§7.2) y en el
datum autoral: `Floor_4x4` cuelga 0,1 m bajo su origen y los bloques KayKit `*_withoutBase` dejan su
origen 0,4 m **bajo** la rasante (`datumOffsetFromGroundCenterMeters`). Apoyar por origen autoral sin
leer ese número hundiría o levantara edificios enteros.

### Ejes degenerados

`Roof_4x4`/`Roof_2x2` son planos de cubierta sin canto: su eje Z mide 0,00 m. El gate lo acepta
porque la medición declara `convention.z = "degenerate"`, y rechaza dos ejes degenerados (sería una
línea) o un eje fino no declarado como tal. Es el punto de equilibrio entre "no descartes geometría
licenciada válida" y "no aceptes imports rotos".

### Cobertura medida del catálogo `vf-1`

| familia | módulos | mass | facade | window | door | roof | resto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `residential_low` (`row_house`) | 38 | 6 | 19 | 4 | 4 | 4 | 1 canopy |
| `industrial_heavy` (`cement_plant`) | 32 | 8 | 3 | 3 | 2 | 3 | 5 industrial, 3 chimney, 3 utility, 1 canopy, 1 intrinsic_prop |
| `civic_landmark` (`town_hall`) | 65 | 6 | 26 | 8 | 4 | 7 | 6 civic, 3 canopy, 3 utility, 1 industrial, 1 intrinsic_prop |

Totales por categoría: facade 27 · mass 16 · window 9 · roof 7 · civic 6 · door 5 · industrial 5 ·
canopy 3 · utility 3 · chimney 3 · intrinsic_prop 1. El gate exige un mínimo por familia y categoría
(`mass` 2, `facade` 3, `window` 2, `door` 1, `roof` 2): sin esas piezas no hay 4 variantes
**diferentes** (§23), y se comprueba sobre el catálogo real.

### Límite con Property Grounds (§15, §22 de la especificación del spike)

Se descartaron 6 módulos candidatos que el inventario clasificaba como perfectamente utilizables:
valla de parcela, dos contenedores de envío, contenedor de residuos, jardinera y paneles solares en
suelo. No es que no sirvan: su sitio es `property-grounds` de V.d-7C y duplicarlo estaba prohibido.
El bloqueo es mecánico (lista contextual aplicada a `id`, `role` y `sourcePath` normalizando `_`/`-`
a espacio, en los dos idiomas que aparecen en los packs), no un recuerdo del autor. Lo intrínseco
permitido sí está: marquesinas, tanques y silos de proceso, chimeneas, extracción, castilletes de
agua, escalinatas, barandillas y máquina fija de cubierta.

### Reglas del gate y su prueba

Fallan: `sourceId` inexistente · `sourcePath` fuera de staging o del disco · licencia no permitida o
distinta de la registrada · selector inexistente en la fuente realmente importada · familia no
declarada · bounds inválidos (nominal ≠ medido, eje fino no declarado, fuera de escala) · anchor
inválido (datum, convención, eje frontal, levantamiento, `anchorTransform` incoherente con los
offsets) · ID duplicado · fuente declarada ≠ importada (sourceId, unitScale, licencia, jerarquía y
triángulos del archivo) · módulo puramente declarativo (0 triángulos, 0 objetos, sin materiales o
sin texturas resueltas) · categoría/estrategia fuera de vocabulario · rotaciones fuera de 90° ·
cobertura insuficiente por familia · módulo contextual (§22) · catálogo e inventario medidos con
Blender distinto.

`pnpm art:building-modules:validate:test` muta el catálogo publicado caso a caso y exige que cada
modo se detecte: **24 casos**, incluido el caso bueno —si el catálogo íntegro no pasa, los demás
fallos serían falsos—.

### Resta

V.f.2 (perfil de estilo y remap de materiales multpack, §9 y §10 de esta especificación) y
V.f.3–V.f.6 (gramáticas §11, identidad de variante §13, regla de originalidad §22, 12 candidatos,
QA visual §27 y goldens §29).

## 36. Estado de implementación — V.f.2 (2026-11-03)

`blender_artist/manifests/building-style-profiles.json`, perfil `graphic_civic_buildings_v1`. Se
genera con `pnpm art:building-style:build` y se verifica byte a byte con
`pnpm art:building-style:build:check`.

```text
building-modules.json ─┐
                       ├─ measure_building_modules.py (Blender) ─ measurements.json ─┐
staging licenciado ────┘                                                            │
                                                              preview_building_style.py (Blender)
                                                                    ↓ style-preview.json
style_layer_graphic_civic.json (sha256 registrado) ────────────────────┘
                                                       ↓
                                        scripts/build-building-style.mjs → perfil
```

### Ningún parámetro está inventado

Los 14 parámetros que pide §10 llevan `status`, `evidence[]` (medida concreta · cómo se midió ·
artefacto de origen) y `rationale`. Los números del perfil:

| parámetro | valor | de dónde sale |
| --- | --- | --- |
| `floorHeightMeters` | 3,00 m | moda de `nominalBounds.heightMeters` de los paneles de fachada y ventanal (espesor ≤ 0,6 m, alto ≥ 2,5 m), excluyendo cornisas y losas |
| `bays` | 2 m y 4 m | ancho medido de las crujías licenciadas = 0,5 y 1 celda de la retícula de 4 m |
| `doorScale` | 1 × 2,2 m | `mod_megakit_door_1/2` medidos; **enmendado** contra los 2,1 m del style layer (+4,8 %) |
| `windowScale` | sustituir módulo, nunca escalar | 9 de 9 crujías acristaladas miden exactamente la altura de piso |
| `bevel` | pasos de 0,013–0,174 m | canto resuelto en la propia geometría; muro base 0,2 m. Sin modificador: §9 lo prohíbe porque cambia la malla |
| `roofOverhangMeters` | 0,20–0,928 m | vuelo de cornisa medido sobre los módulos de remate |
| `materialRoughness` | override 0,88 sólo en factores planos | ORM enlazados miden 0,741–0,901 y se respetan; factores planos por pack: MegaKit 0,5 · Kenney 1 · KayKit 0,4 |
| `materialMetallic` | 0 salvo ORM enlazado | `T_MetalConcrete_ORM` B=0,203 y `T_Trim_ORM` B=0,042: donde el socket está enlazado el override no toca nada |
| `saturationAndValue` | sat ×1, valor ×1,55 + bandas | destino calculado por `style_pixels()` —el mismo código del render— sobre los buckets de cada atlas |
| `detailDensity` | p50 146 / p90 1 200 / max 2 960 triángulos por módulo | conteo real de triángulos importados; 25,2 / 71 triángulos por m² de fachada |
| `propScale` | 0,33–4,28 × el personaje de 1,8 m | altura medida de marquesinas, tanques, chimeneas y utility |
| `camera` | ORTHO 45°/30°, margen 0,799–1,682 (p50 1,321) | 20 encuadres de `asset-jobs.json` cruzados con la envolvente medida del inventario |
| `lighting` | key 2,35 cálido [9,16,10] · sombra 240,6° (Phaser 330,6°) | style layer canónico (sha256 `19f384d2…`) + metadato embarcado nocturno |
| `massingGrid` | 22 de 27 masas fuera de retícula de 3 m | altura medida de cada `mass` contra la moda de piso |

Dos huecos de encuadre quedan declarados como `marginsNotMeasurable`, no como estimación:
`bld_courtyard_home` es procedural y no tiene cámara en el job, y `bld_downtown_quaternius` apunta a
la exportación `FBX (Unity)`, que V.f.0 no inspeccionó (el catálogo mide los glTF del pack).

### La textura se identifica por archivo, no por nombre

Cada archivo licenciado se importa en una escena limpia, así que los tres `colormap.png` de Kenney
(comercial, industrial, suburbano) llegan todos con el nombre de datablock `colormap`. El muestreo
agrupaba por nombre y atribuía a los tres packs el color del que cargó primero. Con la identidad por
ruta el perfil registra 26 texturas y las tres colormaps dan destinos distintos: valor 0,321 · 0,412
· 0,322. Es el mismo fallo que caza §7 en la geometría, aplicado al color.

### §11: el remape no depende del pack, depende de la cadena de nodos

`apply_external_treatment` mira un solo salto del socket Base Color (`runtime_asset.py:620-622`):
sólo una `TEX_IMAGE` directa entra en la escalera de bandas nocturna. Medido sobre los 85 módulos:

* Kenney (19 archivos) y KayKit (4) son siempre directos: el tratamiento los alcanza enteros.
* MegaKit (62 módulos): **28 totalmente tratados y 34 con al menos un material en bruto**. Y no es
  una propiedad del material — `MI_Trim` aparece 10 veces con el atlas directo y 15 mezclado con el
  color de vértice; `MI_RedBrick` 4/27; `MI_Trim_MetalConcrete` 12/10. El mismo nombre de material
  entra y sale de la escalera según el archivo del que venga.
* Consecuencia medible: esas tres texturas quedan 0,271 / 0,203 / 0,192 de valor **por encima** de su
  destino nocturno (techo de aceptación 0,62), y el umbral `acceptance` sólo se comprueba sobre el
  albedo tratado. Un módulo en bruto puede pasarse de brillo sin que ningún chequeo actual lo vea.

Por eso el perfil fija la regla de composición en vez de fingir que todo está tratado: los 12
candidatos se listan por `packCoexistence.modulesRawList`, no por nombre de material, y un alzado
visible sólo mezcla módulos del mismo lado de la escalera. Extender el traversal hasta la
`TEX_IMAGE` que alimenta el MIX es trabajo declarado de V.f.4 (`requiredWork`).

### Separación de familias: comprobable, no declarada

`separacion` compara los 6 pares posibles entre las familias medibles y exige que al menos un canal
difiera (tono ≥ 20°, saturación ≥ 0,1, valor ≥ 0,06, metallic ≥ 0,1 o rugosidad ≥ 0,05). Estado
actual: **satisfecha**, y el generador `fail()` antes de publicar si algún par colapsa (§37).

| par | se separa por | deltas |
| --- | --- | --- |
| brick–plaster | tono, valor, rugosidad | 24,6° · 0,108 · 0,099 |
| brick–metal | saturación, metallic | 0,22 · 0,203 |
| brick–stone | saturación | 0,295 |
| plaster–metal | saturación, valor, rugosidad, metallic | 0,128 · 0,135 · 0,086 · 0,203 |
| plaster–stone | saturación, valor, rugosidad | 0,203 · 0,162 · 0,121 |
| metal–stone | **sólo metallic** | 0,203 (Δsaturación 0,075, Δvalor 0,027, Δrugosidad 0,035) |

Esa última fila es la razón por la que §11 prohíbe aplanar materiales: si V.f.4 uniformizara
rugosidad y metallic, metal y piedra serían indistinguibles. La prohibición queda como dato
comprobable (`knownGaps[2]`), no como consigna.

`wood` no tiene geometría licenciada en `vf-1` y `glass` existe (`MI_Glass`, 14 módulos) pero su color
no vive en un atlas mapeable: 12 instancias pasan por MIX y 2 no tienen ni Principled. Ninguna de las
dos entra en los 12 candidatos; quedan reservadas con su destino canónico y se deciden por emisión en
V.f.4. El `windowGlow` canónico se calcula texel a texel sobre el atlas, así que sólo enciende donde
la textura de color llega directa a Base Color: de los 12 atlas con buckets de color medidos, el
único cuyo bucket cae en la banda de cristal es `citybits_texture` de KayKit; los renders embarcados
registran 2–10 ventanas encendidas por edificio.

### Gates de V.f.2

`pnpm art:building-style:build:check` reproduce el perfil byte a byte ·
`pnpm art:building-modules:build:check` y `art:modules:inventory:check` siguen verdes tras el cambio
de identidad de textura (el catálogo ahora registra rutas de archivo relativas al repo, no nombres de
datablock) · `art:building-modules:validate` 85 módulos · `validate:test` 24 casos ·
`art:binaries:check` y `art:assets:check` sin cambios en manifiesto de runtime (§26: el perfil no
promociona nada).

### Resta

V.f.3–V.f.6 (compositor determinista §12–§18, gramáticas §11, identidad de variante §13, regla de
originalidad §22, 12 candidatos, QA visual §27 y goldens §29) y las dos decisiones de V.f.4 que este
perfil deja abiertas: extender el traversal a las cadenas MIX y dar emisión a los materiales de
vidrio sin atlas.
