# WP4.5 — Presupuesto municipal — 2026-10-23

## Estado

`DONE`. El municipio deja de ser un sumidero: recauda, gasta en orden de prioridad y, cuando no
llega, recorta con un nivel de servicio observable que baja la deseabilidad del barrio. Decisión en
`docs/engineering/adr/D-068-presupuesto-municipal.md`.

## Resultado

- **Una sola caja**: las reservas municipales son el saldo de `org_00000004`; `phase2.municipal`
  guarda el libro (ingresos por fuente, gasto y descubierto por categoría, niveles de servicio y
  meses en déficit), no dinero.
- **Tres categorías con prioridad**: administración (10 fijos al mes), seguridad (1 por edificio) y
  servicios (2 por edificio), pagadas en ese orden. Bajo caja insuficiente se financia primero lo
  esencial y el recorte cae en lo prescindible.
- **Ciclo mensual al final del tick**: `municipal` cierra `PRODUCT_SYSTEMS` cuando los impuestos del
  mes ya han entrado; no se reordena ningún sistema existente.
- **Sin dinero implícito**: el municipio paga con su saldo y sólo hasta donde alcanza; lo que no
  puede pagar queda como descubierto y no se emite dinero.
- **Ingresos por fuente**: propiedad (120 pb) y transferencia (150 pb) ya se enrutaban al municipio;
  ahora cada cobro se anota en el libro y el cierre acumula y reinicia el mes.
- **Trade-off observable**: el nivel de servicios multiplica el componente `services` de la
  deseabilidad del mercado de vivienda y el de seguridad resta `(100 − nivel) / 2` puntos de
  `safety`. El recorte se nota en la ocupación, no sólo en la contabilidad.
- Persistencia aditiva: `phase2.municipal` es opcional; una partida anterior carga con el libro a
  cero y los niveles al 100 %.
- El panel de riesgo y política muestra reservas, ingresos del mes por fuente, gasto planificado,
  los tres niveles de servicio y los meses en déficit.

## Evidencia

### Evidence

- `packages/simulation/src/municipal-budget.ts`: `MUNICIPAL_BUDGET_POLICY`,
  `plannedMunicipalCosts`, `describeMunicipalBudget`, `municipalServiceLevel` y
  `runMunicipalBudget`.
- `packages/simulation/src/municipal-budget.test.ts`: cinco pruebas.
- `packages/shared/src/domain.ts`: `MunicipalBudgetState` y `municipalBudgetStateSchema`.
- `packages/simulation/src/snapshot.ts` y `packages/shared/src/snapshot.ts`: persistencia aditiva.
- `packages/simulation/src/systems.ts`: anotación de la propiedad y sistema `municipal`.
- `packages/simulation/src/commands.ts`: anotación de la transferencia.
- `packages/simulation/src/housing-market.ts`: niveles de servicio en `safety` y `services`.
- `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts`: bloque `municipal`.
- `apps/web/src/App.tsx`: línea de presupuesto municipal.
- `packages/simulation/src/phase2.test.ts`: la prueba de impuestos de WP3.5 pasa a verificar el
  libro presupuestario además de la caja.

### Finding

Con dos parcelas a 10 000 u. y dos edificios, el municipio recauda 240 de propiedad en el cierre y
gasta 16 (10 de administración, 2 de seguridad y 4 de servicios): reserva 224 y niveles al 100 %.

El recorte se comporta como se declara: con caja 15, sin ingresos y tres edificios, paga 10 de
administración y 3 de seguridad, deja 2 de los 6 de servicios sin financiar y publica niveles
100 / 100 / 33 con un mes de déficit. El orden de prioridad no es una convención de la interfaz:
está en el bucle de pago.

La trazabilidad de la evidencia mejoró con el cambio: la prueba de impuestos de WP3.5 verificaba la
caja municipal como si fuera un acumulador; ahora verifica el libro (10 de propiedad, 12 de
transferencia, 10 gastados) y la caja resultante. La intención original se conserva y la nueva
regla queda explícita.

### Path

`compra y propiedad -> impuestos al municipio -> libro de ingresos por fuente -> cierre presupuestario
-> pago por prioridad -> descubierto y niveles de servicio -> deseabilidad y ocupación del mercado de
vivienda`

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
- Suite completa: 23 tests en shared, 126 en simulation (5 opt-in omitidos) y 17 en web. Las cinco
  pruebas nuevas de WP4.5 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios. Comprobación en Chromium del panel:
  "Municipio: reservas 0 u. · ingresos del mes 0 propiedad + 0 transferencia · gasto planificado 10
  u. · servicio administración 100 % · seguridad 100 % · servicios 100 % · meses en déficit 0",
  sin errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Comparación de observables en los diez casos de conservación: ocho son idénticos en todo. Los dos
  que cruzan un cierre mensual cambian sólo la caja municipal (`org_00000004`) y el número e importe
  de transacciones, por los pagos de administración, seguridad y servicios. Jugador, rival, banco,
  aseguradora, hogares, ruinas, incidentes y bajas siguen idénticos.

Digestos regenerados (antes → después):

| Caso | Antes | Después |
|---|---|---|
| `city:50-parcels:month-boundary` | `706a323526435134` | `664f94099baa1a7f` |
| `city:200-parcels:month-boundary` | `617d7096de822d70` | `68deecf1d71ca91f` |

Los otros ocho casos conservan su digesto porque no cruzan un cierre mensual y el municipio no
interviene.

## Deuda detectada no corregida en este WP

- Sin deuda pública ni rescate: un municipio con déficit estructural recorta servicios
  indefinidamente. Es una decisión de producto pendiente, no un olvido.
- El gasto por edificio acopla el presupuesto al tamaño del distrito; un distrito grande con pocos
  propietarios puede entrar en déficit permanente.
- Los permisos de obra siguen sin tasas; hoy sólo la propiedad y la transferencia alimentan al
  municipio.
- El coste por categoría y los niveles de servicio no tienen herramienta de barrido.
- `pnpm format:check` sigue fallando en local y CI por tres ficheros ya commiteados antes de WP4.1.
- `pnpm lint` sigue fallando en local por `blender_artist/toolchain/`, fuera de los `ignores` de
  eslint.
- `canonicalizeState` sigue siendo sensible al orden de claves JSON.

## Fuera de alcance

No se implementan deuda pública, presupuesto plurianual, partidas de capital, servicios urbanos
reales ni su cobertura (WP4.6), tasas de licencia, ni edición del presupuesto por el jugador. La
instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
