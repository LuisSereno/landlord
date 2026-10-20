# Charter de Gate 1 — Viabilidad técnica

Estado: READY  
Versión: 1  
Fecha base: 2026-10-20

## Pregunta de gate

¿Puede una simulación determinista, desacoplada del render y no acoplada a una única organización del jugador ejecutarse en navegador, persistirse y sostener la carga de referencia con margen suficiente para Gate 2?

## Incluido

- Workspace pnpm con web, simulation y shared.
- TypeScript strict, lint, tests, CI y build reproducible.
- Mapa técnico isométrico `64 × 64`.
- Cámara, zoom, límites, picking y selección.
- Web Worker autoritativo con protocolo v1.
- Tick fijo de 20 Hz separado del render.
- PRNG `xoshiro128ss-v1`, seed y estado persistible.
- Identidad, organización, control y ownership mínimos.
- `PlaceTestStructure` como flujo vertical técnico.
- Snapshot v1, IndexedDB, carga y recuperación ante corrupción.
- Runner headless, canonicalización y golden scenarios.
- 500 agentes, 100 obstáculos, A* básico y profiling.
- Chromium y Firefox; benchmark y soak.

## Excluido

- Economía jugable, balance, materiales, tenants y renta.
- IA rival estratégica, crimen, policía y políticas de producto.
- Fiscalidad, banca, seguros, permisos, empleo y servicios.
- Roles/capabilities completos y perspectivas alternativas.
- Arte final, audio final y contenido protegido de referencias.
- Backend, cloud save, cuentas, telemetría remota y multiplayer.
- LLM, microservicios, Redis, Kubernetes y ECS.

## Demo reproducible

1. Instalar con lockfile congelado y ejecutar checks completos.
2. Abrir build de producción en Chromium con seed `1`.
3. Confirmar handshake de protocolo y tick `0`.
4. Mover cámara, aplicar zoom y comprobar límites.
5. Seleccionar una celda libre en el mapa isométrico.
6. Enviar `PlaceTestStructure` actuando como la compañía controlada.
7. Observar aceptación, evento y proyección confirmada en el tick siguiente.
8. Repetir sobre la celda ocupada y observar `CELL_OCCUPIED` sin cambio de hash.
9. Intentar actuar como la segunda compañía y observar `ACTOR_NOT_AUTHORIZED`.
10. Avanzar, pausar y cambiar velocidad sin cambiar las reglas.
11. Guardar snapshot en IndexedDB, cerrar, cargar y continuar.
12. Comparar el hash final con ejecución ininterrumpida.
13. Repetir smoke en Firefox.
14. Presentar resultados de benchmark, soak y memoria.

## Evidencia obligatoria

- Install/lint/typecheck/test/build verdes desde clon limpio.
- Test de fronteras de imports.
- Vectores PRNG en Node, Chromium y Firefox.
- Golden scenario de 1.000 ticks repetido en procesos independientes.
- Tests de rechazo atómico y deduplicación.
- Roundtrip y continuación determinista de snapshot.
- Carga válida, corrupta e incompatible de IndexedDB.
- Pruebas geométricas de picking con pan/zoom.
- Informes headless, Chromium, Firefox y soak.
- Procedencia de assets técnicos.

## Decisión

### GO

Todos los checks funcionales y de determinismo pasan; todos los umbrales D-052 se cumplen; no existe violación de autoridad, ownership o frontera de dependencias; la deuda remanente no bloquea Gate 2.

### CONDITIONAL GO

Sólo para deuda no funcional y no relacionada con determinismo, pérdida de saves, autoridad, IP o thresholds. Cada condición tiene ID, responsable, fecha y test de cierre antes de iniciar el sistema afectado de Gate 2.

### REWORK

Cualquier criterio obligatorio falla pero existe una vía técnica acotada y comprobable para corregirlo.

### STOP

El spike demuestra que la dirección técnica no es viable dentro de los budgets o exige una reescritura fundamental. Se detiene Gate 2 y se abre un ADR de alternativa.

## Condiciones automáticas de no aprobación

- Simulation importa Phaser, React, DOM o IndexedDB.
- La UI puede mutar estado autoritativo.
- Mismas entradas producen hashes distintos.
- Snapshot omite tick, PRNG, allocator o estado que cambia resultados.
- Control y ownership están colapsados en `Player`.
- Un save corrupto destruye la última copia válida.
- Se rebaja un umbral sin ADR.
- Assets o copy carecen de procedencia.

## Responsabilidades

- Responsable técnico: acepta ADRs, thresholds y decisión final.
- Implementador: entrega tarea y evidencia, no aprueba su propio gate.
- Revisor: inspecciona diff, casos negativos y artefactos.
- QA/performance: reproduce benchmark y save/load.
- Producto: confirma que Gate 1 no ha absorbido sistemas de Gate 2.

Los nombres concretos se asignarán al iniciar Gate 1; el rol es obligatorio aunque una misma persona cubra varios.
