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
pnpm art:blender         # renderiza la ruta Blender E2E (requiere Blender local)
pnpm art:blender:check   # verifica hashes y medidas del bundle Blender sin Blender
pnpm art:visual          # QA local: captura y compara contra el golden con pixel-diff tolerante
ART_VISUAL_UPDATE=1 pnpm art:visual   # regenera el golden tras un cambio aprobado
pnpm art:profile         # 400 sprites en Phaser con cambio de frame y scroll, FPS real
pnpm art:binaries:check  # presupuesto de binarios de D-081 (1 MB, allowlist del spike)
pnpm smoke:art-lab       # Asset QA completa + escena densa opt-in en Chromium
```

`art:visual` es una validación **local-only**. GitHub Actions no la ejecuta porque Phaser, SVG y DOM
produjeron diferencias cross-environment del 17–22 % y demasiados falsos positivos. La guarda remota
es `smoke:art-lab` + `art:blender:check` + `art:binaries:check` (D-082).

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
