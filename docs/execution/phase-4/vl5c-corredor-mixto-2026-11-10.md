# V.l.5c · barrida de coste del corredor mixto (2026-11-10)

Evidencia de una **medición pedida por el responsable** («Haz la barrida de coste del variante mixto
5+3») para decidir los ítems (2)–(5) del paquete V.l.5b de D-104. **No adopta nada**: ninguna de estas
variantes está en el árbol ni en las mesas canónicas al commitear este acta.

## Procedencia

- Árbol medido: `5482bcd` (fix de isla de `facility-coverage` ya ejecutado). Tras la barrida,
  `packages/simulation/src/urban-fabric.ts` = `29c1d85db9aee689…` y
  `packages/simulation/src/district-generator.ts` = `b4524fdc0cd2f289…`, **idénticos a HEAD**
  (respaldo + verificación sha256 en cada corrida; `RESTORE_U_OK` / `RESTORE_G_OK` en los logs).
- Dos costuras temporales leídas por variable de entorno, **borradas antes de commitear**: el resolvedor
  de sección (`VL_MIX`) aplicado a **los dos consumidores de la generación** —`deriveRoadNetwork` y
  `validateUrbanFabric`—, y el ámbito de perfiles con corredor (`VL_CORRIDORS`).
  Lección medida: con la costura sólo en `deriveRoadNetwork` todas las ciudades daban
  `BLOCK_DISCONNECTED (block … pisa vía u obstáculo)`; el generador componía contra un conjunto de
  celdas y la validación comprobaba contra otro. No era geometría, era arnés.
- Arnés validado contra las dos mesas publicadas: **cero corredores 712–740** y **canónico
  (corredor completo en `barrio_del_umbral`) 700–731**, exactamente los valores de
  `packages/simulation/src/city-fixtures.ts`. Doce seeds canónicas, envolvente declarada
  `CITY_PARCEL_COUNT_ENVELOPE` = 700..760, **sin tocar**.

## Los tres modos de sección

La palanca que se pidió medir no era la que se suponía: `deriveRoadNetwork`
(`packages/simulation/src/urban-fabric.ts:280-281`) marca como `avenue` **una sola línea por sentido**
(la central); el resto de la retícula ya es `street`. Es decir, la avenida de 5 **ya** está reservada a
un eje signature. Lo que consume las parcelas es la acera en **todas** las calles.

| modo | `street` | `avenue` | nombre corto |
|---|---|---|---|
| `full` | 3 (acera+carril+acera) | 5 con mediana | corredor completo, el de hoy |
| `ave` | **1 (eje)** | 5 con mediana | calle sin acera, avenida signature con mediana |
| `ave3` | **1 (eje)** | 3 (acera+carril+acera) | calle sin acera, avenida sin mediana |

## Precio por perfil (parcelas que la ciudad deja de tener al encenderle el corredor)

Media y peor sobre las doce seeds. `peor` es el número que importa: la envolvente se incumple por el
peor case, no por la media.

| perfil | `ave` 5+1 | `ave3` 3+1 | `full` 3/5 |
|---|---|---|---|
| `barrio_del_umbral` (slot del jugador) | 9,17 (peor 15) | 2,83 (peor 7) | 13,25 (peor 22) |
| `vega_del_cauce` | 4,75 (peor 11) | 1,67 (peor 6) | 7,67 (peor 11) |
| `ensanche_ferroviario` | 14,83 (peor 21) | 8,67 (peor 20) | 18,08 (peor 26) |
| `mercado_del_norte` | 9,00 (peor 16) | 5,50 (peor 12) | 17,50 (peor 23) |
| `ensanche_ferroviario_oeste` | 6,50 (peor 9) | 2,92 (peor 7) | 7,42 (peor 15) |
| `patios_del_este` | 5,92 (peor 8) | 2,08 (peor 5) | 8,58 (peor 12) |
| `barrio_del_taller` | no compone 11/12 | 7,08 (peor 14) | no compone 12/12 |
| `lomas_del_umbral` | **no compone 12/12** | **no compone 12/12** | **no compone 12/12** |
| `centro_civico` | **no compone 12/12** | **no compone 12/12** | **no compone 12/12** |

El fallo es `ZONING_SHORTAGE (mixed: 0 < 2)` en el primer intento y en las doce seeds: no es que el
corredor de `lomas_del_umbral` y `centro_civico` cueste muchas parcelas, es que **no les entra la cuota
de usos con ninguna sección**. Es el mismo techo que ya registró V.l.4, ahora medido también con la
sección abaratada. La variabilidad tiene un límite estructural, no presupuestario.

Ojo con `ave3` en `vega_del_cauce`: media 1,67 y en alguna seed la ciudad **gana** parcelas frente al
control (mínimo de las doce 713 contra 712). Al quitar aceras, alguna manzana partida vuelve a ser una
sola y empaqueta mejor; el coste del corredor no es monótono con el ancho.

## Combinaciones medidas directamente

| variante | min–max de las doce | seeds bajo el suelo 700 | frentes perdidos |
|---|---|---|---|
| control (cero corredores) | 712–740 | 0 | 0 |
| `full` en `barrio` (árbol de hoy) | 700–731 | 0 (margen 0) | 0 |
| `ave` en `barrio` | 702–734 | 0 (margen 2) | 0 |
| `ave3` en `barrio` | 707–740 | 0 (margen 7) | 0 |
| `ave` en `barrio` + `oeste` | 698–729 | 1 | 0 |
| `ave3` en `barrio` + `oeste` | 706–740 | 0 (margen 6) | 0 |
| `ave` en los seis | 669–696 | 12 | 0 |
| `ave3` en los seis | 690–720 | 3 | 0 |
| `full` en los seis | 638–679 | 12 | 0 |
| corredor en los nueve perfiles | **no compone** | — | — |

`full` en los seis da **638–679**, no los 638–677 publicados por V.l.4: la diferencia de dos parcelas en
el tope es que aquella barrida llevaba `motorwayAxis: true` en `patios_del_este` y V.l.5 lo apagó, así
que ese perfil se deriva hoy con avenida de 5 en vez de autovía de 7. El mínimo coincide exacto.

Ninguna variante que compone pierde un solo frente vial (`frontagesPerdidos` = 0 sobre las 8.773 parcelas
del control, doce ciudades), así que el STOP de V.l.4 —«si se pierde un frente, avenida de 3 de
respaldo»— no se activa en ninguna.

**Aditividad verificada**: con los precios por perfil sueltos se predice el mínimo de las combinaciones
de dos y seis perfiles **con diferencia 0** (`ave_dos` 698, `ave3_dos` 706, `ave_seis` 669). Los distritos
se generan de forma independiente y el modelo de suma vale; por eso la búsqueda de carteras del apartado
siguiente se puede tomar como predicción, no como hipótesis.

## Carteras (búsqueda exhaustiva sobre las 4^9 combinaciones de modo por perfil, modelo aditivo)

Máximo número de distritos v3 con el peor case ≥ 700:

| restricción | distritos v3 | min | cartera |
|---|---|---|---|
| ninguna | 5 | 701 | `ave3` en barrio, vega, mercado, oeste, patios |
| el jugador (barrio) en v3 | 5 | 701 | la misma |
| barrio con `full` (el look de hoy) | **1** | 700 | solo barrio |
| barrio con `ave` | 3 | 702 | barrio `ave` + vega `ave3` + oeste `ave3` |
| barrio con `ave3` | 5 | 701 | la de arriba |
| al menos un `full` en la ciudad | 4 | 702 | oeste `full` + vega, mercado, patios `ave3` |

Carteras concretas que se han preguntado: `barrio full + oeste ave3` = **698, fuera**; con tres
acompañantes = 693, fuera. Es decir, **el corredor completo en el slot del jugador no admite ningún
acompañante dentro de la envolvente**. `oeste full + 3 × ave3` = 702, dentro: el perfil barato es el que
puede pagar el look completo y aun así dejar tres distritos con aceras.

## Superficie visual de cada modo (proxy del pintado de V.l.7)

Cuatro ciudades × un distrito con corredor (`barrio_del_umbral`), celdas por rol:

| modo | acera | mediana | calzada | celdas de corredor por distrito |
|---|---|---|---|---|
| `full` | 1880 | **0** | 2496 | 1094 |
| `ave` | 928 | **0** | 2496 | 856 |
| `ave3` | 960 | **0** | 1536 | 624 |

`ave3` tiene **más** celdas de acera que `ave` (960 vs 928) pese a su avenida más estrecha: a cambio
pierde 960 celdas de calzada. La diferencia visual entre los dos modos no es la que se intuía.

## Hallazgo de producción: la mediana no existe en el mundo generado

`median` = **0 celdas en los tres modos**, sobre las 127 celdas de eje de avenida del distrito
(`censoEjesDeAvenida: { ejes1: {}, ejes2mas: { carriageway: 127 } }`). La causa, medida celda a celda:

- `ROAD_PROFILES.avenue` declara `["sidewalk","carriageway","median","carriageway","sidewalk"]`, así que
  la mediana cae en el **eje** (offset 0).
- Pero la retícula publica la línea de avenida **dos veces**: el tramo largo
  (`road_12132a78` de 32,0 → 32,63) y un tramo de una celda por cada posición (`road_c802a00d`
  32,0 → 32,0, etc.), más el tramo de `street` que también la cubre. En la muestra, la celda `32:0`
  tiene **cuatro ejes encima**.
- `resolveRole` (`packages/shared/src/road-cross-section.ts:219-223`) aplica la regla 1 —«dos ejes que se
  cruzan son calzada»— por recuento de ejes, sin distinguir si son **perpendiculares o colineales**. Con
  `axisHits >= 2` en el 127/127 de los ejes de avenida, la mediana nunca sobrevive.

Consecuencia directa sobre D-104 §1 y §6: la mediana es dato en la tabla y **presentación muerta** —
V.l.7 no tiene ninguna celda que pintar como mediana en un distrito generado. Es la misma deuda de
«representación no mínima de segmentos» que ya se aceptó por payload en V.l.3, pero aquí no cuesta
bytes: cuesta el elemento firma de la fase. **No se arregla en esta barrida** (no está pedido) y la
opción es o minimizar tramos colineales —que cambia `roadSegmentId` y los frentes, lo que V.l.2/V.l.3
prometieron no tocar— o ceñir la regla 1 a ejes de distinta orientación.

## Lo que NO está medido

- **Costuras entre distritos**: un vecino `ave`/`ave3` comparte frontera con un v2 cuyo corredor es el
  eje; `road-corridor-seam.test.ts` sólo cubre pares con el mismo perfil de sección. Sin medir.
- **Canal `map.roadSection`**: publica un perfil por id de clase con un único `width`
  (`packages/simulation/src/projection.ts:501-521`) y su esquema `.strict()` lo valida. Una sección
  mixta (ancho dependiente del segmento, o dos anchos de la misma clase) **no es expresable hoy**: o
  se cambian el esquema y su digesto (D-104 §4) o se añaden ids de perfil. Esta barrida midió la
  geometría de generación, no el contrato de presentación.
- **Economía derivada**: cobertura, valor del suelo y programa municipal con carteras mixtas. La
  envolvente de parcelas no los cubre.
- **Digestos canónicos**: ninguna de estas variantes está regenerada en `city-fixtures.ts`,
  `district-fixtures.ts` ni en los diez dorados. Son evidencia de variante, no mesa publicada.

## Apéndice · líneas crudas de la barrida

```

RESUMEN {"label":"av3_barrio_del_taller","mode":"ave3","scope":"barrio_del_taller","ciudades":12,"min":704,"max":736,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_barrio_del_umbral","mode":"ave3","scope":"barrio_del_umbral","ciudades":12,"min":707,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_centro_civico","mode":"ave3","scope":"centro_civico","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"av3_ensanche_ferroviario","mode":"ave3","scope":"ensanche_ferroviario","ciudades":12,"min":703,"max":733,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_ensanche_ferroviario_oeste","mode":"ave3","scope":"ensanche_ferroviario_oeste","ciudades":12,"min":711,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_lomas_del_umbral","mode":"ave3","scope":"lomas_del_umbral","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"av3_mercado_del_norte","mode":"ave3","scope":"mercado_del_norte","ciudades":12,"min":709,"max":736,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_patios_del_este","mode":"ave3","scope":"patios_del_este","ciudades":12,"min":712,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"av3_vega_del_cauce","mode":"ave3","scope":"vega_del_cauce","ciudades":12,"min":713,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave3_barrio","mode":"ave3","scope":"tree","ciudades":12,"min":707,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave3_dos","mode":"ave3","scope":"barrio_del_umbral,ensanche_ferroviario_oeste","ciudades":12,"min":706,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave3_nueve","mode":"ave3","scope":"all","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ave3_seis","mode":"ave3","scope":"barrio_del_umbral,vega_del_cauce,ensanche_ferroviario,mercado_del_norte,ensanche_ferroviario_oeste,patios_del_este","ciudades":12,"min":690,"max":720,"fueraDeSuelo":3,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_barrio_del_taller","mode":"ave","scope":"barrio_del_taller","ciudades":1,"min":704,"max":704,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,2026]}
RESUMEN {"label":"ave_barrio_del_umbral","mode":"ave","scope":"barrio_del_umbral","ciudades":12,"min":702,"max":734,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_barrio","mode":"ave","scope":"tree","ciudades":12,"min":702,"max":734,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_centro_civico","mode":"ave","scope":"centro_civico","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ave_dos","mode":"ave","scope":"barrio_del_umbral,ensanche_ferroviario_oeste","ciudades":12,"min":698,"max":729,"fueraDeSuelo":1,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_ensanche_ferroviario","mode":"ave","scope":"ensanche_ferroviario","ciudades":12,"min":700,"max":731,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_ensanche_ferroviario_oeste","mode":"ave","scope":"ensanche_ferroviario_oeste","ciudades":12,"min":708,"max":734,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_lomas_del_umbral","mode":"ave","scope":"lomas_del_umbral","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ave_mercado_del_norte","mode":"ave","scope":"mercado_del_norte","ciudades":12,"min":706,"max":731,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_nueve","mode":"ave","scope":"all","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ave_patios_del_este","mode":"ave","scope":"patios_del_este","ciudades":12,"min":704,"max":735,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_seis","mode":"ave","scope":"barrio_del_umbral,vega_del_cauce,ensanche_ferroviario,mercado_del_norte,ensanche_ferroviario_oeste,patios_del_este","ciudades":12,"min":669,"max":696,"fueraDeSuelo":12,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ave_vega_del_cauce","mode":"ave","scope":"vega_del_cauce","ciudades":12,"min":709,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"canonico","mode":"full","scope":"tree","ciudades":12,"min":700,"max":731,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"cero","mode":"off","scope":"none","ciudades":12,"min":712,"max":740,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_barrio_del_taller","mode":"full","scope":"barrio_del_taller","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ful_barrio_del_umbral","mode":"full","scope":"barrio_del_umbral","ciudades":12,"min":700,"max":731,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_centro_civico","mode":"full","scope":"centro_civico","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ful_ensanche_ferroviario","mode":"full","scope":"ensanche_ferroviario","ciudades":12,"min":696,"max":725,"fueraDeSuelo":1,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_ensanche_ferroviario_oeste","mode":"full","scope":"ensanche_ferroviario_oeste","ciudades":12,"min":707,"max":737,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_lomas_del_umbral","mode":"full","scope":"lomas_del_umbral","ciudades":0,"min":null,"max":null,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[1,2,3,5,7,11,13,17,23,42,1337,2026]}
RESUMEN {"label":"ful_mercado_del_norte","mode":"full","scope":"mercado_del_norte","ciudades":12,"min":698,"max":723,"fueraDeSuelo":1,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_patios_del_este","mode":"full","scope":"patios_del_este","ciudades":12,"min":703,"max":733,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
RESUMEN {"label":"ful_vega_del_cauce","mode":"full","scope":"vega_del_cauce","ciudades":12,"min":702,"max":735,"fueraDeSuelo":0,"frontagesPerdidos":0,"errores":[]}
ROLES {"label":"ave3_barrio_m","mode":"ave3","ciudades":4,"districts":36,"v3districts":4,"sidewalk":960,"median":0,"carriageway":1536}
ROLES {"label":"ave_barrio_m","mode":"ave","ciudades":4,"districts":36,"v3districts":4,"sidewalk":928,"median":0,"carriageway":2496}
ROLES {"label":"full_barrio","mode":"full","ciudades":4,"districts":36,"v3districts":4,"sidewalk":1880,"median":0,"carriageway":2496}
```

## Addendum de adopción (2026-11-10)

La decisión posterior del responsable adopta la opción 3 medida: `full` en
`ensanche_ferroviario_oeste`, `ave3` en `vega_del_cauce`, `mercado_del_norte` y `patios_del_este`,
y eje v2 en `barrio_del_umbral`. La implementación se registra en D-104; esta acta conserva la
medición original y la conclusión de que la mediana requiere una decisión visual separada.
