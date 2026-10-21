# Arte — contexto operativo para agentes

## Estado

Landlord dispone de dos especificaciones completas de preproducción:

- `docs/art/ART-BIBLE.md`
- `docs/art/ART-PIPELINE.md`

Ambas son v0.1 y distinguen DECIDED, BASELINE, OPEN y FUTURE.

## Decidido

- IP original (D-001).
- 2.5D isométrico como dirección inicial (D-003).
- Phaser confirmado para Gate 1 (D-050).
- React/DOM para HUD/paneles según arquitectura; no para entidades del mundo.

## Baseline pendiente del Visual Direction Spike

- Blender como fuente 3D.
- 3D -> prerender 2D/2.5D.
- EEVEE como batch renderer.
- cámara ortográfica ~45° / ~30°.
- footprint 2:1.
- grid 128x64 y master 2x.
- iluminación canónica.
- personajes en 8 direcciones.
- atlases 2048² multipack.
- PNG RGBA como baseline.
- Git LFS para grandes fuentes binarias.
- Art Lab + Playwright para visual regression.

## Lectura obligatoria

1. `docs/art/README.md`
2. `docs/art/ART-BIBLE.md`
3. `docs/art/ART-PIPELINE.md`
4. `docs/art/OPEN-DECISIONS.md`
5. `docs/art/ASSET-CHECKLIST.md`
6. documentación específica de la tarea.

## Reglas

- No convertir BASELINE en DECIDED sin evidencia/spike.
- No producir masivamente antes del Visual Direction Spike.
- No copiar IP ajena.
- No bakear texto que deba localizarse.
- No derivar footprint/collision de pixels.
- No editar atlases generados manualmente.
- Todo asset externo debe declarar provenance/licencia.

## Fuente extensa

`docs/research/05-art-direction-and-pipeline-research.md`
