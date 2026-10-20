# Arquitectura para agentes

## Capas

### web
Phaser + React.

Responsabilidad:
- render;
- input;
- HUD;
- paneles;
- overlays;
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
- sistemas;
- actors/organizations;
- ownership;
- roles/capabilities cuando sean necesarios.

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
-> ControlContext
-> Command
-> Validation
-> State transition
-> Domain events
-> View projection
-> Render

## Identidad y control

No asumir:
player == company.

Separar:
- PlayerIdentity;
- Person;
- Organization;
- ownership;
- RoleAssignment;
- ControlContext;
- Capability.

La implementación inicial puede simplificar UI y roles, pero el dominio no debe codificar que todos los recursos pertenecen a un objeto Player universal.

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
- upgrades;
- roles/capabilities cuando maduren.

## Headless

Simulation debe arrancar sin UI para tests, IA y balance.

## Gameplay LOD

Concepto futuro:
- cambiar de rol no crea otro mundo;
- cambia información visible, overlays, responsabilidades y delegación;
- sistemas no activos para el jugador siguen simulándose.

No construir este framework completo en Gate 1.

## Regla de dependencia

UI puede depender de shared contracts.
Simulation no depende de UI.

## Antipatrones

- game.player.money;
- game.player.buildings;
- if playerIsMayor repartido por negocio;
- información privada disponible globalmente;
- organizaciones modeladas como simples extensiones del usuario.
