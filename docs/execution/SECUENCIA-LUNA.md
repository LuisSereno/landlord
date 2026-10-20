# Secuencia operativa para Luna

## Objetivo

Ejecutar el plan con el nivel mínimo de razonamiento que siga siendo seguro. La reducción de razonamiento se consigue cerrando antes las decisiones, disminuyendo el tamaño del cambio y proporcionando pruebas exactas; no omitiendo contexto crítico.

## Niveles de tarea

| Nivel operativo | Tipo de trabajo | Uso de Luna |
|---|---|---|
| L0 — mecánico | Scaffold decidido, tipos, fixtures, scripts, docs, casos de test explícitos | Nivel mínimo |
| L1 — lógica local | Una función/sistema con contrato e invariantes cerrados | Nivel mínimo si la plantilla está completa |
| L2 — integración | Worker, persistencia, UI-dominio, migraciones | Dividir primero; revisión humana/arquitectónica obligatoria |
| L3 — decisión | Arquitectura, librerías, balance, fórmulas, scope | No delegar como implementación a Luna mínima; hacer spike/ADR |

Si una tarea L0/L1 descubre una elección L3, cambia a `BLOCKED`; no debe improvisarla.

## Cadencia de una iteración

1. El responsable toma el primer ID `READY` sin dependencias pendientes.
2. Copia `PLANTILLA-TAREA-LUNA.md` y completa todos los campos.
3. Comprueba que el prompt menciona un solo resultado observable.
4. Entrega a Luna sólo el contexto necesario, las rutas exactas y el contrato.
5. Luna inspecciona el código, implementa, prueba y resume.
6. El responsable revisa el diff y los resultados reales.
7. Si cumple, marca `DONE` y desbloquea sucesoras.
8. Si falla por ambigüedad, se mejora la tarea; no se amplía el prompt durante la implementación.
9. Cada 5-10 tareas integradas se ejecuta la suite completa y el golden scenario disponible.

## Cola inicial recomendada

Estado a 2026-10-20: la Cola A está cerrada documentalmente mediante D-046 a D-052. La siguiente tarea ejecutable es `G1-WP01-T01`, detallada en `phase-0/gate-1-backlog.md`.

### Cola A — Decisiones antes de Luna mínima

Estado: DONE.

No comenzar código hasta cerrar:

1. `F0-WP01-T01` a `F0-WP01-T05` — alcance y demo.
2. `F0-WP02-T01` a `F0-WP02-T08` — tooling, PRNG, schemas, entidades y Phaser.
3. `F0-WP03-T01` a `F0-WP03-T06` — fronteras y contratos.
4. `F0-WP04-T01` a `F0-WP04-T07` — estrategia de evidencia.

Son tareas de criterio. Pueden incluir spikes pequeños, pero su conclusión debe revisarla una persona o un agente con razonamiento suficiente.

### Cola B — Scaffold mecánico

Después de cerrar ADRs:

1. `G1-WP01-T01` manifiesto/workspace.
2. `G1-WP01-T02` app web.
3. `G1-WP01-T03` paquete simulation.
4. `G1-WP01-T04` paquete shared.
5. `G1-WP01-T05` typecheck.
6. `G1-WP01-T06` lint/format.
7. `G1-WP01-T07` tests smoke.
8. `G1-WP01-T08` build.
9. `G1-WP01-T09` CI.
10. `G1-WP01-T10` test de fronteras.

Ejecutar una tarea por prompt. Una vez creadas las rutas reales, actualizar los prompts restantes con nombres y comandos exactos.

### Cola C — Contratos y primitivas

Ejecutar `G1-WP02-T01` a `G1-WP02-T08`. Agrupar sólo pares inseparables, por ejemplo tipo + test. Revisar especialmente que ningún contrato incluya clases de UI ni tipos no serializables.

### Cola D — Determinismo

1. PRNG: `G1-WP03-T01` a `T06`.
2. Reloj: `G1-WP04-T01` a `T07`.
3. Estado/identidad: `G1-WP05-T01` a `T07`.
4. Comandos/eventos: `G1-WP06-T01` a `T08`.
5. Headless: `G1-WP07-T01` a `T08`.

No iniciar la siguiente subcola con tests rojos. Ejecutar el golden scenario al final de cada una desde que exista.

### Cola E — Líneas paralelizables con ownership claro

Después de WP1.7 se pueden abrir tres líneas si no modifican los mismos contratos:

- Línea worker: WP1.8.
- Línea persistencia: WP1.9 y después WP1.10.
- Línea visual: WP1.11 y después WP1.12.

La integración WP1.13 comienza sólo cuando las tres líneas publican contratos estables. Si trabaja un solo agente, ejecutar persistencia, visual y worker en ese orden o el orden que minimice bloqueos según el código real.

### Cola F — Evidencia y gate

1. Flujo técnico: WP1.13.
2. Benchmark: WP1.14.
3. Soak: WP1.15.
4. Auditoría: WP1.16.

Estas tareas requieren revisión de resultados; Luna puede ejecutar scripts y preparar informes, pero no declarar por sí sola que el gate está aprobado.

## Formato mínimo del paquete de contexto

Cada prompt a Luna contendrá:

- ID y título.
- Estado del gate en una oración.
- Máximo tres documentos/secciones, además de `AGENTS.md`, salvo necesidad demostrada.
- Dependencias ya implementadas con rutas.
- Archivos permitidos y prohibidos.
- Contrato completo o enlace a un tipo ya existente.
- Tres a seis casos de aceptación.
- Comandos exactos de test.
- Condición de parada ante discrepancias.

No pegar toda la visión del producto en una tarea mecánica. Sí recordar siempre la invariante relevante: determinismo, frontera UI, ownership, saves o IP.

## Revisión del resultado de Luna

El revisor comprueba, en este orden:

1. `git diff --check` y archivos inesperados.
2. Cumplimiento exacto del alcance.
3. Tests: que fallen por la razón correcta si se rompe el comportamiento.
4. Errores y casos negativos, no sólo happy path.
5. Determinismo y serialización si aplica.
6. Dependencias/imports y estado autoritativo.
7. Impacto en saves y docs.
8. Suite indicada y, periódicamente, suite completa.

No aceptar una tarea sólo porque compile o porque el resumen declare éxito.

## Señales para dividir una tarea

- Requiere tocar más de un paquete y no es un adapter explícito.
- Añade una dependencia y comportamiento a la vez.
- Cambia schema y lógica sin fixture/migración separados.
- Tiene más de seis criterios de aceptación no triviales.
- Mezcla UI, dominio y persistencia.
- Incluye “refactorizar” sin enumerar el resultado.
- Luna necesita preguntar por una fórmula, política o alternativa arquitectónica.

## Señales para elevar razonamiento

- Dos documentos vigentes parecen contradecirse.
- La implementación real invalida un ADR.
- Aparece una diferencia entre control y ownership no contemplada.
- El cambio puede romper determinismo de manera no local.
- Se modifica una frontera pública, snapshot o protocolo.
- Un benchmark empeora sin causa evidente.
- La solución requiere una excepción especial por seed o contenido.

## Cierre de cada paquete WP

- Todas sus tareas están `DONE` o explícitamente `DEFERRED` por el gate.
- Suite local y checks transversales pasan.
- Existe una demo o artefacto de evidencia.
- Se actualizaron documentos y fixtures.
- La siguiente WP tiene entradas reales, rutas y comandos revisados.
