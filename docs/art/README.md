# Arte — documentación canónica

Esta carpeta contiene la especificación artística y la ingeniería de contenido de Landlord.

## Documentos principales

- [ART-BIBLE.md](ART-BIBLE.md) — Art Bible v0.1: principios visuales, cámara, escala, arquitectura, materiales, personajes, VFX, UI, accesibilidad y legibilidad.
- [ART-PIPELINE.md](ART-PIPELINE.md) — Art Pipeline Specification v0.1: Blender, templates, render headless, naming, metadata, anchors, atlases, Phaser, CI, provenance y QA.
- [VISUAL-DIRECTION-SPIKE.md](VISUAL-DIRECTION-SPIKE.md) — experimento que debe validar o rechazar los baselines antes de producción masiva.
- [OPEN-DECISIONS.md](OPEN-DECISIONS.md) — matriz de parámetros todavía abiertos.
- [ASSET-NAMING.md](ASSET-NAMING.md) — referencia rápida de naming, anchors y atlases.
- [PERFORMANCE-BUDGET.md](PERFORMANCE-BUDGET.md) — budgets preliminares.
- [ASSET-CHECKLIST.md](ASSET-CHECKLIST.md) — Definition of Done.
- [CONTRIBUTING-ART.md](CONTRIBUTING-ART.md) — reglas para contribución abierta, licencias y provenance.

La investigación extensa permanece en [../research/05-art-direction-and-pipeline-research.md](../research/05-art-direction-and-pipeline-research.md).

## Gobernanza

Los documentos principales usan:

- **DECIDED** — decisión vigente.
- **BASELINE** — propuesta operativa que debe validarse.
- **OPEN** — decisión pendiente.
- **FUTURE** — explícitamente diferida.

La Art Bible y el Art Pipeline ya son especificaciones completas de trabajo, pero continúan en preproducción hasta que el Visual Direction Spike cierre estilo, cámara, escala, tooling y budgets.

Si existe contradicción con `ai-context/DECISIONS.md`, prevalece la decisión aceptada más reciente.

## Regla de producción

No comenzar producción masiva antes de validar:

1. dirección visual;
2. cámara;
3. grid y escala;
4. lighting rig;
5. un asset completo end-to-end;
6. atlas/metadata;
7. integración Phaser;
8. Art Lab;
9. budgets de rendimiento.
