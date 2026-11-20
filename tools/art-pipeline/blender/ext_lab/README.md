# D-111 §4 — Laboratorio de extensiones arquitectónicas de Blender

Tres extensiones evaluadas **como herramientas**, no como fuentes de assets: producen geometría que
el pipeline de Landlord pudiera reutilizar, o se quedan en el informe.

| Extensión | Versión probada | Licencia (registro oficial) | Laboratorio |
| --- | --- | --- | --- |
| HiFi Architecture Builder | 4.6.7 | GPL-3.0-or-later | `hifi_lab.py` |
| Arch Generator | 1.0.1 | GPL-3.0-or-later | `arch_generator_lab.py` |
| Archimesh | 1.2.5 | GPL-2.0-or-later | `archimesh_lab.py` |

Ninguna se añade a las dependencias del repositorio. Los ZIP proceden del registro oficial
(`https://extensions.blender.org/api/v1/extensions/`) y se verifican contra el sha256 publicado en
`lab_common.EXTENSIONS`; la instalación escribe **sólo** en `/tmp/d111-ext-lab`.

## Aislamiento de configuración

Blender 5.2 ya no acepta `--config-dir`. El aislamiento se hace con variables de entorno, de modo
que el repositorio `User Default` del usuario real no se toca:

```bash
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
mkdir -p "$BLENDER_USER_CONFIG" "$BLENDER_USER_EXTENSIONS"
BLENDER=blender_artist/toolchain/blender-5.2.2-linux-x64/blender
```

Los archivos de las extensiones se descargan en `/tmp/d111-ext-lab/dl/` con los nombres que espera
`lab_common.EXTENSIONS` (`hifi.zip`, `archgen.zip`, `archimesh.zip`).

## Lanzar una prueba

```bash
$BLENDER -b --factory-startup -P tools/art-pipeline/blender/ext_lab/hifi_lab.py -- \
  --output docs/art/graphics-capabilities/evidence/extensions/hifi_facade.png \
  --metadata docs/art/graphics-capabilities/evidence/extensions/hifi_facade.json
```

`arch_generator_lab.py` y `archimesh_lab.py` aceptan los mismos argumentos
(`--output`, `--metadata`, `--ortho-scale`, `--target-z`, `--resolution`, `--samples`, `--mood`).
Cada corrida escribe un PNG y su JSON hermano con la cadena de mando completa, triángulos, cajas
de límites, cámara, luz y sha256 de la imagen.

## Qué hace comparable la prueba

Cámara, luz, gestión de color y recorte se importan de los helpers del repo
(`runtime_asset.place_camera`, `runtime_asset.apply_style_layer_lighting`,
`render_settings.apply_render_settings`, `runtime_asset.trim_and_scale`) y del mismo
`style_layer_graphic_civic.json` que usa el control del Building Composer. Ningún archivo del
pipeline se modifica para este laboratorio.

Los materiales del laboratorio son la paleta mate del perfil (`lab_common.palette_materials`) con
`force=True` en las piezas generadas: si cada extensión conserva su shader propio la imagen
compara render, no arquitectura. En `archimesh_lab.py` la comparación es a tres columnas
(Archimesh / Quaternius / Kenney) con 1 BU = 1 m para que la escala sea legible en la propia hoja.

## Resultado

La evaluación por extensión, con su evidencia y su veredicto, vive en
`docs/art/graphics-capabilities/evaluations/`. Este directorio sólo contiene el instrumento.
