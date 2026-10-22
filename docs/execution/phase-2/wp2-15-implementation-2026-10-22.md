# WP2.15 — Informe de implementación

Fecha: 2026-10-22  
Estado: integrado en la rama main; validación automatizada verde.

## Resultado

WP2.15 incorpora la primera capa táctica determinista sobre el baseline económico de Gate 2:

agentes -> movimiento -> órdenes -> trabajo/ataque/sabotaje -> fuego -> daño -> colapso -> casualties -> desplazamiento.

El spike mantiene roster fijo, tenants agregados y órdenes por cuadrilla. La IA rival conserva
construcción y mantenimiento operativos, pero no genera órdenes hostiles.

## Contratos y estado

- Se añadieron CrewId e IncidentId.
- Agent conserva compatibilidad con agentes técnicos y añade afiliación, especialidad, salud,
  estado, ruta, objetivo, tarea y cooldown.
- El roster inicial crea dos crews por organización, con supervisor y dos workers, además de un
  técnico de mantenimiento y un enforcer por organización.
- ConstructionSite incorpora kind, edificio objetivo, crews asignadas y técnico asignado,
  manteniendo el prefijo site_ y los campos heredados.
- Tenant.status distingue available, contracted y displaced.
- Building incorpora integridad estructural, estados de incendio/colapso/ruina y casualties
  acumuladas.
- IncidentRecord conserva origen, intensidad, organización/agente causante, tick y casualties
  del incidente.

## Reglas implementadas

- A* determinista N/E/S/O y movimiento a una celda cada 10 ticks.
- Persecución de objetivos móviles con recalculado acotado.
- Trabajo de crews en half-units: 2, 1 o 0 según supervisor y workers vivos/activos.
- Mantenimiento, reparación, ataque de 50 de daño y explosión de 60 de daño.
- Lesión durante dos días de juego y recuperación a salud 100.
- Sabotaje con fuego inicial a intensidad 40 y una única tirada PRNG de detección.
- Incendio por deterioro mensual al 35%, supresión técnica de 35/hora, crecimiento de 15/hora
  y daño estructural ceil(intensity / 10).
- Explosión diferida mediante collapse_pending, blast Manhattan de radio 3 y fuego secundario.
- Casualties deterministas por perfil de edificio, sin consumo de PRNG.
- Ruinas que desplazan tenants, conservan la ocupación de la parcela y sólo liberan la parcela al
  completar ClearRuin.

## Persistencia y proyección

Snapshot V1 sigue siendo aditivo. Los snapshots anteriores reciben defaults de roster, crews,
integridad, estado, tenant status e incidentes. El snapshot conserva agentes operativos, rutas,
tareas, crews e incidentes actuales.

La proyección expone especialidad, organización, salud y estado de los agentes para que el mapa y
el inspector puedan representarlos sin mover reglas de negocio al render.

## Verificación

Se ejecutaron correctamente:

- pnpm lint
- pnpm typecheck
- pnpm test -- --run
- git diff --check

La suite cubre shared, simulation, web y la comprobación de límites arquitectónicos. El smoke de
navegador específico de WP2.15 queda como siguiente evidencia de integración visual; el motor
headless y los contratos ya están integrados y validados.

## Límites preservados

No se añadieron reclutamiento, población física, experiencia, fatiga, armas, defensa táctica
compleja, hospitales, ambulancias, policía física, investigación ni IA militar rival.
