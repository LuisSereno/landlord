# Estado actual

Fecha de consolidación: 2026-10-20.

## Repositorio
- Inicializado.
- Documentación de producto: sí.
- Arquitectura propuesta: sí.
- WBS/EDT: sí.
- Historias del prototipo: sí.
- Riesgos: sí.
- Investigación histórica: sí.
- Wiki para IA: sí.

## Implementación
- Código jugable: no.
- package.json: no.
- CI: no.
- assets: no.
- backend: no.
- modelo de datos implementado: no.
- tests: no.

## Fase
Predesarrollo / definición.

## Próximo objetivo
Gate 1 — viabilidad técnica.

Debe validar:
- render isométrico;
- picking;
- Web Worker;
- tick fijo;
- seed y PRNG;
- determinismo;
- save/load;
- benchmark.

## Scope Gate 1

Incluido:
- mapa mínimo;
- cámara;
- interacción;
- simulation core;
- persistencia técnica;
- profiling.

Excluido:
- elecciones;
- multiplayer;
- LLM;
- mundo procedural amplio;
- backend complejo;
- contenido masivo.

## Pregunta de éxito
¿Puede una simulación determinista, desacoplada del render, ejecutarse en navegador con rendimiento suficiente para escalar al prototipo?
