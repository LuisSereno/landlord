# Arte — documentación canónica

Esta carpeta concentra la dirección artística y la ingeniería de contenido de Landlord.

## Estado de gobernanza

La representación 2.5D isométrica y el uso de Phaser para Gate 1 ya están respaldados por las decisiones vigentes del repositorio. El resto de valores concretos de esta carpeta —pipeline Blender a prerender, ángulo exacto, tile de referencia, paleta, atlas, número de direcciones de personaje, budgets y tooling— son **baseline de preproducción v0.1** y deben validarse mediante el Visual Direction Spike antes de convertirse en decisiones irreversibles.

No iniciar producción masiva de assets basándose únicamente en este borrador.

## Documentos

- [ART-BIBLE.md](ART-BIBLE.md) — lenguaje visual, referencias, escala, cámara, materiales, personajes, UI, VFX y audio relacionado con feedback.
- [ART-PIPELINE.md](ART-PIPELINE.md) — DCC, Blender, render headless, atlases, metadata, repositorio, CI e integración con Phaser.
- [ASSET-NAMING.md](ASSET-NAMING.md) — IDs, nombres, anchors, footprints, trim y agrupación de atlas.
- [PERFORMANCE-BUDGET.md](PERFORMANCE-BUDGET.md) — presupuestos de textura, draw calls, descarga, QA visual, accesibilidad y localización.
- [ASSET-CHECKLIST.md](ASSET-CHECKLIST.md) — Definition of Done de assets.
- [CONTRIBUTING-ART.md](CONTRIBUTING-ART.md) — contrato de contribución artística y provenance.
- [VISUAL-DIRECTION-SPIKE.md](VISUAL-DIRECTION-SPIKE.md) — experimento de preproducción que debe ratificar o rechazar el baseline.
- [OPEN-DECISIONS.md](OPEN-DECISIONS.md) — decisiones artísticas/técnicas todavía abiertas.

La investigación extensa que sustenta estos documentos se conserva en [../research/05-art-direction-and-pipeline-research.md](../research/05-art-direction-and-pipeline-research.md).

## Regla de fuente de verdad

Si esta carpeta entra en conflicto con `ai-context/DECISIONS.md`, prevalece la decisión aceptada más reciente. Una recomendación de investigación no equivale por sí sola a una decisión de arquitectura o producto.
