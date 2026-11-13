# Prompt operativo — V.f Building Composer Spike

Usar con Luna High o un agente de código equivalente.

## MISIÓN

Implementar un spike técnico y visual de `Building Composer` para Landlord.

El objetivo es demostrar que podemos generar edificios propios de calidad a partir de geometría real ya licenciada y disponible en el repositorio, mediante kitbashing/composición modular determinista en Blender.

NO reactivar la antigua Building Factory.
NO construir edificios principalmente desde cubos/cilindros genéricos.
NO promover nada automáticamente al runtime.

El spike se limita a tres tipos y cuatro variantes por tipo:
- `row_house` — familia `residential_low`
- `cement_plant` — familia `industrial_heavy`
- `town_hall` — familia `civic_landmark`

Resultado: 12 candidatos `complete`, reproducibles y con procedencia verificable.

## 0. DOCUMENTACIÓN OBLIGATORIA

Antes de tocar código lee en este orden:
1. `AGENTS.md`
2. `ai-context/README.md`
3. `ai-context/PROJECT-STATE.md`
4. `ai-context/DECISIONS.md`
5. `ai-context/ARCHITECTURE.md`
6. `ai-context/GAME-DOMAIN.md`
7. `docs/INDEX.md`
8. `docs/art/BUILDING-COMPOSER.md`
9. `docs/engineering/adr/D-083-licencias-permisivas-procedencia-por-asset-y-escala.md`
10. `docs/engineering/adr/D-098-geometria-fuente-real.md` si existe; si no, lee la decisión D-098 en `ai-context/DECISIONS.md` y `docs/execution/phase-4/ve-source-geometry-remediation-2026-11-02.md`
11. `docs/engineering/adr/D-099-building-composer-geometria-modular.md`
12. `docs/execution/phase-4/vf-building-composer-spike-plan.md`
13. `docs/art/RUNTIME-ASSETS.md`
14. `docs/art/ART-PIPELINE.md` si existe
15. `docs/research/05-art-direction-and-pipeline-research.md`

Lee también los manifests reales actuales:
- `blender_artist/manifests/staging-sources.json`
- `blender_artist/manifests/asset-jobs.json`
- `blender_artist/manifests/building-catalog.json`
- `blender_artist/manifests/license-allowlist.json`

## 1. BASELINE Y RAMA

Primero:
- `git status`
- `git branch --show-current`
- `git fetch origin`
- `git log --oneline --decorate -20`

El baseline esperado en este momento es `wip/ve-integrated-correction@39640cf`, pero NO asumas que sigue siendo el último aprobado.

Si `develop` ya contiene posteriormente esa integración, parte del `develop` más reciente que contenga D-098 y V.d-7C.

Si no, parte de `wip/ve-integrated-correction`.

Trabaja en:
`wip/vf-building-composer-spike`

NO modificar `develop`.

## 2. REGLAS ABSOLUTAS

1. D-098 sigue vigente: una fuente declarada debe entrar físicamente en el render.
2. Cada módulo debe tener procedencia verificable.
3. No usar modelos externos no registrados.
4. No descargar nuevos packs.
5. No cambiar simulación, economía, DevelopmentCode, footprint, `preferredFootprint` ni placement.
6. No promover al runtime.
7. No generar estados `construction/damaged/burning` todavía.
8. No usar IA generativa como fuente final de geometría.
9. No copiar edificios o trade dress de Constructor/Street Wars/Mob Rule.
10. No declarar éxito visual sin revisión humana.

## 3. BASELINE GATES

Antes de modificar:
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

Guardar los hashes iniciales de:
- `apps/web/src/generated/runtime-assets.json`
- `apps/web/src/generated/runtime-assets-blender.json`

Estos hashes deben permanecer intactos al final del spike.

## 4. INVENTARIO REAL DE LAS FUENTES

Antes de diseñar el compositor, inspecciona los GLB/FBX reales.

No te limites a leer filenames.

Para cada fuente candidata registra:
- objetos;
- nodos;
- jerarquía;
- meshes;
- materiales;
- dimensiones;
- origen/pivot;
- nombres útiles;
- si la geometría está separada o fusionada.

Si hace falta, crea una herramienta headless Blender para emitir un inventario JSON de la escena.

Clasifica cada fuente:
- `modular`
- `partially_modular`
- `whole_asset_only`
- `unsuitable`

Produce:
`blender_artist/manifests/building-module-inventory.json`

y:
`docs/execution/phase-4/vf0-module-inventory-YYYY-MM-DD.md`

## 5. DONANTES INICIALES

Usa como punto de partida los sources reales ya asignados en `building-catalog.json` para:
- row_house;
- cement_plant;
- town_hall.

Pero NO asumas que sólo esos archivos pueden aportar módulos.

Puedes usar otras fuentes ya registradas si:
- licencia compatible;
- procedencia válida;
- encajan en la misma familia visual;
- no introducen un pack nuevo.

## 6. CATÁLOGO DE MÓDULOS

Crear:
`blender_artist/manifests/building-modules.json`

Cada entrada debe tener como mínimo:
- `id`
- `category`
- `sourceId`
- `sourcePath`
- `objectSelector` o equivalente real
- `allowedFamilies`
- `anchor`
- `nominalBounds`
- `orientation`
- procedencia resuelta desde source registry

Categorías sugeridas:
- mass
- facade
- window
- door
- roof
- chimney
- canopy
- balcony
- industrial
- civic
- utility
- intrinsic_prop

Los nombres exactos pueden variar.

## 7. VALIDACIÓN DE MÓDULOS

Crear validador y comando:
`pnpm art:building-modules:validate`

Debe fallar por:
- sourceId inexistente;
- sourcePath fuera de staging;
- licencia no permitida;
- selector inexistente;
- family incompatible;
- bounds inválidos;
- anchor inválido;
- duplicado de ID;
- módulo que declara una fuente diferente de la que importa.

## 8. EXTRACCIÓN

Investiga en este orden:
1. objetos/nodos separados del source;
2. submeshes reutilizables;
3. whole asset como módulo principal;
4. recorte geométrico reproducible sólo si es realmente seguro.

Evita operaciones Blender dependientes de UI/contexto cuando exista API directa.

No hagas retopología manual masiva.

Si una fuente sólo puede reutilizarse entera, marca `whole_asset_only`.

## 9. NORMALIZACIÓN

Reutiliza `source_import.py` y las garantías existentes.

No destruyas la jerarquía importada.

Normaliza mediante root/container:
- escala;
- ground;
- front axis;
- orientación;
- units;
- material mapping.

Registra:
- sourceBounds;
- importScale;
- importOffset;
- moduleBounds;
- anchorTransform.

## 10. STYLE PROFILE

Crear:
`blender_artist/manifests/building-style-profiles.json`

Perfil inicial:
`graphic_civic_buildings_v1`

NO inventes parámetros sin observar primero los assets actuales y la Art Bible.

Medir y justificar:
- floor height;
- door scale;
- window scale;
- bevel;
- roof overhang;
- material roughness;
- material metallic;
- saturation/value;
- detail density;
- prop scale;
- camera/light assumptions.

Guardar referencia de evidencia o explicación en el perfil/documentación.

## 11. MATERIAL NORMALIZATION

Crear una capa de material remap.

Objetivo:
- packs distintos deben sentirse del mismo mundo;
- evitar plástico;
- mantener contraste;
- mantener lectura a zoom medio.

Permitido:
- hue/value remap;
- roughness;
- metallic;
- shared palette families;
- original decals internos.

No sustituir todos los materiales por un único material plano.

## 12. NÚCLEO DEL COMPOSITOR

Implementa un package/script Blender reutilizable.

Estructura sugerida:
`tools/art-pipeline/blender/building_composer/`

Módulos conceptuales:
- catalog
- import
- anchors
- compose
- materials
- style
- metrics
- render

No es obligatorio copiar esta estructura si otra es mejor.

El compositor recibe:
- buildingType;
- family;
- styleProfileId;
- variantSeed;
- composerVersion.

Y produce:
- scene composition;
- metadata;
- compositionSignature;
- candidate render;
- metrics.

## 13. DETERMINISMO

Nunca uses aleatoriedad sin seed explícita.

Deriva cualquier elección de:
- composerVersion;
- styleProfileId;
- buildingType;
- variantSeed;
- module catalog version.

El mismo input debe producir:
- mismos module IDs;
- mismas transforms;
- mismos materials;
- misma compositionSignature.

Test obligatorio: generar, borrar generated output y regenerar.

## 14. COMPOSITION SIGNATURE

Crear firma canónica de:
- module IDs;
- transforms;
- material variant IDs;
- styleProfile;
- composerVersion.

Dos candidatos con la misma firma son duplicados.

## 15. REGLA DE GEOMETRÍA REAL

El cuerpo principal de una composición debe proceder de geometría real registrada.

Primitivas originales pueden usarse sólo como apoyo:
- base;
- connector;
- pequeño plinto;
- simple pipe;
- support.

NO pueden constituir la mayor parte de la masa visible del edificio.

Registra en metadata:
- `licensedGeometryRatio` o una métrica equivalente;
- lista de piezas `original_support`.

No hace falta una fórmula perfecta; sí una trazabilidad que permita detectar que hemos vuelto a la Building Factory antigua.

## 16. REGLA DE VARIANTE REAL

Una variante no puede ser sólo recolor.

Debe diferir materialmente en al menos dos de:
- massing;
- bay sequence;
- roof;
- access;
- secondary volume;
- facade;
- silhouette;
- intrinsic props.

Si no:
`VARIANT_TOO_SIMILAR`.

## 17. FOOTPRINT

Usa el `preferredFootprint` actual del dominio como referencia.

Objetivos:
- row_house = 4×1;
- cement_plant = 2×5;
- town_hall = 3×4.

No cambies esos contratos.

Ground-contact geometry no debe salir del footprint.

Aleros/ornamentos pueden tener un overhang pequeño y documentado; no deben inducir al jugador a creer que ocupa otra parcela.

## 18. PIVOT

El pivot debe corresponder a un punto de suelo estable compatible con Phaser.

Genera metadata con pivot normalizado y valida que permanece dentro de la base visual.

## 19. FAMILIA 1 — ROW HOUSE

Crear 4 variantes.

Debe demostrar:
- repetición modular;
- acceso principal legible;
- ritmo de ventanas;
- cubierta coherente;
- escala residencial;
- personalidad suficiente.

Evita que sea simplemente cuatro copias del mismo edificio fuente alineadas.

Variaciones posibles:
- número/secuencia de bays;
- roof module;
- entry module;
- chimney;
- small canopy;
- facade module combinations;
- material family.

## 20. FAMILIA 2 — CEMENT PLANT

Crear 4 variantes.

Debe leerse industrial incluso sin label.

Buscar módulos reales para:
- nave;
- silo/tank;
- chimney;
- conveyor/pipe;
- canopy;
- industrial appendage.

No inventar una cementera sólo con cilindros y cubos.

Las primitivas pueden conectar módulos reales.

Debe seguir cabiendo en 2×5.

## 21. FAMILIA 3 — TOWN HALL

Crear 4 variantes.

Debe leerse como landmark cívico.

Necesita:
- acceso principal;
- jerarquía frontal;
- cuerpo principal;
- elemento cívico o vertical si las fuentes lo permiten;
- silueta distinta del residencial/comercial.

No resolverlo con un cartel `Town Hall`.

Debe caber en 3×4.

## 22. INTRINSIC PROPS VS PROPERTY GROUNDS

NO dupliques `property-grounds` de V.d-7C.

Puede ir dentro del asset:
- canopy;
- integrated loading dock;
- attached tank;
- chimney;
- stairs;
- signage propia.

Debe permanecer fuera:
- parcel fence;
- garden;
- frontage driveway;
- yard layout;
- external pallets;
- external containers;
- parcel vegetation.

## 23. OUTPUTS

Versionar scripts y manifests.

Generated Blender scenes pueden permanecer fuera de Git si así lo exige la política actual.

Versionar metadata final del spike y evidence aprobada para revisión.

Directorio sugerido para metadata:
`docs/art/building-composer/`

Directorio golden:
`docs/art/golden/vf-building-composer/`

## 24. CANDIDATE METADATA

Cada candidato debe registrar:
- candidateId;
- buildingType;
- family;
- variantSeed;
- composerVersion;
- styleProfileId;
- compositionSignature;
- modules;
- sourceIds;
- sourcePaths;
- source licenses;
- transforms;
- material variants;
- bounds;
- footprint;
- floors;
- pivot;
- triangle count;
- material count;
- texture count;
- render time;
- PNG bytes;
- SHA-256;
- orientationStatus.

## 25. NO STATES TODAVÍA

Producir sólo `complete`.

NO construction.
NO damaged.
NO burning.

Si los edificios complete no gustan, los demás estados serían trabajo desperdiciado.

## 26. NO RUNTIME PROMOTION

Al inicio guarda hash de:
- `runtime-assets.json`;
- `runtime-assets-blender.json`.

Al final deben ser idénticos.

El compositor produce `evidence`, nunca `bundle` en este spike.

## 27. CONTACT SHEETS

Por cada tipo producir una lámina comparable:
`procedural | D-098 source evidence | variant 1 | variant 2 | variant 3 | variant 4`

Misma cámara.
Misma escala.
Mismo fondo.
Misma iluminación.

Labels sólo fuera del render.

## 28. CONTEXTO URBANO

Crear una escena de QA que use el lenguaje actual del juego:
- suelo Graphic Civic;
- carretera;
- acera;
- árbol;
- vehículo;
- personaje de escala;
- property grounds derivados cuando proceda.

Mostrar cada familia a:
- 0.5×;
- 1×;
- 2×.

No sustituir assets del gameplay.

## 29. GOLDEN EVIDENCE

Crear 10 capturas:
1. `row-house-contact-sheet.png`
2. `row-house-context.png`
3. `cement-plant-contact-sheet.png`
4. `cement-plant-context.png`
5. `town-hall-contact-sheet.png`
6. `town-hall-context.png`
7. `all-variants-scale.png`
8. `material-style-comparison.png`
9. `context-1280x720.png`
10. `context-1920x1080.png`

Abre y revisa las 10.

Clasifica:
- PASS;
- RECAPTURE;
- ISSUE.

## 30. CRITERIOS VISUALES

Para cada candidato responde:
- ¿se reconoce el tipo sin texto?
- ¿se distingue del donor original?
- ¿parece de la misma ciudad que las otras familias?
- ¿es mejor que el procedural baseline?
- ¿es mejor que usar el source directamente?
- ¿la silueta funciona a zoom lejano?
- ¿el detalle funciona a zoom normal?
- ¿el material parece coherente?
- ¿la escala es correcta frente a persona/vehículo?
- ¿el footprint se entiende?
- ¿tiene personalidad?

No conviertas estas respuestas en aprobación humana.

## 31. MÉTRICAS

Guardar:
`docs/execution/phase-4/vf-building-composer-metrics.json`

Por variante:
- triangle count;
- objects;
- modules;
- materials;
- textures;
- render time;
- output size;
- bounds;
- signature.

Medir también tiempo total de generar las 12 variantes.

## 32. TESTS

Tests de manifests:
- source FK;
- selector real;
- allowed family;
- license;
- no duplicate module IDs;
- no duplicate candidate signatures.

Tests Blender:
- import;
- hierarchy preserved;
- anchor;
- ground alignment;
- deterministic composition;
- bounds;
- material remap;
- module existence.

Tests de reproducibilidad:
- same seed → same signature;
- different seed → different composition cuando exista elección;
- regenerate → same composition.

## 33. VALIDADORES EXISTENTES

Al terminar deben seguir pasando:
- format;
- typecheck;
- build;
- art:jobs:validate;
- art:building-catalog:validate;
- art:staging:validate;
- art:licenses:check;
- art:binaries:check;
- art:external:check;
- art:style:check;
- art:render:check.

Añadir `art:building-modules:validate` y los tests propios.

## 34. NO SIMULATION CHANGES

Si el diff toca:
- `packages/simulation`;
- reglas de building;
- `preferredFootprint`;
- `siteRequirements`;
- placement;

detente y explica por qué.

Este spike es de arte/pipeline.

## 35. NO NUEVAS DESCARGAS

No usar Internet para buscar otro pack.

Si falta una pieza, intenta primero:
- otro módulo del staging;
- whole asset + módulos;
- original_support pequeño.

Si sigue faltando, documenta el gap.

No descargues nada sin autorización.

## 36. COMMITS

Commits pequeños y temáticos.

Secuencia sugerida:
1. `docs: inventory reusable building modules`
2. `feat: add validated building module catalog`
3. `feat: add Graphic Civic building style profile`
4. `feat: add deterministic modular building composer`
5. `feat: compose row house pilot family`
6. `feat: compose cement plant pilot family`
7. `feat: compose town hall pilot family`
8. `test: validate composer determinism and provenance`
9. `test: capture Building Composer evidence`
10. `docs: record V.f Building Composer spike`

## 37. STOP CONDITIONS

STOP y reporta si:
- no puedes extraer módulos sin trabajo manual grande;
- las fuentes reales están fusionadas de forma inutilizable;
- necesitas volver a composición principal por primitivas;
- las variantes sólo cambian color;
- provenance no puede demostrarse;
- una licencia es dudosa;
- necesitas cambiar dominio o runtime;
- sólo puedes obtener un resultado peor que el source directo;
- Blender requiere manipulación manual no reproducible.

## 38. ACTA FINAL

Crear:
`docs/execution/phase-4/vf-building-composer-spike-YYYY-MM-DD.md`

Debe incluir:
- baseline;
- branch;
- final HEAD;
- commits;
- module inventory;
- sources;
- StyleProfile;
- composer architecture;
- family grammar;
- 12 candidate table;
- provenance;
- determinism;
- metrics;
- screenshots;
- issues;
- runtime hashes before/after;
- P0/P1/P2;
- recommendation.

## 39. TABLA FINAL DE CANDIDATOS

Entregar:
| Type | Variant | Signature | Sources | Footprint | Tech QA | Visual status |

`Visual status` sólo puede ser:
- `READY_FOR_HUMAN_REVIEW`
- `REWORK`
- `REJECT_TECHNICAL`

Nunca `APPROVED` salvo que el responsable haya aprobado expresamente esa variante durante la sesión.

## 40. ESTADO FINAL

Sólo uno de:
- `V.f BUILDING COMPOSER SPIKE — READY FOR HUMAN VISUAL REVIEW`
- `V.f BUILDING COMPOSER SPIKE — REWORK`
- `V.f BUILDING COMPOSER SPIKE — TECHNICALLY BLOCKED`

No declarar:
- `V.f COMPLETE`
- `ASSETS APPROVED`
- `RUNTIME PROMOTED`

## 41. MERGE POLICY

Push permitido sólo a:
`wip/vf-building-composer-spike`

No merge a `develop`.

No modificar `wip/ve-integrated-correction`.

El siguiente paso después del agente será revisión visual humana de las 12 variantes y de las 10 capturas.