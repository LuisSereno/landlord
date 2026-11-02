# Prompt operativo — V.d-7C Interactive Development Placement & Construction Choreography

Usar con un agente de código de alta capacidad, preferentemente Luna High.

## Misión

Implementar V.d-7C para que construir sea una decisión espacial visible del jugador sin copiar interfaces, arte, nombres ni trade dress de Constructor, Street Wars o Mob Rule.

Landlord debe conservar ciudad 3x3, parcelas multi-cell, road frontage, DevelopmentCode, setbacks, coverage/FAR, multi-parcel sites, materiales, crews, producción, servicios y determinismo.

El jugador debe elegir visualmente una colocación legal entre candidatos deterministas generados por el MISMO algoritmo autoritativo que actualmente hace la autocolocación.

## Lectura obligatoria

Leer antes de modificar código:
1. AGENTS.md
2. ai-context/README.md
3. ai-context/PROJECT-STATE.md
4. ai-context/DECISIONS.md
5. ai-context/ARCHITECTURE.md
6. ai-context/PLAYER-MODEL.md
7. ai-context/GAME-DOMAIN.md
8. docs/INDEX.md
9. docs/product/10-interactive-development-placement.md
10. docs/engineering/adr/D-097-interactive-development-placement.md
11. docs/execution/phase-4/vd7c-interactive-development-placement-plan.md
12. docs/engineering/adr/D-096-contrato-multi-parcela.md

## Regla arquitectónica principal

No crear un algoritmo de placement en React o Phaser.

Debe existir una sola fuente autoritativa:

enumerate legal candidates -> canonical candidates -> human chooses OR AI chooses best -> StartConstruction -> simulation revalidates -> ConstructionSite exact footprint/orientation

## Preflight

Verificar git status, branch, HEAD, origin y ejecutar lint, typecheck, format, full tests, build, smoke:alpha, smoke:vd-core-loop y smoke:vd-ux antes de tocar código.

Trabajar en una rama wip/vd7c-interactive-development-placement. No hacer push a develop.

## Inventario obligatorio

Antes de programar localizar exactamente:
- generación actual de footprint;
- setbacks;
- coverage;
- FAR;
- orientation;
- scoring;
- frontage;
- overlap validation;
- StartConstruction;
- AI callers;
- automation callers;
- tests que fijan el comportamiento.

No empezar la UI hasta comprender el call chain completo.

## Candidate contract

Crear un contrato equivalente a DevelopmentPlacementCandidate con ID canónico, districtId, parcelIds, footprintCells y orientation.

El ID debe derivar de buildingType + parcelIds canónicos + footprint signature + orientation. Nunca de índice de array ni UUID aleatorio.

## Enumeración

Refactorizar la autocolocación existente. No duplicarla.

Cada candidato debe respetar exactamente las reglas vigentes de parcela, DevelopmentCode, usos, setbacks, coverage, FAR, edificios existentes, obra activa, vías, espacios públicos, orientación y acceso/frontage.

Tests mínimos: un candidato, múltiples, ninguno, cuatro orientaciones, deduplicación simétrica, obstáculos, setback, coverage, FAR, dos parcelas, tres parcelas, parcelIds desordenados y Maps desordenados.

Demostrar que el candidato recomendado del nuevo enumerador reproduce el resultado de la autocolocación anterior en fixtures representativas.

## StartConstruction

Preferencia: StartConstruction recibe parcelIds, buildingType y placementId.

Para jugador, placementId se selecciona en UX. AI y automation enumeran y seleccionan el mejor candidato con las mismas reglas.

Simulation vuelve a enumerar/revalidar al ejecutar. Un candidato stale se rechaza sin gastar caja, materiales, permiso ni crear site.

## Worker/projection

No publicar todos los footprints legales de toda la ciudad permanentemente.

Preferir una request read-only tipo GetDevelopmentPlacementCandidates con districtId, parcelIds y buildingType, que devuelva ID, footprintCells, orientation y opcional recommended.

La request no avanza ticks, no toca PRNG, no modifica GameState y no expone planes privados del rival.

## UI state

Crear un PendingPlacement temporal en React: buildingType, parcelIds, candidates y selectedCandidateId.

Una parcela: BuildCatalog -> Elegir ubicación -> placement -> Confirmar.

Dos/tres parcelas: BuildCatalog -> assembly 2/2 o 3/3 -> placement -> Confirmar.

No persistir PendingPlacement.

## Cancel

Escape/Cancelar antes de confirmar no debe crear site ni gastar caja/materiales ni consumir permiso.

## Ghost

Crear placementGraphics/placementGhost separados de overlays y selection.

Usar asset real con alpha si anchor/orientation son fiables; si no, footprint proxy Graphic Civic.

El ghost debe mostrar footprint exacto, orientation y relación con frontage. No copiar cursores ni lenguaje visual de juegos históricos.

## Pointer/orientation

No recalcular candidatos en pointermove. Precalcular geometría/hit areas.

El puntero sólo selecciona el candidato legal más cercano.

Rotar significa cambiar a otro candidato legal con otra orientación; nunca rotar sólo el sprite si el dominio no tiene una huella legal equivalente.

Controles: Anterior, Siguiente, Rotar, Confirmar, Cancelar, click directo, Escape y Enter cuando proceda.

## Feedback

Si no hay candidatos, mostrar explicación player-facing: no cabe respetando normativa, falta superficie edificable, combinación de parcelas inválida, etc. No mostrar códigos técnicos como mensaje primario.

## Single parcel browser

New game -> comprar parcela -> elegir vivienda -> placement -> ver candidato -> elegir alternativa si existe -> confirmar -> ConstructionSite footprint igual al preview -> asignar crew -> completar.

Probar cancel sin efectos y double confirm sin duplicar construcción.

## Two-parcel browser

Warehouse/brickworks/cement: assembly 1/2 -> 2/2 -> placement -> candidate over union -> confirm. Verificar parcelIds exactos y que no use una cuarta parcela.

## Three-parcel browser

Steelworks: 1/3 -> 2/3 -> 3/3 -> placement real. Si economía normal bloquea iniciar obra, no inyectar recursos; verificar el preview y documentar el bloqueo legítimo.

## Save/load

Placement abierto antes de confirmar no persiste y no crea site.

Después de confirmar, save/load debe conservar parcelIds, footprint, orientation, progress y crew assignment.

## Construction choreography

No cambiar workRequired ni economía.

Derivar stages visuales desde progress: foundation, structure/scaffolding, finishing, complete. Crear helper puro y tests.

El site siempre debe ocupar el footprint exacto elegido.

## Crew choreography

Usar únicamente información autoritativa existente. Si el dominio tiene position/route/task y no se proyecta, añadir la mínima proyección.

No simular visualmente trabajadores desconectados de simulation.

Objetivo visual: assigned -> travelling -> on-site -> working -> released.

## Property grounds

Después de estabilizar placement, crear planner determinista render-only para jardín/path/hedge/fence en residencial y hardstanding/service yard/pallets/containers/loading en industria.

No overlap con roads, public spaces ni footprint. No afectar ownership, buildability, production ni valuation.

## Performance

Medir candidate enumeration p50/p95, candidate count, placement FPS y normal FPS.

Stress: enter/cancel placement 50 veces y comprobar sprites/listeners/memoria.

No enumerar candidatos cada frame. Cache sólo tras medir y con claves autoritativas relevantes.

## Balance/generator

Prohibido cambiar costes, recursos, workRequired, rentas, producción, precios de parcela, préstamos, facilities o generador urbano para facilitar demos.

## Browser hooks

Hooks sólo observacionales: placement state, candidates, selected candidate, ghost geometry, site footprint, visual stage. No pueden dar dinero ni ejecutar acciones invisibles para el jugador.

## Golden evidence

Crear docs/art/golden/vd7c con 16 PNG: single recommended, single alternative, rotated, two-parcel, three-parcel, no-placement, foundation, structure, finishing, complete residential, complete industrial, crew on-site, residential grounds, industrial grounds, 1280x720 y 1920x1080.

Abrir y revisar las 16. No basta con generarlas.

## Accessibility

Placement usable por teclado, focus visible, aria-labels, Escape, Enter y feedback no dependiente sólo del color.

## Gates finales

Ejecutar lint, typecheck, format, full tests, build, smoke:alpha, smoke:vd-core-loop, smoke:vd-ux, art:assets:check y art:binaries:check.

Si cambia simulation hot path, ejecutar benchmark focal. Si cambia snapshot/canonical, ejecutar suites completas de persistencia/canonicalización.

## Commits

Separar refactor de enumerador, command/protocol, UI, Phaser, tests, choreography, grounds, evidence y docs.

## Stop conditions

Detener y reportar antes de improvisar si requiere cambiar economía/generator, duplicar reglas, romper snapshots no aditivamente, usar nondeterminismo, dar reglas distintas a AI o copiar trade dress histórico.

## Merge policy

Push sólo a wip/vd7c-interactive-development-placement. No merge a develop.

## Cierre

Sólo declarar V.d-7C READY FOR HUMAN PLAYTEST si existe un único enumerador autoritativo, determinismo PASS, AI parity PASS, 1 parcel PASS, 2 parcel PASS, 3 parcel preview PASS, cancel PASS, stale PASS, save/load PASS, construction stages PASS, 16/16 screenshots revisadas, gates PASS, P0=0 y P1=0.

No declarar V.d CLOSED ni HUMAN PLAYTEST PASS.

## Salida final

Reportar estado, Git, inventario del placement anterior, arquitectura, candidate identity, command contract, determinismo, human flow, AI/automation parity, single parcel, multi-parcel, cancel/stale, save/load, construction choreography, crew choreography, property grounds, tests, smokes, performance, screenshots, P0/P1/P2, deuda y decisión. No merge.