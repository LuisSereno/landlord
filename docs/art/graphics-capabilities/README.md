# Catálogo de capacidades gráficas (D-111)

Registro operativo de **qué herramientas gráficas existen en el toolchain de Landlord, cuáles se han
probado de verdad y qué hay que teclear para volver a producir la evidencia**. No es un inventario de
recursos: los recursos viven en `blender_artist/manifests/world-catalogs/` y en
`docs/art/visual-catalog/`. Aquí se registra la **capacidad**, es decir, si sabemos usar algo y con qué
resultado.

Abierto por D-111 (§2). La pregunta que responde cada entrada no es «¿existe?» sino
**«¿lo hemos ejecutado de forma reproducible, y qué se ve en la imagen?»**.

## Cómo se lee

- `capabilities.json` es la fuente de verdad. Cada una de las 19 entradas lleva los 17 campos obligatorios:
  `id`, `kind`, `technology`, `versionTested`, `officialSource`, `license`, `hostCompatibility`,
  `state`, `scriptOrModule`, `objectTypeUse`, `reproducibleExample`, `inputResources`,
  `outputResources`, `evidenceCaptures`, `visualResult`, `limitations`, `integrationDecision`.
  `evidenceCaptures` son **rutas relativas al repo, sin anotaciones**: lo que hay que matizar de una
  imagen va en `visualResult`. Se admite el array vacío sólo cuando el estado es `available` y el
  motivo está dicho en `limitations`; un hueco declarado vale más que una ruta inventada.
- `kind` distingue **capacidad** (un programa: un nodo, un filtro, un motor — se reutiliza) de
  **asset pack** (recursos con licencia — se consumen, no son una técnica). Confundirlos es la forma
  habitual de documentar un catálogo que no dice nada.
- `state`:

| Estado | Significado |
| --- | --- |
| `available` | existe en el toolchain pero no se ha medido en Landlord |
| `tested` | ejecutado de forma reproducible, con evidencia visual |
| `qa_integrated` | integrado en el pipeline de QA, no en el de producción |
| `production_ready` | supera la promoción tras revisión humana |
| `rejected` | no se adopta, con motivo técnico registrado |
| `blocked` | no se ha podido ejecutar; el bloqueo es reproducible |

Ninguna entrada pasa de `tested` a `production_ready` por decisión del agente: la promoción es
**revisión humana** (D-111 §11). Las que figuran como `production_ready` vienen de gates anteriores.

## Autoridad de las mediciones

- Blender **5.2.2 LTS** (hash `d13f752e3b9c`, 2026-09-15) desde `blender_artist/toolchain/`, anulable
  con `BLENDER_BIN`.
- Phaser **4.2.1** (`apps/web`).
- Render **EEVEE sobre GL por software, sin GPU local**. Los tiempos citados son de esta máquina y no
  son un presupuesto: D-111 declara que el tiempo de generación de Blender no es criterio de
  aceptación.
- Presupuestos vigentes: D-100/D-102 (sprite) y D-101 (23 MiB por lote de catálogo).

## Resultado de la pasada

| Capacidad / pack | Tipo | Estado | Veredicto en una línea |
| --- | --- | --- | --- |
| `building_composer` | capacidad | `production_ready` | autoridad de composición; nada se le subordina |
| `blender_geometry_nodes` | capacidad | `tested` | **MEJORA VISUAL** en hueco de fachada; aceptada como generador especializado |
| `hifi_architecture_builder` | capacidad | `tested` | SIN MEJORA; 2 356 tri; rechazada |
| `arch_generator` | capacidad | `tested` | la mejor arquitectura de las tres, 35 452 tri; rechazada para producción |
| `archimesh` | capacidad | `tested` | 244 373 tri para puerta+ventana+cubierta; rechazada |
| `eevee` | capacidad | `production_ready` | estable; hay que declarar su umbral de ruido entre procesos |
| `polyhaven_pbr` | pack | `tested` | gana en relieve donde existe el scan; **RESTRINGIDO** |
| `kenney_retro_textures_fantasy` | pack | `tested` | **MEJORA** en teja, zócalo y pavimento; rechazado en ladrillo y revoco |
| `quaternius_ultimate_buildings` | pack | `production_ready` | base actual: silueta correcta, fachada plana |
| `kenney_building_kit` | pack | `production_ready` | sin cambios |
| `kenney_modular_buildings` | pack | `available` | no abierto en D-111 |
| `kenney_retro_urban_kit` | pack | `tested` | garajes medidos a 1,00 m: no resuelven un muelle; rechazado para `warehouse` |
| `kenney_mini_characters` | pack | `available` | rechazado para personajes jugables |
| `phaser_filters` | capacidad | `qa_integrated` | grading cálido candidato (+33,3 ms p95 medido); nada activado por defecto |
| `phaser_bloom` | capacidad | `qa_integrated` | por objeto barato y útil de noche (+6,7 ms); por umbral caro (+118,3 ms) y prohibido global |
| `phaser_dynamic_lighting` | capacidad | `qa_integrated` | MEJORA de noche con radios calibrados, SIN MEJORA de día (+60/67 ms) |
| `normal_maps` | capacidad | `tested` | es lo que hace legible la junta a zoom reducido; restringido a QA |
| `phaser_particles` | capacidad | `qa_integrated` | **MEJORA** de legibilidad de estado (humo, polvo) |
| `tilemap_gpu_layer` | capacidad | `available` | condicionada a un problema real de terreno |

## Evaluaciones

- [`evaluations/geometry-nodes.md`](evaluations/geometry-nodes.md) — el A/B obligatorio de fachada
  `mixed_tenement` (§3), las diez características, el ruido de medida entre procesos y las tres
  limitaciones para promocionar.
- [`evaluations/extensions.md`](evaluations/extensions.md) — HiFi, Arch Generator y Archimesh (§4):
  triángulos medidos, qué bloquea cada una y por qué no se sustituye la evidencia con imágenes
  inventadas.
- [`evaluations/pilots.md`](evaluations/pilots.md) — la pasada transversal de §6 sobre `row_house`,
  `mixed_tenement`, `warehouse` y `town_hall`, con la restricción de familia registrada donde una
  biblioteca sólo aporta a ciertas familias.
- [`evaluations/materials.md`](evaluations/materials.md) — el A/B de materiales sobre geometría
  idéntica (§5) y la decisión por superficie.
- [`evaluations/phaser-fx-lab.md`](evaluations/phaser-fx-lab.md) — el laboratorio de capacidades de
  Phaser 4 (§7): la sonda de API medida, la tabla on/off con su delta, la degradación CANVAS, los tres
  congelos que produjo el arnés y los dos defectos de parametrización que se corrigieron mirando las
  imágenes.
- [`material-decisions.json`](material-decisions.json) — las decisiones por superficie en forma de
  dato, con `approved_for_candidate`, `restricted_use` y `rejected_for_style`.

## Evidencia y cómo regenerarla

`evidence/sheets/` son las seis hojas de revisión humana; las carpetas hermanas guardan el PNG
individual y su JSON de hermanastro (herramienta, cámara, luz, triángulos, procedencia y segundos).

| Hoja | Contenido | Mando para regenerar |
| --- | --- | --- |
| `sheets/pilots_sheet.png` | control y candidata de las familias piloto (§6) | `node scripts/build-building-composer.mjs --types=<familia> --seeds=2 --prefix=d111ctl_<familia> --outDir=… --mood=day_civic`; los pares ya producidos viven en `evidence/pilots/` y el compositor lee de ahí |
| `sheets/gn_facade_ab.png` | A/B de fachada Geometry Nodes (§3) | el mismo par del párrafo anterior sobre la gramática parcheada |
| `sheets/materials_sheet.png` | tres brazos por superficie (§5) | `blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/material_lab.py` |
| `sheets/extensions_sheet.png` | HiFi · Arch Generator · Archimesh (§4) | `…ext_lab/hifi_lab.py`, `…arch_generator_lab.py`, `…archimesh_lab.py` con el entorno aislado de extensiones |
| `sheets/phaser_sheet.png` | la misma calle de QA con y sin cada familia de efectos, de día y de noche, y el lote forzado a CANVAS (§8.5) | `node scripts/fx-lab-capture.mjs` y después `python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py` |
| `sheets/urban_context_sheet.png` | control y candidata GN plantados sobre un tramo de calle a 1440×900 y a 0,5× (§8.6) | `blender -b --factory-startup -P tools/art-pipeline/blender/build_building_composer_context.py -- --outDir=…/urban/<brazo>`, con `ext_lab/ab_grammar_patch.py` para la candidata |
| `warehouse/garage_probe.png` | las cuatro piezas de garaje a escala (§6.C) | `blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/garage_probe.py -- --resolution=1600` |
| `phaser/` | laboratorio de efectos (§7) | `node scripts/fx-lab-capture.mjs` (monta su propia vista previa; `FX_LAB_BASE_URL` para reutilizar una) |

El laboratorio de extensiones corre **aislado** del perfil de usuario real:

```sh
BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg \
BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext \
  blender_artist/toolchain/blender-5.2.2-linux-x64/blender -b --factory-startup -P <lab>.py
```

El propio catálogo también se comprueba solo: `pnpm art:capabilities:check` exige los 17 campos, que
`state` pertenezca a la leyenda, que cada `evidenceCaptures` apunte a un archivo del repo y que todo
estado que afirma «ejecutado» tenga al menos una imagen revisable. No ejecuta ninguna de las
herramientas que describe: sólo impide que el catálogo mienta sobre lo que hay detrás.

## Lo que este catálogo no afirma

- No promociona nada: los sprites candidatos de D-111 siguen siendo candidatos hasta revisión humana.
- No modificó `blender_artist/manifests/world-catalogs/material-assets.json`. La biblioteca
  semántica de materiales es una decisión de estilo del propietario, y `src_kenney_retro_textures_fantasy`
  conserva `runtimeReady: false`.
- No cambió la gramática aprobada del Composer. La variante GN se probó sobre una copia de trabajo
  parcheada y revertida; promocionarla volvería a derivar todas las variantes de producción.
- Los `blocked` y los `rejected` se registran con su motivo medido. No se sustituye una imagen que no
  se pudo producir por una imagen parecida.
