# Verificación de cierre de catálogo — 2026-11-25

## Gates técnicos completados

| Gate | Resultado |
| --- | --- |
| `art:jobs:validate` | 80 jobs, 0 inválidos |
| `art:runtime-references:check` | 1.173 referencias / 1.173 archivos, 0 ausentes, 0 huérfanos, 0 hashes divergentes |
| `art:character-factory:validate` + self-test | 14/14 candidatos Kenney; 13/13 mutaciones inválidas rechazadas |
| Coherencia del catálogo generado | 17/17 edificios; 26/102 estados; 14/14 personajes; 0/14 previews runtime |
| Smoke WP-CHAR-04 | 14 roles, 28 frames, 1.528 comprobaciones, 0 errores/advertencias |
| Comparación B/D densa | 4 capturas, 0 errores; B recomendado técnicamente |
| Depósito municipal | 12/12 pruebas específicas; baseline sin depósito exacto; save/load v3; smoke Composer 4 m válido |
| Depósito Composer | 48 candidatas, matriz y hashes válidos; 8/8 pruebas de gate |
| PNG del depósito | 48/48 RGBA, dimensiones/alfa/pivote/escala válidos; 48 hashes únicos |
| Gameplay del depósito | 144/144 capturas, tres zooms, 0 errores de página; 144 hashes únicos |
| Fixtures generador v5 | 12 ciudades, 12 distritos y 10 digestos medidos |
| Web | 459 passed / 4 skipped |
| Shared | 81 passed |
| Typecheck | PASS |
| Arquitectura | PASS |
| Build web y laboratorio | PASS |
| Licencias | PASS |
| Blender runtime integrity | 263 imágenes/jobs, 22.594.162 B |
| Composer | 18 gramáticas, 15 promociones, 4 candidatos WP06; válido |
| Composer candidatos/geometría | firmas históricas restauradas y 4/4 controles + geometría en verde |
| Sedes Composer | 96 candidatas, matriz y hashes válidos; 8/8 pruebas de gate |
| PNG de sedes | 96/96 RGBA, dimensiones/alfa/pivote/escala válidos; 96 hashes únicos |
| Gameplay de sedes | 288/288 capturas, dos identidades, tres zooms, 0 errores de página; procedencia válida |
| Catálogo visual browser | 17 edificios, 26 estados, 14 personajes, 16 capturas, 0 errores |
| Enlaces del cierre | 13 Markdown, 0 rotos; 2/2 pruebas del guard |
| Enlaces globales | 29 rotos preexistentes fuera del cierre; no se modifican en este encargo |
| Procedimiento PNG local | `docs/art/ART-PIPELINE.md` §44; sin promoción runtime |
| Binarios | 1.798 archivos, 168 excepciones nombradas; bundles 22.594.162 B y 853.314 B, PASS |
| Lint global | FAIL preexistente: 51 incidencias en 18 archivos sin cambios en este trabajo; lint de los archivos del paquete PASS |

## Simulación

La suite completa inicial dio 22 fallos. El worktree baseline `116b6e0` reprodujo 18. Los cinco
nuevos se corrigieron en `2d79e72` y la fixture Alpha se regeneró en `c2204d5`. La repetición final
sobre v5 dio 17 fallos: todos están en la lista baseline y el triplete de acería de la seed 2026 ya
pasa. No hay regresiones nuevas; los 17 restantes siguen siendo deuda previa en
`building-reference-lifecycle`, `canonical-state`, `h1-footprint-interaction`, `headquarters`,
`market-actionability`, `movement-tick-counter`, `phase4-integration`, `reputation`,
`vd7a-multiparcel` y `wp2_15`.

## Commits locales

- `c563c62`: cobertura visual 17/17, allowlist binaria y retirada de renders obsoletos.
- `4143c42`: 96 candidatas de sedes, 288 capturas y gate de procedencia sin promoción runtime.
- `0467a13`: 48 candidatas del depósito, 144 capturas y gate de procedencia sin promoción runtime.

## Gates humanos

- Aprobación visual de los 14 personajes Kenney: PENDIENTE.
- Ratificación de B frente a D: PENDIENTE.
- Revisión de sedes y depósito en ciudad: PENDIENTE.
- Playtest humano V.d: `PENDING HUMAN PLAYTEST`.

Ningún gate automático sustituye estas aprobaciones.
