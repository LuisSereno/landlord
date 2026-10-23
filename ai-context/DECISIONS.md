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
