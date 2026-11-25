# WP-CHAR-03 — Baseline

Fecha: 2026-11-24. Estado: auditoría inicial completa; intervenciones aún no ejecutadas.

## 1. Git y aislamiento

- Worktree: `/home/luis/RepositorioGitHub/landlord-characters-03`.
- Rama: `wip/wp-char-03-scale-calibration`.
- SHA inicial: `3f012895b922692ca0877812bf643a017a581688`.
- Base: cierre técnico de WP-CHAR-02C.
- WP-CHAR-02C verificado limpio en `3f01289` antes de crear el worktree.
- No se ejecutarán push, merge, rebase, reset, clean ni stash.

## 2. Recursos disponibles

Cinco personajes candidatos:

- Obrero: `docs/art/characters/prototypes/wp-char-02a/worker-reference/final/`.
- Supervisor/enforcer/bombero: `docs/art/characters/prototypes/wp-char-02c/prototypes/<rol>/final/`.
- Policía: `docs/art/characters/prototypes/wp-char-02b/prototypes/police/final/`.

Los tres personajes pendientes tienen 4 idle + 8 walk D0. El obrero tiene 4×9 frames; el policía 4 idle + 8 walk D0. Ninguno está promovido al runtime de producción.

Herramientas reutilizables:

- `tools/art-pipeline/blender/characters/wp_char_02c/render_profession_rework.py`.
- `tools/art-pipeline/blender/characters/wp_char_02a/render_worker_reference.py`.
- `tools/art-pipeline/blender/characters/character_compositor.py`.
- `tools/art-pipeline/blender/runtime_asset.py` y `source_import.py` en modo sólo lectura.

## 3. Contratos visuales confirmados

- Celda lógica: 4 m (`CELL_METERS`, `building-sprites.ts:309`).
- Celda isométrica: 64×32 px (`REFERENCE_LAYOUT`, `coordinates.ts:61`).
- Densidad de mundo: `64 / (4 * sqrt(2)) = 11.313708 px/m`.
- Escala histórica Rocketbox: `CHARACTER_SOURCE_FRAME_PIXELS=256`, `CHARACTER_TARGET_HEIGHT_PIXELS=28`, factor `0.109375` (`visual-scale.ts:2`).
- Producción aplica ese factor a sprites Rocketbox; no es válido asumirlo para PNG Kenney de 512 px con márgenes.
- Pivote de personaje en producción: `(0.5, 0.94)`.
- Profundidad de celda: `(x+y)*1000 + y*10 + x`.
- Cámara producción: zoom inicial 1, rango 0,5–2,5, pan con delta/zoom y zoom anclado al cursor.
- Edificios y vehículos usan pivotes de manifiesto y escala física; no se modificarán.

## 4. Archivos protegidos

No se modificarán simulación/shared, Building Composer, generadores urbanos/edificios, escena principal, `coordinates.ts`, `building-sprites.ts`, `visual-scale.ts`, runtime, manifiestos de producción, Vite/Phaser/Blender globales ni `package.json`/lockfile.

Superficie autorizada:

- `tools/art-pipeline/blender/characters/wp_char_03/`.
- `docs/art/characters/prototypes/wp-char-03/`.
- `docs/execution/phase-4/characters/wp-char-03/`.
- `apps/web/src/character-scale-lab/`.
- `apps/web/char-scale-lab.html`.
- `apps/web/public/qa-character-scale/`.

## 5. Defectos de entrada

- Supervisor: casco con aspecto de boina, gafas claras grandes, clipboard junto a la oreja.
- Enforcer: coleta dominante, rostro sonriente y contraste insuficiente.
- Bombero: casco con silueta de motocicleta, gafas claras y franjas estrechas.
- Obrero y policía: controles favorables; no se modificarán sin regresión demostrable.

## 6. Pruebas previas

WP-CHAR-02C dejó baseline:

- Typecheck, arquitectura, Character Factory, web, shared, Blender, licencias y runtime assets en verde.
- Frames 02C: 488 checks; láminas: 161; evidencia: 456.
- Gates rojos conocidos: binarios 135, catálogo stale, jobs `qa_mini_*`, lint 37, style layer 13 bandas, simulación 20/12.
- Estos resultados son baseline, no pruebas ejecutadas todavía en WP-CHAR-03.

## 7. Siguiente paso

Corrección artística progresiva: una pose idle, una walk y una orientación por personaje, con comparación antes/después. El lote completo esperará a validar cada defecto.
