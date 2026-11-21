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
verifica tras cada corrida) y `blender_artist/manifests/building-modules.json` (186 módulos).

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
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py <tipo>
node scripts/build-building-composer.mjs --types=<tipo> --seeds=2 \
  --prefix=d111cnd_<tipo> --outDir=/tmp/ab2/<tipo>/cnd \
  --metrics=/tmp/ab2/<tipo>-cnd-metrics.json --mood=day_civic
python3 tools/art-pipeline/blender/ext_lab/ab_grammar_patch.py revert

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

## Ledger

| WP | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| WP00 | (este) | DONE | este índice | — |
| WP01 | (este) | DONE | `sheets/gn_v2_ab.png` (+ `_half`) | sombra recortada preexistente, declarada |
