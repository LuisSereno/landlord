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

## 37. Estado de implementación — D-111 (2026-11-20): fachadas paramétricas en Geometry Nodes

### Qué se añadió al catálogo

Cinco módulos **originales** (licencia `original`, procedencia `src_original_gn_*`), generados con
Geometry Nodes en Blender 5.2.2 LTS y exportados como `.glb` para que el Composer los enlace igual que
a un megakit:

| módulo | rol | huella nominal (m) | triángulos |
| --- | --- | --- | ---: |
| `mod_gn_window_bay_2m` | `window_bay` | 2 × 0,40 × 3 | 216 |
| `mod_gn_shopfront_bay_2m` | `ground_panel` | 2 × 0,40 × 3 | 192 |
| `mod_gn_plinth_2m` | `wainscot` | 2 × 0,42 × 0,9 | 72 |
| `mod_gn_cornice_2m` | `cornice` | 2 × 0,68 × 0,55 | 120 |
| `mod_gn_balcony_door_bay_2m` | `balcony` | 2 × 0,85 × 3 | 528 |

La crujía es de 2 m porque ésa es la retícula que el Composer ya instancia; un módulo de otra huella
desplazaría pilares y dinteles y el A/B dejaría de ser una sola variable.

### El A/B se hace sustituyendo, no añadiendo

`draw_choices` elige primero receta y sólo después filtra cada eje por las `*Ids` de esa receta. Por
eso **añadir** una paleta GN a `facadePalettes` cambiaría el consumo del PRNG y el candidato saldría
con otra silueta, otra cubierta u otra orientación: la comparación mediría dos edificios distintos.
Los dos drivers de parche con los que se midió este paquete
(`tools/art-pipeline/blender/ext_lab/gn_facade_patch.py` para §3 y `ab_grammar_patch.py` para §6)
**reasignaban `roleModule` en su sitio** y, en `mixed_tenement`, fijaban `facadeIds` a la única paleta
GN. Con eso `axisChoices` salía idéntico en control y candidata y sólo difería la firma de composición.

Esa conclusión de diseño —sustituir en el sitio, no añadir opciones— sigue vigente y es la que implementa
el mecanismo de perfiles de candidato de §38. Lo que ya **no** existe es la forma: los dos drivers
reescribían `blender_artist/manifests/building-composer-grammars.json` en el árbol y devolvían el byte a
byte desde una copia en `/tmp/ab/grammar-head.json`, de modo que una corrida interrumpida dejaba el
manifiesto aprobado parcheado sin que nada lo avisara. WP06 los retiró y los sustituyó por un overlay en
memoria; el brazo v1 de §3 (`facade: brick_commercial → gn_masonry_bays`, firma `b1d36ae74df6`) añadía
una paleta nueva y por eso dejó de ser re-renderizable: un perfil no puede añadir opciones de eje porque
desplazaría el sorteo de §16 y la A/B compararía dos espacios de variantes en vez de dos autorías. La
evidencia v1 queda publicada con su `axisChoices` y su firma.

### La restricción de familia no se relajó

Los cinco módulos declaran `allowedFamilies: ["residential_low"]`. Al pedirles a `warehouse`
(`industrial_heavy`) y `town_hall` (`civic_landmark`) que resolvieran sus roles de fachada, el Composer
los cortó antes del render:

```
GrammarError: mod_gn_window_bay_2m no es compatible con la familia industrial_heavy (§7 familia incompatible)
```

Eso es el invariante funcionando, no un obstáculo: una crujía de fábrica con trim de piedra **es**
residencial por construcción. Se registró la restricción en lugar de editar la lista, y la extensión a
esas dos familias queda como WP nuevo con su propia medición
(`docs/art/graphics-capabilities/evaluations/pilots.md`).

### Resultado medido

- `mixed_tenement` (seed 2): `facade: brick_commercial → gn_masonry_bays`, mismo `quaternius_balcony`,
  misma masa, misma silueta y misma cubierta; 9 522 → 13 272 triángulos.
- `row_house` (seed 2): roles `window_bay`/`ground_panel`/`wainscot` de `stucco_trim` reasignados y
  cornisa de silueta sustituida; 14 624 → 12 152 triángulos con el mismo sprite de 996 × 1 203 px.

Ninguna de las dos se promocionó. El Composer conserva la autoridad sobre semilla, receta, validación,
procedencia y salida; `runtime-promotions.json` no se tocó.

### Gates tras el registro

`art:building-composer:validate` válido con 17 gramáticas y 15 candidatos ·
`art:building-modules:build:check` `catalog-unchanged` con 186 módulos ·
`art:building-style:build:check` `style-profile-unchanged` (31 texturas muestreadas, 4 familias
medidas por albedo, 0 pares colapsados) · `art:modules:inventory:check` `inventory-unchanged` con
1 254 fuentes · `art:catalog:check` 15/15 edificios · `art:licenses:check` verde en los tres bundles.

## 38. Estado de implementación — D-111.2 WP06 (2026-11-21): rutas de selección de candidatos

El encargo era de integración: que los brazos de WP01, WP02 y WP05 se compongan **desde una ruta
independiente de las gramáticas de producción**, una candidata por familia, y verificar huella,
orientación, altura, pivote, licencias y ausencia de colisiones evidentes. Nada de geometría nueva. La
frase que mandaba el diseño es la última: *"evitar parches temporales peligrosos que puedan dejar el repo
inconsistente"*, y era literal — el mecanismo anterior escribía
`blender_artist/manifests/building-composer-grammars.json` en el árbol y lo restauraba al terminar, así
que un proceso muerto entre el `apply` y el `revert` dejaba la gramática de producción con módulos en QA.

### Dónde vive cada pieza

| archivo | qué hace |
| --- | --- |
| `blender_artist/manifests/building-composer-candidates.json` | tres perfiles declarativos (`gn_residential_v2`, `ag_civic_v2`, `gn_industrial_v2`): qué rol se sustituye, por qué módulo, en qué familia |
| `building_composer/candidates.py` | valida el overlay contra catálogo y gramática y **aborta** en vez de ignorar lo que no muerde |
| `building_composer/grammar.py` | `GrammarDocument(candidate=…)` aplica el perfil sobre una **copia en memoria**, antes de `_check_roles` y `_check_recipes` |
| `building_composer/compose.py` | cruza `candidateProfile` del request con el del documento; si difieren, `CompositionError` |
| `scripts/build-building-composer.mjs` · `build_building_composer_context.py` | la bandera `--candidate=`, ambas con guarda de tipo declarado antes de crear `outDir` |
| `test_building_composer_candidates.py` | `art:building-composer:candidates:test`: componer los cuatro brazos **sin Blender** y comprobar las guardas |

El perfil no añade autoridad geométrica: los ids de módulo son los del catálogo medido
(`building-modules.json`), así que un candidato no puede traer geometría que no se haya importado, medido
y licenciado (§6/§7), ni opciones nuevas de eje (§16). Pasa por las mismas guardas §11/§17 que la
producción, y por eso un ancho de módulo que no encaja en la crujía corta igual que cortaría si el
propietario lo promoviera.

### Las tres formas de silencio que ya no existen

1. **Sobrescribir un rol que nadie sortea.** El parche de WP01 reasignaba `wainscot` en `mixed_tenement`,
   rol que ninguno de sus tres ritmos pide: el brazo se anunciaba "GN" llevando sólo una parte del
   cambio. Ahora es `GrammarError`, y lo mismo con `corniceModule` de `corniceRole: null`, paleta
   inexistente, rol que la paleta no publica, módulo de otra familia u overlay vacío.
2. **Esparcir el brazo por los pilotos.** `--candidate` exige `--types` explícito y corta si el perfil no
   declara el tipo pedido.
3. **Etiquetar un brazo que no se compuso.** El `candidateOverlay` que se publica en la evidencia se
   compara con `document.changes_for(tipo)`; una fila del manifiesto no puede prometer otra cosa.

### Qué salió medido

| tipo | perfil | firma | colocaciones | triángulos control → candidata | equivalencia con el brazo parcheado |
| --- | --- | --- | --- | --- | --- |
| `row_house` | `gn_residential_v2` | `5468186522ad` | 92 | 11 232 → 12 080 | differía 16 rotaciones de zócalo (el arreglo de orientación) |
| `mixed_tenement` | `gn_residential_v2` | `94f1106d02e6` | 164 | 9 522 → 14 264 | firma idéntica · **0 px** con Δ>8 |
| `warehouse` | `gn_industrial_v2` | `460b94c4e447` | 52 | 4 616 → 7 896 | firma idéntica · PNG idéntico byte a byte |
| `town_hall` | `ag_civic_v2` | `d950e513e67e` | 82 | 18 418 → 44 374 | firma idéntica · **0 px** con Δ>8 |

Las verificaciones que pide el cierre —huella, orientación, altura, pivote, licencias y colisiones, con
sus tablas— están medidas en `docs/art/graphics-capabilities/evidence/v2/README.md` (§WP06), sobre
`candidates/wp06_<tipo>-candidata.{png,json}` y la hoja `sheets/wp06_candidates_ab.png`. Resumen:
huella, orientación, plantas y pivote idénticos en las cuatro (las dos excepciones de la nave son el
pretil de WP05, declarado allí), ninguna clase nueva de licencia (`licensed=1.0` en los cuatro renders),
ninguna clase nueva de par colisionante en tres de las cuatro, y las dos que aparecen en la nave están
por debajo del peor par que ya toleraba su propio control.

### La orientación de los módulos GN también estaba mal

`mod_gn_plinth_2m` y `mod_gn_cornice_2m` se habían autorizado con la caja centrada, así que el inventario
deducía `pivot.convention: centered` → `frontAxis: symmetric-Y`, `anchors.rotation_for` no los giraba y
el relieve quedaba mirando al interior del volumen: a 0,5× el zócalo leía como paño liso, que era la
deuda visible que WP01 dejó apuntada "para el ciclo de integración". `gn_facade_grammar.py` escribe ahora
el origen en el plano posterior; con eso `frontAxis` sale `+Y` y 16 rotaciones del zócalo se invierten
sobre las mismas posiciones. El coste documentado: `.blend`, los dos `.glb`, su informe de medidas y los
tres manifiestos derivados (inventario, catálogo, perfil de estilo) se re-estampan, y el contrato de
envejecimiento de WP04, que pinea el catálogo byte a byte, cortó con `f68d666edc11 ≠ 3d159acc9685` —el
tripwire haciendo su trabajo— y volvió a verde con los dos hashes actualizados y la razón escrita en su
`pins.restamped`.

### Gates tras WP06 (2026-11-21, medidos)

`art:building-composer:candidates:test` OK (3 perfiles, 4 controles re-compuestos sin perfil, 10 sondas de
guarda) · `art:building-composer:validate` válido con 17 gramáticas y 15 candidatos ·
`art:building-composer:validate:test` 52 casos · `art:building-composer:geometry:test` 354 anclajes heavy
y 5 fachadas identitarias · `art:weathering:contract:test` OK con 8 familias y 9 citas ·
`art:modules:inventory:check` `inventory-unchanged` 1 259 fuentes · `art:building-modules:build:check`
`catalog-unchanged` 191 módulos · `art:building-style:build:check` `style-profile-unchanged` (31 texturas,
4 familias por albedo, 0 pares colapsados) · `art:catalog:check` 15/15 edificios · `art:licenses:check`
verde en los tres bundles · `art:capabilities:check` verde. `art:fx-lab:*` no se re-corre: WP06 no toca
el camino de Phaser.

### Resta, declarada y no arreglada por este paquete

- **Promoción.** `runtime-promotions.json` no se toca: los cuatro brazos siguen siendo evidencia
  revisable, y promoverlos a la gramática aprobada es decisión del responsable con su commit.
- **Esquina cívica a pico.** Se cierra con geometría nueva montada sobre el extremo de la banda (el
  precedente es `requiredFeatures.facade_pilasters`), no con la gramática: forzar `brick_post` compone
  0/60 semillas y limitarlo a `municipal_block` mueve 56 de 105 colocaciones y pierde 2 m de fondo.
- **`mod_gn_shopfront_bay_2m` sin ruta legal.** Ningún ritmo de `residential_low` sortea `ground_panel`,
  y declararlo está medido que corta por `SEMANTIC_IDENTITY_INCOMPLETE`: la guarda de
  `requireGroundCommercial` exige acristalamiento de planta baja con rol `window_bay` o `curtain_wall`.
  Es identidad semántica de la familia, no un obstáculo del perfil.
- **`metal_brick_mix` es no-op** en HEAD (sólo se diferencia de `steel_cladding` en que no ofrece
  `curtain_wall`; su `ground_panel` nunca se sortea). Enmienda de gramática → responsable.
- **El pin del contrato de envejecimiento es byte-exacto** sobre un manifiesto de 25 000 líneas, así que
  corta por cualquier metadato inocuo. Acotarlo al subconjunto medido es decisión del responsable
  (WP09); mientras, lo sostiene `check_family_coverage`, que compara el vocabulario contra el perfil vivo.
- **El brazo v1 de §3** (`gn_masonry_bays`, firma `b1d36ae74df6`) ya no es re-renderizable porque añadía
  una paleta y un perfil no añade opciones de eje. Su evidencia queda publicada con `axisChoices` y firma.

## 39. Cómo generar y revisar un nuevo edificio con las capacidades actuales (D-111.2 cierre)

El procedimiento completo, reutilizable sin depender de ninguna conversación:

1. **Familia y módulos.** Elige el tipo (su gramática y familia viven en
   `blender_artist/manifests/building-composer-grammars.json`) y, si el encargo es de autoría,
   decláralo como perfil de candidato en `blender_artist/manifests/building-composer-candidates.json`
   — un overlay por rol que pasa las mismas guardas §11/§17 que producción (WP06).
2. **Composición y render offline.**
   `node scripts/build-building-composer.mjs --types=<tipo> --seeds=<n> --states=<estado>`
   `--mood=<mood> [--candidate=<perfil>] --outDir=<staging> --metrics=<json> --keepAttempts`.
   El manifiesto publicado incluye firma de composición, pivote, huella, px/m, `fireAnchors` en
   metros (si el estado arde) y los checks de escena. Para la variante QA de fuego híbrido añade
   `--qaFlamePeakEmission=<pico>` (sólo llega por request; producción renderiza 1,35).
3. **Materiales y condición.** El tier de conservación es MATERIAL (`conserved`/`aged` vía
   `--weathering=`) y el daño es GEOMETRÍA (`damaged`/`burning`); el contrato vive en
   `blender_artist/manifests/building-weathering-contract.json` y su proyección en runtime la
   resuelve `apps/web/src/isometric/building-condition.ts` a partir de
   `state/condition/structuralIntegrity` — un operativo con estructura intacta nunca dibuja geometría
   de ruina.
4. **Render y validación.** El validador es UNO:
   `node scripts/validate-building-composer.mjs` valida gramáticas contra catálogo, determinismo
   §13/§14/§16, las promociones de runtime y —desde el cierre— los cuatro perfiles candidatos WP06.
   `pnpm art:capabilities:check` mantiene el catálogo de capacidades.
5. **Carga en Phaser QA.** Copia el PNG+JSON a `apps/web/dist/qa-candidates/` (el arnés lo hace) y
   usa una de las dos rutas explícitas: `?fxCandidate=<nombre>` en `/art-lab` (laboratorio) o
   `__landlordCameraTest.placeCandidateQa(...)` (mundo real). Ninguna sirve en producción ni toca
   `runtime-promotions.json`.
6. **Captura visual.** Arnéses de referencia: `scripts/hybrid-fire-capture.mjs` (fuego híbrido con
   verificación de anclajes por `scripts/hybrid-fire-anchor-check.py`),
   `scripts/candidate-phaser-capture.mjs` (pareja control/candidata sobre el mundo real a 1× y 0,5×,
   terreno verificado por píxel) y `scripts/building-condition-capture.mjs` (los cuatro casos de
   condición con la textura que el renderizador realmente seleccionó).
7. **Índice y gates.** `python3 scripts/wp08-index.py` regenera `evidence/INDEX.md`; `--check`
   juzga por brazo y sale 0 con 0 defectos duros; los históricos sin procedencia quedan
   `legacy_unverified` y aislados.
8. **Solicitud de aprobación.** El cierre es `READY FOR HUMAN VISUAL REVIEW` en
   `D1112-CLOSURE-LEDGER.md`; la promoción a producción (`runtime-promotions.json`) exige aprobación
   humana explícita y jamás la ejecuta un arnés.
