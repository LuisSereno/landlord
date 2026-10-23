# D-066 — Mercado de vivienda segmentado con precio descubierto por vacancia

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.3 (`docs/execution/05-fase-4-alpha-sistemica.md`) exige evolucionar el pool de tenants a
demanda segmentada, definir hogares al nivel mínimo que produzca decisiones (renta, tamaño,
empleo/preferencias), modelar vacancia, asequibilidad y movilidad, ajustar precios con reglas
estables y acotadas, conectar calidad, accesibilidad, seguridad y servicios, y probar shocks,
falta de oferta y ausencia de demanda infinita. La aceptación es explícita: **construir más no
garantiza ocupación; precios y vacancia responden a condiciones explicables.**

Hasta ahora el modelo era estático: cuatro hogares autorados (`PROTOTYPE_TENANTS`) con presupuesto
fijo, una renta que sólo dependía de la definición del edificio, la ordenanza y la condición, y una
ocupación que era exactamente lo que el jugador decidía colocar con `AssignTenant`. No existía
vacancia de mercado, ni llegadas, ni salidas, ni precio que respondiera a nada.

La restricción fuerte es la misma de D-064: Gate 2 y Fase 3 citan cifras económicas concretas
(saldos exactos, precios de parcela, rentas cobradas) y esas aserciones no deben reescribirse para
que un sistema nuevo quepa.

## Decisión

1. **Demanda segmentada data-driven.** `HOUSING_SEGMENTS` define tres segmentos (`household`,
   `maker`, `shopkeeper`) con presupuesto de renta, tipos de edificio preferidos, techo de
   población, llegadas por mes a pleno atractivo y pesos de deseabilidad distintos. El hogar sigue
   siendo la unidad mínima: `Tenant` gana `size` (ocupantes), `segmentId`, `searchMonths` y
   `origin`. `size` se usa para contar bajas en un siniestro y **no** consume plazas de capacidad,
   de modo que las plazas por edificio y las pruebas multiunidad no cambian.
2. **Un sistema mensual al final del tick.** `runHousingMarket` se añade como último elemento de
   `PRODUCT_SYSTEMS` (`housing`). Al ejecutarse después de `rent`, el precio descubierto en un
   cierre se cobra en el siguiente: el mercado no se auto-valida con la vacancia que él mismo
   acaba de resolver.
3. **Una sola fórmula de renta.** `askingRentFor(state, building)` compone base, ampliación,
   ordenanza, condición e índice de tipo. `systems`, `commands` y `projection` la consumen; el
   precio que se muestra, el que valida `AssignTenant` y el que cobra el motor son el mismo número.
4. **Precio descubierto por vacancia, acotado por tres lados.** Con al menos
   `minimumUnitsForPriceDiscovery = 3` edificios operativos del tipo, el índice se mueve hacia una
   vacancia objetivo del 8 %: `+2,5` puntos por punto de vacancia, paso máximo de `±4` por mes y
   banda absoluta `[80, 125]`. Por debajo de tres edificios no hay precio: es la regla de
   continuidad que mantiene intactas las aserciones del slice con un único edificio.
5. **Deseabilidad de cuatro componentes.** Cada parcela operativa puntúa `quality` (condición y
   ampliación), `accessibility` (distancia al centro de actividad), `safety` (incidentes activos
   cercanos y presión policial) y `services` (otros edificios en uso en un radio de 6 celdas). Cada
   segmento las pondera distinto: el hogar prioriza calidad y seguridad, el artesano la
   accesibilidad y el comerciante la clientela. El atractivo del segmento combina la media del
   parque, la seguridad, la asequibilidad de lo vacante y el empleo disponible.
6. **Llegadas acotadas por tres topes simultáneos.** Techo de población del segmento, plazas
   compatibles libres y plazas **asequibles**. Sin plazas o sin plazas que el segmento pueda pagar
   no llega nadie: construir caro produce vacancia, no demanda.
7. **El mercado sólo coloca los hogares que genera.** Los hogares `origin: "market"` se instalan
   solos en la mejor vivienda libre que pueden pagar, tras un mes de búsqueda. Los hogares
   `origin: "authored"` son el pool que el jugador decide colocar: el mercado no se los instala ni
   le quita la decisión, sólo los retira si pasan el plazo de búsqueda.
8. **Movilidad explícita y contada.** Un contrato termina por fin de lease, por condición
   inhabitable o por satisfacción por debajo de 30, y la salida incrementa `departuresTotal`; el
   hogar vuelve al pool. Un buscador que supera `maximumSearchMonths = 6` abandona el mercado. El
   mercado repone hogares hasta el techo, nunca sin límite.
9. **Persistencia aditiva.** `phase2.housingMarket` (índice por tipo, último cierre, llegadas,
   salidas y ordinal de id) y los cuatro campos nuevos de `Tenant` son opcionales en el schema. Una
   partida anterior carga con índice 100 y reconstruye `size`, `segmentId` y `origin` desde el
   perfil del hogar, así que el recuento de bajas de una partida antigua es idéntico.
10. **La evidencia económica no se toca.** Antes y después del cambio se registraron saldos,
    número e importe de transacciones, estado y destino de cada hogar, ruinas, incidentes y bajas
    en los diez casos de `tick-conservation.test.ts`: los diez son idénticos. Los digestos canónicos
    se regeneran porque el estado persistido gana campos, no porque cambie ninguna regla
    económica; el antes y el después queda anotado en el test y en el acta.

## Alternativas consideradas

- **Auto-colocar también los hogares autorados.** Descartada: cambia la economía del slice en el
  primer cierre mensual (un edificio vacío empieza a cobrar renta sin intervención), rompe la
  prueba de liquidez de WP3.6 y elimina la decisión que el jugador ya tiene en la interfaz.
- **Un pool único sin segmentos.** Descartada: no produce decisiones distintas entre un hogar, un
  artesano y un comerciante, y convierte "empleo/preferencias" del WP en decoración.
- **Precio fijado por el jugador por edificio.** Descartada: es micromanagement y sustituye la
  señal de mercado por un control que el WP no pide; además multiplica la interfaz en un WP de
  simulación.
- **Un único índice global en vez de por tipo.** Descartada: patio y taller responden a demandas
  distintas y un índice común haría subir el precio del taller porque sobra vivienda.
- **Llegadas sin techo de población.** Descartada explícitamente por el WP ("ausencia de demanda
  infinita").
- **Consumir el PRNG de la partida en cada tick del mercado.** Descartada: basta un consumo mensual
  para variar presupuestos; hacerlo por tick desplazaría toda la secuencia aleatoria.

## Alcance

Incluido:

- `packages/simulation/src/housing-market.ts`: segmentos, política, deseabilidad, precio, demanda,
  llegadas, salidas, colocación y sistema mensual;
- `askingRentFor` como fórmula única consumida por `systems`, `commands` y `projection`;
- campos aditivos en `Tenant` y estado `phase2.housingMarket` con serialización y restauración;
- lectura del mercado en la proyección (`housingMarket`) y bloque "Mercado de vivienda" en el panel
  de riesgo y política;
- doce pruebas en `housing-market.test.ts`: falta de oferta, exceso de oferta, demanda acotada,
  shocks de renta, dirección y banda del índice, precio mínimo de descubrimiento, deseabilidad por
  segmento, seguridad por proximidad a siniestro, determinismo, guardado/carga, migración y
  coherencia del índice con la renta cobrada.

No incluido:

- salarios, puestos de trabajo individuales y cierres de negocios (WP4.4), que aquí sólo se
  aproximan con un acoplamiento agregado empleo/clientela;
- servicios de barrio reales, accesibilidad peatonal y equipamientos (WP4.6): `services` cuenta
  edificios en uso en un radio, no una capa de servicios;
- criminalidad localizada: la seguridad usa incidentes y presión policial globales, no una capa de
  crimen por celda;
- interfaz de fijación de precios, selección de inquilino por parte del jugador más allá del pool
  existente y representación visual del mercado;
- migración de partidas con perfiles de distrito retirados (sigue la deuda de D-064).

## Consecuencias

### Positivas

- La vacancia pasa a ser una señal: un edificio caro, degradado, aislado o inseguro se queda vacío
  aunque haya demanda, y el jugador puede leer por qué en el panel.
- Construir más allá del techo de demanda ya no llena plazas: la ocupación la fija el mercado.
- El precio responde a la vacancia con una regla de tres constantes, acotada por mes y por banda, y
  el jugador ve el mismo número en la interfaz que el que valida el contrato.
- La evidencia de Gate 2 y Fase 3 sigue siendo válida sin editar una sola aserción económica.

### Costes

- El cierre mensual gana una pasada O(edificios²) para servicios, accesibilidad y seguridad. Es
  mensual, no por tick, y en la ciudad máxima factible (607 edificios) son ~368 000 comparaciones
  de distancia; si la ciudad creciera, lo primero es pasar a una rejilla espacial (deuda con
  disparador).
- El `size` de los hogares debe mantenerse coherente con `TENANT_PROFILE_DEFAULTS`: es la tabla que
  usan los hogares autorados, los sintéticos y la restauración de partidas antiguas.
- El índice añade un grado de libertad al balance: subir `arrivalsAtFullAppeal` o el techo de
  población cambia toda la curva de ocupación. Las pruebas fijan dirección y cotas, no cifras.
- La distinción `authored`/`market` es una regla de producto, no un detalle técnico: si en el futuro
  se quiere que todo hogar se coloque solo, hay que revisar la prueba de liquidez de WP3.6 y el
  papel de `AssignTenant`.

## Evidencia requerida

- `packages/simulation/src/housing-market.ts` y `housing-market.test.ts`.
- `packages/shared/src/domain.ts`: `Tenant` extendido, `HousingMarketState` y
  `housingMarketStateSchema`.
- `packages/simulation/src/snapshot.ts` y `packages/shared/src/snapshot.ts`: persistencia aditiva.
- `packages/simulation/src/systems.ts`, `commands.ts` y `projection.ts`: fórmula única de renta y
  sistema `housing` al final de `PRODUCT_SYSTEMS`.
- `packages/simulation/src/tick-conservation.test.ts`: digestos regenerados con justificación.
- Acta `docs/execution/phase-4/wp4-3-housing-market-2026-10-23.md`.
