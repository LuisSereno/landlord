# WP4.6 — Servicios urbanos y accesibilidad — 2026-10-23

## Estado

`DONE` con el overlay de mapa diferido a WP4.15. Invertir o recortar servicios cambia la cobertura,
la deseabilidad y la ocupación, y la población sostiene el presupuesto con una tasa por unidad
ocupada. Decisión en `docs/engineering/adr/D-069-servicios-urbanos-y-cobertura.md`.

## Resultado

- **Tres servicios con nombre y consecuencia propia**: transporte (accesibilidad), seguridad
  (seguridad) y limpieza (calidad del parque), con coste municipal por edificio y radio base
  26/30/20 celdas.
- **Cobertura radial desde el centro del distrito**, derivada de las parcelas generadas. Sin
  entidades nuevas: `coverage = calidad × (1 − distancia / radio)`, una pasada O(parcelas).
- **Capacidad que se satura al crecer**: el radio efectivo es
  `base × sqrt(40 / max(40, edificios))` con suelo por servicio, así que la expansión diluye la
  cobertura y el borde queda peor atendido.
- **Efecto por componente**: transporte alimenta `accessibility`; seguridad resta
  `(100 − cobertura) / 2` a `safety`; limpieza resta `(100 − cobertura) / 4` a `quality`.
- **Base fiscal**: tasa municipal de 3 u./mes por unidad ocupada, acreditada al municipio y anotada
  como `serviceFee` en el libro.
- **Prioridad de pago**: administración → seguridad → transporte → limpieza. La limpieza es lo
  primero que se recorta y el borde lo nota primero.
- El panel publica calidad, radio, edificios cubiertos y cobertura media por servicio, además del
  presupuesto por categoría.

## Evidencia

### Evidence

- `packages/simulation/src/urban-services.ts`: `URBAN_SERVICE_POLICY`,
  `MUNICIPAL_FEE_PER_OCCUPIED_UNIT`, `buildCoverageIndex`, `coverageFor`,
  `describeUrbanServices`, `occupiedUnits` y `municipalServiceFee`.
- `packages/simulation/src/urban-services.test.ts`: cinco pruebas.
- `packages/simulation/src/municipal-budget.ts`: cuatro categorías, coste por servicio y tasa.
- `packages/simulation/src/housing-market.ts`: cobertura en calidad, accesibilidad y seguridad.
- `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts`: `urbanServices`.
- `packages/simulation/src/municipal-budget.test.ts` y `housing-market.test.ts`: aserciones
  actualizadas al modelo de cobertura.
- `packages/simulation/src/tick-conservation.test.ts`: dos digestos regenerados.
- `apps/web/src/App.tsx`: línea de servicios.

### Finding

La cobertura cae con la distancia de forma medible: en un distrito pequeño el centro está al 100 % y
una parcela a 26 celdas queda por debajo del 10 %. Al crecer a 200 parcelas el radio de transporte
baja del máximo de 26 a un valor menor y nunca cruza el suelo de 8.

El recorte es causal y no decorativo: con transporte y limpieza a cero la accesibilidad de un
edificio céntrico cae a 0 y su calidad baja 25 puntos; el borde sufre antes que el centro porque su
proporción de distancia ya era peor. La tasa por unidad ocupada escala con la ocupación (dos unidades
generan 6 u./mes) y entra en el libro del municipio.

La comparación de observables repite el patrón de WP4.5: ocho de los diez casos quedan idénticos y
sólo los dos que cruzan un cierre mensual cambian, en la caja municipal y en sus transacciones.

### Path

`presupuesto por servicio -> calidad -> radio efectivo por tamaño del distrito -> cobertura por
parcela -> accesibilidad, seguridad y calidad del parque -> deseabilidad y ocupación -> tasa por
unidad ocupada -> presupuesto municipal`

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
- Suite completa: 23 tests en shared, 131 en simulation (5 opt-in omitidos) y 17 en web. Las cinco
  pruebas nuevas de WP4.6 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios; el panel renderiza la línea de servicios
  sin errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Observables de conservación: ocho casos idénticos; los dos con cierre mensual cambian sólo la caja
  municipal y el número e importe de transacciones.

Digestos regenerados (antes → después):

| Caso | Antes | Después |
|---|---|---|
| `city:50-parcels:month-boundary` | `664f94099baa1a7f` | `0667607b64a964a3` |
| `city:200-parcels:month-boundary` | `68deecf1d71ca91f` | `c7c7ccfe29d17733` |

## Deuda detectada no corregida en este WP

- **Overlay de mapa diferido a WP4.15.** El dato de cobertura está en la proyección y la explicación
  en el panel, pero la capa visual sobre el mapa no se construye sin dirección visual aprobada.
- El centro de servicio se deriva de todas las parcelas; un perfil con parcelas excéntricas puede
  dejar medio distrito sin cobertura.
- La calidad del servicio es única por distrito: no hay calidad por barrio más allá de la distancia.
- No hay transporte entre distritos ni congestión; la accesibilidad es radial.
- Los radios, costes y la tasa son grados de libertad de balance sin herramienta de barrido.
- `pnpm format:check` sigue fallando por tres ficheros ya commiteados antes de WP4.1; `pnpm lint`
  sigue fallando en local por `blender_artist/toolchain/`; `canonicalizeState` sigue siendo sensible
  al orden de claves.

## Fuera de alcance

No se implementan edificios, vehículos o personal de servicio, calidad por barrio, commuting real,
transporte interdistrito, edición del reparto presupuestario por el jugador ni la capa visual de
overlay. La instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
