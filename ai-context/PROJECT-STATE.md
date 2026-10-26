# Estado actual

Fecha de consolidación: 2026-10-23.

## Repositorio
- Inicializado.
- Documentación de producto: sí.
- Arquitectura propuesta: sí.
- WBS/EDT: sí.
- Plan maestro de ejecución por fases: sí.
- Plantilla de microtareas para agentes de baja ambigüedad: sí.
- Fase 0 de preparación: cerrada el 2026-10-20.
- ADRs D-046 a D-081: aceptados.
- Charter, contratos, benchmark y backlog inicial de Gate 1: listos.
- Historias del prototipo: sí.
- Riesgos: sí.
- Investigación histórica: sí.
- Investigación avanzada de dirección artística y pipeline: sí.
- Art Bible / Art Pipeline v0.1: documentadas como propuesta de preproducción; no ratificadas como ADR.
- Visual Direction Spike: cerrado el 2026-10-23; baseline `graphic_civic` aprobada, con Art Lab y
  provenance en `docs/execution/phase-2/wp2-14-visual-direction-spike-2026-10-23.md`.
- Blender 5.2.2 LTS: instalado localmente y fijado como toolchain artístico inicial (D-053).
- Librería bootstrap CC0: descargada localmente; aún no versionada en Git.
- Staging artístico local: organizado por fuentes CC0 verificadas, cuarentena de
  licencia/origen pendiente y toolchain; manifests con hashes/provenance y
  validador local disponibles. Los binarios siguen ignorados hasta decidir LFS.
- Estrategia artística self-contained / coste ~0 para Gate 2: decidida (D-054).
- Building Factory / Character Factory: concepto documentado; no implementado.
- Wiki para IA: sí.
- Capa funcional fiscal/urbana: documentada conceptualmente.
- Visión multiperspectiva y trayectoria vital: documentada conceptualmente.
- Modelo de identidad/roles/capabilities: documentado como restricción arquitectónica futura.

## Sistemas: implementado frente a conceptual

### Implementado (código autoritativo y pruebas)

- impuestos y tasas (propiedad, transmisión, tasa de servicios);
- presupuesto municipal con prioridad de gasto y niveles de servicio;
- permisos/licencias y zoning;
- seguros, mantenimiento, banca, subastas e insolvencia;
- contratos públicos con licitación, fianza y ejecución;
- servicios urbanos con cobertura radial;
- empleo agregado y capacidad de alquiler;
- reputación por tres grupos con memoria y decaimiento;
- información imperfecta con expediente de estimaciones;
- IA rival con perfiles de facción, postura y memoria antirrepetición;
- concejo municipal electo, opinión por cinco ejes y transferencia presupuestaria;
- macroeventos económicos acotados con trigger propio, efectos cableados, señales y reacción de IA;
- automatización delegada de propiedad, finanzas y mantenimiento con los mismos comandos y permisos,
  y bandeja de excepciones priorizada.

### Parcialmente implementado

- calles y representación visual del distrito (WP4.15): la topología existe y la calzada bloquea
  celdas, pero no hay red de calles dibujada ni selección de distrito en la UI;
- commuting: el empleo sigue siendo agregado, sin trayectos por agente;
- planificador de la IA: no existe; sólo cadenas inmediatas tras un `dispatch`;
- expediente de inteligencia de las facciones: diferido;
- instrumentación persistente de sesiones de Alpha (D-063): diferida a WP4.16.

### Conceptual / futuro

- múltiples roles y perspectivas política/criminal/inversora/ciudadana jugables;
- historial de carrera y Career Events;
- life simulation, herencia y dinastías.

## Implementación
- Código jugable: sí, baseline vertical coherente de Gate 2 más los sistemas Alpha de WP4.3–WP4.11.
- package.json: sí, raíz y workspaces mínimos de Gate 1.
- CI: sí, checks base en GitHub Actions; desde WP4.11-H incluye lint, typecheck, tests, build,
  format y los smokes de Gate 2 y Alpha.
- assets: runtime procedural generado y versionado como data URIs (68 SVG, manifiesto de 106 KB); no
  hay binarios de arte final ni Blender ejecutado en CI.
- backend: no.
- modelo de datos implementado: contratos shared v1 extendidos de forma aditiva, núcleo autoritativo
  headless de Gate 2, producción física localizada, proyección financiera derivada y distrito
  generado por perfil/seed con identidad de generación persistida (D-064).
- tests: sí, smokes Chromium en CI, contratos, schemas, referencias de snapshot hasta WP4.11,
  arquitectura de fronteras, bucle económico determinista con superficie canónica completa,
  generación y jugabilidad de distritos con fixtures de hash, digestos dorados de conservación del
  tick, mercado de vivienda segmentado con índice de renta, mercado laboral agregado conectado a la
  asequibilidad, presupuesto municipal con recortes, servicios urbanos con cobertura radial,
  contratos con fianza, reputación con atribución, información imperfecta y un escenario transversal
  de Fase 4 con save/load.

## Fase
Gate 1 aprobado `GO` el 2026-10-21; la evidencia técnica de G1-RW-01..04 quedó reunida.
Gate 2 en `GO` para producción representativa desde el 2026-10-23: el responsable confirmó la
prueba manual OK, WP2.15 está cerrado, el benchmark/smoke pasan y WP2.14 aprobó `graphic_civic`.

## Próximo objetivo
Fase 3 cerrada con `GO CONTROLLED ALPHA`. Bajo la excepción D-063 (2026-10-23) el responsable
adelanta la producción de contenido de Fase 4 sin la medición de sesiones reales que exigía
WP3.15; la instrumentación persistente de cohortes/seed queda diferida y debe ejecutarse antes
del cierre de Alpha (WP4.16). La prueba manual del responsable se conserva como evidencia
cualitativa; la medición cuantitativa de 30–60 minutos sigue pendiente para balance financiero.
Los WPs de Fase 4 se ejecutan incrementalmente con plan y checks por WP. WP4.1 (distritos y
generación reproducible) quedó cerrado el 2026-10-23 bajo D-064: perfiles data-driven, anclas
autoradas, expansión procedural, jugabilidad validada, fixtures con hash e inspector de seeds.
WP4.2 (Simulation LOD) quedó cerrado el 2026-10-23 bajo D-065: sistemas del tick nombrados y
medibles, harness de coste por sistema y escala, diez digestos dorados de conservación, crecimiento
sublineal de barrio a ciudad (exponente 0,74 en la media) y LOD agregado documentado pero latente,
porque ningún sistema excede los umbrales en la ciudad máxima que permite el mapa de 64×64.
WP4.3 (oferta y demanda de vivienda) quedó cerrado el 2026-10-23 bajo D-066: demanda segmentada,
deseabilidad por parcela, vacancia y movilidad, índice de renta descubierto por vacancia y acotado,
y conservación observable de toda la evidencia económica anterior.
WP4.4 (empleo y actividad económica) quedó cerrado el 2026-10-23 bajo D-067: mercado laboral
agregado con puestos por planta operativa, índice salarial acotado y propagado al ingreso por
segmento y al presupuesto de renta de los hogares de mercado.
WP4.5 (presupuesto municipal) quedó cerrado el 2026-10-23 bajo D-068: el municipio paga con su caja
real en orden de prioridad, registra descubierto y niveles de servicio, y el recorte reduce la
deseabilidad del barrio.
WP4.6 (servicios urbanos y accesibilidad) quedó cerrado el 2026-10-23 bajo D-069 con el overlay de
mapa diferido a WP4.15: tres servicios con cobertura radial, radio que se satura al crecer, efectos
en accesibilidad, seguridad y calidad, y tasa por unidad ocupada.
WP4.7 (contratos públicos) quedó cerrado el 2026-10-23 bajo D-070: el municipio licita por calendario,
adjudica al menor postor con fianza del 10 % que se conserva, ejecuta con reintento si la tesorería no
alcanza y deja contadores de cumplimiento; la IA rival compite con el mismo comando.
WP4.8 (reputación multidimensional) quedó cerrado el 2026-10-24 bajo D-071: tres grupos con efecto
propio —vecinos, gobierno y banca— valoran de forma opuesta el mismo hecho, la memoria es de 16 hechos
acotados por organización y sólo decae la opinión.
WP4.9 (información imperfecta) quedó cerrado el 2026-10-24 bajo D-072: los accesos público, propio,
inferido y privado se declaran en un registro central, el expediente pertenece a un observador y las
estimaciones se compran con caja, con error declarado y precisión que envejece; ningún digesto dorado se
mueve porque el ruido sale de un arroyo de PRNG separado.
WP4.10 (IA estratégica y facciones) quedó cerrado el 2026-10-24 bajo D-073: dos perfiles con objetivos,
umbrales y puja propios —el conservador reproduce los números históricos, así que la comparación entre
campañas es medible—, posturas que sólo nacen de encuentros reales (sabotaje, desbanco, licitación competida y
roce territorial con la trama a una o dos celdas), memoria de doce acciones en ventana de tres meses y
antirrepetición que escala de −60 al segundo rechazo a salir del menú al tercero. La campaña headless cambió el
diseño: sólo penalizar dejaba al rival con 101 acciones fallidas en doce meses; con la supresión cierra con 12
y 190 ciclos cortados. Ninguna postura ni perfil sale hacia la proyección y siete observables privados del
jugador no mueven la decisión del rival.
WP4.11 (política y elecciones iniciales) quedó cerrado el 2026-10-24 bajo D-074: concejo ficticio de nueve
escaños con legislatura de seis meses y debate dos meses después, cinco ejes de opinión (vivienda, empleo,
seguridad, servicios, impuestos) calculados cada mes desde subsistemas que ya existían y saliencia por segmento
como dato. La transferencia institucional es triple y sobre reglas existentes: el partido que gobierna decide el
orden de recorte del presupuesto, el concejo intenta imponer su propia ordenanza —posponiendo el debate si otra
ley ocupa la mesa, para no borrar nunca una decisión comprada por la jugadora— y su alineamiento modula ±25 puntos
la probabilidad del `LobbyPolicy`. Son tres plataformas exclusivamente datos y ningún candidato, con nomenclatura
ficticia vigilada por prueba. La aceptación está medida: en la campaña de dos años el gobierno alterna con el
estado social (Liga → Suelo Común → Liga → Suelo Común) y con 0 y 50 de influencia la participación, los escaños y
el gobernante salen idénticos; el sistema no mueve ni un saldo. `politics` es el primer agregado de Fase 4 que
entra en `canonicalizeState`, lo que obliga a regenerar los diez digestos dorados —verificado: ocho recuperan su
valor de WP4.10 quitando el bloque y los dos cruces de mes lo recuperan neutralizando la transferencia—.
**WP4.11-H (hardening de sistemas Alpha) quedó cerrado el 2026-10-25 bajo D-075**, antes de WP4.12. Paga la
deuda transversal de WP4.2–WP4.11: el censo electoral sólo admite residentes efectivos (available y
displaced no votan), la tasa de servicios entra en el ánimo fiscal mediante el mismo helper puro que la
cobra (sin doble cobro), `canonicalizeState` cubre los once agregados que faltaban con orden estable y
save/load produce la misma cadena, las referencias de contratos/reputación/inteligencia/facciones se
validan al restaurar, el benchmark mensual mide de verdad el cierre, `lastReason`/`lastAction` del rival
salen de la proyección, la oferta pública y el encargo de inteligencia son jugables de punta a punta, la UI
municipal usa las cuatro categorías reales y muestra el concejo, una ley activa no se re-sortea y la
duración de ordenanzas es única. Los diez digestos se regeneraron con atribución: la serialización
canónica anterior sobre los mismos estados recupera exactamente los diez valores de WP4.11. El cierre
mensual de 800 parcelas domina el coste y cruza el presupuesto p95 de D-065; LOD no se
implementa y la optimización de vivienda queda como deuda medida.
**WP4.11-H.1 (follow-up de corrección) quedó cerrado el 2026-10-25 bajo D-076** sobre el baseline
auditado `83cc25a`, antes de WP4.12 y sin añadir gameplay: `WithdrawPolicy` sólo retira propuestas porque
la ley activa es municipal y caduca sola; el sabotaje no detectado deja de manchar al atacante
(`publiclyAttributedOrganizationId` manda para la reputación, `causedByOrganizationId` es verdad del
motor); el snapshot valida el *tipo* de organización en los roles de empresa; `canonicalizeState` suelta
`clock.runState` y `clock.speed` y guardar corriendo a 4x carga canónicamente igual; los tests de
canonicalización mutan entidades reales; el panel de hacienda muestra la tasa prevista
(`serviceFeeDueNextSettlement`) en vez del acumulado que siempre vale 0; y D-065 se reescribe —cruzar el
disparador de 5 ms abre remediación obligatoria (medir, optimizar exacto, y sólo después LOD)— con el
cierre medido como distribución, hoy sobre 8 layouts × 3 posiciones sintéticas del reloj (p50 ~28 ms,
máximo ~38 ms frente a un tick ordinario de p95 ~0,08 ms; `housing` concentra ~69 %). **Esa distribución
es PROVISIONAL**: no es una campaña longitudinal, así que las muestras de mes 2 y 3 no han vivido el
cierre anterior y llegan sin historia de préstamos, buscadores ni stock acumulado. D-071, el acta de WP4.8
y el resumen de Fase 4 quedan anotados como parcialmente obsoletos donde aún prometían `banks +1` por
desalojo, con la tabla vigente apuntando a `REPUTATION_POLICY.facts`. Antes de WP4.13: (1) reescribir
`measureMonthlyCloses` como campaña longitudinal por semilla, (2) volver a medir, (3) optimizar
`placeSearchers` (`runHousingMarket`) exacto, (4) re-medir, y sólo si sigue fuera, LOD. WP4.12 no debe
añadir trabajo nuevo al cierre sin volver a medir, ahora entendido como "medir longitudinalmente".
**WP4.12 (macroeventos económicos) quedó cerrado el 2026-10-25 bajo D-077** tras reapertura por
auditoría: seis tipos (escasez de materiales, recesión, migración, boom constructivo, crisis de
vivienda, falta de mano de obra) con duración en meses del juego, cota de un evento por tipo (máximo
seis) y modifiers aditivos escalados por intensidad. Trigger mensual determinista con PRNG propio
derivado de la seed y decorrelacionado del económico; el arroyo vive en el snapshot y en el estado
canónico. Los seis modifiers tienen consumidor central: materiales (mercado, arranque de obra y
proyección), renta (`askingRentFor`), demanda y señal de vacancia del mercado de vivienda, deriva
salarial y esfuerzo de obra —nunca un coste en caja artificial—. La IA rival sesga su utilidad por
familia de objetivos con información pública; la proyección publica eventos, intensidad, ventana y
modifiers agregados. Persistencia aditiva con derivación desde la seed para partidas anteriores y diez
digestos regenerados con atribución de superficie. Benchmark longitudinal con A/B
`natural | none | representative | max`, desglose mes 1 / meses 2-3 / maduros 4+ y muestra por cierre
con su carga. El siguiente es la optimización de `placeSearchers` y después WP4.13 (Gameplay LOD y
delegación).
**La optimización exacta de `placeSearchers` quedó hecha el 2026-10-25** (acta
`docs/execution/phase-4/place-searchers-optimization-2026-10-25.md`): los diez digestos no cambian, la
mediana del cierre de vivienda baja de 19,40 a 18,15 ms y la cola del cierre completo mejora hasta un
25 % en los escenarios cargados, pero la media apenas se mueve porque `buildStock` (O(edificios²))
domina el cierre con 17,6 ms de mediana por sí solo. Ese es el siguiente candidato exacto antes de
evaluar LOD.
**WP4.13 (automatización, delegación y LOD mínimo) quedó cerrado el 2026-10-25 bajo D-078**: gestores
diarios de propiedad, finanzas y mantenimiento que emiten los mismos comandos y permisos que la
jugadora (`AssignTenant`, `RequestLoan`+`AcceptLoanOffer`, `RepairBuilding`+`AssignCrewToWorkOrder`),
acotados por día; bandeja priorizada sobre el canal `alerts` existente, ampliado con seguros;
`automation.routineTaskCount` y desglose interno por tipo. Medición en 50/200/800 parcelas: 6/28/121
interacciones manuales frente a 0 del jugador con gestor. Sin LOD nuevo (la deuda de `buildStock`
sigue abierta) y sin `ControlContext` (no hay consumidor). Los diez digestos se regeneran por
superficie. El siguiente es WP4.14 (herramientas internas y balance).
**WP4.14 (herramientas internas y balance) quedó cerrado el 2026-10-25 bajo D-079**: `measureBalance`
(quiebras, vacancia y movilidad, concentración con cuota y HHI, deuda, presupuesto y fila por
organización), `detectInvariantViolations` (cajas, inventarios, tenencia, referencias, préstamos,
automatización, macroeventos y servicios), validador permanente de catálogos, inspector de estado
opt-in (`pnpm state:inspect`) y campaña de balance con seeds registradas
(`pnpm balance:campaign`, 8 semillas × 12 meses × 200 parcelas × 4 estrategias) versionada en
`docs/balance/alpha-baseline-v1.json` y validada por test. Hallazgo: la delegación con mantenimiento
diferido gana caja a la pasiva en 8/8 semillas y elimina la vacancia medida; el mantenimiento
equilibrado queda dominado en caja (31,84 % de vacancia frente a 3,13 %, más coste), registrado como
bandera de balance para tuning posterior, no como invariante rota. El siguiente es WP4.15 (pipeline
artístico y escalado de contenido).
**Revisión del 2026-10-25 (auditoría externa de WP4.14)**: ese dataset **no era una baseline de balance
de gameplay**. La campaña construía el mundo con `createScaledCity`, un arnés de carga que inyecta
5 000 000 de caja y regala parcelas, edificios, inquilinos, préstamos y cuadrillas; con esa caja
`financeCashFloor` no se activa nunca y las cajas finales quedan en 4,8–5,0 millones frente a los 12 000
de la partida real. Se renombra a `docs/balance/synthetic-city-balance-v1.json`
(`worldKind: "synthetic_load_harness"`, conservado como test de esfuerzo) y se añade la baseline jugable
`docs/balance/playable-alpha-baseline-v1.json` (`pnpm balance:playable`): `createInitialState(seed)`,
16 semillas × 12 meses × 4 estrategias ejecutadas **sólo con comandos reales** del jugador, políticas
por `SetMaintenancePolicy`/`SetAutomationPolicy`, rutina de crecimiento idéntica para las cuatro,
`commandAudit` por tipo y determinismo verificado; 62-68 s. Con datos jugables **ninguna estrategia
domina** (ganadoras por semilla: `passive` 8, `delegated_deferred` 5, `maintained` 2,
`delegated_balanced` 1; comparaciones 6/16, 4/16 y 3/16) y el "mantenimiento equilibrado dominado"
queda rebajado a **señal fuerte para investigar**: pierde caja en 12 de 16 semillas pero termina con más
suelo, más edificios y más valor de catálogo. `scripts/build-balance-dataset.mjs` genera los dos
datasets y `balance-dataset.test.ts` valida los dos archivos.
**WP4.15 (pipeline artístico y escalado de contenido) quedó cerrado el 2026-10-25 bajo D-080**:
contrato runtime de assets v1 en shared (edificios con huella, pivote y cuatro estados; personajes con
4/8 direcciones e `idle`/`walk`; hashes y provenance), factoría procedural determinista con 68 SVG en
data URIs (manifiesto de 106 KB, sin binarios ni LFS), integración de edificios en Phaser con pivote y
depth desde metadatos, galería y animación de personajes en el Art Lab, validación de esquema/hashes/
budgets en CI, captura visual con baseline SHA-256 y perfil de 400 sprites a 60 FPS DOM. El arte final
Blender conserva el mismo contrato; la integración de personajes en la escena jugable y el atlas
raster quedan diferidos con decisión registrada. Los smokes de juego siguen verdes con sprites y sus
cajas no se mueven.
**WP4.15-H (endurecimiento pre-cierre, auditoría del 2026-10-25) quedó cerrado el 2026-10-25 bajo
D-081**, sin deshacer commits: `effectiveConstructionWorkRequired` unifica el esfuerzo de obra entre
`StartConstruction` y la proyección; el test de carga de WP4.13 mide diez días reales tras la
maduración; `buildStock` pasa de O(edificios²) a índice espacial de buckets exacto (17,6 → 2,70 ms de
mediana, digestos intactos) y el cierre mensual baja a 15,5–18,9 ms de media según modo macro, aún
fuera del presupuesto p95 y sin hotspot único; la huella participa en depth y posición
(`depthForAsset`/`footprintCenter`) y cada dirección camina con sus propios frames
(`animationFrameFor`); la ruta Blender queda demostrada de extremo a extremo para un edificio y una
variante de personaje (`tools/art-pipeline/blender/runtime_asset.py` +
`scripts/build-blender-assets.mjs`, bundle verificado por `art:blender:check` y consumido por Phaser);
atlas/texture packing y Git LFS se reclasifican como requisitos de Beta con criterio de reapertura
medido y presupuesto de binarios con guarda en CI (`art:binaries:check`); el perfil denso se mide en
Phaser de verdad (400 sprites, cambio de frame y scroll, 60 FPS de mediana) y la regresión visual se
conserva local-only por la inestabilidad del pixel-diff cross-environment; CI usa smoke estructural,
integridad Blender y presupuesto de binarios. Acta en
`docs/execution/phase-4/wp4-15-hardening-2026-10-25.md`.
**WP4.15-H.1 (cámara y Art Lab QA) está implementado el 2026-10-26 bajo D-082 y verificado localmente**: picking mediante la transformación de cámara de Phaser, pan escalado por zoom, zoom anclado al cursor, manifest Blender importable en `src/generated` (PNG en `public`), Art Lab como Asset QA y regresión browser integrada en el smoke Alpha. La simulación no cambia; WP4.16 sigue cerrado hasta completar la verificación CI remota.
**WP4.16 (robustez y cierre alpha) sigue en NO-GO hasta esta revisión y ahora tiene su precondición de
`buildStock` cumplida**; la decisión de LOD agregado con su benchmark posterior forma parte de su
alcance, junto al playtest instrumentado diferido por D-063.

El baseline económico actual cubre calendario
económico (30 minutos reales = un mes a 1×), mercado frente a producción propia, dos cuadrillas
asignables, edificios multiunidad, presupuesto y satisfacción de inquilinos, mantenimiento, rival
público con datos privados ocultos, licitación pública con fianza, reputación por grupos con hechos
registrados, expediente de inteligencia con estimaciones, facciones con memoria y relaciones, concejo municipal
electo que recorta el presupuesto y legisla solo, política
incierta y riesgo con cooldown y conservación de dinero.

El desglose operativo se encuentra en `docs/execution/`. El núcleo determinista, Worker,
snapshot v1, IndexedDB, escena/picking, flujo vertical, benchmark y soak headless están
cerrados. El retest browser carga 500 agentes y 100 estructuras en Worker y Phaser, mide
comandos/backlog/proyección/save-load y cubre 10 minutos a 10 Hz en Firefox y Chromium. Ambos
cumplen los umbrales. Gate 2 queda habilitado. D-055 resuelve el punto `events`/snapshots: los
eventos normales son efímeros, mientras que la memoria histórica se materializará en registros
específicos cuando una regla lo necesite.

El baseline ya valida en código y smoke de navegador: render isométrico/picking, Worker,
tick fijo, seed/PRNG, determinismo, save/load y el primer flujo de producto. Debe seguir midiendo
en sesiones de 30–60 minutos que el ritmo y los trade-offs son comprensibles y sostenibles; la
primera confirmación manual fue OK, pero no incluyó registro cuantitativo.
El HUD incluye un diagnóstico efímero de comandos, transporte y métricas del Worker para que
los playtests puedan identificar rechazos repetidos sin persistir datos no autoritativos.
La comprobación manual básica de esa instrumentación quedó cerrada sin errores ni rechazos;
no reemplaza la validación de producto de Gate 2 ni demuestra todavía agentes funcionales.
La captura de la implementación anterior confirmó una vista técnica. WP2.11 usa una base
map-céntrica con panel operativo superpuesto/plegable, HUD jerarquizado, inspector contextual y
estados legibles; está lista para servir de pantalla representativa a WP2.14 según D-058.

El rework de auditoría quedó implementado bajo D-060. La suite automatizada cubre 100 pruebas,
además de tres benchmarks opt-in; el smoke de producción recorre materiales, producción, compra,
obra, asignación de dos cuadrillas, ocupación, mejora, política, save, reload real, load, rival y
ruta ilegal. Esto cierra la preparación técnica del playtest, no su evidencia humana prolongada.

## Restricciones arquitectónicas que Gate 1 debe respetar

Aunque no implemente multiperspectiva:
- evitar player == company;
- comandos con actor explícito cuando proceda;
- ownership independiente del control;
- organizaciones independientes;
- no hardcodear playerIsMayor/playerIsCriminal;
- no asumir información universal.

## Scope Gate 1

Incluido:
- mapa mínimo;
- cámara;
- interacción;
- simulation core;
- persistencia técnica;
- profiling.

Excluido:
- fiscalidad avanzada;
- banca;
- seguros;
- playable politician;
- playable criminal;
- citizen life simulation;
- ageing/family/dynasty;
- elections;
- multiplayer;
- LLM;
- mundo procedural amplio;
- backend complejo;
- contenido masivo.

## Pregunta de éxito
¿Puede una simulación determinista, desacoplada del render y no acoplada a una única organización del jugador, ejecutarse en navegador con rendimiento suficiente para escalar al prototipo?
