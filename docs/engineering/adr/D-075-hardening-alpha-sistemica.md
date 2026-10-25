# D-075 — Hardening transversal de los sistemas Alpha (WP4.11-H)

Estado: aceptada el 2026-10-25 para el checkpoint **WP4.11-H**, no para WP4.12.
Baseline: `4374c97` (cierre de WP4.11), sin commits posteriores en `origin/main`.

## Contexto

Entre WP4.2 y WP4.11 cada paquete añadió un subsistema con su propia deuda declarada. La deuda se
documentó, pero no se pagó: el estado canónico seguía ciego a siete agregados, el censo electoral
incluía inquilinos sin contrato, el eje fiscal no veía la tasa de servicios y la UI no exponía dos
acciones que el dominio ya tenía. Este checkpoint corrige esa deuda transversal antes de añadir
complejidad nueva. No implementa WP4.12, ni macroshocks, ni LOD nuevo, ni perspectivas jugables.

## Decisiones

1. **Censo electoral = residentes efectivos.** `eligibleVoters(state)` exige `status === "contracted"`,
   `activeContractBuildingId !== null` y que el edificio exista. `available` y `displaced` no votan.
   Los desplazados siguen en el estado como memoria del hogar, pero no inflan el padrón ni la
   participación. Alternativa descartada: borrar al desplazado; destruiría la trazabilidad de la baja.
2. **La tasa de servicios entra en el ánimo fiscal sin doble cobro.** `taxesMood` suma
   `municipalServiceFee(state)` —la misma función pura que cobra el presupuesto— a la recaudación del
   periodo. No lee `revenueThisMonthBySource.serviceFee` porque `politics` cierra antes que
   `municipal` y ese acumulado siempre vale 0 en ese instante. Alternativa descartada: mover
   `municipal` delante de `politics`; rompería la semántica de "el vecino juzga el servicio que tuvo"
   y cambiaría el orden del contrato del tick.
3. **Estado canónico completo y estable.** `canonicalizeState` incluye `phase2.idCounters`,
   `pendingCommands`, `crews`, `incidents`, `employment`, `municipal`, `housingMarket`, `contracts`,
   `reputation`, `intelligence` y `factions`, además de lo que ya cubría. `balances`, `inventories` e
   influencia serializan su id; las claves de todo objeto anidado se ordenan recursivamente. Mapas y
   records se ordenan por id. Alternativa descartada: `JSON.stringify` directo; el orden de inserción
   hacía que un estado restaurado no coincidiera consigo mismo.
4. **Integridad referencial de snapshots hasta WP4.11.** `validateSnapshotReferences` valida
   adjudicatarios, ofertas, fiabilidad, reputación, observador y sujetos de inteligencia, perfiles,
   memoria, contadores y pares `observador>sujeto` de facciones. La validación semántica de partidos
   se hace en la capa de simulación al restaurar, para no hacer que `shared` importe `game-data.ts`.
5. **El benchmark mensual mide el cierre.** El warmup se ejecuta antes de colocar el reloj en la
   ventana: `measurementStartTick` deja la sección medida cruzando el múltiplo de mes. Una prueba
   automática exige que la ventana `month` cruce un cierre y que los sistemas mensuales se ejecuten
   dentro de la sección medida, no en el warmup.
6. **El razonamiento del rival no se proyecta.** `lastReason` y `lastAction` salen de la proyección;
   sólo queda la huella física (parcelas, edificios, ocupados), declarada `rival_footprint: public`.
   `rival_decision` queda `private` en `INFORMATION_POLICY`. La UI deja de mostrar la última decisión.
7. **Oferta pública e inteligencia jugables end-to-end.** El cliente expone `submitPublicBid` y
   `commissionIntelligence`; la UI presenta oferta con presupuesto, fianza y oferta actual, y encarga
   las cuatro clases de estimación con coste, cooldown, fuente, valor, precisión y antigüedad. La
   validación sigue siendo de la simulación; React no duplica reglas.
8. **Una ordenanza activa no se vuelve a sortear.** Si la ley vigente es la preferida del gobierno, el
   debate no la resuelve otra vez y se reprograma para su caducidad; si es otra, se pospone un mes. Una
   ley rechazada no ocupa la mesa.
9. **Una sola duración de ordenanza.** `MUNICIPAL_POLICY_DURATION_TICKS = GAME_MONTH_TICKS ×
   MUNICIPAL_TERM_MONTHS` sustituye al `24_000` mágico del lobby y al cálculo duplicado del concejo.
   La norma no caduca antes por el camino que la aprobó.
10. **Queja por desplazamiento normalizada.** `displacedShare = displaced / (contracted + displaced)`
    con `housingDisplacedWeight = 100` puntos a distrito entero desplazado; sin rama especial para cero
    hogares. Un desplazado pesa distinto en dos hogares que en doscientos.
11. **Las víctimas de un sabotaje tienen autor.** Nuevo hecho `violent_sabotage` (residentes −5,
    municipio −4, banca −2 por magnitud) que se registra además del `casualties` del propietario cuando
    el incidente atribuye el daño a otra organización. No hay doble penalización si atacante = dueño.
12. **La banca es neutral ante desalojos.** `households_displaced` deja de dar +1 a la banca: sin
    decaimiento, desahuciar repetidamente construía un descuento permanente del préstamo. Alternativa
    descartada: mantener el +1 sólo con mejora de solvencia; no hay señal que lo demuestre en Alpha.
13. **CI de `main` completamente verde.** Se corrigen los cuatro ficheros históricos de formato y se
    excluye `blender_artist/toolchain/**` del lint por ser toolchain Python vendorizado con demos JS
    de terceros. Se añade un smoke Alpha determinista con fixture; no sustituye al de Gate 2.
14. **La documentación deja de sobreafirmar WP4.10.** El expediente de inteligencia de las facciones y
    las facciones autónomas múltiples quedan `DEFERRED`; WP4.9 no promete que WP4.10 los resolvería.

## Consecuencias

- El estado canónico es más caro de serializar. La campaña de dos años subió de ~2,6 s a ~5 s en el
  entorno de pruebas y necesita timeout explícito; no cambia ningún resultado.
- El cierre mensual de 800 parcelas domina el coste: `housing` 28,0 ms de los 28,4 ms del tick de
  cierre (42,8 ms instrumentado). La ventana `month` cruza por primera vez el presupuesto p95 de
  10 ms y el disparador de revisión de 5 ms de D-065, aunque el máximo queda por debajo del límite
  duro de 50 ms. **No se implementa LOD** (fuera de alcance de este checkpoint): se registra como
  deuda medida y se recomienda una optimización específica de `runHousingMarket` antes de WP4.13.
- La proyección pierde la "última decisión rival": es una pérdida deliberada de información gratuita.
  Quien quiera leer al rival debe pagar el expediente o inferirlo de su conducta.
- El censo más pequeño hace que los distritos monocultivo barran 9-0 con más facilidad. Se mantiene:
  es el resultado real de un electorado sin diversidad; el tuning de segmentos queda como deuda.

## Evidencia

`docs/execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md`; pruebas
`municipal-politics.test.ts` (censo, eje fiscal, ordenanza, duración, vivienda),
`canonical-state.test.ts`, `snapshot-integrity.test.ts`, `reputation.test.ts`,
`system-cost.test.ts`, `information.test.ts`, `phase4-integration.test.ts`,
`alpha-actions-runtime.test.ts`; smoke `scripts/alpha-browser-smoke.mjs`.
