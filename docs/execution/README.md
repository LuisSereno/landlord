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
| Acta | [phase-2/gate-2-review-2026-10-23.md](phase-2/gate-2-review-2026-10-23.md) | Revisión de Gate 2; WP2.14 queda cerrado por su informe de cierre |
| Evidencia | [phase-3/wp3-2-implementation-2026-10-23.md](phase-3/wp3-2-implementation-2026-10-23.md) | Producción física localizada y aptitud del terreno |
| Evidencia | [phase-3/wp3-3-financial-projection-2026-10-23.md](phase-3/wp3-3-financial-projection-2026-10-23.md) | Baseline de posición financiera y previsión de caja |
| Evidencia | [phase-3/wp3-4-banking-debt-2026-10-23.md](phase-3/wp3-4-banking-debt-2026-10-23.md) | Banco independiente, deuda, amortización, mora y persistencia |
| Evidencia | [phase-3/wp3-5-taxation-2026-10-23.md](phase-3/wp3-5-taxation-2026-10-23.md) | Tasas de transmisión y propiedad, exenciones y liquidación |
| Evidencia | [phase-3/wp3-6-maintenance-2026-10-23.md](phase-3/wp3-6-maintenance-2026-10-23.md) | Mantenimiento automático, deterioro, política y backlog |
| Evidencia | [phase-3/wp3-7-insurance-2026-10-23.md](phase-3/wp3-7-insurance-2026-10-23.md) | Aseguradora, coberturas, primas, claims y exclusiones |
| Evidencia | [phase-3/wp3-8-zoning-permits-2026-10-23.md](phase-3/wp3-8-zoning-permits-2026-10-23.md) | Zoning, usos permitidos, permisos y caducidad |
| Evidencia | [phase-3/wp3-9-auctions-insolvency-2026-10-23.md](phase-3/wp3-9-auctions-insolvency-2026-10-23.md) | Subastas, refinanciación, ejecución e insolvencia inicial |
| Evidencia | [phase-3/wp3-10-rival-financial-ai-2026-10-23.md](phase-3/wp3-10-rival-financial-ai-2026-10-23.md) | IA rival financiera, reserva de liquidez, recuperación y persistencia |
| Evidencia | [phase-3/wp3-11-municipal-policy-2026-10-23.md](phase-3/wp3-11-municipal-policy-2026-10-23.md) | Catálogo municipal, trade-offs, lobby, retirada y efectos económicos |
| Evidencia | [phase-3/wp3-12-automation-ux-2026-10-23.md](phase-3/wp3-12-automation-ux-2026-10-23.md) | Rutina de cartera, excepciones, comparador y overlays operativos |
| Evidencia | [phase-3/wp3-13-art-audio-performance-2026-10-23.md](phase-3/wp3-13-art-audio-performance-2026-10-23.md) | Art Lab, renders, audio procedural, provenance y métricas representativas |
| Evidencia | [phase-3/wp3-14-persistence-observability-2026-10-23.md](phase-3/wp3-14-persistence-observability-2026-10-23.md) | Saves phase3-dev, autosave local, corrupción y observabilidad |
| Evidencia | [phase-3/wp3-15-validation-2026-10-23.md](phase-3/wp3-15-validation-2026-10-23.md) | Suite, smoke, benchmark, soak y decisión condicional del slice |

## Estado de las fases

| Fase | Estado al crear este plan | Regla de inicio |
|---|---|---|
| Fase 0 | DONE — cerrada 2026-10-20 | Acta en `phase-0/PHASE-0-CLOSURE.md` |
| Fase 1 / Gate 1 | REWORK — acta 2026-10-20 | Cerrar G1-RW-01..03 antes de aprobar |
| Fase 2 / Gate 2 | GO — WP2.14 cerrado 2026-10-23 | Baseline `graphic_civic`; WP3.13 habilitado |
| Fase 3 / Vertical slice | DONE — cierre 2026-10-23; WP3.2 a WP3.15 cerrados | Decisión `GO CONTROLLED ALPHA`; la siguiente fase es Alpha sistémica |
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
