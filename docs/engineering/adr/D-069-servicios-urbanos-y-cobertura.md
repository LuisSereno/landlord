# D-069 — Servicios urbanos con cobertura radial y tasa por unidad ocupada

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.6 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide pocos servicios con feedback económico
claro, cobertura, capacidad y calidad con coste municipal, conexión con atractivo y base fiscal,
accesibilidad a un nivel compatible con el rendimiento, overlays y explicación causal, y pruebas de
capacidad saturada, expansión, recorte y desigualdad territorial. La aceptación exige que invertir o
recortar servicios altere la ciudad y la base fiscal, no que sean buffs decorativos.

Después de WP4.5 el municipio gastaba en tres categorías abstractas (`administration`, `security`,
`services`) cuyo único efecto era un multiplicador plano sobre la deseabilidad. No había geografía,
capacidad ni una vía por la que la población sostuviera el presupuesto.

## Decisión

1. **Tres servicios con nombre y consecuencia propia.** `transport`, `security` y `cleaning`, cada
   uno con coste por edificio y radio base (`2/26`, `1/30`, `2/20`). Sustituyen la categoría difusa
   `services`; `administration` se mantiene como gasto fijo.
2. **Cobertura radial desde el centro del distrito**, derivada de las parcelas generadas, sin
   edificios de servicio ni entidades nuevas. `coverage = calidad × proximidad`, con
   `proximidad = 1 − distancia / radio`. Es O(parcelas) por consulta y se calcula una vez por
   evaluación.
3. **La capacidad se satura al crecer.** El radio efectivo es
   `base × sqrt(referencia / max(referencia, edificios))` con suelo por servicio. Con el mismo
   presupuesto, más edificios significa menos radio: la expansión diluye el servicio y el borde
   queda peor cubierto. La desigualdad territorial es una consecuencia, no un caso especial.
4. **Cada servicio alimenta un componente distinto de la deseabilidad.** `transport` es la
   accesibilidad, `security` resta `(100 − cobertura) / 2` a la seguridad y `cleaning` resta
   `(100 − cobertura) / 4` a la calidad del parque. Un recorte se nota en la ocupación, no en un
   número de interfaz.
5. **Tasa municipal por unidad ocupada** de 3 u./mes, acreditada al municipio en el cierre y anotada
   en el libro como `serviceFee`. Es el canal por el que la población sostiene el presupuesto: más
   ocupación, más ingresos, mejor servicio.
6. **Prioridad de pago declarada.** `administration → security → transport → cleaning`; la limpieza
   es lo primero que se recorta y el borde es lo primero que lo nota.
7. **Explicación causal en la interfaz.** El panel publica calidad, radio, edificios cubiertos y
   cobertura media por servicio; el jugador puede relacionar un recorte con la caída de ocupación.
8. **Persistencia.** No hay estado nuevo: la cobertura es derivada y el dinero sigue en una sola
   caja. Sólo cambian las claves de categoría del libro municipal, que el schema acepta como
   `record` y el código trata con valor por defecto.

## Alternativas consideradas

- **Edificios de servicio físicos (comisarías, paradas, camiones).** Descartada: exige entidades,
  colocación y estado persistido nuevos, y el WP pide explícitamente un modelo de cobertura
  adecuado al rendimiento. La red abstracta da la misma señal con una fracción del coste.
- **Cobertura uniforme sin geografía.** Descartada: hace imposible la prueba de desigualdad
  territorial y convierte el servicio en un multiplicador global.
- **Subir el precio del suelo con la cobertura para mover la base fiscal directamente.**
  Descartada: el precio de parcela alimenta compras e impuestos con aserciones exactas en Gate 2 y
  Fase 3; cambiarlo reescribiría la evidencia. La base fiscal se mueve por ocupación y tasa.
- **Mantener las tres categorías de WP4.5 y sólo renombrarlas en la interfaz.** Descartada: sin
  consecuencias distintas por servicio no hay decisión de prioridad que tomar.
- **Un overlay de mapa en Phaser en este WP.** Diferido a WP4.15: el dato de cobertura ya está en
  la proyección y el overlay es una capa de representación; construirlo ahora sin dirección visual
  aprobada duplicaría trabajo artístico.

## Alcance

Incluido:

- `packages/simulation/src/urban-services.ts`: política, índice de cobertura, indicadores, unidades
  ocupadas y tasa;
- gasto municipal por servicio y acreditación de la tasa en `municipal-budget.ts`;
- efectos de cobertura en `safety`, `accessibility` y `quality` del mercado de vivienda;
- bloque `urbanServices` en la proyección y línea de servicios en el panel;
- cinco pruebas en `urban-services.test.ts`.

No incluido:

- overlay de mapa y explicación visual por celda (WP4.15);
- edificios, vehículos o personal de servicio;
- calidad diferenciada por barrio más allá de la distancia al centro;
- transporte entre distritos, commuting real o congestión;
- edición del reparto presupuestario por el jugador.

## Consecuencias

### Positivas

- El recorte deja de ser un número: baja la cobertura, baja la deseabilidad y baja la ocupación, en
  ese orden y de forma explicable.
- La expansión tiene coste de servicio: crecer diluye el radio y el borde queda peor atendido, lo
  que crea una decisión real de dónde construir.
- La población sostiene el presupuesto por la tasa, así que la ciudad y su base fiscal crecen
  juntas.

### Costes

- La cobertura se recalcula en cada evaluación del mercado de vivienda (mensual) y por consulta
  externa; es O(parcelas) y no toca el tick diario.
- El centro del distrito se deriva de las parcelas generadas: un perfil con parcelas muy
  excéntricas desplaza el centro de servicio y puede dejar medio distrito sin cobertura.
- Los radios y costes son grados de libertad de balance sin herramienta de barrido.
- El overlay de mapa queda pendiente y el WP se cierra sin él, con el dato expuesto en la
  proyección y la explicación textual en el panel; se registra como deuda para WP4.15.

## Evidencia requerida

- `packages/simulation/src/urban-services.ts` y `urban-services.test.ts`.
- `packages/simulation/src/municipal-budget.ts`: cuatro categorías y tasa por ocupación.
- `packages/simulation/src/housing-market.ts`: cobertura en `quality`, `accessibility` y `safety`.
- `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts`: `urbanServices`.
- `apps/web/src/App.tsx`: línea de servicios.
- Acta `docs/execution/phase-4/wp4-6-urban-services-2026-10-23.md`.
