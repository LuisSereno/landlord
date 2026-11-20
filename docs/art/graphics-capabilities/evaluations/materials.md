# D-111 §5 — Kenney Retro Textures Fantasy vs Poly Haven vs control Graphic Civic

## Montaje

`tools/art-pipeline/blender/ext_lab/material_lab.py`: **tres brazos sobre geometría idéntica**, en el
mismo fotograma, con la cámara, la luz y el recorte por alpha del pipeline real.

El cupón es neutro y se construye igual tres veces: muro 2,0×0,28×2,6 m + zócalo saliente
2,2×0,40×0,34 m + marco de ventana en relieve 1,05×0,34×1,35 m. Lo único que cambia entre A, B y C
es el shader.

UV métrico por proyección de caja sobre la normal dominante (UV = coordenada mundial en metros),
así que la densidad de cada material se declara en `tileMeters` y se puede calcular
`texelsPerMeter` en la metadata. Ningún helper del repo hacía esto — `source_import` sólo repara
rutas de texturas —, por eso la función vive en el laboratorio.

Ocho superficies (el encargo pedía 6-10), mood `day_civic`, 1024 px, 48 muestras, 4-10 s por
fotograma.

| brazo | qué es | canales |
|---|---|---|
| A Kenney Retro Textures Fantasy | loseta dibujada de 64 px, `interpolation='Closest'` | color + `_depth` como bump 0,18 + `_lit` como emisión condicionada al mood |
| B Poly Haven | el material tal cual viene en su `.blend`, re-encuadrado a UV métrico | albedo + normal + roughness (+ displacement) |
| C control Graphic Civic | la paleta mate del pipeline pasada por `style_procedural_materials` real | color plano |

`interpolation='Closest'` no es capricho: en runtime Phaser dibuja con `roundPixels`, y medir una
baldosa de 64 px con filtrado bilineal daría una lectura borrosa que el juego nunca muestra.

## Dos defectos del propio laboratorio corregidos durante la corrida

1. **Cupones a media escala.** `primitive_cube_add(size=1.0)` ya produce un cubo de 1 m de arista;
   escalar por `size/2` dejaba el cupón a la mitad y despegaba el zócalo del muro.
2. **Solapamiento en pantalla.** Con separación 2,4 m y cupón de 2,2 m, la cámara a 25° de azimut
   hacía que el brazo derecho tapara al central. Con 3,4 m de separación y empaquetando sólo los
   brazos presentes, cada hoja es legible sin rótulos en 3D (los rótulos en escena se cortaban con
   el recorte por alpha; la identificación va ahora en el pie de la hoja).

## Decisión por superficie

Tabla completa y motivos, en `docs/art/graphics-capabilities/material-decisions.json`. Resumen:

| superficie | Kenney | Poly Haven | lectura dominante |
|---|---|---|---|
| brick_wall | **rejected_for_style** | restricted_use | el ladrillo Kenney sale gris azulado y se lee sillería; el scan gana relieve pero trae intemperie |
| stucco_wall | sin candidato | **rejected_for_style** | `concrete_wall_003` tiene manchas de humedad: confunde "revocado" con "arruinado", que en Landlord son dos estados distintos del juego |
| stone_plinth | **approved_for_candidate** | restricted_use | sillar gris magro de junta clara: la mejor coincidencia dibujo/lenguaje del lote |
| timber | **approved_for_candidate** | restricted_use | el tablón Kenney lee carpintería en uso; la madera gris del scan lee abandono |
| clay_roof | **approved_for_candidate** | sin candidato | única teja del lote; el dibujo de escama se lee a 1× y a 0,5× |
| metal_sheet | sin candidato | **approved_for_candidate** | el canal de chapa es lo único del lote que da materialidad de nave sin pintar; condicionado a `day_industrial` |
| window_glass | restricted_use | sin candidato | la acompañante `_lit` es emisión nocturna: de día quema el cupón |
| pavement | **approved_for_candidate** | restricted_use | la loseta de 64 px coincide con la rejilla del sprite; el adoquín del scan choca con el asfalto grano 14 de D-105 |

## Lo que realmente se aprendió

- **No es "textura contra plano", es densidad y estado.** Kenney aporta 128 tex/m contra ~1 tex/m de
  Poly Haven: no son intercambiables sin re-escalar el tile, y comparar los dos sin decirlo es
  comparar otra cosa.
- **El pack Kenney no tiene canales PBR.** Cero normales, cero rugosidad, cero ORM; sólo 10 `_depth`
  y 11 `_lit`. Su relieve es bump desde luminancia, no geometría de superficie.
- **Las `_lit` son de noche.** Medido en la primera pasada: aplicadas en `day_civic` el cupón sale en
  blanco puro. El laboratorio ahora condiciona la fuerza de emisión al mood, que es como debería
  consumirlas el runtime.
- **Poly Haven introduce suciedad que el lenguaje gráfico no tiene.** En revoco y ladrillo el scan
  gana en materialidad y pierde en coherencia; en chapa gana en las dos. Por eso la decisión es por
  superficie y no por pack.

## Qué NO se hizo, y por qué

`world-catalogs/material-assets.json` **no se modifica**. Su generador autoritativo
(`tools/art-pipeline/blender/build_world_material_library.py`) tiene la lista de categorías de Poly
Haven codificada y ninguna para Kenney; `src_kenney_retro_textures_fantasy` sigue con
`runtimeReady:false` y `styleCompatibility:[]`. Rellenar ese campo es una promoción artística del
pack a catálogo runtime, y el encargo prohíbe promocionar candidatos sin revisión humana. Las
decisiones de esta fase quedan como dato machine-readable en `material-decisions.json`, que es
justo el insumo que necesita el generador cuando el responsable apruebe una superficie.

Tampoco se ha sustituido ningún Poly Haven existente: cuatro de las cinco superficies donde gana el
scan ya estaban en catálogo, y la quinta (chapa) queda como candidato.

Reproducir:

```bash
blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/material_lab.py -- \
  --mood=day_civic --samples=48 --resolution=1024
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py   # hoja §8.4
```
