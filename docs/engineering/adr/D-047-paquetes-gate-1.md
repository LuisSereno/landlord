# D-047 — Paquetes y dependencias iniciales

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

La arquitectura objetivo enumera numerosos paquetes futuros, pero crearlos sin consumidores aumentaría superficie y ambigüedad. Gate 1 sólo necesita separar aplicación, simulación y contratos transportables.

## Decisión

```text
apps/
  web/
packages/
  simulation/
  shared/
```

- `apps/web`: Phaser, React, Worker adapter, IndexedDB adapter y proyecciones.
- `packages/simulation`: estado autoritativo, reloj, PRNG, comandos, eventos, sistemas y snapshots.
- `packages/shared`: contratos serializables, schemas de frontera y tipos opacos.

Dependencias permitidas:

- `web -> shared`;
- `web -> simulation` sólo en el entrypoint que empaqueta el Web Worker;
- `simulation -> shared`.

Dependencias prohibidas:

- `simulation -> web`;
- `shared -> simulation`;
- `simulation` o `shared` hacia React, Phaser, DOM, IndexedDB o adapters de UI.

`game-data` se creará cuando exista contenido configurable real. No se crearán paquetes vacíos de economía, IA, pathfinding, procedural, backend o networking.

## Alternativas descartadas

- Un único paquete: dificulta demostrar que simulation funciona sin navegador.
- Un paquete por dominio futuro: anticipa fronteras sin comportamiento real.
- Monorepo con orquestador adicional: Gate 1 no necesita cache distribuida ni grafo complejo.

## Consecuencias

- La frontera Worker actúa como límite explícito entre autoridad y representación.
- Los schemas compartidos pueden validar datos de transporte sin contener reglas mutables.
- La extracción de nuevos paquetes exigirá al menos dos consumidores o una frontera medida.

## Condición de revisión

Revisar cuando una capacidad real no pueda mantener cohesión, tiempos de build o límites de dependencia dentro de estos tres módulos.
