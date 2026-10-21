# Blender artist staging

Esta carpeta es staging local para el Visual Direction Spike; no es una carpeta
de runtime ni un almacén de assets aprobados. Sigue D-001, D-053 y D-054.

## Estructura

- `staging/third_party/cc0/`: archivos de terceros con licencia CC0 documentada.
- `staging/third_party/unverified/`: archivos cuya licencia u origen todavía no
  se ha verificado; no se pueden extraer ni utilizar en renders.
- `toolchain/`: instalaciones locales, incluida la distribución fijada de Blender.
- `original/`: fuentes creadas para Landlord. Un binario aquí no se versiona hasta
  aprobar Git LFS y provenance.
- `generated/`: renders/atlases locales generados, nunca fuente autoritativa.
- `reference-notes/`: análisis abstracto sin capturas, sprites, audio ni otros
  materiales de IP ajena.
- `manifests/`: inventario versionado de procedencia y briefs del kit de spike.

`constructor_1y2/` queda fuera de este flujo. No se copiarán, transformarán,
extraerán ni redistribuirán sus contenidos.

## Uso permitido

Antes de consumir una fuente, ejecutar `pnpm art:staging:validate`, verificar su
registro y comprobar que está en `cc0/`. La presencia de un archivo en staging no
lo aprueba para Git, runtime ni producción. Los assets derivados deben declarar
su input, autor, licencia y revisión de similitud según
`docs/art/CONTRIBUTING-ART.md`.

El kit inicial está definido en `manifests/visual-direction-spike-kit.json`. Sus
entradas son briefs y manifests, no assets renderizados aprobados: la cámara,
lighting, atlas, LFS y budgets siguen abiertos hasta cerrar el Visual Direction
Spike.
