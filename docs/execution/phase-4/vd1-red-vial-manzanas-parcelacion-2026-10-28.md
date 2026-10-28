# V.d.1 — Red vial, manzanas y parcelación

Fecha: 2026-10-28. Rama: `develop`. Implementación: `0418a5d` (`feat: derive the urban fabric
from roads, blocks and multi-cell parcels`).

## Alcance ejecutado (PLAN_improvements.md §V.d.1)

1. **Contrato vial.** `RoadTopologyV1` pasa a `RoadTopology`; `topologyVersion` sigue en 1 y
   `derivationVersion` sube a **2**. `roadCellsFromSegments` sigue siendo la única derivación de
   celdas; `roadCellClassesFromSegments` conserva la semántica de D-085 (avenue domina en un cruce).
2. **`RoadAnchor[]`.** Nuevo tipo compartido (`gateway`, `civic_center`, `commercial_corridor`,
   `industrial_access`, `spawn`). El generador traza una retícula autoral (`latticeLines` 3 o 4 por
   eje) y conecta cada ancla con un codo ortogonal determinista. **Las carreteras no se derivan de
   parcelas**: el test `does not draw roads over parcels` fija el orden.
3. **Manzanas por flood fill.** `formBlocks` separa el suelo desarrollable por vías y obstáculos; los
   componentes excesivos se parten con cortes guillotina deterministas que se convierten en callejones
   (obstáculo, no vía). El corte se rechaza si deja una pieza sin frente vial.
4. **Envelopes de corredor.** `maxBlockAreaCells` y `maxBlockDepthCells` por receta; los corredores
   abiertos se resuelven con la retícula (3 líneas → manzanas de 31 celdas; 4 líneas → 20).
5. **Parcelación frente → interior.** Se detectan frentes por dirección, se crean semillas por anchura
   objetivo, se crece por BFS multi-fuente (todas las semillas a la vez) y las celdas huérfanas se
   asignan al vecino con mayor borde común. Resultado: cobertura completa del bloque y conjuntos
   conexos.
6. **IDs canónicos.** `BlockId` es hash FNV de distrito + geometría canónica. Los `ParcelId` son
   ordinales en orden geométrico canónico **con las anclas autoradas primero**, para que
   `parcel_00000001` conserve su papel de solar de referencia sin fijar su celda.
7. **Parcela multi-cell.** `Parcel` gana `blockId`, `cells`, `anchorCell`, `roadFrontages` y
   `disposition`; `cell`, `zoning` (sigue hasta V.d.2) y `buildingId` (sigue hasta V.d.2) se separan.
   `cells` viaja también en la proyección pública.
8. **Issues estructurales.** Los nueve códigos del plan están implementados y probados:
   `BLOCK_UNASSIGNED_CELLS`, `BLOCK_DISCONNECTED`, `PARCEL_DISCONNECTED`,
   `PARCEL_WITHOUT_ROAD_FRONTAGE`, `PARCEL_TOO_NARROW`, `PARCEL_TOO_DEEP`, `GATEWAY_NOT_CONNECTED`,
   `PUBLIC_RESERVATION_INVALID`, `FACILITY_SITE_INVALID`.
9. **Reintentos.** Hasta doce intentos por distrito, cada uno con un flujo PRNG derivado
   (`deriveAttemptSeed`); el error final nombra ciudad, distrito, perfil, seed e issues.
10. **Reserva pública provisional.** Una manzana completa por distrito se reserva como plaza/parque
    (`blockId: null`) hasta que V.d.3 genere el programa municipal exacto. Elimina la ambigüedad de
    "suelo público" sin adelantar equipamientos.
11. **Snapshot y compatibilidad.** `SnapshotV2` persiste `blocks` y `publicSpaces`; un guardado v2
    anterior a V.d.1 (parcela puntual y `derivationVersion: 1`) se rechaza por nombre con
    `UNSUPPORTED_URBAN_FABRIC` y no se modifica. No hay migración.
12. **Consumidores.** Comandos, sistemas, facciones, servicios, housing, sistema de coste, snapshot y
    proyección usan `anchorCell`/`cells`; el harness de coste sustituye el tejido del distrito
    objetivo por parcelas sintéticas en celdas libres de vía.

## Decisiones de implementación (adiciones a D-090, no al plan)

- **`connectSpawns`.** Las recetas de baja densidad desconectan el ancla de spawn de la retícula
  (el solar se sirve de la calle más próxima). Sin ese ahorro, la densidad vial quedaba en 23,8
  km/km² frente al máximo 23,26 del envelope `low_density_residential`; con él queda en 23,07 y el
  resto de métricas encaja. Es una opción de dato en `UrbanFabricConfig`, no un caso especial.
- **Anclas primero en los ordinales de parcela.** El plan exige IDs derivados de geometría, no del
  orden de descubrimiento. Se cumple (orden geométrico canónico) y se añade que las parcelas ancla
  conservan los primeros ordinales para no romper la continuidad económica de D-064.
- **Bloques no persistidos como índices.** No se añaden índices derivados todavía; V.d.2 los
  introducirá (D-090 §Consecuencias).
- **Callejones.** Los cortes de bloque son celdas bloqueadas, no una tercera clase vial. No se
  amplía `RoadCellClass` ni se inventan vías de servicio.
- **Catálogo de códigos.** Se materializan los siete códigos de §4.2 con enteros; V.d.2 los usará en
  permisos y usos. En V.d.1 sólo se asigna `Block.defaultDevelopmentCodeId` desde el rol dominante.

## Gate, criterio por criterio

Evidencia reproducible: `pnpm fabric:gate` (100 city seeds, 900 distritos) escribe
`docs/execution/phase-4/vd1-fabric-gate.json`.

| Criterio | Resultado | Evidencia |
|---|---|---|
| 100 % de parcelas marketable con frente válido | PASS | `urban-fabric.test.ts` + barrido 900 distritos (81.266 parcelas) |
| Cero solapes vía / obstáculo / parcela / espacio público | PASS | `validateUrbanFabric` sin issues en los 900 distritos; test de issues |
| Manzanas y parcelas internamente conexas | PASS | test de conexión 4-vecina por bloque y parcela |
| Todos los gateways conectados a la red pública | PASS | 900 distritos; `GATEWAY_NOT_CONNECTED` como guarda |
| Sweep mínimo 100 city seeds / 900 distritos sin fallos silenciosos | PASS | 900/900 generados; 0 issues; 81.266 parcelas |
| Métricas de cada receta dentro de su envelope morfológico | PASS | ver tabla |
| Generación total p95 < 300 ms | PASS | p95 **169,86 ms** (p50 134,89 ms; máx 560,69 ms por reintentos) |
| Derivación vial por distrito ≤ 25 ms (D-085) | PASS | p95 **2,83 ms** en el gate; p95 3,21 ms en `road:benchmark` |

### Métricas morfológicas (mediana de 100 seeds por receta)

| Receta | Familia | Densidad km/km² | Intersecciones/km² | Área mediana de manzana (celdas) |
|---|---|---:|---:|---:|
| barrio_del_umbral | ensanche | 23,6 | 168 | 221 |
| ensanche_ferroviario | ensanche | 23,7 | 168 | 225 |
| lomas_del_umbral | low_density_residential | 23,07 | 137,3 | 450 |
| vega_del_cauce | low_density_residential | 23,07 | 137,3 | 450 |
| mercado_del_norte | mixed_dense | 32,65 | 320,4 | 398 |
| barrio_del_taller | mixed_dense | 32,9 | 320,4 | 180 |
| centro_civico | civic_centre | 32,6 | 320,4 | 180 |
| ensanche_ferroviario_oeste | industrial_edge | 24,7 | 183,1 | 218 |
| patios_del_este | industrial_edge | 24,84 | 183,1 | 216 |

Envelopes: `docs/urban-benchmark/envelopes-v1.json` (Fase 0, aprobados). La densidad usa aristas
únicas (una avenue no se cuenta dos veces); las intersecciones incluyen esquinas de borde que
continúan en el distrito vecino y los empalmes en T de las anclas. Las comparaciones se redondean a
dos decimales porque los envelopes están publicados así.

## Verificación ejecutada

- `pnpm lint` — verde (una advertencia de `console.log` en el gate, evidencia intencional).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **339** (13 skipped de harnesses), web **88**.
- `pnpm smoke:alpha` — verde con el fixture v2 migrado a parcelas multi-cell.
- `pnpm build` — verde.
- `pnpm fabric:gate` — PASS, 900 distritos, 81.266 parcelas.
- `pnpm road:benchmark` — PASS, derivación p95 3,21 ms, 300 distritos de barrido.
- `pnpm system:cost` — PASS; cierre mensual maduro p95 **34,62 ms** (V.d.0: 28,63 ms). Sigue por
  encima del presupuesto de D-065; es deuda declarada para V.d.2, no un gate de V.d.1.

## Deuda y riesgos

- **Cierre mensual fuera de presupuesto.** El aumento de parcelas multi-cell (≈90 por distrito,
  ~810 por ciudad) sube el cierre maduro de 28,63 a 34,62 ms p95. V.d.2 introduce índices derivados
  y debe re-medir antes de añadir sistemas.
- **Saves v2 pre-V.d.1.** Se rechazan por nombre; no se migran. Es una incompatibilidad de
  pre-release inherente al cambio de forma de `Parcel`; el slot no se borra automáticamente.
- **`zoning` y `buildingId` siguen en `Parcel`.** Se retiran en V.d.2 junto con los índices
  derivados; mantenerlos ahora evita un refactor de consumidores a medio camino.
- **Espacio público provisional.** Una manzana completa por distrito; V.d.3 sustituirá esta reserva
  por el programa municipal exacto y parcelas públicas con `disposition: public`.
- **Callejones como obstáculos.** No son vías y no cuentan para la densidad; si V.d.4 necesita
  frentes de servicio, deberá decidir una clase propia.
- **Reintentos y outliers.** El p95 cumple, pero el máximo del barrido fue 560,69 ms por un distrito
  que agotó intentos; el error identifica la seed y los issues.
- **Fixtures y goldens.** Regenerados deliberadamente: cambian geometría, precios, recuento de
  parcelas y escenarios económicos. La atribución está en los comentarios de `tick-conservation` y en
  el commit.

## Siguiente fase

V.d.2 — composición urbana y gameplay inmobiliario: roles por bloque, códigos y `allowedUses`,
refactor de `Parcel.buildingId` a índices derivados, huellas autocolocadas, housing por distrito y
empleo en puestos distritales, opinión municipal ponderada por población efectiva.
