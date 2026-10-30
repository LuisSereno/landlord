# V.d-H1 — Urban Integrity Hardening (acta)

Fecha: 2026-10-29. Rama: `develop`.

- **HEAD inicial:** `95e893742a399a4535778ba2f55158a5aaba2481` (`docs: record V.d hardening evidence
  and Beta debt`) — el `95e8937` que el plan fijó como referencia auditada. Comprobado antecesor de
  `develop` con `git merge-base --is-ancestor`, y `git status` limpio salvo el árbol propio de la
  sesión; no se ha revertido ni reescrito ningún commit posterior.
- **HEAD final:** el de la tabla «Git» al final del documento (trece commits funcionales más los de
cierre documental).
- **push:** no, según §0 del plan («No hagas push salvo autorización expresa»).

## Qué se pidió y qué se entendió

El plan V.d-H1 no es scope nuevo: es la revisión sistemática de las incoherencias que dejaron
V.d.0–V.d.6 al saltar de un distrito a una ciudad 3×3, más la evidencia que falta para poder cerrar
la fase. Diez hallazgos (H1-01…H1-10) con prioridad, cuatro piezas de hardening (§2), el contrato de
assets V2 (§3), el pase completo de gates (§4), evidencia sin pisar la histórica (§5), documentación
(§6) y la reconciliación del acta que declaraba V.d cerrada (§7).

Reglas del plan que han gobernado cada decisión de este acta: corrección con test de regresión,
ninguna seed/constante/límite tocado para poner un verde, guardar los guards de jugabilidad por
perfil, buscar todos los consumidores antes de cambiar una interfaz compartida, y explicar cualquier
cambio de digesto.

## Problemas confirmados y correcciones

Cada bloque siguiente describe el síntoma real, la causa de raíz, la corrección y cómo se probó que
el test fallaba antes del fix.

### H1-01 · identidad espacial por distrito (P0) — `6a32b57`

Desde D-088 los nueve mapas comparten el rango local `0..63`, así que `(20,20)` existe nueve veces.
La vecindad de vivienda, la proximidad de incidentes y la onda expansiva de un colapso comparaban
sólo coordenadas: dos edificios gemelos en distritos distintos eran vecinos lógicos y una explosión
podía dañar el distrito de al lado sin estarlo.

Corrección: semántica espacial centralizada en
[packages/simulation/src/district-place.ts:17](../../packages/simulation/src/district-place.ts)
(`DistrictPlace`, `distanceWithinDistrict`, `isWithinDistrictRadius`), con `null` —no una distancia
grande— entre distritos distintos. Los buckets de `housing-market` se agrupan por `distrito|bucket`,
los incidentes recuerdan su distrito y onda expansiva, sabotaje y adyacencia de técnicos exigen el
mismo distrito.

Prueba: `h1-district-isolation.test.ts` (6 tests). Contra el código previo fallaron 4 de 6.
Determinismo: tres digestos dorados de las carreras con incendios cambian porque el fix **elimina
daño espurio** (ruinas 43→40, 163→161, 613→612), con bajas, hogares, transacciones y cajas idénticas.

### H1-02 · huella autoritativa (P0) — `065de0b`

`occupiedBuildingCells` marcaba **una** celda por edificio en toda la ciudad (incluidas las gemelas de
otros distritos) y `chooseInteractionCell` plantaba al operario junto al ancla. Con varios edificios
por parcela la acción podía dirigirse al edificio equivocado, un técnico contaba como operativo sin
estar junto al edificio y una ruta atravesaba una obra en curso.

Corrección: una sola derivación de obstáculos por distrito y una lista canónica de celdas de
interacción adyacentes a la huella
([packages/simulation/src/district-obstacles.ts:83](../../packages/simulation/src/district-obstacles.ts)),
deduplicada y filtrada por imparable; el destino es el primer alcanzable y si ninguno lo es, la orden
se rechaza. Las rutas del tick y las comprobaciones de llegada usan la huella; el técnico elegible se
elige por id menor y no por orden de inserción del `Map`; `task` sólo se escribe cuando ya existe
destino. `chooseInteractionCell` deja de existir.

Prueba: `h1-footprint-interaction.test.ts` (8 tests); 5 fallaban antes del fix.
Determinismo: cambia un digesto (`scenario:seed-1:36000`, el único con cuadrillas trabajando); todo lo
económico queda idéntico y sólo se mueven las celdas finales de los agentes.

### H1-03 · contrato completo de permiso (P0) y H1-04 · compatibilidad de usos (P0) — `7e5ad50`

H1-03: el permiso era un único registro mutable por parcela (`permitsByParcelId`) que no se gastaba
nunca. Dos solicitudes de tipos distintos se pisaban y un mismo permiso podía financiar obras
infinitas.
H1-04: `allowedUses` se leía con `every` en cuatro capas (motor, proyección, IA rival y UI). `workshop`
declara `["industrial","retail"]` y no existe ningún código con ambos usos, así que **el taller no era
construible en ninguna parcela de la ciudad**.

Corrección: `Permit` con `PermitId` del contador `idCounters.permit`, estados
`approved | denied | expired | consumed` y `consumedAtTick`
([packages/shared/src/domain.ts:873](../../packages/shared/src/domain.ts)); la vigencia por
parcela+tipo se deriva en orden canónico en `permitting.ts` en vez de duplicarse en un índice.
`StartConstruction` consume sólo cuando la obra ya no puede fallar, así que un rechazo no quema un
permiso aprobado; vender la parcela deja de borrar el expediente. La regla de compatibilidad pasa a
ser una única función con semántica OR
([packages/simulation/src/development-codes.ts:104](../../packages/simulation/src/development-codes.ts)),
consumida por las cuatro capas, con lo municipal excluido. Un guardado con la forma antigua del
permiso se rechaza por nombre (`UnsupportedPermitContractError`) antes que inventarle una identidad
que nunca registró.

Prueba: `h1-permit-contract.test.ts` (13 tests); **los 13 fallaban** contra el código de `7e5ad50^`
(verificado revirtiendo los ficheros modificados por el commit y conservando el módulo nuevo).
Incluye la integridad de catálogo: todo edificio privado tiene al menos un código legal.
Determinismo: cambian los diez digestos. Reconstruyendo la superficie canónica anterior sobre el
estado nuevo, nueve recuperan exactamente su valor comprometido —el delta es la superficie canónica,
no la simulación—; el único caso con actividad de permisos (`scenario:seed-1:36000`) no es
reconstituible porque ahora hay tres decisiones donde había un registro, y su economía medida es
idéntica (16 edificios, 20 transacciones, cajas 12 000/2 225/100 000/36/10 000).

### H1-05 · servicio ligado a su edificio (P1) y H1-06 · limpieza por distrito (P1) — `787f043`

H1-05: V.d.3 separó función (`UrbanFacility`) y edificio físico, pero la cobertura usaba la capacidad
declarada aunque el edificio estuviera `burning`, `collapse_pending` o en ruina: una comisaría
destruida daba seguridad y un parque de bomberos destruido apagaba incendios.
H1-06: el centro y la densidad de limpieza se calculaban mezclando los nueve mapas, con lo que el
baricentro no existía en ninguno.

Corrección: `operationalFacilityCapacity`
([packages/simulation/src/facility-coverage.ts:281](../../packages/simulation/src/facility-coverage.ts)),
binaria, y la disponibilidad entra en la firma de **capacidad** de la caché y no en la de geometría
(D-092 §5: quemarse un edificio cambia quién sirve, no dónde están las calles). La limpieza sigue
siendo radial —la excepción declarada de D-092— pero con centro, `buildingCount`, radio y cobertura
por distrito ([packages/simulation/src/urban-services.ts:58](../../packages/simulation/src/urban-services.ts));
el presupuesto sigue municipal y global, y el informe publica la media de los nueve radios como
resumen explícito, no como geometría.

Prueba: `h1-service-availability.test.ts` (9 tests); **los 9 fallaban** contra `787f043^`.
Determinismo: cambian los dos digestos que cruzan un cierre mensual, por el término `services` del
score de suelo; cajas, transacciones, incidentes, hogares, ruinas y bajas idénticos, y las tres
carreras de incendios no se mueven porque en ellas ninguna estación resulta destruida. Consecuencia
de balance declarada: la referencia de saturación (40 edificios) se aplica por distrito, así que un
distrito maduro deja de diluir el radio de los demás. No se ha tocado la constante.

### H1-07 · selección multi-edificio (P1) y H1-08 · ocupación visual (P1) — `ad5ab64`

La proyección ya publicaba `buildingIds`, pero el inspector actuaba sobre el primero: con dos edificios
en el mismo solar no había forma de gestionar el segundo. En paralelo, las pruebas de ocupación del
dressing seguían construyendo sus conjuntos desde `parcel.cell`.

Corrección: selección explícita y derivada
([apps/web/src/building-selection.ts:17](../../apps/web/src/building-selection.ts)) —un edificio se
autoselecciona, varios obligan a elegir y un id que ya no pertenece a la parcela se ignora—, panel que
publica tipo, id corto, estado y propietario, y ninguna acción se ejecuta sin elección. El adapter
recorre `geometryCells` en solares vacantes, construidos, públicos y en obra, y la distancia de
zonificación se mide a la celda más cercana del solar y no a su ancla. `buildingId` se conserva en la
proyección sólo como compatibilidad.

Prueba: `apps/web/src/building-selection.test.ts` (6 tests) más las de ocupación del adapter. H1-07 es
un contrato de módulo nuevo, así que no hay código previo al que regresar: su regresión se demuestra
en el navegador (paso 9 del smoke §2.3, donde la acción sólo se ejecuta tras elegir). H1-08 sí falla
contra `ad5ab64^`: `ningún prop cae sobre una celda lejana de la parcela, aunque el ancla esté en otro
sitio` (1 de 30 en ese fichero).

### H1-09 · valor del suelo con servicios y densidad vigentes (P1) — `514767e`

El desglose no consumía el `CoverageIndex` de V.d.5 ni la densidad realmente vigente, y las amenidades
cívicas se sumaban dos veces. Además `codePotential` leía sólo el `DevelopmentCode` base, así que
mientras el ensayo de densidad de corredor está activo —y ese código cambia de verdad— el potencial
normativo de un solar de corredor no era el vigente.

Corrección: **pesos intactos** (las nueve componentes y sus bandas de `PLAN_improvements` §V.d.4 no se
tocan); cambia lo que alimentan. El término `services` reacciona a los tres canales que el plan
declara relevantes —destruir la comisaría, cerrar los gateways y recortar el presupuesto de seguridad
bajan `services` y `targetValue` en la dirección esperada y se recuperan al reponer—, sin doble conteo
con `civicAmenities`, que mide proximidad geométrica y permanece intacta cuando un edificio arde. La
densidad vigente entra por `effectiveDensityBonus` a través del código efectivo, viajando con el
contexto de valor y no con la geometría cacheada, porque la ordenanza cambia cada mes y las distancias
no. Los derechos adquiridos de un permiso concreto siguen siendo sólo de su titular.

Prueba: `h1-land-value.test.ts` (9 tests). Contra `514767e^` falla exactamente el test propio de este
fix (`el ensayo de densidad sube el potencial de los solares de corredor`); los otros ocho son guardas
de los canales de servicio, ya corregidos por H1-05/H1-06, que se conservan para que nadie los vuelva
a romper. Ningún digesto se mueve: en ellos la ordenanza de densidad nunca está activa y ningún
servicio depende de un edificio destruido.

### H1-10 · escenarios de aceptación extremo a extremo (P0/P1) — `5a6ad16`

Cinco escenarios sobre el pipeline real de sistemas de producto, no contra helpers sueltos:
**A** aislamiento cross-district en la misma coordenada local; **B** incendio real con horas de
`tacticalTick`, cubierto contra descubierto, midiendo `damageCovered < damageUncovered` y la pérdida
neta de cerrar gateways; **C** parcela con varios edificios a través de save/load, mantenimiento,
incidente, ruina y reconciliación de `currentUses`; **D** permisos de punta a punta con identidad,
consumo, reintento rechazado y `PERMIT_DENIED` sin margen de emisión; **E** cuadrilla cross-district
que sólo se asigna después del viaje por gateway.

Prueba: `h1-acceptance-isolation.test.ts` (4) y `h1-acceptance-lifecycle.test.ts` (3).

### Hardening del plan (§2) — `899589b`, `d783c38`, `c1827e8`

- **§2.1 doce city seeds** ([packages/simulation/src/city-fixtures.ts](../../packages/simulation/src/city-fixtures.ts),
  `city-seeds.test.ts` con 7 tests): cada seed con su medida comprometida —nueve distritos, 119
  manzanas, recuento de parcelas, el programa municipal exacto, 12 gateways y 12 conexiones, digesto
  canónico— y validación que además comprueba referencias íntegras, suelo público municipal,
  conectividad, envolvente de parcelas y determinismo. Las envolventes (700..760) son alarma temprana,
  no límite de balance.
- **§2.2 campaña de 24 meses** (`h1-campaign-24-months.test.ts`, 7 tests): 345 600 ticks y 24 cierres
  sobre la seed canónica nº 7. El guion es una **política**, no una línea escrita para ganar; cada
  rechazo del motor se acumula y se denuncia. En **cada** cierre se verifican invariantes estructurales
  (nueve distritos, programa municipal, suelo público, enteros finitos, huellas sin solapamiento,
  trabajo táctico dentro del distrito, desglose de valor exacto con paso ≤ 5 %, cobertura acotada con
  `served ≤ capacity ≤ demand`, contratos sin huérfanos ni sobre ruina, préstamos, incidentes y
  referencias). Hitos 1/6/12/18/24 registrados como salen, sin retocar umbrales.
- **§2.3 smoke del núcleo en navegador** (`pnpm smoke:vd-core-loop`, `scripts/vd-core-loop-smoke.mjs`):
  19 pasos contra React + worker + canvas Phaser sobre una ciudad nueva —crear, verificar los nueve
  distritos, picking de una parcela marketable, comprar, permiso, obra, cuadrilla, fin de obra,
  gestión del edificio, guardar/recargar/cargar, persistencia, cambio de distrito comprobando que
  observar no mueve la caja, exigencia de que el suelo público no se ofrezca a compra/obra/garantía y
  overlays de seguridad y valor con captura JPEG.
- **§2.4 playtest humano:** no ejecutable por este agente. Queda creado el checklist
  [vd-final-playtest-checklist.md](vd-final-playtest-checklist.md) en `PENDING HUMAN PLAYTEST`, y por
  eso la fase **no** se marca `PASS`.

### Contrato de assets V2 (§3) — `b37693f`

Cierra la deuda que V.d.6 declaró. `RuntimeAssetManifestV2` añade `domainFootprint` (las celdas de 4 m
que ocupa el tipo en la simulación, distintas de lo que pinta el sprite), `allowedOrientations`
(subconjunto de 45/135/225/315) y `symmetry` (`omni` exige las cuatro, `none` obliga a declarar la
frontal), más `validateRuntimeAssetManifestV2` con incidencias en orden canónico. La cadena de Blender
sigue publicando V1 y `schemaVersion` es lo único que decide: `parseRuntimeAssetManifest` acepta 1 o 2
—V1 pasa por `fromRuntimeAssetManifestV1`, que no inventa: sólo se dibujó de frente, así que declara
`[45]`—, y cualquier otra versión lanza `RUNTIME_ASSET_MANIFEST_VERSION`. Los SVG cívicos no se
sustituyen y no hay binarios nuevos; el manifiesto pasa de 145 076 a 146 583 bytes, dentro del budget
de 200 KB, y `assets.test.ts` comprueba que el área declarada cuadra con `targetFootprintCells` del
catálogo del motor, para que arte y dominio no puedan divergir en silencio.

### Evidencia sin pisar la histórica (§5) — `a2047f6`

El gate de tejido sólo sabía escribir `docs/execution/phase-4/vd1-fabric-gate.json`, así que correrlo
para cerrar H1 habría sobrescrito la evidencia de V.d.1 (HEAD `0418a5de`). `FABRIC_GATE_OUT` hace
configurable el destino; sin la variable el comportamiento es idéntico al de la fase, y la corrida de
hardening se archiva en `vd-final-fabric-gate.json`.

## Determinismo: los cuatro cambios de golden, atribuidos

Ningún digesto se regeneró «porque sí» ni para conseguir un verde. Los diez escenarios de
`tick-conservation.test.ts` cambiaron cuatro veces, cada una en su commit de fix y con la atribución
escrita en el propio test:

| Commit | Digestos que cambian | Por qué, medido |
|---|---|---|
| `6a32b57` H1-01 | 3 (carreras con incendios) | se elimina daño espurio entre distritos: ruinas 43→40, 163→161, 613→612; bajas, hogares, transacciones y cajas idénticas |
| `065de0b` H1-02 | 1 (`scenario:seed-1:36000`) | único escenario con cuadrillas: cambian sólo las celdas finales de los agentes, de junto al ancla a junto a la huella |
| `7e5ad50` H1-03/04 | 10 | superficie canónica: 9 se reconstituyen exactamente sobre el estado nuevo; el de permisos registra 3 decisiones donde había 1 registro, con economía idéntica |
| `787f043` H1-05/06 | 2 (los que cruzan un cierre mensual) | término `services` del score; cajas, incidentes, hogares, ruinas y bajas intactos y las tres carreras de incendios sin cambios |

## Cada corrección se verificó contra el código previo

«No consideres un problema resuelto sólo porque compila» (§0). La verificación se repitió al cerrar la
fase, medido y no de memoria: se revierten **sólo los ficheros que el commit de fix modificó** (los
módulos nuevos del propio commit se conservan para que el fichero de test pueda importar), se ejecuta
el fichero de test de ese fix y se restaura. Después de cada corrida `git diff HEAD` sobre los
ficheros revertidos quedó vacío.

| Fix | Baseline revertida | Fallan / total | Qué falla exactamente |
|---|---|---|---|
| H1-01 `6a32b57` | `6a32b57^` | **4 / 6** | vecinos falsos por coordenada, incidentes que cruzan distrito, explosión sobre el edificio gemelo y sobre un agente del otro distrito |
| H1-02 `065de0b` | `065de0b^` | **5 / 8** | objetivo de mantenimiento dentro de la huella, acción dirigida al edificio equivocado con dos edificios, obra activa como obstáculo, sabotaje junto al ancla y técnico que apaga fuego sin estar junto a la huella |
| H1-03/04 `7e5ad50` | `7e5ad50^` | **13 / 13** | todo el contrato: identidad y unicidad del permiso, no reutilización, expirado, consumo atómico, derechos de densidad, save/load, canonicalización y los cinco casos de compatibilidad de usos (`workshop` no era legal en ningún código) |
| H1-05/06 `787f043` | `787f043^` | **9 / 9** | comisaría y parque de bomberos destruidos que seguían sirviendo, edificio ardiendo, firma de geometría, save/load derivado y los cuatro casos de limpieza por distrito |
| H1-08 `ad5ab64` | `ad5ab64^` | **1 / 30** | `ningún prop cae sobre una celda lejana de la parcela, aunque el ancla esté en otro sitio` |
| H1-09 `514767e` | `514767e^` | **1 / 9** | `el ensayo de densidad sube el potencial de los solares de corredor` (los otros ocho son guardas de los canales ya corregidos en H1-05/06) |
| H1-07 `ad5ab64` | módulo nuevo | n/a | `resolveBuildingSelection` no existía antes del fix: su evidencia es el paso 9 del smoke del núcleo, no una regresión |
| H1-10, §2.1–2.3 | tests nuevos | n/a | ejercitan fixes ya commiteados; no introducen comportamiento, así que no hay línea de base a la que regresar |

## Nuevos problemas encontrados durante H1

Clasificados y **no parcheados silenciosamente**:

| ID | Hallazgo | Prioridad | Estado |
|---|---|---|---|
| N1 | El programa municipal de 14 equipamientos no cubre nueve distritos: 100 de ~709 parcelas comercializables con cobertura de seguridad y 12 de 14 facilities saturadas de forma permanente (campaña de 24 meses) | **P1** | abierto; es balance fijado al autoralas capacidades (policía/bomberos 2 × 25 parcelas), no un defecto de código. Cambiarlo necesita decisión del responsable |
| N2 | `delegated_deferred` gana en 16/16 seeds en `balance:playable` (`anyDominant: true`) | P2 | abierto y **preexistente**: reproduce 16/16 idéntico en `95e8937`, medido en un worktree aparte. La harness la registra, no la afirma |
| N3 | En 24 meses de campaña espontánea no se dispara ni un incendio por deterioro, así que la cadena fuego→cobertura la cubren los escenarios de aceptación, no la campaña | P2 | declarado; no se fuerza un incendio artificial en el guion |
| N4 | Hitch de arranque frío del grafo de servicios (~312 ms una vez, de V.d.5) | P2 | deuda real viva; no se ha optimizado cambiando reglas |
| N5 | Un guardado `SnapshotV2` anterior a H1 se rechaza (`UnsupportedPermitContractError`) | P2 | consecuencia declarada de dar identidad a un permiso que no la tenía; coherente con los rechazos de D-089/D-090, sin migración a medias |
| N6 | `pnpm test` en suite era rojo por timeout, no por contenido: el test de determinismo de las doce seeds superaba los 60 s por defecto bajo concurrencia (35,97 s en solitario) | P2 | corregido en `c0bda82` con `TWELVE_CITY_TIMEOUT_MS = 180 000` medido, sin rebajar ni dividir aserciones |
| N7 | La UI llamaba «Disponible» al suelo del ayuntamiento, el texto que invita a intentar comprarlo | P2 | corregido en el smoke (§2.3): `ownershipLabel` ahora nombra «Ayuntamiento» |
| N8 | `no-console` (1 warning) en el gate de evidencia del fabric | P2 | preexistente y declarado en la acta de V.d; no se oculta con disable |

## Suite y checks (§4), medidos sobre el HEAD final

Primera corrida completa de `pnpm test` (HEAD `a2047f6`): **roja** por el timeout de `city-seeds`
(N6). Corregido en `c0bda82`, la suite re-ejecutada completa queda verde con exit 0.

| Check | Resultado | Detalle |
|---|---|---|
| `pnpm lint` (eslint + `check:architecture`) | verde | 0 errores; **1 warning** preexistente `no-console` en el gate de evidencia, no ocultado |
| `pnpm -r typecheck` | verde | shared, simulation y web |
| `pnpm format:check` | verde | incluido el markdown de este cierre |
| `pnpm test` → shared | verde | 12 ficheros, **50** tests |
| `pnpm test` → simulation | verde | 59 ficheros (52 + 7 saltados de harnesses opt-in), **455** tests (442 + 13 saltados) |
| `pnpm test` → web | verde | 13 ficheros, **106** tests |
| `pnpm test:architecture` | verde | fronteras de paquetes |
| `pnpm build` | verde | aviso preexistente de chunk > 500 kB |
| `pnpm smoke:alpha` | verde | caja 49 850 u., concejo y proyección tras recargar |
| `pnpm smoke:vd-core-loop` | verde | 15 verificaciones que cubren los 19 pasos, **0 page errors** |
| `pnpm art:assets:check` | verde | manifiesto determinista, 92 imágenes, 123 308 bytes en data URIs |
| `pnpm art:binaries:check` | verde | `status: passed`, 85 binarios, bundle Blender 1 585 136 bytes |

Total de la suite: **598 tests en verde** y 13 saltados (harnesses que sólo corren con su variable de
entorno).

## Gates (§4) con sus números

Tres corridas del gate de tejido sobre el HEAD final, para no reportar un pico aislado:

| Métrica | corrida A (archivada) | corrida B | corrida C | umbral |
|---|---|---|---|---|
| generación p50 | 153,48 ms | 144,09 ms | 145,18 ms | — |
| generación p95 | **227,91 ms** | 202,81 ms | 205,57 ms | < 300 ms |
| generación max | 520,87 ms | 362,03 ms | 378,81 ms | — |
| derivación vial p95 | 2,73 ms | 2,33 ms | 2,29 ms | ≤ 25 ms |

- `pnpm fabric:gate` — PASS: 100 city seeds, 900 distritos, 73 289 parcelas, cero fallos. La
  **corrida A** es la archivada en `vd-final-fabric-gate.json` (incluye su pico, no la mejor); B y C
  se ejecutaron con `FABRIC_GATE_OUT` fuera del repositorio.
- `pnpm road:benchmark` — PASS (`status: PASS`, 24 distritos reales): derivación p50 1,67 / p95 2,92 /
  max 4,98 ms; barrido p95 2,32 ms; proyección jugable p95 13,91 ms y densa p95 67,05 ms;
  `structuredClone` denso p95 19,58 ms y jugable 5,28 ms.
- `pnpm system:cost` — 13/13: primer cierre p95 **260,21 ms** (construcción única del grafo, hitch de
  carga declarado), transición p95 43,47 ms y **maduro p50 38,31 / p95 44,04 / max 44,04 ms**, dentro
  del trigger de D-065 (60 ms).
- `pnpm soak` — PASS: 144 000 ticks en 87 530 ms; RSS 247 MB en el tick 10 000 y 297 MB al final, sin
  crecimiento descontrolado.
- `pnpm balance:playable` — 4/4: 64 campañas (4 estrategias × 16 seeds), **1 216 comandos aceptados y
  0 rechazos**; `delegated_deferred` gana en 16/16 seeds por caja (`anyDominant: true`), el mismo
  resultado que en `95e8937` medido en un worktree aparte (N2).
- §2.1 doce city seeds — 7/7, con determinismo de dos generaciones por seed (el test más lento,
  35,97 s en solitario).
- §2.2 campaña de 24 meses — 7/7 sobre 345 600 ticks, determinista y con invariantes en los 24 cierres.
- §H1-10 escenario B (fuego cross-system) — PASS en `h1-acceptance-isolation` (4/4) y
  `h1-acceptance-lifecycle` (3/3), con `damageCovered < damageUncovered` medido.

## Performance antes / después

| Métrica | baseline V.d (`95e8937`) | V.d-H1 (HEAD final) | delta |
|---|---|---|---|
| generación de ciudad p95 | 221,58 ms | 202,81 / 205,57 / 227,91 ms (mediana 205,57) | −7,2 % sobre la mediana |
| derivación vial p95 | 2,42 ms | 2,29 / 2,33 / 2,73 ms (mediana 2,33) | −3,7 % |
| cierre maduro p95 | 43,30 ms | 44,04 ms | **+1,7 %**, dentro del ruido y bajo el trigger de 60 ms |
| cierre en transición p95 | 46,11 ms | 43,47 ms | −5,7 % |
| soak 144 000 ticks | — | 87 530 ms, RSS final 297 MB | sin regresión |

Ninguna regresión supera el 25 % que exigiría investigación. Ninguna optimización se hizo cambiando
reglas de juego: no se tocó ningún radio, coste, capacidad ni constante económica para ganar
milisegundos.

## Deuda real que sigue existiendo

1. **Playtest humano de §2.4 no realizado** — único motivo por el que la fase no cierra, más allá del
   balance: `docs/execution/phase-4/vd-final-playtest-checklist.md` en `PENDING HUMAN PLAYTEST`.
2. **Escala del programa municipal (N1, P1)** — 100 de ~709 parcelas comercializables con cobertura de
   seguridad y 12 de 14 equipamientos saturados de forma permanente.
3. **Dominancia de `delegated_deferred` (N2, P2)** — preexistente, reproducida en `95e8937`.
4. **Hitch de arranque frío del grafo (N4, P2)** — ~260 ms en el primer cierre medido en esta fase
   (~312 ms en V.d.5), un solo golpe, caché después.
5. **Guardados pre-H1 rechazados (N5, P2)** — `UnsupportedPermitContractError`, sin migración.
6. **Sin incendio espontáneo en 24 meses (N3, P2)** — la cadena fuego→cobertura la cubren los
   escenarios de aceptación, no la campaña.
7. **Capturas golden sin pixel-diff cross-environment (P2)** y **arte cívico procedural** pendiente de
   la ruta Blender (decisión de producción, no de contrato).
8. **`no-console` en el gate de evidencia (P2)** — warning declarado, no suprimido.

## Documentos actualizados en este cierre

- `docs/execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md` (este acta, nueva);
- `docs/execution/phase-4/vd-final-playtest-checklist.md` (nuevo, §2.4);
- `docs/execution/phase-4/vd-final-fabric-gate.json` (evidencia nueva en el HEAD final);
- `docs/execution/phase-4/vd-hardening-2026-10-29.md` (§7: banner de revisión y sección
  «Revisión V.d-H1», historia sin reescribir);
- `docs/engineering/adr/D-093-integridad-urbana-de-vd.md` (nuevo ADR) y punteros en D-080/D-089/D-090/
  D-092 y en el `README.md` del índice de ADRs;
- `ai-context/DECISIONS.md` (entrada condensada D-093);
- `ai-context/PROJECT-STATE.md` (estado V.d-H1, sistemas implementados, assets V2 y tests);
- `ai-context/ARCHITECTURE.md` (sección de integridad espacial y contratos urbanos);
- `ai-context/GAME-DOMAIN.md` (Parcel, Building, Permit, UrbanFacility y la identidad `districtId+cell`);
- `ai-context/KNOWN-GAPS.md` (economía inmobiliaria, servicios públicos, balance y la nueva sección
  V.d-H1 con la deuda verificable);
- `docs/INDEX.md` (entrada de las tres actas nuevas y del rango D-077…D-093);
- `docs/art/RUNTIME-ASSETS.md` (re-medición de budgets del manifiesto V2).

## Git

- **HEAD inicial:** `95e893742a399a4535778ba2f55158a5aaba2481`.
- **Commits funcionales de hardening (13), en orden:**

| Commit | Qué cierra |
|---|---|
| `6a32b57` | H1-01 identidad espacial por distrito |
| `065de0b` | H1-02 huellas autoritativas en navegación e interacción |
| `7e5ad50` | H1-03 contrato de permiso + H1-04 compatibilidad de usos |
| `787f043` | H1-05 disponibilidad ligada al edificio + H1-06 limpieza por distrito |
| `514767e` | H1-09 valor del suelo con servicios y densidad vigentes |
| `ad5ab64` | H1-07 selección multi-edificio + H1-08 ocupación visual |
| `5a6ad16` | H1-10 escenarios de aceptación A–E |
| `899589b` | §2.1 doce city seeds canónicas |
| `d783c38` | §2.2 campaña instrumentada de 24 meses |
| `c1827e8` | §2.3 smoke del núcleo en navegador |
| `b37693f` | §3 `RuntimeAssetManifestV2` |
| `a2047f6` | §5 destino configurable del fabric gate + evidencia nueva |
| `c0bda82` | fix del timeout de la suite (§4, N6) |

- **HEAD final:** `21731de` (`docs: register the V.d-H1 contracts in the wiki and the ADR log`), el
  último de los tres commits de cierre documental (`3096aa4`, `9da539c`, `21731de`). Cualquier commit
  posterior de esta fase sólo toca la documentación de este acta.
- **push:** **no.** Los trece commits funcionales más los documentales quedan locales en `develop`
  hasta autorización expresa.
- Sin `reset` destructivo, sin reescritura de historia y sin trabajo ajeno borrado: `git worktree list`
  muestra un único worktree y el baseline temporal de balance se eliminó con
  `git worktree remove`.

## Estado final

**`BLOCKED` para cerrar V.d, verde para todo lo ejecutable por código.**

- Los diez hallazgos H1-01…H1-10 están corregidos, cada uno con su test de regresión verificado
  contra el código previo; los cuatro requisitos de hardening (§2.1, §2.2, §2.3, §3) están hechos y
  los gates de §4 en verde con sus números archivados.
- La fase **no** se declara `CLOSED`: falta el playtest humano exigido por §2.4 (checklist en
  `PENDING HUMAN PLAYTEST`) y queda abierta una decisión de balance de prioridad **P1** (N1). El plan
  prohíbe marcar `PASS` con un P1 abierto y prohíbe presentar un test programático como una sesión
  humana.
- `V.d todavía no debe cerrarse por: (1) la ausencia de playtest humano de §2.4 y (2) el hallazgo P1
  de escala del programa municipal (N1), que necesita decisión de balance del responsable.`
