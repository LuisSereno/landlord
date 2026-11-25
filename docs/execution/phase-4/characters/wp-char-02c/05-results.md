# WP-CHAR-02C — Acta final

Fecha: 2026-11-24.

## 1. Identidad Git

- Worktree: `/home/luis/RepositorioGitHub/landlord-characters-02c`.
- Rama: `wip/wp-char-02c-visual-rework`.
- SHA inicial: `3b64d35f55a1507581704ed6f89206d8d0b4890e`.
- SHA final de arte, pruebas y evidencia: `c79f663aed6ee314af744a1c9fb6b8a10e33a63e`.
- El commit de cierre documental es posterior a ese SHA y no cambia renders ni metadatos de arte.
- Push: **no realizado**.
- Merge/rebase/reset/clean/stash: **no realizados**.

Commits:

1. `ff69e73` — `docs(characters): diagnose WP-CHAR-02B head artifacts`
2. `1a9f148` — `art(characters): rework supervisor head and identity`
3. `5c6968e` — `art(characters): correct enforcer appearance`
4. `a4a114d` — `art(characters): rebuild firefighter identity`
5. `c79f663` — `test(characters): validate corrected profession candidates`

## 2. Entregables

- Diagnóstico A/B/C de cabeza con renders originales, candidatos 02B, controles sin accesorios y mapas de materiales/piezas.
- Tres candidatos corregidos con 12 frames nuevos cada uno: **36 frames**.
- Policía conservado con sus 12 frames originales.
- Obrero de WP-CHAR-02A conservado como referencia.
- 12 láminas finales de revisión más tres láminas de diagnóstico y tres smoke sheets.
- Metadatos por candidato y hash por imagen.
- Validadores locales de frames, paquete visual y evidencia agregada.
- Documentación `01`–`05` y `PROGRESS.md`.

## 3. Personajes y modelos

| Personaje | Base final | Resultado local |
|---|---|---|
| Supervisor | `character-male-e.glb` | Pelo local sin mancha, casco de capataz ampliado, chaleco y clipboard |
| Enforcer | `character-raider.glb` | Sin círculo ni barba dominante; gorra integrada y chaqueta robusta |
| Bombero | `character-male-a.glb` | Sin barba; casco dominante, visera/reborde y uniforme con franjas |
| Policía | `character-male-c.glb` | Control conservado, sin regeneración |
| Obrero | `character-worker.glb` | Referencia conservada |

## 4. Resultados técnicos

- Frames nuevos: **36/36**, hashes globalmente únicos.
- Validación de frames: **488 checks, 0 errores**.
- Validación de láminas: **161 checks, 0 errores**.
- Control 02B revalidado: **542 checks, 0 errores**.
- Todas las láminas <1 MiB.
- 0 recortes de cámara, suelo Z=0, action slot enlazado.
- Deriva máxima de accesorio: `1.490116e-7 m`.
- Atlas empaquetados y GLB fuente sin cambios.
- Typecheck: PASS.
- Arquitectura: PASS.
- Character Factory: PASS 14/14.
- Web: 437 passed / 4 skipped.
- Shared: 81 passed.
- Blender integridad: 263 imágenes / 263 jobs.
- Licencias: PASS.
- Runtime assets: PASS, 108 imágenes / 153880 bytes.
- Escalera de valor render: PASS.

## 5. Gates rojos y atribución

No se declara PASS global.

| Gate | Resultado | Atribución |
|---|---|---|
| `art:binaries:check` | 135 violaciones | Baseline histórico; 0 nuevas de 02C, medido tras commitear |
| `art:catalog:check` | `visual-catalog.json is stale` | Baseline conocido; catálogo compartido no tocado |
| `art:jobs:validate` | 3 IDs `qa_mini_*` | Baseline conocido; manifiestos de jobs no tocados |
| `lint` | 37 errores | Reproducido idéntico en WP-CHAR-02B; 0 en archivos 02C |
| `art:style:check` | 13 bandas vacías | Reproducido idéntico en WP-CHAR-02B |
| Simulación | 20 fallos / 12 archivos atribuidos | Baseline conocido; diff de simulación vacío |

La suite completa de simulación terminó inicialmente con 21 fallos/13 archivos porque `headquarters.test.ts` agotó 120 s bajo concurrencia de gates. Repetido aislado: **4/4 PASS en 85,20 s**. El fallo extra fue contención, no regresión de WP-CHAR-02C.

La prueba reescribió `scripts/fixtures/alpha-phase4.snapshot.json`; se restauró byte a byte desde HEAD y no forma parte de ningún commit.

## 6. Resultado visual

- Supervisor: mancha blanca ausente; casco y clipboard comunican capataz.
- Enforcer: círculo negro y barba dominante ausentes; silueta oscura robusta distinta del policía.
- Bombero: casco 86% del ancho de cabeza y ala 95%; uniforme protector visible.
- Familia: cinco personajes Kenney coherentes, con direcciones y marcha estables.
- Prueba sin etiquetas y escala 0,5×/1×/2×/2,5× disponibles para revisión humana.

Estado máximo: **`TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING`**.

No se declara `ARTISTIC_APPROVED` ni `RUNTIME_READY`.

## 7. Archivos modificados

Sólo rutas autorizadas:

- `tools/art-pipeline/blender/characters/wp_char_02c/`
- `docs/art/characters/prototypes/wp-char-02c/`
- `docs/execution/phase-4/characters/wp-char-02c/`
- `blender_artist/manifests/character-experiments-02c.json`

## 8. Aislamiento confirmado

- Repositorio original: limpio en `0a6770d183d6fe09529a9eeebee5da2d1d0369a5`.
- WP-CHAR-02A: limpio en `c4bc0411949754b3e71c66e6e95c838481b866fb`.
- WP-CHAR-02B: limpio en `3b64d35f55a1507581704ed6f89206d8d0b4890e`.
- Diff de simulación/shared, Phaser, edificios, runtime y manifiestos protegidos: vacío.
- Evidencias de WP-CHAR-02A/02B: sin cambios.
- Sin descargas, sin generación externa, sin promoción runtime.

## 9. Pendiente

1. Revisión visual humana de supervisor, enforcer y bombero.
2. Decisión de autorizar rework, solicitar ajustes o marcar `REWORK_REQUIRED`.
3. No producidos: los otros nueve personajes del catálogo de catorce.
4. No evaluados: animaciones de trabajo/reparación/sabotaje.
5. No integrados: Phaser, atlas, FPS, runtime.

## 10. Enlaces de revisión

- [Familia ampliada](../../../../art/characters/prototypes/wp-char-02c/review/05-five-family.png)
- [Familia a 28 px](../../../../art/characters/prototypes/wp-char-02c/review/06-five-family-28px.png)
- [Prueba sin etiquetas](../../../../art/characters/prototypes/wp-char-02c/review/11-unlabeled-professions.png)
- [Bombero antes/después](../../../../art/characters/prototypes/wp-char-02c/review/03-before-after-firefighter.png)
- [Revisión visual detallada](04-visual-review.md)
- [Producción y hashes](03-production.md)
