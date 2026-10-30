# V.d-7A — Cierre del dominio multi-parcela (2026-10-30)

Estado: **V.d-7A DOMAIN PASS**. Alcance reducido: sólo dominio. La capa visual (V.d-7B) no se
toca. V.d **no** se cierra: playtest humano `PENDING HUMAN PLAYTEST`.

## 1. Git

- Rama de trabajo: `wip/vd7-multiparcel-domain` (no se integra a `develop` en esta sesión).
- Base: `1afa0c8df27e25c699ab236e950447a7fdc4f52f` (`develop` intacto).
- Commits de la rama:
  - `a983005` — wip(vd7): contrato multi-parcela compartido (contrato, helpers, permisos y códigos).
  - `fb88520` — wip(vd7a): propagación por systems, colateral, proyección, snapshot, IA y web.
  - `68c0056` — fix: IA, fixtures y schemas alineados con sites multi-parcela; digests atribuidos.
  - `43b15eb` — test: invariantes A–T, índices, colateral, IA y automatización.
  - Commit de esta acta — docs: cierre de dominio V.d-7A (este fichero no puede contener su SHA).
- Push: sí, únicamente `wip/vd7-multiparcel-domain` (autorizado). `develop` no se modifica.

## 2. Contrato

Fuente de verdad única:

```ts
Building          { parcelIds: ParcelId[]; ... }
ConstructionSite  { parcelIds: ParcelId[]; ... }
Permit            { parcelIds: ParcelId[]; ... }
StartConstruction { payload: { parcelIds: ParcelId[]; buildingType: BuildingType } }
RequestPermit     { payload: { parcelIds: ParcelId[]; buildingType: BuildingType } }
```

Invariantes (validadas en el comando, no en el cliente):

- `parcelIds.length >= 1`, sin duplicados, orden canónico (`canonicalParcelIds`);
- mismo distrito y mismo `developmentCodeId`;
- unión 4-conexa por borde (`areCellGroupsEdgeConnected`); el contacto diagonal no cuenta;
- propiedad del actor, `marketable`, uso permitido por el código;
- número exacto de parcelas y área combinada suficiente;
- sin obra activa en ninguna parcela; en complejos (`requiredParcels > 1`) tampoco edificios.

Helpers compartidos: `canonicalParcelIds`, `primaryParcelId` (sólo ancla de presentación),
`areSameParcelSet`, `areCellGroupsEdgeConnected` (`packages/shared/src/parcels.ts`).

## 3. Requisitos de solar (`BuildingDefinition.siteRequirements`)

| Edificio | Tipo | Parcelas | Área mínima (celdas) | Borde |
|---|---|---:|---:|---|
| Patio compacto | `courtyard_home` | 1 | 4 | sí |
| Casa adosada | `row_house` | 1 | 4 | sí |
| Taller de barrio | `workshop` | 1 | 8 | sí |
| Inmueble mixto | `mixed_tenement` | 1 | 8 | sí |
| Bloque de viviendas | `apartment_block` | 1 | 10 | sí |
| Nave logística | `warehouse` | 2 | 12 | sí |
| Ladrillera | `brickworks` | 2 | 10 | sí |
| Planta de cemento | `cement_plant` | 2 | 10 | sí |
| Acería | `steelworks` | 3 | 12 | sí |
| Ayuntamiento | `town_hall` | 1 | 12 | sí |
| Escuela | `school_block` | 1 | 14 | sí |
| Clínica | `clinic` | 1 | 6 | sí |
| Comisaría | `police_station` | 1 | 6 | sí |
| Parque de bomberos | `fire_station` | 1 | 8 | sí |
| Mercado | `market_hall` | 1 | 10 | sí |

`minCombinedAreaCells` usa el `targetFootprintCells` existente. No se rebalancean costes, rentas,
producción ni capacidades.

## 4. Contigüidad y huella

- La contigüidad se evalúa sobre la **unión de celdas** de las parcelas, con vecindad 4-way; los
  distritos comparten rango local de coordenadas, así que la comparación es siempre intra-distrito.
- `StartConstruction` construye una parcela sintética de trabajo con la unión de `cells` y la unión
  de `roadFrontages`; `chooseFootprint` aplica el envelope normativo sobre esa unión. La frontera
  catastral interna no bloquea la huella (test K).
- Se prohíbe la huella fuera de la unión. Las parcelas siguen existiendo por separado: no se
  fusionan, conservan valor, dueño, impuestos, frente y garantía.

## 5. Permisos

- Scope: `buildingType + canonical(parcelIds)`.
- `[A,B] == [B,A]`; `[A,B] != [A,C]`, `[A,B] != [A]`, `[A,B] != [A,B,C]`.
- `activePermitFor` y `permitsFor` respetan el conjunto exacto; `issuePermit` canonicaliza y
  `StartConstruction` consume exactamente el permiso del site (`consumedAtTick`).
- `RequestPermit` es un comando público que también exige `parcelIds` y el número exacto de
  parcelas; no se puede pedir permiso sobre una parcela para una acería de tres.
- Si `StartConstruction` no encuentra permiso vivo del conjunto exacto, emite uno nuevo (flujo
  automático actual) antes de consumirlo.

## 6. Ciclo de vida

- **Completion**: `building.parcelIds = [...site.parcelIds]`; se reconcilian TODAS las parcelas y se
  indexa el edificio bajo cada una.
- **Upgrade**: el site hereda `[...building.parcelIds]`; el edificio no reduce su conjunto.
- **Repair**: el site hereda `[...building.parcelIds]`.
- **Ruin / ClearRuin**: la ruina sigue ocupando todas sus parcelas y bloquea cualquier otro
  proyecto; `ClearRuin` hereda el conjunto y, al completarse, libera todas las parcelas y reconcilia
  `currentUses`.
- **`currentUses`**: se reconstruye en todas las parcelas implicadas al completar, arruinar y
  limpiar. La demanda municipal H2 sigue contando parcelas desarrolladas: un complejo de tres
  parcelas marca las tres (proxy Alpha intencional).
- **Venta**: `SellParcel` rechaza cualquiera de las parcelas si participa en edificio, obra o ruina
  (`SELL_NOT_AVAILABLE`). No se implementa venta conjunta.

## 7. Colateral prorrateado

`buildingCollateralContribution(building, parcelId, value)`:

```text
ids = canonicalParcelIds(building.parcelIds)
base = floor(value / ids.length)
remainder = value % ids.length
contribución(ids[i]) = base + (i < remainder ? 1 : 0)
```

La suma de contribuciones es SIEMPRE el valor completo. Ejemplos obligatorios:

- Edificio de coste 5200 en `[A,B]`: A=2600, B=2600; suma 5200 (no 10400).
- Acería (`steelworks`, coste 5200) en `[A,B,C]`: 1734 + 1733 + 1733 = 5200.
- El orden de `parcelIds` no cambia el reparto: se canonicaliza antes de repartir.

`RequestLoan` y `collateralValue` suman la contribución de ESTA parcela; el índice multi-parcela no
duplica el activo. LTV y política bancaria no cambian. Test de integración: un préstamo por el
límite exacto de la contribución se acepta; uno con +100 se rechaza con `LOAN_CAPACITY_EXCEEDED`.

## 8. Snapshot

- `SnapshotV2` mantiene `schemaVersion: 2`; `Building`, `ConstructionSite` y `Permit` persisten
  `parcelIds` (Zod con `min(1)`).
- Save/load conserva `parcelIds` idénticos y el digesto canónico idéntico (test S).
- Un snapshot V2 anterior sin `parcelIds` es estructuralmente incompatible y se rechaza; no se
  inventa migración (test S, «snapshot antigua incompatible»).

## 9. Proyección

- `ViewProjectionV2.economy.buildings[]` y `constructionSites[]` publican `parcelIds` en TypeScript
  y Zod; los boundary tests y el esquema del renderer lo validan.
- Los permisos se siguen publicando por parcela (`ProjectedParcel.permitId/status/expiry`); no
  existe una entidad `Permit` separada en la proyección, así que no hay un segundo `parcelIds` que
  pueda divergir.
- `primaryParcelId` se usa sólo como ancla de cámara/foco en el shell existente. No es una regla
  económica ni una fuente de verdad.
- El worker client envía `parcelIds`; la UI de una parcela envía `[parcelId]`, de modo que
  viviendas y talleres siguen funcionando sin UX nueva. Los edificios multi-parcela no tienen
  todavía UX de ensamblado: es V.d-7B.

## 10. IA rival y automatización

- `findDevelopmentSite({state, definition, ownerOrganizationId, seedParcelId?, districtIds?})` es
  puro y determinista: filtra `marketable`, propiedad, código permitido, sin edificios ni obras;
  construye vecindad 4-way intra-distrito; explora conjuntos hasta el tamaño exacto con tope de
  nodos; valida distrito, código, contigüidad y área; devuelve ids canónicos. Orden de desempate:
  districtId y ids lexicográficos, nunca orden de Map.
- La IA rival recorre sus definiciones de producción ya ordenadas por idoneidad y elige la primera
  que cabe en su terreno. Si no hay site válido, no construye y no compra parcelas adicionales.
  Se corrigió además la lectura del código urbanístico: se toma de la parcela, no del bloque.
- La memoria antirrepetición usa el join canónico de `parcelIds` como target; para una parcela
  coincide con el `parcelId` anterior, así que no colapsa todos los rechazos en `"*"`.
- La automatización actual **no emite `StartConstruction`** (sólo inquilinos, préstamos y
  reparaciones). Las reparaciones que abre heredan `building.parcelIds`; el test cubre ese camino y
  no hay ninguna ruta que pueda emitir un site inválido.

## 11. Códigos de rechazo

Nuevos códigos estables en `ErrorCode` y su Zod:

`DUPLICATE_PARCELS`, `WRONG_PARCEL_COUNT`, `PARCELS_DIFFERENT_DISTRICT`,
`PARCELS_NOT_EDGE_CONTIGUOUS`, `MIXED_DEVELOPMENT_CODES`, `SITE_AREA_TOO_SMALL`,
`PARCEL_OCCUPIED`.

Los rechazos de existencia/propiedad/uso/ocupación/dinero conservan sus códigos previos
(`PARCEL_NOT_FOUND`, `ACTOR_NOT_AUTHORIZED`, `USE_NOT_ALLOWED`, `ACTIVE_SITE_ON_PARCEL`,
`INSUFFICIENT_FUNDS`, etc.). No se devuelve `INVALID_ACTION` para todo.

## 12. Determinismo y atribución de digestos

- Los diez golden digests y las doce medidas de ciudad cambian **sólo por superficie canónica**:
  `parcelId` → `parcelIds` en 14 edificios municipales y en las entidades persistidas.
- Atribución medida: sobre los estados finales nuevos se reconstruyó la forma canónica anterior
  (cada `parcelIds` de un solo elemento vuelto a `parcelId`, claves reordenadas) y los diez golden
  recuperan exactamente sus valores previos: `7b9f8b44a0126934`, `107877d75330c137`,
  `eecd14f55a886042`, `638911642611e350`, `b0da0195cda5a973`, `1a6c324780f8bc19`,
  `9c01fa414acf9739`, `6d7092e071c2d219`, `b7a9bc0c08827329`, `0553e0da42cb1235`.
- Contraprueba `scenario:seed-1:36000`: con `requiredParcels = 1` en todas las definiciones el
  digesto normalizado vuelve a `638911642611e350` y las cajas/transacciones/edificios coinciden con
  la ejecución real (rival 2225, 20 transacciones, dos viviendas). No hay delta económico por la
  regla multi-parcela en ese escenario.
- Valores nuevos archivados en `tick-conservation.test.ts` y `city-fixtures.ts` con la nota de
  regeneración V.d-7A.

## 13. Tests A–T

Archivo `packages/simulation/src/vd7a-multiparcel.test.ts` (28 tests) y
`packages/shared/src/parcels.test.ts` (5 tests de contrato puro).

| Test | Resultado |
|---|---|
| A — casa de 1 parcela | PASS |
| B — cementera con 1 parcela rechazada | PASS |
| C — cementera con 2 contiguas aceptada | PASS |
| D — dos parcelas diagonales rechazadas | PASS |
| E — dos distritos rechazados | PASS |
| F — parcela del rival rechazada | PASS |
| G — parcela pública rechazada | PASS |
| H — códigos urbanísticos distintos rechazados | PASS |
| I — ids duplicados rechazados | PASS |
| J — área insuficiente rechazada | PASS |
| K — huella cruza la frontera interna | PASS |
| L — acería exige 3 parcelas | PASS |
| M — permiso `[A,B] != [A,C]`, `[A]`, `[A,B,C]` | PASS |
| N — completion conserva `parcelIds` | PASS |
| O — upgrade conserva `parcelIds` | PASS |
| P — repair conserva `parcelIds` | PASS |
| Q — ruina bloquea y ClearRuin libera el conjunto | PASS |
| R — venta de cualquier parcela ocupada rechazada | PASS |
| Reserva — un complejo bloquea incluso un proyecto de 1 parcela; también en ruina | PASS |
| S — save/load conserva `parcelIds` y digesto; snapshot antigua rechazada | PASS |
| T — `[A,B]` y `[B,A]` producen el mismo estado/digesto | PASS |
| Índices — `buildingsOnParcel` y `activeSiteOnParcel` desde cada parcela, sin duplicados | PASS |
| Colateral — suma exacta 5200 y 5200/3; orden canónico | PASS |
| IA — site de 3 parcelas elegido; sin tercera parcela no emite obra inválida | PASS |
| Automatización — hereda el solar completo al abrir reparación | PASS |

## 14. Typecheck, tests y build

- `pnpm --filter @landlord/shared typecheck`: PASS.
- `pnpm --filter @landlord/simulation typecheck`: PASS.
- `pnpm --filter @landlord/web typecheck`: PASS.
- `pnpm test` (suite completa de los tres paquetes + arquitectura): PASS, exit 0. Web 142/142;
  shared 55/55; simulación con la suite completa en verde (incluye los 28 tests nuevos y los
  golden regenerados).
- `pnpm build`: PASS.

## 15. Gates

| Gate | Resultado |
|---|---|
| `pnpm lint` | PASS (2 warnings `no-console` preexistentes en harnesses de balance/gate) |
| `pnpm typecheck` | PASS (shared, simulation, web) |
| `pnpm format:check` | PASS |
| `pnpm test` | PASS |
| `pnpm build` | PASS |
| `pnpm fabric:gate` | PASS (100 seeds, 900 distritos); evidencia en `vd7a-fabric-gate.json` |
| `pnpm system:cost` | PASS (13 tests); números en §16 |
| `pnpm balance:playable` | PASS (4/4) |
| `pnpm services:balance` | PASS (1/1); evidencia en `vd7a-service-final.json` |
| `pnpm soak` | PASS (144 000 ticks headless + save/restore), ver §16 |

`services:balance` se ejecutó dos veces: la primera con el `SERVICES_BALANCE_OUT` por defecto
escribió `vd-h21-service-final.json`; ese fichero se restauró desde Git y la corrida válida se
archivó en `vd7a-service-final.json` para no pisar la evidencia de H2.1.

## 16. Rendimiento

`system:cost` midió en esta máquina (una corrida): `mature` media 52,91 ms, p50 51,25 ms y
p95 79,43 ms en la escala grande; `transition` p95 54,89 ms. La regla de 60 ms de H2.1 sigue sin
resolver y **no se declara superada**: es el mismo disparador de medición que H2.1 dejó abierto
(24 muestras maduras, el p95 equivale a la segunda mayor y la varianza entre corridas de la misma
máquina ya era 51–68 ms). V.d-7A no añade trabajo por tick: los índices siguen siendo derivados y
se reconstruyen en los mismos puntos; el coste nuevo está en operaciones de conjunto acotadas por
el número de parcelas del proyecto (máximo 3 en Alpha). El soak de 144 000 ticks termina en verde
(continuidad save/restore y tick final); no afirma un techo de memoria, sólo que el recorrido
completa.

## 17. Deuda explícita y V.d-7B

Pendiente para V.d-7B (no implementado en esta sesión):

- límites visuales de parcela (`parcel.cells`, no el rombo del anchor);
- visualización del frente vial;
- selección semántica por entidad;
- picking propio de sprites de edificio y obra;
- portal de tooltips fuera del clipping;
- lenguaje player-facing de facilities;
- smoke visual y capturas.

Deuda de contenido detectada: la ciudad generada contiene pares industriales contiguos naturales,
pero **ningún triplete**, así que la acería (3 parcelas) no es alcanzable con el generador actual.
La regla no se relaja en V.d-7A; debe decidirse generación/contenido antes de prometerla.
También queda declarado que la idoneidad de producción de un complejo se lee de la parcela
primaria (simplificación Alpha) y que la demanda municipal sigue contando parcelas desarrolladas.

## 18. Decisión

El dominio multi-parcela está cerrado y preparado para V.d-7B Spatial Visual Integrity.
