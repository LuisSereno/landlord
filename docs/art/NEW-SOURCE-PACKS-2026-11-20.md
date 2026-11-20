# Paquetes visuales recibidos el 20 de noviembre de 2026

Registro operativo de las carpetas añadidas a `blender_artist/`. La fecha es la de **registro local**;
no se conoce la fecha original de descarga. Los archivos fuente viven en
`blender_artist/staging/third_party/cc0/extracted/`, excluido de Git por D-054. El inventario
versionado permite encontrarlos, pero no distribuye esos binarios ni promueve sprites.

## Resultado de la conciliación

| Paquete recibido | Fuente canónica | Contenido local | Uso que merece prueba | Estado |
| --- | --- | ---: | --- | --- |
| Kenney Building Kit 1.0 | `src_kenney_building_kit` | 79 GLB, 79 OBJ, 79 FBX, 86 PNG | Huecos anchos, escaleras, cubiertas y detalles de fachada | Candidato |
| Kenney Mini Characters 2.0 | `src_kenney_mini_characters` | 43 GLB, 43 OBJ, 43 FBX, 47 PNG | Peatones y accesibilidad; evaluar rig, escala y lectura a zoom real | Candidato |
| Kenney Modular Buildings 2.1 | `src_kenney_modular_buildings` | 108 GLB, 108 OBJ, 108 FBX, 117 PNG | Fachadas, cubiertas, puertas y ventanas residenciales | Candidato; ya evaluado para muelles en D-111 |
| Kenney Retro Textures Fantasy 1.0 | `src_kenney_retro_textures_fantasy` | 119 PNG | Sólo superficies puntuales que superen comparación con Poly Haven y la paleta del Art Bible | Reserva sin compatibilidad artística aprobada |
| Kenney Retro Urban Kit 2.0 | `src_kenney_retro_urban_kit` | 124 GLB, 124 OBJ, 124 FBX, 192 PNG | Hueco de garaje, andamios, utilería, camiones y geometría vial visual | Candidato prioritario para el almacén |
| Quaternius Ultimate Buildings (2019) | `src_quaternius_ultimate_buildings` | 102 Blend, 102 FBX, 102 OBJ y 12 PNG | Piezas de fachada y volúmenes de referencia; medir antes de componer | Candidato con revisión de licencia en promoción |
| Kenney City Kit Roads 2.2 | `src_kenney_city_roads` **existente** | 487 archivos | Ya presente en el índice y en el render vial | Duplicado exacto; 487/487 hashes idénticos |

La segunda copia de City Kit Roads se conserva localmente bajo
`blender_artist/staging/third_party/cc0/duplicates/kenney/city-kit-roads-2.2/`. No se crea otro
`sourceId`, no se indexa dos veces y puede eliminarse cuando deje de ser útil para verificar la
procedencia. La copia canónica permanece en `cc0/extracted/kenney/city-kit-roads/`.

## Licencia y trazabilidad

Los cinco packs nuevos de Kenney llevan `License.txt` CC0 dentro de la carpeta; las fichas oficiales también
los identifican como CC0. El pack de Quaternius **no** incluye aviso local: su
[ficha específica](https://quaternius.com/packs/ultimatetexturedbuildings.html) y la
[FAQ](https://quaternius.com/faq.html) lo presentan como CC0. La página general de
[licencia QAL](https://quaternius.com/license.html), actualizada en agosto de 2026, formula otras
condiciones para activos publicados bajo esa licencia. Se registra la licencia CC0 mostrada en la
ficha de este pack de 2019; antes de promover una pieza de Ultimate Buildings se debe conservar
evidencia de que esa licencia específica rige el archivo recibido. En caso de discrepancia se detiene
su promoción.

Las carpetas nuevas se registran en `staging-sources.json` con un SHA-256 del árbol extraído y
número de archivos. Se ordenan las rutas relativas POSIX y se concatena por archivo:
`ruta + NUL + SHA-256(bytes) + LF`. `pnpm art:staging:validate` verifica todos los bytes. El ZIP
de Modular Buildings descargado durante D-111 coincide en sus 554 archivos con la carpeta ahora
registrada; su SHA se conserva en la fuente. No se afirma poseer un ZIP de los demás packs.
`cc0-inventory.json` conserva la antigua extracción de archivos ZIP; el inventario actual de estas
carpetas está en `docs/art/visual-catalog/source-inventory.json` y `world-asset-index.json`.
En el estado actual del repositorio, `art:staging:validate` termina en rojo por siete fuentes
`src_original_*` con procedencia incompleta y una referencia generada ausente. Son los mismos ocho
errores presentes antes de registrar estos packs; ninguno procede de los árboles nuevos.

## Relación con el trabajo existente

- `City Kit Roads` ya servía carreteras, cruces y mobiliario. Los modelos viales de Retro Urban son
  candidatos de **presentación**; la topología vial sigue siendo la proyección del juego.
- `Modular Buildings` se probó en el [spike D-111](material-maquette-spike/README.md): sus puertas
  son de escala peatonal y no resuelven un muelle de carga. `wall-a-garage.glb` y
  `wall-a-flat-garage.glb` de Retro Urban son la siguiente prueba concreta para `warehouse`.
- Poly Haven ya aporta superficies PBR de ladrillo, metal, piedra, suelo y vegetación. Retro Textures
  Fantasy es pixel art y no reemplaza esos materiales sin un ensayo a resolución de juego.
- Rocketbox ya suministra avatares de contexto. Mini Characters añade modelos animados y ayudas
  de movilidad; personajes fantásticos, armas y figuras fuera de época quedan fuera de selección.
- Downtown City MegaKit ya aporta módulos de época al Composer. Ultimate Buildings amplía la
  reserva, pero sus edificios enteros son referencias de volumen, no sustitutos directos de las
  gramáticas, huellas y estados de Landlord.

## Contrato de uso en la generación del mundo

`world-asset-index.json` incluye 1.941 archivos visuales de las seis fuentes nuevas, con
`sourceId`, ruta, licencia, categoría y rol. Los subcatálogos de geometría, actores y vehículos son
vistas generadas; `material-assets.json` sigue siendo una biblioteca semántica curada. Todos empiezan
con `runtimeReady=false` y `styleCompatibility=[]`: ninguna escena ni sprite los selecciona por
mera presencia en el staging.

Para usar una pieza: elegir un único formato (GLB en Kenney, y probar Blend/FBX/OBJ en Quaternius),
medir escala/pivote/triángulos en Blender, verificar texturas y licencia, comparar en Art Lab con
`graphic_civic` y la maqueta material, asignar el rol semántico y el contexto, y añadirla a la
selección curada del Composer o al catálogo de utilería/actores. Después ejecutar los gates de
composición, tamaño, procedencia y captura en los nueve distritos. `unitScale` permanece `null`
en estas seis fuentes hasta esa medición: aplicar 4 m por unidad a todo Kenney sería incorrecto.

La regeneración del índice recogió además 19 assets **anteriores** que los jobs actuales ya tienen
como `runtime_ready` (198 → 217). Ese cambio refleja deriva previa entre jobs e índice; no es una
promoción causada por estos paquetes.

Comandos de mantenimiento:

```bash
pnpm art:staging:validate
pnpm art:sources:audit
python3 tools/art-pipeline/blender/build_world_asset_index.py
python3 tools/art-pipeline/blender/build_world_subcatalogs.py
pnpm art:licenses:check
```
