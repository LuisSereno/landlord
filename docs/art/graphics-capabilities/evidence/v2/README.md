# D-111.2 — Evidencia de la segunda iteración

Carpeta **nueva**, como pide WP00. Nada de aquí regenera el control de D-111.1: las seis hojas de
`../sheets/` siguen siendo la baseline y se citan como control en cada comparación.

## Baseline congelada (control, no se toca)

| hoja | qué compara | estado |
| --- | --- | --- |
| `../sheets/gn_facade_ab.png` | fachada `mixed_tenement` control vs Geometry Nodes | control de WP01 |
| `../sheets/pilots_sheet.png` | `row_house` y `mixed_tenement` control vs candidata | control de WP06 |
| `../sheets/extensions_sheet.png` | HiFi / Arch Generator / Archimesh en la retícula del perfil | control de WP02–WP03 |
| `../sheets/materials_sheet.png` | ocho superficies Kenney Retro vs Poly Haven vs Graphic Civic | control de WP04 |
| `../sheets/urban_context_sheet.png` | candidatas colocadas en contexto urbano | control de WP08 |
| `../sheets/phaser_sheet.png` | FX Lab día/noche con medición on/off | control de WP07 |

Manifiestos de referencia: `../../capabilities.json`, `../../material-decisions.json`,
`blender_artist/manifests/building-composer-grammars.json` (`sha256` del árbol aprobada, se
verifica tras cada corrida) y `blender_artist/manifests/building-modules.json` (186 módulos en la baseline; 187 tras el vano cívico
de WP02; **191** tras las cuatro piezas industriales de WP05).

Versiones medidas: Phaser **4.2.1**, Blender **5.2.2 LTS**
(`blender_artist/toolchain/blender-5.2.2-linux-x64/blender`), `composerVersion: vf-3`.

## Los cuatro edificios objetivo

Huella y plantas **leídas del catálogo**, no inventadas (`building-catalog.json`; el compositor las
recibe del dominio y no las toca — `authority.footprintAndFloors`). 1 celda = 4 m.

| tipo | familia del Composer | huella (celdas) | huella (m) | plantas | receta/estado actual |
| --- | --- | --- | --- | --- | --- |
| `row_house` | `residential_low` | 4×1 | 16×4 | 2 | candidata GN existente (§A) |
| `mixed_tenement` | `residential_low` | 4×2 | 16×8 | 3 | candidata GN existente (§B) |
| `warehouse` | `industrial_heavy` | 4×3 | 16×12 | 1 | candidata GN de 4 m con portón, ventana de banda y pretil propios (§WP05) |
| `town_hall` | `civic_landmark` | 5×3 (+1 celda frontal de escalinata) | 20×12 | 4 | **sin candidata integrada**: el vano cívico AG existe y está medido (WP02), falta el paquete de integración (WP06) |

`warehouse` y `town_hall` no se desbloquean relajando `allowedFamilies`: se desbloquean escribiendo
módulos GN **propios de su familia** (WP05 industrial, WP02/WP06 cívico).

## Rutas de reproducción

```bash
export PATH=/home/luis/.local/bin:/usr/local/bin:/usr/bin:/bin
BLENDER=blender_artist/toolchain/blender-5.2.2-linux-x64/blender

# Módulo GN (WP01/WP05): regenera GLB + .blend vivo + informe de medidas
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- \
  --out-dir=/tmp/gn --seed=7 --report-dir=/tmp/gn

# A/B del Composer (WP06): un perfil de candidato, sin tocar el manifiesto aprobado
#   --candidate=gn_residential_v2  roles GN en las dos residenciales (WP01, revisado en WP06)
#   --candidate=ag_civic_v2        sólo el vano cívico horneado en town_hall (WP02)
#   --candidate=gn_industrial_v2   regridúa SÓLO `warehouse` a 4 m, con su rol de acceso y sus siluetas (WP05)
run() { node scripts/build-building-composer.mjs --candidate=$1 --types=$2 --seeds=$3 --mood=$4 \
  --prefix=w06cnd --outDir=/tmp/wp06/out/$2 --metrics=/tmp/wp06/metrics-$2.json; }
run gn_residential_v2 row_house      17 day_civic
run gn_residential_v2 mixed_tenement  2 day_civic
run gn_industrial_v2  warehouse       2 night_civic
run ag_civic_v2       town_hall       2 day_civic
# Cada tipo se corre en su propio `--outDir`: la promoción atómica del orquestador limpia el directorio
# antes de copiar el staging, así que reutilizarlo borra el render del tipo anterior.
# El PNG que sale es `w06cnd_<tipo>_<seed>.*`; aquí se publica renombrado a
# `candidates/wp06_<tipo>-candidata.{png,json}` para no confundirlo con los brazos históricos de
# `evidence/v2/<wp>/<tipo>-candidata.*`, que son el brazo parcheado que estos sustituyen.
# El mismo brazo en el contexto urbano, con la misma ruta de selección:
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/build_building_composer_context.py -- \
  --types=row_house,mixed_tenement --candidate=gn_residential_v2 --outDir=/tmp/wp06/ctx
# Equivalencia comprobada sin Blender (firmas, ejes, colocaciones, guardas de perfil):
pnpm art:building-composer:candidates:test

# Hueco libre de cada pieza industrial (WP05): rectángulo máximo realmente pasable, medido sobre las
# caras de la malla exportada y excluyendo por material la hoja móvil, el fondo de nave y la carpintería.
# Escribe `industrial/dock_aperture_scale.{png,json}` salvo que se le dé otro `--dir=`.
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/dock_probe.py -- \
  --resolution=1600 --samples=48

# Paleta de los flats GN (WP01/WP05): sin Blender. `--authored` es la tabla lineal publicada en
# `gn_facade_grammar.MATERIALS`; `deltaStyledL1` = 0 significa que el color de autor, tras el
# tratamiento, coincide con el píxel del atlas licenciado que usa el control de ese rol.
python3 tools/art-pipeline/blender/ext_lab/gn_palette.py --mood=day_civic \
  --json=docs/art/graphics-capabilities/evidence/v2/gn/palette_industrial_day_civic.json \
  --authored="gn_brick_wall=0.116,0.0692,0.0358;gn_stone_trim=0.3485,0.3485,0.1775;gn_painted_metal=0.1775,0.1775,0.1775;gn_dark_glass=0.0395,0.0761,0.0801;gn_joinery_dark=0.0692,0.0143,0.0032;gn_metal_trim=0.2547,0.2547,0.2547;gn_dock_shutter=0.116,0.116,0.116;gn_rubber_dark=0.0358,0.0358,0.0358"

# Módulo cívico horneado desde Arch Generator (WP02): GLB + informe de medidas + render de evidencia
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/ag_module_bake.py -- \
  --out-glb=/tmp/wp02/ag_arcade_bay_2m.glb --report=/tmp/wp02/report.json \
  --evidence-png=/tmp/wp02/module.png --evidence-json=/tmp/wp02/module.json --quality=high

# Componente de extensión horneado a la crujía canónica de 2 m (WP03).
#   --tool=control|hifi|archimesh  (control = el módulo GN del repo, es la vara de medir)
#   --quality=high|simplified      (simplified = el mismo receta con el preset ligero de la extensión)
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/ext_module_bake.py -- \
  --tool=hifi --quality=high \
  --out-glb=/tmp/wp03/hifi_window_bay_2m_high.glb \
  --report=/tmp/wp03/hifi_window_bay_2m_high-report.json \
  --evidence-png=docs/art/graphics-capabilities/evidence/v2/ext/hifi_window_bay_2m_high.png \
  --evidence-json=docs/art/graphics-capabilities/evidence/v2/ext/hifi_window_bay_2m_high.json

# Fachada HiFi completa (WP03): `--layout=grid` es la receta corregida, `free` la original.
# La diferencia entre las dos medidas ES el hallazgo, así que se guardan ambas evidencias.
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/hifi_lab.py -- \
  --layout=grid --materials=atlas --mood=day_civic --ortho-scale=23.6 --target-z=5.4 \
  --output=docs/art/graphics-capabilities/evidence/v2/hifi/hifi_facade_grid.png \
  --metadata=docs/art/graphics-capabilities/evidence/v2/hifi/hifi_facade_grid.json

# Tiers de conservación (WP04). La receta vive en el manifiesto; el request elige el tier.
#   --weathering=conserved,aged  sólo se aplica cuando --states=complete (los daños son sprite aparte)
E=docs/art/graphics-capabilities/evidence/v2/weathering
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete,damaged,burning --weathering=conserved,aged --prefix=vw --mood=day_civic \
  --outDir=$E/day --metrics=$E/metrics-day.json
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete --weathering=conserved,aged --prefix=vwn --mood=night_civic \
  --outDir=$E/night --metrics=$E/metrics-night.json
# Brazo de control: el MISMO request sin la clave `weathering` (así se prueba que la bandera es opt-in).
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete --prefix=vw --mood=day_civic --outDir=$E/optout --metrics=$E/metrics-optout.json

# Sondas WP04: se calibran con un contrato de trabajo por variable de entorno, nunca editando el
# publicado. `LANDLORD_ART_WEATHERING_CONTRACT` la leen a la vez el orquestador y weathering.py.
#   sonda verde  → todas las recetas aged a strength/baseSoiling 1,0 y mugre verde (cobertura real)
#   emisión 1,0 / 0,0 → la misma receta nocturna con la palanca en sus dos extremos (WP04-D3)
cp blender_artist/manifests/building-weathering-contract.json /tmp/wp04-probe/emission-contract.json
python3 - <<'PY'  # y poner materials.atlas.states.aged.recipe.emissionScale a 1.0 / 0.0
import json; p="/tmp/wp04-probe/emission-contract.json"; c=json.load(open(p))
c["materials"]["atlas"]["states"]["aged"]["recipe"]["emissionScale"]=1.0
json.dump(c, open(p,"w"), indent=2, ensure_ascii=False)
PY
LANDLORD_ART_WEATHERING_CONTRACT=/tmp/wp04-probe/emission-contract.json \
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete --weathering=aged --prefix=vwe --mood=night_civic \
  --outDir=/tmp/wp04-probe/emission --metrics=/tmp/wp04-probe/emission-metrics.json
# Sonda de máscaras por familia (8 paños 16×12 m, sin Composer: Blender directo). Escribe en la ruta
# fija `evidence/v2/weathering/mask`, que es donde vive la evidencia.
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/weathering_mask_probe.py -- \
  --mood=day_civic

# Determinismo §13 de un brazo envejecido (dos pases completos en un outDir de trabajo)
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete --weathering=aged --prefix=vw --mood=day_civic \
  --outDir=/tmp/wp04-regen/day --metrics=/tmp/wp04-regen/metrics.json --regenerate

# Hojas comparativas
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py [filtro]

# Extensiones GPL (WP02/WP03): instaladas sólo en /tmp/d111-ext-lab, ver `lab_common.EXTENSIONS`
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
```

> **El campo `command` de la evidencia.** Cada JSON guarda la corrida que lo produjo para poder
> relanzarla desde sí mismo. `lab_common._command_line()` leía el script de `sys.argv[1]`, que bajo
> `-b --factory-startup -P` es literalmente `-b`, así que las evidencias de WP01 y WP02 registran
> `…/ext_lab/-b` y no son ejecutables tal cual: para re-hacer esas corridas usa el bloque de arriba.
> Corregido en WP03; desde aquí el campo vuelve a coincidir con el comando real y el script queda
> relativo al repo.

## WP01 — Geometry Nodes v2 (medido)

Sheet: [`sheets/gn_v2_ab.png`](sheets/gn_v2_ab.png) y su lectura a escala de juego
[`sheets/gn_v2_ab_half.png`](sheets/gn_v2_ab_half.png). Módulos sueltos:
[`gn/gn_parts.png`](gn/gn_parts.png), parámetros vivos: [`gn/gn_params.png`](gn/gn_params.png),
deriva de paleta: [`gn/palette_day_civic.json`](gn/palette_day_civic.json).

| brazo | seed | triángulos | envelope z | px/m | márgenes lienzo (L/T/R/B) | geometría opaca en el borde |
| --- | --- | --- | --- | --- | --- | --- |
| `mixed_tenement` control | 2 | 9 522 | 10,00 m | 60,2 | 155/169/180/165 | 0 px |
| `mixed_tenement` GN v2 | 2 | 14 264 | 10,00 m | 60,2 | 155/169/180/165 | 0 px |
| `row_house` control | 17 | 11 232 | 9,214 m | 60,2 | 0/0/142/0 | 0 px |
| `row_house` GN v2 | 17 | 12 080 | 9,214 m | 60,2 | 0/0/142/0 | 0 px |

- Los cinco módulos se regeneran desde `gn_facade_grammar.py` con `--seed=7`; la paleta ya no se
  elige a mano: `ext_lab/gn_palette.py` la deriva del atlas licenciado y mide `deltaStyledL1 = 0,0`
  en ladrillo, piedra, metal y madera (sólo el vidrio se separa 0,064).
- Cornisa: vuelve a medir 1,00 m, parapeto en ladrillo y perfil en piedra del atlas con dentículos
  vivos; el envelope del edificio no se mueve respecto al control, que es lo que estabiliza el marco.
- Encuadre: el `z` de la envolvente de `mixed_tenement` pasa de 9,55 (D-111.1) a 10,00 y sus
  márgenes de recorte son ahora idénticos a los del control. Limitación 3 de D-111.1 cerrada.
- Corte: se miden por separado la caja de sombra del lienzo y la geometría opaca (alfa ≥ 200) del
  PNG entregado. Ningún sprite pierde geometría; la **sombra** sí toca el lienzo en `row_house`
  (0/0/142/0), igual que en 5 de las 6 muestras de la baseline: defecto preexistente del
  `deterministic_crop_rect`, no introducido por GN. Arreglarlo globalmente re-deriva los 888 sprites
  de producción, así que se reporta y no se toca en esta fase.
- Eje a eje, control y candidata son idénticos (`ext_lab/axis_probe.py`, sin Blender): lo único que
  cambia es qué módulo resuelve cada rol.
- Deuda visible: las juntas del sillar miden 0,028 m ≈ 1,4 px a escala de hoja, así que el zócalo
  lee como paño liso a 0,5×. Se corrige en el ciclo de integración (WP06), que regenera GN de todas
  formas, para no gastar dos cadenas completas en el mismo ajuste.

## WP02 — Arch Generator como autoría cívica (medido)

Sheet: [`sheets/ag_civic_ab.png`](sheets/ag_civic_ab.png) y su lectura a escala de juego
[`sheets/ag_civic_ab_half.png`](sheets/ag_civic_ab_half.png). Componente suelto:
[`ag/ag_arcade_bay_2m.png`](ag/ag_arcade_bay_2m.png); brazo de calidad:
[`ag/quality_ab.png`](ag/quality_ab.png); mediciones del horneado:
[`ag/bake-report-high.json`](ag/bake-report-high.json) y
[`ag/bake-report-simplified.json`](ag/bake-report-simplified.json).

| brazo | seed | triángulos | envelope z | px/m | márgenes lienzo (L/T/R/B) | geometría opaca en el borde |
| --- | --- | --- | --- | --- | --- | --- |
| `town_hall` control (Graphic Civic) | 2 | 18 418 | 9,998 m | 60,2 | 0/0/202/0 | 0 px |
| `town_hall` candidata (arcada AG) | 2 | 44 374 | 9,998 m | 60,2 | 0/0/202/0 | 0 px |

El módulo: `mod_ag_arcade_bay_2m`, horneado con `ext_lab/ag_module_bake.py` desde Arch Generator
**1.0.1** instalado sólo en el perfil aislado `/tmp/d111-ext-lab` (nada de su código entra en el repo;
se publica el GLB y su procedencia). Medidas reales del GLB entregado: **920 vértices / 1 810
triángulos**, caja `x[-1,1] · y[-0,15;0,35] · z[0,3]` m, sha256
`cd84ed402a5100b8d41338a586214abd6d42bf1b2955ea66a0a8ec447a2b31a1`.

- **Paso de crujía exacto.** La arcade se corta por el eje del estribo (`x = ±1,00` m), así que dos
  bays contiguos reconstruyen **un** pilar por junta en vez de dos. Se comprueba tileando tres copias
  en el render de evidencia (5 430 tri = 3 × 1 810) y se ve en la fachada sur-este del piloto.
- **Banda rellenada por medida, no declarada.** La altura del estribo (`stambhaHeight`) se converge
  midiendo el techo real del arco: 2,30 m → techo 3,30 m; 2,00 m → techo **3,00 m** exacto. El módulo
  ocupa toda la banda de 3 m que sustituye, que era el hueco que dejaba la arcade original de la
  extensión.
- **Materiales del atlas, no blancos.** El fuste, el arco y el vidrio salen de los mismos buckets de
  `gn_facade_grammar.MATERIALS` que el resto de la fachada (`gn_brick_wall`, `gn_stone_trim`,
  `gn_dark_glass`), así que el perfil Graphic Civic los trata igual que a los módulos licenciados y
  no aparece el "blanco de yeso" de D-111.1.
- **A/B sin tocar la gramática aprobada.** En WP02 el brazo se conseguía con `ab_grammar_patch.py
  --source=ag`, que sustituía sólo el rol `window_bay` de la paleta ya sorteada y luego devolvía el
  manifiesto al `sha256` de HEAD. Desde WP06 la misma ruta vive en el perfil `ag_civic_v2` de
  `building-composer-candidates.json`: un overlay en memoria, validado con las guardas de §11/§17 y
  comprobable con `pnpm art:building-composer:candidates:test`, que **reproduce la firma publicada**
  `d950e513e67e` sin escribir nada en el árbol (medido: 0 px con Δ>8 entre el PNG del parche y el del
  perfil). Con seed 2, control y candidata comparten los nueve ejes
  (`massing`, `facade`, `bay_sequence`, `silhouette`, `roof`, `access`, `intrinsic_props`,
  `secondary_volume`, `recipe`) y las **82 colocaciones**: 21 `mod_megakit_trim_window_2m` se
  convierten 1:1 en 21 `mod_ag_arcade_bay_2m`. La diferencia de imagen es el módulo, nada más.
- **Coste aceptado porque la mejora es visible.** +25 956 tri (×2,41) a cambio de que el hito cívico
  se reconozca como edificio porticado y no como caja de ladrillo con ventanas blancas. El coste es
  **offline**: el entregable sigue siendo un PNG de 1,79 MB (1,84 MB en el control), por debajo del
  presupuesto de archivo único de `PERFORMANCE-BUDGET.md`, y el runtime no paga triángulos. El
  render del lote duró 91,9 s.
- **Densidad: el tope vinculante es de binario, no de triángulos.** `building-style-profiles.json` lo
  declara explícitamente (D-081, 1 MiB por archivo) y el GLB mide **109 648 B**, un 10 % del tope. Lo
  que sí mueve el perfil es la banda medida: al entrar el vano, `trianglesPerModule` pasa de p90
  1 038,5 a **1 076,6** (máx 2 960) y `facadeTrianglesPerSquareMeter` de p50 25,2 / p90 69,08 a
  **28,45 / 82,9**, porque este módulo es el panel de planta más denso del catálogo: 1 810 / (2×3 m) =
  **301,7 tri/m²**. La rationale del perfil avisa de para qué se mide esa banda —«que el compositor no
  apile módulos de máximo detalle en un mismo alzado»— y en la candidata de seed 2 hay 21 vanos en
  cuatro alzados, así que el apilamiento ocurre y se declara. Como el entregable de runtime es un PNG,
  el coste es de generación; si algún día el cívico se dibuja con geometría viva, este número es el
  que hay que revisar primero.
- **Brazo de calidad registrado.** `simplified` (938 tri, -48 %) se hornea y se compara
  ([`ag/ag_arcade_bay_2m_simplified.png`](ag/ag_arcade_bay_2m_simplified.png)): pierde el estriado
  del fuste y el óvolo del capitel, que son justo las siluetas que sostienen la lectura a 0,5×. Se
  adopta `high` y el alternativo queda medido por si un futuro lote industrial lo necesita.
- **Deuda de componente, no bloqueo.** Dos cosas se van a WP06 con nombre y medida: (1) el módulo es
  más profundo que la convención (`0,50` m frente a `0,40` del GN residencial), porque un pórtico ha
  de volar; en las esquinas su cara de corte se ve como un retroceso marrón de 0,13 m. (2) Al final
  de una crujía (esquina de edificio) el corte deja la media columna y las esquinas del archivolt
  a pico; hace falta un tratamiento de cierre (pilastra o módulo espejo). Ninguna de las dos es un
  defecto de horneado: son decisiones de composición que pertenecen al paquete de integración.
- **Licencia separada.** `bake-report-*.json` embarca `licenceNote`: GPL-3.0-or-later es la licencia
  del **código** del add-on; la geometría exportada se registra como `original` del proyecto porque
  el repo no redistribuye el add-on, sólo su salida. `staging-sources.json` fija el `sha256` del
  archivo y el adaptador que lo produce.

- **Las dos hojas v2 se han recompuesto.** `compose_review_sheets.py` ahora permite 7 líneas de pie en
  los paneles del Composer (`max_lines`) y agrandar la evidencia de componente (`upscale`); a 0,5× el
  tope anterior de 4 líneas se comía justamente la línea que declara qué eje cambió. Son cambios de
  maquetación: los PNG/JSON de los sprites no se han vuelto a renderizar, así que
  `sheets/gn_v2_ab*.png` de WP01 muestran el mismo contenido con el pie completo.

## WP03 — HiFi y Archimesh como componentes (medido)

Hojas: [`sheets/ext_window_columns.png`](sheets/ext_window_columns.png) (control / HiFi / Archimesh
resolviendo el mismo vano) y su lectura a 0,5×
[`sheets/ext_window_columns_half.png`](sheets/ext_window_columns_half.png);
[`sheets/hifi_grid_ab.png`](sheets/hifi_grid_ab.png) (receta libre vs receta sobre retícula) y
[`sheets/hifi_grid_ab_half.png`](sheets/hifi_grid_ab_half.png). Fotogramas sueltos:
[`ext/control_gn_window_bay.png`](ext/control_gn_window_bay.png),
`ext/hifi_window_bay_2m_{high,simplified}.png`,
`ext/archimesh_window_bay_2m_{high,simplified}.png`,
[`hifi/hifi_facade_free.png`](hifi/hifi_facade_free.png),
[`hifi/hifi_facade_grid.png`](hifi/hifi_facade_grid.png).

| brazo del vano (crujía 2 m · banda 3 m) | tri del módulo | caja medida | relieve: pide → entrega | materiales | veredicto |
| --- | --- | --- | --- | --- | --- |
| control `mod_gn_window_bay_2m` | **216** | x[-1,1] y[-0,2;0,2] z[0,3] | ya dentro de caja (3 hojas: paño, vidrio, trim) | atlas ×3 | **se queda**: es lo que el catálogo publica hoy |
| HiFi `high` (5 llamadas) | **98** | x[-1,1] y[-0,15;0,35] z[0,3] | +0,37 → +0,35 m (cada pilastra pierde 4 de 12 tri) | atlas ×3 | descartado: hueco sin dividir |
| HiFi `simplified` (decimate 0,45) | **44** | id | id | id | descartado: el marco se colapsa |
| Archimesh `high` | **1 358** (pide 1 488) | id | +0,39 → +0,35 m (alféizar pierde 2 de 12 tri) | atlas ×4 | descartado: hojas y manijas quedan dentro del paño |
| Archimesh `simplified` (decimate 0,45) | **610** | id | id | id | sin pérdida visible: la **técnica** sí se registra |

- **Los dos vanos se descartan, y el motivo es geométrico, no de gusto — pero por razones distintas.**
  - *HiFi*: `WINDOW_FLAT` expone cinco propiedades (ancho, alto, profundidad, grosor de marco y cota
    de base); **ninguna divide el hueco**, así que no hay montantes ni travesero y el vano se lee como
    un solo ojo. El control GN resuelve marco con retranqueo, dos montantes, travesero, alféizar con
    retorno y dintel en 216 tri.
  - *Archimesh*: sí divide (genera `Window.L` y `Window.R` con su manija), pero la carpintería **cae
    dentro del volumen del paño**. El paño canónico mide 0,10 m (y ∈ [-0,15; -0,05]) y el lote de
    Archimesh es un componente de 0,54 m de fondo pensado para un muro de obra: asentado por detrás,
    sus hojas quedan en y = -0,105 y -0,055 y las manijas en -0,146 y -0,097, todas por detrás de la
    cara del paño. En el fotograma el hueco muestra el color del ladrillo, no vidrio: la carpintería
    está oculta por construcción, no "demasiado pequeña". Para que el vidrio quedara visto habría que
    adelantar el componente, y entonces el alféizar (que ya pide +0,39 m) saldría aún más de la caja.
- **Despiece medido, no estimado.** `partsBreakdown` en cada JSON lista por pieza material, triángulos
  pedidos, triángulos que sobreviven al corte y su cota y: Archimesh produce 1 488 tri de los que
  **912 (61,3 %) son las dos manijas**, 356 las hojas y 208 el marco; HiFi produce 80 tri (marco 32,
  alféizar 12, dintel 12, dos pilastras 12 cada una). Es el dato que cierra la pregunta
  "¿aportan detalle visible?" con la respuesta de arriba.
- **La pilastra de HiFi no es una pilastra.** `PILLAR` genera una columna exenta de 0,34×0,34 m con su
  base y su capitel. Las dos pilastras miden **+0,37 m** de frente, **0,42 m por delante de la cara del
  paño** (-0,05) y 0,10 m más que el propio marco (+0,27); en el fotograma se leen como soportes sueltos
  que bajan hasta el suelo de la banda, no como el retranqueo de junta que se pretendía. Y el relieve
  está invertido: el alféizar (+0,33) y el dintel (+0,30) salen más que el marco, porque se resuelven
  con bloques `CEILING`.
- **Auditoría del corte (`cutAudit`), que es lo reutilizable del adaptador.** Cada evidencia registra
  `trianglesRequested`, `trianglesSurviving`, `maxRequestedFrontYMeters` y el límite canónico
  `frontLimitMeters` = +0,35 m. Con eso se decide en un minuto si una pieza de extensión cabe: HiFi
  pide 80 y entrega 72 (las dos pilastras pierden 4 tri cada una), Archimesh pide 1 488 y entrega
  1 346. Ninguna de las dos se recorta por capricho del adaptador: se recorta porque **no caben**.
- **Los presets de Archimesh no hacen nada en esta receta (medido).** Los brazos `high`
  (`model=2`, `frame=0,09`) y `simplified` (`model=1`, `frame=0,07`) generan **el mismo lote**:
  1 488 triángulos repartidos igual por pieza y las mismas cotas y al milímetro. Lo único que cambia
  el GLB exportado es el decimate posterior al corte (1 346 → 610). WP05/WP06 no deben contar con
  `model` como palanca de calidad.
- **Por qué el relieve por pieza se mide con grupos de vértice y no con `matrix_world`.** La primera
  versión medía cada pieza antes del `join` y daba un alféizar de Archimesh en +0,91 m, contradiciendo
  los +0,39 m de `seating.projectedFrontMeters`: `build_archimesh` re-parenta y gira sus objetos 180° y
  `build_hifi` los padrea a un Empty girado, así que el espacio de mundo de cada pieza y el espacio
  local del lote unido no coinciden. Ahora cada pieza se etiqueta con un grupo de vértices antes del
  `join` y se mide sobre la malla ya asentada y sobre la ya cortada; la guarda es la identidad
  `max(pieza) == projectedFrontMeters`, que en los cuatro brazos horneados se cumple exacta.
- **Receta HiFi sobre la retícula del Composer (`hifi_lab.py --layout=grid`).** La diferencia entre la
  muestra vieja y la nueva no es de encuadre ni de luz —misma extensión, misma cámara (ortogonal az
  45°, escala 23,6, target 5,4), mismo mood `day_civic`, mismos materiales del atlas— sino de receta,
  y está medida por `gridAudit` sobre la geometría construida:

  | métrica | `free` (baseline) | `grid` (WP03) |
  | --- | --- | --- |
  | huecos auditados | 11 | **37** |
  | desvío máx. al centro de crujía | 0,70 m | **0,00 m** |
  | líneas de banda auditadas | 3 | 3 |
  | desvío máx. a la línea de forjado | 0,55 m | **0,00 m** |
  | postes de balaustrada / paso | 17 / 1,0562 m | **10 / 2,0000 m** |
  | desvío máx. de poste a junta | 1,00 m | **0,00 m** |
  | barandillas de balcón | 0 postes | 25 postes en 5 tramos, cada tramo centrado en su crujía (0,00 m) |
  | llamadas a la extensión | 38 | 135 |
  | piezas de laboratorio (masa, cubierta, hojas, cristales) | 11 | 29 |
  | triángulos de escena | 2 356 | 5 976 |
  | segundos de render | 4,82 | 5,15 |

- **Límites de capacidad medidos en la propia extensión** (son la razón por la que HiFi se queda como
  herramienta de receta y no como fuente de módulos): `WINDOW_FLAT` = 5 propiedades, sin división de
  hueco; `BALCONY` = 7 propiedades, **no genera balaustres**; `FENCE` sí expone `fence_posts` (INT) y
  reparte los postes desde su origen hasta `length`, así que la balaustrada y las barandillas de los
  balcones se resuelven con `FENCE` apoyado en la cota medida del forjado — técnica reutilizable que
  nace de este paquete.
- **Cuatro defectos de la primera corrida `grid`, corregidos con medida** (cada uno visible en la hoja
  anterior a la que está versionada): lesenas colocadas en `x = ±7` en vez de sobre las juntas
  extremas; antepecho de balcón macio que tapaba el hueco (sustituido por un bordillo de 0,12 m más
  barandilla `FENCE`); bandeja de cubierta flotando sobre la cornisa (la losa se apoyó en
  `top + 0,05`); paleta rosa del laboratorio (ahora `--materials=atlas`).
- **Integridad de los fotogramas.** `geometry_border_hit` (alfa ≥ 200) sobre los siete PNG de WP03:
  **0 píxeles sólidos en los cuatro bordes** en todos. Ninguna muestra está recortada.
- **Determinismo verificado en tres re-corridas.** Al cerrar WP03 los cinco brazos se regeneraron tres
  veces (corregir el campo `command`, medir el despiece pieza a pieza, corregir la nota de
  procedencia) y el `sha256` de los cinco PNG no cambió en ninguna: `e6b56b8f…`, `2af2d1d3…`,
  `bb6c5112…`, `a665cc36…`, `7d9250e0…`. Lo que sí movió el fotograma antes de eso (el vidrio pegado a
  la cara interior del paño y la pintura por rol en vez de todo en piedra) está registrado arriba como
  hallazgo, no como deriva.
- **Normalización.** Como no se adopta ningún componente, no entran `sourceId` nuevos en
  `building-modules.json` y el catálogo sigue en 187 módulos. Lo que sí queda normalizado es el
  **camino**: `ext_module_bake.py` convierte la salida de cualquier extensión en la caja canónica
  (crujía 2 m, banda 3 m, `y ∈ [-0,15; +0,35]`, asiento medido por `seat_in_bay`, corte a junta y
  brazo decimado), que es el adaptador que WP05/WP06 reutilizarían si una pieza industrial o cívica
  saliera de una extensión.
- **Licencia separada.** HiFi 4.6.7 (GPL-3.0-or-later) y Archimesh 1.2.5 (GPL-2.0-or-later) se
  instalan sólo en el perfil aislado `/tmp/d111-ext-lab` con `sha256` fijado en
  `lab_common.EXTENSIONS`; en este repo no hay ni una línea de su fuente. La geometría horneada se
  registra como `original` del proyecto y cada JSON embarca `licenceNote` con esa distinción.

## WP04 — Tiers de conservación sobre el MISMO edificio (medido)

Hoja: [`sheets/weathering_states.png`](sheets/weathering_states.png) y su lectura a 0,5×
[`sheets/weathering_states_half.png`](sheets/weathering_states_half.png). Fotogramas:
`weathering/day/` (A conservado · B envejecido · C dañado · D ardiendo), `weathering/night/` (E/F),
`weathering/optout/` (el request sin la clave), `weathering/mask/` (ocho paños 16×12 m con su máscara)
y `weathering/probe/` (cuatro sondas: dos verdes de cobertura y dos nocturnas de emisión).

Contrato: `blender_artist/manifests/building-weathering-contract.json`
(`graphic_civic_weathering_v1`, `sha256` publicado `22a02a14a4f3…`; la receta de la primera corrida era
`c939dda2…`). Cada brazo embarca `weathering.contractSha256`, `materialsChanged`, `skipped` y por
material la receta efectiva, el BSDF elegido, la fuente de color y las cotas `before/after` de
rugosidad y emisión — o sea que la hoja dice con qué receta se renderizó sin que nadie la cite a mano.

| tier | qué se toca | materiales | delta contra el control | señal de ocupación |
| --- | --- | --- | --- | --- |
| A conservado | nada: proyección declarada, cero capas | 0 / 3 excluidos | contra el request sin `weathering`: \|Δ\| media 0,0/255 · tono −0,0 · 0,0 % sobre la cota de §13 | intacta |
| B envejecido · día | sólo material (misma firma `175d2309dd83`, mismos 24 162 tri) | 20 / 3 | \|Δ\| media 11,3/255 · tono −11,1 (domina el tono) · mediana 12,4 · 88,5 % del lienzo sobre la cota | intacta |
| B envejecido · noche | igual con ×0,7–0,8 en fuerza | 20 / 3 | \|Δ\| media 5,5/255 · tono −5,3 · 75,5 % | hueco ×0,9997 y 91,5 % byte-idéntico |
| C dañado | geometría del compositor | — | colocaciones 115→105 · triángulos −564 · hollín 0,45 sobre 26 materiales | n/a (sprite distinto) |
| D ardiendo | geometría + VFX | — | 115→112 · +1 096 tri · hollín 0,7/29 materiales · llama a emisión 2,0 en 2 materiales | n/a |

- **WP04-D2 · el defecto central: la mitad del edificio no envejecía, y el motivo era un nombre.**
  El contrato excluía la familia `interior` en bloque, pero el MegaKit residencial llama
  `MI_InteriorWall` al material que lleva `T_RedBrick_BaseColor`, es decir al **ladrillo del alzado**.
  La sonda lo midió: mugre pedida al 100 % de fuerza sobre este mismo request (manifiesto de trabajo
  aparte) deja **46,1 % de los 600 960 píxeles opacos sin tratar** con la familia excluida y
  **3,1 %** después de corregirla. La exclusión pasó de familia a nombre
  (`MI_FakeInterior*`, `MI_InteriorFloor*`, `MI_InteriorRoof*`), `exclusions.families` queda vacío y
  el residual sin tratar es exactamente lo que no se ve en el alzado: fondo del hueco y forjados.
  El paño recibe ahora la receta de ladrillo (`strength 0,40`, `baseSoiling 0,36`) y la guarda del
  contrato exige que `interior` no pueda quedar más sucio que `brick` ni desviarse >0,05 de fuerza.
- **El tier envejecido cambia el TONO, no sólo el grano.** La primera corrida producía un archivo
  distinto que no se leía como envejecido: \|Δ\| medio 8,1/255 con mediana 0 y tono −0,1 (máscara de
  alta frecuencia promediando a cero contra el control). La receta actual añade `baseSoiling` —película
  uniforme de baja frecuencia— y el tono pasa a −11,1/255 con el 88,5 % del lienzo sobre la cota de
  ruido. Dos reglas nuevas en `test_building_weathering_contract.py` hacen imposible reescribir esa
  receta: `strength > 0` con `baseSoiling = 0` y `baseSoiling > 0` con `strength = 0` fallan la
  validación, porque la segunda declara una película que `apply_material` no aplica nunca.
- **La rampa de gravedad se ve, franja a franja.** `gravityRamp` sólo puede hacer una cosa —subir la
  máscara hacia la cota baja del muro—, así que su firma es un gradiente monotónico: tono por tercios
  de cubierta a planta baja **−6,0 · −10,8 · −13,8/255**. Medido en el par nocturno da lo mismo
  (0,0 % de caída >8/255 en el tercio superior frente a 54,8 % en la planta baja).
- **WP04-D3 · la palanca de emisión del contrato es inerte en este encuadre (medido brazo contra
  brazo).** El socket sí se escribe: la metadata registra `Emission Strength` 1,15 → 0,897 con la
  receta publicada. Para saber si eso se ve se re-renderizó la misma receta nocturna con
  `emissionScale` en sus dos extremos: **0,0 → socket 0,0; 0,78 → 0,897; 1,0 → 1,15; y los tres PNG
  son el mismo raster** (1 píxel de 1 188 402 difiere en 1/255, ruido del codificador; luma media
  52,32/255 en los tres). El motivo es de procedencia, no de orden: los únicos materiales con emisión
  cableada por el mood son `colormap` y `colormap.001`, que traen `mod_kenney_com_awning_1_6m` y
  `mod_kenney_com_block_k`, y en este seed la luz de ventana que se ve sale del `MI_Glass` del MegaKit
  teñido por `night_civic`. Consecuencia directa para WP07: **`emissionScale` no es una palanca de
  legibilidad nocturna sobre edificios residenciales MegaKit**; la legibilidad del hueco hay que
  ganarla con luz y con el panel de ventanas del runtime.
- **Por qué el vidrio no se oscurece (y por qué eso es medible).** De día el hueco ya es casi negro;
  bajarlo lo convertiría en agujero y borraría la retícula de crujías que es la firma del perfil. La
  receta `glass` es `strength 0` + `roughnessAdd 0,22` (0,88 → 1,00 medidos en el socket) y
  `emissionScale null`. De noche, sobre los 19 618 píxeles de hueco encendido (luma > 0,45 en el
  control, 3,26 % del área opaca) la luma media pasa de 140,05 a 140,01 (**×0,9997**) y el 91,5 % de
  esos píxeles es byte-idéntico: el envejecido pierde contraste de paño, no la señal de uso.
- **Calibración por familia, no de oído.** `weathering/mask/` renderiza ocho paños de 16×12 m
  (day_civic, contrato `22a02a14`): máscara media 0,42–0,83 y oscurecimiento −30,0/255 en la familia
  más tratada (`wood`); todas las familias con color alterado superan la cota de ruido de §13 y su
  delta es de tono. `metal` es la tratada más débil (−5,40/255 con 69,4 % sobre ruido) y `glass`
  no altera color por diseño — dato útil para WP05, que industrial es metal y madera.
- **Opt-in de verdad.** El mismo request **sin** la clave `weathering` es idéntico píxel a píxel al brazo
  `conserved` (1 píxel de 1 188 402, Δ máx 1/255), así que el control de los sprites aprobados no se
  cae: `--weathering` es una bandera de trabajo, no un default.
- **Nada se promociona.** `building-modules.json` sigue en 187 módulos y los hashes de
  `apps/web/src/generated/runtime-assets*.json` salen iguales en `before`/`after` de las tres métricas
  de la corrida. No se tocó simulación, guardados, economía ni topología vial: la derivación
  `condition >= 60 → conservado / condition < 60 → envejecido` vive en el contrato como
  **declaración documentada** (`derivation` en cada JSON) y no como código de dominio.
- **Coste asumido (SwiftShader, corridas estrictamente secuenciales).** día 4 brazos 245,9 s · noche
  2 brazos 98,8 s · opt-out 1 brazo 50,0 s · sondas de emisión 56,1 s y 50,9 s · pico RSS 4 715 MB.
  El coste extra de las dos sondas nocturnas es lo que compró WP04-D3; sin ellas la hoja habría
  afirmado que la emisión escala un 22 % cuando no escala nada.
- **Determinismo §13 sobre el brazo envejecido.** `--regenerate` (dos pases completos): firma de
  composición, `pivot` (0,5111/0,7684) y dimensiones idénticos; `changedPixels` 3 de 1 188 402 con
  `maxChannelDelta` 1 y `grossFraction` 0 → `COMPOSITION_DETERMINISTIC_GPU_JITTER`; el pase de sombra
  sale bit-estable en ambos pases. Contra el PNG publicado, los dos pases difieren en 5 y 2 píxeles
  (Δ máx 1/255). Los `pixelSha256` no coinciden porque el escritor PNG de Blender no es byte-estable;
  lo que se compara es el raster decodificado.
- **Integridad de encuadre.** `geometry_border_hit` (alfa ≥ 200) sobre los once fotogramas de sprite de
  WP04 (4 día, 2 noche, 1 opt-out, 2 sondas verdes y 2 sondas de emisión): **0 píxeles sólidos en los
  cuatro bordes** en todos. Los paños de `mask/` son teselas de textura a sangre y no son sprites, así
  que no entran en esta guarda.
- **Dos cosas que NO se corrigieron aquí porque deciden el responsable.**
  - **WP04-D1 (CERRADO en FASE 6, 2026-11-22):** la regla de daño retiraba `purpose in ('dormer','cornice')`,
    pero los propósitos reales van prefijados (`cornice:front:3`), así que la cornisa sobrevivía a la
    sección de cubierta. Se arregló con prefijos y se midió; ver [FASE 6](#fase-6--envejecimiento-vs-daño-sobre-el-mismo-edificio-medido).
  - **Runtime:** `buildingAssetStateFor` convierte hoy `condition < 60` en el sprite `damaged`
    (geometría seccionada), o sea que un edificio simplemente desatendido se dibuja derruido. La salida
    natural es publicar el tier envejecido bajo `complete` y dejar `damaged` para integridad
    estructural, pero eso cambia el contrato de assets (D-080) y requiere revisión humana. FASE 6 dejó
    construida y testada la derivación (`building-condition.ts`) y su ruta QA; **no** movió ningún call
    site jugable porque el catálogo runtime aún no tiene sprite `aged`.
- **Lo reutilizable (capacidad, no ajuste puntual).** `weathering.py` aplica el contrato por *familia
  semántica* leída del perfil de estilo (`NON_ELEVATION_FAMILIES` fija el vocabulario; un perfil que
  publique una familia sin receta ni exclusión aborta el `Plan`), audita el BSDF antes de tocarlo
  (`principledNodes`/`wiredToOutput`/`chosen`, porque elegir el BSDF equivocado pinta sobre un nodo
  muerto), permite recetas de sólo película (el cristal de noche) y nunca muta el contrato: el
  multiplicador de mood se aplica sobre una copia. `LANDLORD_ART_WEATHERING_CONTRACT` permite calibrar
  recetas sin tocar el manifiesto publicado — las cuatro sondas de esta sección se generaron así — y el
  orquestador lee la misma variable para no validar contra un archivo y renderizar contra otro.

## WP05 — Nave industrial con módulos de su propia familia (medido)

Hojas: [`sheets/industrial_warehouse_ab.png`](sheets/industrial_warehouse_ab.png) y su lectura a 0,5×
[`sheets/industrial_warehouse_ab_half.png`](sheets/industrial_warehouse_ab_half.png). Evidencia:
[`industrial/dock_aperture_scale.png`](industrial/dock_aperture_scale.png) + `.json` (franja de escala y
huecos medidos), `industrial/warehouse-control.{png,json}`, `industrial/warehouse-candidata.{png,json}`
y [`gn/palette_industrial_day_civic.json`](gn/palette_industrial_day_civic.json).

Cuatro módulos nuevos, todos `original`, todos generados por `tools/art-pipeline/blender/gn_facade_grammar.py`
y ninguno con `allowedFamilies` ajeno a `industrial_heavy`. Medidas del GLB entregado, no del parámetro:

| módulo | crujía | vértices / triángulos | cáscaras | materiales | GLB | `sha256` (12) |
| --- | --- | --- | --- | --- | --- | --- |
| `mod_gn_metal_siding_bay_4m` | 4×0,20×3 m | 432 / **216** | 108 | chapa, canto, goma | 13 832 B | `486f3e3b63a3` |
| `mod_gn_metal_window_bay_4m` | 4×0,20×3 m | 1 056 / **528** | 264 | chapa, canto, vidrio, goma | 31 836 B | `4160fa341148` |
| `mod_gn_truck_dock_bay_4m` | 4×0,20×3 m | 840 / **420** | 210 | chapa, canto, hoja, vidrio, goma | 26 412 B | `f784811ff802` |
| `mod_gn_metal_parapet_4m` | 4×0,20×1 m | 360 / **180** | 90 | chapa, canto, goma | 12 220 B | `e3f0417ee200` |

| brazo (seed 2, day_civic, huella 4×3, 1 planta) | colocaciones | triángulos | módulos | fuentes | envelope z | PNG |
| --- | --- | --- | --- | --- | --- | --- |
| control aprobado (`steel_cladding`, `strip_windows@6`, `parapet`) | 52 | 4 616 | 5 | 1 | 3,00 m | 1 383×873 · 915 213 B |
| candidata GN 4 m | 52 | **7 896** | 6 | 5 | **4,00 m** | 1 394×944 · 958 124 B |

- **El veto no se relajó.** `allowedFamilies` del GN residencial sigue sin admitir `industrial_heavy` y la
  candidata no usa ninguno de esos módulos: la nave se desbloquea escribiendo su propia familia de piezas,
  que era lo que el runbook pedía. Las cuatro entran por la misma cadena de registro que el resto del
  catálogo (`staging-sources` → `inventory` → `selection` → `building-modules.json` → perfiles de estilo →
  anclas del contrato de envejecido) y el catálogo pasa de 187 a **191** módulos.
- **WP05-D1 · el hueco de carga se midió, no se declaró.** `ext_lab/dock_probe.py` calcula el rectángulo
  libre máximo sobre la proyección (x,z) de las caras de la malla exportada, excluyendo por material la hoja
  móvil, el fondo de nave y la carpintería (cada módulo declara sus clases en el propio JSON). Con la caja
  de referencia del repo (**2,50 × 2,60 m**): el `doorframe` metálico de 2 m aprobado deja **1,00 × 2,20 m**
  de paso → `sobranAncho −1,50`, `sobranAlto −0,40`, es decir **el camión no entra; hoy los muelles son
  puertas peatonales** (una persona de 1,75 sí cabe). El portón GN deja **2,60 × 2,68 m desde z = 0,06** →
  caben los dos ejes con 0,10 m de ancho y 0,08 m de gálibo de sobra. La ventana de banda deja **2,60 ×
  0,75 m a z = 1,95**: pasa el ancho, no la altura, que es lo que le toca a una ventana.
- **La variante CC0 de 4 m existe y se descartó midiendo su paleta.** `mod_megakit_metal_window_4m` lleva
  `MI_RedBrick` entre sus materiales: regriduar la nave a 4 m con él habría metido ladrillo en la paleta
  `steel_cladding`. No es un gusto: el control YA mete ladrillo por otra vía, y se midió en el brazo
  aprobado — `deepStyledAtlases = [T_MetalConcrete_BaseColor, T_RedBrick_BaseColor]` (el ladrillo llega a
  través de `MI_InteriorWall` del paño megakit) más tres materiales `linkedWithoutColorSource`
  (`MI_FakeInterior`, `MI_Glass`, `MI_Glass.001`). La candidata cierra las dos cosas: `deepStyledAtlases = []`
  y `linkedWithoutColorSource = []`. Los atlas de suelo/asphalt del `directReach` son los mismos en los dos
  brazos, así que la comparación de fachada sigue siendo manzana con manzana.
- **Los flats GN no se eligieron a ojo.** `gn/palette_industrial_day_civic.json` deriva el color de las tres
  superficies nuevas del **mismo atlas licenciado** que usa el control (`T_MetalConcrete`) cogiendo el cluster
  dominante de cada banda de valor — shares reales 10,34 % / 4,04 % / 2,44 % de sus píxeles—; el paño
  reutiliza el cluster de WP01 (28,26 %). Con la tabla publicada como `--authored`, `deltaStyledL1 = 0,0` en
  los siete planos y 0,0637 en el vidrio, y el residuo contra `night_civic` y `day_industrial` es 0,0: la
  coincidencia es estructural, no por captura. Dato nuevo y honesto: tras el tratamiento los cuatro planos
  industriales **colapsan a dos valores** (día 0,66 / 0,358 / 0,34 / 0,34), así que la hoja del portón y el
  reveco de goma acaban en la misma banda; lo que separa la hoja del hueco es el relieve de las lamas y el
  canto claro del marco, no el color. Se ve en el recorte a 1× de la hoja.
- **WP05-D2 · el eje de silueta de la nave no existía.** En HEAD `plain` y `parapet` declaraban
  `corniceRole: null`, o sea dos opciones geométricamente idénticas: el sorteo de silueta no cambiaba nada.
  El pretil GN le da remate real a las dos y las separa por vuelo (0,20 m el pretil ciego frente a 0,35 m de
  la banda volada). Su altura es **1,00 m** porque es la convención del catálogo: de los 18 módulos con rol
  `cornice`, 12 miden 1,00 m y 5 miden 0,998 (los trims, por redondeo de la malla); el único distinto es un
  remate plano de 0,02 m del cívico. Por eso el envelope del brazo candidato sube de 3,00 a 4,00 m y el
  lienzo de 873 a 944 px; la cubierta no se toca —es el mismo `mod_megakit_roof_flat_4m` a z = 3,0 en los dos
  brazos y el píxel de su paño sale idéntico (65, 66, 69)—.
- **El A/B atribuye a los módulos, con una excepción declarada.** De los nueve ejes sorteados, ocho son
  idénticos entre brazos; difiere `access`, y su sufijo no es un sorteo nuevo sino el índice de crujía por
  donde empieza la hilada (`compose.py:353` → `f"{access['id']}@{self.access_bay}"`). Al pasar la retícula de
  2 a 4 m la hilada corre **1,00 m en X** (−7, −3, +1, +5 → −6, −2, +2, +6) conservando los cuatro huecos y
  el paso de 4 m que declara `repeatEveryMeters`: son los mismos muelles centrados en la retícula nueva, no
  otro edificio. El seed 1002 (ritmo `blind_siding`, paleta `metal_brick_mix`, silueta `metal_cornice`) es el
  caso ciego sin ventanas: allí la candidata también cambia (80→52 colocaciones, 2 516→6 648 tri) porque
  paño, portón y pretil no dependen del ritmo — la retícula de 4 m divide las colocaciones a la mitad y cada
  una lleva más geometría.
- **Ningún sprite aprobado se regenera.** Con los cuatro módulos ya registrados, el brazo de control
  reproduce las firmas de HEAD `59f0c437e1c2` (seed 2) y `3b1c9a197bc2` (seed 1002) byte a byte, y las anclas
  del contrato de envejecido se re-fijaron sin re-serializar el JSON (diff de 2 líneas, no de 437).
- **Trampa evitada y documentada (es la que más fácil se repite).** `compose.py:1055` resuelve el marco del
  acceso **sin id** y `module_catalog.py:116` devuelve `pool[0]` de un pool que `module_catalog.py:88`
  construye `sorted(modules, key=id)`: un módulo GN de 4 m con rol `doorframe` habría sustituido el marco
  peatonal de 2 m en las cinco gramáticas industriales sin tocar un solo manifiesto (medido: §17 aborta por
  contacto con el suelo fuera de solar). Por eso el portón declara su propio rol `dock_doorframe` y el
  perfil `gn_industrial_v2` lo pide explícitamente con `accessOptions.frameRole`. El mismo mecanismo deja
  `mod_gn_metal_window_bay_4m` como `pool[0]` de
  (`industrial_heavy`, `window_bay`) por delante de los megakit: hoy es inalcanzable porque las diez paletas
  industriales pinchan ese rol en `roleModule` y `compose.py:692` pasa el id, pero si una undécima deja de
  pincharlo entra sin avisar. Queda escrito en la nota del módulo y en la del perfil.
- **Coste aceptado porque la mejora es visible y el gasto es offline.** 4 616 → 7 896 tri (×1,71) con las
  mismas 52 colocaciones; el entregable sigue siendo un PNG (958 KB, dentro del presupuesto de archivo
  único). El lote de la candidata tardó **31,8 s** de total (8,8 s de render, 3,63 GB pico) frente a 62,3 s
  del control en la misma máquina sin GPU; la sonda de huecos cuesta 4,67 s.
- **Deuda que se va a WP06 con nombre.** (1) `metal_brick_mix` es un **no-op en HEAD**: ningún ritmo
  industrial declara `groundRole`, así que sus dos paletas resuelven exactamente los mismos módulos y la que
  se llama "con zócalo industrial" no tiene zócalo; en la candidata el ladrillo desaparece también en esa
  paleta, que es justo la que lo promete por nombre. Arreglarlo es enmienda de gramática (decisión del
  responsable), no de módulo. (2) La candidata es 100 % flats GN, y WP04 midió `metal` como la familia
  tratada más débil (−5,40/255): el tier `aged` sobre chapa hay que medirlo antes de promocionarlo. (3) El
  pretil entra por `flatStyledMaterials`, sin atlas, así que el envejecido no lo toca por la vía profunda.
- **Cierre: ACEPTADO.** Hay candidata industrial reconocible —portón de camión medido, puerta de personal
  con mirilla, junta de nave, cubierta y remate coherentes, chapa sin ladrillo— y ningún hueco se presenta
  como muelle completo: la prueba es la franja de escala, donde el control no pasa la caja y la candidata sí.

## WP06 — Cuatro candidatas por perfil de candidato (medido)

El encargo de WP06 era de integración, no de geometría nueva: que los brazos de WP01, WP02 y WP05 se
compongan **desde una ruta de selección independiente de la gramática de producción**, sin parches que
puedan dejar el repo inconsistente; una candidata por familia; y verificar huella, orientación, altura,
pivote, licencias y ausencia de colisiones evidentes. El cierre son cuatro candidatas revisables
(`row_house`, `mixed_tenement`, `warehouse`, `town_hall`) con dos autorías distintas, no el catálogo
entero regenerado.

### El mecanismo, y por qué sustituye al parche

`blender_artist/manifests/building-composer-candidates.json` declara tres perfiles
(`gn_residential_v2`, `ag_civic_v2`, `gn_industrial_v2`). Un perfil es un **overlay en memoria sobre una
copia** de la gramática aprobada: `GrammarDocument.grammar()` lo aplica **antes** de `_check_roles` y
`_check_recipes`, así que un ancho de módulo que no encaje en la crujía corta por el §17 exacto que
cortaría si el propietario lo promoviera. No se escribe ningún archivo del árbol y el `sha256` del
manifiesto aprobado deja de interesarle a la corrida, porque la corrida ya no lo toca.

Tres guardas impiden el silencio, que era el defecto real del parche:

- **Toda sobrecritura que no muerde aborta.** Sustituir un rol que ningún ritmo, silueta, acceso,
  volumen, cubierta, prop, secundario ni feature sortea (`wainscot` en `mixed_tenement`: sus tres ritmos
  arrancan en `window_bay`) es `GrammarError`, no un brazo que se anuncia con una autoría ausente de la
  imagen. Igual que un `corniceModule` con `corniceRole: null` (`_build_cornice` no llegaría a correr),
  una paleta inexistente, un rol que la paleta no publica, un módulo de otra familia o un overlay vacío.
- **El orquestador no deja esparcir el brazo.** `--candidate` exige `--types` explícito y corta si el
  perfil no declara el tipo pedido: son las dos formas en que un piloto podría salir etiquetado con la
  autoría de otro.
- **El request y el documento tienen que estar de acuerdo.** `compose.py` compara `candidateProfile` del
  request con el del documento y aborta si difieren, así que una fila del manifiesto no puede prometer un
  brazo que no se compuso.

La misma bandera existe en el conductor de contexto urbano (`build_building_composer_context.py
--candidate=`), con guarda previa sobre las familias declaradas para no dejar un `outDir` a medias.
**Comprobado sólo como sonda**: la corrida `--types=row_house,mixed_tenement --candidate=gn_residential_v2`
deja `candidateProfile: gn_residential_v2` en las dos filas de su `urban-context-index.json` (1× y 0,5×),
pero sus PNG viven en `/tmp` y no se han versionado. La evidencia de contexto versionada con el perfil
real corresponde a WP08, que es donde el encargo pide la calle poblada; aquí se registra el mecanismo y
su guarda, no una captura que no está en el repositorio.

`pnpm art:building-composer:candidates:test`
(`tools/art-pipeline/blender/test_building_composer_candidates.py`) compone los cuatro brazos **sin
Blender** y comprueba diez sondas de guarda —siete de overlay que no muerde (rol que la familia no
sortea, rol que la paleta no publica, cornisa sin `corniceRole`, módulo de otra familia, módulo
inexistente, paleta inexistente, overlay vacío), una de tipo que el perfil no declara y dos de request
y documento desparejados—, además de que sin `--candidate` las cuatro gramáticas siguen firmando el
lote aprobado (`9e90ea10ba92`, `b85340a2c0a8`, `59f0c437e1c2`, `b23ff442da1d`). Es el gate de este
paquete: la neutralidad del camino por defecto es una propiedad medida, no una promesa.

Se retiraron los dos drivers que reescribían el manifiesto en el árbol
(`ext_lab/ab_grammar_patch.py`, `ext_lab/gn_facade_patch.py`). Sus hallazgos no se perdieron: el
escaparate GN sin ruta legal migró a la nota de `gn_residential_v2` (con el `SEMANTIC_IDENTITY_INCOMPLETE`
medido en WP01), la trampa del `pool[0]` por orden alfabético ya estaba en la nota de
`gn_industrial_v2`, y la justificación de "sustituir, no añadir" sigue en
`docs/art/BUILDING-COMPOSER.md` §37. Lo que **sí** deja de ser re-renderizable es el brazo v1 de §3
(`facade: brick_commercial → gn_masonry_bays`, firma `b1d36ae74df6` en `evidence/pilots/`): añadía una
paleta nueva, y un perfil no puede añadir opciones de eje porque eso desplazaría el sorteo de §16 y la
A/B compararía dos espacios de variantes en vez de dos autorías. La evidencia v1 queda como histórico
con su `axisChoices` y su firma publicados.

### Equivalencia con el brazo que cada perfil sustituye

| tipo | perfil | firma del brazo parcheado | firma por perfil | Δ píxel sobre el PNG publicado |
| --- | --- | --- | --- | --- |
| `mixed_tenement` | `gn_residential_v2` | `94f1106d02e6` | `94f1106d02e6` | **0 px** con Δ>8 · Δ máximo 2/255 · 99,98 % idéntico |
| `warehouse` | `gn_industrial_v2` | `460b94c4e447` | `460b94c4e447` | **PNG idéntico byte a byte** |
| `town_hall` | `ag_civic_v2` | `d950e513e67e` | `d950e513e67e` | **0 px** con Δ>8 · Δ máximo 2/255 · 99,99 % idéntico |
| `row_house` | `gn_residential_v2` | `2d0f6ea34ddd` | `5468186522ad` | 10 372 px (0,87 %) · Δ máximo 204 |

Los tres primeros son el resultado que WP06 persigue: la ruta nueva reproduce el brazo revisado y el
único cambio entre el PNG del parche y el del perfil es el redondeo del codificador. La diferencia de
`row_house` no es del perfil sino del **arreglo de orientación** que este paquete tenía que hacer.
Medido contra el PNG del parche (`2d0f6ea34ddd` → `5468186522ad`), el único campo que cambia en las 92
colocaciones son 16 rotaciones del zócalo, invertidas sobre las mismas posiciones: frontal 0°→180° (×4),
trasera 180°→0° (×8) y las dos laterales 270°→90° / 90°→270° (×2). El zócalo y la cornisa GN se autoraron
con el origen en el plano posterior para que su `frontAxis` saliera `+Y` en vez de `symmetric-Y`, y con
eso las juntas de sillar dejan de mirar al interior del volumen —la deuda visible que WP01 dejó declarada
como "se corrige en el ciclo de integración". La cornisa recibe el mismo arreglo de origen y **no mueve
ninguna rotación**: `mixed_tenement`, que es el otro brazo que la coloca, firma idéntica antes y después
(`94f1106d02e6`), así que el cambio se atribuye al zócalo y a nada más.

### Lo que cuesta el arreglo de orientación

Autorar el zócalo y la cornisa con el origen en el plano posterior regenera el `.blend` vivo, los dos
`.glb` y su informe de medidas, y con ellos los tres manifiestos derivados:
`building-module-inventory.json` (1 259 fuentes, `inventory-unchanged`), `building-modules.json`
(191 módulos, `catalog-unchanged`) y `building-style-profiles.json`. Del catálogo cambian sólo
`pivot.convention`, `anchor` y `measured.importOffset` de esos dos módulos;
`moduleBoundsInPlacementFrameMeters` —la caja que consume el compositor— no se mueve, que es lo que hace
coherente que el envelope de `row_house` sea idéntico en la tabla de verificación.

El primer efecto colateral medido lo dio el contrato de envejecimiento de WP04, que pinta el byte a byte
el catálogo sobre el que se midió: `art:weathering:contract:test` cortó con
`f68d666edc11 ≠ 3d159acc9685`. Es el tripwire funcionando, así que se re-estamparon los dos hashes y la
razón queda escrita dentro del propio manifiesto (`pins.restamped`), no en este README: el diff del perfil
de estilo son las dos líneas de pin y nada más, ninguna familia medida cambia, y lo que de verdad impide
un re-estampado que sí escondiera material nuevo es `check_family_coverage`, que compara las claves de
`materials` contra el perfil vivo en cada corrida. Apuntado como deuda para WP09, sin arreglar aquí: un
pin byte-exacto sobre un manifiesto de 25 000 líneas corta por cualquier metadato inocuo, y acotarlo al
subconjunto medido es decisión del responsable, no de este paquete.

### Qué mueve cada perfil sobre su control
| tipo | colocaciones | ejes sorteados | campos que difieren (control → candidata) |
| --- | --- | --- | --- |
| `row_house` | 92 → 92 | 9/9 idénticos | `moduleId` 40 (16 zócalos + 8 vanos + 16 cornisas), `position` 8 · `rotationDegrees` 0 |
| `mixed_tenement` | 164 → 164 | 9/9 idénticos | `moduleId` 65 (39 vanos + 24 cornisas + 2 balcones), `position` 41 · `rotationDegrees` 2 |
| `town_hall` | 82 → 82 | 9/9 idénticos | `moduleId` 21 (los 21 son `window_bay` → `mod_ag_arcade_bay_2m`), `position` 21 · `rotationDegrees` 0 |
| `warehouse` | 52 → 52 | 8/9 | por rol: `wall_panel` 14→6, `window_bay` 10→4, `doorframe` 4→`dock_doorframe` 4, `cornice` 0→14; `flat` y `slab` 12→12 |

Las tres primeras filas son comparables índice a índice porque la crujía no se mueve: lo que cambia es
el módulo y, con él, el apoyo dentro de la banda (los 8 vanos frontales de `row_house` pasan de
y = −1,862 a y = −1,800 porque el paño GN es menos profundo que el trim de megakit; ±6,5 cm en
`mixed_tenement`, ±13 cm en `town_hall`). Las dos rotaciones de `mixed_tenement` son los dos balcones que
cambian de módulo, no un giro añadido. La nave **no** es comparable índice a índice: al pasar de 2 a 4 m
cada banda coloca la mitad de paños y de vanos, y los 52 totales coinciden por casualidad (14+10+4+12+12
contra 6+4+4+12+12+14). Lo que sí es único del brazo es el cambio de rol del marco de acceso,
`repeated_loading_docks@4` → `@2`, que es la sobrecritura `frameRole` declarada en el perfil; y 14
propósitos por lado se reetiquetan solos porque el índice del vano lleva la rejilla (`bay4` → `bay8`),
que es también por lo que las colisiones de la siguiente tabla se comparan por clase y no por conteo.

### Verificación que pide el cierre (control → candidata)

| familia · semilla | huella | orientación | plantas · envelope | pivote | licencias |
| --- | --- | --- | --- | --- | --- |
| `row_house` · 17 | 4×1 celdas · 16,0×4,0 m **=** | 0° **=** · 8 accesos visibles **=** | 2 **=** · 16,023×4,217×9,214 m **=** | (0,5713; 0,6996) **=** | CC0-1,0 → CC0-1,0 + original |
| `mixed_tenement` · 2 | 4×2 · 16,0×8,0 m **=** | 0° **=** · 3 accesos visibles **=** | 3 **=** · 16,2×8,4×10,0 m **=** | (0,5119; 0,7473) **=** | CC0-1,0 → CC0-1,0 + original |
| `warehouse` · 2 | 4×3 · 16,0×12,0 m **=** | 0° **=** · 4 accesos visibles **=** | 1 **=** · 16,0×12,0×3,0 → **16,2×12,2×4,0** (pretil de WP05) | (0,5691; 0,5209) → (0,5725; 0,5416) (consecuencia del pretil, publicado en WP05) | CC0-1,0 → CC0-1,0 + original |
| `town_hall` · 2 | 5×3 · 20,0×12,0 m **=** | 0° **=** · 4 accesos visibles **=** | 3 **=** · 18,428×9,991×9,998 m **=** | (0,5724; 0,6752) **=** | CC0-1,0 → CC0-1,0 + original |

Huella, orientación, plantas y pivote no se mueven en ninguna: un candidato cambia cómo se ve una
parcela, no cuánto mide. Las dos excepciones son de WP05 y están declaradas allí (el pretil GN da relieve
real a `parapet`/`metal_cornice`, y con él suben envelope y pivote). En licencias no hay ninguna clase
nueva: los cuatro renders salen `licensed=1.0` y toda fuente colocada está en las `sources` del perfil y
en `staging-sources.json` (lo comprueba el test).

### Colisiones evidentes: comparadas por clase de par, no por conteo

Contar pares solapados entre brazos que rejilla la nave de 2 a 4 m miente, porque el `purpose` de cada
colocación lleva el índice del vano (`bay4` → `bay8`). La sonda normaliza las etiquetas
(`bay*`, `level*`, `slab*`) y compara **clases** de par `(purposeA, purposeB)` con el volumen máximo de
cada clase:

| tipo | clases de par control → candidata | máximo control → candidata | clases nuevas |
| --- | --- | --- | --- |
| `row_house` | 17 → 17 | 0,8000 → 0,8000 m³ | 0 |
| `mixed_tenement` | 19 → 19 | 0,5963 → 2,4000 m³ | 0 |
| `warehouse` | 9 → 9 | 0,1564 → **0,1200** m³ | 2 (0,12 y 0,04 m³) |
| `town_hall` | 23 → 23 | 0,4525 → 0,7887 m³ | 0 |

Ninguna clase nueva en tres de las cuatro, y en la nave las dos que aparecen están por debajo del máximo
que ya toleraba su propio control. Los tres crecimientos que sí hay son **consumo hacia dentro**, no
defecto nuevo, y están medidos uno a uno:

- `mixed_tenement`: banda × puerta-balcón sube de 0,2444 a 2,4000 m³. El módulo GN del balcón ocupa los
  3 m de la banda en vez de colgarse de ella, así que comparte volumen con el paño. Lo que se juzga es el
  vuelo hacia la calle: **−0,149 m en el control → −0,150 m en la candidata**, es decir el balcón sigue
  protruyendo lo mismo y la identidad de la receta (`upper_balconies_quaternius`) sigue leyendo.
- `town_hall` y `row_house` y `mixed_tenement`: banda frontal × banda lateral en la esquina. El vano de
  arcada de 0,50 m de fondo consume 0,75 m³ en la esquina contra 0,1725 m³ del control. No asoma a la
  calle (las bandas crecen hacia el interior del volumen y el envelope no cambia), pero **es la esquina a
  pico que WP02 dejó abierta**: se cierra con geometría nueva montada sobre el extremo de la banda, no
  con un cambio de gramática, y está medido en la nota de `ag_civic_v2`.
- `warehouse`: el pretil de 4 m entra en las dos siluetas y sus esquinas se solapan 0,04 m³; el marco de
  camión roza la banda del vano contiguo 0,12 m³. Ambos por debajo del peor par del control.

### Rendición medida (cuatro corridas, una candidata por familia)

| tipo | perfil | semilla | humor | sprite | bytes | `pixelSha256` | triángulos | total | pico RSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `row_house` | `gn_residential_v2` | 17 | day_civic | 996×1203 | 1 143 414 | `93a32fc50a4d` | 12 080 (11 232 control) | 66,3 s | 3 371 MB |
| `mixed_tenement` | `gn_residential_v2` | 2 | day_civic | 1048×1046 | 1 369 213 | `5fe40e2993ba` | 14 264 (9 522) | 53,4 s | 4 182 MB |
| `warehouse` | `gn_industrial_v2` | 2 | night_civic | 1394×944 | 958 124 | `4a98ac62708a` | 7 896 (4 616) | 35,0 s | 3 644 MB |
| `town_hall` | `ag_civic_v2` | 2 | day_civic | 1395×1487 | 1 784 969 | `e4e1a61d1809` | 44 374 (18 418) | 60,8 s | 5 024 MB |

Evidencia: `candidates/wp06_<tipo>-candidata.{png,json}` (los JSON llevan `candidateProfile` y
`candidateOverlay`, así que cada PNG declara la autoría que realmente se le aplicó) y la hoja de revisión
`sheets/wp06_candidates_ab.png` (+ `_half`), que empareja cada candidata con su control de producción.

### Lo que WP06 no hace, y por qué

- **No promociona nada.** `runtime-promotions.json` no se toca: ningún `mod_gn_*` ni `mod_ag_*` entra en
  el set runtime, así que ningún sprite de producción se re-deriva. Promover un brazo a la gramática
  aprobada es decisión del responsable con su propio commit.
- **No afloja una guarda de identidad.** El escaparate GN sigue sin ruta porque la guarda que lo corta es
  identidad semántica de la familia, no un obstáculo del perfil.
- **No cierra la esquina cívica con un parche.** Forzando `brick_post` en las cuatro recetas componen
  0/60 semillas; limitándolo a `municipal_block` componen 60/60 pero se mueven 56 de las 105 colocaciones
  y el envelope pierde 2 m de fondo. Un candidato así ya no compara dos autorías del mismo edificio.
- **No toca el recorte.** `row_house` y `town_hall` tocan el borde derecho del lienzo (margen 1–2 px) **en
  control y candidata por igual** —medido: der 2 → 2, der 1 → 1—, así que es la deuda de
  `deterministic_crop_rect` ya declarada, no algo que este paquete haya introducido ni pueda arreglar con
  un perfil.

## FASE 6 — Envejecimiento vs daño sobre el MISMO edificio (medido)

Hoja: [`sheets/building_condition_states.png`](sheets/building_condition_states.png) (+
[`sheets/building_condition_states.json`](sheets/building_condition_states.json)). Sondeo de la sección:
[`weathering/damage_section_probe.json`](weathering/damage_section_probe.json).

Tres cosas, y ninguna toca `GameState`:

1. **La derivación existe como módulo** — `apps/web/src/isometric/building-condition.ts` lee los tres
   campos que ya viajan en la proyección de vista (`state`, `condition`, `structuralIntegrity`) y
   devuelve tier + sprite de catálogo + token de material. El umbral no lo inventa el módulo: se lee de
   `visualStates.*.derivation` del contrato, y el test lo comprueba contra el JSON
   (`building-condition.test.ts`, 7 casos). Con `condition < 60` e integridad > 0 el tier es `aged`, que
   es `complete` + material envejecido; con integridad 0 es `damaged`. Ese era el colapso de WP04.
2. **Ruta QA de selección** — `apps/web/src/fx-lab/fx-street.ts` ya no escribe `state` a mano: cada
   edificio de la calle de pruebas declara su escenario de dominio y `select()` deriva el sprite
   (`fx-street.test.ts`, 6 casos). `back-mixed_tenement` con 48/76 es el caso que antes se pintaba como
   ruina y ahora se pinta como envejecido.
3. **WP04-D1 cerrado** — `_compose_damage` comparaba `purpose in ('dormer','cornice')` contra ids
   compuestos. Con prefijos (`purpose.startswith(('roof','cornice'))`) la cornisa del semiplano dañado se
   secciona de verdad. Los dormerios no necesitan rama: se publican como `roof:{along}:{side}:row{n}:bay{i}`.

| magnitud | antes | después |
| --- | --- | --- |
| módulos seccionados (mixed_tenement 1001) | 14 | 22 (+8 cornisas) |
| cornisas vivas en el semiplano dañado | 8 en `damaged`, 8 en `burning` | 0 y 0 |
| colocaciones del sprite dañado | 115 → 105 | 115 → 97 |
| caja de daño en y (de ahí se anclan escombros y fuego) | −4,017 m | −4,428 m |
| firma `damaged` / `burning` | `c8cf952053b8` / `84817436f627` | `3be7cc2c1c7c` / `891e79956f5d` |
| firma `conserved` / `aged` | `175d2309dd83` | `175d2309dd83` (idéntica: el fix no toca geometría intacta) |

Lo que la hoja demuestra con números, no con gusto: `conserved` y `aged` comparten firma de composición,
115 colocaciones y el mismo despiece por grupo, y aun así se mueve el **23,01 %** del píxel opaco
(luma media 126,16 → 115,08). Envejecer es material. `damaged` pierde cubierta (16 → 8), pierde cornisa
(16 → 8), abre los paños altos del frente (21 → 15) y suma 4 montículos de escombro: 45,13 % del píxel
movido. `burning` es el dañado más 19 módulos de fuego/humo (3 focos con lengua dominante + 3 lenguas por
ventana + 3 columnas de humo).

Reproducción:

```bash
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=1001 \
  --states=complete,damaged,burning --weathering=conserved,aged --prefix=vw --mood=day_civic \
  --outDir=docs/art/graphics-capabilities/evidence/v2/weathering/day \
  --metrics=docs/art/graphics-capabilities/evidence/v2/weathering/metrics-day.json
python3 tools/art-pipeline/blender/ext_lab/damage_section_probe.py
python3 scripts/building-condition-sheet.py
```

Comprobado: `test_building_weathering_contract.py` OK (12 citas de origen),
`validate-building-composer.mjs` `status: valid`, vitest de `building-condition` + `fx-street` +
`building-sprites` 35/35. El contrato pasa de `22a02a14` a `3d4960953e96` (texto medido y `resolvedDefect`;
las recetas de material no se mueven).

**Deriva atribuida del re-render** (los cuatro PNG contra su versión en `HEAD`, medida en píxel decodificado):
`conserved` byte-idéntico (1 352 553 → 1 352 553, 0 píxeles movidos, Δ máx 0/255); `aged` Δ máx 1/255 con
0 píxeles sobre la cota de ruido —jitter de EEVEE, ni siquiera eso toca la firma; `damaged` pasa de
1070×1162 a 1087×1171 y `burning` a 1087×1265 porque el recorte sigue a la silueta y la silueta cambió.
Es decir: lo único que se mueve en el raster es lo que este fix debía mover.

**Requisito humano de esta hoja (§5.2).** El par conservado/envejecido está medido como distinto (23,01 %
del píxel opaco, luma −11,08), pero a 336 px de panel la diferencia se lee como «el mismo edificio un poco
más sucio». Que eso baste para que un jugador distinga *mantenido* de *desgastado* sin etiqueta lo decide
el responsable; si no basta, la palanca es la receta `aged` del contrato (fuerza por familia), no volver a
mezclar desgaste con daño.

**Lo que FASE 6 no hace.**
- No mueve ningún call site jugable: `building-sprites.ts:212` y `gameplay-visual-adapter.ts:2258` siguen
  con `condition < 60 → damaged`. Falta el sprite `aged` en el catálogo runtime (21 `complete` + 6/6/6),
  así que promocionar la derivación cambiaría el tier sin cambiar un píxel. Decisión de contrato D-080.
- No re-renderiza la evidencia de fuego de FASE 3: tras el fix, las dos `candidata_mixed_tenement_*` de
  `fire/` dejan de re-firmar (`76e58dc5fb4e` → nueva) y `candidata_warehouse_*` siguen OK (la gramática
  industrial no pone cornisa en el semiplano dañado). Los cuatro `control_*` ya re-firmaban mal **antes**
  del fix porque son el control congelado de FASE 2, no una regresión de esta fase. Queda anotado para
  FASE 9.
- No toca ningún sprite jugable: los `damaged`/`burning` del catálogo runtime se banean con
  `runtime_asset.py`, no con el compositor.

## FASE 7 — WP08: la calle poblada a escala real de Phaser

Cinco entregables, todos con su JSON hermano, y un índice que los cruza:

| hoja | qué compara | tamaño | pies recortados |
| --- | --- | --- | --- |
| [`sheets/wp06_candidates_ab.png`](sheets/wp06_candidates_ab.png) (+ `_half`) | los cuatro edificios del encargo, control vs candidata, con encuadre, semilla, huella y luz comparables | 4368×4370 / 4368×2770 | 0 |
| [`sheets/weathering_states.png`](sheets/weathering_states.png) (+ `_half`) | los tres estados materiales sobre el mismo `mixed_tenement` 1001 | 3524×4557 / 3524×3207 | 0 |
| [`sheets/wp08_arquitectura_avanzada.png`](sheets/wp08_arquitectura_avanzada.png) (+ `_half`) | Geometry Nodes, HiFi, Arch Generator y Archimesh en la retícula del perfil | 3091×1723 / 3091×1231 | 0 |
| [`sheets/wp08_fx_nocturnos.png`](sheets/wp08_fx_nocturnos.png) | los FX de noche con luma, dispersión y recortado a blanco medidos en el pie de cada cuadro | 3247×1189 | 0 · sus nueve fuentes no tienen JSON hermano: viven del manifiesto del lote (`fx_v2.json`, `fire_sheet.json`), que el índice sí las reconoce |
| [`urban/`](urban/) | calle poblada 1440×900 a 1× y 0,5× en los cuatro distritos piloto, con el bundle promocionado | 8 PNG + 8 JSON + manifiesto de corrida | — |

Índice: [`../../INDEX.md`](../../INDEX.md) (108 PNG con procedencia y raster medido) y
[`../../INDEX.json`](../../INDEX.json).

Cuatro cosas hubo que arreglar en el banco antes de que la evidencia dijera nada, y las cuatro se
midieron en lugar de adivinarse:

1. **El censo lo hace el renderizador, no la geometría.** `listScenery()`
   (`apps/web/src/isometric/IsometricSpikeScene.ts:2518` es la regla del propio render:
   `setVisible(isInViewport(..., 96))`) ahora reporta `pintados` = visible ∩ `worldView` y cuenta las
   texturas sobre lo pintado. Con `enCuadre` (geometría) el script anunciaba 4 fachadas por ancla
   cuando el fotograma tenía 2; con `visibles` (flag) anunciaba 13 vehículos cuando el PNG mostraba 9.
   La selección de ancla rankea por `pintados`, así que el encuadre que se publica es el que más calle
   tiene dibujada, no el que más celdas tiene cerca.
2. **`camera.worldView` serializado sólo trae `x, y, width, height`:** los getters `.right`/`.bottom`
   no sobreviven a `JSON.stringify`, y la primera corrida sacó 0 edificios en cuadro porque los
   comparaba con `undefined`. El censo se hace con `dentro(x, y)`.
3. **El reloj del juego no llegaba a poblarse.** El botón de velocidad cicla 1→2→4→8→16→1
   (`apps/web/src/ui/game-hud.tsx:29-31`), así que un clic dejaba la simulación en 2× y 288 s reales
   no daban los 12 días objetivo. Con `» 16×` medido: 358 → 19 478 ticks = **15,9 días**
   (`GAME_DAY_TICKS = 1200`, `packages/simulation/src/game-data.ts:629`), y la pausa deja el tick
   congelado en 51 498 en las ocho capturas (`pausa.congelado: true`, 4 342 ms de asiento).
4. **Los pies de las hojas se cortaban.** `panel()` envolvía el rótulo a la anchura del PNG pegado y
   `wrap_caption` lo truncaba a 9 líneas: en `wp08_arquitectura_avanzada_half.png` se cortaban 5 de 6
   (la columna mide 460 px y el módulo 188 px). Con `caption_width` explícito, dos pasadas
   (`dos_pasadas`) y presupuesto de líneas escalado por 1/escala, las cuatro hojas declaran
   `rotulosRecortados: []`. `ag_module_note()` imprime además la autoría propia cuando el módulo no
   trae SPDX, para que el pie no quede en «- v? (?)».

Las ocho capturas, con los contadores que el propio fotograma puede defender:

| caso | distrito | tick | zoom | fachadas en cuadro | familia piloto en cuadro | vehículos pintados | peatones pintados | falta WP08 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `urban_civic_10x` | Centro Cívico | 51498 | 1 | 2 | `town_hall` | 9 | 1 | — |
| `urban_civic_05x` | Centro Cívico | 51498 | 0,5 | 2 | `town_hall` | 23 | 6 | — |
| `urban_residential_10x` | Barrio del Umbral | 51498 | 1 | 1 | ninguna | 9 | 3 | fachadas, piloto |
| `urban_residential_05x` | Barrio del Umbral | 51498 | 0,5 | 2 | ninguna | 34 | 4 | piloto |
| `urban_commercial_10x` | Mercado del Norte | 51498 | 1 | 1 | ninguna | 18 | 0 | fachadas, piloto, peatones |
| `urban_commercial_05x` | Mercado del Norte | 51498 | 0,5 | 1 | ninguna | 49 | 4 | fachadas, piloto |
| `urban_industrial_10x` | Ensanche Ferroviario Oeste | 51498 | 1 | 1 | ninguna | 12 | 0 | fachadas, piloto, peatones |
| `urban_industrial_05x` | Ensanche Ferroviario Oeste | 51498 | 0,5 | 1 | ninguna | 47 | 0 | fachadas, piloto, peatones |

Bundle fotografiado: `apps/web/dist/assets/index-BFeHLDBG.js`, `sha256 946ca403…`, 2 663 036 bytes;
renderer `SwiftShader` (esta máquina no tiene GPU). `sinSprite: []` en las ocho: ningún edificio del
cuadro se quedó sin textura.

«Familia piloto en cuadro» es el contador que el script rotula `piloto WP06` (`:740`): se cumple si en el
encuadre hay un edificio cuyo `type` está en `PILOTS` (`:98`), las cuatro familias piloto de D-111.2. Lo
que se pinta es su promoción `qa_approved` —la textura del cuadro cívico es
`blender-variant-day-town_hall:complete:-:0`—, no la `town_hall-candidata` de WP06, que no viaja en el
bundle. La columna nunca afirma que una candidata esté en el mundo.

La segunda corrección de clasificador es la bandera de **recorte alfa**, que WP08 pide corregir
explícitamente. Estaba escrita como «algún píxel no-fondo en el perímetro» y su techo
(`tocando ≤ 2 · (ancho + alto)`) no podía excluir nada, porque el conteo nunca supera el perímetro que
recorre: avisaba en 88 de 108 filas sin distinguir el mundo entero de un edificio seccionado. Ahora mide
la cara más llena del lienzo y avisa en 49, que se reparten **por construcción y no por error**: 98,6 %
las 24 capturas del viewport de juego (`phaser/fx_v2` 11 + `phaser/fire_sheet` 13), 75,4 % las 16 teselas
de receta de FASE 6, 88,5 % la medida del hueco de muelle, y entre 51,9 % y 54,8 % los siete vanos de
módulo de WP01–WP03 —la crujía continúa fuera de encuadre a propósito, que es justamente lo que esas
hojas demuestran— más la hoja `v2/ag/quality_ab.png`. Los cuatro edificios de la hoja de candidatas, que
son donde un corte sí sería un defecto, quedan por debajo del aviso: 0,0 % `row_house`, 1,5 %
`town_hall`, 16,8 % `warehouse` y 30,3 % `mixed_tenement`, y este último es el mismo número en control que
en candidata, así que el brazo B no perdió margen de recorte. La bandera sigue sin cortar en ningún
brazo: si un vano está mal encuadrado lo decide la hoja impresa, no un umbral puesto para que salga
verde.

El índice juzga **por brazo** porque la media de luma no es una medida comparable entre artefactos
distintos. La primera pasada marcó 43 filas con defecto duro; 33 eran del clasificador, no del raster:
las hojas compuestas viven sobre el lienzo #0b1422 (luma media 30–47 con σ 25–70), los canales de
receta de FASE 6 son negros porque el contrato deja el vidrio fuera (`glass_mask.png`, luma 0,08) y las
noches legítimas de FASE 4-5 miden luma 33–41 con 0,04 % de píxel casi negro. Quedan **8 filas duras**,
todas reales y todas en `urban/`: `LAVADA` 4,4–4,6 %. Medido por octavos, el recorte está entero en la
banda del HUD —excluida la fila 0–14 % y la tarjeta inferior izquierda, el lienzo de juego queda en
0,02–0,14 % con luma de escena 83–97—, así que la bandera describe el PNG publicado (que lleva la
interfaz dentro) y no se baja el umbral para que salga verde.

Reproducción:

```bash
pnpm --filter @landlord/web build
node scripts/wp08-urban-street-capture.mjs          # 8 PNG + 8 JSON + urban_street_manifest.json
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py   # las cuatro hojas + firmas
python3 scripts/wp08-index.py                       # INDEX.md / INDEX.json
python3 scripts/wp08-index.py --check               # sale 1 si falta procedencia o hay defecto duro
```

Comprobado: `pnpm --filter @landlord/web typecheck` limpio con `listScenery()` ampliado; `eslint` sin
errores sobre los dos ficheros que toca esta fase (`IsometricSpikeScene.ts` y
`scripts/wp08-urban-street-capture.mjs`); `prettier --check` en verde sobre el catálogo, el índice, las
firmas de las hojas y los JSON hermanos; `node --check scripts/wp08-urban-street-capture.mjs` OK;
`pnpm art:capabilities:check` → 23 entradas × 17 campos; las cuatro hojas se regeneran con
`rotulosRecortados: []` y `sinEvidencia: []`; `python3 scripts/wp08-index.py` es determinista —volvió a
producir `INDEX.md` e `INDEX.json` con el mismo `sha256`— y `--check` sale 1 con las cuentas declaradas
arriba (8 duras, 13 sin procedencia).

`pnpm lint`, en cambio, está rojo y **no lo deja limpio esta fase**: 7 179 de sus 7 209 errores viven en
`apps/web/dist-fxlab/`, la vista previa que monta el laboratorio de efectos. Git la ignora (`dist-*/`)
pero `eslint.config.js` no, porque su `ignores` casa `**/dist/**` y no `**/dist-*/**`. Los 30 restantes
están en diez ficheros que WP08 no tocó: 19 en los cinco `scripts/fx-*` del laboratorio abierto en D-111
§7 y ampliado en FASE 4-5, y 11 en `material-maquette-ab-capture.mjs`, `build-building-style.mjs`,
`style-mood.test.mjs`, `terrain-paint.ts` y `headquarters.test.ts`. El arreglo es una línea de
configuración y los otros 30 tocan a fases anteriores → WP09, que es la fase de validadores.

**Lo que FASE 7 no hace.**
- No mete las candidatas WP06 en el mundo: el bundle promocionado usa el set `qa_approved` y las
  candidatas viven en `docs/art/building-composer/candidates/`, que el bundle no sirve. La A/B de
  candidatas existe a escala de Blender; llevarla al runtime es promoción de assets (decisión del
  responsable, no de esta hoja).
- No fotografía noche en el mundo: el bundle promocionado es `day_civic`. La noche existe en el
  laboratorio (`phaser/fx_v2/preset_night_*.png`) y en Blender, no en una calle jugable.
- No reescribe la procedencia de las 13 PNG anteriores a WP08 que siguen sin JSON hermano (5 hojas de
  WP02-WP05, 3 de fuego de FASE 2-3, `v2/ag/quality_ab.png`, las 3 sondas del halo y `_control.png`):
  regenerarlas reescribiría evidencia ya revisada. Están listadas con su motivo en el índice.
- No toca la simulación para fabricar condiciones visuales: el reloj se adelantó con el botón de
  velocidad del HUD, y la única señal de dominio nueva en el render es el contador `pintados`, que es
  observación del fotograma, no regla de juego.

## Ledger

| WP | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| WP00 | `5543cc9` | DONE | este índice | — |
| WP01 | `0aa8ed2` | DONE | `sheets/gn_v2_ab.png` (+ `_half`) | sombra recortada preexistente, declarada |
| WP02 | `9a48fee` | DONE | `sheets/ag_civic_ab.png` (+ `_half`) · `mod_ag_arcade_bay_2m` | cierre de crujía en esquina y profundidad 0,50 m → WP06 |
| WP03 | `464608f` | DONE | `sheets/ext_window_columns.png` (+ `_half`) · `sheets/hifi_grid_ab.png` (+ `_half`) | ningún vano de extensión adoptado (motivo geométrico medido); HiFi se queda como herramienta de receta |
| WP04 | `4ef6afa` | DONE | `sheets/weathering_states.png` (+ `_half`) · `building-weathering-contract.json@22a02a14` | WP04-D1 (cornisa sobrevive a la sección) → cerrado en FASE 6 · runtime `condition < 60 → damaged`: sigue siendo decisión del responsable, no un ajuste de esta hoja |
| WP05 | `348eb78` | DONE · ACEPTADA | `sheets/industrial_warehouse_ab.png` (+ `_half`) · 4 módulos `mod_gn_*_4m` (catálogo 191) · `industrial/dock_aperture_scale.json` | `metal_brick_mix` es no-op en HEAD (enmienda de gramática → responsable), tier `aged` sobre chapa GN sin medir y hoja/pretil en la misma banda tratada → WP06 |
| WP06 | `c5bd69d` + `c6824dc` | DONE · CUATRO CANDIDATAS REVISABLES | `candidates/wp06_{row_house,mixed_tenement,warehouse,town_hall}-candidata.png` (+ JSON) · `sheets/wp06_candidates_ab.png` (+ `_half`) · `building-composer-candidates.json` (3 perfiles) · `pnpm art:building-composer:candidates:test` · `gn_facade_grammar.py` con el origen en el plano posterior | nada bloquea el cierre: la esquina cívica pide geometría nueva (no gramática), `mod_gn_shopfront_bay_2m` sigue sin ruta legal y `metal_brick_mix` sigue no-op en HEAD (dos enmiendas del responsable), el tier `aged` sobre chapa GN sigue sin medir y `deterministic_crop_rect` deja 1–2 px de margen → WP07/WP09 |

### Fases del cierre (D-111.2, orden de finalización)

| fase | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| FASE 1 | `8b42a64` | DONE | `capabilities.json` (22 entradas) · `graphics-capabilities/README.md` · `evaluations/extensions.md` · ledger con hashes reales | — |
| FASE 2 | `9e95206` | DONE · DIAGNÓSTICO | `fire/DIAGNOSIS.md` · `fire/control_{mixed_tenement,warehouse}_{day,night}.png` (+ JSON) · `fire/fire_control_sheet.png` · `fire/fire_control_detail.png` | nada: es fase de lectura, no de producción; los diez defectos quedan medidos y atribuidos a línea |
| FASE 3 | `b58f263` | DONE | `fire/REWORK.md` · `fire/candidata_{mixed_tenement,warehouse}_{day,night}.png` (+ JSON) · `fire/fire_blender_ab.png` (+ `_half`) · `fire/fire_blender_ab_readings.json` · `mod_original_fire_flame`/`_smoke` re-autorados | la luz de fuego queda offline (la asume FASE 4) |
| FASE 4 | `74a4ec2` | DONE | `phaser/fire_sheet/*` (7 fotogramas + 6 lecturas) · `phaser/fire_animation_sheet.png` · `phaser/fire_animation_measure.json` · `phaser/fire_anchor_measure.json` · `fireAnchors` consumidos desde la silueta rotada | p95 en SwiftShader: no autoriza promoción ni descarta (medir con GPU) |
| FASE 5 | `f606813` | DONE | `phaser/fx_v2/phaser_fx_v2_sheet.png` (+ `.json`) · `phaser/fx_v2/preset_{day,night}_*.png` · `phaser/fx_v2/p95_attribution.json` · `phaser/fx_v2/fallback_canvas_night_*.png` · presets como tabla reutilizable | el PointLight del rig queda retirado (es el objeto que se rasteriza en el aire); p95 atribuido con brazo de control, no a SwiftShader |
| FASE 6 | `62304dc` | DONE · PENDIENTE DE REVISIÓN HUMANA | `sheets/building_condition_states.png` (+ JSON) · `weathering/damage_section_probe.json` · `building-condition.ts` + test · `fx-street.ts` con `select()` + test · contrato `3d4960953e96` con WP04-D1 cerrado | promocionar la derivación al call site jugable exige sprite `aged` en el catálogo (D-080) y decisión del responsable; las `candidata_mixed_tenement_*` de `fire/` piden re-render → FASE 9 |
| FASE 7 (WP08) | (este commit) | READY FOR HUMAN VISUAL REVIEW | `urban/` (8 capturas 1440×900 a 1× y 0,5× + manifiesto) · `sheets/wp06_candidates_ab.png` · `sheets/weathering_states.png` · `sheets/wp08_arquitectura_avanzada.png` · `sheets/wp08_fx_nocturnos.png` (+ `_half` y JSON) · `INDEX.md`/`INDEX.json` · `listScenery()` con `pintados` | `--check` sale 1 con 8 `LAVADA` (recorte 4,4–4,6 % atribuido al HUD del PNG, no a la calle) y 13 PNG sin procedencia anteriores a WP08; sólo el distrito cívico cumple los siete contadores — densidad del generador de mundo, no de la captura |
