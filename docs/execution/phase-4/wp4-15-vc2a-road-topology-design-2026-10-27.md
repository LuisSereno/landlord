# WP4.15-V.c.2A — Authoritative Road Topology Design

**Estado:** diseño entregado, pendiente de revisión para abrir V.c.2B
**Fecha:** 2026-10-27
**Baseline:** commit `245dbbe` (WP4.15-V.c.1 GAMEPLAY_VISUAL_PROMOTION = PASS)
**Tipo de subfase:** análisis y contrato. Sin código de producción, sin assets, sin render de calzadas.

---

## 1. Objetivo y contexto

V.c.1 puso la partida real (`/`) a consumir `ViewProjectionV1` con Graphic Civic, variantes Blender
deterministas y ground sin re-bake por tick. La diferencia visible grande que queda frente a
`/visual-slice` son **las calles**, y hoy no pueden dibujarse porque no existen como dato.

Esta subfase diseña **una única topología vial autoritativa** compartible por generación de distrito,
buildability, representación visual, pathfinding, accesibilidad, servicios urbanos y futuro tráfico. La
carretera no puede vivir sólo en el frontend. La cadena objetivo:

```
District generation
       ↓
Authoritative road topology  (GameState.map.roads)
       ↓
ViewProjectionV1 (map.roads)
       ↓
GameplayVisualAdapter
       ↓
Graphic Civic roads
```

Motivo de ser más conservador que en las últimas fases gráficas: hasta ahora trabajábamos con
presentación. Una calzada deja de ser presentación en cuanto es dato de mundo, y ese dato toca
generación, saves, digestos y pathfinding.

**Decisiones del responsable de gate registradas para este diseño (2026-10-27):**

1. La red entra en **ambas** superficies canónicas (`canonicalizeState` y `districtCanonicalString`),
   aunque eso mueva 10 digestos dorados y 12 hashes de fixture.
2. **Se cierran mallas ahora**, aceptando el sobrecoste de celdas medido.
3. Los segmentos llevan **clase vial por rol** (`street` corredor de manzana, `avenue` enlace entre
   manzanas), sin arte de clase todavía.

---

## 2. Sistemas actuales afectados (auditoría verificada en código)

| Concepto | Dónde vive | Consumidores reales |
|---|---|---|
| `map.blockedCells` (obstáculo) | `packages/simulation/src/state.ts:150`, `Set<string>` `"x:y"` | escritura sólo en generación (`district-generator.ts:275-299`) y restore (`snapshot.ts:342`); lectura en A\* (`navigation.ts:40`), `chooseInteractionCell` (`navigation.ts:73`), `PlaceTestStructure` (`commands.ts:1238`), validación de jugabilidad (`district-generator.ts:404,410,426`), canonical/hash (`district-generator.ts:470`, `runner.ts:49`), snapshot (`packages/shared/src/snapshot.ts:177,345`) |
| Ocupación de edificio | `occupiedBuildingCells` (`commands.ts:135-147`) | recalculada bajo demanda; sólo para elegir celda de interacción |
| Edificabilidad de producto | `StartConstruction` (`commands.ts:645-711`) | **parcela-scoped**: propiedad + `allowedZoning` + permiso + `!parcel.buildingId` + cupo de cuadrillas + materiales + fondos. **No mira celdas ni `blockedCells`** |
| Pathfinding | `findDeterministicPath` (`navigation.ts:1-52`) | A\* cardinal N/E/S/W determinista, coste uniforme 1, `blocked` = `blockedCells`, con excepción para la celda objetivo; invocado en `systems.ts:747,752`; `MOVEMENT_TICKS_PER_CELL = 10`; no re-valida la celda en cada paso |
| "Acceso" de parcela | `PARCEL_WITHOUT_ACCESS` (`district-generator.ts:414-433`) | exige un vecinal cardinal que no sea parcela ni obstáculo y esté en `reachable`; **`reachableCells` (`:318-345`) camina a través de parcelas**, sólo esquiva obstáculos |
| Accesibilidad económica | `urban-services.ts` (cobertura radial Manhattan, radios 26/30/20), `housing-market.ts:228-231` (`accessibility = cobertura de transporte`, o `isolatedAccessibility`) | modelo radial sin red; el consumidor natural de un frente vial real |
| Territorio | `territoryContacts` (`factions.ts:306-316`) | mira a 1 y 2 celdas invocando "los impares son la calzada" (falsa: §3) |
| Render | `apps/web/src/isometric/IsometricSpikeScene.ts`, `gameplay-visual-adapter.ts` | sólo `ViewProjectionV1`; `@landlord/simulation` no aparece en el renderer; el guard (`scripts/check-architecture.mjs:75-86`) prohíbe importar `visual-slice/layout` |

Negativos confirmados (búsqueda exhaustiva): no existe `roadCells`, `streetCells`, `frontage`, `terrain`
ni ninguna topología vial en `GameState`, en la snapshot ni en la proyección. `ViewProjectionV1.map` es
literalmente `{ width: 64; height: 64 }` (`packages/shared/src/projection.ts:43`).

Tampoco existe un segundo distrito: `GENERATED_DISTRICT_ID = district_00000001`
(`district-generator.ts:25`) y el mapa 64×64 es a la vez distrito y mundo
(`state.ts:147-151`, `snapshot.ts:339-343`). De los 4096 celdas, ~4019 no pertenecen a nada
(`vega_del_cauce` seed 1: 57 parcelas + 20 obstáculos).

## 3. Semántica actual de `blockedCells` y tres afirmaciones documentales refutadas

`profile.obstacles` (`district-profiles.ts:48-51`) se materializa como **clústeres de obstáculo** mediante
un paseo aleatorio cardinal (`district-generator.ts:275-299`). No son, ni de lejos, una red vial:

1. **`blockedCells` NO son calles.** Son el muro del A\* (`navigation.ts:40`). Convertirlas en calzada
   haría las calles no transitables, que es exactamente lo contrario de lo que son una calle.
2. **"spacingX = spacingY = 2 ⇒ los impares son la calzada" es falso globalmente.** Es cierto *dentro*
   de una manzana; el origen de cada manzana se sortea (`district-generator.ts:241-242`), así que la
   paridad cambia de manzana en manzana. Medido: las parcelas de un distrito se reparten entre 2 y 4
   clases de paridad y la **mejor** celosía global de fase fija choca con **502 celdas de parcela** en
   los 24 distritos muestreados (9–36 por distrito). Esta afirmación está escrita como verdad en
   `factions.ts:306-308`, en `ai-context/DECISIONS.md` (D-073) y en
   `docs/engineering/adr/D-073-ia-estrategica-y-facciones.md`.
3. **El plan de V.c. se contradecía a sí mismo.**
   `docs/execution/phase-4/wp4-15-vc-promote-visual-slice-2026-10-27.md:131,139,166,172` proponía
   `deriveRoadsFromBlockedCells` y `blockedCells → asphalt`. Queda **superado** por este documento.

## 4. Métricas medidas sobre el generador real

Sonda no persistida (Node 24 con hook de resolución TS, ejecutando `generateDistrict` real sobre los tres
perfiles y ocho seeds). En V.c.2B estas cifras pasan a `road-topology-fixtures.ts` para quedar bajo
`pnpm test`. Estrategias comparadas:

- **A** celosía de paridad global (la interpretación literal de "los impares son la calzada").
- **B** corredores del spacing: celda media de todo par de parcelas a distancia 2 en un eje.
- **C** B + cierre de retícula (la intermedia entre dos celdas de corredor a distancia 2).
- **D** C + enlaces MST (árbol) hasta unir componentes y los dos spawns.
- **E** C + **cierre de malla rectilíneo** (`maxRun = 12`) + MST. ← opción adoptada.

| Estrategia | celdas | % mapa | componentes | parcelas sin frente | hojas | rectas | esquinas | solapa parcelas | solapa obstáculos |
|---|---|---|---|---|---|---|---|---|---|
| A celosía de paridad | 3072 | 75,0 | 1,0 | 0 | 64 | 32 % | — | **502** | **155** |
| B corredores crudos | 50 | 1,2 | 50,1 | 0 | 50 | 0 % | — | 0 | 0 |
| C + cierre de retícula | 65 | 1,6 | 7,8 | 0 | 36 | 8 % | — | 0 | 0 |
| D + enlaces MST (árbol) | 180 | 4,4 | 1,1 | 0 | 29 (16 %) | 33 % | 42 % | 0 | 0 |
| **E + cierre de malla** | **451** | **11,0** | 1,1 | **0 / 989** | 28 (6 %) | **87 %** | **1 %** | 0 | 0 |

### Detalle por distrito (opción D y opción E, `maxRun = 12`)

| perfil | seed | hash | parcelas | obst. | árbol D | malla E | %mapa | hojas | rectas | esq. | comps | sin frente | colisión celosía |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| barrio del umbral | 1 | `5e83d3c8` | 23 | 0 | 146 | 289 | 7.1% | 17 | 88% | 2% | 1 | 0 | 6 |
| barrio del umbral | 7 | `eb2a78c3` | 28 | 0 | 130 | 350 | 8.5% | 19 | 88% | 3% | 1 | 0 | 18 |
| barrio del umbral | 42 | `0eade538` | 34 | 0 | 189 | 388 | 9.5% | 24 | 88% | 1% | 1 | 0 | 13 |
| barrio del umbral | 1337 | `287d78fc` | 29 | 0 | 146 | 256 | 6.3% | 21 | 82% | 2% | 1 | 0 | 14 |
| barrio del umbral | 3 | `23fd2d99` | 27 | 0 | 173 | 362 | 8.8% | 20 | 89% | 2% | 1 | 0 | 14 |
| barrio del umbral | 99 | `c8178222` | 28 | 0 | 137 | 302 | 7.4% | 17 | 85% | 4% | 1 | 0 | 18 |
| barrio del umbral | 2024 | `540e8a92` | 24 | 0 | 175 | 300 | 7.3% | 15 | 89% | 2% | 1 | 0 | 12 |
| barrio del umbral | 555 | `37ac0fec` | 36 | 0 | 161 | 379 | 9.3% | 26 | 87% | 2% | 1 | 0 | 24 |
| vega del cauce | 1 | `ea4b94cf` | 57 | 20 | 227 | 525 | 12.8% | 41 | 86% | 1% | 1 | 0 | 36 |
| vega del cauce | 7 | `fdc9ba45` | 57 | 11 | 224 | 514 | 12.5% | 34 | 84% | 1% | **3** | 0 | 36 |
| vega del cauce | 42 | `9e5581fc` | 49 | 19 | 190 | 508 | 12.4% | 34 | 87% | 0% | 1 | 0 | 32 |
| vega del cauce | 1337 | `8cfe6f45` | 48 | 13 | 172 | 550 | 13.4% | 33 | 89% | 0% | 1 | 0 | 25 |
| vega del cauce | 3 | `1e67fd2f` | 33 | 20 | 162 | 425 | 10.4% | 28 | 88% | 1% | 1 | 0 | 14 |
| vega del cauce | 99 | `d1eb1246` | 52 | 17 | 182 | 551 | 13.5% | 28 | 88% | 0% | 1 | 0 | 22 |
| vega del cauce | 2024 | `5bbcecdd` | 45 | 19 | 192 | 468 | 11.4% | 33 | 86% | 0% | 1 | 0 | 19 |
| vega del cauce | 555 | `b85d5a55` | 34 | 18 | 162 | 441 | 10.8% | 29 | 89% | 1% | 1 | 0 | 19 |
| ensanche ferroviario | 1 | `c8ed5c81` | 64 | 5 | 211 | 608 | 14.8% | 36 | 87% | 0% | 1 | 0 | 26 |
| ensanche ferroviario | 7 | `0c888ed7` | 32 | 11 | 177 | 350 | 8.5% | 21 | 88% | 1% | 1 | 0 | 14 |
| ensanche ferroviario | 42 | `d407938d` | 54 | 6 | 217 | 670 | 16.4% | 41 | 89% | 0% | 1 | 0 | 33 |
| ensanche ferroviario | 1337 | `332f4f5e` | 49 | 12 | 209 | 485 | 11.8% | 34 | 86% | 0% | 1 | 0 | 14 |
| ensanche ferroviario | 3 | `d71b9435` | 54 | 11 | 199 | 545 | 13.3% | 37 | 83% | 1% | 1 | 0 | 26 |
| ensanche ferroviario | 99 | `e16437aa` | 51 | 10 | 167 | 578 | 14.1% | 41 | 88% | 0% | 1 | 0 | 30 |
| ensanche ferroviario | 2024 | `b06adae1` | 35 | 15 | 170 | 498 | 12.2% | 22 | 90% | 1% | 1 | 0 | 9 |
| ensanche ferroviario | 555 | `0e26ec8a` | 46 | 7 | 202 | 490 | 12.0% | 32 | 88% | 0% | 1 | 0 | 28 |

### Hallazgos que sostienen el contrato

- **Los corredores del spacing nunca caen en parcela ni en obstáculo.** El generador exige
  `isParcelCompatible` al colocar obstáculos (`district-generator.ts:288-297`), así que una celda
  ortogonalmente vecina a una parcela jamás es obstáculo. Medido: 0 solapes en 24 distritos; el cierre
  de retícula sólo chocó con un obstáculo 16 veces en total (~0,7 por distrito).
- **Derivar la red del trazado existente da frente vial al 100 % de las parcelas** (989/989), incluso
  restringiendo la red pública al componente conectado a los spawns.
- **Las hojas SON el frente.** Podar los callejones sin salida hunde el acceso del 100 % al 27,4 % y la
  red de 180 a 34 celdas. El cierre de mallas es lo que concilia "sin callejones absurdos" con acceso
  total: baja las hojas del 16 % al 6 %.
- **El cierre de mallas rectilíneo cuesta 451 celdas (11,0 % del mapa, 2,5× el árbol)** y mejora mucho la
  lectura urbana: 87 % rectas y 1 % esquinas, frente a 33 % / 42 % del árbol con giros. La primera sonda
  (prolongación que permitía girar) daba 593 celdas y 44 % de esquinas: eso no es una calle, es un
  laberinto, y por eso la especificación exige prolongar **sólo en el eje del tramo**. Sensibilidad al
  tope: 445 (`maxRun` 6) / 451 (12) / 455 (20) celdas → el parámetro apenas importa.
- **Un distrito de 24 no conecta del todo**: `vega_del_cauce` seed 7 (`fdc9ba45`) conserva 3 componentes,
  dos de ellos bolsillos sellados por una "rueda de molino" de cuatro parcelas alrededor de una celda
  (configuración que el generador permite porque sólo prohíbe adyacencia cardinal entre parcelas). No
  deja ninguna parcela sin frente.
- **Presupuesto de payload**: la proyección se publica cada 2 ticks (`worker-runtime.ts:166`) y hoy
  transporta ~100 objetos. Meter 451 celdas-objeto en cada publicación multiplicaría el clonado 3–5×.
- **Coste de derivación**: la sonda naive tarda 120–165 ms por distrito real; la celosía densa del
  harness `createScaledCity` (hasta 828 parcelas) deriva en 30 ms pero produce **2948 celdas** (72 % del
  mapa). V.c.2B debe implementar un Prim con wavefront multi-fuente (un BFS por nodo añadido, no por nodo
  del árbol) y fijar un presupuesto < 25 ms.

### Métrica de impacto en suelo edificable

Pedida explícitamente en el encargo (§7): **cero**. La construcción real es parcela-scoped y las calzadas
se tallan exclusivamente de celdas que no son parcela. `parcelCount`, `blockedCellCount` y `zoningCounts`
de los 12 fixtures publicados no cambian en ninguna estrategia derivada (B–E). Sólo la celosía global (A)
destruiría parcelas: 502 celdas en 24 distritos.

## 5. Opciones de representación evaluadas y recomendación

| Opción | Ventaja | Inconveniente |
|---|---|---|
| **A. Sólo celdas** `roadCells: string[]` | trivial para buildability y render; simple en 64×64 | poca semántica: clase, tramos y conectividad tienen que reinventarse en cada consumidor |
| **B. Sólo segmentos** `RoadSegment[]` | compacta y semántica; orientación y clase nativas | tres consumidores derivando celdas por su cuenta → tres derivaciones que pueden divergir |
| **C. Híbrida** (segmentos autoritativos + celdas derivadas por **una** función pura y cacheadas) | semántica sin duplicar verdad; la carga valida segmentos y sus invariantes contra el dominio | exige mantener la función de derivación versionada |

**Recomendada: C.** Es la única que da orientación, clase y conectividad sin crear una segunda verdad.
Regla operativa: `roadCellsFromSegments(segments)` es la única fuente del conjunto de celdas. Las celdas
no viajan en la snapshot, por lo que no existe una segunda verdad que reconciliar.

No se modelan carriles, sentidos, nombres, anchos variables ni tráfico. Un segmento es ortogonal y
closure-inclusivo (`from`..`to`), ancho 1 celda.

## 6. Shape TypeScript propuesto

En `packages/shared/src/domain.ts` (tipos) y `packages/shared/src/snapshot.ts` (schema), reutilizando el
`GridCell` existente.

```ts
export type RoadCellClass = "street" | "avenue";

/** Segmento ortogonal cerrado [from, to] sobre una fila o una columna. */
export type RoadSegmentV1 = {
  id: string;            // `road_${zeroPad(index,8)}`, canónico por (from, to)
  from: GridCell;        // extremo menor en orden canónico (y, x)
  to: GridCell;          // mismo x o mismo y; siempre >= from
  class: RoadCellClass;  // por rol: corredor de manzana = street, enlace entre manzanas = avenue
};

export type RoadTopologyV1 = {
  topologyVersion: 1;
  /** Versión del derivador. Cambiarla = cambiar la red esperada de un seed/perfil. */
  derivationVersion: 1;
  segments: RoadSegmentV1[];  // orden canónico: from.y, from.x, class
};

/** Derivación pura y determinista. NUNCA se persiste como verdad independiente. */
export function roadCellsFromSegments(
  segments: readonly RoadSegmentV1[],
): ReadonlySet<string>; // "x:y", mismo formato que blockedCells

/** Semántica de celda separada e intencional (invariantes, no un enum por celda). */
export type CellSemantics =
  | "obstacle" // no edificable, no transitable  -> map.blockedCells
  | "road"     // no edificable, transitable     -> map.roads
  | "parcel"   // potencialmente edificable      -> phase2.parcels
  | "open";    // libre y transitable, sin decidir edificabilidad
```

Invariantes verificables en V.c.2B: `road ∩ parcel = ∅`, `road ∩ obstacle = ∅`, todo segmento es ortogonal
con `from ≤ to`, ids únicos y ordenados, y la red pública es el componente 4-conexo que contiene los dos
spawns (los bolsillos sellados quedan fuera y se documentan).

Se mantienen los tres conjuntos separados en lugar de un `terrain: CellSemantics[]` por celda: un enum por
celda obligaría a reescribir `blockedCells`, su snapshot y sus seis consumidores por un beneficio
puramente cosmético.

## 7. Dónde vive el dato autoritativo y cómo se genera

**Dónde:** `GameState.map.roads: RoadTopologyV1`, junto a `blockedCells` (`state.ts:147-151`). El renderer
jamás lo ve directamente: sólo a través de `ViewProjectionV1` (§9). **No hay campo nuevo en
`DistrictProfile`**: la red se deriva del layout existente, así que un perfil no puede declararse "con
calles" y otro no, y no se abre una perilla de balance por perfil. `maxRun` es constante del módulo.

**Cuándo:** después de que `composeDistrict` produzca una composición **válida**. Meterlo dentro del bucle
de `MAX_COMPOSITION_ATTEMPTS = 12` multiplicaría el coste por 12 y alteraría el número de intentos
registrado en el reporte.

**Cómo (4 pasos deterministas):**

1. **Corredores.** Celda media de todo par de parcelas a distancia 2 en un eje: es el hueco que ya deja
   `spacingX/spacingY`, y está garantizado libre por `isParcelCompatible`.
2. **Cierre de retícula.** Si dos celdas de corredor están a distancia 2 en un eje y la intermedia es
   transitable, la intermedia también es calzada. Sin este paso los corredores quedan en diagonal
   desconectada (medido: 50,1 componentes → 7,8).
3. **Cierre de malla.** Prolonga cada tramo **en su propio eje**, sin girar, desde sus hojas, hasta
   empalmar con red existente o encontrar parcela/obstáculo/borde, con tope `maxRun = 12`. Baja las hojas
   del 16 % al 6 % y eleva los tramos rectos al 87 %.
4. **Enlaces.** Prim determinista sobre los componentes restantes y las dos anclas de spawn, con BFS
   cardinal multi-fuente que sólo pisa celdas transitables (orden canónico; desempate por distancia y
   luego por índice de nodo). Los segmentos nacidos aquí son `avenue`; los de los pasos 1–3 son `street`.

**Validación de generación ampliada** sobre `validateDistrictPlayability`, con códigos nuevos
`ROAD_SEGMENTS_INVALID`, `ROAD_CROSSES_PARCEL`, `ROAD_UNREACHABLE_SPAWNS`. `PARCEL_WITHOUT_ACCESS` se
mantiene como está: **no** se redefine el acceso en términos de la red hasta que el déficit medido sea 0
en todos los seeds (hoy 0/989 sin frente, pero 1/24 distritos con componentes sueltos).

## 8. Parcel access, buildability y pathfinding

- **Access.** Se expone como función pura `hasRoadAccess(parcel, roadCells): boolean` y como métrica
  reportada en el reporte de generación. Medido: 100 % con la derivación adoptada. **Ninguna regla
  económica cambia** en V.c.2B ni en V.c.2C.
- **Buildability.** Cero cambios en `commands.ts`. La construcción de producto es parcela-scoped y una
  celda de calzada nunca es celda de parcela, así que `road ≠ buildable` se cumple por construcción del
  derivador. El único sitio donde hoy existe "celda edificable" es `PlaceTestStructure`
  (`commands.ts:1238`), una ruta técnica de pruebas que no se toca en esta serie de work packages.
- **Pathfinding.** Comportamiento **idéntico** tras V.c.2B/C: las calzadas se tallan de celdas libres y no
  entran en `blockedCells`, así que `findDeterministicPath` las pisa como antes. El coste diferencial
  `road < open terrain` se decide en V.c.2D con su propio gate. `chooseInteractionCell` seguirá eligiendo
  el vecinal libre, que ahora es calzada: coherente con que los equipos trabajen desde la acera.
- **Territorio (`factions.ts`).** La regla a 1–2 celdas sigue siendo válida (dos parcelas a distancia 2
  comparten corredor). Sólo se corrige el comentario que invoca la paridad falsa.

## 9. Cómo se proyecta

Extensión aditiva y autorizada de `ViewProjectionV1.map`:

```ts
map: {
  width: 64;
  height: 64;
  roads: {
    revision: number;   // 0 mientras la red no sea editable; sube si algún día se autoría
    digest: string;     // fnv1a32 hexadecimal del conjunto canónico de celdas
    cells: string[];    // "x:y" en orden canónico
  };
};
```

- **Celdas, no segmentos.** El render necesita celdas y orientación, y ambas se derivan del conjunto. La
  clase y los tramos se quedan en la simulación hasta que tráfico los pida; entonces el campo es aditivo.
- **`string[]` en lugar de `GridCell[]`.** Con ~451 entradas y una publicación cada 2 ticks, el coste de
  clonar 451 objetos por publicación sería real. Presupuesto de V.c.2B:
  `createViewProjection` debe seguir costando < 2 ms medidos; si se supera, la alternativa ya documentada
  es un mensaje único `RoadTopologyPublished` y dejar en la proyección sólo `revision` + `digest`.
- **Trampa silenciosa.** `mapSchema` (`packages/shared/src/projection.ts:517-520`) y `mapSnapshotSchema`
  (`packages/shared/src/snapshot.ts:175-177`) son `z.object` **no estricto**, que descarta claves
  desconocidas. Sin añadir el campo al schema, la red desaparece en el viaje worker → UI con los tests de
  tipos en verde. Es el fallo más probable de todo el plan y V.c.2B lo cubre con un test de round-trip.
- **Sin nuevos caminos de datos.** El renderer sigue sin poder importar simulación
  (`scripts/check-architecture.mjs:7-17,75-86`); la proyección sigue siendo la única frontera legal.
- `gameplayGeometryKey` pasa a incluir el `digest`: el ground se repinta si cambia la geometría vial
  (nunca durante una partida) y no por tick, conservando el `groundRebakes = 1` medido en V.c.1.

## 10. Persistencia y compatibilidad de saves

**Se persisten los segmentos** como dato autoritativo. El precedente existe y manda: `blockedCells` viaja
en la snapshot (`snapshot.ts:74`) y `restoreStateFromSnapshot` la **lee del save** (`snapshot.ts:342`) en
lugar de regenerarla. Tras save/load el dato autoritativo es la snapshot, no la seed.

- **Saves antiguas sin `roads`.** Backfill determinista en la carga: el campo entra como `z.optional` y,
  si falta, se deriva de las parcelas persistidas. Esto es seguro porque la derivación es una función pura
  del conjunto de celdas de parcela y ese conjunto se persiste completo; verificado: ningún comando de
  producto añade o quita parcelas — el único `parcels.set` fuera de la generación es el harness
  `system-cost.ts:289`. La siguiente save ya guarda la red materializada. **No se sube
  `schemaVersion`.**
- **Por qué no "sólo regenerar desde la identidad de generación".** `District.generation`
  (`{profileId, generatorVersion, seed}`, `domain.ts:164-177`) sí existe y sí se persiste, pero el harness
  de escala inyecta parcelas después de generar, y congelar el derivador como código de compatibilidad de
  por vida es justo el riesgo que el encargo pedía no asumir.
- **Validación.** `validateSnapshotReferences` (`packages/shared/src/snapshot.ts:335-366`) hoy sólo cubre
  `blockedCells` y `structures`; hay que añadir roads (fuera de bounds, duplicados, solape con parcelas) o
  la red viajará sin validar.

## 11. Reglas de determinismo

- Misma `(seed, profileId, generatorVersion, derivationVersion)` → misma topología, byte a byte.
- Orden canónico en todo: segmentos por `(from.y, from.x, class)`; celdas `"x:y"` ordenadas por `(y, x)`
  (el mismo criterio que `compareCellKey`, `district-generator.ts:92-96`). Ningún `Map`/`Set` iterado sin
  ordenar.
- La derivación es puramente geométrica sobre parcelas y obstáculos: no consume `state.prng` (lo vigila
  `district-generation.test.ts:92`) ni `Math.random`. Si V.c.2B introdujera un tie-break con azar, iría a
  un flujo propio derivado (`deriveGenerationSeed`, `district-generator.ts:111-119`).
- La clase `street|avenue` se fija por rol determinista, nunca por una distancia flotante.
- **Líneas base (decisión del gate).** `roads` entra en `canonicalizeState` (`runner.ts:46-50`) → los 10
  digestos de `tick-conservation.test.ts:123-176` se regeneran; y entra en `districtCanonicalString`
  (`district-generator.ts:470`) → los 12 hashes de `district-fixtures.ts:20-129` se actualizan. Como
  parcelas y obstáculos no cambian, `parcelCount`/`anchorParcelCount`/`blockedCellCount`/`zoningCounts`
  siguen idénticos: el movimiento es puramente el término nuevo. Se documenta en la cabecera de
  `tick-conservation.test.ts` como se hizo en WP4.12-R/WP4.13, y los digestos se regeneran en un commit
  propio.

## 12. Compatibilidad con Graphic Civic y catálogo de tiles

Distribución medida sobre la red adoptada (451 celdas de media): **87 % rectas, 6 % hojas, 3,5 % cruces,
2 % T, 1 % esquinas**.

Del manifiesto `apps/web/src/generated/runtime-assets-blender.json:433-505` sólo existen
`ter_road_straight`, `ter_road_corner` y `ter_road_intersection` (1×1, `pixelsPerMeter` 42,667, pivot.y
0,5148, **sin metadatos de orientación**) y `ter_road_corner` no se usa en ninguna parte del layout.

Faltan para representar una red arbitraria:

| Geometría | Estado | Necesidad medida |
|---|---|---|
| recta horizontal (E–W) | existe | 32,7 % de las celdas |
| recta vertical (N–S) | **no existe sin espejo**: hoy se imita con `flipX: true` en `layout.ts:116` | 35,7 % de las celdas |
| esquina, 4 orientaciones | existe un asset, sin variantes ni uso | ~1 % |
| T-junction, 4 orientaciones | **no existe** | ~2 % |
| cruz, 1 orientación | existe | ~3,5 % |
| tope de callejón, 4 orientaciones | no existe | ~6 % (hoy se cierra con acera) |

El `flipX` de `layout.ts:116` **viola la política** de
`ai-context/TECHNICAL-DEBT-MULTI-ORIENTATION.md` ("los sprites con iluminación horneada no deben usar
`flipX`"; luz horneada [9,16,10], sombra 240,6°). Se registra como deuda específica de tiles viales.

Ninguna de esas geometrías se produce en V.c.2A ni en V.c.2B. El contrato debe permitir derivar la
orientación desde la proyección (patrón de vecinos de calzada), y así es: la orientación es función del
conjunto de celdas. `/visual-slice` conserva su malla 4×4 hardcodeada intacta como fixture de regresión.

## 13. Riesgos

1. **Zod no estricto borra el campo nuevo** → red invisible en producción con tipos verdes. Mitigación:
   test explícito de round-trip worker → UI.
2. **Payload por publicación** (451 entradas cada 2 ticks) puede tocar el gate de 60 FPS si se implementa
   como objetos. Mitigación: `string[]` + presupuesto medido < 2 ms, con la variante de mensaje único ya
   diseñada.
3. **Coste del derivador naive** (120–165 ms medidos) dentro del bucle de intentos o en cada carga.
   Mitigación: derivar una vez tras la composición válida; Prim con wavefront; presupuesto < 25 ms.
4. **Bolsillos sellados** (1/24 distritos) dejan componentes fuera de la red pública. Mitigación: red
   pública = componente de los spawns; queda documentado y no se acopla economía al acceso vial hasta
   tener déficit 0.
5. **`createScaledCity`** (harness de rendimiento) generaría 2948 celdas, 72 % del mapa de asfalto.
   Mitigación: el fixture pasa por el mismo derivador y se mide en el gate de rendimiento de V.c.2C; si
   desborda, se le aplica el tope de malla y se documenta.
6. **Mover 10 digestos y 12 hashes** puede enmascarar una regresión real en el mismo commit. Mitigación:
   regenerar en commit propio usando `parcelCount`/`blockedCellCount` sin cambios como control.
7. **Comentarios y ADRs que dan la paridad por calzada** seguirán enseñando un modelo mental falso si no
   se corrigen en esta subfase.
8. **Servicios urbanos y mercado de vivienda** (`urban-services.ts`, `housing-market.ts:228-231`) hoy
   usan radios Manhattan sin red. Son consumidores futuros legítimos del frente vial; este diseño no los
   toca, pero deja constancia para que V.c.2D no los duplique con otra noción de accesibilidad.

## 14. Plan de implementación dividido en pasos pequeños

**V.c.2B — contrato, generación y proyección (sin arte).**
`RoadSegmentV1`/`RoadTopologyV1`/`roadCellsFromSegments` en shared; derivación de 4 pasos en
`district-generator.ts` post-composición; `state.map.roads`; snapshot con backfill y validación de
referencias; `ViewProjectionV1.map.roads` con su schema; invariantes y determinismo; digestos y fixtures
regenerados en commit propio; tests de round-trip y de presupuesto (< 25 ms derivación, < 2 ms
proyección). **Cero cambios** en `commands.ts`, `navigation.ts`, `systems.ts` y en el render.

**V.c.2C — render Graphic Civic.**
El adapter consume `map.roads`; `asphalt` en el `GroundPlan` con precedencia **road > apron > parcela**
(hoy el apron escribe en los cuatro vecinales, `gameplay-visual-adapter.ts:146-158`, y sería arrastrado
por la calzada); orientación derivada por patrón de vecinos; sprites donde el arte existente lo permita;
captures BEFORE/AFTER de `/` y gate de FPS headed con la red real.

**V.c.2D — parcel access y buildability mínimos.**
`hasRoadAccess` convertida en regla de juego de verdad, con su propio gate de balance, y coste de
pathfinding `road < open terrain` sólo si el gameplay lo pide.

**V.c.3 — props viales y vehículos** (semáforos, faroles, pasos de cebra, señales), con la deuda de
multi-orientación resuelta antes.

## 15. Verificación

- Unitarias del derivador: determinismo por seed/perfil; ortogonalidad; `road ∩ parcel = ∅`;
  `road ∩ obstacle = ∅`; conectividad del componente público; acceso 100 % sobre los 24 pares medidos;
  presupuesto < 25 ms.
- Round-trip de la proyección a través del schema (worker → UI) y backfill de una save sin `roads`.
- `pnpm test` completo verde: simulación, `district-generation`, `tick-conservation` (con digestos
  regenerados), `snapshot`, `snapshot-integrity`, `structured-clone`, architecture check con su fixture
  negativa.
- V.c.2C: capturas de `/` reales, FPS headed median ≥ 55 y `groundRebakes` estable.
- Las sondas de esta subfase fueron desechables y no quedaron en el repo; V.c.2B las convierte en
  `packages/simulation/src/road-topology-fixtures.ts` para que estas cifras queden bajo `pnpm test`.

## 16. Criterios de cierre de V.c.2A

`ROAD_TOPOLOGY_DESIGN = PASS` si este documento: (1) audita todos los sistemas afectados con evidencia
`archivo:línea`; (2) separa obstacle/road/parcel sin reutilizar `blockedCells`; (3) evalúa celdas,
segmentos e híbrida y recomienda una; (4) fija dónde vive el dato autoritativo; (5) define la generación
determinista con invariantes; (6) mide acceso, buildability, conectividad y solapes sobre perfiles y seeds
reales; (7) especifica la proyección aditiva y la trampa de zod; (8) resuelve persistencia y compatibilidad
de saves; (9) declara la política de digestos acordada; (10) lista la deuda de tiles viales; (11) no
implementa nada de V.c.2B; (12) corrige las tres afirmaciones documentales refutadas.
