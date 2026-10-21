# Estado actual

Fecha de consolidación: 2026-10-21.

## Repositorio
- Inicializado.
- Documentación de producto: sí.
- Arquitectura propuesta: sí.
- WBS/EDT: sí.
- Plan maestro de ejecución por fases: sí.
- Plantilla de microtareas para agentes de baja ambigüedad: sí.
- Fase 0 de preparación: cerrada el 2026-10-20.
- ADRs D-046 a D-052: aceptados.
- Charter, contratos, benchmark y backlog inicial de Gate 1: listos.
- Historias del prototipo: sí.
- Riesgos: sí.
- Investigación histórica: sí.
- Investigación avanzada de dirección artística y pipeline: sí.
- Art Bible / Art Pipeline v0.1: documentadas como propuesta de preproducción; no ratificadas como ADR.
- Visual Direction Spike: definido; pendiente de ejecución.
- Blender 5.2.2 LTS: instalado localmente y fijado como toolchain artístico inicial (D-053).
- Librería bootstrap CC0: descargada localmente; aún no versionada en Git.
- Staging artístico local: organizado por fuentes CC0 verificadas, cuarentena de
  licencia/origen pendiente y toolchain; manifests con hashes/provenance y
  validador local disponibles. Los binarios siguen ignorados hasta decidir LFS.
- Estrategia artística self-contained / coste ~0 para Gate 2: decidida (D-054).
- Building Factory / Character Factory: concepto documentado; no implementado.
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
- package.json: sí, raíz y workspaces mínimos de Gate 1.
- CI: sí, checks base en GitHub Actions.
- assets: no.
- backend: no.
- modelo de datos implementado: contratos shared v1 y núcleo autoritativo headless de Gate 1.
- tests: sí, smoke, contratos, schemas y arquitectura de fronteras.

## Fase
Gate 1 aprobado `GO` el 2026-10-21; la evidencia técnica de G1-RW-01..04 quedó reunida.

## Próximo objetivo
Gate 1 — viabilidad técnica.

El desglose operativo se encuentra en `docs/execution/`. El núcleo determinista, Worker,
snapshot v1, IndexedDB, escena/picking, flujo vertical, benchmark y soak headless están
cerrados. El retest browser carga 500 agentes y 100 estructuras en Worker y Phaser, mide
comandos/backlog/proyección/save-load y cubre 10 minutos a 10 Hz en Firefox y Chromium. Ambos
cumplen los umbrales. Gate 2 queda habilitado; el punto `events`/snapshots no se ha decidido ni
modificado.

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
