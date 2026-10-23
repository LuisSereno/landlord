# Matriz de trazabilidad

## Propósito

Relacionar capacidades, gates, paquetes, evidencia y fuentes canónicas. Esta matriz evita declarar una capacidad “terminada” sólo porque existe una clase, pantalla o documento.

## Gates y evidencia

| Capacidad | Primer gate | Paquete principal | Evidencia de aceptación | Fuente canónica |
|---|---|---|---|---|
| Workspace, checks y CI | Gate 1 | WP1.1 | Clon limpio pasa install/lint/typecheck/test/build | Arquitectura, stack web |
| Contratos serializables | Gate 1 | WP1.2 | Structured clone y test de protocolo | Arquitectura |
| Seed y PRNG | Gate 1 | WP1.3 | Vectores conocidos y continuidad tras restore | Motor de simulación |
| Tick fijo | Gate 1 | WP1.4 | Equivalencia de pasos y separación de FPS | Motor de simulación |
| Identidad/ownership mínimos | Gate 1 | WP1.5 | Control distinto de ownership en fixture | Player identity |
| Comandos y eventos | Gate 1 | WP1.6 | Rechazo sin mutación y evento causal | Motor de simulación |
| Headless/determinismo | Gate 1 | WP1.7 | Golden scenario repetible | Motor de simulación |
| Web Worker | Gate 1 | WP1.8 | Simulación autoritativa fuera de UI | Arquitectura, stack web |
| Snapshot versionado | Gate 1 | WP1.9 | Continuación equivalente tras restore | Persistencia |
| IndexedDB/recovery | Gate 1 | WP1.10 | Roundtrip y save corrupto recuperable | Persistencia |
| Isométrico/cámara | Gate 1 | WP1.11 | Demo en navegador de referencia | Stack web |
| Picking | Gate 1 | WP1.12 | Casos de centro/bordes con pan/zoom | Gates y MVP |
| Flujo vertical técnico | Gate 1 | WP1.13 | Input a proyección confirmada | Arquitectura |
| 500 agentes/100 edificios | Gate 1 | WP1.14 | Benchmark reproducible | Motor, gates y MVP |
| Soak | Gate 1 | WP1.15 | Informe prolongado y memoria | Historias US-12 |
| Parcela/compra | Gate 2 | WP2.1 | Transferencia atómica y rechazo | Economía e inmobiliario |
| Caja/libro mínimo | Gate 2 | WP2.2 | Cada cambio tiene causa y tests | Economía e inmobiliario |
| Materiales | Gate 2 | WP2.3 | Ciclos, capacidad y persistencia | Game design |
| Construcción | Gate 2 | WP2.4-WP2.5 | Obra válida, progreso y completion | Historias US-04/05 |
| Tenant/renta | Gate 2 | WP2.6 | Demanda finita y cobro automático | Historias US-06 |
| Upgrade | Gate 2 | WP2.7 | Coste, tiempo y stats persistidos | Historias US-07 |
| IA rival | Gate 2 | WP2.8 | Comandos comunes, no cheats, memoria | IA y simulación |
| Acción ilegal/policía | Gate 2 | WP2.9 | Riesgo, heat y consecuencia | Crimen y facciones |
| Ordenanza | Gate 2 | WP2.10 | Modifier económico aplicado/retirado | Política y sociedad |
| Dirección visual y pipeline | Gate 2 | WP2.14 | Spike reproducible, provenance, métricas y decisión | Art Bible, Art Pipeline |
| Sesión 30-60 min | Gate 2 | WP2.13 | Playtest y métricas del bucle | Gates y MVP |
| Agentes, daño e incidentes | Gate 2 | WP2.15 | Escenario físico headless/visible, golden tests y save/load determinista | D-061, game design, investigación histórica |
| Producción física localizada | Vertical slice | WP3.2 | Fábrica construible, suitability de parcela y decisión mercado/producción | D-062, Economía e inmobiliario |
| Estados financieros/liquidez | Vertical slice | WP3.3 | Lectura de solvencia y caja | Fiscalidad y operación |
| Banca/deuda | Vertical slice | WP3.4 | Calendario, mora, garantía | Fiscalidad y operación |
| Impuestos/tasas | Vertical slice | WP3.5 | Liquidación automática y previsión | Fiscalidad y operación |
| Mantenimiento | Vertical slice | WP3.6 | Deterioro, política y reparación | Fiscalidad y operación |
| Seguros | Vertical slice | WP3.7 | Cobertura, prima y siniestro | Fiscalidad y operación |
| Zoning/permisos | Vertical slice | WP3.8 | Reglas previas y cambio normativo | Fiscalidad y operación |
| Subastas/insolvencia | Vertical slice | WP3.9 | Transferencia y recuperación | Fiscalidad y operación |
| Automatización | Vertical slice | WP3.12 | Cartera mayor sin clics lineales | Game design/progresión |
| Arte representativo | Vertical slice | WP3.13 | Art Lab, atlases, escena densa y QA visual | Art Bible, Art Pipeline |
| Distritos generados | Alpha | WP4.1 | Seed reproducible y validación | Progresión |
| Simulation LOD | Alpha | WP4.2 | Conservación al agregar/reactivar | Progresión |
| Vivienda/demanda | Alpha | WP4.3 | Vacancy y precios responden | Economía e inmobiliario |
| Empleo | Alpha | WP4.4 | Efecto en ingresos/vivienda | Fiscalidad y operación |
| Presupuesto municipal | Alpha | WP4.5 | Ingresos y gastos reales | Fiscalidad y política |
| Servicios urbanos | Alpha | WP4.6 | Cobertura afecta economía | Fiscalidad y operación |
| Contratos públicos | Alpha | WP4.7 | Licitación y ejecución | Fiscalidad y operación |
| Reputación múltiple | Alpha | WP4.8 | Grupos valoran distinto | Dominio del juego |
| Información imperfecta | Alpha | WP4.9 | Proyecciones respetan scope | IA/player model |
| Facciones | Alpha | WP4.10 | Interactúan entre sí | Crimen/IA |
| Elecciones | Alpha | WP4.11 | Resultado deriva de sociedad | Política y sociedad |
| Roles transitables | Futuro | Fase 7 | Cambio de contexto sin mundo paralelo | Multi-perspectiva |
| Life simulation | Futuro | Fase 8 | Spike y gate específicos | Multi-perspectiva |

## Decisiones cerradas en Fase 0

| Decisión | Capacidad afectada | Contrato/evidencia previa | Estado |
|---|---|---|---|
| D-046 | Toolchain y browsers | Versiones exactas y política de actualización | Aceptada |
| D-047 | Fronteras de paquetes | Grafo permitido/prohibido | Aceptada |
| D-048 | Aleatoriedad | Estado, API y vectores PRNG | Aceptada |
| D-049 | Schemas/entidades | Tipos mínimos, IDs y serialización | Aceptada |
| D-050 | Render | Phaser y condiciones de revisión | Aceptada |
| D-051 | Worker/save | Protocolo, errores y snapshot v1 | Aceptada |
| D-052 | Rendimiento | Fixture, metodología y thresholds | Aceptada |

La evidencia de implementación se añadirá durante Gate 1. “Aceptada” describe la decisión, no la existencia del código.

## Invariantes transversales

| Invariante | Checks continuos | Revisión manual |
|---|---|---|
| Simulation no depende de UI/DOM | Regla de imports, typecheck Node | Revisión de nuevos adapters |
| Determinismo | Golden scenarios, seeds, canonical state | Auditoría de orden y fuentes de tiempo/random |
| Player no equivale a company | Tests de ownership/control | Revisión de nombres y shortcuts de UI |
| Estado sólo cambia por dominio | Tests de command pipeline | Revisión de handlers React/Phaser |
| Saves versionados | Fixtures y migraciones | Revisión por cambio persistente |
| Dinero seguro | Tipos y tests de invariantes | Revisión de fórmulas y redondeos |
| Datos validados | Schema tests | Revisión de fallbacks y mensajes |
| IP original | Provenance de assets/copy | Revisión legal antes de comercializar |
| Sin scope creep | Estado del gate y labels | Acta de gate/triage de producto |

## Checklist de evidencia por release interna

- Hash/resultado de suite determinista.
- Resumen de tests, typecheck, lint y build.
- Resultados de benchmark comparados con baseline.
- Tamaño y roundtrip de snapshot.
- Migraciones ejecutadas sobre fixtures soportados.
- Lista de errores/bugs conocidos por severidad.
- Cambios de alcance o decisiones enlazados.
- Assets/copy nuevos con procedencia.
- Métricas de playtest relevantes para el gate.

## Política de actualización

Cuando se añade o elimina una capacidad del roadmap:

1. actualizar la fuente canónica de producto/ingeniería;
2. registrar decisión si cambia alcance o arquitectura;
3. actualizar el documento de fase;
4. actualizar esta matriz;
5. actualizar `PROJECT-STATE` cuando el estado real cambie.
