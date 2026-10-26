# Bootstrap artístico sin dependencia externa

> Versión: 0.1
>
> Estado: estrategia de preproducción para Gate 2 / Visual Direction Spike.
>
> Objetivo: permitir que Landlord avance artísticamente con coste cercano a 0 EUR y sin depender de contratar un artista o encontrar colaboradores especializados durante las primeras fases.

## 1. Principio

La estrategia no consiste en intentar sustituir a un artista dibujando manualmente peor.

Consiste en convertir el arte en una cadena de producción asistida:

```text
assets base CC0
+ modificación procedural
+ Blender
+ IA para concept/reference
+ render automatizado
+ atlas/metadata
+ Phaser
```

El valor propio de Landlord debe surgir de:

- dirección visual;
- cámara;
- iluminación;
- materiales;
- proporciones;
- composición;
- estados de deterioro/progreso;
- props;
- color;
- UI;
- reglas de legibilidad;
- combinación y transformación de módulos.

No del aspecto bruto de un pack externo.

## 2. Objetivo económico

Para Visual Direction Spike y primeras fases de Gate 2:

```text
objetivo de gasto artístico directo: 0 EUR
```

No se prohíbe comprar un asset futuro si ahorra una cantidad significativa de trabajo, pero cualquier compra debe justificar:

- necesidad;
- ahorro;
- compatibilidad de licencia;
- uso en repositorio público;
- imposibilidad o coste elevado de resolverlo con la librería actual.

No contratar artista externo como dependencia del camino crítico en estas fases.

## 3. Toolchain local confirmado

El propietario del proyecto ha instalado localmente:

- Blender 5.2.2 LTS.

Blender no se distribuye dentro del repositorio. El pipeline deberá documentar cómo instalar la versión fijada y comprobarla automáticamente.

Fuente oficial:
https://www.blender.org/releases/5-2/

## 4. Librería bootstrap descargada localmente

Los siguientes recursos ya han sido descargados por el propietario del proyecto. Todavía no deben asumirse como presentes en Git.

### Quaternius

#### Downtown City MegaKit — Standard
Uso previsto:
- geometría modular de edificios urbanos;
- bloques residenciales/comerciales;
- piezas de calle;
- prototipos de Building Factory.

Fuente:
https://quaternius.itch.io/downtown-city-megakit

Estado de licencia verificado en la ficha seleccionada:
- CC0.

#### Universal Base Characters — Standard
Uso previsto:
- base de Character Factory;
- proporciones de personajes;
- hairstyles;
- rig humanoide;
- variaciones offline.

Fuente:
https://quaternius.itch.io/universal-base-characters

Estado de licencia verificado en la ficha seleccionada:
- CC0.

#### Universal Animation Library — Standard
Uso previsto:
- locomoción;
- idle;
- push;
- sit;
- animaciones auxiliares;
- validación de 8 direcciones.

Fuente:
https://quaternius.itch.io/universal-animation-library

Estado de licencia verificado en la ficha seleccionada:
- CC0.

#### Universal Animation Library 2 — Standard
Uso previsto:
- acciones de trabajo y farming como referencia de movimiento;
- parkour y locomoción auxiliar sólo si una escena de prueba lo requiere;
- validación de compatibilidad con el mismo rig humanoide.

Fuente:
https://quaternius.itch.io/universal-animation-library-2

Estado de licencia verificado en la ficha seleccionada:
- CC0.

### Kenney

Todos los siguientes packs se usarán principalmente como base, placeholder o geometría auxiliar, no como identidad final.

#### City Kit Industrial
https://kenney.nl/assets/city-kit-industrial

Uso:
- fábricas;
- warehouses;
- utilities;
- elementos industriales.

#### City Kit Commercial
https://kenney.nl/assets/city-kit-commercial

Uso:
- comercio;
- oficinas;
- volúmenes urbanos;
- referencias de modularidad.

#### City Kit Roads
https://kenney.nl/assets/city-kit-roads

Uso:
- carreteras;
- cruces;
- señales;
- prototipos de road kit.

#### UI Pack
https://kenney.nl/assets/ui-pack

Uso:
- placeholders funcionales;
- controles temporales;
- prototipado de HUD.

No define la UI final de Landlord.

#### UI Audio
https://kenney.nl/assets/ui-audio

Uso:
- feedback temporal de botones/acciones.

Estado de licencia general de los game assets de Kenney:
- CC0.

### Poly Haven — fuentes 4K, derivados objetivo 2K

El staging local verificado contiene fuentes `.blend.zip` 4K. El pipeline debe generar derivados
2K para el bootstrap salvo que una medición justifique otra resolución. No descargar 8K/16K sin
necesidad medida.

#### Red Brick 03
https://polyhaven.com/a/red_brick_03

Uso:
- ladrillo industrial;
- warehouses;
- fábricas.

#### Red Bricks 02
https://polyhaven.com/a/red_bricks_02

Uso:
- deterioro;
- fachadas envejecidas;
- estados neglected/damaged.

#### Asphalt 07
https://polyhaven.com/a/asphalt_07

Uso:
- carretera;
- patios;
- superficies urbanas.

#### Concrete Wall 003
https://polyhaven.com/a/concrete_wall_003

Uso:
- industria;
- warehouses;
- edificios de servicio.

#### Rusty Metal 02
https://polyhaven.com/a/rusty_metal_02

Uso:
- puertas;
- cubiertas;
- maquinaria;
- tuberías;
- assets deteriorados.

#### Wood Planks Grey
https://polyhaven.com/a/wood_planks_grey

Uso:
- boarding;
- fences;
- construcción;
- edificios económicos/abandonados.

Estado de licencia de Poly Haven:
- CC0 para sus assets.

### Microsoft Rocketbox — avatares rigged (MIT, no CC0)

https://github.com/microsoft/Microsoft-Rocketbox

Motivo de inclusión: los Universal Base Characters de Quaternius son cuerpos sin ropa
(sólo ropa interior) y no existe ningún pack CC0 de ropa urbana para trabajadores de
ciudad. Rocketbox aporta 115 avatares ya vestidos —la ropa va horneada en el difuso del
cuerpo— con rig completo y niveles de polígono (hipoly / midpoly / lowpoly / ultralowpoly).

Estado de licencia:

- MIT License, Copyright (c) 2020 Microsoft (relicenciada a MIT en 12/2020).
- Verificado vía API de GitHub: `license.spdx_id = MIT`.
- MIT permite uso comercial, modificación, distribución y sublicencia.
- Única obligación: conservar el aviso de copyright y el texto de la licencia en las
  copias o porciones sustanciales del material.

Compromiso de atribución:

- `LICENSE-MIT.txt` junto al staging local.
- Mención en los créditos del juego: personajes base derivados de Microsoft Rocketbox.

Procedencia:

- Repositorio archivado (read-only) el 2026-10-02.
- Commit: `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
- Obtenido por `git clone` el 2026-10-26.

Subconjunto conservado en `blender_artist/staging/third_party/mit/rocketbox/` (staging local,
ignorado por Git):

| Avatar               | Ropa visible                        | Rol visual candidato        |
| -------------------- | ----------------------------------- | --------------------------- |
| Male_Adult_02        | jersey claro + pantalón oscuro      | oficinista / civil          |
| Male_Adult_03        | americana tweed + camisa roja       | empresario / político       |
| Male_Adult_05        | chaleco utilitario verde            | obrero                      |
| Male_Adult_09        | camiseta oscura + vaqueros          | civil                       |
| Male_Adult_10        | chaqueta deportiva roja             | matón / enforcement         |
| Male_Adult_12        | cazadora vaquera + camisa blanca    | civil                       |
| Female_Adult_04      | chaqueta de cuero + cargo + botas   | enforcement femenino        |
| Female_Adult_09      | blazer gris + camisa blanca         | profesional / política      |
| Female_Adult_13      | chaleco + vaqueros                  | obrera                      |

Animaciones (hay 417 en el pack; se conservan 15):

- `animations/walk/`: `m_walk_neutral*`, `f_walk_neutral*`.
- `animations/idle/`: `m_idle_breathe*`, `f_idle_breathe*`, `m_idle_neutral*`.

Descartado por presupuesto de disco local:

- `Assets/Animals` (27 modelos, 719 MB): no hay fauna jugable en el slice.
- El resto de avatares y librerías de animación (≈6 GB): son volver a descargar del
  repositorio archivado cuando haga falta.

Advertencias de formato:

- Los FBX salen de 3ds Max y referencian texturas `.tga` con rutas absolutas de Windows,
  igual que los FBX de Quaternius; hay que remapear rutas al importar.
- Cada avatar trae dos FBX: `<Name>.fbx` (cuerpo) y `<Name>_facial.fbx` (blendshapes
  faciales, innecesarios para sprites isométricos).

### Escala física de las fuentes

Medido con `tools/art-pipeline/blender/measure_asset_fixtures.py` sobre 8 fixtures reales
(informe en `blender_artist/manifests/asset-metrics.json`). Las dimensiones son **tal como
sale del importador, sin escalar**:

| Fixture                          | Categoría | x × y × z (unidades fuente) |
| -------------------------------- | --------- | --------------------------- |
| Kenney commercial `building-a`   | edificio  | 0.88 × 0.94 × 1.29          |
| Kenney suburban `building-type-u`| edificio  | 1.43 × 1.09 × 1.14          |
| Kenney roads `road-straight`     | terreno   | 1.00 × 1.00 × 0.02          |
| Kenney roads `road-curve`        | terreno   | 2.00 × 2.00 × 0.02          |
| Kenney car kit `police`          | vehículo  | 1.50 × 3.10 × 1.30          |
| Kenney nature `tree_pineTallB_d` | prop      | 0.39 × 0.39 × 1.94          |
| KayKit `building_A`              | edificio  | 2.00 × 2.00 × 1.65          |
| KayKit `bench`                   | prop      | 0.40 × 0.15 × 0.10          |
| Quaternius `Building_Medium_2`   | edificio  | 15.06 × 13.06 × 25.01       |
| Rocketbox `Male_Adult_05`        | personaje | 1.35 × 0.37 × **1.812 m**   |

Lectura: **cada pack está autorreferido a su propia unidad**, no a los metros de Landlord.

- Quaternius y Rocketbox ya están en metros (edificio de 25 m, persona de 1.812 m).
- Los city kits de Kenney están en **casillas**: una losa de carretera mide 1×1 y una curva 2×2.
  Con `cellSizeMeters: 4.0` del style layer, 1 unidad = 1 celda = 4 m deja el edificio comercial
  en 3.5 × 3.8 × 5.2 m y el pino en 7.7 m de alto.
- KayKit usa casillas de 2 unidades: a 4 m/unidad el banco sale de 1.6 × 0.6 × 0.4 m, que es
  exactamente un banco real.
- **El car kit de Kenney NO comparte unidad con el city kit**: a 4 m/unidad una furgonetta
  mediría 6 m de ancha. A 1.3 m/unidad sale 1.95 × 4.03 × 1.69 m, que es un coche real.

Por eso `unitScale` es un **dato declarado por fuente** en
`blender_artist/manifests/staging-sources.json` y no una heurística sobre la bounding box: un
coche grande y un edificio pequeño confundirían cualquier inferencia. Un job puede
sobrescribirlo sólo como excepción documentada.

Desde WP4.15-V.a la normalización lo aplica y lo registra en cada render (`sourceBounds`,
`importScale`, `importOffset`, `worldSizeMeters`). Medido sobre los cuatro fixtures reales:
Kenney `building-a` 1.29 → **5.17 m** con `unitScale` 4; Quaternius `Building_Medium_2` 25.01 →
**25.01 m** con 1; Rocketbox `Male_Adult_05` 1.8124 → **1.812 m** con 1, conservando su armadura
`Bip01` de 80 huesos; Kenney `road-straight` 0.02 → **0.08 m** de firme sobre loseta de 4 m.

Comprobación que debe pasar (ASSET SCALE GATE del STOP V1): personaje coherente con la puerta
(1.8 m contra 2.1 m), coche cabiendo en el carril, árbol coherente con el edificio y edificio
coherente con su footprint.

## 5. Regla de repositorio

Que un recurso sea CC0 no significa que debamos copiar inmediatamente todos los ZIP al repositorio.

Antes de incorporar binarios de terceros:

1. aprobar política Git LFS;
2. definir carpeta de third-party sources;
3. guardar provenance;
4. guardar evidencia/licencia;
5. registrar URL y versión/fecha de obtención;
6. decidir si necesitamos el source completo o sólo outputs derivados;
7. evitar inflar innecesariamente el histórico Git.

Hasta entonces, estos recursos se consideran **staging local**.

## 6. Building Factory

Objetivo: no modelar manualmente cien edificios independientes.

Modelo conceptual:

```text
base mass
+ facade module
+ windows
+ doors
+ roof
+ chimney / vents
+ signage
+ props
+ material preset
+ condition preset
-> Blender generator
-> Landlord render
```

Parámetros candidatos:

```text
footprint
floors
building class
wealth
facade family
roof family
window family
condition
district style
prop density
```

Ejemplo conceptual:

```python
generate_building(
    width=2,
    depth=3,
    floors=3,
    style="industrial_transatlantic",
    facade="brick_03",
    roof="flat_parapet",
    condition="used"
)
```

La implementación real debe ser data-driven; este ejemplo no define API.

## 7. Character Factory

Objetivo: generar variedad sin modelar manualmente cada ciudadano.

```text
base rig
+ body preset
+ hairstyle
+ clothing preset
+ palette
+ role props
+ animation library
-> offline combinations
-> 8-direction render candidate
-> sprite/atlas
```

Runtime layering queda limitado a necesidades concretas.

La variación principal se genera offline para no multiplicar draw calls ni complejidad de depth sorting.

## 8. Papel de la IA

Uso preferido:

- concept art;
- moodboards;
- exploración de siluetas;
- paintovers de referencia;
- señalética ficticia;
- ideas de props;
- iteración de UI;
- comparación de direcciones;
- documentación.

No usar como camino principal:

```text
prompt
-> PNG aleatorio
-> asset final del mundo
```

para edificios/personajes core.

La identidad debe ser reproducible.

## 9. Style Layer de Landlord

Los assets externos son materia prima.

Todo asset del mundo debe atravesar una capa de estilo coherente:

```text
source/base asset
    ↓
proportions
materials
palette
era adaptation
props
wear/grime
canonical camera
canonical lighting
render scale
post
    ↓
Landlord runtime asset
```

El Visual Direction Spike debe demostrar que dos assets de proveedores diferentes pueden converger visualmente tras este proceso.

## 10. Criterio de éxito

El bootstrap artístico se considera viable cuando podemos generar sin artista contratado:

- un edificio residencial;
- uno industrial/comercial;
- roads/parcel;
- un personaje;
- una animación;
- un vehículo/prop móvil;
- materiales;
- UI placeholder;
- construcción/deterioro;
- ownership/selection;

y presentarlos en una escena visualmente coherente dentro de Phaser.

## 11. Decisión de escalado

Sólo plantear contratación artística si después del Vertical Slice se demuestra una carencia concreta que no podamos resolver razonablemente mediante:

- assets CC0;
- composición;
- procedural generation;
- IA conceptual;
- scripting;
- retoque limitado;
- contribución open source.

El objetivo no es eliminar permanentemente el arte humano; es evitar que sea una dependencia económica o de calendario antes de validar el producto.
