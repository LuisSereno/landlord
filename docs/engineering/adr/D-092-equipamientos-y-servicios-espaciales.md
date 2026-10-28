# D-092 — Equipamientos municipales físicos y servicios que recorren la red

Estado: ratificada el 2026-10-28 por el responsable para V.d.3 y V.d.5, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. Equipamientos municipales físicos y cobertura de servicios por grafo.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

## Contexto

Los servicios urbanos de D-069 se calculan como radio sobre celdas
([packages/simulation/src/urban-services.ts:79](packages/simulation/src/urban-services.ts):
`coverageOf(...)` con `manhattan(cell, center)` y `radiusOf` que crece con el número de edificios y se
satura). Funcionó con un distrito, pero su premisa es que el centro del servicio es un punto
abstracto, no un lugar. Con nueve distritos la premisa se rompe tres veces:

1. Un radio de ciudad **no puede cubrir nueve distritos** sin saturar su capacidad o sin inventar un
   edificio omnipresente.
2. El radio atraviesa obstáculos: la cobertura no conoce la red que D-085 acabó de volver autoritativa.
3. No hay nada que comprar, mantener ni visitar: el servicio no es un sitio, así que el jugador no
   puede elegir vivir cerca de uno.

V.d necesita que "cobertura" signifique "puedo llegar a un equipamiento por la red", y eso exige
primero que el equipamiento exista.

## Decisiones

### 1. Función operativa separada de objeto físico

```
UrbanFacility (función: kind, capacity, serviceProfileId, operatorOrganizationId)
  ├─ parcelIds    (suelo del municipio)
  ├─ buildingIds  (el edificio físico)
  └─ publicSpaceIds (patio, plaza anexa)
```

Un colegio es una función educativa con un edificio y un patio; un mercado es una función comercial
que en principio es trasladable. Fundir función y sprite, o función y parcela, hace imposible ambas
cosas. `FacilityId` sigue perteneciendo a `ProductionFacility` (producción de materiales, D-062);
`UrbanFacility` es un tipo distinto precisamente para no mezclar semánticas.

### 2. El municipio genera y opera; el jugador no coloca equipamientos

AGENTS.md prohíbe flags globales tipo `playerIsMayor` y exige resolver acciones por
roles/capabilities. V.d **no introduce ninguna capability política**: el municipio es una organización
existente (`MUNICIPALITY_ORGANIZATION_ID`) y la generación de equipamientos es una consecuencia del
perfil de ciudad, no una decisión del jugador. El jugador se beneficia o sufre la cobertura; no la
diseña.

Es la decisión que mantiene el alcance dentro del gate y que impide que V.d sea un coladero de la
perspectiva política jugable.

### 3. Suelo público intransferible, con rechazos explícitos

`Parcel.disposition = "public"` bloquea compra, venta, garantía, subasta y construcción empresarial.
Cada bloqueo es un `ErrorCode` propio, no un `SELL_NOT_AVAILABLE` genérico: si el jugador no entiende
por qué una parcela no se vende, concluye que el juego está roto. El precedente es D-076 añadiendo
códigos específicos en vez de reutilizar mensajes.

D-089 fija que las huellas no pueden invadir espacio público; aquí el espacio público además no es
mercancía.

### 4. Las reservas públicas van antes de la parcelación

Orden del generador (§V.d.1): `gateways → red → manzanas → reservas públicas → subdivisión → validación`.

Si los equipamientos se colocaran después de parcelar, o caben en lo que sobra o se omiten. El plan
prohíbe la omisión silenciosa: si el programa no cabe, **se reintenta el distrito entero**. Y el
programa es exacto (§4.4: 1 ayuntamiento + plaza, 3 escuelas, 6 parques, 2 comisarías, 2 parques de
bomberos, 3 clínicas, 3 mercados). Un equipamiento que falta según la semilla no es variedad, es un
hueco de juego.

### 5. Cobertura por grafo, con costes enteros y caché por firma

Dijkstra multi-source sobre un grafo compuesto por celdas viales locales, segmentos con clase,
gateways y conexiones entre distritos. Costes enteros: avenida 1, calle 2, gateway desde
`CityProfile`.

La arithmetic entera no es una simplificación: D-060 ya fijó que los floats en reglas autoritativas
hacen que el resultado dependa del orden, y una cobertura que cambia entre plataformas invalida cada
digesto dorado.

La caché se indexa por **firma** de (topología, facilities, capacidad, presupuesto), no por número de
tick: un presupuesto municipal que sube invalida, un tick que pasa no. El disparador de invalidación
es un cambio de estado espacial o de nivel de servicio, y D-075 ya demostró que las colecciones no
ordenadas rompen la invariancia, así que la firma se calcula sobre orden canónico.

### 6. El grafo cross-district es lo que hace que los gateways importen

Un gateway cerrado degrada **sólo** las coberturas que dependen de él. Es el criterio de gate de
V.d.5 y es también la prueba de que el grafo no es decorado: si cerrar un gateway no cambia nada, el
servicio sigue siendo radial con pasos extra.

### 7. Tres excepciones deliberadas, declaradas como tales

- **Transporte**: es accesibilidad de red y gateways, no radio desde una estación. No hay una
  `UrbanFacility` de transporte con radio.
- **Limpieza**: sigue siendo red municipal sin edificio operativo (D-068 la modela así).
- **Administración**: procede del ayuntamiento, pero no usa radio de cobertura; su alcance es la ciudad.

Declararlas explícitamente evita que alguien "complete" el patrón añadiendo radios que el modelo no
quiere.

### 8. Capacidad, demanda y presupuesto sin dinero implícito

La demanda se asigna en orden estable al facility alcanzable de menor coste, desempate por ID. La
calidad presupuestaria municipal **multiplica la capacidad efectiva**: un recorte no resta edificios,
resta servicio. Y no se añade un coste monetario artificial por atención: D-076 tuvo que limpiar
exactamente ese tipo de coste inventado en otra familia de reglas.

Saturación → cobertura parcial explicable. Es la continuación del "radio que se satura al crecer" de
D-069, traducida a capacidad de un sitio concreto.

## Consecuencias de coste

D-065/D-076 fijan que cruzar un umbral abre remediación obligatoria (medir → optimizar exacto →
re-medir → evaluar LOD). Nueve distritos con un grafo por servicio es el escenario más probable de
cruce en todo V.d. Por eso el plan pide medir **por separado** servicios/rutas y exige que la caché
sea exacta antes que aproximada: una caché con clave incorrecta es más rápida y menos verdadera.

## Alternativas descartadas

- **Radios por distrito con centroide.** Conserva la abstracción que motivó el cambio y hace que un
  equipamiento en una esquina cubra la esquina opuesta a través de un obstáculo.
- **Servicios como buildings del jugador.** Confunde propiedad municipal con cartera privada y
  contamina el valor de activos, las garantías y las subastas.
- **Accessibilidad como atributo persistido por parcela.** Segunda verdad derivable (el mismo error
  que D-085 evitó para las celdas de vía); se recalcula y se cachea.

## No decide

- Tráfico, tiempos de viaje reales ni peatones circulando (excluidos por el plan §1).
- Política de equipamientos jugable: el municipio no es un rol del jugador en V.d.
- Coste de mantenimiento de los edificios municipales en la caja del municipio: entra como gasto
  ordinario del presupuesto existente (D-068), sin fondo nuevo.
