# WP-CHAR-02B · Informe final de resultados

Fecha: 2026-11-24. Estado: **TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING**.

## A. Repositorio

| Elemento | Valor |
| --- | --- |
| Worktree | `/home/luis/RepositorioGitHub/landlord-characters-02b` |
| Rama | `wip/wp-char-02b-kenney-coverage` |
| SHA inicial | `c4bc0411949754b3e71c66e6e95c838481b866fb` |
| SHA funcional/artístico | `e96918f` |
| Original | `/home/luis/RepositorioGitHub/landlord`, `0a6770d`, limpio |
| Push | No realizado |
| Merge / rebase / reset / stash | No realizados |

Commits de WP-CHAR-02B, en orden:

1. `ca86d7a` — `docs(characters): audit Kenney character inventory`
2. `00b4aa2` — `docs(characters): map Kenney coverage to Landlord roles`
3. `0cfb293` — `art(characters): prototype four professional archetypes`
4. `e96918f` — `test(characters): validate profession review package`

El SHA del commit documental de cierre se entrega en el mensaje final; un acta no puede contener su
propio hash.

## B. Resultado principal

- Inventario real de **20/20 GLB** de Kenney Mini Characters.
- Clasificación: **8 SUITABLE**, **8 ADAPTABLE**, **4 UNSUITABLE**, 0 UNVERIFIED.
- Catálogo ampliado y catálogo a 28 px.
- Matriz de cobertura de los **14 personajes canónicos**: 8 DIRECT, 4 MINOR_ADAPTATION,
  2 MESH_ADAPTATION, 0 UNRESOLVED técnicos.
- Cuatro prototipos: supervisor, enforcer, policía y bombero.
- **48 frames**: 4 idle + 8 walk en dirección principal por candidato.
- **13 láminas**: 2 catálogos + 11 comparativas, incluida página sin etiquetas.
- Recomendación: **KENNEY_WITH_TARGETED_CUSTOM_MESHES**.

No se produjeron los otros nueve personajes. No se promocionó ningún recurso a runtime.
`runtimePromotion` permanece `false`.

## C. Modelos utilizados

| Candidato | Modelo base | Adaptación |
| --- | --- | --- |
| Supervisor | `character-male-e.glb` | Materiales sobre malla skineada, casco claro y clipboard |
| Enforcer | `character-male-g.glb` | Paleta carbón, gorra y cinturón |
| Policía | `character-male-c.glb` | Uniforme/gorra integrados, insignia y cinturón |
| Bombero | `character-male-b.glb` | Materiales protectores, bandas reflectantes y casco de bombero propio |

El obrero de referencia sigue siendo `character-worker.glb` de WP-CHAR-02A, aprobado por el
propietario como dirección de estilo, no como asset runtime.

## D. Validación

| Control | Resultado |
| --- | --- |
| Catálogo Kenney | PASS: 353 comprobaciones, 0 errores |
| Prototipos profesionales | PASS: 542 comprobaciones, 0 errores |
| Paquete de 13 láminas | PASS: 98 comprobaciones, 0 errores |
| Manifiesto agregado | PASS: 592 comprobaciones, 0 errores; 181 evidencias y 22 fuentes |
| Character Factory | PASS: 14/14 |
| Arquitectura | PASS |
| Typecheck | PASS |
| Suite web | PASS: 437 tests, 4 skipped |
| Blender runtime | PASS: 263 imágenes/jobs |
| Licencias | PASS |
| `git diff --check` | PASS |
| Aislamiento de rutas | PASS: 0 archivos fuera de las rutas autorizadas |

Gates preexistentes que siguen rojos, sin archivos nuevos de WP-CHAR-02B:

- `art:binaries:check`: **135 violaciones históricas**, 0 nuevas.
- `art:catalog:check`: catálogo visual obsoleto 13/14.
- `art:jobs:validate`: IDs `qa_mini_male`, `qa_mini_female`, `qa_mini_worker`.
- Simulación: no se reejecutó la suite completa; el código de simulación/shared es idéntico a 02A y
  conserva su baseline documentado de 20 fallos/12 archivos.

## E. Evidencia

- [Inventario](01-kenney-inventory.md).
- [Cobertura de 14 roles](02-role-coverage.md).
- [Viabilidad de producción](03-production-feasibility.md).
- [Revisión visual](04-visual-review.md).
- [Catálogo ampliado](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog.png).
- [Catálogo 28 px](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog-28px.png).
- [Familia de cinco](../../../../art/characters/prototypes/wp-char-02b/review/07-five-family.png).
- [Cuatro direcciones](../../../../art/characters/prototypes/wp-char-02b/review/08-four-directions.png).
- [Muestras de marcha](../../../../art/characters/prototypes/wp-char-02b/review/09-walk-samples.png).
- [Escalas](../../../../art/characters/prototypes/wp-char-02b/review/10-scales.png).
- [Calle offline](../../../../art/characters/prototypes/wp-char-02b/review/11-street-context-offline.png).
- [Siluetas](../../../../art/characters/prototypes/wp-char-02b/review/12-silhouettes.png).
- [Sin etiquetas de profesión](../../../../art/characters/prototypes/wp-char-02b/review/13-unlabeled-professions.png).
- [Manifiesto agregado](../../../../art/characters/prototypes/wp-char-02b/evidence-manifest.json).
- [Validación agregada](../../../../art/characters/prototypes/wp-char-02b/evidence-validation.json).

## F. Defectos y dependencias pendientes

- Revisión humana de los cuatro candidatos; ninguno está aprobado.
- Enforcer oscuro: validar contraste y lectura a 28 px.
- Bombero con barba: validar que el casco/traje profesional domine sobre el ciudadano robusto.
- Supervisor: validar casco y clipboard a escala pequeña.
- Rig de siete huesos: limitado para trabajo, reparación y sabotaje.
- Enforcer B no está producido; requiere retirar las pistolas integradas de `female-a` y resolver
  chaqueta pesada skineada.
- No hay integración Phaser, atlas, FPS ni promoción runtime.
- La composición urbana es offline, no una captura de Phaser.

## G. Aislamiento

- Sólo se modificaron las rutas autorizadas de WP-CHAR-02B.
- No se tocó simulación, shared, edificios, Building Composer, renderer principal, Character Factory,
  manifiestos runtime ni assets públicos.
- `package.json` y `pnpm-lock.yaml` permanecen sin cambios.
- El original y el worktree de WP-CHAR-02A no se modificaron.

## H. Recomendación para la siguiente fase

Adoptar **KENNEY_WITH_TARGETED_CUSTOM_MESHES** como estrategia de producción. Primero revisar
humanamente los cuatro prototipos; después producir los ocho DIRECT, los cuatro MINOR_ADAPTATION y
resolver Enforcer B/ajuste final del bombero. Las animaciones de trabajo deben evaluarse por separado.
No expandir a los otros nueve ni promover nada a runtime sin una autorización explícita.
