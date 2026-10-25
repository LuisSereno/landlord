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
  → galería y animación en /art-lab               (ArtLab)
  → captura visual y perfil denso                 (art:visual, art:profile)
```

Para el arte final, el paso 1 se sustituye por renders Blender y el manifiesto declara
`generator.method: "blender_render"`; el resto del contrato no cambia.

## Contrato (`@landlord/shared`, `assets.ts`)

- `RuntimeAssetManifestV1.schemaVersion = 1`.
- `generator`: id, versión, método (`procedural_svg` o `blender_render`) y fuente.
- `provenance`: licencia (`original`, `cc0`, `cc_by`), autor y notas.
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
pnpm art:visual          # captura y compara contra el golden con pixel-diff tolerante
ART_VISUAL_UPDATE=1 pnpm art:visual   # regenera el golden tras un cambio aprobado
pnpm art:profile         # 400 sprites en Phaser con cambio de frame y scroll, FPS real
pnpm art:binaries:check  # presupuesto de binarios de D-081 (1 MB, allowlist del spike)
pnpm smoke:art-lab       # galería completa + escena densa en Chromium
```

## Ruta Blender E2E (WP4.15-H)

`tools/art-pipeline/blender/runtime_asset.py` demuestra la cadena completa para un edificio
(`courtyard_home`, cuatro estados) y una variante de personaje (`vecino_variante`, cuatro
direcciones): render EEVEE ortográfico 45°/30° con fondo transparente, recorte al contenido opaco,
reducción 2× por filtro de caja y metadata con tamaño, SHA-256 y pivote proyectado del origen 3D.
`scripts/build-blender-assets.mjs` publica el bundle
`apps/web/public/assets/runtime/blender/runtime-assets-blender.json`, que cumple el mismo contrato
v1 y que Phaser consume en la escena densa. El resto de assets Alpha sigue siendo procedural: la ruta
queda probada, no impuesta. Atlas y Git LFS están reclasificados como requisitos de Beta con
criterio de reapertura medido (D-081).

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
