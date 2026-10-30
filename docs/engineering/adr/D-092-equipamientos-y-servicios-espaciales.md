# D-092 — Equipamientos municipales físicos y servicios que recorren la red

Estado: ratificada el 2026-10-28 por el responsable para V.d.3 y V.d.5, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. Equipamientos municipales físicos y cobertura de servicios por grafo.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

> **Ampliada por [D-093](D-093-integridad-urbana-de-vd.md)** (V.d-H1, 2026-10-29): la capacidad de un equipamiento depende de su edificio físico y la limpieza se calcula por distrito.

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

## Implementación V.d.3 (2026-10-29)

El programa exacto vive en `municipal-program.ts` como receta por perfil de distrito: 14
equipamientos (1 ayuntamiento, 3 escuelas, 3 clínicas, 2 comisarías, 2 parques de bomberos, 3
mercados) y 7 espacios públicos (1 plaza, 6 parques). El generador reserva **una manzana completa
por entrada** antes de subdividir el suelo privado, eligiendo la más cercana al centro cívico entre
las que tienen frente vial; una manzana sin frente pasa a terreno bloqueado. Si el programa no cabe,
el intento se rechaza y el distrito se regenera con la seed de intento, como exige la decisión 4.

Cada equipamiento produce:

- una `Parcel` con `disposition: "public"`, precio 0, propietario el municipio, código
  institucional (comercial para mercados), `currentUses` con su uso primario y frentes viales;
- un `Building` municipal con huella autocolocada por `chooseFootprint`, tipo del catálogo,
  orientación, plantas y forma;
- una `UrbanFacility` que enlaza ambos, con capacidad y `serviceProfileId` por tipo.

Las parcelas públicas quedan exentas de los mínimos dimensionales de la oferta privada —una parcela
de equipamiento no es una parcela en venta— pero no del frente vial. Los espacios públicos son
manzanas completas con `blockId: null` y operador municipal; su selección exige adyacencia a la red,
así que son alcanzables desde el tick uno.

Los comandos rechazan el suelo público con códigos propios: `PUBLIC_LAND_NOT_FOR_SALE`,
`PUBLIC_LAND_NOT_TRANSFERABLE`, `PUBLIC_LAND_NOT_COLLATERAL` y `PUBLIC_LAND_NOT_BUILDABLE`; los
tipos municipales se rechazan además en `isUseAllowed`. La subasta no necesita un rechazo nuevo:
sólo ejecuta garantías de préstamos y una parcela pública no puede ser garantía. `SnapshotV2`
valida distrito, operador, parcelas, edificios, espacios y ausencia de edificios compartidos entre
equipamientos.

La proyección publica el programa del distrito observado con sus celdas de acceso vial; el inspector
las muestra como origen de la cobertura futura. En el mapa, las parcelas municipales llevan contorno
cívico y las plazas/parques se pavimentan o se pintan verdes desde sus celdas, de modo que el
programa se localiza sin depender del panel. La cobertura por grafo, la saturación de capacidad y
el cierre de gateways siguen siendo V.d.5. Hasta entonces los edificios municipales se excluyen del
stock privado de vivienda, del balance y de los costes de servicio para no adelantar reglas de esa
fase. El mantenimiento ordinario de los edificios municipales en la caja municipal que menciona
"No decide" **no se cobra todavía**: queda registrado como deuda explícita de V.d.5.

Ajuste declarado: reservar manzanas enteras reduce la mezcla privada. El barrido de 100 seeds midió
máximos de 66,0 % (Vega), 61,5 % (Mercado del Norte) y 60,0 % (Centro Cívico); los techos de
concentración se fijaron en 70/68/65 respectivamente y el resto conserva los de V.d.1. Vega declara
mínimo mixto 0 porque su receta verde/baja densidad no produce manzanas mixtas.

## Implementación V.d.5 (2026-10-29)

El grafo de viaje vive en `facility-coverage.ts`: nodos de celda vial por distrito, coste de
avenida 1 y calle 2, aristas de gateway con el coste de `CityProfile`, y fuentes en las celdas
viales adyacentes al frente de cada facility o espacio público. Un gateway sin conexión no es un
cruce gratuito. La demanda (parcelas marketable) se asigna a la facility alcanzable de menor coste,
con desempate por ID; una unidad de capacidad autorada cubre 25 parcelas y la calidad presupuestaria
multiplica la capacidad efectiva. La cobertura de parcela es 100/0 y cada facility publica demanda,
capacidad efectiva, servidas, porcentaje y saturación.

La caché separa geometría (red, facilities, capacidades, gateways y accesos) de presupuesto: un
cambio de nivel de servicio recalcula la asignación de capacidad sin repetir Dijkstra; un cambio
espacial invalida ambos. Seguridad y transporte son cobertura de grafo; limpieza sigue siendo la red
radial municipal y administración no usa radio.

Bomberos usa `fireDamageForBuilding` para reducir progresión de intensidad y daño estructural; salud
usa `injuredRecoveryDays` para acortar la recuperación; educación y parques suman calidad de
vivienda, mercado suma servicios y el valor del suelo conserva su componente de amenidades cívicas.
La proyección publica `serviceCoverage` por parcela, el informe de cobertura por facility y las
capas de seguridad, bomberos, salud, educación, transporte y valor.

La constante `DEMAND_UNITS_PER_CAPACITY = 25` es una adición de implementación: las capacidades de
V.d.3 no distinguían plazas de hogares. El arranque frío del grafo (p95 ~312 ms una vez) queda como
deuda de carga/presentación; el cierre maduro p95 es 43,30 ms. Evidencia en
`docs/execution/phase-4/vd5-servicios-espaciales-2026-10-29.md`.
