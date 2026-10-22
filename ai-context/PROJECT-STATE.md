# Estado actual

Fecha de consolidación: 2026-10-22.

## Repositorio
- Inicializado.
- Documentación de producto: sí.
- Arquitectura propuesta: sí.
- WBS/EDT: sí.
- Plan maestro de ejecución por fases: sí.
- Plantilla de microtareas para agentes de baja ambigüedad: sí.
- Fase 0 de preparación: cerrada el 2026-10-20.
- ADRs D-046 a D-061: aceptados.
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
- Código jugable: sí, baseline vertical coherente de Gate 2.
- package.json: sí, raíz y workspaces mínimos de Gate 1.
- CI: sí, checks base en GitHub Actions.
- assets: no.
- backend: no.
- modelo de datos implementado: contratos shared v1 extendidos de forma aditiva y núcleo autoritativo headless de Gate 2.
- tests: sí, smoke Chromium en CI, contratos, schemas, referencias de snapshot, arquitectura de
  fronteras, bucle económico determinista y diagnóstico de sesión acotado.

## Fase
Gate 1 aprobado `GO` el 2026-10-21; la evidencia técnica de G1-RW-01..04 quedó reunida.
Gate 2 en `REVIEW`: candidato económico y WP2.15 táctico integrados el 2026-10-22; todavía no
existe acta GO de producto porque faltan el playtest prolongado y la evidencia visual de WP2.14.

## Próximo objetivo
Coordinar WP2.15 con WP2.14 y repetir después una sesión humana de 30–60 minutos con seeds de
referencia. El baseline
económico actual cubre calendario
económico (30 minutos reales = un mes a 1×), mercado frente a producción propia, dos cuadrillas
asignables, edificios multiunidad, presupuesto y satisfacción de inquilinos, mantenimiento, rival
público con datos privados ocultos, política incierta y riesgo con cooldown y conservación de
dinero.

El desglose operativo se encuentra en `docs/execution/`. El núcleo determinista, Worker,
snapshot v1, IndexedDB, escena/picking, flujo vertical, benchmark y soak headless están
cerrados. El retest browser carga 500 agentes y 100 estructuras en Worker y Phaser, mide
comandos/backlog/proyección/save-load y cubre 10 minutos a 10 Hz en Firefox y Chromium. Ambos
cumplen los umbrales. Gate 2 queda habilitado. D-055 resuelve el punto `events`/snapshots: los
eventos normales son efímeros, mientras que la memoria histórica se materializará en registros
específicos cuando una regla lo necesite.

El baseline ya valida en código y smoke de navegador: render isométrico/picking, Worker,
tick fijo, seed/PRNG, determinismo, save/load y el primer flujo de producto. Debe validar en
sesiones de 30–60 minutos que el ritmo y los trade-offs son comprensibles y sostenibles.
El HUD incluye un diagnóstico efímero de comandos, transporte y métricas del Worker para que
los playtests puedan identificar rechazos repetidos sin persistir datos no autoritativos.
La comprobación manual básica de esa instrumentación quedó cerrada sin errores ni rechazos;
no reemplaza la validación de producto de Gate 2 ni demuestra todavía agentes funcionales.
La captura de la implementación anterior confirmó una vista técnica. WP2.11 usa una base
map-céntrica con panel operativo superpuesto/plegable, HUD jerarquizado, inspector contextual y
estados legibles; está lista para servir de pantalla representativa a WP2.14 según D-058.

El rework de auditoría quedó implementado bajo D-060. La suite automatizada cubre 91 pruebas,
además de tres benchmarks opt-in; el smoke de producción recorre materiales, producción, compra,
obra, asignación de dos cuadrillas, ocupación, mejora, política, save, reload real, load, rival y
ruta ilegal. Esto cierra la preparación técnica del playtest, no su evidencia humana prolongada.

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
