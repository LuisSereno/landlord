# WP-CHAR-01B · Dependencia de integración del catálogo 13/14

Fecha: 2026-11-24. Estado: **diagnosticado y aislado; integración bloqueada hasta cerrar edificios**.

## 1. Síntoma

- `blender_artist/manifests/character-factory.json` contiene **14** variantes: 6 operativas y 8
  ambientales/contextuales.
- `apps/web/src/generated/visual-catalog.json` contiene **13** personajes.
- `pnpm art:catalog:check` falla con `visual-catalog.json is stale`.
- No se ha modificado el generador ni la salida compartida en WP-CHAR-01B.

## 2. Origen exacto

| Archivo | Evidencia |
| --- | --- |
| `scripts/generate-visual-catalog.mjs:11-13` | Lee `character-factory.json` |
| `scripts/generate-visual-catalog.mjs:44-66` | Construye el payload del catálogo |
| `scripts/generate-visual-catalog.mjs:57` | `characterDefinitions` endurece `/13` |
| `scripts/generate-visual-catalog.mjs:58` | `characterRenderedRoles` endurece `0/13` |
| `scripts/generate-visual-catalog.mjs:68-70` | `--check` compara el JSON serializado |
| `apps/web/src/generated/visual-catalog.json:518-519` | Salida histórica `13/13` y `0/13` |
| `apps/web/src/VisualCatalog.tsx:145-165` | Consumidor de personajes y animaciones |

El generador copia `characters.characters` completos, pero el archivo generado no se ha regenerado
desde que Character Factory pasó a 14. Por eso faltan `medical_professional` y los estados/producción
añadidos en WP-CHAR-01.

## 3. Comprobación independiente

Se añadió:

`tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs`

Comprobación ejecutada:

```bash
node tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs
```

Resultado actual esperado:

```json
{
  "status": "failed",
  "factoryVariants": 14,
  "generatedVariants": 13,
  "operationalVariants": 6,
  "runtimeExistingMappings": 5,
  "errors": [
    "Generated visual catalog contains 13 characters, expected 14",
    "Generated visual catalog is missing medical_professional",
    "characterDefinitions is 13/13, expected 14/14",
    "characterRenderedRoles is 0/13, expected 0/14 until previews are integrated"
  ]
}
```

La comprobación es específica de personajes, no toca edificios y permanece roja hasta la integración.
No sustituye ni oculta `art:catalog:check`.

## 4. Cambio mínimo propuesto

En `scripts/generate-visual-catalog.mjs`, definir el objetivo canónico y derivar los denominadores:

```diff
 const payload = {
   schemaVersion: 1,
   buildings,
   characters: characters.characters,
@@
   coverage: {
     buildings: `${buildings.length}/15`,
     buildingStates: `${buildings.reduce((total, b) => total + Object.keys(b.states).length, 0)}/60`,
     stateConditioning: "pendiente: la geometría importada sólo renderiza complete",
-    characterDefinitions: `${characters.characters.length}/13`,
-    characterRenderedRoles: "0/13",
+    characterDefinitions: `${characters.characters.length}/14`,
+    characterRenderedRoles: "0/14",
     animationDefinitions: `${characters.runtimeAnimations.length + characters.showcaseAnimations.length}`,
     animationRenderedPreviews: "0/9",
```

Después, regenerar sólo el catálogo visual desde un árbol limpio:

```bash
pnpm art:catalog:generate
pnpm art:catalog:check
```

La semántica de `characterRenderedRoles` se mantiene: sigue siendo 0 porque no hay previews
integrados. No se cambia a 5 por existencia de sprites runtime; eso sería otra decisión de catálogo.
El `schemaVersion` del catálogo puede permanecer en 1 porque el cambio es aditivo.

## 5. Archivos afectados por la integración futura

- `scripts/generate-visual-catalog.mjs` — corrección mínima del denominador.
- `apps/web/src/generated/visual-catalog.json` — regeneración controlada.
- `apps/web/src/VisualCatalog.tsx` — consumidor; no debería requerir cambios porque los campos
  existentes siguen presentes.
- `apps/web/src/visual-catalog.test.tsx` — ejecutar tras regenerar.
- `blender_artist/manifests/character-factory.json` — fuente, sin cambios en esta integración.

## 6. Pruebas de aplicación

```bash
node tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs
pnpm art:catalog:generate
pnpm art:catalog:check
pnpm --filter @landlord/web test
pnpm typecheck
git diff --check
```

Revisar manualmente que el diff de `visual-catalog.json` sólo cambia personajes y coverage. Cualquier
cambio en edificios, vehículos, props o terreno debe detener la aplicación.

## 7. Riesgo con la fase de edificios

`generate-visual-catalog.mjs` también lee:

- `building-catalog.json`;
- `building-evidence.json`;
- `world-asset-catalog.json`;
- `runtime-assets.json`.

Ejecutarlo mientras Building Composer esté modificando esos datos puede mezclar WIP de edificios en
la salida. El momento seguro es después del cierre artístico de edificios, con ambos repositorios
limpios y una revisión del diff limitada a personajes.

## 8. Estado

`art:catalog:check` sigue **bloqueado** por esta dependencia. La corrección queda preparada y
comprobada de forma aislada, pero no se aplica en WP-CHAR-01B.
