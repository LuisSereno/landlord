# D-108 — El mood horneado es un dato de procedencia, no el nombre del archivo

Estado: aceptada el 2026-11-18 por el responsable.

## Contexto

D-105 adoptó `day_civic` como grado de presentación preferido y dejó el cierre del catálogo de
edificios condicionado a que los PNG Blender existentes «se rehornean y promueven por familia con sus
hashes nuevos». Al ejecutar ese rehorneado —360 variantes diurnas, 15 tipos × 6 estados × 4
orientaciones físicas— aparecieron dos huecos que D-105 no preveía:

1. **Un PNG no declara qué grade lo horneó.** `day_industrial` hereda de `day_civic` y sólo cambia dos
   bandas de grade; dos candidatos producidos con perfiles distintos llevan el mismo
   `styleProfileId`, la misma `composerVersion` y métricas parecidas. La única señal era el prefijo del
   archivo (`vjd_` frente a `vg_`), que no es un contrato: es una convención de una corrida concreta.
2. **El grado diurno genérico quemaba las familias claras.** Ladrillera, cementera y acería salían con
   chimeneas, silos, cornisas y paños en blanco plano: el material perdía la lectura del volumen.

## Decisión

1. **`moodId` es dato de procedencia y viaja hasta el runtime.** Se escribe en la procedencia del
   candidato, entra en `REQUIRED_METADATA_FIELDS` del validador del compositor, se copia a cada
   variante del manifiesto y pasa a ser obligatorio en el tipo compartido `BuildingVariantV1`, con
   queja propia en `validateBuildingVariantManifest`. La promoción **aborta** si un candidato no lo
   registra: ningún lote se sirve ya sin decir qué grade horneó cada PNG.
2. **Una sola puerta para resolver el mood.** `render_settings.active_mood_id()` es la única fuente del
   identificador, con la misma prioridad que el perfil activo (`LANDLORD_ART_MOOD` sobre el
   `activeMood` del style layer). `active_mood()` la llama en vez de duplicar la lectura, así que
   procedencia y render no pueden discrepar sobre qué se aplicó.
3. **El mood se elige por familia según el defecto medido, no por convención de lote.**
   `day_industrial` —hija de `day_civic`, baja `near_white_trim` 0,80→0,50 y
   `facade_blue_grey_to_warm_stone` 0,72→0,60, con iluminación, sombra, `windowGlow` y suelo de
   legibilidad intactos— se aplica a `brickworks`, `cement_plant` y `steelworks`. `market_hall` se
   queda en `day_civic` porque no recorta.
4. **Precedente de procedimiento para campos obligatorios nuevos.** Cuando un campo entra en la lista
   de requeridos y el gate se pone rojo con material versionado anterior, **se registra el dato y no se
   relaja la lista**. Y si el valor no es deducible del artefacto, se demuestra con historia de Git
   antes de estamparlo: en este caso, que el grade vigente el 2026-11-07 (`4d6abb5`) es idéntico hoja a
   hoja al perfil `night_civic` actual en `externalTreatment`, `lighting`, `rendering` y `shadow`, y que
   `a419465` es el único commit que ha tocado `activeMood`.
5. **El horneado por lote sigue siendo reversible.** Con `moodId` en la procedencia de los dos lotes,
   volver al nocturno es un comando de promoción, no un rehorneado de las 360 celdas del lote diurno
   (≈560 min de tiempo de compositor acumulados en sus 15 familias).

## Evidencia y límites

Medido sobre las 72 variantes industriales rehechadas, contra su propio render diurno en `day_civic`:

- Recorte duro (fracción de píxeles alpha>127 por encima de 0,995): media **2,87 %→0,51 %**, máximo
  **11,19 %→1,57 %**, **0 celdas** por encima del 2 %.
- Microcontraste de la zona saturada: desviación típica **0,005→0,049-0,071** y niveles discretos
  **6→67-68**. Es la métrica que separa «material con volumen» de «mancha blanca plana».
- `compositionSignature` idéntico en **72/72**: el cambio es de grade, no de geometría. Cada celda
  diurna sigue siendo al menos **1,94×** más clara en medV que su render nocturno.
- Por estado, el arreglo es quirúrgico: `complete` 7,71 %→1,12 % y `finishing` 7,69 %→1,12 %;
  `foundation` (0,61 %→0,00 %, medV 0,757 sin moverse) y `structure` (0,00 %→0,00 %) no tienen paños ni
  cornisas y no cambian; `damaged` 0,60 %→0,21 %; `burning` queda en 0,60 % porque lo que brilla es la
  emisión del fuego, no una pérdida de material.
- Determinismo: `vjdind_brickworks_1000_o90.png` se reprodujo **byte a byte** (SHA idéntico) en un
  `outDir` distinto una hora después.
- Rejilla verificada, no supuesta: las 24 celdas por tipo se derivaron del manifiesto archivado del
  lote anterior. Los defaults del compositor son `DEFAULT_SEEDS=[1000..1003]`,
  `states:["complete"]`, `orientations:[0]`, y una corrida sin `--seeds/--states/--orientaciones`
  renderiza otra rejilla. No dañó el lote porque la promoción es atómica por tipo (`outDir` no se toca
  hasta que la corrida valida completa).
- Tiempos, leídos de los manifiestos del lote (`totalGenerationMs`, un proceso Blender por tipo): la
  corrección industrial cuesta 1 628,8 s (`brickworks`), 1 540,3 s (`cement_plant`) y 1 400,4 s
  (`steelworks`) para 24 celdas cada uno —76,2 min, que sustituyen los 80,1 min que esas tres familias
  habían costado en `day_civic`—. Las 15 familias diurnas suman 559,8 min para las 360 celdas.

Promoción del lote compuesto: **360 variantes —288 `day_civic` + 72 `day_industrial`—, 0 sin `moodId`,
0 PNG ausentes y 0 SHA divergentes contra disco**. El lote nocturno quedó íntegro (360 PNG,
concat-SHA `3b5614f1…`, 407 433 618 B). Registro estampado en los 15 candidatos legacy que el validador
exigía: **45 objetos en 30 ficheros, 0 líneas borradas, los 15 PNG con su SHA intacto**.

Gates en verde sobre el estado entregado: validador del compositor y sus 52 casos de mutación, test de
geometría (300/300 variantes heavy), `check_style_layer.py`, `check_rendered_value_ladder.py`, suite
web (381 passed / 4 skipped), shared (80), typechecks, `check:architecture`, prettier y
`git diff --check`.

Los candidatos de `batch-day/` (1,3 GB) siguen fuera de Git por la decisión de storage del 2026-11-09;
sólo se versiona el marcador y el manifiesto.

## Lo que D-108 no cierra

1. **El selector Día/Noche de D-105 y el grade horneado son ortogonales.**
   `IsometricSpikeScene.setVisualMood` cambia el fondo de cámara y repinta el terreno; nunca tocó los
   sprites. Con una sola marca por variante, la opción «Noche» deja edificios diurnos sobre fondo
   nocturno. Horneados duales costarían duplicar el presupuesto de binarios de D-101 (23 MiB) y la
   descarga por distrito de D-102; retirar o redefinir la opción es más barato. Es un cambio de
   contrato de presentación y corresponde al responsable.
2. **Tres gates rojos previos, atribuidos midiendo y no tocando.** `art:external:check` pide
   `a4984729…` y produce `3db46962…` —estable en tres corridas, y un worktree limpio en HEAD
   `1bdeb5d` reproduce el mismo digesto, así que el drift ya estaba versionado: el golden se refirmó en
   `71d4f22` (2026-11-16) y desde entonces no cambió nada en `tools/art-pipeline/blender/`,
   `asset-jobs.json` ni `staging-sources.json`—. `art:coverage:audit:check` está rojo en HEAD con sus
   cuatro entradas y sus dos salidas byte-idénticas a HEAD. `art:staging:validate` reclama 7 fuentes
   `src_original_*` con procedencia incompleta y el PNG de spike irrecuperable desde la limpieza del
   2026-11-04.
3. **24 PNG huérfanos** `vf_town_hall_1006*` (59,0 MB) en `variants/`, sin referencia de manifiesto ni
   de código, pendientes de la decisión de borrado.

## Implementación

- `tools/art-pipeline/blender/render_settings.py` — `active_mood_id()`.
- `tools/art-pipeline/blender/building_composer/scene.py` — `moodId` en la procedencia del candidato.
- `scripts/validate-building-composer.mjs` — campo obligatorio.
- `scripts/promote-building-variants.mjs` — guarda de promoción, campo en la variante y resumen.
- `packages/shared/src/assets.ts` — `BuildingVariantV1.moodId` y su queja en el validador.
- `tools/art-pipeline/blender/style_layer_graphic_civic.json` — perfil `day_industrial`.

Entregado en `develop`: `1bdeb5d..835982c` (código, grade, registro legacy y manifiesto promocionado).

Relacionado: sustituye la condición abierta de D-105 sobre el horneado por familia; no toca D-101 ni
D-102 (presupuestos) ni el contrato de presentación de D-105. Ver
`D-105-grado-diurno-y-selector-presentacion.md` y la entrada condensada en
`ai-context/DECISIONS.md`.
