# D-093 — Integridad urbana de V.d: identidad espacial por distrito, huellas autoritativas y contratos completos

Estado: aceptada y aplicada. La decide el plan **V.d-H1 Urban Integrity Hardening** (2026-10-29) sobre
`95e8937`, y se implementa en los trece commits de `develop` hasta `c0bda82`. No sustituye a
D-088/D-089/D-090/D-091/D-092 ni a D-080: los amplía donde su texto asumía todavía un solo distrito,
un edificio de una sola celda o un permiso sin identidad.

## Contexto

V.d saltó de un distrito a una ciudad 3×3 en una sola fase (D-088) y fue añadiendo capas encima:
tejido (D-090), composición (D-091), ciudad cívica y servicios (D-092), valor del suelo y presentación.
Cada capa nueva se verificó contra su propia prueba, pero casi ninguna se releyó a la luz de las
anteriores. El resultado funcionaba y estaba verde; diez comportamientos concretos, sin embargo, eran
falsos en una ciudad de nueve distritos. No era deuda de "falta una feature": eran reglas que decían
una cosa y hacían otra, y por tanto invisibles para el jugador.

Los diez, con el fallo que producían:

| ID | Qué afirmaba el código | Qué pasaba realmente |
|---|---|---|
| H1-01 | "radio de 3 celdas alrededor del colapso" | Dos distritos vecinos con la misma coordenada local `(20,20)` se impactaban entre sí: la coordenada no identifica un lugar (D-088) |
| H1-02 | "el agente alcanza el edificio adyacente" | La interacción se resolvía contra `parcel.cell`, no contra la huella; un edificio de 3×2 era alcanzable por su esquina hueca y los agentes atravesaban celdas construidas |
| H1-03 | "permiso aprobado" | No había `PermitId` ni estado de consumo: el mismo permiso financiaba obras indefinidamente y la venta de parcela borraba su historial |
| H1-04 | "usos permitidos" | `allowedUses` se comparaba mal (intersección vacía frente a compatibilidad), así que parte del catálogo se construía donde no debía y otra parte nunca |
| H1-05 | "la comisaría da seguridad" | La cobertura dependía del objeto `UrbanFacility`, no de su edificio: un equipamiento en ruinas seguía prestando servicio |
| H1-06 | "limpieza del distrito" | El centro y la densidad se calculaban sobre las parcelas de la ciudad entera, con distritos fantasma en el baricentro |
| H1-07 | "edificio seleccionado" | La UI usaba `buildingIds[0]`, no lo que el jugador había elegido |
| H1-08 | "la parcela está construida" | El dressing pintaba sobre `parcel.cell`, así que un edificio multi-celda quedaba atravesado por farolas y coches |
| H1-09 | "el valor del suelo refleja los servicios" | `land-value` no consumía `CoverageIndex` ni la densidad vigente, y sumaba `civicAmenities` dos veces |
| H1-10 | "V.d está cerrada" | No había acceptance cross-district, city seeds, campaña de dos años etiquetada ni smoke del núcleo en navegador |

## Decisiones

### 1. La identidad espacial es `districtId + cell`, y "otro distrito" no es "lejos"

Un único módulo define la semántica
([packages/simulation/src/district-place.ts:8](../../../packages/simulation/src/district-place.ts)):
`DistrictPlace`, `distanceWithinDistrict` e `isWithinDistrictRadius`. Entre lugares de distritos
distintos la distancia es `null`, no un número grande: convertir "no hay relación espacial" en
"está a 40 celdas" era precisamente lo que hacía que la onda expansiva cruzara la ciudad.

Consecuencia para los consumidores: cualquier índice de vecindad tiene la clave compuesta. El
`housing-market` indexa vecinos por `distrito|bucket`, la adyacencia de técnicos y el sabotaje exigen
mismo distrito, y el radio de colapso (`COLLAPSE_BLAST_RADIUS_CELLS = 3` en
[packages/simulation/src/systems.ts:78](../../../packages/simulation/src/systems.ts)) usa el predicado
de distrito.

### 2. La huella del edificio manda sobre la navegación y sobre la interacción

`district-obstacles.ts` deriva por distrito dos conjuntos —`occupied` y `impassable`— de las huellas
reales, y `interactionCellCandidates(...)`
([packages/simulation/src/district-obstacles.ts:83](../../../packages/simulation/src/district-obstacles.ts))
devuelve, en orden canónico, las celdas libres contiguas a esa huella. Los tres comandos tácticos
(asignar cuadrilla, mantenimiento, sabotaje) calculan el objetivo contra la huella y **exigen un camino
real**: si `findDeterministicPath` no llega, no hay acción. `chooseInteractionCell`, que inventaba una
celda de contacto, desaparece.

### 3. El permiso es una entidad con identidad y ciclo de vida

`PermitStatus = approved | denied | expired | consumed`, `PermitId` del contador `idCounters.permit` y
`consumedAtTick` ([packages/shared/src/domain.ts:873](../../../packages/shared/src/domain.ts)). La
publicación (qué ve el jugador) y el consumo (qué autoriza una obra) son dos lecturas distintas del
mismo histórico, resueltas por `publishedPermitForParcel`
([packages/simulation/src/permitting.ts:74](../../../packages/simulation/src/permitting.ts)); el
`StartConstruction` que la consume es el único punto que escribe `consumed`
([packages/simulation/src/commands.ts:787](../../../packages/simulation/src/commands.ts)). Vender una
parcela ya no borra permisos: el historial es público.

### 4. Una sola función decide la compatibilidad de usos

`isBuildingAllowedByDevelopmentCode`
([packages/simulation/src/development-codes.ts:104](../../../packages/simulation/src/development-codes.ts))
es la única regla: OR sobre `allowedUses`, y lo municipal nunca es elegible por un privado. Antes la
misma pregunta se respondía en tres sitios con tres criterios; la UI, el comando y la producción rival
podían discrepar.

### 5. Un servicio existe si su edificio existe

`operationalFacilityCapacity`
([packages/simulation/src/facility-coverage.ts:281](../../../packages/simulation/src/facility-coverage.ts))
devuelve `0` mientras ningún `buildingId` del equipamiento esté operacional. La disponibilidad entra en
la firma de **presupuesto** de la caché, no en la de geometría: quemarse una comisaría recalcula la
asignación de demanda sin reconstruir el grafo, que es exactamente la separación que decidió D-092.

### 6. Limpieza: sigue radial, pero por distrito

D-092 declaró la limpieza como excepción radial. Se conserva como excepción y se corrige el ámbito:
centro, densidad y radio se calculan sobre las parcelas del distrito
(`DistrictCleaningGeometry`, [packages/simulation/src/urban-services.ts:58](../../../packages/simulation/src/urban-services.ts)).

### 7. La densidad vigente es una sola lectura

`effectiveDensityBonus`
([packages/simulation/src/development-codes.ts:124](../../../packages/simulation/src/development-codes.ts))
responde por estatus de ordenanza y rol urbano; el valor del suelo la consume a través del contexto y
por eso la ordenanza **no** está en la caché de geometría
([packages/simulation/src/land-value.ts:102](../../../packages/simulation/src/land-value.ts)). El doble
cuento de `civicAmenities` se elimina: la amenidad la aporta el equipamiento alcanzable, no una suma
paralela.

### 8. La presentación deja de adivinar

La selección de edificio es explícita (`resolveBuildingSelection`,
[apps/web/src/building-selection.ts:17](../../../apps/web/src/building-selection.ts): uno solo se
autoselecciona, varios obligan a elegir) y el dressing consume `geometryCells`, así que lo que se pinta
ocupa las mismas celdas que la simulación considera construidas.

### 9. El manifiesto de assets declara lo que el runtime necesita (amend D-080)

`RuntimeAssetManifestV2` añade `domainFootprint` (huella de 4 m del dominio, distinta de la del sprite),
`allowedOrientations` y `symmetry`
([packages/shared/src/assets.ts:285](../../../packages/shared/src/assets.ts)), con validación que
devuelve incidencias en orden canónico. La conversión V1→V2 es explícita y no inventa: un bundle V1 sólo
se dibujó de frente, así que declara `[45]` y huella de dominio igual a la del sprite. `schemaVersion`
desconocido es un error (`RUNTIME_ASSET_MANIFEST_VERSION`), no una rama por defecto.

## Consecuencias

- **Determinismo.** Corregir H1-01, H1-02, H1-03/H1-04 y H1-05/H1-06 cambia el resultado de las seeds:
  los diez digestos dorados de `tick-conservation.test.ts` se regeneraron **cuatro veces**, cada una
  atribuida por medida (observables antes/después) y no por refracción. Ninguna seed, constante
  económica ni límite morfológico se tocó para conseguir un verde.
- **Guardados.** Un `SnapshotV2` anterior a H1 guarda permisos indexados por parcela. Se rechaza por
  nombre con `UnsupportedPermitContractError`
  ([packages/shared/src/snapshot.ts:1076](../../../packages/shared/src/snapshot.ts)) y no se migra:
  dar identidad a un historial que no registró su emisión sería inventar un hecho. Convive con el
  rechazo de v1 de D-089 y con el de pre-V.d.1 de D-090.
- **Pruebas nuevas.** Nueve ficheros de regresión (`h1-district-isolation`, `h1-footprint-interaction`,
  `h1-permit-contract`, `h1-service-availability`, `h1-land-value`, `h1-acceptance-isolation`,
  `h1-acceptance-lifecycle`, `building-selection`, `h1-campaign-24-months`), más `city-seeds` con las
  doce seeds canónicas de ciudad de §2.1 y el smoke `pnpm smoke:vd-core-loop` de §2.3. Cada
  corrección se verificó ejecutando su test contra el código previo: el test falla antes del fix.
- **Rendimiento.** Medido en §4 del plan: generación p95 221,58 → 198,24 ms, derivación vial p95 2,42 →
  2,27 ms, cierre maduro p50 43,30 → 35,41 ms. Ninguna optimización cambió una regla de juego.
- **Lo que esto no arregla.** La escala del programa municipal (14 equipamientos para ~709 parcelas
  comercializables: 100 con cobertura de seguridad y 12 de 14 saturados, medido en la campaña de §2.2)
  y la dominancia de `delegated_deferred` en la campaña jugable, reproducida idéntica en `95e8937`. Son
  cifras fijadas al autorar la receta municipal y su balance, no fallos de integridad: cambiarlas
  necesita decisión del responsable, no un parche para poner un test en verde.
