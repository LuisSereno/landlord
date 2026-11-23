# Catálogo de capacidades gráficas (D-111)

Registro operativo de **qué herramientas gráficas existen en el toolchain de Landlord, cuáles se han
probado de verdad y qué hay que teclear para volver a producir la evidencia**. No es un inventario de
recursos: los recursos viven en `blender_artist/manifests/world-catalogs/` y en
`docs/art/visual-catalog/`. Aquí se registra la **capacidad**, es decir, si sabemos usar algo y con qué
resultado.

Abierto por D-111 (§2). La pregunta que responde cada entrada no es «¿existe?» sino
**«¿lo hemos ejecutado de forma reproducible, y qué se ve en la imagen?»**.

## Cómo se lee

- `capabilities.json` es la fuente de verdad y su único recuento de entradas (el de este texto es
  deliberadamente sin número, para que no se desincronice). Cada entrada lleva los 17 campos obligatorios:
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

Estados y veredictos tras **D-111.2 WP00–WP08** (evidencia en [`evidence/v2/`](evidence/v2/README.md)).
Las tres extensiones arquitectónicas se reevaluaron por instrucción del propietario: el conteo de
triángulos dejó de ser criterio de rechazo **offline**, así que los motivos que figuraban en D-111.1 se
retiran donde eran geométricamente falsos y se conservan donde la medida los sostiene.

| Capacidad / pack | Tipo | Estado | Veredicto en una línea |
| --- | --- | --- | --- |
| `building_composer` | capacidad | `production_ready` | autoridad de composición; nada se le subordina |
| `blender_geometry_nodes` | capacidad | `qa_integrated` | **MEJORA VISUAL** medida; generador de módulos integrado en el pipeline offline experimental (WP01 + WP05) |
| `building_weathering_contract` | capacidad | `qa_integrated` | contrato de conservación/envejecimiento en QA offline: tono −11,1/255 midiendo el mismo edificio (WP04) |
| `composer_candidate_profiles` | capacidad | `qa_integrated` | selección de autoría sin parchear gramáticas; reproduce la firma del brazo que sustituye (WP06) |
| `hifi_architecture_builder` | capacidad | `tested` | evaluada, **sin módulo adoptado todavía**: la retícula se arregla por receta, pero `WINDOW_FLAT` no divide el hueco (WP03) |
| `arch_generator` | capacidad | `tested` | evaluada y **utilizada**: `mod_ag_arcade_bay_2m` (1 810 tri horneados) dentro del perfil `ag_civic_v2` (WP02) |
| `archimesh` | capacidad | `tested` | evaluada, **sin módulo adoptado todavía**: sus 0,54 m de fondo dejan la carpintería dentro del paño de 0,10 m (WP03) |
| `eevee` | capacidad | `production_ready` | estable; hay que declarar su umbral de ruido entre procesos |
| `polyhaven_pbr` | pack | `tested` | gana en relieve donde existe el scan; **RESTRINGIDO** |
| `kenney_retro_textures_fantasy` | pack | `tested` | **MEJORA** en teja, zócalo y pavimento; rechazado en ladrillo y revoco |
| `quaternius_ultimate_buildings` | pack | `production_ready` | base actual: silueta correcta, fachada plana |
| `kenney_building_kit` | pack | `production_ready` | sin cambios |
| `kenney_modular_buildings` | pack | `available` | no abierto en D-111 |
| `kenney_retro_urban_kit` | pack | `tested` | garajes medidos a 1,00 m: no resuelven un muelle; rechazado para `warehouse` |
| `kenney_mini_characters` | pack | `available` | rechazado para personajes jugables |
| `phaser_fx_lab` | capacidad | `qa_integrated` | tres presets como configuraciones (day_balanced, night_balanced, night_fire) verificados por sonda; noche legible (σ 91 % del día, 0 px recortados en WebGL) y desmontaje sin fugas (WP07 + cierre FASE 5) |
| `phaser_filters` | capacidad | `qa_integrated` | grading cálido candidato (+33,3 ms p95 medido); nada activado por defecto |
| `phaser_bloom` | capacidad | `qa_integrated` | por objeto barato y útil de noche (+6,7 ms); por umbral caro (+118,3 ms) y prohibido global |
| `phaser_dynamic_lighting` | capacidad | `qa_integrated` | MEJORA de noche con radios calibrados, SIN MEJORA de día (+60/67 ms) |
| `normal_maps` | capacidad | `tested` | es lo que hace legible la junta a zoom reducido; restringido a QA |
| `phaser_particles` | capacidad | `qa_integrated` | **MEJORA** de legibilidad de estado (humo, polvo) |
| `phaser_world_scale_capture` | capacidad | `qa_integrated` | la partida real a 1440×900 y 1×/0,5× con el censo del renderizador; sólo Centro Cívico cumple los siete contadores (WP08) |
| `composer_candidate_qa_runtime` | capacidad | `qa_integrated` | las cuatro candidatas WP06 y el incendio híbrido Blender+Phaser dentro de Phaser por rutas QA explícitas, sin promocionar nada (cierre FASE 2-4) |
| `tilemap_gpu_layer` | capacidad | `available` | condicionada a un problema real de terreno |

Las cinco entradas `qa_integrated` que añadió D-111.2 están sin promover. Las tres de Blender y del
compositor (`blender_geometry_nodes`, `building_weathering_contract`, `composer_candidate_profiles`)
viven en el pipeline offline de QA —aunque la proyección de conservación del contrato YA tiene call
site jugable desde el cierre FASE 4: un operativo con `condition < 60` y estructura intacta ya no se
dibuja como ruina, y el tier `aged` cae en el sprite `complete` mientras el catálogo no tenga sprite
envejecido (D-080 pendiente). La cuarta (`phaser_world_scale_capture`) no introduce ningún asset:
fotografía el bundle ya promocionado y su veredicto útil es negativo —sólo el distrito cívico llega
a los siete contadores; el recorte a blanco del HUD se mide ahora sobre la región sin HUD (cierre
FASE 6.2, capturas originales conservadas). La quinta (`composer_candidate_qa_runtime`) carga las
candidatas WP06 y el fuego híbrido por rutas QA explícitas: `runtime-promotions.json` no se tocó en
todo D-111.2.

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
| `sheets/gn_facade_ab.png` | A/B de fachada Geometry Nodes (§3) | el mismo par del párrafo anterior con `--candidate=gn_residential_v2` en el brazo B |
| `sheets/materials_sheet.png` | tres brazos por superficie (§5) | `blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/material_lab.py` |
| `sheets/extensions_sheet.png` | HiFi · Arch Generator · Archimesh (§4) | `…ext_lab/hifi_lab.py`, `…arch_generator_lab.py`, `…archimesh_lab.py` con el entorno aislado de extensiones |
| `sheets/phaser_sheet.png` | la misma calle de QA con y sin cada familia de efectos, de día y de noche, y el lote forzado a CANVAS (§8.5) | `node scripts/fx-lab-capture.mjs` y después `python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py` |
| `sheets/urban_context_sheet.png` | control y candidata GN plantados sobre un tramo de calle a 1440×900 y a 0,5× (§8.6) | `blender -b --factory-startup -P tools/art-pipeline/blender/build_building_composer_context.py -- --types=row_house,mixed_tenement --candidate=gn_residential_v2 --outDir=…/urban/<brazo>` (la nave usa `gn_industrial_v2`; el contexto urbano se compone con la misma ruta de selección que el sprite) |
| `warehouse/garage_probe.png` | las cuatro piezas de garaje a escala (§6.C) | `blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/garage_probe.py -- --resolution=1600` |
| `phaser/` | laboratorio de efectos (§7) | `node scripts/fx-lab-capture.mjs` (monta su propia vista previa; `FX_LAB_BASE_URL` para reutilizar una) |

### Hojas de la segunda pasada (D-111.2)

Viven en `evidence/v2/sheets/`, cada una con su JSON de procedencia en la carpeta del brazo
(`v2/gn/`, `v2/ag/`, `v2/ext/`, `v2/industrial/`, `v2/weathering/`, `v2/candidates/`, `v2/fire/`,
`v2/urban/`). Las que sostienen una afirmación de legibilidad se redibujan además a media altura
(`_half`) para verlas con el esfuerzo de lectura de un 0,5×. Son una convención de la casa, no un
entregable: no la tienen `building_condition_states.png` (1424×679, la produce
`scripts/building-condition-sheet.py`) ni `wp08_fx_nocturnos.png`, cuyo brazo 0,5× ya está pegado dentro
como cuadro propio (`preset_night_fire_050x.png`, capturado con «botón + zoom 0,5»). El índice con los
mandos completos es [`evidence/v2/README.md`](evidence/v2/README.md) y el cruce de los 108 PNG con
raster y procedencia medidos es [`evidence/INDEX.md`](evidence/INDEX.md).

| Hoja | Contenido |
| --- | --- |
| `v2/sheets/gn_v2_ab.png` | los cinco módulos GN v2 con paleta derivada del atlas, encuadre y corte medidos (WP01) |
| `v2/sheets/ag_civic_ab.png` | `town_hall` control vs arcada horneada desde Arch Generator (WP02) |
| `v2/sheets/ext_window_columns.png` · `v2/sheets/hifi_grid_ab.png` | el mismo vano resuelto por GN / HiFi / Archimesh y la receta HiFi sobre retícula (WP03) |
| `v2/sheets/weathering_states.png` | el mismo edificio en conservado / envejecido / dañado / ardiendo, de día y de noche (WP04) |
| `v2/sheets/industrial_warehouse_ab.png` | nave en crujía de 4 m con el portón de camión medido (WP05) |
| `v2/sheets/wp06_candidates_ab.png` | las cuatro candidatas con su control, por perfil de candidato (WP06) |
| `v2/sheets/building_condition_states.png` | los cuatro tiers con la cornisa ya seccionada y la proyección derivada de `condition`/`structuralIntegrity` escrita en la cabecera (FASE 6) |
| `v2/sheets/wp08_arquitectura_avanzada.png` | Geometry Nodes, HiFi, Arch Generator y Archimesh con su geometría medida y los dos edificios que esa autoría, ya montada por el Composer, producen (WP08) |
| `v2/sheets/wp08_fx_nocturnos.png` | nueve cuadros nocturnos con luma media, dispersión y porcentaje de píxel a 252+ escritos en el pie de cada uno (WP08) |
| `v2/urban/urban_*.png` | la partida real con el bundle promocionado a 1440×900 en 1× y 0,5× en los cuatro distritos, y el censo de lo que el renderizador tiene pintado en el JSON hermano (WP08) |

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
- No cambió la gramática aprobada del Composer. En D-111.1 la variante GN se probó sobre una copia de
  trabajo parcheada y revertida; desde WP06 la misma ruta existe como **perfil candidato** en memoria,
  validado por las guardas de §11/§17 y medido neutro en el camino por defecto. Promocionar un perfil
  volvería a derivar todas las variantes de producción del tipo.
- Los `blocked` y los `rejected` se registran con su motivo medido. No se sustituye una imagen que no
  se pudo producir por una imagen parecida.
