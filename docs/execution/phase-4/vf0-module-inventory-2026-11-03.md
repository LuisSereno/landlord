# V.f.0 — Inventario medido de geometría de fuente (2026-11-03)

Estado: **EJECUTADO en `wip/vf-building-composer-spike`**. Decisión del spike: **continuar a V.f.1**
(ninguna condición de parada §37 se cumple). Ramas `develop` y `wip/ve-integrated-correction`
intactas.

## Motivo

La especificación V.f (§4) prohíbe inventar la viabilidad del Building Composer a partir de los
nombres de los archivos: *"INSPECCIONA LOS GLB/FBX REALES. No te limites a sus nombres."* Este WP
produce el inventario físico que decide si puede componerse geometría propia con la fuente ya
licenciada en staging, o si el spike debe declararse `MODULE_EXTRACTION_NOT_VIABLE`.

## Herramienta

- `tools/art-pipeline/blender/inventory_building_modules.py`: importa cada archivo con la ruta real
  del pipeline (`import_source` → `fix_texture_paths` → `normalize_import_root`), y mide jerarquía,
  objetos, triángulos, materiales, imágenes, dimensiones normalizadas en metros, componentes conexas
  (union-find sobre aristas), share de la pieza dominante, resolución de texturas y convención de
  pivot. Clasifica con una regla determinista derivada de lo medido.
- `scripts/inventory-building-modules.mjs`: construye el ámbito sólo con fuentes registradas en
  `blender_artist/manifests/staging-sources.json` (D-083/D-098 — el spike **no** descarga packs
  nuevos), resuelve licencia y `unitScale` desde el registro, invoca Blender headless y escribe el
  manifiesto.
- Salida: `blender_artist/manifests/building-module-inventory.json` (517 entradas, 1 364 793 bytes).
- Gates: `pnpm art:modules:inventory` regenera el manifiesto; `pnpm art:modules:inventory:check`
  vuelve a medir y exige byte-identidad. Medido: la segunda pasada sobre los 517 archivos produce
  `{"status":"inventory-unchanged","sources":517}`. La evidencia de este acta es reproducible, no
  una captura única.

Entorno de medición: Blender 5.2.2 LTS (hash `d13f752e3b9c`), 517 archivos en **16.0 s** de wall
clock, pico de RSS **448 MiB** (458 392 kB medidos con `/usr/bin/time -v`). Cero fallos de import,
cero texturas sin resolver.

## Ámbito y resultado

| fuente | archivos | modular | partially | whole_asset | sin resolver |
| --- | --- | --- | --- | --- | --- |
| `src_quaternius_downtown_city_megakit` | 153 | 0 | 0 | 153 | 0 |
| `src_kenney_city_roads` | 95 | 1 | 0 | 94 | 0 |
| `src_kenney_nature_kit` | 109 | 2 | 0 | 107 | 0 |
| `src_kenney_city_commercial` | 41 | 0 | 0 | 41 | 0 |
| `src_kenney_city_suburban` | 40 | 0 | 0 | 40 | 0 |
| `src_kenney_city_industrial` | 37 | 0 | 2 | 35 | 0 |
| `src_kenney_car_kit` | 15 | 15 | 0 | 0 | 0 |
| `src_kaykit_city_builder_bits` | 27 | 0 | 0 | 27 | 0 |
| **total** | **517** | **18** | **2** | **497** | **0** |

## Hallazgo 1 — la modularidad vive a nivel de ARCHIVO, no de objeto

`whole_asset_only` dominates (497/517) y eso **no** es un fracaso: es la forma en que estos packs
están publicados. MegaKit entrega 153 archivos, cada uno un módulo (`Brick_Plain_3`,
`Roof_Slate_Center`, `Trim_Column_Top`, `Door_1`, `Cornice_Trim_Center`…). KayKit entrega 27
prefabs. Kenney entrega 118 edificios completos. Los 18 `modular` son coches de `car-kit`
(5–6 objetos malla por archivo: carrocería + ruedas) — la regla detecta fragmentación real donde
existe, que es lo que se le pide.

Consecuencia de diseño para V.f.1: **el catálogo de módulos referencia rutas de archivo**, y la
`objectSelector` se usa sólo cuando un archivo aporta más de una pieza útil. Esto es una corrección
explícita al esquema de D-099, que suponía selecciones de nodo dentro de un GLB.

## Hallazgo 2 — los GLB de Kenney no fragmentan: vienen sin soldar

`building-type-f.glb`: 1 objeto malla, 2 644 vértices, 1 616 triángulos y **554 componentes
conexas**, la mayor de 14 triángulos (0.9 % de la masa). `building-c.glb`: 737 cáscaras. El glTF
exporta geometría con vértices sin soldar (UVs y normales partidas), así que contar cáscaras sin
filtro clasificaría cualquier edificio kenney como "kit modular" cuando fragmentarlo sería
reconstruirlo a mano — exactamente el atajo que D-098 prohíbe disfrazar.

Por eso la regla de clasificación exige **unidades sustanciales**: objetos raíz independientes o
componentes conexas que pesen ≥ 10 % de los triángulos, con tamaño mínimo 0.25 m y 24 triángulos.
Sin el umbral, el inventario habría mentido.

## Hallazgo 3 — MegaKit trae una gramática de fachada autorada y consistente

Medido sobre los 153 archivos:

- **37 paneles de fachada** con altura exacta **3.00 m**, origen en la base (`z: positive-from-origin`)
  y X centrado; 20 de ellos de ancho **2.00 m** exacto, 7 de **4.00 m**; 17 llevan `MI_Glass`.
- **31 piezas de esquina/ángulo** (`90Angle_L/R`, `Corner`, `InnerCorner`) para cerrar el perímetro.
- Familias: `Brick` 38, `Cornice` 15, `Metal` 14, `Roof` 13, `Trim` 11, `DoorFrame` 3, `Door` 3,
  `Stairs` 4, `Entrance` 2, `Floor` 3, `Prop` 5, `Sidewalk` 8, `Street` 14, `Decal` 17, `Building` 3.
- **21 materiales PBR** con atlas independientes (`MI_RedBrick`, `MI_Trim`, `MI_Glass`,
  `MI_Roof_Slate`, `MI_Trim_MetalConcrete`, `MI_InteriorWall`, `MI_FakeInterior`…), todos con
  texturas resueltas en `…/downtown-city-megakit/Textures/`.
- Tres edificios ya ensamblados por el autor como referencia de la gramática:
  `Building_Large_2` (20.64 × 16.64 × 28.00 m, 45 122 tri), `Building_Medium_2_001`
  (15.06 × 13.06 × 25.01 m, 25 612 tri), `Building_Small_1` (12.46 × 14.54 × 17.03 m, 18 344 tri).
  Sirven de techo de calidad esperado, no de módulo.

Convención de pivot por eje (medida, no supuesta) para los módulos que entrará al catálogo:

| módulo | rel X | rel Y | rel Z | convención |
| --- | --- | --- | --- | --- |
| `Brick_Plain_3` | −1 … 1 | 0 … 0.2 | 0 … 3 | X centrado, muro hacia +Y, base en origen |
| `Metal_Window` | −2 … 2 | 0 … 0.224 | 0 … 3 | idem, panel de 4 m |
| `Brick_Window_Trim_Single` | −1 … 1 | −0.044 … 0.232 | 0 … 3 | moldura sobresale por delante |
| `Door_1` | −1 … 0 | −0.13 … 0.13 | 0 … 2.2 | hueco a la izquierda del origen |
| `Roof_Slate_Center` | −1 … 1 | 0 … 2 | 0 … 3 | faldón de 2 m, peralte 3 m |
| `Trim_Column_Top` | ±0.362 | ±0.362 | 0 … 3 | columna centrada, apila vertical |
| `Floor_4x4` | ±2 | ±2 | −0.1 … 0 | loseta **colgando** del origen |
| `Stairs_Entrance_Concrete` | ±1 | −1.991 … 0 | 0 … 1.007 | arranque hacia −Y |

`Floor_4x4` y `Roof_4x4` son los únicos con Z `negative-from-origin`/`degenerate`: el compositor no
puede tratar todos los anclajes igual, y por eso el anchor queda declarado por módulo en V.f.1.

## Mediciones que alimentan el StyleProfile (§10)

Ninguno de estos números estaba documentado; todos salen del inventario:

| parámetro | medido | fuente de la medición |
| --- | --- | --- |
| altura de planta | **3.00 m** | 55 archivos MegaKit a altura exacta 3.0 |
| ancho de crujía | **2.00 m** (y **4.00 m**) | 58 archivos a ancho 2.0, 9 a ancho 4.0 |
| espesor de muro | **0.20 m** (0.19–0.30 con molduras) | moda del eje Y en paneles |
| alto de puerta | **2.20 m** | `Door_1/2/3` miden 1.00 × ~0.22 × 2.20 |
| alto de cornisa/módulo de remate | **1.00 m** | `Cornice_*` (15 archivos) |
| grosor de loseta/forjado | **0.10 m** | `Floor_2x2`, `Floor_4x4`, `Floor_Inset` |
| alcorque/acera | **0.15 m** | `Sidewalk_*`, `Street_*` |
| faldón de tejado | **2.00 m**, peralte 3.00–3.20 m | `Roof_Slate_*` |
| celda de dominio | **4.00 m** | `unitScale` Kenney = 4.0; 2 crujías MegaKit por celda |

Encaje con lo ya declarado: `style_layer_graphic_civic.json` fijaba `buildingFloorHeight: 3.0`
(coincide exacto), `cellSizeMeters: 4.0` (coincide: 2 crujías de 2 m), y `doorHeight: 2.1`
(**0.1 m por debajo de lo medido** en el kit; V.f.2 adoptará 2.2 con la medición como evidencia).

Contraste con Kenney, que es otra escala: `building-type-f` mide 5.71 × 5.62 × 4.55 m y
`chimney-large` 4.32 × 4.32 × 6.80 m. Un edificio kenney no se divide; se compone **con otros
enteros** (edificio + chimeneas + tanques + depósitos), que es la gramática de `cement_plant`.

## Falsos negativos corregidos durante la medición

Documentados porque son deuda de la herramienta, no del arte:

1. `vertices` se sumaba como `triangles` en la ficha de objeto → separados los dos totales.
2. Union-find calculado dos veces (jerarquía y piezas) → un solo recorrido por malla; los GLB de
   Kenney superan los 2 000 vértices y repetir el análisis duplicaba el coste.
3. `MeshPolygon.vertex_indices` no existe en Blender 5.2.2 → `polygon.vertices`.
4. La regla de geometría degenerada miraba sólo el eje X: 28 fuentes (postes, farolas, señales,
   columnas y bolardos) salían como `unsuitable` con 0.25–0.4 m de ancho **siendo módulos legítimos**.
   Ahora se mide el eje mayor y ninguna fuente queda ya en `unsuitable`.
5. Contar cáscaras sin umbral de masa (Hallazgo 2) habría declarado modulares los 118 edificios
   Kenney.

## Evaluación de las condiciones de parada (§37)

| condición | veredicto | evidencia |
| --- | --- | --- |
| la extracción exige modelado manual extensivo | **NO** | 37 paneles + 31 esquinas + 15 cornisas + 13 tejados + 6 puertas ya autorados con pivot consistente |
| la fuente llega soldada/inutilizable | **NO** | la modularidad existe a nivel de archivo; no hace falta fragmentar nada |
| la masa visible volvería a ser primitivas | **NO** (por construcción) | V.f.3 registrará `licensedGeometryRatio` y `original_support[]` con umbrales |
| las variantes sólo diferirían en color | **pendiente de V.f.5** | el generador de variantes tendrá el test `VARIANT_TOO_SIMILAR` |
| la procedencia no sería demostrable | **NO** | 517 rutas reales, licencia CC0-1.0 resuelta desde el registro, 0 import fallidos |
| licencia poco clara | **NO** | las 8 fuentes del ámbito son CC0-1.0 en `staging-sources.json` |
| exigiría tocar dominio o runtime | **NO** por ahora | ningún cambio en `packages/simulation`; la evidencia irá a `target: "evidence"` |
| el resultado sería peor que renderizar la fuente directa | **pendiente de V.f.6** | se evalúa en las hojas de contacto contra la evidencia D-098 |

**Decisión: no hay STOP.** El camino viable no es "trocear un edificio Kenney", sino dos gramáticas
distintas según familia, ambas con geometría licenciada real.

## Gramáticas elegidas para V.f.3–V.f.6

- **`residential_low` (`row_house`, huella 4×1 = 16 × 4 m, 2 plantas)** — gramática de crujías con
  MegaKit: muros `Brick_Plain_3` / `Brick_Inset`, ventanas `Brick_Window_*` / `Metal_Window`,
  esquinas `Brick_90Angle_*` y `Brick_Corner_Plain`, puerta `Door_*` + `DoorFrame_Wooden`, remate
  `Cornice_Brick_*` + `Brick_TopTrim`, cubierta `Roof_Slate_*` con `Window_1` (dormer).
- **`industrial_heavy` (`cement_plant`, huella 5×2 = 20 × 8 m, 2 plantas)** — gramática de
  **enteros sueltos** con Kenney industrial: naves `building-a/b/c/g/q/r`, `chimney-*`,
  `detail-tank*`, `water-tower`, `shipping-container-*`, `solar-panel-*`, detallada con MegaKit
  `Metal_*` y `Prop_ACUnit`.
- **`civic_landmark` (`town_hall`, huella 8×4 = 32 × 16 m, 3 plantas)** — gramática monumental con
  MegaKit: zócalo `Trim_FirstFloor_Wall` / `Metal_FirstFloor_Wall`, columnata `Trim_Column_*` y
  `Brick_Column_*`, acceso `Stairs_Entrance_Concrete` + `Entrance_Concrete_2x2`, fachada
  `Brick_RedWhite_DoubleWindow` / `Brick_Window_CurvedDouble`, cornisas `Cornice_Trim_*` y remate
  `Roof_4x4` / `Roof_2x2_90Angle_*`.

## Deuda registrada (no se arregla en este WP)

1. **Notación de huellas.** `building-catalog.json` declara `2×5` (cement_plant) y `3×4`
   (town_hall) mientras `packages/simulation/src/game-data.ts` declara
   `preferredFootprint {width: 5, height: 2}` y `{width: 4, height: 3}`. Son equivalentes bajo
   `shapePenalty` (que tolera rotación de 90° en `packages/simulation/src/footprints.ts:51-65`),
   pero la notación invertida invites a leer mal el ancho. El compositor usará la notación del
   dominio. Pendiente de alinearse en el catálogo.
2. **D-099 desactualizado.** Su esquema de módulos asumía `objectSelector` dentro de un GLB. Los
   datos obligan a que la unidad de módulo sea el archivo. Se documentará en el acta final; no se
   reescribe la decisión sin que el responsable la vea.
3. **`nature-kit` no tiene atlas** (109/109 archivos con 0 imágenes): son materiales planos. Para
   la escena de contexto §29 el follaje pasará por `flatMaterials` del style layer, no por
   remapeo de atlas.

## Siguiente paso

V.f.1 — `blender_artist/manifests/building-modules.json` + `pnpm art:building-modules:validate`,
con los módulos que este inventario justifica y el anclaje medido de cada uno.
