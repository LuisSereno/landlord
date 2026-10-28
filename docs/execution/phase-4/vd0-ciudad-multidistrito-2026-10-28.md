# V.d.0 — Contrato urbano y ciudad multidistrito

- **Fecha:** 2026-10-28
- **Rama:** `develop`
- **Plan:** `PLAN_improvements.md` §5 "V.d.0"
- **ADRs ratificados:** D-087…D-092 (2026-10-28), en lo que reflejan el plan
- **Fase previa:** Fase 0 cerrada (`docs/execution/phase-4/fase-0-vd-baseline-2026-10-28.md`)

## 1. Qué se ha implementado

| Ítem del plan | Estado | Dónde |
| --- | --- | --- |
| 1. Tipos de la §3 en `@landlord/shared` | hecho | `packages/shared/src/urban.ts` (commit `33b6a9e`) |
| 2. `GameState` alrededor de `WorldState` | hecho | `packages/simulation/src/state.ts` (`world.city`, `world.gateways`, `world.districts`) |
| 3. `districtId` en agentes y estructuras técnicas | hecho | `Agent.districtId` y `TestStructure.districtId`, obligatorios en tipo y esquema |
| 4. `SnapshotV2`, protocolo v2, rechazo de v1 | hecho | `packages/shared/src/snapshot.ts`, `primitives.ts`, `worker-runtime.ts`, `indexed-db.ts` |
| 5. `CityProfile` y layout 3×3 | hecho | `packages/simulation/src/city.ts` (`ciudad_del_umbral_v1`) |
| 6. Seed derivada por distrito | hecho | `districtGenerationSeed` en `urban.ts`; `createCity` la aplica |
| 7. PRNG económico separado del de generación | se conserva | la generación usa su propio flujo (`deriveGenerationSeed`), el estado sigue con `state.prng` |
| 8. Conexiones y gateways | hecho | doce gateways (uno por par ortogonal), celdas de borde preferentemente de calzada, coste entero 4 |
| 9. `SetObservedDistrict` y `ViewProjectionV2` | hecho | petición técnica del Worker; proyección con `observedDistrictId` y `city.districts[9]` |
| 10. Vista React 3×3 | hecho | `apps/web/src/CityView.tsx` + aserciones en el smoke Alpha |
| 11. Phaser sólo dibuja el distrito observado | hecho | el adapter consume la proyección, que ya entrega sólo el distrito observado |
| 12. Traslado determinista de cuadrillas y agentes | hecho | `packages/simulation/src/transfers.ts` + `TransferCrew`/`TransferAgent` |

Detalles que el plan deja abiertos y aquí se han resuelto de forma explícita:

- **Bloques y espacios públicos** existen en `DistrictState` pero vacíos: los llena V.d.1 (manzanas) y
  V.d.3 (equipamientos). El contrato no cambia dos veces.
- **Renta por distrito**: en V.d.0 la proyección publica el índice municipal en los nueve resúmenes,
  declarado en el código; el índice distrital con fallback es V.d.2.
- **Traslados**: coste `TRANSFER_TICKS_PER_COST = 15` por unidad de coste de conexión, así que cruzar
  un gateway (coste 4) son 60 ticks = 1,2 h de juego. Sin coste monetario, como pide el plan.

## 2. Gate de V.d.0, criterio por criterio

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Misma seed ⇒ misma ciudad, gateways, IDs y nueve hashes | **PASS** | `city.test.ts`: nueve hashes distintos entre sí, idénticos al repetir la seed y distintos al cambiarla; gateways y conexiones idénticos byte a byte |
| Cambiar distrito observado no cambia el estado canónico | **PASS** | `worker-runtime.test.ts`: `canonicalizeState` antes y después del `SetObservedDistrict` es la misma cadena; el smoke comprueba además que la caja no se mueve |
| Save/load v2 devuelve la misma cadena canónica | **PASS** | `district-generation.test.ts`: round-trip de los nueve distritos, `serializeSnapshot(restored)` idéntico y `canonicalizeState` idéntico |
| Snapshots v1 fallan con mensaje comprensible | **PASS** | `parseSnapshotV2` lanza `UnsupportedSnapshotVersionError` con `UNSUPPORTED_SNAPSHOT_VERSION`; el Worker lo propaga; IndexedDB lista el slot como incompatible, se niega a cargarlo y lo borra sólo con `remove()` |
| Los nueve distritos avanzan simultáneamente | **PASS** (estructural + test) | un solo reloj y un solo bucle de tick sobre contenedores globales; `city.test.ts` comprueba que tras un día el estado canónico contiene los nueve distritos y una sola marca de tiempo |
| Ningún observable privado en los resúmenes | **PASS** | `projection.test.ts`: el bloque `city` no contiene caja, saldo, estrategia, memoria ni reserva; el smoke Alpha ya comprobaba que no aparece el razonamiento privado del rival |

## 3. Consecuencias medidas (y no maquilladas)

1. **Los perfiles de facción convergen.** Con el rival confinado a su distrito, el suelo de reserva
   de 2 500 domina al porcentaje de cada perfil y conservador/expansionista acaban iguales a los dos
   meses. La divergencia vuelve en V.d.2 con traslados y mercados distritales. El test de WP4.10 se
   ajustó a lo que hoy es cierto y la deuda queda aquí registrada.
2. **La opinión municipal se satura.** Se mide sobre nueve distritos y ocho no tienen stock construido
   en el escenario escalado, así que servicios, seguridad e impuestos se leen en su máximo y el
   gobierno no alterna. V.d.2 lo corrige con ponderación por población efectiva (§V.d.2.11).
3. **`centro_civico` no siempre generaba.** Una seed de cada doscientas agotaba los doce reintentos y
   tumbaba la ciudad entera. Se relajaron sus tolerancias (industrial 3→2, concentración 55 %→60 %) y
   ahora 400 seeds por perfil generan sin fallos. El total de parcelas del perfil pasa de 424 a 421 en
   el barrido de ocho seeds, con la razón anotada junto a la cifra.
4. **Rendimiento medido con el mundo nuevo.** Tick de referencia: p95 1,16–1,34 ms (antes
   1,00–1,12 ms; +15 %). Cierre mensual de 800 parcelas: p95 maduro **28,63 ms** (antes 26,76 ms;
   +7 %). Sigue por encima del presupuesto p95 de D-065 y sigue siendo el riesgo abierto número uno.
   Aviso metodológico: el harness inyecta las 800 parcelas sintéticas en **un** distrito y el resto
   de la ciudad sólo aporta su suelo generado, así que esta cifra **no** mide todavía nueve distritos
   densamente edificados; eso llegará cuando V.d.2 llene los nueve. El orden de remediación sigue
   siendo el de D-065/D-076: medir → optimizar exacto → re-medir → evaluar LOD.
5. **`canonicalizeState` cuesta 6,9 ms y 291 KB.** El harness `runScenario` lo ejecutaba en cada tick
   para detectar divergencias; ahora acepta `checkpointEvery` y los tests de conservación piden sólo
   el estado final. El tick de producto no cambia: 0,011 ms.

## 4. Fixtures y goldens regenerados (con atribución)

- **Los diez digestos dorados de conservación** (`tick-conservation.test.ts`): cambian por dos motivos
  declarados por separado. Superficie: el estado canónico gana `world` (ciudad, doce gateways, nueve
  mapas), que es función pura de la seed y que ningún sistema económico escribe. Economía: las
  parcelas ya no salen de un único distrito, así que el resultado económico cambia de verdad.
- **Fixture del smoke Alpha** (`scripts/fixtures/alpha-phase4.snapshot.json`): regenerado como v2 con
  el contenido original reubicado en el distrito del jugador. Su topología vial queda vacía a
  propósito: el fixture se creó antes de que las vías fuesen autoritativas e inventarlas habría sido
  ficción. El smoke pasa con el nuevo fixture.
- **Totales de frente vial por perfil** (`road-topology.test.ts`): `centro_civico` 424 → 421 por la
  relajación de tolerancias descrita arriba.

## 5. Deuda y siguientes pasos

- **Rendimiento**: medir `pnpm system:cost` y `pnpm benchmark` con el mundo nuevo antes de V.d.1.
- **Renta por distrito**: V.d.2, con el fallback de tres niveles de D-091.
- **Servicios espaciales**: V.d.5. Hoy la cobertura sigue siendo radial y municipal.
- **La IA no usa traslados todavía**: los comandos existen y son suyos por diseño, pero su planificador
  es de cadenas inmediatas; usarlos es V.d.2 (§V.d.2.13).
- **Bloques y espacios públicos vacíos** hasta V.d.1 y V.d.3.

## 6. Verificación reproducible

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
pnpm smoke:alpha     # incluye la vista de ciudad: 9 distritos y cambio de distrito sin mover caja
```
