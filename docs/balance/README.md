# Datasets de balance

Resultados de campañas headless con seeds registradas, comparables entre commits y versionados en Git.
Hay **dos datasets y no son intercambiables**: uno mide una partida real y el otro mide carga.

| Dataset | Mundo | Caja inicial | Para qué sirve |
|---|---|---:|---|
| `playable-alpha-baseline-v1.json` | `createInitialState(seed)`: distrito generado, posición legítima | 12 000 | Baseline de **balance de gameplay**: comparar políticas con decisiones alcanzables desde el juego. |
| `synthetic-city-balance-v1.json` | `createScaledCity(seed, { parcelCount: 200 })`: arnés de carga | 5 000 000 | **Test de esfuerzo**: invariantes y degradación bajo volumen. No es una baseline de balance. |

El esquema de los dos está validado por `packages/simulation/src/balance-dataset.test.ts`, que recalcula
cada comparación desde las filas y exige cero invariantes rotas. Ningún número se edita a mano: los
produce la campaña y los vuelca `scripts/build-balance-dataset.mjs`.

## playable-alpha-baseline-v1.json

- Motor: commit `8f9b323`.
- Campaña: `pnpm balance:playable` (`packages/simulation/src/balance-playable.test.ts`, opt-in con
  `PLAYABLE_BALANCE_CAMPAIGN=1`).
- Semillas: `[1..16]`, cada una con su distrito generado (`barrio_del_umbral`, entre 18 y 36 parcelas).
- Duración: 12 meses de juego (`GAME_MONTH_TICKS`) por semilla y estrategia.
- Tiempo real medido: **62-68 s** en dos ejecuciones para las 64 campañas más las 4 repeticiones de
  determinismo (portátil de desarrollo, Node 24). Muy por debajo del techo de 10 minutos.
- Posición inicial: la legítima de `createInitialState`, 12 000 de caja, inventario autorado
  (8 cemento / 16 ladrillo / 6 acero, capacidad 40) y dos cuadrillas. Nada se regala.

### Cómo actúa cada estrategia

Todo pasa por `dispatchProductCommand` como `person_00000001` / `PLAYER_ORGANIZATION_ID`. La campaña no
muta `state.phase2.*` para dar ventajas: las cuatro políticas se fijan con `SetMaintenancePolicy` y
`SetAutomationPolicy`, que son los comandos que usaría la interfaz.

- Rutina de crecimiento **común e idéntica** para las cuatro: cerrar el ciclo de expansión más barato
  (terminar lo ya poseído antes de comprar suelo nuevo) —`BuyParcel` si la parcela no es propia,
  `BuyMaterials` para lo que falte, `RequestPermit`, `StartConstruction`, `AllocateCrew`,
  `AssignCrewToWorkOrder`—, un ciclo por día de juego y sólo mientras la caja cubra el coste exacto
  calculado con los mismos modificadores que aplican los comandos. Ni ocupa plazas, ni repara, ni pide
  préstamos: eso es justamente la política que se compara.
- `passive`: mantenimiento diferido, gestores en manual.
- `maintained`: mantenimiento equilibrado, gestores en manual.
- `delegated_deferred`: mantenimiento diferido, gestor de propiedad y de finanzas activos.
- `delegated_balanced`: mantenimiento equilibrado, gestores activos y reparación bajo 40 %.
- `financeCashFloor` se fija en 2 000 en las cuatro, que aquí sí es vinculante: la caja media final
  está entre 1 254 y 3 433.

### Auditoría de comandos

El dataset publica `commandAudit` por estrategia y tipo, con aceptados, rechazados y códigos de
rechazo, además de `acceptedCommands`/`rejectedCommands` por fila. En las 64 campañas se aceptaron 262
`BuyParcel`, 262 `RequestPermit`, 262 `StartConstruction`, 262 `AssignCrewToWorkOrder` y 338
`BuyMaterials`, con **cero rechazos**: ninguna estrategia quedó bloqueada en silencio. El test exige
que toda estrategia haya comprado suelo y abierto obra.

### Resultados

Media de las 16 semillas:

| Estrategia | Caja final | Deuda del jugador | Vacancia | Movilidad | Parcelas | Edificios | Valor de catálogo | Reserva municipal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `passive` | 3 433,38 | 0 | 6,25 % | 12,25 | 3,25 | 3,13 | 12 375,31 | 438,56 |
| `maintained` | 1 657,69 | 0 | 15,63 % | 13,50 | 4,00 | 4,00 | 15 712,56 | 67,19 |
| `delegated_deferred` | 3 168,00 | 500 | 0,00 % | 8,13 | 4,19 | 4,00 | 15 896,44 | 357,44 |
| `delegated_balanced` | 1 253,56 | 500 | 18,75 % | 9,31 | 4,94 | 4,94 | 19 431,88 | 110,69 |

Comparaciones por parejas sobre caja final (umbral de dominancia: 15 de 16 semillas):

- `delegated_deferred` contra `passive`: **6/16**. No domina.
- `maintained` contra `passive`: **4/16**. No domina.
- `delegated_balanced` contra `delegated_deferred`: **3/16**. No domina.

Ganadoras por semilla (mejor caja final): `passive` 8, `delegated_deferred` 5, `maintained` 2,
`delegated_balanced` 1.

### Lectura

- **Ninguna estrategia domina.** Con 12 000 de caja las cuatro terminan vivas, sin préstamos impagados
  y sin invariantes rotas, y el reparto de victorias es disperso. El dataset lo declara en
  `dominance.anyDominant: false` y con la bandera `no_dominant_strategy_in_playable_campaign`.
- **La caja final no es riqueza.** La rutina de crecimiento reinvierte todo lo que puede, así que una
  estrategia que ingresa más termina a menudo con menos caja y más activos: `delegated_balanced` es la
  peor en caja (1 253,56) y la mejor en valor de catálogo (19 431,88) y en edificios (4,94). Cualquier
  afirmación de dominancia hecha sólo sobre `playerCash` es incompleta; léase junto a `playerParcels`,
  `playerBuildings` y `playerAssetBookValue`.
- **El mantenimiento equilibrado es una señal fuerte para investigar, no una estrategia dominada.**
  `maintained` pierde caja contra `passive` en 12 de 16 semillas (4 victorias), por debajo del umbral de
  dominancia, y su contrapartida es más suelo, más edificios y más valor de catálogo. La bandera es
  `maintenance_balanced_cash_signal_to_investigate`.
- **La delegación no compra caja por sí sola.** `delegated_deferred` gana a `passive` en 6 de 16 y
  termina con 500 de deuda viva frente a 0; sí elimina la vacancia medida (0 % frente a 6,25 %), porque
  el gestor de propiedad coloca los hogares autorados que el mercado no instala solo. Bandera
  `automation_deferred_has_no_cash_advantage_playable`.
- **Determinismo:** la campaña repite la semilla 1 de cada estrategia y exige el mismo resultado byte a
  byte; hay además una prueba permanente que repite `delegated_deferred` con la semilla 3.

### Regenerar

```bash
pnpm balance:playable > /tmp/balance-playable.log
BALANCE_COMMIT=$(git rev-parse --short HEAD) \
  node scripts/build-balance-dataset.mjs /tmp/balance-playable.log \
  docs/balance/playable-alpha-baseline-v1.json --dataset playable
pnpm vitest run packages/simulation/src/balance-dataset.test.ts
```

## synthetic-city-balance-v1.json

- Motor: commit `8f9b323`. Las cifras reproducen exactamente la baseline publicada en WP4.13
  (`f33c698`): la campaña sintética no se movió.
- Campaña: `pnpm balance:campaign` (`packages/simulation/src/balance.test.ts`, opt-in con
  `BALANCE_CAMPAIGN=1`).
- Semillas: `[1, 2, 3, 4, 5, 6, 7, 8]`, 12 meses, ciudad sintética de 200 parcelas.
- Tiempo real medido: **161 s** para las 32 campañas.

### Por qué no es una baseline de balance

El mundo viene de `createScaledCity` (`packages/simulation/src/system-cost.ts`), que el propio módulo
documenta como carga: inyecta `HARNESS_BALANCE = 5 000 000` de caja al jugador y al rival,
`HARNESS_INVENTORY_CAPACITY = 1 000 000` y regala parcelas, edificios, fábricas, inquilinos con
contrato, préstamos, cuadrillas y agentes que el jugador nunca compró ni construyó. Consecuencias:

- Con 5 millones iniciales `financeCashFloor = 2000` no llega a activarse nunca: el gestor financiero
  no decide nada.
- La vacancia y la movilidad las domina la ocupación automática de una cartera ya montada, no la
  política completa de la jugadora.
- Las estrategias no ejecutan comandos: la campaña sintética asigna `state.phase2.maintenance.policy` y
  `state.phase2.automation.*` directamente.
- Las cajas finales del jugador quedan en 4,8–5,0 millones, es decir, en el entorno del regalo inicial.

Sigue siendo útil, y por eso se conserva: es el único arnés que somete `measureBalance` y
`detectInvariantViolations` a una ciudad de 200 parcelas con toda su cartera de edificios, inquilinos,
préstamos, cuadrillas y agentes, y detecta invariantes rotas y degradación bajo volumen.

### Resultados

Media de las 8 semillas:

| Estrategia | Caja del jugador | Vacancia | Movilidad | Reserva municipal |
|---|---:|---:|---:|---:|
| `passive` | 4 925 564 | 3,13 % | 31,75 | 29 531 |
| `maintained` | 4 819 490 | 31,84 % | 103,63 | 26 832 |
| `delegated_deferred` | 4 933 734 | 0,00 % | 44,88 | 29 703 |
| `delegated_balanced` | 4 860 000 | 15,83 % | 135,25 | 27 553 |

- `delegated_deferred` gana a `passive` en caja en 8/8 semillas y elimina la vacancia medida. Bajo
  carga, delegar la ocupación de una cartera regalada rinde; **no** se sigue de ahí que delegar rinda
  en una partida real (en la campaña jugable son 6/16).
- `maintained` pierde contra `passive` en 8/8 y la bandera
  `maintenance_balanced_dominated_on_cash` sigue en el archivo por trazabilidad. **Esa bandera describe
  el arnés de carga, no el juego**: se mantiene como señal fuerte para investigar y no como dominancia.
  En la campaña jugable la misma pareja queda 4/16.
- Sin invariantes rotas en ninguna de las 32 campañas (`violations: []`), que es lo que este dataset
  existe para vigilar.

### Regenerar

```bash
pnpm balance:campaign > /tmp/balance-campaign.log
BALANCE_COMMIT=$(git rev-parse --short HEAD) \
  node scripts/build-balance-dataset.mjs /tmp/balance-campaign.log \
  docs/balance/synthetic-city-balance-v1.json --dataset synthetic
pnpm vitest run packages/simulation/src/balance-dataset.test.ts
```

Las dos campañas son deterministas para las mismas seeds y el mismo commit; los datasets deben
coincidir salvo `generatedAt`. Si una salida contiene las dos campañas a la vez, `--dataset` es
obligatorio.
