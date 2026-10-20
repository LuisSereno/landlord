# Arquitectura

## Objetivo

Separar completamente representación, simulación, persistencia y servicios online.

## Arquitectura cliente inicial

Aplicación web:
- Phaser: mapa, cámara, sprites, efectos e interacción espacial.
- React/DOM: HUD, paneles, menús, tablas y pantallas complejas.
- Web Worker: simulación.
- IndexedDB: guardados locales.

## Regla principal

Phaser representa el mundo, pero no contiene las reglas del mundo.

El paquete de simulación no debe importar Phaser, React ni APIs de DOM.

## Estructura objetivo

/apps
- /web
- /server (cuando sea necesario)

/packages
- /simulation
- /economy
- /ai
- /pathfinding
- /game-data
- /procedural
- /shared
- /network (futuro)

/services
- /api
- /generative-ai (futuro)

/infrastructure
- configuración de despliegue
- contenedores cuando aporten valor

## Flujo

UI -> comando -> simulation -> evento/estado -> vista.

Nunca:
UI -> mutación arbitraria del modelo.

## Estado autoritativo

En single-player: Web Worker.

En multijugador futuro: servidor.

El cliente visual recibe snapshots/deltas y emite comandos.

## Principios

- determinismo;
- serialización explícita;
- esquema versionado;
- tick fijo;
- PRNG con seed;
- datos configurables;
- pruebas headless;
- instrumentación desde el prototipo.

## No sobrearquitecturar

No introducir inicialmente:
- Kubernetes;
- Redis sin caso de uso;
- microservicios;
- event streaming externo;
- servidores de juego permanentes para single-player.
