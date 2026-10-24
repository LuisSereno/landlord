# WP4.8 — Reputación multidimensional y relaciones — 2026-10-24

## Estado

`DONE`. Tres grupos valoran de forma distinta los mismos hechos, la memoria es acotada, sólo decae la
opinión y cada grupo tiene una salida ya existente en el modelo: el tipo del préstamo, la deseabilidad
del parque y la influencia mensual. Decisión en
`docs/engineering/adr/D-071-reputacion-multidimensional.md`.

## Resultado

- **Tres grupos con efecto real, no ocho barras**: `residents`, `municipality`, `banks`. Se queda
  fuera empresarios, policía, sindicatos, criminales y medios porque aún no hay canal que los consuma.
- **El hecho es la unidad de memoria**: `ReputationFact` guarda `kind`, `atTick`, `referenceId`,
  `magnitude` y el `deltaByGroup` aplicado, con tope de 16 hechos por organización y posición
  limitada a ±100.
- **Ocho clases de hecho** con tabla de valoración propia: contrato completado e incumplido, hogares
  desplazados, víctimas, deuda fiscal, abandono de mantenimiento, préstamo impagado y préstamo
  saldado. La magnitud se topa por hecho, así que un mes malo no hunde una carrera.
- **La aceptación se comprueba en el modelo**: desplazar hogares resta 3 ante los vecinos y 1 ante el
  gobierno, y suma 1 ante la banca.
- **Decaimiento sólo donde la opinión es opinión**: vecinos 3/mes, gobierno 2/mes, banca 0. Un impago
  crediticio pesa hasta que otro hecho lo compensa.
- **Tres canales cableados**: la banca aplica −100…+250 puntos básicos sobre la tasa base del
  préstamo; los residentes multiplican la deseabilidad del parque del casero por 80–108 %; el gobierno
  deposita 0–3 de influencia por cierre en cada empresa.
- **Los hechos los registran los sistemas que ya los observaban**: desalojos en la renta, víctimas en
  el colapso, impago y amortización en la deuda, cumplimiento en los contratos públicos, deuda fiscal y
  abandono al cierre mensual de `runReputation`.
- **Hecho, percepción e información separados**: el estado guarda la posición de todos; el reporte y
  la proyección sólo publican la del jugador. Qué es público, inferido o privado lo decide WP4.9.
- **Orden determinista**: `reputation` cierra después de `housing` y antes de `contracts`, para que
  ninguna organización puje con la influencia del mes anterior.
- `phase2.reputation` es opcional: una partida anterior se restaura con la posición neutra.

## Evidencia

### Evidence

- `packages/simulation/src/reputation.ts`: `REPUTATION_GROUPS`, `REPUTATION_POLICY`,
  `initialReputationState`, `standingFor`, `recordReputationFact`, `bankRateModifierBpsFor`,
  `residentFactorPercentFor`, `influenceGainFor`, `runReputation`, `describeReputation`.
- `packages/simulation/src/reputation.test.ts`: nueve pruebas.
- `packages/shared/src/domain.ts` (`ReputationGroupId`, `ReputationFactKind`, `ReputationFact`,
  `ReputationState` y sus esquemas), `snapshot.ts` (`phase2.reputation` opcional),
  `projection.ts` (bloque `reputation`).
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts` (sistema y cuatro puntos de
  registro), `public-contracts.ts`, `commands.ts` (tasa del préstamo), `housing-market.ts`
  (`landlordFactorPercent` en `StockUnit` y en `desirabilityOf`), `projection.ts`,
  `tick-conservation.test.ts` (dos digestos regenerados con nota).
- `apps/web/src/App.tsx`: bloque de reputación con posición, efectos y últimos hechos.

### Finding

Un mismo hecho, tres lecturas opuestas: dos hogares desplazados dejan `residents` −6, `municipality`
−2 y `banks` +2. La banca ve menos riesgo exactamente donde la calle ve un casero malo.

El canal crediticio es continuo y acotado: con posición 0 la tasa base de 900 pb no se mueve; un
impago de préstamo (−12 ante la banca) la sube a 1000 pb; dos préstamos saldados (+10) la bajan a
875 pb. El castigo y el premio vienen de la tabla, no de una condición suelta en el comando.

El canal de vivienda muestra por qué hace falta el decaimiento: cuatro desalojos en un edificio ruinoso
restan 12 ante los vecinos y el cierre mensual devuelve la lectura a −9, que todavía no cruza el umbral
del castigo (factor 100 %). Dos desalojos más llevan la posición a −15 y el parque del casero se
publica al 92 % de su atractivo limpio, comprobado contra `desirabilityOf`.

El canal político cambia el juego: en una ciudad de 50 parcelas sin incidentes sembrados, doce
cierres mensuales sin una sola mala acción llevan la influencia de 2 a 14 el jugador y de 1 a 13 el
rival, con posición municipal neutra y un depósito de +1 por mes. Con tres contratos cumplidos el
depósito sube a +2 por mes y con tres incumplidos cae a 0. La misma regla se aplica a toda
organización de tipo `company`, así que la prueba de lobby del rival pasa de gastar la influencia con
la que arrancaba a contar también el depósito mensual.

La ciudad de tensión (50 parcelas, 12 incidentes sembrados) muestra el riesgo de balance: diecisiete
hechos de víctimas llevan a ambas organizaciones a −91 vecinos y −90 gobierno, con el recargo máximo
de +250 pb y el depósito de influencia apagado. El decaimiento de 3/mes no compensa 4 puntos por
incidencia cuando el generador siembra el distrito con siniestros.

### Path

`sistemas que ya observan el suceso -> recordReputationFact(magnitud topada, delta por grupo) ->
posición acumulada ±100 -> tablas de efecto (tipo bancario, factor de deseabilidad, influencia
mensual) -> comandos y mercado que leen el efecto -> cierre mensual: hechos agregados, decaimiento,
depósito de influencia -> contratos y presupuesto del mismo tick -> proyección y panel`

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm check:architecture
pnpm exec eslint packages apps scripts
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, 149 en simulation (5 opt-in omitidos) y 17 en web. Las nueve
  pruebas nuevas de WP4.8 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios. Comprobación headless del panel con
  Playwright sobre el bundle de preview: `Reputación: vecinos 0 · gobierno 0 · banca 0. La banca
  aplica 0 puntos básicos al préstamo, los residentes valoran tu parque al 100 % y el gobierno te deja
  1 de influencia al mes.` y cero errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Digestos dorados: cambian exactamente los dos casos que cruzan un cierre mensual
  (`city:50-parcels:month-boundary` → `611b01b5e69f0d61`, `city:200-parcels:month-boundary` →
  `7ab1cf04050e3d4d`) y sólo se mueve la influencia de las empresas: las cinco cajas y el número de
  transacciones quedan idénticos. Se verificó neutralizando las tres tablas de efecto en una sonda
  temporal —con ellas a cero los diez digestos recuperan el valor de WP4.7—, así que el delta procede
  sólo de los canales pretendidos. La nota de regeneración queda en la cabecera de
  `tick-conservation.test.ts`.

## Deuda detectada no corregida en este WP

- **`canonicalizeState` sigue ciego a los agregados** de WP4.3–WP4.8 (`employment`, `municipal`,
  `housingMarket`, `contracts`, `reputation`). Ampliarlo reescribiría los diez digestos por un motivo
  ajeno al WP; los digestos regenerados aquí lo hacen por un cambio de reglas real, no por la forma
  del estado. La determinancia de reputación se comprueba comparando el snapshot completo.
- **Balance sin ajustar**: decaimientos (3/2/0), topes de magnitud, umbrales y las cinco filas de cada
  tabla son grados de libertad sin herramienta de barrido. Con 12 incidentes sembrados, las víctimas
  dominan cualquier otra señal y ambas organizaciones quedan en el peor recargo bancario desde el
  primer tercio de la partida.
- **Sólo tres grupos**: policías, medios, sindicatos, empresarios y criminales siguen sin reputación
  propia. `heat` cubre la atención policial, pero no es una opinión sobre la organización.
- **No hay relaciones entre organizaciones**: la reputación es grupo → organización. El "quién odia a
  quién" entre facciones corresponde a WP4.10.
- **El jugador no puede gestionar su reputación desde la interfaz**: ve hechos y posiciones, pero no
  hay acción correctiva. La sanidad por gasto (limpieza, mantenimiento) es indirecta.
- Los hechos antiguos se recortan a 16 por organización: la posición sobrevive, el detalle no.
- `apps/web/src/App.tsx` sigue leyendo la categoría `services` obsoleta en la línea municipal desde
  WP4.6; el desglose real es transporte, seguridad y limpieza.
- El rival puja por contratos con puntuación 76, por debajo de expansión (80): la vía pública sigue
  sin explotarse en partida real y, por tanto, el canal `contract_completed` apenas se dispara en IA.
- `pnpm format:check` sigue fallando por cuatro ficheros ya commiteados antes de este WP
  (`IsometricSpikeScene.ts`, `urban-services.test.ts`, `art-lab-browser-smoke.mjs`,
  `validate-visual-direction-spike.mjs`); `pnpm lint` sigue fallando en local por
  `blender_artist/toolchain/`.

## Fuera de alcance

No se implementan más grupos de reputación, relaciones entre organizaciones, percepciones con
precisión y antigüedad, filtrado de información del rival (WP4.9), facciones y planificador (WP4.10),
campañas electorales (WP4.11), corrupción o soborno, ni acciones correctivas caras en el panel. La
instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
