# §6 — Integración transversal en las cuatro familias piloto

## Principio aplicado

Una capacidad nueva sólo vale si el **Composer** puede invocarla en cualquier tipo compatible. No se
escribió un generador por edificio: la variante candidata se produce cambiando **qué módulo resuelve
cada rol de fachada** dentro de la gramática, que es el punto por donde el Composer ya decide todo lo
demás (parcela, pisos, silueta, cubierta, accesos).

## Método: A/B de una sola variable

El paño entre huecos, la planta, la huella, la cámara, la luz, el perfil de material y la resolución
son idénticos en los dos brazos. La única diferencia son los módulos que resuelven los roles.

Para que éso sea cierto no basta con añadir una paleta GN: `draw_choices` elige primero receta y luego
filtra cada eje por las `*Ids` de esa receta, así que **añadir** opciones desplazaría el flujo del PRNG
y el candidato saldría con otra silueta, otra cubierta u otra orientación. El parche
(`tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py`) **sustituye `roleModule` en su sitio** en el
manifiesto del repo y guarda antes la copia de HEAD en `/tmp/ab/grammar-head.json` para poder revertir;
al terminar el archivo vuelve a ser byte a byte el aprobado (`sha256 fde05d71…`, verificado tras la
última corrida) y ninguna variante se promociona sin revisión humana.

Que el método funciona se comprueba en los propios manifiestos: `axisChoices` sale **idéntico** en
control y candidata, y sólo cambia la firma de composición.

## A. Residencial — `row_house` · candidata producida

| | control | candidata |
| --- | --- | --- |
| paleta | `stucco_trim` | `stucco_trim` (roles reasignados) |
| módulos | `mod_megakit_trim_window_2m`, `mod_megakit_cornice_brick_center_2m`, muro, dintel, losa, 2 cubiertas, puerta | `mod_gn_window_bay_2m`, `mod_gn_cornice_2m` + los mismos cuatro megakit |
| procedencia | `src_quaternius_downtown_city_megakit` | + `src_original_gn_window_bay`, `src_original_gn_cornice` |
| triángulos | 14 624 | 12 152 |
| sprite | 996 × 1203 | 996 × 1203 |
| huella / pisos | 16 × 4 m / 2 | 16 × 4 m / 2 |
| firma de composición | `aced30f56eb0` | `3300aa68c7e3` |

La paleta `stucco_trim` declara también `ground_panel` y `wainscot`, pero este massing (`terrace`, 2
pisos) no instancia esos roles: el resultado **no** lleva escaparate comercial, que sería un defecto
arquitectónico en una vivienda adosada. Es decir: la restricción de familia no hizo falta para evitarlo
porque el Composer ya no pide ese rol. Si una corrida futura lo pidiera, la candidata se rechazaría
antes que aceptar un escaparate en una terraza.

## B. Mixto comercial — `mixed_tenement` · candidata producida

Es el A/B obligatorio de §3, documentado en [`geometry-nodes.md`](geometry-nodes.md). Resumen:
`facade: brick_commercial → gn_masonry_bays`, mismo `recipe: quaternius_balcony`, misma masa
(`uniform_block`), misma silueta (`corniced_transition/flush`), misma cubierta (`flat_tenement`);
9 522 → 13 272 triángulos. Las tres limitaciones para promocionar (tono del material plano, cornisa
casi blanca y la banda de 0,55 m que cambia el recorte alfa) siguen abiertas y son de ajuste, no de
arquitectura.

## C. Industrial — `warehouse` · bloqueada, con dos motivos medidos

**Motivo 1 — invariante de identidad de familia.** El Composer rechaza el módulo GN antes de renderizar:

```
GrammarError: mod_gn_window_bay_2m no es compatible con la familia industrial_heavy (§7 familia incompatible)
```

`mod_gn_window_bay_2m` declara `allowedFamilies: ["residential_low"]`. Relajar esa lista para obtener
una imagen habría sido exactamente lo que D-111 prohíbe: la gramática de fábrica de ladrillo **es**
residencial por construcción (muro de ladrillo, trim de piedra, montantes de 8,5 cm). No se modificó.

**Motivo 2 — las cuatro piezas de garaje no resuelven un muelle.** §6.C pedía evaluarlas de verdad;
se midieron y se renderizaron contra referencias de escala
(`evidence/warehouse/garage_probe.png`, mando en el README de capacidades):

| pieza | medidas reales | triángulos | frente a caja de camión 2,50 × 2,60 m |
| --- | --- | --- | --- |
| `wall-a-garage` | 1,00 × 1,00 × 1,00 m | 28 | no cubre ni el ancho |
| `wall-a-flat-garage` | 1,00 × 0,10 × 1,00 m | 14 | no cubre ni el ancho; una sola cara, normales hacia +Y |
| `wall-b-garage` | 1,00 × 1,00 × 1,00 m | 28 | no cubre ni el ancho |
| `wall-b-flat-garage` | 1,00 × 0,10 × 1,00 m | 14 | no cubre ni el ancho |

El Retro Urban Kit está construido sobre **cuadrícula de 1 m** (`unitScaleIsOneMeter: true` en las
cuatro). La puerta que dibuja es de cochera doméstica —banda de portón seccionado con dos
ventanillos—, no industrial. Duplicando el módulo, una crujía de 4 m daría 2 m de ancho y **1 m de
alto**: un camión no entra, y el resultado sería justo lo que el encargo prohíbe («no aceptar huecos
abiertos como muelles terminados», «no colocar puertas residenciales en muelles industriales»). El
control actual (`steel_cladding`, 4 616 triángulos, huella 16 × 12 m) se conserva tal cual.

## D. Cívico — `town_hall` · bloqueada por el mismo invariante

El parche sustituyó los roles de `brick_civic`, `stucco_civic` y `warm_limestone` más tres cornisas de
silueta, y el Composer cortó la composición antes del render con el mismo `GrammarError`
(`… no es compatible con la familia civic_landmark`). La alternativa que proponía §6.D para esta
familia — Arch Generator, HiFi, Archimesh — ya está medida en §4: 35 452, 2 356 y 244 373 triángulos
respectivamente para un sprite que debe caber en los presupuestos D-100/D-102 y en el lote de 23 MiB
de D-101. Ninguna supera el control cívico actual (18 418 triángulos, 13 módulos, huella 20 × 12 m,
3 pisos).

## Resultado y restricción registrada

Dos de cuatro familias tienen variante candidata (A y B). Para C y D se registra la restricción, que
es lo que el propio §6 pide cuando «una biblioteca sólo aporta valor a determinadas familias»:

> La gramática de fachada GN de D-111 es una gramática de **fachada continua de fábrica** —crujía de
> 2 m, muro de ladrillo, trim de piedra, hueco de vivienda o escaparate—. No es una gramática
> universal de edificio.

Qué la extendería, en orden de coste: (1) autorizar **módulos GN propios de cada familia** —crujía de
sash industrial de 4 m con hueco de 2,5 × 2,6 m; vano de piedra cívica con proporción monumental—, que
es un WP nuevo con su medición y su registro aditivo en el manifiesto; (2) decidir si la cornisa GN
puede publicarse para `civic_landmark` con un material de piedra, que es la pieza más barata de las
tres porque la geometría ya existe.

Ninguna de las dos se hizo en D-111: ambas cambian el catálogo aprobado y piden revisión humana.

## Reproducir

```sh
# control
node scripts/build-building-composer.mjs --types=row_house --seeds=2 \
  --prefix=d111ctl_row_house --outDir=/tmp/ab/row_house/ctl \
  --metrics=/tmp/ab/row_house-ctl-metrics.json --mood=day_civic
# candidata (el parche se revierte solo)
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py row_house
node scripts/build-building-composer.mjs --types=row_house --seeds=2 \
  --prefix=d111cnd_row_house --outDir=/tmp/ab/row_house/cnd \
  --metrics=/tmp/ab/row_house-cnd-metrics.json --mood=day_civic
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py revert
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py   # hoja sheets/pilots_sheet.png
```
