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
- Capa funcional fiscal/urbana: documentada conceptualmente.
- Visión multiperspectiva y trayectoria vital: documentada conceptualmente.
- Modelo de identidad/roles/capabilities: documentado como restricción arquitectónica futura.

## Sistemas conceptualmente incorporados

Además del núcleo inmobiliario:
- impuestos y tasas;
- presupuesto municipal;
- permisos/licencias;
- zoning;
- seguros;
- mantenimiento;
- banca;
- subastas;
- insolvencia;
- contratos públicos;
- servicios urbanos;
- empleo;
- reputación;
- información imperfecta;
- macroeventos;
- múltiples roles futuros;
- Gameplay LOD;
- delegación;
- historial de carrera;
- Career Events;
- perspectivas política/criminal/inversora/ciudadana futuras.

Estos sistemas están documentados, no implementados.

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

## Restricciones arquitectónicas que Gate 1 debe respetar

Aunque no implemente multiperspectiva:
- evitar player == company;
- comandos con actor explícito cuando proceda;
- ownership independiente del control;
- organizaciones independientes;
- no hardcodear playerIsMayor/playerIsCriminal;
- no asumir información universal.

## Scope Gate 1

Incluido:
- mapa mínimo;
- cámara;
- interacción;
- simulation core;
- persistencia técnica;
- profiling.

Excluido:
- fiscalidad avanzada;
- banca;
- seguros;
- playable politician;
- playable criminal;
- citizen life simulation;
- ageing/family/dynasty;
- elections;
- multiplayer;
- LLM;
- mundo procedural amplio;
- backend complejo;
- contenido masivo.

## Pregunta de éxito
¿Puede una simulación determinista, desacoplada del render y no acoplada a una única organización del jugador, ejecutarse en navegador con rendimiento suficiente para escalar al prototipo?
