# Building Factory

La Building Factory de V.e.2 produce candidatos reproducibles de silueta para los 15 tipos de
edificio. No cambia reglas de simulación ni promueve imágenes al runtime.

## Uso

```bash
pnpm art:building-factory:validate
pnpm art:building-factory:review
```

El segundo comando renderiza los estados `complete` en
`blender_artist/generated/ve2-buildings/` y compone
`complete-silhouettes-unlabelled.png`. La carpeta es evidencia local ignorada por Git.

## Fuentes de verdad

- `blender_artist/manifests/building-factory.json`: configuración por tipo.
- `tools/art-pipeline/blender/building_factory.py`: compositor modular único.
- `blender_artist/manifests/asset-jobs.json`: 14 candidatos `evidence`; `courtyard_home` conserva
  su job legacy.

Cada preset declara `baseSource`, fachada, cubierta, familia material, plantas, footprint,
señalética, equipo industrial, dressing cívico y desgaste. `baseSource` registra la materia prima
o referencia del diseño; la geometría actual es composición original modular y todavía requiere
QA antes de convertirse en `final source`.

## Límite de V.e.2

V.e.2 sólo acepta la morfología `complete`. Construcción, daño y fuego pertenecen a V.e.3. Los
jobs nuevos permanecen como `target: evidence`; ejecutar la revisión no modifica
`runtime-assets-blender.json` ni el catálogo jugable.
