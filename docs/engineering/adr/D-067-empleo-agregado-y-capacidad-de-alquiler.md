# D-067 — Mercado laboral agregado, salario y capacidad de alquiler

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.4 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide modelar negocios que demandan puestos y
hogares que ofrecen trabajo de forma agregada o individual mínima, definir salario/ingreso y su
conexión con la capacidad de alquiler, conectar cierres y aperturas con la demanda residencial,
evitar simulación individual sin valor jugable, añadir indicadores de empleo, salarios y
accesibilidad, y probar desempleo, escasez laboral y shocks sectoriales. La aceptación exige que el
empleo afecte vivienda, población y rentabilidad **sin crear un simulador laboral completo**.

WP4.3 dejó el empleo como una aproximación dentro del atractivo del segmento: un número fijo de
puestos por planta productiva y un cociente entre industria y hogares, sin salario ni ingreso, y
con un presupuesto de renta constante por segmento.

## Decisión

1. **Mercado laboral agregado, sin asignación individuo-puesto.** `jobs` son los puestos de las
   plantas productivas operativas (`cement_plant`, `brickworks`, `steelworks`), cuatro por edificio;
   `workers` son los hogares contratados. Los talleres no contratan: el artesano o comerciante que
   los ocupa es autónomo. No hay tabla de empleado a puesto; sólo recuentos.
2. **Salario con banda y paso.** El índice salarial parte de 100, se mueve hasta ±3 puntos por mes
   según la tensión observada (`puestos / trabajadores − 1`, con sensibilidad 6) y queda acotado en
   `[90, 120]`. Escasez laboral sube el salario; paro lo baja; sin puestos ni trabajadores no se
   mueve.
3. **Ingreso por segmento y conexión con la renta.** Los hogares combinan empleo y una economía
   informal que cubre el 85 % de la renta cuando no hay puesto; artesanos y comerciantes son
   autónomos y su ingreso sigue el nivel salarial sin contar paro. El resultado es un índice de
   ingresos por segmento acotado en `[60, 130]` que multiplica el presupuesto base de renta:
   `effectiveRentBudget`.
4. **Presupuestos base recalibrados.** Los presupuestos de segmento pasan a 260 / 360 / 380 para que
   la renta más barata (180 con condición plena) siga siendo asequible incluso en el suelo de
   ingresos (90 × 0,85 ≈ 77 %). Sin este margen, un distrito sin industria sería inhabitable y la
   cadena empleo → vivienda no tendría punto de partida.
5. **Quién actualiza su presupuesto.** En cada cierre mensual, `runEmployment` recalcula el
   presupuesto de los hogares que generó el mercado a partir del ingreso vigente y su
   `incomeFactorPercent`. Los hogares autorados conservan el presupuesto de escenario: son fixtures
   de Gate 2 y Fase 3, no población simulada.
6. **Orden en el tick.** `employment` se ejecuta justo antes de `housing`: el nivel de ingresos del
   mes decide qué vivienda es asequible antes de que el mercado de vivienda admita o coloque a
   nadie. El resto del orden de D-060 y D-066 queda intacto.
7. **Cierres y aperturas.** Un edificio productivo que deja de estar operativo pierde sus puestos
   en el siguiente cierre: el paro sube, el salario baja, el ingreso cae, la asequibilidad se corta
   y la vacancia sube. Es la cadena completa de "cierre → demanda residencial" sin una regla
   específica de evento.
8. **Indicadores.** `describeEmployment` expone puestos, puestos por sector (`materials`,
   `commerce`), trabajadores, ocupados, parados, tasa de empleo, índice salarial e índice de
   ingresos por segmento. La proyección los publica y el panel de riesgo y política muestra la
   línea de empleo junto a la del mercado de vivienda.
9. **Persistencia aditiva.** `phase2.employment` (`salaryIndexPercent`, `lastSettlementTick`) y el
   campo `incomeFactorPercent` de cada hogar son opcionales en el schema. Una partida anterior
   carga con salario 100 e ingresos al 100 %.
10. **La evidencia económica no se toca.** Los diez observables de conservación (saldos,
    transacciones, estado y destino de hogares, ruinas, incidentes y bajas) vuelven a ser idénticos
    antes y después. Los digestos canónicos se regeneran porque el estado gana
    `phase2.employment` y `incomeFactorPercent`, no porque cambie una regla económica en las
    carreras medidas.

## Alternativas consideradas

- **Asignación individual de trabajadores a puestos.** Descartada por el propio WP: no aporta una
  decisión nueva al jugador y multiplica el coste del tick y el estado persistido. Los recuentos
  agregados bastan para mover salario, ingreso y asequibilidad.
- **Negociación salarial por sector.** Descartada: obliga a repartir trabajadores entre sectores y
  convierte el WP en un simulador laboral. El sector se conserva como recuento (`jobsBySector`) para
  que un shock sectorial sea legible, no como mercado propio.
- **Que la escasez laboral reduzca la producción de las plantas.** Descartada en este WP: modular
  el output cambiaría todas las trazas de producción existentes (escenarios, ciudad sintética,
  digestos) y merece su propia decisión con medición de balance. Aquí la rentabilidad se mueve por
  ocupación y nivel de renta.
- **Ingreso cero para un hogar sin empleo.** Descartada: dejaría inhabitables los distritos sin
  industria y rompería el arranque del juego; la economía informal del 85 % mantiene viva la cadena
  y deja margen para que el paro se note en la asequibilidad.
- **Actualizar también el presupuesto de los hogares autorados.** Descartada: son fixtures de la
  evidencia de Gate 2 y Fase 3; recalcularlos cambiaría la economía que esas actas certifican.

## Alcance

Incluido:

- `packages/simulation/src/employment.ts`: política, mercado laboral, salario, ingreso por segmento
  y sistema mensual;
- `packages/simulation/src/housing-segments.ts`: segmentos compartidos entre vivienda y empleo;
- presupuesto efectivo de renta en el mercado de vivienda (`effectiveRentBudget`);
- `phase2.employment` e `incomeFactorPercent` aditivos con serialización y restauración;
- indicadores de empleo en la proyección y en el panel de riesgo y política;
- siete pruebas en `employment.test.ts`: recuento agregado, paro y escasez con sus bandas, cierre de
  planta, asequibilidad con y sin empleo, actualización de presupuestos, determinismo,
  guardado/carga y migración.

No incluido:

- asignación individual de personas a puestos, jornada, productividad por trabajador o despido
  nominal;
- negociación salarial por sector o convenios;
- penalización de producción por escasez de mano de obra;
- commuting real, transporte y accesibilidad peatonal (WP4.6): el indicador de accesibilidad del
  mercado de vivienda sigue siendo distancia al centro de actividad;
- presupuesto municipal, subsidios de desempleo pagados por una administración real (WP4.5).

## Consecuencias

### Positivas

- El empleo deja de ser un adorno del atractivo: entra en el presupuesto de renta y por tanto en
  qué vivienda se puede ocupar, cuánta población llega y a qué precio se cierra el mercado.
- Un cierre de planta encadena paro → salario → ingreso → asequibilidad → vacancia sin una regla
  de evento específica.
- El jugador puede leer por qué baja la ocupación: la línea de empleo está junto a la de vivienda.
- La evidencia anterior sigue siendo válida sin editar una sola aserción económica.

### Costes

- El salario es un grado de libertad de balance más: sensibilidad 6, paso máximo 3 y banda
  `[90, 120]` se ajustan a mano y no tienen herramienta de barrido.
- La asimetría autorado/mercado se consolida: los hogares de escenario no siguen el ciclo
  económico. Si el juego quiere una única regla, hay que revisar las fixtures de Gate 2 y Fase 3.
- Sin penalización de producción por escasez, el efecto de un mercado laboral tenso sobre la
  rentabilidad es indirecto (renta y ocupación), no directo sobre el output.

## Evidencia requerida

- `packages/simulation/src/employment.ts` y `employment.test.ts`.
- `packages/simulation/src/housing-segments.ts` y su uso en `housing-market.ts`.
- `packages/shared/src/domain.ts`: `EmploymentState`, `employmentStateSchema` e
  `incomeFactorPercent`.
- `packages/simulation/src/snapshot.ts` y `packages/shared/src/snapshot.ts`.
- `packages/simulation/src/systems.ts`: `employment` justo antes de `housing` en `PRODUCT_SYSTEMS`.
- `packages/simulation/src/projection.ts` y `packages/shared/src/projection.ts`.
- `apps/web/src/App.tsx`: línea de empleo.
- Acta `docs/execution/phase-4/wp4-4-employment-2026-10-23.md`.
