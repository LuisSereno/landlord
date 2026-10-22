# D-061 — Spike de agentes, daño e incidentes antes del cierre de Gate 2

Estado: Aceptada
Fecha: 2026-10-22
Alcance: rework de Gate 2

## Contexto

El baseline D-056–D-060 valida el bucle económico, pero representa el trabajo mediante dos
cuadrillas numéricas y la ruta ilegal mediante una resolución probabilística sin actor, objetivo
ni efecto espacial. Los `agents` técnicos de Gate 1 no tienen función de producto. Un edificio
sólo dispone de `condition`; no existen salud, daño estructural, fuego, propagación, heridas o
muerte.

La investigación histórica quedó demasiado condensada. *Constructor* (1997) utilizaba equipos
físicos de supervisores y trabajadores, personal de reparación, combatientes, salud y muerte; el
deterioro podía iniciar un incendio, la reparación podía extinguirlo y una explosión dañaba los
edificios circundantes. *Street Wars/Mob Rule* amplió la relación entre personal especializado,
combate, sabotaje, cadáveres y respuesta policial. Son referencias de principios sistémicos, no
un catálogo de contenido que Landlord deba copiar.

Sin una prueba mínima de personas que actúan físicamente sobre el mundo, el Gate 2 sólo evalúa
timers económicos. Eso no basta para decidir si el núcleo soporta la interacción entre economía,
territorio, mantenimiento, riesgo y conflicto que define el producto.

## Decisión

Se añade `WP2.15 — Agents, damage & incidents spike` como rework obligatorio antes del acta
`GO` de Gate 2. D-061 sustituye para el criterio de cierre del gate la elección de cuadrillas
puramente agregadas de D-056 y el punto 5 de D-060. El código existente sigue siendo un baseline
válido y migrable; no se declara incorrecto retrospectivamente.

El spike debe demostrar, con contenido y nombres originales:

1. agentes individuales visibles y seleccionables con posición, salud, estado y especialidad;
2. una cuadrilla mínima compuesta por un supervisor y varios trabajadores;
3. desplazamiento y construcción ejecutados por esa cuadrilla;
4. un técnico de mantenimiento que se desplaza, repara y puede responder a un incendio;
5. un operativo hostil mínimo que selecciona un objetivo y puede atacar a una persona o sabotear
   un edificio rival;
6. edificios con `condition` y `structuralIntegrity` separadas;
7. incidente `burning` originado por deterioro o sabotaje, con intensidad determinista;
8. colapso o explosión con daño espacial acotado a edificios adyacentes;
9. heridas y muerte posibles para las personas expuestas;
10. consecuencias económicas observables y conexión mínima con `heat`/respuesta policial;
11. roundtrip de save/load y continuación determinista con la misma seed y comandos.

El spike no incluye reproducción de población, familias, envejecimiento, hospital jugable,
ambulancias, morgue, arsenal, múltiples clases criminales, perspectiva criminal jugable ni life
simulation. Tampoco obliga a copiar ratios de conversión, nombres, unidades, tono, interfaz o
contenido de las referencias históricas.

## Respuestas de alcance

1. **Problema de jugador:** convierte órdenes abstractas en acciones legibles, riesgos espaciales
   y decisiones sobre asignación, prevención y respuesta.
2. **Gate:** sí; valida que el bucle económico admite consecuencias físicas antes de aprobarlo.
3. **Decisión significativa:** asignar personas escasas entre producir, construir, mantener,
   defender y responder; la automatización futura evitará patrullaje manual repetitivo.
4. **Sistema reutilizable:** usa un pipeline común `actor -> task -> movement -> effect -> incident
   -> consequence`, no scripts exclusivos por misión.
5. **Determinismo:** orden estable por ID, pathfinding y desempates deterministas, PRNG persistido
   y golden scenarios de fuego/daño.
6. **Persistencia:** agentes, especialidades, salud, tareas, rutas necesarias, incidentes, fuego,
   integridad, daño y referencias causales.
7. **Saves:** sí; requiere extensión versionada o migración aditiva explícita y fixtures de
   compatibilidad.
8. **IP:** sólo principios abstractos y contenido propio; revisión de similitud obligatoria.
9. **Perspectiva:** las personas y organizaciones permanecen separadas; un agente no equivale al
   jugador ni a la empresa.
10. **Capabilities/ControlContext:** las órdenes del jugador conservan actor y organización
    explícitos; las especialidades operativas pueden empezar data-driven sin construir todavía el
    resolver general de roles jugables.

## Criterio de aceptación

Un escenario headless y uno visible deben recorrer al menos:

`orden -> desplazamiento -> trabajo/ataque -> daño o reparación -> incidente -> respuesta -> efecto económico`.

La aceptación exige golden tests con al menos dos seeds, save/load durante un incendio y durante
una tarea, daño adyacente sin dependencia del orden de iteración, rechazo atómico de órdenes
inválidas y budgets medidos frente a la referencia de Gate 1. WP2.13 debe repetirse después del
spike para medir si añade decisiones comprensibles sin introducir micromanagement dominante.

## Consecuencias

- Gate 2 permanece en `REVIEW` hasta cerrar WP2.13, WP2.14 y WP2.15.
- El alcance estimado de Gate 2 debe rebaselinarse después del diseño técnico del spike.
- Seguros, hospitales, evidencia avanzada y automatización profunda siguen en fases posteriores,
  pero el modelo mínimo no debe impedirlos.
- Cualquier cambio incompatible del snapshot o protocolo requiere la política de migración
  vigente; no se reutiliza silenciosamente `SnapshotV1` con semántica incompatible.

