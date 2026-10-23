# WP4.3 — Oferta y demanda de vivienda — 2026-10-23

## Estado

`DONE`. Construir más plazas ya no garantiza ocuparlas: la ocupación la fija la demanda segmentada
y la vacancia mueve el precio. Decisión de diseño registrada en
`docs/engineering/adr/D-066-mercado-de-vivienda-segmentado.md`.

## Resultado

- El pool de cuatro hogares autorados se convierte en **demanda segmentada**: `household`, `maker` y
  `shopkeeper`, cada uno con presupuesto de renta, tipos de edificio preferidos, techo de población,
  llegadas por mes y pesos de deseabilidad propios.
- El hogar gana `size` (ocupantes), `segmentId`, `searchMonths` y `origin`. `size` sustituye los
  recuentos de ocupantes codificados del colapso; los hogares autorados conservan 3/2/2, así que
  las bajas de una partida antigua no cambian.
- **Una sola fórmula de renta** (`askingRentFor`) usada por el cobro, la validación de contrato y la
  proyección. El índice de renta por tipo forma parte de ella.
- **Precio descubierto por vacancia**: con tres o más edificios operativos del tipo, el índice se
  mueve 2,5 puntos por punto de vacancia respecto al 8 % objetivo, con paso máximo de ±4 por mes y
  banda [80, 125]. Con menos de tres edificios del tipo no hay precio: las pruebas del slice con un
  único edificio conservan su aritmética exacta.
- **Deseabilidad de cuatro componentes** por parcela (calidad, accesibilidad al centro de actividad,
  seguridad por incidentes cercanos y presión policial, servicios en radio de 6 celdas) ponderadas
  por segmento. El atractivo del segmento combina parque, seguridad, asequibilidad y empleo.
- **Llegadas acotadas por tres topes**: techo de población, plazas compatibles libres y plazas
  asequibles. Sin plazas o sin plazas pagables no llega nadie.
- El mercado sólo coloca los hogares que él genera (`origin: "market"`); los autorados los coloca el
  jugador y caducan si no encuentran plaza en seis meses. La decisión de `AssignTenant` se conserva.
- **Movilidad contada**: fin de contrato, desalojo por condición o satisfacción e expiración de
  búsqueda incrementan `departuresTotal`; el hogar vuelve al pool.
- Persistencia aditiva: `phase2.housingMarket` y los cuatro campos de `Tenant` son opcionales en el
  schema. Una partida anterior carga con índice 100 y reconstruye los campos desde el perfil.
- El panel de riesgo y política muestra índice de renta, vacancia, llegadas y salidas por tipo y la
  población, el atractivo y las plazas asequibles de cada segmento.

## Evidencia

### Evidence

- `packages/simulation/src/housing-market.ts`: segmentos, política, `askingRentFor`,
  `desirabilityOf`, `describeHousingStock`, `describeHousingMarket`,
  `vacancyPercentByBuildingType`, admisión, expiración, colocación y `runHousingMarket`.
- `packages/simulation/src/housing-market.test.ts`: doce pruebas.
- `packages/shared/src/domain.ts`: `Tenant` extendido, `HousingMarketState`,
  `housingMarketStateSchema`, `tenantSchema` con campos opcionales.
- `packages/shared/src/snapshot.ts` y `packages/simulation/src/snapshot.ts`: persistencia aditiva,
  normalización de hogares antiguos y restauración del índice.
- `packages/shared/src/projection.ts` y `packages/simulation/src/projection.ts`: contrato
  `housingMarket` y campos de hogar en la proyección.
- `packages/simulation/src/systems.ts`: `collectRentAndAgeLeases` usa `askingRentFor`, el colapso
  cuenta `tenant.size`, la salida de contrato incrementa `departuresTotal` y `housing` cierra
  `PRODUCT_SYSTEMS`.
- `packages/simulation/src/commands.ts` y `projection.ts`: fórmula única de renta.
- `packages/simulation/src/game-data.ts`: `TENANT_PROFILE_DEFAULTS` y hogares autorados explícitos.
- `packages/simulation/src/system-cost.ts`: ciudad sintética marcada como `authored`.
- `packages/simulation/src/tick-conservation.test.ts`: diez digestos regenerados con justificación.
- `apps/web/src/App.tsx`: bloque "Mercado de vivienda" en el panel de riesgo y política.

### Finding

La invariante del WP no se sostiene con un pool único ni con demanda sin techo: con 12 viviendas
(24 plazas) se ocupan 20 y quedan 4 vacías; con 20 viviendas (40 plazas) se ocupan 19 y quedan 21
vacías, con el índice de patio en el suelo de la banda (80). Dieciséis plazas más no producen
dieciséis hogares más.

El shock de renta es igual de legible: con seis viviendas y cuatro meses de rodaje hay 6 plazas
asequibles y 8 llegadas acumuladas; al activar una ordenanza que sube la renta un 100 %, las plazas
asequibles caen a 0, el atractivo baja de 81 % a 61 % y las llegadas se congelan en 8, mientras la
vacancia sigue ahí. La vacancia sube porque el precio dejó de ser pagable, no porque falte suelo.

Durante el desarrollo la primera versión colocaba también los hogares autorados: el mercado
instalaba un inquilino en un edificio vacío en el primer cierre mensual y la prueba de liquidez de
WP3.6 pasó a fallar porque el edificio generaba renta. Se separó `origin` en lugar de relajar la
prueba, y con ello los diez observables económicos de conservación quedaron idénticos byte a byte
en sus valores, no sólo en el digesto.

### Path

`segmentos -> stock operativo y cuatro componentes -> vacancia observada -> índice acotado ->
atractivo por segmento -> llegadas con tres topes -> colocación de hogares de mercado ->
`askingRentFor` en cobro, contrato y proyección -> snapshot con mercado e identidad de hogar`

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
- Suite completa: 23 tests en shared, 114 en simulation (5 opt-in omitidos) y 17 en web. Las doce
  pruebas nuevas de WP4.3 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios respecto a WP4.2. Comprobación adicional
  en Chromium del panel nuevo: índice 100 %, vacancia 0 %, 0 llegadas y 0 salidas, con los tres
  segmentos a 2/24, 1/16 y 1/12 hogares y sin errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Comparación de observables antes/después en los diez casos de conservación (saldos, número e
  importe de transacciones, estado y destino de cada hogar, ruinas, incidentes y bajas): los diez
  son idénticos. Sólo cambia el digesto canónico, porque el estado gana campos.
- Dirección del índice comprobada: con cuatro viviendas vacías baja al suelo de la banda (80) y con
  el parque lleno sube al techo del paso mensual; con un único edificio no se mueve.
- Guardado y carga: serializar en el mes 5, restaurar y avanzar tres meses produce exactamente el
  mismo snapshot que la partida sin interrumpir.

Digestos regenerados (antiguo → nuevo):

| Caso | Antes | Después |
|---|---|---|
| `scenario:seed-1:1200` | `7c24ad01b9d58168` | `ace97c49a78af34c` |
| `scenario:seed-7:1200` | `2ae4e6eaf28b3556` | `a3a03bcc9184ab74` |
| `scenario:seed-42:1200` | `f6399857cc482775` | `1f0ca9fbbdbc6141` |
| `scenario:seed-1:36000` | `f8e697570e6a36d9` | `71d6cef52673c50f` |
| `city:50-parcels:1300-ticks` | `21393812ff1ed851` | `fd797cdc572304ac` |
| `city:50-parcels:month-boundary` | `209aa15832d7e9cd` | `3715417bb5c70c6f` |
| `city:200-parcels:month-boundary` | `fe93656d42cff519` | `5e5f43c8106309eb` |
| `city:50-parcels:fire-cascade` | `4d3bc693504a20f0` | `ada77107894b1f55` |
| `city:200-parcels:fire-cascade` | `21a01a90494f0bc8` | `7d6c147490b1d55f` |
| `city:800-parcels:fire-cascade` | `8e2ce00d895bb907` | `9a4f481d64014c2f` |

## Deuda detectada no corregida en este WP

- El cierre mensual recorre el parque en O(edificios²) para servicios y seguridad: ~368 000
  comparaciones en la ciudad máxima factible (607 edificios). Es mensual y cabe en el presupuesto,
  pero si el mapa deja de estar limitado a 64×64 lo primero es una rejilla espacial.
- `services` cuenta otros edificios en uso en un radio; es una aproximación que WP4.6 debe sustituir
  por equipamientos y accesibilidad reales.
- La seguridad usa incidentes activos y presión policial globales, no la capa de crimen por celda
  que aún no existe.
- El índice añade un grado de libertad de balance: `arrivalsAtFullAppeal`, los techos de población y
  los pesos de deseabilidad se ajustan a mano y no tienen todavía una herramienta de barrido.
- `pnpm format:check` sigue fallando en local y CI por tres ficheros ya commiteados antes de WP4.1
  (`apps/web/src/isometric/IsometricSpikeScene.ts`, `scripts/art-lab-browser-smoke.mjs`,
  `scripts/validate-visual-direction-spike.mjs`).
- `pnpm lint` sigue fallando en local por `blender_artist/toolchain/`, que está en `.gitignore` pero
  no en los `ignores` de `eslint.config.js`.
- `canonicalizeState` sigue siendo sensible al orden de claves JSON; una partida restaurada no se
  compara canónicamente con una fresca.

## Fuera de alcance

No se implementan salarios, puestos de trabajo individuales ni cierres de negocio (WP4.4), servicios
de barrio y accesibilidad peatonal (WP4.6), crimen localizado por celda, fijación manual de precios,
representación visual del mercado ni migración de perfiles de distrito retirados (deuda de D-064).
La instrumentación persistente de sesiones de Alpha sigue diferida por D-063 y debe cerrarse antes
de WP4.16.
