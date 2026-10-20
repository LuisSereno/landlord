# Stack web

## Propuesta

Lenguaje:
- TypeScript.

Build:
- Vite.

Render 2D/2.5D:
- Phaser como opción principal.

UI:
- React/DOM para paneles y menús.

Simulación:
- TypeScript puro en Web Worker.

Persistencia local:
- IndexedDB.

Backend inicial, cuando sea necesario:
- Node.js;
- Fastify o NestJS;
- PostgreSQL;
- object storage compatible con S3.

Observabilidad:
- logging estructurado;
- métricas de simulación;
- captura de errores;
- OpenTelemetry cuando exista backend suficiente para justificarlo.

## Phaser

Adecuado por:
- orientación HTML5;
- WebGL;
- ecosistema TypeScript;
- soporte de tilemaps;
- buena integración web.

Trabajo propio necesario:
- profundidad isométrica;
- selección;
- ocupación de celdas;
- pathfinding;
- herramientas.

## React

No usar React para representar cada entidad del mapa o para ejecutar actualizaciones por frame.

Sí usarlo para:
- HUD;
- economía;
- política;
- estadísticas;
- configuración;
- pantallas de empresa.

## WebGPU

No es requisito del MVP. WebGL2 es suficiente inicialmente.

## 3D

No usar Unity o Godot en la primera implementación salvo que un spike demuestre una ventaja clara. El diseño 2.5D web-native reduce peso, complejidad y barreras de despliegue.

## Activos

Posible pipeline:
Blender -> render/bake -> atlas de sprites -> Phaser.

Permite sensación volumétrica manteniendo render eficiente.
