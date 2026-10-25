# D-079 — Herramientas internas, invariantes y dataset de balance versionado

Estado: aceptada el 2026-10-25 para WP4.14. No añade gameplay: entrega instrumentos de desarrollo y
medición reproducible para que los WPs de contenido no se acepten por impresión.

## Contexto

La Fase 4 acumula sistemas económicos (vivienda, empleo, presupuesto, contratos, reputación,
información, facciones, política, macroeventos y delegación) y sólo el coste del tick tenía un arnés
propio. Faltaba una lectura de balance comparable entre commits, un detector de invariantes y una
validación explícita de los catálogos data-driven. WP4.14 los añade sin abrir UI de desarrollo.

## Decisiones

1. **Las herramientas son arneses opt-in y scripts, no una pantalla de desarrollo.** El repositorio
   ya usa tests opt-in para district, coste del tick, soak y auditoría del Worker. Se mantiene ese
   patrón: `pnpm balance:campaign` (campaña), `pnpm state:inspect` (inspector de estado) y
   `node scripts/build-balance-dataset.mjs` (pipeline de dataset). No se introduce un editor visual
   de datos: el validador es una prueba que corre en CI.

2. **`measureBalance` mide seis familias y no decide nada.** Quiebras (préstamos impagados,
   organizaciones afectadas, subastas abiertas), vacancia (plazas, porcentaje, llegadas, salidas y
   movilidad total), concentración (cuota de la mayor organización, HHI de parcelas y de edificios),
   deuda (principal vivo y atrasos fiscales), presupuesto (reserva municipal, meses en déficit,
   ingresos, gasto y niveles de servicio) y una fila por organización. Es estado derivado: no entra
   en `GameState`, snapshot ni proyección.

3. **`detectInvariantViolations` es la lista de lo que la simulación no puede romper.** Cajas e
   inventarios no negativos y sin exceso de capacidad, contratos coherentes en ambos sentidos
   (edificio↔inquilino), referencias parcela↔edificio, principal y meses de préstamo en rango,
   umbrales de automatización válidos, intervalos e intensidad de macroeventos y niveles de servicio
   0–100. La campaña falla si aparece una sola violación; los tests plantan cada rotura para probar
   que el detector no es decorativo.

4. **Validador de catálogos.** Una prueba permanente comprueba que los edificios declaran costes,
   obra, capacidad, zoning y recursos coherentes; que los segmentos de vivienda apuntan a tipos
   existentes; que las ordenanzas y partidos tienen ids únicos y rangos válidos; que los partidos
   suman los escaños del concejo; que los macroeventos cubren los seis tipos con etiqueta y duración
   positiva; que los perfiles de facción cubren todas las familias; que los perfiles de distrito
   caben en 64×64 y declaran el zoning completo; y que las políticas numéricas conservan sus bandas.

5. **Campaña con seeds registradas y dataset versionado.** `alpha-baseline-v1.json` fija 8 semillas,
   12 meses, 200 parcelas y cuatro estrategias (pasivo, mantenimiento equilibrado, delegación con
   mantenimiento diferido y delegación con mantenimiento equilibrado). El dataset incluye filas por
   semilla, agregados, comparaciones por parejas y banderas de balance. El test regular valida el
   esquema, recalcula cada comparación desde las filas y exige cero invariantes rotas; el pipeline
   `scripts/build-balance-dataset.mjs` reproduce el archivo desde la salida cruda.

6. **Resultado de la baseline, registrado sin maquillar.** La delegación con mantenimiento diferido
   gana caja a la estrategia pasiva en 8/8 semillas y elimina la vacancia medida. El mantenimiento
   equilibrado pierde caja en 8/8 frente a la pasiva porque sube condición, renta y vacancia
   (31,84 % frente a 3,13 %) y además cuesta: se registra la bandera
   `maintenance_balanced_dominated_on_cash`. WP4.14 entrega la detección; corregir el balance es
   tuning posterior y no se mezcla con las herramientas.

## Consecuencias

- Cualquier cambio económico puede compararse contra `alpha-baseline-v1` con las mismas seeds.
- Un catálogo roto (zona inexistente, escaños que no suman, duración cero) rompe CI antes de llegar
  a la partida.
- Las decisiones de LOD siguen pendientes de D-065: el dataset no sustituye la medición de coste.
- El hallazgo de mantenimiento queda como deuda de balance en `ai-context/KNOWN-GAPS.md`; ningún
  número de gameplay se ajusta en este WP.

## Nota de revisión (2026-10-25) — el dataset de WP4.14 medía carga, no balance

Una auditoría externa del WP4.14 señaló que la decisión 5 entregó como baseline de balance un mundo que
la decisión 1 ya describía como arnés: `createScaledCity(seed, { parcelCount: 200 })` inyecta
`HARNESS_BALANCE = 5 000 000` de caja al jugador y al rival, `HARNESS_INVENTORY_CAPACITY = 1 000 000` y
regala parcelas, edificios, fábricas, inquilinos con contrato, préstamos, cuadrillas y agentes que el
jugador nunca compró ni construyó. `system-cost.ts` ya lo documentaba: la ciudad sintética es carga, no
balance. Las consecuencias invalidan la lectura de la decisión 6, no las herramientas: con cinco
millones iniciales `financeCashFloor = 2000` no se activa nunca, la vacancia y la movilidad las domina
la ocupación automática de una cartera ya montada, las estrategias no despachan un solo comando (la
campaña asignaba `state.phase2.maintenance.policy` y `state.phase2.automation.*` directamente) y las
cajas finales del jugador quedan en 4,8–5,0 millones, el entorno del regalo inicial. En la partida real
se arranca con `parseMoney(12000)`.

**Qué queda firme.** `measureBalance`, `detectInvariantViolations`, el validador de catálogos y el
inspector de estado: nada de eso dependía del mundo elegido, y el arnés sigue siendo el único que los
somete a 200 parcelas. Tampoco cambia la regla de que la campaña falla ante una sola invariante rota.

**Qué se corrige.**

1. **El dataset se renombra y se etiqueta por lo que es.** `docs/balance/alpha-baseline-v1.json` pasa a
   `docs/balance/synthetic-city-balance-v1.json` con `worldKind: "synthetic_load_harness"` y un campo
   `usage` que declara dentro del propio archivo que no es balance de gameplay y remite a la baseline
   jugable. La campaña sintética no se borra: se conserva como test de esfuerzo. Regenerada con su
   pipeline real, las 32 filas coinciden exactamente con las publicadas sobre `f33c698`.

2. **Se añade la campaña jugable que faltaba.** `packages/simulation/src/balance-playable.test.ts`
   (`pnpm balance:playable`, opt-in con `PLAYABLE_BALANCE_CAMPAIGN=1`) arranca de
   `createInitialState(seed)` —distrito generado, 12 000 de caja, inventario y cuadrillas autoradas— y
   ejecuta cada estrategia **sólo mediante comandos reales** despachados con `dispatchProductCommand`
   como `person_00000001` / `PLAYER_ORGANIZATION_ID`. Las cuatro políticas se fijan con
   `SetMaintenancePolicy` y `SetAutomationPolicy`; queda prohibido mutar `state.phase2.*` para dar
   ventajas y ninguna estrategia se salta validaciones ni obtiene recursos gratis. Comparten una rutina
   de crecimiento idéntica —cerrar el ciclo de expansión más barato: parcela asequible → materiales →
   permiso → obra → cuadrilla, un ciclo por día de juego mientras la caja cubra el coste exacto— para
   que la diferencia mida la política y no la habilidad del script. 16 semillas × 12 meses × 4
   estrategias, 62-68 s reales en dos ejecuciones. Determinismo: se repite una semilla por
   estrategia y se exige el mismo resultado byte a byte, más una prueba permanente que repite
   `delegated_deferred` con la semilla 3.

3. **La campaña audita sus propios comandos.** `playable-alpha-balance-v1.json` publica `commandAudit`
   por estrategia y tipo con aceptados, rechazados y códigos de rechazo, y el test exige que toda
   estrategia haya comprado suelo y abierto obra: una estrategia que no actúa es un fallo del diseño de
   la campaña, no un resultado. En las 64 campañas se aceptaron 262 `BuyParcel`, 262 `RequestPermit`,
   262 `StartConstruction`, 262 `AssignCrewToWorkOrder` y 338 `BuyMaterials`, con cero rechazos.

4. **`scripts/build-balance-dataset.mjs` genera los dos datasets** (`--dataset synthetic|playable`, o
   deducido del marcador de la salida) y `balance-dataset.test.ts` valida los dos archivos versionados:
   ids, filas, comparaciones recalculadas desde las filas, banderas, coherencia del bloque de dominancia
   y auditoría de comandos.

**La decisión 6 queda rebajada.** "El mantenimiento equilibrado pierde caja en 8/8 y se registra la
bandera `maintenance_balanced_dominated_on_cash`" describe el arnés de carga, no el juego, y pasa a
**señal fuerte para investigar**. En la campaña jugable `maintained` gana a `passive` en 4 de 16
semillas (pierde en 12), lejos del umbral de dominancia de 15/16, y convierte el gasto en activos: 4,00
edificios frente a 3,13 y 15 712,56 de valor de catálogo frente a 12 375,31. Del mismo modo, el 8/8 de
la delegación con mantenimiento diferido no se traslada a la partida: 6/16. **Ninguna estrategia domina
en la campaña jugable** (ganadoras por semilla: `passive` 8, `delegated_deferred` 5, `maintained` 2,
`delegated_balanced` 1), y el dataset lo declara explícitamente con `dominance.anyDominant: false` y las
banderas `no_dominant_strategy_in_playable_campaign`,
`maintenance_balanced_cash_signal_to_investigate` y
`automation_deferred_has_no_cash_advantage_playable`. Se añade una cautela de método que el arnés
ocultaba: con una rutina que reinvierte todo lo que puede, la caja final no es riqueza —
`delegated_balanced` es la peor en caja (1 253,56) y la mejor en valor de catálogo (19 431,88)—, así que
ninguna comparación sobre `playerCash` se lee sin `playerParcels`, `playerBuildings` y
`playerAssetBookValue`.

Sigue sin ajustarse ningún número de gameplay: esta revisión entrega una medición que sostiene o
desmiente los hallazgos, no un rebalanceo. Ver `docs/balance/README.md`,
`docs/execution/phase-4/wp4-14-internal-tools-2026-10-25.md` (nota de revisión) y
`ai-context/KNOWN-GAPS.md`.
