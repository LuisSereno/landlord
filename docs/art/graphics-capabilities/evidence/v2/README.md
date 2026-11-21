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
de WP02).

Versiones medidas: Phaser **4.2.1**, Blender **5.2.2 LTS**
(`blender_artist/toolchain/blender-5.2.2-linux-x64/blender`), `composerVersion: vf-3`.

## Los cuatro edificios objetivo

Huella y plantas **leídas del catálogo**, no inventadas (`building-catalog.json`; el compositor las
recibe del dominio y no las toca — `authority.footprintAndFloors`). 1 celda = 4 m.

| tipo | familia del Composer | huella (celdas) | huella (m) | plantas | receta/estado actual |
| --- | --- | --- | --- | --- | --- |
| `row_house` | `residential_low` | 4×1 | 16×4 | 2 | candidata GN existente (§A) |
| `mixed_tenement` | `residential_low` | 4×2 | 16×8 | 3 | candidata GN existente (§B) |
| `warehouse` | `industrial_heavy` | 4×3 | 16×12 | 1 | **sin candidata**: el GN residencial está vetado por `allowedFamilies` |
| `town_hall` | `civic_landmark` | 5×3 (+1 celda frontal de escalinata) | 20×12 | 4 | **sin candidata**: mismo veto |

`warehouse` y `town_hall` no se desbloquean relajando `allowedFamilies`: se desbloquean escribiendo
módulos GN **propios de su familia** (WP05 industrial, WP02/WP06 cívico).

## Rutas de reproducción

```bash
export PATH=/home/luis/.local/bin:/usr/local/bin:/usr/bin:/bin
BLENDER=blender_artist/toolchain/blender-5.2.2-linux-x64/blender

# Módulo GN (WP01/WP05): regenera GLB + .blend vivo + informe de medidas
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- \
  --out-dir=/tmp/gn --seed=7 --report-dir=/tmp/gn

# A/B del Composer (sin tocar el manifiesto aprobado: el parche se revierte)
#   --source=gn  sustituye los roles por módulos Geometry Nodes (WP01)
#   --source=ag  sustituye el rol window_bay por el vano cívico horneado (WP02)
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py --source=<gn|ag> <tipo>
node scripts/build-building-composer.mjs --types=<tipo> --seeds=2 \
  --prefix=d111cnd_<tipo> --outDir=/tmp/ab2/<tipo>/cnd \
  --metrics=/tmp/ab2/<tipo>-cnd-metrics.json --mood=day_civic
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py revert

# Módulo cívico horneado desde Arch Generator (WP02): GLB + informe de medidas + render de evidencia
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/ag_module_bake.py -- \
  --out-glb=/tmp/wp02/ag_arcade_bay_2m.glb --report=/tmp/wp02/report.json \
  --evidence-png=/tmp/wp02/module.png --evidence-json=/tmp/wp02/module.json --quality=high

# Hojas comparativas
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py [filtro]

# Extensiones GPL (WP02/WP03): instaladas sólo en /tmp/d111-ext-lab, ver `lab_common.EXTENSIONS`
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
```

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
- **A/B sin tocar la gramática aprobada.** `ab_grammar_patch.py` gana `--source=ag` y sustituye sólo
  el rol `window_bay` de la paleta ya sorteada; `revert` devuelve el manifiesto al `sha256` de HEAD
  (verificado tras la corrida). Con seed 2, control y candidata comparten los nueve ejes
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
- **Brazo de calidad registrado.** `simplified` (938 tri, −48 %) se hornea y se compara
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

## Ledger

| WP | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| WP00 | (este) | DONE | este índice | — |
| WP01 | (este) | DONE | `sheets/gn_v2_ab.png` (+ `_half`) | sombra recortada preexistente, declarada |
| WP02 | (este) | DONE | `sheets/ag_civic_ab.png` (+ `_half`) · `mod_ag_arcade_bay_2m` | cierre de crujía en esquina y profundidad 0,50 m → WP06 |
