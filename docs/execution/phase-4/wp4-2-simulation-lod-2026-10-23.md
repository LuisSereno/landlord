# WP4.2 — Simulation LOD — 2026-10-23

## Estado

`DONE` con LOD agregado deliberadamente latente. El coste del tick se mide por sistema y escala, el
crecimiento de barrio a ciudad es sublineal y ninguna optimización cambia el estado resultante.
Decisión registrada en `docs/engineering/adr/D-065-coste-del-tick-y-lod-latente.md`.

## Resultado

- Los diez sistemas del tick pasan a ser entidades nombradas: `PRODUCT_SYSTEMS` y
  `advanceProductSystems` son la única fuente del orden de ejecución (D-060) y la unidad de
  instrumentación. Nombres estables: `tactical`, `production`, `rent`, `debt`, `auctions`,
  `propertyTax`, `maintenance`, `insurance`, `policy`, `rival`.
- Harness de coste por sistema y escala (`pnpm system:cost`): ciudad sintética en tres tamaños
  (barrio, distrito, ciudad) y tres ventanas (día completo, cierre mensual y cascada de incendios),
  con distribución media/p50/p95/p99/máximo por sistema y curva de crecimiento entre escalas.
- La ciudad sintética es carga, no balance: saldos e inventarios se amplían para que ningún límite
  económico recorte el camino medido. Se genera con un PRNG propio derivado de la seed, así que
  `state.prng` queda intacto y la partida sigue siendo la misma; hay prueba siempre activa que lo
  verifica.
- La instrumentación no falsea la medición: el bucle que cronometra sistema a sistema replica
  `advanceProductSystems` y una prueba comprueba que produce exactamente el mismo estado canónico.
- Guarda de conservación económica por diez digestos dorados: escenarios seed 1/7/42 a 1200 ticks,
  seed 1 a 36000 ticks (un mes de juego), ciudad sintética estable, dos cruces mensuales y tres
  cascadas de incendio que llegan a 37, 135 y 463 edificios en ruina con 150, 544 y 1938 bajas.
- Cinco costes algorítmicos corregidos con transformaciones exactas (índices y salidas anticipadas),
  sin ninguna aproximación: `tacticalTick` salía de los ticks sin trabajo y recorría las etapas
  horarias completas, el paso de técnicos era O(edificios × agentes) y copiaba la tabla de
  incidentes dentro del bucle por edificio, la ignición mensual era O(edificios × incidentes),
  `settleInsurance` ordenaba toda la cartera en cada tick y `settleAuctions` ordenaba una lista
  vacía.
- Verificación diferencial contra la implementación anterior: cuatro escenarios (50, 200 y 800
  parcelas con cascada de incendios, más 800 parcelas en régimen estable) producen el mismo digesto
  con el código anterior y con el nuevo.
- **No se introduce estado agregado.** Ningún sistema excede ningún umbral en la ciudad máxima
  factible, así que la regla del propio WP ("implementar sólo para los sistemas que excedan
  budgets") deja el LOD en diseño documentado con disparadores objetivos, no en código.
- Diseño de zonas registrado en D-065 y derivado del estado de la simulación, nunca de la cámara:
  activa (obra, incidente, agente con tarea, contrato vigente, subasta o mora), cercana (resto del
  distrito activo) y lejana (otros distritos, que hoy no existen). La transición materializa el
  detalle desde el agregado con el PRNG autoritativo y regulariza mediante transacciones
  auditables, de modo que no se duplique ni se destruya valor.

## Medición

Ejecución de referencia (`pnpm system:cost`, seed 7, tick sin instrumentar, milisegundos):

| Escala | Parcelas | Edificios | Tenants | Agentes | Pólizas | Día media | Día p95 | Día p99 | Mes media | Fuego media | Fuego p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| barrio | 78 | 40 | 69 | 32 | 10 | 0,0086 | 0,0212 | 0,0658 | 0,0082 | 0,0069 | 0,0135 |
| distrito | 228 | 146 | 225 | 84 | 36 | 0,0170 | 0,0388 | 0,1406 | 0,0129 | 0,0144 | 0,0351 |
| ciudad | 828 | 607 | 951 | 290 | 151 | 0,0498 | 0,1152 | 0,4454 | 0,0402 | 0,0476 | 0,1138 |

La ciudad máxima es la que permite el mapa: `map.width` y `map.height` son 64 en `GameState` y
`districtSchema` usa `z.literal(64)`, y con la separación ortogonal de D-064 el harness coloca 828
parcelas antes de quedarse sin celdas. Una escala de 5000 parcelas lanza `RangeError`, y hay prueba
que lo cubre.

Reparto del coste en ciudad/día: `insurance` 59,2 %, `tactical` 30,8 %, `production` 2,2 %, `rival`
1,9 % y los seis sistemas restantes por debajo del 0,5 % cada uno. En ciudad/fuego: `insurance`
52,8 % y `tactical` 36,3 %.

Comparación con el código anterior en ciudad/día:

| Métrica | Antes | Después | Cambio |
| --- | --- | --- | --- |
| media | 0,2036 | 0,0498 | −76 % |
| p95 | 0,2303 | 0,1152 | −50 % |
| máximo | 6,53 | 3,13 | −52 % |
| exponente de crecimiento barrio→ciudad (media) | 0,935 | 0,744 | sublineal |
| exponente de crecimiento barrio→ciudad (p95) | 0,774 | 0,716 | sublineal |

El exponente se calcula sobre un crecimiento de ×10,62 en parcelas y ×15,18 en edificios. Dos
ejecuciones consecutivas del harness difieren menos del 1 % en la media y menos de 0,04 en el
exponente; la tabla usa la última.

Frente a los umbrales de `docs/execution/phase-0/benchmark-plan.md`, en la ciudad máxima: p95 0,1152
ms sobre 10 ms (1,2 %), p99 0,4454 ms sobre 20 ms (2,2 %) y máximo global 3,19 ms sobre el límite
de 50 ms, con cero ticks por encima.

Coste de ordenación medido (misma ejecución): 290 ids de agente 0,0853 ms con `localeCompare` frente
a 0,0222 ms con comparación relacional; 607 ids de edificio 0,1514 frente a 0,0338; 151 ids de
póliza 0,0321 frente a 0,0051. El orden resultante es idéntico en los tres casos y una prueba
siempre activa lo verifica sobre agentes, edificios, parcelas, instalaciones, préstamos y obras.

## Evidencia

### Evidence

- `packages/simulation/src/systems.ts`: `ProductSystem`, `PRODUCT_SYSTEMS`, `advanceProductSystems`,
  `indexActiveIncidents`, `indexAdjacentTechnicians`, `collectWorkingMaintenance` y las salidas
  anticipadas de `tacticalTick`, `settleInsurance` y `settleAuctions`.
- `packages/simulation/src/system-cost.ts`: escalas, ventanas, ciudad sintética, percentiles,
  distribución por sistema, preparación de ciudades y fila de crecimiento entre escalas.
- `packages/simulation/src/system-cost.test.ts`: seis pruebas (reproducibilidad de la ciudad
  sintética, PRNG de partida intacto, neutralidad de la instrumentación, rechazo de escala
  imposible, equivalencia de orden relacional/`localeCompare` y medición opt-in por
  `SYSTEM_COST=1`).
- `packages/simulation/src/tick-conservation.test.ts`: diez digestos dorados, con digesto local sin
  dependencias para no introducir globales prohibidos en `packages/simulation`.
- `package.json`: script `system:cost`.
- `docs/engineering/adr/D-065-coste-del-tick-y-lod-latente.md`: decisión, diseño de zonas,
  disparadores de activación y alternativas descartadas.

### Finding

El cuello no estaba en la entidad del modelo sino en barridos que se repetían por edificio. En la
ciudad máxima, el paso horario de técnicos evaluaba 607 × 290 = 176 030 predicados por hora de juego
y además construía una copia de la tabla de incidentes **dentro** del bucle por edificio; el p50 de
`tactical` coincidía casi exactamente con el coste de ordenar los 290 agentes. `settleInsurance`
ordenaba la cartera completa en cada tick cuando las primas son mensuales: una operación sin efecto
garantizado en 35 999 de cada 36 000 ticks.

La segunda conclusión es de alcance: con el mapa limitado a 64×64, la ciudad máxima cuesta 0,0498 ms
de media, el 0,5 % del presupuesto. Implementar LOD agregado en esas condiciones habría sustituido
exactitud verificable por tolerancias que validar y por un riesgo real de duplicar o destruir valor
en cada transición de zona, que es justo lo que la aceptación del WP prohíbe.

El término lineal que queda es `settleInsurance` (59,2 % del coste), y no se puede eliminar sin un
índice de primas vencidas que exige cambiar el formato de guardado.

### Path

`PRODUCT_SYSTEMS -> ciudad sintética por escala y ventana -> cronometraje por sistema ->
distribución y crecimiento -> digestos dorados de conservación -> verificación diferencial contra
la implementación anterior -> decisión de no agregar -> diseño de zonas y disparadores`

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check:architecture
pnpm system:cost
pnpm smoke:phase2
pnpm smoke:art-lab
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, 102 en simulation y 17 en web. Cinco pruebas opt-in siguen
  omitidas (`benchmark`, `soak`, `audit:metrics`, inspector de distritos y coste por sistema).
  Ninguna aserción económica de Gate 2 o Fase 3 se modificó.
- Guarda de arquitectura en verde: el harness y la medición viven en `packages/simulation` sin
  dependencias de UI ni globales de navegador.
- Diez digestos dorados estables, incluidas las tres cascadas con colapso y bajas.
- Verificación diferencial: mismos digestos con la implementación anterior y con la nueva en cuatro
  escenarios (3000 ticks con 12 incidentes sobre 50 parcelas, 3000 ticks con 40 incidentes sobre
  200 parcelas, 1500 ticks con 50 incidentes sobre 800 parcelas y 1500 ticks estables sobre 800
  parcelas), con 37, 135 y 463 edificios en ruina y 150, 544 y 1938 bajas respectivamente.
- `pnpm build` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2 idéntico antes y después del cambio (`CAJA 5228 u.` y snapshot
  resincronizado en ambos casos), y smoke de Art Lab en `status: passed`.
- Lint en verde sobre el código versionado (`pnpm exec eslint packages apps scripts`).

## Deuda detectada no corregida en este WP

- `pnpm format:check` sigue fallando con los mismos tres ficheros ya commiteados sin formatear
  (`apps/web/src/isometric/IsometricSpikeScene.ts`, `scripts/art-lab-browser-smoke.mjs`,
  `scripts/validate-visual-direction-spike.mjs`). Es anterior a WP4.2 y reproduce el fallo en CI.
- `pnpm lint` falla en local por `blender_artist/toolchain/`, en `.gitignore` pero no en los
  `ignores` de `eslint.config.js`. Anterior a WP4.2.
- `localeCompare` como criterio de orden en unos veinte puntos del motor, incluido `orderEntityIds`
  de `clock.ts`: cuesta entre 3,8× y 6,3× más que la comparación relacional y hace que el orden
  dependa del locale del entorno. Requiere ADR propio y cambio global; sustituirlo sólo en
  `systems.ts` dejaría dos criterios en el mismo motor.
- `settleInsurance` recorre la cartera completa en cada tick. Un índice de primas vencidas lo
  reduciría a O(vencidas) pero exige cambio de formato de guardado y decisión de migración.
- `findDeterministicPath` reordena la lista abierta con un `sort` completo en cada iteración, lo que
  explica los picos de `tactical` (máximo 3,13 ms en ciudad/día). Es anterior a WP4.2.
- `canonicalizeState` es sensible al orden de claves JSON: un estado restaurado no produce la misma
  cadena canónica que uno fresco aunque represente la misma partida. Anterior a WP4.1; los digestos
  dorados comparan siempre partida fresca contra partida fresca.
- El barrido de daños por explosión (pasos 7-9 de `tacticalTick`) sigue siendo
  O(pendientes × edificios) y O(pendientes × agentes). No se ha tocado porque sólo se ejecuta con
  colapsos, porque el daño en cadena depende del orden de inserción de los edificios y porque
  cualquier reordenación cambiaría los ids de incidente asignados. Queda registrado como candidato
  si un disparador de D-065 obliga a intervenir.

## Fuera de alcance

No se implementan estado agregado por sistema, transiciones de zona ni tolerancias de comparación
agregado/detallado: quedan latentes con disparadores objetivos en D-065. Tampoco índice de primas
vencidas, sustitución global de `localeCompare`, reescritura del pathfinding, varios distritos por
partida ni ninguna decisión del render. La instrumentación persistente de sesiones de Alpha sigue
diferida por D-063 y debe cerrarse antes de WP4.16.
