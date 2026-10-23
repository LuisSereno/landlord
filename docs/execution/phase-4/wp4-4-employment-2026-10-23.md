# WP4.4 — Empleo y actividad económica — 2026-10-23

## Estado

`DONE`. El empleo entra en la capacidad de alquiler: un cierre de planta encadena paro, bajada de
salario, caída de ingreso y más vacancia, sin una regla de evento específica. Decisión de diseño en
`docs/engineering/adr/D-067-empleo-agregado-y-capacidad-de-alquiler.md`.

## Resultado

- **Mercado laboral agregado**: los puestos los aportan las plantas productivas operativas (4 por
  edificio); los trabajadores son los hogares contratados. Los talleres no contratan porque el
  artesano o comerciante que los ocupa es autónomo. No hay asignación individuo-puesto.
- **Salario con banda**: el índice parte de 100, se mueve ±3 puntos por mes según
  `puestos / trabajadores − 1` con sensibilidad 6 y queda acotado en `[90, 120]`.
- **Ingreso por segmento**: los hogares combinan empleo con una economía informal que cubre el 85 %
  de la renta sin puesto; artesanos y comerciantes siguen el nivel salarial. El índice de ingresos
  resultante está acotado en `[60, 130]` y multiplica el presupuesto base de renta del segmento.
- **Presupuestos base recalibrados** a 260 / 360 / 380 para que la renta más barata siga siendo
  asequible en el suelo de ingresos; sin ese margen, un distrito sin industria sería inhabitable.
- **Quién se actualiza**: sólo los hogares creados por el mercado recalculan su presupuesto cada
  mes con su `incomeFactorPercent`. Los autorados conservan el presupuesto de escenario.
- **Orden del tick**: `employment` se ejecuta justo antes de `housing`, de modo que el ingreso del
  mes decide qué vivienda es asequible antes de que el mercado admita o coloque a nadie.
- **Indicadores**: puestos, puestos por sector, trabajadores, ocupados, parados, tasa de empleo,
  índice salarial e índice de ingresos por segmento, publicados en la proyección y visibles en el
  panel de riesgo y política.
- Persistencia aditiva: `phase2.employment` y `incomeFactorPercent` son opcionales; una partida
  anterior carga con salario 100 e ingresos al 100 %.

## Evidencia

### Evidence

- `packages/simulation/src/employment.ts`: `EMPLOYMENT_POLICY`, `SECTOR_BY_BUILDING_TYPE`,
  `JOBS_BY_BUILDING_TYPE`, `describeLaborMarket`, `incomeIndexPercentBySegment`,
  `effectiveRentBudget`, `describeEmployment` y `runEmployment`.
- `packages/simulation/src/housing-segments.ts`: segmentos compartidos por vivienda y empleo.
- `packages/simulation/src/employment.test.ts`: siete pruebas.
- `packages/shared/src/domain.ts`: `EmploymentState`, `employmentStateSchema` y
  `Tenant.incomeFactorPercent`.
- `packages/simulation/src/snapshot.ts` y `packages/shared/src/snapshot.ts`: persistencia aditiva y
  normalización.
- `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts`: bloque `employment`.
- `packages/simulation/src/systems.ts`: `employment` antes de `housing` en `PRODUCT_SYSTEMS`.
- `packages/simulation/src/housing-market.ts`: asequibilidad y llegadas contra el presupuesto
  efectivo.
- `packages/simulation/src/tick-conservation.test.ts`: diez digestos regenerados con justificación.
- `apps/web/src/App.tsx`: línea de empleo en el panel de riesgo y política.

### Finding

Las cifras del cierre mensual son legibles en las dos direcciones. Con 8 puestos y 7 trabajadores el
salario queda en 101, el ingreso del hogar en 101 y el presupuesto de renta en 263 frente a una
renta de 252: la plaza vacante es asequible y el atractivo del segmento sube a 97 %. Sin puestos, el
mismo distrito cae a salario 97, ingreso 82, presupuesto 213 y atractivo 61 %: la plaza sigue
vacante y deja de ser asequible. El paro también responde: 4 puestos con 12 trabajadores dejan 8
parados, tasa del 33 % y salario en el suelo de 90; la escasez inversa, 12 puestos con 2
trabajadores, lleva el salario al techo de 120.

La cadena completa se comprobó destruyendo dos plantas en un distrito con cuatro hogares
contratados: los 8 puestos caen a 0, el paro sube a 4, el salario y el ingreso bajan, y con ellos la
asequibilidad. No hay una regla de "cierre" en el código: la pérdida de puestos es la única causa.

Una lección de calibración: con el presupuesto de segmento anterior (220) la renta mínima (180)
consumía el 82 % del presupuesto y cualquier paro dejaba el distrito sin hogares que pudieran pagar.
Subir la base a 260 deja margen para que el empleo se note sin hacer inhabitable el arranque.

### Path

`plantas operativas -> puestos -> trabajadores -> índice salarial acotado -> índice de ingresos por
segmento -> presupuesto efectivo de renta -> asequibilidad y presupuesto de cada hogar de mercado ->
llegadas, colocación y vacancia del mercado de vivienda`

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
- Suite completa: 23 tests en shared, 121 en simulation (5 opt-in omitidos) y 17 en web. Las siete
  pruebas nuevas de WP4.4 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios. Comprobación en Chromium del panel:
  "Empleo: 0 puestos · 0 trabajadores · paro 0 % · salario índice 100 % · ingreso hogares 100 %",
  sin errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Comparación de observables antes/después en los diez casos de conservación: los diez siguen
  idénticos. Sólo cambia el digesto canónico, porque el estado gana `phase2.employment` y
  `incomeFactorPercent`.

Digestos regenerados (antes → después):

| Caso | Antes | Después |
|---|---|---|
| `scenario:seed-1:1200` | `ace97c49a78af34c` | `3e74222da9a56f00` |
| `scenario:seed-7:1200` | `a3a03bcc9184ab74` | `14103ef0c3275ac8` |
| `scenario:seed-42:1200` | `1f0ca9fbbdbc6141` | `59e99227f5cb1b75` |
| `scenario:seed-1:36000` | `71d6cef52673c50f` | `6a05240180ec5c23` |
| `city:50-parcels:1300-ticks` | `fd797cdc572304ac` | `647ab036ce6ca6b9` |
| `city:50-parcels:month-boundary` | `3715417bb5c70c6f` | `706a323526435134` |
| `city:200-parcels:month-boundary` | `5e5f43c8106309eb` | `617d7096de822d70` |
| `city:50-parcels:fire-cascade` | `ada77107894b1f55` | `62873e8d5297617a` |
| `city:200-parcels:fire-cascade` | `7d6c147490b1d55f` | `54850d16ca272de4` |
| `city:800-parcels:fire-cascade` | `9a4f481d64014c2f` | `39bdd4d3f1ced61a` |

## Deuda detectada no corregida en este WP

- La escasez de mano de obra no reduce la producción: el efecto sobre la rentabilidad es indirecto
  (renta y ocupación). Penalizar el output cambiaría todas las trazas de producción existentes y
  exige su propia decisión con medición.
- El sector se conserva como recuento (`jobsBySector`), no como mercado salarial propio; una
  negociación por sector convertiría el WP en un simulador laboral.
- La asimetría autorado/mercado se consolida: los hogares de escenario no siguen el ciclo
  económico.
- `pnpm format:check` sigue fallando en local y CI por tres ficheros ya commiteados antes de WP4.1.
- `pnpm lint` sigue fallando en local por `blender_artist/toolchain/`, fuera de los `ignores` de
  eslint.
- `canonicalizeState` sigue siendo sensible al orden de claves JSON.

## Fuera de alcance

No se implementan asignación individual de personas a puestos, jornada, productividad por
trabajador, despido nominal, convenios por sector, penalización de producción por escasez,
commuting o transporte (WP4.6) ni subsidios pagados por una administración real (WP4.5). La
instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
