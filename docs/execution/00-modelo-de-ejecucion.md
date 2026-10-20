# Modelo de ejecución y gobierno

## 1. Propósito

Este documento define cómo transformar el roadmap en cambios seguros y revisables, especialmente cuando se usa Luna con el nivel de razonamiento más bajo viable. El objetivo es reducir ambigüedad en la entrada de cada tarea, no delegar decisiones de producto irreversibles a un agente de ejecución.

## 2. Autoridad documental

Antes de modificar código o diseño se leerá, en este orden:

1. `AGENTS.md`;
2. los documentos obligatorios de `ai-context/`;
3. `docs/INDEX.md`;
4. este plan de ejecución;
5. la documentación canónica del área afectada;
6. el código y los tests existentes.

En caso de conflicto se aplicará la jerarquía descrita en `AGENTS.md`. Una discrepancia detectada se registra como deuda documental; no se resuelve silenciosamente.

## 3. Principios no negociables

- La simulación es TypeScript puro y no importa Phaser, React ni DOM.
- El estado autoritativo de una partida vive en la simulación.
- El render solicita acciones mediante comandos; no muta el dominio.
- La misma versión, seed, estado y secuencia de comandos produce el mismo resultado.
- `Math.random`, `Date.now` y dependencias del reloj real no entran en reglas de dominio.
- El dinero usa unidades menores enteras o un tipo que impida floats accidentales.
- Los IDs son opacos, estables y no dependen de posiciones en arrays.
- `PlayerIdentity`, `Person`, `Organization`, ownership y control no se colapsan en `Player`.
- Los comandos relevantes declaran actor y organización representada.
- Los saves son un contrato versionado y validado.
- Las definiciones de contenido son data-driven y se validan al cargar.
- No se introduce infraestructura, generalización ni sistema futuro sin necesidad del gate.
- No se reutiliza contenido protegido de las obras de referencia.

## 4. Estrategia de entrega

El incremento preferido atraviesa una porción completa y pequeña:

`input -> command -> validation -> transition -> event -> projection -> render -> test`

No todos los incrementos necesitan UI. Las primitivas técnicas y los sistemas se desarrollan primero de forma headless; su integración visual se añade cuando el contrato ya es estable.

### Límites recomendados por tarea Luna

- Un único resultado observable.
- Entre uno y cinco archivos de producción, salvo cambios mecánicos justificados.
- Tests en la misma tarea cuando el comportamiento cambia.
- Sin decisiones de arquitectura abiertas.
- Sin combinar refactor, feature y actualización masiva de dependencias.
- Duración objetivo: de 30 minutos a 4 horas; dividir si supera una jornada humana.
- Un prompt autocontenido con rutas, tipos, invariantes y comandos de verificación.

## 5. Clasificación de trabajo

Cada tarea tendrá uno de estos tipos:

| Tipo | Uso | Evidencia mínima |
|---|---|---|
| `SPIKE` | Resolver una incertidumbre técnica | Informe reproducible, mediciones y recomendación |
| `ADR` | Adoptar una decisión arquitectónica | Contexto, opciones, decisión y consecuencias |
| `FEATURE` | Añadir comportamiento de usuario/dominio | Tests y demostración del criterio de aceptación |
| `ENABLER` | Preparar tooling o contratos | Check automatizado o consumidor real |
| `TEST` | Añadir cobertura o harness | Fallo reproducible antes, éxito después |
| `DOC` | Corregir o ampliar documentación | Enlaces y estado coherentes |
| `OPS` | Build, CI, release u observabilidad | Ejecución automatizada y rollback descrito |

Un spike no se convierte automáticamente en producción. Su salida es una decisión explícita o una nueva tarea.

## 6. Definition of Ready

Una tarea está `READY` cuando:

- pertenece al gate activo;
- resuelve un problema de jugador o un riesgo del gate;
- tiene dependencias cerradas;
- identifica archivos o módulos previstos;
- especifica entrada, salida y errores;
- enumera invariantes relevantes;
- define tests y comando de verificación;
- evalúa persistencia, rendimiento e IP;
- no contiene una decisión pendiente oculta;
- cabe en el límite de una tarea pequeña.

Si falta una elección de producto, la tarea correcta es un spike o una decisión, no una implementación especulativa.

## 7. Definition of Done global

Una tarea sólo está `DONE` cuando:

- los criterios de aceptación están demostrados;
- typecheck, lint y tests pertinentes pasan;
- no rompe determinismo ni límites de dependencias;
- se añadieron tests de regresión cuando corresponde;
- errores esperables usan resultados estructurados;
- logging no expone datos sensibles ni introduce no determinismo;
- se evaluó el impacto en snapshots y migraciones;
- documentación y ejemplos afectados están actualizados;
- `PROJECT-STATE`, `DECISIONS` o `KNOWN-GAPS` se actualizaron si cambió su verdad;
- no quedan TODOs sin ticket o explicación;
- el diff no incluye cambios ajenos a la tarea.

## 8. Estrategia de ramas e integración

- Una rama o change-set por tarea o grupo inseparable.
- Commits pequeños con ID de tarea: `G1-WP03-T02 add seeded PRNG state export`.
- Integración continua en la rama principal; evitar ramas de fase de larga vida.
- No mezclar actualización de dependencias con lógica de negocio.
- Mantener fixtures de saves históricos después de introducir persistencia.
- Todo cambio en contratos worker/snapshot incrementa su versión cuando sea incompatible.

## 9. Pirámide de pruebas

1. Unitarias de funciones puras, invariantes y errores.
2. Tests de sistemas con seed y estado controlados.
3. Tests de comandos desde entrada hasta evento/proyección.
4. Tests del protocolo Worker y serialización.
5. Integración web para picking, controles y HUD crítico.
6. End-to-end de los recorridos del gate.
7. Determinismo: hashes/snapshots tras secuencias conocidas.
8. Rendimiento: benchmark con entorno y umbral documentados.
9. Soak: ejecución prolongada y observación de memoria/ticks.

Los tests visuales no sustituyen tests del dominio. Los snapshots textuales no sustituyen aserciones sobre invariantes relevantes.

## 10. Presupuestos de calidad

Los números definitivos se fijan mediante Gate 1, pero desde el inicio se registran:

- duración media, p95 y máxima del tick;
- backlog del worker;
- latencia comando-respuesta;
- tiempo de serialización y tamaño de snapshot;
- FPS y frame time en la escena de referencia;
- consumo de memoria al inicio y después del soak;
- duración de carga/guardado;
- fallos y rechazos de comandos por código.

No se inventará un umbral de aprobación antes de medir un baseline. El acta de Gate 1 debe convertir los baselines en budgets explícitos para Gate 2.

## 11. Uso de Luna con razonamiento mínimo

### Trabajo apropiado

- crear un tipo o función con contrato ya decidido;
- añadir tests enumerados;
- implementar una migración especificada;
- cablear una proyección o componente con mock definido;
- corregir un bug con reproducción;
- actualizar documentación siguiendo una lista exacta.

### Trabajo que requiere preparación previa

- elegir PRNG, schema validator, ECS o estrategia de worker;
- definir fórmulas económicas o balance;
- diseñar límites entre paquetes;
- alterar ownership, identidad o autorización;
- cambiar formato de snapshot;
- seleccionar alcance de un gate.

Estas tareas se resuelven primero mediante spike/ADR por una revisión de mayor criterio. Luna recibe después la decisión cerrada.

### Secuencia por tarea

1. Proporcionar contexto mínimo y enlaces exactos.
2. Indicar qué debe cambiar y qué no.
3. Dar casos de aceptación concretos.
4. Exigir que ejecute checks específicos.
5. Revisar el diff, no sólo el resumen del agente.
6. Si el agente descubre una decisión no especificada, debe parar y registrarla; no elegir por conveniencia.

## 12. Revisión de gate

Cada gate termina con un acta que incluye:

- alcance comprometido frente a terminado;
- demo reproducible;
- resultados de tests y benchmarks;
- riesgos cerrados, aceptados y nuevos;
- deuda técnica/documental;
- métricas del jugador si existen;
- decisión `GO`, `CONDITIONAL GO`, `REWORK` o `STOP`;
- condiciones concretas para iniciar la fase siguiente.

`CONDITIONAL GO` exige responsables, fechas y tareas de cierre. Una funcionalidad parcialmente implementada no se presenta como completada.

## 13. Checklist de las diez preguntas del repositorio

Toda épica o cambio significativo debe registrar:

1. problema de jugador resuelto;
2. pertenencia al gate;
3. decisión significativa frente a micromanagement;
4. posibilidad de sistema reutilizable;
5. prueba determinista;
6. datos persistidos;
7. impacto en saves;
8. impacto de propiedad intelectual;
9. acoplamiento a organización/perspectiva;
10. necesidad de capability, rol o `ControlContext`.
