# D-051 — Contratos, protocolo y snapshot de Gate 1

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

La UI y la simulación necesitan un límite versionado y serializable. Sin un contrato previo, el Worker, los saves y el replay podrían adoptar formatos distintos o permitir mutaciones parciales.

## Decisión

La versión inicial del protocolo Worker y del snapshot es `1`. Los mensajes llevan `protocolVersion` y `requestId`; el dominio usa un `commandId` independiente. Una versión desconocida produce `UNSUPPORTED_PROTOCOL` sin mutar estado.

Requests:

- `InitializeGame`;
- `SubmitCommand`;
- `SetRunState`;
- `SaveSnapshot`;
- `LoadSnapshot`;
- `GetMetrics`.

Responses/notificaciones:

- `RequestSucceeded`;
- `RequestFailed`;
- `ProjectionPublished`;
- `SimulationMetricsPublished`.

El único comando de dominio del spike es `PlaceTestStructure`, con persona, organización representada y celda. Los comandos recibidos entre ticks se encolan y se aplican al inicio del siguiente tick en orden de recepción ya aceptado por el Worker. El Worker asigna el tick efectivo.

Orden de validación:

1. command ID no procesado;
2. persona existente;
3. organización existente;
4. grant de control;
5. celda dentro del mapa;
6. celda desocupada.

Códigos estables:

- `DUPLICATE_COMMAND`;
- `PERSON_NOT_FOUND`;
- `ORGANIZATION_NOT_FOUND`;
- `ACTOR_NOT_AUTHORIZED`;
- `CELL_OUT_OF_BOUNDS`;
- `CELL_OCCUPIED`;
- `INVALID_PAYLOAD`;
- `UNSUPPORTED_PROTOCOL`;
- `INVALID_SNAPSHOT`;
- `INCOMPATIBLE_SCHEMA`.

Todo rechazo es atómico y conserva el estado canónico. El evento aceptado es `TestStructurePlaced`, con ID determinista, tick, command causante, structure, owner y celda.

Snapshot v1 incluye versión de schema/motor, seed, tick, PRNG, contadores, mapa, identidades, personas, organizaciones, grants, agentes, estructuras, commands procesados y cola determinista pendiente si existe. Timestamps reales y nombre de slot son metadatos de persistencia externos.

La representación canónica ordena claves y arrays de entidades por ID. El harness calcula SHA-256; simulation no depende de crypto.

Los tipos y ejemplos completos están en `docs/execution/phase-0/contracts.md`.

## Alternativas descartadas

- Exponer el estado mutable al hilo principal: rompe autoridad.
- Usar el request ID como command ID: mezcla transporte e idempotencia de dominio.
- Guardar clases o Maps directamente: dificulta validación, migración y formato estable.
- Timestamp real para ordenar comandos: introduce no determinismo.

## Consecuencias

- Cambiar discriminantes o campos obligatorios requiere versión/migración.
- Proyecciones pueden evolucionar sin convertirse en snapshots autoritativos.
- Replay podrá conservar accepted tick y command ID.

## Condición de revisión

Revisar si el primer flujo vertical demuestra ambigüedad, pérdida de mensajes o coste de serialización fuera de D-052. Cualquier cambio incompatible incrementa versión.
