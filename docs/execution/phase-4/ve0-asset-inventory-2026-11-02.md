# V.e.0 — inventario de fuentes visuales (2026-11-02)

Estado: **V.e.0 ASSET INVENTORY PASS**. Decisión de compra: **DEFER**.

## Resultado

La auditoría local encontró las 18 fuentes aprobadas declaradas en `staging-sources.json`: 17 CC0 y
el subset MIT de Microsoft Rocketbox. El corpus contiene 3.099 ficheros de modelo y 2.213 texturas.
El recuento mide ficheros disponibles, no diseños únicos: varios packs publican el mismo modelo en
FBX, GLB, OBJ, DAE o STL.

La evidencia reproducible vive en:

- `scripts/audit-visual-sources.mjs`;
- `docs/art/visual-catalog/source-inventory.json`;
- `docs/art/visual-catalog/source-inventory.md`.

## Integridad y licencias

```text
art:staging:validate  PASS · 18 fuentes aprobadas, 11 briefs originales
art:licenses:check    PASS · 2 bundles comprobados
art:jobs:validate     PASS · 27 jobs (25 bundle, 2 evidence)
art:sources:audit     PASS · 18/18 fuentes presentes
```

## Contact sheets

`pnpm art:sources:contact-sheets` usa Blender 5.2.2 LTS para renderizar candidatos normalizados y
Pillow para componer ocho hojas locales: residential, commercial, industrial, civic, characters,
vehicles, props y nature. Se guardan en `blender_artist/generated/catalog-sources/`, ignorado por
Git. Se revisaron visualmente las ocho.

La revisión confirma materia prima útil en todas las categorías. Los Rocketbox importados en bruto
aparecen magenta por rutas de material no remapeadas; el pipeline de producción ya dispone de la
fase de resolución de texturas y V.e.1 debe comparar el resultado corregido con Quaternius. Esto es
deuda de ingesta/candidato, no prueba de que falte comprar personajes.

## Conclusión de compra

La hipótesis `NO PURCHASE REQUIRED` sigue siendo plausible, pero V.e.0 no la ratifica todavía:
arquitectura urbana e industrial, carreteras, vehículos, naturaleza, props, bases humanas,
animaciones y materiales están presentes. Ningún gap cumple las cuatro condiciones necesarias para
proponer una compra. La decisión permanece `DEFER` hasta la matriz V.e.1.

## Siguiente gate

V.e.1 debe mapear estos candidatos contra los 15 tipos de edificio y los cuatro estados visuales,
detectar estados Blender duplicados por SHA-256 y producir `VISUAL-COVERAGE-MATRIX.md`. Ningún asset
queda promovido por haber aparecido en una contact sheet.
