# Spike de maqueta material — evidencia A/B

Estado: evidencia técnica generada; revisión visual humana y promoción pendientes.

## HUD y terreno

Cuatro capturas de la misma ciudad nueva, viewport 1440×900, zoom 1× y cámara sin desplazamiento.
El brazo cambia entre `graphic_civic` y `material_maquette_candidate`; los controles se activan sólo
con `?artQa=1`. El manifiesto registra SHA-256 y cámara.

| Momento | Control | Candidata |
| --- | --- | --- |
| Día | [captura](ab/day-graphic_civic.png) | [captura](ab/day-material_maquette_candidate.png) |
| Noche | [captura](ab/night-graphic_civic.png) | [captura](ab/night-material_maquette_candidate.png) |

La escena está vacía de edificios al iniciar una ciudad nueva; estas capturas aíslan terreno, HUD,
contraste y encuadre. No sirven como gate de fachadas.

## Building Composer

Tres salidas completas con Composer, seed 1010, mood `day_civic`, perfil
`graphic_civic_buildings_v1`, Blender 5.2.2 y orientación 0°. Son variaciones de las gramáticas y
módulos licenciados existentes; no introducen paquetes, recetas nuevas ni promociones de runtime.
La tira compara cada propuesta con el lote diurno histórico del mismo tipo.

| Tipo | PNG candidato | Firma de composición | SHA-256 | Módulos | Geometría licenciada |
| --- | --- | --- | --- | ---: | ---: |
| `row_house` | [PNG](candidates/mm_row_house_1010.png) | `05e6a6747525c4b7f74636d5d6250af7b33caaa173523e93036e90a53bcb4522` | `8f222ba7751755d6b730ef1aab751e5ae37fc580f256f54d22cf486b6c497bd7` | 9 | 100 % |
| `mixed_tenement` | [PNG](candidates/mm_mixed_tenement_1010.png) | `4276ccb5f7576f5b742f11833e1e30c0b0764dcc060f33cc6c6a60a6abdf43a6` | `9a63fb8d4a39bf16e95b9adac70800c2f82cd97a5433405eb4408ae750f81273` | 9 | 100 % |
| `warehouse` | [PNG](candidates/mm_warehouse_1010.png) | `0bd43b81777d34afaa51a0411a9d0bec06fd329f71f6b284b04e20c54434a68b` | `3d41aa997975e141dd40f5aca8dad53b4e250813a6e4a980a19672259e5af725` | 10 | 100 % |

[Tira de comparación](candidates/contact-sheet.png) · [manifiesto de muestras portable](candidates/samples.json) ·
[manifiesto Composer completo](candidates/manifest.json) · [métricas](candidates/metrics.json)

El lote conserva detalle por módulo, procedencia, hashes, huella, plantas, pivote y parámetros en los
JSON de cada candidato. El manifiesto confirma que los hashes de
`runtime-assets.json` y `runtime-assets-blender.json` son idénticos antes/después. Ningún candidato
está conectado al catálogo jugable.

## Alcance que queda abierto

- Revisión humana de la dirección y de cada piloto dentro de la ciudad real.
- Comparación de edificios a 0,5×, 1×, 2× y 2,5×, día/noche, cuatro orientaciones y estados completos,
  obra, daño e incendio.
- No se midieron aquí rendimiento, descarga ni memoria; no se añadieron FX ni cambios de
  materialización a los sprites.
