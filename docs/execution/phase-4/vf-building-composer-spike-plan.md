# V.f — Building Composer Spike

Estado: PLANNED
Fecha: 2026-11-03
Baseline documental: `wip/ve-integrated-correction@39640cf`
ADR: D-099 (PROPUESTA)
Especificación: `docs/art/BUILDING-COMPOSER.md`

## 1. Objetivo

Demostrar que Landlord puede producir edificios propios visualmente atractivos mediante composición modular de geometría real ya licenciada, sin reactivar la Building Factory retirada y sin promover nada automáticamente al runtime.

El spike genera cuatro variantes de:
- `row_house`;
- `cement_plant`;
- `town_hall`.

Total esperado: 12 candidatos `complete`.

## 2. Hipótesis

Si se combinan módulos reales de fuentes compatibles, con normalización de escala/materiales y una gramática por familia, es posible obtener edificios más atractivos que el procedural actual, más variados que el simple re-render de un GLB, coherentes entre sí, reproducibles y compatibles con el footprint de dominio.

## 3. Condición de parada temprana

Detener antes de construir infraestructura compleja si el inventario demuestra que las fuentes no permiten módulos reutilizables sin trabajo manual desproporcionado. En ese caso producir `MODULE_EXTRACTION_NOT_VIABLE` con evidencia de por qué.

## 4. Fases

### V.f.0 — Baseline e inventario de módulos

Objetivo: entender qué geometría real existe.

Acciones:
1. verificar baseline;
2. leer D-083, D-098, D-099 y Art Pipeline;
3. ejecutar validadores de staging;
4. inspeccionar físicamente las fuentes candidatas;
5. registrar objetos/nodos reutilizables;
6. clasificar cada fuente como modular, partially_modular, whole_asset_only o unsuitable.

Salida:
- `blender_artist/manifests/building-module-inventory.json`
- `docs/execution/phase-4/vf0-module-inventory-YYYY-MM-DD.md`

Gate: al menos tres fuentes útiles por familia o una estrategia whole_asset + modules viable; procedencia conocida; ninguna fuente no registrada.

### V.f.1 — Catálogo modular y validadores

Crear `building-modules.json` y `validate-building-modules.mjs`.

Cada módulo debe validar sourceId, sourcePath, selector, category, allowedFamilies, nominal bounds, anchor, licencia resuelta y archivo físico.

Añadir `pnpm art:building-modules:validate`.

Gate: catálogo determinista, selector real y 100 % módulos con provenance.

### V.f.2 — StyleProfile

Crear `building-style-profiles.json`.

Antes de fijar valores medir altura de planta, tamaños de puerta y ventana, bevel aparente, roughness, escala de props, cámara y luz.

El perfil debe guardar `evidenceBasis` o un documento asociado que explique de dónde salen los parámetros.

Gate: no hay parámetros visuales críticos sin justificación; profile versionado.

### V.f.3 — Núcleo del Composer

Estructura sugerida:
- `tools/art-pipeline/blender/building_composer/__init__.py`
- `module_catalog.py`
- `style_profile.py`
- `compose.py`
- `materials.py`
- `anchors.py`
- `metrics.py`

No es obligatorio usar exactamente esta estructura si otra encaja mejor.

Responsabilidades: importar módulos, normalizar, clonar, colocar por anchors, aplicar materiales, validar bounds, guardar metadata y renderizar.

Gate: composición trivial reproducible, misma seed produce misma firma y la jerarquía fuente no se muta accidentalmente.

### V.f.4 — Gramática residential_low

Target: `row_house`.

Producción: `row_house:v1` a `row_house:v4`.

Reglas mínimas: acceso visible, repetición de fachada, cubierta coherente, altura residencial, footprint 4×1 y variantes no sólo cromáticas.

Crear contact sheet.

Gate técnico: 4/4 reproducibles, provenance, bounds, no overlap interno grave y misma cámara.

### V.f.5 — Gramática industrial_heavy

Target: `cement_plant`.

Cuatro variantes. Buscar combinaciones con nave, volumen secundario, silo/depósito, chimenea/tubería, canopy y maquinaria intrínseca cuando existan módulos adecuados.

No fabricar una planta industrial genérica exclusivamente desde cilindros/cubos. Primitivas originales sólo pueden complementar una composición cuyo cuerpo principal provenga de geometría real.

Gate: silueta industrial evidente, 4 variantes, footprint 2×5 y procedencia completa.

### V.f.6 — Gramática civic_landmark

Target: `town_hall`.

Cuatro variantes.

Requisitos: eje de entrada, jerarquía, cuerpo principal reconocible, landmark cívico, footprint 3×4 y no parecer bloque residencial con cartel.

Gate: 4 variantes, composición realmente diferente y escala cívica coherente.

### V.f.7 — QA de composición

Generar por familia: procedural baseline, source evidence D-098, v1, v2, v3 y v4.

Comparar silueta, lectura, detalle, materiales, escala, footprint, originalidad y cohesión.

No aprobar automáticamente.

### V.f.8 — Contexto urbano

Añadir una escena de evidencia, no runtime.

Cada familia debe verse sobre suelo Graphic Civic, junto a carretera, personaje, vehículo/árbol, con property grounds cuando aplique y a zoom 0.5×, 1× y 2×.

No usar esta escena para falsear gameplay.

### V.f.9 — Métricas y cierre técnico

Medir por variante source modules count, triangle count, materials, textures, bounds, render time, output PNG size y Blender peak memory cuando sea accesible.

Generar `docs/execution/phase-4/vf-building-composer-metrics.json`.

## 5. Selección de fuentes

No fijar de antemano una fuente sólo porque la documentación histórica la mencione. Inspeccionar las fuentes reales actuales.

Preferencia: Kenney cuando la geometría modular sea suficiente; Quaternius cuando aporte una forma que falte; KayKit para módulos/props compatibles; Poly Haven para materiales; otras fuentes sólo si están registradas y admitidas.

No incorporar una nueva dependencia externa durante el spike salvo decisión explícita.

## 6. Procedencia de composición

Cada candidato debe producir metadata con candidateId, buildingType, composerVersion, styleProfileId, variantSeed y modules[]. Cada módulo debe registrar moduleId, sourceId, sourcePath y objectSelector.

## 7. Signature

Crear una `compositionSignature` estable a partir de module IDs, canonical transforms, material variants, composer version y style profile.

Dos variantes con la misma firma no son variantes distintas.

## 8. Reproducibilidad

Test: renderizar candidato, borrar output generado y renderizar de nuevo.

Deben coincidir metadata, compositionSignature y lista módulo/transform.

PNG byte-idéntico es deseable en el mismo entorno Blender; si existe nondeterminismo legítimo del render, usar una comparación explícita documentada. No aceptar diferencias estructurales.

## 9. Footprint visual

Usar `preferredFootprint` actual como referencia morfológica. El compositor no puede cambiarla.

Verificar que la proyección del asset cabe razonablemente dentro de su footprint, no invade visualmente celdas vecinas de forma engañosa y mantiene el pivot esperado.

No confundir altura vertical del sprite con footprint de suelo.

## 10. Orientación

El spike puede limitarse a orientación canónica, pero metadata debe indicar `orientationStatus: canonical_only`.

No declarar cuatro orientaciones si sólo existe una.

## 11. Materials

Crear una capa de remap no destructiva para reducir divergencias entre packs, mantener legibilidad y evitar aspecto plástico.

Todos los materiales usados deben pertenecer a una familia permitida o registrarse explícitamente.

## 12. Polígonos y complejidad

No optimizar prematuramente. Primero medir.

Si un candidato excede claramente al resto por un orden de magnitud, registrar y estudiar merge/bake antes de degradarlo visualmente.

## 13. Contact sheets

Por tipo: procedural baseline | D-098 source evidence | variant 1 | variant 2 | variant 3 | variant 4.

Todas con misma cámara, misma escala visual, mismo fondo y sin labels encima del edificio.

## 14. Escena in-context

La escena debe usar terreno actual, carretera actual, props actuales y cámara actual. No usar un fondo artístico que haga parecer mejor el asset que el gameplay.

## 15. Screenshots

Directorio: `docs/art/golden/vf-building-composer/`.

Obligatorias:
1. row-house-contact-sheet.png
2. row-house-context.png
3. cement-plant-contact-sheet.png
4. cement-plant-context.png
5. town-hall-contact-sheet.png
6. town-hall-context.png
7. all-variants-scale.png
8. material-style-comparison.png
9. context-1280x720.png
10. context-1920x1080.png

## 16. QA humana

El agente sólo puede concluir `READY FOR HUMAN VISUAL REVIEW`.

El responsable decide por variante: APPROVE, REWORK o REJECT.

La aprobación del sistema exige al menos 2/4 variantes aprobadas por familia.

## 17. Tests

Node/manifest:
- module catalog schema;
- source FK;
- source path;
- selectors;
- family compatibility;
- style profile;
- candidate metadata;
- no duplicate signatures.

Blender/Python:
- import hierarchy;
- anchors;
- composition determinism;
- bounds;
- ground alignment;
- material remap;
- source object existence.

Browser, sólo si existe showcase web para evidence:
- imágenes cargan;
- filtros;
- 12 variantes;
- procedencia visible;
- 0 page errors.

No es obligatorio integrar Phaser gameplay.

## 18. Gates existentes que deben seguir verdes

Como mínimo:
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm build`
- `pnpm art:jobs:validate`
- `pnpm art:building-catalog:validate`
- `pnpm art:staging:validate`
- `pnpm art:licenses:check`
- `pnpm art:binaries:check`
- `pnpm art:external:check`
- `pnpm art:style:check`
- `pnpm art:render:check`

Ejecutar tests del compositor además.

No es necesario ejecutar campañas de simulación si no se modifica dominio/runtime.

## 19. Preservación de runtime

Al finalizar el spike comprobar que no cambian `apps/web/src/generated/runtime-assets.json` y `apps/web/src/generated/runtime-assets-blender.json`, salvo metadata documental explícitamente autorizada.

Idealmente hashes idénticos al baseline.

## 20. Commits sugeridos

- docs: inventory reusable building modules
- feat: add validated building module catalog
- feat: add Graphic Civic building style profile
- feat: add deterministic modular building composer
- feat: compose row house pilot family
- feat: compose cement plant pilot family
- feat: compose town hall pilot family
- test: validate building composer provenance and determinism
- test: capture Building Composer visual evidence
- docs: record V.f Building Composer spike

No mezclar todos los cambios en un commit.

## 21. Stop conditions

Detener si la extracción requiere modelado manual extenso, sólo se pueden producir variantes por recolor, hay que romper D-098, hay que cambiar runtime para ver evidence, hay que cambiar dominio/footprints, una fuente tiene licencia dudosa, Blender scripting necesita operadores UI frágiles o las variantes son objetivamente peores que el re-render fuente.

## 22. Acta final

Crear `docs/execution/phase-4/vf-building-composer-spike-YYYY-MM-DD.md`.

Debe contener baseline, branch, commits, fuentes usadas, module inventory, StyleProfile, gramáticas, variante por variante, provenance, determinism, métricas, screenshots, issues, P0/P1/P2, runtime hash before/after y recomendación.

## 23. Decisión final permitida

Una de:
- `V.f BUILDING COMPOSER SPIKE — READY FOR HUMAN VISUAL REVIEW`
- `V.f BUILDING COMPOSER SPIKE — REWORK`
- `V.f BUILDING COMPOSER SPIKE — TECHNICALLY BLOCKED`

Nunca `V.f COMPLETE`, `ASSETS APPROVED` ni `RUNTIME PROMOTED` sin revisión humana.