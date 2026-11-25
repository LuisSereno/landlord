# WP-CHAR-02A · Informe final de resultados

Fecha: 2026-11-24. Estado: **CIERRE TÉCNICO COMPLETO / REVISIÓN ARTÍSTICA HUMANA PENDIENTE**.

## A. Repositorio

| Elemento | Valor |
| --- | --- |
| Worktree | `/home/luis/RepositorioGitHub/landlord-characters-02a` |
| Rama | `wip/wp-char-02a-visual-reset` |
| SHA inicial | `99c1d45786d18d6a84ce1955a13f7fee9a713837` |
| SHA funcional/artístico | `1e91d22` |
| Original | `/home/luis/RepositorioGitHub/landlord`, `0a6770d`, limpio |
| Push | No realizado |
| Merge / rebase / reset / stash | No realizados |

Commits de WP-CHAR-02A, en orden:

1. `59d616e` — `docs(characters): diagnose WP-CHAR-02A animation and clothing`
2. `3332421` — `art(characters): compare WP-CHAR-02A source bases`
3. `1e91d22` — `art(characters): produce WP-CHAR-02A worker reference`

El SHA del commit documental de cierre se entrega en el mensaje final; un acta no puede contener su
propio hash.

## B. Resultado principal

Se produjo **un único obrero de construcción estilizado**, variante A, sobre Kenney
`character-worker.glb`:

- ropa, casco y calzado integrados en la fuente;
- 4 direcciones;
- una pose idle y ocho muestras de walk por dirección;
- 36 frames RGBA de 512×512;
- root motion 0 y cierre de ciclo exacto;
- pie de apoyo alineado a Z=0;
- silueta de 19 px de ancho a 28 px de alto;
- nueve láminas de revisión, incluida composición urbana offline.

No se generaron supervisor, segundo obrero, técnico ni enforcers. No se promocionó ningún sprite a
runtime. `runtimePromotion` permanece `false`.

## C. Diagnósticos cerrados

### Animación

La marcha anterior no tenía un rig roto. El clip Rocketbox es root-motion: recorre 1,247305 m en XY
y desplaza al avatar fuera de cámara. `apply_animation_clip()` sólo seleccionaba inicio y punto
medio; `Walk1` era frame 17, no una muestra representativa del ciclo. La corrección aislada elimina
la traslación, alinea el pie y cierra el ciclo con 1e-6 m de delta.

Documento: [01-animation-diagnosis.md](01-animation-diagnosis.md).

### Ropa

WP-CHAR-01B conservaba ropa realista y añadía piezas rígidas a un solo hueso. Los accesorios rígidos
son válidos, pero no sustituyen prendas deformables. La nueva base ya trae uniforme integrado.

Documento: [02-clothing-diagnosis.md](02-clothing-diagnosis.md).

### Fuentes

Se renderizaron Rocketbox corregido, Kenney y Quaternius con UAL1. Kenney se seleccionó por vestuario
integrado, silueta legible y menor complejidad. Quaternius quedó como alternativa para naturalidad,
pero exige modelar ropa y transferir pesos.

Documento: [03-source-comparison.md](03-source-comparison.md).

## D. Validación

| Control | Resultado |
| --- | --- |
| Diagnóstico Rocketbox | PASS: 219 comprobaciones, 0 errores |
| Comparación de fuentes | PASS: 119 comprobaciones, 0 errores |
| Frames del obrero | PASS: 401 comprobaciones, 0 errores |
| Paquete de nueve láminas | PASS: 94 comprobaciones, 0 errores |
| Manifiesto agregado | PASS: 632 comprobaciones, 0 errores; 203 evidencias y 9 fuentes |
| Character Factory | PASS: 14/14 variantes |
| Arquitectura | PASS |
| Typecheck | PASS |
| Suite web | PASS: 437 tests, 4 skipped |
| Blender runtime | PASS: 263 imágenes/jobs |
| Licencias | PASS |
| `git diff --check` | PASS |
| Aislamiento de rutas | PASS: 0 archivos fuera de las rutas autorizadas |

Gates preexistentes que siguen rojos, sin archivos nuevos de WP-CHAR-02A:

- `art:binaries:check`: **135 violaciones históricas**, 0 nuevas.
- `art:catalog:check`: catálogo visual obsoleto 13/14.
- `art:jobs:validate`: IDs `qa_mini_male`, `qa_mini_female`, `qa_mini_worker`.
- Suite completa de simulación: baseline conocido de 20 fallos/12 archivos; no se modificó simulación
  ni se reejecutó el lote completo en este cierre.

## E. Evidencia y trazabilidad

- [Manifiesto experimental](../../../../../blender_artist/manifests/character-experiments-02a.json) —
  estados, fuentes, hashes, cámara, samples y `runtimePromotion:false`.
- [Manifiesto agregado de evidencia](../../../../art/characters/prototypes/wp-char-02a/evidence-manifest.json).
- [Validación agregada](../../../../art/characters/prototypes/wp-char-02a/evidence-validation.json).
- [Producción del obrero](04-worker-production.md).
- [Revisión de calidad](05-quality-review.md).
- [Lámina principal antes/después](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/01-before-after.png).
- [Ocho poses de marcha](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/04-walk-eight-poses.png).
- [Cuatro direcciones](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/05-four-directions.png).
- [Silueta a 28 px](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/06-silhouette-28px.png).
- [Composición urbana offline](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/09-street-context-offline.png).

## F. Regresiones y problemas pendientes

- No se modificó simulación, shared, edificios, renderer principal, manifiestos runtime ni assets
  públicos. El original permanece limpio en `0a6770d`.
- No se añadieron violaciones binarias ni fallos web/arquitectura/typecheck.
- El rig Kenney tiene sólo siete huesos; la marcha es estilizada, no anatómica adulta.
- Las vistas posteriores son más oscuras por iluminación lateral; no se cambió la iluminación global.
- Sólo hay una pose idle por dirección; no es un ciclo de reposo completo.
- La composición urbana es offline; no prueba integración Phaser, profundidad, atlas ni FPS.
- La aprobación artística humana sigue pendiente.

## G. Decisión técnica de cierre

**WP-CHAR-02A queda técnicamente completo y listo para revisión humana.** El objetivo principal existe:
un obrero estilizado con vestuario integrado, casco, postura natural, marcha legible, cuatro
orientaciones y silueta reconocible a escala real de juego.

No se declara aprobación artística ni se autoriza la expansión a los otros cinco personajes. La
decisión humana puede ser `APPROVED_FOR_EXPANSION`, `REWORK_REQUIRED`, `SOURCE_REJECTED` o `BLOCKED`.
