# Persistencia

## MVP

Guardado local mediante IndexedDB.

Un save contiene:
- versión de esquema;
- versión de motor;
- seed;
- tick;
- fecha de juego;
- estado de PRNG;
- entidades;
- relaciones;
- economía;
- política;
- registros históricos derivados relevantes;
- metadatos.

Estos registros históricos derivados no constituyen un historial ilimitado de eventos de dominio.
Los eventos normales son efímeros y se consumen durante la transición actual. Sólo se persisten
registros específicos cuando una regla futura, una auditoría o la memoria estructurada de una
entidad necesita conservar el hecho.

## Snapshots

Preferir snapshots estructurados y versionados.

No serializar objetos de Phaser.

## Migraciones

Cada cambio incompatible debe incluir:
- versión origen;
- versión destino;
- función de migración;
- test con fixture histórico.

## Integridad

Medidas:
- validación de esquema;
- checksum opcional;
- autosave rotativo;
- último save válido;
- recuperación ante corrupción.

## Cloud

Fase posterior:
- usuario;
- slots;
- timestamps;
- sincronización;
- resolución de conflictos;
- backups.

PostgreSQL puede almacenar metadatos y estado serializado o referencias a objetos; la decisión exacta se tomará al diseñar guardado cloud.

## Replays

Posibilidad futura:
snapshot base + stream de comandos.

Útil para:
- bugs;
- determinismo;
- multijugador;
- balance.

El replay no requiere guardar todos los eventos emitidos: puede reconstruirlos desde el snapshot,
los comandos, el tick efectivo y su orden determinista. Si un evento no es reconstruible o debe
tener efectos históricos, debe materializarse como un registro de dominio versionado.

## Eventos e IA

Más eventos almacenados no implican una IA mejor. La IA debe consumir hechos y resúmenes relevantes
(por ejemplo, deuda, reputación, conflictos, consecuencias y tendencias), con límites de tamaño y
retención. No se debe entregar automáticamente un stream bruto completo a un agente.

## Compatibilidad

Los saves son un contrato. No aceptar una función nueva sin evaluar impacto en:
- esquema;
- migraciones;
- determinismo;
- tamaño de snapshot.
