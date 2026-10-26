# Contribuir arte a Landlord

> Estado: borrador de política para un repositorio abierto.
>
> Hasta que se apruebe una licencia específica para assets, ninguna contribución debe asumir que la licencia del código cubre automáticamente material artístico de terceros.

## Principios

1. El asset debe ser original, estar correctamente licenciado o ser de dominio público con evidencia suficiente.
2. No se aceptan assets, personajes, interfaces, mapas, música, textos o elementos derivados de Constructor, Street Wars/Mob Rule ni de otras IP sin autorización.
3. Todo entregable debe declarar autor, origen, licencia y fuente editable.
4. El archivo fuente y el asset runtime son conceptos distintos. Siempre que sea razonable debe conservarse la fuente editable.
5. Substance, Photoshop, Aseprite o herramientas comerciales pueden utilizarse, pero el pipeline no debe obligar a un colaborador externo a poseerlas para realizar una contribución válida. Blender es el baseline propuesto para assets 3D.
6. Material generado o asistido por IA debe declararse explícitamente y quedar sujeto a revisión de licencia, provenance y similitud.
7. La consistencia con la Art Bible, la legibilidad en zoom y la integración técnica tienen la misma importancia que el acabado estético.

## Metadata mínima propuesta

```json
{
  "schemaVersion": 1,
  "assetId": "bld_res_rowhouse_a",
  "type": "building",
  "author": "github:usuario",
  "origin": "original",
  "license": "PROJECT-ASSET-LICENSE",
  "source": "art/blender/buildings/res/rowhouse_a.blend",
  "artBibleVersion": "0.1",
  "footprint": [2, 3],
  "anchor": "ANCHOR_ROOT",
  "atlasGroup": "buildings_residential",
  "tags": ["era_1920", "residential"]
}
```

Valores de `origin` previstos: `original`, `licensed`, `public_domain`, `generated`, `derived`.

Para generación o asistencia por IA registrar además herramienta/modelo cuando proceda, revisión humana y estado de revisión de licencia.

## Flujo de contribución propuesto

```text
source
-> naming + manifest validation
-> changed-asset render
-> dimensions / alpha / anchor validation
-> atlas build
-> art-lab
-> visual regression
-> human art review
-> merge
```

No se renderizará necesariamente todo el catálogo en cada PR. El pipeline debe poder detectar assets modificados y reutilizar cache por hash de fuente, dependencias, configuración, versión de Blender y versión de pipeline.

## Git LFS

La investigación recomienda LFS para binarios fuente grandes como `.blend`, `.spp`, `.psd`, `.kra`, `.aseprite`, `.exr` y masters de audio. Esta política aún no está aplicada al repositorio y debe aprobarse antes de añadir grandes volúmenes de arte.

## Antes de abrir un PR de arte

- leer [ART-BIBLE.md](ART-BIBLE.md);
- leer [ART-PIPELINE.md](ART-PIPELINE.md);
- usar [ASSET-NAMING.md](ASSET-NAMING.md);
- completar [ASSET-CHECKLIST.md](ASSET-CHECKLIST.md);
- declarar provenance y licencia;
- adjuntar comparación visual o captura de Art Lab cuando exista.


## Librería bootstrap

El proyecto mantiene una selección inicial de assets externos para preproducción en:

`docs/art/BOOTSTRAP-ASSET-LIBRARY.md`

Aunque los packs seleccionados se han elegido por licencias permisivas, **no todo lo permisivo
está habilitado**: la lista canónica es `blender_artist/manifests/license-allowlist.json`
(D-083) y hoy admite `CC0-1.0`, `MIT` y `CC-BY-4.0` además de material propio `original`. El
directorio de staging codifica la familia (`third_party/cc0/`, `third_party/mit/`,
`third_party/cc-by/`).

Cada incorporación debe dejar la evidencia registrada:

- la fuente en `blender_artist/manifests/staging-sources.json`, con su integridad
  (`zip-sha256` o `git-commit` + hash del aviso de licencia) y su `unitScale` declarado;
- para licencias que exigen atribución (`MIT`, `CC-BY-4.0`), el bloque `attribution` en el asset
  correspondiente del manifiesto runtime; `pnpm art:licenses:check` falla si falta o si la
  licencia declarada no coincide con la de la fuente registrada;
- la nota en `docs/art/BOOTSTRAP-ASSET-LIBRARY.md`.
- el trabajo de render en `blender_artist/manifests/asset-jobs.json`, apuntando a la fuente por su
  `sourceId` (el job no redeclara licencia). Mientras el asset no cubra el contrato del `kind` se
  declara `target: "evidence"`, así se valida la ingesta sin publicar un asset incompleto.

No subir automáticamente archivos descargados sólo porque sean gratuitos.

Habilitar una licencia nueva (por ejemplo `CC-BY-3.0`, que hoy está denegada) requiere que exista
un asset que la necesite y una edición visible del allowlist en revisión.

Antes de introducir fuentes binarias:
- confirmar licencia del recurso concreto;
- registrar URL/origen;
- aprobar ubicación;
- aplicar política LFS cuando corresponda;
- evitar duplicar archivos que no sean necesarios para reproducir el pipeline.
