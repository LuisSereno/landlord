# D-055 — Eventos efímeros y registros persistentes derivados

Estado: Aceptada
Fecha: 2026-10-21
Alcance: Gate 2 y evolución del núcleo de simulación

## Contexto

El motor emite eventos de dominio después de aceptar comandos. El evento permite informar al
Worker y a sus consumidores de la transición causal, alimentar proyecciones, telemetría, replay y
depuración. Sin embargo, el historial completo de eventos no es necesario para hidratar el estado
autoritativo actual.

El `GameState` del spike mantenía los eventos aceptados en un array, mientras que `SnapshotV1` ya
no los serializaba. Esa diferencia hacía ambiguo si un evento era parte del estado persistente o
una notificación de la transición. También habría hecho crecer indefinidamente el estado en una
partida larga.

## Decisión

Se adopta la opción B:

- los eventos de dominio normales son efímeros;
- el comando aceptado devuelve/emite el evento para sus consumidores del ciclo actual;
- el evento no se añade al `GameState` canónico ni al `SnapshotV1`;
- `eventId` y su contador siguen formando parte del estado técnico para conservar identidad
  determinista durante la partida y después de un restore;
- los consumidores que necesiten memoria histórica deben escribir registros persistentes
  específicos, por ejemplo `TransactionLedger`, `RelationshipHistory`, `CrimeRecord` o
  `CareerHistory`;
- un replay técnico futuro conservará comandos, tick efectivo y orden de aceptación, no un array
  ilimitado de notificaciones ya consumidas.

El snapshot sigue siendo la fuente autoritativa para continuar una partida. No se adopta
event-sourcing como mecanismo de persistencia general ni se introduce protobuf/compresión para
resolver una necesidad que todavía no existe.

## Flujo

```text
comando
  -> validación y transición atómica
  -> evento efímero con causationCommandId
  -> proyección / UI / telemetría / replay del ciclo
  -> descarte del evento

estado histórico que afecta a reglas futuras
  -> registro de dominio específico
  -> snapshot versionado y migrable
```

## Criterio para persistir un evento

Un evento no se convierte en historial por ser observable. Se crea un registro persistente sólo si
su información debe sobrevivir a save/load para afectar una regla futura, una auditoría de juego o
la memoria estructurada de una entidad. El registro debe tener esquema, límites, política de
retención y tests de migración propios.

La memoria de una IA no leerá automáticamente un stream bruto de eventos. Consumirá hechos y
resúmenes relevantes derivados de esos registros, con límites de tamaño y de antigüedad.

## Alternativas descartadas

- Persistir todos los eventos en cada snapshot: duplica información derivable del estado y hace
  crecer los saves sin mejorar por sí mismo el comportamiento de la IA.
- Event-sourcing general como fuente primaria: añade reconstrucción, migraciones, retención y
  compatibilidad antes de que el producto necesite replay completo.
- Comprimir un historial ilimitado con protobuf: reduce bytes, pero no resuelve el modelo de
  retención ni convierte eventos en memoria útil para la IA.

## Consecuencias

- `SnapshotV1` no cambia de versión por esta decisión: ya excluía `events`.
- Restaurar una partida no reemite eventos antiguos ni duplica liquidaciones, acciones o avisos.
- Los consumidores deben procesar el evento en la respuesta/notificación actual o materializar un
  registro explícito antes de descartarlo.
- La futura implementación de replay podrá usar un stream acotado de comandos y checkpoints.
- Añadir el primer registro histórico que cambie reglas requiere actualizar schema, migración,
  retención y pruebas de continuación determinista.

## Evidencia de implementación

- `packages/simulation/src/state.ts` ya no incluye un array de eventos.
- `packages/simulation/src/commands.ts` devuelve el evento aceptado sin almacenarlo en el estado.
- `packages/simulation/src/snapshot.ts` restaura únicamente estado autoritativo y contadores.
- Las pruebas verifican que el evento no aparece en el snapshot y que el `eventId` continúa siendo
  monotónico después de save/load.
