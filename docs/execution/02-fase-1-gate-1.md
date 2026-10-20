# Fase 1 — Gate 1: viabilidad técnica

Estado: IN_PROGRESS. WP1.1–WP1.12 completadas; siguiente WP1.13 (flujo vertical técnico).

## Objetivo de gate

Demostrar que una simulación determinista, headless, desacoplada del render y no acoplada a una única organización del jugador puede ejecutarse en un Web Worker, representarse en un mapa isométrico, persistirse y sostener la carga técnica de referencia.

Duración orientativa existente: 4-6 semanas; 80-120 jornadas-persona. Estas cifras presuponen un equipo, no un único agente.

## Resultado demostrable

Una build web permite:

1. crear una partida con seed conocida;
2. renderizar el mapa isométrico técnico;
3. mover y ampliar la cámara;
4. seleccionar una celda o entidad correctamente;
5. enviar un comando versionado al worker;
6. avanzar la simulación con tick fijo independiente del render;
7. observar una construcción mínima como prueba de flujo, sin economía de Gate 2;
8. guardar en IndexedDB, recargar y continuar;
9. repetir el escenario y obtener el mismo estado canónico;
10. ejecutar benchmark y soak con resultados registrados.

## Criterios de entrada

- Fase 0 cerrada.
- Tooling y PRNG decididos.
- Protocolo Worker y snapshot mínimo especificados.
- Escenario de carga y hardware/navegadores de referencia definidos.

## Workstream A — Plataforma y límites

### WP1.1 — Workspace reproducible

**Dependencias:** Fase 0.

**Tareas pequeñas:**

- `G1-WP01-T01` — Crear manifiesto raíz, workspace y lockfile.
- `G1-WP01-T02` — Crear `apps/web` con Vite y TypeScript strict.
- `G1-WP01-T03` — Crear `packages/simulation` sin dependencias de navegador.
- `G1-WP01-T04` — Crear `packages/shared` para contratos serializables.
- `G1-WP01-T05` — Configurar typecheck por paquete y en raíz.
- `G1-WP01-T06` — Configurar lint/format con scripts reproducibles.
- `G1-WP01-T07` — Configurar test runner y un test smoke por paquete.
- `G1-WP01-T08` — Configurar build de producción de la web.
- `G1-WP01-T09` — Añadir CI para install congelado, lint, typecheck, test y build.
- `G1-WP01-T10` — Añadir regla/test de arquitectura que impida imports de Phaser, React y DOM en simulation.

**Aceptación:** un clon limpio ejecuta todos los checks con los comandos documentados; `simulation` puede testearse en Node sin browser mocks.

### WP1.2 — Primitivas compartidas

**Dependencias:** WP1.1.

**Tareas pequeñas:**

- `G1-WP02-T01` — Implementar marcas o wrappers de `EntityId`, `Tick` y `SchemaVersion`.
- `G1-WP02-T02` — Implementar `Money` mínimo en unidad menor entera y sus validaciones.
- `G1-WP02-T03` — Definir `CommandEnvelope` con protocol version, command ID e issued tick.
- `G1-WP02-T04` — Añadir `issuedByPersonId` y `actingAsOrganizationId` opcional al contrato pertinente.
- `G1-WP02-T05` — Definir `CommandAccepted` y `CommandRejected` con códigos estables.
- `G1-WP02-T06` — Definir `DomainEventEnvelope` y causalidad con command ID.
- `G1-WP02-T07` — Definir tipos mínimos de proyección, separados del estado autoritativo.
- `G1-WP02-T08` — Verificar structured clone de todos los contratos.

**Aceptación:** ningún contrato transporta instancias de Phaser, funciones, fechas reales o referencias no serializables.

## Workstream B — Núcleo determinista

### WP1.3 — PRNG controlado

**Dependencias:** WP1.1 y ADR de PRNG.

**Tareas pequeñas:**

- `G1-WP03-T01` — Encapsular creación del PRNG desde seed normalizada.
- `G1-WP03-T02` — Implementar `nextUint` y operaciones estrictamente especificadas.
- `G1-WP03-T03` — Exportar e importar estado serializable del PRNG.
- `G1-WP03-T04` — Añadir vectores de prueba conocidos.
- `G1-WP03-T05` — Añadir test de continuidad tras export/import.
- `G1-WP03-T06` — Añadir regla de lint o escaneo que prohíba `Math.random` en dominio.

**Aceptación:** misma seed produce la misma secuencia; restaurar estado continúa exactamente en el valor siguiente.

### WP1.4 — Reloj y scheduler

**Dependencias:** WP1.2.

**Tareas pequeñas:**

- `G1-WP04-T01` — Implementar reloj lógico basado en tick entero.
- `G1-WP04-T02` — Implementar `step(n)` headless con límites validados.
- `G1-WP04-T03` — Implementar pausa y velocidades como control de scheduling, no como cambio de reglas.
- `G1-WP04-T04` — Definir orden estable de ejecución de sistemas.
- `G1-WP04-T05` — Definir orden estable de entidades sin depender de iteración accidental de estructuras.
- `G1-WP04-T06` — Prohibir `Date.now`/timers dentro de reglas de simulation.
- `G1-WP04-T07` — Testear equivalencia entre `step(100)` y cien pasos de uno.

**Aceptación:** variar FPS, pausar o cambiar velocidad no modifica el estado resultante para la misma secuencia lógica.

### WP1.5 — Estado, identidad y ownership mínimos

**Dependencias:** WP1.2 y WP1.4.

**Tareas pequeñas:**

- `G1-WP05-T01` — Definir `GameState` mínimo con seed, tick y referencias de entidades.
- `G1-WP05-T02` — Definir `Person` mínima sin inventar life simulation.
- `G1-WP05-T03` — Definir `PlayerIdentity` que referencia `Person`.
- `G1-WP05-T04` — Definir `Organization` mínima e independiente.
- `G1-WP05-T05` — Definir ownership de la entidad técnica mediante owner ID explícito.
- `G1-WP05-T06` — Crear fixture con una persona y dos organizaciones, sólo una controlada.
- `G1-WP05-T07` — Testear que control y ownership pueden diferir.

**Aceptación:** no existe `player.money`, `player.buildings`, `playerIsMayor` ni equivalentes; no se crea un resolver general de capabilities.

### WP1.6 — Pipeline de comandos y eventos

**Dependencias:** WP1.2, WP1.4 y WP1.5.

**Tareas pequeñas:**

- `G1-WP06-T01` — Crear registro/dispatcher de comandos con discriminante estable.
- `G1-WP06-T02` — Validar versión, actor, organización y tick de entrada.
- `G1-WP06-T03` — Implementar rechazo estructurado sin mutación parcial.
- `G1-WP06-T04` — Emitir eventos deterministas ligados al comando.
- `G1-WP06-T05` — Implementar comando técnico `PlaceTestStructure` o equivalente.
- `G1-WP06-T06` — Validar celda libre y ownership/autorización mínima.
- `G1-WP06-T07` — Crear proyección del cambio para render.
- `G1-WP06-T08` — Testear idempotencia o rechazo de command ID duplicado según ADR.

**Aceptación:** un comando inválido deja el estado canónico idéntico; humano e IA futura podrían usar el mismo contrato.

### WP1.7 — Runner headless y determinismo

**Dependencias:** WP1.3-WP1.6.

**Tareas pequeñas:**

- `G1-WP07-T01` — Crear factory de escenario desde seed.
- `G1-WP07-T02` — Crear runner que acepta una secuencia de comandos con ticks.
- `G1-WP07-T03` — Canonicalizar estado con orden explícito.
- `G1-WP07-T04` — Calcular hash o comparación profunda canónica.
- `G1-WP07-T05` — Añadir golden scenario de 1.000 ticks.
- `G1-WP07-T06` — Repetir escenario en dos procesos y comparar.
- `G1-WP07-T07` — Añadir test de divergencia al cambiar seed o comando.
- `G1-WP07-T08` — Generar artefacto diagnóstico con primer tick divergente.

**Aceptación:** varias ejecuciones limpias producen el mismo resultado byte/canónicamente equivalente; el test falla de forma útil ante divergencia.

## Workstream C — Worker y persistencia

### WP1.8 — Frontera Web Worker

**Estado:** DONE (2026-10-20).

**Dependencias:** WP1.6-WP1.7.

**Tareas pequeñas:**

- `G1-WP08-T01` — Crear entrypoint del worker sin imports UI.
- `G1-WP08-T02` — Implementar handshake y comprobación de versión de protocolo.
- `G1-WP08-T03` — Implementar inicio de partida desde seed.
- `G1-WP08-T04` — Implementar envío de comando y correlación de respuesta.
- `G1-WP08-T05` — Implementar control de pausa/velocidad fuera de reglas de dominio.
- `G1-WP08-T06` — Publicar proyecciones/deltas con cadencia controlada.
- `G1-WP08-T07` — Manejar mensajes inválidos sin matar silenciosamente el worker.
- `G1-WP08-T08` — Testear protocolo con worker real o harness equivalente.
- `G1-WP08-T09` — Medir latencia y backlog bajo la carga de referencia.

**Aceptación:** la UI no conserva una segunda copia autoritativa ni aplica resultados antes de la aceptación del worker.

**Evidencia:** `packages/simulation/src/worker-runtime.ts` implementa validación de protocolo,
cola entre ticks, correlación de respuestas, control de ejecución y publicación de proyección;
`apps/web/src/worker/simulation.worker.ts` contiene el entrypoint sin imports de UI y el scheduler
fijo de 50 ms. Los tests `packages/simulation/src/worker-runtime.test.ts` cubren handshake,
comando diferido, duplicados y protocolo no soportado. La latencia y backlog de carga quedan
pendientes del benchmark WP1.14; no se declara todavía la aceptación cuantitativa del gate.

### WP1.9 — Snapshot versionado

**Estado:** DONE (2026-10-20).

**Dependencias:** WP1.3-WP1.7.

**Tareas pequeñas:**

- `G1-WP09-T01` — Definir schema v1 del snapshot.
- `G1-WP09-T02` — Serializar seed, tick, PRNG, entidades y relaciones mínimas.
- `G1-WP09-T03` — Validar snapshot antes de hidratar estado.
- `G1-WP09-T04` — Rechazar versión incompatible con error recuperable.
- `G1-WP09-T05` — Restaurar y continuar el golden scenario.
- `G1-WP09-T06` — Añadir fixture histórico v1 inmutable.
- `G1-WP09-T07` — Medir tamaño y tiempo de serialización.

**Aceptación:** guardar en tick N, restaurar y avanzar produce el mismo estado que avanzar sin interrupción.

**Evidencia:** `packages/simulation/src/snapshot.ts` serializa el estado determinista en arrays
ordenados, valida el schema y referencias antes de hidratar, y restaura PRNG, allocators,
entidades, relaciones, comandos procesados y cola pendiente. `SimulationWorkerRuntime` expone
`SaveSnapshot`/`LoadSnapshot` con errores `INCOMPATIBLE_SCHEMA` e `INVALID_SNAPSHOT` sin sustituir
el estado activo ante fallos. Los tests de snapshot y Worker cubren roundtrip, continuidad,
PRNG, referencias rotas y schema incompatible. Tamaño/tiempo cuantitativos quedan para WP1.14.

### WP1.10 — IndexedDB y recuperación

**Estado:** DONE (2026-10-20).

**Dependencias:** WP1.8-WP1.9.

**Tareas pequeñas:**

- `G1-WP10-T01` — Crear adapter de persistencia fuera de simulation.
- `G1-WP10-T02` — Crear store/slot con metadatos y versión.
- `G1-WP10-T03` — Implementar guardado manual atómico en la medida soportada.
- `G1-WP10-T04` — Implementar listado y carga de slots.
- `G1-WP10-T05` — Conservar último save válido ante escritura/validación fallida.
- `G1-WP10-T06` — Mostrar error recuperable en UI.
- `G1-WP10-T07` — Testear roundtrip en IndexedDB de prueba.
- `G1-WP10-T08` — Testear payload corrupto y versión desconocida.

**Aceptación:** un save corrupto no destruye la última copia válida; ningún objeto Phaser entra en el snapshot.

**Evidencia:** `apps/web/src/persistence/indexed-db.ts` implementa el adapter fuera de
`simulation`, store versionado por slot, escritura transaccional y metadatos de IndexedDB.
Valida con `parseSnapshotV1` antes de escribir y conserva el último registro válido si falla una
validación; la carga vuelve a validar el payload almacenado. Los tests cubren roundtrip,
ordenación de slots, slot inexistente, escritura inválida y corrupción posterior. La UI recibirá
`SnapshotPersistenceError` en WP1.13 para mostrar el mensaje recuperable junto al flujo Worker.

## Workstream D — Representación web

### WP1.11 — Spike isométrico

**Estado:** DONE (2026-10-20).

**Dependencias:** WP1.1 y decisión Phaser.

**Tareas pequeñas:**

- `G1-WP11-T01` — Crear escena Phaser con tiles técnicos originales.
- `G1-WP11-T02` — Definir conversiones grid-a-screen y screen-a-grid.
- `G1-WP11-T03` — Renderizar mapa fijo de referencia.
- `G1-WP11-T04` — Implementar depth sorting determinista de la representación.
- `G1-WP11-T05` — Implementar pan con ratón/teclado.
- `G1-WP11-T06` — Implementar zoom con límites.
- `G1-WP11-T07` — Implementar límites de cámara.
- `G1-WP11-T08` — Añadir overlay de coordenadas y métricas en modo desarrollo.

**Aceptación:** la cámara es estable en límites y el orden visual no decide ninguna regla de ocupación.

**Evidencia:** `apps/web/src/isometric/IsometricSpikeScene.ts` dibuja la escena técnica original
de 64×64, ordena celdas por profundidad `(x+y, y, x)`, limita zoom, cámara y pan por ratón/
teclado, y muestra overlay de celda/zoom. `mount.ts` la monta en la app sin introducir reglas
de dominio.

### WP1.12 — Picking y selección

**Estado:** DONE (2026-10-20).

**Dependencias:** WP1.11.

**Tareas pequeñas:**

- `G1-WP12-T01` — Convertir puntero a candidatos de celda.
- `G1-WP12-T02` — Resolver solapamiento visual según geometría/proyección.
- `G1-WP12-T03` — Mostrar highlight técnico.
- `G1-WP12-T04` — Publicar selección a React mediante un adapter, no mediante dominio.
- `G1-WP12-T05` — Mostrar panel de inspección de sólo lectura.
- `G1-WP12-T06` — Añadir tests de conversión geométrica en bordes y esquinas.
- `G1-WP12-T07` — Añadir prueba de integración de selección con zoom/pan.

**Aceptación:** selección correcta en casos centrales y fronterizos documentados; React no representa entidades por frame.

**Evidencia:** `coordinates.ts` implementa proyección inversa, comprobación geométrica del
diamante y límites de mapa; la escena emite `cell-picked` y React sólo mantiene la selección
de inspección de lectura. Los tests cubren centros, esquinas/fronteras, mapa fuera de rango y
origen desplazado por cámara. Ninguna selección decide ocupación ni autorización.

### WP1.13 — Flujo vertical técnico

**Dependencias:** WP1.8, WP1.11 y WP1.12.

**Tareas pequeñas:**

- `G1-WP13-T01` — Inicializar worker desde la app y mostrar estado de conexión.
- `G1-WP13-T02` — Proyectar celdas/estructuras recibidas.
- `G1-WP13-T03` — Convertir selección + acción técnica en comando.
- `G1-WP13-T04` — Mostrar aceptación o rechazo estructurado.
- `G1-WP13-T05` — Actualizar render sólo desde proyección confirmada.
- `G1-WP13-T06` — Cablear pausa y velocidades.
- `G1-WP13-T07` — Cablear guardar/cargar y resincronizar proyección.
- `G1-WP13-T08` — Añadir recorrido end-to-end de la demo.

**Aceptación:** el recorrido completo funciona tras recargar la página y conserva tick/PRNG/estado.

## Workstream E — Rendimiento y cierre

### WP1.14 — Carga de 500 agentes

**Dependencias:** WP1.7-WP1.8.

**Tareas pequeñas:**

- `G1-WP14-T01` — Definir agente simplificado y comportamiento explícito del benchmark.
- `G1-WP14-T02` — Crear 500 agentes y 100 edificios desde seed.
- `G1-WP14-T03` — Implementar movimiento/pathfinding básico estrictamente necesario.
- `G1-WP14-T04` — Instrumentar tiempo por sistema y tick.
- `G1-WP14-T05` — Registrar media, p95, máximo y ticks fuera de budget.
- `G1-WP14-T06` — Medir coste de proyección y mensajes.
- `G1-WP14-T07` — Ejecutar benchmark headless y navegador.
- `G1-WP14-T08` — Documentar baseline y recomendar budgets de Gate 2.

**Aceptación:** escenario y comando son reproducibles; las cifras incluyen versión, build, seed, hardware y navegador.

### WP1.15 — Soak y estabilidad

**Dependencias:** WP1.10 y WP1.14.

**Tareas pequeñas:**

- `G1-WP15-T01` — Crear modo soak automatizado.
- `G1-WP15-T02` — Registrar memoria y métricas a intervalos definidos.
- `G1-WP15-T03` — Ejecutar la duración acordada, objetivo documental de dos horas.
- `G1-WP15-T04` — Investigar crecimiento sostenido y clasificar leaks.
- `G1-WP15-T05` — Verificar guardado/carga después del soak.
- `G1-WP15-T06` — Archivar resultados comparables.

**Aceptación:** no existe crecimiento injustificado conocido o queda cuantificado, reproducido y bloquea/aplaza el gate explícitamente.

### WP1.16 — Auditoría y decisión de Gate 1

**Dependencias:** todos los paquetes anteriores.

**Tareas pequeñas:**

- `G1-WP16-T01` — Ejecutar suite limpia y guardar evidencia.
- `G1-WP16-T02` — Ejecutar demo en navegadores de referencia.
- `G1-WP16-T03` — Revisar fronteras de imports y estado autoritativo.
- `G1-WP16-T04` — Revisar determinismo, snapshots y corrupción.
- `G1-WP16-T05` — Revisar provenance/IP de assets temporales.
- `G1-WP16-T06` — Registrar deuda y gaps descubiertos.
- `G1-WP16-T07` — Actualizar `PROJECT-STATE` y decisiones confirmadas.
- `G1-WP16-T08` — Emitir acta `GO`, `CONDITIONAL GO`, `REWORK` o `STOP`.

## Orden de ejecución resumido

```text
WP1.1 -> WP1.2 -> WP1.3/WP1.4 -> WP1.5 -> WP1.6 -> WP1.7
                                      |                   |
                                      +-> WP1.8 <-+--------+
WP1.1 -> WP1.11 -> WP1.12 ---------> WP1.13 <- WP1.10 <- WP1.9
                         WP1.7 -> WP1.14 -> WP1.15 -> WP1.16
```

## Condiciones de no aprobación

- La simulación necesita Phaser, React o DOM.
- Dos ejecuciones equivalentes divergen sin causa conocida.
- Save/load omite estado PRNG o tick.
- La UI puede mutar el estado autoritativo.
- El benchmark no alcanza una estabilidad aceptable y no existe plan viable.
- El modelo técnico usa `player == company`.
- El spike sólo funciona con estado global no serializable.

## Fuera de alcance

- Balance económico real.
- Mercado de tenants.
- IA rival estratégica.
- Crimen, policía o política de producto.
- Fiscalidad, banca, seguros, empleo o servicios.
- Arte final, backend, cloud save, multijugador, LLM.
- Framework completo de roles, capabilities o life simulation.
