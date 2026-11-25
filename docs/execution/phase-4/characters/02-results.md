# WP-CHAR-01 · Informe de resultados

Fecha: 2026-11-23. Estado: **fundación técnica implementada; integración Phaser y aprobación
artística pendientes**. No se declara un PASS global: el repo conserva gates rojos previos y el
catálogo visual generado queda desactualizado por una dependencia compartida fuera de alcance.

## A. Estado del repositorio

| Elemento | Valor |
| --- | --- |
| Worktree | `/home/luis/RepositorioGitHub/landlord-wp-char-01` |
| Rama | `wip/wp-char-01-foundation` |
| SHA inicial | `0a6770d183d6fe09529a9eeebee5da2d1d0369a5` |
| SHA funcional/artístico | `b9cf343` |
| Original | `/home/luis/RepositorioGitHub/landlord`, rama `wip/organization-headquarters`, mismo HEAD y limpio |
| Push | No realizado; rama sin publicar |
| Merge/rebase | No realizado |

Commits creados, en orden:

1. `fce5638` — `docs(characters): audit current character pipeline`
2. `1567099` — `feat(characters): reconcile character factory roles`
3. `85c615c` — `feat(characters): add isolated agent visual planner`
4. `5170820` — `test(characters): validate deterministic agent appearances`
5. `b9cf343` — `art(characters): add isolated character candidates`

El SHA del commit documental de cierre se entrega en el mensaje final; un acta no puede contener
su propio hash.

## B. Resultados

### B.1 Character Factory

- 14 variantes canónicas: 6 operativas y 8 ambientales/contextuales.
- Incorporada `medical_professional`, enlazada al runtime existente `chr_medical`.
- Enforcers reclasificados como operativos; las cuatro especialidades literales del dominio se
  conservan sin añadir profesiones públicas.
- Cinco variantes se marcan `runtime_existing` sólo porque el manifiesto runtime y los archivos
  reales pasan hashes: `chr_citizen`, `chr_worker`, `chr_police`, `chr_firefighter` y `chr_medical`.
- `runtimeReady` significa disponibilidad técnica, no aprobación artística. Nueve variantes siguen
  `planned`, con blocker explícito.
- `idle`/`walk` son runtime obligatorios; siete animaciones adicionales quedan `candidate`.
- El validador cruza semántica, IDs, especialidades, categorías, estados, procedencia, jobs,
  matriz de frames y SHA-256. Su selftest versionado rechaza 10/10 declaraciones inválidas.

### B.2 Planificador visual

- `apps/web/src/isometric/agent-visual-plan.ts` traduce `ViewProjectionV3` a planes visuales puros.
- Selección determinista FNV-1a por `agent.id`, independiente de organización, tick y orden del
  inventario.
- Filtra distrito observado y `atBase`; procesa técnico/enforcer sin depender de cuadrillas.
- Conserva rumbo de llegada, interpola el paso autoritativo y mantiene visibles herido/muerto.
- Fallback de marcador con motivo explícito; no usa tintes para fingir profesiones.
- 13 pruebas específicas; suite web completa: 437 pasadas / 4 omitidas.

### B.3 Recursos reutilizados

- Runtime actual: cinco personajes Rocketbox y sus clips `idle`/`walk`.
- Prototipos: `Male_Adult_03` (supervisor), `Male_Adult_05` (obrero) y `Male_Adult_10` (enforcer).
- Blender 5.2.2 LTS, build `d13f752e3b9c`.
- No se descargaron paquetes ni se añadieron dependencias.

### B.4 Prototipos

- 48 PNG: 3 arquetipos × 4 direcciones × 2 animaciones × 2 frames.
- 48 metadata JSON con fuente, licencia, escala, orientación, animación, dimensiones y hashes.
- Validación técnica 48/48, 0 píxeles magenta.
- Tres láminas: raw, gameplay gamma 1,8 y 28 px de alto; todas por debajo de 1 MiB.
- Todos permanecen `candidate`, `approval: pending_human`, `runtimePromotion: false`.

Revisión visual propia: **rework recomendado**. El supervisor lee como administrativo, el obrero
duplica `chr_citizen` y no tiene casco/herramienta, y el enforcer viste un chándal moderno. No se
promueve ninguno. Detalle en `docs/art/characters/PHASE-1-CANDIDATES.md`.

## C. Validación

| Comando | Resultado |
| --- | --- |
| `pnpm art:character-factory:validate` | PASS: 14/14, 5 runtime-existing, 4 direcciones, `idle`/`walk` |
| `node scripts/validate-character-factory.mjs --self-test` | PASS: 10/10 mutaciones inválidas rechazadas |
| `pnpm typecheck` | PASS |
| `pnpm --filter @landlord/web test` | PASS: 437 tests, 4 skipped |
| `pnpm test:architecture` | PASS |
| `pnpm art:blender:check` | PASS: 263 imágenes/jobs, 22.594.162 bytes |
| `pnpm art:licenses:check` | PASS |
| `python3 tools/art-pipeline/blender/characters/validate_phase1_candidates.py` | PASS: 48 frames, 0 errores |
| ESLint de planificador y tests | PASS |
| `git diff --check` | PASS |
| `pnpm art:binaries:check` | FAIL: 135 violaciones, idénticas en el HEAD original; 0 en personajes |
| `pnpm art:catalog:check` | FAIL: `visual-catalog.json is stale`; el generador compartido endurece `/13` y no se tocó |
| `pnpm art:jobs:validate` | FAIL previo: IDs `qa_mini_male`, `qa_mini_female`, `qa_mini_worker` |
| `pnpm test` baseline | FAIL: 21 tests / 13 archivos de simulación; 609 pasados, 20 omitidos |
| `pnpm test` final | FAIL: 21 tests / 13 archivos; 609 pasados, 20 omitidos; lista de fallos idéntica al baseline |

La suite web sí cubre el planificador nuevo. La suite global se detiene en simulación antes de
llegar a web/arquitectura; por eso se ejecutaron también por separado.

### C.1 Fallos baseline de simulación

Archivos rojos antes de editar código:

- `building-reference-lifecycle.test.ts` (1)
- `canonical-state.test.ts` (3)
- `city-seeds.test.ts` (1)
- `district-generation.test.ts` (1)
- `h1-footprint-interaction.test.ts` (2)
- `headquarters.test.ts` (1)
- `market-actionability.test.ts` (1)
- `movement-tick-counter.test.ts` (3)
- `phase4-integration.test.ts` (1)
- `reputation.test.ts` (1)
- `tick-conservation.test.ts` (1)
- `vd7a-multiparcel.test.ts` (4)
- `wp2_15.test.ts` (1)

La corrida final reprodujo los mismos 21 nombres de fallo, en el mismo orden: 0 altas y 0 bajas.
`generate-alpha-fixture.test.ts` reescribió automáticamente
`scripts/fixtures/alpha-phase4.snapshot.json` durante el baseline y la corrida final. El diff se
atribuyó a ese test y se revirtió sólo en el worktree; el hash volvió a coincidir con HEAD
(`3fa10e245309b09383b43ea39c31925a4ef767ab`). No se commiteó ni se regeneró a propósito.

## D. Aislamiento

- El repositorio original permanece limpio en `0a6770d`; no recibió checkout, reset, stash, pull,
  rebase ni edición de archivos.
- Staging y toolchain del original se leyeron por ruta absoluta. Las únicas escrituras de render
  fueron al directorio de candidatos del worktree.
- Diff contra el SHA inicial: 0 archivos protegidos modificados.
- No se tocaron simulación, shared, edificios, manifiestos runtime, escena principal, adapter,
  `crew-presence.ts`, package/lockfile ni documentos centrales.
- No se regeneraron fixtures, snapshots ni capturas de edificios.
- No se cambiaron iluminación, cámara, escala o materiales globales del renderer.

Cambios principales fuera de los 102 archivos de candidatos:

- `blender_artist/manifests/character-factory.json`
- `blender_artist/manifests/character-jobs-phase-1.json`
- `scripts/validate-character-factory.mjs`
- `apps/web/src/isometric/agent-visual-plan.ts`
- `apps/web/src/isometric/agent-visual-plan.test.ts`
- `tools/art-pipeline/blender/characters/{render_phase1_candidates.mjs,validate_phase1_candidates.py,compose_phase1_candidate_sheets.py}`
- `docs/art/characters/{agent-visual-plan.md,PHASE-1-CANDIDATES.md}`
- `docs/execution/phase-4/characters/{01-baseline.md,02-results.md}`

## E. Siguiente fase

1. **Cerrar la fase de edificios antes de integrar.** Después, construir el inventario de
   apariencias desde el manifiesto runtime y conectar `planAgentVisuals` a
   `IsometricSpikeScene.ts`. Reconciliar el pool existente de cuadrillas por `agentId` y conservar
   la visibilidad de base.
2. **Completar los seis operativos definitivos:** supervisor, dos obreros, técnico y dos enforcers.
   La primera pasada muestra que hacen falta wardrobe/props offline; no basta con elegir otro
   tinte.
3. **Animaciones de trabajo, reparación y sabotaje:** curar/retargetear clips Rocketbox, validar
   cuatro direcciones y cadencia, y mantenerlas como candidatas hasta que existan sprites
   comprobados. No añadir especialidades al dominio.
4. **Revisión humana:** aprobar o rechazar cada variante por silueta, vestuario, época, escala,
   contraste y lectura a 28 px antes de cualquier promoción.
5. **Dependencias compartidas que eventualmente necesitarán un WP autorizado:**
   `IsometricSpikeScene.ts`, `crew-presence.ts`, `gameplay-visual-adapter.ts`,
   `scripts/generate-visual-catalog.mjs`, `apps/web/src/generated/visual-catalog.json` y
   `docs/art/CHARACTER-FACTORY.md`. Ninguno se modificó aquí.

El doc histórico `docs/art/CHARACTER-FACTORY.md` aún dice 13 roles y Quaternius como fuente
primaria; queda como deuda documental para el WP de integración.
