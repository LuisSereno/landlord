# Arquitectura para agentes

## Capas

### web
Phaser + React.

Responsabilidad:
- render;
- input;
- HUD;
- paneles;
- feedback.

No debe:
- decidir reglas económicas;
- mutar libremente el dominio.

### simulation
TypeScript puro.

Responsabilidad:
- estado;
- comandos;
- validaciones;
- reloj;
- eventos;
- sistemas.

No depende de Phaser, React ni DOM.

### persistence
IndexedDB inicialmente.
Snapshots versionados.

### backend
No construir hasta necesitar autenticación, cloud save o telemetría central.

### multiplayer
Futuro. Servidor autoritativo.

## Flujo correcto

User input
-> Command
-> Validation
-> State transition
-> Domain events
-> View projection
-> Render

## Determinismo

Nunca usar Math.random en dominio.
Aleatoriedad mediante PRNG(seed).

## Tiempo

Render frame rate y simulation tick rate son independientes.

## Data-driven

Preferir definiciones tipadas externas para:
- edificios;
- políticas;
- tenants;
- facciones;
- eventos;
- upgrades.

## Headless

Simulation debe arrancar sin UI para tests, IA y balance.

## Regla de dependencia

UI puede depender de shared contracts.
Simulation no depende de UI.
