# Plan maestro de ejecución

Fecha base: 2026-10-20.

Este directorio convierte la visión, la arquitectura y el roadmap de Landlord en un plan ejecutable por incrementos pequeños. No sustituye a `docs/` ni a `ai-context/`: los complementa con orden de trabajo, dependencias, entregables y criterios de aceptación.

## Objetivo operativo

Construir y validar, en este orden:

1. una base técnica determinista y desacoplada;
2. un prototipo jugable del bucle inmobiliario;
3. un vertical slice representativo;
4. una alpha sistémica;
5. una beta estabilizada y un lanzamiento mantenible;
6. sólo después, si los datos lo justifican, perspectivas jugables adicionales.

La cadena de valor que debe mantenerse visible es:

`comprar terreno -> producir -> construir -> ocupar -> generar caja -> competir -> asumir riesgos -> reaccionar a una decisión política`

## Orden de lectura y ejecución

| Orden | Documento | Resultado |
|---:|---|---|
| 0 | [00-modelo-de-ejecucion.md](00-modelo-de-ejecucion.md) | Reglas de gobierno, calidad y uso de agentes |
| 1 | [01-fase-0-preparacion.md](01-fase-0-preparacion.md) | Backlog listo y decisiones mínimas para empezar |
| 2 | [02-fase-1-gate-1.md](02-fase-1-gate-1.md) | Viabilidad técnica demostrada |
| 3 | [03-fase-2-gate-2.md](03-fase-2-gate-2.md) | Viabilidad del producto demostrada |
| 4 | [04-fase-3-vertical-slice.md](04-fase-3-vertical-slice.md) | Experiencia representativa y evaluable |
| 5 | [05-fase-4-alpha-sistemica.md](05-fase-4-alpha-sistemica.md) | Sistemas urbanos conectados a escala |
| 6 | [06-fases-5-y-6-beta-lanzamiento.md](06-fases-5-y-6-beta-lanzamiento.md) | Producto estabilizado y operable |
| 7 | [07-expansiones-futuras.md](07-expansiones-futuras.md) | Opciones posteriores sin comprometer alcance actual |
| Apoyo | [PLANTILLA-TAREA-LUNA.md](PLANTILLA-TAREA-LUNA.md) | Contrato de una tarea pequeña para Luna |
| Apoyo | [SECUENCIA-LUNA.md](SECUENCIA-LUNA.md) | Orden de colas y reglas para usar el nivel mínimo seguro |
| Apoyo | [MATRIZ-TRAZABILIDAD.md](MATRIZ-TRAZABILIDAD.md) | Relación entre gates, capacidades y evidencia |
| Evidencia | [phase-1/benchmark-baseline-2026-10-20.md](phase-1/benchmark-baseline-2026-10-20.md) | Baseline headless y smoke de navegador de WP1.14 |
| Evidencia | [phase-1/soak-baseline-2026-10-20.md](phase-1/soak-baseline-2026-10-20.md) | Soak headless y procedimiento de soak navegador de WP1.15 |
| Acta | [phase-1/gate-1-review-2026-10-20.md](phase-1/gate-1-review-2026-10-20.md) | Auditoría y decisión REWORK de Gate 1 |

## Estado de las fases

| Fase | Estado al crear este plan | Regla de inicio |
|---|---|---|
| Fase 0 | DONE — cerrada 2026-10-20 | Acta en `phase-0/PHASE-0-CLOSURE.md` |
| Fase 1 / Gate 1 | REWORK — acta 2026-10-20 | Cerrar G1-RW-01..03 antes de aprobar |
| Fase 2 / Gate 2 | Bloqueada por Gate 1 | Requiere acta GO de Gate 1 |
| Fase 3 / Vertical slice | Bloqueada por Gate 2 | Requiere evidencia de una sesión coherente |
| Fase 4 / Alpha | No iniciada | Requiere vertical slice validado |
| Fases 5-6 | No iniciadas | Requieren alcance comercial aprobado |
| Fases 7-8 | Futuras, no comprometidas | Requieren validación explícita del producto base |

## Cómo usar este plan

1. Seleccionar únicamente trabajo del gate activo.
2. Convertir un paquete `WP-*` en tareas `TASK-*` usando la plantilla.
3. Limitar cada tarea a un resultado verificable y a una superficie pequeña del repositorio.
4. Ejecutar primero tareas sin dependencias pendientes.
5. Integrar sólo con checks verdes y evidencia adjunta.
6. Actualizar el estado del paquete y los documentos afectados.
7. Celebrar la revisión del gate; no comenzar el siguiente por inercia.

## Convención de estados

- `TODO`: definido pero no iniciado.
- `READY`: dependencias satisfechas y criterios claros.
- `IN_PROGRESS`: una persona o agente es responsable.
- `BLOCKED`: existe un impedimento identificado.
- `REVIEW`: implementación terminada, pendiente de revisión o evidencia.
- `DONE`: cumple Definition of Done.
- `DEFERRED`: retirado del gate sin declararlo completado.

## Regla de alcance

La presencia de una tarea en fases futuras no autoriza su implementación anticipada. Gate 1 sólo valida tecnología; Gate 2 sólo valida el bucle de producto. Life simulation, perspectivas política/criminal/ciudadana jugables, multijugador y LLM permanecen fuera de alcance hasta una decisión posterior explícita.
