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
