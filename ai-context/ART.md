# Arte — contexto operativo para agentes

## Estado

Landlord dispone ya de dos especificaciones de preproducción completas:

- \`docs/art/ART-BIBLE.md\`
- \`docs/art/ART-PIPELINE.md\`

Ambas son v0.1 y distinguen explícitamente DECIDED, BASELINE y OPEN.

## Decidido

- IP original (D-001).
- 2.5D isométrico como dirección inicial (D-003).
- Phaser confirmado para Gate 1 (D-050).
- React/DOM para HUD y paneles según arquitectura; no para entidades del mundo.

## Baseline pendiente de Visual Direction Spike

- Blender como fuente 3D.
- 3D -> prerender 2D/2.5D.
- EEVEE para batch production.
- cámara ortográfica aproximadamente 45° / 30°.
- footprint 2:1.
- grid de referencia 128x64 y master 2x.
- iluminación canónica.
- personajes prerenderizados en 8 direcciones.
- atlases 2048² multipack.
- PNG RGBA como baseline inicial.
- Git LFS para grandes fuentes binarias.
- Art Lab + Playwright para regresión visual.

## Lectura obligatoria para trabajo artístico

1. \`docs/art/README.md\`
2. \`docs/art/ART-BIBLE.md\`
3. \`docs/art/ART-PIPELINE.md\`
4. \`docs/art/OPEN-DECISIONS.md\`
5. \`docs/art/ASSET-CHECKLIST.md\`
6. documento específico de la tarea.

## Reglas para agentes

- No convertir BASELINE en DECIDED sin evidencia/spike y actualización de decisiones.
- No generar producción masiva antes del Visual Direction Spike.
- No copiar referencias de otras IP.
- No bakear texto operativo que deba localizarse.
- No derivar footprint/collision de pixels.
- No modificar atlases generados manualmente.
- Todo asset externo debe declarar provenance/licencia.

## Fuente extensa

\`docs/research/05-art-direction-and-pipeline-research.md\`
