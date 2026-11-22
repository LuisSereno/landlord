# Índice de evidencia visual D-111.2 (WP08)

Generado por `scripts/wp08-index.py` — no se edita a mano. Cada fila es un PNG del árbol,
su JSON de procedencia y la medida del raster. Las columnas de defecto existen porque WP08
exige corregir «rótulos cortados, recortes alfa, capturas negras, escenas lavadas» y eso no se
puede cerrar con una impresión visual.

- PNG indexadas (sin contar las `_half` de repaso): **108**
- sin JSON de procedencia: **13**
- con defecto duro para su brazo: **8**
- con algún defecto de raster marcado: **72**
- huecos declarados (abajo): **5** · hallazgos abiertos: **3**

Leyenda de banderas: `NEGRA` luma media < 45 · `PLANA` desviación < 18 ·
`CASI-TODO-NEGRO` > 60 % del píxel bajo 12 de luma · `LAVADA` > 3 % recortado a blanco ·
`TOCA-BORDE` una cara del lienzo con ≥ 50 % de su longitud ocupada por contenido no-fondo
(columna **%borde**; medido: los cuatro edificios de la hoja de candidatas están entre 0,0 y
30,3 %, los vanos de módulo entre 51,9 y 54,8 % porque la crujía continúa fuera de encuadre a
propósito, las teselas de receta al 75,4 % y las capturas del viewport de juego al 98,6 %) ·
`TODO-TRANSPARENTE` el archivo decodifica pero no tiene un solo píxel opaco ·
`ROTO` no decodifica. Todas se miden en todas las filas; la columna **brazo** dice cuáles
cortan: una hoja compuesta sobre lienzo plano no se juzga por su media de luma, y un canal de
receta no se juzga por estar oscuro. `PLANA` y `TOCA-BORDE` son avisos en todos los brazos.

| brazo | filas | duras que cortan |
| --- | --- | --- |
| escena diurna | 46 | `CASI-TODO-NEGRO` · `LAVADA` · `NEGRA` · `ROTO` · `TODO-TRANSPARENTE` |
| escena nocturna | 29 | `CASI-TODO-NEGRO` · `LAVADA` · `ROTO` · `TODO-TRANSPARENTE` |
| mapa de trabajo | 17 | `ROTO` · `TODO-TRANSPARENTE` |
| hoja de trabajo | 16 | `CASI-TODO-NEGRO` · `ROTO` · `TODO-TRANSPARENTE` |

## `phaser/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [fire_animation_sheet.png](phaser/fire_animation_sheet.png) | hoja de trabajo | [`phaser/fire_animation_measure.json`](phaser/fire_animation_measure.json) (lote) | 752×288 · 97 KiB | 78.64 | 70.14 | 0.0 | 1.85 | 7.6 | — |

## `phaser/fire_sheet/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [frame_01.png](phaser/fire_sheet/frame_01.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 188 KiB | 40.73 | 31.8 | 0.04 | 0.04 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_02.png](phaser/fire_sheet/frame_02.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 189 KiB | 40.74 | 31.83 | 0.04 | 0.06 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_03.png](phaser/fire_sheet/frame_03.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 190 KiB | 40.78 | 31.94 | 0.04 | 0.09 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_04.png](phaser/fire_sheet/frame_04.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 190 KiB | 40.81 | 31.98 | 0.04 | 0.09 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_05.png](phaser/fire_sheet/frame_05.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 190 KiB | 40.83 | 32.02 | 0.04 | 0.09 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_06.png](phaser/fire_sheet/frame_06.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 190 KiB | 40.82 | 31.98 | 0.04 | 0.11 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [frame_07.png](phaser/fire_sheet/frame_07.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 190 KiB | 40.82 | 31.98 | 0.04 | 0.1 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [street_day_fire.png](phaser/fire_sheet/street_day_fire.png) | escena diurna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 183 KiB | 55.01 | 25.62 | 0.04 | 0.0 | 98.6 | `TOCA-BORDE` |
| [street_night_control.png](phaser/fire_sheet/street_night_control.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 187 KiB | 40.63 | 31.45 | 0.04 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [street_night_fire.png](phaser/fire_sheet/street_night_fire.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 189 KiB | 40.74 | 31.85 | 0.04 | 0.06 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [street_night_fire_050x.png](phaser/fire_sheet/street_night_fire_050x.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 65 KiB | 31.31 | 17.24 | 0.01 | 0.02 | 98.6 | `NEGRA` `PLANA` `TOCA-BORDE` |
| [street_night_fire_lighting.png](phaser/fire_sheet/street_night_fire_lighting.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 151 KiB | 36.82 | 32.27 | 1.41 | 0.69 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [street_night_fire_particles.png](phaser/fire_sheet/street_night_fire_particles.png) | escena nocturna | [`phaser/fire_sheet/fire_sheet.json`](phaser/fire_sheet/fire_sheet.json) (lote) | 1298×543 · 191 KiB | 40.85 | 31.82 | 0.04 | 0.08 | 98.6 | `NEGRA` `TOCA-BORDE` |

## `phaser/fx_v2/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [halo_con_pointlight.png](phaser/fx_v2/atribucion/halo_con_pointlight.png) | escena nocturna | **SIN** | 1298×543 · 173 KiB | 36.73 | 23.6 | 0.09 | 0.14 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [halo_retirado_fire_lighting.png](phaser/fx_v2/atribucion/halo_retirado_fire_lighting.png) | escena nocturna | **SIN** | 1298×543 · 175 KiB | 37.4 | 26.47 | 0.09 | 0.01 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [halo_sin_lighting.png](phaser/fx_v2/atribucion/halo_sin_lighting.png) | escena nocturna | **SIN** | 1298×543 · 187 KiB | 39.04 | 23.8 | 0.04 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [control_day.png](phaser/fx_v2/control_day.png) | escena diurna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 183 KiB | 54.95 | 25.49 | 0.03 | 0.0 | 98.6 | `TOCA-BORDE` |
| [control_night.png](phaser/fx_v2/control_night.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 186 KiB | 38.62 | 21.5 | 0.03 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [fallback_canvas_night_control.png](phaser/fx_v2/fallback_canvas_night_control.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 192 KiB | 38.49 | 21.27 | 0.03 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [fallback_canvas_night_fire.png](phaser/fx_v2/fallback_canvas_night_fire.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 201 KiB | 38.87 | 22.14 | 0.03 | 0.01 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [phaser_fx_v2_sheet.png](phaser/fx_v2/phaser_fx_v2_sheet.png) | hoja de trabajo | [`phaser/fx_v2/phaser_fx_v2_measure.json`](phaser/fx_v2/phaser_fx_v2_measure.json) (lote) | 3942×1276 · 824 KiB | 37.5 | 24.97 | 0.05 | 0.0 | 0.0 | `NEGRA` |
| [preset_day_balanced.png](phaser/fx_v2/preset_day_balanced.png) | escena diurna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 211 KiB | 50.49 | 24.4 | 0.06 | 0.0 | 98.6 | `TOCA-BORDE` |
| [preset_night_balanced.png](phaser/fx_v2/preset_night_balanced.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 210 KiB | 33.67 | 20.0 | 0.1 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [preset_night_fire.png](phaser/fx_v2/preset_night_fire.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 211 KiB | 33.79 | 20.9 | 0.1 | 0.0 | 98.6 | `NEGRA` `TOCA-BORDE` |
| [preset_night_fire_050x.png](phaser/fx_v2/preset_night_fire_050x.png) | escena nocturna | [`phaser/fx_v2/fx_v2.json`](phaser/fx_v2/fx_v2.json) (lote) | 1298×543 · 86 KiB | 27.44 | 12.81 | 0.02 | 0.0 | 98.6 | `NEGRA` `PLANA` `TOCA-BORDE` |

## `v2/ag/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ag_arcade_bay_2m.png](v2/ag/ag_arcade_bay_2m.png) | escena diurna | [`v2/ag/ag_arcade_bay_2m.json`](v2/ag/ag_arcade_bay_2m.json) | 549×585 · 308 KiB | 151.94 | 40.96 | 0.0 | 0.0 | 53.2 | `TOCA-BORDE` |
| [ag_arcade_bay_2m_simplified.png](v2/ag/ag_arcade_bay_2m_simplified.png) | escena diurna | [`v2/ag/ag_arcade_bay_2m_simplified.json`](v2/ag/ag_arcade_bay_2m_simplified.json) | 549×585 · 304 KiB | 152.06 | 40.82 | 0.0 | 0.0 | 53.2 | `TOCA-BORDE` |
| [quality_ab.png](v2/ag/quality_ab.png) | hoja de trabajo | **SIN** | 1118×585 · 297 KiB | 87.06 | 80.76 | 41.32 | 0.0 | 53.3 | `TOCA-BORDE` |

## `v2/candidates/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [wp06_mixed_tenement-candidata.png](v2/candidates/wp06_mixed_tenement-candidata.png) | escena diurna | [`v2/candidates/wp06_mixed_tenement-candidata.json`](v2/candidates/wp06_mixed_tenement-candidata.json) | 1048×1046 · 1337 KiB | 131.46 | 32.91 | 0.0 | 0.0 | 30.3 | — |
| [wp06_row_house-candidata.png](v2/candidates/wp06_row_house-candidata.png) | escena diurna | [`v2/candidates/wp06_row_house-candidata.json`](v2/candidates/wp06_row_house-candidata.json) | 996×1203 · 1116 KiB | 133.56 | 38.88 | 0.0 | 0.0 | 0.0 | — |
| [wp06_town_hall-candidata.png](v2/candidates/wp06_town_hall-candidata.png) | escena diurna | [`v2/candidates/wp06_town_hall-candidata.json`](v2/candidates/wp06_town_hall-candidata.json) | 1395×1487 · 1743 KiB | 149.76 | 37.28 | 0.0 | 0.0 | 1.5 | — |
| [wp06_warehouse-candidata.png](v2/candidates/wp06_warehouse-candidata.png) | escena diurna | [`v2/candidates/wp06_warehouse-candidata.json`](v2/candidates/wp06_warehouse-candidata.json) | 1394×944 · 935 KiB | 58.73 | 16.41 | 0.01 | 0.0 | 16.8 | `PLANA` |

## `v2/civic/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [town_hall-candidata.png](v2/civic/town_hall-candidata.png) | escena diurna | [`v2/civic/town_hall-candidata.json`](v2/civic/town_hall-candidata.json) | 1395×1487 · 1743 KiB | 149.76 | 37.28 | 0.0 | 0.0 | 1.5 | — |
| [town_hall-control.png](v2/civic/town_hall-control.png) | escena diurna | [`v2/civic/town_hall-control.json`](v2/civic/town_hall-control.json) | 1395×1487 · 1799 KiB | 148.65 | 34.58 | 0.0 | 0.0 | 1.5 | — |

## `v2/commercial/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [mixed_tenement-candidata.png](v2/commercial/mixed_tenement-candidata.png) | escena diurna | [`v2/commercial/mixed_tenement-candidata.json`](v2/commercial/mixed_tenement-candidata.json) | 1048×1046 · 1337 KiB | 131.46 | 32.91 | 0.0 | 0.0 | 30.3 | — |
| [mixed_tenement-control.png](v2/commercial/mixed_tenement-control.png) | escena diurna | [`v2/commercial/mixed_tenement-control.json`](v2/commercial/mixed_tenement-control.json) | 1048×1046 · 1427 KiB | 126.22 | 22.95 | 0.0 | 0.0 | 30.3 | — |

## `v2/ext/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [archimesh_window_bay_2m_high.png](v2/ext/archimesh_window_bay_2m_high.png) | escena diurna | [`v2/ext/archimesh_window_bay_2m_high.json`](v2/ext/archimesh_window_bay_2m_high.json) | 524×568 · 272 KiB | 119.91 | 29.96 | 0.0 | 0.0 | 54.8 | `TOCA-BORDE` |
| [archimesh_window_bay_2m_simplified.png](v2/ext/archimesh_window_bay_2m_simplified.png) | escena diurna | [`v2/ext/archimesh_window_bay_2m_simplified.json`](v2/ext/archimesh_window_bay_2m_simplified.json) | 524×568 · 272 KiB | 118.63 | 28.75 | 0.0 | 0.0 | 54.8 | `TOCA-BORDE` |
| [control_gn_window_bay.png](v2/ext/control_gn_window_bay.png) | escena diurna | [`v2/ext/control_gn_window_bay.json`](v2/ext/control_gn_window_bay.json) | 524×572 · 282 KiB | 120.4 | 32.04 | 0.0 | 0.0 | 54.4 | `TOCA-BORDE` |
| [hifi_window_bay_2m_high.png](v2/ext/hifi_window_bay_2m_high.png) | escena diurna | [`v2/ext/hifi_window_bay_2m_high.json`](v2/ext/hifi_window_bay_2m_high.json) | 549×599 · 313 KiB | 133.9 | 38.21 | 0.0 | 0.0 | 51.9 | `TOCA-BORDE` |
| [hifi_window_bay_2m_simplified.png](v2/ext/hifi_window_bay_2m_simplified.png) | escena diurna | [`v2/ext/hifi_window_bay_2m_simplified.json`](v2/ext/hifi_window_bay_2m_simplified.json) | 549×596 · 319 KiB | 126.21 | 32.0 | 0.0 | 0.0 | 52.0 | `TOCA-BORDE` |

## `v2/fire/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [candidata_mixed_tenement_day.png](v2/fire/candidata_mixed_tenement_day.png) | escena diurna | [`v2/fire/candidata_mixed_tenement_day.json`](v2/fire/candidata_mixed_tenement_day.json) | 1082×1233 · 1583 KiB | 121.45 | 23.71 | 0.0 | 0.0 | 25.9 | — |
| [candidata_mixed_tenement_night.png](v2/fire/candidata_mixed_tenement_night.png) | escena nocturna | [`v2/fire/candidata_mixed_tenement_night.json`](v2/fire/candidata_mixed_tenement_night.json) | 1082×1233 · 1381 KiB | 52.86 | 22.5 | 0.87 | 0.0 | 24.2 | — |
| [candidata_warehouse_day.png](v2/fire/candidata_warehouse_day.png) | escena diurna | [`v2/fire/candidata_warehouse_day.json`](v2/fire/candidata_warehouse_day.json) | 1417×1119 · 1350 KiB | 119.69 | 43.04 | 0.0 | 0.0 | 14.1 | — |
| [candidata_warehouse_night.png](v2/fire/candidata_warehouse_night.png) | escena nocturna | [`v2/fire/candidata_warehouse_night.json`](v2/fire/candidata_warehouse_night.json) | 1417×1119 · 1027 KiB | 62.17 | 33.48 | 1.22 | 0.0 | 14.1 | — |
| [control_mixed_tenement_day.png](v2/fire/control_mixed_tenement_day.png) | escena diurna | [`v2/fire/control_mixed_tenement_day.json`](v2/fire/control_mixed_tenement_day.json) | 1082×1063 · 1431 KiB | 97.83 | 18.41 | 0.0 | 0.0 | 30.0 | — |
| [control_mixed_tenement_night.png](v2/fire/control_mixed_tenement_night.png) | escena nocturna | [`v2/fire/control_mixed_tenement_night.json`](v2/fire/control_mixed_tenement_night.json) | 1082×1063 · 1261 KiB | 36.31 | 14.8 | 2.06 | 0.0 | 25.2 | `NEGRA` `PLANA` |
| [control_warehouse_day.png](v2/fire/control_warehouse_day.png) | escena diurna | [`v2/fire/control_warehouse_day.json`](v2/fire/control_warehouse_day.json) | 1417×1097 · 1283 KiB | 94.54 | 32.88 | 0.0 | 0.0 | 14.4 | — |
| [control_warehouse_night.png](v2/fire/control_warehouse_night.png) | escena nocturna | [`v2/fire/control_warehouse_night.json`](v2/fire/control_warehouse_night.json) | 1417×1097 · 967 KiB | 40.89 | 24.76 | 1.99 | 0.0 | 14.4 | `NEGRA` |
| [fire_blender_ab.png](v2/fire/fire_blender_ab.png) | hoja de trabajo | **SIN** | 8758×4024 · 4428 KiB | 24.82 | 22.15 | 0.07 | 0.0 | 0.0 | `NEGRA` |
| [fire_control_detail.png](v2/fire/fire_control_detail.png) | hoja de trabajo | **SIN** | 1440×636 · 231 KiB | 60.83 | 52.55 | 0.54 | 0.0 | 0.0 | — |
| [fire_control_sheet.png](v2/fire/fire_control_sheet.png) | hoja de trabajo | **SIN** | 1924×976 · 847 KiB | 36.44 | 38.83 | 34.77 | 0.02 | 0.0 | `NEGRA` |

## `v2/gn/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [gn_params.png](v2/gn/gn_params.png) | escena diurna | [`v2/gn/gn_params.json`](v2/gn/gn_params.json) | 797×688 · 423 KiB | 107.18 | 30.79 | 0.0 | 0.0 | 36.3 | — |
| [gn_parts.png](v2/gn/gn_parts.png) | escena diurna | [`v2/gn/gn_parts.json`](v2/gn/gn_parts.json) | 468×549 · 198 KiB | 121.62 | 31.6 | 0.0 | 0.0 | 32.4 | — |

## `v2/hifi/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [hifi_facade_free.png](v2/hifi/hifi_facade_free.png) | escena diurna | [`v2/hifi/hifi_facade_free.json`](v2/hifi/hifi_facade_free.json) | 755×750 · 540 KiB | 116.12 | 29.7 | 0.0 | 0.0 | 1.2 | — |
| [hifi_facade_grid.png](v2/hifi/hifi_facade_grid.png) | escena diurna | [`v2/hifi/hifi_facade_grid.json`](v2/hifi/hifi_facade_grid.json) | 786×734 · 570 KiB | 117.62 | 28.15 | 0.0 | 0.0 | 1.0 | — |

## `v2/industrial/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [dock_aperture_scale.png](v2/industrial/dock_aperture_scale.png) | escena diurna | [`v2/industrial/dock_aperture_scale.json`](v2/industrial/dock_aperture_scale.json) | 1541×131 · 185 KiB | 156.26 | 36.81 | 0.0 | 1.18 | 88.5 | `TOCA-BORDE` |
| [warehouse-candidata.png](v2/industrial/warehouse-candidata.png) | escena diurna | [`v2/industrial/warehouse-candidata.json`](v2/industrial/warehouse-candidata.json) | 1394×944 · 935 KiB | 58.73 | 16.41 | 0.01 | 0.0 | 16.8 | `PLANA` |
| [warehouse-control.png](v2/industrial/warehouse-control.png) | escena diurna | [`v2/industrial/warehouse-control.json`](v2/industrial/warehouse-control.json) | 1383×873 · 893 KiB | 62.64 | 22.75 | 1.55 | 0.0 | 18.1 | — |

## `v2/residential/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [row_house-candidata.png](v2/residential/row_house-candidata.png) | escena diurna | [`v2/residential/row_house-candidata.json`](v2/residential/row_house-candidata.json) | 996×1203 · 1101 KiB | 133.83 | 39.06 | 0.0 | 0.0 | 0.0 | — |
| [row_house-control.png](v2/residential/row_house-control.png) | escena diurna | [`v2/residential/row_house-control.json`](v2/residential/row_house-control.json) | 996×1203 · 1184 KiB | 121.77 | 31.52 | 0.0 | 0.0 | 0.0 | — |

## `v2/sheets/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ag_civic_ab.png](v2/sheets/ag_civic_ab.png) | hoja de trabajo | **SIN** | 2792×1815 · 1148 KiB | 46.99 | 57.51 | 4.87 | 0.0 | 0.0 | — |
| [building_condition_states.png](v2/sheets/building_condition_states.png) | hoja de trabajo | [`v2/sheets/building_condition_states.json`](v2/sheets/building_condition_states.json) | 1424×679 · 394 KiB | 49.31 | 50.23 | 0.0 | 0.05 | 0.0 | — |
| [ext_window_columns.png](v2/sheets/ext_window_columns.png) | hoja de trabajo | **SIN** | 3946×1637 · 1097 KiB | 35.33 | 39.39 | 0.0 | 0.0 | 0.0 | `NEGRA` |
| [gn_v2_ab.png](v2/sheets/gn_v2_ab.png) | hoja de trabajo | **SIN** | 3816×2313 · 2203 KiB | 45.17 | 49.03 | 0.0 | 0.0 | 0.0 | — |
| [hifi_grid_ab.png](v2/sheets/hifi_grid_ab.png) | hoja de trabajo | **SIN** | 2890×951 · 726 KiB | 49.43 | 48.25 | 0.0 | 0.0 | 0.0 | — |
| [industrial_warehouse_ab.png](v2/sheets/industrial_warehouse_ab.png) | hoja de trabajo | **SIN** | 3098×1813 · 1313 KiB | 34.17 | 31.39 | 0.15 | 0.04 | 0.0 | `NEGRA` |
| [weathering_states.png](v2/sheets/weathering_states.png) | hoja de trabajo | [`v2/sheets/weathering_states.json`](v2/sheets/weathering_states.json) | 3524×4557 · 3470 KiB | 32.92 | 35.17 | 0.01 | 0.02 | 0.0 | `NEGRA` |
| [wp06_candidates_ab.png](v2/sheets/wp06_candidates_ab.png) | hoja de trabajo | [`v2/sheets/wp06_candidates_ab.json`](v2/sheets/wp06_candidates_ab.json) | 4368×4370 · 3894 KiB | 37.99 | 42.38 | 0.04 | 0.0 | 0.0 | `NEGRA` |
| [wp08_arquitectura_avanzada.png](v2/sheets/wp08_arquitectura_avanzada.png) | hoja de trabajo | [`v2/sheets/wp08_arquitectura_avanzada.json`](v2/sheets/wp08_arquitectura_avanzada.json) | 3091×1723 · 1380 KiB | 43.22 | 49.98 | 0.0 | 0.0 | 0.0 | `NEGRA` |
| [wp08_fx_nocturnos.png](v2/sheets/wp08_fx_nocturnos.png) | hoja de trabajo | [`v2/sheets/wp08_fx_nocturnos.json`](v2/sheets/wp08_fx_nocturnos.json) | 3247×1189 · 579 KiB | 30.37 | 24.8 | 0.11 | 0.05 | 0.0 | `NEGRA` |

## `v2/urban/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [urban_civic_05x.png](v2/urban/urban_civic_05x.png) | escena diurna | [`v2/urban/urban_civic_05x.json`](v2/urban/urban_civic_05x.json) | 1440×900 · 1129 KiB | 113.07 | 68.85 | 0.0 | 4.44 | 35.8 | **`LAVADA`** |
| [urban_civic_10x.png](v2/urban/urban_civic_10x.png) | escena diurna | [`v2/urban/urban_civic_10x.json`](v2/urban/urban_civic_10x.json) | 1440×900 · 1227 KiB | 124.17 | 64.48 | 0.0 | 4.54 | 35.8 | **`LAVADA`** |
| [urban_commercial_05x.png](v2/urban/urban_commercial_05x.png) | escena diurna | [`v2/urban/urban_commercial_05x.json`](v2/urban/urban_commercial_05x.json) | 1440×900 · 1097 KiB | 112.99 | 68.83 | 0.0 | 4.49 | 35.8 | **`LAVADA`** |
| [urban_commercial_10x.png](v2/urban/urban_commercial_10x.png) | escena diurna | [`v2/urban/urban_commercial_10x.json`](v2/urban/urban_commercial_10x.json) | 1440×900 · 1212 KiB | 121.34 | 64.12 | 0.0 | 4.54 | 35.8 | **`LAVADA`** |
| [urban_industrial_05x.png](v2/urban/urban_industrial_05x.png) | escena diurna | [`v2/urban/urban_industrial_05x.json`](v2/urban/urban_industrial_05x.json) | 1440×900 · 1073 KiB | 113.61 | 68.48 | 0.0 | 4.6 | 35.8 | **`LAVADA`** |
| [urban_industrial_10x.png](v2/urban/urban_industrial_10x.png) | escena diurna | [`v2/urban/urban_industrial_10x.json`](v2/urban/urban_industrial_10x.json) | 1440×900 · 1145 KiB | 121.72 | 64.29 | 0.0 | 4.62 | 35.8 | **`LAVADA`** |
| [urban_residential_05x.png](v2/urban/urban_residential_05x.png) | escena diurna | [`v2/urban/urban_residential_05x.json`](v2/urban/urban_residential_05x.json) | 1440×900 · 1120 KiB | 112.59 | 68.43 | 0.0 | 4.47 | 35.8 | **`LAVADA`** |
| [urban_residential_10x.png](v2/urban/urban_residential_10x.png) | escena diurna | [`v2/urban/urban_residential_10x.json`](v2/urban/urban_residential_10x.json) | 1440×900 · 1209 KiB | 120.07 | 64.37 | 0.0 | 4.49 | 35.8 | **`LAVADA`** |

## `v2/weathering/`

| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [vw_mixed_tenement_1001_aged.png](v2/weathering/day/vw_mixed_tenement_1001_aged.png) | escena diurna | [`v2/weathering/day/vw_mixed_tenement_1001_aged.json`](v2/weathering/day/vw_mixed_tenement_1001_aged.json) | 1037×1146 · 1310 KiB | 115.63 | 29.67 | 0.0 | 0.0 | 0.3 | — |
| [vw_mixed_tenement_1001_burning.png](v2/weathering/day/vw_mixed_tenement_1001_burning.png) | escena diurna | [`v2/weathering/day/vw_mixed_tenement_1001_burning.json`](v2/weathering/day/vw_mixed_tenement_1001_burning.json) | 1087×1265 · 1458 KiB | 129.49 | 32.76 | 0.0 | 0.0 | 0.0 | — |
| [vw_mixed_tenement_1001_conserved.png](v2/weathering/day/vw_mixed_tenement_1001_conserved.png) | escena diurna | [`v2/weathering/day/vw_mixed_tenement_1001_conserved.json`](v2/weathering/day/vw_mixed_tenement_1001_conserved.json) | 1037×1146 · 1320 KiB | 126.79 | 31.71 | 0.0 | 0.41 | 0.3 | — |
| [vw_mixed_tenement_1001_damaged.png](v2/weathering/day/vw_mixed_tenement_1001_damaged.png) | escena diurna | [`v2/weathering/day/vw_mixed_tenement_1001_damaged.json`](v2/weathering/day/vw_mixed_tenement_1001_damaged.json) | 1087×1171 · 1397 KiB | 126.64 | 29.9 | 0.0 | 0.0 | 0.0 | — |
| [_control.png](v2/weathering/mask/_control.png) | mapa de trabajo | **SIN** | 512×512 · 118 KiB | 130.26 | 74.68 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [atlas_aged.png](v2/weathering/mask/atlas_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 210 KiB | 118.94 | 68.24 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [atlas_mask.png](v2/weathering/mask/atlas_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 114 KiB | 141.24 | 81.75 | 24.61 | 0.21 | 75.4 | `TOCA-BORDE` |
| [brick_aged.png](v2/weathering/mask/brick_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 206 KiB | 113.26 | 65.02 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [brick_mask.png](v2/weathering/mask/brick_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 119 KiB | 161.25 | 93.15 | 24.61 | 0.24 | 75.4 | `TOCA-BORDE` |
| [glass_aged.png](v2/weathering/mask/glass_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 118 KiB | 130.26 | 74.68 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [glass_mask.png](v2/weathering/mask/glass_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 72 KiB | 0.08 | 0.27 | 100.0 | 0.0 | 0.0 | `NEGRA` `PLANA` `CASI-TODO-NEGRO` |
| [interior_aged.png](v2/weathering/mask/interior_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 206 KiB | 115.02 | 66.02 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [interior_mask.png](v2/weathering/mask/interior_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 118 KiB | 157.58 | 91.09 | 24.61 | 0.16 | 75.4 | `TOCA-BORDE` |
| [metal_aged.png](v2/weathering/mask/metal_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 214 KiB | 126.34 | 72.47 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [metal_mask.png](v2/weathering/mask/metal_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 142 KiB | 128.65 | 75.89 | 24.61 | 0.64 | 75.4 | `TOCA-BORDE` |
| [plaster_aged.png](v2/weathering/mask/plaster_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 205 KiB | 114.02 | 65.62 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [plaster_mask.png](v2/weathering/mask/plaster_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 119 KiB | 161.06 | 95.13 | 24.61 | 10.89 | 75.4 | `LAVADA` `TOCA-BORDE` |
| [stone_aged.png](v2/weathering/mask/stone_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 206 KiB | 114.61 | 65.74 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [stone_mask.png](v2/weathering/mask/stone_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 117 KiB | 176.49 | 101.45 | 24.61 | 6.2 | 75.4 | `LAVADA` `TOCA-BORDE` |
| [wood_aged.png](v2/weathering/mask/wood_aged.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 207 KiB | 107.73 | 61.81 | 24.61 | 0.0 | 75.4 | `TOCA-BORDE` |
| [wood_mask.png](v2/weathering/mask/wood_mask.png) | mapa de trabajo | [`v2/weathering/mask/summary.json`](v2/weathering/mask/summary.json) (lote) | 512×512 · 119 KiB | 164.34 | 94.39 | 24.61 | 0.15 | 75.4 | `TOCA-BORDE` |
| [vwn_mixed_tenement_1001_aged.png](v2/weathering/night/vwn_mixed_tenement_1001_aged.png) | escena nocturna | [`v2/weathering/night/vwn_mixed_tenement_1001_aged.json`](v2/weathering/night/vwn_mixed_tenement_1001_aged.json) | 1037×1146 · 1104 KiB | 52.52 | 18.67 | 0.17 | 0.0 | 0.3 | — |
| [vwn_mixed_tenement_1001_conserved.png](v2/weathering/night/vwn_mixed_tenement_1001_conserved.png) | escena nocturna | [`v2/weathering/night/vwn_mixed_tenement_1001_conserved.json`](v2/weathering/night/vwn_mixed_tenement_1001_conserved.json) | 1037×1146 · 1126 KiB | 57.89 | 18.28 | 0.14 | 0.0 | 0.3 | — |
| [vw_mixed_tenement_1001.png](v2/weathering/optout/vw_mixed_tenement_1001.png) | escena diurna | [`v2/weathering/optout/vw_mixed_tenement_1001.json`](v2/weathering/optout/vw_mixed_tenement_1001.json) | 1037×1146 · 1320 KiB | 126.79 | 31.71 | 0.0 | 0.41 | 0.3 | — |
| [green_after_interior_fix.png](v2/weathering/probe/green_after_interior_fix.png) | escena diurna | [`v2/weathering/probe/green_after_interior_fix.json`](v2/weathering/probe/green_after_interior_fix.json) | 1037×1146 · 1289 KiB | 157.48 | 14.38 | 0.0 | 0.0 | 0.3 | `PLANA` |
| [green_before_interior_fix.png](v2/weathering/probe/green_before_interior_fix.png) | escena diurna | [`v2/weathering/probe/green_before_interior_fix.json`](v2/weathering/probe/green_before_interior_fix.json) | 1037×1146 · 1345 KiB | 145.84 | 21.41 | 0.0 | 0.0 | 0.3 | — |
| [night_aged_emission_scale_0.png](v2/weathering/probe/night_aged_emission_scale_0.png) | escena nocturna | [`v2/weathering/probe/night_aged_emission_scale_0.json`](v2/weathering/probe/night_aged_emission_scale_0.json) | 1037×1146 · 1104 KiB | 52.52 | 18.67 | 0.17 | 0.0 | 0.3 | — |
| [night_aged_emission_scale_1.png](v2/weathering/probe/night_aged_emission_scale_1.png) | escena nocturna | [`v2/weathering/probe/night_aged_emission_scale_1.json`](v2/weathering/probe/night_aged_emission_scale_1.json) | 1037×1146 · 1104 KiB | 52.52 | 18.67 | 0.17 | 0.0 | 0.3 | — |
## PNG sin JSON de procedencia

El lote no las nombra y no tienen hermano: **SIN EVIDENCIA de autoría**, no sustituidas por
la carpeta de al lado. Cada una lleva su motivo: dónde está la información y por qué no llegó
a un JSON con su nombre.

- `phaser/fx_v2/atribucion/halo_con_pointlight.png` — sondas de atribución del halo de FASE 5 (`f606813`), citadas con sus RGB en `apps/web/src/fx-lab/fx-effects.ts` §5.2; la corrida que las disparó no las nombró en ningún JSON.
- `phaser/fx_v2/atribucion/halo_retirado_fire_lighting.png` — sondas de atribución del halo de FASE 5 (`f606813`), citadas con sus RGB en `apps/web/src/fx-lab/fx-effects.ts` §5.2; la corrida que las disparó no las nombró en ningún JSON.
- `phaser/fx_v2/atribucion/halo_sin_lighting.png` — sondas de atribución del halo de FASE 5 (`f606813`), citadas con sus RGB en `apps/web/src/fx-lab/fx-effects.ts` §5.2; la corrida que las disparó no las nombró en ningún JSON.
- `v2/ag/quality_ab.png` — render intermedio de WP02 (`9a48fee`) pegado sobre negro para el A/B de calidad; sus dos fuentes sí tienen JSON hermano en `v2/ag/`.
- `v2/fire/fire_blender_ab.png` — hoja de FASE 3 (`b58f263`) escrita por `tools/art-pipeline/blender/ext_lab/fire_ab_sheet.py`; las medidas por panel sí están, en `v2/fire/fire_blender_ab_readings.json`, indexadas como `{familia}-{mood}-{brazo}` y no por nombre de archivo.
- `v2/fire/fire_control_detail.png` — diagnóstico de FASE 2 (`9e95206`): la hoja de control y su detalle se escribieron antes de que el script dejara procedencia por archivo.
- `v2/fire/fire_control_sheet.png` — diagnóstico de FASE 2 (`9e95206`): la hoja de control y su detalle se escribieron antes de que el script dejara procedencia por archivo.
- `v2/sheets/ag_civic_ab.png` — hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma.
- `v2/sheets/ext_window_columns.png` — hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma.
- `v2/sheets/gn_v2_ab.png` — hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma.
- `v2/sheets/hifi_grid_ab.png` — hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma.
- `v2/sheets/industrial_warehouse_ab.png` — hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma.
- `v2/weathering/mask/_control.png` — la corrida de FASE 6 escribe `v2/weathering/mask/summary.json`, que lista los 16 canales tratados y envejecidos pero no el atlas de control del que salen.

## Hallazgos abiertos (medidos, no ocultados)

| qué | medido | quién decide |
| --- | --- | --- |
| El recorte a blanco de las 8 capturas urbanas es el HUD, no la calle | `v2/urban/*.png` miden 4,4–4,6 % de píxel ≥ 252, pero el mapa por octavos lo concentra todo en la banda de arriba y en la tarjeta inferior izquierda: excluida la banda del HUD (filas 0–14 % y 88–100 %) el recorte del lienzo de juego queda en 0,02–0,14 % y su luma media en 83–97. La bandera se queda en rojo porque el PNG publicado sí lleva la interfaz dentro: `«Distrito observado cambiado.»` y el panel «Vista normal» se ven en la evidencia. | responsable: silenciar el UI en la captura de QA o aceptar el rótulo como parte de la evidencia |
| Distritos casi vacíos | `faltaWP08` en los JSON de `v2/urban/`: sólo el distrito cívico llega a los contadores; residencial, comercial e industrial ponen 1–4 fachadas en cuadro. Es densidad del generador de mundo, no de la captura. | encargo aparte (prioridad declarada: densidad, más atrezo no) |
| Parcelas de tierra desnuda con fauna suelta | en `urban_civic_10x.png` y `urban_civic_05x.png` se ven motas cian de vegetación sobre solar sin fachada: la siembra de props no comprueba que la parcela tenga edificio. | encargo aparte |

## SIN EVIDENCIA (declarado, no sustituido)

| Lo que pide el encargo | Por qué no hay imagen |
| --- | --- |
| Fachadas candidatas WP06 dentro de una escena Phaser | las candidatas se componen en Blender y se publican en `docs/art/building-composer/candidates/`, que no está servido por el bundle; `urban/` fotografía el set runtime (`qa_approved`), que es otra autoría. La A/B de candidatas existe a escala de Blender en `sheets/wp06_candidates_ab.png`. |
| Calle poblada de noche en el mundo real | el bundle runtime promocionado es de día (`day_civic`); la noche sólo existe en el laboratorio (`phaser/fx_v2/preset_night_*.png`). Promover noche al mundo es decisión del responsable. |
| Sprite `aged` en catálogo runtime | FASE 6 derivó el tier `aged` pero el manifiesto runtime no tiene ese estado: no hay píxel que enseñar en juego. Ver `building-weathering-contract.json → derivation.runtimeConflict`. |
| Esquina cívica a pico | necesita geometría nueva sobre el extremo de la banda; forzar `brick_post` compone 0/60 semillas y limitar el módulo a `municipal_block` mueve 56 de 105 colocaciones. No se fuerza con parche. |
| Recorte determinista de lienzo | `row_house` y `town_hall` tocan el borde derecho del lienzo con margen 1–2 px en control y candidata por igual: es la deuda declarada de `deterministic_crop_rect`, no algo introducido por v2. |

Ninguna de estas filas se cierra con un sustituto más barato: si aparece la evidencia, se añade
su PNG con JSON hermano y el índice la incorpora sola al regenerar.
