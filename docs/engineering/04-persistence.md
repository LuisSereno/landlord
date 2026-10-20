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
- cola de eventos relevante;
- metadatos.

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

## Compatibilidad

Los saves son un contrato. No aceptar una función nueva sin evaluar impacto en:
- esquema;
- migraciones;
- determinismo;
- tamaño de snapshot.
