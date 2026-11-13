# D-100 — Presupuesto de binarios: bundle runtime a 10 MiB y evidencia QA con excepciones nombradas

Estado: aceptada el 2026-11-06 por el responsable (WP4.15-V.i). Corrige D-081.

## Contexto medido

`pnpm art:binaries:check` (D-081) quedaba rojo en dos dimensiones al cerrar el catálogo 15/15:

- Bundle `apps/web/public/assets/runtime/blender`: **9.372.434 B** > `maxBundleBytes` 8.388.608.
  Desglose: edificios promoted 4.754.679 B (16 PNG), legacy `bld_*` 1.028.608 B (24 PNG, excluidos de
  gameplay pero referenciados por `runtime-assets-blender.json` y Art Lab), vehículos 844.147 B,
  actores/otros 2.745.000 B. El valor de 8 MiB salía de la proyección Fase 2 de
  `blender_artist/manifests/asset-metrics.json` (3,9 MB a 256px / 14 MB a 512px), anterior al catálogo
  completo.
- Por fichero: evidencia QA permanente >1 MiB sin excepción (láminas de selección V.i, golden de
  contexto urbano del Composer, pixel-qa de distritos V.h, showcase de dressing V.g) y `attempts/`
  trackeados pese a que su `.gitignore` los declara staging/diagnóstico, no evidencia promoted.

Palancas descartadas con motivo: podar el legacy `bld_*` dejaba holgura de ~44 KB y rompía Art Lab /
manifiesto; bajar la resolución de render obligaba a regenerar y re-aprobar los 15 edificios y los sha
fijados; post-procesar los runtimeImage rompía la copia verbatim (sha runtime == sha candidato).

## Decisión

1. `maxBundleBytes` = **10.485.760 (10 MiB)** en `docs/art/BINARY-ALLOWLIST.json`, alineado con el
   budget de 10 MB ya versionado en `apps/web/src/blender-assets.test.ts`. `maxBinaryBytes` individual
   (1 MiB) no cambia. Cambiar la resolución de render sigue exigiendo decisión explícita.
2. `attempts/` de los catálogos salen del índice Git (los ficheros permanecen en disco como staging);
   `.gitignore` con `*` y `!.gitignore` en cada raíz de attempts.
3. Excepciones nombradas en `BINARY-ALLOWLIST.json` para la evidencia QA permanente >1 MiB listada en
   el Contexto (19 rutas con razón). Añadir excepciones sigue siendo un acto visible en revisión.
4. Git LFS y atlas/texture packing continúan como requisitos de Beta con el gate de reapertura medido
   de D-081 (perfil denso <55 FPS o >64 texturas).

## Consecuencias

- `pnpm art:binaries:check` verde con el catálogo 15/15 y la evidencia revisada intacta.
- Ningún arte aprobado se regenera ni se post-procesa; la promoción reproducible no cambia.
- La fase de estados (construction/damaged/burning) deberá revisar este presupuesto con datos nuevos
  antes de añadir binarios: 10 MiB no es holgura ilimitada.