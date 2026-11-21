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
  - **WP04-D1:** la regla de daño retira `purpose in ('dormer','cornice')`, pero los propósitos reales
    van prefijados (`cornice:front:3`), así que la cornisa sobrevive a la sección de cubierta.
    Arreglarlo cambia los sprites `damaged`/`burning` publicados.
  - **Runtime:** `buildingAssetStateFor` convierte hoy `condition < 60` en el sprite `damaged`
    (geometría seccionada), o sea que un edificio simplemente desatendido se dibuja derruido. La salida
    natural es publicar el tier envejecido bajo `complete` y dejar `damaged` para integridad
    estructural, pero eso cambia el contrato de assets (D-080) y requiere revisión humana.
- **Lo reutilizable (capacidad, no ajuste puntual).** `weathering.py` aplica el contrato por *familia
  semántica* leída del perfil de estilo (`NON_ELEVATION_FAMILIES` fija el vocabulario; un perfil que
  publique una familia sin receta ni exclusión aborta el `Plan`), audita el BSDF antes de tocarlo
  (`principledNodes`/`wiredToOutput`/`chosen`, porque elegir el BSDF equivocado pinta sobre un nodo
  muerto), permite recetas de sólo película (el cristal de noche) y nunca muta el contrato: el
  multiplicador de mood se aplica sobre una copia. `LANDLORD_ART_WEATHERING_CONTRACT` permite calibrar
  recetas sin tocar el manifiesto publicado — las cuatro sondas de esta sección se generaron así — y el
  orquestador lee la misma variable para no validar contra un archivo y renderizar contra otro.

## Ledger

| WP | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| WP00 | (este) | DONE | este índice | — |
| WP01 | (este) | DONE | `sheets/gn_v2_ab.png` (+ `_half`) | sombra recortada preexistente, declarada |
| WP02 | (este) | DONE | `sheets/ag_civic_ab.png` (+ `_half`) · `mod_ag_arcade_bay_2m` | cierre de crujía en esquina y profundidad 0,50 m → WP06 |
| WP03 | (este) | DONE | `sheets/ext_window_columns.png` (+ `_half`) · `sheets/hifi_grid_ab.png` (+ `_half`) | ningún vano de extensión adoptado (motivo geométrico medido); HiFi se queda como herramienta de receta |
| WP04 | (este) | DONE | `sheets/weathering_states.png` (+ `_half`) · `building-weathering-contract.json@22a02a14` | WP04-D1 (cornisa sobrevive a la sección) y runtime `condition < 60 → damaged`: dos decisiones del responsable, no ajustes de esta hoja |
