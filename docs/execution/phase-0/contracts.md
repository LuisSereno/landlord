# Contratos mínimos de Gate 1

Estado: Aceptado para implementación  
Protocolo: `1`  
Snapshot: `1`

Este documento especifica formas de datos. El código de Gate 1 debe conservar discriminantes, campos obligatorios, orden de validación y códigos. Los tipos branded son restricciones de compilación; Zod valida sus representaciones runtime.

## Primitivas

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };

type ProtocolVersion = Brand<1, "ProtocolVersion">;
type SchemaVersion = Brand<1, "SchemaVersion">;
type Tick = Brand<number, "Tick">;
type Money = Brand<number, "Money">;
type Seed = Brand<number, "Seed">;

type RequestId = Brand<string, "RequestId">;
type CommandId = Brand<string, "CommandId">;
type EventId = Brand<string, "EventId">;
type PlayerIdentityId = Brand<string, "PlayerIdentityId">;
type PersonId = Brand<string, "PersonId">;
type OrganizationId = Brand<string, "OrganizationId">;
type StructureId = Brand<string, "StructureId">;
type AgentId = Brand<string, "AgentId">;

type GridCell = { x: number; y: number };
```

- Tick, Money, Seed y coordenadas son safe integers.
- Tick, Money y coordenadas del mapa son no negativos.
- Seed está entre `0` y `4294967295`.
- IDs de transporte/dominio son strings no vacíos con límites definidos por schema.
- IDs de entidad cumplen `^(player|person|org|structure|agent|event)_[0-9]{8}$` según tipo.

## Entidades mínimas

```ts
type PlayerIdentity = {
  id: PlayerIdentityId;
  personId: PersonId;
};

type Person = { id: PersonId };

type Organization = {
  id: OrganizationId;
  kind: "company";
};

type OrganizationControlGrant = {
  personId: PersonId;
  organizationId: OrganizationId;
};

type TestStructure = {
  id: StructureId;
  ownerOrganizationId: OrganizationId;
  cell: GridCell;
};
```

Fixture inicial:

- `player_00000001 -> person_00000001`;
- `org_00000001` y `org_00000002`;
- grant entre `person_00000001` y `org_00000001`;
- ninguna autoridad sobre `org_00000002`.

## Protocolo Worker

### Sobre común

```ts
type RequestEnvelope<TType extends string, TPayload> = {
  protocolVersion: 1;
  requestId: RequestId;
  type: TType;
  payload: TPayload;
};
```

Requests:

```ts
type InitializeGameRequest = RequestEnvelope<"InitializeGame", {
  seed: Seed;
}>;

type SubmitCommandRequest = RequestEnvelope<"SubmitCommand", {
  command: PlaceTestStructure;
}>;

type SetRunStateRequest = RequestEnvelope<"SetRunState", {
  state: "paused" | "running";
  speed: 1 | 2 | 4;
}>;

type SaveSnapshotRequest = RequestEnvelope<"SaveSnapshot", Record<string, never>>;

type LoadSnapshotRequest = RequestEnvelope<"LoadSnapshot", {
  snapshot: SnapshotV1;
}>;

type GetMetricsRequest = RequestEnvelope<"GetMetrics", Record<string, never>>;
```

Responses:

```ts
type RequestSucceeded = {
  protocolVersion: 1;
  requestId: RequestId;
  type: "RequestSucceeded";
  payload: {
    acceptedAtTick: Tick;
    result?: unknown;
  };
};

type RequestFailed = {
  protocolVersion: 1;
  requestId: RequestId;
  type: "RequestFailed";
  payload: {
    code: ErrorCode;
    message: string;
    details?: Record<string, string | number | boolean>;
  };
};

type ProjectionPublished = {
  protocolVersion: 1;
  requestId: null;
  type: "ProjectionPublished";
  payload: ViewProjectionV1;
};

type SimulationMetricsPublished = {
  protocolVersion: 1;
  requestId: null;
  type: "SimulationMetricsPublished";
  payload: SimulationMetricsV1;
};
```

Notificaciones no solicitadas usan `requestId: null`. `RequestSucceeded` significa que la request fue procesada; para `SubmitCommand`, `acceptedAtTick` es el tick efectivo del comando.

## Comando y evento

```ts
type PlaceTestStructure = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
  type: "PlaceTestStructure";
  payload: { cell: GridCell };
};

type TestStructurePlaced = {
  eventId: EventId;
  tick: Tick;
  causationCommandId: CommandId;
  type: "TestStructurePlaced";
  payload: {
    structureId: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  };
};
```

Los comandos se encolan entre ticks y se aplican al inicio del siguiente tick. Dentro de un tick se conserva el orden de aceptación del Worker. Replays almacenan el tick efectivo y ese orden.

Orden de validación:

1. deduplicación;
2. persona;
3. organización;
4. control grant;
5. bounds;
6. ocupación.

```ts
type ErrorCode =
  | "DUPLICATE_COMMAND"
  | "PERSON_NOT_FOUND"
  | "ORGANIZATION_NOT_FOUND"
  | "ACTOR_NOT_AUTHORIZED"
  | "CELL_OUT_OF_BOUNDS"
  | "CELL_OCCUPIED"
  | "INVALID_PAYLOAD"
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_SNAPSHOT"
  | "INCOMPATIBLE_SCHEMA";
```

## Proyección

```ts
type ViewProjectionV1 = {
  projectionVersion: 1;
  tick: Tick;
  map: { width: 64; height: 64 };
  structures: Array<{
    id: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  }>;
  agents: Array<{
    id: AgentId;
    cell: GridCell;
  }>;
};
```

La proyección se ordena por ID. No contiene Maps, funciones ni objetos gráficos. La UI puede cachearla e interpolarla, nunca convertirla en autoridad.

## Snapshot v1

```ts
type SnapshotV1 = {
  schemaVersion: 1;
  engineVersion: string;
  seed: Seed;
  tick: Tick;
  prng: {
    algorithm: "xoshiro128ss-v1";
    state: [number, number, number, number];
  };
  idCounters: {
    structure: number;
    agent: number;
    event: number;
    commandOrder: number;
  };
  map: {
    width: 64;
    height: 64;
    blockedCells: GridCell[];
  };
  playerIdentities: PlayerIdentity[];
  persons: Person[];
  organizations: Organization[];
  controlGrants: OrganizationControlGrant[];
  agents: Array<{
    id: AgentId;
    cell: GridCell;
    target: GridCell;
    path: GridCell[];
  }>;
  structures: TestStructure[];
  processedCommandIds: CommandId[];
  pendingCommands: Array<{
    acceptedOrder: number;
    command: PlaceTestStructure;
  }>;
};
```

Los eventos de dominio no forman parte de `SnapshotV1`. Son efímeros y se entregan a los
consumidores de la transición actual. Los historiales que deban sobrevivir a save/load se
modelarán como registros de dominio específicos, no como un array creciente de eventos.

Reglas de canonicalización:

- claves de objeto en orden lexicográfico;
- entidades por ID ascendente;
- grants por `organizationId`, después `personId`;
- cells por `y`, después `x`, salvo paths cuyo orden es semántico;
- processed command IDs ascendentes;
- pending commands por `acceptedOrder`;
- números como JSON decimal, sin NaN, infinito ni `-0`.

El checksum SHA-256 pertenece al harness o a metadatos del slot, no al snapshot autoritativo.

## Ejemplo válido

```json
{
  "protocolVersion": 1,
  "requestId": "request-17",
  "type": "SubmitCommand",
  "payload": {
    "command": {
      "commandId": "command-9",
      "issuedByPersonId": "person_00000001",
      "actingAsOrganizationId": "org_00000001",
      "type": "PlaceTestStructure",
      "payload": { "cell": { "x": 10, "y": 12 } }
    }
  }
}
```

## Ejemplos inválidos y resultado

| Caso | Resultado |
|---|---|
| `protocolVersion: 2` | `UNSUPPORTED_PROTOCOL` |
| Seed `-1` o `1.5` | `INVALID_PAYLOAD` |
| Coordenada float o fuera de mapa | `INVALID_PAYLOAD` o `CELL_OUT_OF_BOUNDS` según frontera |
| Persona desconocida | `PERSON_NOT_FOUND` |
| `org_00000002` sin grant | `ACTOR_NOT_AUTHORIZED` |
| Snapshot schema `2` | `INCOMPATIBLE_SCHEMA` |
| Estado PRNG con cinco palabras | `INVALID_SNAPSHOT` |
| Entidad duplicada o referencia rota | `INVALID_SNAPSHOT` |

## Atomicidad de load

`LoadSnapshot` valida forma, versión, unicidad, referencias, límites y invariantes antes de sustituir estado. Ante cualquier fallo conserva la partida activa y devuelve error. IndexedDB conserva además la última copia validada.
