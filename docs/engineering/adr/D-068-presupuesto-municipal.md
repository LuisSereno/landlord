# D-068 — Presupuesto municipal con caja real, prioridad de gasto y niveles de servicio

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.5 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide modelar un Government independiente con
ingresos, gastos y reservas, enrutar impuestos y tasas al beneficiario correcto, definir un ciclo
presupuestario con categorías prioritarias, evitar dinero municipal implícito o infinito, mostrar
el presupuesto agregado y el impacto de las decisiones, y probar recaudación, déficit, recortes y
persistencia. La aceptación exige que las políticas fiscales tengan contraparte presupuestaria y
trade-offs observables.

El estado anterior ya enrutaba los dos impuestos al municipio: propiedad (120 pb) y transferencia
(150 pb) se acreditan en `org_00000004`. Pero el municipio no tenía gasto, así que su caja crecía
sin contrapartida y era un balance más, no un presupuesto. La política fiscal no tenía ningún coste
de oportunidad visible.

## Decisión

1. **Una sola caja.** Las reservas municipales son el saldo existente de `org_00000004` en
   `phase2.balances`; no se añade un segundo saldo. El estado nuevo `phase2.municipal` guarda el
   libro (ingresos por fuente, gasto y descubierto por categoría, niveles de servicio, meses en
   déficit o superávit), no dinero.
2. **Tres categorías con prioridad declarada.** `administration` (10 fijos al mes), `security`
   (1 por edificio) y `services` (2 por edificio). El orden de pago es
   `administration → security → services`: bajo una caja insuficiente se financia primero lo
   esencial y el recorte cae en lo prescindible.
3. **Ciclo mensual al final del tick.** `municipal` cierra `PRODUCT_SYSTEMS`, después de que los
   impuestos del mes ya hayan entrado. No se reordena ningún sistema existente: el gasto municipal
   nunca compite en el mismo tick con el mantenimiento o la deuda de otro agente.
4. **Sin dinero implícito ni infinito.** El municipio paga con su saldo y sólo hasta donde alcanza;
   lo que no puede pagar se registra como descubierto y no se emite dinero. Un municipio sin caja
   deja de financiar servicios: no hay préstamo automático ni reserva oculta.
5. **Niveles de servicio observables.** Cada categoría publica `serviceLevelPercent = pagado /
   planificado`. Con plan 0 el nivel es 100 (no hay nada que financiar). Un mes con descubierto
   incrementa `deficitMonths`.
6. **Consecuencia en el mundo, no sólo en el libro.** El nivel de `services` multiplica el
   componente `services` de la deseabilidad del mercado de vivienda, y el de `security` resta
   `(100 − nivel) / 2` puntos de `safety`. Son dos componentes introducidos en WP4.3 y usados sólo
   por la colocación y el atractivo de los hogares de mercado, así que el recorte se nota en la
   ocupación sin tocar la evidencia de Gate 2 y Fase 3.
7. **Libro de ingresos por fuente.** `settlePropertyTaxes` y el cobro de la transferencia anotan su
   importe en `revenueThisMonthBySource`; el cierre lo acumula en totales y lo reinicia. El jugador
   ve de dónde sale cada unidad municipal.
8. **Persistencia aditiva.** `phase2.municipal` es opcional en el schema; una partida anterior
   carga con el libro a cero y niveles de servicio al 100 %.

## Alternativas consideradas

- **Mantener el municipio como sumidero sin gasto.** Descartada: es exactamente el "dinero
  municipal infinito" que el WP prohíbe.
- **Dar al municipio una reserva inicial y gastar desde el mes uno con déficit garantizado.**
  Descartada: rompe la aritmética de las pruebas de impuestos de WPs anteriores sin aportar nada;
  el municipio empieza en caja cero y gasta lo que recauda.
- **Permitir descubierto con deuda municipal.** Descartada en este WP: exige un mercado de deuda
  pública y una decisión de impago que pertenecen a un WP propio. Aquí el descubierto no se
  financia: se recorta.
- **Aplicar el recorte también a la respuesta policial o al mantenimiento público.** Descartada por
  ahora: tocaría sistemas con evidencia cerrada y no hay todavía una capa de servicios urbanos
  (WP4.6). El enlace actual usa los componentes nuevos de deseabilidad.
- **Un saldo municipal separado del balance de organizaciones.** Descartada: dos fuentes de verdad
  para el mismo dinero.

## Alcance

Incluido:

- `packages/simulation/src/municipal-budget.ts`: política, planificación, cierre, libro y niveles;
- `phase2.municipal` aditivo con serialización y restauración;
- anotación de ingresos por fuente en el cobro de propiedad y de transferencia;
- sistema `municipal` al final de `PRODUCT_SYSTEMS`;
- efecto de los niveles de servicio en la deseabilidad del mercado de vivienda;
- bloque `municipal` en la proyección y línea de presupuesto en el panel de riesgo y política;
- cinco pruebas en `municipal-budget.test.ts`: recaudación y gasto financiado, recorte por
  prioridad con descubierto, enrutado de ambas fuentes, efecto del recorte en la deseabilidad y
  persistencia con migración.

No incluido:

- deuda pública, bonos municipales o rescate;
- presupuesto plurianual, partidas de capital o inversión pública;
- servicios urbanos reales (transporte, limpieza, equipamientos) y su capa de cobertura: WP4.6;
- tasas por licencia o permiso (hoy los permisos no tienen precio);
- decisión del jugador sobre el presupuesto municipal: se muestra, no se edita.

## Consecuencias

### Positivas

- El municipio deja de ser un sumidero: cada unidad que recauda se gasta o se queda como reserva
  visible, y una política fiscal barata tiene como contrapartida menos servicios.
- El recorte es legible: primero cae `services`, luego `security`, y el nivel publicado explica por
  qué baja la deseabilidad y la ocupación.
- El jugador ve el desglose de ingresos por fuente y el gasto planificado por categoría.
- La evidencia de Gate 2 y Fase 3 se conserva fuera de los cierres mensuales: sólo cambian la caja
  municipal y sus propias transacciones.

### Costes

- El gasto municipal introduce una salida de caja en cada cierre mensual; los casos de conservación
  que cruzan un mes cambian en la caja municipal y en el recuento de transacciones. Está verificado
  y acotado en el acta.
- El coste por edificio acopla el gasto al tamaño del distrito: un distrito con muchos edificios y
  pocos propietarios puede entrar en déficit estructural y recortar servicios de forma permanente.
  Es intencionado, pero exige balance.
- La prueba de impuestos de WP3.5 cambió de aserción sobre la caja municipal a aserción sobre el
  libro; su intención (el impuesto se cobra y se enruta) se conserva.
- Los niveles de servicio son un grado de libertad más de balance sin herramienta de barrido.

## Evidencia requerida

- `packages/simulation/src/municipal-budget.ts` y `municipal-budget.test.ts`.
- `packages/shared/src/domain.ts`: `MunicipalBudgetState` y `municipalBudgetStateSchema`.
- `packages/simulation/src/snapshot.ts` y `packages/shared/src/snapshot.ts`.
- `packages/simulation/src/systems.ts`: anotación de propiedad y sistema `municipal`.
- `packages/simulation/src/commands.ts`: anotación de la transferencia.
- `packages/simulation/src/housing-market.ts`: niveles de servicio en `safety` y `services`.
- `packages/simulation/src/projection.ts` y `packages/shared/src/projection.ts`.
- Acta `docs/execution/phase-4/wp4-5-municipal-budget-2026-10-23.md`.
