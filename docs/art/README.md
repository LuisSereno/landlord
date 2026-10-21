# Arte — documentación canónica

Esta carpeta contiene la especificación artística y la ingeniería de contenido de Landlord.

## Documentos principales

- [ART-BIBLE.md](ART-BIBLE.md) — documento canónico v0.1 de dirección visual: principios, cámara, escala, arquitectura, materiales, personajes, VFX, UI, accesibilidad, zoom y criterios de legibilidad.
- [ART-PIPELINE.md](ART-PIPELINE.md) — especificación técnica v0.1 del pipeline: Blender, templates, render headless, naming, metadata, anchors, atlases, Phaser, CI, provenance y QA.
- [VISUAL-DIRECTION-SPIKE.md](VISUAL-DIRECTION-SPIKE.md) — prueba que debe validar o rechazar los baselines antes de producción masiva.
- [OPEN-DECISIONS.md](OPEN-DECISIONS.md) — matriz de parámetros todavía abiertos.
- [ASSET-NAMING.md](ASSET-NAMING.md) — referencia rápida de naming/anchors/atlas.
- [PERFORMANCE-BUDGET.md](PERFORMANCE-BUDGET.md) — budgets preliminares.
- [ASSET-CHECKLIST.md](ASSET-CHECKLIST.md) — Definition of Done.
- [CONTRIBUTING-ART.md](CONTRIBUTING-ART.md) — reglas de contribución artística y provenance.

La investigación que sustenta estas especificaciones permanece en [../research/05-art-direction-and-pipeline-research.md](../research/05-art-direction-and-pipeline-research.md).

## Gobernanza

Los documentos principales usan tres estados:

- **DECIDED** — decisión vigente del proyecto.
- **BASELINE** — propuesta operativa que debe validarse.
- **OPEN** — decisión pendiente.

La Art Bible y el Art Pipeline ya son documentos de trabajo completos, pero continúan en versión de preproducción hasta que el Visual Direction Spike cierre cámara, escala, estilo, tooling y budgets.

Si existe contradicción con \`ai-context/DECISIONS.md\`, prevalece la decisión aceptada más reciente.

## Regla de producción

No comenzar producción masiva de edificios/personajes antes de validar:

1. cámara;
2. grid y escala;
3. lighting rig;
4. un asset completo de extremo a extremo;
5. atlas/metadata;
6. integración Phaser;
7. Art Lab;
8. budgets de rendimiento.
