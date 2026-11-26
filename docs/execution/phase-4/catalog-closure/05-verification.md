# Verificación de cierre de catálogo — 2026-11-25

Actualización de activación: 2026-11-26. Estado: `APPROVED_PROMOTED_VERIFIED_IN_GAME`.
Luis aprobó globalmente los 14 personajes Kenney, la configuración B, ambas sedes, el depósito y el
montón del patio. La aprobación está registrada en `04-human-review.md`; ningún test la sustituye.

## Personajes Kenney

| Gate | Resultado |
| --- | --- |
| `art:character-factory:validate` | PASS: 14/14 Kenney runtime-ready y human-approved |
| Self-test Character Factory | PASS: 14/14 mutaciones inválidas rechazadas |
| Coherencia catálogo generado | PASS: 14/14 definiciones y 14/14 runtime-ready |
| Smoke canónico `2026-11-25-smoke-15` | PASS: 28/28 frames, 1.528 comprobaciones, 0 errores/advertencias |
| Contrato del batch | PASS: 6/6 pruebas; 14×4×(1 idle+8 walk)=504 |
| `batch-03` frames | PASS: 504/504, 504 hashes únicos, 13.353 comprobaciones, 0 errores |
| `batch-03` lámina y validación final | PASS: 13.894 comprobaciones, 0 errores; 14 avisos walk-0=idle |
| Promoción runtime | PASS: 504 PNG en `characters-kenney/`, 14 contratos en ambos bundles |
| Captura Phaser a 34 px | PASS: 16 capturas, 14 roles, 0 errores de página |

`batch-01-failed-framing` y `batch-02-failed-accessory-drift` se conservan locales como evidencia
histórica. `batch-03` corrige clipping, drift por acción, soporte corporal y hashes de atlas sin
cambiar la apariencia de `smoke-15`.

## Edificios

| Gate | Resultado |
| --- | --- |
| Auditoría reproducible de sedes | PASS: 96/96 PNG, 96 hashes únicos, 288/288 capturas, 0 errores |
| Auditoría reproducible del depósito | PASS: 48/48 PNG, 48 hashes únicos, 144/144 capturas, 0 errores |
| Building Composer | PASS: 18 gramáticas, 15 promociones, 4 perfiles; 52/52 mutaciones; geometría 300/300 |
| Promoción de matrices | PASS: 432 variantes diurnas + 432 nocturnas |
| Validadores canónicos HQ/depósito | PASS con aprobación humana registrada y runtime protegido |
| Suites HQ/depósito | PASS: 8/8 + 8/8 |

Las 23 advertencias de borde de sedes y 30 del depósito quedan registradas para revisión visual;
no son fallos de RGBA, hash, fuente o licencia.

## Verificación dentro del juego

Evidencia: `docs/art/world-activation-2026-11-26/manifest.json` y 13 PNG en la misma carpeta.
El arnés inyecta una fixture QA en la ciudad Phaser real, pero resuelve los sprites por los
manifiestos runtime de producción.

- Día/noche: `complete`, `foundation`, `structure`, `finishing`, `damaged` y `burning`.
- Edificios: `headquarters_cupola`, `headquarters_courtyard` y `cleaning_depot` con orientaciones
  0/180/90 y texturas runtime visibles.
- Personajes: cuadrilla de supervisor + dos trabajadores en idle/walk, día y noche.
- Carga: 0 errores de página; referencias runtime 1.902/1.902, sin ausentes/huérfanos/hashes
  divergentes.
- Caché de variantes: máximo **71.597.816 B** (<96 MiB); purga el mood opuesto al conmutar.
- Caché de personajes: máximo **39.845.888 B** (<96 MiB); carga perezosa por grupo y calibración
  por frame a 34 px.
- Frame time en rasterizador software: día p50 83,3 ms / p95 83,4 ms; noche p50 100,1 ms /
  p95 133,2 ms. No se declara gate de 60 FPS sin GPU.
- Save/load IndexedDB: SnapshotV3, caja conservada y SHA-256 del snapshot idéntico antes/después
  de cargar. El Worker reanuda el reloj por diseño; el delta de tick del navegador es informativo.
- Determinismo de modelo denso: 3/3 pruebas de integración (1 skip opt-in), incluido mismo estado →
  mismo mundo.

## Gates técnicos globales

| Gate | Resultado |
| --- | --- |
| `art:jobs:validate` | PASS: 81 jobs |
| `art:licenses:check` | PASS en los tres bundles |
| Blender noche | PASS: 771 imágenes/jobs |
| Blender día | PASS: 771 imágenes/jobs; 72 frames de entorno regenerados |
| Typecheck web / arquitectura / lint focalizado | PASS |
| Build web | PASS |
| Suite web | PASS: 464 passed / 4 skipped |
| Suite shared | PASS: 81/81 |
| Dominio `headquarters` | PASS: 4/4, incluido barrido de 60 seeds aislado |
| Enlaces de documentación | PASS: 13 Markdown, 0 rotos |
| Presupuesto binario | PASS: 1.798 binarios, 169 excepciones |
| Formato / `git diff --check` | PASS |

## Pendientes ajenos a la activación

- El playtest humano V.d sigue `PENDING HUMAN PLAYTEST`.
- La validación FPS en GPU sigue pendiente; la máquina actual usa rasterizador software.
