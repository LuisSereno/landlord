# Multijugador futuro

## Decisión

No forma parte del MVP ni del primer prototipo.

## Motivo

Añadir multijugador antes de validar el núcleo:
- complica estado;
- incrementa QA;
- obliga a seguridad;
- dificulta balance;
- exige infraestructura;
- retrasa aprendizaje de producto.

## Preparación arquitectónica

Sí se prepara desde el principio:
- comandos explícitos;
- estado serializable;
- determinismo;
- simulación desacoplada;
- ausencia de mutaciones desde UI.

## Modelo previsto

Servidor autoritativo.

Clientes:
- envían comandos;
- reciben estado/deltas;
- no determinan resultados económicos o de combate.

## Tecnología candidata

Colyseus para:
- rooms;
- sincronización;
- matchmaking;
- servidores autoritativos.

La elección se revalidará cuando comience esa fase.

## Modos posibles

1. PvP 2-4 jugadores.
2. cooperativo.
3. mundo asíncrono.
4. persistencia compartida limitada.

No se recomienda MMO como primer objetivo online.

## Mundo asíncrono

Idea futura: empresas de otros jugadores pueden existir como actores limitados cuando el propietario no está conectado, evitando griefing y sin requerir presencia simultánea.
