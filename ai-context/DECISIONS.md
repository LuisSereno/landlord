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
