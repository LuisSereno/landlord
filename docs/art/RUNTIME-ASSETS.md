# Runtime assets v1 — contrato y factoría

Estado: implementado en WP4.15 (D-080). La fuente de producción final es Blender (ver
`ART-PIPELINE.md`); esta capa define **cómo llega un asset al runtime** y ejecuta una factoría
procedural determinista para Alpha.

## Flujo

```text
spec de la factoría (scripts/generate-runtime-assets.mjs)
  → SVG por frame + hash SHA-256
  → apps/web/src/generated/runtime-assets.json   (data URIs, sin binarios)
  → validación Zod + hashes + budget en CI        (apps/web/src/assets.test.ts)
  → texturas de Phaser + pivote + depth           (IsometricSpikeScene)
  → Asset QA y animación en /art-lab               (ArtLab)
  → captura visual y perfil denso                 (art:visual, art:profile)
```

La ruta Blender separa metadata importable y binarios HTTP:

```text
Blender
  → PNG en apps/web/public/assets/runtime/blender/
  → manifest en apps/web/src/generated/runtime-assets-blender.json
  → import TypeScript estático
  → Phaser / Art Lab
```

Los campos `src` del manifest siguen siendo URLs `/assets/runtime/blender/*.png`. El JSON no se
sirve con `fetch()` ni se importa con `?url`: es metadata generada de build; sólo los PNG pertenecen
a `public/`.

## Contrato (`@landlord/shared`, `assets.ts`)

- `RuntimeAssetManifestV1.schemaVersion = 1`.
- `generator`: id, versión, método (`procedural_svg` o `blender_render`) y fuente.
- `provenance`: licencia y autor. Los literales válidos son SPDX y salen de
  `blender_artist/manifests/license-allowlist.json` (`original`, `CC0-1.0`, `MIT`, `CC-BY-4.0`);
  `assets.test.ts` falla si el enum de Zod y el allowlist divergen. Cada asset puede declarar su
  `provenance` propia (D-083), porque un bundle real mezcla CC0 (Kenney/Quaternius) con MIT
  (Rocketbox); la del bundle es resumen y valor por defecto. Con `MIT` o `CC-BY-4.0`, el campo
  `attribution` (`sourceUrl`, `licenseUrl`, `attributionText`, `verifiedAt`, `licenseFileSha256`)
  es obligatorio y Zod rechaza sin él. `pnpm art:licenses:check` lo verifica en CI sobre los
  bundles publicados.
- `buildings[type]`: huella (`footprint`), pivote normalizado 0..1 y cuatro estados obligatorios:
  `complete`, `construction`, `damaged`, `burning`.
- `characters[id]`: 4 u 8 direcciones y animaciones `idle`/`walk` con `frameDurationMs` y frames.
- `AssetImageV1`: `src` (data URI o ruta), `width`, `height`, `sha256` del contenido fuente.

## Reglas de integración

- El pivote es el punto de suelo del sprite; Phaser lo aplica con `setOrigin`.
- El depth usa `(x + y) * 1000 + y * 10 + x`, el mismo orden que las losetas.
- Estados del edificio: `operational` con condición ≥ 60 → `complete`; < 60 → `damaged`;
  `burning`/`collapse_pending` → `burning`; `ruin` → `damaged` con opacidad 0.4; obra → `construction`.
- El rectángulo de respaldo sólo se dibuja mientras las texturas no han compilado.
- Los personajes se animan en el Art Lab; la escena jugable conserva el blitter de agentes hasta que
  exista un LOD de personaje medido.

## Comandos

```bash
pnpm art:generate        # regenera el manifiesto procedural
pnpm art:assets:check    # falla si el manifiesto no coincide con la factoría
pnpm art:blender         # renderiza los jobs del manifiesto (requiere Blender local)
pnpm art:blender:check   # verifica hashes, medidas y completitud manifiesto↔bundle
pnpm art:jobs:validate   # valida asset-jobs.json (unión por kind, FK de fuentes, límites)
pnpm art:visual          # QA local: captura y compara contra el golden con pixel-diff tolerante
ART_VISUAL_UPDATE=1 pnpm art:visual   # regenera el golden tras un cambio aprobado
pnpm art:profile         # 400 sprites en Phaser con cambio de frame y scroll, FPS real
pnpm art:binaries:check  # presupuesto de binarios de D-081 (por fichero y por bundle)
pnpm art:licenses:check  # procedencia de los bundles publicados contra el registro (D-083)
pnpm art:staging:validate # licencias, familias de directorio e integridad de staging/third_party
pnpm smoke:art-lab       # Asset QA completa + escena densa opt-in en Chromium
```

`art:visual` es una validación **local-only**. GitHub Actions no la ejecuta porque Phaser, SVG y DOM
produjeron diferencias cross-environment del 17–22 % y demasiados falsos positivos. La guarda remota
es `smoke:art-lab` + `art:blender:check` + `art:binaries:check` (D-082).

## Manifiesto de jobs (`blender_artist/manifests/asset-jobs.json`)

Desde WP4.15-V.a el conjunto de renders es dato, no código: `build-blender-assets.mjs` itera este
manifiesto. Lo valida `scripts/validate-asset-jobs.mjs` (`pnpm art:jobs:validate`, paso de CI).

- **Unión discriminada por `kind`** (`building`, `character`, `terrain`, `prop`, `vehicle`): cada
  tipo admite un conjunto exacto de claves, así que un árbol no puede declarar `animations` ni un
  personaje `states`.
- **`source.sourceId` es FK** contra `staging-sources.json`. El job no redeclara licencia ni
  autoría: se resuelven contra la fuente registrada.
- **`source.path` confinada**: relativa al repo, sin `..`, bajo
  `blender_artist/staging/third_party/` y dentro del directorio de su fuente (el `extractDir` de
  un archivo, o el propio `path` cuando la fuente es un clon sin ZIP).
- **`unitScale` se hereda de la fuente.** Un job sólo lo cambia con `unitScaleOverride`, que
  exige `unitScaleReason` (〔R7〕).
- **`render.width/height` es el tamaño publicado.** El pipeline renderiza al doble y reduce por
  filtro de caja, así que el factor de supersampling no se repite en el manifiesto. El preset del
  slice está en `defaults.render` (256); los límites admitidos son 64–1024.
- **`target`: `bundle`** se ensambla en `runtime-assets-blender.json`; **`evidence`** se renderiza
  a `blender_artist/generated/runtime-evidence/` (fuera de Git) y requiere `reason`. Un job
  `bundle` de edificio sin los cuatro estados que exige el contrato no pasa el validador. Un job
  `evidence` expande sólo la primera pasada de su matriz (una dirección, una animación, un frame,
  un estado): valida la ingesta de la fuente, no el catálogo.
- **Los jobs procedurales no redeclaran `camera` ni `render`**: sus parámetros están congelados en
  `runtime_asset.py` y duplicarlos crearía una segunda fuente de verdad. La regresión exigida es
  que sus PNG publicados sigan siendo byte-idénticos.

## Ruta Blender E2E (WP4.15-H)

`tools/art-pipeline/blender/runtime_asset.py` demuestra la cadena completa para un edificio
(`courtyard_home`, cuatro estados) y una variante de personaje (`vecino_variante`, cuatro
direcciones): render EEVEE ortográfico 45°/30° con fondo transparente, recorte al contenido opaco,
reducción 2× por filtro de caja y metadata con tamaño, SHA-256 y pivote proyectado del origen 3D.
`scripts/build-blender-assets.mjs` publica los PNG en
`apps/web/public/assets/runtime/blender/` y el bundle importable en
`apps/web/src/generated/runtime-assets-blender.json`. Cumple el mismo contrato v1 y Phaser lo consume
en la escena densa. El runtime principal sigue usando `runtime-assets.json`: la ruta Blender queda
probada, no promovida. Atlas y Git LFS están reclasificados como requisitos de Beta con criterio de
reapertura medido (D-081).

## Ingesta de fuentes externas (WP4.15-V.a)

Un job cuyo `source.kind` no es `procedural` entra por la misma ruta de render con geometría
licenciada. `tools/art-pipeline/blender/source_import.py` concentra la ingesta:

- **GLB/glTF primero**: trae las texturas embebidas, así que no hay rutas que remapear. FBX sólo
  cuando la fuente no publica GLB (Quaternius, Rocketbox); entonces `fix_texture_paths()` remapea
  por nombre de archivo y `assert_textures_resolved()` **aborta** si queda una textura sin resolver
  — el magenta es un error, no un aviso.
- **`normalize_import_root()` escala y asienta el asset moviendo sólo el contenedor `IMPORT_ROOT`**
  (〔R2〕). `hierarchy_signature()` captura padres, matrices locales y huesos antes de tocar nada y
  `assert_hierarchy_preserved()` falla si la normalización alteró la jerarquía importada: un
  personaje Rocketbox sigue llegando con su `Bip01` de 80 huesos y su mesh skinneado.
- **`unitScale` es un dato declarado por la fuente** en `staging-sources.json`, nunca inferido de la
  bounding box (〔R7〕). Cada metadata de render registra `sourceBounds`, `importScale`,
  `importOffset` y `hierarchy` para poder auditar cualquier disparidad.

Los jobs `target: "evidence"` se renderizan a `blender_artist/generated/runtime-evidence/` (PNG +
JSON, fuera de Git) para validar una fuente sin publicar un asset incompleto.

## Función del Art Lab

`/art-lab` es una herramienta interna de **Asset QA**, no un selector de dirección visual. Su zona
principal revisa estados, tipo, huella, pivote, generator/provenance y personajes. `courtyard_home`
compara procedural y Blender lado a lado antes de una futura promoción por asset. La escena densa
sólo aparece con `?density=N`. Los tres renders de dirección permanecen como archivo secundario y
colapsable: `graphic_civic` está `APPROVED / BASELINE`; las otras dos son
`ARCHIVE / ALTERNATIVE`.

## Budgets de Alpha

| Métrica | Budget | Medido 2026-10-25 |
|---|---|---|
| Manifiesto completo | < 200 KB | 106 KB |
| Imágenes | — | 68 (20 edificios + 48 personajes) |
| SVG por frame | < 8 KB | < 2 KB |
| Bundle Blender E2E | < 120 KB | 55,8 KB (20 PNG) |
| Binario versionado | < 1 MB (D-081) | 506 KB el mayor nuevo (golden) |
| Sprites densos en Phaser | 60 FPS | 60 FPS de mediana a 400 sprites |

Un cambio de arte que supere un budget debe declarar el nuevo número y su medición; no se acepta por
impresión.

## Añadir un edificio o variante

1. Añadir la entrada a `BUILDINGS`/`CHARACTERS` en `scripts/generate-runtime-assets.mjs`.
2. `pnpm art:generate && pnpm art:assets:check`.
3. `pnpm --filter @landlord/web test` (esquema, hashes, estados, direcciones y budget).
4. Revisar `/art-lab` con `pnpm smoke:art-lab` y, si cambia la escena, regenerar la captura visual.
5. Si el edificio es de gameplay, el contrato ya está listo: la escena lo pinta en cuanto el tipo
   exista en `BuildingType` y el manifiesto lo declare.
