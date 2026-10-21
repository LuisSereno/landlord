# Motor de simulación

## Tick

El render puede trabajar a 60 FPS, pero la simulación no necesita hacerlo.

Propuesta inicial:
- tick lógico fijo para sistemas activos;
- subsistemas lentos con frecuencias inferiores;
- simulación agregada para áreas inactivas.

Los valores finales se decidirán mediante profiling.

## Determinismo

Dada:
- misma versión del motor;
- misma seed;
- mismo estado;
- mismos comandos;
- misma secuencia temporal;

el resultado debe ser reproducible.

## Comandos

Ejemplos:
- BuyParcel.
- StartConstruction.
- AssignWorker.
- AssignTenant.
- UpgradeBuilding.
- TakeLoan.
- SabotageTarget.
- LobbyCouncillor.

Cada comando:
1. valida;
2. aplica;
3. emite eventos;
4. puede rechazarse con motivo estructurado.

## Eventos

Ejemplos:
- ParcelPurchased.
- BuildingCompleted.
- TenantMovedIn.
- RentCollected.
- PolicyEnacted.
- CrimeDetected.
- RivalActionFailed.

Los eventos permiten UI, telemetría, replay y depuración. Son notificaciones efímeras de la
transición aceptada: el comando los devuelve a sus consumidores, pero no se acumulan en
`GameState` ni se guardan en `SnapshotV1`. Si un hecho debe sobrevivir a save/load, se materializa
en un registro de dominio específico con su propio esquema y retención. Ver D-055.

## Entidades

Identificadores estables.

Tipos iniciales:
- Game;
- District;
- Parcel;
- Building;
- Worker;
- Tenant;
- Company;
- Faction;
- Policy;
- PoliticalActor.

## Tiempo

Debe distinguirse:
- tiempo real;
- tick;
- fecha de juego;
- velocidad de simulación.

Pausa y aceleración no cambian reglas económicas.

## Headless

El motor debe ejecutarse sin navegador gráfico para:
- tests;
- simulaciones masivas;
- IA;
- balance;
- reproducciones.

## Rendimiento

Primer benchmark:
- 500 agentes simplificados;
- 100 edificios;
- pathfinding básico;
- ejecución prolongada;
- medición de duración de ticks;
- detección de crecimiento de memoria.
