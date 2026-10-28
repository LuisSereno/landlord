# V.d.0 — punto de traspaso: estado, parche en curso y siguiente paso

- **Fecha:** 2026-10-28
- **Rama:** `develop`, verde en el commit que contiene este documento
- **Plan autoritativo:** `PLAN_improvements.md` (§5, V.d.0)
- **Decisión de arquitectura:** D-087…D-092, ratificadas por el responsable el 2026-10-28 en lo que
  reflejan el plan; las adiciones propias están listadas al final de cada ADR
- **Lectura previa obligatoria:** `ai-context/PROJECT-STATE.md`, `ai-context/DECISIONS.md` y
  `docs/execution/phase-4/fase-0-vd-baseline-2026-10-28.md`

Este documento existe para que otra persona u otro agente continúe V.d.0 sin reconstruir el contexto.
Dice qué está commiteado, qué está a medias y por qué, y cuál es el siguiente movimiento.

## 1. Lo que ya está en `develop`

| Commit | Contenido |
| --- | --- |
| `4a4e7b4` | Fase 0: acta de baseline, seis ADRs, herramienta `tools/urban-benchmark`, corrección del smoke Alpha |
| `e7683e0` | La herramienta deja de fijar Overpass a una IP que rechaza conexiones |
| `33b6a9e` | Contratos urbanos en `packages/shared/src/urban.ts` (paso 1 de V.d.0) |
| `6e44198` | Fuente offline del benchmark: extractos regionales de Geofabrik + tres correcciones de medición |
| `cfbe300` | Corpus de 28 ventanas, envelopes y provenance |
| `3000e93` | Guarda de arquitectura: el runtime no puede importar la herramienta |
| `f900d02`, `3609eaa` | Cierre documental de la Fase 0 |
| `6c70f3d` | Capa de ciudad: nueve distritos, seed por distrito, gateways y conexiones (paso 2 de V.d.0) |

**Fase 0 está cerrada.** Los cuatro criterios del gate están verdes; los envelopes fueron aprobados
explícitamente por el responsable el 2026-10-28.

`packages/simulation/src/city.ts` ya genera la ciudad completa y tiene ocho tests propios:
nueve distritos con los nombres autorados de §4.1, doce gateways (uno por par ortogonalmente
adyacente) sobre celdas de borde y preferentemente de calzada, doce conexiones con coste entero,
identidad de gateway independiente del orden de consulta, ids de parcela únicos en la ciudad y
determinismo por seed. Cuarenta seeds de ciudad × 9 distritos generan sin fallos.

## 2. Lo que está a medias y **no** está commiteado

La reestructuración de `GameState` alrededor de `WorldState` está escrita y **compila limpia en los
tres paquetes**, pero deja 58 tests en rojo, así que no se commiteó: `develop` se restauró a verde y
el trabajo se conservó como parche.

```bash
git apply docs/execution/phase-4/vd0-worldstate-wip.patch
git apply --check docs/execution/phase-4/vd0-worldstate-wip.patch   # sólo comprobar
```

El parche se generó contra `6c70f3d`. **Bórralo del repositorio en cuanto se aplique y se cierre
V.d.0**: es andamio, no un artefacto que deba envejecer en `docs/`.

### Qué hace el parche

- `GameState.world: WorldState` sustituye a `GameState.map`; `Phase2State.district` desaparece.
  `DistrictState = { district, map, blocks, publicSpaces }` con accesores `districtStateOf`,
  `districtMapOf`, `blockedCellsOf`.
- `Agent.districtId` y `TestStructure.districtId` pasan a obligatorios en tipo **y** en esquema Zod;
  `PlaceTestStructure.payload` lleva `districtId`.
- Códigos de error nuevos: `DISTRICT_NOT_FOUND`, `AGENT_NOT_IN_DISTRICT`,
  `UNSUPPORTED_SNAPSHOT_VERSION`, con su mensaje en `worker-runtime.ts`.
- Regla de presencia: asignar cuadrilla a una obra, mantener y sabotear/atacar **rechazan** si el
  agente no está en el distrito del objetivo. No hay teletransporte implícito.
- `SnapshotV2`: `schemaVersion` y `protocolVersion` son el literal `2`; el mundo (ciudad, gateways y
  los nueve distritos con su propio mapa) se serializa en orden canónico de slots; se eliminan el
  backfill vial de v1 y la duplicación de `workRequired` de las obras antiguas; `parseSnapshotV2`
  lanza `UnsupportedSnapshotVersionError` por nombre antes de cualquier diff de esquema.
- `canonicalizeState` emite `world` ordenado por id de distrito, nunca por orden de inserción.
- IndexedDB separa versión de base y versión de esquema, lista los slots v1 como
  `compatible: false`, se niega a cargarlos con mensaje comprensible y gana `remove(slotId)` para el
  borrado explícito.
- La proyección lee el distrito observado (por defecto el del roster del jugador).
- El harness `system-cost` inyecta su carga sintética en un solo distrito y usa su propio bloque de
  ordinales de parcela (9 000 000+) para no colisionar con los generados.
- `parcelOrdinalBlock` da el bloque 0 al distrito del roster del jugador, de modo que
  `parcel_00000001…` sigue significando "el barrio del jugador". **Ese único cambio bajó los fallos
  de 74 a 58**; conviene conservarlo.

### Qué falta para cerrar V.d.0

Cincuenta y ocho tests en rojo, todos en `packages/simulation`:

| Fichero | Fallos | Causa |
| --- | ---: | --- |
| `snapshot-integrity.test.ts` | 12 | un constructor de fixtures compartido sigue emitiendo `phase2.district` y no `world` |
| `phase2.test.ts` | 11 | precios y saldos fijos del distrito único anterior a V.d |
| `snapshot.test.ts` | 4 | fixtures con forma v1 |
| `canonical-state.test.ts` | 4 | digestos dorados: `world` es una superficie canónica nueva |
| `municipal-politics.test.ts`, `factions.test.ts` | 6 | ponderación de población y contactos territoriales sobre nueve distritos |
| resto (reputation, macro-events, housing, employment, automation, district-generation, worker-runtime, tick-conservation, projection, wp2_15, vc1-projection…) | 21 | expectativas numéricas y algunos fixtures v1 |

Los dos constructores de fixtures (`snapshot-integrity`, `snapshot.test`) son la palanca más rentable:
arreglarlos debería limpiar ~16 fallos de golpe. El resto es regeneración de expectativas, que según
D-075 y D-089 **debe atribuirse**: cambio de superficie (nuevo bloque canónico) frente a cambio
económico (nueve distritos de verdad tienen precios distintos). No regenerar a ciegas.

### Ítems de V.d.0 sin empezar

Los puntos 9 a 12 del plan:

- `ViewProjectionV2` con resumen de ciudad, nueve resúmenes distritales y cartera por distrito;
- `SetObservedDistrict` como petición técnica del Worker (no comando de dominio, no persistida);
- vista React 3×3 con nombre, roles, renta, vacancia, valor, servicios, activos y alertas;
- Phaser renderizando sólo el distrito observado;
- `TransferCrew` y `TransferAgent` con duración determinista sobre el grafo de ciudad.

### Gate de V.d.0 (ningún criterio se puede firmar todavía)

- misma seed produce la misma ciudad, gateways, ids y nueve hashes;
- cambiar el distrito observado no cambia el estado canónico;
- save/load v2 devuelve la misma cadena canónica;
- los snapshots v1 fallan con mensaje comprensible;
- los nueve distritos avanzan simultáneamente;
- ningún observable privado aparece en resúmenes.

## 3. Invariantes que no se negocian al continuar

1. La simulación no importa Phaser, React ni DOM; `scripts/check-architecture.mjs` lo vigila y
   además prohíbe que el runtime toque `tools/urban-benchmark`.
2. Nada de `Math.random` en dominio: PRNG derivado y separado del económico (D-048, D-064).
3. Aritmética entera en reglas autoritativas.
4. Orden canónico por geometría o por id, nunca por orden de inserción de `Map` (D-075, D-089).
5. Los índices derivados se recalculan, no se persisten (D-090).
6. Un golden que cambia se justifica en el commit: superficie o economía.
7. Commits pequeños en el orden de §7 del plan; no mezclar esquema, tuning económico y regeneración
   de goldens.
8. `develop` sólo recibe commits con la suite verde.

## 4. Comandos de verificación

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
pnpm smoke:alpha            # navegador real; tardaba ~60 s
pnpm road:benchmark         # presupuesto D-085: p95 de derivación 4,89 ms
pnpm system:cost            # cierre mensual maduro p95 26,76 ms, ya fuera del presupuesto D-065
pnpm balance:playable       # 16 semillas × 12 meses × 4 estrategias, ~70 s
```

Riesgo de rendimiento registrado: el cierre mensual ya supera el presupuesto p95 de D-065 **con un
distrito**. V.d.0 multiplica por nueve el trabajo del tick, así que `pnpm system:cost` debe medirse
otra vez en cuanto `WorldState` aterrice, y si cruza el disparador se aplica el orden de D-065/D-076:
medir → optimizar exacto → re-medir → sólo entonces evaluar LOD.
