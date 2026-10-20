# Fase 2 — Gate 2: viabilidad de producto

## Objetivo de gate

Validar que el núcleo produce decisiones interesantes durante una sesión coherente de 30-60 minutos:

`comprar -> producir -> construir -> ocupar -> cobrar -> competir -> asumir riesgo -> adaptarse a una ordenanza -> reinvertir`

La experiencia continúa centrada en Landlord/Entrepreneur. Los costes económicos existen sólo con el detalle necesario para probar el bucle.

Duración orientativa existente: 10-14 semanas; 180-280 jornadas-persona.

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
- Implementar producción por ciclos de tick.
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

## Secuencia recomendada

1. Mundo y libro económico: WP2.1-WP2.2.
2. Primer mini-loop: WP2.3-WP2.6.
3. Reinversión: WP2.7.
4. Competencia y riesgo: WP2.8-WP2.9.
5. Adaptación regulatoria: WP2.10.
6. UX y persistencia transversal: WP2.11-WP2.12 desde el primer slice, no al final.
7. Balance y gate: WP2.13.

## Condiciones de aprobación

- El bucle completo se juega durante 30-60 minutos sin intervención técnica.
- Existen al menos varias decisiones con trade-offs, no sólo espera y clics repetidos.
- Rival, crimen/policía y ordenanza afectan el núcleo.
- El juego conserva determinismo bajo sus contratos y cumple budgets de Gate 1 o justifica su revisión.
- Save/load integral y suite determinista pasan.
- No se ha ampliado el alcance a sistemas del vertical slice.

## Fuera de alcance

- Mercado sofisticado, deuda bancaria, seguros y contabilidad completa.
- Fiscalidad detallada, licencias y zonificación rica.
- Presupuesto municipal, empleo, hogares avanzados y elecciones.
- Perspectiva jugable política/criminal/ciudadana.
- Cloud/backend, multiplayer, LLM y arte final.
