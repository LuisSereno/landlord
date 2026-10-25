# D-078 — Delegación con los mismos comandos y bandeja de excepciones

Estado: aceptada el 2026-10-25 para WP4.13. No introduce una segunda perspectiva jugable ni un
framework de ControlContext: `ControlContext` no tiene todavía ningún consumidor real (la UI sigue
siendo de una sola organización y los permisos ya se resuelven por `controlGrants`), así que se
documenta como evolución y no se construye.

## Contexto

La cartera crece y las tareas rutinarias —colocar inquilinos, reparar edificios deteriorados, cubrir
un descubierto de caja— crecen con ella. WP4.13 exige medir esa rutina, añadir gestores con umbrales,
enviar las excepciones a una bandeja priorizada y garantizar que la automatización usa los mismos
comandos y permisos. El disparador de rendimiento de D-065 sigue abierto: `buildStock` es el hotspot
medido, pero LOD no se introduce aquí sin agotar la optimización exacta.

## Decisiones

1. **La delegación es una política persistida, no un modo oculto.** `phase2.automation` guarda
   `property: manual | fill_vacancies`, `finance: manual | cover_shortfall`,
   `maintenanceRepairThreshold: 0–100 | null` y `financeCashFloor`. El valor por defecto es manual y
   sin umbral, de modo que una partida anterior restaura sin cambios de conducta y los escenarios
   dorados no se mueven por esta vía. El comando `SetAutomationPolicy` modifica sólo los campos
   presentes, igual que el resto de comandos parciales de la UI.

2. **Los gestores son sistemas diarios que despachan comandos reales.** `runAutomation` corre en
   `PRODUCT_SYSTEMS` justo después de `rival`, sólo en fronteras de día, y sólo para
   `PLAYER_ORGANIZATION_ID`. Cada acción se emite con `dispatchProductCommand`, la persona del jugador
   y la organización del jugador: pasan por las mismas validaciones de actor, propiedad, capacidad,
   presupuesto, LTV, deuda máxima, mora, caja y cuadrilla que un clic. Un rechazo no muta el estado y
   el gestor continúa con la siguiente tarea; nunca hay un atajo de reglas.

3. **Tres gestores acotados por día.**
   - Propiedad: `fill_vacancies` coloca hasta tres inquilinos disponibles por día en unidades propias
     compatibles con `AssignTenant` (tipo preferido y presupuesto incluidos).
   - Finanzas: `cover_shortfall` sólo actúa si la caja está bajo el suelo y no hay deuda viva; pide un
     préstamo con una parcela libre como garantía (importe del descubierto, con el mínimo como
     segundo intento) y acepta la oferta resultante con `AcceptLoanOffer`.
   - Mantenimiento: un umbral no nulo abre como máximo una reparación diaria si la caja cubre
     `REPAIR_COST` sin perforar el suelo; usa `RepairBuilding` y asigna una cuadrilla libre con
     `AssignCrewToWorkOrder`. Sin cuadrilla la obra queda en cola, exactamente como la dejaría la
     jugadora; el gestor no inventa progreso.

4. **La bandeja priorizada es el canal `alerts` que ya existía.** Se extiende con edificios sin
   seguro cuyo riesgo de deterioro supera el umbral, y `automation.routineTaskCount` cuenta la rutina
   total antes de delegar (con desglose por tipo en el informe interno, también antes del tope de 20
   entradas). La UI muestra las políticas, activa/desactiva cada gestor y sigue usando la lista de
   excepciones existente: no se crean dos bandejas.

5. **Medición de la carga rutinaria.** Campañas sintéticas de 50, 200 y 800 parcelas maduradas seis
   meses, con un inquilino disponible por plaza vacía del jugador: la rutina manual es de 6, 28 y 121
   interacciones respectivamente; con el gestor de propiedad activo, las interacciones de la jugadora
   son **0** (sólo la política) y el gestor resuelve 4, 21 y 17 plazas en diez días bajo su tope de
   tres asignaciones diarias. La cartera duplica y triplica la rutina; las interacciones del jugador
   no. La cola restante es la propiedad del diseño: el gestor trabaja con un ritmo acotado, no
   instantáneo.

6. **`ControlContext` sigue sin construirse.** No hay una segunda perspectiva jugable ni una acción
   del jugador que necesite resolver capabilities por cargo; añadirlo ahora sería una abstracción sin
   consumidor. La autorización actual (`controlGrants` persona→organización) es la que usan los
   gestores y seguirá siendo el punto de extensión.

7. **Persistencia y estado canónico.** `phase2.automation` es opcional en el snapshot y se deriva a
   manual en partidas anteriores. `canonicalizeState` incluye el bloque; se regeneran los diez
   digestos y se verifica que, eliminando `automation`, recuperan los valores de WP4.12-R: el delta es
   superficie y ningún escenario dorado activa la delegación.

## Consecuencias

- Duplicar cartera ya no duplica clics de rutina: la jugadora configura umbrales y revisa excepciones.
- La automatización no puede saltarse ninguna regla porque su única puerta es el dispatcher; los
  tests cubren presupuesto insuficiente, falta de garantía, deuda viva, caja insuficiente y
  organización ajena.
- El coste del sistema es O(edificios propiedad del jugador) una vez al día y sólo con políticas
  activas; no toca el cierre mensual.
- La deuda de rendimiento de D-065 (`buildStock`, O(edificios²)) sigue abierta y pertenece a la
  evaluación de LOD, no a este WP.
