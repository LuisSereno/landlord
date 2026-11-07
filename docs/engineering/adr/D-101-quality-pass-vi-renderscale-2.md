# D-101 — Quality pass V.i: renderScale 2 global y presupuesto de binarios a 23 MiB

Estado: aceptada el 2026-11-07 por el responsable (WP4.15-V.i). Corrige D-100.

## Contexto medido

Petición humana tras la revisión de píxeles V.i: a zoom ×4 casi todos los edificios se veían
pixelados. La densidad de píxeles por metro (60.2 px/m a renderScale 1) era insuficiente para el
zoom ×4 in-game. Palancas consideradas:

- **renderScale=2** en las 15 gramáticas del Building Composer: duplica la densidad final (120.4 px/m
  efectivos a zoom ×4) sin cambiar la composición. El supersample efectivo baja a 1 (64 muestras TAA
  a resolución final); el pase de sombra mantiene 3× el principal. Presupuesto absoluto de píxeles
  constante (evita el crash de EEVEE a 185M píxeles).
- Bajar la resolución de render obligaba a regenerar y re-aprobar los 15 edificios; descartado.
- Post-procesar los runtimeImage rompía la copia verbatim (sha runtime == sha candidato); descartado.

Medición tras el quality pass:

- Bundle `apps/web/public/assets/runtime/blender`: **22.753.635 B** > `maxBundleBytes` 10.485.760.
  Desglose: edificios promoted 18.026.812 B (15 PNG a renderScale 2), legacy `bld_*` 1.028.608 B,
  vehículos 844.147 B, actores/otros 2.745.000 B.
- Por fichero: 12 PNG >1 MiB sin excepción (6 candidatos quality-vi + 6 runtime PNGs).

## Decisión

1. **renderScale=2** en las 15 gramáticas del Building Composer (`blender_artist/manifests/building-composer-grammars.json`).
   La copia runtime sigue siendo verbatim (sha runtime == sha candidato) y bajar la resolución de
   render continúa exigiendo decisión explícita.
2. `maxBundleBytes` = **24.117.248 B (23 MiB)** en `docs/art/BINARY-ALLOWLIST.json`, alineado con el
   budget de 23 MB ya versionado en `apps/web/src/blender-assets.test.ts`. `maxBinaryBytes` individual
   (1 MiB) no cambia.
3. Excepciones nombradas en `BINARY-ALLOWLIST.json` para los 12 PNG >1 MiB (6 candidatos quality-vi +
   6 runtime PNGs) con razón. Añadir excepciones sigue siendo un acto visible en revisión.
4. **Restauración de la composición V7 del town_hall** (firma `d440472588e657f4bd94ce4993532095782b7b6524efe39496a9eb076db11fbb`):
   el pin P2 (`secondaryIds:["none"]` en la receta hero `grand_neoclassical_hall`, commit `37592d4`
   V.g civic-core) desplazó los sorteos PRNG tras la aprobación V7 y cambió la composición (pierde
   las columnas esquineras, ritmo pasa de `tall_aisles@5` a `tall_aisles@7`) sin aprobación humana.
   Revertido: se elimina `secondaryIds` de la receta hero y la opción `"none"` del pool
   `secondaryOptions` del town_hall. El seed aprobado 1006 vuelve a resolver `corner_columns` /
   `tall_aisles@5` con la firma promovida exacta. `test_vg_recipe_model.py` test_19 pasa a fijar la
   composición V7 aprobada en vez del pin P2.
5. **Fix de paridad en `deterministic_crop_rect`** (`tools/art-pipeline/blender/building_composer/scene.py`):
   la paridad del recorte es de `trim_and_scale` según su supersample efectivo, no de
   `deterministic_crop_rect`. El ajuste de paridad previo con fallback erróneo colapsó el recorte del
   clinic a 1 px cuando la caja saturada (una sombra cuyo punto de fuga sale del lienzo) tenía lado
   impar — fue el fallo §18 del clinic a renderScale 2. Eliminado el bloque de paridad duplicado.

## Consecuencias

- `pnpm art:binaries:check` verde con el catálogo 15/15 a renderScale 2 y la evidencia revisada intacta.
- Los 15 edificios se ven nítidos a zoom ×4 in-game (densidad ×2, firma de composición idéntica).
- El town_hall V7 (columnas esquineras, ritmo `tall_aisles@5`) se preserva como APPROVED BASELINE.
- La fase de estados (construction/damaged/burning) deberá revisar este presupuesto con datos nuevos
  antes de añadir binarios: 23 MiB no es holgura ilimitada.
