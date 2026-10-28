# D-091 — Mercados híbridos: vivienda y empleo por distrito, dinero y política de ciudad

Estado: ratificada el 2026-10-28 por el responsable para V.d.2, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. Vivienda y empleo por distrito; banca, política y macroeventos de ciudad.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

## Contexto

Con un distrito, la pregunta "¿de quién es el mercado?" no existe. Con nueve, es la primera decisión
estructural, y las dos respuestas ingenuas están mal:

- **Nueve mercados totalmente independientes** convierten la ciudad en nueve partidas sueltas: un
  macroevento no llega, la banca no distingue riesgo territorial y el municipio no puede ponderar
  población. Rompe D-068, D-074 y D-077.
- **Un mercado único promedio** borra la diferencia entre el centro cívico y Patios del Este, que es
  exactamente lo que V.d quiere hacer jugable.

El plan elige la frontera híbrida (§3.6). Aquí se fija por qué cada línea cae de un lado.

## Decisión de frontera

| Concepto | Unidad | Motivo |
| --- | --- | --- |
| Vacancia, demanda, índice de renta, movilidad | **distrito** | La oferta y la demanda de vivienda son locales: nadie se muda de la periferia industrial al centro cívico porque haya un hueco. |
| Puestos de trabajo | **distrito** | Los empleos los producen edificios concretos en un sitio concreto. |
| Salario base | **ciudad** | Un salario por distrito invitaría a arbitraje artificial y a nueve índices correlacionados sin mecanismo propio. |
| Banca, préstamos, garantías | **ciudad** | La institución financiera es una (`BANK_ORGANIZATION_ID`); el riesgo se mira por cartera, no por barrio. |
| Municipio, presupuesto, política, elecciones | **ciudad** | D-068 y D-074: una sola tesorería y un solo orden de gasto. |
| Macroeventos | **ciudad** | D-077 los define como shocks agregados; replicarlos por distrito convertiría nueve draws en nueve economías. |
| Inventarios de materiales | **organización, global** | Sin logística de almacenes en esta fase. |
| Búsquedas de hogar | **distrito destino** | Cada buscador tiene `marketDistrictId`. |

## Decisiones de mecanismo

### 1. Fallback de índice en tres niveles, con muestra mínima declarada

`askingRentFor` ([packages/simulation/src/housing-market.ts:149](packages/simulation/src/housing-market.ts))
hoy usa `rentIndexPercentByBuildingType` global. Pasa a:

1. índice del distrito, si hay **≥ 3 edificios comparables**;
2. índice de ciudad;
3. 100.

El umbral 3 no es cosmética estadística: con un edificio el "índice" es ese edificio, y el bucle
renta→vacancia→renta se retroalimenta de su propio ruido. D-066 ya acotó el índice para impedir que
eso se disparara; la cota de distrito se queda sin usar si el índice no significa nada.

El fallback debe ser **visible en la proyección** (índice usado y nivel de fallback), porque un
distrito nuevo siempre cae en el nivel 2 y el jugador tiene derecho a saber que ahí todavía no hay
mercado propio.

### 2. Sin mudanza inter-distrito automática en V.d

Un hogar desplazado en Barrio del Umbral busca en Barrio del Umbral. Moverlo entre distritos sin
commuting (excluido por §1 del plan) inventaría un coste de mudanza artificial o negaría uno real, y
ambos contaminan la comparación entre distritos. La movilidad entre distritos entra cuando el jugador
la provoque comprando y promocionando, no cuando el motor la simule.

### 3. La política municipal pondera población efectiva de toda la ciudad

Hoy el ánimo se calcula desde un distrito. Con nueve, un distrito residencial grande puede dominar el
resultado electoral por puro peso; eso es correcto **si** refleja población. Lo que no es admisible
es que el ánimo se calcule sin ponderar: cuatro hogares en un bolsillo industrial decidirían una
ordenanza municipal.

D-076 fijó que el censo electoral sólo admite residentes efectivos. La ponderación respeta esa
regla: pesos sobre población efectiva, no sobre edificios ni parcelas.

### 4. Presión territorial de facciones por bloques y frentes compartidos

D-073 modeló el roce territorial por distancia Manhattan de 1–2 celdas entre anchors de parcela, y
D-085 tuvo que rectificar la justificación documentada de esa regla (la paridad de retícula era falsa)
sin cambiar el umbral. Con parcelas multi-cell, la distancia entre anchors deja de ser una
aproximación razonable: dos parcelas grandes pueden tener anchors a 10 celdas y frentes contiguos.

La regla nueva usa **bloques y frentes compartidos**, que es lo que la distancia intentaba aproximar.
Es un cambio de semántica medido, no un ajuste de umbral.

### 5. La automatización no teletransporta

El gestor de propiedad (D-078) que necesite una cuadrilla en otro distrito **crea una excepción en la
bandeja** en vez de mover agentes. Dos motivos:

- la delegación existe para no microgestionar, pero mover recursos entre distritos es una decisión
  estratégica con coste de tiempo; el gestor debe pedirla, no tomarla;
- una excepción visible enseña el sistema de traslados; un teletransporte invisible lo borra del
  juego.

## Consecuencias

- `HousingMarketState` gana `byDistrictId`; `EmploymentState` mantiene salario de ciudad y gana
  puestos por distrito.
- `Tenant` pasa a llevar `marketDistrictId`.
- Los diez digestos dorados se mueven (superficie, otra vez) y se regeneran con atribución (D-075).
- `docs/balance/*` se regenera: el dataset sintético y el jugable **no se mezclan** (precedente de la
  auditoría de WP4.14).

## Alternativas descartadas

- **Índice de renta por distrito sin cota de muestra.** Nueve índices con un edificio cada uno; el
  mercado se convierte en ruido con marca.
- **Presupuesto municipal por distrito.** Nueve tesorerías: más contabilidad, menos política, y choca
  con la regla explícita del plan (§V.d.5 punto 10).
- **Commuting individual.** Excluido; AGENTS.md y el plan lo dejan fuera del gate.

## No decide

- Elasticidad de migración entre distritos (V.d la pone a cero).
- Segregación residencial por ingreso dentro del distrito: los segmentos existen (D-066), la
  concentración espacial como fenómeno propio no.

## Adiciones respecto a `PLAN_improvements.md`

El plan fija la frontera de mercados, el fallback de tres niveles, la ausencia de mudanza
inter-distrito, la ponderación por población y los frentes compartidos. Esta ADR añade publicar en la
proyección **qué nivel de fallback se usó** (distrito, ciudad o 100). Es una exigencia de
transparencia propia, no del plan, y no cambia ninguna regla de simulación.
