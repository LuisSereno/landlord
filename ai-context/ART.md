# Arte — contexto operativo para agentes

## Estado

Landlord dispone de especificaciones completas de preproducción:

- `docs/art/ART-BIBLE.md`
- `docs/art/ART-PIPELINE.md`
- `docs/art/BOOTSTRAP-ASSET-LIBRARY.md`

## Decidido

- IP original (D-001).
- 2.5D isométrico como dirección inicial (D-003).
- Phaser confirmado para Gate 1 (D-050).
- Blender 5.2.2 LTS como versión fijada del toolchain artístico inicial (D-053).
- bootstrap artístico self-contained: CC0 + procedural-first + automatización, sin artista contratado como dependencia de Gate 2/Visual Direction Spike (D-054).
- React/DOM para HUD/paneles según arquitectura; no para entidades del mundo.

## Baseline pendiente del Visual Direction Spike

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

## Librería bootstrap local

Ya descargados localmente por el propietario:

- Quaternius Downtown City MegaKit Standard;
- Quaternius Universal Base Characters Standard;
- Quaternius Universal Animation Library Standard;
- Kenney City Kit Industrial;
- Kenney City Kit Commercial;
- Kenney City Kit Roads;
- Kenney UI Pack;
- Kenney UI Audio;
- Poly Haven Red Brick 03 2K;
- Poly Haven Red Bricks 02 2K;
- Poly Haven Asphalt 07 2K;
- Poly Haven Concrete Wall 003 2K;
- Poly Haven Rusty Metal 02 2K;
- Poly Haven Wood Planks Grey 2K.

No asumir que esos binarios están en Git.

## Lectura obligatoria

1. `docs/art/README.md`
2. `docs/art/ART-BIBLE.md`
3. `docs/art/ART-PIPELINE.md`
4. `docs/art/BOOTSTRAP-ASSET-LIBRARY.md`
5. `docs/art/OPEN-DECISIONS.md`
6. `docs/art/ASSET-CHECKLIST.md`

## Reglas

- No convertir BASELINE en DECIDED sin evidencia/spike.
- No producir masivamente antes del Visual Direction Spike.
- No copiar IP ajena.
- No bakear texto que deba localizarse.
- No derivar footprint/collision de pixels.
- No editar atlases generados manualmente.
- Todo asset externo debe declarar provenance/licencia.
- CC0 no implica que debamos volcar ZIPs completos al repo: esperar política LFS/provenance.
- Priorizar Building Factory y Character Factory frente a producción manual uno-a-uno.

## Fuente extensa

`docs/research/05-art-direction-and-pipeline-research.md`
