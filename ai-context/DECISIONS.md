# Registro de decisiones vigentes

## D-001 — IP original
Estado: decidido.
Landlord no será un remake ni reutilizará contenido protegido de las referencias históricas.

## D-002 — Web primero
Estado: decidido para validación.
Primera plataforma: navegador de escritorio.

## D-003 — 2.5D isométrico
Estado: decidido como dirección inicial.
No empezar con 3D completo.

## D-004 — TypeScript
Estado: propuesto con alta confianza.

## D-005 — Phaser
Estado: motor principal propuesto para el spike.
Se revisará si Gate 1 demuestra una limitación.

## D-006 — React
Estado: propuesto para HUD y paneles, no para representar entidades del mapa.

## D-007 — Simulación desacoplada
Estado: decisión arquitectónica fuerte.
Simulation no depende de render.

## D-008 — Web Worker
Estado: decidido para Gate 1.

## D-009 — IndexedDB
Estado: decidido para persistencia local inicial.

## D-010 — Single-player primero
Estado: decidido.
Multiplayer queda diferido.

## D-011 — Mundo por distritos
Estado: decidido conceptualmente.
No perseguir un mapa físicamente infinito.

## D-012 — Política municipal
Estado: decidido como sistema del producto.
En MVP sólo ordenanza/influencia mínima.

## D-013 — IA sistémica
Estado: decidido.
Utility, planning y memory antes que LLM.

## D-014 — LLM
Estado: futuro opcional.
Sólo narrativa estructurada, nunca autoridad del estado.

## D-015 — No Kubernetes temprano
Estado: decidido.
Introducir infraestructura compleja sólo cuando exista necesidad demostrada.

## D-016 — Data-driven
Estado: decidido como principio.

## D-017 — Automatización
Estado: principio de UX.
Crecer no debe multiplicar clics linealmente.

## D-018 — Headless simulation
Estado: decidido.
Necesario para tests y balance.

## D-019 — Política no separada
Estado: decidido.
La política debe modificar economía, urbanismo, policía y sociedad; no ser un minijuego aislado.

## D-020 — Facciones autónomas
Estado: objetivo de diseño.
Las facciones deben interactuar entre sí, no existir sólo contra el jugador.

## D-021 — Fiscalidad como sistema estratégico
Estado: decidido conceptualmente.
Impuestos y tasas afectarán rentabilidad, localización, precios, política y presupuesto municipal. Su liquidación rutinaria será automática.

## D-022 — Urbanismo regulado
Estado: decidido conceptualmente.
Zonificación, licencias, cambios de uso y determinadas inspecciones formarán parte de la economía urbana, evitando convertirlos en trámites repetitivos.

## D-023 — Operación de activos
Estado: decidido conceptualmente.
Mantenimiento, deterioro y seguros formarán parte del riesgo financiero de la propiedad. El mantenimiento recurrente debe poder automatizarse.

## D-024 — Sistema bancario y liquidez
Estado: decidido conceptualmente.
Se distinguirán patrimonio, cash, deuda, liquidez y solvencia. Los bancos podrán valorar riesgo y variar condiciones de crédito.

## D-025 — Bancarrota no implica Game Over automático
Estado: decidido conceptualmente.
La insolvencia puede abrir reestructuración, ventas, refinanciación, ejecución o entrada de capital.

## D-026 — Presupuesto municipal real
Estado: decidido para fases posteriores.
La recaudación municipal financiará servicios y estos afectarán la economía urbana.

## D-027 — Mercado con oferta y demanda
Estado: decidido conceptualmente.
Los tenants no serán una fuente infinita. La ocupación dependerá de demanda y capacidad económica.

## D-028 — Empleo conectado a ciudad
Estado: decidido para alpha sistémica.
Los negocios generarán empleo y el empleo afectará demanda residencial, población y política.

## D-029 — Reputación multidimensional
Estado: decidido para fases posteriores.
No habrá una única reputación universal; diferentes actores pueden valorar al jugador de manera distinta.

## D-030 — Información imperfecta
Estado: decidido conceptualmente.
El jugador y las IAs no deben conocer automáticamente todo el estado relevante. Analistas, contactos e investigación podrán reducir incertidumbre.

## D-031 — Contabilidad estratégica, no ERP
Estado: decidido.
Los estados financieros deben permitir decisiones sin obligar al jugador a realizar contabilidad manual.

## D-032 — Nuevas capas por prioridad
Estado: decidido.
Vertical slice prioriza fiscalidad, mantenimiento, seguros, deuda, zonificación, licencias y subastas. Justicia, sindicatos, holdings, equity y concesiones complejas quedan para fases posteriores.

## D-033 — Player no equivale a Company
Estado: decisión arquitectónica fuerte.
El motor debe separar identidad de jugador, persona, propiedad, organización y contexto de control.

## D-034 — Person como identidad persistente compatible
Estado: decidido conceptualmente.
La identidad jugable debe poder vincularse a una Person persistente capaz de acumular historial, relaciones, roles y cargos. Esto no obliga a iniciar el MVP como ciudadano.

## D-035 — Organizaciones independientes
Estado: decidido.
Company, Government, Bank, Union, Media y facciones deben poder existir independientemente de que las controle un humano.

## D-036 — Roles no exclusivos
Estado: visión aprobada de largo plazo.
Una Person puede acumular roles compatibles y perderlos. No diseñar carreras como clases rígidas mutuamente excluyentes.

## D-037 — Capabilities
Estado: decisión arquitectónica.
Las acciones disponibles deben poder resolverse por capabilities derivadas de roles/cargos/ownership/delegación, evitando flags globales playerIsX.

## D-038 — ControlContext
Estado: decidido conceptualmente.
Identidad persistente y perspectiva activa son conceptos separados. El contexto determina organización activa, capabilities, información y UI.

## D-039 — Gameplay LOD
Estado: decidido como principio futuro.
El nivel de detalle operativo cambia según el rol activo. Las capas no prioritarias continúan simulándose pero se delegan o agregan.

## D-040 — Delegación por escala
Estado: decidido como principio.
Acumular poder o cambiar de capa debe reducir la microgestión inferior mediante gestores, políticas y escalado de excepciones.

## D-041 — Trayectorias bidireccionales
Estado: visión aprobada.
Las carreras podrán progresar, retroceder y reconvertirse: empresario, político, criminal, inversor, trabajador, etc.

## D-042 — Career Events
Estado: propuesto con alta confianza.
Las transiciones futuras deberían emerger del estado del mundo más que de un selector artificial de clases.

## D-043 — Perspectiva política como primera extensión
Estado: prioridad futura propuesta.
Si se valida el producto base, Mayor/Politician es la perspectiva alternativa con mayor reutilización de sistemas existentes.

## D-044 — Life simulation completa fuera de alcance
Estado: decidido.
Ciudadano detallado, envejecimiento, familia, generaciones y dinastía no forman parte de Gate 1, Gate 2 ni del vertical slice.

## D-045 — Preservar opcionalidad, no sobreconstruir
Estado: decidido.
Ahora sólo se implementan abstracciones mínimas que eviten bloquear el futuro; no se construye un framework genérico de múltiples juegos antes de necesitarlo.

## D-046 — Toolchain de Gate 1
Estado: decidido el 2026-10-20.
Node 24.19.0, pnpm 12.11.2, TypeScript 6.0.3 strict, Vite 8.3.4, React 19.2.8, Phaser 4.2.1, Vitest 4.1.10, Playwright 1.64.1, Zod 4.4.3, ESLint 10.8.0 y Prettier 3.9.6. Versiones exactas, pnpm workspaces sin orquestador adicional y Chromium + Firefox como baseline. Ver `docs/engineering/adr/D-046-toolchain-gate-1.md`.

## D-047 — Paquetes mínimos de Gate 1
Estado: decidido el 2026-10-20.
Crear sólo `apps/web`, `packages/simulation` y `packages/shared`. `game-data` y demás paquetes se difieren hasta tener consumidores reales. Simulation no depende de web/DOM; shared no depende de simulation. Ver `docs/engineering/adr/D-047-paquetes-gate-1.md`.

## D-048 — PRNG xoshiro128** versionado
Estado: decidido el 2026-10-20.
Implementación interna `xoshiro128ss-v1`, seed uint32, expansión splitmix32, estado de cuatro uint32 y vectores de conformidad. Sin `nextFloat` en Gate 1. El algoritmo forma parte del contrato de save. Ver `docs/engineering/adr/D-048-prng-determinista.md`.

## D-049 — Zod en fronteras y entidades convencionales
Estado: decidido el 2026-10-20.
Zod valida Worker, snapshots, datos y configuración. El dominio usa tipos explícitos, Maps normalizados, IDs deterministas y arrays ordenados al serializar. No ECS en Gate 1. Identidad, organización, control grant y ownership permanecen separados. Ver `docs/engineering/adr/D-049-schemas-y-entidades.md`.

## D-050 — Phaser confirmado para Gate 1
Estado: decidido el 2026-10-20.
Phaser 4.2.1 se usa para el spike isométrico y React para HUD/paneles. Sólo se reabre ante fallos medidos de picking, performance, memoria, compatibilidad o dependencia de internals. Ver `docs/engineering/adr/D-050-phaser-gate-1.md`.

## D-051 — Protocolo Worker y snapshot v1
Estado: decidido el 2026-10-20.
Protocolo y snapshot versionados en `1`, request ID separado de command ID, comandos aplicados al inicio del siguiente tick, rechazos atómicos y representación canónica. El único comando técnico inicial es `PlaceTestStructure`. Ver `docs/engineering/adr/D-051-contratos-gate-1.md`.

## D-052 — Benchmark y budgets de Gate 1
Estado: decidido el 2026-10-20.
Fixture de 64×64, 500 agentes, 100 obstáculos, A* determinista, tick a 20 Hz, benchmark headless/browser y soak de dos horas con umbrales previos. Incumplir produce REWORK; modificar el criterio exige ADR. Ver `docs/engineering/adr/D-052-benchmark-gate-1.md`.


## D-053 — Blender 5.2.2 LTS para toolchain artístico
Estado: decidido el 2026-10-21.
Blender 5.2.2 LTS queda fijado como versión de preproducción para scripts, templates y render headless del pipeline artístico. La rama 5.2 tiene soporte LTS oficial hasta julio de 2028. No se actualizará automáticamente de versión: cualquier cambio debe superar smoke del pipeline y golden renders. Ver `docs/engineering/adr/D-053-blender-5-2-2-lts.md`.

## D-054 — Bootstrap artístico self-contained
Estado: decidido para preproducción/Gate 2 el 2026-10-21.
El Visual Direction Spike y las primeras fases artísticas deben poder ejecutarse sin contratar un artista como dependencia del camino crítico y con objetivo de coste directo cercano a 0 EUR. Se priorizan assets CC0, procedural generation, Building Factory, Character Factory, automatización Blender e IA para concept/reference. Los binarios de terceros permanecen en staging local hasta aprobar LFS/provenance. Ver `docs/engineering/adr/D-054-bootstrap-artistico-self-contained.md`.

## D-055 — Eventos efímeros y registros persistentes derivados
Estado: decidido el 2026-10-21.
Los eventos de dominio normales se emiten a los consumidores del ciclo actual y no forman parte de `GameState` ni de `SnapshotV1`. La memoria histórica que afecte a reglas futuras se modelará mediante registros específicos con schema y retención propios (`TransactionLedger`, `RelationshipHistory`, `CrimeRecord`, `CareerHistory`, etc.). El replay técnico futuro podrá conservar comandos, tick efectivo y checkpoints. Ver `docs/engineering/adr/D-055-eventos-efimeros-y-registros-persistentes.md`.

## D-056 — Baseline económico de Gate 2
Estado: decidido para el prototipo el 2026-10-21.
Gate 2 usa crews agregadas, tenants finitos, producción por ciclos, caja por organización y
un libro de transacciones mínimo. El payload de producto se agrupa bajo `phase2` dentro del
snapshot v1 como extensión aditiva para restaurar fixtures de Gate 1. El rival actúa mediante
el mismo dispatcher y una identidad técnica explícita; no se modela como una segunda identidad
humana del jugador. Ver `docs/execution/phase-2/gate-2-baseline-2026-10-21.md`.

## D-057 — Diagnóstico efímero y acotado de sesión
Estado: decidido para playtests de Gate 2 el 2026-10-21.
El Worker publica métricas de sesión cada 20 ticks y bajo demanda: cola, estructuras y
comandos aceptados o rechazados por código. La web conserva como máximo 120 entradas de
diagnóstico y señala tres rechazos iguales como patrón de playtest. Esta telemetría no entra
en `GameState` ni en snapshots, se reinicia tras inicializar/cargar y no usa reloj de pared
para reglas de simulación. Ver `docs/execution/phase-2/gate-2-baseline-2026-10-21.md`.

## D-058 — Base de presentación antes del Visual Direction Spike
Estado: decidido para Gate 2 el 2026-10-21.
La dirección artística no se comparará sobre la vista técnica actual. Antes de WP2.14 se debe
cerrar una base de presentación de WP2.11: mapa con área útil, HUD jerarquizado, inspector
contextual y estados de juego legibles. Esta decisión no fija estilo, cámara ni assets finales;
evita que el spike mida deficiencias de UI en lugar de una dirección visual. Ver
`docs/execution/03-fase-2-gate-2.md`.

## D-059 — Cierre funcional del baseline jugable de Gate 2
Estado: decidido para el prototipo el 2026-10-21.
El escenario dispone de producción renovable de cemento, ladrillo y acero; una cuadrilla agregada
por organización; cancelación con devolución del 50% entero de materiales y sin devolución de
caja; y mejora de edificio que cuesta recursos, ocupa la cuadrilla y aumenta la renta base un
25%. Una detección en la ruta ilegal aplica una multa máxima de 180 u. La proyección presenta
estos costes, ritmos y efectos, además del libro de caja y el resumen rival. Son reglas de
validación del Gate, no balance final del producto.

## D-060 — Coherencia económica y temporal de Gate 2
Estado: decidido el 2026-10-22.
A 1×, 30 minutos reales equivalen a un mes de 30 días. Gate 2 ofrece compra de materiales frente
a inversión productiva, edificios con varios contratos según `capacity`, presupuesto y
satisfacción funcionales, dos cuadrillas repartibles o concentrables, política con resolución
PRNG incierta, activos rivales públicos sin exponer caja/contratos y reparación con coste, tiempo
y cuadrilla. La ruta ilegal tiene cooldown y conserva el dinero entre organizaciones. Las colas,
referencias y ventanas históricas del snapshot quedan acotadas y validadas. Ver
`docs/engineering/adr/D-060-coherencia-economica-gate-2.md`.

## D-061 — Spike de agentes, daño e incidentes antes del cierre de Gate 2
Estado: decidido como rework de Gate 2 el 2026-10-22.
Gate 2 no puede recibir `GO` sólo con crews agregadas, timers y riesgo ilegal probabilístico.
WP2.15 debe validar agentes individuales visibles, cuadrilla física, mantenimiento, un operativo
hostil mínimo, salud, `condition` + `structuralIntegrity`, fuego, daño espacial, heridas/muerte,
consecuencia económica y save/load determinista. No incluye life simulation, reproducción,
hospital jugable ni catálogo amplio de combate. Sustituye para el cierre del gate la elección de
crews puramente agregadas de D-056 y el punto 5 de D-060. Ver
`docs/engineering/adr/D-061-spike-agentes-dano-incidentes-gate-2.md`.


## D-062 — Producción física localizada después de Gate 2
Estado: decidido para el Vertical Slice el 2026-10-23.
El modelo abstracto `InvestInProduction` de Gate 2 es una simplificación temporal y no el diseño
objetivo. Tras cerrar Gate 2, la producción propia de materiales se realiza mediante edificios
productivos construibles sobre parcelas, sujetos a las mismas reglas físicas y económicas que
otros activos. La parcela aporta aptitudes productivas data-driven que modifican la tasa; el
mercado de materiales continúa como alternativa inmediata. La inversión posterior significa
upgrade de un activo productivo existente, no activación de una instalación invisible. No se
añaden todavía cadenas industriales complejas, energía, minas o materias primas intermedias.
Ver `docs/engineering/adr/D-062-produccion-fisica-localizada.md`.

## D-063 — Excepción al criterio de entrada de Alpha
Estado: decidido el 2026-10-23.
El acta de WP3.15 condiciona la Alpha sistémica a medir sesiones reales antes de ampliar
contenido: duración efectiva de sesión, primera parcela/obra/ingreso, decisiones estratégicas
frente a tareas repetitivas, comprensión de overlays y carga operativa, con seeds y cohortes
registrados. Esa medición cuantitativa de 30–60 minutos sigue pendiente y el repositorio no
dispone de instrumentación persistente de cohortes (el diagnóstico de D-057 es efímero y no
autoritativo). El responsable decide adelantar la producción de contenido de Fase 4 sin esa
medición previa, registrando la excepción. La instrumentación de sesiones de Alpha queda
diferida y debe ejecutarse antes del cierre de Alpha (WP4.16); no convierte una única prueba
manual OK en significancia estadística, sólo reordena el trabajo. Los WPs de Fase 4 se
ejecutan incrementalmente con plan y checks por WP, no de golpe. Ver
`docs/engineering/adr/D-063-excepcion-criterio-entrada-alpha.md`,
`docs/execution/phase-3/wp3-15-validation-2026-10-23.md` y
`docs/execution/05-fase-4-alpha-sistemica.md`.

## D-064 — Generación procedural de distritos con anclas autoradas
Estado: aceptada el 2026-10-23 para WP4.1.
El distrito deja de estar congelado en `PROTOTYPE_PARCELS` y se genera desde perfiles data-driven
(`DistrictProfile`) en dos capas: anclas autoradas (celda, zoning y precio fijos, emitidas primero
para que los ids de referencia sean estables) y expansión procedural (manzanas, zoning por bolsa
ponderada, precio en banda, aptitud con jitter y obstáculos sobre `map.blockedCells`). La
generación consume un flujo PRNG derivado de la seed y del perfil, de modo que el PRNG autoritativo
de la partida conserva la secuencia anterior a WP4.1. La identidad persistente se limita a
`District.generation = { profileId, generatorVersion, seed }`, aditiva y opcional en `SnapshotV1`;
ningún tile, sprite o calle entra en el contrato. Cada intento pasa por una validación de
jugabilidad (parcelas mínimas, mínimo por zoning, concentración máxima, entrada asequible,
separación ortogonal, spawns libres y acceso alcanzable por BFS) con doce reintentos como máximo y
`DistrictGenerationError` explícito si no converge. `barrio_del_umbral` es el perfil de
continuidad: reproduce el suelo autorizado de Fase 3 y declara cero obstáculos, así que la
evidencia de Gate 2 y Fase 3 sigue siendo válida sin reescribir aserciones económicas. Retirar o
renombrar un perfil rompe la carga de partidas que lo referencian y exige decisión de migración.
Ver `docs/engineering/adr/D-064-generacion-procedural-de-distritos.md` y
`docs/execution/phase-4/wp4-1-districts-generation-2026-10-23.md`.

## D-065 — Coste del tick medido por sistema; LOD espacial documentado pero latente
Estado: aceptada el 2026-10-23 para WP4.2.
Los diez sistemas del tick pasan a ser entidades nombradas (`PRODUCT_SYSTEMS` +
`advanceProductSystems`), que son a la vez el orden determinista de D-060 y la unidad de
instrumentación. El coste se mide por sistema y escala con ciudad sintética (`pnpm system:cost`) y
se blinda con diez digestos dorados de conservación, tres de ellos con cascada de incendio, colapso
y bajas. La ciudad máxima factible viene dada por el mapa, que está limitado a 64×64: 828 parcelas,
607 edificios, 951 tenants, 290 agentes y 151 pólizas. Ahí el tick headless mide 0,0498 ms de media
y 0,1152 ms de p95, el 1,2 % del presupuesto, y el crecimiento de barrio a ciudad es sublineal
(exponente 0,74 en la media y 0,72 en p95 para ×10,62 parcelas). Como ningún sistema excede ningún
umbral, la regla del propio WP deja el estado agregado sin implementar: se registran el diseño de
zonas activa/cercana/lejana, derivado del estado de la simulación y nunca de la cámara, y los
disparadores objetivos que lo activarían. Lo que sí se corrige son cinco costes algorítmicos
mediante transformaciones exactas verificadas por comparación diferencial contra la implementación
anterior: `tacticalTick` recorría todas las etapas horarias en cada tick y su paso de técnicos era
O(edificios × agentes) con una copia de la tabla de incidentes dentro del bucle por edificio, la
ignición mensual era O(edificios × incidentes), `settleInsurance` ordenaba toda la cartera en cada
tick siendo las primas mensuales y `settleAuctions` ordenaba una lista vacía. El término lineal que
queda es `settleInsurance` (59,2 % del coste) y necesitaría un índice de primas vencidas con cambio
de formato de guardado. Sustituir `localeCompare` por comparación relacional es 3,8-6,3× más rápido
y elimina una dependencia del locale, pero toca unos veinte puntos incluido `orderEntityIds`;
requiere ADR propio y cambio global. **Revisado por D-076 (WP4.11-H.1):** el disparador de 5 ms saltó en
el cierre mensual y ya no se lee como "implementar LOD". Cruzar un disparador abre una remediación
obligatoria en tres pasos —medir con distribución real, optimizar exacto y sólo después aproximar—, así
que la optimización de `runHousingMarket` (`placeSearchers` es O(búsquedas × unidades)) va antes de
WP4.13. La métrica también se corrigió: el "p95 mensual" de seis muestras era el máximo de un cierre; el
arnés separa `ordinaryTick` y `monthClose` y `measureMonthlyCloses` da una distribución real del cierre. Ver
`docs/engineering/adr/D-065-coste-del-tick-y-lod-latente.md` y
`docs/execution/phase-4/wp4-2-simulation-lod-2026-10-23.md`.

## D-066 — Mercado de vivienda segmentado con precio descubierto por vacancia
Estado: aceptada el 2026-10-23 para WP4.3.
El pool de cuatro hogares autorados se convierte en demanda segmentada (`household`, `maker`,
`shopkeeper`) con presupuesto de renta, tipos preferidos, techo de población, llegadas por mes y
pesos de deseabilidad propios. El hogar gana `size`, `segmentId`, `searchMonths` y `origin`;
`size` sustituye los recuentos codificados de ocupantes del colapso con los mismos valores
autorados, así que las bajas de una partida antigua no cambian. La renta pasa a tener una sola
fórmula, `askingRentFor`, compartida por el cobro, la validación de contrato y la proyección, y
lleva un índice por tipo de edificio. El índice se descubre por vacancia con tres cotas: objetivo
del 8 %, 2,5 puntos por punto de vacancia, paso máximo de ±4 por mes y banda [80, 125]; con menos de
tres edificios del tipo no hay precio, lo que preserva la aritmética exacta de las pruebas del
slice con un solo edificio. La deseabilidad suma cuatro componentes ponderadas por segmento
(calidad, accesibilidad al centro de actividad, seguridad por incidentes cercanos y presión
policial, servicios en radio de 6 celdas). Las llegadas se limitan por tres topes a la vez —techo
de población, plazas libres y plazas asequibles—, de modo que construir caro produce vacancia y no
demanda. El sistema `housing` cierra `PRODUCT_SYSTEMS`: al ir después de `rent`, el precio
descubierto se cobra al mes siguiente. El mercado sólo coloca los hogares que él genera; los
autorados los coloca el jugador y caducan si no encuentran plaza en seis meses, lo que conserva la
decisión de `AssignTenant` y evitó romper la prueba de liquidez de WP3.6. Movilidad contada por fin
de contrato, desalojo y expiración de búsqueda. Persistencia aditiva (`phase2.housingMarket` y
cuatro campos opcionales en `Tenant`) con reconstrucción desde el perfil para partidas antiguas. La
evidencia económica se comparó observable por observable antes y después en los diez casos de
conservación: los diez son idénticos, y los digestos canónicos se regeneran sólo porque el estado
persistido gana campos. Ver `docs/engineering/adr/D-066-mercado-de-vivienda-segmentado.md` y
`docs/execution/phase-4/wp4-3-housing-market-2026-10-23.md`.

## D-067 — Mercado laboral agregado, salario y capacidad de alquiler
Estado: aceptada el 2026-10-23 para WP4.4.
El empleo deja de ser un adorno del atractivo y entra en la capacidad de alquiler. Los puestos son
cuatro por planta productiva operativa; los trabajadores son los hogares contratados, un hogar por
trabajador; los talleres no contratan porque su ocupante es autónomo. No hay asignación
individuo-puesto. El índice salarial parte de 100, se mueve ±3 puntos por mes según
`puestos / trabajadores − 1` con sensibilidad 6 y queda acotado en [90, 120]. Los hogares combinan
empleo con una economía informal que cubre el 85 % de la renta sin puesto; artesanos y comerciantes
son autónomos y siguen el nivel salarial. El índice de ingresos resultante, acotado en [60, 130],
multiplica el presupuesto base de renta de cada segmento (`effectiveRentBudget`), que se recalibra a
260/360/380 para que la renta mínima siga siendo asequible en el suelo de ingresos. En cada cierre
mensual `employment` corre justo antes de `housing`: el ingreso del mes decide qué es asequible
antes de que el mercado admita o coloque a nadie. Sólo los hogares creados por el mercado
recalculan su presupuesto (`incomeFactorPercent`); los autorados conservan el de escenario porque
son fixtures de Gate 2 y Fase 3. Un edificio productivo que deja de estar operativo pierde sus
puestos en el cierre siguiente, y con ellos suben el paro, baja el salario, cae el ingreso y sube la
vacancia: el cierre de planta se propaga a la demanda residencial sin una regla de evento. Los
indicadores de puestos, puestos por sector, trabajadores, paro, salario e ingreso por segmento se
publican en la proyección y en el panel. La escasez de mano de obra no reduce todavía la producción:
el efecto sobre la rentabilidad es indirecto, vía renta y ocupación. La evidencia económica se
comparó de nuevo observable por observable en los diez casos de conservación y sigue idéntica; los
digestos canónicos se regeneran sólo porque el estado gana `phase2.employment` e
`incomeFactorPercent`. Ver `docs/engineering/adr/D-067-empleo-agregado-y-capacidad-de-alquiler.md` y
`docs/execution/phase-4/wp4-4-employment-2026-10-23.md`.

## D-068 — Presupuesto municipal con caja real, prioridad de gasto y niveles de servicio
Estado: aceptada el 2026-10-23 para WP4.5.
El municipio deja de ser un sumidero. Usa una sola caja —el saldo de `org_00000004`, sin segundo
saldo— y `phase2.municipal` guarda el libro: ingresos del mes y acumulados por fuente, gasto y
descubierto por categoría, niveles de servicio y meses en déficit o superávit. Tres categorías con
prioridad declarada: administración (10 fijos), seguridad (1 por edificio) y servicios (2 por
edificio), pagadas en ese orden con la caja real al final del tick, después de que hayan entrado los
impuestos del mes. Sin caja no hay dinero implícito ni deuda: lo que no se paga queda como
descubierto y el nivel de servicio de la categoría cae; un mes con descubierto incrementa
`deficitMonths`. La propiedad (120 pb) y la transferencia (150 pb) ya se enrutaban al municipio;
ahora cada cobro se anota en el libro por fuente. El recorte tiene consecuencia en el mundo: el
nivel de servicios multiplica el componente `services` de la deseabilidad del mercado de vivienda y
el de seguridad resta `(100 − nivel) / 2` puntos de `safety`, de modo que un municipio sin
presupuesto pierde atractivo y ocupación. La prueba de impuestos de WP3.5 cambia de aserción sobre
la caja municipal a aserción sobre el libro, conservando su intención. Los diez casos de
conservación se compararon observable por observable: ocho quedan idénticos y los dos que cruzan un
cierre mensual cambian sólo la caja municipal y el número e importe de transacciones por los pagos.
Ver `docs/engineering/adr/D-068-presupuesto-municipal.md` y
`docs/execution/phase-4/wp4-5-municipal-budget-2026-10-23.md`.

## D-069 — Servicios urbanos con cobertura radial y tasa por unidad ocupada
Estado: aceptada el 2026-10-23 para WP4.6.
La categoría difusa `services` se sustituye por tres servicios con nombre y consecuencia propia:
transporte (2 u. por edificio, radio base 26), seguridad (1 u., radio 30) y limpieza (2 u., radio
20), junto a la administración fija. La cobertura es radial desde el centro del distrito derivado de
las parcelas generadas y no crea entidades nuevas: `coverage = calidad × (1 − distancia / radio)`.
El radio efectivo se satura al crecer (`base × sqrt(40 / max(40, edificios))` con suelo por
servicio), así que la expansión diluye el servicio y el borde queda peor cubierto: la desigualdad
territorial es una consecuencia del modelo, no un caso especial. Cada servicio alimenta un
componente distinto de la deseabilidad: transporte es accesibilidad, seguridad resta
`(100 − cobertura) / 2` a la seguridad y limpieza resta `(100 − cobertura) / 4` a la calidad del
parque. La prioridad de pago es administración → seguridad → transporte → limpieza, de modo que el
recorte cae primero en la limpieza y el borde lo nota primero. La base fiscal se conecta con una
tasa municipal de 3 u./mes por unidad ocupada, anotada en el libro como `serviceFee`: más ocupación,
más ingresos, mejor servicio. No se sube el precio del suelo porque alimenta compras e impuestos con
aserciones exactas de Gate 2 y Fase 3. La cobertura es estado derivado, así que no hay formato nuevo
que migrar; sólo cambian las claves de categoría del libro municipal, tratadas con valor por
defecto. El overlay de mapa se difiere a WP4.15: el dato ya está en la proyección y la explicación
textual en el panel. Ocho de los diez casos de conservación quedan idénticos; los dos con cierre
mensual cambian sólo la caja municipal y sus transacciones. Ver
`docs/engineering/adr/D-069-servicios-urbanos-y-cobertura.md` y
`docs/execution/phase-4/wp4-6-urban-services-2026-10-23.md`.

## D-070 — Contratos públicos con licitación, fianza y ejecución
Estado: aceptada el 2026-10-23 para WP4.7.
La autoridad es el municipio que ya existía (`org_00000004`): no hay organización ni rol nuevo.
Publica en el mes 2 y cada 3 meses, con máximo dos licitaciones activas y ventana de ofertas de un
mes. Dos objetos acotados —obra pública, que exige al menos un edificio operativo del contratista, y
suministro, que no lo exige— con presupuesto declarado en el catálogo; concesiones, servicios
continuos y pliegos variables quedan fuera. Cada organización puede tener una sola oferta por
licitación y un solo contrato en curso, y cada rechazo tiene código propio (`CONTRACT_NOT_FOUND`,
`CONTRACT_CLOSED`, `BID_ALREADY_SUBMITTED`, `BID_EXCEEDS_BUDGET`, `CONTRACT_CONFLICT`,
`CONTRACT_CAPACITY`, `BOND_UNAVAILABLE`). La fianza es fija, el 10 % del presupuesto: se cobra al
adjudicar y se transfiere a la caja municipal, se devuelve al completar y se retiene al incumplir, de
modo que el ciclo conserva el dinero total y no introduce una segunda caja (D-068). Gana la oferta
más baja, con desempate por identificador de organización; sin ofertas, o si nadie puede pagar la
fianza, la licitación queda desierta. La ejecución es un mes después del cierre: si el adjudicatario
ya no mantiene los edificios exigidos incumple y pierde la fianza, y si al municipio no le alcanza la
caja el contrato se reintenta al mes siguiente, porque la tesorería de la autoridad no se disfraza de
incumplimiento del contratista. El rival compite por la misma puerta: puja al 92 % del presupuesto a
través de `SubmitPublicBid` y con las mismas validaciones, sin descuentos ni información privilegiada.
El cumplimiento queda como contadores mínimos (`awarded`, `completed`, `defaulted`), la memoria que
WP4.8 convertirá en reputación multidimensional. `phase2.contracts` es opcional en el schema, así que
una partida anterior se restaura vacía. No se regeneran los digestos dorados: ningún caso llega al
mes 2 y `canonicalizeState` sigue sin serializar los agregados económicos, deuda registrada. Ver
`docs/engineering/adr/D-070-contratos-publicos.md` y
`docs/execution/phase-4/wp4-7-public-contracts-2026-10-23.md`.

## D-071 — Reputación multidimensional con tres grupos y memoria de hechos
Estado: aceptada el 2026-10-24 para WP4.8.
Tres grupos con efecto cableado, no ocho barras decorativas: `residents` castiga o premia la
deseabilidad del parque del casero (80–108 %), `municipality` fija la influencia que el gobierno
deposita en cada empresa al cerrar el mes (0–3) y `banks` ajusta la tasa base del préstamo
(−100…+250 pb). Empresarios, policía, sindicatos, criminales y medios quedan fuera hasta que exista
el canal que los consuma. La unidad de memoria es el hecho (`ReputationFact` con `kind`, `atTick`,
`referenceId`, `magnitude` topada y el `deltaByGroup` realmente aplicado), con máximo 16 hechos por
organización y posición limitada a ±100; la puntuación es un acumulado derivado y auditable. Ocho
clases de hecho y cada grupo los valora distinto: un hogar desplazado resta 3 ante los vecinos y 1 ante
el gobierno, que es exactamente la aceptación del WP. *(D-075 dejó la lectura bancaria del desalojo en 0:
el +1 sin decaimiento fabricaba descuento permanente. Hoy el cruce entre grupos lo prueban
`contract_completed` (+2 banca) y `violent_sabotage` (−2 banca, sólo si el agresor quedó públicamente
atribuido, D-076).)* Sólo decae la opinión —
vecinos 3/mes y gobierno 2/mes—; el historial crediticio no se borra con el tiempo, se compensa con
otro hecho. Las tablas de efecto son neutras en posición 0, así que el WP no mueve la economía hasta
que hay un hecho real. Los registran los sistemas que ya observaban el suceso (desalojo en la renta,
víctimas en el colapso, impago y amortización en la deuda, cumplimiento en contratos públicos) y la
deuda fiscal con el abandono de mantenimiento se anotan al cierre de `runReputation`, sistema que va
después de `housing` y antes de `contracts` para que nadie puje con la influencia del mes anterior.
Hecho, percepción e información disponible quedan separados: el estado guarda la posición de todos y
`describeReputation` más la proyección sólo publican la del jugador; qué es público, inferido o privado
lo decide WP4.9. `phase2.reputation` es opcional, así que una partida anterior se restaura neutra. Los
digestos dorados se regeneran en los dos casos que cruzan un cierre mensual y sólo cambian la
influencia: se verificó neutralizando las tres tablas de efecto y recuperando el valor de D-070. Ver
`docs/engineering/adr/D-071-reputacion-multidimensional.md` y
`docs/execution/phase-4/wp4-8-reputation-2026-10-24.md`.

## D-072 — Información imperfecta: registro de accesos y expediente de estimaciones
Estado: aceptada el 2026-10-24 para WP4.9.
Cuatro accesos declarados en un registro central (`INFORMATION_POLICY.scopeByObservable`, ~34
observables): `public` lo ve cualquiera desde el mundo, `own` lo conoce el sujeto de su contabilidad,
`inferred` sólo existe como estimación con error y `private` no sale del estado autoritativo. El mismo
número cambia de acceso según de quién sea: la caja propia es `own`, la del rival `private` y su
versión estimada `inferred`. El registro es un contrato declarado, no un filtro automático; lo que
sostiene la garantía son la forma del reporte y las pruebas de fuga e invariancia. La verdad privada se
lee en un único sitio, `trueValueFor`, que sólo llaman el generador de estimaciones y las pruebas: si la
proyección lo llamara, el expediente sería una copia del estado. Cuatro cifras que valen una decisión —
caja disponible, deuda viva, impuestos adeudados y puja prevista—, todas en unidades de dinero; edificios
y parcelas del rival quedan fuera porque ya son públicos. Dos canales: `contacts` cuesta 150 u., enfría
un mes y yerra ±6…±12 %; `market` es gratis, yerra ±25…±50 % y sólo re-basa entradas ya presentes que
llevan tres meses sin refrescarse, así que quien no pregunta no aprende nada nuevo. La eficacia declarada
caduca 2 puntos por mes hasta un suelo del 5 % y la entrada nunca se borra: el archivo vale una entrada
por sujeto y clase. Un expediente por observador (`observerOrganizationId`) y `CommissionIntelligence`
rechaza al que no es su dueño (`INTEL_NOT_OBSERVER`), además de `INTEL_SUBJECT_UNKNOWN`,
`INTEL_SUBJECT_IS_SELF`, `INTEL_COOLDOWN` e `INTEL_UNAFFORDABLE`; no se asume jugador == empresa. El
ruido de estimación sale de un arroyo `phase2.intelligence.prng` separado, así que encargar inteligencia
no desplaza el arroyo económico: ningún digesto dorado cambia y la caja del smoke queda en `5228 u.`. El
expediente no es entrada de ninguna regla —se prueba envenenando las creencias de una partida
auto-jugada y obteniendo el mismo libro de transacciones— y hoy sólo lo tiene el jugador; el rival
seguirá sin expediente hasta WP4.10, donde las facciones tendrán el suyo como entrada. `phase2.intelligence`
es opcional, así que una partida anterior se restaura con el expediente vacío desde su `seed`. Se queda
sin botón de encargo (como `SubmitPublicBid` desde WP4.7) y tres de las cuatro cifras valen 0 en partida
auto-jugada. Ver `docs/engineering/adr/D-072-informacion-imperfecta.md` y
`docs/execution/phase-4/wp4-9-information-2026-10-24.md`.

## D-073 — IA estratégica: perfiles de facción, postura por encuentro y memoria antirrepetición
Estado: aceptada el 2026-10-24 para WP4.10.
Dos perfiles en `FACTION_PROFILES` (`conservative`, `expansionist`), no ocho: sólo la promotora rival tiene
una IA que los consuma y el conservador reproduce exactamente los cuatro números históricos (reserva 30 %,
mantenimiento 55, seguro 35, puja 92 %), así que cambiar de perfil es la única forma de mover la conducta y
la comparación entre campañas es medible. El perfil es una tabla de preferencias con seis grados de libertad
que ya tienen efecto en el motor: ocho familias de objetivo sumadas a la utilidad (`FACTION_ACTION_FAMILY`
cubre las catorce acciones del repertorio y una prueba exige que ninguna se quede sin familia), tres umbrales
y la modulación de la puja por hostilidad. Las relaciones no se decretran: la postura por par ordenado
`observador>subjecto` (±100) sólo nace de cuatro encuentros que ocurren en el mundo —`sabotage` −12 en la
víctima (`commands.ts`), `auction_outbid` −6 al desbancado y al vendedor (`settleAuctions`),
`tender_contested` −2 por competidor (`submitPublicBid`) y `territory` −1 por frontera compartida con tope de
−4 al mes (`runFactions`)—. La regla territorial mira a **una y dos** celdas en fila y columna porque las
parcelas se plantan con `spacingX = spacingY = 2` dentro de cada manzana (no porque "los impares sean la
calzada": eso es falso globalmente, ver D-085); con sólo la celda contigua
la presión nunca disparaba en un distrito generado. Decae 3 puntos al mes hacia cero, se detiene ahí y la
entrada se borra al llegar. La memoria guarda doce acciones por organización —`action`, `target`, `accepted`,
`rejectionCode`— en una ventana de tres meses, y la antirrepetición escala: −60 de utilidad al segundo
rechazo (la acción sigue siendo elegible si el contexto mejora) y salida del menú al tercero hasta que la
ventana la olvide. Sólo cuentan los rechazos; repetir con éxito es trabajo. **La campaña headless cambió el
diseño**: penalizar sin vetar dejaba al expansionista de la seed 4 con 101 acciones fallidas en doce meses y
doce entradas idénticas de `start_construction:...:INSUFFICIENT_FUNDS`, porque 80 − 120 seguía siendo la mejor
utilidad cuando todo el menú estaba bloqueado por la caja; con la supresión cierra con 12 fallidas y 190
ciclos cortados. Cuando la memoria desbanca a lo que la utilidad sola habría elegido —incluido dejar al rival
sin opciones— sube `cycleCountByOrganizationId`, que es la detección de ciclos del WP sin tener que leer el
log. No hay planificador: las dos cadenas reales (oferta de préstamo → aceptación, obra iniciada → cuadro)
ya son seguimiento inmediato tras el `dispatch`; el disparo para abrirlo es cualquier decisión que necesite
dos pasos separados por más de un tick. La información parcial se cierra donde es medible:
`publicBidPercentFor` modula la puja por la hostilidad recordada con suelo del 50 % (coste de ejecutar) y
techo del 100 % (presupuesto anunciado) e `information.ts` pregunta ahí la cifra que estima, así que no hay
dos fórmulas para la misma puja; y siete observables marcados `private` en el registro de WP4.9 —caja,
inventario, deuda viva, impuestos, búsqueda de los hogares, fondos reservados en subasta y reputación ante la
banca— alterados masivamente **no** cambian la decisión del rival. Perfil y postura no salen hacia la
proyección. Empleo, demanda, presupuesto y reputación entran por el mundo (hogares con capacidad de alquiler,
licitaciones municipales, aceptación bancaria según reputación), no por una arista nueva en `rivalAction`.
`phase2.factions` es opcional y el sistema va entre `municipal` e `intelligence`. Un solo digesto dorado se
regenera, `scenario:seed-1:36000` → `ce55085a1cfdc871`: neutralizando la escalada antirrepetición y la presión
territorial recupera exactamente el valor de WP4.9. Ver
`docs/engineering/adr/D-073-ia-estrategica-y-facciones.md` y
`docs/execution/phase-4/wp4-10-strategic-ai-factions-2026-10-24.md`.

## D-074 — Política y elecciones municipales: opinión por eje, partido gobernante y transferencia del presupuesto
Estado: aceptada el 2026-10-24 para WP4.11.
Concejo ficticio de nueve escaños, legislatura de seis meses y debate dos meses después de la elección
(`MUNICIPAL_INSTITUTION`). La opinión son cinco ejes 0…100 (`MUNICIPAL_MOOD_POLICY`) calculados cada mes desde
subsistemas que ya existían, sin estado social nuevo: **vivienda** mide la renta frente al *presupuesto de renta*
del hogar (cómodo ≤ 80 %, 3 puntos de queja por punto encima, desplazado cuenta doble) —la calibración vino de
medir, porque `tenant.budget` no es un ingreso: en el baseline la renta ya consume el 69 %—; **empleo** es la tasa
del mercado laboral (D-067); **seguridad** carga presión policial, ruinas e siniestros del mes; **servicios** es
el nivel realmente pagado (D-068/4.6); e **impuestos** es carga fiscal vivida —contribución + transmisiones +
tasa de servicios sobre la renta que paga el distrito, cómodo ≤ 25 %— y no tipos legales, porque ninguna ordenanza
sube tasas y la jugadora tampoco puede: un eje de tipos habría quedado clavado en 100 para siempre. Ésta es la
razón de que `politics` cierre el mes **justo antes** que `municipal`, que es quien vuelca y pone a cero
`revenueThisMonthBySource`. La saliencia por segmento es un dato
(`POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT`: al hogar le duele la renta, al artesano el trabajo, al comerciante la
mezcla de licencias y tasas); la apelación de un partido es la media ponderada de sus posiciones sobre los asuntos
que duelen, y el que gobierna pierde además una fracción proporcional a lo mucho que prometió en los asuntos rotos
(40 %), que es como la opinión se vuelve castigo. La participación sube con la queja (45 % base, +0,5 por punto,
topada 30…95 —medido 58 % tranquilo frente a 64 % degradado—) y los escaños se reparten por resto mayor con
desempate por id, con el reparto de apertura si nadie vota. **Tres canales de transferencia**, todos sobre reglas
existentes: el orden de pago del presupuesto pasa a ser el del partido que gobierna (con los mismos 15 u.,
transporte 100 / administración 90 o administración 100 / transporte 83 / limpieza 0), el concejo intenta imponer
su propia ordenanza dos meses después de la elección **posponiendo el debate un mes si otra ley ocupa la mesa** —así
no borra nunca una decisión comprada por la jugadora— y `councilAlignmentPercent` modula ±25 puntos la
probabilidad del `LobbyPolicy` (medido: la misma ley con la misma influencia sale 65 % afín, 48 % hostil, 55 %
neutro). La jugadora **no vota**: 0 y 50 de influencia producen exactamente la misma participación, escaños y
gobernante. El sistema no toca la caja: ni un saldo ni una transacción. Son tres plataformas y ningún candidato
(`MUNICIPAL_PARTY_CATALOG`: *Concentración del Suelo Común*, *Liga del Trabajo Local*, *Unión de Cuentas Claras*),
pura data con cinco posiciones, una permutación de gasto, una ordenanza del catálogo y sus escaños de apertura; dos
pruebas vigilan que no se reproduzca nomenclatura de partidos reales y que dos plataformas no sean iguales. No hay
ordenanzas nuevas ni campos nuevos en `Ordinance`: la tabla `ORDINANCE_AXES` conecta los cinco modificadores
existentes con su eje y su signo de alivio. `phase2.politics` es opcional en el snapshot y **sí entra en
`canonicalizeState`** —a diferencia de D-071/072/073— porque el subsistema consume el arroyo de PRNG compartido y
reordena el gasto municipal: se regeneran los diez digestos y se verificó que ocho recuperan su valor de WP4.10
quitando el bloque `politics`, y que los dos cruces de mes lo recuperan además neutralizando la transferencia (un
`governingPartyId` fuera del catálogo). La proyección publica sólo agregados: ninguna clave `tenant_` sale en la
sección. Ver `docs/engineering/adr/D-074-politica-y-elecciones-municipales.md` y
`docs/execution/phase-4/wp4-11-municipal-politics-2026-10-24.md`.

## D-075 — Hardening transversal de los sistemas Alpha (WP4.11-H)
Estado: aceptada el 2026-10-25 para WP4.11-H, no para WP4.12. Baseline `4374c97`, sin commits
posteriores en `origin/main` al iniciar. Paga la deuda transversal de WP4.2–WP4.11 sin añadir
gameplay nuevo. **Censo:** `eligibleVoters(state)` exige `contracted`, `activeContractBuildingId` y
edificio existente; `available` y `displaced` no votan. **Eje fiscal:** `taxesMood` suma
`municipalServiceFee(state)` —la misma función pura que cobra el presupuesto— en vez de leer un
acumulado que `politics` siempre ve a cero; no hay doble cobro. **Estado canónico:**
`canonicalizeState` cubre `phase2.idCounters`, `pendingCommands`, `crews`, `incidents`, `employment`,
`municipal`, `housingMarket`, `contracts`, `reputation`, `intelligence` y `factions`, serializa ids en
balances/inventarios/influencia y ordena claves recursivamente; restaurado y original dan la misma
cadena. Los diez digestos se regeneraron y la serialización anterior sobre los mismos estados recupera
exactamente los diez valores de WP4.11: el delta es superficie, no economía. **Persistencia:**
referencias validadas para contratos, reputación, inteligencia y facciones; partidos validados en la
capa de simulación. **Benchmark:** el warmup precede a la ventana y la `month` cruza el cierre real.
**Información:** `lastReason` y `lastAction` del rival salen de la proyección; sólo queda la huella
física (`rival_footprint: public`, `rival_decision: private`). **UI:** oferta pública y encargo de
inteligencia accionables end-to-end, categorías municipales correctas y panel del concejo. **Reglas
políticas:** una ordenanza activa no se re-sortea y se reprograma a su caducidad; una sola
`MUNICIPAL_POLICY_DURATION_TICKS` para lobby y concejo; queja por desplazamiento normalizada por
población afectada. **Reputación:** nuevo hecho `violent_sabotage` para el atacante distinto del dueño
y banca neutral ante `households_displaced` (el +1 permanente era un exploit de financiación). **CI:**
formato reparado en todo el repo, `blender_artist/toolchain/**` excluido del lint por ser toolchain
vendorizado, y smoke Alpha con fixture determinista. **Rendimiento medido:** el cierre mensual de 800
parcelas mide 28,4 ms (housing 65 %, 42,8 ms instrumentado), cruza el presupuesto p95 de D-065 y su
disparador de 5 ms; LOD no se implementa por alcance y la optimización de `runHousingMarket` queda como
deuda antes de WP4.13. Ver `docs/engineering/adr/D-075-hardening-alpha-sistemica.md` y
`docs/execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md`.

## D-076 — Follow-up de corrección del hardening Alpha (WP4.11-H.1)
Estado: aceptada el 2026-10-25 sobre el baseline auditado `83cc25a`. No abre WP4.12: cierra reglas de
paquetes distintos que ya no encajan. **Autoridad del concejo:** `WithdrawPolicy` sólo retira
`proposed`; una ordenanza `active` —la imponga el lobby o el concejo— es norma municipal y caduca por
`MUNICIPAL_POLICY_DURATION_TICKS`. Retirar una ley ajena contradecía D-074 y además silenciaba al
gobierno, porque el debate siguiente se programa contra la caducidad. El botón de la UI pasa a
*Retirar propuesta actual*. La acta de WP3.11 queda marcada como parcialmente superada. **Autoría y
conocimiento:** `IncidentRecord` separa `causedByOrganizationId` (verdad autoritativa) de
`publiclyAttributedOrganizationId` (lo que la calle sabe, sólo si la tirada de detección vio al agresor) y el
hecho `violent_sabotage` de D-075 se registra contra la atribución pública: un sabotaje no visto ya no baja la
reputación de quien lo hizo. Es la misma separación de D-072 aplicada a la reputación. Queda documentada la onda
expansiva (`blast`) sin propagar atribución. **Integridad y canonicalidad:** los roles de empresa en el snapshot
exigen `kind === "company"` (fiabilidad de contratos, sujetos de inteligencia, perfil/memoria/ciclos y ambos
extremos de la postura de facción), mientras `reputation` se queda en existencia porque `runReputation` no filtra
tipo; `canonicalizeState` suelta `clock.runState` y `clock.speed` —controles del scheduler que la snapshot no
persiste— y conserva `clock.tick`, así que guardar corriendo a 4x sí carga canónicamente igual; los tests de
canonicalización mutan entidades reales (cuadrilla, siniestro, `pendingCommands`) en vez de contadores. **Tasa
de servicios visible:** el informe municipal añade `serviceFeeDueNextSettlement`, derivado de
`municipalServiceFee(state)`, porque `revenueThisMonthBySource.serviceFee` se devenga y se resetea dentro del
mismo `runMunicipalBudget` y la UI sólo podía mostrar un cero. No se persiste nada. **Rendimiento:** cruzar el
disparador de 5 ms de D-065 ya no ordena LOD, abre remediación en cuatro pasos (medir, volver a medir
longitudinal, optimizar exacto, aproximar sólo si sigue fuera) —la reescritura longitudinal de
`measureMonthlyCloses` y la optimización de `placeSearchers` van antes de WP4.13 y WP4.12 no añade trabajo
al cierre sin re-medir—; el arnés separa `ordinaryTick` de `monthClose` y `measureMonthlyCloses` entrega hoy
una distribución PROVISIONAL sobre 8 layouts × 3 posiciones sintéticas (p50 ~28 ms, p95 ~37 ms, máximo
~38 ms frente a un tick normal de p95 ~0,08 ms; `housing` ~69 %), porque con seis muestras el "p95 mensual"
era el máximo de un cierre. No es una campaña real: las muestras de mes 2 y 3 no han vivido el cierre
anterior, así que préstamos (`nextPaymentTick` congelado en el valor de siembra), buscadores y stock
llegan sin acumular. La asimetría y la concentración en `housing` sí quedan firmes. La ventana `fire`
calienta sin incendios y los inyecta al empezar a medir. Falta la reconciliación de las tablas de
reputación en la documentación. Ver `docs/engineering/adr/D-076-follow-up-hardening-alpha.md`, su nota de
revisión 2026-10-25 y `docs/execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md`.

## D-077 — Macroeventos económicos acotados, con trigger propio y efectos cableados
Estado: aceptada el 2026-10-25 para WP4.12-R (reapertura de WP4.12 tras auditoría humana; sustituye
la lectura «sólo infraestructura»). Las duraciones se declaran en meses del juego (`durationMonths ×
GAME_MONTH_TICKS`), no en días: escasez 3, recesión 6, migración 4, auge 3, crisis 5, mano de obra 4.
Cota estructural: un evento por tipo y seis como máximo; la agregación es O(eventos activos ≤ 6) e
independiente de parcelas, edificios, hogares y agentes —«coste acotado», no «O(1) literal»—. Trigger
mensual determinista en `nextCheckTick`: si no hay evento activo, un `Xoshiro128ss` propio derivado de
la seed (`seed ^ 0x9e3779b9`) sortea 10 % mensual, tipo uniforme e intensidad 50–100 %; el arroyo vive
en `MacroEventsState.prng`, entra en snapshot y estado canónico y **no desplaza el PRNG económico**
(probado: campaña con y sin trigger terminan con el mismo `state.prng`). Los efectos se conectan por
helpers centrales, no por excepciones: `materialCost` en precio efectivo de `BuyMaterials`, arranque
de obra, `constructionOptions` y `market.prices` de la proyección (sumado a la ordenanza);
`rent` en `askingRentFor` (sumado a la ordenanza); `demand` multiplica llegadas antes de los topes;
`vacancy` escala la **señal** de vacancia del descubrimiento de precio (la publicada sigue siendo la
observada); `laborCost` deriva el índice salarial a escala 1/10 (+20 % ⇒ +2 puntos/mes), separado del
paso por tensión; `constructionCost` se aplica al **esfuerzo de obra** (`workRequired`), no a un coste
en caja artificial. La IA rival sesga su utilidad por familia de objetivos (`macroShockBiasFor`) con
información pública del mundo; la proyección publica eventos, intensidad, ventana y modifiers
agregados, sin arroyo ni probabilidad. Persistencia aditiva: `prng` y `nextCheckTick` opcionales para
partidas anteriores, derivados de la seed al restaurar. `canonicalizeState` incluye el bloque
completo; se regeneran los diez dorados y se verifica que, quitando `phase2.macroEvents`, recuperan
exactamente los valores de WP4.11-H.1 (`290ae56589918230`, `81470bc663a2116a`, `2eedd2a42fda6677`,
`440287b1646aa604`, `c99ebd1caffb8af6`, `2b460e2479f02a02`, `2ae6584f346b79b3`, `a7c43328b70b75c5`,
`787f7087a4af7f99`, `f5fcd654560b88e7`): en esos diez casos el sorteo no disparó ningún shock, así que
el delta es superficie. `measureMonthlyCloses` gana `macroMode: natural | none | representative | max`
(reactiva lo caducado antes de cada cierre), desglose mes 1 / meses 2-3 / maduros 4+ y muestra por
cierre con la carga (`tenants`, `buildings`, `vacantSlots`, `loansDue`) para diagnosticar
`placeSearchers`. Ver `docs/engineering/adr/D-077-macroeventos-acotados.md` y
`docs/execution/phase-4/wp4-12-macro-events-2026-10-25.md`.

## D-078 — Delegación con los mismos comandos y bandeja de excepciones
Estado: aceptada el 2026-10-25 para WP4.13. La delegación es una política persistida en
`phase2.automation` (property `manual | fill_vacancies`, finance `manual | cover_shortfall`,
`maintenanceRepairThreshold` 0–100 o null y `financeCashFloor`), manual por defecto, de modo que una
partida anterior y los diez escenarios dorados no cambian de conducta. `runAutomation` corre en
`PRODUCT_SYSTEMS` después de `rival`, sólo en fronteras de día y sólo para la organización del
jugador; cada acción se emite con `dispatchProductCommand` y la persona/organización del jugador, así
que las validaciones de actor, propiedad, capacidad, presupuesto, LTV, deuda máxima, mora, caja y
cuadrilla son las mismas que un clic. Tres gestores acotados: propiedad coloca hasta tres
`AssignTenant` diarios en unidades compatibles; finanzas, si la caja cae bajo el suelo y no hay deuda
viva, pide un préstamo con una parcela libre como garantía y acepta la oferta; mantenimiento abre una
`RepairBuilding` diaria bajo el umbral si la caja cubre el coste sin perforar el suelo y asigna una
cuadrilla libre con `AssignCrewToWorkOrder`, dejando la obra en cola si no la hay. La bandeja
priorizada reutiliza `economy.alerts` (ampliada con edificios sin seguro y riesgo alto) y
`automation.routineTaskCount` mide la rutina antes de delegar; `describeAutomation` conserva el
desglose por tipo antes del tope de 20. Medición en 50/200/800 parcelas maduradas seis meses: 6/28/121
interacciones manuales y 0 interacciones del jugador con gestor, que resuelve 4/21/17 plazas en diez
días bajo su tope diario. No se construye `ControlContext`: no hay segunda perspectiva ni consumidor
real; la autorización sigue en `controlGrants`. `canonicalizeState` incluye el bloque y los diez
digestos se regeneran por superficie (quitando `automation` recuperan los valores de WP4.12-R). La
deuda de D-065 sigue abierta: `buildStock` (O(edificios²)) es el hotspot medido antes de evaluar LOD.
Ver `docs/engineering/adr/D-078-delegacion-y-excepciones.md` y
`docs/execution/phase-4/wp4-13-automation-2026-10-25.md`.

## D-079 — Herramientas internas, invariantes y dataset de balance versionado
Estado: aceptada el 2026-10-25 para WP4.14. Sin gameplay nuevo ni pantalla de desarrollo: las
herramientas siguen el patrón opt-in del repositorio (`pnpm balance:campaign`, `pnpm state:inspect`,
`node scripts/build-balance-dataset.mjs`). `measureBalance` mide quiebras, vacancia y movilidad,
concentración (cuota de la mayor organización y HHI de parcelas/edificios), deuda y presupuesto por
organización, como estado derivado que no entra en `GameState`, snapshot ni proyección.
`detectInvariantViolations` fija lo que la simulación no puede romper: cajas e inventarios no
negativos, contratos bidireccionales edificio↔inquilino, referencias parcela↔edificio, principal y
meses de préstamo, umbrales de automatización, intervalos/intensidad de macroeventos y niveles de
servicio. El validador de catálogos corre siempre en CI (edificios, segmentos, ordenanzas, partidos y
escaños, macroeventos, facciones, perfiles de distrito y políticas numéricas). La campaña
`alpha-baseline-v1` registra 8 semillas × 12 meses × 200 parcelas × cuatro estrategias y su dataset se
versiona en `docs/balance/alpha-baseline-v1.json` con esquema v1, filas, agregados, comparaciones por
parejas y banderas; la prueba regular recalcula cada comparación desde las filas y exige cero
invariantes rotas. Resultado: la delegación con mantenimiento diferido gana caja a la pasiva en 8/8
semillas y elimina la vacancia medida; el mantenimiento equilibrado queda **dominado en caja** en 8/8
(31,84 % de vacancia frente a 3,13 %, más coste), bandera `maintenance_balanced_dominated_on_cash`.
Es un hallazgo de balance para tuning posterior, no una invariante rota; WP4.14 entrega detección, no
rebalanceo. **Revisado el 2026-10-25 (auditoría externa de WP4.14):** el dataset entregado **no es una
baseline de balance de gameplay**. La campaña construía el mundo con `createScaledCity`, que es un arnés
de carga: 5 000 000 de caja inyectados, 1 000 000 de capacidad de inventario y parcelas, edificios,
fábricas, inquilinos, préstamos, cuadrillas y agentes regalados que el jugador nunca compró. Con esa
caja `financeCashFloor` no se activa nunca, las diferencias las domina la ocupación automática de una
cartera ya montada, las estrategias no despachan comandos y las cajas finales quedan en 4,8–5,0
millones; la partida real arranca en 12 000. Se renombra a
`docs/balance/synthetic-city-balance-v1.json` con `worldKind: "synthetic_load_harness"` y un campo
`usage` que lo declara dentro del archivo, y la campaña sintética se conserva como test de esfuerzo
(regenerada con su pipeline real, las 32 filas coinciden con las de `f33c698`). Se añade la baseline
jugable `docs/balance/playable-alpha-baseline-v1.json` (`pnpm balance:playable`,
`balance-playable.test.ts`): `createInitialState(seed)`, 16 semillas × 12 meses × 4 estrategias, sólo
comandos reales despachados como `person_00000001` / `PLAYER_ORGANIZATION_ID`, políticas fijadas con
`SetMaintenancePolicy` y `SetAutomationPolicy` (prohibido mutar `state.phase2.*` para dar ventajas),
rutina de crecimiento idéntica para las cuatro (parcela asequible → materiales → permiso → obra →
cuadrilla, mientras la caja cubra el coste exacto), `commandAudit` con aceptados/rechazados y códigos
por tipo, y determinismo verificado byte a byte. 62-68 s reales en dos ejecuciones. **El hallazgo de
mantenimiento queda rebajado a señal fuerte para investigar**: en la campaña jugable `maintained` gana a `passive` en 4 de
16 semillas (pierde en 12), lejos del umbral de dominancia de 15/16, y convierte el gasto en activos
(4,00 edificios frente a 3,13; 15 712,56 de valor de catálogo frente a 12 375,31). El 8/8 de la
delegación tampoco se traslada (6/16). **Ninguna estrategia domina** (ganadoras por semilla: `passive`
8, `delegated_deferred` 5, `maintained` 2, `delegated_balanced` 1), y el dataset lo declara con
`dominance.anyDominant: false` y las banderas `no_dominant_strategy_in_playable_campaign`,
`maintenance_balanced_cash_signal_to_investigate` y
`automation_deferred_has_no_cash_advantage_playable`. Cautela de método que el arnés ocultaba: con una
rutina que reinvierte todo lo que puede, la caja final no es riqueza (`delegated_balanced` es la peor en
caja y la mejor en valor de catálogo), así que `playerCash` se lee junto a `playerParcels`,
`playerBuildings` y `playerAssetBookValue`. Las herramientas siguen firmes y ningún número de gameplay
se ajusta. `scripts/build-balance-dataset.mjs` genera los dos datasets (`--dataset
synthetic|playable`) y `balance-dataset.test.ts` valida los dos archivos. Ver
`docs/engineering/adr/D-079-herramientas-internas-y-balance.md`,
`docs/execution/phase-4/wp4-14-internal-tools-2026-10-25.md` y `docs/balance/README.md`.

## D-080 — Contrato runtime de assets y factoría procedural para Alpha
Estado: aceptada el 2026-10-25 para WP4.15. `RuntimeAssetManifestV1` en `@landlord/shared` es la
frontera: por edificio declara huella, pivote normalizado y los cuatro estados obligatorios
(`complete`, `construction`, `damaged`, `burning`); por personaje, 4 u 8 direcciones con `idle` y
`walk`; por imagen, tamaño, SHA-256 y fuente; y por manifiesto, generador (`procedural_svg` o
`blender_render`) y provenance. La factoría de Alpha es procedural, original y determinista
(`scripts/generate-runtime-assets.mjs`): 5 edificios × 4 estados y 2 variantes de personaje, 68 SVG en
data URIs dentro de un manifiesto de 106 KB, sin binarios ni LFS; `--check` falla ante ediciones
manuales. `IsometricSpikeScene` compila texturas del manifiesto y pinta un sprite por edificio y sitio
de obra con pivote (`setOrigin`) y depth isométrico `(x+y)*1000 + y*10 + x`, el mismo orden que las
losetas; `operational` ≥ 60 % → `complete`, < 60 % → `damaged`, `burning`/`collapse_pending` →
`burning`, `ruin` → `damaged` con opacidad reducida, obra → `construction`; el rectángulo sobrevive
sólo como respaldo hasta que las texturas cargan. Los personajes se animan en el Art Lab (que también
mide 4 vs 8 direcciones); la escena jugable conserva el blitter de agentes hasta que exista un LOD de
personaje medido. Estrategia de atlas: una textura por frame SVG compilada en runtime para Alpha; el
arte final en píxeles usará un atlas raster con la misma metadata y una decisión de almacenamiento
(LFS). Medición: `pnpm art:visual` captura el Art Lab y publica SHA-256 con baseline versionado
(comparación estricta opt-in por variación de antialiasing); `pnpm art:profile` pinta 400 sprites a 60
FPS DOM; `pnpm smoke:art-lab` valida galería y assets; los smokes de juego siguen verdes con sprites
integrados y sin mover sus cajas. Budgets: manifiesto < 200 KB (106 KB), SVG < 8 KB (< 2 KB). Ver
`docs/engineering/adr/D-080-contrato-assets-y-factoria.md`, `docs/art/RUNTIME-ASSETS.md` y
`docs/execution/phase-4/wp4-15-art-pipeline-2026-10-25.md`.

## D-081 — Binarios de arte: presupuesto con guarda, atlas y Git LFS reclasificados a Beta
Estado: aceptada el 2026-10-25 como cierre del endurecimiento WP4.15-H. Con datos medidos: el bundle
runtime de Alpha son 20 data URI SVG (106 KB) más 20 PNG de la ruta Blender E2E (55,8 KB, ningún frame
> 8,6 KB); el perfil denso **en Phaser** con 400 sprites, 24 texturas, cambio de frame cada 240 ms y
scroll de cámara sostiene 60 FPS de mediana; y el repo ya versiona 9 PNG de 1,8–2,8 MB (19,98 MB, con
los masters del spike duplicados) sin LFS. Decisiones: (1) **atlas y texture packing se reclasifican
como requisito de Beta** con criterio de reapertura medido (perfil denso < 55 FPS o > 64 texturas en
el runtime), añadidos al gate de Beta del roadmap; (2) **Git LFS se adopta como política de
presupuesto con guarda en CI**: `pnpm art:binaries:check` falla ante cualquier binario versionado
> 1 MB salvo las excepciones nombradas de `docs/art/BINARY-ALLOWLIST.json` (los 9 PNG del spike; una
excepción obsoleta también falla), y la adopción/migración real de LFS es el primer punto del gate de
Beta; (3) **la regresión visual es una guarda efectiva**: `pnpm art:visual` captura `/art-lab?static=1`
y compara contra `docs/art/golden/art-lab-runtime-assets.png` con pixel-diff tolerante en el navegador
(umbral por canal 12/255, máximo 0,5 % de píxeles); `ART_VISUAL_UPDATE=1` regenera el golden aprobado;
(4) **la ruta Blender queda demostrada de extremo a extremo** para `courtyard_home` (4 estados) y
`vecino_variante` (4 direcciones): render EEVEE transparente → recorte → reducción 2× → metadata con
pivote proyectado del origen 3D → bundle `runtime-assets-blender.json` verificado por
`art:blender:check` y consumido por Phaser en la escena densa. Además corrige D-080 en dos puntos: la
huella participa en depth y posición (`depthForAsset`/`footprintCenter`) y cada dirección camina con
sus propios frames (`animationFrameFor`). Ver
`docs/engineering/adr/D-081-binarios-atlas-lfs-y-regresion-visual.md` y
`docs/execution/phase-4/wp4-15-hardening-2026-10-25.md`.

## D-082 — Cámara isométrica autoritativa en Phaser y Art Lab como Asset QA
Estado: aceptada el 2026-10-26 para WP4.15-H.1. El picking usa
`camera.getWorldPoint(pointer.x, pointer.y)`; el pan convierte delta de pantalla a mundo dividiendo
por zoom y el wheel conserva el punto de mundo bajo cursor. El JSON generado de Blender se mueve de
`public/` a `apps/web/src/generated/runtime-assets-blender.json`; los PNG siguen servidos desde
`public/assets/runtime/blender/`. El Art Lab deja de actuar como selector de dirección visual:
`graphic_civic` está aprobado y las alternativas quedan como archivo secundario; la herramienta se
centra en estados, pivote/huella, personajes, provenance y comparación procedural/Blender. Corrige
D-081 en un punto: `pnpm art:visual` es validación local-only por variación cross-environment; CI
mantiene smoke Art Lab, integridad Blender y presupuesto de binarios. No cambia simulación ni
snapshots. Ver `docs/engineering/adr/D-082-camara-picking-y-art-lab-qa.md` y
`docs/execution/phase-4/wp4-15-h-1-camera-artlab-hardening-2026-10-26.md`.

## D-083 — Licencias de terceros: allowlist SPDX, procedencia por asset y escala física declarada
Estado: aceptada el 2026-10-26 para WP4.15-V.a. Abre D-054 (procedencia de binarios de terceros)
para el caso concreto de las licencias permisivas y corrige D-080 en el campo `provenance`.

Motivo: Rocketbox (MIT) ya alimenta los personajes del slice, pero el contrato no podía
declararlo. `packages/shared/src/assets.ts` admitía sólo `original|cc0|cc_by` y
`scripts/validate-art-staging.mjs` exigía `license === "CC0-1.0"` y ruta bajo `cc0/`: dos reglas
que rechazaban MIT por separado. Y las dos representaban la misma licencia con literales
distintos, lo que garantiza deriva futura.

Decisiones: (1) **allowlist canónica única** en
`blender_artist/manifests/license-allowlist.json` con literales SPDX
(`original`, `CC0-1.0`, `MIT`, `CC-BY-4.0`), `directoryByLicense` que fija el directorio de
staging por familia (`cc0/`, `mit/`, `cc-by/`) y `denied` explícita. Es allowlist estricta:
CC-BY-3.0 queda denegada aunque sea permisible, porque ningún asset la usa hoy; habilitarla es un
acto visible en revisión. `packages/shared/src/assets.test.ts` falla si el enum de Zod y el JSON
divergen. (2) **Procedencia por asset**: cada entrada de `buildings`/`characters` (y futuras
`terrain`/`props`/`vehicles`) declara su `provenance`; la del bundle pasa a ser resumen, porque un
bundle real mezclará CC0 y MIT. `attribution` (`sourceUrl`, `licenseUrl`, `attributionText`,
`verifiedAt`, `licenseFileSha256`) es obligatoria por `superRefine` cuando
`license ∈ attributionRequiredFor`. (3) **Integridad con dos anclas**: `zip-sha256` como hasta
ahora, y `git-commit` (commit de origen + hash del aviso de licencia) para fuentes clonadas sin
ZIP, que era el caso de Rocketbox. (4) **Nueva guarda en CI** `pnpm art:licenses:check`
(`scripts/check-third-party-license.mjs`): cruza cada procedencia publicada contra el registro y
el allowlist, y falla si un asset MIT se declara CC0 o si desaparece la evidencia. Verificado por
negativo: inyectar `MIT` sin atribución en el bundle Blender hace fallar la guarda.
`art:staging:validate` **no** entra en CI porque valida archivos de staging que D-054 mantiene
fuera de Git. (5) **Escala física declarada, no inferida** (〔R7〕): cada fuente registra
`unitScale` en `staging-sources.json`. Medido sobre 8 fixtures, Kenney city kits y KayKit usan
casillas de 1 y 2 unidades (4 m por celda), Quaternius y Rocketbox ya están en metros, y el car
kit de Kenney no comparte unidad con su city kit (a 4 m una furgonetta mediría 6 m de ancha). Una
heurística sobre la bounding box confundiría un coche grande con un edificio pequeño.
No cambia simulación ni snapshots. Ver
`docs/engineering/adr/D-083-licencias-permisivas-procedencia-por-asset-y-escala.md`.

## D-084 — Promoción del renderer Graphic Civic a gameplay vía adapter de proyección
Estado: aceptada el 2026-10-27 para WP4.15-V.c.1. La partida normal `/` consume la dirección visual
aprobada en V.b sin copiar la composición fija del Visual Slice.

Motivo: `/visual-slice` demostró el lenguaje Graphic Civic pero sobre un `layout.ts` autoral. El
objetivo es que gameplay se alimente de estado real sin acoplarse a ese fixture ni inventar
carreteras que la simulación no modela.

Decisiones: (1) **Frontera de presentación explícita** en
`apps/web/src/isometric/gameplay-visual-adapter.ts`: `buildGameplayVisualModel(projection)` es puro,
sólo lee `ViewProjectionV1`, no importa `GameState` ni paquetes internos de simulación, y no depende
de `visual-slice/layout.ts` (guarda en `check-architecture.mjs`, verificada por fixture negativa). La
cadena es `GameState → createViewProjection → ViewProjectionV1 → adapter → renderer → Phaser`.
(2) **Domain type ≠ visual archetype**: `visualArchetypeForBuilding(domainType, stableId)` separa el
tipo económico de la elección artística. `courtyard_home` resuelve entre `bld_residential_a/b/c` y
`courtyard_home`; `workshop` entre `bld_shopfront`/`bld_commercial_b/c`; los industriales
(`cement_plant`/`brickworks`/`steelworks`) conservan su asset procedural — una cementera nunca se
dibuja como vivienda. (3) **Variación determinista** por hash FNV-1a de `domainType|building.id`; sin
`Math.random`, sin tick, sin orden de array, sin `GameState.seed`. (4) **Ground derivado de datos
reales**: parcela construida/vacía/obra y zoning residencial/mixto/industrial deciden la superficie;
**prohibido** clasificar huecos entre parcelas como `asphalt`/road. El plan de gameplay no declara
`worksLot`/`access`/`zone`/`crossings` (campos ahora opcionales en `GroundPlan`). (5) **No re-bake por
tick**: `gameplayGeometryKey` sólo incluye geometría (celdas, zoning, status de parcela); caja, renta,
condición, reputación, política y tick no disparan repintado. Medido: `groundRebakes` se mantiene en 1
mientras la simulación corre sin cambios espaciales. (6) **Escala física**: gameplay usa
`spriteScaleFor` (pixelsPerMeter), NO el `SLICE_BUILDING_SCALE = 1.45` artístico del slice. (7) **El
renderer reutilizado no duplicado**: `terrain-paint.ts`, `depthForAsset`, `footprintCenter`,
`addSliceShadow`, carga de assets y cámara comparten slice y gameplay; `/visual-slice` queda como
fixture de regresión (552 objetos, 60 FPS tras el cambio). No cambia simulación, snapshots ni digestos
(ningún digesto dorado se mueve: el adapter es capa de presentación). Ver
`docs/execution/phase-4/wp4-15-vc-promote-visual-slice-2026-10-27.md`.

## D-085 — Topología vial autoritativa: semántica separada, segmentos con celdas derivadas y contrato de proyección
Estado: diseñada en WP4.15-V.c.2A e implementada y aprobada el 2026-10-27 en V.c.2B/C. El contrato,
la generación, `GameState`, snapshot/backfill, proyección y render Graphic Civic están cerrados;
V.c.2D (acceso y edificabilidad como reglas de producto) sigue diferida.

Motivo: la única diferencia visible grande entre la partida real y `/visual-slice` son las calles, y hoy
no existen como dato — `ViewProjectionV1.map` es literalmente `{ width: 64; height: 64 }`. Una calzada
deja de ser presentación en cuanto es dato de mundo, así que el diseño se apoyó en mediciones sobre el
generador real (3 perfiles × 8 seeds = 24 distritos, 989 parcelas) y no en la intuición de la retícula
del slice.

Decisiones: (1) **Semánticas separadas, nunca `blockedCells` para calles**: obstacle (no edificable, no
transitable), road (no edificable, **transitable**), parcel (potencialmente edificable), open.
`map.blockedCells` son clústeres de `profile.obstacles` y son el muro del A\*; convertirlos en calzada
haría intransitables las calles. (2) **Segmentos ortogonales autoritativos** (`RoadSegmentV1 { id, from,
to, class }`) con el conjunto de celdas derivado por **una única** función pura
`roadCellsFromSegments()`; las celdas no se persisten ni se validan como segunda verdad: la carga
valida segmentos, límites y solapes contra el dominio. Sin carriles, sentidos, nombres, anchos variables ni tráfico.
(3) **Vive en `GameState.map.roads`** y sólo llega al render por la frontera autorizada
`ViewProjectionV1.map.roads = { revision, digest, cells: string[] }`; el renderer sigue sin poder
importar simulación. (4) **Derivación post-composición**, cuatro pasos deterministas: corredores del
`spacing` (celda media de parcelas a distancia 2, garantizados libres por `isParcelCompatible`) → cierre
de retícula → **cierre de malla rectilíneo** (prolongar sólo en el eje del tramo, `maxRun = 12`) →
enlaces Prim multi-fuente. Sin campos nuevos en `DistrictProfile` y sin `state.prng`. (5) **Clase vial por
rol**: corredor de manzana = `street`, enlace entre manzanas = `avenue`; no existe arte de clase todavía,
así que es semántica para V.c.3. (6) **Ninguna regla de juego cambia en 2B/2C**: medido 989/989 parcelas
con frente vial, 0 pérdida de suelo edificable (la construcción de producto es parcela-scoped y nunca mira
celdas) y pathfinding idéntico (las calzadas se tallan de celdas libres y no entran en `blockedCells`). El
coste `road < open terrain` y `hasRoadAccess` como regla real pertenecen a V.c.2D con su propio gate.
(7) **Se persiste**, con backfill determinista para saves sin el campo, siguiendo el precedente de
`blockedCells`: `restoreStateFromSnapshot` lee del save (`snapshot.ts:342`), no regenera. (8) **Entra en
ambas superficies canónicas** (`canonicalizeState` y `districtCanonicalString`), lo que regenera 10
digestos dorados y 12 hashes de fixture en un commit propio, con `parcelCount`/`blockedCellCount` sin
cambios como control. (9) **Rectificación documental**: `spacingX = spacingY = 2` **no** implica "los
impares son la calzada" — el origen de cada manzana se sortea, las parcelas caen en 2–4 clases de paridad
y la mejor celosía global de fase choca con 502 celdas de parcela (75 % del mapa sería calzada). Se
corrigen el comentario de `territoryContacts` (`factions.ts`), D-073 y su ADR; la regla territorial a 1–2
celdas sigue siendo correcta, sólo era falsa su justificación. (10) `deriveRoadsFromBlockedCells`,
propuesto en el plan de V.c., queda **superado**.

Coste medido de la red adoptada: 451 celdas (11,0 % del mapa, 2,5× el árbol de enlaces), 87 % tramos
rectos, 1 % esquinas, 6 % callejones — y podar esos callejones hunde el acceso del 100 % al 27,4 %, porque
son el frente de la parcela. Riesgos fijados para V.c.2B: los `z.object` de zod son no estrictos y
borrarían el campo nuevo en el viaje worker→UI; la proyección se publica cada 2 ticks, así que el payload
va como `string[]` con presupuesto < 2 ms; `createScaledCity` derivaría 2948 celdas (72 % del mapa); y
1 de 24 distritos (`vega_del_cauce` seed 7, `fdc9ba45`) conserva bolsillos sellados fuera de la red
pública sin dejar ninguna parcela sin frente. Ver
`docs/execution/phase-4/wp4-15-vc2a-road-topology-design-2026-10-27.md`.

Implementación cerrada: el derivador cumple p95 holgadamente por debajo de 25 ms, los 24 fixtures y
el sweep 300 no tienen fallos estructurales, y el render consume sólo `projection.map.roads.cells`.
El adapter aplica road al final (`road > apron > parcela > urban`), deriva los 16 masks N/E/S/W y
excluye decoración incompatible; el Canvas horneado mantiene 60 FPS y un digest estable no provoca
rebake. `segmentsFromCells` conserva como deuda una representación horizontal no mínima para tramos
verticales; no cambia ninguna celda ni justifica reabrir el core.

V.c.3A cerrada el 2026-10-27: el lenguaje peatonal sigue siendo sólo presentación. El adapter filtra
las máscaras ya derivadas de `ViewProjectionV1.map.roads.cells`: sólo `t_junction` (7/11/13/14) e
`intersection` (15) producen `GroundRoadMarking { cell, mask }`; rectas, esquinas y extremos no
reciben marca. El renderer pinta una cebra por boca presente, por lo que nunca inventa una prolongación
en la rama ausente de una T; el cruce pleno añade un rombo central de baja opacidad. No hay assets,
props, cambios de simulación, snapshots, contratos ni rebake por tick. V.c.3B (mobiliario) y V.c.3C
(vehículos) permanecen diferidas. Ver
`docs/execution/phase-4/wp4-15-vc3a-junction-pedestrian-language-2026-10-27.md`.

## D-086 — Street dressing presentacional determinista sobre la proyección vial

Estado: aceptada el 2026-10-27 para WP4.15-V.c.3B/C. La fase no añade entidades ni reglas a
`GameState`, snapshot, worker, navegación o economía. `buildGameplayVisualModel()` deriva desde
`ViewProjectionV1` dos colecciones efímeras: `streetFurniture` y `parkedVehicles`.

Reglas: (1) farolas sólo en rectas, espaciadas por línea y alejadas dos celdas de T/intersecciones;
(2) semáforos sólo en intersecciones completas, dos candidatos diagonales opuestos, y cero en T;
(3) bancos y papeleras sólo en hosts libres próximos a frentes residenciales/mixtos, nunca sobre
industria pesada, obra, árbol, parcela o carretera; (4) vehículos sólo en celdas de recta, con
clearance Manhattan 2, lateralidad determinista, huecos irregulares y variantes sedan/taxi/truck;
(5) IDs espaciales estables, hash determinista, sin `Math.random`, tick ni economía; (6) azimuts sólo
45 (frame base) y 225 (frame manifestado), sin `flipX`, `rotation` o transformaciones falsas; (7)
la escena reutiliza sprites por ID, aplica depth/culling existentes y no rebakea el suelo.

El distrito runtime medido tiene 240 road cells, 10 junctions (todas T), 10 crossings, 26 farolas,
0 semáforos, 4 bancos, 2 papeleras, 29 vehículos, 108 árboles y 195 sprites presentacionales. La
ausencia de semáforos es consecuencia de la topología real y de no semaforizar T. La evidencia y
deudas restantes constan en `docs/execution/phase-4/wp4-15-vc3-street-dressing-2026-10-27.md`.

## D-087 — Evidencia de sesión de Alpha: qué cierra el playtest del 2026-10-28 y qué excepción queda abierta

Estado: ratificada el 2026-10-28 por el responsable en lo que refleja `PLAN_improvements.md`; las
adiciones propias constan en el ADR.

El playtest instrumentado de 30 minutos a 4× (semilla 1, build de producción, commit base `01ebb5b`)
sí existe y está versionado en `docs/execution/phase-4/playtest-30min-2026-10-28.md`, con los P0
corregidos en `95804ee`. Mide duración efectiva, primera parcela/obra/ingreso y la secuencia de
decisiones de una partida real. **No** mide lo que D-063 aplazó: cohortes con n > 1 ni instrumentación
persistente en producto, que sigue siendo el diagnóstico efímero de D-057.

Decisión: la evidencia pendiente de D-063 se cierra **parcialmente** y se registra una excepción
explícita nueva para el componente estadístico, en la rama que `PLAN_improvements.md` §2 permite. La
excepción no es gratis: la campaña `pnpm balance:playable` y los playtests de 45–60 min de §6 pasan a
ser evidencia de gate de V.d, no tarea posterior. Ver
`docs/engineering/adr/D-087-evidencia-sesion-alpha-vd.md` y
`docs/execution/phase-4/fase-0-vd-baseline-2026-10-28.md`.

## D-088 — Ciudad 3×3 de nueve distritos y escala física permanente

Estado: ratificada el 2026-10-28 por el responsable en lo que refleja `PLAN_improvements.md`; las
adiciones propias constan en el ADR.

Sustituye el supuesto de mapa único de `GameState` por nueve distritos de 64×64 celdas. Decisiones:
(1) la escala 4 m/celda de D-083 es contrato y dimensiona el mundo —distrito 256×256 m, ciudad
768×768 m—; (2) los nueve distritos avanzan con detalle completo y **LOD sólo si lo demuestra la
medición**, con el orden de D-065/D-076 (medir → optimizar exacto → re-medir → evaluar LOD), sabiendo
que el cierre mensual ya está fuera de presupuesto con un distrito (p95 maduro 40,5 ms medido el
2026-10-28) y que V.d multiplica por nueve el trabajo; (3) todos los distritos son observables desde
el tick uno —lo privado sigue siendo caja, estrategia y memoria del rival (D-072)—; (4) municipio,
banca, política y macroeventos son de ciudad; vivienda, suelo, vacancia, demanda y puestos, de
distrito; (5) `ciudad_del_umbral_v1` autoría la composición de los nueve roles y el generador decide
la geometría; (6) `City.layout` es el perfil inicial, la adyacencia autoritativa vive en `connections`
y nunca se infiere de la rejilla. Ver `docs/engineering/adr/D-088-ciudad-multiples-distritos-3x3.md`.

## D-089 — SnapshotV2, protocolo v2 y rechazo explícito de los guardados Alpha v1

Estado: ratificada el 2026-10-28 por el responsable en lo que refleja `PLAN_improvements.md`; las
adiciones propias constan en el ADR. Deja sin efecto la
compatibilidad aditiva de D-064 y el patrón de backfill de D-085 **para esta ruptura**.

Un snapshot v1 no puede migrarse a un mundo con red vial, manzanas, parcelas multi-cell y normativa:
no tiene ninguno de esos datos, y reconstruirlos sería inventarlos y luego llamar determinista al
invento. Decisiones: (1) `SnapshotV2` con `schemaVersion: 2`, sin migrador; (2) los v1 no se borran,
el slot se marca incompatible con eliminación explícita —separar versión de la base IndexedDB de
versión del esquema, hoy fundidas en `apps/web/src/persistence/indexed-db.ts:93`; (3) protocolo Worker a
v2, porque un literal `z.literal(1)` compartido (`primitives.ts:76`) no puede negociar un esquema que
no interpreta; (4) `SetObservedDistrict` es petición técnica, no comando de dominio —no consume caja,
no mueve el PRNG, no entra en `canonicalizeState`— con el gate "cambiar de distrito no altera el
digest" como prueba; (5) `WorldState` entra en la superficie canónica por `slotY` y luego `slotX`, no
por orden de descubrimiento, y los diez digestos dorados más los hashes de fixture se regeneran en un
commit propio y atribuido. Ver `docs/engineering/adr/D-089-snapshot-v2-protocolo-v2.md`.

## D-090 — Tejido urbano autoritativo: manzanas, parcelas multi-cell y normativa separada

Estado: ratificada el 2026-10-28 en lo que refleja `PLAN_improvements.md`. Amplía
D-085 y elimina `Parcel.cell`, `Parcel.zoning` y `Parcel.buildingId`.

Hoy la parcela es un punto con etiqueta, la norma es un enum de tres valores y `buildingId` duplica la
inversa de `Building.parcelId`. Decisiones: (1) cadena `red → manzana → parcela → huella`, cada eslabón
con celdas propias y conexidad exigida, derivada siempre hacia adelante; (2) `RoadTopology` conserva
`topologyVersion: 1` y sube `derivationVersion` a 2 porque cambia cómo se producen los segmentos
(desde `RoadAnchor[]`, nunca desde parcelas ya colocadas); (3) IDs de bloque y parcela derivados de la
geometría canónica, no del orden de descubrimiento —la rectificación de D-085 generalizada; (4)
`DevelopmentCode` con usos, pisos, cobertura, FAR y retranqueos en **enteros**, `UrbanRole` como función
del bloque y `LandUse` como uso permitido: tres niveles porque colapsarlos es el error actual; (5)
autocolocación determinista de la huella —el motor puntúa candidatos, el jugador no coloca celdas— con
desempate por orientación, `y`, `x` y firma; (6) varios edificios por parcela pero una sola obra activa
(`ACTIVE_SITE_ON_PARCEL`); (7) issues estructurales nuevos y doce reintentos por distrito con error que
identifica ciudad, distrito, seed e issues; (8) los índices derivados (edificios por parcela, huellas
ocupadas, edificios por distrito, parcelas por bloque) se recalculan y no se persisten. Ver
`docs/engineering/adr/D-090-tejido-urbano-y-parcela-multicell.md`.

**Implementación V.d.1 (2026-10-28).** La cadena `RoadAnchor[] → RoadTopology (derivationVersion 2)
→ Block (flood fill) → Parcel (BFS multi-fuente desde frentes)` está en `urban-fabric.ts`. Añadidos
propios, marcados en la ADR: `connectSpawns` se apaga en recetas de baja densidad para no rebasar el
envelope (23,07 km/km² frente a 23,26); los ordinales de parcela siguen el orden geométrico canónico
con las anclas autoradas primero; una manzana completa por distrito se reserva como espacio público
provisional hasta V.d.3; los saves v2 pre-V.d.1 se rechazan por nombre (`UNSUPPORTED_URBAN_FABRIC`).
`zoning` y `buildingId` siguen en `Parcel` hasta V.d.2. Gate: 900 distritos sin fallos, generación
p95 169,86 ms, derivación vial p95 2,83 ms, todas las recetas dentro de su envelope. El cierre
mensual maduro sube a p95 34,62 ms y queda como deuda de V.d.2.

**Implementación V.d.2 (2026-10-28).** La norma se separa del uso: `Parcel` pierde `zoning` y
`buildingId`, gana `developmentCodeId` y `currentUses`; edificios y obras llevan distrito, huella,
orientación, plantas y forma. `allowedZoning` se sustituye por `allowedUses`; el permiso registra
código, usos permitidos y usos existentes. Los roles de bloque se asignan por bandas de centralidad,
avenidas, gateways y rol dominante, con rango dentro de la banda para evitar paridades accidentales;
las anclas autoradas conservan su uso y pueden tener un código propio. La huella se autocoloca con
retranqueos, cobertura y FAR; una parcela admite varios edificios y una sola obra activa. Los índices
de edificios por parcela, por distrito, huellas y parcelas por bloque son derivados y no se
persisten. Vivienda y empleo se miden por distrito con fallback de ciudad, la opinión electoral se
pondera por población efectiva, el territorio de facciones usa manzanas/frentes y la automatización
no cruza distritos: crea una excepción. Los saves v2 pre-V.d.2 se rechazan con
`UNSUPPORTED_URBAN_FABRIC`. Gate en `docs/execution/phase-4/vd2-composicion-urbana-2026-10-28.md`.

## D-091 — Mercados híbridos: vivienda y empleo por distrito, dinero y política de ciudad

Estado: ratificada el 2026-10-28 en lo que refleja `PLAN_improvements.md`. Amplía D-066 y
D-067 sin sustituir sus mecanismos.

Nueve mercados independientes romperían D-068, D-074 y D-077; un mercado único promedio borraría la
diferencia entre distritos, que es el objetivo de V.d. Decisiones: (1) frontera —vacancia, demanda,
renta, movilidad y puestos por distrito; salario base, banca, municipio, política y macroeventos de
ciudad; inventarios organizacionales y globales—; (2) `askingRentFor` con fallback en tres niveles:
índice distrital sólo con **≥ 3 edificios comparables**, luego ciudad, luego 100, y el nivel usado se
publica en la proyección; (3) sin mudanza inter-distrito automática: cada buscador lleva
`marketDistrictId`; (4) el ánimo municipal pondera población efectiva de toda la ciudad, respetando el
censo de D-076; (5) la presión territorial de facciones usa bloques y frentes compartidos en vez de
distancia entre anchors, que era la aproximación que D-085 ya rectificó; (6) la automatización que
necesite una cuadrilla en otro distrito **crea una excepción**, no teletransporta agentes. Ver
`docs/engineering/adr/D-091-mercados-hibridos-por-distrito.md`.

## D-092 — Equipamientos municipales físicos y servicios que recorren la red

Estado: ratificada el 2026-10-28 en lo que refleja `PLAN_improvements.md`. Cambia el
modelo de cobertura de D-069 y preserva el presupuesto de D-068.

La cobertura radial desde un centro abstracto no cubre nueve distritos, atraviesa obstáculos y no es un
lugar donde comprar, mantener ni visitar. Decisiones: (1) `UrbanFacility` es función operativa con
`parcelIds`, `buildingIds` y `publicSpaceIds` —colegio con patio y mercado trasladable—, separada de
`FacilityId` de producción (D-062); (2) el municipio genera y opera, y **no se introduce ninguna
capability política**: el jugador no coloca equipamientos; (3) `disposition: "public"` bloquea compra,
venta, garantía, subasta y obra empresarial con códigos de rechazo propios; (4) las reservas públicas
van **antes** de parcelar y si el programa de §4.4 no cabe se reintenta el distrito entero —ningún
equipamiento obligatorio se omite en silencio—; (5) cobertura por Dijkstra multi-source con costes
enteros (avenida 1, calle 2, gateway desde `CityProfile`) y caché por firma de topología, facilities,
capacidad y presupuesto, nunca por tick; (6) cerrar un gateway degrada sólo las coberturas dependientes
—ese es el criterio de gate y la prueba de que el grafo no es decorado—; (7) tres excepciones
declaradas: transporte es accesibilidad de red, limpieza sigue siendo red municipal sin edificio y
administración no usa radio; (8) la calidad presupuestaria multiplica la capacidad efectiva y la
demanda se asigna en orden estable al alcanzable de menor coste, sin coste monetario inventado. Ver
`docs/engineering/adr/D-092-equipamientos-y-servicios-espaciales.md`.
