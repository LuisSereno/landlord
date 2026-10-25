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
clases de hecho y cada grupo los valora distinto: un hogar desplazado resta 3 ante los vecinos, 1 ante
el gobierno y suma 1 ante la banca, que es exactamente la aceptación del WP. Sólo decae la opinión —
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
parcelas se plantan con `spacingX = spacingY = 2` y los impares son la calzada; con sólo la celda contigua
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
disparador de 5 ms de D-065 ya no ordena LOD, abre remediación en tres pasos (medir, optimizar exacto, aproximar
sólo si sigue fuera) —la optimización de `placeSearchers` va antes de WP4.13 y WP4.12 no añade trabajo al cierre
sin re-medir—; el arnés separa `ordinaryTick` de `monthClose` y `measureMonthlyCloses` da una distribución real
(24 cierres de 800 parcelas: p50 ~28 ms, p95 ~37 ms, máximo ~38 ms frente a un tick normal de p95 ~0,08 ms),
porque con seis muestras el "p95 mensual" era el máximo de un cierre; la ventana `fire` calienta sin incendios y
los inyecta al empezar a medir. Falta la reconciliación de las tablas de reputación en la documentación. Ver
`docs/engineering/adr/D-076-follow-up-hardening-alpha.md` y
`docs/execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md`.
