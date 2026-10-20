# Arquitectura

## Objetivo

Separar completamente representación, simulación, persistencia y servicios online, preservando además la posibilidad futura de controlar distintos actores y organizaciones de una misma ciudad.

## Arquitectura cliente inicial

Aplicación web:
- Phaser: mapa, cámara, sprites, efectos e interacción espacial.
- React/DOM: HUD, paneles, menús, tablas y pantallas complejas.
- Web Worker: simulación.
- IndexedDB: guardados locales.

## Regla principal

Phaser representa el mundo, pero no contiene las reglas del mundo.

El paquete de simulación no debe importar Phaser, React ni APIs de DOM.

## Identidad y control

El motor no debe asumir que player == company.

Separar conceptualmente:
- PlayerIdentity: quién es el usuario dentro del mundo;
- Person: personaje persistente;
- Organization: empresa, gobierno, banco, sindicato, medio, facción, etc.;
- RoleAssignment: papel de una persona dentro de una organización;
- ControlContext: rol/organización actualmente operados;
- Capability: acciones autorizadas.

La experiencia inicial puede controlar principalmente una empresa, pero ownership y control no deben codificarse como propiedades de un singleton Player.

Ver: 07-player-identity-roles-and-capabilities.md.

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

Los comandos relevantes deben identificar el actor y, cuando corresponda, la organización en cuyo nombre actúa.

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
- instrumentación desde el prototipo;
- ownership separado de control;
- actors/organizations independientes;
- capabilities en lugar de flags globales de modo.

## Compatibilidad multiperspectiva

No se implementarán ahora modos político, criminal o ciudadano completos.

Sí se evitarán cierres arquitectónicos que los hagan inviables:
- no player.money como fuente única;
- no player.buildings;
- no if(playerIsMayor) repartidos por dominio;
- no información privada universal;
- no organizaciones que sólo existan como extensiones del jugador.

## No sobrearquitectar

No introducir inicialmente:
- Kubernetes;
- Redis sin caso de uso;
- microservicios;
- event streaming externo;
- servidores de juego permanentes para single-player;
- un framework genérico de life simulation;
- un sistema completo de roles si Gate 1 no lo necesita.

La arquitectura debe ser compatible con el futuro, no implementar el futuro por adelantado.
