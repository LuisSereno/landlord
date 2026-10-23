# Fase 2 — Gate 2: viabilidad de producto

## Objetivo de gate

Validar que el núcleo produce decisiones interesantes durante una sesión coherente de 30-60 minutos:

`comprar -> producir -> asignar agentes -> construir -> ocupar -> cobrar -> mantener/defender -> competir -> asumir riesgo -> reaccionar a incidentes -> adaptarse a una ordenanza -> reinvertir`

La experiencia continúa centrada en Landlord/Entrepreneur. Los costes económicos existen sólo con el detalle necesario para probar el bucle.

Baseline de estimación anterior a D-061: 10-14 semanas y 180-280 jornadas-persona. Ya no es una
estimación vigente; WP2.15 debe diseñarse antes de rebaselinar duración y esfuerzo.

## Estado de implementación — 2026-10-23

WP2.1–WP2.12 cuentan con un candidato económico integrado bajo D-056–D-060. El calendario económico está
separado del tick técnico (30 minutos reales por mes a 1×); existen mercado frente a producción
propia, dos cuadrillas físicas asignables, contratos multiunidad, presupuesto/satisfacción, reparación,
rival utility mínimo, política incierta, sabotaje físico y ruta ilegal con cooldown. Save/load conserva la cola
autoritativa y las referencias de Phase 2 se validan.

WP2.13 queda respaldado por la confirmación manual OK del responsable y por la suite, benchmark y
smoke reproducibles. WP2.15 queda implementado y validado por pruebas tácticas y smoke browser.
WP2.14 queda cerrado el 2026-10-23 con baseline `graphic_civic`, renders headless, provenance,
metadata y Art Lab. El Gate 2 pasa a `GO` para producción representativa. La decisión completa está en
`docs/execution/phase-2/gate-2-review-2026-10-23.md`.

## Criterios de entrada

- Acta `GO` de Gate 1.
- Budgets de tick, mensajes, snapshot y render definidos.
- Decisión confirmada sobre Phaser, PRNG, schemas y estrategia de entidades.
- Pipeline de comandos, eventos, worker, save/load y benchmark estable.

## Métricas de producto

- Tiempo hasta primera parcela comprada.
- Tiempo hasta primera construcción terminada.
- Tiempo hasta primer ingreso.
- Número de decisiones estratégicas frente a acciones repetitivas.
- Porcentaje de tiempo sin una opción comprensible.
- Motivos de rechazo de comandos y claridad percibida.
- Quiebras o bloqueos de progresión por seed.
- Acciones inválidas/fallos de la IA rival.
- Éxito de save/load durante una sesión.
- p95 del tick y frame time bajo la partida de referencia.
- Órdenes tácticas significativas frente a correcciones repetitivas por agente.
- Tiempo de respuesta a un incidente y claridad de su cadena causal.

No se fijan objetivos numéricos definitivos sin playtest baseline. Tras las primeras sesiones internas se registran los umbrales del gate.

## WP2.1 — Modelo de mundo jugable mínimo

**Resultado:** un distrito fijo, parcelas comprables y ownership explícito.

**Tareas:**

- Definir `District`, `Parcel` y ocupación con IDs estables.
- Crear un mapa de prototipo data-driven y validado.
- Definir owner como organización o propietario admitido, nunca como “player”.
- Implementar `BuyParcel` con actor, organización, precio y parcela.
- Validar parcela disponible, autoridad y caja suficiente.
- Emitir `ParcelPurchased` o rechazo estructurado.
- Proyectar precio, owner, zoning mínimo y estado de ocupación.
- Añadir tests de compra, rival, saldo insuficiente y comando duplicado.
- Persistir y restaurar ownership.

**Aceptación:** comprar transfiere ownership y caja de forma atómica; un rechazo no cambia ninguna de las dos.

## WP2.2 — Caja y libro económico mínimo

**Resultado:** flujos explicables sin construir todavía contabilidad completa.

**Tareas:**

- Modelar caja por `Organization` con `Money`.
- Definir transacción mínima con causa, tick, debit/credit lógico y referencia.
- Impedir saldo negativo salvo regla explícita futura.
- Implementar costes de compra, producción, obra y upgrade.
- Implementar ingresos de renta.
- Crear proyección de movimientos y saldo.
- Añadir invariantes de conservación donde aplique.
- Añadir tests que impidan creación/destrucción accidental de dinero.

**Aceptación:** toda variación de caja del prototipo tiene una causa auditable y se conserva tras save/load.

## WP2.3 — Producción y recursos

**Resultado:** cemento, ladrillo y acero se producen mediante ciclos simples y alimentan la construcción.

**Tareas:**

- Definir catálogo propio de recursos y recetas en datos validados.
- Modelar inventario y capacidad sin floats ambiguos.
- Implementar estructura productiva mínima y estado operativo.
- Implementar producción por horas del calendario de juego, desacoplada del tick técnico.
- Detener producción al alcanzar capacidad.
- Definir coste operativo simple si es necesario para cerrar el bucle.
- Proyectar stock, capacidad, tasa y próximo ciclo.
- Testear fábrica operativa, inoperativa, almacén lleno y coherencia con pausa/velocidad.
- Persistir progreso del ciclo e inventario.

**Aceptación:** misma seed y secuencia temporal produce los mismos recursos; la UI no incrementa stocks.

## WP2.4 — Construcción

**Resultado:** iniciar, progresar, cancelar y terminar una obra sobre parcela propia.

**Tareas:**

- Definir catálogo mínimo de edificios originales con requisitos data-driven.
- Modelar `ConstructionSite` separado del edificio terminado.
- Implementar `StartConstruction` con actor/organization/parcela/tipo.
- Validar ownership, celda, zoning mínimo, recursos, caja y capacidad de trabajo.
- Reservar o consumir recursos según decisión registrada.
- Avanzar trabajo de forma determinista.
- Implementar finalización y `BuildingCompleted`.
- Implementar cancelación con política de reembolso decidida y probada.
- Proyectar progreso y requisito faltante.
- Persistir obras parciales.

**Aceptación:** no hay doble gasto ni edificio sin coste; cargar una obra parcial conserva exactamente su progreso.

## WP2.5 — Capacidad de trabajo mínima

**Resultado:** la construcción requiere capacidad limitada y crea una decisión de asignación, sin life simulation.

**Tareas:**

- Decidir si Gate 2 usa crews agregadas o workers individuales simples.
- Modelar disponibilidad, asignación y tasa de trabajo.
- Implementar asignación/desasignación mediante comando.
- Evitar asignación simultánea incompatible.
- Mostrar capacidad usada y libre.
- Testear avance, reasignación y restauración de save.

**Aceptación:** la capacidad limita obras en paralelo y su modelo no introduce empleo/salarios avanzados.

## WP2.6 — Tenants, ocupación y renta

**Resultado:** edificios compatibles reciben tenants finitos y generan rentas periódicas.

**Tareas:**

- Definir dos o tres perfiles de tenant propios y data-driven.
- Definir compatibilidad con tipo/capacidad del edificio.
- Crear pool de demanda limitado por seed/escenario.
- Implementar `AssignTenant` o matching mínimo decidido.
- Modelar contrato simplificado, renta y vencimiento.
- Liquidar renta automáticamente; nunca exigir clic de cobro.
- Modelar satisfacción mínima y salida determinista.
- Implementar vacancy cuando no existe demanda compatible.
- Proyectar ocupación, renta próxima y razón de incompatibilidad.
- Testear ingreso, salida, incompatibilidad, ausencia de demanda y save/load.

**Aceptación:** los tenants no son infinitos y la renta se registra en el libro económico.

## WP2.7 — Upgrade

**Resultado:** reinvertir mejora un activo mediante un proceso con coste y tiempo.

**Tareas:**

- Definir un upgrade por edificio relevante.
- Implementar comando, requisitos, reserva/consumo y progreso.
- Evitar upgrades incompatibles o simultáneos.
- Aplicar stats finales mediante datos.
- Mostrar requisito faltante y efecto esperado.
- Persistir progreso.
- Testear inicio, rechazo, finalización y restauración.

**Aceptación:** el upgrade añade una elección económica y no es un botón gratuito o cosmético.

## WP2.8 — IA rival mínima

**Resultado:** una organización rival compite por oportunidades bajo las mismas reglas económicas.

**Tareas:**

- Crear organización rival independiente de su controlador.
- Definir observación limitada a información pública del prototipo.
- Enumerar acciones candidatas: comprar, producir, construir, ocupar, reservar liquidez.
- Implementar utility scores deterministas y explicables.
- Enviar comandos por el mismo dispatcher que el humano.
- Registrar memoria mínima de fallos, cooldown y coste percibido.
- Impedir dinero, recursos o información privilegiada no declarados.
- Añadir escenarios de expansión, falta de caja y recuperación tras fallo.
- Instrumentar acción elegida, alternativas y motivo.

**Aceptación:** la IA completa partes del bucle, puede fallar, aprende a no repetir inmediatamente una acción inválida y no muta estado directamente.

## WP2.9 — Riesgo criminal y policía mínimos

**Resultado:** una acción ilegal opcional ofrece beneficio/riesgo y una respuesta policial legible.

**Tareas:**

- Elegir una acción ilegal original y limitada, evitando contenido distintivo copiado.
- Definir coste, duración, objetivo y resultados posibles.
- Usar PRNG de dominio con consumo estable/documentado.
- Modelar `heat` por organización o actor pertinente.
- Implementar detección y consecuencia mínima.
- Hacer que heat alto aumente presión/coste dentro de límites data-driven.
- Añadir una opción legal comparable para que crimen no sea obligatorio.
- Mostrar riesgo estimado sin revelar información oculta exacta si no corresponde.
- Testear detección/no detección, heat, consecuencia y save/load.

**Aceptación:** una acción legal no genera heat; la acción ilegal no garantiza beneficio y la policía no existe sólo como animación.

## WP2.10 — Una ordenanza política

**Resultado:** una decisión municipal modifica una regla económica del núcleo y obliga a adaptarse.

**Tareas:**

- Elegir una ordenanza ficticia con trade-off, por ejemplo modificador de coste o renta, sin política partidista real.
- Definir estado propuesta/aprobada/vigente/expirada.
- Definir efectos como modifiers consumidos por el sistema afectado.
- Crear concejales/predisposiciones mínimas o resolución equivalente decidida.
- Implementar una acción limitada de lobby/influencia sin éxito garantizado.
- Aplicar y retirar modifiers en ticks definidos.
- Mostrar efecto previsto, vigencia y causa.
- Testear aprobación, rechazo, límites de influencia, aplicación, expiración y save/load.

**Aceptación:** el sistema económico lee la policy; la UI no altera precios directamente y la derogación/expiración retira el efecto.

## WP2.11 — UX del bucle

**Estado 2026-10-21:** candidato funcional integrado. La comprobación final depende de que un
playtester complete el bucle sin ayuda durante WP2.13.

**Resultado:** el jugador entiende qué puede hacer, por qué una acción falla y qué cambió.

**Tareas:**

- HUD de caja, recursos, velocidad y alertas.
- Panel de parcela/edificio con owner, estado y acciones contextuales.
- Cola de obra y feedback temporal.
- Panel simple de tenants/renta.
- Resumen de rival, heat/policía y ordenanza al nivel permitido.
- Tooltips de costes y requisitos antes de confirmar.
- Códigos de rechazo traducidos a mensajes útiles.
- Onboarding corto del core loop, sin campaña extensa.
- Navegación por teclado y mínimos de accesibilidad para controles críticos.

**Aceptación:** un playtester puede completar el bucle sin instrucciones verbales del desarrollador y explicar al menos dos decisiones tomadas.

### Prioridad de presentación antes del spike artístico

Antes de iniciar WP2.14, la implementación de WP2.11 debe dejar de ser una vista técnica: el
mapa debe ocupar el área principal útil, el HUD debe tener jerarquía visual, la parcela o el
edificio seleccionado debe exponer contexto y acciones, y los estados de ownership, obra,
selección y riesgo deben poder distinguirse sin leer IDs internos. Esta etapa no aprueba arte
final ni fija la dirección visual; prepara una pantalla representativa sobre la que el spike
pueda medir legibilidad y estilo.

## WP2.12 — Guardado integral y compatibilidad

**Resultado:** todos los sistemas del prototipo sobreviven a save/load.

**Tareas:**

- Extender schema por sistema e incrementar versión cuando corresponda.
- Crear migración desde fixture Gate 1.
- Persistir economía, obras, producción, tenants, IA/memoria, heat, policía y policy.
- Añadir autosave rotativo sólo si no compromete el gate.
- Añadir tests de roundtrip en puntos críticos de cada sistema.
- Añadir test de continuación determinista después de load.
- Medir tamaño y duración del snapshot completo.

**Aceptación:** cargar no duplica liquidaciones, rentas, acciones IA ni eventos ya procesados.

## WP2.13 — Balance, playtest y cierre

**Estado 2026-10-23:** cierre cualitativo aceptado por confirmación manual `OK`; la duración,
seeds y métricas cuantitativas de esa sesión no quedaron registradas y se mantienen como deuda de
medición para el balance financiero posterior.

**Resultado:** evidencia de que existe un juego prometedor, no sólo sistemas conectados.

**Tareas:**

- Crear 5-10 seeds de referencia con situaciones distintas.
- Ejecutar simulaciones headless para detectar bloqueos, inflación y estrategia dominante obvia.
- Instrumentar las métricas de producto sin backend obligatorio.
- Realizar playtests internos de 30-60 minutos.
- Clasificar problemas como comprensión, balance, ritmo, repetición o bug.
- Ajustar datos, no hardcodear excepciones por seed.
- Ejecutar benchmark y soak de regresión.
- Revisar IP de nombres, textos, interfaz y assets.
- Actualizar gaps, riesgos, estado y decisiones.
- Emitir acta de Gate 2.

## WP2.14 — Visual Direction Spike y preparación de producción artística

**Estado 2026-10-23:** `DONE — approved baseline`. El kit tiene tres direcciones comparables,
renders reproducibles, métricas, provenance, recomendación y Art Lab. WP3.13 puede comenzar
sin rediseñar cámara, formato ni gobernanza.

**Resultado:** evidencia reproducible para decidir la dirección visual y el
pipeline del Vertical Slice, sin producir arte final ni convertir fuentes
binarias de terceros en assets del repositorio.

**Precondición:** WP2.11 debe contar con una base de presentación jugable y legible. No se
comparan direcciones artísticas sobre HTML sin jerarquía visual ni sobre un canvas técnico que
no represente la composición final del juego.

**Tareas:**

- Preparar dos o tres direcciones originales sobre el mismo kit funcional
  mínimo: carretera/parcela, residencial, industrial, trabajador, civil,
  vehículo/prop, construcción/deterioro, humo, HUD e iconos.
- Usar sólo fuentes originales, generadas con provenance o CC0 verificadas;
  conservar staging, hashes, licencia, autor y revisión de similitud.
- Validar cámara ortográfica, footprint 2:1, escala, lighting rig, master
  resolution, estados de edificio, anchors y depth sorting con Blender 5.2.2.
- Ejecutar el recorrido end-to-end: fuente editable -> render transparente ->
  trim -> atlas/metadata -> Phaser/Art Lab -> escena densa y regresión visual.
- Medir legibilidad a 50/75/100/150/200 %, memoria, draw calls, descarga y
  frame time; revisar color vision y contraste de overlays.
- Comparar las direcciones según los pesos de `docs/art/VISUAL-DIRECTION-SPIKE.md`.
- Cerrar mediante ADR o decisión equivalente los parámetros que tengan efecto
  duradero; registrar explícitamente cualquier valor que siga abierto.

**Aceptación:** existe un informe reproducible con renders, metadata, métricas,
provenance y recomendación. Ningún asset de referencia protegida entra en el
pipeline. El resultado puede aprobar una baseline de producción, requerir
rework o bloquear sólo la producción artística de Fase 3.

## WP2.15 — Agents, damage & incidents spike

**Decisión:** D-061. **Estado:** implementado; cierre técnico validado el 2026-10-22. El Gate
queda en `CONDITIONAL GO` únicamente por la condición visual de WP2.14.

**Resultado:** probar que una persona realiza una acción física, el mundo reacciona y la cadena
produce consecuencias espaciales y económicas sin ampliar el juego a life simulation.

**Tareas:**

- Definir schemas data-driven para especialidad operativa, salud, estado, tarea e incidentes.
- Decidir la relación mínima entre el `Agent` móvil y `Person` sin equiparar actor, organización
  y jugador ni construir el resolver completo de roles futuros.
- Sustituir la capacidad numérica del flujo representativo por una cuadrilla con un supervisor y
  varios trabajadores individuales; conservar órdenes grupales para limitar micromanagement.
- Hacer que la construcción requiera asignación, desplazamiento y trabajo de la cuadrilla.
- Añadir un técnico de mantenimiento individual que repare y responda a fuego.
- Añadir un operativo hostil original capaz de atacar a una persona o sabotear un edificio rival
  mediante actor, objetivo y comando explícitos.
- Separar `condition` de `structuralIntegrity` y definir estados normal, dañado, `burning`,
  colapsado/ruina.
- Iniciar fuego por deterioro o sabotaje, progresar intensidad mediante orden estable y permitir
  extinción/reparación.
- Aplicar al colapso o explosión daño determinista a edificios adyacentes y agentes expuestos.
- Modelar `healthy/injured/dead` mínimo y conectar víctimas/incidente con coste y `heat`.
- Persistir agentes, tareas, salud, incidentes, integridad y referencias causales; definir
  migración/compatibilidad conforme a la política de snapshots.
- Añadir golden scenarios con al menos dos seeds, roundtrip durante tarea e incendio, rechazo
  atómico, continuación determinista y benchmark contra Gate 1.
- Añadir representación visible/selectable mínima y feedback de causa, objetivo, trayectoria,
  fuego, daño, herida y muerte; coordinar el kit con WP2.14.
- Revisar nombres, siluetas, ratios, textos y reglas por IP; no reutilizar contenido distintivo de
  *Constructor* o *Street Wars/Mob Rule*.

**Aceptación:** un escenario headless y uno visible recorren
`orden -> movimiento -> trabajo/ataque -> daño o reparación -> incidente -> respuesta -> efecto económico`;
save/load en mitad del flujo produce el mismo estado final que la ejecución continua y el daño
adyacente no depende del orden de iteración.

**Fuera del spike:** reproducción, familia, envejecimiento, hospital jugable, ambulancias,
morgue, múltiples clases criminales, arsenal, evidencia/investigación avanzada, perspectiva
criminal jugable y life simulation.

## Secuencia recomendada

1. Mundo y libro económico: WP2.1-WP2.2.
2. Primer mini-loop: WP2.3-WP2.6.
3. Reinversión: WP2.7.
4. Competencia y riesgo: WP2.8-WP2.9.
5. Adaptación regulatoria: WP2.10.
6. UX y persistencia transversal: WP2.11-WP2.12 desde el primer slice, no al final. Cerrar la
   base de presentación y legibilidad de WP2.11 antes de evaluar arte.
7. Ejecutar WP2.14 cuando el primer flujo vertical, la base de presentación de WP2.11 y el Art
   Lab técnico puedan consumir renders; no esperar a la producción artística.
8. Implementar WP2.15 sobre contratos revisados y coordinar sus estados visuales con WP2.14.
9. Balance y gate: repetir WP2.13 sobre el núcleo resultante, incorporando la evidencia de ambos
   spikes.

## Condiciones de aprobación

- El bucle completo se juega durante 30-60 minutos sin intervención técnica.
- Existen al menos varias decisiones con trade-offs, no sólo espera y clics repetidos.
- Rival, crimen/policía y ordenanza afectan el núcleo.
- El juego conserva determinismo bajo sus contratos y cumple budgets de Gate 1 o justifica su revisión.
- Save/load integral y suite determinista pasan.
- WP2.14 deja trazabilidad de provenance y una decisión/rework explícitos sobre
  la dirección visual; la ausencia de aprobación bloquea arte de Fase 3, no la
  evaluación del bucle de producto.
- WP2.15 demuestra agentes físicos, salud, mantenimiento, una acción hostil, fuego, daño espacial
  y persistencia determinista dentro de los budgets aceptados.
- No se ha ampliado el alcance a sistemas del vertical slice.

## Fuera de alcance

- Mercado sofisticado, deuda bancaria, seguros y contabilidad completa.
- Fiscalidad detallada, licencias y zonificación rica.
- Presupuesto municipal, empleo, hogares avanzados y elecciones.
- Perspectiva jugable política/criminal/ciudadana.
- Life simulation, reproducción/familias, hospital jugable, servicios de emergencia completos y
  combate profundo.
- Cloud/backend, multiplayer, LLM y arte final; WP2.14 sólo valida el camino
  de producción y un kit mínimo.
