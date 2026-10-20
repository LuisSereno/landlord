# D-049 — Schemas y modelo de entidades

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

Gate 1 necesita validar datos externos y serializar entidades sin adoptar un ECS ni construir el modelo de roles futuro.

## Decisión

Zod `4.4.3` validará mensajes Worker, snapshots, datos y configuración. Las reglas internas usarán tipos TypeScript explícitos; no se ejecutará Zod en cada transición.

El runtime utilizará entidades convencionales normalizadas:

- `Map<EntityId, Entity>` para lookup;
- orden por ID antes de cualquier proceso donde el orden afecte resultados;
- arrays ordenados por ID en snapshots;
- ningún objeto Phaser, React, DOM o clase con métodos dentro del estado.

IDs: strings branded con prefijo y secuencia de ocho dígitos, por ejemplo `person_00000001`. Los contadores forman parte del estado y se incrementan de manera determinista. No se usan índices, tiempo real, UUID aleatorio ni coordenadas como identidad.

`Tick` y `Money` son branded safe integers no negativos. `Money` representa unidad menor y rechaza floats, NaN, infinito y desbordamiento.

Modelo mínimo:

```ts
type PlayerIdentity = { id: PlayerIdentityId; personId: PersonId };
type Person = { id: PersonId };
type Organization = { id: OrganizationId; kind: "company" };
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

El fixture inicial tendrá una persona, dos compañías, control de una sola y ownership independiente. No implementará roles, capabilities, reputación ni life state.

## Alternativas descartadas

- ECS: no hay volumen ni patrones suficientes para justificarlo.
- Clases OO serializadas: complican structured clone y migraciones.
- Tipos inferidos exclusivamente desde Zod: acoplarían dominio interno a validación de frontera.
- Singleton `Player`: viola la separación entre persona, organización, control y ownership.

## Consecuencias

- Las iteraciones sobre `Map` no se consideran orden de negocio implícito.
- Los adapters reconstruyen mapas desde snapshots ordenados.
- El sistema mínimo preserva multiperspectiva sin construirla.

## Condición de revisión

Revisar ECS sólo con profiling que demuestre un cuello de botella y un spike comparativo. Ampliar identidad/control sólo cuando un caso del gate lo requiera.
