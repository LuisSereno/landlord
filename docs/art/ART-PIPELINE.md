# Art Pipeline Specification — Landlord

> Versión: 0.1
>
> Estado: especificación técnica de preproducción.
>
> Propósito: definir un camino reproducible desde fuente artística editable hasta contenido runtime validado e integrable en Phaser.
>
> Gobernanza: versiones de herramienta y budgets marcados como BASELINE siguen siendo provisionales hasta que el Visual Direction Spike y el profiling los cierren.

---

## 1. Objetivos

El pipeline debe optimizar:

1. consistencia visual entre colaboradores;
2. salida reproducible;
3. automatización;
4. integración web de bajo rozamiento;
5. provenance;
6. validación antes de merge;
7. escalabilidad desde decenas a cientos de assets;
8. independencia entre gameplay y representación visual.

El primer asset de producción exitoso no es “un edificio precioso”.

Es:

> **Un edificio que puede modificarse en su fuente y regenerarse mediante un flujo documentado hasta quedar correctamente iluminado, anclado, recortado, empaquetado, validado por metadata, cargable en Phaser y probado visualmente.**

---

## 2. Estados del pipeline

- **DECIDED** — decisión vigente.
- **BASELINE** — default propuesto pendiente de spike/profile.
- **OPEN** — no resuelto.
- **FUTURE** — diferido.

---

## 3. Arquitectura extremo a extremo

### 3.1 Flujo candidato — BASELINE

```text
concept / Art Bible
    ↓
source asset
    ↓
model / UV / materials
    ↓
rig / animation si aplica
    ↓
source validation
    ↓
canonical camera + lighting
    ↓
headless render
    ↓
RGBA master frames
    ↓
post / trim / validation
    ↓
atlas packing
    ↓
runtime metadata
    ↓
asset manifest
    ↓
Phaser ingestion
    ↓
Art Lab
    ↓
visual regression
    ↓
performance smoke
    ↓
approved runtime asset
```

### 3.2 Fuente y runtime son productos distintos

La fuente existe para ser editable.

El runtime existe para cargarse eficientemente.

Nunca editar manualmente un atlas generado como si fuese fuente.

---

## 4. Estructura de repositorio

### 4.1 Baseline

```text
landlord/
├── art/
│   ├── README.md
│   ├── concepts/
│   ├── blender/
│   │   ├── buildings/
│   │   ├── characters/
│   │   ├── vehicles/
│   │   ├── props/
│   │   └── templates/
│   ├── textures/
│   ├── substance/
│   ├── aseprite/
│   ├── ui-source/
│   ├── audio-source/
│   └── manifests/
│
├── assets-generated/
│   ├── frames/
│   ├── atlases/
│   ├── audio/
│   └── manifests/
│
├── apps/web/public/assets/
│   ├── atlases/
│   ├── terrain/
│   ├── ui/
│   ├── vfx/
│   └── audio/
│
├── tools/
│   └── art-pipeline/
│       ├── blender/
│       ├── pack/
│       ├── validate/
│       └── manifests/
│
└── docs/art/
```

### 4.2 Repositorio artístico separado — FUTURE

Mantener monorepo al principio.

Reevaluar `landlord-art-source` cuando:

- el histórico binario crezca mucho;
- cambien permisos;
- LFS/storage se vuelva problemático;
- CI de arte requiera ciclo independiente.

---

## 5. Toolchain

### 5.1 DCC principal — BASELINE

Blender es el candidato principal como fuente 3D autoritativa.

La investigación lo respalda por:

- cámara ortográfica;
- scripting Python;
- render headless;
- rigging/animation;
- accesibilidad para colaboradores;
- automatización reproducible.

Versión LTS exacta: OPEN.

### 5.2 Renderer — BASELINE

Propuesta:

- EEVEE para batch production;
- Cycles para referencia, validación material y hero/marketing cuando aporte valor.

No usar Cycles por defecto si sólo aumenta tiempos.

### 5.3 Herramientas opcionales

- Substance Painter — texturing avanzado.
- Krita / Photoshop — concept, paintover, UI source.
- Aseprite — VFX 2D, iconos, retoque de frames.
- TexturePacker — candidato para atlas.
- Tiled — candidato para terrain/map authoring.
- Playwright — regresión visual.
- Pixelmatch/equivalente — diff granular.

Una herramienta comercial opcional no debe impedir contribuciones externas salvo decisión explícita.

---

## 6. Pinning de versiones

Nunca depender de “latest”.

Propuesta:

```json
{
  "blender": "TBD-LTS",
  "texturePacker": "TBD",
  "aseprite": "TBD",
  "assetSchema": 1,
  "pipelineSchema": 1
}
```

Ubicación candidata:

```text
tools/versions.json
```

---

## 7. Unidades y escala

### 7.1 Blender — BASELINE

```text
1 Blender unit = 1 metro
```

### 7.2 Celda lógica — OPEN

```text
1 celda Landlord ≈ 4 x 4 metros
```

Congelar tras validar densidad de edificios, vehículos y personajes.

### 7.3 Sin hacks de escala

Un asset respeta la escala maestra.

Toda excepción requiere justificación y revisión.

---

## 8. Templates maestros

Propuesta:

```text
art/blender/templates/
├── building.blend
├── character.blend
├── prop.blend
└── vehicle.blend
```

Colecciones:

```text
COL_CAMERA
COL_LIGHTING
COL_REFERENCE
COL_RENDER
COL_COLLISION_HELPERS
COL_ANCHORS
```

Objetos reservados:

```text
CAM_GAME
LIGHT_KEY
LIGHT_FILL
ANCHOR_ROOT
FOOTPRINT
HEIGHT_GUIDE
```

Los colaboradores duplican templates; no reconstruyen camera/light rig por su cuenta.

---

## 9. Camera rig

### 9.1 Baseline

```text
projection      ORTHOGRAPHIC
azimuth         ~45°
elevation       ~30°
roll            0°
camera shift    0
```

Valores exactos: OPEN.

### 9.2 Script de cámara

Objetivo:

```text
tools/art-pipeline/blender/camera_rig.py
```

Responsabilidades:

- orientar cámara al origen;
- configurar ortho scale;
- comprobar footprint proyectado;
- fallar si la escena se desvía del baseline.

No usar Euler “mágico” diferente por asset.

---

## 10. Lighting rig

### 10.1 Baseline

- key direccional fijo;
- origen noroeste visual;
- sombras al sureste;
- fill suave;
- background transparente;
- AO contenido;
- evitar negros recortados.

### 10.2 Motivo

La luz se bakea en el sprite.

Direcciones incompatibles entre assets destruyen coherencia.

Un sol físico móvil queda fuera de v0.1.

---

## 11. Modelado

### 11.1 Edificios

Prioridad:

1. footprint;
2. masa;
3. cubierta/silueta;
4. acceso/carga;
5. props de gameplay;
6. separación de materiales;
7. detalle secundario.

### 11.2 Economía geométrica

Aunque los polígonos no sean coste runtime directo tras prerender, sí afectan:

- tiempo de modelado;
- carga de Blender;
- render batch;
- mantenimiento.

No modelar detalle invisible.

### 11.3 Kits modulares

Reutilizar:

- ventanas;
- puertas;
- chimeneas;
- toldos;
- rooftop equipment;
- tuberías;
- fire escapes;
- vents;
- carteles;
- vallas;
- props logísticos.

---

## 12. Materiales y texturas

### 12.1 Canales internos

Candidato:

```text
BaseColor
Roughness
Metallic
Normal
AO
Emission
```

El runtime final puede colapsar todo a RGBA.

### 12.2 Reutilización

Nombrar/versionar materiales compartidos.

Evitar un material exclusivo por edificio salvo necesidad real.

### 12.3 Substance

Si se utiliza:

- naming de export compatible con proyecto;
- `.spp` = source;
- no convertir Substance en requisito obligatorio de contribución.

---

## 13. Formatos

### 13.1 Fuente autoritativa

```text
.blend
```

### 13.2 Fuente opcional

```text
.spp
.psd
.kra
.aseprite
.wav
```

### 13.3 Intercambio

```text
.glb
```

GLB no es master artístico.

### 13.4 Render master — BASELINE

```text
PNG RGBA 16-bit
```

EXR sólo cuando se necesiten pases/HDR.

### 13.5 Runtime — BASELINE

```text
PNG RGBA 8-bit
+ atlas metadata
```

WebP/AVIF: candidatos para imágenes grandes UI/marketing.

GPU-compressed textures: FUTURE hasta medir.

---

## 14. IDs y naming

### 14.1 Regla

ASCII, `lower_snake_case`, sin espacios.

Prefijos:

```text
bld_ building
chr_ character
veh_ vehicle
prp_ prop
ter_ terrain
vfx_ effect
ui_  interface
ico_ icon
snd_ sound
mus_ music
```

### 14.2 Ejemplos

```text
bld_res_rowhouse_a_r0_complete
bld_res_rowhouse_a_r0_build_50
bld_res_rowhouse_a_r0_damaged

chr_worker_m01_walk_ne_f000
chr_worker_m01_walk_ne_f001

ter_asphalt_clean_a
ter_road_straight_ne_sw
```

### 14.3 Versiones

No usar:

```text
v1
v2
final
final2
final_final
```

en IDs runtime.

La versión vive en Git y manifests.

---

## 15. Anchors, pivots y footprints

### 15.1 Fuente del anchor

Cada fuente relevante contiene:

```text
ANCHOR_ROOT
```

### 15.2 Personaje

```text
ANCHOR_ROOT = punto medio entre pies sobre ground
```

### 15.3 Edificio

```text
ANCHOR_ROOT = origen lógico del footprint sobre ground plane
```

### 15.4 Proyección automatizada

El pipeline proyecta `ANCHOR_ROOT` con la cámara oficial y escribe metadata runtime.

Trim no debe romper placement.

### 15.5 Footprint

Es data de gameplay.

Ejemplo:

```json
{
  "assetId": "bld_res_rowhouse_a",
  "footprint": {
    "width": 2,
    "height": 3,
    "mask": [
      [1, 1],
      [1, 1],
      [1, 1]
    ]
  }
}
```

Nunca inferir ocupación desde alpha.

---

## 16. Estados de edificios

Mínimos candidatos:

```text
planned
foundation
construction_50
complete
damaged
```

Opcionales:

```text
abandoned
upgraded_1
upgraded_2
```

Reutilizar geometría/materiales siempre que sea posible.

---

## 17. Rig y animación de personajes

### 17.1 Base rig

Un rig reutilizable debe soportar múltiples variantes cuando sea viable.

### 17.2 Direcciones — BASELINE

```text
N NE E SE S SW W NW
```

### 17.3 Batch

```text
rig animation
-> orientation loop
-> frame loop
-> headless render
-> named frames
```

Ejemplo:

```text
chr_worker_m01_walk_ne_f000.png
...
chr_worker_m01_walk_ne_f007.png
```

### 17.4 Mirroring

No habilitarlo globalmente.

Sólo con metadata explícita.

---

## 18. Automatización de render

### 18.1 Comandos objetivo

```text
pnpm art:validate
pnpm art:render
pnpm art:pack
pnpm art:manifest
pnpm art:test
pnpm art:build
```

Implementación exacta: OPEN.

### 18.2 Blender headless

El script controla:

- escena;
- cámara;
- iluminación;
- frame;
- orientación;
- resolución;
- fondo transparente;
- naming;
- ruta de salida.

### 18.3 Cache

No rerenderizar todo en cada PR.

Clave candidata:

```text
SHA256(
  source
  + referenced textures
  + render settings
  + Blender version
  + pipeline version
)
```

---

## 19. Render output y post

### 19.1 Master

BASELINE:

- PNG RGBA;
- transparente;
- alta calidad;
- 16-bit candidato.

### 19.2 Runtime

BASELINE:

- RGBA 8-bit;
- trimmed;
- atlas packed.

### 19.3 Operaciones permitidas

Preferentemente scriptadas:

- crop/trim;
- alpha cleanup;
- color conversion;
- downscale;
- edge extrusion;
- metadata generation.

No hacer arreglos manuales indocumentados sobre runtime generado.

Si existe paintover manual, conservar source editable y documentar el paso.

---

## 20. Trim y atlas

### 20.1 Settings candidatos — BASELINE

```text
trim                 on
trim threshold       1
trim margin          2 px
extrude              2 px
shape padding        4 px
border padding       4 px
rotation in atlas    off
algorithm            MaxRects
max atlas            2048 x 2048
multipack            on
```

Deben medirse antes de congelarse.

### 20.2 Familias

```text
atlas_terrain
atlas_buildings_residential
atlas_buildings_commercial
atlas_buildings_industrial
atlas_characters_workers
atlas_characters_civilians
atlas_vfx
```

No usar un único atlas global.

### 20.3 Rotación interna

Desactivada inicialmente para facilitar debugging.

---

## 21. Integración Phaser

### 21.1 Carga

Usar atlas/multiatlas para familias grandes.

Ejemplo conceptual:

```ts
this.load.multiatlas(
  "buildings-residential",
  "/assets/atlases/buildings-residential.json",
  "/assets/atlases/"
);
```

### 21.2 Animación

```ts
this.anims.create({
  key: "worker.walk.ne",
  frames: this.anims.generateFrameNames("characters-workers", {
    prefix: "chr_worker_m01_walk_ne_f",
    start: 0,
    end: 7,
    zeroPad: 3,
  }),
  frameRate: 12,
  repeat: -1,
});
```

El runtime debe depender de IDs/manifests, no de paths dispersos hardcodeados.

---

## 22. Depth sorting

Se calcula desde posición lógica y metadata.

No desde el rectángulo PNG tras trim.

Inputs potenciales:

- cell;
- local position;
- anchor;
- layer class;
- gameplay elevation temporal.

La fórmula exacta se documentará cuando exista implementación.

---

## 23. Pipeline de terreno

Puede utilizar Tiled u otra herramienta data-driven.

Debe soportar:

- tile IDs;
- terrain family;
- variants;
- road adjacency;
- properties;
- overlays;
- district/zoning metadata.

La lógica del mapa no depende de pixels.

---

## 24. Pipeline VFX

### 24.1 Sprite VFX

Aseprite/render frames para:

- dust;
- sparks;
- smoke puffs;
- small fire;
- splash;
- steam.

### 24.2 Procedural

Preferir runtime para:

- selection;
- placement;
- zoning;
- routes;
- masks;
- influence.

### 24.3 Overdraw

Efectos transparentes grandes requieren profiling en escena densa.

---

## 25. Pipeline UI

### 25.1 Runtime

DOM/CSS/SVG siempre que sea práctico.

### 25.2 Reglas

- no bakear texto operativo;
- widths flexibles;
- pseudo-localización;
- design tokens;
- keyboard/focus;
- iconos exportados consistentemente.

---

## 26. Pipeline audio

Master propuesto:

```text
48 kHz
24-bit
WAV
```

Runtime: formatos comprimidos web derivados.

Categorías:

- UI;
- construction;
- industry;
- traffic;
- citizens;
- crime;
- police;
- weather;
- ambience;
- music.

Definir concurrencia/prioridad.

---

## 27. Asset manifest

Todo asset entregable debe tener metadata estructurada.

Esquema candidato:

```json
{
  "schemaVersion": 1,
  "assetId": "bld_res_rowhouse_a",
  "type": "building",
  "category": "residential",
  "author": "github:contributor",
  "origin": "original",
  "license": "PROJECT-ASSET-LICENSE",
  "source": "art/blender/buildings/res/rowhouse_a.blend",
  "artBibleVersion": "0.1",
  "toolchain": {
    "blender": "TBD"
  },
  "footprint": {
    "width": 2,
    "height": 3
  },
  "anchor": "ANCHOR_ROOT",
  "atlasGroup": "buildings_residential",
  "tags": [
    "era_1920",
    "residential",
    "low_income"
  ]
}
```

El schema final debe validarse automáticamente.

---

## 28. Provenance y licencias

### 28.1 Orígenes previstos

```text
original
licensed
public_domain
generated
derived
```

### 28.2 Material IA

Registrar:

- herramienta/generador;
- modelo si se conoce;
- revisión humana;
- estado de licencia;
- fuentes cuando proceda.

“Parece original” no es suficiente.

### 28.3 Regla de repositorio público

El proyecto debe poder responder:

- quién creó el asset;
- de dónde procede;
- bajo qué licencia;
- qué pipeline generó su runtime.

---

## 29. Git LFS — BASELINE

Patrones candidatos:

```gitattributes
*.blend filter=lfs diff=lfs merge=lfs -text
*.spp filter=lfs diff=lfs merge=lfs -text
*.psd filter=lfs diff=lfs merge=lfs -text
*.kra filter=lfs diff=lfs merge=lfs -text
*.aseprite filter=lfs diff=lfs merge=lfs -text
*.exr filter=lfs diff=lfs merge=lfs -text
*.wav filter=lfs diff=lfs merge=lfs -text
```

No meter automáticamente todo PNG en LFS.

Aprobar esta política antes de acumular binarios.

---

## 30. CI de arte

### 30.1 Pull Request

Objetivo:

```text
PR
├── metadata validation
├── source validation
├── naming validation
├── changed-assets render
├── dimensions / alpha validation
├── atlas build
├── manifest build
├── app / Art Lab build
├── visual tests
└── performance smoke
```

### 30.2 Nightly

```text
nightly
├── complete re-render
├── complete atlas rebuild
├── visual regression
└── performance suite
```

### 30.3 Fallos automáticos

CI puede bloquear por:

- assetId duplicado;
- manifest ausente;
- licencia inválida;
- anchor ausente;
- estado obligatorio ausente;
- dimensiones inválidas;
- hard budget de atlas;
- source ausente;
- carga Phaser rota.

La calidad estética subjetiva sigue requiriendo revisión humana.

---

## 31. Art Lab

Crear:

```text
/art-lab
```

Independiente de gameplay normal.

Contenido:

- camera calibration;
- tile calibration;
- terrain gallery;
- building states;
- character gallery;
- animation gallery;
- VFX;
- UI components;
- palette;
- lighting;
- dense scene.

Usuarios:

- arte;
- ingeniería;
- QA;
- contributors;
- visual regression.

---

## 32. Golden scenes y visual regression

```text
golden_small_residential
golden_dense_commercial
golden_industrial
golden_construction
golden_crowd
golden_ui_economy
golden_ui_politics
```

Fijar:

- browser;
- OS/container;
- viewport;
- DPR;
- seed;
- camera;
- zoom;
- asset version.

La tolerancia DOM puede ser más estricta que WebGL.

---

## 33. Budgets — BASELINE

| Métrica | Target | Warning | Review/Fail |
|---|---:|---:|---:|
| atlas page | 2048² | 4096² excepcional | >4096 |
| world texture resident | <=96 MiB | 96–128 MiB | >128 MiB |
| total texture resident | <=128 MiB | 128–192 MiB | >192 MiB |
| atlas pages visibles | <=6 | 7–10 | >10 |
| draw calls frame normal | <=150 | 150–250 | >250 |
| frame target | 60 FPS | 45–60 | <45 |
| frame budget | 16.67 ms | 16.67–22 ms | >22 ms |
| initial critical art download | <=20 MB | 20–30 MB | >30 MB |
| runtime file individual | <=4 MB ideal | 4–8 MB | revisar |

Son targets de proyecto, no límites universales.

Deben medirse antes de ratificarlos.

---

## 34. QA visual

Zooms:

```text
50%
75%
100%
150%
200%
```

Preguntas:

- ¿se reconoce categoría?
- ¿se distingue de vecinos?
- ¿construction se distingue de complete?
- ¿damage se ve?
- ¿ownership se ve?
- ¿selection se ve?
- ¿personajes siguen legibles?
- ¿VFX tapa información?
- ¿funciona sobre varios fondos?

---

## 35. QA accesibilidad

Revisar:

- normal;
- protanopia;
- deuteranopia;
- tritanopia;
- grayscale;
- high contrast.

Ownership/política no pueden depender sólo del hue.

---

## 36. QA localización

Futuro CI:

```text
EN
ES
pseudo-expanded
pseudo-accented
RTL test
```

No usar texto operativo en imágenes de ancho fijo.

---

## 37. Madurez del asset

```text
PLACEHOLDER
    ↓
BLOCKOUT
    ↓
STYLE CHECK
    ↓
GAMEPLAY APPROVED
    ↓
PRODUCTION MODEL
    ↓
MATERIAL
    ↓
RENDER
    ↓
ENGINE CHECK
    ↓
POLISH
    ↓
FINAL
```

Regla:

> **No pulir un asset cuyo footprint o función de gameplay todavía pueda cambiar.**

---

## 38. Definition of Done — Building

### ART

- respeta Art Bible;
- silueta legible;
- escala aprobada;
- materiales aprobados;
- lighting rig oficial;
- sin contaminación de IP ajena.

### SOURCE

- `.blend` limpio;
- naming válido;
- origin correcto;
- `ANCHOR_ROOT`;
- footprint;
- transforms saneados;
- materiales compartidos cuando aplique.

### RENDER

- cámara oficial;
- background transparente;
- master aprobado;
- alpha limpio;
- estados obligatorios;
- sólo orientaciones necesarias.

### PIPELINE

- metadata válida;
- provenance;
- author;
- license;
- atlasGroup;
- tags;
- render headless reproducible.

### ENGINE

- carga Phaser;
- pivot correcto;
- depth correcto;
- selección correcta;
- placement correcto;
- save/load independiente de detalles del asset visual.

### PERFORMANCE

- atlas en budget;
- runtime size revisado;
- sin texture switching innecesario;
- probado en escena densa.

### QA

- golden screenshot;
- visual diff revisado;
- legible en far zoom;
- probado sobre distintos fondos.

---

## 39. Flujo de contribución open source

Un contributor debe poder:

1. leer Art Bible;
2. obtener tooling necesario;
3. partir de template;
4. crear/modificar source;
5. declarar provenance/licencia;
6. ejecutar validación local;
7. generar preview/runtime;
8. abrir PR;
9. recibir checks automáticos;
10. recibir revisión artística humana.

Si el packer oficial es comercial, CI debe poder realizar packing para no bloquear al contributor.

---

## 40. Modding futuro

Separar:

- asset ID;
- archivos visuales;
- footprint;
- states;
- category;
- gameplay definition;
- localization;
- animation metadata.

El modder no debe necesitar todo el DCC stack interno.

---

## 41. Roadmap de adopción

### Gate 1

- placeholders;
- ayudas de calibración;
- visualización técnica;
- no producción masiva.

### Gate 2

- Visual Direction Spike;
- 2–3 direcciones;
- primer asset end-to-end;
- Art Lab mínimo;
- manifests preliminares.

### Vertical Slice

- congelar reglas;
- terrain/roads;
- core buildings;
- characters;
- VFX;
- UI;
- audio;
- golden scenes;
- art CI.

### Alpha

- ampliar contenido;
- variación;
- identidad de distritos;
- optimización;
- más accesibilidad/localización.

### Beta

- performance;
- tamaño de descarga;
- defects visuales;
- compatibilidad;
- audit final de provenance/licencias;
- consistencia.

---

## 42. Decisiones que debe cerrar el Visual Direction Spike

- versión exacta Blender;
- EEVEE como baseline;
- camera transform;
- relación 2:1;
- tile de referencia;
- escala física;
- master scale;
- lighting rig;
- número de direcciones;
- animation budget;
- atlas size;
- runtime image format;
- packer;
- política Git LFS;
- entorno de Art Lab/visual regression;
- budgets iniciales.

Si alguna afecta de forma duradera a arquitectura o compatibilidad, debe registrarse como ADR o decisión equivalente.

---

## 43. Definición de éxito

Un contributor nuevo debe poder tomar un template aprobado, crear un asset y ejecutar el pipeline hasta obtener un resultado que:

- mantenga escala;
- tenga ID determinista;
- tenga anchor correcto;
- tenga footprint válido;
- se empaquete en el atlas esperado;
- cargue en Phaser;
- pase validación;
- pueda revisarse en Art Lab;
- declare autor/licencia/provenance.

El Art Pipeline Specification define **cómo el arte de Landlord se convierte en contenido listo para software**.
