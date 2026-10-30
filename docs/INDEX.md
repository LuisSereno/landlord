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
- engineering/adr/README.md — decisiones arquitectónicas/técnicas detalladas; D-046 a D-052 cubren Gate 1, D-053/D-054 fijan el arranque artístico, D-055 resuelve eventos, D-056 a D-060 gobiernan el baseline económico de Gate 2, D-061 exige el spike de agentes, daño e incidentes, D-062 fija la producción física localizada, D-063 registra la excepción de entrada a Alpha, D-064 la generación procedural de distritos, D-065 el coste medido del tick con el LOD espacial latente, D-066 el mercado de vivienda segmentado con precio descubierto por vacancia, D-067 el mercado laboral agregado y su conexión con la capacidad de alquiler, D-068 el presupuesto municipal con prioridad de gasto y niveles de servicio, D-069 los servicios urbanos con cobertura radial, D-070 los contratos públicos con licitación, fianza y ejecución, D-071 la reputación multidimensional con tres grupos y memoria de hechos, D-072 el registro de accesos con expediente de estimaciones imprecisas, D-073 los perfiles de facción con postura por encuentro y memoria antirrepetición, D-074 el concejo municipal electo con opinión por ejes y transferencia del presupuesto, D-075 el hardening transversal de los sistemas Alpha y D-076 el follow-up de corrección que la auditoría de ese hardening exigió antes de WP4.12; D-077 a D-086 cubren macroeventos, delegación, herramientas internas, contrato de assets, binarios, cámara, licencias, promoción del renderer Graphic Civic y topología vial; D-087 a D-092 gobiernan V.d (ciudad 3×3, SnapshotV2, tejido urbano, mercados por distrito y equipamientos municipales); **D-093** cierra la integridad urbana dejada por esas fases: identidad espacial `districtId + cell`, huella de edificio autoritativa, contrato completo de permiso, servicios ligados al edificio físico y `RuntimeAssetManifestV2`; **D-094** (V.d-H2) reancla la demanda al desarrollo urbano, sustituye el Voronoí estricto por greedy capacity-aware, calibra la capacidad por servicio, suaviza la respuesta al presupuesto, expone cobertura potencial en parcelas vacantes y completa la presentación fiel al footprint físico (catálogo procedural 15/15, orientación de dominio separada del azimut de cámara).

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
- execution/phase-3/wp3-8-zoning-permits-2026-10-23.md — zoning, usos permitidos, permisos y caducidad.
- execution/phase-3/wp3-9-auctions-insolvency-2026-10-23.md — subastas, refinanciación, ejecución e insolvencia inicial.
- execution/phase-3/wp3-10-rival-financial-ai-2026-10-23.md — IA rival financiera, liquidez, recuperación y persistencia.
- execution/phase-3/wp3-11-municipal-policy-2026-10-23.md — catálogo municipal, trade-offs, lobby, retirada y efectos económicos.
- execution/phase-3/wp3-12-automation-ux-2026-10-23.md — rutina de cartera, excepciones, comparador y overlays operativos.
- execution/phase-3/wp3-14-persistence-observability-2026-10-23.md — saves phase3-dev, autosave local, corrupción y observabilidad.
- execution/phase-3/wp3-15-validation-2026-10-23.md — suite, smoke, benchmark, soak y decisión condicional del slice.
- execution/phase-4/wp4-1-districts-generation-2026-10-23.md — perfiles de distrito, generación determinista desde seed, jugabilidad validada, fixtures con hash e inspector.
- execution/phase-4/wp4-2-simulation-lod-2026-10-23.md — coste del tick por sistema y escala, digestos dorados de conservación, verificación diferencial y LOD agregado latente.
- execution/phase-4/wp4-3-housing-market-2026-10-23.md — demanda segmentada, deseabilidad por parcela, vacancia, movilidad, índice de renta acotado y conservación de la evidencia económica.
- execution/phase-4/wp4-4-employment-2026-10-23.md — mercado laboral agregado, salario acotado, ingreso por segmento y conexión con la asequibilidad de la vivienda.
- execution/phase-4/wp4-5-municipal-budget-2026-10-23.md — caja municipal real, gasto por prioridad, recortes con nivel de servicio y efecto en la deseabilidad.
- execution/phase-4/wp4-6-urban-services-2026-10-23.md — transporte, seguridad y limpieza con cobertura radial, saturación de capacidad, tasa por ocupación y overlay diferido.
- execution/phase-4/wp4-7-public-contracts-2026-10-23.md — autoridad municipal, licitación al menor postor, fianza que se conserva, ejecución con reintento y competencia de la IA por el mismo comando.
- execution/phase-4/wp4-8-reputation-2026-10-24.md — tres grupos con valoraciones opuestas del mismo hecho, memoria acotada, decaimiento sólo en la opinión y tres canales de efecto real.
- execution/phase-4/wp4-9-information-2026-10-24.md — accesos público/propio/inferido/privado, expediente por observador, estimaciones con error y antigüedad y pruebas de fuga e invariancia.
- execution/phase-4/wp4-10-strategic-ai-factions-2026-10-24.md — dos perfiles de facción con objetivos y umbrales, postura formada por encuentros, memoria acotada con antirrepetición medida en campaña y cota de información ejecutable sobre la IA rival.
- execution/phase-4/wp4-11-municipal-politics-2026-10-24.md — concejo ficticio de nueve escaños, cinco ejes de opinión leídos del estado social, voto y participación con resto mayor y la transferencia institucional sobre el presupuesto, el debate y el cabildeo.
- execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md — censo electoral efectivo, tasa de servicios en el ánimo fiscal, estado canónico completo y estable, referencias de snapshot hasta WP4.11, benchmark mensual real, fin de la fuga del rival, UI de oferta/inteligencia/concejo, ordenanza activa y duración única, y CI verde con smoke Alpha.
- execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md — correcciones que pidió la auditoría de WP4.11-H: ley activa no retirable, atribución pública del sabotaje, tipos de organización en el snapshot, canonicalidad del reloj, tasa de servicios visible, gobernanza de rendimiento y reconciliación de la documentación de reputación (D-076).
- execution/phase-4/wp4-15-vc2a-road-topology-design-2026-10-27.md — diseño de la topología vial autoritativa: semánticas obstacle/road/parcel/open separadas, segmentos con celdas derivadas, medición de 24 distritos reales y contrato de proyección (D-085).
- execution/phase-4/wp4-15-vc-promote-visual-slice-2026-10-27.md — promoción Graphic Civic a gameplay y cierre de V.c.1/V.c.2C desde la proyección autoritativa.
- execution/phase-4/wp4-15-vc2c-hardening-2026-10-27.md — hardening posterior a la revisión remota: lint, contratos, harnesses, documentación y auditoría de archivos históricos.
- execution/phase-4/wp4-15-vc3a-junction-pedestrian-language-2026-10-27.md — pasos de peatones y marcas discretas derivados de T/intersecciones reales, sin ampliar la topología ni el gameplay.
- execution/phase-4/wp4-15-vc3-street-dressing-2026-10-27.md — cierre V.c.3B/C: mobiliario urbano y vehículos aparcados deterministas, QA browser y rendimiento.
- execution/phase-4/playtest-30min-2026-10-28.md — playtest instrumentado de 30 minutos a 4×: resultados, P0 de integridad y rendimiento, y secuencias de reproducción.
- execution/phase-4/fase-0-vd-baseline-2026-10-28.md — Fase 0 de V.d: baseline re-ejecutado y archivado, corrección del smoke Alpha rojo, herramienta `tools/urban-benchmark`, corpus morfológico de 28 ventanas y ADRs D-087…D-092 ratificados.
- execution/phase-4/vd0-ciudad-multidistrito-2026-10-28.md — V.d.0 cerrada: WorldState, SnapshotV2 sin compatibilidad v1, ciudad 3×3, gateways, traslados deterministas, ViewProjectionV2 y vista de ciudad, con el gate criterio por criterio y las consecuencias medidas.
- execution/phase-4/vd1-red-vial-manzanas-parcelacion-2026-10-28.md — V.d.1 cerrada: red vial desde RoadAnchor[], manzanas por flood fill, parcelas multi-cell con frente, IDs canónicos, nueve issues y evidencia de 900 distritos; envelopes morfológicos y presupuestos de generación/derivación cumplidos.
- execution/phase-4/vd1-fabric-gate.json — evidencia reproducible del gate V.d.1 (100 city seeds, 900 distritos, métricas, p50/p95 y fecha).
- execution/phase-4/vd2-composicion-urbana-2026-10-28.md — V.d.2 cerrada: roles y códigos urbanísticos, usos, huellas autocolocadas, índices derivados, vivienda/empleo por distrito, política ponderada por población, facciones por manzanas y automatización sin traslados; gate del ciclo inmobiliario en nueve distritos.
- execution/phase-4/vd3-ciudad-civica-2026-10-29.md — V.d.3 cerrada: programa municipal exacto de §4.4, reservas de manzanas antes de parcelar, parcelas públicas intransferibles, espacios públicos y edificios físicos enlazados a `UrbanFacility`, inspector de equipamientos y bloqueo de compra/venta/garantía/obra; gate criterio por criterio y techos de mezcla ajustados con medición.
- execution/phase-4/vd4-densidad-skyline-valor-2026-10-29.md — V.d.4 cerrada: `baseLandValue`/`marketValue`, score entero con desglose, límite mensual del 5 %, ensayo de densidad de corredor con derechos adquiridos, autocolocación por frente/continuidad, overlay de valor y gates de valor, 900 distritos y 64 campañas jugables.
- execution/phase-4/vd5-servicios-espaciales-2026-10-29.md — V.d.5 cerrada: grafo de viaje con gateways y costes enteros, cobertura por capacidad y presupuesto, seguridad/transporte sin radio, helpers únicos de bomberos y salud, amenidades de educación/mercado/parques, overlays de servicio y gate de cobertura/64 campañas.
- execution/phase-4/vd6-presentacion-dressing-2026-10-29.md — V.d.6 cerrada: parcelas multi-cell en el suelo, picking por cualquier celda, seis formas cívicas procedurales, overlays de uso/código/rol y capturas golden de centro, HUD oculto, residencial, industria, valor y densidad.
- execution/phase-4/vd-hardening-2026-10-29.md — acta de cierre de V.d del 2026-10-29 (HEAD `95e8937`), **revisada y reabierta por V.d-H1**: se conserva sin retoques y añade al final la sección «Revisión V.d-H1» con los diez hallazgos y el estado de cada requisito.
- execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md — acta vigente de la fase: los diez hallazgos H1-01…H1-10 corregidos con su test de regresión, los cuatro cambios de golden atribuidos por medida, §2 (12 city seeds, campaña de 24 meses con hitos, smoke del núcleo), §3 (`RuntimeAssetManifestV2`), gates, rendimiento antes/después y deuda real. **V.d no está cerrada.**
- execution/phase-4/vd-h2-presentation-service-closure-2026-10-30.md — acta V.d-H2: los once hallazgos H2-01…H2-11 (footprint físico en proyección y renderer, cobertura 15/15 del catálogo procedural, separación explícita de orientación de dominio vs azimut de cámara, demanda = desarrollo urbano, asignación greedy capacity-aware, capacidad calibrada por servicio, escenarios 25/50/75 % con bandas, respuesta suave al presupuesto, cobertura potencial de vacantes y reconciliación documental de D-093 §7). Un solo golden digest cambia, atribuido en H2-05. Incluye al final la **Revisión V.d-H2.1** (cuatro correcciones posteriores a la auditoría: métricas del informe separadas, suelo vacante tasado por acceso potencial, evidencia de cohortes por servicio y reconciliación del estado Git publicado —push realizado, HEAD de cierre `b750fb3`, `develop` divergido con dos commits de docs remotos—). **V.d sigue sin cerrar: playtest humano pendiente.**
- execution/phase-4/vd-h2-service-baseline.json — baseline H2-04 pre-hardening: doce city seeds canónicas × siete servicios medidos con el modelo antiguo (toda parcela marketable cuenta como demanda). 12 de 14 facilities saturadas al nacer. Congelado en `9284434`, no se reescribe.
- execution/phase-4/vd-h2-service-final.json — resultado H2-07/H2-08 post-calibración: doce seeds × cuatro escenarios (initial, 25 %, 50 %, 75 %). Los cinco capacity services caen en las bandas de diseño.
- execution/phase-4/vd-h21-service-final.json — la misma corrida de doce seeds × cuatro escenarios con la etiqueta de cohorte corregida por servicio (H2.1-03: 75/75/25/17/25; el informe anterior publicaba el scalar global 25). Ninguna capacidad se modificó para cambiar la evidencia.
- execution/phase-4/vd-final-playtest-checklist.md — checklist del playtest humano exigido por §2.4, en `PENDING HUMAN PLAYTEST`: es lo único que impide cerrar la fase junto con dos señales de balance abiertas.
- execution/phase-4/vd-final-fabric-gate.json — re-ejecución del gate de tejido sobre el HEAD de hardening (100 seeds, 900 distritos), archivada aparte para no pisar `vd1-fabric-gate.json`.

## Benchmark morfológico
- `tools/urban-benchmark/README.md` — herramienta offline (OSMnx fijado por versión), las 28 ventanas de
  referencia 4×7, las métricas agregadas extraídas y la atribución ODbL. Ninguna geometría de OSM entra
  en el juego ni en el repositorio.

## Investigación
- research/01-constructor-mob-rule-research.md
- research/02-mechanics-reference.md
- research/03-lessons-learned.md
- research/04-ip-and-preservation-notes.md
- research/05-art-direction-and-pipeline-research.md — investigación avanzada de referencias, Art Bible, pipeline, QA y producción artística.
- research/06-vd-tejido-urbano-investigacion.md — diagnóstico que originó V.d: jerarquía calle → manzana → parcela → edificio, escala física 4 m/celda, y por qué la red vial de D-085 se conserva como esqueleto.
- urban-benchmark/ (provenance, metrics y envelopes) — corpus morfológico de 28 ventanas de cuatro ciudades atlánticas; sólo agregados, con atribución ODbL.

## IA
La carpeta ai-context/ resume todo lo anterior para que un agente pueda incorporarse al proyecto con poco contexto previo.
