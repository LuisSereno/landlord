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

## Ledger

| WP | commit | estado | artefacto principal | bloqueo |
| --- | --- | --- | --- | --- |
| WP00 | (este) | DONE | este índice | — |
