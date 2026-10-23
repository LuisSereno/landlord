# Índice maestro de documentación

## Producto
- product/01-product-vision.md — visión, pilares y límites.
- product/02-game-design.md — bucles jugables y sistemas.
- product/03-economy-and-real-estate.md — economía, suelo, deuda e inmuebles.
- product/04-crime-and-factions.md — economía ilegal, policía y facciones.
- product/05-politics-and-society.md — política municipal, votantes y regulación.
- product/06-ai-and-emergent-simulation.md — comportamiento, memoria y emergencia.
- product/07-long-term-progression.md — progresión, distritos y longevidad.
- product/08-fiscality-operations-and-public-economy.md — impuestos, tasas, licencias, mantenimiento, banca, servicios urbanos y economía pública.
- product/09-multi-perspective-life-simulation.md — visión de persona persistente, roles transitables, Gameplay LOD y posibles perspectivas futuras.

## Ingeniería
- engineering/01-architecture.md — arquitectura objetivo.
- engineering/02-simulation-engine.md — motor de simulación.
- engineering/03-web-stack.md — stack web.
- engineering/04-persistence.md — snapshots, guardados y backend.
- engineering/05-ai-architecture.md — arquitectura de agentes.
- engineering/06-multiplayer-future.md — preparación para multijugador.
- engineering/07-player-identity-roles-and-capabilities.md — separación entre jugador, persona, organización, rol, control y capabilities.
- engineering/adr/README.md — decisiones arquitectónicas/técnicas detalladas; D-046 a D-052 cubren Gate 1, D-053/D-054 fijan el arranque artístico, D-055 resuelve eventos, D-056 a D-060 gobiernan el baseline económico de Gate 2 y D-061 exige el spike de agentes, daño e incidentes.

## Arte
- art/README.md — entrada a la documentación artística y estado de gobernanza.
- art/ART-BIBLE.md — dirección visual v0.1, lenguaje de formas, escala, cámara, UI, VFX y legibilidad.
- art/ART-PIPELINE.md — pipeline Blender/prerender/atlases/Phaser, automatización y repositorio.
- art/ASSET-NAMING.md — convenciones de IDs, nombres, anchors, footprints y atlases.
- art/PERFORMANCE-BUDGET.md — budgets y QA visual, accesibilidad y localización.
- art/ASSET-CHECKLIST.md — Definition of Done de assets.
- art/CONTRIBUTING-ART.md — reglas para contribución abierta, licencias y provenance.
- art/VISUAL-DIRECTION-SPIKE.md — experimento que debe validar la dirección antes de producción masiva.
- art/OPEN-DECISIONS.md — matriz de decisiones artísticas todavía no ratificadas.
- art/BOOTSTRAP-ASSET-LIBRARY.md — librería CC0 descargada, estrategia coste ~0, Building/Character Factory y reglas de staging.

## Planificación
- planning/01-roadmap.md
- planning/02-wbs-edt.md
- planning/03-user-stories.md
- planning/04-estimates-and-team.md
- planning/05-risk-register.md
- planning/06-gates-and-mvp.md

## Ejecución
- execution/README.md — entrada al plan maestro ejecutable por fases.
- execution/00-modelo-de-ejecucion.md — gobierno, calidad, gates y uso de agentes.
- execution/01-fase-0-preparacion.md — cierre de definición y preparación del backlog.
- execution/02-fase-1-gate-1.md — viabilidad técnica y desglose detallado.
- execution/03-fase-2-gate-2.md — prototipo y viabilidad de producto.
- execution/04-fase-3-vertical-slice.md — profundidad representativa y evaluación comercial.
- execution/05-fase-4-alpha-sistemica.md — ciudad y sistemas conectados a escala.
- execution/06-fases-5-y-6-beta-lanzamiento.md — estabilización, release y operación.
- execution/07-expansiones-futuras.md — roles, perspectivas y life simulation no comprometidos.
- execution/PLANTILLA-TAREA-LUNA.md — contrato para tareas pequeñas y poco ambiguas.
- execution/SECUENCIA-LUNA.md — colas de ejecución y criterio para usar el nivel mínimo seguro.
- execution/MATRIZ-TRAZABILIDAD.md — gates, capacidades, evidencia y fuentes.
- execution/phase-0/PHASE-0-CLOSURE.md — acta de cierre de Fase 0 y entrada operativa a Gate 1.
- execution/phase-0/gate-1-charter.md — alcance, demo, evidencia y decisión del gate.
- execution/phase-0/contracts.md — wire contracts, entidades mínimas y snapshot v1.
- execution/phase-0/benchmark-plan.md — fixture, metodología y budgets.
- execution/phase-0/risk-and-evidence-matrix.md — riesgos, señales y pruebas de cierre.
- execution/phase-0/gate-review-template.md — plantilla de decisión GO/REWORK/STOP.
- execution/phase-0/gate-1-backlog.md — WP1.1 y WP1.2 preparadas para Luna.
- execution/phase-1/benchmark-baseline-2026-10-20.md — baseline headless y smoke de navegador de WP1.14.
- execution/phase-1/soak-baseline-2026-10-20.md — baseline headless y procedimiento de soak de WP1.15.
- execution/phase-1/gate-1-review-2026-10-20.md — acta de auditoría y decisión de Gate 1.
- execution/phase-1/gate-1-retest-2026-10-21.md — evidencia del retest continuo y del navegador de Gate 1.
- execution/phase-2/gate-2-baseline-2026-10-21.md — baseline de implementación y smoke reproducible del bucle de producto.
- execution/phase-2/wp2-15-implementation-2026-10-22.md — informe de implementación de agentes, daño e incidentes.
- execution/phase-2/gate-2-review-2026-10-23.md — decisión `CONDITIONAL GO` y condición visual de cierre.
- execution/phase-3/wp3-2-implementation-2026-10-23.md — evidencia de producción física localizada.
- execution/phase-3/wp3-3-financial-projection-2026-10-23.md — baseline de posición financiera y previsión de caja.
- execution/phase-3/wp3-4-banking-debt-2026-10-23.md — banco independiente, deuda, amortización, mora y persistencia.
- execution/phase-3/wp3-5-taxation-2026-10-23.md — tasas de transmisión y propiedad, exenciones y liquidación.
- execution/phase-3/wp3-6-maintenance-2026-10-23.md — mantenimiento automático, deterioro, política y backlog.
- execution/phase-3/wp3-7-insurance-2026-10-23.md — aseguradora, coberturas, primas, claims y exclusiones.

## Investigación
- research/01-constructor-mob-rule-research.md
- research/02-mechanics-reference.md
- research/03-lessons-learned.md
- research/04-ip-and-preservation-notes.md
- research/05-art-direction-and-pipeline-research.md — investigación avanzada de referencias, Art Bible, pipeline, QA y producción artística.

## IA
La carpeta ai-context/ resume todo lo anterior para que un agente pueda incorporarse al proyecto con poco contexto previo.
