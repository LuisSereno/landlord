# WP4.15 — Pipeline artístico y escalado de contenido

## Estado

`DONE` el 2026-10-25 sobre `88ce688`. Entrega el contrato runtime de assets v1, la factoría procedural
determinista, la integración de edificios en Phaser con pivote y depth desde metadatos, la galería y
animación de personajes en el Art Lab, la validación en CI y la medición de budgets. El arte final en
Blender queda como fuente de producción con el mismo contrato. Decisión en
`docs/engineering/adr/D-080-contrato-assets-y-factoria.md` y manual en
`docs/art/RUNTIME-ASSETS.md`.

## Baseline

- HEAD inicial: `88ce688` (`feat: add internal balance tools and versioned dataset (WP4.14)`), CI
  remoto verde.
- Restricción vigente: sin binarios de terceros versionados ni Git LFS configurado (D-054).

## Entregado

### Contrato de assets v1

- `packages/shared/src/assets.ts`: esquema Zod y tipos para manifiesto, imágenes con SHA-256,
  edificios con huella/pivote/cuatro estados, personajes con 4/8 direcciones y `idle`/`walk`, y
  provenance del generador.
- Validación permanente en `apps/web/src/assets.test.ts`: esquema, hashes recalculados, los cinco
  edificios × cuatro estados, dos variantes de personaje, determinismo de la factoría y budget.

### Factoría procedural

- `scripts/generate-runtime-assets.mjs`: SVG originales deterministas para todos los estados y
  personajes; manifiesto con data URIs en `apps/web/src/generated/runtime-assets.json`.
- `--check` falla si el manifiesto versionado no coincide con la factoría (sin ediciones manuales).
- Budgets medidos: 68 imágenes, manifiesto de 106 KB, cada SVG < 2 KB.

### Integración Phaser y Art Lab

- `IsometricSpikeScene` compila las texturas del manifiesto y pinta un sprite por edificio y sitio de
  obra, con pivote normalizado y depth isométrico; los estados `complete/construction/damaged/burning`
  se eligen desde la proyección y el rectángulo de respaldo desaparece al cargar.
- Helpers puros en `apps/web/src/isometric/building-sprites.ts` con tests de estado, depth, pivote y
  dirección.
- `ArtLab` añade la galería de la factoría (5 edificios × 4 estados), dos personajes animados
  (`idle`/`walk`, 8 y 4 direcciones) y el modo denso `?density=N`.

### Medición

- `pnpm art:visual`: captura del Art Lab (468 KB PNG) y SHA-256
  `3e962b052ddbc70929665eb8994d1c0d679a5750262f763b9b1765e158d416b3`; baseline versionado en
  `docs/art/golden/art-lab-runtime-assets.sha256` con comparación estricta opt-in.
- `pnpm art:profile`: 400 sprites a 60 FPS estables (DOM). El frame del juego sigue midiéndose con
  `pnpm benchmark:browser`.
- `pnpm smoke:art-lab`: 3 direcciones + 5 edificios × 4 estados + 2 personajes cargan sin errores.
- `pnpm smoke:phase2` y `pnpm smoke:alpha`: verdes con los sprites integrados (caja del smoke sin
  cambios: `5228 u.` y `49850 u.`).

## Verificación

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: verdes.
- Suite: 330 tests pasan, 8 skipped (simulación 302 + web 28; incluye 5 de assets y 5 de sprites).
- CI remoto: verde sobre `57660ef` (run 40212653834). El smoke del Art Lab se añade al workflow
  en el commit posterior y queda cubierto por CI desde entonces.

## No incluido

- Sustitución de los placeholders por renders Blender finales: el contrato está listo y el pipeline
  documentado; no se versionan binarios ni se ejecuta Blender en CI.
- Integración de personajes en la escena jugable y LOD de personaje: el Art Lab ya anima ambas
  variantes; la escena conserva el blitter hasta medir la cámara y el presupuesto de frame.
- Atlas raster empaquetado: Alpha usa una textura por frame SVG; el atlas binario queda para el arte
  final con la misma metadata y una decisión de almacenamiento (LFS).
